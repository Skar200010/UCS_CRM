import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../api/auth';
import { useRealtime } from '../../../hooks/useRealtime';

const currency = n => n != null ? '\u20B9' + Number(n).toLocaleString('en-IN') : '\u20B90';

const COLORS = ['#5B6B4E', '#B5603A', '#C08A2E', '#4F6472', '#7A5C7E', '#88693D', '#2E7D6F', '#9B59B6'];

function SkeletonStat() {
  return (
    <div className="stat-card" style={{ opacity: 0.6 }}>
      <div className="stat-icon" style={{ background: '#e5e7eb' }}>
        <div style={{ width: 18, height: 18, borderRadius: 4, background: '#d1d5db' }} />
      </div>
      <div className="stat-info">
        <div className="stat-num" style={{ height: 22, width: '60%', borderRadius: 4, background: 'linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%)', backgroundSize: '200% 100%', animation: 'sk-shimmer 1.4s infinite' }}>&nbsp;</div>
        <div className="stat-lbl" style={{ height: 12, width: '40%', borderRadius: 4, marginTop: 4, background: 'linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%)', backgroundSize: '200% 100%', animation: 'sk-shimmer 1.4s infinite' }}>&nbsp;</div>
      </div>
    </div>
  );
}

function SkeletonTableRows({ rows, cols }) {
  return Array.from({ length: rows }, (_, i) => (
    <tr key={i}>
      {Array.from({ length: cols }, (_, j) => (
        <td key={j}>
          <div style={{ height: 12, width: j === 2 ? 60 : j === 5 ? 100 : 70, borderRadius: 4, background: 'linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%)', backgroundSize: '200% 100%', animation: 'sk-shimmer 1.4s infinite' }}>&nbsp;</div>
        </td>
      ))}
    </tr>
  ));
}

export default function BankAudit() {
  const [entries, setEntries] = useState([]);
  const [sources, setSources] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState('unverified');
  const [selectedDate, setSelectedDate] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showEditEntry, setShowEditEntry] = useState(null);
  const [showSources, setShowSources] = useState(false);
  const [entryForm, setEntryForm] = useState({ source_id: '', amount: '', payment_id: '', check_id: '', transaction_date: '', remarks: '' });
  const [saving, setSaving] = useState(false);
  const [sourceName, setSourceName] = useState('');
  const [error, setError] = useState('');

  const statusRef = useRef(statusTab);

  async function doLoad(dt, st) {
    const sv = st || statusRef.current;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (dt) { params.set('date_from', dt); params.set('date_to', dt); }
      params.set('status', sv);
      const q = params.toString();
      const path = '/accounts/bank-audit';
      const results = await Promise.allSettled([
        apiGet(path + '/entries?' + q),
        apiGet(path + '/sources'),
        apiGet(path + '/summary?' + q),
      ]);
      const [entriesRes, sourcesRes, summaryRes] = results;
      if (entriesRes.status === 'fulfilled') setEntries(entriesRes.value);
      else { console.error('entries failed:', entriesRes.reason); setError('Failed to load entries: ' + entriesRes.reason.message); }
      if (sourcesRes.status === 'fulfilled') setSources(sourcesRes.value);
      else console.error('sources failed:', sourcesRes.reason);
      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value);
      else console.error('summary failed:', summaryRes.reason);
    } catch (err) { console.error(err); setError(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    statusRef.current = statusTab;
    doLoad(selectedDate, statusTab);
  }, [statusTab]);

  useEffect(() => {
    doLoad(selectedDate, statusTab);
  }, [selectedDate]);

  useRealtime('bank_audit_entries', {
    event: '*',
    onInsert: () => doLoad(statusRef.current === 'unverified' ? selectedDate : selectedDate, statusRef.current),
    onUpdate: () => doLoad(selectedDate, statusRef.current),
    onDelete: () => doLoad(selectedDate, statusRef.current),
  });

  const handleAddEntry = async () => {
    if (!entryForm.source_id || !entryForm.amount || !entryForm.transaction_date) {
      alert('Source, amount, and transaction date are required');
      return;
    }
    setSaving(true);
    try {
      await apiPost('/accounts/bank-audit/entries', entryForm);
      setShowAddEntry(false);
      setEntryForm({ source_id: '', amount: '', payment_id: '', check_id: '', transaction_date: '', remarks: '' });
      doLoad(selectedDate, statusTab);
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const handleEditEntry = async () => {
    if (!showEditEntry) return;
    setSaving(true);
    try {
      await apiPut('/accounts/bank-audit/entries/' + showEditEntry.id, entryForm);
      setShowEditEntry(null);
      setEntryForm({ source_id: '', amount: '', payment_id: '', check_id: '', transaction_date: '', remarks: '' });
      doLoad(selectedDate, statusTab);
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const handleDeleteEntry = async (id) => {
    if (!confirm('Delete this entry?')) return;
    try {
      await apiDelete('/accounts/bank-audit/entries/' + id);
      doLoad(selectedDate, statusTab);
    } catch (err) { alert(err.message); }
  };

  const handleAddSource = async () => {
    if (!sourceName) return;
    try {
      await apiPost('/accounts/bank-audit/sources', { name: sourceName });
      setSourceName('');
      const s = await apiGet('/accounts/bank-audit/sources');
      setSources(s);
    } catch (err) { alert(err.message); }
  };

  const handleDeleteSource = async (id) => {
    if (!confirm('Delete this source?')) return;
    try {
      await apiDelete('/accounts/bank-audit/sources/' + id);
      const s = await apiGet('/accounts/bank-audit/sources');
      setSources(s);
    } catch (err) { alert(err.message); }
  };

  const openEditEntry = (entry) => {
    setEntryForm({
      source_id: entry.source_id,
      amount: entry.amount,
      payment_id: entry.payment_id || '',
      check_id: entry.check_id || '',
      transaction_date: entry.transaction_date,
      remarks: entry.remarks || '',
    });
    setShowEditEntry(entry);
  };

  const getSourceName = (id) => {
    const s = sources.find(s => s.id === id);
    return s ? s.name : 'Unknown';
  };

  const totalAmount = entries.reduce((s, e) => s + Number(e.amount || 0), 0);

  const SvgX = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  );

  const SvgBank = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 2 7 2 9 22 9 22 7 12 2"/><rect x="4" y="11" width="3" height="7"/><rect x="10.5" y="11" width="3" height="7"/><rect x="17" y="11" width="3" height="7"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
  );

  const SvgChart = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
  );

  const SvgActivity = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  );

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card" style={loading ? { opacity: 0.6, gridColumn: '1 / -1' } : { gridColumn: '1 / -1', border: '2px solid #5B6B4E', background: 'linear-gradient(135deg, #5B6B4E08 0%, #5B6B4E18 100%)', padding: '18px 22px' }}>
          <div className="stat-icon" style={{ background: loading ? '#e5e7eb' : '#5B6B4E20', color: loading ? '#d1d5db' : '#5B6B4E', width: 48, height: 48, borderRadius: 14 }}>
            {loading ? <div style={{ width: 24, height: 24, borderRadius: 4, background: '#d1d5db' }} /> : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v12"/><path d="M9 9h5a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2H9"/></svg>
            )}
          </div>
          <div className="stat-info">
            {loading ? (
              <>
                <div className="stat-num" style={{ height: 30, width: '40%', borderRadius: 4, background: 'linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%)', backgroundSize: '200% 100%', animation: 'sk-shimmer 1.4s infinite' }}>&nbsp;</div>
                <div className="stat-lbl" style={{ height: 14, width: '15%', borderRadius: 4, marginTop: 6, background: 'linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%)', backgroundSize: '200% 100%', animation: 'sk-shimmer 1.4s infinite' }}>&nbsp;</div>
              </>
            ) : (
              <>
                <div className="stat-num" style={{ fontSize: 28, fontWeight: 800, color: '#5B6B4E' }}>{currency(totalAmount)}</div>
                <div className="stat-lbl" style={{ fontSize: 13, fontWeight: 600, color: '#5B6B4E', opacity: 0.7 }}>Total Collected</div>
              </>
            )}
          </div>
        </div>
        {loading
          ? Array.from({ length: Math.max(sources.length || 4, 4) }, (_, i) => <SkeletonStat key={i} />)
          : sources.filter(s => s.is_active !== false).map((s, i) => (
              <div key={s.id} className="stat-card">
                <div className="stat-icon" style={{ background: COLORS[i % COLORS.length] + '18', color: COLORS[i % COLORS.length] }}>
                  <SvgBank />
                </div>
                <div className="stat-info">
                  <div className="stat-num">{currency(summary[s.name] || 0)}</div>
                  <div className="stat-lbl">{s.name}</div>
                </div>
              </div>
            ))}
      </div>

      {error && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:6, padding:'8px 12px', marginBottom:12, fontSize:13, color:'#991b1b' }}>{error}</div>}

      <div style={{ display:'flex', gap:0, marginBottom:16, borderBottom:'2px solid var(--line)' }}>
        <button onClick={() => setStatusTab('unverified')}
          style={{ padding:'8px 18px', fontSize:13, fontWeight:600, border:'none', background:'none', cursor:'pointer', color: statusTab === 'unverified' ? 'var(--sage)' : 'var(--ink-soft)', borderBottom: statusTab === 'unverified' ? '2px solid var(--sage)' : '2px solid transparent', marginBottom:-2 }}>
          Pending
        </button>
        <button onClick={() => setStatusTab('verified')}
          style={{ padding:'8px 18px', fontSize:13, fontWeight:600, border:'none', background:'none', cursor:'pointer', color: statusTab === 'verified' ? 'var(--sage)' : 'var(--ink-soft)', borderBottom: statusTab === 'verified' ? '2px solid var(--sage)' : '2px solid transparent', marginBottom:-2 }}>
          History
        </button>
      </div>

      <div className="card">
        <div className="filter-bar" style={{ flexWrap: 'wrap', gap: 8 }}>
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            {selectedDate ? <span>Date</span> : <span style={{ color: 'var(--sage)', fontWeight: 600 }}>All Dates</span>}
            <input type="date" value={selectedDate} onChange={e => { const v = e.target.value; setSelectedDate(v); doLoad(v, statusTab); }}
              style={{ fontSize: 12, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--line)', width: 150 }} />
            {selectedDate && <button className="btn btn-sm" onClick={() => { setSelectedDate(''); doLoad('', statusTab); }} style={{ fontSize: 11, padding: '2px 6px' }}>Clear</button>}
          </label>
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
            style={{ fontSize: 12, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--line)' }}>
            <option value="">All Sources</option>
            {sources.filter(s => s.is_active !== false).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button className="btn btn-sm" onClick={() => doLoad(selectedDate, statusTab)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.4-3.4L23 10M1 14l5.1 4.4A9 9 0 0 0 20.5 15"/></svg>
            Refresh
          </button>
          <button className="btn btn-sm" onClick={() => { setEntryForm({ source_id: '', amount: '', payment_id: '', check_id: '', transaction_date: '', remarks: '' }); setShowAddEntry(true); }}
            style={{ marginLeft: 'auto', background: 'var(--sage)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Entry
          </button>
          <button className="btn btn-sm" onClick={() => { setSourceName(''); setShowSources(true); }} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Manage Sources
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Source</th>
                <th>Amount</th>
                <th>Payment ID</th>
                <th>Check ID</th>
                <th>Remarks</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonTableRows rows={5} cols={7} />
              ) : entries.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>No entries yet</td></tr>
              ) : (
                (sourceFilter ? entries.filter(e => e.source_id === Number(sourceFilter)) : entries).map(e => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{e.transaction_date}</td>
                    <td><span className="pill pill-gray">{e.bank_audit_sources?.name || getSourceName(e.source_id)}</span></td>
                    <td><strong style={{ color: 'var(--sage)' }}>{currency(e.amount)}</strong></td>
                    <td style={{ fontSize: 12 }}>{e.payment_id || '\u2014'}</td>
                    <td style={{ fontSize: 12 }}>{e.check_id || '\u2014'}</td>
                    <td style={{ fontSize: 12, maxWidth: 180, whiteSpace: 'pre-wrap' }}>{e.remarks || '\u2014'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm" onClick={() => openEditEntry(e)} style={{ fontSize: 11, padding: '2px 8px' }}>Edit</button>
                        <button className="btn btn-sm" onClick={() => handleDeleteEntry(e.id)} style={{ fontSize: 11, padding: '2px 8px', color: '#dc2626' }}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddEntry && (
        <div className="modal-overlay" onClick={() => setShowAddEntry(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-head">
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Add Bank Entry</h3>
              <button className="btn btn-sm btn-icon" onClick={() => setShowAddEntry(false)} style={{ padding: 4 }}><SvgX /></button>
            </div>
            <div className="modal-body" style={{ padding: '18px 22px' }}>
              <label className="field" style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Source *</span>
                <select value={entryForm.source_id} onChange={e => setEntryForm(p => ({ ...p, source_id: e.target.value }))} style={{ marginTop: 4 }}>
                  <option value="">Select source...</option>
                  {sources.filter(s => s.is_active !== false).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
              <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Amount *</span>
                  <input type="number" step="0.01" value={entryForm.amount} onChange={e => setEntryForm(p => ({ ...p, amount: e.target.value }))} placeholder="e.g. 5000" style={{ marginTop: 4 }} />
                </label>
                <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Date *</span>
                  <input type="date" value={entryForm.transaction_date} onChange={e => setEntryForm(p => ({ ...p, transaction_date: e.target.value }))} style={{ marginTop: 4 }} />
                </label>
              </div>
              <label className="field" style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Payment ID</span>
                <input value={entryForm.payment_id} onChange={e => setEntryForm(p => ({ ...p, payment_id: e.target.value }))} placeholder="UPI ref / transaction ID" style={{ marginTop: 4 }} />
              </label>
              <div style={{ display: 'flex', gap: 14 }}>
                <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Check ID</span>
                  <input value={entryForm.check_id} onChange={e => setEntryForm(p => ({ ...p, check_id: e.target.value }))} placeholder="Check number" style={{ marginTop: 4 }} />
                </label>
                <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Remarks</span>
                  <input value={entryForm.remarks} onChange={e => setEntryForm(p => ({ ...p, remarks: e.target.value }))} placeholder="Any notes..." style={{ marginTop: 4 }} />
                </label>
              </div>
            </div>
            <div className="modal-foot" style={{ padding: '12px 22px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowAddEntry(false)} style={{ minWidth: 80 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddEntry} disabled={saving} style={{ minWidth: 80 }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditEntry && (
        <div className="modal-overlay" onClick={() => setShowEditEntry(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="modal-head">
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Edit Entry</h3>
              <button className="btn btn-sm btn-icon" onClick={() => setShowEditEntry(null)} style={{ padding: 4 }}><SvgX /></button>
            </div>
            <div className="modal-body" style={{ padding: '18px 22px' }}>
              <label className="field" style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Source *</span>
                <select value={entryForm.source_id} onChange={e => setEntryForm(p => ({ ...p, source_id: e.target.value }))} style={{ marginTop: 4 }}>
                  <option value="">Select source...</option>
                  {sources.filter(s => s.is_active !== false).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
              <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Amount *</span>
                  <input type="number" step="0.01" value={entryForm.amount} onChange={e => setEntryForm(p => ({ ...p, amount: e.target.value }))} style={{ marginTop: 4 }} />
                </label>
                <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Date *</span>
                  <input type="date" value={entryForm.transaction_date} onChange={e => setEntryForm(p => ({ ...p, transaction_date: e.target.value }))} style={{ marginTop: 4 }} />
                </label>
              </div>
              <label className="field" style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Payment ID</span>
                <input value={entryForm.payment_id} onChange={e => setEntryForm(p => ({ ...p, payment_id: e.target.value }))} style={{ marginTop: 4 }} />
              </label>
              <div style={{ display: 'flex', gap: 14 }}>
                <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Check ID</span>
                  <input value={entryForm.check_id} onChange={e => setEntryForm(p => ({ ...p, check_id: e.target.value }))} style={{ marginTop: 4 }} />
                </label>
                <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Remarks</span>
                  <input value={entryForm.remarks} onChange={e => setEntryForm(p => ({ ...p, remarks: e.target.value }))} style={{ marginTop: 4 }} />
                </label>
              </div>
            </div>
            <div className="modal-foot" style={{ padding: '12px 22px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowEditEntry(null)} style={{ minWidth: 80 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEditEntry} disabled={saving} style={{ minWidth: 80 }}>
                {saving ? 'Saving...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSources && (
        <div className="modal-overlay" onClick={() => setShowSources(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal-head">
              <h3>Manage Sources</h3>
              <button className="btn btn-sm" onClick={() => setShowSources(false)} style={{ display: 'flex', alignItems: 'center' }}><SvgX /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <input value={sourceName} onChange={e => setSourceName(e.target.value)}
                  placeholder="New source name..."
                  style={{ flex: 1, padding: '6px 8px', fontSize: 13, border: '1px solid var(--line)', borderRadius: 4 }}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddSource(); }} />
                <button className="btn btn-sm btn-primary" onClick={handleAddSource} disabled={!sourceName}>Add</button>
              </div>
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                {sources.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                    <span style={{ fontSize: 13 }}>{s.name}</span>
                    <button className="btn btn-sm" onClick={() => handleDeleteSource(s.id)} style={{ fontSize: 11, padding: '2px 8px', color: '#dc2626' }}>Delete</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setShowSources(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
