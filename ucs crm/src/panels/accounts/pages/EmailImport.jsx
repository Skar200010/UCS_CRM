import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../api/auth';
import EmailAccountsManager from './EmailAccountsManager';

const currency = n => n != null ? '\u20B9' + Number(n).toLocaleString('en-IN') : '\u20B90';

function SkeletonTableRows({ rows, cols }) {
  return Array.from({ length: rows }, (_, i) => (
    <tr key={i}>
      {Array.from({ length: cols }, (_, j) => (
        <td key={j}>
          <div style={{ height: 12, width: j === 1 ? 180 : 80, borderRadius: 4, background: 'linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%)', backgroundSize: '200% 100%', animation: 'sk-shimmer 1.4s infinite' }}>&nbsp;</div>
        </td>
      ))}
    </tr>
  ));
}

export default function EmailImport() {
  const [status, setStatus] = useState(null);
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [importingFromDate, setImportingFromDate] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [statusRes, logRes] = await Promise.allSettled([
        apiGet('/accounts/email-import/status'),
        apiGet('/accounts/email-import/log'),
      ]);
      if (statusRes.status === 'fulfilled') setStatus(statusRes.value);
      if (logRes.status === 'fulfilled') setLog(logRes.value || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadData(); }, []);

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      const result = await apiPost('/accounts/email-import/trigger');
      setStatus(prev => ({ ...prev, lastPoll: result }));
      await loadData();
    } catch (err) { alert(err.message); }
    finally { setTriggering(false); }
  };

  const handleTriggerFromDate = async () => {
    if (!fromDate) { alert('Please select a date'); return; }
    setImportingFromDate(true);
    try {
      const result = await apiPost('/accounts/email-import/trigger?fromDate=' + fromDate);
      setStatus(prev => ({ ...prev, lastPoll: result }));
      await loadData();
    } catch (err) { alert(err.message); }
    finally { setImportingFromDate(false); }
  };

  const counts = status?.counts || { imported: 0, failed: 0, skipped: 0 };
  const lastPoll = status?.lastPoll;

  const SvgMail = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
  );

  const SvgRefresh = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.4-3.4L23 10M1 14l5.1 4.4A9 9 0 0 0 20.5 15"/></svg>
  );

  const statusColor = lastPoll?.success === true ? '#059669' : lastPoll?.success === false ? '#dc2626' : '#6b7280';
  const statusBg = lastPoll?.success === true ? '#05966918' : lastPoll?.success === false ? '#dc262618' : '#6b728018';

  return (
    <div>
      <EmailAccountsManager onAccountsChange={loadData} />
      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card" style={{ gridColumn: '1 / -1', border: '2px solid #5B6B4E', background: 'linear-gradient(135deg, #5B6B4E08 0%, #5B6B4E18 100%)', padding: '18px 22px' }}>
          <div className="stat-icon" style={{ background: '#5B6B4E20', color: '#5B6B4E', width: 48, height: 48, borderRadius: 14 }}>
            <SvgMail />
          </div>
          <div className="stat-info">
            <div className="stat-num" style={{ fontSize: 22, fontWeight: 800, color: '#5B6B4E' }}>Email Import</div>
            <div className="stat-lbl" style={{ fontSize: 13, fontWeight: 600, color: '#5B6B4E', opacity: 0.7 }}>
              Auto-import payment receipts from email into Bank Audit
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#05966918', color: '#059669' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div className="stat-info">
            <div className="stat-num">{counts.imported}</div>
            <div className="stat-lbl">Imported</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f59e0b18', color: '#f59e0b' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"/><polyline points="16 16 23 7 16 7"/></svg>
          </div>
          <div className="stat-info">
            <div className="stat-num">{counts.skipped}</div>
            <div className="stat-lbl">Skipped</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#dc262618', color: '#dc2626' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <div className="stat-info">
            <div className="stat-num">{counts.failed}</div>
            <div className="stat-lbl">Failed</div>
          </div>
        </div>
        {lastPoll && (
          <div className="stat-card" style={{ gridColumn: '1 / -1', background: statusBg, border: `1px solid ${statusColor}20` }}>
            <div className="stat-info" style={{ gap: 2 }}>
              <div className="stat-lbl" style={{ color: statusColor, fontWeight: 600, fontSize: 12 }}>
                Last Poll: {lastPoll.success === true ? 'Success' : lastPoll.success === false ? 'Failed' : 'Not Run'}
              </div>
              <div className="stat-lbl" style={{ fontSize: 12, color: '#6b7280' }}>
                {lastPoll.message} — {lastPoll.timestamp ? new Date(lastPoll.timestamp).toLocaleString('en-IN') : 'N/A'}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="filter-bar" style={{ flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Import Log</span>
          <button className="btn btn-sm" onClick={() => loadData()} style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
            <SvgRefresh /> Refresh
          </button>
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
            <span>From</span>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              style={{ fontSize: 12, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--line)', width: 150 }} />
          </label>
          <button className="btn btn-sm" onClick={handleTriggerFromDate} disabled={importingFromDate || !fromDate}
            style={{ background: '#5B6B4E', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            {importingFromDate ? 'Importing...' : 'Import Unseen from Date'}
          </button>
          <button className="btn btn-sm" onClick={handleTrigger} disabled={triggering}
            style={{ background: 'var(--sage)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            {triggering ? 'Importing...' : 'Manual Import'}
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Subject</th>
                <th>From</th>
                <th>Amount</th>
                <th>Payment ID</th>
                <th>Source</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonTableRows rows={5} cols={7} />
              ) : log.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>No imports yet</td></tr>
              ) : (
                log.map(e => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{e.created_at ? new Date(e.created_at).toLocaleDateString('en-IN') : '\u2014'}</td>
                    <td style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.email_subject}>{e.email_subject || '\u2014'}</td>
                    <td style={{ fontSize: 12 }}>{e.email_from ? e.email_from.split('<')[0].trim() : '\u2014'}</td>
                    <td style={{ fontSize: 12 }}>{e.parsed_amount ? currency(e.parsed_amount) : '\u2014'}</td>
                    <td style={{ fontSize: 11 }}>{e.parsed_payment_id || '\u2014'}</td>
                    <td style={{ fontSize: 12 }}>{e.parsed_source || '\u2014'}</td>
                    <td>
                      <span className={`pill ${e.status === 'imported' ? 'pill-green' : e.status === 'failed' ? 'pill-red' : 'pill-gray'}`}
                        style={{ fontSize: 11 }}>
                        {e.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
