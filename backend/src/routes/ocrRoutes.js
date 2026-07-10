import { Router } from 'express';
import { parseImage, extractImage } from '../controllers/ocrController.js';

const router = Router();

router.post('/parse', parseImage);
router.post('/extract', extractImage);

export default router;

