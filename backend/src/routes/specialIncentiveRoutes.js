import { Router } from 'express';
import { authenticateRole } from '../middleware/authMiddleware.js';
import {
  createHandler,
  activeHandler,
  historyHandler,
  cancelHandler,
  refreshHandler,
  detailHandler,
  leaderboardHandler,
} from '../controllers/specialIncentiveController.js';

const router = Router();

const sirLevel = authenticateRole('super_admin', 'admin');
// Anyone who should see the live popup: FROs, Accounts, HR, Admin, Super Admin.
const popupLevel = authenticateRole('super_admin', 'admin', 'accounts', 'hr', 'worker', 'fro');

router.post('/', sirLevel, createHandler);
router.get('/active', popupLevel, activeHandler);
router.get('/', sirLevel, historyHandler);
router.get('/:id/leaderboard', popupLevel, leaderboardHandler);
router.get('/:id', popupLevel, detailHandler);
router.post('/:id/refresh', popupLevel, refreshHandler);
router.post('/:id/cancel', sirLevel, cancelHandler);

export default router;