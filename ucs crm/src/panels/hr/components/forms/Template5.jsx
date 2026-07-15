export default function Template5({ personal }) {
  return (
    <div className="print-page">
      <style>{`
        @page{size:A4 portrait;margin:0}
        .t5 *{box-sizing:border-box;font-family:'Times New Roman',Times,serif}
        .t5{width:210mm;height:297mm !important;margin:0 auto;background:#fff;border:3px solid #000;box-shadow:inset 0 0 0 5px #fff,inset 0 0 0 7px #000;padding:2mm 8mm 4mm 8mm;position:relative;overflow:hidden !important;display:flex;flex-direction:column}
        .t5 h1{margin:0;text-align:center;font-size:26px;font-family:'Times New Roman',Times,serif;font-weight:bold;line-height:1.15}
        .t5 .sub{text-align:center;font-size:9.5px;margin:0 0 0.5mm 0;line-height:1.15;letter-spacing:0.3px}
        .t5 .redline{border-top:2px solid #7a2020;margin:0.8mm auto;width:100%}
        .t5 p{font-size:10pt;line-height:1.3;text-align:justify;margin:2px 0}
        .t5 .section{color:#7a2020;font-weight:bold;font-size:11pt;margin:4px 0 2px 0}
        .t5 table{width:100%;border-collapse:collapse;margin:2px 0;page-break-inside:avoid}
        .t5 th,.t5 td{border:1px solid #000;padding:3px 4px;font-size:9.5pt;vertical-align:top;text-align:left}
        .t5 th{background:#d9d9d9;text-align:left}
        .t5 .sign{display:flex;justify-content:space-between;gap:8px;margin:3px 0}
        .t5 .sign .field{flex:1}
        .t5 .sign .field:first-child{margin-right:6px}
        .t5 .sign .field:last-child{margin-left:6px}
        .t5 .line{border-bottom:1px solid #000;height:14px;padding-left:4px}
        .t5 .consent{text-align:center;font-size:11px;font-weight:bold;color:#1f3f73;margin:4px 0 2px 0}
        .t5 .row{display:flex;align-items:center;margin:1.5px 0;font-size:9.5pt}
        .t5 .row .label{font-weight:bold;white-space:nowrap;margin-right:4px}
        .t5 .row .line{flex:1;border-bottom:1px solid #000;min-height:12px;padding-left:4px}
        .t5 .footer{border-top:2px solid #7b2020;margin-top:auto;padding-top:3px;text-align:center;font-size:9pt;line-height:1.35}
        .t5 .footer-sep{display:none}
      `}</style>
      <div className="t5">
        <h1>Being Sevak Charitable Trust</h1>
        <div className="redline"></div>
        <div className="sub">Public Charitable Trust (Reg.) E-31948 No, Income Tax Exempted Under 80G</div>

        <p>You shall abide by the Trust rules and HR policies as presented in the HR Rule Copy, and by all general or administrative rules, regulations and directives of the Trust made from time to time, so long as they are not inconsistent with this agreement. For any work-related matter, issue or communication, the volunteer must contact the concerned authority directly. <strong>Dress Code:</strong> Monday to Friday [Formals]; Saturday [Casuals].</p>

        <div className="section">Holiday &amp; Leave Policy (Clubbing Rule)</div>
        <p>No leave is permitted during the probation period. Taking leave may affect increment and job continuity. Weekly off is Sunday only, subject to change. Outdoor duty and leave both require approval from the HOD. Leave should normally be applied at least three days in advance and half-day leave at least one day in advance.</p>
        <p><strong>If leave is taken on Saturday, Monday or the day after a Public Holiday, the Sunday weekly off will be deducted from salary. If a volunteer is absent for more than six days in a month, all Sundays of that month will be deducted from salary.</strong></p>

        <div className="section">Exit Formation &amp; Separation Policy</div>
        <p>A resigning volunteer must complete the separation clearance process and hand over all assigned duties. Full &amp; Final settlement is processed in the next salary cycle. A volunteer becomes eligible for an Experience Letter after completing one year.</p>

        <table>
          <tr><th width="28%">Policy</th><th>Description</th></tr>
          <tr><td><b>Voluntary Resignation</b></td><td>Notice Period: One month during probation and 45 days after confirmation. Leaving without completing the notice period makes the volunteer ineligible for salary.</td></tr>
          <tr><td><b>Abandonment of Service</b></td><td>Absence from work for seven consecutive days without information will be treated as absconding and salary may be forfeited.</td></tr>
          <tr><td><b>Termination of Service</b></td><td>Termination may result from non-performance or violation of the Trust Code of Conduct.</td></tr>
        </table>

        <div className="section">Incentive</div>
        <p>Performance Linked Incentive (PLI), where applicable, shall be paid according to performance and HOD approval.</p>

        <div className="section">Legal Indemnification</div>
        <p>The volunteer agrees to maintain confidentiality and indemnify the Trust from damages, claims or disputes arising from any violation of confidentiality or contractual obligations. Signing below confirms that the volunteer has read, understood and accepted all terms.</p>
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
