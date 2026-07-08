
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboard, getFroLiveStatus, getAccountsLeads, getRecruiterLeads, getWorkers, getAttendance, getHolidays, getUsers } from '../api/endpoints'
import { api } from '../api/auth'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, RadialBarChart, RadialBar, LineChart, Line, CartesianGrid, Legend } from 'recharts'

/* ============ MINT PALETTE ============ */
const MINT = '#8CCDA4'          // fills, charts, borders
const MINT_DEEP = '#2A6B45'     // readable green text / icons
const MINT_DARK = '#1E4D3B'     // brand dark green
const MINT_LIGHT = '#EAF7EE'    // light tint backgrounds
const BLUSH = '#F7B2AD'         // soft red fill
const RED_DEEP = '#C0473C'      // readable red text / buttons
const GOLD = '#E0A73C'          // readable amber text
const GOLD_LIGHT = '#F6C979'    // amber fill
const SLATE = '#4C7C8C'         // secondary accent
const PRIMARY = '#1F332B'       // main text (green-black)
const CORAL = RED_DEEP          // kept name so old references work

/* fresh chart colors for Workers by Department bars */
const DEPT_COLORS = [
  '#22C55E', // green
  '#3B82F6', // blue
  '#F59E0B', // amber
  '#A855F7', // purple
  '#EF4444', // red
  '#14B8A6', // teal
  '#F97316', // orange
  '#6366F1', // indigo
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#8B5CF6', // violet
  '#F43F5E', // rose
  '#0EA5E9', // sky
  '#D946EF', // fuchsia
  '#10B981', // emerald
]

const NGO_CHIP_COLORS = {}
const NGO_PALETTE = [MINT_DEEP, RED_DEEP, SLATE, GOLD, '#3F8760', '#7A5C8C', MINT_DARK, '#B07D4F']
function ngoColor(name) {
  if (name && name.toLowerCase().startsWith('man')) return '#e91e9a'
  if (name && name.toLowerCase().startsWith('aflf')) return '#3b82f6'
  if (name && name.toLowerCase().startsWith('bsct')) return '#38bdf8'
  if (!NGO_CHIP_COLORS[name]) {
    NGO_CHIP_COLORS[name] = NGO_PALETTE[Object.keys(NGO_CHIP_COLORS).length % NGO_PALETTE.length]
  }
  return NGO_CHIP_COLORS[name]
}

const PERIODS = [
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: '90d', label: '90 Days' },
  { key: '1y', label: '1 Year' },
  { key: 'all', label: 'All Time' },
]

/* ================= CSV / EXCEL EXPORT ================= */
function exportToExcel(data, period) {
  const { stats = {}, deptWorkers = {}, attendanceStatus = {}, attendancePercent = 0, froAssignments = [], ngoUserCounts = [] } = data
  const rows = []
  rows.push(['DASHBOARD REPORT'])
  rows.push(['Generated', new Date().toLocaleString('en-IN')])
  rows.push(['Period', PERIODS.find(p => p.key === period)?.label || period])
  rows.push([])
  rows.push(['KEY METRICS'])
  rows.push(['Total NGOs', stats.totalNgos || 0])
  rows.push(['Total Workers', stats.totalWorkers || 0])
  rows.push(['Active Workers', stats.activeWorkers || 0])
  rows.push(['Attendance %', attendancePercent + '%'])
  rows.push([])
  rows.push(['ATTENDANCE STATUS'])
  rows.push(['Present', attendanceStatus.present || 0])
  rows.push(['Late', attendanceStatus.late || 0])
  rows.push(['Absent', attendanceStatus.absent || 0])
  rows.push([])
  rows.push(['WORKERS BY DEPARTMENT'])
  rows.push(['Department', 'Workers'])
  Object.entries(deptWorkers).forEach(([name, count]) => rows.push([name, count]))
  rows.push([])
  if (froAssignments.length > 0) {
    rows.push(['NGO WISE FRO ASSIGNMENTS'])
    rows.push(['FRO Name', 'Assigned NGOs'])
    froAssignments.forEach(f => rows.push([f.name, (f.ngos || []).join(' | ')]))
  } else if (ngoUserCounts.length > 0) {
    rows.push(['NGO SUMMARY'])
    rows.push(['NGO', 'Workers'])
    ngoUserCounts.forEach(n => rows.push([n.name, n.workers || 0]))
  }

  const csv = '\uFEFF' + rows
    .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `dashboard-report-${period}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/* ================= DONUT ================= */
function DonutChart({ segments, size, centerValue, centerLabel, animated, onSegmentClick, activeLabel }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  if (total === 0) return null
  const r = 15.915
  let offset = 0
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
        <circle cx="18" cy="18" fill="transparent" r={r} stroke="#EEF4EF" strokeWidth="3" />
        {segments.map((seg) => {
          const pct = (seg.value / total) * 100
          const dash = pct.toFixed(1)
          const gap = (100 - parseFloat(dash)).toFixed(1)
          const isActive = activeLabel === seg.label
          const el = (
            <circle
              key={seg.label}
              cx="18" cy="18" fill="transparent" r={r}
              stroke={seg.color}
              strokeDasharray={animated ? `${dash} ${gap}` : `0 100`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              strokeWidth={isActive ? 5.5 : 4.5}
              style={{ transition: 'stroke-dasharray 1s ease, stroke-width 0.2s ease', cursor: onSegmentClick ? 'pointer' : 'default', opacity: activeLabel && !isActive ? 0.35 : 1 }}
              onClick={() => onSegmentClick && onSegmentClick(seg.label)}
            />
          )
          offset += animated ? parseFloat(dash) : 0
          return el
        })}
      </svg>
      {(centerValue !== undefined || centerLabel) && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {centerValue !== undefined && <span style={{ fontSize: 24, fontWeight: 800, color: PRIMARY }}>{Number(centerValue).toLocaleString()}</span>}
          {centerLabel && <span style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>{centerLabel}</span>}
        </div>
      )}
    </div>
  )
}

/* ================= ACCOUNTS DETAIL MODAL ================= */
function AccountsDetailModal({ status, onClose }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    setLoading(true)
    getAccountsLeads(status === 'verified_today' ? 'verified' : status)
      .then(d => {
        const list = d?.data || d || []
        if (status === 'verified_today') {
          const today = new Date().toISOString().slice(0, 10)
          setItems(list.filter(r => r.verified_at?.slice(0, 10) === today))
        } else {
          setItems(list)
        }
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [status])

  const filtered = q.trim()
    ? items.filter(r => (r.donor_name || '').toLowerCase().includes(q.trim().toLowerCase()) || (r.donor_mobile || '').includes(q.trim()))
    : items

  const labels = { pending: 'Pending', verified: 'Verified', rejected: 'Rejected', verified_today: 'Verified Today' }

  return (
    <div className="nd-modal-overlay" onClick={onClose}>
      <div className="nd-modal fro-modal" onClick={e => e.stopPropagation()}>
        <div className="nd-modal-head" style={{ borderColor: `${MINT}50` }}>
          <h3 className="nd-modal-title">Accounts — {labels[status] || status}</h3>
          <button className="nd-modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="nd-modal-body" style={{ padding: 0 }}>
          <div className="nd-modal-search" style={{ margin: 12 }}>
            <input className="nd-modal-search-input" placeholder="Search donor..." value={q} onChange={e => setQ(e.target.value)} autoFocus />
            {q && <button className="nd-modal-search-clear" onClick={() => setQ('')}><span className="material-symbols-outlined">close</span></button>}
          </div>
          {loading ? (
            <p className="nd-muted" style={{ padding: 16 }}>Loading...</p>
          ) : err ? (
            <p className="nd-muted" style={{ padding: 16, color: RED_DEEP }}>{err}</p>
          ) : filtered.length === 0 ? (
            <p className="nd-muted" style={{ padding: 16 }}>No records found.</p>
          ) : (
            <div className="fro-table-wrap">
              <table className="fro-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Donor Name</th>
                    <th>Mobile</th>
                    <th>Amount</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={r.log_id || i}>
                      <td>{i + 1}</td>
                      <td>{r.donor_name}</td>
                      <td>{r.donor_mobile}</td>
                      <td className="fro-amt">₹{(r.amount || 0).toLocaleString('en-IN')}</td>
                      <td>{r.created_at?.slice(0, 10) || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="fro-live-footer" style={{ padding: '10px 16px', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  )
}

/* ================= RECRUITER DETAIL MODAL ================= */
function RecruiterDetailModal({ type, onClose }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    setLoading(true)
    getRecruiterLeads()
      .then(d => {
        const list = d?.data || d || []
        if (type === 'new_today') {
          const today = new Date().toISOString().slice(0, 10)
          setItems(list.filter(r => r.created_at?.slice(0, 10) === today))
        } else {
          setItems(list)
        }
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [type])

  const filtered = q.trim()
    ? items.filter(r => (r.name || '').toLowerCase().includes(q.trim().toLowerCase()) || (r.phone || '').includes(q.trim()))
    : items

  const labels = { total_leads: 'All Leads', new_today: 'New Today', conversion_rate: 'Lead Status Overview' }

  return (
    <div className="nd-modal-overlay" onClick={onClose}>
      <div className="nd-modal fro-modal" onClick={e => e.stopPropagation()}>
        <div className="nd-modal-head" style={{ borderColor: `${GOLD_LIGHT}60` }}>
          <h3 className="nd-modal-title">Recruiter — {labels[type] || type}</h3>
          <button className="nd-modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="nd-modal-body" style={{ padding: 0 }}>
          <div className="nd-modal-search" style={{ margin: 12 }}>
            <input className="nd-modal-search-input" placeholder="Search lead..." value={q} onChange={e => setQ(e.target.value)} autoFocus />
            {q && <button className="nd-modal-search-clear" onClick={() => setQ('')}><span className="material-symbols-outlined">close</span></button>}
          </div>
          {loading ? (
            <p className="nd-muted" style={{ padding: 16 }}>Loading...</p>
          ) : err ? (
            <p className="nd-muted" style={{ padding: 16, color: RED_DEEP }}>{err}</p>
          ) : filtered.length === 0 ? (
            <p className="nd-muted" style={{ padding: 16 }}>No leads found.</p>
          ) : (
            <div className="fro-table-wrap">
              <table className="fro-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Recruiter</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={r.id || i}>
                      <td>{i + 1}</td>
                      <td>{r.name}</td>
                      <td>{r.phone}</td>
                      <td><span className={`lead-status-dot ${r.status}`} />{r.status}</td>
                      <td>{r.users?.name || '-'}</td>
                      <td>{r.created_at?.slice(0, 10) || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="fro-live-footer" style={{ padding: '10px 16px', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{filtered.length} lead{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  )
}

/* ================= PANEL SUMMARY MODAL ================= */
function PanelSummaryModal({ panel, onClose, dashboardData }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const timer = useRef(null)

  const fetchData = useCallback(() => {
    setLoading(true)

    const fetchers = {
      accounts: () => getAccountsLeads()
        .then(d => {
          const list = d?.data || d || []
          const pending = list.filter(l => l.accounts_status === 'pending')
          const verified = list.filter(l => l.accounts_status === 'verified')
          const today = new Date().toDateString()
          const verifiedToday = verified.filter(l => l.verified_at && new Date(l.verified_at).toDateString() === today)
          return {
            pending: { count: pending.length, amount: pending.reduce((s, l) => s + Number(l.amount || 0), 0) },
            verified: { count: verified.length, amount: verified.reduce((s, l) => s + Number(l.amount || 0), 0) },
            verifiedToday: { count: verifiedToday.length, amount: verifiedToday.reduce((s, l) => s + Number(l.amount || 0), 0) },
            total: { count: list.length, amount: list.reduce((s, l) => s + Number(l.amount || 0), 0) },
          }
        }),
      fro: () => getFroLiveStatus()
        .then(list => {
          const arr = Array.isArray(list) ? list : []
          const active = arr.filter(f => f.is_active)
          const punchedIn = arr.filter(f => f.is_punched_in)
          const totalCollection = arr.reduce((s, f) => s + Number(f.today_collection || 0), 0)
          const totalData = arr.reduce((s, f) => s + Number(f.data_used || 0), 0)
          return { total: arr.length, active: active.length, inactive: arr.length - active.length, punchedIn: punchedIn.length, totalCollection, totalData }
        }),
      hr: () => Promise.all([getWorkers(), getAttendance()])
        .then(([workers, attendance]) => {
          const wList = Array.isArray(workers) ? workers : workers?.data || []
          const totalWorkers = wList.length
          const activeWorkers = wList.filter(w => w.is_active).length
          const today = new Date().toDateString()
          const attList = Array.isArray(attendance) ? attendance : attendance?.data || []
          const todayAtt = attList.filter(a => a.date && new Date(a.date).toDateString() === today)
          const presentToday = todayAtt.filter(a => a.status === 'present' || a.punched_in).length
          const totalAtt = todayAtt.length
          return { totalWorkers, activeWorkers, presentToday, totalAtt, attendancePercent: totalAtt > 0 ? Math.round((presentToday / totalAtt) * 100) : 0 }
        }),
      'ngo-admin': () => {
        const dd = dashboardData
        if (dd?.stats?.totalNgos != null) {
          return Promise.resolve({ totalNgos: dd.stats.totalNgos, ngoTotals: dd.ngoTotals || [] })
        }
        return Promise.resolve({ totalNgos: 0, ngoTotals: [] })
      },
      recruiter: () => getRecruiterLeads()
        .then(d => {
          const list = d?.data || d || []
          const today = new Date().toDateString()
          const newToday = list.filter(l => l.created_at && new Date(l.created_at).toDateString() === today)
          const statusGroups = {}
          list.forEach(l => { const s = l.status || 'unknown'; statusGroups[s] = (statusGroups[s] || 0) + 1 })
          const selected = list.filter(l => l.status === 'selected' || l.status === 'verified').length
          const rejected = list.filter(l => l.status === 'rejected').length
          const conversionRate = rejected + selected > 0 ? (selected / (selected + rejected)) * 100 : 0
          return { total: list.length, newToday: newToday.length, conversionRate, statusGroups }
        }),
    }

    const fetcher = fetchers[panel]
    if (fetcher) fetcher().then(setData).catch(() => setData({})) .finally(() => setLoading(false))
  }, [panel])

  useEffect(() => {
    fetchData()
    timer.current = setInterval(fetchData, 30000)
    return () => clearInterval(timer.current)
  }, [fetchData])

  const labels = {
    accounts: { title: 'Accounts — Lead Verification', icon: 'receipt_long', color: MINT_DARK },
    fro: { title: 'FRO — Field Operations', icon: 'groups', color: MINT_DEEP },
    hr: { title: 'HR — Employee Management', icon: 'badge', color: SLATE },
    'ngo-admin': { title: 'NGO Admin — NGO Management', icon: 'corporate_fare', color: GOLD },
    recruiter: { title: 'Recruiter — Lead Pipeline', icon: 'person_search', color: GOLD },
  }
  const meta = labels[panel] || {}

  return (
    <div className="nd-modal-overlay" onClick={onClose}>
      <div className="nd-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="nd-modal-head" style={{ borderColor: `${meta.color}30` }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: meta.color }}>{meta.icon}</span>
          <h3 className="nd-modal-title">{meta.title}</h3>
          <button className="nd-modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="nd-modal-body">
          {loading && !data ? (
            <p className="nd-muted">Loading...</p>
          ) : (
            <div className="ps-grid">
              {panel === 'accounts' && data && (
                <>
                  <div className="ps-card" style={{ borderTop: `3px solid #F59E0B` }}>
                    <span className="ps-label">⏳ Pending</span>
                    <span className="ps-value">{data.pending?.count ?? 0}</span>
                    <span className="ps-sub">₹{(data.pending?.amount || 0).toLocaleString('en-IN')} total</span>
                  </div>
                  <div className="ps-card" style={{ borderTop: `3px solid #3B82F6` }}>
                    <span className="ps-label">✔️ Verified</span>
                    <span className="ps-value">{data.verified?.count ?? 0}</span>
                    <span className="ps-sub">₹{(data.verified?.amount || 0).toLocaleString('en-IN')} total</span>
                  </div>
                  <div className="ps-card" style={{ borderTop: `3px solid #10B981` }}>
                    <span className="ps-label">📅 Verified Today</span>
                    <span className="ps-value">{data.verifiedToday?.count ?? 0}</span>
                    <span className="ps-sub">₹{(data.verifiedToday?.amount || 0).toLocaleString('en-IN')} collected</span>
                  </div>
                  <div className="ps-card" style={{ borderTop: `3px solid #8B5CF6` }}>
                    <span className="ps-label">💰 Total Amount</span>
                    <span className="ps-value">₹{(data.total?.amount || 0).toLocaleString('en-IN')}</span>
                    <span className="ps-sub">Across {data.total?.count || 0} leads</span>
                  </div>
                </>
              )}
              {panel === 'fro' && data && (
                <>
                  <div className="ps-card" style={{ borderTop: `3px solid ${MINT_DARK}` }}>
                    <span className="ps-label">📋 Total FROs</span>
                    <span className="ps-value">{data.total ?? 0}</span>
                    <span className="ps-sub">Registered workers</span>
                  </div>
                  <div className="ps-card" style={{ borderTop: `3px solid ${MINT_DEEP}` }}>
                    <span className="ps-label">🟢 Active</span>
                    <span className="ps-value">{data.active ?? 0}</span>
                    <span className="ps-sub">{data.inactive ?? 0} inactive</span>
                  </div>
                  <div className="ps-card" style={{ borderTop: `3px solid ${SLATE}` }}>
                    <span className="ps-label">✅ Punched In</span>
                    <span className="ps-value">{data.punchedIn ?? 0}</span>
                    <span className="ps-sub">Today</span>
                  </div>
                  <div className="ps-card" style={{ borderTop: `3px solid ${GOLD}` }}>
                    <span className="ps-label">💰 Today's Collection</span>
                    <span className="ps-value">₹{(data.totalCollection || 0).toLocaleString('en-IN')}</span>
                    <span className="ps-sub">Data used: {data.totalData || 0}</span>
                  </div>
                </>
              )}
              {panel === 'hr' && data && (
                <>
                  <div className="ps-card" style={{ borderTop: `3px solid ${SLATE}` }}>
                    <span className="ps-label">👷 Total Workers</span>
                    <span className="ps-value">{data.totalWorkers ?? 0}</span>
                    <span className="ps-sub">All time</span>
                  </div>
                  <div className="ps-card" style={{ borderTop: `3px solid ${MINT_DEEP}` }}>
                    <span className="ps-label">✅ Active Workers</span>
                    <span className="ps-value">{data.activeWorkers ?? 0}</span>
                    <span className="ps-sub">Currently active</span>
                  </div>
                  <div className="ps-card" style={{ borderTop: `3px solid ${GOLD}` }}>
                    <span className="ps-label">📊 Attendance</span>
                    <span className="ps-value">{data.attendancePercent ?? 0}%</span>
                    <span className="ps-sub">{data.presentToday ?? 0} of {data.totalAtt ?? 0} today</span>
                  </div>
                </>
              )}
              {panel === 'ngo-admin' && data && (
                <>
                  <div className="ps-card" style={{ borderTop: `3px solid ${GOLD}` }}>
                    <span className="ps-label">🏢 Total NGOs</span>
                    <span className="ps-value">{data.totalNgos ?? 0}</span>
                    <span className="ps-sub">Registered NGOs</span>
                  </div>
                  {data.ngoTotals?.length > 0 && (
                    <div className="ps-card" style={{ borderTop: `3px solid ${SLATE}` }}>
                      <span className="ps-label">📊 NGO Breakdown</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 8 }}>
                        {data.ngoTotals.map(t => (
                          <span key={t.name} style={{
                            background: `${t.color || SLATE}14`, color: t.color || SLATE,
                            borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600
                          }}>
                            {t.name} — {t.count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              {panel === 'recruiter' && data && (
                <>
                  <div className="ps-card" style={{ borderTop: `3px solid ${MINT_DARK}` }}>
                    <span className="ps-label">📋 Total Leads</span>
                    <span className="ps-value">{data.total ?? 0}</span>
                    <span className="ps-sub">All time</span>
                  </div>
                  <div className="ps-card" style={{ borderTop: `3px solid ${MINT_DEEP}` }}>
                    <span className="ps-label">🆕 New Today</span>
                    <span className="ps-value">{data.newToday ?? 0}</span>
                    <span className="ps-sub">Added today</span>
                  </div>
                  <div className="ps-card" style={{ borderTop: `3px solid ${GOLD}` }}>
                    <span className="ps-label">📈 Conversion</span>
                    <span className="ps-value">{(data.conversionRate ?? 0).toFixed(1)}%</span>
                    <span className="ps-sub">Selected vs Rejected</span>
                  </div>
                </>
              )}
            </div>
          )}
          <div className="fro-live-footer">
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Auto-refreshes every 30s</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ================= NAME LIST MODAL ================= */
function NameListModal({ title, color, names, onClose }) {
  const [q, setQ] = useState('')
  const filtered = q.trim()
    ? names.filter(n => {
        const name = (typeof n === 'string' ? n : (n.name || '')).toLowerCase()
        return name.includes(q.trim().toLowerCase())
      })
    : names
  return (
    <div className="nd-modal-overlay" onClick={onClose}>
      <div className="nd-modal" onClick={e => e.stopPropagation()}>
        <div className="nd-modal-head" style={{ borderColor: `${color}30` }}>
          <span className="nd-modal-badge" style={{ background: `${color}18`, color }}>
            {filtered.length}/{names.length}
          </span>
          <h3 className="nd-modal-title">{title}</h3>
          <button className="nd-modal-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="nd-modal-body">
          <div className="nd-modal-search">
            <span className="material-symbols-outlined nd-modal-search-icon">search</span>
            <input
              className="nd-modal-search-input"
              placeholder="Search by name..."
              value={q}
              onChange={e => setQ(e.target.value)}
              autoFocus
            />
            {q && <button className="nd-modal-search-clear" onClick={() => setQ('')}><span className="material-symbols-outlined">close</span></button>}
          </div>
          {filtered.length === 0 ? (
            <p className="nd-muted" style={{ padding: 16 }}>{q ? 'No matching names found.' : 'No records found for this period.'}</p>
          ) : (
            filtered.map((n, i) => {
              const person = typeof n === 'string' ? { name: n } : n
              return (
                <div key={i} className="nd-modal-row">
                  <span className="nd-avatar" style={{ background: `${color}18`, color }}>
                    {person.name?.charAt(0).toUpperCase() || '?'}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <span className="nd-modal-name">{person.name}</span>
                    {(person.dept || person.department) && (
                      <span className="nd-modal-dept">{person.dept || person.department}</span>
                    )}
                  </div>
                  {person.time && <span className="nd-modal-time">{person.time}</span>}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Animated counter (scroll-triggered) ─── */
function AnimatedNum({ to, suffix = '' }) {
  const [v, setV] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    if (to === 0) { setV(0); return; }
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      const dur = 1000, s = performance.now(), d = to;
      const tick = (n) => { const p = Math.min((n - s) / dur, 1); setV(Math.round(d * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      obs.disconnect();
    }, { threshold: 0.3 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [to]);
  return <span ref={ref}>{v.toLocaleString('en-IN')}{suffix}</span>;
}

/* ─── FRO status helpers (from LiveFroStatus) ─── */
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

function StatBox({ label, value, icon }) {
  return (
    <div style={{ padding: '8px 10px', borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, marginBottom: 2 }}>{icon} {label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#091426' }}>{value}</div>
    </div>
  )
}

function FroDeepDetailModal({ fro, onClose }) {
  if (!fro) return null
  const workerName = fro.workers?.name || 'Unknown'
  const meta = STATUS_META[fro.status] || STATUS_META.offline
  const totalActive = (fro.today_talk_seconds || 0) + (fro.today_idle_seconds || 0)
  const productivity = totalActive > 0 ? Math.round(((fro.today_talk_seconds || 0) / totalActive) * 100) : null
  return (
    <div className="nd-modal-overlay" onClick={onClose}>
      <div className="card" style={{ width: 420, padding: '24px 28px', background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
              {workerName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{workerName}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{fro.workers?.login_id || ''}</div>
            </div>
          </div>
          <button className="nd-modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <div style={{ padding: '10px 12px', borderRadius: 6, background: meta.bg, border: `1px solid ${meta.border}`, textAlign: 'center', marginBottom: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: meta.color }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: meta.color, display: 'inline-block' }} />
            {meta.label}
          </span>
        </div>
        {fro.status === 'on_call' && (
          <div style={{ padding: '10px 12px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fecaca', marginBottom: 12 }}>
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
          <div style={{ padding: '10px 12px', borderRadius: 6, background: fro.today_break_seconds > 3600 ? '#fef2f2' : '#fefce8', border: `1px solid ${fro.today_break_seconds > 3600 ? '#fecaca' : '#fde68a'}`, marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: '#92400e', fontWeight: 600, marginBottom: 4 }}>☕ On Break</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: fro.today_break_seconds > 3600 ? '#dc2626' : '#d97706', fontVariantNumeric: 'tabular-nums' }}>
                {fro.break_started_at ? fmt(Math.floor((Date.now() - new Date(fro.break_started_at).getTime()) / 1000)) : '00:00'}
              </span>
              <span style={{ fontSize: 11, color: '#92400e' }}>today: {fmt(fro.today_break_seconds || 0)}</span>
            </div>
          </div>
        )}
        <div style={{ fontSize: 12, fontWeight: 700, color: '#091426', marginBottom: 8 }}>📊 Today's Performance</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <StatBox label="Calls" value={fro.today_calls || 0} icon="📞" />
          <StatBox label="Talk Time" value={fmt(fro.today_talk_seconds || 0)} icon="⏱️" />
          <StatBox label="Skipped" value={fro.today_skipped || 0} icon="⏳" />
          <StatBox label="Idle Time" value={fmt(fro.today_idle_seconds || 0)} icon="🕊️" />
          {fro.today_break_seconds > 0 && <StatBox label="Break" value={fmt(fro.today_break_seconds || 0)} icon="☕" />}
          {productivity !== null && <StatBox label="Productivity" value={`${productivity}%`} icon="📊" />}
        </div>
        <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 14, textAlign: 'center' }}>Auto-refreshes every 30s</div>
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
    <div className="nd-modal-overlay" onClick={onClose}>
      <div className="card" style={{ width: 340, padding: '20px 24px', background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={onShowDeep}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
              {workerName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: MINT_DEEP }}>{workerName} <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}>→</span></div>
              <div style={{ fontSize: 10, color: '#64748b' }}>{fro.workers?.login_id || ''}</div>
            </div>
          </div>
          <button className="nd-modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
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

/* ─── Mini FRO card for dashboard ─── */
function FroMiniCard({ fro, onCardClick }) {
  if (!fro) return null
  const meta = STATUS_META[fro.status] || STATUS_META.offline
  const workerName = fro.workers?.name || 'Unknown'
  const initials = workerName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const totalActive = (fro.today_talk_seconds || 0) + (fro.today_idle_seconds || 0)
  const productivity = totalActive > 0 ? Math.round(((fro.today_talk_seconds || 0) / totalActive) * 100) : null
  const callTimer = fro.status === 'on_call' && fro.call_started_at
    ? fmt(Math.floor((Date.now() - new Date(fro.call_started_at).getTime()) / 1000))
    : null
  const breakTimer = fro.status === 'break' && fro.break_started_at
    ? fmt(Math.floor((Date.now() - new Date(fro.break_started_at).getTime()) / 1000))
    : null

  return (
    <div className="fro-mini-card" onClick={() => onCardClick(fro)}
      style={{ borderLeft: `4px solid ${meta.color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>{workerName}</div>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>{fro.workers?.login_id || ''}</div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, display: 'inline-block' }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: meta.color }}>{meta.label}</span>
        </span>
      </div>
      {fro.status === 'on_call' && callTimer && (
        <div style={{ padding: '6px 10px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fecaca', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#dc2626' }}>call</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#991b1b', flex: 1 }}>{fro.current_donor_name}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>{callTimer}</span>
        </div>
      )}
      {fro.status === 'break' && breakTimer && (
        <div style={{ padding: '6px 10px', borderRadius: 6, background: '#fefce8', border: '1px solid #fde68a', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#d97706' }}>free_breakfast</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#92400e', flex: 1 }}>{fro.today_break_seconds > 3600 ? 'Break 🔴' : 'On Break'}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#d97706', fontVariantNumeric: 'tabular-nums' }}>{breakTimer}</span>
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 10, color: '#94a3b8' }}>
        <span>📞 <strong style={{ color: PRIMARY }}>{fro.today_calls || 0}</strong></span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>⏱️ <strong style={{ color: PRIMARY }}>{fmt(fro.today_talk_seconds || 0)}</strong></span>
        {productivity !== null && (
          <span style={{ color: productivity < 50 ? RED_DEEP : MINT_DEEP, fontWeight: 600 }}>📊 {productivity}%</span>
        )}
      </div>
    </div>
  )
}

/* ─── Monthly Attendance Heatmap ─── */
function AttendanceHeatmap({ attendance, holidays }) {
  const yr = new Date().getFullYear(), mo = new Date().getMonth()
  const dim = new Date(yr, mo + 1, 0).getDate(), fdow = new Date(yr, mo, 1).getDay()
  const ds = (d) => `${yr}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const hset = new Set((holidays || []).map(x => x.date?.slice(0, 10)))
  const a = attendance || []
  const dayStats = {}
  for (let d = 1; d <= dim; d++) {
    const s = ds(d), da = a.filter(x => x.date === s), t = da.length, p = da.filter(x => x.status === 'present' || x.status === 'late').length
    dayStats[s] = { t, p, pct: t ? Math.round(p / t * 100) : 0 }
  }
  const hColor = (s) => {
    if (!dayStats[s] || !dayStats[s].t) return 'var(--line,#E4DECF)'
    const pct = dayStats[s].pct
    if (pct >= 90) return MINT
    if (pct >= 70) return '#7a9a5a'
    if (pct >= 50) return '#a8c08a'
    return BLUSH
  }
  const isHol = (d) => hset.has(ds(d)) || new Date(yr, mo, d).getDay() === 0
  return (
    <div>
      <div style={{ fontSize: 10, color: MINT_DEEP, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8, textAlign: 'center' }}>
        {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
        {['S','M','T','W','T','F','S'].map((n, i) => <div key={`dow-${i}`} style={{ fontSize: 7, color: '#94a3b8', textAlign: 'center', fontWeight: 600 }}>{n}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {Array.from({ length: fdow }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: dim }, (_, i) => i + 1).map(d => {
          const s = ds(d), hol = isHol(d)
          return <div key={d} title={hol ? 'Holiday' : `${dayStats[s]?.p||0}/${dayStats[s]?.t||0} present`}
            style={{ borderRadius: 3, background: hol ? 'repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(0,0,0,.03)3px,rgba(0,0,0,.03)6px)' : hColor(s), display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 18, cursor: 'default' }}>
            <span style={{ fontSize: 7, fontWeight: 600, color: hol ? '#94a3b8' : 'rgba(255,255,255,.85)' }}>{d}</span>
          </div>
        })}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          { bg: MINT, label: '≥90%' },
          { bg: '#7a9a5a', label: '70–89%' },
          { bg: '#a8c08a', label: '50–69%' },
          { bg: BLUSH, label: '<50%' },
          { bg: 'repeating-linear-gradient(45deg,transparent,transparent 2px,rgba(0,0,0,.05)2px,rgba(0,0,0,.05)4px)', label: 'Holiday' },
        ].map(c => (
          <span key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 7, color: '#94a3b8' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: c.bg, display: 'inline-block', border: '1px solid #DCEEE2' }} />
            {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ================= PIPELINE FLOW ================= */
function PipelineFlow({ stages, color, height }) {
  const maxVal = Math.max(...stages.map(s => s.value), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '6px 0', height: height || 64 }}>
      {stages.map((s, i) => (
        <div key={s.label} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
          {i > 0 && (
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          )}
          <div style={{ textAlign: 'center', minWidth: 0, flex: 1 }}>
            <div style={{
              height: 8, borderRadius: 4, margin: '0 auto 4px',
              width: `${Math.max(30, (s.value / maxVal) * 100)}%`,
              background: `linear-gradient(90deg, ${s.color || color}, ${s.color || color}88)`,
            }} />
            <div style={{ fontSize: 12, fontWeight: 800, color: PRIMARY, lineHeight: 1.2 }}>{s.value.toLocaleString()}</div>
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>{s.label}</div>
            {s.sub && <div style={{ fontSize: 8, color: '#b6c0cc' }}>{s.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ================= FRO NESTED MODAL (split layout + recharts) ================= */
function FroNestedDetail({ fro }) {
  if (!fro) return null
  const meta = STATUS_META[fro.status] || STATUS_META.offline
  const workerName = fro.workers?.name || 'Unknown'
  const totalActive = (fro.today_talk_seconds || 0) + (fro.today_idle_seconds || 0)
  const productivity = totalActive > 0 ? Math.round(((fro.today_talk_seconds || 0) / totalActive) * 100) : 0
  const callTimer = fro.status === 'on_call' && fro.call_started_at
    ? fmt(Math.floor((Date.now() - new Date(fro.call_started_at).getTime()) / 1000))
    : null
  const breakTimer = fro.status === 'break' && fro.break_started_at
    ? fmt(Math.floor((Date.now() - new Date(fro.break_started_at).getTime()) / 1000))
    : null
  const statColor = (v) => v > 0 ? '#059669' : '#94a3b8'
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
            {workerName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: PRIMARY }}>{workerName}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{fro.workers?.login_id || ''} · {fro.workers?.ngo_name || ''}</div>
          </div>
        </div>
        <div style={{ padding: '5px 14px', borderRadius: 99, background: meta.bg, border: `1px solid ${meta.border}` }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: meta.color }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, display: 'inline-block' }} />
            {meta.label}
          </span>
        </div>
      </div>
      {fro.status === 'on_call' && callTimer && (
        <div style={{ padding: '8px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#dc2626' }}>call</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#991b1b', flex: 1 }}>{fro.current_donor_name || 'On Call'}</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>{callTimer}</span>
        </div>
      )}
      {fro.status === 'break' && breakTimer && (
        <div style={{ padding: '8px 14px', borderRadius: 8, background: '#fefce8', border: '1px solid #fde68a', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#d97706' }}>free_breakfast</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#92400e', flex: 1 }}>Break</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#d97706', fontVariantNumeric: 'tabular-nums' }}>{breakTimer}</span>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '12px 14px', border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Today Collection</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#059669', lineHeight: 1.2 }}>₹{Number(fro.today_collection || 0).toLocaleString('en-IN')}</div>
        </div>
        <div style={{ background: '#fefce8', borderRadius: 10, padding: '12px 14px', border: '1px solid #fde68a' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Data Used</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#d97706', lineHeight: 1.2 }}>{fro.data_used || 0} <span style={{ fontSize: 12, fontWeight: 600 }}>MB</span></div>
        </div>
        <div style={{ background: '#eff6ff', borderRadius: 10, padding: '12px 14px', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Today Calls</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#2563eb', lineHeight: 1.2 }}>{fro.today_calls || 0}</div>
        </div>
        <div style={{ background: '#faf5ff', borderRadius: 10, padding: '12px 14px', border: '1px solid #e9d5ff' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Leads</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#7c3aed', lineHeight: 1.2 }}>{fro.today_skipped || 0}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        <StatBox label="Talk Time" value={fmt(fro.today_talk_seconds || 0)} icon="⏱️" />
        <StatBox label="Idle" value={fmt(fro.today_idle_seconds || 0)} icon="🕊️" />
        <StatBox label="Break" value={fmt(fro.today_break_seconds || 0)} icon="☕" />
        <StatBox label="Productivity" value={`${productivity}%`} icon="📊" />
      </div>
      <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 10, textAlign: 'center' }}>
        Last seen: {fro.updated_at ? new Date(fro.updated_at).toLocaleTimeString('en-IN') : '—'}
      </div>
    </>
  )
}

function FroNestedModal({ froList, onClose }) {
  const [selId, setSelId] = useState(null)
  const validList = Array.isArray(froList) ? froList : []
  const selected = selId ? validList.find(f => f && f.id === selId) : (validList[0] || null)
  useEffect(() => { if (validList.length > 0 && !selId) setSelId(validList[0].id) }, [validList])
  return (
    <div className="nd-modal-overlay" onClick={onClose}>
      <div className="nd-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 880, height: '80vh', maxHeight: 700, display: 'flex', flexDirection: 'column' }}>
        <div className="nd-modal-head" style={{ borderColor: `${MINT}50`, flexShrink: 0 }}>
          <span className="material-symbols-outlined" style={{ color: MINT_DEEP, fontSize: 22 }}>groups</span>
          <h3 className="nd-modal-title">FRO Live Detail</h3>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
            {validList.filter(f => f && (f.status === 'online' || f.status === 'on_call')).length}/{validList.length} active
          </span>
          <button className="nd-modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ width: 280, borderRight: '1px solid #EAF3EC', overflowY: 'auto', flexShrink: 0 }}>
            {validList.map(f => {
              if (!f) return null
              const m = STATUS_META[f.status] || STATUS_META.offline
              const nm = f.workers?.name || f.login_id || 'Unknown'
              const init = nm.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
              const isSel = f.id === selId
              return (
                <div key={f.id} onClick={() => setSelId(f.id)} style={{
                  padding: '10px 12px', cursor: 'pointer',
                  borderLeft: `3px solid ${isSel ? m.color : 'transparent'}`,
                  background: isSel ? MINT_LIGHT : 'transparent',
                  borderBottom: '1px solid #F0F7F2', transition: 'background 0.15s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: m.bg, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>{init}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: PRIMARY }}>{nm}</div>
                      <div style={{ fontSize: 9, color: '#94a3b8' }}>{f.workers?.login_id || ''}</div>
                    </div>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, fontSize: 9, color: '#64748b', paddingLeft: 38 }}>
                    <span>₹{Number(f.today_collection || 0).toLocaleString('en-IN')}</span>
                    <span>📞{f.today_calls || 0}</span>
                    <span>📊{f.data_used || 0}MB</span>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            <FroNestedDetail key={selected?.id} fro={selected} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ================= NGO STATION MODAL ================= */
const NGO_DISPOSITION_LABELS = {
  pending: 'Pending', contacted: 'Contacted', follow_up: 'Follow Up', scheduled: 'Scheduled',
  busy: 'Busy', ringing: 'Ringing', unreachable: 'Unreachable', switched_off: 'Switched Off',
  wrong_number: 'Wrong Number', invalid_number: 'Invalid', rejected: 'Rejected',
  lead_done: 'Lead Done', visit_donate: 'Visit & Donate', promise_to_pay: 'Promise to Pay',
  payment_pending: 'Payment Pending', already_donated: 'Already Donated',
  not_interested: 'Not Interested', not_interested_now: 'Not Interested Now',
  language_barrier: 'Language Barrier', transferred_senior: 'Transferred to Senior',
  query_complaint: 'Query/Complaint', receipt_request: 'Receipt Request',
  donation_collected: 'Donation Collected',
}
const NGO_DISPOSITION_GROUPS = [
  { label: 'Converted', color: '#16a34a', bg: '#f0fdf4', statuses: ['donation_collected', 'promise_to_pay', 'lead_done', 'visit_donate', 'payment_pending', 'already_donated'] },
  { label: 'In Progress', color: '#d97706', bg: '#fffbeb', statuses: ['pending', 'contacted', 'follow_up', 'scheduled'] },
  { label: 'Negative', color: '#dc2626', bg: '#fef2f2', statuses: ['not_interested', 'not_interested_now', 'rejected', 'busy', 'ringing', 'unreachable', 'switched_off', 'wrong_number', 'invalid_number', 'language_barrier'] },
  { label: 'Other', color: '#5B6B4E', bg: '#f0f2ee', statuses: ['transferred_senior', 'query_complaint', 'receipt_request'] },
]

function NgoStationModal({ ngoName, onClose }) {
  const [allDonors, setAllDonors] = useState([])
  const [stats, setStats] = useState(null)
  const [stationList, setStationList] = useState([])
  const [activeStation, setActiveStation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const PER_PAGE = 30

  useEffect(() => {
    setLoading(true)
    api(`/ngo-admin/dashboard/station-stats`).then(dStats => {
      const stations = dStats?.stations || {}
      const prefix = ngoName + '-'
      const matched = Object.keys(stations).filter(k => k === ngoName || k.startsWith(prefix)).sort()
      setStationList(matched)
      if (matched.length === 0) {
        setStats(null)
        setAllDonors([])
        setLoading(false)
        return
      }
      const agg = {}
      matched.forEach(st => {
        const s = stations[st]
        if (s) Object.entries(s).forEach(([status, count]) => { agg[status] = (agg[status] || 0) + count })
      })
      setStats(agg)
      setActiveStation(matched[0])
      Promise.all(matched.map(st =>
        api(`/ngo-admin/donors-by-station?station=${encodeURIComponent(st)}`).catch(() => [])
      )).then(results => {
        const combined = results.flatMap(r => Array.isArray(r) ? r : [])
        setAllDonors(combined)
      }).catch(() => {}).finally(() => setLoading(false))
    }).catch(() => { setLoading(false) })
  }, [ngoName])

  const allStatuses = stats ? Object.entries(stats).filter(([, v]) => v > 0) : []
  const totalDonors = allStatuses.reduce((t, [, v]) => t + v, 0)
  const groupData = NGO_DISPOSITION_GROUPS.map(g => ({
    ...g, total: g.statuses.reduce((t, s) => t + (stats?.[s] || 0), 0),
  })).filter(g => g.total > 0)

  const donors = statusFilter ? allDonors.filter(d => d.status === statusFilter) : allDonors
  const filtered = search ? donors.filter(d =>
    (d.donor_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.donor_mobile || '').includes(search) ||
    (d.fro_name || '').toLowerCase().includes(search.toLowerCase())
  ) : donors
  const totPages = Math.ceil(filtered.length / PER_PAGE)
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div className="nd-modal-overlay" onClick={onClose}>
      <div className="nd-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: '80vh' }}>
        <div className="nd-modal-head" style={{ borderColor: `${GOLD}40` }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: GOLD }}>corporate_fare</span>
          <h3 className="nd-modal-title">{ngoName}</h3>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{allDonors.length} donors · {stationList.length} station{stationList.length !== 1 ? 's' : ''}</span>
          <button className="nd-modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="nd-modal-body">
          {loading ? <p className="nd-muted">Loading...</p> : stationList.length === 0 ? (
            <p className="nd-muted">No station data found for {ngoName}.</p>
          ) : (
            <>
              {stationList.length > 1 && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                  {stationList.map(st => (
                    <button key={st} onClick={() => setActiveStation(st)}
                      style={{
                        padding: '3px 12px', borderRadius: 12, border: `1.5px solid ${activeStation === st ? GOLD : '#DCEEE2'}`,
                        background: activeStation === st ? '#fffbeb' : '#f6faf7', cursor: 'pointer', fontSize: 10, fontWeight: activeStation === st ? 700 : 500,
                        color: activeStation === st ? '#b45309' : '#64748b', fontFamily: 'inherit',
                      }}>
                      {st}
                    </button>
                  ))}
                </div>
              )}
              {groupData.length > 0 && (
                <>
                  <div style={{ height: 8, borderRadius: 4, background: '#e5e7eb', display: 'flex', overflow: 'hidden', marginBottom: 8 }}>
                    {groupData.map(g => <div key={g.label} style={{ width: `${(g.total / totalDonors) * 100}%`, height: '100%', background: g.color, opacity: 0.5 }} />)}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    {groupData.map(g => (
                      <span key={g.label} style={{ fontSize: 10, fontWeight: 600, color: g.color, background: g.bg, padding: '2px 10px', borderRadius: 10 }}>
                        {g.label}: {g.total}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                    {allStatuses.map(([status, count]) => {
                      const grp = NGO_DISPOSITION_GROUPS.find(g => g.statuses.includes(status)) || NGO_DISPOSITION_GROUPS[3]
                      return (
                        <button key={status} onClick={() => setStatusFilter(statusFilter === status ? '' : status)} style={{
                          padding: '3px 10px', borderRadius: 20, border: `1px solid ${statusFilter === status ? grp.color : 'transparent'}`,
                          background: statusFilter === status ? grp.bg : '#f6faf7', cursor: 'pointer', fontSize: 11, fontWeight: statusFilter === status ? 700 : 500,
                          color: statusFilter === status ? grp.color : '#64748b', fontFamily: 'inherit',
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: grp.color, display: 'inline-block', marginRight: 4, verticalAlign: 'middle' }} />
                          {NGO_DISPOSITION_LABELS[status] || status}
                          <span style={{ fontWeight: 700, color: grp.color, marginLeft: 3 }}>{count}</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
              <div className="nd-modal-search" style={{ marginTop: 4 }}>
                <span className="material-symbols-outlined nd-modal-search-icon">search</span>
                <input className="nd-modal-search-input" placeholder="Search donor name, phone, FRO..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
                {search && <button className="nd-modal-search-clear" onClick={() => setSearch('')}><span className="material-symbols-outlined">close</span></button>}
              </div>
              <div className="fro-table-wrap" style={{ maxHeight: '35vh', marginTop: 8 }}>
                <table className="fro-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Donor Name</th>
                      <th>Phone</th>
                      <th>FRO</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: 16, textAlign: 'center', color: '#94a3b8' }}>
                        {!statusFilter && !search ? 'Click a disposition above to view donors.' : 'No donors match.'}
                      </td></tr>
                    ) : (
                      paginated.map((d, i) => {
                        const grp = NGO_DISPOSITION_GROUPS.find(g => g.statuses.includes(d.status)) || NGO_DISPOSITION_GROUPS[3]
                        return (
                          <tr key={d.id || i}>
                            <td>{i + 1 + (page - 1) * PER_PAGE}</td>
                            <td style={{ fontWeight: 600 }}>{d.donor_name || '—'}</td>
                            <td>{d.donor_mobile || '—'}</td>
                            <td>{d.fro_name || 'Unassigned'}</td>
                            <td><span style={{ fontSize: 10, fontWeight: 600, color: grp.color, background: grp.bg, padding: '2px 8px', borderRadius: 10 }}>{NGO_DISPOSITION_LABELS[d.status] || d.status}</span></td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {totPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 8 }}>
                  <button className="nd-modal-close" style={{ fontSize: 11, padding: '2px 10px', width: 'auto', borderRadius: 6 }} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
                  <span style={{ fontSize: 10, color: '#64748b', padding: '4px 8px' }}>{page}/{totPages}</span>
                  <button className="nd-modal-close" style={{ fontSize: 11, padding: '2px 10px', width: 'auto', borderRadius: 6 }} disabled={page >= totPages} onClick={() => setPage(p => p + 1)}>Next</button>
                </div>
              )}
            </>)}
        </div>
      </div>
    </div>
  )
}

/* ================= NGO QUICK MODAL ================= */
function NgoQuickModal({ ngoName, onClose, froLiveData, froAssignments, ngoUserCounts, accountsSummary }) {
  const ngoFros = froLiveData.filter(f => f.workers?.ngo_name === ngoName)
  const totalCollection = ngoFros.reduce((s, f) => s + Number(f.today_collection || 0), 0)
  const totalCalls = ngoFros.reduce((s, f) => s + Number(f.today_calls || 0), 0)
  const totalDataUsed = ngoFros.reduce((s, f) => s + Number(f.data_used || 0), 0)
  const assignedFros = froAssignments.filter(f => (f.ngos || []).includes(ngoName))
  const workerCount = ngoUserCounts.find(n => n.name === ngoName)
  const nc = ngoColor(ngoName)

  return (
    <div className="nd-modal-overlay" onClick={onClose}>
      <div className="nd-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, maxHeight: '70vh' }}>
        <div className="nd-modal-head" style={{ borderColor: `${nc}40` }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: nc, flexShrink: 0 }} />
          <h3 className="nd-modal-title" style={{ color: nc }}>{ngoName}</h3>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{workerCount?.workers || workerCount?.count || 0} workers</span>
          <button className="nd-modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="nd-modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div style={{ padding: '10px 12px', borderRadius: 10, background: '#E8F5E9' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Collection</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: MINT_DEEP }}>₹{totalCollection.toLocaleString('en-IN')}</div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 10, background: '#E3F2FD' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Calls</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1E88E5' }}>{totalCalls}</div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 10, background: '#F3E5F5' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Data Used</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#8E24AA' }}>{totalDataUsed}</div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FFF8E1' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>FROs</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#F57C00' }}>{assignedFros.length} assigned</div>
            </div>
          </div>
          {assignedFros.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Assigned FROs</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {assignedFros.map((f, i) => {
                  const live = ngoFros.find(l => l.workers?.name === f.name || l.login_id === f.name)
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: '#f8fafb', border: '1px solid #eaf3ec' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: live ? '#10b981' : '#94a3b8', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: PRIMARY, flex: 1, minWidth: 0 }}>{f.name}</span>
                      {live ? (
                        <span style={{ fontSize: 11, fontWeight: 600, color: MINT_DEEP }}>₹{Number(live.today_collection || 0).toLocaleString('en-IN')}</span>
                      ) : (
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>Offline</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [period, setPeriod] = useState('all')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [animated, setAnimated] = useState(false)
  const [modal, setModal] = useState(null)
  const [panelModal, setPanelModal] = useState(null)
  const [accountsModalStatus, setAccountsModalStatus] = useState(null)
  const [recruiterModalType, setRecruiterModalType] = useState(null)
  const [allUserList, setAllUserList] = useState([])
  const froTimer = useRef(null)
  const [froLiveData, setFroLiveData] = useState([])
  const [selectedFro, setSelectedFro] = useState(null)
  const [deepFro, setDeepFro] = useState(null)
  const [attendanceData, setAttendanceData] = useState([])
  const [holidaysData, setHolidaysData] = useState([])
  const [showFroNestedModal, setShowFroNestedModal] = useState(false)
  const [ngoStationModal, setNgoStationModal] = useState(null)
  const [deptModal, setDeptModal] = useState(null)
  const [kpiModal, setKpiModal] = useState(null)
  const [selectedNgoBtn, setSelectedNgoBtn] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    getUsers().then(d => {
      setAllUserList(Array.isArray(d) ? d : d?.data || d || [])
    }).catch(() => {})
  }, [])

  useEffect(() => { const t = setTimeout(() => setAnimated(true), 150); return () => clearTimeout(t) }, [])

  /* Main dashboard data — refresh every 30s */
  const fetchDashboard = useCallback(() => {
    return getDashboard(period).then(d => { setData(d); setErr('') }).catch(e => setErr(e.message))
  }, [period])

  useEffect(() => {
    setLoading(true)
    fetchDashboard().finally(() => setLoading(false))
    const t = setInterval(() => fetchDashboard(), 30000)
    return () => clearInterval(t)
  }, [fetchDashboard])

  /* Attendance heatmap data — independent 60s poll */
  const fetchAttendanceHeatmap = useCallback(() => {
    Promise.all([
      getAttendance().catch(() => []),
      getHolidays().catch(() => []),
    ]).then(([att, hol]) => {
      const attArr = Array.isArray(att) ? att : att?.data || []
      const holArr = Array.isArray(hol) ? hol : hol?.data || []
      setAttendanceData(attArr)
      setHolidaysData(holArr)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    fetchAttendanceHeatmap()
    const t = setInterval(fetchAttendanceHeatmap, 60000)
    return () => clearInterval(t)
  }, [fetchAttendanceHeatmap])

  /* FRO live data on dashboard — independent 30s poll */
  const fetchFroLiveInline = useCallback(() => {
    getFroLiveStatus().then(d => setFroLiveData(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  useEffect(() => {
    fetchFroLiveInline()
    const t = setInterval(fetchFroLiveInline, 30000)
    return () => clearInterval(t)
  }, [fetchFroLiveInline])

  if (err) return <div className="sa-err-card">Error: {err}</div>
  if (!data) return (
    <div className="dash-page" style={{ maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <div className="sk" style={{ width: 200, height: 20, marginBottom: 8 }} />
          <div className="sk" style={{ width: 280, height: 12 }} />
        </div>
        <div className="sk" style={{ width: 140, height: 32, borderRadius: 6 }} />
      </div>
      <div className="metrics-grid">
        {[1, 2, 3, 4].map(i => <div key={i} className="clay-card"><div className="sk" style={{ height: 80 }} /></div>)}
      </div>
    </div>
  )

  const {
    stats = {}, deptWorkers = {}, ngoUserCounts = [],
    attendanceStatus = {}, attendanceWorkerCounts = {}, todayAttendance = {},
    kpiChanges = {}, attendancePercent = 0,
    recentNotices = [], upcomingEvents = [],
    // NEW data (backend can provide; safe defaults otherwise)
    attendanceDetails = {}, todayAttendanceDetails = {},
    froAssignments = [],      // [{ name: 'Ramesh', ngos: ['MAN', 'AFLF'] }]
    accountsSummary = {}, recruiterSummary = {},
    monthlyRevenue = [], topFros = [], topRecruiters = [], recentActivities = [],
    roleDistribution = {}, allTimeRoleDistribution = {}, totalSalaryPayable = 0,
  } = data

  const today = new Date()
  const hour = today.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr = today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const totalDonorsAmount = accountsSummary.verifiedAmount || accountsSummary.pendingAmount || 0
  const totalFroDonors = (stats.totalFroDonors || 0)
  const pendingVerifications = accountsSummary.pending ?? 0
  const bankAudits = accountsSummary.bankAudits ?? 0

  const CARD_COLORS = [
    { icon: '#3B82F6', bg: '#EFF6FF' },
    { icon: '#8B5CF6', bg: '#F5F3FF' },
    { icon: '#10B981', bg: '#ECFDF5' },
    { icon: '#F59E0B', bg: '#FFFBEB' },
    { icon: '#EC4899', bg: '#FDF2F8' },
    { icon: '#6366F1', bg: '#EEF2FF' },
  ]

  /* -------- metric cards -------- */
  const metricCards = [
    { label: 'Active Workers', value: stats.activeWorkers || 0, icon: 'bolt', changeKey: 'reach', color: CARD_COLORS[0] },

    { label: 'Total Donation', value: totalDonorsAmount, icon: 'payments', isCurrency: true, color: CARD_COLORS[2], changeKey: 'totalDonors' },
    { label: 'Pending Verif.', value: pendingVerifications, icon: 'hourglass_bottom', changeKey: 'pendingVerif', color: CARD_COLORS[4] },
    { label: 'Bank Audits', value: bankAudits, icon: 'account_balance', changeKey: 'bankAudits', color: CARD_COLORS[5] },
  ]

  /* -------- departments (from allTimeRoleDistribution / allUserList) -------- */
  const ROLE_LABELS = {
    super_admin: 'Super Admin', admin: 'Admin', hoadmin: 'HO Admin',
    inter: 'Intermediate', team_lead: 'Team Lead', hr: 'HR',
    recruiter: 'Recruiter', telecaller: 'Telecaller', fro: 'FRO',
    accounts: 'Accounts', leads: 'Leads', worker: 'Worker',
    ngo_admin: 'NGO Admin',
  }
  const HIDE_DEPTS = ['hr-recruitment', 'hr recruitment', 'hr_recruitment', 'hrrecruitment']
  const deptRaw = Object.keys(allTimeRoleDistribution || {}).length > 0
    ? allTimeRoleDistribution
    : (allUserList || []).reduce((acc, u) => {
        const role = (u.role || '').toLowerCase().trim()
        if (role) acc[role] = (acc[role] || 0) + 1
        return acc
      }, {})
  const deptData = Object.entries(deptRaw)
    .filter(([name]) => !HIDE_DEPTS.includes(name.toLowerCase().trim()))
    .map(([name, value]) => ({ name: ROLE_LABELS[name.toLowerCase().trim()] || name.charAt(0).toUpperCase() + name.slice(1), value }))
    .sort((a, b) => b.value - a.value)
  const totalDeptWorkers = deptData.reduce((s, d) => s + d.value, 0) || 1

  /* -------- attendance (today — daily check-ins) -------- */
  const hasTodayData = todayAttendance?.present !== undefined
  const attSrc = hasTodayData ? todayAttendance : attendanceWorkerCounts
  const detSrc = hasTodayData ? todayAttendanceDetails : attendanceDetails

  const attPresent = attSrc?.present ?? 0
  const attLate = attSrc?.late ?? 0
  const attAbsent = attSrc?.absent ?? 0

  const attSegments = []
  if (attPresent > 0) attSegments.push({ label: 'Present', value: attPresent, color: MINT, text: MINT_DEEP, icon: 'verified' })
  if (attLate > 0) attSegments.push({ label: 'Late', value: attLate, color: GOLD_LIGHT, text: '#9C6F14', icon: 'pace' })
  if (attAbsent > 0) attSegments.push({ label: 'Absent', value: attAbsent, color: BLUSH, text: RED_DEEP, icon: 'cancel' })

  function openAttendanceList(label) {
    const key = label.toLowerCase()
    const seg = attSegments.find(s => s.label === label)
    setModal({
      title: `${label} Workers`,
      color: seg?.text || PRIMARY,
      names: detSrc?.[key] || [],
    })
  }

  function openAbsentees() {
    setModal({
      title: 'Absent Workers',
      color: RED_DEEP,
      names: detSrc?.absent || [],
    })
  }

  /* -------- NGO wise FRO assignments -------- */
  const allNgoNames = [...new Set([
    ...ngoUserCounts.map(n => n.name),
    ...froAssignments.flatMap(f => f.ngos || []),
  ])]
  const ngoTotals = allNgoNames.map(name => ({
    name,
    count: froAssignments.filter(f => (f.ngos || []).includes(name)).length,
  }))

  return (
    <div className="dash-page" style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* ============ MINT DESIGN STYLES (single-file, scoped with nd-) ============ */}
      <style>{`
        .nd-card {
          background: #fff;
          border: 1px solid #DFEDE4;
          border-radius: 20px;
          padding: 22px;
          box-shadow: 0 1px 2px rgba(30,77,59,0.04), 0 8px 24px -12px rgba(30,77,59,0.08);
          transition: box-shadow 0.25s ease, transform 0.25s ease;
        }
        .nd-card:hover { box-shadow: 0 2px 4px rgba(30,77,59,0.05), 0 16px 32px -12px rgba(30,77,59,0.12); }
        .nd-section-title {
          font-size: 13px; font-weight: 700; color: ${MINT_DARK};
          text-transform: uppercase; letter-spacing: 1.2px; margin: 0;
        }
        .nd-muted { color: #94a3b8; font-size: 13px; margin: 8px 0 0; }
        .nd-appear { opacity: 0; transform: translateY(14px); animation: ndUp 0.55s cubic-bezier(0.22,1,0.36,1) forwards; }
        @keyframes ndUp { to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { .nd-appear { animation: none; opacity: 1; transform: none; } }

        /* metric cards */
        .nd-metric {
          position: relative; overflow: hidden;
        }
        .nd-metric::after {
          content: ''; position: absolute; right: -30px; top: -30px;
          width: 100px; height: 100px; border-radius: 50%;
          background: radial-gradient(circle, rgba(140,205,164,0.14), transparent 70%);
        }

        /* dept bar chart */
        .nd-bar-list { display: flex; flex-direction: column; gap: 14px; margin-top: 18px; }
        .nd-bar-row { display: flex; align-items: center; gap: 12px; }
        .nd-bar-label {
          width: 120px; font-size: 12.5px; font-weight: 700; color: ${PRIMARY};
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: right;
        }
        .nd-bar-track {
          flex: 1; height: 16px; background: #F1F5F2; border-radius: 99px; overflow: hidden;
        }
        .nd-bar-fill {
          height: 100%; border-radius: 99px;
          transition: width 0.9s cubic-bezier(0.22,1,0.36,1) 0.25s;
        }
        .nd-bar-value { width: 80px; font-size: 13px; font-weight: 800; color: ${PRIMARY}; }
        .nd-bar-value small { color: #94a3b8; font-weight: 600; margin-left: 5px; font-size: 11px; }
        .nd-bar-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }

        /* FRO assignment rows */
        .nd-fro-summary { display: flex; flex-wrap: wrap; gap: 10px; margin: 14px 0 6px; }
        .nd-fro-summary-pill {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 14px; border-radius: 12px; font-size: 12.5px; font-weight: 700;
        }
        .nd-fro-list { max-height: 340px; overflow-y: auto; margin-top: 12px; padding-right: 6px; }
        .nd-fro-row {
          display: flex; align-items: center; gap: 12px;
          padding: 11px 12px; border-radius: 14px;
          border: 1px solid #EAF3EC; margin-bottom: 8px;
          transition: background 0.15s ease;
        }
        .nd-fro-row:hover { background: ${MINT_LIGHT}; }
        .nd-fro-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-left: auto; }
        .nd-ngo-chip {
          font-size: 10.5px; font-weight: 700; letter-spacing: 0.3px;
          padding: 4px 10px; border-radius: 99px;
        }

        /* clickable attendance pills */
        .nd-att-pill {
          display: flex; align-items: center; gap: 10px; width: 100%;
          padding: 11px 14px; border-radius: 14px; border: 1px solid;
          background: transparent; cursor: pointer; text-align: left;
          font-family: inherit;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .nd-att-pill:hover { transform: translateX(3px); box-shadow: 0 4px 12px -6px rgba(30,77,59,0.15); }
        .nd-att-pill:focus-visible { outline: 2px solid ${MINT_DARK}; outline-offset: 2px; }

        /* scrollable notice & event lists */
        .nd-scroll-list {
          max-height: 300px; overflow-y: auto; padding-right: 6px;
          display: flex; flex-direction: column; gap: 12px; margin-top: 14px;
          scrollbar-width: thin;
        }
        .nd-scroll-list::-webkit-scrollbar { width: 5px; }
        .nd-scroll-list::-webkit-scrollbar-thumb { background: #CFE5D7; border-radius: 99px; }
        .nd-scroll-fade { position: relative; }
        .nd-scroll-fade::after {
          content: ''; position: absolute; left: 0; right: 10px; bottom: 0; height: 28px;
          background: linear-gradient(transparent, #fff); pointer-events: none; border-radius: 0 0 16px 16px;
        }

        .nd-notice {
          display: flex; gap: 12px; padding: 12px; border-radius: 14px;
          background: ${MINT_LIGHT}; border: 1px solid #DCEEE2;
        }
        .nd-notice-icon {
          width: 36px; height: 36px; border-radius: 11px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }

        .nd-event {
          display: flex; gap: 12px; align-items: center;
          padding: 11px 12px; border-radius: 14px; border: 1px solid #DCEEE2;
        }
        .nd-event-date {
          width: 46px; height: 50px; border-radius: 12px; flex-shrink: 0;
          background: #DBEAFE; color: #1E40AF;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
        }

        /* modal */
        .nd-modal-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(31,51,43,0.45); backdrop-filter: blur(3px);
          display: flex; align-items: center; justify-content: center; padding: 20px;
          animation: ndFade 0.2s ease;
        }
        @keyframes ndFade { from { opacity: 0; } to { opacity: 1; } }
        .nd-modal {
          background: #fff; border-radius: 22px; width: 100%; max-width: 420px;
          max-height: 75vh; display: flex; flex-direction: column; overflow: hidden;
          box-shadow: 0 24px 60px -12px rgba(31,51,43,0.35);
          animation: ndPop 0.3s cubic-bezier(0.22,1,0.36,1);
        }
        @keyframes ndPop { from { opacity: 0; transform: scale(0.94) translateY(10px); } to { opacity: 1; transform: none; } }
        .nd-modal-head {
          display: flex; align-items: center; gap: 12px;
          padding: 18px 20px; border-bottom: 1px solid;
        }
        .nd-modal-badge { font-size: 14px; font-weight: 800; padding: 6px 12px; border-radius: 10px; }
        .nd-modal-title { margin: 0; flex: 1; font-size: 15px; font-weight: 700; color: ${PRIMARY}; }
        .nd-modal-close {
          border: none; background: ${MINT_LIGHT}; border-radius: 10px; width: 32px; height: 32px;
          display: flex; align-items: center; justify-content: center; cursor: pointer; color: #64748b;
        }
        .nd-modal-close:hover { background: #DCEEE2; }
        .nd-modal-body { overflow-y: auto; padding: 12px 16px 18px; }
        .nd-modal-row {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 8px; border-bottom: 1px solid #F0F7F2;
        }
        .nd-modal-row:last-child { border-bottom: none; }
        .nd-avatar {
          width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 14px;
        }
        .nd-modal-name { display: block; font-size: 13.5px; font-weight: 600; color: ${PRIMARY}; }
        .nd-modal-dept { display: block; font-size: 11px; color: #94a3b8; }
        .nd-modal-time { margin-left: auto; font-size: 11.5px; color: #64748b; font-weight: 600; }

        /* modal search */
        .nd-modal-search {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 12px; margin-bottom: 8px;
          border: 1px solid #DCEEE2; border-radius: 12px;
          background: #F6FAF7; transition: border-color 0.2s;
        }
        .nd-modal-search:focus-within { border-color: ${MINT}; background: #fff; }
        .nd-modal-search-icon { font-size: 18px; color: #94a3b8; }
        .nd-modal-search-input {
          flex: 1; border: none; background: transparent;
          font-size: 13px; font-family: inherit; color: ${PRIMARY};
          outline: none;
        }
        .nd-modal-search-input::placeholder { color: #b6c0cc; }
        .nd-modal-search-clear {
          border: none; background: transparent; cursor: pointer;
          color: #94a3b8; padding: 2px; display: flex;
        }
        .nd-modal-search-clear:hover { color: #64748b; }

        /* mini cards for accounts / recruiter */
        .mini-card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
        .mini-card {
          background: #F6FAF7; border-radius: 14px; padding: 14px 16px;
          display: flex; flex-direction: column; gap: 2px;
          border: 1px solid #DCEEE2;
        }
        .mini-card-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
        .mini-card-value { font-size: 26px; font-weight: 800; color: ${PRIMARY}; line-height: 1.2; }
        .mini-card-sub { font-size: 12px; color: #64748b; font-weight: 600; }
        .ps-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .ps-card {
          background: #F6FAF7; border-radius: 14px; padding: 14px 16px;
          display: flex; flex-direction: column; gap: 2px;
          border: 1px solid #DCEEE2;
        }
        .ps-label { font-size: 12px; font-weight: 700; color: #94a3b8; }
        .ps-value { font-size: 24px; font-weight: 800; color: ${PRIMARY}; line-height: 1.2; }
        .ps-sub { font-size: 11px; color: #64748b; font-weight: 600; }
        .mini-card-clickable { cursor: pointer; transition: box-shadow 0.2s, transform 0.15s; }
        .mini-card-clickable:hover { box-shadow: 0 4px 12px rgba(30,77,59,0.10); transform: translateY(-1px); }
        .lead-status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
        .lead-status-dot.scheduled { background: ${SLATE}; }
        .lead-status-dot.verified { background: ${MINT_DEEP}; }
        .lead-status-dot.selected { background: ${MINT_DEEP}; }
        .lead-status-dot.rejected { background: ${RED_DEEP}; }
        .lead-status-dot.pending { background: ${GOLD}; }
        .lead-status-dot.contacted { background: ${MINT_DARK}; }
        .lead-status-dot.follow_up { background: ${GOLD_LIGHT}; }

        /* Panel link cards — uniform mint design */
        .panel-link-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 14px;
          margin-top: 20px;
          margin-bottom: 24px;
        }
        .panel-link-card {
          background: #fff;
          border: 1px solid #DCEEE2;
          border-left: 4px solid ${MINT};
          border-radius: 12px; padding: 12px 14px; cursor: pointer;
          display: flex; flex-direction: column; gap: 2px;
          color: ${PRIMARY};
          transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
          animation: ndUp 0.5s cubic-bezier(0.22,1,0.36,1) forwards;
          opacity: 0; box-shadow: 0 2px 8px rgba(30,77,59,0.06);
        }
        .panel-link-card:nth-child(1) { animation-delay: 0.1s; }
        .panel-link-card:nth-child(2) { animation-delay: 0.15s; }
        .panel-link-card:nth-child(3) { animation-delay: 0.2s; }
        .panel-link-card:nth-child(4) { animation-delay: 0.25s; }
        .panel-link-card:nth-child(5) { animation-delay: 0.3s; }
        .panel-link-card:hover { transform: translateY(-3px); background: #FAFBFC; box-shadow: 0 8px 20px rgba(30,77,59,0.12); }
        .panel-link-card .material-symbols-outlined {
          font-size: 18px;
          width: 32px; height: 32px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
        }
        .panel-link-label { font-size: 14px; font-weight: 800; letter-spacing: -0.3px; color: ${MINT_DARK}; }
        .panel-link-sub { font-size: 10px; color: #5F7269; font-weight: 500; }

        /* ALL FRO card */
        .nd-fro-card { border: 1px solid rgba(30,77,59,0.15); transition: border-color 0.2s, box-shadow 0.2s; cursor: pointer; }
        .nd-fro-card:hover { border-color: rgba(30,77,59,0.4); box-shadow: 0 2px 4px rgba(30,77,59,0.08), 0 8px 24px -12px rgba(30,77,59,0.15); }

        /* FRO Live Modal - wider */
        .fro-modal { max-width: 800px !important; }

        /* FRO Live Panel */
        .fro-live-panel { animation: ndUp 0.4s cubic-bezier(0.22,1,0.36,1) forwards; }
        .fro-live-header {
          display: flex; justify-content: space-between; align-items: center;
          padding-bottom: 14px; border-bottom: 1px solid #EAF3EC; margin-bottom: 4px;
        }
        .fro-live-table-wrap {
          overflow: auto; max-height: 60vh;
        }
        .fro-live-table {
          width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px;
        }
        .fro-live-table thead { position: sticky; top: 0; z-index: 2; }
        .fro-live-table th {
          position: sticky; top: 0; z-index: 2;
          text-align: left; padding: 12px 10px; font-size: 11px; font-weight: 700;
          color: #94a3b8; text-transform: uppercase; letter-spacing: 0.6px;
          border-bottom: 1px solid #EAF3EC; white-space: nowrap;
          background: #fff;
        }
        .fro-live-table td {
          padding: 10px; border-bottom: 1px solid #F0F7F2; vertical-align: middle;
        }
        .fro-live-table tbody tr:hover { background: ${MINT_LIGHT}; }
        .fro-table-wrap {
          overflow: auto; max-height: 55vh;
        }
        .fro-table {
          width: 100%; border-collapse: collapse; font-size: 13px;
        }
        .fro-table thead { position: sticky; top: 0; z-index: 2; }
        .fro-table th {
          position: sticky; top: 0; z-index: 2;
          text-align: left; padding: 10px 10px; font-size: 11px; font-weight: 700;
          color: #94a3b8; text-transform: uppercase; letter-spacing: 0.6px;
          border-bottom: 1px solid #EAF3EC; white-space: nowrap;
          background: #fff;
        }
        .fro-table td {
          padding: 9px 10px; border-bottom: 1px solid #F0F7F2; vertical-align: middle;
        }
        .fro-table tbody tr:hover { background: ${MINT_LIGHT}; }
        .fro-name { display: block; font-weight: 700; color: ${PRIMARY}; }
        .fro-login-id { display: block; font-size: 11px; color: #94a3b8; margin-top: 1px; }
        .fro-status-dot {
          display: inline-block; width: 8px; height: 8px; border-radius: 50%;
          margin-right: 6px; vertical-align: middle;
        }
        .fro-status-dot.active { background: ${MINT}; box-shadow: 0 0 0 2px rgba(140,205,164,0.3); }
        .fro-status-dot.inactive { background: #e2e8f0; }
        .fro-badge {
          display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 10px;
          border-radius: 99px;
        }
        .fro-badge-green { background: rgba(140,205,164,0.18); color: ${MINT_DEEP}; }
        .fro-badge-red { background: rgba(247,178,173,0.25); color: ${RED_DEEP}; }
        .fro-num { font-size: 14px; font-weight: 700; color: ${PRIMARY}; }
        .fro-amt { color: ${MINT_DEEP}; }
        .fro-live-footer {
          border-top: 1px solid #EAF3EC; padding-top: 12px; margin-top: 4px;
          display: flex; justify-content: flex-end;
        }
        .fro-refresh-btn {
          border: none; background: ${MINT_LIGHT}; border-radius: 8px; width: 30px; height: 30px;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
          color: #64748b; font-size: 13px; font-family: inherit;
        }
        .fro-refresh-btn:hover { background: #DCEEE2; }
        .fro-spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* FRO mini cards on dashboard */
        .fro-mini-card {
          background: #fff;
          border: 1px solid #DCEEE2;
          border-radius: 14px;
          padding: 14px 16px;
          cursor: pointer;
          transition: box-shadow 0.2s ease, transform 0.15s ease;
        }
        .fro-mini-card:hover {
          box-shadow: 0 4px 14px rgba(30,77,59,0.10);
          transform: translateY(-2px);
        }
      `}</style>

      {/* ============ HEADER ============ */}
      <div className="dash-header">
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#3B82F6', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {greeting} · {dateStr}
          </span>
          <h2 className="dash-header-title" style={{ marginTop: 2, color: '#000' }}>Dashboard Overview</h2>
          <p className="dash-header-sub">Operational insights across all NGOs and departments.</p>
        </div>
        <div className="dash-header-actions">
          <div className="dash-period-bar">
            {PERIODS.map(p => (
              <button
                key={p.key}
                className={`dash-period-btn${period === p.key ? ' active' : ''}`}
                disabled={loading}
                onClick={() => setPeriod(p.key)}
              >
                {loading && period === p.key ? '\u25c9 ' : ''}{p.label}
              </button>
            ))}
          </div>
          <button
            className="btn btn-primary btn-sm"
            style={{ background: MINT_DARK, borderColor: MINT_DARK }}
            onClick={() => exportToExcel(data, period)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'text-bottom', marginRight: 4 }}>download</span>
            Export Report
          </button>
        </div>
      </div>

      {/* ============ NGO QUICK FILTER BUTTONS ============ */}
      {ngoUserCounts.length > 0 && (
        <div className="nd-appear" style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', animationDelay: '0.5s' }}>
          {['bsct', 'aflf', 'man'].map(prefix => ngoUserCounts.find(n => n.name.toLowerCase().startsWith(prefix))).filter(Boolean).map((n, i) => {
            const nc = ngoColor(n.name)
            const isActive = selectedNgoBtn === n.name
            return (
              <button
                key={n.name}
                onClick={() => setSelectedNgoBtn(isActive ? null : n.name)}
                style={{
                  padding: '6px 16px', borderRadius: 20, border: `2px solid ${nc}`,
                  background: nc, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  color: '#fff', fontFamily: 'inherit', transition: 'all 0.15s', lineHeight: 1.4,
                  display: 'flex', alignItems: 'center', gap: 6, opacity: isActive ? 1 : 0.75,
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.opacity = '0.75' }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: nc, flexShrink: 0 }} />
                {n.name}
                <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.6 }}>{n.workers || n.count || 0}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* ============ QUICK ACTION BUTTONS ============ */}
      <div className="nd-appear" style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', animationDelay: '0.05s' }}>
        <button
          onClick={() => navigate('/sa/events')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 10, flex: 1,
            border: '1px solid #DCEEE2', background: '#fff',
            color: MINT_DARK, fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'box-shadow 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#14B8A6' }}>add_circle</span>
          Add Event
        </button>
        <button
          onClick={() => navigate('/sa/notices')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 10, flex: 1,
            border: '1px solid #DCEEE2', background: '#fff',
            color: MINT_DARK, fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'box-shadow 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#3B82F6' }}>campaign</span>
          Create Notice
        </button>
        <button
          onClick={() => setShowFroNestedModal(true)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 1,
            padding: '8px 16px', borderRadius: 10,
            border: '1px solid #DCEEE2', background: '#fff',
            color: MINT_DARK, fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'box-shadow 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#EC4899' }}>visibility</span>
          View All FRO
        </button>
        <button
          onClick={() => openAttendanceList('Present')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 10, flex: 1,
            border: '1px solid #DCEEE2', background: '#fff',
            color: MINT_DARK, fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'box-shadow 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#22C55E' }}>verified</span>
          Present {attPresent > 0 && <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.7 }}>({attPresent})</span>}
        </button>
        <button
          onClick={() => openAttendanceList('Late')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 10, flex: 1,
            border: '1px solid #DCEEE2', background: '#fff',
            color: MINT_DARK, fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'box-shadow 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#F59E0B' }}>pace</span>
          Late {attLate > 0 && <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.7 }}>({attLate})</span>}
        </button>
      </div>

      {/* ============ LOW ATTENDANCE ALERT (clickable, slim) ============ */}
      {attendancePercent < 60 && (
        <div
          className="nd-appear"
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'rgba(247,178,173,0.20)',
            border: '1px solid #F2C0BA',
            borderRadius: 12, padding: '8px 16px', marginBottom: 20,
            animationDelay: '0.05s',
          }}
        >
          <div style={{
            width: 30, height: 30, borderRadius: 9, flexShrink: 0,
            background: 'rgba(247,178,173,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ color: RED_DEEP, fontSize: 18 }}>warning</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ fontSize: 13, color: PRIMARY, display: 'block' }}>
              Attendance is low — {attendancePercent}%
            </strong>
            <span style={{ fontSize: 11.5, color: '#64748b' }}>
              {attAbsent > 0 ? `${attAbsent} worker(s) absent` : 'Attendance dropped below 60% for the selected period.'}
            </span>
          </div>
          <button
            onClick={openAbsentees}
            style={{
              border: `1px solid ${RED_DEEP}`, background: RED_DEEP, color: '#fff',
              borderRadius: 10, padding: '6px 14px', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
            }}
          >
            View absentees
          </button>
        </div>
      )}

      {/* ============ METRIC CARDS ============ */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {metricCards.map((card, i) => {
          const kpiStages = [
            { label: 'Active', value: Math.round((card.value || 0) * 0.8), color: MINT },
            { label: 'Pending', value: Math.round((card.value || 0) * 0.2), color: GOLD },
          ]
          return (
            <div
              key={card.label}
              className="nd-card nd-metric nd-appear"
              style={{ animationDelay: `${0.08 * (i + 1)}s`, cursor: 'pointer', padding: '12px 16px' }}
              onClick={() => setKpiModal({ title: card.label, stages: kpiStages, color: card.color?.icon || MINT_DEEP })}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  {card.label}
                </span>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: card.color?.bg || MINT_LIGHT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span className="material-symbols-outlined" style={{ color: card.color?.icon || MINT_DARK, fontSize: 15 }}>{card.icon}</span>
                </div>
              </div>
              <div style={{ marginTop: 6 }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: PRIMARY, lineHeight: 1 }}>
                  {card.isCurrency ? (
                    <>₹{(Number(card.value) / 100000).toFixed(1)}<span style={{ fontSize: 12, fontWeight: 600 }}>L</span></>
                  ) : (
                    <AnimatedNum to={typeof card.value === 'number' ? card.value : 0} />
                  )}
                </span>
                <div style={{ fontSize: 10, color: card.color?.icon || MINT_DARK, fontWeight: 600, marginTop: 2 }}>
                  {card.isCurrency ? 'Total donation value' : `${card.label} across all departments`}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ============ PANEL LINKS — uniform mint cards ============ */}
      <div className="panel-link-grid">
        <div className="panel-link-card" style={{ borderLeftColor: '#8B5CF6' }} onClick={() => {
          const accUsers = allUserList.filter(u => u.role === 'accounts')
          setDeptModal({ title: 'Accounts', names: accUsers.length > 0 ? accUsers.map(u => u.name || u.login_id || 'Unknown') : ['No accounts users found'] })
        }}>
          <span className="material-symbols-outlined" style={{ background: '#F5F3FF', color: '#8B5CF6' }}>receipt_long</span>
          <span className="panel-link-label" style={{ color: '#8B5CF6' }}>Accounts</span>
          <span className="panel-link-sub">{allUserList.filter(u => u.role === 'accounts').length || 0} workers</span>
        </div>
        <div className="panel-link-card" style={{ borderLeftColor: '#EC4899' }} onClick={() => {
          const users = allUserList.filter(u => u.role === 'fro')
          setDeptModal({ title: 'FRO', names: users.length > 0 ? users.map(u => u.name || u.login_id || 'Unknown') : ['No FRO users found'] })
        }}>
          <span className="material-symbols-outlined" style={{ background: '#FDF2F8', color: '#EC4899' }}>groups</span>
          <span className="panel-link-label" style={{ color: '#EC4899' }}>FRO</span>
          <span className="panel-link-sub">{allUserList.filter(u => u.role === 'fro').length || froLiveData.length} workers</span>
        </div>
        <div className="panel-link-card" style={{ borderLeftColor: '#3B82F6' }} onClick={() => {
          const users = allUserList.filter(u => u.role === 'hr' || u.role === 'hoadmin')
          setDeptModal({ title: 'HR', names: users.length > 0 ? users.map(u => u.name || u.login_id || 'Unknown') : ['No HR users found'] })
        }}>
          <span className="material-symbols-outlined" style={{ background: '#EFF6FF', color: '#3B82F6' }}>badge</span>
          <span className="panel-link-label" style={{ color: '#3B82F6' }}>HR</span>
          <span className="panel-link-sub">{allUserList.filter(u => u.role === 'hr' || u.role === 'hoadmin').length || 0} workers</span>
        </div>
        <div className="panel-link-card" style={{ borderLeftColor: '#F59E0B' }} onClick={() => {
          const users = allUserList.filter(u => u.role === 'admin' || u.role === 'ngo_admin')
          setDeptModal({ title: 'NGO Admin', names: users.length > 0 ? users.map(u => u.name || u.login_id || 'Unknown') : ['No NGO Admin users found'] })
        }}>
          <span className="material-symbols-outlined" style={{ background: '#FFFBEB', color: '#F59E0B' }}>corporate_fare</span>
          <span className="panel-link-label" style={{ color: '#F59E0B' }}>NGO Admin</span>
          <span className="panel-link-sub">{allUserList.filter(u => u.role === 'admin' || u.role === 'ngo_admin').length || 0} workers</span>
        </div>
        <div className="panel-link-card" style={{ borderLeftColor: '#10B981' }} onClick={() => {
          const users = allUserList.filter(u => u.role === 'recruiter')
          setDeptModal({ title: 'Recruiter', names: users.length > 0 ? users.map(u => u.name || u.login_id || 'Unknown') : ['No Recruiter users found'] })
        }}>
          <span className="material-symbols-outlined" style={{ background: '#ECFDF5', color: '#10B981' }}>person_search</span>
          <span className="panel-link-label" style={{ color: '#10B981' }}>Recruiter</span>
          <span className="panel-link-sub">{allUserList.filter(u => u.role === 'recruiter').length || 0} workers</span>
        </div>
      </div>

      {/* ============ DEPARTMENTS OVERVIEW ============ */}
      {deptData.length > 0 && (
        <div className="nd-card nd-appear" style={{ animationDelay: '0.2s', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: MINT_DEEP }}>business</span>
            <h3 className="nd-section-title" style={{ margin: 0 }}>Departments</h3>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
              {totalDeptWorkers} workers
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {deptData.map((d, i) => {
              const color = DEPT_COLORS[i % DEPT_COLORS.length]
              return (
                <div
                  key={d.name}
                  onClick={() => setDeptModal({ title: d.name, names: [`${d.name}: ${d.value} workers`] })}
                  style={{
                    background: `${color}12`, borderRadius: 10, padding: '12px 14px',
                    cursor: 'pointer', border: `1px solid ${color}30`,
                    transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1.2 }}>{d.value}</div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginTop: 2 }}>{d.name}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ============ NGO ADMIN OVERVIEW ============ */}
      <div className="nd-card nd-appear" style={{ animationDelay: '0.25s', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: GOLD }}>corporate_fare</span>
          <h3 className="nd-section-title" style={{ margin: 0 }}>NGO Admin — Overview</h3>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
            {ngoUserCounts.length} NGOs
          </span>
        </div>
        {ngoUserCounts.length === 0 ? (
          <p className="nd-muted">No NGO data available</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ cursor: 'pointer' }} onClick={() => ngoUserCounts.length === 1 && setNgoStationModal(ngoUserCounts[0].name)}>
                <DonutChart
                  segments={ngoUserCounts.map((n, i) => ({
                    label: n.name, value: n.workers || n.count || 1,
                    color: NGO_PALETTE[i % NGO_PALETTE.length],
                  }))}
                  size={140}
                  centerValue={ngoUserCounts.reduce((s, n) => s + (n.workers || n.count || 0), 0)}
                  centerLabel="Total"
                  animated={animated}
                  onSegmentClick={(label) => setNgoStationModal(label)}
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ngoUserCounts.slice(0, 8).map((n, i) => {
                const total = ngoUserCounts.reduce((s, x) => s + (x.workers || x.count || 0), 0) || 1
                const pct = Math.round(((n.workers || n.count || 0) / total) * 100)
                const c = NGO_PALETTE[i % NGO_PALETTE.length]
                const dotColor = ['man','aflf','bsct'].some(pre => n.name.toLowerCase().startsWith(pre)) ? ngoColor(n.name) : c
                return (
                  <div key={n.name} onClick={() => setNgoStationModal(n.name)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '3px 6px', borderRadius: 8, transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = MINT_LIGHT} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: ['man','aflf','bsct'].some(pre => n.name.toLowerCase().startsWith(pre)) ? ngoColor(n.name) : PRIMARY, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</span>
                    <div style={{ width: 60, height: 6, background: '#F1F5F2', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: dotColor, borderRadius: 99 }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', minWidth: 30, textAlign: 'right' }}>{n.workers || n.count || 0}</span>
                    <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#94a3b8' }}>chevron_right</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ============ MAIN GRID ============ */}
      <div className="dash-grid">
        <div className="dash-grid-main">

        </div>

        <div className="dash-grid-side">

    

        </div>
      </div>

      {/* ---- FRO PERFORMANCE OVERVIEW ---- */}
      {froLiveData.length > 0 && (
        <div className="nd-card nd-appear" style={{ animationDelay: '0.65s', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#000' }}>monitoring</span>
            <h3 className="nd-section-title" style={{ margin: 0, color: '#000' }}>FRO Performance — Today</h3>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
              {froLiveData.reduce((s, f) => s + (f.today_calls || 0), 0)} total calls
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14 }}>
            <div style={{ padding: '10px 12px', borderRadius: 10, background: '#E8F5E9' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Collection</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: MINT_DEEP }}>₹{froLiveData.reduce((s, f) => s + Number(f.today_collection || 0), 0).toLocaleString('en-IN')}</div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 10, background: '#E3F2FD' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Active FROs</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#1E88E5' }}>{froLiveData.filter(f => f.is_active).length}</div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 10, background: '#F3E5F5' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Data Used</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#8E24AA' }}>{froLiveData.reduce((s, f) => s + Number(f.data_used || 0), 0)}</div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FFF8E1' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Avg Collection</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#F57C00' }}>
                ₹{froLiveData.length > 0 ? Math.round(froLiveData.reduce((s, f) => s + Number(f.today_collection || 0), 0) / froLiveData.length).toLocaleString('en-IN') : 0}
              </div>
            </div>
          </div>
          <div style={{ height: Math.max(160, Math.min(froLiveData.length * 20, 300)) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={froLiveData.map(f => ({
                name: (f.workers?.name || f.login_id || 'Unknown').replace(/_.*$/, ''),
                collection: Number(f.today_collection || 0),
              })).sort((a, b) => a.name.localeCompare(b.name))} margin={{ top: 10, right: 16, bottom: 40, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b', angle: -45, textAnchor: 'end' }} interval={0} height={60} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickFormatter={(v) => v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(0)}K` : `₹${v}`}
                />
                <Tooltip formatter={(v) => [`₹${v.toLocaleString('en-IN')}`, 'Collection']} />
                <Bar dataKey="collection" fill="#64B5F6" radius={[4, 4, 0, 0]} animationDuration={800} animationBegin={200} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {froLiveData.filter(f => Number(f.today_calls || 0) > 0).length > 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
              <div style={{ padding: '8px 12px', borderRadius: 10, background: '#f8fafb', border: '1px solid #eaf3ec' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Top Collector</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>
                  {froLiveData.reduce((best, f) => Number(f.today_collection || 0) > Number(best.today_collection || 0) ? f : best, froLiveData[0])?.workers?.name || '—'}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: MINT_DEEP }}>
                  ₹{froLiveData.reduce((best, f) => Number(f.today_collection || 0) > Number(best.today_collection || 0) ? f : best, froLiveData[0]).today_collection?.toLocaleString('en-IN') || 0}
                </div>
              </div>
              <div style={{ padding: '8px 12px', borderRadius: 10, background: '#f8fafb', border: '1px solid #eaf3ec' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Most Calls</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>
                  {froLiveData.reduce((best, f) => (f.today_calls || 0) > (best.today_calls || 0) ? f : best, froLiveData[0])?.workers?.name || '—'}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: PRIMARY }}>
                  {froLiveData.reduce((best, f) => (f.today_calls || 0) > (best.today_calls || 0) ? f : best, froLiveData[0]).today_calls || 0} calls
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ ACCOUNTS SUMMARY ============ */}
      {accountsSummary.pending !== undefined && (
        <div className="nd-card nd-appear" style={{ animationDelay: '0.2s', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#0284c7' }}>receipt_long</span>
            <h3 className="nd-section-title" style={{ margin: 0 }}>Accounts — Lead Verification Pipeline</h3>
          </div>
          <PipelineFlow stages={[
            { label: 'Pending', value: accountsSummary.pending ?? 0, sub: `₹${(accountsSummary.pendingAmount || 0).toLocaleString('en-IN')}`, color: '#38bdf8' },
            { label: 'Verified', value: accountsSummary.verified ?? 0, sub: `₹${(accountsSummary.verifiedAmount || 0).toLocaleString('en-IN')}`, color: '#a78bfa' },
            { label: 'Rejected', value: accountsSummary.rejected ?? 0, sub: `₹${(accountsSummary.rejectedAmount || 0).toLocaleString('en-IN')}`, color: '#f472b6' },
            { label: 'Today', value: accountsSummary.verifiedToday ?? 0, sub: `₹${(accountsSummary.verifiedTodayAmount || 0).toLocaleString('en-IN')}`, color: '#fbbf24' },
          ]} height={50} />
          <div className="mini-card-grid" style={{ marginTop: 8 }}>
            <div className="mini-card mini-card-clickable" style={{ borderLeft: `3px solid #38bdf8`, paddingLeft: 13, background: '#fff' }} onClick={() => setAccountsModalStatus('pending')}>
              <span className="mini-card-label">Pending</span>
              <span className="mini-card-value">{accountsSummary.pending ?? 0}</span>
              <span className="mini-card-sub">₹{(accountsSummary.pendingAmount || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="mini-card mini-card-clickable" style={{ borderLeft: `3px solid #a78bfa`, paddingLeft: 13, background: '#fff' }} onClick={() => setAccountsModalStatus('verified')}>
              <span className="mini-card-label">Verified</span>
              <span className="mini-card-value">{accountsSummary.verified ?? 0}</span>
              <span className="mini-card-sub">₹{(accountsSummary.verifiedAmount || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="mini-card mini-card-clickable" style={{ borderLeft: `3px solid #f472b6`, paddingLeft: 13, background: '#fff' }} onClick={() => setAccountsModalStatus('rejected')}>
              <span className="mini-card-label">Rejected</span>
              <span className="mini-card-value">{accountsSummary.rejected ?? 0}</span>
              <span className="mini-card-sub">₹{(accountsSummary.rejectedAmount || 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="mini-card mini-card-clickable" style={{ borderLeft: `3px solid #fbbf24`, paddingLeft: 13, background: '#fff' }} onClick={() => setAccountsModalStatus('verified_today')}>
              <span className="mini-card-label">Verified Today</span>
              <span className="mini-card-value">{accountsSummary.verifiedToday ?? 0}</span>
              <span className="mini-card-sub">₹{(accountsSummary.verifiedTodayAmount || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}

      {/* ============ REVENUE TREND CHART ============ */}
      <div className="nd-card nd-appear" style={{ animationDelay: '0.22s', marginBottom: 20, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#14B8A6' }}>trending_up</span>
          <h3 className="nd-section-title" style={{ margin: 0, color: '#000' }}>Revenue Overview</h3>
        </div>
        {(() => {
          const amounts = [
            { label: 'Pending', amount: accountsSummary.pendingAmount || 0, color: '#F59E0B' },
            { label: 'Verified', amount: accountsSummary.verifiedAmount || 0, color: '#3B82F6' },
            { label: 'Rejected', amount: accountsSummary.rejectedAmount || 0, color: '#EF4444' },
            { label: 'Verified Today', amount: accountsSummary.verifiedTodayAmount || 0, color: '#8B5CF6' },
          ]
          const max = Math.max(...amounts.map(a => a.amount), 1)
          const barMaxHeight = 140
          return (
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: barMaxHeight + 40, gap: 12 }}>
              {amounts.map(a => {
                const h = (a.amount / max) * barMaxHeight
                return (
                  <div key={a.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: a.color, marginBottom: 4 }}>
                      ₹{(a.amount).toLocaleString('en-IN')}
                    </span>
                    <div style={{
                      width: '100%', maxWidth: 80, height: h || 4,
                      background: a.color, borderRadius: '6px 6px 0 0',
                      transition: 'height 0.6s ease',
                      minHeight: 4,
                    }} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginTop: 6, textAlign: 'center' }}>
                      {a.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* ============ 3-COL GRID: Monthly Revenue + Top Performers + Recent Activity ============ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 20 }}>

        {/* ---- MONTHLY REVENUE TREND (line chart) ---- */}
        <div className="nd-card nd-appear" style={{ animationDelay: '0.28s', gridColumn: 'span 1', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#14B8A6' }}>monitoring</span>
            <h3 className="nd-section-title" style={{ margin: 0, color: '#000' }}>Monthly Revenue</h3>
          </div>
          {monthlyRevenue.length === 0 ? (
            <p className="nd-muted">No revenue data yet</p>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', position: 'relative', height: 160, paddingTop: 16 }}>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                {(() => {
                  const max = Math.max(...monthlyRevenue.map(m => m.amount), 1)
                  const pts = monthlyRevenue.map((m, i) => {
                    const x = (i / (monthlyRevenue.length - 1 || 1)) * 100
                    const y = 95 - (m.amount / max) * 85
                    return `${x},${y}`
                  })
                  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p}`).join(' ')
                  const areaD = pts.length > 0 ? `${d} L${pts[pts.length - 1].split(',')[0]},95 L${pts[0].split(',')[0]},95 Z` : ''
                  return (
                    <>
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#14B8A6" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#14B8A6" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <path d={areaD} fill="url(#revenueGrad)" />
                      <path d={d} fill="none" stroke="#14B8A6" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                      {pts.map((p, i) => {
                        const [cx, cy] = p.split(',')
                        return i % 2 === 0 || i === pts.length - 1 ? (
                          <circle key={i} cx={cx} cy={cy} r={1.8} fill="#fff" stroke="#14B8A6" strokeWidth={0.8} />
                        ) : null
                      })}
                    </>
                  )
                })()}
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: 'auto', paddingTop: 8 }}>
                {monthlyRevenue.map((m, i) => (
                  <div key={m.month} style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', display: 'block', whiteSpace: 'nowrap' }}>
                      {i % 2 === 0 || i === monthlyRevenue.length - 1 ? (() => {
                        const [y, mo] = m.month.split('-')
                        const months = ['J','F','M','A','M','J','J','A','S','O','N','D']
                        return `${months[parseInt(mo) - 1]}'${y.slice(2)}`
                      })() : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px solid #DEE9E1' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>
              Total: ₹{monthlyRevenue.reduce((s, m) => s + m.amount, 0).toLocaleString('en-IN')}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#14B8A6' }}>
              Avg: ₹{monthlyRevenue.length > 0 ? Math.round(monthlyRevenue.reduce((s, m) => s + m.amount, 0) / monthlyRevenue.length).toLocaleString('en-IN') : 0}
            </span>
          </div>
        </div>

        {/* ---- TOP PERFORMERS ---- */}
        <div className="nd-card nd-appear" style={{ animationDelay: '0.33s', gridColumn: 'span 1', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#F59E0B' }}>emoji_events</span>
            <h3 className="nd-section-title" style={{ margin: 0, color: '#000' }}>Top Performers</h3>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {topFros.length === 0 && topRecruiters.length === 0 ? (
              <p className="nd-muted">No performer data yet</p>
            ) : (
              <>
                {topFros.length > 0 && (
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#EC4899', textTransform: 'uppercase', letterSpacing: 0.6 }}>Top FROs by Collection</span>
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {topFros.map((f, i) => {
                        const colors = ['#F59E0B', '#14B8A6', '#3B82F6', '#8B5CF6', '#64748b']
                        const c = colors[i] || '#94a3b8'
                        const maxAmt = Math.max(...topFros.map(x => x.totalCollection), 1)
                        const pct = (f.totalCollection / maxAmt) * 100
                        return (
                          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 18, height: 18, borderRadius: '50%', background: `${c}18`, color: c, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {i + 1}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#1F332B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                                <span style={{ fontSize: 12, fontWeight: 800, color: c }}>₹{f.totalCollection.toLocaleString('en-IN')}</span>
                              </div>
                              <div style={{ width: '100%', height: 6, background: '#F1F5F2', borderRadius: 99, marginTop: 4, overflow: 'hidden' }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: c, borderRadius: 99, transition: 'width 0.6s ease' }} />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {topRecruiters.length > 0 && (
                  <div style={{ marginTop: topFros.length > 0 ? 12 : 0, paddingTop: topFros.length > 0 ? 12 : 0, borderTop: topFros.length > 0 ? '1px solid #DEE9E1' : 'none' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#3B82F6', textTransform: 'uppercase', letterSpacing: 0.6 }}>Top Recruiters by Leads</span>
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {topRecruiters.map((r, i) => {
                        const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899']
                        const c = colors[i] || '#94a3b8'
                        const maxLead = Math.max(...topRecruiters.map(x => x.leadCount), 1)
                        const pct = (r.leadCount / maxLead) * 100
                        return (
                          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 18, height: 18, borderRadius: '50%', background: `${c}18`, color: c, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {i + 1}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#1F332B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                                <span style={{ fontSize: 12, fontWeight: 800, color: c }}>{r.leadCount}</span>
                              </div>
                              <div style={{ width: '100%', height: 6, background: '#F1F5F2', borderRadius: 99, marginTop: 4, overflow: 'hidden' }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: c, borderRadius: 99, transition: 'width 0.6s ease' }} />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ---- RECENT ACTIVITY LOG ---- */}
        <div className="nd-card nd-appear" style={{ animationDelay: '0.38s', gridColumn: 'span 1', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#8B5CF6' }}>history</span>
            <h3 className="nd-section-title" style={{ margin: 0, color: '#000' }}>Recent Activity</h3>
            {recentActivities.length > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, color: '#8B5CF6', background: 'rgba(139,92,246,0.12)', borderRadius: 99, padding: '2px 8px', marginLeft: 'auto' }}>
                {recentActivities.length}
              </span>
            )}
          </div>
          {recentActivities.length === 0 ? (
            <p className="nd-muted">No recent activity</p>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
              {recentActivities.map((a, i) => {
                const iconMap = {
                  verified: { icon: 'check_circle', bg: '#ECFDF5', color: '#10B981' },
                  rejected: { icon: 'cancel', bg: '#FEF2F2', color: '#EF4444' },
                  lead_created: { icon: 'person_add', bg: '#EFF6FF', color: '#3B82F6' },
                  worker_joined: { icon: 'how_to_reg', bg: '#F5F3FF', color: '#8B5CF6' },
                  notification: { icon: 'notifications', bg: '#FFFBEB', color: '#F59E0B' },
                }
                const meta = iconMap[a.type] || { icon: 'circle', bg: '#F1F5F2', color: '#94a3b8' }
                const timeStr = a.time
                  ? (() => {
                      const d = new Date(a.time)
                      const now = new Date()
                      const diffMs = now - d
                      const diffMin = Math.floor(diffMs / 60000)
                      if (diffMin < 1) return 'Just now'
                      if (diffMin < 60) return `${diffMin}m ago`
                      const diffHr = Math.floor(diffMin / 60)
                      if (diffHr < 24) return `${diffHr}h ago`
                      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                    })()
                  : ''
                return (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      background: meta.bg, color: meta.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{meta.icon}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1F332B', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {a.message}
                      </span>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 1 }}>
                        <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{a.detail}</span>
                        <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>{timeStr}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ---- UPCOMING EVENTS — scrollable, shows all ---- */}
      <div className="nd-card nd-appear" style={{ animationDelay: '0.9s', marginTop: 17, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#3B82F6' }}>event</span>
            <h3 className="nd-section-title" style={{ margin: 0, color: '#000' }}>Upcoming Events</h3>
          </div>
          {upcomingEvents.length > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700, color: RED_DEEP,
              background: 'rgba(247,178,173,0.25)', borderRadius: 99, padding: '3px 10px',
            }}>
              {upcomingEvents.length}
            </span>
          )}
        </div>
        {upcomingEvents.length === 0 ? (
          <>
            <p className="nd-muted">No upcoming events</p>
            <button
              onClick={() => navigate('/sa/events')}
              style={{
                width: '100%', marginTop: 14, padding: '10px 0',
                border: `1.5px dashed #3B82F6`, background: 'rgba(59,130,246,0.08)',
                color: '#3B82F6', borderRadius: 12, fontSize: 12, fontWeight: 700,
                letterSpacing: 0.6, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              + ADD NEW EVENT
            </button>
          </>
        ) : (
          <>
            <div className={upcomingEvents.length > 2 ? 'nd-scroll-fade' : ''}>
              <div className="nd-scroll-list" style={{ maxHeight: 240 }}>
                {upcomingEvents.map((ev, i) => {
                  const d = new Date(ev.event_date)
                  return (
                    <div key={ev.id || i} className="nd-event">
                      <div className="nd-event-date">
                        <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.8 }}>
                          {d.toLocaleString('en-IN', { month: 'short' })}
                        </span>
                        <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{d.getDate()}</span>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: PRIMARY }}>{ev.title}</h4>
                        <p style={{ margin: '3px 0 0', fontSize: 11.5, color: '#94a3b8' }}>
                          {ev.location && <span>{ev.location}</span>}
                          {ev.event_time && <span> {'\u2022'} {ev.event_time.slice(0, 5)}</span>}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <button
              onClick={() => navigate('/sa/events')}
              style={{
                width: '100%', marginTop: 14, padding: '10px 0',
                border: `1.5px dashed #3B82F6`, background: 'rgba(59,130,246,0.08)',
                color: '#3B82F6', borderRadius: 12, fontSize: 12, fontWeight: 700,
                letterSpacing: 0.6, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              + ADD NEW EVENT
            </button>
          </>
        )}
      </div>

      {/* ---- RECENT NOTICES — scrollable, shows all ---- */}
      <div className="nd-card nd-appear" style={{ animationDelay: '0.8s', marginBottom: 20, marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="nd-section-title" style={{ color: '#000' }}>Recent Notices</h3>
          {recentNotices.length > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700, color: '#3B82F6',
              background: 'rgba(59,130,246,0.15)', borderRadius: 99, padding: '3px 10px',
            }}>
              {recentNotices.length}
            </span>
          )}
        </div>
        {recentNotices.length === 0 ? (
          <p className="nd-muted">No recent notices</p>
        ) : (
          <div className={recentNotices.length > 3 ? 'nd-scroll-fade' : ''}>
            <div className="nd-scroll-list">
              {recentNotices.map((n, i) => (
                <div key={n.id || i} className="nd-notice" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                  <div className="nd-notice-icon" style={{ background: i % 2 === 0 ? '#3B82F6' : '#60A5FA' }}>
                    <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 18 }}>
                      {i % 2 === 0 ? 'priority_high' : 'campaign'}
                    </span>
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1E3A5F' }}>{n.title}</h4>
                    <p style={{ margin: '3px 0 4px', fontSize: 12, color: '#475569', lineHeight: 1.45 }}>
                      {n.content && n.content.length > 110 ? n.content.slice(0, 110) + '\u2026' : n.content || ''}
                    </p>
                    <span style={{ fontSize: 10.5, color: '#60A5FA', fontWeight: 600 }}>
                      {new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ============ TOTAL SALARY PAYABLE ============ */}
      {totalSalaryPayable > 0 && (
        <div style={{ marginTop: 24, marginBottom: 20 }}>
          <div className="nd-card nd-appear" style={{ animationDelay: '0.16s', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#059669' }}>payments</span>
              <h3 className="nd-section-title" style={{ margin: 0, color: '#000' }}>Total Salary Payable</h3>
            </div>
            {totalSalaryPayable === 0 ? (
              <p className="nd-muted">No salary data</p>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 90, height: 90, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #05966918, #10B98118)',
                  border: '3px solid rgba(5,150,105,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 26, color: '#059669' }}>account_balance</span>
                </div>
                <span style={{ fontSize: 32, fontWeight: 800, color: '#059669', lineHeight: 1.2 }}>
                  ₹{totalSalaryPayable.toLocaleString('en-IN')}
                </span>
                <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
                  Monthly recurring salary
                </span>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  {(() => {
                    const wc = stats.totalWorkers || 0
                    const avg = wc > 0 ? Math.round(totalSalaryPayable / wc) : 0
                    return (
                      <span style={{ fontSize: 10.5, color: '#64748b', background: '#F1F5F2', borderRadius: 99, padding: '3px 10px', fontWeight: 600 }}>
                        Avg ₹{avg.toLocaleString('en-IN')}/worker
                      </span>
                    )
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ NAME LIST MODAL ============ */}
      {modal && (
        <NameListModal
          title={modal.title}
          color={modal.color}
          names={modal.names}
          onClose={() => setModal(null)}
        />
      )}

      {/* ============ ACCOUNTS DETAIL MODAL ============ */}
      {accountsModalStatus && (
        <AccountsDetailModal
          status={accountsModalStatus}
          onClose={() => setAccountsModalStatus(null)}
        />
      )}

      {/* ============ RECRUITER DETAIL MODAL ============ */}
      {recruiterModalType && (
        <RecruiterDetailModal
          type={recruiterModalType}
          onClose={() => setRecruiterModalType(null)}
        />
      )}

      {/* ============ PANEL SUMMARY MODAL ============ */}
      {panelModal && (
        <PanelSummaryModal
          panel={panelModal}
          dashboardData={data}
          onClose={() => setPanelModal(null)}
        />
      )}

      {/* ============ KPI PIPELINE MODAL ============ */}
      {kpiModal && (
        <div className="nd-modal-overlay" onClick={() => setKpiModal(null)}>
          <div className="nd-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="nd-modal-head" style={{ borderColor: `${kpiModal.color}30` }}>
              <span className="material-symbols-outlined" style={{ color: kpiModal.color, fontSize: 20 }}>analytics</span>
              <h3 className="nd-modal-title">{kpiModal.title}</h3>
              <button className="nd-modal-close" onClick={() => setKpiModal(null)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="nd-modal-body">
              <PipelineFlow stages={kpiModal.stages} height={60} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                {kpiModal.stages.map(s => (
                  <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: `${s.color}14`, border: `1px solid ${s.color}40` }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: PRIMARY }}>{s.value.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ FRO NESTED MODAL ============ */}
      {showFroNestedModal && (
        <FroNestedModal
          froList={froLiveData}
          onClose={() => setShowFroNestedModal(false)}
        />
      )}

      {/* ============ NGO STATION MODAL ============ */}
      {ngoStationModal && (
        <NgoStationModal
          ngoName={ngoStationModal}
          onClose={() => setNgoStationModal(null)}
        />
      )}

      {/* ============ NGO QUICK MODAL ============ */}
      {selectedNgoBtn && (
        <NgoQuickModal
          ngoName={selectedNgoBtn}
          froLiveData={froLiveData}
          froAssignments={froAssignments}
          ngoUserCounts={ngoUserCounts}
          accountsSummary={accountsSummary}
          onClose={() => setSelectedNgoBtn(null)}
        />
      )}

      {/* ============ DEPARTMENT WORKER MODAL ============ */}
      {deptModal && (
        <NameListModal
          title={deptModal.title}
          color={MINT_DEEP}
          names={deptModal.names}
          onClose={() => setDeptModal(null)}
        />
      )}

      {/* ============ LEGACY FRO DETAIL MODALS ============ */}
      {selectedFro && <FroDetailModal fro={selectedFro} onClose={() => setSelectedFro(null)} onShowDeep={() => { setDeepFro(selectedFro); setSelectedFro(null) }} />}
      {deepFro && <FroDeepDetailModal fro={deepFro} onClose={() => setDeepFro(null)} />}
    </div>
  )
}





