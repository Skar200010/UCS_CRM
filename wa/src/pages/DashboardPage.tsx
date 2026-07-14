import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { loadMetaCredentials, getCachedToken, getCachedWabaId, hasCachedCredentials } from '../lib/metaCredentials';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { MessageSquare, Users, Clock, CheckCircle, TrendingUp, Megaphone, DollarSign, Smartphone, Activity, BarChart3, AlertCircle, Settings } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

const WHATSAPP_API = 'https://graph.facebook.com/v19.0';
const CATEGORY_CONFIG: Record<string, { label: string; rate: number; dotClass: string }> = {
  service: { label: 'Service (Conversational)', rate: 0, dotClass: 'bg-green-500' },
  marketing: { label: 'Marketing (Promotional)', rate: 0.032, dotClass: 'bg-blue-500' },
  utility: { label: 'Utility', rate: 0, dotClass: 'bg-yellow-500' },
  authentication: { label: 'Authentication', rate: 0, dotClass: 'bg-purple-500' },
};
const CATEGORIES = ['service', 'marketing', 'utility', 'authentication'] as const;

function formatCurrency(amount: number): string {
  if (amount === 0) return 'Free';
  return `$${amount.toFixed(4)}`;
}
function calculateCost(count: number, rate: number): number {
  return count * rate;
}

async function safeMetaGet(path: string): Promise<{ data: any; error: string | null }> {
  const t = getCachedToken();
  if (!t) return { data: null, error: 'No access token configured' };
  try {
    const res = await fetch(`${WHATSAPP_API}/${path}`, { headers: { Authorization: `Bearer ${t}` } });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error?.message || json.error?.error_user_msg || `HTTP ${res.status}` };
    return { data: json, error: null };
  } catch (e: any) {
    return { data: null, error: e.message || 'Network error' };
  }
}

export function DashboardPage() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      await loadMetaCredentials();
      const wabaId = getCachedWabaId();

      const [
        conversations, contacts, openConversations, closedToday, messagesToday,
        msgCategoryToday, msgCategoryMonth, dbPhones,
      ] = await Promise.all([
        supabase.from('conversations').select('*', { count: 'exact', head: true }),
        supabase.from('contacts').select('*', { count: 'exact', head: true }),
        supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'closed').gte('closed_at', today),
        supabase.from('messages').select('*', { count: 'exact', head: true }).gte('created_at', today),
        Promise.all(CATEGORIES.map((cat) => supabase.from('messages').select('*', { count: 'exact', head: true }).eq('message_category', cat).gte('created_at', today))),
        Promise.all(CATEGORIES.map((cat) => supabase.from('messages').select('*', { count: 'exact', head: true }).eq('message_category', cat).gte('created_at', monthStart))),
        supabase.from('whatsapp_phone_numbers').select('*').order('is_primary', { ascending: false }).limit(5),
      ]);

      const todayCounts: Record<string, number> = {};
      const monthCounts: Record<string, number> = {};
      CATEGORIES.forEach((cat, i) => { todayCounts[cat] = msgCategoryToday[i].count || 0; monthCounts[cat] = msgCategoryMonth[i].count || 0; });
      const monthTotal = Object.values(monthCounts).reduce((a, b) => a + b, 0);
      let totalCost = 0;
      CATEGORIES.forEach((cat) => { totalCost += calculateCost(monthCounts[cat], CATEGORY_CONFIG[cat].rate); });

      const phones = (dbPhones.data || []) as any[];
      const primaryPhone = phones.find((p: any) => p.is_primary) || phones[0];

      const [wabaRes, phoneRes, analyticsRes] = await Promise.all([
        safeMetaGet(`${wabaId}?fields=name`),
        primaryPhone?.phone_number_id ? safeMetaGet(`${primaryPhone.phone_number_id}?fields=display_phone_number,verified_name,quality_rating`) : { data: null, error: null },
        safeMetaGet(`${wabaId}/message_templates?fields=id,name,analytics&limit=50`),
      ]);

      const wabaData = wabaRes.data;
      const phoneData = phoneRes.data;
      const analyticsData = analyticsRes.data;
      const metaError = wabaRes.error || phoneRes.error;

      let metaSent = 0, metaDelivered = 0, metaReads = 0;
      const analyticsByName: Record<string, { sent: number; delivered: number; reads: number }> = {};
      if (analyticsData?.data) {
        for (const t of analyticsData.data) {
          if (t.analytics) {
            analyticsByName[t.name] = { sent: t.analytics.sent || 0, delivered: t.analytics.delivered || 0, reads: t.analytics.read || 0 };
            metaSent += t.analytics.sent || 0;
            metaDelivered += t.analytics.delivered || 0;
            metaReads += t.analytics.read || 0;
          }
        }
      }

      return {
        totalConversations: conversations.count || 0,
        totalContacts: contacts.count || 0,
        openConversations: openConversations.count || 0,
        closedToday: closedToday.count || 0,
        messagesToday: messagesToday.count || 0,
        todayCounts, monthCounts, monthTotal, totalCost,
        phoneNumbers: phones,
        metaPhone: phoneData,
        metaWaba: wabaData,
        metaSent, metaDelivered, metaReads,
        metaAnalytics: analyticsByName,
        metaFailed: wabaData === null && hasCachedCredentials(),
        metaError,
      };
    },
    refetchInterval: 30000,
  });

  const statCards = [
    { title: 'Conversations', value: stats?.totalConversations || 0, icon: MessageSquare, color: 'text-blue-600' },
    { title: 'Open', value: stats?.openConversations || 0, icon: Clock, color: 'text-yellow-600' },
    { title: 'Contacts', value: stats?.totalContacts || 0, icon: Users, color: 'text-green-600' },
    { title: 'Messages Today', value: stats?.messagesToday || 0, icon: MessageSquare, color: 'text-primary' },
    { title: 'Closed Today', value: stats?.closedToday || 0, icon: CheckCircle, color: 'text-emerald-600' },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Dashboard</h1><p className="text-muted-foreground">WhatsApp CRM overview</p></div>

      {stats?.metaFailed && (
        <div className="flex items-center gap-2 rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">Meta API error: <strong>{stats.metaError || 'Connection failed'}</strong></span>
          <Button variant="outline" size="sm" onClick={() => navigate('/settings')} className="shrink-0">
            <Settings className="h-3 w-3" /> Update in Settings
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><div className="h-4 w-28 animate-pulse rounded bg-muted" /><div className="h-5 w-5 animate-pulse rounded bg-muted" /></CardHeader><CardContent><div className="h-8 w-16 animate-pulse rounded bg-muted" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {statCards.map((stat) => (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{stat.value}</div></CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">WhatsApp Number</CardTitle>
                <Smartphone className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                {stats?.metaPhone ? (
                  <div className="space-y-1">
                    <div className="text-lg font-bold">{stats.metaPhone.display_phone_number}</div>
                    <div className="flex items-center gap-2">
                      {stats.metaPhone.quality_rating && (
                        <span className={`h-2.5 w-2.5 rounded-full ${stats.metaPhone.quality_rating === 'GREEN' ? 'bg-green-500' : stats.metaPhone.quality_rating === 'YELLOW' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                      )}
                      <span className="text-xs text-muted-foreground">{stats.metaPhone.verified_name || ''}</span>
                    </div>
                    {stats.metaPhone.verified_name && <p className="text-xs text-muted-foreground">{stats.metaPhone.verified_name}</p>}
                  </div>
                ) : stats?.phoneNumbers?.[0] ? (
                  <div className="space-y-1">
                    <div className="text-lg font-bold">{stats.phoneNumbers[0].display_phone_number}</div>
                    <p className="text-xs text-muted-foreground">(from local DB — Meta API not available)</p>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No number connected</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Marketing Messages</CardTitle>
                <Megaphone className="h-5 w-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.max(stats?.monthCounts['marketing'] || 0, stats?.metaSent || 0)}</div>
                <p className="text-xs text-muted-foreground">sent this month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Marketing Spend</CardTitle>
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${calculateCost(Math.max(stats?.monthCounts['marketing'] || 0, stats?.metaSent || 0), CATEGORY_CONFIG.marketing.rate).toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">estimated this month</p>
              </CardContent>
            </Card>
          </div>

          {stats?.metaWaba && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Activity className="h-4 w-4" /> Meta Business Account
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Account</p>
                    <p className="text-sm font-medium truncate">{stats.metaWaba.name}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Templates Sent</p>
                    <p className="text-lg font-bold">{stats.metaSent}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Delivered</p>
                    <p className="text-lg font-bold">{stats.metaDelivered} <span className="text-sm font-normal text-muted-foreground">({stats.metaSent > 0 ? Math.round(stats.metaDelivered / stats.metaSent * 100) : 0}%)</span></p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {stats?.metaAnalytics && Object.keys(stats.metaAnalytics).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <BarChart3 className="h-4 w-4" /> Template Performance (from Meta)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-3 font-medium">Template</th>
                        <th className="pb-3 font-medium">Sent</th>
                        <th className="pb-3 font-medium">Delivered</th>
                        <th className="pb-3 font-medium">Read</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(stats.metaAnalytics).map(([name, vals]) => (
                        <tr key={name} className="border-b text-sm">
                          <td className="py-2 font-medium">{name}</td>
                          <td className="py-2">{vals.sent}</td>
                          <td className="py-2">{vals.delivered} {vals.sent > 0 && <span className="text-muted-foreground">({Math.round(vals.delivered / vals.sent * 100)}%)</span>}</td>
                          <td className="py-2">{vals.reads} {vals.delivered > 0 && <span className="text-muted-foreground">({Math.round(vals.reads / vals.delivered * 100)}%)</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" /> Message Usage & Pricing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-3 font-medium">Category</th>
                      <th className="pb-3 font-medium">Today</th>
                      <th className="pb-3 font-medium">This Month</th>
                      <th className="pb-3 font-medium">Rate / msg</th>
                      <th className="pb-3 font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CATEGORIES.map((cat) => {
                      const config = CATEGORY_CONFIG[cat];
                      const todayCount = stats?.todayCounts[cat] || 0;
                      const monthCount = stats?.monthCounts[cat] || 0;
                      const cost = calculateCost(monthCount, config.rate);
                      return (
                        <tr key={cat} className={`border-b last:border-0 ${cat === 'marketing' ? 'bg-blue-50/50' : ''}`}>
                          <td className="py-3"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${config.dotClass}`} /><span>{config.label}</span></div></td>
                          <td className="py-3"><Badge variant={todayCount > 0 ? 'default' : 'neutral'}>{todayCount}</Badge></td>
                          <td className="py-3 font-medium">{monthCount}</td>
                          <td className="py-3 text-muted-foreground">{formatCurrency(config.rate)}</td>
                          <td className="py-3">{cost > 0 ? <span className="font-medium">${cost.toFixed(4)}</span> : <Badge variant="success">Free</Badge>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t pt-3">
                      <td className="py-3 font-semibold">Total</td>
                      <td className="py-3"><Badge variant="default">{stats?.messagesToday || 0}</Badge></td>
                      <td className="py-3 font-semibold">{stats?.monthTotal || 0}</td>
                      <td className="py-3" />
                      <td className="py-3">{stats?.totalCost && stats.totalCost > 0 ? <span className="font-semibold">${stats.totalCost.toFixed(4)}</span> : <Badge variant="success">Free</Badge>}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
