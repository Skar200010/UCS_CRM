import { useState, useEffect } from 'react'
import { fetchEvents, fetchEventAttendance, markAttendance } from '../store'
import { EnhancedTable } from '../components/Table'

export default function AttendanceManagement() {
  const [events, setEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState('')
  const [attendance, setAttendance] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name:'', type:'Staff', status:'Present' })

  useEffect(() => { fetchEvents().then(setEvents).catch(e => console.error('AttendanceManagement fetchEvents:', e)) }, [])
  useEffect(() => {
    if (!selectedEvent) { setAttendance([]); return }
    fetchEventAttendance(selectedEvent).then(setAttendance).catch(e => console.error('AttendanceManagement fetchEventAttendance:', e))
  }, [selectedEvent])

  const handleSubmit = async (e) => {
    e.preventDefault()
    await markAttendance(selectedEvent, form).then((res) => { setAttendance([...attendance, res]); setShowForm(false); setForm({name:'',type:'Staff',status:'Present'}) }).catch(e => console.error('AttendanceManagement markAttendance:', e))
  }

  const counts = { Present: 0, Absent: 0, Late: 0 }
  attendance.forEach(a => { if (counts[a.status] !== undefined) counts[a.status]++ })

  const columns = [
    { header: 'Name', accessor: 'name', render: (row) => <span style={{ fontWeight: 500 }}>{row.name}</span> },
    { header: 'Type', accessor: 'type', render: (row) => <span className={`pill pill-${row.type === 'Staff' ? 'blue' : row.type === 'Volunteer' ? 'purple' : 'gray'}`}>{row.type}</span> },
    { header: 'Status', accessor: 'status', render: (row) => <span className={`pill pill-${row.status === 'Present' ? 'green' : row.status === 'Absent' ? 'red' : 'yellow'}`}>{row.status}</span> },
    { header: 'Time', accessor: 'created_at', render: (row) => row.created_at?.slice(11, 19) || '—' },
  ]

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h3 style={{ fontSize: 16 }}>Event Attendance</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} style={{ padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
            <option value="">Select Event</option>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)} disabled={!selectedEvent}>+ Mark</button>
        </div>
      </div>

      {selectedEvent && (
        <>
          {attendance.length > 0 && (
            <div className="stats-grid" style={{ marginBottom: 16, gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div className="stat-card"><div className="stat-num" style={{ color: '#16a34a' }}>{counts.Present}</div><div className="stat-lbl">Present</div></div>
              <div className="stat-card"><div className="stat-num" style={{ color: '#dc2626' }}>{counts.Absent}</div><div className="stat-lbl">Absent</div></div>
              <div className="stat-card"><div className="stat-num" style={{ color: '#C08A2E' }}>{counts.Late}</div><div className="stat-lbl">Late</div></div>
            </div>
          )}

          {showForm && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-head"><h3>Mark Attendance</h3></div>
              <div className="card-pad">
                <form onSubmit={handleSubmit}>
                  <div className="form-row">
                    <div className="field"><label>Name</label><input value={form.name} onChange={e => setForm({...form,name:e.target.value})} required /></div>
                    <div className="field"><label>Type</label>
                      <select value={form.type} onChange={e => setForm({...form,type:e.target.value})}>
                        <option value="Staff">Staff</option><option value="Volunteer">Volunteer</option><option value="Guest">Guest</option>
                      </select>
                    </div>
                  </div>
                  <div className="field"><label>Status</label>
                    <select value={form.status} onChange={e => setForm({...form,status:e.target.value})}>
                      <option value="Present">Present</option><option value="Absent">Absent</option><option value="Late">Late</option>
                    </select>
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                    <button type="submit" className="btn btn-primary btn-sm">Save</button>
                    <button type="button" className="btn btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <EnhancedTable
            columns={columns}
            data={attendance}
            searchPlaceholder="Search attendees..."
            pageSize={10}
          />
        </>
      )}

      {!selectedEvent && <div className="card"><div className="card-pad" style={{ textAlign: 'center', padding: 40, color: 'var(--ink-soft)' }}>Select an event to manage attendance</div></div>}
    </>
  )
}
