import { useState, useEffect } from 'react'
import { fetchEvents, fetchApprovals, submitApproval, approveEvent, rejectEvent } from '../store'

const statusPill = (s) => {
  const map = { Draft:'gray', Submitted:'yellow', Approved:'green', Rejected:'red', Completed:'blue', Closed:'green' }
  return map[s] || 'gray'
}

export default function ApprovalWorkflow() {
  const [events, setEvents] = useState([])
  const [approvals, setApprovals] = useState([])
  const [remark, setRemark] = useState('')
  const [actionId, setActionId] = useState(null)

  useEffect(() => {
    Promise.all([fetchEvents().catch(() => []), fetchApprovals().catch(() => [])])
      .then(([e,a]) => { setEvents(e); setApprovals(a) })
  }, [])

  const handleSubmit = async (id) => {
    await submitApproval(id).then(() => setEvents(events.map(e => e.id === id ? {...e, status:'Submitted'} : e))).catch(e => console.error('ApprovalWorkflow submitApproval:', e))
  }

  const handleApprove = async (id) => {
    await approveEvent(id).then(() => setEvents(events.map(e => e.id === id ? {...e, status:'Approved'} : e))).catch(e => console.error('ApprovalWorkflow approveEvent:', e))
    setActionId(null); setRemark('')
  }

  const handleReject = async (id) => {
    await rejectEvent(id, remark).then(() => setEvents(events.map(e => e.id === id ? {...e, status:'Rejected'} : e))).catch(e => console.error('ApprovalWorkflow rejectEvent:', e))
    setActionId(null); setRemark('')
  }

  const pending = events.filter(e => e.status === 'Draft' || e.status === 'Submitted')
  const history = events.filter(e => !['Draft','Submitted'].includes(e.status))

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 16 }}>Approval Workflow</h3>
      </div>

      <div className="stats-grid" style={{ marginBottom: 16, gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card"><div className="stat-num" style={{ color: '#C08A2E' }}>{pending.length}</div><div className="stat-lbl">Pending</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#16a34a' }}>{history.filter(e => e.status === 'Approved').length}</div><div className="stat-lbl">Approved</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#dc2626' }}>{history.filter(e => e.status === 'Rejected').length}</div><div className="stat-lbl">Rejected</div></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h3>Pending Approvals</h3></div>
        <div className="card-pad" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Event</th><th>Date</th><th>Category</th><th>Status</th><th>Budget</th><th></th></tr></thead>
            <tbody>
              {pending.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--ink-soft)' }}>No pending approvals</td></tr>}
              {pending.map(ev => (
                <tr key={ev.id}>
                  <td style={{ fontWeight: 500 }}>{ev.name}</td>
                  <td>{ev.date?.slice(0,10)}</td>
                  <td>{ev.category}</td>
                  <td><span className={`pill pill-${statusPill(ev.status)}`}>{ev.status}</span></td>
                  <td style={{ fontWeight: 600 }}>{ev.budget ? '₹' + Number(ev.budget).toLocaleString() : '—'}</td>
                  <td>
                    {ev.status === 'Draft' && <button className="btn btn-sm btn-primary" onClick={() => handleSubmit(ev.id)}>Submit</button>}
                    {ev.status === 'Submitted' && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm" style={{ background: '#16a34a', color: '#fff', borderColor: '#16a34a' }} onClick={() => handleApprove(ev.id)} title="Approve">✓</button>
                        <button className="btn btn-sm" style={{ background: '#dc2626', color: '#fff', borderColor: '#dc2626' }} onClick={() => setActionId(actionId === ev.id ? null : ev.id)} title="Reject">✕</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {actionId && (
        <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid #dc2626' }}>
          <div className="card-head"><h3>Rejection Reason</h3></div>
          <div className="card-pad">
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 8 }}>Provide a reason for rejecting this event:</p>
            <div className="field"><textarea value={remark} onChange={e => setRemark(e.target.value)} placeholder="Enter reason for rejection..." rows={3} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} /></div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button className="btn btn-sm" style={{ background: '#dc2626', color: '#fff', borderColor: '#dc2626' }} onClick={() => handleReject(actionId)}>Confirm Reject</button>
              <button className="btn btn-sm" onClick={() => { setActionId(null); setRemark('') }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head"><h3>Approval History</h3></div>
        <div className="card-pad" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Event</th><th>Date</th><th>Status</th><th>Priority</th></tr></thead>
            <tbody>
              {history.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--ink-soft)' }}>No history</td></tr>}
              {history.map(ev => (
                <tr key={ev.id}>
                  <td style={{ fontWeight: 500 }}>{ev.name}</td>
                  <td>{ev.date?.slice(0,10)}</td>
                  <td><span className={`pill pill-${statusPill(ev.status)}`}>{ev.status}</span></td>
                  <td><span className={`pill pill-${ev.priority === 'High' || ev.priority === 'Urgent' ? 'red' : ev.priority === 'Medium' ? 'yellow' : 'gray'}`}>{ev.priority}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
