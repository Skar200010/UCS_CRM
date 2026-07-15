import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Badge } from '../components/ui/Badge';
import {
  Phone, Smartphone, Loader2, Plus, X, Save, Pencil, Trash2,
  Building2, Hash, Key, Globe, Shield, CheckCircle2, AlertTriangle,
  RefreshCw, Eye, EyeOff, ExternalLink, Copy, Send,
} from 'lucide-react';
import { toast } from 'sonner';

interface WhatsAppAccount {
  id: number;
  name: string;
  project: string;
  phone_number_id: string;
  access_token: string;
  waba_id: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
}

interface LiveInfo {
  status: string;
  quality_rating: string | null;
  verified_name: string | null;
  display_phone_number: string | null;
  webhook: string | null;
  throughput_level: string | null;
}

const PROJECT_LABELS: Record<string, string> = {
  bsct: 'Being Sevak Charitable Trust',
  aflf: 'Ashray For Life Foundation',
  maan: 'Mann Care Foundation',
};

const PROJECT_COLORS: Record<string, string> = {
  bsct: 'bg-green-100 text-green-700 border-green-200',
  aflf: 'bg-blue-100 text-blue-700 border-blue-200',
  maan: 'bg-purple-100 text-purple-700 border-purple-200',
};

function maskToken(token: string): string {
  if (!token) return '—';
  if (token.length <= 20) return '••••••••';
  return token.slice(0, 12) + '••••' + token.slice(-8);
}

function AccountCard({
  account,
  live,
  loadingLive,
  onRefresh,
  onEdit,
  onDelete,
  onTestSend,
}: {
  account: WhatsAppAccount;
  live: LiveInfo | null;
  loadingLive: boolean;
  onRefresh: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTestSend: () => void;
}) {
  const [showToken, setShowToken] = useState(false);

  const statusVariant = live?.status === 'verified' ? 'success' : live?.status === 'pending' ? 'warning' : 'error';
  const qualityVariant = live?.quality_rating === 'GREEN' ? 'success' : live?.quality_rating === 'YELLOW' ? 'warning' : 'error';

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b bg-muted/30 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-base">{account.name}</h3>
            <p className="text-xs text-muted-foreground">{account.project.toUpperCase()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {account.is_default && <Badge variant="success">Default</Badge>}
          {account.is_active ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="error">Inactive</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        <div className="space-y-0 border-r">
          <div className="flex items-center gap-3 px-5 py-3 border-b">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Display Number</p>
              <p className="text-sm font-medium truncate">{live?.display_phone_number || '—'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-5 py-3 border-b">
            <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Phone Number ID</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-mono truncate">{account.phone_number_id}</p>
                <button onClick={() => { navigator.clipboard.writeText(account.phone_number_id); toast.success('Copied'); }} className="text-muted-foreground hover:text-foreground">
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 px-5 py-3 border-b">
            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">WABA ID</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-mono truncate">{account.waba_id}</p>
                <button onClick={() => { navigator.clipboard.writeText(account.waba_id); toast.success('Copied'); }} className="text-muted-foreground hover:text-foreground">
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 px-5 py-3">
            <Key className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Access Token</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-mono truncate">{showToken ? account.access_token : maskToken(account.access_token)}</p>
                <button onClick={() => setShowToken(!showToken)} className="text-muted-foreground hover:text-foreground">
                  {showToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
                <button onClick={() => { navigator.clipboard.writeText(account.access_token); toast.success('Token copied'); }} className="text-muted-foreground hover:text-foreground">
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-0">
          <div className="flex items-center gap-3 px-5 py-3 border-b">
            <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Status</p>
              <div className="flex items-center gap-2">
                {loadingLive ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : live ? (
                  <>
                    <Badge variant={statusVariant}>{live.status}</Badge>
                    {live.verified_name && <span className="text-xs text-muted-foreground truncate">({live.verified_name})</span>}
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">Click refresh to fetch</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 px-5 py-3 border-b">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Quality Rating</p>
              <div className="flex items-center gap-2">
                {loadingLive ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : live?.quality_rating ? (
                  <Badge variant={qualityVariant}>{live.quality_rating}</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 px-5 py-3">
            <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Throughput</p>
              <p className="text-sm capitalize">{live?.throughput_level || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t bg-muted/20 px-5 py-3">
        <p className="text-xs text-muted-foreground">Added {new Date(account.created_at).toLocaleDateString()}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-3 w-3 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={onTestSend}>
            <Send className="h-3 w-3 mr-1" /> Test Send
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Button>
          <Button variant="outline" size="sm" onClick={onDelete} className="text-destructive border-destructive/30 hover:bg-destructive/10">
            <Trash2 className="h-3 w-3 mr-1" /> Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PhoneNumbersPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingAccount, setEditingAccount] = useState<WhatsAppAccount | null>(null);
  const [liveData, setLiveData] = useState<Record<number, LiveInfo>>({});
  const [loadingLiveMap, setLoadingLiveMap] = useState<Record<number, boolean>>({});
  const [testingSend, setTestingSend] = useState<number | null>(null);

  const [form, setForm] = useState({
    name: '',
    project: '',
    phone_number_id: '',
    access_token: '',
    waba_id: '',
    is_active: true,
    is_default: false,
  });

  const { data: accounts, isLoading } = useQuery<WhatsAppAccount[]>({
    queryKey: ['whatsapp-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_accounts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WhatsAppAccount[];
    },
  });

  const fetchLiveInfo = async (account: WhatsAppAccount) => {
    setLoadingLiveMap((prev) => ({ ...prev, [account.id]: true }));
    try {
      const res = await fetch(
        `https://graph.facebook.com/v23.0/${account.phone_number_id}?fields=verified_name,display_phone_number,quality_rating,status,throughput{level}&access_token=${account.access_token}`
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error?.message || 'Failed to fetch');
      setLiveData((prev) => ({
        ...prev,
        [account.id]: {
          status: result.status || 'unknown',
          quality_rating: result.quality_rating || null,
          verified_name: result.verified_name || null,
          display_phone_number: result.display_phone_number || null,
          webhook: result.webhook_configuration?.application || null,
          throughput_level: result.throughput?.level || null,
        },
      }));
    } catch (err: any) {
      toast.error(`Failed to fetch live data for ${account.name}: ${err.message}`);
      setLiveData((prev) => ({
        ...prev,
        [account.id]: {
          status: 'error',
          quality_rating: null,
          verified_name: null,
          display_phone_number: null,
          webhook: null,
          throughput_level: null,
        },
      }));
    } finally {
      setLoadingLiveMap((prev) => ({ ...prev, [account.id]: false }));
    }
  };

  const handleRefreshAll = () => {
    accounts?.forEach((acc) => fetchLiveInfo(acc));
  };

  const resetForm = () => {
    setForm({
      name: '', project: '', phone_number_id: '', access_token: '',
      waba_id: '', is_active: true, is_default: false,
    });
  };

  const handleAdd = async () => {
    if (!form.name || !form.project || !form.phone_number_id || !form.access_token) {
      toast.error('Name, project, phone number ID, and access token are required');
      return;
    }
    try {
      const { error } = await supabase.from('whatsapp_accounts').insert({
        name: form.name,
        project: form.project,
        phone_number_id: form.phone_number_id,
        access_token: form.access_token,
        waba_id: form.waba_id,
        is_active: form.is_active,
        is_default: form.is_default,
      });
      if (error) throw error;
      toast.success(`${form.name} added successfully`);
      setShowAdd(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to add account');
    }
  };

  const handleEdit = async () => {
    if (!editingAccount) return;
    try {
      const { error } = await supabase
        .from('whatsapp_accounts')
        .update({
          name: form.name,
          project: form.project,
          phone_number_id: form.phone_number_id,
          access_token: form.access_token,
          waba_id: form.waba_id,
          is_active: form.is_active,
          is_default: form.is_default,
        })
        .eq('id', editingAccount.id);
      if (error) throw error;
      toast.success(`${form.name} updated`);
      setEditingAccount(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    }
  };

  const handleDelete = async (account: WhatsAppAccount) => {
    if (!confirm(`Delete ${account.name}? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.from('whatsapp_accounts').delete().eq('id', account.id);
      if (error) throw error;
      toast.success(`${account.name} deleted`);
      queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const handleTestSend = async (account: WhatsAppAccount) => {
    setTestingSend(account.id);
    try {
      const testNumber = prompt(`Enter a test phone number to send a message from ${account.name}:`, '+91');
      if (!testNumber) { setTestingSend(null); return; }
      const cleanNumber = testNumber.replace(/[^0-9+]/g, '');

      const res = await fetch(
        `https://graph.facebook.com/v23.0/${account.phone_number_id}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${account.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: cleanNumber.replace('+', ''),
            type: 'text',
            text: { preview_url: false, body: `Test message from ${account.name} WhatsApp CRM` },
          }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error?.message || 'Failed to send');
      toast.success(`Test message sent from ${account.name}`);
    } catch (err: any) {
      toast.error(`Test send failed: ${err.message}`);
    } finally {
      setTestingSend(null);
    }
  };

  const startEdit = (account: WhatsAppAccount) => {
    setEditingAccount(account);
    setForm({
      name: account.name,
      project: account.project,
      phone_number_id: account.phone_number_id,
      access_token: account.access_token,
      waba_id: account.waba_id,
      is_active: account.is_active,
      is_default: account.is_default,
    });
  };

  const AccountForm = ({ isEdit }: { isEdit: boolean }) => (
    <div className="rounded-xl border bg-card shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{isEdit ? `Edit ${editingAccount?.name}` : 'Add New WhatsApp Account'}</h3>
        <Button variant="ghost" size="icon" onClick={() => { setShowAdd(false); setEditingAccount(null); resetForm(); }}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Account Name *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ashray For Life Foundation" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Project *</Label>
          <select
            value={form.project}
            onChange={(e) => setForm({ ...form, project: e.target.value })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select project</option>
            <option value="bsct">Being Sevak (BSCT)</option>
            <option value="aflf">Ashray (AFLF)</option>
            <option value="maan">Mann Care (MAAN)</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Phone Number ID *</Label>
          <Input value={form.phone_number_id} onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })} placeholder="1136059359599752" className="font-mono text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">WABA ID (optional)</Label>
          <Input value={form.waba_id} onChange={(e) => setForm({ ...form, waba_id: e.target.value })} placeholder="1577122394424280" className="font-mono text-sm" />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Access Token *</Label>
        <Input
          value={form.access_token}
          onChange={(e) => setForm({ ...form, access_token: e.target.value })}
          placeholder="EAAj..."
          className="font-mono text-sm"
          type="password"
        />
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
          Active
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} className="rounded" />
          Default Account
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => { setShowAdd(false); setEditingAccount(null); resetForm(); }}>Cancel</Button>
        <Button onClick={isEdit ? handleEdit : handleAdd}>
          <Save className="h-4 w-4 mr-1" /> {isEdit ? 'Save Changes' : 'Add Account'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">WhatsApp Numbers</h1>
          <p className="text-muted-foreground">Manage your NGO WhatsApp Business accounts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefreshAll} disabled={Object.values(loadingLiveMap).some(Boolean)}>
            <RefreshCw className={`h-4 w-4 mr-1 ${Object.values(loadingLiveMap).some(Boolean) ? 'animate-spin' : ''}`} />
            Refresh All
          </Button>
          <Button onClick={() => { setShowAdd(true); setEditingAccount(null); resetForm(); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Number
          </Button>
        </div>
      </div>

      {showAdd && <AccountForm isEdit={false} />}
      {editingAccount && <AccountForm isEdit={true} />}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : accounts && accounts.length > 0 ? (
        <div className="space-y-4">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              live={liveData[account.id] || null}
              loadingLive={loadingLiveMap[account.id] || false}
              onRefresh={() => fetchLiveInfo(account)}
              onEdit={() => startEdit(account)}
              onDelete={() => handleDelete(account)}
              onTestSend={() => handleTestSend(account)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground rounded-xl border border-dashed">
          <Smartphone className="h-12 w-12" />
          <p className="text-lg font-medium">No WhatsApp accounts</p>
          <p className="text-sm">Add your NGO WhatsApp Business accounts to get started</p>
          <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" /> Add Number</Button>
        </div>
      )}
    </div>
  );
}
