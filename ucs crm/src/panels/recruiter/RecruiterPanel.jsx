import { useState, useEffect, useRef } from 'react'
import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import { useUcs } from '../../store'
import { themes, applyTheme } from '../hr/theme'
import { RecProvider, useRec, initials, avatarColor, avatarTint } from './store'
import { Grid, Spark, Funnel, Users, Brief, Heart, LogOut } from './icons'
import Dashboard from './components/Dashboard'
import Leads from './components/Leads'
import Pipeline from './components/Pipeline'
import Candidates from './components/Candidates'
import Jobs from './components/Jobs'
import Interviews from './components/Interviews'

const NAV = [
  { id:'dashboard',  path:'/recruiter/dashboard',  label:'Dashboard',  icon:Grid,   eyebrow:'Overview',  sub:'Your hiring at a glance' },
  { id:'leads',      path:'/recruiter/leads',      label:'Leads',      icon:Spark,  eyebrow:'Leads',    sub:'Manage incoming leads and track conversions' },
  { id:'pipeline',   path:'/recruiter/pipeline',   label:'Pipeline',   icon:Funnel, eyebrow:'Hiring',    sub:'Drag candidates through the stages' },
  { id:'candidates', path:'/recruiter/candidates', label:'Candidates', icon:Users,  eyebrow:'People',    sub:'Search and filter every applicant' },
  { id:'jobs',       path:'/recruiter/jobs',       label:'Jobs',       icon:Brief,  eyebrow:'Roles',     sub:'Open roles and applicant counts' },
  { id:'interviews', path:'/recruiter/interviews', label:'Interviews', icon:Grid,  eyebrow:'Schedule',  sub:'Upcoming interviews this week' },
]

function AppShell() {
  const location = useLocation()
  const { user, logout } = useUcs()
  const [themeName, setThemeName] = useState(() => localStorage.getItem('recruiter_theme') || 'sky')
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef(null)
  useEffect(() => {
    if (themes[themeName]) applyTheme(themes[themeName], '.panel-recruiter');
    localStorage.setItem('recruiter_theme', themeName)
  }, [themeName])
  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false) }
    if (showMenu) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMenu])
  const recruiter = useRec()
  const meta = NAV.find(n => location.pathname === n.path) || NAV[0]
  const name = user?.name || 'User'
  const init = initials(name)
  const col = avatarColor(name)

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">T</div>
          <div><h1>TalentForge</h1><span>Recruiter Studio</span></div>
        </div>
        <nav className="nav">
          <div className="nav-label">Hire</div>
          {NAV.map(n => { const Icon=n.icon; return (
            <NavLink key={n.id} to={n.path}
              className={`nav-item ${location.pathname === n.path ? 'active' : ''}`}>
              <Icon className="ico" /><span>{n.label}</span>
            </NavLink>
          )})}
        </nav>
        <div className="nav-foot"><Heart width={13} style={{verticalAlign:-2,marginRight:6}} />Hire well, hire kind.</div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div><div className="eyebrow">{meta.eyebrow}</div><h2>{meta.label}</h2></div>
          <div className="user" style={{cursor:'pointer', position:'relative'}} onClick={() => setShowMenu(!showMenu)} ref={menuRef}>
            <div className="avatar" style={{background:avatarTint(col),color:col,width:38,height:38, cursor:'pointer'}}>{init}</div>
            {showMenu && (
              <div className="user-menu" style={{right:0, left:'auto', top:'100%', marginTop:8}}>
                <div className="user-menu-item" style={{fontWeight:600, fontSize:13, cursor:'default'}}>{name} <span style={{fontWeight:400, color:'var(--ink-soft)'}}>{user?.login_id || 'Recruiter'}</span></div>
                <div className="user-menu-divider" />
                <div className="user-menu-item" style={{cursor:'default', fontSize:13}}>
                  Theme: <select value={themeName} onChange={e=>setThemeName(e.target.value)} style={{marginLeft:8, border:'1px solid var(--line)', borderRadius:6, padding:'2px 6px', fontSize:12, background:'var(--paper)', color:'var(--ink)'}} onClick={e=>e.stopPropagation()}>
                    {Object.keys(themes).map(k => <option key={k} value={k}>{themes[k].name.replace(' (Default)','')}</option>)}
                  </select>
                </div>
                <div className="user-menu-divider" />
                <button className="user-menu-item" onClick={() => logout()}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="content">
          <p style={{color:'var(--ink-soft)',marginBottom:22,marginTop:-4}}>{meta.sub}</p>
          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="leads" element={<Leads />} />
            <Route path="pipeline" element={<Pipeline />} />
            <Route path="candidates" element={<Candidates />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="interviews" element={<Interviews />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function RecruiterPanel() {
  return (
    <RecProvider>
      <AppShell />
    </RecProvider>
  )
}
