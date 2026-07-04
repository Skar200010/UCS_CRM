



// import { useState, useEffect, useRef, useCallback } from 'react'
// import { useNavigate } from 'react-router-dom'
// import { getDashboard, getFroLiveStatus, getAccountsLeads, getRecruiterLeads, getWorkers, getAttendance } from '../api/endpoints'

// const MINT = '#3EB489'
// const CORAL = '#FF7F50'
// const PRIMARY = '#091426'
// const GOLD = '#F5B301'

// const DEPT_COLORS = [
//   { main: PRIMARY, soft: 'rgba(9,20,38,0.07)' },
//   { main: MINT, soft: 'rgba(62,180,137,0.10)' },
//   { main: CORAL, soft: 'rgba(255,127,80,0.10)' },
//   { main: '#8b5cf6', soft: 'rgba(139,92,246,0.10)' },
//   { main: '#06b6d4', soft: 'rgba(6,182,212,0.10)' },
//   { main: '#f43f5e', soft: 'rgba(244,63,94,0.10)' },
//   { main: '#6366f1', soft: 'rgba(99,102,241,0.10)' },
//   { main: '#14b8a6', soft: 'rgba(20,184,166,0.10)' },
// ]

// const NGO_CHIP_COLORS = {}
// const NGO_PALETTE = [MINT, CORAL, '#8b5cf6', '#06b6d4', '#f43f5e', '#6366f1', GOLD, '#14b8a6']
// function ngoColor(name) {
//   if (!NGO_CHIP_COLORS[name]) {
//     NGO_CHIP_COLORS[name] = NGO_PALETTE[Object.keys(NGO_CHIP_COLORS).length % NGO_PALETTE.length]
//   }
//   return NGO_CHIP_COLORS[name]
// }

// const PERIODS = [
//   { key: '7d', label: '7 Days' },
//   { key: '30d', label: '30 Days' },
//   { key: '90d', label: '90 Days' },
//   { key: '1y', label: '1 Year' },
//   { key: 'all', label: 'All Time' },
// ]

// /* ================= CSV / EXCEL EXPORT ================= */
// function exportToExcel(data, period) {
//   const { stats = {}, deptWorkers = {}, attendanceStatus = {}, attendancePercent = 0, froAssignments = [], ngoUserCounts = [] } = data
//   const rows = []
//   rows.push(['DASHBOARD REPORT'])
//   rows.push(['Generated', new Date().toLocaleString('en-IN')])
//   rows.push(['Period', PERIODS.find(p => p.key === period)?.label || period])
//   rows.push([])
//   rows.push(['KEY METRICS'])
//   rows.push(['Total NGOs', stats.totalNgos || 0])
//   rows.push(['Total Workers', stats.totalWorkers || 0])
//   rows.push(['Active Workers', stats.activeWorkers || 0])
//   rows.push(['Attendance %', attendancePercent + '%'])
//   rows.push([])
//   rows.push(['ATTENDANCE STATUS'])
//   rows.push(['Present', attendanceStatus.present || 0])
//   rows.push(['Late', attendanceStatus.late || 0])
//   rows.push(['Absent', attendanceStatus.absent || 0])
//   rows.push([])
//   rows.push(['WORKERS BY DEPARTMENT'])
//   rows.push(['Department', 'Workers'])
//   Object.entries(deptWorkers).forEach(([name, count]) => rows.push([name, count]))
//   rows.push([])
//   if (froAssignments.length > 0) {
//     rows.push(['NGO WISE FRO ASSIGNMENTS'])
//     rows.push(['FRO Name', 'Assigned NGOs'])
//     froAssignments.forEach(f => rows.push([f.name, (f.ngos || []).join(' | ')]))
//   } else if (ngoUserCounts.length > 0) {
//     rows.push(['NGO SUMMARY'])
//     rows.push(['NGO', 'Workers'])
//     ngoUserCounts.forEach(n => rows.push([n.name, n.workers || 0]))
//   }

//   const csv = '\uFEFF' + rows
//     .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
//     .join('\r\n')

//   const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
//   const url = URL.createObjectURL(blob)
//   const a = document.createElement('a')
//   a.href = url
//   a.download = `dashboard-report-${period}-${new Date().toISOString().slice(0, 10)}.csv`
//   document.body.appendChild(a)
//   a.click()
//   document.body.removeChild(a)
//   URL.revokeObjectURL(url)
// }

// /* ================= DONUT ================= */
// function DonutChart({ segments, size, centerValue, centerLabel, animated, onSegmentClick, activeLabel }) {
//   const total = segments.reduce((s, seg) => s + seg.value, 0)
//   if (total === 0) return null
//   const r = 15.915
//   let offset = 0
//   return (
//     <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
//       <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
//         <circle cx="18" cy="18" fill="transparent" r={r} stroke="#f0f2f5" strokeWidth="3" />
//         {segments.map((seg) => {
//           const pct = (seg.value / total) * 100
//           const dash = pct.toFixed(1)
//           const gap = (100 - parseFloat(dash)).toFixed(1)
//           const isActive = activeLabel === seg.label
//           const el = (
//             <circle
//               key={seg.label}
//               cx="18" cy="18" fill="transparent" r={r}
//               stroke={seg.color}
//               strokeDasharray={animated ? `${dash} ${gap}` : `0 100`}
//               strokeDashoffset={-offset}
//               strokeLinecap="round"
//               strokeWidth={isActive ? 5.5 : 4.5}
//               style={{ transition: 'stroke-dasharray 1s ease, stroke-width 0.2s ease', cursor: onSegmentClick ? 'pointer' : 'default', opacity: activeLabel && !isActive ? 0.35 : 1 }}
//               onClick={() => onSegmentClick && onSegmentClick(seg.label)}
//             />
//           )
//           offset += animated ? parseFloat(dash) : 0
//           return el
//         })}
//       </svg>
//       {(centerValue !== undefined || centerLabel) && (
//         <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
//           {centerValue !== undefined && <span style={{ fontSize: 24, fontWeight: 800, color: PRIMARY }}>{Number(centerValue).toLocaleString()}</span>}
//           {centerLabel && <span style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>{centerLabel}</span>}
//         </div>
//       )}
//     </div>
//   )
// }

// /* ================= FRO LIVE MODAL ================= */
// function FroLiveModal({ froLive, loadingFro, onClose, onRefresh }) {
//   return (
//     <div className="nd-modal-overlay" onClick={onClose}>
//       <div className="nd-modal fro-modal" onClick={e => e.stopPropagation()}>
//         <div className="nd-modal-head" style={{ borderColor: '#8b5cf630' }}>
//           <span className="material-symbols-outlined" style={{ color: '#8b5cf6', fontSize: 22 }}>groups</span>
//           <h3 className="nd-modal-title">FRO Live Status</h3>
//           <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 4 }}>
//             {loadingFro && <span className="material-symbols-outlined fro-spin" style={{ fontSize: 18, color: '#94a3b8' }}>refresh</span>}
//             <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
//               {froLive.filter(f => f.is_punched_in).length}/{froLive.length} active
//             </span>
//             <button className="fro-refresh-btn" onClick={onRefresh} title="Refresh">
//               <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
//             </button>
//           </div>
//           <button className="nd-modal-close" onClick={onClose}>
//             <span className="material-symbols-outlined">close</span>
//           </button>
//         </div>
//         <div className="nd-modal-body" style={{ padding: 0 }}>
//           <div className="fro-live-table-wrap">
//             {froLive.length === 0 && !loadingFro ? (
//               <p className="nd-muted" style={{ padding: 24, textAlign: 'center' }}>No FRO workers found.</p>
//             ) : (
//               <table className="fro-live-table">
//                 <thead>
//                   <tr>
//                     <th>FRO Name</th>
//                     <th>Status</th>
//                     <th>Punch In</th>
//                     <th>Total Data</th>
//                     <th>Used</th>
//                     <th>Unused</th>
//                     <th>Today Collection</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {froLive.map(f => (
//                     <tr key={f.id}>
//                       <td>
//                         <span className="fro-name">{f.name || f.login_id || 'Unknown'}</span>
//                         {f.login_id && <span className="fro-login-id">{f.login_id}</span>}
//                       </td>
//                       <td>
//                         <span className={`fro-status-dot ${f.is_active ? 'active' : 'inactive'}`} />
//                         {f.is_active ? 'Active' : 'Inactive'}
//                       </td>
//                       <td>{f.is_punched_in ? <span className="fro-badge fro-badge-green">Punched</span> : <span className="fro-badge fro-badge-red">Not yet</span>}</td>
//                       <td className="fro-num">{f.total_data}</td>
//                       <td className="fro-num">{f.data_used}</td>
//                       <td className="fro-num">{f.data_unused}</td>
//                       <td className="fro-num fro-amt">₹{(f.today_collection || 0).toLocaleString()}</td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             )}
//           </div>
//           <div className="fro-live-footer" style={{ padding: '10px 16px' }}>
//             <span style={{ fontSize: 11, color: '#94a3b8' }}>Auto-refreshes every 30s</span>
//           </div>
//         </div>
//       </div>
//     </div>
//   )
// }

// /* ================= ACCOUNTS DETAIL MODAL ================= */
// function AccountsDetailModal({ status, onClose }) {
//   const [items, setItems] = useState([])
//   const [loading, setLoading] = useState(true)
//   const [err, setErr] = useState('')
//   const [q, setQ] = useState('')

//   useEffect(() => {
//     setLoading(true)
//     getAccountsLeads(status === 'verified_today' ? 'verified' : status)
//       .then(d => {
//         const list = d?.data || d || []
//         if (status === 'verified_today') {
//           const today = new Date().toISOString().slice(0, 10)
//           setItems(list.filter(r => r.verified_at?.slice(0, 10) === today))
//         } else {
//           setItems(list)
//         }
//       })
//       .catch(e => setErr(e.message))
//       .finally(() => setLoading(false))
//   }, [status])

//   const filtered = q.trim()
//     ? items.filter(r => (r.donor_name || '').toLowerCase().includes(q.trim().toLowerCase()) || (r.donor_mobile || '').includes(q.trim()))
//     : items

//   const labels = { pending: 'Pending', verified: 'Verified', rejected: 'Rejected', verified_today: 'Verified Today' }

//   return (
//     <div className="nd-modal-overlay" onClick={onClose}>
//       <div className="nd-modal fro-modal" onClick={e => e.stopPropagation()}>
//         <div className="nd-modal-head" style={{ borderColor: '#8b5cf630' }}>
//           <h3 className="nd-modal-title">Accounts — {labels[status] || status}</h3>
//           <button className="nd-modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
//         </div>
//         <div className="nd-modal-body" style={{ padding: 0 }}>
//           <div className="nd-modal-search" style={{ margin: 12 }}>
//             <input className="nd-modal-search-input" placeholder="Search donor..." value={q} onChange={e => setQ(e.target.value)} autoFocus />
//             {q && <button className="nd-modal-search-clear" onClick={() => setQ('')}><span className="material-symbols-outlined">close</span></button>}
//           </div>
//           {loading ? (
//             <p className="nd-muted" style={{ padding: 16 }}>Loading...</p>
//           ) : err ? (
//             <p className="nd-muted" style={{ padding: 16, color: CORAL }}>{err}</p>
//           ) : filtered.length === 0 ? (
//             <p className="nd-muted" style={{ padding: 16 }}>No records found.</p>
//           ) : (
//             <div className="fro-table-wrap">
//               <table className="fro-table">
//                 <thead>
//                   <tr>
//                     <th>#</th>
//                     <th>Donor Name</th>
//                     <th>Mobile</th>
//                     <th>Amount</th>
//                     <th>Date</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {filtered.map((r, i) => (
//                     <tr key={r.log_id || i}>
//                       <td>{i + 1}</td>
//                       <td>{r.donor_name}</td>
//                       <td>{r.donor_mobile}</td>
//                       <td className="fro-amt">₹{(r.amount || 0).toLocaleString('en-IN')}</td>
//                       <td>{r.created_at?.slice(0, 10) || '-'}</td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           )}
//         </div>
//         <div className="fro-live-footer" style={{ padding: '10px 16px', justifyContent: 'flex-end' }}>
//           <span style={{ fontSize: 11, color: '#94a3b8' }}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
//         </div>
//       </div>
//     </div>
//   )
// }

// /* ================= RECRUITER DETAIL MODAL ================= */
// function RecruiterDetailModal({ type, onClose }) {
//   const [items, setItems] = useState([])
//   const [loading, setLoading] = useState(true)
//   const [err, setErr] = useState('')
//   const [q, setQ] = useState('')

//   useEffect(() => {
//     setLoading(true)
//     getRecruiterLeads()
//       .then(d => {
//         const list = d?.data || d || []
//         if (type === 'new_today') {
//           const today = new Date().toISOString().slice(0, 10)
//           setItems(list.filter(r => r.created_at?.slice(0, 10) === today))
//         } else {
//           setItems(list)
//         }
//       })
//       .catch(e => setErr(e.message))
//       .finally(() => setLoading(false))
//   }, [type])

//   const filtered = q.trim()
//     ? items.filter(r => (r.name || '').toLowerCase().includes(q.trim().toLowerCase()) || (r.phone || '').includes(q.trim()))
//     : items

//   const labels = { total_leads: 'All Leads', new_today: 'New Today', conversion_rate: 'Lead Status Overview' }

//   return (
//     <div className="nd-modal-overlay" onClick={onClose}>
//       <div className="nd-modal fro-modal" onClick={e => e.stopPropagation()}>
//         <div className="nd-modal-head" style={{ borderColor: '#f5b30130' }}>
//           <h3 className="nd-modal-title">Recruiter — {labels[type] || type}</h3>
//           <button className="nd-modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
//         </div>
//         <div className="nd-modal-body" style={{ padding: 0 }}>
//           <div className="nd-modal-search" style={{ margin: 12 }}>
//             <input className="nd-modal-search-input" placeholder="Search lead..." value={q} onChange={e => setQ(e.target.value)} autoFocus />
//             {q && <button className="nd-modal-search-clear" onClick={() => setQ('')}><span className="material-symbols-outlined">close</span></button>}
//           </div>
//           {loading ? (
//             <p className="nd-muted" style={{ padding: 16 }}>Loading...</p>
//           ) : err ? (
//             <p className="nd-muted" style={{ padding: 16, color: CORAL }}>{err}</p>
//           ) : filtered.length === 0 ? (
//             <p className="nd-muted" style={{ padding: 16 }}>No leads found.</p>
//           ) : (
//             <div className="fro-table-wrap">
//               <table className="fro-table">
//                 <thead>
//                   <tr>
//                     <th>#</th>
//                     <th>Name</th>
//                     <th>Phone</th>
//                     <th>Status</th>
//                     <th>Recruiter</th>
//                     <th>Date</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {filtered.map((r, i) => (
//                     <tr key={r.id || i}>
//                       <td>{i + 1}</td>
//                       <td>{r.name}</td>
//                       <td>{r.phone}</td>
//                       <td><span className={`lead-status-dot ${r.status}`} />{r.status}</td>
//                       <td>{r.users?.name || '-'}</td>
//                       <td>{r.created_at?.slice(0, 10) || '-'}</td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           )}
//         </div>
//         <div className="fro-live-footer" style={{ padding: '10px 16px', justifyContent: 'flex-end' }}>
//           <span style={{ fontSize: 11, color: '#94a3b8' }}>{filtered.length} lead{filtered.length !== 1 ? 's' : ''}</span>
//         </div>
//       </div>
//     </div>
//   )
// }

// /* ================= PANEL SUMMARY MODAL ================= */
// function PanelSummaryModal({ panel, onClose, dashboardData }) {
//   const [data, setData] = useState(null)
//   const [loading, setLoading] = useState(true)
//   const timer = useRef(null)

//   const fetchData = useCallback(() => {
//     setLoading(true)

//     const fetchers = {
//       accounts: () => getAccountsLeads()
//         .then(d => {
//           const list = d?.data || d || []
//           const pending = list.filter(l => l.accounts_status === 'pending')
//           const verified = list.filter(l => l.accounts_status === 'verified')
//           const today = new Date().toDateString()
//           const verifiedToday = verified.filter(l => l.verified_at && new Date(l.verified_at).toDateString() === today)
//           return {
//             pending: { count: pending.length, amount: pending.reduce((s, l) => s + Number(l.amount || 0), 0) },
//             verified: { count: verified.length, amount: verified.reduce((s, l) => s + Number(l.amount || 0), 0) },
//             verifiedToday: { count: verifiedToday.length, amount: verifiedToday.reduce((s, l) => s + Number(l.amount || 0), 0) },
//             total: { count: list.length, amount: list.reduce((s, l) => s + Number(l.amount || 0), 0) },
//           }
//         }),
//       fro: () => getFroLiveStatus()
//         .then(list => {
//           const arr = Array.isArray(list) ? list : []
//           const active = arr.filter(f => f.is_active)
//           const punchedIn = arr.filter(f => f.is_punched_in)
//           const totalCollection = arr.reduce((s, f) => s + Number(f.today_collection || 0), 0)
//           const totalData = arr.reduce((s, f) => s + Number(f.data_used || 0), 0)
//           return { total: arr.length, active: active.length, inactive: arr.length - active.length, punchedIn: punchedIn.length, totalCollection, totalData }
//         }),
//       hr: () => Promise.all([getWorkers(), getAttendance()])
//         .then(([workers, attendance]) => {
//           const wList = Array.isArray(workers) ? workers : workers?.data || []
//           const totalWorkers = wList.length
//           const activeWorkers = wList.filter(w => w.is_active).length
//           const today = new Date().toDateString()
//           const attList = Array.isArray(attendance) ? attendance : attendance?.data || []
//           const todayAtt = attList.filter(a => a.date && new Date(a.date).toDateString() === today)
//           const presentToday = todayAtt.filter(a => a.status === 'present' || a.punched_in).length
//           const totalAtt = todayAtt.length
//           return { totalWorkers, activeWorkers, presentToday, totalAtt, attendancePercent: totalAtt > 0 ? Math.round((presentToday / totalAtt) * 100) : 0 }
//         }),
//       'ngo-admin': () => {
//         const dd = dashboardData
//         if (dd?.stats?.totalNgos != null) {
//           return Promise.resolve({ totalNgos: dd.stats.totalNgos, ngoTotals: dd.ngoTotals || [] })
//         }
//         return Promise.resolve({ totalNgos: 0, ngoTotals: [] })
//       },
//       recruiter: () => getRecruiterLeads()
//         .then(d => {
//           const list = d?.data || d || []
//           const today = new Date().toDateString()
//           const newToday = list.filter(l => l.created_at && new Date(l.created_at).toDateString() === today)
//           const statusGroups = {}
//           list.forEach(l => { const s = l.status || 'unknown'; statusGroups[s] = (statusGroups[s] || 0) + 1 })
//           const selected = list.filter(l => l.status === 'selected' || l.status === 'verified').length
//           const rejected = list.filter(l => l.status === 'rejected').length
//           const conversionRate = rejected + selected > 0 ? (selected / (selected + rejected)) * 100 : 0
//           return { total: list.length, newToday: newToday.length, conversionRate, statusGroups }
//         }),
//     }

//     const fetcher = fetchers[panel]
//     if (fetcher) fetcher().then(setData).catch(() => setData({})) .finally(() => setLoading(false))
//   }, [panel])

//   useEffect(() => {
//     fetchData()
//     timer.current = setInterval(fetchData, 30000)
//     return () => clearInterval(timer.current)
//   }, [fetchData])

//   const labels = {
//     accounts: { title: 'Accounts — Lead Verification', icon: 'receipt_long', color: '#8b5cf6' },
//     fro: { title: 'FRO — Field Operations', icon: 'groups', color: MINT },
//     hr: { title: 'HR — Employee Management', icon: 'badge', color: '#3b82f6' },
//     'ngo-admin': { title: 'NGO Admin — NGO Management', icon: 'corporate_fare', color: '#f59e0b' },
//     recruiter: { title: 'Recruiter — Lead Pipeline', icon: 'person_search', color: '#f5b301' },
//   }
//   const meta = labels[panel] || {}

//   return (
//     <div className="nd-modal-overlay" onClick={onClose}>
//       <div className="nd-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
//         <div className="nd-modal-head" style={{ borderColor: `${meta.color}30` }}>
//           <span className="material-symbols-outlined" style={{ fontSize: 20, color: meta.color }}>{meta.icon}</span>
//           <h3 className="nd-modal-title">{meta.title}</h3>
//           <button className="nd-modal-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
//         </div>
//         <div className="nd-modal-body">
//           {loading && !data ? (
//             <p className="nd-muted">Loading...</p>
//           ) : (
//             <div className="ps-grid">
//               {panel === 'accounts' && data && (
//                 <>
//                   <div className="ps-card" style={{ borderTop: '3px solid #f59e0b' }}>
//                     <span className="ps-label">⏳ Pending</span>
//                     <span className="ps-value">{data.pending?.count ?? 0}</span>
//                     <span className="ps-sub">₹{(data.pending?.amount || 0).toLocaleString('en-IN')} total</span>
//                   </div>
//                   <div className="ps-card" style={{ borderTop: `3px solid ${MINT}` }}>
//                     <span className="ps-label">✔️ Verified</span>
//                     <span className="ps-value">{data.verified?.count ?? 0}</span>
//                     <span className="ps-sub">₹{(data.verified?.amount || 0).toLocaleString('en-IN')} total</span>
//                   </div>
//                   <div className="ps-card" style={{ borderTop: '3px solid #3b82f6' }}>
//                     <span className="ps-label">📅 Verified Today</span>
//                     <span className="ps-value">{data.verifiedToday?.count ?? 0}</span>
//                     <span className="ps-sub">₹{(data.verifiedToday?.amount || 0).toLocaleString('en-IN')} collected</span>
//                   </div>
//                   <div className="ps-card" style={{ borderTop: `3px solid ${GOLD}` }}>
//                     <span className="ps-label">💰 Total Amount</span>
//                     <span className="ps-value">₹{(data.total?.amount || 0).toLocaleString('en-IN')}</span>
//                     <span className="ps-sub">Across {data.total?.count || 0} leads</span>
//                   </div>
//                 </>
//               )}
//               {panel === 'fro' && data && (
//                 <>
//                   <div className="ps-card" style={{ borderTop: '3px solid #8b5cf6' }}>
//                     <span className="ps-label">📋 Total FROs</span>
//                     <span className="ps-value">{data.total ?? 0}</span>
//                     <span className="ps-sub">Registered workers</span>
//                   </div>
//                   <div className="ps-card" style={{ borderTop: `3px solid ${MINT}` }}>
//                     <span className="ps-label">🟢 Active</span>
//                     <span className="ps-value">{data.active ?? 0}</span>
//                     <span className="ps-sub">{data.inactive ?? 0} inactive</span>
//                   </div>
//                   <div className="ps-card" style={{ borderTop: '3px solid #06b6d4' }}>
//                     <span className="ps-label">✅ Punched In</span>
//                     <span className="ps-value">{data.punchedIn ?? 0}</span>
//                     <span className="ps-sub">Today</span>
//                   </div>
//                   <div className="ps-card" style={{ borderTop: `3px solid ${GOLD}` }}>
//                     <span className="ps-label">💰 Today's Collection</span>
//                     <span className="ps-value">₹{(data.totalCollection || 0).toLocaleString('en-IN')}</span>
//                     <span className="ps-sub">Data used: {data.totalData || 0}</span>
//                   </div>
//                 </>
//               )}
//               {panel === 'hr' && data && (
//                 <>
//                   <div className="ps-card" style={{ borderTop: '3px solid #3b82f6' }}>
//                     <span className="ps-label">👷 Total Workers</span>
//                     <span className="ps-value">{data.totalWorkers ?? 0}</span>
//                     <span className="ps-sub">All time</span>
//                   </div>
//                   <div className="ps-card" style={{ borderTop: `3px solid ${MINT}` }}>
//                     <span className="ps-label">✅ Active Workers</span>
//                     <span className="ps-value">{data.activeWorkers ?? 0}</span>
//                     <span className="ps-sub">Currently active</span>
//                   </div>
//                   <div className="ps-card" style={{ borderTop: '3px solid #f59e0b' }}>
//                     <span className="ps-label">📊 Attendance</span>
//                     <span className="ps-value">{data.attendancePercent ?? 0}%</span>
//                     <span className="ps-sub">{data.presentToday ?? 0} of {data.totalAtt ?? 0} today</span>
//                   </div>
//                 </>
//               )}
//               {panel === 'ngo-admin' && data && (
//                 <>
//                   <div className="ps-card" style={{ borderTop: '3px solid #f59e0b' }}>
//                     <span className="ps-label">🏢 Total NGOs</span>
//                     <span className="ps-value">{data.totalNgos ?? 0}</span>
//                     <span className="ps-sub">Registered NGOs</span>
//                   </div>
//                   {data.ngoTotals?.length > 0 && (
//                     <div className="ps-card" style={{ gridColumn: '1 / -1', borderTop: '3px solid #3b82f6' }}>
//                       <span className="ps-label">📊 NGO Breakdown</span>
//                       <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 8 }}>
//                         {data.ngoTotals.map(t => (
//                           <span key={t.name} style={{
//                             background: `${t.color || '#3b82f6'}14`, color: t.color || '#3b82f6',
//                             borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600
//                           }}>
//                             {t.name} — {t.count}
//                           </span>
//                         ))}
//                       </div>
//                     </div>
//                   )}
//                 </>
//               )}
//               {panel === 'recruiter' && data && (
//                 <>
//                   <div className="ps-card" style={{ borderTop: '3px solid #8b5cf6' }}>
//                     <span className="ps-label">📋 Total Leads</span>
//                     <span className="ps-value">{data.total ?? 0}</span>
//                     <span className="ps-sub">All time</span>
//                   </div>
//                   <div className="ps-card" style={{ borderTop: `3px solid ${MINT}` }}>
//                     <span className="ps-label">🆕 New Today</span>
//                     <span className="ps-value">{data.newToday ?? 0}</span>
//                     <span className="ps-sub">Added today</span>
//                   </div>
//                   <div className="ps-card" style={{ borderTop: `3px solid ${GOLD}` }}>
//                     <span className="ps-label">📈 Conversion</span>
//                     <span className="ps-value">{(data.conversionRate ?? 0).toFixed(1)}%</span>
//                     <span className="ps-sub">Selected vs Rejected</span>
//                   </div>
//                 </>
//               )}
//             </div>
//           )}
//           <div className="fro-live-footer">
//             <span style={{ fontSize: 11, color: '#94a3b8' }}>Auto-refreshes every 30s</span>
//           </div>
//         </div>
//       </div>
//     </div>
//   )
// }

// /* ================= NAME LIST MODAL ================= */
// function NameListModal({ title, color, names, onClose }) {
//   const [q, setQ] = useState('')
//   const filtered = q.trim()
//     ? names.filter(n => {
//         const name = (typeof n === 'string' ? n : (n.name || '')).toLowerCase()
//         return name.includes(q.trim().toLowerCase())
//       })
//     : names
//   return (
//     <div className="nd-modal-overlay" onClick={onClose}>
//       <div className="nd-modal" onClick={e => e.stopPropagation()}>
//         <div className="nd-modal-head" style={{ borderColor: `${color}30` }}>
//           <span className="nd-modal-badge" style={{ background: `${color}18`, color }}>
//             {filtered.length}/{names.length}
//           </span>
//           <h3 className="nd-modal-title">{title}</h3>
//           <button className="nd-modal-close" onClick={onClose}>
//             <span className="material-symbols-outlined">close</span>
//           </button>
//         </div>
//         <div className="nd-modal-body">
//           <div className="nd-modal-search">
//             <span className="material-symbols-outlined nd-modal-search-icon">search</span>
//             <input
//               className="nd-modal-search-input"
//               placeholder="Search by name..."
//               value={q}
//               onChange={e => setQ(e.target.value)}
//               autoFocus
//             />
//             {q && <button className="nd-modal-search-clear" onClick={() => setQ('')}><span className="material-symbols-outlined">close</span></button>}
//           </div>
//           {filtered.length === 0 ? (
//             <p className="nd-muted" style={{ padding: 16 }}>{q ? 'No matching names found.' : 'No records found for this period.'}</p>
//           ) : (
//             filtered.map((n, i) => {
//               const person = typeof n === 'string' ? { name: n } : n
//               return (
//                 <div key={i} className="nd-modal-row">
//                   <span className="nd-avatar" style={{ background: `${color}18`, color }}>
//                     {person.name?.charAt(0).toUpperCase() || '?'}
//                   </span>
//                   <div style={{ minWidth: 0 }}>
//                     <span className="nd-modal-name">{person.name}</span>
//                     {(person.dept || person.department) && (
//                       <span className="nd-modal-dept">{person.dept || person.department}</span>
//                     )}
//                   </div>
//                   {person.time && <span className="nd-modal-time">{person.time}</span>}
//                 </div>
//               )
//             })
//           )}
//         </div>
//       </div>
//     </div>
//   )
// }

// export default function Dashboard() {
//   const [period, setPeriod] = useState('all')
//   const [loading, setLoading] = useState(false)
//   const [data, setData] = useState(null)
//   const [err, setErr] = useState('')
//   const [animated, setAnimated] = useState(false)
//   const [modal, setModal] = useState(null) // { title, color, names }
//   const [froLive, setFroLive] = useState([])
//   const [loadingFro, setLoadingFro] = useState(false)
//   const [showFroModal, setShowFroModal] = useState(false)
//   const [accountsModalStatus, setAccountsModalStatus] = useState(null)
//   const [recruiterModalType, setRecruiterModalType] = useState(null)
//   const [panelModal, setPanelModal] = useState(null)
//   const froTimer = useRef(null)
//   const navigate = useNavigate()

//   useEffect(() => { const t = setTimeout(() => setAnimated(true), 150); return () => clearTimeout(t) }, [])

//   useEffect(() => {
//     setLoading(true)
//     getDashboard(period)
//       .then(d => setData(d))
//       .catch(e => setErr(e.message))
//       .finally(() => setLoading(false))
//   }, [period])

//   function fetchFroLive() {
//     setLoadingFro(true)
//     getFroLiveStatus()
//       .then(setFroLive)
//       .catch(() => {})
//       .finally(() => setLoadingFro(false))
//   }

//   useEffect(() => {
//     if (!showFroModal) {
//       clearInterval(froTimer.current)
//       return
//     }
//     fetchFroLive()
//     froTimer.current = setInterval(fetchFroLive, 30000)
//     return () => clearInterval(froTimer.current)
//   }, [showFroModal])

//   if (err) return <div className="sa-err-card">Error: {err}</div>
//   if (!data) return (
//     <div className="dash-page">
//       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
//         <div style={{ flex: 1 }}>
//           <div className="sk" style={{ width: 200, height: 20, marginBottom: 8 }} />
//           <div className="sk" style={{ width: 280, height: 12 }} />
//         </div>
//         <div className="sk" style={{ width: 140, height: 32, borderRadius: 6 }} />
//       </div>
//       <div className="metrics-grid">
//         {[1, 2, 3, 4, 5].map(i => <div key={i} className="clay-card"><div className="sk" style={{ height: 80 }} /></div>)}
//       </div>
//     </div>
//   )

//   const {
//     stats = {}, deptWorkers = {}, ngoUserCounts = [],
//     attendanceStatus = {}, attendanceWorkerCounts = {}, todayAttendance = {},
//     kpiChanges = {}, attendancePercent = 0,
//     recentNotices = [], upcomingEvents = [],
//     // NEW data (backend can provide; safe defaults otherwise)
//     attendanceDetails = {}, todayAttendanceDetails = {},
//     froAssignments = [],      // [{ name: 'Ramesh', ngos: ['MAN', 'AFLF'] }]
//     accountsSummary = {}, recruiterSummary = {},
//   } = data

//   const today = new Date()
//   const hour = today.getHours()
//   const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
//   const dateStr = today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

//   /* -------- metric cards (Total Users removed) -------- */
//   const metricCards = [
//     { label: 'Total NGOs', value: stats.totalNgos || 0, icon: 'corporate_fare', changeKey: 'totalNgos' },
//     { label: 'Total Workers', value: stats.totalWorkers || 0, icon: 'badge', changeKey: 'totalWorkers' },
//     { label: 'Active Workers', value: stats.activeWorkers || 0, icon: 'bolt', changeKey: 'reach' },
//     { label: 'Attendance %', value: attendancePercent, suffix: '%', icon: 'event_available', changeKey: 'attendancePercent' },
//     { label: 'ALL FRO', value: froLive.length || '\u2014', icon: 'groups', isFroCard: true, onClick: () => setShowFroModal(true) },
//   ]

//   function getTrend(changeKey) {
//     if (changeKey === 'reach') return { direction: 'up', text: '100% Reach' }
//     const v = kpiChanges[changeKey]
//     if (v === undefined || v === null) return null
//     if (v > 0) return { direction: 'up', text: `+${Math.abs(v)}%` }
//     if (v < 0) return { direction: 'down', text: `-${Math.abs(v)}%` }
//     return { direction: 'flat', text: 'Stable' }
//   }

//   /* -------- departments (HR-Recruitment removed) -------- */
//   const HIDE_DEPTS = ['hr-recruitment', 'hr recruitment', 'hr_recruitment', 'hrrecruitment']
//   const deptData = Object.entries(deptWorkers || {})
//     .filter(([name]) => !HIDE_DEPTS.includes(name.toLowerCase().trim()))
//     .map(([name, value]) => ({ name, value }))
//     .sort((a, b) => b.value - a.value)
//   const totalDeptWorkers = deptData.reduce((s, d) => s + d.value, 0) || 1

//   /* -------- attendance (today — daily check-ins) -------- */
//   const hasTodayData = todayAttendance?.present !== undefined
//   const attSrc = hasTodayData ? todayAttendance : attendanceWorkerCounts
//   const detSrc = hasTodayData ? todayAttendanceDetails : attendanceDetails

//   const attPresent = attSrc?.present ?? 0
//   const attLate = attSrc?.late ?? 0
//   const attAbsent = attSrc?.absent ?? 0

//   const attSegments = []
//   if (attPresent > 0) attSegments.push({ label: 'Present', value: attPresent, color: MINT, icon: 'verified' })
//   if (attLate > 0) attSegments.push({ label: 'Late', value: attLate, color: GOLD, icon: 'pace' })
//   if (attAbsent > 0) attSegments.push({ label: 'Absent', value: attAbsent, color: CORAL, icon: 'cancel' })

//   function openAttendanceList(label) {
//     const key = label.toLowerCase()
//     const seg = attSegments.find(s => s.label === label)
//     setModal({
//       title: `${label} Workers`,
//       color: seg?.color || PRIMARY,
//       names: detSrc?.[key] || [],
//     })
//   }

//   function openAbsentees() {
//     setModal({
//       title: 'Absent Workers',
//       color: CORAL,
//       names: detSrc?.absent || [],
//     })
//   }

//   /* -------- NGO wise FRO assignments -------- */
//   const allNgoNames = [...new Set([
//     ...ngoUserCounts.map(n => n.name),
//     ...froAssignments.flatMap(f => f.ngos || []),
//   ])]
//   const ngoTotals = allNgoNames.map(name => ({
//     name,
//     count: froAssignments.filter(f => (f.ngos || []).includes(name)).length,
//   }))

//   return (
//     <div className="dash-page">
//       {/* ============ NEW DESIGN STYLES (single-file, scoped with nd-) ============ */}
//       <style>{`
//         .nd-card {
//           background: #fff;
//           border: 1px solid #eef1f5;
//           border-radius: 20px;
//           padding: 22px;
//           box-shadow: 0 1px 2px rgba(9,20,38,0.04), 0 8px 24px -12px rgba(9,20,38,0.08);
//           transition: box-shadow 0.25s ease, transform 0.25s ease;
//         }
//         .nd-card:hover { box-shadow: 0 2px 4px rgba(9,20,38,0.05), 0 16px 32px -12px rgba(9,20,38,0.12); }
//         .nd-section-title {
//           font-size: 13px; font-weight: 700; color: ${PRIMARY};
//           text-transform: uppercase; letter-spacing: 1.2px; margin: 0;
//         }
//         .nd-muted { color: #94a3b8; font-size: 13px; margin: 8px 0 0; }
//         .nd-appear { opacity: 0; transform: translateY(14px); animation: ndUp 0.55s cubic-bezier(0.22,1,0.36,1) forwards; }
//         @keyframes ndUp { to { opacity: 1; transform: translateY(0); } }
//         @media (prefers-reduced-motion: reduce) { .nd-appear { animation: none; opacity: 1; transform: none; } }

//         /* metric cards */
//         .nd-metric {
//           position: relative; overflow: hidden;
//         }
//         .nd-metric::after {
//           content: ''; position: absolute; right: -30px; top: -30px;
//           width: 100px; height: 100px; border-radius: 50%;
//           background: radial-gradient(circle, rgba(62,180,137,0.08), transparent 70%);
//         }

//         /* dept tiles */
//         .nd-dept-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 14px; margin-top: 16px; }
//         .nd-dept-tile {
//           border-radius: 16px; padding: 16px;
//           display: flex; flex-direction: column; gap: 8px;
//           border: 1px solid transparent;
//           transition: transform 0.2s ease, border-color 0.2s ease;
//         }
//         .nd-dept-tile:hover { transform: translateY(-3px); }
//         .nd-dept-count { font-size: 30px; font-weight: 800; line-height: 1; color: ${PRIMARY}; }
//         .nd-dept-name { font-size: 12px; font-weight: 700; letter-spacing: 0.4px; }
//         .nd-dept-share {
//           height: 5px; border-radius: 99px; background: rgba(9,20,38,0.06); overflow: hidden;
//         }
//         .nd-dept-share > div { height: 100%; border-radius: 99px; transition: width 0.9s cubic-bezier(0.22,1,0.36,1) 0.3s; }
//         .nd-dept-pct { font-size: 11px; color: #64748b; font-weight: 600; }

//         /* FRO assignment rows */
//         .nd-fro-summary { display: flex; flex-wrap: wrap; gap: 10px; margin: 14px 0 6px; }
//         .nd-fro-summary-pill {
//           display: flex; align-items: center; gap: 8px;
//           padding: 8px 14px; border-radius: 12px; font-size: 12.5px; font-weight: 700;
//         }
//         .nd-fro-list { max-height: 340px; overflow-y: auto; margin-top: 12px; padding-right: 6px; }
//         .nd-fro-row {
//           display: flex; align-items: center; gap: 12px;
//           padding: 11px 12px; border-radius: 14px;
//           border: 1px solid #f1f4f8; margin-bottom: 8px;
//           transition: background 0.15s ease;
//         }
//         .nd-fro-row:hover { background: #fafbfd; }
//         .nd-fro-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-left: auto; }
//         .nd-ngo-chip {
//           font-size: 10.5px; font-weight: 700; letter-spacing: 0.3px;
//           padding: 4px 10px; border-radius: 99px;
//         }

//         /* clickable attendance pills */
//         .nd-att-pill {
//           display: flex; align-items: center; gap: 10px; width: 100%;
//           padding: 11px 14px; border-radius: 14px; border: 1px solid;
//           background: transparent; cursor: pointer; text-align: left;
//           font-family: inherit;
//           transition: transform 0.15s ease, box-shadow 0.15s ease;
//         }
//         .nd-att-pill:hover { transform: translateX(3px); box-shadow: 0 4px 12px -6px rgba(9,20,38,0.15); }
//         .nd-att-pill:focus-visible { outline: 2px solid ${PRIMARY}; outline-offset: 2px; }

//         /* scrollable notice & event lists */
//         .nd-scroll-list {
//           max-height: 300px; overflow-y: auto; padding-right: 6px;
//           display: flex; flex-direction: column; gap: 12px; margin-top: 14px;
//           scrollbar-width: thin;
//         }
//         .nd-scroll-list::-webkit-scrollbar { width: 5px; }
//         .nd-scroll-list::-webkit-scrollbar-thumb { background: #dde3ea; border-radius: 99px; }
//         .nd-scroll-fade { position: relative; }
//         .nd-scroll-fade::after {
//           content: ''; position: absolute; left: 0; right: 10px; bottom: 0; height: 28px;
//           background: linear-gradient(transparent, #fff); pointer-events: none; border-radius: 0 0 16px 16px;
//         }

//         .nd-notice {
//           display: flex; gap: 12px; padding: 12px; border-radius: 14px;
//           background: #fafbfd; border: 1px solid #f1f4f8;
//         }
//         .nd-notice-icon {
//           width: 36px; height: 36px; border-radius: 11px; flex-shrink: 0;
//           display: flex; align-items: center; justify-content: center;
//         }

//         .nd-event {
//           display: flex; gap: 12px; align-items: center;
//           padding: 11px 12px; border-radius: 14px; border: 1px solid #f1f4f8;
//         }
//         .nd-event-date {
//           width: 46px; height: 50px; border-radius: 12px; flex-shrink: 0;
//           background: ${PRIMARY}; color: #fff;
//           display: flex; flex-direction: column; align-items: center; justify-content: center;
//         }

//         /* modal */
//         .nd-modal-overlay {
//           position: fixed; inset: 0; z-index: 1000;
//           background: rgba(9,20,38,0.45); backdrop-filter: blur(3px);
//           display: flex; align-items: center; justify-content: center; padding: 20px;
//           animation: ndFade 0.2s ease;
//         }
//         @keyframes ndFade { from { opacity: 0; } to { opacity: 1; } }
//         .nd-modal {
//           background: #fff; border-radius: 22px; width: 100%; max-width: 420px;
//           max-height: 75vh; display: flex; flex-direction: column; overflow: hidden;
//           box-shadow: 0 24px 60px -12px rgba(9,20,38,0.35);
//           animation: ndPop 0.3s cubic-bezier(0.22,1,0.36,1);
//         }
//         @keyframes ndPop { from { opacity: 0; transform: scale(0.94) translateY(10px); } to { opacity: 1; transform: none; } }
//         .nd-modal-head {
//           display: flex; align-items: center; gap: 12px;
//           padding: 18px 20px; border-bottom: 1px solid;
//         }
//         .nd-modal-badge { font-size: 14px; font-weight: 800; padding: 6px 12px; border-radius: 10px; }
//         .nd-modal-title { margin: 0; flex: 1; font-size: 15px; font-weight: 700; color: ${PRIMARY}; }
//         .nd-modal-close {
//           border: none; background: #f4f6f9; border-radius: 10px; width: 32px; height: 32px;
//           display: flex; align-items: center; justify-content: center; cursor: pointer; color: #64748b;
//         }
//         .nd-modal-close:hover { background: #e9edf2; }
//         .nd-modal-body { overflow-y: auto; padding: 12px 16px 18px; }
//         .nd-modal-row {
//           display: flex; align-items: center; gap: 12px;
//           padding: 10px 8px; border-bottom: 1px solid #f4f6f9;
//         }
//         .nd-modal-row:last-child { border-bottom: none; }
//         .nd-avatar {
//           width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
//           display: flex; align-items: center; justify-content: center;
//           font-weight: 800; font-size: 14px;
//         }
//         .nd-modal-name { display: block; font-size: 13.5px; font-weight: 600; color: ${PRIMARY}; }
//         .nd-modal-dept { display: block; font-size: 11px; color: #94a3b8; }
//         .nd-modal-time { margin-left: auto; font-size: 11.5px; color: #64748b; font-weight: 600; }

//         /* modal search */
//         .nd-modal-search {
//           display: flex; align-items: center; gap: 8px;
//           padding: 8px 12px; margin-bottom: 8px;
//           border: 1px solid #e2e8f0; border-radius: 12px;
//           background: #f8f9fc; transition: border-color 0.2s;
//         }
//         .nd-modal-search:focus-within { border-color: #8b5cf6; background: #fff; }
//         .nd-modal-search-icon { font-size: 18px; color: #94a3b8; }
//         .nd-modal-search-input {
//           flex: 1; border: none; background: transparent;
//           font-size: 13px; font-family: inherit; color: ${PRIMARY};
//           outline: none;
//         }
//         .nd-modal-search-input::placeholder { color: #b6c0cc; }
//         .nd-modal-search-clear {
//           border: none; background: transparent; cursor: pointer;
//           color: #94a3b8; padding: 2px; display: flex;
//         }
//         .nd-modal-search-clear:hover { color: #64748b; }

//         /* mini cards for accounts / recruiter */
//         .mini-card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
//         .mini-card {
//           background: #fafbfd; border-radius: 14px; padding: 14px 16px;
//           display: flex; flex-direction: column; gap: 2px;
//           border: 1px solid #f1f4f8;
//         }
//         .mini-card-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
//         .mini-card-value { font-size: 26px; font-weight: 800; color: ${PRIMARY}; line-height: 1.2; }
//         .mini-card-sub { font-size: 12px; color: #64748b; font-weight: 600; }
//         .ps-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
//         .ps-card {
//           background: #fafbfd; border-radius: 14px; padding: 14px 16px;
//           display: flex; flex-direction: column; gap: 2px;
//           border: 1px solid #f1f4f8;
//         }
//         .ps-label { font-size: 12px; font-weight: 700; color: #94a3b8; }
//         .ps-value { font-size: 24px; font-weight: 800; color: ${PRIMARY}; line-height: 1.2; }
//         .ps-sub { font-size: 11px; color: #64748b; font-weight: 600; }
//         .mini-card-clickable { cursor: pointer; transition: box-shadow 0.2s, transform 0.15s; }
//         .mini-card-clickable:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); transform: translateY(-1px); }
//         .lead-status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
//         .lead-status-dot.scheduled { background: #3b82f6; }
//         .lead-status-dot.verified { background: ${MINT}; }
//         .lead-status-dot.selected { background: ${MINT}; }
//         .lead-status-dot.rejected { background: #f43f5e; }
//         .lead-status-dot.pending { background: #f59e0b; }
//         .lead-status-dot.contacted { background: #8b5cf6; }
//         .lead-status-dot.follow_up { background: #f5b301; }

//         /* Panel link cards */
//         .panel-link-grid {
//           display: grid;
//           grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
//           gap: 14px;
//           margin-top: 20px;
//         }
//         .panel-link-card {
//           border-radius: 16px; padding: 22px 18px; cursor: pointer;
//           display: flex; flex-direction: column; gap: 6px;
//           color: #fff; transition: transform 0.2s, box-shadow 0.2s;
//           animation: ndUp 0.5s cubic-bezier(0.22,1,0.36,1) forwards;
//           opacity: 0; box-shadow: 0 4px 14px rgba(0,0,0,0.08);
//         }
//         .panel-link-card:nth-child(1) { animation-delay: 0.1s; }
//         .panel-link-card:nth-child(2) { animation-delay: 0.15s; }
//         .panel-link-card:nth-child(3) { animation-delay: 0.2s; }
//         .panel-link-card:nth-child(4) { animation-delay: 0.25s; }
//         .panel-link-card:nth-child(5) { animation-delay: 0.3s; }
//         .panel-link-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
//         .panel-link-card .material-symbols-outlined { font-size: 28px; }
//         .panel-link-label { font-size: 17px; font-weight: 800; letter-spacing: -0.3px; }
//         .panel-link-sub { font-size: 11px; opacity: 0.8; font-weight: 500; }

//         /* ALL FRO card */
//         .nd-fro-card { border: 1px solid rgba(139,92,246,0.15); transition: border-color 0.2s, box-shadow 0.2s; cursor: pointer; }
//         .nd-fro-card:hover { border-color: rgba(139,92,246,0.4); box-shadow: 0 2px 4px rgba(139,92,246,0.08), 0 8px 24px -12px rgba(139,92,246,0.15); }

//         /* FRO Live Modal - wider */
//         .fro-modal { max-width: 800px !important; }

//         /* FRO Live Panel */
//         .fro-live-panel { animation: ndUp 0.4s cubic-bezier(0.22,1,0.36,1) forwards; }
//         .fro-live-header {
//           display: flex; justify-content: space-between; align-items: center;
//           padding-bottom: 14px; border-bottom: 1px solid #f1f4f8; margin-bottom: 4px;
//         }
//         .fro-live-table-wrap {
//           overflow: auto; max-height: 60vh;
//         }
//         .fro-live-table {
//           width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px;
//         }
//         .fro-live-table thead { position: sticky; top: 0; z-index: 2; }
//         .fro-live-table th {
//           position: sticky; top: 0; z-index: 2;
//           text-align: left; padding: 12px 10px; font-size: 11px; font-weight: 700;
//           color: #94a3b8; text-transform: uppercase; letter-spacing: 0.6px;
//           border-bottom: 1px solid #f1f4f8; white-space: nowrap;
//           background: #fff;
//         }
//         .fro-live-table td {
//           padding: 10px; border-bottom: 1px solid #f8f9fc; vertical-align: middle;
//         }
//         .fro-live-table tbody tr:hover { background: #fafbfd; }
//         .fro-name { display: block; font-weight: 700; color: ${PRIMARY}; }
//         .fro-login-id { display: block; font-size: 11px; color: #94a3b8; margin-top: 1px; }
//         .fro-status-dot {
//           display: inline-block; width: 8px; height: 8px; border-radius: 50%;
//           margin-right: 6px; vertical-align: middle;
//         }
//         .fro-status-dot.active { background: ${MINT}; box-shadow: 0 0 0 2px rgba(62,180,137,0.2); }
//         .fro-status-dot.inactive { background: #e2e8f0; }
//         .fro-badge {
//           display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 10px;
//           border-radius: 99px;
//         }
//         .fro-badge-green { background: rgba(62,180,137,0.12); color: ${MINT}; }
//         .fro-badge-red { background: rgba(244,63,94,0.1); color: #f43f5e; }
//         .fro-num { font-size: 14px; font-weight: 700; color: ${PRIMARY}; }
//         .fro-amt { color: ${MINT}; }
//         .fro-live-footer {
//           border-top: 1px solid #f1f4f8; padding-top: 12px; margin-top: 4px;
//           display: flex; justify-content: flex-end;
//         }
//         .fro-refresh-btn {
//           border: none; background: #f4f6f9; border-radius: 8px; width: 30px; height: 30px;
//           display: flex; align-items: center; justify-content: center; cursor: pointer;
//           color: #64748b; font-size: 13px; font-family: inherit;
//         }
//         .fro-refresh-btn:hover { background: #e9edf2; }
//         .fro-spin { animation: spin 0.8s linear infinite; }
//         @keyframes spin { to { transform: rotate(360deg); } }
//       `}</style>

//       {/* ============ HEADER ============ */}
//       <div className="dash-header">
//         <div>
//           <span style={{ fontSize: 12, fontWeight: 600, color: MINT, textTransform: 'uppercase', letterSpacing: 0.8 }}>
//             {greeting} · {dateStr}
//           </span>
//           <h2 className="dash-header-title" style={{ marginTop: 2 }}>Dashboard Overview</h2>
//           <p className="dash-header-sub">Operational insights across all NGOs and departments.</p>
//         </div>
//         <div className="dash-header-actions">
//           <div className="dash-period-bar">
//             {PERIODS.map(p => (
//               <button
//                 key={p.key}
//                 className={`dash-period-btn${period === p.key ? ' active' : ''}`}
//                 disabled={loading}
//                 onClick={() => setPeriod(p.key)}
//               >
//                 {loading && period === p.key ? '\u25c9 ' : ''}{p.label}
//               </button>
//             ))}
//           </div>
//           <button className="btn btn-primary btn-sm" onClick={() => exportToExcel(data, period)}>
//             <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'text-bottom', marginRight: 4 }}>download</span>
//             Export Report
//           </button>
//         </div>
//       </div>

//       {/* ============ LOW ATTENDANCE ALERT (clickable) ============ */}
//       {attendancePercent < 60 && (
//         <div
//           className="nd-appear"
//           style={{
//             display: 'flex', alignItems: 'center', gap: 12,
//             background: 'rgba(255,127,80,0.08)',
//             border: '1px solid rgba(255,127,80,0.3)',
//             borderRadius: 16, padding: '12px 18px', marginBottom: 20,
//             animationDelay: '0.05s',
//           }}
//         >
//           <div style={{
//             width: 36, height: 36, borderRadius: 11, flexShrink: 0,
//             background: 'rgba(255,127,80,0.15)',
//             display: 'flex', alignItems: 'center', justifyContent: 'center',
//           }}>
//             <span className="material-symbols-outlined" style={{ color: CORAL, fontSize: 20 }}>warning</span>
//           </div>
//           <div style={{ flex: 1, minWidth: 0 }}>
//             <strong style={{ fontSize: 13.5, color: PRIMARY, display: 'block' }}>
//               Attendance is low — {attendancePercent}%
//             </strong>
//             <span style={{ fontSize: 12, color: '#64748b' }}>
//               Attendance dropped below 60% for the selected period.
//             </span>
//           </div>
//           <button
//             onClick={openAbsentees}
//             style={{
//               border: `1px solid ${CORAL}`, background: CORAL, color: '#fff',
//               borderRadius: 10, padding: '7px 16px', fontSize: 12, fontWeight: 700,
//               cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
//             }}
//           >
//             View absentees
//           </button>
//         </div>
//       )}

//       {/* ============ METRIC CARDS (Total Users removed) ============ */}
//       <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
//         {metricCards.map((card, i) => {
//           const trend = getTrend(card.changeKey)
//           const isFro = card.isFroCard
//           return (
//             <div
//               key={card.label}
//               className={`nd-card nd-metric nd-appear${isFro ? ' nd-fro-card' : ''}`}
//               style={{ animationDelay: `${0.08 * (i + 1)}s`, cursor: isFro ? 'pointer' : 'default' }}
//               onClick={card.onClick}
//             >
//               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
//                 <span style={{ fontSize: 11.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
//                   {card.label}
//                 </span>
//                 <div style={{
//                   width: 38, height: 38, borderRadius: 12,
//                   background: isFro ? 'rgba(139,92,246,0.12)' : 'rgba(62,180,137,0.1)',
//                   display: 'flex', alignItems: 'center', justifyContent: 'center',
//                 }}>
//                   <span className="material-symbols-outlined" style={{ color: isFro ? '#8b5cf6' : MINT, fontSize: 20 }}>{card.icon}</span>
//                 </div>
//               </div>
//               <div style={{ marginTop: 10 }}>
//                 <span style={{ fontSize: 34, fontWeight: 800, color: PRIMARY, lineHeight: 1 }}>
//                   {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}{card.suffix || ''}
//                 </span>
//                 {isFro && (
//                   <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
//                     <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#8b5cf6' }}>visibility</span>
//                     <span style={{ fontSize: 12, fontWeight: 700, color: '#8b5cf6' }}>Live Status</span>
//                   </div>
//                 )}
//                 {trend && !isFro && (
//                   <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
//                     <span
//                       className="material-symbols-outlined"
//                       style={{ fontSize: 16, color: trend.direction === 'up' ? MINT : trend.direction === 'down' ? CORAL : '#94a3b8' }}
//                     >
//                       {trend.direction === 'up' ? 'trending_up' : trend.direction === 'down' ? 'trending_down' : 'trending_flat'}
//                     </span>
//                     <span style={{ fontSize: 12, fontWeight: 700, color: trend.direction === 'up' ? MINT : trend.direction === 'down' ? CORAL : '#94a3b8' }}>
//                       {trend.text}
//                     </span>
//                   </div>
//                 )}
//               </div>
//             </div>
//           )
//         })}
//       </div>

//       {/* ============ PANEL LINKS ============ */}
//       <div className="panel-link-grid">
//         <div className="panel-link-card" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }} onClick={() => setPanelModal('accounts')}>
//           <span className="material-symbols-outlined">receipt_long</span>
//           <span className="panel-link-label">Accounts</span>
//           <span className="panel-link-sub">Verify & manage leads</span>
//         </div>
//         <div className="panel-link-card" style={{ background: 'linear-gradient(135deg, #3EB489, #2d8f6e)' }} onClick={() => setPanelModal('fro')}>
//           <span className="material-symbols-outlined">groups</span>
//           <span className="panel-link-label">FRO</span>
//           <span className="panel-link-sub">Field operations & donors</span>
//         </div>
//         <div className="panel-link-card" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }} onClick={() => setPanelModal('hr')}>
//           <span className="material-symbols-outlined">badge</span>
//           <span className="panel-link-label">HR</span>
//           <span className="panel-link-sub">Employees & attendance</span>
//         </div>
//         <div className="panel-link-card" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }} onClick={() => setPanelModal('ngo-admin')}>
//           <span className="material-symbols-outlined">corporate_fare</span>
//           <span className="panel-link-label">NGO Admin</span>
//           <span className="panel-link-sub">NGO management & donors</span>
//         </div>
//         <div className="panel-link-card" style={{ background: 'linear-gradient(135deg, #f5b301, #d49500)' }} onClick={() => setPanelModal('recruiter')}>
//           <span className="material-symbols-outlined">person_search</span>
//           <span className="panel-link-label">Recruiter</span>
//           <span className="panel-link-sub">Lead pipeline & candidates</span>
//         </div>
//       </div>

//       {/* ============ ACCOUNTS SUMMARY ============ */}
//       <div className="nd-card nd-appear" style={{ animationDelay: '0.2s', marginTop: 20, padding: '18px 20px' }}>
//         <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
//           <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#8b5cf6' }}>receipt_long</span>
//           <h3 className="nd-section-title" style={{ margin: 0 }}>Accounts — Lead Verification</h3>
//         </div>
//         <div className="mini-card-grid">
//           <div className="mini-card mini-card-clickable" style={{ borderTop: `3px solid #f59e0b` }} onClick={() => setAccountsModalStatus('pending')}>
//             <span className="mini-card-label">Pending</span>
//             <span className="mini-card-value">{accountsSummary.pending ?? 0}</span>
//             <span className="mini-card-sub">₹{(accountsSummary.pendingAmount || 0).toLocaleString('en-IN')}</span>
//           </div>
//           <div className="mini-card mini-card-clickable" style={{ borderTop: `3px solid ${MINT}` }} onClick={() => setAccountsModalStatus('verified')}>
//             <span className="mini-card-label">Verified</span>
//             <span className="mini-card-value">{accountsSummary.verified ?? 0}</span>
//             <span className="mini-card-sub">₹{(accountsSummary.verifiedAmount || 0).toLocaleString('en-IN')}</span>
//           </div>
//           <div className="mini-card mini-card-clickable" style={{ borderTop: `3px solid #f43f5e` }} onClick={() => setAccountsModalStatus('rejected')}>
//             <span className="mini-card-label">Rejected</span>
//             <span className="mini-card-value">{accountsSummary.rejected ?? 0}</span>
//             <span className="mini-card-sub">₹{(accountsSummary.rejectedAmount || 0).toLocaleString('en-IN')}</span>
//           </div>
//           <div className="mini-card mini-card-clickable" style={{ borderTop: `3px solid #3b82f6` }} onClick={() => setAccountsModalStatus('verified_today')}>
//             <span className="mini-card-label">Verified Today</span>
//             <span className="mini-card-value">{accountsSummary.verifiedToday ?? 0}</span>
//             <span className="mini-card-sub">₹{(accountsSummary.verifiedTodayAmount || 0).toLocaleString('en-IN')}</span>
//           </div>
//         </div>
//       </div>

//       {/* ============ RECRUITER SUMMARY ============ */}
//       <div className="nd-card nd-appear" style={{ animationDelay: '0.25s', marginTop: 16, padding: '18px 20px' }}>
//         <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
//           <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#f5b301' }}>person_search</span>
//           <h3 className="nd-section-title" style={{ margin: 0 }}>Recruiter — Lead Pipeline</h3>
//         </div>
//         <div className="mini-card-grid">
//           <div className="mini-card mini-card-clickable" style={{ borderTop: `3px solid #8b5cf6` }} onClick={() => setRecruiterModalType('total_leads')}>
//             <span className="mini-card-label">Total Leads</span>
//             <span className="mini-card-value">{(recruiterSummary.totalLeads || 0).toLocaleString()}</span>
//             <span className="mini-card-sub">All time</span>
//           </div>
//           <div className="mini-card mini-card-clickable" style={{ borderTop: `3px solid ${MINT}` }} onClick={() => setRecruiterModalType('new_today')}>
//             <span className="mini-card-label">New Today</span>
//             <span className="mini-card-value">{recruiterSummary.newToday ?? 0}</span>
//             <span className="mini-card-sub">Added today</span>
//           </div>
//           <div className="mini-card mini-card-clickable" style={{ borderTop: `3px solid #f5b301` }} onClick={() => setRecruiterModalType('conversion_rate')}>
//             <span className="mini-card-label">Conversion Rate</span>
//             <span className="mini-card-value">{(recruiterSummary.conversionRate ?? 0).toFixed(1)}%</span>
//             <span className="mini-card-sub">Selected vs Rejected</span>
//           </div>
//         </div>
//       </div>

//       {/* ============ MAIN GRID ============ */}
//       <div className="dash-grid">
//         <div className="dash-grid-main">

//           {/* ---- WORKERS BY DEPARTMENT — new tile design ---- */}
//           <div className="nd-card nd-appear" style={{ animationDelay: '0.5s', marginBottom: 20 }}>
//             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
//               <h3 className="nd-section-title">Workers by Department</h3>
//               <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{totalDeptWorkers} total</span>
//             </div>
//             {deptData.length === 0 ? (
//               <p className="nd-muted">No department data</p>
//             ) : (
//               <div className="nd-dept-grid">
//                 {deptData.map((d, i) => {
//                   const c = DEPT_COLORS[i % DEPT_COLORS.length]
//                   const pct = Math.round((d.value / totalDeptWorkers) * 100)
//                   return (
//                     <div key={d.name} className="nd-dept-tile" style={{ background: c.soft, borderColor: `${c.main}20` }}>
//                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
//                         <span className="nd-dept-name" style={{ color: c.main }}>{d.name}</span>
//                         <span className="nd-dept-pct">{pct}%</span>
//                       </div>
//                       <span className="nd-dept-count">{d.value}</span>
//                       <div className="nd-dept-share">
//                         <div style={{ width: animated ? `${pct}%` : '0%', background: c.main }} />
//                       </div>
//                     </div>
//                   )
//                 })}
//               </div>
//             )}
//           </div>

//           {/* ---- NGO WISE FRO'S ASSIGNED ---- */}
//           <div className="nd-card nd-appear" style={{ animationDelay: '0.6s' }}>
//             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
//               <h3 className="nd-section-title">NGO Wise FRO's Assigned</h3>
//               {froAssignments.length > 0 && (
//                 <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{froAssignments.length} FROs</span>
//               )}
//             </div>

//             {/* per-NGO totals */}
//             {ngoTotals.length > 0 && (
//               <div className="nd-fro-summary">
//                 {ngoTotals.map(t => (
//                   <div key={t.name} className="nd-fro-summary-pill" style={{ background: `${ngoColor(t.name)}14`, color: ngoColor(t.name) }}>
//                     <span style={{ width: 8, height: 8, borderRadius: '50%', background: ngoColor(t.name) }} />
//                     {t.name}
//                     <span style={{
//                       background: '#fff', borderRadius: 8, padding: '1px 8px',
//                       fontSize: 11.5, color: PRIMARY,
//                     }}>
//                       {froAssignments.length > 0 ? t.count : (ngoUserCounts.find(n => n.name === t.name)?.workers || 0)}
//                     </span>
//                   </div>
//                 ))}
//               </div>
//             )}

//             {/* who works for which NGO */}
//             {froAssignments.length === 0 ? (
//               <p className="nd-muted">
//                 FRO assignment data not available yet. Backend should send <code style={{ background: '#f4f6f9', padding: '1px 6px', borderRadius: 6 }}>froAssignments</code> — each FRO with their assigned NGOs.
//               </p>
//             ) : (
//               <div className="nd-fro-list">
//                 {froAssignments.map((f, i) => (
//                   <div key={f.name + i} className="nd-fro-row">
//                     <span className="nd-avatar" style={{ background: 'rgba(9,20,38,0.06)', color: PRIMARY }}>
//                       {f.name?.charAt(0).toUpperCase() || '?'}
//                     </span>
//                     <div style={{ minWidth: 0 }}>
//                       <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: PRIMARY }}>{f.name}</span>
//                       <span style={{ fontSize: 11, color: '#94a3b8' }}>
//                         {(f.ngos || []).length === allNgoNames.length && allNgoNames.length > 1
//                           ? 'Works for all NGOs'
//                           : `${(f.ngos || []).length} NGO${(f.ngos || []).length > 1 ? 's' : ''}`}
//                       </span>
//                     </div>
//                     <div className="nd-fro-chips">
//                       {(f.ngos || []).map(ngo => (
//                         <span key={ngo} className="nd-ngo-chip" style={{ background: `${ngoColor(ngo)}16`, color: ngoColor(ngo) }}>
//                           {ngo}
//                         </span>
//                       ))}
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>
//         </div>

//         <div className="dash-grid-side">

//           {/* ---- DAILY CHECK-INS — clickable ---- */}
//           <div className="nd-card nd-appear" style={{ animationDelay: '0.7s', marginBottom: 20 }}>
//             <h3 className="nd-section-title">Daily Check-ins</h3>
//             {attSegments.length === 0 ? (
//               <p className="nd-muted">No attendance data</p>
//             ) : (
//               <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginTop: 14 }}>
//                 <DonutChart
//                   segments={attSegments}
//                   size={150}
//                   animated={animated}
//                   onSegmentClick={openAttendanceList}
//                 />
//                 <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
//                   {attSegments.map(s => (
//                     <button
//                       key={s.label}
//                       className="nd-att-pill"
//                       style={{ background: `${s.color}0F`, borderColor: `${s.color}30` }}
//                       onClick={() => openAttendanceList(s.label)}
//                     >
//                       <span className="material-symbols-outlined" style={{ color: s.color, fontSize: 19 }}>{s.icon}</span>
//                       <span style={{ fontSize: 13, fontWeight: 600, color: PRIMARY, flex: 1 }}>{s.label}</span>
//                       <span style={{ fontSize: 15, fontWeight: 800, color: s.color }}>{s.value}</span>
//                       <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#b6c0cc' }}>chevron_right</span>
//                     </button>
//                   ))}
//                 </div>
//                 <span style={{ fontSize: 11, color: '#94a3b8' }}>Tap any status to see worker names</span>
//               </div>
//             )}
//           </div>

//           {/* ---- RECENT NOTICES — scrollable, shows all ---- */}
//           <div className="nd-card nd-appear" style={{ animationDelay: '0.8s', marginBottom: 20 }}>
//             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
//               <h3 className="nd-section-title">Recent Notices</h3>
//               {recentNotices.length > 0 && (
//                 <span style={{
//                   fontSize: 11, fontWeight: 700, color: MINT,
//                   background: 'rgba(62,180,137,0.1)', borderRadius: 99, padding: '3px 10px',
//                 }}>
//                   {recentNotices.length}
//                 </span>
//               )}
//             </div>
//             {recentNotices.length === 0 ? (
//               <p className="nd-muted">No recent notices</p>
//             ) : (
//               <div className={recentNotices.length > 3 ? 'nd-scroll-fade' : ''}>
//                 <div className="nd-scroll-list">
//                   {recentNotices.map((n, i) => (
//                     <div key={n.id || i} className="nd-notice">
//                       <div className="nd-notice-icon" style={{ background: i % 2 === 0 ? PRIMARY : MINT }}>
//                         <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 18 }}>
//                           {i % 2 === 0 ? 'priority_high' : 'campaign'}
//                         </span>
//                       </div>
//                       <div style={{ minWidth: 0, flex: 1 }}>
//                         <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: PRIMARY }}>{n.title}</h4>
//                         <p style={{ margin: '3px 0 4px', fontSize: 12, color: '#64748b', lineHeight: 1.45 }}>
//                           {n.content && n.content.length > 110 ? n.content.slice(0, 110) + '\u2026' : n.content || ''}
//                         </p>
//                         <span style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600 }}>
//                           {new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
//                         </span>
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             )}
//           </div>

//           {/* ---- UPCOMING EVENTS — scrollable, shows all ---- */}
//           <div className="nd-card nd-appear" style={{ animationDelay: '0.9s' }}>
//             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
//               <h3 className="nd-section-title">Upcoming Events</h3>
//               {upcomingEvents.length > 0 && (
//                 <span style={{
//                   fontSize: 11, fontWeight: 700, color: CORAL,
//                   background: 'rgba(255,127,80,0.1)', borderRadius: 99, padding: '3px 10px',
//                 }}>
//                   {upcomingEvents.length}
//                 </span>
//               )}
//             </div>
//             {upcomingEvents.length === 0 ? (
//               <p className="nd-muted">No upcoming events</p>
//             ) : (
//               <>
//                 <div className={upcomingEvents.length > 3 ? 'nd-scroll-fade' : ''}>
//                   <div className="nd-scroll-list">
//                     {upcomingEvents.map((ev, i) => {
//                       const d = new Date(ev.event_date)
//                       return (
//                         <div key={ev.id || i} className="nd-event">
//                           <div className="nd-event-date">
//                             <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.8 }}>
//                               {d.toLocaleString('en-IN', { month: 'short' })}
//                             </span>
//                             <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{d.getDate()}</span>
//                           </div>
//                           <div style={{ minWidth: 0 }}>
//                             <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: PRIMARY }}>{ev.title}</h4>
//                             <p style={{ margin: '3px 0 0', fontSize: 11.5, color: '#94a3b8' }}>
//                               {ev.location && <span>{ev.location}</span>}
//                               {ev.event_time && <span> \u2022 {ev.event_time.slice(0, 5)}</span>}
//                             </p>
//                           </div>
//                         </div>
//                       )
//                     })}
//                   </div>
//                 </div>
//                 <button
//                   onClick={() => navigate('/sa/events')}
//                   style={{
//                     width: '100%', marginTop: 14, padding: '10px 0',
//                     border: `1.5px dashed ${MINT}`, background: 'rgba(62,180,137,0.05)',
//                     color: MINT, borderRadius: 12, fontSize: 12, fontWeight: 700,
//                     letterSpacing: 0.6, cursor: 'pointer', fontFamily: 'inherit',
//                   }}
//                 >
//                   + ADD NEW EVENT
//                 </button>
//               </>
//             )}
//           </div>
//         </div>
//       </div>

//       {/* ============ FRO LIVE MODAL ============ */}
//       {showFroModal && (
//         <FroLiveModal
//           froLive={froLive}
//           loadingFro={loadingFro}
//           onClose={() => setShowFroModal(false)}
//           onRefresh={fetchFroLive}
//         />
//       )}

//       {/* ============ NAME LIST MODAL ============ */}
//       {modal && (
//         <NameListModal
//           title={modal.title}
//           color={modal.color}
//           names={modal.names}
//           onClose={() => setModal(null)}
//         />
//       )}

//       {/* ============ ACCOUNTS DETAIL MODAL ============ */}
//       {accountsModalStatus && (
//         <AccountsDetailModal
//           status={accountsModalStatus}
//           onClose={() => setAccountsModalStatus(null)}
//         />
//       )}

//       {/* ============ RECRUITER DETAIL MODAL ============ */}
//       {recruiterModalType && (
//         <RecruiterDetailModal
//           type={recruiterModalType}
//           onClose={() => setRecruiterModalType(null)}
//         />
//       )}

//       {/* ============ PANEL SUMMARY MODAL ============ */}
//       {panelModal && (
//         <PanelSummaryModal
//           panel={panelModal}
//           dashboardData={data}
//           onClose={() => setPanelModal(null)}
//         />
//       )}
//     </div>
//   )
// }



import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboard, getFroLiveStatus, getAccountsLeads, getRecruiterLeads, getWorkers, getAttendance } from '../api/endpoints'

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
  if (name && name.toLowerCase().startsWith('bsct')) return '#60a5fa'
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

/* ================= FRO LIVE MODAL ================= */
function FroLiveModal({ froLive, loadingFro, onClose, onRefresh }) {
  return (
    <div className="nd-modal-overlay" onClick={onClose}>
      <div className="nd-modal fro-modal" onClick={e => e.stopPropagation()}>
        <div className="nd-modal-head" style={{ borderColor: `${MINT}50` }}>
          <span className="material-symbols-outlined" style={{ color: MINT_DEEP, fontSize: 22 }}>groups</span>
          <h3 className="nd-modal-title">FRO Live Status</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 4 }}>
            {loadingFro && <span className="material-symbols-outlined fro-spin" style={{ fontSize: 18, color: '#94a3b8' }}>refresh</span>}
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
              {froLive.filter(f => f.is_punched_in).length}/{froLive.length} active
            </span>
            <button className="fro-refresh-btn" onClick={onRefresh} title="Refresh">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
            </button>
          </div>
          <button className="nd-modal-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="nd-modal-body" style={{ padding: 0 }}>
          <div className="fro-live-table-wrap">
            {froLive.length === 0 && !loadingFro ? (
              <p className="nd-muted" style={{ padding: 24, textAlign: 'center' }}>No FRO workers found.</p>
            ) : (
              <table className="fro-live-table">
                <thead>
                  <tr>
                    <th>FRO Name</th>
                    <th>Status</th>
                    <th>Punch In</th>
                    <th>Total Data</th>
                    <th>Used</th>
                    <th>Unused</th>
                    <th>Today Collection</th>
                  </tr>
                </thead>
                <tbody>
                  {froLive.map(f => (
                    <tr key={f.id}>
                      <td>
                        <span className="fro-name">{f.name || f.login_id || 'Unknown'}</span>
                        {f.login_id && <span className="fro-login-id">{f.login_id}</span>}
                      </td>
                      <td>
                        <span className={`fro-status-dot ${f.is_active ? 'active' : 'inactive'}`} />
                        {f.is_active ? 'Active' : 'Inactive'}
                      </td>
                      <td>{f.is_punched_in ? <span className="fro-badge fro-badge-green">Punched</span> : <span className="fro-badge fro-badge-red">Not yet</span>}</td>
                      <td className="fro-num">{f.total_data}</td>
                      <td className="fro-num">{f.data_used}</td>
                      <td className="fro-num">{f.data_unused}</td>
                      <td className="fro-num fro-amt">₹{(f.today_collection || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="fro-live-footer" style={{ padding: '10px 16px' }}>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Auto-refreshes every 30s</span>
          </div>
        </div>
      </div>
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
                  <div className="ps-card" style={{ borderTop: `3px solid ${GOLD}` }}>
                    <span className="ps-label">⏳ Pending</span>
                    <span className="ps-value">{data.pending?.count ?? 0}</span>
                    <span className="ps-sub">₹{(data.pending?.amount || 0).toLocaleString('en-IN')} total</span>
                  </div>
                  <div className="ps-card" style={{ borderTop: `3px solid ${MINT_DEEP}` }}>
                    <span className="ps-label">✔️ Verified</span>
                    <span className="ps-value">{data.verified?.count ?? 0}</span>
                    <span className="ps-sub">₹{(data.verified?.amount || 0).toLocaleString('en-IN')} total</span>
                  </div>
                  <div className="ps-card" style={{ borderTop: `3px solid ${SLATE}` }}>
                    <span className="ps-label">📅 Verified Today</span>
                    <span className="ps-value">{data.verifiedToday?.count ?? 0}</span>
                    <span className="ps-sub">₹{(data.verifiedToday?.amount || 0).toLocaleString('en-IN')} collected</span>
                  </div>
                  <div className="ps-card" style={{ borderTop: `3px solid ${MINT_DARK}` }}>
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
                    <div className="ps-card" style={{ gridColumn: '1 / -1', borderTop: `3px solid ${SLATE}` }}>
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

export default function Dashboard() {
  const [period, setPeriod] = useState('all')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [animated, setAnimated] = useState(false)
  const [modal, setModal] = useState(null) // { title, color, names }
  const [froLive, setFroLive] = useState([])
  const [loadingFro, setLoadingFro] = useState(false)
  const [showFroModal, setShowFroModal] = useState(false)
  const [accountsModalStatus, setAccountsModalStatus] = useState(null)
  const [recruiterModalType, setRecruiterModalType] = useState(null)
  const [panelModal, setPanelModal] = useState(null)
  const froTimer = useRef(null)
  const navigate = useNavigate()

  useEffect(() => { const t = setTimeout(() => setAnimated(true), 150); return () => clearTimeout(t) }, [])

  useEffect(() => {
    setLoading(true)
    getDashboard(period)
      .then(d => setData(d))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [period])

  function fetchFroLive() {
    setLoadingFro(true)
    getFroLiveStatus()
      .then(setFroLive)
      .catch(() => {})
      .finally(() => setLoadingFro(false))
  }

  useEffect(() => {
    if (!showFroModal) {
      clearInterval(froTimer.current)
      return
    }
    fetchFroLive()
    froTimer.current = setInterval(fetchFroLive, 30000)
    return () => clearInterval(froTimer.current)
  }, [showFroModal])

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
  } = data

  const today = new Date()
  const hour = today.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr = today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const CARD_COLORS = [
    { icon: '#3B82F6', bg: '#EFF6FF' },  // Total Workers - blue
    { icon: '#F59E0B', bg: '#FFFBEB' },  // Active Workers - amber
    { icon: '#8B5CF6', bg: '#F5F3FF' },  // Attendance % - purple
    { icon: '#EC4899', bg: '#FDF2F8' },  // ALL FRO - pink
  ]

  /* -------- metric cards (Total Users removed) -------- */
  const metricCards = [
    { label: 'Total Workers', value: stats.totalWorkers || 0, icon: 'badge', changeKey: 'totalWorkers', color: CARD_COLORS[0] },
    { label: 'Active Workers', value: stats.activeWorkers || 0, icon: 'bolt', changeKey: 'reach', color: CARD_COLORS[1] },
    { label: 'Attendance %', value: attendancePercent, suffix: '%', icon: 'event_available', changeKey: 'attendancePercent', color: CARD_COLORS[2] },
    { label: 'ALL FRO', value: froLive.length || '\u2014', icon: 'groups', isFroCard: true, onClick: () => setShowFroModal(true), color: CARD_COLORS[3] },
  ]

  function getTrend(changeKey) {
    if (changeKey === 'reach') return { direction: 'up', text: '100% Reach' }
    const v = kpiChanges[changeKey]
    if (v === undefined || v === null) return null
    if (v > 0) return { direction: 'up', text: `+${Math.abs(v)}%` }
    if (v < 0) return { direction: 'down', text: `-${Math.abs(v)}%` }
    return { direction: 'flat', text: 'Stable' }
  }

  /* -------- departments (HR-Recruitment removed) -------- */
  const HIDE_DEPTS = ['hr-recruitment', 'hr recruitment', 'hr_recruitment', 'hrrecruitment']
  const deptData = Object.entries(deptWorkers || {})
    .filter(([name]) => !HIDE_DEPTS.includes(name.toLowerCase().trim()))
    .map(([name, value]) => ({ name, value }))
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
          background: ${MINT_DARK}; color: #fff;
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
          border-radius: 16px; padding: 20px 18px; cursor: pointer;
          display: flex; flex-direction: column; gap: 8px;
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
          font-size: 22px;
          width: 40px; height: 40px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
        }
        .panel-link-label { font-size: 17px; font-weight: 800; letter-spacing: -0.3px; color: ${MINT_DARK}; }
        .panel-link-sub { font-size: 11px; color: #5F7269; font-weight: 500; }

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
      `}</style>

      {/* ============ HEADER ============ */}
      <div className="dash-header">
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: MINT_DEEP, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {greeting} · {dateStr}
          </span>
          <h2 className="dash-header-title" style={{ marginTop: 2, color: MINT_DARK }}>Dashboard Overview</h2>
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
              Attendance dropped below 60% for the selected period.
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

      {/* ============ METRIC CARDS (Total Users removed) ============ */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {metricCards.map((card, i) => {
          const trend = getTrend(card.changeKey)
          const isFro = card.isFroCard
          return (
            <div
              key={card.label}
              className={`nd-card nd-metric nd-appear${isFro ? ' nd-fro-card' : ''}`}
              style={{ animationDelay: `${0.08 * (i + 1)}s`, cursor: isFro ? 'pointer' : 'default' }}
              onClick={card.onClick}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
                  {card.label}
                </span>
                <div style={{
                  width: 38, height: 38, borderRadius: 12,
                  background: card.color?.bg || MINT_LIGHT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span className="material-symbols-outlined" style={{ color: card.color?.icon || MINT_DARK, fontSize: 20 }}>{card.icon}</span>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <span style={{ fontSize: 34, fontWeight: 800, color: PRIMARY, lineHeight: 1 }}>
                  {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}{card.suffix || ''}
                </span>
                {isFro && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: card.color?.icon || MINT_DEEP }}>visibility</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: card.color?.icon || MINT_DEEP }}>Live Status</span>
                  </div>
                )}
                {trend && !isFro && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 16, color: card.color?.icon || MINT_DEEP }}
                    >
                      {trend.direction === 'up' ? 'trending_up' : trend.direction === 'down' ? 'trending_down' : 'trending_flat'}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: card.color?.icon || MINT_DEEP }}>
                      {trend.text}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ============ PANEL LINKS — uniform mint cards ============ */}
      <div className="panel-link-grid">
        <div className="panel-link-card" style={{ borderLeftColor: '#8B5CF6' }} onClick={() => setPanelModal('accounts')}>
          <span className="material-symbols-outlined" style={{ background: '#F5F3FF', color: '#8B5CF6' }}>receipt_long</span>
          <span className="panel-link-label" style={{ color: '#8B5CF6' }}>Accounts</span>
          <span className="panel-link-sub">Verify & manage leads</span>
        </div>
        <div className="panel-link-card" style={{ borderLeftColor: '#EC4899' }} onClick={() => setPanelModal('fro')}>
          <span className="material-symbols-outlined" style={{ background: '#FDF2F8', color: '#EC4899' }}>groups</span>
          <span className="panel-link-label" style={{ color: '#EC4899' }}>FRO</span>
          <span className="panel-link-sub">Field operations & donors</span>
        </div>
        <div className="panel-link-card" style={{ borderLeftColor: '#3B82F6' }} onClick={() => setPanelModal('hr')}>
          <span className="material-symbols-outlined" style={{ background: '#EFF6FF', color: '#3B82F6' }}>badge</span>
          <span className="panel-link-label" style={{ color: '#3B82F6' }}>HR</span>
          <span className="panel-link-sub">Employees & attendance</span>
        </div>
        <div className="panel-link-card" style={{ borderLeftColor: '#F59E0B' }} onClick={() => setPanelModal('ngo-admin')}>
          <span className="material-symbols-outlined" style={{ background: '#FFFBEB', color: '#F59E0B' }}>corporate_fare</span>
          <span className="panel-link-label" style={{ color: '#F59E0B' }}>NGO Admin</span>
          <span className="panel-link-sub">NGO management & donors</span>
        </div>
        <div className="panel-link-card" style={{ borderLeftColor: '#10B981' }} onClick={() => setPanelModal('recruiter')}>
          <span className="material-symbols-outlined" style={{ background: '#ECFDF5', color: '#10B981' }}>person_search</span>
          <span className="panel-link-label" style={{ color: '#10B981' }}>Recruiter</span>
          <span className="panel-link-sub">Lead pipeline & candidates</span>
        </div>
      </div>

      {/* ============ MAIN GRID ============ */}
      <div className="dash-grid">
        <div className="dash-grid-main">

          {/* ---- WORKERS BY DEPARTMENT — mint tile design ---- */}
          <div className="nd-card nd-appear" style={{ animationDelay: '0.5s', marginBottom: 4, minHeight: 320 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="nd-section-title">Workers by Department</h3>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{totalDeptWorkers} total</span>
            </div>
            {deptData.length === 0 ? (
              <p className="nd-muted">No department data</p>
            ) : (
              <div className="nd-bar-list">
                {deptData.map((d, i) => {
                  const color = DEPT_COLORS[i % DEPT_COLORS.length]
                  const pct = Math.round((d.value / totalDeptWorkers) * 100)
                  return (
                    <div key={d.name} className="nd-bar-row">
                      <span className="nd-bar-dot" style={{ background: color }} />
                      <span className="nd-bar-label" title={d.name}>{d.name}</span>
                      <div className="nd-bar-track">
                        <div className="nd-bar-fill" style={{ width: animated ? `${pct}%` : '0%', background: color }} />
                      </div>
                      <span className="nd-bar-value">{d.value}<small>{pct}%</small></span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ---- NGO WISE FRO'S ASSIGNED ---- */}
          <div className="nd-card nd-appear" style={{ animationDelay: '0.6s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="nd-section-title">NGO Wise FRO's Assigned</h3>
              {froAssignments.length > 0 && (
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{froAssignments.length} FROs</span>
              )}
            </div>

            {/* per-NGO totals */}
            {ngoTotals.length > 0 && (
              <div className="nd-fro-summary">
                {ngoTotals.map(t => (
                  <div key={t.name} className="nd-fro-summary-pill" style={{ background: `${ngoColor(t.name)}14`, color: ngoColor(t.name) }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: ngoColor(t.name) }} />
                    {t.name}
                    <span style={{
                      background: '#fff', borderRadius: 8, padding: '1px 8px',
                      fontSize: 11.5, color: PRIMARY,
                    }}>
                      {froAssignments.length > 0 ? t.count : (ngoUserCounts.find(n => n.name === t.name)?.workers || 0)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* who works for which NGO */}
            {froAssignments.length === 0 ? (
              <p className="nd-muted">
                FRO assignment data not available yet. Backend should send <code style={{ background: MINT_LIGHT, padding: '1px 6px', borderRadius: 6 }}>froAssignments</code> — each FRO with their assigned NGOs.
              </p>
            ) : (
              <div className="nd-fro-list">
                {froAssignments.map((f, i) => (
                  <div key={f.name + i} className="nd-fro-row">
                    <span className="nd-avatar" style={{ background: MINT_LIGHT, color: MINT_DARK }}>
                      {f.name?.charAt(0).toUpperCase() || '?'}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: PRIMARY }}>{f.name}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>
                        {(f.ngos || []).length === allNgoNames.length && allNgoNames.length > 1
                          ? 'Works for all NGOs'
                          : `${(f.ngos || []).length} NGO${(f.ngos || []).length > 1 ? 's' : ''}`}
                      </span>
                    </div>
                    <div className="nd-fro-chips">
                      {(f.ngos || []).map(ngo => (
                        <span key={ngo} className="nd-ngo-chip" style={{ background: `${ngoColor(ngo)}16`, color: ngoColor(ngo) }}>
                          {ngo}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="dash-grid-side">

          {/* ---- DAILY CHECK-INS — clickable ---- */}
          <div className="nd-card nd-appear" style={{ animationDelay: '0.7s', marginBottom: 20, minHeight: 520, display: 'flex', flexDirection: 'column' }}>
            <h3 className="nd-section-title">Daily Check-ins</h3>
            {attSegments.length === 0 ? (
              <p className="nd-muted">No attendance data</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginTop: 14, flex: 1, justifyContent: 'center' }}>
                <DonutChart
                  segments={attSegments}
                  size={170}
                  animated={animated}
                  onSegmentClick={openAttendanceList}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                  {attSegments.map(s => (
                    <button
                      key={s.label}
                      className="nd-att-pill"
                      style={{ background: `${s.color}22`, borderColor: `${s.color}66` }}
                      onClick={() => openAttendanceList(s.label)}
                    >
                      <span className="material-symbols-outlined" style={{ color: s.text, fontSize: 19 }}>{s.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: PRIMARY, flex: 1 }}>{s.label}</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: s.text }}>{s.value}</span>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#b6c0cc' }}>chevron_right</span>
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>Tap any status to see worker names</span>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ============ ACCOUNTS SUMMARY ============ */}
      <div className="nd-card nd-appear" style={{ animationDelay: '0.2s', marginTop: 20, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: MINT_DEEP }}>receipt_long</span>
          <h3 className="nd-section-title" style={{ margin: 0 }}>Accounts — Lead Verification</h3>
        </div>
        <div className="mini-card-grid">
          <div className="mini-card mini-card-clickable" style={{ borderTop: `3px solid ${GOLD}` }} onClick={() => setAccountsModalStatus('pending')}>
            <span className="mini-card-label">Pending</span>
            <span className="mini-card-value">{accountsSummary.pending ?? 0}</span>
            <span className="mini-card-sub">₹{(accountsSummary.pendingAmount || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="mini-card mini-card-clickable" style={{ borderTop: `3px solid ${MINT_DEEP}` }} onClick={() => setAccountsModalStatus('verified')}>
            <span className="mini-card-label">Verified</span>
            <span className="mini-card-value">{accountsSummary.verified ?? 0}</span>
            <span className="mini-card-sub">₹{(accountsSummary.verifiedAmount || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="mini-card mini-card-clickable" style={{ borderTop: `3px solid ${RED_DEEP}` }} onClick={() => setAccountsModalStatus('rejected')}>
            <span className="mini-card-label">Rejected</span>
            <span className="mini-card-value">{accountsSummary.rejected ?? 0}</span>
            <span className="mini-card-sub">₹{(accountsSummary.rejectedAmount || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="mini-card mini-card-clickable" style={{ borderTop: `3px solid ${SLATE}` }} onClick={() => setAccountsModalStatus('verified_today')}>
            <span className="mini-card-label">Verified Today</span>
            <span className="mini-card-value">{accountsSummary.verifiedToday ?? 0}</span>
            <span className="mini-card-sub">₹{(accountsSummary.verifiedTodayAmount || 0).toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* ============ RECRUITER SUMMARY ============ */}
      <div className="nd-card nd-appear" style={{ animationDelay: '0.25s', marginTop: 16, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: GOLD }}>person_search</span>
          <h3 className="nd-section-title" style={{ margin: 0 }}>Recruiter — Lead Pipeline</h3>
        </div>
        <div className="mini-card-grid">
          <div className="mini-card mini-card-clickable" style={{ borderTop: `3px solid ${MINT_DARK}` }} onClick={() => setRecruiterModalType('total_leads')}>
            <span className="mini-card-label">Total Leads</span>
            <span className="mini-card-value">{(recruiterSummary.totalLeads || 0).toLocaleString()}</span>
            <span className="mini-card-sub">All time</span>
          </div>
          <div className="mini-card mini-card-clickable" style={{ borderTop: `3px solid ${MINT_DEEP}` }} onClick={() => setRecruiterModalType('new_today')}>
            <span className="mini-card-label">New Today</span>
            <span className="mini-card-value">{recruiterSummary.newToday ?? 0}</span>
            <span className="mini-card-sub">Added today</span>
          </div>
          <div className="mini-card mini-card-clickable" style={{ borderTop: `3px solid ${GOLD}` }} onClick={() => setRecruiterModalType('conversion_rate')}>
            <span className="mini-card-label">Conversion Rate</span>
            <span className="mini-card-value">{(recruiterSummary.conversionRate ?? 0).toFixed(1)}%</span>
            <span className="mini-card-sub">Selected vs Rejected</span>
          </div>
        </div>
      </div>

      {/* ---- RECENT NOTICES — scrollable, shows all ---- */}
      <div className="nd-card nd-appear" style={{ animationDelay: '0.8s', marginTop: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="nd-section-title">Recent Notices</h3>
          {recentNotices.length > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 700, color: MINT_DEEP,
              background: 'rgba(140,205,164,0.18)', borderRadius: 99, padding: '3px 10px',
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
                <div key={n.id || i} className="nd-notice">
                  <div className="nd-notice-icon" style={{ background: i % 2 === 0 ? MINT_DARK : MINT_DEEP }}>
                    <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 18 }}>
                      {i % 2 === 0 ? 'priority_high' : 'campaign'}
                    </span>
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: PRIMARY }}>{n.title}</h4>
                    <p style={{ margin: '3px 0 4px', fontSize: 12, color: '#64748b', lineHeight: 1.45 }}>
                      {n.content && n.content.length > 110 ? n.content.slice(0, 110) + '\u2026' : n.content || ''}
                    </p>
                    <span style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600 }}>
                      {new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ---- UPCOMING EVENTS — scrollable, shows all ---- */}
      <div className="nd-card nd-appear" style={{ animationDelay: '0.9s', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="nd-section-title">Upcoming Events</h3>
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
          <p className="nd-muted">No upcoming events</p>
        ) : (
          <>
            <div className={upcomingEvents.length > 3 ? 'nd-scroll-fade' : ''}>
              <div className="nd-scroll-list">
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
                          {ev.event_time && <span> \u2022 {ev.event_time.slice(0, 5)}</span>}
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
                border: `1.5px dashed ${MINT}`, background: 'rgba(140,205,164,0.08)',
                color: MINT_DEEP, borderRadius: 12, fontSize: 12, fontWeight: 700,
                letterSpacing: 0.6, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              + ADD NEW EVENT
            </button>
          </>
        )}
      </div>

      {/* ============ FRO LIVE MODAL ============ */}
      {showFroModal && (
        <FroLiveModal
          froLive={froLive}
          loadingFro={loadingFro}
          onClose={() => setShowFroModal(false)}
          onRefresh={fetchFroLive}
        />
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
    </div>
  )
}
