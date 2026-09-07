import db from '../config/db.js';

export const applyLoan = async (data) => {
  const { data: result, error } = await db
    .from('worker_loans')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
};

export const getWorkerLoans = async (workerId) => {
  const { data, error } = await db
    .from('worker_loans')
    .select('*')
    .eq('worker_id', workerId)
    .order('applied_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const getAllLoans = async () => {
  const { data, error } = await db
    .from('worker_loans')
    .select('*, workers(name, login_id, email, department)')
    .order('applied_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const getPendingLoans = async () => {
  const { data, error } = await db
    .from('worker_loans')
    .select('*, workers(name, login_id, email, department)')
    .eq('status', 'pending')
    .order('applied_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const getLoanById = async (id) => {
  const { data, error } = await db
    .from('worker_loans')
    .select('*, workers(name, login_id, email, department)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
};

export const updateLoan = async (id, updates) => {
  const { data, error } = await db
    .from('worker_loans')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteLoan = async (id) => {
  const { error } = await db.from('worker_loans').delete().eq('id', id);
  if (error) throw error;
};

export const getActiveLoansByWorker = async (workerId) => {
  const { data, error } = await db
    .from('worker_loans')
    .select('*')
    .eq('worker_id', workerId)
    .in('status', ['approved', 'active'])
    .gt('remaining_amount', 0);
  if (error) throw error;
  return data || [];
};

export const getActiveLoansForAllWorkers = async () => {
  const { data, error } = await db
    .from('worker_loans')
    .select('*')
    .in('status', ['approved', 'active'])
    .gt('remaining_amount', 0)
    .order('worker_id');
  if (error) throw error;
  return data || [];
};

export const createDeduction = async (loanId, month, amount) => {
  const { data, error } = await db
    .from('worker_loan_deductions')
    .insert([{ loan_id: loanId, month, amount }])
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getDeductionsForWorkerMonth = async (workerId, month) => {
  const { data, error } = await db
    .from('worker_loan_deductions')
    .select('*, worker_loans!inner(worker_id)')
    .eq('worker_loans.worker_id', workerId)
    .eq('month', month);
  if (error) throw error;
  return data || [];
};

export const getDeductionsByLoan = async (loanId) => {
  const { data, error } = await db
    .from('worker_loan_deductions')
    .select('*')
    .eq('loan_id', loanId)
    .order('month', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const getDeductionForLoanMonth = async (loanId, month) => {
  const { data, error } = await db
    .from('worker_loan_deductions')
    .select('*')
    .eq('loan_id', loanId)
    .eq('month', month)
    .maybeSingle();
  if (error) throw error;
  return data || null;
};

export const getTotalDeductedByLoanIds = async (loanIds) => {
  if (!loanIds || !loanIds.length) return {};
  const { data, error } = await db
    .from('worker_loan_deductions')
    .select('loan_id, amount')
    .in('loan_id', loanIds);
  if (error) throw error;
  const totals = {};
  for (const r of data || []) {
    totals[r.loan_id] = (totals[r.loan_id] || 0) + parseFloat(r.amount || 0);
  }
  return totals;
};

// Applies the monthly salary deduction for a given month ('YYYY-MM-01') to every
// active loan that does not already have a deduction recorded for that month.
// Idempotent: re-running a month never double-charges. Advances remaining_amount
// by the deduction and closes the loan once the balance reaches zero.
export const settleMonthlyLoanDeductions = async ({ year, month, workerId }) => {
  const monthDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const loans = workerId
    ? await getActiveLoansByWorker(workerId)
    : await getActiveLoansForAllWorkers();

  if (!loans.length) return { settled: 0, skipped: 0, total_deducted: 0 };

  const { data: existing, error: exErr } = await db
    .from('worker_loan_deductions')
    .select('loan_id')
    .eq('month', monthDate)
    .in('loan_id', loans.map((l) => l.id));
  if (exErr) throw exErr;
  const settledLoanIds = new Set((existing || []).map((r) => r.loan_id));

  let settled = 0;
  let skipped = 0;
  let total_deducted = 0;

  for (const loan of loans) {
    if (settledLoanIds.has(loan.id)) {
      skipped++;
      continue;
    }
    if (loan.start_month && monthDate < loan.start_month) { skipped++; continue; }
    if (loan.end_month && monthDate > loan.end_month) { skipped++; continue; }
    const remaining = parseFloat(loan.remaining_amount || 0);
    const monthly = parseFloat(loan.monthly_deduction || 0);
    if (monthly <= 0 || remaining <= 0) {
      skipped++;
      continue;
    }
    const amount = Math.min(monthly, remaining);
    try {
      await createDeduction(loan.id, monthDate, amount);
    } catch (e) {
      if (/duplicate|unique/i.test(e?.message || '')) {
        skipped++;
        continue;
      }
      throw e;
    }
    const newRemaining = Math.max(0, remaining - amount);
    await updateLoan(loan.id, {
      remaining_amount: newRemaining,
      status: newRemaining <= 0 ? 'closed' : loan.status,
    });
    settled++;
    total_deducted += amount;
  }

  return { settled, skipped, total_deducted };
};
