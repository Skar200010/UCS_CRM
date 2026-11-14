import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  cancelBulkEmailCampaign,
  createBulkEmailCampaign,
  createBulkEmailTemplate,
  deleteBulkEmailTemplate,
  getBulkEmailLog,
  getBulkEmailTemplate,
  getBulkEmailTemplateAttachment,
  listBulkEmailLogs,
  listBulkEmailRecipients,
  listBulkEmailTemplates,
  runBulkEmailCampaign,
  updateBulkEmailTemplate,
} from '../services/bulkEmailService.js';
import {
  applyPersonalization,
  escapeHtml,
  renderEmailTemplate,
  validateDesign,
} from '../services/emailTemplateRenderer.js';
import {
  recordUnsubscribe,
  verifyUnsubscribeToken,
} from '../services/bulkEmailUnsubscribe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EMAIL_ASSET_DIR = path.resolve(__dirname, '../../uploads/email-assets');
const EMAIL_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
const EMAIL_IMAGE_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

function parseDesign(value) {
  if (value === undefined || value === null || value === '') return null;
  let design = value;
  if (typeof value === 'string') {
    try {
      design = JSON.parse(value);
    } catch {
      throw new Error('Invalid email design JSON');
    }
  }
  return validateDesign(design);
}

function publicBaseUrl(req) {
  const configured = String(process.env.PUBLIC_API_URL || process.env.EMAIL_ASSET_BASE_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  return `${req.protocol}://${req.get('host')}`;
}

export async function listRecipients(req, res) {
  try {
    const { source = 'donors', search = '', limit } = req.query;
    const data = await listBulkEmailRecipients({ source, search, limit });
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

export async function send(req, res) {
  try {
    const { subject, text, html, source } = req.body || {};
    let { recipients } = req.body || {};
    if (typeof recipients === 'string') {
      try {
        recipients = JSON.parse(recipients);
      } catch {
        recipients = [];
      }
    }
    const attachment = req.file
      ? { filename: req.file.originalname, content: req.file.buffer, contentType: req.file.mimetype }
      : null;
    const createdBy = req.user?.name || req.user?.email || req.user?.login_id || null;
    const campaign = await createBulkEmailCampaign({
      subject,
      text,
      html,
      recipients,
      source,
      attachment,
      createdBy,
    });

    // Send in the background and reply immediately. A 300-400 recipient
    // campaign runs for several minutes; blocking the HTTP request caused the
    // client timeout to fire while emails were still going out.
    runBulkEmailCampaign(campaign.id, { unsubscribeBaseUrl: publicBaseUrl(req) })
      .catch((error) => console.error(`Bulk email campaign ${campaign.id} failed:`, error?.message || error));

    return res.status(202).json({
      log_id: campaign.id,
      total: campaign.total,
      skipped: campaign.skipped,
      status: campaign.status,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

export async function resumeCampaign(req, res) {
  try {
    const log = await getBulkEmailLog(req.params.id);
    if (!log) return res.status(404).json({ message: 'Log not found' });
    if (log.status === 'processing') {
      return res.status(409).json({ message: 'This campaign is already sending.' });
    }
    runBulkEmailCampaign(log.id, { unsubscribeBaseUrl: publicBaseUrl(req) })
      .catch((error) => console.error(`Bulk email campaign ${log.id} resume failed:`, error?.message || error));
    return res.status(202).json({ log_id: log.id, status: 'processing' });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

export async function cancelCampaign(req, res) {
  try {
    const cancelled = await cancelBulkEmailCampaign(req.params.id);
    if (!cancelled) return res.status(404).json({ message: 'No active campaign to cancel' });
    return res.json({ message: 'Campaign cancelled' });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

export async function listLogs(req, res) {
  try {
    const { page, limit } = req.query;
    const data = await listBulkEmailLogs({ page, limit });
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getLog(req, res) {
  try {
    const log = await getBulkEmailLog(req.params.id);
    if (!log) return res.status(404).json({ message: 'Log not found' });
    return res.json(log);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function listTemplates(req, res) {
  try {
    const templates = await listBulkEmailTemplates();
    return res.json({ templates });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function createTemplate(req, res) {
  try {
    const { name, subject, body: rawBody, design: rawDesign } = req.body || {};
    if (!String(name || '').trim()) return res.status(400).json({ message: 'Template name is required' });
    if (!String(subject || '').trim()) return res.status(400).json({ message: 'Template subject is required' });

    const design = parseDesign(rawDesign);
    const rendered = design ? renderEmailTemplate(design) : null;
    const body = String(rawBody || '').trim() || rendered?.text || (design ? 'Email template' : '');
    if (!body) return res.status(400).json({ message: 'Template body is required' });

    const createdBy = req.user?.name || req.user?.email || req.user?.login_id || null;
    const attachment = req.file
      ? { filename: req.file.originalname, content: req.file.buffer, contentType: req.file.mimetype }
      : null;
    const template = await createBulkEmailTemplate({
      name: String(name).trim(),
      subject: String(subject).trim(),
      body,
      createdBy,
      attachment,
      design,
      html: rendered?.html || null,
    });
    return res.status(201).json(template);
  } catch (error) {
    const message = String(error.message || '');
    if (message.includes('duplicate key') || message.includes('unique')) {
      return res.status(409).json({ message: 'A template with this name already exists' });
    }
    return res.status(400).json({ message: error.message });
  }
}

export async function updateTemplate(req, res) {
  try {
    const { name, subject, body: rawBody, design: rawDesign } = req.body || {};
    if (!String(name || '').trim()) return res.status(400).json({ message: 'Template name is required' });
    if (!String(subject || '').trim()) return res.status(400).json({ message: 'Template subject is required' });

    const hasDesignField = Object.prototype.hasOwnProperty.call(req.body || {}, 'design');
    const designProvided = hasDesignField || rawDesign !== undefined;
    const design = designProvided ? parseDesign(rawDesign) : undefined;
    const rendered = design ? renderEmailTemplate(design) : null;

    let body = String(rawBody || '').trim();
    if (designProvided) {
      body = body || rendered?.text || 'Email template';
    } else if (!body) {
      return res.status(400).json({ message: 'Template body is required' });
    }

    const attachment = req.file
      ? { filename: req.file.originalname, content: req.file.buffer, contentType: req.file.mimetype }
      : null;
    const removeAttachment = String(req.body?.remove_attachment || '') === 'true';
    const template = await updateBulkEmailTemplate(req.params.id, {
      name: String(name).trim(),
      subject: String(subject).trim(),
      body,
      attachment,
      removeAttachment,
      design: designProvided ? design : undefined,
      html: designProvided ? (rendered?.html || null) : undefined,
    });
    if (!template) return res.status(404).json({ message: 'Template not found' });
    return res.json(template);
  } catch (error) {
    const message = String(error.message || '');
    if (message.includes('duplicate key') || message.includes('unique')) {
      return res.status(409).json({ message: 'A template with this name already exists' });
    }
    return res.status(400).json({ message: error.message });
  }
}

export async function getTemplate(req, res) {
  try {
    const template = await getBulkEmailTemplate(req.params.id);
    if (!template) return res.status(404).json({ message: 'Template not found' });
    return res.json(template);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function previewTemplate(req, res) {
  try {
    const design = parseDesign(req.body?.design ?? req.body);
    const { html, text } = renderEmailTemplate(design);
    const data = {
      name: req.body?.name ?? req.body?.sample?.name ?? '',
      email: req.body?.email ?? req.body?.sample?.email ?? '',
    };
    return res.json({
      html: applyPersonalization(html, data, { html: true }),
      text: applyPersonalization(text, data),
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

export async function uploadAsset(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    if (!EMAIL_IMAGE_TYPES.has(req.file.mimetype)) {
      return res.status(400).json({ message: 'Only PNG, JPG, WEBP or GIF images are allowed' });
    }
    const ext = EMAIL_IMAGE_EXT[req.file.mimetype] || 'png';
    const fileName = `email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    await fs.promises.mkdir(EMAIL_ASSET_DIR, { recursive: true });
    await fs.promises.writeFile(path.join(EMAIL_ASSET_DIR, fileName), req.file.buffer);
    const relativePath = `/uploads/email-assets/${fileName}`;
    return res.status(201).json({
      path: relativePath,
      url: `${publicBaseUrl(req)}${relativePath}`,
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Could not save the image' });
  }
}

function unsubscribePage({ heading, message, email, token, showForm }) {
  const action = `/api/unsubscribe?token=${encodeURIComponent(token || '')}`;
  const emailLine = email
    ? `<p style="margin:0 0 18px;font-size:14px;color:#334155;">Address: <strong>${escapeHtml(email)}</strong></p>`
    : '';
  const form = showForm
    ? `<form method="post" action="${escapeHtml(action)}" style="margin:0;">`
      + '<button type="submit" style="display:inline-block;padding:13px 28px;border:0;border-radius:8px;background:#0f766e;color:#fff;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;">Unsubscribe me</button>'
      + '</form>'
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f1;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#1f2937;">
<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;">
  <div style="width:100%;max-width:460px;background:#fff;border-radius:14px;box-shadow:0 18px 50px rgba(15,23,42,.12);padding:32px;box-sizing:border-box;">
    <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0f766e;margin-bottom:10px;">Being Sevak</div>
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">${escapeHtml(heading)}</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#475569;">${escapeHtml(message)}</p>
    ${emailLine}
    ${form}
    <p style="margin:22px 0 0;font-size:11.5px;line-height:1.6;color:#94a3b8;">If you did not request this, you can ignore this page.</p>
  </div>
</div>
</body>
</html>`;
}

export async function unsubscribeInfo(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const token = String(req.query?.token || '');
  const email = verifyUnsubscribeToken(token);
  if (!email) {
    return res.status(400).send(unsubscribePage({
      heading: 'Invalid unsubscribe link',
      message: 'This link is invalid or incomplete. Please use the unsubscribe link from the email you received.',
      showForm: false,
    }));
  }
  return res.send(unsubscribePage({
    heading: 'Unsubscribe from emails?',
    message: 'You will stop receiving bulk emails from Being Sevak. You can ask us to re-subscribe you at any time.',
    email,
    token,
    showForm: true,
  }));
}

export async function unsubscribeOneClick(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const token = String(req.query?.token || req.body?.token || '');
  const email = verifyUnsubscribeToken(token);
  if (!email) {
    return res.status(400).send(unsubscribePage({
      heading: 'Invalid unsubscribe link',
      message: 'This link is invalid or incomplete. Please use the unsubscribe link from the email you received.',
      showForm: false,
    }));
  }
  try {
    await recordUnsubscribe({ email, source: 'bulk-email', reason: 'one-click' });
    return res.send(unsubscribePage({
      heading: 'You are unsubscribed',
      message: 'You have been removed from our bulk email list and will not receive future campaigns.',
      email,
      showForm: false,
    }));
  } catch (error) {
    return res.status(500).send(unsubscribePage({
      heading: 'Could not unsubscribe',
      message: 'Something went wrong while processing your request. Please try again later.',
      showForm: false,
    }));
  }
}

export async function getTemplateAttachment(req, res) {
  try {
    const attachment = await getBulkEmailTemplateAttachment(req.params.id);
    if (!attachment) return res.status(404).json({ message: 'This template has no attachment' });
    res.setHeader('Content-Type', attachment.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${String(attachment.filename).replace(/"/g, '')}"`);
    return res.send(attachment.content);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function deleteTemplate(req, res) {
  try {
    const removed = await deleteBulkEmailTemplate(req.params.id);
    if (!removed) return res.status(404).json({ message: 'Template not found' });
    return res.json({ message: 'Template deleted' });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}
