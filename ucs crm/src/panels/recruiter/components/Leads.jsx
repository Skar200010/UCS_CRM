import { useState } from 'react';
import { useRec, LEAD_SOURCES, LEAD_STATUSES } from '../store';
import { Plus, Users, Search, RefreshCw } from '../icons';
import { Dropdown } from './ui';
import LeadDetail from './LeadDetail';

const calcAge = (dob) => {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / 31557600000);
};

const statusPill = (s) => {
  const m = { rejected:'pill-danger', selected:'pill-green', hold:'pill-gold', scheduled:'pill-clay', joined:'pill-gray' };
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
  { key:'rejected', label:'Rejected' },
];

export default function Leads() {
  const { leads, leadsLoading, addLead, updateLead, currentUser, user, refreshLeads, leadFilters, setLeadFilters } = useRec();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [source, setSource] = useState('Walk-in');
  const [customSource, setCustomSource] = useState('');
  const [status, setStatus] = useState('hold');
  const [scheduledDate, setScheduledDate] = useState('');
  const [formNotes, setFormNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [searchInput, setSearchInput] = useState(leadFilters.search || '');
  const [tab, setTab] = useState('active');

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
      const payload = { name: name.trim(), phone, dob: dob || null, source: finalSource, status, notes: formNotes.length ? JSON.stringify(formNotes) : null, created_by_name: user.name };
      if (status === 'scheduled' && scheduledDate) payload.scheduled_date = scheduledDate;
      await addLead(payload);
      setName(''); setPhone(''); setDob(''); setSource('Walk-in'); setCustomSource(''); setStatus('hold'); setScheduledDate(''); setFormNotes([]);
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

  const activeLeads = filteredLeads.filter(l => l.status === 'hold' || l.status === 'selected' || l.status === 'joined');
  const scheduledLeads = leads.filter(l => l.status === 'scheduled');
  const closedLeads = filteredLeads.filter(l => l.status === 'rejected');
  const selectedLead = selectedLeadId ? leads.find(l => l.id === selectedLeadId) : null;

  const showScheduledDateInput = status === 'scheduled';

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
              <label className="field">Status
                <Dropdown value={status} onChange={e=>setStatus(e.target.value)} options={LEAD_STATUSES} />
              </label>
              {showScheduledDateInput && (
                <label className="field">Interview date
                  <input type="date" value={scheduledDate} onChange={e=>setScheduledDate(e.target.value)} />
                </label>
              )}
            </div>
            <div style={{marginTop:12}}>
              <label className="field">Notes
                <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:4}}>
                  {formNotes.map((n,i) => (
                    <span key={i} style={{background:'var(--sage-soft)',padding:'3px 8px',borderRadius:6,fontSize:12,display:'inline-flex',alignItems:'center',gap:6}}>
                      {n.text}
                      <button type="button" onClick={()=>removeFormNote(i)} style={{background:'none',border:'none',color:'var(--danger)',cursor:'pointer',fontSize:14,lineHeight:1,padding:0}}>×</button>
                    </span>
                  ))}
                </div>
                <div style={{display:'flex',gap:8,marginTop:6}}>
                  <input value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Type a note and add..." style={{flex:1}} />
                  <button type="button" className="btn btn-sm" onClick={addNoteToForm}>+ Add</button>
                </div>
              </label>
            </div>
            <div style={{marginTop:14}}>
              <button className="btn btn-primary"><Plus width={15}/> Create lead</button>
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
            <label className="field">Status
              <Dropdown value={status} onChange={e=>setStatus(e.target.value)} options={LEAD_STATUSES} />
            </label>
            {showScheduledDateInput && (
              <label className="field">Interview date
                <input type="date" value={scheduledDate} onChange={e=>setScheduledDate(e.target.value)} />
              </label>
            )}
          </div>
          <div style={{marginTop:12}}>
            <label className="field">Notes
              <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:4}}>
                {formNotes.map((n,i) => (
                  <span key={i} style={{background:'var(--sage-soft)',padding:'3px 8px',borderRadius:6,fontSize:12,display:'inline-flex',alignItems:'center',gap:6}}>
                    {n.text}
                    <button type="button" onClick={()=>removeFormNote(i)} style={{background:'none',border:'none',color:'var(--danger)',cursor:'pointer',fontSize:14,lineHeight:1,padding:0}}>×</button>
                  </span>
                ))}
              </div>
              <div style={{display:'flex',gap:8,marginTop:6}}>
                <input value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Type a note and add..." style={{flex:1}} />
                <button type="button" className="btn btn-sm" onClick={addNoteToForm}>+ Add</button>
              </div>
            </label>
          </div>
          <div style={{marginTop:14}}>
            <button className="btn btn-primary"><Plus width={15}/> Create lead</button>
          </div>
        </form>
      </div>

      <div className="tabs" style={{marginBottom:0}}>
        {TABS.map(t => {
          const counts = { leads: leads.length, scheduled: scheduledLeads.length, rejected: leads.filter(l => l.status === 'rejected').length };
          const dots = { leads: '#5B6B4E', scheduled: '#3b82f6', rejected: '#ef4444' };
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
            <table><tbody>{[1,2,3,4,5].map(i => <SkeletonRow key={i} cols={8}/>)}</tbody></table>
          ) : filteredLeads.length === 0 ? (
            <div className="empty">No leads found.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Phone</th><th>Age</th><th>Source</th><th>Status</th><th>Notes</th><th>Created by</th>
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
                      <td>{displayAge || '—'}</td>
                      <td>{l.source}</td>
                      <td>{isOwner ? (
                        <Dropdown className="inline-select" value={l.status} onChange={e=>updateLeadStatus(l.id, e.target.value)} options={LEAD_STATUSES} />
                      ) : statusPill(l.status)}</td>
                      <td><span className="sub">{parsed.length > 0 ? parsed.length + ' note' + (parsed.length!==1?'s':'') : '—'}</span></td>
                      <td style={{color:'var(--ink-soft)'}}>{l.created_by_name || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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

      {tab === 'rejected' && (
        <div className="card" style={{marginTop:20}}>
          <div className="card-head"><h3>Rejected</h3><span className="sub">{closedLeads.length} leads</span></div>
          {leadsLoading ? (
            <table><tbody>{[1,2,3].map(i => <SkeletonRow key={i} cols={6}/>)}</tbody></table>
          ) : closedLeads.length === 0 ? (
            <div className="empty">No rejected leads.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Phone</th><th>Age</th><th>Source</th><th>Status</th><th>Created by</th>
                </tr>
              </thead>
              <tbody>
                {closedLeads.map(l => {
                  const displayAge = l.dob ? calcAge(l.dob) : l.age;
                  return (
                    <tr key={l.id} onClick={() => setSelectedLeadId(l.id)} style={{cursor:'pointer'}}>
                      <td style={{fontWeight:500}}>{l.name}</td>
                      <td style={{color:'var(--ink-soft)'}}>{l.phone || '—'}</td>
                      <td>{displayAge || '—'}</td>
                      <td>{l.source}</td>
                      <td>{statusPill(l.status)}</td>
                      <td style={{color:'var(--ink-soft)'}}>{l.created_by_name || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
