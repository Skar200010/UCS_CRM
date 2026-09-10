import { Router } from 'express';
import { authenticateRole } from '../middleware/authMiddleware.js';
import {
  createNewBeneficiary, getBeneficiary, getBeneficiaryByCodeController,
  updateBeneficiaryController, listAllBeneficiaries, searchBeneficiariesController,
  getOverview, searchByQR, searchByMobileController, getAuditTrail,
} from '../controllers/beneficiaryController.js';
import {
  addDisability, getDisabilities, updateDisability, removeDisability,
} from '../models/beneficiaryDisabilityModel.js';
import {
  addFamilyMember, getFamilyMembers, updateFamilyMember, removeFamilyMember,
} from '../models/beneficiaryFamilyModel.js';
import {
  upsertEducation, getEducation,
} from '../models/beneficiaryEducationModel.js';
import {
  upsertEmployment, getEmployment,
} from '../models/beneficiaryEmploymentModel.js';
import {
  addAssistance, getAssistances, updateAssistance, removeAssistance,
} from '../models/beneficiaryAssistanceModel.js';
import {
  addDocument, getDocuments, updateDocument, removeDocument,
} from '../models/beneficiaryDocumentModel.js';
import { logAuditEvent } from '../models/auditLogModel.js';

const router = Router();

// Overview
router.get('/overview', authenticateRole('super_admin', 'admin', 'ngo', 'accounts', 'event_head', 'worker'), getOverview);

// Search
router.get('/search', authenticateRole('super_admin', 'admin', 'ngo', 'accounts', 'event_head', 'worker'), searchBeneficiariesController);
router.get('/search/qr', authenticateRole('super_admin', 'admin', 'ngo', 'event_head', 'worker'), searchByQR);
router.get('/search/mobile', authenticateRole('super_admin', 'admin', 'ngo', 'accounts', 'event_head', 'worker'), searchByMobileController);

// CRUD
router.get('/', authenticateRole('super_admin', 'admin', 'ngo', 'accounts', 'event_head', 'worker'), listAllBeneficiaries);
router.post('/', authenticateRole('super_admin', 'admin', 'ngo', 'accounts'), createNewBeneficiary);
router.get('/:id', authenticateRole('super_admin', 'admin', 'ngo', 'accounts', 'event_head', 'worker'), getBeneficiary);
router.patch('/:id', authenticateRole('super_admin', 'admin', 'ngo', 'accounts'), updateBeneficiaryController);
router.get('/code/:code', authenticateRole('super_admin', 'admin', 'ngo', 'accounts', 'event_head', 'worker'), getBeneficiaryByCodeController);

// Audit
router.get('/:id/audit', authenticateRole('super_admin', 'admin', 'ngo'), getAuditTrail);

// Disability sub-resource
router.get('/:id/disabilities', async (req, res) => {
  try { res.json(await getDisabilities(req.params.id)); }
  catch (e) { res.status(500).json({ message: e.message }); }
});
router.post('/:id/disabilities', authenticateRole('super_admin', 'admin', 'ngo', 'accounts'), async (req, res) => {
  try {
    const result = await addDisability(req.params.id, req.body);
    await logAuditEvent({ entity_type: 'disability', beneficiary_id: parseInt(req.params.id), action: 'DISABILITY_ADDED', performed_by: req.user?.name || 'system' });
    res.status(201).json(result);
  } catch (e) { res.status(500).json({ message: e.message }); }
});
router.patch('/disabilities/:disabilityId', authenticateRole('super_admin', 'admin', 'ngo', 'accounts'), async (req, res) => {
  try { res.json(await updateDisability(req.params.disabilityId, req.body)); }
  catch (e) { res.status(500).json({ message: e.message }); }
});
router.delete('/disabilities/:disabilityId', authenticateRole('super_admin', 'admin', 'ngo'), async (req, res) => {
  try { res.json(await removeDisability(req.params.disabilityId)); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

// Family sub-resource
router.get('/:id/family', async (req, res) => {
  try { res.json(await getFamilyMembers(req.params.id)); }
  catch (e) { res.status(500).json({ message: e.message }); }
});
router.post('/:id/family', authenticateRole('super_admin', 'admin', 'ngo', 'accounts'), async (req, res) => {
  try {
    const result = await addFamilyMember(req.params.id, req.body);
    await logAuditEvent({ entity_type: 'family', beneficiary_id: parseInt(req.params.id), action: 'FAMILY_MEMBER_ADDED', performed_by: req.user?.name || 'system' });
    res.status(201).json(result);
  } catch (e) { res.status(500).json({ message: e.message }); }
});
router.patch('/family/:memberId', authenticateRole('super_admin', 'admin', 'ngo', 'accounts'), async (req, res) => {
  try { res.json(await updateFamilyMember(req.params.memberId, req.body)); }
  catch (e) { res.status(500).json({ message: e.message }); }
});
router.delete('/family/:memberId', authenticateRole('super_admin', 'admin', 'ngo'), async (req, res) => {
  try { res.json(await removeFamilyMember(req.params.memberId)); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

// Education sub-resource
router.get('/:id/education', async (req, res) => {
  try { res.json(await getEducation(req.params.id)); }
  catch (e) { res.status(500).json({ message: e.message }); }
});
router.put('/:id/education', authenticateRole('super_admin', 'admin', 'ngo', 'accounts'), async (req, res) => {
  try { res.json(await upsertEducation(req.params.id, req.body)); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

// Employment sub-resource
router.get('/:id/employment', async (req, res) => {
  try { res.json(await getEmployment(req.params.id)); }
  catch (e) { res.status(500).json({ message: e.message }); }
});
router.put('/:id/employment', authenticateRole('super_admin', 'admin', 'ngo', 'accounts'), async (req, res) => {
  try { res.json(await upsertEmployment(req.params.id, req.body)); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

// Assistance sub-resource
router.get('/:id/assistance', async (req, res) => {
  try { res.json(await getAssistances(req.params.id)); }
  catch (e) { res.status(500).json({ message: e.message }); }
});
router.post('/:id/assistance', authenticateRole('super_admin', 'admin', 'ngo', 'accounts'), async (req, res) => {
  try {
    const result = await addAssistance(req.params.id, req.body);
    await logAuditEvent({ entity_type: 'assistance', beneficiary_id: parseInt(req.params.id), action: 'ASSISTANCE_ADDED', performed_by: req.user?.name || 'system' });
    res.status(201).json(result);
  } catch (e) { res.status(500).json({ message: e.message }); }
});
router.patch('/assistance/:assistanceId', authenticateRole('super_admin', 'admin', 'ngo', 'accounts'), async (req, res) => {
  try { res.json(await updateAssistance(req.params.assistanceId, req.body)); }
  catch (e) { res.status(500).json({ message: e.message }); }
});
router.delete('/assistance/:assistanceId', authenticateRole('super_admin', 'admin', 'ngo'), async (req, res) => {
  try { res.json(await removeAssistance(req.params.assistanceId)); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

// Documents sub-resource
router.get('/:id/documents', async (req, res) => {
  try { res.json(await getDocuments(req.params.id)); }
  catch (e) { res.status(500).json({ message: e.message }); }
});
router.post('/:id/documents', authenticateRole('super_admin', 'admin', 'ngo', 'accounts'), async (req, res) => {
  try {
    const result = await addDocument(req.params.id, { ...req.body, uploaded_by: req.user?.name || 'system' });
    await logAuditEvent({ entity_type: 'document', beneficiary_id: parseInt(req.params.id), action: 'DOCUMENT_UPLOADED', details: { document_type: req.body.document_type }, performed_by: req.user?.name || 'system' });
    res.status(201).json(result);
  } catch (e) { res.status(500).json({ message: e.message }); }
});
router.patch('/documents/:docId', authenticateRole('super_admin', 'admin', 'ngo', 'accounts'), async (req, res) => {
  try { res.json(await updateDocument(req.params.docId, req.body)); }
  catch (e) { res.status(500).json({ message: e.message }); }
});
router.delete('/documents/:docId', authenticateRole('super_admin', 'admin', 'ngo'), async (req, res) => {
  try { res.json(await removeDocument(req.params.docId)); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

export default router;
