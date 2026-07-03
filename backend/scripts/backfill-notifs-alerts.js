import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  const { data: tickets } = await supabase.from('rejected_lead_tickets').select('*');
  console.log('Total tickets:', tickets?.length);

  let notifCount = 0;
  let alertCount = 0;

  for (const t of tickets || []) {
    if (t.fro_worker_id) {
      const body = `Your lead for ${t.donor_name} (₹${t.amount || 0}) was rejected. Reason: ${t.rejection_reason}`;
      const { error } = await supabase.from('notification_log').insert({
        worker_id: t.fro_worker_id,
        type: 'lead_rejected',
        title: 'Lead Rejected by Accounts',
        body,
        sent_at: new Date().toISOString(),
      });
      if (!error) notifCount++;
      else console.log('Notif error for', t.donor_name, ':', error.message);
    }

    if (t.ngo_id) {
      const desc = `${t.donor_name} (₹${t.amount || 0}) lead rejected. Reason: ${t.rejection_reason}`;
      const { error } = await supabase.from('alerts').insert({
        ngo_id: t.ngo_id,
        type: 'lead_rejected',
        title: 'Lead Rejected',
        description: desc,
        donor_name: t.donor_name,
        reference_id: parseInt(t.fro_donor_log_id),
      });
      if (!error) alertCount++;
      else console.log('Alert error for', t.donor_name, ':', error.message);
    }
  }

  console.log('Created:', notifCount, 'notifications,', alertCount, 'alerts');
  process.exit(0);
}

main();
