import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchEvents, fetchEventDashboard } from '../store'
import { StatCard } from '../components/Table'
import RecentNotices from '../../../components/RecentNotices'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const COLORS = ['#7B5EA7', '#3485D4', '#C08A2E', '#5B6B4E', '#B5603A', '#9ca3af']

export default function EventDashboard() {
  const navigate = useNavigate()
  const [dash, setDash] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchEvents(), fetchEventDashboard().catch(() => null)])
      .then(([events, db]) => {
        const now = new Date()
        const today = now.toISOString().slice(0, 10)
        setDash({
          total: events?.length || 0,
          upcoming: events?.filter(e => e.status === 'Approved' && new Date(e.date) > now).length || 0,
          today: events?.filter(e => e.date === today).length || 0,
          completed: events?.filter(e => e.status === 'Completed').length || 0,
          cancelled: events?.filter(e => ['Cancelled', 'Postponed'].includes(e.status)).length || 0,
          budget_total: events?.reduce((s, e) => s + (+e.budget || 0), 0) || 0,
          beneficiaries_total: events?.reduce((s, e) => s + (+e.expected_beneficiaries || 0), 0) || 0,
          events,
          ...(db || {})
        })
      })
      .catch(e => console.error('EventDashboard fetchDashboard:', e))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading" style={{padding: 60, textAlign: 'center', color: 'var(--ink-soft)'}}>Loading dashboard...</div>

  const events = dash?.events || []
  const catCount = {}
  events.forEach(e => { catCount[e.category] = (catCount[e.category] || 0) + 1 })
  const pieData = Object.entries(catCount).map(([name, value]) => ({ name, value }))

  const monthlyData = []
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const m = (now.getMonth() - i + 12) % 12
    const y = now.getFullYear() + (now.getMonth() - i < 0 ? -1 : 0)
    const count = events.filter(e => {
      if (!e.date) return false
      const d = new Date(e.date)
      return d.getMonth() === m && d.getFullYear() === y
    }).length
    monthlyData.push({ month: months[m], events: count })
  }

  const upcoming = events.filter(e => e.status === 'Approved' && new Date(e.date) > new Date()).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 5)

  return (
    <>
      <div className="stats-grid">
        <StatCard icon={null} label="Total Events" value={dash?.total} color="#7B5EA7" trend={12} subtitle="All time" />
        <StatCard icon={null} label="Upcoming" value={dash?.upcoming} color="#3485D4" trend={8} subtitle="Approved events" />
        <StatCard icon={null} label="Today" value={dash?.today} color="#C08A2E" subtitle="Events happening now" />
        <StatCard icon={null} label="Completed" value={dash?.completed} color="#5B6B4E" trend={-3} subtitle="Successfully delivered" />
        <StatCard icon={null} label="Budget Total" value={'₹' + (dash?.budget_total || 0).toLocaleString()} color="#16a34a" subtitle="Across all events" />
        <StatCard icon={null} label="Beneficiaries" value={dash?.beneficiaries_total?.toLocaleString()} color="#7c3aed" subtitle="Expected across events" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div className="card">
          <div className="card-head"><h3>Events by Month</h3></div>
          <div className="card-pad" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--ink-soft)' }} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--ink-soft)' }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--line)', fontSize: 13 }} />
                <Bar dataKey="events" fill="#7B5EA7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Events by Category</h3></div>
          <div className="card-pad" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--line)', fontSize: 13 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            {pieData.length === 0 && <div style={{ textAlign: 'center', paddingTop: 80, color: 'var(--ink-soft)', fontSize: 13 }}>No events to categorize</div>}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <h3>Upcoming Events</h3>
          <button className="btn btn-sm" onClick={() => navigate('/event-head/events')}>View All</button>
        </div>
        <div className="card-pad" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr><th>Event</th><th>Date</th><th>Venue</th><th>Category</th><th>Status</th></tr>
            </thead>
            <tbody>
              {upcoming.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--ink-soft)' }}>No upcoming events</td></tr>}
              {upcoming.map(ev => (
                <tr key={ev.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/event-head/events')}>
                  <td style={{ fontWeight: 500 }}>{ev.name}</td>
                  <td>{ev.date?.slice(0, 10)}</td>
                  <td>{ev.venue || '—'}</td>
                  <td>{ev.category}</td>
                  <td><span className="pill pill-blue">Approved</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <RecentNotices limit={5} />
    </>
  )
}
