import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store'
import { api } from '../api'

export default function EditProfile() {
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    api.myProfile().then(d => {
      const w = d?.worker || d
      setForm({ name: w.name || '', email: w.email || '', phone: w.phone || w.phone_number || '', address: w.address || '' })
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      const d = await api.updateProfile(form)
      updateUser(d?.worker || d)
      navigate('/profile')
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  return (
    <div className="p-4 max-w-lg mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h2 className="text-lg font-bold text-[var(--primary)]">Edit Profile</h2>
      </div>

      {loading ? (
        <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />)}</div>
      ) : (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[var(--border)] space-y-4">
          {error && <div className="p-3 rounded-lg bg-[var(--red-bg)] text-[var(--red)] text-xs">{error}</div>}
          {['name', 'email', 'phone', 'address'].map(f => (
            <div key={f}>
              <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1 capitalize">{f}</label>
              {f === 'address' ? (
                <textarea value={form[f]} onChange={e => setForm({ ...form, [f]: e.target.value })} rows={2}
                  className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-blue-500 resize-none" />
              ) : (
                <input type={f === 'email' ? 'email' : 'text'} value={form[f]} onChange={e => setForm({ ...form, [f]: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-blue-500" />
              )}
            </div>
          ))}
          <button onClick={handleSave} disabled={saving}
            className="w-full py-2.5 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:bg-[var(--primary-light)] transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  )
}
