import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import mammoth from 'mammoth'
import { useUcs } from '../../../store'
import { certificateApi } from '../api/certificates'
import { toast } from '../../../components/Toast'
import {
  FileText, Presentation, Plus, Edit3, Copy, Archive, ArchiveRestore, Trash2, Download,
  Wand2, Search, X, ChevronLeft, UploadCloud, RefreshCw, Loader2, CheckCircle2, AlertTriangle,
  History, Sparkles, Info, ExternalLink, ArrowLeft,
} from 'lucide-react'

const MINT = '#5B6B4E'
const STATUS_META = {
  active: { label: 'Active', cls: 'pill-green' },
  draft: { label: 'Draft', cls: 'pill-yellow' },
  archived: { label: 'Archived', cls: 'pill-gray' },
}
const TYPE_ICON = { docx: FileText, pptx: Presentation }
const TYPE_LABEL = { docx: 'DOCX', pptx: 'PPTX' }
const FIELD_TYPES = ['text', 'number', 'date', 'time', 'datetime', 'longtext']
const inputTypeFor = (t) => (t === 'datetime' ? 'datetime-local' : ['date', 'time', 'number'].includes(t) ? t : 'text')

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'
const humanKey = (k) => String(k || '').split('.').join(' ').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim() || String(k || '')

function saveOrOpen(url, filename) {
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  a.download = filename || ''
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

const PREVIEW_CSS = `box-sizing:border-box;background:#fff;border:1px solid var(--line);border-radius:12px;padding:28px;min-height:220px;max-height:72vh;overflow:auto;box-shadow:var(--shadow);`

export default function Certificates() {
  const { user } = useUcs()
  const canManage = ['accounts', 'super_admin', 'admin'].includes(user?.role)

  const [view, setView] = useState('library') // library | wizard | generate
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusTab, setStatusTab] = useState('')

  // History
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState([])
  const [historyQ, setHistoryQ] = useState('')
  const [historyLoading, setHistoryLoading] = useState(false)

  // Wizard
  const [draft, setDraft] = useState(null) // { id, name, description, file_format, fields, placeholders, ... }
  const [editingId, setEditingId] = useState(null)
  const fileInputRef = useRef(null)
  const uploadInputRef = useRef(null)

  // Generator
  const [genTpl, setGenTpl] = useState(null)
  const [values, setValues] = useState({})
  const [certNumber, setCertNumber] = useState('')
  const [previewHtml, setPreviewHtml] = useState(null)
  const [previewNote, setPreviewNote] = useState('')
  const [previewBusy, setPreviewBusy] = useState(false)
  const [generating, setGenerating] = useState(false)

  const loadTemplates = useCallback(async (status = statusTab) => {
    try {
      const rows = await certificateApi.listTemplates(status || undefined)
      setTemplates(rows || [])
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [statusTab])

  const loadHistory = useCallback(async (q = '') => {
    setHistoryLoading(true)
    try {
      const rows = await certificateApi.listCertificates(q || undefined)
      setHistory(rows || [])
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => { loadTemplates() }, [loadTemplates])

  const openWizard = useCallback(() => {
    setEditingId(null)
    setDraft({ name: '', description: '', file_format: null, file_name: '', placeholders: [], fields: [] })
    setView('wizard')
  }, [])

  const editTemplate = useCallback(async (tpl) => {
    try {
      const full = await certificateApi.getTemplate(tpl.id)
      setEditingId(full.id)
      setDraft({ ...full })
      setView('wizard')
    } catch (e) { toast(e.message, 'error') }
  }, [])

  const startGenerate = (tpl) => {
    setGenTpl(tpl)
    setValues({})
    setCertNumber('')
    setPreviewHtml(null)
    setPreviewNote('')
    setView('generate')
  }

  /* ------------------------------- upload/create ------------------------------- */

  const handlePickFile = () => uploadInputRef.current?.click()

  const handleUploadFile = async (file) => {
    if (!file) return
    if (!/\.(docx|pptx)$/i.test(file.name)) {
      toast('Only .docx or .pptx templates are supported.', 'error'); return
    }
    if (file.size > 50 * 1024 * 1024) { toast('File too large (max 50 MB).', 'error'); return }
    const formData = new FormData()
    formData.append('template', file)
    if (draft?.name?.trim()) formData.append('name', draft.name.trim())
    formData.append('description', draft?.description || '')
    try {
      const res = await certificateApi.createTemplate(formData)
      setDraft(res.template)
      toast(`Template created — ${res.detected?.length || 0} placeholder${(res.detected?.length ?? 0) === 1 ? '' : 's'} found`, 'success')
      setView('wizard')
      loadTemplates()
    } catch (e) { toast(e.message, 'error') }
  }

  const handleReupload = async (file) => {
    if (!file || !editingId) return
    if (!/\.(docx|pptx)$/i.test(file.name)) { toast('Only .docx or .pptx files.', 'error'); return }
    const formData = new FormData()
    formData.append('template', file)
    try {
      const res = await certificateApi.reuploadTemplate(editingId, formData)
      setDraft(res.template)
      toast(`File replaced — version v${res.template.version}`, 'success')
      loadTemplates()
    } catch (e) { toast(e.message, 'error') }
  }

  const saveFields = async () => {
    if (!draft) return
    const fields = (draft.fields || []).map((f, i) => ({
      field_key: f.field_key,
      display_name: f.display_name || humanKey(f.field_key),
      field_type: f.field_type || 'text',
      required: f.required,
      default_value: f.default_value || '',
      sort_order: i,
    }))
    if (!fields.some((f) => f.field_key?.trim())) {
      toast('Add at least one field before saving.', 'error'); return
    }
    try {
      await certificateApi.updateTemplate(draft.id, {
        name: draft.name, description: draft.description, status: draft.status, fields,
      })
      toast('Template saved', 'success')
      loadTemplates()
      setView('library')
    } catch (e) { toast(e.message, 'error') }
  }

  const addCustomField = () => {
    setDraft((d) => ({
      ...d,
      fields: [...(d.fields || []), { field_key: '', display_name: '', field_type: 'text', required: false, default_value: '', in_template: false }],
    }))
  }

  const patchField = (idx, patch) => {
    setDraft((d) => {
      const fields = (d.fields || []).map((f, i) => (i === idx ? { ...f, ...patch } : f))
      return { ...d, fields }
    })
  }

  const keyFromLabel = (label) => String(label || '').toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_.-]/g, '').slice(0, 60)

  /* ------------------------------- generation ------------------------------- */

  const requiredFields = useMemo(() => (genTpl?.fields || []).filter((f) => f.required), [genTpl])
  const missing = useMemo(() => {
    const m = []
    for (const f of requiredFields) {
      if (values[f.field_key] == null || String(values[f.field_key]).trim() === '') m.push(f.display_name || f.field_key)
    }
    return m
  }, [requiredFields, values])

  const runPreview = useCallback(async () => {
    if (!genTpl || genTpl.file_format !== 'docx') return
    if (missing.length) return
    setPreviewBusy(true)
    try {
      const resp = await certificateApi.preview({ template_id: genTpl.id, field_values: values, certificate_number: certNumber || undefined })
      const buf = await resp.arrayBuffer()
      const { value } = await mammoth.convertToHtml({ arrayBuffer: buf })
      setPreviewHtml(value)
      setPreviewNote('')
    } catch (e) {
      setPreviewHtml(null)
      setPreviewNote(e.message)
    } finally {
      setPreviewBusy(false)
    }
  }, [genTpl, values, certNumber, missing.length])

  useEffect(() => {
    if (!genTpl || genTpl.file_format !== 'docx') return
    const t = setTimeout(runPreview, 500)
    return () => clearTimeout(t)
  }, [genTpl, values, certNumber, runPreview])

  const doGenerate = async () => {
    if (!genTpl) return
    if (missing.length) { toast(`Missing: ${missing.join(', ')}`, 'error'); return }
    setGenerating(true)
    try {
      const res = await certificateApi.generate({ template_id: genTpl.id, field_values: values, certificate_number: certNumber || undefined })
      toast(`${res.certificate.certificate_number} generated`, 'success')
      saveOrOpen(res.certificate.generated_file, `${res.certificate.certificate_number}.${genTpl.file_format}`)
      if (showHistory) loadHistory(historyQ)
    } catch (e) { toast(e.message, 'error') } finally { setGenerating(false) }
  }

  /* --------------------------------- actions --------------------------------- */

  const doDuplicate = async (id) => {
    try {
      const res = await certificateApi.duplicateTemplate(id)
      toast(`Duplicate created (${res.template.status})`, 'success')
      loadTemplates()
    } catch (e) { toast(e.message, 'error') }
  }

  const doArchive = async (id) => {
    try {
      await certificateApi.setStatus(id, 'archived')
      toast('Template archived', 'success')
      loadTemplates()
    } catch (e) { toast(e.message, 'error') }
  }

  const doRestore = async (id) => {
    try {
      await certificateApi.setStatus(id, 'active')
      toast('Template restored', 'success')
      loadTemplates()
    } catch (e) { toast(e.message, 'error') }
  }

  const doDelete = async (tpl) => {
    if (!window.confirm(`Delete template "${tpl.name}"?\nGenerated certificates are kept in history.`)) return
    try {
      await certificateApi.deleteTemplate(tpl.id)
      toast('Template deleted', 'success')
      loadTemplates()
    } catch (e) { toast(e.message, 'error') }
  }

  const toggleHistory = () => {
    setShowHistory((s) => {
      const next = !s
      if (next) loadHistory()
      return next
    })
  }

  /* ---------------------------------- render ---------------------------------- */

  return (
    <div className="certificates-page">
      <style>{`
        .certificates-page { font-family: inherit; }
        .cert-topbar { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; padding:16px 18px; }
        .cert-topbar h3 { margin:0; font-size:15px; font-weight:600; }
        .cert-topbar .cert-sub { font-size:12px; color:var(--ink-soft); margin-top:2px; }
        .cert-actions { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
        .tabs { display:flex; gap:6px; flex-wrap:wrap; }
        .tab { padding:6px 12px; border-radius:8px; border:1px solid var(--line); background:transparent; color:var(--ink-soft); font-size:12px; font-weight:500; cursor:pointer; font-family:inherit; }
        .tab.active { background:var(--sage); border-color:var(--sage); color:#fff; }
        .tpl-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:14px; padding:4px 18px 20px; }
        .tpl-card { background:var(--card-bg); border:1px solid var(--line); border-radius:12px; box-shadow:var(--shadow); padding:16px; display:flex; flex-direction:column; gap:10px; }
        .tpl-card-head { display:flex; gap:10px; align-items:flex-start; }
        .tpl-type { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; color:#fff; flex-shrink:0; background:var(--sage); }
        .tpl-type.pptx { background:#c2410c; }
        .tpl-title { font-size:14px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .tpl-desc { font-size:12px; color:var(--ink-soft); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; min-height:32px; }
        .tpl-meta { display:flex; gap:6px; flex-wrap:wrap; font-size:11px; color:var(--ink-soft); }
        .tpl-meta span { background:var(--bg,#f3f4f6); border-radius:6px; padding:2px 8px; }
        .tpl-chips { display:flex; flex-wrap:wrap; gap:4px; }
        .chip { font-size:11px; background:var(--sage-soft,#eef3ea); color:var(--sage); border-radius:6px; padding:1px 7px; }
        .chip.custom { background:#fef3c7; color:#92400e; }
        .tpl-actions { display:flex; gap:6px; flex-wrap:wrap; margin-top:auto; }
        .tpl-actions .spacer { flex:1; }
        .field-row { display:grid; grid-template-columns:minmax(140px,1.2fr) minmax(90px,.7fr) 60px 1fr 84px; gap:8px; align-items:center; padding:8px 0; border-bottom:1px solid var(--line); }
        .field-row input, .field-row select { padding:7px 9px; border:1px solid #e5e7eb; border-radius:8px; font-size:13px; font-family:inherit; outline:none; width:100%; box-sizing:border-box; }
        .field-row input:focus, .field-row select:focus { border-color:var(--sage); }
        .field-row .req { text-align:center; }
        .field-row .badge { font-size:11px; padding:2px 8px; border-radius:20px; white-space:nowrap; }
        .gen-grid { display:grid; grid-template-columns:minmax(280px,380px) 1fr; gap:16px; align-items:start; }
        .gen-fields { display:flex; flex-direction:column; gap:10px; }
        .field-block { display:flex; flex-direction:column; gap:4px; }
        .field-block label { font-size:12px; font-weight:500; color:var(--ink-soft); }
        .field-block .fld { padding:8px 11px; border:1px solid #e5e7eb; border-radius:8px; font-size:13px; font-family:inherit; outline:none; }
        .field-block .fld:focus { border-color:var(--sage); }
        .field-block .fld.err { border-color:#dc2626; }
        .missing-box { background:#fef2f2; border:1px solid #fecaca; color:#991b1b; border-radius:8px; padding:8px 12px; font-size:12px; }
        .preview-wrap { position:relative; }
        .preview-loading { position:absolute; top:-8px; right:4px; z-index:2; display:flex; gap:6px; align-items:center; font-size:11px; color:var(--ink-soft); background:var(--card-bg); padding:4px 8px; border-radius:8px; border:1px solid var(--line); }
        .cert-paper { ${PREVIEW_CSS} }
        .cert-fallback { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; text-align:center; }
        .cert-paper :is(img,svg,canvas) { max-width:100%; }
        .cert-paper { word-break:break-word; }
        .cert-paper p { margin:0 0 8px; }
        .cert-empty { padding:52px 20px; text-align:center; color:var(--ink-soft); font-size:13px; }
        .cert-empty .big { font-size:15px; font-weight:600; color:var(--ink); margin-bottom:6px; }
        .hist-row { display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid var(--line); font-size:13px; }
        .hist-row:last-child { border-bottom:none; }
        .hist-num { font-weight:600; }
        .hist-recipient { color:var(--ink-soft); }
        .hist-actions { margin-left:auto; display:flex; gap:6px; }
        .back-btn { display:inline-flex; align-items:center; gap:6px; padding:7px 12px; border-radius:8px; font-size:12px; font-weight:500; cursor:pointer; font-family:inherit; background:transparent; border:1px solid var(--line); color:var(--ink-soft); }
        .back-btn:hover { background:var(--bg,#f9fafb); }
        .wiz-hint { font-size:12px; color:var(--ink-soft); background:var(--bg,#f9fafb); border:1px dashed var(--line); border-radius:10px; padding:12px 14px; }
        .dropzone { border:2px dashed var(--line); border-radius:12px; padding:34px 20px; text-align:center; cursor:pointer; transition:border-color .15s, background .15s; }
        .dropzone:hover, .dropzone.over { border-color:var(--sage); background:var(--sage-soft,#f2f7ef); }
        .dropzone .dz-main { font-size:14px; font-weight:600; color:var(--ink); margin-top:8px; }
        .dropzone .dz-sub { font-size:12px; color:var(--ink-soft); margin-top:2px; }
        .progress { display:inline-block; width:14px; height:14px; border:2px solid rgba(255,255,255,.4); border-top-color:#fff; border-radius:50%; animation:certspin .7s linear infinite; vertical-align:-2px; }
        @keyframes certspin { to { transform:rotate(360deg); } }
        @media (max-width: 900px) {
          .gen-grid { grid-template-columns:1fr; }
          .field-row { grid-template-columns:1fr; }
          .field-row .row-label { font-size:11px; color:var(--ink-soft); font-weight:600; text-transform:uppercase; letter-spacing:.04em; }
          .tpl-grid { grid-template-columns:1fr; }
        }
      `}</style>

      {/* ================================= HEADER ================================= */}
      <div className="card">
        <div className="cert-topbar">
          <div>
            {view === 'library' && (
              <>
                <h3>Certificate Templates
                  {showHistory && <span className="pill pill-blue" style={{ marginLeft: 8, verticalAlign: 'middle' }}>Generated History</span>}
                </h3>
                <div className="cert-sub">Reusable DOCX / PPTX templates with {`{placeholder}`} fields — fill and generate certificates.</div>
              </>
            )}
            {view === 'wizard' && <h3>{editingId ? 'Edit Template' : 'New Template'}</h3>}
            {view === 'generate' && <h3>Generate Certificate<span style={{ fontWeight: 400 }}> — {genTpl?.name}</span></h3>}
          </div>
          <div className="cert-actions">
            {view === 'library' && (
              <>
                <button className="btn btn-sm" onClick={toggleHistory}>
                  <History size={14} /> {showHistory ? 'Templates' : 'History'}
                </button>
                {canManage && (
                  <button className="btn btn-sm btn-primary" onClick={openWizard}>
                    <Plus size={14} /> New Template
                  </button>
                )}
              </>
            )}
            {view !== 'library' && (
              <button className="btn btn-sm" onClick={() => { setView('library'); setGenTpl(null) }}>
                <ArrowLeft size={14} /> Back
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ================================= LIBRARY ================================= */}
      {view === 'library' && !showHistory && (
        <div className="card">
          <div className="card-pad" style={{ paddingBottom: 0 }}>
            <div className="tabs">
              {[['', 'All'], ['active', 'Active'], ['draft', 'Draft'], ['archived', 'Archived']].map(([k, l]) => (
                <button key={l} className={`tab ${statusTab === k ? 'active' : ''}`} onClick={() => { setStatusTab(k); setLoading(true) }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <div className="cert-empty"><Loader2 size={18} className="spin" /> <span style={{ marginLeft: 8 }}>Loading…</span></div>
          ) : templates.length === 0 ? (
            <div className="cert-empty">
              <div><FileText size={30} style={{ color: 'var(--sage)', marginBottom: 8 }} /></div>
              <div className="big">No templates yet</div>
              <>Upload a .docx or .pptx certificate and start generating in minutes.</>
              <div style={{ marginTop: 16 }}>
                <button className="btn btn-sm btn-primary" onClick={openWizard}><Plus size={14} /> New Template</button>
              </div>
            </div>
          ) : (
            <div className="tpl-grid">
              {templates.map((t) => {
                const Icon = TYPE_ICON[t.file_format] || FileText
                const st = STATUS_META[t.status] || STATUS_META.draft
                return (
                  <div className="tpl-card" key={t.id}>
                    <div className="tpl-card-head">
                      <div className={`tpl-type ${t.file_format === 'pptx' ? 'pptx' : ''}`}><Icon size={20} /></div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="tpl-title" title={t.name}>{t.name}</div>
                        <div className="tpl-desc">{t.description || t.placeholders?.length ? '' : 'No description'}</div>
                      </div>
                    </div>
                    <div className="tpl-meta">
                      <span>{TYPE_LABEL[t.file_format] || 'FILE'}</span>
                      <span>v{t.version || 1}</span>
                      <span>{t.field_count || 0} fields</span>
                      <span>{t.certificate_count || 0} generated</span>
                      <span className={`pill ${st.cls}`} style={{ padding: '1px 8px' }}>{st.label}</span>
                    </div>
                    {(t.placeholders || []).length > 0 && (
                      <div className="tpl-chips">
                        {(t.placeholders || []).slice(0, 7).map((p) => (
                          <span className="chip" key={p.key}>{"{"}{p.key}{"}"}</span>
                        ))}
                        {(t.placeholders || []).length > 7 && <span className="chip">+{(t.placeholders || []).length - 7}</span>}
                      </div>
                    )}
                    <div className="tpl-actions">
                      <button className="btn btn-sm btn-primary" onClick={() => startGenerate(t)}>
                        <Wand2 size={14} /> Generate
                      </button>
                      <button className="btn btn-sm" onClick={() => saveOrOpen(t.template_file, `${t.name}.${t.file_format}`)} title="Open template file">
                        <Download size={14} />
                      </button>
                      {canManage && (
                        <>
                          <span className="spacer" />
                          <button className="btn btn-sm" onClick={() => editTemplate(t)} title="Configure fields">
                            <Edit3 size={14} />
                          </button>
                          <button className="btn btn-sm" onClick={() => doDuplicate(t.id)} title="Duplicate">
                            <Copy size={14} />
                          </button>
                          {t.status !== 'archived'
                            ? <button className="btn btn-sm" onClick={() => doArchive(t.id)} title="Archive"><Archive size={14} /></button>
                            : <button className="btn btn-sm" onClick={() => doRestore(t.id)} title="Restore"><ArchiveRestore size={14} /></button>}
                          <button className="btn btn-sm btn-danger" onClick={() => doDelete(t)} title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================= HISTORY ================================= */}
      {view === 'library' && showHistory && (
        <div className="card">
          <div className="card-pad" style={{ paddingBottom: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input
                  className="fld"
                  style={{ flex: 1, padding: '8px 11px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none' }}
                  placeholder="Search by certificate no. or recipient…"
                  value={historyQ}
                  onChange={(e) => setHistoryQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') loadHistory(historyQ) }}
                />
                <button className="btn btn-sm" onClick={() => { setHistoryLoading(true); loadHistory(historyQ) }}><Search size={14} /></button>
                {historyQ && <button className="btn btn-sm" onClick={() => { setHistoryQ(''); loadHistory('') }}><X size={14} /></button>}
              </div>
              <button className="btn btn-sm" onClick={() => { setHistoryLoading(true); loadHistory(historyQ) }}><RefreshCw size={14} /></button>
            </div>
          </div>
          <div className="card-pad">
            {historyLoading ? (
              <div className="cert-empty"><Loader2 size={18} className="spin" /> Loading history…</div>
            ) : history.length === 0 ? (
              <div className="cert-empty">
                <div className="big">No certificates generated yet</div>
                Generate one from any template and it will appear here with its field values.
              </div>
            ) : (
              <div>
                {history.map((c) => (
                  <div className="hist-row" key={c.id}>
                    <FileText size={15} style={{ color: 'var(--sage)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div className="hist-num">{c.certificate_number}</div>
                      <div className="hist-recipient" style={{ fontSize: 12 }}>
                        {c.recipient_name || '—'} · {c.template_name || 'deleted template'}
                      </div>
                    </div>
                    <div className="hist-recipient" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(c.generated_at)}</div>
                    <div className="hist-actions">
                      <button className="btn btn-sm" title="Open generated file" onClick={() => saveOrOpen(c.generated_file, `${c.certificate_number}.${(c.generated_file || '').split('.').pop()}`)}>
                        <ExternalLink size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================== WIZARD ================================== */}
      {view === 'wizard' && (
        <div className="card">
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(draft?.file_format == null) ? (
              /* ---------- step 1: upload ---------- */
              <>
                <div className="field">
                  <label>Template name</label>
                  <input
                    style={{ padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none' }}
                    placeholder="e.g. Donor Certificate 2026"
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label>Description (optional)</label>
                  <input
                    style={{ padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none' }}
                    placeholder="What is this certificate for?"
                    value={draft.description}
                    onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  />
                </div>
                <div
                  className="dropzone"
                  onClick={() => uploadInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleUploadFile([...e.dataTransfer.files][0]) }}
                >
                  <UploadCloud size={30} style={{ color: 'var(--sage)' }} />
                  <div className="dz-main">Drop your certificate template here</div>
                  <div className="dz-sub">or click to browse — fields like {`{name}`}, {`{certificate_no}`}, {`{date}`} are auto-detected</div>
                  <div className="dz-sub" style={{ marginTop: 6 }}><b>.docx</b> or <b>.pptx</b> · up to 50 MB</div>
                </div>
                <div className="wiz-hint">
                  <Info size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
                  Placeholders are plain text like <code>{`{name}`}</code> inside your Word / PowerPoint file. They are <b>data only</b> — never executed. Spaces inside braces ({' '}<code>{`{ name }`}</code>{' '}) are normalised automatically. The original template is never modified.
                </div>
              </>
            ) : (
              /* ---------- step 2: fields config ---------- */
              <>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div className={`tpl-type ${draft.file_format === 'pptx' ? 'pptx' : ''}`}>
                    {draft.file_format === 'pptx' ? <Presentation size={20} /> : <FileText size={20} />}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="tpl-title" style={{ whiteSpace: 'normal' }}>{draft.name}</div>
                    <div className="tpl-meta" style={{ gap: 6 }}>
                      <span>{draft.file_name}</span>
                      {editingId && <span>v{draft.version}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {canManage && (
                      <button className="btn btn-sm" onClick={() => fileInputRef.current?.click()}><UploadCloud size={14} /> Replace file</button>
                    )}
                    <button className="btn btn-sm" onClick={() => setView('library')}><ChevronLeft size={14} /> Cancel</button>
                  </div>
                </div>

                <div className="wiz-hint" style={{ fontSize: 12 }}>
                  {draft.placeholders?.length > 0
                    ? <>Detected <b>{draft.placeholders.length}</b> placeholder{(draft.placeholders.length === 1) ? '' : 's'}:{' '}
                      {draft.placeholders.map((p) => <code key={p.key} style={{ marginLeft: 4 }}>{`{${p.key}}`}</code>)}
                    </>
                    : <>No placeholders detected — this file has no {'{...}'} markers. Add them in Word/PowerPoint, or use custom fields below (they are saved but not embedded in the layout).</>}
                </div>

                <div>
                  <div className="field-row" style={{ borderBottom: '2px solid var(--line)', fontWeight: 600 }}>
                    <div className="row-label">Field key</div>
                    <div className="row-label">Type</div>
                    <div className="row-label req">Required</div>
                    <div className="row-label">Default value</div>
                    <div className="row-label">Status</div>
                  </div>
                  {(draft.fields || []).map((f, i) => (
                    <div className="field-row" key={i}>
                      <input
                        value={f.field_key}
                        placeholder="name"
                        onChange={(e) => patchField(i, { field_key: e.target.value })}
                      />
                      <select value={f.field_type} onChange={(e) => patchField(i, { field_type: e.target.value })}>
                        {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <label className="req" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <input
                          type="checkbox"
                          checked={!!f.required}
                          onChange={(e) => patchField(i, { required: e.target.checked })}
                          style={{ accentColor: 'var(--sage)' }}
                        />
                      </label>
                      <input
                        value={f.default_value || ''}
                        placeholder="—"
                        onChange={(e) => patchField(i, { default_value: e.target.value })}
                      />
                      <span className={`badge ${f.in_template ? 'pill-green' : 'cus'}`}
                        style={f.in_template ? { background: '#dcfce7', color: '#166534', textAlign: 'center' } : { background: '#fef3c7', color: '#92400e', textAlign: 'center' }}>
                        {f.in_template ? 'In template' : 'Custom'}
                      </span>
                    </div>
                  ))}
                  <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    <button className="btn btn-sm" onClick={addCustomField}><Plus size={14} /> Add custom field</button>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-sm" onClick={() => setView('library')}>Cancel</button>
                      <button className="btn btn-sm btn-primary" onClick={saveFields}>
                        <CheckCircle2 size={14} /> Save template
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
            <input
              ref={uploadInputRef}
              type="file"
              accept=".docx,.pptx"
              hidden
              onChange={(e) => { handleUploadFile(e.target.files[0]); e.target.value = '' }}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.pptx"
              hidden
              onChange={(e) => { const f = e.target.files[0]; if (f) handleReupload(f); e.target.value = '' }}
            />
          </div>
        </div>
      )}

      {/* ================================== GENERATOR ================================== */}
      {view === 'generate' && genTpl && (
        <div className="gen-grid">
          <div className="card">
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="wiz-hint" style={{ fontSize: 12, margin: 0 }}>
                Fields marked <b style={{ color: '#dc2626' }}>*</b> are required. The preview updates as you type.
              </div>

              <div className="field-block">
                <label>Certificate number <span style={{ color: 'var(--ink-soft)' }}>(optional — auto-generated if empty)</span></label>
                <input
                  className="fld"
                  type="text"
                  placeholder="e.g. CERT-2026-00001"
                  value={certNumber}
                  onChange={(e) => setCertNumber(e.target.value)}
                />
              </div>

              {(genTpl.fields || []).map((f) => (
                <div className="field-block" key={f.field_key}>
                  <label>
                    {f.display_name || humanKey(f.field_key)} {f.required && <span style={{ color: '#dc2626' }}>*</span>}
                    {!f.in_template && (
                      <span className="badge cus" style={{ background: '#fef3c7', color: '#92400e', marginLeft: 8 }}>Not found in template</span>
                    )}
                  </label>
                  {f.field_type === 'longtext' ? (
                    <textarea className="fld" rows={3} value={values[f.field_key] || ''} onChange={(e) => setValues((v) => ({ ...v, [f.field_key]: e.target.value }))} />
                  ) : (
                    <input
                      className={`fld ${missing.includes(f.display_name || f.field_key) ? 'err' : ''}`}
                      type={inputTypeFor(f.field_type)}
                      placeholder={humanKey(f.field_key)}
                      value={values[f.field_key] ?? f.default_value ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, [f.field_key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}

              {missing.length > 0 && (
                <div className="missing-box"><AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 6 }} />Missing: <b>{missing.join(', ')}</b></div>
              )}

              <button className="btn btn-primary" onClick={doGenerate} disabled={generating}>
                {generating ? <><span className="progress" /> Generating…</> : <><Sparkles size={15} /> Generate certificate</>}
              </button>
            </div>
          </div>

          <div className="preview-wrap">
            {previewBusy && (
              <div className="preview-loading"><Loader2 size={13} className="spin" /> Updating preview…</div>
            )}
            {genTpl.file_format === 'docx' ? (
              previewHtml ? (
                <div className="cert-paper" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              ) : previewNote ? (
                <div className="cert-paper cert-fallback" style={{ color: '#991b1b' }}>
                  <div><AlertTriangle size={18} style={{ margin: '0 auto 8px', display: 'block' }} />{previewNote}</div>
                </div>
              ) : (
                <div className="cert-paper cert-fallback" style={{ color: 'var(--ink-soft)' }}>
                  {missing.length ? 'Fill the required fields to preview.' : 'Generating preview…'}
                </div>
              )
            ) : (
              <div className="cert-paper cert-fallback">
                <Presentation size={26} style={{ color: '#c2410c' }} />
                <div><b>PPTX template</b> — slide preview is not available in the browser.</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Generate the certificate to download the filled PowerPoint file and check it.</div>
                <button className="btn btn-sm" onClick={() => saveOrOpen(genTpl.template_file, `${genTpl.name}.${genTpl.file_format}`)}>
                  <Download size={14} /> Open base template
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}