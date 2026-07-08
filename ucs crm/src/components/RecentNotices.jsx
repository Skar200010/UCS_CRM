import { useState, useEffect } from 'react'

const BASE = import.meta.env.VITE_API_URL || 'https://ucs-crm-backend.vercel.app/api'

const TARGET_LABELS = {
  all: null,
  admin: 'NGO Admin',
  accounts: 'Accounts',
  hr: 'HR',
  recruiter: 'Recruiter',
  fro: 'FRO',
  event_head: 'Event Head',
}

function getToken() {
  try { return localStorage.getItem('ucs_token') } catch { return null }
}

function getRole() {
  try {
    const u = localStorage.getItem('ucs_user')
    if (u) return JSON.parse(u).role
  } catch { return null }
}

export default function RecentNotices({ limit = 5, title = 'Recent Notices' }) {
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)
  const role = getRole()

  useEffect(() => {
    const token = getToken()
    if (!token) { setLoading(false); return }

    const params = role ? `?target_role=${role}` : ''
    fetch(`${BASE}/notices${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        setNotices(Array.isArray(d) ? d.slice(0, limit) : d?.data?.slice(0, limit) || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [limit, role])

  if (loading) return null

  return (
    <div className="nd-card nd-appear" style={{ animationDelay: '0.8s', marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="nd-section-title" style={{ color: '#000', fontSize: 14 }}>{title}</h3>
        {notices.length > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: '#3B82F6',
            background: 'rgba(59,130,246,0.15)', borderRadius: 99, padding: '3px 10px',
          }}>
            {notices.length}
          </span>
        )}
      </div>
      {notices.length === 0 ? (
        <p className="nd-muted" style={{ fontSize: 12 }}>No notices yet</p>
      ) : (
        <div style={{ marginTop: 8 }}>
          {notices.map((n, i) => (
            <div key={n.id || i} style={{
              display: 'flex', gap: 8, padding: '8px 10px',
              borderRadius: 8, marginBottom: 6,
              background: '#EFF6FF', border: '1px solid #BFDBFE'
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                background: i % 2 === 0 ? '#3B82F6' : '#60A5FA',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 16 }}>
                  {i % 2 === 0 ? 'priority_high' : 'campaign'}
                </span>
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3A5F', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {n.title}
                  {TARGET_LABELS[n.target_role] && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                      background: '#DBEAFE', color: '#2563EB', whiteSpace: 'nowrap',
                    }}>
                      {TARGET_LABELS[n.target_role]}
                    </span>
                  )}
                </div>
                {n.content && (
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 2, lineHeight: 1.4 }}>
                    {n.content.length > 100 ? n.content.slice(0, 100) + '\u2026' : n.content}
                  </div>
                )}
                <div style={{ fontSize: 10, color: '#60A5FA', fontWeight: 600, marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {n.created_at ? new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                  {n.created_by_name && (
                    <span style={{ color: '#94a3b8', fontWeight: 500 }}>
                      by {n.created_by_name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
