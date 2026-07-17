export default function Template1({ personal, education, family, photo_url }) {
  return (
    <div className="print-page">
      <style>{`
        .t1 *{margin:0;padding:0;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}
        .t1{width:210mm;height:297mm;margin:40px auto 0;background:#fff;border:8px double #000;padding:12px 14px;overflow:hidden;display:flex;flex-direction:column}
        .t1 h1{text-align:center;font-size:34px;font-family:Georgia,serif;margin-bottom:0}
        .t1 .subtitle{text-align:center;font-size:10px;margin-bottom:2px}
        .t1 .top-line{border-top:3px solid #7d1e1e;margin:3px 0}
        .t1 .form-title{text-align:center;font-size:24px;font-weight:bold;text-decoration:underline;margin-bottom:12px}
        .t1 table{width:100%;border-collapse:collapse}
        .t1 td,.t1 th{border:1px solid #666;padding:12px 8px;vertical-align:top}
        .t1 .section{background:#d8d8d8;font-weight:bold;font-size:18px}
        .t1 .label{font-weight:bold;width:25%;white-space:nowrap}
        .t1 .photo{width:100px;text-align:center;vertical-align:middle;font-weight:bold;font-size:27px;min-height:220px;height:220px;box-sizing:border-box}
        .t1 .blank{height:24px}
        .t1 .address{height:40px}
        .t1 .edu th{text-align:center}
        .t1 .edu td{height:45px}
        .t1 .edu{border-bottom:1px solid #666}
        .t1 .footer{border-top:2px solid #7b2020;margin-top:auto;padding-top:3px;text-align:center;font-size:8pt;line-height:1.3}
      `}</style>
      <div className="t1">
        <div className="header">
          <h1>Being Sevak Charitable Trust</h1>
          <div className="top-line"></div>
          <div className="subtitle">Public Charitable Trust (Reg.) E-31948 No, Income Tax Exempted Under 80G</div>
        </div>
        <div className="form-title">VOLUNTEER JOINING FORM</div>
        <table>
          <tbody>
          <tr><td colSpan="3" className="section">PERSONAL DETAILS</td></tr>
          <tr>
            <td className="label">Name :</td>
            <td style={{fontWeight:600}}>{personal.fullName || ''}</td>
            <td rowSpan="4" className="photo" style={{padding:0}}>{photo_url ? <img src={photo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} /> : 'PHOTOGRAPH'}</td>
          </tr>
          <tr>
            <td className="label">Father's / Husband Name :</td>
            <td style={{fontWeight:600}}>{personal.fatherHusband || ''}</td>
          </tr>
          <tr>
            <td className="label" style={{height:65}}>Correspondence Address :</td>
            <td style={{fontWeight:600, height:65}}>{personal.address || ''}</td>
          </tr>
          <tr>
            <td className="label" style={{height:65}}>Permanent Address :</td>
            <td style={{fontWeight:600, height:65}}>{personal.permanentAddress || personal.address || ''}</td>
          </tr>
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
          </tbody>
        </table>
        <table className="edu">
          <tbody>
          <tr>
            <th>Degree</th>
            <th>University / Institute</th>
            <th width="14%">From</th>
            <th width="14%">To</th>
            <th width="10%">%</th>
          </tr>
          {education.length === 0 ? (
            <>{[...Array(1)].map((_, i) => <tr key={i}><td></td><td></td><td></td><td></td><td></td></tr>)}</>
          ) : (
            education.slice(0, 1).map((e, i) => (
              <tr key={i}>
                <td>{e.degree || ''}</td>
                <td>{e.institution || ''}</td>
                <td colSpan="2">{(e.year_of_passing || e.year || '').toString()}</td>
                <td>{e.percentage || ''}</td>
              </tr>
            ))
          )}
          {education.length > 0 && education.length < 1 && [...Array(1 - education.length)].map((_, i) => (
            <tr key={`empty-${i}`}><td></td><td></td><td></td><td></td><td></td></tr>
          ))}
          </tbody>
        </table>
        <table>
          <tbody>
          <tr><td colSpan="6" className="section">VOLUNTEER DETAILS (PREVIOUS ORGANISATIONS / AFFILIATIONS)</td></tr>
          <tr>
            <th width="8%">Sr.No</th>
            <th>Organisation / Trust</th>
            <th>Role / Designation</th>
            <th width="14%">From</th>
            <th width="14%">To</th>
            <th>Duration</th>
          </tr>
          <tr>
            <td style={{textAlign:'center'}}>1</td>
            <td style={{height:40}}></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          </tbody>
        </table>
        <table>
          <tbody>
          <tr><td colSpan="5" className="section">FAMILY DETAILS / PERSONAL REFERENCE</td></tr>
          <tr><th width="8%">S.No</th><th>Name</th><th>Relation</th><th>Occupation</th><th>Mobile No</th></tr>
          {(family && family.length > 0 ? family.slice(0, 3) : [...Array(3)]).map((f, i) => (
            <tr key={i}>
              <td style={{textAlign:'center'}}>{i + 1}</td>
              <td style={{height:35}}></td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
          ))}
          </tbody>
        </table>
        <div className="footer">
          Reg. Add.: Office No. 402, 4th Floor, 'A' Wing, New Delite Apartment, Near Chandavarkar Lane, Borivali (West), Mumbai.<br />
          Contact: 8879035035 / 8879034034 | E-mail: being.sevak@gmail.com | Website: www.beingsevak.org
        </div>
      </div>
    </div>
  );
}
