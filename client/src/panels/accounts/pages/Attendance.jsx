import { useState, useEffect } from 'react';
import { apiGet, apiPut } from '../api/auth';
import { deptLabel } from '../../../lib/labels';
import { SHOW_NETWORK_DETAIL } from '../../../lib/networkDetail';
import * as XLSX from 'xlsx-js-style';

const IST_OFFSET = 5.5 * 60 * 60 * 1000;

function getIstDateStr(date) {
  const ist = new Date(date.getTime() + IST_OFFSET);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function formatAttendanceTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const ist = new Date(d.getTime() + IST_OFFSET);
  let hh = ist.getUTCHours();
  const mm = String(ist.getUTCMinutes()).padStart(2, '0');
  const suffix = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12 || 12;
  return `${String(hh).padStart(2, '0')}:${mm} ${suffix}`;
}

function calcWorkingHours(rec) {
  if (!rec || !rec.punch_in_time || !rec.punch_out_time) return null;
  const inMs = new Date(new Date(rec.punch_in_time).getTime() + IST_OFFSET).getTime();
  const outMs = new Date(new Date(rec.punch_out_time).getTime() + IST_OFFSET).getTime();
  const mins = Math.max(0, Math.round((outMs - inMs) / 60000));
  if (mins < 1) return null;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const CELL_STATUS = {
  present:    { icon: '\u2713', label: 'PRESENT',  text: '#065f46', bg: '#d1fae5' },
  late:       { icon: '\u26A0', label: 'LATE',     text: '#92400e', bg: '#fef3c7' },
  'half-day': { icon: '\u25D0', label: 'HALF DAY', text: '#9a3412', bg: '#ffedd5' },
  absent:     { icon: '\u2715', label: 'ABSENT',   text: '#991b1b', bg: '#fee2e2' },
  leave:      { icon: '\u270B', label: 'LEAVE',    text: '#1e40af', bg: '#dbeafe' },
  holiday:    { icon: '\u2605', label: 'HOLIDAY',  text: '#075985', bg: '#e0f2fe' },
  off:        { icon: '\u25CB', label: 'OFF',      text: '#6b7280', bg: '#f3f4f6' },
};

function istTimeStr(iso) {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + IST_OFFSET);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

// Builds and downloads the monthly attendance sheet (In/Out per day, status
// colors, per-worker Present/Absent/Sunday/Half Day totals) for a date range.
// Shared by this page's Export Sheet bar and the Salary & Advances page's
// "Export Excel" modal. Callers that already hold the data pass it in as
// `preload`; otherwise it is fetched here.
export async function exportAttendanceSheet(exportFrom, exportTo, preload) {
  try {
    if (!exportFrom || !exportTo) { alert('Please select both a From and To date.'); return; }
    if (exportTo < exportFrom) { alert('The "To" date cannot be before the "From" date.'); return; }

    let workers = preload?.workers;
    let allRecords = preload?.allRecords;
    if (!workers || !allRecords) {
      const results = await Promise.allSettled([
        apiGet('/workers?status=all'),
        apiGet('/attendance/all'),
      ]);
      workers = results[0].status === 'fulfilled' ? (results[0].value || []) : [];
      allRecords = results[1].status === 'fulfilled' && Array.isArray(results[1].value) ? results[1].value : [];
    }

    // Declared holidays are paid days. They must read as "H" here, never as
    // "A", so the exported attendance sheet does not look like a deduction.
    let holidays = preload?.holidays;
    if (!holidays) {
      try { holidays = await apiGet('/holidays'); } catch { holidays = []; }
    }
    const holidaySet = new Set(
      (Array.isArray(holidays) ? holidays : [])
        .filter((h) => String(h.type || 'holiday') !== 'event')
        .map((h) => String(h.date || '').slice(0, 10)),
    );

    const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = [];
    const cur = new Date(exportFrom + 'T00:00:00+05:30');
    const stop = new Date(exportTo + 'T00:00:00+05:30');
    while (cur <= stop) {
      days.push(`${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, '0')}-${String(cur.getUTCDate()).padStart(2, '0')}`);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    if (days.length === 0) { alert('The date range is empty.'); return; }
    const todayStr = getIstDateStr(new Date());

    const fmtFrom = new Date(exportFrom + 'T12:00:00Z');
    const fmtTo = new Date(exportTo + 'T12:00:00Z');
    const sameMonth = fmtFrom.getUTCMonth() === fmtTo.getUTCMonth() && fmtFrom.getUTCFullYear() === fmtTo.getUTCFullYear();
    const monthLabel = fmtFrom.toLocaleString('en-US', { month: 'long' });
    const rangeLabel = sameMonth ? `${monthLabel} ${fmtFrom.getUTCFullYear()}` : `${exportFrom} to ${exportTo}`;

    const recCache = {};
    allRecords.forEach(r => {
      const date = r.date || (r.punch_in_time ? getIstDateStr(new Date(r.punch_in_time)) : '');
      if (!date) return;
      recCache[`${r.worker_id}|${date}`] = r;
    });

    const activeWorkers = workers
      .filter(w => String(w.employment_status || '').toLowerCase().trim() !== 'absconded')
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const totalCols = 3 + days.length + 7;
    const wsData = [
      ['No. ', 'Week ', rangeLabel, ...days.map(d => WEEKDAYS[new Date(d + 'T12:00:00Z').getUTCDay()]), 'Present', 'Absent', 'Holiday', 'Sunday', 'Half Day', 'Total Late Minutes', 'Total Late Hours'],
      ['Sr.', 'Name of the Staff', 'Day ', ...days.map(d => parseInt(d.slice(8), 10)), '', '', '', '', '', '', ''],
    ];

    activeWorkers.forEach((w, idx) => {
      const joinDate = (w.created_at || '').slice(0, 10);
      let present = 0, absent = 0, holiday = 0, sunday = 0, halfDay = 0, lateMinutes = 0;
      const inCells = [];
      const outCells = [];
      for (const ds of days) {
        const dow = new Date(ds + 'T12:00:00Z').getUTCDay();
        if (ds > todayStr) { inCells.push(''); outCells.push(''); continue; }
        if (joinDate && ds < joinDate) { inCells.push(''); outCells.push(''); continue; }
        if (dow === 0) { sunday++; inCells.push(''); outCells.push(''); continue; }
        const rec = recCache[`${w.id}|${ds}`];
        // A declared holiday with no punch — or with a stale absent/leave row —
        // is a paid day: count it separately and never as an absent day. A real
        // punch on that date still wins below.
        if (holidaySet.has(ds) && (!rec || rec.status === 'absent' || rec.status === 'leave')) {
          holiday++; inCells.push('H'); outCells.push(''); continue;
        }
        if (!rec) { absent++; inCells.push('A'); outCells.push(''); continue; }
        lateMinutes += (rec.late_minutes || 0);
        if (rec.status === 'present' || rec.status === 'late') {
          present++;
          inCells.push(istTimeStr(rec.punch_in_time) || 'P');
          outCells.push(istTimeStr(rec.punch_out_time) || '');
        } else if (rec.status === 'half-day') {
          halfDay++;
          inCells.push(istTimeStr(rec.punch_in_time) || 'HD');
          outCells.push('HD');
        } else if (rec.status === 'leave') {
          absent++;
          inCells.push('L'); outCells.push('');
        } else {
          absent++;
          inCells.push('A'); outCells.push('');
        }
      }
      wsData.push([idx + 1, w.name || `Worker ${w.id}`, 'In ', ...inCells, present, absent, holiday, sunday, halfDay, lateMinutes, Math.round((lateMinutes / 60) * 100) / 100]);
      wsData.push(['', '', 'Out', ...outCells, '', '', '', '', '', '', '']);
      wsData.push(Array(totalCols).fill(''));
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 4 }, { wch: 26 }, { wch: 7 }, ...days.map(() => ({ wch: 8 })), { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 8 }, { wch: 9 }, { wch: 12 }, { wch: 12 }];

    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < totalCols; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell) cell.s = { font: { bold: true }, fill: { fgColor: { rgb: 'FFE8E8E8' } }, alignment: { horizontal: 'center' } };
      }
    }
    for (let i = 2; i < wsData.length; i++) {
      const row = wsData[i];
      const rowNum = i;
      if (row.every(v => v === '' || v == null)) {
        for (let c = 0; c < totalCols; c++) {
          ws[XLSX.utils.encode_cell({ r: rowNum, c })] = { t: 's', v: '', s: { fill: { fgColor: { rgb: 'FF111111' } } } };
        }
        continue;
      }
      const nameCell = ws[XLSX.utils.encode_cell({ r: rowNum, c: 1 })];
      if (nameCell) nameCell.s = { font: { bold: true } };
      for (let c = 0; c < days.length; c++) {
        const v = row[3 + c];
        const addr = XLSX.utils.encode_cell({ r: rowNum, c: 3 + c });
        const cell = ws[addr];
        if (!cell) continue;
        if (v === 'A') cell.s = { fill: { fgColor: { rgb: 'FFFDE2E1' } }, font: { bold: true, color: { rgb: 'FFB91C1C' } } };
        else if (v === 'H') cell.s = { fill: { fgColor: { rgb: 'FFE0F2FE' } }, font: { bold: true, color: { rgb: 'FF075985' } } };
        else if (v === 'L') cell.s = { fill: { fgColor: { rgb: 'FFFEF3C7' } }, font: { bold: true, color: { rgb: 'FFB45309' } } };
        else if (v === 'HD') cell.s = { fill: { fgColor: { rgb: 'FFFFEDD5' } }, font: { bold: true, color: { rgb: 'FFC2410C' } } };
      }
      for (let c = totalCols - 7; c < totalCols; c++) {
        const addr = XLSX.utils.encode_cell({ r: rowNum, c });
        if (ws[addr]) ws[addr].s = { font: { bold: true }, fill: { fgColor: { rgb: 'FFE8F5E9' } } };
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellStyles: true });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    link.download = `attendance-sheet-${exportFrom}_to_${exportTo}.xlsx`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (e) {
    alert('Export failed: ' + e.message);
  }
}

export default function Attendance() {
  const [workers, setWorkers] = useState([]);
  const [todayRecords, setTodayRecords] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [attendanceFilter, setAttendanceFilter] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [previewImg, setPreviewImg] = useState(null);
  // Selfie URLs are presigned server-side and expire; if one still fails to load
  // (expired link, object gone) it is remembered here so the row can fall back to
  // the QR/placeholder instead of rendering a broken image.
  const [brokenSelfies, setBrokenSelfies] = useState(() => new Set());
  const markSelfieBroken = (url) => {
    if (!url) return;
    setBrokenSelfies((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  };

  // Export modal: the admin picks full month / one day / one week at export
  // time instead of carrying a date range in the toolbar.
  const istNow = new Date(Date.now() + IST_OFFSET);
  const todayIst = getIstDateStr(new Date());
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMode, setExportMode] = useState('month');
  const [exportMonth, setExportMonth] = useState(() => `${istNow.getUTCFullYear()}-${String(istNow.getUTCMonth() + 1).padStart(2, '0')}`);
  const [exportDay, setExportDay] = useState(todayIst);
  const [exportWeekStart, setExportWeekStart] = useState(() => {
    const d = new Date(todayIst + 'T00:00:00');
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [exportCustomFrom, setExportCustomFrom] = useState(`${istNow.getUTCFullYear()}-${String(istNow.getUTCMonth() + 1).padStart(2, '0')}-01`);
  const [exportCustomTo, setExportCustomTo] = useState(todayIst);

  // detailed drill-down (read-only)
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [workerMonth, setWorkerMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loadError, setLoadError] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const results = await Promise.allSettled([
        apiGet('/workers?status=all'),
        apiGet('/attendance/today-all'),
        apiGet('/attendance/all'),
        apiGet('/holidays'),
      ]);
      const workersData = results[0].status === 'fulfilled' ? results[0].value : [];
      const attendanceData = results[1].status === 'fulfilled' ? results[1].value : [];
      const allData = results[2].status === 'fulfilled' ? results[2].value : [];
      const holidayData = results[3].status === 'fulfilled' ? results[3].value : [];
      setWorkers(workersData || []);
      setTodayRecords(attendanceData || []);
      setAllRecords(Array.isArray(allData) ? allData : []);
      setHolidays(Array.isArray(holidayData) ? holidayData : []);
    } catch (e) {
      console.error(e);
      setLoadError(true);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleVerify = async (id) => {
    try {
      await apiPut(`/attendance/${id}/verify-selfie`, { status: 'verified' });
      setTodayRecords(prev => prev.map(r => r.id === id ? { ...r, selfie_status: 'verified' } : r));
      setAllRecords(prev => prev.map(r => r.id === id ? { ...r, selfie_status: 'verified' } : r));
    } catch (e) {
      alert(e.message || 'Failed to verify');
    }
  };

  const handleReject = async (id) => {
    if (!confirm('Reject selfie? This will delete the entire attendance record.')) return;
    try {
      await apiPut(`/attendance/${id}/verify-selfie`, { status: 'rejected' });
      setTodayRecords(prev => prev.filter(r => r.id !== id));
      setAllRecords(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      alert(e.message || 'Failed to reject');
    }
  };

  const exportRange = () => {
    if (exportMode === 'day') return [exportDay, exportDay];
    if (exportMode === 'custom') {
      return exportCustomTo < exportCustomFrom
        ? [exportCustomFrom, exportCustomFrom]
        : [exportCustomFrom, exportCustomTo];
    }
    if (exportMode === 'week') {
      const start = new Date(exportWeekStart + 'T00:00:00');
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return [exportWeekStart, ymd(end)];
    }
    const [y, m] = exportMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return [`${exportMonth}-01`, `${exportMonth}-${String(lastDay).padStart(2, '0')}`];
  };

  const handleExportSheet = () => {
    // The sheet builder lives at module level so the Salary & Advances page
    // can drive the same export through its month-picker modal; here we just
    // hand it the data this page already has loaded.
    const [from, to] = exportRange();
    exportAttendanceSheet(from, to, { workers, allRecords, holidays });
    setExportOpen(false);
  };

  const fmt = (t) => {
    if (!t) return '—';
    const d = new Date(t);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const yesterdayStr = getIstDateStr(new Date(Date.now() - 24 * 60 * 60 * 1000));
  // System / test accounts that must not appear in the attendance list.
  const EXCLUDED_WORKER_NAMES = new Set(['admin', 'appdev', 'library', 'pg', 'shawn', 'shawnnn', 'suspense']);
  const merged = workers
    .filter(w => !EXCLUDED_WORKER_NAMES.has(String(w.name || '').trim().toLowerCase()))
    .map(w => {
    const record = todayRecords.find(r => r.worker_id === w.id);
    const yesterdayRecord = (allRecords || []).find(r => {
      if (r.worker_id !== w.id) return false;
      const rd = r.date || (r.punch_in_time ? getIstDateStr(new Date(r.punch_in_time)) : '');
      return rd === yesterdayStr;
    });
    return {
      ...w,
      record: record || null,
      yesterdayRecord: yesterdayRecord || null,
      hasPunch: !!record,
    };
  }).sort((a, b) => {
    const aPresent = a.hasPunch ? 0 : 1;
    const bPresent = b.hasPunch ? 0 : 1;
    if (aPresent !== bPresent) return aPresent - bPresent;
    const nameA = (a.name || '').toLowerCase();
    const nameB = (b.name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  const filtered = merged.filter(r => {
    const isAbs = String(r.employment_status || '').toLowerCase().trim() === 'absconded';
    if (statusFilter === 'active' && isAbs) return false;
    if (statusFilter === 'absconded' && !isAbs) return false;
    if (attendanceFilter !== 'all') {
      const st = r.record?.status || '';
      if (attendanceFilter === 'present' && (!r.hasPunch || st === 'half-day' || st === 'leave')) return false;
      else if (attendanceFilter === 'halfday' && st !== 'half-day') return false;
      else if (attendanceFilter === 'absent' && r.hasPunch) return false;
    }
    if (!search) return true;
    const name = r.name || '';
    const dept = r.department || '';
    return name.toLowerCase().includes(search.toLowerCase()) || dept.toLowerCase().includes(search.toLowerCase());
  });

  const punchedIn = filtered.filter(r => r.hasPunch).length;
  const noPunch = filtered.filter(r => !r.hasPunch).length;
  const activeFilterCount = (statusFilter !== 'active' ? 1 : 0) + (attendanceFilter !== 'all' ? 1 : 0);

  // detailed worker attendance for selected month (read-only) — hide future dates, most recent first
  const workerRecords = (() => {
    if (!selectedWorker) return [];
    const recs = allRecords.filter(a => a.worker_id === selectedWorker.id);
    const [y, m] = workerMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const todayStr = getIstDateStr(new Date());
    const filled = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${workerMonth}-${String(d).padStart(2, '0')}`;
      if (ds > todayStr) continue;
      const existing = recs.find(r => {
        const rd = r.date || (r.punch_in_time ? getIstDateStr(new Date(r.punch_in_time)) : '');
        return rd === ds;
      });
      filled.push(existing || { id: null, date: ds, status: 'absent', punch_in_time: null, punch_out_time: null, late_minutes: 0, worker_id: selectedWorker.id });
    }
    return filled.reverse();
  })();

  // Declared holidays for the worker calendar. Paid, never absent.
  const workerHolidaySet = new Set(
    holidays
      .filter((h) => String(h.type || 'holiday') !== 'event' && String(h.date || '').startsWith(workerMonth))
      .map((h) => String(h.date).slice(0, 10)),
  );

  if (selectedWorker) {
    const [y, m] = workerMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const firstDow = new Date(y, m - 1, 1).getDay();
    const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const todayStr = getIstDateStr(new Date());
    const nowMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    const shiftMonth = (delta) => {
      const nd = new Date(y, m - 1 + delta, 1);
      const nm = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}`;
      if (nm > nowMonth) return;
      setWorkerMonth(nm);
    };

    const resolveStatus = (rec, dow, dateStr) => {
      if (rec && rec.id) {
        // A stale absent/leave row on a declared holiday reads as the holiday.
        if (dateStr && workerHolidaySet.has(dateStr) && (rec.status === 'absent' || rec.status === 'leave')) return 'holiday';
        return rec.status;
      }
      if (dow === 0) return 'off';
      if (dateStr && workerHolidaySet.has(dateStr)) return 'holiday';
      return 'absent';
    };

    const calendarDays = [];
    const counts = { present: 0, late: 0, 'half-day': 0, absent: 0, leave: 0, holiday: 0, off: 0 };
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${workerMonth}-${String(d).padStart(2, '0')}`;
      const dow = new Date(y, m - 1, d).getDay();
      const rec = workerRecords.find(r => r.date === dateStr) || null;
      const day = {
        dateStr,
        day: d,
        dow,
        isToday: dateStr === todayStr,
        isFuture: dateStr > todayStr,
        rec,
        status: resolveStatus(rec, dow, dateStr),
      };
      if (!day.isFuture) counts[day.status] = (counts[day.status] || 0) + 1;
      calendarDays.push(day);
    }

    const lateTotal = workerRecords.reduce(
      (s, r) => s + (r.status === 'half-day' ? 0 : (r.late_minutes || 0)), 0,
    );

    const summaryCards = [
      { label: 'Present', value: counts.present, ...CELL_STATUS.present },
      { label: 'Late', value: counts.late, ...CELL_STATUS.late },
      { label: 'Half Day', value: counts['half-day'], ...CELL_STATUS['half-day'] },
      { label: 'Absent', value: counts.absent, ...CELL_STATUS.absent },
      { label: 'Leave', value: counts.leave, ...CELL_STATUS.leave },
    ];

    const previewModal = previewImg && (
      <div
        onClick={() => setPreviewImg(null)}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2200, cursor: 'pointer',
        }}
      >
        <img src={previewImg} alt="selfie preview" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain' }} />
        <div style={{ position: 'absolute', top: 16, right: 20, color: 'white', fontSize: 28, fontWeight: 300 }}>✕</div>
      </div>
    );

    return (
      <div style={{ padding: 20 }}>
        <div className="acc-head">
          <button onClick={() => setSelectedWorker(null)} className="acc-back">← Back</button>
          <div className="acc-head-main">
            <h2>{selectedWorker.name}</h2>
            <p>{deptLabel(selectedWorker.department) || '—'} · {selectedWorker.login_id || selectedWorker.email || ''}</p>
          </div>
        </div>

        <div className="acc-cal-card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <button className="acc-nav-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
              <h3 style={{ fontSize:16, minWidth:160, textAlign:'center', margin:0 }}>{monthLabel}</h3>
              <button className="acc-nav-btn" onClick={() => shiftMonth(1)} disabled={workerMonth >= nowMonth} aria-label="Next month">›</button>
            </div>
            <div style={{ display:'flex', alignItems:'baseline', gap:7, padding:'7px 13px', background:'var(--bg)', border:'1px solid var(--line)', borderRadius:'var(--radius-sm)' }}>
              <span style={{ fontWeight:600, fontSize:12, color:'var(--ink)' }}>Late this month</span>
              <span style={{ fontWeight:700, fontSize:16, color: lateTotal > 0 ? 'var(--danger)' : 'var(--sage)' }}>{lateTotal}</span>
              <span style={{ fontSize:11, color:'var(--ink-soft)' }}>actual late minutes</span>
            </div>
          </div>

          {loading ? (
            <div className="acc-skeleton">{Array.from({ length: 35 }).map((_, i) => <div key={i} className="acc-skel-cell" />)}</div>
          ) : loadError ? (
            <div className="acc-state">
              <p>Could not load attendance data.</p>
              <div><button className="acc-today-btn" onClick={load}>Try Again</button></div>
            </div>
          ) : workerRecords.length === 0 ? (
            <div className="acc-state">
              <p>No attendance records for this month.</p>
              <div><button className="acc-today-btn" onClick={() => setWorkerMonth(nowMonth)}>Go to Current Month</button></div>
            </div>
          ) : (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, background:'var(--line)', border:'1px solid var(--line)', borderRadius:6, overflow:'hidden', fontSize:12 }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} style={{ textAlign:'center', fontWeight:600, color:'var(--ink-soft)', padding:'7px 0', background:'var(--bg)' }}>{d}</div>
                ))}
                {Array.from({ length: firstDow }).map((_, i) => <div key={`b${i}`} style={{ background:'#fff', minHeight:52 }} />)}
                {calendarDays.map(d => {
                  const s = d.isFuture ? null : d.status;
                  let bg = '#fff';
                  if (!d.isFuture) {
                    if (s === 'present') bg = '#d4edda';
                    else if (s === 'late') bg = '#fef3c7';
                    else if (s === 'absent') bg = '#ffe0e0';
                    else if (s === 'leave') bg = '#f3e8ff';
                    else if (s === 'half-day') bg = '#e8d5f5';
                    else if (s === 'holiday') bg = '#e0f2fe';
                    else if (s === 'off' || d.dow === 0) bg = '#f0f0f0';
                  }
                  const inT = d.rec?.punch_in_time ? formatAttendanceTime(d.rec.punch_in_time) : '';
                  const outT = d.rec?.punch_out_time ? formatAttendanceTime(d.rec.punch_out_time) : '';
                  // Show punches whenever they exist, even if the status is
                  // absent/half-day — the admin still needs the IN/OUT times.
                  const showTimes = !d.isFuture && (!!inT || !!outT);
                  const fallback = d.isFuture ? ''
                    : s === 'absent' ? 'Absent'
                    : s === 'leave' ? 'Leave'
                    : s === 'holiday' ? 'Holiday'
                    : (s === 'off' || d.dow === 0) ? '—'
                    : '';
                  const selected = selectedDay && selectedDay.dateStr === d.dateStr;
                  return (
                    <div
                      key={d.dateStr}
                      onClick={() => { if (!d.isFuture) setSelectedDay(d); }}
                      title={d.isFuture ? 'Upcoming' : `${d.dateStr}${CELL_STATUS[d.status]?.label ? ` · ${CELL_STATUS[d.status].label}` : ''}`}
                      style={{
                        textAlign:'center', padding:'7px 2px', background:bg, fontSize:11, minHeight:58, boxSizing:'border-box',
                        cursor: d.isFuture ? 'default' : 'pointer',
                        outline: selected ? '2px solid var(--sage)' : 'none', outlineOffset: -2,
                        opacity: d.isFuture ? 0.65 : 1,
                      }}
                    >
                      <div style={{ fontWeight:700, fontSize:13, color:'#111827', lineHeight:1.2 }}>{d.day}</div>
                      {d.isToday && (
                        <div style={{ marginTop:1 }}>
                          <span style={{ fontSize:8, fontWeight:800, letterSpacing:'.04em', color:'#059669', background:'#ecfdf5', border:'1px solid #a7f3d0', borderRadius:999, padding:'0 5px' }}>
                            TODAY
                          </span>
                        </div>
                      )}
                      {showTimes ? (
                        <div style={{ fontSize:11, lineHeight:1.5, color:'#111827', fontVariantNumeric:'tabular-nums', fontWeight:700, marginTop:1 }}>
                          <div><span style={{ fontSize:9, fontWeight:800, color:'#16a34a', marginRight:3 }}>IN</span>{inT || '—'}</div>
                          <div><span style={{ fontSize:9, fontWeight:800, color:'#6b7280', marginRight:3 }}>OUT</span>{outT || '—'}</div>
                        </div>
                      ) : fallback ? (
                        <div style={{ fontSize:10, fontWeight:700, color:'#374151', marginTop:2 }}>{fallback}</div>
                      ) : null}
                    </div>
                  );
                })}
                {Array.from({ length: (7 - ((firstDow + daysInMonth) % 7)) % 7 }).map((_, i) => (
                  <div key={`t${i}`} style={{ background:'#fff', minHeight:52 }} />
                ))}
              </div>

              <div className="acc-mob-list">
                {calendarDays.filter(d => !d.isFuture).slice().reverse().map(d => (
                  <div key={d.dateStr} className="acc-mob-row" onClick={() => setSelectedDay(d)}>
                    <div>
                      <b className="acc-mob-date">{d.dateStr}</b>
                      <div className="acc-mob-sub">
                        {d.rec && d.rec.id
                          ? `IN ${d.rec.punch_in_time ? formatAttendanceTime(d.rec.punch_in_time) : '—'}${d.rec.punch_out_time ? ` · OUT ${formatAttendanceTime(d.rec.punch_out_time)}` : ''}`
                          : d.status === 'holiday' ? 'Declared paid holiday'
                          : d.status === 'absent' || d.status === 'off' ? 'No attendance' : 'Marked leave'}
                      </div>
                    </div>
                    <span className="acc-cal-badge" style={{ background: CELL_STATUS[d.status].bg, color: CELL_STATUS[d.status].text }}>
                      {CELL_STATUS[d.status].icon} {CELL_STATUS[d.status].label}
                    </span>
                  </div>
                ))}
              </div>

            </>
          )}
        </div>

        {selectedDay && (
          <div className="acc-modal-wrap" onClick={() => setSelectedDay(null)}>
            <div className="acc-modal" onClick={e => e.stopPropagation()}>
              <button className="acc-modal-close" onClick={() => setSelectedDay(null)}>✕</button>
              <h3 className="acc-modal-title">
                {selectedDay.dateStr}
                <span className="acc-modal-sub">
                  {new Date(selectedDay.dateStr + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                </span>
              </h3>
              <span className="acc-modal-badge" style={{ background: CELL_STATUS[selectedDay.status].bg, color: CELL_STATUS[selectedDay.status].text }}>
                {CELL_STATUS[selectedDay.status].icon} {CELL_STATUS[selectedDay.status].label}
              </span>
              {selectedDay.rec && selectedDay.rec.id ? (
                <div className="acc-modal-meta">
                  <div><span>Punch In</span><b>{selectedDay.rec.punch_in_time ? formatAttendanceTime(selectedDay.rec.punch_in_time) : 'Not recorded'}</b></div>
                  <div><span>Punch Out</span><b>{selectedDay.rec.punch_out_time ? formatAttendanceTime(selectedDay.rec.punch_out_time) : 'Not recorded'}</b></div>
                  <div><span>Working Hours</span><b>{calcWorkingHours(selectedDay.rec) || '—'}</b></div>
                  {selectedDay.status === 'late' && selectedDay.rec.late_minutes ? (
                    <div><span>Late By</span><b>{selectedDay.rec.late_minutes} min</b></div>
                  ) : null}
                  <div className="acc-modal-selfies">
                    {selectedDay.rec.punch_in_selfie_url ? (
                      <img
                        src={selectedDay.rec.punch_in_selfie_url}
                        alt="Punch-in selfie"
                        title="Punch-in selfie"
                        onClick={() => setPreviewImg(selectedDay.rec.punch_in_selfie_url)}
                        className="acc-modal-selfie"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : null}
                    {selectedDay.rec.punch_out_selfie_url && selectedDay.rec.punch_out_selfie_url !== selectedDay.rec.punch_in_selfie_url ? (
                      <img
                        src={selectedDay.rec.punch_out_selfie_url}
                        alt="Punch-out selfie"
                        title="Punch-out selfie"
                        onClick={() => setPreviewImg(selectedDay.rec.punch_out_selfie_url)}
                        className="acc-modal-selfie"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="acc-modal-empty">
                  {selectedDay.status === 'off'
                    ? 'Weekly off — no work scheduled for this day.'
                    : selectedDay.status === 'holiday'
                      ? 'Declared holiday — paid day, no deduction.'
                      : 'No punch-in record found for this day.'}
                </p>
              )}
            </div>
          </div>
        )}

        {previewModal}

        <style>{`
.acc-head { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; flex-wrap: wrap; }
.acc-back { padding: 6px 14px; border-radius: 8px; border: 1px solid #e5e7eb; background: #fff; cursor: pointer; font-size: 13px; font-weight: 500; color: #374151; }
.acc-back:hover { background: #f9fafb; }
.acc-head-main h2 { margin: 0; font-size: 17px; font-weight: 600; }
.acc-head-main p { margin: 2px 0 0; font-size: 12px; color: #6b7280; }
.acc-cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 18px; }
.acc-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; }
.acc-card-label { font-size: 11px; color: #6b7280; font-weight: 500; letter-spacing: .4px; }
.acc-card-val { font-size: 24px; font-weight: 700; margin-top: 4px; }
.acc-cal-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; }
.acc-cal-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
.acc-cal-head h3 { margin: 0; font-size: 15px; font-weight: 600; }
.acc-cal-head p { margin: 2px 0 0; font-size: 12px; color: #6b7280; }
.acc-nav { display: flex; align-items: center; gap: 8px; }
.acc-nav-btn { width: 30px; height: 30px; border-radius: 8px; border: 1px solid #e5e7eb; background: #fff; cursor: pointer; font-size: 16px; line-height: 1; color: #374151; }
.acc-nav-btn:hover:not(:disabled) { background: #f9fafb; }
.acc-nav-btn:disabled { opacity: .4; cursor: default; }
.acc-month-label { font-size: 14px; font-weight: 600; min-width: 140px; text-align: center; color: #111827; }
.acc-today-btn { padding: 6px 14px; border-radius: 8px; border: 1px solid #0f766e; background: #fff; color: #0f766e; cursor: pointer; font-size: 13px; font-weight: 500; }
.acc-today-btn:hover { background: #f0fdfa; }
.acc-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
.acc-grid-blank { visibility: hidden; }
.acc-cal-dayhead { text-align: center; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .6px; padding: 4px 0; }
.acc-cal-day { border: 1px solid #e5e7eb; border-radius: 10px; min-height: 96px; padding: 8px; cursor: pointer; display: flex; flex-direction: column; gap: 5px; transition: box-shadow .15s, border-color .15s; background: #fff; }
.acc-cal-day:hover { border-color: #10b981; box-shadow: 0 2px 8px rgba(4,120,87,.08); }
.acc-cal-day.acc-today { border-color: #10b981; box-shadow: 0 0 0 1px #10b981; }
.acc-cal-day.acc-selected { border-color: #0f766e; box-shadow: 0 0 0 2px rgba(15,118,110,.35); }
.acc-cal-day.acc-future { background: #f9fafb; cursor: default; opacity: .5; }
.acc-cal-day.acc-future:hover { border-color: #e5e7eb; box-shadow: none; }
.acc-cal-day-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 6px; }
.acc-cal-daynum { font-size: 13px; font-weight: 600; color: #111827; display: flex; align-items: center; gap: 6px; }
.acc-today-tag { font-size: 8px; font-weight: 800; letter-spacing: .5px; background: #10b981; color: #fff; padding: 1px 5px; border-radius: 4px; }
.acc-cal-selfies { display: flex; gap: 3px; }
.acc-sel-thumb { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; cursor: pointer; border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25); }
.acc-cal-badge { align-self: flex-start; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px; letter-spacing: .3px; white-space: nowrap; }
.acc-cal-times { display: flex; flex-direction: column; gap: 1px; font-size: 11px; color: #374151; }
.acc-cal-times span { white-space: nowrap; }
.acc-cal-times-muted { color: #9ca3af; }
.acc-mob-list { display: none; }
.acc-mob-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; border-bottom: 1px solid #f3f4f6; cursor: pointer; background: #fff; }
.acc-mob-date { font-size: 13px; color: #111827; }
.acc-mob-sub { font-size: 12px; color: #6b7280; margin-top: 2px; }
.acc-legend { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; padding-top: 14px; border-top: 1px solid #f3f4f6; }
.acc-legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #374151; }
.acc-legend-item i { font-style: normal; width: 20px; height: 20px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
.acc-state { text-align: center; padding: 48px 20px; color: #6b7280; font-size: 14px; }
.acc-state .acc-today-btn { margin-top: 12px; }
.acc-skeleton { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
.acc-skel-cell { height: 96px; border-radius: 10px; background: linear-gradient(100deg, #f3f4f6 40%, #e5e7eb 50%, #f3f4f6 60%); background-size: 200% 100%; animation: acc-shimmer 1.2s infinite; }
@keyframes acc-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.acc-modal-wrap { position: fixed; inset: 0; background: rgba(15,23,42,.55); display: flex; align-items: center; justify-content: center; z-index: 2100; padding: 20px; }
.acc-modal { background: #fff; border-radius: 14px; max-width: 420px; width: 100%; padding: 24px; position: relative; box-shadow: 0 20px 50px rgba(0,0,0,.25); }
.acc-modal-close { position: absolute; top: 12px; right: 12px; border: none; background: #f3f4f6; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 13px; color: #374151; }
.acc-modal-title { margin: 0 0 4px; font-size: 18px; font-weight: 700; }
.acc-modal-sub { display: block; font-size: 12px; font-weight: 400; color: #6b7280; margin-top: 2px; }
.acc-modal-badge { display: inline-block; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 999px; margin-top: 10px; }
.acc-modal-meta { margin-top: 16px; display: flex; flex-direction: column; gap: 10px; }
.acc-modal-meta > div { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }
.acc-modal-meta span { color: #6b7280; }
.acc-modal-meta b { font-weight: 600; color: #111827; }
.acc-modal-selfies { display: flex; gap: 10px; margin-top: 6px; }
.acc-modal-selfie { width: 72px; height: 72px; border-radius: 10px; object-fit: cover; cursor: pointer; border: 1px solid #e5e7eb; }
.acc-modal-empty { color: #6b7280; font-size: 13px; margin-top: 14px; }
@media (max-width: 700px) {
  .acc-cards { grid-template-columns: repeat(2, 1fr); }
  .acc-grid { display: none; }
  .acc-mob-list { display: block; }
  .acc-nav { width: 100%; justify-content: space-between; }
}
`}</style>
      </div>
    );
  }

  return (
    <div style={{ background: '#F3F7FB', minHeight: '100vh', padding: '28px 36px', fontFamily: 'Inter, "Segoe UI", Roboto, Arial, sans-serif' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#102544' }}>Today's Attendance</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'Punched In', value: punchedIn, color: '#087F8C', bg: '#ECFEFF', border: '#CFFAFE' },
              { label: 'No Punch', value: noPunch, color: '#C62835', bg: '#FEF2F2', border: '#FECACA' },
              { label: 'Total', value: filtered.length, color: '#334155', bg: '#F1F5F9', border: '#E2E8F0' },
            ].map(t => (
              <div key={t.label} style={{ minWidth: 92, padding: '8px 14px', borderRadius: 10, background: t.bg, border: `1px solid ${t.border}`, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: t.color, lineHeight: 1.1 }}>{t.value}</div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2, fontWeight: 600 }}>{t.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 360 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"
              style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search name or department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '0 12px 0 34px', height: 38, borderRadius: 8, border: '1px solid #DCE6F1', fontSize: 13, background: 'white', outline: 'none', fontFamily: 'inherit' }}
            />
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setFiltersOpen(v => !v)}
              title={filtersOpen ? 'Hide filters' : 'Show filters'}
              aria-label="Filters"
              aria-expanded={filtersOpen}
              style={{
                position: 'relative', width: 40, height: 40, borderRadius: 6, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${filtersOpen || activeFilterCount ? '#087F8C' : '#DCE6F1'}`,
                background: filtersOpen || activeFilterCount ? '#087F8C' : 'white',
                color: filtersOpen || activeFilterCount ? '#fff' : '#475569',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="10" y1="18" x2="14" y2="18" />
              </svg>
              {activeFilterCount > 0 && (
                <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 15, height: 15, padding: '0 3px', borderRadius: 999, background: '#dc2626', color: '#fff', fontSize: 9, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  {activeFilterCount}
                </span>
              )}
            </button>
            {filtersOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setFiltersOpen(false)} />
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 50, width: 320, maxWidth: '92vw', background: '#fff', border: '1px solid #DCE6F1', borderRadius: 12, boxShadow: '0 16px 40px rgba(15,23,42,.16)', padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <strong style={{ fontSize: 13, color: '#102544' }}>Filters</strong>
                    <button
                      type="button"
                      onClick={() => { setStatusFilter('active'); setAttendanceFilter('all'); setFiltersOpen(false); }}
                      style={{ border: 'none', background: 'none', color: '#087F8C', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                    >Reset</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 130 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748B' }}>Status</span>
                      <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 9px', borderRadius: 8, border: '1px solid #DCE6F1', fontSize: 12.5, background: 'white', fontFamily: 'inherit' }}>
                        <option value="active">Active</option>
                        <option value="absconded">Absconded</option>
                      </select>
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 140 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748B' }}>Attendance</span>
                      <select value={attendanceFilter} onChange={e => setAttendanceFilter(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 9px', borderRadius: 8, border: '1px solid #DCE6F1', fontSize: 12.5, background: 'white', fontFamily: 'inherit' }}>
                        <option value="all">All</option>
                        <option value="present">Present</option>
                        <option value="halfday">Half Day</option>
                        <option value="absent">Absent</option>
                      </select>
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setExportMenuOpen(v => !v)}
              title="More actions"
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={exportMenuOpen}
              style={{ width: 40, height: 40, borderRadius: 6, border: '1px solid #DCE6F1', background: 'white', color: '#102544', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, lineHeight: 1 }}
            >
              ⋮
            </button>
            {exportMenuOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setExportMenuOpen(false)} />
                <div role="menu" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 50, width: 220, background: '#fff', border: '1px solid #DCE6F1', borderRadius: 12, boxShadow: '0 16px 40px rgba(15,23,42,.16)', padding: 5 }}>
                  <button
                    role="menuitem"
                    onClick={() => { setExportMenuOpen(false); setExportOpen(true); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '9px 10px', border: 'none', borderRadius: 8, background: 'transparent', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, textAlign: 'left', cursor: 'pointer', color: '#087F8C' }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Export Sheet
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setExportMenuOpen(false); load(); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '9px 10px', border: 'none', borderRadius: 8, background: 'transparent', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, textAlign: 'left', cursor: 'pointer', color: '#475569' }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                    Refresh
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

      <div style={{ background: '#fff', border: '1px solid #DCE6F1', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(16,37,68,.05)' }}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No workers found</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#fff' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                <th style={{ padding: '10px 22px', fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid #EEF2F7' }}>Name</th>
                <th style={{ padding: '10px 22px', fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid #EEF2F7' }}>Yesterday Punch Out</th>
                <th style={{ padding: '10px 22px', fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid #EEF2F7' }}>Today Punch In</th>
                <th style={{ padding: '10px 22px', fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid #EEF2F7' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w) => {
                const r = w.record;
                const isPending = r?.selfie_status === 'pending';
                const hasSelfieIn = !!r?.punch_in_selfie_url && !brokenSelfies.has(r.punch_in_selfie_url);
                const hasSelfieOut = SHOW_NETWORK_DETAIL && !!r?.punch_out_selfie_url && !brokenSelfies.has(r.punch_out_selfie_url);
                return (
                  <tr
                    key={w.id}
                    onClick={() => setSelectedWorker(w)}
                    style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer', transition: 'background .12s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                    title="Click to view detailed attendance"
                  >
                    <td style={{ padding: '11px 22px' }}>
                      <div style={{ fontWeight: 600, color: '#102544' }}>{w.name || 'Unknown'}</div>
                    </td>
                    <td style={{ padding: '11px 22px', whiteSpace: 'nowrap' }}>
                      {w.yesterdayRecord?.punch_out_time ? (
                        <span>{fmt(w.yesterdayRecord.punch_out_time)}</span>
                      ) : (
                        <span style={{ color: '#CBD5E1', fontSize: 13 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '11px 22px', whiteSpace: 'nowrap' }}>
                      {r ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {hasSelfieIn ? (
                            <img
                              src={r.punch_in_selfie_url}
                              alt="selfie"
                              style={{ width: 32, height: 32, borderRadius: 16, objectFit: 'cover', cursor: 'pointer', border: isPending ? '2px solid #f59e0b' : '2px solid #10b981' }}
                              onClick={(e) => { e.stopPropagation(); setPreviewImg(r.punch_in_selfie_url); }}
                              onError={() => markSelfieBroken(r.punch_in_selfie_url)}
                            />
                          ) : r.punch_in_time ? (
                            <span style={{ color: '#10b981', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="7" height="7" />
                                <rect x="14" y="3" width="7" height="7" />
                                <rect x="3" y="14" width="7" height="7" />
                                <path d="M14 14h3v3h-3zM17 17h4M14 21h7M21 14v3" />
                              </svg>
                              QR
                            </span>
                          ) : null}
                          <span>{fmt(r.punch_in_time)}</span>
                        </div>
                      ) : (
                        <span style={{ color: '#d1d5db', fontSize: 13 }}>No punch</span>
                      )}
                    </td>
                    <td style={{ padding: '11px 22px', whiteSpace: 'nowrap' }}>
                      {!r ? (
                        <span style={{ padding: '3px 10px', borderRadius: 999, background: '#fee2e2', color: '#991b1b', fontSize: 11.5, fontWeight: 700 }}>Absent</span>
                      ) : r.selfie_status === 'pending' ? (
                        <span style={{ padding: '3px 10px', borderRadius: 999, background: '#fef3c7', color: '#92400e', fontSize: 11.5, fontWeight: 700 }}>⏳ Pending</span>
                      ) : r.selfie_status === 'verified' ? (
                        <span style={{ padding: '3px 10px', borderRadius: 999, background: '#d1fae5', color: '#065f46', fontSize: 11.5, fontWeight: 700 }}>✓ Verified</span>
                      ) : r.status === 'late' ? (
                        <span style={{ padding: '3px 10px', borderRadius: 999, background: '#fef3c7', color: '#92400e', fontSize: 11.5, fontWeight: 700 }}>Late {r.late_minutes}m</span>
                      ) : (
                        <span style={{ padding: '3px 10px', borderRadius: 999, background: '#d1fae5', color: '#065f46', fontSize: 11.5, fontWeight: 700 }}>{r.status || 'present'}</span>
                      )}
                    </td>
                    {/* <td style={{ padding: '10px 14px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      {isPending ? (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button
                            onClick={() => handleVerify(r.id)}
                            style={{ padding: '4px 10px', borderRadius: 4, border: 'none', background: '#10b981', color: 'white', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
                          >
                            ✓ Verify
                          </button>
                          <button
                            onClick={() => handleReject(r.id)}
                            style={{ padding: '4px 10px', borderRadius: 4, border: 'none', background: '#ef4444', color: 'white', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
                          >
                            ✕ Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: 12 }}>View →</span>
                      )}
                    </td> */}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>
      </div>

      {exportOpen && (
        <div onClick={() => setExportOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, boxShadow: '0 24px 60px rgba(15,23,42,.28)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #EEF2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#102544' }}>Export attendance sheet</div>
                <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>Choose the range to include in the Excel file.</div>
              </div>
              <button type="button" onClick={() => setExportOpen(false)} aria-label="Close"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B', width: 28, height: 28, borderRadius: 8, fontSize: 16 }}>✕</button>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                {[{ k: 'month', l: 'Full month' }, { k: 'day', l: 'One day' }, { k: 'week', l: 'One week' }, { k: 'custom', l: 'Custom' }].map(o => (
                  <button key={o.k} type="button" onClick={() => setExportMode(o.k)}
                    style={{
                      padding: '8px 6px', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                      border: `1px solid ${exportMode === o.k ? '#087F8C' : '#DCE6F1'}`,
                      background: exportMode === o.k ? '#087F8C' : '#fff',
                      color: exportMode === o.k ? '#fff' : '#475569',
                    }}>{o.l}</button>
                ))}
              </div>

              {exportMode === 'month' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748B' }}>Month</span>
                  <input type="month" value={exportMonth} onChange={e => setExportMonth(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 8, border: '1px solid #DCE6F1', fontSize: 13, fontFamily: 'inherit' }} />
                </label>
              )}
              {exportMode === 'day' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748B' }}>Day</span>
                  <input type="date" value={exportDay} onChange={e => setExportDay(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 8, border: '1px solid #DCE6F1', fontSize: 13, fontFamily: 'inherit' }} />
                </label>
              )}
              {exportMode === 'week' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748B' }}>Week starting (Monday)</span>
                  <input type="date" value={exportWeekStart} onChange={e => setExportWeekStart(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 8, border: '1px solid #DCE6F1', fontSize: 13, fontFamily: 'inherit' }} />
                  <span style={{ fontSize: 11, color: '#64748B' }}>Includes the 7 days from the selected date.</span>
                </label>
              )}
              {exportMode === 'custom' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748B' }}>From</span>
                    <input type="date" value={exportCustomFrom} onChange={e => setExportCustomFrom(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 8, border: '1px solid #DCE6F1', fontSize: 13, fontFamily: 'inherit' }} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748B' }}>To</span>
                    <input type="date" value={exportCustomTo} onChange={e => setExportCustomTo(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 8, border: '1px solid #DCE6F1', fontSize: 13, fontFamily: 'inherit' }} />
                  </label>
                </div>
              )}
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1px solid #EEF2F7', background: '#F8FAFC', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-sm" onClick={() => setExportOpen(false)}>Cancel</button>
              <button className="btn btn-sm btn-primary" onClick={handleExportSheet} style={{ background: '#087F8C', borderColor: '#087F8C' }}>Export</button>
            </div>
          </div>
        </div>
      )}

      {previewImg && (
        <div
          onClick={() => setPreviewImg(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, cursor: 'pointer',
          }}
        >
          <img
            src={previewImg}
            alt="selfie preview"
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain' }}
          />
          <div style={{ position: 'absolute', top: 16, right: 20, color: 'white', fontSize: 28, fontWeight: 300 }}>✕</div>
        </div>
      )}
    </div>
  );
}
