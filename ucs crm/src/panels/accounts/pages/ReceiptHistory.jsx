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
  const [waLoading, setWaLoading] = useState(false);
  const [waResult, setWaResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [dPage, setDPage] = useState(1);
  const [savedDetail, setSavedDetail] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [showCleanModal, setShowCleanModal] = useState(false);
  const fileRef = useRef(null);
  const perPage = 40;

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
    setShowCleanModal(false);
    try {
      await apiDelete('/accounts/receipts');
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
    if (donorDetail) setSavedDetail(donorDetail);
    setDonorDetail(null);
    const templateId = getTemplateId(r.project_id);
    const Comp = TEMPLATES[templateId];
    if (!Comp) return;
    setPreview({ receipt: r, templateId, Comp, lead: null });
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
    const phone = (preview.receipt.donor_mobile || '').replace(/\D/g, '');
    if (!phone || phone.length < 10) { alert('No valid mobile number for this receipt'); return; }
    const formatted = phone.length === 10 ? '91' + phone : phone.startsWith('0') ? '91' + phone.slice(1) : phone;
    setWaLoading(true);
    setWaResult(null);
    try {
      const el = document.querySelector('[data-receipt-preview]');
      let pdfBase64 = null;
      if (el) {
        const pdf = await generateReceiptPDF(el, { scale: 1, jpegQuality: 0.7 });
        pdfBase64 = pdf.output('datauristring').split(',')[1];
      }
      await apiPost('/whatsapp/send-direct', {
        to: formatted,
        pdfBase64,
        receiptNo: preview.receipt.receipt_no,
        donorName: preview.receipt.donor_name,
        amount: preview.receipt.amount,
      });
      try { await apiPost('/accounts/receipts/mark-sent', { receiptId: preview.receipt.id }) } catch {}
      setWaResult({ success: true, message: 'Receipt sent via WhatsApp!' });
    } catch (err) {
      setWaResult({ success: false, message: 'Failed: ' + err.message });
    } finally { setWaLoading(false); }
  };

  const closePreview = () => {
    setPreview(null);
    if (savedDetail) { setDonorDetail(savedDetail); setSavedDetail(null); }
  };

  const projectOptions = useMemo(() => {
    const seen = new Set();
    return receipts.filter(r => { if (seen.has(r.project_id)) return false; seen.add(r.project_id); return true; }).map(r => r.project_id);
  }, [receipts]);

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-pad">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Upload Receipts</span>
            <button style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, cursor: 'pointer' }} onClick={() => setShowCleanModal(true)} title="Delete all receipts">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
          <div
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#5B6B4E' : '#d1d5db'}`, borderRadius: 12, padding: '12px 20px', textAlign: 'center',
              cursor: 'pointer', background: dragOver ? '#f0fdf4' : '#f9fafb', transition: 'all .2s',
            }}
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={e => { handleFile(e.target.files[0]); e.target.value = '' }} style={{ display: 'none' }} />
            {importing ? (
              <div>
                <div style={{ width: 20, height: 20, border: '2px solid #e5e7eb', borderTopColor: '#5B6B4E', borderRadius: '50%', animation: 'spin .6s linear infinite', margin: '0 auto 6px' }} />
                <p style={{ fontSize: 11, color: '#6b7280' }}>Importing...</p>
              </div>
            ) : (
              <>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5B6B4E" strokeWidth="1.5" style={{ marginBottom: 4, opacity: .6 }}>
                  <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 1 }}>Drag & drop your Excel/CSV file here</p>
                <p style={{ fontSize: 10, color: '#9ca3af' }}>or click to browse &nbsp;·&nbsp; .xlsx .xls .csv</p>
              </>
            )}
          </div>
          {importResult && (
            <div style={{ fontSize: 12, color: '#059669', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              {importResult.message}{importResult.withBank != null ? ` (${importResult.withBank} with bank)` : ''}
            </div>
          )}
          <details style={{ marginTop: 8, fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Expected columns</summary>
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: '4px 12px', justifyContent: 'center' }}>
              <span style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 3 }}>Donor Name</span>
              <span style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 3 }}>Receipt No</span>
              <span style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 3 }}> Amt </span>
              <span style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 3 }}>Receipt Date</span>
              <span style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 3 }}>Mobile No.</span>
              <span style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 3 }}>MOP</span>
              <span style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 3 }}>Mail Id</span>
              <span style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 3 }}>Payment Id No.</span>
              <span style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 3 }}>Received Bank</span>
              <span style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 3 }}>Pan No</span>
              <span style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 3 }}>Address-1</span>
              <span style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 3 }}>Project Supported</span>
              <span style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 3 }}>Donors Bank Name</span>
            </div>
          </details>
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
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
                  <div className="sk" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                  <div className="sk" style={{ flex: 1, height: 14, borderRadius: 4 }} />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)', fontSize: 12 }}>
                {searchQuery || projectFilter ? 'No receipts match your filters.' : 'No receipts generated yet.'}
              </div>
            ) : (
              paginatedDonors.map(r => {
                const rMobile = (r.donor_mobile || '').replace(/\D/g, '');
                const donorReceipts = rMobile
                  ? filtered.filter(d => (d.donor_mobile || '').replace(/\D/g, '') === rMobile)
                  : filtered.filter(d => (d.donor_name || '').toLowerCase().trim() === (r.donor_name || '').toLowerCase().trim());
                const totalAmount = donorReceipts.reduce((s, d) => s + Number(d.amount || 0), 0);
                const initial = (r.donor_name || '?')[0].toUpperCase();
                return (
                  <div key={r.id} onClick={() => setDonorDetail({ name: r.donor_name, mobile: r.donor_mobile, receipts: donorReceipts })}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', transition: 'background .12s' }}
                    onMouseOver={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#5B6B4E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{initial}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.donor_name || '\u2014'}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{donorReceipts.length} receipt{donorReceipts.length !== 1 ? 's' : ''}</div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--sage)', whiteSpace: 'nowrap' }}>{currency(totalAmount)}</div>
                  </div>
                );
              })
            )}
          </div>
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
          <div className="modal-overlay" onClick={closePreview} />
          <div className="modal" style={{ maxWidth: 800, width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h3>Receipt — {preview.receipt.receipt_no}</h3>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {waResult && (
                  <span style={{ fontSize: 11, color: waResult.success ? '#059669' : '#dc2626', marginRight: 4, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {waResult.message}
                  </span>
                )}
                <button onClick={handleDownload} disabled={downloading} title="Download PDF"
                  style={{ border: 'none', background: 'var(--sage)', color: '#fff', borderRadius: 6, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {downloading ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="30 10" transform="rotate(0 12 12)"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></circle></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  )}
                </button>
                <button onClick={handleWhatsApp} disabled={waLoading} title="Send via WhatsApp"
                  style={{ border: 'none', background: '#25D366', color: '#fff', borderRadius: 6, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {waLoading ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="30 10" transform="rotate(0 12 12)"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></circle></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg>
                  )}
                </button>
                <button onClick={closePreview} title="Close"
                  style={{ border: 'none', background: '#ef4444', color: '#fff', borderRadius: 6, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
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
                        <button className="btn btn-sm btn-primary" onClick={() => { setSavedDetail(donorDetail); setDonorDetail(null); setTimeout(() => handlePreview(r), 50) }} style={{ fontSize: 10, padding: '2px 8px' }}>View</button>
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

      {showCleanModal && (
        <>
          <div className="modal-overlay" onClick={() => setShowCleanModal(false)} />
          <div className="modal" style={{ maxWidth: 400, width: '90%' }}>
            <div className="modal-header">
              <h3>Delete all receipts?</h3>
              <button className="btn btn-sm" onClick={() => setShowCleanModal(false)}>Cancel</button>
            </div>
            <div className="modal-body" style={{ padding: 20, textAlign: 'center' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.5" style={{ marginBottom: 12 }}>
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              <p style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>This will permanently delete <strong>all {receipts.length} receipts</strong>.</p>
              <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>This action cannot be undone.</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button className="btn btn-sm" onClick={() => setShowCleanModal(false)} style={{ padding: '6px 16px' }}>Cancel</button>
                <button className="btn btn-sm" onClick={handleCleanUp} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '6px 16px' }}>Delete All</button>
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
