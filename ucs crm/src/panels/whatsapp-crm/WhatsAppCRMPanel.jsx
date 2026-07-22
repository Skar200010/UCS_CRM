import { useState } from 'react'
import AdminSidebar from './components/AdminSidebar'
import AdminDashboardPage from './pages/AdminDashboardPage'
import AdminContactsPage from './pages/AdminContactsPage'
import AdminTemplatesPage from './pages/AdminTemplatesPage'
import AdminSettingsPage from './pages/AdminSettingsPage'

export default function WhatsAppCRMPanel({ user, onLogout, inboxComponent: InboxComponent }) {
  const [page, setPage] = useState('inbox')

  const renderPage = () => {
    switch (page) {
      case 'inbox':
        return <InboxComponent waUser={user} onLogout={onLogout} compact />
      case 'dashboard':
        return <AdminDashboardPage />
      case 'contacts':
        return <AdminContactsPage />
      case 'templates':
        return <AdminTemplatesPage />
      case 'settings':
        return <AdminSettingsPage />
      default:
        return <InboxComponent waUser={user} onLogout={onLogout} compact />
    }
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 130px)', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
      <AdminSidebar user={user} page={page} onPageChange={setPage} onLogout={onLogout} />
      <div style={{ flex: 1, overflowY: 'auto', background: '#f9fafb' }}>
        {renderPage()}
      </div>
    </div>
  )
}
