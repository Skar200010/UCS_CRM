import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useBnfBase } from '../bnfUi'
import { apiGet, apiPost } from '../store'

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  card: { background: 'var(--card-bg)', boxShadow: 'var(--shadow)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', padding: '20px', marginBottom: '16px' },
  cardTitle: { fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '16px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' },
  statCard: { background: 'var(--card-bg)', boxShadow: 'var(--shadow)', borderRadius: 'var(--radius)', padding: '20px', border: '1px solid var(--line)' },
  statLabel: { fontSize: '12px', color: 'var(--ink-soft)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  statValue: { fontSize: '28px', fontWeight: 700, color: 'var(--ink)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid var(--line)', fontWeight: 600, color: 'var(--ink-soft)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', background: 'var(--bg)' },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--bg)', color: 'var(--ink)' },
  btn: { padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500 },
  pill: (bg, fg) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: bg, color: fg }),
  link: { color: 'var(--sage)', textDecoration: 'none', cursor: 'pointer', fontWeight: 500 },
  input: { padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', fontSize: '13px', outline: 'none', minWidth: '200px' },
}

const STATUS_COLORS = {
  PLANNED: ['#dbeafe', '#1e40af'],
  ONGOING: ['#fef3c7', '#92400e'],
  COMPLETED: ['#dcfce7', '#166534'],
}

export default function ProgramDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const base = useBnfBase()
  const [program, setProgram] = useState(null)
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])

  useEffect(() => { loadProgram() }, [id])

  const loadProgram = async () => {
    setLoading(true)
    try {
      const data = await apiGet(`/programs/${id}`)
      setProgram(data)
    } catch (e) {
      console.error('Failed to load program:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    try {
      const results = await apiGet(`/beneficiaries?search=${encodeURIComponent(searchQuery)}&pageSize=20`)
      setSearchResults(results.data || [])
    } catch (e) {
      console.error('Search failed:', e)
    }
  }

  const handleAssign = async (beneficiaryId) => {
    try {
      await apiPost(`/programs/${id}/assign`, { beneficiary_id: beneficiaryId })
      setSearchResults(s => s.filter(b => b.id !== beneficiaryId))
      loadProgram()
    } catch (e) {
      alert('Failed to assign: ' + (e.message || 'Unknown error'))
    }
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-soft)' }}>Loading...</div>
  if (!program) return <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626' }}>Program not found</div>

  const [bg, fg] = STATUS_COLORS[program.status] || ['var(--bg)', 'var(--ink-soft)']
  const assigned = program.assigned_beneficiaries || program.beneficiaries || []
  const checkedIn = assigned.filter(b => b.check_in_status === 'CHECKED_IN' || b.attendance === 'present')
  const served = assigned.filter(b => b.distribution_status === 'SERVED' || b.distributed)

  return (
    <div>
      <div style={styles.header}>
        <div>
          <button onClick={() => navigate(base + '/programs')} style={{ background: 'none', border: 'none', color: 'var(--sage)', cursor: 'pointer', fontSize: '13px', marginBottom: '4px' }}>← Back to programs</button>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>{program.title}</h2>
          <div style={{ fontSize: '13px', color: 'var(--ink-soft)', marginTop: '4px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <code style={{ background: 'var(--bg)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>{program.program_code}</code>
            <span style={styles.pill(bg, fg)}>{program.status}</span>
            <span>{program.program_date}</span>
            {program.location_name && <span>{program.location_name}</span>}
          </div>
        </div>
      </div>

      {program.description && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>Description</div>
          <p style={{ fontSize: '13px', color: 'var(--ink)', margin: 0, lineHeight: 1.6 }}>{program.description}</p>
        </div>
      )}

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Assigned</div>
          <div style={{ ...styles.statValue, color: 'var(--sage)' }}>{assigned.length}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Checked In</div>
          <div style={{ ...styles.statValue, color: '#059669' }}>{checkedIn.length}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Served</div>
          <div style={{ ...styles.statValue, color: '#7c3aed' }}>{served.length}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Pending</div>
          <div style={{ ...styles.statValue, color: '#d97706' }}>{assigned.length - checkedIn.length}</div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={styles.cardTitle}>Assigned Beneficiaries</div>
          <button onClick={() => setAssigning(!assigning)} style={{ ...styles.btn, background: assigning ? 'var(--bg)' : 'var(--sage)', color: assigning ? 'var(--ink)' : '#fff' }}>
            {assigning ? 'Close' : '+ Assign Beneficiary'}
          </button>
        </div>

        {assigning && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', padding: '12px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
            <input
              type="text"
              placeholder="Search by name, code, or mobile..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              style={styles.input}
            />
            <button onClick={handleSearch} style={{ ...styles.btn, background: 'var(--sage)', color: '#fff' }}>Search</button>
          </div>
        )}

        {assigning && searchResults.length > 0 && (
          <div style={{ marginBottom: '16px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            <table style={styles.table}>
              <thead><tr>
                <th style={styles.th}>Code</th><th style={styles.th}>Name</th><th style={styles.th}>Mobile</th><th style={styles.th}>Action</th>
              </tr></thead>
              <tbody>
                {searchResults.map(b => (
                  <tr key={b.id}>
                    <td style={styles.td}><code style={{ fontSize: '11px', background: 'var(--bg)', padding: '2px 4px', borderRadius: 'var(--radius-sm)' }}>{b.beneficiary_code}</code></td>
                    <td style={styles.td}>{b.full_name}</td>
                    <td style={styles.td}>{b.mobile || '-'}</td>
                    <td style={styles.td}>
                      <button onClick={() => handleAssign(b.id)} style={{ ...styles.btn, background: '#dcfce7', color: '#166534', padding: '4px 10px', fontSize: '12px' }}>Assign</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {assigned.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-soft)', fontSize: '13px' }}>No beneficiaries assigned yet</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Code</th>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Mobile</th>
                <th style={styles.th}>Check-in</th>
                <th style={styles.th}>Distribution</th>
              </tr>
            </thead>
            <tbody>
              {assigned.map((b) => (
                <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => navigate(base + `/${b.beneficiary_id || b.id}`)}>
                  <td style={styles.td}><code style={{ fontSize: '11px', background: 'var(--bg)', padding: '2px 4px', borderRadius: 'var(--radius-sm)' }}>{b.beneficiary_code || b.code}</code></td>
                  <td style={styles.td}><span style={styles.link}>{b.full_name || b.name}</span></td>
                  <td style={styles.td}>{b.mobile || '-'}</td>
                  <td style={styles.td}>
                    <span style={styles.pill(
                      (b.check_in_status === 'CHECKED_IN' || b.attendance === 'present') ? '#dcfce7' : '#fef3c7',
                      (b.check_in_status === 'CHECKED_IN' || b.attendance === 'present') ? '#166534' : '#92400e'
                    )}>
                      {(b.check_in_status === 'CHECKED_IN' || b.attendance === 'present') ? 'Checked In' : 'Pending'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.pill(
                      (b.distribution_status === 'SERVED' || b.distributed) ? '#dcfce7' : 'var(--bg)',
                      (b.distribution_status === 'SERVED' || b.distributed) ? '#166534' : 'var(--ink-soft)'
                    )}>
                      {(b.distribution_status === 'SERVED' || b.distributed) ? 'Served' : 'Not Served'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
