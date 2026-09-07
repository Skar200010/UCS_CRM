import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CATEGORIES, PRIORITIES, fetchWorkspaceNgos, fetchSectors, fetchActivities, createEvent, createActivity, createSector, suggestEventSpelling, uploadEventBanner, CHECKLIST_ITEMS, createChecklistItem } from '../store'
import { PageHeader } from '../components/ui'
import VoluntaryPicker from '../components/VoluntaryPicker'
import usePasteImage from '../../../utils/usePasteImage'

export default function CreateEvent() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [ngos, setNgos] = useState([])
  const [sectors, setSectors] = useState([])
  const [allActivities, setAllActivities] = useState([])
  const [form, setForm] = useState({
    name:'', category:'', ngo_id: searchParams.get('ngo_id') || '', sector_id: searchParams.get('sector_id') || '', activityName:'',
    date:'', start_time:'', end_time:'', venue:'', priority:'Medium', banner:'',
    gps_location:'', district:'', state:'', organizer:'', event_manager:'', coordinator:'',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [volunteers, setVolunteers] = useState([])
  const [checklist, setChecklist] = useState(CHECKLIST_ITEMS.map(label => ({ label, status: false, notes: '' })))
  const [bannerUploading, setBannerUploading] = useState(false)
  const [bannerError, setBannerError] = useState('')
  const [addingSector, setAddingSector] = useState(false)
  const [newSectorName, setNewSectorName] = useState('')
  const [sectorSaving, setSectorSaving] = useState(false)
  const [sectorNote, setSectorNote] = useState('')
  const [sectorNoteError, setSectorNoteError] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState({})
  const [aiChecking, setAiChecking] = useState(false)
  const [aiUnavailable, setAiUnavailable] = useState(false)
  const [aiDismissed, setAiDismissed] = useState({})
  const [aiRan, setAiRan] = useState(false)
  const bannerFileRef = useRef(null)
  const onBannerPaste = usePasteImage(({ file }) => { if (file) uploadBanner(file) })

  const uploadBanner = (file) => {
    if (!file || bannerUploading) return
    setBannerUploading(true)
    setBannerError('')
    const fd = new FormData()
    fd.append('file', file, file.name)
    uploadEventBanner(fd)
      .then(res => {
        const url = (res && res.url) || ''
        if (!url) { setBannerError('Upload succeeded but no URL was returned.'); return }
        setForm(prev => ({ ...prev, banner: url }))
        if (bannerFileRef.current) bannerFileRef.current.value = ''
      })
      .catch(err => setBannerError(err.message || 'Banner upload failed'))
      .finally(() => setBannerUploading(false))
  }

  useEffect(() => {
    Promise.all([
      fetchWorkspaceNgos().catch(() => []),
      fetchSectors().catch(() => []),
      fetchActivities().catch(() => []),
    ]).then(([n, s, a]) => {
      setNgos(n || [])
      setSectors(s || [])
      setAllActivities(a || [])
    })
  }, [])

  const ngoId = form.ngo_id ? String(form.ngo_id) : ''
  const sectorId = form.sector_id ? String(form.sector_id) : ''

  // Fields that support AI spelling suggestions (free-text; dropdowns excluded).
  const SPELL_FIELDS = ['name', 'activityName', 'category', 'venue', 'district', 'state', 'organizer', 'event_manager', 'coordinator']

  const applySuggestion = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setAiDismissed(prev => ({ ...prev, [key]: true }))
  }

  const applyAllSuggestions = () => {
    const next = { ...form }
    const dismissed = { ...aiDismissed }
    for (const [key, s] of Object.entries(aiSuggestions)) {
      const corrected = (s && s.corrected) || s
      next[key] = corrected
      dismissed[key] = true
    }
    setForm(next)
    setAiDismissed(dismissed)
  }

  // Debounced auto spell-check: after ~900ms of no typing, ask GROQ for
  // corrections and surface them as suggestions. Never blocks event creation.
  useEffect(() => {
    const fields = SPELL_FIELDS
      .map(key => ({ key, value: String(form[key] || '').trim() }))
      .filter(f => f.value)

    if (!fields.length) { setAiSuggestions({}); setAiUnavailable(false); return }
    const timer = setTimeout(() => {
      let cancelled = false
      setAiChecking(true)
      suggestEventSpelling(fields)
        .then(data => {
          if (cancelled) return
          const sugg = (data && data.suggestions) || {}
          setAiSuggestions(sugg)
          setAiUnavailable(false)
          setAiRan(true)
        })
        .catch(() => {
          if (!cancelled) setAiUnavailable(true)
        })
        .finally(() => {
          if (!cancelled) setAiChecking(false)
        })
      return () => { cancelled = true }
    }, 900)
    return () => clearTimeout(timer)
  }, [form.name, form.activityName, form.category, form.venue, form.district, form.state, form.organizer, form.event_manager, form.coordinator])

  const relevantSectors = useMemo(() => {
    const ids = new Set()
    for (const a of allActivities) {
      if (a.ngo_id == null || String(a.ngo_id) === ngoId) ids.add(String(a.sector_id))
    }
    let list = sectors.filter(s => ids.has(String(s.id)))
    if (!list.some(s => String(s.id) === sectorId) && form.sector_id) {
      const cur = sectors.find(s => String(s.id) === sectorId)
      if (cur) list = [cur, ...list]
    }
    return list
  }, [sectors, allActivities, ngoId, sectorId, form.sector_id])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => {
      const next = { ...prev, [name]: value }
      if (name === 'ngo_id') { next.sector_id = ''; next.activityName = '' }
      if (name === 'sector_id') next.activityName = ''
      return next
    })
  }

  // Resolve the manually-typed activity: use an existing one for this NGO+sector,
  // otherwise create it on the fly. Returns the activity id, or null.
  const resolveActivity = async () => {
    const name = String(form.activityName || '').trim()
    if (!name) return null
    const match = allActivities.find(a =>
      String(a.sector_id) === String(form.sector_id) &&
      (a.ngo_id == null || String(a.ngo_id) === String(form.ngo_id)) &&
      String(a.name || '').trim().toLowerCase() === name.toLowerCase()
    )
    if (match) return match.id
    try {
      const created = await createActivity({ ngo_id: form.ngo_id, sector_id: Number(form.sector_id), name, status: 'Active' })
      return created ? created.id : null
    } catch (err) {
      // Duplicate (409) — try to find it again, else surface the error.
      const found = allActivities.find(a =>
        String(a.sector_id) === String(form.sector_id) &&
        String(a.name || '').trim().toLowerCase() === name.toLowerCase()
      )
      return found ? found.id : null
    }
  }

  const saveNewSector = async () => {
    const name = String(newSectorName || '').trim()
    if (!name) { setSectorNote('Enter a sector name first'); setSectorNoteError(true); return }
    setSectorSaving(true)
    setSectorNote('')
    setSectorNoteError(false)
    try {
      const saved = await createSector({ name })
      const id = saved && (saved.id != null ? saved.id : saved.sector_id != null ? saved.sector_id : null)
      if (id == null) { setSectorNote('Could not create the sector'); setSectorNoteError(true); return }
      setSectors(prev => {
        const exists = prev.some(s => String(s.id != null ? s.id : s.sector_id) === String(id))
        return exists ? prev : [{ id, name: saved.name || name }, ...prev]
      })
      setForm(prev => ({ ...prev, sector_id: String(id) }))
      setAddingSector(false)
      setNewSectorName('')
      setSectorNote(saved && saved.existing ? `"${saved.name}" already exists — selected it.` : `Sector "${saved.name || name}" created and selected.`)
      setSectorNoteError(false)
    } catch (err) {
      setSectorNote(err.message || 'Failed to create sector')
      setSectorNoteError(true)
    } finally { setSectorSaving(false) }
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError('')
    if (!form.name.trim()) { setError('Please enter an Event Name'); setSaving(false); return }
    if (!form.ngo_id) { setError('Please choose an NGO'); setSaving(false); return }
    if (!form.sector_id) { setError('Please choose a Sector'); setSaving(false); return }
    if (!form.date) { setError('Please choose an Event Date — it is required so the event shows on the Calendar'); setSaving(false); return }
    try {
      const typedActivity = String(form.activityName || '').trim()
      const activity_id = typedActivity ? await resolveActivity() : null
      if (typedActivity && !activity_id) { setError('Could not resolve the Activity. Please pick an existing sector and try again.'); setSaving(false); return }
      const payload = {
        name: form.name,
        category: form.category || null,
        ngo_id: form.ngo_id,
        sector_id: Number(form.sector_id),
        activity_id: activity_id ? Number(activity_id) : null,
        date: form.date || null,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        venue: form.venue || null,
        priority: form.priority || 'Medium',
        banner: form.banner || null,
        gps_location: form.gps_location || null,
        district: form.district || null,
        state: form.state || null,
        organizer: form.organizer || null,
        event_manager: form.event_manager || null,
        coordinator: form.coordinator || null,
        volunteers: volunteers && volunteers.length ? volunteers : null,
      }
      const created = await createEvent(payload)
      if (created && created.id != null) {
        await Promise.allSettled(checklist.map(item => createChecklistItem(created.id, { label: item.label, status: !!item.status, notes: item.notes || '' }).catch(e => console.error('Seed checklist item failed:', e))))
      }
      const params = new URLSearchParams({ ngo_id: form.ngo_id, created: 1 })
      if (form.sector_id) params.set('sector_id', form.sector_id)
      navigate('/event-head/events?' + params.toString())
    } catch (err) { setError(err.message || 'Failed to create event'); console.error('Create event error:', err) }
    finally { setSaving(false) }
  }

  const section = (t) => <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--eh-primary)', margin: '20px 0 12px' }}>{t}</div>

  // Inline AI suggestion note shown just under a field when GROQ suggests a fix.
  const inlineSuggestion = (key) => {
    const sug = aiSuggestions[key]
    if (!sug || aiDismissed[key]) return null
    const corr = (sug && sug.corrected) || sug
    const reason = (sug && sug.reason) || 'looks like it may be spelled differently'
    return (
      <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#166534', flexWrap: 'wrap' }}>
        <span style={{ color: '#b91c1c' }}>⚠</span>
        <span>Looks like <b>{corr}</b>? <em style={{ color: '#6b7280', fontStyle: 'normal' }}>({reason})</em></span>
        <button type="button" onClick={() => applySuggestion(key, corr)} style={{ border: 'none', background: '#bbf7d0', color: '#166534', borderRadius: 999, padding: '1px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Apply</button>
        <button type="button" onClick={() => setAiDismissed(prev => ({ ...prev, [key]: true }))} style={{ border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 12 }} title="Dismiss">✕</button>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Create New Event"
        subtitle="Fill in the details and click Create Event"
        actions={<button className="eh-btn" onClick={() => navigate('/event-head/events')}>Cancel</button>}
      />

      <form onSubmit={handleSubmit} noValidate>
        {error && <div style={{ margin: '14px 0', padding: '12px 16px', borderRadius: 12, background: 'var(--eh-danger-soft)', color: 'var(--eh-danger)', fontSize: 13, fontWeight: 500 }}>{error}</div>}

        {/* ═══ AI SPELL SUGGESTIONS PANEL ═══ */}
        {(Object.keys(aiSuggestions).length > 0 || aiChecking || aiUnavailable) && (
          <div style={{ margin: '14px 0', borderRadius: 12, border: '1px solid #bbf7d0', background: '#f0fdf4', padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#166534' }}>
                {aiChecking ? '✨ Checking spellings…' : '✨ AI Spell Suggestions'}
              </div>
              {Object.keys(aiSuggestions).length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" className="eh-btn eh-btn-primary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={applyAllSuggestions}>Accept All</button>
                  <button type="button" className="eh-btn" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => setAiSuggestions({})}>Dismiss</button>
                </div>
              )}
            </div>
            {aiUnavailable && !aiChecking && (
              <div style={{ fontSize: 12, color: '#b45309' }}>AI spell check is unavailable right now — you can still create the event.</div>
            )}
            {Object.keys(aiSuggestions).length === 0 && !aiUnavailable && aiChecking && (
              <div style={{ fontSize: 12, color: '#6b7280' }}>Reviewing your spelling as you type…</div>
            )}
            {Object.keys(aiSuggestions).length === 0 && !aiUnavailable && !aiChecking && aiRan && (
              <div style={{ fontSize: 12, color: '#166534' }}>No spelling issues detected 👌</div>
            )}
            {Object.keys(aiSuggestions).reduce((acc, k) => {
              const orig = String(form[k] || '')
              const sug = aiSuggestions[k]
              const corr = (sug && sug.corrected) || sug
              const reason = (sug && sug.reason) || 'looks like it may be spelled differently'
              if (aiDismissed[k]) return acc
              acc.push(
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #d1fae5', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 12, color: '#374151', minWidth: 0 }}>
                    <span style={{ fontWeight: 700, textTransform: 'capitalize', color: '#166534' }}>{k.replace(/_/g, ' ')}:</span>{' '}
                    <span style={{ textDecoration: 'line-through', color: '#9ca3af' }}>{orig}</span>
                    {' → '}
                    <span style={{ fontWeight: 600, color: '#065f46' }}>{corr}</span>
                    <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>{reason}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="eh-btn eh-btn-primary" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => applySuggestion(k, corr)}>Apply</button>
                    <button type="button" className="eh-btn" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setAiDismissed(prev => ({ ...prev, [k]: true }))}>✕</button>
                  </div>
                </div>
              )
              return acc
            }, [])}
          </div>
        )}

        <div className="eh-section">
          <div className="eh-section-head">
            <div>
              <h3>Event</h3>
              <div className="eh-sub" style={{ fontSize: 12 }}>Program, details and banner</div>
            </div>
          </div>
          <div className="eh-section-body">
            {section('Program')}
            <div className="form-row">
              <div className="field"><label>NGO *</label>
                <select name="ngo_id" value={form.ngo_id} onChange={handleChange}>
                  <option value="">Select NGO</option>
                  {ngos.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>
              <div className="field"><label>Sector *</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select name="sector_id" value={form.sector_id} onChange={handleChange} disabled={!ngoId} style={{ flex: 1 }}>
                    <option value="">{ngoId ? 'Select sector' : 'Select NGO first'}</option>
                    {relevantSectors.map(s => <option key={s.id ?? s.sector_id} value={s.id ?? s.sector_id}>{s.name}</option>)}
                  </select>
                  <button type="button" className="eh-btn" disabled={!ngoId} title="Add a new sector" onClick={() => { setAddingSector(v => !v); setSectorNote('') }} style={{ whiteSpace: 'nowrap', padding: '7px 12px' }}>+ Add</button>
                </div>
                {addingSector && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input value={newSectorName} onChange={e => setNewSectorName(e.target.value)} placeholder="New sector name…" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveNewSector() } }} style={{ flex: '1 1 200px', padding: '7px 10px', fontSize: 13, border: '1px solid var(--eh-line,#e8e6f2)', borderRadius: 10 }} />
                    <button type="button" className="eh-btn eh-btn-primary" disabled={sectorSaving} onClick={saveNewSector} style={{ padding: '7px 12px' }}>{sectorSaving ? 'Saving…' : 'Save'}</button>
                    <button type="button" className="eh-btn" disabled={sectorSaving} onClick={() => { setAddingSector(false); setNewSectorName(''); setSectorNote('') }} style={{ padding: '7px 12px' }}>Cancel</button>
              </div>
                )}
                {sectorNote && <div style={{ marginTop: 6, fontSize: 12, color: sectorNoteError ? '#b91c1c' : '#16a34a' }}>{sectorNote}</div>}
              </div>
            </div>
            <div className="form-row">
              <div className="field"><label>Activity</label>
                <input name="activityName" value={form.activityName || ''} onChange={handleChange} list="act-list" placeholder="Type the activity name (optional)" />
                <datalist id="act-list">
                  {allActivities.filter(a => String(a.sector_id) === String(form.sector_id)).map(a => <option key={a.id} value={a.name} />)}
                </datalist>
                {inlineSuggestion('activityName')}
              </div>
              <div className="field"><label>Category</label>
                <input name="category" value={form.category} onChange={handleChange} list="cat-list" placeholder="Type or pick a category" />
                <datalist id="cat-list">{CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>
                {inlineSuggestion('category')}
              </div>
            </div>

            {section('Event Details')}
            <div className="form-row">
              <div className="field"><label>Event Name *</label><input name="name" value={form.name} onChange={handleChange} placeholder="e.g. Community Health Camp" required />{inlineSuggestion('name')}</div>
              <div className="field"><label>Event Date *</label><input type="date" name="date" value={form.date} onChange={handleChange} required /></div>
            </div>
            <div className="form-row">
              <div className="field"><label>Start Time</label><input type="time" name="start_time" value={form.start_time} onChange={handleChange} /></div>
              <div className="field"><label>End Time</label><input type="time" name="end_time" value={form.end_time} onChange={handleChange} /></div>
              <div className="field"><label>Priority</label><select name="priority" value={form.priority} onChange={handleChange}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select></div>
            </div>
            <div className="form-row">
              <div className="field"><label>Venue</label><input name="venue" value={form.venue} onChange={handleChange} placeholder="Full address" />{inlineSuggestion('venue')}</div>
            </div>

            {section('Location & Team')}
            <div className="form-row">
              <div className="field"><label>GPS Location</label><input name="gps_location" value={form.gps_location} onChange={handleChange} placeholder="Lat, Lng" /></div>
              <div className="field"><label>District</label><input name="district" value={form.district} onChange={handleChange} />{inlineSuggestion('district')}</div>
            </div>
            <div className="form-row">
              <div className="field"><label>State</label><input name="state" value={form.state} onChange={handleChange} />{inlineSuggestion('state')}</div>
              <div className="field"><label>Organizer</label><input name="organizer" value={form.organizer} onChange={handleChange} />{inlineSuggestion('organizer')}</div>
            </div>
            <div className="form-row">
              <div className="field"><label>Event Manager</label><input name="event_manager" value={form.event_manager} onChange={handleChange} />{inlineSuggestion('event_manager')}</div>
              <div className="field"><label>Coordinator</label><input name="coordinator" value={form.coordinator} onChange={handleChange} />{inlineSuggestion('coordinator')}</div>
            </div>

            {section('Voluntary (optional)')}
            <VoluntaryPicker ngoId={form.ngo_id} value={volunteers} onChange={setVolunteers} />

            {section('General Checklist')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {checklist.map((item, idx) => (
                <div key={item.label} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  background: 'var(--eh-surface-2,#fff)', border: '1px solid var(--eh-line,#e8e6f2)', borderRadius: 11,
                  opacity: item.status ? 0.7 : 1, flexWrap: 'wrap'
                }}>
                  <input
                    type="checkbox"
                    checked={!!item.status}
                    onChange={() => setChecklist(checklist.map((c, i) => i === idx ? { ...c, status: !c.status } : c))}
                    style={{ width: 18, height: 18, accentColor: 'var(--eh-success,#16a34a)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, textDecoration: item.status ? 'line-through' : 'none', color: item.status ? 'var(--eh-ink-soft,#6a6f8f)' : 'var(--eh-ink,#0f1128)' }}>
                      {item.label}
                    </div>
                    <input
                      value={item.notes || ''}
                      onChange={e => setChecklist(checklist.map((c, i) => i === idx ? { ...c, notes: e.target.value } : c))}
                      placeholder={item.status ? 'Note saved (uncheck to edit)…' : 'Add note…'}
                      disabled={!!item.status}
                      style={{
                        marginTop: 6, width: '100%', maxWidth: 460, padding: '6px 10px',
                        fontSize: 12, border: '1px solid var(--eh-line,#e8e6f2)', borderRadius: 8,
                        background: item.status ? 'rgba(0,0,0,.03)' : '#fff', fontFamily: 'inherit'
                      }} />
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 12, color: 'var(--eh-ink-soft,#6a6f8f)' }}>Tick items already arranged — they will be saved to this event's checklist when you create it.</div>
            </div>

            {section('Banner (optional)')}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="eh-btn" disabled={bannerUploading} onClick={() => bannerFileRef.current?.click()} onPaste={onBannerPaste} style={{ position: 'relative' }}>
                {bannerUploading ? 'Uploading…' : form.banner ? 'Change Banner' : 'Upload banner image'}
              </button>
              <input ref={bannerFileRef} type="file" hidden accept="image/*" onChange={e => uploadBanner(e.target.files[0] || null)} />
              {form.banner && (
                <button
                  type="button"
                  className="eh-btn"
                  disabled={bannerUploading}
                  onClick={() => { setForm(prev => ({ ...prev, banner: '' })); if (bannerFileRef.current) bannerFileRef.current.value = '' }}
                >
                  Remove
                </button>
              )}
              <span style={{ fontSize: 12, color: 'var(--eh-ink-soft, #6b7280)' }}>Optional — add an event banner, or paste an image (Ctrl+V).</span>
            </div>
            {bannerError && <div style={{ marginTop: 8, fontSize: 12.5, color: '#b91c1c' }}>{bannerError}</div>}
            {form.banner && (
              <div style={{ position: 'relative', marginTop: 10, padding: 8, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card-bg)' }}>
                <img src={form.banner} alt="banner preview" style={{ maxHeight: 160, width: '100%', objectFit: 'cover', borderRadius: 8, display: 'block' }} onError={e => { e.currentTarget.style.display = 'none' }} />
              </div>
            )}

            <div className="eh-toolbar" style={{ marginTop: 24, justifyContent: 'flex-end' }}>
              <button type="submit" className="eh-btn eh-btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create Event'}</button>
            </div>
          </div>
        </div>
      </form>
    </>
  )
}
