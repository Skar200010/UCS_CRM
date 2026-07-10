import config from '../config/whatsappConfig.js';
import { getAccountByProject } from '../models/whatsappAccountModel.js';

function getApiBase(account) {
  const id = account?.phoneNumberId || account?.phone_number_id || config.phoneNumberId;
  return `https://graph.facebook.com/${config.apiVersion}/${id}/messages`;
}

function getAccessToken(account) {
  return account?.accessToken || account?.access_token || config.accessToken;
}

function getWabaId(account) {
  return account?.wabaId || account?.waba_id || config.wabaId;
}

function getTemplateLanguage(account) {
  return account?.templateLanguage || account?.template_language || config.templateLanguage;
}

export async function resolveAccount(project) {
  if (project) {
    try {
      const account = await getAccountByProject(project);
      if (account) return account;
    } catch (err) {
      console.error(`Failed to resolve WhatsApp account for project "${project}":`, err.message);
    }
  }
  if (config.enabled) {
    return {
      phone_number_id: config.phoneNumberId,
      access_token: config.accessToken,
      waba_id: config.wabaId,
      template_name: config.receiptTemplate,
      template_language: config.templateLanguage,
      project: project || 'bsct',
    };
  }
  return null;
}

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

export async function sendTextMessage(to, text, account) {
  if (!config.enabled && !account) throw new Error('WhatsApp not configured');

  const resolved = account || await resolveAccount();
  if (!resolved) throw new Error('WhatsApp not configured');

  if (isSupabaseConfigured()) {
    try {
      return await sendViaSupabaseText(to, text);
    } catch (error) {
      console.error('Supabase text failed, falling back to Facebook API:', error.message);
    }
  }

  return sendViaFacebook(to, 'text', { text: { body: text } }, resolved);
}

export async function sendTemplateMessage(to, templateName, parameters, lang = 'en', account) {
  if (!config.enabled && !account) throw new Error('WhatsApp not configured');

  const resolved = account || await resolveAccount();
  if (!resolved) throw new Error('WhatsApp not configured');

  const tplLang = lang || getTemplateLanguage(resolved);

  if (isSupabaseConfigured()) {
    try {
      return await sendViaSupabaseTemplate(to, templateName, parameters, null, tplLang);
    } catch (error) {
      console.error('Supabase template failed, falling back to Facebook API:', error.message);
    }
  }

  return sendViaFacebook(to, 'template', {
    template: {
      name: templateName,
      language: { code: tplLang },
      components: [
        {
          type: 'body',
          parameters: parameters.map(p => ({ type: 'text', text: String(p) })),
        },
      ],
    },
  }, resolved);
}

export async function sendReceiptMessage(to, donorName, amount, receiptNo, date, headerMediaUrl, templateName, account) {
  const formattedAmount = typeof amount === 'number' ? '\u20B9' + amount.toLocaleString('en-IN') : amount;
  const params = [donorName, formattedAmount, receiptNo, date];

  const resolved = account || await resolveAccount();
  if (!resolved) throw new Error('WhatsApp not configured');

  const tpl = templateName || resolved.template_name || config.whatsappTemplateName || config.receiptTemplate;

  if (isSupabaseConfigured()) {
    try {
      return await sendViaSupabaseTemplate(to, tpl, params, headerMediaUrl);
    } catch (error) {
      console.error('Supabase receipt template failed, falling back to Facebook API:', error.message);
    }
  }

  const ngoMap = { bsct_receipt:'BeingSevak', mann_receipt:'MannCare', aflf_receipt:'Ashray' }
  const ngoPrefix = ngoMap[tpl] || 'Receipt'
  const safeName = String(donorName || 'Donor').replace(/[<>:"/\\|?*]/g, '_').trim()
  const fileName = `${ngoPrefix}_${safeName}_${receiptNo || 'receipt'}.pdf`

  const components = [];
  if (headerMediaUrl) {
    components.push({ type: 'header', parameters: [{ type: 'document', document: { link: headerMediaUrl, filename: fileName } }] });
  }
  components.push({
    type: 'body',
    parameters: params.map(p => ({ type: 'text', text: String(p) })),
  });

  return sendViaFacebook(to, 'template', {
    template: { name: tpl, language: { code: getTemplateLanguage(resolved) }, components },
  }, resolved);
}

export async function sendNgoInfoTemplate(to, name, account) {
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

  const resolved = account || await resolveAccount();
  if (!resolved) throw new Error('WhatsApp not configured');

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
  }, resolved);
}

export async function sendDocumentMessage(to, documentUrl, caption, filename, account) {
  if (!config.enabled && !account) throw new Error('WhatsApp not configured');

  const resolved = account || await resolveAccount();
  if (!resolved) throw new Error('WhatsApp not configured');

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
  }, resolved);
}

async function sendWithHeaderMedia(to, templateName, params, headerMediaUrl, account) {
  const resolved = account || await resolveAccount();
  if (!resolved) throw new Error('WhatsApp not configured');

  return sendViaFacebook(to, 'template', {
    template: {
      name: templateName,
      language: { code: getTemplateLanguage(resolved) },
      components: [
        {
          type: 'header',
          parameters: [{ type: 'document', document: { link: headerMediaUrl, filename: 'receipt.pdf' } }],
        },
        {
          type: 'body',
          parameters: params.map(p => ({ type: 'text', text: String(p) })),
        },
      ],
    },
  }, resolved);
}

async function sendViaFacebook(to, type, payload, account) {
  const body = {
    messaging_product: 'whatsapp',
    to: String(to).replace(/[^0-9]/g, ''),
    type,
    ...payload,
  };

  const apiBase = getApiBase(account);
  const token = getAccessToken(account);

  const res = await fetch(apiBase, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
  return data;
}

export async function testConnection(account) {
  const resolved = account || await resolveAccount();
  if (!resolved) return { success: false, message: 'WhatsApp not configured' };

  const apiBase = getApiBase(resolved);
  const token = getAccessToken(resolved);

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
    const phoneId = resolved.phone_number_id || resolved.phoneNumberId;
    const res = await fetch(
      `https://graph.facebook.com/${config.apiVersion}/${phoneId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!res.ok) return { success: false, message: data.error?.message || 'Connection failed' };
    return { success: true, message: `Phone: ${data.display_phone_number || data.id || 'OK'}` };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

export async function listTemplatesForAccount(account) {
  const wabaId = getWabaId(account);
  const token = getAccessToken(account);

  const tplRes = await fetch(
    `https://graph.facebook.com/${config.apiVersion}/${wabaId}/message_templates?fields=name,language,status`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!tplRes.ok) { const e = await tplRes.text(); throw new Error('Meta API: ' + e); }

  const { data } = await tplRes.json();
  return (data || []).filter(t => t.status === 'APPROVED').map(t => ({ name: t.name, language: t.language }));
}