CREATE TABLE IF NOT EXISTS whatsapp_phone_numbers (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT,
  phone_number_id TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT,
  phone TEXT,
  phone_normalized TEXT,
  wa_profile_name TEXT,
  source TEXT DEFAULT 'whatsapp',
  project TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone_normalized);
CREATE INDEX IF NOT EXISTS idx_contacts_project ON contacts(project);

CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  phone_number_id INTEGER REFERENCES whatsapp_phone_numbers(id),
  status TEXT DEFAULT 'open',
  last_message_at TIMESTAMPTZ,
  last_inbound_at TIMESTAMPTZ,
  project TEXT,
  assigned_to TEXT,
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  contact_id INTEGER REFERENCES contacts(id),
  user_id TEXT,
  direction TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  body_text TEXT,
  wa_message_id TEXT,
  status TEXT DEFAULT 'queued',
  message_category TEXT,
  template_id TEXT,
  template_params JSONB,
  failure_reason TEXT,
  status_updated_at TIMESTAMPTZ,
  is_automated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_wa_id ON messages(wa_message_id);

CREATE TABLE IF NOT EXISTS whatsapp_webhook_logs (
  id SERIAL PRIMARY KEY,
  direction TEXT,
  event_type TEXT,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  account_project TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_processed ON whatsapp_webhook_logs(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_project ON whatsapp_webhook_logs(account_project);
