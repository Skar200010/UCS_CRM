import { useState, useEffect } from 'react'
import { supabase } from '../../fro/lib/supabase'

export default function AdminSettingsPage() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('whatsapp_accounts').select('*')
      .then(({ data }) => setAccounts(data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ padding: 24, fontSize: 13, color: '#9ca3af' }}>Loading...</div>
  }

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Settings</h2>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 16px' }}>WhatsApp account settings</p>
      <div style={{ display: 'grid', gap: 16 }}>
        {accounts.map(a => (
          <div key={a.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{a.name}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Project: {a.project}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: a.is_active ? '#f0fdf4' : '#f3f4f6', color: a.is_active ? '#16a34a' : '#9ca3af' }}>
                  {a.is_active ? 'Active' : 'Inactive'}
                </span>
                {a.is_default && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#eff6ff', color: '#3b82f6' }}>Default</span>}
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              <div>Phone ID: {a.phone_number_id}</div>
              <div>WABA ID: {a.waba_id}</div>
            </div>
          </div>
        ))}
        {accounts.length === 0 && (
          <div style={{ fontSize: 13, color: '#9ca3af' }}>No WhatsApp accounts configured</div>
        )}
      </div>
    </div>
  )
}
