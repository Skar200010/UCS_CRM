import { Router } from 'express';
import { authenticateRole } from '../middleware/authMiddleware.js';
import {
  getSettingsHandler,
  updateSettingsHandler,
  listSlabsHandler,
  createSlabHandler,
  updateSlabHandler,
  deleteSlabHandler,
  dailySummaryHandler,
  froDetailHandler,
} from '../controllers/leadIncentiveController.js';

const router = Router();
const sirLevel = authenticateRole('super_admin', 'admin');

// Global lead rules (settings)
router.get('/settings', sirLevel, getSettingsHandler);
router.put('/settings', sirLevel, updateSettingsHandler);

// Slab CRUD
router.get('/slabs', sirLevel, listSlabsHandler);
router.post('/slabs', sirLevel, createSlabHandler);
router.put('/slabs/:id', sirLevel, updateSlabHandler);
router.delete('/slabs/:id', sirLevel, deleteSlabHandler);

// Lead incentive summary
router.get('/lead-summary', sirLevel, dailySummaryHandler);
router.get('/lead-summary/fro/:id', sirLevel, froDetailHandler);

export default router;
