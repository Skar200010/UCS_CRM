import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { useAuthStore } from '../../stores/authStore';
import { CheckCircle, AlertCircle, Loader2, Search, Plus, X, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface SelectedUser {
  id?: string;
  name: string;
  email: string;
}

export function BatchUserImport() {
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SelectedUser | null>(null);
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);
  const [role, setRole] = useState('agent');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; email: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');

  const { data: searchResults } = useQuery({
    queryKey: ['user-search', search],
    queryFn: async () => {
      if (search.length < 2) return [];
      const { data, error } = await supabase.rpc('search_whatsapp_users', { p_query: search });
      if (error) return [];
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      return (parsed || []).filter((u: any) => u.email && u.id !== user?.id);
    },
    enabled: search.length >= 2,
  });

  const { data: phoneNumbers } = useQuery({
    queryKey: ['whatsapp-phone-numbers-assign'],
    queryFn: async () => {
      const { data } = await supabase
        .from('whatsapp_phone_numbers')
        .select('id, display_phone_number, label')
        .eq('tenant_id', user?.tenant_id)
        .eq('is_active', true);
      return data || [];
    },
    enabled: !!user?.tenant_id,
  });

  const handleSelect = (u: any) => {
    setSelected({ id: u.id, name: u.name, email: u.email });
    setSearch('');
    setResult(null);
    setError(null);
  };

  const toggleNumber = (id: string) => {
    setSelectedNumbers((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]
    );
  };

  const getPayload = () => {
    const target = selected || (manualMode ? { name: manualName, email: manualEmail } : null);
    if (!target || !target.email) return null;
    const nameParts = target.name.split(' ');
    return {
      email: target.email,
      first_name: nameParts[0] || '',
      last_name: nameParts.slice(1).join(' ') || '',
      role,
    };
  };

  const handleImport = async () => {
    const payload = getPayload();
    if (!payload) { toast.error('Enter name and email'); return; }
    setImporting(true);
    setError(null);
    setResult(null);

    const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
    const API_BASE = import.meta.env.VITE_API_URL || 'https://ucs-crm-backend.vercel.app/api';

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, password: tempPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.error || 'Registration failed');
      } else {
        setResult({ success: true, email: payload.email, password: tempPassword });
        setSelected(null);
        setManualName('');
        setManualEmail('');
        setManualMode(false);
        setSelectedNumbers([]);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to register');
    } finally {
      setImporting(false);
    }
  };

  function RoleAndNumbersSection() {
    return (
      <>
        <div className="space-y-1.5">
          <Label className="text-xs">Role</Label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
          </select>
        </div>
        {phoneNumbers && phoneNumbers.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs">Assign WhatsApp Number(s)</Label>
            <div className="space-y-1.5">
              {phoneNumbers.map((pn: any) => (
                <label
                  key={pn.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-md border p-2.5 text-sm transition-colors ${
                    selectedNumbers.includes(pn.id) ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedNumbers.includes(pn.id)}
                    onChange={() => toggleNumber(pn.id)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <div>
                    <p className="text-sm font-medium">{pn.label || pn.display_phone_number}</p>
                    <p className="text-xs text-muted-foreground">{pn.display_phone_number}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </>
    );
  }

  const handleClear = () => {
    setSelected(null);
    setSearch('');
    setManualName('');
    setManualEmail('');
    setManualMode(false);
    setResult(null);
    setError(null);
    setSelectedNumbers([]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Add Team Member</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Search User</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type name or email..."
              className="pl-8"
            />
          </div>
          {search.length >= 2 && searchResults && searchResults.length > 0 && !selected && (
            <div className="max-h-40 overflow-y-auto rounded border text-sm">
              {searchResults.map((u: any) => (
                <button
                  key={u.id}
                  className="flex w-full items-center gap-3 px-3 py-2 hover:bg-accent text-left"
                  onClick={() => handleSelect(u)}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                    {(u.name?.[0] || u.email?.[0] || '?').toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {search.length >= 2 && searchResults?.length === 0 && !selected && !manualMode && (
            <div className="rounded border p-3 text-center space-y-2">
              <p className="text-xs text-muted-foreground">No users found</p>
              <Button variant="outline" size="sm" onClick={() => { setManualMode(true); setSearch(''); }}>
                <Plus className="h-3 w-3" /> Create New
              </Button>
            </div>
          )}
        </div>

        {manualMode && !selected && (
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">New User</p>
              <Button variant="ghost" size="icon" onClick={() => setManualMode(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">Full Name</Label>
                <Input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="John Doe" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} placeholder="john@example.com" />
              </div>
            </div>
            <RoleAndNumbersSection />
            <Button className="w-full" onClick={handleImport} disabled={importing || !manualName || !manualEmail}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add as {role.replace('_', ' ')}
            </Button>
          </div>
        )}

        {selected && (
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {(selected.name?.[0] || selected.email?.[0] || '?').toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{selected.name}</p>
                  <p className="text-xs text-muted-foreground">{selected.email}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleClear}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <RoleAndNumbersSection />

            <Button className="w-full" onClick={handleImport} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add as {role.replace('_', ' ')}
            </Button>
          </div>
        )}

        {result && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span className="font-medium">Agent created! Share these credentials:</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="rounded bg-white border p-2 truncate">
                <span className="text-muted-foreground">Email: </span>{result.email}
              </div>
              <div className="rounded bg-white border p-2 flex items-center justify-between">
                <span className="truncate"><span className="text-muted-foreground">Password: </span>{result.password}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(result.password); toast.success('Password copied'); }}
                  className="shrink-0 ml-1 text-green-700 hover:text-green-800"
                  title="Copy password"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(`Email: ${result.email}\nPassword: ${result.password}`); toast.success('Both copied'); }}
              className="text-xs text-green-700 underline hover:no-underline"
            >
              Copy both
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
