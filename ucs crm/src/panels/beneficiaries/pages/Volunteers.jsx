import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost } from '../store'

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  card: { background: 'var(--card-bg)', boxShadow: 'var(--shadow)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', overflow: 'hidden' },
  cardPadding: { background: 'var(--card-bg)', boxShadow: 'var(--shadow)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', padding: '20px', marginBottom: '16px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid var(--line)', fontWeight: 600, color: 'var(--ink-soft)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', background: 'var(--bg)' },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--bg)', color: 'var(--ink)' },
  pill: (bg, fg) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: bg, color: fg }),
  btn: { padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500 },
  input: { padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', fontSize: '13px', outline: 'none' },
  select: { padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', fontSize: '13px', outline: 'none', background: 'var(--card-bg)' },
  field: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontSize: '12px', fontWeight: 600, color: 'var(--ink)' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  link: { color: 'var(--sage)', textDecoration: 'none', cursor: 'pointer', fontWeight: 500 },
}

const STATUS_COLORS = {
  ACTIVE: ['#dcfce7', '#166534'],
  INACTIVE: ['var(--bg)', 'var(--ink-soft)'],
  ON_LEAVE: ['#fef3c7', '#92400e'],
}

export default function VolunteersPage() {
  const [volunteers, setVolunteers] = useState({ data: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    name: '',
    mobile: '',
    email: '',
    skills: '',
    status: 'ACTIVE',
  })

  const loadVolunteers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const result = await apiGet(`/programs/volunteers/all?${params}`)
      setVolunteers(result)
    } catch (e) {
      console.error('Failed to load volunteers:', e)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { loadVolunteers() }, [loadVolunteers])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name) return
    setSaving(true)
    try {
      await apiPost('/programs/volunteers', form)
      setForm({ name: '', mobile: '', email: '', skills: '', status: 'ACTIVE' })
      setShowForm(false)
      loadVolunteers()
    } catch (e) {
      alert('Error: ' + (e.message || 'Failed to create volunteer'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={styles.header}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Volunteers</h2>
        <button onClick={() => setShowForm(!showForm)} style={{ ...styles.btn, background: showForm ? 'var(--bg)' : 'var(--sage)', color: showForm ? 'var(--ink)' : '#fff' }}>
          {showForm ? 'Cancel' : '+ New Volunteer'}
        </button>
      </div>

      {showForm && (
        <div style={styles.cardPadding}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '16px' }}>Add Volunteer</h3>
          <form onSubmit={handleSubmit}>
            <div style={styles.grid}>
              <div style={styles.field}>
                <label style={styles.label}>Name *</label>
                <input style={styles.input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Full name" />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Mobile</label>
                <input style={styles.input} value={form.mobile} onChange={e => set('mobile', e.target.value)} placeholder="Mobile number" />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Email</label>
                <input type="email" style={styles.input} value={form.email} onChange={e => set('email', e.target.value)} placeholder="Email address" />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Status</label>
                <select style={styles.select} value={form.status} onChange={e => set('status', e.target.value)}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="ON_LEAVE">On Leave</option>
                </select>
              </div>
              <div style={{ ...styles.field, gridColumn: 'span 2' }}>
                <label style={styles.label}>Skills</label>
                <input style={styles.input} value={form.skills} onChange={e => set('skills', e.target.value)} placeholder="e.g. First Aid, Cooking, Teaching" />
              </div>
            </div>
            <div style={{ marginTop: '16px' }}>
              <button type="submit" disabled={saving || !form.name} style={{ ...styles.btn, background: 'var(--sage)', color: '#fff', opacity: saving || !form.name ? 0.5 : 1 }}>
                {saving ? 'Creating...' : 'Add Volunteer'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search volunteers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...styles.input, minWidth: '280px' }}
        />
        <span style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>{volunteers.total || 0} volunteers</span>
      </div>

      <div style={styles.card}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-soft)' }}>Loading...</div>
        ) : volunteers.data?.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-soft)' }}>No volunteers found</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Mobile</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Skills</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Programs</th>
              </tr>
            </thead>
            <tbody>
              {volunteers.data?.map((v) => {
                const [bg, fg] = STATUS_COLORS[v.status] || ['var(--bg)', 'var(--ink-soft)']
                const programCount = v.programs_count || v.assigned_programs?.length || 0
                return (
                  <tr key={v.id}>
                    <td style={styles.td}><span style={{ fontWeight: 500 }}>{v.name}</span></td>
                    <td style={styles.td}>{v.mobile || '-'}</td>
                    <td style={styles.td}>{v.email || '-'}</td>
                    <td style={styles.td}>
                      {v.skills ? (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {v.skills.split(',').map((s, i) => (
                            <span key={i} style={styles.pill('#dbeafe', '#1e40af')}>{s.trim()}</span>
                          ))}
                        </div>
                      ) : '-'}
                    </td>
                    <td style={styles.td}><span style={styles.pill(bg, fg)}>{v.status}</span></td>
                    <td style={styles.td}>
                      <span style={styles.pill('#dbeafe', '#1e40af')}>{programCount} assigned</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
