import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getIntNgoId(froWorkerId, assignment, station) {
  // Try worker: lookup integer ngo_id via worker_ngo_allocations
  if (froWorkerId) {
    const { data: alloc } = await supabase
      .from('worker_ngo_allocations')
      .select('ngo_id')
      .eq('worker_id', froWorkerId)
      .not('ngo_id', 'is', null)
      .limit(1)
      .maybeSingle();
    if (alloc?.ngo_id) return alloc.ngo_id;
  }
  // Try assignment's ngo_id (might be integer if stored correctly)
  if (assignment?.ngo_id && typeof assignment.ngo_id === 'number') {
    return assignment.ngo_id;
  }
  // Try station lookup
  if (station) {
    const { data: sa } = await supabase
      .from('fro_station_assignments')
      .select('ngo_id')
      .eq('station', station)
      .not('ngo_id', 'is', null)
      .limit(1)
      .maybeSingle();
    if (sa?.ngo_id) return sa.ngo_id;
  }
  return null;
}

async function backfill() {
  console.log('Fetching rejected fro_donor_logs...');

  const { data: logs, error } = await supabase
    .from('fro_donor_logs')
    .select('*, fro_assignments!inner(id, fro_worker_id, donor_id, ngo_id, station, donor_profiles!inner(id, name))')
    .eq('action', 'disposition')
    .eq('disposition_detail', 'lead_done')
    .eq('accounts_status', 'rejected');

  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }

  console.log(`Found ${logs.length} rejected logs`);

  const logIds = logs.map(l => l.id);
  const { data: existing } = await supabase
    .from('rejected_lead_tickets')
    .select('fro_donor_log_id')
    .in('fro_donor_log_id', logIds);

  const existingSet = new Set((existing || []).map(t => String(t.fro_donor_log_id)));
  const toInsert = logs.filter(l => !existingSet.has(String(l.id)));

  console.log(`${toInsert.length} need backfill`);

  let created = 0;
  let failed = 0;

  for (const log of toInsert) {
    const froWorkerId = log.fro_assignments?.fro_worker_id;
    const donorName = log.fro_assignments?.donor_profiles?.name || 'Unknown';
    const assignment = log.fro_assignments;
    const station = assignment?.station;

    const ngoId = await getIntNgoId(froWorkerId, assignment, station);

    const payload = {
      fro_donor_log_id: String(log.id),
      fro_worker_id: froWorkerId || null,
      ngo_id: ngoId,
      donor_name: donorName,
      amount: log.amount_collected || 0,
      rejection_reason: log.rejection_reason || log.notes || '',
      status: 'pending_review',
    };

    const { error: insertErr } = await supabase.from('rejected_lead_tickets').insert(payload);
    if (insertErr) {
      console.error(`  Failed log ${log.id} (${donorName}): ${insertErr.message}`);
      failed++;
      continue;
    }
    created++;

    // Create notification_log entry for the FRO (so bell shows it)
    if (froWorkerId) {
      try {
        const notifBody = `Your lead for ${donorName} (₹${log.amount_collected || 0}) was rejected. Reason: ${log.rejection_reason || log.notes || ''}`;
        await supabase.from('notification_log').insert({
          worker_id: froWorkerId,
          type: 'lead_rejected',
          title: 'Lead Rejected by Accounts',
          body: notifBody,
          reference_id: log.id ? parseInt(log.id) : null,
          sent_at: new Date().toISOString(),
        });
      } catch (e) { console.error(`  Failed to create notif for log ${log.id}: ${e.message}`); }
    }

    // Create alert for NGO admin
    if (ngoId) {
      try {
        await supabase.from('alerts').insert({
          ngo_id: ngoId,
          type: 'lead_rejected',
          title: 'Lead Rejected',
          description: `${donorName} (₹${log.amount_collected || 0}) lead rejected. Reason: ${log.rejection_reason || log.notes || ''}`,
          donor_name: donorName,
          reference_id: log.id ? parseInt(log.id) : null,
        });
      } catch (e) { console.error(`  Failed to create alert for log ${log.id}: ${e.message}`); }
    }
  }

  console.log(`Done: ${created} created, ${failed} failed`);
  process.exit(0);
}

backfill();
