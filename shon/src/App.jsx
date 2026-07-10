import { useState } from 'react'
import { getUser, clearSession, setSession } from './api'
import AttendanceView from './AttendanceView'

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'admin@ufs.com'
const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASSWORD || '123456'
const USER_EMAIL = import.meta.env.VITE_USER_EMAIL || 'user@ufs.com'
const USER_PASS = import.meta.env.VITE_USER_PASSWORD || '123456'

export default function App() {
  const [saved, setSaved] = useState(() => getUser())
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (saved) {
    return (
      <div className="app">
        <header className="topbar">
          <div>
            <h2>Employees</h2>
          </div>
          <div className="topbar-user">
            <span className="topbar-name">{saved.email}</span>
            <button className="btn btn-sm" onClick={() => { clearSession(); setSaved(null) }}>Sign out</button>
          </div>
        </header>
        <div className="content">
          <AttendanceView readOnly={saved.readOnly} />
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h2>Attendance</h2>
        <p className="login-sub">Sign in to view attendance</p>
        <form className="login-form" onSubmit={(e) => {
          e.preventDefault()
          if (!identifier || !password) { setError('Please fill in all fields'); return }
          setLoading(true)
          setError('')
          setTimeout(() => {
            const email = identifier.trim().toLowerCase()
            const pass = password.trim()
            if (email === ADMIN_EMAIL && pass === ADMIN_PASS) {
              setSession(email, false)
              setSaved({ email, readOnly: false })
            } else if (email === USER_EMAIL && pass === USER_PASS) {
              setSession(email, true)
              setSaved({ email, readOnly: true })
            } else {
              setError('Invalid credentials')
            }
            setLoading(false)
          }, 400)
        }}>
          {error && <div className="login-error">{error}</div>}
          <label className="field">
            <span>Email / Login ID</span>
            <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="Enter email or login ID" />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" />
          </label>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
