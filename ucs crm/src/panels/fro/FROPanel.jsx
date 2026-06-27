import { useState, useEffect, useRef } from 'react'
import { useUcs } from '../../store'
import { themes, applyTheme } from '../hr/theme'
import { getScheduled, getCallbacks } from './api/donors'
import DispositionModal from './components/DispositionModal'
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
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'scheduled', label: 'Follow Up / Callback', icon: 'calendar_month' },
  { id: 'my-leads', label: 'My Leads', icon: 'group' },
  { id: 'transferred-leads', label: 'Transferred', icon: 'swap_horiz' },
  { id: 'donors', label: 'Donors', icon: 'card_giftcard' },
  { id: 'logs', label: 'Call Logs', icon: 'call_log' },
  { id: 'target', label: 'My Target', icon: 'track_changes' },
  // { id: 'history', label: 'History', icon: 'history' },
  // { id: 'incentive-info', label: 'Incentive Info', icon: 'emoji_events' },
]

function Sidebar({ active, setActive }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">U</div>
        <div><h1>UFS</h1><span>FRO Panel</span></div>
      </div>
      <nav className="sidebar-nav">
        {NAV.map(n => (
          <button key={n.id}
            className={`snav-item ${active === n.id ? 'active' : ''}`}
            onClick={() => setActive(n.id)}>
            <span className="ico material-symbols-outlined" style={{ fontSize: 18 }}>{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}

export default function FROPanel() {
  const { user, logout } = useUcs()
  const [active, setActive] = useState('dashboard')
  const [showMenu, setShowMenu] = useState(false)
  const [themeName, setThemeName] = useState(() => localStorage.getItem('fro_theme') || 'sky')
  const menuRef = useRef(null)
  const meta = NAV.find(n => n.id === active)

  useEffect(() => {
    if (themes[themeName]) {
      applyTheme(themes[themeName], '.panel-fro')
      const t = themes[themeName]
      const el = document.querySelector('.panel-fro') || document.documentElement
      el.style.setProperty('--bg', t.sand)
      el.style.setProperty('--card-bg', t.paper)
      el.style.setProperty('--sage-light', t['sage-soft'])
    }
    localStorage.setItem('fro_theme', themeName)
  }, [themeName])

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false)
    }
    if (showMenu) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMenu])

  // Global schedule/callback reminder popup
  const [modalDonor, setModalDonor] = useState(null);
  const [rows, setRows] = useState([]);
  const [refetch, setRefetch] = useState(0);
  const [pollTick, setPollTick] = useState(0);
  const poppedIds = useRef(new Set());
  const autoPoppedId = useRef(null);

  const loadReminders = () => {
    Promise.all([getScheduled(), getCallbacks()]).then(([scheduled, callbacks]) => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const items = [];
      (scheduled || []).forEach(d => {
        items.push({ id: d.id, ngo_id: d.ngo_id, donor_name: d.donor_name, donor_mobile: d.donor_mobile, scheduled_at: d.scheduled_at, assignment_id: d.assignment_id, type: 'scheduled' });
      });
      (callbacks || []).forEach(d => {
        items.push({ id: d.id, ngo_id: d.ngo_id, donor_name: d.donor_name, donor_mobile: d.donor_mobile, scheduled_at: d.scheduled_at || null, assignment_id: d.assignment_id, type: 'callback' });
      });
      (scheduled || []).forEach(d => {
        if (d.scheduled_at && d.scheduled_at.slice(0, 10) === todayStr) {
          items.push({ id: d.id, ngo_id: d.ngo_id, donor_name: d.donor_name, donor_mobile: d.donor_mobile, scheduled_at: d.scheduled_at, assignment_id: d.assignment_id, type: 'callback' });
        }
      });
      setRows(items);
    }).catch(() => {});
  };

  useEffect(() => { loadReminders(); }, [refetch]);

  useEffect(() => {
    const interval = setInterval(() => setPollTick(t => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (modalDonor) return;
    const due = rows
      .filter(r => r.scheduled_at && new Date(r.scheduled_at) <= new Date() && !poppedIds.current.has(r.id))
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
    if (due.length > 0) {
      const next = due[0];
      poppedIds.current.add(next.id);
      autoPoppedId.current = next.id;
      setModalDonor(next);
    }
  }, [pollTick, rows, modalDonor]);

  const handlePopDone = () => {
    autoPoppedId.current = null;
    setModalDonor(null);
    setRefetch(n => n + 1);
  };

  const userName = user?.name || 'User'
  const initials = userName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="app">
      <Sidebar active={active} setActive={setActive} />
      <div className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">FRO</div>
            <h2>{meta?.label || 'Dashboard'}</h2>
          </div>
          <div className="topbar-user" ref={menuRef} onClick={() => setShowMenu(!showMenu)}>
            <div className="topbar-user-text">
              <div className="topbar-name">{userName}</div>
              <div className="topbar-role">FRO</div>
            </div>
            <div className="avatar">{initials}</div>
            {showMenu && (
              <div className="user-menu">
                <div className="user-menu-item" style={{ cursor: 'default', fontSize: 13, color: '#666' }}>
                  Theme:
                  <select value={themeName} onClick={e => e.stopPropagation()} onChange={e => setThemeName(e.target.value)}
                    style={{ marginLeft: 8, border: '1px solid #ddd', borderRadius: 6, padding: '2px 8px' }}>
                    {Object.keys(themes).map(k => <option key={k} value={k}>{themes[k].name}</option>)}
                  </select>
                </div>
                <div className="user-menu-divider" />
                <button className="user-menu-item" onClick={() => { setShowMenu(false); logout() }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>
        <div className="content-body">
          {active === 'dashboard' ? (
            <Dashboard />
          ) : active === 'scheduled' ? (
            <Scheduled />
          ) : active === 'my-leads' ? (
            <MyDonors />
          ) : active === 'transferred-leads' ? (
            <TransferredLeads />
          ) : active === 'donors' ? (
            <Donors />
          ) : active === 'logs' ? (
            <CallLogs />
          ) : active === 'target' ? (
            <MyTarget />
          ) : active === 'history' ? (
            <History />
          ) : active === 'incentive-info' ? (
            <IncentiveInfo />
          ) : (
            <Dashboard />
          )}
        </div>
      </div>
      {modalDonor && (
        <DispositionModal
          donorId={modalDonor.id}
          ngoId={modalDonor.ngo_id}
          donorName={modalDonor.donor_name}
          scheduledAt={modalDonor.scheduled_at}
          onClose={() => {
            if (autoPoppedId.current !== null) poppedIds.current.delete(autoPoppedId.current);
            autoPoppedId.current = null;
            setModalDonor(null);
            setPollTick(t => t + 1);
          }}
          onDone={handlePopDone}
        />
      )}
    </div>
  )
}
