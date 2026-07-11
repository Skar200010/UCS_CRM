import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { MessageSquare, Plus, RefreshCw, Loader2, Trash2, Edit3, X, Search } from 'lucide-react';
import { toast } from 'sonner';

interface TemplateRecord {
  id: number;
  project: string;
  name: string;
  language: string;
  category: string;
  status: string;
  meta_template_id: string | null;
  components: any;
  created_at: string;
  updated_at: string;
}

function TemplateStatus({ status }: { status: string }) {
  const variant = status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'warning';
  return <Badge variant={variant}>{status}</Badge>;
}

export function TemplatesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const { data: templates, isLoading } = useQuery<TemplateRecord[]>({
    queryKey: ['whatsapp-templates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('whatsapp_templates').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as TemplateRecord[];
    },
  });

  const projectCounts = useMemo(() => {
    if (!templates) return {};
    return templates.reduce((acc: Record<string, number>, t) => {
      acc[t.project] = (acc[t.project] || 0) + 1;
      return acc;
    }, {});
  }, [templates]);

  const activeFilterCount = [search, filterProject, filterStatus].filter(Boolean).length;

  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    return templates.filter((t) => {
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterProject && t.project !== filterProject) return false;
      if (filterStatus && t.status !== filterStatus) return false;
      return true;
    });
  }, [templates, search, filterProject, filterStatus]);

  const handleDelete = async (template: TemplateRecord) => {
    if (!confirm(`Delete template "${template.name}"?`)) return;
    await supabase.from('whatsapp_templates').delete().eq('id', template.id);
    toast.success('Deleted');
    queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
  };

  const clearFilters = () => {
    setSearch('');
    setFilterProject('');
    setFilterStatus('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Message Templates</h1>
          <p className="text-muted-foreground">Manage WhatsApp message templates</p>
        </div>
        <Button onClick={() => navigate('/templates/new')}>
          <Plus className="h-4 w-4" /> New Template
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Templates</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{templates?.length || 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{templates?.filter((t) => t.status === 'approved').length || 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-yellow-600">{templates?.filter((t) => t.status === 'pending').length || 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{templates?.filter((t) => t.status === 'rejected').length || 0}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates..." className="pl-9" />
            </div>
            <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[130px]">
              <option value="">Project</option>
              {Object.entries(projectCounts).map(([proj, count]) => (
                <option key={proj} value={proj}>{proj.toUpperCase()} ({count})</option>
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
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Project</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Category</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Language</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Created</th>
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTemplates.map((t) => (
                    <tr key={t.id} className="border-b text-sm">
                      <td className="py-3">
                        <p className="font-medium">{t.name}</p>
                      </td>
                      <td className="py-3">
                        <Badge variant="neutral" className="font-mono uppercase text-[10px]">{t.project}</Badge>
                      </td>
                      <td className="py-3 text-xs text-muted-foreground capitalize">{t.category || '-'}</td>
                      <td className="py-3">
                        <Badge variant={t.status === 'approved' ? 'success' : t.status === 'rejected' ? 'error' : 'warning'}>{t.status}</Badge>
                      </td>
                      <td className="py-3 text-muted-foreground uppercase text-xs">{t.language}</td>
                      <td className="py-3 text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/templates/${t.id}`)} title="Edit"><Edit3 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(t)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
