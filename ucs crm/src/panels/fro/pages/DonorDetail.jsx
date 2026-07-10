import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDonorDetail, addDonorLog, uploadPaymentScreenshot } from '../api/donors';
import { DatePicker } from '../components/ui';
import { TimePicker } from '../components/TimePicker';
import { extractTransactionData } from '../utils/ocr';

const NOT_CONNECTED = [
  { id: 'busy', label: 'Busy' },
  { id: 'ringing', label: 'Ringing' },
  { id: 'unreachable', label: 'Unreachable' },
  { id: 'switched_off', label: 'Switched Off' },
  { id: 'wrong_number', label: 'Wrong Number' },
  { id: 'invalid', label: 'Invalid' },
  { id: 'rejected', label: 'Rejected' },
];

const CONNECTED = [
  { id: 'lead_done', label: 'Lead Done' },
  { id: 'scheduled', label: 'Follow Up' },
  { id: 'callback', label: 'Callback' },
  { id: 'visit_donate', label: 'Visit & Donate' },
  { id: 'promise_to_pay', label: 'Promise to Pay' },
  { id: 'payment_pending', label: 'Payment Pending' },
  { id: 'already_donated', label: 'Already Donated' },
  { id: 'not_interested_now', label: 'Not Interested Now' },
  { id: 'language_barrier', label: 'Language Barrier' },
  { id: 'transferred_senior', label: 'Transferred to Senior' },
  { id: 'query_complaint', label: 'Query/Complaint' },
  { id: 'receipt_request', label: 'Request Receipt/Info' },
];

const ALL_DISPOSITIONS = [...NOT_CONNECTED, ...CONNECTED];
const CONNECTED_IDS = new Set(CONNECTED.map(d => d.id));

function isConnected(id) {
  return CONNECTED_IDS.has(id);
}

function findDisposition(id) {
  return ALL_DISPOSITIONS.find(d => d.id === id);
}

export default function DonorDetail({ assignmentId, donor, onBack, hideHeader }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const [selected, setSelected] = useState(null);
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [dateConfirmed, setDateConfirmed] = useState(false);
  const [callbackTime, setCallbackTime] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentScreenshot, setPaymentScreenshot] = useState(null);
  const [panNumber, setPanNumber] = useState('');
  const [addressField, setAddressField] = useState('');
  const [dobField, setDobField] = useState('');
  const [uploading, setUploading] = useState(false);
  const [upiTransactionId, setUpiTransactionId] = useState('');
  const [transactionDatetime, setTransactionDatetime] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrFromName, setOcrFromName] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    getDonorDetail(assignmentId)
      .then(r => setData(r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [assignmentId]);

  useEffect(load, [load]);

  const handleChipClick = (detail) => {
    if (!detail || detail === selected) {
      setSelected(null);
      setMessage(null);
      return;
    }
    setSelected(detail);
    setMessage(null);
    if (detail === 'scheduled') {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      setScheduledDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      setScheduledTime('');
      setDateConfirmed(false);
    }
    if (detail === 'callback') {
      setCallbackTime(new Date().toTimeString().slice(0, 5));
    }
    if (detail !== 'lead_done') {
      setPaymentAmount('');
      setPaymentScreenshot(null);
      setPanNumber('');
      setAddressField('');
      setDobField('');
      setUpiTransactionId('');
      setTransactionDatetime('');
      setOcrFromName('');
      setOcrLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result;
      setPaymentScreenshot({ base64: result.split(',')[1], mime_type: file.type });
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
        if (amount && !paymentAmount) setPaymentAmount(amount);
        if (fromName) setOcrFromName(fromName);
      } catch {}
      setOcrLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!selected) {
      setMessage({ type: 'error', text: 'Select a disposition' });
      return;
    }
    if (selected === 'scheduled' && (!scheduledDate || !scheduledTime)) {
      setMessage({ type: 'error', text: 'Select date & time' });
      return;
    }
    if (selected === 'callback' && !callbackTime) {
      setMessage({ type: 'error', text: 'Select time for callback' });
      return;
    }
    if (selected === 'lead_done') {
      if (!paymentAmount || isNaN(paymentAmount) || Number(paymentAmount) <= 0) {
        setMessage({ type: 'error', text: 'Enter a valid payment amount' });
        return;
      }
    }

    setSaving(true);
    setMessage(null);
    setUploading(false);

    try {
      let screenshotUrl = null;

      if (selected === 'lead_done' && paymentScreenshot) {
        setUploading(true);
        const uploadRes = await uploadPaymentScreenshot(paymentScreenshot.base64, paymentScreenshot.mime_type);
        screenshotUrl = uploadRes.file_url;
      }

      const logData = {
        action: 'disposition',
        disposition_category: category,
        disposition_detail: selected,
        notes: notes || null,
      };

      if (selected === 'scheduled') {
        logData.scheduled_at = new Date(scheduledDate + 'T' + scheduledTime + ':00').toISOString();
      }

      if (selected === 'callback') {
        const today = new Date();
        const [h, m] = callbackTime.split(':');
        today.setHours(+h, +m, 0, 0);
        logData.scheduled_at = today.toISOString();
      }

      if (selected === 'lead_done') {
        logData.amount_collected = parseFloat(paymentAmount);
        if (screenshotUrl) {
          logData.payment_screenshot_url = screenshotUrl;
        }
        if (panNumber) {
          logData.pan_number = panNumber;
        }
        if (addressField) {
          logData.donor_address = addressField;
        }
        if (dobField) {
          logData.donor_dob = dobField;
        }
        logData.upi_transaction_id = upiTransactionId || null;
        logData.transaction_datetime = transactionDatetime ? new Date(transactionDatetime).toISOString() : null;
      }

      await addDonorLog(assignmentId, logData);
      setMessage({ type: 'success', text: selected === 'lead_done' ? 'Sent to Accounts for review' : 'Disposition logged' });
      setSelected(null);
      setNotes('');
      setScheduledDate('');
      setScheduledTime('');
      setCallbackTime('');
      setPaymentAmount('');
      setPaymentScreenshot(null);
      setPanNumber('');
      setAddressField('');
      setDobField('');
      setUpiTransactionId('');
      setTransactionDatetime('');
      setOcrFromName('');
      setOcrLoading(false);
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  if (loading) return <div className="loading">Loading donor details...</div>;
  if (!data) return <div className="empty-state"><p>Could not load donor details.</p></div>;

  const logs = data.logs || [];
  const totalCollected = data.total_collected || 0;
  const nextSchedule = data.next_schedule;
  const d = donor || {};

  return (
    <div>
      {!hideHeader && (
        <div className="detail-header">
          <button className="back-btn" onClick={onBack}>{'\u{2190}'}</button>
          <h2>Donor Details</h2>
        </div>
      )}

      {nextSchedule && !nextSchedule.is_completed && (
        <div className={`callout ${new Date(nextSchedule.scheduled_at) < new Date() ? 'callout-danger' : 'callout-info'}`}>
          {new Date(nextSchedule.scheduled_at) < new Date() ? (
            <>Overdue scheduled contact — {new Date(nextSchedule.scheduled_at).toLocaleString()}</>
          ) : (
            <>Next schedule: {new Date(nextSchedule.scheduled_at).toLocaleString()}</>
          )}
          {nextSchedule.notes && <span style={{ marginLeft: 8 }}>({nextSchedule.notes})</span>}
        </div>
      )}

      {d.status === 'payment_rejected' && (
        <div className="callout callout-danger">
          Payment rejected by Accounts — {d.notes || 'No details provided'}
        </div>
      )}

      <div className="card">
        <div className="card-head"><h3>Contact Information</h3></div>
        <div className="card-pad">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
            <div><strong>Name:</strong> {d.donor_name || '—'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <strong>Phone:</strong> {d.donor_mobile || '—'}
              {d.donor_mobile && (
                <button onClick={() => navigate(`/fro/whatsapp-chat?phone=${d.donor_mobile}`)}
                  style={{ border: 'none', background: '#25D366', borderRadius: 6, width: 22, height: 22, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </button>
              )}
            </div>
            <div><strong>City:</strong> {d.donor_city || '—'}</div>
            <div><strong>Email:</strong> {d.donor_email || '—'}</div>
            <div><strong>Address:</strong> {d.donor_address || '—'}</div>
            <div><strong>PAN:</strong> {d.donor_pan || '—'}</div>
            <div><strong>Project:</strong> {d.donor_project || '—'}</div>
            <div><strong>DOB:</strong> {d.donor_dob || '—'}</div>
            <div><strong>Donations:</strong> {d.donation_count || 0} times (₹{Number(d.total_donated || 0).toLocaleString('en-IN')})</div>
            <div><strong>Amount:</strong> ₹{Number(d.donor_amount || 0).toLocaleString('en-IN')}</div>
            <div><strong>Status:</strong> <span className={`pill pill-${d.status === 'lead_done' || d.status === 'donation_collected' ? 'green' : d.status === 'scheduled' || d.status === 'follow_up' ? 'purple' : d.status === 'not_interested' || d.status === 'rejected' ? 'red' : d.status === 'busy' || d.status === 'ringing' || d.status === 'unreachable' || d.status === 'switched_off' || d.status === 'wrong_number' || d.status === 'invalid_number' ? 'gray' : 'blue'}`}>{d.status ? d.status.replace(/_/g, ' ') : '—'}</span></div>
            {d.next_follow_up && <div><strong>Next Follow-up:</strong> {new Date(d.next_follow_up).toLocaleDateString()}</div>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Log Disposition</h3></div>
        <div className="card-pad">
          {message && (
            <div style={{ padding: '8px 12px', marginBottom: 12, borderRadius: 6, fontSize: 13, background: message.type === 'error' ? '#fef2f2' : '#f0fdf4', color: message.type === 'error' ? '#dc2626' : '#16a34a', border: `1px solid ${message.type === 'error' ? '#fecaca' : '#bbf7d0'}` }}>
              {message.text}
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: 'var(--ink-soft)' }}>Category</label>
            <select value={category} onChange={e => { setCategory(e.target.value); setSelected(null); }} style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }}>
              <option value="">— Select —</option>
              <option value="not_connected">Not Connected</option>
              <option value="connected">Connected</option>
            </select>
          </div>

          {category === 'not_connected' && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: 'var(--ink-soft)' }}>Not Connected — Reason</label>
              <select value={selected || ''} onChange={e => handleChipClick(e.target.value)} style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }}>
                <option value="">— Select —</option>
                {NOT_CONNECTED.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          {category === 'connected' && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: 'var(--ink-soft)' }}>Connected — Type</label>
              <select value={selected || ''} onChange={e => handleChipClick(e.target.value)} style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }}>
                <option value="">— Select —</option>
                {CONNECTED.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          {selected === 'scheduled' && (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: 'var(--ink-soft)' }}>Follow Up Date</label>
                <DatePicker value={scheduledDate} onChange={e => { setScheduledDate(e.target.value); setDateConfirmed(true); }} placeholder="Select date" />
              </div>
              {dateConfirmed && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: 'var(--ink-soft)' }}>Follow Up Time</label>
                  <TimePicker value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} placeholder="Select time" />
                </div>
              )}
            </>
          )}

          {selected === 'callback' && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: 'var(--ink-soft)' }}>Callback Time (Today)</label>
              <TimePicker value={callbackTime} onChange={e => setCallbackTime(e.target.value)} placeholder="Select time" />
            </div>
          )}

          {selected === 'lead_done' && (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: 'var(--ink-soft)' }}>Payment Amount (₹)</label>
                <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} min="1" placeholder="Enter amount" style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: 'var(--ink-soft)' }}>Payment Screenshot (optional) {ocrLoading && <span style={{fontSize:9,color:'var(--md-outline)'}}>OCR…</span>}</label>
                <input type="file" accept="image/*" onChange={handleFileChange} style={{ fontSize: 13, width: '100%' }} />
                {paymentScreenshot && <span style={{ fontSize: 11, color: 'var(--primary)' }}>File selected</span>}
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: 'var(--ink-soft)' }}>UPI Transaction ID</label>
                <input type="text" value={upiTransactionId} onChange={e => setUpiTransactionId(e.target.value)} placeholder="Auto-detected from screenshot" style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: 'var(--ink-soft)' }}>Transaction Date/Time</label>
                <input type="datetime-local" value={transactionDatetime} onChange={e => setTransactionDatetime(e.target.value)} style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
              </div>
              {ocrFromName && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: 'var(--ink-soft)' }}>Detected From Name</label>
                  <input type="text" value={ocrFromName} readOnly style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', color: 'var(--md-outline)', fontStyle: 'italic' }} />
                </div>
              )}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: 'var(--ink-soft)' }}>PAN Card Number</label>
                <input type="text" value={panNumber} onChange={e => setPanNumber(e.target.value.toUpperCase())} placeholder="e.g. ABCDE1234F" maxLength={10} style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
              </div>
              {!d.donor_address && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: 'var(--ink-soft)' }}>Address</label>
                  <input type="text" value={addressField} onChange={e => setAddressField(e.target.value)} placeholder="Donor address" style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                </div>
              )}
              {!d.donor_dob && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: 'var(--ink-soft)' }}>Date of Birth</label>
                  <input type="date" value={dobField} onChange={e => setDobField(e.target.value)} style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                </div>
              )}
            </>
          )}

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: 'var(--ink-soft)' }}>Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Add any notes..." style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontFamily: 'inherit', fontSize: 13, outline: 'none', resize: 'vertical', width: '100%', boxSizing: 'border-box' }} />
          </div>

          {selected === 'lead_done' ? (
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || uploading || !selected || !paymentAmount} style={{ width: '100%', background: 'var(--success)', borderColor: 'var(--success)' }}>
              {uploading ? 'Uploading screenshot...' : saving ? 'Sending...' : 'Send to Accounts'}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !selected} style={{ width: '100%' }}>
              {saving ? 'Saving...' : selected ? `Log ${findDisposition(selected)?.label || selected}` : 'Select a disposition above'}
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>CRM Timeline</h3>
          <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Total Collected: ₹{totalCollected.toLocaleString('en-IN')}</span>
        </div>
        <div className="card-pad">
          {logs.length === 0 ? (
            <div className="empty-state">
              <div className="icon">{'\u{1F4CB}'}</div>
              <h3>No activity yet</h3>
              <p>Log your first interaction using the disposition panel above.</p>
            </div>
          ) : (
            <div className="timeline">
              {logs.map(log => {
                const isDisp = log.action === 'disposition';
                const cat = log.disposition_category;
                const icon = isDisp ? (cat === 'connected' ? '\u2705' : '\u274C') : {
                  call: '\u{1F4DE}', visit: '\u{1F3E0}', message: '\u2709\u{FE0F}',
                  follow_up: '\u{1F504}', donation: '\u{1F4B5}', note: '\u{1F4DD}',
                }[log.action] || '\u{1F4CB}';
                const label = isDisp
                  ? `${log.disposition_detail?.replace(/_/g, ' ')}`
                  : log.action.replace(/_/g, ' ');
                return (
                  <div key={log.id} className="timeline-item" style={isDisp && cat === 'connected' ? { borderLeftColor: '#16a34a' } : isDisp && cat === 'not_connected' ? { borderLeftColor: '#dc2626' } : {}}>
                    <div className="time">{new Date(log.created_at).toLocaleString()}</div>
                    <div className="label">{icon} {label}</div>
                    {log.notes && <div className="desc">{log.notes}</div>}
                    {log.outcome && <div className="desc">Outcome: {log.outcome}</div>}
                    {log.scheduled_at && <div className="desc" style={{ color: 'var(--primary)' }}>Scheduled: {new Date(log.scheduled_at).toLocaleString()}</div>}
                    {log.amount_collected != null && <div className="desc" style={{ color: 'var(--success)' }}>Amount: ₹{Number(log.amount_collected).toLocaleString('en-IN')}</div>}
                    {log.disposition_detail === 'lead_done' && log.accounts_status === 'verified' && (
                      <div className="desc" style={{ color: '#16a34a' }}>Accounts: Verified ✓</div>
                    )}
                    {log.disposition_detail === 'lead_done' && log.accounts_status === 'rejected' && (
                      <div className="desc" style={{ color: '#dc2626' }}>Accounts: Rejected — {log.rejection_reason || log.notes || 'No reason given'}</div>
                    )}
                    {log.disposition_detail === 'lead_done' && log.accounts_status === 'pending' && (
                      <div className="desc" style={{ color: '#f59e0b' }}>Accounts: Pending verification</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
