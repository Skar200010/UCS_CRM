import { useState, useRef, useEffect, useCallback } from 'react'

export function Dropdown({ value, onChange, options, placeholder, renderOption, renderValue, customTrigger, customValue, onCustomChange }) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef(null)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open && value === customTrigger && inputRef.current) inputRef.current.focus()
  }, [open, value, customTrigger])

  const selected = options.find(o => (typeof o === 'string' ? o : o.value) === value)

  return (
    <div className="dropdown" ref={ref}>
      <button type="button" className="dropdown-trigger" onClick={() => setOpen(!open)}>
        {renderValue ? renderValue(selected) : (selected ? (typeof selected === 'string' ? selected : selected.label) : (placeholder || 'Select...'))}
        <ChevronDown />
      </button>
      {open && (
        <div className="dropdown-menu">
          {options.map((opt) => {
            const optValue = typeof opt === 'string' ? opt : opt.value
            const optLabel = typeof opt === 'string' ? opt : opt.label
            return (
              <div key={optValue} className={`dropdown-item ${value === optValue ? 'active' : ''}`} onClick={() => { onChange(optValue); if (optValue !== customTrigger) setOpen(false) }}>
                {renderOption ? renderOption(opt) : optLabel}
              </div>
            )
          })}
          {value === customTrigger && (
            <div className="dropdown-item" style={{ padding: 4 }}>
              <input ref={inputRef} value={customValue || ''} onChange={e => onCustomChange?.(e.target.value)} placeholder="Specify source..." style={{ width: '100%', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export function DatePicker({ value, onChange, placeholder }) {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date())
  const [viewMode, setViewMode] = useState('days')
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const formatDate = (d) => {
    if (!d) return ''
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${yyyy}-${mm}-${dd}`
  }

  const displayDate = value ? new Date(value + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate()
  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay()
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  const handleDayClick = (day) => {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day)
    onChange(formatDate(d))
    setOpen(false)
  }

  const handleMonthSelect = (m) => {
    setViewDate(new Date(viewDate.getFullYear(), m, 1))
    setViewMode('days')
  }

  const handleYearSelect = (y) => {
    setViewDate(new Date(y, viewDate.getMonth(), 1))
    setViewMode('days')
  }

  const years = []
  const cy = viewDate.getFullYear()
  for (let i = cy - 6; i <= cy + 6; i++) years.push(i)

  return (
    <div className="datepicker" ref={ref}>
      <input type="text" readOnly value={displayDate} placeholder={placeholder || 'Select date'} onClick={() => setOpen(true)} className="datepicker-input" />
      {open && (
        <div className="dp-dropdown">
          {viewMode === 'days' && (
            <>
              <div className="dp-header">
                <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}>&lt;</button>
                <span onClick={() => setViewMode('months')}>{monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}</span>
                <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}>&gt;</button>
              </div>
              <div className="dp-grid">
                {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} className="dp-dow">{d}</div>)}
                {Array.from({ length: firstDay }, (_, i) => <div key={`e${i}`} className="dp-empty" />)}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1
                  const sel = value === formatDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), day))
                  return <div key={day} className={`dp-day ${sel ? 'selected' : ''}`} onClick={() => handleDayClick(day)}>{day}</div>
                })}
              </div>
            </>
          )}
          {viewMode === 'months' && (
            <div className="dp-month-grid">
              {monthNames.map((m, i) => (
                <div key={m} className={`dp-month ${viewDate.getMonth() === i ? 'selected' : ''}`} onClick={() => handleMonthSelect(i)}>{m}</div>
              ))}
            </div>
          )}
          {viewMode === 'years' && (
            <div className="dp-year-grid">
              {years.map(y => (
                <div key={y} className={`dp-year ${viewDate.getFullYear() === y ? 'selected' : ''}`} onClick={() => handleYearSelect(y)}>{y}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function Avatar({ name, size = 36 }) {
  const initials = name ? name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : '?'
  const colors = ['#4a7c6f','#3b82f6','#059669','#8b5cf6','#d97706','#e11d48','#0d9488','#0891b2','#0284c7','#6366f1']
  const color = colors[name ? name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length : 0]
  return (
    <div className="avatar" style={{ width: size, height: size, background: color, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600, fontSize: size * 0.4, flexShrink: 0 }}>
      {initials}
    </div>
  )
}

export function Pill({ label, color }) {
  const colors = {
    green: { bg: '#d1fae5', text: '#065f46' },
    yellow: { bg: '#fef3c7', text: '#92400e' },
    red: { bg: '#fee2e2', text: '#991b1b' },
    blue: { bg: '#dbeafe', text: '#1e40af' },
    gray: { bg: '#f3f4f6', text: '#374151' },
    purple: { bg: '#ede9fe', text: '#5b21b6' },
  }
  const c = colors[color] || colors.gray
  return (
    <span className="pill" style={{ background: c.bg, color: c.text, padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.text, flexShrink: 0 }} />
      {label}
    </span>
  )
}

export function Who({ name, role }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Avatar name={name} />
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>{name}</div>
        <div style={{ fontSize: 12, color: '#666' }}>{role}</div>
      </div>
    </div>
  )
}
