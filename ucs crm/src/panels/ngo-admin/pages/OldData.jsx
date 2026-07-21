import { useState, useEffect, useMemo } from 'react';
import { apiGet } from '../api/auth';

const PER_PAGE = 50;

const statusLabel = (s) => {
  const labels = {
    pending: 'Pending', contacted: 'Contacted', scheduled: 'Scheduled',
    callback: 'Callback', follow_up: 'Follow Up', busy: 'Busy',
    ringing: 'Ringing', unreachable: 'Unreachable', switched_off: 'Switched Off',
    wrong_number: 'Wrong Number', invalid_number: 'Invalid', rejected: 'Rejected',
    lead_done: 'Lead Done', visit_donate: 'Visit & Donate',
    promise_to_pay: 'Promise to Pay', payment_pending: 'Payment Pending',
    already_donated: 'Already Donated', not_interested: 'Not Interested',
    not_interested_now: 'Not Interested Now', language_barrier: 'Language Barrier',
    transferred_senior: 'Transferred to Senior', query_complaint: 'Query/Complaint',
    receipt_request: 'Receipt Request', donation_collected: 'Donation Collected',
  };
  return labels[s] || s || '\u2014';
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '\u2014';
const fmtAmt = (n) => n != null && n !== '' ? '\u20B9' + Number(n).toLocaleString('en-IN') : '\u2014';

const raw = (d, ...keys) => {
  for (const k of keys) {
    const v = d.raw_data?.[k];
    if (v != null && v !== '') return String(v);
  }
  return '\u2014';
};

export default function OldData() {
  const [donors, setDonors] = useState([]);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [station, setStation] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    apiGet('/ngo-admin/stations').then(r => {
      const list = Array.isArray(r) ? r.map(s => s.station || s).filter(Boolean).sort() : [];
      setStations(list);
    }).catch(() => {});
  }, []);

  const load = async (st) => {
    if (!st) { setDonors([]); setLoading(false); return; }
    setLoading(true);
    try {
      const data = await apiGet(`/ngo-admin/donors-by-station?station=${encodeURIComponent(st)}`);
      setDonors(Array.isArray(data) ? data : []);
    } catch { setDonors([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(station); setPage(1); }, [station]);

  const oldOnly = useMemo(() => donors.filter(d => d.raw_data != null), [donors]);

  const duplicateMobiles = useMemo(() => {
    const counts = {};
    oldOnly.forEach(d => {
      const m = d.donor_mobile;
      if (m) counts[m] = (counts[m] || 0) + 1;
    });
    const dupSet = new Set();
    for (const [m, c] of Object.entries(counts)) {
      if (c > 1) dupSet.add(m);
    }
    return dupSet;
  }, [oldOnly]);

  const filtered = useMemo(() => {
    if (!search) return oldOnly;
    const q = search.toLowerCase();
    return oldOnly.filter(d =>
      (d.donor_name || '').toLowerCase().includes(q) ||
      (d.donor_mobile || '').includes(q)
    );
  }, [oldOnly, search]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  useEffect(() => { setPage(1); }, [search]);

  return (
    <div>
      <div className="card-head" style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Old Data (Station Wise)</h3>
      </div>

      <div className="filter-bar" style={{ marginBottom: 12, gap: 10 }}>
        <select value={station} onChange={e => setStation(e.target.value)}
          style={{ fontSize: 13, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line)', minWidth: 200 }}>
          <option value="">-- Select Station --</option>
          {stations.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input placeholder="Search name or mobile..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ fontSize: 13, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line)', width: 280 }} />
        <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
          {station ? `${filtered.length} donors` : 'Select a station'}
        </span>
      </div>

      <div className="card">
        <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
          <table style={{ fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
              <tr>
                <th>Sr.</th>
                <th>Station</th>
                <th>Agent Name</th>
                <th>Donor Name</th>
                <th>Mobile</th>
                <th>Mobile 2</th>
                <th>Amount</th>
                <th>Data Category</th>
                <th>Call Date</th>
                <th>Disposition</th>
                <th>Call Back Date</th>
                <th>Time To Call</th>
                <th>Remark 1</th>
                <th>Remark 2</th>
                <th>Remark 3</th>
              </tr>
            </thead>
            <tbody>
              {!station ? (
                <tr><td colSpan={15} style={{ textAlign: 'center', padding: 30, color: 'var(--ink-soft)' }}>Select a station to view data</td></tr>
              ) : loading ? (
                <tr><td colSpan={15} style={{ textAlign: 'center', padding: 30, color: 'var(--ink-soft)' }}>Loading...</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={15} style={{ textAlign: 'center', padding: 30, color: 'var(--ink-soft)' }}>No donors found for this station</td></tr>
              ) : paginated.map((d, i) => {
                const isDup = duplicateMobiles.has(d.donor_mobile);
                return (
                  <tr key={d.id || i} style={isDup ? { background: '#fef2f2' } : {}}>
                    <td style={{ color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{(page - 1) * PER_PAGE + i + 1}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{d.station || '\u2014'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{d.fro_name && d.fro_name !== 'Unassigned' ? d.fro_name : raw(d, 'Agent Name', 'agent_name', 'fro_name', 'Fro_Name') || '\u2014'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {d.donor_name || raw(d, 'Donor Name', 'donor_name', 'name', 'Name')}
                      {isDup && <span key="dup" style={{ marginLeft: 4, fontSize: 9, padding: '1px 5px', borderRadius: 8, background: '#dc2626', color: '#fff', fontWeight: 700, verticalAlign: 'middle' }}>DUP</span>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{d.donor_mobile || raw(d, 'Mobile', 'mobile', 'mobile_number', 'Mobile Number', 'Mobile No')}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{d.donor_mobile_2 || raw(d, 'Max of Mobile no.2', 'Mobile 2', 'Mobile No 2', 'mobile_2')}</td>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtAmt(d.amount) !== '\u2014' ? fmtAmt(d.amount) : raw(d, 'Max of Amt', 'Amount', 'amount', 'Amt')}</td>
                    <td>{d.data_category || raw(d, 'Data Category', 'Data category', 'data_category')}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(d.last_contacted_at) !== '\u2014' ? fmtDate(d.last_contacted_at) : raw(d, 'Call Date', 'call_date', 'CallDate')}</td>
                    <td><span className="pill pill-blue" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>{statusLabel(d.status)}</span></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(d.next_follow_up) !== '\u2014' ? fmtDate(d.next_follow_up) : raw(d, 'Call Back Date', 'CallBack Date', 'call_back_date', 'Callback Date')}</td>
                    <td>{raw(d, 'Time To Be call', 'Time To Be call', 'Time', 'call_time')}</td>
                    <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.notes || raw(d, 'Remark 1', 'Remark1', 'remark_1', 'Remark')}</td>
                    <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{raw(d, 'Remark 2', 'Remark2', 'remark_2')}</td>
                    <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{raw(d, 'Remark 3', 'Remark3', 'remark_3')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {station && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: '1px solid var(--line)' }}>
            <button className="btn btn-sm btn-outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Page {page} of {totalPages}</span>
            <button className="btn btn-sm btn-outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}