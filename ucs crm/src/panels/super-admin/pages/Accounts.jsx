import { useState, useEffect } from 'react'
import { api } from '../api/auth'
import { deptLabel } from '../../../lib/labels'

export default function Accounts() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let mounted = true;
    api('/dashboard/accounts').then(data => { if (mounted) setData(data); }).catch(e => {
      api('/dashboard/super-admin').then(data => { if (mounted) setData(data); }).catch(e2 => { if (mounted) setErr(e2.message); })
    })
    return () => { mounted = false; };
  }, [])

  if (err) return <div className="sa-err-card">Error: {err}</div>
  if (!data) return (
    <div className="sa-page">
      <div className="sa-page-header" style={{marginBottom:16}}>
        <div className="sk" style={{width:160,height:18}} />
        <div className="sk" style={{width:100,height:32,borderRadius:6}} />
      </div>
      <div className="sa-stat-grid" style={{gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))'}}>
        {[1,2,3,4].map(i => <div key={i} className="sa-stat-card"><div className="sk" style={{height:90}} /></div>)}
      </div>
    </div>
  )

  const { stats = {}, deptWorkers = {}, attendanceCount = 0 } = data

  const cards = [
    { label: 'Total Workers', value: stats.totalWorkers || 0, color: '#3b82f6' },
    { label: 'Attendance Records', value: attendanceCount || 0, color: '#10b981' },
    { label: 'Departments', value: Object.keys(deptWorkers || {}).length, color: '#f59e0b' },
    { label: 'Avg Daily Present', value: attendanceCount > 22 ? Math.round(attendanceCount / 22) : '—', color: '#8b5cf6' },
  ]

  const deptEntries = Object.entries(deptWorkers || {}).sort((a, b) => b[1] - a[1])
  const maxDept = deptEntries.length > 0 ? Math.max(...deptEntries.map(e => e[1])) : 1

  return (
    <div className="sa-page">
      <h3>Finance Overview</h3>

      <div className="sa-card-grid">
        {cards.map(c => (
          <div key={c.label} className="sa-stat-card" style={{ borderLeftColor: c.color }}>
            <div className="sa-stat-label">{c.label}</div>
            <div className="sa-stat-value" style={{ color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="sa-card">
        <h3 className="sa-card-title">Workers by Department</h3>
        {deptEntries.length === 0 ? (
          <p className="sa-muted">No data</p>
        ) : (
          <div className="sa-bar-chart">
            {deptEntries.map(([dept, count]) => (
              <div key={dept} className="sa-bar-row">
                <div className="sa-bar-label">{deptLabel(dept)}</div>
                <div className="sa-bar-track">
                  <div className="sa-bar-fill" style={{ width: `${(count / maxDept) * 100}%`, background: '#10b981' }} />
                </div>
                <div className="sa-bar-count">{count}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
