-- Add missing columns for onboarding data to workers table
-- bank_name may already exist from editWorker usage; using IF NOT EXISTS for safety
ALTER TABLE workers ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS correspondence_address TEXT;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS correspondence_city TEXT;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS correspondence_state TEXT;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS correspondence_pincode TEXT;

-- Add missing columns to worker_education table
ALTER TABLE worker_education ADD COLUMN IF NOT EXISTS from_year INTEGER;
ALTER TABLE worker_education ADD COLUMN IF NOT EXISTS to_year INTEGER;
