import { useState, useEffect } from 'react'
import { api } from '../api/auth'

export default function DataManagement() {
  const [tab, setTab] = useState('import')
  const [sources, setSources] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [edit, setEdit] = useState(null)
  const [form, setForm] = useState({ name: '' })
  const [err, setErr] = useState('')

  const [dataSources, setDataSources] = useState([])
  const [batches, setBatches] = useState([])
  const [selectedBatch, setSelectedBatch] = useState(null)

  const [date, setDate] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [dataSourceId, setDataSourceId] = useState('')
  const [file, setFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [sheets, setSheets] = useState([])
  const [selectedSheets, setSelectedSheets] = useState({})
  const [inspecting, setInspecting] = useState(false)

  const [oldFile, setOldFile] = useState(null)
  const [oldDate, setOldDate] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [oldDataSourceId, setOldDataSourceId] = useState('')
  const [oldImporting, setOldImporting] = useState(false)
  const [oldResult, setOldResult] = useState(null)
  const [oldSheets, setOldSheets] = useState([])
  const [oldSelectedSheets, setOldSelectedSheets] = useState({})

  const loadSources = () => {
    api('/data-sources').then(setSources).catch(e => setErr(e.message))
  }
  useEffect(() => {
    loadSources()
    api('/data-sources').then(setDataSources).catch(e => setErr(e.message))
    api('/data-import/batches').then(setBatches).catch(() => {})
  }, [])

  const loadBatches = () => {
    api('/data-import/batches').then(setBatches).catch(() => {})
  }

  const openNew = () => { setEdit(null); setForm({ name: '' }); setShowForm(true) }
  const openEdit = (s) => { setEdit(s); setForm({ name: s.name }); setShowForm(true) }

  const save = async () => {
    setErr('')
    try {
      if (edit) {
        await api(`/data-sources/${edit.id}`, { method: 'PUT', body: JSON.stringify(form) })
      } else {
        await api('/data-sources', { method: 'POST', body: JSON.stringify(form) })
      }
      setShowForm(false); loadSources()
    } catch (e) { setErr(e.message) }
  }

  const toggleActive = async (id) => {
    try { await api(`/data-sources/${id}/toggle`, { method: 'PUT' }); loadSources() }
    catch (e) { setErr(e.message) }
  }

  const remove = async (id) => {
    if (!confirm('Delete this data source?')) return
    try { await api(`/data-sources/${id}`, { method: 'DELETE' }); loadSources() }
    catch (e) { setErr(e.message) }
  }

  const inspectFile = async (file, setSheetsFn, setSelectedSheetsFn) => {
    if (!file) return
    setInspecting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api('/data-import/inspect', { method: 'POST', body: fd })
      setSheetsFn(res.sheets)
      const all = {}
      res.sheets.forEach(s => { all[s] = true })
      setSelectedSheetsFn(all)
    } catch {
      setSheetsFn([])
      setSelectedSheetsFn({})
    } finally { setInspecting(false) }
  }

  const handleFileChange = (e) => {
    const f = e.target.files[0]; setFile(f); setResult(null)
    inspectFile(f, setSheets, setSelectedSheets)
  }
  const toggleSheet = (name) => setSelectedSheets(prev => ({ ...prev, [name]: !prev[name] }))

  const handleImport = async () => {
    if (!file || !date || !dataSourceId) return
    setImporting(true); setErr(''); setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file); fd.append('date', date); fd.append('data_source_id', dataSourceId)
      const selected = Object.entries(selectedSheets).filter(([, v]) => v).map(([k]) => k)
      if (selected.length > 0 && selected.length < sheets.length) selected.forEach(s => fd.append('sheets', s))
      const res = await api('/data-import/upload', { method: 'POST', body: fd })
      setResult(res); loadBatches()
    } catch (e) { setErr(e.message) } finally { setImporting(false) }
  }

  const viewBatch = async (id) => {
    try { const d = await api(`/data-import/batch/${id}`); setSelectedBatch(d) }
    catch (e) { setErr(e.message) }
  }

  const exportBatch = async (id) => {
    try { const res = await api(`/data-import/batch/${id}/export`, { raw: true }); const blob = await res.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `import-batch-${id}.xlsx`; a.click() }
    catch (e) { setErr(e.message) }
  }

  const downloadSample = async () => {
    try { const res = await api('/data-import/sample', { raw: true }); const blob = await res.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'data-import-sample.xlsx'; a.click() }
    catch (e) { setErr(e.message) }
  }
  const downloadTestSheet = async () => {
    try { const res = await api('/data-import/test-sheet', { raw: true }); const blob = await res.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'data-import-test.xlsx'; a.click() }
    catch (e) { setErr(e.message) }
  }

  const handleOldFileChange = (e) => {
    const f = e.target.files[0]; setOldFile(f); setOldResult(null)
    inspectFile(f, setOldSheets, setOldSelectedSheets)
  }
  const toggleOldSheet = (name) => setOldSelectedSheets(prev => ({ ...prev, [name]: !prev[name] }))

  const handleOldImport = async () => {
    if (!oldFile || !oldDate || !oldDataSourceId) return
    setOldImporting(true); setErr(''); setOldResult(null)
    try {
      const fd = new FormData(); fd.append('file', oldFile); fd.append('date', oldDate); fd.append('data_source_id', oldDataSourceId)
      const selected = Object.entries(oldSelectedSheets).filter(([, v]) => v).map(([k]) => k)
      if (selected.length > 0 && selected.length < oldSheets.length) selected.forEach(s => fd.append('sheets', s))
      const res = await api('/data-import/upload-old', { method: 'POST', body: fd })
      setOldResult(res)
    } catch (e) { setErr(e.message) } finally { setOldImporting(false) }
  }

  if (selectedBatch) {
    return (
      <div className="sa-page">
        <div className="sa-page-header">
          <button className="btn" onClick={() => setSelectedBatch(null)}>← Back to batches</button>
          <h3 style={{margin:'8px 0 0'}}>Batch: {selectedBatch.import_batch_id?.slice(0, 8)}…</h3>
        </div>
        <div className="sa-card">
          <p className="sa-muted">Source: {selectedBatch.data_source_name} | Date: {selectedBatch.import_date} | Records: {selectedBatch.records?.length || 0}</p>
        </div>
        <div className="sa-card" style={{overflowX:'auto'}}>
          <table className="sa-table" style={{fontSize:12}}>
            <thead><tr><th>#</th><th>Name</th><th>Mobile</th><th>Category</th><th>Amount</th><th>Transaction Date</th><th>Bank Donor</th><th>City</th><th>PAN</th></tr></thead>
            <tbody>
              {(selectedBatch.records || []).map((r, i) => (
                <tr key={r.id}>
                  <td>{i + 1}</td><td>{r.name || '—'}</td><td><code>{r.mobile_number}</code></td>
                  <td><span className="sa-badge">{r.category}</span></td>
                  <td>₹{Number(r.amount).toLocaleString()}</td>
                  <td className="sa-muted">{r.transaction_date || '—'}</td>
                  <td className="sa-muted">{r.bank_donor_name || '—'}</td>
                  <td className="sa-muted">{r.city || '—'}</td>
                  <td className="sa-muted">{r.pan_number || '—'}</td>
                </tr>
              ))}
              {(selectedBatch.records || []).length === 0 && <tr><td colSpan={9} className="sa-muted sa-center">No records</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="sa-page">
      <div className="sa-page-header"><h3>Data Management</h3></div>
      {err && <div className="sa-err-card">{err}</div>}

      <div className="sa-tabs">
        <button className={`sa-tab${tab === 'sources' ? ' active' : ''}`} onClick={() => setTab('sources')}>Data Sources</button>
        <button className={`sa-tab${tab === 'import' ? ' active' : ''}`} onClick={() => setTab('import')}>Import</button>
        <button className={`sa-tab${tab === 'history' ? ' active' : ''}`} onClick={() => { setTab('history'); loadBatches() }}>History ({batches.length})</button>
        <button className={`sa-tab${tab === 'old' ? ' active' : ''}`} onClick={() => setTab('old')}>Old Data</button>
      </div>

      {tab === 'sources' && (
        <div className="sa-card" style={{overflowX:'auto'}}>
          <div className="sa-page-header" style={{marginBottom:12}}>
            <h3 className="sa-card-title">Data Source Management</h3>
            <button className="btn btn-primary btn-sm" onClick={openNew}>+ New Data Source</button>
          </div>
          <table className="sa-table">
            <thead><tr><th>Name</th><th>Status</th><th>Created</th><th style={{width:200}}></th></tr></thead>
            <tbody>
              {sources.map(s => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td><span className={`sa-badge ${s.is_active !== false ? 'active' : 'inactive'}`}>{s.is_active !== false ? 'Active' : 'Inactive'}</span></td>
                  <td className="sa-muted">{s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => openEdit(s)}>Edit</button>
                    <button className="btn btn-sm" style={{marginLeft:4}} onClick={() => toggleActive(s.id)}>{s.is_active !== false ? 'Deactivate' : 'Activate'}</button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(s.id)} style={{marginLeft:4}}>Del</button>
                  </td>
                </tr>
              ))}
              {sources.length === 0 && <tr><td colSpan={4} className="sa-muted sa-center">No data sources</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="sa-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="sa-modal" onClick={e => e.stopPropagation()}>
            <h3>{edit ? 'Edit Data Source' : 'New Data Source'}</h3>
            <label className="field">Name <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></label>
            <div className="sa-modal-actions">
              <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'import' && (
        <>
          <div className="sa-card">
            <h3 className="sa-card-title">Upload Data</h3>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <label className="field">Import Date <input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
              <label className="field">Data Source
                <select value={dataSourceId} onChange={e => setDataSourceId(e.target.value)}>
                  <option value="">— Select —</option>
                  {dataSources.map(ds => <option key={ds.id} value={ds.id}>{ds.name}</option>)}
                </select>
              </label>
              <label className="field">Excel / CSV File <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} /></label>
              {inspecting && <p className="sa-muted" style={{fontSize:12}}>Inspecting file...</p>}
              {sheets.length > 0 && (
                <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}>
                  <span style={{fontSize:12,color:'var(--ink-soft)',fontWeight:500}}>Sheets:</span>
                  {sheets.map(s => (
                    <label key={s} style={{display:'flex',alignItems:'center',gap:4,cursor:'pointer',fontSize:13,
                      background:selectedSheets[s]?'var(--primary-light, #eef2ff)':'#f5f5f5',padding:'4px 10px',borderRadius:6,border:'1px solid var(--line, #e5e7eb)'}}>
                      <input type="checkbox" checked={!!selectedSheets[s]} onChange={() => toggleSheet(s)} />{s}
                    </label>
                  ))}
                </div>
              )}
              <div className="sa-filters" style={{marginTop:8}}>
                <button className="btn btn-primary" onClick={handleImport} disabled={importing || !file || !dataSourceId}>
                  {importing ? 'Importing…' : 'Upload & Import'}
                </button>
                <button className="btn" onClick={downloadSample}>Download Sample</button>
                <button className="btn" onClick={downloadTestSheet}>Download Test Sheet</button>
              </div>
            </div>
          </div>
          {result && (
            <div className="sa-card">
              <h3 className="sa-card-title" style={{color:'#10b981'}}>Import Complete</h3>
              <div className="sa-stat-grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))'}}>
                <div className="sa-stat-card"><div className="sa-stat-label">Total in File</div><div className="sa-stat-value">{result.total_in_file}</div></div>
                <div className="sa-stat-card" style={{borderLeftColor:'#f59e0b'}}><div className="sa-stat-label">Within-File Dups Removed</div><div className="sa-stat-value" style={{color:'#f59e0b'}}>{result.duplicates_removed}</div></div>
                <div className="sa-stat-card" style={{borderLeftColor:'#eab308'}}><div className="sa-stat-label">Cross-Batch Dups Removed</div><div className="sa-stat-value" style={{color:'#eab308'}}>{result.cross_batch_duplicates_removed}</div></div>
                <div className="sa-stat-card" style={{borderLeftColor:'#10b981'}}><div className="sa-stat-label">Imported</div><div className="sa-stat-value" style={{color:'#10b981'}}>{result.imported}</div></div>
                <div className="sa-stat-card" style={{borderLeftColor:'#3b82f6'}}><div className="sa-stat-label">NGOs Replicated To</div><div className="sa-stat-value" style={{color:'#3b82f6'}}>{result.ngos_used}</div></div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'history' && (
        <div className="sa-card" style={{overflowX:'auto'}}>
          <table className="sa-table">
            <thead><tr><th>Date</th><th>Source</th><th>Records</th><th>Imported At</th><th style={{width:120}}></th></tr></thead>
            <tbody>
              {batches.map(b => (
                <tr key={b.import_batch_id}>
                  <td>{b.import_date}</td><td>{b.data_source_name}</td><td>{b.record_count}</td>
                  <td className="sa-muted">{b.created_at ? new Date(b.created_at).toLocaleString() : '—'}</td>
                  <td><button className="btn btn-sm" onClick={() => viewBatch(b.import_batch_id)}>View</button>
                  <button className="btn btn-sm" onClick={() => exportBatch(b.import_batch_id)} style={{marginLeft:4}}>Export</button></td>
                </tr>
              ))}
              {batches.length === 0 && <tr><td colSpan={5} className="sa-muted sa-center">No imports yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'old' && (
        <>
          <div className="sa-card">
            <h3 className="sa-card-title">Upload Old Donor Data</h3>
            <p className="sa-muted" style={{marginBottom:12}}>Each row creates a new donor profile entry. Duplicate mobile numbers are allowed.</p>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <label className="field">Import Date <input type="date" value={oldDate} onChange={e => setOldDate(e.target.value)} /></label>
              <label className="field">Data Source
                <select value={oldDataSourceId} onChange={e => setOldDataSourceId(e.target.value)}>
                  <option value="">— Select —</option>
                  {dataSources.map(ds => <option key={ds.id} value={ds.id}>{ds.name}</option>)}
                </select>
              </label>
              <label className="field">Excel / CSV File <input type="file" accept=".xlsx,.xls,.csv" onChange={handleOldFileChange} /></label>
              {inspecting && <p className="sa-muted" style={{fontSize:12}}>Inspecting file...</p>}
              {oldSheets.length > 0 && (
                <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}>
                  <span style={{fontSize:12,color:'var(--ink-soft)',fontWeight:500}}>Sheets:</span>
                  {oldSheets.map(s => (
                    <label key={s} style={{display:'flex',alignItems:'center',gap:4,cursor:'pointer',fontSize:13,
                      background:oldSelectedSheets[s]?'var(--primary-light, #eef2ff)':'#f5f5f5',padding:'4px 10px',borderRadius:6,border:'1px solid var(--line, #e5e7eb)'}}>
                      <input type="checkbox" checked={!!oldSelectedSheets[s]} onChange={() => toggleOldSheet(s)} />{s}
                    </label>
                  ))}
                </div>
              )}
              <div className="sa-filters" style={{marginTop:8}}>
                <button className="btn btn-primary" onClick={handleOldImport} disabled={oldImporting || !oldFile || !oldDataSourceId}>
                  {oldImporting ? 'Importing…' : 'Upload & Import'}
                </button>
                <button className="btn" onClick={downloadTestSheet}>Download Test Sheet</button>
              </div>
            </div>
          </div>
          {oldResult && (
            <div className="sa-card">
              <h3 className="sa-card-title" style={{color:'#10b981'}}>Import Complete</h3>
              <div className="sa-stat-grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))'}}>
                <div className="sa-stat-card"><div className="sa-stat-label">Total in File</div><div className="sa-stat-value">{oldResult.total_in_file}</div></div>
                <div className="sa-stat-card" style={{borderLeftColor:'#eab308'}}><div className="sa-stat-label">Cross-Batch Dups Removed</div><div className="sa-stat-value" style={{color:'#eab308'}}>{oldResult.cross_batch_duplicates_removed}</div></div>
                <div className="sa-stat-card" style={{borderLeftColor:'#10b981'}}><div className="sa-stat-label">Imported to Donors</div><div className="sa-stat-value" style={{color:'#10b981'}}>{oldResult.imported}</div></div>
              </div>
              {oldResult.errors?.length > 0 && <div style={{marginTop:12}}><p className="sa-muted">{oldResult.errors.length} rows failed</p></div>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
