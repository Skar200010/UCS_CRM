import { useState } from 'react';
import { useRec, LEAD_STATUSES } from '../store';
import { ArrowLeft } from '../icons';

const calcAge = (dob) => {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / 31557600000);
};

const statusPill = (s) => {
  const m = { rejected:'pill-danger', selected:'pill-green', hold:'pill-gold', scheduled:'pill-clay', joined:'pill-gray' };
  const labels = { hold:'Hold', followed_up:'Followed Up', call_back:'Call Back', scheduled:'Scheduled', not_interested:'Not Interested', selected:'Selected', joined:'Joined', ringing:'Ringing', unreachable:'Unreachable', busy:'Busy', switched_off:'Switched Off', wrong_number:'Wrong Number', invalid:'Invalid', rejected:'Rejected' };
  const found = LEAD_STATUSES.find(st => st.value === s);
  return <span className={`pill ${m[s] || 'pill-gray'}`}>{found ? found.label : (labels[s] || s)}</span>;
};

export default function LeadDetail({ lead, onBack }) {
  const { user, updateLead } = useRec();
  const myId = user?.id;
  const isOwner = myId && lead.created_by === myId;
  const [noteText, setNoteText] = useState('');

  let allNotes = [];
  try { allNotes = JSON.parse(lead.notes || '[]'); } catch { allNotes = lead.notes ? [{ text: lead.notes }] : []; }
  const notes = allNotes.filter(n => !n.__meta);

  const addNote = async () => {
    if (!noteText.trim()) return;
    const n = { text: noteText.trim(), date: new Date().toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}), by: user?.name || 'Unknown' };
    await updateLead(lead.id, { notes: JSON.stringify([...allNotes, n]) });
    setNoteText('');
  };

  const age = lead.dob ? calcAge(lead.dob) : lead.age;
  const formatDT = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  };

  return (
    <div className="card">
      <div className="card-head">
        <button className="btn btn-sm" onClick={onBack}><ArrowLeft width={14}/> Back</button>
        <span className="sub">Lead details</span>
      </div>
      <div className="card-pad">
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
          <div><strong>Name</strong><p>{lead.name}</p></div>
          <div><strong>Phone</strong><p>{lead.phone || '—'}</p></div>
          <div><strong>DOB</strong><p>{lead.dob ? new Date(lead.dob).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '—'}{age ? ` (Age: ${age})` : ''}</p></div>
          <div><strong>Source</strong><p>{lead.source}</p></div>
          <div><strong>Created by</strong><p>{lead.created_by_name || '—'}</p></div>
          <div><strong>Status</strong>
            <p style={{marginTop:4}}>
              {isOwner ? (
                <select value={lead.status || ''} onChange={async e => { await updateLead(lead.id, { status: e.target.value }); }}
                  style={{ border:'1px solid var(--line)', borderRadius:'var(--radius-sm)', padding:'4px 8px', fontSize:12, fontFamily:'inherit', outline:'none', background:'var(--paper)', color:'var(--ink)', cursor:'pointer' }}>
                  <option value="">Select status</option>
                  {LEAD_STATUSES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                </select>
              ) : statusPill(lead.status)}
            </p>
          </div>
      </div>
      </div>

      {lead.status === 'scheduled' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,padding:'16px 22px'}}>
          <div><strong>Scheduled at</strong><p style={{color:'var(--ink-soft)'}}>{formatDT(lead.scheduled_at)}</p></div>
        </div>
      )}

      <div className="card-head" style={{borderTop:'1px solid var(--line)'}}><h3>Notes</h3></div>
      <div className="card-pad">
        {notes.length === 0 ? (
          <div className="empty">No notes.</div>
        ) : (
          notes.map((n,i) => (
            <div key={i} style={{padding:'10px 0',borderBottom:i<notes.length-1?'1px solid var(--line)':'none',fontSize:13}}>
              <div>{n.text || n}</div>
              <div style={{fontSize:11,color:'var(--ink-soft)',marginTop:3}}>{(n.by || '—')} · {(n.date || '—')}</div>
            </div>
          ))
        )}
        {isOwner && (
          <div style={{display:'flex',gap:8,marginTop:14}}>
            <input value={noteText} onChange={e=>setNoteText(e.target.value)}
              placeholder="Add a note…" style={{flex:1}}
              onKeyDown={e=>e.key==='Enter'&&addNote()} />
            <button className="btn btn-sm" onClick={addNote}>Add</button>
          </div>
        )}
      </div>
    </div>
  );
}
