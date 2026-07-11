import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { masterSearch } from '../api/auth'
import { SkeletonTable } from '../../../components/Skeleton'
import DonorDetailModal from '../../../components/DonorDetailModal'

const initials = (name) => (name || '').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

export default function SearchResults() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const q = searchParams.get('q') || ''
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showDonorDetail, setShowDonorDetail] = useState(null)

  useEffect(() => {
    if (!q || q.trim().length < 2) { setLoading(false); return }
    setLoading(true)
    masterSearch(q.trim()).then(setResults).catch(() => setResults({ donors: [], fros: [], stations: [] })).finally(() => setLoading(false))
  }, [q])

  const total = results ? (results.donors?.length || 0) + (results.fros?.length || 0) + (results.stations?.length || 0) : 0

  if (loading) return <SkeletonTable />

  return (
    <>
    <div className="bento-grid" style={{ flex: 1 }}>
      <div className="bento-col-12">
        <div className="bento-card">
          <div className="bento-card-h">
            <h3>Search Results{q ? `: "${q}"` : ''}</h3>
            {results && <span style={{ fontSize: 10, color: 'var(--ink-soft)', fontWeight: 400 }}>{total} found</span>}
          </div>

          {!q || q.trim().length < 2 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--ink-soft)', fontSize: 13 }}>
              Enter at least 2 characters to search
            </div>
          ) : total === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--ink-soft)', fontSize: 13 }}>
              No results found for "{q}"
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Donors */}
              {results.donors?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6, padding: '0 4px' }}>
                    Donors ({results.donors.length})
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--line)' }}>
                        <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Name</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Mobile</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>City</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Project</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Amount</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>FRO / Station</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.donors.map(d => {
                        const asgn = d.assignments?.[0]
                        return (
                          <tr key={d.id} onClick={() => setShowDonorDetail(d.id)}
                            style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer', transition: 'background .1s' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                            onMouseLeave={e => e.currentTarget.style.background = ''}>
                            <td style={{ padding: '6px 8px', fontWeight: 600 }}>{d.name || 'Unknown'}</td>
                            <td style={{ padding: '6px 8px' }}>{d.mobile_number || '—'}</td>
                            <td style={{ padding: '6px 8px' }}>{d.city || '—'}</td>
                            <td style={{ padding: '6px 8px' }}>{d.project_supported || '—'}</td>
                            <td style={{ padding: '6px 8px', fontWeight: 600 }}>₹{Number(d.amount || 0).toLocaleString('en-IN')}</td>
                            <td style={{ padding: '6px 8px', fontSize: 10 }}>
                              {asgn ? `${asgn.workers?.name || 'Unassigned'}${asgn.station ? ` @ ${asgn.station}` : ''}` : 'No assignment'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* FROs */}
              {results.fros?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6, padding: '0 4px' }}>
                    FRO Workers ({results.fros.length})
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--line)' }}>
                        <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Name</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Login ID</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                        {results.fros.map(f => (
                          <tr key={f.id} onClick={() => navigate(`/ngo-admin/fro-status?fro_id=${f.id}`)}
                          style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer', transition: 'background .1s' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}>
                          <td style={{ padding: '6px 8px', fontWeight: 600 }}>{f.name || 'Unknown'}</td>
                          <td style={{ padding: '6px 8px' }}>{f.login_id || '—'}</td>
                          <td style={{ padding: '6px 8px' }}>
                            <span className={`pill ${f.is_active !== false ? 'pill-green' : 'pill-red'}`}>
                              {f.is_active !== false ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Stations */}
              {results.stations?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6, padding: '0 4px' }}>
                    Stations ({results.stations.length})
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--line)' }}>
                        <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Station</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>FRO</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Donors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.stations.map((s, i) => (
                        <tr key={`${s.station}-${i}`} onClick={() => navigate('/ngo-admin/station-mgmt')}
                          style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer', transition: 'background .1s' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}>
                          <td style={{ padding: '6px 8px', fontWeight: 600 }}>{s.station || 'Unknown'}</td>
                          <td style={{ padding: '6px 8px' }}>{s.workers?.name || 'No FRO assigned'}</td>
                          <td style={{ padding: '6px 8px' }}>{s.donor_count || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

      {showDonorDetail && (
        <DonorDetailModal donorId={showDonorDetail} onClose={() => setShowDonorDetail(null)} />
      )}
    </>
  )
}