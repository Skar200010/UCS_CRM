import { useState, useEffect } from 'react'
import { fetchEvents, updateEventStatus, deleteEvent, EVENT_STATUSES } from '../store'
import { EnhancedTable } from '../components/Table'

const statusColor = (s) => {
  const map = { Completed:'green', Approved:'blue', Draft:'gray', Submitted:'yellow', Rejected:'red', Cancelled:'red', Closed:'green', Postponed:'yellow' }
  return map[s] || 'gray'
}

export default function EventsPage() {
  const [events, setEvents] = useState([])
  const [filter, setFilter] = useState('')

  useEffect(() => { fetchEvents().then(setEvents).catch(e => console.error('EventsPage fetchEvents:', e)) }, [])

  const handleStatus = async (id, status) => {
    await updateEventStatus(id, status).then(() => setEvents(events.map(e => e.id === id ? {...e, status} : e))).catch(e => console.error('EventsPage updateEventStatus:', e))
  }
  const handleDelete = async (id) => {
    if (!confirm('Delete this event?')) return
    await deleteEvent(id).then(() => setEvents(events.filter(e => e.id !== id))).catch(e => console.error('EventsPage deleteEvent:', e))
  }

  const filtered = filter ? events.filter(e => e.status === filter) : events
  const sorted = [...filtered].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  const columns = [
    { header: 'Event ID', accessor: 'id', render: (row) => <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink-soft)' }}>#{row.id}</span> },
    { header: 'Name', accessor: 'name', render: (row) => <span style={{ fontWeight: 500 }}>{row.name}</span> },
    { header: 'Date', accessor: 'date', render: (row) => row.date?.slice(0, 10) || '—' },
    { header: 'Category', accessor: 'category' },
    { header: 'Venue', accessor: 'venue' },
    { header: 'Beneficiaries', accessor: 'expected_beneficiaries', render: (row) => row.expected_beneficiaries || '—' },
    { header: 'Budget', accessor: 'budget', render: (row) => row.budget ? '₹' + Number(row.budget).toLocaleString() : '—' },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => (
        <select value={row.status} onChange={e => handleStatus(row.id, e.target.value)}
          className={`pill pill-${statusColor(row.status)}`}
          style={{ border: 'none', fontSize: 11, cursor: 'pointer', padding: '2px 8px' }}>
          {EVENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      )
    },
    {
      header: '',
      render: (row) => <button className="btn btn-sm btn-icon" onClick={(e) => { e.stopPropagation(); handleDelete(row.id) }} title="Delete">✕</button>
    },
  ]

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h3 style={{ fontSize: 16 }}>All Events</h3>
        <div className="filter-bar" style={{ marginBottom: 0 }}>
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">All Status</option>
            {EVENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="stats-grid" style={{ marginBottom: 16, gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card"><div className="stat-num" style={{ color: '#7B5EA7' }}>{events.length}</div><div className="stat-lbl">Total</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#3485D4' }}>{events.filter(e => e.status === 'Approved').length}</div><div className="stat-lbl">Approved</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#5B6B4E' }}>{events.filter(e => e.status === 'Completed').length}</div><div className="stat-lbl">Completed</div></div>
        <div className="stat-card"><div className="stat-num" style={{ color: '#B5603A' }}>{events.filter(e => ['Draft', 'Submitted'].includes(e.status)).length}</div><div className="stat-lbl">Pending</div></div>
      </div>
      <EnhancedTable
        columns={columns}
        data={sorted}
        searchPlaceholder="Search events..."
        pageSize={10}
      />
    </>
  )
}
