import { useState, useEffect } from 'react'
import { api } from '../api/auth'

export default function Organization() {
  const [ngos, setNgos] = useState([])
  const [causes, setCauses] = useState([])
  const [err, setErr] = useState('')

  const [ngoForm, setNgoForm] = useState({ name: '', code: '', address: '', registration_no: '' })
  const [editNgo, setEditNgo] = useState(null)
  const [showNgoForm, setShowNgoForm] = useState(false)

  const [causeForm, setCauseForm] = useState({ ngo_id: '', name: '', description: '' })
  const [editCause, setEditCause] = useState(null)
  const [showCauseForm, setShowCauseForm] = useState(false)

  const load = () => {
    api('/ngos').then(setNgos).catch(e => setErr(e.message))
    api('/causes').then(setCauses).catch(e => setErr(e.message))
  }
  useEffect(load, [])

  // NGO handlers
  const openNewNgo = () => { setEditNgo(null); setNgoForm({ name: '', code: '', address: '', registration_no: '' }); setShowNgoForm(true) }
  const openEditNgo = (n) => { setEditNgo(n); setNgoForm({ name: n.name, code: n.code, address: n.address || '', registration_no: n.registration_no || '' }); setShowNgoForm(true) }
  const saveNgo = async () => {
    setErr('')
    try {
      if (editNgo) await api(`/ngos/${editNgo.id}`, { method: 'PUT', body: JSON.stringify(ngoForm) })
      else await api('/ngos', { method: 'POST', body: JSON.stringify(ngoForm) })
      setShowNgoForm(false); load()
    } catch (e) { setErr(e.message) }
  }
  const toggleNgo = async (id) => {
    try { await api(`/ngos/${id}/toggle`, { method: 'PUT' }); load() }
    catch (e) { setErr(e.message) }
  }
  const removeNgo = async (id) => {
    if (!confirm('Delete this NGO?')) return
    try { await api(`/ngos/${id}`, { method: 'DELETE' }); load() }
    catch (e) { setErr(e.message) }
  }

  // Cause handlers
  const openNewCause = () => { setEditCause(null); setCauseForm({ ngo_id: '', name: '', description: '' }); setShowCauseForm(true) }
  const openEditCause = (c) => { setEditCause(c); setCauseForm({ ngo_id: c.ngo_id, name: c.name, description: c.description || '' }); setShowCauseForm(true) }
  const saveCause = async () => {
    setErr('')
    try {
      if (editCause) await api(`/causes/${editCause.id}`, { method: 'PUT', body: JSON.stringify(causeForm) })
      else await api('/causes', { method: 'POST', body: JSON.stringify(causeForm) })
      setShowCauseForm(false); load()
    } catch (e) { setErr(e.message) }
  }
  const toggleCause = async (id) => {
    try { await api(`/causes/${id}/toggle`, { method: 'PUT' }); load() }
    catch (e) { setErr(e.message) }
  }
  const removeCause = async (id) => {
    if (!confirm('Delete this cause?')) return
    try { await api(`/causes/${id}`, { method: 'DELETE' }); load() }
    catch (e) { setErr(e.message) }
  }

  const ngoMap = {}
  ngos.forEach(n => { ngoMap[n.id] = n })

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <h3>Organization</h3>
      </div>
      {err && <div className="sa-err-card">{err}</div>}

      {/* Modals */}
      {showNgoForm && (
        <div className="sa-modal-overlay" onClick={() => setShowNgoForm(false)}>
          <div className="sa-modal" onClick={e => e.stopPropagation()}>
            <h3>{editNgo ? 'Edit NGO' : 'New NGO'}</h3>
            <label className="field">Name <input value={ngoForm.name} onChange={e => setNgoForm({...ngoForm, name: e.target.value})} /></label>
            <label className="field">Code <input value={ngoForm.code} onChange={e => setNgoForm({...ngoForm, code: e.target.value})} /></label>
            <label className="field">Registration No. <input value={ngoForm.registration_no} onChange={e => setNgoForm({...ngoForm, registration_no: e.target.value})} /></label>
            <label className="field">Address <textarea value={ngoForm.address} onChange={e => setNgoForm({...ngoForm, address: e.target.value})} /></label>
            <div className="sa-modal-actions">
              <button className="btn" onClick={() => setShowNgoForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveNgo}>Save</button>
            </div>
          </div>
        </div>
      )}

      {showCauseForm && (
        <div className="sa-modal-overlay" onClick={() => setShowCauseForm(false)}>
          <div className="sa-modal" onClick={e => e.stopPropagation()}>
            <h3>{editCause ? 'Edit Cause' : 'New Cause'}</h3>
            <label className="field">NGO
              <select value={causeForm.ngo_id} onChange={e => setCauseForm({...causeForm, ngo_id: e.target.value})}>
                <option value="">— Select NGO —</option>
                {ngos.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
              </select>
            </label>
            <label className="field">Cause Name <input value={causeForm.name} onChange={e => setCauseForm({...causeForm, name: e.target.value})} /></label>
            <label className="field">Description <textarea value={causeForm.description} onChange={e => setCauseForm({...causeForm, description: e.target.value})} /></label>
            <div className="sa-modal-actions">
              <button className="btn" onClick={() => setShowCauseForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveCause}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Side by side: NGOs + Causes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

        {/* --- NGOs Column --- */}
        <div className="sa-card" style={{ margin: 0 }}>
          <div className="sa-page-header" style={{ marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
            <h3 style={{ margin: 0 }}>NGOs</h3>
            <button className="btn btn-primary btn-sm" onClick={openNewNgo}>+ New NGO</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ngos.length === 0 ? (
              <div className="sa-muted sa-center" style={{ padding: 20 }}>No NGOs yet</div>
            ) : ngos.map(n => (
              <div key={n.id} style={{
                background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: 14,
                display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'box-shadow 0.15s',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700, color: '#4f46e5', flexShrink: 0,
                }}>
                  {n.name?.charAt(0)?.toUpperCase() || 'N'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{n.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 2 }}>
                    {n.code ? <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>{n.code}</code> : null}
                    {n.registration_no ? <> · {n.registration_no}</> : null}
                  </div>
                  {n.address && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{n.address}</div>}
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                  <span className={`sa-badge ${n.is_active !== false ? 'active' : 'inactive'}`} style={{ fontSize: 9 }}>
                    {n.is_active !== false ? 'Active' : 'Inactive'}
                  </span>
                  <button className="btn btn-sm" onClick={() => openEditNgo(n)} title="Edit" style={{ padding: '2px 6px', fontSize: 11 }}>Edit</button>
                  <button className="btn btn-sm" onClick={() => toggleNgo(n.id)} title={n.is_active !== false ? 'Deactivate' : 'Activate'} style={{ padding: '2px 6px', fontSize: 11 }}>
                    {n.is_active !== false ? 'Off' : 'On'}
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => removeNgo(n.id)} title="Delete" style={{ padding: '2px 6px', fontSize: 11 }}>Del</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* --- Causes Column --- */}
        <div className="sa-card" style={{ margin: 0 }}>
          <div className="sa-page-header" style={{ marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Causes</h3>
            <button className="btn btn-primary btn-sm" onClick={openNewCause}>+ New Cause</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {causes.length === 0 ? (
              <div className="sa-muted sa-center" style={{ padding: 20 }}>No causes yet</div>
            ) : causes.map(c => (
              <div key={c.id} style={{
                background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: 14,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'box-shadow 0.15s',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700, color: '#ef4444', flexShrink: 0,
                  }}>
                    {c.name?.charAt(0)?.toUpperCase() || 'C'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 2 }}>
                      {ngoMap[c.ngo_id]?.name || '—'}
                    </div>
                    {c.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>{c.description}</div>}
                  </div>
                  <span className={`sa-badge ${c.is_active !== false ? 'active' : 'inactive'}`} style={{ fontSize: 9, flexShrink: 0 }}>
                    {c.is_active !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 8, borderTop: '1px solid #f3f4f6', paddingTop: 8 }}>
                  <button className="btn btn-sm" onClick={() => openEditCause(c)} style={{ padding: '2px 8px', fontSize: 11 }}>Edit</button>
                  <button className="btn btn-sm" onClick={() => toggleCause(c.id)} style={{ padding: '2px 8px', fontSize: 11 }}>
                    {c.is_active !== false ? 'Deactivate' : 'Activate'}
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => removeCause(c.id)} style={{ padding: '2px 8px', fontSize: 11 }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
