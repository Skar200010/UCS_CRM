import nodemailer from 'nodemailer';
import crypto from 'crypto';
import db from '../config/db.js';
import { applyPersonalization } from './emailTemplateRenderer.js';
import {
  appendUnsubscribeHtml,
  appendUnsubscribeText,
  buildUnsubscribeUrl,
  getUnsubscribedSet,
} from './bulkEmailUnsubscribe.js';
import { buildInlineImageAttachments } from './emailImageAssets.js';

// Bulk-email campaigns use a Gmail SMTP account configured through the
// environment. The app password is never stored in source.
function gmailUser() {
  return process.env.GMAIL_USER || 'library.sevak@gmail.com';
}

function gmailAppPassword() {
  return process.env.GMAIL_APP_PASSWORD || '';
}

function smtpHost() {
  return process.env.SMTP_HOST || 'smtp.gmail.com';
}

function smtpPort() {
  return Number(process.env.SMTP_PORT || 465);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let transport;

function getTransport() {
  const password = gmailAppPassword();
  if (!password) {
    throw new Error('Gmail app password is not configured - email not sent');
  }
  if (!transport) {
    // Pool keeps a few SMTP connections open and reuses them across the whole
    // campaign. Without it every single message opened a fresh connection,
    // which made 300-400 recipient sends slow enough to hit the request
    // timeout and Gmail's connection throttling.
    transport = nodemailer.createTransport({
      host: smtpHost(),
      port: smtpPort(),
      secure: smtpPort() === 465,
      auth: { user: gmailUser(), pass: password },
      pool: true,
      maxConnections: Math.min(10, Math.max(1, Number(process.env.SMTP_MAX_CONNECTIONS) || 3)),
      maxMessages: 100,
    });
  }
  return transport;
}

// A campaign sends in small parallel batches with a pause between them so a
// 300-400 email blast does not trip Gmail's rate limits. Defaults match the
// agreed behaviour: 5 emails at a time, then a 6 second pause.
function campaignBatchSize() {
  const value = Number(process.env.BULK_EMAIL_BATCH_SIZE);
  return Number.isFinite(value) && value > 0 ? Math.min(50, Math.floor(value)) : 5;
}

function campaignBatchDelayMs() {
  const value = Number(process.env.BULK_EMAIL_BATCH_DELAY_MS);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 6000;
}

const cancelRequests = new Set();
const runningCampaigns = new Set();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cleanSearch(value) {
  return String(value || '').trim().replace(/[,()%]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeRecipients(list) {
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(list) ? list : []) {
    const email = normalizeEmail(item?.email);
    if (!email || !EMAIL_RE.test(email) || seen.has(email)) continue;
    seen.add(email);
    out.push({
      email,
      name: String(item?.name || '').trim() || null,
    });
  }
  return out;
}

async function fetchSource(source, search, limit) {
  const q = cleanSearch(search);
  const table = source === 'donors' ? 'donor_profiles' : 'beneficiaries';
  const nameCol = source === 'donors' ? 'name' : 'full_name';
  const mobileCol = source === 'donors' ? 'mobile_number' : 'mobile';
  const params = [];
  let where = `email IS NOT NULL AND email <> '' AND email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$'`;
  if (q) {
    params.push(`%${q}%`);
    where += ` AND (${nameCol} ILIKE $${params.length} OR email ILIKE $${params.length} OR ${mobileCol} ILIKE $${params.length})`;
  }
  params.push(limit);
  const { rows } = await db._pool.query(
    `SELECT ${nameCol} AS name, email FROM ${table} WHERE ${where} LIMIT $${params.length}`,
    params,
  );
  return rows.map((r) => ({ email: r.email, name: r.name }));
}

export async function listBulkEmailRecipients({ source, search = '', limit = 1000 } = {}) {
  const max = Math.min(5000, Math.max(1, Number(limit) || 1000));
  const rows = [];
  if (source === 'all') {
    const [donors, beneficiaries] = await Promise.all([
      fetchSource('donors', search, max),
      fetchSource('beneficiaries', search, max),
    ]);
    rows.push(...donors, ...beneficiaries);
  } else {
    rows.push(...(await fetchSource(source, search, max)));
  }
  const recipients = normalizeRecipients(rows);
  const unsubscribed = await getUnsubscribedSet();
  const allowed = recipients.filter((recipient) => !unsubscribed.has(recipient.email));
  return { recipients: allowed, total: allowed.length, skipped: recipients.length - allowed.length };
}

function textToHtml(text) {
  const escaped = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111827">${escaped.replace(/\n/g, '<br />')}</div>`;
}

function personalize(value, recipient, { html = false } = {}) {
  return applyPersonalization(value, {
    name: recipient.name || recipient.email.split('@')[0],
    email: recipient.email,
  }, { html });
}

async function getCampaignRow(id) {
  const { rows } = await db._pool.query('SELECT * FROM bulk_email_logs WHERE id = $1::bigint', [id]);
  return rows[0] || null;
}

function countResults(recipients) {
  let sent = 0;
  let failed = 0;
  let processed = 0;
  for (const recipient of recipients) {
    if (recipient.ok === true) {
      sent += 1;
      processed += 1;
    } else if (recipient.ok === false) {
      failed += 1;
      processed += 1;
    }
  }
  return { sent, failed, processed };
}

async function persistCampaignProgress(id, recipients, status) {
  const { sent, failed, processed } = countResults(recipients);
  await db._pool.query(
    `UPDATE bulk_email_logs
        SET recipients = $2::jsonb,
            sent_count = $3,
            failed_count = $4,
            processed_count = $5,
            status = $6
      WHERE id = $1::bigint`,
    [id, JSON.stringify(recipients), sent, failed, processed, status],
  );
  return { sent, failed, processed };
}

async function finishCampaign(id, recipients, status, lastError = null) {
  const { sent, failed } = await persistCampaignProgress(id, recipients, status);
  await db._pool.query(
    `UPDATE bulk_email_logs
        SET status = $2,
            sent_count = $3,
            failed_count = $4,
            finished_at = COALESCE(finished_at, NOW()),
            last_error = $5
      WHERE id = $1::bigint`,
    [id, status, sent, failed, lastError],
  );
}

/**
 * Validate and queue a campaign. The row is created *before* any email is sent
 * so a crash or restart cannot lose the record of the campaign. Sending itself
 * happens in the background via runBulkEmailCampaign().
 */
export async function createBulkEmailCampaign({ subject, text, html, source, recipients, attachment, createdBy } = {}) {
  const requested = normalizeRecipients(recipients);
  if (!requested.length) throw new Error('No valid recipients selected');
  if (!String(subject || '').trim()) throw new Error('Subject is required');

  const unsubscribed = await getUnsubscribedSet();
  const sendable = requested.filter((recipient) => !unsubscribed.has(recipient.email));
  const skipped = requested.length - sendable.length;
  if (!sendable.length) throw new Error('All selected recipients have unsubscribed');

  const rows = sendable.map((recipient) => ({
    email: recipient.email,
    name: recipient.name,
    ok: null,
    error: null,
  }));

  const { rows: inserted } = await db._pool.query(
    `INSERT INTO bulk_email_logs
       (subject, body, html, source, total_recipients, sent_count, failed_count,
        processed_count, recipients, created_by, status,
        attachment_name, attachment_type, attachment_data)
     VALUES ($1, $2, $3, $4, $5, 0, 0, 0, $6::jsonb, $7, 'queued', $8, $9, $10)
     RETURNING id, status, total_recipients, created_at`,
    [
      String(subject).trim(),
      text || '',
      html || null,
      source || null,
      rows.length,
      JSON.stringify(rows),
      createdBy || null,
      attachment?.filename || null,
      attachment?.contentType || null,
      attachment?.content || null,
    ],
  );

  return {
    id: inserted[0].id,
    status: inserted[0].status,
    total: inserted[0].total_recipients,
    skipped,
  };
}

/** Background sender. Safe to call again to resume a partially sent campaign. */
export async function runBulkEmailCampaign(id, { unsubscribeBaseUrl } = {}) {
  const key = String(id);
  if (runningCampaigns.has(key)) return { status: 'processing', alreadyRunning: true };
  runningCampaigns.add(key);

  try {
    const campaign = await getCampaignRow(id);
    if (!campaign) throw new Error('Campaign not found');

    const recipients = (Array.isArray(campaign.recipients) ? campaign.recipients : []).map((recipient) => ({
      email: recipient.email,
      name: recipient.name || null,
      ok: recipient.ok === true ? true : recipient.ok === false ? false : null,
      error: recipient.error || null,
    }));

    cancelRequests.delete(key);
    await db._pool.query(
      `UPDATE bulk_email_logs
          SET status = 'processing',
              started_at = COALESCE(started_at, NOW()),
              finished_at = NULL,
              last_error = NULL
        WHERE id = $1::bigint`,
      [id],
    );

    const pendingIndexes = recipients
      .map((recipient, index) => (recipient.ok === true ? -1 : index))
      .filter((index) => index >= 0);

    if (!pendingIndexes.length) {
      await finishCampaign(id, recipients, countResults(recipients).failed > 0 ? 'partial' : 'completed');
      return { status: 'completed' };
    }

    const transporter = getTransport();
    const inline = campaign.html
      ? await buildInlineImageAttachments(campaign.html)
      : { html: campaign.html, attachments: [] };
    let htmlTemplate = inline.html;
    const attachments = [...(inline.attachments || [])];

    // When an image is uploaded as the campaign attachment alongside an HTML
    // template, embed it at the top of the email body instead of leaving it as
    // a separate file attachment at the bottom.
    if (campaign.attachment_data) {
      const attachment = {
        filename: campaign.attachment_name || 'attachment',
        contentType: campaign.attachment_type || 'application/octet-stream',
        content: campaign.attachment_data,
      };
      if (htmlTemplate && String(attachment.contentType).startsWith('image/')) {
        const cid = `campaignattachment.${crypto.randomBytes(6).toString('hex')}@ucs-crm`;
        htmlTemplate = `<div style="text-align:center;margin:0 0 16px;"><img src="cid:${cid}" alt="${String(attachment.filename).replace(/"/g, '')}" style="max-width:100%;height:auto;border:0;" /></div>${htmlTemplate}`;
        attachments.push({
          filename: attachment.filename,
          content: attachment.content,
          contentType: attachment.contentType,
          cid,
          contentDisposition: 'inline',
        });
      } else {
        attachments.push({
          filename: attachment.filename,
          content: attachment.content,
          contentType: attachment.contentType,
        });
      }
    }

    const batchSize = campaignBatchSize();
    const delayMs = campaignBatchDelayMs();

    for (let i = 0; i < pendingIndexes.length; i += batchSize) {
      if (cancelRequests.has(key)) {
        cancelRequests.delete(key);
        await finishCampaign(id, recipients, 'cancelled');
        return { status: 'cancelled' };
      }

      const batchIndexes = pendingIndexes.slice(i, i + batchSize);
      const settled = await Promise.allSettled(batchIndexes.map(async (recipientIndex) => {
        const recipient = recipients[recipientIndex];
        const unsubscribeUrl = buildUnsubscribeUrl(unsubscribeBaseUrl, recipient.email);
        const personalizedText = personalize(campaign.body, recipient);
        const personalizedHtml = htmlTemplate
          ? personalize(htmlTemplate, recipient, { html: true })
          : textToHtml(personalizedText);

        await transporter.sendMail({
          from: `Being Sevak Charitable Trust <${gmailUser()}>`,
          to: recipient.email,
          subject: personalize(campaign.subject, recipient),
          text: appendUnsubscribeText(personalizedText, unsubscribeUrl),
          html: appendUnsubscribeHtml(personalizedHtml, unsubscribeUrl),
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
          attachments,
        });
      }));

      settled.forEach((item, index) => {
        const recipient = recipients[batchIndexes[index]];
        recipient.ok = item.status === 'fulfilled';
        recipient.error = item.status === 'fulfilled' ? null : (item.reason?.message || 'Send failed');
      });

      if (cancelRequests.has(key)) {
        cancelRequests.delete(key);
        await finishCampaign(id, recipients, 'cancelled');
        return { status: 'cancelled' };
      }

      await persistCampaignProgress(id, recipients, 'processing');

      if (i + batchSize < pendingIndexes.length) await sleep(delayMs);
    }

    const { failed } = countResults(recipients);
    const finalStatus = failed > 0 ? (failed < recipients.length ? 'partial' : 'failed') : 'completed';
    await finishCampaign(id, recipients, finalStatus);
    return { status: finalStatus };
  } catch (error) {
    try {
      await db._pool.query(
        `UPDATE bulk_email_logs
            SET status = 'failed',
                last_error = $2,
                finished_at = COALESCE(finished_at, NOW())
          WHERE id = $1::bigint`,
        [id, error?.message || 'Campaign failed'],
      );
    } catch { /* best effort */ }
    throw error;
  } finally {
    runningCampaigns.delete(key);
  }
}

/** Ask a running campaign to stop after the current batch. */
export async function cancelBulkEmailCampaign(id) {
  const key = String(id);
  // Only queue an in-memory cancel when a sender loop is actually running.
  // Otherwise the flag would sit in the set forever for a queued campaign.
  if (runningCampaigns.has(key)) cancelRequests.add(key);
  const { rowCount } = await db._pool.query(
    `UPDATE bulk_email_logs
        SET status = 'cancelled', finished_at = COALESCE(finished_at, NOW())
      WHERE id = $1::bigint AND status IN ('queued', 'processing')`,
    [id],
  );
  return rowCount > 0;
}

/**
 * On startup nothing can legitimately be mid-send, so any campaign still marked
 * queued/processing was cut off by a restart. Flag it as interrupted so the UI
 * can offer Resume instead of leaving it stuck forever.
 */
export async function recoverInterruptedBulkEmails() {
  const { rowCount } = await db._pool.query(
    `UPDATE bulk_email_logs
        SET status = 'interrupted',
            finished_at = COALESCE(finished_at, NOW()),
            last_error = COALESCE(last_error, 'Server restarted before the campaign finished')
      WHERE status IN ('queued', 'processing')`,
  );
  if (rowCount > 0) console.log(`Marked ${rowCount} interrupted bulk email campaign(s) for resume.`);
  return rowCount;
}

export async function listBulkEmailLogs({ page = 1, limit = 20 } = {}) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  const [{ rows }, { rows: countRows }] = await Promise.all([
    db._pool.query(
      `SELECT id, subject, source, status, total_recipients, sent_count, failed_count,
              processed_count, created_by, created_at, started_at, finished_at
         FROM bulk_email_logs
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2`,
      [limitNum, offset],
    ),
    db._pool.query('SELECT COUNT(*)::int AS total FROM bulk_email_logs'),
  ]);

  return {
    logs: rows,
    total: countRows[0]?.total || 0,
    page: pageNum,
    limit: limitNum,
  };
}

export async function getBulkEmailLog(id) {
  const { rows } = await db._pool.query(
    `SELECT id, subject, body, source, status, total_recipients, sent_count, failed_count,
            processed_count, recipients, created_by, created_at, started_at, finished_at, last_error
       FROM bulk_email_logs
      WHERE id = $1::bigint`,
    [id],
  );
  return rows[0] || null;
}

export async function listBulkEmailTemplates() {
  const { rows } = await db._pool.query(
    `SELECT id, name, subject, body, created_by, created_at, updated_at,
            attachment_name, attachment_type,
            (attachment_data IS NOT NULL) AS has_attachment,
            (design IS NOT NULL) AS has_design,
            (html IS NOT NULL) AS has_html
       FROM bulk_email_templates
      ORDER BY name ASC`,
  );
  return rows;
}

export async function getBulkEmailTemplate(id) {
  const { rows } = await db._pool.query(
    `SELECT id, name, subject, body, design, html, created_by, created_at, updated_at,
            attachment_name, attachment_type,
            (attachment_data IS NOT NULL) AS has_attachment,
            (design IS NOT NULL) AS has_design,
            (html IS NOT NULL) AS has_html
       FROM bulk_email_templates
      WHERE id = $1::bigint`,
    [id],
  );
  return rows[0] || null;
}

export async function getBulkEmailTemplateAttachment(id) {
  const { rows } = await db._pool.query(
    `SELECT attachment_name, attachment_type, attachment_data
       FROM bulk_email_templates
      WHERE id = $1::bigint`,
    [id],
  );
  const row = rows[0];
  if (!row || !row.attachment_data) return null;
  return {
    filename: row.attachment_name || 'attachment',
    contentType: row.attachment_type || 'application/octet-stream',
    content: row.attachment_data,
  };
}

export async function createBulkEmailTemplate({ name, subject, body, createdBy, attachment, design, html } = {}) {
  const { rows } = await db._pool.query(
    `INSERT INTO bulk_email_templates
       (name, subject, body, created_by, attachment_name, attachment_type, attachment_data, design, html)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
     RETURNING id, name, subject, body, created_by, created_at, updated_at,
               attachment_name, attachment_type,
               (attachment_data IS NOT NULL) AS has_attachment,
               (design IS NOT NULL) AS has_design,
               (html IS NOT NULL) AS has_html`,
    [
      name,
      subject,
      body,
      createdBy || null,
      attachment?.filename || null,
      attachment?.contentType || null,
      attachment?.content || null,
      design ? JSON.stringify(design) : null,
      html || null,
    ],
  );
  return rows[0];
}

export async function updateBulkEmailTemplate(id, { name, subject, body, attachment, removeAttachment, design, html } = {}) {
  const sets = ['name = $2', 'subject = $3', 'body = $4', 'updated_at = NOW()'];
  const params = [id, name, subject, body];
  if (attachment) {
    params.push(attachment.filename || null, attachment.contentType || null, attachment.content || null);
    sets.push(
      `attachment_name = $${params.length - 2}`,
      `attachment_type = $${params.length - 1}`,
      `attachment_data = $${params.length}`,
    );
  } else if (removeAttachment) {
    sets.push('attachment_name = NULL', 'attachment_type = NULL', 'attachment_data = NULL');
  }
  if (design !== undefined) {
    const value = design ? JSON.stringify(design) : null;
    sets.push(`design = $${params.push(value)}::jsonb`);
  }
  if (html !== undefined) {
    sets.push(`html = $${params.push(html || null)}`);
  }

  const { rows } = await db._pool.query(
    `UPDATE bulk_email_templates
        SET ${sets.join(', ')}
      WHERE id = $1::bigint
      RETURNING id, name, subject, body, created_by, created_at, updated_at,
                attachment_name, attachment_type,
                (attachment_data IS NOT NULL) AS has_attachment,
                (design IS NOT NULL) AS has_design,
                (html IS NOT NULL) AS has_html`,
    params,
  );
  return rows[0] || null;
}

export async function deleteBulkEmailTemplate(id) {
  const { rowCount } = await db._pool.query(
    'DELETE FROM bulk_email_templates WHERE id = $1::bigint',
    [id],
  );
  return rowCount > 0;
}
