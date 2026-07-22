import { NavLink, useLocation } from 'react-router-dom'

const NAV = [
  { id: 'inbox', path: '/fro/whatsapp-chat/inbox', label: 'Inbox', icon: '💬' },
  { id: 'dashboard', path: '/fro/whatsapp-chat/dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'contacts', path: '/fro/whatsapp-chat/contacts', label: 'Contacts', icon: '👥' },
  { id: 'templates', path: '/fro/whatsapp-chat/templates', label: 'Templates', icon: '📝' },
  { id: 'settings', path: '/fro/whatsapp-chat/settings', label: 'Settings', icon: '⚙️' },
]

export default function AdminSidebar({ user, onLogout }) {
  const location = useLocation()

  return (
    <aside style={{
      width: 220,
      borderRight: '1px solid #e5e7eb',
      display: 'flex',
      flexDirection: 'column',
      background: '#f9fafb',
      flexShrink: 0,
    }}>
      <div style={{ padding: '16px 16px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>WhatsApp CRM</div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{user?.name || user?.email}</div>
        <div style={{ fontSize: 10, color: '#25D366', marginTop: 1, fontWeight: 600, textTransform: 'uppercase' }}>
          {user?.role}
        </div>
      </div>
      <nav style={{ flex: 1, padding: '8px 0' }}>
        {NAV.map(n => (
          <NavLink
            key={n.id}
            to={n.path}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 500,
              color: location.pathname.startsWith(n.path) ? '#111827' : '#6b7280',
              background: location.pathname.startsWith(n.path) ? '#e8f4f8' : 'transparent',
              borderRight: location.pathname.startsWith(n.path) ? '3px solid #25D366' : '3px solid transparent',
              textDecoration: 'none',
              transition: 'all .15s',
            }}
          >
            <span style={{ fontSize: 16 }}>{n.icon}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
      <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb' }}>
        <button
          onClick={onLogout}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 600,
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            background: '#fff',
            color: '#dc2626',
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          Logout
        </button>
      </div>
    </aside>
  )
}
