import { useState, useEffect } from 'react'
import { api } from '../api/auth'
import AttendanceCalendar from './AttendanceCalendar'

export default function WorkerDetail({ workerId, onBack }) {
  const [worker, setWorker] = useState(null)
  const [allocations, setAllocations] = useState([])
  const [salary, setSalary] = useState(null)
  const [froStats, setFroStats] = useState(null)
  const [ngos, setNgos] = useState([])
  const [err, setErr] = useState('')

  useEffect(() => {
    Promise.all([
      api(`/workers/${workerId}`),
      api(`/workers/${workerId}/allocations`),
      api(`/salary/worker/${workerId}/allocations`).catch(() => null),
    ]).then(([w, a, s]) => {
      setWorker(w); setAllocations(a || []); setSalary(s)
    }).catch(e => setErr(e.message))
  }, [workerId])

  useEffect(() => {
    if (worker?.department?.toLowerCase() === 'fro') {
      api(`/dashboard/fro-worker/${workerId}`).then(setFroStats).catch(() => {})
      api('/ngos').then(setNgos).catch(() => {})
    }
  }, [workerId, worker?.department])

  const allocatedNgoIds = new Set(allocations.map(a => a.ngo_id))

  if (err) return <div className="sa-err-card">{err}</div>
  if (!worker) return (
    <div className="sa-page">
      <div className="sa-page-header" style={{marginBottom:16}}>
        <div className="sk" style={{width:100,height:18}} />
        <div className="sk" style={{width:60,height:32,borderRadius:6}} />
      </div>
      <div className="sa-card">
        <div style={{display:'flex',gap:16,alignItems:'center',marginBottom:20}}>
          <div className="sk" style={{width:64,height:64,borderRadius:12}} />
          <div><div className="sk" style={{width:180,height:16,marginBottom:6}} /><div className="sk" style={{width:120,height:12}} /></div>
        </div>
        <div className="detail-grid">
          {[1,2,3,4,5,6].map(i => <div key={i} className="detail-field"><div className="sk" style={{width:'50%',height:10,marginBottom:4}} /><div className="sk" style={{width:'80%',height:14}} /></div>)}
        </div>
      </div>
    </div>
  )

  const formatMoney = (v) => v ? `₹${Number(v).toLocaleString()}` : '₹0'

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <button className="btn" onClick={onBack}>← Back</button>
        <h3 style={{margin:'8px 0 0'}}>{worker.name}</h3>
      </div>

      <div className="sa-card">
        <h3 className="sa-card-title">Personal Info</h3>
        <table className="sa-info-table">
          <tbody>
            <tr><td>Login ID</td><td><code>{worker.login_id}</code></td></tr>
            <tr><td>Department</td><td>{worker.department || '—'}</td></tr>
            <tr><td>Email</td><td>{worker.email || '—'}</td></tr>
            <tr><td>Phone</td><td>{worker.phone || '—'}</td></tr>
            <tr><td>Gender</td><td>{worker.gender || '—'}</td></tr>
            <tr><td>DOB</td><td>{worker.dob || '—'}</td></tr>
            <tr><td>Salary</td><td>{formatMoney(worker.salary)}</td></tr>
            <tr><td>Status</td><td><span className={`sa-badge ${worker.is_active !== false ? 'active' : 'inactive'}`}>
              {worker.is_active !== false ? 'Active' : 'Inactive'}
            </span></td></tr>
            <tr><td>Joined</td><td>{worker.created_at ? new Date(worker.created_at).toLocaleDateString() : '—'}</td></tr>
          </tbody>
        </table>
      </div>

      <AttendanceCalendar workerId={workerId} worker={worker} />

      {salary && (
        <div className="sa-card">
          <h3 className="sa-card-title">Salary Breakdown</h3>
          <div className="sa-stat-grid salary-grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))'}}>
            <div className="salary-stat-card">
              <span className="material-symbols-outlined sal-icon" style={{color:'#5C6BC0'}}>account_balance_wallet</span>
              <div className="fro-card-body">
                <div className="sa-stat-label">Total Salary</div>
                <div className="sa-stat-value" style={{color:'#5C6BC0'}}>{formatMoney(salary.totalSalary)}</div>
              </div>
            </div>
            <div className="salary-stat-card">
              <span className="material-symbols-outlined sal-icon" style={{color:'#26A69A'}}>payments</span>
              <div className="fro-card-body">
                <div className="sa-stat-label">Per Day</div>
                <div className="sa-stat-value" style={{color:'#26A69A'}}>{formatMoney(salary.perDay)}</div>
              </div>
            </div>
            <div className="salary-stat-card">
              <span className="material-symbols-outlined sal-icon" style={{color:'#FF7043'}}>calendar_month</span>
              <div className="fro-card-body">
                <div className="sa-stat-label">Days in Month</div>
                <div className="sa-stat-value" style={{color:'#FF7043'}}>{salary.daysInMonth || '—'}</div>
              </div>
            </div>
            {salary.sundayBonus?.incentiveAKI ? <div className="salary-stat-card">
              <span className="material-symbols-outlined sal-icon" style={{color:'#AB47BC'}}>military_tech</span>
              <div className="fro-card-body">
                <div className="sa-stat-label">Incentive AKI</div>
                <div className="sa-stat-value" style={{color:'#AB47BC'}}>{formatMoney(salary.sundayBonus.incentiveAKI)}</div>
              </div>
            </div> : null}
            {salary.sundayBonus?.incentiveMonthly ? <div className="salary-stat-card">
              <span className="material-symbols-outlined sal-icon" style={{color:'#42A5F5'}}>trending_up</span>
              <div className="fro-card-body">
                <div className="sa-stat-label">Monthly Incentive</div>
                <div className="sa-stat-value" style={{color:'#42A5F5'}}>{formatMoney(salary.sundayBonus.incentiveMonthly)}</div>
              </div>
            </div> : null}
            {salary.sundayBonus?.bonusAmount ? <div className="salary-stat-card">
              <span className="material-symbols-outlined sal-icon" style={{color:'#FFA726'}}>celebration</span>
              <div className="fro-card-body">
                <div className="sa-stat-label">Sunday Bonus</div>
                <div className="sa-stat-value" style={{color:'#FFA726'}}>{formatMoney(salary.sundayBonus.bonusAmount)}</div>
              </div>
            </div> : null}
          </div>
        </div>
      )}

      {worker?.department?.toLowerCase() === 'fro' && ngos.length > 0 && (
        <div className="sa-card">
          <h3 className="sa-card-title">NGO-FRO</h3>
          <div className="ngo-fro-list">
            {ngos.filter(ngo => allocatedNgoIds.has(ngo.id)).map(ngo => (
              <div key={ngo.id} className="ngo-fro-row">
                <span className="ngo-fro-name">{ngo.name}</span>
                <span className="ngo-fro-status working">Working</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {froStats && (
        <div className="sa-card">
          <h3 className="sa-card-title">FRO Performance</h3>
          <div className="sa-stat-grid fro-grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))'}}>
            <div className="fro-stat-card">
              <span className="material-symbols-outlined fro-icon" style={{color:'#2e7d32'}}>payments</span>
              <div className="fro-card-body">
                <div className="sa-stat-label">Total Donation</div>
                <div className="sa-stat-value" style={{color:'#2e7d32'}}>₹{Number(froStats.total_donations || 0).toLocaleString()}</div>
              </div>
            </div>
            <div className="fro-stat-card">
              <span className="material-symbols-outlined fro-icon" style={{color:'#1565c0'}}>trending_up</span>
              <div className="fro-card-body">
                <div className="sa-stat-label">Daily Donation</div>
                <div className="sa-stat-value" style={{color:'#1565c0'}}>₹{Number(froStats.daily_donations || 0).toLocaleString()}</div>
              </div>
            </div>
            <div className="fro-stat-card">
              <span className="material-symbols-outlined fro-icon" style={{color:'#e65100'}}>person_add</span>
              <div className="fro-card-body">
                <div className="sa-stat-label">New Donors Today</div>
                <div className="sa-stat-value" style={{color:'#e65100'}}>{froStats.new_donors_today || 0}</div>
              </div>
            </div>
            <div className="fro-stat-card">
              <span className="material-symbols-outlined fro-icon" style={{color:'#6a1b9a'}}>database</span>
              <div className="fro-card-body">
                <div className="sa-stat-label">Assigned Data</div>
                <div className="sa-stat-value" style={{color:'#6a1b9a'}}>{froStats.assigned_data || 0}</div>
              </div>
            </div>
            <div className="fro-stat-card">
              <span className="material-symbols-outlined fro-icon" style={{color:'#00838f'}}>check_circle</span>
              <div className="fro-card-body">
                <div className="sa-stat-label">Data Used</div>
                <div className="sa-stat-value" style={{color:'#00838f'}}>{froStats.data_used || 0}</div>
              </div>
            </div>
            <div className="fro-stat-card">
              <span className="material-symbols-outlined fro-icon" style={{color:'#c62828'}}>hourglass_empty</span>
              <div className="fro-card-body">
                <div className="sa-stat-label">Data Unused</div>
                <div className="sa-stat-value" style={{color:'#c62828'}}>{froStats.data_unused || 0}</div>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`
.fro-stat-card {
  background: #f8fbff;
  border-radius: 10px;
  padding: 12px;
  transition: all 0.25s ease;
  border: 1px solid #d0e4f5;
  border-left: 4px solid #3485d4;
  display: flex;
  align-items: center;
  gap: 12px;
}
.fro-stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(52,133,212,0.2);
}
.fro-icon {
  font-size: 28px !important;
  flex-shrink: 0;
}
.fro-card-body {
  flex: 1;
  min-width: 0;
}
.fro-card-body .sa-stat-label {
  white-space: nowrap;
}
.fro-card-body .sa-stat-value {
  font-weight: 700;
  font-size: 16px;
}
.salary-stat-card {
  background: #fff;
  border-radius: 10px;
  padding: 12px;
  transition: all 0.25s ease;
  border: 1px solid #d0e4f5;
  border-left: 4px solid #3485d4;
  display: flex;
  align-items: center;
  gap: 12px;
}
.salary-stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(0,0,0,0.08);
}
.sal-icon {
  font-size: 28px !important;
  flex-shrink: 0;
}
.ngo-fro-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ngo-fro-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #f8fbff;
  border: 1px solid #d0e4f5;
  border-left: 4px solid #3485d4;
  border-radius: 8px;
}
.ngo-fro-name {
  font-weight: 600;
  color: #333;
}
.ngo-fro-status {
  font-size: 12px;
  font-weight: 600;
  padding: 3px 12px;
  border-radius: 20px;
  text-transform: uppercase;
  letter-spacing: .3px;
}
.ngo-fro-status.working {
  background: #d4edda;
  color: #155724;
}

`}</style>
    </div>
  )
}
