import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend,
  type PieLabelRenderProps,
} from 'recharts';
import { MessageSquare, Users, TrendingUp, Clock, BarChart3, Loader2 } from 'lucide-react';
import type { Message, Conversation, Contact, Deal } from 'shared';

export function AnalyticsPage() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: messages, isLoading: loadingMsgs } = useQuery({
    queryKey: ['analytics-messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('created_at, direction')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at');
      if (error) throw error;
      return data as Pick<Message, 'created_at' | 'direction'>[];
    },
  });

  const { data: conversations } = useQuery({
    queryKey: ['analytics-conversations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('created_at, status, closed_at')
        .gte('created_at', thirtyDaysAgo);
      if (error) throw error;
      return data as Pick<Conversation, 'created_at' | 'status' | 'closed_at'>[];
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ['analytics-contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('created_at, source')
        .gte('created_at', thirtyDaysAgo);
      if (error) throw error;
      return data as Pick<Contact, 'created_at' | 'source'>[];
    },
  });

  const { data: deals } = useQuery({
    queryKey: ['analytics-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('status, value, created_at');
      if (error) throw error;
      return data as Pick<Deal, 'status' | 'value' | 'created_at'>[];
    },
  });

  const loading = loadingMsgs;

  const messagesByDay = (() => {
    const map: Record<string, { inbound: number; outbound: number; total: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      map[d] = { inbound: 0, outbound: 0, total: 0 };
    }
    messages?.forEach((m: Pick<Message, 'created_at' | 'direction'>) => {
      const d = new Date(m.created_at).toISOString().split('T')[0];
      if (map[d]) {
        if (m.direction === 'inbound') map[d].inbound++;
        else map[d].outbound++;
        map[d].total++;
      }
    });
    return Object.entries(map).map(([date, val]) => ({ date, ...val }));
  })();

  const contactsByDay = (() => {
    const map: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      map[d] = 0;
    }
    contacts?.forEach((c: Pick<Contact, 'created_at' | 'source'>) => {
      const d = new Date(c.created_at).toISOString().split('T')[0];
      if (map[d] !== undefined) map[d]++;
    });
    return Object.entries(map).map(([date, count]) => ({ date, count }));
  })();

  const conversationsByDay = (() => {
    const map: Record<string, { new: number; closed: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      map[d] = { new: 0, closed: 0 };
    }
    conversations?.forEach((c: Pick<Conversation, 'created_at' | 'status' | 'closed_at'>) => {
      const nd = new Date(c.created_at).toISOString().split('T')[0];
      if (map[nd]) map[nd].new++;
      if (c.closed_at) {
        const cd = new Date(c.closed_at).toISOString().split('T')[0];
        if (map[cd]) map[cd].closed++;
      }
    });
    return Object.entries(map).map(([date, val]) => ({ date, ...val }));
  })();

  const dealFunnel = [
    { name: 'Open', value: deals?.filter((d) => d.status === 'open').length || 0, color: '#3b82f6' },
    { name: 'Won', value: deals?.filter((d) => d.status === 'won').length || 0, color: '#22c55e' },
    { name: 'Lost', value: deals?.filter((d) => d.status === 'lost').length || 0, color: '#ef4444' },
    { name: 'Abandoned', value: deals?.filter((d) => d.status === 'abandoned').length || 0, color: '#f59e0b' },
  ];

  const totalMessages = messages?.length || 0;
  const totalInbound = messages?.filter((m) => m.direction === 'inbound').length || 0;
  const totalOutbound = messages?.filter((m) => m.direction === 'outbound').length || 0;
  const totalContacts = contacts?.length || 0;
  const openConversations = conversations?.filter((c) => c.status === 'open').length || 0;
  const totalDeals = deals?.length || 0;
  const wonDeals = deals?.filter((d) => d.status === 'won').length || 0;
  const wonValue = deals?.filter((d) => d.status === 'won').reduce((sum, d) => sum + (Number(d.value) || 0), 0) || 0;

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Track performance and metrics</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            <MessageSquare className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalMessages}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inbound</CardTitle>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalInbound}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outbound</CardTitle>
            <TrendingUp className="h-5 w-5 text-yellow-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalOutbound}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contacts</CardTitle>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalContacts}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Chats</CardTitle>
            <Clock className="h-5 w-5 text-orange-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{openConversations}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Won Deals</CardTitle>
            <BarChart3 className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{wonDeals}</div>
            <p className="text-xs text-muted-foreground">${wonValue.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Message Volume (30 Days)</CardTitle>
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={messagesByDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="inbound" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} name="Inbound" />
                  <Area type="monotone" dataKey="outbound" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} name="Outbound" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Conversations (30 Days)</CardTitle>
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={conversationsByDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="new" fill="#3b82f6" name="New" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="closed" fill="#22c55e" name="Closed" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Contact Growth</CardTitle>
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={contactsByDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} dot={false} name="New Contacts" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Deal Pipeline</CardTitle>
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dealFunnel.filter((d) => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, value }: PieLabelRenderProps) => `${name || ''}: ${value || 0}`}
                  >
                    {dealFunnel.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Message Breakdown</CardTitle>
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Inbound', value: totalInbound, color: '#3b82f6' },
                      { name: 'Outbound', value: totalOutbound, color: '#22c55e' },
                    ].filter((d) => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }: PieLabelRenderProps) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {['#3b82f6', '#22c55e'].map((color) => (
                      <Cell key={color} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-3 text-left font-medium text-muted-foreground">Metric</th>
                  <th className="pb-3 text-right font-medium text-muted-foreground">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2">Total Messages (30 days)</td>
                  <td className="py-2 text-right font-semibold">{totalMessages}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Messages per day (avg)</td>
                  <td className="py-2 text-right font-semibold">{totalMessages > 0 ? (totalMessages / 30).toFixed(1) : 0}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Inbound / Outbound ratio</td>
                  <td className="py-2 text-right font-semibold">
                    {totalOutbound > 0 ? `${(totalInbound / totalOutbound).toFixed(2)}:1` : 'N/A'}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">New Contacts (30 days)</td>
                  <td className="py-2 text-right font-semibold">{totalContacts}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Open Conversations</td>
                  <td className="py-2 text-right font-semibold">{openConversations}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Total Deals</td>
                  <td className="py-2 text-right font-semibold">{totalDeals}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Win Rate</td>
                  <td className="py-2 text-right font-semibold">
                    {totalDeals > 0 ? `${((wonDeals / totalDeals) * 100).toFixed(1)}%` : 'N/A'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2">Total Won Value</td>
                  <td className="py-2 text-right font-semibold">${wonValue.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
