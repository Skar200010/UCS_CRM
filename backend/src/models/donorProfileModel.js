import supabase from '../config/supabase.js';

export const getDonorByMobile = async (mobile) => {
  const { data, error } = await supabase
    .from('donor_profiles')
    .select('*')
    .eq('mobile_number', mobile)
    .limit(1);
  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
};

export const upsertDonorProfile = async (profile) => {
  const existing = await getDonorByMobile(profile.mobile_number);

  if (existing) {
    const newAmount = Math.max(parseFloat(existing.amount || 0), parseFloat(profile.amount || 0));
    const newTotal = parseFloat(existing.total_amount || 0) + parseFloat(profile.amount || 0);
    const newCount = (existing.donation_count || 0) + 1;

    const updates = {
      amount: newAmount,
      total_amount: newTotal,
      donation_count: newCount,
      updated_at: new Date().toISOString(),
    };

    if (profile.name) updates.name = profile.name;
    if (profile.bank_donor_name) updates.bank_donor_name = profile.bank_donor_name;
    if (profile.agent_donor_name) updates.agent_donor_name = profile.agent_donor_name;
    if (profile.mobile_2) updates.mobile_2 = profile.mobile_2;
    if (profile.address_1) updates.address_1 = profile.address_1;
    if (profile.address_2) updates.address_2 = profile.address_2;
    if (profile.city) updates.city = profile.city;
    if (profile.pin_code) updates.pin_code = profile.pin_code;
    if (profile.pan_number) updates.pan_number = profile.pan_number;
    if (profile.email) updates.email = profile.email;
    if (profile.birth_date) updates.birth_date = profile.birth_date;
    if (profile.data_category) updates.data_category = profile.data_category;
    if (profile.team) updates.team = profile.team;
    if (profile.agent_name) updates.agent_name = profile.agent_name;
    if (profile.mop) updates.mop = profile.mop;
    if (profile.donors_bank_name) updates.donors_bank_name = profile.donors_bank_name;
    if (profile.project_supported) updates.project_supported = profile.project_supported;
    if (profile.account_of) updates.account_of = profile.account_of;
    if (profile.category) updates.category = profile.category;
    if (profile.station) updates.station = profile.station;
    if (profile.ngo) updates.ngo = profile.ngo;
    if (profile.transaction_date) updates.last_donation_date = profile.transaction_date;

    const { data, error } = await supabase
      .from('donor_profiles')
      .update(updates)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('donor_profiles')
    .insert({
      mobile_number: profile.mobile_number,
      name: profile.name || null,
      bank_donor_name: profile.bank_donor_name || null,
      agent_donor_name: profile.agent_donor_name || null,
      mobile_2: profile.mobile_2 || null,
      address_1: profile.address_1 || null,
      address_2: profile.address_2 || null,
      city: profile.city || null,
      pin_code: profile.pin_code || null,
      pan_number: profile.pan_number || null,
      email: profile.email || null,
      birth_date: profile.birth_date || null,
      data_category: profile.data_category || null,
      team: profile.team || null,
      agent_name: profile.agent_name || null,
      mop: profile.mop || null,
      donors_bank_name: profile.donors_bank_name || null,
      project_supported: profile.project_supported || null,
      account_of: profile.account_of || null,
      category: profile.category || '',
      station: profile.station || null,
      ngo: profile.ngo || null,
      amount: profile.amount || 0,
      total_amount: profile.amount || 0,
      donation_count: 1,
      first_donation_date: profile.transaction_date || null,
      last_donation_date: profile.transaction_date || null,
      raw_data: profile.raw_data || null,
      first_import_batch_id: profile.import_batch_id || null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
};

export const insertDonorProfile = async (profile) => {
  const row = {
    mobile_number: profile.mobile_number,
    name: profile.name || null,
    bank_donor_name: profile.bank_donor_name || null,
    agent_donor_name: profile.agent_donor_name || null,
    mobile_2: profile.mobile_2 || null,
    address_1: profile.address_1 || null,
    address_2: profile.address_2 || null,
    city: profile.city || null,
    pin_code: profile.pin_code || null,
    pan_number: profile.pan_number || null,
    email: profile.email || null,
    birth_date: profile.birth_date || null,
    data_category: profile.data_category || null,
    team: profile.team || null,
    agent_name: profile.agent_name || null,
    mop: profile.mop || null,
    donors_bank_name: profile.donors_bank_name || null,
    project_supported: profile.project_supported || null,
    account_of: profile.account_of || null,
    raw_data: profile.raw_data || null,
    first_import_batch_id: profile.import_batch_id || null,
    category: profile.category || '',
    station: profile.station || null,
    ngo: profile.ngo || null,
    amount: profile.amount || 0,
  };
  const { data, error } = await supabase
    .from('donor_profiles')
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;
  return data;
};

export const getAllDonorProfiles = async (limit = 500) => {
  const { data, error } = await supabase
    .from('donor_profiles')
    .select('*')
    .order('first_imported_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
};

export const getDonorProfilesByNgo = async (ngoList, limit = 1000) => {
  const { data, error } = await supabase
    .from('donor_profiles')
    .select('*')
    .in('ngo', ngoList)
    .order('first_imported_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
};

export const getDonorProfilesByImportNgo = async (ngoList, limit = 1000) => {
  const { data: mobiles, error: mErr } = await supabase
    .from('new_data')
    .select('mobile_number')
    .in('ngo', ngoList)
    .not('mobile_number', 'is', null);

  if (mErr) throw mErr;

  const uniqueMobiles = [...new Set(mobiles.map(r => r.mobile_number))];
  if (uniqueMobiles.length === 0) return [];

  // Batch into groups of 500 to avoid Cloudflare 414 URI too large
  const BATCH = 500;
  const batchQueries = [];
  for (let i = 0; i < uniqueMobiles.length; i += BATCH) {
    const batch = uniqueMobiles.slice(i, i + BATCH);
    batchQueries.push(
      supabase
        .from('donor_profiles')
        .select('*')
        .in('mobile_number', batch)
        .order('first_imported_at', { ascending: false })
    );
  }

  // Run all batches in parallel
  const batchResults = await Promise.allSettled(batchQueries);
  const results = [];
  for (const r of batchResults) {
    if (r.status === 'fulfilled' && r.value.data) {
      results.push(...r.value.data);
    }
  }

  // Dedup by id and apply limit
  const seen = new Set();
  const deduped = results.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
  return deduped.slice(0, limit);
};
