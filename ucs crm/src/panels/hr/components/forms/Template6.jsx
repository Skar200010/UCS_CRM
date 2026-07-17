export default function Template6() {
  return (
    <div className="print-page">
      <style>{`
        .t6 * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: "Times New Roman", Times, serif;
        }
        .t6 {
          width: 210mm;
          height: 297mm;
          margin: 40px auto 0;
          background: #fff;
          border: 8px double #000;
          padding: 12px 14px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .t6 h1 {
          text-align: center;
          font-size: 26px;
          font-weight: bold;
          margin-bottom: 4px;
        }
        .t6 .top-line {
          border-top: 3px solid #7d1e1e;
          margin: 6px 0 8px;
        }
        .t6 .subtitle {
          text-align: center;
          font-size: 10px;
          margin-bottom: 12px;
        }
        .t6 .form-title {
          text-align: center;
          font-size: 22px;
          font-weight: bold;
          text-decoration: underline;
          margin-bottom: 16px;
          color: #1f3f73;
        }
        .t6 p {
          margin: 8px 0;
          font-size: 13pt;
          line-height: 1.4;
          text-align: justify;
        }
        .t6 .agreement {
          margin: 12px 0;
          font-size: 13pt;
          font-weight: bold;
        }
        .t6 .two-column {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin: 10px 0;
        }
        .t6 .two-column ul {
          margin: 0;
          padding-left: 30px;
          list-style-type: disc;
        }
        .t6 .two-column li {
          margin-bottom: 8px;
          font-size: 13pt;
          line-height: 1.4;
        }
        .t6 .section {
          background: #d8d8d8;
          font-weight: bold;
          font-size: 15px;
          padding: 6px 8px;
          margin: 12px 0 8px;
        }
        .t6 .field {
          display: flex;
          align-items: center;
          margin: 8px 0;
          font-size: 13pt;
        }
        .t6 .label {
          font-weight: bold;
          min-width: 200px;
          padding-right: 8px;
          font-size: 13pt;
        }
        .t6 .line {
          flex: 1;
          border-bottom: 1px solid #000;
          height: 20px;
        }
        .t6 .two {
          display: flex;
          gap: 30px;
        }
        .t6 .two .field {
          flex: 1;
        }
        .t6 .footer {
          border-top: 2px solid #7b2020;
          margin-top: auto;
          padding-top: 8px;
          text-align: center;
          font-size: 8.5pt;
          line-height: 1.35;
        }
      `}</style>

      <div className="t6">
        <div className="header">
          <h1>Being Sevak Charitable Trust</h1>
          <div className="top-line"></div>
          <div className="subtitle">
            Public Charitable Trust (Reg.) E-31948 No. | Income Tax Exempted Under 80G
          </div>
        </div>

        <div className="form-title">
          VOLUNTEER PHOTO, VIDEO &amp; PUBLICITY CONSENT FORM
        </div>

        <p>
          I, ________________________, voluntarily authorize Being Sevak Charitable Trust ("the Trust") 
          to capture and use my photographs, videos, audio recordings, name, image, voice, and 
          testimonials for lawful purposes related to the Trust's charitable activities, including 
          awareness campaigns, fundraising, reports, publications, training, social media, website, 
          donor communications, and other promotional or educational materials.
        </p>

        <div className="agreement">I understand and agree that:</div>

        <div className="two-column">
          <ul>
            <li>My participation is voluntary, and I have no objection to the Trust using the above materials.</li>
            <li>I will not claim any royalty, payment, or compensation for such use.</li>
            <li>The Trust may edit or modify the materials without misrepresenting my identity or participation.</li>
          </ul>
          <ul>
            <li>All photographs, videos, and recordings created by or for the Trust shall remain the property of the Trust.</li>
            <li>I may withdraw my consent by giving written notice. Such withdrawal will apply only to future use, wherever reasonably practicable, and will not affect materials already published or distributed.</li>
          </ul>
        </div>

        <p>
          I confirm that I have read and understood this consent and agree to its terms. This consent shall be governed by the laws of India, and any disputes shall be subject to the jurisdiction of the courts at Mumbai, Maharashtra.
        </p>

        <div className="section">VOLUNTEER DETAILS</div>

        <div className="field">
          <span className="label">Volunteer Name:</span>
          <span className="line"></span>
        </div>

        <div className="field">
          <span className="label">Volunteer ID (if any):</span>
          <span className="line"></span>
        </div>

        <div className="field">
          <span className="label">Signature:</span>
          <span className="line"></span>
        </div>

        <div className="field">
          <span className="label">Date:</span>
          <span className="line"></span>
        </div>

        <div className="field">
          <span className="label">Place:</span>
          <span className="line"></span>
        </div>

        <div className="section">FOR VOLUNTEERS BELOW 18 YEARS</div>

        <p>
          I, ________________________, parent/legal guardian of the above volunteer, hereby give my consent on behalf of the minor.
        </p>

        <div className="field">
          <span className="label">Parent/Guardian Signature:</span>
          <span className="line"></span>
        </div>

        <div className="field">
          <span className="label">Date:</span>
          <span className="line"></span>
        </div>

        <div className="section">FOR BEING SEVAK CHARITABLE TRUST</div>

        <div style={{flex: 0.5}}></div>

        <div className="field">
          <span className="label">Authorized Signatory:</span>
          <span className="line" style={{flex: 'none', width: '200px'}}></span>
        </div>

        <div className="footer">
          Reg. Add.: Office No. 402, 4th Floor, "A" Wing, New Delite Apartment, Near Chandavarkar Lane, Borivali (West), Mumbai – 400092<br />
          Contact: 8879035035 / 8879034034 | E-mail: being.sevak@gmail.com | Website: www.beingsevak.org
        </div>
      </div>
    </div>
  );
}