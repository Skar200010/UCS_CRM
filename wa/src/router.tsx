import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthLayout } from './components/layout/AuthLayout';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AdminProtectedRoute } from './components/admin/AdminProtectedRoute';
import { AdminLayout } from './components/admin/AdminLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { InboxPage } from './pages/InboxPage';
import { ContactsPage } from './pages/ContactsPage';
import { ContactDetailPage } from './pages/ContactDetailPage';
import { PipelinePage } from './pages/PipelinePage';
import { AutomationsPage } from './pages/AutomationsPage';
import { FlowBuilderPage } from './pages/FlowBuilderPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { PhoneNumbersPage } from './pages/PhoneNumbersPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { TemplateEditorPage } from './pages/TemplateEditorPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminTenantsPage } from './pages/admin/AdminTenantsPage';
import { AdminTenantDetailPage } from './pages/admin/AdminTenantDetailPage';
import { AdminMetricsPage } from './pages/admin/AdminMetricsPage';
import { AdminHealthPage } from './pages/admin/AdminHealthPage';
import { AdminWebhookPage } from './pages/admin/AdminWebhookPage';
import { AdminAuditPage } from './pages/admin/AdminAuditPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'inbox', element: <InboxPage /> },
          { path: 'inbox/:conversationId', element: <InboxPage /> },
          { path: 'contacts', element: <ContactsPage /> },
          { path: 'contacts/:id', element: <ContactDetailPage /> },
          { path: 'pipeline', element: <PipelinePage /> },
          { path: 'automations', element: <AutomationsPage /> },
          { path: 'automations/new', element: <FlowBuilderPage /> },
          { path: 'automations/:id', element: <FlowBuilderPage /> },
          { path: 'analytics', element: <AnalyticsPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'phone-numbers', element: <PhoneNumbersPage /> },
          { path: 'templates', element: <TemplatesPage /> },
          { path: 'templates/new', element: <TemplateEditorPage /> },
          { path: 'templates/:id', element: <TemplateEditorPage /> },
        ],
      },
    ],
  },
  {
    path: '/admin',
    element: <AdminProtectedRoute />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminDashboardPage /> },
          { path: 'tenants', element: <AdminTenantsPage /> },
          { path: 'tenants/:id', element: <AdminTenantDetailPage /> },
          { path: 'metrics', element: <AdminMetricsPage /> },
          { path: 'health', element: <AdminHealthPage /> },
          { path: 'webhooks', element: <AdminWebhookPage /> },
          { path: 'audit', element: <AdminAuditPage /> },
        ],
      },
    ],
  },
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      { index: true, element: <Navigate to="/auth/login" replace /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
], { basename: '/whatsapp-crm/' });
