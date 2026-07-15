import { useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  messageId: string;
  onDeleteForMe: (id: string) => void;
  onClose: () => void;
}

export function MessageContextMenu({ x, y, messageId, onDeleteForMe, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    if (rect.right > window.innerWidth) ref.current.style.left = (window.innerWidth - rect.width - 10) + 'px';
    if (rect.bottom > window.innerHeight) ref.current.style.top = (y - rect.height) + 'px';
  }, [x, y]);

  return (
    <div
      ref={ref}
      className="fixed z-50 w-52 rounded-xl border bg-white py-1 shadow-lg"
      style={{ left: x, top: y }}
    >
      <button
        onClick={() => { onDeleteForMe(messageId); onClose(); }}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#111b21] hover:bg-[#f0f2f5]"
      >
        <Trash2 className="h-4 w-4 text-[#667781]" />
        Delete message
      </button>
    </div>
  );
}
