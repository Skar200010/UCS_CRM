import supabase from '../config/supabase.js';
import { getWorkerById } from '../models/workerModel.js';
import { getActiveSalaryByWorker } from '../models/salaryModel.js';
import {
  batchCreateAssignments,
  findAssignmentById,
  updateAssignmentStatus,
  getDashboardStats,
  createScheduledContact,
  completeAllScheduledByAssignment,
  getScheduledByAssignment,
} from '../models/froAssignmentModel.js';
import { getTargetByWorker } from '../models/froTargetModel.js';
import {
  createDonorLog,
  findLogsByDonorAndWorker,
  findLogsByAssignment,
  getTotalCollectedByWorker,
  getTotalCollectedByAssignment,
  getTotalCollectedByDonorAndWorker,
  getVerifiedCollection,
  getUnverifiedCollection,
} from '../models/froDonorLogModel.js';
import { getAchievements } from '../models/dailyAchievementModel.js';
import { getDayName, calculateAKI, getMonthsEmployed } from '../utils/incentive.js';

async function findOrCreateAssignment(donorId, workerId, ngoId) {
  let query = supabase
    .from('fro_assignments')
    .select('id, station')
    .eq('donor_id', donorId)
    .eq('fro_worker_id', workerId)
    .not('status', 'eq', 'reassigned');
  if (ngoId) query = query.eq('ngo_id', ngoId);
  const { data: existing } = await query.maybeSingle();
  if (existing) return existing;

  if (!ngoId) {
    const { data: donor } = await supabase
      .from('donor_profiles')
      .select('ngo')
      .eq('id', donorId)
      .single();
    if (!donor) return null;
    const { data: ngo } = await supabase
      .from('ngos')
      .select('id')
      .eq('name', donor.ngo)
      .maybeSingle();
    ngoId = ngo?.id || null;
  }

  // Look up FRO's station from fro_station_assignments
  let station = null;
  if (ngoId) {
    const { data: sa } = await supabase
      .from('fro_station_assignments')
      .select('station')
      .eq('fro_worker_id', workerId)
      .eq('ngo_id', ngoId)
      .maybeSingle();
    station = sa?.station || null;
  }

  const { data: created } = await supabase
    .from('fro_assignments')
    .insert([{ donor_id: donorId, fro_worker_id: workerId, ngo_id: ngoId, status: 'pending', station, assigned_at: new Date().toISOString() }])
    .select('id, station')
    .single();
  return created;
}

async function getMyStationNames(workerId) {
  const { data: stationAssigns, error } = await supabase
    .from('fro_station_assignments')
    .select('station')
    .eq('fro_worker_id', workerId);
  if (error) console.error('getMyStationNames query error:', error.message);
  return (stationAssigns || []).map(s => s.station);
}

async function chunkedInQuery(table, column, ids, queryFn, chunkSize = 200) {
  const allData = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data, error } = await queryFn(
      supabase.from(table).in(column, chunk)
    );
    if (error) throw error;
    if (data) allData.push(...data);
  }
  return allData;
}

function getMonthRange(dateStr) {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function calculateAutoTarget(salary, monthsEmployed) {
  if (monthsEmployed <= 0) return salary * 1;
  if (monthsEmployed === 1) return salary * 2.5;
  if (monthsEmployed === 2) return salary * 3;
  return null;
}

const STATUS_PRIORITY = [
  'pending',
  'contacted',
  'follow_up',
  'scheduled',
  'busy', 'ringing', 'unreachable', 'switched_off', 'wrong_number', 'invalid_number', 'rejected',
  'visit_donate',
  'promise_to_pay',
  'payment_pending',
  'already_donated',
  'not_interested', 'not_interested_now',
  'language_barrier',
  'transferred_senior',
  'query_complaint',
  'receipt_request',
  'lead_done',
  'donation_collected',
];

export const getDashboard = async (req, res) => {
  try {
    const workerId = req.user.id;

    // Count donors by this FRO's stations (from fro_assignments)
    const stationNames = await getMyStationNames(workerId);
    let totalDonors = 0;
    if (stationNames.length > 0) {
      const { data: donorIds } = await supabase
        .from('fro_assignments')
        .select('donor_id')
        .in('station', stationNames)
        .not('status', 'eq', 'reassigned');
      totalDonors = new Set((donorIds || []).map(a => a.donor_id)).size;
    }

    const stats = await getDashboardStats(workerId);
    stats.total = totalDonors;
    const worker = await getWorkerById(workerId);
    const salary = await getActiveSalaryByWorker(workerId);
    const currentSalary = salary ? parseFloat(salary.salary) : 0;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const monthStr = now.toISOString().slice(0, 7) + '-01';

    const collected = await getTotalCollectedByWorker(workerId, monthStart, monthEnd);

    const joinedAt = new Date(worker.created_at);
    const monthsEmployed = (now.getFullYear() - joinedAt.getFullYear()) * 12
      + (now.getMonth() - joinedAt.getMonth());

    let target;
    let targetSource;
    const manualTarget = await getTargetByWorker(workerId, monthStr);
    const autoTarget = calculateAutoTarget(currentSalary, monthsEmployed);
    if (autoTarget !== null) {
      target = autoTarget;
      targetSource = monthsEmployed <= 0 ? 'month1' : monthsEmployed === 1 ? 'month2' : 'month3';
    } else {
      target = manualTarget ? parseFloat(manualTarget.target_amount) : 0;
      targetSource = manualTarget ? 'manual' : 'not_set';
    }

    const achieved_target = manualTarget?.achieved_target != null ? parseFloat(manualTarget.achieved_target) : null;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const verifiedMonth = await getVerifiedCollection(workerId, monthStart, monthEnd);
    const unverifiedMonth = await getUnverifiedCollection(workerId, monthStart, monthEnd);
    const verifiedToday = await getVerifiedCollection(workerId, todayStart.toISOString(), todayEnd.toISOString());
    const unverifiedToday = await getUnverifiedCollection(workerId, todayStart.toISOString(), todayEnd.toISOString());

    const fyYear = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
    const fyStart = new Date(fyYear, 3, 1);

    const [
      monthlyConnectedRes, dailyConnectedRes, dailyDonationsRes, totalDonationsRes, assignmentsRes,
      leadDoneAllRes, fyDonorsRes, todayDonorsRes, monthDonorsRes,
    ] = stationNames.length > 0
      ? await Promise.all([
          supabase.from('fro_donor_logs').select('donor_id, fro_assignments!inner(station)').in('fro_assignments.station', stationNames).gte('created_at', monthStart).lte('created_at', monthEnd),
          supabase.from('fro_donor_logs').select('donor_id, fro_assignments!inner(station)').in('fro_assignments.station', stationNames).gte('created_at', todayStart.toISOString()).lte('created_at', todayEnd.toISOString()),
          supabase.from('fro_donor_logs').select('amount_collected, fro_assignments!inner(station)').in('fro_assignments.station', stationNames).or('action.eq.donation,and(disposition_detail.eq.lead_done,action.eq.disposition,accounts_status.eq.verified)').gte('created_at', todayStart.toISOString()).lte('created_at', todayEnd.toISOString()),
          supabase.from('fro_donor_logs').select('amount_collected, fro_assignments!inner(station)').in('fro_assignments.station', stationNames).or('action.eq.donation,and(disposition_detail.eq.lead_done,action.eq.disposition,accounts_status.eq.verified)'),
          supabase.from('fro_assignments').select('status, donor_id').in('station', stationNames).not('status', 'eq', 'reassigned'),
          supabase.from('fro_donor_logs').select('donor_id, created_at, fro_assignments!inner(station)').in('fro_assignments.station', stationNames).eq('action', 'disposition').eq('disposition_detail', 'lead_done'),
          supabase.from('fro_donor_logs').select('donor_id, created_at, fro_assignments!inner(station)').in('fro_assignments.station', stationNames).or('action.eq.donation,and(disposition_detail.eq.lead_done,action.eq.disposition)').gte('created_at', fyStart.toISOString()),
          supabase.from('fro_donor_logs').select('donor_id, fro_assignments!inner(station)').in('fro_assignments.station', stationNames).or('action.eq.donation,and(disposition_detail.eq.lead_done,action.eq.disposition)').gte('created_at', todayStart.toISOString()).lte('created_at', todayEnd.toISOString()),
          supabase.from('fro_donor_logs').select('donor_id, fro_assignments!inner(station)').in('fro_assignments.station', stationNames).or('action.eq.donation,and(disposition_detail.eq.lead_done,action.eq.disposition)').gte('created_at', monthStart).lte('created_at', monthEnd),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

    const connectedStatuses = new Set(['contacted', 'donation_collected', 'lead_done', 'follow_up', 'scheduled', 'visit_donate', 'promise_to_pay', 'payment_pending', 'already_donated', 'language_barrier', 'transferred_senior', 'query_complaint', 'receipt_request', 'not_interested_now', 'callback']);
    const donorInfo = new Map();
    for (const a of assignmentsRes.data || []) {
      if (!donorInfo.has(a.donor_id)) {
        donorInfo.set(a.donor_id, { connected: false });
      }
      if (a.status !== 'reassigned' && connectedStatuses.has(a.status)) {
        donorInfo.get(a.donor_id).connected = true;
      }
    }
    let dataUsed = 0, dataUnused = 0;
    for (const [, d] of donorInfo) {
      if (d.connected) dataUsed++;
      else dataUnused++;
    }

    const monthlyDonorIds = new Set((monthlyConnectedRes.data || []).map(l => l.donor_id).filter(Boolean));
    const dailyDonorIds = new Set((dailyConnectedRes.data || []).map(l => l.donor_id).filter(Boolean));
    let dailyDonations = 0;
    for (const l of dailyDonationsRes.data || []) dailyDonations += parseFloat(l.amount_collected || 0);
    let totalDonations = 0;
    for (const l of totalDonationsRes.data || []) totalDonations += parseFloat(l.amount_collected || 0);

    // New donors: first lead_done per donor
    const earliestLeadDone = {};
    for (const log of leadDoneAllRes.data || []) {
      if (!earliestLeadDone[log.donor_id] || log.created_at < earliestLeadDone[log.donor_id]) {
        earliestLeadDone[log.donor_id] = log.created_at;
      }
    }
    const todayStr = todayStart.toISOString();
    const todayEndStr = todayEnd.toISOString();
    const newDonorsToday = Object.entries(earliestLeadDone)
      .filter(([_, date]) => date >= todayStr && date <= todayEndStr).length;
    const newDonorsMonthly = Object.entries(earliestLeadDone)
      .filter(([_, date]) => date >= monthStart && date <= monthEnd).length;

    // Reactivated: donors who donated in period but had no donation in FY before the period
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

    // FRO-specific reactivations: donors THIS worker reactivated (donated today/month but no prior donation in FY)
    let froReactivatedToday = 0, froReactivatedMonthly = 0;
    if (stationNames.length > 0) {
      // Get donations by this FRO worker today
      const { data: froTodayDonors } = await supabase
        .from('fro_donor_logs')
        .select('donor_id, fro_assignments!inner(station, fro_worker_id)')
        .in('fro_assignments.station', stationNames)
        .eq('fro_assignments.fro_worker_id', workerId)
        .or('action.eq.donation,and(disposition_detail.eq.lead_done,action.eq.disposition)')
        .gte('created_at', todayStart.toISOString())
        .lte('created_at', todayEnd.toISOString());

      const { data: froMonthDonors } = await supabase
        .from('fro_donor_logs')
        .select('donor_id, fro_assignments!inner(station, fro_worker_id)')
        .in('fro_assignments.station', stationNames)
        .eq('fro_assignments.fro_worker_id', workerId)
        .or('action.eq.donation,and(disposition_detail.eq.lead_done,action.eq.disposition)')
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd);

      const { data: froFyDonors } = await supabase
        .from('fro_donor_logs')
        .select('donor_id, created_at, fro_assignments!inner(station, fro_worker_id)')
        .in('fro_assignments.station', stationNames)
        .eq('fro_assignments.fro_worker_id', workerId)
        .or('action.eq.donation,and(disposition_detail.eq.lead_done,action.eq.disposition)')
        .gte('created_at', fyStart.toISOString());

      const todayStr = todayStart.toISOString();
      const fyBeforeTodayDonorsSet = new Set();
      const fyBeforeMonthDonorsSet = new Set();
      for (const log of froFyDonors || []) {
        if (log.created_at < todayStr) fyBeforeTodayDonorsSet.add(log.donor_id);
        if (log.created_at < monthStart) fyBeforeMonthDonorsSet.add(log.donor_id);
      }

      const froTodayDonorSet = new Set((froTodayDonors || []).map(l => l.donor_id).filter(Boolean));
      const froMonthDonorSet = new Set((froMonthDonors || []).map(l => l.donor_id).filter(Boolean));
      froReactivatedToday = [...froTodayDonorSet].filter(id => !fyBeforeTodayDonorsSet.has(id)).length;
      froReactivatedMonthly = [...froMonthDonorSet].filter(id => !fyBeforeMonthDonorsSet.has(id)).length;
    }

    // Active donors: those who donated within the last 1 year
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const donorsWithRecentDonations = stationNames.length > 0
      ? (await supabase
          .from('fro_donor_logs')
          .select('donor_id, fro_assignments!inner(station)')
          .in('fro_assignments.station', stationNames)
          .or('action.eq.donation,and(disposition_detail.eq.lead_done,action.eq.disposition,accounts_status.eq.verified)')
          .gte('created_at', oneYearAgo.toISOString())).data || []
      : [];

    const activeDonorIds = new Set(donorsWithRecentDonations.map(d => d.donor_id).filter(Boolean));
    let activeDonors = 0, inactiveDonors = 0;
    for (const [donorId] of donorInfo) {
      if (activeDonorIds.has(donorId)) activeDonors++;
      else inactiveDonors++;
    }

    const { data: myAtt } = await supabase
      .from('attendance')
      .select('status')
      .eq('worker_id', workerId)
      .eq('date', todayStart.toISOString().slice(0, 10))
      .maybeSingle();
    const is_punched_in = myAtt && (myAtt.status === 'present' || myAtt.status === 'late');

    return res.json({
      worker: {
        is_active: worker.is_active !== false,
        is_punched_in,
      },
      target: {
        amount: target,
        source: targetSource,
        collected,
        achieved: achieved_target,
        salary: currentSalary,
        months_employed: monthsEmployed,
      },
      stats,
      connected: {
        monthly: monthlyDonorIds.size,
        daily: dailyDonorIds.size,
      },
      donations: {
        daily: dailyDonations,
        total: totalDonations,
        new_donors: {
          today: newDonorsToday,
          monthly: newDonorsMonthly,
        },
      },
      reactivations: {
        today: reactivatedToday,
        monthly: reactivatedMonthly,
        fro_today: froReactivatedToday,
        fro_monthly: froReactivatedMonthly,
      },
      donors: {
        active: activeDonors,
        inactive: inactiveDonors,
      },
      verification: {
        month: {
          verified: { amount: verifiedMonth.amount, count: verifiedMonth.count },
          unverified: { amount: unverifiedMonth.amount, count: unverifiedMonth.count },
        },
        today: {
          verified: { amount: verifiedToday.amount, count: verifiedToday.count },
          unverified: { amount: unverifiedToday.amount, count: unverifiedToday.count },
        },
      },
      data: {
        used: dataUsed,
        unused: dataUnused,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const NOT_CONNECTED_STATUSES = ['busy', 'ringing', 'unreachable', 'switched_off', 'wrong_number', 'invalid_number', 'rejected'];
const CONNECTED_STATUSES = ['contacted', 'donation_collected', 'lead_done', 'follow_up', 'scheduled', 'callback', 'visit_donate', 'promise_to_pay', 'payment_pending', 'already_donated', 'language_barrier', 'transferred_senior', 'query_complaint', 'receipt_request'];

export const getMyDonors = async (req, res) => {
  try {
    const workerId = req.user.id;
    const statusFilter = req.query.status;
    const statusGroup = req.query.status_group;

    const stationNames = await getMyStationNames(workerId);
    if (stationNames.length === 0) return res.json([]);

    let query = supabase
      .from('fro_assignments')
      .select('*, ngos(name)')
      .in('station', stationNames)
      .not('status', 'eq', 'reassigned');

    if (req.query.station) {
      query = query.eq('station', req.query.station);
    }

    if (statusGroup === 'not_connected') {
      query = query.in('status', NOT_CONNECTED_STATUSES);
    } else if (statusGroup === 'connected') {
      query = query.in('status', CONNECTED_STATUSES);
    } else if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    if (req.query.new_only === 'true') {
      const batchIds = [];
      for (const s of stationNames) {
        try {
          const { data: lb } = await supabase
            .from('fro_assignments')
            .select('batch_id')
            .eq('station', s)
            .eq('batch_type', 'new_data')
            .not('status', 'eq', 'reassigned')
            .order('assigned_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lb?.batch_id) batchIds.push(lb.batch_id);
        } catch (e) {
          console.error(`getMyDonors batch query error ${s}:`, e.message);
        }
      }
      if (batchIds.length > 0) {
        query = query.in('batch_id', [...new Set(batchIds)]);
      } else {
        query = query.eq('batch_type', 'new_data');
      }
    } else if (req.query.old_only === 'true') {
      const batchIds = [];
      for (const s of stationNames) {
        try {
          const { data: lb } = await supabase
            .from('fro_assignments')
            .select('batch_id')
            .eq('station', s)
            .eq('batch_type', 'old_data')
            .not('status', 'eq', 'reassigned')
            .order('assigned_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lb?.batch_id) batchIds.push(lb.batch_id);
        } catch (e) {
          console.error(`getMyDonors batch query error ${s}:`, e.message);
        }
      }
      if (batchIds.length > 0) {
        query = query.in('batch_id', [...new Set(batchIds)]);
      } else {
        query = query.eq('batch_type', 'old_data');
      }
    }

    let { data: assignments, error: qErr } = await query;
    if (qErr) {
      console.error('getMyDonors main query error:', qErr);
      query = supabase.from('fro_assignments').select('*, ngos(name)').in('station', stationNames).not('status', 'eq', 'reassigned');
      if (req.query.new_only === 'true') query = query.eq('batch_type', 'new_data');
      else if (req.query.old_only === 'true') query = query.eq('batch_type', 'old_data');
      const { data: retry } = await query;
      assignments = retry || [];
    }

    if (!assignments || assignments.length === 0) {
      const { data: byWorker } = await supabase
        .from('fro_assignments')
        .select('*, ngos(name)')
        .eq('fro_worker_id', workerId)
        .not('status', 'eq', 'reassigned');
      if (byWorker && byWorker.length > 0) {
        assignments = byWorker;
      }
    }

    if (!assignments || assignments.length === 0) return res.json([]);

    let donorIds = [...new Set(assignments.map(a => a.donor_id))];

    if (req.query.verified_only === 'true' && donorIds.length > 0) {
      const verifiedLogs = await chunkedInQuery('fro_donor_logs', 'donor_id', donorIds, q =>
        q.select('donor_id').eq('accounts_status', 'verified')
      );
      const verifiedDonorIds = new Set(verifiedLogs.map(l => l.donor_id));
      assignments = assignments.filter(a => verifiedDonorIds.has(a.donor_id));
      donorIds = [...new Set(assignments.map(a => a.donor_id))];
    }
    const donors = await chunkedInQuery('donor_profiles', 'id', donorIds, q =>
      q.select('*')
    );

    const donorMap = {};
    for (const d of donors || []) donorMap[d.id] = d;

    const assignmentIds = assignments.map(a => a.id);
    const schedules = await chunkedInQuery('fro_scheduled_contacts', 'assignment_id', assignmentIds, q =>
      q.select('*').eq('is_completed', false)
    );

    const scheduleMap = {};
    for (const s of schedules || []) {
      if (!scheduleMap[s.assignment_id]) {
        scheduleMap[s.assignment_id] = s;
      }
    }

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const donationLogs = await chunkedInQuery('fro_donor_logs', 'donor_id', donorIds, q =>
      q.select('donor_id').eq('action', 'donation').gte('created_at', oneYearAgo.toISOString())
    );
    const activeDonorIds = new Set(donationLogs.map(l => l.donor_id));

    const leadDoneVerifiedLogs = await chunkedInQuery('fro_donor_logs', 'donor_id', donorIds, q =>
      q.select('donor_id')
        .eq('disposition_detail', 'lead_done')
        .eq('action', 'disposition')
        .eq('accounts_status', 'verified')
        .gte('created_at', oneYearAgo.toISOString())
    );
    for (const l of leadDoneVerifiedLogs) activeDonorIds.add(l.donor_id);

    // Filter by active/inactive status
    if (req.query.active_only === 'true') {
      assignments = assignments.filter(a => activeDonorIds.has(a.donor_id));
      donorIds = [...new Set(assignments.map(a => a.donor_id))];
    } else if (req.query.inactive_only === 'true') {
      assignments = assignments.filter(a => !activeDonorIds.has(a.donor_id));
      donorIds = [...new Set(assignments.map(a => a.donor_id))];
    }

    // Sort assignments so completed/connected statuses come before pending
    // (dedup picks the first occurrence)
    if (req.query.verified_only === 'true') {
      const statusOrder = ['donation_collected', 'lead_done', 'follow_up', 'scheduled', 'contacted', 'callback', 'visit_donate', 'promise_to_pay', 'payment_pending', 'already_donated', 'language_barrier', 'transferred_senior', 'query_complaint', 'receipt_request', 'not_interested_now', 'pending', 'busy', 'ringing', 'unreachable', 'switched_off', 'wrong_number', 'invalid_number', 'rejected'];
      const statusRank = {};
      for (let i = 0; i < statusOrder.length; i++) statusRank[statusOrder[i]] = i;
      assignments.sort((a, b) => (statusRank[a.status] ?? 999) - (statusRank[b.status] ?? 999));
    }

    let result = [];
    const seen = new Set();
    for (const a of assignments || []) {
      const d = donorMap[a.donor_id];
      if (!d) continue;
      const key = `${a.donor_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const s = scheduleMap[a.id];
      result.push({
        id: a.donor_id,
        donor_id: a.donor_id,
        assignment_id: a.id,
        ngo_id: a.ngo_id,
        ngo_name: a.ngos?.name || 'Unknown',
        station: a.station || '',
        donor_mobile: d.mobile_number || '',
        donor_name: d.name || 'Unknown',
        donor_city: d.city || '',
        donor_address: d.address_1 || '',
        donor_amount: d.amount || 0,
        donor_email: d.email || '',
        donor_pan: d.pan_number || '',
        donor_project: d.project_supported || '',
        donor_dob: d.birth_date || '',
        donation_count: d.donation_count || 0,
        total_donated: d.total_amount || 0,
        last_donation_date: d.last_donation_date || null,
        first_donation_date: d.first_donation_date || null,
        has_donated_current_fy: activeDonorIds.has(a.donor_id),
        is_active: activeDonorIds.has(a.donor_id),
        status: a.status || 'pending',
        notes: a.notes || null,
        last_contacted_at: a.last_contacted_at || null,
        next_follow_up: a.next_follow_up || null,
        assigned_at: a.assigned_at || null,
        is_new: a.is_new !== false,
        next_scheduled_at: s?.scheduled_at || null,
        is_overdue: s ? new Date(s.scheduled_at) < new Date() : false,
        schedule_id: s?.id || null,
        schedule_notes: s?.notes || null,
      });
    }

    // Aggregate all NGO names per donor (since dedup by donor_id loses NGO info)
    const donorNgos = {};
    for (const a of assignments || []) {
      if (!donorNgos[a.donor_id]) donorNgos[a.donor_id] = [];
      const ngoName = a.ngos?.name;
      if (ngoName && !donorNgos[a.donor_id].includes(ngoName)) {
        donorNgos[a.donor_id].push(ngoName);
      }
    }
    for (const r of result) {
      r.ngo_names = donorNgos[r.donor_id] || [r.ngo_name];
    }

    // Attach latest accounts_status from fro_donor_logs (for verified_only view)
    if (req.query.verified_only === 'true' && result.length > 0) {
      const donorIdsForStatus = result.map(r => r.donor_id);
      const statusLogs = await chunkedInQuery('fro_donor_logs', 'donor_id', donorIdsForStatus, q =>
        q.select('donor_id, accounts_status, created_at')
          .in('accounts_status', ['verified', 'rejected', 'pending'])
      );
      statusLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const latestStatus = {};
      for (const log of statusLogs) {
        if (!latestStatus[log.donor_id]) latestStatus[log.donor_id] = log.accounts_status;
      }
      for (const r of result) {
        r.accounts_status = latestStatus[r.donor_id] || r.status;
      }
    }

    // --- Period filter ---
    const periodFilter = req.query.period;
    if (periodFilter && periodFilter !== 'all' && donorIds.length > 0) {
      let periodCutoff;
      const now = new Date();
      if (periodFilter === 'today') {
        const d = new Date(); d.setHours(0, 0, 0, 0);
        periodCutoff = d.toISOString();
      } else if (periodFilter === 'monthly') {
        periodCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      } else if (periodFilter === 'sixmonths') {
        periodCutoff = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString();
      } else if (periodFilter === 'yearly') {
        periodCutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
      }
      if (periodCutoff) {
        const periodActivity = await chunkedInQuery('fro_donor_logs', 'donor_id', donorIds, q =>
          q.select('donor_id')
            .not('action', 'eq', 'note')
            .gte('created_at', periodCutoff)
        );
        const periodDonorIds = new Set(periodActivity.map(l => l.donor_id));
        result = result.filter(r => periodDonorIds.has(r.donor_id));
      }
    }

    // --- Ordering logic ---
    // 1. New leads (is_new === true)
    // 2. Not connected (status in NOT_CONNECTED_STATUSES or 'pending')
    // 3. Connected (status in CONNECTED_STATUSES, excluding lead_done)
    // 4. Lead done from previous months (hidden for rest of current month)

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

    // Use ALL donor_ids in the station (before dedup) to find hidden lead_done
    const hiddenLeadDoneIds = new Set();
    const rejectedLeadDoneIds = new Set();
    if (donorIds.length > 0) {
      const leadDoneLogs = await chunkedInQuery('fro_donor_logs', 'donor_id', donorIds, q =>
        q.select('donor_id, accounts_status')
          .eq('disposition_detail', 'lead_done')
          .eq('action', 'disposition')
          .gte('created_at', monthStart)
          .lte('created_at', monthEnd)
      );
      for (const log of leadDoneLogs) {
        hiddenLeadDoneIds.add(log.donor_id);
        if (log.accounts_status === 'rejected') rejectedLeadDoneIds.add(log.donor_id);
      }
      for (const id of rejectedLeadDoneIds) hiddenLeadDoneIds.delete(id);
    }

    const filtered = req.query.verified_only === 'true'
      ? result
      : result.filter(r => !hiddenLeadDoneIds.has(r.donor_id));

    const notConnectedSet = new Set(NOT_CONNECTED_STATUSES);
    const connectedSet = new Set(CONNECTED_STATUSES);

    filtered.sort((a, b) => {
      const groupA = a.is_new ? 0
        : (notConnectedSet.has(a.status) || a.status === 'pending') ? 1
        : connectedSet.has(a.status) ? 2
        : a.status === 'lead_done' ? 3 : 4;
      const groupB = b.is_new ? 0
        : (notConnectedSet.has(b.status) || b.status === 'pending') ? 1
        : connectedSet.has(b.status) ? 2
        : b.status === 'lead_done' ? 3 : 4;
      if (groupA !== groupB) return groupA - groupB;
      const dateA = a.assigned_at ? new Date(a.assigned_at) : new Date(0);
      const dateB = b.assigned_at ? new Date(b.assigned_at) : new Date(0);
      return dateA - dateB;
    });

    return res.json(filtered);
  } catch (error) {
    console.error('getMyDonors error for worker', req.user?.id, ':', error.message, error.stack);
    return res.status(500).json({ message: error.message, stack: error.stack });
  }
};

export const getTransferredLeads = async (req, res) => {
  try {
    const workerId = req.user.id;
    const stationNames = await getMyStationNames(workerId);
    if (stationNames.length === 0) return res.json([]);

    const { data: assignments } = await supabase
      .from('fro_assignments')
      .select('*, ngos(name)')
      .in('station', stationNames)
      .is('fro_worker_id', null)
      .not('status', 'eq', 'reassigned');

    if (!assignments || assignments.length === 0) return res.json([]);

    const donorIds = [...new Set(assignments.map(a => a.donor_id))];
    const { data: donors } = await supabase
      .from('donor_profiles')
      .select('*')
      .in('id', donorIds);

    const donorMap = {};
    for (const d of donors || []) donorMap[d.id] = d;

    const assignmentIds = assignments.map(a => a.id);
    const { data: schedules } = await supabase
      .from('fro_scheduled_contacts')
      .select('*')
      .in('assignment_id', assignmentIds)
      .eq('is_completed', false);

    const scheduleMap = {};
    for (const s of schedules || []) {
      if (!scheduleMap[s.assignment_id]) scheduleMap[s.assignment_id] = s;
    }

    const result = [];
    const seen = new Set();
    for (const a of assignments || []) {
      const d = donorMap[a.donor_id];
      if (!d) continue;
      const key = `${a.donor_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const s = scheduleMap[a.id];
      result.push({
        id: a.donor_id,
        donor_id: a.donor_id,
        assignment_id: a.id,
        ngo_id: a.ngo_id,
        ngo_name: a.ngos?.name || 'Unknown',
        station: a.station || '',
        donor_mobile: d.mobile_number || '',
        donor_name: d.name || 'Unknown',
        donor_city: d.city || '',
        donor_address: d.address_1 || '',
        donor_amount: d.amount || 0,
        donor_email: d.email || '',
        donor_pan: d.pan_number || '',
        donor_project: d.project_supported || '',
        donor_dob: d.birth_date || '',
        donation_count: d.donation_count || 0,
        total_donated: d.total_amount || 0,
        status: a.status || 'pending',
        notes: a.notes || null,
        last_contacted_at: a.last_contacted_at || null,
        next_follow_up: a.next_follow_up || null,
        assigned_at: a.assigned_at || null,
        is_new: a.is_new !== false,
        next_scheduled_at: s?.scheduled_at || null,
        is_overdue: s ? new Date(s.scheduled_at) < new Date() : false,
        schedule_id: s?.id || null,
        schedule_notes: s?.notes || null,
      });
    }

    return res.json(result);
  } catch (error) {
    console.error('getTransferredLeads error for worker', req.user?.id, ':', error.message);
    return res.status(500).json({ message: error.message });
  }
};

export const updateDonorStatus = async (req, res) => {
  try {
    const workerId = req.user.id;
    const donorId = parseInt(req.params.id);
    const { status, notes, next_follow_up, ngo_id } = req.body;
    if (!status) return res.status(400).json({ message: 'status is required' });

    let assignment = await findOrCreateAssignment(donorId, workerId, ngo_id);
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

    // Fill in station if missing (old rows created before station tracking)
    if (!assignment.station && ngo_id) {
      const { data: sa } = await supabase
        .from('fro_station_assignments')
        .select('station')
        .eq('fro_worker_id', workerId)
        .eq('ngo_id', ngo_id)
        .maybeSingle();
      if (sa?.station) {
        await supabase.from('fro_assignments').update({ station: sa.station }).eq('id', assignment.id);
        assignment.station = sa.station;
      }
    }

    const updates = { status, last_contacted_at: new Date().toISOString() };
    if (notes !== undefined) updates.notes = notes;
    if (next_follow_up !== undefined) updates.next_follow_up = next_follow_up;

    const result = await updateAssignmentStatus(assignment.id, updates);
    return res.json({ message: 'Status updated', data: result });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getDonorLogs = async (req, res) => {
  try {
    const workerId = req.user.id;
    const donorId = parseInt(req.params.id);
    const { ngo_id } = req.query;

    let assignment = null;
    if (ngo_id) {
      const { data } = await supabase
        .from('fro_assignments')
        .select('id')
        .eq('donor_id', donorId)
        .eq('fro_worker_id', workerId)
        .eq('ngo_id', ngo_id)
        .not('status', 'eq', 'reassigned')
        .maybeSingle();
      assignment = data;
    }
    if (!assignment) {
      const { data } = await supabase
        .from('fro_assignments')
        .select('id')
        .eq('donor_id', donorId)
        .eq('fro_worker_id', workerId)
        .not('status', 'eq', 'reassigned')
        .maybeSingle();
      assignment = data;
    }

    let logs = [];
    let totalCollected = 0;
    let nextSchedule = null;
    if (assignment) {
      logs = await findLogsByAssignment(assignment.id);
      totalCollected = await getTotalCollectedByAssignment(assignment.id);
      nextSchedule = await getScheduledByAssignment(assignment.id);
    }

    return res.json({ logs, total_collected: totalCollected, next_schedule: nextSchedule });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const createDonorLogHandler = async (req, res) => {
  try {
    const workerId = req.user.id;
    const donorId = parseInt(req.params.id);
    const { action, notes, outcome, amount_collected, disposition_category, disposition_detail, scheduled_at, payment_screenshot_url, pan_number, donor_address, donor_dob, ngo_id, project_name, remark, upi_transaction_id, transaction_datetime } = req.body;

    if (!action) return res.status(400).json({ message: 'action is required' });
    const allowedActions = ['call', 'visit', 'message', 'follow_up', 'donation', 'note', 'disposition'];
    if (!allowedActions.includes(action)) return res.status(400).json({ message: `Invalid action. Must be one of: ${allowedActions.join(', ')}` });

    const assignment = await findOrCreateAssignment(donorId, workerId, ngo_id);
    if (!assignment) return res.status(404).json({ message: 'Donor not found or no NGO assigned' });

    const logData = {
      assignment_id: assignment.id,
      donor_id: donorId,
      fro_worker_id: workerId,
      action,
      notes: notes || null,
      outcome: outcome || null,
      amount_collected: amount_collected || null,
      disposition_category: disposition_category || null,
      disposition_detail: disposition_detail || null,
      scheduled_at: scheduled_at || null,
      payment_screenshot_url: payment_screenshot_url || null,
      pan_number: pan_number || null,
      remark: remark || null,
      upi_transaction_id: upi_transaction_id || null,
      transaction_datetime: transaction_datetime || null,
      accounts_status: null,
      created_by: workerId,
    };

    if (action === 'disposition' && disposition_detail === 'lead_done') {
      logData.accounts_status = 'pending';
    }

    const log = await createDonorLog(logData);

    // Update donor profile fields if provided
    const updateFields = {};
    if (donor_address) updateFields.address_1 = donor_address;
    if (donor_dob) updateFields.birth_date = donor_dob;
    if (project_name) updateFields.project_supported = project_name;
    if (Object.keys(updateFields).length > 0) {
      await supabase.from('donor_profiles').update(updateFields).eq('id', donorId);
    }

    const now = new Date().toISOString();

    if (action === 'donation') {
      await updateAssignmentStatus(assignment.id, {
        status: 'donation_collected',
        last_contacted_at: now,
      });
    } else if (action === 'disposition' && disposition_detail) {
      await completeAllScheduledByAssignment(assignment.id);

      const statusFromDetail = dispositionDetailToStatus(disposition_detail);
      const statusUpdates = { status: statusFromDetail, last_contacted_at: now };

      if (disposition_detail === 'scheduled' && scheduled_at) {
        await createScheduledContact({
          assignment_id: assignment.id,
          scheduled_at,
          notes: notes || null,
          created_by: workerId,
        });
        statusUpdates.next_follow_up = scheduled_at.slice(0, 10);
      }

      if (disposition_detail === 'callback' && scheduled_at) {
        await createScheduledContact({
          assignment_id: assignment.id,
          scheduled_at,
          notes: notes || null,
          created_by: workerId,
        });
        statusUpdates.next_follow_up = scheduled_at.slice(0, 10);
      }

      if (outcome && outcome.startsWith('next_date:')) {
        statusUpdates.next_follow_up = outcome.replace('next_date:', '').trim();
      }

      await updateAssignmentStatus(assignment.id, statusUpdates);
    } else if (action === 'call' || action === 'visit') {
      await updateAssignmentStatus(assignment.id, {
        status: 'contacted',
        last_contacted_at: now,
      });
    }

    // If this assignment had a rejected lead ticket, resolve it
    try {
      const { data: logs } = await supabase
        .from('fro_donor_logs')
        .select('id')
        .eq('assignment_id', assignment.id)
        .eq('accounts_status', 'rejected')
        .limit(1);
      if (logs && logs.length > 0) {
        const rejectedLogIds = logs.map(l => l.id);
        await supabase
          .from('rejected_lead_tickets')
          .update({ status: 'resolved' })
          .in('fro_donor_log_id', rejectedLogIds)
          .eq('status', 'pending_review');
      }
    } catch (err) {
      console.error('Failed to resolve rejected lead ticket:', err.message);
    }

    return res.json({ message: 'Log entry created', data: log });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getRejectedLeads = async (req, res) => {
  try {
    const workerId = req.user.id;
    const stationNames = await getMyStationNames(workerId);

    if (stationNames.length === 0) return res.json([]);

    const { data: tickets, error } = await supabase
      .from('rejected_lead_tickets')
      .select('*')
      .eq('fro_worker_id', workerId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    const data = tickets || [];

    // Enrich with donor_id from fro_donor_logs
    const logIds = data.map(t => t.fro_donor_log_id).filter(Boolean);
    const donorMap = {};
    if (logIds.length > 0) {
      const { data: logs } = await supabase
        .from('fro_donor_logs')
        .select('id, fro_assignments!inner(donor_id, ngo_id, donor_profiles!inner(mobile_number))')
        .in('id', logIds);
      for (const log of logs || []) {
        donorMap[log.id] = {
          donor_id: log.fro_assignments?.donor_id,
          ngo_id: log.fro_assignments?.ngo_id,
          donor_mobile: log.fro_assignments?.donor_profiles?.mobile_number || '',
        };
      }
    }

    const result = data.map(t => {
      const info = donorMap[t.fro_donor_log_id] || {};
      return { ...t, donor_id: info.donor_id, donor_mobile: info.donor_mobile, ngo_id: info.ngo_id || t.ngo_id };
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const uploadPaymentScreenshot = async (req, res) => {
  try {
    const { file_base64, mime_type } = req.body;

    if (!file_base64) {
      return res.status(400).json({ message: 'File data is required' });
    }

    const buffer = Buffer.from(file_base64, 'base64');
    const contentType = mime_type || 'image/jpeg';
    const ext = contentType.split('/')[1] || 'jpg';
    const fileName = `payment_screenshots/${req.user.id}_${Date.now()}.${ext}`;

    let { data: uploadData, error: uploadError } = await supabase.storage
      .from('worker-documents')
      .upload(fileName, buffer, { contentType, upsert: true });

    if (uploadError) {
      if (uploadError.message?.includes('bucket')) {
        const { error: bucketError } = await supabase.storage.createBucket('worker-documents', { public: true });
        if (bucketError) {
          return res.status(500).json({ message: 'Failed to create storage bucket: ' + bucketError.message });
        }
        const { data: retryData, error: retryError } = await supabase.storage
          .from('worker-documents')
          .upload(fileName, buffer, { contentType, upsert: true });
        if (retryError) {
          return res.status(500).json({ message: 'Upload failed: ' + retryError.message });
        }
        uploadData = retryData;
      } else {
        return res.status(500).json({ message: 'Upload failed: ' + uploadError.message });
      }
    }

    const { data: publicUrlData } = supabase.storage
      .from('worker-documents')
      .getPublicUrl(fileName);

    const fileUrl = publicUrlData?.publicUrl || `${process.env.SUPABASE_URL}/storage/v1/object/public/worker-documents/${fileName}`;

    return res.json({ message: 'Screenshot uploaded', file_url: fileUrl });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

function dispositionDetailToStatus(detail) {
  const map = {
    busy: 'busy',
    ringing: 'ringing',
    unreachable: 'unreachable',
    switched_off: 'switched_off',
    wrong_number: 'wrong_number',
    invalid: 'invalid_number',
    rejected: 'rejected',
    lead_done: 'lead_done',
    scheduled: 'scheduled',
    callback: 'callback',
    visit_donate: 'visit_donate',
    promise_to_pay: 'promise_to_pay',
    payment_pending: 'payment_pending',
    already_donated: 'already_donated',
    not_interested_now: 'not_interested_now',
    language_barrier: 'language_barrier',
    transferred_senior: 'transferred_senior',
    query_complaint: 'query_complaint',
    receipt_request: 'receipt_request',
  };
  return map[detail] || 'contacted';
}

export const scheduleContact = async (req, res) => {
  try {
    const workerId = req.user.id;
    const donorId = parseInt(req.params.id);
    const { scheduled_at, notes, ngo_id } = req.body;
    if (!scheduled_at) return res.status(400).json({ message: 'scheduled_at is required' });

    const assignment = await findOrCreateAssignment(donorId, workerId, ngo_id);
    if (!assignment) return res.status(404).json({ message: 'Donor not found' });

    // Clear any existing pending schedules
    await completeAllScheduledByAssignment(assignment.id);

    const contact = await createScheduledContact({
      assignment_id: assignment.id,
      scheduled_at,
      notes: notes || null,
      created_by: workerId,
    });

    await updateAssignmentStatus(assignment.id, {
      status: 'scheduled',
      last_contacted_at: new Date().toISOString(),
      next_follow_up: scheduled_at.slice(0, 10),
    });

    return res.json({ message: 'Contact scheduled', data: contact });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getMyTarget = async (req, res) => {
  try {
    const workerId = req.user.id;
    const worker = await getWorkerById(workerId);
    const salary = await getActiveSalaryByWorker(workerId);
    const currentSalary = salary ? parseFloat(salary.salary) : 0;

    const now = new Date();
    const monthStr = now.toISOString().slice(0, 7) + '-01';
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const joinedAt = new Date(worker.created_at);
    const monthsEmployed = (now.getFullYear() - joinedAt.getFullYear()) * 12
      + (now.getMonth() - joinedAt.getMonth());

    let target;
    let targetSource;
    const manualTarget = await getTargetByWorker(workerId, monthStr);
    const autoTarget = calculateAutoTarget(currentSalary, monthsEmployed);
    if (autoTarget !== null) {
      target = autoTarget;
      targetSource = 'auto';
    } else {
      target = manualTarget ? parseFloat(manualTarget.target_amount) : 0;
      targetSource = manualTarget ? 'manual' : 'not_set';
    }

    const achieved_target = manualTarget?.achieved_target != null ? parseFloat(manualTarget.achieved_target) : null;

    const collected = await getTotalCollectedByWorker(workerId, monthStart, monthEnd);

    const stats = await getDashboardStats(workerId);

    // Incentive calculation
    let incentive = {
      totalAKI: 0,
      akiPayout: 0,
      monthlyIncentive: 0,
      totalIncentive: 0,
      targetMet: false,
      isNewJoiner: monthsEmployed <= 3,
    };
    try {
      const achievements = await getAchievements(workerId, monthStart, monthEnd);
      const monthlyAchievement = achievements.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
      const totalAKI = achievements.reduce((sum, r) => {
        return sum + calculateAKI(parseFloat(r.amount || 0), getDayName(r.date));
      }, 0);
      const monthlyTargetMet = monthlyAchievement >= target;
      if (monthlyTargetMet) {
        const akiPayout = incentive.isNewJoiner ? totalAKI : Math.round(totalAKI / 2);
        const monthlyIncentive = Math.round((monthlyAchievement - target) * 0.1);
        incentive = { totalAKI, akiPayout, monthlyIncentive, totalIncentive: akiPayout + monthlyIncentive, targetMet: true, isNewJoiner: incentive.isNewJoiner };
      } else {
        incentive.totalAKI = totalAKI;
      }
    } catch (err) { console.error('Incentive calculation error:', err); }

    return res.json({
      month: monthStr,
      target,
      target_source: targetSource,
      collected,
      achieved_target,
      remaining: Math.max(0, target - collected),
      salary: currentSalary,
      months_employed: monthsEmployed,
      stats,
      incentive,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getMyStations = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { data: stations, error } = await supabase
      .from('fro_station_assignments')
      .select('station')
      .eq('fro_worker_id', workerId);
    if (error) throw error;
    return res.json((stations || []).map(s => s.station));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const debugMyStations = async (req, res) => {
  try {
    const workerId = req.user.id;

    const { data: stations, error: stErr } = await supabase
      .from('fro_station_assignments')
      .select('station, ngo_id')
      .eq('fro_worker_id', workerId);
    if (stErr) throw stErr;

    const { data: froAsgn } = await supabase
      .from('fro_assignments')
      .select('id, donor_id, status, ngo_id, station')
      .eq('fro_worker_id', workerId)
      .not('station', 'is', null)
      .not('status', 'eq', 'reassigned');

    const donorIds = [...new Set((froAsgn || []).map(a => a.donor_id))];
    const { data: donors, error: dErr } = donorIds.length > 0
      ? await supabase.from('donor_profiles').select('id, name, mobile_number').in('id', donorIds)
      : { data: [] };
    if (dErr) throw dErr;

    const froAsgnByDonor = {};
    for (const a of froAsgn || []) {
      if (!froAsgnByDonor[a.donor_id]) froAsgnByDonor[a.donor_id] = [];
      froAsgnByDonor[a.donor_id].push(a);
    }

    return res.json({
      worker_id: workerId,
      station_count: stations.length,
      stations: stations.map(s => s.station),
      station_rows: stations,
      donor_count: (donors || []).length,
      fro_assignments_count: (froAsgn || []).length,
      donor_detail: (donors || []).slice(0, 10).map(d => ({
        id: d.id,
        name: d.name,
        mobile: d.mobile_number,
        assignments: froAsgnByDonor[d.id] || [],
      })),
    });
  } catch (error) {
    console.error('debugMyStations error:', error.message);
    return res.status(500).json({ message: error.message });
  }
};

export const getFroScheduled = async (req, res) => {
  try {
    const workerId = req.user.id;
    const stationNames = await getMyStationNames(workerId);
    if (stationNames.length === 0) return res.json([]);

    const { data: contacts, error } = await supabase
      .from('fro_scheduled_contacts')
      .select('*, fro_assignments!inner(id, donor_id, ngo_id, station, ngos(name))')
      .eq('is_completed', false)
      .in('fro_assignments.station', stationNames)
      .order('scheduled_at', { ascending: true });

    if (error) throw error;

    const donorIds = [...new Set((contacts || []).map(c => c.fro_assignments?.donor_id).filter(Boolean))];
    const { data: donors } = donorIds.length > 0
      ? await supabase.from('donor_profiles').select('id, name, mobile_number').in('id', donorIds)
      : { data: [] };
    const donorMap = {};
    for (const d of donors || []) donorMap[d.id] = d;

    const seen = new Set();
    const result = [];
    for (const c of contacts || []) {
      const a = c.fro_assignments;
      if (!a) continue;
      const d = donorMap[a.donor_id];
      const key = `${a.donor_id}-${a.ngo_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        id: a.donor_id,
        ngo_id: a.ngo_id,
        donor_name: d?.name || 'Unknown',
        donor_mobile: d?.mobile_number || '',
        scheduled_at: c.scheduled_at,
        schedule_id: c.id,
        schedule_notes: c.notes,
        assignment_id: a.id,
      });
    }
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getFroCallbacks = async (req, res) => {
  try {
    const workerId = req.user.id;
    const stationNames = await getMyStationNames(workerId);
    if (stationNames.length === 0) return res.json([]);

    const { data: assignments, error } = await supabase
      .from('fro_assignments')
      .select('*')
      .in('station', stationNames)
      .in('status', ['follow_up', 'callback']);

    if (error) throw error;

    const assignmentIds = (assignments || []).map(a => a.id);
    const [donorsRes, schedulesRes] = await Promise.all([
      supabase.from('donor_profiles').select('id, name, mobile_number')
        .in('id', [...new Set(assignments.map(a => a.donor_id).filter(Boolean))]),
      assignmentIds.length > 0
        ? supabase.from('fro_scheduled_contacts').select('assignment_id, scheduled_at').in('assignment_id', assignmentIds).eq('is_completed', false)
        : { data: [] },
    ]);

    const donorMap = {};
    for (const d of donorsRes.data || []) donorMap[d.id] = d;
    const scheduleMap = {};
    for (const s of schedulesRes.data || []) {
      if (!scheduleMap[s.assignment_id]) scheduleMap[s.assignment_id] = s.scheduled_at;
    }

    const seen = new Set();
    const result = [];
    for (const a of assignments || []) {
      const d = donorMap[a.donor_id];
      if (!d) continue;
      const key = `${a.donor_id}-${a.ngo_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        id: a.donor_id,
        ngo_id: a.ngo_id,
        donor_name: d.name || 'Unknown',
        donor_mobile: d.mobile_number || '',
        scheduled_at: scheduleMap[a.id] || null,
        status: a.status,
        next_follow_up: a.next_follow_up,
        assignment_id: a.id,
      });
    }
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getMyHistory = async (req, res) => {
  try {
    const workerId = req.user.id;
    const stationNames = await getMyStationNames(workerId);
    if (stationNames.length === 0) return res.json([]);

    const { data: logs, error } = await supabase
      .from('fro_donor_logs')
      .select('*, fro_assignments!inner(fro_worker_id, donor_id, station)')
      .eq('fro_assignments.fro_worker_id', workerId)
      .in('fro_assignments.station', stationNames)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    const donorIds = [...new Set((logs || []).map(l => l.donor_id).filter(Boolean))];
    const { data: donors } = donorIds.length > 0
      ? await supabase.from('donor_profiles').select('id, name, mobile_number').in('id', donorIds)
      : { data: [] };
    const donorMap = {};
    for (const d of donors || []) donorMap[d.id] = d;

    const result = (logs || []).map(l => {
      const d = donorMap[l.donor_id] || {};
      return {
        id: l.id,
        donor_id: l.donor_id,
        donor_name: d.name || 'Unknown',
        donor_mobile: d.mobile_number || '',
        action: l.action,
        disposition_category: l.disposition_category,
        disposition_detail: l.disposition_detail,
        notes: l.notes,
        amount_collected: l.amount_collected,
        created_at: l.created_at,
        outcome: l.outcome,
        accounts_status: l.accounts_status,
      };
    });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const requestData = async (req, res) => {
  try {
    const workerId = req.user.id;
    const ngoId = req.user.ngo_id;
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const { data: worker } = await supabase.from('workers').select('name').eq('id', workerId).maybeSingle();
    const froName = worker?.name || 'Unknown';

    const { data, error } = await supabase
      .from('fro_data_requests')
      .insert([{ fro_worker_id: workerId, message: message.trim(), status: 'pending', ngo_id: req.user.ngo_id || null }])
      .select()
      .single();
    if (error) throw error;

    return res.json({ message: 'Request sent successfully', data });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getMyDataRequests = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { data, error } = await supabase
      .from('fro_data_requests')
      .select('*')
      .eq('fro_worker_id', workerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json(data || []);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getFollowUps = async (req, res) => {
  try {
    const workerId = req.user.id;
    const stationNames = await getMyStationNames(workerId);
    if (stationNames.length === 0) return res.json([]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const { data: contacts, error } = await supabase
      .from('fro_scheduled_contacts')
      .select('*, fro_assignments!inner(id, donor_id, ngo_id, station,  ngos(name))')
      .eq('is_completed', false)
      .in('fro_assignments.station', stationNames)
      .gte('scheduled_at', todayStart.toISOString())
      .lte('scheduled_at', todayEnd.toISOString())
      .order('scheduled_at', { ascending: true });

    if (error) throw error;

    const donorIds = [...new Set((contacts || []).map(c => c.fro_assignments?.donor_id).filter(Boolean))];
    const { data: donors } = donorIds.length > 0
      ? await supabase.from('donor_profiles').select('id, name, mobile_number').in('id', donorIds)
      : { data: [] };
    const donorMap = {};
    for (const d of donors || []) donorMap[d.id] = d;

    const now = new Date();
    const result = (contacts || []).map(c => {
      const a = c.fro_assignments;
      const d = donorMap[a?.donor_id] || {};
      return {
        id: c.id,
        donor_id: a?.donor_id,
        ngo_id: a?.ngo_id,
        ngo_name: a?.ngos?.name || '',
        donor_name: d.name || 'Unknown',
        donor_mobile: d.mobile_number || '',
        scheduled_at: c.scheduled_at,
        notes: c.notes,
        assignment_id: a?.id,
        is_overdue: new Date(c.scheduled_at) < now,
      };
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getLeadStats = async (req, res) => {
  try {
    const workerId = req.user.id;
    const stationNames = await getMyStationNames(workerId);
    if (stationNames.length === 0) return res.json({ new_donors: 0, new_amount: 0, existing_donors: 0, existing_amount: 0 });

    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const monthStart = month + '-01';
    const monthEndDate = new Date(new Date(monthStart).getFullYear(), new Date(monthStart).getMonth() + 1, 0);
    const monthEnd = monthEndDate.toISOString().slice(0, 10) + 'T23:59:59.999Z';

    const { data: logs, error } = await supabase
      .from('fro_donor_logs')
      .select('donor_id, amount_collected, fro_assignments!inner(id, station, donor_id)')
      .eq('action', 'donation')
      .in('fro_assignments.station', stationNames)
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd);

    if (error) throw error;

    const donorIds = [...new Set((logs || []).map(l => l.donor_id).filter(Boolean))];
    const { data: existingDonations } = donorIds.length > 0
      ? await supabase
          .from('fro_donor_logs')
          .select('donor_id, amount_collected')
          .in('donor_id', donorIds)
          .eq('action', 'donation')
          .lt('created_at', monthStart)
      : { data: [] };

    const existingSet = new Set((existingDonations || []).map(e => e.donor_id));

    let newDonors = 0, newAmount = 0, existingDonors = 0, existingAmount = 0;
    const seen = new Set();
    for (const l of logs || []) {
      if (seen.has(l.donor_id)) continue;
      seen.add(l.donor_id);
      const amount = parseFloat(l.amount_collected) || 0;
      if (existingSet.has(l.donor_id)) {
        existingDonors++;
        existingAmount += amount;
      } else {
        newDonors++;
        newAmount += amount;
      }
    }

    return res.json({ new_donors: newDonors, new_amount: newAmount, existing_donors: existingDonors, existing_amount: existingAmount });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getMonthlyDonors = async (req, res) => {
  try {
    const workerId = req.user.id;
    const stationNames = await getMyStationNames(workerId);
    if (stationNames.length === 0) return res.json([]);

    const month = req.query.month || new Date().toISOString().slice(0, 7);

    const monthStart = month + '-01';
    const monthEndDate = new Date(new Date(monthStart).getFullYear(), new Date(monthStart).getMonth() + 1, 0);
    const monthEnd = monthEndDate.toISOString().slice(0, 10) + 'T23:59:59.999Z';

    const { data: assignments, error } = await supabase
      .from('fro_assignments')
      .select('*, donor_profiles!inner(id, name, mobile_number, amount, total_amount, donation_count, city), ngos(name)')
      .in('station', stationNames)
      .not('status', 'eq', 'reassigned')
      .gte('donor_profiles.donation_count', 3);

    if (error) throw error;

    const { data: existingLogs } = await supabase
      .from('fro_donor_logs')
      .select('donor_id')
      .in('donor_id', [...new Set((assignments || []).map(a => a.donor_id).filter(Boolean))])
      .eq('action', 'donation')
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd);

    const alreadyDone = new Set((existingLogs || []).map(l => l.donor_id));

    const seen = new Set();
    const result = [];
    for (const a of assignments || []) {
      const key = `${a.donor_id}-${a.ngo_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const d = a.donor_profiles;
      if (!d || alreadyDone.has(d.id)) continue;
      result.push({
        donor_id: d.id,
        ngo_id: a.ngo_id,
        ngo_name: a.ngos?.name || '',
        donor_name: d.name || 'Unknown',
        donor_mobile: d.mobile_number || '',
        donor_city: d.city || '',
        amount: d.amount || 0,
        total_donated: d.total_amount || 0,
        donation_count: d.donation_count || 0,
      });
    }

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getDonorHistory = async (req, res) => {
  try {
    const workerId = req.user.id;
    const donorId = parseInt(req.params.id);
    const period = req.query.period || 'monthly';

    const now = new Date();
    let startDate;
    if (period === 'financial_year') {
      const year = now.getFullYear();
      startDate = now.getMonth() < 3 ? `${year - 1}-04-01` : `${year}-04-01`;
    } else {
      startDate = now.toISOString().slice(0, 7) + '-01';
    }

    const { data: logs, error } = await supabase
      .from('fro_donor_logs')
      .select('*')
      .eq('donor_id', donorId)
      .gte('created_at', startDate)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const { data: donors } = await supabase
      .from('donor_profiles')
      .select('id, name, mobile_number, amount, total_amount, donation_count, city, pan_number, email, address_1')
      .eq('id', donorId)
      .maybeSingle();

    return res.json({ donor: donors || null, logs: logs || [] });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateLiveStatus = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { status, current_donor_name, current_donor_id, today_calls, today_talk_seconds, today_skipped, today_idle_seconds, today_break_seconds, on_break, break_type } = req.body;

    const payload = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (current_donor_name !== undefined) payload.current_donor_name = current_donor_name;
    if (current_donor_id !== undefined) payload.current_donor_id = current_donor_id;
    if (today_calls !== undefined) payload.today_calls = today_calls;
    if (today_talk_seconds !== undefined) payload.today_talk_seconds = today_talk_seconds;
    if (today_skipped !== undefined) payload.today_skipped = today_skipped;
    if (today_idle_seconds !== undefined) payload.today_idle_seconds = today_idle_seconds;
    if (today_break_seconds !== undefined) payload.today_break_seconds = today_break_seconds;
    if (on_break !== undefined) payload.on_break = on_break;
    if (break_type !== undefined) payload.break_type = break_type;

    if (status === 'on_call' && current_donor_name) {
      payload.call_started_at = new Date().toISOString();
    }
    if (status === 'idle' || status === 'online') {
      payload.call_started_at = null;
    }
    if (status === 'break') {
      payload.break_started_at = new Date().toISOString();
      payload.on_break = true;
    }
    if (status !== 'break') {
      payload.break_started_at = null;
      payload.on_break = false;
    }

    const { data: existing } = await supabase
      .from('fro_live_status')
      .select('id')
      .eq('worker_id', workerId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('fro_live_status')
        .update(payload)
        .eq('worker_id', workerId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('fro_live_status')
        .insert([{ worker_id: workerId, ...payload }]);
      if (error) throw error;
    }

    return res.json({ message: 'Status updated' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── Progress Save/Restore ──────────────────────────────────────

export const getMyProgress = async (req, res) => {
  try {
    const { data } = await supabase
      .from('fro_live_status')
      .select('new_donor_id, old_donor_id, new_donor_index, old_donor_index, data_tab, current_batch_id, station')
      .eq('worker_id', req.user.id)
      .maybeSingle();
    return res.json(data || {});
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const saveMyProgress = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { new_donor_id, old_donor_id, new_donor_index, old_donor_index, data_tab, current_batch_id, station } = req.body;
    const tab = data_tab || 'new';
    const payload = {
      data_tab: tab,
      current_batch_id: current_batch_id || null,
      station: station || null,
      updated_at: new Date().toISOString(),
    };
    if (tab === 'new') {
      payload.new_donor_id = new_donor_id || null;
      payload.new_donor_index = new_donor_index ?? null;
    } else {
      payload.old_donor_id = old_donor_id || null;
      payload.old_donor_index = old_donor_index ?? null;
    }

    const { data: existing } = await supabase
      .from('fro_live_status')
      .select('id')
      .eq('worker_id', workerId)
      .maybeSingle();
    if (existing) {
      await supabase.from('fro_live_status').update(payload).eq('worker_id', workerId);
    } else {
      await supabase.from('fro_live_status').insert([{ worker_id: workerId, ...payload }]);
    }
    return res.json({ message: 'Progress saved' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getLiveStatuses = async (req, res) => {
  try {
    let query = supabase
      .from('fro_live_status')
      .select('*, workers!inner(id, name, login_id, ngo_id, is_active, department)')
      .order('updated_at', { ascending: false });

    const { ngo_id: filterNgoId, fro_id: filterFroId } = req.query;
    if (filterFroId) {
      query = query.eq('worker_id', filterFroId);
    }
    if (filterNgoId && filterNgoId !== 'all') {
      query = query.eq('workers.ngo_id', filterNgoId);
    } else if (req.user.ngo_id && req.user.role !== 'super_admin' && !filterFroId) {
      query = query.eq('workers.ngo_id', req.user.ngo_id);
    }

    const { data: liveStatuses, error } = await query;
    if (error) throw error;
    if (!liveStatuses || liveStatuses.length === 0) return res.json([]);

    const workerIds = liveStatuses.map(ls => ls.worker_id);
    const todayStr = new Date().toISOString().slice(0, 10);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(Date.now() + istOffset);
    const todayStart = new Date(Date.UTC(istNow.getFullYear(), istNow.getMonth(), istNow.getDate(), 0, 0, 0, 0)).toISOString();
    const todayEnd = new Date(Date.UTC(istNow.getFullYear(), istNow.getMonth(), istNow.getDate(), 23, 59, 59, 999)).toISOString();

    const [ngoData, attendanceData, collectionData, assignmentData] = await Promise.all([
      supabase
        .from('worker_ngo_allocations')
        .select('worker_id, ngos(name)')
        .in('worker_id', workerIds),
      supabase
        .from('attendance')
        .select('worker_id, status')
        .eq('date', todayStr)
        .in('worker_id', workerIds),
      supabase
        .from('fro_donor_logs')
        .select('amount_collected, fro_assignments!inner(fro_worker_id), action, disposition_detail, accounts_status, created_at, verified_at')
        .in('fro_assignments.fro_worker_id', workerIds)
        .or(
          `and(action.eq.donation,created_at.gte.${todayStart},created_at.lte.${todayEnd}),` +
          `and(disposition_detail.eq.lead_done,action.eq.disposition,accounts_status.eq.verified,verified_at.gte.${todayStart},verified_at.lte.${todayEnd})`
        ),
      supabase
        .from('fro_assignments')
        .select('fro_worker_id, status')
        .in('fro_worker_id', workerIds),
    ]);

    const ngoMap = {};
    (ngoData.data || []).forEach(a => {
      if (a.ngos?.name) ngoMap[a.worker_id] = a.ngos.name;
    });

    const punchedInSet = new Set();
    (attendanceData.data || []).forEach(a => {
      if (a.status === 'present' || a.status === 'late') punchedInSet.add(a.worker_id);
    });

    const collectionMap = {};
    (collectionData.data || []).forEach(log => {
      const wid = log.fro_assignments?.fro_worker_id;
      if (wid) collectionMap[wid] = (collectionMap[wid] || 0) + parseFloat(log.amount_collected || 0);
    });

    const statsMap = {};
    (assignmentData.data || []).forEach(a => {
      if (!statsMap[a.fro_worker_id]) {
        statsMap[a.fro_worker_id] = { total: 0, contacted: 0, donation_collected: 0, follow_up: 0 };
      }
      const s = statsMap[a.fro_worker_id];
      s.total++;
      const status = (a.status || '').toLowerCase();
      if (['contacted', 'donation_collected', 'follow_up', 'payment_pending', 'already_donated', 'language_barrier', 'transferred_senior', 'query_complaint', 'receipt_request', 'visit_donate', 'promise_to_pay'].includes(status)) {
        s.contacted++;
      }
      if (status === 'donation_collected' || status === 'lead_done') {
        s.donation_collected++;
      }
      if (status === 'follow_up') {
        s.follow_up++;
      }
    });

    const result = liveStatuses.map(ls => {
      const stats = statsMap[ls.worker_id] || { total: 0, contacted: 0, donation_collected: 0, follow_up: 0 };
      const dataUsed = stats.contacted + stats.donation_collected + stats.follow_up;
      const totalActive = (ls.today_talk_seconds || 0) + (ls.today_idle_seconds || 0);
      const productivity = totalActive > 0 ? Math.round(((ls.today_talk_seconds || 0) / totalActive) * 100) : null;

      return {
        id: ls.id,
        worker_id: ls.worker_id,
        status: ls.status,
        current_donor_name: ls.current_donor_name,
        current_donor_id: ls.current_donor_id,
        call_started_at: ls.call_started_at,
        break_started_at: ls.break_started_at,
        on_break: ls.on_break,
        break_type: ls.break_type,
        worker: {
          name: ls.workers?.name || 'Unknown',
          login_id: ls.workers?.login_id || '',
          ngo_id: ls.workers?.ngo_id,
          ngo_name: ngoMap[ls.worker_id] || '',
          is_active: ls.workers?.is_active !== false,
          is_punched_in: punchedInSet.has(ls.worker_id),
          department: ls.workers?.department || '',
        },
        performance: {
          today_calls: ls.today_calls || 0,
          today_talk_seconds: ls.today_talk_seconds || 0,
          today_skipped: ls.today_skipped || 0,
          today_idle_seconds: ls.today_idle_seconds || 0,
          today_break_seconds: ls.today_break_seconds || 0,
          today_collection: collectionMap[ls.worker_id] || 0,
          total_data: stats.total,
          data_used: dataUsed,
          data_unused: stats.total - dataUsed,
          data_usage_pct: stats.total > 0 ? Math.round((dataUsed / stats.total) * 100) : 0,
          productivity_pct: productivity,
        },
        computed: {
          call_duration_seconds: ls.status === 'on_call' && ls.call_started_at
            ? Math.floor((Date.now() - new Date(ls.call_started_at).getTime()) / 1000) : null,
          break_duration_seconds: ls.status === 'break' && ls.break_started_at
            ? Math.floor((Date.now() - new Date(ls.break_started_at).getTime()) / 1000) : null,
          is_long_break: (ls.today_break_seconds || 0) > 3600,
          last_seen: ls.updated_at,
        },
        updated_at: ls.updated_at,
      };
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const searchDonors = async (req, res) => {
  try {
    const workerId = req.user.id;
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json([]);

    const stationNames = await getMyStationNames(workerId);
    if (stationNames.length === 0) return res.json([]);

    const searchTerm = `%${q.trim()}%`;

    const { data: donors, error } = await supabase
      .from('donor_profiles')
      .select('id, name, mobile_number, city, amount, total_amount, donation_count, email, pan_number, address_1, birth_date, project_supported, last_donation_date, first_donation_date')
      .or(`name.ilike.${searchTerm},mobile_number.ilike.${searchTerm}`)
      .limit(20);

    if (error) throw error;
    if (!donors || donors.length === 0) return res.json([]);

    const donorIds = donors.map(d => d.id);

    const { data: assignments, error: asgnError } = await supabase
      .from('fro_assignments')
      .select('*, ngos!inner(name)')
      .in('donor_id', donorIds)
      .in('station', stationNames)
      .not('status', 'eq', 'reassigned');
    if (asgnError) throw asgnError;

    const result = [];
    const seen = new Set();
    for (const d of donors) {
      const matchingAssignments = (assignments || []).filter(a => a.donor_id === d.id);
      if (matchingAssignments.length === 0) continue;
      for (const a of matchingAssignments) {
        const key = `${d.id}-${a.ngo_id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({
          donor_id: d.id,
          ngo_id: a.ngo_id,
          ngo_name: a.ngos?.name || 'Unknown',
          assignment_id: a.id,
          station: a.station || '',
          donor_name: d.name || 'Unknown',
          donor_mobile: d.mobile_number || '',
          donor_city: d.city || '',
          donor_amount: d.amount || 0,
          donor_email: d.email || '',
          donor_pan: d.pan_number || '',
          donor_project: d.project_supported || '',
          donor_dob: d.birth_date || '',
          donor_address: d.address_1 || '',
          donation_count: d.donation_count || 0,
          total_donated: d.total_amount || 0,
          status: a.status || 'pending',
        });
      }
    }

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getFullDonorHistory = async (req, res) => {
  try {
    const workerId = req.user.id;
    const donorId = parseInt(req.params.id);
    const ngoId = parseInt(req.query.ngo_id) || null;
    const unlockAll = req.query.unlock_all === 'true';

    const stationNames = await getMyStationNames(workerId);
    if (stationNames.length === 0) return res.json({ donor: null, logs: [] });

    const { data: donor } = await supabase
      .from('donor_profiles')
      .select('id, name, mobile_number, amount, total_amount, donation_count, city, pan_number, email, address_1, birth_date, project_supported, last_donation_date, first_donation_date')
      .eq('id', donorId)
      .maybeSingle();

    let query = supabase
      .from('fro_assignments')
      .select('id')
      .eq('donor_id', donorId)
      .in('station', stationNames)
      .not('status', 'eq', 'reassigned');
    if (ngoId) query = query.eq('ngo_id', ngoId);

    const { data: assignments } = await query;
    if (!assignments || assignments.length === 0) return res.json({ donor, logs: [] });

    const assignmentIds = assignments.map(a => a.id);

    let logsQuery = supabase
      .from('fro_donor_logs')
      .select('*')
      .in('assignment_id', assignmentIds)
      .order('created_at', { ascending: false });

    if (!unlockAll) {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      logsQuery = logsQuery.gte('created_at', twoYearsAgo.toISOString());
    }

    const { data: logs, error } = await logsQuery;
    if (error) throw error;

    return res.json({ donor: donor || null, logs: logs || [] });
  } catch (error) {
    console.error('getFullDonorHistory error:', error.message);
    return res.status(500).json({ message: error.message });
  }
};
