import { Router } from 'express';
import { authenticateRole } from '../middleware/authMiddleware.js';
import {
  enrollFingerprint, verifyFingerprint, getBiometricDetails, revokeFingerprint,
} from '../controllers/biometricController.js';

const router = Router();

router.post('/enroll', authenticateRole('super_admin', 'admin', 'ngo', 'accounts', 'worker'), enrollFingerprint);
router.post('/verify', authenticateRole('super_admin', 'admin', 'ngo', 'accounts', 'event_head', 'worker'), verifyFingerprint);
router.get('/beneficiary/:id', authenticateRole('super_admin', 'admin', 'ngo', 'accounts', 'event_head', 'worker'), getBiometricDetails);
router.post('/:id/revoke', authenticateRole('super_admin', 'admin', 'ngo'), revokeFingerprint);

export default router;
