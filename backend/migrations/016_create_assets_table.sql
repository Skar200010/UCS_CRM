CREATE TABLE IF NOT EXISTS assets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT UNIQUE,
  name              TEXT NOT NULL,
  category          TEXT,
  brand             TEXT,
  model             TEXT,
  serial_no         TEXT,
  department        TEXT,
  condition         TEXT DEFAULT 'New',
  status            TEXT DEFAULT 'available',
  assigned_to       UUID,
  assigned_to_name  TEXT,
  assigned_date     DATE,
  purchase_date     DATE,
  purchase_price    NUMERIC DEFAULT 0,
  vendor            TEXT,
  warranty_expiry   DATE,
  sim_number        TEXT,
  sim_operator      TEXT,
  sim_plan          NUMERIC,
  repair_shop       TEXT,
  repair_cost       NUMERIC,
  repair_date       DATE,
  total_repair_cost NUMERIC DEFAULT 0,
  remarks           TEXT,
  history           JSONB DEFAULT '[]'::JSONB,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);
CREATE INDEX IF NOT EXISTS idx_assets_department ON assets(department);
