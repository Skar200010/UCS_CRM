import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { apiGet } from '../api/auth';
import LeadDetail from './LeadDetail';

const PAGE_SIZE = 15;

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
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
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
    if (!searchQuery.trim()) return leads;
    const q = searchQuery.toLowerCase();
    return leads.filter(l =>
      (l.donor_name || '').toLowerCase().includes(q) ||
      (l.donor_mobile || '').includes(q) ||
      (l.agent_name || '').toLowerCase().includes(q)
    );
  }, [leads, searchQuery]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  useEffect(() => { setPage(0); }, [searchQuery, statusFilter]);

  if (viewingId) {
    return <LeadDetail logId={viewingId} onBack={() => { setViewingId(null); load(); }} />;
  }

  return (
    <div>
      <div className="stats-grid">
        <StatCard icon={'\u23F3'} label="Pending" value={stats.pending.length} sub={`${currency(stats.pendingAmount)} total`} color="#e67e22" loading={loading} />
        <StatCard icon={'\u2714\uFE0F'} label="Verified" value={stats.verified.length} sub={`${currency(stats.verifiedAmount)} total`} color="#16a34a" loading={loading} />
        <StatCard icon={'\u{1F4C5}'} label="Verified Today" value={stats.verifiedToday.length} sub={`${currency(stats.verifiedTodayAmount)} collected`} color="#3b82f6" loading={loading} />
        <StatCard icon={'\u{1F4B0}'} label="Total Amount" value={currency(stats.totalAmount)} sub={`Across ${leads.length} leads`} color="#5B6B4E" loading={loading} />
      </div>

      <div className="card">
        <div className="filter-bar">
          <input
            className="search-input"
            placeholder="Search by donor, phone, or agent..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="pending">Pending ({allLeads.filter(l => l.accounts_status === 'pending').length})</option>
            <option value="verified">Verified ({allLeads.filter(l => l.accounts_status === 'verified').length})</option>
            <option value="rejected">Rejected ({allLeads.filter(l => l.accounts_status === 'rejected').length})</option>
            <option value="">All ({allLeads.length})</option>
          </select>
        </div>
        <div className="table-wrap">
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
              {loading ? (
                Array.from({ length: 8 }, (_, i) => <SkeletonRow key={i} cols={6} />)
              ) : paged.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>
                  {searchQuery ? 'No leads match your search.' : 'No leads found.'}
                </td></tr>
              ) : (
                paged.map(l => (
                  <tr key={l.log_id} className="clickable-row" onClick={() => setViewingId(l.log_id)} style={l.accounts_status !== 'pending' ? { opacity: 0.6 } : {}}>
                    <td><strong>{l.donor_name}</strong></td>
                    <td style={{ fontSize: 12 }}>{l.donor_mobile}</td>
                    <td><strong style={{ color: 'var(--sage)' }}>{currency(l.amount)}</strong></td>
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
        {!loading && pageCount > 1 && (
          <div className="pagination">
            <button disabled={safePage === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>{'\u276E'}</button>
            {Array.from({ length: Math.min(pageCount, 7) }, (_, i) => {
              const start = Math.max(0, Math.min(safePage - 3, pageCount - 7));
              const pageIdx = start + i;
              if (pageIdx >= pageCount) return null;
              return (
                <button key={pageIdx} className={safePage === pageIdx ? 'active' : ''} onClick={() => setPage(pageIdx)}>
                  {pageIdx + 1}
                </button>
              );
            })}
            <button disabled={safePage >= pageCount - 1} onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}>{'\u276F'}</button>
            <span className="page-info">{filtered.length} total</span>
          </div>
        )}
      </div>
    </div>
  );
}
