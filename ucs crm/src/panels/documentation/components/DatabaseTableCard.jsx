import { useState } from 'react'

export default function DatabaseTableCard({ table }) {
  const [expanded, setExpanded] = useState(false)
  if (!table) return null

  return (
    <div className="doc-db-table">
      <div className="doc-db-header" onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
        <strong style={{ color: '#1E293B', fontSize: 13 }}>
          📋 {table.name}
        </strong>
        {table.columns && <span style={{ color: '#94A3B8', fontSize: 11, marginLeft: 8 }}>({table.columns.length} columns)</span>}
        <span style={{ marginLeft: 'auto', color: '#94A3B8', fontSize: 11 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && table.columns && (
        <div className="doc-db-schema">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ padding: '4px 6px', border: '1px solid #CBD5E1', backgroundColor: '#1E3A5F', color: '#FFF', textAlign: 'left' }}>Column</th>
                <th style={{ padding: '4px 6px', border: '1px solid #CBD5E1', backgroundColor: '#1E3A5F', color: '#FFF', textAlign: 'left' }}>Type</th>
                <th style={{ padding: '4px 6px', border: '1px solid #CBD5E1', backgroundColor: '#1E3A5F', color: '#FFF', textAlign: 'left' }}>Description</th>
              </tr>
            </thead>
            <tbody>
              {table.columns.map((col, i) => (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#F8FAFC' : '#FFF' }}>
                  <td style={{ padding: '3px 6px', border: '1px solid #E2E8F0', fontFamily: 'Consolas, monospace', fontSize: 10, color: '#2563EB' }}>{col.name}</td>
                  <td style={{ padding: '3px 6px', border: '1px solid #E2E8F0', fontSize: 10, color: '#059669' }}>{col.type}</td>
                  <td style={{ padding: '3px 6px', border: '1px solid #E2E8F0', fontSize: 10, color: '#475569' }}>{col.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
