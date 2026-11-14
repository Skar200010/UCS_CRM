import db from '../config/db.js';

// Storage for the Meta (Facebook / Instagram) Lead Ads integration.
//
// Three concerns live here:
//   1. leads.*  — the extra provenance columns so a Meta lead can be told apart
//      from a WhatsApp reply and deduped by its Graph lead id.
//   2. meta_lead_forms — the form_id → NGO mapping the admin maintains. A form
//      with no NGO is still stored: the lead is ingested into the inbox and
//      shown as "unmapped" instead of being silently dropped.
//   3. meta_lead_events — one row per Graph lead id, so a webhook delivery and
//      the polling fallback can race without creating two leads.
//
// Plus the daily insight cache, which keeps the Marketing API out of the page
// load path (Meta's own numbers lag 24–48h and are rate-limited).
// Idempotent: re-applied on every boot.
export async function ensureMetaAdsSchema() {
  await db._pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta_lead_id TEXT`);
  await db._pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta_platform TEXT`);
  await db._pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta_campaign_id TEXT`);
  await db._pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta_campaign_name TEXT`);
  await db._pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta_form_id TEXT`);

  await db._pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_meta_lead_id
      ON leads (meta_lead_id)
      WHERE meta_lead_id IS NOT NULL
  `);
  await db._pool.query(`
    CREATE INDEX IF NOT EXISTS idx_leads_meta_inbox
      ON leads (created_at DESC)
      WHERE source = 'Meta Lead Ad'
  `);

  await db._pool.query(`
    CREATE TABLE IF NOT EXISTS meta_lead_forms (
      form_id TEXT PRIMARY KEY,
      form_name TEXT,
      page_id TEXT,
      ngo TEXT,
      account TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db._pool.query(`CREATE INDEX IF NOT EXISTS idx_meta_lead_forms_ngo ON meta_lead_forms(ngo)`);

  await db._pool.query(`
    CREATE TABLE IF NOT EXISTS meta_lead_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      meta_lead_id TEXT NOT NULL UNIQUE,
      form_id TEXT,
      page_id TEXT,
      platform TEXT,
      campaign_id TEXT,
      campaign_name TEXT,
      ad_id TEXT,
      adset_id TEXT,
      payload JSONB,
      status TEXT NOT NULL DEFAULT 'received',
      error TEXT,
      lead_id TEXT,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMPTZ
    )
  `);
  await db._pool.query(`ALTER TABLE meta_lead_events ALTER COLUMN lead_id TYPE TEXT`);
  await db._pool.query(`CREATE INDEX IF NOT EXISTS idx_meta_lead_events_status ON meta_lead_events(status)`);

  await db._pool.query(`
    CREATE TABLE IF NOT EXISTS meta_campaign_insights_daily (
      campaign_id TEXT NOT NULL,
      date_start DATE NOT NULL,
      campaign_name TEXT,
      objective TEXT,
      spend NUMERIC(14, 2) NOT NULL DEFAULT 0,
      impressions BIGINT NOT NULL DEFAULT 0,
      clicks BIGINT NOT NULL DEFAULT 0,
      reach BIGINT NOT NULL DEFAULT 0,
      ctr NUMERIC(10, 4) NOT NULL DEFAULT 0,
      cpc NUMERIC(14, 4) NOT NULL DEFAULT 0,
      cpm NUMERIC(14, 4) NOT NULL DEFAULT 0,
      meta_leads INTEGER NOT NULL DEFAULT 0,
      crm_leads INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (campaign_id, date_start)
    )
  `);
  await db._pool.query(`
    CREATE INDEX IF NOT EXISTS idx_meta_insights_daily_date
      ON meta_campaign_insights_daily (date_start DESC)
  `);

  await db._pool.query(`
    CREATE TABLE IF NOT EXISTS meta_ads_sync_state (
      key TEXT PRIMARY KEY,
      last_run_at TIMESTAMPTZ,
      detail JSONB
    )
  `);
}

export default ensureMetaAdsSchema;
