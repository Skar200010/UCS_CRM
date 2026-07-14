import { useDoc } from '../store'
import ApiCallBlock from './ApiCallBlock'
import DatabaseTableCard from './DatabaseTableCard'

export default function FeatureCard({ feature, screenPath, featureIdx, panelId }) {
  const { expandedFeatures, toggleFeature } = useDoc()
  const key = `${screenPath}-${featureIdx}`
  const isOpen = expandedFeatures[key]

  if (!feature) return null

  const hasApis = feature.apis?.length > 0
  const hasDbTable = feature.dbTable
  const hasRules = feature.businessRules?.length > 0
  const hasWorkflow = feature.workflow?.length > 0

  return (
    <div className="doc-feature">
      <div className="doc-feature-header" onClick={() => toggleFeature(screenPath, featureIdx)} style={{ cursor: 'pointer' }}>
        <strong style={{ fontSize: 13, color: '#1E3A5F' }}>{feature.name}</strong>
        <span className="doc-badge-count">
          {hasApis && <span className="doc-badge api-badge">{feature.apis.length} API</span>}
          {hasDbTable && <span className="doc-badge db-badge">DB</span>}
          {hasRules && <span className="doc-badge rule-badge">Rules</span>}
          {hasWorkflow && <span className="doc-badge wf-badge">Flow</span>}
        </span>
        <span style={{ marginLeft: 'auto', color: '#94A3B8', fontSize: 11 }}>{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <div className="doc-feature-body">
          {feature.description && <p className="doc-desc">{feature.description}</p>}

          {/* API Calls */}
          {hasApis && (
            <div className="doc-feature-section">
              <strong style={{ color: '#2563EB' }}>API Calls:</strong>
              {feature.apis.map((api, i) => (
                <ApiCallBlock key={i} api={api} />
              ))}
            </div>
          )}

          {/* Business Rules */}
          {hasRules && (
            <div className="doc-feature-section">
              <strong style={{ color: '#D97706' }}>Business Rules:</strong>
              <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                {feature.businessRules.map((rule, i) => (
                  <li key={i} style={{ fontSize: 12, marginBottom: 2, color: '#475569' }}>{rule}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Workflow */}
          {hasWorkflow && (
            <div className="doc-feature-section">
              <strong style={{ color: '#059669' }}>Workflow:</strong>
              <div className="doc-workflow">
                {feature.workflow.map((step, i) => (
                  <div key={i} className="doc-workflow-step">
                    <div className="doc-wf-actor">{step.actor}</div>
                    <div className="doc-wf-arrow">↓</div>
                    <div className="doc-wf-action">{step.action}</div>
                    {step.api && <code className="doc-wf-api">{step.api}</code>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Request Body */}
          {feature.requestBody && (
            <div className="doc-feature-section">
              <strong style={{ color: '#8B5CF6' }}>Request Body:</strong>
              <pre className="doc-code-block"><code>{JSON.stringify(feature.requestBody, null, 2)}</code></pre>
            </div>
          )}

          {/* Database Table */}
          {hasDbTable && <DatabaseTableCard table={feature.dbTable} />}
        </div>
      )}
    </div>
  )
}
