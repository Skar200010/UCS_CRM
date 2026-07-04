import { useState, useEffect } from 'react'
import { api } from '../api/auth'

const PAGE_SIZES = [10, 20, 50, 100]

export default function Workers({ onViewWorker }) {
  const [workers, setWorkers] = useState([])
  const [ngos, setNgos] = useState([])
  const [filterNgo, setFilterNgo] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
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

  const HIDE_DEPTS = ['hr-recruitment', 'hr recruitment', 'hr_recruitment', 'hrrecruitment']
  const depts = [...new Set(workers.map(w => w.department).filter(Boolean))]
    .filter(d => !HIDE_DEPTS.includes(d.toLowerCase().trim()))

  const filtered = workers.filter(w => {
    if (filterNgo && String(w.ngo_id) !== filterNgo) return false
    if (filterDept && w.department !== filterDept) return false
    if (search) {
      const s = search.toLowerCase()
      if (!(w.name || '').toLowerCase().includes(s) && !(w.login_id || '').toLowerCase().includes(s)) return false
    }
    return true
  })

  useEffect(() => { setPage(1) }, [filterNgo, filterDept, search, pageSize])

  const totalPages = Math.ceil(filtered.length / pageSize) || 1
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <h3>Workers</h3>
        <span className="sa-muted">{workers.length} total</span>
      </div>
      {err && <div className="sa-err-card">{err}</div>}

      <div className="sa-filters">
        <input placeholder="Search name / login_id…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        <select value={filterNgo} onChange={e => { setFilterNgo(e.target.value); setPage(1) }}>
          <option value="">All NGOs</option>
          {ngos.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
        </select>
        <select value={filterDept} onChange={e => { setFilterDept(e.target.value); setPage(1) }}>
          <option value="">All Departments</option>
          {depts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="sa-card" style={{overflowX:'auto'}}>
        <table className="sa-table">
          <thead><tr><th>Name</th><th>Login ID</th><th>Department</th><th>NGO</th><th>Salary</th><th>Status</th><th style={{width:120}}></th></tr></thead>
          <tbody>
            {paginated.map(w => {
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

      {filtered.length > pageSize && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              className="btn btn-sm"
              style={p === page ? { background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' } : {}}
              onClick={() => setPage(p)}
            >{p}</button>
          ))}
          <button className="btn btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          <select
            value={pageSize}
            onChange={e => setPageSize(Number(e.target.value))}
            style={{ marginLeft: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #dde3ea', fontSize: 12, fontFamily: 'inherit' }}
          >
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s} / page</option>)}
          </select>
        </div>
      )}
    </div>
  )
}
