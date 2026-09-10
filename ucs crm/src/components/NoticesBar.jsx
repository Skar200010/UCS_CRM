import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/auth';
import { useRealtime } from '../hooks/useRealtime';

const MAX_VISIBLE = 5;

const TARGET_LABELS = {
  all: null,
  admin: 'Admin',
  accounts: 'Accounts',
  hr: 'HR',
  recruiter: 'Recruiter',
  fro: 'FRO',
  event_head: 'Event Head',
  event_manager: 'Event Manager',
  worker: 'Worker',
};

const barSeenKey = () => {
  try {
    const u = localStorage.getItem('ucs_user');
    if (u) {
      const parsed = JSON.parse(u);
      if (parsed && parsed.id != null) return `nc_bar_dismissed_${parsed.id}`;
    }
  } catch { /* ignore */ }
  return 'nc_bar_dismissed';
};

const readDismissed = (key) => {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set(); }
};

const addDismissed = (key, id) => {
  try {
    const s = readDismissed(key);
    s.add(String(id));
    localStorage.setItem(key, JSON.stringify([...s]));
  } catch { /* ignore */ }
};

function getRole() {
  try {
    const u = localStorage.getItem('ucs_user');
    if (u) return JSON.parse(u).role;
  } catch { return null; }
}

const isImageUrl = (url, type) => {
  const t = String(type || '').toLowerCase();
  const u = String(url || '').toLowerCase();
  if (t.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif)(\?|$)/.test(u);
};

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return ''; }
};

export default function NoticesBar() {
  const [items, setItems] = useState([]);
  const dismissedKeyRef = useRef(barSeenKey());
  const dismissedRef = useRef(readDismissed(dismissedKeyRef.current));
  const role = getRole();

  const refresh = useCallback(async () => {
    try {
      const r = await api(`/notices${role ? `?target_role=${role}` : ''}`, { _prefix: 'ucs' });
      const arr = Array.isArray(r) ? r : (r?.data || []);
      const visible = arr
        .filter(n => n.is_active !== false)
        .filter(n => !dismissedRef.current.has(String(n.id)))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, MAX_VISIBLE);
      setItems(visible);
    } catch { /* 401/offline — ignore */ }
  }, [role]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [refresh]);

  useRealtime('notices', { event: '*', onInsert: refresh, onUpdate: refresh, onDelete: refresh });

  const dismiss = useCallback((id) => {
    addDismissed(dismissedKeyRef.current, id);
    dismissedRef.current.add(String(id));
    setItems(prev => prev.filter(n => String(n.id) !== String(id)));
  }, []);

  if (!items.length) return null;

  return (
    <div style={{
      position: 'fixed',
      right: 16,
      bottom: 16,
      zIndex: 950,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      maxWidth: 'min(380px, calc(100vw - 32px))',
    }}>
      {items.map(n => {
        const showImg = n.media_url && isImageUrl(n.media_url, n.media_type);
        return (
          <div key={n.id} style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderLeft: '4px solid #2563eb',
            borderRadius: 14,
            padding: '12px 14px',
            boxShadow: '0 10px 30px -8px rgba(15,23,42,.25), 0 2px 6px rgba(15,23,42,.06)',
            animation: 'nc-pop .4s cubic-bezier(.22,1,.36,1)',
            position: 'relative',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{
                width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                background: 'linear-gradient(135deg,#2563eb,#60a5fa)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(37,99,235,.3)',
              }}>
                <span style={{ fontSize: 15 }}>🔔</span>
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: 999 }}>Notice</span>
                  {TARGET_LABELS[n.target_role] && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#dcfce7', color: '#15803d', whiteSpace: 'nowrap' }}>
                      {TARGET_LABELS[n.target_role]}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginTop: 5, lineHeight: 1.35 }}>{n.title}</div>
                {(n.description || n.content) && (
                  <div style={{ fontSize: 12.5, color: '#475569', marginTop: 4, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                    {(n.description || n.content).length > 200 ? `${(n.description || n.content).slice(0, 200)}…` : (n.description || n.content)}
                  </div>
                )}
                {showImg && (
                  <img src={n.media_url} alt="" style={{ marginTop: 8, width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 9, border: '1px solid #eef2f7', cursor: 'pointer' }}
                    onClick={() => window.open(n.media_url, '_blank', 'noopener')} />
                )}
                <div style={{ marginTop: 7, display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: '#94a3b8', fontWeight: 600 }}>
                  <span>📅 {fmtDate(n.created_at)}</span>
                  {n.created_by_name && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✍️ {n.created_by_name}</span>}
                </div>
              </div>
              <button onClick={() => dismiss(n.id)} title="Dismiss"
                style={{
                  width: 24, height: 24, padding: 0, flexShrink: 0,
                  background: '#f1f5f9', border: 'none', borderRadius: 7, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#64748b', fontWeight: 700, fontSize: 12, fontFamily: 'inherit',
                  transition: 'background .15s, color .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#fecaca'; e.currentTarget.style.color = '#dc2626'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
              >✕</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}