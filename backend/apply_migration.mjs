import supabase from './src/config/supabase.js';

const sql = `
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('hoadmin', 'hr', 'accounts', 'leads', 'recruiter', 'telecaller', 'team_lead', 'admin', 'agent', 'viewer', 'tenant_admin'));
`;

const { data, error } = await supabase.rpc('exec_sql', { sql });

if (error) {
  console.log('RPC failed:', error.message);
  // Try using raw query
  const { error: e2 } = await supabase.from('users').update({ role: 'agent' }).eq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Update attempt result:', e2?.message || 'no error from update');
} else {
  console.log('Migration applied successfully:', data);
}
