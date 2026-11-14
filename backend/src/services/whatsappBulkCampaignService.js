import db from '../config/db.js';
import { getAccountById } from '../models/whatsappAccountModel.js';
import { resolveAccount, sendTemplateMessage } from './whatsappService.js';
import { resolveTemplateHeaderAsset } from './templateHeaderMedia.js';
import {
  renderTemplateBody,
  resolveTemplateComponentsForSend,
  templateComponentOf,
  templateParameterNames,
} from './whatsappTemplateComponents.js';

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function normalizePhone(phone) {
  const raw = String(phone || '').replace(/\D/g, '');
  if (raw.length === 10) return `91${raw}`;
  if (raw.length === 11 && raw.startsWith('0')) return `91${raw.slice(1)}`;
  return raw;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function campaignBatchSize() {
  const value = parseInt(process.env.WHATSAPP_BULK_BATCH_SIZE || '5', 10);
  return Number.isFinite(value) && value > 0 ? value : 5;
}

function campaignBatchDelayMs() {
  const value = parseInt(process.env.WHATSAPP_BULK_BATCH_DELAY_MS || '5000', 10);
  return Number.isFinite(value) && value >= 0 ? value : 5000;
}

const ACTIVE_STATUSES = new Set(['queued', 'processing']);
const TERMINAL_STATUSES = new Set(['completed', 'partial', 'failed', 'cancelled', 'interrupted']);

const runningCampaigns = new Set();
const cancelRequests = new Set();

function normalizeQueueItem(item) {
  const phone = normalizePhone(item?.phone || '');
  const status = ['pending', 'sending', 'sent', 'failed', 'unknown'].includes(item?.status)
    ? item.status
    : 'pending';
  return {
    phone,
    name: item?.name ? String(item.name) : null,
    parameters: Array.isArray(item?.parameters) ? item.parameters.map((value) => String(value ?? '')) : [],
    status,
    error: item?.error || null,
  };
}

function normalizeQueue(list) {
  return (Array.isArray(list) ? list : [])
    .map(normalizeQueueItem)
    .filter((item) => item.phone);
}

function countQueue(queue) {
  let sent = 0;
  let failed = 0;
  let unknown = 0;
  let processed = 0;
  for (const item of queue) {
    if (item.status === 'sent') {
      sent += 1;
      processed += 1;
    } else if (item.status === 'failed') {
      failed += 1;
      processed += 1;
    } else if (item.status === 'unknown') {
      unknown += 1;
      processed += 1;
    }
  }
  return { sent, failed, unknown, processed };
}

async function getCampaignRow(id) {
  const { rows } = await db._pool.query('SELECT * FROM campaigns WHERE id = $1::uuid', [id]);
  return rows[0] || null;
}

async function persistQueue(id, queue, status) {
  const counts = countQueue(queue);
  await db._pool.query(
    `UPDATE campaigns
        SET recipients = $2::jsonb,
            total_count = $3,
            sent_count = $4,
            failed_count = $5,
            unknown_count = $6,
            processed_count = $7,
            status = $8,
            updated_at = NOW()
      WHERE id = $1::uuid`,
    [id, JSON.stringify(queue), queue.length, counts.sent, counts.failed, counts.unknown, counts.processed, status],
  );
  return counts;
}

async function finishCampaign(id, queue, status, lastError = null) {
  const counts = await persistQueue(id, queue, status);
  await db._pool.query(
    `UPDATE campaigns
        SET status = $2,
            sent_count = $3,
            failed_count = $4,
            unknown_count = $5,
            processed_count = $6,
            completed_at = COALESCE(completed_at, NOW()),
            last_error = $7,
            updated_at = NOW()
      WHERE id = $1::uuid`,
    [id, status, counts.sent, counts.failed, counts.unknown, counts.processed, lastError],
  );
  return counts;
}

/**
 * Send a single template to one recipient. This is the logic that used to live
 * inline in the send-bulk-template controller; it is shared by the HTTP
 * endpoint (used for retries) and the background campaign runner.
 */
export async function sendBulkTemplateToRecipient({
  account: providedAccount,
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
} = {}) {
  const phone = normalizePhone(to || '');
  if (!phone) throw badRequest('Phone number is required');

  const account = providedAccount || (accountId ? await getAccountById(accountId) : await resolveAccount());
  if (!account) throw badRequest('No WhatsApp account configured');

  const tpl = templateName || account.template_name;
  if (!tpl) throw badRequest('Template name is required');

  const params = Array.isArray(parameters) ? parameters : [];
  const resolvedLang = templateLang || account.template_language || 'en';

  // Resolve the template and its header before sending. Chats needs a durable
  // copy of the header image (Meta's sample URL expires), and the send itself
  // needs a fresh publicly-fetchable URL.
  const components = await resolveTemplateComponentsForSend(account, tpl, resolvedLang);
  const headerComponent = templateComponentOf(components, 'HEADER');
  const buttonsComponent = templateComponentOf(components, 'BUTTONS');
  const resolvedHeaderFormat = headerComponent?.format
    ? String(headerComponent.format).toUpperCase()
    : (headerFormat ? String(headerFormat).toUpperCase() : null);
  const isMediaHeader = ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(resolvedHeaderFormat);
  const headerAsset = isMediaHeader
    ? await resolveTemplateHeaderAsset({
      project: account.project || null,
      templateName: tpl,
      headerComponent,
      headerUrl: headerImageUrl,
    })
    : null;
  // If the durable copy could not be made (for example an expired sample or a
  // storage hiccup) still hand Meta the template's own https sample. Media
  // headers are mandatory: omitting them makes Meta reject the send with
  // 132012 "Format mismatch, expected IMAGE/DOCUMENT, received UNKNOWN".
  const headerSample = headerComponent?.example?.header_handle?.[0]
    || headerComponent?.example?.header_handle
    || null;
  const headerSampleUrl = typeof headerSample === 'string' && /^https?:\/\//i.test(headerSample)
    ? headerSample
    : null;
  const sendHeaderUrl = headerAsset?.signedUrl || headerImageUrl || headerSampleUrl || null;
  const resolvedParameterNames = Array.isArray(parameterNames) && parameterNames.length
    ? parameterNames
    : templateParameterNames(components);

  const result = await sendTemplateMessage(
    phone,
    tpl,
    params,
    resolvedLang,
    account,
    sendHeaderUrl,
    resolvedHeaderFormat || headerFormat,
    resolvedParameterNames,
  );
  const messageId = result?.messages?.[0]?.id || result?.id || null;

  if (!messageId) {
    const error = new Error('No WhatsApp message ID returned');
    error.statusCode = 502;
    error.result = result;
    throw error;
  }

  // Snapshot the content that went out. The Chats thread reads this instead
  // of depending on whatsapp_templates still containing the template, which
  // is why old bulk bubbles used to render with no text or image.
  const resolvedHeaderUrl = headerAsset?.storedUrl || headerSampleUrl || null;
  const templateButtons = Array.isArray(buttonsComponent?.buttons) ? buttonsComponent.buttons : null;

  const { error: insertErr } = await db.from('whatsapp_bulk_recipients').insert({
    account_id: account.id,
    campaign_id: campaignId || null,
    template_name: tpl,
    recipient_name: recipientName || null,
    phone,
    wa_message_id: messageId,
    status: 'accepted',
    body_text: renderTemplateBody(components, params),
    header_format: resolvedHeaderFormat,
    header_url: resolvedHeaderUrl,
    template_buttons: templateButtons,
  });

  if (insertErr) {
    console.error('Bulk recipient log insert failed:', insertErr.message);
  }

  return { messageId, status: 'accepted', result };
}

/**
 * Validate and queue a campaign. The row (and the per-recipient queue) is
 * persisted before anything is sent, so a browser refresh or a server restart
 * cannot lose the record of who is still pending.
 */
export async function createWhatsAppCampaign({
  name,
  accountId,
  templateName,
  templateLang,
  headerImageUrl,
  headerFormat,
  parameterNames,
  recipients,
  createdBy,
} = {}) {
  const queue = normalizeQueue(recipients);
  if (!queue.length) throw badRequest('No valid recipients selected');
  if (!accountId) throw badRequest('WhatsApp account is required');
  if (!templateName) throw badRequest('Template name is required');

  const batchSize = campaignBatchSize();
  const { rows } = await db._pool.query(
    `INSERT INTO campaigns
       (name, channel, status, account_id, template_name, template_lang,
        header_image_url, header_format, parameter_names, recipients,
        total_count, sent_count, failed_count, unknown_count, processed_count,
        batch_size, created_by)
     VALUES ($1, 'whatsapp', 'queued', $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb,
             $9, 0, 0, 0, 0, $10, $11)
     RETURNING id, status, total_count, batch_size, created_at`,
    [
      name || `Bulk WhatsApp ${new Date().toISOString().slice(0, 10)}`,
      String(accountId),
      templateName,
      templateLang || 'en',
      headerImageUrl || null,
      headerFormat || null,
      parameterNames ? JSON.stringify(parameterNames) : null,
      JSON.stringify(queue),
      queue.length,
      batchSize,
      createdBy || null,
    ],
  );

  return {
    id: rows[0].id,
    status: 'queued',
    total: queue.length,
    batchSize: rows[0].batch_size,
    created_at: rows[0].created_at,
  };
}

/**
 * Background sender. Safe to call again to resume a partially sent campaign.
 * Already-sent recipients are never sent twice. A recipient left in the
 * 'sending' state by a crash is marked 'unknown' (needs review) instead of
 * being retried, so a restart cannot produce duplicate WhatsApp messages.
 */
export async function runWhatsAppCampaign(id) {
  const key = String(id);
  if (runningCampaigns.has(key)) return { status: 'processing', alreadyRunning: true };
  runningCampaigns.add(key);

  try {
    const campaign = await getCampaignRow(id);
    if (!campaign) throw new Error('Campaign not found');
    if (campaign.channel && campaign.channel !== 'whatsapp') throw new Error('Not a WhatsApp campaign');

    let queue = normalizeQueue(campaign.recipients);
    if (!queue.length) throw new Error('Campaign has no queued recipients');

    // A batch that was in flight when the process died has no reliable verdict.
    // Never resend it automatically; surface it for manual review instead.
    queue = queue.map((item) => (item.status === 'sending'
      ? { ...item, status: 'unknown', error: item.error || 'Send state unknown after restart' }
      : item));

    cancelRequests.delete(key);
    await db._pool.query(
      `UPDATE campaigns
          SET status = 'processing',
              started_at = COALESCE(started_at, NOW()),
              completed_at = NULL,
              last_error = NULL,
              recipients = $2::jsonb,
              updated_at = NOW()
        WHERE id = $1::uuid`,
      [id, JSON.stringify(queue)],
    );

    const pending = queue
      .map((item, index) => ((item.status === 'pending' || item.status === 'failed') ? index : -1))
      .filter((index) => index >= 0);

    if (!pending.length) {
      const counts = countQueue(queue);
      const status = (counts.failed > 0 || counts.unknown > 0)
        ? (counts.sent > 0 ? 'partial' : 'failed')
        : 'completed';
      await finishCampaign(id, queue, status);
      return { status };
    }

    const account = await getAccountById(campaign.account_id);
    if (!account) throw new Error('WhatsApp account not found');

    const batchSize = Math.max(1, Number(campaign.batch_size) || campaignBatchSize());
    const delayMs = campaignBatchDelayMs();

    for (let i = 0; i < pending.length; i += batchSize) {
      if (cancelRequests.has(key)) {
        cancelRequests.delete(key);
        await finishCampaign(id, queue, 'cancelled');
        return { status: 'cancelled' };
      }

      const batchIndexes = pending.slice(i, i + batchSize);
      for (const index of batchIndexes) {
        queue[index] = { ...queue[index], status: 'sending', error: null };
      }
      await persistQueue(id, queue, 'processing');

      const settled = await Promise.allSettled(batchIndexes.map((index) => sendBulkTemplateToRecipient({
        account,
        accountId: campaign.account_id,
        to: queue[index].phone,
        templateName: campaign.template_name,
        templateLang: campaign.template_lang,
        parameters: queue[index].parameters,
        parameterNames: campaign.parameter_names,
        headerImageUrl: campaign.header_image_url,
        headerFormat: campaign.header_format,
        recipientName: queue[index].name,
        campaignId: campaign.id,
      })));

      settled.forEach((item, offset) => {
        const index = batchIndexes[offset];
        if (item.status === 'fulfilled') {
          queue[index] = { ...queue[index], status: 'sent', error: null };
        } else {
          queue[index] = { ...queue[index], status: 'failed', error: item.reason?.message || 'Send failed' };
        }
      });

      if (cancelRequests.has(key)) {
        cancelRequests.delete(key);
        await finishCampaign(id, queue, 'cancelled');
        return { status: 'cancelled' };
      }

      await persistQueue(id, queue, 'processing');

      if (i + batchSize < pending.length) await sleep(delayMs);
    }

    const counts = countQueue(queue);
    const finalStatus = (counts.failed > 0 || counts.unknown > 0)
      ? (counts.sent > 0 ? 'partial' : 'failed')
      : 'completed';
    await finishCampaign(id, queue, finalStatus);
    return { status: finalStatus };
  } catch (error) {
    try {
      await db._pool.query(
        `UPDATE campaigns
            SET status = 'failed',
                last_error = $2,
                completed_at = COALESCE(completed_at, NOW()),
                updated_at = NOW()
          WHERE id = $1::uuid`,
        [id, error?.message || 'Campaign failed'],
      );
    } catch { /* best effort */ }
    throw error;
  } finally {
    runningCampaigns.delete(key);
  }
}

/** Ask a running campaign to stop after the current batch. */
export async function cancelWhatsAppCampaign(id) {
  const key = String(id);
  // Only queue an in-memory cancel when a sender loop is actually running.
  // Otherwise the flag would sit in the set forever for a queued campaign.
  if (runningCampaigns.has(key)) cancelRequests.add(key);
  const { rowCount } = await db._pool.query(
    `UPDATE campaigns
        SET status = 'cancelled',
            completed_at = COALESCE(completed_at, NOW()),
            updated_at = NOW()
      WHERE id = $1::uuid AND channel = 'whatsapp' AND status IN ('queued', 'processing')`,
    [id],
  );
  return rowCount > 0;
}

export async function getWhatsAppCampaignRow(id) {
  return getCampaignRow(id);
}

export async function resumeWhatsAppCampaign(id) {
  const campaign = await getCampaignRow(id);
  if (!campaign) return { notFound: true };
  if (campaign.status === 'processing') return { alreadyProcessing: true, campaign };
  const queue = normalizeQueue(campaign.recipients);
  if (!queue.length) return { noQueue: true, campaign };

  // Flip back to queued before handing off to the background loop so an
  // immediate progress poll from the client cannot still read 'interrupted'
  // and stop polling again.
  await db._pool.query(
    `UPDATE campaigns
        SET status = 'queued',
            completed_at = NULL,
            updated_at = NOW()
      WHERE id = $1::uuid`,
    [id],
  );

  runWhatsAppCampaign(id).catch((error) => {
    console.error(`WhatsApp campaign ${id} resume failed:`, error?.message || error);
  });
  return { started: true, campaign };
}

/**
 * Progress snapshot for the Bulk send modal. Only the current/last batch is
 * returned row-by-row; earlier batches are summarised so polling stays cheap
 * even for very large campaigns.
 */
export async function getWhatsAppCampaignProgress(id) {
  const campaign = await getCampaignRow(id);
  if (!campaign) return null;

  const queue = normalizeQueue(campaign.recipients);
  const total = queue.length || Number(campaign.total_count) || 0;
  const batchSize = Math.max(1, Number(campaign.batch_size) || campaignBatchSize());
  const totalBatches = Math.max(1, Math.ceil(total / batchSize));
  const counts = countQueue(queue);

  const sendingIndex = queue.findIndex((item) => item.status === 'sending');
  const pendingIndex = queue.findIndex((item) => item.status === 'pending');
  const firstUnfinished = sendingIndex >= 0 ? sendingIndex : pendingIndex;
  let currentBatch;
  if (firstUnfinished >= 0) currentBatch = Math.floor(firstUnfinished / batchSize) + 1;
  else currentBatch = Math.ceil(counts.processed / batchSize) || totalBatches;
  currentBatch = Math.min(Math.max(1, currentBatch), totalBatches);

  const start = (currentBatch - 1) * batchSize;
  const results = queue.slice(start, start + batchSize).map((item) => ({
    name: item.name || item.phone,
    status: item.status === 'sent'
      ? 'sent'
      : (item.status === 'failed' || item.status === 'unknown')
        ? 'failed'
        : item.status === 'pending'
          ? 'pending'
          : 'sending',
    error: item.error || null,
  }));

  const previousBatches = [];
  for (let batch = 0; batch < currentBatch - 1; batch += 1) {
    const slice = queue.slice(batch * batchSize, (batch + 1) * batchSize);
    previousBatches.push({
      batch: batch + 1,
      sent: slice.filter((item) => item.status === 'sent').length,
      failed: slice.filter((item) => item.status === 'failed' || item.status === 'unknown').length,
    });
  }

  const terminal = TERMINAL_STATUSES.has(campaign.status);
  const retryableRecipients = terminal
    ? queue
      .filter((item) => item.status === 'failed' || item.status === 'unknown' || item.status === 'pending')
      .map((item) => ({ phone: item.phone, name: item.name, status: item.status, error: item.error }))
    : undefined;

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      account_id: campaign.account_id,
      template_name: campaign.template_name,
      total_count: total,
      sent_count: counts.sent,
      failed_count: counts.failed,
      unknown_count: counts.unknown,
      processed_count: counts.processed,
      batch_size: batchSize,
      started_at: campaign.started_at,
      completed_at: campaign.completed_at,
      last_error: campaign.last_error,
      created_at: campaign.created_at,
    },
    progress: {
      total,
      sent: counts.sent,
      failed: counts.failed,
      unknown: counts.unknown,
      processed: counts.processed,
      currentBatch,
      totalBatches,
      results,
      previousBatches,
    },
    retryableRecipients,
    active: ACTIVE_STATUSES.has(campaign.status),
  };
}

/**
 * On startup nothing can legitimately be mid-send, so any campaign still
 * marked queued/processing was cut off by a restart. Flag it as interrupted
 * so the UI can offer Resume instead of leaving it stuck forever.
 */
export async function recoverInterruptedWhatsAppCampaigns() {
  const { rowCount } = await db._pool.query(
    `UPDATE campaigns
        SET status = 'interrupted',
            completed_at = COALESCE(completed_at, NOW()),
            last_error = COALESCE(last_error, 'Server restarted before the campaign finished'),
            updated_at = NOW()
      WHERE channel = 'whatsapp'
        AND status IN ('queued', 'processing')
        AND jsonb_typeof(recipients) = 'array'
        AND jsonb_array_length(recipients) > 0`,
  );
  if (rowCount > 0) console.log(`Marked ${rowCount} interrupted WhatsApp campaign(s) for resume.`);
  return rowCount;
}
