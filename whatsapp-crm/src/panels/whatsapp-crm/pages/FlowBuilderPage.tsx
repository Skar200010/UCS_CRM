import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Save, ArrowLeft, MessageSquare, Clock, GitBranch, Tag, User, Code, X } from 'lucide-react';
import { toast } from 'sonner';
import type { AutomationFlow } from 'shared';

const nodeTypeLabels: Record<string, { label: string; icon: typeof MessageSquare; color: string }> = {
  send_message: { label: 'Send Message', icon: MessageSquare, color: '#2563eb' },
  wait: { label: 'Wait / Delay', icon: Clock, color: '#ca8a04' },
  condition: { label: 'Condition', icon: GitBranch, color: '#9333ea' },
  add_tag: { label: 'Add Tag', icon: Tag, color: '#16a34a' },
  assign_agent: { label: 'Assign Agent', icon: User, color: '#dc2626' },
  api_call: { label: 'API Call', icon: Code, color: '#6366f1' },
};

interface FlowNodeData {
  [key: string]: unknown;
  label: string;
  stepType: string;
  config: Record<string, unknown>;
}

function FlowNodeComponent({ data }: { data: FlowNodeData }) {
  const info = nodeTypeLabels[data.stepType] || { label: data.stepType, icon: MessageSquare, color: '#6b7280' };
  const Icon = info.icon;

  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm" style={{ borderLeftColor: info.color, borderLeftWidth: 3, minWidth: 180 }}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color: info.color }} />
        <span className="text-sm font-medium">{info.label}</span>
      </div>
      {typeof data.config?.message === 'string' && (
        <p className="mt-1 text-xs text-muted-foreground truncate">{data.config.message}</p>
      )}
      {typeof data.config?.duration === 'number' && (
        <p className="mt-1 text-xs text-muted-foreground">{data.config.duration}h delay</p>
      )}
    </div>
  );
}

const customNodeTypes: NodeTypes = {
  custom: FlowNodeComponent,
};

export function FlowBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [flowName, setFlowName] = useState('');
  const [flowDescription, setFlowDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node<FlowNodeData> | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const isNew = !id || id === 'new';

  const { data: flow } = useQuery<AutomationFlow | null>({
    queryKey: ['automation-flow', id],
    queryFn: async () => {
      if (!id || id === 'new') return null;
      const { data, error } = await supabase.from('automation_flows').select('*').eq('id', id).single();
      if (error) throw error;
      return data as AutomationFlow;
    },
    enabled: !!id && id !== 'new',
  });

  useEffect(() => {
    if (flow) {
      setFlowName(flow.name);
      setFlowDescription(flow.description || '');
      const fd = flow.flow_data as { nodes?: Node<FlowNodeData>[]; edges?: Edge[] } | undefined;
      if (fd?.nodes) setNodes(fd.nodes);
      if (fd?.edges) setEdges(fd.edges);
    }
  }, [flow, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed } }, eds));
    },
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const stepType = event.dataTransfer.getData('application/reactflow');
      if (!stepType) return;
      const position = { x: event.clientX - 300, y: event.clientY - 100 };
      const newNode: Node<FlowNodeData> = {
        id: `node_${Date.now()}`,
        type: 'custom',
        position,
        data: { label: nodeTypeLabels[stepType]?.label || stepType, stepType, config: {} },
      };
      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  const addNode = (stepType: string) => {
    const position = { x: 250 + Math.random() * 100, y: 100 + nodes.length * 120 };
    const newNode: Node<FlowNodeData> = {
      id: `node_${Date.now()}`,
      type: 'custom',
      position,
      data: { label: nodeTypeLabels[stepType]?.label || stepType, stepType, config: {} },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const updateNodeConfig = (key: string, value: unknown) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode.id
          ? { ...n, data: { ...n.data, config: { ...n.data.config, [key]: value } } }
          : n
      )
    );
    setSelectedNode((prev) =>
      prev ? { ...prev, data: { ...prev.data, config: { ...prev.data.config, [key]: value } } } : prev
    );
  };

  const handleSave = async () => {
    if (!user || !flowName.trim()) {
      toast.error('Flow name is required');
      return;
    }
    setSaving(true);
    try {
      const flowData = { nodes, edges };
      if (isNew) {
        const { error } = await supabase.from('automation_flows').insert({
          tenant_id: user.tenant_id,
          name: flowName.trim(),
          description: flowDescription.trim() || null,
          type: 'chatbot',
          status: 'draft',
          flow_data: flowData,
          created_by: user.id,
        });
        if (error) throw error;
        toast.success('Flow created');
      } else {
        const { error } = await supabase
          .from('automation_flows')
          .update({ name: flowName.trim(), description: flowDescription.trim() || null, flow_data: flowData })
          .eq('id', id);
        if (error) throw error;
        toast.success('Flow saved');
      }
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      navigate('/automations');
    } catch (error) {
      console.error('Error saving flow:', error);
      toast.error('Failed to save flow');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="flex items-center justify-between border-b bg-card px-4 py-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/automations')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Input
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            placeholder="Flow name..."
            className="w-64 border-0 text-lg font-semibold focus-visible:ring-0"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/automations')}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4" />
            Save
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-60 border-r bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Nodes</h3>
          <div className="space-y-2">
            {Object.entries(nodeTypeLabels).map(([type, info]) => {
              const Icon = info.icon;
              return (
                <button
                  key={type}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', type);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onClick={() => addNode(type)}
                  className="flex w-full items-center gap-2 rounded-lg border p-2 text-sm transition-colors hover:bg-accent"
                >
                  <Icon className="h-4 w-4" style={{ color: info.color }} />
                  <span>{info.label}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-6 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            Drag nodes onto the canvas or click to add them
          </div>
        </div>

        <div className="flex-1" onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNode(node as unknown as Node<FlowNodeData>)}
            nodeTypes={customNodeTypes}
            fitView
          >
            <Controls />
            <Background />
          </ReactFlow>
        </div>

        {selectedNode && (
          <div className="w-72 border-l bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Node Properties</h3>
              <Button variant="ghost" size="icon" onClick={() => setSelectedNode(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <div className="text-sm font-medium capitalize">{nodeTypeLabels[selectedNode.data.stepType]?.label}</div>
              </div>

              {selectedNode.data.stepType === 'send_message' && (
                <div className="space-y-1">
                  <Label className="text-xs">Message text</Label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                    placeholder="Type the message..."
                    value={(selectedNode.data.config?.message as string) || ''}
                    onChange={(e) => updateNodeConfig('message', e.target.value)}
                  />
                </div>
              )}

              {selectedNode.data.stepType === 'wait' && (
                <div className="space-y-1">
                  <Label className="text-xs">Delay (hours)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={(selectedNode.data.config?.duration as number) || 0}
                    onChange={(e) => updateNodeConfig('duration', Number(e.target.value))}
                  />
                </div>
              )}

              {selectedNode.data.stepType === 'add_tag' && (
                <div className="space-y-1">
                  <Label className="text-xs">Tag name</Label>
                  <Input
                    placeholder="tag-name"
                    value={(selectedNode.data.config?.tag as string) || ''}
                    onChange={(e) => updateNodeConfig('tag', e.target.value)}
                  />
                </div>
              )}

              {selectedNode.data.stepType === 'assign_agent' && (
                <div className="space-y-1">
                  <Label className="text-xs">User ID</Label>
                  <Input
                    placeholder="user-uuid"
                    value={(selectedNode.data.config?.user_id as string) || ''}
                    onChange={(e) => updateNodeConfig('user_id', e.target.value)}
                  />
                </div>
              )}

              {selectedNode.data.stepType === 'condition' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Variable</Label>
                    <Input
                      placeholder="contact.tag"
                      value={(selectedNode.data.config?.variable as string) || ''}
                      onChange={(e) => updateNodeConfig('variable', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Operator</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={(selectedNode.data.config?.operator as string) || 'equals'}
                      onChange={(e) => updateNodeConfig('operator', e.target.value)}
                    >
                      <option value="equals">Equals</option>
                      <option value="contains">Contains</option>
                      <option value="greater_than">Greater than</option>
                      <option value="less_than">Less than</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Value</Label>
                    <Input
                      placeholder="value"
                      value={(selectedNode.data.config?.value as string) || ''}
                      onChange={(e) => updateNodeConfig('value', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {selectedNode.data.stepType === 'api_call' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">URL</Label>
                    <Input
                      placeholder="https://api.example.com/webhook"
                      value={(selectedNode.data.config?.url as string) || ''}
                      onChange={(e) => updateNodeConfig('url', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Method</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={(selectedNode.data.config?.method as string) || 'POST'}
                      onChange={(e) => updateNodeConfig('method', e.target.value)}
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                    setEdges((eds: Edge[]) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
                    setSelectedNode(null);
                  }}
                >
                  Delete Node
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
