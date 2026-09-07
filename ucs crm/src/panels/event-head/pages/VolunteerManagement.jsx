import { useState, useEffect, useMemo } from 'react'
import { fetchVolunteerPeople } from '../store'
import hrFileUrl from './HR EMPLOYEES FILES (1).xlsx?url'

const PALETTE = ['#5B6B4E', '#C08A2E', '#7A5C7E', '#B5603A', '#4F6472', '#88693D', '#2E7D32', '#1565C0', '#00838F', '#6A1B9A']
const ngoColor = (name) => {
  let h = 0
  for (const ch of String(name || 'Other')) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

const initials = (n) => String(n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'
const orderIndex = (label) => {
  const u = String(label || '').toUpperCase()
  const map = { BSCT: 0, AFLF: 1, MANN: 2, MAN: 2, OTHERS: 3, OTHER: 3 }
  return map[u] !== undefined ? map[u] : 100
}
const sortGroups = (a, b) => orderIndex(a) - orderIndex(b) || String(a).localeCompare(String(b))

const shortLabel = (p) => {
  const code = String(p.ngo_code || '').toUpperCase().trim()
  const map = { BSCT: 'BSCT', AFLF: 'AFLF', MANN: 'Mann', MAN: 'Mann', OTHER: 'Others', OTHERS: 'Others' }
  return map[code] || p.ngo_name || 'Other'
}

const parseManagementTeam = (rows) => {
  const active = {}
  const out = []
  for (const row of rows) {
    for (let c = 0; c < row.length; c++) {
      const txt = String(row[c] || '').trim()
      const mg = txt.match(/^(.*?)\s*Management\s+Team\s*$/i)
      if (mg) {
        active[c] = { ngo: (mg[1] || '').trim() || 'Other' }
        continue
      }
      if (txt && /Volunteer\s+Team\s*$/i.test(txt)) {
        delete active[c]
      }
    }
    for (const c of Object.keys(active)) {
      const ci = Number(c)
      const name = String(row[ci + 1] || '').trim().replace(/\s+/g, ' ')
      const ngoCell = String(row[ci + 2] || '').trim()
      if (!name || /Team\s*$/i.test(name) || /^Sr\.?\s*No\.?\s*$/i.test(name) || name.toUpperCase() === 'NAME') continue
      out.push({ name, ngo: ngoCell || active[c].ngo })
    }
  }
  const seen = new Set()
  return out.filter(m => {
    const k = m.name.toLowerCase() + '|' + m.ngo.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export default function VolunteerManagement() {
  const [people, setPeople] = useState([])
  const [management, setManagement] = useState([])
  const [loading, setLoading] = useState(true)
  const [fileError, setFileError] = useState('')
  const [ngoFilter, setNgoFilter] = useState('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadFile = async () => {
      try {
        const res = await fetch(hrFileUrl)
        const buf = await res.arrayBuffer()
        const XLSX = await import('xlsx')
        const wb = XLSX.read(buf, { type: 'array' })
        const sheetName = wb.SheetNames.find(n => /^sheet3$/i.test(n)) || wb.SheetNames[0]
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: false })
        const list = parseManagementTeam(rows)
        if (list.length === 0) setFileError('No Management Team found in the file.')
        return list
      } catch (e) {
        setFileError('Could not load the HR employees file.')
        return []
      }
    }

    Promise.all([
      fetchVolunteerPeople().catch(() => []),
      loadFile(),
    ]).then(([list, mgmt]) => {
      if (cancelled) return
      setPeople(list || [])
      setManagement(mgmt)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [])

  const volunteers = useMemo(() =>
    people.map(p => ({ ...p, cat: 'Volunteer', ngo: shortLabel(p) })),
  [people])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const mgmt = management.map(m => ({ ...m, cat: 'Management', ngo: m.ngo || 'Other' }))
    return [...volunteers, ...mgmt].filter(r => {
      if (ngoFilter !== 'All' && r.ngo !== ngoFilter) return false
      if (q && !(r.name || '').toLowerCase().includes(q)) return false
      return true
    })
  }, [volunteers, management, ngoFilter, search])

  const counts = useMemo(() => {
    const c = {}
    for (const r of [...volunteers, ...management.map(m => ({ ngo: m.ngo || 'Other' }))]) {
      const k = r.ngo || 'Other'
      c[k] = (c[k] || 0) + 1
    }
    return c
  }, [volunteers, management])

  const ngoLabels = useMemo(() =>
    Object.keys(counts).sort(sortGroups),
  [counts])

  const groupRows = (list) => {
    const m = {}
    for (const r of list) {
      const k = r.ngo || 'Other'
      ;(m[k] = m[k] || []).push(r)
    }
    return Object.entries(m).map(([name, items]) => ({ name, items })).sort((a, b) => sortGroups(a.name, b.name))
  }

  const teamSections = [
    { label: 'Volunteer Team', source: 'from database', rows: rows.filter(r => r.cat === 'Volunteer') },
    { label: 'Management Team', source: 'from HR employees file', rows: rows.filter(r => r.cat === 'Management') },
  ]

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 19, fontWeight: 800, color: 'var(--ink)', margin: 0 }}>Voluntary</h2>
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 3 }}>
            {volunteers.length + management.length
              ? `${volunteers.length + management.length} people · ${volunteers.length} volunteers · ${management.length} management`
              : 'NGO-wise volunteer & management roster'}
          </div>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-num" style={{ color: '#7B5EA7' }}>{volunteers.length + management.length}</div>
          <div className="stat-lbl">Total People</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: '#16a34a' }}>{volunteers.length}</div>
          <div className="stat-lbl">Volunteers (DB)</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: '#C08A2E' }}>{management.length}</div>
          <div className="stat-lbl">Management (File)</div>
        </div>
        {ngoLabels.map(n => (
          <div className="stat-card" key={n}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: ngoColor(n), display: 'inline-block', flexShrink: 0 }} />
              <span className="stat-lbl" style={{ fontSize: 12 }}>{n}</span>
            </div>
            <div className="stat-num" style={{ color: ngoColor(n), fontSize: 24 }}>{counts[n]}</div>
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
          {ngoLabels.map(n => <option key={n} value={n}>{n} ({counts[n]})</option>)}
        </select>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search volunteer / management..."
          style={{ flex: 1, minWidth: 220, padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontSize: 13, outline: 'none' }}
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
        {ngoLabels.map(n => (
          <button
            key={n}
            className={`btn btn-sm ${ngoFilter === n ? 'btn-primary' : ''}`}
            onClick={() => setNgoFilter(ngoFilter === n ? 'All' : n)}
            style={ngoFilter !== n ? { background: 'transparent', border: '1px solid var(--line)' } : {}}
          >
            <span style={{ marginRight: 6 }}>{n}</span>
            <span style={{ opacity: 0.75 }}>({counts[n]})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5 }}>
          Loading voluntary section...
        </div>
      ) : (
        teamSections.map(section => {
          const groups = groupRows(section.rows)
          return (
            <div key={section.label} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', letterSpacing: '.02em' }}>{section.label}</span>
                <span className="pill pill-gray" style={{ fontSize: 11 }}>{section.rows.length}</span>
                <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>{section.source}</span>
              </div>

              {groups.length === 0 ? (
                <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13 }}>
                  {section.label === 'Management Team' && fileError
                    ? fileError
                    : 'No people match the current filter.'}
                </div>
              ) : (
                groups.map(g => {
                  const color = ngoColor(g.name)
                  return (
                    <div className="card" key={g.name} style={{ marginBottom: 12, overflow: 'hidden' }}>
                      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.03em', textTransform: 'uppercase', color: 'var(--ink)' }}>{g.name}</span>
                        <span className="pill pill-gray" style={{ fontSize: 11 }}>{g.items.length} person{g.items.length === 1 ? '' : 's'}</span>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <tbody>
                            {g.items.map((p, i) => (
                              <tr key={(p.id != null ? p.id : '') + '-' + i}>
                                <td style={{ padding: '10px 18px', borderBottom: '1px solid var(--line)', color: 'var(--ink)' }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ width: 28, height: 28, borderRadius: '50%', background: `${color}1a`, color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{initials(p.name)}</span>
                                    <span style={{ fontWeight: 600 }}>{p.name}</span>
                                  </span>
                                </td>
                                <td align="right" style={{ padding: '10px 18px', borderBottom: '1px solid var(--line)' }}>
                                  <span className={`pill ${ngoFilter === p.ngo ? 'pill-green' : 'pill-gray'}`} style={{ fontSize: 11 }}>{p.ngo}</span>
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
        })
      )}
    </div>
  )
}