import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { getMyDashboard, requestMoreData, getFollowUps, getLeadStats, getMonthlyDonors } from '../api/donors'
import { getMyTarget } from '../api/target'
import { SkeletonDashboard } from '../../../components/Skeleton'
import { cacheGet, cacheSet } from '../../../utils/cache'

const currency = n => n != null ? '₹' + Number(n).toLocaleString('en-IN') : '—'

const STATUS_COLORS = {
  pending: '#fbbf24', contacted: '#60a5fa', follow_up: '#a78bfa',
  donation_collected: '#34d399', lead_done: '#34d399', not_interested: '#f87171',
  not_reachable: '#9ca3af', scheduled: '#a78bfa',
}

const CACHE_KEY = 'fro_dashboard'

export default function Dashboard() {
  const cached = cacheGet(CACHE_KEY)
  const [dashData, setDashData] = useState(cached?.dash || null)
  const [targetData, setTargetData] = useState(cached?.target || null)
  const [loading, setLoading] = useState(!cached)
  const [showRequest, setShowRequest] = useState(false)
  const [reqMsg, setReqMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [reqDone, setReqDone] = useState(false)
  const [followUps, setFollowUps] = useState([])
  const [leadStats, setLeadStats] = useState(null)
  const [monthlyDonors, setMonthlyDonors] = useState([])
  const [showMonthlyModal, setShowMonthlyModal] = useState(false)

  const today = new Date()
  const day = today.getDate()
  const monthStr = today.toISOString().slice(0, 7)
  const isMonthlyPopupSeason = day >= 1 && day <= 3

  useEffect(() => {
    Promise.all([
      getMyDashboard().catch(() => null),
      getMyTarget().catch(() => null),
      getFollowUps().catch(() => []),
      getLeadStats(monthStr).catch(() => null),
      isMonthlyPopupSeason ? getMonthlyDonors(monthStr).catch(() => []) : Promise.resolve([]),
    ]).then(([d, t, f, ls, md]) => {
      setDashData(d)
      setTargetData(t)
      setFollowUps(f || [])
      setLeadStats(ls)
      setMonthlyDonors(md || [])
      if (d || t) cacheSet(CACHE_KEY, { dash: d, target: t }, 30000)
      if (isMonthlyPopupSeason && md?.length > 0) setShowMonthlyModal(true)
    }).finally(() => setLoading(false))
  }, [])

  const handleSendRequest = async () => {
    if (!reqMsg.trim()) return
    setSending(true)
    try {
      await requestMoreData(reqMsg)
      setReqDone(true)
      setReqMsg('')
      setTimeout(() => { setShowRequest(false); setReqDone(false) }, 2000)
    } catch (err) {
      alert(err.message)
    } finally {
      setSending(false)
    }
  }

  if (loading) return <SkeletonDashboard />

  const ds = dashData || {}
  const ts = targetData || {}
  const { stats = {} } = ds
  const target = ts.target || ds.target || 0
  const collected = ts.collected || ds.collected || 0
  const remaining = ts.remaining || Math.max(0, target - collected)
  const progress = target > 0 ? Math.min(100, (collected / target) * 100) : 0

  const pieData = ts.stats
    ? Object.entries(ts.stats).filter(([k]) => k !== 'total').map(([k, v]) => ({
        name: k.replace(/_/g, ' '),
        value: v,
        color: STATUS_COLORS[k] || '#94a3b8',
      }))
    : []

  const barData = target > 0 ? [
    { name: 'Target', amount: target, fill: '#94a3b8' },
    { name: 'Collected', amount: collected, fill: '#34d399' },
    { name: 'Remaining', amount: remaining, fill: '#f87171' },
  ] : []

  return (
    <div className="bento-grid">
      {/* Hero row: target, collected, remaining */}
      <div className="bento-col-4">
        <div style={{ border:'1px solid var(--line)', borderRadius:16, padding:'18px 20px', background:'#fff', boxShadow:'0 1px 4px rgba(0,0,0,.04)', display:'flex', flexDirection:'column' }}>
          <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:.5, color:'var(--md-outline)', marginBottom:2 }}>Monthly Target</div>
          <div style={{ fontSize:32, fontWeight:800, color:'var(--ink)', lineHeight:1.2, marginBottom:4 }}>{currency(target)}</div>
          <div style={{ fontSize:10, color:'var(--ink-soft)' }}>
            {ts.target_source === 'not_set' ? 'Not set by admin' : `${progress.toFixed(0)}% achieved`}
          </div>
        </div>
      </div>
      <div className="bento-col-4">
        <div style={{ border:'1px solid var(--line)', borderRadius:16, padding:'18px 20px', background:'#fff', boxShadow:'0 1px 4px rgba(0,0,0,.04)', display:'flex', flexDirection:'column' }}>
          <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:.5, color:'var(--md-outline)', marginBottom:2 }}>Collected</div>
          <div style={{ fontSize:32, fontWeight:800, color:'var(--sage)', lineHeight:1.2, marginBottom:4 }}>{currency(collected)}</div>
          <div style={{ height:4, borderRadius:2, background:'var(--md-outline-variant)', overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:2, background:'var(--sage)', width:`${progress}%`, transition:'width .4s' }} />
          </div>
        </div>
      </div>
      <div className="bento-col-4">
        <div style={{ border:'1px solid var(--line)', borderRadius:16, padding:'18px 20px', background:'#fff', boxShadow:'0 1px 4px rgba(0,0,0,.04)', display:'flex', flexDirection:'column' }}>
          <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:.5, color:'var(--md-outline)', marginBottom:2 }}>Remaining</div>
          <div style={{ fontSize:32, fontWeight:800, color: remaining > 0 ? '#e53e3e' : 'var(--sage)', lineHeight:1.2, marginBottom:4 }}>{currency(remaining)}</div>
          <div style={{ fontSize:10, color:'var(--ink-soft)' }}>
            {remaining > 0 ? `${currency(remaining)} more to hit target` : 'Target achieved!'}
          </div>
        </div>
      </div>

      {/* Metric cards row 1: Connected & Donations */}
      <div className="bento-col-3">
        <div className="bento-card">
          <div className="m3-stat">
            <div className="m3-stat-num" style={{color:'var(--sage)'}}>{ds.monthly_connected ?? stats.contacted ?? 0}</div>
            <div className="m3-stat-lbl">Monthly Connected</div>
          </div>
        </div>
      </div>
      <div className="bento-col-3">
        <div className="bento-card">
          <div className="m3-stat">
            <div className="m3-stat-num" style={{color:'#3b82f6'}}>{ds.daily_connected ?? 0}</div>
            <div className="m3-stat-lbl">Daily Connected</div>
          </div>
        </div>
      </div>
      <div className="bento-col-3">
        <div className="bento-card">
          <div className="m3-stat">
            <div className="m3-stat-num" style={{color:'var(--sage)'}}>{currency(collected)}</div>
            <div className="m3-stat-lbl">Monthly Donations</div>
          </div>
        </div>
      </div>
      <div className="bento-col-3">
        <div className="bento-card">
          <div className="m3-stat">
            <div className="m3-stat-num" style={{color:'#3b82f6'}}>{currency(ds.daily_donations ?? 0)}</div>
            <div className="m3-stat-lbl">Daily Donations</div>
          </div>
        </div>
      </div>

      {/* Metric cards row 2: Usage & Totals */}
      <div className="bento-col-3">
        <div className="bento-card">
          <div className="m3-stat">
            <div className="m3-stat-num" style={{color:'#16a34a'}}>{ds.data_used ?? (stats.contacted ?? 0) + (stats.donation_collected ?? 0) + (stats.follow_up ?? 0)}</div>
            <div className="m3-stat-lbl">Data Used</div>
          </div>
        </div>
      </div>
      <div className="bento-col-3">
        <div className="bento-card">
          <div className="m3-stat">
            <div className="m3-stat-num" style={{color:'#f87171'}}>{ds.data_unused ?? (stats.pending ?? 0) + (stats.not_reachable ?? 0) + (stats.not_interested ?? 0)}</div>
            <div className="m3-stat-lbl">Data Unused</div>
          </div>
        </div>
      </div>
      <div className="bento-col-3">
        <div className="bento-card">
          <div className="m3-stat">
            <div className="m3-stat-num" style={{color:'var(--sage)'}}>{currency(ds.total_donations ?? collected)}</div>
            <div className="m3-stat-lbl">Total Donations</div>
          </div>
        </div>
      </div>
      <div className="bento-col-3">
        <div className="bento-card">
          <div className="m3-stat">
            <div className="m3-stat-num">{stats.total ?? ts.stats?.total ?? 0}</div>
            <div className="m3-stat-lbl">Assigned Data</div>
          </div>
        </div>
      </div>

      {/* New Donors & Reactivations */}
      <div className="bento-col-3">
        <div className="bento-card">
          <div className="m3-stat">
            <div className="m3-stat-num" style={{color:'#8b5cf6'}}>{ds.new_donors_today ?? 0}</div>
            <div className="m3-stat-lbl">New Donors Today</div>
          </div>
        </div>
      </div>
      <div className="bento-col-3">
        <div className="bento-card">
          <div className="m3-stat">
            <div className="m3-stat-num" style={{color:'#8b5cf6'}}>{ds.new_donors_monthly ?? 0}</div>
            <div className="m3-stat-lbl">New Donors This Month</div>
          </div>
        </div>
      </div>
      <div className="bento-col-3">
        <div className="bento-card">
          <div className="m3-stat">
            <div className="m3-stat-num" style={{color:'#f59e0b'}}>{ds.reactivated_today ?? 0}</div>
            <div className="m3-stat-lbl">Reactivated Today</div>
          </div>
        </div>
      </div>
      <div className="bento-col-3">
        <div className="bento-card">
          <div className="m3-stat">
            <div className="m3-stat-num" style={{color:'#f59e0b'}}>{ds.reactivated_monthly ?? 0}</div>
            <div className="m3-stat-lbl">Reactivated This Month</div>
          </div>
        </div>
      </div>

      {/* Lead Stats */}
      <div className="bento-col-6">
        <div className="bento-card" style={{ flex:1 }}>
          <div className="bento-card-h"><h3>Lead Stats — {monthStr}</h3></div>
          {leadStats ? (
            <div style={{ display:'flex', gap:12 }}>
              <div style={{ flex:1, padding:12, borderRadius:8, background:'#eff6ff', border:'1px solid #bfdbfe' }}>
                <div style={{ fontSize:9, textTransform:'uppercase', fontWeight:600, color:'#3b82f6', marginBottom:2 }}>New Donors</div>
                <div style={{ fontSize:20, fontWeight:800, color:'#1d4ed8' }}>{leadStats.new_donors}</div>
                <div style={{ fontSize:10, color:'#3b82f6' }}>₹{Number(leadStats.new_amount).toLocaleString('en-IN')}</div>
              </div>
              <div style={{ flex:1, padding:12, borderRadius:8, background:'#f0fdf4', border:'1px solid #bbf7d0' }}>
                <div style={{ fontSize:9, textTransform:'uppercase', fontWeight:600, color:'#16a34a', marginBottom:2 }}>Existing Donors</div>
                <div style={{ fontSize:20, fontWeight:800, color:'#15803d' }}>{leadStats.existing_donors}</div>
                <div style={{ fontSize:10, color:'#16a34a' }}>₹{Number(leadStats.existing_amount).toLocaleString('en-IN')}</div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign:'center', padding:20, color:'var(--md-outline)', fontSize:11 }}>No lead data for this month.</div>
          )}
        </div>
      </div>

      {/* Follow-ups section */}
      <div className="bento-col-6">
        <div className="bento-card" style={{ flex:1 }}>
          <div className="bento-card-h"><h3>Follow-ups Today</h3></div>
          {followUps.length === 0 ? (
            <div style={{ textAlign:'center', padding:20, color:'var(--md-outline)', fontSize:11 }}>No follow-ups scheduled for today.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {followUps.map(fu => (
                <div key={fu.id} style={{
                  display:'flex', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:8,
                  background: fu.is_overdue ? '#fef2f2' : '#f0fdf4',
                  border: '1px solid ' + (fu.is_overdue ? '#fecaca' : '#bbf7d0'),
                }}>
                  <span style={{ fontSize:10, fontWeight:600, color:'var(--ink-soft)', minWidth:50 }}>
                    {new Date(fu.scheduled_at).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
                  </span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, fontWeight:600 }}>{fu.donor_name}</div>
                    <div style={{ fontSize:9, color:'var(--md-outline)' }}>{fu.donor_mobile}</div>
                  </div>
                  {fu.ngo_name && <span className="bento-pill bento-pill-gray" style={{fontSize:8}}>{fu.ngo_name}</span>}
                  {fu.is_overdue && <span className="bento-pill" style={{background:'#f87171', color:'#fff', fontSize:8}}>Overdue</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Request Data banner */}
      <div className="bento-col-12">
        <div className="bento-card" style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:'12px 16px' }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700 }}>Need more donor data?</div>
            <div style={{ fontSize:10, color:'var(--md-outline)', marginTop:2 }}>Request additional assignments or data from the NGO admin.</div>
          </div>
          <button onClick={() => setShowRequest(true)}
            style={{ padding:'8px 20px', border:'none', borderRadius:8, background:'var(--sage)', color:'#fff', fontSize:11, fontWeight:700, fontFamily:'inherit', cursor:'pointer', display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}>
            <span className="material-symbols-outlined" style={{ fontSize:16 }}>add_circle</span>
            Request More Data
          </button>
        </div>
      </div>

      {/* Chart row */}
      {barData.length > 0 && (
        <div className="bento-col-7">
          <div className="bento-card">
            <div className="bento-card-h"><h3>Target vs Collection</h3></div>
            <div style={{ width:'100%', height:220 }}>
              <ResponsiveContainer>
                <BarChart data={barData} margin={{ top:8, right:8, left:-8, bottom:4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize:11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v => '₹' + (v / 1000).toFixed(0) + 'k'} />
                  <Tooltip formatter={(v) => [currency(v), 'Amount']} contentStyle={{ fontSize:11, borderRadius:8, border:'1px solid #e2e8f0' }} />
                  <Bar dataKey="amount" radius={[6,6,0,0]} barSize={48}>
                    {barData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
      <div className="bento-col-5">
        <div className="bento-card">
          <div className="bento-card-h"><h3>Donor Status</h3></div>
          <div style={{ width:'100%', height:220, display:'flex', alignItems:'center', justifyContent:'center' }}>
            {pieData.length > 0 ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={3} dataKey="value">
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ fontSize:11, borderRadius:8, border:'1px solid #e2e8f0' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ fontSize:11, color:'var(--ink-soft)' }}>No status data</div>
            )}
          </div>
          {pieData.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 10px', marginTop:6, justifyContent:'center' }}>
              {pieData.map(e => (
                <div key={e.name} style={{ display:'flex', alignItems:'center', gap:4, fontSize:9, color:'var(--ink-soft)' }}>
                  <span style={{ width:8, height:8, borderRadius:2, background:e.color, display:'inline-block' }} />
                  {e.name} ({e.value})
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Monthly Donor Popup modal */}
      {showMonthlyModal && monthlyDonors.length > 0 && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.4)' }} onClick={() => setShowMonthlyModal(false)}>
          <div style={{ background:'#fff', borderRadius:12, width:480, maxHeight:'70vh', display:'flex', flexDirection:'column', boxShadow:'0 8px 32px rgba(0,0,0,.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700 }}>Monthly Recurring Donors</div>
                <div style={{ fontSize:10, color:'var(--ink-soft)' }}>{monthStr} — Donors with 3+ donations history</div>
              </div>
              <button onClick={() => setShowMonthlyModal(false)}
                style={{ width:28, height:28, border:'none', borderRadius:6, background:'var(--bg)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, lineHeight:1 }}>
                ×
              </button>
            </div>
            <div style={{ overflow:'auto', padding:8, flex:1 }}>
              {monthlyDonors.map(d => (
                <div key={`${d.donor_id}-${d.ngo_id}`} style={{
                  display:'flex', alignItems:'center', gap:10, padding:'8px 12px', marginBottom:4, borderRadius:8,
                  background:'var(--bg)', border:'1px solid var(--line)',
                }}>
                  <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--sage)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>
                    {d.donor_name?.charAt(0) || '?'}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, fontWeight:600 }}>{d.donor_name}</div>
                    <div style={{ fontSize:9, color:'var(--md-outline)' }}>{d.donor_mobile}{d.donor_city ? ` · ${d.donor_city}` : ''}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:10, fontWeight:600 }}>₹{Number(d.amount).toLocaleString('en-IN')}</div>
                    <div style={{ fontSize:8, color:'var(--md-outline)' }}>{d.donation_count} donations</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Request More Data modal */}
      {showRequest && (
        <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.4)' }} onClick={() => { if (!sending) { setShowRequest(false); setReqDone(false) } }}>
          <div style={{ background:'#fff', borderRadius:12, width:400, padding:20, boxShadow:'0 8px 32px rgba(0,0,0,.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>Request More Data</div>
            <div style={{ fontSize:10, color:'var(--ink-soft)', marginBottom:12 }}>Send a request to the NGO admin for additional donor assignments or data.</div>
            {reqDone ? (
              <div style={{ textAlign:'center', padding:'16px 0', color:'var(--sage)', fontWeight:600, fontSize:12 }}>
                <span className="material-symbols-outlined" style={{ fontSize:18, verticalAlign:'middle', marginRight:4 }}>check_circle</span>
                Request sent successfully
              </div>
            ) : (
              <>
                <textarea value={reqMsg} onChange={e => setReqMsg(e.target.value)} rows={4}
                  placeholder="Describe what data you need..."
                  style={{ width:'100%', padding:8, border:'1px solid var(--line)', borderRadius:6, fontSize:11, fontFamily:'inherit', resize:'vertical', boxSizing:'border-box' }} />
                <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12 }}>
                  <button onClick={() => { setShowRequest(false); setReqMsg('') }}
                    style={{ padding:'7px 16px', border:'1px solid var(--line)', borderRadius:6, background:'#fff', fontSize:11, fontWeight:600, fontFamily:'inherit', cursor:'pointer' }}>Cancel</button>
                  <button onClick={handleSendRequest} disabled={sending || !reqMsg.trim()}
                    style={{ padding:'7px 16px', border:'none', borderRadius:6, background:'var(--sage)', color:'#fff', fontSize:11, fontWeight:700, fontFamily:'inherit', cursor:'pointer', opacity: sending || !reqMsg.trim() ? .5 : 1 }}>
                    {sending ? 'Sending...' : 'Send Request'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
