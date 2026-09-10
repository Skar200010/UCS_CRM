import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBnfBase } from '../bnfUi'
import { apiGet } from '../store'

const styles = {
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' },
  statCard: { background: 'var(--card-bg)', boxShadow: 'var(--shadow)', borderRadius: 'var(--radius)', padding: '20px', border: '1px solid var(--line)' },
  statLabel: { fontSize: '12px', color: 'var(--ink-soft)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  statValue: { fontSize: '28px', fontWeight: 700, color: 'var(--ink)' },
  card: { background: 'var(--card-bg)', boxShadow: 'var(--shadow)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', padding: '20px', marginBottom: '16px' },
  cardTitle: { fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '16px' },
  btn: { padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500 },
  btnPrimary: { background: 'var(--sage)', color: '#fff' },
  pill: (color) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: color + '20', color }),
}

export default function Overview() {
  const navigate = useNavigate()
  const base = useBnfBase()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const data = await apiGet('/beneficiaries/overview')
      setStats(data)
    } catch (e) {
      console.error('Failed to load overview:', e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-soft)' }}>Loading...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Beneficiaries Overview</h2>
        <button
          onClick={() => navigate(base + '/new')}
          style={{ ...styles.btn, ...styles.btnPrimary }}
        >
          + New Registration
        </button>
      </div>

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Total Beneficiaries</div>
          <div style={{ ...styles.statValue, color: 'var(--sage)' }}>{stats?.total_beneficiaries || 0}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Active</div>
          <div style={{ ...styles.statValue, color: '#059669' }}>{stats?.active || 0}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Inactive</div>
          <div style={{ ...styles.statValue, color: '#dc2626' }}>{stats?.inactive || 0}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>New This Month</div>
          <div style={{ ...styles.statValue, color: '#7c3aed' }}>{stats?.new_this_month || 0}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Pending Fingerprint</div>
          <div style={{ ...styles.statValue, color: '#d97706' }}>{stats?.pending_fingerprint || 0}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Programs</div>
          <div style={{ ...styles.statValue, color: '#0891b2' }}>{stats?.programs || 0}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Benefits Distributed</div>
          <div style={{ ...styles.statValue, color: '#be185d' }}>{stats?.benefits_distributed || 0}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>Quick Actions</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => navigate(base + '/new')} style={{ ...styles.btn, ...styles.btnPrimary }}>New Registration</button>
            <button onClick={() => navigate(base + '/all')} style={{ ...styles.btn, background: 'var(--bg)', color: 'var(--ink)' }}>View All</button>
            <button onClick={() => navigate(base + '/imports')} style={{ ...styles.btn, background: 'var(--bg)', color: 'var(--ink)' }}>Import Data</button>
            <button onClick={() => navigate(base + '/reports')} style={{ ...styles.btn, background: 'var(--bg)', color: 'var(--ink)' }}>Reports</button>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>System Status</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--ink-soft)' }}>Biometric Enrollment</span>
              <span style={styles.pill(stats?.pending_fingerprint > 0 ? '#d97706' : '#059669')}>
                {stats?.pending_fingerprint > 0 ? `${stats.pending_fingerprint} pending` : 'All enrolled'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--ink-soft)' }}>Active Beneficiaries</span>
              <span style={styles.pill('#059669')}>{stats?.active || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--ink-soft)' }}>Total Programs</span>
              <span style={styles.pill('var(--sage)')}>{stats?.programs || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
