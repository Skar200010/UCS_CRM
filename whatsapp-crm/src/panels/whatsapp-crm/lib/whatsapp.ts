import { supabase } from './supabase';
import { toast } from 'sonner';

const META_API = 'https://graph.facebook.com/v23.0';

function isWithin24Hours(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < 24 * 60 * 60 * 1000;
}

async function getAccount(phoneNumberId?: string | null, userId?: string) {
  if (userId) {
    const { data: assignments } = await supabase
      .from('agent_phone_assignments')
      .select('account_id')
      .eq('user_id', userId);
    if (assignments && assignments.length > 0) {
      const accountIds = assignments.map((a: any) => a.account_id);
      const { data } = await supabase
        .from('whatsapp_accounts')
        .select('phone_number_id, access_token')
        .in('id', accountIds)
        .limit(1);
      if (data?.[0]) return data[0];
    }
  }
  let query = supabase.from('whatsapp_accounts').select('phone_number_id, access_token');
  if (phoneNumberId) query = query.eq('phone_number_id', phoneNumberId);
  else query = query.limit(1);
  const { data } = await query.limit(1);
  return data?.[0] || null;
}

async function uploadMedia(accessToken: string, phoneNumberId: string, file: File): Promise<string | null> {
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('file', file, file.name);
  form.append('type', file.type);
  try {
    const r = await fetch(`${META_API}/${phoneNumberId}/media`, {
      method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form,
    });
    const d = await r.json();
    return d.id || null;
  } catch { return null; }
}

async function trySend(phone_number_id: string, access_token: string, payload: any, conversationId: string, mediaId: string | null, mediaFile: File | null | undefined): Promise<boolean> {
  const res = await fetch(`${META_API}/${phone_number_id}/messages`, {
    method: 'POST', headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await res.json();
  if (res.ok && result.messages?.[0]?.id) {
    const updates: any = { status: 'sent', wa_message_id: result.messages[0].id, status_updated_at: new Date().toISOString() };
    if (mediaId) { updates.media_id = mediaId; updates.media_mime_type = mediaFile?.type; }
    await supabase.from('messages').update(updates).eq('conversation_id', conversationId).eq('status', 'queued');
    return true;
  }
  return false;
}

export async function sendWhatsAppMessage(
  conversationId: string,
  contactId: string,
  messageText?: string,
  mediaFile?: File | null,
  userId?: string,
): Promise<boolean> {
  try {
    const { data: conv } = await supabase.from('conversations').select('phone_number_id, last_inbound_at').eq('id', conversationId).maybeSingle();
    const { data: contact } = await supabase.from('contacts').select('phone_normalized').eq('id', contactId).maybeSingle();
    if (!contact?.phone_normalized) return false;

    const windowOpen = isWithin24Hours(conv?.last_inbound_at);

    let mediaId: string | null = null;
    let payload: any;
    let phone_number_id: string | undefined;
    let access_token: string | undefined;

    async function buildPayload(acct: { phone_number_id: string; access_token: string }) {
      phone_number_id = acct.phone_number_id;
      access_token = acct.access_token;
      if (mediaFile) {
        mediaId = await uploadMedia(access_token, phone_number_id, mediaFile);
        if (!mediaId) return null;
        const fileType = mediaFile.type.startsWith('image/') ? 'image' : mediaFile.type.startsWith('video/') ? 'video' : 'document';
        const p: any = { messaging_product: 'whatsapp', to: contact.phone_normalized, type: fileType, [fileType]: { id: mediaId } };
        if (messageText) p[fileType].caption = messageText;
        return p;
      }
      return { messaging_product: 'whatsapp', to: contact.phone_normalized, type: 'text', text: { body: messageText || '' } };
    }

    // Try assigned account first, then fallback to any account
    const accounts: { phone_number_id: string; access_token: string }[] = [];

    if (userId) {
      const { data: assignments } = await supabase.from('agent_phone_assignments').select('account_id').eq('user_id', userId);
      if (assignments && assignments.length > 0) {
        const ids = assignments.map((a: any) => a.account_id);
        const { data } = await supabase.from('whatsapp_accounts').select('phone_number_id, access_token').in('id', ids);
        if (data) accounts.push(...data);
      }
    }

    if (accounts.length === 0) {
      const account = conv?.phone_number_id
        ? (await supabase.from('whatsapp_accounts').select('phone_number_id, access_token').eq('phone_number_id', conv.phone_number_id).maybeSingle()).data
        : (await supabase.from('whatsapp_accounts').select('phone_number_id, access_token').limit(1).maybeSingle()).data;
      if (account) accounts.push(account);
    }

    for (const acct of accounts) {
      const p = await buildPayload(acct);
      if (!p) continue;
      if (await trySend(acct.phone_number_id, acct.access_token, p, conversationId, mediaId, mediaFile)) return true;
    }

    await supabase.from('messages').update({ status: 'failed', failure_reason: 'All accounts failed' }).eq('conversation_id', conversationId).eq('status', 'queued');
    return false;
  } catch {
    await supabase.from('messages').update({ status: 'failed', failure_reason: 'Network error' }).eq('conversation_id', conversationId).eq('status', 'queued');
    return false;
  }
}
