import config from '../config/whatsappConfig.js';

const API_BASE = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;

export async function sendTextMessage(to, text) {
  if (!config.enabled) throw new Error('WhatsApp not configured');

  const body = {
    messaging_product: 'whatsapp',
    to: String(to).replace(/[^0-9]/g, ''),
    type: 'text',
    text: { body: text },
  };

  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
  return data;
}

export async function sendTemplateMessage(to, templateName, parameters, lang = 'en') {
  if (!config.enabled) throw new Error('WhatsApp not configured');

  const body = {
    messaging_product: 'whatsapp',
    to: String(to).replace(/[^0-9]/g, ''),
    type: 'template',
    template: {
      name: templateName,
      language: { code: lang },
      components: [
        {
          type: 'body',
          parameters: parameters.map(p => ({ type: 'text', text: String(p) })),
        },
      ],
    },
  };

  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
  return data;
}

export async function sendReceiptMessage(to, donorName, amount, receiptNo, date) {
  const formattedAmount = typeof amount === 'number' ? '\u20B9' + amount.toLocaleString('en-IN') : amount;

  return sendTextMessage(to,
    `Thank you ${donorName} for your generous donation of ${formattedAmount}.\n` +
    `Receipt No: ${receiptNo}\n` +
    `Date: ${date}\n\n` +
    `Your contribution supports our mission. This receipt is valid for tax exemption under 80G.\n\n` +
    `- UFS`
  );
}

export async function sendDocumentMessage(to, documentUrl, caption, filename) {
  if (!config.enabled) throw new Error('WhatsApp not configured');

  const body = {
    messaging_product: 'whatsapp',
    to: String(to).replace(/[^0-9]/g, ''),
    type: 'document',
    document: {
      link: documentUrl,
      caption: caption || '',
      filename: filename || 'receipt.pdf',
    },
  };

  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
  return data;
}

export async function testConnection() {
  if (!config.enabled) return { success: false, message: 'WhatsApp not configured' };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}`,
      { headers: { Authorization: `Bearer ${config.accessToken}` } }
    );
    const data = await res.json();
    if (!res.ok) return { success: false, message: data.error?.message || 'Connection failed' };
    return { success: true, message: `Phone: ${data.display_phone_number || data.id || 'OK'}` };
  } catch (error) {
    return { success: false, message: error.message };
  }
}
