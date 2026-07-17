import supabase from '../config/supabase.js';
import { getDonorByMobile, getDonorProfilesByImportNgo } from '../models/donorProfileModel.js';
import { getWorkerById } from '../models/workerModel.js';
import { getActiveSalaryByWorker } from '../models/salaryModel.js';
import { getUserNgoAccess } from '../models/userNgoAccessModel.js';
import { updateNewDataStatusByNgoAndMobiles } from '../models/newDataModel.js';
import {
  batchCreateAssignments,
  findAssignmentsByNgo,
  getStationDispositionStats,
  getDonorsByStationAndStatus,
  createTemporaryTransfer,
  reverseTransfer,
} from '../models/froAssignmentModel.js';
import {
  upsertStationAssignment,
  createStation,
  getStationAssignmentsByNgo,
  deleteStationAssignment,
  getStationAssignmentByNgoAndStation,
} from '../models/froStationAssignmentModel.js';
import { upsertTarget, getTargetsByNgo, getTargetByWorker, updateAchievedTarget, updateIncentive } from '../models/froTargetModel.js';
import { getTotalCollectedByWorker, getVerifiedCollection, getUnverifiedCollection, getBatchCollectionStats } from '../models/froDonorLogModel.js';
import { getWorkersByNgo } from '../models/workerNgoAllocationModel.js';
import { getDayName, calculateAKI, getMonthsEmployed } from '../utils/incentive.js';

async function getFroWorkersByNgo(ngoId) {
  const workerIds = await getWorkersByNgo(ngoId);

  const conditions = [`ngo_id.eq.${ngoId}`];
  if (workerIds.length > 0) {
    conditions.push(`id.in.(${workerIds.join(',')})`);
  }

  const { data, error } = await supabase
    .from('workers')
    .select('*')
    .eq('department', 'FRO')
    .or(conditions.join(','));

  if (error) throw error;

  const seen = new Set();
  return (data || []).filter(w => {
    if (seen.has(w.id)) return false;
    seen.add(w.id);
    return true;
  });
}

async function getUserNgoIds(user) {
  const access = await getUserNgoAccess(user.id);
  const ids = access.map(a => a.ngo_id).filter(Boolean);
  if (ids.length > 0) return ids;
  if (user.ngo_id) return [user.ngo_id];
  return [];
}

export const getDonors = async (req, res) => {
  try {
    const { search, from_date, to_date, page: pageStr, page_size } = req.query;
    const page = Math.max(1, parseInt(pageStr) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(page_size) || 50));
    const offset = (page - 1) * limit;
    const access = await getUserNgoAccess(req.user.id);
    const ngoNames = access.map(a => a.ngo_name).filter(Boolean);
    const ngoIds = access.map(a => a.ngo_id).filter(Boolean);

    if (ngoNames.length === 0 && req.user.ngo_id) {
      const { data: ngo } = await supabase.from('ngos').select('name').eq('id', req.user.ngo_id).single();
      if (ngo) ngoNames.push(ngo.name);
      if (req.user.ngo_id) ngoIds.push(req.user.ngo_id);
    }

    const { ngo_id: filterNgoId } = req.query;
    if (filterNgoId && filterNgoId !== 'all') {
      const idx = ngoIds.indexOf(filterNgoId);
      if (idx !== -1) {
        const name = ngoNames[idx];
        ngoIds.splice(0, ngoIds.length, ngoIds[idx]);
        ngoNames.splice(0, ngoNames.length, name);
      }
    }

    if (ngoNames.length === 0) return res.json({ data: [], pagination: { page, pageSize: limit, total: 0, totalPages: 0 } });

    let baseQuery = supabase.from('donor_profiles').select('*').in('ngo', ngoNames).order('last_donation_date', { ascending: false, nullsLast: true });

    if (from_date) baseQuery = baseQuery.gte('last_donation_date', from_date);
    if (to_date) baseQuery = baseQuery.lte('last_donation_date', to_date);
    if (search) {
      const q = `%${search}%`;
      baseQuery = baseQuery.or(`name.ilike.${q},mobile_number.ilike.${q},city.ilike.${q}`);
    }

    const { data: allData, error } = await baseQuery;
    if (error) throw error;

    const groups = {};
    for (const d of allData || []) {
      const key = d.mobile_number || `no-mobile-${d.id}`;
      if (!groups[key]) {
        groups[key] = { ...d, ngos: [d.ngo], donor_ids: [d.id], total_amount_all: Number(d.total_amount || d.amount || 0), records: 1 };
      } else {
        if (!groups[key].ngos.includes(d.ngo)) groups[key].ngos.push(d.ngo);
        if (!groups[key].donor_ids.includes(d.id)) groups[key].donor_ids.push(d.id);
        groups[key].total_amount_all += Number(d.total_amount || d.amount || 0);
        groups[key].records += 1;
        if (new Date(d.last_donation_date || 0) > new Date(groups[key].last_donation_date || 0)) {
          groups[key].name = d.name;
          groups[key].city = d.city;
          groups[key].last_donation_date = d.last_donation_date;
        }
      }
    }

    const grouped = Object.values(groups);
    grouped.sort((a, b) => new Date(b.last_donation_date || 0) - new Date(a.last_donation_date || 0));

    const total = grouped.length;
    const paginatedSlice = grouped.slice(offset, offset + limit);

    const allDonorIds = paginatedSlice.flatMap(g => g.donor_ids || []);
    let latestTxMap = {};
    if (allDonorIds.length > 0) {
      try {
        const { data: assignments } = await supabase
          .from('fro_assignments')
          .select('id, donor_id')
          .in('donor_id', allDonorIds);
        const assignIds = (assignments || []).map(a => a.id);
        if (assignIds.length > 0) {
          const { data: logs } = await supabase
            .from('fro_donor_logs')
            .select('amount_collected, created_at, assignment_id')
            .in('assignment_id', assignIds)
            .not('amount_collected', 'is', null)
            .order('created_at', { ascending: false });
          const assignToDonor = {};
          for (const a of assignments || []) assignToDonor[a.id] = a.donor_id;
          for (const log of logs || []) {
            const did = assignToDonor[log.assignment_id];
            if (did && (latestTxMap[did] == null)) {
              latestTxMap[did] = {
                amount: Number(log.amount_collected) || 0,
                date: log.created_at?.slice(0, 10),
              };
            }
          }
        }
      } catch (_) {}
    }

    const paginatedData = paginatedSlice.map(d => {
      let best = { amount: 0, date: null };
      for (const did of (d.donor_ids || [])) {
        const entry = latestTxMap[did];
        if (entry && (!best.date || entry.date > best.date)) best = entry;
      }
      return {
        ...d,
        amount: d.total_amount_all,
        total_amount: d.total_amount_all,
        last_transaction_amount: best.amount,
        last_transaction_date: best.date,
        ngo_list: d.ngos,
      };
    });

    if (req.query.paginated === 'true') {
      return res.json({ data: paginatedData, pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) } });
    }
    return res.json(paginatedData);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getDonorDetail = async (req, res) => {
  try {
    const { mobile } = req.params;
    const profile = await getDonorByMobile(mobile);
    if (!profile) {
      return res.status(404).json({ message: 'Donor not found' });
    }

    const { data: donations, error } = await supabase
      .from('new_data')
      .select('*')
      .eq('mobile_number', mobile)
      .order('transaction_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;

    return res.json({ profile, donations: donations || [] });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getAccessibleNgos = async (req, res) => {
  try {
    const access = await getUserNgoAccess(req.user.id);
    const ngos = access.map(a => ({ id: a.ngo_id, name: a.ngo_name })).filter(n => n.id);
    return res.json(ngos);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getFroWorkers = async (req, res) => {
  try {
    const ngoIds = await getUserNgoIds(req.user);
    const allWorkers = [];
    for (const ngoId of ngoIds) {
      const workers = await getFroWorkersByNgo(ngoId);
      allWorkers.push(...workers);
    }
    const seen = new Set();
    const froWorkers = allWorkers.filter(w => { const k = w.id; if (seen.has(k)) return false; seen.add(k); return true; });

    const workerIds = froWorkers.map(w => w.id);
    let allocMap = {};
    if (workerIds.length > 0) {
      const { data: allAllocs } = await supabase
        .from('worker_ngo_allocations')
        .select('worker_id, ngo_id')
        .in('worker_id', workerIds);
      for (const a of allAllocs || []) {
        if (!allocMap[a.worker_id]) allocMap[a.worker_id] = [];
        allocMap[a.worker_id].push(a.ngo_id);
      }
    }

    const result = await Promise.all(froWorkers.map(async (w) => {
      const salary = await getActiveSalaryByWorker(w.id);
      return {
        id: w.id,
        name: w.name,
        login_id: w.login_id,
        email: w.email,
        phone: w.phone,
        gender: w.gender,
        department: w.department,
        is_active: w.is_active,
        created_at: w.created_at,
        salary: salary ? parseFloat(salary.salary) : 0,
        salary_from_month: salary ? salary.from_month : null,
        allocated_ngo_ids: allocMap[w.id] || [],
      };
    }));

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};



export const getAssignments = async (req, res) => {
  try {
    const ngoIds = await getUserNgoIds(req.user);
    const { status, worker_id } = req.query;
    const allAssignments = [];
    for (const ngoId of ngoIds) {
      const assignments = await findAssignmentsByNgo(ngoId, { status, worker_id });
      allAssignments.push(...assignments);
    }
    const seen = new Set();
    const unique = allAssignments.filter(a => { const k = a.id; if (seen.has(k)) return false; seen.add(k); return true; });

    const result = unique.map(a => ({
      id: a.id,
      donor_id: a.donor_id,
      donor_mobile: a.donor_profiles?.mobile_number || '',
      donor_name: a.donor_profiles?.name || 'Unknown',
      donor_city: a.donor_profiles?.city || '',
      donor_amount: a.donor_profiles?.amount || 0,
      fro_worker_id: a.fro_worker_id,
      fro_name: a.workers?.name || 'Unknown',
      status: a.status,
      notes: a.notes,
      last_contacted_at: a.last_contacted_at,
      next_follow_up: a.next_follow_up,
      assigned_at: a.assigned_at,
    }));

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};



export const setTarget = async (req, res) => {
  try {
    const { fro_worker_id, month, target_amount } = req.body;
    const ngoIds = await getUserNgoIds(req.user);
    const ngoId = ngoIds[0];

    if (!fro_worker_id || !month || target_amount === undefined) {
      return res.status(400).json({ message: 'fro_worker_id, month, and target_amount are required' });
    }
    if (!ngoId) {
      return res.status(400).json({ message: 'No NGO assigned to your account' });
    }

    const worker = await getWorkerById(fro_worker_id);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    const salary = await getActiveSalaryByWorker(fro_worker_id);
    const currentSalary = salary ? parseFloat(salary.salary) : 0;
    const joinedAt = new Date(worker.created_at);
    const targetMonth = new Date(month + '-01');
    const monthsEmployed = (targetMonth.getFullYear() - joinedAt.getFullYear()) * 12
      + (targetMonth.getMonth() - joinedAt.getMonth());

    if (monthsEmployed < 3) {
      let autoTarget;
      if (monthsEmployed <= 0) autoTarget = currentSalary * 1;
      else if (monthsEmployed === 1) autoTarget = currentSalary * 2.5;
      else autoTarget = currentSalary * 3;

      return res.status(400).json({
        message: `Cannot manually set target for months 1-3. Auto-calculated target for this worker is ₹${autoTarget.toLocaleString('en-IN')}. Manual target setting is allowed from month 4 onwards.`,
        auto_target: autoTarget,
      });
    }

    const result = await upsertTarget({
      fro_worker_id,
      ngo_id: ngoId,
      month: month + '-01',
      target_amount,
      set_by: req.user.id,
    });

    return res.json({ message: 'Target set successfully', data: result });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getTargets = async (req, res) => {
  try {
    const ngoIds = await getUserNgoIds(req.user);
    const { month } = req.query;
    const targetMonth = month ? month + '-01' : new Date().toISOString().slice(0, 7) + '-01';

    const allWorkers = [];
    for (const ngoId of ngoIds) {
      const workers = await getFroWorkersByNgo(ngoId);
      allWorkers.push(...workers);
    }
    const seen = new Set();
    const froWorkers = allWorkers.filter(w => { const k = w.id; if (seen.has(k)) return false; seen.add(k); return true; });

    const allManualTargets = [];
    for (const ngoId of ngoIds) {
      const targets = await getTargetsByNgo(ngoId, targetMonth);
      allManualTargets.push(...targets);
    }
    const manualMap = {};
    const achievedMap = {};
    const incentiveMap = {};
    for (const t of allManualTargets) {
      manualMap[t.fro_worker_id] = parseFloat(t.target_amount);
      achievedMap[t.fro_worker_id] = t.achieved_target != null ? parseFloat(t.achieved_target) : null;
      incentiveMap[t.fro_worker_id] = t.incentive != null ? parseFloat(t.incentive) : null;
    }

    const result = await Promise.all(froWorkers.map(async (w) => {
      const salary = await getActiveSalaryByWorker(w.id);
      const currentSalary = salary ? parseFloat(salary.salary) : 0;
      const joinedAt = new Date(w.created_at);
      const targetDate = new Date(targetMonth);
      const monthsEmployed = (targetDate.getFullYear() - joinedAt.getFullYear()) * 12
        + (targetDate.getMonth() - joinedAt.getMonth());

      let target;
      let targetSource;
      if (monthsEmployed < 3) {
        if (monthsEmployed <= 0) { target = currentSalary * 1; targetSource = 'auto_month1'; }
        else if (monthsEmployed === 1) { target = currentSalary * 2.5; targetSource = 'auto_month2'; }
        else { target = currentSalary * 3; targetSource = 'auto_month3'; }
      } else {
        target = manualMap[w.id] || 0;
        targetSource = manualMap[w.id] ? 'manual' : 'not_set';
      }

      return {
        id: w.id,
        name: w.name,
        login_id: w.login_id,
        salary: currentSalary,
        joined_at: w.created_at,
        months_employed: monthsEmployed,
        target,
        target_source: targetSource,
        manual_target: manualMap[w.id] || null,
        achieved_target: achievedMap[w.id] || null,
        incentive: incentiveMap[w.id] || null,
      };
    }));

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getDailyTarget = async (req, res) => {
  try {
    const { data: worker } = await supabase
      .from('workers')
      .select('daily_collection_target')
      .eq('id', req.user.id)
      .maybeSingle();
    return res.json({ daily_target: worker ? Number(worker.daily_collection_target) || 0 : 0 });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getDashboard = async (req, res) => {
  try {
    const access = await getUserNgoAccess(req.user.id);
    const ngoNames = access.map(a => a.ngo_name).filter(Boolean);
    const ngoIds = access.map(a => a.ngo_id).filter(Boolean);

    if (ngoNames.length === 0 && req.user.ngo_id) {
      const { data: ngo } = await supabase.from('ngos').select('name').eq('id', req.user.ngo_id).single();
      if (ngo) ngoNames.push(ngo.name);
      if (req.user.ngo_id) ngoIds.push(req.user.ngo_id);
    }

    const { ngo_id: filterNgoId } = req.query;
    const origNgoNames = [...ngoNames];
    const origNgoIds = [...ngoIds];

    if (filterNgoId && filterNgoId !== 'all') {
      const idx = ngoIds.indexOf(filterNgoId);
      if (idx !== -1) {
        ngoNames.splice(0, ngoNames.length, ngoNames[idx]);
        ngoIds.splice(0, ngoIds.length, ngoIds[idx]);
      }
    }

    const allWorkers = (await Promise.all(ngoIds.map(ngoId => getFroWorkersByNgo(ngoId)))).flat();
    const seen = new Set();
    const froWorkers = allWorkers.filter(w => { const k = w.id; if (seen.has(k)) return false; seen.add(k); return true; });

    let totalDonors = [];
    if (ngoNames.length > 0) {
      totalDonors = await getDonorProfilesByImportNgo(ngoNames, 100000);
    }

    const allAssignments = (await Promise.all(ngoIds.map(ngoId => findAssignmentsByNgo(ngoId)))).flat();
    const assignedCount = allAssignments.length;
    const collectedDonations = allAssignments.filter(a => a.status === 'donation_collected');

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

    const monthStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01';
    const achievedMap = {};
    const allTargets = (await Promise.all(ngoIds.map(ngoId => getTargetsByNgo(ngoId, monthStr)))).flat();
    for (const t of allTargets) {
      if (t.achieved_target != null) achievedMap[t.fro_worker_id] = parseFloat(t.achieved_target);
    }

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    // Batch all collection stats in a single query
    const workerIds = froWorkers.map(w => w.id);
    const batchStats = await getBatchCollectionStats(workerIds, monthStart, monthEnd, todayStart.toISOString(), todayEnd.toISOString(), ngoIds);

    let monthCollection = 0;
    for (const w of froWorkers) {
      const actual = batchStats.monthCollection[w.id] || 0;
      monthCollection += achievedMap[w.id] != null && achievedMap[w.id] > 0 ? achievedMap[w.id] : actual;
    }

    // Data used / unused (same logic as FRO dashboard)
    const connectedStatuses = new Set([
      'contacted', 'donation_collected', 'lead_done', 'follow_up', 'scheduled',
      'visit_donate', 'promise_to_pay', 'payment_pending', 'already_donated',
      'language_barrier', 'transferred_senior', 'query_complaint', 'receipt_request',
    ]);
    let dataUsed = 0, dataUnused = 0;
    for (const a of allAssignments) {
      if (a.status === 'reassigned') continue;
      if (connectedStatuses.has(a.status)) dataUsed++;
      else dataUnused++;
    }

    // Active donors: those who donated within the last 1 year
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const donorsWithRecentDonations = ngoIds.length > 0
      ? (await supabase
          .from('fro_donor_logs')
          .select('donor_id, fro_assignments!inner(ngo_id)')
          .in('fro_assignments.ngo_id', ngoIds)
          .or('action.eq.donation,and(disposition_detail.eq.lead_done,action.eq.disposition,accounts_status.eq.verified)')
          .gte('created_at', oneYearAgo.toISOString())).data || []
      : [];

    const activeDonorIds = new Set(donorsWithRecentDonations.map(d => d.donor_id).filter(Boolean));
    let activeDonors = 0, inactiveDonors = 0;
    for (const a of allAssignments) {
      if (a.status === 'reassigned') continue;
      if (activeDonorIds.has(a.donor_id)) {
        activeDonors++;
      } else {
        inactiveDonors++;
      }
    }

    let todayCollection = 0;
    for (const w of froWorkers) {
      todayCollection += batchStats.todayCollection[w.id] || 0;
    }

    let verifiedMonthAmount = 0, verifiedMonthCount = 0;
    let unverifiedMonthAmount = 0, unverifiedMonthCount = 0;
    let verifiedTodayAmount = 0, verifiedTodayCount = 0;
    let unverifiedTodayAmount = 0, unverifiedTodayCount = 0;
    for (const w of froWorkers) {
      const vm = batchStats.verifiedMonth[w.id] || { amount: 0, count: 0 };
      verifiedMonthAmount += vm.amount; verifiedMonthCount += vm.count;
      const um = batchStats.unverifiedMonth[w.id] || { amount: 0, count: 0 };
      unverifiedMonthAmount += um.amount; unverifiedMonthCount += um.count;
      const vt = batchStats.verifiedToday[w.id] || { amount: 0, count: 0 };
      verifiedTodayAmount += vt.amount; verifiedTodayCount += vt.count;
      const ut = batchStats.unverifiedToday[w.id] || { amount: 0, count: 0 };
      unverifiedTodayAmount += ut.amount; unverifiedTodayCount += ut.count;
    }

    // Reactivation metrics (same logic as FRO dashboard, scoped by NGO)
    const fyYear = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
    const fyStart = new Date(fyYear, 3, 1);

    const [fyDonorsRes, todayDonorsRes, monthDonorsRes] = ngoIds.length > 0
      ? await Promise.all([
          supabase.from('fro_donor_logs').select('donor_id, created_at, fro_assignments!inner(ngo_id)')
            .in('fro_assignments.ngo_id', ngoIds)
            .or('action.eq.donation,and(disposition_detail.eq.lead_done,action.eq.disposition)')
            .gte('created_at', fyStart.toISOString()),
          supabase.from('fro_donor_logs').select('donor_id, fro_assignments!inner(ngo_id)')
            .in('fro_assignments.ngo_id', ngoIds)
            .or('action.eq.donation,and(disposition_detail.eq.lead_done,action.eq.disposition)')
            .gte('created_at', todayStart.toISOString())
            .lte('created_at', todayEnd.toISOString()),
          supabase.from('fro_donor_logs').select('donor_id, fro_assignments!inner(ngo_id)')
            .in('fro_assignments.ngo_id', ngoIds)
            .or('action.eq.donation,and(disposition_detail.eq.lead_done,action.eq.disposition)')
            .gte('created_at', monthStart)
            .lte('created_at', monthEnd),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

    const todayStr = new Date().toISOString().slice(0, 10);
    const fyBeforeTodayDonors = new Set();
    const fyBeforeMonthDonors = new Set();
    for (const log of fyDonorsRes.data || []) {
      if (log.created_at < todayStr) fyBeforeTodayDonors.add(log.donor_id);
      if (log.created_at < monthStart) fyBeforeMonthDonors.add(log.donor_id);
    }

    const todayDonorSet = new Set((todayDonorsRes.data || []).map(l => l.donor_id).filter(Boolean));
    const monthDonorSet = new Set((monthDonorsRes.data || []).map(l => l.donor_id).filter(Boolean));

    const reactivatedToday = [...todayDonorSet].filter(id => !fyBeforeTodayDonors.has(id)).length;
    const reactivatedMonthly = [...monthDonorSet].filter(id => !fyBeforeMonthDonors.has(id)).length;

    // Attendance metrics
    const activeFroIds = froWorkers.filter(w => w.is_active !== false).map(w => w.id);
    let workersPresent = 0, workersAbsent = 0;
    if (activeFroIds.length > 0) {
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('status')
        .eq('date', todayStr)
        .in('worker_id', activeFroIds);
      workersPresent = (attendanceData || []).filter(a => a.status === 'present' || a.status === 'late').length;
      workersAbsent = (attendanceData || []).filter(a => a.status === 'absent').length;
    }
    const activeFroCount = froWorkers.filter(w => w.is_active !== false).length;
    const attendancePct = activeFroCount > 0 ? Math.round((workersPresent / activeFroCount) * 1000) / 10 : 0;

    const assignedWorkerIds = new Set(allAssignments.map(a => a.fro_worker_id).filter(Boolean));
    const assignedFroCount = assignedWorkerIds.size;

    const ngoIdToName = {};
    for (const a of access) ngoIdToName[a.ngo_id] = a.ngo_name;
    if (req.user.ngo_id && !ngoIdToName[req.user.ngo_id]) {
      const { data: ngo } = await supabase.from('ngos').select('name').eq('id', req.user.ngo_id).single();
      if (ngo) ngoIdToName[req.user.ngo_id] = ngo.name;
    }

    let stationsPerNgo = {};
    if (origNgoIds.length > 0) {
      const { data: stationAssigns } = await supabase
        .from('fro_station_assignments')
        .select('ngo_id')
        .in('ngo_id', origNgoIds);
      for (const sa of stationAssigns || []) {
        const name = ngoIdToName[sa.ngo_id] || 'Unknown';
        stationsPerNgo[name] = (stationsPerNgo[name] || 0) + 1;
      }
    }

    let daily_target = 0;
    const { data: workerRec } = await supabase
      .from('workers')
      .select('daily_collection_target')
      .eq('id', req.user.id)
      .maybeSingle();
    if (workerRec) daily_target = Number(workerRec.daily_collection_target) || 0;

    const totalDonorCount = totalDonors.length;
    const noMarkCount = Math.max(0, activeFroCount - workersPresent - workersAbsent);

    return res.json({
      ngos: origNgoNames,
      period: {
        month: now.toISOString().slice(0, 7),
        today: todayStr,
      },
      summary: {
        donors: {
          total: totalDonorCount,
          assigned: assignedCount,
          assigned_pct: totalDonorCount > 0 ? Math.round((assignedCount / totalDonorCount) * 100) : 0,
          collected: collectedDonations.length,
          active: activeDonors,
          inactive: inactiveDonors,
        },
        collection: {
          month: {
            total: monthCollection,
            verified: { amount: verifiedMonthAmount, count: verifiedMonthCount },
            unverified: { amount: unverifiedMonthAmount, count: unverifiedMonthCount },
          },
          today: {
            total: todayCollection,
            verified: { amount: verifiedTodayAmount, count: verifiedTodayCount },
            unverified: { amount: unverifiedTodayAmount, count: unverifiedTodayCount },
          },
          daily_target,
        },
        reactivations: {
          today: reactivatedToday,
          month: reactivatedMonthly,
        },
      },
      workers: {
        fro: {
          total: froWorkers.length,
          active: activeFroCount,
          with_assignments: assignedFroCount,
          assignment_coverage_pct: activeFroCount > 0 ? Math.round((assignedFroCount / activeFroCount) * 100) : 0,
        },
        attendance: {
          present: workersPresent,
          absent: workersAbsent,
          no_mark: noMarkCount,
          pct: attendancePct,
        },
      },
      assignments: {
        total: assignedCount,
        data_connected: dataUsed,
        data_unconnected: dataUnused,
        connect_rate_pct: assignedCount > 0 ? Math.round((dataUsed / assignedCount) * 100) : 0,
      },
      stations_per_ngo: stationsPerNgo,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getFroWiseCollection = async (req, res) => {
  try {
    const access = await getUserNgoAccess(req.user.id);
    const ngoNames = access.map(a => a.ngo_name).filter(Boolean);
    const ngoIds = access.map(a => a.ngo_id).filter(Boolean);

    if (ngoNames.length === 0 && req.user.ngo_id) {
      const { data: ngo } = await supabase.from('ngos').select('name').eq('id', req.user.ngo_id).single();
      if (ngo) ngoNames.push(ngo.name);
      if (req.user.ngo_id) ngoIds.push(req.user.ngo_id);
    }

    const allWorkers = (await Promise.all(ngoIds.map(ngoId => getFroWorkersByNgo(ngoId)))).flat();
    const seen = new Set();
    const froWorkers = allWorkers.filter(w => { const k = w.id; if (seen.has(k)) return false; seen.add(k); return true; });

    const period = req.query.period || 'month';
    const now = new Date();
    let startDate, endDate;

    if (period === 'today') {
      startDate = new Date(); startDate.setHours(0, 0, 0, 0);
      endDate = new Date(); endDate.setHours(23, 59, 59, 999);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    const achievedMap = {};
    if (period === 'month') {
      const monthStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01';
      const allTargets = (await Promise.all(ngoIds.map(ngoId => getTargetsByNgo(ngoId, monthStr)))).flat();
      for (const t of allTargets) {
        if (t.achieved_target != null) achievedMap[t.fro_worker_id] = parseFloat(t.achieved_target);
      }
    }

    const workerAmounts = await Promise.all(froWorkers.map(w =>
      getTotalCollectedByWorker(w.id, startDate.toISOString(), endDate.toISOString())
    ));
    const result = froWorkers.map((w, i) => {
      const amount = workerAmounts[i];
      const achieved = achievedMap[w.id];
      return {
        fro_id: w.id,
        fro_name: w.name || w.login_id || 'Unknown',
        collection_amount: achieved != null && achieved > 0 ? achieved : amount,
        ...(achieved != null && achieved > 0 ? { is_achieved: true } : {}),
      };
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getFroPerformance = async (req, res) => {
  try {
    const access = await getUserNgoAccess(req.user.id);
    const ngoNames = access.map(a => a.ngo_name).filter(Boolean);
    let ngoIds = access.map(a => a.ngo_id).filter(Boolean);

    if (ngoNames.length === 0 && req.user.ngo_id) {
      const { data: ngo } = await supabase.from('ngos').select('name').eq('id', req.user.ngo_id).single();
      if (ngo) { ngoNames.push(ngo.name); ngoIds.push(req.user.ngo_id); }
    }

    const { ngo_id: filterNgoId } = req.query;
    if (filterNgoId && filterNgoId !== 'all') {
      const idx = ngoIds.indexOf(filterNgoId);
      if (idx !== -1) { ngoIds.splice(0, ngoIds.length, ngoIds[idx]); }
    }

    if (ngoIds.length === 0) return res.json([]);

    const allWorkers = (await Promise.all(ngoIds.map(ngoId => getFroWorkersByNgo(ngoId)))).flat();
    const seen = new Set();
    const froWorkers = allWorkers.filter(w => { const k = w.id; if (seen.has(k)) return false; seen.add(k); return true; });

    const period = req.query.period || 'month';
    const now = new Date();
    let startDate, endDate;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    if (period === 'today') {
      startDate = todayStart;
      endDate = todayEnd;
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    const workerIds = froWorkers.map(w => w.id);
    const batchStats = await getBatchCollectionStats(workerIds, startDate.toISOString(), endDate.toISOString(), todayStart.toISOString(), todayEnd.toISOString(), ngoIds);

    const todayStr = now.toISOString().slice(0, 10);
    const attendanceMap = {};
    if (workerIds.length > 0) {
      if (period === 'today') {
        const { data: att } = await supabase.from('attendance').select('worker_id, status').eq('date', todayStr).in('worker_id', workerIds);
        for (const a of att || []) attendanceMap[a.worker_id] = a.status === 'present' || a.status === 'late' ? 100 : a.status === 'absent' ? 0 : null;
      } else {
        const monthStr = startDate.toISOString().slice(0, 7);
        const endStr = endDate.toISOString().slice(0, 10);
        const { data: att } = await supabase.from('attendance').select('worker_id, status').gte('date', monthStr + '-01').lte('date', endStr).in('worker_id', workerIds);
        const counts = {};
        for (const a of att || []) {
          if (!counts[a.worker_id]) counts[a.worker_id] = { present: 0, total: 0 };
          counts[a.worker_id].total++;
          if (a.status === 'present' || a.status === 'late') counts[a.worker_id].present++;
        }
        for (const [wid, c] of Object.entries(counts)) {
          attendanceMap[wid] = c.total > 0 ? Math.round((c.present / c.total) * 1000) / 10 : null;
        }
      }
    }

    const liveStatusMap = {};
    if (workerIds.length > 0) {
      const { data: live } = await supabase.from('fro_live_status').select('fro_worker_id, today_talk_seconds').in('fro_worker_id', workerIds);
      for (const l of live || []) liveStatusMap[l.fro_worker_id] = l.today_talk_seconds || 0;
    }

    const allAssignments = (await Promise.all(ngoIds.map(ngoId => findAssignmentsByNgo(ngoId)))).flat();
    const connectedStatuses = new Set(['contacted', 'donation_collected', 'lead_done', 'follow_up', 'scheduled', 'visit_donate', 'promise_to_pay', 'payment_pending', 'already_donated', 'language_barrier', 'transferred_senior', 'query_complaint', 'receipt_request']);
    const workerAssignments = {};
    for (const a of allAssignments) {
      if (a.status === 'reassigned') continue;
      if (!workerAssignments[a.fro_worker_id]) workerAssignments[a.fro_worker_id] = { connected: 0, total: 0 };
      workerAssignments[a.fro_worker_id].total++;
      if (connectedStatuses.has(a.status)) workerAssignments[a.fro_worker_id].connected++;
    }

    const performance = froWorkers.map(w => {
      const bs = batchStats;
      const coll = period === 'today' ? (bs.todayCollection[w.id] || 0) : (bs.monthCollection[w.id] || 0);
      const leads = period === 'today'
        ? (bs.verifiedToday[w.id]?.count || 0) + (bs.unverifiedToday[w.id]?.count || 0)
        : (bs.verifiedMonth[w.id]?.count || 0) + (bs.unverifiedMonth[w.id]?.count || 0);
      const talkSec = period === 'today' ? (liveStatusMap[w.id] || 0) : 0;
      const wa = workerAssignments[w.id] || { connected: 0, total: 0 };
      const attPct = attendanceMap[w.id] != null ? attendanceMap[w.id] : null;
      return {
        fro_id: w.id,
        fro_name: w.name || w.login_id || 'Unknown',
        collection_amount: coll,
        lead_done_count: leads,
        avg_talk_seconds: talkSec,
        data_used: wa.connected,
        data_total: wa.total,
        attendance_pct: attPct,
      };
    });

    const maxColl = Math.max(...performance.map(p => p.collection_amount), 1);
    const maxLeads = Math.max(...performance.map(p => p.lead_done_count), 1);
    const maxTalk = Math.max(...performance.map(p => p.avg_talk_seconds), 1);
    const maxData = Math.max(...performance.map(p => p.data_used), 1);

    const scored = performance.map(p => ({
      ...p,
      score: Math.round((
        (p.collection_amount / maxColl) * 0.30 +
        (p.lead_done_count / maxLeads) * 0.25 +
        (p.avg_talk_seconds / maxTalk) * 0.15 +
        (p.data_used / maxData) * 0.15 +
        ((p.attendance_pct != null ? p.attendance_pct : 0) / 100) * 0.15
      ) * 100) / 100,
    }));

    scored.sort((a, b) => a.score - b.score);
    return res.json(scored.slice(0, 6));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const setAchievedTarget = async (req, res) => {
  try {
    const { fro_worker_id, month, achieved_amount } = req.body;
    const ngoIds = await getUserNgoIds(req.user);
    const ngoId = ngoIds[0];

    if (!fro_worker_id || !month || achieved_amount === undefined) {
      return res.status(400).json({ message: 'fro_worker_id, month, and achieved_amount are required' });
    }
    if (!ngoId) {
      return res.status(400).json({ message: 'No NGO assigned to your account' });
    }

    const result = await updateAchievedTarget(fro_worker_id, ngoId, month + '-01', parseFloat(achieved_amount) || 0);

    return res.json({ message: 'Achieved target saved successfully', data: result });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const setIncentive = async (req, res) => {
  try {
    const { fro_worker_id, month, incentive_amount } = req.body;
    const ngoIds = await getUserNgoIds(req.user);
    const ngoId = ngoIds[0];

    if (!fro_worker_id || !month) {
      return res.status(400).json({ message: 'fro_worker_id and month are required' });
    }
    if (!ngoId) {
      return res.status(400).json({ message: 'No NGO assigned to your account' });
    }

    const amount = incentive_amount != null && incentive_amount !== '' ? parseFloat(incentive_amount) : null;
    const result = await updateIncentive(fro_worker_id, ngoId, month + '-01', amount);

    return res.json({ message: 'Incentive saved successfully', data: result });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ---- Accounts Panel ----

export const getAccountsPending = async (req, res) => {
  try {
    const { status } = req.query;
    const statusFilter = status || 'pending';

    const { data, error } = await supabase
      .from('fro_donor_logs')
      .select(`
        id, action, disposition_category, disposition_detail, amount_collected,
        payment_screenshot_url, accounts_status, pan_number, notes, remark, created_at,
        assignment_id,
        fro_assignments!inner(
          id,
          donor_id,
          fro_worker_id,
          status,
          donor_profiles!inner(id, name, mobile_number, city, pan_number),
          workers!inner(id, name, login_id)
        )
      `)
      .eq('action', 'disposition')
      .eq('disposition_detail', 'lead_done')
      .eq('accounts_status', statusFilter)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const result = (data || []).map(r => ({
      log_id: r.id,
      amount: r.amount_collected,
      screenshot_url: r.payment_screenshot_url,
      accounts_status: r.accounts_status,
      pan_number: r.pan_number,
      notes: r.notes,
      remark: r.remark,
      created_at: r.created_at,
      assignment_id: r.assignment_id,
      assignment_status: r.fro_assignments?.status || 'lead_done',
      donor_id: r.fro_assignments?.donor_id,
      donor_name: r.fro_assignments?.donor_profiles?.name || 'Unknown',
      donor_mobile: r.fro_assignments?.donor_profiles?.mobile_number || '',
      donor_city: r.fro_assignments?.donor_profiles?.city || '',
      donor_pan: r.fro_assignments?.donor_profiles?.pan_number || '',
      worker_id: r.fro_assignments?.fro_worker_id,
      worker_name: r.fro_assignments?.workers?.name || 'Unknown',
      worker_login: r.fro_assignments?.workers?.login_id || '',
    }));

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const verifyLeadDone = async (req, res) => {
  try {
    const { logId } = req.params;
    const { pan_number, notes } = req.body;

    const { data: log, error: logError } = await supabase
      .from('fro_donor_logs')
      .select('*, fro_assignments!inner(id, fro_worker_id, donor_id, status, donor_profiles!inner(id, name, mobile_number))')
      .eq('id', logId)
      .single();

    if (logError || !log) {
      return res.status(404).json({ message: 'Log entry not found' });
    }

    if (log.accounts_status !== 'pending') {
      return res.status(400).json({ message: `This lead has already been ${log.accounts_status || 'processed'}` });
    }

    const assignmentId = log.fro_assignments?.id;
    if (!assignmentId) {
      return res.status(400).json({ message: 'Associated assignment not found' });
    }

    // Update log: verified
    const { error: updateLogError } = await supabase
      .from('fro_donor_logs')
      .update({
        accounts_status: 'verified',
        verified_at: new Date().toISOString(),
        verified_by: req.user.id,
        pan_number: pan_number || log.pan_number || null,
        notes: notes || log.notes || null,
      })
      .eq('id', logId);

    if (updateLogError) throw updateLogError;

    // Update assignment: donation_collected
    const { error: updateAsgnError } = await supabase
      .from('fro_assignments')
      .update({
        status: 'donation_collected',
        last_contacted_at: new Date().toISOString(),
      })
      .eq('id', assignmentId);

    if (updateAsgnError) throw updateAsgnError;

    return res.json({ message: 'Lead verified, amount added to target' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ---- Station Management ----

export const getStations = async (req, res) => {
  try {
    const { ngo_id } = req.query;

    let targetNgoIds;
    if (ngo_id) {
      targetNgoIds = [ngo_id];
    } else {
      const access = await getUserNgoAccess(req.user.id);
      targetNgoIds = access.map(a => a.ngo_id).filter(Boolean);
      if (targetNgoIds.length === 0 && req.user.ngo_id) {
        targetNgoIds.push(req.user.ngo_id);
      }
      if (targetNgoIds.length === 0) return res.json([]);
    }

    // Get all station assignments (including unassigned)
    const assignments = await getStationAssignmentsByNgo(targetNgoIds, true);

    // Get donor counts per station from fro_assignments
    const { data: faData, error: faErr } = await supabase
      .from('fro_assignments')
      .select('station, ngo_id, fro_worker_id')
      .in('ngo_id', targetNgoIds)
      .not('station', 'is', null)
      .not('status', 'eq', 'reassigned');

    if (faErr) throw faErr;

    // Build total donor count per station (across all NGOs) and per-FRO count
    const totalDonorCount = {};
    const froDonorCount = {};
    for (const d of faData || []) {
      const s = d.station.trim();
      totalDonorCount[s] = (totalDonorCount[s] || 0) + 1;
      if (d.fro_worker_id) {
        const key = `${s}_${d.fro_worker_id}`;
        froDonorCount[key] = (froDonorCount[key] || 0) + 1;
      }
    }

    const ngoIdToName = {};
    if (ngo_id) {
      const { data: ngo } = await supabase.from('ngos').select('name').eq('id', ngo_id).single();
      if (ngo) ngoIdToName[ngo_id] = ngo.name;
    } else {
      const access = await getUserNgoAccess(req.user.id);
      for (const a of access) {
        ngoIdToName[a.ngo_id] = a.ngo_name;
      }
      if (req.user.ngo_id && !ngoIdToName[req.user.ngo_id]) {
        const { data: ngo } = await supabase.from('ngos').select('name').eq('id', req.user.ngo_id).single();
        if (ngo) ngoIdToName[req.user.ngo_id] = ngo.name;
      }
    }

    // Group by station name — one row per station
    const stationMap = {};

    for (const a of assignments) {
      const s = a.station.trim();
      if (!stationMap[s]) {
        stationMap[s] = {
          station: s,
          ngos: [],
          fro_worker_id: a.fro_worker_id || null,
          fro_worker_name: a.workers?.name || null,
        };
      }
      stationMap[s].ngos.push({
        ngo_id: a.ngo_id,
        ngo_name: ngoIdToName[a.ngo_id] || 'Unknown',
        assignment_id: a.id,
      });
      // Update FRO if this assignment has one (first non-null wins)
      if (!stationMap[s].fro_worker_id && a.fro_worker_id) {
        stationMap[s].fro_worker_id = a.fro_worker_id;
        stationMap[s].fro_worker_name = a.workers?.name || null;
      }
    }

    // Also add stations from donor_profiles not in fro_station_assignments
    for (const s of Object.keys(totalDonorCount)) {
      if (!stationMap[s]) {
        stationMap[s] = {
          station: s,
          ngos: [],
          fro_worker_id: null,
          fro_worker_name: null,
        };
      }
    }

    const result = Object.values(stationMap).map(s => ({
      ...s,
      donor_count: totalDonorCount[s.station] || 0,
      fro_donor_count: s.fro_worker_id ? (froDonorCount[`${s.station}_${s.fro_worker_id}`] || 0) : 0,
    }));

    result.sort((a, b) => {
      const parseStation = (s) => {
        const idx = s.lastIndexOf('-');
        if (idx === -1) return [s, 0];
        const prefix = s.slice(0, idx);
        const num = parseInt(s.slice(idx + 1), 10);
        return [prefix, isNaN(num) ? 0 : num];
      };
      const [pA, nA] = parseStation(a.station);
      const [pB, nB] = parseStation(b.station);
      if (pA !== pB) return pA.localeCompare(pB);
      return nA - nB;
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const saveStationAssignment = async (req, res) => {
  try {
    const { station, fro_worker_id } = req.body;
    if (!station) {
      return res.status(400).json({ message: 'station is required' });
    }

    const trimmedStation = station.trim();
    const access = await getUserNgoAccess(req.user.id);
    const ngoNames = access.map(a => a.ngo_name).filter(Boolean);
    const ngoIds = access.map(a => a.ngo_id).filter(Boolean);

    if (ngoNames.length === 0 && req.user.ngo_id) {
      const { data: ngo } = await supabase.from('ngos').select('name').eq('id', req.user.ngo_id).single();
      if (ngo) { ngoNames.push(ngo.name); ngoIds.push(req.user.ngo_id); }
    }

    let ngoId;
    if (ngoNames.length > 0) {
      const { data: donorStation } = await supabase
        .from('donor_profiles')
        .select('ngo')
        .eq('station', trimmedStation)
        .in('ngo', ngoNames)
        .limit(1)
        .maybeSingle();

      if (donorStation) {
        const idx = ngoNames.indexOf(donorStation.ngo);
        if (idx !== -1) ngoId = ngoIds[idx];
      }
    }

    if (!ngoId) ngoId = ngoIds[0] || req.user.ngo_id || null;
    if (!ngoId) return res.status(400).json({ message: 'No NGO assigned to your account' });

    const result = await upsertStationAssignment(fro_worker_id || null, ngoId, trimmedStation, req.user.id);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const removeStationAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    await deleteStationAssignment(id);
    return res.json({ message: 'Station assignment removed' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const removeStationByName = async (req, res) => {
  try {
    const { station } = req.params;
    const { error } = await supabase
      .from('fro_station_assignments')
      .delete()
      .eq('station', station.trim());
    if (error) throw error;

    return res.json({ message: 'Station deleted' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const createStationHandler = async (req, res) => {
  try {
    const { station, ngo_id } = req.body;
    if (!station) {
      return res.status(400).json({ message: 'station name is required' });
    }

    const stationName = station.trim();

    const { data: existing } = await supabase
      .from('fro_station_assignments')
      .select('id')
      .eq('station', stationName)
      .eq('ngo_id', ngo_id || null)
      .maybeSingle();
    if (existing) {
      return res.json({ message: 'already exists' });
    }

    const { data, error } = await supabase
      .from('fro_station_assignments')
      .insert([{ station: stationName, ngo_id: ngo_id || null, assigned_by: req.user.id }])
      .select();
    if (error) throw error;
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateStationNgos = async (req, res) => {
  try {
    const { station } = req.params;
    const { ngo_id, fro_worker_id } = req.body;

    const access = await getUserNgoAccess(req.user.id);
    const allowedNgoIds = new Set(access.map(a => a.ngo_id));

    // Verify the NGO is accessible
    const validNgoId = ngo_id && allowedNgoIds.has(ngo_id) ? ngo_id : null;

    // Delete all existing rows for this station (including null-ngo)
    const { error: delErr } = await supabase
      .from('fro_station_assignments')
      .delete()
      .eq('station', station.trim());
    if (delErr) throw delErr;

    // Insert single assignment
    const { error: insErr } = await supabase
      .from('fro_station_assignments')
      .insert([{
        station: station.trim(),
        ngo_id: validNgoId,
        assigned_by: req.user.id,
        fro_worker_id: fro_worker_id || null,
      }]);
    if (insErr) throw insErr;

    return res.json({ message: 'Station updated' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const reassignStationFro = async (req, res) => {
  try {
    const { id } = req.params;
    const { fro_worker_id } = req.body;
    if (!fro_worker_id) {
      return res.status(400).json({ message: 'fro_worker_id is required' });
    }

    const access = await getUserNgoAccess(req.user.id);
    const ngoIds = access.map(a => a.ngo_id).filter(Boolean);
    const ngoId = ngoIds[0] || req.user.ngo_id;
    if (!ngoId) return res.status(400).json({ message: 'No NGO assigned' });

    // Get station info
    const { data: stationAssign } = await supabase
      .from('fro_station_assignments')
      .select('station')
      .eq('id', id)
      .single();
    if (!stationAssign) return res.status(404).json({ message: 'Station assignment not found' });

    const ngoNames = access.map(a => a.ngo_name).filter(Boolean);
    const ngoName = ngoNames[0] || stationAssign.ngo_id;

    // Update station assignment
    await upsertStationAssignment(fro_worker_id, ngoId, stationAssign.station, req.user.id);

    // Reassign donors in this station
    const { reassignStationDonors } = await import('../models/froAssignmentModel.js');
    const newAssignments = await reassignStationDonors(ngoId, ngoName, stationAssign.station, fro_worker_id, req.user.id);

    return res.json({
      message: `Station reassigned. ${newAssignments.length} donors assigned to new FRO.`,
      count: newAssignments.length,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getStationStats = async (req, res) => {
  try {
    const access = await getUserNgoAccess(req.user.id);
    const ngoNames = access.map(a => a.ngo_name).filter(Boolean);
    const ngoIds = access.map(a => a.ngo_id).filter(Boolean);

    if (ngoNames.length === 0 && req.user.ngo_id) {
      const { data: ngo } = await supabase.from('ngos').select('name').eq('id', req.user.ngo_id).single();
      if (ngo) { ngoNames.push(ngo.name); ngoIds.push(req.user.ngo_id); }
    }

    const { ngo_id: filterNgoId, from, to } = req.query;
    if (filterNgoId && filterNgoId !== 'all') {
      const idx = ngoIds.indexOf(filterNgoId);
      if (idx !== -1) {
        ngoNames.splice(0, ngoNames.length, ngoNames[idx]);
        ngoIds.splice(0, ngoIds.length, ngoIds[idx]);
      }
    }

    if (ngoIds.length === 0) return res.json({ stations: {}, summary: {} });

    const stationMap = {};
    const summary = {};

    const allStats = await Promise.all(ngoIds.map(ngoId => getStationDispositionStats(ngoId, from, to)));
    for (const stats of allStats) {
      for (const [station, statuses] of Object.entries(stats)) {
        if (!stationMap[station]) stationMap[station] = {};
        for (const [status, count] of Object.entries(statuses)) {
          stationMap[station][status] = (stationMap[station][status] || 0) + count;
          summary[status] = (summary[status] || 0) + count;
        }
      }
    }

    // Get all stations for this NGO (including empty ones)
    const stationAssigns = await getStationAssignmentsByNgo(ngoIds);
    for (const sa of stationAssigns) {
      if (!stationMap[sa.station]) {
        stationMap[sa.station] = {};
      }
    }

    return res.json({ stations: stationMap, summary });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};



export const getDonorsByStation = async (req, res) => {
  try {
    const { station, status } = req.query;
    if (!station) {
      return res.status(400).json({ message: 'station query param is required' });
    }

    const access = await getUserNgoAccess(req.user.id);
    const ngoIds = access.map(a => a.ngo_id).filter(Boolean);

    if (ngoIds.length === 0 && req.user.ngo_id) {
      ngoIds.push(req.user.ngo_id);
    }

    if (ngoIds.length === 0) {
      return res.json([]);
    }

    const allDonors = [];
    for (const ngoId of ngoIds) {
      const donors = await getDonorsByStationAndStatus(ngoId, station, status || null);
      allDonors.push(...donors);
    }

    const seen = new Set();
    const unique = allDonors.filter(a => { const k = a.id; if (seen.has(k)) return false; seen.add(k); return true; });

    const result = unique.map(a => ({
      id: a.id,
      donor_id: a.donor_id,
      donor_mobile: a.donor_profiles?.mobile_number || '',
      donor_name: a.donor_profiles?.name || 'Unknown',
      donor_city: a.donor_profiles?.city || '',
      fro_worker_id: a.fro_worker_id,
      fro_name: a.workers?.name || 'Unassigned',
      status: a.status,
      notes: a.notes || '',
      last_contacted_at: a.last_contacted_at,
      next_follow_up: a.next_follow_up,
      assigned_at: a.assigned_at,
    }));

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getNewData = async (req, res) => {
  try {
    const access = await getUserNgoAccess(req.user.id);
    let ngoNames = access.map(a => a.ngo_name).filter(Boolean);
    let ngoIds = access.map(a => a.ngo_id).filter(Boolean);

    if (ngoNames.length === 0 && req.user.ngo_id) {
      const { data: ngo } = await supabase.from('ngos').select('name').eq('id', req.user.ngo_id).single();
      if (ngo) { ngoNames = [ngo.name]; ngoIds = [req.user.ngo_id]; }
    }

    const { ngo_id: filterNgoId, page: pageStr, per_page: perPageStr } = req.query;
    const pageNum = Math.max(1, parseInt(pageStr) || 1);
    const perPage = Math.min(5000, Math.max(10, parseInt(perPageStr) || 500));

    if (filterNgoId && filterNgoId !== 'all') {
      const idx = ngoIds.indexOf(filterNgoId);
      if (idx !== -1) {
        const name = ngoNames[idx];
        ngoIds.splice(0, ngoIds.length, ngoIds[idx]);
        ngoNames.splice(0, ngoNames.length, name);
      }
    }

    if (ngoNames.length === 0) {
      return res.json({ unassigned: [], ngo_data: [], total: 0, page: pageNum, per_page: perPage });
    }

    // 1. new_data for admin's NGOs that are still pending conversion
    const { data: importedRows, error: iErr } = await supabase
      .from('new_data')
      .select('name, mobile_number, category, amount, created_at, ngo')
      .in('ngo', ngoNames)
      .not('mobile_number', 'is', null)
      .or('status.eq.pending,status.is.null')
      .order('created_at', { ascending: false })
      .limit(1000000);

    if (iErr) throw iErr;

    let unassigned = [];
    if (importedRows && importedRows.length > 0) {
      const latest = {};
      for (const row of importedRows) {
        const key = `${row.mobile_number}||${row.ngo}`;
        if (!latest[key]) latest[key] = row;
      }
      const entries = Object.values(latest);
      const mobiles = [...new Set(entries.map(e => e.mobile_number))];

      // Safety check: also exclude if donor_profile already exists (backward compat)
      // Batch into groups of 500 to avoid Cloudflare 414 URI too large
      const existingMobiles = new Set();
      const BATCH_SIZE = 500;
      for (let i = 0; i < mobiles.length; i += BATCH_SIZE) {
        const batch = mobiles.slice(i, i + BATCH_SIZE);
        const { data: profiles } = await supabase
          .from('donor_profiles')
          .select('mobile_number')
          .in('mobile_number', batch);
        (profiles || []).forEach(p => existingMobiles.add(p.mobile_number));
      }
      unassigned = entries.filter(e => !existingMobiles.has(e.mobile_number));
    }

    // 2. NGO's donor_profiles not yet FRO-assigned
    let ngoData = [];
    const { data: ngoProfiles, error: npErr } = await supabase
      .from('donor_profiles')
      .select('id, name, mobile_number, category, amount, first_imported_at, ngo')
      .in('ngo', ngoNames)
      .order('first_imported_at', { ascending: false });

    if (npErr) throw npErr;

    if (ngoProfiles && ngoProfiles.length > 0) {
      const profileIds = ngoProfiles.map(p => p.id);
      const { data: froAsgn } = await supabase
        .from('fro_assignments')
        .select('donor_id')
        .in('donor_id', profileIds);

      const assignedIds = new Set(froAsgn ? froAsgn.map(a => a.donor_id) : []);
      ngoData = ngoProfiles.filter(p => !assignedIds.has(p.id)).map(p => ({
        ...p,
        created_at: p.first_imported_at,
      }));
    }

    const total = unassigned.length;
    const start = (pageNum - 1) * perPage;
    const pagedUnassigned = unassigned.slice(start, start + perPage);

    return res.json({ unassigned: pagedUnassigned, ngo_data: ngoData, total, page: pageNum, per_page: perPage });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};



export const distributeNewData = async (req, res) => {
  try {
    const { stations: selectedStations, ngo_id: filterNgoId } = req.body;
    let access = await getUserNgoAccess(req.user.id);
    let ngoEntries = access.map(a => ({ ngoId: a.ngo_id, ngoName: a.ngo_name })).filter(e => e.ngoId);
    if (ngoEntries.length === 0 && req.user.ngo_id) {
      const { data: ngo } = await supabase.from('ngos').select('name').eq('id', req.user.ngo_id).single();
      if (ngo) ngoEntries.push({ ngoId: req.user.ngo_id, ngoName: ngo.name });
    }
    // Filter to specific NGO if provided
    if (filterNgoId) {
      ngoEntries = ngoEntries.filter(e => e.ngoId === filterNgoId);
    }
    if (ngoEntries.length === 0) {
      return res.json({ message: 'No NGO assigned to your account', count: 0 });
    }
    console.log('--- distributeNewData start ---');
    console.log('ngoEntries:', JSON.stringify(ngoEntries));

    let totalAssigned = 0;
    let totalConverted = 0;
    let skippedNgos = [];
    const messages = [];

    for (const { ngoId, ngoName } of ngoEntries) {
      try {
      console.log(`[${ngoName}] === Processing NGO: ${ngoName} (id=${ngoId}) ===`);
      // Step 1: Create donor_profiles from new_data
      const { data: importedRows, error: irErr } = await supabase
        .from('new_data')
        .select('name, mobile_number, category, amount')
        .eq('ngo', ngoName)
        .not('mobile_number', 'is', null)
        .order('created_at', { ascending: false });
      console.log(`[${ngoName}] importedRows count:`, importedRows?.length, 'error:', irErr);

      let newProfileIds = [];
      let allMobiles = [];
      if (importedRows && importedRows.length > 0) {
        const latest = {};
        for (const row of importedRows) {
          if (!latest[row.mobile_number]) latest[row.mobile_number] = row;
        }
        const mobiles = Object.keys(latest);

        // Batch existing profile check to avoid 414
        const existingMap = {};
        const BATCH = 500;
        for (let i = 0; i < mobiles.length; i += BATCH) {
          const batch = mobiles.slice(i, i + BATCH);
          const { data: profiles } = await supabase
            .from('donor_profiles')
            .select('id, mobile_number')
            .in('mobile_number', batch);
          for (const p of profiles || []) existingMap[p.mobile_number] = p.id;
        }

        const toInsert = [];
        for (const mobile of mobiles) {
          if (!existingMap[mobile]) {
            const row = latest[mobile];
            toInsert.push({
              mobile_number: mobile,
              name: row.name || null,
              category: row.category || '',
              amount: parseFloat(row.amount) || 0,
              total_amount: parseFloat(row.amount) || 0,
              donation_count: 1,
              ngo: ngoName,
            });
          }
        }

        if (toInsert.length > 0) {
          const { data: newProfiles } = await supabase
            .from('donor_profiles')
            .insert(toInsert)
            .select('id');
          newProfileIds = (newProfiles || []).map(p => p.id);
          totalConverted += toInsert.length;
          messages.push(`${toInsert.length} new donors converted to profiles (${ngoName})`);
        }
        allMobiles = mobiles;
      }

      // Step 2: Determine which stations to use
      const stationAssigns = await getStationAssignmentsByNgo([ngoId]);
      console.log(`[${ngoName}] stationAssigns:`, stationAssigns.length, stationAssigns.map(s => s.station).join(', '), 'fro_ids:', stationAssigns.map(s => s.fro_worker_id).join(','));

      let targetStations;
      if (selectedStations && selectedStations.length > 0) {
        targetStations = stationAssigns.filter(sa => selectedStations.includes(sa.station));
        console.log(`[${ngoName}] filtered by selectedStations:`, targetStations.length);
      } else {
        targetStations = stationAssigns;
      }

      // If no stations exist, auto-create U-stations based on active FROs
      if (targetStations.length === 0) {
        const allFroWorkers = await getFroWorkersByNgo(ngoId);
        const activeWorkers = allFroWorkers.filter(w => w.is_active !== false);
        console.log(`[${ngoName}] no stations, FRO workers:`, activeWorkers.length);
        if (activeWorkers.length === 0) {
          console.log(`[${ngoName}] SKIP — no active FRO workers`);
          skippedNgos.push(ngoName);
          continue;
        }
        for (let i = 0; i < activeWorkers.length; i++) {
          await upsertStationAssignment(activeWorkers[i].id, ngoId, `U-${i + 1}`, req.user.id);
        }
        targetStations = await getStationAssignmentsByNgo([ngoId]);
      }

      if (targetStations.length === 0) {
        console.log(`[${ngoName}] SKIP — targetStations still empty`);
        skippedNgos.push(ngoName);
        continue;
      }
      console.log(`[${ngoName}] targetStations:`, targetStations.length, targetStations.map(s => s.station).join(', '));

      // Step 3: Find unassigned donor profiles for this NGO
      let existingProfileIds = [];
      if (allMobiles.length > 0) {
        const BATCH = 500;
        for (let i = 0; i < allMobiles.length; i += BATCH) {
          const batch = allMobiles.slice(i, i + BATCH);
          const { data: profiles } = await supabase
            .from('donor_profiles')
            .select('id')
            .in('mobile_number', batch);
          if (profiles) existingProfileIds.push(...profiles.map(p => p.id));
        }
      }
      const allIds = [...new Set([...newProfileIds, ...existingProfileIds])];
      console.log(`[${ngoName}] newProfileIds:`, newProfileIds.length, 'existingProfileIds:', existingProfileIds.length, 'allIds:', allIds.length);
      if (allIds.length === 0) { console.log(`[${ngoName}] SKIP — allIds empty`); continue; }

      const { data: froAsgn } = await supabase
        .from('fro_assignments')
        .select('donor_id')
        .in('donor_id', allIds)
        .eq('ngo_id', ngoId)
        .not('status', 'eq', 'reassigned');

      const assignedSet = new Set(froAsgn ? froAsgn.map(a => a.donor_id) : []);
      let unassignedIds = allIds.filter(id => !assignedSet.has(id));
      console.log(`[${ngoName}] alreadyAssigned:`, assignedSet.size, 'unassignedIds:', unassignedIds.length);
      if (unassignedIds.length === 0) { console.log(`[${ngoName}] SKIP — all already assigned`); continue; }

      // Step 4: Assign stations round-robin to unassigned donors
      const shuffled = [...unassignedIds].sort(() => Math.random() - 0.5);
      const base = Math.floor(shuffled.length / targetStations.length);
      const remainder = shuffled.length % targetStations.length;

      const stationNames = targetStations.map(sa => sa.station);
      const stationFroMap = {};
      for (const sa of targetStations) {
        stationFroMap[sa.station] = sa.fro_worker_id;
      }

      const donorStationMap = {};
      let donorIdx = 0;
      for (let i = 0; i < targetStations.length; i++) {
        const count = base + (i < remainder ? 1 : 0);
        for (let j = 0; j < count; j++) {
          donorStationMap[shuffled[donorIdx++]] = stationNames[i];
        }
      }

      // Step 5: Create FRO assignments for each donor (with station, even if no FRO)
      const newAssignments = [];
      for (const [donorId, station] of Object.entries(donorStationMap)) {
        const workerId = stationFroMap[station];
        newAssignments.push({
          donor_id: parseInt(donorId),
          fro_worker_id: workerId || null,
          ngo_id: ngoId,
          station: station,
          assigned_by: req.user.id,
          status: 'pending',
          assigned_at: new Date().toISOString(),
        });
      }

      if (newAssignments.length > 0) {
        console.log(`[${ngoName}] creating ${newAssignments.length} fro_assignments`);
        await batchCreateAssignments(newAssignments);
        totalAssigned += newAssignments.length;
        // Mark as converted only AFTER assignments succeed
        if (allMobiles.length > 0) {
          await updateNewDataStatusByNgoAndMobiles(ngoName, allMobiles, 'converted');
        }
        console.log(`[${ngoName}] batchCreateAssignments OK`);
      } else {
        console.log(`[${ngoName}] no newAssignments to create`);
      }

      const stationCounts = {};
      for (const st of Object.values(donorStationMap)) {
        stationCounts[st] = (stationCounts[st] || 0) + 1;
      }
      const perStation = Object.entries(stationCounts)
        .map(([st, cnt]) => `${cnt} → ${st}`)
        .join(', ');
      messages.push(`Distributed ${Object.keys(donorStationMap).length} donors: ${perStation} (${ngoName})`);
      console.log(`[${ngoName}] DONE — ${Object.keys(donorStationMap).length} donors distributed`);
      } catch (err) {
        console.error(`[${ngoName}] distribution error:`, err.message);
        messages.push(`Error for ${ngoName}: ${err.message}`);
      }
    }

    console.log('--- distributeNewData end ---');
    console.log('messages:', messages.join('; '));
    console.log('skippedNgos:', skippedNgos);
    let finalMessage = messages.join('; ');
    if (skippedNgos.length > 0) {
      finalMessage += `; ${skippedNgos.join(', ')} skipped (no stations).`;
    }

    if (totalConverted === 0 && totalAssigned === 0) {
      return res.json({ message: 'No unassigned data found for your NGOs', count: 0 });
    }
    return res.json({ message: finalMessage, count: totalAssigned, converted: totalConverted });
  } catch (error) {
    console.error('distributeNewData ERROR:', error);
    return res.status(500).json({ message: error.message });
  }
};

export const getAlerts = async (req, res) => {
  try {
    const ngoIds = await getUserNgoIds(req.user);
    if (ngoIds.length === 0) return res.json({ alerts: [] });

    const { ngo_id: filterNgoId } = req.query;
    if (filterNgoId && filterNgoId !== 'all') {
      const idx = ngoIds.indexOf(filterNgoId);
      if (idx !== -1) {
        ngoIds.splice(0, ngoIds.length, ngoIds[idx]);
      }
    }

    const results = [];
    const workerNameMap = {};
    const allWorkerIds = new Set();

    for (const ngoId of ngoIds) {
      const workers = await getFroWorkersByNgo(ngoId);
      for (const w of workers) {
        workerNameMap[w.id] = w.name || 'Unknown';
        allWorkerIds.add(w.id);
      }
    }

    if (allWorkerIds.size > 0) {
      const { data: requests } = await supabase
        .from('fro_data_requests')
        .select('*')
        .in('fro_worker_id', [...allWorkerIds])
        .order('created_at', { ascending: false })
        .limit(100);
      if (requests) {
        for (const r of requests) {
          results.push({
            id: `dr_${r.id}`,
            type: 'data_request',
            title: 'Data Request',
            description: r.message,
            fro_name: workerNameMap[r.fro_worker_id] || 'Unknown',
            created_at: r.created_at,
            acknowledged: r.status !== 'pending',
          });
        }
      }
    }

    try {
      const { data: alerts } = await supabase
        .from('alerts')
        .select('*')
        .in('ngo_id', ngoIds)
        .order('created_at', { ascending: false })
        .limit(100);
      if (alerts) results.push(...alerts);
    } catch (_) {}

    results.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    return res.json({ alerts: results.slice(0, 100) });
  } catch (error) {
    return res.json({ alerts: [] });
  }
};

export const getRejectedLeads = async (req, res) => {
  try {
    const ngoIds = await getUserNgoIds(req.user);
    if (ngoIds.length === 0) return res.json([]);

    const { ngo_id: filterNgoId } = req.query;
    if (filterNgoId && filterNgoId !== 'all') {
      const idx = ngoIds.indexOf(filterNgoId);
      if (idx !== -1) {
        ngoIds.splice(0, ngoIds.length, ngoIds[idx]);
      }
    }

    let data = [];
    try {
      const result = await supabase
        .from('rejected_lead_tickets')
        .select('*')
        .in('ngo_id', ngoIds)
        .order('created_at', { ascending: false })
        .limit(200);
      if (result.error) throw result.error;
      data = result.data || [];
    } catch (dbErr) {
      console.error('rejected_lead_tickets query failed:', dbErr.message);
      return res.json([]);
    }

    const workerIds = [...new Set(data.map(t => t.fro_worker_id).filter(Boolean))];
    const workerMap = {};
    if (workerIds.length > 0) {
      const { data: workers, error: wErr } = await supabase.from('workers').select('id, name').in('id', workerIds);
      if (wErr) { console.error('workers query failed:', wErr.message); }
      else if (workers) for (const w of workers) workerMap[w.id] = w.name;
    }

    const result = data.map(t => ({ ...t, fro_name: workerMap[t.fro_worker_id] || 'Unknown' }));
    return res.json(result);
  } catch (error) {
    console.error('getRejectedLeads error:', error);
    return res.json([]);
  }
};

export const acknowledgeRejectedLead = async (req, res) => {
  try {
    const { id } = req.params;
    const ngoIds = await getUserNgoIds(req.user);

    let ticket;
    try {
      const result = await supabase
        .from('rejected_lead_tickets')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (result.error) throw result.error;
      ticket = result.data;
    } catch (dbErr) {
      console.error('rejected_lead_tickets query failed:', dbErr.message);
      return res.status(404).json({ message: 'Ticket not found' });
    }

    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    if (!ngoIds.includes(ticket.ngo_id)) return res.status(403).json({ message: 'Access denied' });

    await supabase
      .from('rejected_lead_tickets')
      .update({ status: 'acknowledged', reviewed_by: req.user.id, reviewed_at: new Date().toISOString() })
      .eq('id', id);

    return res.json({ message: 'Ticket acknowledged' });
  } catch (error) {
    console.error('acknowledgeRejectedLead error:', error.message);
    return res.status(500).json({ message: error.message });
  }
};

export const acknowledgeAlert = async (req, res) => {
  try {
    const rawId = req.params.id;
    const ngoIds = await getUserNgoIds(req.user);

    if (typeof rawId === 'string' && rawId.startsWith('dr_')) {
      const realId = parseInt(rawId.replace('dr_', ''));
      const { data: reqData, error: reqErr } = await supabase
        .from('fro_data_requests')
        .select('id, fro_worker_id')
        .eq('id', realId)
        .maybeSingle();
      if (reqErr || !reqData) return res.status(404).json({ message: 'Request not found' });

      const { data: worker } = await supabase
        .from('workers')
        .select('ngo_id')
        .eq('id', reqData.fro_worker_id)
        .maybeSingle();
      if (!worker || !ngoIds.includes(worker.ngo_id)) return res.status(403).json({ message: 'Access denied' });

      await supabase.from('fro_data_requests').update({ status: 'acknowledged' }).eq('id', realId);
      return res.json({ message: 'Request acknowledged' });
    }

    const alertId = parseInt(rawId);
    const { data: alert } = await supabase
      .from('alerts')
      .select('ngo_id')
      .eq('id', alertId)
      .maybeSingle();

    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    if (!ngoIds.includes(alert.ngo_id)) return res.status(403).json({ message: 'Access denied' });

    const { error } = await supabase
      .from('alerts')
      .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
      .eq('id', alertId);

    if (error) throw error;
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getDonorTransactions = async (req, res) => {
  try {
    const { id } = req.params;
    const { page: pageStr, page_size } = req.query;
    const pg = Math.max(1, parseInt(pageStr) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(page_size) || 20));
    const offset = (pg - 1) * limit;

    const numId = parseInt(id);
    let donor;
    if (!isNaN(numId)) {
      const { data } = await supabase.from('donor_profiles').select('id, mobile_number').eq('id', numId).maybeSingle();
      donor = data;
    }
    if (!donor) {
      const { data } = await supabase.from('donor_profiles').select('id, mobile_number').eq('mobile_number', id).maybeSingle();
      donor = data;
    }
    if (!donor) return res.json({ data: [], pagination: { page: pg, pageSize: limit, total: 0, totalPages: 0 } });

    const [donationsRes, receiptsRes, importRes] = await Promise.all([
      supabase.from('fro_donor_logs')
        .select('id, amount_collected, payment_mode, accounts_status, created_at, action, disposition_detail, notes, fro_assignments!inner(donor_id)')
        .eq('fro_assignments.donor_id', donor.id)
        .gt('amount_collected', 0)
        .order('created_at', { ascending: false }),
      supabase.from('receipts')
        .select('id, amount, receipt_no, mode, created_at')
        .eq('donor_mobile', donor.mobile_number)
        .order('created_at', { ascending: false }),
      supabase.from('new_data')
        .select('id, amount, transaction_date, category, bank_donor_name, created_at')
        .eq('mobile_number', donor.mobile_number)
        .order('created_at', { ascending: false }),
    ]);

    const mapStatus = (s) => {
      if (s === 'verified') return 'verified';
      if (s === 'pending') return 'pending';
      return 'imported';
    };

    const transactions = [
      ...(donationsRes.data || []).map(d => ({
        date: d.created_at, type: 'Donation', amount: d.amount_collected || 0,
        ref: String(d.id), mode: d.payment_mode || d.disposition_detail || d.action,
        status: mapStatus(d.accounts_status), source: 'FRO Log',
      })),
      ...(receiptsRes.data || []).map(r => ({
        date: r.created_at, type: 'Receipt', amount: r.amount || 0,
        ref: r.receipt_no || `REC-${r.id}`, mode: r.mode || '',
        status: 'verified', source: 'Receipt',
      })),
      ...(importRes.data || []).map(n => ({
        date: n.created_at || n.transaction_date, type: 'Import', amount: n.amount || 0,
        ref: String(n.id), mode: n.category || n.bank_donor_name || '',
        status: 'imported', source: 'Import',
      })),
    ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    const seen = new Set();
    const unique = transactions.filter(t => {
      const key = `${t.date?.slice(0, 10)}-${t.amount}-${t.mode}-${t.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const total = unique.length;
    const paginated = unique.slice(offset, offset + limit);
    return res.json({
      data: paginated,
      pagination: { page: pg, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getDataRequests = async (req, res) => {
  try {
    const ngoIds = await getUserNgoIds(req.user);
    if (ngoIds.length === 0) return res.json([]);

    const { data, error } = await supabase
      .from('fro_data_requests')
      .select('*, workers(name, login_id)')
      .in('ngo_id', ngoIds)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const result = (data || []).map(r => ({
      id: r.id,
      fro_worker_id: r.fro_worker_id,
      worker_name: r.workers?.name || 'Unknown',
      worker_login: r.workers?.login_id || '',
      message: r.message,
      status: r.status,
      admin_response: r.admin_response,
      created_at: r.created_at,
      resolved_at: r.resolved_at,
    }));

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const resolveDataRequest = async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const ngoIds = await getUserNgoIds(req.user);

    const { data: request } = await supabase
      .from('fro_data_requests')
      .select('ngo_id')
      .eq('id', requestId)
      .maybeSingle();

    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (!ngoIds.includes(request.ngo_id)) return res.status(403).json({ message: 'Access denied' });

    const { response } = req.body;
    const { error } = await supabase
      .from('fro_data_requests')
      .update({
        status: 'resolved',
        admin_response: response || null,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) throw error;
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const CONNECTED_DISPOSITIONS = ['contacted', 'lead_done', 'donation_collected', 'follow_up', 'scheduled', 'callback', 'visit_donate', 'promise_to_pay', 'payment_pending', 'already_donated', 'language_barrier', 'transferred_senior', 'query_complaint', 'receipt_request'];
const NOT_CONNECTED_DISPOSITIONS = ['busy', 'ringing', 'unreachable', 'switched_off', 'wrong_number', 'invalid', 'invalid_number', 'rejected'];

export const masterSearch = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json({ donors: [], fros: [], stations: [] });

    const term = `%${q.trim()}%`;
    const ngoIds = await getUserNgoIds(req.user);
    const ngoFilter = ngoIds.length > 0 ? ngoIds : null;

    const [donorsRes, frosRes, stationsRes] = await Promise.all([
      // Search donors
      (async () => {
        let query = supabase
          .from('donor_profiles')
          .select('id, name, mobile_number, city, amount, total_amount, donation_count, pan_number, email, address_1, birth_date, project_supported, last_donation_date')
          .or(`name.ilike.${term},mobile_number.ilike.${term},pan_number.ilike.${term},city.ilike.${term}`)
          .limit(15);
        if (ngoFilter) {
          const { data: ngoDonors } = await supabase
            .from('fro_assignments')
            .select('donor_id')
            .in('ngo_id', ngoFilter)
            .not('status', 'eq', 'reassigned');
          const ids = [...new Set((ngoDonors || []).map(d => d.donor_id).filter(Boolean))];
          if (ids.length > 0) query = query.in('id', ids);
          else return [];
        }
        const { data } = await query;
        return data || [];
      })(),
      // Search FRO workers
      (async () => {
        let query = supabase
          .from('workers')
          .select('id, name, login_id, ngo_id, is_active, created_at, ngos!left(name)')
          .eq('department', 'FRO')
          .or(`name.ilike.${term},login_id.ilike.${term}`)
          .limit(10);
        if (ngoFilter) {
          query = query.in('ngo_id', ngoFilter);
        }
        const { data } = await query;
        return data || [];
      })(),
      // Search stations
      (async () => {
        try {
          let query = supabase
            .from('fro_station_assignments')
            .select('station, ngo_id, fro_worker_id, workers!left(name, login_id)')
            .ilike('station', term)
            .limit(10);
          if (ngoFilter) {
            const { data: ngoStations } = await supabase
              .from('fro_station_assignments')
              .select('station')
              .in('ngo_id', ngoFilter);
            const stationNames = [...new Set((ngoStations || []).map(s => s.station).filter(Boolean))];
            if (stationNames.length > 0) query = query.in('station', stationNames);
            else return [];
          }
          const { data, error } = await query;
          if (error) {
            // Fallback: query without workers join if FK fails
            const { data: fallback } = await supabase
              .from('fro_station_assignments')
              .select('station, ngo_id, fro_worker_id')
              .ilike('station', term)
              .limit(10);
            return (fallback || []).map(s => ({ ...s, workers: null }));
          }
          return data || [];
        } catch {
          return [];
        }
      })(),
    ]);

    // Enrich donors with FRO/station assignment info
    let donors = donorsRes;
    if (donors.length > 0) {
      const donorIds = donors.map(d => d.id);
      const { data: assignments } = await supabase
        .from('fro_assignments')
        .select('donor_id, ngo_id, station, status, workers!left(name, login_id)')
        .in('donor_id', donorIds)
        .not('status', 'eq', 'reassigned');
      const asgnMap = {};
      for (const a of assignments || []) {
        if (!asgnMap[a.donor_id]) asgnMap[a.donor_id] = [];
        asgnMap[a.donor_id].push(a);
      }
      donors = donors.map(d => ({
        ...d,
        assignments: asgnMap[d.id] || [],
      }));
    }

    // Enrich stations with donor count
    let stations = stationsRes;
    if (stations.length > 0) {
      const stationNames = [...new Set(stations.map(s => s.station).filter(Boolean))];
      const { data: counts } = await supabase
        .from('fro_assignments')
        .select('station, id', { count: 'exact', head: false })
        .in('station', stationNames)
        .not('status', 'eq', 'reassigned');
      const countMap = {};
      for (const c of counts || []) {
        countMap[c.station] = (countMap[c.station] || 0) + 1;
      }
      stations = stations.map(s => ({
        ...s,
        donor_count: countMap[s.station] || 0,
      }));
    }

    return res.json({ donors, fros: frosRes, stations });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getCallAnalytics = async (req, res) => {
  try {
    const { ngo_id, station, fro_id, from, to } = req.query;
    const ngoIds = await getUserNgoIds(req.user);
    const effectiveNgoId = ngo_id || (ngoIds.length === 1 ? ngoIds[0] : null);

    const fromDate = from || new Date(new Date().setHours(0,0,0,0)).toISOString();
    const toDate = to || new Date().toISOString();

    // Build base filter
    let logQuery = supabase
      .from('fro_donor_logs')
      .select('*, fro_assignments!inner(donor_id, ngo_id, station, fro_worker_id, workers!left(name, login_id))')
      .gte('created_at', fromDate)
      .lte('created_at', toDate);

    if (effectiveNgoId) {
      logQuery = logQuery.eq('fro_assignments.ngo_id', effectiveNgoId);
    } else if (ngoIds.length > 0) {
      logQuery = logQuery.in('fro_assignments.ngo_id', ngoIds);
    }
    if (station) logQuery = logQuery.eq('fro_assignments.station', station);
    if (fro_id) logQuery = logQuery.eq('fro_assignments.fro_worker_id', fro_id);

    const { data: logs, error } = await logQuery;
    if (error) throw error;

    const connected = (logs || []).filter(l => CONNECTED_DISPOSITIONS.includes(l.disposition_detail));
    const notConnected = (logs || []).filter(l => NOT_CONNECTED_DISPOSITIONS.includes(l.disposition_detail));
    const totalTalkSeconds = (logs || []).reduce((s, l) => s + (parseInt(l.call_duration_seconds) || 0), 0);

    // Per FRO breakdown
    const froMap = {};
    for (const l of logs || []) {
      const wid = l.fro_assignments?.fro_worker_id;
      if (!wid) continue;
      if (!froMap[wid]) {
        froMap[wid] = {
          fro_worker_id: wid,
          fro_name: l.fro_assignments?.workers?.name || 'Unknown',
          login_id: l.fro_assignments?.workers?.login_id || '',
          total: 0, connected: 0, not_connected: 0, talk_seconds: 0,
        };
      }
      froMap[wid].total++;
      if (CONNECTED_DISPOSITIONS.includes(l.disposition_detail)) froMap[wid].connected++;
      if (NOT_CONNECTED_DISPOSITIONS.includes(l.disposition_detail)) froMap[wid].not_connected++;
      froMap[wid].talk_seconds += parseInt(l.call_duration_seconds) || 0;
    }

    // Per station breakdown
    const stationMap = {};
    for (const l of logs || []) {
      const st = l.fro_assignments?.station;
      if (!st) continue;
      if (!stationMap[st]) {
        stationMap[st] = { station: st, total: 0, connected: 0, not_connected: 0 };
      }
      stationMap[st].total++;
      if (CONNECTED_DISPOSITIONS.includes(l.disposition_detail)) stationMap[st].connected++;
      if (NOT_CONNECTED_DISPOSITIONS.includes(l.disposition_detail)) stationMap[st].not_connected++;
    }

    // Per disposition breakdown
    const dispMap = {};
    for (const l of logs || []) {
      const d = l.disposition_detail || 'unknown';
      if (!dispMap[d]) dispMap[d] = 0;
      dispMap[d]++;
    }

    // Daily trend
    const dailyMap = {};
    for (const l of logs || []) {
      const day = l.created_at?.slice(0, 10) || 'unknown';
      if (!dailyMap[day]) dailyMap[day] = { date: day, connected: 0, not_connected: 0, total: 0 };
      dailyMap[day].total++;
      if (CONNECTED_DISPOSITIONS.includes(l.disposition_detail)) dailyMap[day].connected++;
      if (NOT_CONNECTED_DISPOSITIONS.includes(l.disposition_detail)) dailyMap[day].not_connected++;
    }

    return res.json({
      summary: {
        total_calls: (logs || []).length,
        connected: connected.length,
        not_connected: notConnected.length,
        connection_rate: (logs || []).length > 0 ? Math.round((connected.length / (logs || []).length) * 100) + '%' : '0%',
        total_talk_seconds: totalTalkSeconds,
        total_talk_time: `${Math.floor(totalTalkSeconds / 3600)}h ${Math.floor((totalTalkSeconds % 3600) / 60)}m`,
        avg_call_duration: (logs || []).length > 0
          ? `${Math.floor(totalTalkSeconds / (logs || []).length / 60)}m ${Math.round((totalTalkSeconds / (logs || []).length) % 60)}s`
          : '0m 0s',
      },
      by_fro: Object.values(froMap).sort((a, b) => b.total - a.total),
      by_station: Object.values(stationMap).sort((a, b) => b.total - a.total),
      by_disposition: Object.entries(dispMap).map(([disposition, count]) => ({ disposition, count })).sort((a, b) => b.count - a.count),
      daily_trend: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ---- Station Transfers ----

export const transferStationData = async (req, res) => {
  try {
    const { station } = req.params;
    const { target_station, donor_count } = req.body;
    const ngoIds = await getUserNgoIds(req.user);
    if (ngoIds.length === 0) return res.status(400).json({ message: 'No NGO assigned' });

    if (!target_station || !donor_count) {
      return res.status(400).json({ message: 'target_station and donor_count are required' });
    }

    const { data: sourceAssigns } = await supabase
      .from('fro_station_assignments')
      .select('fro_worker_id, ngo_id')
      .in('ngo_id', ngoIds)
      .eq('station', station.trim())
      .not('fro_worker_id', 'is', null)
      .limit(1);

    const sourceAssign = sourceAssigns?.[0];
    if (!sourceAssign) {
      return res.status(400).json({ message: 'No FRO assigned to source station' });
    }

    if (target_station.trim() === station.trim()) {
      return res.status(400).json({ message: 'Target station must be different from source station' });
    }

    const autoReturnAt = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString();
    const result = await createTemporaryTransfer(
      sourceAssign.fro_worker_id, ngoIds,
      station.trim(), target_station.trim(), donor_count, autoReturnAt, req.user.id
    );

    return res.json({
      message: `Transferred ${result.transferred} donors to ${target_station}`,
      transfer: result.transfer,
      transferred: result.transferred,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const returnTransferEarly = async (req, res) => {
  try {
    const { id } = req.params;
    const count = await reverseTransfer(id);
    return res.json({
      message: `Returned ${count} donors to original FRO`,
      returned: count,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getTransferHistory = async (req, res) => {
  try {
    const ngoIds = await getUserNgoIds(req.user);
    if (ngoIds.length === 0) return res.json([]);

    const { data: transfers, error } = await supabase
      .from('fro_transfers')
      .select('*')
      .in('ngo_id', ngoIds)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const froIds = [...new Set((transfers || []).map(t => t.source_fro_worker_id).filter(Boolean))];
    let froNameMap = {};
    if (froIds.length > 0) {
      const { data: workers } = await supabase
        .from('workers')
        .select('id, name')
        .in('id', froIds);
      for (const w of workers || []) froNameMap[w.id] = w.name;
    }

    const result = (transfers || []).map(t => ({
      id: t.id,
      station: t.station,
      target_station: t.target_station,
      donor_count: t.donor_count,
      donor_ids: t.donor_ids || [],
      source_fro_name: froNameMap[t.source_fro_worker_id] || 'Unknown',
      auto_return_at: t.auto_return_at,
      returned: !!t.returned,
      returned_at: t.returned_at,
      created_at: t.created_at,
    }));

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getTransferDonors = async (req, res) => {
  try {
    const ngoIds = await getUserNgoIds(req.user);
    if (ngoIds.length === 0) return res.json([]);

    const { id } = req.params;

    const { data: transfer, error: tErr } = await supabase
      .from('fro_transfers')
      .select('*')
      .eq('id', id)
      .in('ngo_id', ngoIds)
      .single();

    if (tErr || !transfer) {
      return res.status(404).json({ message: 'Transfer not found' });
    }

    const donorIds = transfer.donor_ids || [];

    if (donorIds.length === 0) return res.json([]);

    // Fetch donor details from donors table (or new_data table as fallback)
    const { data: donors } = await supabase
      .from('donor_profiles')
      .select('id, name, mobile_number, pan_number')
      .in('id', donorIds);

    if (donors && donors.length > 0) {
      return res.json(donors);
    }

    // Fallback: try new_data table
    const { data: newDonors } = await supabase
      .from('new_data')
      .select('id, name, mobile, status')
      .in('id', donorIds);

    const fallback = (newDonors || []).map(d => ({
      id: d.id, name: d.name, mobile: d.mobile, lead_status: d.status,
    }));

    return res.json(fallback);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getIncentives = async (req, res) => {
  try {
    const ngoIds = await getUserNgoIds(req.user);
    if (ngoIds.length === 0) return res.json([]);

    const allWorkers = [];
    for (const ngoId of ngoIds) {
      const workers = await getFroWorkersByNgo(ngoId);
      allWorkers.push(...workers);
    }

    const workerIds = allWorkers.map(w => w.id);
    if (workerIds.length === 0) return res.json([]);

    const offset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(Date.now() + offset);
    const y = ist.getUTCFullYear();
    const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
    const startDate = `${y}-${m}-01`;
    const lastDay = new Date(Date.UTC(y, parseInt(m), 0)).getUTCDate();
    const endDate = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;

    const { data: allAchievements } = await supabase
      .from('daily_achievements')
      .select('*')
      .in('worker_id', workerIds)
      .gte('date', startDate)
      .lte('date', endDate);

    const achievementsByWorker = {};
    if (allAchievements) {
      for (const a of allAchievements) {
        if (!achievementsByWorker[a.worker_id]) achievementsByWorker[a.worker_id] = [];
        achievementsByWorker[a.worker_id].push(a);
      }
    }

    const { data: incentiveTargets } = await supabase
      .from('incentive_targets')
      .select('*')
      .in('worker_id', workerIds)
      .eq('month', startDate);

    const targetByWorker = {};
    if (incentiveTargets) {
      for (const t of incentiveTargets) {
        targetByWorker[t.worker_id] = t;
      }
    }

    const results = [];
    for (const worker of allWorkers) {
      const workerAchs = achievementsByWorker[worker.id] || [];
      const monthlyAchievement = workerAchs.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

      const target = targetByWorker[worker.id];
      if (!target) {
        results.push({
          worker_id: worker.id,
          name: worker.name,
          totalIncentive: 0,
          akiPayout: 0,
          monthlyIncentive: 0,
          monthlyAchievement,
          monthlyTarget: 0,
          hasTarget: false,
        });
        continue;
      }

      const monthlyTarget = parseFloat(target.target_amount);
      const totalAKI = workerAchs.reduce((sum, r) => {
        const dayName = getDayName(r.date);
        return sum + calculateAKI(parseFloat(r.amount), dayName);
      }, 0);

      const monthsEmployed = getMonthsEmployed(worker.created_at);
      const isNewJoiner = monthsEmployed <= 3;
      const monthlyTargetMet = monthlyAchievement >= monthlyTarget;

      let akiPayout = 0;
      let monthlyIncentive = 0;
      let totalIncentive = 0;

      if (monthlyTargetMet) {
        const overage = monthlyAchievement - monthlyTarget;
        monthlyIncentive = Math.round(overage * 0.1);
        akiPayout = isNewJoiner ? totalAKI : Math.round(totalAKI / 2);
        totalIncentive = akiPayout + monthlyIncentive;
      }

      results.push({
        worker_id: worker.id,
        name: worker.name,
        totalIncentive,
        akiPayout,
        monthlyIncentive,
        monthlyAchievement,
        monthlyTarget,
        totalAKI,
        hasTarget: true,
      });
    }

    return res.json(results);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getVerificationFroWise = async (req, res) => {
  try {
    const { status, period } = req.query;
    if (!status || !period) {
      return res.status(400).json({ message: 'status and period are required' });
    }
    if (!['verified', 'unverified'].includes(status)) {
      return res.status(400).json({ message: 'status must be verified or unverified' });
    }
    if (!['month', 'today'].includes(period)) {
      return res.status(400).json({ message: 'period must be month or today' });
    }

    const ngoIds = await getUserNgoIds(req.user);
    if (ngoIds.length === 0) return res.json([]);

    const allWorkers = (await Promise.all(ngoIds.map(ngoId => getFroWorkersByNgo(ngoId)))).flat();

    const seen = new Set();
    const froWorkers = allWorkers.filter(w => { const k = w.id; if (seen.has(k)) return false; seen.add(k); return true; });
    if (froWorkers.length === 0) return res.json([]);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const startDate = period === 'month' ? monthStart : todayStart.toISOString();
    const endDate = period === 'month' ? monthEnd : todayEnd.toISOString();

    const collectionFn = status === 'verified' ? getVerifiedCollection : getUnverifiedCollection;

    const results = await Promise.all(froWorkers.map(async (w) => {
      const { amount, count } = await collectionFn(w.id, startDate, endDate);
      return { fro_id: w.id, fro_name: w.name, amount, count };
    }));

    return res.json(results);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ---- Donor CRM ----

export const listLeads = async (req, res) => {
  try {
    const { search, status, from_date, to_date, page: pageStr, page_size } = req.query;
    const page = Math.max(1, parseInt(pageStr) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(page_size) || 50));
    const offset = (page - 1) * limit;

    // Only show telecaller-created leads (not recruiter leads)
    const { data: telecallerUsers } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'telecaller');
    const telecallerIds = (telecallerUsers || []).map(u => u.id);
    if (telecallerIds.length === 0) {
      return res.json({ data: [], pagination: { page, pageSize: limit, total: 0, totalPages: 0 } });
    }

    let countQuery = supabase.from('leads').select('id', { count: 'exact', head: true }).in('created_by', telecallerIds);
    let dataQuery = supabase.from('leads').select('*, users(name)').in('created_by', telecallerIds).order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    if (status) { countQuery = countQuery.eq('status', status); dataQuery = dataQuery.eq('status', status); }
    if (from_date) { countQuery = countQuery.gte('created_at', from_date + 'T00:00:00'); dataQuery = dataQuery.gte('created_at', from_date + 'T00:00:00'); }
    if (to_date) { countQuery = countQuery.lte('created_at', to_date + 'T23:59:59'); dataQuery = dataQuery.lte('created_at', to_date + 'T23:59:59'); }

    if (search) {
      const q = `%${search}%`;
      countQuery = countQuery.or(`name.ilike.${q},phone.ilike.${q},email.ilike.${q}`);
      dataQuery = dataQuery.or(`name.ilike.${q},phone.ilike.${q},email.ilike.${q}`);
    }

    const [{ count }, { data, error }] = await Promise.all([countQuery, dataQuery]);
    if (error) throw error;

    const total = count || 0;
    return res.json({
      data: data || [],
      pagination: { page, pageSize: limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const createLead = async (req, res) => {
  try {
    const { name, mobile, email, address, city, state, pan, aadhaar, birthday, anniversary, language, notes } = req.body;
    if (!name || !mobile) {
      return res.status(400).json({ message: 'Name and mobile are required' });
    }

    const { data, error } = await supabase
      .from('leads')
      .insert({
        name,
        phone: mobile,
        email: email || null,
        notes: [address, city, state, pan, aadhaar, birthday, anniversary, language].filter(Boolean).join(' | ') || null,
        created_by: req.user.id,
        source: 'admin',
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const importLeads = async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const file = req.files.file;

    const XLSX = await import('xlsx');
    const workbook = XLSX.read(file.data, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    const leads = rows.map(row => ({
      name: row.name || row.Name || '',
      phone: String(row.mobile || row.Mobile || row.phone || row.Phone || ''),
      email: row.email || row.Email || null,
      created_by: req.user.id,
      source: 'import',
      status: 'pending',
    })).filter(l => l.name && l.phone);

    if (leads.length === 0) {
      return res.status(400).json({ message: 'No valid leads found in file' });
    }

    const { data, error } = await supabase.from('leads').insert(leads).select();
    if (error) throw error;

    return res.json({ message: `${leads.length} leads imported`, count: leads.length, data });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const assignLeads = async (req, res) => {
  try {
    const { lead_ids, fro_worker_id } = req.body;
    if (!lead_ids || !lead_ids.length || !fro_worker_id) {
      return res.status(400).json({ message: 'lead_ids array and fro_worker_id are required' });
    }

    const { data: leads, error: lErr } = await supabase
      .from('leads')
      .select('id, phone, name')
      .in('id', lead_ids);
    if (lErr) throw lErr;

    const now = new Date().toISOString();
    const assignments = leads.map(lead => ({
      lead_id: lead.id,
      fro_worker_id: parseInt(fro_worker_id),
      assigned_by: req.user.id,
      assigned_at: now,
      status: 'assigned',
    }));

    const { error: aErr } = await supabase.from('lead_assignments').insert(assignments);
    if (aErr) throw aErr;

    await supabase.from('leads').update({ status: 'assigned', assigned_to: parseInt(fro_worker_id) }).in('id', lead_ids);

    return res.json({ message: `${leads.length} leads assigned`, count: leads.length });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const transferLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { target_fro_worker_id, target_station } = req.body;
    if (!target_fro_worker_id && !target_station) {
      return res.status(400).json({ message: 'target_fro_worker_id or target_station required' });
    }

    const updateData = {};
    if (target_fro_worker_id) updateData.assigned_to = parseInt(target_fro_worker_id);
    if (target_station) updateData.station = target_station;
    updateData.status = 'transferred';

    const { error } = await supabase.from('leads').update(updateData).eq('id', id);
    if (error) throw error;

    return res.json({ message: 'Lead transferred successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getLeadHistory = async (req, res) => {
  try {
    const { lead_id } = req.query;
    let query = supabase
      .from('lead_assignments')
      .select('*, leads(name, phone), workers!fro_worker_id(name)')
      .order('assigned_at', { ascending: false });

    if (lead_id) query = query.eq('lead_id', lead_id);

    const { data, error } = await query;
    if (error) throw error;

    const result = (data || []).map(h => ({
      id: h.id,
      lead_id: h.lead_id,
      lead_name: h.leads?.name || 'Unknown',
      lead_phone: h.leads?.phone || '',
      fro_name: h.workers?.name || 'Unknown',
      assigned_by: h.assigned_by,
      status: h.status || 'assigned',
      assigned_at: h.assigned_at,
    }));

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getDuplicateLeads = async (req, res) => {
  try {
    const ngoIds = await getUserNgoIds(req.user);
    if (ngoIds.length === 0) return res.json([]);

    const { data, error } = await supabase
      .from('donor_profiles')
      .select('id, name, mobile_number, city, amount, last_donation_date, pan_number')
      .in('ngo_id', ngoIds)
      .order('mobile_number');

    if (error) throw error;

    const grouped = {};
    for (const d of data || []) {
      const key = d.mobile_number || d.name || 'unknown';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(d);
    }

    const duplicates = Object.values(grouped).filter(g => g.length > 1);
    return res.json(duplicates);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getFullDonorDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const numId = parseInt(id);

    let profile;
    const { data: donor, error } = await supabase
      .from('donor_profiles')
      .select('*')
      .eq('id', numId)
      .single();

    if (error || !donor) {
      const { data: mobileDonor } = await supabase
        .from('donor_profiles')
        .select('*')
        .eq('mobile_number', id)
        .maybeSingle();
      if (!mobileDonor) return res.status(404).json({ message: 'Donor not found' });
      profile = mobileDonor;
    } else {
      profile = donor;
    }

    const { data: donations } = await supabase
      .from('fro_donor_logs')
      .select('*, fro_assignments!inner(donor_id)')
      .eq('fro_assignments.donor_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50);

    return res.json({ profile, donations: donations || [] });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getDonorReceipts = async (req, res) => {
  try {
    const { id } = req.params;

    let donorMobile;
    const numId = parseInt(id);
    if (!isNaN(numId)) {
      const { data: donor } = await supabase.from('donor_profiles').select('mobile_number').eq('id', numId).maybeSingle();
      if (donor) donorMobile = donor.mobile_number;
    } else {
      donorMobile = id;
    }

    if (!donorMobile) return res.json([]);

    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('donor_mobile', donorMobile)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json(data || []);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getDonorFollowups = async (req, res) => {
  try {
    const { id } = req.params;

    let donorId;
    const numId = parseInt(id);
    if (!isNaN(numId)) {
      const { data: fa } = await supabase
        .from('fro_assignments')
        .select('id')
        .eq('donor_id', numId)
        .maybeSingle();
      if (fa) donorId = fa.id;
    }

    if (!donorId) return res.json([]);

    const { data, error } = await supabase
      .from('fro_scheduled_contacts')
      .select('*, workers!created_by(name)')
      .eq('assignment_id', donorId)
      .order('scheduled_at', { ascending: false });

    if (error) throw error;
    return res.json(data || []);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const createFollowup = async (req, res) => {
  try {
    const { donor_id, fro_worker_id, scheduled_at, notes } = req.body;
    if (!donor_id || !scheduled_at) {
      return res.status(400).json({ message: 'donor_id and scheduled_at are required' });
    }

    const { data: assignment } = await supabase
      .from('fro_assignments')
      .select('id')
      .eq('donor_id', donor_id)
      .maybeSingle();

    if (!assignment) {
      return res.status(400).json({ message: 'No assignment found for this donor' });
    }

    const { data, error } = await supabase
      .from('fro_scheduled_contacts')
      .insert({
        assignment_id: assignment.id,
        scheduled_at: scheduled_at,
        notes: notes || null,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getFroSummary = async (req, res) => {
  try {
    const froId = req.params.id;
    if (!froId) return res.status(400).json({ message: 'Invalid FRO ID' });

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const [logsRes, asgnRes] = await Promise.all([
      supabase
        .from('fro_donor_logs')
        .select('amount_collected, disposition_detail, action, accounts_status, created_at, call_duration_seconds')
        .eq('fro_worker_id', froId)
        .gte('created_at', todayStart.toISOString())
        .lte('created_at', todayEnd.toISOString()),
      supabase
        .from('fro_assignments')
        .select('status')
        .eq('fro_worker_id', froId)
        .not('status', 'eq', 'reassigned'),
    ]);

    const logs = logsRes.data || [];
    const assignments = asgnRes.data || [];

    const todayCollection = logs.reduce((s, l) => {
      const amt = parseFloat(l.amount_collected || 0);
      if (l.action === 'donation') return s + amt;
      if (l.action === 'disposition' && l.disposition_detail === 'lead_done') return s + amt;
      return s;
    }, 0);

    const talkSeconds = logs.reduce((s, l) => s + (parseInt(l.call_duration_seconds) || 0), 0);

    const dispositionBreakdown = {};
    for (const l of logs) {
      const d = l.disposition_detail || 'unknown';
      dispositionBreakdown[d] = (dispositionBreakdown[d] || 0) + 1;
    }

    const statusBreakdown = {};
    for (const a of assignments) {
      statusBreakdown[a.status] = (statusBreakdown[a.status] || 0) + 1;
    }

    return res.json({
      todayCollection,
      todayCalls: logs.length,
      talkSeconds,
      dispositionBreakdown,
      totalAssigned: assignments.length,
      statusBreakdown,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const STATION_NAMES = ['ND-1','ND-2','ND-3','ND-4','ND-5','ND-6','ND-7','ND-8','DH-1','DH-2','DH-3','DH-4','DH-5','DH-6','DH-7','DH-8','DH-9','DH-10','DH-11','DH-12','DH-13','DH-14'];

export const seedStations = async (req, res) => {
  try {
    const access = await getUserNgoAccess(req.user.id);
    const ngoEntries = access.map(a => ({ ngoId: a.ngo_id, ngoName: a.ngo_name })).filter(e => e.ngoId);
    if (ngoEntries.length === 0 && req.user.ngo_id) {
      const { data: ngo } = await supabase.from('ngos').select('name, id').eq('id', req.user.ngo_id).single();
      if (ngo) ngoEntries.push({ ngoId: ngo.id, ngoName: ngo.name });
    }

    let totalCreated = 0;
    const results = [];
    for (const { ngoId, ngoName } of ngoEntries) {
      let created = 0;
      for (const station of STATION_NAMES) {
        const existing = await getStationAssignmentByNgoAndStation(ngoId, station);
        if (!existing) {
          await createStation(ngoId, station, req.user.id);
          created++;
        }
      }
      totalCreated += created;
      results.push({ ngo: ngoName, created });
    }

    return res.json({ message: `${totalCreated} stations created`, details: results });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const uploadOldData = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const XLSX = await import('xlsx');
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return res.status(400).json({ message: 'No sheets found in file' });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    if (rows.length === 0) {
      return res.status(400).json({ message: 'No data found in file' });
    }

    const access = await getUserNgoAccess(req.user.id);
    const ngoEntries = access.map(a => ({ ngoId: a.ngo_id, ngoName: a.ngo_name })).filter(e => e.ngoId);
    if (ngoEntries.length === 0 && req.user.ngo_id) {
      const { data: ngo } = await supabase.from('ngos').select('name, id').eq('id', req.user.ngo_id).single();
      if (ngo) ngoEntries.push({ ngoId: ngo.id, ngoName: ngo.name });
    }
    if (ngoEntries.length === 0) {
      return res.status(400).json({ message: 'No NGOs assigned to your account' });
    }

    const normalizedRows = rows.map(row => ({
      mobile: String(row.mobile || row.Mobile || row.mobile_number || row.MobileNumber || row['Mobile Number'] || row['Mobile No'] || '').trim(),
      name: String(row.name || row.Name || row['Donor Name'] || row.donor_name || row.donorname || '').trim(),
      amount: parseFloat(row.amount || row.Amount || row.donation_amount || row.DonationAmount || 0) || 0,
      city: String(row.city || row.City || row.city_name || row.CityName || '').trim(),
      station: String(row.station || row.Station || row.station_name || row.StationName || '').trim().toUpperCase(),
    })).filter(r => r.mobile && r.station);

    const validStations = new Set(STATION_NAMES);
    let createdProfiles = 0;
    let createdAssignments = 0;
    let skippedDuplicate = 0;
    let invalidStation = 0;
    const errors = [];

    for (const row of normalizedRows) {
      if (!validStations.has(row.station)) {
        invalidStation++;
        errors.push(`Invalid station "${row.station}" for mobile ${row.mobile}`);
        continue;
      }

      // Upsert donor_profile
      const { data: existingProfile } = await supabase
        .from('donor_profiles')
        .select('id')
        .eq('mobile_number', row.mobile)
        .maybeSingle();

      let donorId;
      if (existingProfile) {
        donorId = existingProfile.id;
        await supabase
          .from('donor_profiles')
          .update({ name: row.name || undefined, city: row.city || undefined })
          .eq('id', donorId);
      } else {
        const { data: newProfile } = await supabase
          .from('donor_profiles')
          .insert([{ mobile_number: row.mobile, name: row.name || null, amount: row.amount, total_amount: row.amount, donation_count: 1, city: row.city || null }])
          .select('id')
          .single();
        if (newProfile) {
          donorId = newProfile.id;
          createdProfiles++;
        }
      }
      if (!donorId) continue;

      // Create assignment per NGO
      for (const { ngoId, ngoName } of ngoEntries) {
        const { data: existingAsgn } = await supabase
          .from('fro_assignments')
          .select('id')
          .eq('donor_id', donorId)
          .eq('ngo_id', ngoId)
          .not('status', 'eq', 'reassigned')
          .maybeSingle();

        if (existingAsgn) {
          skippedDuplicate++;
          continue;
        }

        const stationAssign = await getStationAssignmentByNgoAndStation(ngoId, row.station);

        const { error: asgnErr } = await supabase
          .from('fro_assignments')
          .insert([{
            donor_id: donorId,
            fro_worker_id: stationAssign?.fro_worker_id || null,
            ngo_id: ngoId,
            station: row.station,
            assigned_by: req.user.id,
            status: 'pending',
            assigned_at: new Date().toISOString(),
          }]);
        if (asgnErr) {
          errors.push(`Failed to create assignment for ${row.mobile} in ${ngoName}: ${asgnErr.message}`);
        } else {
          createdAssignments++;
        }
      }
    }

    return res.json({
      message: `${createdAssignments} assignments created across ${ngoEntries.length} NGO(s)`,
      total_rows: normalizedRows.length,
      created_profiles: createdProfiles,
      created_assignments: createdAssignments,
      skipped_duplicate_assignments: skippedDuplicate,
      invalid_stations: invalidStation,
      ngo_count: ngoEntries.length,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const uploadOldDataForStation = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const station = req.params.station?.trim().toUpperCase();
    if (!station) {
      return res.status(400).json({ message: 'Station is required' });
    }

    const XLSX = await import('xlsx');
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return res.status(400).json({ message: 'No sheets found in file' });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    if (rows.length === 0) {
      return res.status(400).json({ message: 'No data found in file' });
    }

    const access = await getUserNgoAccess(req.user.id);
    const ngoEntries = access.map(a => ({ ngoId: a.ngo_id, ngoName: a.ngo_name })).filter(e => e.ngoId);
    if (ngoEntries.length === 0 && req.user.ngo_id) {
      const { data: ngo } = await supabase.from('ngos').select('name, id').eq('id', req.user.ngo_id).single();
      if (ngo) ngoEntries.push({ ngoId: ngo.id, ngoName: ngo.name });
    }
    if (ngoEntries.length === 0) {
      return res.status(400).json({ message: 'No NGOs assigned to your account' });
    }

    const normalizedRows = rows.map(row => ({
      mobile: String(row.mobile || row.Mobile || row.mobile_number || row.MobileNumber || row['Mobile Number'] || row['Mobile No'] || '').trim(),
      name: String(row.name || row.Name || row['Donor Name'] || row.donor_name || row.donorname || '').trim(),
      amount: parseFloat(row.amount || row.Amount || row.donation_amount || row.DonationAmount || 0) || 0,
      city: String(row.city || row.City || row.city_name || row.CityName || '').trim(),
    })).filter(r => r.mobile);

    let createdProfiles = 0;
    let createdAssignments = 0;
    let skippedDuplicate = 0;
    const errors = [];

    for (const row of normalizedRows) {
      const { data: existingProfile } = await supabase
        .from('donor_profiles')
        .select('id')
        .eq('mobile_number', row.mobile)
        .maybeSingle();

      let donorId;
      if (existingProfile) {
        donorId = existingProfile.id;
        await supabase
          .from('donor_profiles')
          .update({ name: row.name || undefined, city: row.city || undefined })
          .eq('id', donorId);
      } else {
        const { data: newProfile } = await supabase
          .from('donor_profiles')
          .insert([{ mobile_number: row.mobile, name: row.name || null, amount: row.amount, total_amount: row.amount, donation_count: 1, city: row.city || null }])
          .select('id')
          .single();
        if (newProfile) {
          donorId = newProfile.id;
          createdProfiles++;
        }
      }
      if (!donorId) continue;

      for (const { ngoId, ngoName } of ngoEntries) {
        const { data: existingAsgn } = await supabase
          .from('fro_assignments')
          .select('id')
          .eq('donor_id', donorId)
          .eq('ngo_id', ngoId)
          .not('status', 'eq', 'reassigned')
          .maybeSingle();

        if (existingAsgn) {
          skippedDuplicate++;
          continue;
        }

        const stationAssign = await getStationAssignmentByNgoAndStation(ngoId, station);

        const { error: asgnErr } = await supabase
          .from('fro_assignments')
          .insert([{
            donor_id: donorId,
            fro_worker_id: stationAssign?.fro_worker_id || null,
            ngo_id: ngoId,
            station,
            assigned_by: req.user.id,
            status: 'pending',
            assigned_at: new Date().toISOString(),
          }]);
        if (asgnErr) {
          errors.push(`Failed to create assignment for ${row.mobile} in ${ngoName}: ${asgnErr.message}`);
        } else {
          createdAssignments++;
        }
      }
    }

    return res.json({
      message: `${createdAssignments} assignments created for station ${station} across ${ngoEntries.length} NGO(s)`,
      total_rows: normalizedRows.length,
      created_profiles: createdProfiles,
      created_assignments: createdAssignments,
      skipped_duplicate_assignments: skippedDuplicate,
      ngo_count: ngoEntries.length,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
