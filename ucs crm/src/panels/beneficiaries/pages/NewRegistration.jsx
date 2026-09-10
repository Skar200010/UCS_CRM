import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBnfBase } from '../bnfUi'
import { apiGet, apiPost } from '../store'

const styles = {
  card: { background: 'var(--card-bg)', boxShadow: 'var(--shadow)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', padding: '24px', marginBottom: '16px' },
  title: { fontSize: '18px', fontWeight: 700, color: 'var(--ink)', marginBottom: '16px' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontSize: '12px', fontWeight: 600, color: 'var(--ink)' },
  input: { padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', fontSize: '13px', outline: 'none' },
  select: { padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', fontSize: '13px', outline: 'none', background: 'var(--card-bg)' },
  textarea: { padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', fontSize: '13px', outline: 'none', minHeight: '60px', resize: 'vertical' },
  btn: { padding: '10px 20px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 500 },
  btnPrimary: { background: 'var(--sage)', color: '#fff' },
  btnSecondary: { background: 'var(--bg)', color: 'var(--ink)' },
  stepBar: { display: 'flex', gap: '4px', marginBottom: '24px' },
  step: (active, done) => ({
    flex: 1, height: '4px', borderRadius: '2px',
    background: done ? 'var(--sage)' : active ? '#93c5fd' : 'var(--line)',
  }),
  stepLabel: { fontSize: '11px', color: 'var(--ink-soft)', textAlign: 'center', marginBottom: '8px' },
}

const STEPS = [
  { key: 'personal', label: 'Personal' },
  { key: 'contact', label: 'Contact' },
  { key: 'address', label: 'Address' },
  { key: 'family', label: 'Family' },
  { key: 'education', label: 'Education' },
  { key: 'disability', label: 'Disability' },
  { key: 'documents', label: 'Documents' },
  { key: 'review', label: 'Review' },
]

const GENDER_OPTIONS = ['', 'Male', 'Female', 'Other']
const INCOME_CATEGORIES = ['', 'Below ₹5,000', '₹5,000–₹10,000', 'Above ₹10,000', 'Not Provided']
const DISABILITY_TYPES = ['Visual Impairment', 'Locomotor Disability', 'Hearing Impairment', 'Speech Impairment', 'Multiple Disabilities', 'Other']
const ASSISTANCE_TYPES = ['House Repairing', 'Skill Training', 'Assistive Devices', 'Education Support', 'Livelihood', 'Medical Support', 'Financial Assistance', 'Other']
const EDUCATION_LEVELS = ['', 'No Formal Education', 'Primary', 'Secondary', 'Higher Secondary', 'Graduate', 'Post Graduate', 'Professional', 'Other']
const EMPLOYMENT_STATUSES = ['', 'Employed', 'Self-Employed', 'Unemployed', 'Retired', 'Student', 'Other']

function Field({ label, children, span }) {
  return (
    <div style={{ ...styles.field, gridColumn: span ? `span ${span}` : undefined }}>
      <label style={styles.label}>{label}</label>
      {children}
    </div>
  )
}

export default function NewRegistration() {
  const navigate = useNavigate()
  const base = useBnfBase()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({
    full_name: '', first_name: '', middle_name: '', last_name: '',
    date_of_birth: '', gender: '', mobile: '', alternate_mobile: '', email: '',
    address_line_1: '', address_line_2: '', area: '', city: '', district: '', state: '', pincode: '',
    photo: '', monthly_family_income: '', income_category: '', bpl_available: false, ration_card_available: false,
    occupation: '', mother_name: '', father_name: '', guardian_name: '', guardian_occupation: '', total_family_members: '',
    category_ids: [], disabilities: [], family_members: [], assistance_requirements: [],
    education_level: '', currently_studying: false, school_or_institute: '', grade: '', course: '', special_skills: '',
    employment_status: '', employer: '', monthly_income: '',
  })

  useEffect(() => {
    apiGet('/beneficiaries/search?q=').catch(() => {})
  }, [])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const result = await apiPost('/beneficiaries', form)
      navigate(base + `/${result.beneficiary?.id || ''}`)
    } catch (e) {
      alert('Error: ' + (e.message || 'Failed to create beneficiary'))
    } finally {
      setSaving(false)
    }
  }

  const renderStep = () => {
    switch (STEPS[step].key) {
      case 'personal':
        return (
          <div style={styles.grid}>
            <Field label="Full Name *" span={2}>
              <input style={styles.input} value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Full name" />
            </Field>
            <Field label="First Name"><input style={styles.input} value={form.first_name} onChange={e => set('first_name', e.target.value)} /></Field>
            <Field label="Middle Name"><input style={styles.input} value={form.middle_name} onChange={e => set('middle_name', e.target.value)} /></Field>
            <Field label="Last Name"><input style={styles.input} value={form.last_name} onChange={e => set('last_name', e.target.value)} /></Field>
            <Field label="Date of Birth"><input type="date" style={styles.input} value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} /></Field>
            <Field label="Gender">
              <select style={styles.select} value={form.gender} onChange={e => set('gender', e.target.value)}>
                {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g || 'Select...'}</option>)}
              </select>
            </Field>
            <Field label="Photo URL"><input style={styles.input} value={form.photo} onChange={e => set('photo', e.target.value)} placeholder="Photo URL" /></Field>
          </div>
        )
      case 'contact':
        return (
          <div style={styles.grid}>
            <Field label="Mobile *"><input style={styles.input} value={form.mobile} onChange={e => set('mobile', e.target.value)} placeholder="Mobile number" /></Field>
            <Field label="Alternate Mobile"><input style={styles.input} value={form.alternate_mobile} onChange={e => set('alternate_mobile', e.target.value)} /></Field>
            <Field label="Email"><input type="email" style={styles.input} value={form.email} onChange={e => set('email', e.target.value)} /></Field>
          </div>
        )
      case 'address':
        return (
          <div style={styles.grid}>
            <Field label="Address Line 1" span={2}><input style={styles.input} value={form.address_line_1} onChange={e => set('address_line_1', e.target.value)} /></Field>
            <Field label="Address Line 2" span={2}><input style={styles.input} value={form.address_line_2} onChange={e => set('address_line_2', e.target.value)} /></Field>
            <Field label="Area"><input style={styles.input} value={form.area} onChange={e => set('area', e.target.value)} /></Field>
            <Field label="City"><input style={styles.input} value={form.city} onChange={e => set('city', e.target.value)} /></Field>
            <Field label="District"><input style={styles.input} value={form.district} onChange={e => set('district', e.target.value)} /></Field>
            <Field label="State"><input style={styles.input} value={form.state} onChange={e => set('state', e.target.value)} /></Field>
            <Field label="Pincode"><input style={styles.input} value={form.pincode} onChange={e => set('pincode', e.target.value)} /></Field>
          </div>
        )
      case 'family':
        return (
          <div style={styles.grid}>
            <Field label="Mother Name"><input style={styles.input} value={form.mother_name} onChange={e => set('mother_name', e.target.value)} /></Field>
            <Field label="Father Name"><input style={styles.input} value={form.father_name} onChange={e => set('father_name', e.target.value)} /></Field>
            <Field label="Guardian Name"><input style={styles.input} value={form.guardian_name} onChange={e => set('guardian_name', e.target.value)} /></Field>
            <Field label="Guardian Occupation"><input style={styles.input} value={form.guardian_occupation} onChange={e => set('guardian_occupation', e.target.value)} /></Field>
            <Field label="Total Family Members"><input type="number" style={styles.input} value={form.total_family_members} onChange={e => set('total_family_members', e.target.value)} /></Field>
            <Field label="Monthly Family Income"><input type="number" style={styles.input} value={form.monthly_family_income} onChange={e => set('monthly_family_income', e.target.value)} /></Field>
            <Field label="Income Category">
              <select style={styles.select} value={form.income_category} onChange={e => set('income_category', e.target.value)}>
                {INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c || 'Select...'}</option>)}
              </select>
            </Field>
            <Field label="Occupation"><input style={styles.input} value={form.occupation} onChange={e => set('occupation', e.target.value)} /></Field>
            <Field label="BPL Available">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.bpl_available} onChange={e => set('bpl_available', e.target.checked)} /> Yes
              </label>
            </Field>
            <Field label="Ration Card Available">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.ration_card_available} onChange={e => set('ration_card_available', e.target.checked)} /> Yes
              </label>
            </Field>
          </div>
        )
      case 'education':
        return (
          <div style={styles.grid}>
            <Field label="Education Level">
              <select style={styles.select} value={form.education_level} onChange={e => set('education_level', e.target.value)}>
                {EDUCATION_LEVELS.map(l => <option key={l} value={l}>{l || 'Select...'}</option>)}
              </select>
            </Field>
            <Field label="Currently Studying">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.currently_studying} onChange={e => set('currently_studying', e.target.checked)} /> Yes
              </label>
            </Field>
            <Field label="School / Institute"><input style={styles.input} value={form.school_or_institute} onChange={e => set('school_or_institute', e.target.value)} /></Field>
            <Field label="Grade / Course"><input style={styles.input} value={form.grade || form.course} onChange={e => { set('grade', e.target.value); set('course', e.target.value) }} /></Field>
            <Field label="Special Skills"><textarea style={styles.textarea} value={form.special_skills} onChange={e => set('special_skills', e.target.value)} /></Field>
            <Field label="Employment Status">
              <select style={styles.select} value={form.employment_status} onChange={e => set('employment_status', e.target.value)}>
                {EMPLOYMENT_STATUSES.map(s => <option key={s} value={s}>{s || 'Select...'}</option>)}
              </select>
            </Field>
            <Field label="Employer"><input style={styles.input} value={form.employer} onChange={e => set('employer', e.target.value)} /></Field>
            <Field label="Monthly Income"><input type="number" style={styles.input} value={form.monthly_income} onChange={e => set('monthly_income', e.target.value)} /></Field>
          </div>
        )
      case 'disability':
        return (
          <div>
            <p style={{ fontSize: '13px', color: 'var(--ink-soft)', marginBottom: '16px' }}>Add disability details if applicable. You can add multiple records later from the beneficiary profile.</p>
            <div style={styles.grid}>
              <Field label="Disability Type">
                <select style={styles.select} id="disability_type">
                  {DISABILITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Disability Percentage"><input type="number" style={styles.input} id="disability_pct" placeholder="%" /></Field>
              <Field label="Certificate Available"><input type="checkbox" id="cert_avail" style={{ width: '18px', height: '18px' }} /></Field>
              <Field label="Certificate Number"><input style={styles.input} id="cert_num" /></Field>
            </div>
          </div>
        )
      case 'documents':
        return (
          <div>
            <p style={{ fontSize: '13px', color: 'var(--ink-soft)', marginBottom: '16px' }}>Documents can be uploaded from the beneficiary profile after creation.</p>
          </div>
        )
      case 'review':
        return (
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Review Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
              <div><strong>Name:</strong> {form.full_name}</div>
              <div><strong>Gender:</strong> {form.gender}</div>
              <div><strong>DOB:</strong> {form.date_of_birth}</div>
              <div><strong>Mobile:</strong> {form.mobile}</div>
              <div><strong>City:</strong> {form.city}</div>
              <div><strong>State:</strong> {form.state}</div>
              <div><strong>Mother:</strong> {form.mother_name}</div>
              <div><strong>Father:</strong> {form.father_name}</div>
              <div><strong>Education:</strong> {form.education_level}</div>
              <div><strong>Employment:</strong> {form.employment_status}</div>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', marginBottom: '16px' }}>New Beneficiary Registration</h2>

      <div style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          {STEPS.map((s, i) => (
            <div key={s.key} style={{ textAlign: 'center', flex: 1 }}>
              <div style={styles.stepLabel}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={styles.stepBar}>
          {STEPS.map((s, i) => (
            <div key={s.key} style={styles.step(i === step, i < step)} />
          ))}
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.title}>{STEPS[step].label}</div>
        {renderStep()}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
        <button
          disabled={step === 0}
          onClick={() => setStep(s => s - 1)}
          style={{ ...styles.btn, ...styles.btnSecondary, opacity: step === 0 ? 0.5 : 1 }}
        >
          Previous
        </button>
        <div style={{ display: 'flex', gap: '8px' }}>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} style={{ ...styles.btn, ...styles.btnPrimary }}>Next</button>
          ) : (
            <button onClick={handleSubmit} disabled={saving || !form.full_name} style={{ ...styles.btn, ...styles.btnPrimary, opacity: saving || !form.full_name ? 0.5 : 1 }}>
              {saving ? 'Saving...' : 'Create Beneficiary'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
