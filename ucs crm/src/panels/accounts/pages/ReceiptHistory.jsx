import React, { useState, useEffect } from 'react';
import { apiGet } from '../api/auth';
import { getReceipt } from '../api/receipts';
import { PROJECTS } from '../data/projects';
import { generateReceiptPDF } from '../services/pdfGenerator';
import ReceiptTemplate_MannCar from '../components/ReceiptTemplate_MannCar';
import ReceiptTemplate_Ashray from '../components/ReceiptTemplate_Ashray';
import ReceiptTemplate_BeingSevak from '../components/ReceiptTemplate_BeingSevak';

const TEMPLATES = {
  manncar: ReceiptTemplate_MannCar,
  ashray: ReceiptTemplate_Ashray,
  beingsevak: ReceiptTemplate_BeingSevak,
};

const DB_TO_TEMPLATE = { maan: 'manncar', aflf: 'ashray', bsct: 'beingsevak' };

const PROJECT_LABELS = {
  maan: 'Mann Care Foundation',
  aflf: 'Ashray For Life Foundation',
  bsct: 'Being Sevak Charitable Trust',
};

function getTemplateId(projectId) {
  return DB_TO_TEMPLATE[projectId] || 'beingsevak';
}

function buildDonor(r) {
  return {
    'Receipt No.': r.receipt_no || '',
    'Receipt Date': r.receipt_date || '',
    'Donor Name': r.donor_name || '',
    'Address 1': r.address || '',
    'PAN No.': r.pan_number || '',
    'Email ID': '',
    'Amount': r.amount || 0,
    'Mode of Payment (MOP)': r.mode || '',
    'Payment ID No.': '',
    'Donor Bank Name': '',
    'Account Of': 'Corpus',
    'City': '',
    'State': '',
    'Pincode': '',
  };
}

export default function ReceiptHistory() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const load = () => {
    setLoading(true);
    apiGet('/accounts/receipts')
      .then(setReceipts)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handlePreview = async (r) => {
    const templateId = getTemplateId(r.project_id);
    const Comp = TEMPLATES[templateId];
    if (!Comp) return;
    setPreview({ receipt: r, templateId, Comp, donorMobile: '' });
    try {
      const leads = await apiGet('/accounts/leads');
      const lead = leads.find(l => l.log_id === r.log_id);
      if (lead) setPreview(p => ({ ...p, donorMobile: lead.donor_mobile || '' }));
    } catch {}
  };

  const handleDownload = async () => {
    if (!preview) return;
    setDownloading(true);
    try {
      const el = document.querySelector('[data-receipt-preview]');
      if (!el) return;
      const pdf = await generateReceiptPDF(el);
      pdf.save(`receipt_${preview.receipt.receipt_no.replace(/[/\\]/g, '_')}.pdf`);
    } catch (err) {
      alert('Failed to generate PDF: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleWhatsApp = async () => {
    if (!preview) return;
    const rawPhone = (preview.donorMobile || '').replace(/\D/g, '');
    const phone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone.startsWith('0') ? '91' + rawPhone.slice(1) : rawPhone;
    if (!phone || phone.length < 10) {
      alert('Donor mobile number not available or invalid');
      return;
    }
    try {
      const el = document.querySelector('[data-receipt-preview]');
      if (!el) return;
      const pdf = await generateReceiptPDF(el);
      pdf.save(`receipt_${preview.receipt.receipt_no.replace(/[/\\]/g, '_')}.pdf`);
      const r = preview.receipt;
      const projectId = (r.project_id || '').toLowerCase();
      const foundationName = PROJECT_LABELS[projectId] || 'our foundation';
      const amt = Number(r.amount || 0).toLocaleString('en-IN');
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`Thank you for your generous donation of ₹${amt} to ${foundationName}. Your receipt (No: ${r.receipt_no || ''}) has been generated.\n\nWith gratitude,\n${foundationName} Team`)}`, '_blank');
    } catch (err) {
      alert('Failed to generate PDF: ' + err.message);
    }
  };

  return (
    <div>
      <div className="card">
        <div className="card-head">
          <h3>Receipt History</h3>
          <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{receipts.length} receipts</span>
        </div>
        <div className="card-pad">
          {loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Receipt No</th>
                  <th>Donor</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Project</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {receipts.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>No receipts generated yet</td></tr>
                )}
                {receipts.map(r => {
                  const proj = Object.values(PROJECTS).find(p => r.project_id === p.id || DB_TO_TEMPLATE[r.project_id] === p.id);
                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.receipt_no}</td>
                      <td>{r.donor_name}</td>
                      <td>₹{Number(r.amount || 0).toLocaleString('en-IN')}</td>
                      <td style={{ fontSize: 12 }}>{r.receipt_date ? new Date(r.receipt_date).toLocaleDateString() : '—'}</td>
                      <td style={{ fontSize: 12 }}>{proj?.label || r.project_id || '—'}</td>
                      <td>
                        <button className="btn btn-sm btn-primary" onClick={() => handlePreview(r)}>View</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {preview && (
        <>
          <div className="modal-overlay" onClick={() => setPreview(null)} />
          <div className="modal" style={{ maxWidth: 800, width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h3>Receipt — {preview.receipt.receipt_no}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={handleDownload} disabled={downloading}>
                  {downloading ? 'Downloading...' : 'Download PDF'}
                </button>
                <button className="btn btn-sm" style={{ background: '#25D366', color: '#fff' }} onClick={handleWhatsApp}>
                  Send via WhatsApp
                </button>
                <button className="btn btn-sm" onClick={() => setPreview(null)}>Close</button>
              </div>
            </div>
            <div className="modal-body" style={{ padding: 20 }}>
              <div data-receipt-preview data-receipt-print>
                {React.createElement(preview.Comp, { donor: buildDonor(preview.receipt), index: 0, project: preview.templateId })}
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 999;
        }
        .modal {
          position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
          background: #fff; border-radius: 12px; z-index: 1000; box-shadow: 0 8px 30px rgba(0,0,0,0.2);
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
          .modal {
            position: static !important;
            transform: none !important;
            width: 100% !important;
            max-width: none !important;
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .modal-body {
            padding: 0 !important;
            margin: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            display: flex !important;
            justify-content: center !important;
            align-items: flex-start !important;
          }
          [data-receipt-print] {
            position: relative;
            width: 100%;
            margin: -8mm 0 0 !important;
            padding: 0 !important;
            display: flex !important;
            justify-content: center !important;
            align-items: flex-start !important;
            overflow: visible !important;
          }
          [data-receipt-print] [data-receipt-sheet] {
            margin: 0 auto !important;
            max-width: none !important;
            break-inside: avoid;
            page-break-inside: avoid;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          [data-receipt-print] [data-pdf-width="1000"] { zoom: 0.68; }
          [data-receipt-print] [data-pdf-width="900"] { zoom: 0.75; }
          [data-receipt-print] [data-pdf-width="794"] { zoom: 0.85; }
        }
      `}</style>
    </div>
  );
}
