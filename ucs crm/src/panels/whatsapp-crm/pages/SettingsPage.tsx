import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { BatchUserImport } from '../components/admin/BatchUserImport';
import { Badge } from '../components/ui/Badge';
import { Plus, Pencil, Trash2, Save, QrCode, FileText, MessageSquare, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { QuickReply, MediaItem } from 'shared';
import { loadMetaCredentials, getCachedToken, getCachedWabaId, saveMetaCredentials, clearMetaCredentials } from '../lib/metaCredentials';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'team', label: 'Team' },
  { id: 'api-keys', label: 'API Keys' },
  { id: 'quick-replies', label: 'Quick Replies' },
  { id: 'media', label: 'Media Library' },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and NGO setup</p>
      </div>

      <div className="flex gap-2 border-b pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'general' && <GeneralSettings />}
      {activeTab === 'whatsapp' && <WhatsAppSettings />}
      {activeTab === 'team' && <TeamSettings />}
      {activeTab === 'api-keys' && <ApiKeysSettings />}
      {activeTab === 'quick-replies' && <QuickRepliesSettings />}
      {activeTab === 'media' && <MediaLibrarySettings />}
    </div>
  );
}

function GeneralSettings() {
  return (
    <Card>
      <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Profile settings will be available after login integration.</p>
      </CardContent>
    </Card>
  );
}

function WhatsAppSettings() {
  const [accessToken, setAccessToken] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      await loadMetaCredentials();
      setAccessToken(getCachedToken() || '');
      setWabaId(getCachedWabaId() || '');
      setLoaded(true);
    })();
  }, []);

  const handleSave = async () => {
    try {
      await saveMetaCredentials(accessToken, wabaId);
      toast.success('Meta API credentials saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    }
  };

  const handleClear = async () => {
    await clearMetaCredentials();
    setAccessToken('');
    setWabaId('');
    toast.success('Credentials cleared');
  };

  const handleTest = async () => {
    if (!accessToken || !wabaId) { toast.error('Enter both Access Token and WABA ID'); return; }
    setTesting(true);
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${wabaId}?fields=name`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Connected: ${data.name}`);
      } else {
        toast.error(data.error?.message || 'Connection failed');
      }
    } catch {
      toast.error('Failed to reach Meta API');
    } finally {
      setTesting(false);
    }
  };

  if (!loaded) return <div className="h-48 animate-pulse rounded-lg bg-muted" />;

  const hasToken = !!accessToken;
  const hasWaba = !!wabaId;

  return (
    <Card>
      <CardHeader><CardTitle>Meta API Configuration</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {hasToken && hasWaba && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Meta API credentials are configured
          </div>
        )}
        {(!hasToken || !hasWaba) && (
          <div className="flex items-center gap-2 rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-700">
            <XCircle className="h-4 w-4 shrink-0" /> Meta API not configured — some features require these credentials
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">WhatsApp Access Token</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showToken ? 'text' : 'password'}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="EAAT..."
                  className="pr-9 font-mono text-xs"
                />
                <button type="button" onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">WABA ID (WhatsApp Business Account ID)</Label>
            <Input value={wabaId} onChange={(e) => setWabaId(e.target.value)} placeholder="2529840587470683" />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave}><Save className="h-4 w-4" /> Save</Button>
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button variant="ghost" onClick={handleClear} className="text-destructive">Clear</Button>
          </div>
        </div>

        <div className="border-t pt-4 space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium">How to get these:</p>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Go to <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Meta Developer Portal</a> → Your App → WhatsApp → API Setup</li>
            <li>Copy the <strong>Temporary Access Token</strong> (or generate a permanent one)</li>
            <li>Your <strong>WABA ID</strong> is shown in the same section or in Business Manager → WhatsApp Accounts</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

function TeamSettings() {
  return (
    <div className="space-y-6">
      <BatchUserImport />
    </div>
  );
}

interface ApiKey {
  id: string;
  name: string;
  key: string;
  permissions: any;
  active: boolean;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

function ApiKeysSettings() {
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});

  const { data: keys } = useQuery<ApiKey[]>({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const { data, error } = await supabase.from('api_keys').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as ApiKey[];
    },
  });

  const handleGenerate = async () => {
    if (!newName) { toast.error('Name is required'); return; }
    try {
      const { data, error } = await supabase.from('api_keys').insert({ name: newName }).select().single();
      if (error) throw error;
      setNewKey(data.key);
      setNewName('');
      toast.success('API key generated');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    } catch (err: any) { toast.error(err.message || 'Failed to generate key'); }
  };

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from('api_keys').update({ active }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['api-keys'] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this API key?')) return;
    await supabase.from('api_keys').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['api-keys'] });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">API Keys</CardTitle>
          <Button size="sm" onClick={() => { setShowNew(!showNew); setNewKey(''); }}><Plus className="h-4 w-4" /> Generate Key</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {newKey && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" /> Key generated — copy it now. You won't see it again!
            </div>
            <div className="flex gap-2">
              <Input value={newKey} readOnly className="font-mono text-xs" />
              <Button size="sm" onClick={() => { navigator.clipboard.writeText(newKey); toast.success('Copied'); }}>Copy</Button>
            </div>
          </div>
        )}
        {showNew && !newKey && (
          <div className="flex gap-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., NGO A Integration" />
            <Button size="sm" onClick={handleGenerate}>Generate</Button>
          </div>
        )}
        <div className="space-y-2">
          {keys?.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No API keys yet. Generate one for external integrations.</p>}
          {keys?.map((k) => (
            <div key={k.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{k.name}</p>
                  {k.active ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge>}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {revealedKeys[k.id] ? (
                    <code className="text-[10px] font-mono text-muted-foreground">{k.key}</code>
                  ) : (
                    <code className="text-[10px] font-mono text-muted-foreground">{k.key.slice(0, 8)}...{k.key.slice(-4)}</code>
                  )}
                  <button className="text-[10px] text-primary underline" onClick={() => setRevealedKeys({ ...revealedKeys, [k.id]: !revealedKeys[k.id] })}>
                    {revealedKeys[k.id] ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Created {new Date(k.created_at).toLocaleDateString()}{k.last_used_at ? ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}` : ''}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => handleToggle(k.id, !k.active)} className="text-xs">
                  {k.active ? 'Deactivate' : 'Activate'}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(k.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t pt-3">
          <p className="text-xs text-muted-foreground font-medium">How to use:</p>
          <pre className="mt-1 text-[10px] bg-muted p-2 rounded overflow-x-auto">
{`curl -X POST https://tvijqgsfdsaoqroebkvz.supabase.co/functions/v1/send-message \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"conversationId":"...","messageText":"Hello"}'`}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickRepliesSettings() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<QuickReply | null>(null);
  const [newReply, setNewReply] = useState(false);

  const { data: replies } = useQuery<QuickReply[]>({
    queryKey: ['quick-replies-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quick_replies')
        .select('*')
        .order('label')
        .order('sort_order');
      if (error) throw error;
      return data as QuickReply[];
    },
  });

  const handleSave = async (reply: Partial<QuickReply>) => {
    if (!reply.name || !reply.message_text) {
      toast.error('Name and message are required');
      return;
    }
    try {
      if (editing) {
        await supabase.from('quick_replies').update(reply).eq('id', editing.id);
      } else {
        await supabase.from('quick_replies').insert(reply);
      }
      queryClient.invalidateQueries({ queryKey: ['quick-replies-all'] });
      setEditing(null);
      setNewReply(false);
      toast.success(editing ? 'Updated' : 'Created');
    } catch (error) {
      toast.error('Failed to save');
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('quick_replies').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['quick-replies-all'] });
    toast.success('Deleted');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Quick Reply Templates</CardTitle>
          <Button size="sm" onClick={() => { setNewReply(true); setEditing(null); }}>
            <Plus className="h-4 w-4" /> New
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {(newReply || editing) && (
          <QuickReplyForm
            reply={editing}
            onSave={handleSave}
            onCancel={() => { setNewReply(false); setEditing(null); }}
          />
        )}

        <div className="space-y-2">
          {replies?.map((reply) => (
            <div key={reply.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                {reply.category === 'qr' && <QrCode className="h-5 w-5 text-blue-600" />}
                {reply.category === 'receipt' && <FileText className="h-5 w-5 text-green-600" />}
                {reply.category === 'info' && <MessageSquare className="h-5 w-5 text-purple-600" />}
                <div>
                  <p className="text-sm font-medium">{reply.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {reply.label} · {reply.category}
                    {reply.message_text && ` · ${reply.message_text.slice(0, 50)}...`}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => { setEditing(reply); setNewReply(false); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(reply.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          )) || (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No quick replies yet. Create templates for your telecallers to use.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickReplyForm({ reply, onSave, onCancel }: {
  reply: QuickReply | null;
  onSave: (data: Partial<QuickReply>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(reply?.name || '');
  const [messageText, setMessageText] = useState(reply?.message_text || '');
  const [label, setLabel] = useState(reply?.label || 'general');
  const [category, setCategory] = useState(reply?.category || 'info');

  return (
    <div className="mb-4 rounded-lg border p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., NGO A - Info" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">NGO Label</Label>
          <select value={label} onChange={(e) => setLabel(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="general">General</option>
            <option value="ngo-a">NGO A</option>
            <option value="ngo-b">NGO B</option>
            <option value="ngo-c">NGO C</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Category</Label>
          <select value={category} onChange={(e) => setCategory(e.target.value as any)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="info">Info Message</option>
            <option value="qr">QR Code</option>
            <option value="receipt">Receipt</option>
            <option value="general">General</option>
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Message Text</Label>
        <textarea value={messageText} onChange={(e) => setMessageText(e.target.value)}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Type the message telecallers will send with one click..." />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={() => onSave({ name, message_text: messageText, label, category } as any)}>
          <Save className="h-4 w-4" /> {reply ? 'Update' : 'Create'}
        </Button>
      </div>
    </div>
  );
}

function MediaLibrarySettings() {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: mediaItems } = useQuery<MediaItem[]>({
    queryKey: ['media-library-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('media_library').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as MediaItem[];
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileName = `media-library/${Date.now()}_${file.name}`;
      await supabase.storage.from('whatsapp-media').upload(fileName, file);
      const { data: { publicUrl } } = supabase.storage.from('whatsapp-media').getPublicUrl(fileName);
      await supabase.from('media_library').insert({
        name: file.name,
        category: file.type.startsWith('image/') ? 'image' : 'document',
        file_url: publicUrl,
        file_type: file.type,
        file_size: file.size,
      });
      queryClient.invalidateQueries({ queryKey: ['media-library-all'] });
    } catch (error) {
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('media_library').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['media-library-all'] });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Media Library</CardTitle>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <Plus className="h-4 w-4" /> Upload
            <input type="file" accept="image/*,.pdf" onChange={handleUpload} className="hidden" disabled={uploading} />
          </label>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {mediaItems?.map((item) => (
            <div key={item.id} className="group relative overflow-hidden rounded-lg border">
              {item.file_type?.startsWith('image/') ? (
                <img src={item.file_url} alt={item.name} className="h-28 w-full object-cover" />
              ) : (
                <div className="flex h-28 items-center justify-center bg-muted">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="p-2">
                <p className="truncate text-xs">{item.name}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{item.category}</p>
              </div>
              <button
                onClick={() => handleDelete(item.id)}
                className="absolute right-1 top-1 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )) || (
            <div className="col-span-full py-8 text-center text-muted-foreground text-sm">
              No media uploaded. Upload QR codes and receipt templates here.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
