import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Image, FileText, QrCode, MessageSquare, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { QuickReply } from 'shared';

interface QuickReplyBarProps {
  conversationId: string;
  onSent: () => void;
}

const NGO_LABELS = [
  { value: 'ngo-a', label: 'NGO A', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'ngo-b', label: 'NGO B', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'ngo-c', label: 'NGO C', color: 'bg-purple-100 text-purple-700 border-purple-200' },
];

const CATEGORIES = [
  { value: 'info', label: 'Info', icon: MessageSquare },
  { value: 'qr', label: 'QR Code', icon: QrCode },
  { value: 'receipt', label: 'Receipt', icon: FileText },
  { value: 'general', label: 'Other', icon: Image },
] as const;

export function QuickReplyBar({ conversationId, onSent }: QuickReplyBarProps) {
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const { data: quickReplies, isLoading } = useQuery<QuickReply[]>({
    queryKey: ['quick-replies', activeLabel, activeCategory],
    queryFn: async () => {
      let query = supabase
        .from('quick_replies')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .order('name');

      if (activeLabel) query = query.eq('label', activeLabel);
      if (activeCategory) query = query.eq('category', activeCategory);

      const { data, error } = await query;
      if (error) throw error;
      return data as QuickReply[];
    },
  });

  const handleSend = async (reply: QuickReply) => {
    setSendingId(reply.id);
    try {
      const { error } = await supabase.functions.invoke('send-message', {
        body: {
          conversationId,
          messageText: reply.message_text || '',
          mediaUrl: reply.media_url || undefined,
          mediaMimeType: reply.media_type || undefined,
        },
      });
      if (!error) onSent();
    } catch (err) {
      console.error('Quick reply send error:', err);
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="border-t bg-card px-4 py-2">
      {/* NGO Label Pills */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {NGO_LABELS.map((ngo) => (
          <button
            key={ngo.value}
            onClick={() => setActiveLabel(activeLabel === ngo.value ? null : ngo.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
              activeLabel === ngo.value
                ? ngo.color + ' ring-2 ring-offset-1'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {ngo.label}
          </button>
        ))}
      </div>

      {/* Category Tabs */}
      <div className="mb-2 flex gap-1">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(activeCategory === cat.value ? null : cat.value)}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                activeCategory === cat.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {cat.label}
            </button>
          );
        })}
        {(activeLabel || activeCategory) && (
          <button
            onClick={() => { setActiveLabel(null); setActiveCategory(null); }}
            className="ml-auto rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
          >
            Clear
          </button>
        )}
      </div>

      {/* Quick Reply Buttons */}
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
        ) : (
          <p className="text-xs text-muted-foreground">
            {activeLabel || activeCategory
              ? 'No quick replies for this selection'
              : 'Select an NGO and category above to see quick replies'}
          </p>
        )}
      </div>
    </div>
  );
}
