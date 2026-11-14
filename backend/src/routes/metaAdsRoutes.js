import { Router } from 'express';
import { authenticateRole } from '../middleware/authMiddleware.js';
import {
  metaAdsStatus,
  listMetaAdAccounts,
  listMetaCampaigns,
  getMetaCampaignInsights,
  getMetaInsightsSummary,
  getMetaFunnelHandler,
  syncMetaInsights,
  syncMetaLeads,
  listMetaForms,
  saveMetaForm,
  deleteMetaForm,
} from '../controllers/metaAdsController.js';

const router = Router();
const READ_ROLES = ['accounts', 'super_admin', 'admin', 'master', 'user'];
const WRITE_ROLES = ['accounts', 'super_admin', 'admin'];

router.get('/status', authenticateRole(...READ_ROLES), metaAdsStatus);
router.get('/ad-accounts', authenticateRole(...READ_ROLES), listMetaAdAccounts);
router.get('/campaigns', authenticateRole(...READ_ROLES), listMetaCampaigns);
router.get('/campaigns/:id/insights', authenticateRole(...READ_ROLES), getMetaCampaignInsights);

router.get('/insights/summary', authenticateRole(...READ_ROLES), getMetaInsightsSummary);
router.get('/funnel', authenticateRole(...READ_ROLES), getMetaFunnelHandler);
router.post('/insights/sync', authenticateRole(...WRITE_ROLES), syncMetaInsights);
router.post('/leads/sync', authenticateRole(...WRITE_ROLES), syncMetaLeads);

router.get('/forms', authenticateRole(...READ_ROLES), listMetaForms);
router.post('/forms', authenticateRole(...WRITE_ROLES), saveMetaForm);
router.delete('/forms/:formId', authenticateRole(...WRITE_ROLES), deleteMetaForm);

export default router;
