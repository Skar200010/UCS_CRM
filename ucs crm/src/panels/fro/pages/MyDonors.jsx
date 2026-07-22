import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyDonors, getDonorDetail, addDonorLog, markDonorSeen, uploadPaymentScreenshot, getDonorDonations, searchDonorsByMobile } from '../api/donors';
import { api } from '../../../api/auth';
import { SkeletonProfile } from '../../../components/Skeleton';
import { useRealtime } from '../../../hooks/useRealtime';
import { DatePicker } from '../components/ui';
import { TimePicker } from '../components/TimePicker';
import { useCall } from '../CallContext';
import { extractTransactionData } from '../utils/ocr';

function callFmt(seconds) {
  if (seconds == null) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const NOT_CONNECTED = [
  { id: 'busy', label: 'Busy' }, { id: 'ringing', label: 'Ringing' },
  { id: 'unreachable', label: 'Unreachable' }, { id: 'switched_off', label: 'Switched Off' },
  { id: 'wrong_number', label: 'Wrong Number' }, { id: 'invalid', label: 'Invalid' },
  { id: 'rejected', label: 'Rejected' },
];
const PROJECTS = [
  'Mission Annapurna', 'Mission Vidhya', 'Mission Aurat', 'Mission Bezubaan',
  'Mission Atmanirbhar', 'Mission Arogya', 'Sevak Seva Kendra', 'Mission Eco-Warriors',
];

const CONNECTED = [
  { id: 'lead_done', label: 'Lead Done' }, { id: 'scheduled', label: 'Follow Up' },
  { id: 'callback', label: 'Callback' },
  { id: 'visit_donate', label: 'Visit & Donate' }, { id: 'promise_to_pay', label: 'Promise to Pay' },
  { id: 'payment_pending', label: 'Payment Pending' }, { id: 'already_donated', label: 'Already Donated' },
  { id: 'not_interested_now', label: 'Not Interested Now' }, { id: 'language_barrier', label: 'Language Barrier' },
  { id: 'transferred_senior', label: 'Transferred to Senior' }, { id: 'query_complaint', label: 'Query/Complaint' },
  { id: 'receipt_request', label: 'Request Receipt/Info' },
];
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const ALL_DISPOSITIONS = [...NOT_CONNECTED, ...CONNECTED];
const CONNECTED_IDS = new Set(CONNECTED.map(d => d.id));
const isConnected = (id) => CONNECTED_IDS.has(id);
const findDisp = (id) => ALL_DISPOSITIONS.find(d => d.id === id);
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

const STATUS_PILL_MAP = {
  pending: 'pill-yellow', contacted: 'pill-blue', scheduled: 'pill-purple',
  callback: 'pill-purple', follow_up: 'pill-purple', busy: 'pill-gray', ringing: 'pill-gray',
  unreachable: 'pill-gray', switched_off: 'pill-gray', wrong_number: 'pill-gray',
  invalid_number: 'pill-gray', rejected: 'pill-red', lead_done: 'pill-green',
  visit_donate: 'pill-green', donation_collected: 'pill-green', promise_to_pay: 'pill-blue',
  payment_pending: 'pill-yellow', already_donated: 'pill-gray', not_interested: 'pill-red',
  not_interested_now: 'pill-red', language_barrier: 'pill-gray', transferred_senior: 'pill-blue',
  query_complaint: 'pill-yellow', receipt_request: 'pill-blue', payment_rejected: 'pill-red',
};

const WALKTHROUGH_STEPS = [
  { icon: 'call', title: 'Start Call', desc: 'Click the green Call button to initiate a call with the donor. The call timer starts automatically.', color: '#16a34a' },
  { icon: 'call_end', title: 'End Call', desc: 'Click End Call when your conversation is finished. Your call duration is tracked.', color: '#dc2626' },
  { icon: 'free_cancellation', title: 'Take Break', desc: 'Use the break button in the top bar when you need a break. Break time is limited to 1 hour per day.', color: '#d97706' },
  { icon: 'list_alt', title: 'Select Disposition', desc: 'Choose a Connected or Not Connected status from the dropdowns based on the call outcome.', color: '#7c3aed' },
  { icon: 'skip_next', title: 'Log & Next', desc: 'Save the disposition and auto-advance to the next donor in your list.', color: '#0891b2' },
  { icon: 'search', title: 'Search Donors', desc: 'Search for any donor by name or mobile number using the search bar above the disposition form.', color: '#2563eb' },
  { icon: 'chat', title: 'WhatsApp Chat', desc: 'Send a WhatsApp message directly to the donor using the green chat button next to the call button.', color: '#25D366' },
];

const initials = (name) => (name || '').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

export default function MyDonors() {
  const navigate = useNavigate()
  const [donors, setDonors] = useState([]);
  const [dataTab, setDataTab] = useState('new');
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [leadAmount, setLeadAmount] = useState('');
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [dateConfirmed, setDateConfirmed] = useState(false);
  const [callbackTime, setCallbackTime] = useState('');
  const [leadScreenshot, setLeadScreenshot] = useState(null);
  const [leadAddress, setLeadAddress] = useState('');
  const [leadPan, setLeadPan] = useState('');
  const [panError, setPanError] = useState('');
  const [leadDob, setLeadDob] = useState('');
  const [projectName, setProjectName] = useState('');
  const [leadRemark, setLeadRemark] = useState('');
  const [showRemark, setShowRemark] = useState(false);
  const [upiTransactionId, setUpiTransactionId] = useState('');
  const [transactionDatetime, setTransactionDatetime] = useState('');
  const [ocrFromName, setOcrFromName] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [donations, setDonations] = useState([]);
  const [donationYear, setDonationYear] = useState('this_year');
  const [donationLoading, setDonationLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchingAll, setSearchingAll] = useState(false);
  const [returnToDonor, setReturnToDonor] = useState(null);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(() => !localStorage.getItem('fro_walkthrough_seen'));
  const [walkthroughStep, setWalkthroughStep] = useState(0);
  const searchRef = useRef(null);
  const debounceReloadRef = useRef(null);
  const initialMountRef = useRef(true);
  const { isOnCall, activeCall, startCall, endCall, todayStats, startDonorView, endDonorView } = useCall();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const load = async (tab) => {
      try {
        // Capture localStorage snapshot BEFORE any state changes (avoids race condition)
        const savedSnapshot = (() => { try { return JSON.parse(localStorage.getItem(`${tab}_donor_progress`)); } catch { return null; } })();

        const r = await getMyDonors(null, null, { newOnly: tab === 'new', oldOnly: tab === 'old' });
        if (cancelled) return;
        setDonors(r);
        setMessage(null);
        let restored = false;

        // Restore from localStorage snapshot (captured before state changes)
        if (savedSnapshot) {
          const { id, idx } = savedSnapshot;
          if (id) {
            const found = r.findIndex(d => d.id === id);
            if (found >= 0) { setIndex(found); restored = true; }
          }
          if (!restored && typeof idx === 'number' && idx < r.length) {
            setIndex(idx); restored = true;
          }
        }

        // Fallback to backend progress (for cross-device restore)
        if (!restored) {
          try {
            const progress = await api('/fro/progress', { _prefix: 'ucs' });
            const savedId = tab === 'new' ? progress?.new_donor_id : progress?.old_donor_id;
            if (savedId) {
              const found = r.findIndex(d => d.id === savedId);
              if (found >= 0) { setIndex(found); restored = true; }
            }
            if (!restored) {
              const savedIndex = tab === 'new' ? progress?.new_donor_index : progress?.old_donor_index;
              if (savedIndex != null && savedIndex < r.length) {
                setIndex(savedIndex); restored = true;
              }
            }
          } catch {}
        }

        if (!restored) setIndex(0);
      } catch (err) {
        if (!cancelled) setMessage({ type: 'error', text: err.message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // On first mount, restore the saved tab and position from progress
    (async () => {
      if (initialMountRef.current) {
        initialMountRef.current = false;
        try {
          const progress = await api('/fro/progress', { _prefix: 'ucs' });
          if (progress?.data_tab && progress.data_tab !== dataTab) {
            setDataTab(progress.data_tab);
            return;
          }
        } catch {}
      }
      load(dataTab);
    })();

    return () => { cancelled = true; };
  }, [dataTab]);

  useEffect(() => {
    if (donors.length > 0 && index >= donors.length) {
      setIndex(0);
    }
  }, [donors.length]);

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [message]);

  useEffect(() => {
    if (donors[index]) {
      endDonorView(false)
      startDonorView(donors[index].id)
    }
  }, [index]);

  const reloadDonors = useCallback(() => {
    getMyDonors(null, null, { newOnly: dataTab === 'new', oldOnly: dataTab === 'old' }).then(r => { setDonors(r); }).catch(() => {});
  }, [dataTab]);

  const debouncedReload = useCallback(() => {
    if (debounceReloadRef.current) clearTimeout(debounceReloadRef.current);
    debounceReloadRef.current = setTimeout(() => reloadDonors(), 2000);
  }, [reloadDonors]);

  useRealtime('fro_assignments', { event: 'INSERT', onInsert: () => debouncedReload() });

  const saveProgress = useCallback((tab, donorId, donorIndex) => {
    if (!donorId) return;
    const body = { data_tab: tab };
    if (tab === 'new') {
      body.new_donor_id = donorId;
      body.new_donor_index = donorIndex;
    } else {
      body.old_donor_id = donorId;
      body.old_donor_index = donorIndex;
    }
    api('/fro/progress', { method: 'PUT', body: JSON.stringify(body), _prefix: 'ucs' }).catch(() => {});
  }, []);

  const switchTab = (tab) => {
    if (donor) {
      saveProgress(dataTab, donor.id, index);
      // Save current tab's progress to tab-specific key (avoids cross-tab overwrite)
      localStorage.setItem(`${dataTab}_donor_progress`, JSON.stringify({ id: donor.id, idx: index }));
    }
    setSelected(null);
    setDataTab(tab);
  };

  const donor = donors[index];

  useEffect(() => {
    if (!donor) return;
    localStorage.setItem('mydonors_current_donor', JSON.stringify({ id: donor.id, ngo_id: donor.ngo_id, idx: index }));
  }, [donor?.id, donor?.ngo_id, index]);

  useEffect(() => {
    return () => {
      if (donor) saveProgress(dataTab, donor.id, index);
    };
  }, [donor?.id, dataTab]);
  const logs = detail?.logs || [];
  const totalCollected = detail?.total_collected || 0;
  const nextSchedule = detail?.next_schedule;

  const loadDetail = useCallback(() => {
    if (!donor) return;
    setDetailLoading(true);
    if (donor.is_new) {
      markDonorSeen(donor.id, donor.ngo_id).then(() => {
        setDonors(prev => prev.map(d =>
          d.id === donor.id && d.ngo_id === donor.ngo_id ? { ...d, is_new: false } : d
        ));
      }).catch(err => console.error('markDonorSeen error:', err));
    }
    getDonorDetail(donor.id, donor.ngo_id).then(d => { setDetail(d); setShowAllLogs(false); }).catch(err => console.error('getDonorDetail error:', err)).finally(() => setDetailLoading(false));
  }, [donor?.id, donor?.ngo_id]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const handleDropdownChange = (detailId) => {
    setSelected(detailId);
    setMessage(null);
    if (detailId === 'scheduled') {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      setScheduledDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      setScheduledTime('');
      setDateConfirmed(false);
    }
    if (detailId === 'callback') {
      const now = new Date();
      setCallbackTime(now.toTimeString().slice(0, 5));
    }
    if (detailId === 'lead_done') {
      setProjectName(donor?.donor_project || '');
      setLeadAmount('');
      setPanError('');
    } else {
      setLeadScreenshot(null);
      setScreenshotPreview(null);
      setLeadAddress('');
      setLeadPan('');
      setPanError('');
      setLeadDob('');
      setProjectName('');
      setLeadAmount('');
      setUpiTransactionId('');
      setTransactionDatetime('');
      setOcrFromName('');
      setOcrLoading(false);
    }
  };

  const [screenshotPreview, setScreenshotPreview] = useState(null);

  const handleScreenshotChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result;
      const base64 = result.split(',')[1];
      setLeadScreenshot({ base64, mime: file.type });
      setScreenshotPreview(result);
      setOcrLoading(true);
      try {
        const { upiTransactionId, transactionDatetime, amount, fromName } = await extractTransactionData(result);
        if (upiTransactionId) setUpiTransactionId(upiTransactionId);
        if (transactionDatetime) {
          const dt = new Date(transactionDatetime);
          if (!isNaN(dt.getTime())) {
            setTransactionDatetime(dt.toISOString().slice(0, 16));
          }
        }
        if (amount && !leadAmount) setLeadAmount(amount);
        if (fromName) setOcrFromName(fromName);
      } catch {}
      setOcrLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const loadDonations = async (year) => {
    if (!donor) return;
    setDonationLoading(true);
    try {
      const data = await getDonorDonations(donor.id, donor.ngo_id, year);
      setDonations(data);
    } catch (err) {
      setDonations([]);
    } finally {
      setDonationLoading(false);
    }
  };

  const openDonationModal = () => {
    setShowDonationModal(true);
    setDonationYear('this_year');
    loadDonations('this_year');
  };

  const handleDonationYearChange = (year) => {
    setDonationYear(year);
    loadDonations(year);
  };

  const handleSave = async () => {
    if (!selected) { setMessage({ type: 'error', text: 'Select a disposition' }); return; }
    if (selected === 'scheduled' && (!scheduledDate || !scheduledTime)) { setMessage({ type: 'error', text: 'Select date & time' }); return; }
    if (selected === 'callback' && !callbackTime) { setMessage({ type: 'error', text: 'Select time for callback' }); return; }

    setSaving(true); setMessage(null);
    try {
      const logData = {
        action: 'disposition',
        disposition_category: isConnected(selected) ? 'connected' : 'not_connected',
        disposition_detail: selected,
        notes: notes || null,
        ngo_id: donor.ngo_id,
      };
      if (selected === 'scheduled') logData.scheduled_at = new Date(scheduledDate + 'T' + scheduledTime + ':00').toISOString();
      if (selected === 'callback') {
        const today = new Date();
        const [h, m] = callbackTime.split(':');
        today.setHours(+h, +m, 0, 0);
        logData.scheduled_at = today.toISOString();
      }
      if (selected === 'lead_done') {
        if (leadScreenshot) {
          const uploadResult = await uploadPaymentScreenshot(leadScreenshot.base64, leadScreenshot.mime);
          logData.payment_screenshot_url = uploadResult.file_url;
        }
        logData.donor_address = leadAddress || null;
        logData.pan_number = leadPan || null;
        logData.donor_dob = leadDob || null;
        logData.project_name = projectName || null;
        logData.amount_collected = leadAmount !== '' ? Number(leadAmount) : null;
        logData.remark = leadRemark || null;
        logData.upi_transaction_id = upiTransactionId || null;
        logData.transaction_datetime = transactionDatetime ? new Date(transactionDatetime).toISOString() : null;
      }
      await addDonorLog(donor.id, logData);
      if (selected) endCall();

      if (returnToDonor) {
        const newDonors = await getMyDonors(null, null, { newOnly: dataTab === 'new', oldOnly: dataTab === 'old' });
        setDonors(newDonors);
        const returnIdx = newDonors.findIndex(d => d.id === returnToDonor.id && d.ngo_id === returnToDonor.ngo_id);
        if (returnIdx >= 0) {
          setIndex(returnIdx);
        } else {
          setIndex(Math.min(returnToDonor.idx, Math.max(0, newDonors.length - 1)));
        }
        setReturnToDonor(null);
      } else {
        const nextIdx = index < donors.length - 1 ? index + 1 : 0;
        setIndex(nextIdx);
        const nextDonor = donors[nextIdx];
        if (nextDonor) saveProgress(dataTab, nextDonor.id, nextIdx);
      }
      setSelected(null); setNotes(''); setScheduledDate(''); setScheduledTime(''); setCallbackTime(''); setLeadScreenshot(null); setScreenshotPreview(null); setLeadAddress(''); setLeadPan(''); setPanError(''); setLeadDob(''); setProjectName(''); setLeadAmount(''); setLeadRemark(''); setShowRemark(false); setUpiTransactionId(''); setTransactionDatetime(''); setOcrFromName(''); setOcrLoading(false);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally { setSaving(false); }
  };

  const handleSearch = useCallback((q) => {
    setSearchQuery(q);
    if (!q || q.trim().length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    const term = q.toLowerCase().trim();
    const filtered = donors.filter(d =>
      (d.donor_name || '').toLowerCase().includes(term) ||
      (d.donor_mobile || '').includes(term)
    );
    setSearchResults(filtered);
    setShowSearchDropdown(filtered.length > 0 || term.length >= 2);
  }, [donors]);

  const handleSelectSearchResult = (resultIdx) => {
    const r = searchResults[resultIdx];
    const donorId = r?.id || r?.donor_id;
    const actualIdx = donors.findIndex(d => d.id === donorId);
    if (actualIdx >= 0) {
      setReturnToDonor({ id: donor.id, ngo_id: donor.ngo_id, idx: index });
      setIndex(actualIdx);
    } else {
      setMessage({ type: 'error', text: 'Donor not in current list. Try navigating to the correct view.' });
    }
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchDropdown(false);
  };

  const handleSearchAll = async () => {
    if (!searchQuery || searchQuery.trim().length < 2) return;
    setSearchingAll(true);
    try {
      const backendResults = await searchDonorsByMobile(searchQuery.trim());
      if (backendResults && backendResults.length > 0) {
        setSearchResults(backendResults);
        setShowSearchDropdown(true);
      } else {
        setMessage({ type: 'error', text: 'No donors found with this mobile number' });
        setShowSearchDropdown(false);
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Search failed: ' + err.message });
    } finally {
      setSearchingAll(false);
    }
  };

  useEffect(() => {
    if (!showSearchDropdown) return;
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSearchDropdown]);

  const handleButtonClick = () => {
    if (selected) { handleSave(); return; }
    if (returnToDonor) {
      setIndex(returnToDonor.idx);
      setReturnToDonor(null);
      return;
    }
    if (index < donors.length - 1) { const nextIdx = index + 1; setIndex(nextIdx); const nextDonor = donors[nextIdx]; if (nextDonor) saveProgress(dataTab, nextDonor.id, nextIdx); return; }
    setMessage({ type: 'error', text: 'No more donors' });
  };

  const fmt = callFmt

  if (loading) return <SkeletonProfile />;

  if (donors.length === 0) {
    return (
      <div className="bento-grid">
        <div className="bento-col-12">
          <div className="bento-card fro-empty-state">
            <div className="fro-empty-icon">
              <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'var(--sage)', opacity: .5 }}>{dataTab === 'new' ? 'fiber_new' : 'history'}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>No {dataTab === 'new' ? 'new' : 'old'} data assigned</div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', maxWidth: 280, textAlign: 'center', lineHeight: 1.5 }}>
              {dataTab === 'new'
                ? 'New data will appear here once distributed to your station.'
                : 'Old data will appear here once uploaded to your station.'}
            </div>
            {dataTab === 'old' && (
              <button onClick={() => switchTab('new')} className="fro-empty-switch">
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>fiber_new</span>
                Try New Data tab
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const timelineIcon = (log) => {
    if (log.action === 'disposition') return log.disposition_category === 'connected' ? 'check_circle' : 'cancel';
    const map = { call: 'call', visit: 'home', message: 'mail', follow_up: 'history', donation: 'payments', note: 'note' };
    return map[log.action] || 'circle';
  };

  const formatTime = (d) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).toUpperCase();

  const statusPill = (status) => {
    const label = status ? status.replace(/_/g, ' ') : 'unknown';
    return <span className={`pill ${STATUS_PILL_MAP[status] || 'pill-gray'}`}>{label}</span>;
  };

  const dismissWalkthrough = () => {
    localStorage.setItem('fro_walkthrough_seen', '1');
    setShowWalkthrough(false);
  };

  const step = WALKTHROUGH_STEPS[walkthroughStep];

  return (<>
    {showWalkthrough && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(3px)' }} onClick={dismissWalkthrough}>
        <div className="walkthrough-card" onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: 420, maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,.25)', overflow: 'hidden', position: 'relative' }}>
          <span onClick={dismissWalkthrough} style={{ position: 'absolute', top: 12, right: 12, cursor: 'pointer', color: 'var(--ink-soft)', fontSize: 18, zIndex: 1, lineHeight: 1, padding: 4, borderRadius: 6, transition: 'background .12s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </span>

          <div style={{ padding: '32px 32px 24px', textAlign: 'center' }}>
            <div className="walkthrough-icon-ring" style={{ width: 72, height: 72, borderRadius: '50%', background: `${step.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: `2px solid ${step.color}30` }}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, color: step.color }}>{step.icon}</span>
            </div>

            <div key={walkthroughStep} className="walkthrough-content-enter" style={{ minHeight: 90 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                Step {walkthroughStep + 1} of {WALKTHROUGH_STEPS.length}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>{step.title}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.6, maxWidth: 320, margin: '0 auto' }}>{step.desc}</div>
            </div>
          </div>

          <div style={{ padding: '16px 32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {WALKTHROUGH_STEPS.map((s, i) => (
                <div key={i} style={{ position: 'relative', width: i === walkthroughStep ? 24 : 8, height: 8, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden', transition: 'width .25s ease' }}>
                  {i === walkthroughStep && (
                    <div className="walkthrough-dot-fill" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999, background: s.color }} />
                  )}
                  {i < walkthroughStep && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, borderRadius: 999, background: s.color }} />}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', justifyContent: 'space-between' }}>
              {walkthroughStep > 0 ? (
                <button onClick={() => setWalkthroughStep(s => s - 1)}
                  style={{ padding: '8px 18px', border: '1px solid var(--line)', borderRadius: 8, background: '#fff', color: 'var(--ink)', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', transition: 'all .12s' }}>
                  ← Back
                </button>
              ) : (
                <span onClick={dismissWalkthrough} style={{ fontSize: 11, color: 'var(--ink-soft)', cursor: 'pointer', padding: '8px 10px', textDecoration: 'underline' }}>Skip tour</span>
              )}

              {walkthroughStep < WALKTHROUGH_STEPS.length - 1 ? (
                <button onClick={() => setWalkthroughStep(s => s + 1)}
                  style={{ padding: '8px 22px', border: 'none', borderRadius: 8, background: 'var(--sage)', color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', transition: 'all .12s' }}>
                  Next →
                </button>
              ) : (
                <button onClick={dismissWalkthrough}
                  style={{ padding: '8px 22px', border: 'none', borderRadius: 8, background: 'var(--sage)', color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', transition: 'all .12s' }}>
                  Get Started ✓
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
    <div className="detail-card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="detail-split" style={{ flex: 1, minHeight: 0 }}>
        {/* LEFT PANEL — merged profile + details */}
        <div className="detail-left" style={{ padding: 12 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* Profile header */}
            <div style={{ textAlign: 'center', paddingBottom: 10, borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
              <div className="detail-avatar">{initials(donor.donor_name)}</div>
              <div className="detail-name">{donor.donor_name}</div>
              <div className="fro-donor-position">#{index + 1} of {donors.length}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {donor.is_new && (
                    <span style={{ padding: '1px 6px', borderRadius: 4, background: '#16a34a', color: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: .5 }}>NEW</span>
                  )}
                  {dataTab === 'old' && (
                    <span style={{ padding: '1px 6px', borderRadius: 4, background: '#7c3aed', color: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: .5 }}>OLD</span>
                  )}
                {statusPill(donor.status || 'pending')}
                {donor.ngo_name && (
                  <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '1px 7px', borderRadius: 999, fontSize: 8, fontWeight: 700 }}>{donor.ngo_names?.join(', ') || donor.ngo_name}</span>
                )}
              </div>
            </div>

            {/* Telecaller call button + WhatsApp */}
            <div style={{ margin: '10px 0', borderRadius: 10, overflow: 'hidden', display: 'flex', gap: 6 }}>
              <div style={{ flex: 1, borderRadius: 10, overflow: 'hidden' }}>
                {isOnCall && activeCall?.donorId === donor.id ? (
                  <button onClick={(e) => { e.stopPropagation(); endCall() }}
                    style={{ width: '100%', padding: '10px 14px', border: 'none', background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all .15s' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#fff' }}>call_end</span>
                    </div>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontSize: 10, color: '#991b1b', fontWeight: 500 }}>On Call</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>{callFmt(todayStats?.totalSeconds || 0)}</div>
                    </div>
                  </button>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); startCall(donor) }}
                    style={{ width: '100%', padding: '10px 14px', border: 'none', background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all .15s' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#fff' }}>call</span>
                    </div>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontSize: 10, color: '#166534', fontWeight: 500 }}>Call</div>
                      <div style={{ fontSize: 11, color: '#15803d', fontWeight: 600 }}>{donor.donor_mobile || 'No number'}</div>
                    </div>
                  </button>
                )}
              </div>
              <button onClick={(e) => { e.stopPropagation(); navigate(`/fro/whatsapp-chat?phone=${donor.donor_mobile || ''}`) }}
                style={{ width: 48, border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #25D366 0%, #1da851 100%)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </button>
            </div>
            {/* Fields */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="detail-field-row">
                <div className="fld">
                  <label>City</label>
                  <div>{donor.donor_city || 'NA'}</div>
                </div>
                <div className="fld fld-sm">
                  <label>Amount</label>
                  <div>₹{Number(donor.donor_amount || 0).toLocaleString('en-IN')}</div>
                </div>
              </div>
              <div className="detail-field-row">
                <div className="fld">
                  <label>Email</label>
                  <div style={{ fontStyle: donor.donor_email ? 'normal' : 'italic', color: donor.donor_email ? 'inherit' : 'var(--ink-soft)' }}>{donor.donor_email || 'No email'}</div>
                </div>
              </div>
              <div className="detail-field-row">
                <div className="fld" onClick={openDonationModal} style={{ cursor: 'pointer' }}>
                  <label>Donations
                    <span style={{ fontSize: 9, marginLeft: 4, opacity: .5 }}>↗</span>
                  </label>
                  <div style={{ color: 'var(--sage)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--sage)' }}>payments</span>
                    {donor.donation_count || 0} time{donor.donation_count !== 1 ? 's' : ''} (₹{Number(donor.total_donated || 0).toLocaleString('en-IN')})
                  </div>
                </div>
              </div>
              <div className="detail-field-row">
                <div className="fld">
                  <label>Address</label>
                  <div style={{ fontStyle: detail?.donor_address ? 'normal' : 'italic', color: detail?.donor_address ? 'inherit' : 'var(--ink-soft)' }}>{detail?.donor_address || donor.donor_address || 'No address'}</div>
                </div>
              </div>
              {donor.donor_pan && (
                <div className="detail-field-row">
                  <div className="fld">
                    <label>PAN</label>
                    <div>{donor.donor_pan}</div>
                  </div>
                </div>
              )}
              {donor.donor_dob && (
                <div className="detail-field-row">
                  <div className="fld">
                    <label>DOB</label>
                    <div>{donor.donor_dob}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Status block */}
            {nextSchedule && !nextSchedule.is_completed && (
              <div className="detail-status-block" style={{
                background: new Date(nextSchedule.scheduled_at) < new Date() ? 'var(--md-error-container, #fef2f2)' : '#e0f2fe',
                color: new Date(nextSchedule.scheduled_at) < new Date() ? 'var(--md-error, #dc2626)' : '#0369a1',
                flexShrink: 0, marginTop: 8,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{new Date(nextSchedule.scheduled_at) < new Date() ? 'warning' : 'schedule'}</span>
                {new Date(nextSchedule.scheduled_at) < new Date() ? 'Overdue schedule' : 'Next: ' + new Date(nextSchedule.scheduled_at).toLocaleString()}
              </div>
            )}
            {donor.status === 'payment_rejected' && (
              <div className="detail-status-block" style={{ background: 'var(--md-error-container, #fef2f2)', color: 'var(--md-error, #dc2626)', flexShrink: 0, marginTop: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>error</span>
                Payment rejected by Accounts
              </div>
            )}
          </div>
        </div>

        {/* MIDDLE PANEL — Status (55%) */}
        <div className="detail-mid" style={{ padding: '12px 0 12px 8px' }}>
          {/* New/Old Data Tabs */}
          <div className="fro-tab-segment">
            <button onClick={() => switchTab('new')}
              className={`fro-tab-btn ${dataTab === 'new' ? 'fro-tab-active-new' : ''}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>fiber_new</span>
              New Data
              <span className="fro-tab-count">{donors.length > 0 && dataTab === 'new' ? donors.length : ''}</span>
            </button>
            <button onClick={() => switchTab('old')}
              className={`fro-tab-btn ${dataTab === 'old' ? 'fro-tab-active-old' : ''}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>history</span>
              Old Data
              <span className="fro-tab-count">{donors.length > 0 && dataTab === 'old' ? donors.length : ''}</span>
            </button>
          </div>
          {/* Search donor by mobile */}
          <div ref={searchRef} style={{ position: 'relative', marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', background: 'var(--card-bg)', borderRadius: 8, border: '1px solid var(--line)', padding: '4px 8px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--ink-soft)' }}>search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                onFocus={() => { if (searchResults.length > 0) setShowSearchDropdown(true); }}
                placeholder="Search donor by name or mobile..."
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 11, fontFamily: 'inherit', background: 'transparent', padding: '4px 0' }}
              />
              {searchQuery && (
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--ink-soft)', cursor: 'pointer' }}
                  onClick={() => { setSearchQuery(''); setSearchResults([]); setShowSearchDropdown(false); }}>close</span>
              )}
              <button onClick={handleSearchAll} disabled={searchingAll || searchQuery.trim().length < 2}
                style={{ padding: '3px 8px', border: 'none', borderRadius: 6, background: 'var(--sage)', color: '#fff', fontSize: 9, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {searchingAll ? '...' : 'Search All'}
              </button>
            </div>
            {showSearchDropdown && searchResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--line)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.12)', zIndex: 100, maxHeight: 240, overflowY: 'auto', marginTop: 2 }}>
                {searchResults.map((r, i) => (
                  <div key={`${r.id || r.donor_id}-${r.ngo_id || ''}`} onClick={() => handleSelectSearchResult(i)}
                    style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: i < searchResults.length - 1 ? '1px solid var(--line)' : 'none', display: 'flex', alignItems: 'center', gap: 8, transition: 'background .1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--md-primary-container, #e0e7ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--md-on-primary-container, #4338ca)', flexShrink: 0 }}>
                      {initials(r.donor_name || (r.donor_name ?? ''))}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#111827' }}>{r.donor_name || 'Unknown'}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{r.donor_mobile || ''}{r.ngo_name ? ` · ${r.ngo_name}` : ''}{r.status ? ` · ${r.status.replace(/_/g, ' ')}` : ''}</div>
                    </div>
                    <span className={`pill ${STATUS_PILL_MAP[r.status] || 'pill-gray'}`} style={{ fontSize: 8, padding: '1px 5px' }}>{r.status ? r.status.replace(/_/g, ' ') : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {message && (
            <div className={`detail-message ${message.type}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{message.type === 'error' ? 'error' : 'check_circle'}</span>
              {message.text}
            </div>
          )}

          {/* Connection Status card */}
          <div className="detail-card" style={{ flex: 1, minHeight: 0 }}>
            <div className="detail-card-head">Connection Status</div>
            <div className="detail-card-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="detail-dropdown-row">
                <div className="dd">
                  <label>Connected</label>
                  <select value={selected !== null && isConnected(selected) ? selected : ''} onChange={e => { if (e.target.value) handleDropdownChange(e.target.value); }}
                    style={{ borderColor: selected !== null && isConnected(selected) ? '#16a34a' : undefined }}>
                    <option value="">— Select —</option>
                    {CONNECTED.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                  </select>
                </div>
                <div className="dd">
                  <label>Not Connected</label>
                  <select value={selected !== null && !isConnected(selected) ? selected : ''} onChange={e => { if (e.target.value) handleDropdownChange(e.target.value); }}
                    style={{ borderColor: selected !== null && !isConnected(selected) ? '#dc2626' : undefined }}>
                    <option value="">— Select —</option>
                    {NOT_CONNECTED.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                  </select>
                </div>
              </div>

              {selected === 'scheduled' && (
                <>
                  <div className="detail-field-row">
                    <div className="fld">
                      <label>Follow Up Date</label>
                        <DatePicker value={scheduledDate} onChange={e => { setScheduledDate(e.target.value); setDateConfirmed(true); }} placeholder="Select date" min={tomorrowStr} />
                    </div>
                  </div>
                  {dateConfirmed && (
                    <div className="detail-field-row">
                      <div className="fld">
                        <label>Follow Up Time</label>
                        <TimePicker value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} placeholder="Select time" />
                      </div>
                    </div>
                  )}
                </>
              )}

              {selected === 'callback' && (
                <div className="detail-field-row">
                  <div className="fld">
                    <label>Callback Time (Today)</label>
                    <TimePicker value={callbackTime} onChange={e => setCallbackTime(e.target.value)} placeholder="Select time" />
                  </div>
                </div>
              )}

              {selected === 'lead_done' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="detail-field-row">
                    <div className="fld">
                      <label>Project</label>
                      <select value={projectName} onChange={e => setProjectName(e.target.value)}>
                        <option value="">— Select Project —</option>
                        {PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="detail-field-row">
                    <div className="fld">
                      <label>Amount Collected</label>
                      <input type="number" min="0" value={leadAmount}
                        onChange={e => setLeadAmount(e.target.value)} placeholder="e.g. 5000" />
                    </div>
                  </div>
                  <div className="detail-field-row">
                    <div className="fld">
                      <label>Screenshot</label>
                      <label htmlFor="ss-input" className="ss-upload">
                        {screenshotPreview ? (
                          <div style={{ position: 'relative' }}>
                            <img src={screenshotPreview} alt="preview" className="ss-preview"
                              onClick={e => { e.preventDefault(); window.open(screenshotPreview, '_blank'); }} />
                            <span className="ss-remove"
                              onClick={e => { e.preventDefault(); setLeadScreenshot(null); setScreenshotPreview(null); document.getElementById('ss-input').value = ''; }}>close</span>
                          </div>
                        ) : (
                          <div className="ss-placeholder">
                            <span className="material-symbols-outlined">upload</span>
                            <span>Upload screenshot</span>
                          </div>
                        )}
                      </label>
                      <input id="ss-input" type="file" accept="image/*" onChange={handleScreenshotChange} />
                    </div>
                  </div>
                  <div className="detail-field-row">
                    <div className="fld">
                      <label>UPI Transaction ID {ocrLoading && <span style={{fontSize:9,color:'var(--md-outline)',marginLeft:4}}>OCR…</span>}</label>
                      <input type="text" value={upiTransactionId} onChange={e => setUpiTransactionId(e.target.value)} placeholder="Auto-detected from screenshot" />
                    </div>
                    <div className="fld">
                      <label>Transaction Date/Time</label>
                      <input type="datetime-local" value={transactionDatetime} onChange={e => setTransactionDatetime(e.target.value)} />
                    </div>
                  </div>
                  {ocrFromName && (
                    <div className="detail-field-row">
                      <div className="fld">
                        <label>Detected From Name</label>
                        <input type="text" value={ocrFromName} onChange={e => setOcrFromName(e.target.value)} placeholder="Auto-detected from screenshot" style={{color:'var(--md-outline)',fontStyle:'italic'}} readOnly />
                      </div>
                    </div>
                  )}
                  <div className="detail-field-row">
                    <div className="fld">
                      <label>Address</label>
                      <input type="text" value={leadAddress} onChange={e => setLeadAddress(e.target.value)} placeholder="Donor address" />
                    </div>
                  </div>
                  <div className="detail-field-row">
                    <div className="fld">
                      <label>PAN</label>
                      <input type="text" value={leadPan} onChange={e => {
                        const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                        setLeadPan(v);
                        if (v.length === 0) {
                          setPanError('');
                        } else if (!PAN_REGEX.test(v) && v.length === 10) {
                          setPanError('Invalid PAN — use format: ABCDE1234F');
                        } else if (v.length > 0 && v.length < 10) {
                          setPanError('PAN must be 10 characters');
                        } else {
                          setPanError('');
                        }
                      }} placeholder="e.g. ABCDE1234F" maxLength={10} style={{ borderColor: panError ? '#dc2626' : undefined }} />
                      {leadPan.length > 0 && panError && <span style={{ fontSize: 9, color: '#dc2626', marginTop: 1, display: 'block' }}>{panError}</span>}
                    </div>
                    <div className="fld">
                      <label>DOB</label>
                      <input type="date" value={leadDob} onChange={e => setLeadDob(e.target.value)} />
                    </div>
                  </div>
                  <div className="detail-field-row">
                    <div className="fld">
                      <button onClick={() => setShowRemark(!showRemark)}
                        style={{ padding:'6px 14px', border:`1px solid ${showRemark ? 'var(--sage)' : 'var(--line)'}`, borderRadius:6, background: showRemark ? 'var(--sage)' : '#fff', color: showRemark ? '#fff' : 'var(--ink)', fontSize:10, fontWeight:700, fontFamily:'inherit', cursor:'pointer', transition:'all .12s' }}>
                        {showRemark ? 'Hide Remark' : 'Add Remark'}
                      </button>
                    </div>
                  </div>
                  {showRemark && (
                    <div className="detail-field-row">
                      <div className="fld">
                        <textarea value={leadRemark} onChange={e => setLeadRemark(e.target.value)} rows={2} placeholder="Enter remark..." style={{ width:'100%', padding:'6px 8px', border:'1px solid var(--line)', borderRadius:6, fontSize:11, fontFamily:'inherit', resize:'vertical', boxSizing:'border-box' }} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div className="detail-notes">
                <label style={{ display: 'block', fontSize: 9, fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 3 }}>Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Add notes here..." />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL — Timeline (20%) */}
        <div className="detail-right" style={{ padding: '12px 12px 12px 0' }}>
          {/* Timeline card */}
          <div className="detail-card" style={{ flex: 1, minHeight: 0 }}>
            <div className="detail-card-head">
              <span>CRM Timeline</span>
              {totalCollected > 0 && <span style={{ color: 'var(--sage)', fontSize: 10 }}>₹{totalCollected.toLocaleString('en-IN')}</span>}
            </div>
            <div className="detail-card-scroll">
              {detailLoading ? (
                <div className="empty-timeline">Loading...</div>
              ) : logs.length === 0 ? (
                <div className="empty-timeline">No activity yet.</div>
              ) : (
                <div className="detail-timeline-list">
                  {logs.slice(0, showAllLogs ? logs.length : 12).map(log => {
                    const isDisp = log.action === 'disposition';
                    const cat = log.disposition_category;
                    const icon = timelineIcon(log);
                    const connected = isDisp && cat === 'connected';
                    const lbl = isDisp ? (log.disposition_detail?.replace(/_/g, ' ') || '') : log.action.replace(/_/g, ' ');
                    const bg = isDisp ? (connected ? '#f0fdf4' : '#fef2f2') : 'var(--bg)';
                    return (
                      <div key={log.id} className="detail-timeline-item" style={{ background: bg }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 12, color: connected ? 'var(--sage)' : 'var(--md-error, #dc2626)', flexShrink: 0, marginTop: 1 }}>{icon}</span>
                        <div className="tl-info">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span className="tl-lbl">{lbl}</span>
                            <span className="tl-time">{formatTime(log.created_at)}</span>
                          </div>
                          {log.notes && <div className="tl-note">{log.notes}</div>}
                          {log.amount_collected != null && <div className="tl-note" style={{ color: 'var(--sage)', fontWeight: 600 }}>₹{Number(log.amount_collected).toLocaleString('en-IN')}</div>}
                          {log.disposition_detail === 'lead_done' && (
                            <span style={{ fontSize: 8, fontWeight: 700, background: 'var(--md-tertiary-fixed, #e0e7ff)', padding: '1px 4px', borderRadius: 2, textTransform: 'uppercase', display: 'inline-block', marginTop: 1 }}>
                              {log.accounts_status === 'verified' ? 'Verified' : log.accounts_status === 'rejected' ? 'Rejected' : 'Pending'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {logs.length > 12 && (
                    <div style={{ textAlign: 'center', padding: '8px 0' }}>
                      <button onClick={() => setShowAllLogs(s => !s)}
                        style={{ padding: '5px 14px', border: '1px solid var(--line)', borderRadius: 6, background: 'transparent', fontSize: 10, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', color: 'var(--sage)' }}>
                        {showAllLogs ? `Show Less` : `View All ${logs.length} Logs`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div className="fro-action-bar">
      <button className="btn-prev" disabled={index === 0} onClick={() => { endDonorView(isOnCall && activeCall?.donorId === donor.id); setIndex(i => i - 1) }}>
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_back</span> Prev
      </button>

      <div className="fro-progress-info">
        {returnToDonor ? (
          <span className="fro-progress-label" style={{ color: 'var(--sage)' }}>Searched donor — NEXT to return</span>
        ) : (
          <span className="fro-progress-label">{index + 1} of {donors.length} processed</span>
        )}
        <div className="fro-progress">
          <div className="fro-progress-fill" style={{ width: donors.length > 0 ? `${((index + 1) / donors.length) * 100}%` : '0%' }} />
        </div>
      </div>

      {isOnCall && activeCall?.donorId === donor.id ? (
        <button onClick={endCall} className="fro-btn-end-call">
          <span className="fro-pulse-dot" />
          End Call
        </button>
      ) : (
        <button onClick={() => startCall(donor)} className="fro-btn-call">
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>call</span>
          Call Now
        </button>
      )}

      <button className="btn-next"
        disabled={saving || !selected}
        onClick={() => { endDonorView(isOnCall); handleButtonClick() }}>
        {saving ? 'Saving...' : selected ? (
          <><span className="material-symbols-outlined" style={{ fontSize: 13 }}>skip_next</span> Log {findDisp(selected)?.label || selected}</>
        ) : (
          <><span className="material-symbols-outlined" style={{ fontSize: 13 }}>skip_next</span> NEXT</>
        )}
      </button>
    </div>

    {/* Donation Modal */}
    {showDonationModal && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.4)' }} onClick={() => setShowDonationModal(false)}>
        <div style={{ background: '#fff', borderRadius: 12, width: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,.15)' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Donations — {donor.donor_name}</span>
            <span className="material-symbols-outlined" style={{ fontSize: 18, cursor: 'pointer', color: 'var(--ink-soft)' }} onClick={() => setShowDonationModal(false)}>close</span>
          </div>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>Show:</span>
            {['this_year', 'fy_2025_26', 'fy_2024_25', 'fy_2023_24'].map(y => (
              <button key={y} onClick={() => handleDonationYearChange(y)}
                style={{ padding: '4px 10px', border: `1px solid ${donationYear === y ? 'var(--sage)' : 'var(--line)'}`, borderRadius: 6, background: donationYear === y ? 'var(--sage)' : '#fff', color: donationYear === y ? '#fff' : 'var(--ink)', fontSize: 10, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', transition: 'all .12s' }}>
                {y === 'this_year' ? 'This Year' : y.replace(/fy_(\d{4})_(\d{2})/, 'FY $1\u2013$2')}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {donationLoading ? (
              <div style={{ textAlign: 'center', padding: 20, fontSize: 11, color: 'var(--ink-soft)' }}>Loading...</div>
            ) : donations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, fontSize: 11, color: 'var(--ink-soft)' }}>No donations for this period.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <th style={{ textAlign: 'left', padding: '5px 6px', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '5px 6px', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Amount</th>
                    <th style={{ textAlign: 'left', padding: '5px 6px', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Mode</th>
                    <th style={{ textAlign: 'left', padding: '5px 6px', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {donations.map((d, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '5px 6px' }}>{d.date ? new Date(d.date).toLocaleDateString('en-GB') : '—'}</td>
                      <td style={{ padding: '5px 6px', fontWeight: 600 }}>₹{Number(d.amount || 0).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '5px 6px' }}>{d.mode || '—'}</td>
                      <td style={{ padding: '5px 6px' }}><span className={`bento-pill ${d.status === 'verified' ? 'bento-pill-green' : d.status === 'rejected' ? 'bento-pill-red' : 'bento-pill-yellow'}`}>{d.status || '—'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line)', textAlign: 'right', fontSize: 10, color: 'var(--ink-soft)' }}>
            Total: ₹{donations.reduce((s, d) => s + Number(d.amount || 0), 0).toLocaleString('en-IN')}
          </div>
        </div>
      </div>
    )}
  </>);
}
