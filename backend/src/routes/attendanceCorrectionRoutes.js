import { Router } from 'express';
import { authenticate, authenticateRole } from '../middleware/authMiddleware.js';
import {
  raiseTicket,
  myTickets,
  listPending,
  listHrVerified,
  listAllTickets,
  getTicket,
  verifyTicket,
  approveTicket,
  rejectTicket,
  pendingCount,
} from '../controllers/attendanceCorrectionController.js';

const router = Router();

router.post('/', authenticate, raiseTicket);
router.get('/my', authenticate, myTickets);
router.get('/pending', authenticateRole('super_admin', 'hoadmin', 'hr'), listPending);
router.get('/hr-verified', authenticateRole('super_admin'), listHrVerified);
router.get('/all', authenticateRole('super_admin', 'hoadmin', 'hr'), listAllTickets);
router.get('/pending-count', authenticateRole('super_admin', 'hoadmin', 'hr'), pendingCount);
router.get('/:id', authenticateRole('super_admin', 'hoadmin', 'hr'), getTicket);
router.put('/:id/verify', authenticateRole('super_admin', 'hoadmin', 'hr'), verifyTicket);
router.put('/:id/approve', authenticateRole('super_admin'), approveTicket);
router.put('/:id/reject', authenticateRole('super_admin', 'hoadmin', 'hr'), rejectTicket);

export default router;
