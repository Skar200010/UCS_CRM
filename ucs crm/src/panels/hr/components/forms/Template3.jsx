export default function Template3({ personal, declarationDate, place }) {
  return (
    <div className="print-page">
      <style>{`
        .t3 *{box-sizing:border-box}
        .t3{width:210mm;min-height:297mm;height:auto !important;margin:auto;background:#fff;border:3px solid #222;padding:10mm 12mm;font-family:"Times New Roman",serif;page-break-after:always}
        .t3 h1{text-align:center;margin:0 0 2px;font-size:22pt}
        .t3 .sub{text-align:center;font-size:9pt;margin:0 0 4px}
        .t3 .red{height:2px;background:#7b2020;margin:2px 0 6px}
        .t3 .sec{color:#7b2020;font-weight:bold;font-size:11pt;margin-top:7px}
        .t3 .title{text-align:center;color:#1f3f73;font-size:14pt;font-weight:bold;margin:10px 0}
        .t3 p{font-size:9pt;line-height:1.3;text-align:justify;margin:2px 0}
        .t3 .row{display:flex;justify-content:space-between;margin:6px 0}
        .t3 .line{display:inline-block;border-bottom:1px solid #000;min-width:120px;height:14px;padding-left:4px}
        .t3 .footer{border-top:2px solid #7b2020;margin-top:6px;padding-top:4px;text-align:center;font-size:9pt;line-height:1.4}
      `}</style>
      <div className="t3">
        <h1>Being Sevak Charitable Trust</h1>
        <div className="red"></div>
        <div className="sub">Public Charitable Trust (Reg.) E-31948 No, Income Tax Exempted Under 80G</div>

        <div className="sec">DECLARATION</div>
        <p>I hereby declare that the statements made in my application form are true, complete and correct to the best of my knowledge and belief. In the event of any information being found false or incorrect at any stage, my services are liable to be terminated without notice.</p>

        <div className="row">
          <div>Date: <span className="line">{declarationDate || ''}</span></div>
          <div>Place: <span className="line">{place || ''}</span></div>
          <div>Sign: <span className="line"></span></div>
        </div>

        <div className="title">JOINING HR RULE COPY</div>

        <div className="sec">1. Volunteer Engagement</div>
        <p>Welcome to Being Sevak Charitable Trust. We sincerely appreciate your decision to volunteer with our organization. Every volunteer plays a vital role in serving society with honesty, compassion, professionalism, integrity, and dedication. This handbook outlines the policies, responsibilities, expectations, and code of conduct applicable to all volunteers associated with the Trust. Volunteers are engaged based on the requirements of the Trust and their individual skills, qualifications, and suitability for specific projects or activities. Every volunteer shall work under the supervision and guidance of the respective Team Leader, Head of Department (HOD), Project Coordinator, or any authorized representative of the Trust. The Trust reserves the right to assign, transfer, or modify the volunteer's department, project, work location, or responsibilities whenever required in the interest of organizational operations.</p>

        <div className="sec">2. Volunteer Orientation Period</div>
        <p>Every newly engaged volunteer shall undergo an orientation and training period during which the Trust will evaluate the volunteer's attendance, punctuality, discipline, communication skills, teamwork, work ethics, behavior, and overall performance. This orientation period is intended to familiarize volunteers with the Trust's mission, policies, and operational procedures. The Trust reserves the right to discontinue the volunteer's association at any time during or after the orientation period if the volunteer's conduct, performance, or suitability is found to be unsatisfactory or inconsistent with the values and expectations of the organization.</p>

        <div className="sec">3. Volunteer Timings</div>
        <p>The standard volunteer working hours shall ordinarily be from 10:00 AM to 7:00 PM or 9:30 AM to 6:30 PM, inclusive of the prescribed break time, unless otherwise communicated by the Trust. Volunteers are expected to report to their assigned workplace punctually and remain available during their scheduled hours. Attendance shall be recorded through the designated attendance management system or any manual process authorized by the Trust. Regular late reporting, early departures, or irregular attendance may be reviewed by the management and may affect the continuation of volunteer engagement.</p>

        <div className="sec">4. Lunch Break</div>
        <p className="t3-lunch">Volunteers shall be entitled to a lunch break of 30 minutes, generally scheduled between 1:30 PM and 2:00 PM, unless modified due to operational requirements. Volunteers are expected to resume their duties promptly upon completion of the lunch break and ensure that the break does not interfere with the smooth functioning of organizational activities.</p>

        <div className="sec">5. Attendance Policy</div>
        <p>Every volunteer is expected to maintain regular attendance, report to duty on time, and record attendance through the prescribed system every working day. In the event that a volunteer is unable to attend due to unavoidable circumstances, the concerned Team Leader or reporting authority must be informed at the earliest possible opportunity. Continuous absence without prior information or valid justification may be treated as abandonment of volunteer responsibilities and may result in discontinuation of the volunteer's engagement with the Trust.</p>

        <div className="sec">6. Office Discipline</div>
        <p>Volunteers are expected to maintain the highest standards of discipline, professionalism, and ethical conduct throughout their association with the Trust. Every volunteer shall treat beneficiaries, visitors, colleagues, and members of the public with dignity, courtesy, and respect. Volunteers are required to follow the lawful instructions of their reporting authorities, maintain cleanliness within the workplace, and adhere to the prescribed dress code. Activities such as personal shopping, personal grooming during working hours, excessive or unnecessary mobile phone usage, playing games, or engaging in activities unrelated to the Trust's work are strictly discouraged and may invite disciplinary action if found to interfere with organizational responsibilities.</p>

        <div className="sec">7. Mobile Phone Policy</div>
        <p className="t3-mobile">The use of personal mobile phones during volunteer working hours shall be limited to emergencies or designated break periods. Volunteers are encouraged to remain focused on their assigned duties while on the premises of the Trust. Family members and personal contacts should communicate with volunteers during working hours only in cases of genuine emergency to avoid unnecessary interruptions to organizational activities.</p>

        <div className="sec">8. Trust Assets Policy</div>
        <p>All assets, equipment, documents, electronic devices, identification cards, communication tools, and other property belonging to the Trust are provided solely for official purposes. Volunteers shall exercise due care while using such resources and shall not use them for personal or unauthorized activities. Any loss, theft, damage, or misuse resulting from negligence or misconduct may result in appropriate administrative action. Upon completion or termination of the volunteer engagement, all Trust property must be returned immediately in good condition.</p>

        <div className="sec">9. Confidentiality</div>
        <p>Volunteers shall maintain strict confidentiality regarding all information obtained during their association with the Trust. Confidential information includes, but is not limited to, donor details, beneficiary records, financial information, internal reports, project documentation, login credentials, CRM data, operational strategies, and any other non-public information belonging to the Trust. Volunteers shall not disclose, copy, share, or use confidential information for personal benefit or disclose it to any third party without prior written authorization from the Trust.</p>

        <div className="footer">
          Reg. Add.: Office No. 402, 4th Floor, 'A' Wing, New Delite Apartment, Near Chandavarkar Lane, Borivali (West), Mumbai.<br />
          Contact: 8879035035 / 8879034034 | E-mail: being.sevak@gmail.com | Website: www.beingsevak.org
        </div>
      </div>
    </div>
  );
}
