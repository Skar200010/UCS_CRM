import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Download } from 'lucide-react';
import { apiGet, apiPut, getFroHourlyPerformance } from '../api/auth';
import { SkeletonDashboard } from '../../../components/Skeleton';
import RecentNotices from '../../../components/RecentNotices';

const DISPOSITION_LABELS = {
  pending: 'Pending', contacted: 'Contacted', follow_up: 'Follow Up', scheduled: 'Scheduled',
  busy: 'Busy', ringing: 'Ringing', call_waiting: 'Call Waiting', unreachable: 'Unreachable',
  switched_off: 'Switched Off', out_of_coverage: 'Out of Coverage', wrong_number: 'Wrong Number',
  invalid_number: 'Invalid', rejected: 'Rejected', temporary_network_issue: 'Temporary Network Issue', voicemail: 'Voicemail',
  lead_done: 'Lead Done', done: 'Done', visit_donate: 'Visit & Donate', will_donate_online: 'Will Donate Online',
  promise_to_pay: 'Promise to Pay', payment_pending: 'Payment Pending', already_donated: 'Already Donated',
  email_sent: 'Email Sent', whatsapp_sent: 'WhatsApp Sent', csr_inquiry: 'CSR Inquiry',
  wants_80g_details: 'Wants 80G Details', wants_trust_documents: 'Wants Trust Documents',
  not_interested: 'Not Interested', not_interested_now: 'Not Interested Now', dnd: 'DND',
  wrong_person: 'Wrong Person', call_disconnected: 'Call Disconnected',
  language_barrier: 'Language Barrier', transferred_senior: 'Transferred to Senior',
  query_complaint: 'Query/Complaint', receipt_request: 'Receipt Request',
  donation_collected: 'Lead Done',
  office_program_visit: 'Office / Program Visit',
  promise_pay_wa_email: 'Promise To Pay / WA / Email',
  not_interested_np: 'Not Interested / Disconnected / NP',
  busy_call_waiting: 'Busy / Call Waiting',
  ooc_unreachable_network: 'OOC / Unreachable / Network',
  ringing_voicemail: 'Ringing / Voicemail',
  resolved_suspense: 'Resolved Suspense', others: 'Others',
};

const CONNECTED_STATUS_COLUMNS = [
  { key: 'scheduled', label: 'Follow Up', color: '#2563eb' },
  { key: 'callback', label: 'Callback', color: '#7c3aed' },
  { key: 'office_program_visit', label: 'Office / Prog Visit', color: '#0d9488' },
  { key: 'promise_pay_wa_email', label: 'Promise Pay / WA / Email', color: '#16a34a' },
  { key: 'not_interested_np', label: 'Not Inter / Disc / NP', color: '#f59e0b' },
  { key: 'dnd', label: 'DND', color: '#ef4444' },
];

const MERGED_STATUS_GROUPS = {
  office_program_visit: ['office_visit_scheduled', 'program_visit_scheduled', 'office_program_visit'],
  promise_pay_wa_email: ['promise_to_pay', 'whatsapp_sent', 'email_sent', 'promise_pay_wa_email'],
  not_interested_np: ['not_interested', 'call_disconnected', 'not_possible', 'not_interested_np'],
  busy_call_waiting: ['busy', 'call_waiting', 'busy_call_waiting'],
  ooc_unreachable_network: ['out_of_coverage', 'unreachable', 'temporary_network_issue', 'ooc_unreachable_network'],
  ringing_voicemail: ['ringing', 'voicemail', 'ringing_voicemail'],
};

const statusMatches = (key, target) =>
  key === target || (MERGED_STATUS_GROUPS[target] || []).includes(key);

const mergedKeyOf = (key) => {
  if (!key) return null;
  if (MERGED_STATUS_GROUPS[key]) return key;
  for (const [group, members] of Object.entries(MERGED_STATUS_GROUPS)) {
    if (members.includes(key)) return group;
  }
  return null;
};

const NOT_CONNECTED_STATUS_COLUMNS = [
  { key: 'switched_off', label: 'Switched Off', color: '#64748b' },
  { key: 'busy_call_waiting', label: 'Busy / Call Waiting', color: '#9ca3af' },
  { key: 'ooc_unreachable_network', label: 'OOC / Unreach / Network', color: '#a16207' },
  { key: 'ringing_voicemail', label: 'Ringing / Voicemail', color: '#0ea5e9' },
];

const CONNECTED_IDS = new Set(['contacted', 'lead_done', 'done', 'donation_collected', 'follow_up', 'scheduled', 'callback', 'visit_donate', 'will_donate_online', 'promise_to_pay', 'payment_pending', 'already_donated', 'email_sent', 'whatsapp_sent', 'csr_inquiry', 'wants_80g_details', 'wants_trust_documents', 'language_barrier', 'transferred_senior', 'query_complaint', 'receipt_request', 'not_interested_now', 'not_interested', 'dnd', 'wrong_person', 'call_disconnected', 'office_program_visit', 'promise_pay_wa_email', 'not_interested_np', 'office_visit_scheduled', 'program_visit_scheduled', 'not_possible', 'resolved_suspense']);

const NOT_CONNECTED_IDS = new Set(['busy', 'ringing', 'call_waiting', 'unreachable', 'switched_off', 'out_of_coverage', 'wrong_number', 'invalid', 'invalid_number', 'rejected', 'temporary_network_issue', 'voicemail', 'incoming_out', 'busy_call_waiting', 'ooc_unreachable_network', 'ringing_voicemail']);

const DISPOSITION_GROUPS = [
  { label: 'Converted', color: '#16a34a', bg: '#f0fdf4', statuses: ['donation_collected', 'promise_to_pay', 'lead_done', 'done', 'visit_donate', 'will_donate_online', 'payment_pending', 'already_donated', 'promise_pay_wa_email'] },
  { label: 'In Progress', color: '#d97706', bg: '#fffbeb', statuses: ['pending', 'contacted', 'follow_up', 'scheduled', 'email_sent', 'whatsapp_sent', 'csr_inquiry', 'wants_80g_details', 'wants_trust_documents', 'office_program_visit'] },
  { label: 'Negative', color: '#dc2626', bg: '#fef2f2', statuses: ['not_interested', 'not_interested_now', 'dnd', 'wrong_person', 'call_disconnected', 'rejected', 'busy', 'ringing', 'call_waiting', 'unreachable', 'switched_off', 'out_of_coverage', 'wrong_number', 'invalid_number', 'temporary_network_issue', 'voicemail', 'language_barrier', 'busy_call_waiting', 'ooc_unreachable_network', 'ringing_voicemail', 'not_interested_np'] },
  { label: 'Other', color: '#5B6B4E', bg: '#f0f2ee', statuses: ['transferred_senior', 'query_complaint', 'receipt_request'] },
];

const PER_PAGE = 50;

const toIstDate = (d = new Date()) =>
  new Date(new Date(d).getTime() + ((5 * 60) + 30) * 60000).toISOString().slice(0, 10);

const PERIOD_LABELS = { today: 'Today', weekly: 'This Week', monthly: 'This Month', custom: 'Custom Range' };

const NGO_TABS = [
  ['', 'All'],
  ['bsct', 'BSCT'],
  ['aflf', 'AFLF'],
  ['mann', 'MANN'],
];

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
  const label = status === 'verified' ? 'Verified' : status === 'unverified' ? 'Unverified' : 'Collection';

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
    : rows.reduce((s, r) => s + (r.collection_amount || 0), 0);
  const totalLeads = rows.reduce((s, r) => s + (r.count || 0), 0);

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

const FOLLOWUP_TAB_LABELS = {
  overdue: 'Overdue', today: 'Today', tomorrow: 'Tomorrow', future: 'Future',
  week: 'This Week', month: 'This Month',
};

function buildWorkerSummary(rows, todayIst = toIstDate()) {
  const map = {};
  for (const r of rows) {
    const key = r.fro_worker_id || r.telecaller || 'Unknown';
    if (!map[key]) map[key] = { key, telecaller: r.telecaller || 'Unknown', callback: 0, follow_up: 0, overdue: 0, rows: [] };
    map[key][r.type === 'callback' ? 'callback' : 'follow_up']++;
    const fd = r.followup_date ? String(r.followup_date).slice(0, 10) : null;
    if (fd && fd < todayIst) map[key].overdue++;
    map[key].rows.push(r);
  }
  const list = Object.values(map).map(x => ({ ...x, total: x.callback + x.follow_up }));
  list.sort((a, b) => b.total - a.total || a.telecaller.localeCompare(b.telecaller));
  return list;
}

function FollowupSummaryTable({ summary, onSelect, hint }) {
  const tCall = summary.reduce((s, w) => s + w.callback, 0);
  const tFup = summary.reduce((s, w) => s + w.follow_up, 0);
  const tOver = summary.reduce((s, w) => s + w.overdue, 0);
  const tTotal = summary.reduce((s, w) => s + w.total, 0);
  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {[['Telecaller', 'left'], ['Callback', 'center'], ['Follow-up', 'center'], ['Overdue', 'center'], ['Total', 'center']].map(([h, align]) => (
                <th key={h} style={{ padding: '8px 10px', textAlign: align, fontSize: 10, textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600, borderBottom: '2px solid var(--line)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.map(w => (
              <tr key={w.key} onClick={() => onSelect(w)} style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer' }} title="Click to view details">
                <td style={{ padding: '8px 10px', fontWeight: 600 }}>{w.telecaller}</td>
                <td style={{ padding: '8px 10px', textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{w.callback}</td>
                <td style={{ padding: '8px 10px', textAlign: 'center', color: '#ea580c', fontWeight: 600 }}>{w.follow_up}</td>
                <td style={{ padding: '8px 10px', textAlign: 'center', color: '#dc2626', fontWeight: 600 }}>{w.overdue}</td>
                <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>{w.total}</td>
              </tr>
            ))}
            <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg)', fontWeight: 700 }}>
              <td style={{ padding: '8px 10px', fontWeight: 700 }}>TOTAL</td>
              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>{tCall}</td>
              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>{tFup}</td>
              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>{tOver}</td>
              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>{tTotal}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, color: 'var(--ink-soft)' }}>{hint || 'Click a telecaller to view donors'}</div>
    </div>
  );
}

function FollowupDetailModal({ worker, label, onClose, onChanged }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!worker) return null;

  const rows = worker.rows || [];
  const callbackCount = rows.filter(r => r.type === 'callback').length;
  const followupCount = rows.length - callbackCount;

  const todayIst = toIstDate();
  const isOverdueRow = (r) => {
    const fd = r.followup_date ? String(r.followup_date).slice(0, 10) : null;
    return !!(fd && fd < todayIst);
  };
  const overdueCount = rows.filter(isOverdueRow).length;
  const sortedRows = [...rows].sort((a, b) => Number(isOverdueRow(b)) - Number(isOverdueRow(a)));

  const typePill = (type) => ({
    padding: '2px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700, display: 'inline-flex',
    textTransform: 'uppercase', letterSpacing: '0.04em',
    background: type === 'callback' ? '#f0fdf4' : '#fff7ed',
    color: type === 'callback' ? '#16a34a' : '#ea580c',
  });

  const fmtTime = (v) => {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 14 }}>{worker.telecaller}</h3>
            <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 500, background: 'var(--bg)', padding: '2px 10px', borderRadius: 12 }}>{label}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#ea580c', background: '#fff7ed', padding: '2px 10px', borderRadius: 12 }}>
              {followupCount} Follow-up{followupCount !== 1 ? 's' : ''}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', background: '#f0fdf4', padding: '2px 10px', borderRadius: 12 }}>
              {callbackCount} Callback{callbackCount !== 1 ? 's' : ''}
            </span>
            {overdueCount > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, color: '#dc2626', background: '#fee2e2', padding: '2px 10px', borderRadius: 12 }}>
                {overdueCount} Overdue{overdueCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button aria-label="Close" onClick={onClose} style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1 }}>✕</button>
        </div>
        <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '14px 18px' }}>
          {rows.length === 0 ? (
            <div style={{ padding: '12px 0', textAlign: 'center', fontSize: 12, color: 'var(--ink-soft)' }}>No records for this telecaller in {label}.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {[['Donor', 'left'], ['Mobile', 'left'], ['Type', 'left'], ['Date', 'center'], ['Scheduled', 'center'], ['', 'right']].map(([h, align]) => (
                      <th key={h || 'action'} style={{ padding: '8px 10px', textAlign: align, fontSize: 10, textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>{h || 'Action'}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map(r => (
                    <tr key={r.assignment_id || r.assignmentId} style={{ borderBottom: '1px solid var(--line)', background: isOverdueRow(r) ? '#fff7f7' : undefined }}>
                      <td style={{ padding: '8px 10px', fontWeight: 500 }}>{r.donor_name || '—'}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--ink-soft)' }}>{r.mobile || '—'}</td>
                      <td style={{ padding: '8px 10px' }}><span style={typePill(r.type)}>{r.type === 'callback' ? 'Callback' : 'Follow-up'}</span></td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11 }}>
                        {isOverdueRow(r) ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#dc2626', fontWeight: 700 }}>
                            {r.followup_date ? String(r.followup_date).slice(0, 10) : '—'}
                            <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: '#fee2e2', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Overdue</span>
                          </span>
                        ) : (r.followup_date ? String(r.followup_date).slice(0, 10) : '—')}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11 }}>{fmtTime(r.scheduled_at)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        <button onClick={async () => {
                          const newDate = prompt('New follow-up date (YYYY-MM-DD):', r.followup_date || '');
                          if (newDate && newDate !== r.followup_date) {
                            try {
                              await apiPut(`/ngo-admin/followups/${r.assignment_id || r.assignmentId}/date`, { followup_date: newDate });
                              onChanged();
                            } catch (err) { alert('Failed: ' + err.message); }
                          }
                        }} style={{ fontSize: 10, padding: '3px 8px', border: '1px solid var(--line)', borderRadius: 4, background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                          Change Date
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FroDetailModal({ froId, froName, filterType, rangeFrom, rangeTo, status, onClose }) {
  const [allDonors, setAllDonors] = useState([]);
  const [loadingDonors, setLoadingDonors] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(status || '');
  const [page, setPage] = useState(1);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    if (!froId) return;
    setLoadingDonors(true);
    apiGet(`/ngo-admin/donors-by-fro?fro_worker_id=${froId}&from=${rangeFrom || ''}&to=${rangeTo || ''}`)
      .then(data => setAllDonors(data || []))
      .catch(() => setAllDonors([]))
      .finally(() => setLoadingDonors(false));
  }, [froId, rangeFrom, rangeTo]);

  const isNonConnected = filterType === 'non_connected';
  const filterColor = isNonConnected ? '#dc2626' : '#16a34a';
  const filterBg = isNonConnected ? '#fef2f2' : '#f0fdf4';
  const filterLabel = status ? (DISPOSITION_LABELS[status] || status) : (isNonConnected ? 'Non-Connected' : 'Connected');

  const hasPeriodData = Boolean(rangeFrom || rangeTo);

  const stack = isNonConnected ? NOT_CONNECTED_STATUS_COLUMNS : CONNECTED_STATUS_COLUMNS;

  const baseList = useMemo(() => {
    const getKey = (d) => hasPeriodData && d.call_status ? d.call_status : d.status;
    const deduped = [];
    const seenDonors = new Set();
    for (const d of allDonors) {
      if (d.donor_id && seenDonors.has(d.donor_id)) continue;
      if (d.donor_id) seenDonors.add(d.donor_id);
      deduped.push(d);
    }
    if (status) return deduped.filter(d => statusMatches(getKey(d), status));
    const sideOf = (d) => {
      const k = getKey(d);
      if (NOT_CONNECTED_IDS.has(k)) return 'not_connected';
      if (CONNECTED_IDS.has(k)) return 'connected';
      if (hasPeriodData && d.call_category) return String(d.call_category).toLowerCase();
      return null;
    };
    if (isNonConnected) return deduped.filter(d => sideOf(d) === 'not_connected');
    return deduped.filter(d => sideOf(d) === 'connected');
  }, [allDonors, isNonConnected, hasPeriodData, status]);

  const total = baseList.length;

  const stackCounts = useMemo(() => {
    const counts = {};
    let others = 0;
    for (const d of baseList) {
      const key = hasPeriodData && d.call_status ? d.call_status : d.status;
      const mk = mergedKeyOf(key);
      if (mk && stack.some(c => c.key === mk)) counts[mk] = (counts[mk] || 0) + 1;
      else others++;
    }
    const chips = stack.map(c => ({ ...c, count: counts[c.key] || 0 })).filter(c => c.count > 0);
    if (others > 0) chips.push({ key: 'others', label: 'Others', color: '#5B6B4E', count: others });
    return chips;
  }, [baseList, hasPeriodData, stack]);

  const donorsRef = useRef(null);
  const fetchDonors = useCallback(async (status) => {
    if (donorsRef.current) donorsRef.current.abort();
    const controller = new AbortController();
    donorsRef.current = controller;
    setStatusFilter(status || '');
    setPage(1);
    try {
      const params = new URLSearchParams({ fro_worker_id: froId });
      if (status) params.set('status', status);
      const data = await apiGet(`/ngo-admin/donors-by-fro?${params}`, { signal: controller.signal, timeout: 30000 });
      if (!controller.signal.aborted) setAllDonors(data || []);
    } catch {
      if (!controller.signal.aborted) setAllDonors([]);
    }
  }, [froId]);

  const filtered = useMemo(() => {
    let list = baseList;
    if (statusFilter) {
      list = list.filter(d => {
        const key = hasPeriodData && d.call_status ? d.call_status : d.status;
        if (statusFilter === 'others') {
          const mk = mergedKeyOf(key);
          return !mk || !stack.some(c => c.key === mk);
        }
        return statusMatches(key, statusFilter);
      });
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(d =>
        (d.donor_name && d.donor_name.toLowerCase().includes(q)) ||
        (d.donor_mobile && d.donor_mobile.includes(q)) ||
        (d.station && d.station.toLowerCase().includes(q))
      );
    }
    return list;
  }, [baseList, statusFilter, search, stack]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = useMemo(() => {
    const start = (page - 1) * PER_PAGE;
    return filtered.slice(start, start + PER_PAGE);
  }, [filtered, page]);

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const handleStatusClick = (status) => {
    setStatusFilter(prev => prev === status ? '' : status);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>{froName}</h3>
            <span style={{ fontSize: 12, fontWeight: 600, color: filterColor, background: filterBg, padding: '2px 10px', borderRadius: 12 }}>
              {total} {filterLabel}
            </span>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>of {allDonors.length} total</span>
          </div>
          <button className="btn btn-sm btn-outline" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
          {loadingDonors ? (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--ink-soft)' }}>Loading donors...</div>
          ) : total === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--ink-soft)' }}>No {filterLabel.toLowerCase()} donors found</div>
          ) : (
            <>
              <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink-soft)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Disposition Breakdown
                <span style={{ marginLeft: 8, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                  — click a status to view donors
                </span>
              </div>

              {stackCounts.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
                  {stackCounts.map(({ key, label, color, count }) => (
                    <button key={key} onClick={() => handleStatusClick(key)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 10px', borderRadius: 20, border: `1px solid ${statusFilter === key ? color : 'transparent'}`,
                        background: statusFilter === key ? `${color}1a` : 'var(--bg)',
                        cursor: 'pointer', fontSize: 12, fontWeight: statusFilter === key ? 700 : 500,
                        color: statusFilter === key ? color : 'var(--ink-soft)',
                        transition: 'all .15s',
                      }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      {label}
                      <span style={{ fontWeight: 700, color, marginLeft: 2 }}>{count}</span>
                    </button>
                  ))}
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 4 }}>
                <div className="filter-bar" style={{ marginBottom: 12 }}>
                  <input placeholder="Search name, phone, station..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 240 }} />
                  {statusFilter && (
                    <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: '#f0f2ee', color: 'var(--ink-soft)', fontWeight: 500 }}>
                      {DISPOSITION_LABELS[statusFilter] || statusFilter}
                    </span>
                  )}
                  <span className="count">{loadingDonors ? 'Loading...' : `${filtered.length} donors`}</span>
                  {statusFilter && (
                    <button className="btn btn-sm btn-outline" onClick={() => { setStatusFilter(''); setSearch(''); setPage(1); }}>Clear</button>
                  )}
                </div>

                {paginated.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Name</th>
                          <th>Phone</th>
                          <th>Station</th>
                          <th>Status</th>
                          {statusFilter === 'others' && <th>Remark</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map((d, i) => {
                          const displayStatus = hasPeriodData && d.call_status ? d.call_status : d.status;
                          const mk = mergedKeyOf(displayStatus);
                          const col = mk ? [...CONNECTED_STATUS_COLUMNS, ...NOT_CONNECTED_STATUS_COLUMNS].find(c => c.key === mk) : null;
                          const pillColor = col ? col.color : '#6b7280';
                          return (
                            <tr key={d.id || d.donor_id}>
                              <td style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{(page - 1) * PER_PAGE + i + 1}</td>
                              <td style={{ fontWeight: 500 }}>{d.donor_name || '—'}</td>
                              <td>{d.donor_mobile || '—'}</td>
                              <td style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{d.station || '—'}</td>
                              <td><span className="pill" style={{
                                background: `${pillColor}1a`,
                                color: pillColor,
                              }}>{DISPOSITION_LABELS[mk || displayStatus] || displayStatus}</span></td>
                              {statusFilter === 'others' && (
                                <td style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{d.call_remark || d.notes || '—'}</td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: 'var(--ink-soft)' }}>
                    No donors match this filter.
                  </div>
                )}

                {totalPages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 0 4px' }}>
                    <button className="btn btn-sm btn-outline" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                      Previous
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const p = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                      return (
                        <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPage(p)} style={{ minWidth: 32 }}>
                          {p}
                        </button>
                      );
                    })}
                    <button className="btn btn-sm btn-outline" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                      Next
                    </button>
                  </div>
                )}
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
  const [ngoTab, setNgoTab] = useState('');
  const [dashPeriod, setDashPeriod] = useState('today');
  const [customFrom, setCustomFrom] = useState(() => toIstDate());
  const [customTo, setCustomTo] = useState(() => toIstDate());
  const [selectedFroId, setSelectedFroId] = useState('');
  const [accessibleNgos, setAccessibleNgos] = useState([]);
  const [weakPeriod, setWeakPeriod] = useState('today');
  const [weakPerformers, setWeakPerformers] = useState([]);
  const [weakLoading, setWeakLoading] = useState(false);
  const [showAllLowPerformers, setShowAllLowPerformers] = useState(false);
  const [froSearch, setFroSearch] = useState('');
  const [selectedFro, setSelectedFro] = useState(null);
  const [callAnalytics, setCallAnalytics] = useState(null);
  const [hourlyExportFrom, setHourlyExportFrom] = useState(() => new Date().toISOString().slice(0,10));
  const [hourlyExportTo, setHourlyExportTo] = useState(() => new Date().toISOString().slice(0,10));
  const [froHourlyData, setFroHourlyData] = useState([]);
  const [hourlyDate, setHourlyDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hourlyList, setHourlyList] = useState([]);
  const [hourlyLoading, setHourlyLoading] = useState(false);

  // Global date range (derived from the header filter) used by the table & exports
  const activeRange = useMemo(() => {
    const now = new Date();
    if (dashPeriod === 'today') return { from: toIstDate(), to: toIstDate() };
    if (dashPeriod === 'weekly') {
      const s = new Date(now); s.setDate(now.getDate() - now.getDay());
      return { from: toIstDate(s), to: toIstDate(now) };
    }
    if (dashPeriod === 'monthly') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toIstDate(s), to: toIstDate(now) };
    }
    return { from: customFrom, to: customTo };
  }, [dashPeriod, customFrom, customTo]);

  // Auto-update hourly export date range from the global header filter
  useEffect(() => {
    if (activeRange.from) setHourlyExportFrom(activeRange.from);
    if (activeRange.to) setHourlyExportTo(activeRange.to);
  }, [activeRange]);

  // Fetch FRO-level hourly performance when date range or NGO changes
  useEffect(() => {
    let cancelled = false;
    getFroHourlyPerformance({ from: hourlyExportFrom, to: hourlyExportTo, ...(selectedNgoId !== 'all' ? { ngo_id: selectedNgoId } : {}) })
      .then(data => { if (!cancelled) setFroHourlyData(data || []); })
      .catch(() => { if (!cancelled) setFroHourlyData([]); });
    return () => { cancelled = true; };
  }, [hourlyExportFrom, hourlyExportTo, selectedNgoId]);

  // Fetch aggregate hourly stats for the selected date
  useEffect(() => {
    let cancelled = false;
    setHourlyLoading(true);
    getFroHourlyPerformance({ from: hourlyDate, to: hourlyDate, ...(selectedNgoId !== 'all' ? { ngo_id: selectedNgoId } : {}) })
      .then(data => {
        if (!cancelled) {
          const hourSlots = Array.from({ length: 12 }, (_, i) => 
            `${String(9+i).padStart(2, '0')}:00-${String(10+i).padStart(2, '0')}:00`
          );
          const aggregated = {};
          for (const h of hourSlots) {
            aggregated[h] = { hour: h, calls: 0, connected: 0, interested: 0, donations: 0, amount: 0 };
          }
          for (const row of data || []) {
            if (aggregated[row.hour]) {
              aggregated[row.hour].calls += (row.calls || 0);
              aggregated[row.hour].connected += (row.connected || 0);
              aggregated[row.hour].interested += (row.interested || 0);
              aggregated[row.hour].donations += (row.donations || 0);
              aggregated[row.hour].amount += (row.amount || 0);
            }
          }
          setHourlyList(Object.values(aggregated));
        }
      })
      .catch(() => { if (!cancelled) setHourlyList([]); })
      .finally(() => { if (!cancelled) setHourlyLoading(false); });
    return () => { cancelled = true; };
  }, [hourlyDate, selectedNgoId]);

  const todayStr = new Date().toISOString().slice(0,10);
  const monthStart = new Date().toISOString().slice(0,7) + '-01';
  const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0,10);

  useEffect(() => {
    let cancelled = false;
    apiGet('/ngo-admin/ngos').then(data => { if (!cancelled) setAccessibleNgos(data); }).catch((err) => { console.error('API error:', err.message); });
    return () => { cancelled = true };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setWeakLoading(true);
    const ngoParam = selectedNgoId !== 'all' ? `&ngo_id=${selectedNgoId}` : '';
    apiGet(`/ngo-admin/fro-performance?period=${weakPeriod}${ngoParam}`)
      .then(data => { if (!cancelled) setWeakPerformers(data); })
      .catch(() => { if (!cancelled) setWeakPerformers([]); })
      .finally(() => { if (!cancelled) setWeakLoading(false); });
    return () => { cancelled = true };
  }, [selectedNgoId, weakPeriod]);

  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const to = now.toISOString();
    const params = new URLSearchParams({ from, to });
    if (selectedNgoId !== 'all') params.set('ngo_id', selectedNgoId);
    apiGet(`/ngo-admin/call-analytics?${params}`)
      .then(data => { if (!cancelled) setCallAnalytics(data); })
      .catch(() => { if (!cancelled) setCallAnalytics(null); });
    return () => { cancelled = true };
  }, [selectedNgoId]);

  const [tlData, setTlData] = useState(null);
  const [followups, setFollowups] = useState([]);
  const [followupTab, setFollowupTab] = useState('overdue');
  const [followupLoading, setFollowupLoading] = useState(false);
  const [showFollowups, setShowFollowups] = useState(false);
  const [followupMode, setFollowupMode] = useState('bucket');
  const [followupDay, setFollowupDay] = useState(() => toIstDate());
  const [daywiseRows, setDaywiseRows] = useState([]);
  const [daywiseLoading, setDaywiseLoading] = useState(false);
  const [fupDetailWorker, setFupDetailWorker] = useState(null);
  const [followupReload, setFollowupReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const buildParams = () => {
      const params = [];
      if (selectedNgoId !== 'all') params.push(`ngo_id=${selectedNgoId}`);
      let from, to;
      if (dashPeriod === 'today') { from = toIstDate(); to = from; }
      else if (dashPeriod === 'weekly') {
        const now = new Date();
        const start = new Date(now); start.setDate(now.getDate() - now.getDay());
        from = toIstDate(start); to = toIstDate(now);
      } else if (dashPeriod === 'monthly') {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        from = toIstDate(start); to = toIstDate(now);
      } else {
        from = customFrom; to = customTo;
      }
      if (from) params.push(`from=${from}`);
      if (to) params.push(`to=${to}`);
      if (selectedFroId) params.push(`fro_id=${selectedFroId}`);
      return params.length ? `?${params.join('&')}` : '';
    };
    const ngoParam = () => buildParams();
    const fetchTl = () => {
      apiGet(`/ngo-admin/tl-dashboard${ngoParam()}`)
        .then(d => { if (!cancelled) setTlData(d); })
        .catch(() => { if (!cancelled) setTlData(null); });
    };
    fetchTl();
    const interval = setInterval(fetchTl, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [selectedNgoId, dashPeriod, customFrom, customTo, selectedFroId]);

  useEffect(() => {
    if (!showFollowups) return;
    let cancelled = false;
    setFollowupLoading(true);
    const ngoParam = selectedNgoId !== 'all' ? `?ngo_id=${selectedNgoId}` : '';
    apiGet(`/ngo-admin/followups${ngoParam}`)
      .then(d => { if (!cancelled) setFollowups(Array.isArray(d) ? d : []); })
      .catch(() => { if (!cancelled) setFollowups([]); })
      .finally(() => { if (!cancelled) setFollowupLoading(false); });
    return () => { cancelled = true };
  }, [showFollowups, selectedNgoId, followupReload]);

  useEffect(() => {
    if (!showFollowups || followupMode !== 'daywise') return;
    let cancelled = false;
    setDaywiseLoading(true);
    const params = new URLSearchParams({ date: followupDay });
    if (selectedNgoId !== 'all') params.set('ngo_id', selectedNgoId);
    apiGet(`/ngo-admin/followups?${params}`)
      .then(d => { if (!cancelled) setDaywiseRows(Array.isArray(d) ? d : []); })
      .catch(() => { if (!cancelled) setDaywiseRows([]); })
      .finally(() => { if (!cancelled) setDaywiseLoading(false); });
    return () => { cancelled = true };
  }, [showFollowups, followupMode, followupDay, selectedNgoId, followupReload]);

  const daywiseSummary = useMemo(() => buildWorkerSummary(daywiseRows), [daywiseRows]);

  const bucketRows = useMemo(() => {
    if (!Array.isArray(followups)) return [];
    return followups.filter(f => (f.buckets || (f.bucket ? [f.bucket] : [])).includes(followupTab));
  }, [followups, followupTab]);

  const bucketSummary = useMemo(() => buildWorkerSummary(bucketRows), [bucketRows]);

  const bumpFollowupReload = useCallback(() => setFollowupReload(n => n + 1), []);

  const fetchDashboard = useCallback((opts = {}) => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (selectedNgoId !== 'all') params.set('ngo_id', selectedNgoId);
    if (opts.fresh) params.set('fresh', '1');
    const ngoParam = params.toString() ? `?${params.toString()}` : '';
    const reqOpts = { signal: controller.signal, timeout: 180000 };
    apiGet(`/ngo-admin/dashboard${ngoParam}`, reqOpts)
      .then(d => { if (!controller.signal.aborted) setData(d); })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message || 'Failed to load dashboard data');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    apiGet(`/ngo-admin/dashboard/station-stats${ngoParam}`, reqOpts)
      .then(s => { if (!controller.signal.aborted) setStationStats(s); })
      .catch(() => {});
    apiGet('/ngo-admin/stations', reqOpts)
      .then(st => { if (!controller.signal.aborted) setStationsData(Array.isArray(st) ? st : []); })
      .catch(() => {});
    return controller;
  }, [selectedNgoId]);

  useEffect(() => {
    const controller = fetchDashboard();
    return () => controller.abort();
  }, [fetchDashboard]);

  const handleNgoTab = (code) => {
    setNgoTab(code);
    setData(null);
    setStationStats(null);
    setStationsData([]);
    if (!code) { setSelectedNgoId('all'); return; }
    const ngo = (accessibleNgos || []).find(n => (n.name || '').toLowerCase().includes(code));
    setSelectedNgoId(ngo ? ngo.id : 'all');
  };

  if (loading && !data) return <SkeletonDashboard />;
  if (error && !data) {
    return (
      <div className="empty-state" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p style={{ marginBottom: 6, fontWeight: 600, color: 'var(--ink)' }}>Could not load dashboard data</p>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16 }}>{error || 'The server took too long to respond. Please try again.'}</p>
        <button className="btn btn-primary" onClick={() => fetchDashboard({ fresh: true })} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Retry
        </button>
      </div>
    );
  }
  if (!data) return <SkeletonDashboard />;

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

  const stationInfoMap = {};
  for (const st of stationsData) {
    stationInfoMap[st.station] = st;
  }

  const s = data.summary || {};
  const d = s.donors || {};
  const c = s.collection || {};
  const cm = c.month || {};
  const ct = c.today || {};
  const r = s.reactivations || {};
  const w = data.workers || {};
  const f = w.fro || {};
  const att = w.attendance || {};
  const a = data.assignments || {};

  const total_donors = Number(d.total) || 0;
  const assigned_donors = Number(d.assigned) || 0;
  const month_collection = Number(cm.total) || 0;
  const today_collection = Number(ct.total) || 0;
  const daily_target = Number(c.daily_target) || 0;
  const monthly_target = Number(c.monthly_target) || (daily_target > 0 ? daily_target * 26 : 0);
  const verified_month_amount = Number(cm.verified?.amount) || 0;
  const verified_month_count = Number(cm.verified?.count) || 0;
  const unverified_month_amount = Number(cm.unverified?.amount) || 0;
  const unverified_month_count = Number(cm.unverified?.count) || 0;
  const verified_today_amount = Number(ct.verified?.amount) || 0;
  const verified_today_count = Number(ct.verified?.count) || 0;
  const unverified_today_amount = Number(ct.unverified?.amount) || 0;
  const unverified_today_count = Number(ct.unverified?.count) || 0;
  const total_workers = Number(f.total) || 0;
  const workers_present = Number(att.present) || 0;
  const workers_late = Number(att.late) || 0;
  const workers_absent = Number(att.absent) || 0;
  const workers_no_mark = Number(att.no_mark) || 0;
  const attendance_pct = Number(att.pct) || 0;
  const data_used = Number(a.data_connected) || 0;
  const data_unused = Number(a.data_unconnected) || 0;
  const active_donors = Number(d.active) || 0;
  const inactive_donors = Number(d.inactive) || 0;
  const reactivated_today = Number(r.today) || 0;
  const reactivated_monthly = Number(r.month) || 0;
  const stations_per_ngo = tlData?.stations_per_ngo || data.stations_per_ngo || {};
  const stations_summary = tlData?.stations_summary || data.stations_summary || { total: 0, active: 0 };
  const unassigned = Math.max(0, total_donors - assigned_donors);
  const assignPct = Number(d.assigned_pct) || 0;
  const direct_donation_month = Math.max(0, month_collection - verified_month_amount - unverified_month_amount);
  const direct_donation_today = Math.max(0, today_collection - verified_today_amount - unverified_today_amount);

  const pieData = DISPOSITION_GROUPS.map(g => ({
    name: g.label,
    value: g.statuses.reduce((t, s) => t + (summary[s] || 0), 0),
    color: g.color,
  })).filter(d => d.value > 0);

  const handleHourlyExport = async () => {
    const XLSX = await import('xlsx-js-style');
    const wb = XLSX.utils.book_new();
    let data = [];
    try {
      data = await getFroHourlyPerformance({ from: hourlyDate, to: hourlyDate, ...(selectedNgoId !== 'all' ? { ngo_id: selectedNgoId } : {}) });
    } catch (e) {
      data = [];
    }
    const headers = [
      'Telecaller', 'Login ID', 'Date', 'Hour Slot', 'Calls', 'Connected', 'Interested', 'Donations', 'Amount (₹)'
    ];
    const rows = (data || []).map(h => [
      h.fro_name,
      h.fro_login_id || '',
      hourlyDate,
      h.hour,
      h.calls || 0,
      h.connected || 0,
      h.interested || 0,
      h.donations || 0,
      h.amount || 0
    ]);
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    sheet['!cols'] = [
      { wch: 25 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 }
    ];
    XLSX.utils.book_append_sheet(wb, sheet, 'Hourly Performance');
    XLSX.writeFile(wb, `hourly-performance-${hourlyDate}.xlsx`);
  };

  const handleTelecallerExport = async () => {
    if (!tlData?.performance) return;
    const XLSX = await import('xlsx-js-style');
    const wb = XLSX.utils.book_new();
    const enc = XLSX.utils.encode_cell;
    const styleCell = (ws, r, c, s) => { const ref = ws[enc({ r, c })]; if (ref) ref.s = s; };
    const spanRef = (ws) => {
      const cur = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: cur.e });
    };

    const periodLabel = PERIOD_LABELS[dashPeriod] || 'Range';
    const filteredPerformance = tlData.performance.filter(p =>
      !froSearch || p.fro_name?.toLowerCase().includes(froSearch.toLowerCase())
    );

    const HDR = {
      fgColor: { rgb: '5B6B4E' }, pattern: 'solid',
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    };
    const TITLE = {
      fgColor: { rgb: '5B6B4E' }, pattern: 'solid',
      font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };
    const SUB = {
      fgColor: { rgb: 'E8EDE1' }, pattern: 'solid',
      font: { name: 'Calibri', sz: 10, bold: true },
      alignment: { horizontal: 'center', vertical: 'center' },
    };
    const AMT = { numFmt: '"₹"#,##0' };
    const FONT = { name: 'Calibri', sz: 10 };

    const calc = (p) => {
      const calls = p.calls_range || 0;
      const connected = p.connected_range || 0;
      const interested = p.interested_range || 0;
      const received = p.receivedAmount_range || 0;
      return {
        calls, connected,
        nonConnected: p.non_connected_range ?? Math.max(0, calls - connected),
        interested, received,
        donors: p.receivedDonors || 0,
        statuses: p.connectedStatuses_range || {},
      };
    };
    const calcRows1 = filteredPerformance.map(p => ({ p, c: calc(p) }));
    const sum1 = (k) => calcRows1.reduce((a, { c }) => a + c[k], 0);
    const tcalls = sum1('calls'), tconn = sum1('connected'), tnc = sum1('nonConnected');
    const tint = sum1('interested'), tdon = sum1('donors'), tamt = sum1('received');

    // ── Sheet 1: Telecaller Performance ─────────────────────────────
    const headers1 = [
      'Telecaller', 'Login ID', 'Period', 'Total Calls', 'Connected',
      ...CONNECTED_STATUS_COLUMNS.map(c => c.label),
      'Non-Connected', 'Interested', 'Amount (₹)', 'Live Status'
    ];
    const aoa1 = calcRows1.map(({ p, c }) => [
      p.fro_name, p.fro_login_id || '', periodLabel, c.calls, c.connected,
      ...CONNECTED_STATUS_COLUMNS.map(col => c.statuses[col.key] || 0),
      c.nonConnected, c.interested, c.received, p.status || 'offline'
    ]);
    const t1 = calcRows1.reduce((a, { p, c }) => ({
      calls: a.calls + c.calls, connected: a.connected + c.connected, nonConnected: a.nonConnected + c.nonConnected,
      interested: a.interested + c.interested, donors: a.donors + (p.receivedDonors || 0), amount: a.amount + c.received,
      statuses: CONNECTED_STATUS_COLUMNS.map((col, i) => a.statuses[i] + (c.statuses[col.key] || 0)),
    }), { calls: 0, connected: 0, nonConnected: 0, interested: 0, donors: 0, amount: 0, statuses: CONNECTED_STATUS_COLUMNS.map(() => 0) });
    aoa1.push(['TOTAL', '', '', t1.calls, t1.connected, ...t1.statuses, t1.nonConnected, t1.interested, t1.amount, '']);

    const ws1 = XLSX.utils.aoa_to_sheet([]);
    ws1[enc({ r: 0, c: 0 })] = { t: 's', v: `Telecaller Performance — ${periodLabel}` };
    ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 14 } }];
    ws1['!rows'] = [{ hpt: 30 }, { hpt: 28 }];
    XLSX.utils.sheet_add_aoa(ws1, [headers1], { origin: 'A2' });
    XLSX.utils.sheet_add_aoa(ws1, aoa1, { origin: 'A3' });
    spanRef(ws1);
    ws1['!cols'] = [
      { wch: 25 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
      ...CONNECTED_STATUS_COLUMNS.map(() => ({ wch: 16 })),
      { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }
    ];
    styleCell(ws1, 0, 0, TITLE);
    for (let c = 0; c <= 14; c++) styleCell(ws1, 1, c, HDR);
    const numCols1 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    for (let r = 2; r < 2 + aoa1.length; r++) {
      for (let c = 0; c <= 14; c++) {
        const s = { font: FONT, alignment: { vertical: 'center', horizontal: numCols1.includes(c) ? 'center' : 'left' } };
        if (c === 13) s.numFmt = AMT.numFmt;
        styleCell(ws1, r, c, s);
      }
    }
    for (let c = 0; c <= 14; c++) styleCell(ws1, 1 + aoa1.length, c, { ...SUB, numFmt: c === 13 ? AMT.numFmt : undefined });
    ws1['!freeze'] = { xSplit: 0, ySplit: 1 };
    ws1['!autofilter'] = { ref: `A2:O${1 + aoa1.length}` };
    XLSX.utils.book_append_sheet(wb, ws1, 'Telecaller Performance');

    // ── Sheet 2: Hourly Performance (subtotals per telecaller) ──────
    let hourlyDataToUse = froHourlyData;
    if (!hourlyDataToUse || hourlyDataToUse.length === 0) {
      try {
        hourlyDataToUse = await getFroHourlyPerformance({ from: hourlyExportFrom, to: hourlyExportTo, ...(selectedNgoId !== 'all' ? { ngo_id: selectedNgoId } : {}) }) || [];
      } catch (e) {
        hourlyDataToUse = [];
      }
    }
    const headers2 = ['Telecaller', 'Login ID', 'Hour Slot', 'Calls', 'Connected', 'Interested', 'Donations', 'Amount (₹)'];
    const ws2 = XLSX.utils.aoa_to_sheet([]);
    ws2[enc({ r: 0, c: 0 })] = { t: 's', v: `Hourly Collection Performance — ${hourlyExportFrom} to ${hourlyExportTo}` };
    ws2['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
    ws2['!rows'] = [{ hpt: 30 }, { hpt: 26 }];
    XLSX.utils.sheet_add_aoa(ws2, [headers2], { origin: 'A2' });

    const aoa2 = [];
    const subRows2 = [];
    let grandRow2 = -1;
    if (hourlyDataToUse && hourlyDataToUse.length) {
      const groups = {};
      hourlyDataToUse.forEach(h => { const k = h.fro_name || 'Unknown'; (groups[k] = groups[k] || []).push(h); });
      Object.keys(groups).forEach(name => {
        groups[name].forEach(h => aoa2.push([h.fro_name || name, h.fro_login_id || '', h.hour, h.calls || 0, h.connected || 0, h.interested || 0, h.donations || 0, h.amount || 0]));
        const st = groups[name].reduce((a, h) => ({
          calls: a.calls + (h.calls || 0), connected: a.connected + (h.connected || 0), interested: a.interested + (h.interested || 0),
          donations: a.donations + (h.donations || 0), amount: a.amount + (h.amount || 0)
        }), { calls: 0, connected: 0, interested: 0, donations: 0, amount: 0 });
        aoa2.push([`${name} — Subtotal`, '', '', st.calls, st.connected, st.interested, st.donations, st.amount]);
        subRows2.push(1 + aoa2.length);
      });
      const gt = hourlyDataToUse.reduce((a, h) => ({
        calls: a.calls + (h.calls || 0), connected: a.connected + (h.connected || 0), interested: a.interested + (h.interested || 0),
        donations: a.donations + (h.donations || 0), amount: a.amount + (h.amount || 0)
      }), { calls: 0, connected: 0, interested: 0, donations: 0, amount: 0 });
      aoa2.push(['GRAND TOTAL', '', '', gt.calls, gt.connected, gt.interested, gt.donations, gt.amount]);
      grandRow2 = 1 + aoa2.length;
    } else {
      aoa2.push(['No hourly data for selected range', '', '', '', '', '', '', '']);
    }
    XLSX.utils.sheet_add_aoa(ws2, aoa2, { origin: 'A3' });
    spanRef(ws2);
    ws2['!cols'] = [
      { wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 }
    ];
    styleCell(ws2, 0, 0, TITLE);
    for (let c = 0; c <= 7; c++) styleCell(ws2, 1, c, HDR);
    const numCols2 = [3, 4, 5, 6, 7];
    for (let r = 2; r < 2 + aoa2.length; r++) {
      for (let c = 0; c <= 7; c++) {
        const s = { font: FONT, alignment: { vertical: 'center', horizontal: numCols2.includes(c) ? 'center' : 'left' } };
        if (c === 7) s.numFmt = AMT.numFmt;
        styleCell(ws2, r, c, s);
      }
    }
    subRows2.forEach(r => { for (let c = 0; c <= 7; c++) styleCell(ws2, r, c, { ...SUB, numFmt: c === 7 ? AMT.numFmt : undefined }); });
    if (grandRow2 > 0) for (let c = 0; c <= 7; c++) styleCell(ws2, grandRow2, c, { ...SUB, numFmt: c === 7 ? AMT.numFmt : undefined });
    ws2['!freeze'] = { xSplit: 0, ySplit: 1 };
    if (aoa2.length > 1) ws2['!autofilter'] = { ref: `A2:H${1 + aoa2.length}` };
    XLSX.utils.book_append_sheet(wb, ws2, 'Hourly Performance');

    // ── Sheet 3: Computations ───────────────────────────────────────
    const ws3 = XLSX.utils.aoa_to_sheet([]);
    ws3[enc({ r: 0, c: 0 })] = { t: 's', v: `Computations — ${periodLabel}` };
    ws3['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
    ws3['!rows'] = [{ hpt: 30 }];
    let r3 = 1;
    const appendR = (row) => { XLSX.utils.sheet_add_aoa(ws3, [row], { origin: 'A' + (r3 + 1) }); r3++; };

    const secRows = [];
    const hdrRows = [];
    const totRows = [];
    const amtCells = [];

    appendR(['Key Metrics']);
    secRows.push(r3 - 1);
    [
      ['Total Telecallers', calcRows1.length],
      ['Total Calls', tcalls],
      ['Total Connected', tconn],
      ['Connection Rate', tcalls ? `${((tconn / tcalls) * 100).toFixed(1)}%` : '—'],
      ['Non-Connected', tnc],
      ['Interested', tint],
      ['Received Donors', tdon],
      ['Received Amount (₹)', tamt],
      ['Conversion Rate', tcalls ? `${((tdon / tcalls) * 100).toFixed(1)}%` : '—'],
      ['Avg Ticket Size (₹)', tdon ? Math.round(tamt / tdon) : 0],
    ].forEach(([lbl, val]) => { appendR([lbl, val]); if (lbl.includes('₹')) amtCells.push([r3 - 1, 1]); });

    appendR(['']);
    const hourTotals = {};
    if (hourlyDataToUse && hourlyDataToUse.length) {
      hourlyDataToUse.forEach(h => {
        const k = h.hour || 'Unknown';
        hourTotals[k] = hourTotals[k] || { calls: 0, connected: 0, interested: 0, donations: 0, amount: 0 };
        hourTotals[k].calls += h.calls || 0; hourTotals[k].connected += h.connected || 0;
        hourTotals[k].interested += h.interested || 0; hourTotals[k].donations += h.donations || 0;
        hourTotals[k].amount += h.amount || 0;
      });
      appendR(['Hourly Totals']);
      secRows.push(r3 - 1);
      appendR(['Hour Slot', 'Calls', 'Connected', 'Interested', 'Donations', 'Amount (₹)']);
      hdrRows.push(r3 - 1);
      Object.keys(hourTotals).sort().forEach(k => {
        const t = hourTotals[k];
        appendR([k, t.calls, t.connected, t.interested, t.donations, t.amount]);
        amtCells.push([r3 - 1, 5]);
      });
      const ht = Object.values(hourTotals).reduce((a, t) => ({
        calls: a.calls + t.calls, connected: a.connected + t.connected, interested: a.interested + t.interested,
        donations: a.donations + t.donations, amount: a.amount + t.amount
      }), { calls: 0, connected: 0, interested: 0, donations: 0, amount: 0 });
      appendR(['TOTAL', ht.calls, ht.connected, ht.interested, ht.donations, ht.amount]);
      totRows.push(r3 - 1);
      amtCells.push([r3 - 1, 5]);
      appendR(['']);
    }

    appendR(['Per-Telecaller Share']);
    secRows.push(r3 - 1);
    appendR(['Telecaller', 'Calls', 'Connected', 'Interest (I/C) %', 'Amount (₹)', 'Share %']);
    hdrRows.push(r3 - 1);
    calcRows1.forEach(({ p, c }) => {
      appendR([p.fro_name, c.calls, c.connected, c.connected ? `${((c.interested / c.connected) * 100).toFixed(1)}%` : '—', c.received, tamt ? `${((c.received / tamt) * 100).toFixed(1)}%` : '—']);
      amtCells.push([r3 - 1, 4]);
    });
    appendR(['TOTAL', tcalls, tconn, tconn ? `${((tint / tconn) * 100).toFixed(1)}%` : '—', tamt, '100%']);
    totRows.push(r3 - 1);
    amtCells.push([r3 - 1, 4]);
    appendR(['']);

    const shareCols = calcRows1.map(({ p }) => p.fro_name);
    const statusKeys = [...new Set(calcRows1.flatMap(({ c }) => Object.keys(c.statuses)))];
    appendR(['Connected-Status Matrix']);
    secRows.push(r3 - 1);
    appendR(['Connected Disposition', ...shareCols, 'TOTAL']);
    hdrRows.push(r3 - 1);
    statusKeys.forEach(k => {
      const vals = calcRows1.map(({ c }) => c.statuses[k] || 0);
      appendR([DISPOSITION_LABELS[k] || k, ...vals, vals.reduce((a, b) => a + b, 0)]);
    });
    const colTotals = shareCols.length ? calcRows1.map(({ c }, i) => statusKeys.reduce((a, k) => a + (c.statuses[k] || 0), 0)) : [];
    appendR(['TOTAL', ...colTotals, colTotals.reduce((a, b) => a + b, 0)]);
    totRows.push(r3 - 1);

    spanRef(ws3);
    ws3['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
    styleCell(ws3, 0, 0, TITLE);
    secRows.forEach(r => {
      styleCell(ws3, r, 0, { font: { name: 'Calibri', sz: 11, bold: true } });
    });
    hdrRows.forEach(r => {
      for (let c = 0; c <= 5; c++) styleCell(ws3, r, c, { ...HDR, fgColor: { rgb: 'D9DFCE' }, font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '3F4A38' } } });
    });
    totRows.forEach(r => {
      for (let c = 0; c <= 5; c++) styleCell(ws3, r, c, SUB);
    });
    for (let r = 0; r < r3; r++) {
      amtCells.forEach(([ar, ac]) => { if (ar === r) styleCell(ws3, ar, ac, { font: FONT, alignment: { horizontal: 'center' }, numFmt: AMT.numFmt }); });
    }
    XLSX.utils.book_append_sheet(wb, ws3, 'Computations');

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `telecaller-performance-${dateStr}.xlsx`);
  };

  return (
    <div>
      <div className="filter-bar">
        <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: '#eef1f6', borderRadius: 12 }}>
          {[['today', 'Today'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['custom', 'Custom']].map(([val, label]) => (
            <button key={val} onClick={() => setDashPeriod(val)} style={{ fontSize: 12.5, fontWeight: 700, padding: '7px 15px', borderRadius: 9, border: 'none', cursor: 'pointer', background: dashPeriod === val ? '#111827' : 'transparent', color: dashPeriod === val ? '#fff' : '#475569', transition: 'background .12s, color .12s' }}>{label}</button>
          ))}
        </div>
        {dashPeriod === 'custom' && (
          <>
            <input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} style={{ padding: '8px 12px', border: '1.5px solid var(--line)', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', background: '#fff' }} />
            <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>to</span>
            <input type="date" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} style={{ padding: '8px 12px', border: '1.5px solid var(--line)', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', background: '#fff' }} />
          </>
        )}
        <select value={selectedFroId} onChange={(e) => setSelectedFroId(e.target.value)} style={{ padding: '8px 12px', border: '1.5px solid var(--line)', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
          <option value="">All Telecallers</option>
          {(tlData?.performance || []).map(p => (
            <option key={p.fro_id} value={p.fro_id}>{p.fro_name}</option>
          ))}
        </select>
        <button
          onClick={() => fetchDashboard({ fresh: true })}
          disabled={loading}
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 'auto', opacity: loading ? 0.7 : 1, cursor: loading ? 'default' : 'pointer' }}
          title="Reload dashboard with fresh data"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'weak-spin' : ''}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Top 4 Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 14, marginBottom: 16,
      }}>
        <div className="card" style={{ marginBottom: 0, padding: '16px 18px', cursor: 'pointer' }} onClick={() => setSelectedPeriod('today')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Collection</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>₹{Number(tlData?.kpis?.received_amount ?? today_collection).toLocaleString('en-IN')}</span>
          </div>
          <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: '#eef1f6', borderRadius: 12, marginBottom: 8 }}>
            {NGO_TABS.map(([code, label]) => (
              <button key={code || 'all'} onClick={(e) => { e.stopPropagation(); handleNgoTab(code); }} style={{ fontSize: 12.5, fontWeight: 700, padding: '7px 15px', borderRadius: 9, border: 'none', cursor: 'pointer', background: ngoTab === code ? '#111827' : 'transparent', color: ngoTab === code ? '#fff' : '#475569', transition: 'background .12s, color .12s' }}>{label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ width: 64, height: 64, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d4d4d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Total</span>
                <span style={{ fontWeight: 600 }}>₹{Number(tlData?.kpis?.received_amount ?? today_collection).toLocaleString('en-IN')}</span>
              </div>
              {Number(tlData?.kpis?.received_amount ?? today_collection) > 0 && (
                <div style={{ height: 4, borderRadius: 2, background: '#e5e7eb', overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: '100%', borderRadius: 2, background: '#f59e0b', opacity: 0.6 }} />
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: Number(tlData?.kpis?.received_amount ?? today_collection) > 0 ? 2 : 0 }}>
                {Number(tlData?.kpis?.received_amount ?? today_collection) === 0 ? 'No collections yet' : PERIOD_LABELS[dashPeriod]}
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px', cursor: 'pointer', border: '1px solid #16a34a33' }} onClick={() => setSelectedStatus('verified')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Verified</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>₹{Number(tlData?.kpis?.received_amount ?? verified_month_amount).toLocaleString('en-IN')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-soft)' }}>
            <span>{tlData?.kpis?.donations ?? verified_month_count} verified donations</span>
            <span>{PERIOD_LABELS[dashPeriod]}</span>
          </div>
          <div style={{ fontSize: 10, color: '#16a34a', marginTop: 4 }}>Verified by Accounts panel</div>
        </div>

      </div>

      {/* Idle Alert Banner */}
      {tlData?.idle_alerts?.length > 0 && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: '#fef3c7', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14 }}>⚠️</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#92400e' }}>Idle Alerts:</span>
          {tlData.idle_alerts.map(a => (
            <span key={a.fro_id} style={{ fontSize: 11, fontWeight: 500, color: '#78350f', background: '#fff', padding: '2px 10px', borderRadius: 12, border: '1px solid #fde68a' }}>
              {a.fro_name} — {a.idle_minutes}m idle
            </span>
          ))}
        </div>
      )}

      {/* Telecaller Live Status KPI Bar */}
      {tlData?.kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Telecallers', value: tlData.kpis.total_fros || 0, color: '#1e40af', bg: '#eff6ff' },
            { label: 'Calling', value: tlData.kpis.calling || 0, color: '#16a34a', bg: '#f0fdf4' },
            { label: 'Idle', value: tlData.kpis.idle || 0, color: '#d97706', bg: '#fffbeb' },
            { label: 'Offline', value: tlData.kpis.offline || 0, color: '#dc2626', bg: '#fef2f2' },
            { label: 'Total Calls', value: tlData.kpis.total_calls || 0, color: '#7c3aed', bg: '#f5f3ff' },
            { label: 'Connected', value: tlData.kpis.connected || 0, color: '#0891b2', bg: '#ecfeff' },
            { label: 'Not Connected', value: tlData.kpis.not_connected || 0, color: '#dc2626', bg: '#fef2f2' },
            { label: 'Connect %', value: (tlData.kpis.connect_rate || 0) + '%', color: '#334155', bg: '#f1f5f9' },
            { label: 'Donations', value: tlData.kpis.donations || 0, color: '#16a34a', bg: '#f0fdf4' },
            { label: 'Interested', value: tlData.kpis.interested || 0, color: '#db2777', bg: '#fdf2f8' },
            { label: 'Received', value: '₹' + Number(tlData.kpis.received_amount || 0).toLocaleString('en-IN'), color: '#16a34a', bg: '#f0fdf4', isAmount: true },
            { label: 'Follow-ups Due', value: tlData.kpis.followups_due || 0, color: '#ea580c', bg: '#fff7ed' },
            { label: 'Target %', value: (tlData.kpis.target_pct || 0) + '%', color: tlData.kpis.target_pct >= 75 ? '#16a34a' : '#dc2626', bg: tlData.kpis.target_pct >= 75 ? '#f0fdf4' : '#fef2f2' },
          ].map((s, i) => (
            <div key={i} className="card" style={{ marginBottom: 0, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 9, color: 'var(--ink-soft)', fontWeight: 600, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* REQUIREMENT 1: Daily Collection Target + Monthly Collection Target (Directly Below) */}
      {daily_target > 0 && (
        <div className="card" style={{ marginBottom: 12, padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            <span style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 600, flex: 1 }}>Daily Collection Target
              <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 400, marginLeft: 6 }}>Set by Super Admin</span>
            </span>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Target: <strong style={{ color: 'var(--ink)' }}>₹{daily_target.toLocaleString('en-IN')}</strong></span>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Collected: <strong style={{ color: '#16a34a' }}>₹{today_collection.toLocaleString('en-IN')}</strong></span>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Remaining: <strong style={{ color: today_collection >= daily_target ? '#16a34a' : '#ef4444' }}>₹{Math.max(0, daily_target - today_collection).toLocaleString('en-IN')}</strong></span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: '#fef2f2', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, (today_collection / daily_target) * 100)}%`,
              height: '100%',
              borderRadius: 4,
              background: today_collection >= daily_target ? '#16a34a' : today_collection >= daily_target * 0.5 ? '#f59e0b' : '#ef4444',
              transition: 'width .5s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-soft)', marginTop: 4 }}>
            <span>{Math.round((today_collection / daily_target) * 100)}% achieved</span>
            <span>{today_collection >= daily_target ? 'Daily target completed!' : `${Math.round(((daily_target - today_collection) / daily_target) * 100)}% remaining`}</span>
          </div>
        </div>
      )}

      {monthly_target > 0 && (
        <div className="card" style={{ marginBottom: 16, padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>
            <span style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 600, flex: 1 }}>Monthly Collection Target
              <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 400, marginLeft: 6 }}>Current Month</span>
            </span>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Target: <strong style={{ color: 'var(--ink)' }}>₹{monthly_target.toLocaleString('en-IN')}</strong></span>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Collected: <strong style={{ color: '#16a34a' }}>₹{month_collection.toLocaleString('en-IN')}</strong></span>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Remaining: <strong style={{ color: month_collection >= monthly_target ? '#16a34a' : '#ef4444' }}>₹{Math.max(0, monthly_target - month_collection).toLocaleString('en-IN')}</strong></span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: '#fef2f2', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, (month_collection / monthly_target) * 100)}%`,
              height: '100%',
              borderRadius: 4,
              background: month_collection >= monthly_target ? '#16a34a' : month_collection >= monthly_target * 0.5 ? '#f59e0b' : '#ef4444',
              transition: 'width .5s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-soft)', marginTop: 4 }}>
            <span>{Math.round((month_collection / monthly_target) * 100)}% achieved</span>
            <span>{month_collection >= monthly_target ? 'Monthly target completed!' : `${Math.round(((monthly_target - month_collection) / monthly_target) * 100)}% remaining`}</span>
          </div>
        </div>
      )}

      {/* REQUIREMENT 3: Workforce / Attendance (Left) & Stations (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 16 }}>
        {/* Left: Workforce & Attendance */}
        <div className="card" style={{ marginBottom: 0, padding: '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Workforce & Attendance</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{total_workers}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 64, height: 64, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[
                      { name: 'Present', value: Math.max(0, workers_present), color: '#22c55e' },
                      { name: 'Late', value: Math.max(0, workers_late), color: '#f59e0b' },
                      { name: 'Absent', value: Math.max(0, workers_absent), color: '#ef4444' },
                      { name: 'No Show', value: Math.max(0, workers_no_mark), color: '#d1d5db' },
                    ].filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={20} outerRadius={30} dataKey="value" startAngle={90} endAngle={-270}>
                      <Cell fill="#22c55e" />
                      <Cell fill="#f59e0b" />
                      <Cell fill="#ef4444" />
                      <Cell fill="#d1d5db" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                  <span style={{ color: '#22c55e', fontWeight: 600 }}>Present</span>
                  <span style={{ fontWeight: 600 }}>{workers_present}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                  <span style={{ color: '#f59e0b', fontWeight: 500 }}>Late</span>
                  <span style={{ fontWeight: 500, color: '#f59e0b' }}>{workers_late}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#ef4444', fontWeight: 500 }}>Absent</span>
                  <span style={{ fontWeight: 500, color: '#ef4444' }}>{workers_absent}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>{attendance_pct}% attendance</div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, background: '#f0fdf4', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e' }}>{workers_present}</div>
                <div style={{ fontSize: 9, color: 'var(--ink-soft)' }}>Present</div>
              </div>
              <div style={{ flex: 1, background: '#fffbeb', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b' }}>{workers_late}</div>
                <div style={{ fontSize: 9, color: 'var(--ink-soft)' }}>Late</div>
              </div>
              <div style={{ flex: 1, background: '#fef2f2', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444' }}>{workers_absent}</div>
                <div style={{ fontSize: 9, color: 'var(--ink-soft)' }}>Absent</div>
              </div>
              <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#6b7280' }}>{workers_no_mark}</div>
                <div style={{ fontSize: 9, color: 'var(--ink-soft)' }}>No Show</div>
              </div>
            </div>
            {total_workers > 0 && (
              <div style={{ height: 4, borderRadius: 2, background: '#e5e7eb', marginTop: 8, overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${(workers_present / total_workers) * 100}%`, height: '100%', background: '#22c55e' }} />
                <div style={{ width: `${(workers_late / total_workers) * 100}%`, height: '100%', background: '#f59e0b' }} />
              </div>
            )}
          </div>
        </div>

        {/* Right: Stations — Total & Currently Active */}
        <div className="card" style={{ marginBottom: 0, padding: '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Stations</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10, textAlign: 'center' }}>
              <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '8px 6px' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>{stations_summary.total}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>Total Stations</div>
              </div>
              <div style={{ background: '#f0fdf4', borderRadius: 6, padding: '8px 6px' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{stations_summary.active}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>Active Now</div>
              </div>
            </div>
          </div>
          {Object.keys(stations_per_ngo).length > 0 && (
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 6, textTransform: 'uppercase' }}>Stations per NGO — Active / Total</div>
              {Object.entries(stations_per_ngo).map(([name, v]) => {
                const total = typeof v === 'number' ? v : (Number(v?.total) || 0);
                const active = v && typeof v === 'object' ? (Number(v.active) || 0) : 0;
                const pct = total > 0 ? Math.min(100, (active / total) * 100) : 0;
                return (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, minWidth: 50, color: 'var(--ink)' }}>{name}</span>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#e5e7eb', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: '#16a34a', transition: 'width .3s ease' }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, minWidth: 40, textAlign: 'right', color: 'var(--ink)' }}>{active}/{total}</span>
                  </div>
                );
              })}
              <div style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 6 }}>Active = station's FRO is online right now</div>
            </div>
          )}
        </div>
      </div>

      {/* REQUIREMENT 2: Top Collection (Left) & Low Collection (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 16 }}>
        {/* Left: Top Collection */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-head">
            <h3 style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#f59e0b' }}>🏆</span> Top by Collection
            </h3>
          </div>
          <div className="card-pad" style={{ padding: 0 }}>
            {tlData?.top_performers?.amount?.length > 0 ? (
              tlData.top_performers.amount.map((p, i) => (
                <div key={p.fro_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: i < tlData.top_performers.amount.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : 'var(--ink-soft)', minWidth: 16 }}>#{i + 1}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{p.fro_name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>₹{Number(p.collection_amount || 0).toLocaleString('en-IN')}</span>
                </div>
              ))
            ) : (
              <div style={{ padding: 16, textAlign: 'center', fontSize: 11, color: 'var(--ink-soft)' }}>No collections recorded yet</div>
            )}
          </div>
        </div>

        {/* Right: Low Collection / Weak Performers */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-head">
            <h3 style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#dc2626' }}>⚠️</span> Low Performance
            </h3>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <button onClick={() => setWeakPeriod('today')} disabled={weakLoading}
                style={{ padding:'2px 8px', borderRadius:10, border:'1px solid var(--line)', fontSize:10, fontWeight:600, fontFamily:'inherit', cursor: weakLoading ? 'default' : 'pointer', opacity: weakLoading ? 0.6 : 1, background: weakPeriod === 'today' ? 'var(--sage)' : '#fff', color: weakPeriod === 'today' ? '#fff' : 'var(--ink)' }}>
                Today
              </button>
              <button onClick={() => setWeakPeriod('month')} disabled={weakLoading}
                style={{ padding:'2px 8px', borderRadius:10, border:'1px solid var(--line)', fontSize:10, fontWeight:600, fontFamily:'inherit', cursor: weakLoading ? 'default' : 'pointer', opacity: weakLoading ? 0.6 : 1, background: weakPeriod === 'month' ? 'var(--sage)' : '#fff', color: weakPeriod === 'month' ? '#fff' : 'var(--ink)' }}>
                Month
              </button>
              {weakLoading && <span style={{ fontSize:10, color:'var(--ink-soft)', display:'flex', alignItems:'center', gap:4 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="3" strokeLinecap="round" className="weak-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" className="weak-spin-arc"/></svg>
                Loading…
              </span>}
            </div>
          </div>
          <div className="card-pad" style={{ padding: 0, overflowX: 'auto' }}>
            {weakPerformers.length > 0 ? (
              <table style={{ fontSize: 11, width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{width:24, fontSize:10, padding:'6px 8px', textAlign:'left'}}>#</th>
                    <th style={{fontSize:10, padding:'6px 8px', textAlign:'left'}}>FRO</th>
                    <th style={{textAlign:'right', fontSize:10, padding:'6px 8px'}}>Collection</th>
                    <th style={{textAlign:'center', fontSize:10, padding:'6px 8px'}}>Att.</th>
                    <th style={{textAlign:'center', fontSize:10, padding:'6px 8px'}}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {weakPerformers.slice(0, showAllLowPerformers ? weakPerformers.length : 11).map((p, i) => (
                    <tr key={p.fro_id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{color:'var(--ink-soft)', fontSize:10, padding:'5px 8px'}}>{i + 1}</td>
                      <td style={{fontWeight:600, fontSize:11, padding:'5px 8px'}}>{p.fro_name}</td>
                      <td style={{textAlign:'right', fontWeight:600, fontSize:11, padding:'5px 8px'}}>₹{p.collection_amount.toLocaleString('en-IN')}</td>
                      <td style={{textAlign:'center', padding:'5px 8px'}}>
                        {p.attendance_pct != null
                          ? <span style={{color: p.attendance_pct < 50 ? '#dc2626' : p.attendance_pct < 75 ? '#f59e0b' : '#16a34a', fontWeight:600, fontSize:11}}>{p.attendance_pct}%</span>
                          : '—'}
                      </td>
                      <td style={{textAlign:'center', fontWeight:700, color:p.score < 0.2 ? '#dc2626' : '#f59e0b', fontSize:11, padding:'5px 8px'}}>{p.score.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                {weakPerformers.length > 11 && !showAllLowPerformers && (
                  <tfoot>
                    <tr>
                      <td colSpan={5} style={{padding:0}}>
                        <button onClick={() => setShowAllLowPerformers(true)}
                          style={{width:'100%', padding:'6px 10px', border:'none', fontSize:10, fontWeight:600, fontFamily:'inherit', cursor:'pointer', background:'var(--sage-soft)', color:'var(--sage)', textAlign:'center'}}>
                          View All {weakPerformers.length} FROs →
                        </button>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            ) : (
              <div style={{ padding: 16, textAlign: 'center', fontSize: 11, color: 'var(--ink-soft)' }}>No low performing FROs flagged</div>
            )}
          </div>
        </div>
      </div>

      {/* REQUIREMENT 5: Dedicated Hourly Collection Performance (Full Width) */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head" style={{ flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Hourly Collection Performance
          </h3>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' }}>
            <button
              onClick={() => setHourlyDate(new Date().toISOString().slice(0, 10))}
              style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                border: `1px solid ${hourlyDate === new Date().toISOString().slice(0, 10) ? 'var(--sage)' : 'var(--line)'}`,
                background: hourlyDate === new Date().toISOString().slice(0, 10) ? 'var(--sage)' : '#fff',
                color: hourlyDate === new Date().toISOString().slice(0, 10) ? '#fff' : 'var(--ink)',
                cursor: 'pointer'
              }}
            >
              Today
            </button>
            <button
              onClick={() => {
                const y = new Date();
                y.setDate(y.getDate() - 1);
                setHourlyDate(y.toISOString().slice(0, 10));
              }}
              style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                border: `1px solid ${hourlyDate === new Date(Date.now() - 86400000).toISOString().slice(0, 10) ? 'var(--sage)' : 'var(--line)'}`,
                background: hourlyDate === new Date(Date.now() - 86400000).toISOString().slice(0, 10) ? 'var(--sage)' : '#fff',
                color: hourlyDate === new Date(Date.now() - 86400000).toISOString().slice(0, 10) ? '#fff' : 'var(--ink)',
                cursor: 'pointer'
              }}
            >
              Yesterday
            </button>
            <input
              type="date"
              value={hourlyDate}
              onChange={e => setHourlyDate(e.target.value)}
              style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 11, fontFamily: 'inherit', outline: 'none', background: 'var(--bg)', color: 'var(--ink)' }}
            />
            <button
              onClick={handleHourlyExport}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: 'inherit', border: '1px solid var(--line)', background: '#fff', color: 'var(--ink)', cursor: 'pointer' }}
            >
              <Download width="12" height="12" />
              Export Hourly (XLSX)
            </button>
          </div>
        </div>
        <div className="card-pad" style={{ padding: 0, overflowX: 'auto', maxHeight: 300, overflowY: 'auto' }}>
          {hourlyLoading ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--ink-soft)' }}>Loading hourly data...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', color: 'var(--ink-soft)', background: 'var(--bg)' }}>Time Slot</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 10, textTransform: 'uppercase', color: 'var(--ink-soft)', background: 'var(--bg)' }}>Calls</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 10, textTransform: 'uppercase', color: 'var(--ink-soft)', background: 'var(--bg)' }}>Connected</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 10, textTransform: 'uppercase', color: 'var(--ink-soft)', background: 'var(--bg)' }}>Interested</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 10, textTransform: 'uppercase', color: 'var(--ink-soft)', background: 'var(--bg)' }}>Donations</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 10, textTransform: 'uppercase', color: 'var(--ink-soft)', background: 'var(--bg)' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(hourlyList.length > 0 ? hourlyList : (tlData?.hourly || [])).map(h => {
                  const hasData = (h.calls || 0) > 0 || (h.connected || 0) > 0 || (h.donations || 0) > 0;
                  return (
                    <tr key={h.hour} style={{ background: !hasData ? '#f9fafb' : 'transparent', borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '6px 10px', fontWeight: 600 }}>{h.hour}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>{h.calls || 0}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', color: '#16a34a' }}>{h.connected || 0}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', color: '#ec4899' }}>{h.interested || 0}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', color: '#8b5cf6' }}>{h.donations || 0}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: (h.amount || 0) > 0 ? '#16a34a' : 'var(--ink-soft)' }}>
                        ₹{Number(h.amount || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <style>{`@keyframes weakSpin { to { transform: rotate(360deg); } } .weak-spin { animation: weakSpin .6s linear infinite; transform-origin: center; }`}</style>

      {/* Section 6: Telecaller Performance Table */}
      {tlData?.performance?.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head" style={{ flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              Telecaller Performance
              <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ink-soft)' }}> — {froSearch ? tlData.performance.filter(p => p.fro_name?.toLowerCase().includes(froSearch.toLowerCase())).length : tlData.performance.length} FROs</span>
            </h3>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search FRO name..."
                value={froSearch}
                onChange={e => setFroSearch(e.target.value)}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 11, fontFamily: 'inherit', outline: 'none', width: 150, background: 'var(--bg)', color: 'var(--ink)' }}
              />
              <button 
                onClick={handleTelecallerExport}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: 'inherit', border: 'none', background: 'var(--sage)', color: '#fff', cursor: 'pointer' }}
                title="Export Day-wise summary and FRO hourly sheets"
              >
                <Download width="12" height="12" />
                Export Full Report (XLSX)
              </button>
            </div>
          </div>
          <div className="card-pad" style={{ padding: 0, overflowX: 'auto', maxHeight: 440, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg, #fff)', padding: '10px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600, borderBottom: '2px solid var(--line)' }}>#</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg, #fff)', padding: '10px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600, borderBottom: '2px solid var(--line)' }}>Name</th>
                  <th className="perf-hide-mobile" style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg, #fff)', padding: '10px', textAlign: 'center', fontSize: 10, textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600, borderBottom: '2px solid var(--line)' }}>Status</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg, #fff)', padding: '10px', textAlign: 'right', fontSize: 10, textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600, borderBottom: '2px solid var(--line)' }}>Total Calls ({PERIOD_LABELS[dashPeriod]})</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg, #fff)', padding: '10px', textAlign: 'right', fontSize: 10, textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600, borderBottom: '2px solid var(--line)' }}>Connected</th>
                  {CONNECTED_STATUS_COLUMNS.map(c => (
                    <th key={c.key} className="perf-hide-mobile" title={DISPOSITION_LABELS[c.key] || c.label} style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg, #fff)', padding: '10px', textAlign: 'right', fontSize: 9, textTransform: 'uppercase', color: c.color, fontWeight: 700, borderBottom: '2px solid var(--line)' }}>
                      {c.label}
                      <span style={{ display: 'block', fontSize: 8, color: 'var(--ink-soft)', fontWeight: 500 }}>{PERIOD_LABELS[dashPeriod]}</span>
                    </th>
                  ))}
                  <th className="perf-hide-mobile" style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg, #fff)', padding: '10px', textAlign: 'right', fontSize: 10, textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600, borderBottom: '2px solid var(--line)' }}>Non-Connected</th>
                  <th className="perf-hide-mobile" style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg, #fff)', padding: '10px', textAlign: 'right', fontSize: 10, textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600, borderBottom: '2px solid var(--line)' }}>Interested</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg, #fff)', padding: '10px', textAlign: 'right', fontSize: 10, textTransform: 'uppercase', color: 'var(--ink-soft)', fontWeight: 600, borderBottom: '2px solid var(--line)' }}>Received ({PERIOD_LABELS[dashPeriod]})</th>
                </tr>
              </thead>
              <tbody>
                {tlData.performance.filter(p => !froSearch || p.fro_name?.toLowerCase().includes(froSearch.toLowerCase())).map((p, i) => {
                  const statusColors = { on_call: '#16a34a', online: '#3b82f6', idle: '#f59e0b', offline: '#9ca3af' };
                  const statusLabels = { on_call: 'Calling', online: 'Online', idle: 'Idle', offline: 'Offline' };
                  const sc = statusColors[p.status] || '#9ca3af';
                  const periodCalls = p.calls_range || 0;
                  const periodConnected = p.connected_range || 0;
                  const periodInterested = p.interested_range || 0;
                  const periodReceived = p.receivedAmount_range || 0;
                  const periodNonConnected = p.non_connected_range ?? Math.max(0, periodCalls - periodConnected);
                  
                  const activeStatuses = p.connectedStatuses_range || {};

                  return (
                    <tr key={p.fro_id} style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td style={{ padding: '10px', color: 'var(--ink-soft)', fontSize: 11 }}>{i + 1}</td>
                      <td style={{ padding: '10px', fontWeight: 600 }}>
                        {p.fro_name}
                        <span className="perf-show-inline" style={{ fontSize: 10, color: sc, fontWeight: 500, marginLeft: 6 }}>
                          {statusLabels[p.status] || 'Offline'}
                        </span>
                      </td>
                      <td className="perf-hide-mobile" style={{ padding: '10px', textAlign: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: sc }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc, display: 'inline-block' }} />
                          {statusLabels[p.status] || 'Offline'}
                        </span>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>{periodCalls}</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#16a34a', fontWeight: 600, cursor: 'pointer', textDecoration: periodConnected > 0 ? 'underline' : 'none' }}
                        onClick={(e) => { e.stopPropagation(); if (periodConnected > 0) setSelectedFro({ froId: p.fro_id, froName: p.fro_name, filterType: 'connected' }); }}>{periodConnected}</td>
                      {CONNECTED_STATUS_COLUMNS.map(col => {
                        const count = activeStatuses[col.key] || 0;
                        return (
                          <td key={col.key} className="perf-hide-mobile" style={{ padding: '10px', textAlign: 'right', color: count > 0 ? col.color : 'var(--ink-soft)', fontWeight: 600, cursor: count > 0 ? 'pointer' : 'default', textDecoration: count > 0 ? 'underline' : 'none', fontSize: 11 }}
                            onClick={(e) => { e.stopPropagation(); if (count > 0) setSelectedFro({ froId: p.fro_id, froName: p.fro_name, filterType: 'connected', status: col.key }); }}>{count > 0 ? count : '—'}</td>
                        );
                      })}
                      <td className="perf-hide-mobile" style={{ padding: '10px', textAlign: 'right', color: '#dc2626', fontWeight: 600, cursor: 'pointer', textDecoration: periodNonConnected > 0 ? 'underline' : 'none' }}
                        onClick={(e) => { e.stopPropagation(); if (periodNonConnected > 0) setSelectedFro({ froId: p.fro_id, froName: p.fro_name, filterType: 'non_connected' }); }}>{periodNonConnected}</td>
                      <td className="perf-hide-mobile" style={{ padding: '10px', textAlign: 'right', color: '#ec4899' }}>{periodInterested}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: (periodReceived || 0) > 0 ? '#16a34a' : 'var(--ink-soft)' }}>
                        ₹{Number(periodReceived || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <style>{`
            .perf-show-inline { display: none; }
            @media (max-width: 768px) {
              .perf-hide-mobile { display: none !important; }
              .perf-show-inline { display: inline !important; }
            }
          `}</style>
        </div>
      )}

      {/* Section 7: Follow-up Management */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head" style={{ cursor: 'pointer' }} onClick={() => setShowFollowups(!showFollowups)}>
          <h3 style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Follow-up Management
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ink-soft)' }}>{showFollowups ? '▲ collapse' : '▼ expand'}</span>
          </h3>
        </div>
        {showFollowups && (
          <div className="card-pad">
            {followupLoading ? (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--ink-soft)' }}>Loading follow-ups...</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  {[
                    { key: 'overdue', label: 'Overdue', color: '#dc2626', bg: '#fef2f2' },
                    { key: 'today', label: 'Today', color: '#ea580c', bg: '#fff7ed' },
                    { key: 'tomorrow', label: 'Tomorrow', color: '#2563eb', bg: '#eff6ff' },
                    { key: 'future', label: 'Future', color: '#6b7280', bg: '#f9fafb' },
                    { key: 'week', label: 'This Week', color: '#5B6B4E', bg: '#f0f2ee' },
                    { key: 'month', label: 'This Month', color: '#7c3aed', bg: '#f5f3ff' },
                  ].map(tab => {
                    const count = followups.filter(f => (f.buckets || (f.bucket ? [f.bucket] : [])).includes(tab.key)).length;
                    const active = followupMode === 'bucket' && followupTab === tab.key;
                    return (
                      <button key={tab.key} onClick={() => { setFollowupMode('bucket'); setFollowupTab(tab.key); }} style={{
                        padding: '5px 14px', borderRadius: 20, border: active ? `2px solid ${tab.color}` : '1px solid var(--line)',
                        fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                        background: active ? tab.bg : '#fff', color: active ? tab.color : 'var(--ink-soft)',
                      }}>
                        {tab.label} ({count})
                      </button>
                    );
                  })}
                  <span style={{ width: 1, height: 20, background: 'var(--line)', margin: '0 4px' }} />
                  <button onClick={() => { setFollowupMode('daywise'); setFollowupTab(''); }} style={{
                    padding: '5px 14px', borderRadius: 20, fontFamily: 'inherit',
                    border: followupMode === 'daywise' ? '2px solid #5B6B4E' : '1px solid var(--line)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: followupMode === 'daywise' ? '#e8ede1' : '#fff',
                    color: followupMode === 'daywise' ? '#3f4a38' : 'var(--ink-soft)',
                  }}>
                    Day-wise
                  </button>
                </div>
                {followupMode === 'daywise' ? (
                  (() => {
                    const todayStr = toIstDate();
                    const yesterdayStr = toIstDate(new Date(Date.now() - 86400000));
                    const totalDay = daywiseRows.length;
                    return (
                      <div>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                          {[{ label: 'Today', value: todayStr }, { label: 'Yesterday', value: yesterdayStr }].map(opt => (
                            <button key={opt.label} onClick={() => setFollowupDay(opt.value)} style={{
                              padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                              border: followupDay === opt.value ? '1.5px solid #5B6B4E' : '1px solid var(--line)',
                              background: followupDay === opt.value ? '#e8ede1' : '#fff',
                              color: followupDay === opt.value ? '#3f4a38' : 'var(--ink-soft)',
                            }}>{opt.label}</button>
                          ))}
                          <input
                            type="date"
                            value={followupDay}
                            max={todayStr}
                            onChange={e => setFollowupDay(e.target.value)}
                            style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 11, fontFamily: 'inherit', outline: 'none', background: 'var(--bg)', color: 'var(--ink)' }}
                          />
                          <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{totalDay} record{totalDay !== 1 ? 's' : ''}</span>
                        </div>
                        {daywiseLoading ? (
                          <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: 'var(--ink-soft)' }}>Loading follow-ups...</div>
                        ) : daywiseSummary.length === 0 ? (
                          <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: 'var(--ink-soft)' }}>No follow-ups or callbacks on {followupDay}</div>
                        ) : (
                          <FollowupSummaryTable
                            summary={daywiseSummary}
                            hint={`${totalDay} record${totalDay !== 1 ? 's' : ''} — click a telecaller to view that day's donors`}
                            onSelect={setFupDetailWorker}
                          />
                        )}
                      </div>
                    );
                  })()
) : (
                  (() => {
                    const tabLabel = FOLLOWUP_TAB_LABELS[followupTab] || followupTab;
                    if (bucketSummary.length === 0) return <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: 'var(--ink-soft)' }}>No {tabLabel} follow-ups</div>;
                    return (
                      <FollowupSummaryTable
                        summary={bucketSummary}
                        hint={`${bucketRows.length} record${bucketRows.length !== 1 ? 's' : ''} in ${tabLabel} — click a telecaller to view donors`}
                        onSelect={setFupDetailWorker}
                      />
                    );
                  })()
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Call Connectivity Widget */}
      {(() => {
        const s = callAnalytics?.summary
        if (!s) return null
        const rateNum = parseInt(s.connection_rate) || 0
        return (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--ink-soft)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              Call Connectivity
              <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10, marginLeft: 'auto' }}>
                Today · {s.connection_rate} connected
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 14 }}>
              <div className="card" style={{ marginBottom: 0, padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: rateNum >= 50 ? '#16a34a' : '#dc2626', lineHeight: 1.1 }}>{s.connection_rate}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 2 }}>Connection Rate</div>
                <div style={{ fontSize: 9, color: 'var(--ink-soft)', marginTop: 1 }}>{s.connected} connected · {s.not_connected} not connected</div>
              </div>
              <div className="card" style={{ marginBottom: 0, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 6 }}>Top FROs</div>
                {callAnalytics?.by_fro?.slice(0, 3).map((f, i) => (
                  <div key={f.fro_worker_id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 8, color: 'var(--ink-soft)', minWidth: 12 }}>#{i + 1}</span>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fro_name}</span>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--bg)', flex: 1, maxWidth: 60 }}>
                        <div style={{ height: '100%', borderRadius: 2, width: Math.min((f.connected / Math.max(f.total, 1)) * 100, 100) + '%', background: '#16a34a' }} />
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 600, minWidth: 28, textAlign: 'right' }}>{Math.round((f.connected / Math.max(f.total, 1)) * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="card" style={{ marginBottom: 0, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 6 }}>Bottom FROs</div>
                {callAnalytics?.by_fro?.slice(-3).reverse().map((f, i) => (
                  <div key={f.fro_worker_id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 8, color: 'var(--ink-soft)', minWidth: 12 }}>#{i + 1}</span>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fro_name}</span>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--bg)', flex: 1, maxWidth: 60 }}>
                        <div style={{ height: '100%', borderRadius: 2, width: Math.min((f.connected / Math.max(f.total, 1)) * 100, 100) + '%', background: '#dc2626' }} />
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 600, minWidth: 28, textAlign: 'right' }}>{Math.round((f.connected / Math.max(f.total, 1)) * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

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

    
      {selectedStation && (
        <StationDetailModal
          station={selectedStation}
          stats={stations[selectedStation]}
          stationInfo={stationInfoMap[selectedStation]}
          onClose={() => setSelectedStation(null)}
        />
      )}

      {fupDetailWorker && (
        <FollowupDetailModal
          worker={fupDetailWorker}
          label={followupMode === 'daywise' ? followupDay : (FOLLOWUP_TAB_LABELS[followupTab] || followupTab)}
          onClose={() => setFupDetailWorker(null)}
          onChanged={bumpFollowupReload}
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

      {selectedFro && (
        <FroDetailModal
          froId={selectedFro.froId}
          froName={selectedFro.froName}
          filterType={selectedFro.filterType}
          status={selectedFro.status}
          rangeFrom={activeRange.from}
          rangeTo={activeRange.to}
          onClose={() => setSelectedFro(null)}
        />
      )}

      <RecentNotices limit={5} />
    </div>
  );
}
