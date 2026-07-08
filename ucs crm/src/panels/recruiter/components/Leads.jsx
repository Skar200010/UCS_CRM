import { useState } from 'react';
import { useRec, LEAD_SOURCES, LEAD_STATUSES, NOT_CONNECTED_OPTIONS } from '../store';
import { Plus, Users, Search, RefreshCw, Trash, X } from '../icons';
import { Dropdown } from './ui';
import LeadDetail from './LeadDetail';

const calcAge = (dob) => {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / 31557600000);
};

const getJobRole = (lead) => {
  if (lead.job_role) return lead.job_role;
  let notes = [];
  try { notes = JSON.parse(lead.notes || '[]'); } catch {}
  const meta = notes.find(n => n.__meta === true && n.type === 'job_role');
  return meta ? meta.value : null;
};

const statusPill = (s) => {
  const m = { rejected:'pill-danger', hold:'pill-gold', scheduled:'pill-clay' };
  const st = LEAD_STATUSES.find(st => st.value === s);
  return <span className={`pill ${m[s] || 'pill-gray'}`}>{st ? st.label : s}</span>;
};

const formatDT = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
};

const SkeletonRow = ({ cols }) => (
  <tr>
    {Array.from({length:cols}).map((_,i) => (
      <td key={i}><div className="skeleton" style={{height:14,width:i===0?100:60}}/></td>
    ))}
  </tr>
);

const TABS = [
  { key:'leads', label:'Leads' },
  { key:'scheduled', label:'Scheduled' },
];

export default function Leads() {
  const { leads, leadsLoading, addLead, updateLead, deleteLead, currentUser, user, refreshLeads, leadFilters, setLeadFilters, jobs } = useRec();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [source, setSource] = useState('Walk-in');
  const [customSource, setCustomSource] = useState('');
  const [notConnectedOption, setNotConnectedOption] = useState('');
  const [connectedOption, setConnectedOption] = useState('');
  const [followUpDateTime, setFollowUpDateTime] = useState('');
  const [callBackTime, setCallBackTime] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [formNotes, setFormNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [selectedJobRole, setSelectedJobRole] = useState('');
  const [customJobRole, setCustomJobRole] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [searchInput, setSearchInput] = useState(leadFilters.search || '');
  const [tab, setTab] = useState('leads');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteMsg, setDeleteMsg] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (id) => {
    setDeleting(true);
    try {
      await deleteLead(id);
      setDeleteMsg('Lead deleted successfully.');
      setDeleteConfirm(null);
      setTimeout(() => setDeleteMsg(''), 3000);
    } catch {
      setDeleteMsg('Failed to delete lead.');
      setTimeout(() => setDeleteMsg(''), 3000);
    } finally {
      setDeleting(false);
    }
  };

  const addNoteToForm = () => {
    if (!noteText.trim()) return;
    const n = { text: noteText.trim(), date: new Date().toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}), by: user.name };
    setFormNotes(p => [...p, n]); setNoteText('');
  };

  const removeFormNote = (i) => setFormNotes(p => p.filter((_,idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    try {
      const finalSource = source === 'Other' ? (customSource.trim() || 'Other') : source;
      const finalStatus = connectedOption === 'follow_up' ? 'followed_up' : connectedOption === 'call_back' ? 'call_back' : connectedOption === 'schedule' ? 'scheduled' : connectedOption === 'not_interested' ? 'not_interested' : notConnectedOption;
      const finalJobRole = selectedJobRole === 'Other' ? (customJobRole.trim() || 'Other') : selectedJobRole;
      const notesArr = [...formNotes];
      if (finalJobRole) notesArr.unshift({ __meta: true, type: 'job_role', value: finalJobRole });
      const payload = { name: name.trim(), phone, dob: dob || null, source: finalSource, status: finalStatus, notes: notesArr.length ? JSON.stringify(notesArr) : null, job_role: finalJobRole || null, created_by_name: user.name };
      if (finalStatus === 'followed_up' && followUpDateTime) payload.follow_up_date = followUpDateTime;
      if (finalStatus === 'call_back' && callBackTime) payload.call_back_time = callBackTime;
      if (finalStatus === 'scheduled' && scheduledDate) payload.scheduled_date = scheduledDate;
      await addLead(payload);
      setLeadFilters(p => ({ ...p, status: '', source: '' }));
      setName(''); setPhone(''); setDob(''); setSource('Walk-in'); setCustomSource(''); setConnectedOption(''); setNotConnectedOption(''); setFollowUpDateTime(''); setCallBackTime(''); setScheduledDate(''); setFormNotes([]); setSelectedJobRole(''); setCustomJobRole('');
    } catch (err) { alert(err.message); }
  };

  const updateLeadStatus = async (id, newStatus) => {
    await updateLead(id, { status: newStatus });
  };

  const handleSearch = () => {
    setLeadFilters(p => ({ ...p, search: searchInput }));
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const age = calcAge(dob);
  const myId = user?.id;
  const filteredLeads = leads.filter(l => {
    if (leadFilters.search) {
      const s = leadFilters.search.toLowerCase();
      if (!l.name.toLowerCase().includes(s) && !(l.phone||'').includes(s)) return false;
    }
    if (leadFilters.status && l.status !== leadFilters.status) return false;
    if (leadFilters.source && l.source !== leadFilters.source) return false;
    return true;
  });

  const scheduledLeads = leads.filter(l => l.status === 'scheduled');
  const selectedLead = selectedLeadId ? leads.find(l => l.id === selectedLeadId) : null;


  if (selectedLead) {
    return (
      <>
        <div className="card" style={{marginBottom:20}}>
          <div className="card-head"><h3><Users width={18}/> Add new lead</h3></div>
          <form className="card-pad" onSubmit={handleSubmit}>
            <div className="form-row">
              <label className="field">Name
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Arun Sharma" required />
              </label>
              <label className="field">Phone
                <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="e.g. 9876543210" required />
              </label>
              <label className="field">DOB
                <input type="date" value={dob} onChange={e=>setDob(e.target.value)} />
                <div style={{height:'1.3em',fontSize:11,color:'var(--ink-soft)',marginTop:2}}>{age !== null ? `Age: ${age}` : ''}</div>
              </label>
              <label className="field">Source
                <Dropdown value={source} onChange={e=>{setSource(e.target.value);if(e.target.value!=='Other')setCustomSource('')}} options={LEAD_SOURCES} customTrigger="Other" customValue={customSource} onCustomChange={setCustomSource} />
              </label>
            </div>
            <div className="card" style={{marginTop:12,border:'1.5px solid var(--line)',borderRadius:'var(--radius)'}}>
              <div className="card-head"><h4 style={{fontSize:13,fontWeight:600,margin:0}}>CONNECTION STATUS</h4></div>
              <div className="card-pad">
                <div style={{display:'flex',gap:16}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:'var(--ink)',marginBottom:4}}>CONNECTED <span style={{color:'var(--danger)'}}>*</span></div>
                    <Dropdown menuInset value={connectedOption} onChange={e=>{setConnectedOption(e.target.value);setFollowUpDateTime('');setCallBackTime('');setScheduledDate('')}} options={[{value:'',label:'Select'},{value:'follow_up',label:'Follow Up'},{value:'call_back',label:'Call Back'},{value:'schedule',label:'Schedule'},{value:'not_interested',label:'Not Interested'}]} style={{width:'100%'}} />
                    {connectedOption === 'follow_up' && (
                      <div style={{display:'inline-flex',alignItems:'center',gap:8,marginTop:6}}>
                        <span style={{fontSize:13,fontWeight:500,color:'var(--ink)'}}>Follow Up</span>
                        <input type="datetime-local" value={followUpDateTime} onChange={e=>setFollowUpDateTime(e.target.value)} style={{width:'auto'}} />
                      </div>
                    )}
                    {connectedOption === 'call_back' && (
                      <div style={{display:'inline-flex',alignItems:'center',gap:8,marginTop:6}}>
                        <span style={{fontSize:13,fontWeight:500,color:'var(--ink)'}}>Call Back</span>
                        <input type="time" value={callBackTime} onChange={e=>setCallBackTime(e.target.value)} style={{width:'auto'}} />
                      </div>
                    )}
                    {connectedOption === 'schedule' && (
                      <div style={{display:'inline-flex',alignItems:'center',gap:8,marginTop:6}}>
                        <span style={{fontSize:13,fontWeight:500,color:'var(--ink)'}}>Schedule</span>
                        <input type="datetime-local" value={scheduledDate} onChange={e=>setScheduledDate(e.target.value)} style={{width:'auto'}} />
                      </div>
                    )}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:'var(--ink)',marginBottom:4}}>NOT CONNECTED <span style={{color:'var(--danger)'}}>*</span></div>
                    <Dropdown menuInset value={notConnectedOption} onChange={e=>setNotConnectedOption(e.target.value)} options={[{value:'',label:'Select'},...NOT_CONNECTED_OPTIONS]} style={{width:'100%'}} />
                  </div>
                </div>
                <div style={{marginTop:14,paddingTop:14,borderTop:'1px solid var(--line)'}}>
                  <div style={{fontSize:12,fontWeight:600,color:'var(--ink)',marginBottom:6}}>JOB DESCRIPTION *</div>
                  <Dropdown menuInset value={selectedJobRole} onChange={e=>{setSelectedJobRole(e.target.value);if(e.target.value!=='Other')setCustomJobRole('')}} options={[{value:'',label:'Select a role'},{value:'Web Developer',label:'Web Developer'},{value:'Calling',label:'Calling'},{value:'Digital Marketing',label:'Digital Marketing'},{value:'HR',label:'HR'},{value:'Graphic Designer',label:'Graphic Designer'},{value:'Content Writer',label:'Content Writer'},{value:'SEO Specialist',label:'SEO Specialist'},{value:'Sales Executive',label:'Sales Executive'},{value:'Business Analyst',label:'Business Analyst'},{value:'Data Entry',label:'Data Entry'},{value:'Accountant',label:'Accountant'},{value:'Social Media Manager',label:'Social Media Manager'},{value:'Video Editor',label:'Video Editor'},{value:'Other',label:'Other'}]} customTrigger="Other" customValue={customJobRole} onCustomChange={setCustomJobRole} style={{width:'100%',maxWidth:280}} />
                </div>
                <div style={{display:'flex',gap:8,marginTop:16,justifyContent:'flex-end'}}>
                  <button type="button" className="btn" onClick={()=>setSelectedLeadId(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary"><Plus width={15}/> Create lead</button>
                </div>
              </div>
            </div>
          </form>
        </div>

        <LeadDetail lead={selectedLead} onBack={() => setSelectedLeadId(null)} />
      </>
    );
  }

  return (
    <>
      <div className="card" style={{marginBottom:20}}>
        <div className="card-head"><h3><Users width={18}/> Add new lead</h3></div>
        <form className="card-pad" onSubmit={handleSubmit}>
          <div className="form-row">
            <label className="field">Name
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Arun Sharma" required />
            </label>
            <label className="field">Phone
              <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="e.g. 9876543210" required />
            </label>
            <label className="field">DOB
              <input type="date" value={dob} onChange={e=>setDob(e.target.value)} />
              <div style={{height:'1.3em',fontSize:11,color:'var(--ink-soft)',marginTop:2}}>{age !== null ? `Age: ${age}` : ''}</div>
            </label>
            <label className="field">Source
              <Dropdown value={source} onChange={e=>{setSource(e.target.value);if(e.target.value!=='Other')setCustomSource('')}} options={LEAD_SOURCES} customTrigger="Other" customValue={customSource} onCustomChange={setCustomSource} />
            </label>
          </div>
          <div className="card" style={{marginTop:12,border:'1.5px solid var(--line)',borderRadius:'var(--radius)'}}>
            <div className="card-head"><h4 style={{fontSize:13,fontWeight:600,margin:0}}>CONNECTION STATUS</h4></div>
            <div className="card-pad">
              <div style={{display:'flex',gap:16}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:'var(--ink)',marginBottom:4}}>CONNECTED <span style={{color:'var(--danger)'}}>*</span></div>
                  <Dropdown menuInset value={connectedOption} onChange={e=>{setConnectedOption(e.target.value);setFollowUpDateTime('');setCallBackTime('');setScheduledDate('')}} options={[{value:'',label:'Select'},{value:'follow_up',label:'Follow Up'},{value:'call_back',label:'Call Back'},{value:'schedule',label:'Schedule'},{value:'not_interested',label:'Not Interested'}]} style={{width:'100%'}} />
                  {connectedOption === 'follow_up' && (
                    <div style={{display:'inline-flex',alignItems:'center',gap:8,marginTop:6}}>
                      <span style={{fontSize:13,fontWeight:500,color:'var(--ink)'}}>Follow Up</span>
                      <input type="datetime-local" value={followUpDateTime} onChange={e=>setFollowUpDateTime(e.target.value)} style={{width:'auto'}} />
                    </div>
                  )}
                  {connectedOption === 'call_back' && (
                    <div style={{display:'inline-flex',alignItems:'center',gap:8,marginTop:6}}>
                      <span style={{fontSize:13,fontWeight:500,color:'var(--ink)'}}>Call Back</span>
                      <input type="time" value={callBackTime} onChange={e=>setCallBackTime(e.target.value)} style={{width:'auto'}} />
                    </div>
                  )}
                  {connectedOption === 'schedule' && (
                    <div style={{display:'inline-flex',alignItems:'center',gap:8,marginTop:6}}>
                      <span style={{fontSize:13,fontWeight:500,color:'var(--ink)'}}>Schedule</span>
                      <input type="datetime-local" value={scheduledDate} onChange={e=>setScheduledDate(e.target.value)} style={{width:'auto'}} />
                    </div>
                  )}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:'var(--ink)',marginBottom:4}}>NOT CONNECTED <span style={{color:'var(--danger)'}}>*</span></div>
                  <Dropdown menuInset value={notConnectedOption} onChange={e=>setNotConnectedOption(e.target.value)} options={[{value:'',label:'Select'},...NOT_CONNECTED_OPTIONS]} style={{width:'100%'}} />
                </div>
              </div>
              <div style={{marginTop:14,paddingTop:14,borderTop:'1px solid var(--line)'}}>
                <div style={{fontSize:12,fontWeight:600,color:'var(--ink)',marginBottom:6}}>JOB DESCRIPTION *</div>
                <Dropdown menuInset value={selectedJobRole} onChange={e=>{setSelectedJobRole(e.target.value);if(e.target.value!=='Other')setCustomJobRole('')}} options={[{value:'',label:'Select a role'},{value:'Web Developer',label:'Web Developer'},{value:'Calling',label:'Calling'},{value:'Digital Marketing',label:'Digital Marketing'},{value:'HR',label:'HR'},{value:'Graphic Designer',label:'Graphic Designer'},{value:'Content Writer',label:'Content Writer'},{value:'SEO Specialist',label:'SEO Specialist'},{value:'Sales Executive',label:'Sales Executive'},{value:'Business Analyst',label:'Business Analyst'},{value:'Data Entry',label:'Data Entry'},{value:'Accountant',label:'Accountant'},{value:'Social Media Manager',label:'Social Media Manager'},{value:'Video Editor',label:'Video Editor'},{value:'Other',label:'Other'}]} customTrigger="Other" customValue={customJobRole} onCustomChange={setCustomJobRole} style={{width:'100%',maxWidth:280}} />
              </div>
              <div style={{display:'flex',gap:8,marginTop:16,justifyContent:'flex-end'}}>
                <button type="submit" className="btn btn-primary"><Plus width={15}/> Create lead</button>
              </div>
            </div>
          </div>
        </form>
      </div>

      <div className="tabs" style={{marginBottom:0}}>
        {TABS.map(t => {
          const counts = { leads: leads.length, scheduled: scheduledLeads.length };
          const dots = { leads: '#5B6B4E', scheduled: '#3b82f6' };
          return (
            <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
              {counts[t.key] > 0 && <span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:dots[t.key],marginLeft:6,verticalAlign:'middle'}}/>}
            </button>
          );
        })}
      </div>

      {tab === 'leads' && (
        <div className="card" style={{marginTop:20}}>
          <div className="card-head">
            <h3>Leads</h3>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <span className="sub">{leadsLoading ? '…' : filteredLeads.length + ' leads'}</span>
              <button className="btn btn-sm" onClick={refreshLeads} title="Refresh"><RefreshCw width={13}/></button>
            </div>
          </div>
          <div className="card-pad" style={{paddingTop:0,paddingBottom:0}}>
            <div className="filter-bar">
              <div className="search-group">
                <input value={searchInput} onChange={e=>setSearchInput(e.target.value)} onKeyDown={handleSearchKeyDown}
                  placeholder="Search by name or phone…" />
                <button className="btn btn-sm" onClick={handleSearch}><Search width={14}/></button>
              </div>
              <Dropdown className="filter-select" value={leadFilters.status} onChange={e=>setLeadFilters(p=>({...p,status:e.target.value}))}
                options={[{value:'',label:'All statuses'}, ...LEAD_STATUSES]} />
              <Dropdown className="filter-select" value={leadFilters.source} onChange={e=>setLeadFilters(p=>({...p,source:e.target.value}))}
                options={[{value:'',label:'All sources'}, ...LEAD_SOURCES]} />
            </div>
          </div>
          {leadsLoading ? (
            <div style={{overflowX:'auto'}}><table><tbody>{[1,2,3,4,5].map(i => <SkeletonRow key={i} cols={6}/>)}</tbody></table></div>
          ) : filteredLeads.length === 0 ? (
            <div className="empty">No leads found.</div>
          ) : (
            <div style={{overflowX:'auto'}}>
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Phone</th><th>Source</th><th>Status</th><th>Job Description</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map(l => {
                  const isOwner = myId && l.created_by === myId;
                  let parsed = [];
                  try { parsed = JSON.parse(l.notes || '[]'); } catch {}
                  const displayAge = l.dob ? calcAge(l.dob) : l.age;
                  return (
                    <tr key={l.id} onClick={() => setSelectedLeadId(l.id)} style={{cursor:'pointer'}}>
                      <td style={{fontWeight:500}}>{l.name}</td>
                      <td style={{color:'var(--ink-soft)'}}>{l.phone || '—'}</td>
                      <td>{l.source}</td>
                      <td>{isOwner ? (
                        <Dropdown className="inline-select" value={l.status} onChange={e=>updateLeadStatus(l.id, e.target.value)} options={LEAD_STATUSES} />
                      ) : statusPill(l.status)}</td>
                      <td style={{color:'var(--ink-soft)'}}>{getJobRole(l) || '—'}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <span onClick={() => setDeleteConfirm(l)} style={{cursor:'pointer',color:'var(--danger)',fontSize:13,display:'inline-flex',alignItems:'center'}}><Trash width={16}/></span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {tab === 'scheduled' && (
        <div className="card" style={{marginTop:20}}>
          <div className="card-head">
            <h3>Scheduled interviews</h3>
            <span className="sub">{scheduledLeads.length} lead{scheduledLeads.length!==1?'s':''}</span>
          </div>
          {leadsLoading ? (
            <table><tbody>{[1,2,3].map(i => <SkeletonRow key={i} cols={6}/>)}</tbody></table>
          ) : scheduledLeads.length === 0 ? (
            <div className="empty">No scheduled interviews.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Phone</th><th>Interview date</th><th>Scheduled by</th><th>Scheduled at</th><th>Source</th>
                </tr>
              </thead>
              <tbody>
                {scheduledLeads.map(l => (
                  <tr key={l.id} onClick={() => setSelectedLeadId(l.id)} style={{cursor:'pointer'}}>
                    <td style={{fontWeight:500}}>{l.name}</td>
                    <td style={{color:'var(--ink-soft)'}}>{l.phone || '—'}</td>
                    <td>{l.scheduled_date ? new Date(l.scheduled_date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '—'}</td>
                    <td>{l.scheduled_by_name || l.created_by_name || '—'}</td>
                    <td style={{color:'var(--ink-soft)'}}>{formatDT(l.scheduled_at)}</td>
                    <td>{l.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {deleteMsg && (
        <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:'var(--paper)',border:'1px solid var(--line)',borderRadius:'var(--radius)',boxShadow:'var(--shadow)',padding:'10px 20px',fontSize:14,zIndex:1000,display:'flex',alignItems:'center',gap:10}}>
          <span>{deleteMsg}</span>
          <button className="btn btn-sm" onClick={() => setDeleteMsg('')} style={{padding:'2px 6px',lineHeight:1}}><X width={12}/></button>
        </div>
      )}

      {deleteConfirm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.35)',zIndex:999,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={() => setDeleteConfirm(null)}>
          <div style={{background:'var(--paper)',borderRadius:'var(--radius)',boxShadow:'0 8px 32px rgba(0,0,0,.2)',padding:24,minWidth:320}} onClick={e => e.stopPropagation()}>
            <p style={{margin:'0 0 16px',fontSize:14,fontWeight:500}}>Are you sure you want to delete this lead?</p>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn" style={{background:'var(--danger)',color:'#fff',borderColor:'var(--danger)'}} onClick={() => handleDelete(deleteConfirm.id)} disabled={deleting}>{deleting ? <><span className="spinner" style={{width:14,height:14,borderWidth:2,marginRight:6}}/> Deleting...</> : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
