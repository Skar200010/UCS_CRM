import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Plus, Play, Pause, Bot } from 'lucide-react';
import { toast } from 'sonner';
import type { AutomationFlow } from 'shared';

export function AutomationsPage() {
  const queryClient = useQueryClient();

  const { data: flows, isLoading } = useQuery<AutomationFlow[]>({
    queryKey: ['automations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automation_flows')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as AutomationFlow[];
    },
  });

  const handleToggleStatus = async (flow: AutomationFlow) => {
    const newStatus = flow.status === 'active' ? 'paused' : 'active';
    const { error } = await supabase
      .from('automation_flows')
      .update({ status: newStatus })
      .eq('id', flow.id);

    if (error) {
      toast.error('Failed to update flow status');
      return;
    }
    toast.success(`Flow ${newStatus === 'active' ? 'activated' : 'paused'}`);
    queryClient.invalidateQueries({ queryKey: ['automations'] });
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    active: 'bg-green-100 text-green-700',
    paused: 'bg-yellow-100 text-yellow-700',
    archived: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Automations</h1>
          <p className="text-muted-foreground">Build chatbots, auto-replies, and drip campaigns</p>
        </div>
        <Link to="/automations/new">
          <Button>
            <Plus className="h-4 w-4" />
            New Flow
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="mb-4 h-5 w-32 animate-pulse rounded bg-muted" />
                <div className="h-4 w-48 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : flows && flows.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {flows.map((flow) => (
            <Card key={flow.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-lg">{flow.name}</CardTitle>
                  {flow.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{flow.description}</p>
                  )}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[flow.status]}`}>
                  {flow.status}
                </span>
              </CardHeader>
              <CardContent>
                <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="capitalize">{flow.type?.replace('_', ' ')}</span>
                  {flow.trigger_type && <span>Trigger: {flow.trigger_type}</span>}
                </div>
                <div className="flex gap-2">
                  <Link to={`/automations/${flow.id}`}>
                    <Button variant="outline" size="sm">Edit</Button>
                  </Link>
                  <Button
                    variant={flow.status === 'active' ? 'secondary' : 'default'}
                    size="sm"
                    onClick={() => handleToggleStatus(flow)}
                  >
                    {flow.status === 'active' ? (
                      <><Pause className="h-3 w-3" /> Pause</>
                    ) : (
                      <><Play className="h-3 w-3" /> Activate</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <Bot className="h-16 w-16 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No automations yet</h3>
            <p className="text-sm text-muted-foreground">Create your first automation flow to auto-reply to messages or build a chatbot</p>
            <Link to="/automations/new">
              <Button>
                <Plus className="h-4 w-4" />
                Create your first flow
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
