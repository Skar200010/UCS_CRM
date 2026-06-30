import { useState, useEffect } from 'react';
import { useHR, avatarColor, avatarTint, initials, DEPTS } from '../store';
import { ArrowLeft, ArrowRight, Pencil, Trash } from '../icons';
import { Dropdown, DatePicker } from './ui';

const API_BASE = import.meta.env.VITE_API_URL || 'https://attendance-roan-zeta.vercel.app/api';
const IST_OFFSET = 5.5 * 60 * 60 * 1000;

function fmtTime(iso) {
  if (!iso) return '\u2014';
  const d = new Date(new Date(iso).getTime() + IST_OFFSET);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function extractTime(iso) {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + IST_OFFSET);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function reconstructIso(originalIso, newTime) {
  if (!newTime) return null;
  if (!originalIso) return originalIso;
  const [h, m] = newTime.split(':').map(Number);
  const ist = new Date(new Date(originalIso).getTime() + IST_OFFSET);
  ist.setUTCHours(h, m, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET).toISOString();
}

function Badge({ status }) {
  const map = {
    present: { cls: 'badge-present', lbl: 'Present' },
    late: { cls: 'badge-late', lbl: 'Late' },
    absent: { cls: 'badge-absent', lbl: 'Absent' },
    leave: { cls: 'badge-leave', lbl: 'Leave' },
    'half-day': { cls: 'badge-half-day', lbl: 'Half Day' },
  };
  const { cls, lbl } = map[status] || { cls: 'badge-pending', lbl: status || '\u2014' };
  return <span className={`badge ${cls}`}>{lbl}</span>;
}

export default function EmployeeDetail({ worker, onBack, onOffboard }) {
  const { fetchWorkerById, fetchAttendance, fetchLeaves, fetchWorkerLetters, updateWorker, fetchWorkerSalaries, addWorkerSalary, updateWorkerSalary, fetchWorkerTargetForMonth, setAchievement, fetchWorkerAchievements, fetchIncentiveSummary, fetchWorkerAllocations, fetchWorkerSalaryAllocations, setWorkerAllocations, DEPTS, fetchNGOs, fetchHolidays, fetchWorkerLoans } = useHR();
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [ngos, setNgos] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [data, setData] = useState(null);
  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [imgErr, setImgErr] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({});
  const [tab, setTab] = useState('overview');
  const [attStatus, setAttStatus] = useState('');
  const [salaries, setSalaries] = useState([]);
  const [salaryForm, setSalaryForm] = useState({ salary: '' });
  const [salarySubmitting, setSalarySubmitting] = useState(false);
  const [salaryNgoCount, setSalaryNgoCount] = useState(1);
  const [salaryNgo1, setSalaryNgo1] = useState('');
  const [salaryNgo2, setSalaryNgo2] = useState('');
  const [extraEditing, setExtraEditing] = useState(false);
  const [extraVal, setExtraVal] = useState('');
  const [extraSaving, setExtraSaving] = useState(false);
  const [viewingMonthKey, setViewingMonthKey] = useState(null);
  const [currentTarget, setCurrentTarget] = useState(null);
  const [workerAchs, setWorkerAchs] = useState([]);
  const [incSummary, setIncSummary] = useState(null);
  const [achForm, setAchForm] = useState({});
  const [achSaving, setAchSaving] = useState({});
  const [allocations, setAllocations] = useState([]);
  const [sundayBonus, setSundayBonus] = useState(null);
  const [workerLoans, setWorkerLoans] = useState([]);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editPunchIn, setEditPunchIn] = useState('');
  const [editPunchOut, setEditPunchOut] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    let cancelled = false;
    Promise.all([
      fetchWorkerById(worker.id).catch(() => null),
      fetchWorkerLetters(worker.id),
      fetchWorkerSalaries(worker.id).catch(() => []),
      fetchWorkerAllocations(worker.id).catch(() => []),
      fetchWorkerLoans(worker.id).catch(() => []),
    ]).then(([d, l, s, a, wl]) => {
      if (cancelled) return;
      setData(d);
      setLetters(l || []);
      setSalaries(s || []);
      setAllocations(a || []);
      setWorkerLoans(wl || []);
      setLoading(false);

      if (d?.department === 'FRO') {
        const now = new Date();
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        fetchWorkerTargetForMonth(worker.id, month)
          .then(t => setCurrentTarget(t?.target_amount || null))
          .catch(() => {});
        fetchWorkerAchievements(worker.id, month)
          .then(a => setWorkerAchs(Array.isArray(a) ? a : []))
          .catch(() => {});
        fetchIncentiveSummary(worker.id, month)
          .then(s => setIncSummary(s?.hasIncentive ? s : null))
          .catch(() => {});
      }
    });
    fetchAttendance().then(setAttendance).catch(() => {});
    fetchLeaves().then(setLeaves).catch(() => {});
    fetchNGOs().then(setNgos).catch(() => {});
    fetchHolidays().then(setHolidays).catch(() => {});
    return () => { cancelled = true; };
  }, [worker.id]);

  // Fetch Sunday bonus + incentive data whenever the viewing month changes
  useEffect(() => {
    if (data?.department === 'FRO') {
      const monthKey = viewingMonthKey || defaultMonthKey;
      const month = monthKey + '-01';
      fetchWorkerSalaryAllocations(worker.id, month)
        .then(r => setSundayBonus(r?.sundayBonus || null))
        .catch(() => {});
    }
  }, [viewingMonthKey, worker.id, data?.department]);

  const startEdit = () => {
    setForm({
      name: data.name || '',
      email: data.email || '',
      gender: data.gender || '',
      dob: data.dob || '',
      phone: data.phone || '',
      alternate_phone: data.alternate_phone || '',
      department: data.department || '',
      ngo_id: data.ngo_id || '',
      shift: data.shift || '',
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      pincode: data.pincode || '',
      permanent_address: data.permanent_address || '',
      father_husband_name: data.father_husband_name || '',
      marital_status: data.marital_status || '',
      pan_number: data.pan_number || '',
      aadhar_number: data.aadhar_number || '',
      created_at: data.created_at ? data.created_at.slice(0, 10) : '',
      is_active: data.is_active !== false,
      emergency_contact_name: data.emergency_contact_name || '',
      emergency_contact_relation: data.emergency_contact_relation || '',
      emergency_contact_phone: data.emergency_contact_phone || '',
      account_holder_name: data.account_holder_name || '',
      bank_name: data.bank_name || '',
      ifsc_code: data.ifsc_code || '',
      account_number: data.account_number || '',
    });
    setEditing(true);
    setErr('');
  };

  const cancelEdit = () => { setEditing(false); setErr(''); };

  const save = async () => {
    setSaving(true); setErr('');
    try {
      const payload = { ...form };
      if (!payload.dob) payload.dob = null;
      if (!payload.created_at) delete payload.created_at;
      else payload.created_at = payload.created_at + 'T00:00:00.000Z';
      await updateWorker(worker.id, payload);
      const fresh = await fetchWorkerById(worker.id);
      setData(fresh); setEditing(false);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = () => {
    onBack();
    if (onOffboard) onOffboard(worker);
  };

  const setField = (key) => (e) => setForm(f => ({ ...f, [key]: e?.target?.value ?? e }));
  const setBool = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.checked }));

  if (loading) return <SkeletonDetail onBack={onBack} />;
  if (!data) return <div className="empty">Employee not found.</div>;

  const color = avatarColor(data.name);

  const empAttendance = attendance.filter(a => a.worker_id === worker.id);
  const filteredAttendance = attStatus ? empAttendance.filter(a => a.status === attStatus) : empAttendance;

  const empLeaves = leaves.filter(l => l.worker_id === worker.id);

  const ngoName = ngos.find(n => n.id === data.ngo_id)?.name || 'NA';

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'salary', label: 'Salary' },
    { key: 'leaves', label: 'Leaves' },
    { key: 'loans', label: 'Loans & Advances' },
  ];

  const now = new Date();
  const defaultMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const sortedSalaries = [...salaries].sort((a, b) => b.from_month.localeCompare(a.from_month));

  const effectiveMonthKey = viewingMonthKey || defaultMonthKey;
  const [yr, mo] = effectiveMonthKey.split('-').map(Number);
  const monthKey = effectiveMonthKey;
  const holidayDates = new Set(
    holidays.filter(h => h.date?.startsWith(monthKey)).map(h => h.date)
  );
  const daysInMonth = new Date(yr, mo, 0).getDate();

  // Salary covering the viewing month
  const activeSalary = sortedSalaries.find(s =>
    s.from_month.slice(0, 7) <= effectiveMonthKey &&
    (!s.to_month || s.to_month.slice(0, 7) >= effectiveMonthKey)
  ) || sortedSalaries[0] || null;
  const salaryPaid = activeSalary?.paid_at;

  const monthAttendance = empAttendance.filter(a => a.date && a.date.startsWith(monthKey));
  const noAttendanceData = monthAttendance.length === 0;

  const joinDate = new Date(data.created_at);
  const joinMonth = `${joinDate.getFullYear()}-${String(joinDate.getMonth() + 1).padStart(2, '0')}`;
  const joinedThisMonth = joinMonth === monthKey;
  const joinDayNum = joinDate.getDate();
  const joinCutoff = data.created_at.slice(0, 10);

  // Compute absent dates — days with no attendance or explicitly absent
  const viewingToday = (yr === now.getFullYear() && mo === (now.getMonth() + 1))
    ? now.getDate() : daysInMonth + 1;
  const absentDates = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${yr}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (joinedThisMonth && dateStr < joinCutoff) continue;
    const dt = new Date(yr, mo - 1, d);
    if (dt.getDay() === 0) continue;
    if (holidayDates.has(dateStr)) continue;
    if (d > viewingToday) continue;
    const att = monthAttendance.find(a => a.date === dateStr);
    if (!att || att.status === 'absent') {
      absentDates.push(dateStr);
    }
  }
  const absentDatesAfterJoin = absentDates.filter(d => !joinedThisMonth || d >= joinCutoff);

  // New-joiner check: ≤ 3 months employed
  const nowDate = new Date();
  const monthsEmp = (nowDate.getFullYear() - joinDate.getFullYear()) * 12 + (nowDate.getMonth() - joinDate.getMonth());
  const monthsEmployed = (nowDate.getDate() >= joinDate.getDate()) ? monthsEmp + 1 : monthsEmp;

  const deducted = new Set();
  const deductionNotes = [];
  for (const d of absentDates) {
    if (joinedThisMonth && d < joinCutoff) continue;
    const dt = new Date(d);
    const day = dt.getDay();
    const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day];
    const label = `${dayName} ${dt.getDate()} ${dt.toLocaleString('en-GB',{month:'short'})}`;
    if (day === 6) {
      deducted.add(d);
      const sun = new Date(dt);
      sun.setDate(sun.getDate() + 1);
      const sunDate = sun.toISOString().slice(0, 10);
      if (!joinedThisMonth || sunDate >= joinCutoff) deducted.add(sunDate);
      deductionNotes.push({ day: d, text: `${label} → absent → deducted: ${label} + Sun ${sun.getDate()} ${sun.toLocaleString('en-GB',{month:'short'})}` });
    } else if (day === 1) {
      deducted.add(d);
      const sun = new Date(dt);
      sun.setDate(sun.getDate() - 1);
      const sunDate = sun.toISOString().slice(0, 10);
      if (!joinedThisMonth || sunDate >= joinCutoff) deducted.add(sunDate);
      deductionNotes.push({ day: d, text: `${label} → absent → deducted: Sun ${sun.getDate()} ${sun.toLocaleString('en-GB',{month:'short'})} + ${label}` });
    } else {
      deducted.add(d);
      deductionNotes.push({ day: d, text: `${label} → absent → deducted: ${label}` });
    }
  }

  const availableDays = joinedThisMonth ? (daysInMonth - joinDayNum + 1) : daysInMonth;

  const monSatAbsences = absentDates.filter(d => {
    const dt = new Date(d);
    return dt.getDay() !== 0 && d >= joinCutoff;
  }).length;

  const extraSundays = [];
  if (monSatAbsences >= 6) {
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(yr, mo - 1, d);
      if (dt.getDay() === 0) {
        const dateStr = `${yr}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (!joinedThisMonth || dateStr >= joinCutoff) {
          if (!deducted.has(dateStr)) {
            extraSundays.push(dateStr);
          }
          deducted.add(dateStr);
        }
      }
    }
  }

  const monthDays = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const dateStr = `${yr}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dt = new Date(yr, mo - 1, d);
    const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getDay()];
    const att = monthAttendance.find(a => a.date === dateStr);
    let status = att?.status || null;
    if (!status && d <= viewingToday && dt.getDay() !== 0 && !holidayDates.has(dateStr) && !(joinedThisMonth && dateStr < joinCutoff)) {
      status = 'absent';
    }
    return { date: dateStr, day: d, dayName, att, status };
  });

  const daysWorked = monthAttendance.filter(a =>
    (a.status === 'present' || a.status === 'late') && (!joinedThisMonth || a.date >= joinCutoff)
  ).length;
  const presentDays = daysWorked;
  const halfDayCount = monthAttendance.filter(a =>
    a.status === 'half-day' && (!joinedThisMonth || a.date >= joinCutoff)
  ).length;
  const sundayCount = Array.from({ length: daysInMonth }, (_, i) => {
    if (joinedThisMonth && i + 1 < joinDayNum) return 0;
    return new Date(yr, mo - 1, i + 1).getDay() === 0 ? 1 : 0;
  }).reduce((a, b) => a + b, 0);
  const sundayDeductions = [...deducted].filter(d => new Date(d).getDay() === 0).length;
  let paidDays = noAttendanceData ? 0 : presentDays + (halfDayCount * 0.5) + Math.max(0, sundayCount - sundayDeductions);
  if (paidDays < 0) paidDays = 0;
  const JOINING_DEDUCTION = 1.5;
  const joiningDeduction = (joinedThisMonth && monthsEmployed <= 3) ? JOINING_DEDUCTION : 0;
  const perDay = activeSalary ? parseFloat(activeSalary.salary) / daysInMonth : 0;

  // Late-minutes-based deductions
  const totalLateMinutes = monthAttendance
    .filter(a => !joinedThisMonth || a.date >= joinCutoff)
    .reduce((sum, a) => sum + (a.late_minutes || 0), 0);

  let lateDeductionDays = 0;
  let totalDue;

  if (totalLateMinutes > 480) {
    lateDeductionDays = Math.round((totalLateMinutes / 480) * 2) / 2;
  } else if (totalLateMinutes > 240) {
    lateDeductionDays = 1;
  } else if (totalLateMinutes > 180) {
    lateDeductionDays = 0.5;
  }
  totalDue = perDay * Math.max(0, paidDays - lateDeductionDays - joiningDeduction);

  // Loan / Advance deductions
  const activeLoans = workerLoans.filter(l =>
    l.status === 'active' || l.status === 'approved'
  );
  const loanDeductionTotal = activeLoans.reduce((sum, l) => sum + parseFloat(l.monthly_deduction || 0), 0);

  // Pay date: 10th of next month + absent days on 1st–10th (excl Sundays)
  const absent1to10 = monthAttendance.filter(a =>
    a.status === 'absent' && a.date.slice(8, 10) <= '10' && new Date(a.date).getDay() !== 0 && !holidayDates.has(a.date)
  );
  const extendDays = absent1to10.length;
  const payDate = new Date(yr, mo - 1, 10 + extendDays);
  if (payDate.getDay() === 0) payDate.setDate(payDate.getDate() + 1);
  const payDateStr = payDate.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });

  // Previous month data for compact summary
  const prevMonthDate = new Date(yr, mo - 2, 1);
  const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const prevSalaryRec = sortedSalaries.find(s =>
    s.from_month.slice(0, 7) <= prevMonthKey &&
    (!s.to_month || s.to_month.slice(0, 7) >= prevMonthKey)
  );
  let prevTotalDue = null;
  if (prevSalaryRec) {
    const pYr = parseInt(prevMonthKey.split('-')[0]);
    const pMo = parseInt(prevMonthKey.split('-')[1]);
    const pDays = new Date(pYr, pMo, 0).getDate();
    const pHolidays = new Set(holidays.filter(h => h.date?.startsWith(prevMonthKey)).map(h => h.date));
    const pAtt = empAttendance.filter(a => a.date?.startsWith(prevMonthKey));
    const pJoinMonth = `${new Date(data.created_at).getFullYear()}-${String(new Date(data.created_at).getMonth() + 1).padStart(2, '0')}`;
    const pJoined = pJoinMonth === prevMonthKey;
    const pJoinCutoff = data.created_at.slice(0, 10);
    const pAbsent = pAtt.filter(a => a.status === 'absent' && !pHolidays.has(a.date)).map(a => a.date);
    const pAvailable = pJoined ? (pDays - new Date(data.created_at).getDate() + 1) : pDays;
    const pPerDay = parseFloat(prevSalaryRec.salary) / pDays;

    const pDeducted = new Set();
    for (const d of pAbsent) {
      if (pJoined && d < pJoinCutoff) continue;
      const dt = new Date(d);
      const pDay = dt.getDay();
      if (pDay === 6) {
        pDeducted.add(d);
        const sun = new Date(dt); sun.setDate(sun.getDate() + 1);
        const sd = sun.toISOString().slice(0, 10);
        if (!pJoined || sd >= pJoinCutoff) pDeducted.add(sd);
      } else if (pDay === 1) {
        pDeducted.add(d);
        const sun = new Date(dt); sun.setDate(sun.getDate() - 1);
        const sd = sun.toISOString().slice(0, 10);
        if (!pJoined || sd >= pJoinCutoff) pDeducted.add(sd);
      } else {
        pDeducted.add(d);
      }
    }
    const pMonSat = pAbsent.filter(d => new Date(d).getDay() !== 0 && d >= pJoinCutoff).length;
    if (pMonSat >= 6) {
      for (let d = 1; d <= pDays; d++) {
        const dt = new Date(pYr, pMo - 1, d);
        if (dt.getDay() === 0) {
          const ds = `${pYr}-${String(pMo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          if (!pJoined || ds >= pJoinCutoff) pDeducted.add(ds);
        }
      }
    }
    const pLateMins = pAtt.filter(a => !pJoined || a.date >= pJoinCutoff).reduce((s, a) => s + (a.late_minutes || 0), 0);
    let pLateDays = 0;
    if (pLateMins > 480) pLateDays = Math.round((pLateMins / 480) * 2) / 2;
    else if (pLateMins > 240) pLateDays = 1;
    else if (pLateMins > 180) pLateDays = 0.5;
    const pPaid = Math.max(0, pAvailable - pDeducted.size);
    const pJoining = (pJoined && monthsEmployed <= 3) ? 1.5 : 0;
    prevTotalDue = pPerDay * Math.max(0, pPaid - pLateDays - pJoining);
  }

  const fmtMonthYear = (d) => d.toLocaleDateString('en-GB', { month:'long', year:'numeric' });

  const openEdit = (record) => {
    setEditingRecord(record);
    setEditPunchIn(extractTime(record.punch_in_time));
    setEditPunchOut(extractTime(record.punch_out_time));
    setEditStatus(record.status);
  };

  const closeEdit = () => {
    setEditingRecord(null);
  };

  const saveEdit = async () => {
    if (!editingRecord) return;
    setEditLoading(true);
    try {
      const body = {
        punch_in_time: reconstructIso(editingRecord.punch_in_time, editPunchIn),
        punch_out_time: reconstructIso(editingRecord.punch_out_time, editPunchOut),
        status: editStatus,
      };
      const res = await fetch(API_BASE + '/attendance/' + editingRecord.id, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('ucs_token'),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to update' }));
        throw new Error(err.message || 'Update failed');
      }
      fetchAttendance().then(setAttendance).catch(() => {});
      closeEdit();
    } catch (err) {
      alert(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <button className="btn back-btn" onClick={onBack} style={{ marginBottom:0 }}><ArrowLeft width={16}/> Back to Employees</button>
        {!editing ? (
          <div style={{ display:'flex', gap:4 }}>
            <button className="btn btn-icon" onClick={startEdit} title="Edit Employee"><Pencil width={16} /></button>
            <button className="btn btn-icon" onClick={handleDelete} title="Delete Employee" style={{ color:'var(--danger)' }}><Trash width={16} /></button>
          </div>
        ) : (
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-sm" onClick={cancelEdit} disabled={saving}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving\u2026' : 'Save'}</button>
          </div>
        )}
      </div>

      {err && <div className="err-banner">{err}</div>}

      <div className="detail-split">
        <div className="detail-sidebar-wrap">
        <div className="card detail-sidebar">
          <div style={{ textAlign:'center', padding:'24px 0 12px' }}>
            {data.photo_url && !imgErr ? (
              <img src={data.photo_url} alt={data.name}
                style={{ width:80, height:80, borderRadius:20, objectFit:'cover', margin:'0 auto', display:'block' }}
                onError={() => setImgErr(true)}
              />
            ) : (
              <div className="avatar" style={{ background:avatarTint(color), color, width:80, height:80, fontSize:28, borderRadius:20, margin:'0 auto' }}>
                {initials(data.name)}
              </div>
            )}
            {editing ? (
              <input value={form.name} onChange={setField('name')}
                style={{ marginTop:12, fontSize:16, fontWeight:600, textAlign:'center', border:'1px solid var(--line)', borderRadius:'var(--radius-sm)', padding:'6px 10px', width:'100%' }} />
            ) : (
              <h3 style={{ marginTop:12, fontSize:17 }}>{data.name}</h3>
            )}
            <div style={{ color:'var(--ink-soft)', fontSize:12, marginTop:6, display:'flex', gap:6, justifyContent:'center', flexWrap:'wrap' }}>
              {data.department && <span className="side-tag">{data.department}</span>}
              <span className={'side-tag ' + (data.is_active ? 'side-tag-active' : 'side-tag-inactive')}>{data.is_active ? 'Active' : 'Inactive'}</span>
            </div>
          </div>
          <div className="side-fields">
            <SideField label="Email" value={data.email} />
            <SideField label="Phone" value={data.phone || '\u2014'} />
            <SideField label="Gender" value={data.gender || '\u2014'} />
            <SideField label="Date of Birth" value={data.dob || '\u2014'} />
            <SideField label="Joined" value={new Date(data.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})} />
          </div>
          </div>
        </div>

        {/* RIGHT CONTENT */}
        <div className="detail-main">
          <div className="tabs" style={{ marginBottom:16 }}>
            {TABS.map(t => (
              <button key={t.key} className={'tab' + (tab === t.key ? ' active' : '')} onClick={() => setTab(t.key)}>{t.label}</button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="detail-cards-scroll">
              <div className="card" style={{ marginBottom:16 }}>
                <div className="card-head"><h3>Personal Details</h3></div>
                <div className="detail-grid">
                  {editing ? <EditField label="Email" value={form.email} onChange={setField('email')} /> : <Field label="Email" value={data.email} />}
                  <Field label="Login ID" value={data.login_id} />
                  {editing ? (
                    <div className="detail-field">
                      <span className="detail-label">Department</span>
                      <Dropdown value={form.department} onChange={setField('department')}
                        style={{ width:'100%' }} options={DEPTS} />
                    </div>
                  ) : <Field label="Department" value={data.department} />}
                  {editing ? (
                    <div className="detail-field">
                      <span className="detail-label">NGO</span>
                      <Dropdown value={form.ngo_id} onChange={setField('ngo_id')}
                        style={{ width:'100%' }}
                        options={[{value:'',label:'NA'}, ...ngos.map(n => ({value:n.id, label:n.name}))]} />
                    </div>
                  ) : <Field label="NGO" value={ngoName} />}
                  {editing ? <EditField label="Shift" value={form.shift} onChange={setField('shift')} /> : <Field label="Shift" value={data.shift} />}
                  {editing ? <div className="detail-field"><span className="detail-label">Joining Date</span><DatePicker value={form.created_at} onChange={setField('created_at')} /></div> : <Field label="Joining Date" value={data.created_at ? new Date(data.created_at).toLocaleDateString() : '—'} />}
                  {editing ? <EditField label="Gender" value={form.gender} onChange={setField('gender')} /> : <Field label="Gender" value={data.gender} />}
                  {editing ? <div className="detail-field"><span className="detail-label">Date of Birth</span><DatePicker value={form.dob} onChange={setField('dob')} /></div> : <Field label="Date of Birth" value={data.dob} />}
                  {editing ? <EditField label="Phone" value={form.phone} onChange={setField('phone')} /> : <Field label="Phone" value={data.phone} />}
                  {editing ? <EditField label="Alternate Phone" value={form.alternate_phone} onChange={setField('alternate_phone')} /> : <Field label="Alternate Phone" value={data.alternate_phone} />}
                  {editing ? <EditField label="Father/Husband" value={form.father_husband_name} onChange={setField('father_husband_name')} /> : <Field label="Father/Husband" value={data.father_husband_name} />}
                  {editing ? <EditField label="Marital Status" value={form.marital_status} onChange={setField('marital_status')} /> : <Field label="Marital Status" value={data.marital_status} />}
                  {editing ? <EditField label="PAN Number" value={form.pan_number} onChange={setField('pan_number')} /> : <Field label="PAN Number" value={data.pan_number} />}
                  {editing ? <EditField label="Aadhar Number" value={form.aadhar_number} onChange={setField('aadhar_number')} /> : <Field label="Aadhar Number" value={data.aadhar_number} />}
                  {editing ? <EditField label="Address" value={form.address} onChange={setField('address')} /> : <Field label="Address" value={data.address} />}
                  {editing ? <EditField label="Permanent Address" value={form.permanent_address} onChange={setField('permanent_address')} /> : <Field label="Permanent Address" value={data.permanent_address} />}
                  {editing ? <EditField label="City" value={form.city} onChange={setField('city')} /> : <Field label="City" value={data.city} />}
                  {editing ? <EditField label="State" value={form.state} onChange={setField('state')} /> : <Field label="State" value={data.state} />}
                  {editing ? <EditField label="Pincode" value={form.pincode} onChange={setField('pincode')} /> : <Field label="Pincode" value={data.pincode} />}
                  {editing && (
                    <div className="detail-field">
                      <span className="detail-label">Active</span>
                      <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                        <input type="checkbox" checked={form.is_active} onChange={setBool('is_active')} />
                        {form.is_active ? 'Active' : 'Inactive'}
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="card" style={{ marginBottom:16 }}>
                <div className="card-head"><h3>Bank Details</h3></div>
                <div className="detail-grid">
                  {editing ? <EditField label="Account Holder" value={form.account_holder_name} onChange={setField('account_holder_name')} /> : <Field label="Account Holder" value={data.account_holder_name} />}
                  {editing ? <EditField label="Bank Name" value={form.bank_name} onChange={setField('bank_name')} /> : <Field label="Bank Name" value={data.bank_name} />}
                  {editing ? <EditField label="IFSC Code" value={form.ifsc_code} onChange={setField('ifsc_code')} /> : <Field label="IFSC Code" value={data.ifsc_code} />}
                  {editing ? <EditField label="Account Number" value={form.account_number} onChange={setField('account_number')} /> : <Field label="Account Number" value={data.account_number} />}
                </div>
              </div>

              <div className="card" style={{ marginBottom:16 }}>
                <div className="card-head"><h3>Emergency Contact</h3></div>
                <div className="detail-grid">
                  {editing ? <EditField label="Name" value={form.emergency_contact_name} onChange={setField('emergency_contact_name')} /> : <Field label="Name" value={data.emergency_contact_name} />}
                  {editing ? <EditField label="Relation" value={form.emergency_contact_relation} onChange={setField('emergency_contact_relation')} /> : <Field label="Relation" value={data.emergency_contact_relation} />}
                  {editing ? <EditField label="Phone" value={form.emergency_contact_phone} onChange={setField('emergency_contact_phone')} /> : <Field label="Phone" value={data.emergency_contact_phone} />}
                </div>
              </div>

              <Field label="Onboarding" value={data.onboarding_completed ? 'Completed' : 'Pending'} />

              {[data.aadhar_front_url, data.aadhar_back_url, data.pan_card_url, data.bank_proof_url, data.light_bill_url].some(Boolean) && (
                <div className="card" style={{ marginTop:16 }}>
                  <div className="card-head"><h3>Documents</h3></div>
                  <div className="card-pad" style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {data.aadhar_front_url && <DocLink url={data.aadhar_front_url} label="Aadhar (Front)" />}
                    {data.aadhar_back_url && <DocLink url={data.aadhar_back_url} label="Aadhar (Back)" />}
                    {data.pan_card_url && <DocLink url={data.pan_card_url} label="PAN Card" />}
                    {data.bank_proof_url && <DocLink url={data.bank_proof_url} label="Bank Proof" />}
                    {data.light_bill_url && <DocLink url={data.light_bill_url} label="Light Bill" />}
                  </div>
                </div>
              )}

              {letters.length > 0 && (
                <div className="card" style={{ marginTop:16 }}>
                  <div className="card-head"><h3>Generated Letters</h3><span className="sub">{letters.length}</span></div>
                  <div className="card-pad" style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {letters.map(l => (
                      <div key={l.id} className="letter-row">
                        <span style={{ fontWeight:500 }}>{l.template?.title || 'Letter'}</span>
                        <span style={{ color:'var(--ink-soft)', fontSize:12 }}>
                          {new Date(l.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
                        </span>
                        <a className="btn btn-sm" href={API_BASE + '/letters/generated/' + l.id + '/download'}
                          target="_blank" rel="noopener noreferrer"
                          style={{ marginLeft:'auto', textDecoration:'none' }}>
                          Download
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              </div>
          )}

          {tab === 'attendance' && (
            <div>
              {/* Attendance Records */}
              <div className="card" style={{ padding:'20px 22px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <button className="btn btn-icon"
                      onClick={() => {
                        const d = new Date(yr, mo - 2, 1);
                        setViewingMonthKey(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                      }}
                      style={{ padding:4, cursor:'pointer', background:'none', border:'1px solid var(--line)', borderRadius:'var(--radius-sm)' }}>
                      <ArrowLeft width={14} />
                    </button>
                    <h3 style={{ fontSize:16, minWidth:160, textAlign:'center' }}>{fmtMonthYear(new Date(yr, mo - 1))}</h3>
                    <button className="btn btn-icon"
                      onClick={() => {
                        const d = new Date(yr, mo, 1);
                        setViewingMonthKey(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                      }}
                      style={{ padding:4, cursor:'pointer', background:'none', border:'1px solid var(--line)', borderRadius:'var(--radius-sm)' }}>
                      <ArrowRight width={14} />
                    </button>
                  </div>
                  <Dropdown className="filter-select" value={attStatus} onChange={val => setAttStatus(val)}
                     options={[{value:'',label:'All'},{value:'present',label:'Present'},{value:'late',label:'Late'},{value:'absent',label:'Absent'},{value:'leave',label:'Leave'},{value:'half-day',label:'Half Day'}]} />
                </div>

                {(() => {
                  const mLate = monthAttendance.reduce((s, a) => s + (a.late_minutes || 0), 0);
                  const activeIdx = mLate > 480 ? 3 : mLate > 240 ? 2 : mLate > 180 ? 1 : 0;
                  const tiers = [
                    { label:'None', sub:'≤180 min', color:'var(--sage)' },
                    { label:'Half', sub:'181–240 min', color:'var(--gold)' },
                    { label:'1 Day', sub:'241–480 min', color:'#e67e22' },
                    { label:'Proportional', sub:'>480 min', color:'var(--danger)' },
                  ];
                  return (
                    <div style={{ marginBottom:16, padding:'12px 16px', background:'var(--bg)', borderRadius:'var(--radius-sm)' }}>
                      <div style={{ fontWeight:600, fontSize:12, color:'var(--ink)', marginBottom:8 }}>Late Deduction Threshold</div>
                      <div style={{ display:'flex', gap:0 }}>
                        {tiers.map((t, i) => {
                          const active = i === activeIdx;
                          return (
                            <div key={t.label}
                              style={{
                                flex:1, textAlign:'center', padding:'6px 2px', fontSize:10,
                                background: active ? t.color : 'var(--paper)',
                                color: active ? '#fff' : 'var(--ink-soft)',
                                fontWeight: active ? 700 : 400,
                                border: '1px solid ' + (active ? t.color : 'var(--line)'),
                                borderLeft: i > 0 ? 'none' : '1px solid ' + (active ? t.color : 'var(--line)'),
                                borderRight: i < 3 ? 'none' : '1px solid ' + (active ? t.color : 'var(--line)'),
                                position:'relative',
                              }}>
                              {t.label}
                              <div style={{ fontSize:8, opacity:0.8 }}>{t.sub}</div>
                              {active && <div style={{ position:'absolute', bottom:-14, left:'50%', marginLeft:-5, width:0, height:0, borderLeft:'5px solid transparent', borderRight:'5px solid transparent', borderTop:'6px solid ' + t.color }} />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div style={{ display:'flex', gap:24, alignItems:'flex-start' }}>
                  {/* Calendar */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:1, background:'var(--line)', border:'1px solid var(--line)', borderRadius:6, overflow:'hidden', fontSize:11 }}>
                      {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d =>
                        <div key={d} style={{ textAlign:'center', fontWeight:600, color:'var(--ink-soft)', padding:'4px 0', background:'var(--bg)' }}>{d}</div>
                      )}
                      {(() => {
                        const firstDay = new Date(yr, mo - 1, 1).getDay();
                        const cells = [];
                        for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} style={{ background:'#fff' }} />);
                        for (const md of monthDays) {
                          const s = md.status;
                          let bg, lbl;
                          if (s === 'present') { bg = '#d4edda'; lbl = '✓'; }
                          else if (s === 'late') { bg = '#fef3c7'; lbl = '⚠'; }
                          else if (s === 'absent') { bg = '#ffe0e0'; lbl = '✗'; }
                          else if (s === 'leave' || s === 'Leave') { bg = '#f3e8ff'; lbl = '✋'; }
                          else if (s === 'half-day') { bg = '#e8d5f5'; lbl = 'HD'; }
                          else if (md.dayName === 'Sun') { bg = '#f0f0f0'; lbl = '—'; }
                          else { bg = '#fff'; lbl = ''; }
                          cells.push(
                            <div key={md.date} style={{ textAlign:'center', padding:'4px 0', background:bg, fontSize:10 }}>
                              <div style={{ fontWeight:600 }}>{md.day}</div>
                              <div>{lbl}</div>
                            </div>
                          );
                        }
                        return cells;
                      })()}
                    </div>
                    <div style={{ display:'flex', gap:12, marginTop:6, fontSize:10, color:'var(--ink-soft)', flexWrap:'wrap' }}>
                      <span><span style={{ display:'inline-block', width:10, height:10, background:'#d4edda', borderRadius:2, marginRight:3, verticalAlign:'middle' }} />Present</span>
                      <span><span style={{ display:'inline-block', width:10, height:10, background:'#fef3c7', borderRadius:2, marginRight:3, verticalAlign:'middle' }} />Late</span>
                      <span><span style={{ display:'inline-block', width:10, height:10, background:'#ffe0e0', borderRadius:2, marginRight:3, verticalAlign:'middle' }} />Absent</span>
                      <span><span style={{ display:'inline-block', width:10, height:10, background:'#f3e8ff', borderRadius:2, marginRight:3, verticalAlign:'middle' }} />Leave</span>
                      <span><span style={{ display:'inline-block', width:10, height:10, background:'#f0f0f0', borderRadius:2, marginRight:3, verticalAlign:'middle' }} />Sun</span>
                    </div>
                  </div>

                  {/* Chart */}
                  <div style={{ flexShrink:0 }}>
                    {filteredAttendance.length > 0 && <AttendanceChart records={filteredAttendance} />}
                  </div>
                </div>

                {filteredAttendance.length > 0 && (
                  <div style={{ marginTop:16 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                      <h4 style={{ margin:0, fontSize:13, color:'var(--ink-soft)', textTransform:'uppercase', letterSpacing:0.5 }}>
                        Records ({filteredAttendance.length})
                      </h4>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Status</th>
                            <th>Punch In</th>
                            <th>Punch Out</th>
                            <th>Late (min)</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAttendance.map(r => (
                            <tr key={r.id} className={r.status === 'late' ? 'row-late' : r.status === 'absent' ? 'row-absent' : ''}>
                              <td>{r.date}</td>
                              <td><Badge status={r.status} /></td>
                              <td>{fmtTime(r.punch_in_time)}</td>
                              <td>{fmtTime(r.punch_out_time)}</td>
                              <td>{r.late_minutes > 0 ? r.late_minutes : '\u2014'}</td>
                              <td>
                                <button className="btn btn-sm" onClick={() => openEdit(r)} title="Edit Attendance">
                                  <Pencil width={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {filteredAttendance.length === 0 && (
                  <div className="empty" style={{ marginTop:12 }}>No attendance records found.</div>
                )}

                {prevSalaryRec && (
                <div className="card" style={{ marginTop:16, padding:'14px 18px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                    <div>
                      <span style={{ color:'var(--ink-soft)', fontSize:11, textTransform:'uppercase', letterSpacing:0.5 }}>Previous Month</span>
                      <div style={{ fontWeight:600, fontSize:15 }}>{fmtMonthYear(prevMonthDate)}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontWeight:700, fontSize:16 }}>
                        {prevSalaryRec.paid_at
                          ? `₹${parseFloat(prevSalaryRec.salary).toLocaleString('en-IN')}`
                          : `₹${(Math.round(prevTotalDue) + parseFloat(prevSalaryRec.extra_amount || 0)).toLocaleString('en-IN')}`
                        }
                      </div>
                      <div style={{ fontSize:12, color: prevSalaryRec.paid_at ? 'var(--sage)' : 'var(--danger)' }}>
                        {prevSalaryRec.paid_at
                          ? `✓ Paid on ${new Date(prevSalaryRec.paid_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}`
                          : `⏳ Due by ${payDateStr}${extendDays > 0 ? ` (delayed ${extendDays}d)` : ''}`
                        }
                      </div>
                    </div>
                  </div>
                </div>
                )}
              </div>
            </div>
          )}

          {tab === 'salary' && (
            <div>
              {prevSalaryRec && (
              <div className="card" style={{ marginBottom:16, padding:'14px 18px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                  <div>
                    <span style={{ color:'var(--ink-soft)', fontSize:11, textTransform:'uppercase', letterSpacing:0.5 }}>Previous Month</span>
                    <div style={{ fontWeight:600, fontSize:15 }}>{fmtMonthYear(prevMonthDate)}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontWeight:700, fontSize:16 }}>
                      {prevSalaryRec.paid_at
                        ? `₹${parseFloat(prevSalaryRec.salary).toLocaleString('en-IN')}`
                        : `₹${(Math.round(prevTotalDue) + parseFloat(prevSalaryRec.extra_amount || 0)).toLocaleString('en-IN')}`
                      }
                    </div>
                    <div style={{ fontSize:12, color: prevSalaryRec.paid_at ? 'var(--sage)' : 'var(--danger)' }}>
                      {prevSalaryRec.paid_at
                        ? `✓ Paid on ${new Date(prevSalaryRec.paid_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}`
                        : `⏳ Due by ${payDateStr}${extendDays > 0 ? ` (delayed ${extendDays}d)` : ''}`
                      }
                    </div>
                  </div>
                </div>
              </div>
              )}
              {/* Salary Calculator — auto for current month */}
              <div className="card" style={{ marginBottom:16 }}>
                <div className="card-head">
                  <h3>Salary</h3>
                  <Dropdown value={effectiveMonthKey} onChange={val => setViewingMonthKey(val)}
                    style={{ fontSize:13, padding:'4px 8px' }}
                    renderValue={opt => opt?.label || ''}
                    options={[
                      {value: defaultMonthKey, label: `Current Month (${fmtMonthYear(now)})`},
                      ...[...new Set(sortedSalaries.map(s => s.from_month.slice(0, 7)))]
                        .filter(mk => mk !== defaultMonthKey)
                        .map(mk => {
                          const d = new Date(mk + '-01');
                          const s = sortedSalaries.find(x => x.from_month.slice(0, 7) <= mk && (!x.to_month || x.to_month.slice(0, 7) >= mk));
                          return {
                            value: mk,
                            label: `${d.toLocaleDateString('en-GB', { month:'long', year:'numeric' })} ${s?.paid_at ? '(Paid)' : '(Unpaid)'}`
                          };
                        })
                    ]} />
                </div>
                <div className="card-pad">
                  {!activeSalary ? (
                    <div className="empty" style={{ padding:0 }}>No salary record for this month.</div>
                  ) : noAttendanceData ? (
                    <div className="empty" style={{ padding:0 }}>No attendance data for this month yet.</div>
                  ) : (
                    <>
                      {salaryPaid && (
                        <div style={{ textAlign:'center', marginBottom:12, padding:'8px 14px', background:'var(--sage)', color:'#fff', borderRadius:6, fontWeight:600, fontSize:13 }}>
                          ✓ Paid on {new Date(salaryPaid).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
                        </div>
                      )}
                      {/* Visual header: donut + total */}
                      <div className="salary-visual">
                        <svg width="72" height="72" viewBox="0 0 72 72">
                          {(() => {
                            const r = 30, cx = 36, cy = 36, circ = 2 * Math.PI * r;
                            const ded = deducted.size;
                            const tot = availableDays || 1;
                            const paidPct = Math.max(0, tot - ded) / tot;
                            const dedPct = ded / tot;
                            const paidOff = paidPct * circ;
                            const dedOff = dedPct * circ;
                            const emptyPct = Math.max(0, daysInMonth - tot) / daysInMonth;
                            return (
                              <>
                                <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line)" strokeWidth="8" />
                                {ded > 0 && (
                                  <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e67e22" strokeWidth="8"
                                    strokeDasharray={`${dedOff} ${circ - dedOff}`}
                                    strokeDashoffset={0} transform="rotate(-90 36 36)" />
                                )}
                                <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--sage)" strokeWidth="8"
                                  strokeDasharray={`${paidOff} ${circ - paidOff}`}
                                  strokeDashoffset={-dedOff} transform="rotate(-90 36 36)" />
                                <text x={cx} y={cy - 4} textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--ink)">{Math.round(paidPct * 100)}%</text>
                                <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="var(--ink-soft)">paid</text>
                              </>
                            );
                          })()}
                        </svg>
                        <div className="salary-visual-main">
                          <div className="salary-visual-total">₹{(Math.round(totalDue) + parseFloat(activeSalary?.extra_amount || 0) + (sundayBonus?.bonusAmount || 0) + (sundayBonus?.incentiveAKI || 0) + (sundayBonus?.incentiveMonthly || 0) - loanDeductionTotal).toLocaleString('en-IN')}</div>
                          <div className="salary-visual-label">Total Due</div>
                        </div>
                      </div>

                      {/* Stacked bar: days breakdown */}
                      {(() => {
                        const ded = deducted.size;
                        const empty = Math.max(0, daysInMonth - availableDays);
                        const pct = (v) => (v / daysInMonth * 100).toFixed(1);
                        const cats = { present: 0, sunday: 0, deducted: 0, empty: 0 };
                        for (const md of monthDays) {
                          if (joinedThisMonth && md.date < joinCutoff) { cats.empty++; }
                          else if (deducted.has(md.date)) { cats.deducted++; }
                          else if (md.status === 'present' || md.status === 'late') { cats.present++; }
                          else if (md.status === 'half-day') { cats.present += 0.5; }
                          else if (md.dayName === 'Sun') { cats.sunday++; }
                        }
                        return (
                          <div>
                            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--ink-soft)', marginBottom:4 }}>
                              <span>Available: {availableDays}d</span>
                              <span>Present: {(presentDays + halfDayCount * 0.5).toFixed(1)}d</span>
                              <span>Sundays: {sundayCount}d</span>
                              <span>Deducted: {ded}d</span>
                            </div>
                            <div className="salary-breakdown-bar">
                              {cats.present > 0 && <div className="salary-bar-paid" style={{ width:pct(cats.present) + '%' }} title={`${cats.present} days present`} />}
                              {cats.sunday > 0 && <div className="salary-bar-sunday" style={{ width:pct(cats.sunday) + '%' }} title={`${cats.sunday} Sundays`} />}
                              {cats.deducted > 0 && <div className="salary-bar-deducted" style={{ width:pct(cats.deducted) + '%' }} title={`${cats.deducted} days deducted`} />}
                              {cats.empty > 0 && <div className="salary-bar-empty" style={{ width:pct(cats.empty) + '%' }} title={`${cats.empty} days before join`} />}
                            </div>
                            <div className="salary-breakdown-legend">
                              <span><span className="salary-legend-dot" style={{ background:'var(--sage)' }} />Present ({cats.present}d)</span>
                              <span><span className="salary-legend-dot" style={{ background:'#f59e0b' }} />Sundays ({cats.sunday}d)</span>
                              <span><span className="salary-legend-dot" style={{ background:'var(--danger)' }} />Deducted ({cats.deducted}d)</span>
                              {cats.empty > 0 && <span><span className="salary-legend-dot" style={{ background:'var(--line)' }} />Before join ({cats.empty}d)</span>}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Key metrics */}
                      <div className="salary-metrics">
                        <div className="salary-metric">
                          <div className="salary-metric-num">₹{parseFloat(activeSalary.salary).toLocaleString('en-IN')}</div>
                          <div className="salary-metric-lbl">Monthly Salary</div>
                        </div>
                        <div className="salary-metric">
                          <div className="salary-metric-num">{daysInMonth}</div>
                          <div className="salary-metric-lbl">Days in Month</div>
                        </div>
                        <div className="salary-metric">
                          <div className="salary-metric-num">{daysWorked}</div>
                          <div className="salary-metric-lbl">Days Worked</div>
                        </div>
                        <div className="salary-metric">
                          <div className="salary-metric-num" style={{ color:'#f59e0b' }}>{sundayCount}</div>
                          <div className="salary-metric-lbl">Sundays</div>
                        </div>
                        <div className="salary-metric">
                          <div className="salary-metric-num" style={{ color:'var(--danger)' }}>{totalLateMinutes}</div>
                          <div className="salary-metric-lbl">Late Minutes</div>
                        </div>
                        {lateDeductionDays > 0 && (
                          <div className="salary-metric">
                            <div className="salary-metric-num" style={{ color:'var(--danger)' }}>{lateDeductionDays}d</div>
                            <div className="salary-metric-lbl">Late Deduction</div>
                          </div>
                        )}
                        {joiningDeduction > 0 && (
                          <div className="salary-metric">
                            <div className="salary-metric-num" style={{ color:'#8B5CF6' }}>{joiningDeduction}d</div>
                            <div className="salary-metric-lbl">Joining Deduction</div>
                          </div>
                        )}
                      </div>

                      {/* Extra Amount row */}
                      <div className="salary-extra-row">
                        <span style={{ color:'var(--ink-soft)', fontSize:12 }}>Extra Amount</span>
                        {extraEditing ? (
                          <>
                            <input type="number" min="0" step="1"
                              value={extraVal}
                              onChange={e => setExtraVal(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Escape') setExtraEditing(false); }}
                              style={{ width:80, border:'1px solid var(--line)', borderRadius:'var(--radius-sm)', padding:'2px 6px', fontSize:13, textAlign:'right' }}
                              autoFocus />
                            <button className="btn btn-xs" disabled={extraSaving}
                              style={{ background:'var(--sage)', color:'#fff', border:'none', borderRadius:'var(--radius-sm)', padding:'2px 8px', cursor:'pointer', fontSize:12 }}
                              onClick={async () => {
                                setExtraSaving(true);
                                try {
                                  const val = parseFloat(extraVal) || 0;
                                  await updateWorkerSalary(activeSalary.id, { extra_amount: val });
                                  setSalaries(p => p.map(x => x.id === activeSalary.id ? { ...x, extra_amount: val } : x));
                                  setExtraEditing(false);
                                } catch (e) { alert(e.message); }
                                finally { setExtraSaving(false); }
                              }}>
                              {extraSaving ? '\u2026' : 'Save'}
                            </button>
                            <button className="btn btn-xs"
                              style={{ background:'transparent', border:'1px solid var(--line)', borderRadius:'var(--radius-sm)', padding:'2px 6px', cursor:'pointer', fontSize:12 }}
                              onClick={() => setExtraEditing(false)}>Cancel</button>
                          </>
                        ) : (
<>
                             <span style={{ fontWeight:600, fontSize:15 }}>₹{parseFloat(activeSalary?.extra_amount || 0).toLocaleString('en-IN')}</span>
                             <button className="btn btn-icon btn-sm" title="Add extra amount"
                               onClick={() => { setExtraEditing(true); setExtraVal(String(parseFloat(activeSalary?.extra_amount || 0))); }}>
                               <Pencil width={13} />
                             </button>
                           </>
                         )}
                       </div>

                       {/* Visual flow */}
                      <div style={{ borderTop:'1px solid var(--line)', marginTop:16, paddingTop:16 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:16, flexWrap:'wrap' }}>
                        <Box num={availableDays} label={joinedThisMonth ? 'Available\nDays' : 'Days in\nMonth'} color="#5B6B4E" />
                        <Arrow />
                         <Box num={availableDays - paidDays} label={'Deducted\nDays'} color="#d9534f" />
                        <Equals />
                        <Box num={paidDays} label={'Paid\nDays'} color="#5B6B4E" />
                        <Times />
                        <Box num={'₹' + perDay.toFixed(2)} label={'Per Day\nRate'} color="#4F6472" />
                        <Arrow />
                        <Box num={lateDeductionDays > 0 ? '-' + lateDeductionDays : '0'} label={'Late\nDeduction'} color={lateDeductionDays > 0 ? '#e67e22' : '#5B6B4E'} />
                        {joiningDeduction > 0 && <><Arrow /><Box num={'−' + joiningDeduction + 'd'} label={'Join\nDeduction'} color="#8B5CF6" /></>}
{(() => {
                           const sb = sundayBonus || {};
                           const bonusAmt = sb.bonusAmount || 0;
                           const akiAmt = sb.incentiveAKI || 0;
                           const monthlyAmt = sb.incentiveMonthly || 0;
                           const baseDue = Math.round(totalDue);
                           const loanDed = loanDeductionTotal;
                           const total = baseDue + bonusAmt + akiAmt + monthlyAmt - loanDed;
                           const isFRO = data.department === 'FRO';

                           return (
                             <>
                               <Box num={'₹' + baseDue.toLocaleString('en-IN')} label={'Salary\\nDue'} color="#5B6B4E" big />
                               {loanDed > 0 && <><Arrow /><Box num={'−₹' + loanDed.toLocaleString('en-IN')} label={'Loan/\\nAdvance'} color="#e67e22" /></>}
                               {isFRO && <><Arrow /><Box num={'+₹' + bonusAmt.toLocaleString('en-IN')} label={'Sunday\\nBonus'} color={bonusAmt > 0 ? '#f59e0b' : '#ddd'} /></>}
                               {isFRO && <><Arrow /><Box num={'+₹' + akiAmt.toLocaleString('en-IN')} label={'Incentive\\nAKI'} color={akiAmt > 0 ? '#8B5CF6' : '#ddd'} /></>}
                               {isFRO && <><Arrow /><Box num={'+₹' + monthlyAmt.toLocaleString('en-IN')} label={'Incentive\\nMonthly'} color={monthlyAmt > 0 ? '#3B82F6' : '#ddd'} /></>}
                               <Equals />
                               <Box num={'₹' + total.toLocaleString('en-IN')} label={'Total\\nDue'} color="#16a34a" big />
                             </>
                           );
                         })()}
                      </div>

                      {/* Sunday bonus explanation */}
                      {data.department === 'FRO' && sundayBonus && (
                        <div style={{ marginBottom:14, padding:'10px 14px', border:'1px solid #f59e0b', borderRadius:8, background:'#fffbeb', fontSize:12 }}>
                          <div style={{ fontWeight:600, color:'#92400e', marginBottom:6, fontSize:11, textTransform:'uppercase', letterSpacing:0.5 }}>
                            Why Sunday Bonus {sundayBonus.bonusAmount > 0 ? 'applied' : 'was not applied'}
                          </div>
                          <table style={{ width:'100%', borderCollapse:'collapse' }}>
                            <tbody>
                              <tr>
                                <td style={{ padding:'2px 6px 2px 0', width:80, verticalAlign:'top', whiteSpace:'nowrap' }}>
                                  <span style={{ display:'inline-block', width:8, height:8, background: sundayBonus.cameOnLastSunday ? '#bbf7d0' : '#fecaca', borderRadius:2, marginRight:4 }} />
                                  <strong>Last Sunday</strong>
                                </td>
                                <td style={{ padding:'2px 0', color:'var(--ink-soft)' }}>
                                  {sundayBonus.lastSundayDate
                                    ? new Date(sundayBonus.lastSundayDate + 'T00:00:00+05:30').toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
                                    : '\u2014'}
                                  {' — '}
                                  <span style={{ color: sundayBonus.cameOnLastSunday ? '#16a34a' : '#dc2626', fontWeight:600 }}>
                                    {sundayBonus.cameOnLastSunday ? 'Came to work' : 'Did not come'}
                                  </span>
                                </td>
                              </tr>
                              {sundayBonus.cameOnLastSunday && sundayBonus.sundayAchievement > 0 && (
                                <tr>
                                  <td style={{ padding:'2px 6px 2px 0', verticalAlign:'top', whiteSpace:'nowrap' }}>
                                    <span style={{ display:'inline-block', width:8, height:8, background:'#bbf7d0', borderRadius:2, marginRight:4 }} />
                                    <strong>Achievement</strong>
                                  </td>
                                  <td style={{ padding:'2px 0', color:'var(--ink-soft)' }}>
                                    ₹{sundayBonus.sundayAchievement.toLocaleString('en-IN')} → AKI +₹{sundayBonus.sundayAKI.toLocaleString('en-IN')}
                                  </td>
                                </tr>
                              )}
                              <tr>
                                <td style={{ padding:'2px 6px 2px 0', verticalAlign:'top', whiteSpace:'nowrap' }}>
                                  <span style={{ display:'inline-block', width:8, height:8, background: sundayBonus.thresholdMet ? '#bbf7d0' : '#fecaca', borderRadius:2, marginRight:4 }} />
                                  <strong>Target</strong>
                                </td>
                                <td style={{ padding:'2px 0', color:'var(--ink-soft)' }}>
                                  {sundayBonus.targetPercentage.toFixed(1)}% achieved — needs {sundayBonus.threshold}%
                                  {' — '}
                                  <span style={{ color: sundayBonus.thresholdMet ? '#16a34a' : '#dc2626', fontWeight:600 }}>
                                    {sundayBonus.thresholdMet ? 'Threshold met' : 'Threshold not met'}
                                  </span>
                                </td>
                              </tr>
                              <tr>
                                <td style={{ padding:'2px 6px 2px 0', verticalAlign:'top', whiteSpace:'nowrap' }}>
                                  <span style={{ display:'inline-block', width:8, height:8, background: sundayBonus.bonusAmount > 0 ? '#bbf7d0' : '#f0f0f0', borderRadius:2, marginRight:4 }} />
                                  <strong>Bonus</strong>
                                </td>
                                <td style={{ padding:'2px 0', fontWeight:700, color: sundayBonus.bonusAmount > 0 ? '#16a34a' : 'var(--ink-soft)' }}>
                                  {sundayBonus.bonusAmount > 0
                                    ? '₹' + sundayBonus.bonusAmount.toLocaleString('en-IN') + ' extra (1 day pay)'
                                    : 'Not eligible'}
                                </td>
                              </tr>
                              {sundayBonus.isNewJoiner && (
                                <tr>
                                  <td colSpan={2} style={{ padding:'4px 0 0', fontSize:11, color:'#92400e' }}>
                                    New joiner (≤3 months) — 40% threshold applies instead of 60%
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Late minutes badge */}
                      <div style={{ marginBottom:14 }}>
                        {totalLateMinutes > 480 ? (
                          <div style={{ padding:'10px 14px', border:'1px solid #d9534f', borderRadius:8, background:'#fff5f5', fontSize:12 }}>
                            <div style={{ fontWeight:600, color:'#d9534f' }}>⚠ {totalLateMinutes} min late ({Math.round(totalLateMinutes / 60 * 10) / 10} hrs) → {lateDeductionDays} day{lateDeductionDays !== 1 ? 's' : ''} deducted (proportional)</div>
                            <div style={{ color:'var(--ink-soft)', marginTop:4 }}>
                              Every 8 hours (480 min) of lateness = 1 day deducted.
                            </div>
                          </div>
                        ) : totalLateMinutes > 240 ? (
                          <div style={{ padding:'8px 14px', border:'1px solid #e67e22', borderRadius:8, background:'#fff8f0', fontSize:12 }}>
                            <strong style={{ color:'#e67e22' }}>{totalLateMinutes} min late → 1 day deducted</strong>
                          </div>
                        ) : totalLateMinutes > 180 ? (
                          <div style={{ padding:'8px 14px', border:'1px solid #e67e22', borderRadius:8, background:'#fff8f0', fontSize:12 }}>
                            <strong style={{ color:'#e67e22' }}>{totalLateMinutes} min late → Half day deducted</strong>
                          </div>
                        ) : totalLateMinutes > 0 ? (
                          <div style={{ padding:'8px 14px', border:'1px solid #5B6B4E', borderRadius:8, background:'#f6f9f4', fontSize:12 }}>
                            <strong style={{ color:'#5B6B4E' }}>{totalLateMinutes} min late — No deduction (≤ 180 min)</strong>
                          </div>
                        ) : null}
                      </div>

                      {/* Loan / Advance deduction info */}
                      {loanDeductionTotal > 0 && activeLoans.map(l => (
                        <div key={l.id} style={{ marginBottom:14, padding:'10px 14px', border:'1px solid #e67e22', borderRadius:8, background:'#fff8f0', fontSize:12 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:4 }}>
                            <span style={{ textTransform:'capitalize' }}><strong>{l.type}</strong> — ₹{parseFloat(l.monthly_deduction).toLocaleString('en-IN')}/mo deducted</span>
                            <span style={{ color:'var(--ink-soft)' }}>
                              Remaining: <strong style={{ color:'var(--danger)' }}>₹{parseFloat(l.remaining_amount).toLocaleString('en-IN')}</strong>
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Join info — highlighted box */}
                      {joinedThisMonth && (
                        <div style={{ marginBottom:14, padding:'10px 14px', border:'1px solid #f0d58c', borderRadius:8, background:'#fffbea', fontSize:12 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:4 }}>
                            <span><strong>Joined:</strong> {new Date(data.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}</span>
                            <span><strong>Available:</strong> {joinDayNum} – {daysInMonth} → <span style={{ fontWeight:700, fontSize:14 }}>{availableDays} days</span></span>
                            <span><strong>Joining deduction:</strong> {joiningDeduction} days</span>
                          </div>
                        </div>
                      )}

                      {/* What's deducted — visual breakdown */}
                      {(() => {
                        const autoSundays = [...deducted].filter(d =>
                          !absentDatesAfterJoin.includes(d) &&
                          new Date(d).getDay() === 0 &&
                          !extraSundays.includes(d)
                        );
                        const hasAny = absentDatesAfterJoin.length > 0 || autoSundays.length > 0 || extraSundays.length > 0 || lateDeductionDays > 0 || joiningDeduction > 0;
                        if (!hasAny) return null;
                        return (
                          <div style={{ marginBottom:14, padding:'10px 14px', border:'1px solid var(--danger)', borderRadius:8, background:'#fff5f5', fontSize:12 }}>
                            <div style={{ fontWeight:600, color:'var(--danger)', marginBottom:6, fontSize:11, textTransform:'uppercase', letterSpacing:0.5 }}>
                              Why {deducted.size} day{deducted.size != 1 ? 's' : ''} are deducted
                            </div>
                            <table style={{ width:'100%', borderCollapse:'collapse' }}>
                              <tbody>
                                {absentDatesAfterJoin.length > 0 && (
                                  <tr>
                                    <td style={{ padding:'2px 6px 2px 0', width:80, verticalAlign:'top', whiteSpace:'nowrap' }}>
                                      <span style={{ display:'inline-block', width:8, height:8, background:'#ffe0e0', borderRadius:2, marginRight:4 }} />
                                      <strong>{absentDatesAfterJoin.length} absent</strong>
                                    </td>
                                    <td style={{ padding:'2px 0', color:'var(--ink-soft)' }}>
                                      {absentDatesAfterJoin.map(d => {
                                        const dt = new Date(d);
                                        return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getDay()] + ' ' + dt.getDate();
                                      }).join(', ')}
                                    </td>
                                  </tr>
                                )}
                                {autoSundays.length > 0 && (
                                  <tr>
                                    <td style={{ padding:'2px 6px 2px 0', verticalAlign:'top', whiteSpace:'nowrap' }}>
                                      <span style={{ display:'inline-block', width:8, height:8, background:'#fce4b0', borderRadius:2, marginRight:4 }} />
                                      <strong>{autoSundays.length} Sun{autoSundays.length > 1 ? 's' : ''}</strong>
                                    </td>
                                    <td style={{ padding:'2px 0', color:'var(--ink-soft)' }}>
                                      {autoSundays.map(d => {
                                        const dt = new Date(d);
                                        return 'Sun ' + dt.getDate();
                                      }).join(', ')}
                                      {' (Sat/Mon → next/prev Sun)'}
                                    </td>
                                  </tr>
                                )}
                                {extraSundays.length > 0 && (
                                  <tr>
                                    <td style={{ padding:'2px 6px 2px 0', verticalAlign:'top', whiteSpace:'nowrap' }}>
                                      <span style={{ display:'inline-block', width:8, height:8, background:'#f0c0c0', borderRadius:2, marginRight:4 }} />
                                      <strong>{extraSundays.length} extra</strong>
                                    </td>
                                    <td style={{ padding:'2px 0', color:'var(--ink-soft)' }}>
                                      {'≥6 absences rule → ' + extraSundays.map(d => {
                                        const dt = new Date(d);
                                        return 'Sun ' + dt.getDate();
                                      }).join(', ')}
                                    </td>
                                  </tr>
                                )}
                                {lateDeductionDays > 0 && (
                                  <tr>
                                    <td style={{ padding:'2px 6px 2px 0', verticalAlign:'top', whiteSpace:'nowrap' }}>
                                      <span style={{ display:'inline-block', width:8, height:8, background:'#e67e22', borderRadius:2, marginRight:4 }} />
                                      <strong>{lateDeductionDays} late</strong>
                                    </td>
                                    <td style={{ padding:'2px 0', color:'var(--ink-soft)' }}>
                                      {totalLateMinutes} min late → {lateDeductionDays} day{lateDeductionDays !== 1 ? 's' : ''} deducted
                                    </td>
                                  </tr>
                                )}
                                {joiningDeduction > 0 && (
                                  <tr>
                                    <td style={{ padding:'2px 6px 2px 0', verticalAlign:'top', whiteSpace:'nowrap' }}>
                                      <span style={{ display:'inline-block', width:8, height:8, background:'#8B5CF6', borderRadius:2, marginRight:4 }} />
                                      <strong>{joiningDeduction} joining</strong>
                                    </td>
                                    <td style={{ padding:'2px 0', color:'var(--ink-soft)' }}>
                                      First month deduction for new joiners
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}

                      {/* Day grid */}
                      <div style={{ marginBottom:12 }}>
                        <div style={{ color:'var(--ink-soft)', marginBottom:6, fontSize:11, textTransform:'uppercase', letterSpacing:0.5 }}>Day-by-day status</div>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, fontSize:10 }}>
                          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d =>
                            <div key={d} style={{ textAlign:'center', fontWeight:600, color:'var(--ink-soft)', padding:'2px 0' }}>{d}</div>
                          )}
                          {(() => {
                            const firstDay = new Date(yr, mo - 1, 1).getDay();
                            const cells = [];
                            for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} />);
                            for (const md of monthDays) {
                              const isDeducted = deducted.has(md.date);
                              const isWeekend = md.dayName === 'Sun';
                              const beforeJoin = joinedThisMonth && md.date < joinCutoff;
                              let bg, label, title;
                              if (beforeJoin) { bg = '#e8e8e8'; label = '—'; title = 'Before join'; }
                              else if (isDeducted) { bg = '#ffe0e0'; label = '✗'; title = 'Deducted'; }
                              else if (md.status === 'present' || md.status === 'late') { bg = '#d4edda'; label = '✓'; title = 'Present/Late'; }
                              else if (md.status === 'half-day') { bg = '#e8d5f5'; label = 'HD'; title = 'Half Day'; }
                              else if (isWeekend) { bg = '#f0f0f0'; label = '—'; title = 'Weekend'; }
                              else { bg = '#fff'; label = ''; title = ''; }
                              cells.push(
                                <div key={md.date} style={{ textAlign:'center', padding:'3px 0', borderRadius:3, background:bg, fontSize:9, position:'relative' }}>
                                  <div>{md.day}</div>
                                  <div style={{ fontWeight:600 }} title={title}>{label}</div>
                                </div>
                              );
                            }
                            return cells;
                          })()}
                        </div>
                        <div style={{ display:'flex', gap:16, marginTop:6, fontSize:10, color:'var(--ink-soft)', flexWrap:'wrap' }}>
                          <span><span style={{ display:'inline-block', width:10, height:10, background:'#d4edda', borderRadius:2, marginRight:4, verticalAlign:'middle' }} />Present/Late</span>
                          <span><span style={{ display:'inline-block', width:10, height:10, background:'#ffe0e0', borderRadius:2, marginRight:4, verticalAlign:'middle' }} />Deducted</span>
                          <span><span style={{ display:'inline-block', width:10, height:10, background:'#f0f0f0', borderRadius:2, marginRight:4, verticalAlign:'middle' }} />Weekend</span>
                          {joinedThisMonth && <span><span style={{ display:'inline-block', width:10, height:10, background:'#e8e8e8', borderRadius:2, marginRight:4, verticalAlign:'middle' }} />Before join</span>}
                          <span><span style={{ display:'inline-block', width:10, height:10, background:'#fff', border:'1px solid #ddd', borderRadius:2, marginRight:4, verticalAlign:'middle' }} />No record</span>
                        </div>
                      </div>

                      {/* Summary totals */}
                      <div style={{ borderTop:'2px solid var(--line)', paddingTop:12, marginTop:12 }}>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 16px', fontSize:12 }}>
                          <span style={{ color:'var(--ink-soft)' }}>Days in month</span><span style={{ textAlign:'right' }}>{daysInMonth}</span>
                          {joinedThisMonth && <><span style={{ color:'var(--ink-soft)' }}>Available (from join date)</span><span style={{ textAlign:'right' }}>{availableDays}</span></>}
                          <span style={{ color:'var(--ink-soft)' }}>Days worked (present + late)</span><span style={{ textAlign:'right' }}>{daysWorked}</span>
                          <span style={{ color:'var(--danger)' }}>Absent days (on/after join)</span><span style={{ textAlign:'right' }}>{absentDatesAfterJoin.length}</span>
                          <span style={{ color:'var(--danger)' }}>Total deducted days</span><span style={{ textAlign:'right' }}>{deducted.size}</span>
                          {lateDeductionDays > 0 && (
                            <>
                              <span style={{ color:'var(--danger)' }}>Late deduction</span><span style={{ textAlign:'right' }}>{lateDeductionDays} day{lateDeductionDays > 1 ? 's' : ''}</span>
                              <span style={{ color:'var(--ink-soft)' }}>Late minutes</span><span style={{ textAlign:'right' }}>{totalLateMinutes}</span>
                            </>
                          )}
                          {joiningDeduction > 0 && (
                            <><span style={{ color:'#8B5CF6' }}>Joining deduction</span><span style={{ textAlign:'right', color:'#8B5CF6' }}>{joiningDeduction} day{joiningDeduction > 1 ? 's' : ''}</span></>
                          )}
                          <span style={{ borderTop:'1px solid var(--line)', paddingTop:4, fontWeight:600 }}>Paid days</span>
                          <span style={{ borderTop:'1px solid var(--line)', paddingTop:4, textAlign:'right', fontWeight:600 }}>{paidDays}</span>
{loanDeductionTotal > 0 && (
                             <><span style={{ color:'#e67e22' }}>Loan/Advance deduction</span><span style={{ textAlign:'right', color:'#e67e22' }}>−₹{loanDeductionTotal.toLocaleString('en-IN')}</span></>
                           )}
                         </div>
                       </div>
                       </div>
                     </>
                   )}
                </div>
              </div>

              {/* NGO Allocations Breakdown */}
              {allocations.length > 0 && (
              <div className="card" style={{ marginBottom:16 }}>
                <div className="card-head"><h3>NGO Allocations</h3></div>
                <div className="card-pad" style={{ overflow:'hidden' }}>
                  <table style={{ width:'100%', tableLayout:'fixed', borderCollapse:'collapse', fontSize:10, fontVariantNumeric:'tabular-nums' }}>
                    <colgroup>
                      <col style={{ width:'25%' }} />
                      <col style={{ width:'11%' }} />
                      <col style={{ width:'10%' }} />
                      <col style={{ width:'13%' }} />
                      <col style={{ width:'10%' }} />
                      <col style={{ width:'11%' }} />
                      <col style={{ width:'10%' }} />
                      <col style={{ width:'10%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th style={{ textAlign:'left', padding:'4px 3px', borderBottom:'2px solid var(--line)', whiteSpace:'nowrap', fontSize:10 }}>NGO</th>
                        <th style={{ textAlign:'right', padding:'4px 3px', borderBottom:'2px solid var(--line)', whiteSpace:'nowrap', fontSize:10 }}>Portion</th>
                        <th style={{ textAlign:'right', padding:'4px 3px', borderBottom:'2px solid var(--line)', whiteSpace:'nowrap', fontSize:10 }}>Day</th>
                        <th style={{ textAlign:'right', padding:'4px 3px', borderBottom:'2px solid var(--line)', whiteSpace:'nowrap', fontSize:10 }}>Salary</th>
                        <th style={{ textAlign:'right', padding:'4px 3px', borderBottom:'2px solid var(--line)', whiteSpace:'nowrap', fontSize:10, color:'#92400e' }}>AKI</th>
                        <th style={{ textAlign:'right', padding:'4px 3px', borderBottom:'2px solid var(--line)', whiteSpace:'nowrap', fontSize:10, color:'#92400e' }}>Mon.</th>
                        <th style={{ textAlign:'right', padding:'4px 3px', borderBottom:'2px solid var(--line)', whiteSpace:'nowrap', fontSize:10, color:'#92400e' }}>Sun.</th>
                        <th style={{ textAlign:'right', padding:'4px 3px', borderBottom:'2px solid var(--line)', whiteSpace:'nowrap', fontSize:10 }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const totalSalaryVal = parseFloat(activeSalary?.salary || 0);
                        const totAKI = sundayBonus?.incentiveAKI || 0;
                        const totMonthly = sundayBonus?.incentiveMonthly || 0;
                        const totSunday = sundayBonus?.bonusAmount || 0;
                        const isIncentive = data.department === 'FRO' && (totAKI > 0 || totMonthly > 0 || totSunday > 0);

                        return allocations.map(a => {
                          const portion = parseFloat(a.salary_portion);
                          const ratio = totalSalaryVal > 0 ? portion / totalSalaryVal : 0;
                          const allocPerDay = portion / daysInMonth;
                          const allocDue = allocPerDay * Math.max(0, paidDays - lateDeductionDays - joiningDeduction);
                          const allocAKI = isIncentive ? Math.round(totAKI * ratio) : 0;
                          const allocMonthly = isIncentive ? Math.round(totMonthly * ratio) : 0;
                          const allocSunday = isIncentive ? Math.round(totSunday * ratio) : 0;
                          const allocGrand = Math.round(allocDue) + allocAKI + allocMonthly + allocSunday;
                          const ngoName = ngos.find(n => n.id === a.ngo_id)?.name || a.ngo_name || 'Unknown';

                          return (
                            <tr key={a.id || a.ngo_id}>
                              <td style={{ padding:'3px 3px', borderBottom:'1px solid var(--line)', fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontSize:10 }}>{ngoName}</td>
                              <td style={{ padding:'3px 3px', borderBottom:'1px solid var(--line)', textAlign:'right', whiteSpace:'nowrap', fontSize:10 }}>₹{portion.toLocaleString('en-IN')}</td>
                              <td style={{ padding:'3px 3px', borderBottom:'1px solid var(--line)', textAlign:'right', whiteSpace:'nowrap', fontSize:10 }}>₹{Math.round(allocPerDay).toLocaleString('en-IN')}</td>
                              <td style={{ padding:'3px 3px', borderBottom:'1px solid var(--line)', textAlign:'right', fontWeight:600, whiteSpace:'nowrap', fontSize:10 }}>₹{Math.round(allocDue).toLocaleString('en-IN')}</td>
                              <td style={{ padding:'3px 3px', borderBottom:'1px solid var(--line)', textAlign:'right', color: allocAKI > 0 ? '#f59e0b' : 'var(--ink-soft)', whiteSpace:'nowrap', fontSize:10 }}>
                                {allocAKI > 0 ? '₹' + allocAKI.toLocaleString('en-IN') : '₹0'}
                              </td>
                              <td style={{ padding:'3px 3px', borderBottom:'1px solid var(--line)', textAlign:'right', color: allocMonthly > 0 ? '#f59e0b' : 'var(--ink-soft)', whiteSpace:'nowrap', fontSize:10 }}>
                                {allocMonthly > 0 ? '₹' + allocMonthly.toLocaleString('en-IN') : '₹0'}
                              </td>
                              <td style={{ padding:'3px 3px', borderBottom:'1px solid var(--line)', textAlign:'right', color: allocSunday > 0 ? '#f59e0b' : 'var(--ink-soft)', whiteSpace:'nowrap', fontSize:10 }}>
                                {allocSunday > 0 ? '₹' + allocSunday.toLocaleString('en-IN') : '₹0'}
                              </td>
                              <td style={{ padding:'3px 3px', borderBottom:'1px solid var(--line)', textAlign:'right', fontWeight:700, color: allocGrand > Math.round(allocDue) ? '#16a34a' : 'var(--sage)', whiteSpace:'nowrap', fontSize:10 }}>
                                ₹{allocGrand.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                    <tfoot>
                      {(() => {
                        const totalSalaryVal = parseFloat(activeSalary?.salary || 0);
                        const totAKI = sundayBonus?.incentiveAKI || 0;
                        const totMonthly = sundayBonus?.incentiveMonthly || 0;
                        const totSunday = sundayBonus?.bonusAmount || 0;
                        const isIncentive = data.department === 'FRO' && (totAKI > 0 || totMonthly > 0 || totSunday > 0);
                        const sumDue = Math.round(allocations.reduce((s, a) => {
                          const portion = parseFloat(a.salary_portion);
                          const allocPerDay = portion / daysInMonth;
                          return s + allocPerDay * Math.max(0, paidDays - lateDeductionDays - joiningDeduction);
                        }, 0));
                        const sumAKI = isIncentive ? Math.round(totAKI) : 0;
                        const sumMonthly = isIncentive ? Math.round(totMonthly) : 0;
                        const sumSunday = isIncentive ? Math.round(totSunday) : 0;
                        const sumGrand = sumDue + sumAKI + sumMonthly + sumSunday;

                        return (
                          <>
                            <tr>
                              <td style={{ padding:'5px 3px', fontWeight:700, fontSize:10, borderTop:'2px solid var(--line)' }}>Merged Total</td>
                              <td style={{ padding:'5px 3px', textAlign:'right', fontWeight:700, fontSize:10, borderTop:'2px solid var(--line)' }}>
                                ₹{totalSalaryVal.toLocaleString('en-IN')}
                              </td>
                              <td style={{ padding:'5px 3px', textAlign:'right', fontWeight:700, fontSize:10, borderTop:'2px solid var(--line)' }}>
                                ₹{Math.round(perDay).toLocaleString('en-IN')}
                              </td>
                              <td style={{ padding:'5px 3px', textAlign:'right', fontWeight:700, fontSize:10, borderTop:'2px solid var(--line)', color:'var(--sage)' }}>
                                ₹{sumDue.toLocaleString('en-IN')}
                              </td>
                              <td style={{ padding:'5px 3px', textAlign:'right', fontWeight:700, fontSize:10, borderTop:'2px solid var(--line)', color: sumAKI > 0 ? '#f59e0b' : 'var(--ink-soft)' }}>
                                {sumAKI > 0 ? '₹' + sumAKI.toLocaleString('en-IN') : '₹0'}
                              </td>
                              <td style={{ padding:'5px 3px', textAlign:'right', fontWeight:700, fontSize:10, borderTop:'2px solid var(--line)', color: sumMonthly > 0 ? '#f59e0b' : 'var(--ink-soft)' }}>
                                {sumMonthly > 0 ? '₹' + sumMonthly.toLocaleString('en-IN') : '₹0'}
                              </td>
                              <td style={{ padding:'5px 3px', textAlign:'right', fontWeight:700, fontSize:10, borderTop:'2px solid var(--line)', color: sumSunday > 0 ? '#f59e0b' : 'var(--ink-soft)' }}>
                                {sumSunday > 0 ? '₹' + sumSunday.toLocaleString('en-IN') : '₹0'}
                              </td>
                              <td style={{ padding:'5px 3px', textAlign:'right', fontWeight:800, fontSize:11, borderTop:'2px solid var(--line)', color:'#16a34a' }}>
                                ₹{sumGrand.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          </>
                        );
                      })()}
                    </tfoot>
                  </table>
                  <div style={{ marginTop:8, fontSize:11, color:'var(--ink-soft)' }}>
                    Attendance is shared across all allocations. Deductions affect each portion equally.
                    {data.department === 'FRO' && sundayBonus?.bonusAmount > 0 && (
                      <> Incentives (AKI, Monthly, Sunday) are split proportionally by salary portion.</>
                    )}
                  </div>
                </div>
              </div>
              )}

              <div className="card" style={{ marginBottom:16 }}>
                <div className="card-head"><h3>Add Salary</h3></div>
                <div className="card-pad">
                  {salaries.length === 0 ? (
                    <>
                      <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap' }}>
                        <div>
                          <span className="detail-label">Salary Amount</span>
                          <input type="number" step="0.01" min="0" placeholder="e.g. 25000"
                            value={salaryForm.salary}
                            onChange={e => setSalaryForm(f => ({ ...f, salary: e.target.value }))}
                            style={{ border:'1px solid var(--line)', borderRadius:'var(--radius-sm)', padding:'6px 10px', fontSize:13, width:160 }} />
                        </div>
                      </div>
                      <div style={{ marginTop:10 }}>
                        <span className="detail-label" style={{ display:'block', marginBottom:6 }}>Allocate to</span>
                        <div style={{ display:'flex', gap:8 }}>
                          <label style={{ display:'flex', alignItems:'center', gap:5, cursor:'pointer', fontSize:13 }}>
                            <input type="radio" name="ngoCount" checked={salaryNgoCount === 1}
                              onChange={() => { setSalaryNgoCount(1); setSalaryNgo2(''); }} />
                            1 NGO
                          </label>
                          <label style={{ display:'flex', alignItems:'center', gap:5, cursor:'pointer', fontSize:13 }}>
                            <input type="radio" name="ngoCount" checked={salaryNgoCount === 2}
                              onChange={() => setSalaryNgoCount(2)} />
                            2 NGOs
                          </label>
                        </div>
                      </div>
                      <div style={{ marginTop:10, display:'flex', gap:12, flexWrap:'wrap' }}>
                        {salaryNgoCount === 1 ? (
                          <div>
                            <span className="detail-label">NGO</span>
                            <Dropdown value={salaryNgo1} onChange={val => {
                              setSalaryNgo1(val);
                              setSalaryNgo2(prev => prev === val ? '' : prev);
                            }}
                              options={[
                                { value: '', label: 'Select NGO' },
                                ...ngos.map(n => ({ value: n.id, label: n.name }))
                              ]}
                              style={{ minWidth:180 }} />
                          </div>
                        ) : (
                          <>
                            <div>
                              <span className="detail-label">NGO 1</span>
                              <Dropdown value={salaryNgo1} onChange={val => {
                                setSalaryNgo1(val);
                                setSalaryNgo2(prev => prev === val ? '' : prev);
                              }}
                                options={[
                                  { value: '', label: 'Select NGO' },
                                  ...ngos.map(n => ({ value: n.id, label: n.name }))
                                ]}
                                style={{ minWidth:160 }} />
                            </div>
                            <div>
                              <span className="detail-label">NGO 2</span>
                              <Dropdown value={salaryNgo2} onChange={val => {
                                setSalaryNgo2(val);
                                setSalaryNgo1(prev => prev === val ? '' : prev);
                              }}
                                options={[
                                  { value: '', label: 'Select NGO' },
                                  ...ngos.map(n => ({ value: n.id, label: n.name }))
                                ]}
                                style={{ minWidth:160 }} />
                            </div>
                          </>
                        )}
                      </div>
                      <div style={{ display:'flex', gap:12, alignItems:'center', marginTop:12 }}>
                        <button className="btn btn-primary btn-sm" disabled={salarySubmitting || !salaryForm.salary || !salaryNgo1 || (salaryNgoCount === 2 && !salaryNgo2)}
                          onClick={async () => {
                            setSalarySubmitting(true);
                            try {
                              const joinDate = new Date(data.created_at);
                              const joinMonth = `${joinDate.getFullYear()}-${String(joinDate.getMonth() + 1).padStart(2, '0')}-01`;
                              const now = new Date();
                              const currMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

                              const sorted = [...salaries].sort((a, b) => b.from_month.localeCompare(a.from_month));
                              const latest = sorted[0];

                              let from_month;
                              if (!latest) {
                                from_month = joinMonth;
                              } else {
                                from_month = currMonth;
                              }

                              if (latest && !latest.to_month) {
                                const d = new Date(from_month);
                                d.setDate(0);
                                const prevMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
                                await updateWorkerSalary(latest.id, { to_month: prevMonth });
                                setSalaries(p => p.map(x => x.id === latest.id ? { ...x, to_month: prevMonth } : x));
                              }

                              const salNum = parseFloat(salaryForm.salary);
                              const res = await addWorkerSalary({
                                worker_id: worker.id,
                                salary: salNum,
                                from_month,
                                to_month: null,
                              });
                              setSalaries(p => [res.record, ...p]);

                              const allocs = salaryNgoCount === 1
                                ? [{ ngo_id: salaryNgo1, salary_portion: salNum }]
                                : [{ ngo_id: salaryNgo1, salary_portion: salNum / 2 }, { ngo_id: salaryNgo2, salary_portion: salNum / 2 }];
                              await setWorkerAllocations(worker.id, allocs, salNum);
                              setAllocations(allocs);

                              setSalaryForm({ salary: '' });
                              setSalaryNgo1('');
                              setSalaryNgo2('');
                            } catch (e) { alert(e.message); }
                            finally { setSalarySubmitting(false); }
                          }}>
                          {salarySubmitting ? 'Adding\u2026' : 'Add Salary'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap' }}>
                      <div>
                        <span className="detail-label">Salary Amount</span>
                        <input type="number" step="0.01" min="0" placeholder="e.g. 25000"
                          value={salaryForm.salary}
                          onChange={e => setSalaryForm(f => ({ ...f, salary: e.target.value }))}
                          style={{ border:'1px solid var(--line)', borderRadius:'var(--radius-sm)', padding:'6px 10px', fontSize:13, width:160 }} />
                      </div>
                      <button className="btn btn-primary btn-sm" disabled={salarySubmitting || !salaryForm.salary}
                        onClick={async () => {
                          setSalarySubmitting(true);
                          try {
                            const joinDate = new Date(data.created_at);
                            const joinMonth = `${joinDate.getFullYear()}-${String(joinDate.getMonth() + 1).padStart(2, '0')}-01`;
                            const now = new Date();
                            const currMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

                            const sorted = [...salaries].sort((a, b) => b.from_month.localeCompare(a.from_month));
                            const latest = sorted[0];

                            let from_month;
                            if (!latest) {
                              from_month = joinMonth;
                            } else {
                              from_month = currMonth;
                            }

                            if (latest && !latest.to_month) {
                              const d = new Date(from_month);
                              d.setDate(0);
                              const prevMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
                              await updateWorkerSalary(latest.id, { to_month: prevMonth });
                              setSalaries(p => p.map(x => x.id === latest.id ? { ...x, to_month: prevMonth } : x));
                            }

                            await addWorkerSalary({
                              worker_id: worker.id,
                              salary: parseFloat(salaryForm.salary),
                              from_month,
                              to_month: null,
                            });
                            setSalaryForm({ salary: '' });
                          } catch (e) { alert(e.message); }
                          finally { setSalarySubmitting(false); }
                        }}>
                        {salarySubmitting ? 'Adding\u2026' : 'Add Salary'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-head"><h3>Salary History ({salaries.length} records)</h3></div>
                {salaries.length === 0 ? (
                  <div className="card-pad"><div className="empty">No salary records found.</div></div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Salary</th>
                        <th>From</th>
                        <th>To</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...salaries].sort((a, b) => b.from_month.localeCompare(a.from_month)).map((s, i) => {
                        const from = new Date(s.from_month);
                        const to = s.to_month ? new Date(s.to_month) : null;
                        const fmtMonth = (d) => d.toLocaleDateString('en-GB', { month:'long', year:'numeric' });
                        const paid = s.paid_at;
                        return (
                          <tr key={s.id}>
                            <td>{i + 1}</td>
                            <td style={{ fontWeight:600 }}>₹{parseFloat(s.salary).toLocaleString('en-IN')}</td>
                            <td>{fmtMonth(from)}</td>
                            <td>{to ? fmtMonth(to) : '\u2014 (Current)'}</td>
                            <td>
                              {paid ? (
                                <span className="pill pill-green">Paid</span>
                              ) : (
                                <span className="pill pill-gold">Unpaid</span>
                              )}
                            </td>
                            <td>
                              <div style={{ display:'flex', gap:4 }}>
                                <button className="btn btn-icon" title="Delete"
                                  onClick={async () => {
                                    if (!confirm('Delete this salary record?')) return;
                                    try {
                                      await fetch(API_BASE + '/salary/' + s.id, { method:'DELETE', headers:{ Authorization: 'Bearer ' + localStorage.getItem('ucs_token') } });
                                      setSalaries(p => p.filter(x => x.id !== s.id));
                                    } catch (e) { alert(e.message); }
                                  }}>
                                  <Trash width={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {data.department === 'FRO' && (
              <div className="card" style={{ marginBottom:16 }}>
                <div className="card-head"><h3>FRO Target & Incentives</h3></div>
                <div className="card-pad">
                  {currentTarget != null ? (
                    <div style={{ fontSize:22, fontWeight:700, color:'var(--sage)', marginBottom:12 }}>
                      Monthly Target: ₹{currentTarget.toLocaleString('en-IN')}
                    </div>
                  ) : (
                    <div style={{ fontSize:14, color:'var(--ink-soft)', marginBottom:12 }}>Monthly target not set</div>
                  )}

                  {incSummary && (
                    <div style={{ marginBottom:12, padding:'10px 14px', borderRadius:8, background: incSummary.monthlyTargetMet ? '#f0fdf4' : '#fef2f2', border:'1px solid', borderColor: incSummary.monthlyTargetMet ? '#bbf7d0' : '#fecaca' }}>
                      <div style={{ fontWeight:600, fontSize:13, color: incSummary.monthlyTargetMet ? '#16a34a' : '#ef4444', marginBottom:4 }}>
                        {incSummary.monthlyTargetMet ? '✓ Target Met' : '✗ Target Not Met — AKI forfeited'}
                      </div>
                      <div style={{ fontSize:12, color:'var(--ink-soft)' }}>
                        Achieved: ₹{incSummary.monthlyAchievement.toLocaleString('en-IN')} / ₹{incSummary.monthlyTarget.toLocaleString('en-IN')}
                        {' | '}AKI Payout: ₹{incSummary.akiPayout.toLocaleString('en-IN')} ({incSummary.isNewJoiner ? 'Full' : 'Half'})
                        {' | '}Monthly: ₹{incSummary.monthlyIncentive.toLocaleString('en-IN')}
                        {' | '}<strong style={{ color: incSummary.monthlyTargetMet ? '#16a34a' : '#ef4444' }}>Total: ₹{incSummary.totalIncentive.toLocaleString('en-IN')}</strong>
                      </div>
                    </div>
                  )}

                  <div className="salary-metrics" style={{ marginBottom:8 }}>
                    <div className="salary-metric">
                      <div className="salary-metric-num">₹{(incSummary?.totalAKI || 0).toLocaleString('en-IN')}</div>
                      <div className="salary-metric-lbl">Total AKI</div>
                    </div>
                    <div className="salary-metric">
                      <div className="salary-metric-num">₹{(incSummary?.monthlyIncentive || 0).toLocaleString('en-IN')}</div>
                      <div className="salary-metric-lbl">Monthly (10%)</div>
                    </div>
                    <div className="salary-metric">
                      <div className="salary-metric-num" style={{ color: incSummary?.monthlyTargetMet ? 'var(--sage)' : 'var(--danger)' }}>
                        ₹{(incSummary?.totalIncentive || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="salary-metric-lbl">Total Incentive</div>
                    </div>
                  </div>

                  <div style={{ borderTop:'1px solid var(--line)', paddingTop:12 }}>
                    <div style={{ color:'var(--ink-soft)', fontSize:11, textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>
                      Daily Achievements & AKI
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, fontSize:10 }}>
                      {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d =>
                        <div key={d} style={{ textAlign:'center', fontWeight:600, color:'var(--ink-soft)', padding:'2px 0' }}>{d}</div>
                      )}
                      {(() => {
                        const now = new Date();
                        const yr = now.getFullYear();
                        const mo = now.getMonth();
                        const daysInMonth = new Date(yr, mo + 1, 0).getDate();
                        const firstDay = new Date(yr, mo, 1).getDay();
                        const cells = [];
                        for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} />);
                        for (let d = 1; d <= daysInMonth; d++) {
                          const dateStr = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                          const ach = workerAchs.find(a => a.date === dateStr);
                          const formKey = `ach-${dateStr}`;
                          const saving = achSaving[formKey];
                          const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
                          const dayName = dayNames[new Date(dateStr).getDay()];
                          cells.push(
                            <div key={dateStr} style={{ textAlign:'center', padding:'3px 0', borderRadius:3, background: ach ? '#f0fdf4' : '#fff', fontSize:9, border:'1px solid', borderColor: ach ? '#bbf7d0' : '#f3f4f6', position:'relative' }}>
                              <div style={{ fontWeight:600 }}>{d}</div>
                              {ach ? (
                                <div style={{ color:'#16a34a', fontSize:8 }}>₹{parseFloat(ach.amount).toLocaleString('en-IN')}</div>
                              ) : (
                                <div style={{ marginTop:1 }}>
                                  <input type="number" min="0" placeholder="amt"
                                    value={achForm[formKey] || ''}
                                    onChange={e => setAchForm(f => ({ ...f, [formKey]: e.target.value }))}
                                    style={{ width:'100%', border:'none', background:'transparent', fontSize:8, textAlign:'center', padding:0, outline:'none' }}
                                    onKeyDown={async e => {
                                      if (e.key === 'Enter' && achForm[formKey]) {
                                        setAchSaving(f => ({ ...f, [formKey]: true }));
                                        try {
                                          await setAchievement(data.id, dateStr, parseFloat(achForm[formKey]));
                                          const month = `${yr}-${String(mo + 1).padStart(2, '0')}-01`;
                                          const a = await fetchWorkerAchievements(data.id, month);
                                          setWorkerAchs(Array.isArray(a) ? a : []);
                                          const s = await fetchIncentiveSummary(data.id, month);
                                          setIncSummary(s?.hasIncentive ? s : null);
                                          setAchForm(f => ({ ...f, [formKey]: '' }));
                                        } catch (e) { alert(e.message); }
                                        finally { setAchSaving(f => ({ ...f, [formKey]: false })); }
                                      }
                                    }}
                                  />
                                  {saving && <div style={{ fontSize:7, color:'#6b7280' }}>...</div>}
                                </div>
                              )}
                            </div>
                          );
                        }
                        return cells;
                      })()}
                    </div>
                    <div style={{ display:'flex', gap:16, marginTop:6, fontSize:9, color:'var(--ink-soft)', flexWrap:'wrap' }}>
                      <span><span style={{ display:'inline-block', width:8, height:8, background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:2, marginRight:3, verticalAlign:'middle' }} />AKI earned</span>
                      <span><span style={{ display:'inline-block', width:8, height:8, background:'#fff', border:'1px solid #f3f4f6', borderRadius:2, marginRight:3, verticalAlign:'middle' }} />No entry</span>
                      <span style={{ color:'var(--ink-soft)' }}>Type amount + Enter to save</span>
                    </div>
                  </div>
                </div>
              </div>
              )}

            </div>
          )}

          {tab === 'leaves' && (
            <div className="card">
              <div className="card-head"><h3>Leave History ({empLeaves.length} records)</h3></div>
              {empLeaves.length === 0 ? (
                <div className="card-pad"><div className="empty">No leave records found.</div></div>
              ) : (
                <table>
                  <thead><tr><th>From</th><th>To</th><th>Reason</th><th>Status</th></tr></thead>
                  <tbody>
                    {empLeaves.map(l => (
                      <tr key={l.id}>
                        <td>{new Date(l.from_date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</td>
                        <td>{new Date(l.to_date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</td>
                        <td style={{ color:'var(--ink-soft)', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.reason || '\u2014'}</td>
                        <td><StatusPill status={l.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === 'loans' && (
            <div className="card">
              <div className="card-head"><h3>Loans & Advances</h3></div>
              <div className="card-pad">
                {workerLoans.length === 0 ? (
                  <div className="empty">No loans or advances.</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Monthly Deduction</th>
                        <th>Paid So Far</th>
                        <th>Remaining</th>
                        <th>Status</th>
                        <th>Applied</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workerLoans.map(l => (
                        <tr key={l.id}>
                          <td style={{ textTransform:'capitalize', fontWeight:500 }}>{l.type}</td>
                          <td style={{ fontWeight:600 }}>₹{parseFloat(l.total_amount).toLocaleString('en-IN')}</td>
                          <td>{parseFloat(l.monthly_deduction || 0) > 0 ? '₹' + parseFloat(l.monthly_deduction).toLocaleString('en-IN') + '/mo' : '—'}</td>
                          <td style={{ color:'var(--sage)' }}>
                            {l.total_deducted > 0 ? '₹' + l.total_deducted.toLocaleString('en-IN') : '—'}
                          </td>
                          <td style={{ color: parseFloat(l.remaining_amount || 0) > 0 ? 'var(--danger)' : 'var(--ink-soft)', fontWeight:600 }}>
                            {parseFloat(l.remaining_amount || 0) > 0 ? '₹' + parseFloat(l.remaining_amount).toLocaleString('en-IN') : '—'}
                          </td>
                          <td>
                            <span className={`pill ${l.status === 'active' || l.status === 'approved' ? 'pill-green' : l.status === 'closed' ? 'pill-gray' : l.status === 'rejected' ? 'pill-danger' : 'pill-gold'}`}>
                              {l.status.charAt(0).toUpperCase() + l.status.slice(1)}
                            </span>
                          </td>
                          <td style={{ color:'var(--ink-soft)' }}>
                            {new Date(l.applied_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {editingRecord && (
        <div className="modal-overlay" onClick={closeEdit}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Edit Attendance</h3>
              <button className="btn btn-sm" onClick={closeEdit}>&times;</button>
            </div>
            <div className="modal-body">
              <label className="field">
                <span>Worker</span>
                <input type="text" value={data?.name || ''} disabled />
              </label>
              <label className="field">
                <span>Date</span>
                <input type="text" value={editingRecord.date} disabled />
              </label>
              <label className="field">
                <span>Punch In Time</span>
                <input type="time" value={editPunchIn} onChange={e => setEditPunchIn(e.target.value)} />
              </label>
              <label className="field">
                <span>Punch Out Time</span>
                <input type="time" value={editPunchOut} onChange={e => setEditPunchOut(e.target.value)} />
              </label>
              <label className="field">
                <span>Status</span>
                <select value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                  <option value="leave">Leave</option>
                </select>
              </label>
            </div>
            <div className="modal-foot">
              <button className="btn btn-danger" onClick={async () => {
                if (!confirm('Delete this attendance record? The worker will need to punch in again.')) return;
                try {
                  const res = await fetch(API_BASE + '/attendance/' + editingRecord.id, {
                    method: 'DELETE',
                    headers: { Authorization: 'Bearer ' + localStorage.getItem('ucs_token') },
                  });
                  if (!res.ok) throw new Error('Delete failed');
                  fetchAttendance().then(setAttendance).catch(() => {});
                  closeEdit();
                } catch (err) {
                  alert(err.message);
                }
              }} style={{ marginRight:'auto', background:'var(--danger)', color:'#fff', border:'none' }}>
                <Trash width={14} style={{ marginRight:6, verticalAlign:'middle' }} />Delete
              </button>
              <button className="btn" onClick={closeEdit}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={editLoading}>
                {editLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, value }) {
  return (
    <div className="detail-field">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value || '\u2014'}</span>
    </div>
  );
}

function EditField({ label, value, onChange, type }) {
  return (
    <div className="detail-field">
      <span className="detail-label">{label}</span>
      <input type={type || 'text'} value={value} onChange={onChange}
        style={{ border:'1px solid var(--line)', borderRadius:'var(--radius-sm)', padding:'6px 10px', fontSize:13, width:'100%' }} />
    </div>
  );
}

function SideField({ label, value }) {
  return (
    <div className="side-field">
      <span className="side-label">{label}</span>
      <span className="side-value">{value}</span>
    </div>
  );
}

function SideFieldChk({ label, checked, onChange }) {
  return (
    <div className="side-field">
      <span className="side-label">{label}</span>
      <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
        <input type="checkbox" checked={checked} onChange={onChange} />
        {checked ? 'Active' : 'Inactive'}
      </label>
    </div>
  );
}

function DocLink({ url, label }) {
  return (
    <a className="doc-link" href={url} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}

function StatusPill({ status }) {
  const s = (status || '').toLowerCase();
  const cls = s === 'present' || s === 'approved' ? 'pill-green'
    : s === 'late' ? 'pill-gold'
    : s === 'absent' || s === 'rejected' ? 'pill-danger'
    : s === 'pending' ? 'pill-gold'
    : s === 'leave' ? 'pill-gray'
    : 'pill-gray';
  return <span className={`pill ${cls}`}>{status}</span>;
}

function AttendanceChart({ records }) {
  const present = records.filter(r => r.status === 'present').length;
  const late = records.filter(r => r.status === 'late').length;
  const absent = records.filter(r => r.status === 'absent').length;
  const leave = records.filter(r => r.status === 'leave' || r.status === 'Leave').length;
  const total = present + late + absent + leave;
  if (!total) return null;

  const segments = [
    { label:'Present', count:present, color:'var(--sage)' },
    { label:'Late', count:late, color:'var(--gold)' },
    { label:'Absent', count:absent, color:'var(--clay)' },
    { label:'Leave', count:leave, color:'#8b5cf6' },
  ].filter(s => s.count > 0);

  const r = 40;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="att-chart">
      <svg width="140" height="140" viewBox="0 0 120 120">
        {segments.map((s, i) => {
          const pct = s.count / total;
          const dash = pct * circ;
          const segOffset = -offset;
          offset += dash;
          return (
            <circle key={s.label}
              cx="60" cy="60" r={r} fill="none"
              stroke={s.color} strokeWidth="16"
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={segOffset}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
              style={{ transition:'stroke-dasharray 0.6s ease' }}
            />
          );
        })}
        <text x="60" y="54" textAnchor="middle" fill="var(--ink)"
          fontSize="22" fontWeight="700">{total}</text>
        <text x="60" y="70" textAnchor="middle" fill="var(--ink-soft)"
          fontSize="10">total</text>
      </svg>
      <div className="att-legend">
        {segments.map(s => (
          <div key={s.label} className="att-legend-item">
            <span className="att-dot" style={{ background:s.color }} />
            <span className="att-lbl">{s.label}</span>
            <span className="att-cnt">{s.count}</span>
            <span className="att-pct">{Math.round(s.count / total * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Box({ num, label, color, big }) {
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      background: color + '15',
      border: '2px solid ' + color,
      borderRadius: 10,
      padding: big ? '10px 18px' : '8px 14px',
      minWidth: big ? 100 : 70,
    }}>
      <span style={{ fontSize: big ? 24 : 18, fontWeight:700, color, lineHeight:1.2 }}>{num}</span>
      <span style={{ fontSize:10, color:'var(--ink-soft)', textAlign:'center', whiteSpace:'pre-line', lineHeight:1.3 }}>{label}</span>
    </div>
  );
}

function Arrow() {
  return <span style={{ fontSize:20, color:'var(--ink-soft)', fontWeight:300 }}>→</span>;
}

function Equals() {
  return <span style={{ fontSize:20, color:'var(--ink-soft)', fontWeight:300 }}>=</span>;
}

function Times() {
  return <span style={{ fontSize:18, color:'var(--ink-soft)', fontWeight:300 }}>×</span>;
}

function SkeletonDetail({ onBack }) {
  return (
    <>
      <div className="sk" style={{ width:160, height:18, marginBottom:16, borderRadius:6 }} />
      <div className="detail-split">
        <div className="card detail-sidebar" style={{ padding:'24px 20px' }}>
          <div style={{ textAlign:'center' }}>
            <div className="sk" style={{ width:80, height:80, borderRadius:20, margin:'0 auto' }} />
            <div className="sk" style={{ width:'60%', height:16, margin:'12px auto 6px', borderRadius:6 }} />
            <div className="sk" style={{ width:'40%', height:12, margin:'0 auto', borderRadius:6 }} />
          </div>
          <div style={{ marginTop:20, display:'flex', flexDirection:'column', gap:12 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="sk" style={{ width:'100%', height:14, borderRadius:4 }} />
            ))}
          </div>
        </div>
        <div className="detail-main">
          <div className="sk" style={{ width:300, height:32, marginBottom:16, borderRadius:8 }} />
          <div className="card">
            <div className="card-head"><div className="sk" style={{ width:120, height:16, borderRadius:6 }} /></div>
            <div className="detail-grid">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="detail-field">
                  <div className="sk" style={{ width:'40%', height:10, marginBottom:4, borderRadius:4 }} />
                  <div className="sk" style={{ width:'70%', height:14, borderRadius:4 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
