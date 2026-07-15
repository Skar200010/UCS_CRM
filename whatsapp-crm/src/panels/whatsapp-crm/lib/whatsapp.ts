import { supabase } from './supabase';
import { toast } from 'sonner';

const META_API = 'https://graph.facebook.com/v23.0';

function isWithin24Hours(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < 24 * 60 * 60 * 1000;
}

async function getAccount(phoneNumberId?: string | null) {
  let query = supabase
    .from('whatsapp_accounts')
    .select('phone_number_id, access_token')
    .eq('is_active', true);
  if (phoneNumberId) query = query.eq('phone_number_id', phoneNumberId);
  else query = query.order('is_default', { ascending: false });
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

export async function sendWhatsAppMessage(
  conversationId: string,
  contactId: string,
  messageText?: string,
  mediaFile?: File | null,
): Promise<boolean> {
  try {
    const { data: conv } = await supabase.from('conversations').select('phone_number_id, last_inbound_at').eq('id', conversationId).maybeSingle();
    const account = await getAccount(conv?.phone_number_id);
    if (!account) return false;
    const { phone_number_id, access_token } = account;

    const { data: contact } = await supabase.from('contacts').select('phone_normalized').eq('id', contactId).maybeSingle();
    if (!contact?.phone_normalized) return false;

    const windowOpen = isWithin24Hours(conv?.last_inbound_at);
    let payload: any;
    let mediaId: string | null = null;

    if (mediaFile) {
      mediaId = await uploadMedia(access_token, phone_number_id, mediaFile);
      if (!mediaId) return false;
      const fileType = mediaFile.type.startsWith('image/') ? 'image' : mediaFile.type.startsWith('video/') ? 'video' : 'document';
      payload = { messaging_product: 'whatsapp', to: contact.phone_normalized, type: fileType, [fileType]: { id: mediaId } };
      if (messageText) payload[fileType].caption = messageText;
    } else if (!windowOpen) {
      payload = { messaging_product: 'whatsapp', to: contact.phone_normalized, type: 'template', template: { name: 'hello_world', language: { code: 'en_US' } } };
    } else {
      payload = { messaging_product: 'whatsapp', to: contact.phone_normalized, type: 'text', text: { body: messageText || '' } };
    }

    const res = await fetch(`${META_API}/${phone_number_id}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json();

    if (res.ok && result.messages?.[0]?.id) {
      const updates: any = { status: 'sent', wa_message_id: result.messages[0].id, status_updated_at: new Date().toISOString() };
      if (mediaId) { updates.media_id = mediaId; updates.media_mime_type = mediaFile?.type; }
      await supabase.from('messages').update(updates).eq('conversation_id', conversationId).eq('status', 'queued');
      if (!windowOpen && !mediaFile) toast.info('Sent via template. Ask donor to reply to open chat.');
      return true;
    }

    await supabase.from('messages').update({ status: 'failed', failure_reason: result.error?.message || 'Meta API error' })
      .eq('conversation_id', conversationId).eq('status', 'queued');
    return false;
  } catch {
    await supabase.from('messages').update({ status: 'failed', failure_reason: 'Network error' })
      .eq('conversation_id', conversationId).eq('status', 'queued');
    return false;
  }
}
