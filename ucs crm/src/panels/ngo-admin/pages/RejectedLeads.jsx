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

  const filtered = tickets.filter(t => t.status === 'pending_review');
  const acknowledged = tickets.filter(t => t.status === 'acknowledged');

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#dc262618', color: '#dc2626' }}>{'\u26A0\uFE0F'}</div>
          <div className="stat-info"><div className="stat-num">{filtered.length}</div><div className="stat-lbl">Pending Review</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#16a34a18', color: '#16a34a' }}>{'\u2714\uFE0F'}</div>
          <div className="stat-info"><div className="stat-num">{acknowledged.length}</div><div className="stat-lbl">Acknowledged</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#5B6B4E18', color: '#5B6B4E' }}>{'\u{1F4B0}'}</div>
          <div className="stat-info"><div className="stat-num">{currency(tickets.reduce((s,t)=>s+Number(t.amount||0),0))}</div><div className="stat-lbl">Total Amount</div></div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Rejected Leads ({filtered.length} pending)</h3></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Donor</th>
                <th>Amount</th>
                <th>FRO</th>
                <th>Reason</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>Loading...</td></tr>
              ) : tickets.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>No rejected leads</td></tr>
              ) : (
                tickets.map(t => (
                  <tr key={t.id} style={t.status === 'acknowledged' ? { opacity: 0.5 } : {}}>
                    <td><strong>{t.donor_name}</strong></td>
                    <td><strong style={{ color: 'var(--sage)' }}>{currency(t.amount)}</strong></td>
                    <td><span className="pill pill-gray">{t.fro_name}</span></td>
                    <td style={{ fontSize: 12, maxWidth: 200, whiteSpace: 'pre-wrap' }}>{t.rejection_reason}</td>
                    <td style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td>
                      {t.status === 'pending_review' ? (
                        <button className="btn btn-sm btn-primary" onClick={() => ack(t.id)}>Acknowledge</button>
                      ) : (
                        <span className="pill pill-green">Reviewed</span>
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
