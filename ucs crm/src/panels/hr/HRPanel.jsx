import { useState, useEffect, useRef, useCallback } from 'react'
import { Routes, Route, NavLink, useNavigate, useLocation, useParams, Navigate } from 'react-router-dom'
import { useUcs } from '../../store'
import { useHR } from './store'
import { Grid, Users, Plane, Clock, FileTxt, Cal, Bell } from './icons'
import { themes, applyTheme } from './theme'
import SettingsDrawer from '../../components/SettingsDrawer'
import NotificationDrawer from '../../components/NotificationDrawer'
import { api } from '../../api/auth'
import { requestNotifPermission, showDesktopNotification } from '../../utils/desktopNotif'
import { useRealtime } from '../../hooks/useRealtime'
import Overview from './components/Overview'
import Workers from './components/Workers'
import EmployeeDetail from './components/EmployeeDetail'
import Offboarding from './components/Offboarding'
import Leaves from './components/Leaves'
import Attendance from './components/Attendance'
import Letters from './components/Letters'
import HRForms from './components/HRForms'
import Holidays from './components/Holidays'
import Recruiters from './components/Recruiters'
import GenerateQR from './components/GenerateQR'
import Loans from './components/Loans'
import Tickets from './components/Tickets'
import PhoneNumbers from './components/PhoneNumbers'
import SettingsPage from './components/Settings'
import { fetchTicketCount } from './store'

const NAV = [
  { id:'overview',   path:'/hr/overview',   label:'Overview',    icon:Grid,    eyebrow:'Dashboard',   sub:'Your team at a glance' },
  { id:'employees',  path:'/hr/employees',   label:'Employees',   icon:Users,   eyebrow:'People',      sub:'Add and manage employees' },
  { id:'attendance', path:'/hr/attendance',  label:'Attendance',  icon:Clock,   eyebrow:'Daily',       sub:'Mark who is in today' },
  { id:'leaves',     path:'/hr/leaves',      label:'Leaves',      icon:Plane,   eyebrow:'Time off',    sub:'Requests and approvals' },
  { id:'letters',    path:'/hr/letters',     label:'Letters',     icon:FileTxt, eyebrow:'Documents',   sub:'Generate HR letters' },
  { id:'hr-forms',   path:'/hr/hr-forms',    label:'HR Forms',    icon:FileTxt, eyebrow:'Forms',       sub:'Employee onboarding forms' },
  { id:'recruiters', path:'/hr/recruiters',  label:'Recruiters',  icon:Users,   eyebrow:'Pipeline',    sub:'Track leads and hires' },
  { id:'holidays',   path:'/hr/holidays',    label:'Holidays',    icon:Cal,     eyebrow:'Calendar',    sub:'Plan the holiday chart' },
  { id:'qr',         path:'/hr/qr',          label:'QR Codes',    icon:Grid,    eyebrow:'Attendance',  sub:'Generate and manage QR codes' },
  { id:'loans',      path:'/hr/loans',       label:'Loans & Advances', icon:Grid, eyebrow:'Finance',  sub:'Approve and manage loans & advances' },
  { id:'tickets',    path:'/hr/tickets',     label:'Tickets',    icon:FileTxt, eyebrow:'Corrections', sub:'Attendance correction tickets' },
  { id:'phone-numbers', path:'/hr/phone-numbers', label:'Phone Numbers', icon:Grid, eyebrow:'Contacts', sub:'Manage worker phone numbers' },
]

function Sidebar({ open, onClose }) {
  const location = useLocation()
  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark" style={{background:'#5B6B4E',borderRadius:10,width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:18}}>U</div>
          <div><h1>UFS</h1><span>HR Panel</span></div>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(n => { const Icon = n.icon;
            const active = location.pathname === n.path || (n.id === 'employees' && location.pathname.startsWith('/hr/employees/'))
            return (
            <NavLink key={n.id} to={n.path} className={`snav-item ${active ? 'active' : ''}`}
              onClick={() => onClose?.()}>
              <Icon className="ico" /> <span>{n.label}</span>
            </NavLink>
          )})}
        </nav>
      </aside>
    </>
  )
}

function HRPageShell({ children }) {
  const { user, logout } = useUcs()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [themeName, setThemeName] = useState(() => localStorage.getItem('hr_theme') || 'sky')
  const [ticketCount, setTicketCount] = useState(0)
  const [allNotifs, setAllNotifs] = useState([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const menuRef = useRef(null)
  const notifRef = useRef(null)
  const pollRef = useRef(null)
  const seenNotifIds = useRef(new Set(JSON.parse(localStorage.getItem('hr_seen_notifs') || '[]')))

  const loadNotifications = () => {
    const uid = user?.id;
    if (!uid) return;
    api(`/notifications/${uid}`, { _prefix: 'ucs' })
      .then(data => {
        const all = data || [];
        const unread = all.filter(n => !n.read_at);
        setAllNotifs(unread);
        unread.forEach(n => {
          if (!seenNotifIds.current.has(n.id)) {
            seenNotifIds.current.add(n.id);
            localStorage.setItem('hr_seen_notifs', JSON.stringify([...seenNotifIds.current]));
            showDesktopNotification(n.title, n.body);
          }
        });
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadNotifications();
    requestNotifPermission();
    pollRef.current = setInterval(() => loadNotifications(), 30000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [user?.id]);

  useRealtime('notification_log', {
    filter: `worker_id=eq.${user?.id}`,
    onInsert: () => loadNotifications(),
    enabled: !!user?.id,
  });

  useEffect(() => { if (themes[themeName]) applyTheme(themes[themeName], '.panel-hr'); localStorage.setItem('hr_theme', themeName) }, [themeName])

  useEffect(() => {
    const poll = async () => { try { const r = await fetchTicketCount(); setTicketCount(r?.count ?? 0) } catch {} }
    poll(); const id = setInterval(poll, 30000); return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false) }
    if (showMenu) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMenu])

  const meta = NAV.find(n => location.pathname === n.path || (n.id === 'employees' && location.pathname.startsWith('/hr/employees/')) || (n.id === 'tickets' && location.pathname === '/hr/tickets'))
  const userName = user?.name || 'HR User'
  const userRole = user?.role || 'HR'
  const userInitials = userName.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()
  const notifCount = allNotifs.length;
  const drawerSections = [
    { label: 'Notifications', type: 'notifications', items: allNotifs },
  ];

  return (
    <div className="app">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="main">
        <div className="mobile-top">
          <button className="hamburger" onClick={() => setMenuOpen(true)}><span /><span /><span /></button>
          <div className="mtop-brand">
            <div className="brand-mark" style={{background:'#5B6B4E',borderRadius:8,width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:14}}>U</div>
            <span>UFS HR Panel</span>
          </div>
        </div>
        <header className="topbar">
          <div>
            <div className="eyebrow">{meta?.eyebrow || 'Dashboard'}</div>
            <h2>{meta?.label || 'Dashboard'}</h2>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <NavLink to="/hr/tickets" className="btn btn-icon" style={{position:'relative'}} title="Pending Tickets">
              <Bell size={19} />
              {ticketCount > 0 && <span className="badge badge-pending2" style={{position:'absolute',top:-6,right:-6,fontSize:10,padding:'1px 5px',lineHeight:'16px',minWidth:18,textAlign:'center'}}>{ticketCount > 99 ? '99+' : ticketCount}</span>}
            </NavLink>
            <div ref={notifRef} style={{ position:'relative' }}>
              <div onClick={() => setDrawerOpen(true)} style={{ cursor:'pointer', padding:6, borderRadius:8, transition:'background .15s' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={notifCount > 0 ? 'var(--sage)' : 'var(--ink-soft)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={notifCount > 0 ? 'bell-ring' : ''}>
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {notifCount > 0 && (
                  <span style={{ position:'absolute', top:0, right:0, background:'#dc2626', color:'#fff', borderRadius:'50%', minWidth:16, height:16, fontSize:9, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, lineHeight:1, padding:'0 3px' }}>
                    {notifCount > 9 ? '9+' : notifCount}
                  </span>
                )}
              </div>
            </div>
            <div className="topbar-user" ref={menuRef} onClick={() => setShowMenu(!showMenu)}>
            <div className="avatar" style={{ background:'#5B6B4E22', color:'#5B6B4E', width:36, height:36, cursor:'pointer' }}>{userInitials}</div>
            {showMenu && (
              <div className="user-menu">
                <div className="user-menu-item" style={{flexDirection:'column', alignItems:'flex-start', gap:2, cursor:'default'}}>
                  <div style={{fontWeight:600, fontSize:13}}>{userName}</div>
                  <div style={{fontSize:11, color:'var(--ink-soft)'}}>{userRole}</div>
                </div>
                <div className="user-menu-divider" />
                <div className="user-menu-item" onClick={() => { setShowMenu(false); setShowSettings(true); }} style={{cursor:'pointer'}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  Settings
                </div>
                <div className="user-menu-divider" />
                <button className="user-menu-item" onClick={() => { setShowMenu(false); logout() }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
          </div>
          <NotificationDrawer topOffset={66}
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            sections={drawerSections}
            onItemClick={() => setDrawerOpen(false)}
          />
          <SettingsDrawer
            open={showSettings}
            onClose={() => setShowSettings(false)}
            themes={themes}
            themeName={themeName}
            onThemeChange={(key) => setThemeName(key)}
          />
        </header>
        <div className="content-body" style={{ marginRight: drawerOpen ? 320 : 0, transition: 'margin-right .25s ease' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function EmployeeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  return <EmployeeDetail worker={{ id }} onBack={() => navigate('/hr/employees')} onOffboard={() => navigate(`/hr/employees/${id}/offboard`)} />
}

function EmployeeListPage() {
  const navigate = useNavigate()
  return <Workers onSelect={(w) => navigate(`/hr/employees/${w.id}`)} onOffboard={(w) => navigate(`/hr/employees/${w.id}/offboard`)} />
}

function OffboardPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { fetchWorkerById } = useHR()
  const [worker, setWorker] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWorkerById(id).then(w => { setWorker(w); setLoading(false) }).catch(() => setLoading(false))
  }, [id])

  if (loading) return <div className="empty">Loading...</div>
  if (!worker) return <div className="empty">Employee not found.</div>
  return <Offboarding worker={worker} onBack={() => navigate('/hr/employees')} />
}

function SettingsRoute() {
  const navigate = useNavigate()
  return <SettingsPage onClose={() => navigate('/hr/overview')} />
}

export default function HRPanel() {
  return (
    <HRPageShell>
      <Routes>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<Overview />} />
        <Route path="employees" element={<EmployeeListPage />} />
        <Route path="employees/:id" element={<EmployeeDetailPage />} />
        <Route path="employees/:id/offboard" element={<OffboardPage />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="leaves" element={<Leaves />} />
        <Route path="letters" element={<Letters />} />
        <Route path="hr-forms" element={<HRForms />} />
        <Route path="recruiters" element={<Recruiters />} />
        <Route path="holidays" element={<Holidays />} />
        <Route path="qr" element={<GenerateQR />} />
        <Route path="loans" element={<Loans />} />
        <Route path="tickets" element={<Tickets />} />
        <Route path="phone-numbers" element={<PhoneNumbers />} />
        <Route path="settings" element={<SettingsRoute />} />
        <Route path="*" element={<Navigate to="overview" replace />} />
      </Routes>
    </HRPageShell>
  )
}
