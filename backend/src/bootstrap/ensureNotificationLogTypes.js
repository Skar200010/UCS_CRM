import db from '../config/db.js';

// The `notification_log` table carries a stale CHECK constraint
// (notification_log_type_check) that only allows a handful of legacy types
// (admin/birthday/punch_reminder/punch_out_reminder/lead_rejected). The app
// emits many more type values (suspense_alert, lead_verified, new_audit,
// notice, special_incentive_*, ...), so every one of those inserts fails with
// 23514 silently and FRO notifications never land. The type column is app-
// controlled routing text (NOT NULL), so the CHECK adds no real value — drop
// it idempotently on every boot.
const DROP_STALE_CHECK_SQL = `
ALTER TABLE notification_log DROP CONSTRAINT IF EXISTS notification_log_type_check;
`;

export async function ensureNotificationLogTypes() {
  try {
    await db._pool.query(DROP_STALE_CHECK_SQL);
    console.log('notification_log type check constraint dropped');
  } catch (e) {
    console.warn('[notification_log types schema] skip:', e?.message || String(e));
  }
}