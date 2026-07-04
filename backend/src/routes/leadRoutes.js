import jwt from 'jsonwebtoken';
import { Router } from 'express';
import { addLead, listLeads, getLead, editLead, removeLead, transferLeadOwner, dashboard } from '../controllers/leadController.js';
import { authenticateRole } from '../middleware/authMiddleware.js';

const router = Router();

const hrOrAbove = authenticateRole('super_admin', 'hoadmin', 'hr', 'recruiter');

const leadReadWrite = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const allowedRoles = ['super_admin', 'hoadmin', 'hr', 'recruiter', 'telecaller'];
    const isFroWorker = decoded.role === 'worker' && (decoded.department || '').toLowerCase().trim() === 'fro';
    if (!allowedRoles.includes(decoded.role) && !isFroWorker) {
      return res.status(403).json({ message: 'Access denied. Required role: super_admin, hoadmin, hr, recruiter, or telecaller' });
    }
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

router.get('/dashboard', hrOrAbove, dashboard);
router.post('/', hrOrAbove, addLead);
router.get('/', leadReadWrite, listLeads);
router.get('/:id', leadReadWrite, getLead);
router.put('/:id', leadReadWrite, editLead);
router.put('/:id/transfer', hrOrAbove, transferLeadOwner);
router.delete('/:id', leadReadWrite, removeLead);

export default router;
