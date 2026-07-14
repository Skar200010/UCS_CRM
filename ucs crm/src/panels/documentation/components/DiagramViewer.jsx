import { useEffect, useRef, useState } from 'react'

const DIAGRAM_COLORS = {
  flowchart: '#2563EB',
  architecture: '#7C3AED',
  sequence: '#059669',
  er: '#D97706',
  network: '#DC2626',
  state: '#0891B2',
  process: '#4F46E5',
  journey: '#0F766E',
  mindmap: '#64748B',
}

const DIAGRAM_LABELS = {
  flowchart: 'Flowchart',
  architecture: 'Architecture Diagram',
  sequence: 'Sequence Diagram',
  er: 'ER Diagram',
  network: 'Network/Deployment Diagram',
  state: 'State Diagram',
  process: 'Process Map',
  journey: 'User Journey Map',
  mindmap: 'Mind Map',
}

export default function DiagramViewer({ diagrams }) {
  const [activeTab, setActiveTab] = useState(null)
  const [rendered, setRendered] = useState({})
  const containerRefs = useRef({})

  const diagramKeys = diagrams ? Object.keys(diagrams).filter(k => diagrams[k]) : []

  useEffect(() => {
    if (!activeTab) return
    let cancelled = false
    const renderDiagram = async () => {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          theme: 'neutral',
          themeVariables: {
            primaryColor: '#1E3A5F',
            primaryTextColor: '#FFF',
            primaryBorderColor: '#1E3A5F',
            lineColor: '#64748B',
            secondaryColor: '#F1F5F9',
            tertiaryColor: '#F8FAFC',
          },
          fontFamily: 'Inter, Calibri, sans-serif',
        })
        if (cancelled) return
        const id = `mermaid-${activeTab.replace(/\s+/g, '-')}`
        const container = containerRefs.current[activeTab]
        if (!container) return
        container.innerHTML = ''
        const { svg } = await mermaid.render(id, diagrams[activeTab])
        if (!cancelled && container) {
          container.innerHTML = svg
          setRendered(prev => ({ ...prev, [activeTab]: true }))
        }
      } catch (e) {
        if (!cancelled) {
          const container = containerRefs.current[activeTab]
          if (container) {
            container.innerHTML = `<pre style="color:#DC2626;font-size:11px;padding:8px;background:#FEF2F2;border-radius:4px;">Diagram render error: ${e.message}</pre>`
          }
        }
      }
    }
    renderDiagram()
    return () => { cancelled = true }
  }, [activeTab, diagrams])

  if (!diagramKeys.length) return null

  return (
    <div className="doc-diagrams" style={{ marginTop: 12 }}>
      <div style={{
        display: 'flex', gap: 4, flexWrap: 'wrap',
        borderBottom: '1px solid #E2E8F0', paddingBottom: 0,
      }}>
        {diagramKeys.map(key => (
          <div
            key={key}
            onClick={() => setActiveTab(activeTab === key ? null : key)}
            style={{
              padding: '6px 12px', fontSize: 11, fontWeight: 500,
              cursor: 'pointer', whiteSpace: 'nowrap',
              color: activeTab === key ? DIAGRAM_COLORS[key] || '#2563EB' : '#64748B',
              borderBottom: `2px solid ${activeTab === key ? DIAGRAM_COLORS[key] || '#2563EB' : 'transparent'}`,
              transition: 'all 0.15s',
            }}
          >
            {DIAGRAM_LABELS[key] || key}
          </div>
        ))}
      </div>

      {diagramKeys.map(key => (
        <div
          key={key}
          style={{
            display: activeTab === key ? 'block' : 'none',
            padding: '12px 0',
          }}
        >
          <div
            ref={el => containerRefs.current[key] = el}
            className="doc-mermaid-container"
            style={{
              background: '#FFF',
              border: '1px solid #E2E8F0',
              borderRadius: 8,
              padding: 16,
              overflow: 'auto',
            }}
          >
            {!rendered[key] && (
              <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: 20 }}>
                Loading diagram...
              </div>
            )}
          </div>
          <details style={{ marginTop: 8 }}>
            <summary style={{ fontSize: 11, color: '#94A3B8', cursor: 'pointer' }}>
              View Mermaid Source
            </summary>
            <pre className="doc-code-block" style={{ marginTop: 4 }}><code>{diagrams[key]}</code></pre>
          </details>
        </div>
      ))}
    </div>
  )
}
