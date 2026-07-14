import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../api/auth';

const PROJECT_OPTIONS = [
  { value: 'bsct', label: 'Being Sevak' },
  { value: 'maan', label: 'Mann Care' },
  { value: 'aflf', label: 'Ashray' },
];

const emptyForm = {
  name: '', project: 'bsct', phone_number_id: '', access_token: '',
  waba_id: '', template_name: '', template_language: 'en',
  is_active: true, is_default: false,
};

export default function WhatsAppAccountsManager({ onAccountsChange }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [fetchingTemplates, setFetchingTemplates] = useState(null);
  const [templateOptions, setTemplateOptions] = useState({});
  const [agents, setAgents] = useState({});
  const [showAgents, setShowAgents] = useState({});
  const [agentSearch, setAgentSearch] = useState({});
  const [agentResults, setAgentResults] = useState({});
  const [assigning, setAssigning] = useState({});
  const searchTimer = useRef({});

  async function loadAccounts() {
    setLoading(true);
    try {
      const data = await apiGet('/whatsapp/accounts');
      setAccounts(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadAccounts(); }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.name || !form.phone_number_id || !form.access_token || !form.waba_id) {
      alert('Name, Phone Number ID, Access Token, and WABA ID are required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const body = {
          name: form.name,
          project: form.project,
          phone_number_id: form.phone_number_id,
          waba_id: form.waba_id,
          template_name: form.template_name || null,
          template_language: form.template_language,
          is_active: form.is_active,
          is_default: form.is_default,
        };
        if (form.access_token) body.access_token = form.access_token;
        await apiPut(`/whatsapp/accounts/${editing.id}`, body);
        resetForm();
      } else {
        await apiPost('/whatsapp/accounts', form);
        resetForm();
      }
      await loadAccounts();
      if (onAccountsChange) onAccountsChange();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete WhatsApp account "${name}"? This cannot be undone.`)) return;
    try {
      await apiDelete(`/whatsapp/accounts/${id}`);
      await loadAccounts();
      if (onAccountsChange) onAccountsChange();
    } catch (err) { alert(err.message); }
  };

  const openEdit = (acc) => {
    setForm({
      name: acc.name,
      project: acc.project,
      phone_number_id: acc.phone_number_id,
      access_token: '',
      waba_id: acc.waba_id,
      template_name: acc.template_name || '',
      template_language: acc.template_language || 'en',
      is_active: acc.is_active,
      is_default: acc.is_default,
    });
    setEditing(acc);
    setShowForm(true);
  };

  const fetchTemplates = async (account) => {
    setFetchingTemplates(account.id);
    try {
      const list = await apiGet(`/whatsapp/templates?accountId=${account.id}`);
      setTemplateOptions(prev => ({ ...prev, [account.id]: list }));
      if (list.length === 0) {
        alert('No approved templates found for this WABA.');
      }
    } catch (err) { alert(err.message); }
    finally { setFetchingTemplates(null); }
  };

  const setAccountTemplate = async (account, templateName) => {
    try {
      await apiPut(`/whatsapp/accounts/${account.id}`, { template_name: templateName || null });
      setForm(prev => ({ ...prev, template_name: templateName }));
      await loadAccounts();
    } catch (err) { alert(err.message); }
  };

  const toggleField = (field) => setForm(p => ({ ...p, [field]: !p[field] }));

  const loadAgents = async (accountId) => {
    try {
      const data = await apiGet(`/whatsapp/accounts/${accountId}/agents`);
      setAgents(prev => ({ ...prev, [accountId]: data || [] }));
    } catch (err) { console.error(err); }
  };

  const toggleAgents = (accountId) => {
    const opening = !showAgents[accountId];
    setShowAgents(prev => ({ ...prev, [accountId]: opening }));
    if (opening && !agents[accountId]) loadAgents(accountId);
  };

  const handleAgentSearch = (accountId, query) => {
    setAgentSearch(prev => ({ ...prev, [accountId]: query }));
    if (searchTimer.current[accountId]) clearTimeout(searchTimer.current[accountId]);
    if (query.length < 2) { setAgentResults(prev => ({ ...prev, [accountId]: [] })); return; }
    searchTimer.current[accountId] = setTimeout(async () => {
      try {
        const data = await apiGet(`/whatsapp/accounts/agents/search?q=${encodeURIComponent(query)}`);
        setAgentResults(prev => ({ ...prev, [accountId]: data || [] }));
      } catch { setAgentResults(prev => ({ ...prev, [accountId]: [] })); }
    }, 300);
  };

  const assignAgent = async (accountId, froWorkerId) => {
    setAssigning(prev => ({ ...prev, [accountId]: true }));
    try {
      await apiPost(`/whatsapp/accounts/${accountId}/agents`, { froWorkerId });
      setAgentSearch(prev => ({ ...prev, [accountId]: '' }));
      setAgentResults(prev => ({ ...prev, [accountId]: [] }));
      await loadAgents(accountId);
    } catch (err) { alert(err.message); }
    finally { setAssigning(prev => ({ ...prev, [accountId]: false })); }
  };

  const removeAgent = async (accountId, froId, name) => {
    if (!confirm(`Remove agent "${name}" from this account?`)) return;
    try {
      await apiDelete(`/whatsapp/accounts/${accountId}/agents/${froId}`);
      await loadAgents(accountId);
    } catch (err) { alert(err.message); }
  };

  return (
    <div>
      <div className="filter-bar" style={{ marginBottom: showForm || accounts.length > 0 ? 12 : 0 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>WhatsApp Accounts</span>
        <button className="btn btn-sm" onClick={() => { resetForm(); setShowForm(!showForm); }}
          style={{ marginLeft: 'auto', background: 'var(--sage)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {showForm ? 'Cancel' : 'Add Account'}
        </button>
      </div>

      {showForm && (
        <div style={{ padding: '10px 0', borderBottom: accounts.length > 0 ? '1px solid var(--line)' : 'none', marginBottom: accounts.length > 0 ? 10 : 0 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="field" style={{ flex: '1 1 130px', marginBottom: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Name</span>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Being Sevak" style={{ marginTop: 2, fontSize: 12, padding: '5px 8px' }} />
            </label>
            <label className="field" style={{ flex: '1 1 100px', marginBottom: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Project</span>
              <select value={form.project} onChange={e => setForm(p => ({ ...p, project: e.target.value }))} style={{ marginTop: 2, fontSize: 12, padding: '5px 8px' }}>
                {PROJECT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="field" style={{ flex: '1 1 140px', marginBottom: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Phone Number ID</span>
              <input value={form.phone_number_id} onChange={e => setForm(p => ({ ...p, phone_number_id: e.target.value }))} placeholder="Meta phone ID" style={{ marginTop: 2, fontSize: 12, padding: '5px 8px' }} />
            </label>
            <label className="field" style={{ flex: '1 1 140px', marginBottom: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Access Token</span>
              <input type="text" value={form.access_token} onChange={e => setForm(p => ({ ...p, access_token: e.target.value }))} placeholder={editing ? 'Leave blank to keep' : 'Meta token'} style={{ marginTop: 2, fontSize: 12, padding: '5px 8px' }} />
            </label>
            <label className="field" style={{ flex: '1 1 130px', marginBottom: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>WABA ID</span>
              <input value={form.waba_id} onChange={e => setForm(p => ({ ...p, waba_id: e.target.value }))} placeholder="WABA ID" style={{ marginTop: 2, fontSize: 12, padding: '5px 8px' }} />
            </label>
            <label className="field" style={{ flex: '1 1 100px', marginBottom: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Template Language</span>
              <input value={form.template_language} onChange={e => setForm(p => ({ ...p, template_language: e.target.value }))} placeholder="en" style={{ marginTop: 2, fontSize: 12, padding: '5px 8px' }} />
            </label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_active} onChange={() => toggleField('is_active')} /> Active
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_default} onChange={() => toggleField('is_default')} /> Default
              </label>
            </div>
            <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '6px 14px', marginBottom: 0 }}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Add'}
            </button>
          </div>
          {editing && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
              Leave Access Token blank to keep the existing value.
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 12, fontSize: 13, color: '#6b7280' }}>Loading...</div>
      ) : accounts.length === 0 ? (
        <div style={{ padding: 12, fontSize: 13, color: '#6b7280' }}>
          No WhatsApp accounts yet. Add one above, or the system will auto-create one from the environment variables if configured.
        </div>
      ) : (
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {accounts.map(acc => {
            const templates = templateOptions[acc.id];
            return (
              <div key={acc.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: acc.is_active ? '#059669' : '#d1d5db', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{acc.name}</span>
                      <span className="pill" style={{ background: '#5B6B4E20', color: '#5B6B4E', fontSize: 10, padding: '1px 6px' }}>{acc.project}</span>
                      {acc.is_default && (
                        <span className="pill" style={{ background: '#0d948818', color: '#0d9488', fontSize: 10, padding: '1px 6px' }}>Default</span>
                      )}
                      {acc.template_name ? (
                        <span className="pill" style={{ background: '#25D36620', color: '#1d6f42', fontSize: 10, padding: '1px 6px' }}>{acc.template_name}</span>
                      ) : (
                        <span className="pill pill-red" style={{ fontSize: 10, padding: '1px 6px' }}>N/A</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>
                      Phone: {acc.phone_number_id} &middot; WABA: {acc.waba_id}
                    </div>
                  </div>
                  <button className="btn btn-sm" onClick={() => fetchTemplates(acc)} disabled={fetchingTemplates === acc.id}
                    style={{ fontSize: 11, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                    {fetchingTemplates === acc.id ? 'Loading...' : 'Templates'}
                  </button>
                  <button className="btn btn-sm" onClick={() => openEdit(acc)} style={{ fontSize: 11, padding: '2px 7px' }}>Edit</button>
                  <button className="btn btn-sm" onClick={() => handleDelete(acc.id, acc.name)} style={{ fontSize: 11, padding: '2px 7px', color: '#dc2626' }}>Del</button>
                </div>
                {templates && templates.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, paddingLeft: 16 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Template:</span>
                    <select
                      value={acc.template_name || ''}
                      onChange={e => setAccountTemplate(acc, e.target.value)}
                      style={{ fontSize: 11, padding: '2px 6px', maxWidth: 200 }}
                    >
                      <option value="">N/A</option>
                      {templates.map(t => (
                        <option key={t.name} value={t.name}>{t.name} ({t.language})</option>
                      ))}
                    </select>
                  </div>
                )}
                <div style={{ marginTop: 6, paddingLeft: 16 }}>
                  <button className="btn btn-sm" onClick={() => toggleAgents(acc.id)}
                    style={{ fontSize: 10, padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    Agents {agents[acc.id] ? `(${agents[acc.id].length})` : ''}
                  </button>
                  {showAgents[acc.id] && (
                    <div style={{ marginTop: 6, padding: '8px 10px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                      {agents[acc.id] && agents[acc.id].length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          {agents[acc.id].map(agent => {
                            const w = agent.workers || {};
                            const agentName = w.name || w.email || 'Unknown';
                            return (
                              <div key={agent.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                                <span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>{agentName}</span>
                                <span style={{ fontSize: 10, color: '#6b7280' }}>{w.phone || w.email || ''}</span>
                                <button className="btn btn-sm" onClick={() => removeAgent(acc.id, agent.fro_worker_id, agentName)}
                                  style={{ fontSize: 10, padding: '1px 6px', color: '#dc2626' }}>Remove</button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="text"
                          value={agentSearch[acc.id] || ''}
                          onChange={e => handleAgentSearch(acc.id, e.target.value)}
                          placeholder="Search worker by name, email, or phone..."
                          style={{ flex: 1, fontSize: 11, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
                        />
                      </div>
                      {agentResults[acc.id] && agentResults[acc.id].length > 0 && (
                        <div style={{ marginTop: 4, border: '1px solid #e5e7eb', borderRadius: 4, maxHeight: 150, overflowY: 'auto', background: '#fff' }}>
                          {agentResults[acc.id].map(w => {
                            const workerName = w.name || w.email || 'Unknown';
                            return (
                              <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                                onMouseOver={e => e.currentTarget.style.background = '#f0fdf4'}
                                onMouseOut={e => e.currentTarget.style.background = '#fff'}
                                onClick={() => assignAgent(acc.id, w.id)}>
                                <span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>{workerName}</span>
                                <span style={{ fontSize: 10, color: '#6b7280' }}>{w.phone || w.email || ''}</span>
                                <span style={{ fontSize: 10, color: '#25D366' }}>+ Assign</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
