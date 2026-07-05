import { useState, useEffect, useRef } from 'react';
import { api } from '../../../api/auth';
import { useRealtime } from '../../../hooks/useRealtime';

const apiGet = (p) => api(p, { _prefix: 'ucs' });
const apiPut = (p, b) => api(p, { method: 'PUT', body: JSON.stringify(b), _prefix: 'ucs' });
const currency = n => n != null ? '\u20B9' + Number(n).toLocaleString('en-IN') : '\u20B90';

const DISPOSITIONS = [
  { cat: 'follow_up', detail: 'call_back', label: 'Call Back' },
  { cat: 'follow_up', detail: 'follow_up', label: 'Follow Up' },
  { cat: 'follow_up', detail: 'not_interested', label: 'Not Interested' },
  { cat: 'follow_up', detail: 'switched_off', label: 'Phone Switched Off' },
  { cat: 'follow_up', detail: 'no_answer', label: 'No Answer' },
  { cat: 'follow_up', detail: 'wrong_number', label: 'Wrong Number' },
  { cat: 'donation', detail: 'lead_done', label: 'Lead Done' },
  { cat: 'other', detail: 'resolved_suspense', label: 'Resolved' },
];

export default function FroSuspense() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [donorName, setDonorName] = useState('');
  const [donorMobile, setDonorMobile] = useState('');
  const [amount, setAmount] = useState('');
  const [disposition, setDisposition] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const searchTimer = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiGet('/fro/suspense');
      setEntries(data || []);
    } catch (err) { alert(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  useRealtime('bank_audit_entries', {
    event: '*',
    onInsert: () => load(),
    onUpdate: () => load(),
    onDelete: () => load(),
  });

  const openModal = (entry) => {
    setShowModal(entry);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedLead(null);
    setScreenshotUrl('');
    setDonorName('');
    setDonorMobile('');
    setAmount(entry.amount);
    setDisposition('');
  };

  const handleSearch = (q) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q || q.length < 2) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiGet('/fro/suspense/search-dispositions?q=' + encodeURIComponent(q));
        setSearchResults(data || []);
      } catch {}
      finally { setSearching(false); }
    }, 300);
  };

  const selectLead = (lead) => {
    setSelectedLead(lead);
    setDonorName(lead.donor_name);
    setDonorMobile(lead.donor_mobile || '');
    setAmount(lead.amount || amount);
    setSearchResults([]);
    setSearchQuery(lead.donor_name);
  };

  const handleSubmit = async () => {
    if (!donorName) { alert('Please provide donor name'); return; }
    if (!disposition) { alert('Please select a disposition'); return; }
    if (!showModal) return;
    setSubmitting(true);
    try {
      const disp = DISPOSITIONS.find(d => d.detail === disposition);
      await apiPut('/fro/suspense/' + showModal.id + '/resolve', {
        screenshot_url: screenshotUrl,
        donor_name: donorName,
        donor_mobile: donorMobile,
        amount: parseFloat(amount) || 0,
        disposition_category: disp?.cat || 'other',
        disposition_detail: disposition,
      });
      setShowModal(null);
      load();
    } catch (err) { alert(err.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div>
      <div className="card-head" style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Assigned Suspense</h3>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Payment ID</th>
                <th>Source</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>Loading...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>No suspense assigned</td></tr>
              ) : (
                entries.map(e => (
                  <tr key={e.id}>
                    <td style={{ fontSize: 12 }}>{e.payment_id || '\u2014'}</td>
                    <td><span className="pill pill-gray">{e.bank_audit_sources?.name || 'Unknown'}</span></td>
                    <td><strong style={{ color: '#dc2626' }}>{currency(e.amount)}</strong></td>
                    <td style={{ fontSize: 12 }}>{e.transaction_date || '\u2014'}</td>
                    <td>{e.status === 'verified' ? <span className="pill pill-green">Resolved</span> : <span className="pill pill-yellow">Pending</span>}</td>
                    <td>
                      {e.status !== 'verified' && (
                        <button className="btn btn-sm" onClick={() => openModal(e)} style={{ fontSize: 11, padding: '2px 8px', background: 'var(--sage)', color: '#fff', border: 'none' }}>
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-head">
              <h3>Resolve Suspense</h3>
              <button className="btn btn-sm btn-icon" onClick={() => setShowModal(null)} style={{ padding: 4 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Search Past Dispositions</label>
                <input
                  value={searchQuery}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="Search by donor name..."
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', boxSizing: 'border-box' }}
                />
                {(searchResults.length > 0 || searching) && (
                  <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', marginTop: 6 }}>
                    {searching ? (
                      <div style={{ padding: 12, fontSize: 12, color: 'var(--ink-soft)', textAlign: 'center' }}>Searching...</div>
                    ) : (
                      searchResults.map(r => (
                        <div key={r.id}
                          onClick={() => selectLead(r)}
                          style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                          onMouseOver={e => e.currentTarget.style.background = 'var(--bg)'}
                          onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                          <div>
                            <strong>{r.donor_name}</strong>
                            {r.donor_mobile && <span style={{ color: 'var(--ink-soft)', marginLeft: 6, fontSize: 11 }}>{r.donor_mobile}</span>}
                            <div style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 1 }}>{r.disposition_detail} | {new Date(r.created_at).toLocaleDateString('en-IN')}</div>
                          </div>
                          <span style={{ color: 'var(--sage)', fontWeight: 600 }}>{currency(r.amount)}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Entry Details</div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                    Donor Name *
                    <input value={donorName} onChange={e => setDonorName(e.target.value)} placeholder="Donor name" />
                  </label>
                  <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                    Mobile
                    <input value={donorMobile} onChange={e => setDonorMobile(e.target.value)} placeholder="Mobile" />
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                    Amount
                    <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
                  </label>
                  <label className="field" style={{ marginBottom: 0, flex: 1 }}>
                    Screenshot URL
                    <input value={screenshotUrl} onChange={e => setScreenshotUrl(e.target.value)} placeholder="Payment screenshot URL" />
                  </label>
                </div>
                <label className="field" style={{ marginBottom: 0 }}>
                  Disposition *
                  <select value={disposition} onChange={e => setDisposition(e.target.value)}>
                    <option value="">Select disposition...</option>
                    {DISPOSITIONS.map(d => (
                      <option key={d.detail} value={d.detail}>{d.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setShowModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Resolve & Create Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
