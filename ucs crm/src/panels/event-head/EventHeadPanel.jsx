import { useState, useEffect, useRef } from 'react'
import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import { useUcs } from '../../store'
import { Grid, Cal, Plus, Clock, FileTxt, Bell, Users, Plane, Brief, Star, Eye, Settings as SettingsIcon } from './icons'
import { themes, applyTheme } from './theme'
import SettingsDrawer from '../../components/SettingsDrawer'
import NotificationDrawer from '../../components/NotificationDrawer'
import { api } from '../../api/auth'
import { requestNotifPermission, showDesktopNotification } from '../../utils/desktopNotif'
import { useRealtime } from '../../hooks/useRealtime'
import Overview from './components/Overview'
import EventDashboard from './pages/EventDashboard'
import CreateEvent from './pages/CreateEvent'
import MonthlyPlanner from './pages/MonthlyPlanner'
import EventChecklist from './pages/EventChecklist'
import AssetRegister from './pages/AssetRegister'
import MaterialRegister from './pages/MaterialRegister'
import BeneficiaryDistribution from './pages/BeneficiaryDistribution'
import VolunteerManagement from './pages/VolunteerManagement'

import AttendanceManagement from './pages/AttendanceManagement'
import EventReports from './pages/EventReports'
import ApprovalWorkflow from './pages/ApprovalWorkflow'
import NotificationsPage from './pages/Notifications'
import EventsPage from './pages/EventsPage'

const NAV = [
  { id:'dashboard',      path:'/event-head/dashboard',      label:'Event Dashboard',      icon:Grid,     section:'Dashboard' },
  { id:'monthly-planner',path:'/event-head/monthly-planner',label:'Monthly Planner',       icon:Cal,     section:'Dashboard' },
  { id:'create',         path:'/event-head/create',          label:'Create Event',          icon:Plus,    section:'Planning' },
  { id:'checklist',      path:'/event-head/checklist',       label:'Event Checklist',       icon:Clock,   section:'Planning' },
  { id:'assets',         path:'/event-head/assets',          label:'Asset Register',        icon:Brief,   section:'Resources' },
  { id:'materials',      path:'/event-head/materials',       label:'Material Register',     icon:FileTxt, section:'Resources' },
  { id:'distribution',   path:'/event-head/distribution',    label:'Beneficiary Distribution', icon:Users, section:'Execution' },
  { id:'volunteers',     path:'/event-head/volunteers',      label:'Volunteer Management',  icon:Star,    section:'Execution' },
  { id:'attendance',     path:'/event-head/attendance',      label:'Attendance',            icon:Users,   section:'Execution' },

  { id:'events',         path:'/event-head/events',          label:'All Events',            icon:Cal,     section:'Reports' },
  { id:'reports',        path:'/event-head/reports',         label:'Event Reports',         icon:FileTxt, section:'Reports' },
  { id:'approvals',      path:'/event-head/approvals',       label:'Approval Workflow',     icon:SettingsIcon, section:'Reports' },
  { id:'notifications',  path:'/event-head/notifications',   label:'Notifications',         icon:Bell,    section:'Reports' },
]

const SECTIONS = [
  { id:'Dashboard', label:'Dashboard' },
  { id:'Planning', label:'Planning' },
  { id:'Resources', label:'Resources' },
  { id:'Execution', label:'Execution' },

  { id:'Reports', label:'Reports & Approvals' },
]

function Sidebar({ open, onClose }) {
  const location = useLocation()
  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark" style={{background:'#7B5EA7'}}>E</div>
          <div><h1>UFS</h1><span>Event Manager</span></div>
        </div>
        <nav className="sidebar-nav">
          {SECTIONS.map(s => (
            <div key={s.id}>
              <div className="user-menu-label" style={{padding:'16px 12px 4px',fontSize:10,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--ink-soft)',fontWeight:600}}>{s.label}</div>
              {NAV.filter(n => n.section === s.id).map(n => { const Icon = n.icon
                const active = location.pathname === n.path
                return (
                  <NavLink key={n.id} to={n.path} onClick={onClose}
                    className={`snav-item ${active ? 'active' : ''}`}>
                    <span className="ico"><Icon size={18} /></span>
                    <span>{n.label}</span>
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}

export default function EventHeadPanel() {
  const { user, logout } = useUcs()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [themeName, setThemeName] = useState(() => localStorage.getItem('eh_theme') || 'sky')
  const [allNotifs, setAllNotifs] = useState([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const menuRef = useRef(null)
  const notifRef = useRef(null)
  const pollRef = useRef(null)
  const seenNotifIds = useRef(new Set(JSON.parse(localStorage.getItem('eh_seen_notifs') || '[]')))

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
            localStorage.setItem('eh_seen_notifs', JSON.stringify([...seenNotifIds.current]));
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

  useEffect(() => {
    if (themes[themeName]) {
      applyTheme(themes[themeName], '.panel-event-head')
      const t = themes[themeName]
      const el = document.querySelector('.panel-event-head') || document.documentElement
      el.style.setProperty('--bg', t.sand); el.style.setProperty('--card-bg', t.paper); el.style.setProperty('--sage-light', t['sage-soft'])
    }
    localStorage.setItem('eh_theme', themeName)
  }, [themeName])

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false) }
    if (showMenu) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMenu])

  const meta = NAV.find(n => location.pathname === n.path)
  const userName = user?.name || 'Event Manager'
  const initials = userName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const notifCount = allNotifs.length;
  const drawerSections = [
    { label: 'Notifications', type: 'notifications', items: allNotifs },
  ];

  return (
    <div className="app">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main">
        <header className="topbar">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="Toggle sidebar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div>
              <div className="eyebrow">{meta?.section || 'Dashboard'}</div>
              <h2>{meta?.label || 'Event Manager'}</h2>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
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
            <div className="avatar" style={{ background:'#7B5EA722', color:'#7B5EA7' }}>{initials}</div>
            {showMenu && (
              <div className="user-menu">
                <div className="user-menu-item" style={{flexDirection:'column', alignItems:'flex-start', gap:2, cursor:'default'}}>
                  <div style={{fontWeight:600, fontSize:13}}>{userName}</div>
                  <div style={{fontSize:11, color:'var(--ink-soft)'}}>Event Manager</div>
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
          <NotificationDrawer
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
        <div className="content-body">
          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<EventDashboard />} />
            <Route path="monthly-planner" element={<MonthlyPlanner />} />
            <Route path="create" element={<CreateEvent />} />
            <Route path="checklist" element={<EventChecklist />} />
            <Route path="assets" element={<AssetRegister />} />
            <Route path="materials" element={<MaterialRegister />} />
            <Route path="distribution" element={<BeneficiaryDistribution />} />
            <Route path="volunteers" element={<VolunteerManagement />} />
            <Route path="attendance" element={<AttendanceManagement />} />

            <Route path="events" element={<EventsPage />} />
            <Route path="reports" element={<EventReports />} />
            <Route path="approvals" element={<ApprovalWorkflow />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}
