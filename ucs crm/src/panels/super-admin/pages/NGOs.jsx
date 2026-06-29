import { useState, useEffect } from 'react'
import { api } from '../api/auth'

export default function NGOs() {
  const [ngos, setNgos] = useState([])
  const [users, setUsers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [edit, setEdit] = useState(null)
  const [form, setForm] = useState({ name: '', code: '', address: '', registration_no: '' })
  const [err, setErr] = useState('')
  const [assignNgo, setAssignNgo] = useState(null)
  const [assignForm, setAssignForm] = useState({ name: '', email: '', password: '123456', role: 'hoadmin' })
  const [assignErr, setAssignErr] = useState('')

  useEffect(() => {
    let mounted = true;
    api('/ngos').then(data => { if (mounted) setNgos(data); }).catch(e => { if (mounted) setErr(e.message); })
    api('/users').then(data => { if (mounted) setUsers(data); }).catch(() => {})
    return () => { mounted = false; };
  }, [])

  const openNew = () => { setEdit(null); setForm({ name: '', code: '', address: '', registration_no: '' }); setShowForm(true) }
  const openEdit = (n) => { setEdit(n); setForm({ name: n.name, code: n.code, address: n.address || '', registration_no: n.registration_no || '' }); setShowForm(true) }

  const save = async () => {
    setErr('')
    try {
      if (edit) {
        await api(`/ngos/${edit.id}`, { method: 'PUT', body: JSON.stringify(form) })
      } else {
        await api('/ngos', { method: 'POST', body: JSON.stringify(form) })
      }
      setShowForm(false); load()
    } catch (e) { setErr(e.message) }
  }

  const toggleActive = async (id) => {
    try { await api(`/ngos/${id}/toggle`, { method: 'PUT' }); load() }
    catch (e) { setErr(e.message) }
  }

  const remove = async (id) => {
    if (!confirm('Delete this NGO?')) return
    try { await api(`/ngos/${id}`, { method: 'DELETE' }); load() }
    catch (e) { setErr(e.message) }
  }

  const openAssign = async (ngo) => {
    setAssignNgo(ngo)
    setAssignForm({ name: '', email: '', password: '123456', role: 'hoadmin' })
    setAssignErr('')
  }

  const assignUser = async () => {
    setAssignErr('')
    try {
      await api('/users', {
        method: 'POST',
        body: JSON.stringify({ ...assignForm, ngo_id: assignNgo.id })
      })
      setAssignNgo(null)
      load()
    } catch (e) { setAssignErr(e.message) }
  }

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <h3>NGO Management</h3>
        <button className="btn btn-primary" onClick={openNew}>+ New NGO</button>
      </div>
      {err && <div className="sa-err-card">{err}</div>}

      {showForm && (
        <div className="sa-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="sa-modal" onClick={e => e.stopPropagation()}>
            <h3>{edit ? 'Edit NGO' : 'New NGO'}</h3>
            <label className="field">Name <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></label>
            <label className="field">Code <input value={form.code} onChange={e => setForm({...form, code: e.target.value})} /></label>
            <label className="field">Registration No. <input value={form.registration_no} onChange={e => setForm({...form, registration_no: e.target.value})} /></label>
            <label className="field">Address <textarea value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></label>
            <div className="sa-modal-actions">
              <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}

      {assignNgo && (
        <div className="sa-modal-overlay" onClick={() => setAssignNgo(null)}>
          <div className="sa-modal" onClick={e => e.stopPropagation()}>
            <h3>Assign User to {assignNgo.name}</h3>
            {assignErr && <div className="sa-err-card">{assignErr}</div>}

            <h4 style={{margin:'12px 0 8px',fontSize:13,color:'var(--text-soft)'}}>Existing users for this NGO:</h4>
            {users.filter(u => u.ngo_id === assignNgo.id).length === 0 ? (
              <p className="sa-muted" style={{marginBottom:12}}>No users assigned yet</p>
            ) : (
              <table className="sa-table" style={{marginBottom:16}}>
                <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
                <tbody>
                  {users.filter(u => u.ngo_id === assignNgo.id).map(u => (
                    <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td><span className="sa-badge">{u.role}</span></td></tr>
                  ))}
                </tbody>
              </table>
            )}

            <h4 style={{margin:'12px 0 8px',fontSize:13,color:'var(--text-soft)'}}>Add new user:</h4>
            <label className="field">Name <input value={assignForm.name} onChange={e => setAssignForm({...assignForm, name: e.target.value})} /></label>
            <label className="field">Email <input type="email" value={assignForm.email} onChange={e => setAssignForm({...assignForm, email: e.target.value})} /></label>
            <label className="field">Role
              <select value={assignForm.role} onChange={e => setAssignForm({...assignForm, role: e.target.value})}>
                <option value="hoadmin">HO Admin</option>
                <option value="accounts">Accounts</option>
                <option value="leads">Leads</option>
                <option value="recruiter">Recruiter</option>
                <option value="telecaller">Telecaller</option>
                <option value="team_lead">Team Lead</option>
                <option value="hr">HR</option>
              </select>
            </label>
            <div className="sa-modal-actions">
              <button className="btn" onClick={() => setAssignNgo(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={assignUser}>Add User</button>
            </div>
          </div>
        </div>
      )}

      <div className="sa-card">
        <table className="sa-table">
          <thead><tr><th>Name</th><th>Code</th><th>Reg. No.</th><th>Address</th><th>Status</th><th style={{width:180}}></th></tr></thead>
          <tbody>
            {ngos.map(n => (
              <tr key={n.id}>
                <td>{n.name}</td>
                <td><code>{n.code}</code></td>
                <td className="sa-muted">{n.registration_no || '—'}</td>
                <td className="sa-muted">{n.address || '—'}</td>
                <td><span className={`sa-badge ${n.is_active !== false ? 'active' : 'inactive'}`}>
                  {n.is_active !== false ? 'Active' : 'Inactive'}
                </span></td>
                <td>
                  <button className="btn btn-sm" onClick={() => openEdit(n)}>Edit</button>
                  <button className="btn btn-sm" style={{marginLeft:4}} onClick={() => toggleActive(n.id)}>
                    {n.is_active !== false ? 'Deactivate' : 'Activate'}
                  </button>
                  <button className="btn btn-sm" style={{marginLeft:4}} onClick={() => openAssign(n)}>Admins</button>
                  <button className="btn btn-sm btn-danger" onClick={() => remove(n.id)} style={{marginLeft:4}}>Del</button>
                </td>
              </tr>
            ))}
            {ngos.length === 0 && <tr><td colSpan={6} className="sa-muted sa-center">No NGOs yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
