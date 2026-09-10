import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search, SlidersHorizontal, X, ChevronDown, ChevronUp, ArrowUpDown, List, LayoutGrid,
  Ticket, Inbox, MessageSquare, MoreHorizontal, Eye, RefreshCw, Plus, Trash2, Send,
  CheckCircle2, Clock, Calendar, Building2, Tag, ChevronLeft, ChevronRight, Circle,
} from 'lucide-react';
import { apiGet, apiPut, apiPost, apiDelete } from '../api/auth';
import { toast } from '../../../components/Toast';
import { deptLabel } from '../../../lib/labels';
import { routeFor, routeLabel } from '../../../lib/ticketRouting';
import { Avatar } from '../../../components/ui';

const DEPARTMENTS = ['accounts', 'developers', 'hr', 'fro'];
const CATEGORIES = [
  { value: 'suspense', label: 'Suspense' },
  { value: 'payment_issue', label: 'Payment Issue' },
  { value: 'receipt_issue', label: 'Receipt Issue' },
  { value: 'technical', label: 'Technical' },
  { value: 'hr_issue', label: 'HR Related' },
  { value: 'other', label: 'Other' },
];

const ACCOUNTS_QUEUE_CATEGORIES = ['suspense', 'payment_issue', 'receipt_issue'];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const STATUS_META = {
  open:        { label: 'Open',        bg: '#fefce8', color: '#a16207' },
  in_progress: { label: 'In Progress', bg: '#eff6ff', color: '#1d4ed8' },
  resolved:    { label: 'Resolved',    bg: '#f0fdf4', color: '#16a34a' },
  closed:      { label: 'Closed',      bg: '#f3f4f6', color: '#6b7280' },
};

const PRIORITY_META = {
  low:    { bg: '#f3f4f6', color: '#374151' },
  medium: { bg: '#fef3c7', color: '#92400e' },
  high:   { bg: '#fee2e2', color: '#991b1b' },
};

const PANEL_LABELS = {
  fro: 'FRO',
  accounts: 'Accounts',
  hr: 'HR',
  dev_panel: 'Developer',
  ngo_admin: 'Admin',
  event_head: 'Event Head',
  recruiter: 'Recruiter',
  other: 'Other',
};

const PER_PAGE = 10;

const categoryLabel = (v) => CATEGORIES.find(c => c.value === v)?.label || v;
const ticketNo = (t) => `#TKT-${((t.id || '').replace(/-/g, '').slice(0, 8) || t.raised_by || '').toUpperCase()}`;

function StatRing({ value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" style={{ flexShrink: 0 }}>
      <circle cx="20" cy="20" r={r} fill="none" stroke="var(--line)" strokeWidth="4" />
      <circle
        cx="20" cy="20" r={r} fill="none"
        stroke={color} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`}
        transform="rotate(-90 20 20)"
      />
      <text x="20" y="24" textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>{pct}%</text>
    </svg>
  );
}

function StatusPill({ status }) {
  const m = STATUS_META[status] || { label: status, bg: '#f3f4f6', color: '#6b7280' };
  return (
    <span className="tw-pill" style={{ background: m.bg, color: m.color }}>
      <span className="tw-dot" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

function PriorityPill({ priority }) {
  const m = PRIORITY_META[priority] || { bg: '#f3f4f6', color: '#6b7280' };
  return (
    <span className="tw-pill" style={{ background: m.bg, color: m.color }}>
      {priority || '—'}
    </span>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="tw-fselect">
      <span className="tw-fkey">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export default function AccountsTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ status: '', department: '', category: '', priority: '', dateFrom: '', dateTo: '' });
  const [activeTab, setActiveTab] = useState('all');
  const [sort, setSort] = useState('newest');
  const [view, setView] = useState('list');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);

  const [drawer, setDrawer] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [statusDraft, setStatusDraft] = useState('');
  const [priorityDraft, setPriorityDraft] = useState('');
  const [resolutionDraft, setResolutionDraft] = useState('');
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const menuRef = useRef(null);

  const [showRaise, setShowRaise] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deskLoading, setDeskLoading] = useState(false);
  const [form, setForm] = useState({ department: 'accounts', category: 'technical', subject: '', description: '', reference_id: '', priority: 'medium', desk_number: '', ngo: '' });
  const [formErrors, setFormErrors] = useState({});

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    setLoadError(null);
    try {
      const regularTickets = await apiGet('/tickets');
      const allTickets = (regularTickets || [])
        .map(t => ({ ...t, _source: 'regular' }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setTickets(allTickets.filter(t => ACCOUNTS_QUEUE_CATEGORIES.includes(t.category)));
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
      setLoadError(err.message);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const id = setInterval(() => load(true), 30000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    const onDown = (e) => {
      if (e.key === 'Escape') {
        if (drawer) setDrawer(null);
        if (menuId) setMenuId(null);
      }
    };
    document.addEventListener('keydown', onDown);
    return () => document.removeEventListener('keydown', onDown);
  }, [drawer, menuId]);

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuId(null); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchMyAsset = async () => {
    setDeskLoading(true);
    try {
      const assets = await apiGet('/assets/my-assigned').catch(() => []);
      const asset = Array.isArray(assets) ? assets[0] : null;
      if (asset) {
        setForm(p => ({ ...p, desk_number: p.desk_number || asset.code || '', ngo: p.ngo || asset.location || '' }));
      }
    } catch (err) { /* silent */ }
    finally { setDeskLoading(false); }
  };

  useEffect(() => { fetchMyAsset(); }, []);

  const stats = useMemo(() => {
    const all = tickets.length;
    const open = tickets.filter(t => t.status === 'open').length;
    const inProgress = tickets.filter(t => t.status === 'in_progress').length;
    const resolved = tickets.filter(t => t.status === 'resolved').length;
    return { all, open, inProgress, resolved };
  }, [tickets]);

  const tabCounts = useMemo(() => {
    const count = (fn) => tickets.filter(fn).length;
    return {
      all: tickets.length,
      open: count(t => t.status === 'open'),
      in_progress: count(t => t.status === 'in_progress'),
      resolved: count(t => t.status === 'resolved'),
    };
  }, [tickets]);

  const filtered = useMemo(() => {
    let list = tickets;
    if (activeTab !== 'all') list = list.filter(t => t.status === activeTab);
    if (filters.status) list = list.filter(t => t.status === filters.status);
    if (filters.department) list = list.filter(t => (t.department || '') === filters.department);
    if (filters.category) list = list.filter(t => (t.category || '') === filters.category);
    if (filters.priority) list = list.filter(t => (t.priority || '') === filters.priority);
    if (filters.dateFrom) list = list.filter(t => new Date(t.created_at) >= new Date(filters.dateFrom + 'T00:00:00'));
    if (filters.dateTo) list = list.filter(t => new Date(t.created_at) <= new Date(filters.dateTo + 'T23:59:59'));
    if (debouncedSearch) {
      list = list.filter(t => {
        const hay = [
          t.subject, t.description,
          t.workers?.name, t.raised_by_name,
          deptLabel(t.department), categoryLabel(t.category),
          t.reference_id, ticketNo(t),
        ].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(debouncedSearch);
      });
    }
    list = [...list].sort((a, b) =>
      sort === 'newest'
        ? new Date(b.created_at) - new Date(a.created_at)
        : new Date(a.created_at) - new Date(b.created_at));
    return list;
  }, [tickets, activeTab, filters, debouncedSearch, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  useEffect(() => { setPage(1); }, [debouncedSearch, activeTab, filters, view]);

  const applyFilter = (key, value) => {
    setFilters(f => ({ ...f, [key]: value }));
    setActiveTab('all');
  };

  const resetFilters = () => {
    setFilters({ status: '', department: '', category: '', priority: '', dateFrom: '', dateTo: '' });
    setActiveTab('all');
    setSearch('');
    setDebouncedSearch('');
  };

  const hasActiveFilters = Object.values(filters).some(Boolean) || activeTab !== 'all' || !!debouncedSearch;

  const rowMenuOpen = menuId;

  const markSelected = (t) => {
    setSelectedIds(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id]);
  };
  const allOnPageSelected = pageItems.length > 0 && pageItems.every(t => selectedIds.includes(t.id));
  const toggleSelectAll = () => {
    setSelectedIds(allOnPageSelected ? selectedIds.filter(id => !pageItems.some(t => t.id === id)) : [...new Set([...selectedIds, ...pageItems.map(t => t.id)])]);
  };

  const openDrawer = async (ticket) => {
    setMenuId(null);
    setDrawer(ticket);
    setStatusMenuOpen(false);
    setDrawerLoading(true);
    setStatusDraft(ticket.status);
    setPriorityDraft(ticket.priority || 'medium');
    setResolutionDraft(ticket.resolution || '');
    setReplyText('');
    try {
      const data = await apiGet(`/tickets/${ticket.id}`);
      setDrawer({ ...data, _source: 'regular' });
      setStatusDraft(data.status);
      setPriorityDraft(data.priority || 'medium');
      setResolutionDraft(data.resolution || '');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setDrawerLoading(false);
    }
  };

  const saveDrawer = async () => {
    if (!drawer) return;
    if (statusDraft === 'resolved' && (!resolutionDraft || !resolutionDraft.trim())) {
      toast('Please provide a resolution note', 'warning');
      return;
    }
    setDrawerSaving(true);
    try {
      await apiPut(`/tickets/${drawer.id}`, {
        status: statusDraft,
        priority: priorityDraft,
        resolution: statusDraft === 'resolved' ? resolutionDraft.trim() : undefined,
      });
      if (statusDraft === 'resolved' && drawer.status !== 'resolved' && resolutionDraft.trim()) {
        await apiPost(`/tickets/${drawer.id}/reply`, { message: resolutionDraft.trim() }).catch(() => {});
      }
      toast('Ticket updated', 'success');
      const data = await apiGet(`/tickets/${drawer.id}`);
      setDrawer({ ...data, _source: 'regular' });
      setStatusDraft(data.status);
      setPriorityDraft(data.priority || 'medium');
      setResolutionDraft(data.resolution || '');
      load(true);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setDrawerSaving(false);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !drawer) return;
    setSendingReply(true);
    try {
      await apiPost(`/tickets/${drawer.id}/reply`, { message: replyText.trim() });
      setReplyText('');
      const data = await apiGet(`/tickets/${drawer.id}`);
      setDrawer({ ...data, _source: 'regular' });
      load(true);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSendingReply(false);
    }
  };

  const quickStatus = async (ticket, status) => {
    setMenuId(null);
    try {
      await apiPut(`/tickets/${ticket.id}`, { status });
      toast(`Status updated to ${STATUS_META[status]?.label || status}`, 'success');
      load(true);
      if (drawer?.id === ticket.id) {
        const data = await apiGet(`/tickets/${ticket.id}`);
        setDrawer({ ...data, _source: 'regular' });
        setStatusDraft(data.status);
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const quickPriority = async (ticket, priority) => {
    setMenuId(null);
    try {
      await apiPut(`/tickets/${ticket.id}`, { priority });
      toast(`Priority set to ${priority}`, 'success');
      load(true);
      if (drawer?.id === ticket.id) setPriorityDraft(priority);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await apiDelete(`/tickets/${confirmDelete.id}`);
      toast('Ticket deleted', 'success');
      if (drawer?.id === confirmDelete.id) setDrawer(null);
      setConfirmDelete(null);
      load(true);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleRaise = async () => {
    const errs = {};
    if (!form.subject.trim()) errs.subject = 'Subject is required';
    if (!form.desk_number.trim()) errs.desk_number = 'Desk Number is required';
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    setFormErrors({});
    setSubmitting(true);
    try {
      const route = routeFor(form.category);
      const base = {
        subject: form.subject,
        description: form.description,
        category: form.category,
        priority: form.priority,
        reference_id: form.reference_id,
        desk_number: form.desk_number,
        ngo: form.ngo,
        raised_by_panel: 'accounts',
      };
      if (route.system === 'developer') {
        await apiPost('/developer-tickets', base);
      } else {
        await apiPost('/tickets', { ...base, department: route.department });
      }
      toast('Ticket submitted successfully', 'success');
      setShowRaise(false);
      setForm({ department: 'accounts', category: 'technical', subject: '', description: '', reference_id: '', priority: 'medium', desk_number: form.desk_number, ngo: form.ngo });
      load();
    } catch (err) { setFormErrors({ _general: err.message }); }
    finally { setSubmitting(false); }
  };

  const fmtDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const fmtDateTime = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const renderRowMenu = (t) => {
    if (rowMenuOpen !== t.id) return null;
    return (
      <div className="tw-rowmenu" ref={menuRef} onClick={e => e.stopPropagation()}>
        <button className="tw-rowmenu-item" onClick={() => openDrawer(t)}>
          <Eye size={14} /> View details
        </button>
        <div className="tw-rowmenu-label">Change status</div>
        {['open', 'in_progress', 'resolved'].map(s => (
          <button key={s} className="tw-rowmenu-item" onClick={() => quickStatus(t, s)}>
            <Circle size={12} style={{ color: STATUS_META[s]?.color }} /> {STATUS_META[s]?.label}
          </button>
        ))}
        <div className="tw-rowmenu-label">Change priority</div>
        {PRIORITIES.map(p => (
          <button key={p.value} className="tw-rowmenu-item" onClick={() => quickPriority(t, p.value)}>
            <Tag size={12} /> {p.label}
          </button>
        ))}
        <div className="tw-rowmenu-divider" />
        <button className="tw-rowmenu-item danger" onClick={() => setConfirmDelete(t)}>
          <Trash2 size={14} /> Delete ticket
        </button>
      </div>
    );
  };

  const renderRow = (t, grid) => {
    const count = typeof t.comment_count === 'number' ? t.comment_count : t.comment_count || 0;
    const isSelected = selectedIds.includes(t.id);
    const isDrawerOpen = drawer?.id === t.id;

    if (grid) {
      return (
        <div key={t.id} className={`tw-card${isSelected ? ' is-selected' : ''}${isDrawerOpen ? ' is-open' : ''}`} onClick={() => openDrawer(t)}>
          <div className="tw-card-top">
            <span className="tw-card-no">{ticketNo(t)}</span>
            <div className="tw-card-pills">
              <StatusPill status={t.status} />
              <PriorityPill priority={t.priority} />
            </div>
          </div>
          <div className="tw-card-subject">{t.subject}</div>
          <div className="tw-card-meta">
            <Avatar name={t.workers?.name || t.raised_by_name} size={24} />
            <span className="tw-card-owner">{t.workers?.name || t.raised_by_name || 'Unknown'}</span>
            <span className="tw-card-cat">{categoryLabel(t.category)}</span>
            <span className="tw-card-date">{fmtDate(t.created_at)}</span>
          </div>
          <div className="tw-card-foot">
            <span className="tw-card-comments"><MessageSquare size={12} /> {count}</span>
            <button className="tw-iconbtn" onClick={e => { e.stopPropagation(); setMenuId(menuId === t.id ? null : t.id); }}><MoreHorizontal size={16} /></button>
          </div>
          {renderRowMenu(t)}
        </div>
      );
    }

    return (
      <div key={t.id} className={`tw-row${isSelected ? ' is-selected' : ''}${isDrawerOpen ? ' is-open' : ''}`} onClick={() => openDrawer(t)}>
        <label className="tw-check" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={isSelected} onChange={() => markSelected(t)} />
        </label>
        <Avatar name={t.workers?.name || t.raised_by_name} size={38} />
        <div className="tw-row-main">
          <div className="tw-subject">{t.subject}</div>
          <div className="tw-submeta">
            <span className="tw-owner">{t.workers?.name || t.raised_by_name || 'Unknown'}</span>
            <span className="tw-sep">·</span>
            <span className="tw-dept">{deptLabel(t.department)}</span>
            <span className="tw-sep">·</span>
            <span className="tw-cat">{categoryLabel(t.category)}</span>
            <span className="tw-sep">·</span>
            <span className="tw-no">{ticketNo(t)}</span>
          </div>
        </div>
        <PriorityPill priority={t.priority} />
        <StatusPill status={t.status} />
        <div className="tw-datecol">
          <span className="tw-date">{fmtDate(t.created_at)}</span>
          <span className="tw-comments"><MessageSquare size={12} /> {count}</span>
        </div>
        <div className="tw-row-actions" onClick={e => e.stopPropagation()}>
          <button className="tw-iconbtn" onClick={() => setMenuId(menuId === t.id ? null : t.id)}><MoreHorizontal size={16} /></button>
          {renderRowMenu(t)}
        </div>
      </div>
    );
  };

  return (
    <div className="tw-workspace">
      <div className="tw-main">
        <div className="tw-breadcrumb">Accounts <span className="tw-bc-sep">/</span> Tickets</div>

        <div className="tw-header">
          <div className="tw-title-block">
            <h2 className="tw-title">Tickets</h2>
            <p className="tw-subtitle">Queue &amp; resolution desk</p>
          </div>
          <div className="tw-header-actions">
            <span className={`tw-live${refreshing ? ' tw-live-working' : ''}`}>
              <span className="tw-live-dot" /> {refreshing ? 'Syncing…' : 'Live'}
              {lastUpdated ? ` · ${lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}
            </span>
            <button className="btn btn-sm" onClick={() => load()} title="Refresh">
              <RefreshCw size={13} />
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => setShowRaise(true)}>
              <Plus size={14} /> Raise Ticket
            </button>
          </div>
        </div>

        <div className="tw-stats">
          {[
            { key: 'all', label: 'All Tickets', value: stats.all, color: 'var(--sage)' },
            { key: 'open', label: 'Open', value: stats.open, color: '#a16207' },
            { key: 'in_progress', label: 'In Progress', value: stats.inProgress, color: '#1d4ed8' },
            { key: 'resolved', label: 'Resolved', value: stats.resolved, color: '#16a34a' },
          ].map(s => (
            <div key={s.key} className="tw-stat" onClick={() => { setActiveTab(s.key); }}>
              <StatRing value={s.value} total={stats.all} color={s.color} />
              <div className="tw-stat-info">
                <div className="tw-stat-num" style={{ color: s.color }}>{s.value}</div>
                <div className="tw-stat-lbl">{s.label}</div>
                <div className="tw-stat-sub">{stats.all > 0 ? `${Math.round((s.value / stats.all) * 100)}% of total` : '—'}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="tw-toolbar">
          <div className="tw-search">
            <Search size={15} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search subject, raised by, department, category, ticket ID…"
            />
            {search && <button className="tw-search-clear" onClick={() => setSearch('')}><X size={13} /></button>}
          </div>
          <button className={`tw-filter-toggle${showFilters ? ' active' : ''}${hasActiveFilters ? ' has-filters' : ''}`} onClick={() => setShowFilters(f => !f)}>
            {showFilters ? <SlidersHorizontal size={15} /> : <SlidersHorizontal size={15} />} Filters
            {hasActiveFilters && <span className="tw-filter-count">{Object.values(filters).filter(Boolean).length + (activeTab !== 'all' ? 1 : 0) + (debouncedSearch ? 1 : 0)}</span>}
            {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <div className="tw-toolbar-spacer" />
          <label className="tw-sort">
            <ArrowUpDown size={14} />
            <select value={sort} onChange={e => setSort(e.target.value)}>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </label>
          <div className="tw-viewtoggle" role="group" aria-label="View">
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} title="List view"><List size={15} /></button>
            <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} title="Grid view"><LayoutGrid size={15} /></button>
          </div>
        </div>

        {showFilters && (
          <div className="tw-filters">
            <FilterSelect label="Status" value={filters.status} onChange={v => applyFilter('status', v)} options={[{ value: '', label: 'All statuses' }, ...Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }))]} />
            <FilterSelect label="Department" value={filters.department} onChange={v => applyFilter('department', v)} options={[{ value: '', label: 'All departments' }, ...DEPARTMENTS.map(d => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) }))]} />
            <FilterSelect label="Category" value={filters.category} onChange={v => applyFilter('category', v)} options={[{ value: '', label: 'All categories' }, ...CATEGORIES.map(c => ({ value: c.value, label: c.label }))]} />
            <FilterSelect label="Priority" value={filters.priority} onChange={v => applyFilter('priority', v)} options={[{ value: '', label: 'All priorities' }, ...PRIORITIES]} />
            <label className="tw-fselect">
              <span className="tw-fkey">From date</span>
              <input type="date" value={filters.dateFrom} onChange={e => applyFilter('dateFrom', e.target.value)} />
            </label>
            <label className="tw-fselect">
              <span className="tw-fkey">To date</span>
              <input type="date" value={filters.dateTo} onChange={e => applyFilter('dateTo', e.target.value)} />
            </label>
            {hasActiveFilters && (
              <button className="tw-reset" onClick={resetFilters}>Reset <X size={13} /></button>
            )}
          </div>
        )}

        <div className="tw-tabs" role="tablist">
          {[
            { key: 'all', label: 'All' },
            { key: 'open', label: 'Open' },
            { key: 'in_progress', label: 'In Progress' },
            { key: 'resolved', label: 'Resolved' },
          ].map(tab => (
            <button key={tab.key} className={`tw-tab${activeTab === tab.key ? ' active' : ''}`} onClick={() => { setActiveTab(tab.key); }}>
              {tab.label}
              <span className="tw-tab-count">{tabCounts[tab.key]}</span>
            </button>
          ))}
        </div>

        <div className={`tw-list${view === 'grid' ? ' tw-list-grid' : ''}`}>
          {loading ? (
            <div className="tw-skeletons">
              {Array.from({ length: PER_PAGE }).map((_, i) => (
                <div key={i} className={`tw-skeleton ${view === 'grid' ? 'tw-skel-grid' : 'tw-skel-row'}`}>
                  <div className="sk" style={{ width: 38, height: 38, borderRadius: '50%' }} />
                  <div className="tw-skel-lines">
                    <div className="sk" style={{ width: '60%', height: 13 }} />
                    <div className="sk" style={{ width: '40%', height: 11 }} />
                  </div>
                  <div className="sk" style={{ width: 52, height: 20, borderRadius: 10 }} />
                  <div className="sk" style={{ width: 80, height: 20, borderRadius: 10 }} />
                </div>
              ))}
            </div>
          ) : loadError ? (
            <div className="tw-empty">
              <div className="tw-empty-icon" style={{ color: '#dc2626' }}><Circle size={28} /></div>
              <p className="tw-empty-title">Couldn't load tickets</p>
              <p className="tw-empty-sub">{loadError}</p>
              <button className="btn btn-sm" onClick={() => load()}>Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="tw-empty">
              <div className="tw-empty-icon"><Inbox size={30} /></div>
              {hasActiveFilters ? (
                <>
                  <p className="tw-empty-title">No matching tickets</p>
                  <p className="tw-empty-sub">Try adjusting your search or filters.</p>
                  <button className="btn btn-sm btn-primary" onClick={resetFilters}>Clear filters</button>
                </>
              ) : (
                <>
                  <p className="tw-empty-title">No tickets yet</p>
                  <p className="tw-empty-sub">New queue tickets raised by FRO will appear here automatically.</p>
                  <button className="btn btn-sm btn-primary" onClick={() => setShowRaise(true)}><Plus size={14} /> Raise Ticket</button>
                </>
              )}
            </div>
          ) : view === 'grid' ? (
            <div className="tw-gridcols">
              {pageItems.map(t => renderRow(t, true))}
            </div>
          ) : (
            <>
              <div className="tw-listhead">
                <label className="tw-check" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll} />
                </label>
                <span className="tw-listhead-label">Ticket</span>
                <span className="tw-listhead-hide">Priority</span>
                <span className="tw-listhead-hide">Status</span>
                <span className="tw-listhead-hide">Date</span>
                <span className="tw-listhead-actions" />
              </div>
              <div className={`tw-rows${selectedIds.length ? ' has-selection' : ''}`}>
                {pageItems.map(t => renderRow(t, false))}
              </div>
            </>
          )}
        </div>

        {!loading && !loadError && filtered.length > 0 && (
          <div className="tw-pagination">
            <span className="tw-pageinfo">
              Showing <strong>{filtered.length === 0 ? 0 : (safePage - 1) * PER_PAGE + 1}–{Math.min(safePage * PER_PAGE, filtered.length)}</strong> of <strong>{filtered.length}</strong>
            </span>
            <div className="tw-pagebtns">
              <button disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}><ChevronLeft size={14} /></button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button key={i} className={safePage === i + 1 ? 'active' : ''} onClick={() => setPage(i + 1)}>{i + 1}</button>
              ))}
              <button disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {drawer && (
        <div className="tw-drawer">
          <div className="tw-drawer-inner">
            <div className="tw-drawer-head">
              <div className="tw-drawer-title-wrap">
                <div className="tw-drawer-no">{drawer._source === 'developer' ? '#DEV' : ticketNo(drawer)}</div>
                <button className="tw-iconbtn" onClick={() => setDrawer(null)} title="Close (Esc)"><X size={16} /></button>
              </div>
              <div className="tw-drawer-requester">
                <Avatar name={drawer.workers?.name || drawer.raised_by_name} size={32} />
                <div className="tw-drawer-requester-copy">
                  <strong>{drawer.workers?.name || drawer.raised_by_name || 'Unknown'}</strong>
                  <span>{fmtDateTime(drawer.created_at)}</span>
                </div>
              </div>
              <div className="tw-drawer-pills">
                <StatusPill status={drawer.status} />
                <span className="tw-pill tw-pill-gray">{categoryLabel(drawer.category)}</span>
              </div>
            </div>

            <div className="tw-drawer-body">
              <div className="tw-drawer-subject-block">
                {drawerLoading ? (
                  <div className="tw-skeleton" style={{ flexDirection: 'column' }}>
                    <div className="sk" style={{ height: 18, width: '80%' }} />
                  </div>
                ) : (
                  <h3 className="tw-drawer-subject">{drawer.subject}</h3>
                )}
              </div>
              {(drawer.department || drawer.ngo || drawer.reference_id) && (
                <div className="tw-drawer-context">
                  {drawer.department && <span><Building2 size={12} /> {deptLabel(drawer.department)}</span>}
                  {drawer.ngo && <span>{drawer.ngo}</span>}
                  {drawer.reference_id && <span className="tw-mono">{drawer.reference_id}</span>}
                </div>
              )}

              {(statusDraft === 'resolved' || drawer.status === 'resolved') && (
                <div className="tw-resolution">
                  <span className="tw-fkey">Resolution note{statusDraft === 'resolved' ? ' (required)' : ''}</span>
                  <textarea
                    value={resolutionDraft}
                    onChange={e => setResolutionDraft(e.target.value)}
                    placeholder="Describe how this ticket was resolved…"
                    rows={3}
                    disabled={drawer.status === 'resolved' && statusDraft === 'resolved'}
                  />
                </div>
              )}

              {drawer.description && (
                <div className="tw-desc">
                  <span className="tw-fkey">Description</span>
                  <p>{drawer.description}</p>
                </div>
              )}

              <div className="tw-comments">
                <div className="tw-comments-head">
                  <span className="tw-fkey">Comments</span>
                  <span className="tw-comments-count">{drawer.replies?.length || 0}</span>
                </div>
                {!drawer.replies || drawer.replies.length === 0 ? (
                  <div className="tw-no-comments">
                    <MessageSquare size={18} />
                    <span>No comments yet.</span>
                  </div>
                ) : (
                  <div className="tw-replies">
                    {drawer.replies.map(r => (
                      <div key={r.id} className="tw-reply">
                        <Avatar name={r.sender_name} size={30} />
                        <div className="tw-reply-body">
                          <div className="tw-reply-meta">
                            <span className="tw-reply-name">{r.sender_name || (r.sender_type === 'user' ? 'Accounts' : 'FRO')}</span>
                            {r.sender_panel && <span className="tw-reply-panel">{PANEL_LABELS[r.sender_panel] || r.sender_panel}</span>}
                            <span className="tw-reply-time">{fmtDateTime(r.created_at)}</span>
                          </div>
                          <div className="tw-reply-text">{r.message}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="tw-add-comment">
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Add a comment…"
                    rows={2}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleReply(); }}
                  />
                  <button className="btn btn-sm" onClick={handleReply} disabled={sendingReply || !replyText.trim()} title="Send (Ctrl/Cmd + Enter)">
                    {sendingReply ? '…' : <Send size={14} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="tw-drawer-foot">
              <button className="btn btn-sm tw-delete-btn" onClick={() => setConfirmDelete(drawer)} disabled={drawerSaving}>
                <Trash2 size={14} /> Delete
              </button>
              <div className="tw-drawer-foot-right">
                {statusDraft !== drawer.status || priorityDraft !== drawer.priority || (statusDraft === 'resolved' && resolutionDraft.trim() !== drawer.resolution) ? (
                  <span className="tw-unsaved">Unsaved changes</span>
                ) : null}
                <div className="tw-status-control">
                  <button type="button" className="tw-status-current" onClick={saveDrawer} disabled={drawerSaving} title="Save ticket status">
                    <span>{STATUS_META[statusDraft]?.label || statusDraft}</span>
                    <CheckCircle2 size={14} />
                  </button>
                  <button type="button" className="tw-status-toggle" onClick={() => setStatusMenuOpen(open => !open)} disabled={drawerSaving} aria-label="Choose ticket status">
                    <ChevronDown size={14} className={statusMenuOpen ? 'is-open' : ''} />
                  </button>
                  {statusMenuOpen && (
                    <div className="tw-status-menu">
                      {Object.entries(STATUS_META).map(([value, meta]) => (
                        <button type="button" key={value} className={value === statusDraft ? 'active' : ''}
                          onClick={() => { setStatusDraft(value); setStatusMenuOpen(false); }}>
                          <span className="tw-status-menu-dot" style={{ background: meta.color }} />
                          {meta.label}
                          {value === statusDraft && <CheckCircle2 size={13} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRaise && (
        <div className="modal-overlay" onClick={() => setShowRaise(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-head">
              <h3>Raise a Ticket</h3>
              <button className="btn btn-sm btn-icon" onClick={() => setShowRaise(false)} style={{ padding: 4 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              {formErrors._general && (
                <div style={{ padding: '8px 12px', marginBottom: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#dc2626' }}>
                  {formErrors._general}
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                  Department *
                  <select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                  </select>
                </label>
                <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                  Category *
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#0369a1', marginTop: 4 }}>→ Routed to: {routeLabel(form.category)}</div>
                </label>
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                  Desk Number *
                  <input value={form.desk_number} onChange={e => { setForm(p => ({ ...p, desk_number: e.target.value })); if (formErrors.desk_number) setFormErrors(p => { const n = { ...p }; delete n.desk_number; return n; }); }} placeholder={deskLoading ? 'Fetching your desk...' : 'Auto-filled from your desk'} style={formErrors.desk_number ? { borderColor: '#dc2626' } : undefined} />
                  {formErrors.desk_number && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 3 }}>{formErrors.desk_number}</div>}
                </label>
                <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                  NGO
                  <input value={form.ngo} onChange={e => setForm(p => ({ ...p, ngo: e.target.value }))} placeholder={deskLoading ? 'Fetching...' : 'Auto-filled from your desk'} />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                  Priority
                  <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                    {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </label>
                <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                  Reference ID (optional)
                  <input value={form.reference_id} onChange={e => setForm(p => ({ ...p, reference_id: e.target.value }))} placeholder="Payment/suspense ID" />
                </label>
              </div>
              <label className="field" style={{ marginBottom: 12 }}>
                Subject *
                <input value={form.subject} onChange={e => { setForm(p => ({ ...p, subject: e.target.value })); if (formErrors.subject) setFormErrors(p => { const n = { ...p }; delete n.subject; return n; }); }}
                  placeholder="Brief title of the issue"
                  style={formErrors.subject ? { borderColor: '#dc2626' } : undefined} />
                {formErrors.subject && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 3 }}>{formErrors.subject}</div>}
              </label>
              <label className="field" style={{ marginBottom: 12 }}>
                Description
                <div style={{ position: 'relative' }}>
                  <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe the issue in detail..." maxLength={200} rows={4} style={{ padding: '10px 12px', paddingRight: 56, border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', width: '100%', boxSizing: 'border-box' }} />
                  <span style={{ position: 'absolute', bottom: 6, right: 8, fontSize: 10, fontWeight: 600, color: form.description.length > 180 ? '#dc2626' : 'var(--ink-soft)' }}>
                    {form.description.length}/200
                  </span>
                </div>
              </label>
            </div>
            <div className="modal-foot" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowRaise(false)}
                style={{ padding: '8px 20px', color: '#dc2626', border: '1px solid #dc2626', borderRadius: 6, background: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', transition: 'all .15s' }}
                onMouseOver={e => { e.currentTarget.style.background = '#fef2f2'; }}
                onMouseOut={e => { e.currentTarget.style.background = '#fff'; }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleRaise} disabled={submitting}
                style={{ padding: '8px 20px', fontSize: 12, borderRadius: 6 }}>
                {submitting ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-head">
              <h3>Delete ticket?</h3>
              <button className="btn btn-sm btn-icon" onClick={() => setConfirmDelete(null)} style={{ padding: 4 }}>
                <X size={15} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink)', margin: 0 }}>
                This will permanently delete <strong>{confirmDelete.subject}</strong> along with all of its comments. This action cannot be undone.
              </p>
            </div>
            <div className="modal-foot" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setConfirmDelete(null)} style={{ padding: '8px 16px', fontSize: 12 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleDelete} style={{ padding: '8px 16px', fontSize: 12, background: '#dc2626', borderColor: '#dc2626' }}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
