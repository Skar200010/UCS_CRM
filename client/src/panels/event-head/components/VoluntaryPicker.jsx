import { useState, useEffect, useMemo } from 'react'
import { fetchWorkspaceNgos, fetchEventsByNgo, fetchVolunteerPeople, fetchVolunteerAttendanceToday } from '../store'
import { shortLabel, sortNgos, parseManagementTeam, buildRoster } from '../voluntaryRoster'
import hrFileUrl from '../pages/HR EMPLOYEES FILES (1).xlsx?url'

const PALETTE = ['#5B6B4E', '#C08A2E', '#7A5C7E', '#B5603A', '#4F6472', '#88693D', '#2E7D32', '#1565C0', '#00838F', '#6A1B9A']
const ngoColor = (name) => {
  let h = 0
  for (const ch of String(name || 'Other')) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}
const initials = (n) => String(n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'

// Same labels and colours the HR panel uses for its attendance badges
// (hr/components/Attendance.jsx + the .badge-* rules in index.css). Those rules
// are scoped to `.panel-hr`, so they are restated inline here rather than
// imported — this file is inline-style based throughout.
const STATUS_STYLE = {
  present: { lbl: 'Present', bg: '#d1fae5', fg: '#065f46' },
  late: { lbl: 'Late', bg: '#fef3c7', fg: '#92400e' },
  absent: { lbl: 'Absent', bg: '#fee2e2', fg: '#991b1b' },
  leave: { lbl: 'Leave', bg: '#ede9fe', fg: '#5b21b6' },
  'half-day': { lbl: 'Half Day', bg: '#e5e7eb', fg: '#374151' },
}

// Absent sorts above everyone else, then the states that mean "in but not fully
// here", then the rest. Anything unranked keeps its original order at the bottom.
const STATUS_RANK = { absent: 0, leave: 1, 'half-day': 2, late: 3, present: 4 }
const statusRank = (s) => (s in STATUS_RANK ? STATUS_RANK[s] : 5)

// 'YYYY-MM-DD' from the server, shown the way the rest of the panel shows dates.
const formatAttendanceDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''))
  if (!m) return ''
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${m[3]}-${months[Number(m[2]) - 1]}-${m[1]}`
}

// Renders nothing at all without a record, so Management rows (no worker id) stay
// exactly as they were. Late people additionally see how late they were.
function StatusBadge({ record }) {
  if (!record) return null
  const s = STATUS_STYLE[record.status] || { lbl: record.status || 'Unknown', bg: '#e5e7eb', fg: '#374151' }
  const lateBy = record.status === 'late' && record.late_minutes > 0 ? ` ${record.late_minutes}m` : ''
  return (
    <span
      style={{
        marginLeft: 'auto', flexShrink: 0,
        fontSize: 10.5, fontWeight: 800, letterSpacing: '.03em', textTransform: 'uppercase',
        padding: '3px 9px', borderRadius: 999,
        background: s.bg, color: s.fg,
      }}
    >
      {s.lbl}{lateBy}
    </span>
  )
}

// The id is the HR worker id when the entry came from the HR panel, so the
// server can match exactly. Management entries and rows saved before this
// existed have no id and fall back to name matching.
const normalizeSelected = (list) =>
  (Array.isArray(list) ? list : []).map(v => ({
    key: [v.team, v.ngo, v.name].join('|'),
    id: v.id ?? null,
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
  const [search, setSearch] = useState('')
  // { date, byWorker } from the server, or null when the read failed. Null means
  // "no badges at all" rather than "everyone is absent" — a failed request must
  // never be mistaken for an empty attendance day.
  const [attendance, setAttendance] = useState(null)
  // Defaults on so the list is the people who are actually in today. It is a
  // toggle rather than a hard filter so absent people are never made
  // unreachable — an event can still be staffed by someone marked absent, and
  // whoever picks the team may be looking at yesterday's attendance.
  const [presentOnly, setPresentOnly] = useState(true)
  // Voluntary (volunteer) and Management are shown one team at a time instead of
  // both stacked, so the two very different lists are never mixed together.
  const [teamTab, setTeamTab] = useState('Volunteer')

  const selectedKeys = useMemo(() => new Set((value || []).map(v => [v.team, v.ngo, v.name].join('|'))), [value])

  // The picker is scoped to the event's NGO: once an NGO is chosen in Program
  // Details, only that NGO's people are ever listed. The label is resolved the
  // same way the roster labels are (shortLabel on code||name) so the two agree;
  // volunteers additionally match by exact ngo_id when the HR row carries one.
  const selectedNgoLabel = useMemo(() => {
    if (!ngoId) return null
    const n = ngos.find(x => String(x.id) === String(ngoId))
    return n ? shortLabel(n.code || n.name) : null
  }, [ngos, ngoId])

  const selectedNgoItems = useMemo(() => {
    if (!ngoId) return []
    return items.filter(i => {
      if (i.team === 'Volunteer' && i.ngo_id != null) return String(i.ngo_id) === String(ngoId)
      return selectedNgoLabel ? shortLabel(i.ngo) === selectedNgoLabel : false
    })
  }, [items, ngoId, selectedNgoLabel])

  // Everything below is scoped to the selected NGO and the active team tab.
  const itemsInTab = useMemo(() => selectedNgoItems.filter(i => i.team === teamTab), [selectedNgoItems, teamTab])

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
        return parseManagementTeam(rows)
      } catch (e) {
        if (!cancelled) setFileError('Could not load the management list from the HR employees file.')
        return []
      }
    }

    // fetchVolunteerPeople is the live HR-panel roster: the server already keeps
    // employment_status = 'active' and drops test records, so anyone absconded
    // in the HR panel is gone from here automatically.
    //
    // Attendance rides along in the same load so a person is never rendered
    // without a status they actually have. It is caught separately because the
    // picker must still work if the read fails.
    Promise.all([
      fetchVolunteerPeople().catch(() => []),
      loadFile(),
      fetchWorkspaceNgos().catch(() => []),
    ]).then(([people, mgmt, ngoList]) => {
      if (cancelled) return
      setItems(buildRoster(people, mgmt, ngoList))
      setNgos(ngoList || [])
      setLoading(false)
    })

    fetchVolunteerAttendanceToday()
      .then(data => { if (!cancelled) setAttendance(data || null) })
      .catch(() => { if (!cancelled) setAttendance(null) })

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

  // A person's attendance status for the day, or null when there is nothing to
  // show: no attendance read, or a Management entry, which comes from the HR
  // employees file and has no worker id to join on.
  const statusOf = (item) => {
    if (!attendance || item.id == null || item.team !== 'Volunteer') return null
    const row = attendance.byWorker?.[String(item.id)]
    // No row at all is the absence — `attendance` never stores absent rows, so a
    // missing punch IS the absence. Same rule as the HR dashboard's check-ins.
    if (!row) return { status: 'absent', late_minutes: 0 }
    return { status: row.status || 'present', late_minutes: row.late_minutes || 0 }
  }

  // Where someone appears is decided by two facts, not one filter:
//   absent  -> the front block at the top of the section, and nowhere else
//   leave   -> the main list, hidden unless "Only present today" is off
//   the rest -> the main list, always
// So the two lists never show the same person twice.
const isAbsent = (item) => statusOf(item)?.status === 'absent'
const isOnLeave = (item) => statusOf(item)?.status === 'leave'

  // Counted across the selected NGO's volunteers. Stays null until the roster has
  // actually loaded — an empty roster would otherwise count as zero absentees and
  // claim "everyone has marked attendance today", the exact opposite of the truth.
  const todayCounts = useMemo(() => {
    if (!attendance || loading || !items.length) return null
    const tally = { absent: 0, present: 0, late: 0, leave: 0, 'half-day': 0 }
    for (const i of selectedNgoItems) {
      const s = statusOf(i)
      if (s && s.status in tally) tally[s.status]++
    }
    return tally
  }, [selectedNgoItems, attendance, loading, items.length])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return itemsInTab.filter(i => {
      if (q && !i.name.toLowerCase().includes(q)) return false
      // Only applied once attendance is actually known. Without a real read,
      // filtering would empty the list on the strength of a failed request.
      if (attendance) {
        if (isAbsent(i)) return false
        if (presentOnly && isOnLeave(i)) return false
      }
      return true
    })
  }, [itemsInTab, search, presentOnly, attendance])

  // How many the present-only toggle is holding back, so the list never looks
  // short without saying why.
  const hiddenOnLeave = useMemo(() => {
    if (!presentOnly || !attendance || loading) return 0
    return itemsInTab.filter(i => !isAbsent(i) && isOnLeave(i)).length
  }, [itemsInTab, presentOnly, attendance, loading])

// Already-ticked people who are absent. They live in the front block, so this is
  // only a guard for the case where the block is filtered out of view (search text,
  // or an NGO filter that excludes their NGO) — without it they could not be
  // reviewed or removed.
  const selectedNotOnDuty = useMemo(() => {
    if (!attendance) return []
    return (value || []).filter(v => isAbsent(v))
  }, [value, attendance])

  const groups = useMemo(() => {
    // Absent first inside each team block, then leave/half-day/late, then present.
    // Sorted on a copy so the checkbox indices stay stable, and stable on name
    // within a rank so equal statuses do not shuffle between renders.
    const byAttendance = (list) => [...list].sort((a, b) => {
      const sa = statusOf(a), sb = statusOf(b)
      const ra = sa ? statusRank(sa.status) : 6
      const rb = sb ? statusRank(sb.status) : 6
      return ra - rb || a.name.localeCompare(b.name)
    })
    const labels = [...new Set(filtered.map(i => i.ngo))].sort(sortNgos)
    return labels.map(ngo => ({
      ngo,
      volunteer: byAttendance(filtered.filter(i => i.ngo === ngo && i.team === 'Volunteer')),
      management: byAttendance(filtered.filter(i => i.ngo === ngo && i.team === 'Management')),
    }))
  }, [filtered, attendance])

  const isSelected = (item) => selectedKeys.has([item.team, item.ngo, item.name].join('|'))

  // Everyone absent today in the selected NGO, in one flat list. This is what
  // sits at the FRONT of the section: the main list below only carries the people
  // who are in, so without this block an absence would be invisible.
  const absentItems = useMemo(() => {
    if (!attendance) return []
    return selectedNgoItems
      .filter(i => statusOf(i)?.status === 'absent')
      .sort((a, b) => a.ngo.localeCompare(b.ngo) || a.name.localeCompare(b.name))
  }, [selectedNgoItems, attendance])

  const toggle = (item) => {
    const key = [item.team, item.ngo, item.name].join('|')
    const next = (value || []).filter(v => [v.team, v.ngo, v.name].join('|') !== key)
    if (!isSelected(item)) next.push({ id: item.id ?? null, name: item.name, ngo: item.ngo, team: item.team })
    onChange(next)
  }
  const setGroup = (teamRows, on) => {
    const current = (value || []).filter(v => !teamRows.find(r => [r.team, r.ngo, r.name].join('|') === [v.team, v.ngo, v.name].join('|')))
    if (on) current.push(...teamRows)
    onChange(current)
  }
  const copySelection = (ev) => {
    onChange(normalizeSelected(ev.volunteers).map(v => ({ id: v.id ?? null, name: v.name, ngo: v.ngo, team: v.team })))
  }

  const inline = { padding: '10px 16px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontSize: 13, outline: 'none', background: 'var(--card-bg)' }

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--eh-ink-soft, #6b7280)', marginBottom: 12 }}>
        Pick the people for this event. Use the Voluntary / Management tabs to switch between
        the two teams of the selected NGO. Anyone absent today is listed first in red; the list
        shows who is in. Volunteers come live from the HR panel, so anyone absconded there is
        already hidden. Management comes from the HR employees file.
      </div>

      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Loading voluntary teams…</div>
      ) : !ngoId ? (
        <div
          data-testid="voluntary-no-ngo"
          style={{
            padding: '16px 18px', borderRadius: 12, fontSize: 13,
            border: '1px dashed var(--line)', background: 'var(--card-bg)', color: 'var(--eh-ink-soft, #6b7280)',
          }}
        >
          <b style={{ color: 'var(--ink)' }}>Choose an NGO in Program Details first.</b>{' '}
          Its Volunteers and Management will appear here once an NGO is selected.
        </div>
      ) : (
        <>
          {fileError && <div style={{ padding: 12, borderRadius: 10, background: '#fef2f2', color: '#b91c1c', fontSize: 12.5, marginBottom: 10 }}>{fileError}</div>}

          {/* Team tabs: one team at a time. Voluntary = HR-panel volunteers (with
              attendance); Management = the HR employees file. Both are scoped to
              the event's NGO. */}
          <div style={{ display: 'inline-flex', gap: 3, padding: 3, marginBottom: 12, border: '1px solid var(--line)', borderRadius: 999, background: 'var(--card-bg)' }}>
            {[['Volunteer', 'Voluntary'], ['Management', 'Management']].map(([team, lbl]) => {
              const active = teamTab === team
              const n = selectedNgoItems.filter(i => i.team === team).length
              return (
                <button
                  key={team}
                  type="button"
                  onClick={() => setTeamTab(team)}
                  style={{
                    cursor: 'pointer', border: 'none', borderRadius: 999,
                    padding: '6px 16px', fontSize: 12.5, fontWeight: active ? 800 : 600,
                    background: active ? 'var(--eh-primary, #7B5EA7)' : 'transparent',
                    color: active ? '#fff' : 'var(--ink-soft, #6b7280)',
                  }}
                >
                  {lbl} <span style={{ opacity: 0.8, fontWeight: 700, fontSize: 11.5 }}>{n}</span>
                </button>
              )
            })}
          </div>

          {/* ABSENT FIRST. The list below is present-only, so this is the one place
              an absence is visible. Kept above the summary and the NGO filter on
              purpose — it is the answer to "who is not in today". Volunteers only —
              Management has no attendance record. */}
          {teamTab === 'Volunteer' && attendance && absentItems.length > 0 && (
            <div
              data-testid="voluntary-absent-front"
              style={{
                border: '1px solid #fca5a5', borderRadius: 12, overflow: 'hidden',
                marginBottom: 12, background: '#fef2f2',
              }}
            >
              <div
                style={{
                  padding: '9px 14px', background: '#fee2e2', borderBottom: '1px solid #fca5a5',
                  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '.03em', textTransform: 'uppercase', color: '#991b1b' }}>
                  Absent today — {absentItems.length}
                </span>
                <span style={{ fontSize: 11.5, color: '#991b1b', opacity: 0.85 }}>
                  Not marked in attendance for {formatAttendanceDate(attendance?.date) || 'today'}. They are listed here first; the team list below shows only people in.
                </span>
                <label style={{ marginLeft: 'auto', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', color: '#991b1b', fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={absentItems.length > 0 && absentItems.every(isSelected)}
                    onChange={e => setGroup(absentItems, e.target.checked)}
                  />
                  Select all
                </label>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {absentItems.map(item => (
                  <label
                    key={'abs' + item.id + item.name}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '7px 14px', cursor: 'pointer',
                      borderRight: '1px solid #fecaca', borderBottom: '1px solid #fecaca',
                      background: isSelected(item) ? '#fff' : 'transparent',
                    }}
                  >
                    <input type="checkbox" checked={isSelected(item)} onChange={() => toggle(item)} />
                    <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.03em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 999, background: '#fee2e2', color: '#991b1b' }}>
                      Absent
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#7f1d1d' }}>{item.name}</span>
                    <span style={{ fontSize: 11, color: '#991b1b', opacity: 0.75 }}>{item.ngo}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {teamTab === 'Volunteer' && todayCounts && (
            <div
              data-testid="voluntary-attendance-summary"
              style={{
                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                padding: '9px 12px', marginBottom: 10, borderRadius: 10,
                border: '1px solid ' + (todayCounts.absent ? '#fecaca' : 'var(--line)'),
                background: todayCounts.absent ? '#fef2f2' : 'var(--card-bg)',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>
                {todayCounts.absent > 0
                  ? <><span style={{ color: '#991b1b' }}>{todayCounts.absent} absent today</span> — listed at the top</>
                  : 'Everyone has marked attendance today'}
              </span>
              <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
                {['present', 'late', 'half-day', 'leave', 'absent'].map(k => (
                  <span
                    key={k}
                    style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                      background: STATUS_STYLE[k].bg, color: STATUS_STYLE[k].fg,
                      opacity: todayCounts[k] ? 1 : 0.4,
                    }}
                  >
                    {STATUS_STYLE[k].lbl} {todayCounts[k]}
                  </span>
                ))}
              </span>
              <span style={{ fontSize: 11, color: 'var(--eh-ink-soft, #6b7280)', width: '100%' }}>
                Attendance for {formatAttendanceDate(attendance?.date) || 'today'} · Management has no attendance record
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search volunteer / management…" style={{ ...inline, flex: 1, minWidth: 180 }} />
            {teamTab === 'Volunteer' && attendance && (
              <label
                title={presentOnly
                  ? 'Showing only the people in today. Turn this off to also list people on approved leave.'
                  : 'Showing everyone in today plus anyone on approved leave. Absent people stay in the red block at the top.'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                  fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
                  padding: '9px 13px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid ' + (presentOnly ? '#86efac' : 'var(--line)'),
                  background: presentOnly ? '#f0fdf4' : 'var(--card-bg)',
                  color: presentOnly ? '#166534' : 'var(--ink-soft, #6b7280)',
                }}
              >
                <input type="checkbox" checked={presentOnly} onChange={e => setPresentOnly(e.target.checked)} />
                Only present today
                {presentOnly && hiddenOnLeave > 0 && (
                  <span style={{ fontWeight: 800, color: '#5b21b6', background: '#ede9fe', borderRadius: 999, padding: '1px 7px', fontSize: 11 }}>
                    {hiddenOnLeave} on leave
                  </span>
                )}
              </label>
            )}
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
            <div style={{ padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
              {presentOnly && attendance
                ? 'Nobody in this filter is present today. Turn off "Only present today" to include people on leave.'
                : 'No voluntary members match this filter.'}
            </div>
          ) : (
            groups.map(g => {
              const color = ngoColor(g.ngo)
              const vAll = g.volunteer.length > 0 && g.volunteer.every(isSelected)
              const mAll = g.management.length > 0 && g.management.every(isSelected)
              const rowStyle = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderBottom: '1px solid var(--line)', cursor: 'pointer' }
              return (
                <div key={g.ngo} style={{ border: '1px solid var(--line)', borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}>
                  <div
                    style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.03em', textTransform: 'uppercase', color: 'var(--ink)' }}>{g.ngo}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
                      {teamTab === 'Volunteer' ? `${g.volunteer.length} Volunteer` : `${g.management.length} Management`}
                    </span>
                    {(() => {
                      const n = g.volunteer.filter(v => statusOf(v)?.status === 'absent').length
                      if (!n) return null
                      return (
                        <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.03em', padding: '2px 8px', borderRadius: 999, background: '#fee2e2', color: '#991b1b' }}>
                          {n} absent
                        </span>
                      )
                    })()}
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
                      {g.volunteer.map((item, i) => {
                        const st = statusOf(item)
                        return (
                          <label
                            key={'v' + g.ngo + i + item.name}
                            style={{
                              ...rowStyle,
                              background: st?.status === 'absent' ? 'color-mix(in srgb, #fee2e2 55%, transparent)' : undefined,
                            }}
                          >
                            <input type="checkbox" checked={isSelected(item)} onChange={() => toggle(item)} />
                            <span style={{ width: 26, height: 26, borderRadius: '50%', background: `${color}1a`, color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 800, flexShrink: 0 }}>{initials(item.name)}</span>
                            <span style={{ fontSize: 13, fontWeight: st?.status === 'absent' ? 700 : 400 }}>{item.name}</span>
                            <StatusBadge record={st} />
                          </label>
                        )
                      })}
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

          {value && value.length > 0 && (() => {
            const inTab = value.filter(v => (v.team === 'Management' ? 'Management' : 'Volunteer') === teamTab)
            const totalNote = value.length !== inTab.length ? ` · ${value.length} total across both teams` : ''
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>
                  <b>{inTab.length}</b> selected in {teamTab === 'Volunteer' ? 'Voluntary' : 'Management'}{totalNote}:
                </span>
                {inTab.length === 0
                  ? <span style={{ fontSize: 12, color: '#9ca3af' }}>none from this team yet</span>
                  : inTab.map(v => (
                    <span key={v.name + v.team} className="pill pill-green" style={{ fontSize: 11 }}>{v.name} · {v.ngo} · {v.team}</span>
                  ))}
              </div>
            )
          })()}

          {/* Someone already ticked but not in today is filtered out of the list
              above, so they would otherwise be impossible to review or untick.
              Surfaced here, where every selected person is already listed. */}
          {teamTab === 'Volunteer' && presentOnly && attendance && selectedNotOnDuty.length > 0 && (
            <div
              data-testid="voluntary-selected-not-present"
              style={{
                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                marginTop: 8, padding: '9px 12px', borderRadius: 10,
                border: '1px solid #fecaca', background: '#fef2f2',
                fontSize: 12, color: '#991b1b',
              }}
            >
              <span style={{ fontWeight: 700 }}>
                {selectedNotOnDuty.length} selected but not present today:
              </span>
              {selectedNotOnDuty.map(v => (
                <button
                  key={v.name + v.team}
                  type="button"
                  onClick={() => toggle(v)}
                  title="Remove from this event"
                  style={{
                    cursor: 'pointer', fontSize: 11, fontWeight: 700,
                    padding: '3px 9px', borderRadius: 999,
                    border: '1px solid #fca5a5', background: '#fff', color: '#991b1b',
                    textDecoration: 'line-through',
                  }}
                >
                  {v.name} ✕
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}