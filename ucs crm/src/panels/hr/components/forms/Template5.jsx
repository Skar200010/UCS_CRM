export default function Template6() {
  return (
    <div className="print-page">
      <style>{`
        .t6 *{box-sizing:border-box}
        .t6{width:210mm;height:297mm;margin:auto;background:#fff;border:8px double #000;position:relative;padding:10px 18px 12px 18px;overflow:hidden;font-family:"Times New Roman",serif;display:flex;flex-direction:column}
        .t6 .inner{border:1px solid #222;padding:6px 16px 10px 16px;flex:1;display:flex;flex-direction:column}
        .t6 h1{margin:0;text-align:center;font-size:28px;font-weight:700}
        .t6 .sub{text-align:center;font-size:11px;margin-top:4px}
        .t6 .red{height:3px;background:#7f2d2d;margin:5px 8px 4px}
        .t6 p{margin:2px 0;font-size:12px;line-height:1.3;text-align:justify}
        .t6 .b{font-weight:bold}
        .t6 .blue{font-size:20px;color:#29446f;text-align:center;font-weight:bold;margin:10px 0 6px}
        .t6 .row{font-size:12px;margin:1.5px 0}
        .t6 .line{display:inline-block;border-bottom:1px solid #000;min-width:120px;height:15px;vertical-align:bottom}
        .t6 .long{min-width:230px}
        .t6 .med{min-width:180px}
        .t6 .small{min-width:80px}
        .t6 .sigwrap{display:flex;justify-content:space-between;margin-top:20px}
        .t6 .sig{width:260px}
        .t6 .sig .l{border-bottom:1px solid #000;height:22px}
        .t6 .sig div:last-child{text-align:left;font-size:11px;margin-top:3px}
        .t6 .footer{margin-top:auto;border-top:2px solid #8b3434;padding-top:4px;text-align:center;font-size:10px;color:#333}
      `}</style>
      <div className="t6">
        <div className="inner">
          <h1>Being Sevak Charitable Trust</h1>
          <div className="red"></div>
          <div className="sub">Public Charitable Trust (Reg.) E-31948 No, Income Tax Exempted Under 80G</div>

          <p><span className="b">4. Withdrawal of Consent:</span> I may withdraw this consent by written request; withdrawal applies only to future publications where reasonably practicable and does not affect materials already published or archived.</p>

          <p><span className="b">5. Declaration:</span> I am signing voluntarily without pressure or coercion, have read and understood this form, and agree to all its terms. It is governed by the laws of India, with exclusive jurisdiction of the competent courts at Mumbai, Maharashtra.</p>

          <div className="row">Full Name: <span className="line med"></span>
          &nbsp;&nbsp; Mobile: <span className="line"></span>
          &nbsp;&nbsp; Email: <span className="line med"></span></div>

          <div className="row">Residential Address:
          <span className="line long" style={{minWidth: 540}}></span></div>

          <div className="row">
          Signature of Volunteer:
          <span className="line"></span>
          &nbsp; Date:
          <span className="line small"></span>/<span className="line small"></span>/<span className="line small"></span>
          &nbsp; Place:
          <span className="line"></span>
          </div>

          <div className="row"><span className="b">For Minors (below 18 years):</span>
          I, <span className="line"></span>, parent/legal guardian of the above volunteer, consent on the minor&apos;s behalf.
          Signature: <span className="line"></span>
          Relationship: <span className="line small"></span>
          </div>

          <div className="row">
          <span className="b">For Being Sevak Charitable Trust (Authorized Signatory)</span>
          &nbsp;—&nbsp; Name:
          <span className="line"></span>
          Designation:
          <span className="line"></span>
          </div>

          <div className="blue" style={{marginTop: 20}}>VOLUNTEER CONFIDENTIALITY / NON-DISCLOSURE AGREEMENT</div>

          <p>This agreement is made between Being Sevak Charitable Trust and the Volunteer on <span className="line med"></span>. While volunteering with the Trust, the Volunteer may receive Confidential Information concerning matters affecting or relating to the Trust. The Volunteer agrees as follows:</p>

          <p><span className="b">A.</span> Confidential Information and Proprietary Data are the Trust's exclusive property. The Volunteer shall keep them confidential, take reasonable steps to protect them, and not disclose or use them for personal benefit or the benefit of others during or after association with the Trust.</p>

          <p><span className="b">B.</span> Notes, notebooks, computer disks, pen drives, documents, equipment, and devices containing such information are the property of the Trust and must not be removed from Trust premises. They shall be returned immediately upon conclusion of the volunteer association.</p>

          <p><span className="b">C.</span> The Volunteer shall not reproduce or commercially use Confidential Information for any purpose other than carrying out duties for the Trust.</p>

          <p><span className="b">D.</span> The Trust may take appropriate action, including conclusion of the volunteer association, and pursue civil or criminal remedies for violations. This agreement is governed by the laws of Maharashtra (Mumbai).</p>

          <p><span className="b">E.</span> On withdrawal, the Volunteer shall surrender all Trust assets, official WhatsApp, email ID, contact number, and other Trust-related items. Failure to comply may result in appropriate action.</p>

          <p><span className="b">F.</span> All provisions apply only to the extent they do not violate applicable law. The Volunteer warrants that no conflicting obligation exists.</p>

          <p style={{marginTop: 14, paddingTop: 10}}><span className="b" >Declaration :</span></p>
          <div style={{display: 'flex', alignItems: 'flex-start', gap: 8}}>
            <input type="checkbox" style={{marginTop: 3, width: 14, height: 14, accentColor: '#7f2d2d', flexShrink: 0}} />
            <p style={{margin: 0}}>I hereby declare that the above statement made in my application is true, complete, and correct to the best of my knowledge and belief. In the event of any information being found false or incorrect at any stage, my services are liable to be terminated without notice.</p>
          </div>

          <div className="row" style={{marginTop: 12, paddingTop: 8, display: 'flex', alignItems: 'center', gap: 20}}>
            <span>Date: <span className="line small"></span>/<span className="line small"></span>/<span className="line small"></span></span>
            <span>Place: <span className="line med"></span></span>
          </div>

          <p style={{marginTop: 14}}>Signing below signifies that the Volunteer agrees to the terms and conditions stated above.</p>

          <div className="sigwrap">
            <div className="sig">
              <div className="l"></div>
              <div>Volunteer Name &amp; Signature</div>
            </div>

            <div className="sig">
              <div className="l"></div>
              <div>For Being Sevak Charitable Trust (Authorized Signatory)</div>
            </div>
          </div>
        </div>

        <div className="footer">
          Reg. Add.: Office No. 402, 4th Floor, &apos;A&apos; Wing, New Delite Apartment, Near Chandavarkar Lane, Borivali (West), Mumbai.<br />
          Contact Sevak: 8879035035 / 8879034034 &nbsp;|&nbsp; E-Mail: being.sevak@gmail.com &nbsp;|&nbsp; Website: www.beingsevak.org
        </div>
      </div>
    </div>
  );
}
