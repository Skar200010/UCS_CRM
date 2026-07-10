import { useState, useEffect, useCallback } from 'react'
import { getCallAnalytics } from '../api/auth'
import { SkeletonTable } from '../../../components/Skeleton'

const CONNECTED_DISPOSITIONS = ['contacted', 'lead_done', 'donation_collected', 'follow_up', 'scheduled', 'callback', 'visit_donate', 'promise_to_pay', 'payment_pending', 'already_donated', 'language_barrier', 'transferred_senior', 'query_complaint', 'receipt_request']

function fmt(seconds) {
  if (!seconds) return '0m 0s'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s}s`
}

function KpiCard({ label, value, sub, color }) {
  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)', padding: '16px 18px', boxShadow: 'var(--shadow)', textAlign: 'center' }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || 'var(--ink)', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: 'var(--ink-soft)', marginTop: 1, opacity: .6 }}>{sub}</div>}
    </div>
  )
}

function Bar({ pct, color }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: 'var(--bg)', overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', borderRadius: 3, width: Math.min(pct, 100) + '%', background: color || 'var(--sage)', transition: 'width .4s ease' }} />
    </div>
  )
}

export default function CallAnalytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [ngoId, setNgoId] = useState('')
  const [station, setStation] = useState('')
  const [froId, setFroId] = useState('')
  const [period, setPeriod] = useState('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [ngos, setNgos] = useState([])
  const [stations, setStations] = useState([])

  useEffect(() => {
    import('../api/auth').then(({ apiGet }) => {
      apiGet('/ngo-admin/ngos').then(setNgos).catch(() => {})
      apiGet('/ngo-admin/stations').then(setStations).catch(() => {})
    })
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    const params = {}
    if (ngoId) params.ngo_id = ngoId
    if (station) params.station = station
    if (froId) params.fro_id = froId
    const now = new Date()
    if (period === 'today') {
      params.from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      params.to = now.toISOString()
    } else if (period === 'week') {
      const d = new Date(now); d.setDate(d.getDate() - 7)
      params.from = d.toISOString()
      params.to = now.toISOString()
    } else if (period === 'month') {
      params.from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      params.to = now.toISOString()
    } else if (period === 'custom') {
      if (customFrom) params.from = new Date(customFrom).toISOString()
      if (customTo) params.to = new Date(customTo + 'T23:59:59').toISOString()
    }
    try {
      const result = await getCallAnalytics(params)
      setData(result)
    } catch { setData(null) }
    finally { setLoading(false) }
  }, [ngoId, station, froId, period, customFrom, customTo])

  useEffect(() => { loadData() }, [loadData])

  const summary = data?.summary

  return (
    <div className="bento-grid" style={{ flex: 1 }}>
      <div className="bento-col-12">
        <div className="bento-card">
          <div className="bento-card-h">
            <h3>Call Analytics</h3>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={ngoId} onChange={e => setNgoId(e.target.value)}
                style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '3px 6px', fontSize: 10, fontFamily: 'inherit', outline: 'none' }}>
                <option value="">All NGOs</option>
                {ngos.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
              </select>
              <select value={station} onChange={e => setStation(e.target.value)}
                style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '3px 6px', fontSize: 10, fontFamily: 'inherit', outline: 'none' }}>
                <option value="">All Stations</option>
                {stations.map(s => <option key={s.station || s.id} value={s.station}>{s.station || s.name}</option>)}
              </select>
              <select value={period} onChange={e => setPeriod(e.target.value)}
                style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '3px 6px', fontSize: 10, fontFamily: 'inherit', outline: 'none' }}>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="custom">Custom</option>
              </select>
              {period === 'custom' && (
                <>
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                    style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '3px 6px', fontSize: 10, fontFamily: 'inherit', outline: 'none' }} />
                  <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                    style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '3px 6px', fontSize: 10, fontFamily: 'inherit', outline: 'none' }} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bento-col-12"><SkeletonTable /></div>
      ) : !summary ? (
        <div className="bento-col-12">
          <div className="bento-card" style={{ alignItems: 'center', padding: 60 }}>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>No call data found for the selected filters.</div>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="bento-col-12">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <KpiCard label="Total Calls" value={summary.total_calls?.toLocaleString() || 0} color="#3b82f6" />
              <KpiCard label="Connection Rate" value={summary.connection_rate || '0%'} sub={`${summary.connected} connected · ${summary.not_connected} not connected`} color="#16a34a" />
              <KpiCard label="Avg Call Duration" value={summary.avg_call_duration || '0m 0s'} sub={`Total: ${summary.total_talk_time || '0h 0m'}`} color="#8b5cf6" />
              <KpiCard label="Connected Calls" value={summary.connected || 0} sub={summary.total_calls > 0 ? `${Math.round((summary.connected / summary.total_calls) * 100)}% of total` : ''} color="#16a34a" />
              <KpiCard label="Not Connected" value={summary.not_connected || 0} sub={summary.total_calls > 0 ? `${Math.round((summary.not_connected / summary.total_calls) * 100)}% of total` : ''} color="#dc2626" />
            </div>
          </div>

          {/* Daily Trend */}
          {data.daily_trend?.length > 0 && (
            <div className="bento-col-12">
              <div className="bento-card">
                <div className="bento-card-h"><h3>Daily Trend</h3></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4 }}>
                  {data.daily_trend.slice(-14).map(d => {
                    const total = d.total || 1
                    const connectedPct = (d.connected / total) * 100
                    const notConnectedPct = (d.not_connected / total) * 100
                    return (
                      <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 9, color: 'var(--ink-soft)', minWidth: 60, whiteSpace: 'nowrap' }}>
                          {new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </div>
                        <div style={{ flex: 1, display: 'flex', gap: 2, height: 14 }}>
                          <div style={{ width: `${connectedPct}%`, background: '#16a34a', borderRadius: 2, minWidth: connectedPct > 0 ? 2 : 0, transition: 'width .3s' }} title={`Connected: ${d.connected}`} />
                          <div style={{ width: `${notConnectedPct}%`, background: '#dc2626', borderRadius: 2, minWidth: notConnectedPct > 0 ? 2 : 0, transition: 'width .3s' }} title={`Not connected: ${d.not_connected}`} />
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--ink-soft)', minWidth: 40, textAlign: 'right' }}>{d.total}</div>
                      </div>
                    )
                  })}
                  <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 9, color: 'var(--ink-soft)' }}>
                    <span><span style={{ color: '#16a34a', fontWeight: 700 }}>●</span> Connected</span>
                    <span><span style={{ color: '#dc2626', fontWeight: 700 }}>●</span> Not Connected</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FRO-wise Breakdown */}
          {data.by_fro?.length > 0 && (
            <div className="bento-col-6">
              <div className="bento-card">
                <div className="bento-card-h"><h3>FRO-wise Breakdown</h3></div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                      <th style={{ textAlign: 'left', padding: '5px 6px', fontWeight: 600, color: 'var(--ink-soft)' }}>FRO</th>
                      <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 600, color: 'var(--ink-soft)' }}>Calls</th>
                      <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 600, color: 'var(--ink-soft)' }}>Connected</th>
                      <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 600, color: 'var(--ink-soft)' }}>Rate</th>
                      <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 600, color: 'var(--ink-soft)' }}>Talk Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_fro.map(f => (
                      <tr key={f.fro_worker_id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '5px 6px', fontWeight: 600 }}>{f.fro_name}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right' }}>{f.total}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', color: '#16a34a' }}>{f.connected}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right' }}>
                          <span style={{ color: (f.connected / Math.max(f.total, 1)) >= 0.5 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                            {Math.round((f.connected / Math.max(f.total, 1)) * 100)}%
                          </span>
                        </td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', fontSize: 9 }}>{fmt(f.talk_seconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Station-wise Breakdown */}
          {data.by_station?.length > 0 && (
            <div className="bento-col-6">
              <div className="bento-card">
                <div className="bento-card-h"><h3>Station-wise Breakdown</h3></div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                      <th style={{ textAlign: 'left', padding: '5px 6px', fontWeight: 600, color: 'var(--ink-soft)' }}>Station</th>
                      <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 600, color: 'var(--ink-soft)' }}>Calls</th>
                      <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 600, color: 'var(--ink-soft)' }}>Connected</th>
                      <th style={{ textAlign: 'right', padding: '5px 6px', fontWeight: 600, color: 'var(--ink-soft)' }}>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_station.map(s => (
                      <tr key={s.station} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '5px 6px', fontWeight: 600 }}>{s.station}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right' }}>{s.total}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', color: '#16a34a' }}>{s.connected}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right' }}>
                          <span style={{ color: (s.connected / Math.max(s.total, 1)) >= 0.5 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                            {Math.round((s.connected / Math.max(s.total, 1)) * 100)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Disposition Breakdown */}
          {data.by_disposition?.length > 0 && (
            <div className="bento-col-12">
              <div className="bento-card">
                <div className="bento-card-h"><h3>Disposition Breakdown</h3></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, paddingTop: 4 }}>
                  {data.by_disposition.map(d => {
                    const isConnected = CONNECTED_DISPOSITIONS.includes(d.disposition)
                    const pct = (d.count / Math.max(summary.total_calls, 1)) * 100
                    return (
                      <div key={d.disposition} style={{ background: 'var(--bg)', borderRadius: 6, padding: '8px 10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: isConnected ? '#16a34a' : '#dc2626' }}>
                            {d.disposition.replace(/_/g, ' ')}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>{d.count}</span>
                        </div>
                        <Bar pct={pct} color={isConnected ? '#16a34a' : '#dc2626'} />
                        <div style={{ fontSize: 8, color: 'var(--ink-soft)', marginTop: 2 }}>{pct.toFixed(1)}% of total</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}