import { Router } from 'express';
import { listRecruiters, getRecruiterStats, getRecruiterOverview } from '../controllers/recruiterController.js';
import { authenticateRole } from '../middleware/authMiddleware.js';

const router = Router();

const hrOrAbove = authenticateRole('super_admin', 'admin', 'hr', 'recruiter');

router.get('/overview', hrOrAbove, getRecruiterOverview);
router.get('/', hrOrAbove, listRecruiters);
router.get('/:id/stats', hrOrAbove, getRecruiterStats);

export default router;
