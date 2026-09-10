import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/auth';
import { useRealtime } from '../hooks/useRealtime';

const SEEN_KEY_BASE = 'nc_seen_v1';
const AUTO_CLOSE_MS = 5000;

const seenKeyFor = () => {
  try {
    const u = localStorage.getItem('ucs_user');
    if (u) {
      const parsed = JSON.parse(u);
      if (parsed && parsed.id != null) return `nc_seen_v1_${parsed.id}`;
    }
  } catch { /* ignore */ }
  return SEEN_KEY_BASE;
};

const readSet = (key) => {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set(); }
};
const addToSet = (key, id) => {
  try {
    const s = readSet(key);
    if (s.has(String(id))) return;
    s.add(String(id));
    localStorage.setItem(key, JSON.stringify([...s]));
  } catch { /* ignore */ }
};

const targetedAtSuperAdmin = (n) => {
  const raw = Array.isArray(n.target_roles) && n.target_roles.length
    ? n.target_roles
    : (n.target_role && !['all', 'null'].includes(String(n.target_role).toLowerCase()) ? [n.target_role] : ['all']);
  return raw.includes('all') || raw.includes('super_admin');
};

const NC_CSS = `
@keyframes nc-pop { 0% { transform: scale(.4); opacity: 0; } 60% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
@keyframes nc-countdown { from { width: 100%; } to { width: 0%; } }
`;

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

export const uploadImage = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api('/upload', { method: 'POST', body: formData, _prefix: 'ucs' });
};

export function useNoticesPopup() {
  const [list, setList] = useState([]);
  const [current, setCurrent] = useState(null);
  const seenKey = seenKeyFor();
  const seenRef = useRef(readSet(seenKey));
  const currentRef = useRef(null);
  const role = getRole();
  const lastDismissRef = useRef(0);
  const inflightRef = useRef(false);

  const markSeen = useCallback(async (id) => {
    if (id == null) return;
    try { await api(`/notices/${id}/seen`, { method: 'POST', body: JSON.stringify({}), _prefix: 'ucs' }); } catch { /* best-effort */ }
  }, []);

  const load = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    try {
      const r = await api(`/notices${role ? `?target_role=${role}` : ''}`, { _prefix: 'ucs' });
      const arr = Array.isArray(r) ? r : (r?.data || []);
      const isSuper = role === 'super_admin';
      const popups = arr
        .filter(n => n.is_active !== false && n.popup !== false && !n.seen && !seenRef.current.has(String(n.id)))
        .filter(n => !isSuper || targetedAtSuperAdmin(n))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setList(popups);
      const now = Date.now();
      if (now - lastDismissRef.current < 10000) return;
      const next = popups.find(n => !seenRef.current.has(String(n.id)));
      if (next) {
        addToSet(seenKey, next.id);
        seenRef.current.add(String(next.id));
        currentRef.current = next.id;
        setCurrent(next);
        markSeen(next.id);
      }
    } catch { /* 401/offline */ }
    finally { inflightRef.current = false; }
  }, [role, markSeen, seenKey]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  useRealtime('notices', { event: '*', onInsert: load, onUpdate: load, onDelete: load });

  const close = useCallback(() => {
    if (currentRef.current) markSeen(currentRef.current);
    currentRef.current = null;
    lastDismissRef.current = Date.now();
    setCurrent(null);
  }, [markSeen]);

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(close, AUTO_CLOSE_MS);
    return () => clearTimeout(t);
  }, [current, close]);

  return { current, close, list };
}

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return ''; }
};

export default function NoticePopup() {
  const { current, close } = useNoticesPopup();
  if (!current) return null;
  const showImg = current.media_url && isImageUrl(current.media_url, current.media_type);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99995, background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <style>{NC_CSS}</style>
      <div style={{ width: 'min(440px, 100%)', maxHeight: '92vh', overflowY: 'auto', borderRadius: 18, background: '#fff', boxShadow: '0 24px 60px rgba(0,0,0,.35)', animation: 'nc-pop .45s cubic-bezier(.22,1,.36,1)', position: 'relative', borderTop: '4px solid transparent' }}>
        <div style={{ height: 4, borderRadius: '18px 18px 0 0', background: 'linear-gradient(90deg,#2563eb,#7c3aed,#ec4899)', position: 'absolute', top: -4, left: 0, right: 0 }} />
        <div style={{ position: 'absolute', top: 12, right: 12, cursor: 'pointer', width: 30, height: 30, borderRadius: 50, background: 'var(--line, #f1f5f9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--ink, #0f172a)', zIndex: 2 }} onClick={close}>✕</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 18px 0' }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(135deg,#2563eb,#60a5fa)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 8px rgba(37,99,235,.3)' }}>
            <span style={{ fontSize: 17 }}>🔔</span>
          </span>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: '#2563eb', background: '#eff6ff', padding: '4px 10px', borderRadius: 999 }}>Notice</span>
        </div>
        <div style={{ padding: '10px 18px 18px' }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--ink, #0f172a)', marginTop: 4, lineHeight: 1.35 }}>{current.title}</div>
          {current.description && (
            <div style={{ fontSize: 13.5, color: 'var(--ink-soft, #475569)', lineHeight: 1.6, marginTop: 8 }}>{current.description}</div>
          )}
          {(!current.description && current.content) && (
            <div style={{ fontSize: 13.5, color: 'var(--ink-soft, #475569)', lineHeight: 1.6, marginTop: 8 }}>{current.content}</div>
          )}
          {showImg && (
            <img
              src={current.media_url}
              alt={current.media_name || current.title || 'notice'}
              style={{ marginTop: 12, width: '100%', maxHeight: 300, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--line, #e2e8f0)', cursor: 'pointer' }}
              onClick={() => window.open(current.media_url, '_blank', 'noopener')}
            />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, fontSize: 11, color: 'var(--ink-soft, #94a3b8)', fontWeight: 600 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12 }}>📅</span>{fmtDate(current.created_at)}
            </span>
            {current.created_by_name && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 12 }}>✍️</span>{current.created_by_name}
              </span>
            )}
          </div>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: 'var(--ink-soft, #94a3b8)', fontWeight: 600 }}>
            <span style={{ flex: 1, height: 4, borderRadius: 99, background: '#eef2f7', overflow: 'hidden', display: 'block' }}>
              <span style={{ display: 'block', height: '100%', background: '#2563eb', animation: 'nc-countdown 5s linear forwards' }} />
            </span>
            Auto-dismisses in 5s
          </div>
          <button
            onClick={close}
            style={{ marginTop: 16, width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', background: 'var(--ink, #0f172a)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
          >Got it — OK 👌</button>
        </div>
      </div>
    </div>
  );
}