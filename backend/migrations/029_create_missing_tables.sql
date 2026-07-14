-- Run this entire file in Supabase dashboard SQL editor
CREATE TABLE IF NOT EXISTS quick_replies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text,
  message_text text,
  media_url text,
  media_type text,
  label text DEFAULT 'general',
  category text DEFAULT 'info',
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media_library (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text,
  category text,
  label text,
  file_url text,
  file_type text,
  file_size integer,
  tenant_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text,
  key text DEFAULT encode(gen_random_bytes(24), 'hex'),
  permissions jsonb DEFAULT '{}',
  active boolean DEFAULT true,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Grant access to anon role
GRANT ALL ON quick_replies TO anon;
GRANT ALL ON media_library TO anon;
GRANT ALL ON api_keys TO anon;
