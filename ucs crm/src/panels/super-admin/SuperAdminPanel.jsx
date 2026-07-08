import { useState, useRef, useEffect } from 'react'
import { Routes, Route, NavLink, useNavigate, useLocation, useParams, Navigate } from 'react-router-dom'
import { useUcs } from '../../store'
import { themes, applyTheme } from '../hr/theme'
import SettingsDrawer from '../../components/SettingsDrawer'
import NotificationDrawer from '../../components/NotificationDrawer'
import { api } from '../../api/auth'
import { requestNotifPermission, showDesktopNotification } from '../../utils/desktopNotif'
import { useRealtime } from '../../hooks/useRealtime'
import { GridFour, Buildings, Users, Airplane, Ticket, Database } from '@phosphor-icons/react'
import Dashboard from './pages/Dashboard'
import Organization from './pages/Organization'
import Workers from './pages/Workers'
import WorkerDetail from './pages/WorkerDetail'
import Leaves from './pages/Leaves'
import DataManagement from './pages/DataManagement'
import Tickets from './pages/Tickets'
import Events from './pages/Events'
import LiveFroStatus from './pages/LiveFroStatus'
import AssetOverview from './pages/AssetOverview'
import { Radio, Clipboard, CurrencyCircleDollar, CalendarBlank, BuildingOffice, MagnifyingGlass } from '@phosphor-icons/react'

const NAV = [
  { id: 'dashboard', path: '/sa/dashboard', label: 'Dashboard', icon: GridFour },
  { id: 'data-management', path: '/sa/data-management', label: 'Data Management', icon: Database },
  { id: 'organization', path: '/sa/organization', label: 'Organization', icon: Buildings },
  { id: 'employees', path: '/sa/employees', label: 'Employees', icon: Users },
  { id: 'leaves', path: '/sa/leaves', label: 'Leaves', icon: Airplane },
  { id: 'tickets', path: '/sa/tickets', label: 'Tickets', icon: Ticket },
  { id: 'live-fro', path: '/sa/live-fro', label: 'Live FRO', icon: Radio },
  { id: 'accounts', path: '/sa/accounts', label: 'Accounts', icon: CurrencyCircleDollar },
  { id: 'event-head', path: '/sa/event-head', label: 'Event Head', icon: CalendarBlank },
  { id: 'ngo-admin', path: '/sa/ngo-admin', label: 'NGO Admin', icon: BuildingOffice },
  { id: 'recruiter', path: '/sa/recruiter', label: 'Recruiter', icon: MagnifyingGlass },
  { id: 'assets', path: '/sa/assets', label: 'Assets Overview', icon: Clipboard },
]

const navMap = {}
NAV.forEach(n => { navMap[n.id] = n })

const GROUPS = [
  { id: 'org', label: 'Organization', icon: Buildings, items: ['organization', 'employees'] },
]

const standaloneIds = ['dashboard', 'data-management', 'leaves', 'tickets', 'live-fro', 'accounts', 'event-head', 'ngo-admin', 'recruiter', 'assets']

function Sidebar({ mobileOpen }) {
  const location = useLocation()
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sa_collapsed_groups') || '[]') } catch { return [] }
  })

  const toggleGroup = (id) => {
    setCollapsedGroups(prev => {
      const next = prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
      localStorage.setItem('sa_collapsed_groups', JSON.stringify(next))
      return next
    })
  }

  const isActive = (path) => {
    if (path.endsWith('/employees')) return location.pathname.startsWith('/sa/employees')
    if (path.endsWith('/accounts')) return location.pathname.startsWith('/sa/accounts')
    if (path.endsWith('/event-head')) return location.pathname.startsWith('/sa/event-head')
    if (path.endsWith('/ngo-admin')) return location.pathname.startsWith('/sa/ngo-admin')
    if (path.endsWith('/recruiter')) return location.pathname.startsWith('/sa/recruiter')
    return location.pathname === path
  }

  return (
    <aside className={`sa-sidebar${mobileOpen ? ' open' : ''}`}>
      <div className="sa-sidebar-header">
        <div className="sa-logo">SA</div>
        <div><div className="sa-logo-text">UFS</div><div style={{fontSize:11,color:'var(--text-muted)',letterSpacing:.5,textTransform:'uppercase'}}>Super Admin</div></div>
      </div>
      <nav className="sa-nav">
        {standaloneIds.map(id => {
          const n = navMap[id]
          const Icon = n.icon
          return (
            <NavLink key={n.id} to={n.path} end className={`sa-nav-item${isActive(n.path) ? ' active' : ''}`}>
              <Icon className="sa-nav-icon" size={16} />
              <span className="sa-nav-label">{n.label}</span>
            </NavLink>
          )
        })}
        {GROUPS.map(g => {
          const GroupIcon = g.icon
          return (
          <div key={g.id}>
            <div className="sa-nav-group-header" onClick={() => toggleGroup(g.id)}>
              <GroupIcon className="sa-nav-icon" size={14} />
              <span>{g.label}</span>
              <span className={`sa-nav-chevron${collapsedGroups.includes(g.id) ? '' : ' open'}`}>▸</span>
            </div>
            <div className={`sa-nav-group-items${collapsedGroups.includes(g.id) ? ' collapsed' : ''}`}>
              {g.items.map(id => {
                const n = navMap[id]
                const Icon = n.icon
                return (
                  <NavLink key={n.id} to={n.path} end={n.id !== 'employees'}
                    className={`sa-nav-item sa-nav-sub${isActive(n.path) ? ' active' : ''}`}>
                    <Icon className="sa-nav-icon" size={16} />
                    <span className="sa-nav-label">{n.label}</span>
                  </NavLink>
                )
              })}
            </div>
          </div>
          )
        })}
      </nav>
    </aside>
  )
}

function PageShell({ children }) {
  const { user, logout } = useUcs()
  const [showMenu, setShowMenu] = useState(false)
  const [mobileSidebar, setMobileSidebar] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [allNotifs, setAllNotifs] = useState([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [themeName, setThemeName] = useState(() => {
    try { return localStorage.getItem('sa_theme') || 'sky' } catch { return 'sky' }
  })
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('sa_dark') === 'true' } catch { return false }
  })
  const menuRef = useRef(null)
  const notifRef = useRef(null)
  const pollRef = useRef(null)
  const seenNotifIds = useRef(new Set(JSON.parse(localStorage.getItem('sa_seen_notifs') || '[]')))
  const location = useLocation()

  useEffect(() => {
    if (themes[themeName]) {
      applyTheme(themes[themeName], '.panel-sa')
      const t = themes[themeName]
      const el = document.querySelector('.panel-sa') || document.documentElement
      el.style.setProperty('--bg', t.sand)
      el.style.setProperty('--bg-card', t.paper)
      el.style.setProperty('--text', t.ink)
      el.style.setProperty('--text-soft', t['ink-soft'])
      el.style.setProperty('--border', t.line)
      el.style.setProperty('--primary', t.sage)
      el.style.setProperty('--primary-hover', t.sage)
      el.style.setProperty('--danger', t.danger)
      el.style.setProperty('--bg-sidebar', t.ink)
    }
    localStorage.setItem('sa_theme', themeName)
  }, [themeName])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('sa_dark', dark)
  }, [dark])

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
            localStorage.setItem('sa_seen_notifs', JSON.stringify([...seenNotifIds.current]));
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
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false)
    }
    if (showMenu) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMenu])

  useEffect(() => { setMobileSidebar(false) }, [location.pathname])

  const isIframeRoute = ['/sa/accounts', '/sa/event-head', '/sa/ngo-admin', '/sa/recruiter'].some(p => location.pathname.startsWith(p))
  const meta = NAV.find(n => location.pathname.startsWith(n.path))
  const userName = user?.name || 'Super Admin'
  const initials = userName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const notifCount = allNotifs.length;
  const drawerSections = [
    { label: 'Notifications', type: 'notifications', items: allNotifs },
  ];

  return (
    <div className="app">
      <div className={`sa-sidebar-overlay${mobileSidebar ? ' open' : ''}`} onClick={() => setMobileSidebar(false)} />
      <Sidebar mobileOpen={mobileSidebar} />
      <div className="main">
        <header className="topbar">
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <button className="sa-hamburger sa-top-hamburger" onClick={() => setMobileSidebar(o => !o)} aria-label="Toggle menu">
              <span /><span /><span />
            </button>
            <div>
              <div className="eyebrow">{meta?.label || 'Dashboard'}</div>
              <h2>{meta?.label || 'Dashboard'}</h2>
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
            <div className="avatar">{initials}</div>
            {showMenu && (
              <div className="user-menu">
                <div className="user-menu-item" style={{flexDirection:'column', alignItems:'flex-start', gap:2, cursor:'default'}}>
                  <div style={{fontWeight:600, fontSize:13}}>{userName}</div>
                  <div style={{fontSize:11, color:'var(--ink-soft)'}}>Super Admin</div>
                </div>
                <div className="user-menu-divider" />
                <div className="user-menu-item" style={{cursor:'default'}}>
                  <span style={{fontSize:13, color:'var(--ink-soft)'}}>{dark ? '☀️ Light' : '🌙 Dark'}</span>
                  <label className="dm-toggle" style={{marginLeft:'auto'}}>
                    <input type="checkbox" checked={dark} onChange={() => setDark(!dark)} />
                    <span className="dm-slider"></span>
                  </label>
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
          <NotificationDrawer topOffset={48}
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
        <div className="content-body" style={{maxWidth:'none', padding: isIframeRoute ? 0 : undefined, marginRight: drawerOpen ? 320 : 0, transition: 'margin-right .25s ease' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function WorkerDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  return <WorkerDetail workerId={id} onBack={() => navigate('/sa/employees')} />
}

function EmployeePage() {
  const navigate = useNavigate()
  return <Workers onViewWorker={(id) => navigate(`/sa/employees/${id}`)} />
}

function PanelFrame({ src }) {
  return (
    <iframe
      src={src}
      title={src}
      style={{ width: '100%', height: 'calc(100vh - 60px)', border: 'none' }}
    />
  )
}

export default function SuperAdminPanel() {
  return (
    <PageShell>
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="data-management" element={<DataManagement />} />
        <Route path="organization" element={<Organization />} />
        <Route path="employees" element={<EmployeePage />} />
        <Route path="employees/:id" element={<WorkerDetailPage />} />
        <Route path="leaves" element={<Leaves />} />
        <Route path="tickets" element={<Tickets />} />
        <Route path="events" element={<Events />} />
        <Route path="live-fro" element={<LiveFroStatus />} />
        <Route path="accounts" element={<PanelFrame src="/accounts" />} />
        <Route path="event-head" element={<PanelFrame src="/event-head" />} />
        <Route path="ngo-admin" element={<PanelFrame src="/ngo-admin" />} />
        <Route path="recruiter" element={<PanelFrame src="/recruiter" />} />
        <Route path="assets" element={<AssetOverview />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </PageShell>
  )
}
