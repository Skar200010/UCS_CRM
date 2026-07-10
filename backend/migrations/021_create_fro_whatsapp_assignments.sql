CREATE TABLE IF NOT EXISTS fro_whatsapp_assignments (
  id SERIAL PRIMARY KEY,
  fro_worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  whatsapp_account_id INTEGER NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fro_worker_id, whatsapp_account_id)
);

CREATE INDEX IF NOT EXISTS idx_fro_wa_assignments_fro ON fro_whatsapp_assignments(fro_worker_id);
CREATE INDEX IF NOT EXISTS idx_fro_wa_assignments_account ON fro_whatsapp_assignments(whatsapp_account_id);
