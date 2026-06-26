import { useState, useEffect, useCallback } from 'react';
import { getMyDonors, getDonorDetail, addDonorLog, markDonorSeen, uploadPaymentScreenshot, getDonorDonations } from '../api/donors';
import { SkeletonProfile } from '../../../components/Skeleton';

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
  { id: 'lead_done', label: 'Lead Done' }, { id: 'scheduled', label: 'Schedule' },
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

const STATUS_PILL_MAP = {
  pending: 'pill-yellow', contacted: 'pill-blue', scheduled: 'pill-purple',
  follow_up: 'pill-purple', busy: 'pill-gray', ringing: 'pill-gray',
  unreachable: 'pill-gray', switched_off: 'pill-gray', wrong_number: 'pill-gray',
  invalid_number: 'pill-gray', rejected: 'pill-red', lead_done: 'pill-green',
  visit_donate: 'pill-green', donation_collected: 'pill-green', promise_to_pay: 'pill-blue',
  payment_pending: 'pill-yellow', already_donated: 'pill-gray', not_interested: 'pill-red',
  not_interested_now: 'pill-red', language_barrier: 'pill-gray', transferred_senior: 'pill-blue',
  query_complaint: 'pill-yellow', receipt_request: 'pill-blue', payment_rejected: 'pill-red',
};

const initials = (name) => (name || '').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

export default function MyDonors() {
  const [donors, setDonors] = useState([]);
  const [filterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [leadScreenshot, setLeadScreenshot] = useState(null);
  const [leadAddress, setLeadAddress] = useState('');
  const [leadPan, setLeadPan] = useState('');
  const [panError, setPanError] = useState('');
  const [leadDob, setLeadDob] = useState('');
  const [projectName, setProjectName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [donations, setDonations] = useState([]);
  const [donationYear, setDonationYear] = useState('this_year');
  const [donationLoading, setDonationLoading] = useState(false);

  useEffect(() => {
    localStorage.removeItem('mydonors_index');
    setLoading(true);
    getMyDonors(filterStatus).then(r => {
      setDonors(r);
      setMessage(null);
      const saved = localStorage.getItem('mydonors_current_donor');
      if (saved) {
        try {
          const { id, ngo_id } = JSON.parse(saved);
          const found = r.findIndex(d => d.id === id && d.ngo_id === (ngo_id ?? null));
          setIndex(found >= 0 ? found : 0);
          return;
        } catch {}
      }
      setIndex(0);
    }).catch(err => setMessage({ type: 'error', text: err.message })).finally(() => setLoading(false));
  }, [filterStatus]);

  const donor = donors[index];

  useEffect(() => {
    if (donor) {
      localStorage.setItem('mydonors_current_donor', JSON.stringify({ id: donor.id, ngo_id: donor.ngo_id }));
    }
  }, [donor?.id, donor?.ngo_id]);
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
    getDonorDetail(donor.id, donor.ngo_id).then(setDetail).catch(err => console.error('getDonorDetail error:', err)).finally(() => setDetailLoading(false));
  }, [donor?.id, donor?.ngo_id]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const handleDropdownChange = (detailId) => {
    setSelected(detailId);
    setMessage(null);
    if (detailId === 'scheduled') {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 5 - now.getTimezoneOffset());
      setScheduledAt(now.toISOString().slice(0, 16));
    }
    if (detailId === 'lead_done') {
      setProjectName(donor?.donor_project || '');
      setPanError('');
    } else {
      setLeadScreenshot(null);
      setScreenshotPreview(null);
      setLeadAddress('');
      setLeadPan('');
      setPanError('');
      setLeadDob('');
      setProjectName('');
    }
  };

  const [screenshotPreview, setScreenshotPreview] = useState(null);

  const handleScreenshotChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.split(',')[1];
      setLeadScreenshot({ base64, mime: file.type });
      setScreenshotPreview(result);
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
    if (selected === 'scheduled' && !scheduledAt) { setMessage({ type: 'error', text: 'Select date & time' }); return; }

    setSaving(true); setMessage(null);
    try {
      const logData = {
        action: 'disposition',
        disposition_category: isConnected(selected) ? 'connected' : 'not_connected',
        disposition_detail: selected,
        notes: notes || null,
        ngo_id: donor.ngo_id,
      };
      if (selected === 'scheduled') logData.scheduled_at = new Date(scheduledAt + ':00').toISOString();
      if (selected === 'lead_done') {
        if (leadScreenshot) {
          const uploadResult = await uploadPaymentScreenshot(leadScreenshot.base64, leadScreenshot.mime);
          logData.screenshot = uploadResult.url;
        }
        logData.donor_address = leadAddress || null;
        logData.donor_pan = leadPan || null;
        logData.donor_dob = leadDob || null;
        logData.project_name = projectName || null;
      }
      await addDonorLog(donor.id, logData);
      setSelected(null); setNotes(''); setLeadScreenshot(null); setScreenshotPreview(null); setLeadAddress(''); setLeadPan(''); setPanError(''); setLeadDob(''); setProjectName('');
      const nextDonors = donors.filter(d => d.id !== donor.id || d.ngo_id !== donor.ngo_id);
      setDonors(nextDonors);
      if (index >= nextDonors.length && nextDonors.length > 0) setIndex(0);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally { setSaving(false); }
  };

  const handleButtonClick = () => {
    if (selected) { handleSave(); return; }
    setMessage({ type: 'error', text: 'Select a disposition' });
  };

  if (loading) return <SkeletonProfile />;

  if (donors.length === 0) {
    return (
      <div className="bento-grid">
        <div className="bento-col-12">
          <div className="bento-card" style={{ alignItems: 'center', padding: 40 }}>
            <div style={{ fontSize: 32, marginBottom: 8, opacity: .3 }}>👫</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No donors assigned</div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Your assigned donors will appear here once assigned.</div>
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

  return (<>
    <div className="detail-card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="detail-split" style={{ flex: 1, minHeight: 0 }}>
        {/* LEFT PANEL — merged profile + details */}
        <div className="detail-left" style={{ padding: 12 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* Profile header */}
            <div style={{ textAlign:'center', paddingBottom:10, borderBottom:'1px solid var(--line)', flexShrink:0 }}>
              <div className="detail-avatar">{initials(donor.donor_name)}</div>
              <div className="detail-name">{donor.donor_name}</div>
              <div className="detail-phone">{donor.donor_mobile || '—'}</div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, flexWrap:'wrap', marginTop:4 }}>
                {donor.is_new && (
                  <span style={{ padding: '1px 6px', borderRadius: 4, background: '#16a34a', color: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: .5 }}>NEW</span>
                )}
                {statusPill(donor.status || 'pending')}
                {donor.ngo_name && (
                  <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '1px 7px', borderRadius: 999, fontSize: 8, fontWeight: 700 }}>{donor.ngo_name}</span>
                )}
              </div>
            </div>

            {/* Fields — plain, no container */}
            <div style={{ flex: 1, overflowY: 'auto', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                <div className="fld" onClick={openDonationModal} style={{ cursor:'pointer' }}>
                  <label>Donations
                    <span style={{ fontSize:9, marginLeft:4, opacity:.5 }}>↗</span>
                  </label>
                  <div style={{ color:'var(--sage)', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                    <span className="material-symbols-outlined" style={{ fontSize:13, color:'var(--sage)' }}>payments</span>
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
                <div className="detail-field-row">
                  <div className="fld">
                    <label>Schedule Date & Time</label>
                    <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
                  </div>
                </div>
              )}

              {selected === 'lead_done' && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
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
                      <label>Screenshot</label>
                      <label htmlFor="ss-input" className="ss-upload">
                        {screenshotPreview ? (
                          <div style={{ position:'relative' }}>
                            <img src={screenshotPreview} alt="preview" className="ss-preview"
                              onClick={e => { e.preventDefault(); window.open(screenshotPreview, '_blank'); }} />
                            <span className="ss-remove"
                              onClick={e => { e.preventDefault(); setLeadScreenshot(null); setScreenshotPreview(null); document.getElementById('ss-input').value=''; }}>close</span>
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
                      {leadPan.length > 0 && panError && <span style={{ fontSize:9, color:'#dc2626', marginTop:1, display:'block' }}>{panError}</span>}
                    </div>
                    <div className="fld">
                      <label>DOB</label>
                      <input type="date" value={leadDob} onChange={e => setLeadDob(e.target.value)} />
                    </div>
                  </div>
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
                  {logs.slice(0, 12).map(log => {
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
                          {log.amount_collected && <div className="tl-note" style={{ color: 'var(--sage)', fontWeight: 600 }}>₹{Number(log.amount_collected).toLocaleString('en-IN')}</div>}
                          {log.disposition_detail === 'lead_done' && (
                            <span style={{ fontSize: 8, fontWeight: 700, background: 'var(--md-tertiary-fixed, #e0e7ff)', padding: '1px 4px', borderRadius: 2, textTransform: 'uppercase', display: 'inline-block', marginTop: 1 }}>
                              {log.accounts_status === 'verified' ? 'Verified' : log.accounts_status === 'rejected' ? 'Rejected' : 'Pending'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {logs.length > 12 && <div className="empty-timeline" style={{ padding: '8px 0' }}>+{logs.length - 12} more</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div className="detail-action-outer">
      <span className="counter">{index + 1} of {donors.length}</span>
      <button className="btn-next"
        disabled={saving}
        onClick={handleButtonClick}>
        {saving ? 'Saving...' : selected ? `Log ${findDisp(selected)?.label || selected}` : 'NEXT'}
      </button>
    </div>

    {/* Donation Modal */}
    {showDonationModal && (
      <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.4)' }} onClick={() => setShowDonationModal(false)}>
        <div style={{ background:'#fff', borderRadius:12, width:520, maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:'0 8px 32px rgba(0,0,0,.15)' }} onClick={e => e.stopPropagation()}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:'1px solid var(--line)' }}>
            <span style={{ fontSize:13, fontWeight:700 }}>Donations — {donor.donor_name}</span>
            <span className="material-symbols-outlined" style={{ fontSize:18, cursor:'pointer', color:'var(--ink-soft)' }} onClick={() => setShowDonationModal(false)}>close</span>
          </div>
          <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--line)', display:'flex', gap:6, alignItems:'center' }}>
            <span style={{ fontSize:10, fontWeight:600, color:'var(--ink-soft)', whiteSpace:'nowrap' }}>Show:</span>
            {['this_year', 'fy_2025_26', 'fy_2024_25', 'fy_2023_24'].map(y => (
              <button key={y} onClick={() => handleDonationYearChange(y)}
                style={{ padding:'4px 10px', border:`1px solid ${donationYear === y ? 'var(--sage)' : 'var(--line)'}`, borderRadius:6, background: donationYear === y ? 'var(--sage)' : '#fff', color: donationYear === y ? '#fff' : 'var(--ink)', fontSize:10, fontWeight:600, fontFamily:'inherit', cursor:'pointer', transition:'all .12s' }}>
                {y === 'this_year' ? 'This Year' : y.replace(/fy_(\d{4})_(\d{2})/, 'FY $1\u2013$2')}
              </button>
            ))}
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:12 }}>
            {donationLoading ? (
              <div style={{ textAlign:'center', padding:20, fontSize:11, color:'var(--ink-soft)' }}>Loading...</div>
            ) : donations.length === 0 ? (
              <div style={{ textAlign:'center', padding:20, fontSize:11, color:'var(--ink-soft)' }}>No donations for this period.</div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid var(--line)' }}>
                    <th style={{ textAlign:'left', padding:'5px 6px', fontSize:9, fontWeight:600, textTransform:'uppercase', color:'var(--ink-soft)' }}>Date</th>
                    <th style={{ textAlign:'left', padding:'5px 6px', fontSize:9, fontWeight:600, textTransform:'uppercase', color:'var(--ink-soft)' }}>Amount</th>
                    <th style={{ textAlign:'left', padding:'5px 6px', fontSize:9, fontWeight:600, textTransform:'uppercase', color:'var(--ink-soft)' }}>Mode</th>
                    <th style={{ textAlign:'left', padding:'5px 6px', fontSize:9, fontWeight:600, textTransform:'uppercase', color:'var(--ink-soft)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {donations.map((d, i) => (
                    <tr key={i} style={{ borderBottom:'1px solid var(--line)' }}>
                      <td style={{ padding:'5px 6px' }}>{d.date ? new Date(d.date).toLocaleDateString('en-GB') : '—'}</td>
                      <td style={{ padding:'5px 6px', fontWeight:600 }}>₹{Number(d.amount || 0).toLocaleString('en-IN')}</td>
                      <td style={{ padding:'5px 6px' }}>{d.mode || '—'}</td>
                      <td style={{ padding:'5px 6px' }}><span className={`bento-pill ${d.status === 'verified' ? 'bento-pill-green' : d.status === 'rejected' ? 'bento-pill-red' : 'bento-pill-yellow'}`}>{d.status || '—'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div style={{ padding:'10px 16px', borderTop:'1px solid var(--line)', textAlign:'right', fontSize:10, color:'var(--ink-soft)' }}>
            Total: ₹{donations.reduce((s, d) => s + Number(d.amount || 0), 0).toLocaleString('en-IN')}
          </div>
        </div>
      </div>
    )}
  </>);
}
