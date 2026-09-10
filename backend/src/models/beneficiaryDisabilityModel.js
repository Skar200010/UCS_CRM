import db from '../config/db.js';

export const addDisability = async (beneficiaryId, data) => {
  data.beneficiary_id = beneficiaryId;
  const { data: result, error } = await db
    .from('beneficiary_disabilities')
    .insert(data)
    .select('*')
    .single();
  if (error) throw error;
  return result;
};

export const getDisabilities = async (beneficiaryId) => {
  const { data, error } = await db
    .from('beneficiary_disabilities')
    .select('*')
    .eq('beneficiary_id', beneficiaryId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const updateDisability = async (id, updates) => {
  updates.updated_at = new Date().toISOString();
  const { data, error } = await db
    .from('beneficiary_disabilities')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
};

export const removeDisability = async (id) => {
  const { error } = await db.from('beneficiary_disabilities').delete().eq('id', id);
  if (error) throw error;
  return { message: 'Disability record removed' };
};
