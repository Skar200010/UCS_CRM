import { useState, useEffect } from 'react'
import { EXPENSE_TYPES, fetchEvents, fetchExpenses, createExpense, deleteExpense } from '../store'

export default function ExpenseManagement() {
  const [events, setEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState('')
  const [expenses, setExpenses] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type:'', amount:0, description:'', bill_attached:false })

  useEffect(() => { fetchEvents().then(setEvents).catch(e => console.error('ExpenseManagement fetchEvents:', e)) }, [])
  useEffect(() => {
    if (!selectedEvent) { setExpenses([]); return }
    fetchExpenses(selectedEvent).then(setExpenses).catch(e => console.error('ExpenseManagement fetchExpenses:', e))
  }, [selectedEvent])

  const total = expenses.reduce((s, e) => s + (+e.amount || 0), 0)
  const byType = {}
  expenses.forEach(e => { byType[e.type] = (byType[e.type] || 0) + (+e.amount || 0) })

  const handleSubmit = async (e) => {
    e.preventDefault()
    await createExpense(selectedEvent, form).then((res) => { setExpenses([...expenses, res]); setShowForm(false); setForm({type:'',amount:0,description:'',bill_attached:false}) }).catch(e => console.error('ExpenseManagement createExpense:', e))
  }
  const handleDelete = async (id) => {
    if (!confirm('Delete this expense?')) return
    await deleteExpense(selectedEvent, id).then(() => setExpenses(expenses.filter(e => e.id !== id))).catch(e => console.error('ExpenseManagement deleteExpense:', e))
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h3 style={{ fontSize: 16 }}>Expense Management</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} style={{ padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
            <option value="">Select Event</option>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)} disabled={!selectedEvent}>+ Add Expense</button>
        </div>
      </div>

      {selectedEvent && expenses.length > 0 && (
        <div className="stats-grid" style={{ marginBottom: 16, gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="stat-card"><div className="stat-num" style={{ color: 'var(--sage)' }}>₹{total.toLocaleString()}</div><div className="stat-lbl">Total Expenses</div></div>
          <div className="stat-card"><div className="stat-num" style={{ color: '#3485D4' }}>{expenses.length}</div><div className="stat-lbl">Transactions</div></div>
          <div className="stat-card"><div className="stat-num" style={{ color: '#B5603A' }}>{expenses.filter(e => e.bill_attached).length}</div><div className="stat-lbl">Bills Attached</div></div>
          <div className="stat-card"><div className="stat-num" style={{ color: '#7B5EA7' }}>{Object.keys(byType).length}</div><div className="stat-lbl">Expense Types</div></div>
        </div>
      )}

      {showForm && selectedEvent && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head"><h3>Add Expense</h3></div>
          <div className="card-pad">
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="field"><label>Type</label>
                  <select value={form.type} onChange={e => setForm({...form,type:e.target.value})} required>
                    <option value="">Select</option>{EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="field"><label>Amount (₹)</label><input type="number" value={form.amount} onChange={e => setForm({...form,amount:+e.target.value})} required /></div>
              </div>
              <div className="field"><label>Description</label><input value={form.description} onChange={e => setForm({...form,description:e.target.value})} placeholder="What was this expense for?" /></div>
              <div className="field" style={{ flexDirection: 'row', gap: 8 }}>
                <input type="checkbox" checked={form.bill_attached} onChange={e => setForm({...form,bill_attached:e.target.checked})} style={{ width: 18, height: 18 }} />
                <label style={{ fontSize: 13 }}>Bill Attached</label>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary btn-sm">Add</button>
                <button type="button" className="btn btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedEvent && (
        <div className="card">
          <div className="card-head">
            <h3>Expenses</h3>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--sage)' }}>Total: ₹{total.toLocaleString()}</span>
          </div>
          <div className="card-pad" style={{ padding: 0 }}>
            <table>
              <thead><tr><th>Type</th><th>Description</th><th>Amount</th><th>Bill</th><th></th></tr></thead>
              <tbody>
                {expenses.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--ink-soft)' }}>No expenses recorded</td></tr>}
                {expenses.map(ex => (
                  <tr key={ex.id}>
                    <td><span className="pill pill-blue">{ex.type}</span></td>
                    <td>{ex.description || '—'}</td>
                    <td style={{ fontWeight: 600 }}>₹{Number(ex.amount).toLocaleString()}</td>
                    <td>{ex.bill_attached ? <span className="pill pill-green">Yes</span> : '—'}</td>
                    <td><button className="btn btn-sm btn-icon" onClick={() => handleDelete(ex.id)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!selectedEvent && <div className="card"><div className="card-pad" style={{ textAlign: 'center', padding: 40, color: 'var(--ink-soft)' }}>Select an event to manage expenses</div></div>}
    </>
  )
}
