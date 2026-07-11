import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
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

export default function FroLiveStatus() {
  const { user } = useUcs()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const froId = searchParams.get('fro_id')

  const [statuses, setStatuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedNgoId, setSelectedNgoId] = useState('all')
  const [accessibleNgos, setAccessibleNgos] = useState([])

  const [extraData, setExtraData] = useState(null)
  const [loadingExtra, setLoadingExtra] = useState(false)

  useEffect(() => {
    api('/ngo-admin/ngos', { _prefix: 'ucs' }).then(setAccessibleNgos).catch(() => {});
  }, []);

  const loadStatuses = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedNgoId !== 'all' && !froId) params.set('ngo_id', selectedNgoId)
      if (froId) params.set('fro_id', froId)
      const qs = params.toString()
      const data = await api(`/fro/status${qs ? `?${qs}` : ''}`, { _prefix: 'ucs' })
      setStatuses(data || [])
    } catch { setStatuses([]) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    loadStatuses()
    const interval = setInterval(loadStatuses, 30000)
    return () => clearInterval(interval)
  }, [selectedNgoId, froId])

  useEffect(() => {
    const channel = supabase
      .channel('fro_live_status_ngo_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'fro_live_status' },
        () => loadStatuses()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (!froId) return
    setLoadingExtra(true)
    api(`/ngo-admin/fro/${froId}/summary`, { _prefix: 'ucs' })
      .then(data => setExtraData(data))
      .catch(() => setExtraData(null))
      .finally(() => setLoadingExtra(false))
  }, [froId])

  const onlineCount = statuses.filter(s => s.status === 'on_call' || s.status === 'online').length

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: 'var(--ink-soft)' }}>Loading FRO statuses...</div>
  }

  if (froId && statuses[0]) {
    const fs = statuses[0]
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button className="btn btn-sm btn-outline" onClick={() => navigate('/ngo-admin/fro-status')} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            ← Back to All FROs
          </button>
        </div>
        <FroDetailView fs={fs} extraData={extraData} loadingExtra={loadingExtra} />
      </div>
    )
  }

  return (
    <div>
      <div className="filter-bar">
        <span style={{fontSize:13, fontWeight:600, color:'var(--ink-soft)'}}>NGO:</span>
        <select value={selectedNgoId} onChange={e => setSelectedNgoId(e.target.value)}>
          <option value="all">All NGOs</option>
          {accessibleNgos.map(ngo => (
            <option key={ngo.id} value={ngo.id}>{ngo.name}</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>radio</span>
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>FRO Live Status</h3>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{onlineCount} online · {statuses.length} total FROs</div>
        </div>
      </div>

      {statuses.length === 0 ? (
        <div className="card" style={{ alignItems: 'center', padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8, opacity: .3 }}>📡</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No FROs active</div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>FROs from your NGO will appear here when they log in.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {statuses.map(fs => {
            const workerName = fs.workers?.name || 'Unknown'
            const initials = workerName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
            const meta = STATUS_META[fs.status] || STATUS_META.offline
            const totalActive = (fs.today_talk_seconds || 0) + (fs.today_idle_seconds || 0)
            const productivity = totalActive > 0 ? Math.round(((fs.today_talk_seconds || 0) / totalActive) * 100) : null
            return (
              <div key={fs.id} className="card" style={{
                marginBottom: 0, padding: '14px 16px',
                borderLeft: `4px solid ${meta.color}`,
                cursor: 'pointer',
              }}
                onClick={() => navigate(`/ngo-admin/fro-status?fro_id=${fs.worker_id}`)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{workerName}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{fs.workers?.login_id || ''}</div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, display: 'inline-block',
                      animation: fs.status === 'on_call' || fs.status === 'break' ? 'pulse 1s ease-in-out infinite' : 'none' }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: meta.color }}>{meta.label}</span>
                  </span>
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
    </div>
  )
}

function FroDetailView({ fs, extraData, loadingExtra }) {
  const workerName = fs.workers?.name || 'Unknown'
  const initials = workerName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const meta = STATUS_META[fs.status] || STATUS_META.offline
  const totalActive = (fs.today_talk_seconds || 0) + (fs.today_idle_seconds || 0)
  const productivity = totalActive > 0 ? Math.round(((fs.today_talk_seconds || 0) / totalActive) * 100) : null
  const ed = extraData || {}

  return (
    <div>
      {/* FRO Header Card */}
      <div className="card" style={{ marginBottom: 16, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }}>
            {initials}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{workerName}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{fs.workers?.login_id || ''} · ID: {fs.worker_id}</div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: meta.bg, border: `1px solid ${meta.border}` }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: meta.color, display: 'inline-block',
              animation: fs.status === 'on_call' || fs.status === 'break' ? 'pulse 1s ease-in-out infinite' : 'none' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: meta.color }}>{meta.label}</span>
          </span>
        </div>

        {fs.status === 'on_call' && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#dc2626' }}>call</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#991b1b', flex: 1 }}>Calling: <strong>{fs.current_donor_name}</strong></span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                {fs.call_started_at ? fmt(Math.floor((Date.now() - new Date(fs.call_started_at).getTime()) / 1000)) : '00:00'}
              </span>
            </div>
          </div>
        )}

        {fs.status === 'break' && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: fs.today_break_seconds > 3600 ? '#fef2f2' : '#fefce8', border: `1px solid ${fs.today_break_seconds > 3600 ? '#fecaca' : '#fde68a'}`, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: fs.today_break_seconds > 3600 ? '#dc2626' : '#d97706' }}>free_breakfast</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: fs.today_break_seconds > 3600 ? '#991b1b' : '#92400e', flex: 1 }}>
                On Break{fs.today_break_seconds > 3600 ? ' — Exceeded 1 hour!' : ''}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: fs.today_break_seconds > 3600 ? '#dc2626' : '#d97706', fontVariantNumeric: 'tabular-nums' }}>
                {fs.break_started_at ? fmt(Math.floor((Date.now() - new Date(fs.break_started_at).getTime()) / 1000)) : '00:00'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ marginBottom: 0, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Today's Calls</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{fs.today_calls || 0}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>Talk: {fmt(fs.today_talk_seconds || 0)}</div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Today's Collection</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--sage)' }}>
            {loadingExtra ? '...' : `₹${(ed.todayCollection || 0).toLocaleString('en-IN')}`}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>{ed.todayCalls || 0} donations</div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Assigned Leads</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{loadingExtra ? '...' : (ed.totalAssigned || 0)}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>Active assignments</div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Productivity</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: productivity != null && productivity < 50 ? '#dc2626' : '#16a34a' }}>
            {productivity != null ? `${productivity}%` : '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>Talk / Active time</div>
        </div>
      </div>

      {/* Time Breakdown */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h3>Time Breakdown</h3></div>
        <div className="card-pad">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 }}>Talk Time</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>{fmt(fs.today_talk_seconds || 0)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 }}>Idle Time</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b' }}>{fmt(fs.today_idle_seconds || 0)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 }}>Break Time</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: fs.today_break_seconds > 3600 ? '#dc2626' : '#d97706' }}>{fmt(fs.today_break_seconds || 0)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 }}>Skipped</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#6b7280' }}>{fs.today_skipped || 0}</div>
            </div>
          </div>
          {productivity != null && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--ink-soft)', marginBottom: 4 }}>Talk / Active Ratio</div>
              <div style={{ height: 8, borderRadius: 4, background: '#e5e7eb', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, productivity)}%`, height: '100%', borderRadius: 4, background: productivity < 50 ? '#dc2626' : productivity < 75 ? '#f59e0b' : '#16a34a', transition: 'width .5s' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Disposition & Lead Status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-head"><h3>Today's Dispositions</h3></div>
          <div className="card-pad" style={{ padding: 0 }}>
            {loadingExtra ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 12 }}>Loading...</div>
            ) : Object.keys(ed.dispositionBreakdown || {}).length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 12 }}>No dispositions today</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(ed.dispositionBreakdown || {})
                    .sort(([, a], [, b]) => b - a)
                    .map(([status, count]) => (
                      <tr key={status}>
                        <td style={{ fontSize: 12 }}>{status.replace(/_/g, ' ')}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{count}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-head"><h3>Lead Status Breakdown</h3></div>
          <div className="card-pad" style={{ padding: 0 }}>
            {loadingExtra ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 12 }}>Loading...</div>
            ) : Object.keys(ed.statusBreakdown || {}).length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 12 }}>No assigned leads</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(ed.statusBreakdown || {})
                    .sort(([, a], [, b]) => b - a)
                    .map(([status, count]) => (
                      <tr key={status}>
                        <td style={{ fontSize: 12 }}>{status.replace(/_/g, ' ')}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{count}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Last seen */}
      <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center', marginTop: 8 }}>
        Last updated: {fs.updated_at ? new Date(fs.updated_at).toLocaleString('en-IN') : '—'}
      </div>
    </div>
  )
}
