import { useContext } from 'react'
import { UcsContext } from '../../store'
import { API_BASE } from '../../lib/apiBase'
import { deptLabel } from '../../lib/labels'
export function useHR() {
  const ctx = useContext(UcsContext)
  if (!ctx) throw new Error('useHR must be used within UcsProvider')
  return {
    ...ctx,
    DEPTS,
    deptLabel,
    fetchWorkers, fetchNGOs, addWorker, removeWorker, abscondWorker, offboardWorker, fetchWorkerById, updateWorker, bulkUpdateWorkers,
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
    fetchNgoSalarySummary, fetchNgoAllocationSettings, saveNgoAllocationSettings, fetchNgoSummaryList,
    fetchWorkerPeopleAllocations, saveWorkerPeopleAllocations,
    fetchWorkerSalaryAlloc, saveWorkerSalaryAlloc, generateWorkerSalaryAlloc, generateAllSalaryAllocations,
    fetchPayments, createPayment, updatePaymentStatus,
    fetchNgoSalaryReport, fetchEmployeeReport, fetchNgoReport, fetchNgoSalaryReportFallback,
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

export const DEPTS = ['FRO','Admin','HR','HR-Recruiter','Housekeeping','CSR','Digital','Manager','Event Manager','NA', 'NGO Admin'];

export const fetchWorkers = (status) => {
  let path = '/workers';
  if (status) path += '?status=' + status;
  return apiGet(path);
};
export const fetchNGOs = () => apiGet('/ngos');
export const addWorker = (body) => apiPost('/workers', body);
export const removeWorker = (id) => apiDelete('/workers/' + id);
export const abscondWorker = (id) => apiPut('/workers/' + id, { employment_status: 'absconded', is_active: false });
export const offboardWorker = (id) => apiPut('/workers/' + id, { employment_status: 'offboarded', is_active: false });
export const fetchWorkerById = (id) => apiGet('/workers/' + id);
export const updateWorker = (id, updates) => apiPut('/workers/' + id, updates);
export const bulkUpdateWorkers = (workers) => apiPut('/workers/bulk', { workers });
export const fetchAttendance = () => apiGet('/attendance/all');
export const fetchLeaves = () => apiGet('/leaves');
export const decideLeave = (id, status) => {
  if (status === 'Cancelled') {
    return apiPut('/leaves/' + id + '/status', { status: 'cancelled' });
  }
  if (status === 'Approved') {
    return apiPut('/leaves/' + id + '/status', { status: 'approved', admin_remark: null });
  }
  return apiPut('/leaves/' + id + '/status', { status: 'rejected' });
};
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
export const fetchNgoSalarySummary = () => apiGet('/ngo-allocations/summary');
export const fetchNgoAllocationSettings = () => apiGet('/ngo-allocations/settings');
export const saveNgoAllocationSettings = (allocations) => apiPut('/ngo-allocations/settings', { allocations });
export const fetchNgoSummaryList = () => apiGet('/ngos/summary');
export const fetchWorkerPeopleAllocations = (workerId) => apiGet('/ngo-allocations/workers/' + workerId + '/people');
export const saveWorkerPeopleAllocations = (workerId, allocations) => apiPut('/ngo-allocations/workers/' + workerId + '/people', { allocations });
export const fetchWorkerSalaryAlloc = (workerId, month) => apiGet('/ngo-allocations/workers/' + workerId + '/salary' + (month ? '?month=' + month : ''));
export const saveWorkerSalaryAlloc = (workerId, allocations, month) => apiPut('/ngo-allocations/workers/' + workerId + '/salary' + (month ? '?month=' + month : ''), { allocations, month });
export const generateWorkerSalaryAlloc = (workerId, month) => apiPost('/ngo-allocations/workers/' + workerId + '/salary/generate' + (month ? '?month=' + month : ''));
export const generateAllSalaryAllocations = (month) => apiPost('/ngo-allocations/salary/generate-all' + (month ? '?month=' + month : ''));
export const fetchPayments = (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.month) params.set('month', filters.month);
  if (filters.ngo_id) params.set('ngo_id', filters.ngo_id);
  if (filters.worker_id) params.set('worker_id', filters.worker_id);
  if (filters.status) params.set('status', filters.status);
  const q = params.toString();
  return apiGet('/ngo-allocations/payments' + (q ? '?' + q : ''));
};
export const createPayment = (data) => apiPost('/ngo-allocations/payments', data);
export const updatePaymentStatus = (id, status) => apiPut('/ngo-allocations/payments/' + id + '/status', { status });
export const fetchNgoSalaryReport = (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.month) params.set('month', filters.month);
  if (filters.ngo_id) params.set('ngo_id', filters.ngo_id);
  if (filters.worker_id) params.set('worker_id', filters.worker_id);
  if (filters.status) params.set('status', filters.status);
  const q = params.toString();
  return apiGet('/ngo-allocations/report/ngo-salary' + (q ? '?' + q : ''));
};
// TEMPORARY fallback for NGO Salary Report only: used when /report/ngo-salary
// fails on servers that do not yet include the QueryBuilder embedded-order fix.
// Remove once the backend fix is deployed.
export const fetchNgoSalaryReportFallback = async (filters = {}) => {
  const month = String(filters.month || '').replace(/[^0-9-]/g, '');
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Invalid month');
  const sql = "SELECT sa.worker_id, w.name AS \"worker_name\", w.employee_id, w.department, sa.ngo_id, n.name AS \"ngo_name\", n.code AS \"ngo_code\", sa.salary_month, sa.allocation_percentage, sa.allocation_amount, COALESCE(p.paid, 0) AS \"paid_amount\", COALESCE(p.st, 'unpaid') AS \"payment_status\" FROM salary_allocations sa LEFT JOIN workers w ON w.id = sa.worker_id LEFT JOIN ngos n ON n.id = sa.ngo_id LEFT JOIN (SELECT worker_id, ngo_id, salary_month, SUM(amount) AS paid, CASE WHEN SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) > 0 THEN 'paid' WHEN SUM(CASE WHEN payment_status = 'processing' THEN 1 ELSE 0 END) > 0 THEN 'processing' ELSE 'unpaid' END AS st FROM salary_payments GROUP BY worker_id, ngo_id, salary_month) p ON p.worker_id = sa.worker_id AND p.ngo_id = sa.ngo_id AND p.salary_month = sa.salary_month WHERE sa.salary_month = '" + month + "-01' ORDER BY n.name ASC";
  const res = await fetch(API_BASE + '/db/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sql }) });
  if (!res.ok) throw new Error('Fallback query failed: ' + res.status);
  const data = await res.json();
  let rows = data.rows || [];
  if (filters.ngo_id) rows = rows.filter(r => r.ngo_id === filters.ngo_id);
  if (filters.worker_id) rows = rows.filter(r => r.worker_id === filters.worker_id);
  if (filters.status) rows = rows.filter(r => (r.payment_status || 'unpaid') === filters.status);
  return rows;
};
export const fetchEmployeeReport = (workerId) => apiGet('/ngo-allocations/report/employee/' + workerId);
export const fetchNgoReport = (ngoId, month) => apiGet('/ngo-allocations/report/ngo/' + ngoId + (month ? '?month=' + month : ''));
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
