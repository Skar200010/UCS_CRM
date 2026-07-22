import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import WhatsAppInbox from '../components/enhanced/WhatsAppInbox'
import WhatsAppCRMPanel from '../../whatsapp-crm/WhatsAppCRMPanel'

const waQueryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 30, retry: 1 } },
})

function LoginForm({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError('')

    const masterEmail = import.meta.env.VITE_WHATSAPP_MASTER_EMAIL
    const masterPassword = import.meta.env.VITE_WHATSAPP_MASTER_PASSWORD

    if (masterEmail && masterPassword && email === masterEmail && password === masterPassword) {
      onLogin({
        id: 'master',
        name: 'Master Admin',
        email: masterEmail,
        role: 'master',
        tenant_id: 'master',
      })
      setLoading(false)
      return
    }

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (authError) {
        const { data: agentData, error: agentErr } = await supabase
          .rpc('verify_agent', { p_email: email, p_password: password })

        if (agentErr || !agentData) {
          throw new Error(authError.message || 'Invalid credentials')
        }

        const userData = typeof agentData === 'string' ? JSON.parse(agentData) : agentData
        onLogin({
          id: userData.id,
          name: userData.name || email.split('@')[0],
          email: userData.email || email,
          role: userData.role || 'agent',
          tenant_id: userData.tenant_id || userData.id,
        })
        return
      }

      if (!data?.user) throw new Error('Login failed')

      const { data: dbUser } = await supabase.rpc('get_whatsapp_user', { p_id: data.user.id })
      const userInfo = dbUser ? (typeof dbUser === 'string' ? JSON.parse(dbUser) : dbUser) : null

      onLogin({
        id: userInfo?.id || data.user.id,
        name: userInfo?.name || userInfo?.first_name || email.split('@')[0],
        email: userInfo?.email || email,
        role: userInfo?.role || 'agent',
        tenant_id: userInfo?.tenant_id || data.user.id,
      })
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 180px)', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
      <div style={{ width: 360, padding: 32, background: '#fff', borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#25D36620', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#374151' }}>WhatsApp Login</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, maxWidth: 260, margin: '4px auto 0', lineHeight: 1.4 }}>
            Master / Admin / Agent — enter your credentials
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com"
              style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password"
              style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box' }} />
          </div>
          {error && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 12, padding: '8px 10px', background: '#fef2f2', borderRadius: 6 }}>{error}</div>}
          <button type="submit" disabled={loading || !email || !password}
            style={{ width: '100%', padding: '10px', fontSize: 14, fontWeight: 600, background: loading ? '#d1d5db' : '#25D366', color: '#fff', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Verifying...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  )
}

function WhatsAppChatInner() {
  const [waUser, setWaUser] = useState(() => {
    const stored = localStorage.getItem('wa_user')
    return stored ? JSON.parse(stored) : null
  })

  const isMaster = waUser?.role === 'master'

  const handleLogin = (user) => {
    localStorage.setItem('wa_user', JSON.stringify(user))
    setWaUser(user)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('wa_user')
    setWaUser(null)
  }

  if (!waUser) {
    return <LoginForm onLogin={handleLogin} />
  }

  if (isMaster) {
    return <WhatsAppCRMPanel user={waUser} onLogout={handleLogout} inboxComponent={WhatsAppInbox} />
  }

  return <WhatsAppInbox waUser={waUser} onLogout={handleLogout} />
}

export default function WhatsAppChat() {
  return (
    <QueryClientProvider client={waQueryClient}>
      <WhatsAppChatInner />
    </QueryClientProvider>
  )
}
