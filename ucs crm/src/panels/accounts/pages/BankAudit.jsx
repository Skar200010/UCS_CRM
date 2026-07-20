import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../api/auth';
import { useRealtime } from '../../../hooks/useRealtime';

const curr = n => n != null ? '\u20B9' + Number(n).toLocaleString('en-IN') : '\u20B90';
const C = ['#5B6B4E','#B5603A','#C08A2E','#4F6472','#7A5C7E','#88693D','#2E7D6F','#9B59B6'];

function Sk({h=14,w='100%'}){return <div style={{height:h,width:typeof w==='number'?w:w,borderRadius:6,background:'linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%)',backgroundSize:'200% 100%',animation:'sk-shimmer 1.4s infinite'}}/>}
function SkStat(){return <div className="stat-card" style={{opacity:.6}}><div className="stat-icon" style={{background:'#e5e7eb'}}><div style={{width:18,height:18,borderRadius:4,background:'#d1d5db'}}/></div><div className="stat-info"><div className="stat-num"><Sk h={22} w="60%"/></div><div className="stat-lbl"><Sk h={12} w="40%"/></div></div></div>}
function SkTbl({r=4,c=7}){return <div className="card"><div className="card-pad"><table className="table-wrap" style={{width:'100%',fontSize:13}}><thead><tr>{Array.from({length:c},(_,j)=><th key={j}><Sk h={12} w={j===1?160:60}/></th>)}</tr></thead><tbody>{Array.from({length:r},(_,i)=><tr key={i}>{Array.from({length:c},(_,j)=><td key={j}><Sk h={12} w={j===1?180:70}/></td>)}</tr>)}</tbody></table></div></div>}

function Tab({a,on,ic,ch}){return <button onClick={on} style={{padding:'10px 18px',fontSize:13,fontWeight:a?700:500,border:'none',background:a?'#fff':'transparent',cursor:'pointer',color:a?'var(--sage)':'#6b7280',borderBottom:a?'2px solid var(--sage)':'2px solid transparent',marginBottom:-2,display:'flex',alignItems:'center',gap:6,whiteSpace:'nowrap',transition:'all .15s'}}>{ic}{ch}</button>}

function Btn({s,on,ch,dis,ic,fg='#fff',bg='var(--sage)'}){return <button className="btn btn-sm" onClick={on} disabled={dis} style={{background:bg,color:fg,border:'none',display:'inline-flex',alignItems:'center',gap:4,fontSize:12,opacity:dis?.5:1}}>{ic}{ch}</button>}

// ─── Email Import ──────────────────────────────────────────
function EmailTab(){
  const[s,setS]=useState(null);const[l,setL]=useState([]);const[a,setA]=useState([]);const[ld,setLd]=useState(true);
  const[tr,setTr]=useState(false);const[ts,setTs]=useState(false);const[fd,setFd]=useState('');const[ifd,setIfd]=useState(false);const[fa,setFa]=useState('');const[tt,setTt]=useState(null);
  const show=(m,t)=>{setTt({m,t});setTimeout(()=>setTt(null),4000)};
  async function load(){setLd(true);try{const p=new URLSearchParams();if(fa)p.set('account_id',fa);const[sr,lr,ar]=await Promise.allSettled([apiGet('/accounts/email-import/status'),apiGet('/accounts/email-import/log?'+p.toString()),apiGet('/accounts/email-import/accounts')]);if(sr.status==='fulfilled')setS(sr.value);if(lr.status==='fulfilled')setL(lr.value||[]);if(ar.status==='fulfilled')setA(ar.value||[])}catch{}finally{setLd(false)}}
  useEffect(()=>{load()},[fa]);
  const c=s?.counts||{imported:0,failed:0,skipped:0,seen:0};if(ld)return <SkTbl/>;
  return <div>
    <div className="stats-grid" style={{marginBottom:14}}>
      {[{l:'Imported',v:c.imported,c:'#059669',ic:<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>},{l:'Skipped',v:c.skipped,c:'#f59e0b',ic:<><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"/><polyline points="16 16 23 7 16 7"/></>},{l:'Seen',v:c.seen,c:'#8B5CF6',ic:<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>},{l:'Failed',v:c.failed,c:'#dc2626',ic:<><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></>}].map((s,i)=><div key={i} className="stat-card"><div className="stat-icon" style={{background:s.c+'18',color:s.c}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">{s.ic}</svg></div><div className="stat-info"><div className="stat-num">{s.v}</div><div className="stat-lbl">{s.l}</div></div></div>)}
    </div>
    <div className="card" style={{marginBottom:14,borderRadius:10}}>
      <div style={{display:'flex',gap:6,padding:'10px 14px',flexWrap:'wrap',alignItems:'center'}}>
        <Btn on={load} ic={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.4-3.4L23 10M1 14l5.1 4.4A9 9 0 0 0 20.5 15"/></svg>} ch="Refresh"/>
        <div style={{display:'flex',alignItems:'center',gap:4,marginLeft:'auto'}}>
          <span style={{fontSize:12,color:'#6b7280'}}>From</span>
          <input type="date" value={fd} onChange={e=>setFd(e.target.value)} style={{fontSize:12,padding:'4px 8px',borderRadius:6,border:'1px solid #d1d5db',width:140}}/>
        </div>
        <Btn on={async()=>{if(!fd){alert('Select date');return};setIfd(true);try{await apiPost('/accounts/email-import/trigger?fromDate='+fd);await load()}catch(e){show(e.message,'error')};setIfd(false)}} dis={ifd||!fd} bg="#5B6B4E" ch={ifd?'Importing...':'Import from Date'}/>
        <Btn on={async()=>{setTr(true);try{const r=await apiPost('/accounts/email-import/trigger');const err=r.details?.find(d=>d.result?.error)?.result?.error;show(err||r.message||'Done',r.success===false?'error':'success');await load()}catch(e){show(e.message,'error')};setTr(false)}} dis={tr} ch={tr?'Importing...':'Manual Import'}/>
        <Btn on={async()=>{setTs(true);try{const r=await apiPost('/accounts/email-import/process-seen');show(r.message||'Done',r.success===false?'error':'success');await load()}catch(e){show(e.message,'error')};setTs(false)}} dis={ts} bg="#8B5CF6" ch={ts?'Importing...':'Process Seen'}/>
        <Btn on={async()=>{try{await apiPost('/accounts/email-import/test');await load()}catch(e){show(e.message,'error')}}} bg="#f59e0b" ch="Test"/>
      </div>
      {a.length>0&&<div style={{display:'flex',gap:4,padding:'4px 14px 8px',flexWrap:'wrap',alignItems:'center',borderTop:'1px solid #f3f4f6'}}>
        <span style={{fontSize:11,fontWeight:600,color:'#6b7280',textTransform:'uppercase'}}>Account:</span>
        <button onClick={()=>setFa('')} className="btn btn-sm" style={{background:!fa?'var(--sage)':'transparent',color:!fa?'#fff':'#374151',border:'1px solid #d1d5db',fontSize:11}}>All</button>
        {a.map(acc=><button key={acc.id} onClick={()=>setFa(acc.id)} className="btn btn-sm" style={{background:String(fa)===String(acc.id)?'var(--sage)':'transparent',color:String(fa)===String(acc.id)?'#fff':'#374151',border:'1px solid #d1d5db',fontSize:11,opacity:acc.is_active?1:.55}}>{acc.name}</button>)}
      </div>}
    </div>
    <div className="table-wrap"><table>
      <thead><tr><th>Date</th><th>Subject</th><th>From</th><th>Amount</th><th>Payment ID</th><th>Source</th><th>Status</th></tr></thead>
      <tbody>{l.length===0?<tr><td colSpan={7} style={{textAlign:'center',padding:20,color:'#9ca3af'}}>No imports yet</td></tr>:l.map(e=><tr key={e.id}>
        <td style={{whiteSpace:'nowrap',fontSize:12}}>{e.created_at?new Date(e.created_at).toLocaleDateString('en-IN'):'\u2014'}</td>
        <td style={{fontSize:12,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={e.email_subject}>{e.email_subject||'\u2014'}</td>
        <td style={{fontSize:12}}>{e.email_from?e.email_from.split('<')[0].trim():'\u2014'}</td>
        <td style={{fontSize:12}}>{e.parsed_amount?curr(e.parsed_amount):'\u2014'}</td>
        <td style={{fontSize:11}}>{e.parsed_payment_id||'\u2014'}</td>
        <td style={{fontSize:12}}>{e.parsed_source||'\u2014'}</td>
        <td><span className={`pill ${e.status==='imported'?'pill-green':e.status==='failed'?'pill-red':e.status==='seen'?'pill-yellow':'pill-gray'}`} style={{fontSize:11}}>{e.status}{e.seen?' (read)':''}</span></td>
      </tr>)}</tbody>
    </table></div>
    {tt&&<div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',zIndex:9999,background:tt.type==='error'?'#dc2626':'#059669',color:'#fff',padding:'10px 24px',borderRadius:10,boxShadow:'0 6px 24px rgba(0,0,0,.18)',fontSize:13,fontWeight:500,display:'flex',alignItems:'center',gap:8}}>
      {tt.type==='error'?<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}{tt.m}
    </div>}
  </div>;
}

// ─── Payment Gateways ──────────────────────────────────────
function GatewayTab(){
  const[l,setL]=useState([]);const[c,setC]=useState({});const[a,setA]=useState([]);const[ld,setLd]=useState(true);const[sy,setSy]=useState(false);const[fg,setFg]=useState('');const[fa,setFa]=useState('');
  async function load(){setLd(true);try{const p=new URLSearchParams();if(fg)p.set('gateway',fg);if(fa)p.set('account_id',fa);const[lr,sr,ar]=await Promise.allSettled([apiGet('/webhooks/log?'+p.toString()),apiGet('/webhooks/status'),apiGet('/webhooks/razorpay/accounts')]);if(lr.status==='fulfilled')setL(lr.value||[]);if(sr.status==='fulfilled')setC(sr.value.counts||{});if(ar.status==='fulfilled')setA(ar.value||[])}catch{}finally{setLd(false)}}
  useEffect(()=>{load()},[fg,fa]);
  const rc=(c['razorpay_processed']||0)+(c['razorpay_received']||0),pt=(c['paytm_processed']||0)+(c['paytm_received']||0);if(ld)return <SkTbl/>;
  return <div>
    <div className="stats-grid" style={{marginBottom:14}}>
      {[{l:'Razorpay',v:rc,c:'#0d9488',ic:<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>},{l:'Paytm',v:pt,c:'#2563eb',ic:<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>},{l:'Failed',v:(c['razorpay_failed']||0)+(c['paytm_failed']||0),c:'#dc2626',ic:<><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></>}].map((s,i)=><div key={i} className="stat-card"><div className="stat-icon" style={{background:s.c+'18',color:s.c}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">{s.ic}</svg></div><div className="stat-info"><div className="stat-num">{s.v}</div><div className="stat-lbl">{s.l}</div></div></div>)}
    </div>
    <div className="card" style={{marginBottom:14,borderRadius:10}}>
      <div style={{display:'flex',gap:6,padding:'10px 14px',flexWrap:'wrap',alignItems:'center'}}>
        <select value={fg} onChange={e=>setFg(e.target.value)} style={{fontSize:12,padding:'4px 8px',borderRadius:6,border:'1px solid #d1d5db'}}><option value="">All Gateways</option><option value="razorpay">Razorpay</option><option value="paytm">Paytm</option></select>
        <Btn on={load} ic={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.4-3.4L23 10M1 14l5.1 4.4A9 9 0 0 0 20.5 15"/></svg>} ch="Refresh"/>
        <Btn on={async()=>{setSy(true);try{const r=await apiPost('/webhooks/razorpay/sync');alert(r.message||'Sync done');await load()}catch(e){alert(e.message)};setSy(false)}} dis={sy} ch={sy?'Syncing...':'Sync Default'} bg="var(--sage)" style={{marginLeft:'auto'}}/>
      </div>
    </div>
    <div className="table-wrap"><table>
      <thead><tr><th>Date</th><th>Gateway</th><th>Account</th><th>Event</th><th>Amount</th><th>Payment ID</th><th>Status</th></tr></thead>
      <tbody>{l.length===0?<tr><td colSpan={7} style={{textAlign:'center',padding:20,color:'#9ca3af'}}>No webhook events yet</td></tr>:l.map(e=><tr key={e.id}>
        <td style={{whiteSpace:'nowrap',fontSize:12}}>{e.created_at?new Date(e.created_at).toLocaleDateString('en-IN'):'\u2014'}</td>
        <td><span className="pill" style={{background:e.gateway==='razorpay'?'#0d948818':'#2563eb18',color:e.gateway==='razorpay'?'#0d9488':'#2563eb',fontSize:11}}>{e.gateway}</span></td>
        <td style={{fontSize:11}}>{e.account_name||'\u2014'}</td>
        <td style={{fontSize:11}}>{e.event_type||'\u2014'}</td>
        <td style={{fontSize:12,fontWeight:600,color:e.amount!=null&&Number(e.amount)<0?'#dc2626':'var(--sage)'}}>{e.amount?curr(e.amount):'\u2014'}</td>
        <td style={{fontSize:11}}>{e.payment_id||'\u2014'}</td>
        <td><span className={`pill ${e.status==='processed'?'pill-green':'pill-red'}`} style={{fontSize:11}}>{e.status}</span></td>
      </tr>)}</tbody>
    </table></div>
  </div>;
}

// ─── Bank Statement ─────────────────────────────────────────
function StatementTab(){
  const[f,setF]=useState(null);const[p,setP]=useState(null);const[im,setIm]=useState(false);const[res,setRes]=useState(null);const[err,setErr]=useState('');
  const[sn,setSn]=useState('');const[ssi,setSsi]=useState(false);const[ld,setLd]=useState(false);const fr=useRef(null);
  const prev=async()=>{if(!f){setErr('Select a file');return};setErr('');setP(null);setRes(null);setLd(true);const fd=new FormData();fd.append('file',f);if(sn)fd.append('source_name',sn);try{const d=await apiPost('/accounts/bank-statement/preview',fd);setP(d);if(d.bank==='Generic'&&!sn)setSsi(true)}catch(e){setErr(e.message)}finally{setLd(false)}};
  const imp=async()=>{if(!f){setErr('Select a file');return};setErr('');setIm(true);const fd=new FormData();fd.append('file',f);if(sn)fd.append('source_name',sn);try{const d=await apiPost('/accounts/bank-statement/import',fd);setRes(d);setP(null);setF(null);if(fr.current)fr.current.value=''}catch(e){setErr(e.message)}finally{setIm(false)}};
  return <div>
    <div className="card" style={{marginBottom:14,borderRadius:10}}>
      <div style={{padding:'14px 16px'}}>
        <p style={{fontSize:13,color:'#6b7280',marginBottom:12,lineHeight:1.5}}>Upload a CSV or Excel file downloaded from your bank's net banking portal. Supports Axis Bank, HDFC, ICICI, SBI, and most Indian banks.</p>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <input ref={fr} type="file" accept=".csv,.xlsx,.xls" onChange={e=>{const f=e.target.files?.[0];if(f){setF(f);setP(null);setRes(null);setErr('');setSsi(false)}}} style={{fontSize:13,padding:'6px 10px',border:'1px solid #d1d5db',borderRadius:6,flex:1,minWidth:200}}/>
          <Btn on={prev} dis={!f||ld} ch={ld?'Parsing...':'Preview'}/>
        </div>
        {ssi&&<div style={{marginTop:10,display:'flex',gap:8,alignItems:'center'}}><span style={{fontSize:13,color:'#6b7280'}}>Enter bank name:</span><input value={sn} onChange={e=>setSn(e.target.value)} placeholder="e.g. Axis Bank" style={{fontSize:13,padding:'4px 8px',border:'1px solid #d1d5db',borderRadius:6,width:200}}/></div>}
        {err&&<div style={{marginTop:10,fontSize:13,color:'#dc2626',background:'#fef2f2',padding:'8px 12px',borderRadius:6,display:'flex',alignItems:'center',gap:6}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>{err}
        </div>}
      </div>
    </div>
    {p&&<div className="card" style={{marginBottom:14,borderRadius:10}}>
      <div style={{padding:'14px 16px'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:10}}>
          <span style={{fontSize:13,fontWeight:600}}>Bank: <span className="pill pill-gray">{p.bank}</span></span>
          <span style={{fontSize:13,fontWeight:600}}>Source: <span className="pill" style={{background:'#5B6B4E20',color:'#5B6B4E'}}>{p.source_name}</span></span>
          <span style={{fontSize:13,color:'#6b7280'}}>{p.parsed_rows} of {p.total_rows} rows parsed</span>
          <Btn on={imp} dis={im} ch={im?'Importing...':`Import ${p.parsed_rows} Entries`} bg="#059669" style={{marginLeft:'auto'}}/>
        </div>
        <div className="table-wrap" style={{maxHeight:280,overflowY:'auto',border:'1px solid #e5e7eb',borderRadius:8}}>
          <table><thead><tr><th>Date</th><th>Description</th><th>Ref No</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
            <tbody>{p.rows.slice(0,50).map((r,i)=><tr key={i}>
              <td style={{whiteSpace:'nowrap',fontSize:12}}>{r.date}</td>
              <td style={{fontSize:12,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={r.description}>{r.description||'\u2014'}</td>
              <td style={{fontSize:11}}>{r.ref_no||'\u2014'}</td>
              <td style={{fontSize:12,color:r.debit>0?'#dc2626':'#6b7280'}}>{r.debit>0?curr(r.debit):'\u2014'}</td>
              <td style={{fontSize:12,color:r.credit>0?'#059669':'#6b7280'}}>{r.credit>0?curr(r.credit):'\u2014'}</td>
              <td style={{fontSize:12}}>{r.balance?curr(r.balance):'\u2014'}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>}
    {res&&<div className="card" style={{borderRadius:10}}>
      <div style={{padding:'14px 16px',display:'flex',alignItems:'center',gap:12}}>
        <div style={{width:40,height:40,borderRadius:10,background:'#05966918',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <div><div style={{fontSize:15,fontWeight:700,color:'#059669'}}>Import Complete</div><div style={{fontSize:13,color:'#6b7280'}}>{res.imported} entries imported to {res.source_name}{res.errors>0?` (${res.errors} errors)`:''}</div></div>
      </div>
    </div>}
  </div>;
}

// ─── Entries (Bank Audit Core) ─────────────────────────────
function EntrySection({loading,entries,sources,summary,error,statusTab,setStatusTab,selDate,setSelDate,doLoad,ngoFilter,setNgoFilter,srcFilter,setSrcFilter,showAdd,setShowAdd,showSrc,setShowSrc,form,setForm,editEntry,setEditEntry,saving,handleAdd,handleEdit,handleDelete,handleAddSrc,handleDelSrc,openEdit,sn,setSn,getSrcName,filtered,SvgX}){
  return <div>
    {error&&<div style={{display:'flex',alignItems:'center',gap:6,background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'8px 12px',marginBottom:14,fontSize:13,color:'#991b1b'}}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>{error}
    </div>}
    <div className="card" style={{marginBottom:14,borderRadius:10}}>
      <div style={{display:'flex',gap:8,padding:'10px 14px',flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          {selDate?<span style={{fontSize:12}}>Date</span>:<span style={{fontSize:12,fontWeight:600,color:'var(--sage)'}}>All Dates</span>}
          <input type="date" value={selDate} onChange={e=>{const v=e.target.value;setSelDate(v);doLoad(v,statusTab)}} style={{fontSize:12,padding:'4px 8px',borderRadius:6,border:'1px solid #d1d5db',width:140}}/>
          {selDate&&<Btn on={()=>{setSelDate('');doLoad('',statusTab)}} ch="Clear" bg="transparent" fg="#6b7280" style={{fontSize:11,padding:'2px 6px'}}/>}
        </div>
        <select value={ngoFilter} onChange={e=>setNgoFilter(e.target.value)} style={{fontSize:12,padding:'4px 8px',borderRadius:6,border:'1px solid #d1d5db'}}>
          <option value="">All NGOs</option><option value="bsct">Being Sevak</option><option value="maan">Mann Care</option><option value="aflf">Ashray</option>
        </select>
        <select value={srcFilter} onChange={e=>setSrcFilter(e.target.value)} style={{fontSize:12,padding:'4px 8px',borderRadius:6,border:'1px solid #d1d5db'}}>
          <option value="">All Sources</option>
          {sources.filter(s=>s.is_active!==false).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <Btn on={()=>doLoad(selDate,statusTab)} ic={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.4-3.4L23 10M1 14l5.1 4.4A9 9 0 0 0 20.5 15"/></svg>} ch="Refresh"/>
        <Btn on={()=>{setForm({src_id:'',amount:'',payment_id:'',check_id:'',transaction_date:'',remarks:''});setShowAdd(true)}} ch="Add Entry" bg="var(--sage)" style={{marginLeft:'auto'}}/>
        <Btn on={()=>{setSn('');setShowSrc(true)}} ch="Sources" bg="transparent" fg="#374151" style={{border:'1px solid #d1d5db'}}/>
      </div>
    </div>
    <div className="table-wrap"><table>
      <thead><tr><th>Date</th><th>Source</th><th>Amount</th><th>Payment ID</th><th>Check ID</th><th>Remarks</th><th style={{width:110}}></th></tr></thead>
      <tbody>{loading?<tr><td colSpan={7}><SkTbl r={5} c={7}/></td></tr>:entries.length===0?<tr><td colSpan={7} style={{textAlign:'center',padding:20,color:'#9ca3af'}}>No entries yet</td></tr>:(srcFilter?filtered.filter(e=>e.source_id===Number(srcFilter)):filtered).map((e,idx)=><tr key={e.id||idx}>
        <td style={{whiteSpace:'nowrap'}}>{e.transaction_date}</td>
        <td><span className="pill pill-gray">{e.bank_audit_sources?.name||getSrcName(e.source_id)}</span></td>
        <td style={{fontWeight:600,color:'var(--sage)'}}>{curr(e.amount)}</td>
        <td style={{fontSize:12}}>{e.payment_id||'\u2014'}</td>
        <td style={{fontSize:12}}>{e.check_id||'\u2014'}</td>
        <td style={{fontSize:12,maxWidth:180,whiteSpace:'pre-wrap'}}>{e.remarks||'\u2014'}</td>
        <td><div style={{display:'flex',gap:4}}>
          {statusTab==='unverified'&&<><Btn on={()=>openEdit(e)} ch="Edit" bg="transparent" fg="#374151" style={{fontSize:11,padding:'2px 8px',border:'1px solid #d1d5db'}}/><Btn on={()=>handleDelete(e.id)} ch="Del" bg="transparent" fg="#dc2626" style={{fontSize:11,padding:'2px 8px',border:'1px solid #fecaca'}}/></>}
          <Btn on={async()=>{if(confirm('Send to NGO Admin?'))try{await apiPut('/accounts/bank-audit/entries/'+e.id+'/assign-ngo',{});doLoad(selDate,statusTab)}catch(err){alert(err.message)}}} ch="NGO" bg="transparent" fg="#B5603A" style={{fontSize:11,padding:'2px 8px',border:'1px solid #fed7aa'}}/>
        </div></td>
      </tr>)}</tbody>
    </table></div>
  </div>;
}

// ─── Main ──────────────────────────────────────────────────
export default function BankAudit(){
  const[e,setE]=useState([]);const[sr,setSr]=useState([]);const[su,setSu]=useState({});const[ld,setLd]=useState(true);
  const[st,setSt]=useState('unverified');const[sd,setSd]=useState('');const[sf,setSf]=useState('');const[nf,setNf]=useState('');
  const[sa,setSa]=useState(false);const[se,setSe]=useState(null);const[ss,setSs]=useState(false);
  const[fm,setFm]=useState({src_id:'',amount:'',payment_id:'',check_id:'',transaction_date:'',remarks:''});
  const[sv,setSv]=useState(false);const[snn,setSnn]=useState('');const[er,setEr]=useState('');const[mt,setMt]=useState('entries');
  const[is,setIs]=useState({razorpaySync:false,emailImport:false,bankStatement:false});
  const srRef=useRef(st);useEffect(()=>{srRef.current=st},[st]);

  useEffect(()=>{apiGet('/user-settings').then(d=>{const s={razorpaySync:d.razorpaySync==='true',emailImport:d.emailImport==='true',bankStatement:d.bankStatement==='true'};setIs(s);if(mt!=='entries'&&((mt==='email'&&!s.emailImport)||(mt==='gateways'&&!s.razorpaySync)||(mt==='statement'&&!s.bankStatement)))setMt('entries')}).catch(e=>console.error('BankAudit: settings load failed',e))},[]);

  async function load(dt,stv){
    const s=stv||srRef.current;setLd(true);setEr('');
    try{
      const p=new URLSearchParams();if(dt){p.set('date_from',dt);p.set('date_to',dt)}p.set('status',s);
      const q=p.toString();
      const res=await Promise.allSettled([apiGet('/accounts/bank-audit/entries?'+q),apiGet('/accounts/bank-audit/sources'),apiGet('/accounts/bank-audit/summary?'+q)]);
      if(res[0].status==='fulfilled')setE(res[0].value);else{console.error(res[0].reason);setEr('Failed: '+res[0].reason.message)}
      if(res[1].status==='fulfilled')setSr(res[1].value);if(res[2].status==='fulfilled')setSu(res[2].value);
    }catch(err){console.error(err);setEr(err.message)}finally{setLd(false)}
  }
  useEffect(()=>{load(sd,st)},[st]);useEffect(()=>{load(sd,st)},[sd]);
  useRealtime('bank_audit_entries',{event:'*',onInsert:()=>load(sd,srRef.current),onUpdate:()=>load(sd,srRef.current),onDelete:()=>load(sd,srRef.current)});

  const ngoKw={bsct:['beingsevak','being sevak','sevak'],maan:['mann','maan','manncar','mann care'],aflf:['ashray','aflf']};
  const fe=nf?e.filter(e=>{const src=(e.bank_audit_sources?.name||'').toLowerCase();const rem=(e.remarks||'').toLowerCase();const kw=ngoKw[nf]||[];return kw.some(k=>src.includes(k)||rem.includes(k))}):e;
  const getSrc=i=>{const s=sr.find(s=>s.id===i);return s?s.name:'Unknown'};

  const addEntry=async()=>{if(!fm.src_id||!fm.amount||!fm.transaction_date){alert('Source, amount, date required');return};setSv(true);try{await apiPost('/accounts/bank-audit/entries',{source_id:fm.src_id,amount:fm.amount,payment_id:fm.payment_id,check_id:fm.check_id,transaction_date:fm.transaction_date,remarks:fm.remarks});setSa(false);setFm({src_id:'',amount:'',payment_id:'',check_id:'',transaction_date:'',remarks:''});load(sd,st)}catch(e){alert(e.message)}finally{setSv(false)}};
  const editEntry=async()=>{if(!se)return;setSv(true);try{await apiPut('/accounts/bank-audit/entries/'+se.id,fm);setSe(null);setFm({src_id:'',amount:'',payment_id:'',check_id:'',transaction_date:'',remarks:''});load(sd,st)}catch(e){alert(e.message)}finally{setSv(false)}};
  const delEntry=async(id)=>{if(!confirm('Delete?'))return;try{await apiDelete('/accounts/bank-audit/entries/'+id);load(sd,st)}catch(e){alert(e.message)}};
  const addSrc=async()=>{if(!snn)return;try{await apiPost('/accounts/bank-audit/sources',{name:snn});setSnn('');setSr(await apiGet('/accounts/bank-audit/sources'))}catch(e){alert(e.message)}};
  const delSrc=async(id)=>{if(!confirm('Delete?'))return;try{await apiDelete('/accounts/bank-audit/sources/'+id);setSr(await apiGet('/accounts/bank-audit/sources'))}catch(e){alert(e.message)}};
  const openE=(entry)=>{setFm({src_id:entry.source_id,amount:entry.amount,payment_id:entry.payment_id||'',check_id:entry.check_id||'',transaction_date:entry.transaction_date,remarks:entry.remarks||''});setSe(entry)};
  const SvgX=()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

  return <div>
    {/* Stats */}
    {mt==='entries'&&<div className="stats-grid" style={{marginBottom:16}}>
      {ld?Array.from({length:Math.max(sr.length||4,4)},(_,i)=><SkStat key={i}/>):sr.filter(s=>s.is_active!==false).map((s,i)=><div key={s.id} className="stat-card">
        <div className="stat-icon" style={{background:C[i%C.length]+'18',color:C[i%C.length]}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 2 7 2 9 22 9 22 7 12 2"/><rect x="4" y="11" width="3" height="7"/><rect x="10.5" y="11" width="3" height="7"/><rect x="17" y="11" width="3" height="7"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
        </div>
        <div className="stat-info"><div className="stat-num">{curr(su[s.name]||0)}</div><div className="stat-lbl">{s.name}</div></div>
      </div>)}
    </div>}

    {/* Tab bar */}
    <div className="card" style={{marginBottom:16,padding:0,borderRadius:10,overflow:'hidden'}}>
      <div style={{display:'flex',background:'#f9fafb',borderBottom:'1px solid #e5e7eb'}}>
        {[
          {k:'entries',l:'Entries',ic:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12"/><path d="M9 9h5a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2H9"/></svg>},
          is.emailImport&&{k:'email',l:'Email Import',ic:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>},
          is.razorpaySync&&{k:'gateways',l:'Payment Gateways',ic:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>},
          is.bankStatement&&{k:'statement',l:'Bank Statement',ic:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>},
        ].filter(Boolean).map(t=><Tab key={t.k} a={mt===t.k} on={()=>setMt(t.k)} ic={t.ic} ch={t.l}/>)}
      </div>
      {mt==='entries'&&<div style={{display:'flex',background:'#fff',borderBottom:'1px solid #f3f4f6'}}>
        <Tab a={st==='unverified'} on={()=>setSt('unverified')} ch="Pending"/>
        <Tab a={st==='verified'} on={()=>setSt('verified')} ch="History"/>
      </div>}
    </div>

    {/* Content */}
    {mt==='entries'&&<EntrySection
      loading={ld} entries={e} sources={sr} summary={su} error={er}
      statusTab={st} setStatusTab={setSt}
      selDate={sd} setSelDate={setSd} doLoad={load}
      ngoFilter={nf} setNgoFilter={setNf} srcFilter={sf} setSrcFilter={setSf}
      showAdd={sa} setShowAdd={setSa} showSrc={ss} setShowSrc={setSs}
      form={fm} setForm={setFm} editEntry={se} setEditEntry={setSe}
      saving={sv} handleAdd={addEntry} handleEdit={editEntry} handleDelete={delEntry}
      handleAddSrc={addSrc} handleDelSrc={delSrc} openEdit={openE}
      sn={snn} setSn={setSnn} getSrcName={getSrc} filtered={fe} SvgX={SvgX}
    />}
    {mt==='email'&&is.emailImport&&<EmailTab/>}
    {mt==='gateways'&&is.razorpaySync&&<GatewayTab/>}
    {mt==='statement'&&is.bankStatement&&<StatementTab/>}

    {/* Add Modal */}
    {sa&&<div className="modal-overlay" onClick={()=>setSa(false)}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:540,borderRadius:12}}>
      <div className="modal-head"><h3 style={{fontSize:16,fontWeight:700}}>Add Bank Entry</h3><button className="btn btn-sm btn-icon" onClick={()=>setSa(false)} style={{padding:4}}><SvgX/></button></div>
      <div className="modal-body" style={{padding:20}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <label style={{fontSize:12}}>Source<select className="field-input" value={fm.src_id} onChange={e=>setFm(p=>({...p,src_id:e.target.value}))}>{sr.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label style={{fontSize:12}}>Amount<input className="field-input" type="number" value={fm.amount} onChange={e=>setFm(p=>({...p,amount:e.target.value}))}/></label>
          <label style={{fontSize:12}}>Date<input className="field-input" type="date" value={fm.transaction_date} onChange={e=>setFm(p=>({...p,transaction_date:e.target.value}))}/></label>
          <label style={{fontSize:12}}>Payment ID<input className="field-input" value={fm.payment_id} onChange={e=>setFm(p=>({...p,payment_id:e.target.value}))}/></label>
          <label style={{fontSize:12}}>Check ID<input className="field-input" value={fm.check_id} onChange={e=>setFm(p=>({...p,check_id:e.target.value}))}/></label>
          <label style={{fontSize:12,gridColumn:'1/-1'}}>Remarks<input className="field-input" value={fm.remarks} onChange={e=>setFm(p=>({...p,remarks:e.target.value}))}/></label>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}>
          <button className="btn btn-sm" onClick={()=>setSa(false)}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={addEntry} disabled={sv}>{sv?'Saving...':'Add Entry'}</button>
        </div>
      </div>
    </div></div>}

    {/* Edit Modal */}
    {se&&<div className="modal-overlay" onClick={()=>setSe(null)}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:540,borderRadius:12}}>
      <div className="modal-head"><h3 style={{fontSize:16,fontWeight:700}}>Edit Entry</h3><button className="btn btn-sm btn-icon" onClick={()=>setSe(null)} style={{padding:4}}><SvgX/></button></div>
      <div className="modal-body" style={{padding:20}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <label style={{fontSize:12}}>Source<select className="field-input" value={fm.src_id} onChange={e=>setFm(p=>({...p,src_id:e.target.value}))}>{sr.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label style={{fontSize:12}}>Amount<input className="field-input" type="number" value={fm.amount} onChange={e=>setFm(p=>({...p,amount:e.target.value}))}/></label>
          <label style={{fontSize:12}}>Date<input className="field-input" type="date" value={fm.transaction_date} onChange={e=>setFm(p=>({...p,transaction_date:e.target.value}))}/></label>
          <label style={{fontSize:12}}>Payment ID<input className="field-input" value={fm.payment_id} onChange={e=>setFm(p=>({...p,payment_id:e.target.value}))}/></label>
          <label style={{fontSize:12}}>Check ID<input className="field-input" value={fm.check_id} onChange={e=>setFm(p=>({...p,check_id:e.target.value}))}/></label>
          <label style={{fontSize:12,gridColumn:'1/-1'}}>Remarks<input className="field-input" value={fm.remarks} onChange={e=>setFm(p=>({...p,remarks:e.target.value}))}/></label>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:16}}>
          <button className="btn btn-sm" onClick={()=>setSe(null)}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={editEntry} disabled={sv}>{sv?'Saving...':'Save'}</button>
        </div>
      </div>
    </div></div>}

    {/* Sources Modal */}
    {ss&&<div className="modal-overlay" onClick={()=>setSs(false)}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:420,borderRadius:12}}>
      <div className="modal-head"><h3 style={{fontSize:16,fontWeight:700}}>Manage Sources</h3><button className="btn btn-sm btn-icon" onClick={()=>setSs(false)} style={{padding:4}}><SvgX/></button></div>
      <div className="modal-body" style={{padding:20}}>
        <div style={{display:'flex',gap:8,marginBottom:12}}>
          <input className="field-input" value={snn} onChange={e=>setSnn(e.target.value)} placeholder="New source name" onKeyDown={e=>e.key==='Enter'&&addSrc()}/>
          <button className="btn btn-primary btn-sm" onClick={addSrc}>Add</button>
        </div>
        {sr.map(s=><div key={s.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid #f3f4f6',fontSize:13}}>
          <span>{s.name}</span>
          <button className="btn btn-sm" onClick={()=>delSrc(s.id)} style={{fontSize:11,padding:'2px 8px',color:'#dc2626',background:'none',border:'1px solid #fecaca',borderRadius:6}}>Delete</button>
        </div>)}
      </div>
    </div></div>}
  </div>;
}
