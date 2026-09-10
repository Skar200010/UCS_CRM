import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBnfBase } from '../bnfUi'
import { apiGet } from '../store'

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' },
  statCard: { background: 'var(--card-bg)', boxShadow: 'var(--shadow)', borderRadius: 'var(--radius)', padding: '20px', border: '1px solid var(--line)' },
  statLabel: { fontSize: '12px', color: 'var(--ink-soft)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  statValue: { fontSize: '28px', fontWeight: 700, color: 'var(--ink)' },
  card: { background: 'var(--card-bg)', boxShadow: 'var(--shadow)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', overflow: 'hidden' },
  cardPadding: { background: 'var(--card-bg)', boxShadow: 'var(--shadow)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', padding: '20px', marginBottom: '16px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid var(--line)', fontWeight: 600, color: 'var(--ink-soft)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', background: 'var(--bg)' },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--bg)', color: 'var(--ink)' },
  pill: (bg, fg) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: bg, color: fg }),
  btn: { padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500 },
  link: { color: 'var(--sage)', textDecoration: 'none', cursor: 'pointer', fontWeight: 500 },
  progressBar: { height: '8px', borderRadius: 'var(--radius-sm)', background: 'var(--line)', overflow: 'hidden', marginTop: '8px' },
  progressFill: (pct) => ({ height: '100%', borderRadius: 'var(--radius-sm)', background: pct >= 80 ? '#059669' : pct >= 50 ? '#d97706' : '#dc2626', width: `${pct}%`, transition: 'width 0.3s' }),
}

export default function Biometric() {
  const navigate = useNavigate()
  const base = useBnfBase()
  const [stats, setStats] = useState(null)
  const [pending, setPending] = useState({ data: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 25

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [statsResult, pendingResult] = await Promise.all([
        apiGet('/beneficiaries/overview'),
        apiGet(`/beneficiaries?fingerprint_status=PENDING&page=${page}&pageSize=${pageSize}`),
      ])
      setStats(statsResult)
      setPending(pendingResult)
    } catch (e) {
      console.error('Failed to load biometric data:', e)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { loadData() }, [loadData])

  if (loading && !stats) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-soft)' }}>Loading...</div>

  const totalBeneficiaries = stats?.total_beneficiaries || 0
  const enrolled = totalBeneficiaries - (stats?.pending_fingerprint || 0)
  const pendingCount = stats?.pending_fingerprint || 0
  const enrollPct = totalBeneficiaries > 0 ? Math.round((enrolled / totalBeneficiaries) * 100) : 0
  const totalPages = Math.ceil((pending.total || 0) / pageSize)

  return (
    <div>
      <div style={styles.header}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Biometric Enrollment</h2>
      </div>

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Total Beneficiaries</div>
          <div style={{ ...styles.statValue, color: 'var(--sage)' }}>{totalBeneficiaries}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Enrolled</div>
          <div style={{ ...styles.statValue, color: '#059669' }}>{enrolled}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Pending</div>
          <div style={{ ...styles.statValue, color: '#d97706' }}>{pendingCount}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Enrollment Rate</div>
          <div style={{ ...styles.statValue, color: enrollPct >= 80 ? '#059669' : '#d97706' }}>{enrollPct}%</div>
          <div style={styles.progressBar}>
            <div style={styles.progressFill(enrollPct)} />
          </div>
        </div>
      </div>

      <div style={styles.cardPadding}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>Pending Enrollment</h3>
        <p style={{ fontSize: '13px', color: 'var(--ink-soft)', margin: '0 0 16px 0' }}>Beneficiaries who have not yet completed biometric enrollment</p>

        {pending.data?.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-soft)' }}>All beneficiaries are enrolled!</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Code</th>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Mobile</th>
                <th style={styles.th}>City</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.data?.map((b) => (
                <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => navigate(base + `/${b.id}`)}>
                  <td style={styles.td}><code style={{ fontSize: '12px', background: 'var(--bg)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>{b.beneficiary_code}</code></td>
                  <td style={styles.td}><span style={styles.link}>{b.full_name}</span></td>
                  <td style={styles.td}>{b.mobile || '-'}</td>
                  <td style={styles.td}>{b.city || '-'}</td>
                  <td style={styles.td}><span style={styles.pill('#fef3c7', '#92400e')}>{b.fingerprint_status || 'PENDING'}</span></td>
                  <td style={styles.td}>
                    <span onClick={(e) => { e.stopPropagation(); navigate(base + `/${b.id}`) }} style={styles.link}>View</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

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
    </div>
  )
}
