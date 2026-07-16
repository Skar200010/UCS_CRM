import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { getMyDashboard, requestMoreData, getFollowUps, getLeadStats, getMonthlyDonors } from '../api/donors'
import { getMyTarget } from '../api/target'
import { SkeletonDashboard } from '../../../components/Skeleton'
import RecentNotices from '../../../components/RecentNotices'
import { cacheGet, cacheSet } from '../../../utils/cache'
import { useCall } from '../CallContext'

const currency = n => n != null ? '₹' + Number(n).toLocaleString('en-IN') : '—'

function callFmt(seconds) {
  if (seconds == null) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const Icon = ({ children, color }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color || 'var(--ink)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
)

const STATUS_COLORS = {
  pending: '#fbbf24', contacted: '#60a5fa', follow_up: '#a78bfa',
  donation_collected: '#34d399', lead_done: '#34d399', not_interested: '#f87171',
  not_reachable: '#9ca3af', scheduled: '#a78bfa',
}

const CACHE_KEY = 'fro_dashboard'

export default function Dashboard() {
  const cached = cacheGet(CACHE_KEY)
  const { todayStats } = useCall()
  const [dashData, setDashData] = useState(cached?.dash || null)
  const [targetData, setTargetData] = useState(cached?.target || null)
  const [loading, setLoading] = useState(!cached)
  const [showRequest, setShowRequest] = useState(false)
  const [reqMsg, setReqMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [reqDone, setReqDone] = useState(false)
  const [followUps, setFollowUps] = useState([])
  const [leadStats, setLeadStats] = useState(null)
  const [monthlyDonors, setMonthlyDonors] = useState([])
  const [showMonthlyModal, setShowMonthlyModal] = useState(false)

  const today = new Date()
  const day = today.getDate()
  const monthStr = today.toISOString().slice(0, 7)
  const isMonthlyPopupSeason = day >= 1 && day <= 3

  useEffect(() => {
    Promise.all([
      getMyDashboard().catch(() => null),
      getMyTarget().catch(() => null),
      getFollowUps().catch(() => []),
      getLeadStats(monthStr).catch(() => null),
      isMonthlyPopupSeason ? getMonthlyDonors(monthStr).catch(() => []) : Promise.resolve([]),
    ]).then(([d, t, f, ls, md]) => {
      setDashData(d)
      setTargetData(t)
      setFollowUps(f || [])
      setLeadStats(ls)
      setMonthlyDonors(md || [])
      if (d || t) cacheSet(CACHE_KEY, { dash: d, target: t }, 30000)
      if (isMonthlyPopupSeason && md?.length > 0 && localStorage.getItem('monthly_donors_dismissed') !== monthStr) setShowMonthlyModal(true)
    }).finally(() => setLoading(false))
  }, [])

  const handleSendRequest = async () => {
    if (!reqMsg.trim()) return
    setSending(true)
    try {
      await requestMoreData(reqMsg)
      setReqDone(true)
      setReqMsg('')
      setTimeout(() => { setShowRequest(false); setReqDone(false) }, 2000)
    } catch (err) {
      alert(err.message)
    } finally {
      setSending(false)
    }
  }

  if (loading) return <SkeletonDashboard />

  const ts = targetData || {}
  let ds = dashData || {}

  // Map new nested structure to old flat field names for backward compat
  if (ds.worker || ds.target?.amount != null || ds.connected || ds.donations || ds.verification || ds.data) {
    const d = ds
    ds = {
      is_active: d.worker?.is_active,
      is_punched_in: d.worker?.is_punched_in,
      target: d.target?.amount,
      collected: d.target?.collected,
      achieved_target: d.target?.achieved,
      monthly_connected: d.connected?.monthly,
      daily_connected: d.connected?.daily,
      daily_donations: d.donations?.daily,
      new_donors_today: d.donations?.new_donors?.today,
      new_donors_monthly: d.donations?.new_donors?.monthly,
      reactivated_today: d.reactivations?.today,
      reactivated_monthly: d.reactivations?.monthly,
      data_used: d.data?.used,
      data_unused: d.data?.unused,
      total_donations: d.donations?.total,
      active_donors: d.donors?.active,
      inactive_donors: d.donors?.inactive,
      verified_month_amount: d.verification?.month?.verified?.amount,
      verified_month_count: d.verification?.month?.verified?.count,
      unverified_month_amount: d.verification?.month?.unverified?.amount,
      unverified_month_count: d.verification?.month?.unverified?.count,
      verified_today_amount: d.verification?.today?.verified?.amount,
      verified_today_count: d.verification?.today?.verified?.count,
      unverified_today_amount: d.verification?.today?.unverified?.amount,
      unverified_today_count: d.verification?.today?.unverified?.count,
      stats: d.stats,
    }
  }
  const { stats = {} } = ds
  const target = ts.target || ds.target || 0
  const collected = ts.collected ?? ds.collected ?? 0
  const achieved_target = ts.achieved_target != null ? ts.achieved_target : (ds.achieved_target != null ? ds.achieved_target : null)
  const displayCollected = collected
  const remaining = Math.max(0, target - displayCollected)
  const progress = target > 0 ? Math.min(100, (displayCollected / target) * 100) : 0

  const pieData = ts.stats
    ? Object.entries(ts.stats).filter(([k]) => k !== 'total').map(([k, v]) => ({
        name: k.replace(/_/g, ' '),
        value: v,
        color: STATUS_COLORS[k] || '#94a3b8',
      }))
    : []

  const barData = target > 0 ? [
    { name: 'Target', amount: target, fill: '#94a3b8' },
    { name: 'Collected', amount: displayCollected, fill: '#34d399' },
    { name: 'Remaining', amount: remaining, fill: '#f87171' },
  ] : []

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 14, marginBottom: 20,
      }}>
        <div className="card" style={{ marginBottom: 0, padding: '16px 18px', border: `1.5px solid ${ds.is_punched_in ? 'var(--sage)' : '#f87171'}`, background: ds.is_punched_in ? 'linear-gradient(135deg, #f0fdf4 0%, #fff 100%)' : 'linear-gradient(135deg, #fef2f2 0%, #fff 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: ds.is_active ? (ds.is_punched_in ? '#16a34a' : '#f87171') : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{ds.is_punched_in ? 'check_circle' : ds.is_active ? 'schedule' : 'cancel'}</span>
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>Live Status</span>
              <div style={{ display: 'flex', gap: 12, marginTop: 2, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: ds.is_active ? (ds.is_punched_in ? 'var(--sage)' : '#f87171') : '#94a3b8' }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: ds.is_active ? (ds.is_punched_in ? 'var(--sage)' : '#f87171') : '#e2e8f0', marginRight: 4, verticalAlign: 'middle' }} />
                  {ds.is_active ? (ds.is_punched_in ? 'Punched In' : 'Not Punched') : 'Inactive'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600 }}>
                  Data: {ds.data_used ?? 0}/{stats.total ?? 0}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--sage)' }}>
                  Today: {currency(ds.daily_donations ?? 0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px', border: '1.5px solid #8b5cf6', background: 'linear-gradient(135deg, #faf5ff 0%, #fff 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <Icon color="#8b5cf6">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
            </Icon>
            <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600, flex: 1, textTransform: 'uppercase', letterSpacing: 0.3 }}>Monthly Target</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>{currency(target)}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
            {ts.target_source === 'not_set' ? 'Not set by admin' : `${progress.toFixed(0)}% achieved`}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px', border: '1.5px solid var(--sage)', background: 'linear-gradient(135deg, #f0fdf4 0%, #fff 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <Icon color="var(--sage)">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="17" y2="12"/><path d="M17 6v12"/>
            </Icon>
            <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600, flex: 1, textTransform: 'uppercase', letterSpacing: 0.3 }}>Collected</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--sage)' }}>{currency(displayCollected)}</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'var(--md-outline-variant)', overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ height: '100%', borderRadius: 2, background: 'var(--sage)', width: `${progress}%`, transition: 'width .4s' }} />
          </div>
          {achieved_target != null && (
            <div style={{ fontSize: 10, color: '#8b5cf6', fontWeight: 500 }}>Admin target: ₹{Number(achieved_target).toLocaleString('en-IN')}</div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px', border: `1.5px solid ${remaining > 0 ? '#e53e3e' : 'var(--sage)'}`, background: remaining > 0 ? 'linear-gradient(135deg, #fef2f2 0%, #fff 100%)' : 'linear-gradient(135deg, #f0fdf4 0%, #fff 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <Icon color={remaining > 0 ? '#e53e3e' : 'var(--sage)'}>
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </Icon>
            <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600, flex: 1, textTransform: 'uppercase', letterSpacing: 0.3 }}>Remaining</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: remaining > 0 ? '#e53e3e' : 'var(--sage)' }}>{currency(remaining)}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
            {remaining > 0 ? `${currency(remaining)} more to hit target` : 'Target achieved!'}
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 14, marginBottom: 20,
      }}>
        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Icon color="var(--sage)">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </Icon>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Monthly Connected</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--sage)' }}>{ds.monthly_connected ?? stats.contacted ?? 0}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Donors connected this month</div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Icon color="#3b82f6">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </Icon>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Daily Connected</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#3b82f6' }}>{ds.daily_connected ?? 0}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Donors connected today</div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Icon color="var(--sage)">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="17" y2="12"/><path d="M17 6v12"/>
            </Icon>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Monthly Donations</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--sage)' }}>{currency(collected)}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Donations this month</div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Icon color="#3b82f6">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="6" x2="21" y2="6"/>
            </Icon>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Daily Donations</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#3b82f6' }}>{currency(ds.daily_donations ?? 0)}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Donations today</div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Icon color="#16a34a">
              <polyline points="20 6 9 17 4 12"/>
            </Icon>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Verified</span>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a', lineHeight: 1.2 }}>{currency(ds.verified_month_amount ?? 0)}</div>
              <div style={{ fontSize: 10, color: '#16a34a', opacity: 0.7 }}>{ds.verified_month_count ?? 0} leads</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-soft)' }}>
            <span>Today: {currency(ds.verified_today_amount ?? 0)} ({ds.verified_today_count ?? 0})</span>
            <span>Verified by Accts</span>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Icon color="#f59e0b">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </Icon>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Unverified</span>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b', lineHeight: 1.2 }}>{currency(ds.unverified_month_amount ?? 0)}</div>
              <div style={{ fontSize: 10, color: '#f59e0b', opacity: 0.7 }}>{ds.unverified_month_count ?? 0} leads</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-soft)' }}>
            <span>Today: {currency(ds.unverified_today_amount ?? 0)} ({ds.unverified_today_count ?? 0})</span>
            <span>Pending verification</span>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Icon color="#16a34a">
              <polyline points="20 6 9 17 4 12"/>
            </Icon>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Data Used</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>{ds.data_used ?? (stats.contacted ?? 0) + (stats.donation_collected ?? 0) + (stats.follow_up ?? 0)}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Donors in connected statuses</div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Icon color="#f87171">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </Icon>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Data Unused</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#f87171' }}>{ds.data_unused ?? (stats.pending ?? 0) + (stats.not_reachable ?? 0) + (stats.not_interested ?? 0)}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Donors in non-connected statuses</div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Icon color="#8b5cf6">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            </Icon>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Active Donors</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#8b5cf6' }}>{ds.active_donors ?? 0}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Donated in last 1 year</div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Icon color="#f97316">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="22" y2="13"/><line x1="22" y1="8" x2="17" y2="13"/>
            </Icon>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Inactive Donors</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#f97316' }}>{ds.inactive_donors ?? 0}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>No donation in last 1 year</div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Icon color="var(--sage)">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="17" y2="12"/><path d="M17 6v12"/>
            </Icon>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Total Donations</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--sage)' }}>{currency(ds.total_donations ?? collected)}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Lifetime donations collected</div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Icon color="var(--ink)">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/>
            </Icon>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Assigned Data</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{stats.total ?? ts.stats?.total ?? 0}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Total donors assigned</div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Icon color="#8b5cf6">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/>
            </Icon>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>New Donors Today</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#8b5cf6' }}>{ds.new_donors_today ?? 0}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>First-time donors today</div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Icon color="#8b5cf6">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/>
            </Icon>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>New Donors This Month</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#8b5cf6' }}>{ds.new_donors_monthly ?? 0}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>First-time donors this month</div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Icon color="#f59e0b">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
            </Icon>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Reactivated Today</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b' }}>{ds.reactivated_today ?? 0}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Inactive to active today</div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Icon color="#3b82f6">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
            </Icon>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500, flex: 1 }}>Reactivated This Month</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#3b82f6' }}>{ds.reactivated_monthly ?? 0}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Inactive to active this month</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
        <div className="card" style={{ marginBottom: 0, flex: 1 }}>
          <div className="card-head"><h3>Lead Stats — {monthStr}</h3></div>
          <div className="card-pad">
            {leadStats ? (
              <div style={{ display:'flex', gap:12 }}>
                <div style={{ flex:1, padding:12, borderRadius:8, background:'#eff6ff', border:'1px solid #bfdbfe' }}>
                  <div style={{ fontSize:9, textTransform:'uppercase', fontWeight:600, color:'#3b82f6', marginBottom:2 }}>New Donors</div>
                  <div style={{ fontSize:20, fontWeight:800, color:'#1d4ed8' }}>{leadStats.new_donors}</div>
                  <div style={{ fontSize:10, color:'#3b82f6' }}>₹{Number(leadStats.new_amount).toLocaleString('en-IN')}</div>
                </div>
                <div style={{ flex:1, padding:12, borderRadius:8, background:'#f0fdf4', border:'1px solid #bbf7d0' }}>
                  <div style={{ fontSize:9, textTransform:'uppercase', fontWeight:600, color:'#16a34a', marginBottom:2 }}>Existing Donors</div>
                  <div style={{ fontSize:20, fontWeight:800, color:'#15803d' }}>{leadStats.existing_donors}</div>
                  <div style={{ fontSize:10, color:'#16a34a' }}>₹{Number(leadStats.existing_amount).toLocaleString('en-IN')}</div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign:'center', padding:20, color:'var(--md-outline)', fontSize:11 }}>No lead data for this month.</div>
            )}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0, flex: 1 }}>
          <div className="card-head"><h3>Follow-ups Today</h3></div>
          <div className="card-pad">
            {followUps.length === 0 ? (
              <div style={{ textAlign:'center', padding:20, color:'var(--md-outline)', fontSize:11 }}>No follow-ups scheduled for today.</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {followUps.map(fu => (
                  <div key={fu.id} style={{
                    display:'flex', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:8,
                    background: fu.is_overdue ? '#fef2f2' : '#f0fdf4',
                    border: '1px solid ' + (fu.is_overdue ? '#fecaca' : '#bbf7d0'),
                  }}>
                    <span style={{ fontSize:10, fontWeight:600, color:'var(--ink-soft)', minWidth:50 }}>
                      {new Date(fu.scheduled_at).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
                    </span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, fontWeight:600 }}>{fu.donor_name}</div>
                      <div style={{ fontSize:9, color:'var(--md-outline)' }}>{fu.donor_mobile}</div>
                    </div>
                    {fu.ngo_name && <span className="bento-pill bento-pill-gray" style={{fontSize:8}}>{fu.ngo_name}</span>}
                    {fu.is_overdue && <span className="bento-pill" style={{background:'#f87171', color:'#fff', fontSize:8}}>Overdue</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14, flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:'12px 16px' }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700 }}>Need more donor data?</div>
          <div style={{ fontSize:10, color:'var(--md-outline)', marginTop:2 }}>Request additional assignments or data from the Admin.</div>
        </div>
        <button onClick={() => setShowRequest(true)}
          style={{ padding:'8px 20px', border:'none', borderRadius:8, background:'var(--sage)', color:'#fff', fontSize:11, fontWeight:700, fontFamily:'inherit', cursor:'pointer', display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}>
          <span className="material-symbols-outlined" style={{ fontSize:16 }}>add_circle</span>
          Request More Data
        </button>
      </div>

      {barData.length > 0 && (
        <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
          <div className="card" style={{ marginBottom: 0, flex: 7 }}>
            <div className="card-head"><h3>Target vs Collection</h3></div>
            <div className="card-pad" style={{ width:'100%', height:220 }}>
              <ResponsiveContainer>
                <BarChart data={barData} margin={{ top:8, right:8, left:-8, bottom:4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize:11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v => '₹' + (v / 1000).toFixed(0) + 'k'} />
                  <Tooltip formatter={(v) => [currency(v), 'Amount']} contentStyle={{ fontSize:11, borderRadius:8, border:'1px solid #e2e8f0' }} />
                  <Bar dataKey="amount" radius={[6,6,0,0]} barSize={48}>
                    {barData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card" style={{ marginBottom: 0, flex: 5 }}>
            <div className="card-head"><h3>Donor Status</h3></div>
            <div className="card-pad" style={{ width:'100%', height:220, display:'flex', alignItems:'center', justifyContent:'center' }}>
              {pieData.length > 0 ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={3} dataKey="value">
                      {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ fontSize:11, borderRadius:8, border:'1px solid #e2e8f0' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ fontSize:11, color:'var(--ink-soft)' }}>No status data</div>
              )}
            </div>
            {pieData.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 10px', marginTop:6, justifyContent:'center', paddingBottom: 8 }}>
                {pieData.map(e => (
                  <div key={e.name} style={{ display:'flex', alignItems:'center', gap:4, fontSize:9, color:'var(--ink-soft)' }}>
                    <span style={{ width:8, height:8, borderRadius:2, background:e.color, display:'inline-block' }} />
                    {e.name} ({e.value})
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showMonthlyModal && monthlyDonors.length > 0 && (
        <div style={{ position:'fixed', inset:0, zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.4)' }} onClick={() => { localStorage.setItem('monthly_donors_dismissed', monthStr); setShowMonthlyModal(false); }}>
          <div style={{ background:'#fff', borderRadius:12, width:480, maxHeight:'70vh', display:'flex', flexDirection:'column', boxShadow:'0 8px 32px rgba(0,0,0,.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700 }}>Monthly Recurring Donors</div>
                <div style={{ fontSize:10, color:'var(--ink-soft)' }}>{monthStr} — Donors with 3+ donations history</div>
              </div>
              <button onClick={() => { localStorage.setItem('monthly_donors_dismissed', monthStr); setShowMonthlyModal(false); }}
                style={{ width:28, height:28, border:'none', borderRadius:6, background:'var(--bg)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, lineHeight:1 }}>
                ×
              </button>
            </div>
            <div style={{ overflow:'auto', padding:8, flex:1 }}>
              {monthlyDonors.map(d => (
                <div key={`${d.donor_id}-${d.ngo_id}`} style={{
                  display:'flex', alignItems:'center', gap:10, padding:'8px 12px', marginBottom:4, borderRadius:8,
                  background:'var(--bg)', border:'1px solid var(--line)',
                }}>
                  <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--sage)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>
                    {d.donor_name?.charAt(0) || '?'}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, fontWeight:600 }}>{d.donor_name}</div>
                    <div style={{ fontSize:9, color:'var(--md-outline)' }}>{d.donor_mobile}{d.donor_city ? ` · ${d.donor_city}` : ''}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:10, fontWeight:600 }}>₹{Number(d.amount).toLocaleString('en-IN')}</div>
                    <div style={{ fontSize:8, color:'var(--md-outline)' }}>{d.donation_count} donations</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showRequest && (
        <div style={{ position:'fixed', inset:0, zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.4)' }} onClick={() => { if (!sending) { setShowRequest(false); setReqDone(false) } }}>
          <div style={{ background:'#fff', borderRadius:12, width:400, padding:20, boxShadow:'0 8px 32px rgba(0,0,0,.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>Request More Data</div>
            <div style={{ fontSize:10, color:'var(--ink-soft)', marginBottom:12 }}>Send a request to the Admin for additional donor assignments or data.</div>
            {reqDone ? (
              <div style={{ textAlign:'center', padding:'16px 0', color:'var(--sage)', fontWeight:600, fontSize:12 }}>
                <span className="material-symbols-outlined" style={{ fontSize:18, verticalAlign:'middle', marginRight:4 }}>check_circle</span>
                Request sent successfully
              </div>
            ) : (
              <>
                <textarea value={reqMsg} onChange={e => setReqMsg(e.target.value)} rows={4}
                  placeholder="Describe what data you need..."
                  style={{ width:'100%', padding:8, border:'1px solid var(--line)', borderRadius:6, fontSize:11, fontFamily:'inherit', resize:'vertical', boxSizing:'border-box' }} />
                <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12 }}>
                  <button onClick={() => { setShowRequest(false); setReqMsg('') }}
                    style={{ padding:'7px 16px', border:'1px solid var(--line)', borderRadius:6, background:'#fff', fontSize:11, fontWeight:600, fontFamily:'inherit', cursor:'pointer' }}>Cancel</button>
                  <button onClick={handleSendRequest} disabled={sending || !reqMsg.trim()}
                    style={{ padding:'7px 16px', border:'none', borderRadius:6, background:'var(--sage)', color:'#fff', fontSize:11, fontWeight:700, fontFamily:'inherit', cursor:'pointer', opacity: sending || !reqMsg.trim() ? .5 : 1 }}>
                    {sending ? 'Sending...' : 'Send Request'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <RecentNotices limit={5} />
    </div>
  )
}
