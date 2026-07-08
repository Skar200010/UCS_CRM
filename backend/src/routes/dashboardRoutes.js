import jwt from 'jsonwebtoken';
import { Router } from 'express';
import {
  getSuperAdminDashboard,
  getFroLiveStatus,
  getHrDashboard,
  getAdminDashboard,
  getAccountsDashboard,
  getRecruiterDashboard,
  getLeadsDashboard,
  getTelecallerDashboard,
  getTeamLeadDashboard,
  getFroWorkerDashboard,
} from '../controllers/dashboardController.js';
import { authenticateRole } from '../middleware/authMiddleware.js';

const router = Router();

const froTelecaller = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const isFroWorker = decoded.role === 'worker' && (decoded.department || '').toLowerCase().trim() === 'fro';
    if (decoded.role !== 'telecaller' && !isFroWorker) {
      return res.status(403).json({ message: 'Access denied. Telecaller or FRO required.' });
    }
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

router.get('/super-admin', authenticateRole('super_admin'), getSuperAdminDashboard);
router.get('/admin', authenticateRole('admin'), getAdminDashboard);
router.get('/hr', authenticateRole('hr'), getHrDashboard);
router.get('/accounts', authenticateRole('super_admin', 'accounts'), getAccountsDashboard);
router.get('/recruiter', authenticateRole('recruiter'), getRecruiterDashboard);
router.get('/leads', authenticateRole('leads'), getLeadsDashboard);
router.get('/telecaller', froTelecaller, getTelecallerDashboard);
router.get('/team-lead', authenticateRole('team_lead'), getTeamLeadDashboard);
router.get('/fro-live', authenticateRole('super_admin'), getFroLiveStatus);
router.get('/fro-worker/:workerId', authenticateRole('super_admin'), getFroWorkerDashboard);

export default router;
