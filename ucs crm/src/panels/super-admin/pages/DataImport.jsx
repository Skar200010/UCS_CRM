import { useState, useEffect } from 'react'
import { api } from '../api/auth'

export default function DataImport() {
  const [tab, setTab] = useState('import')
  const [dataSources, setDataSources] = useState([])
  const [batches, setBatches] = useState([])
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [err, setErr] = useState('')

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
  const [ngos, setNgos] = useState([])
  const [selectedNgoIds, setSelectedNgoIds] = useState([])

  const [copySourceNgo, setCopySourceNgo] = useState('')
  const [copyTargetNgoIds, setCopyTargetNgoIds] = useState([])
  const [copyFilter, setCopyFilter] = useState('all')
  const [copyMobileFile, setCopyMobileFile] = useState(null)
  const [copying, setCopying] = useState(false)
  const [copyResult, setCopyResult] = useState(null)

  const [oldFile, setOldFile] = useState(null)
  const [oldDate, setOldDate] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [oldDataSourceId, setOldDataSourceId] = useState('')
  const [oldImporting, setOldImporting] = useState(false)
  const [oldResult, setOldResult] = useState(null)
  const [oldSheets, setOldSheets] = useState([])
  const [oldSelectedSheets, setOldSelectedSheets] = useState({})

  useEffect(() => {
    api('/data-sources').then(setDataSources).catch(e => setErr(e.message))
    api('/data-import/batches').then(setBatches).catch(() => {})
    api('/ngos').then(n => {
      const list = Array.isArray(n) ? n : []
      setNgos(list)
      setSelectedNgoIds(list.map(ngo => ngo.id))
    }).catch(() => {})
  }, [])

  const loadBatches = () => {
    api('/data-import/batches').then(setBatches).catch(() => {})
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
    } finally {
      setInspecting(false)
    }
  }

  const handleFileChange = (e) => {
    const f = e.target.files[0]
    setFile(f)
    setResult(null)
    inspectFile(f, setSheets, setSelectedSheets)
  }

  const toggleSheet = (name) => {
    setSelectedSheets(prev => ({ ...prev, [name]: !prev[name] }))
  }

  const handleImport = async () => {
    if (!file || !date || !dataSourceId) return
    setImporting(true)
    setErr('')
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('date', date)
      fd.append('data_source_id', dataSourceId)
      const selected = Object.entries(selectedSheets).filter(([, v]) => v).map(([k]) => k)
      if (selected.length > 0 && selected.length < sheets.length) {
        selected.forEach(s => fd.append('sheets', s))
      }
      selectedNgoIds.forEach(id => fd.append('ngo_ids', id))
      const res = await api('/data-import/upload', { method: 'POST', body: fd })
      setResult(res)
      loadBatches()
    } catch (e) {
      setErr(e.message)
    } finally {
      setImporting(false)
    }
  }

  const viewBatch = async (id) => {
    try {
      const d = await api(`/data-import/batch/${id}`)
      setSelectedBatch(d)
    } catch (e) { setErr(e.message) }
  }

  const exportBatch = async (id) => {
    try {
      const res = await api(`/data-import/batch/${id}/export`, { raw: true })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `import-batch-${id}.xlsx`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { setErr(e.message) }
  }

  const downloadSample = async () => {
    try {
      const res = await api('/data-import/sample', { raw: true })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'data-import-sample.xlsx'; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { setErr(e.message) }
  }

  const handleOldFileChange = (e) => {
    const f = e.target.files[0]
    setOldFile(f)
    setOldResult(null)
    inspectFile(f, setOldSheets, setOldSelectedSheets)
  }

  const toggleOldSheet = (name) => {
    setOldSelectedSheets(prev => ({ ...prev, [name]: !prev[name] }))
  }

  const handleOldImport = async () => {
    if (!oldFile || !oldDate || !oldDataSourceId) return
    setOldImporting(true)
    setErr('')
    setOldResult(null)
    try {
      const fd = new FormData()
      fd.append('file', oldFile)
      fd.append('date', oldDate)
      fd.append('data_source_id', oldDataSourceId)
      const selected = Object.entries(oldSelectedSheets).filter(([, v]) => v).map(([k]) => k)
      if (selected.length > 0 && selected.length < oldSheets.length) {
        selected.forEach(s => fd.append('sheets', s))
      }
      const res = await api('/data-import/upload-old', { method: 'POST', body: fd })
      setOldResult(res)
    } catch (e) {
      setErr(e.message)
    } finally {
      setOldImporting(false)
    }
  }

  const downloadTestSheet = async () => {
    try {
      const res = await api('/data-import/test-sheet', { raw: true })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'data-import-test.xlsx'; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { setErr(e.message) }
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
            <thead><tr>
              <th>#</th><th>Name</th><th>Mobile</th><th>Category</th><th>Amount</th>
              <th>Transaction Date</th><th>Bank Donor</th><th>City</th><th>PAN</th>
            </tr></thead>
            <tbody>
              {(selectedBatch.records || []).map((r, i) => (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td>{r.name || '—'}</td>
                  <td><code>{r.mobile_number}</code></td>
                  <td><span className="sa-badge">{r.category}</span></td>
                  <td>₹{Number(r.amount).toLocaleString()}</td>
                  <td className="sa-muted">{r.transaction_date || '—'}</td>
                  <td className="sa-muted">{r.bank_donor_name || '—'}</td>
                  <td className="sa-muted">{r.city || '—'}</td>
                  <td className="sa-muted">{r.pan_number || '—'}</td>
                </tr>
              ))}
              {(selectedBatch.records || []).length === 0 && (
                <tr><td colSpan={9} className="sa-muted sa-center">No records</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="sa-page">
      <h3>Data Import</h3>
      {err && <div className="sa-err-card">{err}</div>}

      <div className="sa-tabs">
        <button className={`sa-tab${tab === 'import' ? ' active' : ''}`} onClick={() => setTab('import')}>Import</button>
        <button className={`sa-tab${tab === 'history' ? ' active' : ''}`} onClick={() => { setTab('history'); loadBatches() }}>History ({batches.length})</button>
        <button className={`sa-tab${tab === 'old' ? ' active' : ''}`} onClick={() => setTab('old')}>Old Data</button>
        <button className={`sa-tab${tab === 'copy' ? ' active' : ''}`} onClick={() => setTab('copy')}>Copy to NGOs</button>
      </div>

      {tab === 'import' && (
        <>
          <div className="sa-card">
            <h3 className="sa-card-title">Upload Data</h3>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <label className="field">Import Date
                <input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </label>
              <label className="field">Data Source
                <select value={dataSourceId} onChange={e => setDataSourceId(e.target.value)}>
                  <option value="">— Select —</option>
                  {dataSources.map(ds => (
                    <option key={ds.id} value={ds.id}>{ds.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">Excel / CSV File
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} />
              </label>
              {inspecting && <p className="sa-muted" style={{fontSize:12}}>Inspecting file...</p>}
              {sheets.length > 0 && (
                <div style={{display:'flex',flexWrap:'wrap',gap:8, alignItems:'center'}}>
                  <span style={{fontSize:12,color:'var(--ink-soft)',fontWeight:500}}>Sheets:</span>
                  {sheets.map(s => (
                    <label key={s} style={{display:'flex',alignItems:'center',gap:4,cursor:'pointer',fontSize:13,
                      background: selectedSheets[s] ? 'var(--primary-light, #eef2ff)' : '#f5f5f5',
                      padding:'4px 10px', borderRadius:'var(--radius-sm, 6px)', border:'1px solid var(--line, #e5e7eb)'}}>
                      <input type="checkbox" checked={!!selectedSheets[s]} onChange={() => toggleSheet(s)} />
                      {s}
                    </label>
                  ))}
                </div>
              )}
              <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}>
                <span style={{fontSize:12,color:'var(--ink-soft)',fontWeight:500}}>NGOs:</span>
                {ngos.map(ngo => (
                  <label key={ngo.id} style={{display:'flex',alignItems:'center',gap:4,cursor:'pointer',fontSize:13,
                    background: selectedNgoIds.includes(ngo.id) ? '#eef2ff' : '#f5f5f5',
                    padding:'4px 10px', borderRadius:'var(--radius-sm, 6px)', border:'1px solid var(--line, #e5e7eb)'}}>
                    <input type="checkbox" checked={selectedNgoIds.includes(ngo.id)}
                      onChange={() => setSelectedNgoIds(prev =>
                        prev.includes(ngo.id) ? prev.filter(id => id !== ngo.id) : [...prev, ngo.id]
                      )} />
                    {ngo.name}
                  </label>
                ))}
              </div>
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
              <h3 className="sa-card-title" style={{color:'#10b981'}}>
                Import Complete
              </h3>
              <div className="sa-stat-grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))'}}>
                <div className="sa-stat-card">
                  <div className="sa-stat-label">Total in File</div>
                  <div className="sa-stat-value">{result.total_in_file}</div>
                </div>
                <div className="sa-stat-card" style={{borderLeftColor:'#f59e0b'}}>
                  <div className="sa-stat-label">Within-File Dups Removed</div>
                  <div className="sa-stat-value" style={{color:'#f59e0b'}}>{result.duplicates_removed}</div>
                </div>
                <div className="sa-stat-card" style={{borderLeftColor:'#eab308'}}>
                  <div className="sa-stat-label">Cross-Batch Dups Removed</div>
                  <div className="sa-stat-value" style={{color:'#eab308'}}>{result.cross_batch_duplicates_removed}</div>
                </div>
                <div className="sa-stat-card" style={{borderLeftColor:'#10b981'}}>
                  <div className="sa-stat-label">Imported</div>
                  <div className="sa-stat-value" style={{color:'#10b981'}}>{result.imported}</div>
                </div>
                <div className="sa-stat-card" style={{borderLeftColor:'#3b82f6'}}>
                  <div className="sa-stat-label">NGOs Replicated To</div>
                  <div className="sa-stat-value" style={{color:'#3b82f6'}}>{result.ngos_used}</div>
                </div>
              </div>
              {result.ngo_counts && (
                <div style={{marginTop:10, display:'flex', gap:10, flexWrap:'wrap'}}>
                  {Object.entries(result.ngo_counts).map(([name, count]) => (
                    <span key={name} className="sa-badge" style={{background:'#eef2ff', color:'#4338ca', padding:'4px 10px', borderRadius:6, fontSize:12}}>
                      {count} → {name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'history' && (
        <div className="sa-card">
          <table className="sa-table">
            <thead><tr><th>Date</th><th>Source</th><th>Records</th><th>Imported At</th><th style={{width:120}}></th></tr></thead>
            <tbody>
              {batches.map(b => (
                <tr key={b.import_batch_id}>
                  <td>{b.import_date}</td>
                  <td>{b.data_source_name}</td>
                  <td>{b.record_count}</td>
                  <td className="sa-muted">{b.created_at ? new Date(b.created_at).toLocaleString() : '—'}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => viewBatch(b.import_batch_id)}>View</button>
                    <button className="btn btn-sm" onClick={() => exportBatch(b.import_batch_id)} style={{marginLeft:4}}>Export</button>
                  </td>
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
            <p className="sa-muted" style={{marginBottom:12}}>Each row creates a new donor profile entry. Duplicate mobile numbers are allowed (multiple donations by same donor).</p>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <label className="field">Import Date
                <input type="date" value={oldDate} onChange={e => setOldDate(e.target.value)} />
              </label>
              <label className="field">Data Source
                <select value={oldDataSourceId} onChange={e => setOldDataSourceId(e.target.value)}>
                  <option value="">— Select —</option>
                  {dataSources.map(ds => (
                    <option key={ds.id} value={ds.id}>{ds.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">Excel / CSV File
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleOldFileChange} />
              </label>
              {inspecting && <p className="sa-muted" style={{fontSize:12}}>Inspecting file...</p>}
              {oldSheets.length > 0 && (
                <div style={{display:'flex',flexWrap:'wrap',gap:8, alignItems:'center'}}>
                  <span style={{fontSize:12,color:'var(--ink-soft)',fontWeight:500}}>Sheets:</span>
                  {oldSheets.map(s => (
                    <label key={s} style={{display:'flex',alignItems:'center',gap:4,cursor:'pointer',fontSize:13,
                      background: oldSelectedSheets[s] ? 'var(--primary-light, #eef2ff)' : '#f5f5f5',
                      padding:'4px 10px', borderRadius:'var(--radius-sm, 6px)', border:'1px solid var(--line, #e5e7eb)'}}>
                      <input type="checkbox" checked={!!oldSelectedSheets[s]} onChange={() => toggleOldSheet(s)} />
                      {s}
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
                <div className="sa-stat-card">
                  <div className="sa-stat-label">Total in File</div>
                  <div className="sa-stat-value">{oldResult.total_in_file}</div>
                </div>
                <div className="sa-stat-card" style={{borderLeftColor:'#eab308'}}>
                  <div className="sa-stat-label">Cross-Batch Dups Removed</div>
                  <div className="sa-stat-value" style={{color:'#eab308'}}>{oldResult.cross_batch_duplicates_removed}</div>
                </div>
                <div className="sa-stat-card" style={{borderLeftColor:'#10b981'}}>
                  <div className="sa-stat-label">Imported to Donors</div>
                  <div className="sa-stat-value" style={{color:'#10b981'}}>{oldResult.imported}</div>
                </div>
              </div>
              {oldResult.errors && oldResult.errors.length > 0 && (
                <div style={{marginTop:12}}>
                  <p className="sa-muted">{oldResult.errors.length} rows failed</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'copy' && (
        <>
          <div className="sa-card">
            <h3 className="sa-card-title">Copy Donors to Other NGOs</h3>
            <p className="sa-muted" style={{marginBottom:12}}>
              Copy donor records from one NGO to another as <strong>new data</strong>. The copied donors will appear in the target NGO's "New Data" tab for distribution to stations.
            </p>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <label className="field">
                Source NGO
                <select value={copySourceNgo} onChange={e => setCopySourceNgo(e.target.value)}>
                  <option value="">— Select —</option>
                  {ngos.map(ngo => (
                    <option key={ngo.id} value={ngo.id}>{ngo.name}</option>
                  ))}
                </select>
              </label>
              <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}>
                <span style={{fontSize:12,color:'var(--ink-soft)',fontWeight:500}}>Target NGOs:</span>
                {ngos.filter(n => n.id !== Number(copySourceNgo)).map(ngo => (
                  <label key={ngo.id} style={{display:'flex',alignItems:'center',gap:4,cursor:'pointer',fontSize:13,
                    background: copyTargetNgoIds.includes(ngo.id) ? '#eef2ff' : '#f5f5f5',
                    padding:'4px 10px', borderRadius:'var(--radius-sm, 6px)', border:'1px solid var(--line, #e5e7eb)'}}>
                    <input type="checkbox" checked={copyTargetNgoIds.includes(ngo.id)}
                      onChange={() => setCopyTargetNgoIds(prev =>
                        prev.includes(ngo.id) ? prev.filter(id => id !== ngo.id) : [...prev, ngo.id]
                      )} />
                    {ngo.name}
                  </label>
                ))}
              </div>
              <label className="field">
                Filter
                <select value={copyFilter} onChange={e => setCopyFilter(e.target.value)}>
                  <option value="all">All Donors</option>
                  <option value="assigned">Donors with donations only</option>
                  <option value="new">New/Unassigned only</option>
                </select>
              </label>
              <label className="field" style={{fontSize:12}}>
                Or upload a file with mobile numbers (one per row)
                <input type="file" accept=".txt,.csv,.xlsx" onChange={e => setCopyMobileFile(e.target.files[0])} />
              </label>
              <div className="sa-filters" style={{marginTop:8}}>
                <button className="btn btn-primary" onClick={async () => {
                  if (!copySourceNgo || copyTargetNgoIds.length === 0) return
                  setCopying(true)
                  setErr('')
                  setCopyResult(null)
                  try {
                    const body = {
                      source_ngo_id: Number(copySourceNgo),
                      target_ngo_ids: copyTargetNgoIds,
                      filter: copyFilter,
                    }
                    if (copyMobileFile) {
                      const text = await copyMobileFile.text()
                      body.mobile_numbers = text.split('\n').map(s => s.trim()).filter(Boolean)
                    }
                    const res = await api('/data-import/copy-to-ngos', { method: 'POST', body: JSON.stringify(body) })
                    setCopyResult(res)
                  } catch (e) {
                    setErr(e.message)
                  } finally {
                    setCopying(false)
                  }
                }} disabled={copying || !copySourceNgo || copyTargetNgoIds.length === 0}>
                  {copying ? 'Copying...' : 'Copy to Selected NGOs'}
                </button>
              </div>
            </div>
          </div>

          {copyResult && (
            <div className="sa-card">
              <h3 className="sa-card-title" style={{color:'#10b981'}}>Copy Complete</h3>
              <p style={{fontSize:13, marginBottom:8}}>{copyResult.message}</p>
              {copyResult.details && (
                <div style={{display:'flex', gap:10, flexWrap:'wrap'}}>
                  {copyResult.details.map(d => (
                    <span key={d.ngo} className="sa-badge" style={{background:'#eef2ff', color:'#4338ca', padding:'4px 10px', borderRadius:6, fontSize:12}}>
                      {d.copied} → {d.ngo}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
