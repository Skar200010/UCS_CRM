import { useUcs } from '../../../store'

export default function Overview() {
  const { user } = useUcs()
  return (
    <div className="overview-grid">
      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <h3>Welcome, {user?.name || 'Event Head'}</h3>
        <p style={{ color: 'var(--ink-soft)', marginTop: 8 }}>
          Manage your events from this dashboard.
        </p>
      </div>
    </div>
  )
}
