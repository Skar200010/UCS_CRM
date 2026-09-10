import { useState, useEffect, useRef } from 'react'
import { api } from '../api/auth'
import { uploadImage } from '../../../components/NoticePopup'

const PANEL_OPTIONS = [
  { role: 'all', label: 'All' },
  { role: 'admin', label: 'Admin / Ngo Admin' },
  { role: 'accounts', label: 'Accounts' },
  { role: 'hr', label: 'HR' },
  { role: 'recruiter', label: 'Recruiter' },
  { role: 'event_head', label: 'Event Head' },
  { role: 'fro', label: 'FRO' },
]

const EMPTY = { title: '', content: '', media_url: '', media_type: '', media_name: '', target_roles: ['all'], popup: true }

const isImageUrl = (url, type) => {
  const t = String(type || '').toLowerCase()
  const u = String(url || '').toLowerCase()
  if (t.startsWith('image/')) return true
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif)(\?|$)/.test(u)
}

export default function Notices() {
  const [notices, setNotices] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [edit, setEdit] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [err, setErr] = useState('')
  const [uploading, setUploading] = useState(false)
  const [confirmId, setConfirmId] = useState(null)
  const fileRef = useRef(null)

  const load = () => { api('/notices').then(setNotices).catch(e => setErr(e.message)) }
  useEffect(load, [])

  const openNew = () => { setEdit(null); setForm(EMPTY); setErr(''); setShowForm(true) }
  const openEdit = (n) => {
    setEdit(n)
    let roles = Array.isArray(n.target_roles) && n.target_roles.length
      ? n.target_roles
      : (n.target_role && n.target_role !== 'all' ? [n.target_role] : ['all'])
    if (!Array.isArray(roles)) roles = ['all']
    setForm({ title: n.title || '', content: n.content || '', media_url: n.media_url || '', media_type: n.media_type || '', media_name: n.media_name || '', target_roles: roles, popup: n.popup !== false })
    setErr('')
    setShowForm(true)
  }

  const toggleRole = (role) => {
    setForm(prev => {
      if (role === 'all') return { ...prev, target_roles: ['all'] }
      let next = prev.target_roles.includes(role)
        ? prev.target_roles.filter(r => r !== role)
        : [...prev.target_roles.filter(r => r !== 'all'), role]
      if (next.length === 0) next = ['all']
      return { ...prev, target_roles: next }
    })
  }

  const handleFile = async (e) => {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return
    if (!String(file.type || '').startsWith('image/')) { setErr('Only image files are allowed'); return }
    if (file.size > 50 * 1024 * 1024) { setErr('Image must be under 50 MB'); return }
    setUploading(true); setErr('')
    try {
      const r = await uploadImage(file)
      if (!r || !r.url) throw new Error('Upload failed')
      setForm(prev => ({ ...prev, media_url: r.url, media_type: r.type || file.type, media_name: r.name || file.name }))
    } catch (e2) { setErr(e2.message || 'Upload failed') } finally { setUploading(false) }
  }

  const save = async () => {
    setErr('')
    if (!form.title.trim()) { setErr('Title is required'); return }
    try {
      const payload = { ...form, content: form.content, media_url: form.media_url || null, media_type: form.media_type || null, media_name: form.media_name || null }
      if (edit) await api(`/notices/${edit.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      else await api('/notices', { method: 'POST', body: JSON.stringify(payload) })
      setShowForm(false); load()
    } catch (e3) { setErr(e3.message) }
  }

  const remove = async (id) => {
    setConfirmId(null)
    try { await api(`/notices/${id}`, { method: 'DELETE' }); load() }
    catch (e) { setErr(e.message) }
  }

  const showImg = form.media_url && isImageUrl(form.media_url, form.media_type)

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <h3>Notices</h3>
        <button className="btn btn-primary" onClick={openNew}>+ Send Notice</button>
      </div>
      {err && <div className="sa-err-card">{err}</div>}

      {showForm && (
        <div className="sa-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="sa-modal" onClick={e => e.stopPropagation()} style={{ maxHeight: '92vh', overflowY: 'auto' }}>
            <h3>{edit ? 'Edit Notice' : 'New Notice'}</h3>
            <label className="field">Title <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></label>
            <label className="field">Description <textarea rows={4} value={form.content} onChange={e => setForm({...form, content: e.target.value})} /></label>

            <div className="field" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--ink-soft)' }}>Upload media (image)</div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
              {form.media_url ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, border: '1px solid var(--line)', borderRadius: 10, background: '#f8fafc' }}>
                  {showImg && <img src={form.media_url} alt="notice media" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8 }} />}
                  <span style={{ flex: 1, fontSize: 12.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.media_name || 'Uploaded image'}</span>
                  <button className="btn btn-sm btn-danger" onClick={() => setForm({ ...form, media_url: '', media_type: '', media_name: '' })} style={{ margin: 0 }}>✕ Remove</button>
                </div>
              ) : (
                <button type="button" className="btn" onClick={() => fileRef.current && fileRef.current.click()} disabled={uploading} style={{ width: '100%', padding: '18px 0', borderStyle: 'dashed', borderColor: '#cbd5e1', background: '#f8fafc', color: '#475569' }}>
                  {uploading ? '📤 Uploading…' : '📷 Upload image'}
                </button>
              )}
            </div>

            <div className="field" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--ink-soft)' }}>Send to panels</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {PANEL_OPTIONS.map(o => {
                  const active = form.target_roles.includes(o.role)
                  return (
                    <button key={o.role} type="button"
                      onClick={() => toggleRole(o.role)}
                      style={{
                        padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                        border: active ? '1.5px solid #2563eb' : '1.5px solid var(--line)',
                        background: active ? '#eff6ff' : '#fff', color: active ? '#2563eb' : 'var(--ink-soft)',
                      }}>
                      {active ? '✓ ' : ''}{o.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <label className="field" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Show as popup</span>
              <button type="button" onClick={() => setForm({ ...form, popup: !form.popup })}
                style={{
                  width: 42, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer', position: 'relative',
                  background: form.popup ? '#2563eb' : '#cbd5e1', transition: 'background .2s',
                }}>
                <span style={{
                  position: 'absolute', top: 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s',
                  left: form.popup ? 22 : 2,
                }} />
              </button>
            </label>

            <div className="sa-modal-actions">
              <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Send Notice</button>
            </div>
          </div>
        </div>
      )}

      <div className="sa-card-grid">
        {notices.map(n => {
          const thumb = n.media_url && isImageUrl(n.media_url, n.media_type)
          return (
            <div key={n.id} className="sa-notice-card">
              <div className="sa-notice-header">
                <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {n.title}
                  {n.popup !== false && <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: '#eff6ff', color: '#2563eb', whiteSpace: 'nowrap' }}>🔔 Popup</span>}
                </h4>
                <div>
                  <button className="btn btn-sm" onClick={() => openEdit(n)}>Edit</button>
                  {confirmId === n.id ? (
                    <>
                      <button className="btn btn-sm btn-danger" onClick={() => remove(n.id)} style={{ marginLeft: 4 }}>Confirm</button>
                      <button className="btn btn-sm" onClick={() => setConfirmId(null)} style={{ marginLeft: 4 }}>Cancel</button>
                    </>
                  ) : (
                    <button className="btn btn-sm btn-danger" onClick={() => setConfirmId(n.id)} style={{ marginLeft: 4 }}>Del</button>
                  )}
                </div>
              </div>
              <div className="sa-notice-date">{n.created_at ? new Date(n.created_at).toLocaleDateString() : ''}</div>
              {thumb && <img src={n.media_url} alt="" style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 8, margin: '6px 0' }} />}
              <div className="sa-notice-content">{n.content || ''}</div>
              {Array.isArray(n.target_roles) && n.target_roles.length > 0 && n.target_roles[0] !== 'all' && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {n.target_roles.map(r => (
                    <span key={r} style={{ fontSize: 10, fontWeight: 700, color: '#6d28d9', background: '#f5f3ff', padding: '2px 8px', borderRadius: 999 }}>
                      {r.replace('_', ' ') }
                    </span>
                  ))}
                </div>
              )}
              {(Array.isArray(n.target_roles) && n.target_roles[0] === 'all') && (
                <div style={{ marginTop: 8 }}><span style={{ fontSize: 10, fontWeight: 700, color: '#6d28d9', background: '#f5f3ff', padding: '2px 8px', borderRadius: 999 }}>All panels</span></div>
              )}
            </div>
          )
        })}
        {notices.length === 0 && <p className="sa-muted">No notices</p>}
      </div>
    </div>
  )
}