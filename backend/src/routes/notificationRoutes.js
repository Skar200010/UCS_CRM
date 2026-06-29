import { Router } from 'express';
import { authenticate, authenticateRole } from '../middleware/authMiddleware.js';
import {
  registerToken,
  getNotifications,
  markRead,
  getUnreadCount,
  sendTestNotification,
  deleteNotification,
} from '../controllers/notificationController.js';

const router = Router();

router.post('/register-token', authenticate, registerToken);
router.post('/test-send', authenticateRole('super_admin', 'hoadmin', 'hr'), sendTestNotification);
router.get('/:worker_id', authenticate, getNotifications);
router.get('/:worker_id/unread-count', authenticate, getUnreadCount);
router.put('/:id/read', authenticate, markRead);
router.delete('/:id', authenticateRole('super_admin', 'hoadmin', 'hr'), deleteNotification);

export default router;
