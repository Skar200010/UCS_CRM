import { useState, useMemo } from 'react'

export function StatCard({ icon: Icon, label, value, trend, color, subtitle }) {
  return (
    <div className="stat-card" style={{ borderLeft: `3px solid ${color || 'var(--sage)'}`, transition: 'box-shadow .2s, transform .2s', cursor: 'default' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="stat-lbl" style={{ fontSize: 12, fontWeight: 500 }}>{label}</div>
          <div className="stat-num" style={{ fontSize: 28, fontWeight: 700, color, marginTop: 4 }}>{value ?? '—'}</div>
          {subtitle && <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>{subtitle}</div>}
        </div>
        {Icon && (
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color || 'var(--sage)'}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={20} color={color || 'var(--sage)'} />
          </div>
        )}
      </div>
      {trend !== undefined && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: trend >= 0 ? '#22c55e' : '#ef4444' }}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
          <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>vs last month</span>
        </div>
      )}
    </div>
  )
}

export function EnhancedTable({
  columns, data, searchPlaceholder = 'Search...',
  pageSize = 10, onRowClick,
}) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('')
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    if (!search) return data
    const q = search.toLowerCase()
    return data.filter(row =>
      columns.some(col => {
        const v = col.accessor ? row[col.accessor] : ''
        return v != null && String(v).toLowerCase().includes(q)
      })
    )
  }, [data, search, columns])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const aV = a[sortKey] ?? ''
      const bV = b[sortKey] ?? ''
      const cmp = typeof aV === 'number' ? aV - bV : String(aV).localeCompare(String(bV))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.ceil(sorted.length / pageSize)
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize)

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
    setPage(0)
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder={searchPlaceholder}
            style={{ width: '100%', padding: '9px 12px 9px 36px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontSize: 13, outline: 'none', background: 'var(--card-bg)' }} />
        </div>
        <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{sorted.length} records</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.accessor || col.header} onClick={() => col.accessor && handleSort(col.accessor)}
                  style={{ textAlign: 'left', padding: '10px 14px', borderBottom: '1px solid var(--line)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ink-soft)', fontWeight: 600, whiteSpace: 'nowrap', cursor: col.accessor ? 'pointer' : 'default', userSelect: 'none' }}>
                  {col.header}
                  {col.accessor && sortKey === col.accessor && (
                    <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 && (
              <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: 40, color: 'var(--ink-soft)' }}>No data found</td></tr>
            )}
            {paged.map((row, i) => (
              <tr key={row.id ?? i} onClick={() => onRowClick?.(row)}
                style={{ cursor: onRowClick ? 'pointer' : 'default', transition: 'background .1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {columns.map(col => (
                  <td key={col.accessor || col.header} style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', color: 'var(--ink)' }}>
                    {col.render ? col.render(row) : row[col.accessor] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
          <span style={{ color: 'var(--ink-soft)' }}>Page {page + 1} of {totalPages}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>← Prev</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const start = Math.max(0, Math.min(page - 2, totalPages - 5))
              const pg = start + i
              return (
                <button key={pg} className={`btn btn-sm ${pg === page ? 'btn-primary' : ''}`} onClick={() => setPage(pg)}
                  style={pg === page ? {} : { background: 'transparent', border: '1px solid var(--line)' }}>
                  {pg + 1}
                </button>
              )
            })}
            <button className="btn btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}>Next →</button>
          </div>
        </div>
      )}
    </div>
  )
}
