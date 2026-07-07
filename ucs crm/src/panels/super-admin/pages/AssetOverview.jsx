import { useState, useEffect, useMemo } from 'react'
import { api } from '../../../api/auth'

const money = v => `₹${Number(v || 0).toLocaleString('en-IN')}`
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const daysSince = d => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 0
const daysUntil = d => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null

const STATUS_META = {
  available:   { label: 'Available',   bg: '#dbeafe', text: '#1d4ed8' },
  assigned:    { label: 'Assigned',    bg: '#dcfce7', text: '#15803d' },
  repair:      { label: 'In Repair',   bg: '#fef3c7', text: '#b45309' },
  not_working: { label: 'Not Working', bg: '#fee2e2', text: '#b91c1c' },
  lost:        { label: 'Lost',        bg: '#f3e8ff', text: '#7c3aed' },
  scrapped:    { label: 'Scrapped',    bg: '#f1f5f9', text: '#475569' },
}

const CAT_ICONS = {
  'Electronics': '🖥️', 'Mobile & SIM': '📱', 'Furniture': '🪑',
  'Vehicle': '🚗', 'Field Kit': '🎒', 'Electrical': '🔌',
  'Pantry': '🍳', 'Safety': '🛡️', 'Digital': '💾',
}

export default function AssetOverview() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api('/assets')
      .then(list => setAssets(Array.isArray(list) ? list : list?.data || []))
      .catch(() => setError('Unable to fetch asset data'))
      .finally(() => setLoading(false))
  }, [])

  const summary = useMemo(() => {
    const s = { total: assets.length, assigned: 0, available: 0, repair: 0, not_working: 0, lost: 0, scrapped: 0, value: 0 }
    assets.forEach(a => {
      if (s[a.status] !== undefined) s[a.status]++
      if (a.status !== 'scrapped' && a.status !== 'lost') s.value += Number(a.purchase_price || 0)
    })
    return s
  }, [assets])

  const deptCounts = useMemo(() => {
    const m = {}
    assets.forEach(a => { if (a.department) m[a.department] = (m[a.department] || 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [assets])

  const catCounts = useMemo(() => {
    const m = {}
    assets.forEach(a => { m[a.category] = (m[a.category] || 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [assets])
  const maxCat = Math.max(1, ...catCounts.map(([, v]) => v))

  const warrantySoon = assets.filter(a => { const d = daysUntil(a.warranty_expiry); return d !== null && d > 0 && d <= 30 })
  const longRepair = assets.filter(a => a.status === 'repair' && daysSince(a.repair_date) > 30)

  if (loading) return (
    <div className="sa-page" style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>{[1,2,3,4].map(i => <div key={i} style={{ flex: 1, height: 100, background: '#f1f5f9', borderRadius: 14, animation: 'skp 1.2s infinite alternate' }} />)}</div>
      <div style={{ height: 300, background: '#f1f5f9', borderRadius: 14, animation: 'skp 1.2s infinite alternate' }} />
    </div>
  )

  const statCards = [
    { label: 'Total Assets', value: summary.total, color: '#6366f1', bg: '#eef2ff' },
    { label: 'Total Value', value: money(summary.value), color: '#7c3aed', bg: '#f5f3ff' },
    { label: 'Assigned', value: summary.assigned, color: '#059669', bg: '#ecfdf5' },
    { label: 'Available', value: summary.available, color: '#0284c7', bg: '#f0f9ff' },
    { label: 'In Repair', value: summary.repair, color: '#d97706', bg: '#fff7ed' },
    { label: 'Not Working', value: summary.not_working, color: '#dc2626', bg: '#fef2f2' },
  ]

  const statusOrder = ['available', 'assigned', 'repair', 'not_working', 'lost', 'scrapped']
  const statusSummary = statusOrder.filter(k => summary[k] > 0).map(k => ({ ...STATUS_META[k], key: k, count: summary[k] }))
  const total = summary.total || 1

  return (
    <div className="sa-page" style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px' }}>
      <style>{`
        .ao-card { background: #fff; border: 1px solid #e9edf2; border-radius: 16px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); transition: box-shadow .2s; }
        .ao-card:hover { box-shadow: 0 4px 16px -8px rgba(0,0,0,0.08); }
        .ao-title { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px; }
        .ao-stat { border-radius: 14px; padding: 18px 20px; }
        .ao-stat:hover { transform: translateY(-2px); box-shadow: 0 8px 24px -8px rgba(0,0,0,0.12); }
        .ao-stat-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; display: block; margin-bottom: 4px; opacity: .8; }
        .ao-stat-value { font-size: 28px; font-weight: 800; line-height: 1.2; letter-spacing: -.5px; }
        .ao-stat-sub { font-size: 12px; margin-top: 4px; opacity: .7; }
        .ao-badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 99px; letter-spacing: .2px; }
        .ao-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .ao-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
        @media (max-width: 900px) { .ao-grid-2, .ao-grid-3 { grid-template-columns: 1fr; } }
        .ao-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin-bottom: 24px; }
        .ao-cat-row { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
        .ao-cat-icon { font-size: 20px; width: 32px; text-align: center; }
        .ao-cat-label { width: 130px; font-size: 12px; font-weight: 600; color: #475569; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ao-cat-track { flex: 1; height: 24px; background: #f1f5f9; border-radius: 99px; overflow: hidden; }
        .ao-cat-fill { height: 100%; border-radius: 99px; transition: width .7s cubic-bezier(.22,1,.36,1); }
        .ao-cat-count { width: 30px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; }
        .ao-alert { display: flex; align-items: center; gap: 10px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 10px 18px; font-size: 13px; color: #7f1d1d; font-weight: 500; margin-bottom: 24px; }
        .ao-dept-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
        .ao-dept-item:last-child { border-bottom: none; }
        .ao-dept-name { font-weight: 600; color: #1e293b; }
        .ao-dept-count { font-weight: 700; color: #6366f1; }
        .ao-insight { background: #f8fafc; border-radius: 10px; padding: 14px; font-size: 13px; color: #475569; line-height: 1.5; }
        .ao-insight strong { color: #0f172a; }
        @keyframes skp { from { opacity: .5; } to { opacity: 1; } }
      `}</style>

      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-.4px' }}>Asset Overview</h2>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>Company-wide asset summary for executive review</p>
      </div>

      {(warrantySoon.length > 0 || longRepair.length > 0) && (
        <div className="ao-alert">
          <span style={{ fontSize: 16 }}>⚠️</span>
          {warrantySoon.length > 0 && <span>{warrantySoon.length} asset{`${warrantySoon.length > 1 ? 's' : ''}`} — warranty expiring within 30 days</span>}
          {longRepair.length > 0 && <span> · {longRepair.length} asset{`${longRepair.length > 1 ? 's' : ''}`} in repair for 30+ days</span>}
        </div>
      )}

      {error && (
        <div className="ao-alert" style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
          <span>⚠️ {error}</span>
        </div>
      )}

      <div className="ao-stats">
        {statCards.map(s => (
          <div key={s.label} className="ao-stat" style={{ background: s.bg, color: s.color }}>
            <span className="ao-stat-label" style={{ color: s.color }}>{s.label}</span>
            <div className="ao-stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="ao-grid-3" style={{ marginBottom: 24 }}>
        <div className="ao-card">
          <h3 className="ao-title">Category Distribution</h3>
          {catCounts.length === 0 ? <p style={{ color: '#94a3b8', fontSize: 13 }}>No assets registered</p> : catCounts.slice(0, 9).map(([name, count], i) => {
            const colors = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#06b6d4']
            return (
              <div key={name} className="ao-cat-row">
                <span className="ao-cat-icon">{CAT_ICONS[name] || '📦'}</span>
                <span className="ao-cat-label" title={name}>{name}</span>
                <div className="ao-cat-track">
                  <div className="ao-cat-fill" style={{ width: `${Math.round((count / maxCat) * 100)}%`, background: colors[i % colors.length] }} />
                </div>
                <span className="ao-cat-count">{count}</span>
              </div>
            )
          })}
        </div>

        <div className="ao-card">
          <h3 className="ao-title">Status Breakdown</h3>
          {statusSummary.length === 0 ? <p style={{ color: '#94a3b8', fontSize: 13 }}>No data</p> : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {statusSummary.map(s => {
                  const pct = Math.round((s.count / total) * 100)
                  return (
                    <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className="ao-badge" style={{ background: s.bg, color: s.text, width: 90, textAlign: 'center' }}>{s.label}</span>
                      <div style={{ flex: 1, height: 10, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: s.text, transition: 'width .7s ease' }} />
                      </div>
                      <span style={{ width: 40, textAlign: 'right', fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{s.count}</span>
                      <span style={{ width: 40, textAlign: 'right', color: '#94a3b8', fontSize: 12 }}>{pct}%</span>
                    </div>
                  )
                })}
              </div>
              <div className="ao-insight" style={{ marginTop: 16 }}>
                <strong>Insight:</strong>{' '}
                {summary.available > summary.assigned
                  ? `${summary.available} assets are available — ${summary.available > 5 ? 'consider redistribution or checking usage.' : 'good availability.'}`
                  : `${summary.assigned} assets are currently assigned — ${summary.assigned > summary.total * 0.7 ? 'high utilization rate.' : 'healthy distribution.'}`}
                {summary.repair > 0 && ` ${summary.repair} asset${summary.repair > 1 ? 's' : ''} in repair.`}
              </div>
            </>
          )}
        </div>

        <div className="ao-card">
          <h3 className="ao-title">Department Allocation</h3>
          {deptCounts.length === 0 ? <p style={{ color: '#94a3b8', fontSize: 13 }}>No department data</p> : (
            <>
              {deptCounts.slice(0, 8).map(([name, count]) => (
                <div key={name} className="ao-dept-item">
                  <span className="ao-dept-name">{name}</span>
                  <span className="ao-dept-count">{count} asset{count > 1 ? 's' : ''}</span>
                </div>
              ))}
              <div className="ao-insight" style={{ marginTop: 12 }}>
                <strong>Quick Summary:</strong>{' '}
                {assets.length} total assets across {deptCounts.length} departments.
                Average {Math.round(assets.length / Math.max(1, deptCounts.length))} assets per department.
                Total investment: <strong>{money(summary.value)}</strong>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="ao-grid-2">
        <div className="ao-card">
          <h3 className="ao-title">Recent Activity</h3>
          {assets.flatMap(a => (a.history || []).map(h => ({ ...h, code: a.code, name: a.name })))
            .sort((x, y) => new Date(y.date) - new Date(x.date))
            .slice(0, 8).length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13 }}>No activity recorded yet</p>
          ) : (
            assets.flatMap(a => (a.history || []).map(h => ({ ...h, code: a.code, name: a.name })))
              .sort((x, y) => new Date(y.date) - new Date(x.date))
              .slice(0, 8)
              .map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#cbd5e1', marginTop: 6, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>{h.code} ({h.name}) — {h.text}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{fmtDate(h.date)}</div>
                  </div>
                </div>
              ))
          )}
        </div>

        <div className="ao-card">
          <h3 className="ao-title">Key Insights</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="ao-insight">
              <strong>🏢 Coverage:</strong> {deptCounts.length} departments have assets.
              {deptCounts.some(([name]) => name === 'Common') ? ' Common assets exist.' : ' No common pool defined.'}
            </div>
            <div className="ao-insight">
              <strong>💰 Asset Value:</strong> {money(summary.value)} total investment.
              {summary.total > 0 ? ` Avg ${money(Math.round(summary.value / summary.total))} per asset.` : ''}
            </div>
            <div className="ao-insight">
              <strong>🔧 Health:</strong>{' '}
              {(() => {
                const healthy = summary.available + summary.assigned
                const pct = Math.round((healthy / total) * 100)
                return `${pct}% assets (${healthy} of ${total}) are in healthy state (available/assigned).`
              })()}
            </div>
            <div className="ao-insight">
              <strong>⚠️ Attention:</strong>{' '}
              {(() => {
                const issues = summary.repair + summary.not_working
                if (issues === 0) return 'No assets need attention.'
                return `${issues} asset${issues > 1 ? 's' : ''} need attention (${summary.repair} in repair, ${summary.not_working} not working).`
              })()}
            </div>
            <div className="ao-insight">
              <strong>📦 Top Category:</strong>{' '}
              {catCounts.length > 0 ? `${catCounts[0][0]} (${catCounts[0][1]} assets) — ${Math.round((catCounts[0][1] / total) * 100)}% of all assets.` : 'No categories yet.'}
            </div>
            <div className="ao-insight">
              <strong>👥 Assigned vs Unassigned:</strong>{' '}
              {summary.assigned > 0
                ? `${Math.round((summary.assigned / total) * 100)}% assets are assigned to personnel.`
                : 'No assets currently assigned.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
