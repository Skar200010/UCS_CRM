import { Router } from 'express';
import { authenticateRole } from '../middleware/authMiddleware.js';
import { triggerImport, getImportStatus, getLog } from '../controllers/emailImportController.js';
import { list, create, update, remove } from '../controllers/emailAccountController.js';

const router = Router();

router.post('/trigger', authenticateRole('accounts', 'super_admin'), triggerImport);
router.get('/status', authenticateRole('accounts', 'super_admin'), getImportStatus);
router.get('/log', authenticateRole('accounts', 'super_admin'), getLog);

router.get('/accounts', authenticateRole('accounts', 'super_admin'), list);
router.post('/accounts', authenticateRole('accounts', 'super_admin'), create);
router.put('/accounts/:id', authenticateRole('accounts', 'super_admin'), update);
router.delete('/accounts/:id', authenticateRole('accounts', 'super_admin'), remove);

export default router;
