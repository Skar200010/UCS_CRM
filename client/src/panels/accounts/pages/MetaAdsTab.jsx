import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '../api/auth';
import { API_BASE } from '../../../lib/apiBase';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

const NGOS = ['BSCT', 'AFLF', 'MANN'];
const NETWORKS = { BSCT: 'SS-BSCT', AFLF: 'SS-AFLF', MANN: 'SS-MANN' };

const n = (v) => Number(v) || 0;
const num = (v) => n(v).toLocaleString('en-IN');
const money = (v) => `₹${n(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const pct = (v) => `${n(v).toFixed(2)}%`;
const rate = (a, b) => (n(b) > 0 ? n(a) / n(b) : 0);

const safeGet = (path, fallback) => apiGet(path).catch(() => fallback);

// Editable credential fields. Verify token is deliberately absent: it stays in
// .env because it is a value we publish into Meta's dashboard.
const CONFIG_FIELDS = [
  {
    key: 'META_ADS_ACCESS_TOKEN',
    label: 'Access token',
    secret: true,
    required: true,
    hint: 'System user token with leads_retrieval. Starts with EAA… — not the CAPI dataset token.',
  },
  {
    key: 'META_ADS_APP_SECRET',
    label: 'App secret',
    secret: true,
    required: true,
    hint: 'Meta App → App settings → Basic → App secret.',
  },
  {
    key: 'META_ADS_APP_ID',
    label: 'App ID',
    advanced: true,
    hint: 'Only used to tell which app is installed on the Page.',
  },
  {
    key: 'META_ADS_AD_ACCOUNT_ID',
    label: 'Ad account id',
    advanced: true,
    hint: 'Only for spend and campaign insights. Lead capture works without it.',
  },
  {
    key: 'META_ADS_PAGE_ID',
    label: 'Page id',
    advanced: true,
    hint: 'Needed by "Subscribe Page" when Page discovery is unavailable.',
  },
  {
    key: 'META_ADS_API_VERSION',
    label: 'API version',
    advanced: true,
    hint: 'Leave v23.0 unless Meta requires another version.',
  },
];

const SOURCE_LABEL = {
  database: 'saved',
  env: '.env',
  whatsapp_fallback: 'WhatsApp fallback',
  missing: 'not set',
};

function sourceTone(info) {
  if (!info) return { color: '#5B6070', bg: '#eef1f7' };
  if (info.source === 'database' || info.source === 'env') return { color: '#0B6B3A', bg: '#dcfce7' };
  if (info.source === 'whatsapp_fallback') {
    // A WhatsApp token/app secret is a real value but the wrong one for lead
    // retrieval, so it must not look like a success.
    return info.key === 'META_ADS_APP_ID' || info.key === 'META_ADS_API_VERSION'
      ? { color: '#5B6070', bg: '#eef1f7' }
      : { color: '#b45309', bg: '#fef3c7' };
  }
  return { color: '#b91c1c', bg: '#fef2f2' };
}

function ConfigField({ field, info, value, onChange }) {
  const tone = sourceTone(info);
  const placeholder = info?.masked || info?.value || '';
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: '#1C1E21' }}>
        {field.label}
        {field.required && <span style={{ color: '#b91c1c' }}>*</span>}
        <span style={{
          marginLeft: 'auto', fontSize: 9.5, fontWeight: 800, letterSpacing: 0.2,
          color: tone.color, background: tone.bg, padding: '2px 7px', borderRadius: 999,
          textTransform: 'uppercase', whiteSpace: 'nowrap',
        }}>
          {SOURCE_LABEL[info?.source] || 'unknown'}
        </span>
      </span>
      <input
        className="wa-input"
        type={field.secret ? 'password' : 'text'}
        autoComplete="off"
        placeholder={placeholder}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '8px 10px',
          border: '1px solid #D7DBE5', borderRadius: 8, fontSize: 12.5,
          background: '#fff', color: '#1C1E21', fontFamily: 'inherit',
        }}
      />
      <span style={{ fontSize: 10.5, color: '#5B6070', lineHeight: 1.35 }}>{field.hint}</span>
    </label>
  );
}

function Card({ title, value, sub, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 3px rgba(20,30,60,.10)', borderTop: `3px solid ${color || '#0866FF'}` }}>
      <div style={{ fontSize: 11.5, color: '#5B6070', fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#1C1E21', marginTop: 4 }}>{value}</div>
      {sub !== undefined && <div style={{ fontSize: 11, color: '#5B6070', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function BarRow({ label, value, max, color, caption }) {
  const width = max > 0 ? Math.max(2, Math.round((n(value) / max) * 100)) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: '#5B6070', fontWeight: 600 }}>{label}</span>
        <span style={{ color: '#1C1E21', fontWeight: 800 }}>{caption ?? num(value)}</span>
      </div>
      <div style={{ height: 8, background: '#eef1f7', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${width}%`, background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}

const INTEREST_LABEL = {
  make_a_donation: 'Donation',
  'csr_/_corporate_partnership': 'CSR / Corporate',
  learn_more_about_our_ngo: 'NGO info',
};

const prettyInterest = (value) => String(value || '')
  .split(',')
  .map((part) => part.trim())
  .filter(Boolean)
  .map((part) => INTEREST_LABEL[part] || part.replace(/_/g, ' ').replace(/\s+/g, ' ').trim())
  .join(' · ');

const prettyDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';
};

const PLATFORM_STYLE = {
  fb: { label: 'Facebook', color: '#0866FF', bg: '#eff4ff' },
  ig: { label: 'Instagram', color: '#be185d', bg: '#fdf2f8' },
};

export default function MetaAdsTab() {
  const [days, setDays] = useState(30);
  const [status, setStatus] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [summary, setSummary] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [forms, setForms] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [webhookPages, setWebhookPages] = useState([]);
  const [webhookEvents, setWebhookEvents] = useState([]);
  const [metaConfig, setMetaConfig] = useState(null);
  const [configDraft, setConfigDraft] = useState({});
  const [savingConfig, setSavingConfig] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [leadRows, setLeadRows] = useState([]);
  const [leadTotal, setLeadTotal] = useState(0);
  const [leadFilters, setLeadFilters] = useState({ days: 30, platform: '', form_id: '', q: '' });
  const [leadQuery, setLeadQuery] = useState('');
  const [leadLoading, setLeadLoading] = useState(false);
  const [showWebhookLog, setShowWebhookLog] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [adAccounts, setAdAccounts] = useState([]);
  const [findingAccounts, setFindingAccounts] = useState(false);
  const [showConnection, setShowConnection] = useState(false);
  const [newForm, setNewForm] = useState({ form_id: '', ngo: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [st, cm, sm, fn, fm, wp, mc] = await Promise.all([
        safeGet('/meta-ads/status', null),
        safeGet(`/meta-ads/campaigns?days=${days}`, []),
        safeGet(`/meta-ads/insights/summary?days=${days}`, null),
        safeGet(`/meta-ads/funnel?days=${days}`, null),
        safeGet('/meta-ads/forms', []),
        safeGet('/meta-ads/webhook/pages', { pages: [] }),
        safeGet('/meta-ads/config', null),
      ]);
      setStatus(st);
      setCampaigns(Array.isArray(cm) ? cm : []);
      setSummary(sm);
      setFunnel(fn);
      setForms(Array.isArray(fm) ? fm : []);
      setWebhookPages(Array.isArray(wp?.pages) ? wp.pages : []);
      setMetaConfig(mc);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const f of Array.isArray(fm) ? fm : []) {
          next[f.form_id] = {
            ngo: f.ngo || '',
            active: f.active !== false,
            form_name: f.form_name || '',
            page_id: f.page_id || '',
          };
        }
        return next;
      });
    } catch (e) {
      setError(e?.message || 'Could not load Meta Ads');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const loadLeads = useCallback(async () => {
    setLeadLoading(true);
    try {
      const params = new URLSearchParams({ days: String(leadFilters.days), limit: '200' });
      if (leadFilters.platform) params.set('platform', leadFilters.platform);
      if (leadFilters.form_id) params.set('form_id', leadFilters.form_id);
      if (leadFilters.q) params.set('q', leadFilters.q);
      const res = await safeGet(`/meta-ads/leads?${params.toString()}`, { rows: [], total: 0 });
      setLeadRows(Array.isArray(res?.rows) ? res.rows : []);
      setLeadTotal(Number(res?.total) || 0);
    } finally {
      setLeadLoading(false);
    }
  }, [leadFilters]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  // The delivery log is a diagnostic, not the main view: it loads on demand and
  // hides duplicate rows unless the operator asks for them.
  const loadWebhookEvents = useCallback(async () => {
    const suffix = showDuplicates ? '&include_duplicates=1' : '';
    const rows = await safeGet(`/meta-ads/webhook/events?limit=10${suffix}`, []);
    setWebhookEvents(Array.isArray(rows) ? rows : []);
  }, [showDuplicates]);

  useEffect(() => { loadWebhookEvents(); }, [loadWebhookEvents]);

  const totals = summary?.totals || {};
  const series = useMemo(() => (Array.isArray(summary?.series) ? summary.series : []).map((r) => ({
    date: String(r.date || '').slice(5),
    spend: n(r.spend),
    meta_leads: n(r.meta_leads),
    crm_leads: n(r.crm_leads),
  })), [summary]);

  const runAction = async (label, path, body = {}) => {
    if (busy) return;
    setBusy(label);
    setError('');
    setNotice('');
    try {
      const res = await apiPost(path, body);
      if (label === 'leads') {
        setNotice(`Lead sync: ${res.ingested || 0} new, ${res.duplicates || 0} already present, ${res.failed || 0} failed.`);
      } else if (label === 'insights') {
        setNotice(`Insights synced for ${res.synced || 0} campaign-day rows.`);
      } else {
        setNotice('Done');
      }
      await load();
      await loadLeads();
    } catch (e) {
      setError(e?.message || 'Action failed');
    } finally {
      setBusy('');
    }
  };

  const saveForm = async (form) => {
    const draft = drafts[form.form_id] || {};
    setBusy(`form:${form.form_id}`);
    setError('');
    setNotice('');
    try {
      const res = await apiPost('/meta-ads/forms', {
        form_id: form.form_id,
        form_name: draft.form_name ?? form.form_name,
        page_id: draft.page_id ?? form.page_id,
        ngo: draft.ngo || '',
        active: draft.active !== false,
      });
      setNotice(`Saved ${form.form_name || form.form_id}${res.remapped ? ` — updated ${res.remapped} lead(s)` : ''}.`);
      const fresh = await safeGet('/meta-ads/forms', []);
      setForms(Array.isArray(fresh) ? fresh : []);
      const st = await safeGet('/meta-ads/status', null);
      if (st) setStatus(st);
    } catch (e) {
      setError(e?.message || 'Could not save form');
    } finally {
      setBusy('');
    }
  };

  const addForm = async () => {
    const formId = newForm.form_id.trim();
    if (!formId || busy) return;
    setBusy('form:new');
    setError('');
    setNotice('');
    try {
      const res = await apiPost('/meta-ads/forms', {
        form_id: formId,
        ngo: newForm.ngo || '',
        active: true,
      });
      setNotice(`Mapped ${formId}${res.remapped ? ` — updated ${res.remapped} lead(s)` : ''}.`);
      setNewForm({ form_id: '', ngo: '' });
      await load();
    } catch (e) {
      setError(e?.message || 'Could not map form');
    } finally {
      setBusy('');
    }
  };

  const saveConfig = async () => {
    const payload = {};
    for (const [key, value] of Object.entries(configDraft)) {
      if (String(value || '').trim()) payload[key] = String(value).trim();
    }
    if (!Object.keys(payload).length) {
      setError('Enter at least one value — an empty form is not saved.');
      return;
    }
    setSavingConfig(true);
    setError('');
    setNotice('');
    try {
      const res = await apiPost('/meta-ads/config', payload);
      setMetaConfig(res.config || null);
      setConfigDraft({});
      setNotice(res.verification?.ok
        ? `Saved. Token verified as ${res.verification.name || res.verification.id}.`
        : 'Saved. Polling and the webhook now use this credential.');
      await load();
    } catch (e) {
      setError(e?.message || 'Could not save Meta credentials');
    } finally {
      setSavingConfig(false);
    }
  };

  const subscribeWebhook = async () => {
    if (busy) return;
    setBusy('webhook');
    setError('');
    setNotice('');
    try {
      const res = await apiPost('/meta-ads/webhook/subscribe', {});
      const failed = Array.isArray(res.results) ? res.results.filter((r) => !r.ok) : [];
      if (res.subscribed) {
        setNotice(`Page subscribed to leadgen (${res.subscribed}/${res.attempted}). Meta will now deliver leads directly.`);
      } else {
        setError('No Page could be subscribed. Enter the Page id manually (META_ADS_PAGE_ID) or check the token\'s pages_manage_metadata permission.');
      }
      if (failed.length) {
        setError(failed.map((f) => `Page ${f.page_id}: ${f.error}`).join(' · '));
      }
      await load();
    } catch (e) {
      setError(e?.message || 'Could not subscribe the Page');
    } finally {
      setBusy('');
    }
  };

  const autoMapForms = async () => {
    if (busy) return;
    setBusy('auto-map');
    setError('');
    setNotice('');
    try {
      const res = await apiPost('/meta-ads/forms/auto-map', {});
      setNotice(`Auto-mapped ${res.mapped || 0} form(s); ${res.leads_updated || 0} lead(s) tagged. Fallback: ${res.fallback}.`);
      await load();
      await loadLeads();
    } catch (e) {
      setError(e?.message || 'Auto-map failed');
    } finally {
      setBusy('');
    }
  };

  const findAdAccounts = async () => {
    setFindingAccounts(true);
    setError('');
    setNotice('');
    try {
      const list = await apiGet('/meta-ads/ad-accounts');
      const rows = Array.isArray(list) ? list : [];
      setAdAccounts(rows);
      if (!rows.length) {
        setError('This token cannot see any ad account. Assign one to the system user in Business Settings, then retry.');
      } else if (rows.length === 1) {
        const only = rows[0];
        setConfigDraft((prev) => ({ ...prev, META_ADS_AD_ACCOUNT_ID: only.account_id || only.id }));
        setNotice(`Found ${only.name || only.id}. Press Save connection to use it.`);
      } else {
        setNotice(`Found ${rows.length} ad accounts. Choose one below, then save.`);
      }
    } catch (e) {
      setError(e?.message || 'Could not list ad accounts');
    } finally {
      setFindingAccounts(false);
    }
  };

  const exportLeadsCsv = () => {
    if (!leadRows.length) return;
    const escape = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const header = ['created_time', 'name', 'phone', 'email', 'platform', 'state', 'interest', 'form', 'campaign', 'ngo', 'inbox_url', 'lead_id'];
    const lines = [header.join(',')];
    for (const r of leadRows) {
      lines.push([
        r.created_at, r.name, r.phone, r.email, r.platform, r.state || '', r.interest || '',
        r.form_name || r.form_id, r.campaign_name || r.campaign_id, r.ngo || '', r.inbox_url || '', r.id,
      ].map(escape).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meta-leads-${leadFilters.days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const header = ['Campaign', 'Status', 'Spend', 'Impressions', 'Clicks', 'Meta leads', 'CRM leads', 'CTR %', 'CPC', 'CPL'];
    const rows = campaigns.map((c) => [
      c.campaign_name || c.name || c.campaign_id,
      c.status || '',
      n(c.spend),
      n(c.impressions),
      n(c.clicks),
      n(c.meta_leads),
      n(c.crm_leads),
      n(c.ctr).toFixed(2),
      n(c.cpc).toFixed(2),
      n(c.cpl).toFixed(2),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meta-ads-campaigns-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const configured = Boolean(status?.configured);
  const insightsReady = Boolean(status?.insights);
  const connectionOpen = showConnection || !configured;
  const leadStats = useMemo(() => {
    const todayKey = new Date().toDateString();
    let today = 0;
    let facebook = 0;
    let instagram = 0;
    for (const lead of leadRows) {
      const created = lead.created_at ? new Date(lead.created_at) : null;
      if (created && created.toDateString() === todayKey) today += 1;
      if (lead.platform === 'fb') facebook += 1;
      else if (lead.platform === 'ig') instagram += 1;
    }
    return { total: leadRows.length, today, facebook, instagram };
  }, [leadRows]);
  const hasAccount = Boolean(status?.checks?.ad_account);
  const webhook = status?.webhook || {};
  const callbackUrl = `${API_BASE}/webhooks/meta`;
  const webhookChecks = [
    ['Access token', webhook.access_token],
    ['App secret', webhook.app_secret],
    ['Verify token', webhook.verify_token],
    ['Signature enforced', webhook.signature_enforced],
  ];
  const eventColor = (s) => ({
    ingested: '#0B6B3A', processing: '#1e40af', unmapped: '#b45309', duplicate: '#5B6070', error: '#b91c1c',
  }[String(s || '')] || '#5B6070');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 1px 3px rgba(20,30,60,.10)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1C1E21' }}>Meta Ads — Lead Ads performance</div>
            <div style={{ fontSize: 12, color: '#5B6070', marginTop: 2 }}>
              {status?.message || 'Checking Meta connection…'}
              {status?.ad_account_id ? ` · act_${status.ad_account_id}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="wa-select" style={{ width: 110 }}>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button className="wa-btn wa-btn-outline" onClick={load} disabled={loading || !!busy}>Refresh</button>
            <button className="wa-btn wa-btn-outline" onClick={() => runAction('leads', '/meta-ads/leads/sync', { sinceDays: 7 })} disabled={!!busy || !status?.lead_capture}>
              {busy === 'leads' ? 'Syncing…' : 'Sync leads now'}
            </button>
            <button className="wa-btn wa-btn-primary" onClick={() => runAction('insights', '/meta-ads/insights/sync', { days })} disabled={!!busy || !hasAccount}>
              {busy === 'insights' ? 'Syncing…' : 'Sync insights'}
            </button>
            <button className="wa-btn wa-btn-outline" onClick={exportCsv} disabled={!campaigns.length}>Export CSV</button>
          </div>
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); if (!savingConfig && !busy) saveConfig(); }}
        style={{ background: '#fff', borderRadius: 16, padding: 18, boxShadow: '0 1px 3px rgba(20,30,60,.10)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#1C1E21' }}>Meta connection</div>
            <div style={{ fontSize: 11.5, color: '#5B6070', marginTop: 3 }}>
              Only two values are required. They are stored in the database (like WhatsApp accounts), so no restart and no .env edit.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="wa-btn wa-btn-outline"
              onClick={() => setShowConnection((v) => !v)}
            >
              {showConnection ? 'Hide' : 'Edit'}
            </button>
            <button type="submit" className="wa-btn wa-btn-primary" disabled={savingConfig || !!busy}>
              {savingConfig ? 'Saving…' : 'Save connection'}
            </button>
          </div>
        </div>

        {connectionOpen && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginTop: 14 }}>
              {CONFIG_FIELDS.filter((f) => !f.advanced).map((field) => (
                <ConfigField
                  key={field.key}
                  field={field}
                  info={metaConfig?.fields?.[field.key.toLowerCase()]}
                  value={configDraft[field.key]}
                  onChange={(v) => setConfigDraft((prev) => ({ ...prev, [field.key]: v }))}
                />
              ))}
            </div>

        <div style={{ borderTop: '1px solid #EBEDF3', marginTop: 14, paddingTop: 10 }}>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 11.5, fontWeight: 700, color: '#0866FF' }}
          >
            {showAdvanced ? '− Hide optional settings' : '+ Optional settings (ad account, page id, API version)'}
          </button>

          {showAdvanced && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                {CONFIG_FIELDS.filter((f) => f.advanced).map((field) => (
                  <ConfigField
                    key={field.key}
                    field={field}
                    info={metaConfig?.fields?.[field.key.toLowerCase()]}
                    value={configDraft[field.key]}
                    onChange={(v) => setConfigDraft((prev) => ({ ...prev, [field.key]: v }))}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
                <button
                  type="button"
                  className="wa-btn wa-btn-outline"
                  onClick={findAdAccounts}
                  disabled={findingAccounts || !status?.lead_capture}
                >
                  {findingAccounts ? 'Searching…' : 'Find ad accounts'}
                </button>
                {adAccounts.length > 1 && (
                  <select
                    className="wa-select"
                    style={{ minWidth: 240 }}
                    value={configDraft.META_ADS_AD_ACCOUNT_ID || ''}
                    onChange={(e) => setConfigDraft((prev) => ({ ...prev, META_ADS_AD_ACCOUNT_ID: e.target.value }))}
                  >
                    <option value="">Choose ad account…</option>
                    {adAccounts.map((account) => (
                      <option key={account.id} value={account.account_id || account.id}>
                        {account.name || account.id} ({account.account_id || account.id})
                      </option>
                    ))}
                  </select>
                )}
                <span style={{ fontSize: 10.5, color: '#5B6070' }}>
                  Needs the ad account assigned to the system user in Business Settings.
                </span>
              </div>
            </div>
          )}
        </div>

        <div style={{
          marginTop: 12, padding: '8px 10px', borderRadius: 8,
          background: metaConfig?.verify_token_in_env ? '#f4f6fb' : '#fef2f2',
          fontSize: 11, color: metaConfig?.verify_token_in_env ? '#5B6070' : '#b91c1c',
        }}>
          Verify token is read from <code>.env</code> only
          {' '}({metaConfig?.verify_token_in_env ? 'currently set ✓' : 'missing ✗'}) — it is the value you paste into Meta's webhook form.
        </div>
          </>
        )}
      </form>

      {!configured && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: 14, fontSize: 12.5, color: '#9a3412' }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Meta Ads is not connected yet</div>
          Save an <b>access token</b> and <b>app secret</b> in Meta connection. Then point Meta's Page webhook to
          {' '}<code>/api/webhooks/meta</code> and press <b>Subscribe Page</b>. Form mapping works even before that.
        </div>
      )}

      {status?.lead_capture && !hasAccount && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 12, fontSize: 12.5, color: '#1e40af' }}>
          Add an ad account id under <b>Optional settings</b> to load spend and campaign insights. Lead capture works without it.
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 10, padding: '9px 13px', fontSize: 12.5, fontWeight: 600 }}>{error}</div>
      )}
      {notice && (
        <div style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#15803d', borderRadius: 10, padding: '9px 13px', fontSize: 12.5, fontWeight: 600 }}>{notice}</div>
      )}

      <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 1px 3px rgba(20,30,60,.10)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#1C1E21' }}>Webhook — instant leads</div>
            <div style={{ fontSize: 11.5, color: '#5B6070', marginTop: 2 }}>
              Meta posts lead notifications to this URL. The 5-minute polling job stays on as a backup.
            </div>
          </div>
          <button className="wa-btn wa-btn-primary" onClick={subscribeWebhook} disabled={!!busy || !status?.lead_capture}>
            {busy === 'webhook' ? 'Subscribing…' : 'Subscribe Page'}
          </button>
        </div>

        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {webhookChecks.map(([label, ok]) => (
            <span key={label} style={{
              fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
              background: ok ? '#dcfce7' : '#fef2f2',
              color: ok ? '#15803d' : '#b91c1c',
              border: `1px solid ${ok ? '#86efac' : '#fecaca'}`,
            }}>
              {ok ? '✓' : '✗'} {label}
            </span>
          ))}
        </div>

        <div style={{ marginTop: 10, fontSize: 11, color: '#5B6070' }}>Callback URL</div>
        <code style={{ display: 'block', marginTop: 2, padding: '6px 8px', background: '#f4f6fb', borderRadius: 8, fontSize: 11.5, overflowX: 'auto' }}>{callbackUrl}</code>

        {webhookPages.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {webhookPages.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11.5, padding: '6px 8px', border: '1px solid #EBEDF3', borderRadius: 8 }}>
                <span style={{ fontWeight: 700, color: '#1C1E21' }}>
                  {p.name} <span style={{ color: '#5B6070', fontWeight: 500 }}>· {p.id}</span>
                </span>
                <span style={{ fontWeight: 700, color: p.subscribed === null ? '#5B6070' : p.leadgen ? '#0B6B3A' : p.subscribed ? '#b45309' : '#b91c1c' }}>
                  {p.subscribed === null ? 'unknown' : p.leadgen ? 'leadgen subscribed' : p.subscribed ? 'subscribed (leadgen OFF)' : 'not subscribed'}
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#5B6070' }}>
            Deliveries: {num(status?.webhook?.counts?.ingested)} ingested · {num(status?.webhook?.counts?.unmapped)} unmapped · {num(status?.webhook?.counts?.error)} errors
            {status?.webhook?.counts?.duplicate ? ` · ${num(status.webhook.counts.duplicate)} duplicates hidden` : ''}
          </span>
          <button
            type="button"
            onClick={() => setShowWebhookLog((v) => !v)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 11.5, fontWeight: 700, color: '#0866FF' }}
          >
            {showWebhookLog ? '− Hide delivery log' : '+ Show delivery log'}
          </button>
        </div>

        {showWebhookLog && (
          <div style={{ marginTop: 8, overflowX: 'auto' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#5B6070', marginBottom: 6 }}>
              <input type="checkbox" checked={showDuplicates} onChange={(e) => setShowDuplicates(e.target.checked)} />
              include duplicates
            </label>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead>
                <tr style={{ background: '#f4f6fb' }}>
                  {['Lead id', 'Status', 'Platform', 'Form', 'Received'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 10, textTransform: 'uppercase', color: '#5B6070' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {webhookEvents.map((e) => (
                  <tr key={e.meta_lead_id} style={{ borderTop: '1px solid #EBEDF3' }}>
                    <td style={{ padding: '6px 8px', color: '#5B6070' }}>{e.meta_lead_id}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 700, color: eventColor(e.status) }} title={e.error || ''}>
                      {e.status}{e.error ? ' ⓘ' : ''}
                    </td>
                    <td style={{ padding: '6px 8px' }}>{e.platform || '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{e.form_id || '—'}</td>
                    <td style={{ padding: '6px 8px', color: '#5B6070' }}>
                      {e.received_at ? new Date(e.received_at).toLocaleString('en-IN') : '—'}
                    </td>
                  </tr>
                ))}
                {!webhookEvents.length && (
                  <tr><td colSpan={5} style={{ padding: 14, textAlign: 'center', color: '#5B6070' }}>No deliveries logged yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        {insightsReady ? (
          <>
            <Card title="Spend" value={money(totals.spend)} sub={`last ${days} days`} color="#0866FF" />
            <Card title="Meta leads" value={num(totals.meta_leads)} sub="reported by Meta" color="#7B5CFA" />
            <Card title="CRM leads" value={num(totals.crm_leads)} sub="matched to a campaign" color="#0B6B3A" />
            <Card title="Cost per lead" value={money(totals.cpl)} sub="spend ÷ Meta leads" color="#F97316" />
            <Card title="CTR" value={pct(totals.ctr)} sub={`${num(totals.clicks)} clicks`} color="#0891b2" />
            <Card title="CPC" value={money(totals.cpc)} sub={`${num(totals.impressions)} impressions`} color="#be185d" />
          </>
        ) : (
          <>
            <Card title="Leads captured" value={num(leadStats.total)} sub={`last ${leadFilters.days} days`} color="#0B6B3A" />
            <Card title="Today" value={num(leadStats.today)} sub="received today" color="#0866FF" />
            <Card title="Facebook" value={num(leadStats.facebook)} sub="platform split" color="#0866FF" />
            <Card title="Instagram" value={num(leadStats.instagram)} sub="platform split" color="#be185d" />
            <Card title="Forms mapped" value={`${num(status?.counts?.mapped_forms)} / ${num(status?.counts?.forms)}`} sub="mapped to an NGO" color="#7B5CFA" />
            <Card title="Unmapped leads" value={num(leadRows.filter((lead) => !lead.ngo).length)} sub="need a form mapping" color="#F97316" />
          </>
        )}
      </div>

      <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 1px 3px rgba(20,30,60,.10)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#1C1E21' }}>Meta campaign leads</div>
            <div style={{ fontSize: 11.5, color: '#5B6070', marginTop: 2 }}>
              {leadTotal} lead(s) · {leadLoading ? 'loading…' : 'latest first'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="wa-btn wa-btn-outline" onClick={loadLeads} disabled={leadLoading}>Refresh</button>
            <button className="wa-btn wa-btn-outline" onClick={exportLeadsCsv} disabled={!leadRows.length}>Export CSV</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '12px 0' }}>
          <select
            className="wa-select"
            style={{ width: 120 }}
            value={leadFilters.days}
            onChange={(e) => setLeadFilters((prev) => ({ ...prev, days: Number(e.target.value) }))}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <select
            className="wa-select"
            style={{ width: 140 }}
            value={leadFilters.platform}
            onChange={(e) => setLeadFilters((prev) => ({ ...prev, platform: e.target.value }))}
          >
            <option value="">All platforms</option>
            <option value="fb">Facebook</option>
            <option value="ig">Instagram</option>
          </select>
          <select
            className="wa-select"
            style={{ width: 220 }}
            value={leadFilters.form_id}
            onChange={(e) => setLeadFilters((prev) => ({ ...prev, form_id: e.target.value }))}
          >
            <option value="">All forms</option>
            {forms.map((form) => (
              <option key={form.form_id} value={form.form_id}>{form.form_name || form.form_id}</option>
            ))}
          </select>
          <input
            className="wa-input"
            style={{ flex: '1 1 200px', minWidth: 160 }}
            placeholder="Search name, phone or email"
            value={leadQuery}
            onChange={(e) => setLeadQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setLeadFilters((prev) => ({ ...prev, q: leadQuery.trim() }));
            }}
          />
          <button
            className="wa-btn wa-btn-primary"
            onClick={() => setLeadFilters((prev) => ({ ...prev, q: leadQuery.trim() }))}
          >
            Search
          </button>
        </div>

        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 480, border: '1px solid #EBEDF3', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1020, fontSize: 12 }}>
            <colgroup>
              <col style={{ width: 110 }} />
              <col style={{ width: 190 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 190 }} />
              <col style={{ width: 105 }} />
              <col style={{ width: 210 }} />
              <col style={{ width: 210 }} />
              <col style={{ width: 95 }} />
              <col style={{ width: 70 }} />
            </colgroup>
            <thead>
              <tr style={{ background: '#f4f6fb' }}>
                {['Date', 'Name', 'Platform', 'Contact', 'State', 'Interest', 'Form / Campaign', 'NGO', 'Inbox'].map((heading) => (
                  <th key={heading} style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f4f6fb', textAlign: 'left', padding: '9px 10px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, color: '#5B6070', borderBottom: '1px solid #E3E7F0' }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leadRows.map((lead, index) => {
                const platform = PLATFORM_STYLE[lead.platform] || { label: lead.platform || '—', color: '#5B6070', bg: '#eef1f7' };
                return (
                  <tr key={lead.id} style={{ borderTop: index === 0 ? 'none' : '1px solid #EBEDF3', background: index % 2 ? '#fafbfe' : '#fff' }}>
                    <td style={{ padding: '9px 10px', color: '#5B6070', whiteSpace: 'nowrap' }}>{prettyDate(lead.created_at)}</td>
                    <td style={{ padding: '9px 10px', fontWeight: 700, color: '#1C1E21', maxWidth: 200 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lead.name}>{lead.name || '(no name)'}</div>
                      {lead.is_organic && <span style={{ fontSize: 9.5, fontWeight: 800, color: '#0B6B3A' }}>ORGANIC</span>}
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: platform.color, background: platform.bg, padding: '2px 7px', borderRadius: 999 }}>
                        {platform.label}
                      </span>
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      {lead.phone
                        ? <a href={`tel:${lead.phone}`} style={{ display: 'block', color: '#0866FF', fontWeight: 600 }}>{lead.phone}</a>
                        : <span style={{ color: '#5B6070' }}>—</span>}
                      {lead.email ? (
                        <a href={`mailto:${lead.email}`} style={{ display: 'block', fontSize: 10.5, color: '#5B6070', maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {lead.email}
                        </a>
                      ) : null}
                    </td>
                    <td style={{ padding: '9px 10px' }}>{lead.state || '—'}</td>
                    <td style={{ padding: '9px 10px', maxWidth: 220 }}>{prettyInterest(lead.interest) || '—'}</td>
                    <td style={{ padding: '9px 10px', color: '#5B6070', maxWidth: 220 }}>
                      <div style={{ fontWeight: 600, color: '#1C1E21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lead.form_name || lead.form_id}>
                        {lead.form_name || lead.form_id || '—'}
                      </div>
                      <div style={{ fontSize: 10.5 }}>
                        {lead.campaign_name || (lead.campaign_id ? `Campaign ${lead.campaign_id}` : '')}
                      </div>
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      {lead.ngo
                        ? <span style={{ fontSize: 10.5, fontWeight: 800, color: '#0B6B3A', background: '#dcfce7', padding: '2px 7px', borderRadius: 999 }}>{lead.ngo}</span>
                        : <span style={{ fontSize: 10.5, fontWeight: 700, color: '#b45309' }}>unmapped</span>}
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      {lead.inbox_url
                        ? <a href={lead.inbox_url} target="_blank" rel="noreferrer" style={{ color: '#0866FF', fontWeight: 600 }}>Open</a>
                        : <span style={{ color: '#5B6070' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
              {!leadRows.length && (
                <tr>
                  <td colSpan={9} style={{ padding: 20, textAlign: 'center', color: '#5B6070' }}>
                    {leadLoading ? 'Loading leads…' : 'No Meta leads in this range yet. Press "Sync leads now" above.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', gap: 14 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 1px 3px rgba(20,30,60,.10)' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#1C1E21', marginBottom: 10 }}>Daily spend vs leads</div>
          {series.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: '#5B6070', fontSize: 12.5 }}>
              No cached insights yet. Press <b>Sync insights</b> (Meta reports numbers with a 24–48h lag).
            </div>
          ) : (
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <ComposedChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef1f7" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="spend" name="Spend" fill="#0866FF" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="meta_leads" name="Meta leads" stroke="#0B6B3A" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="crm_leads" name="CRM leads" stroke="#F97316" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 1px 3px rgba(20,30,60,.10)' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#1C1E21', marginBottom: 12 }}>Lead funnel</div>
          <BarRow label="Impressions" value={funnel?.impressions} max={funnel?.impressions} color="#0866FF" />
          <BarRow label="Clicks" value={funnel?.clicks} max={funnel?.impressions} color="#7B5CFA" />
          <BarRow label="Meta leads" value={funnel?.meta_leads} max={funnel?.impressions} color="#0B6B3A" />
          <BarRow label="CRM leads" value={funnel?.crm_leads} max={funnel?.impressions} color="#F97316" />
          <BarRow label="Placed in SS station" value={funnel?.placed_leads} max={funnel?.impressions} color="#be185d" />
          <div style={{ fontSize: 11, color: '#5B6070', marginTop: 8 }}>
            Click-to-lead {pct(rate(funnel?.meta_leads, funnel?.clicks) * 100)} · CRM capture {pct(rate(funnel?.crm_leads, funnel?.meta_leads) * 100)}
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 1px 3px rgba(20,30,60,.10)', overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#1C1E21' }}>Campaign performance</div>
          <div style={{ fontSize: 11.5, color: '#5B6070' }}>{campaigns.length} campaign(s)</div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780, fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f4f6fb' }}>
              {['Campaign', 'Status', 'Spend', 'Impr.', 'Clicks', 'Meta leads', 'CRM leads', 'CPL', 'CTR'].map((h) => (
                <th key={h} style={{ textAlign: h === 'Campaign' ? 'left' : 'right', padding: '8px 10px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: .3, color: '#5B6070' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.campaign_id || c.id} style={{ borderTop: '1px solid #EBEDF3' }}>
                <td style={{ padding: '9px 10px', fontWeight: 700, color: '#1C1E21', maxWidth: 300 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.campaign_name || c.name || c.campaign_id}</div>
                  <div style={{ fontSize: 10.5, color: '#5B6070', fontWeight: 500 }}>{c.objective || c.campaign_id}</div>
                </td>
                <td style={{ padding: '9px 10px', textAlign: 'right', textTransform: 'capitalize', color: '#5B6070' }}>{String(c.status || '—').toLowerCase()}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700 }}>{money(c.spend)}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right' }}>{num(c.impressions)}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right' }}>{num(c.clicks)}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: '#7B5CFA' }}>{num(c.meta_leads)}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: '#0B6B3A' }}>{num(c.crm_leads)}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right' }}>{money(c.cpl)}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right' }}>{pct(c.ctr)}</td>
              </tr>
            ))}
            {campaigns.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 16, textAlign: 'center', color: '#5B6070' }}>No campaigns cached yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 1px 3px rgba(20,30,60,.10)', overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#1C1E21' }}>Lead form → NGO mapping</div>
            <div style={{ fontSize: 11.5, color: '#5B6070', marginTop: 2 }}>A lead from a mapped form lands in the WA Reply inbox with its [Account:] tag and an SS station suggestion.</div>
          </div>
          <button className="wa-btn wa-btn-outline" onClick={async () => {
            setBusy('form:refresh');
            try {
              const fresh = await apiGet('/meta-ads/forms?refresh=1');
              setForms(Array.isArray(fresh) ? fresh : []);
              setNotice('Form list refreshed from Meta.');
            } catch (e) {
              setError(e?.message || 'Could not refresh forms');
            } finally {
              setBusy('');
            }
          }} disabled={!!busy || !status?.lead_capture}>
            {busy === 'form:refresh' ? 'Refreshing…' : 'Fetch forms from Meta'}
          </button>
          <button className="wa-btn wa-btn-primary" onClick={autoMapForms} disabled={!!busy || !status?.lead_capture}>
            {busy === 'auto-map' ? 'Mapping…' : 'Auto-map forms'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '10px 0 12px' }}>
          <input className="wa-input" style={{ flex: '1 1 220px', minWidth: 180 }}
            placeholder="Meta form id (when discovery is unavailable)"
            value={newForm.form_id}
            onChange={(e) => setNewForm((p) => ({ ...p, form_id: e.target.value }))} />
          <select className="wa-select" style={{ width: 170 }}
            value={newForm.ngo}
            onChange={(e) => setNewForm((p) => ({ ...p, ngo: e.target.value }))}>
            <option value="">Choose NGO</option>
            {NGOS.map((ngo) => <option key={ngo} value={ngo}>{ngo} → {NETWORKS[ngo]}</option>)}
          </select>
          <button className="wa-btn wa-btn-primary" onClick={addForm}
            disabled={!!busy || !newForm.form_id.trim()}>
            {busy === 'form:new' ? 'Mapping…' : 'Map form'}
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680, fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f4f6fb' }}>
              {['Form', 'Form ID', 'NGO', 'Active', ''].map((h) => (
                <th key={h} style={{ textAlign: h === '' ? 'right' : 'left', padding: '8px 10px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: .3, color: '#5B6070' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {forms.map((f) => {
              const draft = drafts[f.form_id] || {};
              return (
                <tr key={f.form_id} style={{ borderTop: '1px solid #EBEDF3' }}>
                  <td style={{ padding: '9px 10px', fontWeight: 700, color: '#1C1E21' }}>{f.form_name || '(unnamed form)'}</td>
                  <td style={{ padding: '9px 10px', color: '#5B6070', fontSize: 11 }}>{f.form_id}</td>
                  <td style={{ padding: '9px 10px' }}>
                    <select className="wa-select" style={{ width: 150 }}
                      value={draft.ngo || ''}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [f.form_id]: { ...(prev[f.form_id] || {}), ngo: e.target.value } }))}>
                      <option value="">Unmapped</option>
                      {NGOS.map((ngo) => <option key={ngo} value={ngo}>{ngo} → {NETWORKS[ngo]}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '9px 10px' }}>
                    <input type="checkbox"
                      checked={draft.active !== false}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [f.form_id]: { ...(prev[f.form_id] || {}), active: e.target.checked } }))} />
                  </td>
                  <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                    <button className="wa-btn wa-btn-primary" onClick={() => saveForm(f)} disabled={!!busy}>
                      {busy === `form:${f.form_id}` ? 'Saving…' : 'Save'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {forms.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 16, textAlign: 'center', color: '#5B6070' }}>
                No forms discovered. Connect the ad account, press <b>Fetch forms from Meta</b>, then map each form to an NGO.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
