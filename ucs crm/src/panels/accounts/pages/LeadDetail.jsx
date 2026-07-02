import { useState, useEffect, useRef } from 'react';
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
  const [panInput, setPanInput] = useState('');
  const [modeInput, setModeInput] = useState('');
  const receiptRef = useRef(null);

  const load = () => {
    setLoading(true);
    apiGet('/accounts/leads')
      .then(all => all.find(l => l.log_id === parseInt(logId)))
      .then(l => setLead(l || null))
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

  useEffect(load, [logId]);
  useEffect(() => {
    if (lead && lead.accounts_status === 'verified') loadReceipt();
  }, [lead?.accounts_status]);

  const handleVerify = async () => {
    if (!lead || !window.confirm('Verify this lead and mark amount as collected?')) return;
    setSubmitting(true);
    try {
      await apiPost(`/accounts/leads/${lead.log_id}/verify`, { pan_number: lead.pan_number || lead.donor_pan || null });
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
      if (panInput.trim()) body.pan_number = panInput.trim();
      if (modeInput.trim()) body.mode = modeInput.trim();
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
    <div>
      <div className="detail-header">
        <button className="back-btn" onClick={onBack}>{'\u2190'}</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 1 }}>Lead Details</div>
          <h2 style={{ margin: 0, fontSize: 16 }}>{l.donor_name}</h2>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {l.accounts_status === 'pending' && (
            <>
              <button className="btn btn-primary btn-sm" onClick={handleVerify} disabled={submitting}>
                {submitting ? 'Verifying...' : '\u2714\uFE0F Verify'}
              </button>
              <button className="btn btn-sm btn-danger" onClick={handleReject} disabled={submitting}>
                {submitting ? 'Rejecting...' : '\u2716\uFE0F Reject'}
              </button>
            </>
          )}
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

      <div className="two-col detail-layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-head"><h3>Donor Information</h3></div>
            <div className="card-pad">
              <div className="info-grid">
                <div><div className="label">Name</div><div className="value">{l.donor_name}</div></div>
                <div><div className="label">Mobile</div><div className="value">{l.donor_mobile}</div></div>
                <div><div className="label">City</div><div className="value">{l.donor_city || '\u2014'}</div></div>
                <div><div className="label">Email</div><div className="value">{l.donor_email || '\u2014'}</div></div>
                <div><div className="label">Address</div><div className="value">{l.donor_address || '\u2014'}</div></div>
                <div><div className="label">PAN</div><div className="value">{l.pan_number || l.donor_pan || '\u2014'}</div></div>
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
                <input value={panInput} onChange={e => setPanInput(e.target.value)} placeholder={l.pan_number || l.donor_pan || 'Enter PAN'} />
              </label>
              <label className="field" style={{ flex: 1, minWidth: 140 }}>
                Mode (optional)
                <input value={modeInput} onChange={e => setModeInput(e.target.value)} placeholder="e.g. UPI, Cash" />
              </label>
              <button className="btn btn-primary" onClick={handleGenerateReceipt} disabled={receiptLoading} style={{ marginBottom: 4 }}>
                {receiptLoading ? 'Generating...' : 'Generate Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="two-col">
        {l.notes && (
          <div className="card">
            <div className="card-head"><h3>Notes</h3></div>
            <div className="card-pad">
              <p style={{ fontSize: 13, margin: 0, whiteSpace: 'pre-wrap' }}>{l.notes}</p>
            </div>
          </div>
        )}

        {l.remark && (
          <div className="card">
            <div className="card-head"><h3>Remark</h3></div>
            <div className="card-pad" style={{ background: '#f0fdf4', borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}>
              <p style={{ fontSize: 13, margin: 0, color: '#166534', whiteSpace: 'pre-wrap' }}>{l.remark}</p>
            </div>
          </div>
        )}

        {l.rejection_reason && (
          <div className="card">
            <div className="card-head"><h3>Rejection Reason</h3></div>
            <div className="card-pad" style={{ background: '#fef2f2', borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}>
              <p style={{ fontSize: 13, margin: 0, color: '#991b1b' }}>{l.rejection_reason}</p>
            </div>
          </div>
        )}
      </div>

      {showScreenshot && l.screenshot_url && (
        <div className="modal-overlay" onClick={() => setShowScreenshot(false)} style={{ cursor: 'zoom-out' }}>
          <img src={l.screenshot_url} alt="Payment screenshot" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: 8 }} />
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
