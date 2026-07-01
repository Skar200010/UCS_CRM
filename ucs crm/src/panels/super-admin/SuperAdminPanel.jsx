import { useState, useRef, useEffect, useCallback } from 'react'
import { useUcs } from '../../store'
import { themes, applyTheme } from '../hr/theme'
import { GridFour, Buildings, Users, ClockAfternoon, Airplane, Ticket, Database } from '@phosphor-icons/react'
import Dashboard from './pages/Dashboard'
import Organization from './pages/Organization'
import Workers from './pages/Workers'
import WorkerDetail from './pages/WorkerDetail'
import Attendance from './pages/Attendance'
import Leaves from './pages/Leaves'
import DataManagement from './pages/DataManagement'
import Tickets from './pages/Tickets'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: GridFour },
  { id: 'data-management', label: 'Data Management', icon: Database },
  { id: 'organization', label: 'Organization', icon: Buildings },
  { id: 'employees', label: 'Employees', icon: Users },
  { id: 'attendance', label: 'Attendance', icon: ClockAfternoon },
  { id: 'leaves', label: 'Leaves', icon: Airplane },
  { id: 'tickets', label: 'Tickets', icon: Ticket },
]

const navMap = {}
NAV.forEach(n => { navMap[n.id] = n })

const GROUPS = [
  { id: 'org', label: 'Organization', icon: Buildings, items: ['organization', 'employees'] },
  { id: 'time', label: 'Time & Attendance', icon: ClockAfternoon, items: ['attendance', 'leaves'] },
]

const standaloneIds = ['dashboard', 'data-management', 'tickets']



function Sidebar({ active, setActive, collapsedGroups, toggleGroup }) {
  return (
    <aside className="sa-sidebar">
      <div className="sa-sidebar-header">
        <div className="sa-logo">SA</div>
        <div><div className="sa-logo-text">UFS</div><div style={{fontSize:11,color:'var(--text-muted)',letterSpacing:.5,textTransform:'uppercase'}}>Super Admin</div></div>
      </div>
      <nav className="sa-nav">
        {standaloneIds.map(id => {
          const n = navMap[id]
          const Icon = n.icon
          return (
            <button key={n.id} className={`sa-nav-item${active === n.id ? ' active' : ''}`} onClick={() => setActive(n.id)}>
              <Icon className="sa-nav-icon" size={16} />
              <span className="sa-nav-label">{n.label}</span>
            </button>
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
                  <button key={n.id} className={`sa-nav-item sa-nav-sub${active === n.id ? ' active' : ''}`} onClick={() => setActive(n.id)}>
                    <Icon className="sa-nav-icon" size={16} />
                    <span className="sa-nav-label">{n.label}</span>
                  </button>
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

export default function SuperAdminPanel() {
  const { user, logout } = useUcs()
  const [active, setActive] = useState(() => {
    try { return localStorage.getItem('sa_active') || 'dashboard' } catch { return 'dashboard' }
  })
  const [workerId, setWorkerId] = useState(null)
  const [showMenu, setShowMenu] = useState(false)
  const [themeName, setThemeName] = useState(() => {
    try { return localStorage.getItem('sa_theme') || 'sky' } catch { return 'sky' }
  })
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sa_collapsed_groups') || '[]') } catch { return [] }
  })
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('sa_dark') === 'true' } catch { return false }
  })
  const menuRef = useRef(null)

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

  useEffect(() => {
    localStorage.setItem('sa_active', active)
  }, [active])

  const toggleGroup = (id) => {
    setCollapsedGroups(prev => {
      const next = prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
      localStorage.setItem('sa_collapsed_groups', JSON.stringify(next))
      return next
    })
  }

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false)
    }
    if (showMenu) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMenu])

  const handleViewWorker = useCallback((id) => {
    setWorkerId(id)
    setActive('worker-detail')
  }, [])

  const handleBack = useCallback(() => {
    setWorkerId(null)
    setActive('workers')
  }, [])

  const userName = user?.name || 'Super Admin'
  const initials = userName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  const meta = NAV.find(n => n.id === active)

  const renderPage = () => {
    switch (active) {
      case 'dashboard': return <Dashboard />
      case 'organization': return <Organization />
      case 'employees': return <Workers onViewWorker={handleViewWorker} />
      case 'worker-detail': return <WorkerDetail workerId={workerId} onBack={handleBack} />
      case 'attendance': return <Attendance />
      case 'leaves': return <Leaves />
      case 'data-management': return <DataManagement />
      case 'tickets': return <Tickets />
      default: return <Dashboard />
    }
  }

  return (
    <div className="app">
      <Sidebar active={active} setActive={setActive} collapsedGroups={collapsedGroups} toggleGroup={toggleGroup} />
      <div className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">{meta?.label || 'Dashboard'}</div>
            <h2>{meta?.label || 'Dashboard'}</h2>
          </div>
          <div className="topbar-user" ref={menuRef} onClick={() => setShowMenu(!showMenu)}>
            <div className="topbar-user-text">
              <div className="topbar-name">{userName}</div>
              <div className="topbar-role">Super Admin</div>
            </div>
            <div className="avatar">{initials}</div>
            {showMenu && (
              <div className="user-menu">
                <div className="user-menu-item" style={{fontWeight:600, fontSize:13, cursor:'default'}}>{userName} <span style={{fontWeight:400, color:'var(--ink-soft)'}}>Super Admin</span></div>
                <div className="user-menu-divider" />
                <div className="user-menu-item" style={{cursor:'default'}}>
                  <span style={{fontSize:13, color:'var(--ink-soft)'}}>{dark ? '☀️ Light' : '🌙 Dark'}</span>
                  <label className="dm-toggle" style={{marginLeft:'auto'}}>
                    <input type="checkbox" checked={dark} onChange={() => setDark(!dark)} />
                    <span className="dm-slider"></span>
                  </label>
                </div>
                <div className="user-menu-item" style={{cursor:'default', fontSize:13, color:'#666'}}>
                  Theme: <select value={themeName} onClick={e=>e.stopPropagation()} onChange={e=>setThemeName(e.target.value)} style={{marginLeft:8, border:'1px solid var(--line)', borderRadius:6, padding:'2px 8px'}}>
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
        <div className="content-body" style={{maxWidth:'none'}}>
          {renderPage()}
        </div>
      </div>
    </div>
  )
}
