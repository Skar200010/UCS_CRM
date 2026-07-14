import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { X } from 'lucide-react';
import type { Deal, Contact, PipelineStage } from 'shared';

const dealSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  value: z.string().optional(),
  currency: z.string().default('USD'),
  notes: z.string().optional(),
  contact_id: z.string().min(1, 'Contact is required'),
  stage_id: z.string().min(1, 'Stage is required'),
});

type DealForm = z.infer<typeof dealSchema>;

interface DealFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  deal?: Deal | null;
  defaultStageId?: string | null;
}

export function DealFormModal({ open, onClose, onSuccess, deal, defaultStageId }: DealFormModalProps) {
  const { user } = useAuthStore();
  const [saving, setSaving] = useState(false);

  const { data: contacts } = useQuery({
    queryKey: ['contacts-dropdown'],
    queryFn: async () => {
      const { data, error } = await supabase.from('contacts').select('id, first_name, last_name, phone').order('first_name');
      if (error) throw error;
      return data as Pick<Contact, 'id' | 'first_name' | 'last_name' | 'phone'>[];
    },
    enabled: open,
  });

  const { data: stages } = useQuery({
    queryKey: ['pipeline-stages-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pipeline_stages').select('*').order('position');
      if (error) throw error;
      return data as PipelineStage[];
    },
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      title: deal?.title || '',
      value: deal?.value?.toString() || '',
      currency: deal?.currency || 'USD',
      notes: deal?.notes || '',
      contact_id: deal?.contact_id || '',
      stage_id: deal?.stage_id || defaultStageId || '',
    },
  });

  const onSubmit = async (data: DealForm) => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        tenant_id: user.tenant_id,
        title: data.title,
        value: data.value ? parseFloat(data.value) : null,
        currency: data.currency,
        notes: data.notes || null,
        contact_id: data.contact_id,
        stage_id: data.stage_id,
      };

      if (deal) {
        const { error } = await supabase.from('deals').update(payload).eq('id', deal.id);
        if (error) throw error;
      } else {
        const pipelineId = stages?.find((s) => s.id === data.stage_id)?.pipeline_id;
        const { error } = await supabase.from('deals').insert({
          ...payload,
          pipeline_id: pipelineId,
        });
        if (error) throw error;
      }

      reset();
      onSuccess();
    } catch (error) {
      console.error('Error saving deal:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">{deal ? 'Edit Deal' : 'Add Deal'}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" placeholder="Deal title" {...register('title')} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_id">Contact *</Label>
            <select
              id="contact_id"
              {...register('contact_id')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select a contact...</option>
              {contacts?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name} ({c.phone})
                </option>
              ))}
            </select>
            {errors.contact_id && <p className="text-sm text-destructive">{errors.contact_id.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="stage_id">Stage *</Label>
            <select
              id="stage_id"
              {...register('stage_id')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select a stage...</option>
              {stages?.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {errors.stage_id && <p className="text-sm text-destructive">{errors.stage_id.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="value">Value</Label>
              <Input id="value" type="number" step="0.01" placeholder="1000" {...register('value')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                {...register('currency')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="INR">INR</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              {...register('notes')}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : deal ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
