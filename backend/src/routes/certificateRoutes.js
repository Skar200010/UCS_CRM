import { Router } from 'express';
import multer from 'multer';
import { authenticateRole } from '../middleware/authMiddleware.js';
import {
  createTemplate,
  listTemplates,
  getTemplate,
  updateTemplate,
  reuploadTemplateFile,
  duplicateTemplate,
  setTemplateStatus,
  deleteTemplate,
  previewCertificate,
  generateCertificate,
  listCertificates,
  getCertificate,
} from '../controllers/certificateController.js';

const router = Router();

const TEMPLATE_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/octet-stream',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (TEMPLATE_MIMES.has(file.mimetype) || /\.(docx|pptx)$/i.test(file.originalname || '')) return cb(null, true);
    return cb(new Error('Only .docx or .pptx templates are supported.'));
  },
});

// Wrap multer so its fileFilter errors come back as clean JSON 400s.
const singleTemplate = (req, res, next) => {
  upload.single('template')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    return next();
  });
};

const MANAGE = authenticateRole('accounts', 'super_admin', 'admin');
const USE = authenticateRole('accounts', 'super_admin', 'admin');

// Template library — accounts can fully manage templates and generate certificates.
router.get('/templates', USE, listTemplates);
router.get('/templates/:id', USE, getTemplate);
router.post('/templates', MANAGE, singleTemplate, createTemplate);
router.put('/templates/:id', MANAGE, updateTemplate);
router.post('/templates/:id/file', MANAGE, singleTemplate, reuploadTemplateFile);
router.post('/templates/:id/duplicate', MANAGE, duplicateTemplate);
router.patch('/templates/:id/status', MANAGE, setTemplateStatus);
router.delete('/templates/:id', MANAGE, deleteTemplate);

// Generator + history — available to Accounts too.
router.post('/certificates/preview', USE, previewCertificate);
router.post('/certificates/generate', USE, generateCertificate);
router.get('/certificates', USE, listCertificates);
router.get('/certificates/:id', USE, getCertificate);

export default router;