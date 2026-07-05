import { useEffect, useRef } from 'react'

const currency = n => n != null ? '\u20B9' + Number(n).toLocaleString('en-IN') : '\u2014'

export default function NotificationDrawer({ open, onClose, sections, onItemClick }) {
  const drawerRef = useRef(null)

  const totalCount = sections.reduce((s, sec) => s + (sec.items?.length || 0), 0)

  return (
    <>
      <div ref={drawerRef} className="notif-drawer" style={{
        position: 'fixed', top: 0, right: open ? 0 : '-340px', width: 320, maxWidth: '100vw',
        height: '100vh', background: '#fff', zIndex: 1000,
        boxShadow: '-4px 0 24px rgba(0,0,0,.12)',
        transition: 'right .25s ease',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Notifications</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{totalCount} pending</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sections.map((section, si) => (
            <div key={si}>
              {section.items?.length > 0 && (
                <div style={{ padding: '12px 20px 4px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '.5px' }}>
                  {section.label} ({section.items.length})
                </div>
              )}
              {section.items?.length === 0 && si === 0 && sections.every(s => !s.items?.length) && (
                <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>No pending notifications</div>
              )}
              {section.items?.map((item, i) => (
                <div key={item.id || i}
                  onClick={() => onItemClick?.(item, section)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 20px',
                    cursor: onItemClick ? 'pointer' : 'default', fontSize: 13,
                    borderBottom: '1px solid #f3f4f6',
                    transition: 'background .15s',
                  }}
                  onMouseOver={e => onItemClick && (e.currentTarget.style.background = '#f9fafb')}
                  onMouseOut={e => onItemClick && (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: section.type === 'rejected' ? '#fef2f2' : section.type === 'verified' ? '#f0fdf4' : '#f0fdf4',
                    color: section.type === 'rejected' ? '#dc2626' : '#16a34a',
                  }}>
                    {section.type === 'rejected' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    ) : section.type === 'verified' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {item.donor_name}
                      {section.type === 'rejected' && (
                        <span style={{ background: '#dc2626', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 700, lineHeight: '14px' }}>REJECTED</span>
                      )}
                      {section.type === 'verified' && (
                        <span style={{ background: '#16a34a', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 700, lineHeight: '14px' }}>VERIFIED</span>
                      )}
                    </div>
                    {section.type === 'rejected' && (
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>
                        {item.rejection_reason || item.body?.replace(/^Your lead for .+? was rejected\. /, '')?.replace(/Reason: /, '') || ''}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#9ca3af' }}>
                      {item.amount != null && <span style={{ color: '#5B6B4E', fontWeight: 600 }}>{currency(item.amount)}</span>}
                      <span>{item.created_at || item.sent_at ? new Date(item.created_at || item.sent_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 6 }}><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .notif-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 999;
          animation: notif-fade-in .2s ease;
        }
        @keyframes notif-fade-in {
          from { opacity: 0; } to { opacity: 1; }
        }
      `}</style>
    </>
  )
}
