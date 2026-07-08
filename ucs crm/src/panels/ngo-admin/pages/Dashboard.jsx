import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { apiGet } from '../api/auth';
import { SkeletonDashboard } from '../../../components/Skeleton';
import RecentNotices from '../../../components/RecentNotices';

const DISPOSITION_LABELS = {
  pending: 'Pending', contacted: 'Contacted', follow_up: 'Follow Up', scheduled: 'Scheduled',
  busy: 'Busy', ringing: 'Ringing', unreachable: 'Unreachable', switched_off: 'Switched Off',
  wrong_number: 'Wrong Number', invalid_number: 'Invalid', rejected: 'Rejected',
  lead_done: 'Lead Done', visit_donate: 'Visit & Donate', promise_to_pay: 'Promise to Pay',
  payment_pending: 'Payment Pending', already_donated: 'Already Donated',
  not_interested: 'Not Interested', not_interested_now: 'Not Interested Now',
  language_barrier: 'Language Barrier', transferred_senior: 'Transferred to Senior',
  query_complaint: 'Query/Complaint', receipt_request: 'Receipt Request',
  donation_collected: 'Donation Collected',
};

const DISPOSITION_GROUPS = [
  { label: 'Converted', color: '#16a34a', bg: '#f0fdf4', statuses: ['donation_collected', 'promise_to_pay', 'lead_done', 'visit_donate', 'payment_pending', 'already_donated'] },
  { label: 'In Progress', color: '#d97706', bg: '#fffbeb', statuses: ['pending', 'contacted', 'follow_up', 'scheduled'] },
  { label: 'Negative', color: '#dc2626', bg: '#fef2f2', statuses: ['not_interested', 'not_interested_now', 'rejected', 'busy', 'ringing', 'unreachable', 'switched_off', 'wrong_number', 'invalid_number', 'language_barrier'] },
  { label: 'Other', color: '#5B6B4E', bg: '#f0f2ee', statuses: ['transferred_senior', 'query_complaint', 'receipt_request'] },
];

const PER_PAGE = 50;

function StationDetailModal({ station, stats, stationInfo, onClose }) {
  const [donors, setDonors] = useState([]);
  const [loadingDonors, setLoadingDonors] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!station) return null;
  const total = Object.values(stats || {}).reduce((t, v) => t + v, 0);
  const groupData = DISPOSITION_GROUPS.map(g => ({
    ...g, total: g.statuses.reduce((t, s) => t + (stats?.[s] || 0), 0),
  })).filter(g => g.total > 0);
  const allStatuses = DISPOSITION_GROUPS.flatMap(g =>
    g.statuses.filter(s => (stats?.[s] || 0) > 0).map(s => ({ status: s, count: stats[s], group: g }))
  );

  const donorsRef = useRef(null);
  const fetchDonors = useCallback(async (status) => {
    if (donorsRef.current) donorsRef.current.abort();
    const controller = new AbortController();
    donorsRef.current = controller;
    setLoadingDonors(true);
    setStatusFilter(status || '');
    try {
      const params = new URLSearchParams({ station });
      if (status) params.set('status', status);
      const data = await apiGet(`/ngo-admin/donors-by-station?${params}`, { signal: controller.signal, timeout: 30000 });
      if (!controller.signal.aborted) {
        setDonors(data || []);
        setPage(1);
      }
    } catch {
      if (!controller.signal.aborted) setDonors([]);
    } finally {
      if (!controller.signal.aborted) setLoadingDonors(false);
    }
  }, [station]);

  const filtered = useMemo(() => {
    if (!search) return donors;
    const q = search.toLowerCase();
    return donors.filter(d =>
      (d.donor_name && d.donor_name.toLowerCase().includes(q)) ||
      (d.donor_mobile && d.donor_mobile.includes(q)) ||
      (d.donor_city && d.donor_city.toLowerCase().includes(q)) ||
      (d.fro_name && d.fro_name.toLowerCase().includes(q))
    );
  }, [donors, search]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = useMemo(() => {
    const start = (page - 1) * PER_PAGE;
    return filtered.slice(start, start + PER_PAGE);
  }, [filtered, page]);

  useEffect(() => { setPage(1); }, [search]);

  const handleStatusClick = (status) => {
    if (statusFilter === status) {
      setStatusFilter('');
      setDonors([]);
    } else {
      fetchDonors(status);
    }
  };

  const handleClear = () => {
    setDonors([]);
    setStatusFilter('');
    setSearch('');
    setPage(1);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>{station}</h3>
            {stationInfo?.fro_worker_name && (
              <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, background: 'var(--bg)', padding: '2px 10px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                {stationInfo.fro_worker_name}
              </span>
            )}
            <span style={{ fontSize: 12, background: 'var(--sage)', color: '#fff', padding: '2px 10px', borderRadius: 12, fontWeight: 600 }}>
              {total} donors
            </span>
            {stationInfo?.ngos?.map(n => (
              <span key={n.ngo_id || n.ngo_name} style={{ fontSize: 11, background: '#eef2ff', color: '#6366f1', padding: '2px 8px', borderRadius: 12 }}>
                {n.ngo_name}
              </span>
            ))}
          </div>
          <button className="btn btn-sm btn-outline" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {groupData.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ height: 8, borderRadius: 4, background: '#e5e7eb', display: 'flex', overflow: 'hidden' }}>
                {groupData.map(g => (
                  <div key={g.label} style={{ width: `${(g.total / total) * 100}%`, height: '100%', background: g.color, opacity: 0.6 }} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                {groupData.map(g => (
                  <span key={g.label} style={{ fontSize: 11, fontWeight: 600, color: g.color, background: g.bg, padding: '2px 10px', borderRadius: 10 }}>
                    {g.label}: {g.total}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink-soft)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Disposition Breakdown
            {statusFilter && (
              <span style={{ marginLeft: 8, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                — click a status to view donors
              </span>
            )}
          </div>

          {allStatuses.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
              {allStatuses.map(({ status, count, group }) => (
                <button key={status} onClick={() => handleStatusClick(status)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 10px', borderRadius: 20, border: `1px solid ${statusFilter === status ? group.color : 'transparent'}`,
                    background: statusFilter === status ? group.bg : 'var(--bg)',
                    cursor: 'pointer', fontSize: 12, fontWeight: statusFilter === status ? 700 : 500,
                    color: statusFilter === status ? group.color : 'var(--ink-soft)',
                    transition: 'all .15s',
                  }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: group.color, flexShrink: 0 }} />
                  {DISPOSITION_LABELS[status] || status}
                  <span style={{ fontWeight: 700, color: group.color, marginLeft: 2 }}>{count}</span>
                </button>
              ))}
            </div>
          )}

          {!statusFilter && !donors.length && (
            <div style={{ padding: '12px 0', textAlign: 'center', fontSize: 12, color: 'var(--ink-soft)' }}>
              Click a disposition above to view donor list for that status.
            </div>
          )}

          {(statusFilter || donors.length > 0) && (
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 4 }}>
              <div className="filter-bar" style={{ marginBottom: 12 }}>
                <input placeholder="Search name, phone, city..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 240 }} />
                {statusFilter && (
                  <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: '#f0f2ee', color: 'var(--ink-soft)', fontWeight: 500 }}>
                    {DISPOSITION_LABELS[statusFilter] || statusFilter}
                  </span>
                )}
                <span className="count">{loadingDonors ? 'Loading...' : `${filtered.length} donors`}</span>
                {donors.length > 0 && (
                  <button className="btn btn-sm btn-outline" onClick={handleClear}>Clear</button>
                )}
              </div>

              {loadingDonors ? (
                <div className="loading" style={{ padding: 20 }}>Loading donors...</div>
              ) : paginated.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>City</th>
                        <th>FRO</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map(d => (
                        <tr key={d.id}>
                          <td style={{ fontWeight: 500 }}>{d.donor_name || '—'}</td>
                          <td>{d.donor_mobile || '—'}</td>
                          <td>{d.donor_city || '—'}</td>
                          <td style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{d.fro_name || 'Unassigned'}</td>
                          <td><span className="pill" style={{
                            background: (() => { const g = DISPOSITION_GROUPS.find(gr => gr.statuses.includes(d.status)); return g ? g.bg : '#f3f4f6'; })(),
                            color: (() => { const g = DISPOSITION_GROUPS.find(gr => gr.statuses.includes(d.status)); return g ? g.color : '#6b7280'; })(),
                          }}>{DISPOSITION_LABELS[d.status] || d.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: 'var(--ink-soft)' }}>
                  No donors match this filter.
                </div>
              )}

              {totalPages > 1 && !loadingDonors && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 0 4px' }}>
                  <button className="btn btn-sm btn-outline" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPage(p)} style={{ minWidth: 32 }}>
                      {p}
                    </button>
                  ))}
                  <button className="btn btn-sm btn-outline" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CollectionDetailModal({ period: defaultPeriod, totalAmount, onClose, status, monthAmount, monthCount, todayAmount, todayCount }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState(defaultPeriod || 'month');

  const isVerification = status === 'verified' || status === 'unverified';
  const label = status === 'verified' ? 'Verified' : status === 'unverified' ? 'Pending' : 'Collection';

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const url = isVerification
      ? `/ngo-admin/verification?status=${status}&period=${period}`
      : `/ngo-admin/collections/fro-wise?period=${period}`;
    apiGet(url, { signal: controller.signal, timeout: 30000 })
      .then(data => { if (!controller.signal.aborted) setRows(Array.isArray(data) ? data : []); })
      .catch(() => { if (!controller.signal.aborted) setRows([]); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [period, status, isVerification]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r => (r.fro_name || '').toLowerCase().includes(q));
  }, [rows, search]);

  const isMonth = period === 'month';
  const now = new Date();
  const dateTitle = isMonth
    ? now.toLocaleString('en-US', { month: 'long', year: 'numeric' })
    : `Today – ${now.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const title = isVerification ? `${label} Collections — ${dateTitle}` : dateTitle;

  const displayAmount = isVerification
    ? (period === 'month' ? (monthAmount || 0) : (todayAmount || 0))
    : (totalAmount || 0);
  const totalLeads = filtered.reduce((s, r) => s + (r.count || 0), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-head">
          <h3 style={{ margin: 0, fontSize: 14 }}>{title}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 500 }}>
              {rows.length} FRO{rows.length !== 1 ? 's' : ''}
            </span>
            <button className="btn btn-sm btn-outline" onClick={onClose} style={{ width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        </div>
        <div className="modal-body" style={{ padding: '14px 18px' }}>
          {loading ? (
            <div className="loading" style={{ padding: 20 }}>Loading...</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: '12px 0', textAlign: 'center', fontSize: 12, color: 'var(--ink-soft)' }}>
              No {label.toLowerCase()} collection data available.
            </div>
          ) : (
            <>
              {isVerification && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  <button onClick={() => setPeriod('month')} style={{
                    padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: period === 'month' ? '1.5px solid var(--sage)' : '1px solid var(--line)',
                    background: period === 'month' ? '#f0fdf4' : 'transparent',
                    color: period === 'month' ? 'var(--sage)' : 'var(--ink-soft)',
                  }}>Month</button>
                  <button onClick={() => setPeriod('today')} style={{
                    padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: period === 'today' ? '1.5px solid #f59e0b' : '1px solid var(--line)',
                    background: period === 'today' ? '#fffbeb' : 'transparent',
                    color: period === 'today' ? '#b45309' : 'var(--ink-soft)',
                  }}>Today</button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  type="text"
                  placeholder="Search FRO name..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    flex: 1, padding: '7px 10px', border: '1px solid var(--line)',
                    borderRadius: 6, fontSize: 12, fontFamily: 'inherit', outline: 'none',
                    background: 'var(--bg)', color: 'var(--ink)',
                  }}
                />
                {search && (
                  <button onClick={() => setSearch('')} className="btn btn-sm btn-outline">Clear</button>
                )}
              </div>
              {search && (
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 8 }}>
                  Showing {filtered.length} of {rows.length} FRO{rows.length !== 1 ? 's' : ''}
                </div>
              )}

              <div style={{ overflowX: 'auto', maxHeight: '50vh', overflowY: 'auto', borderRadius: 6, border: '1px solid var(--line)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg)', padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--line)' }}>
                        FRO Name
                      </th>
                      <th style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg)', padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--line)' }}>
                        {isVerification ? 'Amount (₹)' : 'Collection (₹)'}
                      </th>
                      {isVerification && (
                        <th style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg)', padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--line)' }}>
                          Leads
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => {
                      const val = isVerification ? r.amount : r.collection_amount;
                      return (
                        <tr key={r.fro_id} style={{ borderBottom: '1px solid var(--line)', transition: 'background .1s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}
                        >
                          <td style={{ padding: '8px 10px', fontWeight: 500 }}>{r.fro_name}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: val > 0 ? 'var(--sage)' : '#9ca3af' }}>
                            ₹{Number(val).toLocaleString('en-IN')}
                            {!isVerification && r.is_achieved && (
                              <span style={{ fontSize: 9, color: '#8b5cf6', fontWeight: 500, marginLeft: 4, verticalAlign: 'middle' }}>(set)</span>
                            )}
                          </td>
                          {isVerification && (
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 500, color: 'var(--ink-soft)' }}>
                              {r.count || 0}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={isVerification ? 3 : 2} style={{ padding: 16, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 12 }}>
                          No FROs match your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td style={{ padding: '10px', fontWeight: 700, borderTop: '2px solid var(--line)', fontSize: 13 }}>Total</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, borderTop: '2px solid var(--line)', color: 'var(--sage)', fontSize: 13 }}>
                        ₹{displayAmount.toLocaleString('en-IN')}
                      </td>
                      {isVerification && (
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, borderTop: '2px solid var(--line)', color: 'var(--ink-soft)', fontSize: 13 }}>
                          {totalLeads}
                        </td>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [stationStats, setStationStats] = useState(null);
  const [stationsData, setStationsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedNgoId, setSelectedNgoId] = useState('all');
  const [accessibleNgos, setAccessibleNgos] = useState([]);
  const [weakPeriod, setWeakPeriod] = useState('today');
  const [weakPerformers, setWeakPerformers] = useState([]);

  useEffect(() => {
    apiGet('/ngo-admin/ngos').then(setAccessibleNgos).catch(() => {});
  }, []);

  useEffect(() => {
    const ngoParam = selectedNgoId !== 'all' ? `&ngo_id=${selectedNgoId}` : '';
    apiGet(`/ngo-admin/fro-performance?period=${weakPeriod}${ngoParam}`)
      .then(setWeakPerformers)
      .catch(() => setWeakPerformers([]));
  }, [selectedNgoId, weakPeriod]);

  const fetchDashboard = useCallback(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const ngoParam = selectedNgoId !== 'all' ? `?ngo_id=${selectedNgoId}` : '';
    const opts = { signal: controller.signal, timeout: 45000 };
    Promise.all([
      apiGet(`/ngo-admin/dashboard${ngoParam}`, opts),
      apiGet(`/ngo-admin/dashboard/station-stats${ngoParam}`, opts),
      apiGet('/ngo-admin/stations', opts),
    ])
      .then(([d, s, st]) => {
        if (!controller.signal.aborted) {
          setData(d);
          setStationStats(s);
          setStationsData(Array.isArray(st) ? st : []);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err.message || 'Failed to load dashboard data');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return controller;
  }, [selectedNgoId]);

  useEffect(() => {
    const controller = fetchDashboard();
    return () => controller.abort();
  }, [fetchDashboard]);

  if (loading) return <SkeletonDashboard />;
  if (error || !data) {
    return (
      <div className="empty-state" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p style={{ marginBottom: 6, fontWeight: 600, color: 'var(--ink)' }}>Could not load dashboard data</p>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16 }}>{error || 'The server took too long to respond. Please try again.'}</p>
        <button className="btn btn-primary" onClick={fetchDashboard} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Retry
        </button>
      </div>
    );
  }

  const stations = stationStats?.stations || {};
  const summary = stationStats?.summary || {};
  const stationNames = Object.keys(stations).sort((a, b) => {
    const idxA = a.lastIndexOf('-'), idxB = b.lastIndexOf('-');
    const numA = idxA > 0 ? parseInt(a.slice(idxA + 1)) || 0 : 0;
    const numB = idxB > 0 ? parseInt(b.slice(idxB + 1)) || 0 : 0;
    const preA = idxA > 0 ? a.slice(0, idxA) : a;
    const preB = idxB > 0 ? b.slice(0, idxB) : b;
    if (preA !== preB) return preA.localeCompare(preB);
    return numA - numB;
  });

  const getCell = (station, status) => stations[station]?.[status] || 0;
  const getStationTotal = (station) => Object.values(stations[station] || {}).reduce((t, v) => t + v, 0);
  const grandTotal = stationNames.reduce((t, s) => t + getStationTotal(s), 0);

  const stationInfoMap = {};
  for (const st of stationsData) {
    stationInfoMap[st.station] = st;
  }

  const total_donors = Number(data.total_donors) || 0;
  const assigned_donors = Number(data.assigned_donors) || 0;
  const active_fros = Number(data.active_fros) || 0;
  const month_collection = Number(data.month_collection) || 0;
  const today_collection = Number(data.today_collection) || 0;
  const verified_month_amount = Number(data.verified_month_amount) || 0;
  const verified_month_count = Number(data.verified_month_count) || 0;
  const unverified_month_amount = Number(data.unverified_month_amount) || 0;
  const unverified_month_count = Number(data.unverified_month_count) || 0;
  const verified_today_amount = Number(data.verified_today_amount) || 0;
  const verified_today_count = Number(data.verified_today_count) || 0;
  const unverified_today_amount = Number(data.unverified_today_amount) || 0;
  const unverified_today_count = Number(data.unverified_today_count) || 0;
  const total_workers = Number(data.total_workers) || 0;
  const workers_present = Number(data.workers_present) || 0;
  const workers_absent = Number(data.workers_absent) || 0;
  const attendance_pct = Number(data.attendance_pct) || 0;
  const data_used = Number(data.data_used) || 0;
  const data_unused = Number(data.data_unused) || 0;
  const active_donors = Number(data.active_donors) || 0;
  const inactive_donors = Number(data.inactive_donors) || 0;
  const reactivated_today = Number(data.reactivated_today) || 0;
  const reactivated_monthly = Number(data.reactivated_monthly) || 0;
  const total_fro_workers = Number(data.total_fro_workers) || 0;
  const assigned_fro_count = Number(data.assigned_fro_count) || 0;
  const stations_per_ngo = data.stations_per_ngo || {};
  const unassigned = Math.max(0, total_donors - assigned_donors);
  const assignPct = total_donors > 0 ? Math.round((assigned_donors / total_donors) * 100) : 0;

  const pieData = DISPOSITION_GROUPS.map(g => ({
    name: g.label,
    value: g.statuses.reduce((t, s) => t + (summary[s] || 0), 0),
    color: g.color,
  })).filter(d => d.value > 0);

  return (
    <div>
      <div className="filter-bar">
        <span style={{fontSize:13, fontWeight:600, color:'var(--ink-soft)'}}>NGO:</span>
        <select value={selectedNgoId} onChange={e => setSelectedNgoId(e.target.value)}>
          <option value="all">All NGOs</option>
          {accessibleNgos.map(ngo => (
            <option key={ngo.id} value={ngo.id}>{ngo.name}</option>
          ))}
        </select>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 14, marginBottom: 20,
      }}>
        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Donor Assignment</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{total_donors}</span>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ width: 64, height: 64, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[
                    { name: 'Assigned', value: assigned_donors, color: 'var(--sage)' },
                    { name: 'Unassigned', value: unassigned, color: '#e5e7eb' },
                  ]} cx="50%" cy="50%" innerRadius={20} outerRadius={30} dataKey="value" startAngle={90} endAngle={-270}>
                    <Cell fill="var(--sage)" />
                    <Cell fill="#e5e7eb" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                <span style={{ color: 'var(--sage)', fontWeight: 600 }}>Assigned</span>
                <span style={{ fontWeight: 600 }}>{assigned_donors}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#9ca3af', fontWeight: 500 }}>Unassigned</span>
                <span style={{ fontWeight: 500, color: '#9ca3af' }}>{unassigned}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>{assignPct}% assigned</div>
            </div>
          </div>
          <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, background: '#f0fdf4', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#16a34a' }}>{data_used}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>Used</div>
              </div>
              <div style={{ flex: 1, background: '#fef2f2', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#dc2626' }}>{data_unused}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>Unused</div>
              </div>
            </div>
            {total_donors > 0 && (
              <div style={{ height: 4, borderRadius: 2, background: '#fee2e2', marginTop: 8, overflow: 'hidden' }}>
                <div style={{ width: `${(data_used / total_donors) * 100}%`, height: '100%', borderRadius: 2, background: '#16a34a' }} />
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>FRO Workers</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10, textAlign:'center' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>{total_fro_workers}</div>
              <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>Total</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--sage)' }}>{active_fros}</div>
              <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>Active</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6' }}>{assigned_fro_count}</div>
              <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>Assigned</div>
            </div>
          </div>
          {selectedNgoId === 'all' && Object.keys(stations_per_ngo).length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 6, textTransform:'uppercase' }}>Stations per NGO</div>
              {Object.entries(stations_per_ngo).map(([name, count]) => {
                const maxCount = Math.max(...Object.values(stations_per_ngo), 1);
                const pct = (count / maxCount) * 100;
                return (
                  <div key={name} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:12, fontWeight:600, minWidth:50, color:'var(--ink)' }}>{name}</span>
                    <div style={{ flex:1, height:6, borderRadius:3, background:'#e5e7eb', overflow:'hidden' }}>
                      <div style={{ width:`${pct}%`, height:'100%', borderRadius:3, background:'var(--sage)' }} />
                    </div>
                    <span style={{ fontSize:12, fontWeight:600, minWidth:24, textAlign:'right', color:'var(--ink)' }}>{count}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px', cursor: 'pointer' }} onClick={() => setSelectedPeriod('month')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Month Collection</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>₹{month_collection.toLocaleString('en-IN')}</span>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ width: 64, height: 64, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d4d4d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Total</span>
                <span style={{ fontWeight: 600 }}>₹{month_collection.toLocaleString('en-IN')}</span>
              </div>
              {month_collection > 0 && (
                <div style={{ height: 4, borderRadius: 2, background: '#e5e7eb', overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: '100%', borderRadius: 2, background: '#16a34a', opacity: 0.6 }} />
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: month_collection > 0 ? 2 : 0 }}>
                {month_collection === 0 ? 'No collections yet' : 'Current month'}
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px', cursor: 'pointer' }} onClick={() => setSelectedPeriod('today')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Today Collection</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>₹{today_collection.toLocaleString('en-IN')}</span>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ width: 64, height: 64, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d4d4d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Total</span>
                <span style={{ fontWeight: 600 }}>₹{today_collection.toLocaleString('en-IN')}</span>
              </div>
              {today_collection > 0 && (
                <div style={{ height: 4, borderRadius: 2, background: '#e5e7eb', overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: '100%', borderRadius: 2, background: '#f59e0b', opacity: 0.6 }} />
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: today_collection > 0 ? 2 : 0 }}>
                {today_collection === 0 ? 'No collections yet' : 'Today'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--ink-soft)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        Verification
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 20 }}>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px', cursor: 'pointer', border: '1px solid #16a34a33' }} onClick={() => setSelectedStatus('verified')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Verified</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>₹{verified_month_amount.toLocaleString('en-IN')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-soft)' }}>
            <span>Month: {verified_month_count} leads</span>
            <span>Today: ₹{verified_today_amount.toLocaleString('en-IN')} ({verified_today_count})</span>
          </div>
          <div style={{ fontSize: 10, color: '#16a34a', marginTop: 4 }}>Verified by Accounts panel</div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px', cursor: 'pointer', border: '1px solid #f59e0b33' }} onClick={() => setSelectedStatus('unverified')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Pending</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b' }}>₹{unverified_month_amount.toLocaleString('en-IN')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-soft)' }}>
            <span>Month: {unverified_month_count} leads</span>
            <span>Today: ₹{unverified_today_amount.toLocaleString('en-IN')} ({unverified_today_count})</span>
          </div>
          <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }}>Awaiting Accounts verification</div>
        </div>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--ink-soft)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Workforce
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 20 }}>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Total Workers</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{total_workers}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>FRO workers in your NGO</div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Present Today</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>{workers_present}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Marked present or late</div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Absent Today</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#ef4444' }}>{workers_absent}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Marked absent</div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Attendance %</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b' }}>{attendance_pct}%</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Today's attendance rate</div>
        </div>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--ink-soft)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        Donor Health
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 20 }}>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Active Donors</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#8b5cf6' }}>{active_donors}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Donated within last 1 year</div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="22" y2="13"/><line x1="22" y1="8" x2="17" y2="13"/></svg>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Inactive Donors</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#f97316' }}>{inactive_donors}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>No donation in last 1 year</div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Reactivated Today</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b' }}>{reactivated_today}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Inactive to active today</div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Reactivated Month</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#3b82f6' }}>{reactivated_monthly}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Inactive to active this month</div>
        </div>
      </div>

      {stationNames.length > 0 && (
        <>
          <div className="card desktop-only" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <h3>Stations</h3>
              <span className="count">{stationNames.length} total</span>
            </div>
            <div className="card-pad" style={{ padding: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Station</th>
                    <th>Donors</th>
                    <th>Converted</th>
                    <th>Lead Done</th>
                    <th>Connected</th>
                    <th>Non Connected</th>
                    <th>NGOs</th>
                    <th>FRO</th>
                  </tr>
                </thead>
                <tbody>
                  {stationNames.map(st => {
                    const total = getStationTotal(st);
                    const info = stationInfoMap[st];
                    const cnv = ['donation_collected','promise_to_pay','visit_donate','payment_pending','already_donated'].reduce((t, s) => t + getCell(st, s), 0);
                    const leadDone = getCell(st, 'lead_done');
                    const connected = ['contacted','follow_up','scheduled'].reduce((t, s) => t + getCell(st, s), 0);
                    const nonConnected = DISPOSITION_GROUPS[2].statuses.reduce((t, s) => t + getCell(st, s), 0);
                    return (
                      <tr key={st} onClick={() => setSelectedStation(st)} style={{ cursor: 'pointer' }}>
                        <td style={{ fontWeight: 600 }}>{st}</td>
                        <td>{total}</td>
                        <td style={{ color: '#16a34a', fontWeight: 600 }}>{cnv}</td>
                        <td style={{ color: '#7c3aed', fontWeight: 600 }}>{leadDone}</td>
                        <td style={{ color: '#d97706', fontWeight: 600 }}>{connected}</td>
                        <td style={{ color: '#dc2626', fontWeight: 600 }}>{nonConnected}</td>
                        <td style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{info?.ngos?.map(n => n.ngo_name).join(', ') || '—'}</td>
                        <td style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{info?.fro_worker_name || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mobile-only" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '0 2px' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>Stations</h3>
              <span className="count">{stationNames.length} total</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stationNames.map(st => {
                const total = getStationTotal(st);
                const info = stationInfoMap[st];
                const cnv = ['donation_collected','promise_to_pay','visit_donate','payment_pending','already_donated'].reduce((t, s) => t + getCell(st, s), 0);
                const leadDone = getCell(st, 'lead_done');
                const connected = ['contacted','follow_up','scheduled'].reduce((t, s) => t + getCell(st, s), 0);
                const nonConnected = DISPOSITION_GROUPS[2].statuses.reduce((t, s) => t + getCell(st, s), 0);
                return (
                  <div key={st} className="card" style={{ marginBottom: 0, padding: '12px 14px', cursor: 'pointer' }}
                    onClick={() => setSelectedStation(st)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{st}</span>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>{total} donors</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>C: {cnv}</span>
                      <span style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>LD: {leadDone}</span>
                      <span style={{ fontSize: 12, color: '#d97706', fontWeight: 600 }}>Conn: {connected}</span>
                      <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>NC: {nonConnected}</span>
                    </div>
                    {info?.ngos?.length > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>NGOs: {info.ngos.map(n => n.ngo_name).join(', ')}</div>
                    )}
                    {info?.fro_worker_name && (
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>FRO: {info.fro_worker_name}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {weakPerformers.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <h3>⚠ Low Performance</h3>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={() => setWeakPeriod('today')}
                style={{ padding:'3px 10px', borderRadius:12, border:'1px solid var(--line)', fontSize:11, fontWeight:600, fontFamily:'inherit', cursor:'pointer', background: weakPeriod === 'today' ? 'var(--sage)' : '#fff', color: weakPeriod === 'today' ? '#fff' : 'var(--ink)' }}>
                Today
              </button>
              <button onClick={() => setWeakPeriod('month')}
                style={{ padding:'3px 10px', borderRadius:12, border:'1px solid var(--line)', fontSize:11, fontWeight:600, fontFamily:'inherit', cursor:'pointer', background: weakPeriod === 'month' ? 'var(--sage)' : '#fff', color: weakPeriod === 'month' ? '#fff' : 'var(--ink)' }}>
                Month
              </button>
            </div>
          </div>
          <div className="card-pad" style={{ padding:0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{width:30}}>#</th>
                  <th>FRO</th>
                  <th style={{textAlign:'right'}}>Collection</th>
                  <th style={{textAlign:'right'}}>Talk Time</th>
                  <th style={{textAlign:'center'}}>Leads</th>
                  <th style={{textAlign:'center'}}>Used</th>
                  <th style={{textAlign:'center'}}>Att.</th>
                  <th style={{textAlign:'center'}}>Score</th>
                </tr>
              </thead>
              <tbody>
                {weakPerformers.map((p, i) => (
                  <tr key={p.fro_id}>
                    <td style={{color:'var(--ink-soft)', fontSize:11}}>{i + 1}</td>
                    <td style={{fontWeight:600}}>{p.fro_name}</td>
                    <td style={{textAlign:'right', fontWeight:600}}>₹{p.collection_amount.toLocaleString('en-IN')}</td>
                    <td style={{textAlign:'right', fontSize:12, color:'var(--ink-soft)'}}>
                      {p.avg_talk_seconds > 0 ? `${Math.floor(p.avg_talk_seconds / 60)}m ${p.avg_talk_seconds % 60}s` : '—'}
                    </td>
                    <td style={{textAlign:'center'}}>{p.lead_done_count}</td>
                    <td style={{textAlign:'center'}}>{p.data_used}</td>
                    <td style={{textAlign:'center'}}>
                      {p.attendance_pct != null
                        ? <span style={{color: p.attendance_pct < 50 ? '#dc2626' : p.attendance_pct < 75 ? '#f59e0b' : '#16a34a', fontWeight:600}}>{p.attendance_pct}%</span>
                        : '—'}
                    </td>
                    <td style={{textAlign:'center', fontWeight:700, color:p.score < 0.2 ? '#dc2626' : '#f59e0b'}}>{p.score.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedStation && (
        <StationDetailModal
          station={selectedStation}
          stats={stations[selectedStation]}
          stationInfo={stationInfoMap[selectedStation]}
          onClose={() => setSelectedStation(null)}
        />
      )}

      {selectedPeriod && (
        <CollectionDetailModal
          period={selectedPeriod}
          totalAmount={selectedPeriod === 'month' ? month_collection : today_collection}
          onClose={() => setSelectedPeriod(null)}
        />
      )}

      {selectedStatus && (
        <CollectionDetailModal
          status={selectedStatus}
          monthAmount={selectedStatus === 'verified' ? verified_month_amount : unverified_month_amount}
          monthCount={selectedStatus === 'verified' ? verified_month_count : unverified_month_count}
          todayAmount={selectedStatus === 'verified' ? verified_today_amount : unverified_today_amount}
          todayCount={selectedStatus === 'verified' ? verified_today_count : unverified_today_count}
          onClose={() => setSelectedStatus(null)}
        />
      )}

      <RecentNotices limit={5} />
    </div>
  );
}
