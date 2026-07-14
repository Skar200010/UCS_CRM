-- Run this in your Supabase dashboard SQL editor
-- Step 0: Drop any existing trigger that might be failing on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 1: Drop old constraint + add new one with only WhatsApp roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE users SET role = 'admin' WHERE role IN ('hoadmin', 'super_admin', 'admin');
UPDATE users SET role = 'agent' WHERE role IN ('telecaller', 'hr', 'accounts', 'leads', 'recruiter', 'team_lead');
UPDATE users SET role = 'agent' WHERE role IS NULL OR role = '';
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'agent', 'viewer'));

-- Step 2: Create RPC so the frontend can read/insert users without direct table access
CREATE OR REPLACE FUNCTION get_whatsapp_user(p_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT row_to_json(u) INTO result FROM public.users u WHERE id = p_id;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION create_whatsapp_user(p_id uuid, p_email text, p_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  INSERT INTO public.users (id, email, name, role, is_active)
  VALUES (p_id, p_email, p_name, 'agent', true)
  ON CONFLICT (id) DO UPDATE SET email = p_email, name = p_name
  RETURNING row_to_json(users) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION promote_to_admin(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users SET role = 'admin' WHERE id = p_id AND role IN ('agent', 'viewer');
END;
$$;

CREATE OR REPLACE FUNCTION search_whatsapp_users(p_query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(u)) INTO result FROM (
    SELECT id, email, name FROM public.users
    WHERE email ILIKE '%' || p_query || '%' OR name ILIKE '%' || p_query || '%'
    ORDER BY created_at DESC LIMIT 10
  ) u;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION list_whatsapp_users()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(u)) INTO result FROM (
    SELECT id, email, name, role, is_active, created_at FROM public.users ORDER BY created_at DESC
  ) u;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Step 3: Grant execute permission to the anon role (needed by frontend)
GRANT EXECUTE ON FUNCTION get_whatsapp_user(uuid) TO anon;
GRANT EXECUTE ON FUNCTION create_whatsapp_user(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION promote_to_admin(uuid) TO anon;
GRANT EXECUTE ON FUNCTION search_whatsapp_users(text) TO anon;
GRANT EXECUTE ON FUNCTION list_whatsapp_users() TO anon;
