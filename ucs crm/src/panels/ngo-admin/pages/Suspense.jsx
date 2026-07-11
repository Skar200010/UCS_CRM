import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPut } from '../api/auth';

const currency = n => n != null ? '\u20B9' + Number(n).toLocaleString('en-IN') : '\u20B90';

export default function Suspense() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(null);
  const searchRefs = useRef({});
  const searchTimer = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiGet('/ngo-admin/suspense');
      setEntries(data || []);
    } catch (err) { alert(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (entryId, q) => {
    setSearchQuery(q);
    if (!q || q.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(null);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      setShowDropdown(entryId);
      try {
        const data = await apiGet(`/ngo-admin/suspense/search-donors?q=${encodeURIComponent(q.trim())}`);
        setSearchResults(data || []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 300);
  };

  const handleLink = async (entryId, donorId) => {
    setLinking(entryId);
    try {
      await apiPut(`/ngo-admin/suspense/${entryId}/link-donor`, { donor_id: donorId });
      setShowDropdown(null);
      setSearchQuery('');
      load();
    } catch (err) { alert(err.message); }
    finally { setLinking(null); }
  };

  const handleNoMatch = async (entryId) => {
    if (!confirm('Mark this entry as no match? It will be sent back to Accounts as verified.')) return;
    setLinking(entryId);
    try {
      await apiPut(`/ngo-admin/suspense/${entryId}/no-match`, {});
      load();
    } catch (err) { alert(err.message); }
    finally { setLinking(null); }
  };

  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e) => {
      const ref = searchRefs.current[showDropdown];
      if (ref && !ref.contains(e.target)) { setShowDropdown(null); setSearchResults([]); setSearchQuery(''); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDropdown]);

  return (
    <div>
      <div className="card-head" style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Suspense Entries</h3>
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
                <th style={{ minWidth: 320 }}>Link to Donor</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>Loading...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>No suspense entries</td></tr>
              ) : (
                entries.map(e => (
                  <tr key={e.id}>
                    <td style={{ fontSize: 12 }}>{e.payment_id || '\u2014'}</td>
                    <td><span className="pill pill-gray">{e.bank_audit_sources?.name || 'Unknown'}</span></td>
                    <td><strong style={{ color: '#dc2626' }}>{currency(e.amount)}</strong></td>
                    <td style={{ fontSize: 12 }}>{e.transaction_date || '\u2014'}</td>
                    <td>
                      <div ref={el => searchRefs.current[e.id] = el} style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="text"
                            value={showDropdown === e.id ? searchQuery : ''}
                            onChange={e2 => handleSearch(e.id, e2.target.value)}
                            onFocus={() => { if (searchQuery.trim().length >= 2) setShowDropdown(e.id); }}
                            placeholder="Search donor name..."
                            style={{ flex: 1, minWidth: 200, fontSize: 12, padding: '5px 8px', border: '1px solid var(--line)', borderRadius: 4, fontFamily: 'inherit' }}
                          />
                          <button
                            className="btn btn-sm"
                            onClick={() => handleNoMatch(e.id)}
                            disabled={linking === e.id}
                            style={{ fontSize: 10, padding: '3px 8px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', whiteSpace: 'nowrap' }}>
                            No Match
                          </button>
                        </div>

                        {showDropdown === e.id && searchResults.length > 0 && (
                          <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff',
                            border: '1px solid var(--line)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,.1)',
                            zIndex: 100, maxHeight: 240, overflowY: 'auto', marginTop: 2,
                          }}>
                            {searchResults.map(d => (
                              <div key={d.id} onClick={() => handleLink(e.id, d.id)}
                                style={{
                                  padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0',
                                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
                                }}
                                onMouseEnter={e2 => e2.currentTarget.style.background = '#f9fafb'}
                                onMouseLeave={e2 => e2.currentTarget.style.background = ''}>
                                <div style={{
                                  width: 28, height: 28, borderRadius: '50%', background: '#dcfce7',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 10, fontWeight: 700, color: '#16a34a', flexShrink: 0,
                                }}>{(d.name || '?')[0]}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, fontSize: 12 }}>{d.name || 'Unknown'}</div>
                                  <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>
                                    {d.mobile_number || ''}{d.city ? ` \u00B7 ${d.city}` : ''} \u00B7 {currency(d.amount || d.total_amount || 0)}
                                  </div>
                                </div>
                                {d.fro_name && (
                                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#e0e7ff', color: '#4338ca', whiteSpace: 'nowrap', fontWeight: 500 }}>
                                    FRO: {d.fro_name}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {showDropdown === e.id && searchQuery.trim().length >= 2 && searchResults.length === 0 && !searching && (
                          <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff',
                            border: '1px solid var(--line)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,.1)',
                            zIndex: 100, marginTop: 2, padding: '12px 14px', textAlign: 'center', fontSize: 12, color: 'var(--ink-soft)',
                          }}>
                            No donors found
                          </div>
                        )}

                        {searching && showDropdown === e.id && (
                          <div style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 2 }}>Searching...</div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
