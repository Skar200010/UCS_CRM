import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { UcsProvider, useUcs } from './store'
import Login from './pages/Login'
import SuperAdminPanel from './panels/super-admin/SuperAdminPanel'
import HRPanel from './panels/hr/HRPanel'
import AccountsPanel from './panels/accounts/AccountsPanel'
import NgoAdminPanel from './panels/ngo-admin/NgoAdminPanel'
import FROPanel from './panels/fro/FROPanel'
import RecruiterPanel from './panels/recruiter/RecruiterPanel'
import EventHeadPanel from './panels/event-head/EventHeadPanel'

const ROLE_PATHS = {
  super_admin: '/sa',
  admin: '/ngo-admin',
  hr: '/hr',
  accounts: '/accounts',
  recruiter: '/recruiter',
  fro: '/fro',
  worker: '/fro',
  event_head: '/event-head',
  'Event Manager': '/event-head',
}

const ROLE_PANELS = {
  super_admin: { panel: SuperAdminPanel, cls: 'panel-sa' },
  admin: { panel: NgoAdminPanel, cls: 'panel-ngo-admin' },
  hr: { panel: HRPanel, cls: 'panel-hr' },
  accounts: { panel: AccountsPanel, cls: 'panel-accounts' },
  'admin': { panel: NgoAdminPanel, cls: 'panel-ngo-admin' },
  fro: { panel: FROPanel, cls: 'panel-fro' },
  recruiter: { panel: RecruiterPanel, cls: 'panel-recruiter' },
  event_head: { panel: EventHeadPanel, cls: 'panel-event-head' },
}

function ProtectedRoute({ role, children }) {
  const { user } = useUcs()
  const allowedRoles = Array.isArray(role) ? role : [role]
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'super_admin') return children
  if (!allowedRoles.includes(user.role) && !allowedRoles.includes(user.department)) {
    return <AccessDenied />
  }
  return children
}

function PanelWrapper({ roleKey }) {
  const mapping = ROLE_PANELS[roleKey]
  if (!mapping) return <AccessDenied />
  const Panel = mapping.panel
  return <div className={mapping.cls}><Panel /></div>
}

function AccessDenied() {
  return (
    <div className="login-page">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <div className="login-logo">!</div>
        <h2>Access Denied</h2>
        <p style={{ color: 'var(--ink-soft)', fontSize: '13px', margin: '12px 0 20px' }}>
          Your account does not have access to this portal.
        </p>
        <button className="btn btn-primary" onClick={() => {
          localStorage.removeItem('ucs_token')
          localStorage.removeItem('ucs_user')
          window.location.href = '/login'
        }}>
          Sign Out
        </button>
      </div>
    </div>
  )
}

function RootRedirect() {
  const { user } = useUcs()
  if (!user) return <Navigate to="/login" replace />
  const path = ROLE_PATHS[user.department] || ROLE_PATHS[user.role]
  if (path) return <Navigate to={path} replace />
  return <AccessDenied />
}

function LoginWrapper() {
  const { user } = useUcs()
  const navigate = useNavigate()
  if (user) {
    const path = ROLE_PATHS[user.department] || ROLE_PATHS[user.role]
    if (path) return <Navigate to={path} replace />
  }
  return <Login onLogin={(role) => {
    const path = ROLE_PATHS[role]
    if (path) navigate(path, { replace: true })
  }} />
}

export default function App() {
  return (
    <UcsProvider>
      <Routes>
        <Route path="/login" element={<LoginWrapper />} />
        <Route path="/" element={<RootRedirect />} />

        <Route path="/sa/*" element={
          <ProtectedRoute role="super_admin">
            <PanelWrapper roleKey="super_admin" />
          </ProtectedRoute>
        } />
        <Route path="/hr/*" element={
          <ProtectedRoute role={['hr', 'HR']}>
            <PanelWrapper roleKey="hr" />
          </ProtectedRoute>
        } />
        <Route path="/ngo-admin/*" element={
          <ProtectedRoute role={['admin']}>
            <PanelWrapper roleKey="admin" />
          </ProtectedRoute>
        } />
        <Route path="/fro/*" element={
          <ProtectedRoute role={['fro', 'worker', 'FRO']}>
            <PanelWrapper roleKey="fro" />
          </ProtectedRoute>
        } />
        <Route path="/accounts/*" element={
          <ProtectedRoute role={['accounts', 'admin']}>
            <PanelWrapper roleKey="accounts" />
          </ProtectedRoute>
        } />
        <Route path="/recruiter/*" element={
          <ProtectedRoute role={['recruiter', 'HR-Recruiter']}>
            <PanelWrapper roleKey="recruiter" />
          </ProtectedRoute>
        } />
        <Route path="/event-head/*" element={
          <ProtectedRoute role={['event_head', 'Event Head', 'Event Manager']}>
            <PanelWrapper roleKey="event_head" />
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </UcsProvider>
  )
}
