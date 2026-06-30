import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtTime(iso) {
  if (!iso) return '--:--'
  const d = new Date(new Date(iso).getTime() + 5.5 * 60 * 60 * 1000)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(new Date(iso).getTime() + 5.5 * 60 * 60 * 1000)
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]}`
}

function Badge({ status }) {
  const map = {
    present: 'bg-[var(--green-bg)] text-[var(--green)]',
    late: 'bg-[var(--orange-bg)] text-[var(--orange)]',
    absent: 'bg-[var(--red-bg)] text-[var(--red)]',
    leave: 'bg-[var(--blue-bg)] text-[var(--blue)]',
    'half-day': 'bg-[var(--purple-bg)] text-[var(--purple)]',
  }
  return <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${map[status] || 'bg-gray-100 text-gray-500'}`}>{status || '?'}</span>
}

export default function AttendanceList() {
  const now = new Date()
  const navigate = useNavigate()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const h = await api.history()
      const list = Array.isArray(h) ? h : h?.history || []
      setRecords(list)
    } catch (_) {} finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = records.filter(r => {
    if (!r.date) return false
    const [y, m] = r.date.split('-').map(Number)
    return y === year && m === month
  })

  const canGoNext = month < now.getMonth() + 1 || year < now.getFullYear()
  const canGoPrev = true

  const goPrev = () => { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const goNext = () => { if (canGoNext) { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) } }

  return (
    <div className="p-4 max-w-lg mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h2 className="text-lg font-bold text-[var(--primary)]">Attendance History</h2>
      </div>

      {/* Month Filter */}
      <div className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm border border-[var(--border)] mb-4">
        <button onClick={goPrev} disabled={!canGoPrev} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="font-semibold text-sm">{MONTHS[month - 1]} {year}</div>
        <button onClick={goNext} disabled={!canGoNext} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-[var(--ink-muted)]">No records for this month</div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((r, i) => (
            <div key={r.id || i} className={`flex items-center gap-3 bg-white rounded-xl p-3.5 shadow-sm border border-[var(--border)] animate-fade-in`} style={{ animationDelay: `${i * 30}ms` }}>
              <div className="w-12 text-center">
                <div className="text-xs text-[var(--ink-muted)]">{MONTHS[month - 1]}</div>
                <div className="text-lg font-bold">{r.date?.split('-')[2]}</div>
              </div>
              <Badge status={r.status} />
              <div className="flex-1 text-right text-xs text-[var(--ink-soft)]">
                <div>In: {fmtTime(r.punch_in_time)}</div>
                <div>Out: {fmtTime(r.punch_out_time)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
