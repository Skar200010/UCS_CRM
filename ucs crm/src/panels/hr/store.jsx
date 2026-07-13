import { useContext } from 'react'
import { UcsContext } from '../../store'
export function useHR() {
  const ctx = useContext(UcsContext)
  if (!ctx) throw new Error('useHR must be used within UcsProvider')
  return {
    ...ctx,
    DEPTS,
    fetchWorkers, fetchNGOs, addWorker, removeWorker, fetchWorkerById, updateWorker, bulkUpdateWorkers,
    fetchAttendance, fetchLeaves, decideLeave,
    fetchTemplates, generateLetter, fetchWorkerLetters, sendNotif,
    fetchHolidays, addHoliday, removeHoliday,
    fetchLeads, addLead, updateLead, fetchRecruiters, fetchRecruiterStats, fetchRecruiterOverview, fetchLeadsDashboard,
    fetchWorkerSalaries, addWorkerSalary, updateWorkerSalary,
    fetchWorkerTargets, fetchWorkerTargetForMonth, updateWorkerTarget,
    generateAllTargets, fetchCurrentMonthTargets,
    setAchievement, fetchWorkerAchievements, fetchIncentiveSummary, fetchMonthlyIncentiveSummary,
    fetchWorkerAllocations, setWorkerAllocations, fetchWorkerSalaryAllocations,
    fetchLoans, fetchPendingLoans, decideLoan, fetchWorkerLoans, fetchWorkerActiveLoans,
    fetchPendingTickets, fetchAllTickets, fetchTicketCount, verifyTicket, rejectTicket,
    generateQR, fetchQRCodes, removeQRCode,
    fetchSettings, updateSettings,
  }
}

import { api } from '../../api/auth'
export const apiGet = (path) => api(path, { _prefix: 'ucs' })
export const apiPost = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body), _prefix: 'ucs' })
export const apiDelete = (path) => api(path, { method: 'DELETE', _prefix: 'ucs' })
export const apiPut = (path, body) => api(path, { method: 'PUT', body: JSON.stringify(body), _prefix: 'ucs' })

const PALETTE = ['#5B6B4E','#B5603A','#C08A2E','#4F6472','#7A5C7E','#88693D'];
export const avatarColor = (name) => {
  let h = 0; for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
};
export const initials = (n) => n.trim().split(/\s+/).map(w => w[0]).slice(0,2).join('').toUpperCase();
const tint = (hex) => hex + '22';
export const avatarTint = tint;

export const DEPTS = ['FRO','Admin','HR-Recruiter','Housekeeping','CSR','Digital','Manager','Event Manager','NA', 'NGO Admin'];

export const fetchWorkers = () => apiGet('/workers');
export const fetchNGOs = () => apiGet('/ngos');
export const addWorker = (body) => apiPost('/workers', body);
export const removeWorker = (id) => apiDelete('/workers/' + id);
export const fetchWorkerById = (id) => apiGet('/workers/' + id);
export const updateWorker = (id, updates) => apiPut('/workers/' + id, updates);
export const bulkUpdateWorkers = (workers) => apiPut('/workers/bulk', { workers });
export const fetchAttendance = () => apiGet('/attendance/all');
export const fetchLeaves = () => apiGet('/leaves');
export const decideLeave = (id, status) => apiPut('/leaves/' + id + '/status', { status: status === 'Approved' ? 'approved' : 'rejected' });
export const fetchTemplates = () => apiGet('/letters/templates');
export const generateLetter = (template_id, worker_id, variables = {}) => apiPost('/letters/generate', { template_id, worker_id, variables });
export const fetchWorkerLetters = (workerId) => apiGet('/letters/generated/worker/' + workerId);
export const sendNotif = (title, body, worker_id) => apiPost('/admin/notifications/send-now', { title, body, worker_id: worker_id || undefined });
export const fetchHolidays = () => apiGet('/holidays');
export const addHoliday = (h) => apiPost('/holidays', h);
export const removeHoliday = (id) => apiDelete('/holidays/' + id);
export const fetchLeads = (filters) => {
  const params = new URLSearchParams();
  if (filters?.recruiter_id) params.set('recruiter_id', filters.recruiter_id);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.search) params.set('search', filters.search);
  const q = params.toString();
  return apiGet('/leads' + (q ? '?' + q : ''));
};
export const addLead = (leadData) => apiPost('/leads', leadData);
export const updateLead = (id, updates) => apiPut('/leads/' + id, updates);
export const fetchRecruiters = () => apiGet('/recruiters');
export const fetchRecruiterStats = (id) => apiGet('/recruiters/' + id + '/stats');
export const fetchRecruiterOverview = () => apiGet('/recruiters/overview');
export const fetchLeadsDashboard = () => apiGet('/leads/dashboard');
export const fetchWorkerSalaries = (workerId) => apiGet('/salary/worker/' + workerId);
export const addWorkerSalary = (data) => apiPost('/salary', data);
export const updateWorkerSalary = (id, data) => apiPut('/salary/' + id, data);
export const fetchWorkerTargets = (workerId) => apiGet('/incentive/worker/' + workerId + '/targets');
export const fetchWorkerTargetForMonth = (workerId, month) => apiGet('/incentive/worker/' + workerId + '/month/' + month);
export const updateWorkerTarget = (workerId, month, target_amount) => apiPut('/incentive/worker/' + workerId + '/month/' + month, { target_amount });
export const generateAllTargets = () => apiPost('/incentive/generate-all');
export const fetchCurrentMonthTargets = () => apiGet('/incentive/current-month-targets');
export const setAchievement = (workerId, date, amount) => apiPut('/incentive/worker/' + workerId + '/achievement/' + date, { amount });
export const fetchWorkerAchievements = (workerId, month) => apiGet('/incentive/worker/' + workerId + '/achievements/' + month);
export const fetchIncentiveSummary = (workerId, month) => apiGet('/incentive/worker/' + workerId + '/incentive-summary/' + month);
export const fetchMonthlyIncentiveSummary = () => apiGet('/incentive/monthly-summary');
export const fetchWorkerAllocations = (workerId) => apiGet('/workers/' + workerId + '/allocations');
export const setWorkerAllocations = (workerId, allocations, salary) => apiPut('/workers/' + workerId + '/allocations', { allocations, salary });
export const fetchWorkerSalaryAllocations = (workerId, month) => {
  let url = '/salary/worker/' + workerId + '/allocations';
  if (month) url += '?month=' + month;
  return apiGet(url);
};
export const generateQR = (label, latitude, longitude, radius_meters) => apiPost('/qr/generate', { label, latitude, longitude, radius_meters });
export const fetchQRCodes = () => apiGet('/qr');
export const removeQRCode = (id) => apiDelete('/qr/' + id);
export const fetchSettings = () => apiGet('/settings');
export const updateSettings = (settings) => apiPut('/settings', settings);
export const fetchLoans = () => apiGet('/loans');
export const fetchPendingLoans = () => apiGet('/loans/pending');
export const decideLoan = (id, status, monthly_deduction, hr_remark) => apiPut('/loans/' + id + '/decide', { status: status === 'approved' ? 'approved' : 'rejected', monthly_deduction, hr_remark });
export const fetchWorkerLoans = (workerId) => apiGet('/loans/worker/' + workerId);
export const fetchWorkerActiveLoans = (workerId) => apiGet('/loans/worker/' + workerId + '/active');
export const fetchPendingTickets = () => apiGet('/attendance-corrections/pending');
export const fetchAllTickets = () => apiGet('/attendance-corrections/all');
export const fetchTicketCount = () => apiGet('/attendance-corrections/pending-count');
export const verifyTicket = (id, hr_remark) => apiPut('/attendance-corrections/' + id + '/verify', { hr_remark });
export const rejectTicket = (id, remark) => apiPut('/attendance-corrections/' + id + '/reject', { remark });
