import { useState } from 'react';
import { useRec } from '../store';
import { Dropdown, Who, Score } from './ui';
import { Search } from '../icons';

export default function Candidates() {
  const { candidates } = useRec();
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('All');
  const filtered = candidates.filter(c =>
    (stage==='All' || c.stage===stage) &&
    (c.name.toLowerCase().includes(q.toLowerCase()) || c.role.toLowerCase().includes(q.toLowerCase()))
  ).sort((a,b)=>b.score-a.score);

  return (
    <div className="card">
      <div className="card-head">
        <h3>All candidates</h3>
        <div style={{display:'flex',gap:10}}>
          <Dropdown className="filter-select" value={stage} onChange={e=>setStage(e.target.value)}
            options={['All','Contacted','Screening','Interview Scheduled','Selected','Offer Sent','Rejected']} />
          <div style={{position:'relative'}}>
            <Search width={15} style={{position:'absolute',left:10,top:9,color:'var(--ink-soft)'}} />
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search…"
              style={{border:'1.5px solid var(--line)',borderRadius:8,padding:'7px 10px 7px 32px',background:'transparent',fontSize:13,width:180,outline:'none',transition:'border-color .2s'}} />
          </div>
        </div>
      </div>
      <table>
        <thead><tr><th>Candidate</th><th>Stage</th><th>Experience</th><th>Source</th><th>Skills</th><th style={{textAlign:'right'}}>Score</th></tr></thead>
        <tbody>
          {filtered.map(c => (
            <tr key={c.id}>
              <td><Who name={c.name} role={c.role} /></td>
              <td style={{color:'var(--ink-soft)'}}>{c.stage}</td>
              <td style={{color:'var(--ink-soft)'}}>{c.exp}</td>
              <td style={{color:'var(--ink-soft)'}}>{c.source}</td>
              <td><div className="tags">{c.skills.slice(0,3).map(s=><span className="tag" key={s} style={{fontSize:11,padding:'3px 9px'}}>{s}</span>)}</div></td>
              <td style={{textAlign:'right'}}><Score value={c.score} /></td>
            </tr>
          ))}
          {!filtered.length && <tr><td colSpan={6}><div className="empty">No candidates match.</div></td></tr>}
        </tbody>
      </table>
    </div>
  );
}
