import { useState, useEffect } from 'react'
import { fetchVehicles, createVehicle, fetchEvents } from '../store'
import { EnhancedTable } from '../components/Table'

export default function VehicleManagement() {
  const [vehicles, setVehicles] = useState([])
  const [events, setEvents] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ vehicle_name:'', driver:'', fuel:'', kilometer_reading:'', assigned_event:'' })

  useEffect(() => {
    Promise.all([fetchVehicles().catch(() => []), fetchEvents().catch(() => [])])
      .then(([v,e]) => { setVehicles(v); setEvents(e) })
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    await createVehicle(form).then((res) => { setVehicles([...vehicles, res]); setShowForm(false); setForm({vehicle_name:'',driver:'',fuel:'',kilometer_reading:'',assigned_event:''}) }).catch(e => console.error('VehicleManagement createVehicle:', e))
  }

  const inTransit = vehicles.filter(v => v.status === 'In Transit' || v.status === 'Assigned').length
  const returned = vehicles.filter(v => v.status === 'Returned').length

  const columns = [
    { header: 'Vehicle', accessor: 'vehicle_name', render: (row) => <span style={{ fontWeight: 500 }}>{row.vehicle_name}</span> },
    { header: 'Driver', accessor: 'driver' },
    { header: 'Fuel (L)', accessor: 'fuel' },
    { header: 'KM Reading', accessor: 'kilometer_reading' },
    { header: 'Assigned Event', accessor: 'assigned_event', render: (row) => events.find(e => e.id === row.assigned_event)?.name || '—' },
    { header: 'Status', accessor: 'status', render: (row) => <span className={`pill pill-${(row.status || 'Assigned') === 'Returned' ? 'green' : (row.status || 'Assigned') === 'In Transit' ? 'yellow' : 'blue'}`}>{row.status || 'Assigned'}</span> },
  ]

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16 }}>Vehicle Management</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Assign Vehicle</button>
      </div>

      <div className="stats-grid" style={{ marginBottom: 16, gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card"><div className="stat-num" style={{ color: '#7B5EA7' }}>{vehicles.length}</div><div className="stat-lbl">Total Vehicles</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#C08A2E' }}>{inTransit}</div><div className="stat-lbl">In Use</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#16a34a' }}>{returned}</div><div className="stat-lbl">Returned</div></div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head"><h3>Assign Vehicle</h3></div>
          <div className="card-pad">
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="field"><label>Vehicle Name</label><input value={form.vehicle_name} onChange={e => setForm({...form,vehicle_name:e.target.value})} required placeholder="e.g. Tata Ace - KA01 AB 1234" /></div>
                <div className="field"><label>Driver</label><input value={form.driver} onChange={e => setForm({...form,driver:e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="field"><label>Fuel (Liters)</label><input value={form.fuel} onChange={e => setForm({...form,fuel:e.target.value})} placeholder="e.g. 20" /></div>
                <div className="field"><label>KM Reading</label><input value={form.kilometer_reading} onChange={e => setForm({...form,kilometer_reading:e.target.value})} /></div>
              </div>
              <div className="field"><label>Assigned Event</label>
                <select value={form.assigned_event} onChange={e => setForm({...form,assigned_event:e.target.value})}>
                  <option value="">Select</option>{events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
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
        data={vehicles}
        searchPlaceholder="Search vehicles..."
        pageSize={10}
      />
    </>
  )
}
