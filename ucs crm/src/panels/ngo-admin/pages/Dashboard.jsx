import { useState, useEffect, useMemo, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { apiGet } from '../api/auth';

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

  const fetchDonors = useCallback(async (status) => {
    setLoadingDonors(true);
    setStatusFilter(status || '');
    try {
      const params = new URLSearchParams({ station });
      if (status) params.set('status', status);
      const data = await apiGet(`/ngo-admin/donors-by-station?${params}`);
      setDonors(data || []);
      setPage(1);
    } catch {
      setDonors([]);
    } finally {
      setLoadingDonors(false);
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
              <span key={n} style={{ fontSize: 11, background: '#eef2ff', color: '#6366f1', padding: '2px 8px', borderRadius: 12 }}>
                {n}
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

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [stationStats, setStationStats] = useState(null);
  const [stationsData, setStationsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState(null);

  useEffect(() => {
    Promise.all([
      apiGet('/ngo-admin/dashboard'),
      apiGet('/ngo-admin/dashboard/station-stats'),
      apiGet('/ngo-admin/stations'),
    ])
      .then(([d, s, st]) => {
        setData(d);
        setStationStats(s);
        setStationsData(Array.isArray(st) ? st : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading dashboard...</div>;
  if (!data) return <div className="empty-state"><p>Could not load dashboard data.</p></div>;

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
  const unassigned = Math.max(0, total_donors - assigned_donors);
  const assignPct = total_donors > 0 ? Math.round((assigned_donors / total_donors) * 100) : 0;

  const pieData = DISPOSITION_GROUPS.map(g => ({
    name: g.label,
    value: g.statuses.reduce((t, s) => t + (summary[s] || 0), 0),
    color: g.color,
  })).filter(d => d.value > 0);

  return (
    <div>
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
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Active FRO Workers</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{active_fros}</span>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ width: 64, height: 64, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[{ value: active_fros, color: 'var(--sage)' }, { value: Math.max(1, 50 - active_fros), color: '#e5e7eb' }]}
                    cx="50%" cy="50%" innerRadius={20} outerRadius={30} dataKey="value" startAngle={90} endAngle={-270}>
                    <Cell fill="var(--sage)" />
                    <Cell fill="#e5e7eb" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ height: 4, borderRadius: 2, background: '#e5e7eb', marginBottom: 6, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, (active_fros / 50) * 100)}%`, height: '100%', borderRadius: 2, background: 'var(--sage)' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{active_fros} currently active</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
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
      </div>

      {pieData.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <h3>Disposition Summary</h3>
            <span className="count">{grandTotal} total across {stationNames.length} stations</span>
          </div>
          <div className="card-pad" style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            {pieData.map(d => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 140 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{d.name}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: d.color }}>{d.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stationNames.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 16 }}>
          {stationNames.map(st => {
            const total = getStationTotal(st);
            const info = stationInfoMap[st];
            const hasFro = info?.fro_worker_name;
            const groupCounts = DISPOSITION_GROUPS.map(g => ({
              ...g, count: g.statuses.reduce((t, s) => t + getCell(st, s), 0),
            }));
            const visibleGroups = groupCounts.filter(g => g.count > 0);
            return (
              <div key={st} className="card" style={{ marginBottom: 0, padding: '14px 16px', cursor: 'pointer' }}
                onClick={() => setSelectedStation(st)}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--sage)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                  <span style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>{st}</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{total}</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: '#e5e7eb', display: 'flex', overflow: 'hidden', marginBottom: 8 }}>
                  {visibleGroups.map((g, i) => (
                    <div key={g.label} style={{
                      width: `${(g.count / total) * 100}%`, height: '100%',
                      background: g.color, opacity: 0.5,
                      borderRight: i < visibleGroups.length - 1 ? '1px solid #fff' : 'none',
                    }} />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                  {visibleGroups.slice(0, 3).map(g => (
                    <span key={g.label} style={{ fontSize: 10, color: g.color, fontWeight: 600, padding: '1px 7px', borderRadius: 8, background: g.bg }}>{g.count}</span>
                  ))}
                </div>
                {hasFro && (
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    {info.fro_worker_name}
                  </div>
                )}
              </div>
            );
          })}
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
    </div>
  );
}
