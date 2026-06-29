import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet } from '../api/auth';
import LeadDetail from './LeadDetail';

export default function Dashboard() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [viewingId, setViewingId] = useState(null);

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const load = useCallback(() => {
    setLoading(true);
    const url = statusFilter ? `/accounts/leads?status=${statusFilter}` : '/accounts/leads';
    apiGet(url)
      .then(data => { if (mountedRef.current) setLeads(data); })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false); });
  }, [statusFilter]);

  useEffect(load, [load]);

  if (viewingId) {
    return <LeadDetail logId={viewingId} onBack={() => setViewingId(null)} />;
  }

  const pending = leads.filter(l => l.accounts_status === 'pending');
  const verified = leads.filter(l => l.accounts_status === 'verified');
  const rejected = leads.filter(l => l.accounts_status === 'rejected');

  return (
    <div>
      <div className="card">
        <div className="card-head">
          <h3>Lead Verification</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="pending">Pending ({pending.length})</option>
              <option value="verified">Verified ({verified.length})</option>
              <option value="rejected">Rejected ({rejected.length})</option>
              <option value="">All ({leads.length})</option>
            </select>
          </div>
        </div>
        <div className="card-pad">
          {loading ? (
            <div className="loading">Loading leads...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Donor</th>
                  <th>Phone</th>
                  <th>Amount</th>
                  <th>Agent</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>No leads found</td></tr>
                )}
                {leads.map(l => (
                  <tr key={l.log_id} className="clickable-row" onClick={() => setViewingId(l.log_id)} style={l.accounts_status !== 'pending' ? { opacity: 0.6 } : {}}>
                    <td>{l.donor_name}</td>
                    <td>{l.donor_mobile}</td>
                    <td><strong>₹{Number(l.amount || 0).toLocaleString('en-IN')}</strong></td>
                    <td style={{ fontSize: 12 }}>{l.agent_name}</td>
                    <td>
                      {l.accounts_status === 'pending' ? <span className="pill pill-yellow">Pending</span> :
                       l.accounts_status === 'verified' ? <span className="pill pill-green">Verified</span> :
                       l.accounts_status === 'rejected' ? <span className="pill pill-red" title={l.rejection_reason || ''}>Rejected</span> :
                       <span className="pill pill-gray">{l.accounts_status || '—'}</span>}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{new Date(l.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
