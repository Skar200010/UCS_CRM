import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { apiGet, apiPost, apiDelete } from '../api/auth';
import { getReceipt } from '../api/receipts';
import { PROJECTS } from '../data/projects';
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

function buildDonor(r, lead) {
  return {
    'Receipt No.': r.receipt_no || '',
    'Receipt Date': r.receipt_date || '',
    'Donor Name': r.donor_name || '',
    'Address 1': r.address || '',
    'PAN No.': r.pan_number || '',
    'Email ID': lead?.donor_email || r.email || '',
    'Amount': r.amount || 0,
    'Mode of Payment (MOP)': r.mode || lead?.payment_mode || '',
    'Payment ID No.': lead?.upi_transaction_id || r.payment_id || '',
    'Donor Bank Name': lead?.payment_from || r.bank_name || '',
    'Account Of': 'Corpus',
    'City': lead?.donor_city || '',
    'State': '',
    'Pincode': '',
  };
}

const currency = n => n != null ? '\u20B9' + Number(n).toLocaleString('en-IN') : '\u2014';

const StatCard = ({ icon, label, value, sub, color }) => (
  <div className="stat-card">
    <div className="stat-icon" style={{ background: color + '18', color }}>{icon}</div>
    <div className="stat-info">
      <div className="stat-num">{value}</div>
      <div className="stat-lbl">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  </div>
);

export default function ReceiptHistory() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [donorDetail, setDonorDetail] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [waPhone, setWaPhone] = useState('');
  const [waLoading, setWaLoading] = useState(false);
  const [waResult, setWaResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [dPage, setDPage] = useState(1);
  const fileRef = useRef(null);
  const perPage = 50;

  const handleFile = useCallback((file) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      alert('Please upload a valid Excel/CSV file'); return;
    }
    setImporting(true); setImportResult(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        if (!rows || rows.length === 0) { alert('File is empty'); return; }
        const res = await apiPost('/accounts/receipts/import', { receipts: rows });
        setImportResult(res);
        load();
      } catch (err) { alert('Import failed: ' + err.message); }
      finally { setImporting(false); }
    };
    reader.onerror = () => { alert('Failed to read file'); setImporting(false); };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleCleanUp = async () => {
    if (!confirm('Delete ALL receipts? This cannot be undone.')) return;
    if (!confirm('Are you sure? All receipt data will be permanently removed.')) return;
    try {
      await apiDelete('/accounts/receipts');
      alert('All receipts deleted.');
      load();
    } catch (err) { alert('Clean up failed: ' + err.message); }
  };

  const load = () => {
    setLoading(true);
    apiGet('/accounts/receipts')
      .then(setReceipts)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => { setDPage(1); }, [searchQuery, projectFilter]);

  const stats = useMemo(() => {
    const totalAmount = receipts.reduce((s, r) => s + Number(r.amount || 0), 0);
    const donorSet = new Set();
    receipts.forEach(r => {
      const mobile = (r.donor_mobile || '').replace(/\D/g, '');
      if (mobile) donorSet.add(mobile);
    });
    const byProject = {};
    receipts.forEach(r => {
      const pid = r.project_id || 'other';
      byProject[pid] = (byProject[pid] || 0) + 1;
    });
    return { total: receipts.length, donors: donorSet.size, totalAmount, byProject };
  }, [receipts]);

  const filtered = useMemo(() => {
    return receipts.filter(r => {
      if (projectFilter && r.project_id !== projectFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (r.donor_name || '').toLowerCase().includes(q);
        const matchNo = (r.receipt_no || '').toLowerCase().includes(q);
        if (!matchName && !matchNo) return false;
      }
      return true;
    });
  }, [receipts, searchQuery, projectFilter]);

  const uniqueDonors = useMemo(() => {
    const seen = new Set();
    return filtered.filter(r => {
      const mobile = (r.donor_mobile || '').replace(/\D/g, '');
      if (!mobile) return true;
      if (seen.has(mobile)) return false;
      seen.add(mobile);
      return true;
    });
  }, [filtered]);

  const totalPages = Math.ceil(uniqueDonors.length / perPage) || 1;
  const paginatedDonors = uniqueDonors.slice((dPage - 1) * perPage, dPage * perPage);

  const handlePreview = async (r) => {
    const templateId = getTemplateId(r.project_id);
    const Comp = TEMPLATES[templateId];
    if (!Comp) return;
    let leadData = null;
    setWaPhone('');
    setWaLoading(true);
    try {
      const leads = await apiGet('/accounts/leads');
      const lead = leads.find(l => String(l.log_id) === String(r.log_id));
      leadData = lead || null;
      const mobile = lead?.donor_mobile || '';
      if (mobile) {
        const raw = mobile.replace(/\D/g, '');
        const formatted = raw.length === 10 ? '91' + raw : raw.startsWith('0') ? '91' + raw.slice(1) : raw;
        setWaPhone(formatted);
      }
    } catch {}
    finally { setWaLoading(false); }
    setPreview({ receipt: r, templateId, Comp, donorMobile: '', lead: leadData });
  };

  const handleDownload = async () => {
    if (!preview) return;
    setDownloading(true);
    try {
      const el = document.querySelector('[data-receipt-preview]');
      if (!el) return;
      const pdf = await generateReceiptPDF(el);
      pdf.save(`receipt_${preview.receipt.receipt_no.replace(/[/\\]/g, '_')}.pdf`);
    } catch (err) { alert('Failed to generate PDF: ' + err.message); }
    finally { setDownloading(false); }
  };

  const handleWhatsApp = async () => {
    if (!preview) return;
    const phone = (waPhone || '').replace(/\D/g, '');
    if (!phone || phone.length < 10) { alert('Please enter a valid phone number'); return; }
    setWaLoading(true);
    setWaResult(null);
    try {
      const el = document.querySelector('[data-receipt-preview]');
      let pdfBase64 = null;
      if (el) {
        const pdf = await generateReceiptPDF(el, { scale: 1, jpegQuality: 0.7 });
        pdfBase64 = pdf.output('datauristring').split(',')[1];
      }
      const res = await apiPost(`/whatsapp/send-receipt/${preview.receipt.log_id}`, {
        number: phone,
        pdfBase64,
        receiptNo: preview.receipt.receipt_no,
        donorName: preview.receipt.donor_name,
        amount: preview.receipt.amount,
      });
      setWaResult({ success: true, message: res.uploadError ? 'Sent (text only - PDF upload failed: ' + res.uploadError + ')' : 'Receipt PDF sent via WhatsApp!' });
    } catch (err) {
      setWaResult({ success: false, message: 'Failed: ' + err.message });
    } finally { setWaLoading(false); }
  };

  const projectOptions = useMemo(() => {
    const seen = new Set();
    return receipts.filter(r => { if (seen.has(r.project_id)) return false; seen.add(r.project_id); return true; }).map(r => r.project_id);
  }, [receipts]);

  return (
    <div>
      <div className="card" style={{ marginBottom: 16, borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="2" strokeLinecap="round">
              <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Import Receipts</span>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={e => { handleFile(e.target.files[0]); e.target.value = '' }} style={{ display: 'none' }} />
            <button className="btn btn-sm" style={{ background: 'var(--sage)', color: '#fff', border: 'none' }}
              onClick={() => fileRef.current?.click()} disabled={importing}>
              {importing ? 'Importing...' : 'Upload Excel'}
            </button>
            <button className="btn btn-sm" style={{ background: '#dc2626', color: '#fff', border: 'none', marginLeft: 8 }} onClick={handleCleanUp}>
              Clean Up
            </button>
          </div>
          {importResult && (
            <span style={{ fontSize: 12, color: '#059669', display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              {importResult.message}{importResult.withBank != null ? ` (${importResult.withBank} with bank)` : ''}
            </span>
          )}
        </div>
      </div>
      <div className="stats-grid">
        {loading ? (
          <>
            {[1,2,3].map(i => (
              <div key={i} className="stat-card" style={{ padding: 20 }}>
                <div className="sk" style={{ width: '40%', height: 14, borderRadius: 4, marginBottom: 8 }} />
                <div className="sk" style={{ width: '60%', height: 22, borderRadius: 4 }} />
              </div>
            ))}
          </>
        ) : (<>
        <StatCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>} label="Total Receipts" value={stats.total} color="#5B6B4E" />
        <StatCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>} label="Unique Donors" value={stats.donors} color="#8b5cf6" />
        <StatCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>} label="Total Amount" value={currency(stats.totalAmount)} color="#16a34a" />
        {Object.entries(stats.byProject).map(([pid, count]) => (
          <StatCard key={pid} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 2 7 2 9 22 9 22 7 12 2"/><rect x="4" y="11" width="3" height="7"/><rect x="10.5" y="11" width="3" height="7"/><rect x="17" y="11" width="3" height="7"/><line x1="2" y1="20" x2="22" y2="20"/></svg>} label={PROJECT_LABELS[pid] || pid} value={count} color="#3b82f6" />
        ))}
        </>)}
      </div>

      <div className="card">
        <div className="filter-bar">
          <input
            className="search-input"
            placeholder="Search by receipt no or donor name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>
            <option value="">All Projects</option>
            {projectOptions.map(pid => (
              <option key={pid} value={pid}>{PROJECT_LABELS[pid] || pid}</option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: 'var(--ink-soft)', marginLeft: 'auto' }}>{filtered.length} receipts</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Donor Name</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={2} style={{ padding: '10px 12px' }}><div className="sk" style={{ width: i % 2 === 0 ? '55%' : '40%', height: 14, borderRadius: 4 }} /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={2} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>
                  {searchQuery || projectFilter ? 'No receipts match your filters.' : 'No receipts generated yet.'}
                </td></tr>
              ) : (
                paginatedDonors.map(r => {
                  const rMobile = (r.donor_mobile || '').replace(/\D/g, '');
                  const donorReceipts = rMobile
                    ? filtered.filter(d => (d.donor_mobile || '').replace(/\D/g, '') === rMobile)
                    : filtered.filter(d => (d.donor_name || '').toLowerCase().trim() === (r.donor_name || '').toLowerCase().trim());
                  const totalAmount = donorReceipts.reduce((s, d) => s + Number(d.amount || 0), 0);
                  return (
                    <tr key={r.id} onClick={() => setDonorDetail({ name: r.donor_name, mobile: r.donor_mobile, receipts: donorReceipts })} style={{ cursor: 'pointer' }}
                      onMouseOver={e => e.currentTarget.style.background = '#f0fdf4'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ fontWeight: 600 }}>{r.donor_name || '\u2014'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{donorReceipts.length} receipt{donorReceipts.length !== 1 ? 's' : ''} &middot; {currency(totalAmount)}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {!loading && totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid var(--line)' }}>
              <button onClick={() => setDPage(p => Math.max(1, p - 1))} disabled={dPage === 1}
                style={{ padding: '4px 10px', border: '1px solid var(--line)', borderRadius: 5, background: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer', opacity: dPage === 1 ? 0.4 : 1 }}>
                &larr; Prev
              </button>
              <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Page {dPage} of {totalPages} ({uniqueDonors.length} donors)</span>
              <button onClick={() => setDPage(p => Math.min(totalPages, p + 1))} disabled={dPage === totalPages}
                style={{ padding: '4px 10px', border: '1px solid var(--line)', borderRadius: 5, background: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer', opacity: dPage === totalPages ? 0.4 : 1 }}>
                Next &rarr;
              </button>
            </div>
          )}
        </div>
      </div>

      {preview && (
        <>
          <div className="modal-overlay" onClick={() => setPreview(null)} />
          <div className="modal" style={{ maxWidth: 800, width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h3>Receipt — {preview.receipt.receipt_no}</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="tel"
                  className="field-input"
                  placeholder="WhatsApp number (e.g. 919876543210)"
                  value={waPhone}
                  onChange={e => setWaPhone(e.target.value)}
                  style={{ width: 220, fontSize: 12, padding: '6px 10px' }}
                />
                <button className="btn btn-primary btn-sm" onClick={handleDownload} disabled={downloading}>
                  {downloading ? 'Downloading...' : 'Download PDF'}
                </button>
                {waResult && (
                  <span style={{ fontSize: 11, color: waResult.success ? '#059669' : '#dc2626', marginRight: 4 }}>
                    {waResult.message}
                  </span>
                )}
                <button className="btn btn-sm" style={{ background: '#25D366', color: '#fff' }} onClick={handleWhatsApp} disabled={waLoading}>
                  {waLoading ? 'Sending...' : 'Send via WhatsApp'}
                </button>
                <button className="btn btn-sm" onClick={() => setPreview(null)}>Close</button>
              </div>
            </div>
            <div className="modal-body" style={{ padding: 20 }}>
              <div data-receipt-preview data-receipt-print>
                {React.createElement(preview.Comp, { donor: buildDonor(preview.receipt, preview.lead), index: 0, project: preview.templateId })}
              </div>
            </div>
          </div>
        </>
      )}

      {donorDetail && (
        <>
          <div className="modal-overlay" onClick={() => setDonorDetail(null)} />
          <div className="modal" style={{ maxWidth: 600, width: '90%', maxHeight: '80vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h3>{donorDetail.name} {donorDetail.mobile ? `<${donorDetail.mobile}>` : ''}</h3>
              <button className="btn btn-sm" onClick={() => setDonorDetail(null)}>Close</button>
            </div>
            <div className="modal-body" style={{ padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Receipt No</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Amount</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Mode</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {donorDetail.receipts.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{r.receipt_no}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--sage)' }}>{currency(r.amount)}</td>
                      <td style={{ padding: '8px 12px' }}>{r.receipt_date ? new Date(r.receipt_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '\u2014'}</td>
                      <td style={{ padding: '8px 12px' }}>{r.mode || '\u2014'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <button className="btn btn-sm btn-primary" onClick={() => { setDonorDetail(null); setTimeout(() => handlePreview(r), 50) }} style={{ fontSize: 10, padding: '2px 8px' }}>View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '10px 12px', borderTop: '1px solid var(--line)', textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
                Total: {currency(donorDetail.receipts.reduce((s, r) => s + Number(r.amount || 0), 0))} ({donorDetail.receipts.length} receipt{donorDetail.receipts.length !== 1 ? 's' : ''})
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 2000;
        }
        .modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #fff; border-radius: 12px; z-index: 2001; box-shadow: 0 8px 30px rgba(0,0,0,0.2); }
        .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-bottom: 1px solid #e5e7eb; }
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
          .modal-body { padding: 0 !important; margin: 0 !important; max-height: none !important; overflow: visible !important; display: flex !important; justify-content: center !important; align-items: flex-start !important; }
          [data-receipt-print] { position: relative; width: 100%; margin: -8mm 0 0 !important; padding: 0 !important; display: flex !important; justify-content: center !important; align-items: flex-start !important; overflow: visible !important; }
          [data-receipt-print] [data-receipt-sheet] { margin: 0 auto !important; max-width: none !important; break-inside: avoid; page-break-inside: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          [data-receipt-print] [data-pdf-width="1000"] { zoom: 0.68; }
          [data-receipt-print] [data-pdf-width="900"] { zoom: 0.75; }
          [data-receipt-print] [data-pdf-width="794"] { zoom: 0.85; }
        }
      `}</style>
    </div>
  );
}
