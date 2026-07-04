import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet, apiPost } from '../api/auth';
import * as XLSX from 'xlsx';

const currency = n => n != null ? '\u20B9' + Number(n).toLocaleString('en-IN') : '\u20B90';

function SkeletonBar({ w }) {
  return <div style={{ height: 14, width: w || '60%', borderRadius: 4, background: 'linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%)', backgroundSize: '200% 100%', animation: 'sk-shimmer 1.4s infinite' }}>&nbsp;</div>;
}

const printStyle = `
  @media print {
    .no-print { display: none !important; }
    body { font-family: 'Inter', sans-serif; padding: 20px; color: #000; }
    .report-header { text-align: center; margin-bottom: 20px; }
    .report-header h1 { font-size: 20px; margin: 0 0 4px; }
    .report-header .sub { font-size: 12px; color: #666; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px; }
    th, td { padding: 6px 10px; border: 1px solid #999; text-align: left; }
    th { background: #f0f0f0; font-weight: 600; }
    .summary-row { display: flex; gap: 24; margin-bottom: 16px; }
    .summary-item { border: 1px solid #ccc; padding: 8px 14px; border-radius: 4px; }
    .summary-item .lbl { font-size: 10px; color: #666; }
    .summary-item .val { font-size: 16px; font-weight: 700; }
  }
`;

export default function Reports() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [tab, setTab] = useState('day');
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reportMonth, setReportMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const printRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setSent(false);
    try {
      const params = tab === 'day'
        ? '?date=' + reportDate
        : '?month=' + reportMonth;
      const data = await apiGet('/accounts/day-end-report' + params);
      setReport(data);
    } catch (err) { alert(err.message); }
    finally { setLoading(false); }
  }, [tab, reportDate, reportMonth]);

  useEffect(() => { load(); }, [load]);

  const sendReport = async () => {
    if (!report) return;
    setSending(true);
    setSent(false);
    try {
      const label = report.isMonth ? 'Month End Report' : 'Day End Report';
      const lines = [label + ' - ' + report.date, '',
        'Total Submitted: ' + currency(report.totalSubmitted),
        'Total Collected: ' + currency(report.totalCollected),
        'Suspense: ' + currency(report.suspenseAmount) + ' (' + report.suspenseCount + ' entries)'];
      if (report.sourceBreakdown?.length > 0) {
        lines.push('', 'Source-wise Collection:');
        report.sourceBreakdown.forEach(s => lines.push('  ' + s.name + ': ' + currency(s.amount)));
      }
      if (report.suspenseEntries.length > 0) {
        lines.push('', 'Suspense Details:');
        report.suspenseEntries.forEach(e => {
          lines.push('  ' + (e.payment_id || 'No ID') + ' - ' + currency(e.amount) + ' (' + (e.bank_audit_sources?.name || 'Unknown') + ')');
        });
      }
      await apiPost('/admin/notifications/send-now', {
        title: label + ' - ' + report.date,
        body: lines.join('\n'),
        role: 'super_admin',
      });
      setSent(true);
    } catch (err) { alert(err.message); }
    finally { setSending(false); }
  };

  const exportExcel = () => {
    if (!report) return;
    const rows = [];
    if (report.sourceBreakdown?.length) {
      rows.push(report.sourceBreakdown.map(s => s.name).concat('Total'));
      rows.push(report.sourceBreakdown.map(s => s.amount).concat(report.sourceBreakdown.reduce((t, s) => t + s.amount, 0)));
      rows.push([]);
    }
    rows.push(['Total Submitted', 'Total Collected', 'Suspense']);
    rows.push([report.totalSubmitted, report.totalCollected, report.suspenseAmount]);
    rows.push([]);
    if (report.suspenseEntries.length > 0) {
      rows.push([]);
      rows.push(['Suspense Details', '', '', '', '']);
      rows.push(['Payment ID', 'Source', 'Amount', '', '']);
      report.suspenseEntries.forEach(e => {
        rows.push([e.payment_id || '---', e.bank_audit_sources?.name || 'Unknown', e.amount, '', '']);
      });
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    const label = report.isMonth ? 'Month-End-Report' : 'Day-End-Report';
    XLSX.writeFile(wb, label + '-' + report.date + '.xlsx');
  };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    w.document.write('<html><head><title>Report</title><style>' + printStyle + '</style></head><body>');
    w.document.write(printRef.current?.innerHTML || '');
    w.document.write('</body></html>');
    w.document.close();
    w.print();
  };

  const label = report?.isMonth ? 'Month End Report' : 'Day End Report';

  return (
    <div>
      <style>{printStyle}</style>

      <div className="no-print" style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid var(--line)' }}>
        <button onClick={() => setTab('day')}
          style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', color: tab === 'day' ? 'var(--sage)' : 'var(--ink-soft)', borderBottom: tab === 'day' ? '2px solid var(--sage)' : '2px solid transparent', marginBottom: -2 }}>
          Day End
        </button>
        <button onClick={() => setTab('month')}
          style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', color: tab === 'month' ? 'var(--sage)' : 'var(--ink-soft)', borderBottom: tab === 'month' ? '2px solid var(--sage)' : '2px solid transparent', marginBottom: -2 }}>
          Month End
        </button>
      </div>

      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{label}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {tab === 'day'
            ? <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)}
                style={{ fontSize: 13, padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }} />
            : <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)}
                style={{ fontSize: 13, padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }} />
          }
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
        <div ref={printRef}>
          <div className="report-header" style={{ textAlign: 'center', marginBottom: 16 }}>
            <h1 style={{ fontSize: 18, margin: '0 0 2px', fontWeight: 700 }}>{label}</h1>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{report.date}</div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#5B6B4E08' }}>
                    <th style={{ padding: '10px 14px', borderBottom: '2px solid var(--line)', textAlign: 'center', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--ink-soft)' }}>Total Submitted</th>
                    <th style={{ padding: '10px 14px', borderBottom: '2px solid var(--line)', textAlign: 'center', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--ink-soft)' }}>Total Collected</th>
                    <th style={{ padding: '10px 14px', borderBottom: '2px solid var(--line)', textAlign: 'center', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--ink-soft)' }}>Suspense</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '12px 14px', textAlign: 'center', color: '#B5603A', fontSize: 24, fontWeight: 700 }}>{currency(report.totalSubmitted)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', color: '#5B6B4E', fontSize: 24, fontWeight: 700 }}>{currency(report.totalCollected)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', color: '#dc2626', fontSize: 24, fontWeight: 700 }}>{currency(report.suspenseAmount)}<br /><span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ink-soft)' }}>{report.suspenseCount} unverified entries</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {report.sourceBreakdown && report.sourceBreakdown.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-head"><h3>Source-wise Collection</h3></div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {report.sourceBreakdown.map(s => <th key={s.name} style={{ textAlign: 'center' }}>{s.name}</th>)}
                      <th style={{ textAlign: 'center', color: 'var(--sage)' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {report.sourceBreakdown.map(s => <td key={s.name} style={{ textAlign: 'center', color: 'var(--sage)', fontWeight: 600, fontSize: 16 }}>{currency(s.amount)}</td>)}
                      <td style={{ textAlign: 'center', color: '#5B6B4E', fontWeight: 700, fontSize: 18 }}>{currency(report.sourceBreakdown.reduce((t, s) => t + s.amount, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {report.suspenseEntries.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
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
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-soft)' }}>No data for this period</div>
      )}

      {report && (
        <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {sent && <span style={{ fontSize: 13, color: 'var(--sage)', fontWeight: 600, alignSelf: 'center' }}>Report sent to Super Admin</span>}
          <button className="btn" onClick={exportExcel} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export Excel
          </button>
          <button className="btn" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print
          </button>
          <button className="btn btn-primary" onClick={sendReport} disabled={sending} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            {sending ? 'Sending...' : 'Send to Super Admin'}
          </button>
        </div>
      )}
    </div>
  );
}
