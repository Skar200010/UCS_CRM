import supabase from '../config/supabase.js';

export const createDonorLog = async (data) => {
  const { data: result, error } = await supabase
    .from('fro_donor_logs')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
};

export const findLogsByAssignment = async (assignmentId) => {
  const { data, error } = await supabase
    .from('fro_donor_logs')
    .select('*')
    .eq('assignment_id', assignmentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const getTotalCollectedByWorker = async (workerId, monthStart, monthEnd) => {
  const { data, error } = await supabase
    .from('fro_donor_logs')
    .select('amount_collected, fro_assignments!inner(fro_worker_id)')
    .eq('fro_assignments.fro_worker_id', workerId)
    .or(
      `and(action.eq.donation,created_at.gte.${monthStart},created_at.lte.${monthEnd}),` +
      `and(disposition_detail.eq.lead_done,action.eq.disposition,accounts_status.eq.verified,verified_at.gte.${monthStart},verified_at.lte.${monthEnd})`
    );
  if (error) throw error;

  let total = 0;
  for (const d of data) {
    total += parseFloat(d.amount_collected || 0);
  }
  return total;
};

export const findLogsByDonorAndWorker = async (donorId, workerId) => {
  const { data, error } = await supabase
    .from('fro_donor_logs')
    .select('*')
    .eq('donor_id', donorId)
    .eq('fro_worker_id', workerId)
    .order('created_at', { ascending: false });
  if (error) {
    // fallback to assignment-based lookup
    const { data: assignment } = await supabase
      .from('fro_assignments')
      .select('id')
      .eq('donor_id', donorId)
      .eq('fro_worker_id', workerId)
      .not('status', 'eq', 'reassigned')
      .maybeSingle();
    if (assignment) {
      return findLogsByAssignment(assignment.id);
    }
    return [];
  }
  return data || [];
};

export const getTotalCollectedByDonorAndWorker = async (donorId, workerId) => {
  const { data, error } = await supabase
    .from('fro_donor_logs')
    .select('amount_collected')
    .eq('donor_id', donorId)
    .eq('fro_worker_id', workerId)
    .or('action.eq.donation,and(disposition_detail.eq.lead_done,action.eq.disposition,accounts_status.eq.verified)');
  if (error) {
    const { data: assignment } = await supabase
      .from('fro_assignments')
      .select('id')
      .eq('donor_id', donorId)
      .eq('fro_worker_id', workerId)
      .not('status', 'eq', 'reassigned')
      .maybeSingle();
    if (assignment) {
      return getTotalCollectedByAssignment(assignment.id);
    }
    return 0;
  }
  let total = 0;
  for (const d of data || []) {
    total += parseFloat(d.amount_collected || 0);
  }
  return total;
};

export const getTotalCollectedByAssignment = async (assignmentId) => {
  const { data, error } = await supabase
    .from('fro_donor_logs')
    .select('amount_collected, action, disposition_detail')
    .eq('assignment_id', assignmentId)
    .or('action.eq.donation,and(disposition_detail.eq.lead_done,action.eq.disposition,accounts_status.eq.verified)');
  if (error) throw error;

  let total = 0;
  for (const d of data) {
    total += parseFloat(d.amount_collected || 0);
  }
  return total;
};
