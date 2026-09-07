import { useState, useEffect } from 'react'
import {
  KeyRound, Lock, Eye, EyeOff, Copy, Check, CheckCircle2, ShieldCheck,
  AlertTriangle, AlertCircle, X, RefreshCw, Loader2,
} from 'lucide-react'
import { api } from '../api/auth'
import { deptLabel } from '../../../lib/labels'

const GEN_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const GEN_LOWER = 'abcdefghjkmnpqrstuvwxyz'
const GEN_DIGITS = '23456789'
const GEN_ALL = GEN_UPPER + GEN_LOWER + GEN_DIGITS

const pickFrom = (set) => set[Math.floor(Math.random() * set.length)]

const generateStrongPassword = () => {
  const chars = [pickFrom(GEN_UPPER), pickFrom(GEN_LOWER), pickFrom(GEN_DIGITS)]
  while (chars.length < 10) chars.push(pickFrom(GEN_ALL))
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

const strengthOf = (pwd) => {
  if (!pwd) return 0
  let score = 0
  if (pwd.length >= 6) score++
  if (pwd.length >= 10) score++
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++
  if (/\d/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++
  return Math.min(score, 4)
}

const STRENGTH_LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong']

export default function ResetPasswordModal({ worker, onClose }) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const generate = () => {
    setErr('')
    setPassword(generateStrongPassword())
    setShow(true)
  }

  const copy = async () => {
    const text = result.generated_password
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      } catch {
        setErr('Copy failed — select the password manually')
        return
      }
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const submit = async () => {
    setErr('')
    if (password.length < 6) { setErr('Password must be at least 6 characters'); return }
    setSaving(true)
    try {
      const res = await api(`/workers/${worker.id}/reset-password`, { method: 'PUT', body: JSON.stringify({ password }) })
      setResult(res)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  const level = strengthOf(password)
  const initials = (worker.name || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join('')

  return (
    <div className="sa-modal-overlay" onClick={() => { if (!saving) onClose() }}>
      <div className="rpm-card" onClick={e => e.stopPropagation()}>
        <style>{`
          .rpm-card { background:#fff; border-radius:16px; width:calc(100% - 32px); max-width:410px; box-shadow:0 24px 70px rgba(15,23,42,0.28); overflow:hidden; animation:rpm-in .28s cubic-bezier(.16,1,.3,1); }
          @keyframes rpm-in { from { opacity:0; transform:translateY(18px) scale(.97); } to { opacity:1; transform:none; } }
          .rpm-hero { display:flex; align-items:center; gap:12px; padding:18px 20px; background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; }
          .rpm-hero-badge { width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.18); border:1px solid rgba(255,255,255,0.25); flex-shrink:0; }
          .rpm-hero-text { flex:1; min-width:0; }
          .rpm-hero-text h3 { margin:0; font-size:16px; font-weight:700; letter-spacing:.2px; }
          .rpm-hero-text p { margin:2px 0 0; font-size:11.5px; opacity:.85; }
          .rpm-close { width:28px; height:28px; border-radius:8px; border:none; background:rgba(255,255,255,0.15); color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .15s; flex-shrink:0; }
          .rpm-close:hover { background:rgba(255,255,255,0.3); }
          .rpm-body { padding:18px 20px 20px; display:flex; flex-direction:column; gap:14px; }
          .rpm-identity { display:flex; align-items:center; gap:10px; padding:10px 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; }
          .rpm-avatar { width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg,#6366f1,#a855f7); color:#fff; font-size:13px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; letter-spacing:.5px; }
          .rpm-id-text { flex:1; min-width:0; }
          .rpm-id-name { font-size:13.5px; font-weight:700; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
          .rpm-id-text code { font-size:11.5px; color:#64748b; }
          .rpm-dept { font-size:10.5px; font-weight:600; color:#4f46e5; background:#eef2ff; border:1px solid #e0e7ff; padding:3px 8px; border-radius:999px; white-space:nowrap; flex-shrink:0; }
          .rpm-label-row { display:flex; align-items:center; justify-content:space-between; gap:8px; }
          .rpm-label-row label { font-size:12.5px; font-weight:700; color:#334155; letter-spacing:.2px; }
          .rpm-gen { display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:600; color:#4f46e5; background:#eef2ff; border:1px solid #e0e7ff; border-radius:8px; padding:4px 9px; cursor:pointer; transition:all .15s; font-family:inherit; }
          .rpm-gen:hover { background:#e0e7ff; }
          .rpm-gen:disabled { opacity:.5; cursor:not-allowed; }
          .rpm-input-wrap { display:flex; align-items:center; gap:8px; border:1.5px solid #e2e8f0; border-radius:10px; padding:0 10px; background:#fff; transition:border-color .15s, box-shadow .15s; }
          .rpm-input-wrap:focus-within { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,0.15); }
          .rpm-input-ico { color:#94a3b8; flex-shrink:0; }
          .rpm-input-wrap input { flex:1; min-width:0; border:none; outline:none; padding:10px 0; font-size:14px; font-family:'SF Mono',Consolas,monospace; letter-spacing:.5px; color:#1e293b; background:transparent; }
          .rpm-eye { border:none; background:none; color:#94a3b8; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:4px; border-radius:6px; transition:color .15s, background .15s; }
          .rpm-eye:hover { color:#4f46e5; background:#eef2ff; }
          .rpm-meter { display:flex; align-items:center; gap:4px; margin-top:-4px; }
          .rpm-meter span { flex:1; height:4px; border-radius:2px; background:#e2e8f0; transition:background .25s; }
          .rpm-meter[data-level="1"] span.on, .rpm-meter[data-level="1"] em { background:#ef4444; color:#ef4444; }
          .rpm-meter[data-level="2"] span.on, .rpm-meter[data-level="2"] em { background:#f59e0b; color:#f59e0b; }
          .rpm-meter[data-level="3"] span.on, .rpm-meter[data-level="3"] em { background:#3b82f6; color:#3b82f6; }
          .rpm-meter[data-level="4"] span.on, .rpm-meter[data-level="4"] em { background:#10b981; color:#10b981; }
          .rpm-meter em { font-style:normal; font-size:10.5px; font-weight:700; flex-shrink:0; margin-left:4px; min-width:52px; text-align:right; transition:color .25s; }
          .rpm-reqs { display:flex; flex-wrap:wrap; gap:6px; }
          .rpm-reqs span { display:inline-flex; align-items:center; gap:4px; font-size:10.5px; font-weight:600; color:#94a3b8; background:#f8fafc; border:1px solid #e2e8f0; padding:3px 8px; border-radius:999px; transition:all .2s; }
          .rpm-reqs span.ok { color:#059669; background:#ecfdf5; border-color:#a7f3d0; }
          .rpm-notice { display:flex; align-items:flex-start; gap:8px; font-size:11.5px; color:#92400e; background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:9px 11px; line-height:1.45; }
          .rpm-notice svg { flex-shrink:0; margin-top:1px; }
          .rpm-err { display:flex; align-items:center; gap:8px; font-size:12px; color:#b91c1c; background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:9px 11px; }
          .rpm-actions { display:flex; gap:10px; margin-top:2px; }
          .rpm-btn { flex:1; display:inline-flex; align-items:center; justify-content:center; gap:7px; font-size:13px; font-weight:600; border-radius:10px; padding:10px 12px; cursor:pointer; transition:all .18s; font-family:inherit; border:1.5px solid transparent; }
          .rpm-btn.ghost { background:#fff; border-color:#e2e8f0; color:#475569; }
          .rpm-btn.ghost:hover { background:#f8fafc; border-color:#cbd5e1; }
          .rpm-btn.primary { background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; box-shadow:0 4px 14px rgba(79,70,229,0.3); }
          .rpm-btn.primary:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 20px rgba(79,70,229,0.4); }
          .rpm-btn:disabled { opacity:.55; cursor:not-allowed; transform:none; }
          .rpm-btn.full { width:100%; }
          .rpm-spin { animation:rpm-rotate 1s linear infinite; }
          @keyframes rpm-rotate { to { transform:rotate(360deg); } }
          .rpm-success { display:flex; flex-direction:column; align-items:center; text-align:center; gap:10px; padding:6px 0 2px; }
          .rpm-pop { width:64px; height:64px; border-radius:50%; background:#ecfdf5; border:1.5px solid #a7f3d0; color:#10b981; display:flex; align-items:center; justify-content:center; animation:rpm-pop .4s cubic-bezier(.16,1,.3,1); }
          @keyframes rpm-pop { 0% { transform:scale(0); opacity:0; } 70% { transform:scale(1.15); } 100% { transform:scale(1); opacity:1; } }
          .rpm-success h4 { margin:0; font-size:16px; font-weight:700; color:#1e293b; }
          .rpm-sub { margin:0; font-size:12px; color:#64748b; }
          .rpm-sub code { color:#4f46e5; font-weight:600; }
          .rpm-pwd-box { display:flex; align-items:center; gap:8px; width:100%; background:#f8fafc; border:1.5px dashed #cbd5e1; border-radius:10px; padding:10px 12px; }
          .rpm-pwd-box code { flex:1; font-size:16px; font-weight:700; letter-spacing:1.5px; color:#1e293b; font-family:'SF Mono',Consolas,monospace; }
          .rpm-copy { display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:600; color:#4f46e5; background:#eef2ff; border:1px solid #e0e7ff; border-radius:8px; padding:6px 10px; cursor:pointer; transition:all .15s; font-family:inherit; flex-shrink:0; }
          .rpm-copy:hover { background:#e0e7ff; }
          .rpm-copy.done { color:#059669; background:#ecfdf5; border-color:#a7f3d0; }
          @media (prefers-reduced-motion: reduce) {
            .rpm-card, .rpm-pop, .rpm-spin { animation:none; }
            .rpm-btn.primary:hover:not(:disabled) { transform:none; }
          }
          @media (max-width:480px) {
            .rpm-body { padding:14px 16px 16px; }
            .rpm-dept { display:none; }
            .rpm-actions { flex-direction:column-reverse; }
          }
        `}</style>

        <div className="rpm-hero">
          <div className="rpm-hero-badge"><KeyRound size={22} /></div>
          <div className="rpm-hero-text">
            <h3>Reset Password</h3>
            <p>Admin-authorized credential reset</p>
          </div>
          <button className="rpm-close" onClick={onClose} disabled={saving} aria-label="Close"><X size={15} /></button>
        </div>

        <div className="rpm-body">
          <div className="rpm-identity">
            <div className="rpm-avatar">{initials}</div>
            <div className="rpm-id-text">
              <div className="rpm-id-name">{worker.name}</div>
              <code>{worker.login_id}</code>
            </div>
            {worker.department && <span className="rpm-dept">{deptLabel(worker.department)}</span>}
          </div>

          {result ? (
            <div className="rpm-success">
              <div className="rpm-pop"><CheckCircle2 size={34} /></div>
              <h4>Password reset</h4>
              <p className="rpm-sub"><code>{result.login_id || worker.login_id}</code> can now sign in with:</p>
              <div className="rpm-pwd-box">
                <code>{result.generated_password}</code>
                <button className={copied ? 'rpm-copy done' : 'rpm-copy'} onClick={copy}>
                  {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                </button>
              </div>
              <div className="rpm-notice">
                <AlertTriangle size={14} />
                <span>Shown only once — copy it now and share it securely with the worker.</span>
              </div>
              {err && <div className="rpm-err"><AlertCircle size={14} /><span>{err}</span></div>}
              <button className="rpm-btn primary full" onClick={onClose}>Done</button>
            </div>
          ) : (
            <>
              <div className="rpm-label-row">
                <label>New Password</label>
                <button type="button" className="rpm-gen" onClick={generate} disabled={saving}>
                  <RefreshCw size={12} /> Generate strong
                </button>
              </div>
              <div className="rpm-input-wrap">
                <Lock size={15} className="rpm-input-ico" />
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setErr('') }}
                  placeholder="Enter or generate a password"
                  autoFocus
                  spellCheck={false}
                  autoComplete="new-password"
                />
                <button type="button" className="rpm-eye" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              <div className="rpm-meter" data-level={level}>
                {[1, 2, 3, 4].map(i => <span key={i} className={i <= level ? 'on' : ''} />)}
                <em>{STRENGTH_LABELS[level]}</em>
              </div>

              <div className="rpm-reqs">
                <span className={password.length >= 6 ? 'ok' : ''}><Check size={11} /> 6+ chars</span>
                <span className={/[a-z]/.test(password) && /[A-Z]/.test(password) ? 'ok' : ''}><Check size={11} /> Mixed case</span>
                <span className={/\d/.test(password) ? 'ok' : ''}><Check size={11} /> Number</span>
              </div>

              {err && <div className="rpm-err"><AlertCircle size={14} /><span>{err}</span></div>}

              <div className="rpm-notice">
                <AlertTriangle size={14} />
                <span>The new password is shown only once after reset. Share it securely with the worker.</span>
              </div>

              <div className="rpm-actions">
                <button className="rpm-btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
                <button className="rpm-btn primary" onClick={submit} disabled={saving || password.length < 6}>
                  {saving
                    ? <><Loader2 size={14} className="rpm-spin" /> Resetting…</>
                    : <><ShieldCheck size={14} /> Reset Password</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
