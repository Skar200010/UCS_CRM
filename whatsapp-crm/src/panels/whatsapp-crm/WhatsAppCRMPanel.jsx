import { Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'

import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AdminProtectedRoute } from './components/admin/AdminProtectedRoute'
import { AdminLayout } from './components/admin/AdminLayout'

import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { DashboardPage } from './pages/DashboardPage'
import { InboxPage } from './pages/InboxPage'
import { ContactsPage } from './pages/ContactsPage'
import { ContactDetailPage } from './pages/ContactDetailPage'
import { PipelinePage } from './pages/PipelinePage'
import { AutomationsPage } from './pages/AutomationsPage'
import { FlowBuilderPage } from './pages/FlowBuilderPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { SettingsPage } from './pages/SettingsPage'
import { PhoneNumbersPage } from './pages/PhoneNumbersPage'
import { TemplatesPage } from './pages/TemplatesPage'
import { TemplateEditorPage } from './pages/TemplateEditorPage'

import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { AdminTenantsPage } from './pages/admin/AdminTenantsPage'
import { AdminTenantDetailPage } from './pages/admin/AdminTenantDetailPage'
import { AdminMetricsPage } from './pages/admin/AdminMetricsPage'
import { AdminHealthPage } from './pages/admin/AdminHealthPage'
import { AdminWebhookPage } from './pages/admin/AdminWebhookPage'
import { AdminAuditPage } from './pages/admin/AdminAuditPage'

import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

export default function WhatsAppCRMPanel() {
  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        {/* Auth routes */}
        <Route path="auth/login" element={<div className="flex min-h-screen items-center justify-center bg-gray-50 px-4"><div className="w-full max-w-sm"><LoginPage /></div></div>} />
        <Route path="auth/register" element={<div className="flex min-h-screen items-center justify-center bg-gray-50 px-4"><div className="w-full max-w-sm"><RegisterPage /></div></div>} />

        {/* Main app routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="inbox" element={<InboxPage />} />
            <Route path="inbox/:conversationId" element={<InboxPage />} />
            <Route path="contacts" element={<ContactsPage />} />
            <Route path="contacts/:id" element={<ContactDetailPage />} />
            <Route path="pipeline" element={<PipelinePage />} />
            <Route path="automations" element={<AutomationsPage />} />
            <Route path="automations/new" element={<FlowBuilderPage />} />
            <Route path="automations/:id" element={<FlowBuilderPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="phone-numbers" element={<PhoneNumbersPage />} />
            <Route path="templates" element={<TemplatesPage />} />
            <Route path="templates/new" element={<TemplateEditorPage />} />
            <Route path="templates/:id" element={<TemplateEditorPage />} />
            <Route path="conversations" element={<InboxPage />} />
            <Route path="workflows" element={<AutomationsPage />} />
          </Route>
        </Route>

        {/* Admin routes */}
        <Route element={<AdminProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="admin" element={<AdminDashboardPage />} />
            <Route path="admin/tenants" element={<AdminTenantsPage />} />
            <Route path="admin/tenants/:id" element={<AdminTenantDetailPage />} />
            <Route path="admin/metrics" element={<AdminMetricsPage />} />
            <Route path="admin/health" element={<AdminHealthPage />} />
            <Route path="admin/webhooks" element={<AdminWebhookPage />} />
            <Route path="admin/audit" element={<AdminAuditPage />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-right" />
    </QueryClientProvider>
  )
}
