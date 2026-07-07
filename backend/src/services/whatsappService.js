import config from '../config/whatsappConfig.js';

const API_BASE = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;

async function sendViaSupabase(to, messageText) {
  const body = {
    conversationId: String(to).replace(/[^0-9]/g, ''),
    messageText,
  };

  const res = await fetch(config.supabaseFunctionUrl, {
    method: 'POST',
    headers: {
      'x-api-key': config.supabaseApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
  return data;
}

export async function sendTextMessage(to, text) {
  if (!config.enabled) throw new Error('WhatsApp not configured');

  if (config.supabaseFunctionUrl && config.supabaseApiKey) {
    return sendViaSupabase(to, text);
  }

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

  if (config.supabaseFunctionUrl && config.supabaseApiKey) {
    const paramsStr = parameters.map((p, i) => `{{${i + 1}}}`).join(', ');
    const messageText = `Template: ${templateName} | Params: ${paramsStr} | Values: ${parameters.join(', ')}`;
    return sendViaSupabase(to, messageText);
  }

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
  const messageText = `Receipt: ${receiptNo}\nDonor: ${donorName}\nAmount: ${formattedAmount}\nDate: ${date}`;

  if (config.supabaseFunctionUrl && config.supabaseApiKey) {
    return sendViaSupabase(to, messageText);
  }

  return sendTemplateMessage(to, config.receiptTemplate, [
    donorName,
    formattedAmount,
    receiptNo,
    date,
  ]);
}

export async function sendNgoInfoTemplate(to, name) {
  const ngoName = 'Being Sevak Charitable Trust';
  const num1 = '8879035035';
  const num2 = '8879034034';
  const email = 'being.sevak@gmail.com';
  const messageText = `NGO: ${ngoName}\nDonor: ${name}\nContact: ${num1}, ${num2}\nEmail: ${email}`;

  if (config.supabaseFunctionUrl && config.supabaseApiKey) {
    return sendViaSupabase(to, messageText);
  }

  return sendTemplateMessage(to, 'ngo_information', [
    ngoName,
    name,
    ngoName,
    num1,
    num2,
    email,
  ]);
}

export async function sendDocumentMessage(to, documentUrl, caption, filename) {
  if (!config.enabled) throw new Error('WhatsApp not configured');

  if (config.supabaseFunctionUrl && config.supabaseApiKey) {
    const messageText = `${caption}\n\nDocument: ${documentUrl}`;
    return sendViaSupabase(to, messageText);
  }

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

  if (config.supabaseFunctionUrl && config.supabaseApiKey) {
    try {
      const res = await fetch(config.supabaseFunctionUrl, {
        method: 'POST',
        headers: {
          'x-api-key': config.supabaseApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conversationId: 'test', messageText: 'test' }),
      });
      if (res.ok) return { success: true, message: 'Supabase WhatsApp function reachable' };
      const data = await res.json();
      return { success: false, message: data.error?.message || 'Connection failed' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

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