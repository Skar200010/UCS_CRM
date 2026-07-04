import {
  getTodayAttendance,
  createAttendance,
  getAttendanceById,
  updateAttendance,
  getMonthlyLateMinutes,
  getAttendanceHistory,
  deleteAttendance,
  getMonthlyAttendance,
} from '../models/attendanceModel.js';
import { getQRByCode } from '../models/qrModel.js';
import { getSetting } from '../models/settingsModel.js';
import { getApprovedHalfDayLeave, getApprovedLeaves } from '../models/leaveModel.js';
import { getAllAttendance } from '../models/attendanceModel.js';
import { getAllWorkers, getWorkerById } from '../models/workerModel.js';
import { haversineDistance } from '../utils/geo.js';

const MAX_LATE_MINUTES = 180;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getIstTime(date = new Date()) {
  return new Date(date.getTime() + IST_OFFSET_MS);
}

function istDateStr(date = new Date()) {
  const ist = getIstTime(date);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function getOfficeStart(workerId) {
  if (workerId) {
    try {
      const worker = await getWorkerById(workerId);
      if (worker?.shift_start_time) {
        const [h, m] = worker.shift_start_time.split(':').map(Number);
        return { hour: h || 10, minute: m || 0 };
      }
    } catch (_) {}
  }
  const val = await getSetting('office_start_time');
  if (!val) return { hour: 10, minute: 0 };
  const [h, m] = val.split(':').map(Number);
  return { hour: h || 10, minute: m || 0 };
}

async function getOfficeEnd(workerId) {
  if (workerId) {
    try {
      const worker = await getWorkerById(workerId);
      if (worker?.shift_end_time) {
        const [h, m] = worker.shift_end_time.split(':').map(Number);
        return { hour: h || 19, minute: m || 0 };
      }
    } catch (_) {}
  }
  const val = await getSetting('office_end_time');
  if (!val) return { hour: 19, minute: 0 };
  const [h, m] = val.split(':').map(Number);
  return { hour: h || 19, minute: m || 0 };
}
async function calculateLateMinutes(punchInTime, workerId) {
  const ist = getIstTime(new Date(punchInTime));
  const h = ist.getUTCHours();
  const m = ist.getUTCMinutes();

  let effectiveStart = await getOfficeStart();
  const todayHalfDay = await getApprovedHalfDayLeave(workerId, istDateStr(new Date(punchInTime)));
  if (todayHalfDay && todayHalfDay.half_start_time) {
    const [hd, hm] = todayHalfDay.half_start_time.split(':').map(Number);
    effectiveStart = { hour: hd, minute: hm };
  }

  return (h > effectiveStart.hour || (h === effectiveStart.hour && m > effectiveStart.minute))
    ? (h - effectiveStart.hour) * 60 + m - effectiveStart.minute
    : 0;
}

async function isHalfDayByLatePunch(punchInTime, workerId) {
  const todayHalfDay = await getApprovedHalfDayLeave(workerId, istDateStr(new Date(punchInTime)));
  if (todayHalfDay && todayHalfDay.half_start_time) return false;
  const start = await getOfficeStart(workerId);
  const startMin = start.hour * 60 + start.minute;
  const ist = getIstTime(new Date(punchInTime));
  const punchMin = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return (punchMin - startMin) >= 240;
}

async function isHalfDayByEarlyPunchOut(punchOutTime, workerId) {
  const todayHalfDay = await getApprovedHalfDayLeave(workerId, istDateStr(new Date(punchOutTime)));
  if (todayHalfDay && todayHalfDay.half_start_time) return false;
  const end = await getOfficeEnd(workerId);
  const endMin = end.hour * 60 + end.minute;
  const ist = getIstTime(new Date(punchOutTime));
  const punchMin = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return (endMin - punchMin) >= 180;
}

export const punchIn = async (req, res) => {
  try {
    const { code, latitude, longitude } = req.body;
    if (!code || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: 'QR code, latitude, and longitude are required' });
    }

    const qr = await getQRByCode(code);
    if (!qr) {
      return res.status(404).json({ message: 'Invalid QR code' });
    }

    const distance = haversineDistance(qr.latitude, qr.longitude, latitude, longitude);
    if (distance > qr.radius_meters) {
      return res.status(403).json({
        message: `Outside range (${Math.round(distance)}m / ${qr.radius_meters}m)`,
      });
    }

    const existing = await getTodayAttendance(req.user.id);
    if (existing && existing.punch_in_time) {
      return res.status(400).json({ message: 'Already punched in today' });
    }

    const now = new Date();
    const lateMinutes = await calculateLateMinutes(now, req.user.id);
    let status = lateMinutes > 0 ? 'late' : 'present';
    if (await isHalfDayByLatePunch(now, req.user.id)) status = 'half-day';

    if (existing) {
      const updated = await updateAttendance(existing.id, {
        punch_in_time: now.toISOString(),
        punch_in_lat: latitude,
        punch_in_lng: longitude,
        late_minutes: lateMinutes,
        status,
      });
      return res.json({ message: 'Punch in recorded', attendance: updated, lateMinutes });
    }

    const attendance = await createAttendance({
      worker_id: req.user.id,
      date: istDateStr(now),
      punch_in_time: now.toISOString(),
      punch_in_lat: latitude,
      punch_in_lng: longitude,
      late_minutes: lateMinutes,
      status,
    });

    return res.status(201).json({ message: 'Punch in recorded', attendance, lateMinutes });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const punchOut = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    const existing = await getTodayAttendance(req.user.id);
    if (!existing || !existing.punch_in_time) {
      return res.status(400).json({ message: 'No punch in record for today' });
    }
    if (existing.punch_out_time) {
      return res.status(400).json({ message: 'Already punched out today' });
    }

    const now = new Date();
    const updates = {
      punch_out_time: now.toISOString(),
      punch_out_lat: latitude,
      punch_out_lng: longitude,
    };
    if (existing.status !== 'half-day' && existing.status !== 'leave' && existing.status !== 'absent') {
      if (await isHalfDayByEarlyPunchOut(now, req.user.id)) updates.status = 'half-day';
    }
    const updated = await updateAttendance(existing.id, updates);

    const punchIn = new Date(existing.punch_in_time);
    const hoursWorked = ((now - punchIn) / 3600000).toFixed(1);

    return res.json({ message: 'Punch out recorded', attendance: updated, hoursWorked });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const todayStatus = async (req, res) => {
  try {
    const record = await getTodayAttendance(req.user.id);
    const lateUsed = await getMonthlyLateMinutes(req.user.id);
    const [officeStart, officeEnd] = await Promise.all([
      getOfficeStart(req.user.id),
      getOfficeEnd(req.user.id),
    ]);
    const fmt = (o) => `${o.hour.toString().padStart(2, '0')}:${o.minute.toString().padStart(2, '0')}`;
    return res.json({
      attendance: record || null,
      lateUsed,
      lateRemaining: MAX_LATE_MINUTES - lateUsed,
      officeStartTime: fmt(officeStart),
      officeEndTime: fmt(officeEnd),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

function expandLeaveDates(leave) {
  const dates = [];
  if ((leave.type === 'full_day' || leave.type === 'emergency') && leave.leave_date) {
    dates.push(leave.leave_date);
  } else if (leave.type === 'half_day' && leave.leave_date) {
    dates.push(leave.leave_date);
  } else if (leave.type === 'vacational' && leave.start_date && leave.end_date) {
    const start = new Date(leave.start_date + 'T00:00:00+05:30');
    const end = new Date(leave.end_date + 'T00:00:00+05:30');
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${day}`);
    }
  }
  return dates;
}

export const createAttendanceByHR = async (req, res) => {
  try {
    const { worker_id, date, punch_in_time, punch_out_time, status, late_minutes } = req.body;
    if (!worker_id || !date) {
      return res.status(400).json({ message: 'worker_id and date are required' });
    }
    const record = {
      worker_id,
      date,
      punch_in_time: punch_in_time || null,
      punch_out_time: punch_out_time || null,
      status: status || 'present',
      late_minutes: late_minutes || 0,
    };
    const result = await createAttendance(record);
    return res.status(201).json({ message: 'Attendance created', attendance: result });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateAttendanceRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { punch_in_time, punch_out_time, status, late_minutes, date } = req.body;
    const updates = {};
    if (punch_in_time !== undefined) updates.punch_in_time = punch_in_time;
    if (punch_out_time !== undefined) updates.punch_out_time = punch_out_time;
    if (status !== undefined) updates.status = status;
    if (late_minutes !== undefined) updates.late_minutes = late_minutes;
    if (date !== undefined) updates.date = date;

    if (punch_in_time !== undefined) {
      if (punch_in_time === null) {
        updates.late_minutes = 0;
        if (status === undefined) updates.status = 'absent';
      } else {
        const existing = await getAttendanceById(id);
        if (existing) {
          updates.late_minutes = await calculateLateMinutes(punch_in_time, existing.worker_id);
          updates.status = updates.late_minutes > 0 ? 'late' : 'present';
        }
      }
    }

    const result = await updateAttendance(id, updates);
    return res.json({ message: 'Attendance updated', attendance: result });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const listAll = async (req, res) => {
  try {
    let records = await getAllAttendance();
    const ngoId = req.user.role === 'hr' ? null : (req.user.ngo_id || req.query.ngo_id);
    if (ngoId) {
      const workers = await getAllWorkers(ngoId);
      const workerIds = new Set(workers.map((w) => w.id));
      records = records.filter((r) => workerIds.has(r.worker_id));
    }
    for (const r of records) {
      if (r.punch_in_time && r.punch_out_time) {
        const pi = new Date(r.punch_in_time).getTime();
        const po = new Date(r.punch_out_time).getTime();
        const diffMs = po - pi;
        const hours = Math.floor(diffMs / 3600000);
        const minutes = Math.floor((diffMs % 3600000) / 60000);
        r.hours_worked = `${hours}h ${minutes}m`;
      } else {
        r.hours_worked = null;
      }
    }
    return res.json(records);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getWorkerMonthlyAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { month } = req.query;
    if (!month) {
      return res.status(400).json({ message: 'month query parameter is required (YYYY-MM)' });
    }
    const startDate = month + '-01';
    const [y, m] = month.split('-').map(Number);
    const endDate = new Date(y, m, 0).toISOString().slice(0, 10);
    const records = await getMonthlyAttendance(id, startDate, endDate);

    const allLeaves = await getApprovedLeaves(id);
    const approvedLeaves = allLeaves.filter(l => {
      const leaveStart = l.leave_date || l.start_date;
      const leaveEnd = l.leave_date || l.end_date;
      return leaveStart && leaveStart <= endDate && (!leaveEnd || leaveEnd >= startDate);
    });
    const leaveByDate = {};
    for (const leave of approvedLeaves) {
      for (const date of expandLeaveDates(leave)) {
        if (date >= startDate && date <= endDate) {
          leaveByDate[date] = true;
        }
      }
    }

    const recordDates = new Set(records.map((r) => r.date));
    for (const [date] of Object.entries(leaveByDate)) {
      if (!recordDates.has(date)) {
        records.push({ date, status: 'leave', late_minutes: 0, hours_worked: null });
      }
    }

    records.sort((a, b) => a.date.localeCompare(b.date));
    return res.json(records);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const myHistory = async (req, res) => {
  try {
    const records = await getAttendanceHistory(req.user.id);
    const approvedLeaves = await getApprovedLeaves(req.user.id);

    if (approvedLeaves.length === 0) return res.json(records);

    const leaveByDate = {};
    for (const leave of approvedLeaves) {
      for (const date of expandLeaveDates(leave)) {
        leaveByDate[date] = true;
      }
    }

    const recordDates = new Set(records.map((r) => r.date));
    for (const [date, _] of Object.entries(leaveByDate)) {
      if (!recordDates.has(date)) {
        records.push({ date, status: 'leave', late_minutes: 0, hours_worked: null });
      }
    }

    for (const r of records) {
      if (r.punch_in_time && r.punch_out_time) {
        const pi = new Date(r.punch_in_time).getTime();
        const po = new Date(r.punch_out_time).getTime();
        const diffMs = po - pi;
        const hours = Math.floor(diffMs / 3600000);
        const minutes = Math.floor((diffMs % 3600000) / 60000);
        r.hours_worked = `${hours}h ${minutes}m`;
      } else {
        r.hours_worked = null;
      }
    }

    records.sort((a, b) => {
      if (a.date > b.date) return -1;
      if (a.date < b.date) return 1;
      return 0;
    });

    return res.json(records);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteAttendanceRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await getAttendanceById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }
    const result = await deleteAttendance(id);
    return res.json({ message: 'Attendance deleted', attendance: result });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
