import supabase from '../config/supabase.js';
import { getAccountByProject } from '../models/whatsappAccountModel.js';
import config from '../config/whatsappConfig.js';

export async function getFroConversations(froWorkerId) {
  const { data: assignments, error: assignErr } = await supabase
    .from('fro_assignments')
    .select('donor_id, fro_worker_id, donor_profiles!inner(mobile_number)')
    .eq('fro_worker_id', froWorkerId)
    .not('status', 'eq', 'reassigned');

  if (assignErr) throw assignErr;
  if (!assignments || assignments.length === 0) return [];

  const donorPhones = assignments
    .map(a => a.donor_profiles?.mobile_number)
    .filter(Boolean);

  const phoneVariants = new Set();
  for (const p of donorPhones) {
    const raw = String(p).replace(/[^0-9]/g, '');
    phoneVariants.add(raw);
    if (raw.startsWith('91') && raw.length === 12) {
      phoneVariants.add(raw.slice(2));
    } else if (raw.length === 10) {
      phoneVariants.add('91' + raw);
    }
  }

  if (phoneVariants.size === 0) return [];

  const phoneList = [...phoneVariants];

  const { data: contacts, error: contactErr } = await supabase
    .from('contacts')
    .select('id, phone, phone_normalized, wa_profile_name, project')
    .in('phone_normalized', phoneList);

  if (contactErr) throw contactErr;
  if (!contacts || contacts.length === 0) return [];

  const contactIds = contacts.map(c => c.id);

  const { data: conversations, error: convErr } = await supabase
    .from('conversations')
    .select('*, contact:contacts!inner(id, phone, phone_normalized, wa_profile_name, project)')
    .in('contact_id', contactIds)
    .order('last_message_at', { ascending: false });

  if (convErr) throw convErr;
  return conversations || [];
}

export async function getConversationMessages(conversationId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function sendFroReply(conversationId, froWorkerId, messageText) {
  const { data: conversation, error: convErr } = await supabase
    .from('conversations')
    .select('*, contact:contacts!inner(id, phone, phone_normalized, project)')
    .eq('id', conversationId)
    .single();

  if (convErr || !conversation) throw new Error('Conversation not found');

  const project = conversation.contact?.project || conversation.project || 'bsct';
  const recipientPhone = conversation.contact?.phone_normalized;

  if (!recipientPhone) throw new Error('Recipient phone not found');

  const account = await getAccountByProject(project);
  const accessToken = account?.access_token || config.accessToken;
  const phoneNumberId = account?.phone_number_id || config.phoneNumberId;

  if (!accessToken || !phoneNumberId) {
    throw new Error(`WhatsApp account not configured for project "${project}"`);
  }

  const { data: message, error: msgErr } = await supabase
    .from('messages')
    .insert({
      tenant_id: conversation.tenant_id,
      conversation_id: conversation.id,
      contact_id: conversation.contact_id,
      user_id: String(froWorkerId),
      direction: 'outbound',
      message_type: 'text',
      body_text: messageText,
      status: 'queued',
      message_category: 'fro_reply',
    })
    .select()
    .single();

  if (msgErr) throw msgErr;

  try {
    const response = await fetch(
      `https://graph.facebook.com/${config.apiVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipientPhone,
          type: 'text',
          text: { body: messageText },
        }),
      }
    );

    const result = await response.json();

    if (response.ok && result.messages?.[0]?.id) {
      await supabase
        .from('messages')
        .update({
          wa_message_id: result.messages[0].id,
          status: 'sent',
          status_updated_at: new Date().toISOString(),
        })
        .eq('id', message.id);
    } else {
      await supabase
        .from('messages')
        .update({
          status: 'failed',
          failure_reason: result.error?.message || 'Meta API error',
          status_updated_at: new Date().toISOString(),
        })
        .eq('id', message.id);
      throw new Error(result.error?.message || 'Failed to send');
    }
  } catch (apiErr) {
    await supabase
      .from('messages')
      .update({
        status: 'failed',
        failure_reason: apiErr instanceof Error ? apiErr.message : 'Network error',
        status_updated_at: new Date().toISOString(),
      })
      .eq('id', message.id);
    throw apiErr;
  }

  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  return message;
}

export async function sendDirectMessage(froWorkerId, phone, messageText) {
  const phoneNormalized = String(phone).replace(/[^0-9]/g, '');

  let contact = await findOrCreateContact(phoneNormalized);
  let conversation = await findOrCreateConversation(contact, froWorkerId);

  const { data: accountAssignment } = await supabase
    .from('fro_whatsapp_assignments')
    .select('whatsapp_accounts!inner(id, project, phone_number_id, access_token)')
    .eq('fro_worker_id', froWorkerId)
    .eq('is_active', true)
    .maybeSingle();

  const project = conversation.project || accountAssignment?.whatsapp_accounts?.project || 'bsct';
  const recipientPhone = phoneNormalized;

  let account;
  if (accountAssignment) {
    account = accountAssignment.whatsapp_accounts;
  } else {
    account = await getAccountByProject(project);
  }

  const accessToken = account?.access_token || config.accessToken;
  const phoneNumberId = account?.phone_number_id || config.phoneNumberId;

  if (!accessToken || !phoneNumberId) {
    throw new Error(`WhatsApp account not configured`);
  }

  const { data: message, error: msgErr } = await supabase
    .from('messages')
    .insert({
      tenant_id: conversation.tenant_id,
      conversation_id: conversation.id,
      contact_id: conversation.contact_id,
      user_id: String(froWorkerId),
      direction: 'outbound',
      message_type: 'text',
      body_text: messageText,
      status: 'queued',
      message_category: 'fro_reply',
    })
    .select()
    .single();

  if (msgErr) throw msgErr;

  try {
    const response = await fetch(
      `https://graph.facebook.com/${config.apiVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipientPhone,
          type: 'text',
          text: { body: messageText },
        }),
      }
    );

    const result = await response.json();

    if (response.ok && result.messages?.[0]?.id) {
      await supabase
        .from('messages')
        .update({
          wa_message_id: result.messages[0].id,
          status: 'sent',
          status_updated_at: new Date().toISOString(),
        })
        .eq('id', message.id);
    } else {
      await supabase
        .from('messages')
        .update({
          status: 'failed',
          failure_reason: result.error?.message || 'Meta API error',
          status_updated_at: new Date().toISOString(),
        })
        .eq('id', message.id);
      throw new Error(result.error?.message || 'Failed to send');
    }
  } catch (apiErr) {
    await supabase
      .from('messages')
      .update({
        status: 'failed',
        failure_reason: apiErr instanceof Error ? apiErr.message : 'Network error',
        status_updated_at: new Date().toISOString(),
      })
      .eq('id', message.id);
    throw apiErr;
  }

  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversation.id);

  const { data: fullConversation } = await supabase
    .from('conversations')
    .select('*, contact:contacts!inner(id, phone, phone_normalized, wa_profile_name, project)')
    .eq('id', conversation.id)
    .single();

  return { message, conversation: fullConversation };
}

async function findOrCreateContact(phoneNormalized) {
  const { data: existing } = await supabase
    .from('contacts')
    .select('*')
    .eq('phone_normalized', phoneNormalized)
    .maybeSingle();

  if (existing) return existing;

  const { data: newContact, error } = await supabase
    .from('contacts')
    .insert({
      phone: phoneNormalized,
      phone_normalized: phoneNormalized,
      source: 'fro_initiated',
    })
    .select()
    .single();

  if (error) throw error;
  return newContact;
}

async function findOrCreateConversation(contact, froWorkerId) {
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('contact_id', contact.id)
    .eq('status', 'open')
    .maybeSingle();

  if (existing) return existing;

  const { data: newConv, error } = await supabase
    .from('conversations')
    .insert({
      contact_id: contact.id,
      status: 'open',
      last_message_at: new Date().toISOString(),
      project: contact.project || null,
    })
    .select()
    .single();

  if (error) throw error;
  return newConv;
}

export async function markConversationRead(conversationId, froWorkerId) {
  const { error } = await supabase
    .from('conversations')
    .update({ unread_count: 0 })
    .eq('id', conversationId);

  if (error) throw error;
}

export async function getFroUnreadCount(froWorkerId) {
  const conversations = await getFroConversations(froWorkerId);
  return conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
}
