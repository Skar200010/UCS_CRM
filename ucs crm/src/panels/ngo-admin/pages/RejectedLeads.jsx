import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPut } from '../api/auth';

const currency = n => n != null ? '\u20B9' + Number(n).toLocaleString('en-IN') : '\u2014';

export default function RejectedLeads() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

  const load = (showLoading = true) => {
    if (showLoading) setLoading(true);
    apiGet('/ngo-admin/rejected-leads')
      .then(d => setTickets(d || []))
      .catch(() => {})
      .finally(() => { if (showLoading) setLoading(false); });
  };

  useEffect(() => {
    load(true);
    intervalRef.current = setInterval(() => load(false), 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const ack = async (id) => {
    try {
      await apiPut(`/ngo-admin/rejected-leads/${id}/acknowledge`);
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'acknowledged' } : t));
    } catch (err) { alert(err.message); }
  };

  const pending = tickets.filter(t => t.status === 'pending_review');
  const acknowledged = tickets.filter(t => t.status === 'acknowledged');

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#dc262618', color: '#dc2626' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div className="stat-info">
            <div className="stat-num">{pending.length}</div>
            <div className="stat-lbl">Pending Review</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#16a34a18', color: '#16a34a' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div className="stat-info">
            <div className="stat-num">{acknowledged.length}</div>
            <div className="stat-lbl">Acknowledged</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#5B6B4E18', color: '#5B6B4E' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div className="stat-info">
            <div className="stat-num">{currency(tickets.reduce((s, t) => s + Number(t.amount || 0), 0))}</div>
            <div className="stat-lbl">Total Amount</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Rejected Leads ({tickets.length})</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Donor</th>
                <th>Amount</th>
                <th>FRO</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>Loading...</td></tr>
              ) : tickets.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>No rejected leads</td></tr>
              ) : (
                tickets.map(t => (
                  <tr key={t.id} style={t.status === 'acknowledged' ? { opacity: 0.5 } : {}}>
                    <td><strong>{t.donor_name}</strong></td>
                    <td><strong style={{ color: 'var(--sage)' }}>{currency(t.amount)}</strong></td>
                    <td><span className="pill pill-gray">{t.fro_name}</span></td>
                    <td style={{ fontSize: 12, maxWidth: 250, whiteSpace: 'pre-wrap' }}>{t.rejection_reason}</td>
                    <td>
                      {t.status === 'pending_review' ? <span className="pill pill-red">Pending</span> :
                       <span className="pill pill-green">Reviewed</span>}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                      {t.created_at ? new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '\u2014'}
                    </td>
                    <td>
                      {t.status === 'pending_review' ? (
                        <button className="btn btn-sm btn-primary" onClick={() => ack(t.id)}>Acknowledge</button>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{'\u2014'}</span>
                      )}
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
