import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../api/auth';
import { api } from '../../../api/auth';

const NGO_NAME_COLORS = {
  bsct: '#2563eb',
  aflf: '#16a34a',
  mann: '#ec4899',
};

function TransferDataModal({ station, sourceName, sourceCount, stations, onClose, onTransferred }) {
  const [targetStation, setTargetStation] = useState('');
  const [count, setCount] = useState(sourceCount);
  const [loading, setLoading] = useState(false);
  const maxCount = sourceCount;

  const availableStations = stations.filter(s => s.station !== station);

  const handleTransfer = async () => {
    if (!targetStation || count < 1) return;
    setLoading(true);
    try {
      await apiPost(`/ngo-admin/stations/${encodeURIComponent(station)}/transfer-data`, {
        target_station: targetStation,
        donor_count: count,
      });
      onClose();
      setTimeout(() => { if (onTransferred) onTransferred(); }, 600);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-head">
          <h3>Transfer Leads — {station}</h3>
          <button className="btn btn-sm btn-outline" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, color: '#6b7280', background: '#f9fafb', padding: '10px 12px', borderRadius: 6 }}>
            Source station: <strong>{station}</strong> — {sourceCount} leads (all statuses)
          </div>
          <label className="field">
            Number of leads to transfer
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setCount(Math.max(1, count - 5))} disabled={count <= 1}>−5</button>
              <button className="btn btn-outline btn-sm" onClick={() => setCount(Math.max(1, count - 1))} disabled={count <= 1}>−1</button>
              <input type="number" min={1} max={maxCount}
                value={count} onChange={e => setCount(Math.min(maxCount, Math.max(1, parseInt(e.target.value) || 1)))}
                style={{ width: 80, textAlign: 'center' }} />
              <button className="btn btn-outline btn-sm" onClick={() => setCount(Math.min(maxCount, count + 1))} disabled={count >= maxCount}>+1</button>
              <button className="btn btn-outline btn-sm" onClick={() => setCount(Math.min(maxCount, count + 5))} disabled={count >= maxCount}>+5</button>
            </div>
          </label>
          <label className="field">
            Transfer to station
            <select value={targetStation} onChange={e => setTargetStation(e.target.value)}>
              <option value="">-- Select Station --</option>
              {availableStations.map(s => (
                <option key={s.station} value={s.station}>{s.station}</option>
              ))}
            </select>
          </label>
          <div style={{ fontSize: 12, color: '#6b7280', background: '#f0fdf4', padding: '8px 12px', borderRadius: 6 }}>
            Leads transferred to target station (unassigned). Auto-return after 10 hours.
          </div>
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleTransfer}
              disabled={loading || !targetStation || count < 1}>
              {loading ? 'Transferring...' : `Transfer ${count} Leads`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OldDataUploadModal({ station, onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setError('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const XLSX = window.XLSX;
        if (!XLSX) {
          setError('XLSX library not loaded. Please refresh.');
          return;
        }
        const wb = XLSX.read(evt.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
        setPreview(json.slice(0, 20));
      } catch {
        setError('Failed to parse file. Ensure it is a valid .xlsx file.');
      }
    };
    reader.readAsArrayBuffer(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api(`/ngo-admin/stations/${encodeURIComponent(station)}/upload-old-data`, { method: 'POST', body: fd, _prefix: 'ucs' });
      setResult(res);
      setTimeout(() => { if (onUploaded) onUploaded(); }, 600);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="modal-head">
          <h3>Upload Old Data — {station}</h3>
          <button className="btn btn-sm btn-outline" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 12, color: '#6b7280', background: '#f9fafb', padding: '10px 12px', borderRadius: 6, marginBottom: 12 }}>
            Upload an Excel file. Donors will be assigned to station <strong>{station}</strong> across all your NGOs.
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 12, background: 'var(--bg)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--line)' }}>
            <strong>Required columns:</strong> <code>mobile</code><br />
            <strong>Optional:</strong> <code>name</code>, <code>amount</code>, <code>city</code>, <code>station</code>
          </div>
          <label className="field">
            File
            <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} />
          </label>

          {error && (
            <div style={{ padding: '10px 14px', marginTop: 12, borderRadius: 6, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 13, color: '#991b1b' }}>
              {error}
            </div>
          )}

          {result && (
            <div style={{ padding: '12px 14px', marginTop: 12, borderRadius: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 13, color: '#166534' }}>
              <strong>{result.message}</strong><br />
              <span style={{ fontSize: 11 }}>
                {result.total_rows} rows · {result.created_profiles} new profiles · {result.created_assignments} assignments created
                {result.skipped_duplicate_assignments > 0 && ` · ${result.skipped_duplicate_assignments} skipped (duplicates)`}
              </span>
            </div>
          )}

          {preview.length > 0 && !result && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Preview ({preview.length} rows)</span>
                <button className="btn btn-primary btn-sm" onClick={handleUpload} disabled={uploading || !file}>
                  {uploading ? 'Uploading...' : 'Upload & Assign'}
                </button>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 240, overflowY: 'auto' }}>
                <table style={{ fontSize: 11 }}>
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

          <div className="modal-actions" style={{ marginTop: 12 }}>
            <button className="btn btn-outline" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StationManagement() {
  const [stations, setStations] = useState([]);
  const [allNgos, setAllNgos] = useState([]);
  const [froWorkers, setFroWorkers] = useState([]);
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newStation, setNewStation] = useState('');
  const [newStationNgo, setNewStationNgo] = useState('');
  const [adding, setAdding] = useState(false);
  const [editNgoStation, setEditNgoStation] = useState(null);
  const [transferData, setTransferData] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [returningId, setReturningId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [targetAmount, setTargetAmount] = useState('');
  const [editAchieved, setEditAchieved] = useState(null);
  const [achievedAmount, setAchievedAmount] = useState('');
  const [incentives, setIncentives] = useState([]);
  const [editIncentive, setEditIncentive] = useState(null);
  const [incentiveAmount, setIncentiveAmount] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedNgoId, setSelectedNgoId] = useState('all');
  const [uploadStation, setUploadStation] = useState(null);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3000);
    return () => clearTimeout(t);
  }, [msg]);

  useEffect(() => {
    loadTargets(selectedMonth);
  }, [selectedMonth]);

  const computeNextName = (existingStations) => {
    const nums = existingStations
      .map(s => {
        const m = s.station?.match(/^new_ucs-(\d+)$/i);
        return m ? parseInt(m[1], 10) : NaN;
      })
      .filter(n => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `new_ucs-${max + 1}`;
  };

  const fetchTransfers = () => {
    apiGet('/ngo-admin/transfers').then(r => {
      setTransfers(Array.isArray(r) ? r : []);
    }).catch(() => {});
  };

  const fetchData = (successMsg, month) => {
    const m = month || selectedMonth;
    const url = selectedNgoId === 'all' ? '/ngo-admin/stations' : `/ngo-admin/stations?ngo_id=${selectedNgoId}`;
    apiGet(url).then(s => {
      if (Array.isArray(s)) setStations(s);
    }).catch(err => console.error('fetchData error:', err));
    apiGet('/ngo-admin/transfers').then(t => {
      setTransfers(Array.isArray(t) ? t : []);
    }).catch(err => console.error('fetchData transfers error:', err));
    apiGet('/ngo-admin/targets?month=' + m).then(t => {
      if (Array.isArray(t)) setTargets(t);
    }).catch(() => {});
    apiGet('/ngo-admin/incentives').then(r => {
      if (Array.isArray(r)) setIncentives(r);
    }).catch(() => {});
    if (successMsg) setMsg(successMsg);
  };

  const loadTargets = (month) => {
    const m = month || selectedMonth;
    apiGet('/ngo-admin/targets?month=' + m).then(t => {
      if (Array.isArray(t)) setTargets(t);
    }).catch(() => {});
    apiGet('/ngo-admin/incentives').then(r => {
      if (Array.isArray(r)) setIncentives(r);
    }).catch(() => {});
  };

  useEffect(() => {
    setLoading(true);
    const m = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const url = selectedNgoId === 'all' ? '/ngo-admin/stations' : `/ngo-admin/stations?ngo_id=${selectedNgoId}`;
    Promise.all([
      apiGet(url),
      apiGet('/ngo-admin/ngos'),
      apiGet('/ngo-admin/fro-workers'),
      apiGet('/ngo-admin/targets?month=' + m),
      apiGet('/ngo-admin/incentives'),
    ]).then(([s, n, f, t, i]) => {
      const list = Array.isArray(s) ? s : [];
      setStations(list);
      setAllNgos(Array.isArray(n) ? n : []);
      setFroWorkers(Array.isArray(f) ? f : []);
      if (Array.isArray(t)) setTargets(t);
      if (Array.isArray(i)) setIncentives(i);
      setNewStation(computeNextName(list));
    }).catch(err => console.error('Initial load error:', err)).finally(() => setLoading(false));
    apiGet('/ngo-admin/transfers').then(t => {
      setTransfers(Array.isArray(t) ? t : []);
    }).catch(err => console.error('Initial transfers load error:', err));
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedNgoId]);

  const activeTransfers = transfers.filter(t => !t.returned);
  const historyTransfers = transfers.filter(t => t.returned);

  const handleAddStation = async () => {
    if (!newStation.trim()) return;
    setAdding(true);
    try {
      await apiPost('/ngo-admin/stations', {
        station: newStation.trim(),
        ngo_id: newStationNgo || null,
      });
      setNewStationNgo('');
      const list = await apiGet('/ngo-admin/stations');
      if (Array.isArray(list)) {
        setStations(list);
        setNewStation(computeNextName(list));
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleNgoChange = async (station, ngoId) => {
    try {
      await apiPut(`/ngo-admin/stations/${encodeURIComponent(station)}/update-ngos`, { ngo_id: ngoId });
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleFroChange = async (station, froWorkerId) => {
    const s = stations.find(st => st.station === station);
    if (!s) return;
    try {
      await apiPut(`/ngo-admin/stations/${encodeURIComponent(station)}/update-ngos`, {
        ngo_id: s.ngos[0]?.ngo_id || null,
        fro_worker_id: froWorkerId,
      });
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleReturnEarly = async (transferId) => {
    if (!confirm('Return these leads to the original station now?')) return;
    setReturningId(transferId);
    try {
      await apiPost(`/ngo-admin/transfers/${transferId}/return-early`);
      setTimeout(() => fetchData('Leads returned successfully'), 400);
    } catch (err) {
      alert(err.message);
    } finally {
      setReturningId(null);
    }
  };

  const handleDeleteStation = async (station) => {
    if (!confirm(`Delete station "${station}"?`)) return;
    try {
      await apiDelete(`/ngo-admin/stations/${encodeURIComponent(station)}`);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const assignedFroIds = new Set(
    stations.map(s => s.fro_worker_id).filter(Boolean)
  );

  return (
    <div>
      {msg && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>✓</span>
          <span>{msg}</span>
        </div>
      )}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3>Add Station</h3>
        </div>
        <div className="card-pad">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="form-row">
              <label className="field" style={{ flex: 1 }}>
                Station Name
                <input value={newStation} onChange={e => setNewStation(e.target.value)} />
              </label>
              <button className="btn btn-primary" onClick={handleAddStation} disabled={adding || !newStation.trim()} style={{ alignSelf: 'flex-end' }}>
                {adding ? 'Adding...' : 'Create'}
              </button>
            </div>
            <label className="field" style={{ marginBottom: 0, flex: 1 }}>
              NGO
              <select value={newStationNgo} onChange={e => setNewStationNgo(e.target.value)}>
                <option value="">-- Select NGO --</option>
                {allNgos.map(n => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3>Stations</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="count">{stations.length} stations</span>
              <button className="btn btn-sm btn-outline" onClick={async () => {
                try {
                  const res = await apiPost('/ngo-admin/stations/seed', {})
                  setMsg(res.message || 'Stations seeded')
                  fetchData()
                } catch (err) {
                  setMsg('Error: ' + err.message)
                }
              }} style={{ fontSize: 11 }}>
                Seed Default Stations
              </button>
              <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                style={{ fontSize: 13, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--line, #e5e7eb)', width: 150 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg)', borderRadius: 8, padding: 2 }}>
            <button onClick={() => setSelectedNgoId('all')}
              style={{ padding: '5px 14px', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', background: selectedNgoId === 'all' ? 'var(--sage)' : 'transparent', color: selectedNgoId === 'all' ? '#fff' : 'var(--ink-soft)' }}>
              All
            </button>
            {allNgos.map(ngo => (
              <button key={ngo.id} onClick={() => setSelectedNgoId(ngo.id)}
                style={{ padding: '5px 14px', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', background: selectedNgoId === ngo.id ? 'var(--sage)' : 'transparent', color: selectedNgoId === ngo.id ? '#fff' : 'var(--ink-soft)' }}>
                {ngo.name}
              </button>
            ))}
          </div>
        </div>
        <div className="card-pad">
          {loading ? (
            <div className="loading">Loading stations...</div>
          ) : stations.length === 0 ? (
            <div className="empty-state"><p>No stations found. Add a station above to get started.</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Station</th>
                  <th>NGOs</th>
                  <th>FRO Worker</th>
                  <th>Donors</th>
                  <th>Old Data</th>
                  <th>Salary</th>
                  <th>Target</th>
                  <th>Source</th>
                  <th>Achieved</th>
                  <th>Incentive</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {stations.map((s, i) => (
                  <tr key={s.station}>
                    <td>
                      <strong>{s.station}</strong>
                      {(() => {
                        const at = activeTransfers.find(t => t.station?.trim() === s.station?.trim());
                        return at ? <span style={{ marginLeft: 6, fontSize: 13, color: '#b45309', fontWeight: 500 }}>→ {at.target_station}</span> : null;
                      })()}
                    </td>
                    <td>
                      <span onClick={() => setEditNgoStation(s.station)}
                        style={{ cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
                        {s.ngos.length > 0
                          ? s.ngos[0].ngo_name
                          : <span style={{ color: '#9ca3af' }}>No NGO</span>}
                      </span>
                    </td>
                    <td>
                      <select
                        value={s.fro_worker_id || ''}
                        onChange={e => handleFroChange(s.station, e.target.value)}
                        style={{ fontSize: 13, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--line, #e5e7eb)', maxWidth: 200 }}
                      >
                        <option value="">-- No FRO --</option>
                        {froWorkers.filter(w => !assignedFroIds.has(w.id) || w.id === s.fro_worker_id).map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className="pill pill-blue">{s.donor_count}</span>
                    </td>
                    <td>
                      <button className="btn btn-sm btn-outline" onClick={() => setUploadStation(s.station)}
                        style={{ fontSize: 10, whiteSpace: 'nowrap', color: 'var(--sage, #5B6B4E)' }}>
                        Upload
                      </button>
                    </td>
                    <td>
                      {(() => {
                        const w = froWorkers.find(fw => fw.id === s.fro_worker_id);
                        return w ? <span>₹{Number(w.salary || 0).toLocaleString('en-IN')}</span> : <span style={{ color: '#9ca3af' }}>—</span>;
                      })()}
                    </td>
                    <td>
                      {(() => {
                        const w = froWorkers.find(fw => fw.id === s.fro_worker_id);
                        if (!w) return <span style={{ color: '#9ca3af' }}>—</span>;
                        const t = targets.find(tg => tg.id === w.id);
                        return <strong>₹{Number(t?.target || 0).toLocaleString('en-IN')}</strong>;
                      })()}
                    </td>
                    <td>
                      {(() => {
                        const w = froWorkers.find(fw => fw.id === s.fro_worker_id);
                        if (!w) return <span style={{ color: '#9ca3af' }}>—</span>;
                        const t = targets.find(tg => tg.id === w.id);
                        if (!t) return <span style={{ color: '#9ca3af' }}>—</span>;
                        return (
                          <>
                            {t?.target_source === 'auto_month1' && <span className="pill pill-yellow">Auto M1</span>}
                            {t?.target_source === 'auto_month2' && <span className="pill pill-yellow">Auto M2</span>}
                            {t?.target_source === 'auto_month3' && <span className="pill pill-yellow">Auto M3</span>}
                            {t?.target_source === 'manual' && <span className="pill pill-green">Manual</span>}
                            {t?.target_source === 'not_set' && <span className="pill pill-gray">Not Set</span>}
                          </>
                        );
                      })()}
                    </td>
                    <td>
                      {(() => {
                        const w = froWorkers.find(fw => fw.id === s.fro_worker_id);
                        if (!w) return <span style={{ color: '#9ca3af' }}>—</span>;
                        const t = targets.find(tg => tg.id === w.id);
                        const val = t?.achieved_target;
                        return val != null && val > 0
                          ? <strong>₹{Number(val).toLocaleString('en-IN')}</strong>
                          : <span style={{ color: '#9ca3af' }}>—</span>;
                      })()}
                    </td>
                    <td>
                      {(() => {
                        const w = froWorkers.find(fw => fw.id === s.fro_worker_id);
                        if (!w) return <span style={{ color: '#9ca3af' }}>—</span>;
                        const t = targets.find(tg => tg.id === w.id);
                        const manualInc = t?.incentive;
                        const inc = incentives.find(i => i.worker_id === w.id);
                        const autoInc = inc?.hasTarget ? inc.totalIncentive : null;
                        const displayVal = manualInc != null ? manualInc : autoInc;
                        const isManual = manualInc != null;
                        if (displayVal != null && displayVal > 0) {
                          return (
                            <strong style={{ color: isManual ? '#7c3aed' : '#059669' }}>
                              ₹{Number(displayVal).toLocaleString('en-IN')}
                              {isManual && <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 4, color: '#7c3aed' }}>M</span>}
                            </strong>
                          );
                        }
                        return <span style={{ color: '#9ca3af' }}>{manualInc != null ? '0' : '—'}</span>;
                      })()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {(() => {
                          const at = activeTransfers.find(t => t.station === s.station);
                          return at ? (
                            <button className="btn btn-sm"
                              onClick={() => handleReturnEarly(at.id)}
                              disabled={returningId === at.id}
                              style={{ background: '#fef3c7', border: '1px solid #f59e0b', color: '#92400e' }}>
                              {returningId === at.id ? 'Returning...' : 'Return'}
                            </button>
                          ) : null;
                        })()}
                        {(() => {
                          const w = froWorkers.find(fw => fw.id === s.fro_worker_id);
                          if (!w) return null;
                          const t = targets.find(tg => tg.id === w.id);
                          if (!t || t?.months_employed >= 3) {
                            return (
                              <button className="btn btn-sm btn-outline" onClick={() => { setEditTarget(w); setTargetAmount(String(t?.target || '')); }}>
                                {t?.target_source === 'manual' ? 'Edit' : 'Set'}
                              </button>
                            );
                          }
                          return <span style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>Auto</span>;
                        })()}
                        {(() => {
                          const w = froWorkers.find(fw => fw.id === s.fro_worker_id);
                          if (!w) return null;
                          const t = targets.find(tg => tg.id === w.id);
                          return (
                            <button className="btn btn-sm btn-outline" onClick={() => { setEditAchieved(w); setAchievedAmount(String(t?.achieved_target || '')); }}>
                              {t?.achieved_target != null && t.achieved_target > 0 ? 'Edit Achv' : 'Set Achv'}
                            </button>
                          );
                        })()}
                        {(() => {
                          const w = froWorkers.find(fw => fw.id === s.fro_worker_id);
                          if (!w) return null;
                          const t = targets.find(tg => tg.id === w.id);
                          const inc = incentives.find(i => i.worker_id === w.id);
                          const autoVal = inc?.hasTarget ? inc.totalIncentive : 0;
                          return (
                            <button className="btn btn-sm btn-outline" onClick={() => {
                              setEditIncentive(w);
                              setIncentiveAmount(String(t?.incentive != null ? t.incentive : autoVal || ''));
                            }} style={{ color: '#7c3aed' }}>
                              {t?.incentive != null ? 'Edit Incent' : 'Set Incent'}
                            </button>
                          );
                        })()}
                        <button className="btn btn-sm btn-outline" onClick={() => {
                          const fro = froWorkers.find(w => w.id === s.fro_worker_id);
                          setTransferData({
                            station: s.station,
                            sourceName: fro?.name || 'Unknown',
                            sourceCount: s.donor_count || 0,
                          });
                        }} style={{ color: 'var(--sage, #5B6B4E)' }}>
                          Transfer
                        </button>
                        <button className="btn btn-sm btn-outline" onClick={() => handleDeleteStation(s.station)}
                          style={{ color: 'var(--danger)' }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editTarget && (
        <div className="modal-overlay" onClick={() => setEditTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Set Target — {editTarget.name}</h3>
              <button className="btn btn-sm btn-outline" onClick={() => setEditTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Monthly Target Amount (₹)</label>
                <input type="number" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} min="0" />
              </div>
              <div className="modal-actions">
                <button className="btn btn-outline" onClick={() => setEditTarget(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={async () => {
                  if (!targetAmount) return;
                  try {
                    const month = selectedMonth;
                    await apiPost('/ngo-admin/targets', {
                      fro_worker_id: editTarget.id,
                      month,
                      target_amount: parseFloat(targetAmount),
                    });
                    setEditTarget(null);
                    loadTargets();
                  } catch (err) { alert(err.message); }
                }} disabled={!targetAmount}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editAchieved && (
        <div className="modal-overlay" onClick={() => setEditAchieved(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Set Achieved Target — {editAchieved.name}</h3>
              <button className="btn btn-sm btn-outline" onClick={() => setEditAchieved(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Achieved Amount (₹)</label>
                <input type="number" value={achievedAmount} onChange={e => setAchievedAmount(e.target.value)} min="0" />
              </div>
              <div className="modal-actions">
                <button className="btn btn-outline" onClick={() => setEditAchieved(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={async () => {
                  try {
                    const month = selectedMonth;
                    await apiPost('/ngo-admin/achieved-target', {
                      fro_worker_id: editAchieved.id,
                      month,
                      achieved_amount: parseFloat(achievedAmount) || 0,
                    });
                    setEditAchieved(null);
                    loadTargets();
                  } catch (err) { alert(err.message); }
                }}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editIncentive && (
        <div className="modal-overlay" onClick={() => setEditIncentive(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Set Incentive — {editIncentive.name}</h3>
              <button className="btn btn-sm btn-outline" onClick={() => setEditIncentive(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Incentive Amount (₹)</label>
                <input type="number" value={incentiveAmount} onChange={e => setIncentiveAmount(e.target.value)} min="0" />
              </div>
              {(() => {
                const inc = incentives.find(i => i.worker_id === editIncentive.id);
                if (inc?.hasTarget && inc.totalIncentive > 0) {
                  return <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    Auto-calculated: ₹{Number(inc.totalIncentive).toLocaleString('en-IN')}
                    &nbsp;(AKI: ₹{Number(inc.akiPayout).toLocaleString('en-IN')} + 10%: ₹{Number(inc.monthlyIncentive).toLocaleString('en-IN')})
                  </div>;
                }
                return null;
              })()}
              <div className="modal-actions" style={{ marginTop: 16 }}>
                <button className="btn btn-outline" onClick={async () => {
                  try {
                    const month = selectedMonth;
                    await apiPost('/ngo-admin/incentive', {
                      fro_worker_id: editIncentive.id,
                      month,
                      incentive_amount: '',
                    });
                    setEditIncentive(null);
                    loadTargets();
                  } catch (err) { alert(err.message); }
                }}>Clear</button>
                <button className="btn btn-outline" onClick={() => setEditIncentive(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={async () => {
                  try {
                    const month = selectedMonth;
                    await apiPost('/ngo-admin/incentive', {
                      fro_worker_id: editIncentive.id,
                      month,
                      incentive_amount: parseFloat(incentiveAmount) || 0,
                    });
                    setEditIncentive(null);
                    loadTargets();
                  } catch (err) { alert(err.message); }
                }}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editNgoStation && (
        <div className="modal-overlay" onClick={() => setEditNgoStation(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal-head">
              <h3>Change NGO — {editNgoStation}</h3>
              <button className="btn btn-sm btn-outline" onClick={() => setEditNgoStation(null)}>✕</button>
            </div>
            <div className="modal-body">
              <label className="field">
                Select NGO
                <select value={stations.find(s => s.station === editNgoStation)?.ngos[0]?.ngo_id || ''}
                  onChange={e => { handleNgoChange(editNgoStation, e.target.value); setEditNgoStation(null); }}>
                  <option value="">-- No NGO --</option>
                  {allNgos.map(n => (
                    <option key={n.id} value={n.id}>{n.name}</option>
                  ))}
                </select>
              </label>
              <div className="modal-actions" style={{ marginTop: 12 }}>
                <button className="btn btn-outline" onClick={() => setEditNgoStation(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {transferData && (
        <TransferDataModal
          station={transferData.station}
          sourceName={transferData.sourceName}
          sourceCount={transferData.sourceCount}
          stations={stations}
          onClose={() => setTransferData(null)}
            onTransferred={() => fetchData('Transfer successful')}
        />
      )}

      {uploadStation && (
        <OldDataUploadModal
          station={uploadStation}
          onClose={() => setUploadStation(null)}
          onUploaded={() => { setUploadStation(null); fetchData('Old data uploaded successfully'); }}
        />
      )}
    </div>
  );
}
