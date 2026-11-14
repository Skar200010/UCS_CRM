import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  History,
  LayoutTemplate,
  Mail,
  Paperclip,
  PenLine,
  RefreshCw,
  Send,
  Users,
  X,
} from 'lucide-react';
import { apiDelete, apiGet, apiGetBlob, apiPost, apiPut } from '../api/auth';
import EmailBuilder from '../components/email-builder/EmailBuilder';
import './bulkEmail.css';

const SOURCES = [
  { value: 'donors', label: 'Donors' },
  { value: 'beneficiaries', label: 'Beneficiaries' },
  { value: 'all', label: 'Donors + Beneficiaries' },
  { value: 'manual', label: 'Manual emails' },
];

const SOURCE_LABEL = Object.fromEntries(SOURCES.map((s) => [s.value, s.label]));

const TERMINAL_STATUSES = new Set(['completed', 'partial', 'failed', 'cancelled', 'interrupted']);
const STATUS_LABEL = {
  queued: 'Queued',
  processing: 'Sending',
  completed: 'Completed',
  partial: 'Partially sent',
  failed: 'Failed',
  cancelled: 'Cancelled',
  interrupted: 'Interrupted',
};

const TABS = [
  { id: 'bulk', label: 'Bulk Message', Icon: Send },
  { id: 'history', label: 'History', Icon: History },
  { id: 'templates', label: 'Templates', Icon: LayoutTemplate },
  { id: 'builder', label: 'Email Builder', Icon: PenLine },
];

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function parseManualEmails(value) {
  const found = String(value || '').match(EMAIL_RE) || [];
  const seen = new Set();
  const out = [];
  for (const raw of found) {
    const email = raw.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({ email, name: null });
  }
  return out;
}

function initialsFor(value) {
  const text = String(value || '').trim();
  if (!text) return '?';
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return text.slice(0, 2).toUpperCase();
}

export default function BulkEmail() {
  const [source, setSource] = useState('donors');
  const [search, setSearch] = useState('');
  const [manualText, setManualText] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaError, setMediaError] = useState(null);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateError, setTemplateError] = useState(null);
  const [activeTab, setActiveTab] = useState('bulk');
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [templateForm, setTemplateForm] = useState({ name: '', subject: '', body: '' });
  const [builderTemplateId, setBuilderTemplateId] = useState(null);
  const [htmlBody, setHtmlBody] = useState('');
  const pollTimer = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleExcelUpload = async (file) => {
    if (!file) return;
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
      if (!rows.length) throw new Error('No data rows found in the Excel file.');
      const emails = [];
      for (const row of rows) {
        let email = '';
        for (const [key, value] of Object.entries(row || {})) {
          const k = String(key || '').toLowerCase();
          const v = String(value || '').trim();
          if (!email && (k.includes('email') || /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(v))) {
            email = v;
          }
        }
        if (email) emails.push(email);
      }
      if (!emails.length) throw new Error('No email addresses found in the Excel file.');
      const unique = [...new Set(emails.map((e) => e.toLowerCase()))];
      setSource('manual');
      setManualText((prev) => {
        const existing = prev ? prev.trim() : '';
        const next = unique.join('\n');
        return existing ? `${existing}\n${next}` : next;
      });
    } catch (e) {
      setError(e?.message || 'Could not read the Excel file.');
    }
  };

  const manualRecipients = useMemo(() => parseManualEmails(manualText), [manualText]);

  const htmlPreview = useMemo(() => {
    if (!htmlBody) return '';
    return htmlBody
      .replace(/\{\{\s*name\s*\}\}/gi, 'Sample Donor')
      .replace(/\{\{\s*email\s*\}\}/gi, 'donor@example.com');
  }, [htmlBody]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    setLogsError(null);
    try {
      const data = await apiGet('/accounts/bulk-email/logs?limit=25');
      setLogs(Array.isArray(data?.logs) ? data.logs : []);
    } catch (e) {
      setLogsError(e?.message || 'Could not load send history.');
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplateError(null);
    try {
      const data = await apiGet('/accounts/bulk-email/templates');
      setTemplates(Array.isArray(data?.templates) ? data.templates : []);
    } catch (e) {
      setTemplateError(e?.message || 'Could not load templates.');
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);
  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const applyCampaignLog = useCallback((log) => {
    setProgress((prev) => ({
      ...prev,
      status: log.status,
      total: log.total_recipients || 0,
      sent: log.sent_count || 0,
      failed: log.failed_count || 0,
      processed: log.processed_count || 0,
    }));
  }, []);

  const pollCampaign = useCallback((id) => {
    stopPolling();
    const tick = async () => {
      try {
        const data = await apiGet(`/accounts/bulk-email/logs/${id}`);
        applyCampaignLog(data);
        if (TERMINAL_STATUSES.has(data.status)) {
          setResult({
            sent: data.sent_count || 0,
            total: data.total_recipients || 0,
            failed: data.failed_count || 0,
            skipped: 0,
            status: data.status,
            log_id: data.id,
            results: (data.recipients || []).map((r) => ({
              email: r.email,
              ok: r.ok === true ? true : r.ok === false ? false : null,
              error: r.error || null,
            })),
          });
          setSending(false);
          await loadLogs();
          return;
        }
      } catch (e) {
        setError(e?.message || 'Could not load campaign progress.');
        setSending(false);
        return;
      }
      pollTimer.current = setTimeout(tick, 3000);
    };
    tick();
  }, [applyCampaignLog, loadLogs, stopPolling]);

  useEffect(() => () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
  }, [mediaPreview]);

  useEffect(() => {
    if (source === 'manual') {
      setRecipients(manualRecipients);
      setSelected(new Set(manualRecipients.map((r) => r.email)));
      setLoading(false);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ source, limit: '500' });
        if (search.trim()) params.set('search', search.trim());
        const data = await apiGet(`/accounts/bulk-email/recipients?${params.toString()}`);
        if (cancelled) return;
        const list = Array.isArray(data?.recipients) ? data.recipients : [];
        setRecipients(list);
        setSelected(new Set(list.map((r) => r.email)));
      } catch (e) {
        if (cancelled) return;
        setRecipients([]);
        setSelected(new Set());
        setError(e?.message || 'Could not load recipients.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [source, search, manualRecipients]);

  const toggle = (email) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(recipients.map((r) => r.email)));
  const clearAll = () => setSelected(new Set());

  const pickMedia = (file) => {
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    if (!isImage && !isVideo && !isPdf) {
      setMediaError('Only image, video, or PDF files are allowed.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setMediaError('Attachment must be 20 MB or smaller.');
      return;
    }
    setMediaError(null);
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaError(null);
  };

  const loadTemplateMedia = async (template) => {
    if (!template?.has_attachment) {
      removeMedia();
      return;
    }
    try {
      const blob = await apiGetBlob(`/accounts/bulk-email/templates/${template.id}/attachment`);
      const file = new File([blob], template.attachment_name || 'attachment', {
        type: template.attachment_type || blob.type || 'application/octet-stream',
      });
      setMediaFile(file);
      setMediaPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      setMediaError(null);
    } catch (e) {
      setMediaError(e?.message || 'Could not load the template attachment.');
    }
  };

  const applyTemplateById = async (id) => {
    setSelectedTemplateId(id);
    const summary = templates.find((t) => String(t.id) === String(id));
    if (!summary) {
      setHtmlBody('');
      return;
    }
    try {
      const template = summary.has_design || summary.has_html
        ? await apiGet(`/accounts/bulk-email/templates/${summary.id}`)
        : summary;
      setSubject(template.subject || '');
      setBody(template.body || '');
      setHtmlBody(template.has_design ? (template.html || '') : '');
      loadTemplateMedia(template);
    } catch (e) {
      setError(e?.message || 'Could not load the template.');
    }
  };

  const applyTemplate = (id) => {
    if (!id) {
      setSelectedTemplateId('');
      setHtmlBody('');
      return;
    }
    applyTemplateById(id);
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) { setTemplateError('Template name is required.'); return; }
    if (!subject.trim() || !body.trim()) { setTemplateError('Write a subject and body before saving a template.'); return; }
    setTemplateSaving(true);
    setTemplateError(null);
    try {
      const form = new FormData();
      form.append('name', templateName.trim());
      form.append('subject', subject.trim());
      form.append('body', body);
      if (mediaFile) form.append('attachment', mediaFile);
      const created = await apiPost('/accounts/bulk-email/templates', form);
      setTemplateName('');
      setShowTemplateForm(false);
      await loadTemplates();
      if (created?.id) setSelectedTemplateId(String(created.id));
    } catch (e) {
      setTemplateError(e?.message || 'Could not save template.');
    } finally {
      setTemplateSaving(false);
    }
  };

  const removeTemplate = async (id) => {
    if (!id) return;
    if (!window.confirm('Delete this template?')) return;
    try {
      await apiDelete(`/accounts/bulk-email/templates/${id}`);
      if (String(selectedTemplateId) === String(id)) {
        setSelectedTemplateId('');
        setHtmlBody('');
      }
      if (String(builderTemplateId) === String(id)) setBuilderTemplateId(null);
      if (String(editingTemplateId) === String(id)) cancelTemplateEdit();
      await loadTemplates();
    } catch (e) {
      setTemplateError(e?.message || 'Could not delete template.');
    }
  };

  const editTemplate = (template) => {
    setEditingTemplateId(template.id);
    setTemplateForm({
      name: template.name || '',
      subject: template.subject || '',
      body: template.body || '',
    });
    setTemplateError(null);
  };

  const cancelTemplateEdit = () => {
    setEditingTemplateId(null);
    setTemplateForm({ name: '', subject: '', body: '' });
    setTemplateError(null);
  };

  const saveTemplateForm = async () => {
    const name = templateForm.name.trim();
    const templateSubject = templateForm.subject.trim();
    const templateBody = templateForm.body;
    if (!name) { setTemplateError('Template name is required.'); return; }
    if (!templateSubject) { setTemplateError('Template subject is required.'); return; }
    if (!templateBody.trim()) { setTemplateError('Template body is required.'); return; }

    setTemplateSaving(true);
    setTemplateError(null);
    try {
      const form = new FormData();
      form.append('name', name);
      form.append('subject', templateSubject);
      form.append('body', templateBody);

      if (editingTemplateId) {
        await apiPut(`/accounts/bulk-email/templates/${editingTemplateId}`, form);
      } else {
        await apiPost('/accounts/bulk-email/templates', form);
      }
      cancelTemplateEdit();
      await loadTemplates();
    } catch (e) {
      setTemplateError(e?.message || 'Could not save template.');
    } finally {
      setTemplateSaving(false);
    }
  };

  const useTemplate = async (template) => {
    setSelectedTemplateId(String(template.id));
    try {
      const full = template.has_design || template.has_html
        ? await apiGet(`/accounts/bulk-email/templates/${template.id}`)
        : template;
      setSubject(full.subject || '');
      setBody(full.body || '');
      setHtmlBody(full.has_design ? (full.html || '') : '');
      loadTemplateMedia(full);
    } catch (e) {
      setError(e?.message || 'Could not load the template.');
    }
    setActiveTab('bulk');
  };

  const openTemplateInBuilder = (template) => {
    setBuilderTemplateId(template ? String(template.id) : null);
    setActiveTab('builder');
  };

  const clearHtmlTemplate = () => {
    setHtmlBody('');
    setSelectedTemplateId('');
  };

  const send = async () => {
    const chosen = recipients.filter((r) => selected.has(r.email));
    if (!subject.trim()) { setError('Subject is required.'); return; }
    if (!body.trim() && !htmlBody) { setError('Message body is required.'); return; }
    if (!chosen.length) { setError('Select at least one recipient.'); return; }

    setSending(true);
    setError(null);
    setResult(null);
    setProgress(null);
    try {
      const form = new FormData();
      form.append('subject', subject.trim());
      form.append('text', body);
      if (htmlBody) form.append('html', htmlBody);
      form.append('source', source);
      form.append('recipients', JSON.stringify(chosen));
      if (mediaFile) form.append('attachment', mediaFile);

      // The server queues the campaign and replies immediately, then sends in
      // the background. Poll its progress instead of holding one long request
      // open (which used to time out after 5 minutes).
      const data = await apiPost('/accounts/bulk-email/send', form, 60000);
      setProgress({
        status: data.status || 'queued',
        total: data.total || chosen.length,
        sent: 0,
        failed: 0,
        processed: 0,
      });
      if (data.skipped > 0) {
        setProgress((prev) => (prev ? { ...prev, skipped: data.skipped } : prev));
      }
      await loadLogs();
      pollCampaign(data.log_id);
    } catch (e) {
      setError(e?.message || 'Could not send the campaign.');
      setSending(false);
    }
  };

  const resumeCampaign = async (id) => {
    setError(null);
    try {
      await apiPost(`/accounts/bulk-email/logs/${id}/resume`, {});
      setActiveTab('bulk');
      setSending(true);
      setResult(null);
      setProgress({ status: 'processing', total: 0, sent: 0, failed: 0, processed: 0 });
      pollCampaign(id);
    } catch (e) {
      setError(e?.message || 'Could not resume the campaign.');
    }
  };

  const cancelCampaign = async (id) => {
    try {
      await apiPost(`/accounts/bulk-email/logs/${id}/cancel`, {});
      await loadLogs();
    } catch (e) {
      setLogsError(e?.message || 'Could not cancel the campaign.');
    }
  };

  const openLog = async (log) => {
    setSelectedLog({ ...log, recipients: [], loading: true });
    try {
      const data = await apiGet(`/accounts/bulk-email/logs/${log.id}`);
      setSelectedLog(data);
    } catch (e) {
      setSelectedLog(null);
      setLogsError(e?.message || 'Could not load this log.');
    }
  };

  const failed = result?.results?.filter((r) => r.ok === false) || [];
  const progressPercent = progress && progress.total
    ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
    : 0;
  const campaignRunning = Boolean(progress) && !TERMINAL_STATUSES.has(progress.status);
  const resultTone = result
    ? (['cancelled', 'failed', 'interrupted', 'partial'].includes(result.status) || failed.length ? 'warn' : 'ok')
    : 'ok';
  const historyStats = useMemo(() => {
    let sent = 0;
    let failedCount = 0;
    for (const log of logs) {
      sent += Number(log.sent_count || 0);
      failedCount += Number(log.failed_count || 0);
    }
    return { campaigns: logs.length, sent, failed: failedCount };
  }, [logs]);

  return (
    <div className="be-page">
      <div className="be-head">
        <div className="be-head-main">
          <span className="be-head-icon" aria-hidden="true">
            <Mail size={22} strokeWidth={1.8} />
          </span>
          <div>
            <h1>Bulk Email</h1>
            <p>Send one message to donors, beneficiaries, or a manual list of email addresses.</p>
          </div>
        </div>
        <span className={`be-head-status${campaignRunning ? ' is-running' : ''}`}>
          <span className="be-head-dot" aria-hidden="true" />
          {campaignRunning ? (STATUS_LABEL[progress?.status] || 'Sending') : 'Ready to send'}
        </span>
      </div>

      <div className="be-tabs" role="tablist" aria-label="Bulk email sections">
        {TABS.map((t) => {
          const Icon = t.Icon;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              className={`be-tab${activeTab === t.id ? ' is-active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              <Icon size={15} strokeWidth={2} aria-hidden="true" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {error && <div className="be-alert">{error}</div>}

      {activeTab === 'bulk' && campaignRunning && (
        <div className="be-progress">
          <div className="be-progress-head">
            <div className="be-progress-title">
              <span className="be-progress-pulse" aria-hidden="true" />
              <strong>{STATUS_LABEL[progress.status] || 'Sending'}…</strong>
            </div>
            <span className="be-progress-pct">{progressPercent}%</span>
          </div>
          <div className="be-progress-track">
            <div className="be-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="be-progress-meta">
            <span className="be-progress-chip">Processed <strong>{progress.processed}</strong> / {progress.total}</span>
            <span className="be-progress-chip be-status-ok">Sent {progress.sent}</span>
            <span className="be-progress-chip be-status-fail">Failed {progress.failed}</span>
            <span className="be-progress-chip">Queued {Math.max(0, progress.total - progress.processed)}</span>
            {progress.skipped > 0 && <span className="be-progress-chip">Skipped {progress.skipped} (unsubscribed)</span>}
          </div>
          <div className="be-progress-note">
            Emails send in batches of 5 with a short pause to stay within Gmail limits.
            This can take a few minutes and keeps running if you leave this page.
          </div>
        </div>
      )}

      {activeTab === 'bulk' && result && (
        <div className={`be-result${resultTone === 'warn' ? ' has-failures' : ''}`}>
          <div className="be-result-main">
            <span className="be-result-icon" aria-hidden="true">
              {resultTone === 'warn' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            </span>
            <div>
              <strong>
                {result.status === 'cancelled'
                  ? 'Campaign cancelled'
                  : result.status === 'interrupted'
                    ? 'Campaign interrupted'
                    : result.status === 'failed'
                      ? 'Campaign failed'
                      : result.status === 'partial'
                        ? 'Campaign finished with some failures'
                        : 'Campaign complete'}
              </strong>
              <span className="be-result-meta">
                Sent {result.sent} of {result.total}. Failed {result.failed}.
                {result.skipped > 0 ? ` Skipped ${result.skipped} unsubscribed.` : ''}
              </span>
            </div>
          </div>
          {failed.length > 0 && (
            <ul>
              {failed.map((r) => (
                <li key={r.email}><strong>{r.email}</strong> - {r.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'bulk' && (
      <div className="be-grid">
        <section className="be-card">
          <div className="be-card-head">
            <span className="be-step" aria-hidden="true">1</span>
            <div className="be-card-head-text">
              <h2>Recipients</h2>
              <p>Pick a source or paste addresses manually.</p>
            </div>
          </div>

          <div className="be-row">
            <label className="be-field" style={{ flex: '1 1 180px', marginBottom: 0 }}>
              <span>Source</span>
              <select className="be-select" value={source} onChange={(e) => setSource(e.target.value)}>
                {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            {source !== 'manual' && (
              <label className="be-field" style={{ flex: '2 1 240px', marginBottom: 0 }}>
                <span>Search</span>
                <input
                  className="be-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, email or phone"
                />
              </label>
            )}
          </div>

          {source === 'manual' && (
            <div className="be-field" style={{ marginTop: 12, marginBottom: 0 }}>
              <span>Email addresses</span>
              <textarea
                className="be-textarea"
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder={'one@example.com\ntwo@example.com'}
              />
              <div className="be-manual-foot">
                <label className="be-upload-inline">
                  <FileSpreadsheet size={15} strokeWidth={2} aria-hidden="true" />
                  Upload Excel / CSV
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    hidden
                    onChange={(e) => { handleExcelUpload(e.target.files?.[0]); e.target.value = ''; }}
                  />
                </label>
                <span className="be-hint-inline">Excel/CSV with an "Email" column.</span>
                <span className={`be-detected-count${manualRecipients.length ? ' has-items' : ''}`}>
                  {manualRecipients.length} detected
                </span>
              </div>
            </div>
          )}

          <div className="be-recipient-head">
            <div className="be-recipient-count">
              <Users size={15} strokeWidth={2} aria-hidden="true" />
              <span>
                {loading ? 'Loading recipients…' : <><strong>{recipients.length}</strong> recipients</>}
              </span>
            </div>
            <div className="be-recipient-actions">
              <span className={`be-selected-chip${selected.size ? ' has-selection' : ''}`}>{selected.size} selected</span>
              <button type="button" className="be-btn-ghost" onClick={selectAll} disabled={!recipients.length}>Select all</button>
              <button type="button" className="be-btn-ghost" onClick={clearAll} disabled={!selected.size}>Clear</button>
            </div>
          </div>

          <div className="be-recipient-list">
            {loading && <div className="be-empty">Loading recipients…</div>}
            {!loading && !recipients.length && (
              <div className="be-empty">
                <Mail size={26} strokeWidth={1.6} aria-hidden="true" />
                <span>No recipients with email addresses found.</span>
              </div>
            )}
            {!loading && recipients.map((r) => (
              <label key={r.email} className={`be-recipient${selected.has(r.email) ? ' is-selected' : ''}`}>
                <input type="checkbox" checked={selected.has(r.email)} onChange={() => toggle(r.email)} />
                <span className="be-recipient-avatar" aria-hidden="true">{initialsFor(r.name || r.email)}</span>
                <span className="be-recipient-text">
                  <span className="be-recipient-name">{r.name || r.email}</span>
                  {r.name ? <span className="be-recipient-email">{r.email}</span> : null}
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="be-card">
          <div className="be-card-head">
            <span className="be-step" aria-hidden="true">2</span>
            <div className="be-card-head-text">
              <h2>Message</h2>
              <p>Write the email and add an optional attachment.</p>
            </div>
          </div>

          <div className="be-template-bar">
            <label className="be-field" style={{ flex: 1, marginBottom: 0 }}>
              <span>Ready-made template</span>
              <select
                className="be-select"
                value={selectedTemplateId}
                onChange={(e) => applyTemplate(e.target.value)}
                disabled={templatesLoading}
              >
                <option value="">{templatesLoading ? 'Loading templates...' : 'Choose a template...'}</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <div className="be-template-actions">
              <button type="button" className="be-link-btn" onClick={() => setShowTemplateForm((v) => !v)}>
                Save current
              </button>
              {selectedTemplateId && (
                <button type="button" className="be-link-btn be-danger-link" onClick={() => removeTemplate(selectedTemplateId)}>
                  Delete
                </button>
              )}
            </div>
          </div>

          {showTemplateForm && (
            <div className="be-template-save">
              <input
                className="be-input"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name"
              />
              <button type="button" className="be-btn-small" onClick={saveTemplate} disabled={templateSaving}>
                {templateSaving ? 'Saving...' : 'Save template'}
              </button>
              <button type="button" className="be-link-btn" onClick={() => { setShowTemplateForm(false); setTemplateName(''); }}>
                Cancel
              </button>
            </div>
          )}

          {templateError && <div className="be-alert">{templateError}</div>}

          <label className="be-field">
            <span>Subject <em className="be-counter">{subject.length} chars</em></span>
            <input
              className="be-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. An update from Being Sevak"
            />
          </label>

          {htmlBody ? (
            <div className="be-html-active">
              <div className="be-html-active-head">
                <span><strong>HTML template selected</strong> — the designed email will be sent.</span>
                <button type="button" className="be-link-btn" onClick={clearHtmlTemplate}>Use plain text</button>
              </div>
              <iframe className="be-html-preview" title="Selected HTML template preview" srcDoc={htmlPreview} sandbox="" />
              <div className="be-hint" style={{ margin: 0, padding: '8px 11px', borderTop: '1px solid var(--line)' }}>
                Plain-text version is generated automatically from this template and sent with the email.
              </div>
            </div>
          ) : (
            <label className="be-field">
              <span>Body</span>
              <textarea
                className="be-textarea is-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message..."
              />
            </label>
          )}

          <div className="be-field">
            <span>Attachment (optional)</span>
            <label className="be-upload">
              <input
                type="file"
                accept="image/*,video/*,application/pdf,.pdf"
                hidden
                onChange={(e) => { pickMedia(e.target.files?.[0]); e.target.value = ''; }}
              />
              <span className="be-upload-plus">+</span>
              <span className="be-upload-text">
                {mediaFile ? 'Replace image, video or PDF' : 'Add image, video or PDF'}
                <small>Max 20 MB</small>
              </span>
            </label>
          </div>

          {mediaError && <div className="be-alert">{mediaError}</div>}

           {mediaPreview && (
             <div className="be-media-preview">
               {mediaFile?.type.startsWith('video/') ? (
                 <video src={mediaPreview} controls />
               ) : mediaFile?.type === 'application/pdf' || /\.pdf$/i.test(mediaFile?.name || '') ? (
                 <iframe src={mediaPreview} title="PDF preview" style={{ width: '100%', height: 240, border: '1px solid var(--line)' }} />
               ) : (
                 <img src={mediaPreview} alt="Attachment preview" />
               )}
               <div className="be-media-meta">
                 <span>{mediaFile?.name}</span>
                 <button type="button" className="be-link-btn" onClick={removeMedia}>Remove</button>
               </div>
             </div>
           )}

          <div className="be-tokens">
            <span className="be-tokens-label">Personalize</span>
            <code>{'{{Name}}'}</code>
            <code>{'{{Email}}'}</code>
            <span className="be-tokens-hint">in the subject or body</span>
          </div>

          <div className="be-send-bar">
            <div className="be-send-summary">
              <div className="be-send-count-text">
                <span className="be-send-count">{selected.size}</span>
                <span>recipient{selected.size === 1 ? '' : 's'} selected</span>
              </div>
              {(htmlBody || mediaFile) && (
                <div className="be-send-tags">
                  {htmlBody && <span className="be-tag"><LayoutTemplate size={12} strokeWidth={2} /> HTML design</span>}
                  {mediaFile && <span className="be-tag"><Paperclip size={12} strokeWidth={2} /> Attachment</span>}
                </div>
              )}
            </div>
            <button
              type="button"
              className="be-send"
              onClick={send}
              disabled={sending || !subject.trim() || (!body.trim() && !htmlBody) || selected.size === 0}
            >
              {sending ? <><span className="be-spinner" />Sending…</> : <><Send size={16} strokeWidth={2} /> Send to {selected.size} recipient{selected.size === 1 ? '' : 's'}</>}
            </button>
          </div>
        </section>
      </div>
      )}

      {activeTab === 'history' && (
      <section className="be-card be-history">
        <div className="be-history-head">
          <div>
            <h2>Send history</h2>
            <p className="be-section-sub">Most recent {logs.length} campaign{logs.length === 1 ? '' : 's'}.</p>
          </div>
          <button type="button" className="be-btn-ghost" onClick={loadLogs} disabled={logsLoading}>
            <RefreshCw size={14} strokeWidth={2} className={logsLoading ? 'be-icon-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="be-stats">
          <div className="be-stat">
            <span className="be-stat-icon"><History size={17} strokeWidth={2} /></span>
            <div><strong>{historyStats.campaigns}</strong><span>Campaigns</span></div>
          </div>
          <div className="be-stat is-ok">
            <span className="be-stat-icon"><CheckCircle2 size={17} strokeWidth={2} /></span>
            <div><strong>{historyStats.sent}</strong><span>Emails sent</span></div>
          </div>
          <div className="be-stat is-fail">
            <span className="be-stat-icon"><AlertCircle size={17} strokeWidth={2} /></span>
            <div><strong>{historyStats.failed}</strong><span>Failed</span></div>
          </div>
        </div>

        {logsError && <div className="be-alert">{logsError}</div>}

        <div className="be-history-scroll">
          <table className="be-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Subject</th>
                <th>Source</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'right' }}>Sent</th>
                <th style={{ textAlign: 'right' }}>Failed</th>
                <th>By</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.created_at ? new Date(log.created_at).toLocaleString() : '-'}</td>
                  <td className="be-table-subject">{log.subject}</td>
                  <td>{SOURCE_LABEL[log.source] || log.source || '-'}</td>
                  <td>
                    <span className={`be-status-badge be-status-${log.status || 'completed'}`}>
                      {STATUS_LABEL[log.status] || log.status || 'Completed'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>{log.total_recipients}</td>
                  <td style={{ textAlign: 'right', color: '#15803d', fontWeight: 700 }}>{log.sent_count}</td>
                  <td style={{ textAlign: 'right', color: log.failed_count > 0 ? '#b91c1c' : 'var(--ink-soft)', fontWeight: 700 }}>{log.failed_count}</td>
                  <td>{log.created_by || '-'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button type="button" className="be-link-btn" onClick={() => openLog(log)}>View</button>
                    {log.status === 'processing' || log.status === 'queued' ? (
                      <button type="button" className="be-link-btn be-danger-link" onClick={() => cancelCampaign(log.id)}>Cancel</button>
                    ) : log.status !== 'completed' && Number(log.total_recipients || 0) > Number(log.sent_count || 0) ? (
                      <button type="button" className="be-link-btn" onClick={() => resumeCampaign(log.id)}>Resume</button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!logsLoading && logs.length === 0 && (
                <tr><td colSpan="9" className="be-table-empty">No campaigns sent yet.</td></tr>
              )}
              {logsLoading && (
                <tr><td colSpan="9" className="be-table-empty">Loading history...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {activeTab === 'templates' && (
        <div className="be-template-page">
          <section className="be-card">
            <div className="be-history-head">
              <div>
                <h2>{editingTemplateId ? 'Edit template' : 'Add template'}</h2>
                <p className="be-section-sub">Reusable subjects, bodies and attachments.</p>
              </div>
              <div className="be-template-actions">
                <button type="button" className="be-link-btn" onClick={() => openTemplateInBuilder(null)}>Open builder</button>
                {editingTemplateId && (
                  <button type="button" className="be-link-btn" onClick={cancelTemplateEdit}>Cancel edit</button>
                )}
              </div>
            </div>

            {templateError && <div className="be-alert">{templateError}</div>}

            <div className="be-row">
              <label className="be-field" style={{ flex: '1 1 240px' }}>
                <span>Template name</span>
                <input
                  className="be-input"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Donation Thank You"
                />
              </label>
              <label className="be-field" style={{ flex: '1 1 240px' }}>
                <span>Subject</span>
                <input
                  className="be-input"
                  value={templateForm.subject}
                  onChange={(e) => setTemplateForm((p) => ({ ...p, subject: e.target.value }))}
                  placeholder="Email subject"
                />
              </label>
            </div>

            <label className="be-field">
              <span>Body</span>
              <textarea
                className="be-textarea is-body"
                value={templateForm.body}
                onChange={(e) => setTemplateForm((p) => ({ ...p, body: e.target.value }))}
                placeholder="Write the template..."
              />
            </label>

            <button type="button" className="be-send" onClick={saveTemplateForm} disabled={templateSaving}>
              {templateSaving ? 'Saving...' : editingTemplateId ? 'Update template' : 'Save template'}
            </button>
          </section>

          <section className="be-card" style={{ marginTop: 16 }}>
            <div className="be-history-head">
              <div>
                <h2>Saved templates</h2>
                <p className="be-section-sub">{templates.length} template{templates.length === 1 ? '' : 's'} available.</p>
              </div>
              <button type="button" className="be-btn-ghost" onClick={loadTemplates} disabled={templatesLoading}>
                <RefreshCw size={14} strokeWidth={2} className={templatesLoading ? 'be-icon-spin' : ''} />
                Refresh
              </button>
            </div>

            {templatesLoading ? (
              <div className="be-empty">Loading templates...</div>
            ) : templates.length === 0 ? (
              <div className="be-empty">No templates yet.</div>
            ) : (
              <div className="be-history-scroll">
                <table className="be-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Subject</th>
                      <th>Type</th>
                      <th>Attachment</th>
                      <th>Updated</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((t) => (
                      <tr key={t.id}>
                        <td className="be-table-subject">{t.name}</td>
                        <td>{t.subject}</td>
                        <td>{t.has_design ? 'HTML' : 'Simple'}</td>
                        <td>{t.has_attachment ? (t.attachment_name || 'Yes') : '-'}</td>
                        <td>{t.updated_at ? new Date(t.updated_at).toLocaleString() : '-'}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button type="button" className="be-link-btn" onClick={() => useTemplate(t)}>Use</button>
                          {t.has_design ? (
                            <button type="button" className="be-link-btn" onClick={() => openTemplateInBuilder(t)}>Edit design</button>
                          ) : (
                            <button type="button" className="be-link-btn" onClick={() => editTemplate(t)}>Edit</button>
                          )}
                          <button type="button" className="be-link-btn be-danger-link" onClick={() => removeTemplate(t.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'builder' && (
        <EmailBuilder
          templateId={builderTemplateId}
          onCancel={() => setActiveTab('templates')}
          onSaved={async (saved) => {
            await loadTemplates();
            setBuilderTemplateId(saved?.id ? String(saved.id) : null);
            setActiveTab('templates');
          }}
        />
      )}

      {selectedLog && (
        <div className="be-modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="be-modal" onClick={(e) => e.stopPropagation()}>
            <div className="be-modal-head">
              <div className="be-modal-head-text">
                <h3>{selectedLog.subject}</h3>
                <div className="be-modal-sub">
                  {selectedLog.created_at ? new Date(selectedLog.created_at).toLocaleString() : ''}
                  {selectedLog.created_by ? ` · ${selectedLog.created_by}` : ''}
                  {selectedLog.status && (
                    <span className={`be-status-badge be-status-${selectedLog.status}`}>
                      {STATUS_LABEL[selectedLog.status] || selectedLog.status}
                    </span>
                  )}
                </div>
              </div>
              <button type="button" className="be-modal-close" onClick={() => setSelectedLog(null)} aria-label="Close">
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <div className="be-modal-body">
              <div className="be-modal-stats">
                <div className="be-modal-stat">
                  <span>Total</span>
                  <strong>{selectedLog.total_recipients}</strong>
                </div>
                <div className="be-modal-stat is-ok">
                  <span>Sent</span>
                  <strong>{selectedLog.sent_count}</strong>
                </div>
                <div className="be-modal-stat is-fail">
                  <span>Failed</span>
                  <strong>{selectedLog.failed_count}</strong>
                </div>
              </div>
              {selectedLog.loading ? (
                <div className="be-empty">Loading recipients...</div>
              ) : (
                <div className="be-modal-list">
                  {(selectedLog.recipients || []).map((r) => (
                    <div key={r.email} className="be-modal-row">
                      <span className="be-recipient-name">{r.email}</span>
                      <span className={r.ok === true ? 'be-status-ok' : r.ok === false ? 'be-status-fail' : 'be-status-pending'}>
                        {r.ok === true ? 'Sent' : r.ok === false ? 'Failed' : 'Pending'}
                      </span>
                      {r.ok === false && <span className="be-modal-error">{r.error}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
