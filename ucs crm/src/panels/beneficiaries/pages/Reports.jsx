import { useState, useEffect, useCallback } from 'react'
import { apiGet } from '../store'

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' },
  statCard: { background: 'var(--card-bg)', boxShadow: 'var(--shadow)', borderRadius: 'var(--radius)', padding: '20px', border: '1px solid var(--line)' },
  statLabel: { fontSize: '12px', color: 'var(--ink-soft)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  statValue: { fontSize: '28px', fontWeight: 700, color: 'var(--ink)' },
  statSub: { fontSize: '12px', color: 'var(--ink-soft)', marginTop: '4px' },
  card: { background: 'var(--card-bg)', boxShadow: 'var(--shadow)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', padding: '20px', marginBottom: '16px' },
  cardTitle: { fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '16px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid var(--line)', fontWeight: 600, color: 'var(--ink-soft)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', background: 'var(--bg)' },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--bg)', color: 'var(--ink)' },
  pill: (bg, fg) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: bg, color: fg }),
  btn: { padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500 },
}

export default function Reports() {
  const [loading, setLoading] = useState(true)
  const [beneficiaryStats, setBeneficiaryStats] = useState(null)
  const [programStats, setProgramStats] = useState(null)
  const [distributionStats, setDistributionStats] = useState(null)
  const [volunteerStats, setVolunteerStats] = useState(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [b, p, d, v] = await Promise.allSettled([
        apiGet('/reports/beneficiaries'),
        apiGet('/reports/programs'),
        apiGet('/reports/distributions'),
        apiGet('/reports/volunteers'),
      ])
      if (b.status === 'fulfilled') setBeneficiaryStats(b.value)
      if (p.status === 'fulfilled') setProgramStats(p.value)
      if (d.status === 'fulfilled') setDistributionStats(d.value)
      if (v.status === 'fulfilled') setVolunteerStats(v.value)
    } catch (e) {
      console.error('Failed to load reports:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-soft)' }}>Loading reports...</div>

  return (
    <div>
      <div style={styles.header}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Reports</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => alert('Export PDF coming soon')} style={{ ...styles.btn, background: 'var(--bg)', color: 'var(--ink)' }}>Export PDF</button>
          <button onClick={() => alert('Export Excel coming soon')} style={{ ...styles.btn, background: '#dcfce7', color: '#166534' }}>Export Excel</button>
        </div>
      </div>

      {/* Beneficiary Reports */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Total Beneficiaries</div>
          <div style={{ ...styles.statValue, color: 'var(--sage)' }}>{beneficiaryStats?.total || 0}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Active</div>
          <div style={{ ...styles.statValue, color: '#059669' }}>{beneficiaryStats?.active || 0}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Inactive</div>
          <div style={{ ...styles.statValue, color: '#dc2626' }}>{beneficiaryStats?.inactive || 0}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>New This Month</div>
          <div style={{ ...styles.statValue, color: '#7c3aed' }}>{beneficiaryStats?.new_this_month || 0}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Beneficiary Breakdown */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Beneficiary Status Breakdown</div>
          {beneficiaryStats?.by_status ? (
            <table style={styles.table}>
              <thead><tr><th style={styles.th}>Status</th><th style={styles.th}>Count</th><th style={styles.th}>%</th></tr></thead>
              <tbody>
                {Object.entries(beneficiaryStats.by_status).map(([status, count]) => {
                  const pct = beneficiaryStats.total > 0 ? Math.round((count / beneficiaryStats.total) * 100) : 0
                  const colors = {
                    ACTIVE: ['#dcfce7', '#166534'], INACTIVE: ['var(--bg)', 'var(--ink-soft)'],
                    SUSPENDED: ['#fef3c7', '#92400e'], DECEASED: ['#fee2e2', '#991b1b'],
                    TRANSFERRED: ['#dbeafe', '#1e40af'], DUPLICATE: ['#f3e8ff', '#6b21a8'],
                  }
                  const [bg, fg] = colors[status] || ['var(--bg)', 'var(--ink-soft)']
                  return (
                    <tr key={status}>
                      <td style={styles.td}><span style={styles.pill(bg, fg)}>{status}</span></td>
                      <td style={styles.td}>{count}</td>
                      <td style={styles.td}>{pct}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : <div style={{ color: 'var(--ink-soft)', fontSize: '13px' }}>No data available</div>}
        </div>

        {/* Program Reports */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Program Summary</div>
          {programStats ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--ink-soft)' }}>Total Programs</span>
                <span style={{ fontWeight: 600 }}>{programStats.total || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--ink-soft)' }}>Ongoing</span>
                <span style={styles.pill('#fef3c7', '#92400e')}>{programStats.ongoing || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--ink-soft)' }}>Completed</span>
                <span style={styles.pill('#dcfce7', '#166534')}>{programStats.completed || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--ink-soft)' }}>Planned</span>
                <span style={styles.pill('#dbeafe', '#1e40af')}>{programStats.planned || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--ink-soft)' }}>Cancelled</span>
                <span style={styles.pill('#fee2e2', '#991b1b')}>{programStats.cancelled || 0}</span>
              </div>
              {programStats.by_status && (
                <div style={{ marginTop: '8px', borderTop: '1px solid var(--bg)', paddingTop: '8px' }}>
                  {Object.entries(programStats.by_status).map(([status, count]) => (
                    <div key={status} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--ink-soft)' }}>{status}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : <div style={{ color: 'var(--ink-soft)', fontSize: '13px' }}>No data available</div>}
        </div>

        {/* Distribution Reports */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Distribution Summary</div>
          {distributionStats ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--ink-soft)' }}>Total Distributions</span>
                <span style={{ fontWeight: 600 }}>{distributionStats.total || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--ink-soft)' }}>Delivered</span>
                <span style={styles.pill('#dcfce7', '#166534')}>{distributionStats.delivered || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--ink-soft)' }}>Pending</span>
                <span style={styles.pill('#fef3c7', '#92400e')}>{distributionStats.pending || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--ink-soft)' }}>Cancelled</span>
                <span style={styles.pill('#fee2e2', '#991b1b')}>{distributionStats.cancelled || 0}</span>
              </div>
              {distributionStats.by_benefit && (
                <div style={{ marginTop: '8px', borderTop: '1px solid var(--bg)', paddingTop: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>By Benefit Type</div>
                  {distributionStats.by_benefit.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--ink-soft)' }}>{item.name || item.benefit}</span>
                      <span>{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : <div style={{ color: 'var(--ink-soft)', fontSize: '13px' }}>No data available</div>}
        </div>

        {/* Volunteer Reports */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Volunteer Summary</div>
          {volunteerStats ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--ink-soft)' }}>Total Volunteers</span>
                <span style={{ fontWeight: 600 }}>{volunteerStats.total || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--ink-soft)' }}>Active</span>
                <span style={styles.pill('#dcfce7', '#166534')}>{volunteerStats.active || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--ink-soft)' }}>Inactive</span>
                <span style={styles.pill('var(--bg)', 'var(--ink-soft)')}>{volunteerStats.inactive || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--ink-soft)' }}>On Leave</span>
                <span style={styles.pill('#fef3c7', '#92400e')}>{volunteerStats.on_leave || 0}</span>
              </div>
              {volunteerStats.by_skill && (
                <div style={{ marginTop: '8px', borderTop: '1px solid var(--bg)', paddingTop: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>By Skill</div>
                  {volunteerStats.by_skill.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--ink-soft)' }}>{item.skill || item.name}</span>
                      <span>{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : <div style={{ color: 'var(--ink-soft)', fontSize: '13px' }}>No data available</div>}
        </div>
      </div>
    </div>
  )
}
