import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store'
import { api } from '../api'

const STEPS = [
  'Personal', 'Education', 'Experience', 'Family',
  'References', 'Photo', 'Documents', 'Bank',
  'Declaration', 'Policies', 'Review'
]

const INITIAL = {
  name: '', email: '', phone: '', dob: '', gender: '', father: '', marital: '',
  education: [{ level: '', institution: '', year: '' }],
  experience: [{ organization: '', role: '', years: '' }],
  family: [{ name: '', relation: '', phone: '' }],
  references: [{ name: '', relation: '', phone: '' }],
  bank: { account: '', ifsc: '', bank_name: '' },
}

export default function Onboarding() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(INITIAL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [photo, setPhoto] = useState(null)
  const [docs, setDocs] = useState({})
  const [policies, setPolicies] = useState([])
  const [accepted, setAccepted] = useState([])

  useEffect(() => {
    api.policies().then(d => setPolicies(Array.isArray(d) ? d : d?.policies || [])).catch(() => {})
  }, [])

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = async () => {
    setLoading(true); setError('')
    try {
      if (photo) {
        const fd = new FormData(); fd.append('photo', photo)
        await api.uploadPhoto(fd)
      }
      await api.submitOnboarding({ ...form, policies_accepted: accepted })
      setStep(10)
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  const canNext = () => {
    if (step === 0) return form.name && form.email && form.phone
    if (step === 9) return accepted.length === policies.length
    return true
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e3a5f] to-[#0f172a] flex flex-col">
      {/* Progress */}
      <div className="px-4 pt-6 pb-2">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => step > 0 ? setStep(s => s - 1) : navigate('/home')} className="text-white/60 text-sm">&larr; Back</button>
          <span className="text-white/50 text-xs">Step {step + 1} of 11</span>
        </div>
        <div className="flex gap-1">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-blue-400' : 'bg-white/10'}`} />
          ))}
        </div>
        <div className="text-white/70 text-sm font-medium mt-2">{STEPS[step]}</div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="bg-white rounded-2xl p-5 shadow-xl animate-fade-in min-h-[300px]">
          {error && <div className="mb-4 p-3 rounded-lg bg-[var(--red-bg)] text-[var(--red)] text-xs">{error}</div>}

          {step === 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm mb-3">Personal Details</h3>
              {['name', 'email', 'phone', 'dob', 'father'].map(f => (
                <div key={f}>
                  <label className="block text-xs text-[var(--ink-soft)] mb-0.5 capitalize">{f === 'father' ? "Father's Name" : f}</label>
                  <input type={f === 'dob' ? 'date' : 'text'} value={form[f] || ''} onChange={e => update(f, e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-blue-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs text-[var(--ink-soft)] mb-0.5">Gender</label>
                <select value={form.gender} onChange={e => update('gender', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-sm">
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--ink-soft)] mb-0.5">Marital Status</label>
                <select value={form.marital} onChange={e => update('marital', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-sm">
                  <option value="">Select</option>
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="divorced">Divorced</option>
                  <option value="widowed">Widowed</option>
                </select>
              </div>
            </div>
          )}

          {step === 1 && (
            <ArrayForm label="Education" items={form.education} setItems={v => update('education', v)}
              fields={[
                { key: 'level', placeholder: 'Qualification (e.g. 10th, 12th, BSc)' },
                { key: 'institution', placeholder: 'Institution name' },
                { key: 'year', placeholder: 'Year of passing' },
              ]} />
          )}
          {step === 2 && (
            <ArrayForm label="Previous Organizations" items={form.experience} setItems={v => update('experience', v)}
              fields={[
                { key: 'organization', placeholder: 'Organization name' },
                { key: 'role', placeholder: 'Your role' },
                { key: 'years', placeholder: 'Years worked' },
              ]} />
          )}
          {step === 3 && (
            <ArrayForm label="Family Members" items={form.family} setItems={v => update('family', v)}
              fields={[
                { key: 'name', placeholder: 'Name' },
                { key: 'relation', placeholder: 'Relation' },
                { key: 'phone', placeholder: 'Phone' },
              ]} />
          )}
          {step === 4 && (
            <ArrayForm label="References" items={form.references} setItems={v => update('references', v)}
              fields={[
                { key: 'name', placeholder: 'Name' },
                { key: 'relation', placeholder: 'Relation' },
                { key: 'phone', placeholder: 'Phone' },
              ]} />
          )}

          {step === 5 && (
            <div>
              <h3 className="font-semibold text-sm mb-3">Profile Photo</h3>
              <input type="file" accept="image/*" onChange={e => setPhoto(e.target.files[0])}
                className="w-full text-sm" />
              {photo && <div className="mt-2 text-xs text-[var(--ink-soft)]">Selected: {photo.name}</div>}
            </div>
          )}

          {step === 6 && (
            <div>
              <h3 className="font-semibold text-sm mb-3">Documents</h3>
              {['aadhaar', 'pan', 'bank_proof', 'light_bill'].map(d => (
                <div key={d} className="mb-3">
                  <label className="block text-xs text-[var(--ink-soft)] mb-0.5 capitalize">{d.replace('_', ' ')}</label>
                  <input type="file" onChange={e => setDocs(f => ({ ...f, [d]: e.target.files[0] }))} className="w-full text-sm" />
                </div>
              ))}
            </div>
          )}

          {step === 7 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm mb-3">Bank Account Details</h3>
              {['bank_name', 'account', 'ifsc'].map(f => (
                <div key={f}>
                  <label className="block text-xs text-[var(--ink-soft)] mb-0.5 capitalize">{f.replace('_', ' ')}</label>
                  <input value={form.bank[f] || ''} onChange={e => update('bank', { ...form.bank, [f]: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-blue-500" />
                </div>
              ))}
            </div>
          )}

          {step === 8 && (
            <div>
              <h3 className="font-semibold text-sm mb-3">Declaration</h3>
              <p className="text-sm text-[var(--ink-soft)] mb-4">I hereby declare that all information provided is true and correct to the best of my knowledge.</p>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.declared} onChange={e => update('declared', e.target.checked)}
                  className="rounded" />
                I agree to the declaration
              </label>
            </div>
          )}

          {step === 9 && (
            <div>
              <h3 className="font-semibold text-sm mb-3">Company Policies</h3>
              <div className="space-y-2">
                {policies.map((p, i) => (
                  <label key={i} className="flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={accepted.includes(p.id || p)} onChange={e => {
                      if (e.target.checked) setAccepted(a => [...a, p.id || p])
                      else setAccepted(a => a.filter(id => id !== (p.id || p)))
                    }} className="mt-0.5 rounded" />
                    <span>{typeof p === 'string' ? p : p.title || p.name || p}</span>
                  </label>
                ))}
                {policies.length === 0 && <div className="text-sm text-[var(--ink-soft)]">No policies loaded</div>}
              </div>
            </div>
          )}

          {step === 10 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h3 className="font-semibold text-lg">Onboarding Complete!</h3>
              <p className="text-sm text-[var(--ink-soft)] mt-1">Your profile has been submitted.</p>
              <button onClick={() => navigate('/home', { replace: true })} className="mt-6 px-6 py-2.5 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold">Go to Dashboard</button>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {step < 10 && (
        <div className="px-4 pb-6">
          <button onClick={step === 9 ? handleSubmit : () => setStep(s => s + 1)}
            disabled={!canNext() || loading}
            className="w-full py-3 rounded-xl bg-blue-500 text-white font-semibold text-sm hover:bg-blue-600 transition-colors disabled:opacity-40">
            {loading ? 'Submitting...' : step === 9 ? 'Submit' : 'Continue'}
          </button>
        </div>
      )}
    </div>
  )
}

function ArrayForm({ label, items, setItems, fields }) {
  const add = () => setItems([...items, {}])
  const remove = (i) => items.length > 1 && setItems(items.filter((_, idx) => idx !== i))

  return (
    <div>
      <h3 className="font-semibold text-sm mb-3">{label}</h3>
      {items.map((item, i) => (
        <div key={i} className="mb-3 p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--ink-soft)]">#{i + 1}</span>
            {items.length > 1 && <button onClick={() => remove(i)} className="text-[var(--red)] text-xs">Remove</button>}
          </div>
          {fields.map(f => (
            <input key={f.key} value={item[f.key] || ''} onChange={e => {
              const copy = [...items]; copy[i] = { ...copy[i], [f.key]: e.target.value }; setItems(copy)
            }} placeholder={f.placeholder}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-sm mb-2 focus:outline-none focus:border-blue-500" />
          ))}
        </div>
      ))}
      <button onClick={add} className="text-xs text-blue-600 font-medium">+ Add more</button>
    </div>
  )
}
