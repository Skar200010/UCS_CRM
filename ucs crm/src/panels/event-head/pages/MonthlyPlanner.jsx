import { useState, useEffect } from 'react'
import { fetchEventsByMonth, fetchNGOs, CATEGORIES, EVENT_STATUSES } from '../store'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const now = new Date()

const statusStyle = (s) => {
  const map = { Completed: { bg: '#5B6B4E18', color: '#5B6B4E' }, Approved: { bg: '#3485D418', color: '#3485D4' }, Draft: { bg: '#9ca3af18', color: '#9ca3af' }, Rejected: { bg: '#B5603A18', color: '#B5603A' }, Cancelled: { bg: '#dc262618', color: '#dc2626' }, Submitted: { bg: '#C08A2E18', color: '#C08A2E' }, Postponed: { bg: '#f59e0b18', color: '#f59e0b' } }
  return map[s] || { bg: '#9ca3af18', color: '#9ca3af' }
}

const CAT_COLORS = ['#7B5EA7','#B5603A','#C08A2E','#4F6472','#5B6B4E','#88693D','#3485D4','#6B7280','#BE185D']
const catColor = (cat, i) => CAT_COLORS[i % CAT_COLORS.length]

export default function MonthlyPlanner() {
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [events, setEvents] = useState([])
  const [filterNgo, setFilterNgo] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [ngos, setNgos] = useState([])
  const [hlNgo, setHlNgo] = useState('')
  const [hlCategory, setHlCategory] = useState('')
  const [hlStatus, setHlStatus] = useState('')
  const ngoMap = Object.fromEntries(ngos.map(n => [n.id, n.name]))

  useEffect(() => { fetchNGOs().then(setNgos).catch(e => console.error('MonthlyPlanner fetchNGOs:', e)) }, [])
  useEffect(() => {
    fetchEventsByMonth(month + 1, year).then(setEvents).catch(e => {
      console.error('MonthlyPlanner fetchEventsByMonth:', e)
      setEvents([])
    })
  }, [month, year])

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()
  const weeks = []
  let cells = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(d)
    if (cells.length === 7) { weeks.push(cells); cells = [] }
  }
  if (cells.length) { while (cells.length < 7) cells.push(null); weeks.push(cells) }

  const filtered = events.filter(e => {
    if (filterNgo && e.ngo_id !== filterNgo) return false
    if (filterCategory && e.category !== filterCategory) return false
    if (filterStatus && e.status !== filterStatus) return false
    return true
  })

  const getEventsForDay = (day) => filtered.filter(e => {
    const d = new Date(e.date); return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year
  })

  const isToday = (d) => {
    const today = new Date()
    return d === today.getDate() && month === today.getMonth() && year === today.getFullYear()
  }

  const navigateMonth = (delta) => {
    let m = month + delta
    let y = year
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setMonth(m); setYear(y)
  }

  return (
    <div className="card">
      <div className="card-head">
        <h3>{MONTHS[month]} {year}</h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm" onClick={() => navigateMonth(-1)}>← Prev</button>
          <button className="btn btn-sm" onClick={() => { setMonth(now.getMonth()); setYear(now.getFullYear()) }}>Today</button>
          <button className="btn btn-sm" onClick={() => navigateMonth(1)}>Next →</button>
        </div>
      </div>
      <div className="card-pad">
        <div className="filter-bar">
          <select value={filterNgo} onChange={e => setFilterNgo(e.target.value)}>
            <option value="">All NGOs</option>
            {ngos.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
            {['BSCT','MANN','AFLF'].map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            {EVENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="filter-bar" style={{ marginTop: 8 }}>
          <select value={hlNgo} onChange={e => setHlNgo(e.target.value)}>
            <option value="">Highlight NGO</option>
            {ngos.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
            {['BSCT','MANN','AFLF'].map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <select value={hlCategory} onChange={e => setHlCategory(e.target.value)}>
            <option value="">Highlight Category</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={hlStatus} onChange={e => setHlStatus(e.target.value)}>
            <option value="">Highlight Status</option>
            {EVENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {(hlNgo || hlCategory || hlStatus) && <button className="btn btn-sm" onClick={() => { setHlNgo(''); setHlCategory(''); setHlStatus('') }}>Clear</button>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginTop: 12 }}>
          {DAYS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-soft)', padding: '6px 0', fontWeight: 600 }}>{d}</div>
          ))}
          {weeks.flat().map((d, i) => {
            const dayEvents = d ? getEventsForDay(d) : []
            const today = isToday(d)
            const hasHighlight = d && dayEvents.some(ev =>
              (!hlNgo || ev.ngo_id === hlNgo) &&
              (!hlCategory || ev.category === hlCategory) &&
              (!hlStatus || ev.status === hlStatus)
            )
            return (
              <div key={i} style={{
                minHeight: 110, background: today ? 'var(--sage-light)' : 'var(--card-bg)',
                border: hasHighlight ? '2px solid #7B5EA7' : today ? '1px solid var(--sage)' : '1px solid var(--line)',
                borderRadius: 'var(--radius-sm)', padding: 4, fontSize: 12, position: 'relative', transition: 'box-shadow .15s',
                boxShadow: hasHighlight ? '0 0 6px rgba(123,94,167,.4)' : 'none'
              }}>
                {d && (
                  <span style={{
                    position: 'absolute', top: 3, right: 5, fontWeight: 700, fontSize: 12,
                    color: today ? 'var(--sage)' : 'var(--ink-soft)',
                    background: today ? 'var(--card-bg)' : 'transparent',
                    borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>{d}</span>
                )}
                <div style={{ marginTop: 22 }}>
                  {Object.entries(
                    dayEvents.reduce((acc, ev) => {
                      const cat = ev.category || 'Uncategorized'
                      if (!acc[cat]) acc[cat] = []
                      acc[cat].push(ev)
                      return acc
                    }, {})
                  ).map(([cat, evts], ci) => (
                    <div key={cat} style={{ marginBottom: 3 }}>
                      <div
                        onClick={() => setFilterCategory(c => c === cat ? '' : cat)}
                        style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: catColor(cat, ci), cursor: 'pointer', marginBottom: 1 }}
                      >{cat} ({evts.length})</div>
                      {evts.slice(0, 2).map(ev => {
                        const st = statusStyle(ev.status)
                        return (
                          <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 1, fontSize: 9, lineHeight: 1.2 }}>
                            <span
                              onClick={() => setFilterStatus(s => s === ev.status ? '' : ev.status)}
                              style={{ width: 5, height: 5, borderRadius: '50%', background: st.color, cursor: 'pointer', flexShrink: 0 }}
                              title={ev.status}
                            />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={ev.name}>{ev.name}</span>
                            {ngoMap[ev.ngo_id] && (
                              <span
                                onClick={() => setFilterNgo(n => n === ev.ngo_id ? '' : ev.ngo_id)}
                                style={{ fontSize: 7, color: 'var(--ink-soft)', background: 'var(--line)', padding: '0 3px', borderRadius: 2, cursor: 'pointer', flexShrink: 0 }}
                              >{ngoMap[ev.ngo_id]}</span>
                            )}
                          </div>
                        )
                      })}
                      {evts.length > 2 && <div style={{ fontSize: 8, color: 'var(--ink-soft)', paddingLeft: 7 }}>+{evts.length - 2} more</div>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          {['Completed','Approved','Submitted','Draft','Cancelled','Rejected'].map(s => {
            const st = statusStyle(s)
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--ink-soft)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: st.color }} />
                {s}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--line)' }}>
        <div className="card-head"><h3>Events</h3></div>
        <div className="card-pad" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Date</th><th>Event</th><th>Category</th><th>Venue</th><th>Status</th></tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--ink-soft)' }}>No events this month</td></tr>}
              {filtered.sort((a,b) => new Date(a.date) - new Date(b.date)).map(ev => {
                const rowHl = (!hlNgo || ev.ngo_id === hlNgo) && (!hlCategory || ev.category === hlCategory) && (!hlStatus || ev.status === hlStatus)
                return (
                <tr key={ev.id} style={rowHl ? { background: 'rgba(123,94,167,.08)', outline: '1px solid #7B5EA7' } : {}}>
                  <td>{ev.date?.slice(0,10)}</td>
                  <td style={{ fontWeight: 500 }}>{ev.name}</td>
                  <td>{ev.category}</td>
                  <td>{ev.venue}</td>
                  <td><span className={`pill pill-${ev.status === 'Completed' ? 'green' : ev.status === 'Approved' ? 'blue' : ev.status === 'Draft' ? 'gray' : 'red'}`}>{ev.status}</span></td>
                </tr>
                )})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
