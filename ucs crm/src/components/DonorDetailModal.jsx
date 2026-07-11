import { useState, useEffect } from 'react'
import { api } from '../api/auth'
import { User, UserCircle, IdentificationCard, X, CheckCircle, CalendarCheck, CreditCard, CurrencyCircleDollar, Star, ArrowDown, Circle } from '@phosphor-icons/react'

const I = {
  User: <User size={16} />,
  UserCircle: <UserCircle size={16} />,
  IdentificationCard: <IdentificationCard size={16} />,
  X: <X size={14} />,
  CheckCircle: <CheckCircle size={16} weight="fill" />,
  CalendarCheck: <CalendarCheck size={16} />,
  CreditCard: <CreditCard size={16} />,
  CurrencyCircleDollar: <CurrencyCircleDollar size={16} />,
  Star: <Star size={16} weight="fill" />,
  ArrowDown: <ArrowDown size={16} />,
  CircleGreen: <Circle size={12} weight="fill" color="#16a34a" />,
  CircleYellow: <Circle size={12} weight="fill" color="#d97706" />,
  CircleBlue: <Circle size={12} weight="fill" color="#2563eb" />,
}

export default function DonorDetailModal({ donorId, onClose }) {
  const [data, setData] = useState(null)
  const [receipts, setReceipts] = useState([])
  const [followups, setFollowups] = useState([])
  const [transactions, setTransactions] = useState([])
  const [txPage, setTxPage] = useState(1)
  const [txTotalPages, setTxTotalPages] = useState(1)
  const [txTotal, setTxTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api(`/ngo-admin/donor-crm/donors/${donorId}`, { _prefix: 'ucs' }).catch(() => null),
      api(`/ngo-admin/donor-crm/donors/${donorId}/receipts`, { _prefix: 'ucs' }).catch(() => []),
      api(`/ngo-admin/donor-crm/donors/${donorId}/followups`, { _prefix: 'ucs' }).catch(() => []),
      api(`/ngo-admin/donor-crm/donors/${donorId}/transactions?page=${txPage}&page_size=20`, { _prefix: 'ucs' }).catch(() => ({ data: [], pagination: {} })),
    ]).then(([d, r, f, t]) => {
      setData(d); setReceipts(r || []); setFollowups(f || [])
      setTransactions(t.data || []); setTxTotal(t.pagination?.total || 0); setTxTotalPages(t.pagination?.totalPages || 1)
    }).finally(() => setLoading(false))
  }, [donorId, txPage])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  if (loading) return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '85vh' }}>
        <div className="modal-body"><p style={{ textAlign: 'center', padding: 40, color: 'var(--ink-soft)' }}>Loading...</p></div>
      </div>
    </div>
  )

  const p = data?.profile || {}
  const donations = data?.donations || []
  const totalAmt = donations.reduce((s, d) => s + Number(d.amount_collected || 0), 0)
  const lastDonation = donations[0]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '85vh' }}>
        <div className="modal-head">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{I.User} Donor Detail</h3>
          <span style={{ fontSize: 11, color: 'var(--ink-soft)', background: 'var(--bg)', padding: '2px 10px', borderRadius: 99, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>{I.IdentificationCard} D-{p.id}</span>
          <button className="modal-close" onClick={onClose}>{I.X}</button>
        </div>
        <div className="modal-body">
          {!p.id ? (
            <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>Donor not found</p>
          ) : (
            <>
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>{I.UserCircle} Personal Info</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', fontSize: 13 }}>
                  <div><span style={{ color: 'var(--ink-soft)' }}>ID:</span> <strong>D-{p.id}</strong></div>
                  <div><span style={{ color: 'var(--ink-soft)' }}>Name:</span> <strong>{p.name}</strong></div>
                  <div><span style={{ color: 'var(--ink-soft)' }}>Mobile:</span> <strong>{p.mobile_number}</strong></div>
                  <div><span style={{ color: 'var(--ink-soft)' }}>Email:</span> <strong>{p.email || '\u2014'}</strong></div>
                  {p.address_1 && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--ink-soft)' }}>Address:</span> <strong>{p.address_1}{p.address_2 ? `, ${p.address_2}` : ''}</strong></div>}
                  <div><span style={{ color: 'var(--ink-soft)' }}>City:</span> <strong>{p.city || '\u2014'}</strong></div>
                  <div><span style={{ color: 'var(--ink-soft)' }}>State:</span> <strong>{p.state || '\u2014'}</strong></div>
                  <div><span style={{ color: 'var(--ink-soft)' }}>PAN:</span> <strong>{p.pan_number || '\u2014'}</strong></div>
                  <div><span style={{ color: 'var(--ink-soft)' }}>Aadhaar:</span> <strong>{p.aadhaar_number || '\u2014'}</strong></div>
                  <div><span style={{ color: 'var(--ink-soft)' }}>Birthday:</span> <strong>{p.birth_date || '\u2014'}</strong></div>
                  <div><span style={{ color: 'var(--ink-soft)' }}>Anniversary:</span> <strong>{p.anniversary || '\u2014'}</strong></div>
                  <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--ink-soft)' }}>Language:</span> <strong>{p.preferred_language || '\u2014'}</strong></div>
                </div>
              </div>

              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>{I.CurrencyCircleDollar} Donation Summary</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div className="stat-card"><div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{I.Star} Total</div><div className="stat-value" style={{ color: 'var(--sage)' }}>₹{Number(p.total_amount || totalAmt).toLocaleString('en-IN')}</div></div>
                  <div className="stat-card"><div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{I.CalendarCheck} Last</div><div className="stat-value" style={{ fontSize: 13 }}>{lastDonation ? `₹${Number(lastDonation.amount_collected || 0).toLocaleString('en-IN')}` : '\u2014'}</div></div>
                  <div className="stat-card"><div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{I.CreditCard} Mode</div><div className="stat-value" style={{ fontSize: 13 }}>{p.mop || '\u2014'}</div></div>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>{I.ArrowDown} All Transactions ({txTotal})</h4>
                {transactions.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--ink-soft)' }}>No transactions found</p>
                ) : (
                  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    <table style={{ width: '100%', fontSize: 12 }}>
                      <thead><tr style={{ background: 'var(--bg)' }}>
                        <th style={{ padding: '4px 6px', textAlign: 'left' }}>Date</th>
                        <th style={{ padding: '4px 6px', textAlign: 'left' }}>Type</th>
                        <th style={{ padding: '4px 6px', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '4px 6px', textAlign: 'left' }}>Mode</th>
                        <th style={{ padding: '4px 6px', textAlign: 'center' }}>Status</th>
                      </tr></thead>
                      <tbody>
                        {transactions.map((t, i) => {
                          const statusIcon = t.status === 'verified' ? I.CheckCircle : t.status === 'pending' ? I.CircleYellow : I.CircleBlue
                          const statusLabel = t.status === 'verified' ? 'Done' : t.status === 'pending' ? 'Pending' : 'Imported'
                          return (
                            <tr key={`${t.source}-${t.ref}-${i}`}>
                              <td style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>{t.date?.slice(0, 10)}</td>
                              <td style={{ padding: '4px 6px' }}>
                                <span className={`pill ${t.type === 'Donation' ? 'pill-green' : t.type === 'Receipt' ? 'pill-blue' : 'pill-purple'}`}>
                                  {t.type === 'Donation' ? '💰' : t.type === 'Receipt' ? '📄' : '📥'} {t.type}
                                </span>
                              </td>
                              <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>₹{Number(t.amount).toLocaleString('en-IN')}</td>
                              <td style={{ padding: '4px 6px', color: 'var(--ink-soft)' }}>{t.mode || '\u2014'}</td>
                              <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: t.status === 'verified' ? '#16a34a' : t.status === 'pending' ? '#d97706' : '#2563eb' }}>
                                  {statusIcon} {statusLabel}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {txTotalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10 }}>
                    <button className="btn btn-sm" disabled={txPage <= 1} onClick={() => setTxPage(p => p - 1)}>‹ Prev</button>
                    <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600 }}>{txPage} / {txTotalPages}</span>
                    <button className="btn btn-sm" disabled={txPage >= txTotalPages} onClick={() => setTxPage(p => p + 1)}>Next ›</button>
                  </div>
                )}
              </div>

              <div>
                <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>{I.CalendarCheck} Follow-up History ({followups.length})</h4>
                {followups.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--ink-soft)' }}>No follow-ups recorded</p>
                ) : (
                  <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                    <table style={{ width: '100%', fontSize: 12 }}>
                      <thead><tr style={{ background: 'var(--bg)' }}>
                        <th style={{ padding: '4px 6px', textAlign: 'left' }}>Date</th>
                        <th style={{ padding: '4px 6px', textAlign: 'left' }}>Notes</th>
                        <th style={{ padding: '4px 6px', textAlign: 'center' }}>Status</th>
                      </tr></thead>
                      <tbody>
                        {followups.map(f => (
                          <tr key={f.id}>
                            <td style={{ padding: '4px 6px' }}>{f.scheduled_at?.slice(0, 10)}</td>
                            <td style={{ padding: '4px 6px', color: 'var(--ink-soft)' }}>{f.notes || '\u2014'}</td>
                            <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                              <span className={`pill ${f.is_completed ? 'pill-green' : 'pill-yellow'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                {f.is_completed ? <>{I.CheckCircle} Done</> : <>{I.CircleYellow} Pending</>}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
