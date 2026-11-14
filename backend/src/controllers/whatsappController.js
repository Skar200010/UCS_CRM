import { sendDocumentMessage, sendReceiptMessage, sendNgoInfoTemplate, sendTemplateMessage, sendTextMessage, sendMediaMessage, testConnection, resolveAccount, listTemplatesForAccount, uploadDocumentBufferToMeta } from '../services/whatsappService.js';
import whatsappConfig from '../config/whatsappConfig.js';
import { getAccountById, getActiveAccounts } from '../models/whatsappAccountModel.js';
import { logOutboundMessage } from '../services/whatsappOutboundLog.js';
import { verifyReceiptFile } from '../services/receiptFileLink.js';
import { resolveTemplateHeaderAsset } from '../services/templateHeaderMedia.js';
import { presignStoredUrl } from '../services/mediaProxy.js';
import {
  resolveTemplateComponentsForSend,
  templateComponentOf,
} from '../services/whatsappTemplateComponents.js';
import {
  cancelWhatsAppCampaign,
  createWhatsAppCampaign,
  getWhatsAppCampaignProgress,
  getWhatsAppCampaignRow,
  resumeWhatsAppCampaign,
  runWhatsAppCampaign,
  sendBulkTemplateToRecipient,
} from '../services/whatsappBulkCampaignService.js';
import db from '../config/db.js';

const TEMPLATE_PROJECT_MAP = {
  bsct_receipt_2: 'bsct',
  mann_receipt: 'mann',
  aflf_receipt: 'aflf',
  ashray_receipt: 'aflf',
};

function phoneVariants(phone) {
  const raw = String(phone || '').replace(/\D/g, '');
  const values = new Set([raw]);
  if (raw.length === 10) values.add(`91${raw}`);
  if (raw.length === 12 && raw.startsWith('91')) values.add(raw.slice(2));
  return [...values].filter(Boolean);
}

/**
 * One canonical spelling for a WhatsApp number, so the same person cannot end
 * up split across a 10-digit and a 91-prefixed contact row (which is what made
 * one chat look like two threads and hid messages after reload).
 */
function normalizePhone(phone) {
  const raw = String(phone || '').replace(/\D/g, '');
  if (raw.length === 10) return `91${raw}`;
  if (raw.length === 11 && raw.startsWith('0')) return `91${raw.slice(1)}`;
  return raw;
}

function whatsappMessageId(result) {
  return result?.data?.messages?.[0]?.id || result?.messages?.[0]?.id || null;
}

// Meta's own status vocabulary, used verbatim in receipts.wa_status so the
// receipts list can render the exact state Meta is reporting without inventing
// a translation. `accepted` is ours: it means "Meta took the request", which is
// the last thing we can honestly claim at send time.
const WA_STATUS_RANK = { accepted: 1, sent: 2, delivered: 3, read: 4, failed: 0 };

// Stamps the delivery verdict onto the receipt row itself.
//
// This exists because recordReceiptInConversation() can only write a `messages`
// row when the donor already has a WhatsApp conversation with the NGO. A
// receipt sent to a first-time donor therefore has nowhere to record Meta's
// later failure, which is precisely how five sends died with the UI showing
// green. The receipt row is always there.
//
// Status updates are monotonic apart from `failed`: Meta can re-deliver after a
// transient failure, and an accepted/sent frame arriving out of order after a
// delivered one must not walk the state backwards. `failed` and a success frame
// are both allowed to win over whatever came before.
async function recordReceiptDelivery({ receiptId, receiptNo, project, wamid, status, failureReason }) {
  if (!receiptId && !(receiptNo && project)) return null;

  let patch = {
    wa_status: status,
    wa_status_at: new Date().toISOString(),
  };
  if (wamid) patch.wa_message_id = wamid;
  patch.wa_failure_reason = failureReason || null;
  // A failed send must not leave the receipt looking completed. Clearing the
  // sent flag is what puts it back in the pending queue for another attempt.
  if (status === 'failed') { patch.sent = false; patch.sent_at = null; }

  try {
    let targetId = receiptId || null;
    if (targetId) {
      await db.from('receipts').update(patch).eq('id', targetId);
    } else {
      const { data: match } = await db
        .from('receipts')
        .select('id, wa_status')
        .eq('receipt_no', receiptNo)
        .eq('project_id', project)
        .is('voided_at', null)
        .order('created_at', { ascending: false })
        .limit(1);
      const row = match?.[0];
      if (!row) return null;
      const incoming = WA_STATUS_RANK[status] ?? 1;
      const current = WA_STATUS_RANK[row.wa_status] ?? 0;
      if (status !== 'failed' && current > incoming) return row.id;
      targetId = row.id;
      await db.from('receipts').update(patch).eq('id', targetId);
    }
    return targetId;
  } catch (e) {
    // Delivery bookkeeping must never turn a successful send into a 500. The
    // wamid still lands in the conversation record and in the Meta logs.
    console.error('Failed to record receipt delivery status:', e.message);
    return null;
  }
}

// Serves a receipt PDF to Meta, out of the private receipts bucket.
//
// Unauthenticated by necessity: Meta fetches the header document with a plain
// GET and cannot present a session token. The HMAC in the URL is the entire
// authorisation, which is why it is checked before any storage call and why an
// expired or tampered token returns 404 rather than a distinguishable error --
// this endpoint must not become an oracle for probing which receipt keys exist.
export async function serveReceiptFile(req, res) {
  let claim;
  try {
    claim = verifyReceiptFile(req.params.token);
  } catch (err) {
    console.warn(`[receipt-file] rejected: ${err.message}`);
    return res.status(404).json({ message: 'Not found' });
  }

  const { data, error } = await db
    .storage.from(claim.account, 'receipts')
    .readStream(claim.key);

  if (error || !data?.body) {
    const missing = /NoSuchKey|NotFound/i.test(String(error?.code || error?.message || ''));
    console.error(`[receipt-file] storage read failed for ${claim.key}: ${error?.code || error?.message}`);
    return res.status(missing ? 404 : 502).json({ message: missing ? 'Not found' : 'Receipt file could not be read' });
  }

  const filename = claim.key.split('/').pop() || 'receipt.pdf';
  res.setHeader('Content-Type', data.contentType || 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename.replace(/["\\]/g, '')}"`);
  if (Number.isFinite(data.contentLength)) res.setHeader('Content-Length', String(data.contentLength));
  // Signed, expiring, donor-specific: nothing here may be cached by a proxy.
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const body = data.body;
  if (typeof body.pipe === 'function') {
    body.on('error', (e) => { console.error(`[receipt-file] stream failed: ${e.message}`); res.destroy(); });
    return body.pipe(res);
  }
  return res.send(Buffer.from(await body.transformToByteArray()));
}

// Accounts sends by phone number, whereas the FRO inbox reads the messages
// table by conversation. Record the successful receipt delivery against the
// donor's existing conversation so both teams see the same history.
async function recordReceiptInConversation({ phone, project, receiptNo, documentUrl, displayName, sentBy, result }) {
  try {
    const variants = phoneVariants(phone);
    if (!variants.length) return null;

    const { data: contacts, error: contactError } = await db
      .from('contacts')
      .select('id')
      .in('phone_normalized', variants);
    if (contactError || !contacts?.length) return null;

    let conversationQuery = db
      .from('conversations')
      .select('id, tenant_id, contact_id')
      .in('contact_id', contacts.map(contact => contact.id))
      .order('last_message_at', { ascending: false })
      .limit(1);
    if (project) conversationQuery = conversationQuery.eq('project', project);

    let { data: conversation, error: conversationError } = await conversationQuery.maybeSingle();
    // Older conversations may not have a project stored. Fall back to the
    // donor's latest conversation rather than hiding the receipt from the FRO.
    if (!conversation && !conversationError) {
      ({ data: conversation, error: conversationError } = await db
        .from('conversations')
        .select('id, tenant_id, contact_id')
        .in('contact_id', contacts.map(contact => contact.id))
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle());
    }
    if (conversationError || !conversation) return null;

    const { data: message, error: messageError } = await db
      .from('messages')
      .insert({
        tenant_id: conversation.tenant_id,
        conversation_id: conversation.id,
        contact_id: conversation.contact_id,
        user_id: sentBy ? String(sentBy) : null,
        direction: 'outbound',
        message_type: 'document',
        body_text: displayName || `Receipt_${receiptNo || 'receipt'}.pdf`,
        media_url: documentUrl,
        media_mime_type: 'application/pdf',
        wa_message_id: whatsappMessageId(result),
        status: 'sent',
        status_updated_at: new Date().toISOString(),
        message_category: 'template',
      })
      .select()
      .single();
    if (messageError) throw messageError;

    await db
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversation.id);
    return message;
  } catch (error) {
    // The donor has already received the receipt. Do not report that delivery
    // as failed solely because an older chat record could not be linked.
    console.error('Could not record receipt in WhatsApp conversation:', error.message);
    return null;
  }
}

export async function test(req, res) {
  try {
    const { to, accountId } = req.body;
    if (!to) return res.status(400).json({ message: 'Phone number is required' });

    let account = null;
    if (accountId) {
      account = await getAccountById(accountId);
      if (!account) return res.status(404).json({ message: 'Account not found' });
    }

    const result = await sendTextMessage(to, 'WhatsApp API is working! - UFS CRM', account);
    return res.json({ success: true, message: 'Test message sent', data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function sendReceipt(req, res) {
  try {
    const { logId } = req.params;
    const { mobile, number, pdfBase64, receiptNo: clientReceiptNo, donorName: clientDonorName, amount: clientAmount, templateName, project } = req.body;
    const phone = mobile || number;

    if (!phone) return res.status(400).json({ message: 'Donor phone number is required' });

    let donorName = clientDonorName || 'Donor';
    let amount = clientAmount || 0;
    let receiptNo = clientReceiptNo || 'N/A';
    let documentId = null;
    let uploadErrorMsg = null;
    let donorProject = project;
    let receiptId = null;

    if (logId && logId !== '0') {
      const { data: receiptRow } = await db
        .from('receipts')
        .select('id, receipt_no')
        .eq('log_id', logId)
        .maybeSingle();

      if (receiptRow) {
        receiptId = receiptRow.id;
        if (!clientReceiptNo) receiptNo = receiptRow.receipt_no || 'N/A';
      }

      if (!clientDonorName || !clientAmount || !donorProject || !receiptRow) {
        const { data: logs, error: logError } = await db
          .from('fro_donor_logs')
          .select(`
            amount_collected,
            fro_assignments(
              donor_id,
              donor_profiles(id, name, mobile_number, project_supported)
            )
          `)
          .eq('id', logId)
          .limit(1);

        const log = logs?.[0] || null;
        if (!logError && log) {
          const assignment = Array.isArray(log.fro_assignments) ? log.fro_assignments[0] : log.fro_assignments;
          const donor = Array.isArray(assignment?.donor_profiles) ? assignment?.donor_profiles[0] : assignment?.donor_profiles;
          if (!clientDonorName) donorName = donor?.name || 'Donor';
          if (!clientAmount) amount = log.amount_collected || 0;
          if (!donorProject) donorProject = donor?.project_supported || 'bsct';
        }
      }

    }

    const account = await resolveAccount(donorProject);
    if (!account) return res.status(400).json({ message: `No WhatsApp account configured for project "${donorProject}"` });

    const safeDonorName = String(donorName || 'Donor').replace(/[<>:"/\\|?*]/g, '_').trim();
    const displayName = `Receipt_${safeDonorName}_${receiptNo || 'receipt'}.pdf`;

    // Upload the PDF generated in this request straight to Meta as temporary
    // media and reference it by id. Nothing is written to our own storage, so
    // a suspended AWS account can no longer block receipts.
    if (pdfBase64) {
      try {
        const buffer = Buffer.from(pdfBase64, 'base64');
        documentId = await uploadDocumentBufferToMeta(account, buffer, displayName);
      } catch (e) {
        uploadErrorMsg = e.message;
        console.error('Receipt PDF upload to WhatsApp failed:', e.message);
      }
    } else {
      uploadErrorMsg = 'no receipt PDF was supplied';
    }

    if (!documentId) {
      return res.status(400).json({
        message: `Receipt PDF is required but could not be uploaded to WhatsApp: ${uploadErrorMsg}`,
      });
    }

    const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const result = await sendReceiptMessage(phone, donorName, amount, receiptNo, date, null, templateName, account, documentId);
    await recordReceiptDelivery({
      receiptId, receiptNo, project: donorProject,
      wamid: whatsappMessageId(result), status: 'accepted',
    });
    const message = await recordReceiptInConversation({
      // Meta media ids are temporary by design — do not persist a URL.
      phone, project: donorProject, receiptNo, documentUrl: null, displayName, sentBy: req.user?.id, result,
    });

    return res.json({ success: true, message: 'Receipt sent via WhatsApp template', data: result, chatMessage: message, uploadError: uploadErrorMsg });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function sendNgoInfo(req, res) {
  try {
    const { to, name, project } = req.body;
    if (!to) return res.status(400).json({ message: 'Phone number is required' });

    const account = await resolveAccount(project);
    const result = await sendNgoInfoTemplate(to, name || 'Donor', account);
    return res.json({ success: true, message: 'NGO info sent', data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function sendCustomTemplate(req, res) {
  try {
    const { to, templateName, parameters, project } = req.body;
    if (!to || !templateName || !parameters) {
      return res.status(400).json({ message: 'to, templateName, and parameters are required' });
    }

    const account = await resolveAccount(project);
    const result = await sendTemplateMessage(to, templateName, parameters, undefined, account);
    return res.json({ success: true, message: 'Template message sent', data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function status(req, res) {
  try {
    const { accountId } = req.query;

    if (accountId) {
      const account = await getAccountById(accountId);
      if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
      const result = await testConnection(account);
      return res.json({ ...result, account: account.name, accountId: account.id });
    }

    const accounts = await getActiveAccounts();
    if (accounts.length > 0) {
      const results = await Promise.allSettled(
        accounts.map(async (acc) => {
          const r = await testConnection(acc);
          return { account: acc.name, accountId: acc.id, project: acc.project, ...r };
        })
      );
      return res.json(results.map(r => r.status === 'fulfilled' ? r.value : { success: false, message: r.reason?.message || 'Unknown error' }));
    }

    const result = await testConnection();
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function sendDirect(req, res) {
  console.log("req", req)
  try {
    const {
      to,
      receiptNo,
      donorName,
      amount,
      templateName,
      templateLang,
      pdfBase64,
      project,
      receiptId,
    } = req.body;

    if (!to) {
      return res.status(400).json({
        message: 'Phone number is required',
      });
    }

    const phone = normalizePhone(to);
    const tpl = templateName || 'bsct_receipt_2';
    const lang = templateLang || 'en';
    const donorProject = project || TEMPLATE_PROJECT_MAP[tpl] || 'bsct';
    const account = await resolveAccount(donorProject);

    if (!account) {
      return res.status(400).json({
        message: `No WhatsApp account configured for project "${donorProject}"`,
      });
    }

    const ngoMap = {
      bsct_receipt_2: 'BeingSevak',
      mann_receipt: 'MannCare',
      aflf_receipt: 'Ashray',
      ashray_receipt: 'Ashray',
    };

    const ngoPrefix = ngoMap[tpl] || 'Receipt';

    let documentId = null;
    let displayName = null;
    let uploadError = null;

    // ---------------------------------------------------------
    // 1. SEND RECEIPT PDF STRAIGHT TO WHATSAPP
    //
    // The PDF is uploaded to Meta's /media endpoint and referenced by media
    // id. Nothing is written to our own storage — AWS access is suspended and
    // a temporary file on Meta is enough for delivery (Meta expires it on its
    // own). This also removes the old presigned-URL preflight step.
    // ---------------------------------------------------------

    if (pdfBase64) {
      try {
        const buffer = Buffer.from(pdfBase64, 'base64');

        const safeName = String(donorName || 'Donor')
          .replace(/[<>:"/\\|?*]/g, '_')
          .trim();

        displayName = `${ngoPrefix}_${safeName}_${receiptNo || 'receipt'}.pdf`;
        documentId = await uploadDocumentBufferToMeta(account, buffer, displayName);
      } catch (e) {
        uploadError = e.message;
      }

      if (uploadError) {
        console.error(
          'Failed to upload receipt PDF to WhatsApp:',
          uploadError
        );
      }
    } else {
      uploadError = 'no receipt PDF was supplied';
    }

    // ---------------------------------------------------------
    // 2. PDF IS REQUIRED
    // ---------------------------------------------------------

    if (!documentId) {
      return res.status(400).json({
        message:
          `Receipt PDF is required by template "${tpl}" but could not be uploaded to WhatsApp: ${uploadError}`,
      });
    }

    // ---------------------------------------------------------
    // 3. WHATSAPP TEMPLATE COMPONENTS
    // ---------------------------------------------------------

    const components = [
      {
        type: 'header',
        parameters: [
          {
            type: 'document',
            document: {
              id: documentId,
              filename:
                displayName || 'receipt.pdf',
            },
          },
        ],
      },
    ];

    // ---------------------------------------------------------
    // 5. BODY PARAMETER
    //
    // mann_receipt currently expects ONLY {{1}}
    //
    // {{1}} = donorName
    // ---------------------------------------------------------

    if (tpl === 'mann_receipt') {
      components.push({
        type: 'body',
        parameters: [
          {
            type: 'text',
            text: String(donorName || 'Donor'),
          },
        ],
      });
    }

    // ---------------------------------------------------------
    // 6. META WHATSAPP API URL
    // ---------------------------------------------------------

    const apiBase =
      `https://graph.facebook.com/${whatsappConfig.apiVersion}/${account.phone_number_id}/messages`;

    // ---------------------------------------------------------
    // 7. SEND MESSAGE TO WHATSAPP
    // ---------------------------------------------------------

    const msgRes = await fetch(apiBase, {
      method: 'POST',

      headers: {
        Authorization:
          `Bearer ${account.access_token}`,
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        messaging_product: 'whatsapp',

        to: phone,

        type: 'template',

        template: {
          name: tpl,

          language: {
            code: lang,
          },

          components,
        },
      }),
    });

    // ---------------------------------------------------------
    // 8. READ META RESPONSE
    // ---------------------------------------------------------

    const msgText = await msgRes.text();

    if (!msgRes.ok) {
      console.error(
        'WhatsApp Meta API Error:',
        msgText
      );

      return res.status(400).json({
        success: false,
        message: msgText,
      });
    }

    const result = JSON.parse(msgText);

    // ---------------------------------------------------------
    // 9. SAVE WHATSAPP DELIVERY STATUS
    // ---------------------------------------------------------

    await recordReceiptDelivery({
      receiptId,
      receiptNo,
      project: donorProject,

      wamid: whatsappMessageId(result),

      status: 'accepted',
    });

    // ---------------------------------------------------------
    // 10. RECORD MESSAGE IN CONVERSATION
    // ---------------------------------------------------------

    const message =
      await recordReceiptInConversation({
        phone,

        project: donorProject,

        receiptNo,

        // Deliberately null: the PDF lives only on Meta as a temporary media
        // object, so there is no stored URL to persist or re-sign later.
        documentUrl: null,

        displayName,

        sentBy: req.user?.id,

        result,
      });

    // ---------------------------------------------------------
    // 11. SUCCESS RESPONSE
    // ---------------------------------------------------------

    return res.json({
      success: true,

      message:
        'Receipt sent via WhatsApp template',

      data: result,

      chatMessage: message,
    });

  } catch (error) {
    console.error(
      'sendDirect error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}
export async function listTemplates(req, res) {
  try {
    const { accountId } = req.query;

    if (accountId) {
      const account = await getAccountById(accountId);
      if (!account) return res.status(404).json({ message: 'Account not found' });
      const templates = await listTemplatesForAccount(account);
      return res.json(templates);
    }

    if (!whatsappConfig.enabled) {
      return res.json([]);
    }

    const wabaId = whatsappConfig.wabaId || '2529840587470683';
    const tplRes = await fetch(
      `https://graph.facebook.com/${whatsappConfig.apiVersion}/${wabaId}/message_templates?fields=name,language,status,components`,
      { headers: { Authorization: `Bearer ${whatsappConfig.accessToken}` } }
    );
    if (!tplRes.ok) { const e = await tplRes.text(); return res.status(400).json({ message: 'Meta API: ' + e }); }

    const { data } = await tplRes.json();
    const templates = (data || []).filter(t => t.status === 'APPROVED').map(t => ({
      name: t.name,
      language: t.language,
      components: t.components || [],
    }));
    return res.json(templates);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getAccountHealth(req, res) {
  try {
    const account = await getAccountById(req.params.accountId);
    if (!account) return res.status(404).json({ message: 'Account not found' });

    let meta = {};
    try {
      const r = await fetch(`https://graph.facebook.com/v18.0/${account.phone_number_id}?fields=quality_rating,verified_name,display_phone_number`, {
        headers: { Authorization: `Bearer ${account.access_token}` },
      });
      meta = await r.json();
    } catch (e) {
      meta = { error: e.message };
    }

    const { data: usage } = await db
      .from('whatsapp_bulk_recipients')
      .select('status')
      .eq('account_id', String(account.id));

    const sentToday = (usage || []).filter(x => x.status === 'sent' || x.status === 'delivered' || x.status === 'read').length;
    const failedToday = (usage || []).filter(x => x.status === 'failed').length;

    return res.json({
      account: { id: account.id, name: account.name, project: account.project },
      quality: meta.quality_rating || 'N/A',
      verifiedName: meta.verified_name || account.name,
      displayPhone: meta.display_phone_number || null,
      usage: { sent: sentToday, failed: failedToday, total: (usage || []).length },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getConversationByPhone(req, res) {
  try {
    const phone = normalizePhone(req.params.phone);
    const accountId = req.query.accountId ? String(req.query.accountId) : null;
    if (!phone) return res.status(400).json({ message: 'phone required' });
    const variants = phoneVariants(phone);
    // One person can be stored twice (10-digit and 91-prefixed contact rows).
    // Match every spelling and merge all their conversations into this thread
    // so a message sent from CRM and the donor's reply cannot land on two
    // separate chats.
    const contactOr = [
      ...variants.map((v) => `phone_normalized.eq.${v}`),
      ...variants.map((v) => `phone.eq.${v}`),
    ].join(',');
    const { data: contacts } = await db.from('contacts').select('id').or(contactOr).limit(20);
    const contactIds = (contacts || []).map((c) => c.id);
    const contactId = contactIds[0] || null;
    // resolve account -> project for template preference
    let accountProject = null;
    let threadAccount = null;
    if (accountId) {
      threadAccount = await getAccountById(accountId);
      accountProject = threadAccount?.project || null;
    }
    let convIds = [];
    const convProjectMap = {};
    if (contactIds.length) {
      const { data: convs } = await db.from('conversations').select('id,project,whatsapp_account_id').in('contact_id', contactIds).order('last_message_at', { ascending: false }).limit(50);
      if (convs) {
        for (const c of convs) {
          // Account-wise thread: only conversations that belong to the selected
          // account (direct account id, or the project fallback used by older
          // rows whose account id was never stored). The list now emits one row
          // per (phone, account), so a reply that landed on another number has
          // its own row instead of being hidden inside this one.
          if (accountId) {
            const matches = (c.whatsapp_account_id && String(c.whatsapp_account_id) === accountId)
              || (!c.whatsapp_account_id && Boolean(accountProject) && c.project === accountProject)
              || (!c.whatsapp_account_id && !c.project && !accountProject);
            if (!matches) continue;
          }
          convIds.push(c.id);
          convProjectMap[c.id] = c.project || '';
        }
      }
    }
    let messages = [];
    if (convIds.length) {
      const { data: msgs } = await db.from('messages').select('id,direction,body_text,message_type,status,failure_reason,created_at,wa_message_id,media_url,media_mime_type,conversation_id').in('conversation_id', convIds).order('created_at', { ascending: true }).limit(200);
      messages = (msgs || []).map(m => ({ ...m, project: convProjectMap[m.conversation_id] || '' }));
    }
    // Also include bulk-sent template messages (stored in whatsapp_bulk_recipients)
    let bulkQ = db.from('whatsapp_bulk_recipients').select('id,template_name,phone,status,failure_reason,created_at,wa_message_id,status_updated_at,account_id,body_text,header_format,header_url,template_buttons').in('phone', variants);
    if (accountId) bulkQ = bulkQ.eq('account_id', accountId);
    const { data: bulk } = await bulkQ.order('created_at', { ascending: true }).limit(200);
    // Pre-fetch template bodies for display
    const tplNames = [...new Set((bulk || []).map(b => b.template_name).filter(Boolean))];
    const tplMap = {};
    if (tplNames.length) {
      // Prefer the same project as the account, but still fall back to the
      // global cache so a template from another project cannot blank the thread.
      let tpls = [];
      if (accountProject) {
        const { data } = await db
          .from('whatsapp_templates')
          .select('name,language,components,project')
          .in('name', tplNames)
          .eq('project', accountProject);
        tpls = data || [];
      }
      if (!tpls.length) {
        const { data } = await db
          .from('whatsapp_templates')
          .select('name,language,components,project')
          .in('name', tplNames);
        tpls = data || [];
      }
      for (const t of tpls) {
        const bodyComp = (t.components || []).find(c => String(c.type || '').toUpperCase() === 'BODY');
        const headerComp = (t.components || []).find(c => String(c.type || '').toUpperCase() === 'HEADER');
        const buttonsComp = (t.components || []).find(c => String(c.type || '').toUpperCase() === 'BUTTONS');
        if (!tplMap[t.name] || !tplMap[t.name].body) {
          tplMap[t.name] = {
            body: bodyComp ? (bodyComp.text || '') : '',
            header: headerComp || null,
            buttons: buttonsComp ? (buttonsComp.buttons || []) : [],
            project: t.project || null,
            language: t.language || null,
          };
        }
      }
    }

    // Some older bulk rows reference templates that were never synced into
    // whatsapp_templates (or were deleted locally). Ask Meta once for those so
    // the thread shows the real body and header instead of a blank bubble.
    if (threadAccount && tplNames.length) {
      await Promise.all(tplNames.map(async (name) => {
        const info = tplMap[name];
        if (info?.body) return;
        try {
          const liveComponents = await resolveTemplateComponentsForSend(
            threadAccount,
            name,
            info?.language || threadAccount.template_language || 'en',
            { forceMeta: true },
          );
          const bodyComp = templateComponentOf(liveComponents, 'BODY');
          const headerComp = templateComponentOf(liveComponents, 'HEADER');
          const buttonsComp = templateComponentOf(liveComponents, 'BUTTONS');
          if (bodyComp || headerComp) {
            tplMap[name] = {
              body: bodyComp?.text || info?.body || '',
              header: headerComp || info?.header || null,
              buttons: buttonsComp?.buttons || info?.buttons || [],
              project: info?.project || threadAccount.project || null,
              language: info?.language || threadAccount.template_language || null,
            };
          }
        } catch { /* fall back to the template-name chip */ }
      }));
    }

    // Meta's template header sample URL expires, so resolve each template's
    // header to our own cached copy once and let the signing pass below hand
    // the browser a fresh URL. When the DB copy is missing/stale, ask Meta for
    // the template once (cached in-process) and cache its header.
    const headerAssetByName = {};
    if (tplNames.length) {
      await Promise.all(tplNames.map(async (name) => {
        const info = tplMap[name];
        let asset = await resolveTemplateHeaderAsset({
          project: info?.project || accountProject || null,
          templateName: name,
          headerComponent: info?.header || null,
        });
        if (!asset && threadAccount) {
          try {
            const liveComponents = await resolveTemplateComponentsForSend(
              threadAccount,
              name,
              info?.language || threadAccount.template_language || 'en',
              { forceMeta: true },
            );
            const liveHeader = templateComponentOf(liveComponents, 'HEADER');
            if (liveHeader) {
              asset = await resolveTemplateHeaderAsset({
                project: threadAccount.project || accountProject || null,
                templateName: name,
                headerComponent: liveHeader,
              });
            }
          } catch { /* header stays unresolved; text still renders */ }
        }
        if (asset) headerAssetByName[name] = asset;
      }));
    }

    if (bulk && bulk.length) {
      for (const b of bulk) {
        const tpl = tplMap[b.template_name] || {};
        // What was actually sent wins over the template cache. Older rows have
        // no snapshot, so fall back to the cached body and finally a label.
        const body = (b.body_text || '').trim() || tpl.body || `[Template: ${b.template_name}]`;
        const asset = headerAssetByName[b.template_name] || null;
        const messageHeaderFormat = b.header_format || tpl.header?.format || null;
        const messageHeaderUrl = asset?.storedUrl || b.header_url || null;
        const templateHeader = messageHeaderFormat
          ? {
            format: messageHeaderFormat,
            example: messageHeaderUrl ? { header_handle: [messageHeaderUrl] } : undefined,
          }
          : (tpl.header || null);
        const storedButtons = Array.isArray(b.template_buttons) ? b.template_buttons : null;
        messages.push({
          id: b.id,
          direction: 'outbound',
          body_text: body,
          message_type: 'template',
          status: b.status || 'accepted',
          failure_reason: b.failure_reason || null,
          created_at: b.created_at,
          wa_message_id: b.wa_message_id,
          template_name: b.template_name,
          template_header: templateHeader,
          template_buttons: storedButtons || tpl.buttons || [],
        });
      }
    }
    // Resolve stored media for the browser: a signed S3 URL in S3 mode, a local
    // /api/media URL in local mode. Anything that is not our storage (Supabase,
    // an external link) is passed through untouched.
    await Promise.all(messages.map(async (m) => {
      if (m.media_url) {
        m.media_url = await presignStoredUrl(m.media_url);
      }
      // Template header lives in the private whatsapp-media bucket; sign it so
      // the browser can render the image. Cached asset URLs take this path too.
      const handles = m.template_header?.example?.header_handle;
      if (Array.isArray(handles) && handles[0]) {
        handles[0] = await presignStoredUrl(handles[0], { prefix: 'whatsapp-media/' });
      }
    }));
    messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return res.json({ phone, contactId, conversationId: convIds[0] || null, messages });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function validateWhatsAppContacts(req, res) {
  try {
    const { accountId, phones } = req.body || {};
    const account = await getAccountById(accountId);
    if (!account) return res.status(404).json({ message: 'Account not found' });

    const list = Array.isArray(phones) ? phones : [];
    if (!list.length) return res.json({ valid: [], invalid: [] });

    const r = await fetch(`https://graph.facebook.com/v18.0/${account.phone_number_id}/contacts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        blocking: 'wait',
        contacts: list,
        force_check: true,
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      // Meta may reject the contacts-check operation for this number/token
      // (e.g. missing permission, on-premises number, restricted WABA).
      // Don't fail the whole request — fall back to "unknown" so the UI keeps working.
      console.warn('[validateWhatsAppContacts] Meta rejected contacts check:', data?.error?.message);
      // Meta contacts-check unavailable for this number/token. Don't mark everyone invalid —
      // keep all recipients as valid so bulk send still works; Meta will reject bad numbers at send time.
      return res.json({ valid: list, invalid: [], unknown: list, raw: [], validationUnavailable: true, metaError: data?.error?.message || 'Meta contact check failed' });
    }

    const valid = [];
    const invalid = [];
    for (const c of data.contacts || []) {
      if (c.status === 'valid') valid.push(c.input || c.wa_id);
      else invalid.push(c.input || c.input);
    }
    return res.json({ valid, invalid, raw: data.contacts || [] });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

const BULK_STATUS_KEYS = ['accepted', 'sent', 'delivered', 'read', 'failed'];

export async function listBulkRecipientStatuses(req, res) {
  try {
    const accountId = req.query.accountId ? String(req.query.accountId) : null;
    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);

    // Summary mode powers "Delivery Insights": one exact count per status for
    // the selected WhatsApp account, independent of the 100-row list window.
    if (String(req.query.summary || '') === '1') {
      const entries = await Promise.all(BULK_STATUS_KEYS.map(async (status) => {
        let query = db
          .from('whatsapp_bulk_recipients')
          .select('*', { count: 'exact', head: true })
          .ilike('status', status);
        if (accountId) query = query.eq('account_id', accountId);
        const { count, error } = await query;
        if (error) throw error;
        return [status, count || 0];
      }));
      return res.json({ accountId: accountId || 'all', counts: Object.fromEntries(entries) });
    }

    let query = db
      .from('whatsapp_bulk_recipients')
      .select('wa_message_id, account_id, phone, recipient_name, template_name, status, failure_reason, status_updated_at, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (accountId) query = query.eq('account_id', accountId);
    const { data, error } = await query;
    if (error) throw error;
    return res.json(data || []);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function createCampaign(req, res) {
  try {
    const body = req.body || {};
    const { name, accountId, templateName } = body;

    // A body with recipients starts a real background campaign: the queue is
    // stored first and the browser no longer owns the send loop. Refreshing
    // or leaving the page therefore cannot stop the campaign.
    if (Array.isArray(body.recipients) && body.recipients.length) {
      const campaign = await createWhatsAppCampaign({
        name,
        accountId,
        templateName,
        templateLang: body.templateLang,
        headerImageUrl: body.headerImageUrl,
        headerFormat: body.headerFormat,
        parameterNames: body.parameterNames,
        recipients: body.recipients,
        createdBy: req.user?.name || req.user?.email || req.user?.login_id || null,
      });
      runWhatsAppCampaign(campaign.id).catch((error) => {
        console.error(`WhatsApp campaign ${campaign.id} failed:`, error?.message || error);
      });
      return res.status(202).json(campaign);
    }

    const { data, error } = await db.from('campaigns').insert({
      name: name || `Bulk Campaign ${new Date().toISOString().slice(0, 10)}`,
      channel: 'whatsapp',
      status: 'sending',
      account_id: accountId ? String(accountId) : null,
      template_name: templateName || null,
      started_at: new Date().toISOString(),
    }).select().single();
    if (error) throw error;
    return res.status(201).json(data);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

export async function listCampaigns(req, res) {
  try {
    let query = db
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (String(req.query.active || '') === '1') {
      query = query
        .eq('channel', 'whatsapp')
        .in('status', ['queued', 'processing', 'interrupted']);
    }
    const { data, error } = await query;
    if (error) throw error;
    const campaigns = data || [];
    // attach recipient counts
    await Promise.all(campaigns.map(async (c) => {
      try {
        const { count } = await db
          .from('whatsapp_bulk_recipients')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', c.id);
        c.recipient_count = count || 0;
      } catch {
        c.recipient_count = 0;
      }
    }));
    return res.json(campaigns);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getCampaign(req, res) {
  try {
    const { data: campaign, error } = await db
      .from('campaigns')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    const { data: recipients } = await db
      .from('whatsapp_bulk_recipients')
      .select('*')
      .eq('campaign_id', req.params.id);

    return res.json({ campaign, recipients: recipients || [] });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getCampaignProgress(req, res) {
  try {
    const data = await getWhatsAppCampaignProgress(req.params.id);
    if (!data) return res.status(404).json({ message: 'Campaign not found' });
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function cancelCampaign(req, res) {
  try {
    const cancelled = await cancelWhatsAppCampaign(req.params.id);
    if (cancelled) return res.json({ message: 'Campaign cancelled', status: 'cancelled' });
    const row = await getWhatsAppCampaignRow(req.params.id);
    if (!row) return res.status(404).json({ message: 'Campaign not found' });
    return res.status(409).json({ message: 'Campaign is not active', status: row.status });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function resumeCampaign(req, res) {
  try {
    const result = await resumeWhatsAppCampaign(req.params.id);
    if (result.notFound) return res.status(404).json({ message: 'Campaign not found' });
    if (result.alreadyProcessing) return res.status(409).json({ message: 'This campaign is already sending.' });
    if (result.noQueue) return res.status(400).json({ message: 'Campaign has no queued recipients' });
    return res.status(202).json({ id: req.params.id, status: 'processing' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function sendBulkTemplate(req, res) {
  try {
    const { accountId, to, templateName, templateLang, parameters, parameterNames, headerImageUrl, headerFormat, recipientName, campaignId } = req.body || {};
    const result = await sendBulkTemplateToRecipient({
      accountId,
      to,
      templateName,
      templateLang,
      parameters,
      parameterNames,
      headerImageUrl,
      headerFormat,
      recipientName,
      campaignId,
    });
    return res.json({
      success: true,
      status: 'accepted',
      messageId: result.messageId,
      result: result.result,
    });
  } catch (error) {
    console.error('[whatsapp] send-bulk-template failed:', {
      templateName: req.body?.templateName,
      accountId: req.body?.accountId,
      error: error?.message || error,
    });
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}
export async function listChats(req, res) {
  try {
    const accountId = req.query.accountId ? String(req.query.accountId) : null;
    let accountProject = null;
    if (accountId) {
      const { data: acc } = await db.from('whatsapp_accounts').select('project,name').eq('id', accountId).limit(1);
      if (acc && acc[0]) accountProject = acc[0].project || null;
    }
    const byThread = new Map();
    const upsert = (threadKey, candidate) => {
      const cur = byThread.get(threadKey);
      const mergedName = candidate.recipientName || (cur && cur.recipientName) || '';
      if (!cur || new Date(candidate.lastAt) > new Date(cur.lastAt)) {
        byThread.set(threadKey, { ...cur, ...candidate, recipientName: mergedName, threadKey });
      } else if (mergedName && !(cur && cur.recipientName)) {
        byThread.set(threadKey, { ...cur, recipientName: mergedName, threadKey });
      }
    };
    // Bulk sends first: these phones define threads even when their
    // conversation rows are older than the latest-500 window below. This is
    // what makes replies visible for a blast sent today to a donor whose
    // conversation history predates the window.
    let bulkQ = db.from('whatsapp_bulk_recipients')
      .select('phone,account_id,template_name,status,created_at,body_text,recipient_name')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (accountId) bulkQ = bulkQ.eq('account_id', accountId);
    const { data: bulk } = await bulkQ;
    const bulkPhones = [...new Set(
      (bulk || [])
        .map((b) => normalizePhone(b.phone))
        .filter(Boolean),
    )];
    const bulkContactVariants = new Set();
    for (const p of bulkPhones) for (const v of phoneVariants(p)) bulkContactVariants.add(v);

    const [recentConvsResult, bulkContactsResult] = await Promise.all([
      db.from('conversations')
        .select('id,project,whatsapp_account_id,contact_id,last_message_at,unread_count')
        .order('last_message_at', { ascending: false })
        .limit(500),
      bulkPhones.length
        ? db.from('contacts').select('id').in('phone_normalized', [...bulkContactVariants])
        : Promise.resolve({ data: [] }),
    ]);
    const bulkContactIds = (bulkContactsResult.data || []).map((c) => c.id);
    const bulkConvsResult = bulkContactIds.length
      ? await db.from('conversations')
        .select('id,project,whatsapp_account_id,contact_id,last_message_at,unread_count')
        .in('contact_id', bulkContactIds)
        .limit(2000)
      : { data: [] };

    const convById = new Map();
    for (const c of [...(recentConvsResult.data || []), ...(bulkConvsResult.data || [])]) {
      convById.set(c.id, c);
    }
    const convs = [...convById.values()];
    const contactIds = [...new Set((convs || []).map(c => c.contact_id).filter(Boolean))];
    const contactMap = {};
    if (contactIds.length) {
      const { data: contacts } = await db.from('contacts').select('id,phone,phone_normalized,wa_profile_name').in('id', contactIds);
      for (const c of contacts || []) contactMap[c.id] = c;
    }
    const accountIds = [...new Set((convs || []).map(c => c.whatsapp_account_id).filter(Boolean))];
    const accountMap = {};
    if (accountIds.length) {
      const { data: accs } = await db.from('whatsapp_accounts').select('id,name,project').in('id', accountIds);
      for (const a of accs || []) accountMap[a.id] = a;
    }
    // Inbound conversations created before whatsapp_account_id was persisted
    // have no account link. Fall back to the project's account so the thread
    // still names the right number and replies go out from it.
    const projectAccountMap = {};
    try {
      const { data: allAccs } = await db.from('whatsapp_accounts').select('id,name,project,is_default,is_active');
      for (const a of allAccs || []) {
        const key = String(a.project || '').toLowerCase();
        if (!key) continue;
        const current = projectAccountMap[key];
        if (!current || (a.is_default && !current.is_default) || (a.is_active && !current.is_active)) {
          projectAccountMap[key] = a;
        }
      }
    } catch { /* account attribution is best effort */ }

    // One row per (phone, account), not per phone: a donor can talk to several
    // NGO numbers, and the account filter has to be a real filter. Previously
    // both numbers collapsed into one row keyed by phone, so whichever account
    // filter was active could hide the other number's replies.
    const convThreadMap = {};
    const unreadByThread = {};
    for (const c of convs || []) {
      const contact = contactMap[c.contact_id];
      const phone = normalizePhone(contact?.phone_normalized || contact?.phone || '');
      if (!phone) continue;
      const acc = (c.whatsapp_account_id ? accountMap[c.whatsapp_account_id] : null)
        || projectAccountMap[String(c.project || '').toLowerCase()]
        || null;
      const resolvedAccountId = acc?.id || c.whatsapp_account_id || null;

      if (accountId) {
        const matches = resolvedAccountId
          ? String(resolvedAccountId) === accountId
          : Boolean(accountProject && c.project === accountProject);
        if (!matches) continue;
      }

      const accountKey = resolvedAccountId || c.project || 'unknown';
      const threadKey = `${phone}::${accountKey}`;
      convThreadMap[c.id] = threadKey;
      unreadByThread[threadKey] = (unreadByThread[threadKey] || 0) + (Number(c.unread_count) || 0);
      upsert(threadKey, {
        phone,
        lastAt: c.last_message_at || new Date().toISOString(),
        lastMessage: '',
        direction: 'inbound',
        accountId: resolvedAccountId,
        accountName: acc?.name || c.project || '',
        project: c.project || '',
        recipientName: contact?.wa_profile_name || '',
      });
    }

    const bulkAccountIds = [...new Set((bulk || []).map(b => b.account_id).filter(Boolean))];
    const bulkAccountMap = {};
    if (bulkAccountIds.length) {
      const { data: accs } = await db.from('whatsapp_accounts').select('id,name,project').in('id', bulkAccountIds);
      for (const a of accs || []) bulkAccountMap[a.id] = a;
    }
    for (const b of bulk || []) {
      const phone = normalizePhone(b.phone);
      if (!phone) continue;
      const acc = b.account_id ? bulkAccountMap[b.account_id] : null;
      const threadKey = `${phone}::${b.account_id || 'unknown'}`;
      upsert(threadKey, {
        phone,
        lastAt: b.created_at,
        lastMessage: (b.body_text || '').trim() || (b.template_name ? `[Template: ${b.template_name}]` : ''),
        direction: 'outbound',
        status: b.status || 'accepted',
        accountId: b.account_id || null,
        accountName: acc?.name || '',
        project: acc?.project || '',
        recipientName: b.recipient_name || '',
      });
    }

    const convIds = Object.keys(convThreadMap);
    if (convIds.length) {
      const { data: msgs } = await db.from('messages').select('conversation_id,body_text,direction,created_at').in('conversation_id', convIds).order('created_at', { ascending: false }).limit(10000);
      const latestByThread = {};
      const lastInboundByThread = {};
      for (const m of msgs || []) {
        const key = convThreadMap[m.conversation_id];
        if (!key) continue;
        if (!latestByThread[key] || new Date(m.created_at) > new Date(latestByThread[key].created_at)) latestByThread[key] = m;
        if (m.direction === 'inbound' && (!lastInboundByThread[key] || new Date(m.created_at) > new Date(lastInboundByThread[key].created_at))) lastInboundByThread[key] = m;
      }
      for (const key of byThread.keys()) {
        const m = latestByThread[key];
        const cur = byThread.get(key);
        if (m && cur && (!cur.lastMessage || new Date(m.created_at) >= new Date(cur.lastAt))) {
          byThread.set(key, { ...cur, lastMessage: (m.body_text || '').slice(0, 80), lastAt: m.created_at, direction: m.direction || cur.direction });
        }
        const ib = lastInboundByThread[key];
        const cur2 = byThread.get(key);
        if (cur2) {
          byThread.set(key, {
            ...cur2,
            hasReply: !!ib,
            replyText: ib ? (ib.body_text || '').slice(0, 200) : '',
            lastReplyAt: ib ? ib.created_at : null,
          });
        }
      }
    }
    for (const [key, thread] of byThread) {
      byThread.set(key, { ...thread, unreadCount: unreadByThread[key] || 0 });
    }
    const sorted = [...byThread.values()].sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
    // Keep the normal recency window, but do not let it drop a thread that has
    // an inbound reply for a phone we bulk-sent to. Those are exactly the rows
    // an operator is waiting to see.
    const top = sorted.slice(0, 200);
    const topKeys = new Set(top.map((t) => t.threadKey));
    const bulkPhoneSet = new Set(bulkPhones);
    const replyExtras = sorted
      .filter((t) => !topKeys.has(t.threadKey) && t.hasReply && bulkPhoneSet.has(String(t.phone || '')))
      .slice(0, 100);
    // Re-sort after merging the extras: a reply must land at the top of the
    // list like it does in WhatsApp, even when its history is older than the
    // current recency window.
    return res.json([...top, ...replyExtras].sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt)));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
export async function markChatRead(req, res) {
  try {
    const phone = normalizePhone(req.params.phone);
    const accountId = req.query.accountId ? String(req.query.accountId) : null;
    if (!phone) return res.status(400).json({ message: 'phone required' });

    const variants = phoneVariants(phone);
    const contactOr = [
      ...variants.map((v) => `phone_normalized.eq.${v}`),
      ...variants.map((v) => `phone.eq.${v}`),
    ].join(',');
    const { data: contacts } = await db.from('contacts').select('id').or(contactOr).limit(20);
    const contactIds = (contacts || []).map((c) => c.id);
    if (!contactIds.length) return res.json({ success: true, cleared: 0 });

    const { data: convs } = await db
      .from('conversations')
      .select('id,project,whatsapp_account_id')
      .in('contact_id', contactIds);

    let accountProject = null;
    if (accountId) {
      const acc = await getAccountById(accountId);
      accountProject = acc?.project || null;
    }

    const ids = (convs || []).filter((c) => {
      if (!accountId) return true;
      return (c.whatsapp_account_id && String(c.whatsapp_account_id) === accountId)
        || (!c.whatsapp_account_id && Boolean(accountProject) && c.project === accountProject)
        || (!c.whatsapp_account_id && !c.project && !accountProject);
    }).map((c) => c.id);

    if (ids.length) {
      await db.from('conversations').update({ unread_count: 0 }).in('id', ids);
    }
    return res.json({ success: true, cleared: ids.length });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function sendText(req, res) {
  try {
    const { to, text, accountId } = req.body || {};
    if (!to || !text || !String(text).trim()) {
      return res.status(400).json({ message: 'Phone and text are required' });
    }
    const phone = normalizePhone(to);
    const account = accountId ? await getAccountById(accountId) : await resolveAccount();
    if (!account) return res.status(400).json({ message: 'No WhatsApp account configured' });
    const trimmed = String(text).trim();
    const result = await sendTextMessage(phone, trimmed, account);
    await logOutboundMessage({
      account,
      phone,
      messageType: 'text',
      bodyText: trimmed,
      waMessageId: whatsappMessageId(result),
      status: 'sent',
    });
    return res.json({ success: true, result });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function sendMedia(req, res) {
  try {
    const { to, accountId, mediaUrl, mediaType, mediaMimeType, caption } = req.body || {};
    if (!to || !mediaUrl) return res.status(400).json({ message: 'Phone and mediaUrl are required' });
    const phone = normalizePhone(to);
    const account = accountId ? await getAccountById(accountId) : await resolveAccount();
    if (!account) return res.status(400).json({ message: 'No WhatsApp account configured' });
    const result = await sendMediaMessage(phone, mediaUrl, mediaType || 'image', caption || '', account);
    await logOutboundMessage({
      account,
      phone,
      messageType: mediaType || 'image',
      bodyText: caption || `[${(mediaType || 'image').charAt(0).toUpperCase()}${(mediaType || 'image').slice(1)}]`,
      waMessageId: whatsappMessageId(result),
      mediaUrl,
      mediaMimeType: mediaMimeType || null,
      status: 'sent',
    });
    return res.json({ success: true, result });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
