import { Router } from 'express';
import { authenticateRole } from '../middleware/authMiddleware.js';
import { sendReceipt, test, status, sendNgoInfo, sendCustomTemplate, listTemplates, sendDirect } from '../controllers/whatsappController.js';
import { list, getById, create, update, remove } from '../controllers/whatsappAccountController.js';
import { listAgents, assignAgent, removeAgent, searchAgents } from '../controllers/froWhatsAppAssignmentController.js';

const router = Router();

router.get('/accounts', authenticateRole('accounts', 'super_admin'), list);
router.get('/accounts/agents/search', authenticateRole('accounts', 'super_admin'), searchAgents);
router.get('/accounts/:id', authenticateRole('accounts', 'super_admin'), getById);
router.post('/accounts', authenticateRole('accounts', 'super_admin'), create);
router.put('/accounts/:id', authenticateRole('accounts', 'super_admin'), update);
router.delete('/accounts/:id', authenticateRole('accounts', 'super_admin'), remove);
router.get('/accounts/:accountId/agents', authenticateRole('accounts', 'super_admin'), listAgents);
router.post('/accounts/:accountId/agents', authenticateRole('accounts', 'super_admin'), assignAgent);
router.delete('/accounts/:accountId/agents/:froId', authenticateRole('accounts', 'super_admin'), removeAgent);

router.post('/test', authenticateRole('accounts', 'super_admin'), test);
router.get('/status', authenticateRole('accounts', 'super_admin'), status);
router.post('/send-receipt/:logId', authenticateRole('accounts', 'super_admin'), sendReceipt);
router.post('/send-ngo-info', authenticateRole('accounts', 'super_admin'), sendNgoInfo);
router.post('/send-template', authenticateRole('accounts', 'super_admin'), sendCustomTemplate);
router.get('/templates', authenticateRole('accounts', 'super_admin'), listTemplates);
router.post('/send-direct', authenticateRole('accounts', 'super_admin'), sendDirect);

export default router;
