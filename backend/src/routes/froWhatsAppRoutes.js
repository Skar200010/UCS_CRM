import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import multer from 'multer';
import {
  listConversations,
  listMessages,
  sendMessage,
  sendDirect,
  markRead,
  unreadCount,
  listQuickReplies,
  listTemplates,
  sendTemplate,
  searchMessages,
  updateLabels,
  uploadMedia,
} from '../controllers/froWhatsAppController.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

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
router.put('/conversations/:id/labels', updateLabels);

router.get('/quick-replies', listQuickReplies);
router.get('/templates', listTemplates);
router.post('/send-template', sendTemplate);
router.get('/search', searchMessages);
router.post('/upload-media', upload.single('file'), uploadMedia);

export default router;
