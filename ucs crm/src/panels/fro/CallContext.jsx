import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'
import { api } from './api/auth'

const CallContext = createContext()

const STATS_KEY = 'fro_call_stats'

function loadStats(userId) {
  try {
    const raw = localStorage.getItem(STATS_KEY)
    if (!raw) return { calls: 0, totalSeconds: 0, skippedDonors: 0, idleSeconds: 0 }
    const data = JSON.parse(raw)
    const today = new Date().toISOString().slice(0, 10)
    if (data.date === today && data.userId === userId) {
      return {
        calls: data.calls || 0,
        totalSeconds: data.totalSeconds || 0,
        skippedDonors: data.skippedDonors || 0,
        idleSeconds: data.idleSeconds || 0,
      }
    }
    return { calls: 0, totalSeconds: 0, skippedDonors: 0, idleSeconds: 0 }
  } catch { return { calls: 0, totalSeconds: 0, skippedDonors: 0, idleSeconds: 0 } }
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
    }))
  } catch {}
}

function fmt(seconds) {
  if (seconds == null) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function CallProvider({ children, userId }) {
  const [activeCall, setActiveCall] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef(null)
  const [todayStats, setTodayStats] = useState(() => loadStats(userId))
  const donorViewStartRef = useRef(null)
  const lastDonorIdRef = useRef(null)

  useEffect(() => {
    if (activeCall) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - activeCall.startTime) / 1000))
      }, 1000)
      return () => clearInterval(timerRef.current)
    } else {
      setElapsed(0)
    }
  }, [activeCall])

  useEffect(() => {
    api('/fro/status', {
      method: 'PUT',
      body: JSON.stringify({
        status: 'online',
        today_calls: todayStats.calls,
        today_talk_seconds: todayStats.totalSeconds,
        today_skipped: todayStats.skippedDonors,
        today_idle_seconds: todayStats.idleSeconds,
      }),
    }).catch(() => {})
    return () => {
      api('/fro/status', { method: 'PUT', body: JSON.stringify({ status: 'offline' }) }).catch(() => {})
    }
  }, [])

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
    donorViewStartRef.current = null
    setActiveCall({
      donorId: donor.id || donor.donorId,
      donorName: donor.donor_name || donor.donorName,
      donorMobile: donor.donor_mobile || donor.donorMobile,
      startTime: Date.now(),
    })
    api('/fro/status', {
      method: 'PUT',
      body: JSON.stringify({
        status: 'on_call',
        current_donor_name: donor.donor_name || donor.donorName,
        current_donor_id: donor.id || donor.donorId,
        today_calls: todayStats.calls,
        today_talk_seconds: todayStats.totalSeconds,
        today_skipped: todayStats.skippedDonors,
        today_idle_seconds: todayStats.idleSeconds,
      }),
    }).catch(() => {})
  }, [todayStats])

  const syncStats = useCallback(() => {
    api('/fro/status', {
      method: 'PUT',
      body: JSON.stringify({
        status: todayStats.idleSeconds > 0 ? 'idle' : 'online',
        today_calls: todayStats.calls,
        today_talk_seconds: todayStats.totalSeconds,
        today_skipped: todayStats.skippedDonors,
        today_idle_seconds: todayStats.idleSeconds,
      }),
    }).catch(() => {})
  }, [todayStats])

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
    api('/fro/status', {
      method: 'PUT',
      body: JSON.stringify({
        status: 'idle',
        current_donor_name: null,
        current_donor_id: null,
        today_calls: todayStats.calls + 1,
        today_talk_seconds: todayStats.totalSeconds + (activeCall ? Math.floor((Date.now() - activeCall.startTime) / 1000) : 0),
        today_skipped: todayStats.skippedDonors,
        today_idle_seconds: todayStats.idleSeconds,
      }),
    }).catch(() => {})
  }, [activeCall, userId, todayStats])

  return (
    <CallContext.Provider value={{
      activeCall, elapsed, todayStats, startCall, endCall, isOnCall: !!activeCall,
      startDonorView, endDonorView, syncStats, fmt,
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
