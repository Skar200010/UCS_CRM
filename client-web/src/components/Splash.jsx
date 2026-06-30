import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store'

export default function Splash() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [show, setShow] = useState(false)

  useEffect(() => {
    setShow(true)
    const t = setTimeout(() => {
      if (!loading) {
        navigate(user ? '/home' : '/login', { replace: true })
      }
    }, 1200)
    return () => clearTimeout(t)
  }, [loading])

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => navigate(user ? '/home' : '/login', { replace: true }), 1200)
      return () => clearTimeout(t)
    }
  }, [loading, user])

  return (
    <div className="h-screen flex items-center justify-center bg-white">
      <div className={`text-center transition-all duration-700 ${show ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-[var(--primary)] flex items-center justify-center">
          <span className="text-3xl font-bold text-white">U</span>
        </div>
        <h1 className="text-xl font-bold text-[var(--primary)]">UCS Attendance</h1>
        <p className="text-sm text-[var(--ink-muted)] mt-1">Employee Portal</p>
      </div>
    </div>
  )
}
