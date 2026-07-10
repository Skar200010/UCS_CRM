import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost, apiDelete } from '../api/auth';

const PROJECT_LABELS = { bsct: 'Being Sevak', maan: 'Mann Care', aflf: 'Ashray' };

export default function WhatsAppAgents() {
  const [accounts, setAccounts] = useState([]);
  const [agents, setAgents] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState({});
  const [results, setResults] = useState({});
  const [assigning, setAssigning] = useState({});
  const timers = useRef({});

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const accs = await apiGet('/whatsapp/accounts');
      setAccounts(accs || []);
      const agentMap = {};
      for (const acc of (accs || [])) {
        try {
          const data = await apiGet(`/whatsapp/accounts/${acc.id}/agents`);
          agentMap[acc.id] = data || [];
        } catch { agentMap[acc.id] = []; }
      }
      setAgents(agentMap);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAccounts(); }, []);

  const handleSearch = (accountId, query) => {
    setSearch(prev => ({ ...prev, [accountId]: query }));
    if (timers.current[accountId]) clearTimeout(timers.current[accountId]);
    if (query.length < 2) { setResults(prev => ({ ...prev, [accountId]: [] })); return; }
    timers.current[accountId] = setTimeout(async () => {
      try {
        const data = await apiGet(`/whatsapp/accounts/agents/search?q=${encodeURIComponent(query)}`);
        setResults(prev => ({ ...prev, [accountId]: data || [] }));
      } catch { setResults(prev => ({ ...prev, [accountId]: [] })); }
    }, 300);
  };

  const assignAgent = async (accountId, froWorkerId) => {
    setAssigning(prev => ({ ...prev, [`${accountId}-${froWorkerId}`]: true }));
    try {
      await apiPost(`/whatsapp/accounts/${accountId}/agents`, { froWorkerId });
      setSearch(prev => ({ ...prev, [accountId]: '' }));
      setResults(prev => ({ ...prev, [accountId]: [] }));
      const data = await apiGet(`/whatsapp/accounts/${accountId}/agents`);
      setAgents(prev => ({ ...prev, [accountId]: data || [] }));
    } catch (err) { alert(err.message); }
    finally { setAssigning(prev => ({ ...prev, [`${accountId}-${froWorkerId}`]: false })); }
  };

  const removeAgent = async (accountId, froId, name) => {
    if (!confirm(`Remove "${name}" from this account?`)) return;
    try {
      await apiDelete(`/whatsapp/accounts/${accountId}/agents/${froId}`);
      const data = await apiGet(`/whatsapp/accounts/${accountId}/agents`);
      setAgents(prev => ({ ...prev, [accountId]: data || [] }));
    } catch (err) { alert(err.message); }
  };

  if (loading) return <div style={{ padding: 20, fontSize: 14, color: '#6b7280' }}>Loading...</div>;

  return (
    <div>
      {accounts.length === 0 ? (
        <div className="card">
          <div className="card-pad" style={{ textAlign: 'center', padding: 40, fontSize: 14, color: '#6b7280' }}>
            No WhatsApp accounts found. Add one in WhatsApp Settings first.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {accounts.map(acc => {
            const accAgents = agents[acc.id] || [];
            return (
              <div key={acc.id} className="card" style={{ overflow: 'visible' }}>
                <div className="card-head">
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{acc.name}</h3>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{PROJECT_LABELS[acc.project] || acc.project} &middot; {accAgents.length} agent{accAgents.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="card-pad">
                  {accAgents.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      {accAgents.map(agent => {
                        const w = agent.workers || {};
                        return (
                          <div key={agent.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#5B6B4E20', color: '#5B6B4E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                              {(w.name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{w.name || 'Unknown'}</div>
                              <div style={{ fontSize: 11, color: '#6b7280' }}>{w.phone || w.email || ''}</div>
                            </div>
                            <button className="btn btn-sm" onClick={() => removeAgent(acc.id, agent.fro_worker_id, w.name || 'Unknown')}
                              style={{ fontSize: 11, padding: '3px 10px', color: '#dc2626', border: '1px solid #fecaca' }}>Remove</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Add Agent</div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        value={search[acc.id] || ''}
                        onChange={e => handleSearch(acc.id, e.target.value)}
                        placeholder="Search FRO by name, email, or mobile..."
                        style={{ width: '100%', padding: '7px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }}
                      />
                      {results[acc.id] && results[acc.id].length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, maxHeight: 200, overflowY: 'auto', zIndex: 10, marginTop: 2, boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}>
                          {results[acc.id].map(w => (
                            <div key={w.id}
                              onClick={() => assignAgent(acc.id, w.id)}
                              style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}
                              onMouseOver={e => e.currentTarget.style.background = '#f0fdf4'}
                              onMouseOut={e => e.currentTarget.style.background = '#fff'}>
                              <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{w.name}</span>
                              <span style={{ fontSize: 11, color: '#6b7280' }}>{w.phone || w.email}</span>
                              <span style={{ fontSize: 11, color: '#25D366', fontWeight: 600, flexShrink: 0 }}>
                                {assigning[`${acc.id}-${w.id}`] ? '...' : '+ Assign'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
