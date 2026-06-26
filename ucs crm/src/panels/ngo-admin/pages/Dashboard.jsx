import { useState, useEffect } from 'react';
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

const STATUS_COLORS = {
  donation_collected: '#16a34a', promise_to_pay: '#16a34a', lead_done: '#16a34a',
  visit_donate: '#16a34a', payment_pending: '#16a34a', already_donated: '#16a34a',
  pending: '#d97706', contacted: '#d97706', follow_up: '#d97706', scheduled: '#d97706',
  transferred_senior: '#2563eb', query_complaint: '#2563eb', receipt_request: '#2563eb',
};

const getStatusColor = (status) => STATUS_COLORS[status] || '#dc2626';

const DISPOSITION_GROUPS = [
  { label: 'Converted', color: '#16a34a', bg: '#f0fdf4', statuses: ['donation_collected', 'promise_to_pay', 'lead_done', 'visit_donate', 'payment_pending', 'already_donated'] },
  { label: 'In Progress', color: '#d97706', bg: '#fffbeb', statuses: ['pending', 'contacted', 'follow_up', 'scheduled'] },
  { label: 'Negative', color: '#dc2626', bg: '#fef2f2', statuses: ['not_interested', 'not_interested_now', 'rejected', 'busy', 'ringing', 'unreachable', 'switched_off', 'wrong_number', 'invalid_number', 'language_barrier'] },
  { label: 'Other', color: '#5B6B4E', bg: '#f0f2ee', statuses: ['transferred_senior', 'query_complaint', 'receipt_request'] },
];

const STAT_CARDS = [
  { label: 'Total Donors', key: 'total_donors', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { label: 'Assigned Donors', key: 'assigned_donors', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 3.13 19 6.13 22 3.13"/></svg> },
  { label: 'Active FRO Workers', key: 'active_fros', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  { label: 'Month Collection', key: 'month_collection', format: (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg> },
];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [stationStats, setStationStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedStation, setExpandedStation] = useState(null);

  useEffect(() => {
    Promise.all([
      apiGet('/ngo-admin/dashboard'),
      apiGet('/ngo-admin/dashboard/station-stats'),
    ])
      .then(([d, s]) => { setData(d); setStationStats(s); })
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

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 14, marginBottom: 20,
      }}>
        {STAT_CARDS.map((card, i) => {
          const val = card.format ? card.format(data[card.key]) : data[card.key];
          return (
            <div key={i} className="card" style={{ marginBottom: 0, padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--sage)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0,
                }}>
                  {card.icon}
                </div>
                <span style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 500 }}>{card.label}</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.15 }}>{val}</div>
            </div>
          );
        })}
      </div>

      {stationNames.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
              <h3>Station Overview</h3>
            </div>
            <span className="count" style={{ background: '#5B6B4E12', color: 'var(--sage)', fontSize: 12, padding: '4px 12px', borderRadius: 20, fontWeight: 600 }}>
              {stationNames.length} stations · {grandTotal} donors
            </span>
          </div>
          <div className="card-pad">
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 10,
            }}>
              {stationNames.map(st => {
                const total = getStationTotal(st);
                const groupCounts = DISPOSITION_GROUPS.map(g => ({
                  ...g, count: g.statuses.reduce((t, s) => t + getCell(st, s), 0),
                }));
                return (
                  <div key={st} style={{
                    background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '12px 14px',
                    border: '1px solid var(--line)', cursor: 'pointer',
                    transition: 'box-shadow .15s, border-color .15s',
                  }}
                    onClick={() => setExpandedStation(expandedStation === st ? null : st)}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--sage)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{st}</span>
                      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--sage)' }}>{total}</span>
                    </div>

                    <div style={{ height: 5, borderRadius: 3, background: '#e5e7eb', display: 'flex', overflow: 'hidden', marginBottom: 8 }}>
                      {groupCounts.map((g, i) => g.count > 0 && (
                        <div key={g.label} style={{
                          width: `${(g.count / total) * 100}%`, height: '100%',
                          background: g.color, opacity: 0.55,
                          borderRight: i < groupCounts.length - 1 ? '1px solid #fff' : 'none',
                        }} />
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {groupCounts.filter(g => g.count > 0).map(g => (
                        <span key={g.label} style={{
                          fontSize: 10, color: g.color, fontWeight: 600,
                          background: g.bg, padding: '1px 7px', borderRadius: 8,
                        }}>
                          {g.label}: {g.count}
                        </span>
                      ))}
                    </div>

                    {expandedStation === st && (
                      <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                        {DISPOSITION_GROUPS.map(g => {
                          const items = g.statuses.filter(s => getCell(st, s) > 0);
                          if (items.length === 0) return null;
                          return (
                            <div key={g.label} style={{ marginBottom: 4 }}>
                              <div style={{ fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', color: g.color, marginBottom: 2 }}>{g.label}</div>
                              {items.map(s => (
                                <div key={s} style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0', fontSize: 12 }}>
                                  <span style={{ color: 'var(--ink-soft)' }}>{DISPOSITION_LABELS[s] || s}</span>
                                  <span style={{ fontWeight: 600, color: getStatusColor(s) }}>{getCell(st, s)}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 14,
      }}>
        {DISPOSITION_GROUPS.map(group => {
          const items = group.statuses
            .map(s => ({ status: s, total: summary[s] || 0 }))
            .filter(x => x.total > 0);
          if (items.length === 0) return null;
          const groupTotal = items.reduce((t, x) => t + x.total, 0);
          return (
            <div key={group.label} className="card" style={{ marginBottom: 0 }}>
              <div className="card-head" style={{ padding: '12px 16px', borderBottom: `2px solid ${group.color}18` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: group.color, flexShrink: 0 }} />
                  <h3 style={{ margin: 0, fontSize: 13, color: group.color }}>{group.label}</h3>
                </div>
                <span style={{ fontWeight: 700, fontSize: 15, color: group.color }}>{groupTotal}</span>
              </div>
              <div className="card-pad" style={{ padding: '8px 16px 12px' }}>
                {items.map(({ status, total }) => {
                  const pct = groupTotal > 0 ? (total / groupTotal) * 100 : 0;
                  return (
                    <div key={status} style={{ marginBottom: 5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                        <span style={{ color: 'var(--ink-soft)' }}>{DISPOSITION_LABELS[status] || status}</span>
                        <span style={{ fontWeight: 600, color: getStatusColor(status) }}>{total}</span>
                      </div>
                      <div style={{ height: 3, borderRadius: 2, background: '#e5e7eb', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: group.color, opacity: 0.5 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
