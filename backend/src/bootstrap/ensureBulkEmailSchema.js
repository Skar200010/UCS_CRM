import db from '../config/db.js';

export async function ensureBulkEmailSchema() {
  await db._pool.query(`
    CREATE TABLE IF NOT EXISTS bulk_email_logs (
      id BIGSERIAL PRIMARY KEY,
      subject TEXT NOT NULL,
      body TEXT,
      source TEXT,
      total_recipients INT NOT NULL DEFAULT 0,
      sent_count INT NOT NULL DEFAULT 0,
      failed_count INT NOT NULL DEFAULT 0,
      recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db._pool.query(`CREATE INDEX IF NOT EXISTS idx_bulk_email_logs_created_at ON bulk_email_logs(created_at DESC);`);

  // Campaign queue/progress. A campaign row is inserted before sending starts so
  // a crash or restart cannot lose the record of who was meant to receive it.
  // `status` moves queued -> processing -> completed | partial | failed |
  // cancelled | interrupted. `recipients` is an array of
  // { email, name, ok: true|false|null, error } where null means not yet tried.
  await db._pool.query(`
    ALTER TABLE bulk_email_logs
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'queued',
      ADD COLUMN IF NOT EXISTS processed_count INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS html TEXT,
      ADD COLUMN IF NOT EXISTS attachment_name TEXT,
      ADD COLUMN IF NOT EXISTS attachment_type TEXT,
      ADD COLUMN IF NOT EXISTS attachment_data BYTEA,
      ADD COLUMN IF NOT EXISTS last_error TEXT,
      ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;
  `);

  await db._pool.query(`CREATE INDEX IF NOT EXISTS idx_bulk_email_logs_status ON bulk_email_logs(status);`);

  // Multiple attachments per campaign/template. Stored as one row per file so
  // large binaries never bloat the parent row and streaming stays cheap.
  await db._pool.query(`
    CREATE TABLE IF NOT EXISTS bulk_email_attachments (
      id BIGSERIAL PRIMARY KEY,
      owner_type TEXT NOT NULL,
      owner_id BIGINT NOT NULL,
      filename TEXT NOT NULL,
      content_type TEXT,
      data BYTEA NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db._pool.query(`CREATE INDEX IF NOT EXISTS idx_bulk_email_attachments_owner ON bulk_email_attachments(owner_type, owner_id);`);

  // One-time migration of the old single-attachment columns into the new table.
  await db._pool.query(`
    INSERT INTO bulk_email_attachments (owner_type, owner_id, filename, content_type, data, sort_order)
    SELECT 'campaign', l.id, COALESCE(l.attachment_name, 'attachment'),
           COALESCE(l.attachment_type, 'application/octet-stream'), l.attachment_data, 0
      FROM bulk_email_logs l
     WHERE l.attachment_data IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM bulk_email_attachments a
          WHERE a.owner_type = 'campaign' AND a.owner_id = l.id
       );
  `);
  await db._pool.query(`
    INSERT INTO bulk_email_attachments (owner_type, owner_id, filename, content_type, data, sort_order)
    SELECT 'template', t.id, COALESCE(t.attachment_name, 'attachment'),
           COALESCE(t.attachment_type, 'application/octet-stream'), t.attachment_data, 0
      FROM bulk_email_templates t
     WHERE t.attachment_data IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM bulk_email_attachments a
          WHERE a.owner_type = 'template' AND a.owner_id = t.id
       );
  `);

  // Backfill status for campaigns that were sent before this column existed so
  // old history does not show up as "queued" and offer a pointless Resume.
  await db._pool.query(`
    UPDATE bulk_email_logs
       SET status = CASE
         WHEN sent_count > 0 AND failed_count > 0 THEN 'partial'
         WHEN sent_count > 0 THEN 'completed'
         WHEN failed_count > 0 THEN 'failed'
         ELSE 'completed'
       END
     WHERE status = 'queued'
       AND (sent_count > 0 OR failed_count > 0);
  `);

  await db._pool.query(`
    CREATE TABLE IF NOT EXISTS bulk_email_templates (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db._pool.query(`
    ALTER TABLE bulk_email_templates
      ADD COLUMN IF NOT EXISTS attachment_name TEXT,
      ADD COLUMN IF NOT EXISTS attachment_type TEXT,
      ADD COLUMN IF NOT EXISTS attachment_data BYTEA,
      ADD COLUMN IF NOT EXISTS design JSONB,
      ADD COLUMN IF NOT EXISTS html TEXT;
  `);

  await db._pool.query(`
    CREATE TABLE IF NOT EXISTS bulk_email_unsubscribes (
      email TEXT PRIMARY KEY,
      source TEXT,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db._pool.query(`
    INSERT INTO bulk_email_templates (name, subject, body, created_by)
    VALUES
      ('Donation Thank You', 'Thank you for your generous support',
       'Dear {{name}},' || E'\n\n' || 'Thank you for your generous support to Being Sevak. Your contribution helps us continue our work for the community.' || E'\n\n' || 'With gratitude,' || E'\n' || 'Team Being Sevak',
       'system'),
      ('Event Invitation', 'You are invited to our upcoming event',
       'Dear {{name}},' || E'\n\n' || 'We would be delighted to have you join us at our upcoming event. Your presence will make the occasion even more special.' || E'\n\n' || 'Warm regards,' || E'\n' || 'Team Being Sevak',
       'system'),
      ('General Update', 'An update from Being Sevak',
       'Dear {{name}},' || E'\n\n' || 'We wanted to share a quick update with you about our recent activities and the impact we are creating together.' || E'\n\n' || 'Thank you for being part of this journey.' || E'\n\n' || 'Team Being Sevak',
       'system'),
      ('Festival Greeting', 'Warm wishes from Being Sevak',
       'Dear {{name}},' || E'\n\n' || 'Wishing you and your family health, happiness and prosperity. Thank you for your continued support.' || E'\n\n' || 'Warm wishes,' || E'\n' || 'Team Being Sevak',
       'system')
    ON CONFLICT (name) DO NOTHING;
  `);
}

export default ensureBulkEmailSchema;
