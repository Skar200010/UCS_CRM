CREATE TABLE IF NOT EXISTS email_import_accounts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  imap_host TEXT DEFAULT 'imap.gmail.com',
  imap_port INT DEFAULT 993,
  app_password TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_polled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_import_accounts_active ON email_import_accounts(is_active);
