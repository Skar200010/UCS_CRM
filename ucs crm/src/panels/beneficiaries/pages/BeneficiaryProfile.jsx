import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useBnfBase } from '../bnfUi'
import { apiGet, apiPatch } from '../store'

const styles = {
  card: { background: 'var(--card-bg)', boxShadow: 'var(--shadow)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', padding: '20px', marginBottom: '16px' },
  tab: (active) => ({
    padding: '8px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: active ? 600 : 400,
    color: active ? 'var(--sage)' : 'var(--ink-soft)', borderBottom: active ? '2px solid var(--sage)' : '2px solid transparent',
    background: 'none', border: 'none', borderBottomWidth: '2px', borderBottomStyle: 'solid',
  }),
  field: { display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' },
  label: { fontSize: '12px', fontWeight: 600, color: 'var(--ink-soft)' },
  value: { fontSize: '14px', color: 'var(--ink)' },
  pill: (bg, fg) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: bg, color: fg }),
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' },
  input: { padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', fontSize: '13px', outline: 'none' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid var(--line)', fontWeight: 600, color: 'var(--ink-soft)', fontSize: '11px', textTransform: 'uppercase', background: 'var(--bg)' },
  td: { padding: '8px 12px', borderBottom: '1px solid var(--bg)' },
}

const TABS = ['Overview', 'Personal', 'Family', 'Education', 'Disability', 'Documents', 'Programs', 'Benefits', 'Identification', 'Activity']

const STATUS_COLORS = {
  ACTIVE: ['#dcfce7', '#166534'], INACTIVE: ['var(--bg)', 'var(--ink-soft)'], SUSPENDED: ['#fef3c7', '#92400e'],
  TRANSFERRED: ['#dbeafe', '#1e40af'], DECEASED: ['#fee2e2', '#991b1b'], DUPLICATE: ['#f3e8ff', '#6b21a8'],
}

function Field({ label, children }) {
  return <div style={styles.field}><label style={styles.label}>{label}</label><div style={styles.value}>{children || '-'}</div></div>
}

export default function BeneficiaryProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const base = useBnfBase()
  const [tab, setTab] = useState('Overview')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadBeneficiary() }, [id])

  const loadBeneficiary = async () => {
    try {
      const result = await apiGet(`/beneficiaries/${id}`)
      setData(result)
    } catch (e) {
      console.error('Failed to load beneficiary:', e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-soft)' }}>Loading...</div>
  if (!data) return <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626' }}>Beneficiary not found</div>

  const [bg, fg] = STATUS_COLORS[data.status] || ['var(--bg)', 'var(--ink-soft)']

  const renderTab = () => {
    switch (tab) {
      case 'Overview':
        return (
          <div>
            <div style={styles.grid3}>
              <Field label="Beneficiary Code"><code style={{ fontSize: '14px', fontWeight: 700 }}>{data.beneficiary_code}</code></Field>
              <Field label="Status"><span style={styles.pill(bg, fg)}>{data.status}</span></Field>
              <Field label="Registration Date">{data.registration_date}</Field>
              <Field label="Mobile">{data.mobile}</Field>
              <Field label="City">{data.city}</Field>
              <Field label="State">{data.state}</Field>
              <Field label="Fingerprint"><span style={styles.pill(
                data.fingerprint_status === 'REGISTERED' ? '#dcfce7' : '#fef3c7',
                data.fingerprint_status === 'REGISTERED' ? '#166534' : '#92400e'
              )}>{data.fingerprint_status}</span></Field>
              <Field label="Categories">{data.categories?.map(c => c.name).join(', ') || 'None'}</Field>
              <Field label="Created By">{data.created_by}</Field>
            </div>
          </div>
        )
      case 'Personal':
        return (
          <div style={styles.grid2}>
            <Field label="Full Name">{data.full_name}</Field>
            <Field label="First Name">{data.first_name}</Field>
            <Field label="Middle Name">{data.middle_name}</Field>
            <Field label="Last Name">{data.last_name}</Field>
            <Field label="Date of Birth">{data.date_of_birth}</Field>
            <Field label="Gender">{data.gender}</Field>
            <Field label="Email">{data.email}</Field>
            <Field label="Photo">{data.photo ? <img src={data.photo} alt="" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover' }} /> : '-'}</Field>
          </div>
        )
      case 'Family':
        return (
          <div>
            <div style={styles.grid2}>
              <Field label="Mother Name">{data.mother_name}</Field>
              <Field label="Father Name">{data.father_name}</Field>
              <Field label="Guardian Name">{data.guardian_name}</Field>
              <Field label="Guardian Occupation">{data.guardian_occupation}</Field>
              <Field label="Total Family Members">{data.total_family_members}</Field>
              <Field label="Monthly Income">{data.monthly_family_income}</Field>
              <Field label="Income Category">{data.income_category}</Field>
              <Field label="BPL">{data.bpl_available ? 'Yes' : 'No'}</Field>
            </div>
            {data.family?.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Family Members</h4>
                <table style={styles.table}>
                  <thead><tr><th style={styles.th}>Name</th><th style={styles.th}>Relationship</th><th style={styles.th}>DOB</th><th style={styles.th}>Occupation</th></tr></thead>
                  <tbody>{data.family.map((m, i) => <tr key={i}><td style={styles.td}>{m.name}</td><td style={styles.td}>{m.relationship}</td><td style={styles.td}>{m.date_of_birth}</td><td style={styles.td}>{m.occupation}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </div>
        )
      case 'Education':
        return (
          <div style={styles.grid2}>
            <Field label="Education Level">{data.education?.education_level}</Field>
            <Field label="Currently Studying">{data.education?.currently_studying ? 'Yes' : 'No'}</Field>
            <Field label="School / Institute">{data.education?.school_or_institute}</Field>
            <Field label="Grade / Course">{data.education?.grade || data.education?.course}</Field>
            <Field label="Skills">{data.education?.special_skills}</Field>
            <Field label="Training">{data.education?.training_details}</Field>
            <Field label="Employment Status">{data.employment?.employment_status}</Field>
            <Field label="Occupation">{data.employment?.occupation}</Field>
            <Field label="Employer">{data.employment?.employer}</Field>
            <Field label="Monthly Income">{data.employment?.monthly_income}</Field>
          </div>
        )
      case 'Disability':
        return (
          <div>
            {data.disabilities?.length === 0 ? <p style={{ color: 'var(--ink-soft)', fontSize: '13px' }}>No disability records</p> : (
              <table style={styles.table}>
                <thead><tr><th style={styles.th}>Type</th><th style={styles.th}>Percentage</th><th style={styles.th}>Certificate</th><th style={styles.th}>Authority</th></tr></thead>
                <tbody>{data.disabilities?.map((d, i) => <tr key={i}><td style={styles.td}>{d.disability_type}</td><td style={styles.td}>{d.disability_percentage}%</td><td style={styles.td}>{d.certificate_available ? 'Yes' : 'No'}</td><td style={styles.td}>{d.issuing_authority}</td></tr>)}</tbody>
              </table>
            )}
          </div>
        )
      case 'Documents':
        return (
          <div>
            {data.documents?.length === 0 ? <p style={{ color: 'var(--ink-soft)', fontSize: '13px' }}>No documents uploaded</p> : (
              <table style={styles.table}>
                <thead><tr><th style={styles.th}>Type</th><th style={styles.th}>File</th><th style={styles.th}>Status</th><th style={styles.th}>Uploaded</th></tr></thead>
                <tbody>{data.documents?.map((d, i) => <tr key={i}><td style={styles.td}>{d.document_type}</td><td style={styles.td}>{d.file_name || '-'}</td><td style={styles.td}>{d.verification_status}</td><td style={styles.td}>{d.uploaded_at}</td></tr>)}</tbody>
              </table>
            )}
          </div>
        )
      case 'Programs':
        return <div><p style={{ color: 'var(--ink-soft)', fontSize: '13px' }}>Program history will appear here</p></div>
      case 'Benefits':
        return (
          <div>
            {data.distributions?.length === 0 ? <p style={{ color: 'var(--ink-soft)', fontSize: '13px' }}>No distributions yet</p> : (
              <table style={styles.table}>
                <thead><tr><th style={styles.th}>Distribution #</th><th style={styles.th}>Date</th><th style={styles.th}>Program</th><th style={styles.th}>Status</th></tr></thead>
                <tbody>{data.distributions?.map((d, i) => <tr key={i}><td style={styles.td}>{d.distribution_number}</td><td style={styles.td}>{d.distribution_date}</td><td style={styles.td}>{d.bnf_programs?.title || '-'}</td><td style={styles.td}>{d.status}</td></tr>)}</tbody>
              </table>
            )}
          </div>
        )
      case 'Identification':
        return (
          <div style={styles.grid2}>
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>QR Card</h4>
              {data.activeCard ? (
                <div><p>Card: {data.activeCard.card_number}</p><p>Token: {data.activeCard.qr_token?.slice(0, 8)}...</p></div>
              ) : <p style={{ color: 'var(--ink-soft)', fontSize: '13px' }}>No card issued</p>}
            </div>
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Biometric</h4>
              <p>Status: {data.biometric?.status}</p>
              <p>Enrolled fingers: {data.biometric?.enrolled_fingers?.length || 0}</p>
            </div>
          </div>
        )
      case 'Activity':
        return <div><p style={{ color: 'var(--ink-soft)', fontSize: '13px' }}>Audit trail will appear here</p></div>
      default:
        return null
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <button onClick={() => navigate(base + '/all')} style={{ background: 'none', border: 'none', color: 'var(--sage)', cursor: 'pointer', fontSize: '13px', marginBottom: '4px' }}>← Back to list</button>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>{data.full_name}</h2>
          <div style={{ fontSize: '13px', color: 'var(--ink-soft)', marginTop: '4px' }}>
            <code style={{ background: 'var(--bg)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>{data.beneficiary_code}</code>
            <span style={{ marginLeft: '8px' }}><span style={styles.pill(bg, fg)}>{data.status}</span></span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--line)', marginBottom: '16px', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={styles.tab(tab === t)}>{t}</button>
        ))}
      </div>

      <div style={styles.card}>{renderTab()}</div>
    </div>
  )
}
