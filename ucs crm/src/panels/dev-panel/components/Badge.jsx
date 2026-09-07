export function SourceBadge({ source, size = 'md' }) {
  const sourceMap = {
    panel: { label: 'Panel', variant: 'info', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
    account_panel: { label: 'Account Panel', variant: 'primary', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
    developer: { label: 'Developer', variant: 'warning', color: '#d97706', bg: '#fefce8', border: '#fde68a' },
    regular: { label: 'Regular', variant: 'default', color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb' },
    fro: { label: 'FRO', variant: 'success', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
    accounts: { label: 'Accounts', variant: 'info', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
    ngo_admin: { label: 'Admin', variant: 'primary', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
  };

  const config = sourceMap[source] || { label: source, variant: 'default', color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb' };

  const sizeStyles = {
    sm: { padding: '2px 8px', fontSize: '10px', height: '20px', borderRadius: '9999px' },
    md: { padding: '4px 10px', fontSize: '11px', height: '24px', borderRadius: '9999px' },
    lg: { padding: '6px 12px', fontSize: '12px', height: '28px', borderRadius: '9999px' },
  };

  const s = sizeStyles[size];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontWeight: 600,
        background: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        ...s,
      }}
    >
      {config.label}
    </span>
  );
}

export function StatusBadge({ status, size = 'md' }) {
  const statusMap = {
    open: { color: '#a16207', bg: '#fefce8', border: '#fde68a', label: 'Open' },
    in_progress: { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', label: 'In Progress' },
    under_review: { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', label: 'Under Review' },
    resolved: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Resolved' },
    closed: { color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb', label: 'Closed' },
  };

  const config = statusMap[status] || { color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb', label: status };

  const sizeStyles = {
    sm: { padding: '2px 8px', fontSize: '10px', height: '20px', borderRadius: '9999px' },
    md: { padding: '4px 10px', fontSize: '11px', height: '24px', borderRadius: '9999px' },
    lg: { padding: '6px 12px', fontSize: '12px', height: '28px', borderRadius: '9999px' },
  };

  const s = sizeStyles[size];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontWeight: 600,
        background: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        ...s,
        textTransform: 'capitalize',
      }}
    >
      {config.label}
    </span>
  );
}

export function PriorityBadge({ priority, size = 'md' }) {
  const priorityMap = {
    low: { color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb', label: 'Low' },
    medium: { color: '#d97706', bg: '#fefce8', border: '#fde68a', label: 'Medium' },
    high: { color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', label: 'High' },
    critical: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Critical' },
  };

  const config = priorityMap[priority] || { color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb', label: priority };

  const sizeStyles = {
    sm: { padding: '2px 8px', fontSize: '10px', height: '20px', borderRadius: '9999px' },
    md: { padding: '4px 10px', fontSize: '11px', height: '24px', borderRadius: '9999px' },
    lg: { padding: '6px 12px', fontSize: '12px', height: '28px', borderRadius: '9999px' },
  };

  const s = sizeStyles[size];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontWeight: 600,
        background: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        ...s,
        textTransform: 'capitalize',
      }}
    >
      {config.label}
    </span>
  );
}