CREATE TABLE IF NOT EXISTS bank_audit_sources (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_audit_entries (
  id SERIAL PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES bank_audit_sources(id) ON DELETE RESTRICT,
  amount DECIMAL(12,2) NOT NULL,
  payment_id TEXT,
  check_id TEXT,
  transaction_date DATE NOT NULL,
  remarks TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO bank_audit_sources (name, sort_order) VALUES
  ('GPay', 1),
  ('Razorpay', 2),
  ('Axis Bank', 3),
  ('Saraswat Bank', 4),
  ('Check', 5),
  ('Cash', 6)
ON CONFLICT (name) DO NOTHING;
