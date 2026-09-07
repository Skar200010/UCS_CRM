import { useState } from 'react';
import { Lock, User, Eye, EyeOff, TriangleAlert, ShieldCheck, ArrowRight } from 'lucide-react';

const TICKET_GATE = {
  username: 'jatinsevak@ufs',
  password: 'sevak123',
  sessionKey: 'ucs_ticket_unlocked',
};

const fieldBase = {
  width: '100%',
  padding: '11px 12px 11px 38px',
  fontSize: 13.5,
  border: '1px solid var(--line, #d1d5db)',
  borderRadius: 'var(--radius-sm, 8px)',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  background: 'var(--paper, #fff)',
  color: 'var(--ink, #111827)',
  outline: 'none',
  transition: 'border-color .15s, box-shadow .15s',
};

export default function TicketGate({ title = 'Section', lead = 'This section is private. Enter the authorised username and password to view it.', children }) {
  const [locked, setLocked] = useState(() => sessionStorage.getItem(TICKET_GATE.sessionKey) !== '1');
  const [input, setInput] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);

  const unlock = (e) => {
    e.preventDefault();
    if (input.username.trim() === TICKET_GATE.username && input.password === TICKET_GATE.password) {
      sessionStorage.setItem(TICKET_GATE.sessionKey, '1');
      setLocked(false);
      setInput({ username: '', password: '' });
      setError('');
    } else {
      setError('Invalid username or password');
    }
  };

  const lock = () => {
    sessionStorage.removeItem(TICKET_GATE.sessionKey);
    setLocked(true);
    setInput({ username: '', password: '' });
    setError('');
  };

  if (locked) {
    return (
      <div style={{ position: 'relative', minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 90% at 50% 0%, var(--sage-soft, rgba(91,107,78,.16)), transparent 60%), radial-gradient(90% 70% at 85% 100%, var(--clay-soft, rgba(181,96,58,.16)), transparent 60%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', width: '100%', maxWidth: 430 }}>
          <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--line, #e5e7eb)', borderRadius: 'var(--radius, 16px)', boxShadow: '0 20px 50px -18px rgba(0,0,0,.25)', overflow: 'hidden' }}>
            <div style={{ height: 5, background: 'linear-gradient(90deg, var(--sage, #5B6B4E), var(--clay, #B5603A))' }} />

            <div style={{ padding: '32px 28px 28px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 24 }}>
                <div style={{ display: 'flex', width: 76, height: 76, borderRadius: '50%', background: 'var(--sage-soft, #E8EDE1)', color: 'var(--sage, #5B6B4E)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, position: 'relative' }}>
                  <Lock size={34} strokeWidth={1.8} />
                  <span style={{ position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: '50%', background: 'var(--clay, #B5603A)', border: '3px solid var(--card-bg, #fff)' }} />
                </div>
                <h2 style={{ fontSize: 21, fontWeight: 800, margin: 0, color: 'var(--ink, #111827)', letterSpacing: -0.3 }}>{title} Area</h2>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '4px 12px', borderRadius: 999, background: 'var(--danger-soft, #fef2f2)', color: 'var(--danger, #dc2626)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  <Lock size={11} strokeWidth={2.5} /> Section Locked
                </div>
                <p style={{ fontSize: 13, color: 'var(--ink-soft, #6b7280)', margin: '12px 0 0', lineHeight: 1.6 }}>{lead}</p>
              </div>

              <form onSubmit={unlock} noValidate>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink, #374151)', display: 'block', marginBottom: 6 }}>Username</label>
                  <div style={{ position: 'relative' }}>
                    <User size={16} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-soft, #9ca3af)', pointerEvents: 'none' }} />
                    <input
                      value={input.username}
                      onChange={e => setInput(p => ({ ...p, username: e.target.value }))}
                      placeholder="Authorised username"
                      autoComplete="username"
                      onFocus={e => { e.target.style.borderColor = 'var(--sage, #5B6B4E)'; e.target.style.boxShadow = '0 0 0 3px var(--sage-soft, rgba(91,107,78,.2))'; }}
                      onBlur={e => { e.target.style.borderColor = 'var(--line, #d1d5db)'; e.target.style.boxShadow = 'none'; }}
                      style={{
                        ...fieldBase,
                        fontSize: 14,
                        fontWeight: 600,
                        letterSpacing: 0.3,
                        WebkitTextSecurity: 'none',
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: error ? 10 : 18 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink, #374151)', display: 'block', marginBottom: 6 }}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-soft, #9ca3af)', pointerEvents: 'none' }} />
                    <input
                      type={show ? 'text' : 'password'}
                      value={input.password}
                      onChange={e => setInput(p => ({ ...p, password: e.target.value }))}
                      placeholder="Enter password"
                      autoComplete="current-password"
                      onFocus={e => { e.target.style.borderColor = 'var(--sage, #5B6B4E)'; e.target.style.boxShadow = '0 0 0 3px var(--sage-soft, rgba(91,107,78,.2))'; }}
                      onBlur={e => { e.target.style.borderColor = 'var(--line, #d1d5db)'; e.target.style.boxShadow = 'none'; }}
                      style={{ ...fieldBase, fontSize: 14 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShow(s => !s)}
                      aria-label={show ? 'Hide password' : 'Show password'}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--ink-soft, #9ca3af)', cursor: 'pointer', padding: 4, display: 'flex' }}
                    >
                      {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div style={{ fontSize: 12, color: 'var(--danger, #dc2626)', marginBottom: 14, background: 'var(--danger-soft, #fef2f2)', border: '1px solid color-mix(in srgb, var(--danger, #dc2626) 35%, transparent)', padding: '9px 12px', borderRadius: 'var(--radius-sm, 8px)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TriangleAlert size={14} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  style={{ width: '100%', padding: '12px 14px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', borderRadius: 'var(--radius-sm, 8px)', border: 'none', cursor: 'pointer', background: 'var(--sage, #5B6B4E)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'opacity .15s, transform .15s', boxShadow: '0 8px 18px -8px var(--sage, rgba(91,107,78,.6))' }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = 0.92; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.transform = 'none'; }}
                >
                  Unlock Section <ArrowRight size={16} />
                </button>
              </form>

              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px dashed var(--line, #e5e7eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 11.5, color: 'var(--ink-soft, #6b7280)' }}>
                <ShieldCheck size={14} style={{ color: 'var(--sage, #5B6B4E)' }} />
                Authorised personnel only · Access is logged
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return typeof children === 'function' ? children({ lock }) : children;
}