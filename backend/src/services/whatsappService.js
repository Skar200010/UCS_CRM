import config from '../config/whatsappConfig.js';

const API_BASE = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;

async function sendViaSupabaseTemplate(to, templateName, params, headerMediaUrl, lang) {
  const body = {
    phone: String(to).replace(/[^0-9]/g, ''),
    templateName,
    language: lang || config.templateLanguage,
  };
  if (params) body.params = params;
  if (headerMediaUrl) body.headerMediaUrl = headerMediaUrl;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  try {
    const res = await fetch(config.supabaseFunctionUrl, {
      method: 'POST',
      headers: {
        'x-api-key': config.supabaseApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
    return { source: 'supabase', data };
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('WhatsApp template function timed out after 55s');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function sendViaSupabaseText(to, messageText) {
  const body = {
    phone: String(to).replace(/[^0-9]/g, ''),
    messageText,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  try {
    const res = await fetch(config.supabaseFunctionUrlFallback, {
      method: 'POST',
      headers: {
        'x-api-key': config.supabaseApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
    return { source: 'supabase', data };
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('WhatsApp text function timed out after 55s');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function isSupabaseConfigured() {
  return !!(config.supabaseFunctionUrl && config.supabaseApiKey);
}

export async function sendTextMessage(to, text) {
  if (!config.enabled) throw new Error('WhatsApp not configured');

  if (isSupabaseConfigured()) {
    try {
      return await sendViaSupabaseText(to, text);
    } catch (error) {
      console.error('Supabase text failed, falling back to Facebook API:', error.message);
    }
  }

  return sendViaFacebook(to, 'text', { text: { body: text } });
}

export async function sendTemplateMessage(to, templateName, parameters, lang = 'en') {
  if (!config.enabled) throw new Error('WhatsApp not configured');

  if (isSupabaseConfigured()) {
    try {
      return await sendViaSupabaseTemplate(to, templateName, parameters, null, lang);
    } catch (error) {
      console.error('Supabase template failed, falling back to Facebook API:', error.message);
    }
  }

  return sendViaFacebook(to, 'template', {
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
  });
}

export async function sendReceiptMessage(to, donorName, amount, receiptNo, date, headerMediaUrl, templateName) {
  const formattedAmount = typeof amount === 'number' ? '\u20B9' + amount.toLocaleString('en-IN') : amount;
  const params = [donorName, formattedAmount, receiptNo, date];
  const tpl = templateName || config.whatsappTemplateName || config.receiptTemplate;

  if (isSupabaseConfigured()) {
    try {
      return await sendViaSupabaseTemplate(to, tpl, params, headerMediaUrl);
    } catch (error) {
      console.error('Supabase receipt template failed, falling back to Facebook API:', error.message);
    }
  }

  const components = [];
  if (headerMediaUrl) {
    components.push({ type: 'header', parameters: [{ type: 'document', document: { link: headerMediaUrl } }] });
  }
  components.push({
    type: 'body',
    parameters: params.map(p => ({ type: 'text', text: String(p) })),
  });

  return sendViaFacebook(to, 'template', {
    template: { name: tpl, language: { code: config.templateLanguage }, components },
  });
}

export async function sendNgoInfoTemplate(to, name) {
  const ngoName = 'Being Sevak Charitable Trust';
  const num1 = '8879035035';
  const num2 = '8879034034';
  const email = 'being.sevak@gmail.com';
  const params = [ngoName, name, ngoName, num1, num2, email];

  if (isSupabaseConfigured()) {
    try {
      return await sendViaSupabaseTemplate(to, 'ngo_information', params);
    } catch (error) {
      console.error('Supabase ngo template failed, falling back to Facebook API:', error.message);
    }
  }

  return sendViaFacebook(to, 'template', {
    template: {
      name: 'ngo_information',
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: params.map(p => ({ type: 'text', text: String(p) })),
        },
      ],
    },
  });
}

export async function sendDocumentMessage(to, documentUrl, caption, filename) {
  if (!config.enabled) throw new Error('WhatsApp not configured');

  const messageText = `${caption}\n\nDocument: ${documentUrl}`;
  if (isSupabaseConfigured()) {
    try {
      return await sendViaSupabaseText(to, messageText);
    } catch (error) {
      console.error('Supabase document failed, falling back to Facebook API:', error.message);
    }
  }

  return sendViaFacebook(to, 'document', {
    document: {
      link: documentUrl,
      caption: caption || '',
      filename: filename || 'receipt.pdf',
    },
  });
}

async function sendWithHeaderMedia(to, templateName, params, headerMediaUrl) {
  return sendViaFacebook(to, 'template', {
    template: {
      name: templateName,
      language: { code: config.templateLanguage },
      components: [
        {
          type: 'header',
          parameters: [{ type: 'document', document: { link: headerMediaUrl } }],
        },
        {
          type: 'body',
          parameters: params.map(p => ({ type: 'text', text: String(p) })),
        },
      ],
    },
  });
}

async function sendViaFacebook(to, type, payload) {
  const body = {
    messaging_product: 'whatsapp',
    to: String(to).replace(/[^0-9]/g, ''),
    type,
    ...payload,
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

  if (isSupabaseConfigured()) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(config.supabaseFunctionUrl, {
        method: 'POST',
        headers: {
          'x-api-key': config.supabaseApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: 'test', templateName: 'test', language: 'en' }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) return { success: true, message: 'Supabase template function reachable' };
      const data = await res.json();
      return { success: true, message: `Supabase function responded: ${data.error || 'OK'}` };
    } catch (error) {
      console.error('Supabase connection test failed, trying Facebook API:', error.message);
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