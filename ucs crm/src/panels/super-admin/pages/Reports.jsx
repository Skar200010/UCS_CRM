import { useState, useEffect } from 'react'
import { api } from '../api/auth'
import { getWorkers } from '../api/endpoints'
import { deptLabel } from '../../../lib/labels'

export default function Reports() {
  const [workers, setWorkers] = useState([])
  const [attendance, setAttendance] = useState([])
  const [month, setMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [err, setErr] = useState('')

  useEffect(() => {
    Promise.all([
      getWorkers(),
      api('/attendance/all').then(r => r || []).catch(() => []),
    ]).then(([w, a]) => {
      setWorkers(w)
      setAttendance(a)
    }).catch(e => setErr(e.message))
  }, [])

  const [year, m] = month.split('-')
  const monthAttendance = attendance.filter(r => (r.date || '').startsWith(`${year}-${m}`))

  const deptStats = {}
  const workerMap = {}
  workers.forEach(w => {
    workerMap[w.id] = w
    const dept = w.department || 'Unknown'
    if (!deptStats[dept]) deptStats[dept] = { total: 0, present: 0, late: 0, absent: 0, leave: 0 }
    deptStats[dept].total++
  })

  monthAttendance.forEach(r => {
    const w = workerMap[r.worker_id]
    const dept = w?.department || 'Unknown'
    if (!deptStats[dept]) return
    if (r.status === 'present') deptStats[dept].present++
    else if (r.status === 'late') deptStats[dept].late++
    else if (r.status === 'absent') deptStats[dept].absent++
    else if (r.status === 'leave') deptStats[dept].leave++
  })

  const deptEntries = Object.entries(deptStats)

  const totalPresent = monthAttendance.filter(r => r.status === 'present').length
  const totalLate = monthAttendance.filter(r => r.status === 'late').length
  const totalAbsent = monthAttendance.filter(r => r.status === 'absent').length
  const totalLeave = monthAttendance.filter(r => r.status === 'leave').length

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <h3>Payroll Reports</h3>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
      </div>
      {err && <div className="sa-err-card">{err}</div>}

      <div className="sa-card-grid">
        <div className="sa-stat-card" style={{borderLeftColor:'#10b981'}}>
          <div className="sa-stat-label">Present</div>
          <div className="sa-stat-value" style={{color:'#10b981'}}>{totalPresent}</div>
        </div>
        <div className="sa-stat-card" style={{borderLeftColor:'#f59e0b'}}>
          <div className="sa-stat-label">Late</div>
          <div className="sa-stat-value" style={{color:'#f59e0b'}}>{totalLate}</div>
        </div>
        <div className="sa-stat-card" style={{borderLeftColor:'#ef4444'}}>
          <div className="sa-stat-label">Absent</div>
          <div className="sa-stat-value" style={{color:'#ef4444'}}>{totalAbsent}</div>
        </div>
        <div className="sa-stat-card" style={{borderLeftColor:'#3b82f6'}}>
          <div className="sa-stat-label">On Leave</div>
          <div className="sa-stat-value" style={{color:'#3b82f6'}}>{totalLeave}</div>
        </div>
      </div>

      <div className="sa-card">
        <h3 className="sa-card-title">Attendance by Department</h3>
        <table className="sa-table">
          <thead><tr><th>Department</th><th>Workers</th><th>Present</th><th>Late</th><th>Absent</th><th>Leave</th></tr></thead>
          <tbody>
            {deptEntries.map(([dept, s]) => (
              <tr key={dept}>
                <td>{deptLabel(dept)}</td>
                <td>{s.total}</td>
                <td style={{color:'#10b981'}}>{s.present}</td>
                <td style={{color:'#f59e0b'}}>{s.late}</td>
                <td style={{color:'#ef4444'}}>{s.absent}</td>
                <td style={{color:'#3b82f6'}}>{s.leave}</td>
              </tr>
            ))}
            {deptEntries.length === 0 && <tr><td colSpan={6} className="sa-muted sa-center">No data</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
