ALTER TABLE fro_donor_logs
ADD COLUMN IF NOT EXISTS upi_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS transaction_datetime TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_from TEXT;
