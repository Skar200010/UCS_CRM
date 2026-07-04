import { useState, useEffect } from 'react'
import { useUcs } from '../../../store'
import { supabase } from '../../../config/supabase'
import { api } from '../../../api/auth'

function fmt(seconds) {
  if (seconds == null) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const STATUS_META = {
  on_call: { label: 'On Call', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  online: { label: 'Online', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  idle: { label: 'Idle', color: '#f59e0b', bg: '#fefce8', border: '#fde68a' },
  offline: { label: 'Offline', color: '#9ca3af', bg: '#f9fafb', border: '#e5e7eb' },
}

export default function LiveFroStatus() {
  const { user } = useUcs()
  const [statuses, setStatuses] = useState([])
  const [loading, setLoading] = useState(true)

  const loadStatuses = async () => {
    try {
      const data = await api('/fro/status', { _prefix: 'ucs' })
      setStatuses(data || [])
    } catch { setStatuses([]) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    loadStatuses()
    const interval = setInterval(loadStatuses, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel('fro_live_status_sa_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'fro_live_status' },
        () => loadStatuses()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  const onlineCount = statuses.filter(s => s.status === 'on_call' || s.status === 'online').length

  const statusDot = (status) => {
    const meta = STATUS_META[status] || STATUS_META.offline
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, display: 'inline-block',
          animation: status === 'on_call' ? 'pulse 1s ease-in-out infinite' : 'none' }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: meta.color }}>{meta.label}</span>
      </span>
    )
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--ink-soft)' }}>Loading FRO statuses...</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>radio</span>
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Live FRO Status</h3>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{onlineCount} online · {statuses.length} total FROs</div>
        </div>
      </div>

      {statuses.length === 0 ? (
        <div className="card" style={{ alignItems: 'center', padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8, opacity: .3 }}>📡</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No FROs active</div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>FROs will appear here when they log in and start working.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {statuses.map(fs => {
            const meta = STATUS_META[fs.status] || STATUS_META.offline
            const workerName = fs.workers?.name || 'Unknown'
            const initials = workerName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
            const totalActive = (fs.today_talk_seconds || 0) + (fs.today_idle_seconds || 0)
            const productivity = totalActive > 0 ? Math.round(((fs.today_talk_seconds || 0) / totalActive) * 100) : null
            return (
              <div key={fs.id} className="card" style={{
                marginBottom: 0, padding: '14px 16px',
                borderLeft: `4px solid ${meta.color}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{workerName}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{fs.workers?.login_id || ''}</div>
                  </div>
                  {statusDot(fs.status)}
                </div>

                {fs.status === 'on_call' && (
                  <div style={{ padding: '8px 10px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fecaca', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#dc2626' }}>call</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#991b1b', flex: 1 }}>{fs.current_donor_name}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                        {fs.call_started_at ? fmt(Math.floor((Date.now() - new Date(fs.call_started_at).getTime()) / 1000)) : '00:00'}
                      </span>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 10, color: 'var(--ink-soft)' }}>
                  <span>📞 <strong style={{ color: 'var(--ink)' }}>{fs.today_calls || 0}</strong></span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>Talk: <strong style={{ color: 'var(--ink)' }}>{fmt(fs.today_talk_seconds || 0)}</strong></span>
                  {fs.today_skipped > 0 && (
                    <>
                      <span>⏳ <strong style={{ color: '#d97706' }}>{fs.today_skipped}</strong></span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>Idle: <strong style={{ color: '#d97706' }}>{fmt(fs.today_idle_seconds || 0)}</strong></span>
                    </>
                  )}
                  {productivity !== null && (
                    <span style={{ color: productivity < 50 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                      {productivity}% prod.
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 6 }}>
                  Last seen: {fs.updated_at ? new Date(fs.updated_at).toLocaleTimeString('en-IN') : '—'}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
