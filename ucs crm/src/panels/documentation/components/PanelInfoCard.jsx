import { useState } from 'react'

const ICONS = {
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
}

const COLORS = {
  'super-admin': '#1E3A5F',
  'hr': '#D97706',
  'accounts': '#059669',
  'fro': '#2563EB',
  'ngo-admin': '#7C3AED',
  'recruiter': '#DC2626',
  'event-head': '#0891B2',
  'flutter-app': '#0F766E',
  'web-pwa': '#4F46E5',
  'database': '#64748B',
}

export default function PanelInfoCard({ panel }) {
  const [showFeatures, setShowFeatures] = useState(false)
  if (!panel) return null

  const screensCount = panel.screens?.length || 0
  const totalApis = panel.screens?.reduce((s, sc) =>
    s + (sc.features ? sc.features.reduce((sf, f) => sf + (f.apis ? f.apis.length : 0), 0) : 0), 0) || 0
  const features = panel.keyFeatures || []
  const color = COLORS[panel.id] || '#64748B'
  const icon = ICONS[panel.id] || '📄'

  return (
    <div className="doc-panel-info" style={{
      background: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderRadius: 10,
      padding: 20,
      marginBottom: 16,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 28 }}>{icon}</span>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1E293B', fontFamily: "'Calibri Light', sans-serif" }}>
            {panel.title}
          </h2>
          <span style={{
            display: 'inline-block',
            fontSize: 10,
            fontWeight: 700,
            color: '#FFF',
            background: color,
            padding: '2px 10px',
            borderRadius: 12,
            marginTop: 4,
            letterSpacing: 0.3,
          }}>
            {panel.roles?.includes('*') ? 'All Roles' : panel.roles?.join(', ')}
          </span>
        </div>
      </div>

      {/* Description */}
      {panel.description && (
        <p style={{
          fontSize: 13,
          lineHeight: 1.7,
          color: '#475569',
          margin: '0 0 14px 0',
        }}>
          {panel.description}
        </p>
      )}

      {/* Stats row */}
      <div style={{
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        padding: '10px 0',
        borderTop: '1px solid #F1F5F9',
        borderBottom: features.length > 0 ? '1px solid #F1F5F9' : 'none',
        marginBottom: features.length > 0 ? 12 : 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>📂</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{screensCount}</span>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>Screens</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>🔌</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{totalApis}</span>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>API Endpoints</span>
        </div>
        {panel.screens?.[0]?.path && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>🚪</span>
            <span style={{ fontSize: 12, color: '#64748B' }}>Entry: </span>
            <code style={{ fontSize: 11, fontFamily: 'Consolas, monospace', color: '#2563EB' }}>{panel.screens[0].path}</code>
          </div>
        )}
      </div>

      {/* Key Features */}
      {features.length > 0 && (
        <div>
          <div
            onClick={() => setShowFeatures(!showFeatures)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              color: '#64748B',
              userSelect: 'none',
            }}
          >
            <span style={{ fontSize: 14 }}>⭐</span>
            <span>Key Features</span>
            <span style={{ marginLeft: 'auto', color: '#94A3B8', fontSize: 11 }}>{showFeatures ? '▲' : '▼'}</span>
          </div>
          {showFeatures && (
            <ul style={{
              margin: '6px 0 0 0',
              paddingLeft: 24,
              listStyle: 'none',
            }}>
              {features.map((f, i) => (
                <li key={i} style={{
                  fontSize: 12,
                  color: '#475569',
                  padding: '4px 0',
                  lineHeight: 1.5,
                  position: 'relative',
                }}>
                  <span style={{
                    position: 'absolute',
                    left: -16,
                    top: 7,
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: color,
                    opacity: 0.5,
                  }} />
                  {f}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
