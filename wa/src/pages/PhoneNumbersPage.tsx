import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { loadMetaCredentials, getCachedToken, getCachedWabaId } from '../lib/metaCredentials';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Badge } from '../components/ui/Badge';
import { Phone, Smartphone, UserPlus, Loader2, Plus, X, Save, Pencil, Trash2, Star, RefreshCw, Copy, Mail } from 'lucide-react';
import { toast } from 'sonner';
import type { WhatsAppPhoneNumber, User, UserRole } from 'shared';

const WHATSAPP_API = 'https://graph.facebook.com/v19.0';
const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'tenant_admin', label: 'Admin' },
  { value: 'agent', label: 'Agent' },
  { value: 'viewer', label: 'Viewer' },
];

function PhoneNumberBadge({ status }: { status: WhatsAppPhoneNumber['status'] }) {
  const map: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
    verified: 'success', pending: 'warning', banned: 'error', restricted: 'error',
  };
  return <Badge variant={map[status] || 'neutral'}>{status}</Badge>;
}

export function PhoneNumbersPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddNumber, setShowAddNumber] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', first_name: '', last_name: '', role: 'agent' as UserRole });
  const [adding, setAdding] = useState(false);
  const [newNumber, setNewNumber] = useState({ display_phone_number: '', phone_number_id: '', label: '', verified_name: '' });
  const [editingLabel, setEditingLabel] = useState<{ id: string; label: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [createdUserInfo, setCreatedUserInfo] = useState<{ email: string; password: string } | null>(null);
  const [resetSending, setResetSending] = useState(false);

  const handleSyncFromMeta = async () => {
    await loadMetaCredentials();
    const token = getCachedToken();
    const wabaId = getCachedWabaId();
    if (!token || !wabaId) { toast.error('Configure Meta API credentials in Settings first'); return; }
    if (!user?.tenant_id) { toast.error('Tenant not found'); return; }
    setSyncing(true);
    try {
      const res = await fetch(`${WHATSAPP_API}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error?.message || 'Failed to fetch');
      let added = 0;
      for (const pn of result.data || []) {
        const existing = await supabase.from('whatsapp_phone_numbers').select('id').eq('phone_number_id', pn.id).maybeSingle();
        if (!existing.data) {
          await supabase.from('whatsapp_phone_numbers').insert({
            tenant_id: user.tenant_id,
            phone_number_id: pn.id,
            display_phone_number: pn.display_phone_number,
            verified_name: pn.verified_name || null,
            quality_rating: pn.quality_rating || null,
            status: 'verified',
            label: pn.verified_name || pn.display_phone_number,
          });
          added++;
        }
      }
      toast.success(`Synced ${result.data?.length || 0} numbers from Meta (${added} new)`);
      queryClient.invalidateQueries({ queryKey: ['whatsapp-phone-numbers'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to sync');
    } finally {
      setSyncing(false);
    }
  };

  const { data: phoneNumbers, isLoading: loadingPhones } = useQuery<WhatsAppPhoneNumber[]>({
    queryKey: ['whatsapp-phone-numbers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('whatsapp_phone_numbers').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as WhatsAppPhoneNumber[];
    },
  });

  const { data: teamUsers, isLoading: loadingUsers } = useQuery<User[]>({
    queryKey: ['team-users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as User[];
    },
  });

  const handleAddNumber = async () => {
    if (!newNumber.display_phone_number || !newNumber.label) {
      toast.error('Phone number and NGO name are required');
      return;
    }
    try {
      const { error } = await supabase.from('whatsapp_phone_numbers').insert({
        tenant_id: user?.tenant_id,
        display_phone_number: newNumber.display_phone_number,
        phone_number_id: newNumber.phone_number_id || newNumber.display_phone_number.replace(/[^0-9]/g, ''),
        label: newNumber.label,
        verified_name: newNumber.verified_name || null,
        status: 'verified',
      });
      if (error) throw error;
      toast.success('Phone number added');
      setShowAddNumber(false);
      setNewNumber({ display_phone_number: '', phone_number_id: '', label: '', verified_name: '' });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-phone-numbers'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to add number');
    }
  };

  const handleSaveLabel = async () => {
    if (!editingLabel || !editingLabel.label.trim()) return;
    try {
      await supabase.from('whatsapp_phone_numbers').update({ label: editingLabel.label }).eq('id', editingLabel.id);
      toast.success('Label updated');
      setEditingLabel(null);
      queryClient.invalidateQueries({ queryKey: ['whatsapp-phone-numbers'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update label');
    }
  };

  const handleSetPrimary = async (id: string) => {
    try {
      await supabase.from('whatsapp_phone_numbers').update({ is_primary: false }).neq('id', id);
      await supabase.from('whatsapp_phone_numbers').update({ is_primary: true }).eq('id', id);
      toast.success('Primary number updated');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-phone-numbers'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to set primary');
    }
  };

  const handleDeleteNumber = async (id: string, number: string) => {
    if (!confirm(`Remove ${number}?`)) return;
    try {
      await supabase.from('whatsapp_phone_numbers').delete().eq('id', id);
      toast.success('Number removed');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-phone-numbers'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove');
    }
  };

  const handleAddUser = async () => {
    if (!newUser.email || !newUser.first_name || !newUser.last_name) { toast.error('Name and email are required'); return; }
    setAdding(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) { toast.error('Not authenticated'); return; }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(newUser),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setCreatedUserInfo({ email: newUser.email, password: result.tempPassword });
      setShowAddUser(false);
      setNewUser({ email: '', first_name: '', last_name: '', role: 'agent' });
      queryClient.invalidateQueries({ queryKey: ['team-users'] });
    } catch (err: any) { toast.error(err.message || 'Failed to create user'); }
    finally { setAdding(false); }
  };

  const handleDeleteUser = async (id: string, email: string) => {
    if (!confirm(`Remove ${email}? This will permanently delete their account.`)) return;
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) { toast.error('Not authenticated'); return; }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: id }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast.success(`User ${email} deleted`);
      queryClient.invalidateQueries({ queryKey: ['team-users'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete user');
    }
  };

  const handleSendReset = async (email: string) => {
    setResetSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      toast.success(`Password reset email sent to ${email}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send reset email');
    } finally {
      setResetSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Phone Numbers & Team</h1><p className="text-muted-foreground">Manage your NGO WhatsApp numbers and team members</p></div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5" /> Phone Numbers</CardTitle>
            <div className="flex gap-2">
              <Badge variant="default">{phoneNumbers?.length || 0} connected</Badge>
              <Button variant="outline" size="sm" onClick={handleSyncFromMeta} disabled={syncing}>
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sync from Meta
              </Button>
              <Button size="sm" onClick={() => setShowAddNumber(true)}><Plus className="h-4 w-4" /> Add Number</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {showAddNumber && (
            <div className="rounded-lg border p-4 space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Register WhatsApp Number</h4>
                <Button variant="ghost" size="icon" onClick={() => setShowAddNumber(false)}><X className="h-4 w-4" /></Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label className="text-xs">NGO Name / Label</Label><Input value={newNumber.label} onChange={(e) => setNewNumber({ ...newNumber, label: e.target.value })} placeholder="NGO A" /></div>
                <div className="space-y-1"><Label className="text-xs">Phone Number</Label><Input value={newNumber.display_phone_number} onChange={(e) => setNewNumber({ ...newNumber, display_phone_number: e.target.value })} placeholder="+1234567890" /></div>
                <div className="space-y-1"><Label className="text-xs">Phone Number ID (from Meta)</Label><Input value={newNumber.phone_number_id} onChange={(e) => setNewNumber({ ...newNumber, phone_number_id: e.target.value })} placeholder="Optional" /></div>
                <div className="space-y-1"><Label className="text-xs">Verified Business Name</Label><Input value={newNumber.verified_name} onChange={(e) => setNewNumber({ ...newNumber, verified_name: e.target.value })} placeholder="Optional" /></div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowAddNumber(false)}>Cancel</Button>
                <Button size="sm" onClick={handleAddNumber}><Save className="h-4 w-4" /> Add</Button>
              </div>
            </div>
          )}

          {loadingPhones ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
          ) : phoneNumbers && phoneNumbers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 text-sm font-medium text-muted-foreground">NGO</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Phone Number</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Quality</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Primary</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {phoneNumbers.map((pn) => (
                    <tr key={pn.id} className="border-b text-sm">
                      <td className="py-3">
                        {(editingLabel?.id === pn.id) ? (
                          <div className="flex items-center gap-1">
                            <Input value={editingLabel.label} onChange={(e) => setEditingLabel({ ...editingLabel, label: e.target.value })} className="h-7 text-xs w-28" />
                            <Button variant="ghost" size="icon" onClick={handleSaveLabel}><Save className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setEditingLabel(null)}><X className="h-3 w-3" /></Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="font-medium">{(pn as any).label || pn.verified_name || '-'}</span>
                            <Button variant="ghost" size="icon" onClick={() => setEditingLabel({ id: pn.id, label: (pn as any).label || '' })}><Pencil className="h-3 w-3 text-muted-foreground" /></Button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-muted-foreground">{pn.display_phone_number}</td>
                      <td className="py-3"><PhoneNumberBadge status={pn.status} /></td>
                      <td className="py-3 capitalize">
                        {pn.quality_rating ? <Badge variant={pn.quality_rating === 'green' ? 'success' : pn.quality_rating === 'yellow' ? 'warning' : 'error'}>{pn.quality_rating}</Badge> : '-'}
                      </td>
                      <td className="py-3">
                        {pn.is_primary ? <Badge variant="success">Primary</Badge> : <Button variant="ghost" size="sm" onClick={() => handleSetPrimary(pn.id)} className="text-xs"><Star className="h-3 w-3" /> Set</Button>}
                      </td>
                      <td className="py-3">
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteNumber(pn.id, pn.display_phone_number)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <Phone className="h-12 w-12" />
              <p className="text-lg font-medium">No phone numbers</p>
              <p className="text-sm">Add your NGO WhatsApp numbers above</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Team Members</CardTitle>
            <Button size="sm" onClick={() => setShowAddUser(true)}><Plus className="h-4 w-4" /> Add User</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddUser && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">New Team Member</h4>
                <Button variant="ghost" size="icon" onClick={() => setShowAddUser(false)}><X className="h-4 w-4" /></Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label className="text-xs">First Name</Label><Input value={newUser.first_name} onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })} placeholder="John" /></div>
                <div className="space-y-1"><Label className="text-xs">Last Name</Label><Input value={newUser.last_name} onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })} placeholder="Doe" /></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label className="text-xs">Email</Label><Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="john@example.com" /></div>
                <div className="space-y-1"><Label className="text-xs">Role</Label>
                  <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {ROLE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowAddUser(false)}>Cancel</Button>
                <Button size="sm" onClick={handleAddUser} disabled={adding}>
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Add Member
                </Button>
              </div>
            </div>
          )}

          {createdUserInfo && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-green-800">User Created Successfully</h4>
                <Button variant="ghost" size="icon" onClick={() => setCreatedUserInfo(null)}><X className="h-4 w-4 text-green-700" /></Button>
              </div>
              <p className="text-xs text-green-700">Share this temporary password with <strong>{createdUserInfo.email}</strong>:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded border border-green-300 bg-white px-3 py-2 text-sm font-mono">{createdUserInfo.password}</code>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(createdUserInfo.password); toast.success('Password copied'); }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button size="sm" variant="secondary" onClick={() => handleSendReset(createdUserInfo.email)} disabled={resetSending}>
                {resetSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Send Password Reset Email
              </Button>
            </div>
          )}

          {loadingUsers ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />)}</div>
          ) : teamUsers && teamUsers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Name</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Email</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Role</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Last Active</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teamUsers.map((u) => (
                    <tr key={u.id} className="border-b text-sm">
                      <td className="py-3 font-medium">{u.first_name || u.last_name ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : '-'}</td>
                      <td className="py-3 text-muted-foreground">{u.email}</td>
                      <td className="py-3 capitalize"><Badge variant={u.role === 'tenant_admin' ? 'default' : u.role === 'agent' ? 'success' : 'neutral'}>{u.role.replace('_', ' ')}</Badge></td>
                      <td className="py-3"><Badge variant={u.status === 'active' ? 'success' : u.status === 'invited' ? 'warning' : 'error'}>{u.status}</Badge></td>
                      <td className="py-3 text-muted-foreground">{u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : 'Never'}</td>
                      <td className="py-3">
                        {u.id !== user?.id && (
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(u.id, u.email)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <UserPlus className="h-12 w-12" />
              <p className="text-lg font-medium">No team members yet</p>
              <p className="text-sm">Add team members to collaborate</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
