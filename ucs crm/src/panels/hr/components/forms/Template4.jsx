export default function Template4({ personal }) {
  return (
    <div className="print-page">
      <style>{`
        .t4 *{box-sizing:border-box}
        .t4{width:210mm;min-height:297mm;height:auto !important;margin:auto;background:#fff;border:3px solid #222;padding:10mm 12mm;font-family:"Times New Roman",serif;page-break-after:always}
        .t4 h1{text-align:center;margin:0 0 2px;font-size:22pt}
        .t4 .sub{text-align:center;font-size:9pt;margin:0 0 4px}
        .t4 .red{height:2px;background:#7b2020;margin:2px 0 6px}
        .t4 .sec{color:#7b2020;font-weight:bold;font-size:11pt;margin-top:7px}
        .t4 p{font-size:9pt;line-height:1.3;text-align:justify;margin:2px 0}
        .t4 .footer{border-top:2px solid #7b2020;margin-top:6px;padding-top:4px;text-align:center;font-size:9pt;line-height:1.4}
      `}</style>
      <div className="t4">
        <h1>Being Sevak Charitable Trust</h1>
        <div className="red"></div>
        <div className="sub">Public Charitable Trust (Reg.) E-31948 No, Income Tax Exempted Under 80G</div>

        <div className="sec">10. Social Media Policy</div>
        <p>Volunteers shall not publish, post, upload, or distribute any information, photographs, videos, documents, or confidential material relating to the Trust through personal social media platforms or any public forum without obtaining prior approval from the authorized representatives of the Trust. The Trust may, however, use photographs, videos, names, testimonials, or recordings of volunteers for its official website, social media platforms, awareness campaigns, CSR reports, annual reports, fundraising initiatives, newsletters, brochures, and other promotional or educational purposes unless the volunteer has submitted a written objection in advance.</p>

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
          Reg. Add.: Office No. 402, 4th Floor, 'A' Wing, New Delite Apartment, Near Chandavarkar Lane, Borivali (West), Mumbai.<br />
          Contact: 8879035035 / 8879034034 | E-mail: being.sevak@gmail.com | Website: www.beingsevak.org
        </div>
      </div>
    </div>
  );
}
