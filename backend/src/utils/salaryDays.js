import { getMonthsEmployed } from './incentive.js';
import { calcLateDeductionDays, getLateThresholds, resolveLateGrace } from './latePolicy.js';
import { isVoluntarySunday, newSundayRules } from './sundayRules.js';
import { findUnauthorizedAbsences } from './absenceRules.js';

const pad = n => String(n).padStart(2, '0');

// Accounts payroll compensation calendar. A compensatory Sunday replaces the
// linked holiday; before SUNDAY_RULES_FROM it also does not satisfy the
// compulsory-Sunday quota (that quota no longer exists once the new Sunday
// rules take over).
export const COMPENSATORY_WORKDAYS = {
  '2026-08': [{ workDate: '2026-08-23', holidayDate: '2026-08-28', name: 'Rashabandhan' }],
};

export function getCompensatoryWorkdays(month) {
  return COMPENSATORY_WORKDAYS[month] || [];
}

// Current date in IST as { year, month (0-based), day }.
export function getISTToday() {
  const IST_OFFSET = 5.5 * 60 * 60 * 1000;
  const now = new Date(Date.now() + IST_OFFSET);
  return { year: now.getUTCFullYear(), month: now.getUTCMonth(), day: now.getUTCDate() };
}

export function shiftDate(dateStr, days) {
  const dt = new Date(dateStr + 'T00:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

// Split the month's Sundays into paid / unpaid.
// Before SUNDAY_RULES_FROM: a worked Sunday is paid (even a clubbed or extra
// one, added back on top of the free pool) and a clean month pays every Sunday;
// any other month gets a free pool of (total − 1).
// From SUNDAY_RULES_FROM: every eligible Sunday is paid whether it was worked
// or not, a clubbed/extra Sunday is never paid and there is no cap at all.
export function computeSundayStats({ year, month, daysInMonth, records, skipBeforeDate, lateJoin, hasCompensatoryWorkday = false }) {
  const inRange = (dateStr) => !skipBeforeDate || dateStr >= skipBeforeDate;
  const dates = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    dates.push({ date: dateStr, dayName: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(dateStr + 'T00:00:00Z').getUTCDay()] });
  }

  const sundays = [];
  const cancelled = new Map(); // sunday date -> { type: 'clubbed', cause } | { type: 'extra' }
  let regularAbsences = 0;
  for (const day of dates) {
    if (day.dayName === 'Sun') { sundays.push(day.date); continue; }
    if (!inRange(day.date)) continue;
    const rec = records.find(r => r.date === day.date);
    if (rec?.status === 'absent' || rec?.status === 'leave') {
      regularAbsences++;
      if (day.dayName === 'Sat') {
        const ns = shiftDate(day.date, 1);
        if (inRange(ns)) cancelled.set(ns, { type: 'clubbed', cause: day.date });
      } else if (day.dayName === 'Mon') {
        const ps = shiftDate(day.date, -1);
        if (inRange(ps)) cancelled.set(ps, { type: 'clubbed', cause: day.date });
      }
    }
  }

  const totalSundays = sundays.filter(inRange);
  const extraSundays = [];
  if (regularAbsences >= 6 || lateJoin) {
    for (const s of totalSundays) {
      if (!cancelled.has(s)) {
        cancelled.set(s, { type: 'extra' });
        extraSundays.push(s);
      }
    }
  }

  const eligibleSundays = totalSundays.filter(s => !cancelled.has(s));
  const isAttended = (s) => {
    const rec = records.find(r => r.date === s);
    return !!rec && (rec.status === 'present' || rec.status === 'late' || rec.status === 'half-day');
  };
  const attendedEligible = eligibleSundays.filter(isAttended);
  const attendedCancelled = totalSundays.filter(s => cancelled.has(s) && isAttended(s));
  const workedAll = attendedEligible.length + attendedCancelled.length;
  const eligibleNotWorked = eligibleSundays.length - attendedEligible.length;
  const applyNewRules = newSundayRules(year, month);
  const cleanMonth = regularAbsences === 0 && !lateJoin && !hasCompensatoryWorkday;
  const freeSundayLimit = cleanMonth ? totalSundays.length : Math.max(0, totalSundays.length - 1);
  const baseline = applyNewRules
    ? eligibleNotWorked
    : Math.max(0, Math.min(freeSundayLimit, eligibleNotWorked));
  const paidSundays = applyNewRules
    ? attendedEligible.length + baseline
    : workedAll + baseline;
  const unpaidCount = applyNewRules ? 0 : eligibleNotWorked - baseline;
  const attendedEligibleSet = new Set(attendedEligible);
  const unpaidSundays = eligibleSundays.filter(s => !attendedEligibleSet.has(s)).slice(0, unpaidCount);

  return {
    totalSundays: totalSundays.length,
    attendedSundays: workedAll,
    attendedCancelledDates: attendedCancelled,
    paidSundays,
    eligibleSundays,
    eligibleNotWorked,
    cancelledSundays: totalSundays.filter(s => cancelled.has(s)),
    cancelledDetails: totalSundays.filter(s => cancelled.has(s)).map(s => ({ date: s, ...cancelled.get(s) })),
    extraSundays,
    unpaidSundays,
  };
}

// Full paid-days computation — mirrors getMySalaryBreakdown() in
// salaryController.js. `records` are the worker's attendance rows
// ({ date, status, late_minutes }) for the month; `createdAt` is the worker's
// created_at. `month` is 0-based.
export function computePaidDays({ year, month, daysInMonth, records, createdAt, holidayDates, viewingToday, includeHolidayPay = false, compensatoryWorkdays = [], lateGraceMinutes, leaves = [], absenceProofs = [], lateRollbackMinutes = 0 }) {
  const lateGrace = resolveLateGrace(lateGraceMinutes);
  const lateThresholds = getLateThresholds(lateGrace);
  const applyNewSundayRules = newSundayRules(year, month);

  // A Date of Joining after this month's last day means the worker was never on
  // this month's roster (e.g. a fresh joiner seen while exporting an earlier
  // month). Scoring them as employed for the whole month would invent absences,
  // free Sundays and paid days out of nothing — return an honest zero instead.
  const joinDateOnly = createdAt ? String(createdAt).slice(0, 10) : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(joinDateOnly) && joinDateOnly > `${year}-${pad(month + 1)}-${pad(daysInMonth)}`) {
    return {
      joinedThisMonth: false,
      joinedAfterMonth: true,
      joinDay: 1,
      available: 0,
      presentRaw: 0,
      presentDays: 0,
      halfDayCount: 0,
      leaveCount: 0,
      totalLateMinutes: 0,
      lateDeductionDays: 0,
      lateDeductionDaysRaw: 0,
      lateRollbackMinutes: 0,
      lateRollbackDays: 0,
      chargeableLateMinutes: 0,
      lateGraceMinutes: lateGrace,
      lateThresholds,
      graceForfeited: false,
      unauthorizedAbsences: [],
      firstForfeitDate: null,
      absenceProofNeeded: [],
      joiningDeduction: 0,
      sundayDeductionDays: 0,
      deducted: new Set(),
      deductedCount: 0,
      absentDatesAfterJoin: [],
      sundayAdd: 0,
      extraSundays: [],
      clubbedSundays: 0,
      extraSundayCount: 0,
      freeSundays: 0,
      holidayPaidDays: 0,
      compensatoryWorkDays: 0,
      compensatedHolidayDays: 0,
      requiredSundayWorkedDays: 0,
      sundayReasons: [],
      sundayStats: {
        totalSundays: 0,
        attendedSundays: 0,
        attendedCancelledDates: [],
        paidSundays: 0,
        eligibleSundays: [],
        eligibleNotWorked: 0,
        cancelledSundays: [],
        cancelledDetails: [],
        extraSundays: [],
        unpaidSundays: [],
      },
      paidDays: 0,
      totalDueDays: 0,
    };
  }

  // From SUNDAY_RULES_FROM a Sunday is voluntary: come and go at any time. Such
  // a Sunday row is always a full present day and never carries late minutes.
  if (applyNewSundayRules) {
    records = records.map((r) => {
      if (!isVoluntarySunday(r.date)) return r;
      if (r.status !== 'present' && r.status !== 'late' && r.status !== 'half-day') return r;
      return { ...r, status: 'present', late_minutes: 0 };
    });
  }
  const joinDate = createdAt ? new Date(createdAt) : null;
  const joinedThisMonth = joinDate && !isNaN(joinDate.getTime())
    ? joinDate.getFullYear() === year && joinDate.getMonth() === month
    : false;
  const joinDay = joinedThisMonth ? joinDate.getUTCDate() : 1;
  const joinDateStr = `${year}-${pad(month + 1)}-${pad(joinDay)}`;

  // A declared holiday is a paid day even when an attendance row already exists
  // for that date as absent/leave (for example a day marked before the holiday
  // was declared). Normalise those rows to 'holiday' so they neither count as
  // absences nor feed the Sunday clubbing/deduction rules. A real punch on the
  // holiday (present/late/half-day) is left untouched.
  const holidaySet = new Set((holidayDates || []).map(d => String(d).slice(0, 10)));
  records = records.map((r) => {
    const date = String(r.date || '').slice(0, 10);
    if (!holidaySet.has(date)) return r;
    if (r.status === 'absent' || r.status === 'leave') return { ...r, status: 'holiday' };
    return r;
  });

  const afterJoin = joinedThisMonth ? records.filter(r => r.date >= joinDateStr) : records;
  const halfDayCount = afterJoin.filter(r => r.status === 'half-day').length;
  const presentDays = afterJoin.filter(r => r.status === 'present' || r.status === 'late').length;

  const monthDays = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
    monthDays.push({ date: dateStr, day: d, dayName: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(dateStr + 'T00:00:00Z').getUTCDay()] });
  }

  const beforeJoin = joinedThisMonth ? monthDays.filter(d => d.date < joinDateStr) : [];
  const beforeJoinSet = new Set(beforeJoin.map(d => d.date));

  // A weekday with no attendance record counts as absent (same rule as the HR
  // salary page), unless it is a holiday or still in the future of the month.
  const { year: ty, month: tm, day: td } = getISTToday();
  const viewDay = viewingToday != null
    ? viewingToday
    : (ty === year && tm === month ? td : daysInMonth + 1);

  const realByDate = new Set(records.map(r => r.date));
  const fabricated = [];
  for (const day of monthDays) {
    if (beforeJoinSet.has(day.date)) continue;
    if (day.dayName === 'Sun') continue;
    if (holidaySet.has(day.date)) continue;
    if (day.day > viewDay) continue;
    if (!realByDate.has(day.date)) fabricated.push({ date: day.date, status: 'absent' });
  }
  const records2 = [...records, ...fabricated];

  // Unauthorized absences decide whether the month's free grace survives.
  // Sundays, holidays, pre-join and future dates are excluded inside the
  // detector, matching payroll's own fabrication rules above.
  const absenceEval = findUnauthorizedAbsences({
    monthDays,
    records: records2,
    leaves,
    absenceProofs,
    holidaySet,
    beforeJoinSet,
    viewDay,
  });

  const compensationByWorkDate = new Map((compensatoryWorkdays || []).map((entry) => [entry.workDate, entry]));
  const compensationByHolidayDate = new Map((compensatoryWorkdays || []).map((entry) => [entry.holidayDate, entry]));
  const sundayRecords = records2.filter((record) => !compensationByWorkDate.has(record.date));

  const deducted = new Set();

  for (const day of monthDays) {
    if (beforeJoinSet.has(day.date)) continue;
    if (day.dayName === 'Sun') continue;
    const rec = records2.find(r => r.date === day.date);
    if (rec?.status === 'absent' || rec?.status === 'leave') {
      deducted.add(day.date);
      if (day.dayName === 'Sat') {
        const ns = shiftDate(day.date, 1);
        if (!beforeJoinSet.has(ns)) deducted.add(ns);
      } else if (day.dayName === 'Mon') {
        const ps = shiftDate(day.date, -1);
        if (!beforeJoinSet.has(ps)) deducted.add(ps);
      }
    }
  }

  const lateJoin = joinedThisMonth && joinDay > 10;
  const sundayStats = computeSundayStats({
    year,
    month,
    daysInMonth,
    records: sundayRecords,
    skipBeforeDate: joinedThisMonth ? joinDateStr : null,
    lateJoin,
    hasCompensatoryWorkday: compensationByWorkDate.size > 0,
  });
  for (const d of sundayStats.unpaidSundays) deducted.add(d);
  for (const d of sundayStats.extraSundays) deducted.add(d);

  const available = Math.min(daysInMonth, viewDay) - (joinedThisMonth ? (joinDay - 1) : 0);
  const leaveCount = afterJoin.filter(r => r.status === 'leave').length;
  // A half-day record is already penalised as 0.5 day, so its late_minutes must
  // not also be charged as a late deduction (double penalty).
  const totalLateMinutes = afterJoin.reduce((sum, r) => sum + (r.status === 'half-day' ? 0 : (r.late_minutes || 0)), 0);
  // Absences are already deducted as absent days, so they must not also eat the
  // late grace: lateness is scored purely on the minutes actually accumulated.
  // An unauthorized absence forfeits the month's free grace (see
  // utils/latePolicy.js); an admin rollback then gives minutes back on top.
  const lateDeductionDaysRaw = calcLateDeductionDays(totalLateMinutes, lateGrace, {
    graceForfeited: absenceEval.graceForfeited,
  });
  // Admin grace rollback: the minutes go back into the pool BEFORE the ladder
  // runs, so "the 180 min grace was charged by mistake" is undone exactly. The
  // tier is recomputed on the reduced total instead of subtracting whole days.
  // The cap includes the grace when it was charged, otherwise a worker with 26
  // late minutes could never give the forfeited 180 min back.
  const rollbackCap = totalLateMinutes + (absenceEval.graceForfeited ? lateGrace : 0);
  const lateRollbackMinutesApplied = Math.min(
    Math.max(0, Number(lateRollbackMinutes) || 0),
    rollbackCap,
  );
  const chargeableLateMinutes = Math.max(0, totalLateMinutes - lateRollbackMinutesApplied);
  const lateDeductionDays = calcLateDeductionDays(chargeableLateMinutes, lateGrace, {
    graceForfeited: absenceEval.graceForfeited,
  });
  const lateRollbackDays = Math.max(0, lateDeductionDaysRaw - lateDeductionDays);

  const joiningDeduction = (joinedThisMonth && getMonthsEmployed(createdAt, new Date(year, month + 1, 0)) <= 3) ? 1.5 : 0;

  const sundayReasons = [];
  const workedBackSet = new Set(sundayStats.attendedCancelledDates);
  for (const cd of sundayStats.cancelledDetails) {
    if (workedBackSet.has(cd.date)) continue;
    if (cd.type === 'clubbed') {
      sundayReasons.push({ date: cd.date, reason: `clubbed with ${cd.cause} (absent/leave)` });
    } else {
      sundayReasons.push({ date: cd.date, reason: 'extra (6+ absences or joined after the 10th)' });
    }
  }
  const freePool = Math.max(0, sundayStats.totalSundays - 1);
  for (const d of sundayStats.unpaidSundays) {
    sundayReasons.push({ date: d, reason: `not worked and beyond the free ${freePool} Sunday(s)` });
  }
  sundayReasons.sort((a, b) => (a.date < b.date ? -1 : 1));

  const sundayDeductionDays = [...deducted].filter(d => new Date(d + 'T00:00:00Z').getUTCDay() === 0).length;
  // New rules: every eligible Sunday is already inside paidSundays, so a worked
  // but cancelled Sunday has to come back OFF the paid total (presentDays still
  // counted it) — the offset is allowed to go negative. Old rules keep the
  // clamp so the free pool never exceeds what was worked.
  const freeSundayDays = applyNewSundayRules
    ? sundayStats.paidSundays - sundayStats.attendedSundays
    : Math.max(0, sundayStats.paidSundays - sundayStats.attendedSundays);
  const holidayPaidDays = includeHolidayPay
    ? monthDays.filter((day) => {
      if (!holidaySet.has(day.date) || beforeJoinSet.has(day.date) || day.day > viewDay) return false;
      const attendance = afterJoin.find((record) => record.date === day.date);
      const compensated = compensationByHolidayDate.get(day.date);
      if (!compensated) return !attendance || attendance.status === 'absent' || attendance.status === 'leave' || attendance.status === 'holiday';
      const workRecord = afterJoin.find((record) => record.date === compensated.workDate);
      return !workRecord || !['present', 'late', 'half-day'].includes(workRecord.status);
    }).length
    : 0;
  const compensatoryWorkDays = [...compensationByWorkDate.keys()].filter((date) => {
    const record = afterJoin.find((entry) => entry.date === date);
    return record && ['present', 'late', 'half-day'].includes(record.status);
  }).length;
  const compensatedHolidayDays = [...compensationByHolidayDate.keys()].filter((date) => {
    const entry = compensationByHolidayDate.get(date);
    const record = afterJoin.find((item) => item.date === entry.workDate);
    return record && ['present', 'late', 'half-day'].includes(record.status);
  }).length;
  const requiredSundayWorkedDays = Math.min(1, sundayStats.attendedSundays);
  // Keep Sundays in the gross attendance basis. Worked Sundays are already
  // presentDays; freeSundayDays adds the Sundays that were not worked. Under
  // the old rules it may also subtract a worked-but-cancelled Sunday. Unpaid
  // and cancelled Sundays are represented by sundayDeductionDays below.
  const grossPresentDays = presentDays + freeSundayDays + holidayPaidDays + sundayDeductionDays;

  return {
    joinedThisMonth,
    joinDay,
    available,
    presentRaw: presentDays,
    presentDays,
    halfDayCount,
    leaveCount,
    totalLateMinutes,
    lateDeductionDays,
    // Before the admin grace rollback, how many minutes were given back, and
    // what the ladder actually charged — the salary sheet shows all three so a
    // waiver is never invisible.
    lateDeductionDaysRaw,
    lateRollbackMinutes: lateRollbackMinutesApplied,
    lateRollbackDays,
    chargeableLateMinutes,
    lateGraceMinutes: lateGrace,
    lateThresholds,
    // Informational only (absence-proof flow / reports). It no longer changes
    // any deduction — a missing punch is paid for by the absent day itself.
    graceForfeited: absenceEval.graceForfeited,
    unauthorizedAbsences: absenceEval.unauthorizedAbsences,
    firstForfeitDate: absenceEval.firstForfeitDate,
    absenceProofNeeded: absenceEval.proofNeededDates,
    joiningDeduction,
    sundayDeductionDays,
    deducted,
    deductedCount: deducted.size,
    absentDatesAfterJoin: records2.filter(r => r.status === 'absent').map(r => r.date),
    sundayAdd: applyNewSundayRules ? 0 : sundayStats.attendedCancelledDates.length,
    extraSundays: sundayStats.extraSundays,
    clubbedSundays: sundayStats.cancelledSundays.length - sundayStats.extraSundays.length,
    extraSundayCount: sundayStats.extraSundays.length,
    // Under the new rules this matches the freeSundayDays used inside
    // grossPresentDays: every eligible non-worked Sunday is paid, minus any
    // worked-but-cancelled Sunday that comes back OFF the paid total (so it
    // can go negative). Old rules keep the clamp.
    freeSundays: applyNewSundayRules
      ? sundayStats.paidSundays - sundayStats.attendedSundays
      : Math.max(0, sundayStats.paidSundays - sundayStats.attendedSundays),
    holidayPaidDays,
    compensatoryWorkDays,
    compensatedHolidayDays,
    requiredSundayWorkedDays,
    sundayReasons,
    sundayStats,
    // Absent days are an attendance balance only. They are not subtracted
    // again because they are already excluded from presentDays.
    paidDays: grossPresentDays,
    totalDueDays: Math.max(0, grossPresentDays + halfDayCount * 0.5 - sundayDeductionDays - lateDeductionDays - joiningDeduction),
  };
}
