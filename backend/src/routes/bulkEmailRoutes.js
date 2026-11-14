import { Router } from 'express';
import multer from 'multer';
import { authenticateRole } from '../middleware/authMiddleware.js';
import {
  cancelCampaign,
  createTemplate,
  deleteTemplate,
  getLog,
  getTemplate,
  getTemplateAttachment,
  listLogs,
  listRecipients,
  listTemplates,
  previewTemplate,
  resumeCampaign,
  send,
  updateTemplate,
  uploadAsset,
} from '../controllers/bulkEmailController.js';

const router = Router();
const roles = authenticateRole('accounts', 'admin', 'super_admin');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const uploadImage = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const handleUpload = (req, res, next) => {
  upload.single('attachment')(req, res, (error) => {
    if (!error) return next();
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'Attachment must be 20 MB or smaller.'
      : error.message || 'Could not upload attachment.';
    return res.status(400).json({ message });
  });
};

const handleImageUpload = (req, res, next) => {
  uploadImage.single('file')(req, res, (error) => {
    if (!error) return next();
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'Image must be 5 MB or smaller.'
      : error.message || 'Could not upload image.';
    return res.status(400).json({ message });
  });
};

router.get('/recipients', roles, listRecipients);
router.get('/templates', roles, listTemplates);
router.post('/templates/preview', roles, previewTemplate);
router.get('/templates/:id/attachment', roles, getTemplateAttachment);
router.get('/templates/:id', roles, getTemplate);
router.post('/templates', roles, handleUpload, createTemplate);
router.put('/templates/:id', roles, handleUpload, updateTemplate);
router.delete('/templates/:id', roles, deleteTemplate);
router.post('/assets', roles, handleImageUpload, uploadAsset);
router.get('/logs', roles, listLogs);
router.post('/logs/:id/resume', roles, resumeCampaign);
router.post('/logs/:id/cancel', roles, cancelCampaign);
router.get('/logs/:id', roles, getLog);
router.post('/send', roles, handleUpload, send);

export default router;
