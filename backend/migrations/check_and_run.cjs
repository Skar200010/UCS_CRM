const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://sqlbimnmhdvesudpxtbi.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxbGJpbW5taGR2ZXN1ZHB4dGJpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk4MDg1MywiZXhwIjoyMDk2NTU2ODUzfQ.-1blwyk_qxNEfnRceBzvd1m3oTq9t-4ueHtanMsSS4U';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function run() {
  // Try to call a custom function if it exists
  const { data: funcs, error: funcErr } = await supabase.rpc('exec_sql', {
    query_text: 'SELECT 1'
  }).maybeSingle();

  if (funcErr) {
    console.log('exec_sql RPC not available:', funcErr.message);
  } else {
    console.log('exec_sql RPC available, result:', funcs);
  }

  // Try to query the constraint via a direct table query
  // We can check by looking at the pg_constraint table via a custom approach
  console.log('SUPABASE_URL:', SUPABASE_URL);
  console.log('Service key available:', !!SERVICE_KEY);

  // Try using raw REST API with service key to call admin functions
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      }
    });
    console.log('REST API root status:', res.status);
  } catch (e) {
    console.log('REST API error:', e.message);
  }
}

run().catch(console.error);
