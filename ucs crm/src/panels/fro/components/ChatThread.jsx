import { useState, useEffect, useRef } from 'react';

function MessageStatusIcon({ status }) {
  if (status === 'sent') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 11" fill="none" style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 2 }}>
        <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.095a.463.463 0 0 0-.336-.153.457.457 0 0 0-.342.14.525.525 0 0 0-.14.349c0 .128.051.256.14.342l2.423 2.5a.53.53 0 0 0 .368.153.483.483 0 0 0 .375-.185l6.605-8.15a.487.487 0 0 0 .121-.336.5.5 0 0 0-.14-.332Z" fill="#8696a0"/>
      </svg>
    );
  }
  if (status === 'delivered' || status === 'read') {
    return (
      <svg width="18" height="14" viewBox="0 0 19 11" fill="none" style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 2 }}>
        <path d="M11.571.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.095a.463.463 0 0 0-.336-.153.457.457 0 0 0-.342.14.525.525 0 0 0-.14.349c0 .128.051.256.14.342l2.423 2.5a.53.53 0 0 0 .368.153.483.483 0 0 0 .375-.185l6.605-8.15a.487.487 0 0 0 .121-.336.5.5 0 0 0-.14-.332Z" fill={status === 'read' ? '#53bdeb' : '#8696a0'}/>
        <path d="M17.571.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636L9.657 6.5a.52.52 0 0 0-.127-.332l-.533.65.996 1.143a.53.53 0 0 0 .368.153.483.483 0 0 0 .375-.185l6.605-8.15a.487.487 0 0 0 .121-.336.5.5 0 0 0-.14-.332Z" fill={status === 'read' ? '#53bdeb' : '#8696a0'}/>
      </svg>
    );
  }
  return null;
}

function ChatBubble({ message }) {
  const isOutbound = message.direction === 'outbound';
  const time = message.created_at
    ? new Date(message.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div style={{ display: 'flex', justifyContent: isOutbound ? 'flex-end' : 'flex-start', marginBottom: 4 }}>
      <div style={{
        maxWidth: '75%',
        padding: '8px 12px',
        borderRadius: 12,
        borderBottomRightRadius: isOutbound ? 4 : 12,
        borderBottomLeftRadius: isOutbound ? 12 : 4,
        background: isOutbound ? '#dcfce7' : '#f3f4f6',
        color: '#1f2937',
        fontSize: 13,
        lineHeight: 1.45,
        wordBreak: 'break-word',
      }}>
        <div style={{ whiteSpace: 'pre-wrap' }}>{message.body_text || message.body || ''}</div>
        <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'right', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          {time}
          {isOutbound && <MessageStatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
}

export default function ChatThread({ messages, onSend, loading }) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await onSend(input.trim());
      setInput('');
    } catch (err) {
      alert('Failed to send: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!messages) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#9ca3af' }}>
        Select a conversation to view messages
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', background: '#f9fafb' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 20, fontSize: 13, color: '#6b7280' }}>Loading messages...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: '#9ca3af' }}>
            No messages yet. Send a message to start the conversation.
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: '1px solid #e5e7eb', background: '#fff' }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={sending}
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: 13,
            border: '1px solid #d1d5db',
            borderRadius: 20,
            outline: 'none',
            background: '#f9fafb',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          style={{
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            background: input.trim() ? '#25D366' : '#d1d5db',
            color: '#fff',
            border: 'none',
            borderRadius: 20,
            cursor: input.trim() ? 'pointer' : 'not-allowed',
            transition: 'background .15s',
          }}
        >
          {sending ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
