import { useState, useEffect } from 'react'
import { supabase } from '../../fro/lib/supabase'

export default function AdminContactsPage() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadContacts()
  }, [])

  const loadContacts = async () => {
    setLoading(true)
    let query = supabase.from('contacts').select('*').order('created_at', { ascending: false }).limit(100)
    if (search.trim()) {
      query = query.or(`wa_profile_name.ilike.%${search}%,phone.ilike.%${search}%`)
    }
    const { data } = await query
    setContacts(data || [])
    setLoading(false)
  }

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Contacts</h2>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 16px' }}>All WhatsApp contacts</p>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search contacts..."
          onKeyDown={e => e.key === 'Enter' && loadContacts()}
          style={{ flex: 1, padding: '8px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, outline: 'none' }}
        />
        <button onClick={loadContacts} className="btn btn-primary" style={{ fontSize: 12 }}>Search</button>
      </div>
      {loading ? (
        <div style={{ fontSize: 13, color: '#9ca3af' }}>Loading...</div>
      ) : contacts.length === 0 ? (
        <div style={{ fontSize: 13, color: '#9ca3af' }}>No contacts found</div>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Name</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Phone</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Project</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Source</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px 12px', color: '#111827', fontWeight: 500 }}>{c.wa_profile_name || '—'}</td>
                  <td style={{ padding: '8px 12px', color: '#6b7280' }}>{c.phone}</td>
                  <td style={{ padding: '8px 12px', color: '#6b7280' }}>{c.project || '—'}</td>
                  <td style={{ padding: '8px 12px', color: '#6b7280' }}>{c.source || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
