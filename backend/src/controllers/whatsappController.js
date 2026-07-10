import { sendDocumentMessage, sendReceiptMessage, sendNgoInfoTemplate, sendTemplateMessage, sendTextMessage, testConnection, resolveAccount, listTemplatesForAccount } from '../services/whatsappService.js';
import whatsappConfig from '../config/whatsappConfig.js';
import { getAccountById, getActiveAccounts } from '../models/whatsappAccountModel.js';
import supabase from '../config/supabase.js';

const TEMPLATE_PROJECT_MAP = {
  bsct_receipt: 'bsct',
  mann_receipt: 'maan',
  aflf_receipt: 'aflf',
};

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
    let documentUrl = null;
    let uploadErrorMsg = null;
    let donorProject = project;

    if (logId && logId !== '0') {
      const { data: receiptRow } = await supabase
        .from('receipts')
        .select('receipt_no, pdf_url')
        .eq('log_id', logId)
        .maybeSingle();

      if (receiptRow) {
        if (!clientReceiptNo) receiptNo = receiptRow.receipt_no || 'N/A';
        documentUrl = receiptRow.pdf_url || null;
      }

      if (!clientDonorName || !clientAmount || !donorProject || !receiptRow) {
        const { data: log, error: logError } = await supabase
          .from('fro_donor_logs')
          .select(`
            amount_collected,
            fro_assignments(
              donor_id,
              donor_profiles(id, name, mobile_number, project_supported)
            )
          `)
          .eq('id', logId)
          .single();

        if (!logError && log) {
          const assignment = Array.isArray(log.fro_assignments) ? log.fro_assignments[0] : log.fro_assignments;
          const donor = Array.isArray(assignment?.donor_profiles) ? assignment?.donor_profiles[0] : assignment?.donor_profiles;
          if (!clientDonorName) donorName = donor?.name || 'Donor';
          if (!clientAmount) amount = log.amount_collected || 0;
          if (!donorProject) donorProject = donor?.project_supported || 'bsct';
        }
      }

      if (!documentUrl && pdfBase64) {
        try {
          const buffer = Buffer.from(pdfBase64, 'base64');
          const fileName = `receipts/${logId}_${Date.now()}.pdf`;
          const uploadController = new AbortController();
          const uploadTimeout = setTimeout(() => uploadController.abort(), 20000);

          let { data: uploadData, error: uploadError } = await supabase.storage
            .from('receipts')
            .upload(fileName, buffer, { contentType: 'application/pdf', upsert: true, signal: uploadController.signal });

          clearTimeout(uploadTimeout);

          if (uploadError) {
            if (uploadError.message?.includes('bucket')) {
              const { error: bucketError } = await supabase.storage.createBucket('receipts', { public: true });
              if (bucketError) throw new Error('Bucket create failed: ' + bucketError.message);
              const retry = await supabase.storage.from('receipts').upload(fileName, buffer, { contentType: 'application/pdf', upsert: true });
              if (retry.error) throw new Error('Upload failed after bucket create: ' + retry.error.message);
              uploadData = retry.data;
            } else {
              throw new Error('Upload failed: ' + uploadError.message);
            }
          }

          const { data: publicUrlData } = supabase.storage.from('receipts').getPublicUrl(fileName);
          documentUrl = publicUrlData?.publicUrl;

          if (documentUrl) {
            await supabase.from('receipts').update({ pdf_url: documentUrl }).eq('log_id', logId).maybeSingle();
          }
        } catch (e) {
          uploadErrorMsg = e.message;
          console.error('Receipt PDF upload failed:', e.message);
        }
      }
    }

    const account = await resolveAccount(donorProject);
    if (!account) return res.status(400).json({ message: `No WhatsApp account configured for project "${donorProject}"` });

    const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const result = await sendReceiptMessage(phone, donorName, amount, receiptNo, date, documentUrl, templateName, account);

    return res.json({ success: true, message: 'Receipt sent via WhatsApp template', data: result, uploadError: uploadErrorMsg });
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
  try {
    const { to, receiptNo, donorName, amount, templateName, templateLang, pdfBase64, project } = req.body;
    if (!to) return res.status(400).json({ message: 'Phone number is required' });

    const phone = String(to).replace(/[^0-9]/g, '');
    const tpl = templateName || 'bsct_receipt';
    const lang = templateLang || 'en_US';
    const donorProject = project || TEMPLATE_PROJECT_MAP[tpl] || 'bsct';

    const account = await resolveAccount(donorProject);
    if (!account) return res.status(400).json({ message: `No WhatsApp account configured for project "${donorProject}"` });

    const ngoMap = { bsct_receipt:'BeingSevak', mann_receipt:'MannCare', aflf_receipt:'Ashray' }
    const ngoPrefix = ngoMap[tpl] || 'Receipt'

    let documentUrl = null;
    let displayName = null;
    if (pdfBase64) {
      try {
        const buffer = Buffer.from(pdfBase64, 'base64');
        const safeName = String(donorName || 'Donor').replace(/[<>:"/\\|?*]/g, '_').trim()
        displayName = `${ngoPrefix}_${safeName}_${receiptNo || 'receipt'}.pdf`
        const storagePath = `receipts/${receiptNo || Date.now()}.pdf`;
        let { error: upErr } = await supabase.storage.from('receipts').upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true });
        if (upErr && upErr.message?.includes('bucket')) {
          await supabase.storage.createBucket('receipts', { public: true });
          const retry = await supabase.storage.from('receipts').upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true });
          upErr = retry.error;
        }
        if (!upErr) {
          const { data: pub } = supabase.storage.from('receipts').getPublicUrl(storagePath);
          documentUrl = pub?.publicUrl || null;
        }
      } catch (e) {
        console.error('Failed to store PDF:', e.message);
      }
    }

    const components = [];
    if (documentUrl) {
      components.push({ type: 'header', parameters: [{ type: 'document', document: { link: documentUrl, filename: displayName || 'receipt.pdf' } }] });
    }

    const apiBase = `https://graph.facebook.com/${whatsappConfig.apiVersion}/${account.phone_number_id}/messages`;
    const msgRes = await fetch(apiBase, {
      method: 'POST',
      headers: { Authorization: `Bearer ${account.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to: phone, type: 'template',
        template: { name: tpl, language: { code: lang }, components },
      }),
    });
    const msgText = await msgRes.text();
    if (!msgRes.ok) return res.status(400).json({ message: msgText });
    return res.json({ success: true, data: JSON.parse(msgText) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
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
      `https://graph.facebook.com/${whatsappConfig.apiVersion}/${wabaId}/message_templates?fields=name,language,status`,
      { headers: { Authorization: `Bearer ${whatsappConfig.accessToken}` } }
    );
    if (!tplRes.ok) { const e = await tplRes.text(); return res.status(400).json({ message: 'Meta API: ' + e }); }

    const { data } = await tplRes.json();
    const templates = (data || []).filter(t => t.status === 'APPROVED').map(t => ({ name: t.name, language: t.language }));
    return res.json(templates);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
