import { Router } from 'express';
import { authenticate, authenticateRole } from '../middleware/authMiddleware.js';
import supabase from '../config/supabase.js';
import {
  listFroSuspense, resolveSuspenseEntry,
} from '../controllers/bankAuditController.js';
import {
  getDashboard,
  getMyDonors,
  getTransferredLeads,
  updateDonorStatus,
  getDonorLogs,
  createDonorLogHandler,
  getMyTarget,
  scheduleContact,
  uploadPaymentScreenshot,
  debugMyStations,
  getFroScheduled,
  getFroCallbacks,
  getMyHistory,
  requestData,
  getMyDataRequests,
  getFollowUps,
  getLeadStats,
  getMonthlyDonors,
  getDonorHistory,
  getFullDonorHistory,
  getRejectedLeads,
  updateLiveStatus,
  getLiveStatuses,
} from '../controllers/froController.js';

const router = Router();

router.use(authenticate);

router.get('/status', authenticateRole('super_admin', 'hoadmin'), getLiveStatuses);

const requireFro = (req, res, next) => {
  if (!req.user.department || req.user.department.toLowerCase().trim() !== 'fro') {
    return res.status(403).json({ message: 'FRO worker access required' });
  }
  next();
};

router.use(requireFro);

router.get('/dashboard', getDashboard);
router.get('/donors', getMyDonors);
router.get('/transferred-leads', getTransferredLeads);
router.put('/donors/:id/status', updateDonorStatus);
router.put('/donors/:id/mark-seen', async (req, res) => {
  try {
    const { id } = req.params;
    const donorId = parseInt(id);
    const { ngo_id } = req.body;
    let query = supabase
      .from('fro_assignments')
      .update({ is_new: false })
      .eq('donor_id', donorId)
      .eq('fro_worker_id', req.user.id)
      .not('status', 'eq', 'reassigned');
    if (ngo_id) query = query.eq('ngo_id', ngo_id);
    const { error } = await query;
    if (error) throw error;
    return res.json({ message: 'Marked as seen' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});
router.get('/donors/:id/logs', getDonorLogs);
router.post('/donors/:id/logs', createDonorLogHandler);
router.post('/donors/:id/schedule', scheduleContact);
router.post('/upload-payment-screenshot', uploadPaymentScreenshot);
router.get('/scheduled', getFroScheduled);
router.get('/callbacks', getFroCallbacks);
router.put('/status', updateLiveStatus);
router.get('/history', getMyHistory);
router.get('/target', getMyTarget);
router.get('/debug/my-stations', debugMyStations);
router.post('/request-data', requestData);
router.get('/database-requests', getMyDataRequests);
router.get('/follow-ups', getFollowUps);
router.get('/rejected-leads', getRejectedLeads);
router.get('/lead-stats', getLeadStats);
router.get('/monthly-donors', getMonthlyDonors);
router.get('/donors/:id/history', getDonorHistory);
router.get('/donors/:id/full-history', getFullDonorHistory);

router.get('/suspense', listFroSuspense);
router.put('/suspense/:id/resolve', resolveSuspenseEntry);

export default router;
