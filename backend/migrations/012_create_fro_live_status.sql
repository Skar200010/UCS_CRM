CREATE TABLE IF NOT EXISTS fro_live_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID UNIQUE REFERENCES workers(id),
  status TEXT NOT NULL DEFAULT 'offline'
    CHECK (status IN ('online', 'on_call', 'idle', 'offline')),
  current_donor_name TEXT,
  current_donor_id INT,
  call_started_at TIMESTAMPTZ,
  today_calls INT DEFAULT 0,
  today_talk_seconds INT DEFAULT 0,
  today_skipped INT DEFAULT 0,
  today_idle_seconds INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fro_live_status_worker_id ON fro_live_status(worker_id);
CREATE INDEX IF NOT EXISTS idx_fro_live_status_status ON fro_live_status(status);

ALTER TABLE fro_live_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FRO workers can update their own status"
  ON fro_live_status
  FOR ALL
  USING (worker_id = current_setting('app.current_worker_id')::UUID)
  WITH CHECK (worker_id = current_setting('app.current_worker_id')::UUID);

CREATE POLICY "Super admin and NGO admin can read all statuses"
  ON fro_live_status
  FOR SELECT
  USING (true);
