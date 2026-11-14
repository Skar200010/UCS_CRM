import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Plus, X } from 'lucide-react'
import { apiGet, apiPost } from '../api/auth'

// Declare a company-wide holiday from Accounts -> Workforce -> Operations.
// The row written here is the same `holidays` row HR/Super Admin use, so
// payroll's existing holiday handling applies unchanged: that date is skipped
// when absent days are fabricated and it is counted as a paid day.

const IST_OFFSET = 5.5 * 60 * 60 * 1000
const todayYmd = () => new Date(Date.now() + IST_OFFSET).toISOString().slice(0, 10)

const fmtDate = (value) => {
  const date = String(value || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date || '—'
  const d = new Date(date + 'T12:00:00Z')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export default function HolidayManagerModal({ onClose }) {
  const [holidays, setHolidays] = useState([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(todayYmd())
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [toast, setToast] = useState('')

  const load = () => {
    setLoading(true)
    apiGet('/holidays')
      .then((list) => {
        const rows = Array.isArray(list) ? list : []
        setHolidays(rows.filter((h) => String(h.type || 'holiday') !== 'event'))
      })
      .catch((e) => setErr(e.message || 'Could not load holidays.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // Lock the page behind the dialog (this layout scrolls on <body>).
  useEffect(() => {
    const body = document.body
    const gap = window.innerWidth - document.documentElement.clientWidth
    const prevOverflow = body.style.overflow
    const prevPad = body.style.paddingRight
    body.style.overflow = 'hidden'
    if (gap > 0) body.style.paddingRight = `${gap}px`
    return () => {
      body.style.overflow = prevOverflow
      body.style.paddingRight = prevPad
    }
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const sorted = useMemo(
    () => [...holidays].sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))),
    [holidays],
  )

  const submit = async () => {
    const ymd = String(date || '').slice(0, 10)
    const title = String(name || '').trim()
    setErr('')
    setToast('')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) { setErr('Pick a valid date.'); return }
    if (!title) { setErr('Enter the holiday name.'); return }
    if (sorted.some((h) => String(h.date || '').slice(0, 10) === ymd)) {
      setErr(`${fmtDate(ymd)} is already declared as a holiday.`)
      return
    }
    setSaving(true)
    try {
      const data = await apiPost('/holidays', {
        name: title,
        date: ymd,
        type: 'holiday',
        is_recurring: false,
      })
      const created = data?.holiday
      if (created) {
        setHolidays((prev) => [...prev, created])
      } else {
        load()
      }
      setName('')
      setToast(`${title} declared on ${fmtDate(ymd)}. That day will be paid and will not be marked absent.`)
    } catch (e) {
      setErr(e.message || 'Could not save the holiday.')
    } finally {
      setSaving(false)
    }
  }

  const closeBtn = {
    border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280',
    padding: 0, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  }

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add Holiday"
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '86vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(15,23,42,.28)', overflow: 'hidden' }}
      >
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line, #e5e7eb)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, background: '#e0f2fe', color: '#0369a1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CalendarDays size={18} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--ink, #111827)' }}>Add Holiday</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft, #6b7280)', marginTop: 2 }}>
              Company-wide paid holiday — that date will not be deducted
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={saving} title="Close" aria-label="Close"
            style={{ ...closeBtn, border: '1px solid var(--line, #e5e7eb)', borderRadius: 8, width: 30, height: 30 }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '10px 12px', borderRadius: 10, background: '#f0f9ff', border: '1px solid #bae6fd', color: '#075985', fontSize: 12, lineHeight: 1.5 }}>
            The declared day is treated as a paid day in salary. It is never marked absent, and absences on other days keep their normal deduction.
          </div>

          {toast && <div style={{ padding: '9px 13px', borderRadius: 8, background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', fontSize: 12.5, fontWeight: 600 }}>{toast}</div>}
          {err && <div style={{ padding: '9px 13px', borderRadius: 8, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', fontSize: 12.5 }}>{err}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft, #6b7280)' }}>Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => { setDate(e.target.value); setErr(''); }}
                style={{ height: 36, borderRadius: 8, border: '1px solid var(--line, #e5e7eb)', padding: '0 10px', font: 'inherit', fontSize: 13, color: 'var(--ink, #111827)', background: '#fff' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft, #6b7280)' }}>Occasion / Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setErr('') }}
                onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
                placeholder="e.g. Diwali"
                autoFocus
                style={{ height: 36, borderRadius: 8, border: '1px solid var(--line, #e5e7eb)', padding: '0 10px', font: 'inherit', fontSize: 13, color: 'var(--ink, #111827)', background: '#fff' }}
              />
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={submit}
              disabled={saving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={15} /> {saving ? 'Saving…' : 'Declare Holiday'}
            </button>
          </div>

          <div style={{ borderTop: '1px solid var(--line, #e5e7eb)', paddingTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-soft, #6b7280)' }}>Declared holidays</span>
              <span style={{ fontSize: 11, color: 'var(--ink-soft, #6b7280)' }}>{sorted.length} entr{sorted.length === 1 ? 'y' : 'ies'}</span>
            </div>
            {loading ? (
              <div style={{ color: 'var(--ink-soft, #6b7280)', fontSize: 12, padding: '8px 0' }}>Loading holidays…</div>
            ) : sorted.length === 0 ? (
              <div style={{ color: 'var(--ink-soft, #6b7280)', fontSize: 12, padding: '8px 0' }}>No holidays declared yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                {sorted.map((h) => (
                  <div key={h.id || `${h.date}-${h.name}`} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--line, #e5e7eb)', borderRadius: 9, padding: '8px 10px', background: '#fff' }}>
                    <span style={{ width: 30, height: 30, borderRadius: 8, background: '#e0f2fe', color: '#0369a1', display: 'grid', placeItems: 'center', fontSize: 14, flexShrink: 0 }}>
                      <CalendarDays size={15} />
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink, #111827)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name || 'Holiday'}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--ink-soft, #6b7280)' }}>{fmtDate(h.date)}</div>
                    </div>
                    <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', borderRadius: 999, padding: '2px 7px' }}>
                      Paid
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
