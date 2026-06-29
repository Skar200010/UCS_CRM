import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { adminLogin, unifiedLogin } from '../controllers/authController.js';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts, please try again later.' },
});

const router = Router();

router.post('/admin/login', authLimiter, adminLogin);
router.post('/worker/login', authLimiter, unifiedLogin);
router.post('/login', authLimiter, unifiedLogin);

export default router;
