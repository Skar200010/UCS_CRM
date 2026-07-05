import { useCall } from '../CallContext'

function fmt(seconds) {
  if (seconds == null) return '00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function CallTimer() {
  const { isOnCall, elapsed, todayStats, activeCall, endCall, onBreak, breakElapsed, toggleBreak, isBreakOvertime } = useCall()

  if (isOnCall) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 8px 2px 10px', borderRadius: 6, background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)', border: '1px solid #fecaca' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', animation: 'pulse 1s ease-in-out infinite', display: 'inline-block' }} />
        <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#dc2626' }}>call</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#991b1b', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeCall?.donorName}
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 14, fontWeight: 700, color: '#dc2626', minWidth: 45 }}>
          {fmt(elapsed)}
        </span>
        <button onClick={endCall}
          style={{ padding: '2px 10px', border: '1px solid #dc2626', borderRadius: 4, background: '#fff', color: '#dc2626', fontSize: 9, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', lineHeight: '18px', whiteSpace: 'nowrap' }}>
          End
        </button>
      </div>
    )
  }

  if (onBreak) {
    const overtime = isBreakOvertime
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 8px 2px 10px', borderRadius: 6,
        background: overtime ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)' : 'linear-gradient(135deg, #fefce8 0%, #fef9c3 100%)',
        border: `1px solid ${overtime ? '#fecaca' : '#fde68a'}` }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: overtime ? '#dc2626' : '#d97706', animation: 'pulse 1s ease-in-out infinite', display: 'inline-block' }} />
        <span className="material-symbols-outlined" style={{ fontSize: 13, color: overtime ? '#dc2626' : '#92400e' }}>free_breakfast</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: overtime ? '#991b1b' : '#92400e' }}>Break</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 700, color: overtime ? '#dc2626' : '#92400e', minWidth: 45 }}>
          {fmt(breakElapsed)}
        </span>
        {overtime && <span style={{ fontSize: 9, color: '#dc2626', fontWeight: 600 }}>🔴 Overtime</span>}
        <button onClick={toggleBreak}
          style={{ padding: '2px 10px', border: `1px solid ${overtime ? '#dc2626' : '#d97706'}`, borderRadius: 4, background: '#fff', color: overtime ? '#dc2626' : '#d97706', fontSize: 9, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', lineHeight: '18px', whiteSpace: 'nowrap' }}>
          Resume
        </button>
      </div>
    )
  }

  const items = []
  if (todayStats.skippedDonors > 0) {
    items.push({ label: `⏳${todayStats.skippedDonors} skip · ${fmt(todayStats.idleSeconds)}`, bg: '#fefce8', border: '#fde68a', color: '#92400e' })
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px', borderRadius: 6, background: item.bg, border: `1px solid ${item.border}`, fontSize: 11, color: item.color, whiteSpace: 'nowrap' }}>
          <span style={{ fontWeight: 600 }}>{item.label}</span>
        </div>
      ))}
      <button onClick={toggleBreak}
        style={{ padding: '6px 14px', border: '1px solid #fde68a', borderRadius: 8, background: '#fffbeb', color: '#92400e', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>free_breakfast</span>
        Break
      </button>
    </div>
  )
}
