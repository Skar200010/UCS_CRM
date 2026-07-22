import { useState, useEffect } from 'react'
import { supabase } from '../../fro/lib/supabase'

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({ conversations: 0, contacts: 0, messages: 0, templates: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('conversations').select('id', { count: 'exact', head: true }),
      supabase.from('contacts').select('id', { count: 'exact', head: true }),
      supabase.from('messages').select('id', { count: 'exact', head: true }),
      supabase.from('whatsapp_templates').select('id', { count: 'exact', head: true }),
    ]).then(([conv, cont, msg, tpl]) => {
      setStats({
        conversations: conv.count || 0,
        contacts: cont.count || 0,
        messages: msg.count || 0,
        templates: tpl.count || 0,
      })
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const cards = [
    { label: 'Conversations', value: stats.conversations, color: '#25D366', bg: '#f0fdf4' },
    { label: 'Contacts', value: stats.contacts, color: '#3b82f6', bg: '#eff6ff' },
    { label: 'Messages', value: stats.messages, color: '#8b5cf6', bg: '#f5f3ff' },
    { label: 'Templates', value: stats.templates, color: '#f59e0b', bg: '#fffbeb' },
  ]

  if (loading) {
    return <div style={{ padding: 24, fontSize: 13, color: '#9ca3af' }}>Loading...</div>
  }

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Dashboard</h2>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 24px' }}>WhatsApp CRM overview</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        {cards.map(card => (
          <div key={card.label} style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{card.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
