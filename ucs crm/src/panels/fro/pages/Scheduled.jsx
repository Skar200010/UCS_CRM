import { useState, useEffect } from 'react';
import { getScheduled, getCallbacks } from '../api/donors';
import DispositionModal from '../components/DispositionModal';
import { SkeletonTable } from '../../../components/Skeleton';

const TABS = [
  { id: 'scheduled', label: 'Follow Up' },
  { id: 'callback', label: 'Callback' },
];

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

export default function Scheduled() {
  const [tab, setTab] = useState('scheduled');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalDonor, setModalDonor] = useState(null);
  const [refetch, setRefetch] = useState(0);

  const loadRows = () => {
    setLoading(true);
    Promise.all([getScheduled(), getCallbacks()]).then(([scheduled, callbacks]) => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const items = [];
      const seen = new Set();
      const k = (d) => `${d.id}`;
      (scheduled || []).forEach(d => {
        if (d.scheduled_at && d.scheduled_at.slice(0, 10) !== todayStr && !seen.has(k(d))) {
          seen.add(k(d));
          items.push({ id: d.id, ngo_id: d.ngo_id, donor_name: d.donor_name, donor_mobile: d.donor_mobile, scheduled_at: d.scheduled_at, type: 'scheduled' });
        }
      });
      (callbacks || []).forEach(d => {
        if (!seen.has(k(d))) {
          seen.add(k(d));
          items.push({ id: d.id, ngo_id: d.ngo_id, donor_name: d.donor_name, donor_mobile: d.donor_mobile, scheduled_at: d.scheduled_at || null, type: 'callback' });
        }
      });
      (scheduled || []).forEach(d => {
        if (d.scheduled_at && d.scheduled_at.slice(0, 10) === todayStr && !seen.has(k(d))) {
          seen.add(k(d));
          items.push({ id: d.id, ngo_id: d.ngo_id, donor_name: d.donor_name, donor_mobile: d.donor_mobile, scheduled_at: d.scheduled_at, type: 'callback' });
        }
      });
      setRows(items);
    }).catch(() => setRows([]))
    .finally(() => setLoading(false));
  };

  useEffect(() => { loadRows(); }, [refetch]);

  const openModal = (row) => {
    setModalDonor(row);
  };

  const handlePopDone = () => {
    setModalDonor(null);
    setRefetch(n => n + 1);
  };

  if (loading) return <SkeletonTable rows={8} />;

  const dedupedRows = rows.filter((r, i, a) => i === a.findIndex(x => x.id === r.id));
  const scheduledRows = dedupedRows.filter(r => r.type === 'scheduled');
  const callbackRows = dedupedRows.filter(r => r.type === 'callback');
  const list = tab === 'scheduled' ? scheduledRows : callbackRows;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--line)', flexShrink:0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding:'10px 20px', border:'none', borderBottom: tab === t.id ? '2px solid var(--sage)' : '2px solid transparent', background:'transparent', fontSize:12, fontWeight:700, fontFamily:'inherit', cursor:'pointer', color: tab === t.id ? 'var(--sage)' : 'var(--ink-soft)' }}>
            {t.label}
         <span style={{ marginLeft:6, fontSize:10, color:'var(--ink-soft)' }}>({(t.id==='scheduled'?scheduledRows:callbackRows).length})</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ flex:1, overflowY:'auto' }}>
        {list.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, fontSize:12, color:'var(--ink-soft)' }}>No {TABS.find(t => t.id === tab)?.label || tab} entries.</div>
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
                return (
                  <tr key={r.id} onClick={() => openModal(r)}
                    style={{ borderBottom:'1px solid var(--line)', cursor:'pointer', transition:'background .1s' }}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
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
          donorMobile={modalDonor.donor_mobile}
          scheduledAt={modalDonor.scheduled_at}
          onClose={() => { setModalDonor(null); }}
          onDone={handlePopDone}
        />
      )}
    </div>
  );
}
