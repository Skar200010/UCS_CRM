import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Building2, BarChart3, Activity, Webhook, Shield, ArrowLeft, MessageCircle } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../lib/utils';

const adminNav = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard, end: true },
  { name: 'Tenants', href: '/admin/tenants', icon: Building2 },
  { name: 'Metrics', href: '/admin/metrics', icon: BarChart3 },
  { name: 'System Health', href: '/admin/health', icon: Activity },
  { name: 'Webhook Logs', href: '/admin/webhooks', icon: Webhook },
  { name: 'Audit Logs', href: '/admin/audit', icon: Shield },
];

export function AdminLayout() {
  const { user } = useAuthStore();

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex w-64 flex-col border-r bg-card">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <MessageCircle className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">Admin Panel</span>
        </div>
        <div className="border-b px-6 py-2">
          <NavLink
            to="/"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to CRM
          </NavLink>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {adminNav.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-4 text-xs text-muted-foreground">
          Logged in as <span className="font-medium">{user?.email}</span>
        </div>
      </div>
      <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
        <Outlet />
      </main>
    </div>
  );
}
