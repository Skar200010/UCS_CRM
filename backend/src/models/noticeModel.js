import supabase from '../config/supabase.js';

export const createNotice = async (data) => {
  const { data: result, error } = await supabase
    .from('notices')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
};

export const getAllNotices = async (ngo_id, target_role) => {
  let query = supabase
    .from('notices')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (ngo_id) query = query.eq('ngo_id', ngo_id);
  if (target_role && target_role !== 'all') {
    query = query.or(`target_role.eq.${target_role},target_role.is.null,target_role.eq.all`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
};

export const getRecentNotices = async (ngo_id, since, target_role) => {
  let query = supabase
    .from('notices')
    .select('*')
    .eq('is_active', true)
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  if (ngo_id) query = query.eq('ngo_id', ngo_id);
  if (target_role && target_role !== 'all') {
    query = query.or(`target_role.eq.${target_role},target_role.is.null,target_role.eq.all`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
};

export const getNoticeById = async (id) => {
  const { data, error } = await supabase
    .from('notices')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
};

export const updateNotice = async (id, updates) => {
  const { data, error } = await supabase
    .from('notices')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteNotice = async (id) => {
  const { error } = await supabase
    .from('notices')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return { message: 'Notice deleted' };
};
