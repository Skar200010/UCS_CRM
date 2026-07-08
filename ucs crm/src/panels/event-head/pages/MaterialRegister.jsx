import { useState, useEffect } from 'react'
import { MATERIAL_TYPES, fetchMaterials, createMaterial, updateMaterial } from '../store'
import { EnhancedTable } from '../components/Table'

export default function MaterialRegister() {
  const [materials, setMaterials] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editMat, setEditMat] = useState(null)
  const [form, setForm] = useState({ name:'', opening_stock:0, received:0, issued:0, cost:0, warehouse:'', donor:'' })

  useEffect(() => { fetchMaterials().then(setMaterials).catch(e => console.error('MaterialRegister fetchMaterials:', e)) }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const data = { ...form, balance: +form.opening_stock + +form.received - +form.issued }
    if (editMat) {
      await updateMaterial(editMat.id, data).then(() => { setMaterials(materials.map(m => m.id === editMat.id ? {...m,...data} : m)); setShowForm(false); setEditMat(null) }).catch(e => console.error('MaterialRegister updateMaterial:', e))
    } else {
      await createMaterial(data).then((res) => { setMaterials([...materials, res]); setShowForm(false) }).catch(e => console.error('MaterialRegister createMaterial:', e))
    }
  }

  const totalStock = materials.reduce((s, m) => s + (+m.opening_stock || 0) + (+m.received || 0), 0)
  const totalIssued = materials.reduce((s, m) => s + (+m.issued || 0), 0)
  const lowStock = materials.filter(m => (m.balance ?? m.opening_stock - m.issued) < 10).length

  const columns = [
    { header: 'Material', accessor: 'name', render: (row) => <span style={{ fontWeight: 500 }}>{row.name}</span> },
    { header: 'Opening', accessor: 'opening_stock' },
    { header: 'Received', accessor: 'received' },
    { header: 'Issued', accessor: 'issued' },
    { header: 'Balance', accessor: 'balance', render: (row) => {
      const bal = row.balance ?? row.opening_stock - row.issued
      return <span style={{ fontWeight: 600, color: bal < 10 ? '#B5603A' : 'inherit' }}>{bal}</span>
    }},
    { header: 'Cost', accessor: 'cost', render: (row) => '₹' + Number(row.cost).toLocaleString() },
    { header: 'Warehouse', accessor: 'warehouse' },
    { header: 'Donor', accessor: 'donor' },
  ]

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16 }}>Distribution Material Register</h3>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditMat(null); setForm({name:'',opening_stock:0,received:0,issued:0,cost:0,warehouse:'',donor:''}); setShowForm(true) }}>+ Add Material</button>
      </div>

      <div className="stats-grid" style={{ marginBottom: 16, gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card"><div className="stat-num" style={{ color: '#7B5EA7' }}>{materials.length}</div><div className="stat-lbl">Material Types</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#3485D4' }}>{totalStock}</div><div className="stat-lbl">Total Stock</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#16a34a' }}>{totalIssued}</div><div className="stat-lbl">Total Issued</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: lowStock > 0 ? '#B5603A' : 'var(--sage)' }}>{lowStock}</div><div className="stat-lbl">Low Stock Items</div></div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head"><h3>{editMat ? 'Edit' : 'Add'} Material</h3></div>
          <div className="card-pad">
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="field"><label>Material</label>
                  <select value={form.name} onChange={e => setForm({...form,name:e.target.value})} required>
                    <option value="">Select</option>{MATERIAL_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="field"><label>Opening Stock</label><input type="number" value={form.opening_stock} onChange={e => setForm({...form,opening_stock:+e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="field"><label>Received</label><input type="number" value={form.received} onChange={e => setForm({...form,received:+e.target.value})} /></div>
                <div className="field"><label>Issued</label><input type="number" value={form.issued} onChange={e => setForm({...form,issued:+e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="field"><label>Cost (₹)</label><input type="number" value={form.cost} onChange={e => setForm({...form,cost:+e.target.value})} /></div>
                <div className="field"><label>Warehouse</label><input value={form.warehouse} onChange={e => setForm({...form,warehouse:e.target.value})} /></div>
              </div>
              <div className="field"><label>Donor</label><input value={form.donor} onChange={e => setForm({...form,donor:e.target.value})} /></div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary btn-sm">Save</button>
                <button type="button" className="btn btn-sm" onClick={() => { setShowForm(false); setEditMat(null) }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <EnhancedTable
        columns={columns}
        data={materials}
        searchPlaceholder="Search materials..."
        pageSize={10}
      />
    </>
  )
}
