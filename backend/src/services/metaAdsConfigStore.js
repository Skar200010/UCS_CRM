import db from '../config/db.js';
import { getMetaConfig } from './metaAdsService.js';

// ---------------------------------------------------------------------------
// Meta Ads credentials, stored the same way WhatsApp accounts are: in the
// database, editable from the panel, with .env as the fallback.
//
// Why a store instead of reading the table inside getMetaConfig():
// every caller of getMetaConfig() is synchronous (isMetaAdsConfigured, the
// cron guards, the webhook signature check). Making it async would touch the
// whole lead-ingest path. So the DB values are copied into process.env once at
// boot and again whenever the panel saves — getMetaConfig() keeps reading
// process.env and never knows the difference.
//
// The verify token deliberately stays env-only: it is a value we publish into
// Meta's dashboard, not a credential the app needs to read back.
// ---------------------------------------------------------------------------

export const META_CONFIG_FIELDS = [
  'META_ADS_ACCESS_TOKEN',
  'META_ADS_APP_SECRET',
  'META_ADS_APP_ID',
  'META_ADS_AD_ACCOUNT_ID',
  'META_ADS_PAGE_ID',
  'META_ADS_API_VERSION',
];

// Values that must never be rendered in full by the API.
const SECRET_FIELDS = new Set(['META_ADS_ACCESS_TOKEN', 'META_ADS_APP_SECRET']);

const fieldKey = (envKey) => String(envKey).toLowerCase(); // settings.key

export function maskSecret(value) {
  const raw = String(value == null ? '' : value);
  if (!raw) return '';
  if (raw.length <= 8) return '•'.repeat(raw.length);
  return `${raw.slice(0, 4)}…${raw.slice(-4)}`;
}

function pickFields(input = {}) {
  const patch = {};
  for (const key of META_CONFIG_FIELDS) {
    if (input[key] === undefined) continue;
    const value = String(input[key] == null ? '' : input[key]).trim();
    patch[key] = value;
  }
  return patch;
}

export function applyMetaEnvPatch(patch = {}) {
  const applied = [];
  for (const [key, value] of Object.entries(pickFields(patch))) {
    if (value) {
      process.env[key] = value;
    } else {
      // Clearing a DB value must also clear the copy in memory, otherwise the
      // panel would say "cleared" while the running process kept using it.
      delete process.env[key];
    }
    applied.push(key);
  }
  return applied;
}

export async function persistMetaConfig(patch = {}) {
  const fields = pickFields(patch);
  for (const [key, value] of Object.entries(fields)) {
    if (value) {
      const { error } = await db
        .from('settings')
        .upsert({ key: fieldKey(key), value }, { onConflict: 'key' });
      if (error) throw error;
    } else {
      const { error } = await db.from('settings').delete().eq('key', fieldKey(key));
      if (error) throw error;
    }
  }
  return Object.keys(fields);
}

// Copy every stored value into process.env. Runs once during boot, before the
// lead poller starts, so a DB-only configuration is live without a .env edit.
export async function loadMetaConfigFromDb() {
  const { rows } = await db._pool.query(
    `select key, value from settings where key = any($1::text[])`,
    [META_CONFIG_FIELDS.map(fieldKey)],
  );

  const loaded = [];
  for (const row of rows) {
    const key = String(row.key || '').toUpperCase();
    if (!META_CONFIG_FIELDS.includes(key)) continue;
    const value = String(row.value == null ? '' : row.value).trim();
    if (!value) continue;
    // dotenv values win only when the DB has nothing: a credential pasted in
    // the panel is the more recent intent.
    process.env[key] = value;
    loaded.push(key);
  }
  return loaded;
}

// What the panel shows. Never returns a full secret: the stored value is
// masked, and `source` says where the effective value came from.
export async function getMetaConfigView() {
  const { rows } = await db._pool.query(
    `select key, value from settings where key = any($1::text[])`,
    [META_CONFIG_FIELDS.map(fieldKey)],
  );
  const stored = new Map(
    rows.map((r) => [String(r.key || '').toUpperCase(), String(r.value == null ? '' : r.value).trim()]),
  );

  const cfg = getMetaConfig();
  const effective = {
    META_ADS_ACCESS_TOKEN: cfg.accessToken,
    META_ADS_APP_SECRET: cfg.appSecret,
    META_ADS_APP_ID: cfg.appId,
    META_ADS_AD_ACCOUNT_ID: cfg.adAccountId,
    META_ADS_PAGE_ID: process.env.META_ADS_PAGE_ID || '',
    META_ADS_API_VERSION: cfg.apiVersion,
  };

  const fallbackKeys = {
    META_ADS_ACCESS_TOKEN: 'WHATSAPP_ACCESS_TOKEN',
    META_ADS_APP_SECRET: 'WHATSAPP_APP_SECRET',
    META_ADS_APP_ID: 'WHATSAPP_APP_ID',
    META_ADS_API_VERSION: 'WHATSAPP_API_VERSION',
  };

  const fields = {};
  for (const key of META_CONFIG_FIELDS) {
    const dbValue = stored.get(key) || '';
    const envValue = process.env[key] || '';
    const fallbackKey = fallbackKeys[key];
    const fallbackValue = fallbackKey ? (process.env[fallbackKey] || '') : '';
    const value = dbValue || envValue || fallbackValue || '';

    let source = 'missing';
    if (dbValue) source = 'database';
    else if (envValue) source = 'env';
    else if (fallbackValue) source = 'whatsapp_fallback';

    fields[key.toLowerCase()] = {
      key,
      source,
      set: Boolean(effective[key] || value),
      // Non-secret fields are shown as-is so the panel can be edited without
      // retyping; secrets are only ever a masked preview.
      value: SECRET_FIELDS.has(key) ? '' : value,
      masked: value ? (SECRET_FIELDS.has(key) ? maskSecret(value) : value) : '',
      env_fallback: fallbackKey && !dbValue && !envValue ? fallbackKey : null,
    };
  }

  return {
    fields,
    verify_token_in_env: Boolean(process.env.META_ADS_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN),
    editable: true,
  };
}
