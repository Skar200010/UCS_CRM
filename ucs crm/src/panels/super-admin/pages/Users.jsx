import { useState, useEffect } from 'react'
import { api } from '../api/auth'

export default function Users() {
  const [users, setUsers] = useState([])
  const [hrs, setHrs] = useState([])
  const [ngos, setNgos] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [editingHr, setEditingHr] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', password: '123456', role: 'admin', ngo_ids: [] })
  const [err, setErr] = useState('')
  const [tab, setTab] = useState('users')
  const [filterRole, setFilterRole] = useState('')

  useEffect(() => {
    let mounted = true;
    api('/users').then(data => { if (mounted) setUsers(data); }).catch(e => { if (mounted) setErr(e.message); })
    api('/hrs').then(data => { if (mounted) setHrs(data); }).catch(() => {})
    api('/ngos').then(data => { if (mounted) setNgos(data); }).catch(() => {})
    return () => { mounted = false; };
  }, [])

  const openNew = () => {
    setEditingUser(null)
    setEditingHr(null)
    setForm({ name: '', email: '', password: '123456', role: 'admin', ngo_ids: [] })
    setShowForm(true)
  }

  const openEditUser = (u) => {
    setEditingUser(u)
    setEditingHr(null)
    setForm({
      name: u.name || '',
      email: u.email || '',
      password: '',
      role: u.role || 'admin',
      ngo_ids: u.role === 'admin' ? [] : (u.ngo_access || (u.ngo_id ? [u.ngo_id] : [])),
    })
    setShowForm(true)
  }

  const openEditHr = (h) => {
    setEditingHr(h)
    setEditingUser(null)
    setForm({
      name: h.name || '',
      email: h.email || '',
      password: '',
      role: 'hr',
      ngo_ids: h.ngo_id ? [h.ngo_id] : [],
    })
    setShowForm(true)
  }

  const toggleNgo = (id) => {
    setForm(prev => ({
      ...prev,
      ngo_ids: prev.ngo_ids.includes(id)
        ? prev.ngo_ids.filter(n => n !== id)
        : [...prev.ngo_ids, id]
    }))
  }

  const save = async () => {
    setErr('')
    try {
      if (editingUser) {
        const body = { ...form }
        if (!body.password) delete body.password
        await api(`/users/${editingUser.id}`, { method: 'PUT', body: JSON.stringify(body) })
      } else if (editingHr) {
        const body = { name: form.name, email: form.email, ngo_id: form.ngo_ids[0] || null }
        if (form.password) body.password = form.password
        await api(`/hrs/${editingHr.id}`, { method: 'PUT', body: JSON.stringify(body) })
      } else if (form.role === 'hr') {
        await api('/hrs', { method: 'POST', body: JSON.stringify({ name: form.name, email: form.email, ngo_id: form.ngo_ids[0] || null }) })
      } else {
        await api('/users', { method: 'POST', body: JSON.stringify(form) })
      }
      setShowForm(false); setEditingUser(null); setEditingHr(null); load()
    } catch (e) { setErr(e.message) }
  }

  const toggleActive = async (u) => {
    try {
      await api(`/users/${u.id}`, { method: 'PUT', body: JSON.stringify({ is_active: !u.is_active }) })
      load()
    } catch (e) { setErr(e.message) }
  }

  const toggleHrActive = async (h) => {
    try {
      await api(`/hrs/${h.id}`, { method: 'PUT', body: JSON.stringify({ is_active: !h.is_active }) })
      load()
    } catch (e) { setErr(e.message) }
  }

  const filteredUsers = filterRole
    ? users.filter(u => u.role === filterRole)
    : users

  const roles = [...new Set(users.map(u => u.role))]

  const closeForm = () => {
    setShowForm(false); setEditingUser(null); setEditingHr(null)
  }

  const isEditing = editingUser || editingHr
  const isUser = editingUser || (!editingHr && form.role !== 'hr')

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <h3>User Management</h3>
        <button className="btn btn-primary" onClick={openNew}>+ New User</button>
      </div>
      {err && <div className="sa-err-card">{err}</div>}

      {showForm && (
        <div className="sa-modal-overlay" onClick={closeForm}>
          <div className="sa-modal" onClick={e => e.stopPropagation()}>
            <h3>{isEditing ? 'Edit' : 'Create'} {isUser ? 'User' : 'HR'}</h3>

            {editingHr && (
              <p className="sa-muted" style={{ fontSize: 12, marginBottom: 12 }}>
                Leave password blank to keep current.
              </p>
            )}

            <label className="field">Name
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </label>
            <label className="field">Email
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            </label>
            <label className="field">Password
              <input value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                placeholder={isEditing ? 'Leave blank to keep current' : ''} />
            </label>

            {isUser && (
              <label className="field">Role
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  <option value="admin">HO Admin</option>
                  <option value="accounts">Accounts</option>
                  <option value="leads">Leads</option>
                  <option value="recruiter">Recruiter</option>
                  <option value="telecaller">Telecaller</option>
                  <option value="team_lead">Team Lead</option>
                  <option value="hr">HR</option>
                </select>
              </label>
            )}

            {form.role !== 'admin' && (
              <label className="field">
                <span>NGO</span>
                <select value={form.ngo_ids[0] || ''} onChange={e => setForm({...form, ngo_ids: e.target.value ? [e.target.value] : []})}>
                  <option value="">— None —</option>
                  {ngos.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </label>
            )}
            {form.role === 'admin' && !editingUser && (
              <p style={{fontSize:13,color:'var(--ink-soft)',marginTop:4}}>
                Admin has access to all NGOs automatically.
              </p>
            )}
            <div className="sa-modal-actions">
              <button className="btn" onClick={closeForm}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>{isEditing ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="sa-tabs">
        <button className={`sa-tab${tab === 'users' ? ' active' : ''}`} onClick={() => setTab('users')}>Users ({users.length})</button>
        <button className={`sa-tab${tab === 'hrs' ? ' active' : ''}`} onClick={() => setTab('hrs')}>HRs ({hrs.length})</button>
      </div>

      {tab === 'users' && (
        <div className="sa-card">
          <div style={{marginBottom:8}}>
            <select value={filterRole} onChange={e => setFilterRole(e.target.value)}>
              <option value="">All roles</option>
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <table className="sa-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>NGOs</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td><span className="sa-badge">{u.role}</span></td>
                  <td className="sa-muted" style={{maxWidth:200}}>{u.role === 'admin' ? 'All NGOs' : (u.ngo_names || (u.ngo_id ? ngos.find(n => n.id === u.ngo_id)?.name || u.ngo_id : '—'))}</td>
                  <td><span className={`sa-badge ${u.is_active !== false ? 'active' : 'inactive'}`}>
                    {u.is_active !== false ? 'Active' : 'Inactive'}
                  </span></td>
                  <td>
                    <button className="btn btn-sm" onClick={() => openEditUser(u)}
                      style={{marginRight:4}}>Edit</button>
                    <button className="btn btn-sm" onClick={() => toggleActive(u)}>
                      {u.is_active !== false ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && <tr><td colSpan={6} className="sa-muted sa-center">No users</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'hrs' && (
        <div className="sa-card">
          <table className="sa-table">
            <thead><tr><th>Name</th><th>Email</th><th>NGO</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {hrs.map(h => (
                <tr key={h.id}>
                  <td>{h.name}</td>
                  <td>{h.email}</td>
                  <td className="sa-muted">{h.ngo_id ? ngos.find(n => n.id === h.ngo_id)?.name || h.ngo_id : '—'}</td>
                  <td><span className={`sa-badge ${h.is_active !== false ? 'active' : 'inactive'}`}>
                    {h.is_active !== false ? 'Active' : 'Inactive'}
                  </span></td>
                  <td>
                    <button className="btn btn-sm" onClick={() => openEditHr(h)}
                      style={{marginRight:4}}>Edit</button>
                    <button className="btn btn-sm" onClick={() => toggleHrActive(h)}>
                      {h.is_active !== false ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
              {hrs.length === 0 && <tr><td colSpan={5} className="sa-muted sa-center">No HRs</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
