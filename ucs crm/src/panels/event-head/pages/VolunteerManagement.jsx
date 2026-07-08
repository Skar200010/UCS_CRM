import { useState, useEffect } from 'react'
import { fetchVolunteers, createVolunteer, fetchEvents } from '../store'
import { EnhancedTable } from '../components/Table'

export default function VolunteerManagement() {
  const [volunteers, setVolunteers] = useState([])
  const [events, setEvents] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name:'', mobile:'', email:'', duty:'' })

  useEffect(() => {
    Promise.all([fetchVolunteers().catch(() => []), fetchEvents().catch(() => [])])
      .then(([v,e]) => { setVolunteers(v); setEvents(e) })
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    await createVolunteer(form).then((res) => { setVolunteers([...volunteers, res]); setShowForm(false); setForm({name:'',mobile:'',email:'',duty:''}) }).catch(e => console.error('VolunteerManagement createVolunteer:', e))
  }

  const attended = volunteers.filter(v => v.attended).length

  const columns = [
    { header: 'Name', accessor: 'name', render: (row) => <span style={{ fontWeight: 500 }}>{row.name}</span> },
    { header: 'Mobile', accessor: 'mobile' },
    { header: 'Email', accessor: 'email' },
    { header: 'Duty', accessor: 'duty' },
    { header: 'Status', accessor: 'attended', render: (row) => <span className={`pill pill-${row.attended ? 'green' : 'gray'}`}>{row.attended ? 'Attended' : 'Pending'}</span> },
  ]

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16 }}>Volunteer Management</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Add Volunteer</button>
      </div>

      <div className="stats-grid" style={{ marginBottom: 16, gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card"><div className="stat-num" style={{ color: '#7B5EA7' }}>{volunteers.length}</div><div className="stat-lbl">Total Volunteers</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#16a34a' }}>{attended}</div><div className="stat-lbl">Attended</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#B5603A' }}>{volunteers.length - attended}</div><div className="stat-lbl">Pending</div></div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head"><h3>Register Volunteer</h3></div>
          <div className="card-pad">
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="field"><label>Full Name</label><input value={form.name} onChange={e => setForm({...form,name:e.target.value})} required placeholder="e.g. Rahul Sharma" /></div>
                <div className="field"><label>Mobile</label><input value={form.mobile} onChange={e => setForm({...form,mobile:e.target.value})} placeholder="+91 98765 43210" /></div>
              </div>
              <div className="form-row">
                <div className="field"><label>Email</label><input type="email" value={form.email} onChange={e => setForm({...form,email:e.target.value})} /></div>
                <div className="field"><label>Assigned Duty</label><input value={form.duty} onChange={e => setForm({...form,duty:e.target.value})} placeholder="e.g. Registration Desk" /></div>
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
        data={volunteers}
        searchPlaceholder="Search volunteers..."
        pageSize={10}
      />
    </>
  )
}
