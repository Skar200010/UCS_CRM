import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Building2, Users, MessageSquare, Activity } from 'lucide-react';

export function AdminDashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      const [tenants, users, messages, conversations] = await Promise.all([
        supabase.from('tenants').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('conversations').select('*', { count: 'exact', head: true }),
      ]);
      return {
        tenants: tenants.count || 0,
        users: users.count || 0,
        messages: messages.count || 0,
        conversations: conversations.count || 0,
      };
    },
  });

  const statCards = [
    { title: 'Total Tenants', value: stats?.tenants || 0, icon: Building2, color: 'text-blue-600' },
    { title: 'Total Users', value: stats?.users || 0, icon: Users, color: 'text-green-600' },
    { title: 'Total Conversations', value: stats?.conversations || 0, icon: MessageSquare, color: 'text-yellow-600' },
    { title: 'Total Messages', value: stats?.messages || 0, icon: Activity, color: 'text-primary' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Platform-wide overview</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <a href="/admin/tenants" className="rounded-lg border p-4 transition-colors hover:bg-accent">
            <Building2 className="mb-2 h-6 w-6 text-blue-600" />
            <h3 className="font-medium">Manage Tenants</h3>
            <p className="text-sm text-muted-foreground">View and manage all tenants</p>
          </a>
          <a href="/admin/metrics" className="rounded-lg border p-4 transition-colors hover:bg-accent">
            <Activity className="mb-2 h-6 w-6 text-green-600" />
            <h3 className="font-medium">Platform Metrics</h3>
            <p className="text-sm text-muted-foreground">View platform usage statistics</p>
          </a>
          <a href="/admin/webhooks" className="rounded-lg border p-4 transition-colors hover:bg-accent">
            <MessageSquare className="mb-2 h-6 w-6 text-primary" />
            <h3 className="font-medium">Webhook Logs</h3>
            <p className="text-sm text-muted-foreground">Monitor webhook activity</p>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
