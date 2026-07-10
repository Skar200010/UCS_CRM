CREATE TABLE IF NOT EXISTS whatsapp_accounts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  project TEXT NOT NULL UNIQUE,
  phone_number_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  waba_id TEXT NOT NULL,
  template_name TEXT,
  template_language TEXT DEFAULT 'en',
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_project ON whatsapp_accounts(project);
CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_active ON whatsapp_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_default ON whatsapp_accounts(is_default);
