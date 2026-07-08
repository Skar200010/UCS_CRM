import { getAllNgos } from '../models/ngoModel.js';
import { getAllUsers, getUsersCountByRole } from '../models/userModel.js';
import { getAllHRs } from '../models/hrModel.js';
import { getAllWorkers } from '../models/workerModel.js';
import { getDashboardStats } from '../models/froAssignmentModel.js';
import { getTotalCollectedByWorker } from '../models/froDonorLogModel.js';
import supabase from '../config/supabase.js';

function calcDateRange(period) {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);

  let from, prevFrom, prevTo;
  const dur = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : period === '1y' ? 365 : null;

  if (dur) {
    const s = new Date(now); s.setDate(s.getDate() - dur + 1);
    from = s.toISOString().slice(0, 10);
    const ps = new Date(s); ps.setDate(ps.getDate() - dur);
    prevFrom = ps.toISOString().slice(0, 10);
    const pe = new Date(s); pe.setDate(pe.getDate() - 1);
    prevTo = pe.toISOString().slice(0, 10);
  } else {
    from = '1970-01-01';
    prevFrom = '1970-01-01';
    prevTo = '1970-01-01';
  }
  return { from, to: end, prevFrom, prevTo, dur, isAll: !dur };
}

function calcChange(curr, prev) {
  if (!prev || prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100 * 10) / 10;
}

export const getSuperAdminDashboard = async (req, res) => {
  try {
    const period = req.query.period || '30d';
    const range = calcDateRange(period);

    const ngos = await getAllNgos();
    const [users, hrs, workers] = await Promise.all([
      getAllUsers({}),
      getAllHRs({}),
      getAllWorkers(),
    ]);

    /* ── Period-filtered stats ── */
    const userCreated = users.filter(u => u.created_at?.slice(0, 10) >= range.from);
    const workerCreated = workers.filter(w => w.created_at?.slice(0, 10) >= range.from);
    const activeUsers = userCreated.filter(u => u.is_active).length;

    /* ── Previous period stats for change % ── */
    const prevUserCreated = users.filter(u => {
      const d = u.created_at?.slice(0, 10);
      return d >= range.prevFrom && d <= range.prevTo;
    }).length;
    const prevWorkerCreated = workers.filter(w => {
      const d = w.created_at?.slice(0, 10);
      return d >= range.prevFrom && d <= range.prevTo;
    }).length;

    const stats = {
      totalNgos: ngos.length,
      totalUsers: userCreated.length,
      activeUsers,
      totalWorkers: workerCreated.length,
      activeWorkers: workerCreated.filter(w => w.is_active).length,
      totalHr: hrs.length,
      totalRecruiters: userCreated.filter(u => u.role === 'recruiter').length,
      workersJoinedThisMonth: period === 'all'
        ? 0
        : (() => {
            const ms = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
            return workers.filter(w => w.created_at >= ms).length;
          })(),
    };

    /* ── KPI changes ── */
    const kpiChanges = {
      totalNgos: 0,
      totalUsers: calcChange(userCreated.length, prevUserCreated),
      activeUsers: 0,
      totalWorkers: calcChange(workerCreated.length, prevWorkerCreated),
      totalHr: 0,
      totalRecruiters: 0,
    };

    /* ── NGO counts ── */
    const ngoUserCounts = await Promise.all(
      ngos.map(async (ngo) => ({
        id: ngo.id, name: ngo.name, code: ngo.code,
        users: (await getAllUsers({ ngo_id: ngo.id })).filter(
          u => u.created_at?.slice(0, 10) >= range.from
        ).length,
        workers: workers.filter(w => w.ngo_id === ngo.id && w.created_at?.slice(0, 10) >= range.from).length,
      }))
    );

    /* ── Role distribution ── */
    const roleDistribution = {};
    userCreated.forEach(u => {
      roleDistribution[u.role] = (roleDistribution[u.role] || 0) + 1;
    });
    /* all-time role distribution (ignores period filter) */
    const allTimeRoleDistribution = {};
    users.forEach(u => {
      allTimeRoleDistribution[u.role] = (allTimeRoleDistribution[u.role] || 0) + 1;
    });

    /* ── Department worker counts ── */
    const deptWorkers = {};
    workerCreated.forEach(w => {
      if (w.department) deptWorkers[w.department] = (deptWorkers[w.department] || 0) + 1;
    });

    /* ── Gender counts ── */
    const genderCounts = { Male: 0, Female: 0, Other: 0 };
    workerCreated.forEach(w => {
      if (w.gender && genderCounts[w.gender] !== undefined) genderCounts[w.gender]++;
    });

    /* ── Attendance ── */
    const { data: attendance } = await supabase
      .from('attendance')
      .select('status, date, worker_id, punch_in_time')
      .gte('date', range.from)
      .lte('date', range.to);

    const attendanceStatus = { present: 0, late: 0, absent: 0, leave: 0 };
    const uniquePills = { present: new Set(), late: new Set(), absent: new Set(), leave: new Set() };
    const workerDept = {};
    workerCreated.forEach(w => { workerDept[w.id] = w.department; });

    const deptPivot = {};
    const workerMap = {};
    workers.forEach(w => { workerMap[w.id] = { name: w.name, department: w.department }; });

    const attendanceDetails = { present: [], late: [], absent: [] };
    const detailAdded = { present: new Set(), late: new Set(), absent: new Set() };

    const allMarkedInPeriod = new Set();
    (attendance || []).forEach(a => {
      allMarkedInPeriod.add(a.worker_id);
      if (attendanceStatus[a.status] !== undefined) {
        attendanceStatus[a.status]++;
        uniquePills[a.status].add(a.worker_id);
      }
      const dept = workerDept[a.worker_id];
      if (dept) {
        if (!deptPivot[dept]) deptPivot[dept] = { department: dept, present: 0, late: 0, absent: 0 };
        if (deptPivot[dept][a.status] !== undefined) deptPivot[dept][a.status]++;
      }
      if (attendanceDetails[a.status] && !detailAdded[a.status].has(a.worker_id)) {
        detailAdded[a.status].add(a.worker_id);
        const w = workerMap[a.worker_id];
        const time = a.punch_in_time
          ? (() => {
              const ms = new Date(a.punch_in_time).getTime() + 5.5 * 60 * 60 * 1000;
              const d = new Date(ms);
              return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
            })()
          : '';
        attendanceDetails[a.status].push({
          name: w?.name || 'Unknown',
          dept: w?.department || '',
          time,
        });
      }
    });

    // Active workers with no attendance record in the period → mark as absent
    workerCreated.filter(w => w.is_active !== false).forEach(w => {
      if (!allMarkedInPeriod.has(w.id) && !detailAdded.absent.has(w.id)) {
        uniquePills.absent.add(w.id);
        detailAdded.absent.add(w.id);
        attendanceDetails.absent.push({
          name: w.name || 'Unknown',
          dept: w.department || '',
          time: '',
        });
      }
    });

    const attendanceWorkerCounts = {
      present: uniquePills.present.size,
      late: uniquePills.late.size,
      absent: uniquePills.absent.size,
      leave: uniquePills.leave.size,
    };
    const deptAttendance = Object.values(deptPivot);

    const totalAtt = Object.values(attendanceStatus).reduce((s, v) => s + v, 0);
    const attendancePercent = totalAtt > 0
      ? Math.round((attendanceStatus.present / totalAtt) * 1000) / 10
      : 0;

    /* ── Today attendance (for Daily Check-ins pills) ── */
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const todayDate = `${istNow.getUTCFullYear()}-${String(istNow.getUTCMonth() + 1).padStart(2, '0')}-${String(istNow.getUTCDate()).padStart(2, '0')}`;

    const { data: todayRows } = await supabase
      .from('attendance')
      .select('status, worker_id, punch_in_time')
      .eq('date', todayDate);

    const todayUnique = { present: new Set(), late: new Set(), absent: new Set(), leave: new Set() };
    const todayAdded = { present: new Set(), late: new Set(), absent: new Set() };
    const todayAttendanceDetails = { present: [], late: [], absent: [] };

    const todayMarked = new Set();
    (todayRows || []).forEach(a => {
      todayMarked.add(a.worker_id);
      if (todayUnique[a.status] !== undefined) todayUnique[a.status].add(a.worker_id);
      if (todayAttendanceDetails[a.status] && !todayAdded[a.status].has(a.worker_id)) {
        todayAdded[a.status].add(a.worker_id);
        const w = workerMap[a.worker_id];
        const time = a.punch_in_time
          ? (() => {
              const ms = new Date(a.punch_in_time).getTime() + istOffset;
              const d = new Date(ms);
              return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
            })()
          : '';
        todayAttendanceDetails[a.status].push({
          name: w?.name || 'Unknown',
          dept: w?.department || '',
          time,
        });
      }
    });

    // Active workers with no attendance record today → mark as absent
    const activeWorkers = workers.filter(w => w.is_active !== false);
    activeWorkers.forEach(w => {
      if (!todayMarked.has(w.id)) {
        todayUnique.absent.add(w.id);
        if (!todayAdded.absent.has(w.id)) {
          todayAdded.absent.add(w.id);
          todayAttendanceDetails.absent.push({
            name: w.name || 'Unknown',
            dept: w.department || '',
            time: '',
          });
        }
      }
    });

    const todayAttendance = {
      present: todayUnique.present.size,
      late: todayUnique.late.size,
      absent: todayUnique.absent.size,
      leave: todayUnique.leave.size,
    };

    /* ── Previous period attendance for comparison ── */
    const { data: prevAtt } = await supabase
      .from('attendance')
      .select('status')
      .gte('date', range.prevFrom)
      .lte('date', range.prevTo);
    const prevAttCount = (prevAtt || []).length;
    const prevPresent = (prevAtt || []).filter(a => a.status === 'present').length;
    const prevAttPercent = prevAttCount > 0 ? Math.round((prevPresent / prevAttCount) * 1000) / 10 : 0;
    kpiChanges.attendancePercent = calcChange(attendancePercent, prevAttPercent);

    /* ── Pending leaves ── */
    const { count: pendingLeaves } = await supabase
      .from('leaves')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    /* ── Monthly trend (based on period range) ── */
    const { data: monthData } = await supabase
      .from('attendance')
      .select('date, status')
      .gte('date', range.from)
      .lte('date', range.to);

    const dateMap = {};
    const startDate = new Date(range.from);
    const endDate = new Date(range.to);
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().slice(0, 10);
      dateMap[ds] = { date: ds, present: 0, late: 0, absent: 0 };
    }
    (monthData || []).forEach(a => {
      if (dateMap[a.date] && dateMap[a.date][a.status] !== undefined) {
        dateMap[a.date][a.status]++;
      }
    });
    const monthlyAttendance = Object.values(dateMap);

    /* ── Salary payable (always all-time) ── */
    const { data: salaries } = await supabase
      .from('salary_history')
      .select('worker_id, salary')
      .is('to_month', null);
    const salarySet = new Set();
    let totalSalaryPayable = 0;
    (salaries || []).forEach(s => {
      if (!salarySet.has(s.worker_id)) {
        salarySet.add(s.worker_id);
        totalSalaryPayable += parseFloat(s.salary || 0);
      }
    });

    /* ── Recent notices ── */
    const { data: recentNotices } = await supabase
      .from('notices')
      .select('id, title, content, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(5);

    /* ── Upcoming events ── */
    const today = new Date().toISOString().slice(0, 10);
    const { data: upcomingEvents } = await supabase
      .from('events')
      .select('id, title, description, event_date, event_time, location')
      .gte('event_date', today)
      .eq('is_active', true)
      .order('event_date', { ascending: true })
      .limit(5);

    /* ── Accounts Summary (lead verification) ── */
    const { data: leadLogs } = await supabase
      .from('fro_donor_logs')
      .select('accounts_status, amount_collected, verified_at')
      .eq('disposition_detail', 'lead_done');
    const accountsSummary = { pending: 0, pendingAmount: 0, verified: 0, verifiedAmount: 0, rejected: 0, rejectedAmount: 0, verifiedToday: 0, verifiedTodayAmount: 0 };
    const todayStr = new Date().toISOString().slice(0, 10);
    for (const log of leadLogs || []) {
      const amt = parseFloat(log.amount_collected || 0);
      if (log.accounts_status === 'pending') { accountsSummary.pending++; accountsSummary.pendingAmount += amt; }
      else if (log.accounts_status === 'verified') {
        accountsSummary.verified++; accountsSummary.verifiedAmount += amt;
        if (log.verified_at && log.verified_at.slice(0, 10) === todayStr) {
          accountsSummary.verifiedToday++; accountsSummary.verifiedTodayAmount += amt;
        }
      }
      else if (log.accounts_status === 'rejected') { accountsSummary.rejected++; accountsSummary.rejectedAmount += amt; }
    }

    /* ── Recruiter Summary ── */
    let recruiterSummary = { totalLeads: 0, newToday: 0, conversionRate: 0 };
    try {
      const { data: allLeads } = await supabase
        .from('leads')
        .select('id, status, created_at');
      const totalLeads = allLeads?.length || 0;
      const newToday = (allLeads || []).filter(l => l.created_at?.slice(0, 10) === todayStr).length;
      const byStatus = {};
      for (const l of allLeads || []) byStatus[l.status] = (byStatus[l.status] || 0) + 1;
      const selected = byStatus['selected'] || 0;
      const rejected = byStatus['rejected'] || 0;
      const conversionRate = (selected + rejected) > 0 ? Math.round((selected / (selected + rejected)) * 1000) / 10 : 0;
      recruiterSummary = { totalLeads, newToday, conversionRate };
    } catch (_) { /* table may not exist */ }

    /* ── Monthly Revenue Trend (last 12 months, verified amounts) ── */
    let monthlyRevenue = [];
    try {
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
      twelveMonthsAgo.setDate(1);
      const fromDate = twelveMonthsAgo.toISOString().slice(0, 10);
      const { data: revenueLogs } = await supabase
        .from('fro_donor_logs')
        .select('amount_collected, verified_at')
        .eq('accounts_status', 'verified')
        .gte('verified_at', fromDate);
      const monthMap = {};
      for (let i = 0; i < 12; i++) {
        const d = new Date(twelveMonthsAgo);
        d.setMonth(d.getMonth() + i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthMap[key] = { month: key, amount: 0, count: 0 };
      }
      for (const log of revenueLogs || []) {
        const key = log.verified_at?.slice(0, 7);
        if (monthMap[key]) {
          monthMap[key].amount += parseFloat(log.amount_collected || 0);
          monthMap[key].count++;
        }
      }
      monthlyRevenue = Object.values(monthMap);
    } catch (_) { monthlyRevenue = []; }

    /* ── Top FROs by total collection (all-time) ── */
    let topFros = [];
    try {
      const allWorkersForFro = await getAllWorkers();
      const froWorkersOnly = allWorkersForFro.filter(w =>
        (w.department || '').toLowerCase().trim() === 'fro'
      );
      const { data: froCollectionLogs } = await supabase
        .from('fro_donor_logs')
        .select('fro_worker_id, amount_collected')
        .not('fro_worker_id', 'is', null);
      const froTotals = {};
      for (const log of froCollectionLogs || []) {
        const wid = log.fro_worker_id;
        if (!froTotals[wid]) froTotals[wid] = 0;
        froTotals[wid] += parseFloat(log.amount_collected || 0);
      }
      topFros = froWorkersOnly
        .map(w => ({ id: w.id, name: w.name, totalCollection: froTotals[w.id] || 0 }))
        .filter(f => f.totalCollection > 0)
        .sort((a, b) => b.totalCollection - a.totalCollection)
        .slice(0, 5);
    } catch (_) { topFros = []; }

    /* ── Top Recruiters by lead count (all-time) ── */
    let topRecruiters = [];
    try {
      const { data: recruiterUsers } = await supabase
        .from('users')
        .select('id, name, login_id')
        .eq('role', 'recruiter');
      const { data: allLeadsForRecruiters } = await supabase
        .from('leads')
        .select('recruiter_id, created_by');
      const recruiterLeadCounts = {};
      for (const ld of allLeadsForRecruiters || []) {
        const rid = ld.recruiter_id || ld.created_by;
        if (rid) recruiterLeadCounts[rid] = (recruiterLeadCounts[rid] || 0) + 1;
      }
      topRecruiters = (recruiterUsers || [])
        .map(u => ({
          id: u.id,
          name: u.name,
          loginId: u.login_id,
          leadCount: recruiterLeadCounts[u.id] || 0,
        }))
        .filter(r => r.leadCount > 0)
        .sort((a, b) => b.leadCount - a.leadCount)
        .slice(0, 5);
    } catch (_) { topRecruiters = []; }

    /* ── Recent Activity Log (union from multiple tables) ── */
    let recentActivities = [];
    try {
      const [verifiedLeads, newLeads, newWorkers, recentNotifications] = await Promise.all([
        supabase
          .from('fro_donor_logs')
          .select('id, amount_collected, verified_at, accounts_status, fro_worker_id')
          .not('accounts_status', 'eq', 'pending')
          .order('verified_at', { ascending: false })
          .limit(5),
        supabase
          .from('leads')
          .select('id, name, status, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('workers')
          .select('id, name, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('notification_log')
          .select('id, message, sent_at, type')
          .order('sent_at', { ascending: false })
          .limit(5),
      ]);

      const activities = [];
      for (const l of verifiedLeads?.data || []) {
        activities.push({
          type: l.accounts_status === 'verified' ? 'verified' : 'rejected',
          message: `${l.accounts_status === 'verified' ? '✓' : '✗'} Lead ${l.accounts_status}`,
          detail: `₹${parseFloat(l.amount_collected || 0).toLocaleString('en-IN')}`,
          time: l.verified_at,
        });
      }
      for (const l of newLeads?.data || []) {
        activities.push({
          type: 'lead_created',
          message: `New lead: ${l.name || 'Unknown'}`,
          detail: `Status: ${l.status}`,
          time: l.created_at,
        });
      }
      for (const w of newWorkers?.data || []) {
        activities.push({
          type: 'worker_joined',
          message: `Worker joined: ${w.name || 'Unknown'}`,
          detail: 'New registration',
          time: w.created_at,
        });
      }
      for (const n of recentNotifications?.data || []) {
        activities.push({
          type: 'notification',
          message: n.message || 'Notification sent',
          detail: n.type || '',
          time: n.sent_at,
        });
      }
      activities.sort((a, b) => {
        const ta = a.time ? new Date(a.time).getTime() : 0;
        const tb = b.time ? new Date(b.time).getTime() : 0;
        return tb - ta;
      });
      recentActivities = activities.slice(0, 10);
    } catch (_) { recentActivities = []; }

    return res.json({
      stats,
      kpiChanges,
      attendancePercent,
      deptAttendance,
      ngoUserCounts,
      roleDistribution,
      deptWorkers,
      genderCounts,
      attendanceStatus,
      attendanceWorkerCounts,
      todayAttendance,
      attendanceDetails,
      todayAttendanceDetails,
      pendingLeaves: pendingLeaves || 0,
      monthlyAttendance,
      totalSalaryPayable,
      recentNotices: recentNotices || [],
      upcomingEvents: upcomingEvents || [],
      accountsSummary,
      recruiterSummary,
      monthlyRevenue,
      topFros,
      topRecruiters,
      recentActivities,
      allTimeRoleDistribution,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getFroLiveStatus = async (req, res) => {
  try {
    const allWorkers = await getAllWorkers();
    const froWorkers = allWorkers.filter(w => (w.department || '').toLowerCase().trim() === 'fro');

    const todayStr = new Date().toISOString().slice(0, 10);

    const { data: todayAttendance } = await supabase
      .from('attendance')
      .select('worker_id, status')
      .eq('date', todayStr)
      .in('worker_id', froWorkers.map(w => w.id));

    const punchedIn = new Set();
    (todayAttendance || []).forEach(a => {
      if (a.status === 'present' || a.status === 'late') punchedIn.add(a.worker_id);
    });

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const todayStart = new Date(Date.UTC(istNow.getFullYear(), istNow.getMonth(), istNow.getDate(), 0, 0, 0, 0));
    const todayEnd = new Date(Date.UTC(istNow.getFullYear(), istNow.getMonth(), istNow.getDate(), 23, 59, 59, 999));

    const result = await Promise.all(froWorkers.map(async (w) => {
      const [stats, todayCollection] = await Promise.all([
        getDashboardStats(w.id),
        getTotalCollectedByWorker(w.id, todayStart.toISOString(), todayEnd.toISOString()),
      ]);

      const dataUsed = (stats.contacted || 0) + (stats.donation_collected || 0) + (stats.follow_up || 0);
      const dataUnused = (stats.total || 0) - dataUsed;

      return {
        id: w.id,
        name: w.name,
        login_id: w.login_id,
        is_active: w.is_active !== false,
        is_punched_in: punchedIn.has(w.id),
        total_data: stats.total || 0,
        data_used: dataUsed,
        data_unused: dataUnused,
        today_collection: todayCollection,
      };
    }));

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getHrDashboard = async (req, res) => {
  try {
    const workers = await getAllWorkers();
    const users = await getAllUsers({});

    const totalWorkers = workers.length;
    const recruiters = users.filter((u) => u.role === 'recruiter').length;
    const totalNgos = (await getAllNgos()).length;

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const newThisMonth = workers.filter((w) => w.created_at >= monthStart).length;

    const { data: leaves } = await supabase
      .from('leaves')
      .select('status')
      .eq('status', 'pending');
    const pendingLeaves = leaves?.length || 0;

    const { data: attendance } = await supabase
      .from('attendance')
      .select('status');
    const statusCounts = { present: 0, late: 0, absent: 0, leave: 0 };
    (attendance || []).forEach((a) => {
      if (statusCounts[a.status] !== undefined) statusCounts[a.status]++;
    });

    const deptWorkers = {};
    workers.forEach((w) => {
      if (w.department) deptWorkers[w.department] = (deptWorkers[w.department] || 0) + 1;
    });

    const genderCounts = { Male: 0, Female: 0, Other: 0 };
    workers.forEach((w) => {
      if (w.gender && genderCounts[w.gender] !== undefined) genderCounts[w.gender]++;
    });

    return res.json({
      stats: { totalWorkers, recruiters, pendingLeaves, newThisMonth, totalNgos, totalUsers: users.length },
      attendanceStatus: statusCounts,
      deptWorkers,
      genderCounts,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getAdminDashboard = async (req, res) => {
  try {
    const ngoId = req.user.ngo_id;
    const workers = ngoId ? await getAllWorkers(ngoId) : await getAllWorkers();
    const users = ngoId ? await getAllUsers({ ngo_id: ngoId }) : await getAllUsers({});

    const userCounts = {};
    users.forEach((u) => { userCounts[u.role] = (userCounts[u.role] || 0) + 1; });

    const { data: attendance } = await supabase
      .from('attendance')
      .select('status, workers!inner(ngo_id)');

    const statusCounts = { present: 0, late: 0, absent: 0, leave: 0 };
    const workerIds = new Set(workers.map((w) => w.id));
    (attendance || []).forEach((a) => {
      if (workerIds.has(a.worker_id) && statusCounts[a.status] !== undefined) statusCounts[a.status]++;
    });

    const deptWorkers = {};
    workers.forEach((w) => {
      if (w.department) deptWorkers[w.department] = (deptWorkers[w.department] || 0) + 1;
    });

    return res.json({
      stats: { totalWorkers: workers.length, ...userCounts },
      attendanceStatus: statusCounts,
      deptWorkers,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getAccountsDashboard = async (req, res) => {
  try {
    const ngoId = req.user.ngo_id;
    const workers = ngoId ? await getAllWorkers(ngoId) : await getAllWorkers();

    const { data: attendance } = await supabase
      .from('attendance')
      .select('worker_id, status, date, late_minutes');

    const workerIds = new Set(workers.map((w) => w.id));
    const monthAttendance = (attendance || []).filter((a) => workerIds.has(a.worker_id));

    const deptWorkers = {};
    workers.forEach((w) => {
      if (w.department) deptWorkers[w.department] = (deptWorkers[w.department] || 0) + 1;
    });

    return res.json({
      stats: { totalWorkers: workers.length },
      deptWorkers,
      attendanceCount: monthAttendance.length,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getRecruiterDashboard = async (req, res) => {
  try {
    const workers = await getAllWorkers();
    const totalWorkers = workers.length;
    return res.json({ stats: { totalWorkers } });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getLeadsDashboard = async (req, res) => {
  try {
    return res.json({ stats: { totalLeads: 0, callsToday: 0 } });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getTelecallerDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + '-01';

    const { count: assignedLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .or(`recruiter_id.eq.${userId},created_by.eq.${userId}`);

    const { count: callsToday } = await supabase
      .from('call_logs')
      .select('*', { count: 'exact', head: true })
      .eq('telecaller_id', userId)
      .gte('call_time', today);

    const { count: callsThisMonth } = await supabase
      .from('call_logs')
      .select('*', { count: 'exact', head: true })
      .eq('telecaller_id', userId)
      .gte('call_time', monthStart);

    const { data: followUps } = await supabase
      .from('call_logs')
      .select('id')
      .eq('telecaller_id', userId)
      .lte('follow_up_date', today)
      .not('follow_up_date', 'is', null);

    const followUpsDue = followUps ? new Set(followUps.map(f => f.id)).size : 0;

    return res.json({
      stats: {
        assignedLeads: assignedLeads || 0,
        callsToday: callsToday || 0,
        callsThisMonth: callsThisMonth || 0,
        followUpsDue,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getTeamLeadDashboard = async (req, res) => {
  try {
    return res.json({ stats: { teamSize: 0, pendingTasks: 0 } });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getFroWorkerDashboard = async (req, res) => {
  try {
    const { workerId } = req.params;

    const [stats] = await Promise.all([
      getDashboardStats(workerId),
    ]);

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const todayStart = new Date(Date.UTC(istNow.getFullYear(), istNow.getMonth(), istNow.getDate(), 0, 0, 0, 0));
    const todayEnd = new Date(Date.UTC(istNow.getFullYear(), istNow.getMonth(), istNow.getDate(), 23, 59, 59, 999));

    const [totalDonations, dailyDonations] = await Promise.all([
      getTotalCollectedByWorker(workerId, '1970-01-01T00:00:00.000Z', '2099-12-31T23:59:59.999Z'),
      getTotalCollectedByWorker(workerId, todayStart.toISOString(), todayEnd.toISOString()),
    ]);

    const { data: leadDoneData } = await supabase
      .from('fro_donor_logs')
      .select('donor_id, created_at, fro_assignments!inner(fro_worker_id)')
      .eq('fro_assignments.fro_worker_id', workerId)
      .eq('action', 'disposition')
      .eq('disposition_detail', 'lead_done');

    const earliestLead = {};
    for (const log of leadDoneData || []) {
      if (!earliestLead[log.donor_id] || log.created_at < earliestLead[log.donor_id]) {
        earliestLead[log.donor_id] = log.created_at;
      }
    }
    const newDonorsToday = Object.values(earliestLead).filter(
      d => d >= todayStart.toISOString() && d <= todayEnd.toISOString()
    ).length;

    const dataUsed = (stats.contacted || 0) + (stats.donation_collected || 0) + (stats.follow_up || 0);
    const dataUnused = (stats.total || 0) - dataUsed;

    return res.json({
      total_donations: totalDonations,
      daily_donations: dailyDonations,
      new_donors_today: newDonorsToday,
      assigned_data: stats.total || 0,
      data_used: dataUsed,
      data_unused: dataUnused,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
