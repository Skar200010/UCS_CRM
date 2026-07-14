import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { X, Plus, Tag } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

const LABEL_COLORS: Record<string, string> = {
  important: 'bg-red-100 text-red-700 border-red-200',
  followup: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  spam: 'bg-gray-100 text-gray-700 border-gray-200',
  urgent: 'bg-orange-100 text-orange-700 border-orange-200',
};

interface ConversationLabelsProps {
  conversationId: string;
  currentLabels: string[];
}

export function ConversationLabels({ conversationId, currentLabels }: ConversationLabelsProps) {
  const [labels, setLabels] = useState<string[]>(currentLabels || []);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const queryClient = useQueryClient();

  const updateLabels = async (newLabels: string[]) => {
    const { error } = await supabase
      .from('conversations')
      .update({ labels: newLabels })
      .eq('id', conversationId);
    if (!error) {
      setLabels(newLabels);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  };

  const addLabel = () => {
    const label = newLabel.trim().toLowerCase();
    if (!label || labels.includes(label)) return;
    updateLabels([...labels, label]);
    setNewLabel('');
    setAdding(false);
  };

  const removeLabel = (label: string) => {
    updateLabels(labels.filter((l) => l !== label));
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {labels.map((label) => (
        <span
          key={label}
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${
            LABEL_COLORS[label] || 'bg-purple-100 text-purple-700 border-purple-200'
          }`}
        >
          <Tag className="h-3 w-3" />
          {label}
          <button onClick={() => removeLabel(label)} className="ml-0.5 hover:opacity-70">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {adding ? (
        <div className="flex items-center gap-1">
          <Input
            value={newLabel}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewLabel(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && addLabel()}
            placeholder="label name"
            className="h-7 w-28 text-xs"
            autoFocus
          />
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={addLabel}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      ) : (
          <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
        >
          <Plus className="h-3 w-3" />
          Label
        </button>
      )}
    </div>
  );
}

interface LabelFilterProps {
  selectedLabel: string | null;
  onSelect: (label: string | null) => void;
  allLabels: string[];
}

export function LabelFilter({ selectedLabel, onSelect, allLabels }: LabelFilterProps) {
  const uniqueLabels = [...new Set(allLabels)];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        onClick={() => onSelect(null)}
        className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
          !selectedLabel ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
        }`}
      >
        All
      </button>
      {uniqueLabels.map((label) => (
        <button
          key={label}
          onClick={() => onSelect(selectedLabel === label ? null : label)}
          className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
            selectedLabel === label ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
