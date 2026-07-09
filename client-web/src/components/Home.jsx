import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../store'
import { api } from '../api'
import HomeModals from './HomeModals'

export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [time, setTime] = useState(new Date())
  const [today, setToday] = useState(null)
  const [history, setHistory] = useState([])
  const [punched, setPunched] = useState(false)
  const [loading, setLoading] = useState(true)
  const [punching, setPunching] = useState(false)
  const [unread, setUnread] = useState(0)
  const [showNotifs, setShowNotifs] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [showLeave, setShowLeave] = useState(false)
  const [showAdvance, setShowAdvance] = useState(false)
  const [shiftStart, setShiftStart] = useState('10:00')
  const [shiftEnd, setShiftEnd] = useState('19:00')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const pollRef = useRef(null)
  const notifPollRef = useRef(null)

  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t) }, [])

  const loadData = useCallback(async () => {
    try {
      const [td, h] = await Promise.all([api.today(), api.history()])
      const att = td?.attendance || td || {}
      setToday(att)
      setHistory(Array.isArray(h) ? h : h?.history || [])
      setPunched(!!(att?.punch_in_time))
      if (att?.punch_out_time) setPunched(false)
    } catch (_) {} finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    api.myProfile().then(d => {
      const w = d?.worker || d
      if (w?.shift_start_time) setShiftStart(w.shift_start_time)
      if (w?.shift_end_time) setShiftEnd(w.shift_end_time)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!user?.id) return
    api.unreadCount(user.id).then(d => setUnread(d?.count || 0)).catch(() => {})
    notifPollRef.current = setInterval(() => {
      api.unreadCount(user.id).then(d => setUnread(d?.count || 0)).catch(() => {})
    }, 30000)
    pollRef.current = setInterval(() => {
      api.today().then(td => {
        const att = td?.attendance || td || {}
        setToday(att)
        setPunched(!!(att?.punch_in_time))
        if (att?.punch_out_time) setPunched(false)
      }).catch(() => {})
    }, 15000)
    return () => {
      if (notifPollRef.current) clearInterval(notifPollRef.current)
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [user?.id])

  useEffect(() => {
    const onVisible = () => { if (!document.hidden) loadData() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [loadData])

  useEffect(() => {
    if (location.state?.refresh) {
      loadData()
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state?.refresh])

  const clearMessages = () => { setError(''); setSuccessMsg('') }

  const openNotifs = async () => {
    setShowNotifs(!showNotifs)
    if (!showNotifs && user?.id) {
      const n = await api.notifications(user.id).catch(() => [])
      setNotifications(Array.isArray(n) ? n : [])
    }
  }

  const handlePunchIn = () => navigate('/scanner', { state: { returnTo: '/home' } })

  const handlePunchOut = async () => {
    clearMessages()
    if (!navigator.geolocation) {
      setError('Geolocation not supported on this device.')
      return
    }
    setPunching(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await api.punchOut(pos.coords.latitude, pos.coords.longitude)
          setSuccessMsg('Punched out successfully!')
          await loadData()
        } catch (err) {
          setError(err.message || 'Punch out failed.')
        } finally { setPunching(false) }
      },
      () => {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              await api.punchOut(pos.coords.latitude, pos.coords.longitude)
              setSuccessMsg('Punched out successfully!')
              await loadData()
            } catch (err) {
              setError(err.message || 'Punch out failed.')
            } finally { setPunching(false) }
          },
          () => {
            setError('Location access is required to punch out. Enable location in your device settings.')
            setPunching(false)
          },
          { enableHighAccuracy: false, timeout: 10000 }
        )
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handlePunch = () => {
    clearMessages()
    if (today?.punch_out_time) {
      setError('Already punched out today.')
      return
    }
    if (today?.punch_in_time) {
      handlePunchOut()
    } else {
      handlePunchIn()
    }
  }

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

  const isPunchingOut = !!(today?.punch_in_time && !today?.punch_out_time)

  return (
    <>
      <div className="p-4 max-w-lg mx-auto space-y-4 animate-fade-in safe-top">
        {/* Error / Success Toast */}
        {error && (
          <div className="bg-[var(--red-bg)] text-[var(--red)] text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 animate-fade-in">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')} className="opacity-60 hover:opacity-100">&times;</button>
          </div>
        )}
        {successMsg && (
          <div className="bg-[var(--green-bg)] text-[var(--green)] text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 animate-fade-in">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span className="flex-1">{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="opacity-60 hover:opacity-100">&times;</button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--ink-muted)]">Hello there</div>
            <div className="text-lg font-bold text-[var(--primary)]">{user?.name?.split(' ')[0] || 'Employee'}</div>
          </div>
          <button onClick={openNotifs} className="relative p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
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
                <button onClick={() => setShowNotifs(false)} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--ink-soft)] text-lg">&times;</button>
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
          SHIFT {shiftStart} - {shiftEnd}
        </div>

        {/* Clock + Punch */}
        <div className="bg-white rounded-2xl px-4 py-5 sm:p-6 shadow-sm border border-[var(--border)] text-center">
          <div className="text-4xl sm:text-5xl font-bold text-[var(--primary)] tracking-tight font-mono">
            {hours}:{mins} <span className="text-base sm:text-lg font-normal text-[var(--ink-muted)]">{ampm}</span>
          </div>
          {isPunchingOut && <div className="mt-1 inline-block px-3 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">{calcWorked()} worked</div>}
          {today?.punch_out_time && <div className="mt-1 inline-block px-3 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">Done for the day</div>}

          <div className="mt-5 sm:mt-6 flex justify-center">
            <button onClick={handlePunch} disabled={punching}
              className={`w-36 h-36 sm:w-44 sm:h-44 rounded-full flex items-center justify-center text-white font-bold text-base sm:text-lg transition-all duration-300 aspect-square shrink-0 active:scale-95 disabled:opacity-70 ${
                today?.punch_out_time
                  ? 'bg-gradient-to-br from-gray-400 to-gray-500 cursor-default'
                  : isPunchingOut
                    ? 'bg-gradient-to-br from-blue-600 to-blue-800 animate-pulse-ring'
                    : 'bg-gradient-to-br from-slate-800 to-slate-900 animate-pulse-ring'
              }`}
              style={{ borderRadius: '50%' }}>
              {punching ? (
                <div className="flex flex-col items-center gap-1">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">Working...</span>
                </div>
              ) : (
                <div className="text-center text-base sm:text-xl leading-tight">
                  {today?.punch_out_time
                    ? <>Done</>
                    : isPunchingOut
                      ? <>Punch<br />Out</>
                      : <>Punch<br />In</>
                  }
                </div>
              )}
            </button>
          </div>

          <div className="mt-5 sm:mt-6 grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
              <div className="text-[10px] text-[var(--ink-muted)] uppercase tracking-wider">In</div>
              <div className="text-base sm:text-lg font-semibold mt-0.5">{formatTime(today?.punch_in_time)}</div>
            </div>
            <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
              <div className="text-[10px] text-[var(--ink-muted)] uppercase tracking-wider">Out</div>
              <div className="text-base sm:text-lg font-semibold mt-0.5">{formatTime(today?.punch_out_time)}</div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate('/attendance')} className="bg-white rounded-xl p-4 shadow-sm border border-[var(--border)] text-left hover:border-blue-200 transition-colors min-h-[88px]">
            <div className="text-[10px] text-[var(--ink-muted)] uppercase tracking-wider">Attendance</div>
            <div className="text-xl sm:text-2xl font-bold text-[var(--sage)] mt-1">{attendancePct}%</div>
            <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-[var(--sage)] transition-all duration-500" style={{ width: `${attendancePct}%` }} />
            </div>
          </button>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-[var(--border)] flex flex-col justify-center min-h-[88px]">
            <div className="text-[10px] text-[var(--ink-muted)] uppercase tracking-wider">Late Batch</div>
            <div className="text-xl sm:text-2xl font-bold text-[var(--orange)] mt-1">{totalLate}m</div>
            <div className="mt-1 text-[10px] text-[var(--ink-soft)]">
              {totalLate > 480 ? '1+ day deducted' : totalLate > 240 ? '1 day deducted' : totalLate > 180 ? '0.5 day' : 'No deduction'}
            </div>
          </div>
        </div>

        {/* Action Links */}
        <div className="bg-white rounded-xl shadow-sm border border-[var(--border)] divide-y divide-[var(--border)]">
          <button onClick={() => setShowLeave(true)} className="flex items-center gap-3 px-4 py-3.5 w-full text-left hover:bg-[var(--surface)] transition-colors min-h-[52px]">
            <PlaneSvg className="w-5 h-5 text-[var(--primary-light)] shrink-0" />
            <span className="text-sm flex-1">Take a break or leave</span>
            <ChevronSvg className="w-4 h-4 text-[var(--ink-muted)]" />
          </button>
          <button onClick={() => setShowAdvance(true)} className="flex items-center gap-3 px-4 py-3.5 w-full text-left hover:bg-[var(--surface)] transition-colors min-h-[52px]">
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
