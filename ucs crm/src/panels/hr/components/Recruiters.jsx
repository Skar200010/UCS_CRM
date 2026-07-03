import { useState, useEffect } from 'react';
import { useHR } from '../store';
import { Pill, Dropdown, DatePicker } from './ui';
import { Users, Clock, Check, X, Cal, Heart, Plus } from '../icons';

const calcAge = (dob) => {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / 31557600000);
};

const STATUSES = [
  { key: 'followed_up', label: 'Followed Up', color: '#06b6d4' },
  { key: 'call_back', label: 'Call Back', color: '#06b6d4' },
  { key: 'scheduled', label: 'Scheduled', color: '#3b82f6' },
  { key: 'ringing', label: 'Ringing', color: '#ef4444' },
  { key: 'unreachable', label: 'Unreachable', color: '#ef4444' },
  { key: 'busy', label: 'Busy', color: '#ef4444' },
  { key: 'switched_off', label: 'Switched Off', color: '#ef4444' },
  { key: 'wrong_number', label: 'Wrong Number', color: '#ef4444' },
  { key: 'invalid', label: 'Invalid', color: '#ef4444' },
  { key: 'rejected', label: 'Rejected', color: '#ef4444' },
];
const NOT_CONNECTED_OPTIONS = [
  { key: 'ringing', label: 'Ringing', color: '#f59e0b' },
  { key: 'unreachable', label: 'Unreachable', color: '#ef4444' },
  { key: 'busy', label: 'Busy', color: '#f59e0b' },
  { key: 'switched_off', label: 'Switched Off', color: '#6b7280' },
  { key: 'wrong_number', label: 'Wrong Number', color: '#ef4444' },
  { key: 'invalid', label: 'Invalid', color: '#ef4444' },
  { key: 'rejected', label: 'Rejected', color: '#ef4444' },
];
const SOURCES = ['Walk-in', 'LinkedIn', 'Referral', 'Job Portal', 'Other'];

const formatDT = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
};

export default function Recruiters() {
  const { fetchLeads, addLead, updateLead, fetchRecruiters, user } = useHR();
  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [recruiters, setRecruiters] = useState([]);
  const [recruiterFilter, setRecruiterFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', dob: '', source: 'Walk-in', customSource: '', status: '', connectedOption: '', notConnectedOption: '', followUpDateTime: '', callBackTime: '', notes: [], recruiter_id: '' });
  const [newNote, setNewNote] = useState('');
  const [tab, setTab] = useState('all');

  useEffect(() => {
    setLeadsLoading(true);
    fetchLeads().then(d => { setLeads(d); setLeadsLoading(false); }).catch(() => setLeadsLoading(false));
    fetchRecruiters().then(setRecruiters).catch(() => {});
  }, []);

  const filteredLeads = leads.filter(l => {
    if (recruiterFilter && String(l.recruiter_id) !== recruiterFilter) return false;
    if (statusFilter && l.status !== statusFilter) return false;
    if (sourceFilter && l.source !== sourceFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!l.name.toLowerCase().includes(s) && !(l.phone || '').includes(s)) return false;
    }
    return true;
  });

  const scheduledLeads = leads.filter(l => l.status === 'scheduled');

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  const stats = {
    total: leads.length,
    filtered: filteredLeads.length,
    newToday: leads.filter(l => l.created_at?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
    scheduled: leads.filter(l => l.status === 'scheduled').length,
    scheduledTomorrow: leads.filter(l => l.status === 'scheduled' && l.scheduled_date === tomorrowStr).length,

  };

  const openForm = (lead) => {
    if (lead) {
      let notes = [];
      try { notes = typeof lead.notes === 'string' ? JSON.parse(lead.notes) : (lead.notes || []); } catch { notes = []; }
      setForm({
        name: lead.name,
        phone: lead.phone || '',
        dob: lead.dob || '',
        source: lead.source || 'Walk-in',
        customSource: '',
        status: lead.status,
        connectedOption: '',
        notConnectedOption: '',
        followUpDateTime: '',
        callBackTime: '',
        notes,
        recruiter_id: lead.recruiter_id || '',
      });
      setEditingLead(lead);
    } else {
      setForm({ name: '', phone: '', dob: '', source: 'Walk-in', customSource: '', status: '', connectedOption: '', notConnectedOption: '', followUpDateTime: '', callBackTime: '', notes: [], recruiter_id: '' });
      setEditingLead(null);
    }
    setNewNote('');
    setShowForm(true);
  };

  const addNote = () => {
    if (!newNote.trim()) return;
    const note = {
      text: newNote.trim(),
      date: new Date().toISOString(),
      added_by: user?.name || 'HR User',
    };
    setForm(f => ({ ...f, notes: [...f.notes, note] }));
    setNewNote('');
  };

  const removeNote = (idx) => {
    setForm(f => ({ ...f, notes: f.notes.filter((_, i) => i !== idx) }));
  };

  const submitForm = async () => {
    if (!form.name.trim()) return;
    try {
      const finalSource = form.source === 'Other' ? (form.customSource.trim() || 'Other') : form.source;
      const finalStatus = form.connectedOption === 'follow_up' && form.followUpDateTime ? 'followed_up' : form.connectedOption === 'call_back' && form.callBackTime ? 'call_back' : form.notConnectedOption || form.status;
      const payload = {
        name: form.name.trim(),
        phone: form.phone || null,
        dob: form.dob || null,
        source: finalSource,
        status: finalStatus,
        notes: JSON.stringify(form.notes),
        recruiter_id: form.recruiter_id || null,
      };
      if (finalStatus === 'followed_up' && form.followUpDateTime) payload.follow_up_date = form.followUpDateTime;
      if (finalStatus === 'call_back' && form.callBackTime) payload.call_back_time = form.callBackTime;
      if (editingLead) {
        await updateLead(editingLead.id, payload);
      } else {
        await addLead(payload);
      }
      setShowForm(false);
      setEditingLead(null);
      setLeadsLoading(true);
      fetchLeads().then(d => { setLeads(d); setLeadsLoading(false); }).catch(() => setLeadsLoading(false));
    } catch {}
  };

  const formAge = form.dob ? calcAge(form.dob) : null;

  return (
    <>
      <div className="stats">
        <div className="stat"><Users width={16}/> <div className="stat-label">Total</div><div className="stat-value">{stats.total}</div></div>
        <div className="stat"><Cal width={16}/> <div className="stat-label">Scheduled</div><div className="stat-value" style={{color:'#3b82f6'}}>{stats.scheduled}</div></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3>Recruiters</h3>
        </div>
        <div className="card-pad">
          {recruiters.length === 0 ? (
            <div className="empty">No recruiters found.</div>
          ) : (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {recruiters.map(r => (
                <div key={r.id} className="recruiter-card" onClick={() => setRecruiterFilter(String(r.id))}>
                  <div className="recruiter-card-name">{r.name}</div>
                  <div className="recruiter-card-stats">
                    <span><strong>{r.leadsCount || 0}</strong> leads</span>
                    <span><strong>{r.scheduled || 0}</strong> scheduled</span>
                  </div>
                </div>
              ))}
              {recruiterFilter && (
                <button className="btn btn-sm" onClick={() => setRecruiterFilter('')} style={{ alignSelf: 'center' }}>
                  Clear filter
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="tabs" style={{marginBottom:0}}>
        <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>All</button>
        <button className={`tab ${tab === 'scheduled' ? 'active' : ''}`} onClick={() => setTab('scheduled')}>
          Scheduled{scheduledLeads.length > 0 && ` (${scheduledLeads.length})`}
        </button>
      </div>

      {tab === 'all' && (
        <div className="card" style={{marginTop:20}}>
          <div className="card-head">
            <h3>Leads {filteredLeads.length !== leads.length && <span className="sub">({filteredLeads.length} of {leads.length})</span>}</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Dropdown className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 130 }}
                options={[{value:'',label:'All statuses'}, ...STATUSES.map(s => ({value:s.key, label:s.label}))]} />
              <Dropdown className="filter-select" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} style={{ width: '100%', maxWidth: 130 }}
                options={[{value:'',label:'All sources'}, ...SOURCES.map(s => ({value:s, label:s}))]} />
              <input className="filter-select" placeholder="Search name or phone…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', maxWidth: 200 }} />
              <button className="btn btn-primary" onClick={() => openForm(null)}><Plus width={16} /> Add Lead</button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Age</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Created by</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {leadsLoading ? (
                  Array.from({length:5}).map((_,i) => (
                    <tr key={i}>
                      <td><div className="sk" style={{height:14,width:100,borderRadius:4}}/></td>
                      <td><div className="sk" style={{height:14,width:80,borderRadius:4}}/></td>
                      <td><div className="sk" style={{height:14,width:30,borderRadius:4}}/></td>
                      <td><div className="sk" style={{height:14,width:60,borderRadius:4}}/></td>
                      <td><div className="sk" style={{height:14,width:50,borderRadius:4}}/></td>
                      <td><div className="sk" style={{height:14,width:80,borderRadius:4}}/></td>
                      <td><div className="sk" style={{height:14,width:70,borderRadius:4}}/></td>
                      <td><div className="sk" style={{height:14,width:40,borderRadius:4}}/></td>
                    </tr>
                  ))
                ) : filteredLeads.length === 0 ? (
                  <tr><td colSpan={8}><div className="empty">No leads found. <button className="btn btn-sm" onClick={() => openForm(null)}>Add one</button></div></td></tr>
                ) : (
                  filteredLeads.map(lead => {
                    const st = STATUSES.find(s => s.key === lead.status) || STATUSES[0];
                    const displayAge = lead.dob ? calcAge(lead.dob) : lead.age;
                    return (
                      <tr key={lead.id} className="rec-lead-row" onClick={() => openForm(lead)} style={{ cursor: 'pointer' }}>
                        <td><strong>{lead.name}</strong></td>
                        <td>{lead.phone || '\u2014'}</td>
                        <td>{displayAge || '\u2014'}</td>
                        <td><Pill status={lead.source} /></td>
                        <td>
                          <span className="status-dot" style={{ background: st.color }} />
                          {st.label}
                        </td>
                        <td className="ink-soft">{lead.created_by_name || '\u2014'}</td>
                        <td className="ink-soft">{lead.created_at?.slice(0, 10)}</td>
                        <td>
                          <button className="btn btn-sm" onClick={e => { e.stopPropagation(); openForm(lead); }}>Edit</button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'scheduled' && (
        <div className="card" style={{marginTop:20}}>
          <div className="card-head">
            <h3>Scheduled interviews</h3>
            <span className="sub">{scheduledLeads.length} lead{scheduledLeads.length!==1?'s':''}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Interview date</th>
                  <th>Scheduled by</th>
                  <th>Scheduled at</th>
                  <th>Source</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {leadsLoading ? (
                  Array.from({length:3}).map((_,i) => (
                    <tr key={i}>
                      <td><div className="sk" style={{height:14,width:100,borderRadius:4}}/></td>
                      <td><div className="sk" style={{height:14,width:80,borderRadius:4}}/></td>
                      <td><div className="sk" style={{height:14,width:80,borderRadius:4}}/></td>
                      <td><div className="sk" style={{height:14,width:80,borderRadius:4}}/></td>
                      <td><div className="sk" style={{height:14,width:70,borderRadius:4}}/></td>
                      <td><div className="sk" style={{height:14,width:60,borderRadius:4}}/></td>
                      <td><div className="sk" style={{height:14,width:40,borderRadius:4}}/></td>
                    </tr>
                  ))
                ) : scheduledLeads.length === 0 ? (
                  <tr><td colSpan={7}><div className="empty">No scheduled interviews.</div></td></tr>
                ) : (
                  scheduledLeads.map(lead => (
                    <tr key={lead.id} className="rec-lead-row" onClick={() => openForm(lead)} style={{ cursor: 'pointer' }}>
                      <td><strong>{lead.name}</strong></td>
                      <td>{lead.phone || '\u2014'}</td>
                      <td>{lead.scheduled_date ? new Date(lead.scheduled_date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '\u2014'}</td>
                      <td>{lead.scheduled_by_name || lead.created_by_name || '\u2014'}</td>
                      <td className="ink-soft">{formatDT(lead.scheduled_at)}</td>
                      <td><Pill status={lead.source} /></td>
                      <td>
                        <button className="btn btn-sm" onClick={e => { e.stopPropagation(); openForm(lead); }}>Edit</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{editingLead ? 'Edit Lead' : 'New Lead'}</h3>
              <button className="btn btn-icon" onClick={() => setShowForm(false)}><X width={18} /></button>
            </div>
            <div className="modal-body">

              <label className="field">Name *
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" autoFocus />
              </label>

              <div className="form-row">
                <label className="field">Phone number
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone number" />
                </label>
                <label className="field">DOB
                  <DatePicker value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} />
                  <div style={{height:'1.3em',fontSize:11,color:'var(--ink-soft)',marginTop:2}}>{formAge !== null ? `Age: ${formAge}` : ''}</div>
                </label>
              </div>

              <div className="form-row">
                <label className="field">Source
                  <Dropdown value={form.source} onChange={v => setForm(f => ({ ...f, source: v, customSource: v !== 'Other' ? '' : f.customSource }))}
                    options={SOURCES.map(s => ({value:s, label:s}))} customTrigger="Other" customValue={form.customSource} onCustomChange={v => setForm(f => ({ ...f, customSource: v }))} />
                </label>
                <label className="field">Connection Status
                  <div style={{display:'flex',gap:8,marginTop:6}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div onClick={()=>setForm(f => ({ ...f, status: f.status==='connected'?'':'connected', connectedOption: '', notConnectedOption: '', followUpDateTime: '', callBackTime: '' }))}
                        style={{padding:'10px 14px',borderRadius:8,border:'1.5px solid var(--line)',cursor:'pointer',textAlign:'center',fontSize:13,fontWeight:500,background:form.status==='connected'?'var(--sage-soft)':'transparent',color:form.status==='connected'?'var(--sage)':'var(--ink)',whiteSpace:'nowrap'}}>Connected</div>
                      {form.status === 'connected' && (
                        <div style={{marginTop:6}}>
                          <Dropdown value={form.connectedOption} onChange={v => setForm(f => ({ ...f, connectedOption: v, followUpDateTime: '', callBackTime: '' }))} options={[{value:'',label:'- Select -'},{value:'follow_up',label:'Follow Up'},{value:'call_back',label:'Call Back'}]} style={{width:'100%'}} />
                          {form.connectedOption === 'follow_up' && (
                            <div style={{display:'inline-flex',alignItems:'center',gap:8,marginTop:6}}>
                              <span style={{fontSize:13,fontWeight:500,color:'var(--ink)'}}>Follow Up</span>
                              <input type="datetime-local" value={form.followUpDateTime} onChange={e => setForm(f => ({ ...f, followUpDateTime: e.target.value }))} style={{width:'auto'}} />
                            </div>
                          )}
                          {form.connectedOption === 'call_back' && (
                            <div style={{display:'inline-flex',alignItems:'center',gap:8,marginTop:6}}>
                              <span style={{fontSize:13,fontWeight:500,color:'var(--ink)'}}>Call Back</span>
                              <input type="time" value={form.callBackTime} onChange={e => setForm(f => ({ ...f, callBackTime: e.target.value }))} style={{width:'auto'}} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div onClick={()=>setForm(f => ({ ...f, status: f.status==='not_connected'?'':'not_connected', connectedOption: '', notConnectedOption: '', followUpDateTime: '', callBackTime: '' }))}
                        style={{padding:'10px 14px',borderRadius:8,border:'1.5px solid var(--line)',cursor:'pointer',textAlign:'center',fontSize:13,fontWeight:500,background:form.status==='not_connected'?'var(--sage-soft)':'transparent',color:form.status==='not_connected'?'var(--sage)':'var(--ink)',whiteSpace:'nowrap'}}>Not Connected</div>
                      {form.status === 'not_connected' && (
                        <Dropdown value={form.notConnectedOption} onChange={v => setForm(f => ({ ...f, notConnectedOption: v }))}
                          options={NOT_CONNECTED_OPTIONS.map(s => ({value:s.key, label:s.label}))} style={{width:'100%',marginTop:6}} />
                      )}
                    </div>
                  </div>
                </label>
              </div>

              <label className="field">Assigned to
                <Dropdown value={form.recruiter_id} onChange={e => setForm(f => ({ ...f, recruiter_id: e.target.value }))}
                  options={[{value:'',label:'\u2014 Unassigned \u2014'}, ...recruiters.map(r => ({value:r.id, label:r.name}))]} />
              </label>

              <label className="field" style={{ marginTop: 4 }}>Notes</label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input value={newNote} onChange={e => setNewNote(e.target.value)}
                  placeholder="Add a note…" style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontSize: 13, outline: 'none', background: 'var(--paper)', color: 'var(--ink)', fontFamily: 'inherit' }}
                  onKeyDown={e => { if (e.key === 'Enter') addNote(); }} />
                <button className="btn btn-sm" onClick={addNote} disabled={!newNote.trim()}>Add</button>
              </div>
              {form.notes.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>No notes yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {form.notes.map((n, i) => (
                    <div key={i} style={{ padding: '8px 10px', background: 'var(--sand)', borderRadius: 'var(--radius-sm)', fontSize: 13, position: 'relative' }}>
                      <div style={{ paddingRight: 20 }}>{n.text}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4 }}>
                        {n.added_by} · {new Date(n.date).toLocaleDateString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                      </div>
                      <button className="btn btn-icon" onClick={() => removeNote(i)}
                        style={{ position: 'absolute', top: 4, right: 4, padding: 2, fontSize: 14, lineHeight: 1, color: 'var(--danger)' }} title="Remove note">
                        <X width={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitForm}>{editingLead ? 'Save' : 'Add Lead'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
