-- Drop old SERIAL-based chat tables (order matters due to FKs)
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.contacts CASCADE;
DROP TABLE IF EXISTS public.whatsapp_phone_numbers CASCADE;
DROP TABLE IF EXISTS public.whatsapp_webhook_logs CASCADE;

-- Recreate with UUID PKs matching WhatsApp project schema
CREATE TABLE public.whatsapp_phone_numbers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id text,
  phone_number_id text NOT NULL,
  is_primary boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT whatsapp_phone_numbers_pkey PRIMARY KEY (id)
);

CREATE TABLE public.contacts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id text,
  phone text,
  phone_normalized text,
  wa_profile_name text,
  source text DEFAULT 'whatsapp',
  project text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT contacts_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(phone_normalized);
CREATE INDEX IF NOT EXISTS idx_contacts_project ON public.contacts(project);

CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id text,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  phone_number_id uuid REFERENCES public.whatsapp_phone_numbers(id),
  status text DEFAULT 'open',
  last_message_at timestamp with time zone,
  last_inbound_at timestamp with time zone,
  project text,
  assigned_to text,
  unread_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_contact ON public.conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_project ON public.conversations(project);

CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id text,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id),
  user_id text,
  direction text NOT NULL,
  message_type text DEFAULT 'text',
  body_text text,
  wa_message_id text,
  status text DEFAULT 'queued',
  message_category text,
  template_id text,
  template_params jsonb,
  failure_reason text,
  status_updated_at timestamp with time zone,
  is_automated boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_wa_id ON public.messages(wa_message_id);

CREATE TABLE public.whatsapp_webhook_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  direction text,
  event_type text,
  payload jsonb,
  processed boolean DEFAULT false,
  processed_at timestamp with time zone,
  account_project text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT whatsapp_webhook_logs_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_processed ON public.whatsapp_webhook_logs(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_project ON public.whatsapp_webhook_logs(account_project);
