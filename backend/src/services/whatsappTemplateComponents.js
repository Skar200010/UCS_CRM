import db from '../config/db.js';
import whatsappConfig from '../config/whatsappConfig.js';

export function templateComponentOf(components, type) {
  return (components || []).find((c) => String(c?.type || '').toUpperCase() === type) || null;
}

// Bulk send resolves the template once per recipient, so without a cache a
// template that is not in whatsapp_templates would hit Meta once per phone.
const templateComponentsCache = new Map();
const TEMPLATE_COMPONENTS_TTL_MS = 5 * 60 * 1000;

/** Names for a named-parameter template, in placeholder order. */
export function templateParameterNames(components) {
  const text = templateComponentOf(components, 'BODY')?.text || '';
  const names = [...new Set(
    [...text.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)]
      .map((match) => match[1])
      .filter((key) => !/^\d+$/.test(key)),
  )];
  return names.length ? names : null;
}

/** Fill a template's BODY text with the parameters actually sent. */
export function renderTemplateBody(components, parameters) {
  const text = templateComponentOf(components, 'BODY')?.text || '';
  if (!text) return null;
  const params = Array.isArray(parameters) ? parameters : [];
  const named = [...new Set(
    [...text.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)]
      .map((match) => match[1])
      .filter((key) => !/^\d+$/.test(key)),
  )];
  return text.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (token, key) => {
    const index = /^\d+$/.test(key) ? Number(key) - 1 : named.indexOf(key);
    const value = params[index];
    if (value === undefined || value === null || String(value).trim() === '') return token;
    return String(value);
  });
}

/**
 * Resolve a template's components for the send payload.
 *
 * Cache first, then Meta, then the local mirror. Meta has to win over the
 * mirror: `whatsapp_templates.components` stores only each component's
 * type/format/text, so it loses `example.header_handle`. Sending from that
 * stale copy made media-header templates go out with no header component at
 * all (Meta: 132012 "Format mismatch, expected IMAGE, received UNKNOWN").
 */
export async function resolveTemplateComponentsForSend(account, templateName, templateLang, { forceMeta = false } = {}) {
  const lang = String(templateLang || '').trim();
  const cacheKey = `${account?.waba_id || account?.id || 'default'}:${templateName}:${lang}`;
  if (!forceMeta) {
    const cached = templateComponentsCache.get(cacheKey);
    if (cached && (Date.now() - cached.at) < TEMPLATE_COMPONENTS_TTL_MS) return cached.components;
  }

  if (account?.waba_id && account?.access_token) {
    try {
      const url = `https://graph.facebook.com/${whatsappConfig.apiVersion}/${account.waba_id}/message_templates`
        + `?name=${encodeURIComponent(templateName)}&fields=name,language,components`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${account.access_token}` } });
      const json = await response.json();
      if (response.ok) {
        const rows = Array.isArray(json?.data) ? json.data : [];
        const exact = rows.find((r) => !lang || r.language === lang) || rows[0];
        const components = Array.isArray(exact?.components) ? exact.components : [];
        if (components.length) {
          templateComponentsCache.set(cacheKey, { at: Date.now(), components });
          return components;
        }
      }
    } catch { /* fall through to the local mirror */ }
  }

  try {
    let query = db
      .from('whatsapp_templates')
      .select('name,language,components,project,updated_at')
      .eq('name', templateName);
    if (account?.project) query = query.eq('project', account.project);
    const { data } = await query.order('updated_at', { ascending: false }).limit(10);
    const rows = Array.isArray(data) ? data : [];
    const exact = rows.find((r) => !lang || String(r.language || '') === lang) || rows[0];
    if (Array.isArray(exact?.components) && exact.components.length) {
      templateComponentsCache.set(cacheKey, { at: Date.now(), components: exact.components });
      return exact.components;
    }
  } catch { /* no mirror either */ }

  return [];
}
