-- Event Head panel tables for UCS CRM Event Manager module

CREATE TABLE IF NOT EXISTS event_head_events (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  ngo_id TEXT,
  csr_partner TEXT,
  donor TEXT,
  date DATE,
  start_time TIME,
  end_time TIME,
  venue TEXT,
  gps_location TEXT,
  district TEXT,
  state TEXT,
  organizer TEXT,
  event_manager TEXT,
  coordinator TEXT,
  expected_beneficiaries INTEGER,
  budget NUMERIC(12,2),
  priority TEXT DEFAULT 'Medium',
  approval_status TEXT DEFAULT 'Draft',
  status TEXT DEFAULT 'Draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS event_head_assets (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  available_qty INTEGER,
  issued_qty INTEGER DEFAULT 0,
  damaged_qty INTEGER DEFAULT 0,
  purchase_cost NUMERIC(12,2),
  condition TEXT DEFAULT 'Good',
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_head_materials (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  opening_stock INTEGER DEFAULT 0,
  received INTEGER DEFAULT 0,
  issued INTEGER DEFAULT 0,
  balance INTEGER DEFAULT 0,
  cost NUMERIC(12,2),
  warehouse TEXT,
  donor TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_head_distributions (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES event_head_events(id) ON DELETE CASCADE,
  beneficiary_name TEXT NOT NULL,
  mobile TEXT,
  address TEXT,
  category TEXT,
  material_id INTEGER REFERENCES event_head_materials(id),
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_head_volunteers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  mobile TEXT,
  email TEXT,
  duty TEXT,
  attended BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_head_expenses (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES event_head_events(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount NUMERIC(12,2) DEFAULT 0,
  description TEXT,
  bill_attached BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_head_vehicles (
  id SERIAL PRIMARY KEY,
  vehicle_name TEXT NOT NULL,
  driver TEXT,
  fuel TEXT,
  kilometer_reading TEXT,
  assigned_event INTEGER REFERENCES event_head_events(id),
  status TEXT DEFAULT 'Assigned',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_head_media (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES event_head_events(id) ON DELETE CASCADE,
  name TEXT,
  url TEXT,
  type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_head_attendance (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES event_head_events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'Staff',
  status TEXT DEFAULT 'Present',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_head_checklist (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES event_head_events(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  status BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_head_partners (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  email TEXT,
  type TEXT DEFAULT 'CSR',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_head_donors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
