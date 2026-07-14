import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { Deal, PipelineStage } from 'shared';
import { DealFormModal } from './DealFormModal';

interface DealCardProps {
  deal: Deal;
  onEdit: (deal: Deal) => void;
}

function DealCard({ deal, onEdit }: DealCardProps) {
  return (
    <button
      onClick={() => onEdit(deal)}
      className="w-full rounded-lg border bg-card p-3 text-left shadow-sm transition-all hover:shadow-md"
    >
      <div className="font-medium">{deal.title}</div>
      <div className="mt-2 flex items-center justify-between">
        {deal.value && (
          <span className="text-sm font-semibold">
            {deal.currency} {Number(deal.value).toLocaleString()}
          </span>
        )}
        <span className="text-xs text-muted-foreground capitalize">{deal.status}</span>
      </div>
    </button>
  );
}

export function PipelineBoard() {
  const queryClient = useQueryClient();
  const [showDealForm, setShowDealForm] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  const { data: pipelines } = useQuery({
    queryKey: ['pipelines'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pipelines').select('*').order('created_at');
      if (error) throw error;
      return data;
    },
  });

  const { data: stages } = useQuery({
    queryKey: ['pipeline-stages', pipelines?.[0]?.id],
    queryFn: async () => {
      if (!pipelines?.[0]?.id) return [];
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('pipeline_id', pipelines[0].id)
        .order('position');
      if (error) throw error;
      return data as PipelineStage[];
    },
    enabled: !!pipelines?.[0]?.id,
  });

  const { data: deals } = useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('*, contact:contacts(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Deal[];
    },
  });

  const handleAddDeal = (stageId: string) => {
    setEditingDeal(null);
    setSelectedStageId(stageId);
    setShowDealForm(true);
  };

  const handleEditDeal = (deal: Deal) => {
    setEditingDeal(deal);
    setSelectedStageId(null);
    setShowDealForm(true);
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['deals'] });
    queryClient.invalidateQueries({ queryKey: ['pipelines'] });
    setShowDealForm(false);
    setEditingDeal(null);
  };

  const getDealsForStage = (stageId: string) =>
    deals?.filter((d) => d.stage_id === stageId) || [];

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4 overflow-x-auto pb-4">
      {stages?.map((stage) => (
        <div key={stage.id} className="flex w-72 flex-shrink-0 flex-col">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: stage.color || '#6b7280' }}
              />
              <h3 className="font-semibold">{stage.name}</h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {getDealsForStage(stage.id).length}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6"
              onClick={() => handleAddDeal(stage.id)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-col gap-2 overflow-y-auto rounded-lg bg-muted/30 p-2">
            {getDealsForStage(stage.id).length === 0 && (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                No deals yet
              </div>
            )}
            {getDealsForStage(stage.id).map((deal) => (
              <DealCard key={deal.id} deal={deal} onEdit={handleEditDeal} />
            ))}
          </div>
        </div>
      ))}

      {(!stages || stages.length === 0) && (
        <div className="flex w-full flex-col items-center justify-center gap-3 text-muted-foreground">
          <p className="text-lg font-medium">No pipeline configured</p>
          <p className="text-sm">Create a pipeline in settings to start tracking deals</p>
        </div>
      )}

      <DealFormModal
        open={showDealForm}
        onClose={() => { setShowDealForm(false); setEditingDeal(null); }}
        onSuccess={handleSuccess}
        deal={editingDeal}
        defaultStageId={selectedStageId}
      />
    </div>
  );
}
