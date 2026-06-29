import {
  getSalariesByWorker,
  getActiveSalaryByWorker,
  createSalary,
  updateSalary,
  deleteSalary,
  getAllWorkersSalarySummary,
  getPayrollData,
} from '../models/salaryModel.js';
import { getMonthlyAttendance } from '../models/attendanceModel.js';
import { getWorkerById } from '../models/workerModel.js';
import { getAllocationsByWorker } from '../models/workerNgoAllocationModel.js';
import { getTarget, upsertTarget } from '../models/incentiveModel.js';
import { getAchievements } from '../models/dailyAchievementModel.js';
import { calculateAKI, getDayName, getMonthsEmployed } from '../utils/incentive.js';

export const getWorkerSalaries = async (req, res) => {
  try {
    const records = await getSalariesByWorker(req.params.workerId);
    return res.json(records);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const addSalary = async (req, res) => {
  try {
    const { worker_id, salary, from_month, to_month } = req.body;
    if (!worker_id || salary == null || !from_month) {
      return res.status(400).json({ message: 'worker_id, salary, and from_month are required' });
    }
    const record = await createSalary({
      worker_id,
      salary,
      from_month,
      to_month: to_month || null,
      created_by: req.user?.id || null,
    });
    return res.status(201).json({ message: 'Salary added', record });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const editSalary = async (req, res) => {
  try {
    const { salary, from_month, to_month, extra_amount } = req.body;
    const updates = {};
    if (salary !== undefined) updates.salary = salary;
    if (from_month !== undefined) updates.from_month = from_month;
    if (to_month !== undefined) updates.to_month = to_month;
    if (extra_amount !== undefined) updates.extra_amount = extra_amount;
    const record = await updateSalary(req.params.id, updates);
    return res.json({ message: 'Salary updated', record });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getWorkersSummary = async (req, res) => {
  try {
    const data = await getAllWorkersSalarySummary();
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const paySalary = async (req, res) => {
  try {
    const record = await updateSalary(req.params.id, { paid_at: new Date().toISOString() });
    return res.json({ message: 'Salary marked as paid', record });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getWorkerSalaryWithAllocations = async (req, res) => {
  try {
    const { workerId } = req.params;
    const monthQuery = req.query.month;

    const worker = await getWorkerById(workerId);
    if (!worker) return res.status(404).json({ message: 'Worker not found' });

    // Determine month bounds
    let year, month, startDate, endDate, daysInMonth;
    if (monthQuery) {
      const p = monthQuery.split('-');
      year = parseInt(p[0]);
      month = parseInt(p[1]) - 1;
      startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    } else {
      const bounds = getISTMonthBounds();
      year = bounds.year;
      month = bounds.month;
      startDate = bounds.startDate;
      endDate = bounds.endDate;
      daysInMonth = bounds.daysInMonth;
    }

    const allocations = await getAllocationsByWorker(workerId);
    const activeSalary = await getActiveSalaryByWorker(workerId);
    const totalSalary = activeSalary ? parseFloat(activeSalary.salary) : 0;
    const perDay = totalSalary > 0 ? totalSalary / daysInMonth : 0;

    // Attendance for the month
    const records = await getMonthlyAttendance(workerId, startDate, endDate);

    // Sunday bonus (FRO only)
    let sundayBonus = {
      lastSundayDate: null,
      cameOnLastSunday: false,
      monthlyAchievement: 0,
      currentTarget: 0,
      targetPercentage: 0,
      threshold: 60,
      thresholdMet: false,
      isNewJoiner: false,
      bonusAmount: 0,
      sundayAchievement: 0,
      sundayAKI: 0,
      incentiveAKI: 0,
      incentiveMonthly: 0,
      incentiveTotal: 0,
    };

    if (worker.department === 'FRO' && totalSalary > 0) {
      try {
        // Find last Sunday of this month
        const IST_OFFSET = 5.5 * 60 * 60 * 1000;
        const now = new Date();
        const todayIST = new Date(now.getTime() + IST_OFFSET);
        const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));
        let lastSunDate = null;
        for (let d = lastDayOfMonth.getUTCDate(); d >= 1; d--) {
          const dt = new Date(Date.UTC(year, month, d));
          if (dt.getUTCDay() === 0) {
            lastSunDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            break;
          }
        }

        // Only skip Sunday bonus if the entire month is in the future
        const monthStart = new Date(Date.UTC(year, month, 1));
        const monthStartIST = new Date(monthStart.getTime() + IST_OFFSET);
        if (monthStartIST > todayIST) { lastSunDate = null; }

        if (lastSunDate) {

        const sundayRecord = records.find(r => r.date === lastSunDate);
        const cameOnLastSunday = sundayRecord?.status === 'present';

        // Target + achievement
        const monthStr = startDate;
        let tgt = await getTarget(workerId, monthStr);
        if (!tgt) {
          const monthsEmployed = (() => {
            const join = new Date(worker.created_at);
            const now2 = new Date();
            const m = (now2.getFullYear() - join.getFullYear()) * 12 + (now2.getMonth() - join.getMonth());
            return now2.getDate() >= join.getDate() ? m + 1 : m;
          })();
          const multipliers = [1, 2.5, 3];
          const idx = Math.min(Math.max(monthsEmployed - 1, 0), multipliers.length - 1);
          tgt = await upsertTarget({
            worker_id: workerId,
            month: monthStr,
            target_amount: Math.round(totalSalary * multipliers[idx]),
            is_auto_generated: true,
          });
        }
        const currentTarget = parseFloat(tgt.target_amount);

        const achievements = await getAchievements(workerId, startDate, endDate);
        const monthlyAchievement = achievements.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

        const join = new Date(worker.created_at);
        const now2 = new Date();
        const m = (now2.getFullYear() - join.getFullYear()) * 12 + (now2.getMonth() - join.getMonth());
        const monthsEmp = now2.getDate() >= join.getDate() ? m + 1 : m;
        const isNewJoiner = monthsEmp <= 3;

        const threshold = isNewJoiner ? 40 : 60;
        const targetPercentage = currentTarget > 0 ? (monthlyAchievement / currentTarget) * 100 : 0;
        const thresholdMet = targetPercentage >= threshold;
        const bonusAmount = (cameOnLastSunday && thresholdMet) ? Math.round(perDay) : 0;

        // Sunday AKI
        const sundayAchievement = achievements.find(r => r.date === lastSunDate);
        const sundayAchievementAmount = sundayAchievement ? parseFloat(sundayAchievement.amount || 0) : 0;
        const SUNDAY_AKI_RANGES = [
          { min: 3750, max: 6999, incentive: 200 },
          { min: 7000, max: 11999, incentive: 400 },
          { min: 12000, max: 13749, incentive: 800 },
          { min: 13750, max: 18999, incentive: 1100 },
          { min: 19000, max: Infinity, incentive: 1500 },
        ];
        const sundayAKI = cameOnLastSunday && sundayAchievementAmount > 0
          ? (SUNDAY_AKI_RANGES.find(r => sundayAchievementAmount >= r.min && sundayAchievementAmount <= r.max)?.incentive || 0)
          : 0;

        // Compute incentive totals (AKI + monthly)
        const totalAKI = achievements.reduce((sum, r) => {
          const amt = parseFloat(r.amount || 0);
          return sum + calculateAKI(amt, getDayName(r.date));
        }, 0);
        const monthlyTargetMet = monthlyAchievement >= currentTarget;
        let akiPayout = 0;
        let monthlyIncentive = 0;
        if (monthlyTargetMet) {
          akiPayout = isNewJoiner ? totalAKI : Math.round(totalAKI / 2);
          monthlyIncentive = Math.round((monthlyAchievement - currentTarget) * 0.1);
        }

        sundayBonus = {
          lastSundayDate: lastSunDate,
          cameOnLastSunday,
          monthlyAchievement: Math.round(monthlyAchievement),
          currentTarget,
          targetPercentage: Math.round(targetPercentage * 10) / 10,
          threshold,
          thresholdMet,
          isNewJoiner,
          bonusAmount,
          sundayAchievement: sundayAchievementAmount,
          sundayAKI,
          incentiveAKI: akiPayout,
          incentiveMonthly: monthlyIncentive,
          incentiveTotal: akiPayout + monthlyIncentive,
        };
        }
      } catch (err) { console.error('Sunday bonus calculation error:', err); }
    }

    return res.json({
      workerId: worker.id,
      name: worker.name,
      department: worker.department,
      totalSalary,
      perDay: Math.round(perDay),
      daysInMonth,
      allocations: allocations.map(a => ({
        id: a.id,
        ngo_id: a.ngo_id,
        ngo_name: a.ngos?.name || null,
        salary_portion: parseFloat(a.salary_portion),
      })),
      sundayBonus,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const removeSalary = async (req, res) => {
  try {
    const result = await deleteSalary(req.params.id);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getPayrollExport = async (req, res) => {
  try {
    const month = req.query.month;
    const extended = req.query.extended === 'true';
    const data = await getPayrollData(month, extended);
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

function getISTMonthBounds() {
  const IST_OFFSET = 5.5 * 60 * 60 * 1000;
  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET);
  const y = istNow.getUTCFullYear();
  const m = istNow.getUTCMonth();
  const startDate = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const endDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { year: y, month: m, startDate, endDate, daysInMonth: lastDay };
}

function getSundayCount(dateStrings) {
  return dateStrings.filter(d => new Date(d + 'T00:00:00+05:30').getDay() === 0).length;
}

export const getMySalaryBreakdown = async (req, res) => {
  try {
    const workerId = req.user.id;
    const worker = await getWorkerById(workerId);
    if (!worker) return res.status(404).json({ message: 'Worker not found' });

    const activeSalary = await getActiveSalaryByWorker(workerId);
    if (!activeSalary) return res.json({ hasSalary: false, message: 'No salary record found' });

    const { year, month, startDate, endDate, daysInMonth } = getISTMonthBounds();
    const records = await getMonthlyAttendance(workerId, startDate, endDate);

    // Joining month check
    const createdAt = new Date(worker.created_at);
    const joinedThisMonth = createdAt.getFullYear() === year && createdAt.getMonth() === month;
    const joinDay = joinedThisMonth ? createdAt.getUTCDate() : 1;

    // Build deducted set
    const afterJoin = joinedThisMonth
      ? records.filter(r => r.date >= `${year}-${String(month + 1).padStart(2, '0')}-${String(joinDay).padStart(2, '0')}`)
      : records;
    const afterJoinSet = new Set(afterJoin.map(r => r.date));

    const absentDatesAfterJoin = afterJoin
      .filter(r => r.status === 'absent')
      .map(r => r.date);

    const monthDays = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dt = new Date(dateStr + 'T00:00:00+05:30');
      monthDays.push({ date: dateStr, day: dt.getUTCDate(), dayName: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getUTCDay()] });
    }

    const beforeJoin = joinedThisMonth ? monthDays.filter(d => d.date < `${year}-${String(month + 1).padStart(2, '0')}-${String(joinDay).padStart(2, '0')}`) : [];
    const beforeJoinSet = new Set(beforeJoin.map(d => d.date));

    const deducted = new Set();
    const extraSundays = [];

    for (const day of monthDays) {
      if (beforeJoinSet.has(day.date)) { deducted.add(day.date); continue; }
      if (day.dayName === 'Sun') continue;
      const rec = records.find(r => r.date === day.date);
      if (rec?.status === 'absent') {
        deducted.add(day.date);
        if (day.dayName === 'Sat') {
          const nextSun = new Date(day.date + 'T00:00:00+05:30');
          nextSun.setUTCDate(nextSun.getUTCDate() + 1);
          const ns = nextSun.toISOString().split('T')[0];
          if (!beforeJoinSet.has(ns)) deducted.add(ns);
        } else if (day.dayName === 'Mon') {
          const prevSun = new Date(day.date + 'T00:00:00+05:30');
          prevSun.setUTCDate(prevSun.getUTCDate() - 1);
          const ps = prevSun.toISOString().split('T')[0];
          if (!beforeJoinSet.has(ps)) deducted.add(ps);
        }
      }
    }

    // ≥6 absence rule
    const regularAbsences = monthDays.filter(d => {
      if (d.dayName === 'Sun' || beforeJoinSet.has(d.date)) return false;
      const rec = records.find(r => r.date === d.date);
      return rec?.status === 'absent';
    }).length;

    if (regularAbsences >= 6) {
      for (const day of monthDays) {
        if (day.dayName === 'Sun' && !beforeJoinSet.has(day.date)) {
          if (!deducted.has(day.date)) {
            deducted.add(day.date);
            extraSundays.push(day.date);
          }
        }
      }
    }

    const paidDays = Math.max(0, daysInMonth - (joinedThisMonth ? (joinDay - 1) : 0) - deducted.size);
    const perDay = parseFloat(activeSalary.salary) / daysInMonth;
    const salary = parseFloat(activeSalary.salary);

    // Late minutes
    const totalLateMinutes = afterJoin.reduce((sum, r) => sum + (r.late_minutes || 0), 0);

    // Late deduction
    let lateDeductionDays = 0;

    if (totalLateMinutes > 480) {
      lateDeductionDays = Math.round((totalLateMinutes / 480) * 2) / 2;
    } else if (totalLateMinutes > 240) {
      lateDeductionDays = 1;
    } else if (totalLateMinutes > 180) {
      lateDeductionDays = 0.5;
    }

    const joiningDeduction = (joinedThisMonth && getMonthsEmployed(worker.created_at) <= 3) ? 1.5 : 0;

    const totalDue = perDay * Math.max(0, paidDays - lateDeductionDays - joiningDeduction);
    const normalTotalDue = perDay * paidDays;

    // FRO target + incentives
    let currentTarget = null;
    let incentiveAKI = 0;
    let incentiveAKIPayout = 0;
    let incentiveMonthly = 0;
    let incentiveTotal = 0;
    let monthlyAchievement = 0;
    let monthlyTargetMet = false;
    let isNewJoiner = false;

    if (worker.department === 'FRO') {
      try {
        const month = startDate;
        let tgt = await getTarget(workerId, month);
        if (!tgt) {
          const monthsEmployed = (() => {
            const join = new Date(worker.created_at);
            const now2 = new Date();
            const m = (now2.getFullYear() - join.getFullYear()) * 12 + (now2.getMonth() - join.getMonth());
            return now2.getDate() >= join.getDate() ? m + 1 : m;
          })();
          const multipliers = [1, 2.5, 3];
          const idx = Math.min(Math.max(monthsEmployed - 1, 0), multipliers.length - 1);
          const targetAmount = Math.round(salary * multipliers[idx]);
          tgt = await upsertTarget({
            worker_id: workerId,
            month,
            target_amount: targetAmount,
            is_auto_generated: true,
          });
        }
        currentTarget = parseFloat(tgt.target_amount);

        const achievements = await getAchievements(workerId, startDate, endDate);
        monthlyAchievement = achievements.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

        incentiveAKI = achievements.reduce((sum, r) => sum + calculateAKI(parseFloat(r.amount || 0), getDayName(r.date)), 0);

        isNewJoiner = getMonthsEmployed(worker.created_at) <= 3;
        monthlyTargetMet = monthlyAchievement >= currentTarget;

        if (monthlyTargetMet) {
          const overage = monthlyAchievement - currentTarget;
          incentiveMonthly = Math.round(overage * 0.1);
          incentiveAKIPayout = isNewJoiner ? incentiveAKI : Math.round(incentiveAKI / 2);
          incentiveTotal = incentiveAKIPayout + incentiveMonthly;
        }
      } catch (err) { console.error('Incentive calculation error:', err); }
    }

    const safeRecord = (r) => ({
      id: r.id, date: r.date, status: r.status, late_minutes: r.late_minutes || 0,
      punch_in_time: r.punch_in_time, punch_out_time: r.punch_out_time,
    });

    // Build per-NGO allocation breakdown
    let allocations = [];
    try {
      const rows = await getAllocationsByWorker(workerId);
      allocations = rows.map(r => {
        const portion = parseFloat(r.salary_portion);
        const allocPerDay = portion / daysInMonth;
        const allocTotalDue = allocPerDay * Math.max(0, paidDays - lateDeductionDays - joiningDeduction);
        return {
          id: r.id,
          ngo_id: r.ngo_id,
          ngo_name: r.ngos?.name || null,
          salary_portion: portion,
          perDay: Math.round(allocPerDay),
          totalDue: Math.round(allocTotalDue),
        };
      });
    } catch (err) { console.error('Failed to load allocations:', err); }

    return res.json({
      hasSalary: true,
      salary,
      perDay: Math.round(perDay),
      daysInMonth,
      availableDays: joinedThisMonth ? (daysInMonth - joinDay + 1) : daysInMonth,
      paidDays,
      totalLateMinutes,
      lateDeductionDays,
      joiningDeduction,
      totalDue: Math.round(totalDue),
      normalTotalDue: Math.round(normalTotalDue),
      joinedThisMonth,
      joinDay,
      deductedCount: deducted.size,
      absentCount: absentDatesAfterJoin.length,
      absentDates: absentDatesAfterJoin,
      extraSundayCount: extraSundays.length,
      currentTarget,
      incentiveAKI,
      incentiveAKIPayout,
      incentiveMonthly,
      incentiveTotal,
      monthlyAchievement,
      monthlyTargetMet,
      isNewJoiner,
      shift: worker.shift,
      createdAt: worker.created_at,
      records: (records || []).map(safeRecord),
      allocations,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
