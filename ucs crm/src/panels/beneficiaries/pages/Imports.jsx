import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, apiPatch } from '../store'

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  card: { background: 'var(--card-bg)', boxShadow: 'var(--shadow)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', overflow: 'hidden' },
  cardPadding: { background: 'var(--card-bg)', boxShadow: 'var(--shadow)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', padding: '24px', marginBottom: '16px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid var(--line)', fontWeight: 600, color: 'var(--ink-soft)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', background: 'var(--bg)' },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--bg)', color: 'var(--ink)' },
  pill: (bg, fg) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: bg, color: fg }),
  btn: { padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500 },
  input: { padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', fontSize: '13px', outline: 'none' },
  dropzone: (active) => ({
    border: `2px dashed ${active ? 'var(--sage)' : 'var(--line)'}`,
    borderRadius: 'var(--radius)',
    padding: '40px',
    textAlign: 'center',
    cursor: 'pointer',
    background: active ? '#eff6ff' : 'var(--bg)',
    transition: 'all 0.15s',
  }),
  alert: (type) => ({
    padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '13px', marginBottom: '16px',
    background: type === 'error' ? '#fee2e2' : type === 'warn' ? '#fef3c7' : '#dcfce7',
    color: type === 'error' ? '#991b1b' : type === 'warn' ? '#92400e' : '#166534',
  }),
}

const BATCH_STATUS_COLORS = {
  PENDING: ['#fef3c7', '#92400e'],
  VALIDATED: ['#dbeafe', '#1e40af'],
  IMPORTED: ['#dcfce7', '#166534'],
  FAILED: ['#fee2e2', '#991b1b'],
}

export default function Imports() {
  const [batches, setBatches] = useState({ data: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [step, setStep] = useState(1) // 1=upload, 2=preview/confirm

  const loadBatches = useCallback(async () => {
    setLoading(true)
    try {
      const result = await apiGet('/imports')
      setBatches(result)
    } catch (e) {
      console.error('Failed to load import batches:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadBatches() }, [loadBatches])

  const handleFile = async (file) => {
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setError('Please upload an Excel (.xlsx, .xls) or CSV file')
      return
    }
    setUploading(true)
    setError('')
    setMessage('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      await apiPost('/imports/upload', formData)
      setMessage('File uploaded successfully. Ready for validation.')
      setStep(2)
      loadBatches()
    } catch (e) {
      setError(e.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleConfirmImport = async (batchId) => {
    try {
      await apiPatch(`/imports/${batchId}/confirm`, {})
      setMessage('Import confirmed successfully')
      loadBatches()
    } catch (e) {
      setError(e.message || 'Import confirmation failed')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    handleFile(file)
  }

  return (
    <div>
      <div style={styles.header}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Data Import</h2>
      </div>

      {message && <div style={styles.alert('success')}>{message}</div>}
      {error && <div style={styles.alert('error')}>{error}</div>}

      <div style={styles.cardPadding}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '16px' }}>Upload File</h3>

        {step === 1 && (
          <div
            style={styles.dropzone(dragActive)}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('import-file-input')?.click()}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📁</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>
              {uploading ? 'Uploading...' : 'Drop your Excel file here or click to browse'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>Supports .xlsx, .xls, .csv</div>
            <input
              id="import-file-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
        )}

        {step === 2 && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '16px' }}>File uploaded. Review batches below.</div>
            <button onClick={() => setStep(1)} style={{ ...styles.btn, background: 'var(--bg)', color: 'var(--ink)' }}>Upload Another</button>
          </div>
        )}
      </div>

      <div style={styles.card}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--line)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Import Batches</h3>
        </div>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-soft)' }}>Loading...</div>
        ) : batches.data?.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-soft)' }}>No import batches found</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Batch #</th>
                <th style={styles.th}>File</th>
                <th style={styles.th}>Rows</th>
                <th style={styles.th}>Valid</th>
                <th style={styles.th}>Errors</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Created</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {batches.data?.map((b) => {
                const [bg, fg] = BATCH_STATUS_COLORS[b.status] || ['var(--bg)', 'var(--ink-soft)']
                return (
                  <tr key={b.id}>
                    <td style={styles.td}><code style={{ fontSize: '12px', background: 'var(--bg)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>{b.batch_number || b.id}</code></td>
                    <td style={styles.td}>{b.file_name || '-'}</td>
                    <td style={styles.td}>{b.total_rows || 0}</td>
                    <td style={styles.td}><span style={styles.pill('#dcfce7', '#166534')}>{b.valid_rows || 0}</span></td>
                    <td style={styles.td}><span style={styles.pill(b.error_rows > 0 ? '#fee2e2' : 'var(--bg)', b.error_rows > 0 ? '#991b1b' : 'var(--ink-soft)')}>{b.error_rows || 0}</span></td>
                    <td style={styles.td}><span style={styles.pill(bg, fg)}>{b.status}</span></td>
                    <td style={styles.td}>{b.created_at || '-'}</td>
                    <td style={styles.td}>
                      {b.status === 'VALIDATED' && (
                        <button onClick={() => handleConfirmImport(b.id)} style={{ ...styles.btn, background: '#dcfce7', color: '#166534', padding: '4px 10px', fontSize: '12px' }}>
                          Confirm
                        </button>
                      )}
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
