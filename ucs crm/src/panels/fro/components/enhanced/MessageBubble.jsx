import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

function MessageStatusIcon({ status }) {
  if (status === 'queued' || status === 'sending') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#8696a0">
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8z"/>
        <path d="M12.5 7H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"/>
      </svg>
    )
  }
  if (status === 'sent') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#8696a0">
        <path d="M9 16.2l-3.5-3.5c-.4-.4-1-.4-1.4 0s-.4 1 0 1.4l4.2 4.2c.4.4 1 .4 1.4 0L20.3 7.7c.4-.4.4-1 0-1.4s-1-.4-1.4 0L9 16.2z"/>
      </svg>
    )
  }
  if (status === 'delivered') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#8696a0">
        <path d="M18 7.5c-.4-.4-1-.4-1.4 0L10 14.2l-2.6-2.6c-.4-.4-1-.4-1.4 0s-.4 1 0 1.4l3.3 3.3c.4.4 1 .4 1.4 0l7.3-7.3c.4-.4.4-1 0-1.4z"/>
      </svg>
    )
  }
  if (status === 'read') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#53bdeb">
        <path d="M18 7.5c-.4-.4-1-.4-1.4 0L10 14.2l-2.6-2.6c-.4-.4-1-.4-1.4 0s-.4 1 0 1.4l3.3 3.3c.4.4 1 .4 1.4 0l7.3-7.3c.4-.4.4-1 0-1.4z"/>
      </svg>
    )
  }
  if (status === 'failed') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
    )
  }
  return null
}

function TimeDisplay({ ts }) {
  if (!ts) return null
  const d = new Date(ts)
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function DateSeparator({ dateStr }) {
  if (!dateStr) return null
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  let label
  if (dateStr === today) label = 'Today'
  else if (dateStr === yesterday) label = 'Yesterday'
  else label = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '16px 0 8px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', background: '#f3f4f6', padding: '4px 12px', borderRadius: 8 }}>
        {label}
      </div>
    </div>
  )
}

function getMessageDate(ts) {
  if (!ts) return null
  return new Date(ts).toISOString().slice(0, 10)
}

function shouldGroup(prev, curr) {
  if (!prev || !curr) return false
  const sameSender = prev.direction === curr.direction
  const closeTime = new Date(curr.created_at) - new Date(prev.created_at) < 600000
  return sameSender && closeTime
}

function MediaFromMeta({ mediaId, mimeType }) {
  const [blobUrl, setBlobUrl] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: accounts } = await supabase
        .from('whatsapp_accounts')
        .select('access_token')
        .eq('is_active', true)
        .limit(1)
      if (!accounts?.[0] || cancelled) { setLoading(false); return }
      const token = accounts[0].access_token
      try {
        const infoRes = await fetch(`https://graph.facebook.com/v23.0/${mediaId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const info = await infoRes.json()
        if (cancelled || !info.url) { setLoading(false); return }
        const dlRes = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` } })
        if (cancelled || !dlRes.ok) { setLoading(false); return }
        const blob = await dlRes.blob()
        if (!cancelled) setBlobUrl(URL.createObjectURL(blob))
      } catch {} finally { if (!cancelled) setLoading(false) }
    })()
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [mediaId])

  if (loading) return <div style={{ padding: 8, textAlign: 'center', fontSize: 11, color: '#9ca3af' }}>Loading media...</div>
  if (!blobUrl) return null
  return <MediaContent url={blobUrl} mimeType={mimeType} />
}

function typeToMime(messageType) {
  if (messageType === 'image') return 'image/jpeg'
  if (messageType === 'video') return 'video/mp4'
  if (messageType === 'audio') return 'audio/ogg'
  if (messageType === 'document') return 'application/pdf'
  return ''
}

function MediaContent({ url, mimeType, messageType, name }) {
  if (!url) return null
  const mime = mimeType || typeToMime(messageType) || ''
  if (mime.startsWith('image/')) {
    return (
      <div style={{ borderRadius: 8, overflow: 'hidden', maxWidth: 300, margin: '4px 0' }}>
        <img src={url} alt="" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 8, cursor: 'pointer' }} onClick={() => window.open(url, '_blank')} />
      </div>
    )
  }
  if (mime.startsWith('video/')) {
    return (
      <div style={{ borderRadius: 8, overflow: 'hidden', maxWidth: 300, margin: '4px 0' }}>
        <video src={url} controls style={{ width: '100%', display: 'block', borderRadius: 8 }} />
      </div>
    )
  }
  if (mime.startsWith('audio/')) {
    return (
      <div style={{ borderRadius: 8, maxWidth: 300, margin: '4px 0', padding: 8, background: '#f3f4f6' }}>
        <audio src={url} controls style={{ width: '100%' }} />
      </div>
    )
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: '#f3f4f6', textDecoration: 'none', color: '#374151', fontSize: 12, fontWeight: 600, margin: '4px 0', maxWidth: 300 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || url.split('/').pop()}</span>
    </a>
  )
}

export function MessageBubble({ message, isFirst, isLast, isGroup, onContextMenu }) {
  const isOutbound = message.direction === 'outbound'
  const text = message.body_text || message.body || ''
  const hasMedia = !!(message.media_url || message.media_id)

  const bubbleStyle = {
    maxWidth: '75%',
    padding: hasMedia && !text ? '4px 4px 6px 4px' : '6px 10px 6px 10px',
    borderRadius: 8,
    background: isOutbound ? '#dcfce7' : '#f3f4f6',
    borderBottomRightRadius: isOutbound ? (isLast ? 4 : 8) : 8,
    borderBottomLeftRadius: isOutbound ? 8 : (isLast ? 4 : 8),
    borderTopRightRadius: isOutbound ? (isFirst ? 8 : 4) : 8,
    borderTopLeftRadius: isOutbound ? 8 : (isFirst ? 8 : 4),
    position: 'relative',
    wordBreak: 'break-word',
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isOutbound ? 'flex-end' : 'flex-start',
        marginBottom: isGroup ? 2 : 6,
        padding: '0 12px',
      }}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e, message) }}
    >
      <div style={bubbleStyle}>
        {hasMedia && (
          message.media_url
            ? <MediaContent url={message.media_url} mimeType={message.media_mime_type} messageType={message.message_type} name={text || ''} />
            : <MediaFromMeta mediaId={message.media_id} mimeType={message.media_mime_type || typeToMime(message.message_type)} />
        )}
        {text && (
          <div style={{ fontSize: 13, lineHeight: 1.45, color: '#111827', whiteSpace: 'pre-wrap', padding: hasMedia ? '2px 6px 0' : 0 }}>
            {text}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 2, padding: text || !hasMedia ? 0 : '0 4px' }}>
          <span style={{ fontSize: 10, color: '#9ca3af', lineHeight: 1 }}>
            <TimeDisplay ts={message.created_at} />
          </span>
          {isOutbound && <MessageStatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  )
}

export function MessageList({ messages, onContextMenu, messagesContainerRef, messagesEndRef }) {
  if (!messages) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: '#9ca3af' }}>Loading messages...</div>
      </div>
    )
  }
  if (messages.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="#d1d5db">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/>
          <path d="M11 7h2v4h-2zm0 6h2v2h-2z"/>
        </svg>
        <div style={{ fontSize: 13, color: '#9ca3af' }}>No messages yet</div>
        <div style={{ fontSize: 11, color: '#d1d5db' }}>Send a message to start the conversation</div>
      </div>
    )
  }

  const elements = []
  let lastDate = null
  let lastMsg = null

  messages.forEach((msg, i) => {
    const date = getMessageDate(msg.created_at)
    if (date && date !== lastDate) {
      elements.push(<DateSeparator key={`d-${date}`} dateStr={date} />)
      lastDate = date
    }
    const groupWithPrev = shouldGroup(lastMsg, msg)
    const groupWithNext = shouldGroup(msg, messages[i + 1])
    const isFirstInGroup = !groupWithPrev
    const isLastInGroup = !groupWithNext

    elements.push(
      <MessageBubble
        key={msg.id || i}
        message={msg}
        isFirst={isFirstInGroup}
        isLast={isLastInGroup}
        isGroup={groupWithPrev || groupWithNext}
        onContextMenu={onContextMenu}
      />
    )
    lastMsg = msg
  })

  return (
    <div ref={messagesContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
      {elements}
      <div ref={messagesEndRef} />
    </div>
  )
}
