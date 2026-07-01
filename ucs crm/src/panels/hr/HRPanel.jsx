import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import { useUcs } from '../../store'
import { Grid, Users, Plane, Clock, FileTxt, Cal, Bell } from './icons'
import { themes, applyTheme } from './theme'
import Overview from './components/Overview'
import Workers from './components/Workers'
import EmployeeDetail from './components/EmployeeDetail'
import Offboarding from './components/Offboarding'
import Leaves from './components/Leaves'
import Attendance from './components/Attendance'
import Letters from './components/Letters'
import Holidays from './components/Holidays'
import Recruiters from './components/Recruiters'
import GenerateQR from './components/GenerateQR'
import Loans from './components/Loans'
import Tickets from './components/Tickets'
import PhoneNumbers from './components/PhoneNumbers'
import SettingsPage from './components/Settings'
import { fetchTicketCount } from './store'

const NAV = [
  { id:'overview',   label:'Overview',    icon:Grid,    eyebrow:'Dashboard',   sub:'Your team at a glance' },
  { id:'employees',  label:'Employees',   icon:Users,   eyebrow:'People',      sub:'Add and manage employees' },
  { id:'attendance', label:'Attendance',  icon:Clock,   eyebrow:'Daily',       sub:'Mark who is in today' },
  { id:'leaves',     label:'Leaves',      icon:Plane,   eyebrow:'Time off',    sub:'Requests and approvals' },
  { id:'letters',    label:'Letters',     icon:FileTxt, eyebrow:'Documents',   sub:'Generate HR letters' },
  { id:'recruiters', label:'Recruiters',  icon:Users,   eyebrow:'Pipeline',    sub:'Track leads and hires' },

  { id:'holidays',   label:'Holidays',    icon:Cal,     eyebrow:'Calendar',    sub:'Plan the holiday chart' },
  { id:'qr',         label:'QR Codes',    icon:Grid,    eyebrow:'Attendance',  sub:'Generate and manage QR codes' },
  { id:'loans',      label:'Loans & Advances', icon:Grid, eyebrow:'Finance',  sub:'Approve and manage loans & advances' },
  { id:'tickets',    label:'Tickets',    icon:FileTxt, eyebrow:'Corrections', sub:'Attendance correction tickets' },
  { id:'phone-numbers', label:'Phone Numbers', icon:Grid, eyebrow:'Contacts', sub:'Manage worker phone numbers' },
]

const PANELS = { overview:Overview, employees:Workers, attendance:Attendance, leaves:Leaves, letters:Letters, recruiters:Recruiters, holidays:Holidays, qr:GenerateQR, loans:Loans, tickets:Tickets, 'phone-numbers':PhoneNumbers }

function Sidebar({ active, setActive, open, onClose }) {
  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark" style={{background:'#5B6B4E',borderRadius:10,width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:18}}>U</div>
          <div><h1>UFS</h1><span>HR Panel</span></div>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(n => { const Icon = n.icon; return (
            <button key={n.id} className={`snav-item ${active===n.id?'active':''}`}
              onClick={() => { setActive(n.id); onClose(); }}>
              <Icon className="ico" /> <span>{n.label}</span>
            </button>
          )})}
        </nav>
      </aside>
    </>
  )
}

export default function HRPanel() {
  const { user, logout } = useUcs()
  const [active, setActive] = useState(() => {
    const stored = localStorage.getItem('hr_panel')
    return stored && NAV.some(n => n.id === stored) ? stored : 'overview'
  })
  const setActiveAndPersist = useCallback((id) => { setActive(id); localStorage.setItem('hr_panel', id) }, [])
  const [menuOpen, setMenuOpen] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [offboardingEmployee, setOffboardingEmployee] = useState(null)
  const menuRef = useRef(null)

  const [themeName, setThemeName] = useState(() => localStorage.getItem('hr_theme') || 'sky')
  useEffect(() => { if (themes[themeName]) applyTheme(themes[themeName], '.panel-hr'); localStorage.setItem('hr_theme', themeName) }, [themeName])

  const [ticketCount, setTicketCount] = useState(0)
  useEffect(() => {
    const poll = async () => { try { const r = await fetchTicketCount(); setTicketCount(r?.count ?? 0) } catch (e) { /* ignore */ } }
    poll(); const id = setInterval(poll, 30000); return () => clearInterval(id)
  }, [])

  const Panel = PANELS[active]
  const meta = NAV.find(n => n.id === active)
  const userName = user?.name || 'HR User'
  const userRole = user?.role || 'HR'
  const userInitials = userName.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()

  const handleBack = useCallback(() => setSelectedEmployee(null), [])
  const handleSelectEmployee = useCallback((worker) => setSelectedEmployee(worker), [])
  const handleOffboard = useCallback((worker) => setOffboardingEmployee(worker), [])
  const handleOffboardBack = useCallback(() => setOffboardingEmployee(null), [])
  const handleSettingsClose = useCallback(() => setShowSettings(false), [])

  useEffect(() => { setSelectedEmployee(null); setOffboardingEmployee(null); setShowSettings(false) }, [active])
  useLayoutEffect(() => { window.scrollTo(0, 0); requestAnimationFrame(() => window.scrollTo(0, 0)) }, [active, showSettings, selectedEmployee, offboardingEmployee])

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false) }
    if (showMenu) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMenu])

  return (
    <div className="app">
      <Sidebar active={active} setActive={setActiveAndPersist} open={menuOpen} onClose={() => setMenuOpen(false)} />
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
            <div className="eyebrow">{showSettings ? 'Configuration' : meta?.eyebrow}</div>
            <h2>{showSettings ? 'Settings' : meta?.label}</h2>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <button className="btn btn-icon" onClick={() => setActiveAndPersist('tickets')} style={{position:'relative'}} title="Pending Tickets">
              <Bell size={19} />
              {ticketCount > 0 && <span className="badge badge-pending2" style={{position:'absolute',top:-6,right:-6,fontSize:10,padding:'1px 5px',lineHeight:'16px',minWidth:18,textAlign:'center'}}>{ticketCount > 99 ? '99+' : ticketCount}</span>}
            </button>
            <div className="topbar-user" ref={menuRef} onClick={() => setShowMenu(!showMenu)}>
            <div className="topbar-user-text">
              <div className="topbar-name">{userName}</div>
              <div className="topbar-role">{userRole}</div>
            </div>
            <div className="avatar" style={{ background:'#5B6B4E22', color:'#5B6B4E', width:36, height:36, cursor:'pointer' }}>{userInitials}</div>
            {showMenu && (
              <div className="user-menu">
                <div className="user-menu-item" style={{cursor:'default', fontSize:13, color:'#666'}}>
                  Theme: <select value={themeName} onClick={e=>e.stopPropagation()} onChange={e=>setThemeName(e.target.value)} style={{marginLeft:8, border:'1px solid #ddd', borderRadius:6, padding:'2px 8px'}}>
                    {Object.keys(themes).map(k => <option key={k} value={k}>{themes[k].name}</option>)}
                  </select>
                </div>
                <div className="user-menu-divider" />
                <button className="user-menu-item" onClick={() => { setShowMenu(false); setShowSettings(true) }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  Settings
                </button>
                <div className="user-menu-divider" />
                <button className="user-menu-item" onClick={() => { setShowMenu(false); logout() }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
          </div>
        </header>
        <div className="content-body">
          {showSettings ? (
            <SettingsPage onClose={handleSettingsClose} />
          ) : offboardingEmployee ? (
            <Offboarding worker={offboardingEmployee} onBack={handleOffboardBack} />
          ) : selectedEmployee ? (
            <EmployeeDetail worker={selectedEmployee} onBack={handleBack} onOffboard={handleOffboard} />
          ) : active === 'employees' ? (
            <Workers onSelect={handleSelectEmployee} onOffboard={handleOffboard} />
          ) : (
            <Panel />
          )}
        </div>
      </div>
    </div>
  )
}
