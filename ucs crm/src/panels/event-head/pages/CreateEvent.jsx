import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CATEGORIES, PRIORITIES, fetchNGOs, fetchCSRPartners, fetchDonors, createEvent } from '../store'

export default function CreateEvent() {
  const navigate = useNavigate()
  const [ngos, setNgos] = useState([])
  const [csrPartners, setCsrPartners] = useState([])
  const [donors, setDonors] = useState([])
  const [form, setForm] = useState({
    name:'', category:'', ngo_id:'', csr_partner:'', donor:'',
    date:'', start_time:'', end_time:'', venue:'', gps_location:'',
    district:'', state:'', organizer:'', event_manager:'', coordinator:'',
    expected_beneficiaries:'', budget:'', priority:'Medium', approval_status:'Draft'
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([fetchNGOs().catch(() => []), fetchCSRPartners().catch(() => []), fetchDonors().catch(() => [])])
      .then(([n,c,d]) => { setNgos(n); setCsrPartners(c); setDonors(d) })
  }, [])

  const handleChange = (e) => setForm({...form, [e.target.name]: e.target.value})
  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await createEvent(form)
      navigate('/event-head/events')
    } catch (err) { alert('Failed to create event: ' + (err.message || 'Unknown error')); console.error('Create event error:', err) }
    finally { setSaving(false) }
  }

  return (
    <div className="card">
      <div className="card-head"><h3>Create New Event</h3></div>
      <div className="card-pad">
        <form onSubmit={handleSubmit}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-soft)', marginBottom: 12 }}>Event Details</div>
          <div className="form-row">
            <div className="field"><label>Event Name</label><input name="name" value={form.name} onChange={handleChange} required placeholder="e.g. Community Health Camp" /></div>
            <div className="field"><label>Category</label><select name="category" value={form.category} onChange={handleChange} required>
              <option value="">Select category</option>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Event Date</label><input type="date" name="date" value={form.date} onChange={handleChange} required /></div>
            <div className="field"><label>Start Time</label><input type="time" name="start_time" value={form.start_time} onChange={handleChange} /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>End Time</label><input type="time" name="end_time" value={form.end_time} onChange={handleChange} /></div>
            <div className="field"><label>Priority</label><select name="priority" value={form.priority} onChange={handleChange}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select></div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-soft)', margin: '20px 0 12px' }}>Location</div>
          <div className="form-row">
            <div className="field"><label>Venue</label><input name="venue" value={form.venue} onChange={handleChange} required placeholder="Full address" /></div>
            <div className="field"><label>GPS Location</label><input name="gps_location" value={form.gps_location} onChange={handleChange} placeholder="Lat, Lng" /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>District</label><input name="district" value={form.district} onChange={handleChange} /></div>
            <div className="field"><label>State</label><input name="state" value={form.state} onChange={handleChange} /></div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-soft)', margin: '20px 0 12px' }}>Stakeholders</div>
          <div className="form-row">
            <div className="field"><label>NGO Partner</label><select name="ngo_id" value={form.ngo_id} onChange={handleChange}>
              <option value="">Select NGO</option>{ngos.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select></div>
            <div className="field"><label>CSR Partner</label><input name="csr_partner" value={form.csr_partner} onChange={handleChange} placeholder="Company name" /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Donor</label><input name="donor" value={form.donor} onChange={handleChange} /></div>
            <div className="field"><label>Organizer</label><input name="organizer" value={form.organizer} onChange={handleChange} /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Event Manager</label><input name="event_manager" value={form.event_manager} onChange={handleChange} /></div>
            <div className="field"><label>Coordinator</label><input name="coordinator" value={form.coordinator} onChange={handleChange} /></div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-soft)', margin: '20px 0 12px' }}>Budget &amp; Impact</div>
          <div className="form-row">
            <div className="field"><label>Expected Beneficiaries</label><input type="number" name="expected_beneficiaries" value={form.expected_beneficiaries} onChange={handleChange} /></div>
            <div className="field"><label>Budget (₹)</label><input type="number" name="budget" value={form.budget} onChange={handleChange} /></div>
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating...' : 'Create Event'}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => navigate('/event-head/dashboard')}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}
