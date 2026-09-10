import { useEffect, useState } from 'react';
import { useHR } from '../store';
import { Check, X } from '../icons';
import { SkeletonRows } from './ui';

function fmtDate(d) {
  if (!d) return '—';
  const raw = String(d);
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw + 'T00:00:00+05:30' : raw);
  if (isNaN(date.getTime())) return '—';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${date.getFullYear()}`;
}

function fmtMonth(d) {
  if (!d) return '';
  const raw = String(d);
  const m = raw.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(m) ? m : '';
}

function fmtAmount(n) {
  return '₹' + parseFloat(n || 0).toLocaleString('en-IN');
}

function StatusBadge({ status }) {
  const map = {
    pending: { cls: 'pill-gold', lbl: 'Pending' },
    approved: { cls: 'pill-green', lbl: 'Approved' },
    active: { cls: 'pill-green', lbl: 'Active' },
    rejected: { cls: 'pill-danger', lbl: 'Rejected' },
    closed: { cls: 'pill-gray', lbl: 'Closed' },
  };
  const { cls, lbl } = map[status] || { cls: 'pill-gray', lbl: status };
  return <span className={`pill ${cls}`}>{lbl}</span>;
}

const inputStyle = { width: '100%', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: 12 };
const labelStyle = { fontSize: 11, color: 'var(--ink-soft)' };

export default function Loans() {
  const { fetchLoans, fetchWorkers, decideLoan, settleLoans, updateLoanApi, deleteLoanApi, createLoanApi } = useHR();
  const [loans, setLoans] = useState([]);
  const [approving, setApproving] = useState(null);
  const [monthlyDeduction, setMonthlyDeduction] = useState('');
  const [hrRemark, setHrRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settleMonth, setSettleMonth] = useState(() => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  });
  const [settleBusy, setSettleBusy] = useState(false);
  const [settleMsg, setSettleMsg] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editBusy, setEditBusy] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [workers, setWorkers] = useState([]);
  const [createForm, setCreateForm] = useState({
    worker_id: '', type: 'loan', total_amount: '',
    monthly_deduction: '', reason: '', start_month: '',
    end_month: '', recurring: false,
  });
  const [createBusy, setCreateBusy] = useState(false);
  const [workerSearch, setWorkerSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchLoans().then(data => { if (!cancelled) setLoans(data); }).catch((err) => { console.error('API error:', err.message); }).finally(() => { if (!cancelled) setLoading(false); });
    fetchWorkers('active').then(data => { if (!cancelled) setWorkers(Array.isArray(data) ? data : []); }).catch((err) => { console.error('API error:', err.message); });
    return () => { cancelled = true; };
  }, []);

  const openCreate = () => {
    const d = new Date();
    setCreateForm({
      worker_id: '', type: 'loan', total_amount: '',
      monthly_deduction: '', reason: '',
      start_month: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'),
      end_month: '', recurring: false,
    });
    setWorkerSearch('');
    setShowCreate(true);
  };

  const submitCreate = async () => {
    const worker = workers.find(w => w.id === createForm.worker_id);
    if (!worker) { alert('Please select a worker'); return; }
    if (!createForm.total_amount || parseFloat(createForm.total_amount) <= 0) { alert('Please enter a valid amount'); return; }
    if (!createForm.monthly_deduction || parseFloat(createForm.monthly_deduction) <= 0) { alert('Please enter a monthly deduction amount'); return; }
    if (!createForm.recurring && parseFloat(createForm.monthly_deduction) > parseFloat(createForm.total_amount)) { alert('Monthly deduction cannot exceed the total amount'); return; }
    if (!createForm.reason || !createForm.reason.trim()) { alert('Please enter a reason'); return; }
    setCreateBusy(true);
    try {
      await createLoanApi({
        worker_id: createForm.worker_id,
        type: createForm.type,
        total_amount: parseFloat(createForm.total_amount),
        monthly_deduction: parseFloat(createForm.monthly_deduction),
        reason: createForm.reason.trim(),
        recurring: createForm.recurring,
        start_month: createForm.start_month ? createForm.start_month + '-01' : null,
        end_month: createForm.end_month ? createForm.end_month + '-01' : null,
      });
      setShowCreate(false);
      setCreateForm({ worker_id: '', type: 'loan', total_amount: '', monthly_deduction: '', reason: '', start_month: '', end_month: '', recurring: false });
      setWorkerSearch('');
      refresh();
    } catch (e) {
      alert(e.message);
    } finally {
      setCreateBusy(false);
    }
  };

  const stopRecurring = async (loan) => {
    const label = loan.workers?.name || 'Unknown';
    if (!window.confirm(`Stop the recurring deduction (${fmtAmount(loan.monthly_deduction)}/mo) for ${label}? Future months will no longer be deducted.`)) return;
    try {
      await updateLoanApi(loan.id, { stop_recurring: true });
      refresh();
    } catch (e) {
      alert(e.message);
    }
  };

  const refresh = () => fetchLoans().then(setLoans).catch((err) => { console.error('API error:', err.message); });

  const handleDecide = async (id, status) => {
    if (status === 'approved') {
      setApproving(id);
      const loan = loans.find(l => l.id === id);
      setMonthlyDeduction(String(Math.round(parseFloat(loan?.total_amount || 0) / 3)));
      setHrRemark('');
      return;
    }
    try {
      await decideLoan(id, status, 0, '');
      refresh();
    } catch (e) {
      alert(e.message);
    }
  };

  const confirmApprove = async () => {
    if (!monthlyDeduction || parseFloat(monthlyDeduction) <= 0) {
      alert('Please enter a monthly deduction amount');
      return;
    }
    setSubmitting(true);
    try {
      await decideLoan(approving, 'approved', parseFloat(monthlyDeduction), hrRemark);
      setApproving(null);
      setMonthlyDeduction('');
      setHrRemark('');
      refresh();
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (loan) => {
    setEditing(loan.id);
    setEditForm({
      total_amount: parseFloat(loan.total_amount || 0),
      monthly_deduction: parseFloat(loan.monthly_deduction || 0),
      reason: loan.reason || '',
      start_month: fmtMonth(loan.start_month),
      end_month: fmtMonth(loan.end_month),
    });
  };

  const saveEdit = async () => {
    setEditBusy(true);
    try {
      await updateLoanApi(editing, editForm);
      setEditing(null);
      setEditForm({});
      refresh();
    } catch (e) {
      alert(e.message);
    } finally {
      setEditBusy(false);
    }
  };

  const handleDelete = async (loan) => {
    const label = loan.workers?.name || 'Unknown';
    const hasDeductions = parseFloat(loan.total_deducted || 0) > 0;
    const msg = `Delete ${loan.type} for ${label} (${fmtAmount(loan.total_amount)})?${hasDeductions ? ' Its recorded salary deductions will also be removed.' : ''} This cannot be undone.`;
    if (!window.confirm(msg)) return;
    try {
      const force = ['active', 'closed'].includes(loan.status);
      await deleteLoanApi(loan.id, force);
      refresh();
    } catch (e) {
      alert(e.message);
    }
  };

  const pending = loans.filter(l => l.status === 'pending');
  const other = loans.filter(l => l.status !== 'pending');

  const filteredWorkers = workerSearch
    ? workers.filter(w => (w.name || '').toLowerCase().includes(workerSearch.toLowerCase()))
    : workers;

  const handleSettle = async () => {
    if (!settleMonth) {
      alert('Select a month first');
      return;
    }
    if (!window.confirm(`Run monthly settlement for ${settleMonth}? Deductions will be recorded once for every active loan.`)) return;
    const parts = settleMonth.split('-');
    const [year, month] = [parseInt(parts[0], 10), parseInt(parts[1], 10)];
    setSettleBusy(true);
    setSettleMsg(null);
    try {
      const res = await settleLoans(year, month);
      const deducted = parseFloat(res.total_deducted || 0).toLocaleString('en-IN');
      setSettleMsg(`Month ${settleMonth} settled: ${res.settled} loan(s), ₹${deducted} deducted` + (res.skipped ? ` · ${res.skipped} already settled` : ''));
      refresh();
    } catch (e) {
      alert(e.message);
    } finally {
      setSettleBusy(false);
    }
  };

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3>Loan & Advance Requests</h3>
          <span style={{ display:'inline-flex', alignItems:'center', gap:10 }}>
            <span className="sub">{pending.length} pending</span>
            <button className="btn btn-sm" style={{ background:'var(--sage)', color:'#fff', border:'none' }}
              onClick={openCreate}>
              + New Loan / Advance
            </button>
          </span>
        </div>
        {showCreate && (
          <div style={{ borderTop:'1px solid var(--line)', padding:'16px', background:'var(--sage-soft, #f4f7f1)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={{ fontWeight:600, fontSize:13 }}>Record a loan / advance</div>
              <span style={{ fontSize:11, color:'var(--ink-soft)' }}>Active immediately, deducted from salary monthly</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12 }}>
              <div>
                <span style={labelStyle}>Worker</span>
                <input type="text"
                  placeholder="Search worker…"
                  value={workerSearch}
                  onChange={e => setWorkerSearch(e.target.value)}
                  style={inputStyle} />
                <select
                  value={createForm.worker_id}
                  onChange={e => setCreateForm({ ...createForm, worker_id: e.target.value })}
                  style={{ ...inputStyle, marginTop: 4, minHeight: 30 }}>
                  <option value="">Select worker</option>
                  {filteredWorkers
                    .filter(w => w.employment_status === 'active' || w.is_active === true)
                    .map(w => <option key={w.id} value={w.id}>{w.name}{w.employee_id ? ` (${w.employee_id})` : ''}</option>)}
                </select>
              </div>
              <div>
                <span style={labelStyle}>Type</span>
                <div style={{ display:'flex', gap:6, marginTop:4 }}>
                  <button type="button" className="btn btn-sm"
                    onClick={() => setCreateForm({ ...createForm, type: 'loan' })}
                    style={createForm.type === 'loan' ? { background:'var(--sage)', color:'#fff', border:'none' } : {}}>
                    Loan
                  </button>
                  <button type="button" className="btn btn-sm"
                    onClick={() => setCreateForm({ ...createForm, type: 'advance' })}
                    style={createForm.type === 'advance' ? { background:'var(--sage)', color:'#fff', border:'none' } : {}}>
                    Advance
                  </button>
                </div>
              </div>
              <div>
                <span style={labelStyle}>Amount (₹)</span>
                <input type="number" min="1" step="1"
                  value={createForm.total_amount}
                  onChange={e => setCreateForm({ ...createForm, total_amount: e.target.value })}
                  style={inputStyle} />
              </div>
              <div>
                <span style={labelStyle}>{createForm.recurring ? 'Monthly Rent (₹)' : 'Monthly Deduction (₹)'}</span>
                <input type="number" min="1" step="1"
                  value={createForm.monthly_deduction}
                  onChange={e => setCreateForm({ ...createForm, monthly_deduction: e.target.value })}
                  style={inputStyle} />
              </div>
              <div style={{ display:'flex', alignItems:'flex-end', gap:8 }}>
                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--ink)' }}>
                  <input type="checkbox"
                    checked={createForm.recurring}
                    onChange={e => setCreateForm({ ...createForm, recurring: e.target.checked })} />
                  Recurring monthly rent
                </label>
              </div>
              <div>
                <span style={labelStyle}>Start Month</span>
                <input type="month"
                  value={createForm.start_month}
                  onChange={e => setCreateForm({ ...createForm, start_month: e.target.value })}
                  style={inputStyle} />
              </div>
              <div>
                <span style={labelStyle}>End Month (optional)</span>
                <input type="month"
                  value={createForm.end_month}
                  onChange={e => setCreateForm({ ...createForm, end_month: e.target.value })}
                  style={inputStyle} />
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:12, marginTop:12 }}>
              <div>
                <span style={labelStyle}>Reason</span>
                <input type="text"
                  value={createForm.reason}
                  onChange={e => setCreateForm({ ...createForm, reason: e.target.value })}
                  placeholder="e.g. PG rent, one-time advance"
                  style={inputStyle} />
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:14 }}>
              <button className="btn btn-sm" disabled={createBusy}
                onClick={() => { setShowCreate(false); setWorkerSearch(''); }}>
                Cancel
              </button>
              <button className="btn btn-sm" disabled={createBusy}
                style={{ background:'var(--sage)', color:'#fff', border:'none' }}
                onClick={submitCreate}>
                {createBusy ? 'Creating…' : 'Create loan / advance'}
              </button>
            </div>
          </div>
        )}
        <table>
          <thead>
            <tr>
              <th>Worker</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Reason</th>
              <th>Applied</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows rows={4} widths={[120, 60, 70, 130, 80, 70, 80]} />
            ) : (
              pending.map(l => (
              <tr key={l.id}>
                <td style={{ fontWeight: 500 }}>{l.workers?.name || 'Unknown'}</td>
                <td style={{ textTransform:'capitalize' }}>{l.type}</td>
                <td style={{ fontWeight:600 }}>{fmtAmount(l.total_amount)}</td>
                <td style={{ color:'var(--ink-soft)', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.reason || '—'}</td>
                <td style={{ color:'var(--ink-soft)' }}>{fmtDate(l.applied_at)}</td>
                <td><StatusBadge status={l.status} /></td>
                <td style={{ textAlign:'right' }}>
                  {approving === l.id ? (
                    <div style={{ display:'flex', flexDirection:'column', gap:6, minWidth:200 }}>
                      <div>
                        <span style={labelStyle}>Monthly Deduction (₹)</span>
                        <input type="number" min="1" step="1"
                          value={monthlyDeduction}
                          onChange={e => setMonthlyDeduction(e.target.value)}
                          style={inputStyle} />
                      </div>
                      <div>
                        <span style={labelStyle}>Remark (optional)</span>
                        <input type="text"
                          value={hrRemark}
                          onChange={e => setHrRemark(e.target.value)}
                          placeholder="e.g. Deduct over 3 months"
                          style={inputStyle} />
                      </div>
                      <div style={{ display:'flex', gap:4, justifyContent:'flex-end' }}>
                        <button className="btn btn-sm" disabled={submitting}
                          onClick={() => { setApproving(null); setMonthlyDeduction(''); setHrRemark(''); }}>
                          Cancel
                        </button>
                        <button className="btn btn-sm" disabled={submitting}
                          style={{ background:'var(--sage)', color:'#fff', border:'none' }}
                          onClick={confirmApprove}>
                          {submitting ? '...' : 'Confirm'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span style={{ display:'inline-flex', gap:6 }}>
                      <button className="btn btn-sm" onClick={() => handleDecide(l.id, 'approved')}>
                        <Check width={14} /> Approve
                      </button>
                      <button className="btn btn-sm" onClick={() => handleDecide(l.id, 'rejected')}>
                        <X width={14} />
                      </button>
                    </span>
                  )}
                </td>
              </tr>
              ))
            )}
            {!loading && !pending.length && (
              <tr><td colSpan={7}><div className="empty">No pending requests.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h3>Monthly Settlement</h3></div>
        <div className="card-pad" style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ fontSize:13, color:'var(--ink-soft)' }}>Record salary deductions for</span>
          <input
            type="month"
            value={settleMonth}
            onChange={e => setSettleMonth(e.target.value)}
            style={{ border:'1px solid var(--line)', borderRadius:'var(--radius-sm)', padding:'4px 8px', fontSize:13 }}
          />
          <button
            className="btn btn-sm"
            disabled={settleBusy}
            style={{ background:'var(--sage)', color:'#fff', border:'none' }}
            onClick={handleSettle}
          >
            {settleBusy ? 'Running…' : 'Run monthly settlement'}
          </button>
        </div>
        {settleMsg && (
          <div className="card-pad" style={{ fontSize:13, color:'var(--sage)' }}>{settleMsg}</div>
        )}
      </div>

      {other.length > 0 && (
        <div className="card">
          <div className="card-head"><h3>History</h3></div>
          <table>
            <thead>
              <tr>
                <th>Worker</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Monthly</th>
                <th>Paid So Far</th>
                <th>Remaining</th>
                <th>Period</th>
                <th>Status</th>
                <th>Decided</th>
                <th style={{ textAlign:'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {other.map(l => (
                editing === l.id ? (
                  <tr key={l.id} style={{ background: 'var(--sage-soft, #f0f4ec)' }}>
                    <td style={{ fontWeight:500 }}>{l.workers?.name || 'Unknown'}</td>
                    <td style={{ textTransform:'capitalize' }}>{l.type}</td>
                    <td>
                      <input type="number" min="1" step="1"
                        value={editForm.total_amount}
                        onChange={e => setEditForm({ ...editForm, total_amount: parseFloat(e.target.value) || 0 })}
                        style={{ ...inputStyle, width: 90 }} />
                    </td>
                    <td>
                      <input type="number" min="1" step="1"
                        value={editForm.monthly_deduction}
                        onChange={e => setEditForm({ ...editForm, monthly_deduction: parseFloat(e.target.value) || 0 })}
                        style={{ ...inputStyle, width: 80 }} />
                    </td>
                    <td style={{ color:'var(--sage)' }}>{fmtAmount(l.total_deducted)}</td>
                    <td style={{ color: parseFloat(l.remaining_amount || 0) > 0 ? 'var(--danger)' : 'var(--ink-soft)' }}>{fmtAmount(l.remaining_amount)}</td>
                    <td>
                      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                        <input type="month" value={editForm.start_month}
                          onChange={e => setEditForm({ ...editForm, start_month: e.target.value })}
                          style={{ ...inputStyle, width: 110 }} />
                        <span style={{ fontSize:11, color:'var(--ink-soft)' }}>to</span>
                        <input type="month" value={editForm.end_month}
                          onChange={e => setEditForm({ ...editForm, end_month: e.target.value })}
                          style={{ ...inputStyle, width: 110 }} />
                      </div>
                    </td>
                    <td><StatusBadge status={l.status} /></td>
                    <td style={{ color:'var(--ink-soft)' }}>{l.decided_at ? fmtDate(l.decided_at) : '—'}</td>
                    <td style={{ textAlign:'right', display:'flex', gap:4, justifyContent:'flex-end' }}>
                      <button className="btn btn-sm" disabled={editBusy}
                        onClick={() => { setEditing(null); setEditForm({}); }}>
                        Cancel
                      </button>
                      <button className="btn btn-sm" disabled={editBusy}
                        style={{ background:'var(--sage)', color:'#fff', border:'none' }}
                        onClick={saveEdit}>
                        {editBusy ? '…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                ) : (
                <tr key={l.id}>
                  <td style={{ fontWeight:500 }}>{l.workers?.name || 'Unknown'}</td>
                  <td style={{ textTransform:'capitalize' }}>{l.type}</td>
                  <td style={{ fontWeight:600 }}>{fmtAmount(l.total_amount)}</td>
                  <td>{parseFloat(l.monthly_deduction || 0) > 0 ? fmtAmount(l.monthly_deduction) : '—'}</td>
                  <td style={{ color:'var(--sage)' }}>
                    {parseFloat(l.total_deducted || 0) > 0 ? fmtAmount(l.total_deducted) : '—'}
                  </td>
                  <td style={{ color: parseFloat(l.remaining_amount || 0) > 0 ? 'var(--danger)' : 'var(--ink-soft)' }}>
                    {parseFloat(l.remaining_amount || 0) > 0 ? fmtAmount(l.remaining_amount) : '—'}
                  </td>
                  <td style={{ fontSize:12, color:'var(--ink-soft)' }}>
                    {l.start_month ? fmtMonth(l.start_month) : '—'} → {l.end_month ? fmtMonth(l.end_month) : (l.recurring ? 'Recurring' : '∞')}
                  </td>
                  <td>
                    <span style={{ display:'inline-flex', gap:5, alignItems:'center', flexWrap:'wrap' }}>
                      <StatusBadge status={l.status} />
                      {l.recurring && l.status === 'active' && (
                        <span className="pill pill-gold">Recurring</span>
                      )}
                    </span>
                  </td>
                  <td style={{ color:'var(--ink-soft)' }}>{l.decided_at ? fmtDate(l.decided_at) : '—'}</td>
                  <td style={{ textAlign:'right' }}>
                    {['pending', 'active'].includes(l.status) && (
                      <span style={{ display:'inline-flex', gap:4, justifyContent:'flex-end', flexWrap:'wrap' }}>
                        {l.recurring && l.status === 'active' && (
                          <button className="btn btn-sm" style={{ color:'var(--danger)' }} onClick={() => stopRecurring(l)}>Stop</button>
                        )}
                        <button className="btn btn-sm" onClick={() => startEdit(l)}>Edit</button>
                        <button className="btn btn-sm" style={{ color:'var(--danger)' }} onClick={() => handleDelete(l)}>Delete</button>
                      </span>
                    )}
                    {l.status === 'rejected' && (
                      <button className="btn btn-sm" style={{ color:'var(--danger)' }} onClick={() => handleDelete(l)}>Delete</button>
                    )}
                  </td>
                </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
