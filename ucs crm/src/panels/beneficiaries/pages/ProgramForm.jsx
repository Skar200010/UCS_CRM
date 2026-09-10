import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useBnfBase } from '../bnfUi'
import { apiGet, apiPost, apiPatch } from '../store'

const styles = {
  card: { background: 'var(--card-bg)', boxShadow: 'var(--shadow)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', padding: '24px', marginBottom: '16px' },
  title: { fontSize: '18px', fontWeight: 700, color: 'var(--ink)', marginBottom: '16px' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontSize: '12px', fontWeight: 600, color: 'var(--ink)' },
  input: { padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', fontSize: '13px', outline: 'none' },
  select: { padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', fontSize: '13px', outline: 'none', background: 'var(--card-bg)' },
  textarea: { padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', fontSize: '13px', outline: 'none', minHeight: '80px', resize: 'vertical' },
  btn: { padding: '10px 20px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 500 },
  btnPrimary: { background: 'var(--sage)', color: '#fff' },
  btnSecondary: { background: 'var(--bg)', color: 'var(--ink)' },
  alert: (type) => ({
    padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '13px', marginBottom: '16px',
    background: type === 'error' ? '#fee2e2' : '#dcfce7',
    color: type === 'error' ? '#991b1b' : '#166534',
  }),
}

const STATUSES = ['DRAFT', 'PLANNED', 'APPROVED', 'ONGOING', 'COMPLETED', 'CANCELLED']

export default function ProgramForm() {
  const navigate = useNavigate()
  const base = useBnfBase()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: '',
    program_date: '',
    start_time: '',
    end_time: '',
    description: '',
    location_name: '',
    status: 'DRAFT',
  })

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  useEffect(() => {
    if (isEdit) {
      apiGet(`/programs/${id}`).then(data => {
        setForm(f => ({
          ...f,
          title: data.title || '',
          program_date: data.program_date || '',
          start_time: data.start_time || '',
          end_time: data.end_time || '',
          description: data.description || '',
          location_name: data.location_name || '',
          status: data.status || 'DRAFT',
        }))
      }).catch(e => setError(e.message || 'Failed to load program'))
    }
  }, [id, isEdit])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title) { setError('Title is required'); return }
    setSaving(true)
    setError('')
    try {
      let result
      if (isEdit) {
        result = await apiPatch(`/programs/${id}`, form)
      } else {
        result = await apiPost('/programs', form)
      }
      navigate(base + `/programs/${result.program?.id || result.id || id}`)
    } catch (e) {
      setError(e.message || 'Failed to save program')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <button onClick={() => navigate(base + '/programs')} style={{ background: 'none', border: 'none', color: 'var(--sage)', cursor: 'pointer', fontSize: '13px', marginBottom: '4px' }}>← Back to programs</button>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>{isEdit ? 'Edit Program' : 'New Program'}</h2>
        </div>
      </div>

      {error && <div style={styles.alert('error')}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div style={styles.card}>
          <div style={styles.title}>Program Details</div>
          <div style={styles.grid}>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Title *</label>
              <input style={styles.input} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Program title" />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Program Date</label>
              <input type="date" style={styles.input} value={form.program_date} onChange={e => set('program_date', e.target.value)} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Status</label>
              <select style={styles.select} value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Start Time</label>
              <input type="time" style={styles.input} value={form.start_time} onChange={e => set('start_time', e.target.value)} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>End Time</label>
              <input type="time" style={styles.input} value={form.end_time} onChange={e => set('end_time', e.target.value)} />
            </div>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Location</label>
              <input style={styles.input} value={form.location_name} onChange={e => set('location_name', e.target.value)} placeholder="Location name" />
            </div>
            <div style={{ ...styles.field, gridColumn: 'span 2' }}>
              <label style={styles.label}>Description</label>
              <textarea style={styles.textarea} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Program description" />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" onClick={() => navigate(base + '/programs')} style={{ ...styles.btn, ...styles.btnSecondary }}>Cancel</button>
          <button type="submit" disabled={saving} style={{ ...styles.btn, ...styles.btnPrimary, opacity: saving ? 0.5 : 1 }}>
            {saving ? 'Saving...' : isEdit ? 'Update Program' : 'Create Program'}
          </button>
        </div>
      </form>
    </div>
  )
}
