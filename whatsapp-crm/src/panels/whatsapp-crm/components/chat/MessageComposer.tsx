import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2 } from 'lucide-react';
import { sendWhatsAppMessage } from '../../lib/whatsapp';
import { MediaUploadPreview } from './MediaPreview';
import { sendWhatsAppMessage } from '../../lib/whatsapp';

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    if ((!text.trim() && !selectedFile) || sending) return;
    setSending(true);

    try {
      await supabase.from('messages').insert({
        tenant_id: tenantId,
        conversation_id: conversationId,
        contact_id: contactId,
        user_id: userId,
        direction: 'outbound',
        message_type: selectedFile ? (selectedFile.type.startsWith('image/') ? 'image' : 'document') : 'text',
        body_text: text.trim() || null,
        status: 'queued',
        message_category: 'service',
      });

      sendWhatsAppMessage(conversationId, contactId || '', text.trim() || undefined, selectedFile);

      setText('');
      setSelectedFile(null);
      onMessageSent();
    } catch (err) {
      console.error('Send error:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-[#f0f2f5] px-4 py-2">
      {selectedFile && (
        <div className="mb-2">
          <MediaUploadPreview file={selectedFile} onRemove={() => setSelectedFile(null)} />
        </div>
      )}
      <div className="flex items-center gap-2">
        <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) { if (f.size > 16 * 1024 * 1024) { alert('Max 16MB'); return; } setSelectedFile(f); } e.target.value = ''; }} className="hidden" />
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
        <button onClick={handleSend} disabled={(!text.trim() && !selectedFile) || sending} className="shrink-0">
          {sending ? <Loader2 className="h-6 w-6 animate-spin text-[#8696a0]" /> : (
            <svg viewBox="0 0 24 24" width="26" height="26" fill={text.trim() || selectedFile ? '#00a884' : '#8696a0'}>
              <path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
