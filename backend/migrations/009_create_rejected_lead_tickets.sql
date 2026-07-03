CREATE TABLE IF NOT EXISTS rejected_lead_tickets (
  id SERIAL PRIMARY KEY,
  fro_donor_log_id TEXT NOT NULL,
  fro_worker_id TEXT,
  ngo_id TEXT,
  donor_name TEXT,
  amount NUMERIC,
  rejection_reason TEXT,
  status TEXT DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'acknowledged', 'resolved')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
