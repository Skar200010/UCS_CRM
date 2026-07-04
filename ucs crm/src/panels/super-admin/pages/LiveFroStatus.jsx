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
  break: { label: 'Break', color: '#d97706', bg: '#fefce8', border: '#fde68a' },
  offline: { label: 'Offline', color: '#9ca3af', bg: '#f9fafb', border: '#e5e7eb' },
}

function FroDeepDetailModal({ fro, onClose }) {
  if (!fro) return null
  const workerName = fro.workers?.name || 'Unknown'
  const meta = STATUS_META[fro.status] || STATUS_META.offline
  const totalActive = (fro.today_talk_seconds || 0) + (fro.today_idle_seconds || 0)
  const productivity = totalActive > 0 ? Math.round(((fro.today_talk_seconds || 0) / totalActive) * 100) : null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.3)',
    }} onClick={onClose}>
      <div className="card" style={{
        width: 420, padding: '24px 28px',
        background: '#fff', borderRadius: 12,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
              {workerName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{workerName}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{fro.workers?.login_id || ''}</div>
            </div>
          </div>
          <span className="material-symbols-outlined" style={{ fontSize: 20, cursor: 'pointer', color: '#94a3b8' }} onClick={onClose}>close</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div style={{ padding: '10px 12px', borderRadius: 6, background: meta.bg, border: `1px solid ${meta.border}`, textAlign: 'center', gridColumn: '1 / -1' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: meta.color }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: meta.color, display: 'inline-block' }} />
              {meta.label}
            </span>
          </div>

          {fro.status === 'on_call' && (
            <div style={{ padding: '10px 12px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fecaca', gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 10, color: '#991b1b', fontWeight: 600, marginBottom: 4 }}>📞 Current Call</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#991b1b', flex: 1 }}>{fro.current_donor_name}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                  {fro.call_started_at ? fmt(Math.floor((Date.now() - new Date(fro.call_started_at).getTime()) / 1000)) : '00:00'}
                </span>
              </div>
            </div>
          )}

          {fro.status === 'break' && (
            <div style={{ padding: '10px 12px', borderRadius: 6, background: fro.today_break_seconds > 3600 ? '#fef2f2' : '#fefce8', border: `1px solid ${fro.today_break_seconds > 3600 ? '#fecaca' : '#fde68a'}`, gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 10, color: '#92400e', fontWeight: 600, marginBottom: 4 }}>☕ On Break</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: fro.today_break_seconds > 3600 ? '#dc2626' : '#d97706', fontVariantNumeric: 'tabular-nums' }}>
                  {fro.break_started_at ? fmt(Math.floor((Date.now() - new Date(fro.break_started_at).getTime()) / 1000)) : '00:00'}
                </span>
                <span style={{ fontSize: 11, color: '#92400e' }}>today: {fmt(fro.today_break_seconds || 0)}</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: '#091426', marginBottom: 8 }}>📊 Today's Performance</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <StatBox label="Calls" value={fro.today_calls || 0} icon="📞" />
          <StatBox label="Talk Time" value={fmt(fro.today_talk_seconds || 0)} icon="⏱️" />
          <StatBox label="Skipped" value={fro.today_skipped || 0} icon="⏳" />
          <StatBox label="Idle Time" value={fmt(fro.today_idle_seconds || 0)} icon="🕊️" />
          {fro.today_break_seconds > 0 && <StatBox label="Break" value={fmt(fro.today_break_seconds || 0)} icon="☕" />}
          {productivity !== null && <StatBox label="Productivity" value={`${productivity}%`} icon="📊" />}
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: '#091426', margin: '12px 0 8px' }}>👤 Worker Info</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <StatBox label="Login ID" value={fro.workers?.login_id || '—'} icon="🔑" />
          <StatBox label="FRO ID" value={fro.worker_id || '—'} icon="🆔" />
          <StatBox label="Assigned NGO" value={fro.workers?.ngo_name || '—'} icon="🏢" />
          <StatBox label="Last Active" value={fro.updated_at ? new Date(fro.updated_at).toLocaleTimeString('en-IN') : '—'} icon="⏰" />
        </div>

        <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 14, textAlign: 'center' }}>
          Auto-refreshes every 30s
        </div>
      </div>
    </div>
  )
}

function FroDetailModal({ fro, onClose, onShowDeep }) {
  if (!fro) return null
  const meta = STATUS_META[fro.status] || STATUS_META.offline
  const workerName = fro.workers?.name || 'Unknown'
  const totalActive = (fro.today_talk_seconds || 0) + (fro.today_idle_seconds || 0)
  const productivity = totalActive > 0 ? Math.round(((fro.today_talk_seconds || 0) / totalActive) * 100) : null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)',
    }} onClick={onClose}>
      <div className="card" style={{
        width: 340, padding: '20px 24px',
        background: '#fff', borderRadius: 12,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={onShowDeep}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
              {workerName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#8b5cf6' }}>{workerName} <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}>→</span></div>
              <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{fro.workers?.login_id || ''}</div>
            </div>
          </div>
          <span className="material-symbols-outlined" style={{ fontSize: 20, cursor: 'pointer', color: '#94a3b8' }} onClick={onClose}>close</span>
        </div>

        <div style={{ padding: '10px 12px', borderRadius: 6, background: meta.bg, border: `1px solid ${meta.border}`, marginBottom: 12, textAlign: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: meta.color }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, display: 'inline-block' }} />
            {meta.label}
          </span>
        </div>

        {fro.status === 'on_call' && (
          <div style={{ padding: '8px 10px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fecaca', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#dc2626' }}>call</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#991b1b', flex: 1 }}>{fro.current_donor_name}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                {fro.call_started_at ? fmt(Math.floor((Date.now() - new Date(fro.call_started_at).getTime()) / 1000)) : '00:00'}
              </span>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <StatBox label="Today Calls" value={fro.today_calls || 0} icon="📞" />
          <StatBox label="Talk Time" value={fmt(fro.today_talk_seconds || 0)} icon="⏱️" />
          {fro.today_skipped > 0 && <StatBox label="Skipped" value={fro.today_skipped} icon="⏳" />}
          <StatBox label="Idle Time" value={fmt(fro.today_idle_seconds || 0)} icon="🕊️" />
          {fro.today_break_seconds > 0 && <StatBox label="Break" value={fmt(fro.today_break_seconds || 0)} icon="☕" />}
          {productivity !== null && <StatBox label="Productivity" value={`${productivity}%`} icon="📊" />}
        </div>

        <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 12, textAlign: 'center' }}>
          Last seen: {fro.updated_at ? new Date(fro.updated_at).toLocaleTimeString('en-IN') : '—'}
        </div>
      </div>
    </div>
  )
}

function StatBox({ label, value, icon }) {
  return (
    <div style={{ padding: '8px 10px', borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, marginBottom: 2 }}>{icon} {label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#091426' }}>{value}</div>
    </div>
  )
}

export default function LiveFroStatus() {
  const { user } = useUcs()
  const [statuses, setStatuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedFro, setSelectedFro] = useState(null)
  const [deepFro, setDeepFro] = useState(null)

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
          animation: status === 'on_call' || status === 'break' ? 'pulse 1s ease-in-out infinite' : 'none' }} />
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
                    <div style={{ fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#8b5cf6' }} onClick={() => setSelectedFro(fs)}>{workerName}</div>
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

                {fs.status === 'break' && (
                  <div style={{ padding: '8px 10px', borderRadius: 6, background: fs.today_break_seconds > 3600 ? '#fef2f2' : '#fefce8', border: `1px solid ${fs.today_break_seconds > 3600 ? '#fecaca' : '#fde68a'}`, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14, color: fs.today_break_seconds > 3600 ? '#dc2626' : '#d97706' }}>free_breakfast</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: fs.today_break_seconds > 3600 ? '#991b1b' : '#92400e', flex: 1 }}>
                        On Break{fs.today_break_seconds > 3600 ? ' 🔴' : ''}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: fs.today_break_seconds > 3600 ? '#dc2626' : '#d97706', fontVariantNumeric: 'tabular-nums' }}>
                        {fs.break_started_at ? fmt(Math.floor((Date.now() - new Date(fs.break_started_at).getTime()) / 1000)) : '00:00'}
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
                  {fs.today_break_seconds > 0 && (
                    <><span style={{ fontSize: 12 }}>☕</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>Break: <strong style={{ color: fs.today_break_seconds > 3600 ? '#dc2626' : '#d97706' }}>{fmt(fs.today_break_seconds || 0)}</strong>{fs.today_break_seconds > 3600 && ' 🔴'}</span></>
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

      {selectedFro && <FroDetailModal fro={selectedFro} onClose={() => setSelectedFro(null)} onShowDeep={() => setDeepFro(selectedFro)} />}
      {deepFro && <FroDeepDetailModal fro={deepFro} onClose={() => setDeepFro(null)} />}
    </div>
  )
}
