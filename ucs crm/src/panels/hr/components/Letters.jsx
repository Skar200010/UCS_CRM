import { useState, useEffect, useRef } from 'react';
import { useHR } from '../store';
import { Dropdown } from './ui';
import { FileTxt, WhatsApp } from '../icons';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { deptLabel } from '../../../lib/labels';

const TYPES = ['Offer letter','Experience letter','Promotion letter','Warning letter','Relieving letter','Joining letter','NOBSD','ODAR','Volunteer Termination Letter'];

const HR_MESSAGES = [
  {
    key: 'm1',
    label: 'Day 1 – Normal Warning',
    heading: 'A. Volunteer Absent Without Prior Information',
    subject: 'Subject: Absence without Prior Information',
    body: 'Dear [Volunteer Name],\n\nYou were absent from work today without informing your Reporting Manager or the HR Department. Kindly share the reason for your absence immediately and confirm your availability to resume work. Timely communication is mandatory as per work policy. Please respond to this message at the earliest.\n\nRegards,\nHR Department'
  },
  {
    key: 'm2',
    label: 'Day 2 – Final Warning',
    subject: 'Subject: Final Warning for Continuous Unauthorized Absence',
    body: 'Dear [Volunteer Name],\n\nThis is your second consecutive day of absence without prior approval or valid communication. Despite our previous communication, we have not received a satisfactory response from your side. You are instructed to report to work immediately or provide a valid explanation along with supporting documents (if applicable) within 24 hours. Failure to do so may lead to disciplinary action, including termination of your work & position.\n\nRegards,\nHR Department'
  },
  {
    key: 'm3',
    label: 'Day 3 – Termination Message',
    subject: 'Subject: Termination Due to Unauthorized Absence',
    body: 'Dear [Volunteer Name],\n\nAs you have remained absent for three consecutive working days without prior approval and have failed to provide a valid explanation despite repeated communications, the management has decided to terminate your work & position with immediate effect. You are requested to complete the exit formalities and return all company property (if any). We wish you the very best for your future.\n\nRegards,\nHR Department'
  },
  {
    key: 'm4',
    label: 'Day 1 – Acknowledgement Message',
    heading: 'B. Volunteer Informed HR Before Taking Leave',
    body: 'Dear [Volunteer Name],\n\nThank you for informing the HR Department regarding your absence. We understand your situation and hope everything is fine. Your leave request has been noted. Please keep us updated regarding your condition and inform us about your expected date of joining. Take care, and we wish you a speedy recovery (if applicable change this line as per the situation).\n\nRegards,\nHR Department'
  },
  {
    key: 'm5',
    label: 'Day 2 – Request for Supporting Documents',
    body: 'Dear [Volunteer Name],\n\nWe hope you are doing well. As your leave has continued, kindly share the relevant supporting document (such as a medical certificate or any emergency proof) and confirm your expected date of rejoining. This will help us process your leave as per policy. Thank you for your cooperation.\n\nRegards,\nHR Department'
  },
  {
    key: 'm6',
    label: 'Day 3 – Follow-up Message',
    body: 'Dear [Volunteer Name],\n\nThis is a reminder regarding your continued absence. Kindly update us on your current situation and confirm your joining date. If you have not yet submitted the required supporting documents, please do so immediately. Failure to respond may result in your leave being treated as unauthorized, and further action may be taken as per policy.\n\nRegards,\nHR Department'
  },
  {
    key: 'm7',
    label: 'Reminder Notice – No Leave Application Form',
    body: 'Dear Volunteer,\n\nYou have remained absent from work without informing the HR Department, and no Leave Application Form has been submitted. This is a violation of the attendance policy. You are instructed to immediately raise a leave request through the mobile app and inform your reporting manager or the HR Department with the reason for your absence. Please treat this as an official message. Repeated unauthorized absence or failure to follow the leave procedure may lead to disciplinary action as per the organization\'s HR policy.\n\nHR Department'
  }
];

const NGO_CONFIG = {
  BSCT: { name: 'BEING SEVAK CHARITABLE TRUST', logo: '/logo/beingsevak-logo.png', alt: 'Being Sevak Charitable Trust', footer: 'Being Sevak Charitable Trust', address: '506, Sanjar Enclave, Bhadran Nagar, Kandivali (West), Mumbai, Maharashtra 400067.' },
  AFLF: { name: 'ASHRAY FOR LIFE FOUNDATION', logo: '/logo/aflf-logo.png', alt: 'Ashray for Life Foundation', footer: 'Ashray for Life Foundation', address: 'Unit - 218, 2nd Floor, Auris Galleria, S.V Road, Andheri (West), Mumbai 400058.', logoSize: 140 },
  MANN: { name: 'MANN CARE FOUNDATION', logo: '/logo/mann-logo.png', alt: 'Mann Care Foundation', footer: 'Mann Care Foundation', address: '1708 ONE WORLD, SV ROAD NEAR NL HIGH SCHOOL MALAD WEST MUMBAI 400064.', logoSize: 140 },
  UCS: { name: 'ULTIMATE CONSULTANCY SERVICES', displayName: 'Ultimate Consultancy Services', logo: '/logo/ucs-logo.png', alt: 'Ultimate Consultancy Services', footer: 'Ultimate Consultancy Services', address: 'Sanjar Enclave, Office no 506, S.V Road, Kandivali West, Mumbai - 400067' },
};

function getNgo(key) { return NGO_CONFIG[key] || NGO_CONFIG.BSCT; }

const LETTERHEAD_IMG = {
  BSCT: '/Letter Head BSCT (1).png',
  AFLF: '/Letter Head AFLF.png',
  MANN: '/Letter Head MANN.png',
};

const LETTERHEAD_BODY = {
  BSCT: { top: 13, bottom: 9, left: 5.5, right: 5.5 },
  AFLF: { top: 17, bottom: 8, left: 6, right: 6 },
  MANN: { top: 12, bottom: 5, left: 6, right: 6 },
};

function buildLetterheadLayout(ngoKey, innerHtml) {
  const img = LETTERHEAD_IMG[ngoKey];
  const b = LETTERHEAD_BODY[ngoKey];
  return `<div style="width:900px;height:1273px;margin:0 auto;position:relative;overflow:hidden;background:#fff;box-sizing:border-box;print-color-adjust:exact;-webkit-print-color-adjust:exact">
<img src="${img}" alt="" style="position:absolute;top:0;left:0;width:900px;height:1273px;display:block;z-index:0" />
<div style="position:absolute;top:${b.top}%;bottom:${b.bottom}%;left:${b.left}%;right:${b.right}%;box-sizing:border-box;overflow:hidden;z-index:1;font-family:'Times New Roman',Times,serif;color:#111">${innerHtml}</div>
</div>`;
}

const HAS_LH = (k) => k === 'BSCT' || k === 'AFLF' || k === 'MANN';

function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function titleCase(s) { return String(s ?? '').replace(/\b\w/g, c => c.toUpperCase()); }

function buildJoiningLetterHTML(w, dateText, hrNameText, subjectText, ngoKey) {
  const ngo = getNgo(ngoKey);
  const r = deptLabel(w.role || w.department) || 'Team Member';
  const d = deptLabel(w.dept || w.department) || 'General';
  const ucs = ngoKey === 'UCS';
  const company = ngo.displayName || ngo.name;
  const subj = ucs ? 'Joining Letter' : (subjectText || `Joining as ${r}`);
  const bodyHtml = ucs ? `
<p style="margin:0 0 6px 0">We are pleased to inform you that <strong>${company}</strong>, on behalf of (BSCT), has selected you to join the organization as a <strong>Volunteer</strong> to support the Trust's various organizational and social activities.</p>
<p style="margin:0 0 6px 0">You will initially be associated with <strong>Being Sevak Charitable Trust</strong> for a one-month volunteer training and orientation period, during which your participation, conduct, learning, and overall performance will be observed and evaluated. Upon satisfactory completion of this period, your volunteer engagement may be continued based on the requirements of the Trust and mutual understanding.</p>
<p style="margin:0 0 6px 0">During your training and volunteer engagement, you will be required to perform the duties and responsibilities assigned to you by your Team Leaders/Supervisors and follow the guidelines, policies, procedures, and values of Being Sevak Charitable Trust.</p>` : `
<p style="margin:0 0 6px 0">We are delighted to welcome you to <strong>${ngo.name}</strong>. This letter confirms your joining as a <strong>${r}</strong> in the <strong>${d}</strong> department.</p>
<p style="margin:0 0 6px 0">Your date of joining is <strong>${dateText}</strong>. You will be on a probation period of <strong>one (1) month</strong> from the date of joining, during which your performance will be closely monitored and evaluated.</p>
<p style="margin:0 0 6px 0">During your probation, you are required to perform all duties and responsibilities assigned to you by your Team Leader or Reporting Manager. Your training will consist of two stages: an initial basic training period of <strong>3 (three) days</strong> from the date of joining, followed by a comprehensive training period of <strong>24 (twenty-four) days</strong>. Please note that <strong>no leave will be permitted</strong> during the training period.</p>
<p style="margin:0 0 6px 0"><u><strong>Office Timings:</strong></u> All volunteers are required to maintain office hours from <strong>10:00 a.m. to 7:00 p.m.</strong>, Monday through Saturday.</p>
<p style="margin:0 0 6px 0"><u><strong>Office Guidelines:</strong></u></p>
<ul style="margin:0 0 6px 0;padding-left:22px">
<li style="margin-bottom:4px">Dress Code (Monday to Friday): Formals</li>
<li style="margin-bottom:4px">Dress Code (Saturday): Casuals</li>
<li style="margin-bottom:4px">Personal mobile phones are not permitted during working hours, except during lunch breaks.</li>
</ul>
<p style="margin:0 0 6px 0">All volunteers are expected to adhere to the highest standards of professionalism, integrity, and confidentiality. Any breach of the company's code of conduct or confidentiality policies may result in disciplinary action, including termination of employment.</p>
<p style="margin:0 0 6px 0">Please note that during the probation period, you will not be eligible for any other monetary benefits beyond the stipulated stipend. If a volunteer absconds or voluntarily leaves during the training period, they will not be eligible for any training salary or compensation.</p>
<p style="margin:0 0 6px 0">We look forward to a long and mutually rewarding association with you. Welcome aboard!</p>`;
  const signatureHtml = ucs
    ? `<p style="margin:0 0 2px 0">Regards,</p><p style="margin:0 0 2px 0">Yours sincerely,</p><p style="margin:10px 0 0 0"><strong>HR,</strong><br />${hrNameText}<br /><strong>${company}</strong></p>`
    : `<p style="margin:0 0 2px 0">Yours sincerely,</p><p style="margin:10px 0 0 0"><strong>HR,</strong><br />${hrNameText}<br /><strong>${ngo.name}</strong></p>`;
  const centerTitle = `${ucs ? subj : `Subject: ${subj}`}`;
  if (HAS_LH(ngoKey)) {
    const inner = `<div style="padding:10px 0 24px;text-align:justify">
<div style="text-align:center;font-size:16px;font-weight:700;color:#082F5A;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px 0">${centerTitle}</div>
<div style="margin:0 0 6px 0"><strong>Date:</strong> ${dateText}</div>
<div style="margin-bottom:6px"><strong>Dear ${titleCase(w.name)},</strong></div>
${bodyHtml}
<div style="margin-top:14px">${signatureHtml}</div>
</div>`;
    return buildLetterheadLayout(ngoKey, inner);
  }
  return `<div style="max-width:800px;margin:0 auto;font-family:'Times New Roman',Times,serif;font-size:12px;line-height:1.25;color:#000;background:#fff;padding:25px 35px">
<div style="display:flex;align-items:center;margin-bottom:4px">
<img src="${ngo.logo}" alt="${ngo.alt}" style="width:${ngo.logoSize || 100}px;height:auto;margin-right:14px" />
<div style="flex:1;text-align:center"><div style="font-size:18px;font-weight:700;color:#082F5A;letter-spacing:2px;line-height:1.1">${ngo.name}</div></div>
</div>
<svg width="100%" height="20" viewBox="0 0 700 20" preserveAspectRatio="none" style="display:block"><path d="M0,10 Q175,20 350,10 Q525,0 700,10 L700,20 L0,20 Z" fill="#0B73C4" /></svg>
<div style="height:2px;background:#F58220;margin-bottom:12px"></div>
<div style="text-align:center;font-size:14px;font-weight:700;color:#082F5A;margin:0 0 8px 0;text-transform:uppercase">${centerTitle}</div>
<table style="width:100%;border-collapse:collapse"><tr><td style="padding:0 0 6px 0;font-size:12px"><strong>Date:</strong> ${dateText}</td></tr></table>
<div style="margin-bottom:6px"><strong>Dear ${titleCase(w.name)},</strong></div>
<div style="text-align:justify">
${bodyHtml}
</div>
<div style="margin-top:12px">${signatureHtml}</div>
<div style="margin-top:14px;padding-top:4px"><svg width="100%" height="14" viewBox="0 0 700 14" preserveAspectRatio="none" style="display:block;margin-bottom:3px"><path d="M0,7 Q175,0 350,7 Q525,14 700,7 L700,14 L0,14 Z" fill="#0B73C4" /></svg><div style="height:2px;background:#F58220;margin-bottom:6px"></div><div style="text-align:center;font-size:12px;color:#6b7280">    <strong>Regd. Address:</strong> ${ngo.address}</div></div>
</div>`;
}

function buildBSCTLetterhead(innerHtml) {
  return buildLetterheadLayout('BSCT', innerHtml);
}

function buildAFLFLetterhead(innerHtml) {
  return buildLetterheadLayout('AFLF', innerHtml);
}

function buildMANNLetterhead(innerHtml) {
  return buildLetterheadLayout('MANN', innerHtml);
}

function buildNoBSDDeclarationHTML(w, dateText, hrNameText, subjectText, ngoKey) {
  const ngo = getNgo(ngoKey);
  const r = deptLabel(w.role || w.department) || 'Team Member';
  const subj = subjectText || 'NO OBJECTION & BASIC SALARY DECLARATION';
  const subjDiv = (mTop) => `<div style="text-align:center;font-size:18px;font-weight:700;color:#134987;text-transform:uppercase;letter-spacing:0.5px;margin:${mTop} 0 6px">Subject:- ${subj}</div>`;
  const body = `<div style="padding:10px 0 24px;line-height:1.7;text-align:justify">
<table style="width:100%;border-collapse:collapse"><tr><td style="padding:0 0 8px 0"><strong>Date:</strong> ${dateText}</td></tr></table>
<p style="margin:0 0 10px 0">I, <strong>Mr./Ms. ${w.name}</strong>, residing at ____________________, have voluntarily joined <strong>${ngo.name}</strong> (Trust/Organization) as a Volunteer. I hereby declare and confirm the following:</p>
<ol style="margin:0 0 10px 0;padding-left:26px;text-align:left">
<li style="margin-bottom:8px">I understand that my performance, discipline, attendance, behaviour, and compliance with the organization's policies will be reviewed regularly by the Management.</li>
<li style="margin-bottom:8px">I understand and agree that if my performance is found to be unsatisfactory, my attendance is irregular, I fail to achieve assigned responsibilities, or I violate the organization's rules and policies, the Management shall have the sole discretion to revise my remuneration.</li>
<li style="margin-bottom:8px">In such circumstances, I have no objection if the organization limits my monthly payment to <strong>₹6,000 (Rupees Six Thousand Only)</strong> as Volunteer Expenses/Honorarium, until further review by the Management.</li>
<li style="margin-bottom:8px">I clearly understand that the payment of ₹6,000 is towards volunteer expenses/honorarium and shall not be considered as a guaranteed salary or permanent entitlement.</li>
<li style="margin-bottom:8px">I accept that the Management's decision regarding my remuneration, based on my performance and conduct, shall be final and binding.</li>
<li style="margin-bottom:8px">I confirm that I am signing this declaration voluntarily, without any pressure, coercion, or undue influence, after fully understanding its contents.</li>
</ol>
<p style="margin:0 0 10px 0">I have read, understood, and accepted all the above terms and conditions.</p>
<div style="margin:22px 0;height:1px;background:#d1d5db"></div>
<table style="width:100%;border-collapse:collapse">
<tr><td style="padding:4px 0"><strong>Volunteer Name:</strong> ${w.name}</td><td style="padding:4px 0"><strong>Designation:</strong> ${r}</td></tr>
<tr><td style="padding:4px 0"><strong>Signature of Volunteer:</strong> _______________________</td><td style="padding:4px 0"><strong>Date:</strong> ____ / ____ / _____</td></tr>
</table>
<div style="margin:20px 0 0 0;border:1px solid #134987;border-radius:6px;padding:14px 18px">
<div style="font-weight:700;color:#134987;text-transform:uppercase;margin-bottom:8px">HR Verification</div>
<div><strong>HR Name:</strong> ${hrNameText}</div>
<div style="margin-top:6px"><strong>Signature:</strong> ______________ &nbsp;&nbsp; <strong>Date:</strong> __ / __ / __</div>
</div>
<div style="margin:16px 0 0 0;border:1px solid #134987;border-radius:6px;padding:14px 18px">
<div style="font-weight:700;color:#134987;text-transform:uppercase;margin-bottom:8px">Management Approval</div>
<div><strong>Authorized Signatory:</strong> _____________</div>
</div>
</div>`;
  if (ngoKey === 'BSCT') {
    return buildBSCTLetterhead(subjDiv('0') + body);
  }
  if (ngoKey === 'AFLF') {
    return buildAFLFLetterhead(subjDiv('0') + body);
  }
  if (ngoKey === 'MANN') {
    return buildMANNLetterhead(subjDiv('0') + body);
  }
  return `<div style="width:900px;min-height:1273px;margin:0 auto;background:#fff;font-family:'Times New Roman',Times,serif;font-size:16px;color:#111;position:relative;overflow:hidden;display:flex;flex-direction:column;box-sizing:border-box;print-color-adjust:exact;-webkit-print-color-adjust:exact">
<div style="width:794px;margin:0 auto;box-sizing:border-box;flex:1;padding:24px 44px 0;position:relative;z-index:1">
${subjDiv('20')}
${body}
</div>
</div>`;
}

function buildODARDocumentHTML(w, dateText, hrNameText, subjectText, ngoKey, docRows = []) {
  const rows = docRows && docRows.length ? docRows : [{sr:1,doc:'',original:false,returned:false,remarks:''},{sr:2,doc:'',original:false,returned:false,remarks:''},{sr:3,doc:'',original:false,returned:false,remarks:''}];
  const rowsHtml = rows.map(r => `
<tr>
<td style="border:1px solid #999;padding:10px 8px;text-align:center">${esc(r.sr)}</td>
<td style="border:1px solid #999;padding:10px 8px">${esc(r.doc)}</td>
<td style="border:1px solid #999;padding:10px 8px;text-align:center">${r.original ? '✓' : ''}</td>
<td style="border:1px solid #999;padding:10px 8px;text-align:center">${r.returned ? '✓' : ''}</td>
<td style="border:1px solid #999;padding:10px 8px">${esc(r.remarks)}</td>
</tr>`).join('');
  const ngo = getNgo(ngoKey);
  const r = deptLabel(w.role || w.department) || 'Team Member';
  const d = deptLabel(w.dept || w.department) || 'General';
  const jd = w.date_of_joining || w.created_at || '';
  const joiningDate = jd ? new Date(jd + (jd.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-GB',{ day:'numeric', month:'long', year:'numeric' }) : '______________';
  const subj = subjectText || 'ORIGINAL DOCUMENTS ACKNOWLEDGEMENT RECORD';
  const subjDiv = (mTop) => `<div style="text-align:center;font-size:18px;font-weight:700;color:#134987;text-transform:uppercase;letter-spacing:0.5px;margin:${mTop} 0 6px">Subject:- ${subj}</div>`;
  const body = `<div style="padding:10px 0 24px;line-height:1.65;text-align:justify">
<table style="width:100%;border-collapse:collapse;margin-bottom:10px">
<tr><td style="padding:4px 0"><strong>Organization Name:</strong> ${ngo.name}</td></tr>
<tr><td style="padding:4px 0"><strong>Date of Submission:</strong> ${dateText}</td></tr>
</table>
<div style="font-weight:700;color:#134987;margin:14px 0 6px 0">Volunteer Details</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:10px">
<tr><td style="padding:4px 0;width:50%"><strong>Volunteer Name:</strong> ${w.name}</td><td style="padding:4px 0"><strong>Department:</strong> ${d}</td></tr>
<tr><td style="padding:4px 0"><strong>Designation:</strong> ${r}</td><td style="padding:4px 0"><strong>Date of Joining:</strong> ${joiningDate}</td></tr>
</table>
<div style="font-weight:700;color:#134987;margin:14px 0 6px 0">Original Documents Submitted</div>
<table style="width:100%;border-collapse:collapse">
<tr style="background:#134987;color:#fff">
<th style="border:1px solid #134987;color:#fff;padding:7px 6px;text-align:left;width:8%">Sr. No.</th>
<th style="border:1px solid #134987;color:#fff;padding:7px 6px;text-align:left;width:32%">Document Name</th>
<th style="border:1px solid #134987;color:#fff;padding:7px 6px;text-align:center;width:18%">Original Submitted (✓)</th>
<th style="border:1px solid #134987;color:#fff;padding:7px 6px;text-align:center;width:18%">Returned (✓)</th>
<th style="border:1px solid #134987;color:#fff;padding:7px 6px;text-align:left;width:24%">Remarks</th>
</tr>
${rowsHtml}
</table>
<div style="margin:14px 0 0 0;text-align:justify">
<p style="margin:0 0 8px 0"><strong>Volunteer Declaration:</strong> I, <strong>${w.name}</strong>, acknowledge that I have voluntarily submitted the above-mentioned original document(s) to <strong>${ngo.name}</strong> (Organization Name) for verification and employment purposes. I understand that these documents will be kept securely by the organization only for verification or administrative purposes and will be returned to me as per the organization's policy or upon separation from the organization, subject to clearance of all dues and formalities. I confirm that the details mentioned above are correct.</p>
</div>
<table style="width:100%;border-collapse:collapse;margin-top:8px">
<tr><td style="padding:4px 0"><strong>Volunteer Signature:</strong> _______________________</td></tr>
</table>
<div style="margin:18px 0 0 0;border:1px solid #134987;border-radius:6px;padding:14px 18px">
<div style="font-weight:700;color:#134987;text-transform:uppercase;margin-bottom:8px">HR Acknowledgement</div>
<div><strong>Received By (HR):</strong> ${hrNameText}</div>
<div style="margin-top:6px"><strong>Signature:</strong> __________________ &nbsp;&nbsp; <strong>Date:</strong> ____ / ____ / ____</div>
</div>
<div style="margin:14px 0 0 0;border:1px solid #134987;border-radius:6px;padding:14px 18px">
<div style="font-weight:700;color:#134987;text-transform:uppercase;margin-bottom:8px">Document Return Acknowledgement <span style="font-weight:400;text-transform:none">(To be filled at the time of return)</span></div>
<div>I confirm that I have received all my original documents listed above in good condition.</div>
<div style="margin-top:6px"><strong>Volunteer Signature:</strong> ________________ &nbsp;&nbsp; <strong>Date:</strong> _____ / _____ / ______</div>
<div style="margin-top:6px"><strong>Returned By (HR):</strong> ___________________ &nbsp;&nbsp; <strong>HR Signature:</strong> ____________________</div>
</div>
</div>`;
  if (ngoKey === 'BSCT') {
    return buildBSCTLetterhead(subjDiv('0') + body);
  }
  if (ngoKey === 'AFLF') {
    return buildAFLFLetterhead(subjDiv('0') + body);
  }
  if (ngoKey === 'MANN') {
    return buildMANNLetterhead(subjDiv('0') + body);
  }
  return `<div style="width:900px;min-height:1273px;margin:0 auto;background:#fff;font-family:'Times New Roman',Times,serif;font-size:15.5px;color:#111;position:relative;overflow:hidden;display:flex;flex-direction:column;box-sizing:border-box;print-color-adjust:exact;-webkit-print-color-adjust:exact">
<div style="width:794px;margin:0 auto;box-sizing:border-box;flex:1;padding:24px 44px 0;position:relative;z-index:1">
${subjDiv('20')}
${body}
</div>
</div>`;
}

function LetterheadPreview({ ngoKey, children }) {
  const img = LETTERHEAD_IMG[ngoKey];
  const b = LETTERHEAD_BODY[ngoKey];
  return (
    <div style={{ width: 900, height: 1273, margin: '0 auto', position: 'relative', overflow: 'hidden', background: '#fff', boxSizing: 'border-box', fontFamily: "'Times New Roman', Times, serif", color: '#111', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
      <img src={img} alt="" style={{ position: 'absolute', top: 0, left: 0, width: 900, height: 1273, display: 'block', zIndex: 0 }} />
      <div style={{ position: 'absolute', top: `${b.top}%`, bottom: `${b.bottom}%`, left: `${b.left}%`, right: `${b.right}%`, boxSizing: 'border-box', overflow: 'hidden', zIndex: 1 }}>{children}</div>
    </div>
  );
}

function MANNLetterheadPreview({ children }) {
  return <LetterheadPreview ngoKey="MANN">{children}</LetterheadPreview>;
}

function AFLFLetterheadPreview({ children }) {
  return <LetterheadPreview ngoKey="AFLF">{children}</LetterheadPreview>;
}

function BSCTLetterheadPreview({ children }) {
  return <LetterheadPreview ngoKey="BSCT">{children}</LetterheadPreview>;
}

function ODARDocumentPreview({ w, dateText, hrNameText, subject, ngoKey, docRows, editing, onToggleEdit, onDocRowChange, onAddDocRow, onRemoveDocRow }) {
  const ngo = getNgo(ngoKey);
  const r = deptLabel(w.role || w.department) || 'Team Member';
  const d = deptLabel(w.dept || w.department) || 'General';
  const jd = w.date_of_joining || w.created_at || '';
  const joiningDate = jd ? new Date(jd + (jd.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-GB',{ day:'numeric', month:'long', year:'numeric' }) : '______________';
  const subj = subject || 'ORIGINAL DOCUMENTS ACKNOWLEDGEMENT RECORD';
  const inputStyle = { width: '100%', boxSizing: 'border-box', border: '1px solid #999', padding: '6px 8px', fontSize: 12, fontFamily: 'inherit', background: '#fff' };
  const th = { border: '1px solid #134987', color: '#fff', padding: '7px 6px', textAlign: 'center' };
  const thL = { ...th, textAlign: 'left' };
  const td = { border: '1px solid #999', padding: editing ? '5px 8px' : '10px 8px', textAlign: 'center' };
  const tdL = { ...td, textAlign: 'left' };
  const isBSCT = ngoKey === 'BSCT';
  const isAFLF = ngoKey === 'AFLF';
  const isMANN = ngoKey === 'MANN';
  const subjMargin = (isBSCT || isAFLF || isMANN) ? '0 0 6px' : '20px 0 6px';
  const bodyWrap = (
      <>
      <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 700, color: '#134987', textTransform: 'uppercase', letterSpacing: 0.5, margin: subjMargin }}>Subject:- {subj}</div>
      <div style={{ padding: '10px 0 24px', textAlign: 'justify' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <tbody>
          <tr><td style={{ padding: '4px 0' }}><strong>Organization Name:</strong> {ngo.name}</td></tr>
          <tr><td style={{ padding: '4px 0' }}><strong>Date of Submission:</strong> {dateText}</td></tr>
        </tbody>
      </table>
      <div style={{ fontWeight: 700, color: '#134987', margin: '14px 0 6px 0' }}>Volunteer Details</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <tbody>
          <tr><td style={{ padding: '4px 0', width: '50%' }}><strong>Volunteer Name:</strong> {w.name}</td><td style={{ padding: '4px 0' }}><strong>Department:</strong> {d}</td></tr>
          <tr><td style={{ padding: '4px 0' }}><strong>Designation:</strong> {r}</td><td style={{ padding: '4px 0' }}><strong>Date of Joining:</strong> {joiningDate}</td></tr>
        </tbody>
      </table>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontWeight: 700, color: '#134987', margin: '14px 0 6px 0' }}>
        <span>Original Documents Submitted</span>
        <button type="button" onClick={onToggleEdit} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid #134987', background: '#fff', color: '#134987', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{editing ? 'Done' : 'Edit'}</button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#134987', color: '#fff' }}>
            <th style={{ ...thL, width: '8%' }}>Sr. No.</th>
            <th style={{ ...thL, width: '32%' }}>Document Name</th>
            <th style={{ ...th, width: '18%' }}>Original Submitted (✓)</th>
            <th style={{ ...th, width: '18%' }}>Returned (✓)</th>
            <th style={{ ...thL, width: '24%' }}>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {docRows.map((row, i) => (
            <tr key={i}>
              <td style={td}>
                {editing
                  ? <input type="number" value={row.sr} onChange={e => onDocRowChange(i, { sr: e.target.value })} style={{ ...inputStyle, width: 56, textAlign: 'center' }} />
                  : row.sr}
              </td>
              <td style={tdL}>
                {editing
                  ? <input type="text" value={row.doc} placeholder="Document name" onChange={e => onDocRowChange(i, { doc: e.target.value })} style={inputStyle} />
                  : (row.doc || '')}
              </td>
              <td style={td}>
                {editing
                  ? <input type="checkbox" checked={row.original} onChange={e => onDocRowChange(i, { original: e.target.checked })} style={{ cursor: 'pointer', width: 16, height: 16 }} />
                  : (row.original ? '✓' : '')}
              </td>
              <td style={td}>
                {editing
                  ? <input type="checkbox" checked={row.returned} onChange={e => onDocRowChange(i, { returned: e.target.checked })} style={{ cursor: 'pointer', width: 16, height: 16 }} />
                  : (row.returned ? '✓' : '')}
              </td>
              <td style={tdL}>
                {editing
                  ? <input type="text" value={row.remarks} placeholder="Remarks" onChange={e => onDocRowChange(i, { remarks: e.target.value })} style={inputStyle} />
                  : (row.remarks || '')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && (
        <div style={{ margin: '8px 0', display: 'flex', gap: 8 }}>
          <button type="button" onClick={onAddDocRow} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #999', background: '#fff', color: '#134987', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add row</button>
          {docRows.length > 1 && (
            <button type="button" onClick={() => onRemoveDocRow(docRows.length - 1)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #999', background: '#fff', color: '#b91c1c', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>− Remove last row</button>
          )}
        </div>
      )}
      <div style={{ margin: '14px 0 0 0', textAlign: 'justify' }}>
        <p style={{ margin: '0 0 8px 0' }}><strong>Volunteer Declaration:</strong> I, <strong>{w.name}</strong>, acknowledge that I have voluntarily submitted the above-mentioned original document(s) to <strong>{ngo.name}</strong> (Organization Name) for verification and employment purposes. I understand that these documents will be kept securely by the organization only for verification or administrative purposes and will be returned to me as per the organization's policy or upon separation from the organization, subject to clearance of all dues and formalities. I confirm that the details mentioned above are correct.</p>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
        <tbody>
          <tr><td style={{ padding: '4px 0' }}><strong>Volunteer Signature:</strong> _______________________</td></tr>
        </tbody>
      </table>
      <div style={{ margin: '18px 0 0 0', border: '1px solid #134987', borderRadius: 6, padding: '14px 18px' }}>
        <div style={{ fontWeight: 700, color: '#134987', textTransform: 'uppercase', marginBottom: 8 }}>HR Acknowledgement</div>
        <div><strong>Received By (HR):</strong> {hrNameText}</div>
        <div style={{ marginTop: 6 }}><strong>Signature:</strong> __________________ &nbsp;&nbsp; <strong>Date:</strong> ____ / ____ / ____</div>
      </div>
      <div style={{ margin: '14px 0 0 0', border: '1px solid #134987', borderRadius: 6, padding: '14px 18px' }}>
        <div style={{ fontWeight: 700, color: '#134987', textTransform: 'uppercase', marginBottom: 8 }}>Document Return Acknowledgement <span style={{ fontWeight: 400, textTransform: 'none' }}>(To be filled at the time of return)</span></div>
        <div>I confirm that I have received all my original documents listed above in good condition.</div>
        <div style={{ marginTop: 6 }}><strong>Volunteer Signature:</strong> ________________ &nbsp;&nbsp; <strong>Date:</strong> _____ / _____ / ______</div>
        <div style={{ marginTop: 6 }}><strong>Returned By (HR):</strong> ___________________ &nbsp;&nbsp; <strong>HR Signature:</strong> ____________________</div>
      </div>
      </div>
  </>);
  if (isBSCT) {
    return <BSCTLetterheadPreview>{bodyWrap}</BSCTLetterheadPreview>;
  }
  if (isAFLF) {
    return <AFLFLetterheadPreview>{bodyWrap}</AFLFLetterheadPreview>;
  }
  if (isMANN) {
    return <MANNLetterheadPreview>{bodyWrap}</MANNLetterheadPreview>;
  }
  return (
    <div style={{ width: 900, minHeight: 1273, margin: '0 auto', fontFamily: "'Times New Roman', Times, serif", fontSize: 15.5, lineHeight: 1.65, color: '#111', background: '#fff', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
      <div style={{ width: 794, margin: '0 auto', boxSizing: 'border-box', flex: 1, padding: '24px 44px 0', position: 'relative', zIndex: 1 }}>
        {bodyWrap}
      </div>
    </div>
  );
}

function buildExperienceLetterHTML(w, joiningDate, lastWorkingDate, hrNameText, subjectText, designation, ngoKey) {
  const ngo = getNgo(ngoKey);
  const r = designation || 'Team Member';
  if (HAS_LH(ngoKey)) {
    const inner = `<div style="padding:10px 0 24px;text-align:justify">
<div style="text-align:center;font-size:16px;font-weight:700;color:#082F5A;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px 0">EXPERIENCE LETTER</div>
<div style="margin-bottom:6px"><strong>TO WHOM IT MAY CONCERN</strong></div>
<p style="margin:0 0 6px 0">This is to certify that <strong>${w.name}</strong> was employed with <strong>${ngo.name}</strong> from <strong>${joiningDate}</strong> to <strong>${lastWorkingDate}</strong> as a <strong>${r}</strong>.</p>
<p style="margin:0 0 6px 0">During the tenure with our organization, they performed the assigned responsibilities with dedication and professionalism. The role involved managing day-to-day tasks, coordinating with clients and team members, preparing necessary documentation, and supporting organizational operations related to the assigned position. They consistently demonstrated sincerity, a positive attitude, and a commitment to delivering quality work.</p>
<p style="margin:0 0 6px 0">Throughout the period of employment, they maintained good professional conduct, worked effectively as a team member, and carried out the assigned responsibilities to our satisfaction.</p>
<p style="margin:0 0 6px 0">We appreciate the contributions made to ${ngo.name} and thank them for their services. We wish them every success in their future professional endeavors.</p>
<p style="margin:0 0 6px 0">Should you require any further information, please feel free to contact us.</p>
<div style="margin-top:12px"><p style="margin:0 0 2px 0">Yours sincerely,</p><p style="margin:10px 0 0 0"><strong>Authorized Signatory</strong><br />Contact No.: +91 8879035035<br />Email: being.sevak@gmail.com</p><p style="margin:8px 0 0 0"><strong>Company Seal &amp; Signature</strong><br /><strong>${ngo.name}</strong></p></div>
</div>`;
    return buildLetterheadLayout(ngoKey, inner);
  }
  return `<div style="max-width:800px;margin:0 auto;font-family:'Times New Roman',Times,serif;font-size:12px;line-height:1.25;color:#000;background:#fff;padding:25px 35px">
<div style="display:flex;align-items:center;margin-bottom:4px">
<img src="${ngo.logo}" alt="${ngo.alt}" style="width:${ngo.logoSize || 100}px;height:auto;margin-right:14px" />
<div style="flex:1;text-align:center"><div style="font-size:18px;font-weight:700;color:#082F5A;letter-spacing:2px;line-height:1.1">${ngo.name}</div></div>
</div>
<div style="height:2px;background:#0B73C4;margin-bottom:12px"></div>
<div style="text-align:center;font-size:14px;font-weight:700;color:#082F5A;margin:0 0 8px 0;text-transform:uppercase">EXPERIENCE LETTER</div>
<div style="margin-bottom:6px"><strong>TO WHOM IT MAY CONCERN</strong></div>
<div style="text-align:justify">
<p style="margin:0 0 6px 0">This is to certify that <strong>${w.name}</strong> was employed with <strong>${ngo.name}</strong> from <strong>${joiningDate}</strong> to <strong>${lastWorkingDate}</strong> as a <strong>${r}</strong>.</p>
<p style="margin:0 0 6px 0">During the tenure with our organization, they performed the assigned responsibilities with dedication and professionalism. The role involved managing day-to-day tasks, coordinating with clients and team members, preparing necessary documentation, and supporting organizational operations related to the assigned position. They consistently demonstrated sincerity, a positive attitude, and a commitment to delivering quality work.</p>
<p style="margin:0 0 6px 0">Throughout the period of employment, they maintained good professional conduct, worked effectively as a team member, and carried out the assigned responsibilities to our satisfaction.</p>
<p style="margin:0 0 6px 0">We appreciate the contributions made to ${ngo.name} and thank them for their services. We wish them every success in their future professional endeavors.</p>
<p style="margin:0 0 6px 0">Should you require any further information, please feel free to contact us.</p>
</div>
<div style="margin-top:12px"><p style="margin:0 0 2px 0">Yours sincerely,</p><p style="margin:10px 0 0 0"><strong>Authorized Signatory</strong><br />Contact No.: +91 8879035035<br />Email: being.sevak@gmail.com</p><p style="margin:8px 0 0 0"><strong>Company Seal &amp; Signature</strong><br /><strong>${ngo.name}</strong></p></div>
<div style="margin-top:14px;padding-top:4px"><div style="height:2px;background:#0B73C4;margin-bottom:6px"></div><div style="text-align:center;font-size:12px;color:#6b7280">    <strong>Regd. Address:</strong> ${ngo.address}</div></div>
</div>`;
}

function buildWarningLetterHTML(w, dateText, joiningDate, subjectText, ngoKey) {
  const ngo = getNgo(ngoKey);
  const r = deptLabel(w.role || w.department) || 'Team Member';
  const body = `<strong>TO WHOM IT MAY CONCERN</strong>\n\nThis is to inform <strong>${w.name}</strong>, serving with <strong>${ngo.name}</strong> as a <strong>${subjectText || r}</strong> since <strong>${joiningDate}</strong>, regarding the following matter.\n\nIt has come to the notice of the management that on <strong>[date of incident]</strong>, the following conduct/issue was observed:\n\nThis is a violation of the standards of conduct expected from a Sevak of this organization, specifically with regard to <strong>[nature of violation — e.g., attendance, discipline, work conduct]</strong>. Despite prior guidance/counseling on this matter, the concerned conduct has continued, which is a matter of serious concern to the organization.\n\nThey are hereby cautioned to refrain from such conduct going forward.\n\nThis letter should be treated as a formal warning. Any recurrence of similar conduct, or failure to improve within <strong>[timeframe]</strong>, may result in further action, including but not limited to suspension or removal from the Sevak role.\n\nThe organization values the association and hopes this warning will be taken in the right spirit, with a renewed commitment to sincerity and discipline going forward.`;
  if (HAS_LH(ngoKey)) {
    const inner = `<div style="padding:10px 0 24px;text-align:justify">
<div style="text-align:center;font-size:16px;font-weight:700;color:#082F5A;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px 0">WARNING LETTER</div>
<div style="text-align:justify;white-space:pre-wrap">${body.replace(/\n/g, '<br />')}</div>
<div style="margin-top:12px"><p style="margin:0 0 2px 0">Yours sincerely,</p><p style="margin:10px 0 0 0"><strong>Authorized Signatory</strong><br />Contact No.: +91 8879035035<br />Email: being.sevak@gmail.com</p><p style="margin:8px 0 0 0"><strong>Company Seal &amp; Signature</strong><br />${ngo.name}</p></div>
</div>`;
    return buildLetterheadLayout(ngoKey, inner);
  }
  return `<div style="max-width:800px;margin:0 auto;font-family:'Times New Roman',Times,serif;font-size:12px;line-height:1.25;color:#000;background:#fff;padding:25px 35px">
<div style="display:flex;align-items:center;margin-bottom:4px">
<img src="${ngo.logo}" alt="${ngo.alt}" style="width:${ngo.logoSize || 100}px;height:auto;margin-right:14px" />
<div style="flex:1;text-align:center"><div style="font-size:18px;font-weight:700;color:#082F5A;letter-spacing:2px;line-height:1.1">${ngo.name}</div></div>
</div>
<div style="height:2px;background:#0B73C4;margin-bottom:12px"></div>
<div style="text-align:center;font-size:14px;font-weight:700;color:#082F5A;margin:0 0 8px 0;text-transform:uppercase">WARNING LETTER</div>
<div style="text-align:justify;white-space:pre-wrap">${body.replace(/\n/g, '<br />')}</div>
<div style="margin-top:12px"><p style="margin:0 0 2px 0">Yours sincerely,</p><p style="margin:10px 0 0 0"><strong>Authorized Signatory</strong><br />Contact No.: +91 8879035035<br />Email: being.sevak@gmail.com</p><p style="margin:8px 0 0 0"><strong>Company Seal &amp; Signature</strong><br />${ngo.name}</p></div>
<div style="margin-top:14px;padding-top:4px"><div style="height:2px;background:#0B73C4;margin-bottom:6px"></div><div style="text-align:center;font-size:12px;color:#6b7280">    <strong>Regd. Address:</strong> ${ngo.address}</div></div>
</div>`;
}

function build(type, w, joiningDate = '', designation = '', ngoKey = 'BSCT') {
  const ngo = getNgo(ngoKey);
  const today = new Date().toLocaleDateString('en-GB',{ day:'numeric', month:'long', year:'numeric' });
  const r = deptLabel(w.role || w.department) || 'Team Member';
  const d = deptLabel(w.dept || w.department) || 'General';
  const body = {
    'Offer letter': `To,\n${titleCase(w.name)}\n\n<strong>Designation: ${designation || r}</strong>\n\nDear ${titleCase(w.name)},\n\nWe are pleased to offer you the role of ${designation || r} in the ${d} department of ${ngo.name}. Your skills and enthusiasm will be a valuable addition to our mission of serving the community.\n\nTerms of your engagement with the Trust:\n\nRole: You will assist the Trust with duties related to ${d} and other activities assigned from time to time, reporting to the respective Coordinator.\nDuration: Commencing on <strong>${joiningDate}</strong> for a period of <strong>2 months</strong>, extendable by mutual consent.\nNature of Engagement: This is an honorary role undertaken in the spirit of seva and social service. No monetary compensation shall be payable for your services.\nConduct & Confidentiality: You agree to follow the Trust's policies, act with integrity towards beneficiaries and colleagues, and keep all Trust-related information confidential.\nTermination: Either party may end this engagement with [seven days'] written notice.\n\nWe appreciate your willingness to serve and look forward to welcoming you to the ${ngo.name} family. Kindly sign below to confirm your acceptance.\n\nACCEPTANCE: I, ${titleCase(w.name)}, accept the role offered to me on the terms above.\nSignature: ______________ Date: ______________`,
    'Promotion letter': `Dear ${w.name},\n\nCongratulations. In recognition of your strong contribution to the ${d} team, we are pleased to confirm your promotion, effective immediately. Thank you for the energy you bring to your work.\n\nWarm regards,\nThe People Team`,
    'Warning letter': ``,
    'Relieving letter': `Dear ${w.name},\n\nThis confirms that you have been relieved of your duties as ${r}, ${d}, with all responsibilities duly handed over. Thank you for your contributions — we wish you the very best in what comes next.\n\nWarm regards,\nThe People Team`,
  }[type];
  return { today, body };
}

function buildStyledLetterHTML(w, letterType, bodyText, dateText, hrNameText, subjectText, showDate = true, ngoKey) {
  const ngo = getNgo(ngoKey);
  const r = deptLabel(w.role || w.department) || 'Team Member';
  const title = letterType.charAt(0).toUpperCase() + letterType.slice(1).toLowerCase();
  const bodyHtml = bodyText.replace(/\n/g, '<br />');
  if (HAS_LH(ngoKey)) {
    const inner = `<div style="padding:10px 0 24px;text-align:justify">
<div style="text-align:center;font-size:16px;font-weight:700;color:#082F5A;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px 0">${title}</div>
${showDate ? `<div style="margin:0 0 6px 0"><strong>Date:</strong> ${dateText}</div>` : ''}
<div style="text-align:justify;white-space:pre-wrap">${bodyHtml}</div>
<div style="margin-top:12px"><p style="margin:0 0 2px 0">Yours sincerely,</p><p style="margin:10px 0 0 0"><strong>Authorized Signatory</strong><br />${hrNameText}<br /><strong>${ngo.name}</strong></p></div>
</div>`;
    return buildLetterheadLayout(ngoKey, inner);
  }
  return `<div style="max-width:800px;margin:0 auto;font-family:'Times New Roman',Times,serif;font-size:12px;line-height:1.25;color:#000;background:#fff;padding:25px 35px">
<div style="display:flex;align-items:center;margin-bottom:4px">
<img src="${ngo.logo}" alt="${ngo.alt}" style="width:${ngo.logoSize || 100}px;height:auto;margin-right:14px" />
<div style="flex:1;text-align:center"><div style="font-size:18px;font-weight:700;color:#082F5A;letter-spacing:2px;line-height:1.1">${ngo.name}</div></div>
</div>
<div style="height:2px;background:#0B73C4;margin-bottom:12px"></div>
<div style="text-align:center;font-size:14px;font-weight:700;color:#082F5A;margin:0 0 8px 0;text-transform:uppercase">${title}</div>
${showDate ? `<table style="width:100%;border-collapse:collapse"><tr><td style="padding:0 0 6px 0;font-size:12px"><strong>Date:</strong> ${dateText}</td></tr></table>` : ''}
<div style="text-align:justify;white-space:pre-wrap">${bodyHtml}</div>
<div style="margin-top:12px"><p style="margin:0 0 2px 0">Yours sincerely,</p><p style="margin:10px 0 0 0"><strong>Authorized Signatory</strong><br />${hrNameText}<br /><strong>${ngo.name}</strong></p></div>
<div style="margin-top:14px;padding-top:4px"><div style="height:2px;background:#0B73C4;margin-bottom:6px"></div><div style="text-align:center;font-size:12px;color:#6b7280">    <strong>Regd. Address:</strong> ${ngo.address}</div></div>
</div>`;
}

function buildVolunteerTerminationLetterHTML(w, dateText, hrNameText, ngoKey) {
  const ngo = getNgo(ngoKey);
  const r = deptLabel(w.role || w.department) || 'Team Member';
  const subj = 'Termination of Volunteer Engagement';
  if (HAS_LH(ngoKey)) {
    const inner = `<div style="padding:10px 0 24px;text-align:justify">
<div style="text-align:center;font-size:16px;font-weight:700;color:#082F5A;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px 0">Termination of Volunteer Engagement</div>
<div style="margin:0 0 6px 0"><strong>Date:</strong> ${dateText}</div>
<div style="margin-bottom:6px"><strong>Dear ${titleCase(w.name)},</strong></div>
<p style="margin:0 0 6px 0">This is to formally inform you that your volunteer engagement with <strong>${ngo.name}</strong> is terminated with effect from <strong>${dateText}</strong> due to organizational requirements/non-compliance with Trust policies.</p>
<p style="margin:0 0 6px 0">Please note that your association was strictly on a voluntary basis. Therefore, the Trust shall not be liable for any volunteer compensation, termination benefits, expenses, reimbursements, allowances, or other financial claims arising from your termination.</p>
<p style="margin:0 0 6px 0">You are requested to return all Trust property, documents, ID cards, and other materials if any in your possession and discontinue representing the Trust after the effective date.</p>
<p style="margin:0 0 6px 0">We thank you for your contribution and wish you all the best for your future.</p>
<div style="margin-top:12px"><p style="margin:0 0 2px 0">Yours sincerely,</p><p style="margin:10px 0 0 0"><strong>Authorized Signatory</strong><br />Name: __________________<br />Designation: _____________<br />Signature: ______________</p></div>
</div>`;
    return buildLetterheadLayout(ngoKey, inner);
  }
  return `<div style="max-width:800px;margin:0 auto;font-family:'Times New Roman',Times,serif;font-size:12px;line-height:1.25;color:#000;background:#fff;padding:25px 35px">
<div style="display:flex;align-items:center;margin-bottom:4px">
<img src="${ngo.logo}" alt="${ngo.alt}" style="width:${ngo.logoSize || 100}px;height:auto;margin-right:14px" />
<div style="flex:1;text-align:center"><div style="font-size:18px;font-weight:700;color:#082F5A;letter-spacing:2px;line-height:1.1">${ngo.name}</div></div>
</div>
<div style="height:2px;background:#0B73C4;margin-bottom:12px"></div>
<div style="text-align:center;font-size:14px;font-weight:700;color:#082F5A;margin:0 0 8px 0;text-transform:uppercase">Volunteer Termination Letter</div>
<table style="width:100%;border-collapse:collapse"><tr><td style="padding:0 0 6px 0;font-size:12px"><strong>Date:</strong> ${dateText}</td></tr></table>
<div style="margin-bottom:6px"><strong>Dear ${titleCase(w.name)},</strong></div>
<div style="text-align:justify">
<p style="margin:0 0 6px 0">This is to formally inform you that your volunteer engagement with <strong>${ngo.name}</strong> is terminated with effect from <strong>${dateText}</strong> due to organizational requirements/non-compliance with Trust policies.</p>
<p style="margin:0 0 6px 0">Please note that your association was strictly on a voluntary basis. Therefore, the Trust shall not be liable for any volunteer compensation, termination benefits, expenses, reimbursements, allowances, or other financial claims arising from your termination.</p>
<p style="margin:0 0 6px 0">You are requested to return all Trust property, documents, ID cards, and other materials if any in your possession and discontinue representing the Trust after the effective date.</p>
<p style="margin:0 0 6px 0">We thank you for your contribution and wish you all the best for your future.</p>
</div>
<div style="margin-top:12px"><p style="margin:0 0 2px 0">Yours sincerely,</p><p style="margin:10px 0 0 0"><strong>Authorized Signatory</strong><br />Name: __________________<br />Designation: _____________<br />Signature: ______________</p></div>
<div style="margin-top:14px;padding-top:4px"><div style="height:2px;background:#0B73C4;margin-bottom:6px"></div><div style="text-align:center;font-size:12px;color:#6b7280">    <strong>Regd. Address:</strong> ${ngo.address}</div></div>
</div>`;
}

export default function Letters() {
  const { fetchWorkers } = useHR();
  const [workers, setWorkers] = useState([]);
  const [ngo, setNgo] = useState('BSCT');
  const [name, setName] = useState('');
  const [type, setType] = useState(TYPES[0]);
  const [letterDate, setLetterDate] = useState('');
  const [hrName, setHrName] = useState('');
  const [subject, setSubject] = useState('');
  const [extraRoles, setExtraRoles] = useState([]);
  const [out, setOut] = useState(null);
  const [showDownload, setShowDownload] = useState(false);
  const [loading, setLoading] = useState(true);
  const pdfRef = useRef(null);
  const pdfDocRef = useRef(null);
  const [docRows, setDocRows] = useState([
    { sr: 1, doc: '', original: false, returned: false, remarks: '' },
    { sr: 2, doc: '', original: false, returned: false, remarks: '' },
    { sr: 3, doc: '', original: false, returned: false, remarks: '' },
  ]);
  const [editDocs, setEditDocs] = useState(false);
  const [sopSel, setSopSel] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchWorkers().then(data => { if (!cancelled) setWorkers(data); }).catch((err) => { console.error('API error:', err.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const capturePdf = async (bodyText, letterType, singlePage = false) => {
    const el = pdfRef.current;
    if (!el) return;
    el.style.display = 'block';
    el.style.padding = '0';
    el.style.width = singlePage ? '900px' : '800px';
    el.innerHTML = bodyText;
    await document.fonts?.ready;
    await new Promise(r => setTimeout(r, 100));
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
    el.style.display = 'none';
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const margin = 12;
    const printableW = pdfW - 2 * margin;
    if (singlePage) {
      const naturalH = (canvas.height * pdfW) / canvas.width;
      const scale = Math.min(1, pdfH / naturalH);
      const drawW = pdfW * scale;
      const drawH = naturalH * scale;
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', (pdfW - drawW) / 2, (pdfH - drawH) / 2, drawW, drawH);
    } else {
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
    }
    pdfDocRef.current = pdf;
  };

  const generate = async () => {
    const w = workers.find(x => x.name === name);
    if (!w) return;
    let body, today, odar = null;
    if (type === 'NOBSD') {
      const dateText = letterDate ? new Date(letterDate + 'T00:00:00').toLocaleDateString('en-GB',{ day:'numeric', month:'long', year:'numeric' }) : '{{date}}';
      const hrNameText = hrName || '{{hr_name}}';
      body = buildNoBSDDeclarationHTML(w, dateText, hrNameText, subject, ngo);
      today = dateText;
    } else if (type === 'ODAR') {
      const dateText = letterDate ? new Date(letterDate + 'T00:00:00').toLocaleDateString('en-GB',{ day:'numeric', month:'long', year:'numeric' }) : '{{date}}';
      const hrNameText = hrName || '{{hr_name}}';
      body = buildODARDocumentHTML(w, dateText, hrNameText, subject, ngo, docRows);
      odar = { w, dateText, hrNameText, subject, ngo };
      today = dateText;
    } else if (type === 'Joining letter') {
      const dateText = letterDate ? new Date(letterDate + 'T00:00:00').toLocaleDateString('en-GB',{ day:'numeric', month:'long', year:'numeric' }) : '{{date}}';
      const hrNameText = hrName || '{{hr_name}}';
      body = buildJoiningLetterHTML(w, dateText, hrNameText, subject, ngo);
      today = dateText;
    } else if (type === 'Experience letter') {
      const jd = w.date_of_joining || w.created_at || '';
      const joiningDate = jd ? new Date(jd + (jd.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-GB',{ day:'numeric', month:'long', year:'numeric' }) : '{{joining_date}}';
      const lastWorkingDate = letterDate ? new Date(letterDate + 'T00:00:00').toLocaleDateString('en-GB',{ day:'numeric', month:'long', year:'numeric' }) : '{{last_working_date}}';
      const hrNameText = hrName || '{{hr_name}}';
      body = buildExperienceLetterHTML(w, joiningDate, lastWorkingDate, hrNameText, subject, subject, ngo);
      today = lastWorkingDate;
    } else if (type === 'Warning letter') {
      const dateText = letterDate ? new Date(letterDate + 'T00:00:00').toLocaleDateString('en-GB',{ day:'numeric', month:'long', year:'numeric' }) : new Date().toLocaleDateString('en-GB',{ day:'numeric', month:'long', year:'numeric' });
      const jd = w.date_of_joining || w.created_at || '';
      const joiningDate = jd ? new Date(jd + (jd.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-GB',{ day:'numeric', month:'long', year:'numeric' }) : '{{joining_date}}';
      body = buildWarningLetterHTML(w, dateText, joiningDate, subject, ngo);
      today = dateText;
    } else if (type === 'Volunteer Termination Letter') {
      const dateText = letterDate ? new Date(letterDate + 'T00:00:00').toLocaleDateString('en-GB',{ day:'numeric', month:'long', year:'numeric' }) : new Date().toLocaleDateString('en-GB',{ day:'numeric', month:'long', year:'numeric' });
      const hrNameText = hrName || '{{hr_name}}';
      body = buildVolunteerTerminationLetterHTML(w, dateText, hrNameText, ngo);
      today = dateText;
    } else {
      const dateText = letterDate ? new Date(letterDate + 'T00:00:00').toLocaleDateString('en-GB',{ day:'numeric', month:'long', year:'numeric' }) : new Date().toLocaleDateString('en-GB',{ day:'numeric', month:'long', year:'numeric' });
      const hrNameText = hrName || '{{hr_name}}';
      const jd = w.date_of_joining || w.created_at || '';
      const joiningDate = jd ? new Date(jd + (jd.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-GB',{ day:'numeric', month:'long', year:'numeric' }) : '{{joining_date}}';
      const result = build(type, w, joiningDate, subject, ngo);
      body = buildStyledLetterHTML(w, type, result.body, dateText, hrNameText, subject, type !== 'Offer letter', ngo);
      today = dateText;
    }
    setOut({ today, body, type, odar });
    setShowDownload(false);
    await capturePdf(body, type, type === 'ODAR' || type === 'NOBSD' || HAS_LH(ngo));
    setShowDownload(true);
  };

  const downloadPdf = () => {
    if (pdfDocRef.current) {
      pdfDocRef.current.save(`${type.replace(/\s+/g, '_')}.pdf`);
    }
  };

  const cleanPhone = (p) => {
    if (!p) return '';
    let d = String(p).replace(/\D/g, '');
    if (d.length === 10) d = '91' + d;
    return d;
  };

  const shareWhatsApp = () => {
    const sel = HR_MESSAGES.find(m => m.key === sopSel);
    const worker = workers.find(x => x.name === name);
    const number = cleanPhone(worker?.phone) || '918879136938';
    let text = 'hey';
    if (sel) text = [sel.heading, sel.label, sel.subject, sel.body].filter(Boolean).join('\n\n').replace(/\[Volunteer Name\]/g, name || '[Volunteer Name]');
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, '_blank');
  };

  useEffect(() => {
    if (workers.length && !name) setName(workers[0].name);
  }, [workers, name]);

  useEffect(() => {
    if (showDownload) setShowDownload(false);
  }, [name, type, letterDate, hrName, subject, docRows]);

  useEffect(() => {
    if (!workers.length) return;
    const t = setTimeout(generate, 400);
    return () => clearTimeout(t);
  }, [ngo, name, type, letterDate, hrName, subject, docRows, workers]);

  const updateDocRow = (i, patch) => setDocRows(rows => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addDocRow = () => setDocRows(rows => [...rows, { sr: rows.length + 1, doc: '', original: false, returned: false, remarks: '' }]);
  const removeDocRow = (i) => setDocRows(rows => rows.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, sr: idx + 1 })));

  return (
    <div className="card">
      <div className="card-head"><h3>Generate a letter</h3><span className="sub">auto-fills name &amp; role</span></div>
      <div className="card-pad">
        {loading ? (
          <div className="form-row" aria-hidden="true" style={{ flexDirection:'row', flexWrap:'wrap' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <label className="field" key={i} style={{ flex: 1, minWidth: 150 }}>
                <div className="sk" style={{ width: 60, height: 10, marginBottom: 6, borderRadius: 4 }} />
                <div className="sk" style={{ width: '100%', height: 36, borderRadius: 6 }} />
              </label>
            ))}
          </div>
        ) : (
        <div className="form-row" style={{ flexDirection:'row', flexWrap:'wrap' }}>
          <label className="field" style={{ flex: '0 0 105px', minWidth: 0 }}>NGOs
            <Dropdown value={ngo} onChange={e=>setNgo(e.target.value)} options={['BSCT','AFLF','MANN','UCS']} />
          </label>
          <label className="field" style={{ flex: '0 0 150px', minWidth: 0 }}>Volunteer
            <Dropdown value={name} onChange={e=>setName(e.target.value)} searchable
              options={workers.map(w => ({value: w.name, label: w.name}))} />
          </label>
          <label className="field" style={{ flex: '0 0 150px', minWidth: 0 }}>Letter type
            <Dropdown value={type} onChange={e=>setType(e.target.value)} options={TYPES} />
          </label>
          <label className="field" style={{ flex: '0 0 170px', minWidth: 0 }}>Volunteer Message
            <Dropdown value={sopSel} onChange={e=>setSopSel(e.target.value)} placeholder="Select..." options={[{ value: '', label: 'Select...' }, ...HR_MESSAGES.map(m => ({ value: m.key, label: m.label }))]} />
          </label>
          <label className="field" style={{ flex: '0 0 150px', minWidth: 0 }}>Last Working Date
            <input type="date" value={letterDate} onChange={e=>setLetterDate(e.target.value)} style={{padding:'9px 11px',border:'1px solid var(--line)',borderRadius:'var(--radius-sm)',fontSize:14,fontFamily:'inherit',outline:'none',background:'var(--paper)',color:'var(--ink)'}} />
          </label>
          <label className="field" style={{ flex: '0 0 150px', minWidth: 0 }}>HR name
            <Dropdown value={hrName} onChange={e=>setHrName(e.target.value)} options={[{value:'',label:'Select HR...'}, ...[...workers.filter(w => (w.dept||w.department||'').toLowerCase().includes('hr') || (w.dept||w.department||'').toLowerCase().includes('admin')).map(w => ({value: w.name, label: w.name})), {value:'deepak karkera', label:'deepak karkera'}].map(o => o).filter((o, i, arr) => arr.findIndex(x => x.value === o.value) === i)]} />
          </label>
          <label className="field" style={{ flex: '0 0 150px', minWidth: 0 }}>Designation
            <Dropdown value={subject} onChange={e => { if (e.target.value === '__add_role__') { const r = prompt('Enter role name:'); if (r && r.trim()) { setExtraRoles(p => [...p, r.trim()]); setSubject(r.trim()); } } else { setSubject(e.target.value); } }} options={[...[...new Set([...workers.map(w => w.role || w.department || 'Team Member'), ...extraRoles])].sort().map(v => ({ value: v, label: deptLabel(v) })), { value: '__add_role__', label: '+ Add Role' }]} renderOption={o => o.value === '__add_role__' ? <span style={{color:'#dc2626',fontWeight:600}}>+ Add Role</span> : o.label} />
          </label>
          <label className="field btn-field"><span>&nbsp;</span>{showDownload && (
            <span style={{ display: 'inline-flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={downloadPdf} title="Download PDF" style={{ background:'#dc2626', color:'#fff', border:'1px solid #b91c1c', padding:'9px 11px' }}><FileTxt size={18}/></button>
              <button className="btn btn-primary" onClick={shareWhatsApp} title="Send via WhatsApp" style={{ background:'#25D366', color:'#fff', border:'1px solid #1da851', padding:'9px 11px' }}><WhatsApp size={18}/></button>
            </span>
          )}</label>
        </div>
        )}

        {out && !sopSel && (
          <div className="letter">
            {type === 'ODAR' && out.odar ? (
              <ODARDocumentPreview
                {...out.odar}
                ngoKey={ngo}
                docRows={docRows}
                editing={editDocs}
                onToggleEdit={() => setEditDocs(e => !e)}
                onDocRowChange={updateDocRow}
                onAddDocRow={addDocRow}
                onRemoveDocRow={removeDocRow}
              />
            ) : (
              <div style={{ whiteSpace: 'normal' }} dangerouslySetInnerHTML={{ __html: out.body }} />
            )}
          </div>
        )}
        {sopSel && (() => {
          const m = HR_MESSAGES.find(x => x.key === sopSel);
          if (!m) return null;
          return (
            <div className="letter">
              {m.heading && <div style={{ fontSize: 15, fontWeight: 700, color: '#082F5A', marginBottom: 12 }}>{m.heading}</div>}
              <div style={{ fontWeight: 700, color: '#082F5A', marginBottom: 4 }}>{m.label}</div>
              {m.subject && <div style={{ fontStyle: 'italic', marginBottom: 4 }}>{m.subject}</div>}
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.body.replace(/\[Volunteer Name\]/g, name || '[Volunteer Name]')}</div>
            </div>
          );
        })()}
      </div>
      <div ref={pdfRef} style={{
        position:'fixed', left:'-9999px', top:0,
        fontFamily:'Arial, sans-serif', fontSize:14, lineHeight:1.6,
        padding:40, color:'#000', background:'#fff',
        width:'800px', display:'none'
      }} />
    </div>
  );
}