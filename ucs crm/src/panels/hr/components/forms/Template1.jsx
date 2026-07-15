export default function Template1({ personal, education }) {
  return (
    <div className="print-page">
      <style>{`
        .t1 *{margin:0;padding:0;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}
        .t1{width:210mm;min-height:297mm;margin:auto;background:#fff;border:8px double #000;padding:18px;page-break-after:always;display:flex;flex-direction:column}
        .t1 h1{text-align:center;font-size:36px;font-family:Georgia,serif;margin-bottom:0}
        .t1 .subtitle{text-align:center;font-size:11px;margin-bottom:4px}
        .t1 .top-line{border-top:3px solid #7d1e1e;margin:4px 0}
        .t1 .form-title{text-align:center;font-size:26px;font-weight:bold;text-decoration:underline;margin-bottom:20px}
        .t1 table{width:100%;border-collapse:collapse}
        .t1 td,.t1 th{border:1px solid #666;padding:10px;vertical-align:top}
        .t1 .section{background:#d8d8d8;font-weight:bold;font-size:20px}
        .t1 .label{font-weight:bold;width:25%;white-space:nowrap}
        .t1 .photo{width:180px;text-align:center;vertical-align:middle;font-weight:bold;font-size:26px;min-height:200px;height:200px;box-sizing:border-box}
        .t1 .blank{height:30px}
        .t1 .address{height:50px}
        .t1 .edu th{text-align:center}
        .t1 .edu td{height:55px}
        .t1 .edu{border-bottom:1px solid #666}
        .t1 .footer{border-top:2px solid #7b2020;margin-top:auto;padding-top:4px;text-align:center;font-size:9pt;line-height:1.4}
      `}</style>
      <div className="t1">
        <div className="header">
          <h1>Being Sevak Charitable Trust</h1>
          <div className="top-line"></div>
          <div className="subtitle">Public Charitable Trust (Reg.) E-31948 No, Income Tax Exempted Under 80G</div>
        </div>
        <div className="form-title">VOLUNTEER JOINING FORM</div>
        <table>
          <tr><td colSpan="3" className="section">PERSONAL DETAILS</td></tr>
          <tr>
            <td className="label">Name :</td>
            <td style={{fontWeight:600}}>{personal.fullName || ''}</td>
            <td rowSpan="5" className="photo">PHOTOGRAPH</td>
          </tr>
          <tr>
            <td className="label">Father's / Husband Name :</td>
            <td style={{fontWeight:600}}>{personal.fatherHusband || ''}</td>
          </tr>
          <tr>
            <td className="label">Correspondence Address :</td>
            <td style={{fontWeight:600}}>{personal.address || ''}</td>
          </tr>
          <tr><td colSpan="2" className="address"></td></tr>
          <tr>
            <td className="label">Permanent Address :</td>
            <td style={{fontWeight:600}}>{personal.permanentAddress || personal.address || ''}</td>
          </tr>
          <tr><td colSpan="2" className="address"></td></tr>
          <tr>
            <td><strong>Mobile 1 :</strong> {personal.altPhone || ''}</td>
            <td><strong>Mobile 2:</strong> {personal.phone || ''}</td>
            <td><strong>Email ID :</strong> {personal.email || ''}</td>
          </tr>
          <tr>
            <td><strong>Date of Birth :</strong> {personal.dob || ''}</td>
            <td><strong>Marital Status :</strong> {personal.maritalStatus || ''}</td>
            <td><strong>Gender :</strong> {personal.gender || ''}</td>
          </tr>
          <tr>
            <td><strong>PAN Card No :</strong> {personal.panNumber || ''}</td>
            <td><strong>Aadhaar Card No :</strong> {personal.aadhaarNumber || ''}</td>
            <td></td>
          </tr>
          <tr><td colSpan="3" className="section">EDUCATIONAL DETAILS (higher education)</td></tr>
        </table>
        <table className="edu">
          <tr>
            <th>Degree</th>
            <th>University / Institute</th>
            <th>From</th>
            <th>To</th>
            <th>Percentage / Grade</th>
            <th>Specialization</th>
          </tr>
          {education.length === 0 ? (
            <>{[...Array(1)].map((_, i) => <tr key={i}><td></td><td></td><td></td><td></td><td></td><td></td></tr>)}</>
          ) : (
            education.slice(0, 1).map((e, i) => (
              <tr key={i}>
                <td>{e.degree || ''}</td>
                <td>{e.institution || ''}</td>
                <td>{e.year || ''}</td>
                <td></td>
                <td>{e.percentage || ''}</td>
                <td></td>
              </tr>
            ))
          )}
          {education.length > 0 && education.length < 1 && [...Array(1 - education.length)].map((_, i) => (
            <tr key={`empty-${i}`}><td></td><td></td><td></td><td></td><td></td><td></td></tr>
          ))}
        </table>
        <table>
          <tr><td colSpan="6" className="section">VOLUNTEER DETAILS (PREVIOUS ORGANISATIONS / AFFILIATIONS)</td></tr>
          <tr>
            <th width="8%">Sr.No</th>
            <th>Organisation / Trust</th>
            <th>Role / Designation</th>
            <th>From</th>
            <th>To</th>
            <th>Duration</th>
          </tr>
          <tr>
            <td>1</td>
            <td style={{height:40}}></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
        </table>
        <table>
          <tr><td colSpan="5" className="section">FAMILY DETAILS / PERSONAL REFERENCE</td></tr>
          <tr><th width="8%">S.No</th><th>Name</th><th>Relation</th><th>Occupation</th><th>Date of Birth</th></tr>
          {[...Array(3)].map((_, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td style={{height:35}}></td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
          ))}
        </table>
        <div className="footer">
          Reg. Add.: Office No. 402, 4th Floor, 'A' Wing, New Delite Apartment, Near Chandavarkar Lane, Borivali (West), Mumbai.<br />
          Contact: 8879035035 / 8879034034 | E-mail: being.sevak@gmail.com | Website: www.beingsevak.org
        </div>
      </div>
    </div>
  );
}
