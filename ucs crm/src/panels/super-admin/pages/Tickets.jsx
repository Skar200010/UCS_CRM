import { useEffect, useState, useCallback } from 'react'
import { getHrVerifiedTickets, approveTicket, rejectTicketSA } from '../api/endpoints'

const IST_OFFSET = 5.5 * 60 * 60 * 1000

function fmtTime(iso) {
  if (!iso) return '\u2014'
  const d = new Date(new Date(iso).getTime() + IST_OFFSET)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function Badge({ status }) {
  const map = {
    pending: 'pending',
    hr_verified: 'active',
    approved: 'approved',
    rejected: 'rejected',
  }
  const cls = map[status] || ''
  return <span className={`sa-badge ${cls}`}>{status === 'hr_verified' ? 'HR Verified' : status.charAt(0).toUpperCase() + status.slice(1)}</span>
}

function ActionModal({ ticket, onClose, onUpdated }) {
  const [remark, setRemark] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Approve / Reject Ticket</h3>
          <button className="btn btn-sm" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
            <div><strong>Worker:</strong> {ticket.workers?.name || 'Unknown'}</div>
            <div><strong>Date:</strong> {ticket.date}</div>
            <div><strong>Field:</strong> {ticket.field === 'punch_in' ? 'Punch In' : 'Punch Out'}</div>
            <div><strong>Current Time:</strong> {fmtTime(ticket.field === 'punch_in' ? ticket.punch_in_time : ticket.punch_out_time)}</div>
            <div><strong>Claimed Time:</strong> {fmtTime(ticket.requested_time)}</div>
            <div><strong>Reason:</strong> {ticket.reason}</div>
            <div><strong>HR Remark:</strong> {ticket.hr_remark || '\u2014'}</div>
          </div>
          <label className="field">
            <span>SA Remark (optional)</span>
            <textarea rows={3} value={remark} onChange={e => setRemark(e.target.value)} placeholder="Any final notes..." />
          </label>
        </div>
        <div className="modal-foot">
          <button className="btn btn-danger" onClick={async () => {
            if (!confirm('Reject this ticket? The attendance will NOT be updated.')) return
            setLoading(true)
            try { await rejectTicketSA(ticket.id, remark); onUpdated() } catch (e) { alert(e.message) }
            setLoading(false)
          }} disabled={loading}>Reject</button>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={async () => {
            setLoading(true)
            try { await approveTicket(ticket.id, remark); onUpdated() } catch (e) { alert(e.message) }
            setLoading(false)
          }} disabled={loading}>{loading ? 'Approving...' : 'Approve'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Tickets() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionTicketId, setActionTicketId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getHrVerifiedTickets()
      setTickets(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="page-header">
        <h3>HR-Verified Tickets</h3>
        <p>Review and approve attendance correction tickets verified by HR.</p>
      </div>

      <div className="card" style={{ padding: '20px 22px' }}>
        {loading ? <div className="loading"><div className="spinner" /></div> : tickets.length === 0 ? (
          <div className="empty-state"><p>No HR-verified tickets awaiting approval.</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>Date</th><th>Worker</th><th>Department</th><th>Field</th><th>Current</th><th>Claimed</th><th>Reason</th><th>HR Remark</th><th>Action</th></tr>
              </thead>
              <tbody>
                {tickets.map((t, i) => (
                  <tr key={t.id}>
                    <td>{i + 1}</td>
                    <td>{t.date}</td>
                    <td><strong>{t.workers?.name || 'Unknown'}</strong></td>
                    <td>{t.workers?.department || '\u2014'}</td>
                    <td>{t.field === 'punch_in' ? 'Punch In' : 'Punch Out'}</td>
                    <td>{fmtTime(t.field === 'punch_in' ? t.punch_in_time : t.punch_out_time)}</td>
                    <td>{fmtTime(t.requested_time)}</td>
                    <td style={{maxWidth:150, overflow:'hidden', textOverflow:'ellipsis'}}>{t.reason}</td>
                    <td>{t.hr_remark || '\u2014'}</td>
                    <td>
                      <button className="btn btn-sm" onClick={() => setActionTicketId(t.id)}>Review</button>
                    </td>
                  </tr>
                ))}
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
    </div>
  )
}
