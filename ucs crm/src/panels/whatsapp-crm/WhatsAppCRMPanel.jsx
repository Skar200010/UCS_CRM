import { Routes, Route, Navigate } from 'react-router-dom'
import AdminSidebar from './components/AdminSidebar'
import AdminDashboardPage from './pages/AdminDashboardPage'
import AdminContactsPage from './pages/AdminContactsPage'
import AdminTemplatesPage from './pages/AdminTemplatesPage'
import AdminSettingsPage from './pages/AdminSettingsPage'

export default function WhatsAppCRMPanel({ user, onLogout, inboxComponent: InboxComponent }) {
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 130px)', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
      <AdminSidebar user={user} onLogout={onLogout} />
      <div style={{ flex: 1, overflowY: 'auto', background: '#f9fafb' }}>
        <Routes>
          <Route index element={<Navigate to="inbox" replace />} />
          <Route path="inbox" element={<InboxComponent />} />
          <Route path="inbox/:conversationId" element={<InboxComponent />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="contacts" element={<AdminContactsPage />} />
          <Route path="templates" element={<AdminTemplatesPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="*" element={<Navigate to="inbox" replace />} />
        </Routes>
      </div>
    </div>
  )
}
