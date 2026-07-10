export default function ConversationList({ conversations, activeId, onSelect, loading }) {
  if (loading) {
    return (
      <div style={{ padding: 12, fontSize: 13, color: '#6b7280', textAlign: 'center' }}>Loading conversations...</div>
    );
  }

  if (!conversations || conversations.length === 0) {
    return (
      <div style={{ padding: 12, fontSize: 13, color: '#6b7280', textAlign: 'center' }}>
        No conversations yet. When donors send a WhatsApp message, it will appear here.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {conversations.map((conv) => {
        const contact = conv.contact || {};
        const name = contact.wa_profile_name || contact.phone || 'Unknown';
        const isActive = String(conv.id) === String(activeId);
        const unread = conv.unread_count || 0;
        const lastMsg = conv.last_message_preview || '';
        const time = conv.last_message_at
          ? new Date(conv.last_message_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
          : '';

        return (
          <div
            key={conv.id}
            onClick={() => onSelect(conv)}
            style={{
              padding: '10px 12px',
              cursor: 'pointer',
              background: isActive ? '#f0fdf4' : '#fff',
              borderLeft: isActive ? '3px solid #25D366' : '3px solid transparent',
              transition: 'background .15s',
            }}
            onMouseOver={e => { if (!isActive) e.currentTarget.style.background = '#f9fafb' }}
            onMouseOut={e => { if (!isActive) e.currentTarget.style.background = '#fff' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <span style={{ fontSize: 13, fontWeight: unread > 0 ? 700 : 600, color: '#1f2937' }}>{name}</span>
              <span style={{ fontSize: 10, color: '#9ca3af' }}>{time}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                {lastMsg || 'No messages yet'}
              </span>
              {unread > 0 && (
                <span style={{
                  background: '#25D366',
                  color: '#fff',
                  borderRadius: '50%',
                  minWidth: 18,
                  height: 18,
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                  padding: '0 4px',
                }}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
