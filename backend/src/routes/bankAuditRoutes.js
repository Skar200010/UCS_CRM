import { Router } from 'express';
import { authenticateRole } from '../middleware/authMiddleware.js';
import {
  listSources, addSource, editSource, removeSource,
  listEntries, addEntry, editEntry, removeEntry, getSummary,
  suggestEntries, markEntryVerified,
} from '../controllers/bankAuditController.js';

const router = Router();

router.use(authenticateRole('accounts', 'super_admin'));

router.get('/sources', listSources);
router.post('/sources', addSource);
router.put('/sources/:id', editSource);
router.delete('/sources/:id', removeSource);

router.get('/entries', listEntries);
router.post('/entries', addEntry);
router.put('/entries/:id', editEntry);
router.delete('/entries/:id', removeEntry);

router.get('/entries/suggest', suggestEntries);
router.put('/entries/:id/verify', markEntryVerified);

router.get('/summary', getSummary);

export default router;
