import { enrollBiometric, getBiometrics, getBiometricStatus, revokeBiometric, verifyBiometric } from '../models/biometricModel.js';
import { logAuditEvent } from '../models/auditLogModel.js';

export const enrollFingerprint = async (req, res) => {
  try {
    const {
      beneficiary_id, beneficiary_code, finger_position, quality, device_id,
      credential_reference, provider, device_type, device_name, pid_data, fid_data, template,
    } = req.body;

    // Resolve beneficiary: accept either beneficiary_id or beneficiary_code
    let resolvedBeneficiaryId = beneficiary_id;
    if (!resolvedBeneficiaryId && beneficiary_code) {
      const { default: db } = await import('../config/db.js');
      const { data: bnf } = await db
        .from('beneficiaries')
        .select('id')
        .eq('beneficiary_code', beneficiary_code)
        .single();
      resolvedBeneficiaryId = bnf?.id;
    }

    if (!resolvedBeneficiaryId) {
      return res.status(400).json({ message: 'beneficiary_id (or code) is required' });
    }

    const resolvedFingerPosition = finger_position || 'UNKNOWN';

    const result = await enrollBiometric({
      beneficiary_id: resolvedBeneficiaryId,
      provider: provider || device_type || 'generic',
      device_type: device_type || null,
      device_name: device_name || null,
      device_id: device_id || null,
      credential_reference: credential_reference || fid_data || template || null,
      finger_position: resolvedFingerPosition,
      quality_score: quality || 'GOOD',
      status: 'ENROLLED',
      enrolled_by: req.user?.name || 'system',
    });

    await logAuditEvent({
      entity_type: 'biometric', entity_id: result.id,
      beneficiary_id: resolvedBeneficiaryId, action: 'BIOMETRIC_ENROLLED',
      details: { finger_position: resolvedFingerPosition, quality, device_type, device_name },
      performed_by: req.user?.name || 'system',
    });

    return res.status(201).json({ message: 'Fingerprint enrolled', credential: result });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const verifyFingerprint = async (req, res) => {
  try {
    const { beneficiary_id, beneficiary_code, finger_position, template_data } = req.body;

    let resolvedBeneficiaryId = beneficiary_id;
    if (!resolvedBeneficiaryId && beneficiary_code) {
      const { default: db } = await import('../config/db.js');
      const { data: bnf } = await db
        .from('beneficiaries')
        .select('id')
        .eq('beneficiary_code', beneficiary_code)
        .single();
      resolvedBeneficiaryId = bnf?.id;
    }

    const result = await verifyBiometric(resolvedBeneficiaryId, finger_position, template_data);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getBiometricDetails = async (req, res) => {
  try {
    const status = await getBiometricStatus(req.params.id);
    return res.json(status);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const revokeFingerprint = async (req, res) => {
  try {
    const result = await revokeBiometric(req.params.id);

    await logAuditEvent({
      entity_type: 'biometric', entity_id: result.id,
      beneficiary_id: result.beneficiary_id, action: 'BIOMETRIC_REVOKED',
      performed_by: req.user?.name || 'system',
    });

    return res.json({ message: 'Credential revoked', credential: result });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};