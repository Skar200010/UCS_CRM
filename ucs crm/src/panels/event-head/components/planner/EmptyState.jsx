export default function EmptyState() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
      color: 'var(--ink-soft)',
    }}>
      <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, marginBottom: 16 }}>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="10" y1="14" x2="14" y2="14" />
        <line x1="12" y1="12" x2="12" y2="16" />
      </svg>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>No Events Found</h3>
      <p style={{ fontSize: 13, textAlign: 'center', maxWidth: 300 }}>
        Try adjusting your filters or create a new event to get started.
      </p>
    </div>
  )
}
