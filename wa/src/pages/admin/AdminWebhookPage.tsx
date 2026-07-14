import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Webhook } from 'lucide-react';

export function AdminWebhookPage() {
  const { data: logs } = useQuery({
    queryKey: ['admin-webhooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_webhook_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Webhook Logs</h1>
        <p className="text-muted-foreground">Monitor incoming webhook events</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Webhook Events ({logs?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {logs && logs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Time</th>
                    <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Event Type</th>
                    <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Direction</th>
                    <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Processed</th>
                    <th className="pb-3 text-left text-sm font-medium text-muted-foreground">Tenant ID</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log: { id: string; created_at: string; event_type: string; direction: string | null; processed: boolean; tenant_id: string | null }) => (
                    <tr key={log.id} className="border-b text-sm">
                      <td className="py-2 text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-2">{log.event_type}</td>
                      <td className="py-2 capitalize">{log.direction || 'inbound'}</td>
                      <td className="py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                          log.processed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {log.processed ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="py-2 font-mono text-xs">{log.tenant_id ? log.tenant_id.slice(0, 8) + '...' : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <Webhook className="h-12 w-12" />
              <p className="text-lg font-medium">No webhook events yet</p>
              <p className="text-sm">Webhook events will appear here when Meta sends them</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
