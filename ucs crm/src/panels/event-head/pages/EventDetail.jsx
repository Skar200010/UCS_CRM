import { useState, useEffect, useMemo } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { CATEGORIES, PRIORITIES, EVENT_STATUSES, fetchEventById, updateEvent, updateEventStatus, fetchWorkspaceNgos, fetchSectors, fetchActivities, fetchMedia } from '../store'
import EditBannerModal from '../components/EditBannerModal'
import VoluntaryPicker from '../components/VoluntaryPicker'

const statusColor = (s) => {
  const map = { Completed:'green', Approved:'blue', Draft:'gray', Submitted:'yellow', Rejected:'red', Cancelled:'red', Closed:'green', Postponed:'yellow' }
  return map[s] || 'gray'
}

export default function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [event, setEvent] = useState(null)
  const [media, setMedia] = useState([])
  const [ngos, setNgos] = useState([])
  const [sectors, setSectors] = useState([])
  const [allActivities, setAllActivities] = useState([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [editBanner, setEditBanner] = useState(null)

  const load = () => {
    setLoading(true)
    Promise.all([fetchEventById(id).catch(() => null), fetchMedia(id).catch(() => [])])
      .then(([ev, med]) => {
        setEvent(ev || null)
        setMedia(med || [])
      })
      .catch(e => { console.error('EventDetail fetch:', e); setEvent(null) })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    Promise.all([
      fetchWorkspaceNgos().catch(() => []),
      fetchSectors().catch(() => []),
      fetchActivities().catch(() => []),
    ]).then(([n, s, a]) => { setNgos(n || []); setSectors(s || []); setAllActivities(a || []) })
    load()
  }, [id])

  // Deep-link into edit mode (e.g. planner "Edit Event" button).
  useEffect(() => {
    if (event && !editing && searchParams.get('edit') === '1') startEdit()
  }, [event])

  const ngoId = form.ngo_id ? String(form.ngo_id) : (editing ? '' : '')
  const sectorId = form.sector_id ? String(form.sector_id) : (editing ? '' : '')

  const relevantSectors = useMemo(() => {
    if (!editing) return []
    const ids = new Set()
    for (const a of allActivities) {
      if (a.ngo_id == null || String(a.ngo_id) === ngoId) ids.add(String(a.sector_id))
    }
    let list = sectors.filter(s => ids.has(String(s.id)))
    if (sectorId && !list.some(s => String(s.id) === sectorId)) {
      const cur = sectors.find(s => String(s.id) === sectorId)
      if (cur) list = [cur, ...list]
    }
    return list
  }, [sectors, allActivities, editing, ngoId, sectorId])

  const relevantActivities = useMemo(() => {
    if (!editing) return []
    let list = allActivities.filter(a =>
      String(a.sector_id) === sectorId &&
      (a.ngo_id == null || String(a.ngo_id) === ngoId)
    )
    if (form.activity_id && !list.some(a => String(a.id) === String(form.activity_id))) {
      const cur = allActivities.find(a => String(a.id) === String(form.activity_id) && String(a.sector_id) === sectorId)
      if (cur) list = [cur, ...list]
    }
    return list
  }, [allActivities, editing, ngoId, sectorId, form.activity_id])

  const startEdit = () => {
    setForm({
      name: event.name || '', category: event.category || '', ngo_id: event.ngo_id != null ? String(event.ngo_id) : '',
      sector_id: event.sector_id != null ? String(event.sector_id) : '', activity_id: event.activity_id != null ? String(event.activity_id) : '',
      date: event.date || '', start_time: event.start_time || '', end_time: event.end_time || '',
      priority: event.priority || 'Medium', venue: event.venue || '', gps_location: event.gps_location || '',
      district: event.district || '', state: event.state || '', organizer: event.organizer || '',
      event_manager: event.event_manager || '', coordinator: event.coordinator || '',
      csr_partner: event.csr_partner || '', donor: event.donor || '', funding_source: event.funding_source || '',
      expected_beneficiaries: event.expected_beneficiaries || '', budget: event.budget || '',
      description: event.description || '', notes: event.notes || '',
      volunteers: Array.isArray(event.volunteers) ? event.volunteers : [],
    })
    setError('')
    setEditing(true)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => {
      const next = { ...prev, [name]: value }
      if (name === 'ngo_id') { next.sector_id = ''; next.activity_id = '' }
      if (name === 'sector_id') next.activity_id = ''
      return next
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    if (!form.name || !form.date) { setError('Event name and date are required'); setSaving(false); return }
    if (!form.ngo_id || !form.sector_id || !form.activity_id) {
      setError('NGO, Sector and Activity are required for the event'); setSaving(false); return
    }
    if (form.start_time && form.end_time && form.end_time < form.start_time) {
      setError('End time must be after start time'); setSaving(false); return
    }
    try {
      const payload = { ...form, ngo_id: form.ngo_id, sector_id: Number(form.sector_id), activity_id: Number(form.activity_id) }
      for (const k of Object.keys(payload)) {
        if (payload[k] === '' || payload[k] === null || payload[k] === undefined) payload[k] = null
      }
      const updated = await updateEvent(id, payload)
      setEvent({ ...event, ...updated })
      setEditing(false)
    } catch (err) { setError(err.message || 'Failed to save event'); console.error('EventDetail save:', err) }
    finally { setSaving(false) }
  }

  const handleStatus = async (status) => {
    try {
      await updateEventStatus(id, status)
      setEvent({ ...event, status })
    } catch (err) { alert('Failed to update status: ' + (err.message || 'Unknown error')) }
  }

  if (loading) return <div className="loading">Loading event...</div>
  if (!event) return (
    <div className="empty-state">
      <h3>Event not found</h3>
      <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={() => navigate('/event-head/events')}>Back to Events</button>
    </div>
  )

  const fmt = (v) => v || '—'
  const timeLabel = (s, e) => {
    if (s && e) return `${String(s).slice(0,5)} – ${String(e).slice(0,5)}`
    if (s) return String(s).slice(0,5)
    return '—'
  }
  const money = (v) => v == null || v === '' ? '—' : '₹' + Number(v).toLocaleString()

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-sm" onClick={() => navigate('/event-head/events')}>← Events</button>
        <h3 style={{ fontSize: 16 }}>Event Details</h3>
        {!editing && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {event.status !== 'Completed' && (
              <button className="btn btn-sm" style={{ color: '#16a34a', borderColor: '#bbf7d0' }} onClick={() => handleStatus('Completed')}>Mark Completed</button>
            )}
            <select className="pill" value={event.status} onChange={e => handleStatus(e.target.value)}
              style={{ padding: '4px 8px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer' }}>
              {EVENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="btn btn-sm" onClick={startEdit}>Edit</button>
            <button className="btn btn-sm" onClick={() => navigate('/event-head/reports')}>Report</button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head"><h3>Edit Event</h3></div>
          <form onSubmit={handleSave}>
            <div className="card-pad">
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-soft)', marginBottom: 12 }}>Program Context</div>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <div className="field"><label>NGO *</label><select name="ngo_id" value={form.ngo_id} onChange={handleChange} required>
                  <option value="">Select NGO</option>
                  {ngos.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select></div>
                <div className="field"><label>Sector *</label><select name="sector_id" value={form.sector_id} onChange={handleChange} required>
                  <option value="">Select sector</option>
                  {relevantSectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select></div>
              </div>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <div className="field"><label>Activity *</label><select name="activity_id" value={form.activity_id} onChange={handleChange} required>
                  <option value="">Select activity</option>
                  {relevantActivities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select></div>
                <div className="field"><label>Category</label><select name="category" value={form.category} onChange={handleChange}>
                  <option value="">Select category</option>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select></div>
              </div>

              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-soft)', margin: '16px 0 12px' }}>Event Details</div>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <div className="field"><label>Event Name *</label><input name="name" value={form.name} onChange={handleChange} required /></div>
                <div className="field"><label>Event Date *</label><input type="date" name="date" value={form.date} onChange={handleChange} required /></div>
              </div>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <div className="field"><label>Start Time</label><input type="time" name="start_time" value={form.start_time} onChange={handleChange} /></div>
                <div className="field"><label>End Time</label><input type="time" name="end_time" value={form.end_time} onChange={handleChange} /></div>
              </div>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <div className="field"><label>Priority</label><select name="priority" value={form.priority} onChange={handleChange}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select></div>
                <div className="field"><label>Venue</label><input name="venue" value={form.venue} onChange={handleChange} /></div>
              </div>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <div className="field"><label>GPS Location</label><input name="gps_location" value={form.gps_location} onChange={handleChange} /></div>
                <div className="field"><label>District</label><input name="district" value={form.district} onChange={handleChange} /></div>
              </div>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <div className="field"><label>State</label><input name="state" value={form.state} onChange={handleChange} /></div>
                <div className="field"><label>Organizer</label><input name="organizer" value={form.organizer} onChange={handleChange} /></div>
              </div>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <div className="field"><label>Event Manager</label><input name="event_manager" value={form.event_manager} onChange={handleChange} /></div>
                <div className="field"><label>Coordinator</label><input name="coordinator" value={form.coordinator} onChange={handleChange} /></div>
              </div>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <div className="field"><label>CSR Partner</label><input name="csr_partner" value={form.csr_partner} onChange={handleChange} /></div>
                <div className="field"><label>Donor</label><input name="donor" value={form.donor} onChange={handleChange} /></div>
              </div>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <div className="field"><label>Funding Source</label><input name="funding_source" value={form.funding_source} onChange={handleChange} /></div>
                <div className="field"><label>Expected Beneficiaries</label><input type="number" name="expected_beneficiaries" value={form.expected_beneficiaries} onChange={handleChange} /></div>
              </div>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <div className="field"><label>Budget (₹)</label><input type="number" name="budget" value={form.budget} onChange={handleChange} /></div>
              </div>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <div className="field"><label>Description</label><textarea name="description" value={form.description} onChange={handleChange} rows={3} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} /></div>
              </div>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <div className="field"><label>Notes</label><textarea name="notes" value={form.notes} onChange={handleChange} rows={2} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} /></div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-soft)', margin: '16px 0 12px' }}>Voluntary</div>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <VoluntaryPicker ngoId={form.ngo_id} value={Array.isArray(form.volunteers) ? form.volunteers : []} onChange={v => setForm(prev => ({ ...prev, volunteers: v }))} />
              </div>
              {error && <div style={{ marginBottom: 10, fontSize: 12, color: '#dc2626' }}>{error}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
                <button type="button" className="btn btn-sm" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </div>
          </form>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 16 }}>
          <div className="card">
            <div className="card-pad">
              {media.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 12, alignItems: 'center', color: 'var(--ink-soft)' }}>{media.length} media file{media.length !== 1 ? 's' : ''}</span>
                    <button className="btn btn-sm" style={{ background: '#7B5EA7', borderColor: '#7B5EA7', color: '#fff' }} onClick={() => setEditBanner(media[0])}>Edit Banner</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 }}>
                    {media.filter(m => /image/i.test(m.type || '') || /\.(png|jpe?g|gif|webp)$/i.test(m.url || '')).slice(0, 4).map((m, i) => (
                      <a key={i} href={m.url} target="_blank" rel="noreferrer" style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden', display: 'block' }}>
                        <img src={m.url} alt={m.name || 'media'} style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} onError={e => { e.currentTarget.style.display = 'none' }} />
                      </a>
                    ))}
                  </div>
                </>
              )}
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{event.name}</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <span className={`pill pill-${statusColor(event.status)}`}>{event.status}</span>
                {event.priority && <span className="pill pill-gray">{event.priority}</span>}
                {event.category && <span className="pill pill-blue">{event.category}</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                <div><span style={{ color: 'var(--ink-soft)' }}>NGO:</span><br /><b>{event.ngo_name || '—'}</b></div>
                <div><span style={{ color: 'var(--ink-soft)' }}>Sector:</span><br /><b>{event.sector_name || '—'}</b></div>
                <div><span style={{ color: 'var(--ink-soft)' }}>Activity:</span><br /><b>{event.activity_name || '—'}</b></div>
                <div><span style={{ color: 'var(--ink-soft)' }}>Event ID:</span><br />#{event.id}</div>
                <div><span style={{ color: 'var(--ink-soft)' }}>Date:</span><br /><b>{event.date ? event.date.slice(0, 10) : '—'}</b></div>
                <div><span style={{ color: 'var(--ink-soft)' }}>Time:</span><br /><b>{timeLabel(event.start_time, event.end_time)}</b></div>
                <div><span style={{ color: 'var(--ink-soft)' }}>Venue:</span><br /><b>{fmt(event.venue)}</b></div>
                <div><span style={{ color: 'var(--ink-soft)' }}>Location:</span><br />{[event.district, event.state].filter(Boolean).join(', ') || '—'}{event.gps_location ? ` (${event.gps_location})` : ''}</div>
                <div><span style={{ color: 'var(--ink-soft)' }}>Beneficiaries:</span><br /><b>{event.expected_beneficiaries || '—'}</b></div>
                <div><span style={{ color: 'var(--ink-soft)' }}>Budget:</span><br /><b>{money(event.budget)}</b></div>
                <div><span style={{ color: 'var(--ink-soft)' }}>Organizer:</span><br />{fmt(event.organizer)}</div>
                <div><span style={{ color: 'var(--ink-soft)' }}>Coordinator:</span><br />{fmt(event.coordinator)}</div>
                <div><span style={{ color: 'var(--ink-soft)' }}>CSR Partner:</span><br />{fmt(event.csr_partner)}</div>
                <div><span style={{ color: 'var(--ink-soft)' }}>Donor:</span><br />{fmt(event.donor)}</div>
                <div><span style={{ color: 'var(--ink-soft)' }}>Funding Source:</span><br />{fmt(event.funding_source)}</div>
                {event.event_manager && <div><span style={{ color: 'var(--ink-soft)' }}>Event Manager:</span><br />{fmt(event.event_manager)}</div>}
                <div><span style={{ color: 'var(--ink-soft)' }}>Created:</span><br />{event.created_at ? new Date(event.created_at).toLocaleDateString() : '—'}</div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Description</h3></div>
            <div className="card-pad" style={{ fontSize: 13, lineHeight: 1.65 }}>
              {event.description || 'No description added yet.'}
              {event.notes && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-soft)', fontStyle: 'italic' }}>Notes: {event.notes}</div>}
            </div>
          </div>
        </div>
      )}

      {(() => {
          const vols = Array.isArray(event.volunteers) ? event.volunteers : []
          if (!vols.length) return null
          const teamOrder = ['Volunteer', 'Management']
          const teamLabel = { Volunteer: 'Volunteer Team', Management: 'Management Team' }
          const ngoSort = (a, b) => {
            const m = { BSCT: 0, AFLF: 1, MANN: 2, MAN: 2, OTHERS: 3, OTHER: 3 }
            const ai = m[String(a).toUpperCase()] ?? 100
            const bi = m[String(b).toUpperCase()] ?? 100
            return ai - bi || String(a).localeCompare(String(b))
          }
          return teamOrder.map(team => {
            const items = vols.filter(v => (v.team === 'Management' ? 'Management' : 'Volunteer') === team)
            if (!items.length) return null
            const groups = {}
            for (const v of items) (groups[v.ngo || 'Others'] = groups[v.ngo || 'Others'] || []).push(v.name)
            return (
              <div className="card" key={team} style={{ marginBottom: 16 }}>
                <div className="card-head"><h3>{teamLabel[team]}</h3></div>
                <div className="card-pad">
                  {Object.keys(groups).sort(ngoSort).map(ngo => (
                    <div key={ngo} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 5 }}>{ngo} <span style={{ color: '#9ca3af' }}>· {groups[ngo].length}</span></div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {groups[ngo].map(name => (
                          <span key={name} className="pill pill-gray" style={{ fontSize: 12 }}>{name}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        })()}

      <div className="card">
        <div className="card-head"><h3>Activity Link</h3></div>
        <div className="card-pad" style={{ fontSize: 13 }}>
          {event.activity_id ? (
            <button className="btn btn-sm" onClick={() => navigate('/event-head/activities/' + event.activity_id)}>View Activity: {event.activity_name || '#' + event.activity_id}</button>
          ) : (
            <span style={{ color: 'var(--ink-soft)' }}>This event is not yet linked to an activity.</span>
          )}
        </div>
      </div>

      {editBanner && (
        <EditBannerModal
          media={editBanner}
          event={event}
          onClose={() => setEditBanner(null)}
          onSaved={() => { setEditBanner(null); load() }}
        />
      )}
    </>
  )
}