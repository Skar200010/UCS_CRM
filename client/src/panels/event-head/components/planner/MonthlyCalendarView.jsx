import { useEffect, useMemo, useRef, useState } from 'react'
import { buildCalendarModel } from './monthlyCalendarPdf.mjs'

/* "View in Calendar" for the Monthly Planner.

   A month grid built from the SAME data the planner already holds: the month's
   observances (festivals / important days) on their real dates, plus the chosen
   programmes (a typed programme replaces its festival's AI pick). It never
   navigates to the separate Calendar section — Prev/Next/Today move the
   planner's own month, so the grid and the file always match what is planned.
   Clicking a date opens its readable details. The PDF is the same model again,
   so nothing can disagree or duplicate. */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const pad2 = (n) => String(n).padStart(2, '0')
const toYmd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

const monthLabel = (ym) => {
  const [y, m] = String(ym).split('-')
  return `${MONTHS[Number(m) - 1]} ${y}`
}

const TYPE_TONE = {
  festival: '#c62828',
  national: '#1565c0',
  international: '#0288d1',
  religious: '#7b1fa2',
  observance: '#5e35b1',
  holiday: '#e65100',
}
const toneFor = (type) => TYPE_TONE[String(type || '').toLowerCase()] || 'var(--eh-primary, #6c5ce7)'

export default function MonthlyCalendarView({
  month,
  ngoLabel,
  observancesByDate,
  programmeRows,
  initialDate,
  onClose,
  onChangeMonth,
}) {
  const model = useMemo(
    () => buildCalendarModel({ month, ngoLabel, observancesByDate, programmeRows }),
    [month, ngoLabel, observancesByDate, programmeRows]
  )

  const [selected, setSelected] = useState('')
  const [downloading, setDownloading] = useState(false)
  const scroller = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  // Keep a date selected that belongs to the month on screen: the day just
  // scheduled when the planner knows one, otherwise today, otherwise nothing.
  useEffect(() => {
    setSelected((cur) => {
      if (initialDate && initialDate.startsWith(month)) return initialDate
      if (cur && cur.startsWith(month)) return cur
      const today = toYmd(new Date())
      return today.startsWith(month) ? today : ''
    })
  }, [month, initialDate])

  const today = toYmd(new Date())

  const shift = (delta) => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    onChangeMonth(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`)
  }
  const goToday = () => {
    const n = new Date()
    onChangeMonth(`${n.getFullYear()}-${pad2(n.getMonth() + 1)}`)
  }

  const selectedRows = useMemo(
    () => model.details.filter((r) => r.date === selected),
    [model, selected]
  )

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const { buildMonthlyCalendarPdf } = await import('./monthlyCalendarPdf.mjs')
      const doc = buildMonthlyCalendarPdf(model)
      const [y, m] = month.split('-')
      const code = String(ngoLabel || 'AllNGOs').replace(/[^A-Za-z0-9]+/g, '-')
      doc.save(`monthly-calendar-${code}-${MONTHS[Number(m) - 1]}-${y}.pdf`)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,35,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1000 }}
    >
      <div style={{ width: '100%', maxWidth: 1180, maxHeight: '94vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,.3)', overflow: 'hidden' }}>
        {/* Header: month + nav + actions */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--eh-line)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--eh-ink)' }}>Monthly Calendar</h3>
            <div style={{ fontSize: 12, color: 'var(--eh-ink-soft)', marginTop: 3 }}>
              {ngoLabel || 'All NGOs'} · {monthLabel(month)}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button className="eh-btn eh-btn-sm" onClick={() => shift(-1)} title="Previous month">‹ Prev</button>
            <button className="eh-btn eh-btn-sm" onClick={goToday} title="Jump to the current month">Today</button>
            <button className="eh-btn eh-btn-sm" onClick={() => shift(1)} title="Next month">Next ›</button>
          </div>
          <button className="eh-btn eh-btn-primary eh-btn-sm" onClick={handleDownload} disabled={downloading} title="Download this month as an A4 landscape PDF">
            {downloading ? 'Preparing…' : 'Download Monthly Calendar PDF'}
          </button>
          <button className="eh-btn eh-btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div ref={scroller} className="ap-scroll" style={{ padding: 18, overflowY: 'auto', minHeight: 0, flex: 1 }}>
          {/* Weekday header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, marginBottom: 6 }}>
            {WD.map((d) => (
              <div key={d} style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--eh-ink-soft)', textAlign: 'center', padding: '4px 0' }}>{d}</div>
            ))}
          </div>

          {/* Month grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {model.weeks.map((week, wi) => (
              <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
                {week.map((cell, ci) => {
                  if (!cell) return <div key={ci} style={{ minHeight: 104 }} />
                  const isSel = cell.date === selected
                  const isToday = cell.date === today
                  const hasWork = cell.programmes.length > 0
                  return (
                    <button
                      key={ci}
                      onClick={() => setSelected(cell.date)}
                      style={{
                        textAlign: 'left', minHeight: 104, padding: 7, borderRadius: 10, cursor: 'pointer', font: 'inherit',
                        border: isSel ? '2px solid var(--eh-primary, #6c5ce7)' : '1px solid var(--eh-line)',
                        background: isSel ? 'var(--eh-tint-1, #f0eefb)' : hasWork ? '#fbfbff' : '#fff',
                        boxShadow: isToday ? 'inset 0 0 0 1px var(--eh-primary, #6c5ce7)' : 'none',
                        display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--eh-ink)' }}>{cell.day}</span>
                        {isToday && <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--eh-primary, #6c5ce7)' }}>TODAY</span>}
                      </div>
                      {cell.festivals.map((f, i) => (
                        <span key={`f${i}`} title={f.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: toneFor(f.type), lineHeight: 1.25 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: toneFor(f.type), flex: 'none' }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                        </span>
                      ))}
                      {cell.programmes.map((p, i) => (
                        <span key={`p${i}`} title={[p.ngoLabel, p.title].filter(Boolean).join(' · ')} style={{ display: 'block', fontSize: 11, color: 'var(--eh-ink)', lineHeight: 1.3, background: '#eef0ff', border: '1px solid #dcdffb', borderRadius: 6, padding: '2px 5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <b>{p.ngoLabel}</b>{p.title ? ` · ${p.title}` : ''}
                        </span>
                      ))}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Date details */}
          <div className="card" style={{ marginTop: 16, marginBottom: 0 }}>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {selected ? (
                <>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--eh-ink)' }}>
                    {selectedRows[0]?.weekday || ''} · {MONTHS[Number(selected.split('-')[1]) - 1]} {Number(selected.split('-')[2])}, {selected.split('-')[0]}
                  </div>
                  {selectedRows.length ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selectedRows.map((r, i) => (
                        <div key={i} style={{ border: '1px solid var(--eh-line)', borderRadius: 10, padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--eh-ink)' }}>{r.festival}</div>
                          {r.programme && r.programme !== '—'
                            ? <div style={{ fontSize: 13, color: 'var(--eh-ink)' }}><b>{r.programme}</b>{r.status ? <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--eh-ink-soft)' }}>({r.status})</span> : null}</div>
                            : <div style={{ fontSize: 12.5, color: 'var(--eh-ink-soft)' }}>No programme chosen.</div>}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: 'var(--eh-ink-soft)' }}>
                            <span>NGO: <b style={{ color: 'var(--eh-ink)' }}>{r.ngoLabel}</b></span>
                            <span>Beneficiary: <b style={{ color: 'var(--eh-ink)' }}>{r.beneficiary}</b></span>
                            <span>Location: <b style={{ color: 'var(--eh-ink)' }}>{r.location}</b></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--eh-ink-soft)' }}>No festival or programme on this date.</div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--eh-ink-soft)' }}>Select a date to see its festivals and programmes.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
