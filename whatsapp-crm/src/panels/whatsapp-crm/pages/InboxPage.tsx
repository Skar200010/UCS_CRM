import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Loader2, Check, CheckCheck, XCircle, MessageSquare, Search, Plus, X, Send } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import type { Message, WhatsAppPhoneNumber } from 'shared';
import { ConversationLabels, LabelFilter } from '../components/chat/ConversationLabels';
import { MessageSearchModal } from '../components/chat/MessageSearch';
import { MessageComposer } from '../components/chat/MessageComposer';
import { QuickReplyBar } from '../components/chat/QuickReplyBar';
import { MediaPreview } from '../components/chat/MediaPreview';

function MessageStatusIcon({ status }: { status: string }) {
  if (status === 'sent') return <Check className="h-3.5 w-3.5 text-muted-foreground" />;
  if (status === 'delivered') return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />;
  if (status === 'read') return <CheckCheck className="h-3.5 w-3.5 text-blue-500" />;
  if (status === 'failed') return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  if (status === 'queued') return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
  return null;
}

export function InboxPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [showNewConv, setShowNewConv] = useState(false);
  const [newConvPhone, setNewConvPhone] = useState('');
  const [newConvContactId, setNewConvContactId] = useState<string | null>(null);
  const [newConvMessage, setNewConvMessage] = useState('');
  const [newConvPhoneId, setNewConvPhoneId] = useState('');
  const [creatingConv, setCreatingConv] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations, isLoading: loadingConvs } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      let query = supabase
        .from('conversations')
        .select('*, contact:contacts(*)')
        .order('last_message_at', { ascending: false, nullsFirst: false });
      if (selectedLabel) {
        query = query.contains('labels', [selectedLabel]);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });

  const { data: messages, isLoading: loadingMsgs } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!conversationId,
  });

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, queryClient]);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`conversation-new:${user?.tenant_id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'conversations',
        filter: `tenant_id=eq.${user?.tenant_id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.tenant_id, conversationId, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const { data: contacts } = useQuery({
    queryKey: ['contacts-list'],
    queryFn: async () => {
      const { data } = await supabase.from('contacts').select('id, first_name, last_name, phone').order('created_at', { ascending: false }).limit(100);
      return data || [];
    },
  });

  const { data: phoneNumbers } = useQuery<WhatsAppPhoneNumber[]>({
    queryKey: ['whatsapp-phone-numbers'],
    queryFn: async () => {
      const { data } = await supabase.from('whatsapp_phone_numbers').select('*').eq('tenant_id', user?.tenant_id).order('is_primary', { ascending: false });
      return data as WhatsAppPhoneNumber[] || [];
    },
  });

  const handleStartConversation = async () => {
    const phone = newConvPhone.trim();
    if (!phone) { toast.error('Enter a phone number'); return; }
    if (!newConvPhoneId) { toast.error('Select a WhatsApp number to send from'); return; }
    setCreatingConv(true);
    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session) {
        toast.error('Not authenticated');
        setCreatingConv(false);
        return;
      }

      let contactId = newConvContactId;
      if (!contactId) {
        const phoneNormalized = phone.replace(/[^0-9]/g, '');
        const { data: existing } = await supabase.from('contacts').select('id').eq('phone_normalized', phoneNormalized).maybeSingle();
        if (existing) {
          contactId = existing.id;
        } else {
          const { data: newContact, error: createError } = await supabase.from('contacts').insert({
            tenant_id: user?.tenant_id,
            phone,
            phone_normalized: phoneNormalized,
            source: 'manual',
          }).select().single();
          if (createError) throw createError;
          contactId = newContact.id;
        }
      }

      const { data: pn } = await supabase.from('whatsapp_phone_numbers').select('*').eq('id', newConvPhoneId).single();
      if (!pn) { toast.error('Phone number not found'); return; }

      const { data: conversation, error: convError } = await supabase.from('conversations').insert({
        tenant_id: user?.tenant_id,
        contact_id: contactId,
        phone_number_id: pn.id,
        status: 'open',
        source: 'manual',
        last_message_at: new Date().toISOString(),
      }).select('*, contact:contacts(*)').single();
      if (convError) throw convError;

      if (newConvMessage.trim()) {
        const { error: sendError } = await supabase.functions.invoke('send-message', {
          body: { conversationId: conversation.id, messageText: newConvMessage.trim() },
        });
        if (sendError) {
          await supabase.from('messages').insert({
            tenant_id: user?.tenant_id,
            conversation_id: conversation.id,
            contact_id: contactId,
            user_id: user?.id,
            direction: 'outbound',
            message_type: 'text',
            body_text: newConvMessage.trim(),
            status: 'failed',
            failure_reason: 'Failed to send',
            message_category: 'service',
          });
        }
      }

      setShowNewConv(false);
      setNewConvPhone('');
      setNewConvContactId(null);
      setNewConvMessage('');
      setNewConvPhoneId('');
      navigate(`/inbox/${conversation.id}`);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to start conversation');
    } finally {
      setCreatingConv(false);
    }
  };

  const selectedConversation = conversations?.find((c) => c.id === conversationId);

  return (<>
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      <div className="w-80 flex-shrink-0">
        <div className="mb-2 flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSearchOpen(true)} className="flex-1 justify-start gap-2 text-muted-foreground">
            <Search className="h-4 w-4" />
            <span className="text-xs">Search messages...</span>
          </Button>
        </div>
          <Card className="overflow-hidden">
          <CardHeader className="space-y-3 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Conversations</CardTitle>
            <Button size="sm" onClick={() => setShowNewConv(true)}><Plus className="h-4 w-4" /> New</Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-7 text-xs"
            />
          </div>
          <LabelFilter
            selectedLabel={selectedLabel}
            onSelect={setSelectedLabel}
            allLabels={conversations?.flatMap((c) => c.labels || []) || []}
          />
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto">
            {loadingConvs ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse border-b p-4">
                  <div className="mb-2 h-4 w-32 rounded bg-muted" />
                  <div className="h-3 w-24 rounded bg-muted" />
                </div>
              ))
            ) : conversations?.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => navigate(`/inbox/${conversation.id}`)}
                className={`w-full border-b p-4 text-left transition-colors hover:bg-accent ${
                  conversation.id === conversationId ? 'bg-accent' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium truncate">
                    {conversation.contact?.first_name} {conversation.contact?.last_name || conversation.contact?.phone}
                  </div>
                  {conversation.status === 'open' && (
                    <span className="ml-2 h-2 w-2 flex-shrink-0 rounded-full bg-green-500" />
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {conversation.status} · {conversation.contact?.phone}
                </div>
                {conversation.labels && conversation.labels.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {conversation.labels.slice(0, 3).map((label: string) => (
                      <span key={label} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {label}
                      </span>
                    ))}
                    {conversation.labels.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">+{conversation.labels.length - 3}</span>
                    )}
                  </div>
                )}
              </button>
            )) || (
              <div className="flex flex-col items-center gap-2 p-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8" />
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs">Messages from WhatsApp will appear here</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </div>

      <Card className="flex flex-1 flex-col overflow-hidden">
        {selectedConversation ? (
          <>
            <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {selectedConversation.contact?.first_name} {selectedConversation.contact?.last_name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {selectedConversation.contact?.phone}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ConversationLabels
                      conversationId={selectedConversation.id}
                      currentLabels={selectedConversation.labels || []}
                    />
                    <span className="rounded-full bg-muted px-3 py-1 text-xs capitalize text-muted-foreground">
                      {selectedConversation.status}
                    </span>
                  </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4">
              {loadingMsgs ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                      <div className={`animate-pulse rounded-lg p-3 ${
                        i % 2 === 0 ? 'bg-muted' : 'bg-primary/20'
                      }`}>
                        <div className={`h-4 rounded ${i % 2 === 0 ? 'w-48' : 'w-32'} bg-muted-foreground/20`} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {messages?.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className="group max-w-[70%]">
                        <div
                          className={cn(
                            'rounded-lg p-3',
                            message.direction === 'outbound'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{message.body_text}</p>
                          {message.media_url && (
                            <MediaPreview url={message.media_url} mimeType={message.media_mime_type} className="mt-1" />
                          )}
                          <div className="mt-1 flex items-center justify-end gap-1">
                            <span className="text-xs opacity-70">
                              {format(new Date(message.created_at), 'HH:mm')}
                            </span>
                            {message.direction === 'outbound' && (
                              <MessageStatusIcon status={message.status} />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
              {(!messages || messages.length === 0) && !loadingMsgs && (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  No messages yet. Start the conversation!
                </div>
              )}
            </CardContent>
            <QuickReplyBar
              conversationId={selectedConversation.id}
              onSent={() => {
                queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
                queryClient.invalidateQueries({ queryKey: ['conversations'] });
              }}
            />
            <MessageComposer
              conversationId={selectedConversation.id}
              tenantId={selectedConversation.tenant_id}
              contactId={selectedConversation.contact_id}
              userId={user?.id || ''}
              onMessageSent={() => {
                queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
                queryClient.invalidateQueries({ queryKey: ['conversations'] });
              }}
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <MessageSquare className="h-16 w-16" />
            <p className="text-lg font-medium">Select a conversation</p>
            <p className="text-sm">Choose a conversation from the left to start chatting</p>
          </div>
        )}
      </Card>
      </div>

      <MessageSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      {showNewConv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowNewConv(false)}>
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New Conversation</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowNewConv(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs">Contact</Label>
                <Input
                  placeholder="Search or enter phone number..."
                  value={newConvPhone}
                  onChange={(e) => {
                    setNewConvPhone(e.target.value);
                    setNewConvContactId(null);
                  }}
                />
                {newConvPhone.length > 2 && !newConvContactId && (
                  <div className="max-h-32 overflow-y-auto rounded border text-sm">
                    {contacts?.filter((c) =>
                      c.phone?.includes(newConvPhone) || `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().includes(newConvPhone.toLowerCase())
                    ).slice(0, 5).map((c) => (
                      <button
                        key={c.id}
                        className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent text-left"
                        onClick={() => {
                          setNewConvPhone(c.phone);
                          setNewConvContactId(c.id);
                        }}
                      >
                        <span className="font-medium">{c.first_name} {c.last_name}</span>
                        <span className="text-muted-foreground">{c.phone}</span>
                      </button>
                    )) || null}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Send From (WhatsApp Number)</Label>
                <select
                  value={newConvPhoneId}
                  onChange={(e) => setNewConvPhoneId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select a number...</option>
                  {phoneNumbers?.map((pn) => (
                    <option key={pn.id} value={pn.id}>
                      {(pn as any).label || pn.display_phone_number} ({pn.display_phone_number})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Initial Message (optional)</Label>
                <textarea
                  value={newConvMessage}
                  onChange={(e) => setNewConvMessage(e.target.value)}
                  placeholder="Type your first message..."
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <Button className="w-full" onClick={handleStartConversation} disabled={creatingConv}>
                {creatingConv ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Start Conversation
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
