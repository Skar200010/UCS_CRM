import db from '../config/db.js';

export const getAllSlabs = async () => {
  const { data, error } = await db
    .from('incentive_slabs')
    .select('*')
    .order('min_amount', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const getActiveSlabs = async () => {
  const { data, error } = await db
    .from('incentive_slabs')
    .select('*')
    .eq('is_active', true)
    .order('min_amount', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const getSlabById = async (id) => {
  const { data, error } = await db
    .from('incentive_slabs')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const createSlab = async ({ min_amount, max_amount, incentive_amount }) => {
  const { data, error } = await db
    .from('incentive_slabs')
    .insert([{ min_amount, max_amount, incentive_amount, is_active: true }])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateSlab = async (id, { min_amount, max_amount, incentive_amount }) => {
  const { data, error } = await db
    .from('incentive_slabs')
    .update({ min_amount, max_amount, incentive_amount, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteSlab = async (id) => {
  const { data, error } = await db
    .from('incentive_slabs')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};
