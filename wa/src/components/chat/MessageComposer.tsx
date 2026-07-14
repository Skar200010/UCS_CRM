import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Send, Loader2, Image } from 'lucide-react';
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    if ((!text.trim() && !selectedFile) || sending) return;
    setSending(true);

    try {
      let mediaUrl: string | null = null;
      let mediaMimeType: string | null = null;

      if (selectedFile) {
        const fileName = `${tenantId}/${conversationId}/${Date.now()}_${selectedFile.name}`;
          const { error: uploadError } = await supabase.storage
          .from('whatsapp-media')
          .upload(fileName, selectedFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('whatsapp-media')
          .getPublicUrl(fileName);

        mediaUrl = publicUrl;
        mediaMimeType = selectedFile.type;
      }

      const { error } = await supabase.functions.invoke('send-message', {
        body: {
          conversationId,
          messageText: text.trim() || undefined,
          mediaUrl,
          mediaMimeType,
        },
      });

      if (error) {
        await supabase.from('messages').insert({
          tenant_id: tenantId,
          conversation_id: conversationId,
          contact_id: contactId,
          user_id: userId,
          direction: 'outbound',
          message_type: mediaUrl ? (mediaMimeType?.startsWith('image/') ? 'image' : 'document') : 'text',
          body_text: text.trim() || null,
          media_url: mediaUrl,
          media_mime_type: mediaMimeType,
          status: 'failed',
          failure_reason: 'Edge Function unavailable',
          message_category: 'service',
        });
      }

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
    <div className="border-t p-4">
      {selectedFile && (
        <div className="mb-2">
          <MediaUploadPreview file={selectedFile} onRemove={() => setSelectedFile(null)} />
        </div>
      )}
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              if (f.size > 16 * 1024 * 1024) { alert('Max 16MB'); return; }
              setSelectedFile(f);
            }
            e.target.value = '';
          }}
          className="hidden"
        />
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          title="Attach file"
        >
          <Image className="h-5 w-5 text-muted-foreground" />
        </Button>
        <Input
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          disabled={sending}
          className="flex-1"
        />
        <Button onClick={handleSend} disabled={(!text.trim() && !selectedFile) || sending}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
