import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'
import { api } from './api/auth'

const CallContext = createContext()

const STATS_KEY = 'fro_call_stats'
const BREAK_LIMIT = 3600

function loadStats(userId) {
  try {
    const raw = localStorage.getItem(STATS_KEY)
    if (!raw) return { calls: 0, totalSeconds: 0, skippedDonors: 0, idleSeconds: 0, breakSeconds: 0, breakCount: 0 }
    const data = JSON.parse(raw)
    const today = new Date().toISOString().slice(0, 10)
    if (data.date === today && data.userId === userId) {
      return {
        calls: data.calls || 0,
        totalSeconds: data.totalSeconds || 0,
        skippedDonors: data.skippedDonors || 0,
        idleSeconds: data.idleSeconds || 0,
        breakSeconds: data.breakSeconds || 0,
        breakCount: data.breakCount || 0,
      }
    }
    return { calls: 0, totalSeconds: 0, skippedDonors: 0, idleSeconds: 0, breakSeconds: 0, breakCount: 0 }
  } catch { return { calls: 0, totalSeconds: 0, skippedDonors: 0, idleSeconds: 0, breakSeconds: 0, breakCount: 0 } }
}

function saveStats(userId, stats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify({
      date: new Date().toISOString().slice(0, 10),
      userId,
      calls: stats.calls,
      totalSeconds: stats.totalSeconds,
      skippedDonors: stats.skippedDonors,
      idleSeconds: stats.idleSeconds,
      breakSeconds: stats.breakSeconds,
      breakCount: stats.breakCount,
    }))
  } catch {}
}

function fmt(seconds) {
  if (seconds == null) return '00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function CallProvider({ children, userId }) {
  const [activeCall, setActiveCall] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef(null)
  const [todayStats, setTodayStats] = useState(() => loadStats(userId))
  const donorViewStartRef = useRef(null)
  const lastDonorIdRef = useRef(null)
  const [onBreak, setOnBreak] = useState(false)
  const [breakElapsed, setBreakElapsed] = useState(0)
  const breakTimerRef = useRef(null)

  const clearTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }
  const clearBreakTimer = () => { if (breakTimerRef.current) { clearInterval(breakTimerRef.current); breakTimerRef.current = null } }

  const totalBreakWithCurrent = todayStats.breakSeconds + (onBreak ? breakElapsed : 0)
  const isBreakOvertime = totalBreakWithCurrent > BREAK_LIMIT

  const syncAllStats = useCallback((extra = {}) => {
    const status = onBreak ? 'break' : (activeCall ? 'on_call' : (todayStats.idleSeconds > 0 ? 'idle' : 'online'))
    api('/fro/status', {
      method: 'PUT',
      body: JSON.stringify({
        status,
        current_donor_name: activeCall?.donorName || null,
        current_donor_id: activeCall?.donorId || null,
        today_calls: todayStats.calls,
        today_talk_seconds: todayStats.totalSeconds,
        today_skipped: todayStats.skippedDonors,
        today_idle_seconds: todayStats.idleSeconds,
        today_break_seconds: todayStats.breakSeconds,
        on_break: onBreak,
        ...extra,
      }),
    }).catch(() => {})
  }, [activeCall, onBreak, todayStats])

  useEffect(() => {
    syncAllStats()
    return () => { api('/fro/status', { method: 'PUT', body: JSON.stringify({ status: 'offline' }) }).catch(() => {}) }
  }, [])

  useEffect(() => {
    if (activeCall) {
      clearBreakTimer()
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - activeCall.startTime) / 1000))
      }, 1000)
      return clearTimer
    } else {
      setElapsed(0)
    }
  }, [activeCall])

  useEffect(() => {
    if (onBreak) {
      clearTimer()
      breakTimerRef.current = setInterval(() => {
        setBreakElapsed(prev => prev + 1)
      }, 1000)
      return clearBreakTimer
    } else {
      setBreakElapsed(0)
    }
  }, [onBreak])

  const startDonorView = useCallback((donorId) => {
    donorViewStartRef.current = Date.now()
    lastDonorIdRef.current = donorId
  }, [])

  const endDonorView = useCallback((wasCalled) => {
    const start = donorViewStartRef.current
    if (!start) return
    const elapsedView = Math.floor((Date.now() - start) / 1000)
    if (!wasCalled && elapsedView >= 3) {
      setTodayStats(prev => {
        const next = {
          ...prev,
          skippedDonors: prev.skippedDonors + 1,
          idleSeconds: prev.idleSeconds + elapsedView,
        }
        saveStats(userId, next)
        return next
      })
    }
    donorViewStartRef.current = null
  }, [userId])

  const startCall = useCallback((donor) => {
    if (onBreak) toggleBreak()
    donorViewStartRef.current = null
    setActiveCall({
      donorId: donor.id || donor.donorId,
      donorName: donor.donor_name || donor.donorName,
      donorMobile: donor.donor_mobile || donor.donorMobile,
      startTime: Date.now(),
    })
  }, [onBreak])

  const endCall = useCallback(() => {
    if (activeCall) {
      const duration = Math.floor((Date.now() - activeCall.startTime) / 1000)
      setTodayStats(prev => {
        const next = { ...prev, calls: prev.calls + 1, totalSeconds: prev.totalSeconds + duration }
        saveStats(userId, next)
        return next
      })
    }
    setActiveCall(null)
  }, [activeCall, userId])

  const toggleBreak = useCallback(() => {
    if (onBreak) {
      setTodayStats(prev => {
        const next = { ...prev, breakSeconds: prev.breakSeconds + breakElapsed, breakCount: prev.breakCount + 1 }
        saveStats(userId, next)
        return next
      })
      setOnBreak(false)
      setBreakElapsed(0)
    } else {
      setOnBreak(true)
      setBreakElapsed(0)
    }
  }, [onBreak, breakElapsed, userId])

  return (
    <CallContext.Provider value={{
      activeCall, elapsed, todayStats, startCall, endCall, isOnCall: !!activeCall,
      startDonorView, endDonorView, syncAllStats, fmt,
      onBreak, breakElapsed, toggleBreak, isBreakOvertime, BREAK_LIMIT,
    }}>
      {children}
    </CallContext.Provider>
  )
}

export function useCall() {
  const ctx = useContext(CallContext)
  if (!ctx) throw new Error('useCall must be used within CallProvider')
  return ctx
}
