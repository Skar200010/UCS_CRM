import { Router } from 'express';
import { punchIn, punchOut, todayStatus, myHistory, listAll, updateAttendanceRecord, createAttendanceByHR, deleteAttendanceRecord, getWorkerMonthlyAttendance } from '../controllers/attendanceController.js';
import { authenticateRole, authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/punch-in', authenticate, punchIn);
router.post('/punch-out', authenticate, punchOut);
router.get('/today', authenticate, todayStatus);
router.get('/history', authenticate, myHistory);
router.get('/all', authenticateRole('super_admin', 'admin', 'hr'), listAll);
router.post('/', authenticateRole('super_admin', 'admin', 'hr'), createAttendanceByHR);
router.put('/:id', authenticateRole('super_admin', 'admin', 'hr'), updateAttendanceRecord);
router.delete('/:id', authenticateRole('super_admin', 'admin', 'hr'), deleteAttendanceRecord);
router.get('/worker/:id', authenticateRole('super_admin', 'admin', 'hr'), getWorkerMonthlyAttendance);

export default router;
