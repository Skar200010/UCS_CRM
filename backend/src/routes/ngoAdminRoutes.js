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
  getDataRequests,
  resolveDataRequest,
  transferStationData,
  returnTransferEarly,
  getActiveTransfers,
} from '../controllers/ngoAdminController.js';

const router = Router();

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
router.get('/transfers', getActiveTransfers);
router.post('/transfers/:id/return-early', returnTransferEarly);

router.get('/new-data', getNewData);
router.post('/new-data/distribute', distributeNewData);

router.get('/alerts', getAlerts);
router.put('/alerts/:id/acknowledge', acknowledgeAlert);

router.get('/database-requests', getDataRequests);
router.put('/database-requests/:id/resolve', resolveDataRequest);

export default router;
