import { Router } from 'express';
import { authenticateRole } from '../middleware/authMiddleware.js';
import {
  listNgoSuspense, linkSuspenseToDonor, markSuspenseUnmatched, searchDonorsForSuspense,
} from '../controllers/bankAuditController.js';
import {
  listLeads,
  createLead,
  importLeads,
  assignLeads,
  transferLead,
  getLeadHistory,
  getDuplicateLeads,
  getFullDonorDetail,
  getDonorReceipts,
  getDonorFollowups,
  createFollowup,
  getDonorTransactions,
} from '../controllers/ngoAdminController.js';
import {
  getDonors,
  getDonorDetail,
  getFroWorkers,
  getAccessibleNgos,
  getAssignments,
  setTarget,
  getTargets,
  getDashboard,
  getDailyTarget,
  getFroWiseCollection,
  setAchievedTarget,
  setIncentive,
  getAccountsPending,
  verifyLeadDone,
  getStations,
  saveStationAssignment,
  removeStationAssignment,
  removeStationByName,
  createStationHandler,
  reassignStationFro,
  updateStationNgos,
  getStationStats,
  getDonorsByStation,
  getNewData,
  distributeNewData,
  getAlerts,
  acknowledgeAlert,
  getRejectedLeads,
  acknowledgeRejectedLead,
  getDataRequests,
  resolveDataRequest,
  transferStationData,
  returnTransferEarly,
  getTransferHistory,
  getTransferDonors,
  getIncentives,
  getVerificationFroWise,
  getFroPerformance,
  masterSearch,
  getCallAnalytics,
  getFroSummary,
} from '../controllers/ngoAdminController.js';

const router = Router();

router.get('/rejected-leads', authenticateRole('admin', 'super_admin'), getRejectedLeads);
router.put('/rejected-leads/:id/acknowledge', authenticateRole('admin', 'super_admin'), acknowledgeRejectedLead);

router.use(authenticateRole('admin', 'super_admin'));

router.get('/dashboard', getDashboard);
router.get('/dashboard/daily-target', getDailyTarget);
router.get('/dashboard/station-stats', getStationStats);
router.get('/ngos', getAccessibleNgos);
router.get('/donors', getDonors);
router.get('/donors/:mobile', getDonorDetail);
router.get('/donors-by-station', getDonorsByStation);
router.get('/fro-workers', getFroWorkers);
router.get('/assignments', getAssignments);
router.get('/targets', getTargets);
router.post('/targets', setTarget);
router.get('/collections/fro-wise', getFroWiseCollection);
router.get('/fro-performance', getFroPerformance);
router.get('/fro/:id/summary', getFroSummary);
router.post('/achieved-target', setAchievedTarget);
router.get('/incentives', getIncentives);
router.post('/incentive', setIncentive);
router.get('/verification', getVerificationFroWise);
router.get('/accounts/pending', getAccountsPending);
router.post('/accounts/:logId/verify', verifyLeadDone);

router.get('/stations', getStations);
router.post('/stations', createStationHandler);
router.post('/station-assignments', saveStationAssignment);
router.delete('/station-assignments/:id', removeStationAssignment);
router.put('/station-assignments/:id/reassign', reassignStationFro);
router.put('/stations/:station/update-ngos', updateStationNgos);
router.delete('/stations/:station', removeStationByName);
router.post('/stations/:station/transfer-data', transferStationData);
router.get('/transfers', getTransferHistory);
router.get('/transfers/:id/donors', getTransferDonors);
router.post('/transfers/:id/return-early', returnTransferEarly);

router.get('/new-data', getNewData);
router.post('/new-data/distribute', distributeNewData);

router.get('/alerts', getAlerts);
router.put('/alerts/:id/acknowledge', acknowledgeAlert);

router.get('/database-requests', getDataRequests);
router.put('/database-requests/:id/resolve', resolveDataRequest);

router.get('/suspense', listNgoSuspense);
router.put('/suspense/:id/link-donor', linkSuspenseToDonor);
router.put('/suspense/:id/no-match', markSuspenseUnmatched);
router.get('/suspense/search-donors', searchDonorsForSuspense);

// Donor CRM
router.get('/donor-crm/leads', listLeads);
router.post('/donor-crm/leads', createLead);
router.post('/donor-crm/leads/import', importLeads);
router.put('/donor-crm/leads/assign', assignLeads);
router.put('/donor-crm/leads/:id/transfer', transferLead);
router.get('/donor-crm/leads/history', getLeadHistory);
router.get('/donor-crm/duplicates', getDuplicateLeads);
router.get('/donor-crm/donors/:id', getFullDonorDetail);
router.get('/donor-crm/donors/:id/receipts', getDonorReceipts);
router.get('/donor-crm/donors/:id/followups', getDonorFollowups);
router.get('/donor-crm/donors/:id/transactions', getDonorTransactions);
router.post('/donor-crm/followups', createFollowup);

router.get('/master-search', masterSearch);
router.get('/call-analytics', getCallAnalytics);

export default router;
