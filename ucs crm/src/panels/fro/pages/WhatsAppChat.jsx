import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ConversationList from '../components/ConversationList';
import ChatThread from '../components/ChatThread';
import { getConversations, getMessages, sendMessage, sendDirectMessage, markRead, getUnreadCount } from '../api/whatsappChat';
import { api } from '../api/auth';

function LoginForm({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'https://ucs-crm-backend.vercel.app/api';
      const res = await fetch(`${baseUrl}/whatsapp/fro-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Login failed' }));
        throw new Error(err.message);
      }
      const result = await res.json();
      localStorage.setItem('wa_auth', JSON.stringify(result));
      onLogin(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 180px)', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
      <div style={{ width: 360, padding: 32, background: '#fff', borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#25D36620', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#374151' }}>WhatsApp Login</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Enter your credentials to access WhatsApp Chat</div>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com"
              style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password"
              style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box' }} />
          </div>
          {error && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 12, padding: '8px 10px', background: '#fef2f2', borderRadius: 6 }}>{error}</div>}
          <button type="submit" disabled={loading || !email || !password}
            style={{ width: '100%', padding: '10px', fontSize: 14, fontWeight: 600, background: loading ? '#d1d5db' : '#25D366', color: '#fff', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Verifying...' : 'Login to WhatsApp'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function WhatsAppChat() {
  const location = useLocation();
  const navigate = useNavigate();
  const [waAuth, setWaAuth] = useState(() => JSON.parse(localStorage.getItem('wa_auth') || 'null'));
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState(null);
  const [loadingConv, setLoadingConv] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [newChatPhone, setNewChatPhone] = useState(null);
  const [newChatText, setNewChatText] = useState('');
  const [sendingNew, setSendingNew] = useState(false);
  const [showNewConv, setShowNewConv] = useState(false);
  const [newConvPhone, setNewConvPhone] = useState('');
  const [newConvText, setNewConvText] = useState('');

  const loadConversations = useCallback(async () => {
    setLoadingConv(true);
    try {
      const data = await getConversations();
      setConversations(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingConv(false);
    }
  }, []);

  const loadUnread = useCallback(async () => {
    try {
      const data = await getUnreadCount();
      setUnreadCount(data?.count || 0);
    } catch {}
  }, []);

  useEffect(() => {
    if (!waAuth) return;
    loadConversations();
    loadUnread();
    const interval = setInterval(() => {
      loadConversations();
      loadUnread();
    }, 15000);
    return () => clearInterval(interval);
  }, [waAuth, loadConversations, loadUnread]);

  const searchParams = new URLSearchParams(location.search);
  const phoneParam = searchParams.get('phone');

  useEffect(() => {
    if (!waAuth || !phoneParam || conversations.length === 0) return;
    const raw = phoneParam.replace(/[^0-9]/g, '');
    const match = conversations.find(c => {
      const cp = (c.contact?.phone_normalized || c.contact?.phone || '').replace(/[^0-9]/g, '');
      return cp.includes(raw) || raw.includes(cp);
    });
    if (match) {
      setNewChatPhone(null);
      handleSelect(match);
      navigate('/fro/whatsapp-chat', { replace: true });
    } else {
      setNewChatPhone(raw);
      setActiveConv(null);
      setMessages(null);
    }
  }, [waAuth, phoneParam, conversations.length]);

  const handleSelect = async (conv) => {
    setNewChatPhone(null);
    setActiveConv(conv);
    setLoadingMsg(true);
    try {
      const data = await getMessages(conv.id);
      setMessages(data || []);
      await markRead(conv.id).catch(() => {});
      setConversations(prev =>
        prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c)
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMsg(false);
    }
  };

  const handleSend = async (text) => {
    if (!activeConv) return;
    await sendMessage(activeConv.id, text);
    const data = await getMessages(activeConv.id);
    setMessages(data || []);
  };

  const handleNewChatSend = async () => {
    if (!newChatPhone || !newChatText.trim() || sendingNew) return;
    setSendingNew(true);
    try {
      const result = await sendDirectMessage(newChatPhone, newChatText.trim());
      setNewChatText('');
      await loadConversations();
      if (result.conversation) {
        handleSelect(result.conversation);
        navigate('/fro/whatsapp-chat', { replace: true });
      }
    } catch (err) {
      alert('Failed to send: ' + err.message);
    } finally {
      setSendingNew(false);
    }
  };

  const handleNewConv = async () => {
    if (!newConvPhone.trim()) { alert('Enter a phone number'); return; }
    setSendingNew(true);
    try {
      const result = await sendDirectMessage(newConvPhone.trim(), newConvText.trim() || 'Hello');
      setShowNewConv(false);
      setNewConvPhone('');
      setNewConvText('');
      await loadConversations();
      if (result.conversation) {
        handleSelect(result.conversation);
        navigate('/fro/whatsapp-chat', { replace: true });
      }
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setSendingNew(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('wa_auth');
    setWaAuth(null);
    setConversations([]);
    setActiveConv(null);
    setMessages(null);
  };

  if (!waAuth) {
    return <LoginForm onLogin={(result) => setWaAuth(result)} />;
  }

  const filteredConversations = conversations.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const contact = c.contact || {};
    const name = contact.wa_profile_name || contact.phone || '';
    return name.toLowerCase().includes(q) || (contact.phone || '').includes(q);
  });

  const contact = activeConv?.contact || {};
  const activeName = contact.wa_profile_name || contact.phone || 'Select a conversation';

  return (
    <>
    <div style={{ display: 'flex', height: 'calc(100vh - 180px)', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
      <div style={{ width: 300, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>
                WhatsApp Chat
                {unreadCount > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 11, background: '#25D366', color: '#fff', borderRadius: 10, padding: '1px 7px' }}>
                    {unreadCount}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                {waAuth?.worker?.name || 'Chat'}
              </div>
            </div>
            <button onClick={handleLogout} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 11, color: '#dc2626', padding: '4px 8px' }}>Logout</button>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            style={{ width: '100%', padding: '6px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box', outline: 'none' }}
          />
          <button onClick={() => setShowNewConv(true)}
            style={{ width: '100%', marginTop: 6, padding: '6px 10px', fontSize: 12, fontWeight: 600, background: '#25D366', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            + New Conversation
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <ConversationList
            conversations={filteredConversations}
            activeId={activeConv?.id}
            onSelect={handleSelect}
            loading={loadingConv}
          />
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {newChatPhone ? (
          <>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>New Chat</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>To: {newChatPhone}</div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 20, background: '#f9fafb' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#25D36620', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 4 }}>No previous conversation</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16, textAlign: 'center' }}>Send the first message to start chatting with this donor</div>
              <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 400 }}>
                <input type="text" value={newChatText} onChange={e => setNewChatText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleNewChatSend(); } }}
                  placeholder="Type your first message..." disabled={sendingNew}
                  style={{ flex: 1, padding: '10px 14px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 20, outline: 'none', background: '#fff' }} />
                <button onClick={handleNewChatSend} disabled={!newChatText.trim() || sendingNew}
                  style={{ padding: '10px 20px', fontSize: 13, fontWeight: 600, background: newChatText.trim() ? '#25D366' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 20, cursor: newChatText.trim() ? 'pointer' : 'not-allowed' }}>
                  {sendingNew ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{activeName}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
                {activeConv ? (activeConv.project || contact.project || '').toUpperCase() : ''}
              </div>
            </div>
            <ChatThread messages={messages} onSend={handleSend} loading={loadingMsg} />
          </>
        )}
      </div>
    </div>

    {showNewConv && (
      <div className="modal-overlay" onClick={() => setShowNewConv(false)}>
        <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>New Conversation</h3>
            <button className="btn btn-sm" onClick={() => setShowNewConv(false)}>Close</button>
          </div>
          <div className="modal-body" style={{ padding: 16 }}>
            <label className="field" style={{ marginBottom: 12, display: 'block' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Phone Number</span>
              <input type="tel" value={newConvPhone} onChange={e => setNewConvPhone(e.target.value)}
                placeholder="e.g. 917506419340"
                style={{ width: '100%', marginTop: 4, padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }} />
            </label>
            <label className="field" style={{ marginBottom: 16, display: 'block' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Message (optional)</span>
              <textarea value={newConvText} onChange={e => setNewConvText(e.target.value)}
                placeholder="Type your first message..." rows={3}
                style={{ width: '100%', marginTop: 4, padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box', resize: 'vertical' }} />
            </label>
            <button onClick={handleNewConv} disabled={sendingNew || !newConvPhone.trim()}
              style={{ width: '100%', padding: '10px', background: '#25D366', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: sendingNew ? 'not-allowed' : 'pointer' }}>
              {sendingNew ? 'Starting...' : 'Start Conversation'}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
