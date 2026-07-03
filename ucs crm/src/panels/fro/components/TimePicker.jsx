import { useState, useRef, useEffect, useCallback } from 'react';

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const S = 180;
const C = S / 2;
const R_HOUR = 64;
const R_MIN = 50;
const R_HAND_M = 72;
const R_TICK = 76;
const BTN = 26;

function rad(deg) { return deg * Math.PI / 180; }

function positions(count, radius, offset = -90) {
  const arr = [];
  for (let i = 0; i < count; i++) {
    const a = rad(i * 360 / count + offset);
    arr.push({ x: C + radius * Math.cos(a), y: C + radius * Math.sin(a) });
  }
  return arr;
}

const hPos = positions(12, R_HOUR);
const mPos = positions(12, R_MIN);

function format12(v) {
  if (!v) return '';
  const [h, m] = v.split(':').map(Number);
  const p = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${p}`;
}

export function TimePicker({ value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('hour');
  const [selHour12, setSelHour12] = useState(null);
  const [isPm, setIsPm] = useState(false);
  const [tempMin, setTempMin] = useState(null);
  const [flipUp, setFlipUp] = useState(false);
  const ref = useRef(null);
  const clockRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const openPicker = () => {
    if (value) {
      const [h, m] = value.split(':').map(Number);
      const h12 = h % 12 || 12;
      setSelHour12(h12);
      setIsPm(h >= 12);
      setMode('minute');
      setTempMin(m);
    } else {
      setSelHour12(null);
      setIsPm(false);
      setMode('hour');
      setTempMin(null);
    }
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setFlipUp(window.innerHeight - rect.bottom < 260);
    }
    setOpen(true);
  };

  const disp = value || '';
  const h24 = selHour12 !== null ? (selHour12 === 12 ? 0 : selHour12) + (isPm ? 12 : 0) : null;

  const onHour = (h12) => {
    setSelHour12(h12);
    setMode('ampm');
  };

  const onAmpm = (pm) => {
    setIsPm(pm);
    setMode('minute');
  };

  const onMin = (min) => {
    const h = h24 ?? 0;
    const r = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    onChange?.({ target: { value: r } });
    setOpen(false);
  };

  const handEndM = tempMin !== null ? {
    x: C + R_HAND_M * Math.cos(rad(tempMin * 6 - 90)),
    y: C + R_HAND_M * Math.sin(rad(tempMin * 6 - 90)),
  } : null;

  const minFromPos = useCallback((clientX, clientY) => {
    const rect = clockRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const dx = x - C;
    const dy = y - C;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 16 || dist > 95) return null;
    let a = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    if (a < 0) a += 360;
    return Math.round(a / 6) % 60;
  }, []);

  const [dragging, setDragging] = useState(false);

  const handleClockDown = useCallback((e) => {
    if (mode !== 'minute') return;
    const m = minFromPos(e.clientX, e.clientY);
    if (m === null) return;
    setTempMin(m);
    setDragging(true);
  }, [mode, minFromPos]);

  const handleClockMove = useCallback((e) => {
    if (!dragging || mode !== 'minute') return;
    const m = minFromPos(e.clientX, e.clientY);
    if (m === null) return;
    setTempMin(m);
  }, [dragging, mode, minFromPos]);

  const handleClockUp = useCallback(() => {
    setDragging(false);
  }, []);

  const tickMarks = Array.from({ length: 60 }, (_, i) => {
    const a = rad(i * 6 - 90);
    const innerR = i % 5 === 0 ? R_TICK - 12 : R_TICK - 5;
    return {
      x1: C + R_TICK * Math.cos(a),
      y1: C + R_TICK * Math.sin(a),
      x2: C + innerR * Math.cos(a),
      y2: C + innerR * Math.sin(a),
      bold: i % 5 === 0,
    };
  });

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      <button type="button" onClick={openPicker}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, width: '100%',
          background: '#fff', border: '1px solid var(--line)', borderRadius: 5,
          padding: '5px 7px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
          color: 'var(--ink)', boxSizing: 'border-box',
        }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span style={{ opacity: disp ? 1 : 0.55 }}>{format12(disp) || (placeholder || 'Select time')}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', zIndex: 300,
          ...(flipUp
            ? { bottom: 'calc(100% + 4px)' }
            : { top: 'calc(100% + 4px)' }),
          left: '50%', transform: 'translateX(-50%)',
          background: '#fff', border: '1px solid var(--line)', borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,.12)', padding: 10, width: 204,
        }}>
          {mode === 'hour' ? (
            <>
              <div style={{ position: 'relative', width: S, height: S, margin: '0 auto' }}>
                <svg viewBox={`0 0 ${S} ${S}`} width={S} height={S}
                  style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
                  <circle cx={C} cy={C} r={C - 6} fill="none" stroke="var(--line)" strokeWidth="1" />
                  <circle cx={C} cy={C} r="2.5" fill="var(--sage)" />
                </svg>
                {hPos.map((p, i) => {
                  const h12 = HOURS[i];
                  const active = selHour12 === h12;
                  return (
                    <button key={i} type="button" onClick={() => onHour(h12)}
                      style={{
                        position: 'absolute', left: p.x, top: p.y, width: BTN, height: BTN,
                        transform: 'translate(-50%, -50%)', borderRadius: '50%',
                        border: 'none', cursor: 'pointer', outline: 'none',
                        background: active ? 'var(--sage)' : 'transparent',
                        color: active ? '#fff' : 'var(--ink)',
                        fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                      {h12}
                    </button>
                  );
                })}
              </div>
            </>
          ) : mode === 'ampm' ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '20px 0' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: 'var(--sage)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, fontWeight: 700, fontFamily: 'inherit',
                }}>
                  {selHour12}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {['AM', 'PM'].map(t => {
                    const pm = t === 'PM';
                    const active = pm === isPm;
                    return (
                      <button key={t} type="button" onClick={() => onAmpm(pm)}
                        style={{
                          padding: '6px 24px', borderRadius: 20, border: '1px solid var(--line)',
                          background: active ? 'var(--sage)' : '#fff',
                          color: active ? '#fff' : 'var(--ink)',
                          fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
                        }}>
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <button type="button" onClick={() => setMode('hour')}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', outline: 'none',
                    fontSize: 11, color: 'var(--sage)', fontWeight: 600, fontFamily: 'inherit',
                    padding: '3px 8px',
                  }}>
                  {'\u2190'} Back
                </button>
              </div>
            </>
          ) : (
              <>
                <div
                  ref={clockRef}
                  onMouseDown={handleClockDown}
                  onMouseMove={handleClockMove}
                  onMouseUp={handleClockUp}
                  onMouseLeave={handleClockUp}
                  style={{ position: 'relative', width: S, height: S, margin: '0 auto', cursor: 'pointer', userSelect: 'none' }}
                >
                  <svg viewBox={`0 0 ${S} ${S}`} width={S} height={S}
                    style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
                    <circle cx={C} cy={C} r={C - 4} fill="none" stroke="var(--line)" strokeWidth="1" />
                    {tickMarks.map((t, i) => (
                      <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                        stroke={t.bold ? 'var(--ink-soft)' : 'var(--line)'}
                        strokeWidth={t.bold ? 1.5 : 1} strokeLinecap="round" />
                    ))}
                    {handEndM && (
                      <>
                        <line x1={C} y1={C} x2={handEndM.x} y2={handEndM.y} stroke="var(--sage)" strokeWidth="2" strokeLinecap="round" />
                        <circle cx={handEndM.x} cy={handEndM.y} r="4" fill="var(--sage)" />
                      </>
                    )}
                    <circle cx={C} cy={C} r="3" fill="var(--sage)" />
                  </svg>
                  <div style={{
                    position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                    background: '#fff', borderRadius: 6, padding: '4px 10px',
                    fontSize: 20, fontWeight: 700, fontFamily: 'inherit', color: 'var(--sage)',
                    letterSpacing: '0.5px', lineHeight: 1, zIndex: 2, pointerEvents: 'none',
                    boxShadow: '0 1px 4px rgba(0,0,0,.08)',
                  }}>
                    {tempMin !== null ? String(tempMin).padStart(2, '0') : '??'}
                  </div>
                  {mPos.map((p, i) => {
                    const min = MINUTE_STEPS[i];
                    const active = tempMin === min;
                    return (
                      <button key={i} type="button" onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setTempMin(min); }}
                        style={{
                          position: 'absolute', left: p.x, top: p.y, width: BTN - 2, height: BTN - 2,
                          transform: 'translate(-50%, -50%)', borderRadius: '50%',
                          border: 'none', cursor: 'pointer', outline: 'none',
                          background: active ? 'var(--sage)' : 'transparent',
                          color: active ? '#fff' : 'var(--ink)',
                          fontSize: active ? 12 : 10, fontWeight: 600, fontFamily: 'inherit',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                        {String(min).padStart(2, '0')}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, padding: '0 4px' }}>
                  <button type="button" onClick={() => setMode('ampm')}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', outline: 'none',
                      fontSize: 11, color: 'var(--sage)', fontWeight: 600, fontFamily: 'inherit',
                      padding: '3px 8px',
                    }}>
                    {h24 !== null ? `\u2190 ${format12(`${String(h24).padStart(2, '0')}:${String(tempMin ?? 0).padStart(2, '0')}`)}` : '\u2190 Hour'}
                  </button>
                  <button type="button" onClick={() => { if (tempMin !== null) onMin(tempMin); }}
                    style={{
                      background: 'var(--sage)', border: 'none', borderRadius: 5, cursor: 'pointer', outline: 'none',
                      fontSize: 11, fontWeight: 700, fontFamily: 'inherit', color: '#fff',
                      padding: '5px 16px',
                    }}>
                    Select
                  </button>
                </div>
              </>
          )}
        </div>
      )}
    </div>
  );
}
