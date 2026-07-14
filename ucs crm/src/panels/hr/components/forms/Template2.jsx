export default function Template2({ organizations, family, references, declarationDate, place }) {
  return (
    <div className="print-page">
      <style>{`
        .t2 *{margin:0;padding:0;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}
        .t2{width:210mm;min-height:297mm;margin:auto;background:#fff;border:8px double #000;padding:14px 18px;page-break-after:always}
        .t2 .header{text-align:center}
        .t2 .header h1{font-family:Georgia,serif;font-size:36px}
        .t2 .header p{font-size:11px;margin-bottom:4px}
        .t2 .top-line{border-top:3px solid #7d1e1e;margin:4px 0}
        .t2 table{width:100%;border-collapse:collapse}
        .t2 th,.t2 td{border:1px solid #666;padding:5px;font-size:12px}
        .t2 .section{background:#d8d8d8;font-weight:bold;font-size:15px;text-transform:uppercase}
        .t2 .center{text-align:center}
        .t2 .work td{height:32px}
        .t2 .family td{height:30px}
        .t2 .reference td{height:28px}
        .t2 .declaration{border:1px solid #666;border-top:none;padding:12px;min-height:60px}
        .t2 .declaration p{font-size:13px;line-height:1.4;text-align:justify}
        .t2 .signature{margin-top:12px;display:flex;justify-content:space-between;align-items:flex-end}
        .t2 .left{width:45%}
        .t2 .left div{margin:10px 0;font-size:14px;font-weight:bold}
        .t2 .line{display:inline-block;width:200px;border-bottom:2px solid #555;font-size:13px;padding-left:4px}
        .t2 .right{width:40%;display:flex;align-items:center;gap:10px}
        .t2 .signbox{width:200px;height:60px;border:2px solid #333;border-radius:12px}
        .t2 .footer{border-top:2px solid #7b2020;margin-top:6px;padding-top:4px;text-align:center;font-size:9pt;line-height:1.4}
      `}</style>
      <div className="t2">
        <div className="header">
          <h1>Being Sevak Charitable Trust</h1>
          <div className="top-line"></div>
          <p>Public Charitable Trust (Reg.) E-31948 No, Income Tax Exempted Under 80G</p>
        </div>

        <table className="work">
          <tr><td colSpan="6" className="section">VOLUNTEER DETAILS (LAST THREE ORGANISATIONS)</td></tr>
          <tr>
            <th rowSpan="2" width="8%">Sr.No</th>
            <th rowSpan="2">Organization</th>
            <th rowSpan="2">Designation</th>
            <th colSpan="2">Period of Service</th>
            <th rowSpan="2">Annual CTC</th>
          </tr>
          <tr><th>From</th><th>To</th></tr>
          {[...Array(3)].map((_, i) => (
            <tr key={i}>
              <td className="center">{i + 1}</td>
              <td>{organizations[i]?.name || ''}</td>
              <td>{organizations[i]?.role || ''}</td>
              <td>{organizations[i]?.fromYear || ''}</td>
              <td>{organizations[i]?.toYear || ''}</td>
              <td></td>
            </tr>
          ))}
        </table>

        <table className="family">
          <tr><td colSpan="5" className="section">FAMILY DETAILS</td></tr>
          <tr><th width="8%">S.No</th><th>Name</th><th>Relation</th><th>Occupation</th><th>Date of Birth</th></tr>
          {[...Array(5)].map((_, i) => (
            <tr key={i}>
              <td className="center">{i + 1}</td>
              <td>{family[i]?.name || ''}</td>
              <td>{family[i]?.relationship || ''}</td>
              <td>{family[i]?.occupation || ''}</td>
              <td>{family[i]?.dob || ''}</td>
            </tr>
          ))}
        </table>

        <table className="reference">
          <tr><td colSpan="3" className="section">PROFESSIONAL REFERENCES</td></tr>
          <tr>
            <th style={{width:'28%', textAlign:'left'}}></th>
            <th style={{width:'36%', textAlign:'center'}}>Reference 1</th>
            <th style={{width:'36%', textAlign:'center'}}>Reference 2</th>
          </tr>
          <tr><td><strong>Name :</strong></td><td>{references[0]?.name || ''}</td><td>{references[1]?.name || ''}</td></tr>
          <tr><td><strong>Organization :</strong></td><td>{references[0]?.organization || ''}</td><td>{references[1]?.organization || ''}</td></tr>
          <tr><td><strong>Designation :</strong></td><td>{references[0]?.designation || ''}</td><td>{references[1]?.designation || ''}</td></tr>
          <tr><td><strong>Contact No :</strong></td><td>{references[0]?.phone || ''}</td><td>{references[1]?.phone || ''}</td></tr>
        </table>

        <table><tr><td className="section">DECLARATION</td></tr></table>
        <div className="declaration">
          <p>I hereby declare that the above statements made in my application form are true, complete and correct to the best of my knowledge and belief. In the event of any information being found false or incorrect at any stage, my services are liable to be terminated without notice.</p>
          <div className="signature">
            <div className="left">
              <div>Date : <span className="line">{declarationDate || ''}</span></div>
              <div>Place : <span className="line">{place || ''}</span></div>
            </div>
            <div className="right">
              <strong style={{fontSize:22}}>Sign:</strong>
              <div className="signbox"></div>
            </div>
          </div>
        </div>

        <div className="footer">
          Reg. Add.: Office No. 402, 4th Floor, 'A' Wing, New Delite Apartment, Near Chandavarkar Lane, Borivali (West), Mumbai.<br />
          Contact: 8879035035 / 8879034034 | E-mail: being.sevak@gmail.com | Website: www.beingsevak.org
        </div>
      </div>
    </div>
  );
}
