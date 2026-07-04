ALTER TABLE bank_audit_entries ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'unverified';
UPDATE bank_audit_entries SET status = 'unverified' WHERE status IS NULL;
