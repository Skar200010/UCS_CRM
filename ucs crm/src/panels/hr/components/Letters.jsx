import { useState, useEffect, useRef } from 'react';
import { useHR } from '../store';
import { Dropdown } from './ui';
import { FileTxt } from '../icons';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const TYPES = ['Offer letter','Experience letter','Promotion letter','Warning letter','Relieving letter'];

function buildOfferLetterHTML(w, dateText, hrNameText) {
  const r = w.role || w.department || 'Team Member';
  const d = w.dept || w.department || 'General';
  return `<div style="max-width:800px;margin:0 auto;font-family:'Times New Roman',Times,serif;font-size:12px;line-height:1.25;color:#000;background:#fff;padding:25px 35px">
<div style="display:flex;align-items:center;margin-bottom:4px">
<img src="/logo/ucs-logo.png" alt="UCS" style="width:65px;height:auto;margin-right:14px" />
<div><div style="font-size:18px;font-weight:700;color:#082F5A;letter-spacing:2px;line-height:1.1">ULTIMATE CONSULTANT SOLUTIONS</div><div style="font-size:12px;font-weight:400;color:#0B73C4;letter-spacing:1px">(UCS)</div></div>
</div>
<svg width="100%" height="20" viewBox="0 0 700 20" preserveAspectRatio="none" style="display:block"><path d="M0,10 Q175,20 350,10 Q525,0 700,10 L700,20 L0,20 Z" fill="#0B73C4" /></svg>
<div style="height:2px;background:#F58220;margin-bottom:12px"></div>
<div style="text-align:center;font-size:14px;font-weight:700;color:#082F5A;margin:0 0 8px 0;text-transform:uppercase">Subject: Appointment as ${r}</div>
<table style="width:100%;border-collapse:collapse"><tr><td style="padding:0 0 6px 0;font-size:12px"><strong>Date:</strong> ${dateText}</td></tr></table>
<div style="margin-bottom:6px"><strong>Dear ${w.name},</strong></div>
<div style="text-align:justify">
<p style="margin:0 0 6px 0">We are pleased to inform you that you have been selected for the position of <strong>${r}</strong> in the <strong>${d}</strong> department at <strong>Ultimate Consultant Solutions (UCS)</strong>. Your qualifications and experience impressed us, and we are confident that your skills will be a valuable addition to our team.</p>
<p style="margin:0 0 6px 0">Your anticipated date of joining will be communicated to you shortly. You will be on a probation period of <strong>one (1) month</strong> from the date of joining, during which your performance will be closely monitored and evaluated. Upon satisfactory completion of the probation period, your appointment as a permanent employee will be confirmed by the management.</p>
<p style="margin:0 0 6px 0">During your probation, you are required to perform all duties and responsibilities assigned to you by your Team Leader or Reporting Manager. Your training will consist of two stages: an initial basic training period of <strong>3 (three) days</strong> from the date of joining, followed by a comprehensive training period of <strong>24 (twenty-four) days</strong>. Please note that <strong>no leave will be permitted</strong> during the training period.</p>
<p style="margin:0 0 6px 0"><u><strong>Office Timings:</strong></u> All employees are required to maintain office hours from <strong>10:00 a.m. to 7:00 p.m.</strong>, Monday through Saturday.</p>
<p style="margin:0 0 6px 0"><u><strong>Office Guidelines:</strong></u></p>
<ul style="margin:0 0 6px 0;padding-left:22px">
<li style="margin-bottom:4px">Dress Code (Monday to Friday): Formals</li>
<li style="margin-bottom:4px">Dress Code (Saturday): Casuals</li>
<li style="margin-bottom:4px">Personal mobile phones are not permitted during working hours, except during lunch breaks.</li>
</ul>
<p style="margin:0 0 6px 0">All employees are expected to adhere to the highest standards of professionalism, integrity, and confidentiality. Any breach of the company's code of conduct or confidentiality policies may result in disciplinary action, including termination of employment.</p>
<p style="margin:0 0 6px 0">Please note that during the probation period, you will not be eligible for any other monetary benefits beyond the stipulated stipend. If an employee absconds or voluntarily leaves during the training period, they will not be eligible for any training salary or compensation.</p>
<p style="margin:0 0 6px 0">Kindly sign and return a copy of this appointment letter to confirm your acceptance of the terms and conditions outlined herein. Your appointment will be effective upon your acceptance.</p>
<p style="margin:0 0 6px 0">Congratulations on your appointment, and welcome to the team!</p>
</div>
<div style="margin-top:12px"><p style="margin:0 0 2px 0">Yours sincerely,</p><p style="margin:10px 0 0 0"><strong>HR,</strong><br />${hrNameText}<br /><strong>Ultimate Consultant Solutions (UCS)</strong></p></div>
<div style="margin-top:14px;padding-top:4px"><svg width="100%" height="14" viewBox="0 0 700 14" preserveAspectRatio="none" style="display:block;margin-bottom:3px"><path d="M0,7 Q175,0 350,7 Q525,14 700,7 L700,14 L0,14 Z" fill="#0B73C4" /></svg><div style="height:2px;background:#F58220;margin-bottom:6px"></div><div style="text-align:center;font-size:11px;color:#6b7280">    <strong>Regd. Address:</strong> 506, Sanjar Enclave, Bhadran Nagar, Kandivali (West), Mumbai, Maharashtra 400067.</div></div>
</div>`;
}

function build(type, w) {
  const today = new Date().toLocaleDateString('en-GB',{ day:'numeric', month:'long', year:'numeric' });
  const r = w.role || w.department || 'Team Member';
  const d = w.dept || w.department || 'General';
  const body = {
    'Experience letter': `To Whom It May Concern,\n\nThis is to certify that ${w.name} served as ${r} in our ${d} team. Throughout their time with us they were dependable, collaborative and consistently professional. We wish them every success ahead.\n\nWarm regards,\nThe People Team`,
    'Promotion letter': `Dear ${w.name},\n\nCongratulations. In recognition of your strong contribution to the ${d} team, we are pleased to confirm your promotion, effective immediately. Thank you for the energy you bring to your work.\n\nWarm regards,\nThe People Team`,
    'Warning letter': `Dear ${w.name},\n\nThis letter is a formal note regarding recent conduct in your role as ${r}. We value your contribution and trust this can be resolved. Please treat this as an opportunity to realign with our shared expectations.\n\nRegards,\nThe People Team`,
    'Relieving letter': `Dear ${w.name},\n\nThis confirms that you have been relieved of your duties as ${r}, ${d}, with all responsibilities duly handed over. Thank you for your contributions — we wish you the very best in what comes next.\n\nWarm regards,\nThe People Team`,
  }[type];
  return { today, body };
}

export default function Letters() {
  const { fetchWorkers } = useHR();
  const [workers, setWorkers] = useState([]);
  const [name, setName] = useState('');
  const [type, setType] = useState(TYPES[0]);
  const [letterDate, setLetterDate] = useState('');
  const [hrName, setHrName] = useState('');
  const [out, setOut] = useState(null);
  const [showDownload, setShowDownload] = useState(false);
  const pdfRef = useRef(null);
  const pdfDocRef = useRef(null);

  useEffect(() => { fetchWorkers().then(setWorkers).catch(() => {}); }, []);

  const capturePdf = async (bodyText, letterType) => {
    const el = pdfRef.current;
    if (!el) return;
    el.style.display = 'block';
    if (letterType === 'Offer letter') {
      el.style.padding = '0';
      el.innerHTML = bodyText;
    } else {
      el.style.padding = '40px';
      el.textContent = bodyText;
    }
    await document.fonts?.ready;
    await new Promise(r => setTimeout(r, 100));
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
    el.style.display = 'none';
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const margin = 12;
    const printableW = pdfW - 2 * margin;
    const imgH = (canvas.height * printableW) / canvas.width;
    let remainingH = imgH;
    let offsetY = 0;
    for (let page = 0; remainingH > 0; page++) {
      if (page > 0) pdf.addPage();
      const pageH = Math.min(remainingH, pdfH - 2 * margin);
      const srcH = (pageH * canvas.height) / imgH;
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = srcH;
      pageCanvas.getContext('2d').drawImage(canvas, 0, offsetY, canvas.width, srcH, 0, 0, canvas.width, srcH);
      pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', margin, margin, printableW, pageH);
      offsetY += srcH;
      remainingH -= pageH;
    }
    pdfDocRef.current = pdf;
  };

  const generate = async () => {
    const w = workers.find(x => x.name === name);
    if (!w) return;
    let body, today;
    if (type === 'Offer letter') {
      const dateText = letterDate ? new Date(letterDate + 'T00:00:00').toLocaleDateString('en-GB',{ day:'numeric', month:'long', year:'numeric' }) : '{{date}}';
      const hrNameText = hrName || '{{hr_name}}';
      body = buildOfferLetterHTML(w, dateText, hrNameText);
      today = dateText;
    } else {
      const result = build(type, w);
      body = result.body;
      today = result.today;
    }
    setOut({ today, body, type });
    setShowDownload(false);
    await capturePdf(body, type);
    setShowDownload(true);
  };

  const downloadPdf = () => {
    if (pdfDocRef.current) {
      pdfDocRef.current.save(`${type.replace(/\s+/g, '_')}.pdf`);
    }
  };

  useEffect(() => {
    if (workers.length && !name) setName(workers[0].name);
  }, [workers, name]);

  useEffect(() => {
    if (showDownload) setShowDownload(false);
  }, [name, type, letterDate, hrName]);

  return (
    <div className="card">
      <div className="card-head"><h3>Generate a letter</h3><span className="sub">auto-fills name &amp; role</span></div>
      <div className="card-pad">
        <div className="form-row">
          <label className="field">Worker
            <Dropdown value={name} onChange={e=>setName(e.target.value)}
              options={workers.map(w => ({value: w.name, label: w.name}))} />
          </label>
          <label className="field">Letter type
            <Dropdown value={type} onChange={e=>setType(e.target.value)} options={TYPES} />
          </label>
          <label className="field">Date
            <input type="date" value={letterDate} onChange={e=>setLetterDate(e.target.value)} style={{padding:'9px 11px',border:'1px solid var(--line)',borderRadius:'var(--radius-sm)',fontSize:14,fontFamily:'inherit',outline:'none',background:'var(--paper)',color:'var(--ink)'}} />
          </label>
          <label className="field">HR name
            <Dropdown value={hrName} onChange={e=>setHrName(e.target.value)} options={[{value:'',label:'Select HR...'}, ...workers.filter(w => (w.dept||w.department||'').toLowerCase().includes('hr') || (w.dept||w.department||'').toLowerCase().includes('admin')).map(w => ({value: w.name, label: w.name}))]} />
          </label>
          <label className="field btn-field"><span>&nbsp;</span>{!showDownload ? <button className="btn btn-primary" onClick={generate}><FileTxt width={16}/> Generate</button> : <button className="btn btn-primary" onClick={downloadPdf}><FileTxt width={16}/> Download PDF</button>}</label>
        </div>

        {out && (
          <div className="letter">
            {out.type === 'Offer letter' ? (
              <div dangerouslySetInnerHTML={{ __html: out.body }} />
            ) : (
              <><div className="lh" style={{ fontSize:18, marginBottom:4 }}>{out.type}</div>
            <div style={{ color:'var(--ink-soft)', fontSize:12, marginBottom:18 }}>{out.today}</div>
            {out.body}</>
            )}

          </div>
        )}
      </div>
      <div ref={pdfRef} style={{
        position:'fixed', left:'-9999px', top:0,
        fontFamily:'Arial, sans-serif', fontSize:14, lineHeight:1.6,
        padding:40, color:'#000', background:'#fff', whiteSpace:'pre-wrap',
        width:'800px', display:'none'
      }} />
    </div>
  );
}
