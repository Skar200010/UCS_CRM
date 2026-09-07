const DEPT_LABELS = {
  'Admin': 'Accounts',
  'NGO Admin': 'Admin',
}

export function deptLabel(v) {
  if (v == null) return v
  const key = String(v).trim()
  return DEPT_LABELS[key] ?? v
}