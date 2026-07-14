import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { loadMetaCredentials, getCachedToken, getCachedWabaId } from '../lib/metaCredentials';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { MessageSquare, Plus, RefreshCw, Loader2, Trash2, Edit3, X, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { WhatsAppTemplate } from 'shared';

const WHATSAPP_API = 'https://graph.facebook.com/v19.0';

function getAccessToken(): string {
  let token = getCachedToken();
  if (!token) { token = prompt('Enter your WhatsApp Access Token:') || ''; if (token) localStorage.setItem('wa_access_token', token); }
  return token;
}

function getWabaId(): string {
  let wabaId = getCachedWabaId();
  if (!wabaId) { wabaId = prompt('Enter your WABA ID:') || ''; if (wabaId) localStorage.setItem('waba_id', wabaId); }
  return wabaId;
}

function TemplateStatus({ status }: { status: string }) {
  const variant = status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'warning';
  return <Badge variant={variant}>{status}</Badge>;
}

function countBy(arr: any[], key: string): Record<string, number> {
  return arr.reduce((acc: Record<string, number>, item: any) => {
    const val = item[key] || 'unknown';
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
}

export function TemplatesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => { loadMetaCredentials(); }, []);

  const { data: templates, isLoading } = useQuery<WhatsAppTemplate[]>({
    queryKey: ['whatsapp-templates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('whatsapp_templates').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as WhatsAppTemplate[];
    },
  });

  const { data: templateStats } = useQuery<Record<string, { sent: number; delivered: number; reads: number; failed: number }>>({
    queryKey: ['whatsapp-template-stats'],
    queryFn: async () => {
      await loadMetaCredentials();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [contactsRes, campaignsRes, messagesRes, templatesRes] = await Promise.all([
        supabase.from('campaign_contacts').select('campaign_id, status').gte('created_at', thirtyDaysAgo),
        supabase.from('campaigns').select('id, template_id').not('template_id', 'is', null),
        supabase.from('messages').select('template_id, status, campaign_id').gte('created_at', thirtyDaysAgo).not('template_id', 'is', null),
        supabase.from('whatsapp_templates').select('id, meta_template_id, name'),
      ]);

      const campaignToTemplate: Record<string, string> = {};
      (campaignsRes.data || []).forEach((c: any) => { campaignToTemplate[c.id] = c.template_id; });

      const localIdToMetaId: Record<string, string> = {};
      const nameToMetaId: Record<string, string> = {};
      (templatesRes.data || []).forEach((t: any) => {
        if (t.meta_template_id) {
          localIdToMetaId[t.id] = t.meta_template_id;
          nameToMetaId[t.name] = t.meta_template_id;
        }
      });

      const stats: Record<string, { sent: number; delivered: number; reads: number; failed: number }> = {};

      for (const cc of contactsRes.data || []) {
        const rawId = campaignToTemplate[cc.campaign_id];
        if (!rawId) continue;
        const metaId = nameToMetaId[rawId] || rawId;
        if (!stats[metaId]) stats[metaId] = { sent: 0, delivered: 0, reads: 0, failed: 0 };
        if (['sent', 'delivered', 'read'].includes(cc.status)) stats[metaId].sent++;
        if (cc.status === 'delivered' || cc.status === 'read') stats[metaId].delivered++;
        if (cc.status === 'read') stats[metaId].reads++;
        if (cc.status === 'failed') stats[metaId].failed++;
      }

      for (const msg of messagesRes.data || []) {
        const rawId = msg.campaign_id ? campaignToTemplate[msg.campaign_id] : localIdToMetaId[msg.template_id as string] || msg.template_id as string;
        if (!rawId) continue;
        const metaId = nameToMetaId[rawId] || rawId;
        if (!stats[metaId]) stats[metaId] = { sent: 0, delivered: 0, reads: 0, failed: 0 };
        if (['sent', 'delivered', 'read'].includes(msg.status)) stats[metaId].sent++;
        if (msg.status === 'delivered' || msg.status === 'read') stats[metaId].delivered++;
        if (msg.status === 'read') stats[metaId].reads++;
        if (msg.status === 'failed') stats[metaId].failed++;
      }

      const accessToken = getCachedToken();
      const wabaId = getCachedWabaId();
      if (accessToken && wabaId) {
        try {
          const metaResp = await fetch(
            `${WHATSAPP_API}/${wabaId}/message_templates?fields=id,name,analytics&limit=50`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const metaResult = await metaResp.json();
          if (metaResult.data) {
            for (const mt of metaResult.data) {
              if (mt.analytics) {
                const metaId = mt.id;
                const a = mt.analytics;
                const existing = stats[metaId] || { sent: 0, delivered: 0, reads: 0, failed: 0 };
                existing.sent += (a.sent || 0);
                existing.delivered += (a.delivered || 0);
                existing.reads += (a.read || 0);
                existing.failed += (a.failed || 0);
                stats[metaId] = existing;
              }
            }
          }
        } catch {}
      }

      return stats;
    },
    refetchInterval: 30000,
  });

  const languageCounts = useMemo(() => templates ? countBy(templates, 'language') : {}, [templates]);

  const activeFilterCount = [search, filterCategory, filterLanguage, filterStatus].filter(Boolean).length;

  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    return templates.filter((t) => {
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCategory === 'marketing' && t.category !== 'marketing') return false;
      if (filterCategory === 'utility' && t.category !== 'utility') return false;
      if (filterCategory && !['marketing', 'utility'].includes(filterCategory) && t.category !== filterCategory.toLowerCase()) return false;
      if (filterLanguage && t.language !== filterLanguage) return false;
      if (filterStatus && t.status !== filterStatus) return false;
      return true;
    });
  }, [templates, search, filterCategory, filterLanguage, filterStatus]);

  const { data: metrics } = useQuery({
    queryKey: ['template-metrics'],
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('messages')
        .select('template_id, created_at, status')
        .gte('created_at', sevenDaysAgo)
        .not('template_id', 'is', null);
      if (error) throw error;
      const total = data?.length || 0;
      const sent = data?.filter((m) => m.status === 'sent' || m.status === 'delivered' || m.status === 'read').length || 0;
      const failed = data?.filter((m) => m.status === 'failed').length || 0;
      const unique = new Set(data?.map((m) => m.template_id)).size;
      return { total, sent, failed, uniqueTemplates: unique };
    },
    refetchInterval: 30000,
  });

  const handleSync = async () => {
    const accessToken = getAccessToken();
    const wabaId = getWabaId();
    if (!accessToken || !wabaId) return;
    setSyncing(true);
    try {
      const resp = await fetch(`${WHATSAPP_API}/${wabaId}/message_templates?fields=id,name,language,status,category,components,rejection_reason`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const result = await resp.json();
      if (!resp.ok) throw new Error(JSON.stringify(result.error));
      const { data: profile } = await supabase.from('users').select('tenant_id').single();
      if (!profile) throw new Error('User profile not found');
      const metaIds: string[] = [];
      for (const t of result.data) {
        metaIds.push(t.id);
        const existing = await supabase.from('whatsapp_templates').select('id').eq('tenant_id', profile.tenant_id).eq('meta_template_id', t.id).maybeSingle();
        const record = { tenant_id: profile.tenant_id, phone_number_id: '', meta_template_id: t.id, name: t.name, language: t.language, category: t.category?.toLowerCase(), status: t.status?.toLowerCase(), components: t.components || [], rejection_reason: t.rejection_reason || null, synced_at: new Date().toISOString() };
        if (existing.data) { await supabase.from('whatsapp_templates').update(record).eq('id', existing.data.id); } else { await supabase.from('whatsapp_templates').insert(record); }
      }
      if (metaIds.length > 0) {
        const { data: localTemplates } = await supabase.from('whatsapp_templates').select('id, meta_template_id').eq('tenant_id', profile.tenant_id);
        if (localTemplates) {
          const toDelete = localTemplates.filter((lt) => lt.meta_template_id && !metaIds.includes(lt.meta_template_id));
          for (const d of toDelete) { await supabase.from('whatsapp_templates').delete().eq('id', d.id); }
        }
      }
      toast.success(`Synced ${result.data.length} templates`);
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
    } catch (err: any) { toast.error(err.message || 'Failed to sync'); }
    finally { setSyncing(false); }
  };

  const handleDelete = async (template: WhatsAppTemplate) => {
    if (!template.meta_template_id) { await supabase.from('whatsapp_templates').delete().eq('id', template.id); queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] }); return; }
    if (!confirm(`Delete template "${template.name}"?`)) return;
    const accessToken = getAccessToken();
    const wabaId = getWabaId();
    if (!accessToken || !wabaId) return;

    const resp = await fetch(`${WHATSAPP_API}/${wabaId}/message_templates?name=${template.name}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` },
    });
    const result = await resp.json();

    if (!resp.ok) {
      const isSample = result.error?.error_subcode === 2388094;
      if (isSample && !confirm(`"${template.name}" is a Meta sample template and cannot be deleted from Meta. Remove from local list only?`)) return;
      if (!isSample) { toast.error(JSON.stringify(result.error)); return; }
    }

    await supabase.from('whatsapp_templates').delete().eq('id', template.id);
    toast.success('Removed from local list' + (resp.ok ? ' and deleted from Meta' : ''));
    queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
  };

  const clearFilters = () => {
    setSearch('');
    setFilterCategory('');
    setFilterLanguage('');
    setFilterStatus('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Message Templates</h1>
          <p className="text-muted-foreground">Manage WhatsApp message templates</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sync from Meta
          </Button>
          <Button onClick={() => navigate('/templates/new')}>
            <Plus className="h-4 w-4" /> New Template
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Sent (7 days)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{metrics?.sent || 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Failed (7 days)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{metrics?.failed || 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Templates Used</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{metrics?.uniqueTemplates || 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Sent</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{metrics?.total || 0}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates..." className="pl-9" />
            </div>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[130px]">
              <option value="">Category</option>
              <option value="marketing">Marketing</option>
              <option value="utility">Utility</option>
            </select>
            <select value={filterLanguage} onChange={(e) => setFilterLanguage(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[130px]">
              <option value="">Language</option>
              {Object.entries(languageCounts).map(([lang, count]) => (
                <option key={lang} value={lang}>{lang} ({count})</option>
              ))}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[130px]">
              <option value="">Status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                <X className="h-4 w-4" /> Clear
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
          ) : filteredTemplates.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Name</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Language</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Delivered</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Read Rate</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Last Edited</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTemplates.map((t) => {
                    const metaId = t.meta_template_id;
                    const st = metaId ? templateStats?.[metaId] : undefined;
                    const delivered = st?.delivered || 0;
                    const reads = st?.reads || 0;
                    const readRate = delivered > 0 ? Math.round((reads / delivered) * 100) : 0;
                    return (
                      <tr key={t.id} className="border-b text-sm">
                        <td className="py-3">
                          <p className="font-medium">{t.name}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{t.category || '-'}</p>
                        </td>
                        <td className="py-3"><TemplateStatus status={t.status} /></td>
                        <td className="py-3 text-muted-foreground uppercase text-xs">{t.language}</td>
                        <td className="py-3">
                          {st ? (
                            <div>
                              <span className="font-medium">{delivered}</span>
                              {st.failed > 0 && <span className="text-destructive text-xs ml-1">({st.failed} failed)</span>}
                            </div>
                          ) : <span className="text-muted-foreground">-</span>}
                        </td>
                        <td className="py-3">
                          {st && delivered > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full bg-green-500" style={{ width: `${readRate}%` }} />
                              </div>
                              <span className="text-xs font-medium">{readRate}%</span>
                            </div>
                          ) : <span className="text-muted-foreground">-</span>}
                        </td>
                        <td className="py-3 text-xs text-muted-foreground">
                          {t.synced_at ? new Date(t.synced_at).toLocaleDateString() : '-'}
                        </td>
                        <td className="py-3">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => navigate(`/templates/${t.id}`)} title="Edit"><Edit3 className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(t)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <MessageSquare className="h-12 w-12" />
              <p className="text-lg font-medium">No templates match your filters</p>
              <p className="text-sm">Try adjusting your search or filter criteria</p>
              {activeFilterCount > 0 && <Button variant="outline" size="sm" onClick={clearFilters}>Clear all filters</Button>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
