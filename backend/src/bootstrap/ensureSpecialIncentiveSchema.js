import db from '../config/db.js';

// Idempotent bootstrap for the "Sir ka Incentive" (special day incentive)
// tables. Ensures both tables exist on server start so the special-incentive
// flow (announce -> live leaderboard -> first-past-the-post winner) never
// fails on a fresh DB.
const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS special_incentives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT,
  target_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  incentive_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  winner_worker_id UUID REFERENCES workers(id) ON DELETE SET NULL,
  winner_claimed_at TIMESTAMPTZ,
  created_by UUID REFERENCES workers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS special_incentive_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  special_incentive_id UUID NOT NULL REFERENCES special_incentives(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  collected_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  hit_target_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(special_incentive_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_special_incentives_status ON special_incentives(status);
CREATE INDEX IF NOT EXISTS idx_special_incentive_progress_inc ON special_incentive_progress(special_incentive_id);

ALTER TABLE special_incentives ADD COLUMN IF NOT EXISTS winner_name TEXT;

-- Winner photo celebration ("Photo" tab): Super Admin posts the winner's photo
-- with an (optional AI-generated) congratulation, which pops up on every panel.
ALTER TABLE special_incentives ADD COLUMN IF NOT EXISTS winner_photo_url TEXT;
ALTER TABLE special_incentives ADD COLUMN IF NOT EXISTS congrats_message TEXT;
ALTER TABLE special_incentives ADD COLUMN IF NOT EXISTS celebrated_at TIMESTAMPTZ;
`;

export async function ensureSpecialIncentiveSchema() {
  try {
    await db._pool.query(CREATE_TABLE_SQL);
    console.log('special_incentives tables ready');
  } catch (e) {
    console.warn('[special incentive schema] skip:', e?.message || String(e));
  }
}