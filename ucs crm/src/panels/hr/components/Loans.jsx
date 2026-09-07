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

export default function Loans() {
  const { fetchLoans, decideLoan, settleLoans } = useHR();
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

  useEffect(() => {
    let cancelled = false;
    fetchLoans().then(data => { if (!cancelled) setLoans(data); }).catch((err) => { console.error('API error:', err.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

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

  const pending = loans.filter(l => l.status === 'pending');
  const other = loans.filter(l => l.status !== 'pending');

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
          <span className="sub">{pending.length} pending</span>
        </div>
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
                        <span style={{ fontSize:11, color:'var(--ink-soft)' }}>Monthly Deduction (₹)</span>
                        <input type="number" min="1" step="1"
                          value={monthlyDeduction}
                          onChange={e => setMonthlyDeduction(e.target.value)}
                          style={{ width:'100%', border:'1px solid var(--line)', borderRadius:'var(--radius-sm)', padding:'4px 8px', fontSize:12 }} />
                      </div>
                      <div>
                        <span style={{ fontSize:11, color:'var(--ink-soft)' }}>Remark (optional)</span>
                        <input type="text"
                          value={hrRemark}
                          onChange={e => setHrRemark(e.target.value)}
                          placeholder="e.g. Deduct over 3 months"
                          style={{ width:'100%', border:'1px solid var(--line)', borderRadius:'var(--radius-sm)', padding:'4px 8px', fontSize:12 }} />
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
                <th>Status</th>
                <th>Decided</th>
              </tr>
            </thead>
            <tbody>
              {other.map(l => (
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
                  <td><StatusBadge status={l.status} /></td>
                  <td style={{ color:'var(--ink-soft)' }}>{l.decided_at ? fmtDate(l.decided_at) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
