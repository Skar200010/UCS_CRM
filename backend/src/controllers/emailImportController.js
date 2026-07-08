import { pollEmailInbox, getLastPollResult } from '../services/emailImporter.js';
import { getImportLog, countByStatus } from '../models/emailImportLogModel.js';

export async function triggerImport(req, res) {
  try {
    const fromDate = req.query.fromDate || null;
    const result = await pollEmailInbox(fromDate);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getImportStatus(req, res) {
  try {
    const lastPoll = getLastPollResult();
    const counts = await countByStatus();
    return res.json({ lastPoll, counts });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function getLog(req, res) {
  try {
    const { status, account_id } = req.query;
    const log = await getImportLog({ status, account_id, limit: 100 });
    return res.json(log);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
