import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Loader2, QrCode, FileText, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import type { QuickReply } from 'shared';
import { sendWhatsAppMessage } from '../../lib/whatsapp';
import { useAuthStore } from '../../stores/authStore';

interface QuickReplyBarProps {
  conversationId: string;
  onSent: () => void;
}

export function QuickReplyBar({ conversationId, onSent }: QuickReplyBarProps) {
  const { user } = useAuthStore();
  const [sendingId, setSendingId] = useState<string | null>(null);

  const { data: quickReplies, isLoading } = useQuery<QuickReply[]>({
    queryKey: ['quick-replies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quick_replies')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .order('name');
      if (error) return [];
      return data as QuickReply[];
    },
  });

  const handleSend = async (reply: QuickReply) => {
    setSendingId(reply.id);
    try {
      const { data: conv } = await supabase.from('conversations').select('contact_id').eq('id', conversationId).maybeSingle();
      if (conv?.contact_id) {
        sendWhatsAppMessage(conversationId, conv.contact_id, reply.message_text || '', undefined, user?.id);
      }
      onSent();
    } catch {
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="px-2 py-1">
      <div className="flex flex-wrap gap-1.5">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : quickReplies && quickReplies.length > 0 ? (
          quickReplies.map((reply) => (
            <Button
              key={reply.id}
              variant="outline"
              size="sm"
              onClick={() => handleSend(reply)}
              disabled={sendingId === reply.id}
              className="text-xs"
            >
              {sendingId === reply.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  {reply.category === 'qr' && <QrCode className="h-3.5 w-3.5" />}
                  {reply.category === 'receipt' && <FileText className="h-3.5 w-3.5" />}
                  {reply.category === 'info' && <MessageSquare className="h-3.5 w-3.5" />}
                </>
              )}
              {reply.name}
            </Button>
          ))
        ) : null}
      </div>
    </div>
  );
}
