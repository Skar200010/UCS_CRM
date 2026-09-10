import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { BnfBaseProvider } from './bnfUi'
import Overview from './pages/Overview'
import AllBeneficiaries from './pages/AllBeneficiaries'
import NewRegistration from './pages/NewRegistration'
import BeneficiaryProfile from './pages/BeneficiaryProfile'
import Programs from './pages/Programs'
import ProgramForm from './pages/ProgramForm'
import ProgramDetail from './pages/ProgramDetail'
import Benefits from './pages/Benefits'
import Distribution from './pages/Distribution'
import VolunteersPage from './pages/Volunteers'
import CardsIdentification from './pages/CardsIdentification'
import Biometric from './pages/Biometric'
import Imports from './pages/Imports'
import Reports from './pages/Reports'

const NAV_ITEMS = [
  { key: 'overview', path: '', label: 'Overview', icon: '📊', end: true },
  { key: 'all', path: '/all', label: 'All Beneficiaries', icon: '👥' },
  { key: 'new', path: '/new', label: 'New Registration', icon: '➕' },
  { key: 'programs', path: '/programs', label: 'Programs', icon: '📅' },
  { key: 'benefits', path: '/benefits', label: 'Benefits', icon: '🎁' },
  { key: 'distribution', path: '/distribution', label: 'Distribution', icon: '📦' },
  { key: 'volunteers', path: '/volunteers', label: 'Volunteers', icon: '🤝' },
  { key: 'cards', path: '/cards', label: 'Cards & ID', icon: '💳' },
  { key: 'biometric', path: '/biometric', label: 'Biometric', icon: '👆' },
  { key: 'imports', path: '/imports', label: 'Imports', icon: '📥' },
  { key: 'reports', path: '/reports', label: 'Reports', icon: '📈' },
]

function SubNav({ base }) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '6px',
      background: 'var(--card-bg)', border: '1px solid var(--line)',
      borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
      padding: '10px 12px',
    }}>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.key}
          to={base + item.path}
          end={item.end}
          style={({ isActive }) => ({
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: 'var(--radius-sm)',
            fontSize: '12.5px', fontWeight: 500, textDecoration: 'none',
            whiteSpace: 'nowrap', transition: 'background .12s, color .12s',
            color: isActive ? 'var(--sage)' : 'var(--ink-soft)',
            background: isActive ? 'var(--sage-light)' : 'transparent',
          })}
        >
          <span style={{ fontSize: '13px', lineHeight: '1' }}>{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </div>
  )
}

export default function BeneficiariesPanel({ base = '/beneficiaries' }) {
  return (
    <BnfBaseProvider value={base}>
      <div style={{ padding: '2px 0 60px' }}>
        <SubNav base={base} />
        <div style={{ marginTop: '20px' }}>
          <Routes>
            <Route index element={<Overview />} />
            <Route path="all" element={<AllBeneficiaries />} />
            <Route path="new" element={<NewRegistration />} />
            <Route path="programs" element={<Programs />} />
            <Route path="programs/new" element={<ProgramForm />} />
            <Route path="programs/:id" element={<ProgramDetail />} />
            <Route path="benefits" element={<Benefits />} />
            <Route path="distribution" element={<Distribution />} />
            <Route path="volunteers" element={<VolunteersPage />} />
            <Route path="cards" element={<CardsIdentification />} />
            <Route path="biometric" element={<Biometric />} />
            <Route path="imports" element={<Imports />} />
            <Route path="reports" element={<Reports />} />
            <Route path=":id" element={<BeneficiaryProfile />} />
            <Route path="*" element={<Navigate to={base} replace />} />
          </Routes>
        </div>
      </div>
    </BnfBaseProvider>
  )
}