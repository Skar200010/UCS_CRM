import { useMemo } from 'react'

const STATUS_COLORS = {
  present: { bg: '#aff1ca', fg: '#0a5135' },
  absent: { bg: '#ffdad6', fg: '#ba1a1a' },
  late: { bg: '#ffddb8', fg: '#653e00' },
  leave: { bg: '#d1e4ff', fg: '#011d35' },
  'half-day': { bg: '#e8d5f5', fg: '#5a2a8a' },
  holiday: { bg: '#e8d5f5', fg: '#5a2a8a' },
}

export default function MiniCalendar({ year, month, statusByDate = {}, onSelect }) {
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDay = new Date(year, month - 1, 1).getDay()
  const today = new Date()

  const days = useMemo(() => {
    const arr = []
    for (let i = 0; i < firstDay; i++) arr.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const dt = new Date(year, month - 1, d)
      arr.push({ day: d, dateStr, status: statusByDate[dateStr], isPast: dt < today, isToday: dt.toDateString() === today.toDateString(), isSunday: dt.getDay() === 0 })
    }
    return arr
  }, [year, month, daysInMonth, firstDay, statusByDate])

  const pad = (n) => String(n).padStart(2, '0')

  return (
    <div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-[10px] font-semibold text-[var(--ink-muted)] py-1">{d}</div>
        ))}
        {days.map((day, i) => {
          if (!day) return <div key={`e${i}`} />
          const c = STATUS_COLORS[day.status]
          const dimmed = (day.isSunday || (!day.isPast && !day.isToday)) && !day.status
          return (
            <button key={day.dateStr}
              onClick={() => onSelect?.(day.dateStr)}
              className={`text-center py-1 rounded text-[11px] transition-colors ${day.isToday ? 'ring-1 ring-blue-400' : ''} ${dimmed ? 'opacity-30' : ''}`}
              style={c ? { background: c.bg, color: c.fg } : day.status ? { background: '#f3f4f6' } : {}}>
              <div className="font-medium">{day.day}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
