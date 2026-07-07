import { useState, useEffect, useMemo } from 'react'
import { api } from '../api/auth'

/* ============ MINT PALETTE (same as Dashboard) ============ */
const MINT = '#8CCDA4'
const MINT_DEEP = '#2A6B45'
const MINT_DARK = '#1E4D3B'
const MINT_LIGHT = '#EAF7EE'
const BLUSH = '#F7B2AD'
const RED_DEEP = '#C0473C'
const GOLD = '#E0A73C'
const GOLD_LIGHT = '#F6C979'
const SLATE = '#4C7C8C'
const PRIMARY = '#1F332B'

const CATEGORIES = ['Electronics', 'Mobile & SIM', 'Furniture', 'Vehicle', 'Field Kit', 'Electrical', 'Pantry', 'Safety', 'Digital']
const DEPARTMENTS = ['FRO', 'Accounts', 'HR', 'Admin', 'Digital', 'Reception', 'NGO Admin', 'Common']
const CONDITIONS = ['New', 'Good', 'Average', 'Damaged']

/* Common items per category — entry karte time suggestions ke liye */
const ITEM_SUGGESTIONS = {
  'Electronics': ['Laptop', 'Desktop Computer', 'Monitor', 'Keyboard', 'Mouse', 'Printer', 'Scanner', 'WiFi Router', 'UPS', 'Hard Disk', 'Pen Drive', 'Tablet', 'Projector', 'TV Screen', 'CCTV Camera', 'Biometric Attendance Machine', 'Charger', 'Power Bank'],
  'Mobile & SIM': ['Mobile Phone', 'SIM Card', 'Landline Phone', 'Intercom'],
  'Furniture': ['Office Table', 'Office Chair', 'Boss Cabin Table', 'Boss Cabin Chair', 'Sofa', 'Almirah', 'Cupboard', 'Filing Cabinet', 'Whiteboard', 'Notice Board', 'Shoe Rack'],
  'Vehicle': ['Bike', 'Scooty', 'Car', 'Helmet'],
  'Field Kit': ['ID Card', 'Uniform / T-Shirt', 'Bag', 'Receipt Book', 'Donation Kit', 'Banner', 'Standee', 'POS / Card Swipe Machine'],
  'Electrical': ['AC', 'Fan', 'Light / Tubelight', 'Inverter', 'Battery', 'Generator', 'Extension Board', 'Water Purifier (RO)'],
  'Pantry': ['Fridge', 'Microwave', 'Electric Kettle', 'Water Dispenser', 'Bartan Set'],
  'Safety': ['Fire Extinguisher', 'First Aid Box', 'Lock', 'Safe / Tijori'],
  'Digital': ['Software License', 'Domain Name', 'Hosting', 'Paid Subscription'],
}

const STATUS_META = {
  available:   { label: 'Available',   bg: '#D6E4FB', text: '#2B5FB3' },
  assigned:    { label: 'Assigned',    bg: '#B9EFCE', text: '#1B7A3D' },
  repair:      { label: 'Repair',      bg: '#FDE0BC', text: '#B37122' },
  not_working: { label: 'Not Working', bg: '#FBDBD6', text: '#B3392B' },
  lost:        { label: 'Lost',        bg: '#F3D4D0', text: '#8E2C21' },
  scrapped:    { label: 'Scrapped',    bg: '#E5E7EB', text: '#4B5563' },
}

const money = v => `₹${Number(v || 0).toLocaleString('en-IN')}`
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const daysSince = d => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 0
const daysUntil = d => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null

/* ================= CSV EXPORT ================= */
function exportAssets(assets) {
  const rows = [['ASSET REGISTER'], ['Generated', new Date().toLocaleString('en-IN')], []]
  rows.push(['Code', 'Name', 'Category', 'Brand', 'Model', 'Serial No', 'Department', 'Condition', 'Status', 'Assigned To', 'Purchase Date', 'Price', 'Warranty Expiry', 'SIM Number', 'Remarks'])
  assets.forEach(a => rows.push([
    a.code, a.name, a.category, a.brand || '', a.model || '', a.serial_no || '', a.department || '',
    a.condition || '', STATUS_META[a.status]?.label || a.status, a.assigned_to_name || '',
    a.purchase_date || '', a.purchase_price || 0, a.warranty_expiry || '', a.sim_number || '', a.remarks || '',
  ]))
  const csv = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `asset-register-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/* ================= SMALL PIECES ================= */
function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.available
  return <span className="ar-badge" style={{ background: m.bg, color: m.text }}>{m.label}</span>
}

function Field({ label, children }) {
  return (
    <div className="ar-field">
      <span className="ar-field-label">{label}</span>
      <div className="ar-field-input">{children}</div>
    </div>
  )
}

/* ================= ADD / EDIT ASSET MODAL ================= */
function AssetFormModal({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial || {
    name: '', category: 'Electronics', brand: '', model: '', serial_no: '',
    department: 'Common', condition: 'New', status: 'available',
    purchase_date: '', purchase_price: '', vendor: '', warranty_expiry: '',
    sim_number: '', sim_operator: '', sim_plan: '', remarks: '',
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const isSim = f.category === 'Mobile & SIM'

  return (
    <div className="ar-overlay" onClick={onClose}>
      <div className="ar-modal" onClick={e => e.stopPropagation()}>
        <div className="ar-modal-head">
          <h3 className="ar-modal-title">{initial ? 'Edit Asset' : 'Add New Asset'}</h3>
          <button className="ar-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="ar-modal-body">
          <div className="ar-form-grid">
            <Field label="Asset Name *">
              <input value={f.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Dell Laptop" list="ar-item-suggestions" />
              <datalist id="ar-item-suggestions">
                {(ITEM_SUGGESTIONS[f.category] || []).map(item => <option key={item} value={item} />)}
              </datalist>
            </Field>
            <Field label="Category *">
              <select value={f.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Brand / Company"><input value={f.brand} onChange={e => set('brand', e.target.value)} placeholder="Dell, Samsung..." /></Field>
            <Field label="Model"><input value={f.model} onChange={e => set('model', e.target.value)} placeholder="Inspiron 15" /></Field>
            <Field label="Serial No / IMEI"><input value={f.serial_no} onChange={e => set('serial_no', e.target.value)} /></Field>
            <Field label="Department">
              <select value={f.department} onChange={e => set('department', e.target.value)}>
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Condition">
              <select value={f.condition} onChange={e => set('condition', e.target.value)}>
                {CONDITIONS.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Purchase Date"><input type="date" value={f.purchase_date} onChange={e => set('purchase_date', e.target.value)} /></Field>
            <Field label="Purchase Price (₹)"><input type="number" value={f.purchase_price} onChange={e => set('purchase_price', e.target.value)} /></Field>
            <Field label="Vendor / Shop"><input value={f.vendor} onChange={e => set('vendor', e.target.value)} /></Field>
            <Field label="Warranty Expiry"><input type="date" value={f.warranty_expiry} onChange={e => set('warranty_expiry', e.target.value)} /></Field>
            {isSim && <Field label="SIM Number (Mobile No.)"><input value={f.sim_number} onChange={e => set('sim_number', e.target.value)} placeholder="98XXXXXXXX" /></Field>}
            {isSim && <Field label="Operator">
              <select value={f.sim_operator} onChange={e => set('sim_operator', e.target.value)}>
                <option value="">—</option><option>Jio</option><option>Airtel</option><option>Vi</option><option>BSNL</option>
              </select>
            </Field>}
            {isSim && <Field label="Monthly Plan (₹)"><input type="number" value={f.sim_plan} onChange={e => set('sim_plan', e.target.value)} /></Field>}
            <Field label="Remarks"><input value={f.remarks} onChange={e => set('remarks', e.target.value)} /></Field>
          </div>
        </div>
        <div className="ar-modal-foot">
          <button className="ar-btn ar-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="ar-btn ar-btn-primary" disabled={!f.name.trim()} onClick={() => onSave(f)}>
            {initial ? 'Save Changes' : 'Add Asset'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ================= ACTION MODAL (assign / return / repair) ================= */
function ActionModal({ type, asset, workers, onClose, onDone }) {
  const [workerId, setWorkerId] = useState('')
  const [condition, setCondition] = useState(asset.condition || 'Good')
  const [shop, setShop] = useState('')
  const [cost, setCost] = useState('')
  const [note, setNote] = useState('')

  const titles = { assign: 'Assign Asset', return: 'Return Asset', repair: 'Send to Repair', repair_done: 'Repair Complete' }

  function submit() {
    if (type === 'assign') {
      const w = workers.find(x => String(x.id) === String(workerId))
      onDone({ status: 'assigned', assigned_to: workerId, assigned_to_name: w?.name || '', assigned_date: new Date().toISOString().slice(0, 10) },
        `Assigned to ${w?.name || 'worker'}${note ? ` — ${note}` : ''}`)
    } else if (type === 'return') {
      onDone({ status: 'available', assigned_to: null, assigned_to_name: '', condition },
        `Returned by ${asset.assigned_to_name || 'worker'} — condition: ${condition}${note ? ` — ${note}` : ''}`)
    } else if (type === 'repair') {
      onDone({ status: 'repair', repair_shop: shop, repair_cost: cost, repair_date: new Date().toISOString().slice(0, 10) },
        `Sent to repair — ${shop || 'shop'}${cost ? `, ${money(cost)}` : ''}${note ? ` — ${note}` : ''}`)
    } else if (type === 'repair_done') {
      onDone({ status: asset.assigned_to ? 'assigned' : 'available', condition, repair_shop: '', repair_date: null,
        total_repair_cost: Number(asset.total_repair_cost || 0) + Number(asset.repair_cost || 0) },
        `Repair complete — condition: ${condition}`)
    }
  }

  return (
    <div className="ar-overlay" onClick={onClose}>
      <div className="ar-modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="ar-modal-head">
          <h3 className="ar-modal-title">{titles[type]} — {asset.code}</h3>
          <button className="ar-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="ar-modal-body">
          {type === 'assign' && (
            <Field label="Worker *">
              <select value={workerId} onChange={e => setWorkerId(e.target.value)}>
                <option value="">Select worker...</option>
                {workers.map(w => <option key={w.id} value={w.id}>{w.name} {w.department ? `(${w.department})` : ''}</option>)}
              </select>
            </Field>
          )}
          {(type === 'return' || type === 'repair_done') && (
            <Field label="Condition Check">
              <select value={condition} onChange={e => setCondition(e.target.value)}>
                {CONDITIONS.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
          )}
          {type === 'repair' && (
            <>
              <Field label="Repair Shop / Person"><input value={shop} onChange={e => setShop(e.target.value)} placeholder="e.g. Sharma Computers" /></Field>
              <Field label="Estimated Cost (₹)"><input type="number" value={cost} onChange={e => setCost(e.target.value)} /></Field>
            </>
          )}
          <Field label="Note (optional)"><input value={note} onChange={e => setNote(e.target.value)} /></Field>
        </div>
        <div className="ar-modal-foot">
          <button className="ar-btn ar-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="ar-btn ar-btn-primary" disabled={type === 'assign' && !workerId} onClick={submit}>Confirm</button>
        </div>
      </div>
    </div>
  )
}

/* ================= ASSET DETAIL MODAL ================= */
function AssetDetailModal({ asset, onClose, onAction, onEdit, onScrap, onLost }) {
  const repairDays = asset.status === 'repair' ? daysSince(asset.repair_date) : 0
  const warrantyDays = daysUntil(asset.warranty_expiry)
  const totalRepair = Number(asset.total_repair_cost || 0) + (asset.status === 'repair' ? Number(asset.repair_cost || 0) : 0)
  const repairHeavy = asset.purchase_price && totalRepair > Number(asset.purchase_price) / 2

  return (
    <div className="ar-overlay" onClick={onClose}>
      <div className="ar-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="ar-modal-head">
          <div>
            <h3 className="ar-modal-title">{asset.name} <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: 12 }}>({asset.code})</span></h3>
            <div style={{ marginTop: 4 }}><StatusBadge status={asset.status} /></div>
          </div>
          <button className="ar-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="ar-modal-body">
          {asset.status === 'repair' && repairDays > 30 && (
            <div className="ar-inline-alert">⚠ Ye asset {repairDays} din se repair mein hai — follow up karo!</div>
          )}
          {warrantyDays !== null && warrantyDays > 0 && warrantyDays <= 30 && (
            <div className="ar-inline-alert" style={{ background: 'rgba(246,201,121,0.25)', borderColor: GOLD_LIGHT, color: '#8a6210' }}>
              ⏰ Warranty {warrantyDays} din mein expire ho rahi hai
            </div>
          )}
          {repairHeavy && (
            <div className="ar-inline-alert">💡 Total repair cost ({money(totalRepair)}) price ke aadhe se zyada ho gayi — naya lena consider karo.</div>
          )}

          <table className="ar-info-table">
            <tbody>
              <tr><td>Category</td><td>{asset.category}</td></tr>
              <tr><td>Brand / Model</td><td>{[asset.brand, asset.model].filter(Boolean).join(' ') || '—'}</td></tr>
              <tr><td>Serial No / IMEI</td><td><code>{asset.serial_no || '—'}</code></td></tr>
              <tr><td>Department</td><td>{asset.department || '—'}</td></tr>
              <tr><td>Condition</td><td>{asset.condition || '—'}</td></tr>
              <tr><td>Assigned To</td><td>{asset.assigned_to_name ? `${asset.assigned_to_name} (${fmtDate(asset.assigned_date)} se)` : '—'}</td></tr>
              <tr><td>Purchase</td><td>{fmtDate(asset.purchase_date)} · {money(asset.purchase_price)} {asset.vendor ? `· ${asset.vendor}` : ''}</td></tr>
              <tr><td>Warranty</td><td>{fmtDate(asset.warranty_expiry)}</td></tr>
              {asset.sim_number && <tr><td>SIM Number</td><td><code>{asset.sim_number}</code> {asset.sim_operator ? `(${asset.sim_operator})` : ''} {asset.sim_plan ? `· ${money(asset.sim_plan)}/month` : ''}</td></tr>}
              {asset.status === 'repair' && <tr><td>Repair</td><td>{asset.repair_shop || '—'} · {money(asset.repair_cost)} · {repairDays} din se</td></tr>}
              {totalRepair > 0 && <tr><td>Total Repair Cost</td><td>{money(totalRepair)}</td></tr>}
              {asset.remarks && <tr><td>Remarks</td><td>{asset.remarks}</td></tr>}
            </tbody>
          </table>

          {/* actions */}
          <div className="ar-actions">
            {(asset.status === 'available' || asset.status === 'not_working') && <button className="ar-btn ar-btn-primary" onClick={() => onAction('assign')}>Assign</button>}
            {asset.status === 'assigned' && <button className="ar-btn ar-btn-primary" onClick={() => onAction('return')}>Return</button>}
            {(asset.status === 'available' || asset.status === 'assigned' || asset.status === 'not_working') && <button className="ar-btn ar-btn-amber" onClick={() => onAction('repair')}>Send to Repair</button>}
            {asset.status === 'repair' && <button className="ar-btn ar-btn-primary" onClick={() => onAction('repair_done')}>Repair Done</button>}
            <button className="ar-btn ar-btn-ghost" onClick={onEdit}>Edit</button>
            {asset.status !== 'lost' && <button className="ar-btn ar-btn-red-ghost" onClick={onLost}>Mark Lost</button>}
            {asset.status !== 'scrapped' && <button className="ar-btn ar-btn-red-ghost" onClick={onScrap}>Scrap</button>}
          </div>

          {/* history */}
          <h4 className="ar-sub-title">History</h4>
          {(asset.history || []).length === 0 ? (
            <p className="ar-muted">No history yet.</p>
          ) : (
            <div className="ar-history">
              {[...asset.history].reverse().map((h, i) => (
                <div key={i} className="ar-history-row">
                  <span className="ar-history-dot" />
                  <div>
                    <span className="ar-history-text">{h.text}</span>
                    <span className="ar-history-date">{fmtDate(h.date)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ================= MAIN PAGE ================= */
export default function AssetRegister() {
  const [assets, setAssets] = useState([])
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false) // backend endpoints not ready yet
  const [q, setQ] = useState('')
  const [fCat, setFCat] = useState('all')
  const [fStatus, setFStatus] = useState('all')
  const [fDept, setFDept] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editAsset, setEditAsset] = useState(null)
  const [action, setAction] = useState(null) // { type }

  useEffect(() => {
    // Backend endpoint: GET /assets → [{ id, code, name, category, ... , history: [{date, text}] }]
    api('/assets')
      .then(list => setAssets(Array.isArray(list) ? list : list?.data || []))
      .catch(() => setOffline(true))
      .finally(() => setLoading(false))
    api('/workers')
      .then(list => setWorkers(Array.isArray(list) ? list : list?.data || []))
      .catch(() => {})
  }, [])

  const selected = assets.find(a => a.id === selectedId) || null

  /* ---- summary ---- */
  const summary = useMemo(() => {
    const s = { total: assets.length, assigned: 0, available: 0, repair: 0, not_working: 0, value: 0 }
    assets.forEach(a => {
      if (s[a.status] !== undefined) s[a.status]++
      if (a.status !== 'scrapped' && a.status !== 'lost') s.value += Number(a.purchase_price || 0)
    })
    return s
  }, [assets])

  /* ---- alerts ---- */
  const warrantySoon = assets.filter(a => { const d = daysUntil(a.warranty_expiry); return d !== null && d > 0 && d <= 30 })
  const longRepair = assets.filter(a => a.status === 'repair' && daysSince(a.repair_date) > 30)

  /* ---- filtered list ---- */
  const filtered = assets.filter(a => {
    if (fCat !== 'all' && a.category !== fCat) return false
    if (fStatus !== 'all' && a.status !== fStatus) return false
    if (fDept !== 'all' && a.department !== fDept) return false
    if (q.trim()) {
      const s = q.trim().toLowerCase()
      return [a.code, a.name, a.brand, a.model, a.serial_no, a.assigned_to_name, a.sim_number]
        .some(v => (v || '').toLowerCase().includes(s))
    }
    return true
  })

  /* ---- category counts (mini chart) ---- */
  const catCounts = useMemo(() => {
    const m = {}
    assets.forEach(a => { m[a.category] = (m[a.category] || 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [assets])
  const maxCat = Math.max(1, ...catCounts.map(([, v]) => v))

  /* ---- helpers to update an asset (API + local fallback) ---- */
  function nextCode() {
    const max = assets.reduce((m, a) => {
      const n = parseInt(String(a.code || '').replace(/\D/g, ''), 10)
      return isNaN(n) ? m : Math.max(m, n)
    }, 0)
    return `AST-${String(max + 1).padStart(3, '0')}`
  }

  function addHistory(a, text) {
    return [...(a.history || []), { date: new Date().toISOString().slice(0, 10), text }]
  }

  function saveNew(form) {
    const asset = { ...form, id: `local-${Date.now()}`, code: nextCode(), status: form.status || 'available',
      history: [{ date: new Date().toISOString().slice(0, 10), text: 'Asset registered' }] }
    // Backend endpoint: POST /assets
    api('/assets', { method: 'POST', body: JSON.stringify(asset) })
      .then(saved => setAssets(p => [...p, saved?.id ? saved : asset]))
      .catch(() => setAssets(p => [...p, asset]))
    setShowAdd(false)
  }

  function saveEdit(form) {
    updateAsset(editAsset.id, form, 'Details updated')
    setEditAsset(null)
  }

  function updateAsset(id, changes, historyText) {
    const current = assets.find(a => a.id === id)
    const newHistory = historyText && current ? addHistory(current, historyText) : current?.history || []
    setAssets(p => p.map(a => a.id === id
      ? { ...a, ...changes, history: newHistory }
      : a))
    // Backend endpoint: PUT /assets/:id (history bhi saath save hoti hai)
    api(`/assets/${id}`, { method: 'PUT', body: JSON.stringify({ ...changes, history: newHistory }) }).catch(() => {})
  }

  function doAction(changes, historyText) {
    updateAsset(selected.id, changes, historyText)
    setAction(null)
  }

  return (
    <div className="sa-page" style={{ maxWidth: 1280, margin: '0 auto' }}>
      <style>{`
        .ar-card {
          background: #fff; border: 1px solid #DFEDE4; border-radius: 20px; padding: 20px;
          box-shadow: 0 1px 2px rgba(30,77,59,0.04), 0 8px 24px -12px rgba(30,77,59,0.08);
        }
        .ar-title { font-size: 13px; font-weight: 700; color: ${MINT_DARK}; text-transform: uppercase; letter-spacing: 1.2px; margin: 0; }
        .ar-muted { color: #94a3b8; font-size: 13px; }
        .ar-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; }
        .ar-header h2 { margin: 0; color: ${MINT_DARK}; }

        .ar-btn {
          border: none; border-radius: 10px; padding: 8px 16px; font-size: 12.5px; font-weight: 700;
          cursor: pointer; font-family: inherit; transition: opacity .15s, transform .15s;
        }
        .ar-btn:hover { opacity: .9; transform: translateY(-1px); }
        .ar-btn:disabled { opacity: .45; cursor: not-allowed; transform: none; }
        .ar-btn-primary { background: ${MINT_DARK}; color: #fff; }
        .ar-btn-amber { background: ${GOLD}; color: #fff; }
        .ar-btn-ghost { background: ${MINT_LIGHT}; color: ${MINT_DARK}; }
        .ar-btn-red-ghost { background: rgba(247,178,173,0.25); color: ${RED_DEEP}; }

        .ar-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; margin-bottom: 18px; }
        .ar-stat { background: #fff; border: 1px solid #DFEDE4; border-left: 4px solid ${MINT}; border-radius: 14px; padding: 14px 16px; }
        .ar-stat-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .6px; }
        .ar-stat-value { font-size: 26px; font-weight: 800; color: ${PRIMARY}; line-height: 1.3; }

        .ar-alert {
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
          background: rgba(247,178,173,0.20); border: 1px solid #F2C0BA; border-radius: 12px;
          padding: 8px 16px; margin-bottom: 16px; font-size: 12.5px; color: ${PRIMARY}; font-weight: 600;
        }
        .ar-inline-alert {
          background: rgba(247,178,173,0.20); border: 1px solid #F2C0BA; border-radius: 10px;
          padding: 8px 12px; margin-bottom: 10px; font-size: 12.5px; color: ${RED_DEEP}; font-weight: 600;
        }

        .ar-filters { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
        .ar-filters input, .ar-filters select {
          border: 1px solid #DCEEE2; border-radius: 10px; padding: 8px 12px; font-size: 13px;
          font-family: inherit; color: ${PRIMARY}; background: #F6FAF7; outline: none;
        }
        .ar-filters input:focus, .ar-filters select:focus { border-color: ${MINT}; background: #fff; }
        .ar-filters input { flex: 1; min-width: 180px; }

        .ar-table-wrap { overflow: auto; }
        .ar-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; }
        .ar-table th {
          text-align: left; padding: 12px 10px; font-size: 11px; font-weight: 700; color: #94a3b8;
          text-transform: uppercase; letter-spacing: .6px; border-bottom: 1px solid #EAF3EC; white-space: nowrap;
        }
        .ar-table td { padding: 11px 10px; border-bottom: 1px solid #F0F7F2; vertical-align: middle; color: ${PRIMARY}; }
        .ar-table tbody tr { cursor: pointer; }
        .ar-table tbody tr:hover { background: ${MINT_LIGHT}; }
        .ar-code { font-weight: 700; color: ${MINT_DEEP}; }
        .ar-badge { display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 99px; white-space: nowrap; }

        .ar-bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
        @media (max-width: 800px) { .ar-bottom { grid-template-columns: 1fr; } }
        .ar-cat-row { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
        .ar-cat-label { width: 110px; font-size: 12px; font-weight: 700; color: ${PRIMARY}; text-align: right;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ar-cat-track { flex: 1; height: 12px; background: #F1F5F2; border-radius: 99px; overflow: hidden; }
        .ar-cat-fill { height: 100%; border-radius: 99px; background: ${MINT}; transition: width .7s ease; }
        .ar-cat-count { width: 30px; font-size: 12px; font-weight: 800; color: ${PRIMARY}; }

        .ar-overlay {
          position: fixed; inset: 0; z-index: 1000; background: rgba(31,51,43,0.45);
          backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        .ar-modal {
          background: #fff; border-radius: 20px; width: 100%; max-width: 640px; max-height: 85vh;
          display: flex; flex-direction: column; overflow: hidden;
          box-shadow: 0 24px 60px -12px rgba(31,51,43,0.35);
        }
        .ar-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 18px 20px; border-bottom: 1px solid #EAF3EC; }
        .ar-modal-title { margin: 0; font-size: 15px; font-weight: 700; color: ${PRIMARY}; }
        .ar-close {
          border: none; background: ${MINT_LIGHT}; border-radius: 10px; width: 32px; height: 32px;
          display: flex; align-items: center; justify-content: center; cursor: pointer; color: #64748b; flex-shrink: 0;
        }
        .ar-modal-body { overflow-y: auto; padding: 16px 20px; }
        .ar-modal-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px; border-top: 1px solid #EAF3EC; }

        .ar-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 560px) { .ar-form-grid { grid-template-columns: 1fr; } }
        .ar-field-label { display: block; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
        .ar-field-input input, .ar-field-input select {
          width: 100%; box-sizing: border-box; border: 1px solid #DCEEE2; border-radius: 10px;
          padding: 8px 10px; font-size: 13px; font-family: inherit; color: ${PRIMARY}; background: #F6FAF7; outline: none;
        }
        .ar-field-input input:focus, .ar-field-input select:focus { border-color: ${MINT}; background: #fff; }
        .ar-field { margin-bottom: 4px; }

        .ar-info-table { width: 100%; font-size: 13px; border-collapse: collapse; margin: 6px 0 14px; }
        .ar-info-table td { padding: 7px 6px; border-bottom: 1px solid #F0F7F2; color: ${PRIMARY}; }
        .ar-info-table td:first-child { color: #94a3b8; font-weight: 700; font-size: 11.5px; text-transform: uppercase; letter-spacing: .4px; width: 140px; }

        .ar-actions { display: flex; gap: 8px; flex-wrap: wrap; margin: 4px 0 16px; }
        .ar-sub-title { margin: 0 0 8px; font-size: 12px; font-weight: 700; color: ${MINT_DARK}; text-transform: uppercase; letter-spacing: 1px; }
        .ar-history { display: flex; flex-direction: column; gap: 10px; }
        .ar-history-row { display: flex; gap: 10px; align-items: flex-start; }
        .ar-history-dot { width: 8px; height: 8px; border-radius: 50%; background: ${MINT}; margin-top: 5px; flex-shrink: 0; }
        .ar-history-text { display: block; font-size: 13px; color: ${PRIMARY}; font-weight: 600; }
        .ar-history-date { display: block; font-size: 11px; color: #94a3b8; }
        .sk-ar { background: #EAF3EC; border-radius: 10px; animation: skp 1.2s ease infinite alternate; }
        @keyframes skp { from { opacity: .55; } to { opacity: 1; } }
      `}</style>

      {/* header */}
      <div className="ar-header">
        <div>
          <h2>Asset Register</h2>
          <p className="ar-muted" style={{ margin: '4px 0 0' }}>Accounts department — company ke saare assets ka pura record, assignment & repair tracking.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="ar-btn ar-btn-ghost" onClick={() => exportAssets(filtered)}>
            <span className="material-symbols-outlined" style={{ fontSize: 15, verticalAlign: 'text-bottom', marginRight: 4 }}>download</span>
            Export
          </button>
          <button className="ar-btn ar-btn-primary" onClick={() => setShowAdd(true)}>+ Add Asset</button>
        </div>
      </div>

      {offline && (
        <div className="ar-alert" style={{ background: 'rgba(246,201,121,0.22)', borderColor: GOLD_LIGHT }}>
          ⚙ Backend se data nahi mila — abhi ye page local mode mein chal raha hai. Backend mein ye endpoints add karne honge:
          <code style={{ background: '#fff', padding: '1px 8px', borderRadius: 6 }}>GET/POST /assets</code>
          <code style={{ background: '#fff', padding: '1px 8px', borderRadius: 6 }}>PUT /assets/:id</code>
        </div>
      )}

      {/* summary cards */}
      <div className="ar-stats">
        <div className="ar-stat"><span className="ar-stat-label">Total Assets</span><div className="ar-stat-value">{summary.total}</div></div>
        <div className="ar-stat" style={{ borderLeftColor: '#B9EFCE' }}><span className="ar-stat-label">Assigned</span><div className="ar-stat-value">{summary.assigned}</div></div>
        <div className="ar-stat" style={{ borderLeftColor: '#D6E4FB' }}><span className="ar-stat-label">Available</span><div className="ar-stat-value">{summary.available}</div></div>
        <div className="ar-stat" style={{ borderLeftColor: '#FDE0BC' }}><span className="ar-stat-label">In Repair</span><div className="ar-stat-value">{summary.repair}</div></div>
        <div className="ar-stat" style={{ borderLeftColor: '#FBDBD6' }}><span className="ar-stat-label">Not Working</span><div className="ar-stat-value">{summary.not_working}</div></div>
        <div className="ar-stat" style={{ borderLeftColor: MINT_DARK }}><span className="ar-stat-label">Total Value</span><div className="ar-stat-value" style={{ fontSize: 20 }}>{money(summary.value)}</div></div>
      </div>

      {/* alerts */}
      {(warrantySoon.length > 0 || longRepair.length > 0) && (
        <div className="ar-alert">
          <span className="material-symbols-outlined" style={{ color: RED_DEEP, fontSize: 18 }}>warning</span>
          {warrantySoon.length > 0 && <span>{warrantySoon.length} asset ki warranty 30 din mein expire ho rahi hai ({warrantySoon.map(a => a.code).join(', ')})</span>}
          {longRepair.length > 0 && <span>· {longRepair.length} asset 30+ din se repair mein ({longRepair.map(a => a.code).join(', ')})</span>}
        </div>
      )}

      {/* filters + table */}
      <div className="ar-card">
        <div className="ar-filters">
          <input placeholder="Search: code, name, serial no, SIM no, worker..." value={q} onChange={e => setQ(e.target.value)} />
          <select value={fCat} onChange={e => setFCat(e.target.value)}>
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={fStatus} onChange={e => setFStatus(e.target.value)}>
            <option value="all">All Status</option>
            {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
          <select value={fDept} onChange={e => setFDept(e.target.value)}>
            <option value="all">All Departments</option>
            {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>

        {loading ? (
          <div>{[1, 2, 3, 4].map(i => <div key={i} className="sk-ar" style={{ height: 40, marginBottom: 8 }} />)}</div>
        ) : filtered.length === 0 ? (
          <p className="ar-muted" style={{ padding: '20px 4px' }}>
            {assets.length === 0 ? 'Abhi koi asset add nahi hua. "+ Add Asset" se shuru karo!' : 'No assets match these filters.'}
          </p>
        ) : (
          <div className="ar-table-wrap">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>Code</th><th>Name</th><th>Category</th><th>Brand</th><th>Serial / SIM No</th>
                  <th>Department</th><th>Assigned To</th><th>Condition</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} onClick={() => setSelectedId(a.id)}>
                    <td className="ar-code">{a.code}</td>
                    <td style={{ fontWeight: 700 }}>{a.name}</td>
                    <td>{a.category}</td>
                    <td>{a.brand || '—'}</td>
                    <td><code style={{ fontSize: 12 }}>{a.sim_number || a.serial_no || '—'}</code></td>
                    <td>{a.department || '—'}</td>
                    <td>{a.assigned_to_name || '—'}</td>
                    <td>{a.condition || '—'}</td>
                    <td><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* bottom: category chart + recent activity */}
      <div className="ar-bottom">
        <div className="ar-card">
          <h3 className="ar-title">Category Wise Assets</h3>
          {catCounts.length === 0 ? <p className="ar-muted" style={{ marginTop: 10 }}>No data</p> : catCounts.map(([name, count]) => (
            <div key={name} className="ar-cat-row">
              <span className="ar-cat-label" title={name}>{name}</span>
              <div className="ar-cat-track"><div className="ar-cat-fill" style={{ width: `${Math.round((count / maxCat) * 100)}%` }} /></div>
              <span className="ar-cat-count">{count}</span>
            </div>
          ))}
        </div>
        <div className="ar-card">
          <h3 className="ar-title">Recent Activity</h3>
          <div className="ar-history" style={{ marginTop: 12 }}>
            {assets.flatMap(a => (a.history || []).map(h => ({ ...h, code: a.code, name: a.name })))
              .sort((x, y) => new Date(y.date) - new Date(x.date))
              .slice(0, 8)
              .map((h, i) => (
                <div key={i} className="ar-history-row">
                  <span className="ar-history-dot" />
                  <div>
                    <span className="ar-history-text">{h.code} ({h.name}) — {h.text}</span>
                    <span className="ar-history-date">{fmtDate(h.date)}</span>
                  </div>
                </div>
              ))}
            {assets.every(a => !(a.history || []).length) && <p className="ar-muted">No activity yet.</p>}
          </div>
        </div>
      </div>

      {/* modals */}
      {showAdd && <AssetFormModal onClose={() => setShowAdd(false)} onSave={saveNew} />}
      {editAsset && <AssetFormModal initial={editAsset} onClose={() => setEditAsset(null)} onSave={saveEdit} />}
      {selected && !action && !editAsset && (
        <AssetDetailModal
          asset={selected}
          onClose={() => setSelectedId(null)}
          onAction={type => setAction({ type })}
          onEdit={() => setEditAsset(selected)}
          onLost={() => updateAsset(selected.id, { status: 'lost' }, 'Marked as Lost')}
          onScrap={() => updateAsset(selected.id, { status: 'scrapped' }, 'Scrapped')}
        />
      )}
      {selected && action && (
        <ActionModal
          type={action.type}
          asset={selected}
          workers={workers}
          onClose={() => setAction(null)}
          onDone={doAction}
        />
      )}
    </div>
  )
}
