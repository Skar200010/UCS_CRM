import { Router } from 'express';
import { authenticateRole } from '../middleware/authMiddleware.js';
import { sendReceipt, test, status, sendNgoInfo, sendCustomTemplate, listTemplates, sendDirect } from '../controllers/whatsappController.js';

const router = Router();

router.post('/test', authenticateRole('accounts', 'super_admin'), test);
router.get('/status', authenticateRole('accounts', 'super_admin'), status);
router.post('/send-receipt/:logId', authenticateRole('accounts', 'super_admin'), sendReceipt);
router.post('/send-ngo-info', authenticateRole('accounts', 'super_admin'), sendNgoInfo);
router.post('/send-template', authenticateRole('accounts', 'super_admin'), sendCustomTemplate);
router.get('/templates', authenticateRole('accounts', 'super_admin'), listTemplates);
router.post('/send-direct', authenticateRole('accounts', 'super_admin'), sendDirect);

export default router;
