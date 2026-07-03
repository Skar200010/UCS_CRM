import { Router } from 'express';
import { authenticateRole } from '../middleware/authMiddleware.js';
import {
  getDonors,
  getDonorDetail,
  getFroWorkers,
  getAccessibleNgos,
  getAssignments,
  setTarget,
  getTargets,
  getDashboard,
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
} from '../controllers/ngoAdminController.js';

const router = Router();

router.get('/rejected-leads', authenticateRole('hoadmin', 'super_admin'), getRejectedLeads);
router.put('/rejected-leads/:id/acknowledge', authenticateRole('hoadmin', 'super_admin'), acknowledgeRejectedLead);

router.use(authenticateRole('hoadmin'));

router.get('/dashboard', getDashboard);
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

export default router;
