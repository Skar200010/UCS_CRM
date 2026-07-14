import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  listConversations,
  listMessages,
  sendMessage,
  sendDirect,
  markRead,
  unreadCount,
} from '../controllers/froWhatsAppController.js';

const router = Router();

router.use(authenticate);

const requireFro = (req, res, next) => {
  if (!req.user.department || req.user.department.toLowerCase().trim() !== 'fro') {
    return res.status(403).json({ message: 'FRO worker access required' });
  }
  next();
};

router.use(requireFro);

router.get('/conversations', listConversations);
router.get('/conversations/unread-count', unreadCount);
router.get('/conversations/:id/messages', listMessages);
router.post('/conversations/:id/send', sendMessage);
router.post('/send-direct', sendDirect);
router.put('/conversations/:id/read', markRead);

export default router;
