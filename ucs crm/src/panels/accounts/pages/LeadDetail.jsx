import { useState, useEffect, useRef, useCallback } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { TimePicker } from '../../fro/components/TimePicker';
import { apiGet, apiPost } from '../api/auth';
import { generateReceiptPDF } from '../services/pdfGenerator';
import ReceiptTemplate_MannCar from '../components/ReceiptTemplate_MannCar';
import ReceiptTemplate_Ashray from '../components/ReceiptTemplate_Ashray';
import ReceiptTemplate_BeingSevak from '../components/ReceiptTemplate_BeingSevak';

const TEMPLATES = { manncar: ReceiptTemplate_MannCar, ashray: ReceiptTemplate_Ashray, beingsevak: ReceiptTemplate_BeingSevak };
const DB_TO_TEMPLATE = { maan: 'manncar', aflf: 'ashray', bsct: 'beingsevak' };
const PROJECT_LABELS = { maan: 'Mann Care Foundation', aflf: 'Ashray For Life Foundation', bsct: 'Being Sevak Charitable Trust' };
const PAYMENT_MODES = ['UPI', 'Cash', 'Bank Transfer', 'Cheque', 'NEFT'];

function getTemplateId(projectId) { return DB_TO_TEMPLATE[projectId] || 'beingsevak'; }

const currency = n => n != null ? '\u20B9' + Number(n).toLocaleString('en-IN') : '\u2014';

function SkeletonField({ w = 100 }) {
  return <span style={{ display:'block', height:14, width: typeof w === 'number' ? w : w, borderRadius:4, background:'linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%)', backgroundSize:'200% 100%', animation:'sk-shimmer 1.4s infinite', marginBottom:3 }} />;
}
function SkeletonLabel() {
  return <span style={{ display:'block', height:10, width:48, borderRadius:3, background:'linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%)', backgroundSize:'200% 100%', animation:'sk-shimmer 1.4s infinite', marginBottom:6 }} />;
}

function parseDatetime(iso) {
  if (!iso) return { date: null, time: '' };
  try { const d = new Date(iso); const h = String(d.getHours()).padStart(2,'0'); const m = String(d.getMinutes()).padStart(2,'0'); return { date: d, time: `${h}:${m}` }; }
  catch { return { date: null, time: '' }; }
}
function combineDatetime(date, time) {
  if (!date) return null;
  const d = new Date(date);
  if (time) { const [h, m] = time.split(':').map(Number); d.setHours(h||0, m||0, 0, 0); }
  return d.toISOString();
}

function buildDonor(receipt) {
  return {
    'Receipt No.': receipt.receipt_no || '', 'Receipt Date': receipt.receipt_date || '',
    'Donor Name': receipt.donor_name || '', 'Address 1': receipt.address || '',
    'PAN No.': receipt.pan_number || '', 'Email ID': '', 'Amount': receipt.amount || 0,
    'Mode of Payment (MOP)': receipt.mode || '', 'Payment ID No.': '', 'Donor Bank Name': '',
    'Account Of': 'Corpus', 'City': '', 'State': '', 'Pincode': '',
  };
}

function ScreenshotImage({ src, onClick }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div style={{ position:'relative', minHeight:120, background:'var(--bg)' }}>
      {!loaded && (
        <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(90deg,var(--bg) 25%,var(--line) 50%,var(--bg) 75%)',backgroundSize:'200% 100%',animation:'sk-shimmer 1.4s infinite' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="1.5" style={{opacity:.3}}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </div>
      )}
      <img src={src} alt="Payment screenshot" onLoad={() => setLoaded(true)} onClick={onClick} style={{width:'100%',display:loaded?'block':'none',cursor:'pointer'}} />
    </div>
  );
}

export default function LeadDetail({ logId, onBack }) {
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showScreenshot, setShowScreenshot] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [sendingWA, setSendingWA] = useState(false);
  const [waPhone, setWaPhone] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('all');

  const [form, setForm] = useState({ donor_name:'',donor_mobile:'',donor_city:'',donor_email:'',donor_address:'',donor_pan:'', upi_transaction_id:'',transaction_date:null,transaction_time:'',payment_from:'', payment_mode:'UPI' });
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestRef = useRef(null);
  const suggestTimer = useRef(null);

  const fetchSuggestions = useCallback(async (q) => {
    if (!q || q.length < 2) { setSuggestions([]); return; }
    try {
      const data = await apiGet('/accounts/bank-audit/entries/suggest?q=' + encodeURIComponent(q));
      setSuggestions(data || []);
      setShowSuggestions(data?.length > 0);
    } catch { setSuggestions([]); }
  }, []);

  const handleUpiChange = (value) => {
    setField('upi_transaction_id', value);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(() => fetchSuggestions(value), 300);
  };

  const selectSuggestion = (item) => {
    setField('upi_transaction_id', item.payment_id);
    setShowSuggestions(false);
    setSuggestions([]);
  };
  const receiptRef = useRef(null);
  const hasInitRef = useRef(false);

  const load = () => {
    setLoading(true);
    apiGet('/accounts/leads')
      .then(all => all.find(ll => ll.log_id === parseInt(logId)))
      .then(ll => { setLead(ll||null); return ll; })
      .then(ll => {
        if (ll && !hasInitRef.current) {
          const {date,time} = parseDatetime(ll.transaction_datetime);
          setForm({ donor_name:ll.donor_name||'',donor_mobile:ll.donor_mobile||'',donor_city:ll.donor_city||'', donor_email:ll.donor_email||'',donor_address:ll.donor_address||'',donor_pan:ll.pan_number||ll.donor_pan||'', upi_transaction_id:ll.upi_transaction_id||'',transaction_date:date,transaction_time:time, payment_from:ll.payment_from||'',payment_mode:ll.payment_mode||'UPI' });
          hasInitRef.current = true;
        }
      }).catch(()=>{})
      .finally(() => setLoading(false));
  };

  const loadReceipt = async () => {
    if (!lead) return;
    try { const r = await apiGet(`/accounts/leads/${lead.log_id}/receipt`); setReceipt(r||null); }
    catch { setReceipt(null); }
  };

  const loadHistory = async () => {
    if (!l?.donor_id) return;
    setHistory([]); setHistoryOpen(true); setHistoryLoading(true);
    try { const d = await apiGet(`/accounts/donor/${l.donor_id}/history`); setHistory(d||[]); }
    catch { setHistory([]); }
    finally { setHistoryLoading(false); }
  };

  useEffect(()=>{load();},[logId]);
  useEffect(()=>{if(lead&&lead.accounts_status==='verified')loadReceipt();},[lead?.accounts_status]);
  useEffect(()=>{
    if(lead?.donor_mobile){
      const raw=lead.donor_mobile.replace(/\D/g,'');
      const f=raw.length===10?'91'+raw:raw.startsWith('0')?'91'+raw.slice(1):raw;
      setWaPhone(f);
    }
  },[lead?.donor_mobile]);
  const setField = (key,val) => setForm(prev=>({...prev,[key]:val}));

  const handleVerify = async () => {
    if (!lead) return; setConfirmOpen(false); setSubmitting(true);
    try {
      const res = await apiPost(`/accounts/leads/${lead.log_id}/verify`, {
        pan_number:form.donor_pan||null,donor_name:form.donor_name||null,donor_mobile:form.donor_mobile||null,
        donor_city:form.donor_city||null,donor_email:form.donor_email||null,donor_pan:form.donor_pan||null,
        donor_address:form.donor_address||null,upi_transaction_id:form.upi_transaction_id||null,
        transaction_datetime:combineDatetime(form.transaction_date,form.transaction_time),
        payment_from:form.payment_from||null,payment_mode:form.payment_mode||'UPI',
      });
      if (res.receipt) setReceipt(res.receipt);
      load();
    } catch(err) { alert(err.message); }
    finally { setSubmitting(false); }
  };

  const handleReject = async () => {
    if (!lead||!rejectReason.trim()) return; setRejectOpen(false); setSubmitting(true);
    try { await apiPost(`/accounts/leads/${lead.log_id}/reject`,{reason:rejectReason}); setRejectReason(''); load(); }
    catch(err) { alert(err.message); }
    finally { setSubmitting(false); }
  };

  const handleDownload = async () => {
    if (!receiptRef.current) return;
    try { const pdf = await generateReceiptPDF(receiptRef.current); pdf.save(`receipt_${(receipt?.receipt_no||'download').replace(/[/\\]/g,'_')}.pdf`); }
    catch(err) { alert('Failed: '+err.message); }
  };

  const sendWA = () => {
    const phone = (waPhone || '').replace(/\D/g, '');
    if (!phone || phone.length < 10) { alert('Please enter a valid WhatsApp number'); return; }
    const pid = (lead?.donor_project || '').toLowerCase();
    const fname = PROJECT_LABELS[pid] || 'our foundation';
    const amt = Number(receipt?.amount || 0).toLocaleString('en-IN');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`Thank you for your generous donation of \u20B9${amt} to ${fname}. Your receipt (No: ${receipt?.receipt_no || ''}) has been generated.\n\nWith gratitude,\n${fname} Team`)}`, '_blank');
  };

  const openReceiptAndSendWA = () => { setShowReceipt(true); };
  const openReceiptAndDownload = () => { setShowReceipt(true); };

  if (loading) {
    return (
      <div style={{ paddingBottom:65 }}>
        <div className="detail-header"><button className="back-btn" onClick={onBack}>{'\u2190'}</button><div style={{flex:1}}><div style={{fontSize:14,fontWeight:600}}>Lead Details</div></div></div>
        <div className="two-col detail-layout">
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div className="card"><div className="card-head"><h3>Payment & Transaction Details</h3></div><div className="card-pad"><div className="info-grid">{[1,2,3,4,5,6,7,8].map(i=><div key={i}><SkeletonLabel /><SkeletonField w={`${50+Math.random()*40}%`} /></div>)}</div></div></div>
            <div className="card"><div className="card-head"><h3>Donor Information</h3></div><div className="card-pad"><div className="info-grid">{[1,2,3,4,5,6,7,8,9,10].map(i=><div key={i}><SkeletonLabel /><SkeletonField w={`${50+Math.random()*40}%`} /></div>)}</div></div></div>
          </div>
          <div><div className="card" style={{overflow:'hidden'}}><ScreenshotImage src={null} /></div></div>
        </div>
      </div>
    );
  }
  if (!lead) return <div className="empty-state"><p>Lead not found</p><button className="btn" onClick={onBack}>Back to Leads</button></div>;

  const l = lead;
  const isPending = l.accounts_status === 'pending';
  const isVerified = l.accounts_status === 'verified';
  const projectId = (l.donor_project||'').toLowerCase();
  const templateId = getTemplateId(projectId);
  const ReceiptComp = TEMPLATES[templateId];
  const donor = receipt ? buildDonor(receipt) : null;

  const filteredHistory = (() => {
    if (historyFilter === 'all') return history;
    const now = new Date();
    if (historyFilter === 'this-month') return history.filter(h => h.verified_at && new Date(h.verified_at).getMonth()===now.getMonth() && new Date(h.verified_at).getFullYear()===now.getFullYear());
    if (historyFilter === 'this-year') return history.filter(h => h.verified_at && new Date(h.verified_at).getFullYear()===now.getFullYear());
    if (historyFilter.startsWith('fy')) {
      const fyYear = parseInt(historyFilter.split('-')[1]);
      return history.filter(h => {
        if (!h.verified_at) return false;
        const d = new Date(h.verified_at);
        const y = d.getFullYear();
        const m = d.getMonth()+1;
        return (m >= 4 && y === fyYear) || (m <= 3 && y === fyYear+1);
      });
    }
    return history;
  })();

  const finYears = [];
  for (let y = new Date().getFullYear(); y >= 2022; y--) finYears.push(`FY ${y}-${(y+1).toString().slice(-2)}`);

  return (
    <div style={{ paddingBottom:65 }}>
      <div className="detail-header">
        <button className="back-btn" onClick={onBack}>{'\u2190'}</button>
        <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600}}>Lead Details</div></div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {isVerified && <span className="pill pill-green">Verified</span>}
          {l.accounts_status==='rejected' && <span className="pill pill-red" title={l.rejection_reason||''}>Rejected</span>}
        </div>
      </div>

      {(l.notes||l.remark||l.rejection_reason)&&(
        <div className="card" style={{borderLeft:'3px solid #dc2626',marginBottom:16}}>
          <div className="card-pad" style={{padding:'10px 16px',background:'#fef2f2'}}>
            {l.remark&&<div style={{display:'flex',gap:8,alignItems:'flex-start'}}><span style={{fontSize:11,fontWeight:700,color:'#dc2626',textTransform:'uppercase',whiteSpace:'nowrap',marginTop:1}}>Remark:</span><p style={{margin:0,fontSize:13,color:'#991b1b',whiteSpace:'pre-wrap'}}>{l.remark}</p></div>}
            {l.notes&&<div style={{display:'flex',gap:8,alignItems:'flex-start',marginTop:l.remark?8:0}}><span style={{fontSize:11,fontWeight:700,color:'#dc2626',textTransform:'uppercase',whiteSpace:'nowrap',marginTop:1}}>Notes:</span><p style={{margin:0,fontSize:13,color:'#991b1b',whiteSpace:'pre-wrap'}}>{l.notes}</p></div>}
            {l.rejection_reason&&<div style={{display:'flex',gap:8,alignItems:'flex-start',marginTop:(l.remark||l.notes)?8:0}}><span style={{fontSize:11,fontWeight:700,color:'#dc2626',textTransform:'uppercase',whiteSpace:'nowrap',marginTop:1}}>Rejection:</span><p style={{margin:0,fontSize:13,color:'#991b1b',whiteSpace:'pre-wrap'}}>{l.rejection_reason}</p></div>}
          </div>
        </div>
      )}

      <div className="two-col detail-layout">
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div className="card">
            <div className="card-head"><h3>Payment & Transaction Details</h3></div>
            <div className="card-pad">
              <div className="info-grid">
                <div><div className="label">Amount</div><div className="value-mono" style={{color:'var(--sage)'}}>{currency(l.amount)}</div></div>
                <div><div className="label">Agent</div><div className="value">{l.agent_name} <span style={{fontSize:10,color:'var(--ink-soft)'}}>({l.agent_login})</span></div></div>
                <div><div className="label">Submitted</div><div className="value">{new Date(l.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div></div>
                <div><div className="label">Payment Mode</div>{isPending?<select className="field-input" value={form.payment_mode} onChange={e=>setField('payment_mode',e.target.value)}>{PAYMENT_MODES.map(m=><option key={m} value={m}>{m}</option>)}</select>:<div className="value">{form.payment_mode||'\u2014'}</div>}</div>
                 <div style={{position:'relative'}} ref={suggestRef}><div className="label">UPI Transaction ID</div>{isPending?<input className="field-input" value={form.upi_transaction_id} onChange={e=>handleUpiChange(e.target.value)} placeholder="e.g. UPI123456789" onBlur={()=>setTimeout(()=>setShowSuggestions(false),200)} onFocus={()=>suggestions.length>0&&setShowSuggestions(true)} />:<div className="value">{form.upi_transaction_id||'\u2014'}</div>}{isPending&&showSuggestions?<div style={{position:'absolute',top:'100%',left:0,right:0,background:'var(--card-bg)',border:'1px solid var(--line)',borderRadius:'var(--radius-sm)',boxShadow:'var(--shadow-md)',zIndex:50,maxHeight:200,overflowY:'auto',marginTop:2}}>{suggestions.map(s=><div key={s.id} onMouseDown={()=>selectSuggestion(s)} style={{padding:'8px 10px',cursor:'pointer',fontSize:12,borderBottom:'1px solid var(--line)',display:'flex',justifyContent:'space-between',alignItems:'center'}} onMouseOver={e=>e.currentTarget.style.background='var(--bg)'} onMouseOut={e=>e.currentTarget.style.background='transparent'}><span>{s.payment_id}</span><span className="pill pill-gray" style={{fontSize:10}}>{s.bank_audit_sources?.name}</span></div>)}</div>:null}</div>
                <div><div className="label">Date</div>{isPending?<DatePicker selected={form.transaction_date} onChange={d=>setField('transaction_date',d)} dateFormat="dd/MM/yyyy" placeholderText="Select date" isClearable showYearDropdown scrollableYearDropdown yearDropdownItemNumber={50} className="datepicker-input" />:<div className="value">{form.transaction_date?new Date(form.transaction_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'\u2014'}</div>}</div>
                <div><div className="label">Time</div>{isPending?<div className="field-picker"><TimePicker value={form.transaction_time} onChange={e=>setField('transaction_time',e.target.value)} placeholder="Select time" /></div>:<div className="value">{form.transaction_time||'\u2014'}</div>}</div>
                <div><div className="label">From</div>{isPending?<input className="field-input" value={form.payment_from} onChange={e=>setField('payment_from',e.target.value)} placeholder="Sender name" />:<div className="value">{form.payment_from||'\u2014'}</div>}</div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Donor Information</h3></div>
            <div className="card-pad">
              <div className="info-grid">
                <div><div className="label">Name</div>{isPending?<input className="field-input" value={form.donor_name} onChange={e=>setField('donor_name',e.target.value)} placeholder="Donor name" />:<div className="value">{form.donor_name||'\u2014'}</div>}</div>
                <div><div className="label">Mobile</div>{isPending?<input className="field-input" value={form.donor_mobile} onChange={e=>setField('donor_mobile',e.target.value)} placeholder="Mobile" />:<div className="value">{form.donor_mobile||'\u2014'}</div>}</div>
                <div><div className="label">City</div>{isPending?<input className="field-input" value={form.donor_city} onChange={e=>setField('donor_city',e.target.value)} placeholder="City" />:<div className="value">{form.donor_city||'\u2014'}</div>}</div>
                <div><div className="label">Email</div>{isPending?<input className="field-input" value={form.donor_email} onChange={e=>setField('donor_email',e.target.value)} placeholder="Email" />:<div className="value">{form.donor_email||'\u2014'}</div>}</div>
                <div><div className="label">Address</div>{isPending?<input className="field-input" value={form.donor_address} onChange={e=>setField('donor_address',e.target.value)} placeholder="Address" />:<div className="value">{form.donor_address||'\u2014'}</div>}</div>
                <div><div className="label">PAN</div>{isPending?<input className="field-input" value={form.donor_pan} onChange={e=>setField('donor_pan',e.target.value)} placeholder="ABCDE1234F" />:<div className="value">{form.donor_pan||'\u2014'}</div>}</div>
                <div><div className="label">DOB</div><div className="value">{l.donor_dob||'\u2014'}</div></div>
                <div><div className="label">Project</div><div className="value">{l.donor_project||'\u2014'}</div></div>
                <div><div className="label">Donations</div><div className="value">{l.donation_count||0} times</div></div>
                <div><div className="label">Total Donated</div><div className="value-mono" style={{color:'var(--sage)',cursor:'pointer',borderBottom:'1px dashed var(--sage)'}} onClick={loadHistory} title="Click to view donation history">{currency(l.total_donated)}</div></div>
              </div>
            </div>
          </div>
        </div>
        <div>
          {l.screenshot_url ? (
            <div className="card" style={{position:'sticky',top:16,overflow:'hidden'}}>
              <ScreenshotImage src={l.screenshot_url} onClick={()=>setShowScreenshot(true)} />
            </div>
          ) : (
            <div className="card" style={{overflow:'hidden'}}>
              <div style={{textAlign:'center',padding:'40px 20px',color:'var(--ink-soft)'}}><div style={{fontSize:32,marginBottom:8,opacity:.3}}>{'\u{1F5BC}\uFE0F'}</div><div style={{fontSize:13}}>No screenshot available</div></div>
            </div>
          )}
        </div>
      </div>

      {showScreenshot && l.screenshot_url && (
        <div className="modal-overlay" onClick={()=>setShowScreenshot(false)} style={{cursor:'zoom-out'}}>
          <img src={l.screenshot_url} alt="Payment screenshot" style={{maxWidth:'90%',maxHeight:'90%',borderRadius:8}} />
        </div>
      )}

      {receipt && donor && ReceiptComp && (
        <div style={{ position:'absolute',zIndex:-1,opacity:0,pointerEvents:'none' }}>
          <div ref={receiptRef} data-receipt data-receipt-print><ReceiptComp donor={donor} index={0} project={templateId} /></div>
        </div>
      )}

      <div className="action-bar">
        {isPending && (
          <div style={{display:'flex',gap:12,maxWidth:600,margin:'0 auto',width:'100%'}}>
            <button onClick={()=>setRejectOpen(true)} disabled={submitting} className="reject-btn" style={{flex:1}}>{submitting?'...':'\u2716 Reject'}</button>
            <button onClick={()=>setConfirmOpen(true)} disabled={submitting} className="verify-btn" style={{flex:2}}>{submitting?<span style={{display:'inline-flex',alignItems:'center',gap:6}}><span style={{display:'inline-block',width:14,height:14,border:'2px solid #fff',borderTopColor:'transparent',borderRadius:'50%',animation:'spin .6s linear infinite'}}/>Saving</span>:'\u2714 Verify & Save'}</button>
          </div>
        )}
        {isVerified && receipt && (
          <div style={{display:'flex',gap:12,maxWidth:600,margin:'0 auto',width:'100%'}}>
            <button className="wa-btn" onClick={()=>setShowReceipt(true)}>{'\u2709'} Send WhatsApp</button>
            <button className="verify-btn" style={{flex:1}} onClick={()=>setShowReceipt(true)}>View Receipt</button>
          </div>
        )}
      </div>

      {confirmOpen && (
        <div className="modal-overlay" onClick={()=>setConfirmOpen(false)}>
          <div className="modal" style={{maxWidth:420,width:'90%'}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><h3>Confirm Verification</h3></div>
            <div className="modal-body" style={{padding:20}}>
              <p style={{margin:'0 0 6px',fontSize:14}}>Verify this lead and mark amount as collected?</p>
              <p style={{margin:0,fontSize:13,color:'var(--ink-soft)'}}>A receipt will be auto-generated on verification.</p>
              <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:20}}>
                <button className="btn btn-sm" onClick={()=>setConfirmOpen(false)}>Cancel</button>
                <button className="verify-btn" onClick={handleVerify} disabled={submitting}>{submitting?<span style={{display:'inline-flex',alignItems:'center',gap:6}}><span style={{display:'inline-block',width:14,height:14,border:'2px solid #fff',borderTopColor:'transparent',borderRadius:'50%',animation:'spin .6s linear infinite'}}/>Saving</span>:'\u2714 Confirm & Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {rejectOpen && (
        <div className="modal-overlay" onClick={()=>setRejectOpen(false)}>
          <div className="modal" style={{maxWidth:420,width:'90%'}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><h3>Reject Lead</h3></div>
            <div className="modal-body" style={{padding:20}}>
              <label className="field" style={{display:'block',marginBottom:16}}><span style={{fontSize:11,color:'var(--ink-soft)',textTransform:'uppercase',marginBottom:4,display:'block'}}>Reason</span><textarea className="field-input" value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="Enter rejection reason..." rows={3} style={{resize:'vertical'}} autoFocus /></label>
              <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                <button className="btn btn-sm" onClick={()=>{setRejectOpen(false);setRejectReason('');}}>Cancel</button>
                <button className="reject-btn" onClick={handleReject} disabled={!rejectReason.trim()} style={{background:'#dc2626',color:'#fff',border:'none'}}>Reject</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReceipt && receipt && donor && ReceiptComp && (
        <div className="modal-overlay" onClick={()=>setShowReceipt(false)}>
          <div className="modal" style={{maxWidth:800,width:'90%',maxHeight:'90vh',overflow:'auto'}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h3>Receipt Preview</h3>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <input
                  type="tel"
                  className="field-input"
                  placeholder="WhatsApp number"
                  value={waPhone}
                  onChange={e => setWaPhone(e.target.value)}
                  style={{ width: 200, fontSize: 12, padding: '6px 10px' }}
                />
                <button className="btn btn-primary btn-sm" onClick={handleDownload}>Download PDF</button>
                <button className="btn btn-sm" style={{background:'#25D366',color:'#fff'}} onClick={sendWA}>Send via WhatsApp</button>
                <button className="btn btn-sm" onClick={()=>setShowReceipt(false)}>Close</button>
              </div>
            </div>
            <div className="modal-body" style={{padding:20}}>
              <div data-receipt-print><ReceiptComp donor={donor} index={0} project={templateId} /></div>
            </div>
          </div>
        </div>
      )}

      {historyOpen && (
        <div className="modal-overlay" onClick={()=>setHistoryOpen(false)}>
          <div className="modal" style={{maxWidth:700,width:'90%',maxHeight:'85vh',overflow:'auto'}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h3>Donation History — {l.donor_name}</h3>
              <button className="btn btn-sm" onClick={()=>setHistoryOpen(false)}>Close</button>
            </div>
            <div className="modal-body" style={{padding:16}}>
              <div className="filter-bar" style={{marginBottom:12}}>
                <select className="field-input" value={historyFilter} onChange={e=>setHistoryFilter(e.target.value)} style={{maxWidth:200}}>
                  <option value="all">All Time</option>
                  <option value="this-month">This Month</option>
                  <option value="this-year">This Year</option>
                  {finYears.map(fy=><option key={fy} value={fy}>{fy}</option>)}
                </select>
              </div>
              {historyLoading ? <div style={{textAlign:'center',padding:20,color:'var(--ink-soft)'}}>Loading...</div> :
               filteredHistory.length===0 ? <div style={{textAlign:'center',padding:20,color:'var(--ink-soft)'}}>No donation history found</div> :
               <div className="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Amount</th><th>Mode</th><th>From</th><th>UPI Ref</th><th>Receipt</th><th>Agent</th></tr></thead>
                  <tbody>
                    {filteredHistory.map(h=>(
                      <tr key={h.log_id}>
                        <td style={{fontSize:11}}>{h.verified_at?new Date(h.verified_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'\u2014'}</td>
                        <td><strong style={{color:'var(--sage)'}}>{currency(h.amount)}</strong></td>
                        <td style={{fontSize:12}}>{h.payment_mode||'\u2014'}</td>
                        <td style={{fontSize:12}}>{h.payment_from||'\u2014'}</td>
                        <td style={{fontSize:11,fontFamily:'monospace'}}>{h.upi_transaction_id||'\u2014'}</td>
                        <td style={{fontSize:11,fontFamily:'monospace'}}>{h.receipt_no||'\u2014'}</td>
                        <td><span className="pill pill-gray">{h.agent_name}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes sk-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        .verify-btn{padding:10px 22px;font-size:13px;font-weight:600;background:linear-gradient(135deg,#059669,#047857);color:#fff;border:none;border-radius:10px;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 2px 8px rgba(5,150,105,.25)}
        .verify-btn:hover:not(:disabled){background:linear-gradient(135deg,#047857,#065f46);transform:translateY(-1px);box-shadow:0 6px 20px rgba(5,150,105,.35)}
        .verify-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
        .reject-btn{padding:10px 22px;font-size:13px;font-weight:500;background:#fff;color:#dc2626;border:1.5px solid #fecaca;border-radius:10px;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;justify-content:center;gap:6px}
        .reject-btn:hover:not(:disabled){background:#fef2f2;border-color:#fca5a5;transform:translateY(-1px);box-shadow:0 4px 12px rgba(220,38,38,.1)}
        .reject-btn:disabled{opacity:.4;cursor:not-allowed;transform:none}
        .wa-btn{padding:10px 22px;font-size:13px;font-weight:600;background:#25D366;color:#fff;border:none;border-radius:10px;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;justify-content:center;gap:6px;flex:1.2}
        .wa-btn:hover:not(:disabled){background:#1ea350;transform:translateY(-1px);box-shadow:0 4px 12px rgba(37,211,102,.3)}
        .wa-btn:disabled{opacity:.5;cursor:not-allowed}
        .field-input{width:100%;box-sizing:border-box;padding:8px 12px;font-size:13px;border:1px solid #e5e7eb;border-radius:8px;outline:none;background:#f9fafb;color:#1f2937;transition:border-color .15s,box-shadow .15s,background .15s;height:36px}
        .field-input:focus{border-color:var(--sage,#5B6B4E);box-shadow:0 0 0 3px rgba(91,107,78,.08);background:#fff}
        .field-input::placeholder{color:#9ca3af}
        .field-picker button{height:36px!important;padding:8px 12px!important;font-size:13px!important;border:1px solid #e5e7eb!important;border-radius:8px!important;background:#f9fafb!important;color:#1f2937!important;display:flex!important;align-items:center!important;box-sizing:border-box!important}
        .action-bar{position:fixed;bottom:0;left:200px;right:0;z-index:50;background:rgba(255,255,255,.97);backdrop-filter:blur(16px);border-top:1px solid #e5e7eb;padding:10px 24px;display:flex;justify-content:center;box-shadow:0 -2px 12px rgba(0,0,0,.06)}
        @media(max-width:952px){.action-bar{left:0}}
        .datepicker-input{width:100%;box-sizing:border-box;padding:8px 12px;font-size:13px;border:1px solid #e5e7eb;border-radius:8px;outline:none;background:#f9fafb;color:#1f2937;height:36px}
        .datepicker-input:focus{border-color:var(--sage,#4ade80);box-shadow:0 0 0 2px rgba(74,222,128,.15)}
        .react-datepicker{font-family:inherit;font-size:13px;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.08)}
        .react-datepicker__header{background:#f0fdf4;border-bottom:1px solid #dcfce7;border-radius:10px 10px 0 0;padding-top:10px}
        .react-datepicker__current-month{font-weight:600;color:#166534;font-size:14px}
        .react-datepicker__day-name{color:#6b7280;font-weight:500;font-size:11px;width:32px}
        .react-datepicker__day{width:32px;height:32px;line-height:32px;border-radius:8px;margin:1px;color:#374151}
        .react-datepicker__day:hover{background:#dcfce7;border-radius:8px}
        .react-datepicker__day--selected,.react-datepicker__day--keyboard-selected{background:#166534!important;color:#fff!important;border-radius:8px}
        .react-datepicker__day--today{font-weight:700;color:#166534;background:#f0fdf4}
        .react-datepicker__navigation{top:10px}
        .react-datepicker__year-dropdown-container{margin-left:5px}
        .react-datepicker__year-select{padding:2px 6px;font-size:13px;border:1px solid #d1d5db;border-radius:4px;background:#fff;color:#166534;font-weight:600;cursor:pointer;outline:none}
        .react-datepicker__close-icon::after{background:#9ca3af;font-size:14px;height:16px;width:16px}
        .react-datepicker__triangle{display:none}
        select.field-input{cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");background-position:right 8px center;background-repeat:no-repeat;background-size:16px;padding-right:32px}
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:999;display:flex;align-items:center;justify-content:center}
        .modal{position:relative;background:#fff;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.2)}
        .modal-header{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;border-bottom:1px solid #e5e7eb}
        .modal-header h3{margin:0;font-size:16px}
        .modal-body{overflow:auto;max-height:calc(90vh - 70px)}
        @media print{
          @page{size:A4 portrait;margin:8mm}
          html,body{margin:0!important;padding:0!important;background:#fff!important}
          body *{visibility:hidden}
          [data-receipt-print],[data-receipt-print] *{visibility:visible}
          .modal-overlay{display:none!important}
          .modal-header{display:none!important}
          .modal{position:static!important;transform:none!important;width:100%!important;max-width:none!important;max-height:none!important;overflow:visible!important;box-shadow:none!important;border-radius:0!important;margin:0!important;padding:0!important}
          .modal-body{padding:0!important;margin:0!important;max-height:none!important;overflow:visible!important;display:flex!important;justify-content:center!important}
          [data-receipt-print]{position:relative;width:100%;margin:-8mm 0 0!important;padding:0!important;display:flex!important;justify-content:center!important}
          [data-receipt-print] [data-receipt-sheet]{margin:0 auto!important;max-width:none!important;break-inside:avoid;page-break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}
          [data-receipt-print] [data-pdf-width="1000"]{zoom:.68}
          [data-receipt-print] [data-pdf-width="900"]{zoom:.75}
          [data-receipt-print] [data-pdf-width="794"]{zoom:.85}
        }
      `}</style>
    </div>
  );
}
