import { useState, useEffect, useRef } from 'react'
import { Routes, Route, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useUcs } from '../../store'
import { themes, applyTheme } from '../hr/theme'
import { getScheduled, getCallbacks } from './api/donors'
import { useRealtime } from '../../hooks/useRealtime'
import { api } from '../../api/auth'
import { requestNotifPermission, showDesktopNotification } from '../../utils/desktopNotif'
import DispositionModal from './components/DispositionModal'
import NotificationDrawer from '../../components/NotificationDrawer'
import Dashboard from './pages/Dashboard'
import MyDonors from './pages/MyDonors'
import TransferredLeads from './pages/TransferredLeads'
import Donors from './pages/Donors'
import Scheduled from './pages/Scheduled'
import IncentiveInfo from './pages/IncentiveInfo'
import History from './pages/History'
import CallLogs from './pages/CallLogs'
import MyTarget from './pages/MyTarget'

const NAV = [
  { id: 'dashboard', path: '/fro/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'scheduled', path: '/fro/scheduled', label: 'Follow Up / Callback', icon: 'calendar_month' },
  { id: 'my-leads', path: '/fro/my-leads', label: 'My Leads', icon: 'group' },
  { id: 'transferred-leads', path: '/fro/transferred-leads', label: 'Transferred', icon: 'swap_horiz' },
  { id: 'donors', path: '/fro/donors', label: 'Donors', icon: 'card_giftcard' },
  { id: 'logs', path: '/fro/logs', label: 'Call Logs', icon: 'call_log' },
  { id: 'target', path: '/fro/target', label: 'My Target', icon: 'track_changes' },
]

const MAX_DROPDOWN = 4

const currency = n => n != null ? '\u20B9' + Number(n).toLocaleString('en-IN') : '\u2014'

function Sidebar() {
  const location = useLocation()
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">U</div>
        <div><h1>UFS</h1><span>FRO Panel</span></div>
      </div>
      <nav className="sidebar-nav">
        {NAV.map(n => (
          <NavLink key={n.id} to={n.path}
            className={`snav-item ${location.pathname === n.path ? 'active' : ''}`}>
            <span className="ico material-symbols-outlined" style={{ fontSize: 18 }}>{n.icon}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export default function FROPanel() {
  const { user, logout } = useUcs()
  const location = useLocation()
  const [showMenu, setShowMenu] = useState(false)
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

  const [modalDonor, setModalDonor] = useState(null);
  const [modalNotifId, setModalNotifId] = useState(null);
  const [rows, setRows] = useState([]);
  const [refetch, setRefetch] = useState(0);
  const [showNotifList, setShowNotifList] = useState(false);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [rejectedItems, setRejectedItems] = useState([]);
  const [allNotifs, setAllNotifs] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const seenNotifIds = useRef(new Set());
  const notifRef = useRef(null);
  const pollRef = useRef(null);

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

  const handlePopDone = () => {
    if (modalNotifId) markRead(modalNotifId);
    setModalNotifId(null);
    setModalDonor(null);
    setRefetch(n => n + 1);
    loadRejectedNotifications();
    loadReminders();
  };

  const loadRejectedNotifications = () => {
    const workerId = user?.id;
    if (!workerId) return;
    api(`/notifications/${workerId}`, { _prefix: 'ucs' })
      .then(data => {
        const all = (data || []).filter(n => n.type === 'lead_rejected' && !n.read_at);
        const items = all.slice(0, 20);
        items.forEach(n => {
          if (!seenNotifIds.current.has(n.id)) {
            seenNotifIds.current.add(n.id);
            showDesktopNotification(n.title, n.body);
          }
        });
        setAllNotifs(all);
        setRejectedItems(items);
        setRejectedCount(all.length);
      })
      .catch(() => {});
  };
  useEffect(() => {
    loadRejectedNotifications();
    requestNotifPermission();
    pollRef.current = setInterval(() => loadRejectedNotifications(), 30000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [user?.id]);

  useRealtime('notification_log', {
    filter: `worker_id=eq.${user?.id}`,
    onInsert: () => loadRejectedNotifications(),
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

  const dropdownItems = [];
  const rejectedToShow = rejectedItems.slice(0, MAX_DROPDOWN);
  const dueToShow = dueItems.slice(0, MAX_DROPDOWN - rejectedToShow.length);
  const totalShown = rejectedToShow.length + dueToShow.length;
  const totalHidden = rejectedCount + dueCount - totalShown;

  const meta = NAV.find(n => location.pathname === n.path)
  const userName = user?.name || 'User'
  const initials = userName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  const drawerSections = [
    { label: 'Rejected Leads', type: 'rejected', items: allNotifs },
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
    <div className="app">
      <Sidebar />
      <div className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">FRO</div>
            <h2>{meta?.label || 'Dashboard'}</h2>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <div ref={notifRef} style={{ position:'relative' }}>
              <div onClick={() => setShowNotifList(!showNotifList)} style={{ cursor:'pointer', position:'relative', padding:6, borderRadius:8, transition:'background .15s', background: showNotifList ? '#f3f4f6' : 'transparent' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={rejectedCount + dueCount > 0 ? 'var(--sage)' : 'var(--ink-soft)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {rejectedCount + dueCount > 0 && (
                  <span style={{ position:'absolute', top:0, right:0, background:'#dc2626', color:'#fff', borderRadius:'50%', minWidth:16, height:16, fontSize:9, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, lineHeight:1, padding:'0 3px' }}>
                    {rejectedCount + dueCount > 9 ? '9+' : rejectedCount + dueCount}
                  </span>
                )}
              </div>
              {showNotifList && (
                <div style={{ position:'absolute', top:'100%', right:0, marginTop:6, background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, boxShadow:'0 8px 30px rgba(0,0,0,.12)', width:340, maxHeight:420, overflowY:'auto', zIndex:100, padding:0 }}>
                  {/* Header */}
                  <div style={{ padding:'10px 14px', borderBottom:'1px solid #f3f4f6', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:13, fontWeight:700 }}>Notifications</span>
                    <span style={{ fontSize:11, color:'var(--ink-soft)' }}>{rejectedCount + dueCount} pending</span>
                  </div>

                  {rejectedCount + dueCount === 0 && (
                    <div style={{ padding:24, fontSize:12, color:'var(--ink-soft)', textAlign:'center' }}>No pending items</div>
                  )}

                  {/* Rejected items */}
                  {rejectedToShow.map((item, i) => (
                    <div key={`rj-${item.id}`}
                      onClick={() => handleRejectedClick(item)}
                      style={{ padding:'10px 14px', borderBottom:'1px solid #f3f4f6', cursor:'pointer', fontSize:12, transition:'background .15s' }}
                      onMouseOver={e => e.currentTarget.style.background = '#fef2f2'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                        <div style={{ width:28, height:28, borderRadius:6, background:'#fef2f2', display:'flex', alignItems:'center', justifyContent:'center', color:'#dc2626', fontSize:12, flexShrink:0, marginTop:1 }}>{'\u2716'}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                            <span style={{ background:'#dc2626', color:'#fff', fontSize:9, padding:'1px 5px', borderRadius:4, fontWeight:700, lineHeight:'14px' }}>REJECTED</span>
                            <span style={{ fontWeight:600, fontSize:12 }}>{item.body?.replace(/^Your lead for /, '').replace(/ \(.*$/, '') || 'Lead'}</span>
                          </div>
                          <div style={{ color:'#6b7280', fontSize:11, lineHeight:1.3 }}>{item.body?.replace(/^.*Reason: /, '')}</div>
                          <div style={{ color:'#9ca3af', fontSize:10, marginTop:2 }}>{item.sent_at ? new Date(item.sent_at).toLocaleString('en-GB') : ''}</div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Due items */}
                  {dueToShow.map(item => (
                    <div key={`${item.id}-${item.ngo_id || ''}`}
                      onClick={() => { setShowNotifList(false); setModalDonor(item); }}
                      style={{ padding:'10px 14px', borderBottom:'1px solid #f3f4f6', cursor:'pointer', fontSize:12 }}
                      onMouseOver={e => e.currentTarget.style.background = '#f5f5f5'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                        <div style={{ width:28, height:28, borderRadius:6, background:'#f0fdf4', display:'flex', alignItems:'center', justifyContent:'center', color:'#16a34a', fontSize:12, flexShrink:0, marginTop:1 }}>{'\u23F0'}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:600, fontSize:12, marginBottom:2 }}>{item.donor_name}</div>
                          <div style={{ color:'var(--ink-soft)', fontSize:11, display:'flex', alignItems:'center', gap:4 }}>
                            <span className="material-symbols-outlined" style={{ fontSize:11 }}>schedule</span>
                            {item.scheduled_at ? new Date(item.scheduled_at).toLocaleString('en-GB') : 'Callback'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* View All link */}
                  {totalHidden > 0 && (
                    <div style={{ padding:'10px 14px', textAlign:'center', borderTop:'1px solid #f3f4f6' }}>
                      <button onClick={() => { setShowNotifList(false); setDrawerOpen(true); }}
                        style={{ background:'none', border:'none', color:'var(--sage)', cursor:'pointer', fontSize:12, fontWeight:600, padding:'4px 12px', borderRadius:6 }}>
                        View All ({totalHidden} more)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="topbar-user" ref={menuRef} onClick={() => setShowMenu(!showMenu)}>
              <div className="topbar-user-text">
                <div className="topbar-name">{userName}</div>
                <div className="topbar-role">FRO</div>
              </div>
              <div className="avatar">{initials}</div>
              {showMenu && (
                <div className="user-menu">
                  <div className="user-menu-item" style={{ cursor:'default', fontSize:13, color:'#666' }}>
                    Theme: <select value={themeName} onClick={e => e.stopPropagation()} onChange={e => setThemeName(e.target.value)}
                      style={{ marginLeft:8, border:'1px solid #ddd', borderRadius:6, padding:'2px 8px' }}>
                      {Object.keys(themes).map(k => <option key={k} value={k}>{themes[k].name}</option>)}
                    </select>
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
        </header>
        <div className="content-body">
          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="scheduled" element={<Scheduled />} />
            <Route path="my-leads" element={<MyDonors />} />
            <Route path="transferred-leads" element={<TransferredLeads />} />
            <Route path="donors" element={<Donors />} />
            <Route path="logs" element={<CallLogs />} />
            <Route path="target" element={<MyTarget />} />
            <Route path="history" element={<History />} />
            <Route path="incentive-info" element={<IncentiveInfo />} />
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
          onClose={() => { setModalNotifId(null); setModalDonor(null); }}
          onDone={handlePopDone}
        />
      )}
      <NotificationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sections={drawerSections}
        onItemClick={handleDrawerItemClick}
      />
    </div>
  )
}
