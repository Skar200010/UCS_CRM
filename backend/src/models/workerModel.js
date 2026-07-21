import supabase from '../config/supabase.js';

export const createWorker = async (workerData) => {
  const { data, error } = await supabase
    .from('workers')
    .insert([workerData])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const createWorkers = async (workersData) => {
  const { data, error } = await supabase
    .from('workers')
    .insert(workersData)
    .select();
  if (error) throw error;
  return data;
};

export const getAllWorkers = async (ngo_id, status) => {
  let query = supabase
    .from('workers')
    .select('*')
    .order('created_at', { ascending: false });

  if (ngo_id) {
    const { data: ids, error: idsErr } = await supabase
      .from('worker_ngo_allocations')
      .select('worker_id')
      .eq('ngo_id', ngo_id);
    if (idsErr) throw idsErr;
    const workerIds = (ids || []).map(r => r.worker_id);
    if (workerIds.length > 0) {
      query = query.in('id', workerIds);
    } else {
      query = query.eq('id', null);
    }
  }

  if (status === 'active') {
    query = query.eq('employment_status', 'active');
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
};

export const getWorkerById = async (id) => {
  const { data, error } = await supabase
    .from('workers')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
};

export const getWorkerCount = async () => {
  const { count, error } = await supabase
    .from('workers')
    .select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
};

export const getRecruiterWorkers = async () => {
  const { data, error } = await supabase
    .from('workers')
    .select('*')
    .or('department.ilike.*recruit*,department.ilike.hr*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
};

export const getWorkerByLoginId = async (login_id) => {
  const { data, error } = await supabase
    .from('workers')
    .select('*')
    .eq('login_id', login_id)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

export const updateWorker = async (id, updates) => {
  const { data, error } = await supabase
    .from('workers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteWorker = async (id) => {
  const { error: convErr } = await supabase
    .from('conversations')
    .update({ assigned_agent_id: null })
    .eq('assigned_agent_id', id);
  if (convErr) throw convErr;

  const { error } = await supabase
    .from('workers')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return { message: 'Worker deleted successfully' };
};

export const abscondWorker = async (id) => {
  const { data, error } = await supabase
    .from('workers')
    .update({ employment_status: 'absconded', is_active: false })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const offboardWorker = async (id) => {
  const { data, error } = await supabase
    .from('workers')
    .update({ employment_status: 'offboarded', is_active: false })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};
