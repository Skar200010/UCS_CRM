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
  alert: (type) => ({
    padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '13px', marginBottom: '16px',
    background: type === 'error' ? '#fee2e2' : '#dcfce7',
    color: type === 'error' ? '#991b1b' : '#166534',
  }),
}

const CATEGORIES = ['FOOD', 'CLOTHING', 'MEDICAL', 'EDUCATION', 'HOUSING', 'SKILL_TRAINING', 'ASSISTIVE_DEVICE', 'FINANCIAL', 'OTHER']

export default function Benefits() {
  const [benefits, setBenefits] = useState({ data: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    name: '',
    category: 'OTHER',
    description: '',
    is_active: true,
  })

  const loadBenefits = useCallback(async () => {
    setLoading(true)
    try {
      const result = await apiGet('/benefits')
      setBenefits(result)
    } catch (e) {
      console.error('Failed to load benefits:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadBenefits() }, [loadBenefits])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name) return
    setSaving(true)
    setMessage('')
    try {
      await apiPost('/benefits', form)
      setMessage('Benefit created successfully')
      setForm({ name: '', category: 'OTHER', description: '', is_active: true })
      setShowForm(false)
      loadBenefits()
    } catch (e) {
      setMessage('')
      alert('Error: ' + (e.message || 'Failed to create benefit'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={styles.header}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Benefits</h2>
        <button onClick={() => setShowForm(!showForm)} style={{ ...styles.btn, background: showForm ? 'var(--bg)' : 'var(--sage)', color: showForm ? 'var(--ink)' : '#fff' }}>
          {showForm ? 'Cancel' : '+ New Benefit'}
        </button>
      </div>

      {message && <div style={styles.alert('success')}>{message}</div>}

      {showForm && (
        <div style={styles.cardPadding}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '16px' }}>Create Benefit</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div style={styles.field}>
                <label style={styles.label}>Name *</label>
                <input style={styles.input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Benefit name" />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Category</label>
                <select style={styles.select} value={form.category} onChange={e => set('category', e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Description</label>
                <input style={styles.input} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Description" />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Active</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginTop: '4px' }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} /> Yes
                </label>
              </div>
            </div>
            <div style={{ marginTop: '16px' }}>
              <button type="submit" disabled={saving || !form.name} style={{ ...styles.btn, background: 'var(--sage)', color: '#fff', opacity: saving || !form.name ? 0.5 : 1 }}>
                {saving ? 'Creating...' : 'Create Benefit'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={styles.card}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-soft)' }}>Loading...</div>
        ) : benefits.data?.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-soft)' }}>No benefits found</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Description</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {benefits.data?.map((b) => (
                <tr key={b.id}>
                  <td style={styles.td}><span style={{ fontWeight: 500 }}>{b.name}</span></td>
                  <td style={styles.td}><span style={styles.pill('#dbeafe', '#1e40af')}>{(b.category || 'OTHER').replace(/_/g, ' ')}</span></td>
                  <td style={styles.td}>{b.description || '-'}</td>
                  <td style={styles.td}>
                    <span style={styles.pill(
                      b.is_active ? '#dcfce7' : 'var(--bg)',
                      b.is_active ? '#166534' : 'var(--ink-soft)'
                    )}>
                      {b.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
