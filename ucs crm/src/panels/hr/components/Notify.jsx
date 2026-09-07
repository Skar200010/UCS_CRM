import { useState } from 'react';
import { useHR } from '../store';
import { Dropdown } from './ui';
import { Send, Bell } from '../icons';
import { deptLabel } from '../../../lib/labels';

const now = () => new Date().toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });

export default function Notify() {
  const { sendNotif, DEPTS } = useHR();
  const [notifs, setNotifs] = useState([]);
  const [to, setTo] = useState('Everyone');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!msg.trim()) return;
    setErr('');
    try {
      await sendNotif(to, msg.trim());
      setNotifs(p => [{ id: Date.now(), to, msg: msg.trim(), time: now() }, ...p]);
      setMsg('');
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <>
      <div className="card" style={{ marginBottom:20 }}>
        <div className="card-head"><h3>Send a notification</h3></div>
        <div className="card-pad">
          <div className="form-row" style={{ alignItems:'end' }}>
            <label className="field" style={{ flex:'1 1 auto', minWidth:140 }}>To
              <Dropdown value={to} onChange={e=>setTo(e.target.value)} options={[{value:'Everyone',label:'Everyone'}, ...DEPTS.map(d => ({value:d, label:deptLabel(d)}))]} />
            </label>
            <label className="field" style={{ flex:3 }}>Message
              <input value={msg} onChange={e=>setMsg(e.target.value)} placeholder="All-hands at 3 PM in the lounge"
                onKeyDown={e=>e.key==='Enter'&&submit()} />
            </label>
            <button className="btn btn-primary" onClick={submit}><Send width={16}/> Send</button>
          </div>
          {err && <div style={{ color:'var(--danger)', fontSize:13, marginTop:8 }}>{err}</div>}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Sent</h3><span className="sub">{notifs.length} messages</span></div>
        {notifs.length ? notifs.map(n => (
          <div className="feed-item" key={n.id}>
            <span style={{ color:'var(--sage)', marginTop:1 }}><Bell width={16}/></span>
            <div>
              <strong style={{ fontWeight:500 }}>{n.to}</strong> · {n.msg}
              <div className="ft">{n.time}</div>
            </div>
          </div>
        )) : <div className="empty">No notifications sent yet.</div>}
      </div>
    </>
  );
}
