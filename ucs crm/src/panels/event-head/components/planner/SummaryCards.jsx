import { useMemo } from 'react'

const cards = [
  { key: 'total', label: 'Total Events', color: '#5B6B4E', icon: '📋' },
  { key: 'today', label: "Today's Events", color: '#3485D4', icon: '📅' },
  { key: 'upcoming', label: 'Upcoming Events', color: '#7B5EA7', icon: '🚀' },
  { key: 'completed', label: 'Completed', color: '#5B6B4E', icon: '✅' },
  { key: 'approved', label: 'Approved', color: '#16a34a', icon: '👍' },
  { key: 'submitted', label: 'Submitted', color: '#3485D4', icon: '📤' },
  { key: 'draft', label: 'Draft', color: '#6B7280', icon: '📝' },
  { key: 'cancelled', label: 'Cancelled', color: '#dc2626', icon: '❌' },
]

export default function SummaryCards({ summary }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: 10,
    }}>
      {cards.map(c => {
        const val = summary[c.key] ?? 0
        return (
          <div
            key={c.key}
            style={{
              background: 'var(--card-bg)',
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--shadow)',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              transition: 'box-shadow .15s, transform .15s',
              cursor: 'default',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: c.color + '15',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              flexShrink: 0,
            }}>
              {c.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2, color: c.color }}>{val}</div>
              <div style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
