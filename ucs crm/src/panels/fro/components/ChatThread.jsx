import { useState, useEffect, useRef } from 'react';

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
        <div>{message.body_text || message.body || ''}</div>
        <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'right', marginTop: 2 }}>
          {time}
          {isOutbound && (
            <span style={{ marginLeft: 4 }}>
              {message.status === 'sent' ? '✓✓' : message.status === 'delivered' ? '✓✓' : message.status === 'read' ? '✓✓' : '✓'}
            </span>
          )}
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
