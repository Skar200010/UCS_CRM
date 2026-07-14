import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Search, MessageSquare, X, Loader2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import type { Message } from 'shared';

export function MessageSearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<(Message & { contact?: { first_name: string; last_name: string; phone: string } })[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*, contact:contacts(first_name, last_name, phone)')
        .ilike('body_text', `%${query.trim()}%`)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setResults(data || []);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const goToConversation = (convId: string) => {
    onClose();
    navigate(`/inbox/${convId}`);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-16">
      <div className="w-full max-w-2xl rounded-lg border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">Search Messages</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search message content..."
              className="pl-10"
              autoFocus
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={handleSearch} disabled={!query.trim() || loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto border-t">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : results.length > 0 ? (
            <div className="divide-y">
              {results.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => goToConversation(msg.conversation_id)}
                  className="w-full px-4 py-3 text-left transition-colors hover:bg-accent"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {(msg as any).contact?.first_name} {(msg as any).contact?.last_name || (msg as any).contact?.phone}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(msg.created_at), 'MMM d, HH:mm')}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {msg.body_text}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="capitalize">{msg.direction}</span>
                    <span>·</span>
                    <span className="capitalize">{msg.status}</span>
                    <ExternalLink className="ml-auto h-3 w-3" />
                  </div>
                </button>
              ))}
            </div>
          ) : searched ? (
            <div className="py-12 text-center text-muted-foreground">
              <Search className="mx-auto mb-2 h-8 w-8" />
              <p>No messages found for "{query}"</p>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <p>Search across all your conversations</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
