export default function ConsistencyBar({ present = 0, absent = 0, late = 0, leave = 0, total = 1 }) {
  const pct = (v) => Math.round((v / total) * 100) || 0
  const segs = []
  if (present > 0) segs.push({ pct: pct(present), bg: '#2a6a4b', label: `Present ${present}` })
  if (late > 0) segs.push({ pct: pct(late), bg: '#c28228', label: `Late ${late}` })
  if (absent > 0) segs.push({ pct: pct(absent), bg: '#ba1a1a', label: `Absent ${absent}` })
  if (leave > 0) segs.push({ pct: pct(leave), bg: '#7a92b0', label: `Leave ${leave}` })

  if (segs.length === 0) segs.push({ pct: 100, bg: '#e5e7eb', label: 'No data' })

  return (
    <div className="h-3 rounded-full overflow-hidden flex">
      {segs.map((s, i) => (
        <div key={i} style={{ width: `${s.pct}%`, background: s.bg }} title={s.label} className="transition-all duration-500 first:rounded-l-full last:rounded-r-full" />
      ))}
    </div>
  )
}
