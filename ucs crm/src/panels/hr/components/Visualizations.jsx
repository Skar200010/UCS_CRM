import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Users, Check, Plane, Bell, Star, Heart } from '../icons';
import { Avatar } from './ui';
import { fetchWorkers, fetchAttendance, fetchLeaves, fetchHolidays, fetchNgoSummaryList } from '../store';
import { useSalaryPrivacy } from '../../../context/SalaryPrivacyContext';
import api from '../api/auth';
import RecentNotices from '../../../components/RecentNotices';
import { uploadImage } from '../../../components/NoticePopup';
import RecruiterOverview from './RecruiterOverview';
import { API_BASE } from '../../../lib/apiBase';
import { deptLabel } from '../../../lib/labels';

/* ─── Animated counter ─── */
function AnimatedNum({ to, suffix = '' }) {
  const [v, setV] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    if (to === 0) { setV(0); return; }
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      const dur = 1000, s = performance.now(), d = to;
      const tick = (n) => { const p = Math.min((n - s) / dur, 1); setV(Math.round(d * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      obs.disconnect();
    }, { threshold: 0.3 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [to]);
  return <span ref={ref}>{v.toLocaleString('en-IN')}{suffix}</span>;
}

/* ─── Mini stat card ─── */
function MiniCard({ icon, label, num, suffix = '', sub, color }) {
  return (
    <div className="mc" style={{ justifyContent: 'center' }}>
      <div className="mc-top">
        <span className="mc-icon" style={{ color: color || 'var(--sage)' }}>{icon}</span>
        <span className="mc-num"><AnimatedNum to={num} suffix={suffix} /></span>
      </div>
      <div className="mc-label">{label}</div>
      {sub && <div className="mc-sub">{sub}</div>}
    </div>
  );
}

/* ─── Radial mini ─── */
function MiniRadial({ pct, size = 56, sw = 5 }) {
  const r = (size - sw) / 2, circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct, 1));
  const c = pct >= 80 ? 'var(--sage)' : pct >= 60 ? 'var(--gold)' : 'var(--danger)';
  const [ao, setAo] = useState(circ);
  useEffect(() => {
    setAo(circ);
    const dur = 800, s = performance.now(), from = circ, to = offset;
    const tick = (n) => { const p = Math.min((n - s) / dur, 1); setAo(from + (to - from) * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }, [offset, circ]);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={sw} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth={sw}
        strokeDasharray={circ} strokeDashoffset={ao} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" fontSize={size * 0.24} fontWeight={800} fill="var(--ink)">{Math.round(pct)}%</text>
    </svg>
  );
}

/* ─── Mini bar ─── */
function MiniBar({ data, h = 40, color = 'var(--sage)' }) {
  const mx = Math.max(...data.map(d => d.val), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: h }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <div style={{ width: '100%', background: d.color || color, height: Math.max(d.val / mx * (h - 14), 2), borderRadius: '3px 3px 0 0', minHeight: 2 }} title={deptLabel(d.lbl)} />
          <span style={{ fontSize: 7, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{deptLabel(d.lbl)}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Mini horizontal bar ─── */
function MiniHBar({ data, mx }) {
  const m = mx || Math.max(...data.map(d => d.val), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {data.map(d => (
        <div key={d.lbl} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 8, color: 'var(--ink-soft)', minWidth: 36, textAlign: 'right', whiteSpace: 'nowrap' }}>{deptLabel(d.lbl)}</span>
          <div style={{ flex: 1, height: 12, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(d.val / m * 100, 1)}%`, height: '100%', background: d.color || 'var(--sage)', borderRadius: 4, minWidth: 4 }} />
          </div>
          <span style={{ fontSize: 8, fontWeight: 600, minWidth: 16, textAlign: 'right' }}>{d.val}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Stacked bar ─── */
function MiniStacked({ data, h = 8 }) {
  const t = data.reduce((s, d) => s + d.val, 0) || 1;
  return (
    <div style={{ display: 'flex', height: h, borderRadius: 4, overflow: 'hidden', width: '100%' }}>
      {data.filter(d => d.val > 0).map((d, i) => <div key={i} style={{ width: `${d.val / t * 100}%`, background: d.color, minWidth: 2 }} title={deptLabel(d.lbl)} />)}
    </div>
  );
}

/* ─── Main component ─── */
export default function Visualizations() {
  const { formatSalary } = useSalaryPrivacy();
  const [workers, setWorkers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [salSum, setSalSum] = useState([]);
  const [ngoSummary, setNgoSummary] = useState([]);
  const [noticeForm, setNoticeForm] = useState({ title: '', content: '', target_roles: ['all'], popup: true, media_url: '', media_type: '', media_name: '' })
  const [noticeSaving, setNoticeSaving] = useState(false)
  const [noticeUploading, setNoticeUploading] = useState(false)
  const [noticeErr, setNoticeErr] = useState('')
  const [noticeRefresh, setNoticeRefresh] = useState(0)
  const [noticeSuccess, setNoticeSuccess] = useState(false)
  const noticeFileRef = useRef(null)
  const [loading, setLoading] = useState(true)

  const publishNotice = useCallback(async () => {
    if (!noticeForm.title.trim()) { setNoticeErr('Please enter a title for the notice'); return }
    if (!noticeForm.content.trim()) { setNoticeErr('Please enter content for the notice'); return }
    setNoticeSaving(true); setNoticeErr('')
    try {
      await api('/notices', {
        method: 'POST',
        body: JSON.stringify({
          ...noticeForm,
          media_url: noticeForm.media_url || null,
          media_type: noticeForm.media_type || null,
          media_name: noticeForm.media_name || null,
        }),
        _prefix: 'ucs',
      })
      setNoticeForm({ title: '', content: '', target_roles: ['all'], popup: true, media_url: '', media_type: '', media_name: '' })
      setNoticeRefresh(k => k + 1)
      setNoticeSuccess(true)
    } catch (e) { setNoticeErr(e.message) } finally { setNoticeSaving(false) }
  }, [noticeForm])

  const noticeToggleRole = (role) => {
    setNoticeForm(prev => {
      if (role === 'all') return { ...prev, target_roles: ['all'] }
      let next = prev.target_roles.includes(role)
        ? prev.target_roles.filter(r => r !== role)
        : [...prev.target_roles.filter(r => r !== 'all'), role]
      if (next.length === 0) next = ['all']
      return { ...prev, target_roles: next }
    })
  }

  const handleNoticeFile = async (e) => {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return
    if (!String(file.type || '').startsWith('image/')) { setNoticeErr('Only image files are allowed'); return }
    if (file.size > 50 * 1024 * 1024) { setNoticeErr('Image must be under 50 MB'); return }
    setNoticeUploading(true); setNoticeErr('')
    try {
      const r = await uploadImage(file)
      if (!r || !r.url) throw new Error('Upload failed')
      setNoticeForm(prev => ({ ...prev, media_url: r.url, media_type: r.type || file.type, media_name: r.name || file.name }))
    } catch (e2) { setNoticeErr(e2.message || 'Upload failed') } finally { setNoticeUploading(false) }
  }

  useEffect(() => {
    setLoading(true);
    const token = localStorage.getItem('ucs_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    Promise.all([
      fetchWorkers().catch(() => []),
      fetchAttendance().catch(() => []),
      fetchLeaves().catch(() => []),
      fetchHolidays().catch(() => []),
      fetch(API_BASE + '/salary/workers-summary', { headers }).then(r => r.json()).catch(() => []),
      fetchNgoSummaryList().catch(() => []),
    ]).then(([w, a, l, h, s, ngos]) => {
      setWorkers((w || []).filter(x => !x.is_test)); setAttendance(a); setLeaves(l); setHolidays(h); setSalSum((s || []).filter(x => !x.is_test)); setNgoSummary(ngos || []);
    }).catch((err) => { console.error('API error:', err.message); }).finally(() => setLoading(false));
  }, []);

  const w = workers || [], a = attendance || [], l = leaves || [], h = holidays || [];
  const today = new Date().toISOString().slice(0, 10);
  const todayAtt = a.filter(x => x.date === today);
  const present = todayAtt.filter(x => x.status === 'present' || x.status === 'late').length;
  const onLeave = todayAtt.filter(x => x.status === 'leave').length;
  const pendingL = l.filter(x => x.status === 'pending').length;
  const total = w.length;
  const presentPct = total ? Math.round(present / total * 100) : 0;
  const attPct = a.length ? Math.round(a.filter(x => x.status === 'present' || x.status === 'late').length / a.length * 100) : 0;
  const approved = l.filter(x => x.status === 'approved').length;
  const rejected = l.filter(x => x.status === 'rejected').length;

  const deptWorkers = useMemo(() => {
    const m = {}; w.forEach(x => { const d = x.department || 'NA'; m[d] = (m[d] || 0) + 1; });
    return Object.entries(m).map(([k, v]) => ({ lbl: k, val: v })).sort((a, b) => b.val - a.val);
  }, [w]);

  const gender = useMemo(() => {
    let m = 0, f = 0, o = 0; w.forEach(x => { if (x.gender === 'Male') m++; else if (x.gender === 'Female') f++; else o++; });
    return { M: m, F: f, O: o };
  }, [w]);

  const late7 = useMemo(() => {
    const days = []; const ds = (d) => d.toISOString().slice(0, 10);
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(ds(d)); }
    return days.map(d => ({ lbl: new Date(d).toLocaleDateString('en', { weekday: 'short' }), val: a.filter(x => x.date === d && x.status === 'late').length }));
  }, [a]);

  const leaveStatus = [
    { lbl: 'Approved', val: approved, color: 'var(--sage)' },
    { lbl: 'Pending', val: pendingL, color: 'var(--gold)' },
    { lbl: 'Rejected', val: rejected, color: 'var(--danger)' },
  ];

  const yr = new Date().getFullYear(), mo = new Date().getMonth();
  const dim = new Date(yr, mo + 1, 0).getDate(), fdow = new Date(yr, mo, 1).getDay();
  const ds = (d) => `${yr}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const hset = new Set(h.map(x => x.date?.slice(0, 10)));
  const dayStats = useMemo(() => {
    const m = {};
    for (let d = 1; d <= dim; d++) { const s = ds(d), da = a.filter(x => x.date === s), t = da.length, p = da.filter(x => x.status === 'present' || x.status === 'late').length; m[s] = { t, p, pct: t ? Math.round(p / t * 100) : 0 }; }
    return m;
  }, [a, dim]);
  const hColor = (s) => { const x = dayStats[s]; if (!x || !x.t) return 'var(--line)'; if (x.pct >= 90) return 'var(--sage)'; if (x.pct >= 70) return '#7a9a5a'; if (x.pct >= 50) return '#a8c08a'; return 'var(--danger)'; };
  const isHol = (d) => hset.has(ds(d)) || new Date(yr, mo, d).getDay() === 0;

  const COLORS = ['#5B6B4E','#B5603A','#C08A2E','#4F6472','#7A5C7E','#88693D','#2E7D32','#1565C0','#6A1B9A','#00838F'];

  const salaryDepts = useMemo(() => {
    const m = {}; (salSum || []).forEach(x => { const d = x.department || 'NA'; if (!m[d]) m[d] = { dept: d, count: 0, total: 0 }; m[d].count++; m[d].total += parseFloat(x.current_salary) || 0; });
    return Object.values(m).sort((a, b) => b.total - a.total);
  }, [salSum]);

  /* Upcoming events */
  const upcomingEvents = useMemo(() => {
    const events = [];
    const today = new Date();
    const sixWeeks = new Date(); sixWeeks.setDate(sixWeeks.getDate() + 42);
    (holidays || []).forEach(hol => {
      const d = new Date(hol.date + 'T00:00:00');
      if (d >= today && d <= sixWeeks) events.push({ date: d, title: hol.name, type: 'holiday' });
    });
    (leaves || []).forEach(lv => {
      if (lv.status !== 'approved') return;
      const sd = lv.start_date ? new Date(lv.start_date + 'T00:00:00') : null;
      if (!sd) return;
      if (sd >= today && sd <= sixWeeks)
        events.push({ date: sd, title: (lv.workers?.name || 'Leave') + ' — ' + (lv.reason || 'vacation'), type: 'leave' });
    });
    events.sort((a, b) => a.date - b.date);
    return events.slice(0, 10);
  }, [holidays, leaves]);

  /* Work anniversaries — only today's, computed from each worker's joining date (created_at) */
  const anniversaries = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const todayMD = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const list = [];
    (workers || []).forEach(x => {
      if (!x.created_at) return;
      const jd = new Date(x.created_at);
      if (isNaN(jd.getTime())) return;
      const years = curYear - jd.getFullYear();
      if (years < 1) return;
      const joinMD = `${String(jd.getMonth() + 1).padStart(2, '0')}-${String(jd.getDate()).padStart(2, '0')}`;
      if (joinMD !== todayMD) return;
      list.push({
        name: x.name || 'Unknown',
        dept: x.department || '',
        years,
        date: new Date(curYear, jd.getMonth(), jd.getDate()),
      });
    });
    list.sort((a, b) => a.date - b.date);
    return list;
  }, [workers]);

  /* Birthdays — only today's, computed from each worker's date of birth */
  const birthdays = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const todayMD = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const list = [];
    (workers || []).forEach(x => {
      if (!x.dob) return;
      const d = new Date(x.dob);
      if (isNaN(d.getTime())) return;
      const dobMD = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (dobMD !== todayMD) return;
      let age = curYear - d.getFullYear();
      const notYet = (now.getMonth() < d.getMonth()) || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate());
      if (notYet) age--;
      list.push({
        name: x.name || 'Unknown',
        dept: x.department || '',
        age: Math.max(age, 0),
        date: new Date(curYear, d.getMonth(), d.getDate()),
      });
    });
    list.sort((a, b) => a.date - b.date);
    return list;
  }, [workers]);
  const bubbleData = useMemo(() => {
    const s30 = new Date(); s30.setDate(s30.getDate() - 30);
    const ss = s30.toISOString().slice(0, 10);
    const bm = {}; w.forEach(x => { const d = x.department || 'NA'; if (!bm[d]) bm[d] = { ids: new Set(), ta: 0, pa: 0, ls: 0, lc: 0 }; bm[d].ids.add(x.id); });
    a.forEach(x => { if (x.date < ss || x.date > today) return; for (const d of Object.values(bm)) { if (d.ids.has(x.worker_id)) { d.ta++; if (x.status === 'present' || x.status === 'late') d.pa++; if (x.status === 'late') { d.ls += parseInt(x.late_minutes) || 0; d.lc++; } break; } } });
    return Object.values(bm).map(d => ({ dept: d.dept, ar: d.ta ? Math.round(d.pa / d.ta * 100) : 0, al: d.lc ? Math.round(d.ls / d.lc) : 0, n: d.ids.size }));
  }, [w, a]);

  if (loading) {
    return (
      <div className="dash-grid" aria-hidden="true">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="mc" style={{ justifyContent: 'center' }}>
            <div className="sk" style={{ width: 110, height: 12, marginBottom: 8, borderRadius: 4 }} />
            <div className="sk" style={{ width: 56, height: 20, borderRadius: 4 }} />
          </div>
        ))}
        <div className="mc w-2 h-2">
          <div className="sk" style={{ width: '100%', height: '100%', borderRadius: 8 }} />
        </div>
        <div className="vstack" style={{ gridRow: 'span 2' }}>
          <div className="mc"><div className="sk" style={{ width: '100%', height: '100%', borderRadius: 8 }} /></div>
          <div className="mc"><div className="sk" style={{ width: '100%', height: '100%', borderRadius: 8 }} /></div>
        </div>
        <div className="mc events-card"><div className="sk" style={{ width: '100%', height: '100%', borderRadius: 8 }} /></div>
        <div className="mc w-3" style={{ gridColumn: '1 / -1' }}><div className="sk" style={{ width: '100%', height: 150, borderRadius: 8 }} /></div>
        <div className="mc w-2"><div className="sk" style={{ width: '100%', height: 110, borderRadius: 8 }} /></div>
        <div className="mc"><div className="sk" style={{ width: '100%', height: 110, borderRadius: 8 }} /></div>
        <div className="vstack leaves-stack">
          <div className="mc"><div className="sk" style={{ width: '100%', height: '100%', borderRadius: 8 }} /></div>
          <div className="mc"><div className="sk" style={{ width: '100%', height: '100%', borderRadius: 8 }} /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-grid">
      {/* Row 1 — stat cards */}
      <MiniCard icon={<Users width={16} />} label="Total Workers" num={total} sub="across all teams" color="var(--sage)" />
      <MiniCard icon={<Check width={16} />} label="Present Today" num={presentPct} suffix="%" sub={`${present} of ${total}`} color="var(--sage)" />
      <MiniCard icon={<Plane width={16} />} label="On Leave" num={onLeave} sub="away today" color="var(--gold)" />
      <MiniCard icon={<Bell width={16} />} label="Pending Leaves" num={pendingL} sub="need decision" color="var(--danger)" />

      {/* NGO summary row */}
      {ngoSummary.length > 0 && (
        <div className="mc w-3" style={{ overflow: 'hidden' }}>
          <div className="mc-top" style={{ marginBottom: 8 }}>
            <span className="mc-icon" style={{ color: 'var(--sage)' }}><Star width={16} /></span>
            <span className="mc-label" style={{ fontSize: 11, fontWeight: 700 }}>NGO SPLIT</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ngoSummary.map(n => (
              <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
                <span style={{ minWidth: 110, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.name}</span>
                <div style={{ flex: 1, height: 8, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Number(n.allocation_percentage) || 0)}%`, height: 8, background: 'var(--sage)', borderRadius: 4 }} />
                </div>
                <span style={{ minWidth: 44, textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{Number(n.allocation_percentage) || 0}%</span>
                <span style={{ minWidth: 90, textAlign: 'right', color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>
                  {Number(n.salary_employees) || 0} emp · {formatSalary(n.salary_amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Heatmap — big (spans 2 cols, 2 rows) */}
      <div className="mc w-2 h-2" style={{ overflow: 'hidden' }}>
        <div style={{ fontSize: 10, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6, textAlign: 'center' }}>
          {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
            {['S','M','T','W','T','F','S'].map((n, i) => <div key={i} style={{ fontSize: 8, color: 'var(--ink-soft)', textAlign: 'center' }}>{n}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, flex: 1 }}>
            {Array.from({ length: fdow }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: dim }, (_, i) => i + 1).map(d => {
              const s = ds(d), hol = isHol(d);
              return <div key={d} title={hol ? 'Holiday' : `${dayStats[s]?.p||0}/${dayStats[s]?.t||0} present`}
                style={{ borderRadius: 3, background: hol ? 'repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(0,0,0,.03)3px,rgba(0,0,0,.03)6px)' : hColor(s), display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 18 }}>
                <span style={{ fontSize: 8, fontWeight: 600, color: hol ? 'var(--ink-soft)' : 'rgba(255,255,255,.85)' }}>{d}</span>
              </div>;
            })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { bg: 'var(--sage)', label: '\u226590%' },
            { bg: '#7a9a5a', label: '70\u201389%' },
            { bg: '#a8c08a', label: '50\u201369%' },
            { bg: 'var(--danger)', label: '<50%' },
            { bg: 'repeating-linear-gradient(45deg,transparent,transparent 2px,rgba(0,0,0,.05)2px,rgba(0,0,0,.05)4px)', label: 'Holiday' },
          ].map(c => (
            <span key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 8, color: 'var(--ink-soft)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: c.bg, display: 'inline-block', border: '1px solid var(--line)' }} />
              {c.label}
            </span>
          ))}
        </div>
      </div>

      {/* Right column stacked: Gender + Late */}
      <div className="vstack" style={{ gridRow: 'span 2' }}>
        <div className="mc" style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Gender</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { lbl: 'M', val: gender.M, c: '#5B6B4E' },
              { lbl: 'F', val: gender.F, c: '#B5603A' },
              { lbl: 'O', val: gender.O, c: '#C08A2E' },
            ].map(g => (
              <div key={g.lbl} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{g.val}</div>
                <div style={{ width: '100%', height: 6, background: 'var(--line)', borderRadius: 4, marginTop: 2, overflow: 'hidden' }}>
                  <div style={{ width: total ? `${g.val / total * 100}%` : 0, height: '100%', background: g.c, borderRadius: 4, minWidth: 2 }} />
                </div>
                <div style={{ fontSize: 9, color: 'var(--ink-soft)', marginTop: 2 }}>{g.lbl}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="mc" style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Late (7d)</div>
          <MiniBar data={late7} h={32} color="var(--gold)" />
        </div>
      </div>

      {/* Upcoming events — fills col 4 rows 2-3 */}
      <div className="mc events-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 10, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Events</div>
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {upcomingEvents.length ? upcomingEvents.map((ev, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 30, lineHeight: 1.1 }}>
                <span style={{ fontSize: 14, fontWeight: 800 }}>{ev.date.getDate()}</span>
                <span style={{ fontSize: 8, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
                  {ev.date.toLocaleDateString('en', { month: 'short' })}
                </span>
              </div>
              <div style={{ fontSize: 10, lineHeight: 1.3 }}>
                <div style={{ fontWeight: 600 }}>{ev.title}</div>
                <div style={{ color: 'var(--ink-soft)', fontSize: 9, marginTop: 1 }}>
                  {ev.type === 'holiday' ? 'Holiday' : 'Leave'}
                </div>
              </div>
            </div>
          )) : <div style={{ fontSize: 11, color: 'var(--ink-soft)', textAlign: 'center', padding: 12 }}>No upcoming events</div>}
        </div>
      </div>

      {/* Work Anniversaries + Birthdays — asymmetric full-width split */}
      <div className="mc" style={{ gridColumn: '1 / -1', overflow: 'hidden', display: 'grid', gridTemplateColumns: '1.7fr 1fr', padding: 0 }}>
        {/* Work Anniversaries — wider */}
        <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 12, borderRight: '1px solid var(--line)' }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--gold)', fontWeight: 700 }}><Star width={13} style={{ color: 'var(--gold)' }} />Work Anniversaries</span>
            {anniversaries.length > 0 && <span style={{ background: 'var(--gold-soft)', color: '#8a6217', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>Today</span>}
          </div>
          {anniversaries.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {anniversaries.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', border: '1px solid var(--gold)', borderRadius: 8, background: 'var(--gold-soft)' }}>
                  <Avatar name={a.name} size={26} />
                  <div style={{ fontSize: 11, lineHeight: 1.3, flex: 1 }}>
                    <span style={{ fontWeight: 700 }}>{a.name}</span>
                    {a.dept ? <span style={{ color: 'var(--ink-soft)', marginLeft: 6 }}>{a.dept}</span> : null}
                    <div style={{ color: '#8a6217', fontSize: 10, fontWeight: 600 }}>completes {a.years} year{a.years > 1 ? 's' : ''} today</div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, background: 'var(--sage-soft)', color: '#3f4c34', padding: '2px 8px', borderRadius: 10 }}>Today</span>
                </div>
              ))}
            </div>
          ) : <div style={{ fontSize: 11, color: 'var(--ink-soft)', textAlign: 'center', padding: 12 }}>No work anniversaries today</div>}
        </div>

        {/* Birthdays — narrower */}
        <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 12 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#be4b7b', fontWeight: 700 }}><Heart width={13} style={{ color: '#be4b7b' }} />Birthdays</span>
            {birthdays.length > 0 && <span style={{ background: '#fce7f3', color: '#be4b7b', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>Today</span>}
          </div>
          {birthdays.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {birthdays.map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', border: '1px solid #f3c8dd', borderRadius: 8, background: '#fdf0f6' }}>
                  <Avatar name={b.name} size={26} />
                  <div style={{ fontSize: 11, lineHeight: 1.3, flex: 1 }}>
                    <span style={{ fontWeight: 700 }}>{b.name}</span>
                    {b.dept ? <span style={{ color: 'var(--ink-soft)', marginLeft: 6 }}>{b.dept}</span> : null}
                    <div style={{ color: '#be4b7b', fontSize: 10, fontWeight: 600 }}>turns {b.age} today</div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, background: 'var(--sage-soft)', color: '#3f4c34', padding: '2px 8px', borderRadius: 10 }}>Today</span>
                </div>
              ))}
            </div>
          ) : <div style={{ fontSize: 11, color: 'var(--ink-soft)', textAlign: 'center', padding: 12 }}>No birthdays today</div>}
        </div>
      </div>

      {/* Recruiter Overview — full width */}
      <div className="mc w-3" style={{ gridColumn: '1 / -1' }}>
        <RecruiterOverview />
      </div>

      {/* Salary — big (spans 2 cols) */}
      <div className="mc w-2">
        <div style={{ fontSize: 10, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Salary by Department</div>
        {salaryDepts.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
            {(() => {
              const half = Math.ceil(salaryDepts.length / 2);
              const rows = [salaryDepts.slice(0, half), salaryDepts.slice(half)];
              let gi = 0;
              return rows.map((row, ri) => (
                <div key={ri} style={{ display: 'flex', gap: 3, flex: 1 }}>
                  {row.map(d => {
                    const c = COLORS[gi++ % COLORS.length];
                    return <div key={d.dept} style={{ flex: d.total || 1, background: c, borderRadius: 6, padding: '8px 10px', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>{deptLabel(d.dept)}</div>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>₹{(d.total / 100000).toFixed(1)}L</div>
                      <div style={{ fontSize: 9, opacity: .8 }}>{d.count} workers</div>
                    </div>;
                  })}
                </div>
              ));
            })()}
          </div>
        ) : <div style={{ fontSize: 11, color: 'var(--ink-soft)', textAlign: 'center', padding: 8 }}>Loading...</div>}
      </div>

      {/* Dept Workers bars */}
      <div className="mc">
        <div style={{ fontSize: 10, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Dept Workers</div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <MiniHBar data={deptWorkers.slice(0, 6)} mx={deptWorkers[0]?.val || 1} />
        </div>
      </div>

      {/* Leaves + Radial stacked */}
      <div className="vstack leaves-stack">
        <div className="mc" style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Leaves</div>
          <MiniStacked data={leaveStatus} h={10} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            {leaveStatus.map(d => (
              <span key={d.lbl} style={{ fontSize: 8, display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ width: 5, height: 5, borderRadius: 2, background: d.color, display: 'inline-block' }} />{d.lbl} {d.val}
              </span>
            ))}
          </div>
        </div>
        <div className="mc" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <MiniRadial pct={attPct} />
          <div style={{ fontSize: 9, color: 'var(--ink-soft)', marginTop: 2 }}>attendance</div>
        </div>
      </div>

      {/* Department scorecard — spans 3 cols */}
      <div className="mc w-3" style={{ overflow: 'hidden' }}>
        <div style={{ fontSize: 10, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Department Scorecard</div>
        {bubbleData.length ? (
          <div style={{ overflowX: 'auto', fontSize: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'var(--ink-soft)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.03em' }}>
                  <th style={{ textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid var(--line)' }}>Dept</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px', borderBottom: '1px solid var(--line)' }}>Workers</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px', borderBottom: '1px solid var(--line)' }}>Att %</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px', borderBottom: '1px solid var(--line)' }}>Late &#9660;</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px', borderBottom: '1px solid var(--line)' }}>Salary</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const salMap = {}; (salSum || []).forEach(x => { const d = x.department || 'NA'; salMap[d] = (salMap[d] || 0) + (parseFloat(x.current_salary) || 0); });
                  return bubbleData.map((d, i) => {
                    const tot = salMap[d.dept] || 0;
                    const bar = d.ar / Math.max(...bubbleData.map(x => x.ar), 1) * 100;
                    return <tr key={d.dept} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '5px 6px', fontWeight: 600 }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length], marginRight: 4, verticalAlign: 'middle' }} />
                        {deptLabel(d.dept)}
                      </td>
                      <td style={{ padding: '5px 6px', textAlign: 'right' }}>{d.n}</td>
                      <td style={{ padding: '5px 6px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                          <div style={{ width: 40, height: 5, borderRadius: 3, background: 'var(--line)', overflow: 'hidden' }}>
                            <div style={{ width: `${bar}%`, height: '100%', borderRadius: 3, background: d.ar >= 90 ? 'var(--sage)' : d.ar >= 70 ? '#7a9a5a' : 'var(--danger)' }} />
                          </div>
                          {d.ar}%
                        </div>
                      </td>
                      <td style={{ padding: '5px 6px', textAlign: 'right', color: d.al > 10 ? 'var(--danger)' : 'var(--ink-soft)' }}>{d.al}m</td>
                      <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 600 }}>₹{(tot / 100000).toFixed(1)}L</td>
                    </tr>;
                  });
                })()}
              </tbody>
            </table>
          </div>
        ) : <div style={{ fontSize: 11, color: 'var(--ink-soft)', textAlign: 'center', padding: 12 }}>No data</div>}
      </div>

      {/* ============ NOTICES ============ */}
      <div style={{ marginTop: 20 }}>
        <div className="card">
          <div className="card-head">
            <h3>Create Notice</h3>
          </div>
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {noticeErr && <div style={{ fontSize: 12, color: '#dc2626', background: '#FEF2F2', padding: '8px 12px', borderRadius: 8 }}>{noticeErr}</div>}
            <div className="form-row" style={{ flexWrap: 'wrap' }}>
              <label className="field" style={{ flex: 2, minWidth: 200 }}>
                Title
                <input value={noticeForm.title} onChange={e => setNoticeForm({...noticeForm, title: e.target.value})} placeholder="Notice title" />
              </label>
              <label className="field" style={{ flex: 3, minWidth: 250 }}>
                Description
                <textarea rows={2} value={noticeForm.content} onChange={e => setNoticeForm({...noticeForm, content: e.target.value})} placeholder="Write your notice..." style={{ resize: 'vertical' }} />
              </label>
              <div className="field" style={{ flex: 1, minWidth: 200 }}>
                Image
                <input ref={noticeFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleNoticeFile} />
                {noticeForm.media_url ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6, border: '1px solid var(--line)', borderRadius: 8, background: '#f8fafc' }}>
                    <img src={noticeForm.media_url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
                    <button className="btn btn-sm btn-danger" type="button" onClick={() => setNoticeForm({ ...noticeForm, media_url: '', media_type: '', media_name: '' })} style={{ margin: 0 }}>✕</button>
                  </div>
                ) : (
                  <button className="btn" type="button" onClick={() => noticeFileRef.current && noticeFileRef.current.click()} disabled={noticeUploading} style={{ width: '100%', borderStyle: 'dashed', fontFamily: 'inherit' }}>
                    {noticeUploading ? '📤 Uploading…' : '📷 Upload'}
                  </button>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)' }}>Send to:</span>
              {[['all', 'All'], ['admin', 'Admin'], ['accounts', 'Accounts'], ['hr', 'HR'], ['recruiter', 'Recruiter'], ['event_head', 'Event Head'], ['fro', 'FRO'], ['ngo', 'Ngo Admin']].map(([role, label]) => {
                const active = noticeForm.target_roles.includes(role)
                return (
                  <button key={role} type="button" onClick={() => noticeToggleRole(role)}
                    style={{
                      padding: '4px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                      border: active ? '1.5px solid #16a34a' : '1.5px solid var(--line)',
                      background: active ? '#f0fdf4' : '#fff', color: active ? '#15803d' : 'var(--ink-soft)',
                    }}>
                    {active ? '✓ ' : ''}{label}
                  </button>
                )
              })}
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)' }}>Popup</span>
                <button type="button" onClick={() => setNoticeForm({ ...noticeForm, popup: !noticeForm.popup })}
                  style={{
                    width: 40, height: 20, borderRadius: 999, border: 'none', cursor: 'pointer', position: 'relative',
                    background: noticeForm.popup ? '#16a34a' : '#cbd5e1', transition: 'background .2s',
                  }}>
                  <span style={{ position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s', left: noticeForm.popup ? 22 : 2 }} />
                </button>
              </span>
              <button className="btn btn-primary" onClick={publishNotice} disabled={noticeSaving} style={{ alignSelf: 'flex-end', marginTop: 2, fontFamily: 'inherit' }}>
                {noticeSaving ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
        <RecentNotices key={noticeRefresh} limit={5} title="Recent Notices" />
      </div>

      {noticeSuccess && (
        <div onClick={() => setNoticeSuccess(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1100, padding: '20px'
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#FFFFFF', width: '100%', maxWidth: '400px',
            borderRadius: '16px', boxShadow: '0 25px 60px rgba(0,0,0,0.15), 0 4px 20px rgba(0,0,0,0.08)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '32px 28px 24px', textAlign: 'center' }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%', background: '#DCFCE7',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <Check width={26} style={{ color: '#16A34A' }} />
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                Notice Created Successfully
              </h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#6B7280', lineHeight: 1.5 }}>
                Your notice has been published and is now visible to the selected panels.
              </p>
            </div>
            <div style={{ padding: '0 28px 28px', display: 'flex', justifyContent: 'center' }}>
              <button onClick={() => setNoticeSuccess(false)} style={{
                padding: '10px 32px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
                background: '#16A34A', color: '#FFFFFF', border: 'none',
                cursor: 'pointer', width: '100%'
              }}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
