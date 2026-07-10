import { useState } from 'react';
import { useHR } from '../store';
import { Dropdown } from './ui';
import { Plus, Trash } from '../icons';

const GENDERS = ['Male', 'Female', 'Other'];
const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed'];
const SECTIONS = ['Personal Details', 'Education', 'Previous Organizations', 'Family', 'References', 'Bank Details'];

function Field({ label, type = 'text', value, onChange, placeholder, required, ...rest }) {
  return (
    <label className="field">
      {label}{required && ' *'}
      {type === 'textarea' ? (
        <textarea value={value} onChange={onChange} placeholder={placeholder} rows={3} style={{padding:'9px 11px',border:'1px solid var(--line)',borderRadius:'var(--radius-sm)',fontSize:14,fontFamily:'inherit',outline:'none',background:'var(--paper)',color:'var(--ink)',resize:'vertical',width:'100%',boxSizing:'border-box'}} {...rest} />
      ) : type === 'select' ? (
        <Dropdown value={value} onChange={onChange} options={rest.options || []} />
      ) : (
        <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{padding:'9px 11px',border:'1px solid var(--line)',borderRadius:'var(--radius-sm)',fontSize:14,fontFamily:'inherit',outline:'none',background:'var(--paper)',color:'var(--ink)',width:'100%',boxSizing:'border-box'}} {...rest} />
      )}
    </label>
  );
}

function EducationEntry({ entry, index, onChange, onRemove }) {
  return (
    <div className="card" style={{ padding: 16, marginBottom: 12, boxShadow: 'none', border: '1px solid var(--line)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
        <strong>Entry {index + 1}</strong>
        {onRemove && <button className="btn" onClick={onRemove} style={{ color:'#dc2626', padding:'4px 8px' }}><Trash width={14} /></button>}
      </div>
      <div className="form-row">
        <Field label="Degree" required value={entry.degree} onChange={e => onChange(index, 'degree', e.target.value)} placeholder="e.g., B.Sc, B.Com, MBA" />
        <Field label="Institution" required value={entry.institution} onChange={e => onChange(index, 'institution', e.target.value)} placeholder="College / School name" />
      </div>
      <div className="form-row">
        <Field label="University" value={entry.university} onChange={e => onChange(index, 'university', e.target.value)} placeholder="University name" />
        <Field label="Year" value={entry.year} onChange={e => onChange(index, 'year', e.target.value)} placeholder="e.g., 2020" />
      </div>
      <Field label="Percentage / Grade" value={entry.percentage} onChange={e => onChange(index, 'percentage', e.target.value)} placeholder="e.g., 85% or A+" />
    </div>
  );
}

function OrganizationEntry({ entry, index, onChange, onRemove }) {
  return (
    <div className="card" style={{ padding: 16, marginBottom: 12, boxShadow: 'none', border: '1px solid var(--line)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
        <strong>Organization {index + 1}</strong>
        {onRemove && <button className="btn" onClick={onRemove} style={{ color:'#dc2626', padding:'4px 8px' }}><Trash width={14} /></button>}
      </div>
      <div className="form-row">
        <Field label="Organization Name" required value={entry.name} onChange={e => onChange(index, 'name', e.target.value)} placeholder="Company / Organization name" />
        <Field label="Role / Designation" value={entry.role} onChange={e => onChange(index, 'role', e.target.value)} placeholder="Your job title" />
      </div>
      <div className="form-row">
        <Field label="From Year" value={entry.fromYear} onChange={e => onChange(index, 'fromYear', e.target.value)} placeholder="e.g., 2020" />
        <Field label="To Year" value={entry.toYear} onChange={e => onChange(index, 'toYear', e.target.value)} placeholder="e.g., 2023" />
      </div>
    </div>
  );
}

function FamilyEntry({ entry, index, onChange, onRemove }) {
  return (
    <div className="card" style={{ padding: 16, marginBottom: 12, boxShadow: 'none', border: '1px solid var(--line)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
        <strong>Member {index + 1}</strong>
        {onRemove && <button className="btn" onClick={onRemove} style={{ color:'#dc2626', padding:'4px 8px' }}><Trash width={14} /></button>}
      </div>
      <div className="form-row">
        <Field label="Name" required value={entry.name} onChange={e => onChange(index, 'name', e.target.value)} placeholder="Full name" />
        <Field label="Relationship" required value={entry.relationship} onChange={e => onChange(index, 'relationship', e.target.value)} placeholder="e.g., Father, Mother" />
      </div>
      <div className="form-row">
        <Field label="Occupation" value={entry.occupation} onChange={e => onChange(index, 'occupation', e.target.value)} placeholder="Optional" />
        <Field label="Phone" value={entry.phone} onChange={e => onChange(index, 'phone', e.target.value)} placeholder="Optional" />
      </div>
      <Field label="Date of Birth" type="date" value={entry.dob} onChange={e => onChange(index, 'dob', e.target.value)} />
    </div>
  );
}

function ReferenceEntry({ entry, index, onChange, onRemove }) {
  return (
    <div className="card" style={{ padding: 16, marginBottom: 12, boxShadow: 'none', border: '1px solid var(--line)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
        <strong>Reference {index + 1}</strong>
        {onRemove && <button className="btn" onClick={onRemove} style={{ color:'#dc2626', padding:'4px 8px' }}><Trash width={14} /></button>}
      </div>
      <div className="form-row">
        <Field label="Name" required value={entry.name} onChange={e => onChange(index, 'name', e.target.value)} placeholder="Full name" />
        <Field label="Designation" value={entry.designation} onChange={e => onChange(index, 'designation', e.target.value)} placeholder="Job title" />
      </div>
      <div className="form-row">
        <Field label="Organization" value={entry.organization} onChange={e => onChange(index, 'organization', e.target.value)} placeholder="Company name" />
        <Field label="Phone" value={entry.phone} onChange={e => onChange(index, 'phone', e.target.value)} placeholder="Contact number" />
      </div>
    </div>
  );
}

export default function HRForms() {
  const { fetchWorkers } = useHR();
  const [section, setSection] = useState(SECTIONS[0]);

  const [personal, setPersonal] = useState({
    fullName: '', email: '', phone: '', altPhone: '', fatherHusband: '',
    gender: 'Male', dob: '', maritalStatus: 'Single',
    address: '', city: '', state: '', pincode: '',
    panNumber: '', aadhaarNumber: '', permanentAddress: '',
    emergencyName: '', emergencyRelation: '', emergencyPhone: '',
  });

  const [education, setEducation] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [family, setFamily] = useState([]);
  const [references, setReferences] = useState([]);

  const [bank, setBank] = useState({
    bankName: '', accountHolder: '', ifsc: '', accountNo: '',
  });

  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');

  const handlePersonalChange = (field, value) => {
    setPersonal(prev => ({ ...prev, [field]: value }));
  };

  const handleEducationChange = (index, field, value) => {
    setEducation(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e));
  };

  const handleOrganizationChange = (index, field, value) => {
    setOrganizations(prev => prev.map((o, i) => i === index ? { ...o, [field]: value } : o));
  };

  const handleFamilyChange = (index, field, value) => {
    setFamily(prev => prev.map((f, i) => i === index ? { ...f, [field]: value } : f));
  };

  const handleReferenceChange = (index, field, value) => {
    setReferences(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const renderSection = () => {
    switch (section) {
      case 'Personal Details':
        return (
          <>
            <div className="card-head"><h3>Basic Information</h3>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search fields..." style={{ padding:'5px 9px', border:'1px solid var(--line)', borderRadius:'var(--radius-sm)', fontSize:13, fontFamily:'inherit', outline:'none', background:'var(--paper)', color:'var(--ink)', width:200 }} />
            </div>
            <div className="card-pad">
              <div className="form-row">
                <Field label="Full Name" required value={personal.fullName} onChange={e => handlePersonalChange('fullName', e.target.value)} placeholder="Enter full name" />
                <Field label="Email" required type="email" value={personal.email} onChange={e => handlePersonalChange('email', e.target.value)} placeholder="Enter email" />
              </div>
              <div className="form-row">
                <Field label="Phone" required value={personal.phone} onChange={e => handlePersonalChange('phone', e.target.value)} placeholder="10-digit number" />
                <Field label="Alt. Phone" value={personal.altPhone} onChange={e => handlePersonalChange('altPhone', e.target.value)} placeholder="Optional" />
              </div>
              <Field label="Father / Husband Name" value={personal.fatherHusband} onChange={e => handlePersonalChange('fatherHusband', e.target.value)} placeholder="Enter father or husband name" />
            </div>

            <div className="card-head"><h3>Personal Info</h3></div>
            <div className="card-pad">
              <div className="form-row">
                <Field label="Gender" type="select" value={personal.gender} onChange={e => handlePersonalChange('gender', e.target.value)} options={GENDERS.map(g => ({ value: g, label: g }))} />
                <Field label="Date of Birth" type="date" value={personal.dob} onChange={e => handlePersonalChange('dob', e.target.value)} />
              </div>
              <Field label="Marital Status" type="select" value={personal.maritalStatus} onChange={e => handlePersonalChange('maritalStatus', e.target.value)} options={MARITAL_STATUSES.map(m => ({ value: m, label: m }))} />
            </div>

            <div className="card-head"><h3>Address</h3></div>
            <div className="card-pad">
              <Field label="Address" value={personal.address} onChange={e => handlePersonalChange('address', e.target.value)} placeholder="Street, area, landmark" />
              <div className="form-row">
                <Field label="City" value={personal.city} onChange={e => handlePersonalChange('city', e.target.value)} placeholder="City" />
                <Field label="State" value={personal.state} onChange={e => handlePersonalChange('state', e.target.value)} placeholder="State" />
              </div>
              <Field label="Pincode" value={personal.pincode} onChange={e => handlePersonalChange('pincode', e.target.value)} placeholder="6-digit pincode" />
            </div>

            <div className="card-head"><h3>Identity Numbers</h3></div>
            <div className="card-pad">
              <div className="form-row">
                <Field label="PAN Number" value={personal.panNumber} onChange={e => handlePersonalChange('panNumber', e.target.value)} placeholder="e.g., ABCDE1234F" />
                <Field label="Aadhaar Number" value={personal.aadhaarNumber} onChange={e => handlePersonalChange('aadhaarNumber', e.target.value)} placeholder="12-digit number" />
              </div>
              <Field label="Permanent Address" value={personal.permanentAddress} onChange={e => handlePersonalChange('permanentAddress', e.target.value)} placeholder="If different from current address" />
            </div>

            <div className="card-head"><h3>Emergency Contact</h3></div>
            <div className="card-pad">
              <Field label="Contact Person Name" value={personal.emergencyName} onChange={e => handlePersonalChange('emergencyName', e.target.value)} placeholder="Full name" />
              <div className="form-row">
                <Field label="Relationship" value={personal.emergencyRelation} onChange={e => handlePersonalChange('emergencyRelation', e.target.value)} placeholder="e.g., Spouse, Parent" />
                <Field label="Phone" value={personal.emergencyPhone} onChange={e => handlePersonalChange('emergencyPhone', e.target.value)} placeholder="Contact number" />
              </div>
            </div>
          </>
        );

      case 'Education':
        return (
          <>
            <div className="card-head"><h3>Educational Qualifications</h3>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search fields..." style={{ padding:'5px 9px', border:'1px solid var(--line)', borderRadius:'var(--radius-sm)', fontSize:13, fontFamily:'inherit', outline:'none', background:'var(--paper)', color:'var(--ink)', width:200 }} />
            </div>
            <div className="card-pad">
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--ink-soft)' }}>Add your educational background</p>
              {education.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-soft)' }}>
                  <p>No education entries added yet</p>
                </div>
              )}
              {education.map((entry, i) => (
                <EducationEntry key={i} entry={entry} index={i} onChange={handleEducationChange} onRemove={education.length > 1 ? () => setEducation(prev => prev.filter((_, idx) => idx !== i)) : undefined} />
              ))}
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <button className="btn" onClick={() => setEducation(prev => [...prev, { degree: '', institution: '', university: '', year: '', percentage: '' }])} style={{ gap: 6 }}>
                  <Plus width={14} /> Add Education
                </button>
              </div>
            </div>
          </>
        );

      case 'Previous Organizations':
        return (
          <>
            <div className="card-head"><h3>Previous Organizations</h3>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search fields..." style={{ padding:'5px 9px', border:'1px solid var(--line)', borderRadius:'var(--radius-sm)', fontSize:13, fontFamily:'inherit', outline:'none', background:'var(--paper)', color:'var(--ink)', width:200 }} />
            </div>
            <div className="card-pad">
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--ink-soft)' }}>Add your previous work experience (if any)</p>
              {organizations.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-soft)' }}>
                  <p>No previous organizations added</p>
                </div>
              )}
              {organizations.map((entry, i) => (
                <OrganizationEntry key={i} entry={entry} index={i} onChange={handleOrganizationChange} onRemove={() => setOrganizations(prev => prev.filter((_, idx) => idx !== i))} />
              ))}
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <button className="btn" onClick={() => setOrganizations(prev => [...prev, { name: '', role: '', fromYear: '', toYear: '' }])} style={{ gap: 6 }}>
                  <Plus width={14} /> Add Organization
                </button>
              </div>
            </div>
          </>
        );

      case 'Family':
        return (
          <>
            <div className="card-head"><h3>Family Details</h3>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search fields..." style={{ padding:'5px 9px', border:'1px solid var(--line)', borderRadius:'var(--radius-sm)', fontSize:13, fontFamily:'inherit', outline:'none', background:'var(--paper)', color:'var(--ink)', width:200 }} />
            </div>
            <div className="card-pad">
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--ink-soft)' }}>Add your family members</p>
              {family.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-soft)' }}>
                  <p>No family members added yet</p>
                </div>
              )}
              {family.map((entry, i) => (
                <FamilyEntry key={i} entry={entry} index={i} onChange={handleFamilyChange} onRemove={() => setFamily(prev => prev.filter((_, idx) => idx !== i))} />
              ))}
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <button className="btn" onClick={() => setFamily(prev => [...prev, { name: '', relationship: '', occupation: '', phone: '', dob: '' }])} style={{ gap: 6 }}>
                  <Plus width={14} /> Add Family Member
                </button>
              </div>
            </div>
          </>
        );

      case 'References':
        return (
          <>
            <div className="card-head"><h3>Professional References</h3>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search fields..." style={{ padding:'5px 9px', border:'1px solid var(--line)', borderRadius:'var(--radius-sm)', fontSize:13, fontFamily:'inherit', outline:'none', background:'var(--paper)', color:'var(--ink)', width:200 }} />
            </div>
            <div className="card-pad">
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--ink-soft)' }}>Add professional references</p>
              {references.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-soft)' }}>
                  <p>No references added yet</p>
                </div>
              )}
              {references.map((entry, i) => (
                <ReferenceEntry key={i} entry={entry} index={i} onChange={handleReferenceChange} onRemove={() => setReferences(prev => prev.filter((_, idx) => idx !== i))} />
              ))}
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <button className="btn" onClick={() => setReferences(prev => [...prev, { name: '', designation: '', organization: '', phone: '' }])} style={{ gap: 6 }}>
                  <Plus width={14} /> Add Reference
                </button>
              </div>
            </div>
          </>
        );

      case 'Bank Details':
        return (
          <>
            <div className="card-head"><h3>Bank Account Details</h3>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search fields..." style={{ padding:'5px 9px', border:'1px solid var(--line)', borderRadius:'var(--radius-sm)', fontSize:13, fontFamily:'inherit', outline:'none', background:'var(--paper)', color:'var(--ink)', width:200 }} />
            </div>
            <div className="card-pad">
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--ink-soft)' }}>These details will be used for salary disbursement</p>
              <div className="form-row">
                <Field label="Bank Name" required value={bank.bankName} onChange={e => setBank(prev => ({ ...prev, bankName: e.target.value }))} placeholder="e.g., State Bank of India" />
                <Field label="Account Holder Name" required value={bank.accountHolder} onChange={e => setBank(prev => ({ ...prev, accountHolder: e.target.value }))} placeholder="As per bank records" />
              </div>
              <div className="form-row">
                <Field label="IFSC Code" required value={bank.ifsc} onChange={e => setBank(prev => ({ ...prev, ifsc: e.target.value }))} placeholder="e.g., SBIN0001234" />
                <Field label="Account Number" required value={bank.accountNo} onChange={e => setBank(prev => ({ ...prev, accountNo: e.target.value }))} placeholder="Your bank account number" />
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="card">
      <div className="card-head"><h3>HR Forms</h3><span className="sub">Employee onboarding form</span></div>
      <div className="card-pad">
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {SECTIONS.map(s => (
            <button key={s} className={`btn ${section === s ? 'btn-primary' : ''}`} onClick={() => setSection(s)} style={{ fontSize: 13 }}>
              {s}
            </button>
          ))}
        </div>

        {renderSection()}

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-primary" onClick={handleSave} style={{ gap: 6 }}>
            {saved ? 'Saved!' : 'Save Form'}
          </button>
        </div>
      </div>
    </div>
  );
}
