import { useState, useEffect } from 'react'
import { ASSET_TYPES, fetchAssets, createAsset, updateAsset, deleteAsset } from '../store'
import { EnhancedTable } from '../components/Table'

export default function AssetRegister() {
  const [assets, setAssets] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editAsset, setEditAsset] = useState(null)
  const [form, setForm] = useState({ name:'', quantity:1, purchase_cost:0, condition:'Good', location:'' })

  useEffect(() => { fetchAssets().then(setAssets).catch(e => console.error('AssetRegister fetchAssets:', e)) }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (editAsset) {
      await updateAsset(editAsset.id, form).then(() => { setAssets(assets.map(a => a.id === editAsset.id ? {...a,...form} : a)); setShowForm(false); setEditAsset(null) }).catch(e => console.error('AssetRegister updateAsset:', e))
    } else {
      await createAsset(form).then((res) => { setAssets([...assets, res]); setShowForm(false) }).catch(e => console.error('AssetRegister createAsset:', e))
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this asset?')) return
    await deleteAsset(id).then(() => setAssets(assets.filter(a => a.id !== id))).catch(e => console.error('AssetRegister deleteAsset:', e))
  }

  const totalValue = assets.reduce((s, a) => s + (+a.purchase_cost || 0) * (+a.quantity || 0), 0)
  const good = assets.filter(a => a.condition === 'Good').length

  const columns = [
    { header: 'Asset', accessor: 'name', render: (row) => <span style={{ fontWeight: 500 }}>{row.name}</span> },
    { header: 'Qty', accessor: 'quantity' },
    { header: 'Available', accessor: 'available_qty', render: (row) => row.available_qty ?? row.quantity },
    { header: 'Issued', accessor: 'issued_qty', render: (row) => row.issued_qty ?? 0 },
    { header: 'Damaged', accessor: 'damaged_qty', render: (row) => row.damaged_qty ?? 0 },
    { header: 'Condition', accessor: 'condition', render: (row) => <span className={`pill pill-${row.condition === 'Good' ? 'green' : row.condition === 'Damaged' ? 'red' : 'yellow'}`}>{row.condition}</span> },
    { header: 'Cost', accessor: 'purchase_cost', render: (row) => '₹' + Number(row.purchase_cost).toLocaleString() },
    { header: 'Location', accessor: 'location' },
    {
      header: '',
      render: (row) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-sm btn-icon" onClick={(e) => { e.stopPropagation(); setForm(row); setEditAsset(row); setShowForm(true) }} title="Edit">✎</button>
          <button className="btn btn-sm btn-icon" onClick={(e) => { e.stopPropagation(); handleDelete(row.id) }} title="Delete">✕</button>
        </div>
      )
    },
  ]

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16 }}>Asset Register</h3>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditAsset(null); setForm({name:'',quantity:1,purchase_cost:0,condition:'Good',location:''}); setShowForm(true) }}>+ Add Asset</button>
      </div>

      <div className="stats-grid" style={{ marginBottom: 16, gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card"><div className="stat-num" style={{ color: '#7B5EA7' }}>{assets.length}</div><div className="stat-lbl">Total Assets</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#16a34a' }}>{good}</div><div className="stat-lbl">Good Condition</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#B5603A' }}>{assets.filter(a => a.condition !== 'Good').length}</div><div className="stat-lbl">Needs Attention</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#3485D4' }}>₹{totalValue.toLocaleString()}</div><div className="stat-lbl">Total Value</div></div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head"><h3>{editAsset ? 'Edit' : 'Add'} Asset</h3></div>
          <div className="card-pad">
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="field"><label>Asset Name</label>
                  <select value={form.name} onChange={e => setForm({...form,name:e.target.value})} required>
                    <option value="">Select</option>{ASSET_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="field"><label>Quantity</label><input type="number" value={form.quantity} onChange={e => setForm({...form,quantity:+e.target.value})} min={1} /></div>
              </div>
              <div className="form-row">
                <div className="field"><label>Purchase Cost</label><input type="number" value={form.purchase_cost} onChange={e => setForm({...form,purchase_cost:+e.target.value})} /></div>
                <div className="field"><label>Condition</label>
                  <select value={form.condition} onChange={e => setForm({...form,condition:e.target.value})}>
                    <option value="Good">Good</option><option value="Fair">Fair</option><option value="Damaged">Damaged</option><option value="Under Repair">Under Repair</option>
                  </select>
                </div>
              </div>
              <div className="field"><label>Storage Location</label><input value={form.location} onChange={e => setForm({...form,location:e.target.value})} placeholder="e.g. Warehouse A, Shelf 3" /></div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary btn-sm">Save</button>
                <button type="button" className="btn btn-sm" onClick={() => { setShowForm(false); setEditAsset(null) }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <EnhancedTable
        columns={columns}
        data={assets}
        searchPlaceholder="Search assets..."
        pageSize={10}
      />
    </>
  )
}
