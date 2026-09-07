import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { useUcs } from '../../store';
import { SimProvider, useSim } from './store';
import { Icon } from './components';
import ToastContainer from '../../components/Toast';
import { SimFormModal, SimViewModal, ReplaceModal } from './modals';
import { deleteSimCard } from './api';
import { deptLabel } from '../../lib/labels';
import { toast } from '../../components/Toast';
import { exportToCSV, exportToExcel } from './helpers';
import './simCard.css';

import Dashboard from './Dashboard';
import Inventory from './Inventory';
import Expiring from './Expiring';
import Replacements from './Replacements';
import History from './History';
import Reports from './Reports';
import ImportExport from './ImportExport';
import Settings from './Settings';

const NAV = [
  { id: 'dashboard', path: '/sim/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'inventory', path: '/sim/inventory', label: 'All SIM Cards', icon: 'simcard' },
  { id: 'inventory', path: '/sim/cards', label: 'SIM Inventory', icon: 'inventory' },
  { id: 'expiring', path: '/sim/expiring', label: 'Expiring SIMs', icon: 'clock' },
  { id: 'replacements', path: '/sim/replacements', label: 'SIM Replacements', icon: 'replace' },
  { id: 'history', path: '/sim/history', label: 'Replacement History', icon: 'history' },
  { id: 'reports', path: '/sim/reports', label: 'SIM Reports', icon: 'report' },
  { id: 'importexport', path: '/sim/import', label: 'Import / Export', icon: 'import' },
  { id: 'settings', path: '/sim/settings', label: 'Settings', icon: 'settings' },
];

const PAGE_META = {
  '/sim/dashboard': ['SIM Management', 'SIM Card Management', 'Manage SIM cards, devices, expiry dates and replacement records.'],
  '/sim/inventory': ['SIM Management', 'All SIM Cards', 'Complete list of every registered SIM card.'],
  '/sim/cards': ['SIM Management', 'SIM Inventory', 'SIM slots, details and device information.'],
  '/sim/expiring': ['SIM Management', 'Expiring SIMs', 'SIMs nearing or past their auto-expiry date.'],
  '/sim/replacements': ['SIM Management', 'SIM Replacements', 'Initiate and track SIM replacement.'],
  '/sim/history': ['SIM Management', 'Replacement History', 'Full audit trail of SIM replacements.'],
  '/sim/reports': ['SIM Management', 'SIM Reports', 'Expiry and inventory analytics.'],
  '/sim/import': ['SIM Management', 'Import / Export', 'Import SIM data from Excel or export to Excel/CSV.'],
  '/sim/settings': ['SIM Management', 'Settings', 'Configure SIM panel defaults.'],
};

function PanelInner() {
  const { user, logout } = useUcs();
  const sim = useSim();
  const location = useLocation();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewCard, setViewCard] = useState(null);
  const [replaceCard, setReplaceCard] = useState(null);

  useEffect(() => { sim.refresh(); /* eslint-disable-next-line */ }, []);

  const meta = PAGE_META[location.pathname] || PAGE_META['/sim/dashboard'];
  const initials = (user?.name || user?.login_id || 'U').toString().split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  function openAdd() { setEditing(null); setFormOpen(true); }
  function openEdit(c) { setEditing(c); setFormOpen(true); }

  async function doDelete(c) {
    try { await deleteSimCard(c.id); sim.refresh(); toast('SIM card deleted', 'success'); }
    catch (e) { toast(e.message || 'Delete failed', 'error'); }
  }

  function handleSaved() {
    setFormOpen(false); setEditing(null); sim.refresh();
  }

  return (
    <div className="sim-app">
      <ToastContainer />
      <div className="sim-shell">
        <aside className="sim-sidebar">
          <div className="sim-brand">
            <div className="mark">SIM</div>
            <div><h1>SIM Card</h1><span>Management System</span></div>
          </div>
          <div className="sim-side-label">SIM Management</div>
          <nav className="sim-nav">
            {NAV.map((n) => (
              <NavLink key={n.id + n.path} to={n.path} className={({ isActive }) => isActive ? 'active' : ''}>
                <Icon name={n.icon} size={16} /> <span>{n.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="sim-sidebar-footer">
            <div className="u">
              <div className="sim-avatar">{initials}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || user?.login_id}</div>
                <div style={{ fontSize: 11, opacity: .7 }}>{deptLabel(user?.department) || user?.role}</div>
              </div>
            </div>
            <button className="logout-btn" onClick={logout}>Sign out</button>
          </div>
        </aside>

        <div className="sim-main">
          <header className="sim-topbar">
            <div>
              <div className="eyebrow">{meta[0]}</div>
              <h2>{meta[1]}</h2>
              <p>{meta[2]}</p>
            </div>
            <div className="sim-actions">
              <button className="sim-btn" onClick={() => exportToCSV(sim.cards)}>Export CSV</button>
              <button className="sim-btn" onClick={() => exportToExcel(sim.cards)}>Export</button>
              <button className="sim-btn primary" onClick={openAdd}>+ Add SIM Card</button>
            </div>
          </header>

          <div className="sim-content">
            <Routes>
              <Route index element={<Dashboard onAdd={openAdd} onView={setViewCard} onEdit={openEdit} onReplace={setReplaceCard} />} />
              <Route path="dashboard" element={<Dashboard onAdd={openAdd} onView={setViewCard} onEdit={openEdit} onReplace={setReplaceCard} />} />
              <Route path="inventory" element={<Inventory onAdd={openAdd} onView={setViewCard} onEdit={openEdit} onReplace={setReplaceCard} onDelete={doDelete} />} />
              <Route path="cards" element={<Inventory onAdd={openAdd} onView={setViewCard} onEdit={openEdit} onReplace={setReplaceCard} onDelete={doDelete} />} />
              <Route path="expiring" element={<Expiring onView={setViewCard} onEdit={openEdit} onReplace={setReplaceCard} onAdd={openAdd} />} />
              <Route path="expiring/:tab" element={<Expiring onView={setViewCard} onEdit={openEdit} onReplace={setReplaceCard} onAdd={openAdd} />} />
              <Route path="replacements" element={<Replacements onRefresh={sim.refresh} />} />
              <Route path="history" element={<History />} />
              <Route path="reports" element={<Reports />} />
              <Route path="import" element={<ImportExport />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/sim/dashboard" replace />} />
            </Routes>
          </div>
        </div>
      </div>

      <SimFormModal open={formOpen} card={editing} onClose={() => { setFormOpen(false); setEditing(null); }} onSaved={handleSaved} />
      <SimViewModal card={viewCard} open={!!viewCard} onClose={() => setViewCard(null)} onEdit={() => { if (viewCard) openEdit(viewCard); }} onReplace={() => { if (viewCard) { setReplaceCard(viewCard); setViewCard(null); } }} />
      <ReplaceModal card={replaceCard} open={!!replaceCard} onClose={() => setReplaceCard(null)} onDone={() => sim.refresh()} />
    </div>
  );
}

export default function SimCardPanel() {
  return (
    <SimProvider>
      <PanelInner />
    </SimProvider>
  );
}
