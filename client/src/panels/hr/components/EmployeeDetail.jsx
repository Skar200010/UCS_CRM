import { useState, useEffect, useRef, useContext } from 'react';
import { useHR, avatarColor, avatarTint, initials, DEPTS } from '../store';
import { UcsContext } from '../../../store';
import { deptLabel, DOC_OPTIONS, OTHER_DOC } from '../../../lib/labels';
import { parseDocumentsValue, joinDocumentLabels } from '../../../lib/documents';
import { useTeams } from '../../../components/useTeams';
import { useSalaryPrivacy } from '../../../context/SalaryPrivacyContext';
import { api } from '../../../api/auth';
import usePasteImage from '../../../utils/usePasteImage';
import { ArrowLeft, ArrowRight, Pencil, Trash } from '../icons';
import { Dropdown, DatePicker } from './ui';
import { API_BASE } from '../../../lib/apiBase';
import { safeImgSrc, signatureSourceLabel, signatureStatusPill } from '../signatureUtils';
import { isVoluntarySunday, newSundayRulesMonth } from '../../../lib/sundayRules';
import { lateThresholds, calcLateDeductionDays } from '../../../lib/latePolicy';
import EmployeeOverview from './employeeOverview/EmployeeOverview';

const IST_OFFSET = 5.5 * 60 * 60 * 1000;
// 'YYYY-MM' -> 'Oct 2026' for profile-card month labels.
const monthShortLabel = (monthKey) => {
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [y, m] = String(monthKey || '').split('-');
  return m ? `${M[Number(m) - 1]} ${y}` : '';
};

// DOC_OPTIONS now lives in lib/labels so the ODAR form shares the same list.

function fmtTime(iso) {
  if (!iso) return '\u2014';
  const d = new Date(new Date(iso).getTime() + IST_OFFSET);
  const h24 = d.getUTCHours();
  const h = h24 % 12 || 12;
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ap = h24 < 12 ? 'AM' : 'PM';
  return `${h}:${mm} ${ap}`;
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

export default function EmployeeDetail({ worker, onBack, onOffboard, accountsMode = false }) {
  const { teams: teamOptions } = useTeams();
  const { isSalaryUnlocked, promptUnlock, lockSalary, formatSalary, maskSalary } = useSalaryPrivacy();
  const { fetchWorkerById, fetchAttendance, fetchLeaves, fetchWorkerLetters, updateWorker, fetchWorkerSalaries, addWorkerSalary, updateWorkerSalary, fetchWorkerTargetForMonth, updateWorkerTarget, setAchievement, fetchWorkerAchievements, fetchIncentiveSummary, fetchWorkerAllocations, fetchWorkerSalaryAllocations, setWorkerAllocations, DEPTS, fetchNGOs, fetchHolidays, fetchWorkerLoans, fetchWorkerPeopleAllocations, saveWorkerPeopleAllocations, fetchWorkerSalaryAlloc, saveWorkerSalaryAlloc, generateWorkerSalaryAlloc, fetchSalaryHold, setSalaryHold, releaseSalaryHold, fetchWorkerAbsenceGrace, fetchLateRollback } = useHR();
  const { user: currentUser } = useContext(UcsContext);
  const isAccounts = currentUser?.role === 'accounts' || currentUser?.role === 'super_admin';
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
  const [salaries, setSalaries] = useState([]);
  const [perfHistory, setPerfHistory] = useState(undefined); // accounts mode: imported months
  const [salaryForm, setSalaryForm] = useState(() => {
  const now = new Date();
  return { salary: '', from_month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` };
});
  const [salarySubmitting, setSalarySubmitting] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [salaryNgoCount, setSalaryNgoCount] = useState(1);
  const [salaryNgo1, setSalaryNgo1] = useState('');
  const [salaryNgo2, setSalaryNgo2] = useState('');
  const [extraEditing, setExtraEditing] = useState(false);
  const [extraVal, setExtraVal] = useState('');
  const [extraSaving, setExtraSaving] = useState(false);
  const [viewingMonthKey, setViewingMonthKey] = useState(null);
  const [salaryHold, setSalaryHoldData] = useState(null);
  const [absenceGrace, setAbsenceGrace] = useState({}); // monthKey -> graceForfeited
  const [lateRollback, setLateRollback] = useState({}); // monthKey -> waivedMinutes
  const [holdBusy, setHoldBusy] = useState(false);
  const [docsBusy, setDocsBusy] = useState(false);
  const [docModal, setDocModal] = useState(false);
  // Accounts profile card: current-month collection/target from the overview
  // endpoint (salary comes from the already-loaded salary rows).
  const [monthStats, setMonthStats] = useState(null);
  const [docValue, setDocValue] = useState([]);
  const [docOther, setDocOther] = useState('');
  const [holdModal, setHoldModal] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [currentTarget, setCurrentTarget] = useState(null);
  const [targetEditing, setTargetEditing] = useState(false);
  const [targetEditVal, setTargetEditVal] = useState('');
  const [targetSaving, setTargetSaving] = useState(false);
  const [workerAchs, setWorkerAchs] = useState([]);
  const [incSummary, setIncSummary] = useState(null);
  const [achForm, setAchForm] = useState({});
  const [achSaving, setAchSaving] = useState({});
  const [allocations, setAllocations] = useState([]);
  // One place for "add a salary row effective from month X", used by both
  // branches of the Add Salary form. It handles inserting BEFORE the current
  // salary (that is how a deleted month like October is put back) as well as
  // after it, and closes the neighbouring row so ranges never overlap.
  const submitSalary = async () => {
    if (!salaryForm.salary || !salaryForm.from_month) return;
    setSalarySubmitting(true);
    try {
      const from_month = `${salaryForm.from_month}-01`;
      const prevMonthOf = (ymd) => {
        const d = new Date(ymd);
        d.setDate(0);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      };

      const asc = [...salaries].sort((a, b) => String(a.from_month).localeCompare(String(b.from_month)));
      const next = asc.find(s => String(s.from_month) > from_month);
      const prev = [...asc].reverse().find(s => String(s.from_month) < from_month);
      const to_month = next ? prevMonthOf(next.from_month) : null;

      // Close the row this one supersedes — BEFORE inserting, because the API
      // rejects a month that still falls inside an existing open range.
      if (prev && (!prev.to_month || String(prev.to_month) > prevMonthOf(from_month))) {
        const closeAt = prevMonthOf(from_month);
        await updateWorkerSalary(prev.id, { to_month: closeAt });
        setSalaries(p => p.map(x => (x.id === prev.id ? { ...x, to_month: closeAt } : x)));
      }

      const res = await addWorkerSalary({
        worker_id: worker.id,
        salary: parseFloat(salaryForm.salary),
        from_month,
        to_month,
      });
      setSalaries(p => [...p, res.record]);

      // Keep an existing NGO split proportional when the new row replaces the
      // current salary. The split itself is edited on the NGO allocation screen.
      const oldSalNum = prev ? parseFloat(prev.salary) : 0;
      const newSalNum = parseFloat(salaryForm.salary);
      if (!next && allocations.length > 0 && oldSalNum > 0) {
        const scaled = allocations.map(a => ({
          ngo_id: a.ngo_id,
          salary_portion: Math.round(parseFloat(a.salary_portion) * (newSalNum / oldSalNum)),
        }));
        await setWorkerAllocations(worker.id, scaled, newSalNum);
        setAllocations(scaled);
      }

      const now = new Date();
      setSalaryForm({ salary: '', from_month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` });
    } catch (e) {
      alert(e.message);
    } finally {
      setSalarySubmitting(false);
    }
  };
  const [editNgoAllocations, setEditNgoAllocations] = useState([]);
  const [peopleAllocs, setPeopleAllocs] = useState([]);
  const [peopleForm, setPeopleForm] = useState([]);
  const [editingPeople, setEditingPeople] = useState(false);
  const [peopleSaving, setPeopleSaving] = useState(false);
  const [salaryAllocMonth, setSalaryAllocMonth] = useState(null);
  const [salaryAllocs, setSalaryAllocs] = useState([]);
  const [salarySplitForm, setSalarySplitForm] = useState([]);
  const [editingSalary, setEditingSalary] = useState(false);
  const [salarySaving, setSalarySaving] = useState(false);
  const [generatingSalary, setGeneratingSalary] = useState(false);
  const [allocMsg, setAllocMsg] = useState('');
  const [sundayBonus, setSundayBonus] = useState(null);
  const [workerLoans, setWorkerLoans] = useState([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef(null);

  const uploadPhotoBase64 = async (base64, mime_type) => {
    setPhotoUploading(true);
    try {
      const res = await api(`/onboarding/admin/upload-photo/${worker.id}`, {
        method: 'POST',
        body: JSON.stringify({ photo_base64: base64, mime_type }),
        _prefix: 'ucs',
      });
      if (res.photo_url) {
        setData(prev => prev ? { ...prev, photo_url: res.photo_url } : prev);
        setImgErr(false);
      }
    } finally {
      setPhotoUploading(false);
    }
  };

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => uploadPhotoBase64(reader.result.split(',')[1], file.type);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handlePhotoPaste = usePasteImage(({ base64, mime }) => {
    uploadPhotoBase64(base64, mime);
  });

  // Admin signature upload. HR uses this when the volunteer cannot sign again
  // (or hands over a scanned image): the endpoint deliberately bypasses the
  // worker-side lock and stamps the record as signed, source "admin".
  const [sigUploading, setSigUploading] = useState(false);
  const sigInputRef = useRef(null);

  const uploadSignatureBase64 = async (base64, mime_type) => {
    setSigUploading(true);
    try {
      const res = await api(`/onboarding/admin/upload-signature/${worker.id}`, {
        method: 'POST',
        body: JSON.stringify({ signature_base64: base64, mime_type }),
        _prefix: 'ucs',
      });
      if (res.signature_url) {
        setData(prev => prev ? {
          ...prev,
          signature_url: res.signature_url,
          signature_status: res.signature_status || 'signed',
          signature_signed_at: new Date().toISOString(),
          signature_source: 'admin',
        } : prev);
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setSigUploading(false);
    }
  };

  const handleSigSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file (PNG or JPG).');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => uploadSignatureBase64(String(reader.result).split(',')[1], file.type);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  useEffect(() => {
    setLoading(true);
    let cancelled = false;
    Promise.all([
      fetchWorkerById(worker.id).catch((err) => { console.error('Error:', err.message); }),
      fetchWorkerLetters(worker.id).catch((err) => { console.error('Error:', err.message); return []; }),
      fetchWorkerSalaries(worker.id).catch(() => []),
      fetchWorkerAllocations(worker.id).catch(() => []),
      fetchWorkerLoans(worker.id).catch(() => []),
      fetchWorkerPeopleAllocations(worker.id).catch(() => []),
    ]).then(([d, l, s, a, wl, pAllocs]) => {
      if (cancelled) return;
      setData(d);
      setLetters(l || []);
      setSalaries(s || []);
      setAllocations(a || []);
      setWorkerLoans(wl || []);
      setPeopleAllocs(pAllocs || []);
      setLoading(false);

      if (d?.department === 'FRO') {
        const now = new Date();
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        fetchWorkerTargetForMonth(worker.id, month)
          .then(t => setCurrentTarget(t?.target_amount || null))
          .catch((err) => { console.error('API error:', err.message); });
        fetchWorkerAchievements(worker.id, month)
          .then(a => setWorkerAchs(Array.isArray(a) ? a : []))
          .catch((err) => { console.error('API error:', err.message); });
        fetchIncentiveSummary(worker.id, month)
          .then(s => setIncSummary(s?.hasIncentive ? s : null))
          .catch((err) => { console.error('API error:', err.message); });
      }
    });
    fetchAttendance().then(setAttendance).catch((err) => { console.error('API error:', err.message); });
    fetchLeaves().then(setLeaves).catch((err) => { console.error('API error:', err.message); });
    fetchNGOs().then(setNgos).catch((err) => { console.error('API error:', err.message); });
    fetchHolidays().then(setHolidays).catch((err) => { console.error('API error:', err.message); });
    const nowM = new Date();
    const curMonth = `${nowM.getFullYear()}-${String(nowM.getMonth() + 1).padStart(2, '0')}-01`;
    setSalaryAllocMonth(curMonth);
    fetchWorkerSalaryAlloc(worker.id, curMonth)
      .then(r => setSalaryAllocs(r?.allocations || []))
      .catch((err) => { console.error('API error:', err.message); });
    return () => { cancelled = true; };
  }, [worker.id]);

  // Accounts profile card — this month's collection + target (IST month).
  // Salary for the month comes from salary_history already in `salaries`.
  useEffect(() => {
    if (!accountsMode || !worker.id) return
    let cancelled = false
    const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
    const from = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
    const to = now.toISOString().slice(0, 10)
    api(`/accounts/workers/${worker.id}/overview?from=${from}&to=${to}`, { _prefix: 'ucs' })
      .then(ov => { if (!cancelled) setMonthStats(ov) })
      .catch(() => { if (!cancelled) setMonthStats(false) }) // false = failed → '—'
    return () => { cancelled = true }
  }, [accountsMode, worker.id])

  // Imported monthly history (History Import) — worker-scoped, no range filter.
  // undefined = loading, null = nothing imported. Feeds the Overview's Monthly
  // Performance targets/salary AND the Salary tab's imported salary rows.
  useEffect(() => {
    if (!accountsMode || !worker.id) return
    let cancelled = false
    setPerfHistory(undefined)
    api(`/accounts/workers/${worker.id}/performance-history`, { _prefix: 'ucs' })
      .then(d => { if (!cancelled) setPerfHistory(d?.rows?.length ? d : null) })
      .catch(() => { if (!cancelled) setPerfHistory(null) })
    return () => { cancelled = true }
  }, [accountsMode, worker.id])

  // Accounts → Overview analytics is FRO-only; other departments land on
  // Attendance once their record loads. HR keeps Overview for everyone.
  useEffect(() => {
    if (accountsMode && tab === 'overview' && data && data.department !== 'FRO') setTab('attendance');
  }, [accountsMode, tab, data]);

  // Fetch Sunday pay + incentive data whenever the viewing month changes
  useEffect(() => {
    if (data) {
      const monthKey = viewingMonthKey || defaultMonthKey;
      const month = monthKey + '-01';
      fetchWorkerSalaryAllocations(worker.id, month)
        .then(r => setSundayBonus(r?.sundayBonus || null))
        .catch((err) => { console.error('API error:', err.message); });
      if (data.department === 'FRO') {
        fetchWorkerTargetForMonth(worker.id, month)
          .then(t => setCurrentTarget(t?.target_amount || null))
          .catch((err) => { console.error('API error:', err.message); });
        fetchWorkerAchievements(worker.id, month)
          .then(a => setWorkerAchs(Array.isArray(a) ? a : []))
          .catch((err) => { console.error('API error:', err.message); });
        fetchIncentiveSummary(worker.id, month)
          .then(s => setIncSummary(s?.hasIncentive ? s : null))
          .catch((err) => { console.error('API error:', err.message); });
      }
      fetchSalaryHold(worker.id, monthKey)
        .then(h => setSalaryHoldData({ held: !!h?.held, reason: h?.reason || '', held_at: h?.held_at || null }))
        .catch((err) => { console.error('API error:', err.message); setSalaryHoldData({ held:false, reason:'', held_at:null }); });
      // Grace-forfeiture state (unauthorized absence) feeds the late-deduction
      // mirror — same Option A single-budget formula the payroll engine uses.
      fetchWorkerAbsenceGrace(worker.id, monthKey)
        .then(g => setAbsenceGrace(prev => ({ ...prev, [monthKey]: !!g?.graceForfeited })))
        .catch(() => setAbsenceGrace(prev => ({ ...prev, [monthKey]: false })));
      // Admin grace rollback (salary_late_rollbacks). Fetch the stored waiver so
      // the mirror below matches what payroll will actually deduct.
      fetchLateRollback(worker.id, monthKey)
        .then(r => setLateRollback(prev => ({ ...prev, [monthKey]: Number(r?.waivedMinutes) || 0 })))
        .catch(() => setLateRollback(prev => ({ ...prev, [monthKey]: 0 })));
      if (prevMonthKey && prevMonthKey !== monthKey) {
        fetchWorkerAbsenceGrace(worker.id, prevMonthKey)
          .then(g => setAbsenceGrace(prev => ({ ...prev, [prevMonthKey]: !!g?.graceForfeited })))
          .catch(() => setAbsenceGrace(prev => ({ ...prev, [prevMonthKey]: false })));
        fetchLateRollback(worker.id, prevMonthKey)
          .then(r => setLateRollback(prev => ({ ...prev, [prevMonthKey]: Number(r?.waivedMinutes) || 0 })))
          .catch(() => setLateRollback(prev => ({ ...prev, [prevMonthKey]: 0 })));
      }
    }
  }, [viewingMonthKey, worker.id, data?.department]);

  // Downloads the backend-rendered Word report for the month being viewed.
  // The report figures come from the payroll paid-day engine on the server, not
  // from the client-side calculator below, so they match the Salary File export.
  const handlerDownloadReport = async () => {
    if (!worker?.id || reportBusy) return;
    setReportBusy(true);
    try {
      const res = await api(`/salary/worker/${worker.id}/attendance-report?month=${encodeURIComponent(effectiveMonthKey)}`, { _prefix: 'ucs', raw: true });
      const blob = await res.blob();
      const name = (data?.name || 'volunteer').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${name || 'volunteer'}-attendance-deduction-${effectiveMonthKey}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (e) {
      alert(e.message || 'Could not generate the report.');
    } finally {
      setReportBusy(false);
    }
  };

  const handlerHoldSalary = async () => {
    setHoldBusy(true);
    try {
      await setSalaryHold(worker.id, effectiveMonthKey, holdReason.trim());
      const h = await fetchSalaryHold(worker.id, effectiveMonthKey);
      setSalaryHoldData({ held: !!h?.held, reason: h?.reason || '', held_at: h?.held_at || null });
      setHoldModal(false);
      setHoldReason('');
    } catch (e) {
      alert(e.message);
    } finally {
      setHoldBusy(false);
    }
  };

  const handlerReleaseSalary = async () => {
    if (!window.confirm(`Release salary for ${effectiveMonthKey}? The worker will move back to Released.`)) return;
    setHoldBusy(true);
    try {
      await releaseSalaryHold(worker.id, effectiveMonthKey);
      setSalaryHoldData({ held: false, reason: '', held_at: null });
    } catch (e) {
      alert(e.message);
    } finally {
      setHoldBusy(false);
    }
  };

  // documents_value may be a JSON array (current) or a legacy single value, so
  // it is always parsed rather than read directly.
  const openDocsModal = () => {
    const parsed = parseDocumentsValue(data.documents_value, data.documents_other);
    setDocValue(parsed.selected);
    setDocOther(parsed.otherText);
    setDocModal(true);
  };

  const saveDocs = async () => {
    setDocsBusy(true);
    try {
      await updateWorker(worker.id, {
        documents_value: JSON.stringify(docValue),
        // Untick clears the name, matching the ODAR form and the backend.
        documents_other: docValue.includes(OTHER_DOC) ? docOther : '',
      });
      const fresh = await fetchWorkerById(worker.id);
      setData(fresh);
      setDocModal(false);
    } catch (e) {
      alert(e.message);
    } finally {
      setDocsBusy(false);
    }
  };

  const startEdit = () => {
    setForm({
      name: data.name || '',
      email: data.email || '',
      gender: data.gender || '',
      dob: data.dob || '',
      phone: data.phone || '',
      alternate_phone: data.alternate_phone || '',
      department: data.department || '',
      team: (data.team || ''),
      ngo_id: data.ngo_id || '',
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      pincode: data.pincode || '',
      permanent_address: data.permanent_address || '',
      father_husband_name: data.father_husband_name || '',
      marital_status: data.marital_status || '',
      pan_number: data.pan_number || '',
      aadhar_number: data.aadhar_number || '',
      created_at: data.created_at ? new Date(data.created_at).toLocaleDateString('en-CA') : '',
      is_active: data.is_active !== false,
      account_holder_name: data.account_holder_name || '',
      bank_name: data.bank_name || '',
      ifsc_code: data.ifsc_code || '',
      account_number: data.account_number || '',
      correspondence_address: data.correspondence?.address || '',
      correspondence_city: data.correspondence?.city || '',
      correspondence_state: data.correspondence?.state || '',
      correspondence_pincode: data.correspondence?.pincode || '',
    });
    setEditNgoAllocations(allocations.map(a => a.ngo_id));
    setEditing(true);
    setErr('');
  };

  const cancelEdit = () => { setEditing(false); setErr(''); setEditNgoAllocations([]); };

  const save = async () => {
    setSaving(true); setErr('');
    try {
      const payload = { ...form };
      if (!payload.dob) payload.dob = null;
      if (!payload.created_at) delete payload.created_at;
      else payload.created_at = payload.created_at + 'T00:00:00.000Z';
      payload.correspondence = {
        address: payload.correspondence_address || '',
        city: payload.correspondence_city || '',
        state: payload.correspondence_state || '',
        pincode: payload.correspondence_pincode || '',
      };
      delete payload.correspondence_address;
      delete payload.correspondence_city;
      delete payload.correspondence_state;
      delete payload.correspondence_pincode;
      await updateWorker(worker.id, payload);
      if (form.department === 'NGO Admin' && editNgoAllocations.length > 0) {
        try {
          await setWorkerAllocations(worker.id, editNgoAllocations.map(id => ({ ngo_id: id, salary_portion: 0 })), 0);
        } catch (e) { console.error('Error:', e.message); }
      }
      const fresh = await fetchWorkerById(worker.id);
      setData(fresh); setEditing(false); setEditNgoAllocations([]);
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
  if (!data) return <div className="empty">Volunteer not found.</div>;

  const color = avatarColor(data.name);

  // 'signed' | 'draft' | null — the same normalisation the panel uses elsewhere,
  // so a signature captured before migration 159 (status NULL) is not shown as
  // a draft that still needs submitting.
  const sigState = data.signature_url
    ? ((data.signature_status || 'signed') === 'signed' ? 'signed' : 'draft')
    : null;
  const sigStatus = signatureStatusPill(data);

  const empAttendance = attendance.filter(a => a.worker_id === worker.id);
  const filteredAttendance = empAttendance;

  const empLeaves = leaves.filter(l => l.worker_id === worker.id);

  const ngoName = ngos.find(n => n.id === data.ngo_id)?.name || 'NA';

  // Salary History card (accounts mode only): monthly salaries imported via
  // History Import, listed read-only under the salary_history records so both
  // sources are visible side by side. HR mode never fetches perfHistory, so
  // this list stays empty there and the card is unchanged.
  const importedSalaryRows = ((accountsMode && perfHistory?.rows) || [])
    .filter((r) => r.salary != null);

  // Accounts' section keeps a lean tab strip: Overview (analytics — FRO
  // employees only), Attendance, Salary — no Leaves or Settings. Bank Details
  // stays pinned at the top of the page instead (below). Loans & Advances
  // lives on its own full page in the Salary & Advances strip
  // (/accounts/volunteers/loans).
  const isFroDept = (data?.department || worker?.department) === 'FRO';
  const TABS = accountsMode
    ? [
        ...(isFroDept ? [{ key: 'overview', label: 'Overview' }] : []),
        { key: 'attendance', label: 'Attendance' },
        { key: 'salary', label: 'Salary' },
      ]
    : [
        { key: 'overview', label: 'Overview' },
        { key: 'attendance', label: 'Attendance' },
        { key: 'salary', label: 'Salary' },
        { key: 'leaves', label: 'Leaves' },
        { key: 'loans', label: 'Loans & Advances' },
        { key: 'settings', label: 'Settings' },
      ];

  // Lives outside the Overview tab so Accounts can show it pinned at the top of
  // the page; HR still renders it inside Overview exactly where it was.
  const bankDetailsCard = (
    <div className="card" style={{ marginBottom:16 }}>
      <div className="card-head"><h3>Bank Details</h3></div>
      <div className="detail-grid">
        {editing ? <EditField label="Account Holder" value={form.account_holder_name} onChange={setField('account_holder_name')} /> : <Field label="Account Holder" value={data.account_holder_name} />}
        {editing ? <EditField label="Bank Name" value={form.bank_name} onChange={setField('bank_name')} /> : <Field label="Bank Name" value={data.bank_name} />}
        {editing ? <EditField label="IFSC Code" value={form.ifsc_code} onChange={setField('ifsc_code')} /> : <Field label="IFSC Code" value={data.ifsc_code} />}
        {editing ? <EditField label="Account Number" value={form.account_number} onChange={setField('account_number')} /> : <Field label="Account Number" value={data.account_number} />}
      </div>
    </div>
  );

  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET);
  const defaultMonthKey = `${istNow.getUTCFullYear()}-${String(istNow.getUTCMonth() + 1).padStart(2, '0')}`;
  const sortedSalaries = [...salaries].sort((a, b) => (b.from_month || '').localeCompare(a.from_month || ''));

  const effectiveMonthKey = viewingMonthKey || defaultMonthKey;
  const [yr, mo] = effectiveMonthKey.split('-').map(Number);
  const monthKey = effectiveMonthKey;
  const holidayDates = new Set(
    holidays.filter(h => h.date?.startsWith(monthKey)).map(h => h.date)
  );
  const daysInMonth = new Date(yr, mo, 0).getDate();

  // IST today for current-month cutoff
  const isCurrentMonth = (yr === istNow.getUTCFullYear() && mo === (istNow.getUTCMonth() + 1));
  const viewingToday = isCurrentMonth ? istNow.getUTCDate() : daysInMonth + 1;

  // Salary covering the viewing month
  const activeSalary = sortedSalaries.find(s =>
    (s.from_month || '').slice(0, 7) <= effectiveMonthKey &&
    (!s.to_month || s.to_month.slice(0, 7) >= effectiveMonthKey)
  ) || sortedSalaries[0] || null;
  const salaryPaid = activeSalary?.paid_at;

  const monthAttendance = empAttendance.filter(a => a.date && a.date.startsWith(monthKey));
  const noAttendanceData = monthAttendance.length === 0;

  // From SUNDAY_RULES_FROM a Sunday is voluntary: the backend writes those rows
  // as plain present days with no late minutes, so the pay maths below reads
  // them through payAttendance (which normalises any stray late/half-day row).
  const useNewSundayRules = newSundayRulesMonth(yr, mo);
  const payAttendance = useNewSundayRules
    ? monthAttendance.map(a =>
        isVoluntarySunday(a.date) && ['present', 'late', 'half-day'].includes(a.status)
          ? { ...a, status: 'present', late_minutes: 0 }
          : a)
    : monthAttendance;

  const joinDate = new Date(data.created_at);
  const joinMonth = `${joinDate.getFullYear()}-${String(joinDate.getMonth() + 1).padStart(2, '0')}`;
  const joinedThisMonth = joinMonth === monthKey;
  const joinDayNum = joinDate.getDate();
  const joinCutoff = (data.created_at || '').slice(0, 10);

  // Compute absent dates — days with no attendance or explicitly absent
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

  // New-joiner check: ≤ 3 months employed (IST)
  const istNowDate = new Date(Date.now() + IST_OFFSET);
  const monthsEmp = (istNowDate.getUTCFullYear() - joinDate.getFullYear()) * 12 + (istNowDate.getUTCMonth() - joinDate.getMonth());
  const monthsEmployed = (istNowDate.getUTCDate() >= joinDate.getDate()) ? monthsEmp + 1 : monthsEmp;

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

  const availableDays = isCurrentMonth
    ? Math.min(daysInMonth, viewingToday) - (joinedThisMonth ? joinDayNum - 1 : 0)
    : joinedThisMonth ? (daysInMonth - joinDayNum + 1) : daysInMonth;

  const monSatAbsences = absentDates.filter(d => {
    const dt = new Date(d);
    return dt.getDay() !== 0 && d >= joinCutoff;
  }).length;

  const extraSundays = [];
  if (monSatAbsences >= 6 || (joinedThisMonth && joinDayNum > 10)) {
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
    const att = payAttendance.find(a => a.date === dateStr);
    let status = att?.status || null;
    if (holidayDates.has(dateStr) && (!status || status === 'absent' || status === 'leave')) {
      status = 'holiday';
    } else if (!status && d <= viewingToday && dt.getDay() !== 0 && !(joinedThisMonth && dateStr < joinCutoff)) {
      status = 'absent';
    }
    return { date: dateStr, day: d, dayName, att, status };
  });

  const daysWorked = payAttendance.filter(a =>
    (a.status === 'present' || a.status === 'late') && (!joinedThisMonth || a.date >= joinCutoff)
  ).length;
  const presentDays = daysWorked;
  const halfDayCount = payAttendance.filter(a =>
    a.status === 'half-day' && (!joinedThisMonth || a.date >= joinCutoff)
  ).length;
  // A declared holiday is a paid day when the worker did not punch in. If the
  // worker did work that day, the present row above already counts it — never
  // double-count the same date.
  const holidayPaidDays = [...holidayDates].filter(dateStr => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    if (joinedThisMonth && dateStr < joinCutoff) return false;
    const dayNum = Number(dateStr.slice(8, 10));
    if (isCurrentMonth && dayNum > viewingToday) return false;
    // Sundays already have their own paid/free rule below.
    if (new Date(dateStr + 'T00:00:00Z').getUTCDay() === 0) return false;
    const att = monthAttendance.find(a => a.date === dateStr);
    return !att || att.status === 'absent' || att.status === 'leave';
  }).length;
  const sundayCount = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    if (joinedThisMonth && d < joinDayNum) return 0;
    if (isCurrentMonth && d > viewingToday) return 0;
    return new Date(yr, mo - 1, d).getDay() === 0 ? 1 : 0;
  }).reduce((a, b) => a + b, 0);
  const sundayDates = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const dateStr = `${yr}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (joinedThisMonth && dateStr < joinCutoff) return null;
    if (isCurrentMonth && d > viewingToday) return null;
    return new Date(yr, mo - 1, d).getDay() === 0 ? dateStr : null;
  }).filter(Boolean);
  const eligibleSundays = sundayDates.filter(d => !deducted.has(d));
  const attendedEligible = eligibleSundays.filter(d =>
    payAttendance.some(a => a.date === d && (a.status === 'present' || a.status === 'late'))
  );
  const attendedCancelledList = sundayDates.filter(d =>
    deducted.has(d) && payAttendance.some(a => a.date === d && (a.status === 'present' || a.status === 'late'))
  );
  const attendedAll = attendedEligible.length + attendedCancelledList.length;
  const eligibleNotWorked = eligibleSundays.length - attendedEligible.length;
  const cleanMonth = absentDates.length === 0 && !(joinedThisMonth && joinDayNum > 10);
  // New rules: every eligible Sunday is paid (worked or not) and there is no
  // (total − 1) cap — so "free" just means every eligible Sunday nobody worked.
  const freeCount = useNewSundayRules
    ? eligibleNotWorked
    : Math.max(0, Math.min(cleanMonth ? sundayCount : sundayCount - 1, eligibleNotWorked));
  const paidSundayCount = useNewSundayRules
    ? eligibleSundays.length
    : attendedAll + freeCount;
  const unpaidSundays = eligibleSundays
    .filter(d => !attendedEligible.includes(d))
    .slice(0, Math.max(0, eligibleNotWorked - freeCount));
  for (const d of unpaidSundays) deducted.add(d);
  let paidDays = noAttendanceData ? 0 : presentDays - attendedAll + (halfDayCount * 0.5) + paidSundayCount + holidayPaidDays;
  if (paidDays < 0) paidDays = 0;
  const JOINING_DEDUCTION = 1.5;
  const joiningDeduction = (joinedThisMonth && monthsEmployed <= 3) ? JOINING_DEDUCTION : 0;
  const perDay = activeSalary ? parseFloat(activeSalary.salary) / daysInMonth : 0;

  // Late-minutes-based deductions (per-person grace, proportional half/full)
  const lateGrace = data?.late_grace_minutes ?? null;
  const lateT = lateThresholds(lateGrace);
  const totalLateMinutes = payAttendance
    .filter(a => (!joinedThisMonth || a.date >= joinCutoff) && a.status !== 'half-day')
    .reduce((sum, a) => sum + (a.late_minutes || 0), 0);

  // An unauthorized absence forfeits the month's free grace (single budget with
  // the clawback — whichever arrives first spends it, never both).
  const graceForfeitedNow = !!absenceGrace[effectiveMonthKey];
  // Admin grace rollback: mirror the payroll engine exactly — the stored waiver
  // (capped at the late pool plus the charged grace) comes off before the ladder.
  const lateRollbackMinutes = Math.min(
    Math.max(0, Number(lateRollback[effectiveMonthKey]) || 0),
    totalLateMinutes + (graceForfeitedNow ? lateGrace : 0),
  );
  let lateDeductionDays = calcLateDeductionDays(
    Math.max(0, totalLateMinutes - lateRollbackMinutes),
    lateGrace,
    graceForfeitedNow,
  );
  let totalDue;
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

  // All months from a minimum of August to now (extends earlier if the
  // employee has a join date or salary history before that)
  const allMonthKeys = [];
  {
    let startY = now.getFullYear(), startM = 8;
    if (now.getMonth() + 1 < 8) startY -= 1;
    const firstOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
    const consider = (d) => {
      if (!d) return;
      const t = firstOfMonth(d).getTime();
      const st = new Date(startY, startM - 1, 1).getTime();
      if (t < st) { startY = d.getFullYear(); startM = d.getMonth() + 1; }
    };
    if (data?.created_at) consider(new Date(data.created_at));
    sortedSalaries.forEach(s => consider(new Date(s.from_month)));
    const ny = now.getFullYear(), nm = now.getMonth() + 1;
    let y = startY, m = startM;
    while (y < ny || (y === ny && m <= nm)) {
      allMonthKeys.push(`${y}-${String(m).padStart(2, '0')}`);
      m++; if (m > 12) { m = 1; y++; }
    }
  }

  // Previous month data for compact summary
  const prevMonthDate = new Date(yr, mo - 2, 1);
  const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const prevSalaryRec = sortedSalaries.find(s =>
    (s.from_month || '').slice(0, 7) <= prevMonthKey &&
    (!s.to_month || s.to_month.slice(0, 7) >= prevMonthKey)
  ) || (allMonthKeys.includes(prevMonthKey) ? activeSalary : null);
  let prevTotalDue = null;
  if (prevSalaryRec) {
    const pYr = parseInt(prevMonthKey.split('-')[0]);
    const pMo = parseInt(prevMonthKey.split('-')[1]);
    const pDays = new Date(pYr, pMo, 0).getDate();
    const pHolidays = new Set(holidays.filter(h => h.date?.startsWith(prevMonthKey)).map(h => h.date));
    const pAtt = empAttendance.filter(a => a.date?.startsWith(prevMonthKey));
    const pJoinMonth = `${new Date(data.created_at).getFullYear()}-${String(new Date(data.created_at).getMonth() + 1).padStart(2, '0')}`;
    const pJoined = pJoinMonth === prevMonthKey;
    const pJoinCutoff = (data.created_at || '').slice(0, 10);
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
    const pLateMins = pAtt
      .filter(a => (!pJoined || a.date >= pJoinCutoff) && !isVoluntarySunday(a.date) && a.status !== 'half-day')
      .reduce((s, a) => s + (a.late_minutes || 0), 0);
    const pGraceForfeited = !!absenceGrace[prevMonthKey];
    const pRollbackMinutes = Math.min(
      Math.max(0, Number(lateRollback[prevMonthKey]) || 0),
      pLateMins + (pGraceForfeited ? lateGrace : 0),
    );
    let pLateDays = calcLateDeductionDays(
      Math.max(0, pLateMins - pRollbackMinutes),
      lateGrace,
      pGraceForfeited,
    );
    const pPaid = Math.max(0, pAvailable - pDeducted.size);
    const pJoining = (pJoined && monthsEmployed <= 3) ? 1.5 : 0;
    prevTotalDue = pPerDay * Math.max(0, pPaid - pLateDays - pJoining);
  }

  const fmtMonthYear = (d) => d.toLocaleDateString('en-GB', { month:'long', year:'numeric' });

  return (
    <>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <button className="btn back-btn" onClick={onBack} style={{ marginBottom:0 }}><ArrowLeft width={16}/> Back to </button>
        {!editing ? (
          <div style={{ display:'flex', gap:4 }}>
            <button className="btn btn-icon" onClick={startEdit} title="Edit Volunteer"><Pencil width={16} /></button>
            <button className="btn btn-icon" onClick={handleDelete} title="Delete Volunteer" style={{ color:'var(--danger)' }}><Trash width={16} /></button>
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
        <div className="card detail-sidebar" style={{ position:'relative' }}>
          {/* Half-in / half-out lock toggle, pinned to the card's top-right
              corner: unlock asks for the salary access code, lock hides the
              numbers again. */}
          <button
            type="button"
            onClick={() => { if (isSalaryUnlocked) lockSalary(); else promptUnlock(); }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px) scale(1.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
            title={isSalaryUnlocked ? 'Hide salary figures' : 'Unlock salary figures'}
            aria-label={isSalaryUnlocked ? 'Hide salary figures' : 'Unlock salary figures'}
            style={{
              position:'absolute', top:-16, right:-16, width:38, height:38, borderRadius:'50%',
              border:'2px solid #fff',
              background: isSalaryUnlocked ? '#166534' : 'var(--sage, #5B6B4E)',
              color:'#fff',
              display:'grid', placeItems:'center', cursor:'pointer',
              boxShadow: isSalaryUnlocked
                ? '0 0 0 4px rgba(22,101,52,.16), 0 6px 16px rgba(15,23,42,.28)'
                : '0 0 0 4px rgba(91,107,78,.18), 0 6px 16px rgba(15,23,42,.28)',
              zIndex:3, transition:'transform .15s ease, box-shadow .15s ease',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              {isSalaryUnlocked
                ? <path d="M8 11V7a4 4 0 0 1 7.5-2" />
                : <path d="M8 11V7a4 4 0 0 1 8 0v4" />}
            </svg>
          </button>
          <div style={{ textAlign:'center', padding:'24px 0 12px', position:'relative' }}>
            <input ref={photoInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handlePhotoSelect} />
            <div onClick={() => editing && photoInputRef.current?.click()} onPaste={editing ? handlePhotoPaste : undefined} title={editing ? 'Click or paste (Ctrl+V) to change photo' : undefined} style={{ cursor: editing ? 'pointer' : 'default', display:'inline-block' }}>
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
            {photoUploading && <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', background:'rgba(0,0,0,0.5)', color:'#fff', borderRadius:20, padding:'4px 12px', fontSize:12 }}>Uploading...</div>}
            {editing && <div style={{ fontSize:11, color:'var(--ink-soft)', marginTop:4 }}>Click to change photo</div>}
            </div>
            {editing ? (
              <input value={form.name} onChange={setField('name')}
                style={{ marginTop:12, fontSize:16, fontWeight:600, textAlign:'center', border:'1px solid var(--line)', borderRadius:'var(--radius-sm)', padding:'6px 10px', width:'100%' }} />
            ) : (
              <h3 style={{ marginTop:12, fontSize:17, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                {data.name}
                {data.documents_submitted && (
                  <span title={`Documents submitted: ${joinDocumentLabels(parseDocumentsValue(data.documents_value, data.documents_other).selected, data.documents_other) || 'Yes'}`} style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:18, height:18, borderRadius:'50%', background:'#1a8d3a', flexShrink:0 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ display:'block' }}>
                      <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
              </h3>
            )}
            <div style={{ color:'var(--ink-soft)', fontSize:12, marginTop:6, display:'flex', gap:6, justifyContent:'center', flexWrap:'wrap', alignItems:'center' }}>
              {data.department && <span className="side-tag">{deptLabel(data.department)}</span>}
              <span className={'side-tag ' + (data.employment_status === 'absconded' ? 'side-tag-absconded' : data.employment_status === 'offboarded' ? 'side-tag-offboarded' : data.is_active ? 'side-tag-active' : 'side-tag-inactive')}
                style={data.employment_status === 'absconded' ? { background:'#fff3e0', color:'#e65100' } : data.employment_status === 'offboarded' ? { background:'#fce4ec', color:'#c62828' } : {}}>
                {data.employment_status === 'absconded' ? 'Absconded' : data.employment_status === 'offboarded' ? 'Offboarded' : data.is_active ? 'Active' : 'Inactive'}
              </span>
              <button
                type="button"
                onClick={openDocsModal}
                disabled={docsBusy}
                style={{ background:'none', border:'none', padding:0, cursor: docsBusy ? 'wait' : 'pointer', display:'inline-flex', alignItems:'center', gap:4 }}
                title={data.documents_submitted ? 'Documents submitted: ' + (data.documents_value || 'Yes') + ' — click to edit' : 'Select the document this volunteer has submitted'}
              >
                <span className="side-tag" style={{
                  background: data.documents_submitted ? '#1a8d3a' : '#e5e5e5',
                  color: data.documents_submitted ? '#fff' : '#9ca3af',
                  display:'inline-flex', alignItems:'center', gap:4, fontWeight:600,
                }}>
                  {docsBusy ? 'Saving…' : (data.documents_submitted ? 'Documents ✓' : 'Documents')}
                </span>
              </button>
            </div>
          </div>
          <div className="side-fields">
            {!accountsMode && <SideField label="Email" value={data.email} />}
            <SideField label="Phone" value={data.phone || '\u2014'} />
            {!accountsMode && <SideField label="Gender" value={data.gender || '\u2014'} />}
            {!accountsMode && <SideField label="Date of Birth" value={data.dob || '\u2014'} />}
            <SideField label="Joined" value={data.created_at ? new Date(data.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}) : '\u2014'} />
            {/* Resolved so the profile never shows a raw JSON array string. */}
            {!accountsMode && <SideField label="Documents Submitted" value={joinDocumentLabels(parseDocumentsValue(data.documents_value, data.documents_other).selected, data.documents_other) || '\u2014'} />}
            {accountsMode && (
              <div style={{ margin:'10px 0 4px', padding:'10px 12px', border:'1px solid var(--line)', borderRadius:'var(--radius-sm)', background:'var(--sand)' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--ink-soft)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:2 }}>
                  {monthShortLabel(defaultMonthKey)}
                </div>
                <SideField
                  label="Salary"
                  value={(() => {
                    const mSalary = sortedSalaries.find(s =>
                      (s.from_month || '').slice(0, 7) <= defaultMonthKey &&
                      (!s.to_month || s.to_month.slice(0, 7) >= defaultMonthKey));
                    return mSalary?.salary != null
                      ? (isSalaryUnlocked ? formatSalary(mSalary.salary) : maskSalary(mSalary.salary))
                      : '\u2014';
                  })()}
                />
                <SideField
                  label="Collection"
                  value={monthStats ? '₹' + Math.round(monthStats.collection?.amount || 0).toLocaleString('en-IN') : (monthStats === false ? '\u2014' : '…')}
                />
                <SideField
                  label="Target"
                  value={monthStats ? (monthStats.target?.amount > 0 ? '₹' + Math.round(monthStats.target.amount).toLocaleString('en-IN') : 'No target') : (monthStats === false ? '\u2014' : '…')}
                />
              </div>
            )}
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

          {tab === 'overview' && (!accountsMode || isFroDept) && (
            <div className="detail-cards-scroll">
              {accountsMode && (
                <div style={{ marginBottom:16 }}>
                  <EmployeeOverview workerId={worker.id} onOpenAttendance={() => setTab('attendance')} history={perfHistory} />
                </div>
              )}

              {/* Personal profile cards belong to HR's Overview; Accounts' Overview
                  is analytics-only (KPIs, chart, heatmap, timeline) — profile data
                  stays reachable via the header side fields and the Salary tab's
                  pinned Bank Details. */}
              {!accountsMode && (
              <>
              <div className="card" style={{ marginBottom:16 }}>
                <div className="card-head"><h3>Personal Details</h3></div>
                <div className="detail-grid">
                  {editing ? <EditField label="Email" value={form.email} onChange={setField('email')} /> : <Field label="Email" value={data.email} />}
                  <Field label="Login ID" value={data.login_id} />
                  {editing ? (
                    <div className="detail-field">
                      <span className="detail-label">Department</span>
                      <Dropdown value={form.department} onChange={setField('department')}
                        style={{ width:'100%' }} options={DEPTS.map(d => ({ value: d, label: deptLabel(d) }))} />
                    </div>
                  ) : <Field label="Department" value={deptLabel(data.department)} />}
                  {editing ? (
                    <div className="detail-field">
                      <span className="detail-label">Team</span>
                      <Dropdown value={form.team} onChange={setField('team')}
                        style={{ width:'100%' }}
                        options={[{value:'',label:'No Team'}, ...teamOptions.map(t => ({ value:t, label:t }))]} />
                    </div>
                  ) : <Field label="Team" value={data.team || 'No Team'} />}
                  {editing && form.department === 'NGO Admin' ? (
                    <div className="detail-field" style={{ gridColumn:'1 / -1' }}>
                      <span className="detail-label">NGOs</span>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>
                        {ngos.map(n => {
                          const active = editNgoAllocations.includes(n.id);
                          return (
                            <span key={n.id} onClick={() => setEditNgoAllocations(prev =>
                              prev.includes(n.id) ? prev.filter(id => id !== n.id) : [...prev, n.id]
                            )} style={{
                              padding:'4px 12px', borderRadius:20, fontSize:13, cursor:'pointer',
                              border:'1px solid var(--line)',
                              background: active ? '#5B6B4E' : 'var(--paper)',
                              color: active ? '#fff' : 'var(--ink)',
                              fontWeight: active ? 600 : 400,
                              userSelect:'none', transition:'all .15s',
                            }}>{n.name}</span>
                          );
                        })}
                      </div>
                    </div>
                  ) : editing ? (
                    <div className="detail-field">
                      <span className="detail-label">NGO</span>
                      <Dropdown value={form.ngo_id} onChange={setField('ngo_id')}
                        style={{ width:'100%' }}
                        options={[{value:'',label:'NA'}, ...ngos.map(n => ({value:n.id, label:n.name}))]} />
                    </div>
                  ) : <Field label="NGO" value={ngoName} />}
                  {editing ? <div className="detail-field"><span className="detail-label">Joining Date</span><DatePicker value={form.created_at} onChange={setField('created_at')} /></div> : <Field label="Joining Date" value={data.created_at ? new Date(data.created_at).toLocaleDateString() : '—'} />}
                  {editing ? <EditField label="Gender" value={form.gender} onChange={setField('gender')} /> : <Field label="Gender" value={data.gender} />}
                  {editing ? <div className="detail-field"><span className="detail-label">Date of Birth</span><DatePicker value={form.dob} onChange={setField('dob')} /></div> : <Field label="Date of Birth" value={data.dob} />}
                  {editing ? <EditField label="Phone" value={form.phone} onChange={setField('phone')} /> : <Field label="Phone" value={data.phone} />}
                  {editing ? <EditField label="Alternate Phone" value={form.alternate_phone} onChange={setField('alternate_phone')} /> : <Field label="Alternate Phone" value={data.alternate_phone} />}
                  {editing ? <EditField label="Father/Husband" value={form.father_husband_name} onChange={setField('father_husband_name')} /> : <Field label="Father/Husband" value={data.father_husband_name} />}
                  {editing ? <EditField label="Marital Status" value={form.marital_status} onChange={setField('marital_status')} /> : <Field label="Marital Status" value={data.marital_status} />}
                  {editing ? <EditField label="PAN Number" value={form.pan_number} onChange={setField('pan_number')} /> : <Field label="PAN Number" value={data.pan_number} />}
                  {editing ? <EditField label="Aadhar Number" value={form.aadhar_number} onChange={setField('aadhar_number')} /> : <Field label="Aadhar Number" value={data.aadhar_number} />}
                  {editing ? <EditField label="Permanent Address" value={form.address} onChange={setField('address')} /> : <Field label="Permanent Address" value={data.address} />}
                  {editing ? <EditField label="Correspondence Address" value={form.correspondence_address} onChange={setField('correspondence_address')} /> : <Field label="Correspondence Address" value={data.correspondence?.address || 'NA'} />}
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

              {bankDetailsCard}

              <Field label="Onboarding" value={data.onboarding_completed ? 'Completed' : 'Pending'} />

              {/* The signature used to be invisible on the volunteer record, so
                  HR had to generate a letter to discover whether one existed.
                  Laid out like the rest of the panel: icon-led card head, status
                  pill on the right, token-coloured image well, .empty fallback. */}
              <div className="card" style={{ marginTop: 16 }}>
                <div className="card-head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                        background: 'var(--sage-soft)', color: 'var(--sage)',
                      }}
                    >
                      <Pencil width={17} />
                    </span>
                    <h3 style={{ margin: 0, fontSize: 15 }}>Signature</h3>
                  </div>
                  <span className={`pill ${sigStatus.cls}`}>{sigStatus.label}</span>
                </div>
                <div className="card-pad">
                  {data.signature_url ? (
                    <>
                      <div
                        style={{
                          border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)',
                          background: 'var(--sand)', padding: 14, minHeight: 76,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <img
                          src={safeImgSrc(data.signature_url)}
                          alt="Volunteer signature"
                          style={{ maxHeight: 60, maxWidth: '100%', objectFit: 'contain' }}
                        />
                      </div>
                      <div className="detail-grid" style={{ marginTop: 12 }}>
                        <Field
                          label="Captured via"
                          value={signatureSourceLabel(data.signature_source) || 'Not recorded'}
                        />
                        <Field
                          label="Signed on"
                          value={data.signature_signed_at ? new Date(data.signature_signed_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not recorded'}
                        />
                      </div>
                      {sigState === 'draft' && (
                        <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--ink-soft)' }}>
                          Captured but not yet submitted. It stays out of printed forms until it is signed.
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="empty" style={{ padding: 20 }}>
                      No signature captured yet. Ask the volunteer to sign in the HR Form or the Online Form, or upload an image below.
                    </div>
                  )}
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      ref={sigInputRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      style={{ display: 'none' }}
                      onChange={handleSigSelect}
                    />
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => sigInputRef.current?.click()}
                      disabled={sigUploading}
                    >
                      {sigUploading ? 'Uploading\u2026' : data.signature_url ? 'Replace signature' : 'Upload signature'}
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                      PNG or JPG image of the signed signature
                    </span>
                  </div>
                </div>
              </div>
              </>
              )}

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
                  {/* Late tally rides the month-filter line so the calendar keeps a
                      clean body — no status dropdown; the cells show status themselves. */}
                  {(() => {
                    const mLate = payAttendance.reduce((s, a) => s + (a.status === 'half-day' ? 0 : (a.late_minutes || 0)), 0);
                    return (
                      <div style={{ display:'flex', alignItems:'baseline', gap:7, padding:'7px 13px', background:'var(--bg)', border:'1px solid var(--line)', borderRadius:'var(--radius-sm)' }}>
                        <span style={{ fontWeight:600, fontSize:12, color:'var(--ink)' }}>Late this month</span>
                        <span style={{ fontWeight:700, fontSize:16, color: mLate > 0 ? 'var(--danger)' : 'var(--sage)' }}>{mLate}</span>
                        <span style={{ fontSize:11, color:'var(--ink-soft)' }}>actual late minutes</span>
                      </div>
                    );
                  })()}
                </div>

                <div style={{ display:'flex', gap:24, alignItems:'flex-start' }}>
                  {/* Calendar */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, background:'var(--line)', border:'1px solid var(--line)', borderRadius:6, overflow:'hidden', fontSize:12 }}>
                      {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d =>
                        <div key={d} style={{ textAlign:'center', fontWeight:600, color:'var(--ink-soft)', padding:'7px 0', background:'var(--bg)' }}>{d}</div>
                      )}
                      {(() => {
                        const firstDay = new Date(yr, mo - 1, 1).getDay();
                        const cells = [];
                        for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} style={{ background:'#fff', minHeight:52 }} />);
                        for (const md of monthDays) {
                          const s = md.status;
                          // Salary-calculator logic lives HERE now that the
                          // salary tab's own day grid is gone: days before the
                          // join date are muted, payroll-deducted days read red
                          // with a Deducted note, then normal attendance status.
                          const beforeJoin = joinedThisMonth && md.date < joinCutoff;
                          const isDeducted = deducted.has(md.date);
                          let bg;
                          if (beforeJoin) { bg = '#e8e8e8'; }
                          else if (isDeducted) { bg = '#ffe0e0'; }
                          else if (s === 'present') { bg = '#d4edda'; }
                          else if (s === 'late') { bg = '#fef3c7'; }
                          else if (s === 'absent') { bg = '#ffe0e0'; }
                          else if (s === 'leave' || s === 'Leave') { bg = '#f3e8ff'; }
                          else if (s === 'half-day') { bg = '#e8d5f5'; }
                          else if (s === 'holiday') { bg = '#e0f2fe'; }
                          else if (md.dayName === 'Sun') { bg = '#f0f0f0'; }
                          else { bg = '#fff'; }
                          // Punch times replace the old status icons: the cell
                          // says when the day started and ended. Text fallback
                          // only for days with no punches (absent/leave/Sunday).
                          const inT = md.att?.punch_in_time ? fmtTime(md.att.punch_in_time) : '';
                          const outT = md.att?.punch_out_time ? fmtTime(md.att.punch_out_time) : '';
                          const fallback = beforeJoin ? '—'
                            : isDeducted ? 'Deducted'
                            : s === 'absent' ? 'Absent'
                            : (s === 'leave' || s === 'Leave') ? 'Leave'
                            : s === 'half-day' ? 'HD'
                            : s === 'holiday' ? 'Holiday'
                            : (md.dayName === 'Sun' && !s) ? '—'
                            : '';
                          cells.push(
                            <div key={md.date} title={beforeJoin ? 'Before join' : isDeducted ? 'Deducted' : s || ''}
                              style={{ textAlign:'center', padding:'7px 2px', background:bg, fontSize:11, minHeight:58, boxSizing:'border-box' }}>
                              <div style={{ fontWeight:700, fontSize:13, color: beforeJoin ? '#9ca3af' : '#111827' }}>{md.day}</div>
                              {inT || outT ? (
                                <div style={{ fontSize:11, lineHeight:1.5, color:'#111827', fontVariantNumeric:'tabular-nums', fontWeight:700, marginTop:1 }}>
                                  <div><span style={{ fontSize:9, fontWeight:800, color:'#16a34a', marginRight:3 }}>IN</span>{inT || '—'}</div>
                                  <div><span style={{ fontSize:9, fontWeight:800, color:'#6b7280', marginRight:3 }}>OUT</span>{outT || '—'}</div>
                                </div>
                              ) : fallback ? (
                                <div style={{ fontSize:10, fontWeight:700, color:'#374151', marginTop:2 }}>{fallback}</div>
                              ) : null}
                            </div>
                          );
                        }
                        return cells;
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'salary' && (
            <div>
              {/* Accounts keeps Bank Details here at the top of Salary — the
                  Overview tab it used to live in does not exist in this panel. */}
              {accountsMode && bankDetailsCard}

              {/* Confidential Salary Access Bar — HR only. Accounts gets a
                  lock icon in the profile instead of this banner. */}
              {!accountsMode && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
                marginBottom: 16, padding: '10px 16px', borderRadius: 8,
                background: isSalaryUnlocked ? '#f0fdf4' : '#fffbeb',
                border: `1px solid ${isSalaryUnlocked ? '#bbf7d0' : '#fef08a'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <span style={{ fontSize: 16 }}>{isSalaryUnlocked ? '🔓' : '🔒'}</span>
                  <div>
                    <span style={{ fontWeight: 700, color: isSalaryUnlocked ? '#166534' : '#92400e' }}>
                      {isSalaryUnlocked ? 'Salary Unlocked (Viewing Full Numbers)' : 'Salary Confidential & Hidden (XXX)'}
                    </span>
                    <div style={{ fontSize: 11, color: isSalaryUnlocked ? '#15803d' : '#b45309' }}>
                      {isSalaryUnlocked ? 'You can view and update confidential salary information.' : 'Enter your access code to reveal or update confidential salary figures.'}
                    </div>
                  </div>
                </div>
                {isSalaryUnlocked ? (
                  <button className="btn btn-sm btn-outline" onClick={lockSalary} style={{ fontSize: 11, padding: '4px 12px', background: '#fff' }}>
                    🔒 Hide Salary
                  </button>
                ) : (
                  <button className="btn btn-sm btn-primary" onClick={() => promptUnlock()} style={{ fontSize: 11, padding: '5px 14px', background: 'var(--sage)', color: '#fff', border: 'none', fontWeight: 600 }}>
                    👁️ View / Update Salary
                  </button>
                )}
              </div>
              )}

              {/* Salary Calculator — auto for current month */}
              <div className="card" style={{ marginBottom:16 }}>
                <div className="card-head">
                  <h3>Salary</h3>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <Dropdown value={effectiveMonthKey} onChange={val => setViewingMonthKey(val?.target?.value ?? val)}
                    style={{ fontSize:13, padding:'4px 8px' }}
                    renderValue={opt => opt?.label || ''}
                    options={[
                      {value: defaultMonthKey, label: `Current Month (${fmtMonthYear(now)})`},
                      ...allMonthKeys
                        .filter(mk => mk !== defaultMonthKey)
                        .sort().reverse()
                        .map(mk => {
                          const d = new Date(mk + '-01');
                          const s = sortedSalaries.find(x => x.from_month.slice(0, 7) <= mk && (!x.to_month || x.to_month.slice(0, 7) >= mk));
                          return {
                            value: mk,
                            label: `${d.toLocaleDateString('en-GB', { month:'long', year:'numeric' })} ${s?.paid_at ? '(Paid)' : '(Unpaid)'}`
                          };
                        })
                    ]} />
                  <button
                    type="button"
                    className="btn btn-sm btn-outline no-print"
                    disabled={reportBusy}
                    title={`Download the attendance and deduction report for ${new Date(effectiveMonthKey + '-01').toLocaleDateString('en-GB', { month:'long', year:'numeric' })} as a Word document`}
                    onClick={() => {
                      // Figures are masked while salary is locked, so gate the
                      // export behind the same access code.
                      if (isSalaryUnlocked) handlerDownloadReport();
                      else promptUnlock(handlerDownloadReport);
                    }}
                    style={{ fontSize:11, padding:'5px 12px', display:'inline-flex', alignItems:'center', gap:5, whiteSpace:'nowrap' }}
                  >
                    {reportBusy ? 'Preparing…' : '📄 Download Word'}
                  </button>
                  </div>
                </div>
                <div className="card-pad">
                  {/* Hold / Released status for the viewing month */}
                  {activeSalary && (
                    <div style={{
                      display:'flex', alignItems:'center', gap:10, flexWrap:'wrap',
                      padding:'8px 12px', marginBottom:12, borderRadius:8,
                      background: salaryHold?.held ? '#fff8e1' : '#f0fdf4',
                      border: `1px solid ${salaryHold?.held ? '#f5d78e' : '#bbf7d0'}`,
                    }}>
                      <span style={{
                        width:9, height:9, borderRadius:'50%', flexShrink:0,
                        background: salaryHold?.held ? '#eab308' : '#22c55e',
                      }} />
                      <span style={{ fontWeight:600, fontSize:13, color:'var(--ink)' }}>
                        {salaryHold?.held ? 'HELD' : 'Released'}
                      </span>
                      {salaryHold?.held && (
                        <span style={{ fontSize:12, color:'var(--ink-soft)' }}>
                          {effectiveMonthKey}{salaryHold.reason ? ` — ${salaryHold.reason}` : ''}
                        </span>
                      )}
                      {isAccounts && !salaryHold?.held && (
                        <button className="btn btn-sm" style={{ marginLeft:'auto', color:'var(--danger)', borderColor:'#f5d78e' }}
                          onClick={() => setHoldModal(true)} disabled={holdBusy}>
                          Hold Salary
                        </button>
                      )}
                      {isAccounts && salaryHold?.held && (
                        <button className="btn btn-sm" style={{ marginLeft:'auto' }}
                          onClick={handlerReleaseSalary} disabled={holdBusy}>
                          Release
                        </button>
                      )}
                    </div>
                  )}
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
                          <div className="salary-visual-total">{formatSalary(Math.round(totalDue) + parseFloat(activeSalary?.extra_amount || 0) + (sundayBonus?.incentiveAKI || 0) + (sundayBonus?.incentiveMonthly || 0) - loanDeductionTotal)}</div>
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
                              <span>Sundays paid: {paidSundayCount}/{sundayCount}d</span>
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

                      {/* Key metrics removed — the figures live in the breakdown
                          above and in the calculator rows below. */}

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
                            <span style={{ fontWeight:600, fontSize:15 }}>{formatSalary(activeSalary?.extra_amount || 0)}</span>
                            <button className="btn btn-icon btn-sm" title="Add/Edit extra amount"
                              onClick={() => {
                                promptUnlock(() => {
                                  setExtraEditing(true);
                                  setExtraVal(String(parseFloat(activeSalary?.extra_amount || 0)));
                                });
                              }}>
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
                        <Box num={isSalaryUnlocked ? ('₹' + perDay.toFixed(2)) : '₹ XXX'} label={'Per Day\nRate'} color="#4F6472" />
                        <Arrow />
                        <Box num={lateDeductionDays > 0 ? '-' + lateDeductionDays : '0'} label={'Late\nDeduction'} color={lateDeductionDays > 0 ? '#e67e22' : '#5B6B4E'} />
                        {joiningDeduction > 0 && <><Arrow /><Box num={'−' + joiningDeduction + 'd'} label={'Join\nDeduction'} color="#8B5CF6" /></>}
                        {(() => {
                            const sb = sundayBonus || {};
                            const akiAmt = sb.incentiveAKI || 0;
                            const monthlyAmt = sb.incentiveMonthly || 0;
                            const baseDue = Math.round(totalDue);
                            const loanDed = loanDeductionTotal;
                            const total = baseDue + akiAmt + monthlyAmt - loanDed;
                            const isFRO = data.department === 'FRO';

                            return (
                              <>
                                <Box num={formatSalary(baseDue)} label={'Salary\nDue'} color="#5B6B4E" big />
                                {loanDed > 0 && <><Arrow /><Box num={'−₹' + loanDed.toLocaleString('en-IN')} label={'Loan/\nAdvance'} color="#e67e22" /></>}
                                {isFRO && <><Arrow /><Box num={'+₹' + akiAmt.toLocaleString('en-IN')} label={'Incentive\nAKI'} color={akiAmt > 0 ? '#8B5CF6' : '#ddd'} /></>}
                                {isFRO && <><Arrow /><Box num={'+₹' + monthlyAmt.toLocaleString('en-IN')} label={'Incentive\nMonthly'} color={monthlyAmt > 0 ? '#3B82F6' : '#ddd'} /></>}
                                <Equals />
                                <Box num={formatSalary(total)} label={'Total\nDue'} color="#16a34a" big />
                              </>
                            );
                          })()}
                      </div>

                      {/* Sunday pay explanation */}
                      {activeSalary && sundayBonus && (
                        <div style={{ marginBottom:14, border:'1px solid #fde68a', borderRadius:10, background:'#fffdf5', overflow:'hidden' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 14px', borderBottom:'1px solid #fef3c7' }}>
                            <span style={{ width:20, height:20, borderRadius:6, background:'#fef3c7', color:'#b45309', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:11, flexShrink:0 }}>☀</span>
                            <span style={{ flex:1, fontSize:11, fontWeight:800, letterSpacing:'.05em', textTransform:'uppercase', color:'#92400e' }}>Sunday pay</span>
                            <span style={{ fontSize:11, fontWeight:800, color:'#92400e', background:'#fef3c7', borderRadius:999, padding:'2px 9px', whiteSpace:'nowrap' }}>
                              {sundayBonus.paidSundays}/{sundayBonus.totalSundays} paid
                            </span>
                          </div>
                          <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:7, fontSize:12 }}>
                            <div style={{ display:'grid', gridTemplateColumns:'92px 1fr', gap:10, alignItems:'flex-start' }}>
                              <span style={{ fontWeight:700, color:'#92400e' }}>Rule</span>
                              <span style={{ color:'#6b7280', lineHeight:1.5 }}>
                                {useNewSundayRules
                                  ? <>Every Sunday from your join date is paid, worked or not. A Sunday is not paid only when it is clubbed (Sat/Mon absent) or cancelled by the 6+ absences / join-after-10th rule. Coming and going on a Sunday is your choice — it is never late or half-day.</>
                                  : <>Every Sunday worked (present/late, even a cancelled one) is paid. On top, {sundayBonus.totalSundays - 1} Sundays are paid free, capped at all {sundayBonus.totalSundays} Sundays in the month.</>}
                              </span>
                            </div>
                            <div style={{ display:'grid', gridTemplateColumns:'92px 1fr', gap:10, alignItems:'center' }}>
                              <span style={{ fontWeight:700, color:'#92400e' }}>Sundays</span>
                              <span style={{ color:'#6b7280' }}>
                                Total {sundayBonus.totalSundays} · Attended {sundayBonus.attendedSundays} · Paid {sundayBonus.paidSundays}
                              </span>
                            </div>
                            {unpaidSundays.length > 0 && (
                              <div style={{ display:'grid', gridTemplateColumns:'92px 1fr', gap:10, alignItems:'center' }}>
                                <span style={{ fontWeight:700, color:'#92400e' }}>Not paid</span>
                                <span style={{ color:'#6b7280' }}>
                                  {unpaidSundays.map(d => 'Sun ' + new Date(d).getDate()).join(', ')} — beyond the free + attended Sundays
                                </span>
                              </div>
                            )}
                            {data.department === 'FRO' && (sundayBonus.incentiveAKI > 0 || sundayBonus.incentiveMonthly > 0) && (
                              <div style={{ display:'grid', gridTemplateColumns:'92px 1fr', gap:10, alignItems:'center' }}>
                                <span style={{ fontWeight:700, color:'#92400e' }}>Incentive</span>
                                <span style={{ color:'#6b7280' }}>
                                  Target met → AKI +₹{sundayBonus.incentiveAKI.toLocaleString('en-IN')} · Monthly +₹{sundayBonus.incentiveMonthly.toLocaleString('en-IN')}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Late minutes badge */}
                      <div style={{ marginBottom:14, display:'flex', flexDirection:'column', gap:8 }}>
                        {graceForfeitedNow && lateDeductionDays > 0 && (
                          <div style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'10px 14px', border:'1px solid #fecaca', borderRadius:10, background:'#fef2f2' }}>
                            <span style={{ width:20, height:20, borderRadius:6, background:'#fee2e2', color:'#b91c1c', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:11, flexShrink:0 }}>!</span>
                            <div>
                              <div style={{ fontSize:12, fontWeight:700, color:'#b91c1c' }}>Grace forfeited (unauthorized absence)</div>
                              <div style={{ fontSize:11.5, color:'#6b7280', marginTop:2, lineHeight:1.5 }}>
                                The {lateT.grace} min grace is charged up-front this month — {lateDeductionDays} day{lateDeductionDays !== 1 ? 's' : ''} late deduction applies. Use the admin app to roll it back if this was applied wrongly.
                              </div>
                            </div>
                          </div>
                        )}
                        {graceForfeitedNow && lateDeductionDays === 0 && lateRollbackMinutes > 0 && (
                          <div style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'10px 14px', border:'1px solid #bbf7d0', borderRadius:10, background:'#f0fdf4' }}>
                            <span style={{ width:20, height:20, borderRadius:6, background:'#dcfce7', color:'#15803d', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:11, flexShrink:0 }}>✓</span>
                            <div>
                              <div style={{ fontSize:12, fontWeight:700, color:'#15803d' }}>Grace rollback applied</div>
                              <div style={{ fontSize:11.5, color:'#6b7280', marginTop:2, lineHeight:1.5 }}>
                                {lateRollbackMinutes} min of the {lateT.grace} min grace was waived, so the {totalLateMinutes} late min no longer cost a day. The absence day is still deducted.
                              </div>
                            </div>
                          </div>
                        )}
                        {(() => {
                          let tone = null
                          if (totalLateMinutes > lateT.full) {
                            tone = {
                              icon: '⚠',
                              title: `${totalLateMinutes} min late (${Math.round(totalLateMinutes / 60 * 10) / 10} hrs) → ${lateDeductionDays} day${lateDeductionDays !== 1 ? 's' : ''} deducted`,
                              sub: `Every ${lateT.full} min of lateness = 1 day deducted.`,
                              bg: '#fef2f2', bd: '#fecaca', fg: '#b91c1c', iconBg: '#fee2e2',
                            }
                          } else if (totalLateMinutes > lateT.half) {
                            tone = { icon: '⚠', title: `${totalLateMinutes} min late → 1 day deducted`, bg: '#fffbeb', bd: '#fde68a', fg: '#92400e', iconBg: '#fef3c7' }
                          } else if (totalLateMinutes > lateT.grace) {
                            tone = { icon: '◐', title: `${totalLateMinutes} min late → Half day deducted`, bg: '#fffbeb', bd: '#fde68a', fg: '#92400e', iconBg: '#fef3c7' }
                          } else if (totalLateMinutes > 0) {
                            tone = { icon: '✓', title: `${totalLateMinutes} min late — No deduction`, sub: `Within the ${lateT.grace} min grace.`, bg: '#f0fdf4', bd: '#bbf7d0', fg: '#15803d', iconBg: '#dcfce7' }
                          }
                          if (!tone) return null
                          return (
                            <div style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'10px 14px', border:`1px solid ${tone.bd}`, borderRadius:10, background:tone.bg }}>
                              <span style={{ width:20, height:20, borderRadius:6, background:tone.iconBg, color:tone.fg, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:11, flexShrink:0 }}>{tone.icon}</span>
                              <div>
                                <div style={{ fontSize:12, fontWeight:700, color:tone.fg }}>{tone.title}</div>
                                {tone.sub && <div style={{ fontSize:11.5, color:'#6b7280', marginTop:2 }}>{tone.sub}</div>}
                              </div>
                            </div>
                          )
                        })()}
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
                        <div style={{ marginBottom:14, border:'1px solid #fde68a', borderRadius:10, background:'#fffdf5', padding:'10px 14px', display:'grid', gridTemplateColumns:'repeat(3, minmax(0,1fr))', gap:12 }}>
                          {[
                            { label: 'Joined', value: new Date(data.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }) },
                            { label: 'Available', value: `${joinDayNum} – ${daysInMonth} · ${availableDays} days` },
                            { label: 'Joining deduction', value: `${joiningDeduction} days` },
                          ].map((m, i) => (
                            <div key={m.label} style={{ display:'flex', flexDirection:'column', gap:2, minWidth:0, ...(i ? { borderLeft:'1px solid #fef3c7', paddingLeft:12 } : {}) }}>
                              <span style={{ fontSize:9.5, fontWeight:800, letterSpacing:'.05em', textTransform:'uppercase', color:'#a16207' }}>{m.label}</span>
                              <span style={{ fontSize:12.5, fontWeight:700, color:'#102544' }}>{m.value}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* What's deducted — visual breakdown */}
                      {(() => {
                        const autoSundays = [...deducted].filter(d =>
                          !absentDatesAfterJoin.includes(d) &&
                          new Date(d).getDay() === 0 &&
                          !extraSundays.includes(d) &&
                          !unpaidSundays.includes(d)
                        );
                        const hasAny = absentDatesAfterJoin.length > 0 || autoSundays.length > 0 || extraSundays.length > 0 || unpaidSundays.length > 0 || lateDeductionDays > 0 || joiningDeduction > 0;
                        if (!hasAny) return null;
                        const rows = [];
                        if (absentDatesAfterJoin.length > 0) {
                          rows.push({
                            label: `${absentDatesAfterJoin.length} absent`,
                            dot: '#ef4444',
                            desc: absentDatesAfterJoin.map(d => {
                              const dt = new Date(d);
                              return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getDay()] + ' ' + dt.getDate();
                            }).join(', '),
                          });
                        }
                        if (autoSundays.length > 0) {
                          rows.push({
                            label: `${autoSundays.length} Sun${autoSundays.length > 1 ? 's' : ''}`,
                            dot: '#f59e0b',
                            desc: `${autoSundays.map(d => 'Sun ' + new Date(d).getDate()).join(', ')} · Sat/Mon → next/prev Sun`,
                          });
                        }
                        if (extraSundays.length > 0) {
                          rows.push({
                            label: `${extraSundays.length} extra`,
                            dot: '#dc2626',
                            desc: `≥6 absences rule → ${extraSundays.map(d => 'Sun ' + new Date(d).getDate()).join(', ')}`,
                          });
                        }
                        if (unpaidSundays.length > 0) {
                          rows.push({
                            label: `${unpaidSundays.length} Sun`,
                            dot: '#fbbf24',
                            desc: `${unpaidSundays.map(d => 'Sun ' + new Date(d).getDate()).join(', ')} · beyond free + attended Sundays`,
                          });
                        }
                        if (lateDeductionDays > 0) {
                          rows.push({
                            label: `${lateDeductionDays} late`,
                            dot: '#f97316',
                            desc: `${totalLateMinutes} min late → ${lateDeductionDays} day${lateDeductionDays !== 1 ? 's' : ''} deducted`,
                          });
                        }
                        if (joiningDeduction > 0) {
                          rows.push({
                            label: `${joiningDeduction} joining`,
                            dot: '#8b5cf6',
                            desc: 'First month deduction for new joiners',
                          });
                        }
                        return (
                          <div style={{ marginBottom:14, border:'1px solid #fecaca', borderRadius:10, background:'#fffafa', overflow:'hidden' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 14px', borderBottom:'1px solid #fee2e2' }}>
                              <span style={{ width:20, height:20, borderRadius:6, background:'#fee2e2', color:'#b91c1c', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, flexShrink:0 }}>!</span>
                              <span style={{ flex:1, fontSize:11, fontWeight:800, letterSpacing:'.05em', textTransform:'uppercase', color:'#b91c1c' }}>
                                Why {deducted.size} day{deducted.size !== 1 ? 's' : ''} are deducted
                              </span>
                              <span style={{ fontSize:11, fontWeight:800, color:'#b91c1c', background:'#fee2e2', borderRadius:999, padding:'2px 9px', whiteSpace:'nowrap' }}>
                                {deducted.size} day{deducted.size !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div style={{ padding:'2px 14px 6px' }}>
                              {rows.map((r, i) => (
                                <div key={r.label} style={{ display:'grid', gridTemplateColumns:'120px 1fr', gap:10, alignItems:'flex-start', padding:'7px 0', borderBottom: i === rows.length - 1 ? 'none' : '1px solid #fee2e2' }}>
                                  <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontWeight:700, color:'#7f1d1d', fontSize:12 }}>
                                    <span style={{ width:8, height:8, borderRadius:'50%', background:r.dot, flexShrink:0 }} />
                                    {r.label}
                                  </span>
                                  <span style={{ color:'#6b7280', fontSize:12, lineHeight:1.5 }}>{r.desc}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Day grid removed — the attendance tab's calendar now
                          carries this logic (deducted / before-join / weekend). */}
                       </div>
                     </>
                   )}
                </div>
              </div>

              {/* NGO People Allocation */}
              <div className="card" style={{ marginBottom:16 }}>
                <div className="card-head">
                  <h3>NGO Employment Split</h3>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <span className="sub">{peopleAllocs.length} NGO{peopleAllocs.length !== 1 ? 's' : ''} · {Math.round(peopleAllocs.reduce((s,a)=>s+(parseFloat(a.pct)||0),0) || 0)}% allocated</span>
                    <button className="btn btn-sm" onClick={() => {
                      setPeopleForm(peopleAllocs.length
                        ? peopleAllocs.map(a => ({ ngo_id: a.ngo_id, pct: String(a.pct) }))
                        : ngos.map(n => ({ ngo_id: n.id, pct: '' })));
                      setEditingPeople(true); setAllocMsg('');
                    }}>Edit</button>
                  </div>
                </div>
                <div className="card-pad">
                  {peopleAllocs.length === 0 ? (
                    <div style={{ color:'var(--ink-soft)', fontSize:13 }}>No NGO employment split set. Assign the employee to one or more NGOs.</div>
                  ) : (
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, fontVariantNumeric:'tabular-nums' }}>
                      <tbody>
                        {peopleAllocs.map(a => {
                          const name = ngos.find(n => n.id === a.ngo_id)?.name || a.ngo_name || 'Unknown';
                          const pct = parseFloat(a.pct) || 0;
                          return (
                            <tr key={a.id || a.ngo_id}>
                              <td style={{ padding:'4px 4px', fontWeight:500 }}>{name}</td>
                              <td style={{ padding:'4px 4px', textAlign:'right', width:110 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end' }}>
                                  <div style={{ width:64, height:6, background:'var(--line)', borderRadius:3, overflow:'hidden' }}>
                                    <div style={{ width:Math.min(100, pct)+'%', height:6, background:'var(--sage)', borderRadius:3 }} />
                                  </div>
                                  <span style={{ fontWeight:600, minWidth:36, textAlign:'right' }}>{Math.round(pct)}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* NGO Salary Allocation */}
              <div className="card" style={{ marginBottom:16 }}>
                <div className="card-head">
                  <h3>NGO Salary Allocation</h3>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <span className="sub">{salaryAllocMonth ? salaryAllocMonth.slice(0,7) : ''}</span>
                    <button className="btn btn-sm" disabled={generatingSalary} onClick={async () => {
                      setGeneratingSalary(true); setAllocMsg('');
                      try {
                        await generateWorkerSalaryAlloc(worker.id, salaryAllocMonth);
                        const r = await fetchWorkerSalaryAlloc(worker.id, salaryAllocMonth);
                        setSalaryAllocs(r?.allocations || []);
                        setAllocMsg('Salary allocation generated from payroll.');
                      } catch (e) { setAllocMsg('Generate failed: ' + e.message); }
                      setGeneratingSalary(false);
                    }}>{generatingSalary ? '…' : 'Generate from Payroll'}</button>
                    <button className="btn btn-sm" onClick={() => {
                      promptUnlock(() => {
                        setSalarySplitForm(salaryAllocs.length
                          ? salaryAllocs.map(a => ({ ngo_id: a.ngo_id, portion: String(a.salary_portion ?? '') }))
                          : []);
                        setEditingSalary(true);
                        setAllocMsg('');
                      });
                    }}>Edit</button>
                  </div>
                </div>
                <div className="card-pad">
                  {allocMsg && <div style={{ fontSize:12, color:'var(--ink-soft)', marginBottom:8 }}>{allocMsg}</div>}
                  {salaryAllocs.length === 0 ? (
                    <div style={{ color:'var(--ink-soft)', fontSize:13 }}>No salary allocation for this month. Click <strong>Generate from Payroll</strong> to seed it from payroll, or edit to set amounts per NGO.</div>
                  ) : (
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, fontVariantNumeric:'tabular-nums' }}>
                      <tbody>
                        {salaryAllocs.map(a => {
                          const name = ngos.find(n => n.id === a.ngo_id)?.name || a.ngo_name || 'Unknown';
                          const portion = parseFloat(a.salary_portion) || 0;
                          const activeSalaryVal = parseFloat(activeSalary?.salary || 0);
                          const pct = activeSalaryVal > 0 ? (portion / activeSalaryVal) * 100 : 0;
                          return (
                            <tr key={a.id || a.ngo_id}>
                              <td style={{ padding:'4px 4px', fontWeight:500 }}>{name}</td>
                              <td style={{ padding:'4px 4px', textAlign:'right', width:140 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end' }}>
                                  <div style={{ width:64, height:6, background:'var(--line)', borderRadius:3, overflow:'hidden' }}>
                                    <div style={{ width:Math.min(100, pct)+'%', height:6, background:'var(--sage)', borderRadius:3 }} />
                                  </div>
                                  <span style={{ fontWeight:600, minWidth:110, textAlign:'right' }}>{formatSalary(portion)}{activeSalaryVal > 0 && isSalaryUnlocked ? ' · ' + Math.round(pct) + '%' : ''}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

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
                        <div>
                          <span className="detail-label">Salary From Month</span>
                          <input type="month" value={salaryForm.from_month}
                            onChange={e => setSalaryForm(f => ({ ...f, from_month: e.target.value }))}
                            style={{ border:'1px solid var(--line)', borderRadius:'var(--radius-sm)', padding:'6px 10px', fontSize:13, width:170 }} />
                        </div>
                      </div>
                      <div style={{ fontSize:11, color:'var(--ink-soft)', marginTop:6 }}>
                        NGO allocation is not asked here — set it from the NGO allocation screen.
                      </div>
                      <div style={{ display:'flex', gap:12, alignItems:'center', marginTop:12 }}>
                        <button className="btn btn-primary btn-sm" disabled={salarySubmitting || !salaryForm.salary || !salaryForm.from_month}
                          onClick={submitSalary}>
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
                      <div>
                        <span className="detail-label">Salary From Month</span>
                        <input type="month" value={salaryForm.from_month}
                          onChange={e => setSalaryForm(f => ({ ...f, from_month: e.target.value }))}
                          style={{ border:'1px solid var(--line)', borderRadius:'var(--radius-sm)', padding:'6px 10px', fontSize:13, width:170 }} />
                      </div>
                      <button className="btn btn-primary btn-sm" disabled={salarySubmitting || !salaryForm.salary || !salaryForm.from_month}
                        onClick={submitSalary}>
                        {salarySubmitting ? 'Adding\u2026' : 'Add Salary'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-head"><h3>Salary History ({salaries.length + importedSalaryRows.length} records)</h3></div>
                {salaries.length === 0 && importedSalaryRows.length === 0 ? (
                  <div className="card-pad"><div className="empty">No salary records found.</div></div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Salary</th>
                        <th>From</th>
                        <th>To</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...salaries].sort((a, b) => b.from_month.localeCompare(a.from_month)).map((s, i) => {
                        const from = new Date(s.from_month);
                        const to = s.to_month ? new Date(s.to_month) : null;
                        const fmtMonth = (d) => d.toLocaleDateString('en-GB', { month:'long', year:'numeric' });
                        return (
                          <tr key={s.id}>
                            <td>{i + 1}</td>
                            <td style={{ fontWeight:600 }}>{formatSalary(s.salary)}</td>
                            <td>{fmtMonth(from)}</td>
                            <td>{to ? fmtMonth(to) : '\u2014 (Current)'}</td>
                            <td>
                              <div style={{ display:'flex', gap:4 }}>
                                <button className="btn btn-icon" title="Delete"
                                  onClick={async () => {
                                    promptUnlock(async () => {
                                      if (!confirm('Delete this salary record?')) return;
                                      try {
                                        const del = await fetch(API_BASE + '/salary/' + s.id, { method:'DELETE', headers:{ Authorization: 'Bearer ' + localStorage.getItem('ucs_token') } });
                                        const delBody = await del.json().catch(() => ({}));
                                        if (!del.ok) { alert(delBody.message || 'Could not delete the salary record'); return; }
                                        // The backend reopens the previous row when the newest one is
                                        // deleted, so re-read instead of guessing locally.
                                        const fresh = await fetchWorkerSalaries(worker.id).catch(() => null);
                                        setSalaries(fresh || []);
                                      } catch (e) { alert(e.message); }
                                    });
                                  }}>
                                  <Trash width={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {/* Imported monthly salaries (History Import) — read-only. */}
                      {importedSalaryRows
                        .slice()
                        .sort((a, b) => b.month.localeCompare(a.month))
                        .map((r, i) => {
                          const d = new Date(`${r.month}-01`);
                          const fmtMonth = (x) => x.toLocaleDateString('en-GB', { month:'long', year:'numeric' });
                          return (
                            <tr key={`imp-${r.month}`} style={{ color: 'var(--ink-soft, #64748b)' }}>
                              <td>{salaries.length + i + 1}</td>
                              <td style={{ fontWeight:600, color:'inherit' }}>{formatSalary(r.salary)}</td>
                              <td>{fmtMonth(d)}</td>
                              <td>{fmtMonth(d)}</td>
                              <td></td>
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
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                      <div style={{ fontSize:22, fontWeight:700, color:'var(--sage)' }}>
                        Monthly Target: ₹{currentTarget.toLocaleString('en-IN')}
                      </div>
                      {!targetEditing && (
                        <button className="btn btn-sm btn-outline" onClick={() => { setTargetEditing(true); setTargetEditVal(String(currentTarget)); }} style={{ fontSize:11, padding:'2px 8px' }}>Edit</button>
                      )}
                    </div>
                  ) : (
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                      <div style={{ fontSize:14, color:'var(--ink-soft)' }}>Monthly target not set</div>
                      {!targetEditing && (
                        <button className="btn btn-sm btn-primary" onClick={() => { setTargetEditing(true); setTargetEditVal(''); }} style={{ fontSize:11, padding:'2px 8px' }}>Set Target</button>
                      )}
                    </div>
                  )}

                  {targetEditing && (
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, padding:'8px 12px', background:'#f9fafb', borderRadius:8, border:'1px solid var(--line)' }}>
                      <span style={{ fontSize:13, fontWeight:600 }}>₹</span>
                      <input type="number" min="0" value={targetEditVal} onChange={e => setTargetEditVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && targetEditVal) document.getElementById('target-save-btn')?.click(); if (e.key === 'Escape') setTargetEditing(false); }}
                        autoFocus style={{ flex:1, padding:'4px 8px', fontSize:14, border:'1px solid var(--line)', borderRadius:4, outline:'none' }} />
                      <button id="target-save-btn" className="btn btn-sm btn-primary" disabled={!targetEditVal || targetSaving} onClick={async () => {
                        setTargetSaving(true);
                        try {
                          const month = `${yr}-${String(mo).padStart(2, '0')}-01`;
                          await updateWorkerTarget(data.id, month, parseFloat(targetEditVal));
                          setCurrentTarget(parseFloat(targetEditVal));
                          setTargetEditing(false);
                          const s = await fetchIncentiveSummary(data.id, month);
                          setIncSummary(s?.hasIncentive ? s : null);
                        } catch (e) { alert(e.message); }
                        finally { setTargetSaving(false); }
                      }}>{targetSaving ? '...' : 'Save'}</button>
                      <button className="btn btn-sm btn-outline" onClick={() => setTargetEditing(false)} style={{ fontSize:11 }}>Cancel</button>
                    </div>
                  )}

                  <div className="salary-metrics" style={{ marginBottom:8 }}>
                    <div className="salary-metric">
                      {/* Accounts shows the AKI the member actually earns: new
                          joiners (first 3 months) get the full figure, older
                          members get half — the original full amount stays
                          visible beside it, faded, so nothing is hidden. */}
                      <div className="salary-metric-num">
                        {formatSalary(
                          accountsMode
                            ? (incSummary?.isNewJoiner ? (incSummary?.totalAKI || 0) : Math.round((incSummary?.totalAKI || 0) / 2))
                            : (incSummary?.totalAKI || 0)
                        )}
                        {accountsMode && !incSummary?.isNewJoiner && (incSummary?.totalAKI || 0) > 0 && (
                          <span style={{ fontSize:12, fontWeight:600, color:'var(--ink-soft)', marginLeft:6, opacity:0.7 }}>
                            ({formatSalary(incSummary?.totalAKI || 0)})
                          </span>
                        )}
                      </div>
                      <div className="salary-metric-lbl">Total AKI {accountsMode && (incSummary ? (incSummary.isNewJoiner ? '(Full)' : '(Half)') : '')}</div>
                    </div>
                    <div className="salary-metric">
                      <div className="salary-metric-num">{formatSalary(incSummary?.monthlyIncentive || 0)}</div>
                      <div className="salary-metric-lbl">Monthly (10%)</div>
                    </div>
                    <div className="salary-metric">
                      <div className="salary-metric-num" style={{ color: incSummary?.monthlyTargetMet ? 'var(--sage)' : 'var(--danger)' }}>
                        ₹{(incSummary?.totalIncentive || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="salary-metric-lbl">Total Incentive</div>
                    </div>
                    {accountsMode && (
                      <div className="salary-metric">
                        <div className="salary-metric-num" style={{ color: incSummary?.monthlyTargetMet ? 'var(--sage)' : 'var(--danger)' }}>
                          {formatSalary(incSummary?.monthlyAchievement || 0)}
                        </div>
                        <div className="salary-metric-lbl">Total Collected</div>
                      </div>
                    )}
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
                        const daysInMonth = new Date(yr, mo, 0).getDate();
                        const firstDay = new Date(yr, mo - 1, 1).getDay();
                        const cells = [];
                        for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} />);
                        for (let d = 1; d <= daysInMonth; d++) {
                          const dateStr = `${yr}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
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
                                          const month = `${yr}-${String(mo).padStart(2, '0')}-01`;
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
                            {(() => {
                              const dt = new Date(l.applied_at);
                              const i = new Intl.DateTimeFormat('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' }).format(dt);
                              return i.split('/').join('-');
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <ShiftSettings workerId={data?.id} currentShift={{ start: data?.shift_start_time, end: data?.shift_end_time }} onSave={() => fetchWorkerById(worker.id).then(d => setData(d)).catch((err) => { console.error('Error:', err.message); })} />
          )}

        </div>
      </div>

      {editingPeople && (
        <div className="modal-overlay" onClick={() => setEditingPeople(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="card-pad">
              <h3 style={{ margin:'0 0 4px' }}>NGO Employment Split</h3>
              <p style={{ fontSize:12, color:'var(--ink-soft)', margin:'0 0 12px' }}>
                Assign the % of employment time per NGO. Leave empty NGOs blank. Total must equal 100%.
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
                {peopleForm.map((p, i) => (
                  <div key={p.ngo_id || i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ flex:1, fontSize:13, fontWeight:500 }}>
                      {ngos.find(n => n.id === p.ngo_id)?.name || 'NGO'}
                    </span>
                    <input type="number" min="0" max="100" value={p.pct}
                      onChange={e => setPeopleForm(f => f.map((x, j) => j === i ? { ...x, pct: e.target.value } : x))}
                      style={{ width:80, border:'1px solid var(--line)', borderRadius:'var(--radius-sm)', padding:'6px 8px', fontSize:13, textAlign:'right' }}
                      placeholder="%" />
                    <span style={{ width:20, textAlign:'right', fontSize:12, color:'var(--ink-soft)' }}>%</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:12, marginBottom:12, color: (() => {
                const total = peopleForm.reduce((s, x) => s + (parseFloat(x.pct) || 0), 0);
                return total === 100 ? '#065f46' : total > 100 ? '#991b1b' : 'var(--ink-soft)';
              })() }}>
                Total: {peopleForm.reduce((s, x) => s + (parseFloat(x.pct) || 0), 0)}% (must be 100%)
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-primary btn-sm" disabled={peopleSaving || peopleForm.reduce((s, x) => s + (parseFloat(x.pct) || 0), 0) !== 100}
                  onClick={async () => {
                    setPeopleSaving(true);
                    try {
                      const allocs = peopleForm.filter(x => (parseFloat(x.pct) || 0) > 0)
                        .map(x => ({ ngo_id: x.ngo_id, pct: parseFloat(x.pct) }));
                      await saveWorkerPeopleAllocations(worker.id, allocs);
                      const r = await fetchWorkerPeopleAllocations(worker.id);
                      setPeopleAllocs(r || []);
                      setEditingPeople(false);
                    } catch (e) { setAllocMsg(e.message); }
                    setPeopleSaving(false);
                  }}>
                  {peopleSaving ? 'Saving...' : 'Save'}
                </button>
                <button className="btn btn-sm" onClick={() => setEditingPeople(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingSalary && (
        <div className="modal-overlay" onClick={() => setEditingSalary(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="card-pad">
              <h3 style={{ margin:'0 0 4px' }}>NGO Salary Allocation</h3>
              <p style={{ fontSize:12, color:'var(--ink-soft)', margin:'0 0 12px' }}>
                Set the ₹ amount each NGO pays towards this employee's salary. Total must equal active salary ({formatSalary(activeSalary?.salary || 0)}).
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
                {salarySplitForm.map((p, i) => (
                  <div key={p.ngo_id || i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ flex:1, fontSize:13, fontWeight:500 }}>
                      {ngos.find(n => n.id === p.ngo_id)?.name || 'NGO'}
                    </span>
                    <span style={{ fontSize:12, color:'var(--ink-soft)' }}>₹</span>
                    <input type="number" min="0" value={p.portion}
                      onChange={e => setSalarySplitForm(f => f.map((x, j) => j === i ? { ...x, portion: e.target.value } : x))}
                      style={{ width:120, border:'1px solid var(--line)', borderRadius:'var(--radius-sm)', padding:'6px 8px', fontSize:13, textAlign:'right' }}
                      placeholder="0" />
                  </div>
                ))}
              </div>
              <div style={{ fontSize:12, marginBottom:12, color:'var(--ink-soft)' }}>
                Total: ₹{salarySplitForm.reduce((s, x) => s + (parseFloat(x.portion) || 0), 0).toLocaleString('en-IN')}
                {' '}· Active salary: {formatSalary(activeSalary?.salary || 0)}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-primary btn-sm" disabled={salarySaving}
                  onClick={async () => {
                    setSalarySaving(true);
                    try {
                      const allocs = salarySplitForm.filter(x => (parseFloat(x.portion) || 0) > 0)
                        .map(x => ({ ngo_id: x.ngo_id, salary_portion: parseFloat(x.portion) }));
                      await saveWorkerSalaryAlloc(worker.id, allocs, salaryAllocMonth);
                      const r = await fetchWorkerSalaryAlloc(worker.id, salaryAllocMonth);
                      setSalaryAllocs(r?.allocations || []);
                      setEditingSalary(false);
                    } catch (e) { setAllocMsg(e.message); }
                    setSalarySaving(false);
                  }}>
                  {salarySaving ? 'Saving...' : 'Save'}
                </button>
                <button className="btn btn-sm" onClick={() => setEditingSalary(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {holdModal && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(15,23,42,.45)', zIndex:4000,
          display:'flex', alignItems:'center', justifyContent:'center',
        }} onClick={() => setHoldModal(false)}>
          <div style={{
            background:'#fff', borderRadius:14, width:'min(92vw,440px)',
            padding:'20px 22px', boxShadow:'0 20px 60px rgba(0,0,0,.25)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:4 }}>Hold Salary</div>
            <div style={{ fontSize:12, color:'var(--ink-soft)', marginBottom:14 }}>
              {data?.name || 'Worker'} · {effectiveMonthKey}
            </div>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--ink)', marginBottom:6 }}>
              Reason (optional)
            </div>
            <textarea
              rows={3} value={holdReason}
              onChange={e => setHoldReason(e.target.value)}
              placeholder="e.g. Bank details mismatch, verify & pay next month"
              style={{
                width:'100%', boxSizing:'border-box', padding:'8px 10px', borderRadius:8,
                border:'1px solid var(--line)', fontSize:13, resize:'vertical', fontFamily:'inherit',
              }} />
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
              <button className="btn btn-sm" onClick={() => { setHoldModal(false); setHoldReason(''); }}>Cancel</button>
              <button className="btn btn-sm" style={{ background:'var(--danger)', color:'#fff', border:'none' }}
                onClick={handlerHoldSalary} disabled={holdBusy}>
                {holdBusy ? 'Saving…' : 'Confirm Hold'}
              </button>
            </div>
          </div>
        </div>
      )}

      {docModal && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(15,23,42,.5)', zIndex:4000,
          display:'flex', alignItems:'center', justifyContent:'center', padding:16,
        }} onClick={() => setDocModal(false)}>
          <div style={{
            background:'#fff', borderRadius:16, width:'min(94vw, 480px)', maxHeight:'90vh',
            display:'flex', flexDirection:'column', overflow:'hidden',
            boxShadow:'0 24px 60px rgba(15,23,42,.28)',
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'16px 18px', borderBottom:'1px solid var(--line)' }}>
              <span style={{ width:36, height:36, borderRadius:10, background:'#eef2ff', color:'#4338ca', display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="13" y2="17" />
                </svg>
              </span>
              <div style={{ minWidth:0, flex:1 }}>
                <div style={{ fontWeight:800, fontSize:15, color:'var(--ink)' }}>Documents Submitted</div>
                <div style={{ fontSize:11.5, color:'var(--ink-soft)', marginTop:2 }}>
                  {data?.name || 'Volunteer'} — which documents have been submitted?
                </div>
              </div>
              <button type="button" onClick={() => setDocModal(false)} aria-label="Close"
                style={{ border:'none', background:'transparent', color:'var(--ink-soft)', width:30, height:30, borderRadius:8, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Body */}
            <div style={{ padding:16, overflowY:'auto', display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ fontSize:10, fontWeight:800, letterSpacing:'.06em', textTransform:'uppercase', color:'#94a3b8' }}>
                Select all that apply
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0,1fr))', gap:8 }}>
                {DOC_OPTIONS.map(d => {
                  const on = docValue.includes(d)
                  return (
                    <label
                      key={d}
                      style={{
                        display:'flex', alignItems:'center', gap:8, padding:'9px 10px', borderRadius:9,
                        border:`1px solid ${on ? '#93c5fd' : 'var(--line)'}`,
                        background: on ? '#eff6ff' : '#fff',
                        color: on ? '#1d4ed8' : 'var(--ink)',
                        fontSize:12.5, fontWeight: on ? 700 : 500, cursor:'pointer',
                        transition:'background .12s, border-color .12s',
                      }}
                    >
                      <input
                        type="checkbox"
                        style={{ width:14, height:14, margin:0, cursor:'pointer', accentColor:'#2563eb' }}
                        checked={on}
                        onChange={e => setDocValue(e.target.checked
                          ? DOC_OPTIONS.filter(o => o === d || docValue.includes(o))
                          : docValue.filter(o => o !== d))}
                      />
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d}</span>
                    </label>
                  )
                })}
              </div>

              {docValue.includes(OTHER_DOC) && (
                <div>
                  <div style={{ fontSize:10, fontWeight:800, letterSpacing:'.06em', textTransform:'uppercase', color:'#94a3b8', marginBottom:5 }}>
                    Specify document
                  </div>
                  <input
                    type="text"
                    value={docOther}
                    onChange={e => setDocOther(e.target.value)}
                    placeholder="e.g. Passport"
                    style={{ width:'100%', boxSizing:'border-box', padding:'9px 11px', border:'1px solid var(--line)', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none', background:'#fff', color:'var(--ink)' }}
                  />
                </div>
              )}

              <div style={{ fontSize:11, color: docValue.length ? '#15803d' : 'var(--ink-soft)', background: docValue.length ? '#f0fdf4' : '#f8fafc', border:`1px solid ${docValue.length ? '#bbf7d0' : '#eef2f7'}`, borderRadius:8, padding:'7px 10px' }}>
                {docValue.length
                  ? `${docValue.length} document${docValue.length === 1 ? '' : 's'} selected — marked as submitted.`
                  : 'Nothing ticked — this is saved as not submitted.'}
              </div>
            </div>

            {/* Footer */}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'12px 16px', borderTop:'1px solid var(--line)', background:'#f8fafc' }}>
              <button className="btn btn-sm" onClick={() => setDocModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={saveDocs} disabled={docsBusy}>
                {docsBusy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}


function ShiftSettings({ workerId, currentShift, onSave }) {
  const { updateWorker } = useHR()
  const [start, setStart] = useState(currentShift?.start || '')
  const [end, setEnd] = useState(currentShift?.end || '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    setStart(currentShift?.start || '')
    setEnd(currentShift?.end || '')
  }, [currentShift?.start, currentShift?.end])

  const hasOverride = !!(currentShift?.start || currentShift?.end)
  const isCustom = currentShift?.start || currentShift?.end

  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      await updateWorker(workerId, { shift_start_time: start || null, shift_end_time: end || null })
      setMsg({ type: 'success', text: 'Shift settings saved' })
      onSave?.()
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setSaving(false)
    }
  }

  const reset = async () => {
    setStart('')
    setEnd('')
    setSaving(true)
    setMsg(null)
    try {
      await updateWorker(workerId, { shift_start_time: null, shift_end_time: null })
      setMsg({ type: 'success', text: 'Reset to default shift' })
      onSave?.()
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="card-head"><h3>Shift Settings</h3></div>
      <div className="card-pad">
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: isCustom ? '#fefce8' : '#f3f4f6', border: '1px solid', borderColor: isCustom ? '#fde68a' : '#e5e7eb', fontSize: 13 }}>
          <strong>Current shift:</strong>{' '}
          {isCustom
            ? <><span style={{ color: '#92400e' }}>{currentShift?.start || '10:00'} – {currentShift?.end || '19:00'}</span> <span style={{ fontSize: 11, color: '#a16207' }}>(Custom override)</span></>
            : <span style={{ color: '#6b7280' }}>10:00 – 19:00 <span style={{ fontSize: 11 }}>(Default — no override set)</span></span>
          }
        </div>

        {msg && (
          <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 6, fontSize: 12, background: msg.type === 'success' ? '#d1fae5' : '#fee2e2', color: msg.type === 'success' ? '#065f46' : '#991b1b' }}>
            {msg.text}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <label className="field">
            <span>Override Start Time</span>
            <input type="time" value={start} onChange={e => setStart(e.target.value)}
              placeholder="10:00" />
          </label>
          <label className="field">
            <span>Override End Time</span>
            <input type="time" value={end} onChange={e => setEnd(e.target.value)}
              placeholder="19:00" />
          </label>
        </div>
        <p style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4, marginBottom: 0 }}>
          Leave blank to use the default shift timing (10:00 – 19:00). The late calculation and half-day detection will adjust to these timings.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          {hasOverride && (
            <button className="btn btn-sm" onClick={reset} disabled={saving} style={{ color: 'var(--danger)' }}>
              Reset to Default
            </button>
          )}
        </div>
      </div>
    </div>
  )
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
