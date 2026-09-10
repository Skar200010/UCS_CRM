import db from '../config/db.js';

export const enrollBiometric = async (data) => {
  const { data: result, error } = await db
    .from('biometric_credentials')
    .insert(data)
    .select('*')
    .single();
  if (error) throw error;

  // Update beneficiary fingerprint status
  await db
    .from('beneficiaries')
    .update({ fingerprint_status: 'REGISTERED', updated_at: new Date().toISOString() })
    .eq('id', data.beneficiary_id);

  return result;
};

export const getBiometrics = async (beneficiaryId) => {
  const { data, error } = await db
    .from('biometric_credentials')
    .select('*')
    .eq('beneficiary_id', beneficiaryId)
    .order('enrolled_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const getBiometricStatus = async (beneficiaryId) => {
  const { data: beneficiary } = await db
    .from('beneficiaries')
    .select('fingerprint_status')
    .eq('id', beneficiaryId)
    .single();

  const { data: credentials } = await db
    .from('biometric_credentials')
    .select('id, finger_position, quality_score, status, enrolled_at')
    .eq('beneficiary_id', beneficiaryId)
    .eq('status', 'ENROLLED');

  return {
    status: beneficiary?.fingerprint_status || 'NOT_REGISTERED',
    enrolled_fingers: credentials || [],
  };
};

export const revokeBiometric = async (credentialId) => {
  const { data: credential } = await db
    .from('biometric_credentials')
    .select('beneficiary_id')
    .eq('id', credentialId)
    .single();

  const { data, error } = await db
    .from('biometric_credentials')
    .update({ status: 'REVOKED', revoked_at: new Date().toISOString() })
    .eq('id', credentialId)
    .select('*')
    .single();
  if (error) throw error;

  // Check if any other active credentials remain
  const { count } = await db
    .from('biometric_credentials')
    .select('id', { count: 'exact', head: true })
    .eq('beneficiary_id', credential.beneficiary_id)
    .eq('status', 'ENROLLED');

  if (count === 0) {
    await db
      .from('beneficiaries')
      .update({ fingerprint_status: 'REVOKED', updated_at: new Date().toISOString() })
      .eq('id', credential.beneficiary_id);
  }

  return data;
};

export const verifyBiometric = async (beneficiaryId, fingerPosition, templateData) => {
  // In a real system, this would compare the template against stored templates
  // For now, return a verification result based on stored credentials
  const { data: credential } = await db
    .from('biometric_credentials')
    .select('id, quality_score')
    .eq('beneficiary_id', beneficiaryId)
    .eq('finger_position', fingerPosition)
    .eq('status', 'ENROLLED')
    .single();

  if (!credential) return { matched: false, confidence: 0 };

  // Update last verified timestamp
  await db
    .from('biometric_credentials')
    .update({ last_verified_at: new Date().toISOString() })
    .eq('id', credential.id);

  return { matched: true, confidence: 0.95 };
};
