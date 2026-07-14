-- Run this in your Supabase dashboard SQL editor
-- Step 1: Drop old constraint first
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Step 2: Update old roles to new WhatsApp roles
UPDATE users SET role = 'admin' WHERE role IN ('hoadmin', 'super_admin');
UPDATE users SET role = 'agent' WHERE role IN ('telecaller', 'hr', 'accounts', 'leads', 'recruiter', 'team_lead');
UPDATE users SET role = 'agent' WHERE role IS NULL OR role = '';

-- Step 3: Add new constraint with only WhatsApp roles
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'agent', 'viewer'));
