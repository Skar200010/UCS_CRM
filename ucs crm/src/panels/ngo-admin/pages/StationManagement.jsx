import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../api/auth';

function NgoSelectModal({ allNgos, selectedIds, onSave, onClose }) {
  const [selected, setSelected] = useState(() => new Set(selectedIds));

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-head">
          <h3>Select NGOs</h3>
          <button className="btn btn-sm btn-outline" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {allNgos.map(n => (
              <label key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '6px 8px', borderRadius: 4, background: selected.has(n.id) ? '#f0fdf4' : 'transparent' }}>
                <input type="checkbox" checked={selected.has(n.id)} onChange={() => toggle(n.id)} />
                {n.name}
              </label>
            ))}
          </div>
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={() => onSave(Array.from(selected))}>
              Save
            </button>
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
  const [loading, setLoading] = useState(true);
  const [newStation, setNewStation] = useState('');
  const [newStationNgos, setNewStationNgos] = useState([]);
  const [adding, setAdding] = useState(false);
  const [editNgoStation, setEditNgoStation] = useState(null);
  const [newNgoModalOpen, setNewNgoModalOpen] = useState(false);

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

  const fetchData = () => {
    Promise.all([
      apiGet('/ngo-admin/stations'),
      apiGet('/ngo-admin/ngos'),
      apiGet('/ngo-admin/fro-workers'),
    ]).then(([s, n, f]) => {
      const list = Array.isArray(s) ? s : [];
      setStations(list);
      setAllNgos(Array.isArray(n) ? n : []);
      setFroWorkers(Array.isArray(f) ? f : []);
    }).catch(() => {});
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiGet('/ngo-admin/stations'),
      apiGet('/ngo-admin/ngos'),
      apiGet('/ngo-admin/fro-workers'),
    ]).then(([s, n, f]) => {
      const list = Array.isArray(s) ? s : [];
      setStations(list);
      setAllNgos(Array.isArray(n) ? n : []);
      setFroWorkers(Array.isArray(f) ? f : []);
      setNewStation(computeNextName(list));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleAddStation = async () => {
    if (!newStation.trim()) return;
    setAdding(true);
    try {
      await apiPost('/ngo-admin/stations', {
        station: newStation.trim(),
        ngo_ids: newStationNgos,
      });
      setNewStationNgos([]);
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

  const handleNgoChange = async (station, ngoIds) => {
    try {
      await apiPut(`/ngo-admin/stations/${encodeURIComponent(station)}/update-ngos`, { ngo_ids: ngoIds });
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
        ngo_ids: s.ngos.map(n => n.ngo_id),
        fro_worker_id: froWorkerId,
      });
      fetchData();
    } catch (err) {
      alert(err.message);
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
            <div>
              <label className="field" style={{ marginBottom: 0 }}>
                NGOs
                <button type="button" className="btn btn-outline" onClick={() => setNewNgoModalOpen(true)} style={{ width: '100%', textAlign: 'left' }}>
                  {newStationNgos.length > 0
                    ? `${newStationNgos.length} NGOs selected`
                    : 'Select NGOs'}
                </button>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Stations</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="count">{stations.length} stations</span>
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {stations.map((s, i) => (
                  <tr key={s.station}>
                    <td><strong>{s.station}</strong></td>
                    <td>
                      <span onClick={() => setEditNgoStation(s.station)}
                        style={{ cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
                        {s.ngos.length > 0
                          ? s.ngos.map(n => n.ngo_name).join(', ')
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
                    <td><span className="pill pill-blue">{s.donor_count}</span></td>
                    <td>
                      <button className="btn btn-sm btn-outline" onClick={() => handleDeleteStation(s.station)}
                        style={{ color: 'var(--danger)' }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editNgoStation && (
        <NgoSelectModal
          allNgos={allNgos}
          selectedIds={stations.find(s => s.station === editNgoStation)?.ngos.map(n => n.ngo_id) || []}
          onSave={(ids) => { handleNgoChange(editNgoStation, ids); setEditNgoStation(null); }}
          onClose={() => setEditNgoStation(null)}
        />
      )}

      {newNgoModalOpen && (
        <NgoSelectModal
          allNgos={allNgos}
          selectedIds={newStationNgos}
          onSave={(ids) => { setNewStationNgos(ids); setNewNgoModalOpen(false); }}
          onClose={() => setNewNgoModalOpen(false)}
        />
      )}
    </div>
  );
}
