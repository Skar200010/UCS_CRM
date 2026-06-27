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
} from '../models/froStationAssignmentModel.js';
import { upsertTarget, getTargetsByNgo, getTargetByWorker } from '../models/froTargetModel.js';
import { getTotalCollectedByWorker } from '../models/froDonorLogModel.js';
import { getWorkersByNgo } from '../models/workerNgoAllocationModel.js';

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
    const { search, limit } = req.query;
    const access = await getUserNgoAccess(req.user.id);
    const ngoNames = access.map(a => a.ngo_name).filter(Boolean);

    let donors;
    if (ngoNames.length > 0) {
      donors = await getDonorProfilesByImportNgo(ngoNames, parseInt(limit) || 1000);
    } else if (req.user.ngo_id) {
      const { data: ngo } = await supabase.from('ngos').select('name').eq('id', req.user.ngo_id).single();
      donors = ngo ? await getDonorProfilesByImportNgo([ngo.name], parseInt(limit) || 1000) : [];
    } else {
      donors = [];
    }

    if (search) {
      const q = search.toLowerCase();
      donors = donors.filter(d =>
        (d.name && d.name.toLowerCase().includes(q)) ||
        (d.city && d.city.toLowerCase().includes(q)) ||
        (d.mobile_number && d.mobile_number.includes(q))
      );
    }

    return res.json(donors);
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
    const targetMonth = month || new Date().toISOString().slice(0, 7) + '-01';

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
    for (const t of allManualTargets) {
      manualMap[t.fro_worker_id] = parseFloat(t.target_amount);
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
      };
    }));

    return res.json(result);
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

    const allWorkers = [];
    for (const ngoId of ngoIds) {
      const workers = await getFroWorkersByNgo(ngoId);
      allWorkers.push(...workers);
    }
    const seen = new Set();
    const froWorkers = allWorkers.filter(w => { const k = w.id; if (seen.has(k)) return false; seen.add(k); return true; });

    let totalDonors = [];
    if (ngoNames.length > 0) {
      totalDonors = await getDonorProfilesByImportNgo(ngoNames, 100000);
    }

    const allAssignments = [];
    for (const ngoId of ngoIds) {
      const assignments = await findAssignmentsByNgo(ngoId);
      allAssignments.push(...assignments);
    }
    const assignedCount = allAssignments.length;
    const collectedDonations = allAssignments.filter(a => a.status === 'donation_collected');

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

    let monthCollection = 0;
    for (const w of froWorkers) {
      monthCollection += await getTotalCollectedByWorker(w.id, monthStart, monthEnd);
    }

    return res.json({
      total_donors: totalDonors.length,
      assigned_donors: assignedCount,
      collected_donors: collectedDonations.length,
      active_fros: froWorkers.filter(w => w.is_active !== false).length,
      month_collection: monthCollection,
    });
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
        payment_screenshot_url, accounts_status, pan_number, notes, created_at,
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
    const access = await getUserNgoAccess(req.user.id);
    const ngoNames = access.map(a => a.ngo_name).filter(Boolean);
    const ngoIds = access.map(a => a.ngo_id).filter(Boolean);

    if (ngoNames.length === 0 && req.user.ngo_id) {
      const { data: ngo } = await supabase.from('ngos').select('name').eq('id', req.user.ngo_id).single();
      if (ngo) { ngoNames.push(ngo.name); ngoIds.push(req.user.ngo_id); }
    }

    if (ngoIds.length === 0) return res.json([]);

    // Get all station assignments (including unassigned)
    const assignments = await getStationAssignmentsByNgo(ngoIds, true);

    // Get donor counts per station from fro_assignments (not donor_profiles.station,
    // since donor_profiles are mobile-unique and station gets overwritten per-NGO)
    // Exclude reassigned so transferred leads don't inflate the count
    const { data: faData, error: faErr } = await supabase
      .from('fro_assignments')
      .select('station, ngo_id, fro_worker_id')
      .in('ngo_id', ngoIds)
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
    for (const a of access) {
      ngoIdToName[a.ngo_id] = a.ngo_name;
    }
    if (req.user.ngo_id && !ngoIdToName[req.user.ngo_id]) {
      const { data: ngo } = await supabase.from('ngos').select('name').eq('id', req.user.ngo_id).single();
      if (ngo) ngoIdToName[req.user.ngo_id] = ngo.name;
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
    const { station, ngo_ids } = req.body;
    if (!station) {
      return res.status(400).json({ message: 'station name is required' });
    }

    const stationName = station.trim();
    const records = [];

    if (ngo_ids && ngo_ids.length > 0) {
      for (const ngo_id of ngo_ids) {
        const { data: existing } = await supabase
          .from('fro_station_assignments')
          .select('id')
          .eq('station', stationName)
          .eq('ngo_id', ngo_id)
          .maybeSingle();
        if (existing) continue;
        records.push({ station: stationName, ngo_id, assigned_by: req.user.id });
      }
    } else {
      const { data: existing } = await supabase
        .from('fro_station_assignments')
        .select('id')
        .eq('station', stationName)
        .is('ngo_id', null)
        .maybeSingle();
      if (!existing) {
        records.push({ station: stationName, ngo_id: null, assigned_by: req.user.id });
      }
    }

    if (records.length === 0) {
      return res.json({ message: 'already exists' });
    }

    const { data, error } = await supabase
      .from('fro_station_assignments')
      .insert(records)
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
    const { ngo_ids, fro_worker_id } = req.body;
    if (!ngo_ids || !Array.isArray(ngo_ids)) {
      return res.status(400).json({ message: 'ngo_ids array is required' });
    }

    const access = await getUserNgoAccess(req.user.id);
    const allowedNgoIds = new Set(access.map(a => a.ngo_id));

    // Only allow assigning NGOs the user has access to
    const validNgoIds = ngo_ids.filter(id => allowedNgoIds.has(id));

    // Delete all existing rows for this station (including null-ngo)
    const { error: delErr } = await supabase
      .from('fro_station_assignments')
      .delete()
      .eq('station', station.trim());
    if (delErr) throw delErr;

    // If no NGOs selected, station becomes unassigned
    if (validNgoIds.length === 0) {
      const { error: insErr } = await supabase
        .from('fro_station_assignments')
        .insert([{ station: station.trim(), assigned_by: req.user.id, fro_worker_id: fro_worker_id || null }]);
      if (insErr) throw insErr;
      return res.json({ message: 'Station NGOs cleared' });
    }

    // Insert new assignments for selected NGOs
    const rows = validNgoIds.map(ngo_id => ({
      ngo_id,
      station: station.trim(),
      assigned_by: req.user.id,
      fro_worker_id: fro_worker_id || null,
    }));
    const { error: insErr } = await supabase
      .from('fro_station_assignments')
      .insert(rows);
    if (insErr) throw insErr;

    return res.json({ message: 'Station NGOs updated' });
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

    if (ngoIds.length === 0) return res.json({ stations: {}, summary: {} });

    const stationMap = {};
    const summary = {};

    for (const ngoId of ngoIds) {
      const stats = await getStationDispositionStats(ngoId);
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

    if (ngoNames.length === 0 && req.user.ngo_id) {
      const { data: ngo } = await supabase.from('ngos').select('name').eq('id', req.user.ngo_id).single();
      if (ngo) ngoNames = [ngo.name];
    }

    if (ngoNames.length === 0) {
      return res.json({ unassigned: [], ngo_data: [] });
    }

    // 1. new_data for admin's NGOs that are still pending conversion
    const { data: importedRows, error: iErr } = await supabase
      .from('new_data')
      .select('name, mobile_number, category, amount, created_at, ngo')
      .in('ngo', ngoNames)
      .not('mobile_number', 'is', null)
      .or('status.eq.pending,status.is.null')
      .order('created_at', { ascending: false });

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
      const { data: existingProfiles, error: pErr } = await supabase
        .from('donor_profiles')
        .select('mobile_number')
        .in('mobile_number', mobiles);

      if (pErr) throw pErr;
      const existingMobiles = new Set(existingProfiles.map(p => p.mobile_number));
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

    return res.json({ unassigned, ngo_data: ngoData });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};



export const distributeNewData = async (req, res) => {
  try {
    const { stations: selectedStations } = req.body;
    const access = await getUserNgoAccess(req.user.id);
    const ngoEntries = access.map(a => ({ ngoId: a.ngo_id, ngoName: a.ngo_name })).filter(e => e.ngoId);
    if (ngoEntries.length === 0 && req.user.ngo_id) {
      const { data: ngo } = await supabase.from('ngos').select('name').eq('id', req.user.ngo_id).single();
      if (ngo) ngoEntries.push({ ngoId: req.user.ngo_id, ngoName: ngo.name });
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
      if (importedRows && importedRows.length > 0) {
        const latest = {};
        for (const row of importedRows) {
          if (!latest[row.mobile_number]) latest[row.mobile_number] = row;
        }
        const mobiles = Object.keys(latest);

        const { data: existingProfiles } = await supabase
          .from('donor_profiles')
          .select('id, mobile_number')
          .in('mobile_number', mobiles);

        const existingMap = {};
        for (const p of existingProfiles || []) existingMap[p.mobile_number] = p.id;

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
          const convertedCount = toInsert.length;
          await updateNewDataStatusByNgoAndMobiles(ngoName, mobiles, 'converted');
          totalConverted += convertedCount;
          messages.push(`${convertedCount} new donors converted to profiles (${ngoName})`);
        }
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
      // Find profiles by mobile numbers (profiles are mobile-unique, not NGO-unique)
      let existingProfileIds = [];
      if (importedRows && importedRows.length > 0) {
        const allMobiles = [...new Set(importedRows.map(r => r.mobile_number).filter(Boolean))];
        if (allMobiles.length > 0) {
          const { data: profiles } = await supabase
            .from('donor_profiles')
            .select('id')
            .in('mobile_number', allMobiles);
          existingProfileIds = (profiles || []).map(p => p.id);
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
        });
      }

      if (newAssignments.length > 0) {
        console.log(`[${ngoName}] creating ${newAssignments.length} fro_assignments`);
        await batchCreateAssignments(newAssignments);
        totalAssigned += newAssignments.length;
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
    return res.json({ message: 'Alert acknowledged' });
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
    return res.json({ message: 'Request resolved successfully' });
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
      .from('donors')
      .select('id, name, mobile, lead_status')
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
