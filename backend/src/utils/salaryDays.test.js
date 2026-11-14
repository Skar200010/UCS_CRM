import test from 'node:test';
import assert from 'node:assert';
import { computePaidDays, computeSundayStats } from './salaryDays.js';
import { isVoluntarySunday, newSundayRules, SUNDAY_RULES_FROM } from './sundayRules.js';

// Weekday helpers for 2026: Sep 5 = Sat, Sep 6 = Sun, Oct 3 = Sat, Oct 4 = Sun,
// Oct 11/18/25 = Sun, Aug 2/9/16/23/30 = Sun.
const rec = (date, status, late = 0) => ({ date, status, late_minutes: late });

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function stats({ year, month, records = [], lateJoin = false, comp = false }) {
  return computeSundayStats({
    year,
    month,
    daysInMonth: daysInMonth(year, month),
    records,
    skipBeforeDate: null,
    lateJoin,
    hasCompensatoryWorkday: comp,
  });
}

function paid(args) {
  return computePaidDays({
    holidayDates: [],
    viewingToday: daysInMonth(args.year, args.month),
    lateGraceMinutes: 180,
    includeHolidayPay: false,
    compensatoryWorkdays: args.comp ? [{ workDate: `${args.year}-08-23`, holidayDate: `${args.year}-08-28`, name: 'Rashabandhan' }] : [],
    ...args,
  });
}

test('cutoff constants', () => {
  assert.equal(SUNDAY_RULES_FROM, '2026-10-01');
  assert.equal(newSundayRules(2026, 8), false); // Sep
  assert.equal(newSundayRules(2026, 9), true);  // Oct
  assert.equal(isVoluntarySunday('2026-10-04'), true);
  assert.equal(isVoluntarySunday('2026-10-05'), false); // Monday
  assert.equal(isVoluntarySunday('2026-09-06'), false); // before cutoff
});

// --- Old rules (September 2026, total Sundays = 4: 6, 13, 20, 27) -----------

test('old: two weekday absences, no Sunday worked -> 3 of 4 paid, 1 unpaid', () => {
  const s = stats({ year: 2026, month: 8, records: [rec('2026-09-02', 'absent'), rec('2026-09-09', 'absent')] });
  assert.equal(s.totalSundays, 4);
  assert.equal(s.paidSundays, 3);
  assert.equal(s.unpaidSundays.length, 1);
});

test('old: Saturday absent + Sunday worked -> worked Sunday paid back (4 of 4)', () => {
  const s = stats({ year: 2026, month: 8, records: [rec('2026-09-05', 'absent'), rec('2026-09-06', 'present')] });
  assert.equal(s.paidSundays, 4);
  assert.equal(s.unpaidSundays.length, 0);
  assert.deepEqual(s.cancelledSundays, ['2026-09-06']);
});

test('old: 7 absences -> only the worked Sunday is paid (1 of 4)', () => {
  const s = stats({
    year: 2026, month: 8,
    records: [
      rec('2026-09-01', 'absent'), rec('2026-09-02', 'absent'), rec('2026-09-03', 'absent'),
      rec('2026-09-04', 'absent'), rec('2026-09-07', 'absent'), rec('2026-09-08', 'absent'),
      rec('2026-09-09', 'absent'), rec('2026-09-06', 'present'),
    ],
  });
  assert.equal(s.totalSundays, 4);
  assert.equal(s.paidSundays, 1);
  assert.equal(s.unpaidSundays.length, 0);
});

test('old: clean month, every Sunday worked -> 4 of 4', () => {
  const s = stats({
    year: 2026, month: 8,
    records: ['2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27'].map((d) => rec(d, 'present')),
  });
  assert.equal(s.paidSundays, 4);
  assert.equal(s.unpaidSundays.length, 0);
});

test('old: compensatory month with no Sunday worked -> free pool capped at 4 of 5', () => {
  const s = stats({ year: 2026, month: 7, records: [], comp: true });
  assert.equal(s.totalSundays, 5);
  assert.equal(s.paidSundays, 4);
  assert.equal(s.unpaidSundays.length, 1);
});

// --- New rules (October 2026, total Sundays = 4: 4, 11, 18, 25) -------------

test('new: two weekday absences, no Sunday worked -> all 4 paid, none unpaid', () => {
  const s = stats({ year: 2026, month: 9, records: [rec('2026-10-07', 'absent'), rec('2026-10-14', 'absent')] });
  assert.equal(s.paidSundays, 4);
  assert.deepEqual(s.unpaidSundays, []);
  assert.equal(s.eligibleNotWorked, 4);
});

test('new: Saturday absent -> clubbed Sunday is never paid (3 of 4)', () => {
  const s = stats({ year: 2026, month: 9, records: [rec('2026-10-03', 'absent'), rec('2026-10-04', 'present')] });
  assert.equal(s.totalSundays, 4);
  assert.equal(s.paidSundays, 3);
  assert.deepEqual(s.unpaidSundays, []);
  assert.deepEqual(s.cancelledSundays, ['2026-10-04']);
});

test('new: worked but clubbed Sunday is NOT paid back', () => {
  const s = stats({ year: 2026, month: 9, records: [rec('2026-10-03', 'absent'), rec('2026-10-04', 'present')] });
  assert.deepEqual(s.attendedCancelledDates, ['2026-10-04']);
  assert.equal(s.paidSundays, s.eligibleSundays.length);
});

test('new: 7 absences -> extra rule cancels every Sunday (0 of 4)', () => {
  const s = stats({
    year: 2026, month: 9,
    records: [
      rec('2026-10-01', 'absent'), rec('2026-10-02', 'absent'), rec('2026-10-06', 'absent'),
      rec('2026-10-07', 'absent'), rec('2026-10-08', 'absent'), rec('2026-10-09', 'absent'),
      rec('2026-10-13', 'absent'), rec('2026-10-04', 'present'),
    ],
  });
  assert.equal(s.totalSundays, 4);
  assert.equal(s.paidSundays, 0);
  assert.deepEqual(s.unpaidSundays, []);
});

test('new: join after the 10th -> every Sunday cancelled, none paid', () => {
  const s = stats({ year: 2026, month: 9, records: [rec('2026-10-14', 'present')], lateJoin: true, skipBeforeDate: '2026-10-14' });
  assert.deepEqual(s.unpaidSundays, []);
  assert.equal(s.paidSundays, 0);
});

test('new: clean month, every Sunday worked -> 4 of 4', () => {
  const s = stats({
    year: 2026, month: 9,
    records: ['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25'].map((d) => rec(d, 'present')),
  });
  assert.equal(s.paidSundays, 4);
  assert.deepEqual(s.unpaidSundays, []);
});

// --- computePaidDays --------------------------------------------------------

function weekdayPresent(dates) {
  return dates.filter((d) => new Date(d + 'T00:00:00Z').getUTCDay() !== 0).length;
}

function paidDaysFor(month, sundayRecords, weekdayAbsent = []) {
  const { year } = { year: 2026 };
  const dim = daysInMonth(year, month);
  const records = [];
  for (let d = 1; d <= dim; d++) {
    const date = `2026-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (weekdayAbsent.includes(date)) { records.push(rec(date, 'absent')); continue; }
    if (new Date(date + 'T00:00:00Z').getUTCDay() === 0) continue;
    records.push(rec(date, 'present'));
  }
  records.push(...sundayRecords);
  return paid({
    year, month, daysInMonth: dim, records, createdAt: '2026-01-01T04:00:00.000Z',
  });
}

test('new: paid days = weekdays present + paid Sundays (no clubbing)', () => {
  const dim = daysInMonth(2026, 9);
  const absent = ['2026-10-07', '2026-10-14'];
  const r = paidDaysFor(9, [], absent);
  const wd = weekdayPresent(
    Array.from({ length: dim }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`)
      .filter((d) => !absent.includes(d)),
  );
  const paidFromStats = r.sundayStats.paidSundays;
  assert.equal(paidFromStats, 4);
  assert.equal(r.paidDays - r.sundayDeductionDays, wd + paidFromStats);
  assert.equal(r.totalDueDays, wd + paidFromStats);
});

test('new: clubbed Sunday is deducted once, net = weekdays + paid Sundays', () => {
  const dim = daysInMonth(2026, 9);
  const absent = ['2026-10-03'];
  const r = paidDaysFor(9, [rec('2026-10-04', 'present')], absent);
  const wd = weekdayPresent(
    Array.from({ length: dim }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`)
      .filter((d) => !absent.includes(d)),
  );
  assert.equal(r.sundayStats.paidSundays, 3);
  assert.equal(r.sundayDeductionDays, 1);
  assert.equal(r.paidDays - r.sundayDeductionDays, wd + 3);
  assert.equal(r.totalDueDays, wd + 3);
  // The worked-but-clubbed Sunday comes OFF the free count (paid 3 − attended 1).
  assert.equal(r.freeSundays, 2);
});

test('new: Sunday Add To Need is always zero', () => {
  const r = paidDaysFor(9, [], ['2026-10-07', '2026-10-14']);
  assert.equal(r.sundayAdd, 0);
  // freeSundays mirrors the freeSundayDays used in grossPresentDays:
  // paid - attended (equals eligibleNotWorked when no Sunday was worked).
  assert.equal(r.freeSundays, r.sundayStats.paidSundays - r.sundayStats.attendedSundays);
  assert.equal(r.freeSundays, r.sundayStats.eligibleNotWorked);
});

test('new: a Sunday punch is voluntary - no late minutes, no late day', () => {
  const r = paidDaysFor(9, [rec('2026-10-11', 'late', 500), rec('2026-10-18', 'half-day', 0)], []);
  assert.equal(r.totalLateMinutes, 0);
  assert.equal(r.lateDeductionDays, 0);
  assert.equal(r.halfDayCount, 0);
  assert.equal(r.sundayStats.attendedSundays, 2);
  assert.equal(r.sundayStats.paidSundays, 4);
  // 27 weekdays + 4 Sundays, all present (half-day Sunday counts as present)
  assert.equal(r.presentDays, 27 + 2);
  assert.equal(r.paidDays - r.sundayDeductionDays, 27 + 4);
});

test('old: a Sunday punch in September still counts late minutes', () => {
  const r = paidDaysFor(8, [rec('2026-09-13', 'late', 500)], []);
  assert.equal(r.totalLateMinutes, 500);
  assert.ok(r.lateDeductionDays > 0);
});

test('an unauthorized absence forfeits the grace, and the admin rollback gives it back', () => {
  // Vaishali Sawant, Oct 2026: 26 min late once, absent on 27/28/29 (no leave).
  const dim = daysInMonth(2026, 9);
  const absent = new Set(['2026-10-27', '2026-10-28', '2026-10-29']);
  const records = [];
  for (let d = 1; d <= dim; d++) {
    const date = `2026-10-${String(d).padStart(2, '0')}`;
    if (new Date(date + 'T00:00:00Z').getUTCDay() === 0) continue;
    if (absent.has(date)) continue;
    records.push(date === '2026-10-17' ? rec(date, 'late', 26) : rec(date, 'present'));
  }
  const run = (lateRollbackMinutes) => computePaidDays({
    year: 2026, month: 9, daysInMonth: dim, records,
    createdAt: '2021-06-01T00:00:00.000Z', holidayDates: [], viewingToday: dim,
    lateGraceMinutes: 180, includeHolidayPay: false, compensatoryWorkdays: [],
    lateRollbackMinutes,
  });

  // Unauthorized absence -> grace charged: 26 + 180 = 206 -> half day.
  const forfeited = run(0);
  assert.equal(forfeited.totalLateMinutes, 26);
  assert.equal(forfeited.graceForfeited, true);
  assert.equal(forfeited.lateDeductionDaysRaw, 0.5);
  assert.equal(forfeited.lateDeductionDays, 0.5);
  assert.equal(forfeited.absentDatesAfterJoin.length, 3);

  // Admin rollback of the 180 min grace -> nothing left to charge.
  const rolledBack = run(180);
  assert.equal(rolledBack.lateRollbackMinutes, 180);
  assert.equal(rolledBack.chargeableLateMinutes, 0);
  assert.equal(rolledBack.lateDeductionDays, 0);
  assert.equal(rolledBack.lateRollbackDays, 0.5);
  assert.equal(rolledBack.totalDueDays, forfeited.totalDueDays + 0.5);
});

test('180-min grace rollback gives the minutes back before the ladder runs', () => {
  const dim = daysInMonth(2026, 9);
  const records = [];
  for (let d = 1; d <= dim; d++) {
    const date = `2026-10-${String(d).padStart(2, '0')}`;
    if (new Date(date + 'T00:00:00Z').getUTCDay() === 0) continue;
    records.push(date === '2026-10-05' ? rec(date, 'late', 1000) : rec(date, 'present'));
  }
  const run = (lateRollbackMinutes) => computePaidDays({
    year: 2026, month: 9, daysInMonth: dim, records,
    createdAt: '2021-06-01T00:00:00.000Z', holidayDates: [], viewingToday: dim,
    lateGraceMinutes: 180, includeHolidayPay: false, compensatoryWorkdays: [], lateRollbackMinutes,
  });

  const base = run(0);
  assert.equal(base.totalLateMinutes, 1000);
  assert.equal(base.lateDeductionDaysRaw, 2.5); // (1000 + 180) / 480 -> 2.5
  assert.equal(base.lateDeductionDays, 2.5);
  assert.equal(base.lateRollbackMinutes, 0);

  // 180 minutes back: the ladder now runs on 820 min -> (820+180)/480 = 2.08 -> 2.0
  const waived = run(180);
  assert.equal(waived.lateRollbackMinutes, 180);
  assert.equal(waived.chargeableLateMinutes, 820);
  assert.equal(waived.lateDeductionDaysRaw, 2.5);
  assert.equal(waived.lateDeductionDays, 2);
  assert.equal(waived.lateRollbackDays, 0.5);
  assert.equal(waived.totalDueDays, base.totalDueDays + 0.5);

  // Never more than the pool, never negative.
  assert.equal(run(5000).chargeableLateMinutes, 0);
  assert.equal(run(5000).lateRollbackMinutes, 1000);
  assert.equal(run(-180).lateDeductionDays, 2.5);
});

test('new: Sundays before the join date are not paid', () => {
  const dim = daysInMonth(2026, 9);
  const records = [];
  for (let d = 8; d <= dim; d++) {
    const date = `2026-10-${String(d).padStart(2, '0')}`;
    records.push(rec(date, 'present'));
  }
  const r = computePaidDays({
    year: 2026, month: 9, daysInMonth: dim, records,
    createdAt: '2026-10-08T04:00:00.000Z', holidayDates: [], viewingToday: dim,
    lateGraceMinutes: 180, includeHolidayPay: false, compensatoryWorkdays: [],
  });
  // Oct 4 is before the join date; 11, 18 and 25 are eligible (join day <= 10,
  // so the late-join cancellation does not trigger).
  assert.equal(r.sundayStats.totalSundays, 3);
  assert.equal(r.sundayStats.paidSundays, 3);
  assert.deepEqual(r.sundayStats.unpaidSundays, []);
  assert.ok(!r.sundayStats.eligibleSundays.includes('2026-10-04'));
});

test('new: joining after the 10th still cancels every Sunday', () => {
  const dim = daysInMonth(2026, 9);
  const records = [];
  for (let d = 15; d <= dim; d++) {
    const date = `2026-10-${String(d).padStart(2, '0')}`;
    records.push(rec(date, 'present'));
  }
  const r = computePaidDays({
    year: 2026, month: 9, daysInMonth: dim, records,
    createdAt: '2026-10-15T04:00:00.000Z', holidayDates: [], viewingToday: dim,
    lateGraceMinutes: 180, includeHolidayPay: false, compensatoryWorkdays: [],
  });
  assert.equal(r.sundayStats.totalSundays, 2);
  assert.equal(r.sundayStats.paidSundays, 0);
  assert.deepEqual(r.sundayStats.unpaidSundays, []);
});

// --- Declared holidays ------------------------------------------------------
// A holiday row is a paid day: it is never fabricated as an absent day, and
// includeHolidayPay adds it to the paid total. Absences on other dates keep
// their normal deduction (no sandwich/forfeiture rule).

function octWeekdayRecords({ skip = [] } = {}) {
  const dim = daysInMonth(2026, 9);
  const records = [];
  for (let d = 1; d <= dim; d++) {
    const date = `2026-10-${String(d).padStart(2, '0')}`;
    if (new Date(date + 'T00:00:00Z').getUTCDay() === 0) continue;
    if (skip.includes(date)) continue;
    records.push(rec(date, 'present'));
  }
  return records;
}

test('holiday: declared date is a paid day, not an absence', () => {
  const dim = daysInMonth(2026, 9);
  const r = paid({
    year: 2026,
    month: 9,
    daysInMonth: dim,
    records: octWeekdayRecords({ skip: ['2026-10-05'] }),
    createdAt: '2026-01-01T04:00:00.000Z',
    holidayDates: ['2026-10-05'],
    includeHolidayPay: true,
    viewingToday: dim,
  });
  assert.equal(r.holidayPaidDays, 1);
  assert.ok(!r.absentDatesAfterJoin.includes('2026-10-05'));
});

test('holiday: extra absence after a holiday is the only deduction', () => {
  const dim = daysInMonth(2026, 9);
  const base = octWeekdayRecords({ skip: ['2026-10-05'] });
  const holidayOnly = paid({
    year: 2026,
    month: 9,
    daysInMonth: dim,
    records: base,
    createdAt: '2026-01-01T04:00:00.000Z',
    holidayDates: ['2026-10-05'],
    includeHolidayPay: true,
    viewingToday: dim,
  });
  const withAbsence = paid({
    year: 2026,
    month: 9,
    daysInMonth: dim,
    records: octWeekdayRecords({ skip: ['2026-10-05', '2026-10-06'] }),
    createdAt: '2026-01-01T04:00:00.000Z',
    holidayDates: ['2026-10-05'],
    includeHolidayPay: true,
    viewingToday: dim,
  });
  assert.equal(withAbsence.holidayPaidDays, 1);
  assert.ok(withAbsence.absentDatesAfterJoin.includes('2026-10-06'));
  assert.ok(!withAbsence.absentDatesAfterJoin.includes('2026-10-05'));
  assert.equal(holidayOnly.totalDueDays - withAbsence.totalDueDays, 1);
});

test('holiday: stale absent rows on declared holidays are not absences', () => {
  const dim = daysInMonth(2026, 9);
  const records = octWeekdayRecords({ skip: ['2026-10-05', '2026-10-06'] });
  // Simulate attendance rows marked absent before the holiday was declared.
  records.push(rec('2026-10-05', 'absent'), rec('2026-10-06', 'absent'));
  const r = paid({
    year: 2026,
    month: 9,
    daysInMonth: dim,
    records,
    createdAt: '2026-01-01T04:00:00.000Z',
    holidayDates: ['2026-10-05', '2026-10-06'],
    includeHolidayPay: true,
    viewingToday: dim,
  });
  assert.equal(r.holidayPaidDays, 2);
  assert.ok(!r.absentDatesAfterJoin.includes('2026-10-05'));
  assert.ok(!r.absentDatesAfterJoin.includes('2026-10-06'));
  assert.equal(r.sundayStats.extraSundays.length, 0);
  assert.equal(r.sundayDeductionDays, 0);
});

// --- Joiners from AFTER the exported month ---------------------------------

test('a worker who joined after the month scores a full zero', () => {
  const r = paid({
    year: 2026, month: 8, daysInMonth: daysInMonth(2026, 8),
    records: [], createdAt: '2026-10-01T04:00:00.000Z',
  });
  assert.equal(r.joinedAfterMonth, true);
  assert.equal(r.joinedThisMonth, false);
  assert.equal(r.available, 0);
  assert.equal(r.paidDays, 0);
  assert.equal(r.totalDueDays, 0);
  assert.equal(r.presentDays, 0);
  assert.equal(r.freeSundays, 0);
  assert.equal(r.holidayPaidDays, 0);
  assert.equal(r.sundayStats.paidSundays, 0);
  assert.equal(r.deductedCount, 0);
  assert.equal(r.absentDatesAfterJoin.length, 0);
});

test('a worker who joined on the last day of the month is still listed', () => {
  const r = paid({
    year: 2026, month: 8, daysInMonth: daysInMonth(2026, 8),
    records: [], createdAt: '2026-09-30T04:00:00.000Z',
  });
  assert.ok(!r.joinedAfterMonth);
  assert.equal(r.joinedThisMonth, true);
  assert.equal(r.joinDay, 30);
  assert.equal(r.available, 1);
});
