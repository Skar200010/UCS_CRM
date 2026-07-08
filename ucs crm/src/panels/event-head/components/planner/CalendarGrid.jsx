import { useMemo, useState, useCallback } from 'react'

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const PRIORITY_COLORS = { High: '#dc2626', Medium: '#f59e0b', Low: '#16a34a', Urgent: '#7c3aed' }
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
const CAT_COLORS = [
  '#7B5EA7','#B5603A','#C08A2E','#4F6472','#5B6B4E','#88693D','#3485D4','#6B7280','#BE185D'
]

function EventBadge({ type, value, size = 'sm' }) {
  if (!value) return null
  const isPriority = type === 'priority'
  const color = isPriority ? PRIORITY_COLORS[value] || '#6B7280' : STATUS_COLORS[value] || '#6B7280'
  const bg = isPriority ? color + '18' : STATUS_BG[value] || '#f3f4f6'
  const dotSize = size === 'sm' ? 5 : 7
  const fontSize = size === 'sm' ? 9 : 11

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '1px 5px',
        borderRadius: 10,
        background: bg,
        color: color,
        fontSize,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        lineHeight: 1.3,
      }}
    >
      <span style={{ width: dotSize, height: dotSize, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {value}
    </span>
  )
}

function EventTooltip({ show, event, x, y }) {
  if (!show || !event) return null

  const formatTime = (t) => t ? t.slice(0, 5) : '--'

  return (
    <div
      style={{
        position: 'fixed',
        left: Math.min(x, window.innerWidth - 260),
        top: Math.min(y, window.innerHeight - 200),
        zIndex: 9999,
        background: '#1a1a2e',
        color: '#fff',
        borderRadius: 10,
        padding: '10px 14px',
        fontSize: 11,
        lineHeight: 1.5,
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        minWidth: 200,
        maxWidth: 260,
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>{event.name}</div>
      <div style={{ color: '#94a3b8', marginBottom: 2 }}>
        {formatTime(event.start_time)} - {formatTime(event.end_time)}
      </div>
      {event.venue && <div style={{ color: '#94a3b8', marginBottom: 2 }}>📍 {event.venue}</div>}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
        <EventBadge type="priority" value={event.priority} />
        <EventBadge type="status" value={event.status} />
      </div>
    </div>
  )
}

function EventCard({ event, onClick, onHover, onLeave, ngoMap }) {
  const formatTime = (t) => t ? t.slice(0, 5) : '--'

  return (
    <div
      onClick={() => onClick(event)}
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        onHover({ show: true, event, x: rect.right + 8, y: rect.top })
      }}
      onMouseLeave={onLeave}
      style={{
        background: 'var(--bg)',
        borderRadius: 6,
        padding: '5px 6px',
        marginBottom: 3,
        cursor: 'pointer',
        transition: 'all .12s',
        borderLeft: '3px solid transparent',
      }}
      onMouseOver={e => {
        e.currentTarget.style.background = '#e8eaed'
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'
      }}
      onMouseOut={e => {
        e.currentTarget.style.background = 'var(--bg)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 10, lineHeight: 1.3, color: 'var(--ink)', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {event.name}
      </div>
      <div style={{ fontSize: 9, color: 'var(--ink-soft)', marginBottom: 1 }}>
        {formatTime(event.start_time)} - {formatTime(event.end_time)}
      </div>
      {event.venue && (
        <div style={{ fontSize: 8, color: 'var(--ink-soft)', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ngoMap[event.ngo_id] && <>{ngoMap[event.ngo_id]} · </>}{event.venue}
        </div>
      )}
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 2 }}>
        <EventBadge type="priority" value={event.priority} />
        <EventBadge type="status" value={event.status} />
      </div>
    </div>
  )
}

function CalendarCell({ day, events, month, year, isToday, onClick, onHover, onLeave, ngoMap, onShowModal }) {
  const [hovered, setHovered] = useState(false)

  if (!day) return <div style={{ minHeight: 110, background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', padding: 4 }} />

  const dow = new Date(year, month, day).getDay()
  const isWeekend = dow === 0 || dow === 6
  const maxVisible = 3
  const visibleEvents = events.slice(0, maxVisible)
  const moreCount = events.length - maxVisible

  return (
    <div
      style={{
        minHeight: 110,
        background: isToday ? 'var(--sage-light)' : isWeekend ? '#f8f6ff' : 'var(--card-bg)',
        border: isToday ? '1px solid var(--sage)' : isWeekend ? '1px solid #e8e4f0' : '1px solid var(--line)',
        borderRadius: 'var(--radius-sm)',
        padding: 4,
        fontSize: 12,
        position: 'relative',
        transition: 'box-shadow .15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 2,
        padding: '0 2px',
      }}>
        <span style={{
          fontWeight: 700,
          fontSize: 11,
          color: isWeekend ? 'var(--danger)' : isToday ? 'var(--sage)' : 'var(--ink-soft)',
          opacity: isWeekend ? 0.8 : 1,
        }}>
          {day}
        </span>
        {isWeekend && <span style={{ fontSize: 8, color: 'var(--ink-soft)', opacity: 0.5 }}>•</span>}
      </div>

      {events.length === 0 ? (
        <div style={{
          fontSize: 9,
          color: 'var(--ink-soft)',
          textAlign: 'center',
          paddingTop: 20,
          opacity: hovered ? 1 : 0,
          transition: 'opacity .15s',
        }}>
          No Events Scheduled
        </div>
      ) : (
        <>
          {visibleEvents.map(ev => (
            <EventCard
              key={ev.id}
              event={ev}
              onClick={onShowModal}
              onHover={onHover}
              onLeave={onLeave}
              ngoMap={ngoMap}
            />
          ))}
          {moreCount > 0 && (
            <div
              onClick={(e) => {
                e.stopPropagation()
                onShowModal({ _group: true, events: visibleEvents })
              }}
              style={{
                fontSize: 9,
                color: 'var(--ink-soft)',
                fontWeight: 600,
                textAlign: 'center',
                cursor: 'pointer',
                padding: '2px 0',
                borderRadius: 4,
                transition: 'background .12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#e8eaed' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              +{moreCount} More
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function CalendarGrid({
  weeks, month, year, getEventsForDay,
  onEventClick, onEventHover, onEventLeave,
  ngoMap = {},
}) {
  const today = useMemo(() => {
    const t = new Date()
    return { date: t.getDate(), month: t.getMonth(), year: t.getFullYear() }
  }, [])

  const handleShowModal = useCallback((event) => {
    onEventClick(event)
  }, [onEventClick])

  if (!weeks || weeks.length === 0) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-soft)' }}>No calendar data</div>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginTop: 0 }}>
      {DAYS.map(d => (
        <div
          key={d}
          style={{
            textAlign: 'center',
            fontSize: 11,
            color: 'var(--ink-soft)',
            padding: '6px 0 4px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '.04em',
          }}
        >
          {d}
        </div>
      ))}
      {weeks.flat().map((d, i) => {
        const dayEvents = d ? getEventsForDay(d) : []
        const isT = d === today.date && month === today.month && year === today.year
        return (
          <CalendarCell
            key={i}
            day={d}
            events={dayEvents}
            month={month}
            year={year}
            isToday={isT}
            onClick={onEventClick}
            onHover={onEventHover}
            onLeave={onEventLeave}
            ngoMap={ngoMap}
            onShowModal={handleShowModal}
          />
        )
      })}
    </div>
  )
}
