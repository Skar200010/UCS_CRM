import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBnfBase } from '../bnfUi'
import { apiGet, apiPost } from '../store'

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  filterBar: { display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' },
  input: { padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', fontSize: '13px', outline: 'none', minWidth: '160px' },
  btn: { padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500 },
  card: { background: 'var(--card-bg)', boxShadow: 'var(--shadow)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid var(--line)', fontWeight: 600, color: 'var(--ink-soft)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', background: 'var(--bg)' },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--bg)', color: 'var(--ink)' },
  pill: (bg, fg) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: bg, color: fg }),
  link: { color: 'var(--sage)', textDecoration: 'none', cursor: 'pointer', fontWeight: 500 },
}

const STATUS_COLORS = {
  PENDING: ['#fef3c7', '#92400e'],
  ISSUED: ['#dbeafe', '#1e40af'],
  DELIVERED: ['#dcfce7', '#166534'],
  CANCELLED: ['#fee2e2', '#991b1b'],
}

export default function Distribution() {
  const navigate = useNavigate()
  const base = useBnfBase()
  const [data, setData] = useState({ data: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 25

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, pageSize })
      if (statusFilter) params.set('status', statusFilter)
      if (search) params.set('search', search)
      const result = await apiGet(`/distributions?${params}`)
      setData(result)
    } catch (e) {
      console.error('Failed to load distributions:', e)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, search])

  useEffect(() => { loadData() }, [loadData])

  const handleIssue = async (distributionId) => {
    try {
      await apiPost(`/distributions/${distributionId}/issue`, {})
      loadData()
    } catch (e) {
      alert('Failed to issue: ' + (e.message || 'Unknown error'))
    }
  }

  const totalPages = Math.ceil((data.total || 0) / pageSize)

  return (
    <div>
      <div style={styles.header}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Distribution</h2>
      </div>

      <div style={styles.filterBar}>
        <input
          type="text"
          placeholder="Search by number or beneficiary..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          style={{ ...styles.input, minWidth: '280px' }}
        />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} style={styles.input}>
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="ISSUED">Issued</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <span style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>{data.total || 0} records</span>
      </div>

      <div style={styles.card}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-soft)' }}>Loading...</div>
        ) : data.data?.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-soft)' }}>No distribution records found</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Distribution #</th>
                <th style={styles.th}>Beneficiary</th>
                <th style={styles.th}>Program</th>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Items</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.data?.map((d) => {
                const [bg, fg] = STATUS_COLORS[d.status] || ['var(--bg)', 'var(--ink-soft)']
                const items = d.items || d.distribution_items || []
                return (
                  <tr key={d.id}>
                    <td style={styles.td}><code style={{ fontSize: '12px', background: 'var(--bg)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>{d.distribution_number}</code></td>
                    <td style={styles.td}>
                      <span style={styles.link} onClick={() => navigate(base + `/${d.beneficiary_id}`)}>
                        {d.beneficiary?.full_name || d.beneficiary_name || '-'}
                      </span>
                    </td>
                    <td style={styles.td}>{d.bnf_programs?.title || d.program_title || '-'}</td>
                    <td style={styles.td}>{d.distribution_date || '-'}</td>
                    <td style={styles.td}>
                      {items.length > 0 ? (
                        <span style={{ fontSize: '12px' }}>{items.map(i => i.benefit?.name || i.benefit_name || i.name).filter(Boolean).join(', ')}</span>
                      ) : '-'}
                    </td>
                    <td style={styles.td}><span style={styles.pill(bg, fg)}>{d.status}</span></td>
                    <td style={styles.td}>
                      {d.status === 'PENDING' && (
                        <button onClick={() => handleIssue(d.id)} style={{ ...styles.btn, background: '#dcfce7', color: '#166534', padding: '4px 10px', fontSize: '12px' }}>
                          Issue
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '16px' }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ ...styles.btn, background: 'var(--bg)', opacity: page <= 1 ? 0.5 : 1 }}>Prev</button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const start = Math.max(1, Math.min(page - 2, totalPages - 4))
            const p = start + i
            if (p > totalPages) return null
            return (
              <button key={p} onClick={() => setPage(p)} style={{ ...styles.btn, background: p === page ? 'var(--sage)' : 'var(--bg)', color: p === page ? '#fff' : 'var(--ink)' }}>{p}</button>
            )
          })}
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ ...styles.btn, background: 'var(--bg)', opacity: page >= totalPages ? 0.5 : 1 }}>Next</button>
        </div>
      )}
    </div>
  )
}
