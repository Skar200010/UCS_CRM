import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useHR } from '../store';
import { Users, Check, Clock, Bell, Cal } from '../icons';

function SearchIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

const RCOLORS = ['#5B6B4E','#1565C0','#7A5C7E','#B5603A','#C08A2E','#00838F','#6A1B9A','#2E7D32','#E65100','#4F6472'];

const STATUS_LABELS = {
  scheduled: 'Scheduled', hold: 'Pending', followed_up: 'Follow Up', call_back: 'Follow Up',
  ringing: 'Pending', unreachable: 'Pending', busy: 'Pending', switched_off: 'Pending',
  wrong_number: 'Rejected', invalid: 'Rejected', selected: 'Interviewed', joined: 'Joined',
  rejected: 'Rejected', not_interested: 'Rejected',
};

const STATUS_COLORS = {
  scheduled: '#1565C0', hold: '#F59E0B', followed_up: '#7A5C7E', call_back: '#7A5C7E',
  joined: '#5B6B4E', rejected: '#9E3B2E', selected: '#6A1B9A',
  ringing: '#F59E0B', unreachable: '#F59E0B', busy: '#F59E0B', switched_off: '#F59E0B',
  wrong_number: '#9E3B2E', invalid: '#9E3B2E', not_interested: '#9E3B2E',
};

function AnimatedNum({ to, suffix = '' }) {
  const [v, setV] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    if (to === 0) { setV(0); return; }
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      const dur = 1000, s = performance.now(), d = to;
      const tick = (n) => { const p = Math.min((n - s) / dur, 1); setV(typeof to === 'number' && to % 1 !== 0 ? parseFloat((d * (1 - Math.pow(1 - p, 3))).toFixed(1)) : Math.round(d * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      obs.disconnect();
    }, { threshold: 0.3 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [to]);
  return <span ref={ref}>{typeof v === 'number' && v % 1 !== 0 ? v.toLocaleString('en-IN') : v.toLocaleString('en-IN')}{suffix}</span>;
}

function SummaryCard({ icon, label, num, suffix = '', sub, color, gradient }) {
  return (
    <div className="ro-stat-card" style={gradient ? { background: gradient } : {}}>
      <div className="ro-stat-top">
        <span className="ro-stat-icon" style={{ color: color || 'var(--sage)' }}>{icon}</span>
        <span className="ro-stat-num">
          <AnimatedNum to={num} suffix={suffix} />
        </span>
      </div>
      <div className="ro-stat-label">{label}</div>
      {sub && <div className="ro-stat-sub">{sub}</div>}
    </div>
  );
}

function ProgressRing({ pct, size = 52, sw = 5, color }) {
  const r = (size - sw) / 2, circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct, 100) / 100);
  const c = color || (pct >= 70 ? 'var(--sage)' : pct >= 40 ? 'var(--gold)' : 'var(--danger)');
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
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" fontSize={size * 0.22} fontWeight={800} fill="var(--ink)">{Math.round(pct)}%</text>
    </svg>
  );
}

function DonutChart({ data, size = 160 }) {
  const total = data.reduce((s, d) => s + d.val, 0) || 1;
  const r = size / 2 - 10;
  const inner = r * 0.58;
  let cum = 0;
  const arcs = data.filter(d => d.val > 0).map((d, i) => {
    const pct = d.val / total;
    const startAngle = cum * 2 * Math.PI - Math.PI / 2;
    cum += pct;
    const endAngle = cum * 2 * Math.PI - Math.PI / 2;
    const largeArc = pct > 0.5 ? 1 : 0;
    const x1 = size / 2 + r * Math.cos(startAngle);
    const y1 = size / 2 + r * Math.sin(startAngle);
    const x2 = size / 2 + r * Math.cos(endAngle);
    const y2 = size / 2 + r * Math.sin(endAngle);
    const ix1 = size / 2 + inner * Math.cos(startAngle);
    const iy1 = size / 2 + inner * Math.sin(startAngle);
    const ix2 = size / 2 + inner * Math.cos(endAngle);
    const iy2 = size / 2 + inner * Math.sin(endAngle);
    const path = `M${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} L${ix2},${iy2} A${inner},${inner} 0 ${largeArc} 0 ${ix1},${iy1} Z`;
    return { path, color: d.color, label: d.label, val: d.val, pct: (pct * 100).toFixed(1) };
  });
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcs.map((a, i) => (
          <path key={i} d={a.path} fill={a.color} style={{ transition: 'opacity .2s' }}
            onMouseEnter={(e) => e.target.style.opacity = 0.8}
            onMouseLeave={(e) => e.target.style.opacity = 1}
            title={`${a.label}: ${a.val} (${a.pct}%)`} />
        ))}
        <text x={size / 2} y={size / 2 - 6} textAnchor="middle" fontSize={16} fontWeight={800} fill="var(--ink)">{total}</text>
        <text x={size / 2} y={size / 2 + 10} textAnchor="middle" fontSize={9} fill="var(--ink-soft)">Total Leads</text>
      </svg>
    </div>
  );
}

export default function RecruiterOverview() {
  const { fetchRecruiters, fetchLeads } = useHR();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [tablePage, setTablePage] = useState(0);
  const PAGE_SIZE = 8;

  const load = useCallback(async () => {
    try {
      const [recruiters, leads] = await Promise.all([
        fetchRecruiters().catch(() => []),
        fetchLeads().catch(() => []),
      ]);

      const now = new Date();
      const today = now.toISOString().slice(0, 10);

      const recruiterStats = recruiters.map((r) => {
        const rLeads = leads.filter((l) => l.recruiter_id === r.id || l.created_by === r.id);
        const total = rLeads.length;
        const byStatus = {};
        rLeads.forEach((l) => { byStatus[l.status] = (byStatus[l.status] || 0) + 1; });

        const scheduled = byStatus['scheduled'] || 0;
        const pending = (byStatus['hold'] || 0) + (byStatus['followed_up'] || 0) + (byStatus['call_back'] || 0) + (byStatus['ringing'] || 0) + (byStatus['unreachable'] || 0) + (byStatus['busy'] || 0) + (byStatus['switched_off'] || 0);
        const interviewed = byStatus['selected'] || 0;
        const joined = byStatus['joined'] || 0;
        const rejected = byStatus['rejected'] || 0;
        const followUp = (byStatus['followed_up'] || 0) + (byStatus['call_back'] || 0);

        const convBase = joined + rejected;
        const conversionRate = convBase > 0 ? parseFloat(((joined / convBase) * 100).toFixed(1)) : 0;
        const todayLeads = rLeads.filter((l) => l.created_at?.slice(0, 10) === today).length;

        const recentActivity = rLeads
          .filter((l) => l.updated_at)
          .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
        const lastActivity = recentActivity?.updated_at || recentActivity?.created_at || null;

        const withUpdates = rLeads.filter((l) => l.created_at && l.updated_at && l.created_at !== l.updated_at);
        const avgResponseTime = withUpdates.length > 0
          ? parseFloat((withUpdates.reduce((s, l) => s + (new Date(l.updated_at) - new Date(l.created_at)) / 3600000, 0) / withUpdates.length).toFixed(1))
          : 0;

        return {
          id: r.id, name: r.name, department: r.department,
          leadsCount: total, scheduled, pending, interviewed, joined, rejected, followUp,
          conversionRate, todayLeads, lastActivity, avgResponseTime, byStatus,
        };
      });

      const totalRecruiters = recruiters.length;
      const totalLeads = leads.length;
      const totalScheduled = leads.filter((l) => l.status === 'scheduled').length;
      const totalPending = leads.filter((l) => ['hold', 'followed_up', 'call_back', 'ringing', 'unreachable', 'busy', 'switched_off'].includes(l.status)).length;
      const totalInterviewed = leads.filter((l) => l.status === 'selected').length;
      const totalJoined = leads.filter((l) => l.status === 'joined').length;
      const totalRejected = leads.filter((l) => l.status === 'rejected').length;
      const totalFollowUp = leads.filter((l) => ['followed_up', 'call_back'].includes(l.status)).length;
      const overallConvBase = totalJoined + totalRejected;
      const overallConversionRate = overallConvBase > 0 ? parseFloat(((totalJoined / overallConvBase) * 100).toFixed(1)) : 0;

      const statusBreakdown = {};
      leads.forEach((l) => { const s = l.status || 'unknown'; statusBreakdown[s] = (statusBreakdown[s] || 0) + 1; });

      const monthlyData = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthLabel = d.toLocaleDateString('en', { month: 'short' });
        const monthStart = d.toISOString().slice(0, 10);
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
        const monthLeads = leads.filter((l) => { const cd = l.created_at?.slice(0, 10); return cd >= monthStart && cd <= monthEnd; });
        monthlyData.push({
          month: monthLabel, total: monthLeads.length,
          scheduled: monthLeads.filter((l) => l.status === 'scheduled').length,
          joined: monthLeads.filter((l) => l.status === 'joined').length,
          rejected: monthLeads.filter((l) => l.status === 'rejected').length,
        });
      }

      const todayActivities = leads
        .filter((l) => l.updated_at?.slice(0, 10) === today || l.created_at?.slice(0, 10) === today)
        .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
        .slice(0, 20)
        .map((l) => ({ id: l.id, name: l.name, status: l.status, recruiter: l.created_by_name || 'System', time: l.updated_at || l.created_at }));

      const activeRecruiters = recruiterStats.filter((r) => r.leadsCount > 0).length;
      const avgLeadsPerRecruiter = totalRecruiters > 0 ? parseFloat((totalLeads / totalRecruiters).toFixed(1)) : 0;
      const totalLeadAge = leads.reduce((sum, l) => sum + (now - new Date(l.created_at)) / 86400000, 0);
      const avgHiringTime = totalLeads > 0 ? parseFloat((totalLeadAge / totalLeads).toFixed(1)) : 0;

      setData({
        summary: { totalRecruiters, activeRecruiters, totalLeads, totalScheduled, totalPending, totalInterviewed, totalJoined, totalRejected, totalFollowUp, overallConversionRate },
        recruiterStats, statusBreakdown, monthlyData, todayActivities,
        analytics: { avgLeadsPerRecruiter, avgHiringTime, avgResponseTime: recruiterStats.reduce((s, r) => s + r.avgResponseTime, 0) / (totalRecruiters || 1), avgDailyLeads: parseFloat((totalLeads / 30).toFixed(1)) },
      });
    } catch (e) { console.error('RecruiterOverview load error:', e); } finally { setLoading(false); }
  }, [fetchRecruiters, fetchLeads]);

  useEffect(() => { load(); }, [load]);

  const summary = data?.summary || {};
  const recruiters = data?.recruiterStats || [];
  const statusBreakdown = data?.statusBreakdown || {};
  const monthlyData = data?.monthlyData || [];
  const todayActivities = data?.todayActivities || [];
  const analytics = data?.analytics || {};

  const filteredRecruiters = useMemo(() => {
    let list = [...recruiters];
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(r => r.name?.toLowerCase().includes(s));
    }
    return list;
  }, [recruiters, searchTerm]);

  const leaderboard = useMemo(() =>
    [...filteredRecruiters].sort((a, b) => b.joined - a.joined || b.leadsCount - a.leadsCount),
    [filteredRecruiters]
  );

  const sortedByLeads = useMemo(() =>
    [...filteredRecruiters].sort((a, b) => b.leadsCount - a.leadsCount),
    [filteredRecruiters]
  );

  const maxLeads = useMemo(() =>
    Math.max(...sortedByLeads.map(r => r.leadsCount), 1),
    [sortedByLeads]
  );

  const donutData = useMemo(() => {
    const map = {};
    Object.entries(statusBreakdown).forEach(([k, v]) => {
      const group = STATUS_LABELS[k] || k;
      map[group] = (map[group] || 0) + v;
    });
    const colors = { Scheduled: '#1565C0', Pending: '#F59E0B', 'Follow Up': '#7A5C7E', Interviewed: '#6A1B9A', Joined: '#5B6B4E', Rejected: '#9E3B2E' };
    return Object.entries(map).map(([k, v]) => ({ label: k, val: v, color: colors[k] || '#999' }));
  }, [statusBreakdown]);

  const barColors = ['#1565C0', '#5B6B4E', '#6A1B9A', '#B5603A', '#C08A2E', '#00838F'];
  const maxBarVal = useMemo(() => Math.max(...monthlyData.map(m => m.total), 1), [monthlyData]);

  const pagedLeads = useMemo(() => {
    const start = tablePage * PAGE_SIZE;
    return filteredRecruiters.slice(start, start + PAGE_SIZE);
  }, [filteredRecruiters, tablePage]);

  const totalPages = Math.ceil(filteredRecruiters.length / PAGE_SIZE);

  if (loading) {
    return (
      <div style={{ padding: '8px 0' }}>
        <div className="ro-section-title">Recruiter Overview</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10 }}>
          {[...Array(6)].map((_, i) => <div key={i} className="sk" style={{ height: 90, borderRadius: 12 }} />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="ro-wrap">
      {/* ── Section Title ── */}
      <div className="ro-header">
        <div>
          <div className="ro-section-title">Recruiter Overview</div>
          <div className="ro-section-sub">Monitor recruiter performance, lead progress, interview scheduling and conversions in real time.</div>
        </div>
        <div className="ro-filters">
          <select value={filterDate} onChange={e => setFilterDate(e.target.value)} className="ro-filter-select">
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7days">Last 7 Days</option>
            <option value="month">This Month</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="ro-filter-select">
            <option value="all">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="joined">Joined</option>
            <option value="rejected">Rejected</option>
            <option value="hold">Pending</option>
          </select>
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="ro-filter-select">
            <option value="all">All Sources</option>
            <option value="Walk-in">Walk-in</option>
            <option value="LinkedIn">LinkedIn</option>
            <option value="Referral">Referral</option>
            <option value="Job Portal">Job Portal</option>
          </select>
          <div className="ro-search-wrap">
            <SearchIcon size={14} />
            <input type="text" placeholder="Search recruiter..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setTablePage(0); }} className="ro-search-input" />
          </div>
        </div>
      </div>

      {/* ── First Row: 6 Summary Cards ── */}
      <div className="ro-summary-grid">
        <SummaryCard icon={<Users size={18} />} label="Total Recruiters" num={summary.totalRecruiters || 0} sub={`${summary.activeRecruiters || 0} Active Recruiters`} color="#1565C0" />
        <SummaryCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B6B4E" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="8"/><line x1="20.5" y1="6" x2="20.5" y2="10"/></svg>} label="Total Leads" num={summary.totalLeads || 0} sub="All recruiter leads" color="#5B6B4E" />
        <SummaryCard icon={<Cal size={18} />} label="Scheduled" num={summary.totalScheduled || 0} sub="Interview Scheduled" color="#6A1B9A" />
        <SummaryCard icon={<Clock size={18} />} label="Pending" num={summary.totalPending || 0} sub="Awaiting Follow-up" color="#F59E0B" />
        <SummaryCard icon={<Check size={18} />} label="Joined" num={summary.totalJoined || 0} sub="Successfully Hired" color="#5B6B4E" />
        <div className="ro-stat-card ro-conv-card">
          <div className="ro-conv-ring">
            <ProgressRing pct={summary.overallConversionRate || 0} size={56} sw={5} />
          </div>
          <div className="ro-conv-info">
            <div className="ro-stat-label">Conversion Rate</div>
            <div className="ro-stat-sub">Overall Performance</div>
          </div>
        </div>
      </div>

      {/* ── Third Section: Recruiter Leaderboard ── */}
      <div className="ro-section-title" style={{ marginTop: 20 }}>Recruiter Leaderboard</div>
      <div className="ro-leaderboard-grid">
        {leaderboard.slice(0, 5).map((r, i) => {
          const medals = ['🥇', '🥈', '🥉'];
          const medal = medals[i] || '';
          const isTop = i === 0;
          const rate = r.leadsCount > 0 ? Math.round(r.joined / r.leadsCount * 100) : 0;
          return (
            <div key={r.id} className={`ro-lb-card ${isTop ? 'ro-lb-top' : ''}`}>
              {isTop && <div className="ro-lb-trophy">🏆</div>}
              <div className="ro-lb-medal">{medal || `#${i + 1}`}</div>
              <div className="ro-lb-name">{r.name}</div>
              <div className="ro-lb-stats">
                <span>{r.leadsCount} Leads</span>
                <span>{r.scheduled} Scheduled</span>
                <span>{r.joined} Joined</span>
                <span>{rate}% Success</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Sixth Section: Monthly Performance + Analytics Side by Side ── */}
      <div className="ro-split-row">
        <div className="ro-card ro-split-chart">
          <div className="ro-card-title">Monthly Recruiter Performance</div>
          <div className="ro-bar-chart">
            {monthlyData.map((m, i) => {
              const h = maxBarVal > 0 ? (m.total / maxBarVal * 120) : 0;
              const sh = maxBarVal > 0 ? (m.scheduled / maxBarVal * 120) : 0;
              const jh = maxBarVal > 0 ? (m.joined / maxBarVal * 120) : 0;
              const rh = maxBarVal > 0 ? (m.rejected / maxBarVal * 120) : 0;
              return (
                <div key={m.month} className="ro-bar-group">
                  <div className="ro-bar-stack" style={{ height: 140 }}>
                    <div className="ro-bar-tooltip">
                      <div>{m.month}</div>
                      <div>Total: {m.total}</div>
                      <div>Scheduled: {m.scheduled}</div>
                      <div>Joined: {m.joined}</div>
                    </div>
                    <div className="ro-bar-seg" style={{ height: h, background: '#1565C0' }} title={`Total: ${m.total}`} />
                    <div className="ro-bar-seg" style={{ height: sh, background: '#5B6B4E', marginTop: 2 }} title={`Scheduled: ${m.scheduled}`} />
                    <div className="ro-bar-seg" style={{ height: jh, background: '#6A1B9A', marginTop: 2 }} title={`Joined: ${m.joined}`} />
                  </div>
                  <div className="ro-bar-label">{m.month}</div>
                </div>
              );
            })}
          </div>
          <div className="ro-bar-legend">
            <span><span className="ro-bar-dot" style={{ background: '#1565C0' }} />Total</span>
            <span><span className="ro-bar-dot" style={{ background: '#5B6B4E' }} />Scheduled</span>
            <span><span className="ro-bar-dot" style={{ background: '#6A1B9A' }} />Joined</span>
          </div>
        </div>

        <div className="ro-split-side">
          <div className="ro-card ro-side-analytics">
            <div className="ro-card-title">Recruiter Analytics</div>
            <div className="ro-side-grid">
              <div className="ro-side-stat">
                <div className="ro-side-icon" style={{ background: '#1565C015', color: '#1565C0' }}><Clock size={16} /></div>
                <div className="ro-side-val">{analytics.avgResponseTime || 0}h</div>
                <div className="ro-side-lbl">Avg Response Time</div>
              </div>
              <div className="ro-side-stat">
                <div className="ro-side-icon" style={{ background: '#7A5C7E15', color: '#7A5C7E' }}><Clock size={16} /></div>
                <div className="ro-side-val">{analytics.avgHiringTime || 0}d</div>
                <div className="ro-side-lbl">Avg Hiring Time</div>
              </div>
              <div className="ro-side-stat">
                <div className="ro-side-icon" style={{ background: '#5B6B4E15', color: '#5B6B4E' }}><Users size={16} /></div>
                <div className="ro-side-val">{analytics.avgLeadsPerRecruiter || 0}</div>
                <div className="ro-side-lbl">Avg Leads / Recruiter</div>
              </div>
              <div className="ro-side-stat">
                <div className="ro-side-icon" style={{ background: '#C08A2E15', color: '#C08A2E' }}><Bell size={16} /></div>
                <div className="ro-side-val">{analytics.avgDailyLeads || 0}</div>
                <div className="ro-side-lbl">Avg Daily Leads</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
