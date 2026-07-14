import { useState } from 'react'
import FeatureCard from './FeatureCard'
import DiagramViewer from './DiagramViewer'

export default function ScreenDetail({ screen, panelId }) {
  const [expanded, setExpanded] = useState(false)
  if (!screen) return null

  const hasLogic = !!screen.logicDescription
  const hasDiagrams = screen.diagrams && Object.keys(screen.diagrams).some(k => screen.diagrams[k])

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

          {/* Screen-level logic description */}
          {hasLogic && (
            <div className="doc-feature-section">
              <strong style={{ color: '#7C3AED' }}>How It Works:</strong>
              <div className="doc-logic-content" style={{
                fontSize: 12, lineHeight: 1.8, color: '#334155',
                marginTop: 4, padding: '8px 12px', background: '#FAF5FF',
                borderLeft: '3px solid #7C3AED', borderRadius: '0 6px 6px 0',
              }}>
                {screen.logicDescription.split('\n').map((para, i) => (
                  <p key={i} style={{ margin: '4px 0' }}>{para}</p>
                ))}
              </div>
            </div>
          )}

          {/* Screen-level diagrams */}
          {hasDiagrams && <DiagramViewer diagrams={screen.diagrams} />}

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
