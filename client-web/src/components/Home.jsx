import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store'
import { api } from '../api'
import HomeModals from './HomeModals'

let notifInterval = null

export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [time, setTime] = useState(new Date())
  const [today, setToday] = useState(null)
  const [history, setHistory] = useState([])
  const [punched, setPunched] = useState(false)
  const [loading, setLoading] = useState(true)
  const [unread, setUnread] = useState(0)
  const [showNotifs, setShowNotifs] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [showLeave, setShowLeave] = useState(false)
  const [showAdvance, setShowAdvance] = useState(false)

  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t) }, [])

  const loadData = useCallback(async () => {
    try {
      const [td, h] = await Promise.all([api.today(), api.history()])
      setToday(td?.attendance || td || {})
      setHistory(Array.isArray(h) ? h : h?.history || [])
      setPunched(!!(td?.attendance?.punch_in_time || td?.punch_in_time))
    } catch (_) {} finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (!user?.id) return
    api.unreadCount(user.id).then(d => setUnread(d?.count || 0)).catch(() => {})
    notifInterval = setInterval(() => {
      api.unreadCount(user.id).then(d => setUnread(d?.count || 0)).catch(() => {})
    }, 30000)
    return () => { if (notifInterval) clearInterval(notifInterval) }
  }, [user?.id])

  const openNotifs = async () => {
    setShowNotifs(!showNotifs)
    if (!showNotifs && user?.id) {
      const n = await api.notifications(user.id).catch(() => [])
      setNotifications(Array.isArray(n) ? n : [])
    }
  }

  const handlePunch = () => navigate('/scanner', { state: { returnTo: '/home' } })

  const formatTime = (iso) => {
    if (!iso) return '--:--'
    const d = new Date(new Date(iso).getTime() + 5.5 * 60 * 60 * 1000)
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  }

  const calcWorked = () => {
    const inTime = today?.punch_in_time
    if (!inTime) return null
    const diff = (Date.now() - new Date(inTime).getTime()) / 3600000
    const h = Math.floor(diff); const m = Math.floor((diff - h) * 60)
    return `${h}h ${m}m`
  }

  const allHistory = Array.isArray(history) ? history : []
  const presentLate = allHistory.filter(r => r.status === 'present' || r.status === 'late').length
  const totalDays = allHistory.length || 1
  const attendancePct = Math.round((presentLate / totalDays) * 100) || 0
  const totalLate = allHistory.reduce((s, r) => s + (r.late_minutes || 0), 0)

  const hours = String(time.getHours() % 12 || 12).padStart(2, '0')
  const mins = String(time.getMinutes()).padStart(2, '0')
  const ampm = time.getHours() >= 12 ? 'PM' : 'AM'

  return (
    <>
      <div className="p-4 max-w-lg mx-auto space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--ink-muted)]">Hello there</div>
            <div className="text-lg font-bold text-[var(--primary)]">{user?.name?.split(' ')[0] || 'Employee'}</div>
          </div>
          <button onClick={openNotifs} className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <BellSvg className="w-5 h-5 text-[var(--ink-soft)]" />
            {unread > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[var(--red)] text-white text-[9px] flex items-center justify-center font-bold">{unread > 9 ? '9+' : unread}</span>}
          </button>
        </div>

        {/* Notifications Sheet */}
        {showNotifs && (
          <div className="fixed inset-0 z-50" onClick={() => setShowNotifs(false)}>
            <div className="absolute inset-0 bg-black/20" />
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[60vh] overflow-y-auto animate-slide-up shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-[var(--border)] px-4 py-3 flex items-center justify-between rounded-t-2xl">
                <h3 className="font-semibold text-sm">Notifications</h3>
                <button onClick={() => setShowNotifs(false)} className="text-[var(--ink-soft)] text-lg">&times;</button>
              </div>
              <div className="p-4 space-y-2">
                {notifications.length === 0 ? (
                  <div className="text-center py-8 text-sm text-[var(--ink-muted)]">No notifications</div>
                ) : notifications.map((n, i) => (
                  <div key={n.id || i} className="p-3 rounded-lg bg-[var(--surface)] text-sm">
                    <div className="font-medium">{n.title || n.message}</div>
                    {n.title && n.message && <div className="text-[var(--ink-soft)] text-xs mt-0.5">{n.message}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Shift Badge */}
        <div className="inline-block px-3 py-1 rounded-full bg-[var(--primary)]/5 text-[10px] font-semibold text-[var(--primary)] tracking-wider">
          SHIFT 10:00 - 19:00
        </div>

        {/* Clock + Punch */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[var(--border)] text-center">
          <div className="text-5xl font-bold text-[var(--primary)] tracking-tight font-mono">
            {hours}:{mins} <span className="text-lg font-normal text-[var(--ink-muted)]">{ampm}</span>
          </div>
          {punched && <div className="mt-1 inline-block px-3 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">{calcWorked()} worked</div>}

          <div className="mt-6 flex justify-center">
            <button onClick={handlePunch}
              className={`w-44 h-44 rounded-full flex items-center justify-center text-white font-bold text-lg transition-all duration-300 animate-pulse-ring aspect-square shrink-0 ${
                punched ? 'bg-gradient-to-br from-blue-600 to-blue-800' : 'bg-gradient-to-br from-slate-800 to-slate-900'
              }`}
              style={{ borderRadius: '50%' }}>
              <div className="text-center text-xl leading-tight">{punched ? <>Punch<br />Out</> : <>Punch<br />In</>}</div>
            </button>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
              <div className="text-[10px] text-[var(--ink-muted)] uppercase tracking-wider">In</div>
              <div className="text-lg font-semibold mt-0.5">{formatTime(today?.punch_in_time)}</div>
            </div>
            <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
              <div className="text-[10px] text-[var(--ink-muted)] uppercase tracking-wider">Out</div>
              <div className="text-lg font-semibold mt-0.5">{formatTime(today?.punch_out_time)}</div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate('/attendance')} className="bg-white rounded-xl p-4 shadow-sm border border-[var(--border)] text-left hover:border-blue-200 transition-colors">
            <div className="text-[10px] text-[var(--ink-muted)] uppercase tracking-wider">Attendance</div>
            <div className="text-2xl font-bold text-[var(--sage)] mt-1">{attendancePct}%</div>
            <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-[var(--sage)] transition-all duration-500" style={{ width: `${attendancePct}%` }} />
            </div>
          </button>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-[var(--border)]">
            <div className="text-[10px] text-[var(--ink-muted)] uppercase tracking-wider">Late Batch</div>
            <div className="text-2xl font-bold text-[var(--orange)] mt-1">{totalLate}m</div>
            <div className="mt-1 text-[10px] text-[var(--ink-soft)]">
              {totalLate > 480 ? '1+ day deducted' : totalLate > 240 ? '1 day deducted' : totalLate > 180 ? '0.5 day' : 'No deduction'}
            </div>
          </div>
        </div>

        {/* Action Links */}
        <div className="bg-white rounded-xl shadow-sm border border-[var(--border)] divide-y divide-[var(--border)]">
          <button onClick={() => setShowLeave(true)} className="flex items-center gap-3 px-4 py-3.5 w-full text-left hover:bg-[var(--surface)] transition-colors">
            <PlaneSvg className="w-5 h-5 text-[var(--primary-light)] shrink-0" />
            <span className="text-sm flex-1">Take a break or leave</span>
            <ChevronSvg className="w-4 h-4 text-[var(--ink-muted)]" />
          </button>
          <button onClick={() => setShowAdvance(true)} className="flex items-center gap-3 px-4 py-3.5 w-full text-left hover:bg-[var(--surface)] transition-colors">
            <DollarSvg className="w-5 h-5 text-[var(--primary-light)] shrink-0" />
            <span className="text-sm flex-1">Apply for Advance / Loan</span>
            <ChevronSvg className="w-4 h-4 text-[var(--ink-muted)]" />
          </button>
        </div>
      </div>

      <HomeModals showLeave={showLeave} setShowLeave={setShowLeave} showAdvance={showAdvance} setShowAdvance={setShowAdvance} />
    </>
  )
}

function BellSvg({ className }) { return <svg width={20} height={20} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg> }
function PlaneSvg({ className }) { return <svg width={20} height={20} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg> }
function DollarSvg({ className }) { return <svg width={20} height={20} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> }
function ChevronSvg({ className }) { return <svg width={14} height={14} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg> }
