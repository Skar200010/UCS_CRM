import supabase from './src/config/supabase.js';

const { data, error } = await supabase.rpc('exec_sql', {
  sql: `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'users_role_check'`
});

if (error) {
  // Try direct query
  const { data: d2, error: e2 } = await supabase
    .from('users')
    .select('role')
    .limit(1);
  console.log('Sample roles from existing users:', d2);
  console.log('Error:', e2?.message || 'none');

  // Try to get constraint via information_schema
  const { data: d3, error: e3 } = await supabase
    .rpc('exec_sql', { query: "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'users'::regclass AND contype = 'c'" });
  console.log('Constraint error:', e3?.message || 'none', d3);
} else {
  console.log('Constraint:', data);
}
