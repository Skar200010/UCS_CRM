import { useDoc } from '../store'

const ICONS = {
  'auth': '🔑',
  'super-admin': '⚙️',
  'hr': '👥',
  'accounts': '💰',
  'fro': '📞',
  'ngo-admin': '🏢',
  'recruiter': '🎯',
  'event-head': '📅',
  'flutter-app': '📱',
  'web-pwa': '🌐',
  'database': '🗄️',
  'whatsapp-crm': '💬',
}

export default function DocSidebar() {
  const { panels, activePanel, setActivePanel, setActiveScreen, setSearchQuery } = useDoc()

  return (
    <div className="doc-sidebar">
      <div className="doc-sidebar-header">
        <span style={{ fontSize: 16 }}>📖</span>
        <span>Panels</span>
      </div>
      <div className="doc-sidebar-list">
        {panels.map(p => (
          <div
            key={p.id}
            className={`doc-sidebar-item ${activePanel === p.id ? 'active' : ''}`}
            onClick={() => {
              setActivePanel(p.id)
              setActiveScreen(null)
              setSearchQuery('')
            }}
          >
            <span style={{ fontSize: 14, marginRight: 8 }}>{ICONS[p.id] || '📄'}</span>
            <span>{p.title}</span>
            {p.id === activePanel && <span style={{ marginLeft: 'auto', fontSize: 10 }}>◀</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
