import db from '../config/db.js';

export async function generateBeneficiaryCode() {
  const { data: seq, error: seqErr } = await db
    .from('beneficiary_sequences')
    .select('id, current_value')
    .single();
  if (seqErr) throw seqErr;

  const next = (seq.current_value || 0) + 1;
  const { error: updErr } = await db
    .from('beneficiary_sequences')
    .update({ current_value: next, updated_at: new Date().toISOString() })
    .eq('id', seq.id);
  if (updErr) throw updErr;

  return `BS-${String(next).padStart(6, '0')}`;
}

export const createBeneficiary = async (data) => {
  const { data: result, error } = await db
    .from('beneficiaries')
    .insert(data)
    .select('*')
    .single();
  if (error) throw error;
  return result;
};

export const getBeneficiaryById = async (id) => {
  const { data, error } = await db
    .from('beneficiaries')
    .select('*, ngos(name, code), beneficiary_categories!beneficiary_category_assignments(id, name, description)')
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
};

export const getBeneficiaryByCode = async (code) => {
  const { data, error } = await db
    .from('beneficiaries')
    .select('*')
    .eq('beneficiary_code', code)
    .single();
  if (error) return null;
  return data;
};

export const updateBeneficiary = async (id, updates) => {
  updates.updated_at = new Date().toISOString();
  const { data, error } = await db
    .from('beneficiaries')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
};

export const listBeneficiaries = async ({ page = 1, pageSize = 25, search, status, ngo_id, category_id, state, city }) => {
  let query = db.from('beneficiaries').select('*, ngos(name, code)', { count: 'exact' });

  if (search) {
    query = query.or(`beneficiary_code.ilike.%${search}%,full_name.ilike.%${search}%,mobile.ilike.%${search}%`);
  }
  if (status) query = query.eq('status', status);
  if (ngo_id) query = query.eq('ngo_id', ngo_id);
  if (state) query = query.eq('state', state);
  if (city) query = query.eq('city', city);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  query = query.order('created_at', { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data || [], total: count || 0, page, pageSize };
};

export const searchBeneficiaries = async (q) => {
  if (!q || q.length < 2) return [];
  const { data, error } = await db
    .from('beneficiaries')
    .select('id, beneficiary_code, full_name, mobile, status, city, photo')
    .or(`beneficiary_code.ilike.%${q}%,full_name.ilike.%${q}%,mobile.ilike.%${q}%`)
    .limit(20);
  if (error) throw error;
  return data || [];
};

export const getBeneficiaryOverview = async () => {
  const { count: total } = await db.from('beneficiaries').select('id', { count: 'exact', head: true });
  const { count: active } = await db.from('beneficiaries').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE');
  const { count: inactive } = await db.from('beneficiaries').select('id', { count: 'exact', head: true }).eq('status', 'INACTIVE');
  const { count: pendingFingerprint } = await db.from('beneficiaries').select('id', { count: 'exact', head: true }).eq('fingerprint_status', 'NOT_REGISTERED');

  const thisMonth = new Date();
  thisMonth.setDate(1);
  const { count: newThisMonth } = await db.from('beneficiaries').select('id', { count: 'exact', head: true })
    .gte('created_at', thisMonth.toISOString());

  const { count: programsCount } = await db.from('bnf_programs').select('id', { count: 'exact', head: true });
  const { count: distributionsCount } = await db.from('benefit_distributions').select('id', { count: 'exact', head: true });

  return {
    total_beneficiaries: total || 0,
    active: active || 0,
    inactive: inactive || 0,
    pending_fingerprint: pendingFingerprint || 0,
    new_this_month: newThisMonth || 0,
    programs: programsCount || 0,
    benefits_distributed: distributionsCount || 0,
  };
};

export const searchByQRToken = async (qrToken) => {
  const { data: card, error: cardErr } = await db
    .from('beneficiary_cards')
    .select('beneficiary_id, card_number, card_type')
    .eq('qr_token', qrToken)
    .eq('status', 'ACTIVE')
    .single();
  if (cardErr || !card) return null;

  const { data: beneficiary, error: benErr } = await db
    .from('beneficiaries')
    .select('id, beneficiary_code, full_name, status, mobile, photo')
    .eq('id', card.beneficiary_id)
    .single();
  if (benErr || !beneficiary) return null;

  return { ...beneficiary, card };
};

export const searchByMobile = async (mobile) => {
  const { data, error } = await db
    .from('beneficiaries')
    .select('id, beneficiary_code, full_name, status, mobile, photo')
    .eq('mobile', mobile)
    .limit(5);
  if (error) throw error;
  return data || [];
};
