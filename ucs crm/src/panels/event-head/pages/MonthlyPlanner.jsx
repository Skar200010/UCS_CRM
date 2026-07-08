import { useState, useEffect, useMemo, useCallback } from 'react'
import { fetchEventsByMonth, fetchNGOs } from '../store'
import SummaryCards from '../components/planner/SummaryCards'
import PlannerFilters from '../components/planner/PlannerFilters'
import CalendarToolbar from '../components/planner/CalendarToolbar'
import CalendarGrid from '../components/planner/CalendarGrid'
import EventModal from '../components/planner/EventModal'
import EmptyState from '../components/planner/EmptyState'
import LoadingSkeleton from '../components/planner/LoadingSkeleton'

const now = new Date()

export default function MonthlyPlanner() {
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [ngos, setNgos] = useState([])

  /* ── Filters ── */
  const [search, setSearch] = useState('')
  const [filterNgo, setFilterNgo] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')

  /* ── UI state ── */
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [tooltip, setTooltip] = useState({ show: false, event: null, x: 0, y: 0 })

  const ngoMap = useMemo(() => Object.fromEntries(ngos.map(n => [n.id, n.name])), [ngos])

  /* ── Data fetching ── */
  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchEventsByMonth(month + 1, year).catch(() => []),
      fetchNGOs().catch(() => []),
    ]).then(([evts, n]) => {
      setEvents(Array.isArray(evts) ? evts : [])
      setNgos(Array.isArray(n) ? n : [])
    }).catch(e => {
      console.error('MonthlyPlanner fetch:', e)
      setEvents([])
    }).finally(() => setLoading(false))
  }, [month, year])

  /* ── Calendar derivation ── */
  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month])
  const firstDay = useMemo(() => new Date(year, month, 1).getDay(), [year, month])

  const weeks = useMemo(() => {
    const w = []
    let cells = Array(firstDay).fill(null)
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(d)
      if (cells.length === 7) { w.push(cells); cells = [] }
    }
    if (cells.length) { while (cells.length < 7) cells.push(null); w.push(cells) }
    return w
  }, [firstDay, daysInMonth])

  /* ── Filtering ── */
  const filtered = useMemo(() => {
    return events.filter(e => {
      if (filterNgo && e.ngo_id !== filterNgo) return false
      if (filterCategory && e.category !== filterCategory) return false
      if (filterStatus && e.status !== filterStatus) return false
      if (filterPriority && e.priority !== filterPriority) return false
      if (search) {
        const q = search.toLowerCase()
        const match = [e.name, e.venue, ngoMap[e.ngo_id], e.category, e.coordinator, e.district]
          .some(v => v?.toLowerCase().includes(q))
        if (!match) return false
      }
      return true
    })
  }, [events, filterNgo, filterCategory, filterStatus, filterPriority, search, ngoMap])

  const getEventsForDay = useCallback((day) => {
    if (!day) return []
    return filtered.filter(e => {
      const d = new Date(e.date)
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year
    })
  }, [filtered, month, year])

  /* ── Summary ── */
  const today = useMemo(() => new Date(), [])
  const summary = useMemo(() => ({
    total: filtered.length,
    today: filtered.filter(e => {
      const d = new Date(e.date)
      return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
    }).length,
    upcoming: filtered.filter(e => new Date(e.date) > today).length,
    completed: filtered.filter(e => e.status === 'Completed').length,
    cancelled: filtered.filter(e => e.status === 'Cancelled').length,
    approved: filtered.filter(e => e.status === 'Approved').length,
    submitted: filtered.filter(e => e.status === 'Submitted').length,
    draft: filtered.filter(e => e.status === 'Draft').length,
  }), [filtered])

  /* ── Actions ── */
  const clearFilters = useCallback(() => {
    setSearch(''); setFilterNgo(''); setFilterCategory(''); setFilterStatus('')
    setFilterPriority('')
  }, [])

  const hasActiveFilters = search || filterNgo || filterCategory || filterStatus || filterPriority

  const navigateMonth = useCallback((delta) => {
    let m = month + delta
    let y = year
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setMonth(m); setYear(y)
  }, [month, year])

  const handleEventClick = useCallback((event) => {
    setTooltip({ show: false, event: null, x: 0, y: 0 })
    setSelectedEvent(event)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SummaryCards summary={summary} />

      <PlannerFilters
        search={search} onSearchChange={setSearch}
        filterNgo={filterNgo} onNgoChange={setFilterNgo}
        filterCategory={filterCategory} onCategoryChange={setFilterCategory}
        filterStatus={filterStatus} onStatusChange={setFilterStatus}
        filterPriority={filterPriority} onPriorityChange={setFilterPriority}
        ngos={ngos}
        hasActiveFilters={hasActiveFilters} onClear={clearFilters}
      />

      <div className="card">
        <CalendarToolbar
          year={year} month={month}
          onPrev={() => navigateMonth(-1)}
          onNext={() => navigateMonth(1)}
          onToday={() => { setMonth(now.getMonth()); setYear(now.getFullYear()) }}
          onMonthChange={setMonth}
          onYearChange={setYear}
        />
        <div className="card-pad">
          {loading ? (
            <LoadingSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <CalendarGrid
              weeks={weeks}
              month={month}
              year={year}
              getEventsForDay={getEventsForDay}
              onEventClick={handleEventClick}
              onEventHover={setTooltip}
              onEventLeave={() => setTooltip({ show: false, event: null, x: 0, y: 0 })}
              ngoMap={ngoMap}
            />
          )}
        </div>
      </div>

      {selectedEvent && (
        <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  )
}
