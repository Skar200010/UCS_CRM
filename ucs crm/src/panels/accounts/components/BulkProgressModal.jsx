export default function BulkProgressModal({ visible, total, sent, failed, currentBatch, totalBatches, results, previousBatches, onCancel }) {
  if (!visible) return null

  const done = sent + failed
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => {}}>
      <div className="modal" style={{ maxWidth: 500, width: '90%' }}>
        <div className="modal-header">
          <h3 style={{ display:'flex', alignItems:'center', gap:8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            Sending WhatsApp Messages
          </h3>
        </div>
        <div className="modal-body" style={{ padding: 20 }}>
          <div style={{ width:'100%', background:'#e5e7eb', borderRadius:8, height:12, overflow:'hidden', marginBottom:12 }}>
            <div style={{ height:'100%', background:'linear-gradient(90deg,#059669,#10b981)', borderRadius:8, transition:'width .5s ease-out', width:`${pct}%` }} />
          </div>
          <div style={{ display:'flex', gap:16, fontSize:13, marginBottom:12 }}>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8,height:8,borderRadius:'50%',background:'#059669' }} /> {sent} Sent</span>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8,height:8,borderRadius:'50%',background:'#dc2626' }} /> {failed} Failed</span>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8,height:8,borderRadius:'50%',background:'#d1d5db' }} /> {total - done} Remaining</span>
          </div>
          {totalBatches > 1 && <p style={{ fontSize:12, color:'#9ca3af', marginBottom:12 }}>Batch {currentBatch} of {totalBatches}</p>}
          {results.length > 0 && (
            <div style={{ marginBottom:12 }}>
              <p style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', marginBottom:6 }}>Current Batch</p>
              <div style={{ maxHeight:160, overflowY:'auto', border:'1px solid #e5e7eb', borderRadius:8 }}>
                {results.map((r, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', fontSize:13, borderBottom:'1px solid #f3f4f6' }}>
                    {r.status === 'sending' ? (
                      <span style={{ width:14, height:14, border:'2px solid #d1d5db', borderTopColor:'transparent', borderRadius:'50%', animation:'spin .6s linear infinite' }} />
                    ) : r.status === 'sent' ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="3"><path d="M6 18L18 6M6 6l12 12"/></svg>
                    )}
                    <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name}</span>
                    {r.status === 'sent' && <span style={{ color:'#059669', fontSize:12 }}>Sent</span>}
                    {r.status === 'sending' && <span style={{ color:'#9ca3af', fontSize:12 }}>Sending...</span>}
                    {r.status === 'failed' && <span style={{ color:'#dc2626', fontSize:12 }} title={r.error}>{r.error || 'Failed'}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {previousBatches.length > 0 && (
            <div style={{ marginBottom:12 }}>
              <p style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', marginBottom:6 }}>Previous Batches</p>
              {previousBatches.map((b, i) => (
                <div key={i} style={{ fontSize:12, color:'#6b7280', display:'flex', gap:8 }}>
                  <span style={{ fontWeight:500, color:'#374151', width:80 }}>Batch {b.batch}:</span>
                  <span style={{ color:'#059669' }}>{b.sent}/{b.sent + b.failed}</span>
                  {b.failed > 0 && <span style={{ color:'#dc2626' }}>({b.failed} failed)</span>}
                </div>
              ))}
            </div>
          )}
          <div style={{ display:'flex', justifyContent:'center' }}>
            <button className="btn btn-sm" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}
