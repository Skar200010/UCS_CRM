import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { BarChart3, TrendingUp, Users, MessageSquare } from 'lucide-react';

export function AdminMetricsPage() {
  const { data: signups } = useQuery({
    queryKey: ['admin-signups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('created_at')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at');
      if (error) throw error;

      const byDay: Record<string, number> = {};
      data.forEach((t: { created_at: string }) => {
        const day = new Date(t.created_at).toISOString().split('T')[0];
        byDay[day] = (byDay[day] || 0) + 1;
      });
      return Object.entries(byDay).map(([date, count]) => ({ date, count }));
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Platform Metrics</h1>
        <p className="text-muted-foreground">Usage statistics and trends</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>New Signups (Last 30 Days)</CardTitle>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            {signups && signups.length > 0 ? (
              <div className="space-y-2">
                {signups.map((s) => (
                  <div key={s.date} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{s.date}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(s.count * 20, 100)}px` }} />
                      <span className="font-medium">{s.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <BarChart3 className="h-8 w-8" />
                <p className="text-sm">No signup data available yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Platform Overview</CardTitle>
              <Users className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm font-medium">Active Tenants</p>
                  <p className="text-xs text-muted-foreground">Currently using the platform</p>
                </div>
              </div>
              <p className="text-2xl font-bold">-</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Messages Today</p>
                  <p className="text-xs text-muted-foreground">Sent and received</p>
                </div>
              </div>
              <p className="text-2xl font-bold">-</p>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Detailed metrics will populate after the analytics migration is run
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
