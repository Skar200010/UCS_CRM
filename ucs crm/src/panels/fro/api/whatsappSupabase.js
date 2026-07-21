import { supabase } from '../lib/supabase'

function isWithin24Hours(dateStr) {
  if (!dateStr) return false
  return Date.now() - new Date(dateStr).getTime() < 24 * 60 * 60 * 1000
}

export async function getConversations(userId) {
  let query = supabase
    .from('conversations')
    .select('*, contact:contacts(*)')

  const { data: assign } = await supabase
    .from('agent_phone_assignments')
    .select('account_id')
    .eq('user_id', userId)

  if (assign && assign.length > 0) {
    const ids = assign.map(a => a.account_id)
    const { data: accts } = await supabase
      .from('whatsapp_accounts')
      .select('project')
      .in('id', ids)
    if (accts) {
      const projects = accts.map(a => a.project).filter(Boolean)
      if (projects.length > 0) {
        query = query.in('project', projects)
        query = query.eq('assigned_agent_id', userId)
      } else {
        query = query.eq('assigned_agent_id', userId)
      }
    }
  } else {
    query = query.eq('assigned_agent_id', userId)
  }

  const { data, error } = await query
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (error) throw error

  const seen = new Map()
  for (const c of data || []) {
    const key = c.contact_id + '|' + (c.project || '')
    if (!seen.has(key) || new Date(c.last_message_at) > new Date(seen.get(key).last_message_at)) {
      seen.set(key, c)
    }
  }
  return Array.from(seen.values())
}

export async function getUnreadCount(userId) {
  const conversations = await getConversations(userId)
  return conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0)
}

export async function getMessages(conversationId) {
  const { data: conv } = await supabase
    .from('conversations')
    .select('contact_id, project')
    .eq('id', conversationId)
    .maybeSingle()

  if (!conv?.contact_id) return []

  let q = supabase.from('conversations').select('id').eq('contact_id', conv.contact_id)
  if (conv.project) q = q.eq('project', conv.project)

  const { data: allConvs } = await q
  const ids = (allConvs || []).map(c => c.id)
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .in('conversation_id', ids)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

export async function markRead(conversationId) {
  await supabase.from('conversations').update({ unread_count: 0 }).eq('id', conversationId)
}

export async function sendMessage(conversationId, contactId, messageText, userId, mediaUrl, mediaType) {
  const { data: conv } = await supabase
    .from('conversations')
    .select('last_inbound_at')
    .eq('id', conversationId)
    .maybeSingle()

  const { data: contact } = await supabase
    .from('contacts')
    .select('phone_normalized')
    .eq('id', contactId)
    .maybeSingle()

  if (!contact?.phone_normalized) throw new Error('Contact phone not found')

  const windowOpen = isWithin24Hours(conv?.last_inbound_at)
  const isMedia = !!mediaUrl
  const msgType = isMedia ? (mediaType || 'image') : 'text'

  const { data: msg, error: msgErr } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      contact_id: contactId,
      user_id: userId || null,
      direction: 'outbound',
      message_type: msgType,
      body_text: isMedia ? '' : messageText,
      media_url: mediaUrl || null,
      status: 'queued',
    })
    .select()
    .single()

  if (msgErr) throw msgErr

  const accounts = []
  const { data: assignments } = await supabase
    .from('agent_phone_assignments')
    .select('account_id')
    .eq('user_id', userId)

  if (assignments && assignments.length > 0) {
    const ids = assignments.map(a => a.account_id)
    const { data } = await supabase
      .from('whatsapp_accounts')
      .select('phone_number_id, access_token')
      .in('id', ids)
    if (data) accounts.push(...data)
  }

  if (accounts.length === 0) {
    const { data } = await supabase
      .from('whatsapp_accounts')
      .select('phone_number_id, access_token')
    if (data) accounts.push(...data)
  }

  const payloads = []

  function mediaPayload() {
    const body = { messaging_product: 'whatsapp', to: contact.phone_normalized }
    if (msgType === 'image') {
      body.type = 'image'
      body.image = { link: mediaUrl }
    } else if (msgType === 'video') {
      body.type = 'video'
      body.video = { link: mediaUrl }
    } else if (msgType === 'audio') {
      body.type = 'audio'
      body.audio = { link: mediaUrl }
    } else {
      body.type = 'document'
      body.document = { link: mediaUrl, caption: messageText || '' }
    }
    return body
  }

  if (!windowOpen) {
    payloads.push({
      messaging_product: 'whatsapp',
      to: contact.phone_normalized,
      type: 'template',
      template: { name: 'hello_world', language: { code: 'en_US' } },
    })
    payloads.push(isMedia ? mediaPayload() : {
      messaging_product: 'whatsapp',
      to: contact.phone_normalized,
      type: 'text',
      text: { body: messageText },
    })
  } else {
    payloads.push(isMedia ? mediaPayload() : {
      messaging_product: 'whatsapp',
      to: contact.phone_normalized,
      type: 'text',
      text: { body: messageText },
    })
  }

  const metaApi = 'https://graph.facebook.com/v23.0'

  for (const acct of accounts) {
    for (const payload of payloads) {
      try {
        const res = await fetch(`${metaApi}/${acct.phone_number_id}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${acct.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
        const result = await res.json()
        if (res.ok && result.messages?.[0]?.id) {
          await supabase
            .from('messages')
            .update({
              status: 'sent',
              wa_message_id: result.messages[0].id,
              status_updated_at: new Date().toISOString(),
            })
            .eq('id', msg.id)
          await supabase
            .from('conversations')
            .update({ assigned_agent_id: userId, last_message_at: new Date().toISOString() })
            .eq('id', conversationId)
            .is('assigned_agent_id', null)
          return msg
        }
      } catch (e) {
        console.error('Meta send failed:', e)
      }
    }
  }

  await supabase
    .from('messages')
    .update({ status: 'failed', failure_reason: 'All accounts failed' })
    .eq('id', msg.id)

  throw new Error('Failed to send message')
}

export async function sendDirectMessage(userId, phone, messageText) {
  const phoneNormalized = String(phone).replace(/[^0-9]/g, '')

  let { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('phone_normalized', phoneNormalized)
    .maybeSingle()

  if (!contact) {
    const { data: newContact, error } = await supabase
      .from('contacts')
      .insert({ phone, phone_normalized: phoneNormalized, source: 'manual' })
      .select()
      .single()
    if (error) throw error
    contact = newContact
  }

  const { data: existingConv } = await supabase
    .from('conversations')
    .select('*')
    .eq('contact_id', contact.id)
    .eq('status', 'open')
    .maybeSingle()

  let conversation = existingConv
  if (!conversation) {
    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({
        contact_id: contact.id,
        status: 'open',
        assigned_agent_id: userId,
        last_message_at: new Date().toISOString(),
      })
      .select('*, contact:contacts(*)')
      .single()
    if (error) throw error
    conversation = newConv
  }

  await sendMessage(conversation.id, contact.id, messageText, userId)

  const { data: fullConv } = await supabase
    .from('conversations')
    .select('*, contact:contacts(*)')
    .eq('id', conversation.id)
    .single()

  return { conversation: fullConv }
}

export async function getQuickReplies() {
  const { data } = await supabase
    .from('quick_replies')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  return data || []
}

export async function getTemplates(project) {
  let query = supabase
    .from('whatsapp_templates')
    .select('*')
    .in('status', ['approved', 'APPROVED'])
    .order('name', { ascending: true })
  if (project) query = query.eq('project', project)
  const { data } = await query
  return data || []
}

export async function sendTemplateMessage(conversationId, contactId, template, paramValues, userId) {
  const { data: contact } = await supabase
    .from('contacts')
    .select('phone_normalized')
    .eq('id', contactId)
    .maybeSingle()

  if (!contact?.phone_normalized) throw new Error('Contact phone not found')

  const msgId = crypto.randomUUID()

  await supabase.from('messages').insert({
    id: msgId,
    conversation_id: conversationId,
    contact_id: contactId,
    user_id: userId,
    direction: 'outbound',
    message_type: 'template',
    body_text: template.name,
    template_id: String(template.id),
    template_params: paramValues,
    status: 'queued',
    message_category: 'service',
  })

  const accounts = []
  const { data: assignments } = await supabase
    .from('agent_phone_assignments')
    .select('account_id')
    .eq('user_id', userId)

  if (assignments && assignments.length > 0) {
    const ids = assignments.map(a => a.account_id)
    const { data } = await supabase
      .from('whatsapp_accounts')
      .select('phone_number_id, access_token, waba_id')
      .in('id', ids)
    if (data) accounts.push(...data)
  }

  if (accounts.length === 0) {
    const { data } = await supabase
      .from('whatsapp_accounts')
      .select('phone_number_id, access_token, waba_id')
    if (data) accounts.push(...data)
  }

  const paramArray = Array.isArray(paramValues) ? paramValues : Object.values(paramValues || {})
  const components = template.components?.length
    ? template.components
        .filter(c => c.type !== 'BUTTON')
        .map(c => {
          const text = c.text || ''
          const match = text.match(/\{\{(\d+)\}\}/g)
          if (!match) return null
          const params = match.map((m, i) => ({
            type: 'text',
            text: paramArray[i] || '',
          }))
          return params.length > 0 ? { type: c.type, parameters: params } : null
        })
        .filter(Boolean)
    : []

  const metaApi = 'https://graph.facebook.com/v23.0'

  for (const acct of accounts) {
    try {
      const payload = {
        messaging_product: 'whatsapp',
        to: contact.phone_normalized,
        type: 'template',
        template: {
          name: template.name,
          language: { code: template.language || 'en' },
        },
      }
      if (components.length > 0) payload.template.components = components

      const res = await fetch(`${metaApi}/${acct.phone_number_id}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${acct.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const result = await res.json()

      if (res.ok && result.messages?.[0]?.id) {
        await supabase
          .from('messages')
          .update({
            status: 'sent',
            wa_message_id: result.messages[0].id,
            status_updated_at: new Date().toISOString(),
          })
          .eq('id', msgId)
        return true
      }
    } catch (e) {
      console.error('Template send failed:', e)
    }
  }

  await supabase
    .from('messages')
    .update({ status: 'failed', failure_reason: 'Template send failed' })
    .eq('id', msgId)

  throw new Error('Failed to send template')
}

export async function searchMessages(userId, query) {
  const conversations = await getConversations(userId)
  const convIds = conversations.map(c => c.id)
  if (convIds.length === 0) return []

  const { data } = await supabase
    .from('messages')
    .select('*, contact:contacts!inner(id, phone, phone_normalized, wa_profile_name, project)')
    .in('conversation_id', convIds)
    .ilike('body_text', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(50)

  return data || []
}

export async function updateLabels(conversationId, labels) {
  await supabase.from('conversations').update({ labels }).eq('id', conversationId)
}

export async function uploadMedia(userId, file) {
  const fileName = `fro_${userId}_${Date.now()}_${file.name}`
  const bucket = 'whatsapp-media'

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(fileName, file, { contentType: file.type, upsert: false })

  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName)

  const { data: record, error } = await supabase
    .from('media_library')
    .insert({
      name: file.name,
      file_url: urlData.publicUrl,
      file_type: file.type,
      file_size: file.size,
      uploaded_by: userId,
    })
    .select()
    .single()

  if (error) throw error
  return record
}
