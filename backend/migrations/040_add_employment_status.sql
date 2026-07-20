ALTER TABLE workers ADD COLUMN IF NOT EXISTS employment_status text NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_workers_employment_status ON workers(employment_status);
