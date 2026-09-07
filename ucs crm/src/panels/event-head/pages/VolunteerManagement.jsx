import { useState, useEffect, useMemo } from 'react'
import { fetchVolunteerPeople } from '../store'

const PALETTE = ['#5B6B4E', '#C08A2E', '#7A5C7E', '#B5603A', '#4F6472', '#88693D', '#2E7D32', '#1565C0', '#00838F', '#6A1B9A']
const ngoColor = (name) => {
  let h = 0
  for (const ch of String(name || 'Other')) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

const initials = (n) => String(n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'
const keyOf = (p) => p.ngo_name || 'Other'

const NGO_ORDER = ['BSCT', 'AFLF', 'MANN', 'MAN', 'Others', 'Other']

export default function VolunteerManagement() {
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [ngoFilter, setNgoFilter] = useState('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchVolunteerPeople()
      .then(list => { if (!cancelled) setPeople(list || []) })
      .catch(err => { console.error('VolunteerManagement fetchVolunteerPeople:', err); if (!cancelled) setPeople([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const ngoStats = useMemo(() => {
    const counts = {}
    const order = {}
    for (const p of people) {
      const k = keyOf(p)
      counts[k] = (counts[k] || 0) + 1
      order[k] = order[k] ?? k
    }
    return Object.keys(counts)
      .map(k => ({ name: k, count: counts[k] }))
      .sort((a, b) => {
        const ia = NGO_ORDER.findIndex(x => String(a.name).toUpperCase() === x)
        const ib = NGO_ORDER.findIndex(x => String(b.name).toUpperCase() === x)
        if (ia === -1 && ib === -1) return a.name.localeCompare(b.name)
        if (ia === -1) return 1
        if (ib === -1) return -1
        return ia - ib
      })
  }, [people])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return people.filter(p => {
      if (ngoFilter !== 'All' && keyOf(p) !== ngoFilter) return false
      if (q && !(p.name || '').toLowerCase().includes(q)) return false
      return true
    })
  }, [people, ngoFilter, search])

  const grouped = useMemo(() => {
    const m = {}
    for (const p of filtered) {
      const k = keyOf(p)
      ;(m[k] = m[k] || []).push(p)
    }
    return Object.entries(m)
      .map(([name, rows]) => ({ name, rows }))
      .sort((a, b) => {
        const ia = NGO_ORDER.findIndex(x => a.name.toUpperCase() === x)
        const ib = NGO_ORDER.findIndex(x => b.name.toUpperCase() === x)
        if (ia === -1 && ib === -1) return a.name.localeCompare(b.name)
        if (ia === -1) return 1
        if (ib === -1) return -1
        return ia - ib
      })
  }, [filtered])

  const total = people.length

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 19, fontWeight: 800, color: 'var(--ink)', margin: 0 }}>Voluntary</h2>
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 3 }}>
            {total ? `${total} volunteer${total === 1 ? '' : 's'} across ${ngoStats.length} NGO${ngoStats.length === 1 ? '' : 's'}` : 'NGO-wise volunteer roster'}
          </div>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-num" style={{ color: '#7B5EA7' }}>{total}</div>
          <div className="stat-lbl">Total Volunteers</div>
        </div>
        {ngoStats.map(n => (
          <div className="stat-card" key={n.name}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: ngoColor(n.name), display: 'inline-block', flexShrink: 0 }} />
              <span className="stat-lbl" style={{ fontSize: 12 }}>{n.name}</span>
            </div>
            <div className="stat-num" style={{ color: ngoColor(n.name), fontSize: 24 }}>{n.count}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <select
          value={ngoFilter}
          onChange={e => setNgoFilter(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontSize: 13, outline: 'none', background: 'var(--card-bg)' }}
        >
          <option value="All">All NGOs</option>
          {ngoStats.map(n => <option key={n.name} value={n.name}>{n.name} ({n.count})</option>)}
        </select>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search volunteer..."
          style={{ flex: 1, minWidth: 200, padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontSize: 13, outline: 'none' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        <button
          className={`btn btn-sm ${ngoFilter === 'All' ? 'btn-primary' : ''}`}
          onClick={() => setNgoFilter('All')}
          style={ngoFilter !== 'All' ? { background: 'transparent', border: '1px solid var(--line)' } : {}}
        >
          All
        </button>
        {ngoStats.map(n => (
          <button
            key={n.name}
            className={`btn btn-sm ${ngoFilter === n.name ? 'btn-primary' : ''}`}
            onClick={() => setNgoFilter(ngoFilter === n.name ? 'All' : n.name)}
            style={ngoFilter !== n.name ? { background: 'transparent', border: '1px solid var(--line)' } : {}}
          >
            <span style={{ marginRight: 6 }}>{n.name}</span>
            <span style={{ opacity: 0.75 }}>({n.count})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>
          Loading volunteers...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>
          {total === 0 ? 'No volunteers found in the database.' : 'No volunteers match the current filter.'}
        </div>
      ) : (
        grouped.map(g => {
          const color = ngoColor(g.name)
          return (
            <div className="card" key={g.name} style={{ marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.03em', textTransform: 'uppercase', color: 'var(--ink)' }}>{g.name}</span>
                <span className="pill pill-gray" style={{ fontSize: 11 }}>{g.rows.length} volunteer{g.rows.length === 1 ? '' : 's'}</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    {g.rows.map((p, i) => (
                      <tr key={p.id ?? i}>
                        <td style={{ padding: '10px 18px', borderBottom: '1px solid var(--line)', color: 'var(--ink)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ width: 28, height: 28, borderRadius: '50%', background: `${color}1a`, color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{initials(p.name)}</span>
                            <span style={{ fontWeight: 600 }}>{p.name}</span>
                          </span>
                        </td>
                        <td align="right" style={{ padding: '10px 18px', borderBottom: '1px solid var(--line)' }}>
                          <span className={`pill ${ngoFilter === p.ngo_name ? 'pill-green' : 'pill-gray'}`} style={{ fontSize: 11 }}>{p.ngo_name || 'Other'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}