import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../api/auth';

export default function EmailAccountsManager({ onAccountsChange }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', app_password: '' });

  async function load() {
    setLoading(true);
    try {
      const data = await apiGet('/accounts/email-import/accounts');
      setAccounts(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ name: '', email: '', app_password: '' });
    setEditing(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.name || !form.email || (!form.app_password && !editing)) {
      alert('Name, email, and app password are required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const body = { name: form.name, email: form.email };
        if (form.app_password) body.app_password = form.app_password;
        await apiPut(`/accounts/email-import/accounts/${editing.id}`, body);
      } else {
        await apiPost('/accounts/email-import/accounts', form);
      }
      resetForm();
      await load();
      if (onAccountsChange) onAccountsChange();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete account "${name}"?`)) return;
    try {
      await apiDelete(`/accounts/email-import/accounts/${id}`);
      await load();
      if (onAccountsChange) onAccountsChange();
    } catch (err) { alert(err.message); }
  };

  const openEdit = (acc) => {
    setForm({ name: acc.name, email: acc.email, app_password: '' });
    setEditing(acc);
    setShowForm(true);
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="filter-bar" style={{ marginBottom: showForm || accounts.length > 0 ? 12 : 0 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>Email Accounts</span>
        <button className="btn btn-sm" onClick={() => { resetForm(); setShowForm(!showForm); }}
          style={{ marginLeft: 'auto', background: 'var(--sage)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {showForm ? 'Cancel' : 'Add Account'}
        </button>
      </div>

      {showForm && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', padding: '10px 0', borderBottom: accounts.length > 0 ? '1px solid var(--line)' : 'none', marginBottom: accounts.length > 0 ? 10 : 0 }}>
          <label className="field" style={{ flex: '1 1 160px', marginBottom: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Name</span>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. GPay Receipts" style={{ marginTop: 2, fontSize: 12, padding: '5px 8px' }} />
          </label>
          <label className="field" style={{ flex: '1 1 200px', marginBottom: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Email</span>
            <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="e.g. payments.ufs@gmail.com" style={{ marginTop: 2, fontSize: 12, padding: '5px 8px' }} />
          </label>
          <label className="field" style={{ flex: '1 1 180px', marginBottom: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>App Password</span>
            <input type="password" value={form.app_password} onChange={e => setForm(p => ({ ...p, app_password: e.target.value }))} placeholder={editing ? 'Leave blank to keep' : '16-char app password'} style={{ marginTop: 2, fontSize: 12, padding: '5px 8px' }} />
          </label>
          <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '6px 14px', marginBottom: 0 }}>
            {saving ? 'Saving...' : editing ? 'Update' : 'Add'}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 12, fontSize: 13, color: '#6b7280' }}>Loading...</div>
      ) : accounts.length === 0 ? (
        <div style={{ padding: 12, fontSize: 13, color: '#6b7280' }}>No accounts yet. Add an email account above.</div>
      ) : (
        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
          {accounts.map(acc => (
            <div key={acc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: acc.is_active ? '#059669' : '#d1d5db', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{acc.name}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{acc.email}</div>
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                {acc.last_polled_at ? new Date(acc.last_polled_at).toLocaleDateString('en-IN') : 'Never polled'}
              </div>
              <button className="btn btn-sm" onClick={() => openEdit(acc)} style={{ fontSize: 11, padding: '2px 7px' }}>Edit</button>
              <button className="btn btn-sm" onClick={() => handleDelete(acc.id, acc.name)} style={{ fontSize: 11, padding: '2px 7px', color: '#dc2626' }}>Del</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
