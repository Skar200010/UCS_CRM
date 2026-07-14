import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ArrowLeft, Users, MessageSquare, Smartphone, Activity } from 'lucide-react';
import type { Tenant, User } from 'shared';

export function AdminTenantDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: tenant } = useQuery({
    queryKey: ['admin-tenant', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('tenants').select('*').eq('id', id).single();
      if (error) throw error;
      return data as Tenant;
    },
    enabled: !!id,
  });

  const { data: tenantUsers } = useQuery({
    queryKey: ['admin-tenant-users', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('*').eq('tenant_id', id);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: tenantConversations } = useQuery({
    queryKey: ['admin-tenant-conversations', id],
    queryFn: async () => {
      const { count } = await supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('tenant_id', id);
      return count || 0;
    },
    enabled: !!id,
  });

  const { data: tenantMessages } = useQuery({
    queryKey: ['admin-tenant-messages', id],
    queryFn: async () => {
      const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('tenant_id', id);
      return count || 0;
    },
    enabled: !!id,
  });

  if (!tenant) return <div className="flex h-40 items-center justify-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/admin/tenants">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{tenant.name}</h1>
          <p className="text-muted-foreground">Tenant details and usage</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
          tenant.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {tenant.status}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Users</CardTitle>
            <Users className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenantUsers?.length || 0}</div>
            <p className="text-xs text-muted-foreground">of {tenant.max_users} max</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversations</CardTitle>
            <MessageSquare className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenantConversations}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages</CardTitle>
            <Activity className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenantMessages}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium">Slug</p>
              <p className="text-sm text-muted-foreground">{tenant.slug}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Max Users</p>
              <p className="text-sm text-muted-foreground">{tenant.max_users}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Max Contacts</p>
              <p className="text-sm text-muted-foreground">{tenant.max_contacts}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Created</p>
              <p className="text-sm text-muted-foreground">{new Date(tenant.created_at).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Users ({tenantUsers?.length || 0})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tenantUsers?.map((u: User) => (
                <div key={u.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{u.first_name} {u.last_name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
                    {u.role}
                  </span>
                </div>
              ))}
              {(!tenantUsers || tenantUsers.length === 0) && (
                <p className="text-sm text-muted-foreground">No users in this tenant</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Connected WhatsApp Numbers</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <Smartphone className="h-8 w-8" />
            <p className="text-sm">WhatsApp numbers will appear here when connected</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
