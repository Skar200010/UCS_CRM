import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { apiGet } from '../api/auth';
import { useRealtime } from '../../../hooks/useRealtime';
import LeadDetail from './LeadDetail';
import RecentNotices from '../../../components/RecentNotices';

const currency = n => n != null ? '\u20B9' + Number(n).toLocaleString('en-IN') : '\u20B90';

const SkeletonNum = () => (
  <span className="sk-num" style={{ display:'inline-block',width:48,height:24,borderRadius:6,background:'linear-gradient(90deg,var(--bg) 25%,var(--line) 50%,var(--bg) 75%)',backgroundSize:'200% 100%',animation:'sk-shimmer 1.4s infinite'}} />
);

const SkeletonRow = ({ cols }) => (
  <tr>{Array.from({length:cols},(_,i)=><td key={i}><span className="sk-num" style={{display:'inline-block',width:i===0?120:i===3?56:i===2?48:64,height:14,borderRadius:4,background:'linear-gradient(90deg,var(--bg) 25%,var(--line) 50%,var(--bg) 75%)',backgroundSize:'200% 100%',animation:'sk-shimmer 1.4s infinite'}} /></td>)}</tr>
);

const StatCard = ({ icon, label, value, sub, color, loading: l }) => (
  <div className="stat-card">
    <div className="stat-icon" style={{ background: color + '18', color }}>{icon}</div>
    <div className="stat-info">
      {l ? <SkeletonNum /> : <div className="stat-num">{value}</div>}
      <div className="stat-lbl">{label}</div>
      {sub && <div className="stat-sub">{l ? <span className="sk-num" style={{display:'inline-block',width:72,height:12,borderRadius:4,background:'linear-gradient(90deg,var(--bg) 25%,var(--line) 50%,var(--bg) 75%)',backgroundSize:'200% 100%',animation:'sk-shimmer 1.4s infinite'}} /> : sub}</div>}
    </div>
  </div>
);

export default function Dashboard() {
  const [leads, setLeads] = useState([]);
  const [allLeads, setAllLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [ngoFilter, setNgoFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingId, setViewingId] = useState(null);

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiGet('/accounts/leads'),
      statusFilter ? apiGet(`/accounts/leads?status=${statusFilter}`) : apiGet('/accounts/leads'),
    ])
      .then(([all, filtered]) => {
        if (mountedRef.current) { setAllLeads(all); setLeads(filtered); }
      })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false); });
  }, [statusFilter]);

  useEffect(load, [load]);

  useRealtime('fro_donor_logs', {
    filter: 'action=eq.disposition',
    onInsert: () => load(),
    onUpdate: () => load(),
  });

  const stats = useMemo(() => {
    const pending = allLeads.filter(l => l.accounts_status === 'pending');
    const verified = allLeads.filter(l => l.accounts_status === 'verified');
    const rejected = allLeads.filter(l => l.accounts_status === 'rejected');
    const pendingAmount = pending.reduce((s, l) => s + Number(l.amount || 0), 0);
    const verifiedAmount = verified.reduce((s, l) => s + Number(l.amount || 0), 0);
    const totalAmount = allLeads.reduce((s, l) => s + Number(l.amount || 0), 0);

    const today = new Date().toDateString();
    const verifiedToday = verified.filter(l => l.verified_at && new Date(l.verified_at).toDateString() === today);
    const verifiedTodayAmount = verifiedToday.reduce((s, l) => s + Number(l.amount || 0), 0);

    return { pending, verified, rejected, pendingAmount, verifiedAmount, totalAmount, verifiedToday, verifiedTodayAmount };
  }, [leads]);

  const filtered = useMemo(() => {
    let result = leads;
    if (ngoFilter) result = result.filter(l => l.donor_project === ngoFilter);
    if (!searchQuery.trim()) return result;
    const q = searchQuery.toLowerCase();
    return result.filter(l =>
      (l.donor_name || '').toLowerCase().includes(q) ||
      (l.donor_mobile || '').includes(q) ||
      (l.agent_name || '').toLowerCase().includes(q)
    );
  }, [leads, searchQuery, ngoFilter]);

  const sendToReceipts = () => {
    const verified = leads.filter(l => l.accounts_status === 'verified');
    if (verified.length === 0) return;

    const rows = verified.map(l => ({
      'Donor Name': l.donor_name || '',
      'Address 1': l.donor_address || '',
      'PAN No.': l.donor_pan || '',
      'Email ID': l.donor_email || '',
      'Mode of Payment (MOP)': l.payment_mode || '',
      'Payment ID No.': l.upi_transaction_id || '',
      'Donor Bank Name': '',
      'Amount': String(l.amount || 0),
      'Receipt No.': l.receipt_no || '',
      'Receipt Date': l.verified_at || l.transaction_date || '',
      'Account Of': 'Corpus',
      'Mobile No.': l.donor_mobile || '',
      'City': l.donor_city || '',
      'Project': l.donor_project || 'bsct',
    }));

    localStorage.setItem('receipts_verified_data', JSON.stringify(rows));
    localStorage.setItem('receipts_verified_count', String(verified.length));
    alert(`${verified.length} verified leads sent to Receipts page. Go to Receipts → Load from Saved.`);
  };

  if (viewingId) {
    return <LeadDetail logId={viewingId} onBack={() => { setViewingId(null); load(); }} />;
  }

  return (
    <div>
      <div className="stats-grid">
        <StatCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} label="Pending" value={stats.pending.length} sub={`${currency(stats.pendingAmount)} total`} color="#e67e22" loading={loading} />
        <StatCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>} label="Verified" value={stats.verified.length} sub={`${currency(stats.verifiedAmount)} total`} color="#16a34a" loading={loading} />
        <StatCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} label="Verified Today" value={stats.verifiedToday.length} sub={`${currency(stats.verifiedTodayAmount)} collected`} color="#3b82f6" loading={loading} />
        <StatCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>} label="Total Amount" value={currency(stats.totalAmount)} sub={`Across ${leads.length} leads`} color="#5B6B4E" loading={loading} />
      </div>

      <div className="card">
        <div className="filter-bar">
          <input
            className="search-input"
            placeholder="Search by donor, phone, or agent..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); }}>
            <option value="pending">Pending ({allLeads.filter(l => l.accounts_status === 'pending').length})</option>
            <option value="verified">Verified ({allLeads.filter(l => l.accounts_status === 'verified').length})</option>
            <option value="rejected">Rejected ({allLeads.filter(l => l.accounts_status === 'rejected').length})</option>
            <option value="">All ({allLeads.length})</option>
          </select>
          <select value={ngoFilter} onChange={e => { setNgoFilter(e.target.value); }}>
            <option value="">All NGOs</option>
            <option value="bsct">Being Sevak</option>
            <option value="maan">Mann Care</option>
            <option value="aflf">Ashray</option>
          </select>
          {statusFilter === 'verified' && leads.length > 0 && (
            <button className="btn btn-sm" style={{ background:'#1d6f42', color:'#fff', whiteSpace:'nowrap', marginLeft:8 }} onClick={sendToReceipts}>
              {'\u27A1'} Send to Receipts ({leads.length})
            </button>
          )}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Donor</th>
                <th>Amount</th>
                <th>NGO</th>
                <th>Agent</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }, (_, i) => <SkeletonRow key={i} cols={6} />)
               ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>
                  {searchQuery ? 'No leads match your search.' : 'No leads found.'}
                </td></tr>
              ) : (
                filtered.map(l => (
                  <tr key={l.log_id} className="clickable-row" onClick={() => setViewingId(l.log_id)} style={l.accounts_status !== 'pending' ? { opacity: 0.6 } : {}}>
                    <td><strong>{l.donor_name}</strong></td>
                    <td><strong style={{ color: 'var(--sage)' }}>{currency(l.amount)}</strong></td>
                    <td style={{ fontSize: 12 }}><span className="pill pill-gray">{({ bsct:'Being Sevak', maan:'Mann Care', aflf:'Ashray' })[l.donor_project] || l.donor_project || '\u2014'}</span></td>
                    <td style={{ fontSize: 12 }}><span className="pill pill-gray">{l.agent_name}</span></td>
                    <td>
                      {l.accounts_status === 'pending' ? <span className="pill pill-yellow">Pending</span> :
                       l.accounts_status === 'verified' ? <span className="pill pill-green">Verified</span> :
                       l.accounts_status === 'rejected' ? <span className="pill pill-red" title={l.rejection_reason || ''}>Rejected</span> :
                       <span className="pill pill-gray">{l.accounts_status || '\u2014'}</span>}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{new Date(l.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RecentNotices limit={5} />
    </div>
  );
}
