import { useEffect, useState, useCallback, useMemo } from 'react'
import { getHrVerifiedTickets, getAllTickets, getPendingCount, approveTicket, rejectTicketSA } from '../api/endpoints'
import { toast } from '../../../components/Toast'
import { deptLabel } from '../../../lib/labels'

const IST_OFFSET = 5.5 * 60 * 60 * 1000

function fmtTime(iso) {
  if (!iso) return '\u2014'
  const d = new Date(new Date(iso).getTime() + IST_OFFSET)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

const STATUS_MAP = {
  pending: { label: 'Pending', cls: 'pending' },
  hr_verified: { label: 'HR Verified', cls: 'active' },
  approved: { label: 'Approved', cls: 'approved' },
  rejected: { label: 'Rejected', cls: 'rejected' },
}

function ActionModal({ ticket, onClose, onUpdated }) {
  const [remark, setRemark] = useState('')
  const [loading, setLoading] = useState(false)
  const info = STATUS_MAP[ticket.status] || { label: ticket.status, cls: '' }
  const isReviewed = ticket.status === 'approved' || ticket.status === 'rejected'

  return (
    <div className="sa-modal-overlay" onClick={onClose}>
      <div className="sa-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Ticket Review</h3>
          <span className={`sa-badge ${info.cls}`}>{info.label}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 2 }}>Worker</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{ticket.workers?.name || 'Unknown'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ticket.workers?.department ? deptLabel(ticket.workers.department) : '\u2014'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 2 }}>Date & Field</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{ticket.date}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ticket.field === 'punch_in' ? 'Punch In' : 'Punch Out'}</div>
          </div>
        </div>

        <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 10 }}>Time Details</div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1, padding: 10, borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-soft)', marginBottom: 2 }}>Current</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#ef4444' }}>{fmtTime(ticket.field === 'punch_in' ? ticket.punch_in_time : ticket.punch_out_time)}</div>
            </div>
            <div style={{ flex: 1, padding: 10, borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-soft)', marginBottom: 2 }}>Claimed</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981' }}>{fmtTime(ticket.requested_time)}</div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 4 }}>Reason</div>
          <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '10px 12px', fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
            {ticket.reason || '\u2014'}
          </div>
        </div>

        {ticket.hr_remark && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 4 }}>HR Remark</div>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '10px 12px', fontSize: 13, color: '#166534', lineHeight: 1.5 }}>
              {ticket.hr_remark}
            </div>
          </div>
        )}

        {ticket.admin_remark && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 4 }}>SA Remark</div>
            <div style={{ background: '#f0f4ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '10px 12px', fontSize: 13, color: '#1e40af', lineHeight: 1.5 }}>
              {ticket.admin_remark}
            </div>
          </div>
        )}

        {!isReviewed && (
          <>
            <label className="field">
              <span>SA Remark <span className="sa-muted">(optional)</span></span>
              <textarea rows={3} value={remark} onChange={e => setRemark(e.target.value)} placeholder="Any final notes..." />
            </label>

            <div className="sa-modal-actions">
              <button className="btn btn-danger" onClick={async () => {
                setLoading(true)
                try { await rejectTicketSA(ticket.id, remark); onUpdated(); toast('Ticket rejected', 'success') } catch (e) { toast(e.message || 'Failed to reject ticket', 'error') }
                setLoading(false)
              }} disabled={loading}>Reject</button>
              <button className="btn" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={async () => {
                setLoading(true)
                try { await approveTicket(ticket.id, remark); onUpdated(); toast('Ticket approved', 'success') } catch (e) { toast(e.message || 'Failed to approve ticket', 'error') }
                setLoading(false)
              }} disabled={loading}>{loading ? 'Approving...' : 'Approve'}</button>
            </div>
          </>
        )}

        {isReviewed && (
          <div className="sa-modal-actions">
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Tickets() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionTicketId, setActionTicketId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('hr_verified')
  const [search, setSearch] = useState('')
  const [pendingCount, setPendingCount] = useState(0)
  const [selectedTickets, setSelectedTickets] = useState(new Set())
  const [bulkApproving, setBulkApproving] = useState(false)
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)
  const [bulkConfirmLoading, setBulkConfirmLoading] = useState(false)

  const handleOpenBulkConfirm = () => {
    const selected = eligibleTickets.filter(t => selectedTickets.has(t.id))
    if (selected.length === 0) return
    setBulkConfirmOpen(true)
  }

  const handleCloseBulkConfirm = () => {
    setBulkConfirmOpen(false)
    setBulkConfirmLoading(false)
  }

  const handleConfirmBulkApprove = async () => {
    const selected = eligibleTickets.filter(t => selectedTickets.has(t.id))
    if (selected.length === 0) return
    setBulkConfirmLoading(true)

    const timeoutMs = 30000
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout - some tickets may not have been processed')), timeoutMs)
    )

    try {
      const results = await Promise.race([
        Promise.allSettled(
          selected.map(ticket =>
            approveTicket(ticket.id, '').then(() => ({ id: ticket.id, success: true })).catch(err => ({ id: ticket.id, success: false, error: err.message }))
          )
        ),
        timeoutPromise
      ])

      const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.success)
      const failed = results.filter(r => r.status === 'fulfilled' && !r.value.success).map(r => r.value)
      const errors = results.filter(r => r.status === 'rejected')

      if (failed.length > 0 || errors.length > 0) {
        const errorMessages = [
          ...failed.map(f => `Ticket ${f.id}: ${f.error}`),
          ...errors.map(e => e.reason?.message || 'Unknown error')
        ]
        toast(`Failed to approve ${failed.length + errors.length} of ${selected.length} tickets: ${errorMessages.join('; ')}`, 'error')
      }

      if (succeeded.length > 0) {
        setSelectedTickets(new Set())
        setBulkConfirmOpen(false)
        load()
        toast(`${succeeded.length} ticket${succeeded.length !== 1 ? 's' : ''} approved successfully`, 'success')
      }
    } catch (e) {
      toast(e.message || 'Failed to approve tickets', 'error')
    }
    setBulkConfirmLoading(false)
  }

  const loadTickets = useCallback(async (status) => {
    setLoading(true)
    try {
      if (status === 'all') {
        const data = await getAllTickets()
        setTickets(Array.isArray(data) ? data : [])
      } else {
        const data = await getHrVerifiedTickets()
        setTickets(Array.isArray(data) ? data : [])
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  const load = useCallback(() => {
    loadTickets(statusFilter)
    getPendingCount().then(d => setPendingCount(d?.count ?? 0)).catch((err) => { console.error('Error:', err.message); })
  }, [loadTickets, statusFilter])

  useEffect(() => { load() }, [load])

  const filtered = tickets.filter(t => {
    if (search) {
      const q = search.toLowerCase()
      const name = (t.workers?.name || '').toLowerCase()
      if (!name.includes(q)) return false
    }
    return true
  })

  const eligibleTickets = useMemo(() => filtered.filter(t => t.status === 'hr_verified'), [filtered])

  const allSelected = eligibleTickets.length > 0 && eligibleTickets.every(t => selectedTickets.has(t.id))

  const someSelected = eligibleTickets.some(t => selectedTickets.has(t.id))

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedTickets(prev => {
        const next = new Set(prev)
        eligibleTickets.forEach(t => next.delete(t.id))
        return next
      })
    } else {
      setSelectedTickets(prev => {
        const next = new Set(prev)
        eligibleTickets.forEach(t => next.add(t.id))
        return next
      })
    }
  }

  const handleSelectTicket = (id) => {
    setSelectedTickets(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkApprove = () => {
    handleOpenBulkConfirm()
  }

  const handleFilterChange = (status) => {
    setStatusFilter(status)
    loadTickets(status)
  }

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <h3>Attendance Corrections</h3>
          <div className="sa-muted" style={{ fontSize: 12, marginTop: 2 }}>
            {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
            {pendingCount > 0 && (
              <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 10, background: '#fef3c7', color: '#92400e', fontSize: 11, fontWeight: 600 }}>
                {pendingCount} pending
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="sa-filters">
        <select value={statusFilter} onChange={e => handleFilterChange(e.target.value)}>
          <option value="hr_verified">HR Verified</option>
          <option value="all">All Tickets</option>
        </select>
        <input
          placeholder="Search by worker name\u2026"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ minWidth: 200 }}
        />
        <span className="sa-muted" style={{ fontSize: 12, alignSelf: 'center' }}>
          {filtered.length} of {tickets.length}
        </span>
      </div>

      {eligibleTickets.length > 0 && (
        <div className="sa-card" style={{ padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={handleSelectAll}
              style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
            />
            Select All ({eligibleTickets.length})
          </label>
          <button
            className="btn btn-primary"
            onClick={handleBulkApprove}
            disabled={bulkApproving || selectedTickets.size === 0}
            style={{ marginLeft: 'auto' }}
          >
            {bulkApproving ? 'Approving...' : `Bulk Approve (${selectedTickets.size})`}
          </button>
        </div>
      )}

      <div className="sa-card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{padding:16}}>
            {[1,2,3,4,5].map(i => <div key={i} className="sk" style={{width:'100%',height:14,marginBottom:8,borderRadius:4}} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="sa-loading">No tickets found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sa-table" style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th style={{ width: 40 }}>#</th>
                  <th>Date</th>
                  <th>Worker</th>
                  <th>Department</th>
                  <th>Field</th>
                  <th>Current</th>
                  <th>Claimed</th>
                  <th>Status</th>
                  <th>HR Remark</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => {
                  const info = STATUS_MAP[t.status] || { label: t.status, cls: '' }
                  const isEligible = t.status === 'hr_verified'
                  return (
                    <tr key={t.id} style={{ cursor: 'default' }}>
                      <td style={{ textAlign: 'center' }}>
                        {isEligible && (
                          <input
                            type="checkbox"
                            checked={selectedTickets.has(t.id)}
                            onChange={() => handleSelectTicket(t.id)}
                            style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
                          />
                        )}
                      </td>
                      <td className="sa-muted">{i + 1}</td>
                      <td style={{ fontWeight: 500 }}>{t.date}</td>
                      <td><strong>{t.workers?.name || 'Unknown'}</strong></td>
                      <td className="sa-muted">{t.workers?.department ? deptLabel(t.workers.department) : '\u2014'}</td>
                      <td>{t.field === 'punch_in' ? 'Punch In' : 'Punch Out'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {fmtTime(t.field === 'punch_in' ? t.punch_in_time : t.punch_out_time)}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#10b981', fontWeight: 600 }}>
                        {fmtTime(t.requested_time)}
                      </td>
                      <td><span className={`sa-badge ${info.cls}`}>{info.label}</span></td>
                      <td className="sa-muted" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.hr_remark || '\u2014'}
                      </td>
                      <td>
                        <button className="btn btn-sm" onClick={() => setActionTicketId(t.id)}>
                          Review
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {actionTicketId && (() => {
        const ticket = tickets.find(t => t.id === actionTicketId)
        if (!ticket) return null
        return <ActionModal ticket={ticket} onClose={() => setActionTicketId(null)} onUpdated={() => { setActionTicketId(null); load() }} />
      })()}

      {bulkConfirmOpen && (
        <div className="sa-modal-overlay" onClick={handleCloseBulkConfirm}>
          <div className="sa-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              </div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Approve Selected Tickets?</h3>
            </div>

            <p style={{ color: 'var(--text-soft)', fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
              You are about to approve <strong>{eligibleTickets.filter(t => selectedTickets.has(t.id)).length} selected ticket{eligibleTickets.filter(t => selectedTickets.has(t.id)).length !== 1 ? 's' : ''}</strong>. Attendance will be updated.
            </p>

            <div className="sa-modal-actions" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={handleCloseBulkConfirm} disabled={bulkConfirmLoading}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirmBulkApprove} disabled={bulkConfirmLoading}>
                {bulkConfirmLoading ? 'Approving...' : 'Approve Tickets'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
