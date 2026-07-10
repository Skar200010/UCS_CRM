import { api } from './auth'

export async function getConversations() {
  return api('/fro/whatsapp/conversations', { _prefix: 'ucs' })
}

export async function getMessages(conversationId) {
  return api(`/fro/whatsapp/conversations/${conversationId}/messages`, { _prefix: 'ucs' })
}

export async function sendMessage(conversationId, text) {
  return api(`/fro/whatsapp/conversations/${conversationId}/send`, {
    method: 'POST',
    body: JSON.stringify({ text }),
    _prefix: 'ucs',
  })
}

export async function markRead(conversationId) {
  return api(`/fro/whatsapp/conversations/${conversationId}/read`, {
    method: 'PUT',
    _prefix: 'ucs',
  })
}

export async function getUnreadCount() {
  return api('/fro/whatsapp/conversations/unread-count', { _prefix: 'ucs' })
}

export async function sendDirectMessage(phone, text) {
  return api('/fro/whatsapp/send-direct', {
    method: 'POST',
    body: JSON.stringify({ phone, text }),
    _prefix: 'ucs',
  })
}
