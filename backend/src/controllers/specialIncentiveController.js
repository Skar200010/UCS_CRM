import db from '../config/db.js';
import {
  getActiveIncentives,
  getIncentiveById,
  getLeaderboard,
  getProgressForWorker,
  createSpecialIncentive,
  cancelSpecialIncentive,
  getHistory,
  refreshSpecialIncentive,
  listPendingClaims,
  listVerifiedClaims,
  claimSpecialIncentive,
  deleteSpecialIncentive,
} from '../services/specialIncentiveService.js';

const pretty = (inc) => (inc ? {
  id: inc.id,
  title: inc.title,
  message: inc.message,
  target_amount: Number(inc.target_amount) || 0,
  incentive_amount: Number(inc.incentive_amount) || 0,
  start_at: inc.start_at,
  end_at: inc.end_at,
  status: inc.status,
  winner_worker_id: inc.winner_worker_id,
  winner_name: inc.winner_name,
  winner_claimed_at: inc.winner_claimed_at,
  claim_status: inc.claim_status || 'pending',
  claim_photo_url: inc.claim_photo_url || null,
  claimed_by: inc.claimed_by || null,
  claimed_at: inc.claimed_at || null,
  claim_remarks: inc.claim_remarks || null,
  created_at: inc.created_at,
} : null);

export async function createHandler(req, res) {
  try {
    const { title, target_amount, incentive_amount, start_at, end_at } = req.body || {};
    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }
    if (!(Number(target_amount) > 0) || !(Number(incentive_amount) > 0)) {
      return res.status(400).json({ message: 'Target and incentive amount must be greater than zero' });
    }
    if (!start_at || !end_at || new Date(start_at).getTime() >= new Date(end_at).getTime()) {
      return res.status(400).json({ message: 'End date-time must be after start date-time' });
    }
    const incentive = await createSpecialIncentive(req.body, req.user?.id);
    return res.status(201).json({ incentive: pretty(incentive) });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

// Live popup payload: currently-running incentives with their leaderboard,
// the caller's own progress, plus the most recent closed incentive so cards can
// show the final state (won/ended/cancelled).
export async function activeHandler(req, res) {
  try {
    const now = Date.now();
    const recentClosed = [];
    let incentives = await getActiveIncentives();
    incentives = incentives.filter((i) => new Date(i.start_at).getTime() <= now);
    if (incentives.length === 0) {
      const { data: lastClosed } = await db
        .from('special_incentives')
        .select('*')
        .not('status', 'eq', 'active')
        .gte('created_at', new Date(now - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1);
      recentClosed.push(...(lastClosed || []).map(pretty));
    }

    const result = [];
    for (const inc of incentives) {
      const board = await getLeaderboard(inc.id);
      const base = pretty(inc);
      const mine = req.user?.id ? await getProgressForWorker(inc.id, req.user.id) : null;
      result.push({
        ...base,
        leaderboard: (board || []).map((p) => ({
          worker_id: p.worker_id,
          name: p.workers?.name || 'Unknown',
          collected_amount: Number(p.collected_amount) || 0,
          hit_target_at: p.hit_target_at,
        })),
        mine: mine ? { worker_id: mine.worker_id, collected_amount: Number(mine.collected_amount) || 0 } : null,
      });
    }

    return res.json({ incentives: result, recent: recentClosed });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

export async function historyHandler(req, res) {
  try {
    const list = await getHistory(Number(req.query.limit) || 60);
    const enriched = [];
    for (const inc of list) {
      const base = pretty(inc);
      enriched.push({
        ...base,
        leaderboard: await getLeaderboard(inc.id),
      });
    }
    return res.json(enriched);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

export async function cancelHandler(req, res) {
  try {
    const cancelled = await cancelSpecialIncentive(req.params.id);
    if (!cancelled) {
      return res.status(400).json({ message: 'Incentive not active or already closed' });
    }
    return res.json({ incentive: pretty(cancelled) });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

export async function refreshHandler(req, res) {
  try {
    await refreshSpecialIncentive(req.params.id);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

export async function detailHandler(req, res) {
  try {
    const inc = await getIncentiveById(req.params.id);
    if (!inc) return res.status(404).json({ message: 'Incentive not found' });
    return res.json({ incentive: pretty(inc) });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

export async function leaderboardHandler(req, res) {
  try {
    return res.json({ leaderboard: await getLeaderboard(req.params.id) });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

// Accounts view: won incentives awaiting prize verification/claim, plus the
// already-verified (paid out) ones for history.
export async function claimsHandler(req, res) {
  try {
    const pending = await listPendingClaims();
    const verified = await listVerifiedClaims(Number(req.query.limit) || 60);
    return res.json({
      pending: pending.map(pretty),
      verified: verified.map(pretty),
    });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

// Accounts verifies a won incentive's prize payout by uploading a photo of the
// FRO + hard cash received. Photo is base64 (mirrors uploadPaymentScreenshot).
export async function verifyClaimHandler(req, res) {
  try {
    const inc = await getIncentiveById(req.params.id);
    if (!inc) return res.status(404).json({ message: 'Incentive not found' });
    if (inc.status !== 'won') return res.status(400).json({ message: 'Only won incentives can be verified' });
    if (inc.claim_status === 'verified') return res.status(400).json({ message: 'Prize already verified/claimed' });

    const { file_base64, mime_type, remarks } = req.body || {};
    let photoUrl = inc.claim_photo_url || null;

    if (file_base64) {
      const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
      const contentType = mime_type || 'image/jpeg';
      if (!ALLOWED.includes(contentType)) {
        return res.status(400).json({ message: `Invalid file type. Allowed: ${ALLOWED.join(', ')}` });
      }
      const buffer = Buffer.from(file_base64, 'base64');
      const ext = contentType.split('/')[1] || 'jpg';
      const fileName = `special_incentive_claims/${req.params.id}_${Date.now()}.${ext}`;

      const bucket = 'worker-documents';
      let { data: uploadData, error: uploadError } = await db.storage.from(bucket).upload(fileName, buffer, { contentType, upsert: true });
      if (uploadError) {
        if (uploadError.message?.includes('bucket')) {
          const { error: bucketError } = await db.storage.createBucket(bucket, { public: true });
          if (bucketError) return res.status(500).json({ message: 'Failed to create storage bucket: ' + bucketError.message });
          const { error: retryError } = await db.storage.from(bucket).upload(fileName, buffer, { contentType, upsert: true });
          if (retryError) return res.status(500).json({ message: 'Upload failed: ' + retryError.message });
        } else {
          return res.status(500).json({ message: 'Upload failed: ' + uploadError.message });
        }
      }
      const { data: urlData } = db.storage.from(bucket).getPublicUrl(fileName);
      photoUrl = urlData?.publicUrl;
      if (!photoUrl) return res.status(500).json({ message: 'Failed to get file URL' });
    }

    const claimed = await claimSpecialIncentive(req.params.id, {
      photoUrl,
      claimedBy: req.user?.id || null,
      remarks: typeof remarks === 'string' && remarks.trim() ? remarks.trim() : null,
    });
    if (!claimed) return res.status(400).json({ message: 'Unable to verify — incentive no longer pending' });
    return res.json({ incentive: pretty(claimed) });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

export async function deleteHandler(req, res) {
  try {
    const deleted = await deleteSpecialIncentive(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Incentive not found' });
    return res.json({ ok: true, id: deleted.id });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}
