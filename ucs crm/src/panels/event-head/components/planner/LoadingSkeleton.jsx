export default function LoadingSkeleton() {
  const days = Array.from({ length: 35 }, (_, i) => i)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginTop: 0 }}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-soft)', padding: '6px 0 4px', fontWeight: 600 }}>{d}</div>
        ))}
        {days.map(i => (
          <div key={i} style={{
            minHeight: 110,
            background: 'var(--card-bg)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--line)',
            padding: 4,
          }}>
            <div style={{
              width: '30%',
              height: 12,
              background: 'linear-gradient(90deg, var(--line) 25%, #e8eaed 50%, var(--line) 75%)',
              backgroundSize: '200% 100%',
              borderRadius: 4,
              marginBottom: 6,
              animation: 'shimmer 1.5s infinite',
            }} />
            <div style={{
              width: '90%',
              height: 32,
              background: 'linear-gradient(90deg, var(--line) 25%, #e8eaed 50%, var(--line) 75%)',
              backgroundSize: '200% 100%',
              borderRadius: 6,
              marginBottom: 4,
              animation: 'shimmer 1.5s infinite',
              animationDelay: '0.1s',
            }} />
            <div style={{
              width: '80%',
              height: 32,
              background: 'linear-gradient(90deg, var(--line) 25%, #e8eaed 50%, var(--line) 75%)',
              backgroundSize: '200% 100%',
              borderRadius: 6,
              animation: 'shimmer 1.5s infinite',
              animationDelay: '0.2s',
            }} />
          </div>
        ))}
      </div>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}
