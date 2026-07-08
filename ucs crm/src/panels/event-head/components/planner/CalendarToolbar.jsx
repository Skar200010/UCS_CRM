import { ArrowLeft, ArrowRight } from '../../icons'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i)

const btnStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '6px 12px',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--card-bg)',
  color: 'var(--ink)',
  fontSize: 12,
  fontFamily: 'inherit',
  cursor: 'pointer',
  fontWeight: 500,
  transition: 'all .15s',
  whiteSpace: 'nowrap',
}

export default function CalendarToolbar({
  year, month,
  onPrev, onNext, onToday,
  onMonthChange, onYearChange,
}) {
  return (
    <div className="card-head" style={{ flexWrap: 'wrap', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="btn btn-sm" onClick={onPrev}><ArrowLeft size={16} /></button>
        <button className="btn btn-sm" onClick={onToday}>Today</button>
        <button className="btn btn-sm" onClick={onNext}><ArrowRight size={16} /></button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, minWidth: 140 }}>
          {MONTHS[month]} {year}
        </h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <select
            value={month}
            onChange={e => onMonthChange(Number(e.target.value))}
            style={{
              padding: '5px 8px',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              fontFamily: 'inherit',
              outline: 'none',
              background: 'var(--card-bg)',
              cursor: 'pointer',
            }}
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={e => onYearChange(Number(e.target.value))}
            style={{
              padding: '5px 8px',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              fontFamily: 'inherit',
              outline: 'none',
              background: 'var(--card-bg)',
              cursor: 'pointer',
            }}
          >
            {YEARS.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
