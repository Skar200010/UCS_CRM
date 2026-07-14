import { useState } from 'react'
import FeatureCard from './FeatureCard'

export default function ScreenDetail({ screen, panelId }) {
  const [expanded, setExpanded] = useState(false)
  if (!screen) return null

  return (
    <div className="doc-screen">
      <div className="doc-screen-header" onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
        <div>
          <strong style={{ fontSize: 14, color: '#1E293B' }}>{screen.name}</strong>
          {screen.path && <code style={{ marginLeft: 8, fontSize: 11, color: '#64748B' }}>{screen.path}</code>}
          {screen.component && <span style={{ marginLeft: 8, fontSize: 11, color: '#94A3B8' }}>({screen.component})</span>}
        </div>
        <span style={{ color: '#94A3B8', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="doc-screen-body">
          {screen.description && <p className="doc-desc">{screen.description}</p>}

          {screen.features?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <strong style={{ fontSize: 12, color: '#475569' }}>Features:</strong>
              {screen.features.map((f, i) => (
                <FeatureCard key={i} feature={f} screenPath={screen.path || screen.name} featureIdx={i} panelId={panelId} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
