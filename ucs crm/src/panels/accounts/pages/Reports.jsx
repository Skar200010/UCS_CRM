import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '../api/auth';

const currency = n => n != null ? '\u20B9' + Number(n).toLocaleString('en-IN') : '\u20B90';

function SkeletonBar({ w }) {
  return <div style={{ height: 14, width: w || '60%', borderRadius: 4, background: 'linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%)', backgroundSize: '200% 100%', animation: 'sk-shimmer 1.4s infinite' }}>&nbsp;</div>;
}

export default function Reports() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split('T')[0]);

  const load = useCallback(async () => {
    setLoading(true);
    setSent(false);
    try {
      const data = await apiGet('/accounts/day-end-report?date=' + reportDate);
      setReport(data);
    } catch (err) { alert(err.message); }
    finally { setLoading(false); }
  }, [reportDate]);

  useEffect(() => { load(); }, [load]);

  const sendReport = async () => {
    setSending(true);
    setSent(false);
    try {
      const lines = [];
      lines.push('Day End Report - ' + report.date);
      lines.push('');
      lines.push('FRO-wise Breakdown:');
      report.froWorkers.forEach(w => {
        lines.push('  ' + w.name + ' (' + w.login + '): Submitted ' + currency(w.submitted) + ' | Collected ' + currency(w.collected));
      });
      lines.push('');
      lines.push('Total Submitted: ' + currency(report.totalSubmitted));
      lines.push('Total Collected: ' + currency(report.totalCollected));
      lines.push('');
      lines.push('Suspense (Unverified Bank Entries): ' + currency(report.suspenseAmount) + ' (' + report.suspenseCount + ' entries)');
      if (report.suspenseEntries.length > 0) {
        lines.push('');
        lines.push('Suspense Details:');
        report.suspenseEntries.forEach(e => {
          lines.push('  ' + (e.payment_id || 'No ID') + ' - ' + currency(e.amount) + ' (' + (e.bank_audit_sources?.name || 'Unknown') + ')');
        });
      }

      await apiPost('/admin/notifications/send-now', {
        title: 'Day End Report - ' + report.date,
        body: lines.join('\n'),
        role: 'super_admin',
      });
      setSent(true);
    } catch (err) { alert(err.message); }
    finally { setSending(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Day End Report</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)}
            style={{ fontSize: 13, padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }} />
          <button className="btn btn-sm" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.4-3.4L23 10M1 14l5.1 4.4A9 9 0 0 0 20.5 15"/></svg>
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="stats-grid">
          <div className="stat-card" style={{ gridColumn: '1 / -1' }}><SkeletonBar w="40%" /><SkeletonBar w="20%" /></div>
          {[1, 2, 3].map(i => <div key={i} className="stat-card"><SkeletonBar w="60%" /><SkeletonBar w="30%" /></div>)}
        </div>
      ) : report ? (
        <>
          <div className="stats-grid">
            <div className="stat-card" style={{ gridColumn: '1 / -1', border: '2px solid #5B6B4E30', background: '#5B6B4E08', padding: '14px 18px' }}>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 4 }}>{report.date}</div>
              <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                <div>
                  <div className="stat-lbl">Total Submitted</div>
                  <div className="stat-num" style={{ fontSize: 22, color: '#B5603A' }}>{currency(report.totalSubmitted)}</div>
                </div>
                <div>
                  <div className="stat-lbl">Total Collected</div>
                  <div className="stat-num" style={{ fontSize: 22, color: '#5B6B4E' }}>{currency(report.totalCollected)}</div>
                </div>
                <div>
                  <div className="stat-lbl">Suspense</div>
                  <div className="stat-num" style={{ fontSize: 22, color: '#dc2626' }}>{currency(report.suspenseAmount)}</div>
                  <div className="stat-lbl" style={{ fontSize: 10 }}>({report.suspenseCount} unverified entries)</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>FRO-wise Breakdown</h3></div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>FRO Name</th>
                    <th>Login ID</th>
                    <th>Submitted</th>
                    <th>Collected</th>
                    <th>Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {report.froWorkers.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>No activity today</td></tr>
                  ) : (
                    report.froWorkers.map(w => (
                      <tr key={w.id}>
                        <td><strong>{w.name}</strong></td>
                        <td style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{w.login}</td>
                        <td style={{ color: '#B5603A', fontWeight: 600 }}>{currency(w.submitted)}</td>
                        <td style={{ color: 'var(--sage)', fontWeight: 600 }}>{currency(w.collected)}</td>
                        <td style={{ color: '#dc2626', fontWeight: 600 }}>{currency(Math.max(0, w.submitted - w.collected))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {report.suspenseEntries.length > 0 && (
            <div className="card">
              <div className="card-head"><h3>Suspense Details</h3></div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Payment ID</th>
                      <th>Source</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.suspenseEntries.map(e => (
                      <tr key={e.id}>
                        <td style={{ fontSize: 12 }}>{e.payment_id || '\u2014'}</td>
                        <td><span className="pill pill-gray">{e.bank_audit_sources?.name || 'Unknown'}</span></td>
                        <td style={{ color: '#dc2626', fontWeight: 600 }}>{currency(e.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            {sent && <span style={{ fontSize: 13, color: 'var(--sage)', fontWeight: 600, alignSelf: 'center' }}>Report sent to Super Admin</span>}
            <button className="btn btn-primary" onClick={sendReport} disabled={sending} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              {sending ? 'Sending...' : 'Send Report to Super Admin'}
            </button>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-soft)' }}>No data for this date</div>
      )}
    </div>
  );
}
