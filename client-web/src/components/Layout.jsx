import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../store'

const navItems = [
  { to: '/home', label: 'Home', icon: HomeIcon },
  { to: '/attendance', label: 'Attendance', icon: ClockIcon },
  { to: '/profile', label: 'Profile', icon: ProfileIcon },
]

const backRoutes = ['/scanner', '/raise-ticket', '/edit-profile', '/print']

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const showBackButton = backRoutes.includes(location.pathname)

  const sidebarLinks = [
    { to: '/home', label: 'Dashboard', icon: HomeIcon },
    { to: '/attendance', label: 'Attendance', icon: ClockIcon },
    { to: '/profile', label: 'Profile', icon: ProfileIcon },
    { to: '/edit-profile', label: 'Edit Profile', icon: EditIcon },
  ]

  return (
    <div className="h-screen flex flex-col md:flex-row bg-[var(--surface)]">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-56 bg-[var(--primary)] text-white shrink-0">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="w-9 h-9 rounded-lg bg-[var(--primary-light)] flex items-center justify-center text-sm font-bold">U</div>
          <div>
            <div className="text-sm font-semibold">UFS</div>
            <div className="text-[10px] text-white/50 uppercase tracking-wider">Employee</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {sidebarLinks.map(l => (
            <NavLink key={l.to} to={l.to} end={l.to === '/home'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-[var(--primary-light)] text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
                }`
              }>
              <l.icon className="w-4 h-4" />
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 w-full transition-colors">
            <LogoutIcon className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Mobile back button for non-tab pages */}
        {isMobile && showBackButton && (
          <div className="sticky top-0 z-10 bg-[var(--surface)] border-b border-[var(--border)] px-2 py-1 flex items-center ios-safe-top">
            <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 px-2 py-2 min-h-[44px] text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              Back
            </button>
          </div>
        )}
        {/* Page Content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Tab Bar - visible on all routes */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--border)] flex z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}>
          {navItems.map(n => {
            const active = location.pathname === n.to
            return (
              <NavLink key={n.to} to={n.to}
                className={`flex-1 flex flex-col items-center py-1.5 text-[10px] transition-colors min-h-[56px] justify-center ${
                  active ? 'text-[var(--primary-light)]' : 'text-[var(--ink-muted)]'
                }`}>
                <n.icon className={`w-5 h-5 ${active ? 'text-[var(--primary-light)]' : ''}`} />
                <span className="mt-0.5">{n.label}</span>
              </NavLink>
            )
          })}
        </nav>
      )}
    </div>
  )
}

function HomeIcon({ className }) {
  return <svg width={18} height={18} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
}
function ProfileIcon({ className }) {
  return <svg width={18} height={18} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}
function ClockIcon({ className }) {
  return <svg width={18} height={18} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
}
function EditIcon({ className }) {
  return <svg width={18} height={18} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
}
function LogoutIcon({ className }) {
  return <svg width={18} height={18} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
}
