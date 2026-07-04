import { useState, useEffect } from 'react'
import { api } from '../api/auth'

export default function Leaves() {
  const [leaves, setLeaves] = useState([])
  const [workers, setWorkers] = useState([])
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState('')

  const load = () => {
    api('/leaves').then(setLeaves).catch(e => setErr(e.message))
    api('/workers').then(setWorkers).catch(() => {})
  }
  useEffect(load, [])

  const decide = async (id, status) => {
    try {
      await api(`/leaves/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) })
      load()
    } catch (e) { setErr(e.message) }
  }

  const workerMap = {}
  workers.forEach(w => { workerMap[w.id] = w })

  const filtered = filter ? leaves.filter(l => l.status === filter) : leaves

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <h3>Leave Requests</h3>
        <span className="sa-muted">{leaves.length} total</span>
      </div>
      {err && <div className="sa-err-card">{err}</div>}

      <div className="sa-filters">
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">All status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="sa-card" style={{overflowX:'auto'}}>
        <table className="sa-table">
          <thead><tr><th>Worker</th><th>Type</th><th>From</th><th>To</th><th>Reason</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {filtered.map(l => {
              const w = workerMap[l.worker_id]
              return (
                <tr key={l.id}>
                  <td>{w?.name || `ID ${l.worker_id}`}</td>
                  <td>{l.type || 'Full day'}</td>
                  <td>{l.start_date ? new Date(l.start_date).toLocaleDateString() : '—'}</td>
                  <td>{l.end_date ? new Date(l.end_date).toLocaleDateString() : '—'}</td>
                  <td className="sa-muted" style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {l.reason || '—'}
                  </td>
                  <td><span className={`sa-badge ${l.status}`}>{l.status}</span></td>
                  <td>
                    {l.status === 'pending' && (
                      <>
                        <button className="btn btn-sm" style={{background:'#10b981',color:'#fff'}} onClick={() => decide(l.id, 'approved')}>Approve</button>
                        <button className="btn btn-sm btn-danger" onClick={() => decide(l.id, 'rejected')} style={{marginLeft:4}}>Reject</button>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && <tr><td colSpan={7} className="sa-muted sa-center">No leaves found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
