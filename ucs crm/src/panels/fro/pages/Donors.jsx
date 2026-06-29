import { useState, useEffect } from 'react';
import { getMyDonors, getDonorDetail } from '../api/donors';
import { SkeletonDonors } from '../../../components/Skeleton';

const STATUS_PILL = {
  lead_done: 'pill-green', verified: 'pill-green', rejected: 'pill-red',
};

export default function Donors() {
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);
  const [showDetail, setShowDetail] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getMyDonors('lead_done').then(data => { if (mounted) setDonors(data); }).catch(() => { if (mounted) setDonors([]); }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const openDetail = async (d) => {
    setShowDetail(d.id);
    setDetail(null);
    try {
      const data = await getDonorDetail(d.id, d.ngo_id);
      setDetail(data);
    } catch {
      setDetail({ logs: [] });
    }
  };

  const searchFiltered = donors.filter(d =>
    !search || (d.donor_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.donor_mobile || '').includes(search)
  );

  const filtered = searchFiltered.filter(d => {
    if (filter === 'active') return d.has_donated_current_fy === true;
    if (filter === 'inactive') return !d.has_donated_current_fy;
    return true;
  });

  if (loading) return <SkeletonDonors />;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 0', borderBottom:'1px solid var(--line)', flexShrink:0 }}>
        <input type="text" placeholder="Search by name or mobile..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex:1, padding:'7px 10px', border:'1px solid var(--line)', borderRadius:6, fontSize:12, fontFamily:'inherit' }} />
        <span style={{ fontSize:11, color:'var(--ink-soft)', fontWeight:600 }}>{filtered.length} donor{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div style={{ display:'flex', gap:6, padding:'8px 0', borderBottom:'1px solid var(--line)', flexShrink:0 }}>
        {[
          { id: 'all', label: 'All' },
          { id: 'active', label: 'Active' },
          { id: 'inactive', label: 'Inactive' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setFilter(tab.id)}
            style={{
              padding:'5px 14px', border:`1px solid ${filter === tab.id ? 'var(--sage)' : 'var(--line)'}`,
              borderRadius:6, background: filter === tab.id ? 'var(--sage)' : '#fff',
              color: filter === tab.id ? '#fff' : 'var(--ink)',
              fontSize:10, fontWeight:700, fontFamily:'inherit', cursor:'pointer', transition:'all .12s',
            }}>
            {tab.label}
          </button>
        ))}
        {filter === 'active' && <span style={{ fontSize:10, color:'var(--ink-soft)', alignSelf:'center', marginLeft:4 }}>{donors.filter(d => d.has_donated_current_fy).length} active</span>}
        {filter === 'inactive' && <span style={{ fontSize:10, color:'var(--ink-soft)', alignSelf:'center', marginLeft:4 }}>{donors.filter(d => !d.has_donated_current_fy).length} inactive</span>}
      </div>

      <div style={{ flex:1, overflowY:'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, fontSize:12, color:'var(--ink-soft)' }}>No donors found.</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--line)' }}>
                <th style={{ textAlign:'left', padding:'8px 10px', fontSize:10, fontWeight:600, textTransform:'uppercase', color:'var(--ink-soft)' }}>Name</th>
                <th style={{ textAlign:'left', padding:'8px 10px', fontSize:10, fontWeight:600, textTransform:'uppercase', color:'var(--ink-soft)' }}>Status</th>
                <th style={{ textAlign:'left', padding:'8px 10px', fontSize:10, fontWeight:600, textTransform:'uppercase', color:'var(--ink-soft)' }}>Activity</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id} onClick={() => openDetail(d)}
                  style={{ borderBottom:'1px solid var(--line)', cursor:'pointer', background: showDetail === d.id ? '#f0fdf4' : 'transparent' }}
                  onMouseOver={e => e.currentTarget.style.background = showDetail === d.id ? '#e6f7e6' : 'var(--bg)'}
                  onMouseOut={e => e.currentTarget.style.background = showDetail === d.id ? '#f0fdf4' : 'transparent'}>
                  <td style={{ padding:'8px 10px', fontWeight:600 }}>{d.donor_name || '—'}</td>
                  <td style={{ padding:'8px 10px' }}>
                    <span className={`pill ${STATUS_PILL[d.status] || 'pill-gray'}`}>{d.status?.replace(/_/g, ' ') || 'unknown'}</span>
                  </td>
                  <td style={{ padding:'8px 10px' }}>
                    {d.has_donated_current_fy ? (
                      <span className="pill pill-green">Active</span>
                    ) : (
                      <span className="pill pill-gray">Inactive</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {showDetail && detail && (
          <div style={{ margin:'8px 0', border:'1px solid var(--line)', borderRadius:8, background:'#fff' }}>
            <div style={{ padding:'8px 12px', borderBottom:'1px solid var(--line)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontWeight:700, fontSize:12 }}>Payment History</span>
              <span onClick={() => { setShowDetail(null); setDetail(null); }}
                style={{ fontSize:18, cursor:'pointer', color:'var(--ink-soft)' }}>✕</span>
            </div>
            <div style={{ padding:8, maxHeight:300, overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
              {(!detail.logs || detail.logs.length === 0) ? (
                <div style={{ textAlign:'center', padding:16, fontSize:11, color:'var(--ink-soft)' }}>No payment history.</div>
              ) : (
                detail.logs.filter(l => l.amount_collected || l.disposition_detail === 'lead_done').map(l => (
                  <div key={l.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 8px', borderRadius:4, background:'var(--bg)', fontSize:11 }}>
                    <div>
                      <span style={{ fontWeight:600 }}>₹{Number(l.amount_collected || 0).toLocaleString('en-IN')}</span>
                      {l.disposition_detail === 'lead_done' && <span className="pill pill-green" style={{ marginLeft:6, fontSize:9 }}>lead_done</span>}
                      {l.accounts_status && (
                        <span className={`pill ${l.accounts_status === 'verified' ? 'pill-green' : 'pill-red'}`} style={{ marginLeft:4, fontSize:9 }}>
                          {l.accounts_status}
                        </span>
                      )}
                    </div>
                    <span style={{ color:'var(--ink-soft)', fontSize:10 }}>{l.created_at ? new Date(l.created_at).toLocaleString('en-GB') : '—'}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
