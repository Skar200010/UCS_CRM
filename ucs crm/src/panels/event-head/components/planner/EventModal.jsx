import { useEffect } from 'react'
import { X, Pencil, Trash, Eye } from '../../icons'

const STATUS_COLORS = {
  Draft: '#6B7280', Submitted: '#3485D4', Approved: '#16a34a',
  Rejected: '#dc2626', Completed: '#7B5EA7', Closed: '#374151',
  Cancelled: '#dc2626', Postponed: '#f59e0b',
}
const STATUS_BG = {
  Draft: '#f3f4f6', Submitted: '#dbeafe', Approved: '#dcfce7',
  Rejected: '#fef2f2', Completed: '#f3e8ff', Closed: '#e5e7eb',
  Cancelled: '#fef2f2', Postponed: '#fef3c7',
}
const PRIORITY_COLORS = { High: '#dc2626', Medium: '#f59e0b', Low: '#16a34a', Urgent: '#7c3aed' }

export default function EventModal({ event, onClose }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  if (!event) return null

  const formatTime = (t) => t ? t.slice(0, 5) : '--'
  const formatDate = (d) => d ? d.slice(0, 10) : '--'

  const fields = [
    { label: 'Category', value: event.category },
    { label: 'Status', value: event.status, badge: true, color: STATUS_COLORS[event.status], bg: STATUS_BG[event.status] },
    { label: 'Priority', value: event.priority, badge: true, color: PRIORITY_COLORS[event.priority] },
    { label: 'Date', value: formatDate(event.date) },
    { label: 'Start Time', value: formatTime(event.start_time) },
    { label: 'End Time', value: formatTime(event.end_time) },
    { label: 'Venue', value: event.venue },
    { label: 'District', value: event.district },
    { label: 'State', value: event.state },
    { label: 'GPS Location', value: event.gps_location },
    { label: 'NGO Partner', value: event.ngo_name || event.ngo_id },
    { label: 'CSR Partner', value: event.csr_partner },
    { label: 'Donor', value: event.donor },
    { label: 'Organizer', value: event.organizer },
    { label: 'Coordinator', value: event.coordinator },
    { label: 'Expected Beneficiaries', value: event.expected_beneficiaries },
    { label: 'Budget', value: event.budget ? `$${event.budget}` : '' },
    { label: 'Funding Source', value: event.funding_source },
  ]

  const hasDesc = event.description || event.notes
  const hasAttach = event.attachments

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ padding: 20 }}
    >
      <div
        className="modal"
        style={{
          maxWidth: 640,
          borderRadius: 14,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          color: '#1a1a2e',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <div className="modal-head" style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1a1a2e' }}>
              {event.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, border: 'none', borderRadius: 8,
              background: 'transparent', cursor: 'pointer', color: 'var(--ink-soft)',
              transition: 'all .12s', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg)'; e.currentTarget.style.color = 'var(--ink)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-soft)' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', background: '#fff' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px' }}>
            {fields.map(f => {
              if (!f.value) return null
              return (
                <div key={f.label}>
                  <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 1 }}>{f.label}</div>
                  {f.badge ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 10,
                      background: f.bg || f.color + '18',
                      color: f.color || '#1a1a2e',
                      fontSize: 12, fontWeight: 500,
                    }}>
                      {f.color && <span style={{ width: 6, height: 6, borderRadius: '50%', background: f.color, flexShrink: 0 }} />}
                      {f.value}
                    </span>
                  ) : (
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a2e' }}>{f.value}</div>
                  )}
                </div>
              )
            })}
          </div>

          {hasDesc && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Description & Notes</div>
              {event.description && <div style={{ fontSize: 13, color: '#1a1a2e', lineHeight: 1.5, marginBottom: 4 }}>{event.description}</div>}
              {event.notes && <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, fontStyle: 'italic' }}>{event.notes}</div>}
            </div>
          )}

          {hasAttach && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Attachments</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(Array.isArray(event.attachments) ? event.attachments : []).map((att, i) => (
                  <div key={i} style={{
                    padding: '4px 10px',
                    background: '#f5f6fa',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 11,
                    color: '#6b7280',
                    cursor: 'default',
                  }}>
                    {att.name || att}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
          padding: '12px 20px',
          borderTop: '1px solid #e5e7eb',
          background: '#fff',
        }}>
          <button className="btn btn-sm btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Pencil size={14} /> Edit Event
          </button>
          <button className="btn btn-sm btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--danger)', borderColor: 'var(--danger)' }}>
            <Trash size={14} /> Delete Event
          </button>
          <button className="btn btn-sm btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Eye size={14} /> View Full Event
          </button>
          <button className="btn btn-sm" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <X size={14} /> Close
          </button>
        </div>
      </div>
    </div>
  )
}
