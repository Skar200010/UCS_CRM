import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../api/auth';

function SkeletonTableRows({ rows, cols }) {
  return Array.from({ length: rows }, (_, i) => (
    <tr key={i}>
      {Array.from({ length: cols }, (_, j) => (
        <td key={j}>
          <div style={{ height: 12, width: j < 2 ? 160 : 80, borderRadius: 4, background: 'linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%)', backgroundSize: '200% 100%', animation: 'sk-shimmer 1.4s infinite' }}>&nbsp;</div>
        </td>
      ))}
    </tr>
  ));
}

const currency = n => n != null ? '\u20B9' + Number(n).toLocaleString('en-IN') : '\u20B90';

const emptyForm = { name: '', key_id: '', key_secret: '', webhook_secret: '', is_active: true, is_default: false };

function RazorpayAccountsManager({ onAccountsChange }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    setLoading(true);
    try {
      const data = await apiGet('/webhooks/razorpay/accounts');
      setAccounts(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.name || !form.key_id || (!form.key_secret && !editing) || (!form.webhook_secret && !editing)) {
      alert('Name, Key ID, Key Secret, and Webhook Secret are required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const body = {
          name: form.name,
          key_id: form.key_id,
          is_active: form.is_active,
          is_default: form.is_default,
        };
        if (form.key_secret) body.key_secret = form.key_secret;
        if (form.webhook_secret) body.webhook_secret = form.webhook_secret;
        await apiPut(`/webhooks/razorpay/accounts/${editing.id}`, body);
      } else {
        await apiPost('/webhooks/razorpay/accounts', form);
      }
      resetForm();
      await load();
      if (onAccountsChange) onAccountsChange();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete Razorpay account "${name}"? Webhook events for this account will stop being accepted.`)) return;
    try {
      await apiDelete(`/webhooks/razorpay/accounts/${id}`);
      await load();
      if (onAccountsChange) onAccountsChange();
    } catch (err) { alert(err.message); }
  };

  const openEdit = (acc) => {
    setForm({
      name: acc.name,
      key_id: acc.key_id,
      key_secret: '',
      webhook_secret: '',
      is_active: acc.is_active,
      is_default: acc.is_default,
    });
    setEditing(acc);
    setShowForm(true);
  };

  const handleSync = async (id) => {
    setSyncingId(id);
    try {
      const result = await apiPost(`/webhooks/razorpay/accounts/${id}/sync`);
      alert(result.message || 'Sync completed');
      await load();
    } catch (err) { alert(err.message); }
    finally { setSyncingId(null); }
  };

  const copyWebhookUrl = async (acc) => {
    const url = `${window.location.origin}/api/webhooks/razorpay/${acc.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(acc.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      prompt('Copy this URL:', url);
    }
  };

  const toggleField = (field) => setForm(p => ({ ...p, [field]: !p[field] }));

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="filter-bar" style={{ marginBottom: showForm || accounts.length > 0 ? 12 : 0 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>Razorpay Accounts</span>
        <button className="btn btn-sm" onClick={() => { resetForm(); setShowForm(!showForm); }}
          style={{ marginLeft: 'auto', background: 'var(--sage)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {showForm ? 'Cancel' : 'Add Account'}
        </button>
      </div>

      {showForm && (
        <div style={{ padding: '10px 0', borderBottom: accounts.length > 0 ? '1px solid var(--line)' : 'none', marginBottom: accounts.length > 0 ? 10 : 0 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="field" style={{ flex: '1 1 160px', marginBottom: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Name</span>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. UFS Donations" style={{ marginTop: 2, fontSize: 12, padding: '5px 8px' }} />
            </label>
            <label className="field" style={{ flex: '1 1 200px', marginBottom: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Key ID</span>
              <input value={form.key_id} onChange={e => setForm(p => ({ ...p, key_id: e.target.value }))} placeholder="rzp_live_..." style={{ marginTop: 2, fontSize: 12, padding: '5px 8px' }} />
            </label>
            <label className="field" style={{ flex: '1 1 180px', marginBottom: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Key Secret</span>
              <input type="password" value={form.key_secret} onChange={e => setForm(p => ({ ...p, key_secret: e.target.value }))} placeholder={editing ? 'Leave blank to keep' : 'Key secret'} style={{ marginTop: 2, fontSize: 12, padding: '5px 8px' }} />
            </label>
            <label className="field" style={{ flex: '1 1 180px', marginBottom: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Webhook Secret</span>
              <input type="password" value={form.webhook_secret} onChange={e => setForm(p => ({ ...p, webhook_secret: e.target.value }))} placeholder={editing ? 'Leave blank to keep' : 'Webhook secret'} style={{ marginTop: 2, fontSize: 12, padding: '5px 8px' }} />
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
              Leave secret fields blank to keep the existing values.
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 12, fontSize: 13, color: '#6b7280' }}>Loading...</div>
      ) : accounts.length === 0 ? (
        <div style={{ padding: 12, fontSize: 13, color: '#6b7280' }}>
          No Razorpay accounts yet. Add one above to get a per-account webhook URL. Until then, the <code>.env</code> fallback is used.
        </div>
      ) : (
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {accounts.map(acc => (
            <div key={acc.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: acc.is_active ? '#059669' : '#d1d5db', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{acc.name}</span>
                    {acc.is_default && (
                      <span className="pill" style={{ background: '#5B6B4E20', color: '#5B6B4E', fontSize: 10, padding: '1px 6px' }}>Default</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{acc.key_id}</div>
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                  {acc.last_synced_at ? `Synced ${new Date(acc.last_synced_at).toLocaleString('en-IN')}` : 'Never synced'}
                </div>
                <button className="btn btn-sm" onClick={() => handleSync(acc.id)} disabled={syncingId === acc.id}
                  style={{ fontSize: 11, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  {syncingId === acc.id ? 'Syncing...' : 'Sync'}
                </button>
                <button className="btn btn-sm" onClick={() => openEdit(acc)} style={{ fontSize: 11, padding: '2px 7px' }}>Edit</button>
                <button className="btn btn-sm" onClick={() => handleDelete(acc.id, acc.name)} style={{ fontSize: 11, padding: '2px 7px', color: '#dc2626' }}>Del</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, paddingLeft: 16 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.3 }}>Webhook URL:</span>
                <code style={{ fontSize: 11, color: '#0d9488', background: '#0d948810', padding: '2px 6px', borderRadius: 4, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {window.location.origin}/api/webhooks/razorpay/{acc.id}
                </code>
                <button className="btn btn-sm" onClick={() => copyWebhookUrl(acc)} style={{ fontSize: 10, padding: '2px 7px', display: 'flex', alignItems: 'center', gap: 3 }}>
                  {copiedId === acc.id ? (
                    <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg> Copied</>
                  ) : (
                    <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PaymentGateways() {
  const [log, setLog] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filterGateway, setFilterGateway] = useState('');

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterGateway) params.set('gateway', filterGateway);
      const [logRes, statusRes] = await Promise.allSettled([
        apiGet('/webhooks/log?' + params.toString()),
        apiGet('/webhooks/status'),
      ]);
      if (logRes.status === 'fulfilled') setLog(logRes.value || []);
      if (statusRes.status === 'fulfilled') setCounts(statusRes.value.counts || {});
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadData(); }, [filterGateway]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await apiPost('/webhooks/razorpay/sync');
      alert(result.message || 'Sync completed');
      await loadData();
    } catch (err) { alert(err.message); }
    finally { setSyncing(false); }
  };

  const razorpayCount = (counts['razorpay_processed'] || 0) + (counts['razorpay_received'] || 0);
  const paytmCount = (counts['paytm_processed'] || 0) + (counts['paytm_received'] || 0);
  const razorpayFailed = counts['razorpay_failed'] || 0;
  const paytmFailed = counts['paytm_failed'] || 0;

  return (
    <div>
      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card" style={{ gridColumn: '1 / -1', border: '2px solid #5B6B4E', background: 'linear-gradient(135deg, #5B6B4E08 0%, #5B6B4E18 100%)', padding: '18px 22px' }}>
          <div className="stat-icon" style={{ background: '#5B6B4E20', color: '#5B6B4E', width: 48, height: 48, borderRadius: 14 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </div>
          <div className="stat-info">
            <div className="stat-num" style={{ fontSize: 22, fontWeight: 800, color: '#5B6B4E' }}>Payment Gateways</div>
            <div className="stat-lbl" style={{ fontSize: 13, fontWeight: 600, color: '#5B6B4E', opacity: 0.7 }}>
              Manage multiple Razorpay accounts &amp; auto-import payments into Bank Audit
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#0d948818', color: '#0d9488' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div className="stat-info">
            <div className="stat-num">{razorpayCount}</div>
            <div className="stat-lbl">Razorpay Payments</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#2563eb18', color: '#2563eb' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div className="stat-info">
            <div className="stat-num">{paytmCount}</div>
            <div className="stat-lbl">Paytm Payments</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#dc262618', color: '#dc2626' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <div className="stat-info">
            <div className="stat-num">{razorpayFailed + paytmFailed}</div>
            <div className="stat-lbl">Failed</div>
          </div>
        </div>
      </div>

      <RazorpayAccountsManager onAccountsChange={loadData} />

      <div className="card">
        <div className="filter-bar" style={{ flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Webhook Log</span>
          <select value={filterGateway} onChange={e => setFilterGateway(e.target.value)}
            style={{ fontSize: 12, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--line)', marginLeft: 8 }}>
            <option value="">All Gateways</option>
            <option value="razorpay">Razorpay</option>
            <option value="paytm">Paytm</option>
          </select>
          <button className="btn btn-sm" onClick={() => loadData()} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.4-3.4L23 10M1 14l5.1 4.4A9 9 0 0 0 20.5 15"/></svg>
            Refresh
          </button>
          <button className="btn btn-sm" onClick={handleSync} disabled={syncing}
            style={{ marginLeft: 'auto', background: 'var(--sage)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            {syncing ? 'Syncing...' : 'Sync Default'}
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Gateway</th>
                <th>Account</th>
                <th>Event</th>
                <th>Amount</th>
                <th>Payment ID</th>
                <th>Order ID</th>
                <th>Source</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonTableRows rows={5} cols={9} />
              ) : log.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>No webhook events yet</td></tr>
              ) : (
                log.map(e => {
                  const isNegative = e.amount != null && Number(e.amount) < 0;
                  const statusColor = e.status === 'processed' ? 'pill-green'
                    : e.status === 'failed' ? 'pill-red'
                    : e.status === 'dispute' ? 'pill-red'
                    : e.status === 'unhandled' ? 'pill-red'
                    : 'pill-gray';
                  return (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{e.created_at ? new Date(e.created_at).toLocaleDateString('en-IN') : '\u2014'}</td>
                    <td><span className="pill" style={{ background: e.gateway === 'razorpay' ? '#0d948818' : '#2563eb18', color: e.gateway === 'razorpay' ? '#0d9488' : '#2563eb', fontSize: 11 }}>{e.gateway}</span></td>
                    <td style={{ fontSize: 11 }}>{e.account_name || '\u2014'}</td>
                    <td style={{ fontSize: 11 }}>{e.event_type || '\u2014'}</td>
                    <td style={{ fontSize: 12, fontWeight: 600, color: isNegative ? '#dc2626' : 'var(--sage)' }}>{e.amount ? currency(e.amount) : '\u2014'}</td>
                    <td style={{ fontSize: 11 }}>{e.payment_id || '\u2014'}</td>
                    <td style={{ fontSize: 11 }}>{e.order_id || '\u2014'}</td>
                    <td style={{ fontSize: 11 }}>{e.gateway_source || '\u2014'}</td>
                    <td>
                      <span className={`pill ${statusColor}`} style={{ fontSize: 11 }}>
                        {e.status}
                      </span>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
