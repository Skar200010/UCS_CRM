import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyDonors, getDonorDetail, getFullDonorHistory } from '../api/donors';
import { SkeletonDonors } from '../../../components/Skeleton';

const PERIOD_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'sixmonths', label: '6 Months' },
  { id: 'yearly', label: 'Yearly' },
];

const HISTORY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'yearly', label: 'Yearly' },
  { id: 'sixmonths', label: '6 Months' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'tenyears', label: '10 Years' },
];

export default function Donors() {
  const navigate = useNavigate();
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [period, setPeriod] = useState('all');

  const [modalDonor, setModalDonor] = useState(null);
  const [modalDetail, setModalDetail] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('all');
  const [unlocked, setUnlocked] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const opts = { verifiedOnly: true, period };
    if (filter === 'active') opts.activeOnly = true;
    else if (filter === 'inactive') opts.inactiveOnly = true;
    getMyDonors(null, null, opts)
      .then(data => { if (mounted) setDonors(data); })
      .catch(() => { if (mounted) setDonors([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [period, filter]);

  useEffect(() => { setPage(1); }, [search, filter, period, perPage]);

  const openModal = useCallback(async (d) => {
    setModalDonor(d);
    setModalDetail(null);
    setHistoryFilter('all');
    setUnlocked(false);
    setModalLoading(true);
    try {
      const data = await getDonorDetail(d.id, d.ngo_id);
      setModalDetail(data);
    } catch {
      setModalDetail({ logs: [] });
    }
    setModalLoading(false);
  }, []);

  const closeModal = useCallback(() => {
    setModalDonor(null);
    setModalDetail(null);
    setHistoryFilter('all');
    setUnlocked(false);
  }, []);

  const handleToggleLock = useCallback(async () => {
    if (!modalDonor) return;
    if (unlocked) {
      setUnlocked(false);
      setHistoryFilter('all');
      setModalLoading(true);
      try {
        const data = await getDonorDetail(modalDonor.id, modalDonor.ngo_id);
        setModalDetail(data);
      } catch {
        setModalDetail({ logs: [] });
      }
      setModalLoading(false);
    } else {
      setUnlocked(true);
      setModalLoading(true);
      try {
        const data = await getFullDonorHistory(modalDonor.id, modalDonor.ngo_id, true);
        setModalDetail(data);
      } catch {
        // keep existing
      }
      setModalLoading(false);
    }
  }, [modalDonor, unlocked]);

  const searchFiltered = donors.filter(d =>
    !search || (d.donor_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.donor_mobile || '').includes(search)
  );

  const filtered = searchFiltered.filter(d => {
    if (filter === 'active') return d.has_donated_current_fy === true;
    if (filter === 'inactive') return !d.has_donated_current_fy;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const paginatedDonors = filtered.slice((page - 1) * perPage, page * perPage);

  const filteredLogs = useMemo(() => {
    if (!modalDetail?.logs) return [];
    let filtered = modalDetail.logs.filter(l =>
      l.action === 'donation' || (l.disposition_detail === 'lead_done' && l.accounts_status === 'verified')
    );
    let cutoff;
    if (historyFilter === 'tenyears') {
      cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - 10);
    } else if (historyFilter === 'yearly') {
      cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - 1);
    } else if (historyFilter === 'sixmonths') {
      cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 6);
    } else if (historyFilter === 'monthly') {
      cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
    }
    if (cutoff) {
      filtered = filtered.filter(l => l.created_at && new Date(l.created_at) >= cutoff);
    }
    return filtered;
  }, [modalDetail, historyFilter]);

  const modalStats = useMemo(() => {
    let total = 0, count = 0, lastDate = null;
    for (const l of filteredLogs) {
      if (l.amount_collected) {
        total += Number(l.amount_collected);
        count++;
        if (!lastDate || new Date(l.created_at) > new Date(lastDate)) lastDate = l.created_at;
      }
    }
    return { total, count, lastDate };
  }, [filteredLogs]);

  const handlePeriodChange = (p) => {
    if (p === period) return;
    setPeriod(p);
  };

  if (loading) return <SkeletonDonors />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 5, padding: '6px 0', borderBottom: '1px solid var(--line)', flexShrink: 0, flexWrap: 'wrap' }}>
        {PERIOD_FILTERS.map(p => (
          <button key={p.id} onClick={() => handlePeriodChange(p.id)}
            style={{
              padding: '4px 12px', border: `1px solid ${period === p.id ? '#16a34a' : 'var(--line)'}`,
              borderRadius: 5, background: period === p.id ? '#16a34a' : '#fff',
              color: period === p.id ? '#fff' : 'var(--ink)',
              fontSize: 10, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
            }}>
            {p.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <input type="text" placeholder="Search by name or mobile..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }} />
        <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600 }}>{filtered.length} donor{filtered.length !== 1 ? 's' : ''} &middot; Page {page} of {totalPages}</span>
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '8px 0', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        {[
          { id: 'all', label: 'All' },
          { id: 'active', label: 'Active' },
          { id: 'inactive', label: 'Inactive' },
        ].map(tab => (
          <button key={tab.id} onClick={() => { setFilter(tab.id); closeModal(); }}
            style={{
              padding: '5px 14px', border: `1px solid ${filter === tab.id ? 'var(--sage)' : 'var(--line)'}`,
              borderRadius: 6, background: filter === tab.id ? 'var(--sage)' : '#fff',
              color: filter === tab.id ? '#fff' : 'var(--ink)',
              fontSize: 10, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', transition: 'all .12s',
            }}>
            {tab.label}
          </button>
        ))}
        {filter === 'active' && <span style={{ fontSize: 10, color: 'var(--ink-soft)', alignSelf: 'center', marginLeft: 4 }}>{donors.filter(d => d.has_donated_current_fy).length} active</span>}
        {filter === 'inactive' && <span style={{ fontSize: 10, color: 'var(--ink-soft)', alignSelf: 'center', marginLeft: 4 }}>{donors.filter(d => !d.has_donated_current_fy).length} inactive</span>}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, fontSize: 12, color: 'var(--ink-soft)' }}>No donors found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Activity</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDonors.map(d => (
                <tr key={`${d.id}-${d.ngo_id}`} onClick={() => openModal(d)}
                  style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer', background: modalDonor?.id === d.id ? '#f0fdf4' : 'transparent' }}
                  onMouseOver={e => e.currentTarget.style.background = modalDonor?.id === d.id ? '#e6f7e6' : 'var(--bg)'}
                  onMouseOut={e => e.currentTarget.style.background = modalDonor?.id === d.id ? '#f0fdf4' : 'transparent'}>
                  <td style={{ padding: '8px 10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{d.donor_name || '—'}</span>
                    {d.donor_mobile && (
                      <button onClick={e => { e.stopPropagation(); navigate(`/fro/whatsapp-chat?phone=${d.donor_mobile}`) }}
                        style={{ border: 'none', background: '#25D366', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      </button>
                    )}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
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
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{ padding: '4px 10px', border: '1px solid var(--line)', borderRadius: 5, background: '#fff', fontSize: 10, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', opacity: page === 1 ? 0.4 : 1 }}>
              &larr; Prev
            </button>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)' }}>Page {page} of {totalPages}</span>
            <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); }}
              style={{ padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 5, fontSize: 10, fontFamily: 'inherit', cursor: 'pointer' }}>
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ padding: '4px 10px', border: '1px solid var(--line)', borderRadius: 5, background: '#fff', fontSize: 10, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>
              Next &rarr;
            </button>
          </div>
        )}
      </div>

      {modalDonor && (
        <div className="donor-modal-overlay" onClick={closeModal}>
          <div className="donor-modal" onClick={e => e.stopPropagation()}>
            <div className="donor-modal-header">
              <div className="donor-modal-title-row">
                <span className="donor-modal-name">{modalDonor.donor_name || 'Unknown'}</span>
                {modalDonor.has_donated_current_fy ? (
                  <span className="pill pill-green">Active</span>
                ) : (
                  <span className="pill pill-gray">Inactive</span>
                )}
                <button className="donor-modal-close" onClick={closeModal}>&times;</button>
              </div>
              <div className="donor-modal-info">
                <span>&#128222; {modalDonor.donor_mobile || '—'}</span>
                <span className="donor-modal-sep">|</span>
                <span>&#127963; {modalDonor.donor_city || '—'}</span>
                {modalDonor.donor_pan && <><span className="donor-modal-sep">|</span><span>PAN: {modalDonor.donor_pan}</span></>}
                {modalDonor.donor_dob && <><span className="donor-modal-sep">|</span><span>DOB: {new Date(modalDonor.donor_dob).toLocaleDateString('en-GB')}</span></>}
              </div>
              {modalDonor.donor_project && <div className="donor-modal-project">&#128196; Project: {modalDonor.donor_project}</div>}
              {modalDonor.donor_address && <div className="donor-modal-address">&#127968; {modalDonor.donor_address}</div>}
            </div>

            <div className="donor-modal-stats">
              {[
                { label: 'Total', value: `₹${modalStats.total.toLocaleString('en-IN')}`, color: 'var(--sage)' },
                { label: 'Donations', value: modalStats.count, color: 'var(--ink)' },
                { label: 'Last', value: modalStats.lastDate ? new Date(modalStats.lastDate).toLocaleDateString('en-GB') : '—', color: 'var(--ink-soft)' },
                { label: 'Status', value: modalDonor.has_donated_current_fy ? '● Active' : '● Inactive', color: modalDonor.has_donated_current_fy ? 'var(--sage)' : 'var(--ink-soft)' },
              ].map(s => (
                <div key={s.label} className="donor-modal-stat-item">
                  <div className="donor-modal-stat-label">{s.label}</div>
                  <div className="donor-modal-stat-value" style={{ color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div className="donor-modal-history-filters">
              {HISTORY_FILTERS.map(tab => (
                <button key={tab.id} onClick={() => setHistoryFilter(tab.id)}
                  className={`donor-modal-hf-btn ${historyFilter === tab.id ? 'active' : ''}`}
                  style={(tab.id === 'tenyears' && !unlocked) ? { opacity: 0.5 } : {}}>
                  {tab.label}
                </button>
              ))}
              <button className={`donor-modal-lock-toggle ${unlocked ? 'unlocked' : ''}`} onClick={handleToggleLock}>
                {unlocked ? '\u{1F513} Unlocked' : '\u{1F512} Locked'}
              </button>
            </div>

            <div className="donor-modal-logs">
              {modalLoading ? (
                <div className="donor-modal-empty">Loading...</div>
              ) : filteredLogs.length === 0 ? (
                <div className="donor-modal-empty">No donation history for this period.</div>
              ) : (
                <table className="donor-modal-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Type</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map(l => (
                      <tr key={l.id}>
                        <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                          {l.created_at ? new Date(l.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--sage)' }}>
                          ₹{Number(l.amount_collected || 0).toLocaleString('en-IN')}
                        </td>
                        <td>
                          <span className={`pill ${l.action === 'donation' ? 'pill-blue' : l.disposition_detail === 'lead_done' ? 'pill-green' : 'pill-gray'}`} style={{ fontSize: 9 }}>
                            {l.action === 'donation' ? 'Donation' : l.disposition_detail === 'lead_done' ? 'Lead Done' : l.action || '—'}
                          </span>
                        </td>
                        <td>
                          {l.accounts_status === 'verified' ? (
                            <span className="pill pill-green" style={{ fontSize: 9 }}>&#10003; Verified</span>
                          ) : l.accounts_status === 'rejected' ? (
                            <span className="pill pill-red" style={{ fontSize: 9 }}>&#10007; Rejected</span>
                          ) : l.accounts_status === 'pending' ? (
                            <span className="pill pill-yellow" style={{ fontSize: 9 }}>&#9203; Pending</span>
                          ) : (
                            <span className="pill pill-gray" style={{ fontSize: 9 }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}