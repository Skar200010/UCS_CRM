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
    .insert([{ donor_id: donorId, fro_worker_id: workerId, ngo_id: ngoId, status: 'pending', station }])
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
      const { count } = await supabase
        .from('fro_assignments')
        .select('id', { count: 'exact', head: true })
        .in('station', stationNames)
        .not('status', 'eq', 'reassigned');
      totalDonors = count || 0;
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
    const autoTarget = calculateAutoTarget(currentSalary, monthsEmployed);
    if (autoTarget !== null) {
      target = autoTarget;
      targetSource = monthsEmployed <= 0 ? 'month1' : monthsEmployed === 1 ? 'month2' : 'month3';
    } else {
      const manualTarget = await getTargetByWorker(workerId, monthStr);
      target = manualTarget ? parseFloat(manualTarget.target_amount) : 0;
      targetSource = manualTarget ? 'manual' : 'not_set';
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [monthlyConnectedRes, dailyConnectedRes, dailyDonationsRes, totalDonationsRes, assignmentsRes] = stationNames.length > 0
      ? await Promise.all([
          supabase.from('fro_donor_logs').select('donor_id, fro_assignments!inner(station)').in('fro_assignments.station', stationNames).gte('created_at', monthStart).lte('created_at', monthEnd),
          supabase.from('fro_donor_logs').select('donor_id, fro_assignments!inner(station)').in('fro_assignments.station', stationNames).gte('created_at', todayStart.toISOString()).lte('created_at', todayEnd.toISOString()),
          supabase.from('fro_donor_logs').select('amount_collected, fro_assignments!inner(station)').in('fro_assignments.station', stationNames).gte('created_at', todayStart.toISOString()).lte('created_at', todayEnd.toISOString()),
          supabase.from('fro_donor_logs').select('amount_collected, fro_assignments!inner(station)').in('fro_assignments.station', stationNames),
          supabase.from('fro_assignments').select('status').in('station', stationNames).not('status', 'eq', 'reassigned'),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

    const connectedStatuses = new Set(['contacted', 'donation_collected', 'lead_done', 'follow_up', 'scheduled', 'visit_donate', 'promise_to_pay', 'payment_pending', 'already_donated', 'language_barrier', 'transferred_senior', 'query_complaint', 'receipt_request']);
    let dataUsed = 0, dataUnused = 0;
    for (const a of assignmentsRes.data || []) {
      if (connectedStatuses.has(a.status)) dataUsed++;
      else dataUnused++;
    }

    const monthlyDonorIds = new Set((monthlyConnectedRes.data || []).map(l => l.donor_id).filter(Boolean));
    const dailyDonorIds = new Set((dailyConnectedRes.data || []).map(l => l.donor_id).filter(Boolean));
    let dailyDonations = 0;
    for (const l of dailyDonationsRes.data || []) dailyDonations += parseFloat(l.amount_collected || 0);
    let totalDonations = 0;
    for (const l of totalDonationsRes.data || []) totalDonations += parseFloat(l.amount_collected || 0);

    return res.json({
      stats,
      target,
      target_source: targetSource,
      collected,
      salary: currentSalary,
      months_employed: monthsEmployed,
      monthly_connected: monthlyDonorIds.size,
      daily_connected: dailyDonorIds.size,
      daily_donations: dailyDonations,
      data_used: dataUsed,
      data_unused: dataUnused,
      total_donations: totalDonations,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getMyDonors = async (req, res) => {
  try {
    const workerId = req.user.id;
    const statusFilter = req.query.status;

    // Query fro_assignments by this FRO's station names (not fro_worker_id,
    // since stations may not have an FRO assigned)
    const stationNames = await getMyStationNames(workerId);
    if (stationNames.length === 0) return res.json([]);

    let query = supabase
      .from('fro_assignments')
      .select('*, ngos(name)')
      .in('station', stationNames)
      .not('status', 'eq', 'reassigned');

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    } else {
      query = query.eq('status', 'pending');
    }

    const { data: assignments } = await query;

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
      if (!scheduleMap[s.assignment_id]) {
        scheduleMap[s.assignment_id] = s;
      }
    }

    const result = [];
    const seen = new Set();
    for (const a of assignments || []) {
      const d = donorMap[a.donor_id];
      if (!d) continue;
      const key = `${a.donor_id}-${a.ngo_id}`;
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
    console.error('getMyDonors error for worker', req.user?.id, ':', error.message);
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
    const { action, notes, outcome, amount_collected, disposition_category, disposition_detail, scheduled_at, payment_screenshot_url, pan_number, donor_address, donor_dob, ngo_id, project_name } = req.body;

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
      accounts_status: null,
      created_by: workerId,
    };

    if (action === 'disposition' && disposition_detail === 'lead_done' && amount_collected) {
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

    return res.json({ message: 'Log entry created', data: log });
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
    const autoTarget = calculateAutoTarget(currentSalary, monthsEmployed);
    if (autoTarget !== null) {
      target = autoTarget;
      targetSource = 'auto';
    } else {
      const manualTarget = await getTargetByWorker(workerId, monthStr);
      target = manualTarget ? parseFloat(manualTarget.target_amount) : 0;
      targetSource = manualTarget ? 'manual' : 'not_set';
    }

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
    } catch (_) { /* keep defaults */ }

    return res.json({
      month: monthStr,
      target,
      target_source: targetSource,
      collected,
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
      .in('status', ['follow_up', 'scheduled']);

    if (error) throw error;

    const assignmentIds = (assignments || []).map(a => a.id);
    const [donorsRes, schedulesRes] = await Promise.all([
      supabase.from('donor_profiles').select('id, name, mobile_number')
        .in('id', [...new Set(assignments.map(a => a.donor_id).filter(Boolean))]),
      assignmentIds.length > 0
        ? supabase.from('fro_scheduled_contacts').select('assignment_id').in('assignment_id', assignmentIds).eq('is_completed', false)
        : { data: [] },
    ]);

    const donorMap = {};
    for (const d of donorsRes.data || []) donorMap[d.id] = d;
    const activeAssignmentIds = new Set((schedulesRes.data || []).map(s => s.assignment_id));

    const seen = new Set();
    const result = [];
    for (const a of assignments || []) {
      if (activeAssignmentIds.has(a.id)) continue;
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
