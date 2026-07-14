CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  language VARCHAR(10) NOT NULL DEFAULT 'en',
  category VARCHAR(50) DEFAULT 'UTILITY',
  status VARCHAR(50) DEFAULT 'approved',
  meta_template_id VARCHAR(255),
  components JSONB DEFAULT '[]'::jsonb,
  project VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_accounts' AND column_name = 'tenant_id') THEN
    ALTER TABLE whatsapp_accounts ADD COLUMN tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL;
  END IF;
END $$;

INSERT INTO whatsapp_templates (tenant_id, name, language, project)
SELECT t.id, 'bsct_receipt', 'en', 'bsct'
FROM tenants t
WHERE t.name ILIKE '%being%sevak%' OR t.name ILIKE '%bsct%'
LIMIT 1;

ALTER TABLE whatsapp_accounts DROP COLUMN IF EXISTS template_name;
ALTER TABLE whatsapp_accounts DROP COLUMN IF EXISTS template_language;
