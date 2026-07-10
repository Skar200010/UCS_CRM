import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { fetchAttendance, fetchWorkers } from './api'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
)

const IST_OFFSET = 5.5 * 60 * 60 * 1000

function fmtTime(iso) {
  if (!iso) return <span className="dim">&mdash;</span>
  const d = new Date(new Date(iso).getTime() + IST_OFFSET)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return <span>{hh}:{mm}</span>
}

function fmtDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}-${m}-${y}`
}

function getIstDateStr(date) {
  const ist = new Date(date.getTime() + IST_OFFSET)
  const y = ist.getUTCFullYear()
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0')
  const d = String(ist.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function extractTime(iso) {
  if (!iso) return ''
  const d = new Date(new Date(iso).getTime() + IST_OFFSET)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function reconstructIso(originalIso, newTime, fallbackDate) {
  if (!newTime) return null
  const [h, m] = newTime.split(':').map(Number)
  let base
  if (originalIso) {
    base = new Date(new Date(originalIso).getTime() + IST_OFFSET)
  } else if (fallbackDate) {
    base = new Date(new Date(fallbackDate + 'T00:00:00.000Z').getTime() + IST_OFFSET)
  } else {
    return null
  }
  base.setUTCHours(h, m, 0, 0)
  return new Date(base.getTime() - IST_OFFSET).toISOString()
}

function istTimeToIso(dateStr, timeStr) {
  if (!timeStr || !dateStr) return null
  const [h, m] = timeStr.split(':').map(Number)
  const base = new Date(new Date(dateStr + 'T00:00:00.000Z').getTime() + IST_OFFSET)
  base.setUTCHours(h, m, 0, 0)
  return new Date(base.getTime() - IST_OFFSET).toISOString()
}

function Badge({ status }) {
  const map = {
    present: { cls: 'badge-present', lbl: 'Present' },
    late: { cls: 'badge-late', lbl: 'Late' },
    absent: { cls: 'badge-absent', lbl: 'Absent' },
    leave: { cls: 'badge-leave', lbl: 'Leave' },
  }
  const { cls, lbl } = map[status] || { cls: '', lbl: status || '\u2014' }
  return <span className={`badge ${cls}`}>{lbl}</span>
}

export default function AttendanceView({ readOnly }) {
  const [attendance, setAttendance] = useState([])
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [search, setSearch] = useState('')

  const [selectedWorker, setSelectedWorker] = useState(null)
  const [workerAttendance, setWorkerAttendance] = useState([])

  const [editingRecord, setEditingRecord] = useState(null)
  const [editPunchIn, setEditPunchIn] = useState('')
  const [editPunchOut, setEditPunchOut] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  const [addingRecord, setAddingRecord] = useState(false)
  const [addWorkerId, setAddWorkerId] = useState('')
  const [addDate, setAddDate] = useState('')
  const [addPunchIn, setAddPunchIn] = useState('')
  const [addPunchOut, setAddPunchOut] = useState('')
  const [addStatus, setAddStatus] = useState('present')
  const [addLoading, setAddLoading] = useState(false)
  const [tab, setTab] = useState('today')
  const [workerMonth, setWorkerMonth] = useState(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') })

  useEffect(() => {
    const d = new Date()
    setDateTo(getIstDateStr(d))
    d.setDate(d.getDate() - 30)
    setDateFrom(getIstDateStr(d))
    loadData()
  }, [])

  useEffect(() => {
    if (selectedWorker) {
      const records = attendance.filter(a => a.worker_id === selectedWorker.id)
      const ym = workerMonth || (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') })()
      const [y, m] = ym.split('-').map(Number)
      const daysInMonth = new Date(y, m, 0).getDate()
      const filled = []
      for (let d = daysInMonth; d >= 1; d--) {
        const ds = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        const existing = records.find(r => r.date === ds)
        filled.push(existing || { id: null, date: ds, status: 'absent', punch_in_time: null, punch_out_time: null, late_minutes: 0, worker_id: selectedWorker.id })
      }
      setWorkerAttendance(filled)
    }
  }, [attendance, selectedWorker, workerMonth])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [att, wrk] = await Promise.all([
        fetchAttendance().catch(() => []),
        fetchWorkers().catch(() => []),
      ])
      setAttendance(Array.isArray(att) ? att : [])
      setWorkers(Array.isArray(wrk) ? wrk : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filtered = attendance.filter(r => {
    const w = r.workers || workers.find(x => x.id === r.worker_id) || {}
    if (search) {
      const name = (w.name || '').toLowerCase()
      const lid = (w.login_id || '').toLowerCase()
      const s = search.toLowerCase()
      if (!name.includes(s) && !lid.includes(s)) return false
    }
    return true
  })

  const depts = [...new Set(workers.map(w => w.department).filter(Boolean))].sort()

  function openEdit(record) {
    setEditingRecord(record)
    setEditPunchIn(extractTime(record.punch_in_time))
    setEditPunchOut(extractTime(record.punch_out_time))
    setEditStatus(record.status)
  }

  function closeEdit() {
    setEditingRecord(null)
    setEditLoading(false)
  }

  async function saveEdit() {
    if (!editingRecord) return
    setEditLoading(true)
    try {
      await supabase.from('attendance').update({
        punch_in_time: reconstructIso(editingRecord.punch_in_time, editPunchIn, editingRecord.date),
        punch_out_time: reconstructIso(editingRecord.punch_out_time, editPunchOut, editingRecord.date),
        status: editStatus,
      }).eq('id', editingRecord.id)
      await loadData()
      closeEdit()
    } catch (err) {
      alert(err.message)
    } finally {
      setEditLoading(false)
    }
  }

  async function deleteRecord(id) {
    if (!confirm('Delete this attendance record?')) return
    try {
      await supabase.from('attendance').delete().eq('id', id)
      await loadData()
      closeEdit()
    } catch (err) {
      alert(err.message)
    }
  }

  async function addRecord() {
    if (!addWorkerId || !addDate) { alert('Select a worker and date'); return }
    setAddLoading(true)
    try {
      await supabase.from('attendance').insert({
        worker_id: addWorkerId,
        date: addDate,
        punch_in_time: istTimeToIso(addDate, addPunchIn),
        punch_out_time: istTimeToIso(addDate, addPunchOut),
        status: addStatus,
      })
      await loadData()
      setAddingRecord(false)
      setAddWorkerId('')
      setAddDate('')
      setAddPunchIn('')
      setAddPunchOut('')
      setAddStatus('present')
    } catch (err) {
      alert(err.message)
    } finally {
      setAddLoading(false)
    }
  }

  if (loading && attendance.length === 0) {
    return <div className="loading"><div className="spinner" /><p>Loading attendance...</p></div>
  }

  if (selectedWorker) {
    return (
      <div>
        <div className="detail-header">
          <button className="btn btn-ghost" onClick={() => { setSelectedWorker(null); setEditingRecord(null) }}>&larr;</button>
          <h3>{selectedWorker.name}</h3>
          <select className="month-select" value={workerMonth} onChange={e => setWorkerMonth(e.target.value)}>
            {Array.from({ length: 12 }, (_, i) => {
              const d = new Date()
              d.setMonth(d.getMonth() - i)
              const y = d.getFullYear()
              const m = String(d.getMonth() + 1).padStart(2, '0')
              const val = `${y}-${m}`
              const lbl = d.toLocaleString('default', { month: 'short', year: 'numeric' })
              return <option key={val} value={val}>{lbl}</option>
            })}
          </select>
          <div className="detail-actions">
            {!readOnly && <button className="btn btn-primary btn-sm" onClick={() => { setAddingRecord(true); setAddWorkerId(selectedWorker.id); setAddDate(''); setAddPunchIn(''); setAddPunchOut(''); setAddStatus('present') }}>+ Add</button>}
          </div>
        </div>
        <div className="table-card">
          {workerAttendance.length === 0 ? (
            <div className="empty-state">No records for this month.</div>
          ) : (
            <table>
              <thead>
                <tr><th>Date</th><th>Punch In</th><th>Punch Out</th>{!readOnly && <th></th>}</tr>
              </thead>
              <tbody>
                {workerAttendance.map((r, i) => (
                  <tr key={r.id || r.date} className={r.status === 'absent' ? 'row-absent' : r.status === 'late' ? 'row-late' : ''}>
                    <td>{fmtDate(r.date)}</td>
                    <td>{fmtTime(r.punch_in_time)}</td>
                    <td>{fmtTime(r.punch_out_time)}</td>
                    {!readOnly && <td style={{ textAlign: 'right' }}>
                      {r.id ? <button className="btn btn-sm" onClick={e => { e.stopPropagation(); openEdit(r) }} title="Edit">&#9998;</button> : <span className="dim">&mdash;</span>}
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {addingRecord && (
          <div className="modal-overlay" onClick={() => setAddingRecord(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-head">
                <h3>Add Attendance</h3>
                <button className="btn btn-sm" onClick={() => setAddingRecord(false)}>&times;</button>
              </div>
              <div className="modal-body">
                <label className="field">
                  <span>Worker</span>
                  <input type="text" value={selectedWorker?.name || ''} disabled />
                </label>
                <label className="field">
                  <span>Date</span>
                  <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)} required />
                </label>
                <label className="field">
                  <span>Punch In Time</span>
                  <input type="time" value={addPunchIn} onChange={e => setAddPunchIn(e.target.value)} />
                </label>
                <label className="field">
                  <span>Punch Out Time</span>
                  <input type="time" value={addPunchOut} onChange={e => setAddPunchOut(e.target.value)} />
                </label>
                <label className="field">
                  <span>Status</span>
                  <select value={addStatus} onChange={e => setAddStatus(e.target.value)}>
                    <option value="present">Present</option>
                    <option value="late">Late</option>
                    <option value="absent">Absent</option>
                    <option value="leave">Leave</option>
                  </select>
                </label>
              </div>
              <div className="modal-foot">
                <button className="btn" onClick={() => setAddingRecord(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={addRecord} disabled={addLoading}>
                  {addLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {!readOnly && editingRecord && (
          <div className="modal-overlay" onClick={closeEdit}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-head">
                <h3>Edit Attendance</h3>
                <button className="btn btn-sm" onClick={closeEdit}>&times;</button>
              </div>
              <div className="modal-body">
                <label className="field">
                  <span>Worker</span>
                  <input type="text" value={editingRecord.workers?.name || selectedWorker?.name || ''} disabled />
                </label>
                <label className="field">
                  <span>Date</span>
                  <input type="text" value={fmtDate(editingRecord.date)} disabled />
                </label>
                <label className="field">
                  <span>Punch In</span>
                  <input type="time" value={editPunchIn} onChange={e => setEditPunchIn(e.target.value)} />
                </label>
                <label className="field">
                  <span>Punch Out</span>
                  <input type="time" value={editPunchOut} onChange={e => setEditPunchOut(e.target.value)} />
                </label>
                <label className="field">
                  <span>Status</span>
                  <select value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                    <option value="present">Present</option>
                    <option value="late">Late</option>
                    <option value="absent">Absent</option>
                    <option value="leave">Leave</option>
                  </select>
                </label>
              </div>
              <div className="modal-foot">
                <button className="btn btn-danger" onClick={() => deleteRecord(editingRecord.id)} style={{ marginRight: 'auto' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: 'middle' }}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  Delete
                </button>
                <button className="btn" onClick={closeEdit}>Cancel</button>
                <button className="btn btn-primary" onClick={saveEdit} disabled={editLoading}>
                  {editLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {error && <div className="login-error">{error}</div>}

      <div className="search-bar">
        <div className="filter-group">
          <input type="text" placeholder="Search employee..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="employee-list">
        {workers.filter(w => {
          if (!search) return true
          const s = search.toLowerCase()
          return (w.name || '').toLowerCase().includes(s) || (w.login_id || '').toLowerCase().includes(s)
        }).map((w) => (
          <div key={w.id} className="employee-item" onClick={() => setSelectedWorker(w)}>
            <div>
              <div className="employee-name">{w.name || 'Unknown'}</div>
              {w.department && <div className="employee-id">{w.department}</div>}
            </div>
            <span className="employee-arrow">&rarr;</span>
          </div>
        ))}
        {workers.length > 0 && workers.filter(w => {
          if (!search) return true
          const s = search.toLowerCase()
          return (w.name || '').toLowerCase().includes(s) || (w.login_id || '').toLowerCase().includes(s)
        }).length === 0 && (
          <div className="empty-state">No employees match your search.</div>
        )}
        {workers.length === 0 && !loading && (
          <div className="empty-state">No employees found.</div>
        )}
      </div>

      {!readOnly && editingRecord && !selectedWorker && (
        <div className="modal-overlay" onClick={closeEdit}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Edit Attendance</h3>
              <button className="btn btn-sm" onClick={closeEdit}>&times;</button>
            </div>
            <div className="modal-body">
              <label className="field">
                <span>Worker</span>
                <input type="text" value={editingRecord.workers?.name || workers.find(w => w.id === editingRecord.worker_id)?.name || ''} disabled />
              </label>
              <label className="field">
                <span>Date</span>
                <input type="text" value={fmtDate(editingRecord.date)} disabled />
              </label>
              <label className="field">
                <span>Punch In</span>
                <input type="time" value={editPunchIn} onChange={e => setEditPunchIn(e.target.value)} />
              </label>
              <label className="field">
                <span>Punch Out</span>
                <input type="time" value={editPunchOut} onChange={e => setEditPunchOut(e.target.value)} />
              </label>
              <label className="field">
                <span>Status</span>
                <select value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                  <option value="leave">Leave</option>
                </select>
              </label>
            </div>
            <div className="modal-foot">
              <button className="btn btn-danger" onClick={() => deleteRecord(editingRecord.id)} style={{ marginRight: 'auto' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: 'middle' }}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Delete
              </button>
              <button className="btn" onClick={closeEdit}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={editLoading}>
                {editLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
