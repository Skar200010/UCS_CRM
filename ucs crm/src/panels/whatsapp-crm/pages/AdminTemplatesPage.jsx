import { useState, useEffect } from 'react'
import { supabase } from '../../fro/lib/supabase'

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('whatsapp_templates').select('*').order('name', { ascending: true })
      .then(({ data }) => setTemplates(data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ padding: 24, fontSize: 13, color: '#9ca3af' }}>Loading...</div>
  }

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Templates</h2>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 16px' }}>WhatsApp message templates</p>
      {templates.length === 0 ? (
        <div style={{ fontSize: 13, color: '#9ca3af' }}>No templates found</div>
      ) : (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {templates.map(t => (
            <div key={t.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{t.name}</div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                  background: t.status === 'approved' ? '#f0fdf4' : '#fef3c7',
                  color: t.status === 'approved' ? '#16a34a' : '#d97706',
                }}>
                  {t.status}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>
                <span>Language: {t.language}</span>
                {t.project && <span> | Project: {t.project}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
