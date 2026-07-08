ALTER TABLE bank_audit_entries ADD COLUMN IF NOT EXISTS assigned_to_ngo_admin BOOLEAN DEFAULT false;
ALTER TABLE bank_audit_entries ADD COLUMN IF NOT EXISTS assigned_to_fro_id UUID REFERENCES workers(id);
ALTER TABLE bank_audit_entries ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE bank_audit_entries ADD COLUMN IF NOT EXISTS screenshot_url TEXT;
ALTER TABLE bank_audit_entries ADD COLUMN IF NOT EXISTS donor_details TEXT;
ALTER TABLE bank_audit_entries ADD COLUMN IF NOT EXISTS ngo_admin_notes TEXT;