import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Loader2, Check, CheckCheck, XCircle, MessageSquare, Search, Plus, X, Send, User, LogOut, Mail, Shield } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import type { Message, WhatsAppPhoneNumber } from 'shared';
import { ConversationLabels, LabelFilter } from '../components/chat/ConversationLabels';
import { MessageSearchModal } from '../components/chat/MessageSearch';
import { MessageComposer } from '../components/chat/MessageComposer';
import { sendWhatsAppMessage } from '../lib/whatsapp';
import { QuickReplyBar } from '../components/chat/QuickReplyBar';
import { MediaPreview, MediaFromMeta } from '../components/chat/MediaPreview';

const AVATAR_COLORS = ['#00a884','#5f9ea0','#d4a574','#8b7e74','#c97b84','#6fa8dc','#93c47d','#e69138'];
function avatarColor(name?: string) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = (name || '').charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function avatarLetter(name?: string) { return (name?.[0] || '?').toUpperCase(); }

function WAAvatar({ name, size = 'md' }: { waId?: string; name?: string; size?: 'sm' | 'md' }) {
  const px = size === 'sm' ? 'h-8 w-8' : 'h-12 w-12';
  return (
    <div className={`${px} shrink-0 flex items-center justify-center rounded-full bg-[#dfe5e7]`}>
      <svg viewBox="0 0 40 40" width={size === 'sm' ? '20' : '28'} height={size === 'sm' ? '20' : '28'} fill="#54656f">
        <path d="M20 20c4.42 0 8-3.58 8-8s-3.58-8-8-8-8 3.58-8 8 3.58 8 8 8zm0 4c-5.33 0-16 2.67-16 8v4h32v-4c0-5.33-10.67-8-16-8z"/>
      </svg>
    </div>
  );
}

function AgentMenu() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  return (
    <>
      <div className="relative">
        <button onClick={() => setOpen(!open)} className="text-[#54656f]"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 7a2 2 0 110-4 2 2 0 010 4zm0 7a2 2 0 110-4 2 2 0 010 4zm0 7a2 2 0 110-4 2 2 0 010 4z"/></svg></button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-8 z-50 w-44 rounded-lg border bg-white shadow-lg">
              <button onClick={() => { setOpen(false); setProfileOpen(true); }} className="flex w-full items-center gap-3 rounded-t-lg px-4 py-3 text-sm text-[#111b21] hover:bg-[#f0f2f5]">
                <User className="h-4 w-4 text-[#667781]" /> Profile
              </button>
              <button onClick={() => { setOpen(false); useAuthStore.getState().signOut(); navigate('/auth/login'); }} className="flex w-full items-center gap-3 rounded-b-lg px-4 py-3 text-sm text-red-500 hover:bg-[#f0f2f5]">
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          </>
        )}
      </div>
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </>
  );
}

function ProfileModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuthStore();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-80 rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00a884] text-2xl font-bold text-white">
            {(user?.first_name?.[0] || user?.email?.[0] || '?').toUpperCase()}
          </div>
          <p className="text-lg font-semibold text-[#111b21]">{user?.first_name} {user?.last_name}</p>
          <div className="flex items-center gap-2 text-sm text-[#667781]"><Mail className="h-4 w-4" /> {user?.email}</div>
          <div className="flex items-center gap-2 text-sm text-[#667781]"><Shield className="h-4 w-4" /> Role: <span className="capitalize font-medium text-[#111b21]">{user?.role}</span></div>
          <button onClick={onClose} className="mt-2 rounded-lg bg-[#00a884] px-6 py-1.5 text-sm font-medium text-white hover:bg-[#008f72]">Close</button>
        </div>
      </div>
    </div>
  );
}

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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleDeleteMsg = async (msgId: string) => {
    if (!confirm('Delete this message?')) return;
    const { error } = await supabase.rpc('delete_message', { p_id: msgId });
    if (!error) { queryClient.invalidateQueries({ queryKey: ['messages', conversationId] }); }
  };

  const { data: conversations, isLoading: loadingConvs } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*, contact:contacts(*)')
        .order('last_message_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      const seen = new Map<string, any>();
      for (const c of data || []) {
        const key = c.contact_id;
        if (!seen.has(key) || new Date(c.last_message_at) > new Date(seen.get(key).last_message_at)) {
          seen.set(key, c);
        }
      }
      return Array.from(seen.values());
    },
    refetchInterval: 10000,
  });

  const { data: messages, isLoading: loadingMsgs } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data: conv } = await supabase.from('conversations').select('contact_id').eq('id', conversationId).maybeSingle();
      if (!conv?.contact_id) return [];
      const { data: allConvs } = await supabase.from('conversations').select('id').eq('contact_id', conv.contact_id);
      const ids = (allConvs || []).map((c: any) => c.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .in('conversation_id', ids)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!conversationId,
    refetchInterval: 5000,
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
      const { data } = await supabase.from('contacts').select('id, wa_profile_name, phone, source').order('created_at', { ascending: false }).limit(100);
      return (data || []).map((c: any) => ({ ...c, first_name: c.wa_profile_name || c.phone, last_name: '' }));
    },
  });

  const { data: phoneNumbers } = useQuery<WhatsAppPhoneNumber[]>({
    queryKey: ['whatsapp-phone-numbers', user?.id],
    queryFn: async () => {
      if (user?.role === 'agent') {
        const { data: assignments } = await supabase
          .from('agent_phone_assignments')
          .select('account_id')
          .eq('user_id', user.id);
        if (!assignments || assignments.length === 0) return [];
        const accountIds = assignments.map((a: any) => a.account_id);
        const { data } = await supabase.from('whatsapp_accounts').select('*').in('id', accountIds);
        return (data || []).map((a: any) => ({ id: a.id, phone_number_id: a.phone_number_id, display_phone_number: a.phone_number_id, label: a.name, is_primary: a.is_default, status: a.is_active ? 'active' : 'inactive', tenant_id: '', verified_name: a.name, quality_rating: '', created_at: a.created_at })) as WhatsAppPhoneNumber[];
      }
      const { data } = await supabase.from('whatsapp_accounts').select('*');
      return (data || []).map((a: any) => ({ id: a.id, phone_number_id: a.phone_number_id, display_phone_number: a.phone_number_id, label: a.name, is_primary: a.is_default, status: a.is_active ? 'active' : 'inactive', tenant_id: '', verified_name: a.name, quality_rating: '', created_at: a.created_at })) as WhatsAppPhoneNumber[];
    },
    enabled: !!user,
  });

  const handleStartConversation = async () => {
    const phone = newConvPhone.trim();
    if (!phone) { toast.error('Enter a phone number'); return; }
    if (!newConvPhoneId) { toast.error('Select a WhatsApp number to send from'); return; }
    setCreatingConv(true);
    try {
      const token = localStorage.getItem('ucs_token');
      if (!token) {
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

      const { data: pn } = await supabase.from('whatsapp_accounts').select('*').eq('id', newConvPhoneId).single();
      if (!pn) { toast.error('Phone number not found'); return; }

      const { data: conversation, error: convError } = await supabase.from('conversations').insert({
        tenant_id: user?.tenant_id,
        contact_id: contactId,
        phone_number_id: pn.phone_number_id,
        status: 'open',
        source: 'manual',
        last_message_at: new Date().toISOString(),
      }).select('*, contact:contacts(*)').single();
      if (convError) throw convError;

      if (newConvMessage.trim()) {
        sendWhatsAppMessage(conversation.id, contactId, newConvMessage.trim(), undefined, user?.id);
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

  const isAgent = user?.role === 'agent';
  const WA_GREEN = '#00a884';
  const avatarColor = (name?: string) => {
    const colors = ['#00a884','#5f9ea0','#d4a574','#8b7e74','#c97b84','#6fa8dc','#93c47d','#e69138'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash = name!.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };
  const avatarLetter = (name?: string) => (name?.[0] || '?').toUpperCase();

  return (<>
    <div className={`flex w-full overflow-hidden ${isAgent ? 'h-screen' : 'h-full'}`}>
      {/* Conversation List */}
      <div className="w-80 max-md:w-16 border-r border-gray-200 bg-white flex-shrink-0 flex flex-col overflow-hidden">
        <div className="bg-[#f0f2f5] px-4 py-3.5 flex items-center justify-between">
          <span className="text-base font-semibold text-[#111b21]">Chats</span>
          <div className="flex gap-4">
            <button onClick={() => setShowNewConv(true)} className="text-[#54656f]"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></button>
            <button onClick={() => setSearchOpen(true)} className="text-[#54656f]"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 001.256-3.386 5.207 5.207 0 10-5.207 5.207 5.184 5.184 0 003.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.006zm-4.808 0a3.605 3.605 0 110-7.21 3.605 3.605 0 010 7.21z"/></svg></button>
            {isAgent && <AgentMenu />}
          </div>
        </div>
        <div className="px-3 py-2 bg-white">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#667781]" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 001.256-3.386 5.207 5.207 0 10-5.207 5.207 5.184 5.184 0 003.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.006zm-4.808 0a3.605 3.605 0 110-7.21 3.605 3.605 0 010 7.21z"/></svg>
            <input
              placeholder="Search or start new chat"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg bg-[#f0f2f5] py-1.5 pl-10 pr-3 text-sm outline-none placeholder-[#667781]"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {loadingConvs ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex animate-pulse items-center gap-3 px-4 py-3">
                <div className="h-12 w-12 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 rounded bg-gray-200" />
                  <div className="h-2 w-24 rounded bg-gray-200" />
                </div>
              </div>
            ))
          ) : conversations?.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-[#667781]">
              <MessageSquare className="h-8 w-8" />
              <p className="text-sm">No conversations yet</p>
            </div>
          ) : conversations?.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => navigate(`/inbox/${conversation.id}`)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#f0f2f5] ${
                conversation.id === conversationId ? 'bg-[#f0f2f5]' : ''
              }`}
            >
              <WAAvatar waId={conversation.contact?.phone_normalized} name={conversation.contact?.wa_profile_name} size="md" />
              <div className="min-w-0 flex-1" style={{ borderBottom: '1px solid #e9edef', paddingBottom: '12px', marginBottom: '-4px' }}>
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm font-medium text-[#111b21]">
                    {conversation.contact?.wa_profile_name || conversation.contact?.phone}
                  </span>
                  <span className="shrink-0 text-[11px] text-[#667781]">
                    {conversation.last_message_at ? format(new Date(conversation.last_message_at), 'HH:mm') : ''}
                  </span>
                </div>
                <p className="truncate text-[12.5px] text-[#667781]">{conversation.contact?.phone}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex flex-1 flex-col bg-[#efeae2]">
        {selectedConversation ? (
          <>
            <div className="bg-[#f0f2f5] px-4 py-2 flex items-center gap-3 border-l border-gray-200">
              <WAAvatar waId={selectedConversation.contact?.phone_normalized} name={selectedConversation.contact?.wa_profile_name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-medium text-[#111b21]">{selectedConversation.contact?.wa_profile_name || selectedConversation.contact?.phone}</p>
                <p className="text-[11.5px] text-[#667781]">{selectedConversation.contact?.phone}</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-2" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23d4d4d4\' fill-opacity=\'0.20\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}>
              {loadingMsgs ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                      <div className={`animate-pulse rounded-lg p-3 ${i % 2 === 0 ? 'bg-white' : 'bg-[#dcf8c6]'}`}>
                        <div className={`h-4 rounded ${i % 2 === 0 ? 'w-48' : 'w-32'} bg-gray-200`} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {messages?.map((message) => (
                    <div key={message.id} className={`group flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`relative max-w-[60%] px-3 py-2 text-[14.2px] shadow-sm leading-[19px] ${
                        message.direction === 'outbound'
                          ? 'bg-[#d9fdd3] rounded-lg rounded-br-sm'
                          : 'bg-white rounded-lg rounded-bl-sm'
                      }`}>
                        <p className="whitespace-pre-wrap break-words text-[#111b21]">{message.body_text}</p>
                        {message.media_url ? (
                          <div className="relative mt-1">
                            <img src={message.media_url} alt="" className="max-w-full max-h-60 rounded-lg cursor-pointer object-cover" onClick={() => { setPreviewUrl(message.media_url); setPreviewMime(message.media_mime_type); }} />
                          </div>
                        ) : message.media_id ? (
                          <div className="relative mt-1 cursor-pointer" onClick={() => { setPreviewUrl(message.media_id); setPreviewMime(message.media_mime_type); }}>
                            <MediaFromMeta mediaId={message.media_id} mimeType={message.media_mime_type} />
                          </div>
                        ) : null}
                        <div className="mt-1 flex items-center justify-end gap-1">
                          <span className="text-[10.5px] text-[#667781]">{format(new Date(message.created_at), 'HH:mm')}</span>
                          {message.direction === 'outbound' && <MessageStatusIcon status={message.status} />}
                          <button onClick={() => handleDeleteMsg(message.id)} className="hidden group-hover:inline text-[10px] text-red-400 hover:text-red-600 ml-1">delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
              {(!messages || messages.length === 0) && !loadingMsgs && (
                <div className="flex h-full items-center justify-center text-[#667781]">
                  <p className="text-sm">No messages yet</p>
                </div>
              )}
            </div>
            <QuickReplyBar conversationId={selectedConversation.id} onSent={() => { queryClient.invalidateQueries({ queryKey: ['messages', conversationId] }); queryClient.invalidateQueries({ queryKey: ['conversations'] }); }} />
            <MessageComposer conversationId={selectedConversation.id} tenantId={selectedConversation.tenant_id} contactId={selectedConversation.contact_id} userId={user?.id || ''} onMessageSent={() => { queryClient.invalidateQueries({ queryKey: ['messages', conversationId] }); queryClient.invalidateQueries({ queryKey: ['conversations'] }); }} />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[#667781] bg-[#f0f2f5]">
            <MessageSquare className="h-16 w-16 opacity-20" />
            <p className="text-base font-medium">WhatsApp CRM</p>
            <p className="text-sm">Select a chat to start messaging</p>
          </div>
        )}
      </div>
    </div>

    {previewUrl && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => { setPreviewUrl(null); setPreviewMime(undefined); }}>
        <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
          {previewMime?.startsWith('video/') ? (
            <video controls className="max-h-[80vh] rounded-lg" src={previewUrl} />
          ) : (
            <img src={previewUrl} alt="Preview" className="max-h-[80vh] rounded-lg object-contain" />
          )}
          <div className="absolute top-2 right-2 flex gap-2">
            <a href={previewUrl} download target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            </a>
            <button onClick={() => { setPreviewUrl(null); setPreviewMime(undefined); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
      </div>
    )}

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
              <Input placeholder="Search or enter phone number..." value={newConvPhone} onChange={(e) => { setNewConvPhone(e.target.value); setNewConvContactId(null); }} />
              {newConvPhone.length > 2 && !newConvContactId && (
                <div className="max-h-32 overflow-y-auto rounded border text-sm">
                  {contacts?.filter((c) => c.phone?.includes(newConvPhone) || (c.wa_profile_name || '').toLowerCase().includes(newConvPhone.toLowerCase())).slice(0, 5).map((c) => (
                    <button key={c.id} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent text-left" onClick={() => { setNewConvPhone(c.phone); setNewConvContactId(c.id); }}>
                      <span className="font-medium">{c.wa_profile_name || c.phone}</span>
                      <span className="text-muted-foreground">{c.phone}</span>
                    </button>
                  )) || null}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Send From</Label>
              <select value={newConvPhoneId} onChange={(e) => setNewConvPhoneId(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Select a number...</option>
                {phoneNumbers?.map((pn) => (<option key={pn.id} value={pn.id}>{(pn as any).label || pn.display_phone_number} ({pn.display_phone_number})</option>))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Initial Message (optional)</Label>
              <textarea value={newConvMessage} onChange={(e) => setNewConvMessage(e.target.value)} placeholder="Type your first message..." className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <Button className="w-full" onClick={handleStartConversation} disabled={creatingConv}>
              {creatingConv ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Start Conversation
            </Button>
          </div>
        </div>
      </div>
    )}
  </>);
}
