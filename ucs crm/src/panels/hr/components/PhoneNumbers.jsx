import { useState, useEffect, useMemo } from 'react'
import { useHR } from '../store'

export default function PhoneNumbers() {
  const { fetchWorkers, bulkUpdateWorkers } = useHR()
  const [workers, setWorkers] = useState([])
  const [edits, setEdits] = useState({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    fetchWorkers().then(setWorkers).catch(() => {})
  }, [])

  const changeCount = Object.keys(edits).length

  const handleSave = async () => {
    const payload = Object.entries(edits).map(([id, phone]) => ({ id, phone }))
    if (payload.length === 0) return
    setSaving(true)
    setMessage(null)
    try {
      await bulkUpdateWorkers(payload)
      setEdits({})
      setMessage({ type: 'success', text: `${payload.length} workers updated successfully` })
      fetchWorkers().then(setWorkers).catch(() => {})
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Update failed' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="stats">
        <div className="stat">
          <div className="stat-num">{workers.length}</div>
          <div className="stat-lbl">Total Workers</div>
        </div>
        <div className="stat">
          <div className="stat-num">{workers.filter(w => !w.phone).length}</div>
          <div className="stat-lbl">Missing Phone</div>
        </div>
        <div className="stat">
          <div className="stat-num">{changeCount}</div>
          <div className="stat-lbl">Unsaved Changes</div>
        </div>
      </div>

      {message && (
        <div style={{ background: message.type === 'success' ? '#d1fae5' : '#fee2e2', color: message.type === 'success' ? '#065f46' : '#991b1b', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
          {message.text}
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h3>Phone Numbers</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="count">{workers.length} workers</span>
            {changeCount > 0 && (
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : `Save ${changeCount} Change${changeCount > 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Department</th>
                <th>Current Phone</th>
                <th>New Phone</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w, i) => (
                <tr key={w.id}>
                  <td style={{ color: 'var(--ink-soft)', fontSize: 12 }}>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{w.name}</td>
                  <td>{w.department || '—'}</td>
                  <td>
                    <span style={w.phone ? {} : { color: 'var(--danger)', fontStyle: 'italic' }}>
                      {w.phone || 'Missing'}
                    </span>
                  </td>
                  <td>
                    <input
                      type="tel"
                      placeholder={w.phone || 'Enter phone'}
                      value={edits[w.id] ?? w.phone ?? ''}
                      onChange={e => {
                        const val = e.target.value
                        setEdits(prev => {
                          const next = { ...prev }
                          if (val === (w.phone ?? '')) delete next[w.id]
                          else next[w.id] = val
                          return next
                        })
                      }}
                      style={{
                        width: 160,
                        padding: '4px 8px',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        fontSize: 13,
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
