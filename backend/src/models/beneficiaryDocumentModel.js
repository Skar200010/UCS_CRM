import db from '../config/db.js';

export const addDocument = async (beneficiaryId, data) => {
  data.beneficiary_id = beneficiaryId;
  data.uploaded_at = new Date().toISOString();
  const { data: result, error } = await db
    .from('beneficiary_documents')
    .insert(data)
    .select('*')
    .single();
  if (error) throw error;
  return result;
};

export const getDocuments = async (beneficiaryId) => {
  const { data, error } = await db
    .from('beneficiary_documents')
    .select('*')
    .eq('beneficiary_id', beneficiaryId)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const updateDocument = async (id, updates) => {
  const { data, error } = await db
    .from('beneficiary_documents')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
};

export const removeDocument = async (id) => {
  const { error } = await db.from('beneficiary_documents').delete().eq('id', id);
  if (error) throw error;
  return { message: 'Document removed' };
};
