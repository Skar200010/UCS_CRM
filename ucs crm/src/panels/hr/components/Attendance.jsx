import { useEffect, useState } from 'react';
import { useHR } from '../store';
import { Dropdown } from './ui';

const IST_OFFSET = 5.5 * 60 * 60 * 1000;
const API_BASE = import.meta.env.VITE_API_URL || 'https://attendance-roan-zeta.vercel.app/api';

function fmtTime(iso) {
  if (!iso) return <span className="time-cell dim">&mdash;</span>;
  const d = new Date(new Date(iso).getTime() + IST_OFFSET);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return <span className="time-cell">{hh}:{mm}</span>;
}

function fmtDuration(mins) {
  const m = Math.max(0, Math.round(mins));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m`;
}

function LiveHours({ punchIn, punchOut }) {
  const punchInMs = new Date(punchIn).getTime();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (punchOut) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [punchOut]);

  if (punchOut) {
    const d = new Date(punchOut).getTime();
    const diff = Math.max(0, (d - punchInMs) / 60000);
    return <span className="time-cell">{fmtDuration(diff)}</span>;
  }

  const diff = Math.max(0, (now - punchInMs) / 60000);
  return <span className="time-cell" style={{ fontWeight: 700, color: 'var(--sage)' }}>{fmtDuration(diff)}</span>;
}

function getIstDateStr(date) {
  const ist = new Date(date.getTime() + IST_OFFSET);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function Badge({ status }) {
  const map = {
    present: { cls: 'badge-present', lbl: 'Present' },
    late: { cls: 'badge-late', lbl: 'Late' },
    absent: { cls: 'badge-absent', lbl: 'Absent' },
    leave: { cls: 'badge-leave', lbl: 'Leave' },
  };
  const { cls, lbl } = map[status] || { cls: 'badge-pending', lbl: status || '\u2014' };
  return <span className={`badge ${cls}`}>{lbl}</span>;
}

export default function Attendance() {
  const { fetchAttendance, fetchWorkers } = useHR();
  const [attendance, setAttendance] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [tab, setTab] = useState('today');
  const [punchStatus, setPunchStatus] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilterH, setDeptFilterH] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchToday, setSearchToday] = useState('');
  const [searchWorker, setSearchWorker] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [workerAttendance, setWorkerAttendance] = useState([]);
  const [addingRecord, setAddingRecord] = useState(false);
  const [addDate, setAddDate] = useState('');
  const [addPunchIn, setAddPunchIn] = useState('');
  const [addPunchOut, setAddPunchOut] = useState('');
  const [addStatus, setAddStatus] = useState('present');
  const [addLoading, setAddLoading] = useState(false);

  const depts = [...new Set((workers || []).map(w => w.department).filter(Boolean))].sort();
  const roles = [...new Set((workers || []).map(w => (w.department || 'Team Member')).filter(Boolean))].sort();

  const todayIST = getIstDateStr(new Date());
  const allToday = attendance.filter(a => a.date === todayIST);
  const todayMap = {};
  allToday.forEach(r => { todayMap[r.worker_id] = r; });

  const todayCombined = (workers || []).filter(w => {
    const role = w.department || 'Team Member';
    if (roleFilter && role !== roleFilter) return false;
    return true;
  }).map(w => {
    const record = todayMap[w.id];
    if (record) { record.workers = w; return record; }
    return {
      id: 'absent-' + w.id,
      worker_id: w.id,
      date: todayIST,
      status: 'absent',
      punch_in_time: null,
      punch_out_time: null,
      late_minutes: 0,
      hours_worked: null,
      workers: w,
    };
  });
  const todaySorted = [...todayCombined].sort((a, b) => {
    const aAbsent = a.status === 'absent';
    const bAbsent = b.status === 'absent';
    if (aAbsent !== bAbsent) return aAbsent ? 1 : -1;
    if (!aAbsent && !bAbsent) {
      const aIn = a.punch_in_time || 'Z';
      const bIn = b.punch_in_time || 'Z';
      return aIn < bIn ? -1 : aIn > bIn ? 1 : 0;
    }
    return 0;
  });
  const todaySearched = todaySorted.filter(r => {
    if (!searchToday) return true;
    const n = (r.workers?.name || '').toLowerCase();
    return n.includes(searchToday.toLowerCase());
  });
  const todayRecords = punchStatus ? todaySearched.filter(r => r.status === punchStatus) : todaySearched;

  useEffect(() => {
    const d = new Date();
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setMonthFilter(m);
    fetchAttendance().then(setAttendance).catch(() => {});
    fetchWorkers().then(setWorkers).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedWorker) {
      const records = attendance.filter(a => a.worker_id === selectedWorker.id && a.id && !a.id.startsWith('absent-'));
      setWorkerAttendance(records);
    }
  }, [attendance, selectedWorker]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const [a, w] = await Promise.all([fetchAttendance(), fetchWorkers()]);
    setAttendance(a); setWorkers(w);
    setRefreshing(false);
  };

  const refreshData = () => {
    fetchAttendance().then(setAttendance).catch(() => {});
  };

  const historyRecords = attendance.filter(r => {
    const worker = workers.find(w => w.id === r.worker_id);
    if (worker && !r.workers?.id) r.workers = worker;
    if (dayFilter) {
      if (r.date !== dayFilter) return false;
    } else if (monthFilter) {
      if (!r.date.startsWith(monthFilter)) return false;
    }
    if (statusFilter && r.status !== statusFilter) return false;
    if (deptFilterH) {
      const w = r.workers || {};
      if (w.department !== deptFilterH) return false;
    }
    if (searchWorker) {
      const w = r.workers || {};
      const name = (w.name || '').toLowerCase();
      const lid = (w.login_id || '').toLowerCase();
      const s = searchWorker.toLowerCase();
      if (!name.includes(s) && !lid.includes(s)) return false;
    }
    return true;
  });

  const viewWorker = (workerId) => {
    const worker = workers.find(w => w.id === workerId);
    if (!worker) return;
    setSelectedWorker(worker);
  };

  const backToOverview = () => {
    setSelectedWorker(null);
  };

  const onTime = todayCombined.filter(r => r.status === 'present').length;
  const lateCount = todayCombined.filter(r => r.status === 'late').length;
  const absentCount = todayCombined.filter(r => r.status === 'absent').length;
  const total = todayCombined.length;

  const hPresent = historyRecords.filter(r => r.status === 'present').length;
  const hLate = historyRecords.filter(r => r.status === 'late').length;
  const hAbsent = historyRecords.filter(r => r.status === 'absent').length;

  return (
    <>
      <style>{`
        @media print {
          .sidebar, .mobile-top, .topbar, .hamburger, .tabs, .filters { display: none !important; }
          .main { margin-left: 0 !important; }
          .content-body { padding: 20px !important; }
          .card { box-shadow: none !important; border: none !important; padding: 0 !important; }
          .btn, .btn-sm { display: none !important; }
          .card-title, .search-input { display: none !important; }
          .stats { gap: 6px !important; margin-bottom: 8px !important; }
          .stat { padding: 4px 10px !important; border: 1px solid #ccc !important; }
          .stat-value { font-size: 14px !important; }
          .stat-label { font-size: 9px !important; }
          table { font-size: 10px !important; border-collapse: collapse !important; width: 100% !important; }
          th, td { padding: 4px 8px !important; border: 1px solid #999 !important; text-align: left !important; }
          th { background: #f0f0f0 !important; font-weight: 600 !important; }
          td { color: #000 !important; }
          .table-wrap { overflow: visible !important; }
          .dim { color: #666 !important; }
        }
      `}</style>
      {selectedWorker ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button className="btn btn-sm" onClick={backToOverview}>&larr; Back</button>
            <h2 style={{ margin: 0 }}>{selectedWorker.name}'s Attendance</h2>
            <button className="btn btn-sm" style={{ marginLeft: 'auto', background:'var(--sage)', color:'#fff', border:'none' }} onClick={() => { setAddingRecord(true); setAddDate(''); setAddPunchIn(''); setAddPunchOut(''); setAddStatus('present'); }}>+ Add Attendance</button>
          </div>

          <div className="card" style={{ padding: '20px 22px' }}>
            {workerAttendance.length === 0 ? (
              <div className="empty-state">
                <p>No attendance records found for this worker.</p>
              </div>
            ) : (
              <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>Date</th><th>Punch In</th><th>Punch Out</th></tr>
                      </thead>
                      <tbody>
                        {workerAttendance.map((r, i) => (
                          <tr key={r.id} className={r.status === 'late' ? 'row-late' : ''}>
                            <td>{r.date}</td>
                            <td>{fmtTime(r.punch_in_time)}</td>
                            <td>{fmtTime(r.punch_out_time)}</td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="tabs">
            <button className={'tab' + (tab === 'today' ? ' active' : '')} onClick={() => setTab('today')}>Today&#8217;s Attendance</button>
            <button className={'tab' + (tab === 'history' ? ' active' : '')} onClick={() => setTab('history')}>Attendance History</button>
          </div>

          {tab === 'today' && (
            <div>
              <div className="stats">
                <div className="stat"><div className="stat-label">Total Workers</div><div className="stat-value info">{total}</div></div>
                <div className="stat"><div className="stat-label">Present</div><div className="stat-value success">{onTime + lateCount}</div></div>
                <div className="stat"><div className="stat-label">Late</div><div className="stat-value warning">{lateCount}</div></div>
                <div className="stat"><div className="stat-label">Absent</div><div className="stat-value error">{absentCount}</div></div>
              </div>

              <div className="card" style={{ padding: '20px 22px' }}>
                <div className="card-title" style={{ justifyContent: 'space-between' }}>
                  <span>Workers Present Today &mdash; <span className="today-date">{todayIST}</span></span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button className="btn btn-sm" onClick={() => window.print()}>Print</button>
                    <Dropdown className="role-filter" value={punchStatus} onChange={e => setPunchStatus(e.target.value)}
                      options={[{value:'',label:'All'},{value:'present',label:'Present'},{value:'late',label:'Late'},{value:'absent',label:'Absent'}]} />
                    <Dropdown className="role-filter" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                      options={[{value:'',label:'All members'}, ...roles.map(r => ({value:r, label:r}))]} />
                    <input className="search-input" type="text" placeholder="Search worker&hellip;" value={searchToday} onChange={e => setSearchToday(e.target.value)} style={{ marginTop: 0, width: 140, padding: '4px 8px', fontSize: 12 }} />
                    <button className="btn btn-sm" onClick={handleRefresh} title="Refresh" disabled={refreshing}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: refreshing ? 'spin .6s linear infinite' : 'none' }}><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.4-3.4L23 10M1 14l5.1 4.4A9 9 0 0 0 20.5 15"/></svg>
                    </button>
                  </div>
                </div>

                {todayRecords.length === 0 ? (
                  <div className="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <p>No attendance records for today yet.</p>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>Name</th><th>Punch In</th><th>Punch Out</th></tr>
                      </thead>
                      <tbody>
                          {todayRecords.map((r, i) => {
                          const w = r.workers || {};
                          const cls = r.status === 'absent' ? 'row-absent' : r.status === 'late' ? 'row-late' : '';
                          return (
                            <tr key={r.id} className={cls}>
                              <td>
                                {r.status === 'absent' && <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:'#ef4444', marginRight:6, verticalAlign:'middle' }} />}
                                {r.status === 'late' && <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:'#f59e0b', marginRight:6, verticalAlign:'middle' }} />}
                                {r.status === 'present' && <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:'#10b981', marginRight:6, verticalAlign:'middle' }} />}
                                <a href="#" className="worker-link" onClick={e => { e.preventDefault(); viewWorker(w.id); }}><strong>{w.name || 'Unknown'}</strong></a>
                                {r.status === 'absent' && <span style={{ fontSize:10, color:'#ef4444', marginLeft:4 }}>(Absent)</span>}
                                {r.status === 'late' && <span style={{ fontSize:10, color:'#f59e0b', marginLeft:4 }}>(Late)</span>}
                              </td>
                              <td>{fmtTime(r.punch_in_time)}</td>
                              <td>{fmtTime(r.punch_out_time)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            </div>
          )}

          {tab === 'history' && (
            <div>
              <div className="card" style={{ padding: '20px 22px' }}>
                <div className="filters">
                  <div className="filter-group">
                    <label>Month</label>
                    <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
                      style={{ fontSize: 13, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line, #e5e7eb)' }} />
                   </div>
                   <div className="filter-group">
                     <label>Single Day</label>
                     <input type="date" value={dayFilter} onChange={e => setDayFilter(e.target.value)}
                       style={{ fontSize: 13, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line, #e5e7eb)' }} />
                  </div>
                  <div className="filter-group">
                    <label>Department</label>
                    <Dropdown value={deptFilterH} onChange={e => setDeptFilterH(e.target.value)}
                      options={[{value:'',label:'All'}, ...depts.map(d => ({value:d,label:d}))]} />
                  </div>
                  <div className="filter-group">
                    <label>Status</label>
                    <Dropdown value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                      options={[{value:'',label:'All'},{value:'present',label:'Present'},{value:'late',label:'Late'},{value:'absent',label:'Absent'}]} />
                  </div>
                  <div className="filter-group">
                    <label>Search Worker</label>
                    <input type="text" placeholder="Name or ID&hellip;" value={searchWorker} onChange={e => setSearchWorker(e.target.value)} />
                  </div>
                  <div className="filter-group" style={{ flex: 0 }}>
                    <label>&nbsp;</label>
                    <button className="btn btn-primary" onClick={refreshData} style={{ whiteSpace: 'nowrap' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.4-3.4L23 10M1 14l5.1 4.4A9 9 0 0 0 20.5 15"/></svg>
                      Refresh
                    </button>
                  </div>
                </div>
              </div>

              <div className="stats">
                <div className="stat"><div className="stat-label">Total Records</div><div className="stat-value info">{historyRecords.length}</div></div>
                <div className="stat"><div className="stat-label">Present</div><div className="stat-value success">{hPresent}</div></div>
                <div className="stat"><div className="stat-label">Late</div><div className="stat-value warning">{hLate}</div></div>
                <div className="stat"><div className="stat-label">Absent</div><div className="stat-value error">{hAbsent}</div></div>
              </div>

              <div className="card" style={{ padding: '20px 22px' }}>
                <div className="card-title" style={{ justifyContent: 'space-between' }}>
                  <span>Attendance History</span>
                  <button className="btn btn-sm" onClick={() => window.print()}>Print</button>
                </div>
                {historyRecords.length === 0 ? (
                  <div className="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <p>No records found for the selected filters.</p>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>Date</th><th>Name</th><th>Punch In</th><th>Punch Out</th></tr>
                      </thead>
                      <tbody>
                          {historyRecords.map((r, i) => {
                          const w = r.workers || {};
                          const cls = r.status === 'absent' ? 'row-absent' : r.status === 'late' ? 'row-late' : '';
                          return (
                            <tr key={r.id} className={cls}>
                              <td>{r.date}</td>
                              <td>
                                {r.status === 'absent' && <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:'#ef4444', marginRight:6, verticalAlign:'middle' }} />}
                                {r.status === 'late' && <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:'#f59e0b', marginRight:6, verticalAlign:'middle' }} />}
                                {r.status === 'present' && <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:'#10b981', marginRight:6, verticalAlign:'middle' }} />}
                                <a href="#" className="worker-link" onClick={e => { e.preventDefault(); viewWorker(w.id); }}><strong>{w.name || 'Unknown'}</strong></a>
                                {r.status === 'absent' && <span style={{ fontSize:10, color:'#ef4444', marginLeft:4 }}>(Absent)</span>}
                                {r.status === 'late' && <span style={{ fontSize:10, color:'#f59e0b', marginLeft:4 }}>(Late)</span>}
                              </td>
                              <td>{fmtTime(r.punch_in_time)}</td>
                              <td>{fmtTime(r.punch_out_time)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {addingRecord && (
        <div className="modal-overlay" onClick={() => setAddingRecord(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Add Attendance</h3>
              <button className="btn btn-sm" onClick={() => setAddingRecord(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <label className="field">
                <span>Worker</span>
                <input type="text" value={selectedWorker?.name || ''} disabled />
              </label>
              <label className="field">
                <span>Date</span>
                <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)} required />
              </label>
              <label className="field">
                <span>Punch In Time</span>
                <input type="time" value={addPunchIn} onChange={e => setAddPunchIn(e.target.value)} />
              </label>
              <label className="field">
                <span>Punch Out Time</span>
                <input type="time" value={addPunchOut} onChange={e => setAddPunchOut(e.target.value)} />
              </label>
              <label className="field">
                <span>Status</span>
                <select value={addStatus} onChange={e => setAddStatus(e.target.value)}>
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                  <option value="leave">Leave</option>
                </select>
              </label>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setAddingRecord(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={async () => {
                if (!addDate) { alert('Please select a date'); return; }
                setAddLoading(true);
                try {
                  const body = {
                    worker_id: selectedWorker.id,
                    date: addDate,
                    punch_in_time: addPunchIn ? `${addDate}T${addPunchIn}:00.000Z` : null,
                    punch_out_time: addPunchOut ? `${addDate}T${addPunchOut}:00.000Z` : null,
                    status: addStatus,
                  };
                  const res = await fetch(API_BASE + '/attendance', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: 'Bearer ' + localStorage.getItem('ucs_token'),
                    },
                    body: JSON.stringify(body),
                  });
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({ message: 'Failed to create' }));
                    throw new Error(err.message || 'Creation failed');
                  }
                  fetchAttendance().then(setAttendance).catch(() => {});
                  setAddingRecord(false);
                } catch (err) {
                  alert(err.message);
                } finally {
                  setAddLoading(false);
                }
              }} disabled={addLoading}>
                {addLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
