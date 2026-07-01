import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store'
import { api } from '../api'
import MiniCalendar from './MiniCalendar'
import ProgressCircle from './ProgressCircle'
import ConsistencyBar from './ConsistencyBar'

export default function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [history, setHistory] = useState([])
  const [today, setToday] = useState({})
  const [loans, setLoans] = useState([])
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1)
  const [locationEnabled, setLocationEnabled] = useState(false)

  const load = useCallback(async () => {
    try {
      const [h, td, l, t] = await Promise.all([
        api.history(), api.today(), api.myLoans().catch(() => []), api.myTickets().catch(() => [])
      ])
      setHistory(Array.isArray(h) ? h : h?.history || [])
      setToday(td?.attendance || td || {})
      setLoans(Array.isArray(l) ? l : l?.loans || [])
      setTickets(Array.isArray(t) ? t : t?.tickets || [])
    } catch (_) {} finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then(s => {
        setLocationEnabled(s.state === 'granted')
        s.onchange = () => setLocationEnabled(s.state === 'granted')
      }).catch(() => {})
    }
  }, [])

  const statusByDate = {}
  const monthRecs = history.filter(r => r.date && r.date.startsWith(`${calYear}-${String(calMonth).padStart(2, '0')}`))
  monthRecs.forEach(r => { statusByDate[r.date] = r.status })

  const present = monthRecs.filter(r => r.status === 'present').length
  const late = monthRecs.filter(r => r.status === 'late').length
  const absent = monthRecs.filter(r => r.status === 'absent').length
  const leave = monthRecs.filter(r => r.status === 'leave' || r.status === 'half-day').length
  const total = monthRecs.length || 1

  const days = new Date(calYear, calMonth, 0).getDate()
  const presentPct = Math.round((present / days) * 100)
  const latePct = Math.round((late / days) * 100)
  const absentPct = Math.round((absent / days) * 100)
  const leavePct = Math.round((leave / days) * 100)

  const selectedDetail = selectedDate ? monthRecs.find(r => r.date === selectedDate) : null
  const totalLate = history.reduce((s, r) => s + (r.late_minutes || 0), 0)

  const initials = user?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U'

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 animate-fade-in">
      {/* Profile Card */}
      <div className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-light)] rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold">{initials}</div>
          <div>
            <div className="font-bold text-base">{user?.name || 'Employee'}</div>
            <div className="text-xs text-white/70">{user?.role || 'Employee'}</div>
            <div className="text-[10px] text-white/50 mt-0.5">ID: {user?.id || user?.worker_id || '—'}</div>
          </div>
        </div>
      </div>

      {/* Monthly Overview */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-[var(--border)]">
        <div className="text-[10px] font-semibold text-[var(--ink-muted)] uppercase tracking-wider mb-4">
          {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][calMonth - 1]} {calYear} Overview
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <ProgressCircle value={presentPct} size={48} strokeWidth={4} color="#2a6a4b" icon={<div className="text-[10px] font-bold text-[var(--green)]">{present}</div>} />
            <div className="text-[10px] text-[var(--ink-soft)] mt-1">Present</div>
          </div>
          <div>
            <ProgressCircle value={latePct} size={48} strokeWidth={4} color="#c28228" icon={<div className="text-[10px] font-bold text-[var(--orange)]">{late}</div>} />
            <div className="text-[10px] text-[var(--ink-soft)] mt-1">Late</div>
          </div>
          <div>
            <ProgressCircle value={absentPct} size={48} strokeWidth={4} color="#ba1a1a" icon={<div className="text-[10px] font-bold text-[var(--red)]">{absent}</div>} />
            <div className="text-[10px] text-[var(--ink-soft)] mt-1">Absent</div>
          </div>
          <div>
            <ProgressCircle value={leavePct} size={48} strokeWidth={4} color="#7a92b0" icon={<div className="text-[10px] font-bold text-[var(--blue)]">{leave}</div>} />
            <div className="text-[10px] text-[var(--ink-soft)] mt-1">Leave</div>
          </div>
        </div>
      </div>

      {/* Late Deduction Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-[var(--border)]">
        <div className="text-[10px] font-semibold text-[var(--ink-muted)] uppercase tracking-wider">Late Deduction</div>
        <div className="mt-2 flex items-center gap-3">
          <div className="text-2xl font-bold text-[var(--orange)]">{totalLate}m</div>
          <div className="flex-1 text-xs text-[var(--ink-soft)]">
            {totalLate > 480 ? 'Tier 3: 1+ day deducted' : totalLate > 240 ? 'Tier 2: 1 day deducted' : totalLate > 180 ? 'Tier 1: 0.5 day deducted' : 'Within limit ✓'}
          </div>
        </div>
      </div>

      {/* Attendance Calendar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-[var(--border)]">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-semibold text-[var(--ink-muted)] uppercase tracking-wider">Calendar</div>
          <div className="flex items-center gap-2">
            <button onClick={() => { if (calMonth === 1) { setCalMonth(12); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }} className="p-1 rounded hover:bg-gray-100"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg></button>
            <span className="text-xs font-medium">{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][calMonth - 1]} {calYear}</span>
            <button onClick={() => { if (calMonth === 12) { setCalMonth(1); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }} className="p-1 rounded hover:bg-gray-100"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg></button>
          </div>
        </div>
        <MiniCalendar year={calYear} month={calMonth} statusByDate={statusByDate} onSelect={setSelectedDate} />

        {/* Consistency Bar */}
        <div className="mt-3">
          <ConsistencyBar present={present} absent={absent} late={late} leave={leave} total={days} />
        </div>
        <div className="flex gap-3 mt-2 text-[10px] text-[var(--ink-soft)] flex-wrap">
          <span><span className="inline-block w-2 h-2 rounded-sm bg-[var(--green)] mr-1" />Present</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-[var(--orange)] mr-1" />Late</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-[var(--red)] mr-1" />Absent</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-[var(--blue)] mr-1" />Leave</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-[var(--purple)] mr-1" />Half-day</span>
        </div>

        {/* Selected Day Detail */}
        {selectedDate && selectedDetail && (
          <div className="mt-3 p-3 rounded-lg bg-[var(--surface)] text-sm animate-fade-in">
            <div className="font-medium">{selectedDate}</div>
            <div className="mt-1 text-[var(--ink-soft)]">
              Status: <span className="font-medium">{selectedDetail.status}</span>
              {selectedDetail.punch_in_time && <> | In: {new Date(selectedDetail.punch_in_time).toLocaleTimeString()}</>}
              {selectedDetail.punch_out_time && <> | Out: {new Date(selectedDetail.punch_out_time).toLocaleTimeString()}</>}
            </div>
          </div>
        )}
      </div>

      {/* Loans */}
      <div className="bg-white rounded-2xl shadow-sm border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] text-[10px] font-semibold text-[var(--ink-muted)] uppercase tracking-wider">Loans & Advances</div>
        {loans.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-[var(--ink-muted)]">No loans or advances</div>
        ) : loans.map((l, i) => (
          <div key={l.id || i} className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] last:border-0 text-sm">
            <div>
              <div className="font-medium">₹{parseFloat(l.amount || l.deduction || 0).toLocaleString('en-IN')}</div>
              <div className="text-[10px] text-[var(--ink-soft)]">{l.type || l.status}</div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
              l.status === 'approved' ? 'bg-green-100 text-green-700' :
              l.status === 'active' ? 'bg-blue-100 text-blue-700' :
              l.status === 'rejected' ? 'bg-red-100 text-red-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>{l.status || 'pending'}</span>
          </div>
        ))}
      </div>

      {/* Raise a Ticket */}
      <div className="bg-white rounded-2xl shadow-sm border border-[var(--border)] divide-y divide-[var(--border)]">
        <button onClick={() => navigate('/raise-ticket')} className="flex items-center gap-3 px-4 py-3.5 w-full text-left hover:bg-[var(--surface)] transition-colors">
          <svg className="w-5 h-5 text-[var(--primary-light)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7V5a2 2 0 00-2-2H6a2 2 0 00-2 2v2"/><path d="M20 17v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2"/><line x1="16" y1="12" x2="8" y2="12"/></svg>
          <span className="text-sm flex-1">Raise a Ticket</span>
          <svg className="w-4 h-4 text-[var(--ink-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <div className="px-4 py-3">
          <div className="text-[10px] font-semibold text-[var(--ink-muted)] uppercase tracking-wider mb-2">Your Tickets</div>
          {tickets.length === 0 ? (
            <div className="text-sm text-[var(--ink-muted)]">No tickets raised yet</div>
          ) : tickets.slice(0, 3).map((t, i) => (
            <div key={t.id || i} className="flex items-center justify-between py-1.5 text-sm">
              <div className="text-[var(--ink-soft)]">{t.field || '—'} | {t.date}</div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                t.status === 'approved' ? 'bg-green-100 text-green-700' :
                t.status === 'rejected' ? 'bg-red-100 text-red-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>{t.status || 'pending'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Account Management */}
      <div className="bg-white rounded-2xl shadow-sm border border-[var(--border)] divide-y divide-[var(--border)]">
        <button onClick={() => navigate('/edit-profile')} className="flex items-center gap-3 px-4 py-3.5 w-full text-left hover:bg-[var(--surface)] transition-colors">
          <PencilSvg className="w-5 h-5 text-[var(--ink-soft)] shrink-0" />
          <span className="text-sm flex-1">Edit Profile</span>
          <ChevronSvg className="w-4 h-4 text-[var(--ink-muted)]" />
        </button>
        <div className="flex items-center gap-3 px-4 py-3.5">
          <LocationSvg className="w-5 h-5 text-[var(--ink-soft)] shrink-0" />
          <span className="text-sm flex-1">Location</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${locationEnabled ? 'bg-[var(--green-bg)] text-[var(--green)]' : 'bg-[var(--red-bg)] text-[var(--red)]'}`}>
            {locationEnabled ? 'On' : 'Off'}
          </span>
        </div>
        <button onClick={() => window.open('mailto:help@ufs.com')} className="flex items-center gap-3 px-4 py-3.5 w-full text-left hover:bg-[var(--surface)] transition-colors">
          <HelpSvg className="w-5 h-5 text-[var(--ink-soft)] shrink-0" />
          <span className="text-sm flex-1">Help Centre</span>
          <ChevronSvg className="w-4 h-4 text-[var(--ink-muted)]" />
        </button>
        <button onClick={() => { logout(); navigate('/login') }} className="flex items-center gap-3 px-4 py-3.5 w-full text-left hover:bg-red-50 transition-colors">
          <LogoutSvg className="w-5 h-5 text-[var(--red)] shrink-0" />
          <span className="text-sm text-[var(--red)]">Sign Out</span>
        </button>
      </div>
    </div>
  )
}

function PencilSvg({ className }) { return <svg width={20} height={20} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> }
function LocationSvg({ className }) { return <svg width={20} height={20} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> }
function HelpSvg({ className }) { return <svg width={20} height={20} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> }
function LogoutSvg({ className }) { return <svg width={20} height={20} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> }
function ChevronSvg({ className }) { return <svg width={14} height={14} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg> }
