import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getConversations,
  getMessages,
  sendMessage as sendMsgApi,
  sendDirectMessage,
  markRead,
  getUnreadCount,
  searchMessages,
  uploadMedia,
} from '../../api/whatsappSupabase'
import ConversationList from './ConversationList'
import { MessageList } from './MessageBubble'
import MessageComposer from './MessageComposer'
import QuickReplyBar from './QuickReplyBar'
import TemplateBar from './TemplateBar'
import MessageSearchModal from './MessageSearch'
import { MediaUploadPreview } from './MediaPreview'

export default function WhatsAppInbox({ waUser, onLogout, compact }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const bottomRef = useRef(null)

  const [activeConv, setActiveConv] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewConv, setShowNewConv] = useState(false)
  const [newConvPhone, setNewConvPhone] = useState('')
  const [newConvText, setNewConvText] = useState('')
  const [sendingNew, setSendingNew] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [mediaFile, setMediaFile] = useState(null)

  const height = compact ? '100%' : 'calc(100vh - 180px)'

  const { data: conversations = [], isLoading: loadingConv } = useQuery({
    queryKey: ['wa-conversations', waUser?.id],
    queryFn: () => getConversations(waUser.id),
    enabled: !!waUser?.id,
    refetchInterval: 15000,
  })

  const { data: messages = null } = useQuery({
    queryKey: ['wa-messages', activeConv?.id],
    queryFn: () => getMessages(activeConv.id),
    enabled: !!activeConv?.id,
    refetchInterval: 5000,
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
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSelect = useCallback(async (conv) => {
    setActiveConv(conv)
    setMediaFile(null)
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
    if (uploadResult?.file_url) {
      await sendMsgApi(activeConv.id, activeConv.contact_id, file.name, waUser.id)
      queryClient.invalidateQueries({ queryKey: ['wa-messages', activeConv.id] })
      queryClient.invalidateQueries({ queryKey: ['wa-conversations'] })
    }
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

  const handleQuickReply = async (text) => { await handleSend(text) }

  const contact = activeConv?.contact || {}
  const activeName = contact.wa_profile_name || contact.phone || 'Select a conversation'
  const activeProject = activeConv?.project || contact.project || ''
  const activeContactId = activeConv?.contact_id || contact.id

  return (
    <div style={{ display: 'flex', height, border: compact ? 'none' : '1px solid #e5e7eb', borderRadius: compact ? 0 : 12, overflow: 'hidden', background: '#fff' }}>
      {/* Sidebar */}
      <div style={{ width: 280, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>Inbox</div>
              {unreadCount > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, background: '#25D366', color: '#fff', borderRadius: 10, padding: '1px 7px', lineHeight: '16px' }}>
                  {unreadCount}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setShowSearch(true)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, color: '#6b7280' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </button>
              <button onClick={onLogout}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 11, color: '#dc2626', padding: '4px 6px' }}>
                Logout
              </button>
            </div>
          </div>
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            style={{ width: '100%', padding: '6px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box', outline: 'none' }} />
          <button onClick={() => setShowNewConv(true)}
            style={{ width: '100%', marginTop: 6, padding: '6px 10px', fontSize: 12, fontWeight: 600, background: '#25D366', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            + New Conversation
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <ConversationList conversations={conversations} activeId={activeConv?.id} onSelect={handleSelect} loading={loadingConv} searchQuery={searchQuery} />
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
              <div ref={bottomRef} />
              <MessageList messages={messages} />
              <div ref={bottomRef} />
            </div>
            {mediaFile && (
              <div style={{ padding: '4px 12px', borderTop: '1px solid #e5e7eb', background: '#fff' }}>
                <MediaUploadPreview file={mediaFile} onRemove={() => setMediaFile(null)} />
              </div>
            )}
            <QuickReplyBar onSend={handleQuickReply} />
            <TemplateBar conversationId={activeConv?.id} contactId={activeContactId} project={activeProject} userId={waUser?.id} onSent={() => queryClient.invalidateQueries({ queryKey: ['wa-messages', activeConv.id] })} />
            <MessageComposer onSend={handleSend} onSendMedia={handleSendMedia} />
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', gap: 12 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#25D36620', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>WhatsApp Chat</div>
            <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', maxWidth: 240, lineHeight: 1.5 }}>Select a conversation from the left or start a new one</div>
          </div>
        )}
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
                <input type="tel" value={newConvPhone} onChange={e => setNewConvPhone(e.target.value)} placeholder="e.g. 917506419340"
                  style={{ width: '100%', marginTop: 4, padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }} />
              </label>
              <label className="field" style={{ marginBottom: 16, display: 'block' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Message (optional)</span>
                <textarea value={newConvText} onChange={e => setNewConvText(e.target.value)} placeholder="Type your first message..." rows={3}
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
        <MessageSearchModal userId={waUser?.id} onClose={() => setShowSearch(false)}
          onSelectConversation={(convId) => { const conv = conversations.find(c => c.id === convId); if (conv) handleSelect(conv) }} />
      )}
    </div>
  )
}
