import db from '../config/db.js';

export async function ensureCampaignSchema() {
  await db._pool.query(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'whatsapp',
      status TEXT NOT NULL DEFAULT 'completed',
      account_id TEXT,
      template_name TEXT,
      created_by TEXT,
      scheduled_at TIMESTAMPTZ,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await db._pool.query(`ALTER TABLE whatsapp_bulk_recipients ADD COLUMN IF NOT EXISTS campaign_id UUID;`);
  await db._pool.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_bulk_recipients_campaign_id ON whatsapp_bulk_recipients(campaign_id);`);

  // Background WhatsApp campaigns: the full recipient queue lives on the
  // campaign row so a browser refresh (or a server restart) can pick up where
  // the send loop left off instead of clearing the campaign.
  await db._pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS recipients JSONB DEFAULT '[]'::jsonb;`);
  await db._pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS template_lang TEXT;`);
  await db._pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS header_image_url TEXT;`);
  await db._pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS header_format TEXT;`);
  await db._pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS parameter_names JSONB;`);
  await db._pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS total_count INTEGER NOT NULL DEFAULT 0;`);
  await db._pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS sent_count INTEGER NOT NULL DEFAULT 0;`);
  await db._pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS failed_count INTEGER NOT NULL DEFAULT 0;`);
  await db._pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS unknown_count INTEGER NOT NULL DEFAULT 0;`);
  await db._pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS processed_count INTEGER NOT NULL DEFAULT 0;`);
  await db._pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS batch_size INTEGER NOT NULL DEFAULT 5;`);
  await db._pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS last_error TEXT;`);
  await db._pool.query(`CREATE INDEX IF NOT EXISTS idx_campaigns_channel_status ON campaigns(channel, status);`);
}

export default ensureCampaignSchema;