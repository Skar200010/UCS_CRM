export default function Template5({ personal }) {
  return (
    <div className="print-page">
      <style>{`
        @page{size:A4 portrait;margin:0}
        .t5 *{box-sizing:border-box;font-family:'Times New Roman',Times,serif}
        .t5{width:210mm;height:297mm !important;margin:0 auto;background:#fff;border:3px solid #000;box-shadow:inset 0 0 0 5px #fff,inset 0 0 0 7px #000;padding:2mm 8mm 4mm 8mm;position:relative;overflow:hidden !important;display:flex;flex-direction:column}
        .t5 h1{margin:0;text-align:center;font-size:25px;font-family:'Times New Roman',Times,serif;font-weight:bold;line-height:1.1}
        .t5 .sub{text-align:center;font-size:9px;margin:0 0 0.3mm 0;line-height:1.1;letter-spacing:0.3px}
        .t5 .redline{border-top:2px solid #7a2020;margin:0.5mm auto;width:100%}
        .t5 p{font-size:9.5pt;line-height:1.25;text-align:justify;margin:1.5px 0}
        .t5 .section{color:#7a2020;font-weight:bold;font-size:10.5pt;margin:3px 0 1px 0}
        .t5 table{width:100%;border-collapse:collapse;margin:1.5px 0;page-break-inside:avoid}
        .t5 th,.t5 td{border:1px solid #000;padding:2px 4px;font-size:9pt;vertical-align:top;text-align:left}
        .t5 th{background:#d9d9d9;text-align:left}
        .t5 .sign{display:flex;justify-content:space-between;gap:6px;margin:2px 0}
        .t5 .sign .field{flex:1}
        .t5 .sign .field:first-child{margin-right:6px}
        .t5 .sign .field:last-child{margin-left:6px}
        .t5 .line{border-bottom:1px solid #000;height:13px;padding-left:4px}
        .t5 .consent{text-align:center;font-size:10px;font-weight:bold;color:#1f3f73;margin:3px 0 1px 0}
        .t5 .row{display:flex;align-items:center;margin:1px 0;font-size:9pt}
        .t5 .row .label{font-weight:bold;white-space:nowrap;margin-right:4px}
        .t5 .row .line{flex:1;border-bottom:1px solid #000;min-height:11px;padding-left:4px}
        .t5 .footer{border-top:2px solid #7b2020;margin-top:auto;padding-top:2px;text-align:center;font-size:8.5pt;line-height:1.3}
        .t5 .footer-sep{display:none}
      `}</style>
      <div className="t5">
        <h1>Being Sevak Charitable Trust</h1>
        <div className="redline"></div>
        <div className="sub">Public Charitable Trust (Reg.) E-31948 No, Income Tax Exempted Under 80G</div>

        <p>You shall abide by the Trust's guidelines and volunteer policies as presented in the Volunteer Guidelines, and by all general or administrative rules, regulations, and directives of the Trust made from time to time, so long as they are not inconsistent with this agreement. For any work-related matter, issue, or communication, the volunteer must contact the concerned coordinator directly. <strong>Attire Guidelines:</strong> Monday to Friday [Formals]; Saturday [Smart Casuals].</p>

        <div className="section">Holiday &amp; Absence Policy (Clubbing Rule)</div>
        <p>Volunteer attendance will be considered for the entire month while determining monthly volunteer involvement. If a volunteer is absent immediately before or after a Sunday, weekly off, or declared public holiday, the intervening day(s) will also be counted as part of the absence. If a volunteer remains absent for more than 6 days in a calendar month, all Sundays, weekly offs, and public holidays during that month will also be considered. Exceptions may be reviewed by the Trust management for genuine reasons.</p>

        <div className="section">Volunteer Timings</div>
        <p>Volunteer timings are 10.00 AM to 7.00 PM OR 9.30 AM to 6.30 PM [including break time]; attendance is recorded through the attendance system OR manually. Lunch break is 30 minutes, between 1.30 and 2.00 PM. Half-day: reporting time is 2.00 PM and departure time is 3.00 PM; no lunch break is applicable on a half-day, and arriving late on a half-day will be recorded as absent. A cumulative grace period of 180 minutes per month is allowed for late arrival / early departure, as follows:</p>
        <table>
          <tr><th>Late / Early Departure Duration Per Month</th><th>Attendance Record Impact</th></tr>
          <tr><td>Up to 180 minutes</td><td>No impact on attendance record</td></tr>
          <tr><td>181 – 240 minutes</td><td>Recorded as half-day absence</td></tr>
          <tr><td>241 – 480 minutes</td><td>Recorded as one-day absence</td></tr>
          <tr><td>More than 480 minutes</td><td>Attendance reviewed by Trust management as per volunteer guidelines</td></tr>
        </table>

        <div className="section">Voluntary Withdrawal &amp; Separation</div>
        <p>A volunteer who wishes to step down must complete the handover process and return all assigned duties, documents, equipment, and Trust resources. A Letter of Appreciation is issued to volunteers who have completed at least one year of satisfactory association with the Trust.</p>

        <table>
          <tr><th width="28%">Guideline</th><th>Description</th></tr>
          <tr><td><b>Voluntary Withdrawal</b></td><td>Intimation Period: At least one month's advance notice is requested. Stepping down without completing the intimation period may affect the volunteer's eligibility for a Letter of Appreciation.</td></tr>
          <tr><td><b>Discontinuation Without Intimation</b></td><td>Absence from Trust activities for seven consecutive days without any communication will be treated as abandonment of volunteer responsibilities.</td></tr>
          <tr><td><b>Conclusion of Association</b></td><td>The association may be concluded due to non-involvement or violation of the Trust's Code of Conduct.</td></tr>
        </table>

        <div className="section">Acknowledgement</div>
        <p>The volunteer agrees to maintain confidentiality and indemnify the Trust from damages, claims, or disputes arising from any violation of confidentiality or obligations. Signing below confirms that the volunteer has read, understood, and accepted all terms.</p>
        <p>Yours sincerely,<br /><b>For Being Sevak Charitable Trust – HOD</b></p>
        <p>I accept all the terms and conditions as mentioned in this letter.</p>

        <div className="sign">
          <div className="field">Volunteer Name <div className="line">{personal.fullName || ''}</div></div>
          <div className="field">Signature <div className="line"></div></div>
        </div>
        <div className="sign">
          <div className="field">Manager Name / HOD <div className="line"></div></div>
          <div className="field">Signature <div className="line"></div></div>
        </div>

        <div className="consent">VOLUNTEER PHOTO, VIDEO, NAME &amp; PUBLICITY CONSENT AND RELEASE FORM</div>
        <p>I, <b>{personal.fullName || '________________________'}</b> son/daughter/spouse of <b>{personal.fatherHusband || '________________________'}</b> residing at <b>{personal.address || '________________________'}</b> hereby voluntarily grant my free, informed and unconditional consent to Being Sevak Charitable Trust to photograph, film, record and otherwise capture my image, likeness, voice and statements during my association with the Trust.</p>

        <p><b>1. Grant of Permission &amp; Permitted Use</b><br />The Trust may use, reproduce, publish, distribute, edit, display and archive photographs, videos, recordings, testimonials and statements for educational, awareness, fundraising, promotional, branding, documentation and reporting purposes.</p>
        <p><b>2. No Objection &amp; No Financial Claim</b><br />I shall not claim any royalty, fee, compensation or financial benefit for such use.</p>
        <p><b>3. Editing Rights &amp; Intellectual Property</b><br />The Trust may crop, edit, enhance or translate the material without intentionally misrepresenting my identity. All material remains the exclusive property of Being Sevak Charitable Trust.</p>

        <div className="footer">
          Reg. Add.: Office No. 402, 4th Floor, 'A' Wing, New Delite Apartment, Near Chandavarkar Lane, Borivali (West), Mumbai.<br />
          Contact: 8879035035 / 8879034034 | E-mail: being.sevak@gmail.com | Website: www.beingsevak.org
        </div>
      </div>
    </div>
  );
}
