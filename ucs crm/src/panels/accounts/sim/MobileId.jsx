import { useEffect, useMemo, useState } from 'react';
import { useSim } from './store';
import { Icon } from './components';
import { effectiveStatus, dayClass, dayLabel, formatDate, pillForStatus, SIM_STATUSES, SIM_TYPES, SIM_SLOTS, daysLeft } from './helpers';
import { addSimCard, updateSimCard, deleteSimCard } from './api';
import { toast } from '../../../components/Toast';

function simSlots(c) {
  const out = [];
  for (let i = 1; i <= 8; i++) {
    if (c[`sim_${i}`]) out.push(c[`sim_${i}`]);
  }
  return out;
}

function daysFor(c) {
  if (c.days_left !== undefined && c.days_left !== null) return c.days_left;
  return daysLeft(c.expiry_date);
}

function MobileIdModal({ open, row, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    mobile_id: row?.mobile_id || '',
    device_model: row?.device_model || '',
    imei: row?.imei || '',
    team: row?.team || '',
    signature: row?.signature || '',
    sim_type: row?.sim_type || '',
    issue_date: row?.issue_date || '',
    expiry_date: row?.expiry_date || '',
    status: row?.status || 'Active',
  }));
  const [simList, setSimList] = useState(() => {
    const existing = [];
    for (let i = 1; i <= 8; i++) {
      const val = row?.[`sim_${i}`];
      if (val && String(val).trim()) existing.push(val);
    }
    return existing;
  });
  const [saving, setSaving] = useState(false);

  if (!open) return null;
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  function addSimField() { if (simList.length < 8) setSimList((p) => [...p, '']); }
  function removeSimField(idx) { setSimList((p) => p.filter((_, i) => i !== idx)); }
  function setSimVal(idx, val) { setSimList((p) => p.map((v, i) => i === idx ? val : v)); }

  async function handleSave() {
    if (!form.mobile_id || !form.device_model || !form.imei) {
      toast('Please fill required fields (Mobile ID, Device & Model, IMEI)', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      mobile_id: form.mobile_id,
      device_model: form.device_model,
      imei: form.imei,
      team: form.team,
      signature: form.signature,
      sim_type: form.sim_type || null,
      issue_date: form.issue_date || null,
      expiry_date: form.expiry_date || null,
      status: form.status,
    };
    const simFields = {};
    simList.filter((v) => v && String(v).trim()).forEach((v, i) => { simFields[`sim_${i + 1}`] = v; });
    for (let i = simList.filter((v) => v && String(v).trim()).length + 1; i <= 8; i++) { simFields[`sim_${i}`] = null; }
    Object.assign(payload, simFields);
    try {
      if (row) {
        await updateSimCard(row.id, payload);
        toast('Mobile ID updated', 'success');
      } else {
        await addSimCard(payload);
        toast('Mobile ID added', 'success');
      }
      onSaved();
      onClose();
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <h3>{row ? 'Edit Mobile ID' : 'Add Mobile ID'}</h3>
          <button className="modal-x" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-row">
              <label>Mobile ID No. *</label>
              <input value={form.mobile_id} onChange={(e) => set('mobile_id', e.target.value)} />
            </div>
            <div className="form-row">
              <label>Device & Model Name *</label>
              <input value={form.device_model} onChange={(e) => set('device_model', e.target.value)} />
            </div>
            <div className="form-row">
              <label>IMEI No. *</label>
              <input value={form.imei} onChange={(e) => set('imei', e.target.value)} />
            </div>
            <div className="form-row">
              <label>Team</label>
              <input value={form.team} onChange={(e) => set('team', e.target.value)} />
            </div>
            <div className="form-row">
              <label>Signature</label>
              <input value={form.signature} onChange={(e) => set('signature', e.target.value)} />
            </div>
            <div className="form-row">
              <label>SIM Type</label>
              <select value={form.sim_type} onChange={(e) => set('sim_type', e.target.value)}>
                <option value="">Select SIM Type</option>
                {SIM_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>SIM Card Issue Date</label>
              <input type="date" value={form.issue_date || ''} onChange={(e) => set('issue_date', e.target.value)} />
            </div>
            <div className="form-row">
              <label>Auto Expiry Date</label>
              <input type="date" value={form.expiry_date || ''} onChange={(e) => set('expiry_date', e.target.value)} />
            </div>
            <div className="form-row">
              <label>SIM Card Status</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                {SIM_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="section-title" style={{ margin: '18px 0 10px', fontSize: 13 }}>SIM Numbers</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {simList.map((val, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="form-row" style={{ flex: 1, marginBottom: 0 }}>
                  <label>SIM {idx + 1}</label>
                  <input value={val} onChange={(e) => setSimVal(idx, e.target.value)} placeholder={`SIM ${idx + 1}`} />
                </div>
                {simList.length > 1 && (
                  <button type="button" className="mini-btn danger" onClick={() => removeSimField(idx)} style={{ marginTop: 18, padding: '5px 8px', fontSize: 14, lineHeight: 1 }}>×</button>
                )}
              </div>
            ))}
            {simList.length < 8 && (
              <button type="button" className="sim-btn" onClick={addSimField} style={{ alignSelf: 'flex-start', marginTop: 2 }}>+ Add SIM</button>
            )}
          </div>
          <div className="form-row locked" style={{ marginTop: 14 }}>
            <label>SIM Card Replacement Count (read-only, auto-managed)</label>
            <input value={row?.replacement_count ?? 0} disabled />
          </div>
        </div>
        <div className="modal-foot">
          <button className="sim-btn" onClick={onClose}>Cancel</button>
          <button className="sim-btn primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Mobile ID'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileIdViewModal({ row, onClose }) {
  if (!row) return null;
  const dl = daysFor(row);
  const status = effectiveStatus(row);
  const Item = ({ k, v }) => (
    <div className="detail-item">
      <div className="k">{k}</div>
      <div className="v">{v || '—'}</div>
    </div>
  );
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal drawer" style={{ borderRadius: 14, marginLeft: 'auto', marginRight: 0 }}>
        <div className="modal-head">
          <h3>Mobile ID Details</h3>
          <button className="modal-x" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="detail-grid">
            <Item k="Mobile ID No." v={row.mobile_id} />
            <Item k="Device & Model" v={row.device_model} />
            <Item k="IMEI No." v={row.imei} />
            <Item k="Team" v={row.team} />
            <Item k="Signature" v={row.signature} />
            <Item k="Issue Date" v={formatDate(row.issue_date)} />
            <Item k="Auto Expiry Date" v={formatDate(row.expiry_date)} />
            <Item k="Expiry Days Left" v={dayLabel(dl)} />
            <Item k="SIM Card Status" v={status} />
            <Item k="Replacement Count" v={row.replacement_count ?? 0} />
            {simSlots(row).length > 0 && <Item k="SIM Numbers" v={simSlots(row).join(', ')} />}
          </div>
        </div>
        <div className="modal-foot">
          <button className="sim-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function MobileId() {
  const { cards, refresh } = useSim();
  const [search, setSearch] = useState('');
  const [team, setTeam] = useState('All');
  const [simStatus, setSimStatus] = useState('All');
  const [device, setDevice] = useState('All');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [showActions, setShowActions] = useState(null);
  const [modalRow, setModalRow] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewRow, setViewRow] = useState(null);

  const enriched = useMemo(() => cards.map((c) => ({ ...c, _status: effectiveStatus(c) })), [cards]);

  const total = enriched.length;
  const assigned = enriched.filter((c) => c.device_model).length;
  const available = total - assigned;
  const active = enriched.filter((c) => c._status === 'Active').length;

  const teams = useMemo(() => [...new Set(enriched.map((c) => c.team).filter(Boolean))].sort(), [enriched]);
  const devices = useMemo(() => [...new Set(enriched.map((c) => c.device_model).filter(Boolean))].sort(), [enriched]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter((c) =>
        (c.mobile_id || '').toLowerCase().includes(s) ||
        (c.team || '').toLowerCase().includes(s) ||
        (c.device_model || '').toLowerCase().includes(s) ||
        (c.imei || '').toLowerCase().includes(s)
      );
    }
    if (team !== 'All') list = list.filter((c) => c.team === team);
    if (simStatus !== 'All') list = list.filter((c) => c._status === simStatus);
    if (device !== 'All') list = list.filter((c) => c.device_model === device);
    return list;
  }, [enriched, search, team, simStatus, device]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * perPage;
  const pageRows = filtered.slice(start, start + perPage);

  useEffect(() => { setPage(1); }, [team, simStatus, device]);

  const clearFilters = () => { setSearch(''); setTeam('All'); setSimStatus('All'); setDevice('All'); setPage(1); };

  async function handleDelete(row) {
    if (!window.confirm(`Delete Mobile ID ${row.mobile_id || ''}? This cannot be undone.`)) return;
    try {
      await deleteSimCard(row.id);
      toast('Mobile ID deleted', 'success');
      refresh();
    } catch (e) {
      toast(e.message || 'Delete failed', 'error');
    }
  }

  const summary = [
    { label: 'Total Mobile IDs', val: total, icon: 'simcard', tint: { bg: '#eff6ff', color: '#2563eb' } },
    { label: 'Assigned Mobile IDs', val: assigned, icon: 'inventory', tint: { bg: '#f0fdf4', color: '#16a34a' } },
    { label: 'Available Mobile IDs', val: available, icon: 'sim', tint: { bg: '#fffbeb', color: '#d97706' } },
    { label: 'Active Mobile IDs', val: active, icon: 'check', tint: { bg: '#f0f9ff', color: '#0284c7' } },
  ];

  return (
    <div>
      <div className="grid-4">
        {summary.map((s) => (
          <div className="sim-card" key={s.label}>
            <div className="ic" style={{ background: s.tint.bg, color: s.tint.color }}>
              <Icon name={s.icon} size={18} />
            </div>
            <div className="title">{s.label}</div>
            <div className="num">{s.val}</div>
          </div>
        ))}
      </div>

      <div className="toolbar">
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: 10, color: 'var(--sim-ink-soft)', display: 'flex' }}><Icon name="search" size={15} /></span>
          <input className="sim-input search-input" placeholder="Search Mobile ID No..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 32 }} />
        </div>
        <select className="sim-select" value={team} onChange={(e) => { setTeam(e.target.value); setPage(1); }}>
          <option value="All">All Teams</option>
          {teams.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="sim-select" value={simStatus} onChange={(e) => { setSimStatus(e.target.value); setPage(1); }}>
          {['All', ...SIM_STATUSES].map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="sim-select" value={device} onChange={(e) => { setDevice(e.target.value); setPage(1); }}>
          <option value="All">All Devices</option>
          {devices.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <button className="sim-btn ghost" onClick={clearFilters}>Clear Filters</button>
        <button className="sim-btn primary" onClick={() => { setModalRow(null); setModalOpen(true); }}>+ Add Mobile ID</button>
      </div>

      <div className="card-block">
        <div className="table-wrap">
          {filtered.length === 0 ? (
            <div className="sim-box empty-state" style={{ border: 'none', boxShadow: 'none' }}>
              <div className="big">No Mobile IDs Found</div>
              <div className="small">Adjust filters or add a new Mobile ID to get started.</div>
              <button className="sim-btn primary" onClick={() => { setModalRow(null); setModalOpen(true); }}>+ Add Mobile ID</button>
            </div>
          ) : (
            <table className="sim-table">
              <thead>
                <tr>
                  <th>Mobile ID No.</th>
                  <th>Device &amp; Model Name</th>
                  <th>IMEI No.</th>
                  <th>Team</th>
                  <th>Signature</th>
                  <th className="num">SIM Card Issue Date</th>
                  <th className="num">Auto Expiry Date</th>
                  <th className="num">SIM Expiry Days Left</th>
                  <th>SIM Card Status</th>
                  {SIM_SLOTS.map((n) => <th key={n} className="num">SIM {n}</th>)}
                  <th className="num">SIM Card Replacement Count</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((c) => {
                  const dl = daysFor(c);
                  const slots = simSlots(c);
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.mobile_id || '—'}</td>
                      <td>{c.device_model || '—'}</td>
                      <td>{c.imei || '—'}</td>
                      <td>{c.team || '—'}</td>
                      <td>{c.signature || '—'}</td>
                      <td className="num">{formatDate(c.issue_date)}</td>
                      <td className="num">{formatDate(c.expiry_date)}</td>
                      <td className={`num days-cell ${dayClass(dl)}`}>{dayLabel(dl)}</td>
                      <td><span className={`pill ${pillForStatus(c._status)}`}>{c._status}</span></td>
                      {SIM_SLOTS.map((n) => <td key={n} className="num">{c[`sim_${n}`] || '—'}</td>)}
                      <td className="num">{c.replacement_count ?? 0}</td>
                      <td>
                        <div style={{ position: 'relative' }}>
                          <button className="mini-btn" onClick={() => setShowActions(showActions === c.id ? null : c.id)}>⋯</button>
                          {showActions === c.id && (
                            <div style={{ position: 'absolute', right: 0, top: 26, background: '#fff', border: '1px solid var(--sim-line)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 30, minWidth: 130, padding: 4 }}>
                              {[['View', () => setViewRow(c)], ['Edit', () => { setModalRow(c); setModalOpen(true); }], ['Delete', () => handleDelete(c)]].map(([label, fn]) => (
                                <button key={label} className="mini-btn" style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '8px 10px', borderRadius: 6 }} onClick={() => { setShowActions(null); fn(); }}>
                                  <span style={{ color: label === 'Delete' ? 'var(--sim-red)' : 'inherit' }}>{label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {filtered.length > 0 && (
          <div className="pagination">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--sim-ink-soft)' }}>
              <span>Showing {start + 1}–{Math.min(start + perPage, filtered.length)} of {filtered.length} Mobile IDs</span>
              <select className="sim-select" value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }} style={{ padding: '5px 8px' }}>
                {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} rows</option>)}
              </select>
            </div>
            <div className="pages">
              <button className="page-btn" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>‹</button>
              {Array.from({ length: Math.min(pageCount, 7) }, (_, i) => {
                let p = i + 1;
                if (pageCount > 7) {
                  const half = Math.floor(6 / 2);
                  const maxLeft = safePage - half;
                  const maxRight = safePage + half;
                  if (maxRight > pageCount) p = pageCount - 6 + i;
                  else if (maxLeft < 1) p = 1 + i;
                  else p = maxLeft + i;
                }
                return p >= 1 && p <= pageCount ? (
                  <button key={p} className={`page-btn ${p === safePage ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                ) : null;
              })}
              <button className="page-btn" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>›</button>
            </div>
          </div>
        )}
      </div>

      <MobileIdModal open={modalOpen} row={modalRow} onClose={() => { setModalOpen(false); setModalRow(null); }} onSaved={refresh} />
      <MobileIdViewModal row={viewRow} onClose={() => setViewRow(null)} />
    </div>
  );
}
