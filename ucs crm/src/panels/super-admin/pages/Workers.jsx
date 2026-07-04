import { useState, useEffect } from 'react'
import { api } from '../api/auth'

export default function Workers({ onViewWorker }) {
  const [workers, setWorkers] = useState([])
  const [ngos, setNgos] = useState([])
  const [filterNgo, setFilterNgo] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [search, setSearch] = useState('')
  const [err, setErr] = useState('')

  const load = () => {
    api('/workers').then(setWorkers).catch(e => setErr(e.message))
    api('/ngos').then(setNgos).catch(() => {})
  }
  useEffect(load, [])

  const remove = async (id) => {
    if (!confirm('Delete this worker?')) return
    try { await api(`/workers/${id}`, { method: 'DELETE' }); load() }
    catch (e) { setErr(e.message) }
  }

  const depts = [...new Set(workers.map(w => w.department).filter(Boolean))]

  const filtered = workers.filter(w => {
    if (filterNgo && String(w.ngo_id) !== filterNgo) return false
    if (filterDept && w.department !== filterDept) return false
    if (search) {
      const s = search.toLowerCase()
      if (!(w.name || '').toLowerCase().includes(s) && !(w.login_id || '').toLowerCase().includes(s)) return false
    }
    return true
  })

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <h3>Workers</h3>
        <span className="sa-muted">{workers.length} total</span>
      </div>
      {err && <div className="sa-err-card">{err}</div>}

      <div className="sa-filters">
        <input placeholder="Search name / login_id…" value={search} onChange={e => setSearch(e.target.value)} />
        <select value={filterNgo} onChange={e => setFilterNgo(e.target.value)}>
          <option value="">All NGOs</option>
          {ngos.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
        </select>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}>
          <option value="">All Departments</option>
          {depts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="sa-card" style={{overflowX:'auto'}}>
        <table className="sa-table">
          <thead><tr><th>Name</th><th>Login ID</th><th>Department</th><th>NGO</th><th>Salary</th><th>Status</th><th style={{width:120}}></th></tr></thead>
          <tbody>
            {filtered.map(w => {
              const ngo = ngos.find(n => n.id === w.ngo_id)
              return (
                <tr key={w.id}>
                  <td><a className="sa-link" onClick={() => onViewWorker(w.id)}>{w.name}</a></td>
                  <td><code>{w.login_id}</code></td>
                  <td>{w.department || '—'}</td>
                  <td className="sa-muted">{ngo?.name || '—'}</td>
                  <td>{w.salary ? `₹${Number(w.salary).toLocaleString()}` : '—'}</td>
                  <td><span className={`sa-badge ${w.is_active !== false ? 'active' : 'inactive'}`}>
                    {w.is_active !== false ? 'Active' : 'Inactive'}
                  </span></td>
                  <td>
                    <button className="btn btn-sm" onClick={() => onViewWorker(w.id)}>View</button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(w.id)} style={{marginLeft:4}}>Del</button>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && <tr><td colSpan={7} className="sa-muted sa-center">No workers found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
