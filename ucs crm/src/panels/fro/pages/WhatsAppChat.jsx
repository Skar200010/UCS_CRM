import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import {
  getConversations,
  getMessages,
  sendMessage as sendMsgApi,
  sendDirectMessage,
  markRead,
  getUnreadCount,
  getQuickReplies,
  getTemplates,
  sendTemplateMessage,
  searchMessages,
  uploadMedia,
} from '../api/whatsappSupabase'
import ConversationList from '../components/enhanced/ConversationList'
import { MessageList } from '../components/enhanced/MessageBubble'
import MessageComposer from '../components/enhanced/MessageComposer'
import QuickReplyBar from '../components/enhanced/QuickReplyBar'
import TemplateBar from '../components/enhanced/TemplateBar'
import MessageSearchModal from '../components/enhanced/MessageSearch'

const waQueryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 30, retry: 1 } },
})

function LoginForm({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError('')
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        const { data: agentData, error: agentErr } = await supabase
          .rpc('verify_agent', { p_email: email, p_password: password })

        if (agentErr || !agentData) {
          throw new Error(authError.message || 'Invalid credentials')
        }

        const userData = typeof agentData === 'string' ? JSON.parse(agentData) : agentData
        onLogin({
          id: userData.id,
          name: userData.name || email.split('@')[0],
          email: userData.email || email,
          role: userData.role || 'agent',
          tenant_id: userData.tenant_id || userData.id,
        })
        return
      }

      if (!data?.user) throw new Error('Login failed')

      const { data: dbUser } = await supabase
        .rpc('get_whatsapp_user', { p_id: data.user.id })

      const userInfo = dbUser
        ? (typeof dbUser === 'string' ? JSON.parse(dbUser) : dbUser)
        : null

      onLogin({
        id: userInfo?.id || data.user.id,
        name: userInfo?.name || userInfo?.first_name || email.split('@')[0],
        email: userInfo?.email || email,
        role: userInfo?.role || 'agent',
        tenant_id: userInfo?.tenant_id || data.user.id,
      })
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 180px)', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
      <div style={{ width: 360, padding: 32, background: '#fff', borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#25D36620', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#374151' }}>WhatsApp Login</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Enter your WhatsApp CRM credentials</div>
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
  )
}

function WhatsAppChatInner() {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)

  const [waUser, setWaUser] = useState(() => {
    try {
      const saved = localStorage.getItem('wa_user')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })
  const [activeConv, setActiveConv] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewConv, setShowNewConv] = useState(false)
  const [newConvPhone, setNewConvPhone] = useState('')
  const [newConvText, setNewConvText] = useState('')
  const [sendingNew, setSendingNew] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const { data: conversations = [], isLoading: loadingConv } = useQuery({
    queryKey: ['wa-conversations', waUser?.id],
    queryFn: () => getConversations(waUser.id),
    enabled: !!waUser?.id,
    refetchInterval: 30000,
  })

  const { data: messages = null, isLoading: loadingMsg } = useQuery({
    queryKey: ['wa-messages', activeConv?.id],
    queryFn: () => getMessages(activeConv.id),
    enabled: !!activeConv?.id,
    refetchInterval: 30000,
  })

  useEffect(() => {
    if (!waUser?.id) return
    getUnreadCount(waUser.id).then(d => setUnreadCount(d || 0)).catch(() => {})
    const interval = setInterval(() => {
      getUnreadCount(waUser.id).then(d => setUnreadCount(d || 0)).catch(() => {})
    }, 15000)
    return () => clearInterval(interval)
  }, [waUser?.id])

  useEffect(() => {
    if (!waUser?.id) return
    const params = new URLSearchParams(location.search)
    const phone = params.get('phone')
    if (!phone) return
    navigate(location.pathname, { replace: true })
    ;(async () => {
      try {
        const result = await sendDirectMessage(waUser.id, phone, 'Hello')
        if (result?.conversation) handleSelect(result.conversation)
      } catch {}
    })()
  }, [waUser?.id])

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (!activeConv?.id) return
    const channel = supabase
      .channel(`wa-messages:${activeConv.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConv.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['wa-messages', activeConv.id] })
        queryClient.invalidateQueries({ queryKey: ['wa-conversations'] })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConv.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['wa-messages', activeConv.id] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeConv?.id, queryClient])

  useEffect(() => {
    if (!waUser?.id) return
    const channel = supabase
      .channel(`wa-conversations:${waUser.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, () => {
        queryClient.invalidateQueries({ queryKey: ['wa-conversations'] })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, () => {
        queryClient.invalidateQueries({ queryKey: ['wa-conversations'] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [waUser?.id, queryClient])

  const handleSelect = useCallback(async (conv) => {
    setActiveConv(conv)
    try { await markRead(conv.id) } catch {}
    queryClient.invalidateQueries({ queryKey: ['wa-conversations'] })
  }, [queryClient])

  const handleSend = useCallback(async (text) => {
    if (!activeConv) return
    await sendMsgApi(activeConv.id, activeConv.contact_id, text, waUser?.id)
    queryClient.invalidateQueries({ queryKey: ['wa-messages', activeConv.id] })
    queryClient.invalidateQueries({ queryKey: ['wa-conversations'] })
  }, [activeConv, waUser?.id, queryClient])

  const handleSendMedia = useCallback(async (file) => {
    if (!activeConv || !waUser) return
    const uploadResult = await uploadMedia(waUser.id, file)
    const fileUrl = uploadResult?.url || uploadResult?.file_url
    if (!fileUrl) throw new Error('Upload failed - no URL returned')
    const type = file.type?.startsWith('image/') ? 'image'
      : file.type?.startsWith('video/') ? 'video'
      : file.type?.startsWith('audio/') ? 'audio'
      : 'document'
    await sendMsgApi(activeConv.id, activeConv.contact_id, file.name, waUser.id, fileUrl, type, file)
    queryClient.invalidateQueries({ queryKey: ['wa-messages', activeConv.id] })
    queryClient.invalidateQueries({ queryKey: ['wa-conversations'] })
  }, [activeConv, waUser, queryClient])

  const handleNewConv = useCallback(async () => {
    if (!newConvPhone.trim() || sendingNew || !waUser) return
    setSendingNew(true)
    try {
      const result = await sendDirectMessage(waUser.id, newConvPhone.trim(), newConvText.trim() || 'Hello')
      setShowNewConv(false)
      setNewConvPhone('')
      setNewConvText('')
      queryClient.invalidateQueries({ queryKey: ['wa-conversations'] })
      if (result.conversation) handleSelect(result.conversation)
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setSendingNew(false)
    }
  }, [newConvPhone, newConvText, sendingNew, waUser, queryClient, handleSelect])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('wa_user')
    setWaUser(null)
    setActiveConv(null)
  }

  const handleQuickReply = async (text) => {
    await handleSend(text)
  }

  const handleTemplateSent = async () => {
    if (activeConv) {
      queryClient.invalidateQueries({ queryKey: ['wa-messages', activeConv.id] })
    }
  }

  const contact = activeConv?.contact || {}
  const activeName = contact.wa_profile_name || contact.phone || 'Select a conversation'
  const activeProject = activeConv?.project || contact.project || ''
  const activeContactId = activeConv?.contact_id || contact.id

  if (!waUser) {
    return <LoginForm onLogin={(user) => { localStorage.setItem('wa_user', JSON.stringify(user)); setWaUser(user) }} />
  }

  return (
    <>
    <div style={{ display: 'flex', height: 'calc(100vh - 132px)', margin: '-24px', border: '1px solid #e5e7eb', overflow: 'hidden', background: '#fff' }}>
      {/* Sidebar */}
      <div style={{ width: 300, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>WhatsApp Chat</div>
              {unreadCount > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, background: '#25D366', color: '#fff', borderRadius: 10, padding: '1px 7px', lineHeight: '16px' }}>
                  {unreadCount}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setShowSearch(true)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, color: '#6b7280' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </button>
              <button onClick={handleLogout}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 11, color: '#dc2626', padding: '4px 6px' }}>
                Logout
              </button>
            </div>
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
            conversations={conversations}
            activeId={activeConv?.id}
            onSelect={handleSelect}
            loading={loadingConv}
            searchQuery={searchQuery}
          />
        </div>
      </div>

      {/* Main chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {activeConv ? (
          <>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                {activeName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{activeName}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{activeProject ? activeProject.toUpperCase() : 'WhatsApp'}</div>
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <MessageList messages={messages} messagesContainerRef={messagesContainerRef} messagesEndRef={messagesEndRef} />
            </div>

            <QuickReplyBar onSend={handleQuickReply} />

            <TemplateBar
              conversationId={activeConv?.id}
              contactId={activeContactId}
              project={activeProject}
              userId={waUser?.id}
              onSent={handleTemplateSent}
            />

            <MessageComposer onSend={handleSend} onSendMedia={handleSendMedia} />
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', gap: 12 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#25D36620', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>WhatsApp Chat</div>
            <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', maxWidth: 240, lineHeight: 1.5 }}>
              Select a conversation from the left or start a new one
            </div>
          </div>
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

    {showSearch && (
      <MessageSearchModal
        userId={waUser?.id}
        onClose={() => setShowSearch(false)}
        onSelectConversation={(convId) => {
          const conv = conversations.find(c => c.id === convId)
          if (conv) handleSelect(conv)
        }}
      />
    )}
  </>
  )
}

export default function WhatsAppChat() {
  return (
    <QueryClientProvider client={waQueryClient}>
      <WhatsAppChatInner />
    </QueryClientProvider>
  )
}
