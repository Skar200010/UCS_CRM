import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { CACHE_KEYS } from './config'
import { api } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem(CACHE_KEYS.WORKER)
    return raw ? JSON.parse(raw) : null
  })
  const [token, setToken] = useState(() => localStorage.getItem(CACHE_KEYS.TOKEN))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token && user) {
      setLoading(false)
      return
    }
    const t = localStorage.getItem(CACHE_KEYS.TOKEN)
    const w = localStorage.getItem(CACHE_KEYS.WORKER)
    if (t && w) {
      setToken(t)
      setUser(JSON.parse(w))
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (identifier, password) => {
    const data = await api.login(identifier, password)
    const t = data.token || data.access_token
    const w = data.worker || data
    localStorage.setItem(CACHE_KEYS.TOKEN, t)
    localStorage.setItem(CACHE_KEYS.WORKER, JSON.stringify(w))
    setToken(t)
    setUser(w)
    return data
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(CACHE_KEYS.TOKEN)
    localStorage.removeItem(CACHE_KEYS.WORKER)
    Object.values(CACHE_KEYS).forEach(k => localStorage.removeItem(k))
    setToken(null)
    setUser(null)
  }, [])

  const updateUser = useCallback((u) => {
    localStorage.setItem(CACHE_KEYS.WORKER, JSON.stringify(u))
    setUser(u)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
