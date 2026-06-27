import { api } from './auth'

export async function getTransferredLeads() {
  return api('/fro/transferred-leads', { _prefix: 'ucs' })
}

export async function getMyDonors(status, statusGroup) {
  const params = new URLSearchParams();
  if (statusGroup) params.set('status_group', statusGroup);
  else if (status) params.set('status', status);
  const qs = params.toString();
  return api(`/fro/donors${qs ? '?' + qs : ''}`, { _prefix: 'ucs' })
}

export async function getDonorDetail(donorId, ngoId) {
  const params = ngoId ? `?ngo_id=${ngoId}` : ''
  return api(`/fro/donors/${donorId}/logs${params}`, { _prefix: 'ucs' })
}

export async function updateDonorStatus(donorId, data) {
  return api(`/fro/donors/${donorId}/status`, { method: 'PUT', body: JSON.stringify(data), _prefix: 'ucs' })
}

export async function addDonorLog(donorId, data) {
  return api(`/fro/donors/${donorId}/logs`, { method: 'POST', body: JSON.stringify(data), _prefix: 'ucs' })
}

export async function scheduleContact(donorId, data) {
  return api(`/fro/donors/${donorId}/schedule`, { method: 'POST', body: JSON.stringify(data), _prefix: 'ucs' })
}

export async function getDonorDonations(donorId, ngoId, yearFilter) {
  const params = new URLSearchParams();
  if (ngoId) params.set('ngo_id', ngoId);
  if (yearFilter) params.set('year', yearFilter);
  return api(`/fro/donors/${donorId}/donations?${params}`, { _prefix: 'ucs' })
}

export async function uploadPaymentScreenshot(fileBase64, mimeType) {
  return api('/fro/upload-payment-screenshot', { method: 'POST', body: JSON.stringify({ file_base64: fileBase64, mime_type: mimeType }), _prefix: 'ucs' })
}

export async function getMyDashboard() {
  return api('/fro/dashboard', { _prefix: 'ucs' })
}

export async function getMyHistory() {
  return api('/fro/history', { _prefix: 'ucs' })
}

export async function requestMoreData(message) {
  return api('/fro/request-data', { method: 'POST', body: JSON.stringify({ message }), _prefix: 'ucs' })
}

export async function getScheduled() {
  return api('/fro/scheduled', { _prefix: 'ucs' })
}

export async function getCallbacks() {
  return api('/fro/callbacks', { _prefix: 'ucs' })
}

export async function markDonorSeen(donorId, ngoId) {
  const body = ngoId ? JSON.stringify({ ngo_id: ngoId }) : '{}'
  return api(`/fro/donors/${donorId}/mark-seen`, { method: 'PUT', body, _prefix: 'ucs' })
}

export async function reportMissedSchedule(donorId, ngoId, scheduledAt) {
  return api('/fro/report-missed', { method: 'POST', body: JSON.stringify({ donor_id: donorId, ngo_id: ngoId, scheduled_at: scheduledAt }), _prefix: 'ucs' })
}

export async function getMyDataRequests() {
  return api('/fro/database-requests', { _prefix: 'ucs' })
}

export async function getFollowUps() {
  return api('/fro/follow-ups', { _prefix: 'ucs' })
}

export async function getLeadStats(month) {
  const params = month ? `?month=${month}` : ''
  return api(`/fro/lead-stats${params}`, { _prefix: 'ucs' })
}

export async function getMonthlyDonors(month) {
  const params = month ? `?month=${month}` : ''
  return api(`/fro/monthly-donors${params}`, { _prefix: 'ucs' })
}

export async function getDonorHistory(donorId, period) {
  const params = period ? `?period=${period}` : ''
  return api(`/fro/donors/${donorId}/history${params}`, { _prefix: 'ucs' })
}
