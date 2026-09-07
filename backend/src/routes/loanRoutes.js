import { Router } from 'express';
import {
  apply,
  myLoans,
  listAll,
  listPending,
  decide,
  getWorkerLoansHandler,
  getWorkerActiveLoans,
  settleMonthly,
} from '../controllers/loanController.js';
import { authenticateRole, authenticate } from '../middleware/authMiddleware.js';

const router = Router();

const adminOrHrOrHo = authenticateRole('super_admin', 'admin', 'hr');
const adminOrHrOrHoorAccounts = authenticateRole('super_admin', 'admin', 'hr', 'accounts');

router.post('/apply', authenticate, apply);
router.get('/my', authenticate, myLoans);

router.get('/', adminOrHrOrHo, listAll);
router.get('/pending', adminOrHrOrHo, listPending);
router.put('/:id/decide', adminOrHrOrHo, decide);
router.post('/settle', adminOrHrOrHoorAccounts, settleMonthly);
router.get('/worker/:workerId', authenticateRole('super_admin', 'admin', 'hr', 'accounts'), getWorkerLoansHandler);
router.get('/worker/:workerId/active', adminOrHrOrHo, getWorkerActiveLoans);

export default router;
