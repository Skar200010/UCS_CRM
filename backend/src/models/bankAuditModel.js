import supabase from '../config/supabase.js';

export const getSources = async () => {
  const { data, error } = await supabase
    .from('bank_audit_sources')
    .select('*')
    .order('sort_order');
  if (error) throw error;
  return data || [];
};

export const createSource = async (name) => {
  const { data, error } = await supabase
    .from('bank_audit_sources')
    .insert({ name })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateSource = async (id, updates) => {
  const { data, error } = await supabase
    .from('bank_audit_sources')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteSource = async (id) => {
  const { error } = await supabase
    .from('bank_audit_sources')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

export const getEntries = async (filters = {}) => {
  let query = supabase
    .from('bank_audit_entries')
    .select('*, bank_audit_sources(name)')
    .order('transaction_date', { ascending: false });

  if (filters.date_from) query = query.gte('transaction_date', filters.date_from);
  if (filters.date_to) query = query.lte('transaction_date', filters.date_to);
  if (filters.source_id) query = query.eq('source_id', filters.source_id);
  if (filters.status) query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const createEntry = async (entry) => {
  const { data, error } = await supabase
    .from('bank_audit_entries')
    .insert(entry)
    .select('*, bank_audit_sources(name)')
    .single();
  if (error) throw error;
  return data;
};

export const updateEntry = async (id, updates) => {
  const { data, error } = await supabase
    .from('bank_audit_entries')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, bank_audit_sources(name)')
    .single();
  if (error) throw error;
  return data;
};

export const deleteEntry = async (id) => {
  const { error } = await supabase
    .from('bank_audit_entries')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

export const getSourceSummary = async (filters = {}) => {
  let query = supabase
    .from('bank_audit_entries')
    .select('source_id, amount, bank_audit_sources!inner(name)');

  if (filters.date_from) query = query.gte('transaction_date', filters.date_from);
  if (filters.date_to) query = query.lte('transaction_date', filters.date_to);

  const { data, error } = await query;
  if (error) throw error;

  const summary = {};
  for (const row of data || []) {
    const name = row.bank_audit_sources?.name || 'Unknown';
    summary[name] = (summary[name] || 0) + Number(row.amount);
  }
  return summary;
};

export const suggestEntries = async (searchTerm) => {
  const { data, error } = await supabase
    .from('bank_audit_entries')
    .select('id, payment_id, amount, transaction_date, bank_audit_sources(name)')
    .ilike('payment_id', `%${searchTerm}%`)
    .eq('status', 'unverified')
    .order('transaction_date', { ascending: false })
    .limit(10);
  if (error) throw error;
  return data || [];
};

export const getEntryByPaymentId = async (paymentId, status = 'unverified') => {
  let query = supabase
    .from('bank_audit_entries')
    .select('*, bank_audit_sources(name)')
    .eq('payment_id', paymentId);
  if (status) query = query.eq('status', status);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data || null;
};

export const verifyEntry = async (id) => {
  const { data, error } = await supabase
    .from('bank_audit_entries')
    .update({ status: 'verified', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, bank_audit_sources(name)')
    .single();
  if (error) throw error;
  return data;
};

export const assignToNgoAdmin = async (id, notes) => {
  const { data, error } = await supabase
    .from('bank_audit_entries')
    .update({ assigned_to_ngo_admin: true, ngo_admin_notes: notes || null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, bank_audit_sources(name)')
    .single();
  if (error) throw error;
  return data;
};

export const getSuspenseForNgo = async () => {
  const { data, error } = await supabase
    .from('bank_audit_entries')
    .select('*, bank_audit_sources(name), donor_profiles!donor_id(name, station)')
    .eq('assigned_to_ngo_admin', true)
    .is('donor_id', null)
    .neq('status', 'verified')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const getSuspenseForFro = async (froId) => {
  const { data, error } = await supabase
    .from('bank_audit_entries')
    .select('*, bank_audit_sources(name)')
    .eq('assigned_to_fro_id', froId)
    .neq('status', 'verified')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const assignSuspenseToFro = async (id, froId, notes) => {
  const { data, error } = await supabase
    .from('bank_audit_entries')
    .update({
      assigned_to_fro_id: froId,
      ngo_admin_notes: notes || null,
      assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, bank_audit_sources(name)')
    .single();
  if (error) throw error;
  return data;
};

export const resolveSuspense = async (id, screenshotUrl, donorDetails) => {
  const { data, error } = await supabase
    .from('bank_audit_entries')
    .update({
      screenshot_url: screenshotUrl || null,
      donor_details: donorDetails || null,
      status: 'verified',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, bank_audit_sources(name)')
    .single();
  if (error) throw error;
  return data;
};

export const searchFroDispositions = async (froId, searchTerm) => {
  let query = supabase
    .from('fro_donor_logs')
    .select(`
      id, amount_collected, action, disposition_category, disposition_detail,
      accounts_status, rejection_reason, created_at,
      fro_assignments!inner(fro_worker_id, donor_profiles!inner(id, name, mobile_number, city))
    `)
    .eq('fro_assignments.fro_worker_id', froId)
    .or('accounts_status.neq.verified,and,disposition_detail.neq.lead_done')
    .order('created_at', { ascending: false })
    .limit(30);

  if (searchTerm && searchTerm.length >= 2) {
    query = query.ilike('fro_assignments.donor_profiles.name', `%${searchTerm}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id,
    amount: r.amount_collected,
    action: r.action,
    disposition_category: r.disposition_category,
    disposition_detail: r.disposition_detail,
    accounts_status: r.accounts_status,
    rejection_reason: r.rejection_reason,
    created_at: r.created_at,
    donor_id: r.fro_assignments?.donor_profiles?.id,
    donor_name: r.fro_assignments?.donor_profiles?.name || 'Unknown',
    donor_mobile: r.fro_assignments?.donor_profiles?.mobile_number || '',
    donor_city: r.fro_assignments?.donor_profiles?.city || '',
  }));
};

export const linkSuspenseToDonor = async (entryId, donorId) => {
  const { data, error } = await supabase
    .from('bank_audit_entries')
    .update({
      donor_id: donorId,
      matched_at: new Date().toISOString(),
      status: 'verified',
      assigned_to_ngo_admin: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)
    .select('*, bank_audit_sources(name)')
    .single();
  if (error) throw error;
  return data;
};

export const markSuspenseUnmatched = async (entryId, markedBy) => {
  const { data, error } = await supabase
    .from('bank_audit_entries')
    .update({
      status: 'verified',
      assigned_to_ngo_admin: false,
      no_match_by: markedBy || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)
    .select('*, bank_audit_sources(name)')
    .single();
  if (error) throw error;
  return data;
};

export const searchDonorsForSuspense = async (searchTerm, ngoIds) => {
  if (!searchTerm || searchTerm.trim().length < 2) return [];
  const term = `%${searchTerm.trim()}%`;
  const { data, error } = await supabase
    .from('donor_profiles')
    .select('id, name, mobile_number, city, amount, total_amount, station')
    .or(`name.ilike.${term},mobile_number.ilike.${term}`)
    .limit(20);
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const donorIds = data.map(d => d.id);
  const { data: assignments } = await supabase
    .from('fro_assignments')
    .select('donor_id, fro_worker_id, workers!left(name, login_id)')
    .in('donor_id', donorIds)
    .not('status', 'eq', 'reassigned');

  const froMap = {};
  for (const a of assignments || []) {
    if (!froMap[a.donor_id]) froMap[a.donor_id] = { name: a.workers?.name || 'Unknown', login_id: a.workers?.login_id || '' };
  }

  return data.map(d => ({
    id: d.id,
    name: d.name,
    mobile_number: d.mobile_number,
    city: d.city,
    amount: d.amount,
    total_amount: d.total_amount,
    station: d.station || null,
    fro_name: froMap[d.id]?.name || null,
    fro_login: froMap[d.id]?.login_id || null,
  }));
};
