import db from '../config/db.js';

// Idempotent bootstrap for the reminder_payments table. Records every payment
// made against a reminder (amount varies between cycles), so bill-reminder
// clients can show a per-payment amount history that a single mutable
// reminders.amount column cannot.
const CREATE_PAYMENTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS reminder_payments (
  id BIGSERIAL PRIMARY KEY,
  reminder_id BIGINT NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
  amount NUMERIC,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  transaction_id TEXT,
  paid_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
`;

export async function ensureReminderPaymentSchema() {
  try {
    await db._pool.query(CREATE_PAYMENTS_TABLE_SQL);
    await db._pool.query(
      `CREATE INDEX IF NOT EXISTS idx_reminder_payments_reminder ON reminder_payments (reminder_id)`
    );
    console.log('reminder_payments table ready');
  } catch (e) {
    console.warn('[reminder payments schema] skip:', e?.message || String(e));
  }
}