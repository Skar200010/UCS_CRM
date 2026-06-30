import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

export default function CorrectionTicket() {
  const navigate = useNavigate()
  const [history, setHistory] = useState([])
  const [date, setDate] = useState('')
  const [field, setField] = useState('punch_in')
  const [requestedTime, setRequestedTime] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)

  useEffect(() => {
    api.history().then(h => {
      const list = Array.isArray(h) ? h : h?.history || []
      setHistory(list)
    }).catch(() => {}).finally(() => setLoadingHistory(false))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!date || !requestedTime || !reason) { setError('Please fill all fields'); return }
    const rec = history.find(r => r.date === date)
    if (!rec) { setError('No attendance record found for this date'); return }
    setLoading(true); setError('')
    try {
      await api.raiseTicket({ attendance_id: rec.id, date, field, requested_time: `${date}T${requestedTime}:00`, reason })
      setSuccess(true)
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  const dates = [...new Set(history.map(r => r.date).filter(Boolean))].sort().reverse()

  return (
    <div className="p-4 max-w-lg mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h2 className="text-lg font-bold text-[var(--primary)]">{success ? 'Ticket Submitted' : 'Raise a Ticket'}</h2>
      </div>

      {success ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-[var(--border)]">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h4 className="font-semibold">Ticket Raised!</h4>
          <p className="text-sm text-[var(--ink-soft)] mt-1">Your correction request is pending HR review.</p>
          <button onClick={() => navigate('/profile')} className="mt-4 px-5 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold">Go to Profile</button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[var(--border)] space-y-4">
          {error && <div className="p-3 rounded-lg bg-[var(--red-bg)] text-[var(--red)] text-xs">{error}</div>}

          <div>
            <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Date</label>
            <select value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-blue-500">
              <option value="">Select a date</option>
              {dates.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Field</label>
            <select value={field} onChange={e => setField(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-blue-500">
              <option value="punch_in">Punch In</option>
              <option value="punch_out">Punch Out</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Corrected Time</label>
            <input type="time" value={requestedTime} onChange={e => setRequestedTime(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--ink-soft)] mb-1">Reason</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] text-sm focus:outline-none focus:border-blue-500 resize-none" />
          </div>
          <button onClick={handleSubmit} disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:bg-[var(--primary-light)] transition-colors disabled:opacity-50">
            {loading ? 'Submitting...' : 'Submit Ticket'}
          </button>
        </div>
      )}
    </div>
  )
}
