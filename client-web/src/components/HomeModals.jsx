import { useState } from 'react'
import { api } from '../api'

export default function HomeModals({ showLeave, setShowLeave, showAdvance, setShowAdvance }) {
  return (
    <>
      {showLeave && <LeaveModal onClose={() => setShowLeave(false)} />}
      {showAdvance && <AdvanceModal onClose={() => setShowAdvance(false)} />}
    </>
  )
}

function LeaveModal({ onClose }) {
  const [type, setType] = useState('full_day')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [halfStart, setHalfStart] = useState('10:00')
  const [halfEnd, setHalfEnd] = useState('13:00')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!fromDate || !reason) { setError('Please fill in all required fields'); return }
    setLoading(true); setError('')
    try {
      await api.applyLeave({ type, from_date: fromDate, to_date: toDate, reason, half_start_time: type === 'half_day' ? halfStart : null, half_end_time: type === 'half_day' ? halfEnd : null })
      setSuccess(true)
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div className="relative bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-md max-h-[85vh] overflow-y-auto animate-slide-up md:animate-fade-in shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-[var(--border)] px-5 py-3.5 flex items-center justify-between rounded-t-2xl">
          <h3 className="font-semibold">{success ? 'Request Submitted' : 'Apply for Leave'}</h3>
          <button onClick={onClose} className="text-[var(--ink-soft)] text-lg">&times;</button>
        </div>
        {success ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h4 className="font-semibold">Leave Applied!</h4>
            <p className="text-sm text-[var(--ink-soft)] mt-1">Your request has been submitted for approval.</p>
            <button onClick={onClose} className="mt-4 px-5 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold">Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && <div className="p-3 rounded-lg bg-[var(--red-bg)] text-[var(--red)] text-xs">{error}</div>}
            <div>
              <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Leave Type</label>
              <select value={type} onChange={e => setType(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-blue-500">
                <option value="full_day">Full Day</option>
                <option value="half_day">Half Day</option>
                <option value="vacational">Vacational</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">From Date</label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">To Date</label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            {type === 'half_day' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Start Time</label>
                  <input type="time" value={halfStart} onChange={e => setHalfStart(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">End Time</label>
                  <input type="time" value={halfEnd} onChange={e => setHalfEnd(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Reason</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-blue-500 resize-none" />
            </div>
            <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:bg-[var(--primary-light)] transition-colors disabled:opacity-50">
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function AdvanceModal({ onClose }) {
  const [type, setType] = useState('advance')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!amount || !reason) { setError('Please fill in all fields'); return }
    setLoading(true); setError('')
    try {
      if (type === 'advance') await api.applyAdvance({ amount: parseFloat(amount), reason })
      else await api.applyLoan({ amount: parseFloat(amount), reason })
      setSuccess(true)
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div className="relative bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-md max-h-[85vh] overflow-y-auto animate-slide-up md:animate-fade-in shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-[var(--border)] px-5 py-3.5 flex items-center justify-between rounded-t-2xl">
          <h3 className="font-semibold">{success ? 'Request Submitted' : 'Apply for Advance / Loan'}</h3>
          <button onClick={onClose} className="text-[var(--ink-soft)] text-lg">&times;</button>
        </div>
        {success ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h4 className="font-semibold">Application Submitted!</h4>
            <p className="text-sm text-[var(--ink-soft)] mt-1">Your request is pending approval.</p>
            <button onClick={onClose} className="mt-4 px-5 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold">Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && <div className="p-3 rounded-lg bg-[var(--red-bg)] text-[var(--red)] text-xs">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setType('advance')} className={`py-2.5 rounded-lg border text-sm font-medium transition-colors ${type === 'advance' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-[var(--border)] text-[var(--ink-soft)]'}`}>Advance</button>
              <button type="button" onClick={() => setType('loan')} className={`py-2.5 rounded-lg border text-sm font-medium transition-colors ${type === 'loan' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-[var(--border)] text-[var(--ink-soft)]'}`}>Loan</button>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Amount (₹)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-blue-500" min="0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Reason</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-blue-500 resize-none" />
            </div>
            <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:bg-[var(--primary-light)] transition-colors disabled:opacity-50">
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
