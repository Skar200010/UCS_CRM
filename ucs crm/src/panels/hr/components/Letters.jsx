import { useState, useEffect, useRef } from 'react';
import { useHR } from '../store';
import { Dropdown } from './ui';
import { FileTxt } from '../icons';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const TYPES = ['Offer letter','Experience letter','Promotion letter','Warning letter','Relieving letter'];

function build(type, w) {
  const today = new Date().toLocaleDateString('en-GB',{ day:'numeric', month:'long', year:'numeric' });
  const r = w.role || w.department || 'Team Member';
  const d = w.dept || w.department || 'General';
  const body = {
    'Offer letter': `Subject: Appointment as ${r}\nDate :-  ${new Date().toLocaleDateString('en-GB',{ day:'numeric', month:'long', year:'numeric' })}.\nDear   ${w.name},\n\nYou are pleased to inform you that you have been selected for the position of ${r} in our organization. You will be on a one-month probation period, during which your performance will be evaluated. Upon satisfactory completion of this period, your appointment as a permanent employee will be confirmed.\n\nDuring your probation, you are required to perform all duties and responsibilities assigned to you by your Team Leader. Your training will consist of two stages. The initial stage will be a basic training period of 3 days starting from the date of joining. The second stage will be 24 days of comprehensive training. Please note that no leave will be permitted during the training.\n\nAdditionally, please be informed that you will not be eligible for any other monetary benefits during this period. If an employee absconds or voluntarily leaves during the training period, they will not be eligible for the training salary.\n\nOffice Timings: All employees are required to maintain office hours from 10:00 a.m. to 7:00 p.m.\n\nOffice Guidelines:\n- Dress Code (Monday to Friday): Formals\n- Dress Code (Saturday): Casuals\n- Personal mobile phones are not permitted during working hours, except during lunch breaks.\n- Kindly sign and return a copy of this appointment letter to confirm your acceptance as a trainee.\n\nCongratulations on your appointment, and welcome to the team..!\n\nYours sincerely,\nHR,\nMS. Jigna Patel.\nULTIMATE FUNDRAYS SOLUTION\nRegd. Address:- 506, Sanjar Enclave, Bhadran Nagar,\nKandivali (West), Mumbai, Maharashtra 400067.`,
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
  const [out, setOut] = useState(null);
  const [showPdfBtn, setShowPdfBtn] = useState(false);
  const pdfRef = useRef(null);

  useEffect(() => { fetchWorkers().then(setWorkers).catch(() => {}); }, []);

  const generatePdf = async (bodyText) => {
    const el = pdfRef.current;
    if (!el) return;
    el.style.display = 'block';
    el.textContent = bodyText;
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
    pdf.save(`${type.replace(/\s+/g, '_')}.pdf`);
  };

  const generate = () => {
    const w = workers.find(x => x.name === name);
    if (!w) return;
    const result = build(type, w);
    setOut({ ...result, type });
    setShowPdfBtn(true);
  };

  const copy = () => out && navigator.clipboard?.writeText(`${out.body}`);

  useEffect(() => {
    if (workers.length && !name) setName(workers[0].name);
  }, [workers, name]);

  return (
    <div className="card">
      <div className="card-head"><h3>Generate a letter</h3><span className="sub">auto-fills name, role &amp; date</span></div>
      <div className="card-pad">
        <div className="form-row">
          <label className="field">Worker
            <Dropdown value={name} onChange={e=>setName(e.target.value)}
              options={workers.map(w => ({value: w.name, label: w.name}))} />
          </label>
          <label className="field">Letter type
            <Dropdown value={type} onChange={e=>setType(e.target.value)} options={TYPES} />
          </label>
          <label className="field btn-field"><span>&nbsp;</span><button className="btn btn-primary" onClick={generate}><FileTxt width={16}/> Generate</button></label>
        </div>

        {out && (
          <div className="letter">
            <div className="lh" style={{ fontSize:18, marginBottom:4 }}>{out.type}</div>
            <div style={{ color:'var(--ink-soft)', fontSize:12, marginBottom:18 }}>{out.today}</div>
            {out.body}
            <div style={{ marginTop:18, display:'flex', gap:8 }}>
              <button className="btn btn-sm" onClick={copy}>Copy text</button>
              {showPdfBtn && (
                <button className="btn btn-sm" onClick={() => generatePdf(out.body)} style={{ background:'#dc2626', color:'#fff', fontWeight:600, border:'1px solid #b91c1c' }}>Generate PDF</button>
              )}
            </div>
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
