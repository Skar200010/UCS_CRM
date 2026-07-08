import { useState, useEffect } from 'react'
import { fetchEvents, fetchBeneficiaries, createBeneficiary, createDistribution, fetchMaterials } from '../store'

export default function BeneficiaryDistribution() {
  const [events, setEvents] = useState([])
  const [beneficiaries, setBeneficiaries] = useState([])
  const [materials, setMaterials] = useState([])
  const [selectedEvent, setSelectedEvent] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ beneficiary_name:'', mobile:'', address:'', category:'', material_id:'', quantity:1 })

  useEffect(() => {
    Promise.all([fetchEvents().catch(() => []), fetchBeneficiaries().catch(() => []), fetchMaterials().catch(() => [])])
      .then(([e,b,m]) => { setEvents(e); setBeneficiaries(b); setMaterials(m) })
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedEvent) return alert('Select an event first')
    await createDistribution(selectedEvent, form).then(() => { setShowForm(false); setForm({beneficiary_name:'',mobile:'',address:'',category:'',material_id:'',quantity:1}) }).catch(e => console.error('BeneficiaryDistribution createDistribution:', e))
  }

  const totalBene = beneficiaries.length
  const todayDist = beneficiaries.filter(b => b.created_at?.startsWith(new Date().toISOString().slice(0,10))).length

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h3 style={{ fontSize: 16 }}>Beneficiary Distribution</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} style={{ padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
            <option value="">Select Event</option>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name} — {ev.date?.slice(0,10)}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)} disabled={!selectedEvent}>+ Distribute</button>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 16, gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card"><div className="stat-num" style={{ color: '#7B5EA7' }}>{beneficiaries.length}</div><div className="stat-lbl">Total Beneficiaries</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#16a34a' }}>{todayDist}</div><div className="stat-lbl">Today's Distributions</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#3485D4' }}>{materials.length}</div><div className="stat-lbl">Material Types</div></div>
      </div>

      {showForm && selectedEvent && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head"><h3>Distribution Entry</h3></div>
          <div className="card-pad">
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="field"><label>Beneficiary Name</label><input value={form.beneficiary_name} onChange={e => setForm({...form,beneficiary_name:e.target.value})} required /></div>
                <div className="field"><label>Mobile</label><input value={form.mobile} onChange={e => setForm({...form,mobile:e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="field"><label>Address</label><input value={form.address} onChange={e => setForm({...form,address:e.target.value})} /></div>
                <div className="field"><label>Category</label>
                  <select value={form.category} onChange={e => setForm({...form,category:e.target.value})}>
                    <option value="">Select</option><option value="BPL">BPL</option><option value="APL">APL</option><option value="Disabled">Disabled</option><option value="Senior Citizen">Senior Citizen</option><option value="Women">Women</option><option value="Child">Child</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="field"><label>Material</label>
                  <select value={form.material_id} onChange={e => setForm({...form,material_id:e.target.value})} required>
                    <option value="">Select</option>{materials.map(m => <option key={m.id} value={m.id}>{m.name} (Bal: {m.balance ?? m.opening_stock - m.issued})</option>)}
                  </select>
                </div>
                <div className="field"><label>Quantity</label><input type="number" value={form.quantity} onChange={e => setForm({...form,quantity:+e.target.value})} min={1} /></div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary btn-sm">Save Distribution</button>
                <button type="button" className="btn btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedEvent && (
        <div className="card">
          <div className="card-head"><h3>Distribution Records</h3></div>
          <div className="card-pad" style={{ padding: 0 }}>
            <table>
              <thead><tr><th>Beneficiary</th><th>Mobile</th><th>Category</th><th>Material</th><th>Qty</th><th>Time</th></tr></thead>
              <tbody>
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--ink-soft)' }}>No distributions recorded yet</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!selectedEvent && <div className="card"><div className="card-pad" style={{ textAlign: 'center', padding: 40, color: 'var(--ink-soft)' }}>Select an event to manage beneficiary distributions</div></div>}
    </>
  )
}
