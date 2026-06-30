import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const cardRef = useRef(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!identifier || !password) { setError('Please enter Login ID and Password'); return }
    setLoading(true)
    setError('')
    try {
      await login(identifier, password)
      navigate('/home', { replace: true })
    } catch (err) {
      setError(err.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #2563eb 100%)' }}>
      {/* Decorative circles */}
      <div className="absolute top-[-80px] right-[-80px] w-64 h-64 rounded-full bg-white/5" />
      <div className="absolute bottom-[-60px] left-[-60px] w-48 h-48 rounded-full bg-white/5" />

      <div ref={cardRef} className="relative w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl p-8 animate-fade-in">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-[var(--primary)] flex items-center justify-center">
            <span className="text-2xl font-bold text-white">U</span>
          </div>
          <h1 className="text-lg font-bold text-[var(--primary)]">UCS Attendance</h1>
          <p className="text-xs text-[var(--ink-soft)] mt-0.5">Sign in to your account</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[var(--red-bg)] text-[var(--red)] text-xs text-center">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Login ID</label>
            <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors"
              placeholder="Enter your Login ID" autoComplete="username" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors"
              placeholder="Enter your password" autoComplete="current-password" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:bg-[var(--primary-light)] transition-colors disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
