import { Router } from 'express';
import {
  submitOnboarding,
  checkOnboardingStatus,
  uploadPhoto,
  uploadDocument,
  getPolicies,
  getProfileForPrint,
  adminGetPolicies,
  adminAddPolicy,
  adminEditPolicy,
  adminRemovePolicy,
  adminUploadPhoto,
} from '../controllers/onboardingController.js';
import { authenticate, authenticateRole } from '../middleware/authMiddleware.js';

const router = Router();

// Worker-facing routes (authenticated via worker token)
router.post('/submit', authenticate, submitOnboarding);
router.get('/status', authenticate, checkOnboardingStatus);
router.post('/upload-photo', authenticate, uploadPhoto);
router.post('/upload-document', authenticate, uploadDocument);
router.get('/policies', authenticate, getPolicies);
router.get('/print-profile', authenticate, getProfileForPrint);

// Admin routes for policies management
const adminAuth = authenticateRole('super_admin', 'admin', 'hr');
router.get('/admin/policies', adminAuth, adminGetPolicies);
router.post('/admin/policies', adminAuth, adminAddPolicy);
router.put('/admin/policies/:id', adminAuth, adminEditPolicy);
router.delete('/admin/policies/:id', adminAuth, adminRemovePolicy);

// Admin: upload photo for any worker
router.post('/admin/upload-photo/:workerId', adminAuth, adminUploadPhoto);

export default router;
