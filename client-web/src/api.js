import { API_BASE, CACHE_KEYS } from './config'

const getToken = () => localStorage.getItem(CACHE_KEYS.TOKEN)

async function request(method, path, body) {
  const res = await fetch(`${API_BASE}/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Request failed')
  return data
}

export const api = {
  login: (identifier, password) =>
    request('POST', 'auth/worker/login', { identifier, password }),

  punchIn: (code, latitude, longitude) =>
    request('POST', 'attendance/punch-in', { code, latitude, longitude }),

  punchOut: (latitude, longitude) =>
    request('POST', 'attendance/punch-out', { latitude, longitude }),

  today: () => request('GET', 'attendance/today'),

  history: () => request('GET', 'attendance/history'),

  myProfile: () => request('GET', 'workers/me'),

  updateProfile: (body) => request('PUT', 'workers/me', body),

  applyLeave: (body) => request('POST', 'leaves/apply', body),

  myLeaves: () => request('GET', 'leaves/my'),

  applyAdvance: (body) => request('POST', 'advances/apply', body),

  applyLoan: (body) => request('POST', 'loans/apply', body),

  myLoans: () => request('GET', 'loans/my'),

  myTickets: () => request('GET', 'attendance-corrections/my'),

  raiseTicket: (body) => request('POST', 'attendance-corrections', body),

  notifications: (workerId) => request('GET', `notifications/${workerId}`),

  unreadCount: (workerId) => request('GET', `notifications/${workerId}/unread-count`),

  markRead: (id) => request('PUT', `notifications/${id}/read`),

  onboardingStatus: () => request('GET', 'onboarding/status'),

  submitOnboarding: (body) => request('POST', 'onboarding/submit', body),

  uploadPhoto: (formData) =>
    fetch(`${API_BASE}/onboarding/upload-photo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    }).then(r => r.json()),

  uploadDocument: (formData) =>
    fetch(`${API_BASE}/onboarding/upload-document`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    }).then(r => r.json()),

  printProfile: () => request('GET', 'onboarding/print-profile'),

  salaryBreakdown: () => request('GET', 'salary/my-breakdown'),

  calendar: () => request('GET', 'calendar'),

  policies: () => request('GET', 'onboarding/policies'),
}
