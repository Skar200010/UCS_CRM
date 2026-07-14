import { useState, useEffect } from 'react';
import { X, FileText, Download, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';

interface MediaPreviewProps {
  url?: string;
  mimeType?: string;
  caption?: string;
  className?: string;
}

export function MediaPreview({ url, mimeType, caption, className }: MediaPreviewProps) {
  if (!url) return null;
  const isImage = mimeType?.startsWith('image/');
  const isVideo = mimeType?.startsWith('video/');
  const isAudio = mimeType?.startsWith('audio/');
  const isPdf = mimeType === 'application/pdf';

  return (
    <div className={cn('overflow-hidden rounded-lg', className)}>
      {isImage ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img src={url} alt={caption || 'Image'} className="max-w-full cursor-pointer rounded-lg object-cover" />
        </a>
      ) : isVideo ? (
        <video controls className="max-w-full rounded-lg">
          <source src={url} type={mimeType} />
        </video>
      ) : isAudio ? (
        <audio controls className="w-full rounded-lg">
          <source src={url} type={mimeType} />
        </audio>
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border bg-muted p-3 text-sm hover:bg-accent"
        >
          {isPdf ? <FileText className="h-5 w-5 text-red-500" /> : <Download className="h-5 w-5 text-blue-500" />}
          <span className="truncate">{caption || 'Download file'}</span>
        </a>
      )}
      {caption && <p className="mt-1 text-xs text-muted-foreground">{caption}</p>}
    </div>
  );
}

interface FileUploadButtonProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export function FileUploadButton({ onFileSelect, disabled }: FileUploadButtonProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 16 * 1024 * 1024) {
        alert('File size must be less than 16MB');
        return;
      }
      onFileSelect(file);
    }
    e.target.value = '';
  };

  return (
    <label className="cursor-pointer">
      <input type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx" onChange={handleChange} className="hidden" disabled={disabled} />
      <svg className="h-5 w-5 text-muted-foreground hover:text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
      </svg>
    </label>
  );
}

interface MediaUploadPreviewProps {
  file: File;
  onRemove: () => void;
}

export function MediaUploadPreview({ file, onRemove }: MediaUploadPreviewProps) {
  const [preview, setPreview] = useState<string | null>(null);

  useState(() => {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  });

  return (
    <div className="relative mb-2 inline-block rounded-lg border p-2">
      {preview ? (
        <img src={preview} alt="Preview" className="max-h-32 rounded object-contain" />
      ) : (
        <div className="flex items-center gap-2 p-2">
          <FileText className="h-6 w-6 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{file.name}</span>
        </div>
      )}
      <button onClick={onRemove} className="absolute -right-2 -top-2 rounded-full bg-destructive p-0.5 text-destructive-foreground">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function MediaFromMeta({ mediaId, mimeType }: { mediaId: string; mimeType?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: accounts } = await supabase
        .from('whatsapp_accounts')
        .select('access_token')
        .eq('is_active', true)
        .limit(1);
      if (!accounts?.[0] || cancelled) { setLoading(false); return; }
      try {
        const res = await fetch(`https://graph.facebook.com/v23.0/${mediaId}`, {
          headers: { Authorization: `Bearer ${accounts[0].access_token}` },
        });
        const data = await res.json();
        if (!cancelled && data.url) setUrl(data.url);
      } catch {} finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [mediaId]);

  if (loading) return <Loader2 className="mt-1 h-4 w-4 animate-spin text-muted-foreground" />;
  if (!url) return null;
  return <MediaPreview url={url} mimeType={mimeType} />;
}
