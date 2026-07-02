import { useState, useEffect, useRef } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { TimePicker } from '../../fro/components/TimePicker';
import { apiGet, apiPost } from '../api/auth';
import { getReceipt, generateReceipt as apiGenerateReceipt } from '../api/receipts';
import { generateReceiptPDF } from '../services/pdfGenerator';
import ReceiptTemplate_MannCar from '../components/ReceiptTemplate_MannCar';
import ReceiptTemplate_Ashray from '../components/ReceiptTemplate_Ashray';
import ReceiptTemplate_BeingSevak from '../components/ReceiptTemplate_BeingSevak';

const TEMPLATES = { manncar: ReceiptTemplate_MannCar, ashray: ReceiptTemplate_Ashray, beingsevak: ReceiptTemplate_BeingSevak };
const DB_TO_TEMPLATE = { maan: 'manncar', aflf: 'ashray', bsct: 'beingsevak' };
const PROJECT_LABELS = { maan: 'Mann Care Foundation', aflf: 'Ashray For Life Foundation', bsct: 'Being Sevak Charitable Trust' };

function getTemplateId(projectId) {
  return DB_TO_TEMPLATE[projectId] || 'beingsevak';
}

function buildDonor(receipt) {
  return {
    'Receipt No.': receipt.receipt_no || '',
    'Receipt Date': receipt.receipt_date || '',
    'Donor Name': receipt.donor_name || '',
    'Address 1': receipt.address || '',
    'PAN No.': receipt.pan_number || '',
    'Email ID': '', 'Amount': receipt.amount || 0,
    'Mode of Payment (MOP)': receipt.mode || '',
    'Payment ID No.': '', 'Donor Bank Name': '',
    'Account Of': 'Corpus', 'City': '', 'State': '', 'Pincode': '',
  };
}

const currency = n => n != null ? '\u20B9' + Number(n).toLocaleString('en-IN') : '\u2014';

function parseDatetime(iso) {
  if (!iso) return { date: null, time: '' };
  try {
    const d = new Date(iso);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return { date: d, time: `${h}:${m}` };
  } catch {
    return { date: null, time: '' };
  }
}

function combineDatetime(date, time) {
  if (!date) return null;
  const d = new Date(date);
  if (time) {
    const [h, m] = time.split(':').map(Number);
    d.setHours(h || 0, m || 0, 0, 0);
  }
  return d.toISOString();
}

function ScreenshotImage({ src, onClick }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div style={{ position: 'relative', minHeight: 120, background: 'var(--bg)' }}>
      {!loaded && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(90deg, var(--bg) 25%, var(--line) 50%, var(--bg) 75%)',
          backgroundSize: '200% 100%', animation: 'sk-shimmer 1.4s infinite',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="1.5" style={{ opacity: 0.3 }}>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
      )}
      <img src={src} alt="Payment screenshot" onLoad={() => setLoaded(true)}
        onClick={onClick}
        style={{ width: '100%', display: loaded ? 'block' : 'none', cursor: 'pointer' }} />
    </div>
  );
}

export default function LeadDetail({ logId, onBack }) {
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showScreenshot, setShowScreenshot] = useState(false);

  const [form, setForm] = useState({
    donor_name: '', donor_mobile: '', donor_city: '', donor_email: '', donor_address: '', donor_pan: '',
    upi_transaction_id: '', transaction_date: null, transaction_time: '', payment_from: '',
    pan_input: '', mode_input: '',
  });

  const receiptRef = useRef(null);
  const hasInitRef = useRef(false);

  const load = () => {
    setLoading(true);
    apiGet('/accounts/leads')
      .then(all => all.find(ll => ll.log_id === parseInt(logId)))
      .then(ll => { setLead(ll || null); return ll; })
      .then(ll => {
        if (ll && !hasInitRef.current) {
          const { date, time } = parseDatetime(ll.transaction_datetime);
          setForm({
            donor_name: ll.donor_name || '',
            donor_mobile: ll.donor_mobile || '',
            donor_city: ll.donor_city || '',
            donor_email: ll.donor_email || '',
            donor_address: ll.donor_address || '',
            donor_pan: ll.pan_number || ll.donor_pan || '',
            upi_transaction_id: ll.upi_transaction_id || '',
            transaction_date: date,
            transaction_time: time,
            payment_from: ll.payment_from || '',
            pan_input: ll.pan_number || ll.donor_pan || '',
            mode_input: '',
          });
          hasInitRef.current = true;
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const loadReceipt = () => {
    setReceiptLoading(true);
    getReceipt(logId)
      .then(r => setReceipt(r || null))
      .catch(() => setReceipt(null))
      .finally(() => setReceiptLoading(false));
  };

  useEffect(() => { load(); }, [logId]);
  useEffect(() => {
    if (lead && lead.accounts_status === 'verified') loadReceipt();
  }, [lead?.accounts_status]);

  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleVerify = async () => {
    if (!lead || !window.confirm('Verify this lead and mark amount as collected?')) return;
    setSubmitting(true);
    try {
      await apiPost(`/accounts/leads/${lead.log_id}/verify`, {
        pan_number: form.donor_pan || form.pan_input || null,
        donor_name: form.donor_name || null,
        donor_mobile: form.donor_mobile || null,
        donor_city: form.donor_city || null,
        donor_email: form.donor_email || null,
        donor_pan: form.donor_pan || null,
        donor_address: form.donor_address || null,
        upi_transaction_id: form.upi_transaction_id || null,
        transaction_datetime: combineDatetime(form.transaction_date, form.transaction_time),
        payment_from: form.payment_from || null,
      });
      load();
    } catch (err) { alert(err.message); }
    finally { setSubmitting(false); }
  };

  const handleReject = async () => {
    if (!lead) return;
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    setSubmitting(true);
    try {
      await apiPost(`/accounts/leads/${lead.log_id}/reject`, { reason });
      load();
    } catch (err) { alert(err.message); }
    finally { setSubmitting(false); }
  };

  const handleGenerateReceipt = async () => {
    if (!lead) return;
    setReceiptLoading(true);
    try {
      const body = {};
      if (form.pan_input.trim()) body.pan_number = form.pan_input.trim();
      if (form.mode_input.trim()) body.mode = form.mode_input.trim();
      const res = await apiGenerateReceipt(logId, body);
      setReceipt(res.receipt);
      setShowModal(true);
    } catch (err) { alert(err.message); }
    finally { setReceiptLoading(false); }
  };

  const handleDownload = async () => {
    if (!receiptRef.current) return;
    try {
      const pdf = await generateReceiptPDF(receiptRef.current);
      pdf.save(`receipt_${(receipt?.receipt_no || 'download').replace(/[/\\]/g, '_')}.pdf`);
    } catch (err) { alert('Failed to generate PDF: ' + err.message); }
  };

  const handleSendWhatsApp = async () => {
    const rawPhone = (l.donor_mobile || '').replace(/\D/g, '');
    const phone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone.startsWith('0') ? '91' + rawPhone.slice(1) : rawPhone;
    if (!phone || phone.length < 10) { alert('Donor mobile number not available or invalid'); return; }
    if (!receiptRef.current) return;
    try {
      const pdf = await generateReceiptPDF(receiptRef.current);
      pdf.save(`receipt_${(receipt?.receipt_no || 'download').replace(/[/\\]/g, '_')}.pdf`);
      const projectId = (l.donor_project || '').toLowerCase();
      const foundationName = PROJECT_LABELS[projectId] || 'our foundation';
      const amt = Number(receipt?.amount || 0).toLocaleString('en-IN');
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`Thank you for your generous donation of \u20B9${amt} to ${foundationName}. Your receipt (No: ${receipt?.receipt_no || ''}) has been generated.\n\nWith gratitude,\n${foundationName} Team`)}`, '_blank');
    } catch (err) { alert('Failed to generate PDF: ' + err.message); }
  };

  if (loading) return <div className="loading">Loading lead details...</div>;
  if (!lead) return <div className="empty-state"><p>Lead not found</p><button className="btn" onClick={onBack}>Back to Leads</button></div>;

  const l = lead;
  const projectId = (l.donor_project || '').toLowerCase();
  const templateId = getTemplateId(projectId);
  const ReceiptComp = TEMPLATES[templateId];
  const canGenerate = l.accounts_status === 'verified';
  const donor = receipt ? buildDonor(receipt) : null;

  return (
    <div style={{ paddingBottom: 80 }}>
      <div className="detail-header">
        <button className="back-btn" onClick={onBack}>{'\u2190'}</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Lead Details</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {l.accounts_status === 'verified' && (
            <>
              <span className="pill pill-green">Verified</span>
              {receipt && (
                <button className="btn btn-sm btn-primary" onClick={() => setShowModal(true)}>
                  View Receipt
                </button>
              )}
            </>
          )}
          {l.accounts_status === 'rejected' && <span className="pill pill-red" title={l.rejection_reason || ''}>Rejected</span>}
        </div>
      </div>

      {(l.notes || l.remark || l.rejection_reason) && (
        <div className="card" style={{ borderLeft: '3px solid #dc2626', marginBottom: 16 }}>
          <div className="card-pad" style={{ padding: '10px 16px', background: '#fef2f2' }}>
            {l.remark && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', whiteSpace: 'nowrap', marginTop: 1 }}>Remark:</span>
                <p style={{ margin: 0, fontSize: 13, color: '#991b1b', whiteSpace: 'pre-wrap' }}>{l.remark}</p>
              </div>
            )}
            {l.notes && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: l.remark ? 8 : 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', whiteSpace: 'nowrap', marginTop: 1 }}>Notes:</span>
                <p style={{ margin: 0, fontSize: 13, color: '#991b1b', whiteSpace: 'pre-wrap' }}>{l.notes}</p>
              </div>
            )}
            {l.rejection_reason && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: (l.remark || l.notes) ? 8 : 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', whiteSpace: 'nowrap', marginTop: 1 }}>Rejection:</span>
                <p style={{ margin: 0, fontSize: 13, color: '#991b1b', whiteSpace: 'pre-wrap' }}>{l.rejection_reason}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="two-col detail-layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-head"><h3>Donor Information</h3></div>
            <div className="card-pad">
              <div className="info-grid">
                <div>
                  <div className="label">Name</div>
                  <input className="field-input" value={form.donor_name} onChange={e => setField('donor_name', e.target.value)} placeholder="Donor name" />
                </div>
                <div>
                  <div className="label">Mobile</div>
                  <input className="field-input" value={form.donor_mobile} onChange={e => setField('donor_mobile', e.target.value)} placeholder="Mobile number" />
                </div>
                <div>
                  <div className="label">City</div>
                  <input className="field-input" value={form.donor_city} onChange={e => setField('donor_city', e.target.value)} placeholder="City" />
                </div>
                <div>
                  <div className="label">Email</div>
                  <input className="field-input" value={form.donor_email} onChange={e => setField('donor_email', e.target.value)} placeholder="donor@email.com" />
                </div>
                <div>
                  <div className="label">Address</div>
                  <input className="field-input" value={form.donor_address} onChange={e => setField('donor_address', e.target.value)} placeholder="Address" />
                </div>
                <div>
                  <div className="label">PAN</div>
                  <input className="field-input" value={form.donor_pan} onChange={e => setField('donor_pan', e.target.value)} placeholder="ABCDE1234F" />
                </div>
                <div><div className="label">DOB</div><div className="value">{l.donor_dob || '\u2014'}</div></div>
                <div><div className="label">Project</div><div className="value">{l.donor_project || '\u2014'}</div></div>
                <div><div className="label">Donations</div><div className="value">{l.donation_count || 0} times</div></div>
                <div><div className="label">Total Donated</div><div className="value-mono" style={{ color: 'var(--sage)' }}>{currency(l.total_donated)}</div></div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Payment Details</h3></div>
            <div className="card-pad">
              <div className="info-grid">
                <div><div className="label">Amount</div><div className="value-mono" style={{ color: 'var(--sage)' }}>{currency(l.amount)}</div></div>
                <div><div className="label">Agent</div><div className="value">{l.agent_name} <span style={{ fontSize: 10, color: 'var(--ink-soft)' }}>({l.agent_login})</span></div></div>
                <div><div className="label">Submitted</div><div className="value">{new Date(l.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div></div>
                <div><div className="label">Status</div><div>
                  {l.accounts_status === 'verified' ? <span className="pill pill-green">Verified</span> :
                   l.accounts_status === 'rejected' ? <span className="pill pill-red">Rejected</span> :
                   <span className="pill pill-yellow">Pending</span>}
                </div></div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Transaction Details</h3></div>
            <div className="card-pad">
              <div className="info-grid">
                <div>
                  <div className="label">UPI Transaction ID</div>
                  <input className="field-input" value={form.upi_transaction_id} onChange={e => setField('upi_transaction_id', e.target.value)} placeholder="e.g. UPI123456789" />
                </div>
                <div>
                  <div className="label">Date</div>
                  <DatePicker
                    selected={form.transaction_date}
                    onChange={date => setField('transaction_date', date)}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="Select date"
                    isClearable
                    showYearDropdown
                    scrollableYearDropdown
                    yearDropdownItemNumber={50}
                    className="datepicker-input"
                  />
                </div>
                <div>
                  <div className="label">Time</div>
                  <TimePicker
                    value={form.transaction_time}
                    onChange={e => setField('transaction_time', e.target.value)}
                    placeholder="Select time"
                  />
                </div>
                <div>
                  <div className="label">From (Sender Name)</div>
                  <input className="field-input" value={form.payment_from} onChange={e => setField('payment_from', e.target.value)} placeholder="e.g. Name on UPI" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          {l.screenshot_url ? (
            <div className="card" style={{ position: 'sticky', top: 16, overflow: 'hidden' }}>
              <ScreenshotImage src={l.screenshot_url} onClick={() => setShowScreenshot(true)} />
            </div>
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-soft)' }}>
                <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>{'\u{1F5BC}\uFE0F'}</div>
                <div style={{ fontSize: 13 }}>No screenshot available</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {canGenerate && !receipt && (
        <div className="card">
          <div className="card-head"><h3>Generate Receipt</h3></div>
          <div className="card-pad">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', fontSize: 13 }}>
              <label className="field" style={{ flex: 1, minWidth: 140 }}>
                PAN (optional)
                <input className="field-input" value={form.pan_input} onChange={e => setField('pan_input', e.target.value)} placeholder="Enter PAN" />
              </label>
              <label className="field" style={{ flex: 1, minWidth: 140 }}>
                Mode (optional)
                <input className="field-input" value={form.mode_input} onChange={e => setField('mode_input', e.target.value)} placeholder="e.g. UPI, Cash" />
              </label>
              <button className="btn btn-primary" onClick={handleGenerateReceipt} disabled={receiptLoading} style={{ marginBottom: 4 }}>
                {receiptLoading ? 'Generating...' : 'Generate Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showScreenshot && l.screenshot_url && (
        <div className="modal-overlay" onClick={() => setShowScreenshot(false)} style={{ cursor: 'zoom-out' }}>
          <img src={l.screenshot_url} alt="Payment screenshot" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: 8 }} />
        </div>
      )}

      {l.accounts_status === 'pending' && (
        <div className="action-bar">
          <div style={{ display: 'flex', gap: 12, maxWidth: 600, margin: '0 auto', width: '100%' }}>
            <button onClick={handleReject} disabled={submitting} className="reject-btn" style={{ flex: 1 }}>
              {submitting ? 'Rejecting...' : '\u2716 Reject'}
            </button>
            <button onClick={handleVerify} disabled={submitting} className="verify-btn" style={{ flex: 2 }}>
              {submitting ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />Saving</span> : '\u2714 Verify & Save'}
            </button>
          </div>
        </div>
      )}

      {showModal && receipt && donor && ReceiptComp && (
        <>
          <div className="modal-overlay" onClick={() => setShowModal(false)} />
          <div className="modal" style={{ maxWidth: 800, width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h3>Receipt Preview</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={handleDownload}>Download PDF</button>
                <button className="btn btn-sm" style={{ background: '#25D366', color: '#fff' }} onClick={handleSendWhatsApp}>
                  Send via WhatsApp
                </button>
                <button className="btn btn-sm" onClick={() => setShowModal(false)}>Close</button>
              </div>
            </div>
            <div className="modal-body" style={{ padding: 20 }}>
              <div ref={receiptRef} data-receipt data-receipt-print>
                <ReceiptComp donor={donor} index={0} project={templateId} />
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        .verify-btn {
          padding: 12px 28px; font-size: 14px; font-weight: 600;
          background: linear-gradient(135deg, #059669, #047857);
          color: #fff; border: none; border-radius: 10px; cursor: pointer;
          transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          box-shadow: 0 2px 8px rgba(5,150,105,0.25);
          letter-spacing: 0.3px;
        }
        .verify-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #047857, #065f46);
          transform: translateY(-1px); box-shadow: 0 6px 20px rgba(5,150,105,0.35);
        }
        .verify-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        .reject-btn {
          padding: 12px 28px; font-size: 14px; font-weight: 500;
          background: #fff; color: #dc2626;
          border: 1.5px solid #fecaca; border-radius: 10px; cursor: pointer;
          transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          letter-spacing: 0.3px;
        }
        .reject-btn:hover:not(:disabled) {
          background: #fef2f2; border-color: #fca5a5;
          transform: translateY(-1px); box-shadow: 0 4px 12px rgba(220,38,38,0.1);
        }
        .reject-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

        .field-input {
          width: 100%; box-sizing: border-box;
          padding: 8px 12px; font-size: 13px;
          border: 1px solid #e5e7eb; border-radius: 8px;
          outline: none; background: #f9fafb; color: #1f2937;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }
        .field-input:focus {
          border-color: var(--sage, #5B6B4E);
          box-shadow: 0 0 0 3px rgba(91,107,78,0.08);
          background: #fff;
        }
        .field-input::placeholder { color: #9ca3af; }

        .action-bar {
          position: fixed; bottom: 0; left: 240px; right: 0; z-index: 50;
          background: rgba(255,255,255,0.97);
          backdrop-filter: blur(16px);
          border-top: 1px solid #e5e7eb;
          padding: 14px 32px;
          display: flex; justify-content: center;
          box-shadow: 0 -2px 12px rgba(0,0,0,0.06);
        }
        @media (max-width: 952px) {
          .action-bar { left: 0; }
        }

        .datepicker-input {
          width: 100%; box-sizing: border-box;
          padding: 8px 12px; font-size: 13px;
          border: 1px solid #e5e7eb; border-radius: 8px;
          outline: none; background: #f9fafb; color: #1f2937;
        }
        .datepicker-input:focus {
          border-color: var(--sage, #4ade80);
          box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.15);
        }

        .react-datepicker {
          font-family: inherit; font-size: 13px;
          border: 1px solid #e5e7eb; border-radius: 10px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }
        .react-datepicker__header {
          background: #f0fdf4; border-bottom: 1px solid #dcfce7;
          border-radius: 10px 10px 0 0; padding-top: 10px;
        }
        .react-datepicker__current-month {
          font-weight: 600; color: #166534; font-size: 14px;
        }
        .react-datepicker__day-name {
          color: #6b7280; font-weight: 500; font-size: 11px; width: 32px;
        }
        .react-datepicker__day {
          width: 32px; height: 32px; line-height: 32px; border-radius: 8px;
          margin: 1px; color: #374151;
        }
        .react-datepicker__day:hover {
          background: #dcfce7; border-radius: 8px;
        }
        .react-datepicker__day--selected, .react-datepicker__day--keyboard-selected {
          background: #166534 !important; color: #fff !important; border-radius: 8px;
        }
        .react-datepicker__day--today {
          font-weight: 700; color: #166534; background: #f0fdf4;
        }
        .react-datepicker__navigation {
          top: 10px;
        }
        .react-datepicker__year-dropdown-container {
          margin-left: 5px;
        }
        .react-datepicker__year-select {
          padding: 2px 6px; font-size: 13px;
          border: 1px solid #d1d5db; border-radius: 4px;
          background: #fff; color: #166534; font-weight: 600;
          cursor: pointer; outline: none;
        }
        .react-datepicker__close-icon::after {
          background: #9ca3af; font-size: 14px; height: 16px; width: 16px;
        }
        .react-datepicker__triangle { display: none; }

        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 999;
          display: flex; align-items: center; justify-content: center;
        }
        .modal-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 14px 20px; border-bottom: 1px solid #e5e7eb;
        }
        .modal-header h3 { margin: 0; font-size: 16px; }
        .modal-body { overflow: auto; max-height: calc(90vh - 70px); }
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden; }
          [data-receipt-print], [data-receipt-print] * { visibility: visible; }
          .modal-overlay { display: none !important; }
          .modal-header { display: none !important; }
          .modal { position: static !important; transform: none !important; width: 100% !important; max-width: none !important; max-height: none !important; overflow: visible !important; box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; padding: 0 !important; }
          .modal-body { padding: 0 !important; margin: 0 !important; max-height: none !important; overflow: visible !important; display: flex !important; justify-content: center !important; }
          [data-receipt-print] { position: relative; width: 100%; margin: -8mm 0 0 !important; padding: 0 !important; display: flex !important; justify-content: center !important; }
          [data-receipt-print] [data-receipt-sheet] { margin: 0 auto !important; max-width: none !important; break-inside: avoid; page-break-inside: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          [data-receipt-print] [data-pdf-width="1000"] { zoom: 0.68; }
          [data-receipt-print] [data-pdf-width="900"] { zoom: 0.75; }
          [data-receipt-print] [data-pdf-width="794"] { zoom: 0.85; }
        }
      `}</style>
    </div>
  );
}
