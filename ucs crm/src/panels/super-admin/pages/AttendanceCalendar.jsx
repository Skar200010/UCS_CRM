import { useState, useEffect } from 'react'
import { api } from '../api/auth'

// Status -> colour mapping (same as screenshot)
const STATUS_STYLES = {
  present:  { bg: '#B9EFCE', text: '#1B7A3D' },
  absent:   { bg: '#FBDBD6', text: '#B3392B' },
  leave:    { bg: '#D6E4FB', text: '#2B5FB3' },
  late:     { bg: '#FDE0BC', text: '#B37122' },
  'half-day': { bg: '#EBDDF7', text: '#7B3FB3' },
  holiday:  { bg: '#EBDDF7', text: '#7B3FB3' },
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function AttendanceCalendar({ workerId, worker }) {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth())
  const [year, setYear] = useState(today.getFullYear())
  const [records, setRecords] = useState({}) // { 'YYYY-MM-DD': { status, event } }
  const [calendarDates, setCalendarDates] = useState({}) // { 'YYYY-MM-DD': ['event', 'birthday'] }

  useEffect(() => {
    const mm = String(month + 1).padStart(2, '0')
    const monthKey = `${year}-${mm}`
    Promise.all([
      api(`/attendance/worker/${workerId}?month=${monthKey}`).catch(() => []),
      api(`/calendar?year=${year}&month=${mm}`).catch(() => ({ events: [], holidays: [], birthdays: [] })),
    ]).then(([attList, calData]) => {
      const map = {}
      ;(attList || []).forEach(r => { map[r.date] = r })
      ;(calData.holidays || []).forEach(h => {
        if (!map[h.date]) map[h.date] = { date: h.date, status: 'holiday' }
      })
      setRecords(map)

      const calMap = {}
      ;(calData.events || []).forEach(e => {
        if (e.date) calMap[e.date] = [...(calMap[e.date] || []), 'event']
      })
      ;(calData.birthdays || []).forEach(b => {
        if (b.date) calMap[b.date] = [...(calMap[b.date] || []), 'birthday']
      })
      setCalendarDates(calMap)
    }).catch(() => { setRecords({}); setCalendarDates({}) })
  }, [workerId, month, year])

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay() // 0 = Sunday

  const dateKey = (d) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  const calForDate = (d) => calendarDates[dateKey(d)] || []

  // Monthly consistency = present (+ late + half-day counted) / marked working days
  let presentCount = 0, markedCount = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const rec = records[dateKey(d)]
    if (!rec) continue
    if (rec.status === 'holiday') continue
    markedCount++
    if (['present', 'late', 'half-day'].includes(rec.status)) presentCount++
  }
  const consistency = markedCount > 0 ? Math.round((presentCount / markedCount) * 100) : 0

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="sa-card att-cal-card">
      <div className="att-cal-header">
        <h3 className="sa-card-title" style={{ margin: 0 }}>Attendance Calendar</h3>
        <div className="att-cal-nav">
          <button className="att-nav-btn" onClick={prevMonth} aria-label="Previous month">&#8249;</button>
          <span className="att-cal-month">{MONTHS[month]} {year}</span>
          <button className="att-nav-btn" onClick={nextMonth} aria-label="Next month">&#8250;</button>
        </div>
      </div>

      <div className="att-consistency">
        <div className="att-consistency-row">
          <span className="att-consistency-label">Monthly Consistency</span>
          <span className="att-consistency-value">{consistency}%</span>
        </div>
        <div className="att-progress">
          <div className="att-progress-fill" style={{ width: `${consistency}%` }} />
        </div>
      </div>

      <div className="att-grid">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="att-weekday">{d}</div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} />
          const rec = records[dateKey(d)]
          const style = rec ? STATUS_STYLES[rec.status] : null
          return (
            <div
              key={d}
              className="att-day"
              title={rec ? rec.status : ''}
              style={style ? { background: style.bg, color: style.text, fontWeight: 600 } : {}}
            >
              {d}
              {(rec?.event || calForDate(d).includes('event')) && <span className="att-dot" />}
              {calForDate(d).includes('birthday') && <span className="att-cake">&#127874;</span>}
            </div>
          )
        })}
      </div>

      <div className="att-legend">
        <span className="att-legend-item"><span className="att-swatch" style={{background:'#B9EFCE'}} /> Present</span>
        <span className="att-legend-item"><span className="att-swatch" style={{background:'#FBDBD6'}} /> Absent</span>
        <span className="att-legend-item"><span className="att-swatch" style={{background:'#D6E4FB'}} /> Leave</span>
        <span className="att-legend-item"><span className="att-swatch" style={{background:'#FDE0BC'}} /> Late</span>
        <span className="att-legend-item"><span className="att-swatch" style={{background:'#EBDDF7'}} /> Half-day</span>
        <span className="att-legend-item"><span className="att-swatch" style={{background:'#EBDDF7'}} /> Holiday</span>
        <span className="att-legend-item"><span className="att-dot" style={{position:'static'}} /> Event</span>
        <span className="att-legend-item">&#127874; Birthday</span>
      </div>

      <style>{`
.att-cal-card { }
.att-cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.att-cal-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}
.att-cal-month {
  font-size: 13px;
  font-weight: 600;
  color: #333;
  min-width: 110px;
  text-align: center;
}
.att-nav-btn {
  border: none;
  background: transparent;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  color: #333;
  padding: 2px 8px;
  border-radius: 6px;
}
.att-nav-btn:hover { background: #eef4fb; }
.att-consistency { margin-bottom: 18px; }
.att-consistency-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}
.att-consistency-label {
  font-size: 14px;
  font-weight: 500;
  color: #444;
}
.att-consistency-value {
  font-size: 14px;
  font-weight: 700;
  color: #1B7A3D;
}
.att-progress {
  height: 10px;
  border-radius: 20px;
  background: #FDE0BC;
  overflow: hidden;
}
.att-progress-fill {
  height: 100%;
  border-radius: 20px;
  background: #2A6B45;
  transition: width .4s ease;
}
.att-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  text-align: center;
}
.att-weekday {
  font-size: 13px;
  font-weight: 600;
  color: #9aa3ad;
  padding: 6px 0;
}
.att-day {
  position: relative;
  padding: 10px 0;
  border-radius: 10px;
  font-size: 14px;
  color: #c3c9d0;
  user-select: none;
}
.att-dot {
  position: absolute;
  top: 4px;
  right: 6px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #2B5FB3;
  display: inline-block;
}
.att-cake {
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 10px;
}
.att-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
  margin-top: 18px;
}
.att-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: #444;
}
.att-swatch {
  width: 16px;
  height: 16px;
  border-radius: 5px;
  display: inline-block;
}
      `}</style>
    </div>
  )
}
