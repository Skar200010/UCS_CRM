import { fmt, STATUS_META } from './froShared'

const MINT = '#8CCDA4'
const MINT_DEEP = '#2A6B45'
const MINT_DARK = '#1E4D3B'
const MINT_LIGHT = '#EAF7EE'
const GOLD = '#E0A73C'
const GOLD_LIGHT = '#F6C979'
const PRIMARY = '#1F332B'

const RANK_BAR = [GOLD_LIGHT, '#B8CDD6', '#E5C29A', MINT]
const RANK_BADGE_BG = ['#F6C979', '#D9E2EA', '#EDC9A2', '#F1F5F2']
const RANK_BADGE_TEXT = ['#92600A', '#475569', '#92400E', '#64748b']
const RANK_BORDER = ['#F2DFA8', '#D8E0E8', '#E8D2B5', '#EAF3EC']

function initials(name) {
  return (name || '?')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function FroPerformanceToday({ froLiveData }) {
  const rows = froLiveData
    .map(f => ({
      name: f.worker?.name || f.worker?.login_id || 'Unknown',
      short: (f.worker?.name || f.worker?.login_id || 'Unknown').replace(/_.*$/, ''),
      ngo: f.worker?.ngo_name || '',
      login: f.worker?.login_id || '',
      status: f.status || 'offline',
      collection: Number(f.performance?.today_collection || 0),
      calls: Number(f.performance?.today_calls || 0),
      dataUsed: Number(f.performance?.data_used || 0),
      talkSec: Number(f.performance?.today_talk_seconds || 0),
    }))
    .sort((a, b) => b.collection - a.collection)

  const totalCollection = rows.reduce((s, r) => s + r.collection, 0)
  const totalCalls = rows.reduce((s, r) => s + r.calls, 0)
  const activeOnline = froLiveData.filter(f => f.worker?.is_active && (f.status === 'online' || f.status === 'on_call')).length
  const avgPerCall = totalCalls > 0 ? Math.round(totalCollection / totalCalls) : 0
  const maxCollection = Math.max(1, rows[0]?.collection || 0)

  const topCollector = rows[0]
  const mostCalls = rows.reduce((best, r) => (r.calls > best.calls ? r : best), rows[0])

  const kpis = [
    { label: 'Collection', value: `₹${totalCollection.toLocaleString('en-IN')}`, sub: 'collected today', accent: MINT_DEEP, icon: 'payments' },
    { label: 'Online FROs', value: `${activeOnline}/${froLiveData.length}`, sub: 'live online or on call', accent: '#16A34A', icon: 'monitor_heart', ratio: activeOnline / froLiveData.length },
    { label: 'Total Calls', value: String(totalCalls), sub: 'calls logged today', accent: '#1E88E5', icon: 'call' },
    { label: 'Avg / Call', value: `₹${avgPerCall.toLocaleString('en-IN')}`, sub: 'collection ÷ calls', accent: GOLD, icon: 'trending_up' },
  ]

  return (
    <div className="nd-card nd-appear" style={{ animationDelay: '0.65s', marginBottom: 20 }}>

      {/* ---- HEADER ---- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: MINT_DEEP }}>monitoring</span>
        <h3 className="nd-section-title" style={{ margin: 0, color: MINT_DARK }}>FRO Performance — Today</h3>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 99, background: MINT_LIGHT, color: MINT_DEEP, fontSize: 11, fontWeight: 700 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
            {activeOnline} / {froLiveData.length} online
          </span>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{totalCalls} total calls</span>
        </span>
      </div>

      {/* ---- KPI CARDS ---- */}
      <div className="mini-card-grid" style={{ marginBottom: 16 }}>
        {kpis.map(k => (
          <div key={k.label} className="mini-card">
            <div className="mini-card-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 13, color: k.accent }}>{k.icon}</span>
              {k.label}
            </div>
            <div className="mini-card-value" style={{ color: k.accent }}>{k.value}</div>
            <div className="mini-card-sub">{k.sub}</div>
            {k.ratio != null && (
              <div style={{ marginTop: 8, height: 5, borderRadius: 99, background: '#E4EFE8', overflow: 'hidden' }}>
                <div style={{ width: `${Math.round(k.ratio * 100)}%`, height: '100%', borderRadius: 99, background: '#22C55E' }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ---- LEADERBOARD ---- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 15, color: GOLD }}>leaderboard</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: PRIMARY }}>Today's Leaderboard</span>
        <span style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600 }}>ranked by collection</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: GOLD_LIGHT, display: 'inline-block' }} />1st</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#B8CDD6', display: 'inline-block' }} />2nd</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#E5C29A', display: 'inline-block' }} />3rd</span>
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {rows.map((r, i) => {
          const m = STATUS_META[r.status] || STATUS_META.offline
          const perCall = r.calls > 0 ? Math.round(r.collection / r.calls) : 0
          const pct = Math.max(4, Math.round((r.collection / maxCollection) * 100))
          return (
            <div
              key={`${r.login}-${i}`}
              title={`${r.name} · ${r.calls} calls · talk ${fmt(r.talkSec)} · data ${r.dataUsed} MB`}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '4px 8px', borderRadius: 9,
                background: '#FBFDFB', border: `1px solid ${RANK_BORDER[Math.min(i, 3)]}`,
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F1F9F3' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FBFDFB' }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: 8, flexShrink: 0,
                background: RANK_BADGE_BG[Math.min(i, 3)], color: RANK_BADGE_TEXT[Math.min(i, 3)],
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800,
              }}>{i + 1}</div>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                background: m.bg, color: m.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10.5, fontWeight: 700,
              }}>{initials(r.name)}</div>
              <div style={{ width: 148, minWidth: 0, flexShrink: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: PRIMARY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, fontSize: 10, color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.color, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ color: m.color }}>{m.label}</span>
                  {r.ngo && <span>· {r.ngo}</span>}
                </div>
              </div>
              <div style={{ flex: 1, height: 10, borderRadius: 99, background: '#EEF3EF', overflow: 'hidden', minWidth: 40 }}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: RANK_BAR[Math.min(i, 3)] }} />
              </div>
              <div style={{ width: 96, textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: i === 0 ? MINT_DEEP : PRIMARY }}>₹{r.collection.toLocaleString('en-IN')}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{r.calls} calls · ₹{perCall}/call</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ---- HIGHLIGHTS ---- */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
        <div className="mini-card">
          <div className="mini-card-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13, color: GOLD }}>workspace_premium</span>
            Top Collector
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: PRIMARY, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{topCollector?.name || '—'}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: MINT_DEEP }}>₹{(topCollector?.collection || 0).toLocaleString('en-IN')}</div>
        </div>
        <div className="mini-card">
          <div className="mini-card-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#1E88E5' }}>call</span>
            Most Calls
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: PRIMARY, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mostCalls?.name || '—'}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: PRIMARY }}>{mostCalls?.calls || 0} calls</div>
        </div>
      </div>
    </div>
  )
}