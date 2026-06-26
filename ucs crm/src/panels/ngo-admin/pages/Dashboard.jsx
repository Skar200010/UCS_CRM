import { useState, useEffect } from 'react';
import { apiGet } from '../api/auth';

const DISPOSITION_ORDER = [
  'donation_collected', 'promise_to_pay', 'lead_done', 'visit_donate', 'payment_pending', 'already_donated',
  'pending', 'contacted', 'follow_up', 'scheduled',
  'not_interested', 'not_interested_now', 'rejected', 'busy', 'ringing',
  'unreachable', 'switched_off', 'wrong_number', 'invalid_number', 'language_barrier',
  'transferred_senior', 'query_complaint', 'receipt_request',
];

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
  donation_collected: '#22c55e',
  promise_to_pay: '#22c55e',
  lead_done: '#22c55e',
  visit_donate: '#22c55e',
  payment_pending: '#22c55e',
  already_donated: '#22c55e',
  pending: '#f59e0b',
  contacted: '#f59e0b',
  follow_up: '#f59e0b',
  scheduled: '#f59e0b',
  transferred_senior: '#3b82f6',
  query_complaint: '#3b82f6',
  receipt_request: '#3b82f6',
};

const getStatusColor = (status) => STATUS_COLORS[status] || '#ef4444';

const DISPOSITION_GROUPS = [
  {
    label: 'Converted',
    color: '#16a34a',
    bg: '#f0fdf4',
    statuses: ['donation_collected', 'promise_to_pay', 'lead_done', 'visit_donate', 'payment_pending', 'already_donated'],
  },
  {
    label: 'In Progress',
    color: '#d97706',
    bg: '#fffbeb',
    statuses: ['pending', 'contacted', 'follow_up', 'scheduled'],
  },
  {
    label: 'Negative',
    color: '#dc2626',
    bg: '#fef2f2',
    statuses: ['not_interested', 'not_interested_now', 'rejected', 'busy', 'ringing', 'unreachable', 'switched_off', 'wrong_number', 'invalid_number', 'language_barrier'],
  },
  {
    label: 'Other',
    color: '#6366f1',
    bg: '#eef2ff',
    statuses: ['transferred_senior', 'query_complaint', 'receipt_request'],
  },
];

const CARDS = [
  { label: 'Total Donors', key: 'total_donors', color: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
  { label: 'Assigned Donors', key: 'assigned_donors', color: '#22c55e', gradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><polyline points="16 3.13 19 6.13 22 3.13" /></svg> },
  { label: 'Active FRO Workers', key: 'active_fros', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg> },
  { label: 'Month Collection', key: 'month_collection', color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', format: (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`, icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M8 12h8" /><path d="M12 8v8" /></svg> },
];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [stationStats, setStationStats] = useState(null);
  const [loading, setLoading] = useState(true);

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
    const idxA = a.lastIndexOf('-');
    const idxB = b.lastIndexOf('-');
    const numA = idxA > 0 ? parseInt(a.slice(idxA + 1)) || 0 : 0;
    const numB = idxB > 0 ? parseInt(b.slice(idxB + 1)) || 0 : 0;
    const preA = idxA > 0 ? a.slice(0, idxA) : a;
    const preB = idxB > 0 ? b.slice(0, idxB) : b;
    if (preA !== preB) return preA.localeCompare(preB);
    return numA - numB;
  });

  const getCell = (station, status) => stations[station]?.[status] || 0;
  const getStationTotal = (station) => {
    let t = 0;
    for (const s of Object.values(stations[station] || {})) t += s;
    return t;
  };

  const maxVal = stationNames.reduce((m, st) => {
    let t = 0;
    for (const s of Object.values(stations[st] || {})) t += s;
    return Math.max(m, t);
  }, 0);

  const grandTotal = stationNames.reduce((t, s) => t + getStationTotal(s), 0);

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        {CARDS.map((card, i) => {
          const val = card.format ? card.format(data[card.key]) : data[card.key];
          return (
            <div key={i} style={{
              position: 'relative',
              background: '#fff',
              borderRadius: 16,
              padding: '24px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              overflow: 'hidden',
              cursor: 'default',
              transition: 'transform .2s ease, box-shadow .2s ease',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}>
              <div style={{
                position: 'absolute',
                top: 0, right: 0,
                width: 100, height: 100,
                borderRadius: '0 16px 0 80px',
                background: card.gradient,
                opacity: 0.08,
              }} />
              <div style={{
                width: 44, height: 44,
                borderRadius: 12,
                background: card.gradient,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff',
                marginBottom: 16,
              }}>
                {card.icon}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#1a1a2e', lineHeight: 1.2 }}>{val}</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4, fontWeight: 500 }}>{card.label}</div>
            </div>
          );
        })}
      </div>

      {stationNames.length > 0 && (
        <div className="card" style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div className="card-head" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line, #e5e7eb)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
              <h3 style={{ margin: 0, fontSize: 15 }}>Station-wise Disposition Matrix</h3>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="count" style={{ background: '#eef2ff', color: '#6366f1', fontWeight: 600, fontSize: 12, padding: '4px 12px', borderRadius: 20 }}>
                {stationNames.length} stations
              </span>
              <span className="count" style={{ background: '#f0fdf4', color: '#16a34a', fontWeight: 600, fontSize: 12, padding: '4px 12px', borderRadius: 20 }}>
                {grandTotal} total
              </span>
            </div>
          </div>
          <div className="card-pad" style={{ overflowX: 'auto', padding: 0 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 700, fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{
                    textAlign: 'left', padding: '12px 16px',
                    borderBottom: '2px solid var(--line, #e5e7eb)',
                    background: '#f8fafc', position: 'sticky', left: 0, zIndex: 2,
                    fontWeight: 700, fontSize: 11, textTransform: 'uppercase',
                    letterSpacing: '0.05em', color: '#64748b', minWidth: 150,
                  }}>
                    Disposition
                  </th>
                  {stationNames.map(s => (
                    <th key={s} style={{
                      textAlign: 'center', padding: '12px 6px',
                      borderBottom: '2px solid var(--line, #e5e7eb)',
                      background: '#f8fafc',
                      fontWeight: 700, fontSize: 10, textTransform: 'uppercase',
                      letterSpacing: '0.04em', color: '#475569', whiteSpace: 'nowrap',
                    }}>
                      {s}
                    </th>
                  ))}
                  <th style={{
                    textAlign: 'center', padding: '12px 16px',
                    borderBottom: '2px solid var(--line, #e5e7eb)',
                    background: '#eef2ff',
                    fontWeight: 800, fontSize: 11, textTransform: 'uppercase',
                    letterSpacing: '0.05em', color: '#4338ca',
                  }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {DISPOSITION_GROUPS.map(group => {
                  const visibleStatuses = group.statuses.filter(status => {
                    const rowTotal = summary[status] || 0;
                    return rowTotal > 0 || stationNames.some(s => getCell(s, status) > 0);
                  });
                  if (visibleStatuses.length === 0) return null;
                  return (
                    <>
                      <tr key={group.label}>
                        <td colSpan={stationNames.length + 2} style={{
                          padding: '8px 16px 4px',
                          fontWeight: 700, fontSize: 11,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: group.color,
                          background: group.bg,
                          borderBottom: 'none',
                        }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: group.color }} />
                            {group.label}
                          </span>
                        </td>
                      </tr>
                      {visibleStatuses.map(status => {
                        const rowTotal = summary[status] || 0;
                        const color = getStatusColor(status);
                        return (
                          <tr key={status} style={{ transition: 'background 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#fafbfc'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = ''; }}>
                            <td style={{
                              padding: '6px 16px',
                              borderBottom: '1px solid var(--line, #f1f5f9)',
                              fontWeight: 500, fontSize: 12,
                              position: 'sticky', left: 0, background: '#fff',
                              whiteSpace: 'nowrap', color,
                            }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                                {DISPOSITION_LABELS[status] || status}
                              </span>
                            </td>
                            {stationNames.map(s => {
                              const val = getCell(s, status);
                              const barW = maxVal > 0 ? (val / maxVal) * 100 : 0;
                              return (
                                <td key={s} style={{
                                  padding: '6px 6px',
                                  borderBottom: '1px solid var(--line, #f1f5f9)',
                                  textAlign: 'center',
                                  fontWeight: val > 0 ? 600 : 400,
                                  color: val > 0 ? '#1a1a2e' : '#e2e8f0',
                                  fontSize: 13,
                                  position: 'relative',
                                }}>
                                  {val > 0 ? (
                                    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                                      <div style={{
                                        position: 'absolute', bottom: 0, left: '10%', right: '10%',
                                        height: 3, borderRadius: 2, background: '#f1f5f9',
                                      }}>
                                        <div style={{
                                          width: `${barW}%`, height: '100%', borderRadius: 2,
                                          background: color, opacity: 0.35,
                                          transition: 'width .3s ease',
                                        }} />
                                      </div>
                                      {val}
                                    </div>
                                  ) : '—'}
                                </td>
                              );
                            })}
                            <td style={{
                              padding: '6px 16px',
                              borderBottom: '1px solid var(--line, #f1f5f9)',
                              textAlign: 'center',
                              fontWeight: 700, fontSize: 13,
                              color,
                            }}>
                              {rowTotal}
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  );
                })}
                <tr style={{ background: '#f8fafc' }}>
                  <td style={{
                    padding: '10px 16px',
                    borderTop: '2px solid var(--line, #e5e7eb)',
                    fontWeight: 800, fontSize: 13,
                    position: 'sticky', left: 0, background: '#f8fafc',
                    color: '#1e293b',
                  }}>
                    Total
                  </td>
                  {stationNames.map(s => (
                    <td key={s} style={{
                      padding: '10px 6px',
                      borderTop: '2px solid var(--line, #e5e7eb)',
                      textAlign: 'center',
                      fontWeight: 800, fontSize: 14,
                      color: '#1e293b',
                    }}>
                      {getStationTotal(s)}
                    </td>
                  ))}
                  <td style={{
                    padding: '10px 16px',
                    borderTop: '2px solid var(--line, #e5e7eb)',
                    textAlign: 'center',
                    fontWeight: 800, fontSize: 15,
                    background: '#eef2ff', color: '#4338ca',
                  }}>
                    {grandTotal}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {DISPOSITION_GROUPS.map(g => (
          <span key={g.label} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11, color: g.color, fontWeight: 600,
            padding: '3px 10px', borderRadius: 12, background: g.bg,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: g.color }} />
            {g.label}
          </span>
        ))}
      </div>
    </div>
  );
}
