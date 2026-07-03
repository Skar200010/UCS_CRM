import { useState, useEffect, useRef } from 'react'
import { Routes, Route, NavLink, useNavigate, useLocation, useParams, Navigate } from 'react-router-dom'
import { useUcs } from '../../store'
import { themes, applyTheme } from '../hr/theme'
import { useRealtime } from '../../hooks/useRealtime'
import { api } from '../../api/auth'
import { requestNotifPermission, showDesktopNotification } from '../../utils/desktopNotif'
import NotificationDrawer from '../../components/NotificationDrawer'
import Dashboard from './pages/Dashboard'
import Donors from './pages/Donors'
import DonorDetail from './pages/DonorDetail'
import StationManagement from './pages/StationManagement'
import NewData from './pages/NewData'
import Alerts from './pages/Alerts'
import RejectedLeads from './pages/RejectedLeads'
import NgoAttendance from './pages/Attendance'

const NAV = [
  { id: 'dashboard', path: '/ngo-admin/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'alerts', path: '/ngo-admin/alerts', label: 'Alerts', icon: 'alerts' },
  { id: 'donors', path: '/ngo-admin/donors', label: 'Donors', icon: 'donors' },
  { id: 'new-data', path: '/ngo-admin/new-data', label: 'New Data', icon: 'newData' },
  { id: 'station-mgmt', path: '/ngo-admin/station-mgmt', label: 'Stations & FROs', icon: 'station' },
  { id: 'attendance', path: '/ngo-admin/attendance', label: 'Attendance', icon: 'attendance' },
  { id: 'rejected', path: '/ngo-admin/rejected-leads', label: 'Rejected Leads', icon: 'rejected' },
]

const ICONS = {
  dashboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>,
  alerts: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  donors: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  newData: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  station: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  attendance: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  rejected: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
}

const MAX_DROPDOWN = 4

const currency = n => n != null ? '\u20B9' + Number(n).toLocaleString('en-IN') : '\u2014'

function Sidebar({ open, onClose }) {
  const location = useLocation()
  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">NA</div>
          <div><h1>UFS</h1><span>NGO Admin Panel</span></div>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(n => {
            const active = location.pathname === n.path || (n.id === 'donors' && location.pathname.startsWith('/ngo-admin/donors/'))
            return (
            <NavLink key={n.id} to={n.path} className={`snav-item ${active ? 'active' : ''}`}
              onClick={() => onClose?.()}>
              <span className="ico">{ICONS[n.icon]}</span>
              <span>{n.label}</span>
            </NavLink>
          )})}
        </nav>
      </aside>
    </>
  )
}

function DonorDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  return <DonorDetail donor={{ id }} onBack={() => navigate('/ngo-admin/donors')} />
}

function DonorsPage() {
  const navigate = useNavigate()
  return <Donors onSelect={(donor) => navigate(`/ngo-admin/donors/${donor.id}`)} />
}

export default function NgoAdminPanel() {
  const { user, logout } = useUcs()
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [themeName, setThemeName] = useState(() => localStorage.getItem('ngoadmin_theme') || 'sky')
  const menuRef = useRef(null)
  const location = useLocation()

  useEffect(() => {
    if (themes[themeName]) {
      applyTheme(themes[themeName], '.panel-ngo-admin')
      const t = themes[themeName]
      const el = document.querySelector('.panel-ngo-admin') || document.documentElement
      el.style.setProperty('--bg', t.sand); el.style.setProperty('--card-bg', t.paper); el.style.setProperty('--sage-light', t['sage-soft'])
    }
    localStorage.setItem('ngoadmin_theme', themeName)
  }, [themeName])

  const [rejectedCount, setRejectedCount] = useState(0);
  const [rejectedItems, setRejectedItems] = useState([]);
  const [showNotifList, setShowNotifList] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const notifRef = useRef(null);
  const pollRef = useRef(null);

  const loadRejectedCount = (showDesktop = false) => {
    api('/ngo-admin/rejected-leads', { _prefix: 'ucs' })
      .then(data => {
        const items = (data || []).filter(t => t.status === 'pending_review');
        if (showDesktop && items.length > 0) {
          showDesktopNotification('Lead Rejected', `${items[0].donor_name} (\u20B9${items[0].amount || 0}) lead rejected. Reason: ${items[0].rejection_reason}`, '/ngo-admin/rejected-leads');
        }
        setRejectedItems(items);
        setRejectedCount(items.length);
      })
      .catch(() => {});
  };
  useEffect(() => {
    loadRejectedCount();
    requestNotifPermission();
    pollRef.current = setInterval(() => loadRejectedCount(), 30000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useRealtime('rejected_lead_tickets', {
    event: '*',
    onInsert: () => loadRejectedCount(true),
    enabled: true,
  });

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false)
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifList(false)
    }
    if (showMenu || showNotifList) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMenu, showNotifList])

  const meta = NAV.find(n => location.pathname === n.path || (n.id === 'donors' && location.pathname.startsWith('/ngo-admin/donors/')))
  const userName = user?.name || 'Admin'
  const initials = userName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  const dropdownItems = rejectedItems.slice(0, MAX_DROPDOWN);
  const totalHidden = rejectedCount - dropdownItems.length;

  const drawerSections = [
    { label: 'Rejected Leads', type: 'rejected', items: rejectedItems },
  ];

  const handleDrawerItemClick = (item) => {
    setDrawerOpen(false);
    navigate('/ngo-admin/rejected-leads');
  };

  return (
    <div className="app">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            </button>
            <div className="eyebrow">{meta?.label || 'Dashboard'}</div>
            <h2>{meta?.label || 'Dashboard'}</h2>
          </div>
          <div ref={notifRef} style={{ position:'relative', marginRight:4 }}>
            <div onClick={() => setShowNotifList(!showNotifList)} style={{ cursor:'pointer', position:'relative', padding:6, borderRadius:8, transition:'background .15s', background: showNotifList ? '#f3f4f6' : 'transparent' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={rejectedCount > 0 ? 'var(--sage)' : 'var(--ink-soft)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {rejectedCount > 0 && (
                <span style={{ position:'absolute', top:0, right:0, background:'#dc2626', color:'#fff', borderRadius:'50%', minWidth:16, height:16, fontSize:9, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, lineHeight:1, padding:'0 3px' }}>
                  {rejectedCount > 9 ? '9+' : rejectedCount}
                </span>
              )}
            </div>
            {showNotifList && (
              <div style={{ position:'absolute', top:'100%', right:0, marginTop:6, background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, boxShadow:'0 8px 30px rgba(0,0,0,.12)', width:340, maxHeight:420, overflowY:'auto', zIndex:100, padding:0 }}>
                <div style={{ padding:'10px 14px', borderBottom:'1px solid #f3f4f6', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:13, fontWeight:700 }}>Rejected Leads</span>
                  <span style={{ fontSize:11, color:'var(--ink-soft)' }}>{rejectedCount} pending</span>
                </div>

                {rejectedCount === 0 && (
                  <div style={{ padding:24, fontSize:12, color:'var(--ink-soft)', textAlign:'center' }}>No pending rejected leads</div>
                )}

                {dropdownItems.map((item, i) => (
                  <div key={item.id}
                    onClick={() => { setShowNotifList(false); navigate('/ngo-admin/rejected-leads'); }}
                    style={{ padding:'10px 14px', borderBottom:'1px solid #f3f4f6', cursor:'pointer', fontSize:12, transition:'background .15s' }}
                    onMouseOver={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                      <div style={{ width:28, height:28, borderRadius:6, background:'#fef2f2', display:'flex', alignItems:'center', justifyContent:'center', color:'#dc2626', fontSize:12, flexShrink:0, marginTop:1 }}>{'\u2716'}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                          <span style={{ fontWeight:600, fontSize:12 }}>{item.donor_name}</span>
                          <span style={{ color:'var(--sage)', fontWeight:600 }}>{currency(item.amount)}</span>
                        </div>
                        <div style={{ color:'#6b7280', fontSize:11, lineHeight:1.3, marginBottom:2 }}>{item.rejection_reason}</div>
                        <div style={{ color:'#9ca3af', fontSize:10 }}>{item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : ''}</div>
                      </div>
                    </div>
                  </div>
                ))}

                {totalHidden > 0 && (
                  <div style={{ padding:'10px 14px', textAlign:'center', borderTop:'1px solid #f3f4f6' }}>
                    <button onClick={() => { setShowNotifList(false); setDrawerOpen(true); }}
                      style={{ background:'none', border:'none', color:'var(--sage)', cursor:'pointer', fontSize:12, fontWeight:600, padding:'4px 12px', borderRadius:6 }}>
                      View All ({totalHidden} more)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="topbar-user" ref={menuRef} onClick={() => setShowMenu(!showMenu)}>
            <div className="topbar-user-text">
              <div className="topbar-name">{userName}</div>
              <div className="topbar-role">NGO Admin</div>
            </div>
            <div className="avatar">{initials}</div>
            {showMenu && (
              <div className="user-menu">
                <div className="user-menu-item" style={{cursor:'default', fontSize:13, color:'#666'}}>
                  Theme: <select value={themeName} onClick={e=>e.stopPropagation()} onChange={e=>setThemeName(e.target.value)} style={{marginLeft:8, border:'1px solid #ddd', borderRadius:6, padding:'2px 8px'}}>
                    {Object.keys(themes).map(k => <option key={k} value={k}>{themes[k].name}</option>)}
                  </select>
                </div>
                <div className="user-menu-divider" />
                <button className="user-menu-item" onClick={() => { setShowMenu(false); logout() }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>
        <div className="content-body">
          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="donors" element={<DonorsPage />} />
            <Route path="donors/:id" element={<DonorDetailPage />} />
            <Route path="new-data" element={<NewData />} />
            <Route path="station-mgmt" element={<StationManagement />} />
            <Route path="attendance" element={<NgoAttendance />} />
            <Route path="rejected-leads" element={<RejectedLeads />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </div>
      </div>
      <NotificationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sections={drawerSections}
        onItemClick={handleDrawerItemClick}
      />
    </div>
  )
}
