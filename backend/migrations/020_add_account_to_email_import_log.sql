ALTER TABLE email_import_log
  ADD COLUMN IF NOT EXISTS account_id INT,
  ADD COLUMN IF NOT EXISTS account_name TEXT;

CREATE INDEX IF NOT EXISTS idx_email_import_log_account_id
  ON email_import_log(account_id);
