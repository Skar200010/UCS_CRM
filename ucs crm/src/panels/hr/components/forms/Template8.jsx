export default function Template8({ personal, declarationDate }) {
  return (
    <div className="print-page">
      <style>{`
        @page{size:A4 portrait;margin:0}
        .t8 *{box-sizing:border-box;font-family:'Times New Roman',Times,serif}
        .t8{width:210mm;height:297mm;margin:0 auto;background:#fff;border:3px solid #000;box-shadow:inset 0 0 0 5px #fff,inset 0 0 0 7px #000;padding:3mm 8mm 5mm 8mm;display:flex;flex-direction:column;overflow:hidden}
        .t8 h1{text-align:center;margin:0;font-size:34px;font-family:'Times New Roman',Times,serif;font-weight:bold;line-height:1.2}
        .t8 .sub{text-align:center;font-size:9.5px;margin:0 0 0.5mm 0;line-height:1.2;letter-spacing:0.3px}
        .t8 .red{border-top:2.5px solid #7a2020;margin:1mm auto 1mm auto;width:100%}
        .t8 .sec{color:#7a2020;font-weight:bold;font-size:13pt;margin:8px 0 3px 0}
        .t8 p{font-size:10.5pt;line-height:1.35;text-align:justify;margin:3px 0}
        .t8 .footer{text-align:center;font-size:10px;line-height:1.5;margin-top:auto}
        .t8 .footer-sep{border-top:2.5px solid #7a2020;margin:0 0 1.5mm 0;width:100%}
      `}</style>
      <div className="t8">
        <h1>Being Sevak Charitable Trust</h1>
        <div className="red"></div>
        <div className="sub">Public Charitable Trust (Reg.) E-31948 No, Income Tax Exempted Under 80G</div>

        <div className="sec">11. Child &amp; Beneficiary Protection</div>
        <p>Every volunteer is responsible for ensuring the safety, dignity, and well-being of all beneficiaries associated with the Trust. Volunteers shall treat every child, beneficiary, and community member with respect and shall refrain from any form of abuse, harassment, discrimination, intimidation, exploitation, or inappropriate behavior. The privacy and confidentiality of beneficiaries must always be protected, and any safeguarding concern, misconduct, or suspected abuse must be reported immediately to the appropriate authority within the Trust.</p>

        <div className="sec">12. Leave Policy</div>
        <p>Volunteers are expected to inform their reporting authority well in advance whenever leave is required. Emergency leave shall be communicated immediately through appropriate means of communication. Repeated absenteeism, unauthorized leave, or continuous absence without proper information may adversely affect the volunteer's association with the Trust and may result in discontinuation of volunteer engagement.</p>

        <div className="sec">13. Restricted Areas</div>
        <p>Certain areas within the Trust premises are restricted to authorized personnel only. Volunteers shall not enter management cabins, the Accounts Department, Human Resources Department, server rooms, storage areas, or any other restricted location without obtaining prior permission from the concerned authority. Unauthorized access to restricted areas may lead to disciplinary action.</p>

        <div className="sec">14. Dress Code</div>
        <p>Volunteers are expected to maintain a clean, neat, and professional appearance at all times while representing the Trust. Formal attire shall be worn from Monday to Friday, while smart casual attire may be permitted on Saturdays unless otherwise instructed. Volunteers are expected to present themselves appropriately in a manner consistent with the values and professional image of the Trust.</p>

        <div className="sec">15. Volunteer Code of Conduct</div>
        <p>Every volunteer shall perform assigned responsibilities honestly, ethically, and responsibly while respecting fellow volunteers, employees, beneficiaries, donors, visitors, and members of the public. Volunteers are expected to protect Trust property, maintain punctuality, preserve confidentiality, comply with all organizational policies and procedures, and conduct themselves with integrity, professionalism, and accountability throughout their period of association with the Trust.</p>

        <div className="sec">16. Grievance Policy</div>
        <p>Any volunteer experiencing concerns, disputes, or grievances relating to workplace conduct, operations, or interpersonal issues should first report the matter to the concerned Team Leader. If the matter remains unresolved, the volunteer may escalate the issue to the Human Resources Department or the Trustee for appropriate review and resolution. The Trust is committed to addressing genuine grievances fairly, impartially, and confidentially.</p>

        <div className="sec">17. Volunteer Withdrawal</div>
        <p>A volunteer who wishes to discontinue their association with the Trust should communicate their decision in writing to the appropriate authority and complete the proper handover of all assigned responsibilities, documents, equipment, identification cards, and other Trust assets before their final day of association.</p>

        <div className="sec">18. Discontinuation of Volunteer Engagement</div>
        <p>The Trust reserves the absolute right to discontinue the engagement of any volunteer at its discretion in cases involving misconduct, indiscipline, poor performance, repeated absenteeism, misuse of Trust property, breach of confidentiality, fraud, harassment, violation of organizational policies, or any conduct considered detrimental to the interests, reputation, or objectives of the Trust.</p>

        <div className="sec">19. Volunteer Appreciation Certificate</div>
        <p>The Trust may issue a Volunteer Appreciation Certificate or Volunteer Service Certificate to volunteers who have successfully completed their period of service with satisfactory performance and conduct, subject to the applicable policies and approval of the Trust management.</p>

        <div className="footer">
          <div className="footer-sep"></div>
          Reg. Add.: Office No. 402, 4th Floor, 'A' Wing, New Delite Apartment, Near Chandavarkar Lane, Borivali (West), Mumbai.<br />
          Contact Sevak *8879035035 *8879034034 * E-Mail: being.sevak@gmail.com * Website: www.beingsevak.org
        </div>
      </div>
    </div>
  );
}
