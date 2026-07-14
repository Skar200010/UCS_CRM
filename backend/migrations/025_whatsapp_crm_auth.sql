-- Run ALL of this in your Supabase dashboard SQL editor (sqlbimnmhdvesudpxtbi project)

-- 1. Drop old role constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. Convert existing roles
UPDATE users SET role = 'admin' WHERE role IN ('hoadmin', 'super_admin', 'admin');
UPDATE users SET role = 'agent' WHERE role IN ('telecaller', 'hr', 'accounts', 'leads', 'recruiter', 'team_lead');
UPDATE users SET role = 'agent' WHERE role IS NULL OR role = '';

-- 3. Add new constraint for WhatsApp-only roles
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'agent', 'viewer'));

-- 4. Create trigger to auto-add public.users row when someone signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'viewer',
    true
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
