import { useDoc } from '../store'

const METHOD_COLORS = {
  GET: '#059669',
  POST: '#2563EB',
  PUT: '#D97706',
  PATCH: '#8B5CF6',
  DELETE: '#DC2626',
}

export default function ApiCallBlock({ api }) {
  const { expandedFeatures, toggleFeature } = useDoc()
  if (!api) return null

  const { method = 'GET', path = '', auth, curl, requestBody, responseBody, description } = api
  const key = `api-${method}-${path}`
  const isOpen = expandedFeatures[`${key}-0`]

  return (
    <div className="doc-api-block">
      <div className="doc-api-header" onClick={() => toggleFeature(key, 0)} style={{ cursor: 'pointer' }}>
        <span className="doc-api-method" style={{ backgroundColor: METHOD_COLORS[method] || '#64748B' }}>
          {method}
        </span>
        <code className="doc-api-path">{path}</code>
        <span className="doc-api-toggle" style={{ marginLeft: 'auto', color: '#94A3B8' }}>{isOpen ? '▼' : '▶'}</span>
      </div>

      {isOpen && (
        <div className="doc-api-detail">
          {description && <p className="doc-desc">{description}</p>}
          {auth && (
            <div className="doc-api-section">
              <strong>Auth:</strong> {auth}
            </div>
          )}

          {curl && (
            <div className="doc-api-section">
              <strong>cURL:</strong>
              <pre className="doc-code-block"><code>{curl}</code></pre>
            </div>
          )}

          {requestBody && (
            <div className="doc-api-section">
              <strong>Request JSON:</strong>
              <pre className="doc-code-block"><code>{JSON.stringify(requestBody, null, 2)}</code></pre>
            </div>
          )}

          {responseBody && (
            <div className="doc-api-section">
              <strong>Response JSON:</strong>
              <pre className="doc-code-block"><code>{JSON.stringify(responseBody, null, 2)}</code></pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
