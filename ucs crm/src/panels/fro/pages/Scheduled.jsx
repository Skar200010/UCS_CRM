import { useState, useEffect, useRef } from 'react';
import { getMyDonors, getDonorDetail, addDonorLog, uploadPaymentScreenshot, reportMissedSchedule } from '../api/donors';

const TABS = [
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'callback', label: 'Callback' },
];

const NOT_CONNECTED = [
  { id: 'busy', label: 'Busy' }, { id: 'ringing', label: 'Ringing' },
  { id: 'unreachable', label: 'Unreachable' }, { id: 'switched_off', label: 'Switched Off' },
  { id: 'wrong_number', label: 'Wrong Number' }, { id: 'invalid', label: 'Invalid' },
  { id: 'rejected', label: 'Rejected' },
];
const CONNECTED = [
  { id: 'lead_done', label: 'Lead Done' }, { id: 'scheduled', label: 'Schedule' },
  { id: 'visit_donate', label: 'Visit & Donate' }, { id: 'promise_to_pay', label: 'Promise to Pay' },
  { id: 'payment_pending', label: 'Payment Pending' }, { id: 'already_donated', label: 'Already Donated' },
  { id: 'not_interested_now', label: 'Not Interested Now' }, { id: 'language_barrier', label: 'Language Barrier' },
  { id: 'transferred_senior', label: 'Transferred to Senior' }, { id: 'query_complaint', label: 'Query/Complaint' },
  { id: 'receipt_request', label: 'Request Receipt/Info' },
];
const ALL_DISPOSITIONS = [...NOT_CONNECTED, ...CONNECTED];
const CONNECTED_IDS = new Set(CONNECTED.map(d => d.id));
const findDisp = (id) => ALL_DISPOSITIONS.find(d => d.id === id);

function getTimeColor(scheduledAt) {
  const diff = new Date(scheduledAt) - new Date();
  const mins = diff / 60000;
  if (diff < 0) return { bg:'#fef2f2', color:'#991b1b', label:'Overdue' };
  if (mins <= 1) return { bg:'#ffedd5', color:'#9a3412', label:'Due now' };
  if (mins <= 2) return { bg:'#fef3c7', color:'#92400e', label:'Due soon' };
  if (mins <= 5) return { bg:'#fef9c3', color:'#854d0e', label:'Upcoming' };
  if (mins <= 15) return { bg:'#f0fdf4', color:'#166534', label:'Scheduled' };
  return { bg:'#f0fdf4', color:'#166534', label:'Scheduled' };
}

function DispositionModal({ donorId, ngoId, donorName, scheduledAt: origScheduledAt, onClose, onDone }) {
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const isOverdue = origScheduledAt && new Date(origScheduledAt) < new Date();

  const handleSave = async () => {
    if (!selected) { setMessage({ type:'error', text:'Select a disposition' }); return; }
    if (selected === 'scheduled' && !scheduledAt) { setMessage({ type:'error', text:'Select date & time' }); return; }
    setSaving(true);
    try {
      await addDonorLog(donorId, {
        action:'disposition',
        disposition_category: CONNECTED_IDS.has(selected) ? 'connected' : 'not_connected',
        disposition_detail: selected,
        notes: notes || null,
        ngo_id: ngoId,
        ...(selected === 'scheduled' && { scheduled_at: new Date(scheduledAt + ':00').toISOString() }),
      });
      onDone();
      onClose();
    } catch (err) {
      setMessage({ type:'error', text: err.message });
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.4)' }} onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:12, width:420, maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:'0 8px 32px rgba(0,0,0,.15)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:'1px solid var(--line)' }}>
          <span style={{ fontSize:13, fontWeight:700 }}>{donorName}</span>
          <span className="material-symbols-outlined" style={{ fontSize:18, cursor:'pointer', color:'var(--ink-soft)' }} onClick={onClose}>close</span>
        </div>
        <div style={{ padding:16, display:'flex', flexDirection:'column', gap:10, overflowY:'auto' }}>
          {message && (
            <div style={{ padding:'6px 10px', borderRadius:6, fontSize:10, fontWeight:600, background: message.type === 'error' ? '#fef2f2' : '#f0fdf4', color: message.type === 'error' ? '#dc2626' : '#16a34a', border:`1px solid ${message.type === 'error' ? '#fecaca' : '#bbf7d0'}` }}>
              {message.text}
            </div>
          )}
          {!isOverdue && origScheduledAt && (
            <div style={{ padding:'6px 10px', borderRadius:6, fontSize:10, fontWeight:600, background:'#f0fdf4', color:'#166534', border:'1px solid #bbf7d0', display:'flex', alignItems:'center', gap:6 }}>
              <span className="material-symbols-outlined" style={{ fontSize:12 }}>schedule</span>
              Already scheduled at {new Date(origScheduledAt).toLocaleString('en-GB')} — skip or log a new disposition
            </div>
          )}
          <div>
            <label style={{ display:'block', fontSize:9, fontWeight:600, color:'var(--ink-soft)', textTransform:'uppercase', letterSpacing:.5, marginBottom:2 }}>Connected</label>
            <select value={selected !== null && CONNECTED_IDS.has(selected) ? selected : ''} onChange={e => { if (e.target.value) { setSelected(e.target.value); if (e.target.value === 'scheduled') { const n=new Date(); n.setMinutes(n.getMinutes()+5-n.getTimezoneOffset()); setScheduledAt(n.toISOString().slice(0,16)); } }}}
              style={{ width:'100%', padding:'6px 8px', border:'1px solid var(--line)', borderRadius:5, fontSize:11, fontFamily:'inherit' }}>
              <option value="">— Select —</option>
              {CONNECTED.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:9, fontWeight:600, color:'var(--ink-soft)', textTransform:'uppercase', letterSpacing:.5, marginBottom:2 }}>Not Connected</label>
            <select value={selected !== null && !CONNECTED_IDS.has(selected) ? selected : ''} onChange={e => { if (e.target.value) setSelected(e.target.value); }}
              style={{ width:'100%', padding:'6px 8px', border:'1px solid var(--line)', borderRadius:5, fontSize:11, fontFamily:'inherit' }}>
              <option value="">— Select —</option>
              {NOT_CONNECTED.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          {selected === 'scheduled' && (
            <div>
              <label style={{ display:'block', fontSize:9, fontWeight:600, color:'var(--ink-soft)', textTransform:'uppercase', letterSpacing:.5, marginBottom:2 }}>Schedule Date & Time</label>
              <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                style={{ width:'100%', padding:'5px 7px', border:'1px solid var(--line)', borderRadius:5, fontSize:11, fontFamily:'inherit', boxSizing:'border-box' }} />
            </div>
          )}
          <div>
            <label style={{ display:'block', fontSize:9, fontWeight:600, color:'var(--ink-soft)', textTransform:'uppercase', letterSpacing:.5, marginBottom:2 }}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Add notes..."
              style={{ width:'100%', padding:6, border:'1px solid var(--line)', borderRadius:5, fontSize:10, fontFamily:'inherit', resize:'none', boxSizing:'border-box' }} />
          </div>
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'space-between', padding:'12px 16px', borderTop:'1px solid var(--line)' }}>
          <div>
            {isOverdue && (
              <button onClick={async () => {
                setSaving(true);
                try {
                  await reportMissedSchedule(donorId, ngoId, origScheduledAt);
                  onDone();
                  onClose();
                } catch (err) {
                  setMessage({ type:'error', text: err.message });
                } finally { setSaving(false); }
              }} disabled={saving}
                style={{ padding:'7px 16px', border:'1px solid #fecaca', borderRadius:6, background:'#fff', fontSize:11, fontWeight:600, fontFamily:'inherit', cursor:'pointer', color:'#dc2626' }}>
                {saving ? 'Reporting...' : 'Report as Missed'}
              </button>
            )}
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={onClose}
              style={{ padding:'7px 12px', border:'1px solid var(--line)', borderRadius:6, background:'#fff', fontSize:11, fontWeight:600, fontFamily:'inherit', cursor:'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving}
              style={{ padding:'7px 12px', border:'none', borderRadius:6, background:'var(--sage)', color:'#fff', fontSize:11, fontWeight:700, fontFamily:'inherit', cursor:'pointer', opacity:saving?.5:1 }}>
              {saving ? 'Saving...' : selected ? `Log ${findDisp(selected)?.label || selected}` : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Scheduled() {
  const [tab, setTab] = useState('scheduled');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalDonor, setModalDonor] = useState(null);
  const [refetch, setRefetch] = useState(0);
  const poppedIds = useRef(new Set());
  const autoPoppedId = useRef(null);
  const [pollTick, setPollTick] = useState(0);

  const loadRows = () => {
    setLoading(true);
    getMyDonors().then(async (list) => {
      const detailResults = await Promise.allSettled(
        list.map(d => getDonorDetail(d.id, d.ngo_id))
      );
      const items = [];
      detailResults.forEach((r, i) => {
        const d = list[i];
        if (r.status === 'fulfilled' && r.value?.next_schedule && !r.value.next_schedule.is_completed) {
          items.push({
            id: d.id,
            ngo_id: d.ngo_id,
            donor_name: d.donor_name,
            donor_mobile: d.donor_mobile,
            scheduled_at: r.value.next_schedule.scheduled_at,
            type: 'scheduled',
          });
        }
      });
      list.forEach(d => {
        if ((d.status === 'follow_up') && !items.find(i => i.id === d.id)) {
          items.push({
            id: d.id,
            ngo_id: d.ngo_id,
            donor_name: d.donor_name,
            donor_mobile: d.donor_mobile,
            scheduled_at: null,
            type: 'callback',
          });
        }
      });
      setRows(items);
    }).catch(() => setRows([]))
    .finally(() => setLoading(false));
  };

  useEffect(() => { loadRows(); }, [refetch]);

  // Poll every 5s for due schedules
  useEffect(() => {
    const interval = setInterval(() => setPollTick(t => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-pop due schedules (one at a time)
  useEffect(() => {
    if (modalDonor) return;
    const due = rows
      .filter(r => r.type === 'scheduled' && r.scheduled_at && new Date(r.scheduled_at) <= new Date() && !poppedIds.current.has(r.id))
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
    if (due.length > 0) {
      const next = due[0];
      poppedIds.current.add(next.id);
      autoPoppedId.current = next.id;
      setModalDonor(next);
    }
  }, [pollTick, rows, modalDonor]);

  const openModal = (row) => {
    poppedIds.current.add(row.id);
    autoPoppedId.current = null;
    setModalDonor(row);
  };

  const handlePopDone = () => {
    autoPoppedId.current = null;
    setModalDonor(null);
    setRefetch(n => n + 1);
  };

  if (loading) return <div className="loading">Loading…</div>;

  const scheduledRows = rows.filter(r => r.type === 'scheduled');
  const callbackRows = rows.filter(r => r.type === 'callback');
  const list = tab === 'scheduled' ? scheduledRows : callbackRows;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--line)', flexShrink:0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding:'10px 20px', border:'none', borderBottom: tab === t.id ? '2px solid var(--sage)' : '2px solid transparent', background:'transparent', fontSize:12, fontWeight:700, fontFamily:'inherit', cursor:'pointer', color: tab === t.id ? 'var(--sage)' : 'var(--ink-soft)' }}>
            {t.label}
            <span style={{ marginLeft:6, fontSize:10, color:'var(--ink-soft)' }}>({(tab==='scheduled'?scheduledRows:callbackRows).length})</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ flex:1, overflowY:'auto' }}>
        {list.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, fontSize:12, color:'var(--ink-soft)' }}>No {tab} entries.</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--line)' }}>
                <th style={{ textAlign:'left', padding:'8px 10px', fontSize:10, fontWeight:600, textTransform:'uppercase', color:'var(--ink-soft)' }}>Donor</th>
                <th style={{ textAlign:'left', padding:'8px 10px', fontSize:10, fontWeight:600, textTransform:'uppercase', color:'var(--ink-soft)' }}>Mobile</th>
                <th style={{ textAlign:'left', padding:'8px 10px', fontSize:10, fontWeight:600, textTransform:'uppercase', color:'var(--ink-soft)' }}>Schedule</th>
                <th style={{ textAlign:'left', padding:'8px 10px', fontSize:10, fontWeight:600, textTransform:'uppercase', color:'var(--ink-soft)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map(r => {
                const st = r.scheduled_at ? getTimeColor(r.scheduled_at) : { bg:'#e0e7ff', color:'#4338ca', label:'Callback' };
                const isPopped = poppedIds.current.has(r.id);
                return (
                  <tr key={r.id} onClick={() => openModal(r)}
                    style={{ borderBottom:'1px solid var(--line)', cursor:'pointer', transition:'background .1s', background: isPopped ? '#f0fdf4' : 'transparent' }}
                    onMouseOver={e => e.currentTarget.style.background = isPopped ? '#e6f7e6' : 'var(--bg)'}
                    onMouseOut={e => e.currentTarget.style.background = isPopped ? '#f0fdf4' : 'transparent'}>
                    <td style={{ padding:'8px 10px', fontWeight:600 }}>{r.donor_name || '—'}</td>
                    <td style={{ padding:'8px 10px' }}>{r.donor_mobile || '—'}</td>
                    <td style={{ padding:'8px 10px' }}>{r.scheduled_at ? new Date(r.scheduled_at).toLocaleString('en-GB') : '—'}</td>
                    <td style={{ padding:'8px 10px' }}>
                      <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:10, fontSize:10, fontWeight:600, background:st.bg, color:st.color, textTransform:'capitalize' }}>{st.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail modal */}
      {modalDonor && (
        <DispositionModal
          donorId={modalDonor.id}
          ngoId={modalDonor.ngo_id}
          donorName={modalDonor.donor_name}
          scheduledAt={modalDonor.scheduled_at}
          onClose={() => {
            if (autoPoppedId.current !== null) poppedIds.current.delete(autoPoppedId.current);
            autoPoppedId.current = null;
            setModalDonor(null);
            setPollTick(t => t + 1);
          }}
          onDone={handlePopDone}
        />
      )}
    </div>
  );
}
