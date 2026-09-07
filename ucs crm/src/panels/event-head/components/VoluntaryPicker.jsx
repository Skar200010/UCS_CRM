import { useState, useEffect, useMemo } from 'react'
import { fetchWorkspaceNgos, fetchEventsByNgo } from '../store'
import hrFileUrl from '../pages/HR EMPLOYEES FILES (1).xlsx?url'

const PALETTE = ['#5B6B4E', '#C08A2E', '#7A5C7E', '#B5603A', '#4F6472', '#88693D', '#2E7D32', '#1565C0', '#00838F', '#6A1B9A']
const ngoColor = (name) => {
  let h = 0
  for (const ch of String(name || 'Other')) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}
const initials = (n) => String(n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'

const shortLabel = (codeOrName) => {
  const c = String(codeOrName || '').toUpperCase().trim()
  const map = { BSCT: 'BSCT', AFLF: 'AFLF', MANN: 'Mann', MAN: 'Mann', OTHER: 'Others', OTHERS: 'Others' }
  return map[c] || String(codeOrName || '').trim()
}

const orderIndex = (label) => {
  const u = String(label || '').toUpperCase()
  const map = { BSCT: 0, AFLF: 1, MANN: 2, MAN: 2, OTHERS: 3, OTHER: 3 }
  return map[u] !== undefined ? map[u] : 100
}
const sortNgos = (a, b) => orderIndex(a) - orderIndex(b) || String(a).localeCompare(String(b))

const parseHRTeams = (rows) => {
  const active = {}
  const out = []
  for (const row of rows) {
    for (let c = 0; c < row.length; c++) {
      const txt = String(row[c] || '').trim()
      const mg = txt.match(/^(.*?)\s*Management\s+Team\s*$/i)
      if (mg) {
        active[c] = { team: 'Management', ngo: (mg[1] || '').trim() || 'Other' }
        continue
      }
      const vol = txt.match(/^(.*?)\s*Volunteer\s+Team\s*$/i)
      if (vol) {
        active[c] = { team: 'Volunteer', ngo: (vol[1] || '').trim() || 'Other' }
        continue
      }
      if (txt && /Team\s*$/i.test(txt)) {
        delete active[c]
      }
    }
    for (const c of Object.keys(active)) {
      const ci = Number(c)
      const name = String(row[ci + 1] || '').trim().replace(/\s+/g, ' ')
      const ngoCell = String(row[ci + 2] || '').trim()
      if (!name || /Team\s*$/i.test(name) || /^Sr\.?\s*No\.?\s*$/i.test(name) || name.toUpperCase() === 'NAME') continue
      out.push({ name, ngo: ngoCell || active[c].ngo, team: active[c].team })
    }
  }
  const seen = new Set()
  return out.filter(m => {
    const k = m.name.toLowerCase() + '|' + m.ngo.toLowerCase() + '|' + m.team
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

const normalizeSelected = (list) =>
  (Array.isArray(list) ? list : []).map(v => ({
    key: [v.team, v.ngo, v.name].join('|'),
    name: v.name,
    ngo: v.ngo || 'Others',
    team: v.team === 'Management' ? 'Management' : 'Volunteer',
  }))

export default function VoluntaryPicker({ ngoId, value, onChange }) {
  const [items, setItems] = useState([])
  const [ngos, setNgos] = useState([])
  const [prevEvents, setPrevEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [fileError, setFileError] = useState('')
  const [ngoFilter, setNgoFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [defaulted, setDefaulted] = useState(false)

  const selectedKeys = useMemo(() => new Set((value || []).map(v => [v.team, v.ngo, v.name].join('|'))), [value])

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
        return parseHRTeams(rows)
      } catch (e) {
        if (!cancelled) setFileError('Could not load the HR employees file.')
        return []
      }
    }

    Promise.all([loadFile(), fetchWorkspaceNgos().catch(() => [])]).then(([teamItems, ngoList]) => {
      if (cancelled) return
      setItems(teamItems)
      setNgos(ngoList || [])
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!ngoId) { setPrevEvents([]); return }
    let cancelled = false
    fetchEventsByNgo(ngoId)
      .then(list => {
        if (cancelled) return
        const withVol = (Array.isArray(list) ? list : [])
          .filter(ev => Array.isArray(ev.volunteers) && ev.volunteers.length)
          .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
          .slice(0, 5)
        setPrevEvents(withVol)
      })
      .catch(() => { if (!cancelled) setPrevEvents([]) })
    return () => { cancelled = true }
  }, [ngoId])

  const ngoLabels = useMemo(() => [...new Set(items.map(i => i.ngo))].sort(sortNgos), [items])

  const counts = useMemo(() => {
    const c = {}
    for (const i of items) c[i.ngo] = (c[i.ngo] || 0) + 1
    return c
  }, [items])

  // Prefer the event's NGO when the picker first opens (once, so a manual
  // "All NGOs" choice is not overridden afterwards).
  useEffect(() => {
    if (loading || defaulted || ngoFilter !== 'All' || ngoLabels.length === 0) return
    const ngo = ngos.find(n => String(n.id) === String(ngoId))
    const label = ngo ? shortLabel(ngo.code || ngo.name) : null
    if (label && ngoLabels.includes(label)) {
      setNgoFilter(label)
      setDefaulted(true)
    }
  }, [loading, defaulted, ngos, ngoLabels, ngoId, ngoFilter])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter(i => {
      if (ngoFilter !== 'All' && i.ngo !== ngoFilter) return false
      if (q && !i.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [items, ngoFilter, search])

  const groups = useMemo(() => {
    const labels = [...new Set(filtered.map(i => i.ngo))].sort(sortNgos)
    return labels.map(ngo => ({
      ngo,
      volunteer: filtered.filter(i => i.ngo === ngo && i.team === 'Volunteer'),
      management: filtered.filter(i => i.ngo === ngo && i.team === 'Management'),
    }))
  }, [filtered])

  const isSelected = (item) => selectedKeys.has([item.team, item.ngo, item.name].join('|'))
  const toggle = (item) => {
    const key = [item.team, item.ngo, item.name].join('|')
    const next = (value || []).filter(v => [v.team, v.ngo, v.name].join('|') !== key)
    if (!isSelected(item)) next.push({ name: item.name, ngo: item.ngo, team: item.team })
    onChange(next)
  }
  const setGroup = (teamRows, on) => {
    const current = (value || []).filter(v => !teamRows.find(r => [r.team, r.ngo, r.name].join('|') === [v.team, v.ngo, v.name].join('|')))
    if (on) current.push(...teamRows)
    onChange(current)
  }
  const copySelection = (ev) => {
    onChange(normalizeSelected(ev.volunteers).map(v => ({ name: v.name, ngo: v.ngo, team: v.team })))
  }

  const inline = { padding: '10px 16px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontSize: 13, outline: 'none', background: 'var(--card-bg)' }

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--eh-ink-soft, #6b7280)', marginBottom: 12 }}>
        Pick the Voluntary (volunteer + management) people for this event — grouped NGO-wise, from the HR employees file.
      </div>

      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Loading voluntary teams…</div>
      ) : (
        <>
          {fileError && <div style={{ padding: 12, borderRadius: 10, background: '#fef2f2', color: '#b91c1c', fontSize: 12.5, marginBottom: 10 }}>{fileError}</div>}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', alignSelf: 'center', marginRight: 2 }}>NGO:</span>
            {['All', ...ngoLabels].map(n => {
              const active = ngoFilter === n
              const color = n === 'All' ? '#7B5EA7' : ngoColor(n)
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNgoFilter(active ? 'All' : n)}
                  title={n === 'All' ? 'Show all NGOs' : `Filter to ${n}`}
                  style={{
                    cursor: 'pointer',
                    border: active ? '1px solid ' + color : '1px solid var(--line)',
                    background: active ? `${color}18` : 'var(--card-bg)',
                    borderRadius: 999,
                    padding: '6px 13px',
                    fontSize: 12.5,
                    fontWeight: active ? 700 : 600,
                    color: active ? color : 'var(--ink)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    boxShadow: 'none',
                  }}
                >
                  {n !== 'All' && <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />}
                  {n === 'All' ? 'All NGOs' : n}
                  <span style={{ opacity: 0.75, fontWeight: 700, fontSize: 11.5 }}>{n === 'All' ? items.length : (counts[n] || 0)}</span>
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search volunteer / management…" style={{ ...inline, flex: 1, minWidth: 180 }} />
          </div>

          {prevEvents.length > 0 && !fileError && (
            <div style={{ marginBottom: 14, borderRadius: 12, border: '1px dashed var(--eh-primary, #7B5EA7)', background: 'color-mix(in srgb, var(--eh-primary, #7B5EA7) 6%, transparent)', padding: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--eh-primary, #7B5EA7)', marginBottom: 8 }}>
                Previous events' Voluntary selection — helps you for this event
              </div>
              {prevEvents.map(ev => {
                const vols = normalizeSelected(ev.volunteers)
                const vCount = vols.filter(v => v.team === 'Volunteer').length
                const mCount = vols.length - vCount
                return (
                  <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--card-bg)', border: '1px solid var(--line)', marginBottom: 6, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 12.5, minWidth: 0 }}>
                      <b>{ev.name}</b>
                      <div style={{ color: '#6b7280', fontSize: 11.5 }}>
                        {ev.date ? String(ev.date).slice(0, 10) : ''} · {vCount} volunteer{mCount ? ` + ${mCount} management` : ''} · {[...new Set(vols.map(v => v.ngo))].join(', ')}
                      </div>
                    </div>
                    <button type="button" className="eh-btn eh-btn-primary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => copySelection(ev)}>Copy this selection</button>
                  </div>
                )
              })}
            </div>
          )}

          {groups.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>No voluntary members match this filter.</div>
          ) : (
            groups.map(g => {
              const color = ngoColor(g.ngo)
              const vAll = g.volunteer.length > 0 && g.volunteer.every(isSelected)
              const mAll = g.management.length > 0 && g.management.every(isSelected)
              const rowStyle = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderBottom: '1px solid var(--line)', cursor: 'pointer' }
              return (
                <div key={g.ngo} style={{ border: '1px solid var(--line)', borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}>
                  <div
                    onClick={() => setNgoFilter(ngoFilter === g.ngo ? 'All' : g.ngo)}
                    style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: 'pointer', userSelect: 'none' }}
                    title={ngoFilter === g.ngo ? 'Click to show all NGOs' : `Click to filter to ${g.ngo}`}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.03em', textTransform: 'uppercase', color: 'var(--ink)' }}>{g.ngo}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
                      {g.volunteer.length} Volunteer · {g.management.length} Management
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--eh-primary, #7B5EA7)', fontWeight: 600 }}>{ngoFilter === g.ngo ? 'Showing only this NGO — click to show all' : 'Click to filter to this NGO'}</span>
                  </div>

                  {g.volunteer.length > 0 && (
                    <>
                      <div style={{ padding: '8px 16px', background: 'color-mix(in srgb, var(--line) 30%, transparent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>Volunteer Team</span>
                        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                          <input type="checkbox" checked={vAll} onChange={e => setGroup(g.volunteer, e.target.checked)} />
                          Select all
                        </label>
                      </div>
                      {g.volunteer.map((item, i) => (
                        <label key={'v' + g.ngo + i + item.name} style={rowStyle}>
                          <input type="checkbox" checked={isSelected(item)} onChange={() => toggle(item)} />
                          <span style={{ width: 26, height: 26, borderRadius: '50%', background: `${color}1a`, color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 800, flexShrink: 0 }}>{initials(item.name)}</span>
                          <span style={{ fontSize: 13 }}>{item.name}</span>
                        </label>
                      ))}
                    </>
                  )}

                  {g.management.length > 0 && (
                    <>
                      <div style={{ padding: '8px 16px', background: 'color-mix(in srgb, var(--line) 30%, transparent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>Management Team</span>
                        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                          <input type="checkbox" checked={mAll} onChange={e => setGroup(g.management, e.target.checked)} />
                          Select all
                        </label>
                      </div>
                      {g.management.map((item, i) => (
                        <label key={'m' + g.ngo + i + item.name} style={rowStyle}>
                          <input type="checkbox" checked={isSelected(item)} onChange={() => toggle(item)} />
                          <span style={{ width: 26, height: 26, borderRadius: '50%', background: `${color}1a`, color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 800, flexShrink: 0 }}>{initials(item.name)}</span>
                          <span style={{ fontSize: 13 }}>{item.name}</span>
                        </label>
                      ))}
                    </>
                  )}
                </div>
              )
            })
          )}

          {value && value.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}><b>{value.length}</b> selected:</span>
              {value.map(v => (
                <span key={v.name + v.team} className="pill pill-green" style={{ fontSize: 11 }}>{v.name} · {v.ngo} · {v.team}</span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}