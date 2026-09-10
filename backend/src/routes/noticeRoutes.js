import { Router } from 'express';
import {
  addNotice,
  listNotices,
  getNotice,
  editNotice,
  removeNotice,
  markSeen,
} from '../controllers/noticeController.js';
import { authenticateRole } from '../middleware/authMiddleware.js';

const router = Router();

const adminOrHr = authenticateRole('super_admin', 'admin', 'hr');

const noticeReadRoles = authenticateRole('super_admin', 'admin', 'hr', 'accounts', 'recruiter', 'leads', 'telecaller', 'team_lead', 'worker', 'fro', 'event_head', 'ngo');

router.post('/', adminOrHr, addNotice);
router.get('/', noticeReadRoles, listNotices);
router.post('/:id/seen', noticeReadRoles, markSeen);
router.get('/:id', adminOrHr, getNotice);
router.put('/:id', adminOrHr, editNotice);
router.delete('/:id', authenticateRole('super_admin', 'admin', 'hr'), removeNotice);

export default router;
