import db from '../config/db.js';

// Idempotent bootstrap for the worker_loan_deductions table. Ensures the table
// exists on server start so loan/advance monthly settlement (see
// loanModel.settleMonthlyLoanDeductions) never fails on a fresh DB.
const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS worker_loan_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES worker_loans(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(loan_id, month)
)
`;

export async function ensureLoanDeductionSchema() {
  try {
    await db._pool.query(CREATE_TABLE_SQL);
    console.log('worker_loan_deductions table ready');
  } catch (e) {
    console.warn('[loan deduction schema] skip:', e?.message || String(e));
  }
  try {
    await db._pool.query(`ALTER TABLE worker_loans ADD COLUMN IF NOT EXISTS start_month DATE`);
    await db._pool.query(`ALTER TABLE worker_loans ADD COLUMN IF NOT EXISTS end_month DATE`);
    console.log('worker_loans period columns ready');
  } catch (e) {
    console.warn('[loan period columns] skip:', e?.message || String(e));
  }
}