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

export const getEntryByPaymentId = async (paymentId) => {
  const { data, error } = await supabase
    .from('bank_audit_entries')
    .select('*, bank_audit_sources(name)')
    .eq('payment_id', paymentId)
    .eq('status', 'unverified')
    .maybeSingle();
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
    .select('*, bank_audit_sources(name)')
    .eq('assigned_to_ngo_admin', true)
    .is('assigned_to_fro_id', null)
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
  const { data, error } = await supabase
    .from('fro_donor_logs')
    .select(`
      id, amount_collected, action, disposition_category, disposition_detail,
      accounts_status, rejection_reason, created_at,
      fro_assignments!inner(fro_worker_id, donor_profiles!inner(id, name, mobile_number, city))
    `)
    .eq('fro_assignments.fro_worker_id', froId)
    .ilike('fro_assignments.donor_profiles.name', `%${searchTerm}%`)
    .or('accounts_status.neq.verified,and,disposition_detail.neq.lead_done')
    .order('created_at', { ascending: false })
    .limit(20);
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
