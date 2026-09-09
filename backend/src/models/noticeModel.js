import db from '../config/db.js';

const VALID_ROLES = ['all', 'super_admin', 'admin', 'hr', 'accounts', 'recruiter', 'leads', 'telecaller', 'team_lead', 'worker', 'fro', 'ngo', 'event_head'];

function sanitizeRole(role) {
  return VALID_ROLES.includes(role) ? role : null;
}

export const createNotice = async (data) => {
  const { data: result, error } = await db
    .from('notices')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
};

export const getAllNotices = async (ngo_id, target_role) => {
  let query = db
    .from('notices')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (ngo_id) query = query.or(`ngo_id.eq.${ngo_id},ngo_id.is.null`);
  const role = sanitizeRole(target_role);
  if (role && role !== 'all') {
    query = query.or(`target_role.eq.${role},target_role.is.null,target_role.eq.all,target_roles.is.null,target_roles.cs.{${role}},target_roles.cs.{all}`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
};

export const getRecentNotices = async (ngo_id, since, target_role) => {
  let query = db
    .from('notices')
    .select('*')
    .eq('is_active', true)
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  if (ngo_id) query = query.eq('ngo_id', ngo_id);
  const role = sanitizeRole(target_role);
  if (role && role !== 'all') {
    query = query.or(`target_role.eq.${role},target_role.is.null,target_role.eq.all,target_roles.is.null,target_roles.cs.{${role}},target_roles.cs.{all}`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
};

export const getNoticeById = async (id) => {
  const { data, error } = await db
    .from('notices')
    .select('*')
    .eq('id', id);
  if (error) throw error;
  if (!data || data.length === 0) return null;
  return data[0];
};

export const updateNotice = async (id, updates) => {
  const { data, error } = await db
    .from('notices')
    .update(updates)
    .eq('id', id)
    .select();
  if (error) throw error;
  if (!data || data.length === 0) return null;
  return data[0];
};

export const deleteNotice = async (id) => {
  const { data, error } = await db
    .from('notices')
    .delete()
    .eq('id', id)
    .select();
  if (error) throw error;
  if (!data || data.length === 0) return { message: 'Notice not found' };
  return { message: 'Notice deleted' };
};
