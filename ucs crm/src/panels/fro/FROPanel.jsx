import { useState, useEffect, useRef } from 'react'
import { Routes, Route, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useUcs } from '../../store'
import { themes, applyTheme } from '../hr/theme'
import { getScheduled, getCallbacks } from './api/donors'
import { getMyDashboard } from './api/donors'
import { getMyTarget } from './api/target'
import { useRealtime } from '../../hooks/useRealtime'
import { api } from '../../api/auth'
import { requestNotifPermission, showDesktopNotification } from '../../utils/desktopNotif'
import DispositionModal from './components/DispositionModal'
import CallTimer from './components/CallTimer'
import { CallProvider } from './CallContext'
import NotificationDrawer from '../../components/NotificationDrawer'
import SettingsDrawer from '../../components/SettingsDrawer'
import ToastContainer from '../../components/Toast'
import Dashboard from './pages/Dashboard'
import MyDonors from './pages/MyDonors'
import TransferredLeads from './pages/TransferredLeads'
import RejectedLeads from './pages/RejectedLeads'
import Donors from './pages/Donors'
import Scheduled from './pages/Scheduled'
import IncentiveInfo from './pages/IncentiveInfo'
import History from './pages/History'
import WhatsAppChat from './pages/WhatsAppChat'
import FroTickets from './pages/Tickets'

const NAV = [
  { id: 'dashboard', path: '/fro/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'scheduled', path: '/fro/scheduled', label: 'Follow Up / Callback', icon: 'calendar_month' },
  { id: 'my-leads', path: '/fro/my-leads', label: 'My Leads', icon: 'group' },
  { id: 'transferred-leads', path: '/fro/transferred-leads', label: 'Transferred', icon: 'swap_horiz' },
  { id: 'donors', path: '/fro/donors', label: 'Donors', icon: 'card_giftcard' },
  { id: 'rejected', path: '/fro/rejected-leads', label: 'Rejected Leads', icon: 'heart_broken' },
  { id: 'tickets', path: '/fro/tickets', label: 'Raise Ticket', icon: 'confirmation_number' },
  { id: 'whatsapp-chat', path: '/fro/whatsapp-chat', label: 'WhatsApp Chat', icon: 'chat' },
]

const MAX_DROPDOWN = 4

const currency = n => n != null ? '\u20B9' + Number(n).toLocaleString('en-IN') : '\u2014'

function callFmt(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function loadTodayStats() {
  try {
    const raw = localStorage.getItem('fro_call_stats');
    if (!raw) return null;
    const data = JSON.parse(raw);
    const today = new Date().toISOString().slice(0, 10);
    if (data.date !== today) return null;
    return data;
  } catch { return null; }
}

function Sidebar({ open, onClose }) {
  const location = useLocation()
  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">U</div>
          <div><h1>UFS</h1><span>FRO Panel</span></div>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(n => (
            <NavLink key={n.id} to={n.path}
              className={`snav-item ${location.pathname === n.path ? 'active' : ''}`}
              onClick={() => onClose?.()}>
            <span className="ico material-symbols-outlined" style={{ fontSize: 18 }}>{n.icon}</span>
            <span>{n.label}</span>
          </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}

export default function FROPanel() {
  const { user, logout } = useUcs()
  const location = useLocation()
  const [showMenu, setShowMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [themeName, setThemeName] = useState(() => localStorage.getItem('fro_theme') || 'sky')
  const menuRef = useRef(null)

  useEffect(() => {
    if (themes[themeName]) {
      applyTheme(themes[themeName], '.panel-fro')
      const t = themes[themeName]
      const el = document.querySelector('.panel-fro') || document.documentElement
      el.style.setProperty('--bg', t.sand); el.style.setProperty('--card-bg', t.paper); el.style.setProperty('--sage-light', t['sage-soft'])
    }
    localStorage.setItem('fro_theme', themeName)
  }, [themeName])

  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  const [modalDonor, setModalDonor] = useState(null);
  const [modalNotifId, setModalNotifId] = useState(null);
  const [rows, setRows] = useState([]);
  const [refetch, setRefetch] = useState(0);
  const [showNotifList, setShowNotifList] = useState(false);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [rejectedItems, setRejectedItems] = useState([]);
  const [verifiedItems, setVerifiedItems] = useState([]);
  const [allNotifs, setAllNotifs] = useState([]);
  const [allVerified, setAllVerified] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [showTarget, setShowTarget] = useState(false);
  const seenNotifIds = useRef(new Set(JSON.parse(localStorage.getItem('fro_seen_notifs') || '[]')));
  const notifRef = useRef(null);
  const pollRef = useRef(null);
  const poppedIds = useRef(new Set());
  const [autoPopTick, setAutoPopTick] = useState(0);

  const markRead = async (notifId) => {
    try { await api(`/notifications/${notifId}/read`, { method: 'PUT', _prefix: 'ucs' }); }
    catch {}
  };

  const handleRejectedClick = async (item) => {
    setShowNotifList(false);
    if (item.fro_donor_log_id) {
      try {
        const info = await api(`/notifications/${item.id}/lead-info`, { _prefix: 'ucs' });
        setModalNotifId(item.id);
        setModalDonor({
          id: info.donorId,
          ngo_id: info.ngoId,
          assignment_id: info.assignmentId,
          donor_name: info.donorName,
          donor_mobile: info.donorMobile,
        });
      } catch { return; }
    }
  };

  const handlePopDone = async () => {
    if (modalDonor?.id) poppedIds.current.add(modalDonor.id);
    if (modalNotifId) await markRead(modalNotifId);
    setModalNotifId(null);
    setModalDonor(null);
    setRefetch(n => n + 1);
    loadNotifications();
    loadReminders();
  };

  const loadNotifications = () => {
    const workerId = user?.id;
    if (!workerId) return;
    api(`/notifications/${workerId}`, { _prefix: 'ucs' })
      .then(data => {
        const allNotifs = data || [];
        const rejected = allNotifs.filter(n => n.type === 'lead_rejected' && !n.read_at);
        const verified = allNotifs.filter(n => n.type === 'lead_verified' && !n.read_at);
        const rejectedSlice = rejected.slice(0, 20);
        const verifiedSlice = verified.slice(0, 20);
        rejectedSlice.forEach(n => {
          if (!seenNotifIds.current.has(n.id)) {
            seenNotifIds.current.add(n.id);
            localStorage.setItem('fro_seen_notifs', JSON.stringify([...seenNotifIds.current]));
            showDesktopNotification(n.title, n.body);
          }
        });
        verifiedSlice.forEach(n => {
          if (!seenNotifIds.current.has(n.id)) {
            seenNotifIds.current.add(n.id);
            localStorage.setItem('fro_seen_notifs', JSON.stringify([...seenNotifIds.current]));
            showDesktopNotification(n.title, n.body);
          }
        });
        setAllNotifs(rejected);
        setAllVerified(verified);
        setRejectedItems(rejectedSlice);
        setVerifiedItems(verifiedSlice);
        setRejectedCount(rejected.length);
        setVerifiedCount(verified.length);
      })
      .catch(() => {});
  };
  useEffect(() => {
    loadNotifications();
    requestNotifPermission();
    pollRef.current = setInterval(() => loadNotifications(), 30000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [user?.id]);

  useRealtime('notification_log', {
    filter: `worker_id=eq.${user?.id}`,
    onInsert: () => loadNotifications(),
    enabled: !!user?.id,
  });

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false)
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifList(false)
    }
    if (showMenu || showNotifList) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMenu, showNotifList])

  const loadReminders = () => {
    Promise.all([getScheduled(), getCallbacks()]).then(([scheduled, callbacks]) => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const items = []; const seen = new Set();
      (scheduled || []).forEach(d => {
        if (d.scheduled_at && d.scheduled_at.slice(0, 10) !== todayStr && !seen.has(d.id)) {
          seen.add(d.id); items.push({ id: d.id, ngo_id: d.ngo_id, donor_name: d.donor_name, donor_mobile: d.donor_mobile, scheduled_at: d.scheduled_at, assignment_id: d.assignment_id, type: 'scheduled' });
        }
      });
      (callbacks || []).forEach(d => { if (!seen.has(d.id)) { seen.add(d.id); items.push({ id: d.id, ngo_id: d.ngo_id, donor_name: d.donor_name, donor_mobile: d.donor_mobile, scheduled_at: d.scheduled_at || null, assignment_id: d.assignment_id, type: 'callback' }); } });
      (scheduled || []).forEach(d => {
        if (d.scheduled_at && d.scheduled_at.slice(0, 10) === todayStr && !seen.has(d.id)) {
          seen.add(d.id); items.push({ id: d.id, ngo_id: d.ngo_id, donor_name: d.donor_name, donor_mobile: d.donor_mobile, scheduled_at: d.scheduled_at, assignment_id: d.assignment_id, type: 'callback' });
        }
      });
      setRows(items);
    }).catch(() => {});
  };
  useEffect(() => { loadReminders(); }, [refetch]);
  useEffect(() => { const interval = setInterval(() => loadReminders(), 30000); return () => clearInterval(interval); }, []);

  const dedupedRows = rows.filter((r, i, a) => i === a.findIndex(x => x.id === r.id));
  const dueItems = dedupedRows.filter(r => r.scheduled_at && new Date(r.scheduled_at) <= new Date());
  const dueCount = dueItems.length;

  useEffect(() => { const i = setInterval(() => setAutoPopTick(t => t + 1), 5000); return () => clearInterval(i); }, []);

  useEffect(() => {
    if (modalDonor) return;
    const due = dueItems.filter(r => !poppedIds.current.has(r.id))
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
    if (due.length > 0) {
      poppedIds.current.add(due[0].id);
      setModalDonor(due[0]);
    }
  }, [autoPopTick, dueItems, modalDonor]);

  const rejectedToShow = rejectedItems.slice(0, MAX_DROPDOWN);
  const verifiedToShow = verifiedItems.slice(0, MAX_DROPDOWN - rejectedToShow.length);
  const dueToShow = dueItems.slice(0, MAX_DROPDOWN - rejectedToShow.length - verifiedToShow.length);
  const totalShown = rejectedToShow.length + verifiedToShow.length + dueToShow.length;
  const totalHidden = rejectedCount + verifiedCount + dueCount - totalShown;

  const meta = NAV.find(n => location.pathname === n.path)
  const userName = user?.name || 'User'
  const initials = userName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  const drawerSections = [
    { label: 'Rejected Leads', type: 'rejected', items: allNotifs },
    { label: 'Verified Leads', type: 'verified', items: allVerified },
    { label: 'Follow Up / Callback', type: 'schedule', items: dueItems },
  ];

  const handleDrawerItemClick = (item, section) => {
    setDrawerOpen(false);
    if (section.type === 'rejected') {
      handleRejectedClick(item);
    } else {
      setModalDonor(item);
    }
  };

  return (
    <CallProvider userId={user?.id}>
    <div className="app">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main">
        <header className="topbar">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            </button>
            <div>
            <div className="eyebrow">FRO</div>
            <h2>{meta?.label || 'Dashboard'}</h2>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <CallTimer />
            <div ref={notifRef} style={{ position:'relative' }}>
              <div onClick={() => setDrawerOpen(true)} style={{ cursor:'pointer', position:'relative', padding:6, borderRadius:8, transition:'background .15s' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={rejectedCount + verifiedCount + dueCount > 0 ? 'var(--sage)' : 'var(--ink-soft)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={rejectedCount + verifiedCount + dueCount > 0 ? 'bell-ring' : ''}>
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {rejectedCount + verifiedCount + dueCount > 0 && (
                  <span style={{ position:'absolute', top:0, right:0, background:'#dc2626', color:'#fff', borderRadius:'50%', minWidth:16, height:16, fontSize:9, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, lineHeight:1, padding:'0 3px' }}>
                    {rejectedCount + verifiedCount + dueCount > 9 ? '9+' : rejectedCount + verifiedCount + dueCount}
                  </span>
                )}
              </div>
            </div>
            <div style={{ position:'relative' }}>
              <div onClick={async () => { setShowStats(true); setShowTarget(false); setStatsLoading(true); try { const [d, t] = await Promise.all([getMyDashboard().catch(() => null), getMyTarget().catch(() => null)]); setStatsData({ dash: d, target: t }); } catch {} finally { setStatsLoading(false); } }} style={{ cursor:'pointer', padding:6, borderRadius:8, transition:'background .15s' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
            </div>
            <div className="topbar-user" ref={menuRef} onClick={() => setShowMenu(!showMenu)}>
              <div className="avatar">{initials}</div>
              {showMenu && (
                <div className="user-menu">
                  <div className="user-menu-item" style={{flexDirection:'column', alignItems:'flex-start', gap:2, cursor:'default'}}>
                    <div style={{fontWeight:600, fontSize:13}}>{userName}</div>
                    <div style={{fontSize:11, color:'var(--ink-soft)'}}>FRO</div>
                  </div>
                  <div className="user-menu-divider" />
                  <div className="user-menu-item" onClick={() => { setShowMenu(false); setShowSettings(true); }} style={{cursor:'pointer'}}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    Settings
                  </div>
                  <div className="user-menu-divider" />
                  <button className="user-menu-item" onClick={() => { setShowMenu(false); logout() }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
          <SettingsDrawer
            open={showSettings}
            onClose={() => setShowSettings(false)}
            themes={themes}
            themeName={themeName}
             onThemeChange={(key) => setThemeName(key)}
          />
        </header>
        {showStats && (
            <div className="modal-overlay" onClick={() => setShowStats(false)}>
              <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card-bg)' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{showTarget ? 'Monthly Target' : "Today's Activity"}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 1 }}>{showTarget ? 'Your collection progress' : 'Your calling stats for today'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {showTarget && <button className="btn btn-sm" onClick={() => setShowTarget(false)} style={{ fontSize: 11, padding: '4px 10px' }}>← Stats</button>}
                    {!showTarget && <button className="btn btn-sm" onClick={() => setShowTarget(true)} style={{ fontSize: 11, padding: '4px 10px' }}>Target →</button>}
                    <button className="btn btn-sm btn-icon" onClick={() => setShowStats(false)} style={{ padding: 4 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                </div>

                <div style={{ padding: '20px 22px', background: 'var(--bg)' }}>
                  {!showTarget ? (() => {
                    const ts = loadTodayStats();
                    const totalProd = (ts?.totalSeconds || 0) + (ts?.idleSeconds || 0);
                    if (!ts || (ts.calls === 0 && ts.skippedDonors === 0 && ts.breakSeconds === 0 && ts.idleSeconds === 0)) {
                      return (
                        <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)' }}>
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="1.5" opacity=".4"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 12 }}>No activity yet today</div>
                          <div style={{ fontSize: 12, color: 'var(--ink-soft)', opacity: .6, marginTop: 4 }}>Start calling to see your stats here</div>
                        </div>
                      );
                    }
                    const pct = Math.round((ts.totalSeconds / (totalProd || 1)) * 100);
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                          <div style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)', padding: '16px 18px', boxShadow: 'var(--shadow)' }}>
                            <div style={{ fontSize: 28, fontWeight: 800, color: '#16a34a', lineHeight: 1.1 }}>{ts.calls}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>Calls</div>
                          </div>
                          <div style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)', padding: '16px 18px', boxShadow: 'var(--shadow)' }}>
                            <div style={{ fontSize: 28, fontWeight: 800, color: '#16a34a', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{callFmt(ts.totalSeconds)}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>Talk Time</div>
                          </div>
                          <div style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)', padding: '16px 18px', boxShadow: 'var(--shadow)' }}>
                            <div style={{ fontSize: 28, fontWeight: 800, color: '#16a34a', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{callFmt(Math.round(ts.totalSeconds / (ts.calls || 1)))}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>Avg Call</div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ fontSize: 22, fontWeight: 700, color: '#d97706' }}>{ts.skippedDonors}</div>
                              <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 1 }}>Skipped</div>
                            </div>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" opacity=".5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          </div>
                          <div style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ fontSize: 22, fontWeight: 700, color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>{callFmt(ts.idleSeconds)}</div>
                              <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 1 }}>Idle</div>
                            </div>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" opacity=".5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          </div>
                        </div>

                        <div style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: ts.breakSeconds > 3600 ? '#fef2f2' : '#fefce8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ts.breakSeconds > 3600 ? '#ef4444' : '#d97706', fontSize: 18 }}>☕</div>
                            <div>
                              <div style={{ fontSize: 20, fontWeight: 700, color: ts.breakSeconds > 3600 ? '#ef4444' : '#d97706', fontVariantNumeric: 'tabular-nums' }}>{callFmt(ts.breakSeconds)}</div>
                              <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 1 }}>{ts.breakCount || 0} breaks</div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 20, fontWeight: 700, color: pct > 50 ? '#16a34a' : '#d97706' }}>{pct}%</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 1 }}>Productivity</div>
                          </div>
                        </div>
                      </div>
                    );
                  })() : (
                    statsLoading ? (
                      <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Loading...</div>
                      </div>
                    ) : statsData?.target ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                          <div style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)', padding: '16px 18px', boxShadow: 'var(--shadow)', textAlign: 'center' }}>
                            <div style={{ fontSize: 22, fontWeight: 700, color: '#8b5cf6' }}>{'\u20B9' + Number(statsData.target.target || 0).toLocaleString('en-IN')}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>Target</div>
                          </div>
                          <div style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)', padding: '16px 18px', boxShadow: 'var(--shadow)', textAlign: 'center' }}>
                            <div style={{ fontSize: 22, fontWeight: 700, color: '#16a34a' }}>{'\u20B9' + Number(statsData.target.collected || 0).toLocaleString('en-IN')}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>Collected</div>
                          </div>
                          <div style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)', padding: '16px 18px', boxShadow: 'var(--shadow)', textAlign: 'center' }}>
                            <div style={{ fontSize: 22, fontWeight: 700, color: '#ef4444' }}>{'\u20B9' + Math.max(0, (statsData.target.target || 0) - (statsData.target.collected || 0)).toLocaleString('en-IN')}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>Remaining</div>
                          </div>
                        </div>

                        {statsData.target.target > 0 && (
                          <div style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', boxShadow: 'var(--shadow)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-soft)', marginBottom: 6 }}>
                              <span>Progress</span>
                              <span>{Math.min(100, Math.round(((statsData.target.collected || 0) / statsData.target.target) * 100))}%</span>
                            </div>
                            <div style={{ height: 6, borderRadius: 3, background: 'var(--bg)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', borderRadius: 3, width: Math.min(100, ((statsData.target.collected || 0) / statsData.target.target) * 100) + '%', background: 'linear-gradient(90deg, #8b5cf6, #16a34a)', transition: 'width .5s ease' }} />
                            </div>
                          </div>
                        )}

                        {statsData.dash && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {[
                              { label: 'Connected (M)', value: statsData.dash.monthly_connected, color: '#3b82f6' },
                              { label: 'Connected (D)', value: statsData.dash.daily_connected, color: '#8b5cf6' },
                              { label: 'Verified', value: '\u20B9' + Number(statsData.dash.verified_month_amount || 0).toLocaleString('en-IN'), color: '#16a34a' },
                              { label: 'Unverified', value: '\u20B9' + Number(statsData.dash.unverified_month_amount || 0).toLocaleString('en-IN'), color: '#ef4444' },
                              { label: 'Active Donors', value: statsData.dash.active_donors || 0, color: '#5B6B4E' },
                              { label: 'Total', value: '\u20B9' + Number(statsData.dash.total_donations || 0).toLocaleString('en-IN'), color: '#B5603A' },
                            ].map(s => (
                              <div key={s.label} style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', boxShadow: 'var(--shadow)' }}>
                                <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                                <div style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 1 }}>{s.label}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>No target data available</div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        <div className="content-body" style={{ marginRight: drawerOpen ? 320 : 0, transition: 'margin-right .25s ease' }}>
          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="scheduled" element={<Scheduled />} />
            <Route path="my-leads" element={<MyDonors />} />
            <Route path="transferred-leads" element={<TransferredLeads />} />
            <Route path="rejected-leads" element={<RejectedLeads />} />
            <Route path="donors" element={<Donors />} />
            <Route path="history" element={<History />} />
            <Route path="incentive-info" element={<IncentiveInfo />} />
            <Route path="tickets" element={<FroTickets />} />
            <Route path="whatsapp-chat" element={<WhatsAppChat />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </div>
      </div>
      {modalDonor && (
        <DispositionModal
          donorId={modalDonor.id}
          ngoId={modalDonor.ngo_id}
          donorName={modalDonor.donor_name}
          donorMobile={modalDonor.donor_mobile}
          scheduledAt={modalDonor.scheduled_at}
          onClose={() => { setModalNotifId(null); setModalDonor(null); poppedIds.current.clear(); }}
          onDone={handlePopDone}
        />
      )}
      <NotificationDrawer topOffset={56}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sections={drawerSections}
        onItemClick={handleDrawerItemClick}
      />
      <ToastContainer />
    </div>
    </CallProvider>
  )
}
