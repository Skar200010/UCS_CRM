import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2 } from 'lucide-react';
import { sendWhatsAppMessage } from '../../lib/whatsapp';
import { MediaUploadPreview } from './MediaPreview';

interface MessageComposerProps {
  conversationId: string;
  tenantId: string;
  contactId?: string;
  userId: string;
  onMessageSent: () => void;
}

export function MessageComposer({ conversationId, tenantId, contactId, userId, onMessageSent }: MessageComposerProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    if ((!text.trim() && selectedFiles.length === 0) || sending) return;
    setSending(true);

    try {
      const filesToSend = selectedFiles.length > 0 ? selectedFiles : [null as unknown as File];

      for (const file of filesToSend) {
        const msgType = file ? (file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'document') : 'text';
        const { data: msg, error: insertErr } = await supabase.from('messages').insert({
          tenant_id: tenantId,
          conversation_id: conversationId,
          contact_id: contactId,
          user_id: userId,
          direction: 'outbound',
          message_type: msgType,
          body_text: text.trim() || null,
          status: 'queued',
          message_category: 'service',
        }).select('id').single();

        if (insertErr) throw insertErr;

        await supabase.from('conversations').update({ assigned_agent_id: userId }).eq('id', conversationId).is('assigned_agent_id', null);

        if (file) {
          sendWhatsAppMessage(conversationId, contactId || '', file.name || undefined, file, userId, msg?.id);
        } else if (text.trim()) {
          sendWhatsAppMessage(conversationId, contactId || '', text.trim(), undefined, userId, msg?.id);
        }
      }

      setText('');
      setSelectedFiles([]);
      onMessageSent();
    } catch (err) {
      console.error('Send error:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-[#f0f2f5] px-4 py-2">
      {selectedFiles.length > 0 && (
        <div className="mb-2 flex gap-2 flex-wrap">
          {selectedFiles.map((file, i) => (
            <MediaUploadPreview key={i} file={file} onRemove={() => setSelectedFiles(prev => prev.filter((_, j) => j !== i))} />
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={(e) => { const files = Array.from(e.target.files || []); const valid = files.filter(f => { if (f.size > 16 * 1024 * 1024) { alert(`Max 16MB: ${f.name}`); return false; } return true; }); setSelectedFiles(prev => [...prev, ...valid]); e.target.value = ''; }} className="hidden" />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={sending} className="shrink-0">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#8696a0" strokeWidth="2"><path d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
        </button>
        <div className="flex-1 relative">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Type a message"
            disabled={sending}
            className="w-full rounded-lg border-0 bg-white px-3 py-2.5 text-sm outline-none ring-0 focus:ring-0"
          />
        </div>
        <button onClick={handleSend} disabled={(!text.trim() && selectedFiles.length === 0) || sending} className="shrink-0">
          {sending ? <Loader2 className="h-6 w-6 animate-spin text-[#8696a0]" /> : (
            <svg viewBox="0 0 24 24" width="26" height="26" fill={text.trim() || selectedFiles.length > 0 ? '#00a884' : '#8696a0'}>
              <path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
