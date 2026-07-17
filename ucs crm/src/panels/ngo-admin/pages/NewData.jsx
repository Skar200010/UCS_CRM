import { useState, useEffect } from 'react'
import { apiGet, apiPost } from '../api/auth'
import { api } from '../../../api/auth'

const PAGE_SIZES = [100, 500, 1000]

function StationSelectModal({ stations, onClose, onDistribute, ngoId }) {
  const [selected, setSelected] = useState(() => new Set(stations.map(s => s.station)))
  const [loading, setLoading] = useState(false)

  const toggle = (station) => {
    const next = new Set(selected)
    if (next.has(station)) next.delete(station)
    else next.add(station)
    setSelected(next)
  }

  const toggleAll = () => {
    if (selected.size === stations.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(stations.map(s => s.station)))
    }
  }

  const handleDistribute = async () => {
    if (selected.size === 0) return
    setLoading(true)
    try {
      const body = { stations: Array.from(selected) }
      if (ngoId && ngoId !== 'all') body.ngo_id = ngoId
      const res = await apiPost('/ngo-admin/new-data/distribute', body)
      onDistribute(res)
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-head">
          <h3>Select Stations to Distribute</h3>
          <button className="btn btn-sm btn-outline" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={selected.size === stations.length} onChange={toggleAll} />
            <strong>Select All</strong>
            <span className="count" style={{ marginLeft: 4 }}>{stations.length}</span>
          </label>
          <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stations.map(s => (
              <label key={s.station} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '4px 6px', borderRadius: 4, background: selected.has(s.station) ? '#f0fdf4' : 'transparent' }}>
                <input type="checkbox" checked={selected.has(s.station)} onChange={() => toggle(s.station)} />
                <span style={{ fontWeight: 600, flex: 1 }}>{s.station}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                  {s.fro_worker_name ? s.fro_worker_name : 'No FRO'}
                </span>
                <span className="pill pill-blue" style={{ fontSize: 11 }}>{s.donor_count}</span>
              </label>
            ))}
          </div>
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleDistribute} disabled={loading || selected.size === 0}>
              {loading ? 'Distributing...' : `Distribute to ${selected.size} station(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function OldDataTab() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState([])
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const handleFileChange = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setResult(null)
    setError('')

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const XLSX = window.XLSX
        if (!XLSX) {
          setError('XLSX library not loaded. Please refresh.')
          return
        }
        const wb = XLSX.read(evt.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' })
        setPreview(json.slice(0, 20))
      } catch {
        setError('Failed to parse file. Ensure it is a valid .xlsx file.')
      }
    }
    reader.readAsArrayBuffer(f)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError('')
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api('/ngo-admin/old-data/upload', { method: 'POST', body: fd, _prefix: 'ucs' })
      setResult(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const validRows = preview.length

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h3>Upload Old Data</h3></div>
        <div className="card-pad">
          <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 12 }}>
            Upload an Excel file with donor data. Each row is replicated to <strong>all 3 NGOs</strong> (BSCT, AFLF, MANN) in the specified station.
          </p>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 12, background: 'var(--bg)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--line)' }}>
            <strong>Required columns:</strong> <code>mobile</code>, <code>station</code><br />
            <strong>Optional:</strong> <code>name</code>, <code>amount</code>, <code>city</code><br />
            <strong>Valid stations:</strong> ND-1 to ND-8, DH-1 to DH-14
          </div>
          <label className="field">
            File
            <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} />
          </label>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', marginBottom: 16, borderRadius: 6, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 13, color: '#991b1b' }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ padding: '12px 14px', marginBottom: 16, borderRadius: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 13, color: '#166534' }}>
          <strong>{result.message}</strong><br />
          <span style={{ fontSize: 11 }}>
            {result.total_rows} rows · {result.created_profiles} new profiles · {result.created_assignments} assignments created
            {result.skipped_duplicate_assignments > 0 && ` · ${result.skipped_duplicate_assignments} skipped (duplicates)`}
            {result.invalid_stations > 0 && ` · ${result.invalid_stations} invalid stations`}
          </span>
        </div>
      )}

      {preview.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h3>Preview ({preview.length} rows shown of {file?.name})</h3>
            <button className="btn btn-primary btn-sm" onClick={handleUpload} disabled={uploading || !file}>
              {uploading ? 'Uploading...' : 'Upload & Assign (×3 NGOs)'}
            </button>
          </div>
          <div className="card-pad" style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  {Object.keys(preview[0]).map(k => <th key={k}>{k}</th>)}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((v, j) => <td key={j}>{String(v).slice(0, 50)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const NGO_COLORS = {
  bsct: '#2563eb',
  aflf: '#16a34a',
  mann: '#ec4899',
};

export default function NewData() {
  const [tab, setTab] = useState('new')
  const [donors, setDonors] = useState([])
  const [loading, setLoading] = useState(true)
  const [distributing, setDistributing] = useState(false)
  const [result, setResult] = useState(null)
  const [showStationSelect, setShowStationSelect] = useState(false)
  const [stations, setStations] = useState([])
  const [selectedNgoId, setSelectedNgoId] = useState('all')
  const [accessibleNgos, setAccessibleNgos] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [perPage, setPerPage] = useState(500)

  useEffect(() => {
    apiGet('/ngo-admin/ngos').then(setAccessibleNgos).catch(() => {});
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const startRow = (page - 1) * perPage + 1;
  const endRow = Math.min(page * perPage, total);

  const load = () => {
    setLoading(true)
    const params = [];
    if (selectedNgoId !== 'all') params.push(`ngo_id=${selectedNgoId}`);
    params.push(`page=${page}`, `per_page=${perPage}`);
    const query = params.length > 0 ? `?${params.join('&')}` : '';
    Promise.all([
      apiGet(`/ngo-admin/new-data${query}`),
      apiGet('/ngo-admin/stations'),
    ]).then(([d, s]) => {
      setDonors(Array.isArray(d) ? d : d?.unassigned || [])
      setTotal(d?.total || 0)
      setStations(Array.isArray(s) ? s : [])
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { setPage(1) }, [selectedNgoId])
  useEffect(load, [selectedNgoId, page, perPage])

  useEffect(() => { if (tab === 'new') load() }, [tab])

  const handleDistributeAll = async () => {
    const count = total
    if (count === 0) return
    if (!confirm(`Distribute ${count} donor(s) equally among all stations?`)) return
    setDistributing(true)
    setResult(null)
    try {
      const body = {}
      if (selectedNgoId !== 'all') body.ngo_id = selectedNgoId
      const res = await apiPost('/ngo-admin/new-data/distribute', body)
      setResult(res)
      load()
    } catch (err) {
      alert(err.message)
    } finally {
      setDistributing(false)
    }
  }

  return (
    <div>
      <div className="filter-bar">
        <span style={{fontSize:13, fontWeight:600, color:'var(--ink-soft)'}}>NGO:</span>
        <select value={selectedNgoId} onChange={e => setSelectedNgoId(e.target.value)}>
          <option value="all">All NGOs</option>
          {accessibleNgos.map(ngo => (
            <option key={ngo.id} value={ngo.id}>{ngo.name}</option>
          ))}
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, background: 'var(--bg)', borderRadius: 8, padding: 2 }}>
          <button onClick={() => setTab('new')} style={{ padding: '5px 14px', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', background: tab === 'new' ? 'var(--sage)' : 'transparent', color: tab === 'new' ? '#fff' : 'var(--ink-soft)' }}>
            New Data
          </button>
          <button onClick={() => setTab('old')} style={{ padding: '5px 14px', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', background: tab === 'old' ? 'var(--sage)' : 'transparent', color: tab === 'old' ? '#fff' : 'var(--ink-soft)' }}>
            Old Data
          </button>
        </div>
      </div>

      {tab === 'new' && (
        <>
          {result && (
            <div style={{ padding: '10px 14px', marginBottom: 16, borderRadius: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 13, color: '#166534' }}>
              {result.message}
            </div>
          )}

          <div className="card">
            <div className="card-head">
              <h3>New Data</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="count">{total > 0 ? `Showing ${startRow}-${endRow} of ${total} donors` : `${total} donors`}</span>
                <button className="btn btn-primary btn-sm" onClick={handleDistributeAll} disabled={distributing || total === 0}>
                  {distributing ? 'Distributing...' : 'Distribute to All Stations'}
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => setShowStationSelect(true)} disabled={total === 0}>
                  Select Stations & Distribute
                </button>
              </div>
            </div>
            <div className="card-pad">
              {loading ? (
                <div className="loading">Loading new data...</div>
              ) : donors.length === 0 ? (
                <div className="empty-state"><p>No unassigned data. Import new data via the Data Import page.</p></div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Mobile</th>
                      <th>NGO</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th>Imported</th>
                    </tr>
                  </thead>
                  <tbody>
                    {donors.map((d, i) => (
                      <tr key={d.id || d.mobile_number || i}>
                        <td><strong>{d.name || '\u2014'}</strong></td>
                        <td><code>{d.mobile_number}</code></td>
                        <td>
                          {d.ngo ? (
                            <span style={{
                              display:'inline-block', padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:600,
                              color:'#fff', background: NGO_COLORS[d.ngo.toLowerCase()] || '#6b7280'
                            }}>
                              {d.ngo}
                            </span>
                          ) : '\u2014'}
                        </td>
                        <td><span className="pill">{d.category || '\u2014'}</span></td>
                        <td>{'\u20B9'}{Number(d.amount || 0).toLocaleString()}</td>
                        <td className="muted">{d.created_at ? new Date(d.created_at).toLocaleDateString() : '\u2014'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {total > 0 && !loading && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 0', fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--ink-soft)' }}>Rows per page:</span>
                    <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1) }}
                      style={{ fontSize: 12, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--line)' }}>
                      {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button className="btn btn-sm btn-outline" disabled={page <= 1} onClick={() => setPage(1)} style={{ fontSize: 11 }}>«</button>
                    <button className="btn btn-sm btn-outline" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{ fontSize: 11 }}>‹</button>
                    {(() => {
                      const pages = [];
                      const maxVisible = 7;
                      let startP = Math.max(1, page - Math.floor(maxVisible / 2));
                      let endP = Math.min(totalPages, startP + maxVisible - 1);
                      if (endP - startP < maxVisible - 1) startP = Math.max(1, endP - maxVisible + 1);
                      for (let p = startP; p <= endP; p++) {
                        pages.push(
                          <button key={p} className="btn btn-sm" onClick={() => setPage(p)}
                            style={{ fontSize: 11, fontWeight: p === page ? 700 : 400, background: p === page ? 'var(--sage)' : 'transparent', color: p === page ? '#fff' : 'inherit', border: p === page ? 'none' : '1px solid var(--line)' }}>
                            {p}
                          </button>
                        );
                      }
                      return pages;
                    })()}
                    <button className="btn btn-sm btn-outline" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ fontSize: 11 }}>›</button>
                    <button className="btn btn-sm btn-outline" disabled={page >= totalPages} onClick={() => setPage(totalPages)} style={{ fontSize: 11 }}>»</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {showStationSelect && (
            <StationSelectModal
              stations={stations}
              onClose={() => setShowStationSelect(false)}
              onDistribute={(res) => { setShowStationSelect(false); setResult(res); load() }}
              ngoId={selectedNgoId}
            />
          )}
        </>
      )}

      {tab === 'old' && <OldDataTab />}
    </div>
  )
}