import { Router } from 'express';
import {
  addWorker,
  bulkAddWorkers,
  getWorkers,
  getWorker,
  editWorker,
  bulkEditWorkers,
  removeWorker,
  getBirthdays,
  getMyProfile,
  updateMyProfile,
  updateMyEducation,
  getWorkerAllocations,
  setWorkerAllocations,
  abscondWorkerHandler,
  offboardWorkerHandler,
} from '../controllers/workerController.js';
import { authenticateRole, authenticate } from '../middleware/authMiddleware.js';

const router = Router();

const adminOrHrOrHo = authenticateRole('super_admin', 'admin', 'hr');

router.post('/', adminOrHrOrHo, addWorker);
router.post('/bulk', adminOrHrOrHo, bulkAddWorkers);
router.put('/bulk', adminOrHrOrHo, bulkEditWorkers);
router.get('/', authenticateRole('super_admin', 'admin', 'hr', 'accounts'), getWorkers);
router.get('/birthdays', adminOrHrOrHo, getBirthdays);
router.get('/me', authenticate, getMyProfile);
router.put('/me', authenticate, updateMyProfile);
router.put('/me/education', authenticate, updateMyEducation);
router.get('/:id', adminOrHrOrHo, getWorker);
router.put('/:id', adminOrHrOrHo, editWorker);
router.delete('/:id', adminOrHrOrHo, removeWorker);
router.put('/:id/abscond', adminOrHrOrHo, abscondWorkerHandler);
router.put('/:id/offboard', adminOrHrOrHo, offboardWorkerHandler);
router.get('/:id/allocations', adminOrHrOrHo, getWorkerAllocations);
router.put('/:id/allocations', adminOrHrOrHo, setWorkerAllocations);

export default router;
