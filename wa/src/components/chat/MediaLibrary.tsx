import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { X, QrCode, FileText, Image as ImageIcon, Upload, Loader2 } from 'lucide-react';

interface MediaLibraryModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string, name: string, type: string) => void;
  tenantId: string;
}

export function MediaLibraryModal({ open, onClose, onSelect, tenantId }: MediaLibraryModalProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const { data: mediaItems, isLoading } = useQuery({
    queryKey: ['media-library', activeCategory],
    queryFn: async () => {
      let query = supabase
        .from('media_library')
        .select('*')
        .order('created_at', { ascending: false });

      if (activeCategory) query = query.eq('category', activeCategory);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 16 * 1024 * 1024) return;
    setUploading(true);
    try {
      const fileName = `media-library/${tenantId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(fileName);

      const category = file.type.startsWith('image/') ? 'image' : 'document';

      await supabase.from('media_library').insert({
        tenant_id: tenantId,
        name: file.name,
        category: activeCategory || category,
        label: activeCategory || 'general',
        file_url: publicUrl,
        file_type: file.type,
        file_size: file.size,
      });

      queryClient.invalidateQueries({ queryKey: ['media-library'] });
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleSelect = (item: any) => {
    onSelect(item.file_url, item.name, item.category);
    onClose();
  };

  const CATEGORIES = [
    { value: 'qr', label: 'QR Codes', icon: QrCode },
    { value: 'receipt', label: 'Receipts', icon: FileText },
    { value: 'image', label: 'Images', icon: ImageIcon },
    { value: 'document', label: 'Documents', icon: FileText },
  ];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">Media Library</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2 border-b px-4 py-2">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(activeCategory === cat.value ? null : cat.value)}
                className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${
                  activeCategory === cat.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {cat.label}
              </button>
            );
          })}
          <label className={`ml-auto flex cursor-pointer items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${
            uploading ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}>
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload
            <input type="file" accept="image/*,.pdf" onChange={handleUpload} className="hidden" disabled={uploading} />
          </label>
        </div>

        <div className="max-h-80 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : mediaItems && mediaItems.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {mediaItems.map((item: any) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className="group relative overflow-hidden rounded-lg border p-2 text-left transition-all hover:border-primary hover:shadow-md"
                >
                  {item.file_type?.startsWith('image/') ? (
                    <img src={item.file_url} alt={item.name} className="h-20 w-full rounded object-cover" />
                  ) : (
                    <div className="flex h-20 items-center justify-center rounded bg-muted">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <p className="mt-1 truncate text-xs text-muted-foreground">{item.name}</p>
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 transition-all group-hover:bg-black/10">
                    <span className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100">
                      Select
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <Upload className="mx-auto mb-2 h-8 w-8" />
              <p className="text-sm">No media uploaded yet</p>
              <p className="text-xs">Upload QR codes or receipt templates to quickly attach them to messages</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
