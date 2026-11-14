import { useState, useEffect } from 'react'
import { api } from '../api/auth'
import { CalendarBlank } from '@phosphor-icons/react'

// Status -> colour mapping (same as screenshot)
const STATUS_STYLES = {
  present:  { bg: '#DDF8E7', text: '#13783D', label: 'Present' },
  absent:   { bg: '#FFE0E3', text: '#C6283D', label: 'Absent' },
  leave:    { bg: '#E0ECFF', text: '#245AC6', label: 'Leave' },
  late:     { bg: '#FFE4BE', text: '#A85B0A', label: 'Late' },
  'half-day': { bg: '#EDE4FF', text: '#6D3FC4', label: 'Half-day' },
  holiday:  { bg: '#F0EDFB', text: '#5B4FA8', label: 'Holiday' },
}

// Single source for the legend, so the swatches can never drift from the
// colours actually painted on the day cells.
const LEGEND = Object.keys(STATUS_STYLES).map(k => ({ key: k, ...STATUS_STYLES[k] }))

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'half-day', label: 'Half-day' },
  { value: 'absent', label: 'Absent' },
  { value: 'leave', label: 'Leave' },
]

const IST_OFFSET = 5.5 * 60 * 60 * 1000

// Analog-style clock picker for punch in/out. Chrome/Windows renders
// <input type="time"> as spin steppers, which read as a slider; this gives an
// actual clock face: click the hour hand, then the minute hand, AM/PM toggle.
function ClockPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState('hour')
  const parse = () => {
    const [h, m] = (value || '').split(':').map(Number)
    const hh = Number.isFinite(h) && value ? h : null
    return { hh24: hh, mm: Number.isFinite(m) && value ? m : 0 }
  }
  const { hh24, mm } = parse()
  const ampm = hh24 != null && hh24 >= 12 ? 'PM' : 'AM'
  const hh12 = hh24 != null ? (hh24 % 12 || 12) : null

  const commit = (h24, minutes) => {
    onChange(`${String(h24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`)
  }
  const pickHour = (n12) => {
    let h24 = n12 % 12
    if (ampm === 'PM') h24 += 12
    commit(h24, mm)
    setStep('minute')
  }
  const pickMinute = (m5) => {
    const h24 = hh24 != null ? hh24 : 0
    commit(h24, m5)
    setOpen(false)
    setStep('hour')
  }
  const toggleAmPm = () => {
    if (hh24 == null) return
    commit(hh24 < 12 ? hh24 + 12 : hh24 - 12, mm)
  }
  const marks = step === 'hour'
    ? [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
  const selectedMark = step === 'hour' ? hh12 : mm
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={() => { setOpen(!open); setStep('hour') }}
        style={{ width: '100%', textAlign: 'left', padding: '6px 8px', border: '1px solid #d7dce5', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer' }}>
        {value || '--:--'}
      </button>
      {open && (
        <div style={{ position: 'absolute', zIndex: 30, top: '100%', marginTop: 6, background: '#fff', border: '1px solid #e3e8f0', borderRadius: 12, boxShadow: '0 12px 32px rgba(15,23,42,.16)', padding: 12, width: 220 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={() => setStep('hour')} style={{ border: 'none', background: step === 'hour' ? '#eaf1ff' : 'transparent', color: step === 'hour' ? '#2B5FB3' : '#555', fontWeight: 700, borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>{hh12 != null ? String(hh12).padStart(2, '0') : '--'}</button>
              <span>:</span>
              <button type="button" onClick={() => setStep('minute')} style={{ border: 'none', background: step === 'minute' ? '#eaf1ff' : 'transparent', color: step === 'minute' ? '#2B5FB3' : '#555', fontWeight: 700, borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>{String(mm).padStart(2, '0')}</button>
            </div>
            <button type="button" onClick={toggleAmPm} style={{ border: '1px solid #d7dce5', background: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{ampm}</button>
          </div>
          <div style={{ position: 'relative', width: 196, height: 196, borderRadius: '50%', background: '#f6f8fc', margin: '0 auto' }}>
            {marks.map((n, i) => {
              const angle = (i / 12) * 2 * Math.PI - Math.PI / 2
              const x = 98 + 78 * Math.cos(angle)
              const y = 98 + 78 * Math.sin(angle)
              const active = selectedMark === n
              return (
                <button key={n} type="button" onClick={() => (step === 'hour' ? pickHour(n) : pickMinute(n))}
                  style={{ position: 'absolute', left: x - 15, top: y - 15, width: 30, height: 30, borderRadius: '50%', border: 'none', background: active ? '#2F80D9' : 'transparent', color: active ? '#fff' : '#334', fontWeight: 600, cursor: 'pointer' }}>
                  {step === 'minute' ? String(n).padStart(2, '0') : n}
                </button>
              )
            })}
            <div style={{ position: 'absolute', left: 92, top: 92, width: 12, height: 12, borderRadius: '50%', background: '#2F80D9' }} />
          </div>
          <button type="button" onClick={() => { onChange(''); setOpen(false) }} style={{ marginTop: 8, border: 'none', background: 'none', color: '#B3392B', fontSize: 12, cursor: 'pointer' }}>Clear</button>
        </div>
      )}
    </div>
  )
}

// ISO timestamp -> HH:mm in IST (backend stores IST wall-clock time in UTC fields)
const toTimeInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const ist = new Date(d.getTime() + IST_OFFSET)
  return `${String(ist.getUTCHours()).padStart(2, '0')}:${String(ist.getUTCMinutes()).padStart(2, '0')}`
}

// Date (YYYY-MM-DD) + "HH:mm" (IST) -> ISO timestamp (inverse of toTimeInput)
const toIsoTimestamp = (dateStr, time) => {
  if (!time) return null
  const [hh, mm] = time.split(':').map(Number)
  const [y, m, d] = dateStr.split('-').map(Number)
  const ms = Date.UTC(y, m - 1, d) - IST_OFFSET + ((hh * 60 + mm) * 60000)
  return new Date(ms).toISOString()
}

export default function AttendanceCalendar({ workerId, worker }) {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth())
  const [year, setYear] = useState(today.getFullYear())
  const [records, setRecords] = useState({}) // { 'YYYY-MM-DD': { status } }
  const [selectedDate, setSelectedDate] = useState(null)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [panelErr, setPanelErr] = useState('')
  const [officeStart, setOfficeStart] = useState(null) // { hour, minute }

  const dateKey = (d) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  // Effective office start for this worker: personal shift overrides global setting.
  const getEffectiveOfficeStart = () => {
    if (worker?.shift_start_time) {
      const [h, m] = worker.shift_start_time.split(':').map(Number)
      return { hour: h || 10, minute: m || 0 }
    }
    if (officeStart) return officeStart
    return { hour: 10, minute: 0 }
  }

  // Late minutes from an IST "HH:mm" punch-in string, clamped at 0.
  const calcLateMin = (timeStr) => {
    if (!timeStr) return 0
    const [hh, mm] = timeStr.split(':').map(Number)
    if (isNaN(hh) || isNaN(mm)) return 0
    const start = getEffectiveOfficeStart()
    const punchMin = hh * 60 + mm
    const startMin = start.hour * 60 + start.minute
    return Math.max(0, punchMin - startMin)
  }

  useEffect(() => {
    api('/settings').then((settings) => {
      if (settings && settings.office_start_time) {
        const [h, m] = String(settings.office_start_time).split(':').map(Number)
        setOfficeStart({ hour: h || 10, minute: m || 0 })
      }
    }).catch(() => {})
  }, [])

  const load = () => {
    const mm = String(month + 1).padStart(2, '0')
    const monthKey = `${year}-${mm}`
    Promise.all([
      api(`/attendance/worker/${workerId}?month=${monthKey}`).catch(() => []),
      // Only holidays are still consumed here (they paint a day cell); the
      // events/birthdays payloads are no longer surfaced in this view.
      api(`/calendar?year=${year}&month=${mm}`).catch(() => ({ holidays: [] })),
    ]).then(([attList, calData]) => {
      const map = {}
      ;(attList || []).forEach(r => { map[r.date] = r })
      ;(calData.holidays || []).forEach(h => {
        const existing = map[h.date]
        // A declared holiday wins over a stale absent/leave row. A real punch
        // on that date (present/late/half-day) still wins.
        if (!existing || existing.status === 'absent' || existing.status === 'leave') {
          map[h.date] = { ...(existing || {}), date: h.date, status: 'holiday' }
        }
      })
      setRecords(map)
    }).catch(() => { setRecords({}) })
  }
  useEffect(load, [workerId, month, year])

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay() // 0 = Sunday

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

  const openDay = (dateStr) => {
    const rec = records[dateStr]
    setSelectedDate(dateStr)
    setPanelErr('')
    setDraft({
      status: rec && rec.status && rec.status !== 'holiday' ? rec.status : 'present',
      punchIn: toTimeInput(rec && rec.punch_in_time),
      punchOut: toTimeInput(rec && rec.punch_out_time),
      lateMinutes: rec && rec.late_minutes != null ? String(rec.late_minutes) : '0',
      id: rec && rec.id ? rec.id : null,
    })
  }

  const closePanel = () => {
    setSelectedDate(null)
    setDraft(null)
    setPanelErr('')
  }

  // The editor opens as a modal, so Escape dismisses it like the app's other
  // dialogs. Blocked while a save is in flight so a stray keypress can't drop
  // the user's edits mid-request.
  useEffect(() => {
    if (!selectedDate) return
    const onKey = (e) => { if (e.key === 'Escape' && !saving) closePanel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- closePanel only uses stable setters
  }, [selectedDate, saving])

  const handleSave = async () => {
    if (!selectedDate || !draft) return
    setSaving(true)
    setPanelErr('')
    const body = {
      status: draft.status,
      punch_in_time: toIsoTimestamp(selectedDate, draft.punchIn),
      punch_out_time: toIsoTimestamp(selectedDate, draft.punchOut),
      late_minutes: parseInt(draft.lateMinutes || '0', 10) || 0,
    }
    try {
      if (draft.id) {
        await api(`/attendance/${draft.id}`, { method: 'PUT', body: JSON.stringify(body) })
      } else {
        await api('/attendance', { method: 'POST', body: JSON.stringify({ worker_id: workerId, date: selectedDate, ...body }) })
      }
      closePanel()
      load()
    } catch (e) {
      setPanelErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleNullify = async () => {
    if (!selectedDate || !draft) return
    if (!draft.id) { closePanel(); return }
    if (!window.confirm(`Delete the attendance record for ${selectedDate}?`)) return
    setSaving(true)
    setPanelErr('')
    try {
      await api(`/attendance/${draft.id}`, { method: 'DELETE' })
      closePanel()
      load()
    } catch (e) {
      setPanelErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  const formatDateLabel = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    return `${d} ${MONTHS[m - 1]} ${y} · ${DAY_NAMES[dt.getDay()]}`
  }

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  // Real per-status counts for the selected month, from the same `records`
  // map the grid paints from. Hidden entirely when the month has no records,
  // since an all-zero block would be noise.
  const statusCounts = {}
  for (let d = 1; d <= daysInMonth; d++) {
    const status = records[dateKey(d)]?.status
    if (!status) continue
    statusCounts[status] = (statusCounts[status] || 0) + 1
  }
  const countRows = Object.keys(STATUS_STYLES)
    .map(k => ({ key: k, ...STATUS_STYLES[k], n: statusCounts[k] || 0 }))
    .filter(r => r.n > 0)

  return (
    <div className="sa-card att-cal-card">
      <div className="att-cal-header">
        <h3 className="sa-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarBlank size={16} />Attendance Calendar
        </h3>
        <div className="att-cal-nav">
          <button className="att-nav-btn" onClick={prevMonth} aria-label="Previous month">&#8249;</button>
          <span className="att-cal-month">{MONTHS[month]} {year}</span>
          <button className="att-nav-btn" onClick={nextMonth} aria-label="Next month">&#8250;</button>
        </div>
      </div>

      <div className="att-body">
        <aside className="att-summary">
          <div className="att-consistency">
            <div className="att-consistency-row">
              <span className="att-consistency-label">Monthly Consistency</span>
              <span className="att-consistency-value">{consistency}%</span>
            </div>
            <div className="att-progress" role="progressbar" aria-valuenow={consistency} aria-valuemin={0} aria-valuemax={100} aria-label="Monthly consistency">
              <div className="att-progress-fill" style={{ width: `${consistency}%` }} />
            </div>
          </div>

          {countRows.length > 0 && (
            <ul className="att-counts">
              {countRows.map(r => (
                <li className="att-count" key={r.key}>
                  <span className="att-count-swatch" style={{ background: r.bg }} />
                  <span className="att-count-label">{r.label}</span>
                  <span className="att-count-n">{r.n}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="att-gridwrap">
      <div className="att-grid">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="att-weekday">{d}</div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} />
          const dateStr = dateKey(d)
          const rec = records[dateStr]
          const style = rec ? STATUS_STYLES[rec.status] : null
          const selected = selectedDate === dateStr
          const a11yLabel = `${d} ${MONTHS[month]} ${year}, ${style ? style.label : 'no record'}`
          return (
            <div
              key={d}
              className={`att-day${selected ? ' selected' : ''}`}
              title={a11yLabel}
              aria-label={a11yLabel}
              role="button"
              tabIndex={0}
              style={style ? { background: style.bg, color: style.text, fontWeight: 600 } : {}}
              onClick={() => openDay(dateStr)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDay(dateStr) } }}
            >
              <span className="att-day-num">{d}</span>
              {(rec?.punch_in_time || rec?.punch_out_time) && (
                <span className="att-day-times">
                  {rec.punch_in_time && <span>{toTimeInput(rec.punch_in_time)}</span>}
                  {rec.punch_in_time && rec.punch_out_time && <span className="att-day-times-sep">–</span>}
                  {rec.punch_out_time && <span>{toTimeInput(rec.punch_out_time)}</span>}
                </span>
              )}
            </div>
          )
        })}
      </div>
        </div>
      </div>

      {/* ── Day editor modal ──
         Fixed overlay centred in the viewport rather than an inline block
         below the grid. Backdrop click mirrors the app's other dialogs; the
         panel stops propagation so clicks in the form never dismiss it, and
         closes are blocked while a save is in flight. */}
      {selectedDate && draft && (
        <div className="att-modal-overlay" onClick={() => { if (!saving) closePanel() }}>
        <div
          className="att-detail-panel"
          role="dialog"
          aria-modal="true"
          aria-label={`Edit attendance for ${formatDateLabel(selectedDate)}`}
          onClick={e => e.stopPropagation()}
        >
          <div className="att-detail-head">
            <span className="att-detail-date">{formatDateLabel(selectedDate)}</span>
            <button className="att-detail-close" onClick={closePanel} disabled={saving} aria-label="Close">&times;</button>
          </div>
          {panelErr && <div className="att-detail-err">{panelErr}</div>}
          <div className="att-detail-fields">
            <label className="att-field">
              <span>Status</span>
              <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="att-field">
              <span>Punch In</span>
              <ClockPicker value={draft.punchIn} onChange={(v) => setDraft({ ...draft, punchIn: v, lateMinutes: String(calcLateMin(v)) })} />
            </label>
            <label className="att-field">
              <span>Punch Out</span>
              <ClockPicker value={draft.punchOut} onChange={(v) => setDraft({ ...draft, punchOut: v })} />
            </label>
            <label className="att-field">
              <span>Late Minutes</span>
              <input type="number" min="0" value={draft.lateMinutes} onChange={e => setDraft({ ...draft, lateMinutes: e.target.value })} />
            </label>
          </div>
          <div className="att-status-actions">
            <button type="button" className="att-quick-btn att-quick-half" onClick={() => setDraft({ ...draft, status: 'half-day' })}>
              Set Half-day
            </button>
            <button type="button" className="att-quick-btn att-quick-present" onClick={() => setDraft({ ...draft, status: 'present' })}>
              Remove Half-day
            </button>
          </div>
          <div className="att-detail-actions">
            <button className="att-btn att-btn-null" onClick={handleNullify} disabled={saving}>Null</button>
            <button className="att-btn att-btn-save" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
        </div>
      )}

      <div className="att-legend">
        {LEGEND.map(item => (
          <span className="att-legend-item" key={item.key}>
            <span className="att-swatch" style={{ background: item.bg }} />
            {item.label}
          </span>
        ))}
      </div>

      <style>{`
.att-cal-card { }
.att-cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
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
.att-body {
  display: grid;
  grid-template-columns: 176px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.att-summary { min-width: 0; }
.att-gridwrap { min-width: 0; }
.att-counts {
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.att-count {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 7px;
  border-radius: 7px;
  font-size: 12px;
}
.att-count:nth-child(odd) { background: #F8FBFF; }
.att-count-swatch {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid rgba(16,27,58,.08);
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #2B5FB3;
}
.att-count-label { color: #425A86; flex: 1; min-width: 0; }
.att-count-n { font-weight: 700; color: #101B3A; font-variant-numeric: tabular-nums; }
.att-consistency { margin-bottom: 0; }
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
  padding: 8px 0 6px;
  border-radius: 10px;
  font-size: 14px;
  color: #c3c9d0;
  user-select: none;
  cursor: pointer;
  transition: box-shadow .15s ease, transform .15s ease;
}
.att-day-num {
  display: block;
  font-weight: 600;
}
.att-day-times {
  display: block;
  margin-top: 2px;
  font-size: 9px;
  font-weight: 600;
  line-height: 1.2;
  opacity: .95;
}
.att-day-times-sep {
  margin: 0 1px;
  opacity: .6;
}
.att-day:hover,
.att-day:focus-visible {
  box-shadow: 0 0 0 2px #2B5FB3;
  transform: translateY(-1px);
}
.att-day:focus { outline: none; }
.att-day.selected {
  box-shadow: 0 0 0 2px #2B5FB3;
  transform: scale(1.06);
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
  width: 15px;
  height: 15px;
  border-radius: 5px;
  display: inline-flex;
  flex-shrink: 0;
  border: 1px solid rgba(16,27,58,.08);
}
/* Below this width the summary column would squeeze the seven calendar
   columns under a usable cell width, so it moves above the grid. */
@media (max-width: 900px) {
  .att-body { grid-template-columns: minmax(0, 1fr); }
  .att-counts { flex-direction: row; flex-wrap: wrap; gap: 4px; }
  .att-count { flex: 0 1 auto; background: #F8FBFF; }
}
/* ── Day editor modal ──
   Fixed backdrop centred in the viewport, matching the app's other dialogs
   (Reset Password uses the same overlay + z-index). Scrolling lives on the
   overlay and centring on the panel's auto margins, so a short viewport
   scrolls instead of clipping the panel's top — and the clock picker's
   dropdown is never cut off by a panel-level overflow. */
.att-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(16, 27, 58, .45);
  display: flex;
  padding: 24px;
  overflow-y: auto;
  overscroll-behavior: contain;
  z-index: 2000;
}
.att-detail-panel {
  margin: auto;
  width: min(100%, 440px);
  padding: 18px;
  border: 1px solid #DCE7F8;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 24px 60px rgba(16, 27, 58, .25);
}
/* Tighter gutters on small screens so the centred editor keeps width.
   Declared after the base rule so it wins at this breakpoint. */
@media (max-width: 900px) {
  .att-modal-overlay { padding: 12px; }
}
.att-detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}
.att-detail-date {
  font-size: 14px;
  font-weight: 700;
  color: #101B3A;
  min-width: 0;
  overflow-wrap: anywhere;
}
.att-detail-close {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #C9D9F4;
  background: #fff;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  color: #425A86;
  border-radius: 7px;
}
.att-detail-close:hover { background: #EEF4FF; border-color: #A9C6F7; color: #1268F3; }
.att-detail-close:focus-visible { outline: 2px solid #1268F3; outline-offset: 2px; }
.att-detail-err {
  margin-bottom: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #FFE0E3;
  color: #C6283D;
  font-size: 13px;
}
.att-detail-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
.att-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: #425A86;
  min-width: 0;
}
.att-field input,
.att-field select {
  padding: 8px 10px;
  border: 1px solid #C9D9F4;
  border-radius: 9px;
  font-size: 13.5px;
  font-family: inherit;
  background: #fff;
  color: #101B3A;
  outline: none;
  width: 100%;
}
.att-field input:focus,
.att-field select:focus { border-color: #1268F3; box-shadow: 0 0 0 3px rgba(18,104,243,.14); }
.att-detail-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}
.att-status-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.att-quick-btn {
  border: 1px solid;
  padding: 7px 12px;
  border-radius: 9px;
  font-size: 12.5px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  background: #fff;
}
.att-quick-btn:focus-visible { outline: 2px solid #1268F3; outline-offset: 2px; }
.att-quick-half { border-color: #D5BEF0; color: #6D3FC4; }
.att-quick-half:hover { background: #F3ECFD; }
.att-quick-present { border-color: #A8DEC0; color: #13783D; }
.att-quick-present:hover { background: #DDF8E7; }
.att-btn {
  border: 1px solid transparent;
  padding: 8px 18px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  color: #fff;
}
.att-btn:focus-visible { outline: 2px solid #1268F3; outline-offset: 2px; }
.att-btn:disabled { opacity: .6; cursor: default; }
.att-btn-save { background: #1268F3; }
.att-btn-save:hover:not(:disabled) { background: #0756D6; }
.att-btn-null { background: #fff; border-color: #F3C2C4; color: #C6283D; }
.att-btn-null:hover:not(:disabled) { background: #FFE0E3; }
      `}</style>
    </div>
  )
}
