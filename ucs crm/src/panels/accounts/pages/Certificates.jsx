import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import mammoth from 'mammoth'
import { useUcs } from '../../../store'
import { certificateApi } from '../api/certificates'
import { toast } from '../../../components/Toast'
import {
  FileText, Presentation, Plus, Edit3, Copy, Archive, ArchiveRestore, Trash2, Download,
  Wand2, Search, X, ChevronLeft, UploadCloud, RefreshCw, Loader2, CheckCircle2, AlertTriangle,
  History, Sparkles, Info, ExternalLink, ArrowLeft, Users, MoreVertical, Wrench,
} from 'lucide-react'

const MINT = '#5B6B4E'
const STATUS_META = {
  active: { label: 'Active', cls: 'pill-green' },
  draft: { label: 'Draft', cls: 'pill-yellow' },
  archived: { label: 'Archived', cls: 'pill-gray' },
}
const TYPE_LABEL = { docx: 'DOCX', pptx: 'PPTX' }
const FIELD_TYPES = ['text', 'number', 'date', 'time', 'datetime', 'longtext']
const DEFAULT_PURPOSES = [{ id: -1, name: 'Appreciation certificate' }, { id: -2, name: 'Achievement certificate' }, { id: -3, name: 'Other' }]
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

const thumbCache = {}

function TemplateThumb({ t }) {
  const [html, setHtml] = useState(null)
  const [state, setState] = useState('loading') // loading | done | error
  const hasImage = !!(t.preview_image)
  useEffect(() => {
    if (hasImage) { setState('done'); return }
    let cancelled = false
    setHtml(null)
    setState('loading')
    if (t.file_format !== 'docx' || !t.template_file) { setState('error'); return }
    const key = `${t.id}-v${t.version || 1}`
    if (thumbCache[key]) { setHtml(thumbCache[key]); setState('done'); return }
    ;(async () => {
      try {
        const resp = await certificateApi.getTemplateFile(t.id)
        const buf = await resp.arrayBuffer()
        const { value } = await mammoth.convertToHtml({ arrayBuffer: buf })
        thumbCache[key] = value
        if (!cancelled) { setHtml(value); setState('done') }
      } catch (e) {
        if (!cancelled) setState('error')
      }
    })()
    return () => { cancelled = true }
  }, [t, hasImage])
  if (hasImage) {
    return <div className="tpl-thumb-img"><img src={t.preview_image} alt={t.name} /></div>
  }
  if (state === 'loading') {
    return <div className="tpl-thumb-loading"><Loader2 size={16} className="spin" /></div>
  }
  if (state === 'error') {
    return (
      <div className="tpl-thumb-fallback">
        {t.file_format === 'pptx'
          ? <><Presentation size={26} color="#c2410c" /><span>PPTX template</span></>
          : <><FileText size={26} color="var(--sage)" /><span>No preview</span></>}
      </div>
    )
  }
  return <div className="tpl-thumb-doc" dangerouslySetInnerHTML={{ __html: html }} />
}

const PREVIEW_CSS = `box-sizing:border-box;background:#fff;border:1px solid var(--line);border-radius:12px;padding:28px;min-height:220px;max-height:72vh;overflow:auto;box-shadow:var(--shadow);`

const META_STYLE = { padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13.5, outline: 'none', width: '100%', background: '#fff' }

function TemplateMeta({ ngos, purposes, value, onChange, ngoPlaceholder = 'Select NGO', purposePlaceholder = 'Select purpose', required = false }) {
  const sel = value || {}
  const set = (patch) => onChange({ ...sel, ...patch })
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <div className="field" style={{ flex: 1, minWidth: 200 }}>
        <label>NGO{required ? ' *' : ''}</label>
        <select value={sel.ngo_id || ''} onChange={(e) => set({ ngo_id: e.target.value })} style={META_STYLE}>
          <option value="">{ngoPlaceholder}</option>
          {ngos.map((n) => <option key={String(n.id)} value={n.id}>{n.name}</option>)}
        </select>
      </div>
      <div className="field" style={{ flex: 1, minWidth: 200 }}>
        <label>Purpose{required ? ' *' : ''}</label>
        <select value={sel.purpose || ''} onChange={(e) => set({ purpose: e.target.value })} style={META_STYLE}>
          <option value="">{purposePlaceholder}</option>
          {purposes.map((p) => <option key={String(p.id)} value={p.name}>{p.name}</option>)}
        </select>
      </div>
    </div>
  )
}

export default function Certificates() {
  const { user } = useUcs()
  const canManage = ['accounts', 'super_admin', 'admin'].includes(user?.role)

  const [view, setView] = useState('library') // library | wizard | generate
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusTab, setStatusTab] = useState('')
  const [ngoFilter, setNgoFilter] = useState('')
  const [purposeFilter, setPurposeFilter] = useState('')
  const [ngos, setNgos] = useState([])
  const [purposes, setPurposes] = useState(DEFAULT_PURPOSES)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [purposesOpen, setPurposesOpen] = useState(false)
  const [purposeName, setPurposeName] = useState('')
  const [purposeBusy, setPurposeBusy] = useState(false)
  const [menuOpenId, setMenuOpenId] = useState(null)

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
  const previewInputRef = useRef(null)
  const previewTplIdRef = useRef(null)
  const [previewUploadBusy, setPreviewUploadBusy] = useState(false)

  // Generator
  const [genTpl, setGenTpl] = useState(null)
  const [values, setValues] = useState({})
  const [certNumber, setCertNumber] = useState('')
  const [previewHtml, setPreviewHtml] = useState(null)
  const [previewImg, setPreviewImg] = useState(null)
  const [previewNote, setPreviewNote] = useState('')
  const [previewBusy, setPreviewBusy] = useState(false)

  // Bulk certify
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkRows, setBulkRows] = useState([])
  const [bulkPaste, setBulkPaste] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkResult, setBulkResult] = useState(null)
  const [bulkDate, setBulkDate] = useState(() => {
    const d = new Date()
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 10)
  })
  const [bulkEvent, setBulkEvent] = useState('')
  const [previewRowIdx, setPreviewRowIdx] = useState(0)
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

  useEffect(() => {
    let cancelled = false
    certificateApi.getNgoOptions()
      .then((rows) => { if (!cancelled) setNgos(rows || []) })
      .catch(() => {})
    certificateApi.listPurposes()
      .then((rows) => { if (!cancelled) { const list = rows || []; setPurposes(list.length ? list : DEFAULT_PURPOSES) } })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const addPurpose = async () => {
    const name = purposeName.trim()
    if (!name) { toast('Enter a purpose name.', 'error'); return }
    setPurposeBusy(true)
    try {
      const rows = await certificateApi.addPurpose(name)
      setPurposes(rows.length ? rows : DEFAULT_PURPOSES)
      setPurposeName('')
      toast('Purpose added', 'success')
    } catch (e) { toast(e.message, 'error') } finally { setPurposeBusy(false) }
  }

  const removePurpose = async (p) => {
    if (!window.confirm(`Delete purpose "${p.name}"? Existing templates keep their label.`)) return
    setPurposeBusy(true)
    try {
      const rows = await certificateApi.deletePurpose(p.id)
      setPurposes(rows.length ? rows : DEFAULT_PURPOSES)
      toast('Purpose removed', 'success')
    } catch (e) { toast(e.message, 'error') } finally { setPurposeBusy(false) }
  }

  useEffect(() => {
    if (!toolsOpen) return
    const close = () => setToolsOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [toolsOpen])

  const visibleTemplates = useMemo(() => templates.filter((t) =>
    (!ngoFilter || String(t.ngo_id || '') === String(ngoFilter)) &&
    (!purposeFilter || (t.purpose || '') === purposeFilter)
  ), [templates, ngoFilter, purposeFilter])

  const openWizard = useCallback(() => {
    setEditingId(null)
    setDraft({ name: '', description: '', file_format: null, file_name: '', placeholders: [], fields: [], ngo_id: '', purpose: '' })
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

  const startGenerate = async (tpl) => {
    setView('generate')
    setValues({})
    setCertNumber('')
    setPreviewHtml(null)
    setPreviewImg(null)
    setPreviewNote('')
    setBulkMode(false)
    setBulkRows([])
    setBulkPaste('')
    setBulkResult(null)
    try {
      const full = tpl.fields ? tpl : await certificateApi.getTemplate(tpl.id)
      setGenTpl(full.id ? full : tpl)
    } catch (e) {
      toast(e.message, 'error')
      setGenTpl(tpl)
    }
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
    formData.append('purpose', draft?.purpose || '')
    if (draft?.ngo_id) formData.append('ngo_id', draft.ngo_id)
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

  const handlePreviewPick = (tplId) => {
    previewTplIdRef.current = tplId || draft?.id || null
    previewInputRef.current?.click()
  }

  const handlePreviewUpload = async (file, tplId = previewTplIdRef.current || draft?.id) => {
    if (!file || !tplId) return
    if (!/\.(png|jpe?g|webp|gif)$/i.test(file.name)) { toast('Only PNG, JPG, WEBP or GIF images.', 'error'); return }
    if (file.size > 10 * 1024 * 1024) { toast('Image too large (max 10 MB).', 'error'); return }
    setPreviewUploadBusy(true)
    const formData = new FormData()
    formData.append('preview', file)
    try {
      const res = await certificateApi.setTemplatePreview(tplId, formData)
      setDraft((d) => (d && d.id === tplId
        ? { ...d, preview_image: res.template.preview_image, preview_key: res.template.preview_key }
        : d))
      setGenTpl((g) => (g && g.id === tplId
        ? { ...g, preview_image: res.template.preview_image, preview_key: res.template.preview_key }
        : g))
      setPreviewHtml(null)
      setPreviewImg(null)
      toast('Preview image saved', 'success')
      loadTemplates()
    } catch (e) { toast(e.message, 'error') } finally { setPreviewUploadBusy(false) }
  }

  const saveFields = async (thenGenerate = false) => {
    if (!draft) return
    const fields = (draft.fields || []).map((f, i) => ({
      field_key: f.field_key,
      display_name: f.display_name || humanKey(f.field_key),
      field_type: f.field_type || 'text',
      required: true,
      default_value: f.default_value || '',
      sort_order: i,
      in_template: f.in_template,
    }))
    if (!fields.some((f) => f.field_key?.trim())) {
      toast('Add at least one field before saving.', 'error'); return
    }
    try {
      await certificateApi.updateTemplate(draft.id, {
        name: draft.name, description: draft.description, status: draft.status, fields,
        ngo_id: draft.ngo_id || null, purpose: draft.purpose || '',
      })
      loadTemplates()
      if (thenGenerate) {
        startGenerate({ ...draft, fields, status: draft.status })
      } else {
        toast('Template saved', 'success')
        setView('library')
      }
    } catch (e) { toast(e.message, 'error') }
  }

  const addCustomField = () => {
    setDraft((d) => ({
      ...d,
      fields: [...(d.fields || []), { field_key: '', display_name: '', field_type: 'text', required: true, default_value: '', in_template: false }],
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

  const bulkDateKey = useMemo(() => {
    const fields = genTpl?.fields || []
    return fields.find((f) => /date/i.test(f.field_key) || /date/i.test(f.display_name || ''))?.field_key || ''
  }, [genTpl])

  const bulkEventKey = useMemo(() => {
    const fields = genTpl?.fields || []
    return fields.find((f) => /event|occasion|purpose|reason/i.test(f.field_key) || /event|occasion|purpose|reason/i.test(f.display_name || ''))?.field_key || ''
  }, [genTpl])

  const requiredFields = useMemo(() => (genTpl?.fields || []).filter((f) => f.required), [genTpl])

  // Effective field values used for the live preview: single-mode form values,
  // or the active bulk row merged with the shared Date/Event.
  const previewValues = useMemo(() => {
    if (bulkMode && bulkRows.length) {
      const idx = Math.min(previewRowIdx, bulkRows.length - 1)
      const active = { ...(bulkRows[idx] || {}) }
      delete active.__name
      if (bulkDateKey) active[bulkDateKey] = bulkDate
      if (bulkEventKey) active[bulkEventKey] = bulkEvent
      return active
    }
    return values
  }, [bulkMode, bulkRows, previewRowIdx, bulkDate, bulkEvent, bulkDateKey, bulkEventKey, values])

  const missing = useMemo(() => {
    const m = []
    for (const f of requiredFields) {
      const v = previewValues[f.field_key] ?? f.default_value
      if (v == null || String(v).trim() === '') m.push(f.display_name || f.field_key)
    }
    return m
  }, [requiredFields, previewValues])

  const runPreview = useCallback(async () => {
    if (!genTpl) return
    setPreviewBusy(true)
    try {
      const resp = await certificateApi.preview({ template_id: genTpl.id, field_values: previewValues, certificate_number: certNumber || undefined })
      if (!resp.ok) {
        let msg = 'Preview failed'
        try { const j = await resp.json(); msg = j.message || msg } catch { /* keep default */ }
        throw new Error(msg)
      }
      if (genTpl.file_format === 'pptx') {
        const ct = resp.headers.get('content-type') || ''
        if (!ct.includes('image')) throw new Error('Live preview could not be rendered for this template.')
        const blob = await resp.blob()
        const url = URL.createObjectURL(blob)
        setPreviewImg(() => url)
        setPreviewNote('')
      } else {
        const buf = await resp.arrayBuffer()
        const { value } = await mammoth.convertToHtml({ arrayBuffer: buf })
        setPreviewHtml(value)
        setPreviewNote('')
      }
    } catch (e) {
      // Keep whatever preview is currently showing; the old blob is revoked by
      // the cleanup effect only after the new one is committed, so no broken
      // image in between.
      setPreviewNote(e.message)
    } finally {
      setPreviewBusy(false)
    }
  }, [genTpl, previewValues, certNumber])

  useEffect(() => {
    if (!genTpl) return
    const t = setTimeout(runPreview, genTpl.file_format === 'pptx' ? 800 : 350)
    return () => clearTimeout(t)
  }, [genTpl, previewValues, certNumber, runPreview])

  useEffect(() => () => { if (previewImg) URL.revokeObjectURL(previewImg) }, [previewImg])

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

  /* ------------------------------ bulk certify ------------------------------ */

  const bulkNameKey = useMemo(() => {
    const fields = genTpl?.fields || []
    const exact = fields.find((f) => ['name', 'recipient', 'recipient_name', 'full_name'].includes(f.field_key))
    return (exact || fields[0])?.field_key || ''
  }, [genTpl])

  useEffect(() => {
    if (!bulkRows.length || (!bulkDateKey && !bulkEventKey)) return
    setBulkRows((rows) => rows.map((r) => {
      const next = { ...r }
      if (bulkDateKey) next[bulkDateKey] = bulkDate
      if (bulkEventKey) next[bulkEventKey] = bulkEvent
      return next
    }))
  }, [bulkDate, bulkEvent, bulkDateKey, bulkEventKey, bulkRows.length])

  const applyBulkPaste = () => {
    const names = bulkPaste.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    if (!names.length) { toast('Paste at least one name.', 'error'); return }
    if (!bulkNameKey) { toast('This template has no fillable fields.', 'error'); return }
    setBulkRows(names.map((n) => ({ [bulkNameKey]: n, __name: n })))
    setBulkResult(null)
    toast(`${names.length} row${names.length === 1 ? '' : 's'} loaded`, 'success')
  }

  const patchBulkCell = (idx, key, val) => {
    setBulkRows((rows) => rows.map((r, i) => (i === idx ? { ...r, [key]: val } : r)))
  }

  const removeBulkRow = (idx) => {
    setBulkRows((rows) => rows.filter((_, i) => i !== idx))
    setBulkResult(null)
  }

  const addBulkRow = () => {
    const blank = {}
    if (bulkNameKey) blank[bulkNameKey] = ''
    setBulkRows((rows) => [...rows, blank])
    setBulkResult(null)
  }

  const doBulkGenerate = async () => {
    if (!genTpl) return
    if (!bulkRows.length) { toast('Add at least one row.', 'error'); return }
    setBulkBusy(true)
    setBulkResult(null)
    try {
      const rows = bulkRows.map((r) => {
        const { __name, ...field_values } = r
        if (bulkDateKey && !field_values[bulkDateKey]) field_values[bulkDateKey] = bulkDate
        if (bulkEventKey && !field_values[bulkEventKey]) field_values[bulkEventKey] = bulkEvent
        return { field_values }
      })
      const res = await certificateApi.bulkGenerate({ template_id: genTpl.id, rows })
      setBulkResult(res)
      toast(res.message, res.failed && !res.ok ? 'error' : 'success')
      if (showHistory) loadHistory(historyQ)
    } catch (e) { toast(e.message, 'error') } finally { setBulkBusy(false) }
  }

  /* ------------------------------- card menu ------------------------------- */

  const toggleCardMenu = (id) => setMenuOpenId((cur) => (cur === id ? null : id))

  const runMenuAction = (fn) => () => { setMenuOpenId(null); fn() }

  useEffect(() => {
    if (!menuOpenId) return
    const close = () => setMenuOpenId(null)
    window.addEventListener('click', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', close)
    }
  }, [menuOpenId])

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

  const refreshSnapshots = async () => {
    try {
      const res = await certificateApi.snapshotAllTemplates()
      toast(res.message || 'Snapshots refreshed', 'success')
      loadTemplates()
    } catch (e) { toast(e.message, 'error') }
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
        .tpl-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:14px; padding:4px 18px 20px; }
        .tpl-card { background:var(--card-bg); border:1px solid var(--line); border-radius:12px; box-shadow:var(--shadow); padding:12px; display:flex; flex-direction:column; gap:10px; }
        .tpl-thumb { display:block; width:100%; height:210px; padding:0; border:1px solid var(--line); border-radius:10px; overflow:hidden; background:var(--bg,#f3f4f6); cursor:pointer; text-align:left; }
        .tpl-thumb:hover { border-color:var(--sage); box-shadow:0 0 0 2px var(--sage-soft,#eef3ea); }
        .tpl-thumb-img { width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#fff; }
        .tpl-thumb-img img { max-width:100%; max-height:100%; object-fit:contain; }
        .tpl-thumb-doc { transform:scale(.5); transform-origin:top left; width:200%; pointer-events:none; word-break:break-word; }
        .tpl-thumb-doc :is(img,svg,canvas) { max-width:100%; }
        .tpl-thumb-loading { display:flex; align-items:center; justify-content:center; height:100%; color:var(--ink-soft); }
        .tpl-thumb-fallback { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; height:100%; color:var(--ink-soft); font-size:12px; }
        .tpl-title-row { display:flex; align-items:center; gap:6px; }
        .tpl-title { font-size:14px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; background:none; border:none; padding:0; color:inherit; cursor:pointer; flex:1; min-width:0; text-align:left; font-family:inherit; }
        .tpl-title:hover { color:var(--sage); }
        .tpl-desc { font-size:12px; color:var(--ink-soft); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; min-height:32px; }
        .tpl-meta { display:flex; gap:6px; flex-wrap:wrap; font-size:11px; color:var(--ink-soft); }
        .tpl-meta span { background:var(--bg,#f3f4f6); border-radius:6px; padding:2px 8px; }
        .tpl-card-menu { position:absolute; top:18px; right:18px; z-index:3; }
        .tpl-card { position:relative; }
        .tpl-menu-btn { width:30px; height:30px; display:flex; align-items:center; justify-content:center; border:none; border-radius:8px; background:rgba(255,255,255,.92); color:var(--ink); cursor:pointer; box-shadow:0 1px 4px rgba(0,0,0,.15); }
        .tpl-menu-btn:hover { background:#fff; color:var(--sage); }
        .tpl-menu { position:absolute; top:34px; right:0; min-width:150px; background:#fff; border:1px solid var(--line); border-radius:10px; box-shadow:0 6px 20px rgba(0,0,0,.14); padding:4px; display:flex; flex-direction:column; }
        .tpl-menu-item { display:flex; align-items:center; gap:9px; padding:8px 10px; border:none; background:none; border-radius:7px; font-size:13px; color:var(--ink); cursor:pointer; font-family:inherit; text-align:left; }
        .tpl-menu-item:hover { background:var(--bg,#f3f4f6); }
        .tpl-menu-item.danger { color:#dc2626; }
        .tpl-menu-item.danger:hover { background:#fef2f2; }
        .cert-overlay { position:fixed; inset:0; z-index:2100; background:rgba(12,24,19,.5); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:18px; }
        .cert-modal { background:#fff; border-radius:14px; box-shadow:0 18px 50px rgba(0,0,0,.22); width:100%; overflow:hidden; animation:certIn .16s ease; }
        .cert-modal-head { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:14px 16px; border-bottom:1px solid var(--line); }
        .cert-modal-body { padding:14px 16px; }
        @keyframes certIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
        .field-row { display:grid; grid-template-columns:minmax(140px,1.2fr) minmax(90px,.7fr) 60px 1fr 84px; gap:8px; align-items:center; padding:8px 0; border-bottom:1px solid var(--line); }
        .field-row input, .field-row select { padding:7px 9px; border:1px solid #e5e7eb; border-radius:8px; font-size:13px; font-family:inherit; outline:none; width:100%; box-sizing:border-box; }
        .field-row input:focus, .field-row select:focus { border-color:var(--sage); }
        .field-row .req { text-align:center; }
        .field-row .badge { font-size:11px; padding:2px 8px; border-radius:20px; white-space:nowrap; }
        .gen-grid { display:grid; grid-template-columns:minmax(280px,380px) 1fr; gap:16px; align-items:start; }
        .bulk-tabs { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
        .bulk-paste { width:100%; min-height:96px; padding:9px 12px; border:1px solid #e5e7eb; border-radius:8px; font-size:13px; font-family:inherit; box-sizing:border-box; resize:vertical; outline:none; }
        .bulk-paste:focus { border-color:var(--sage); }
        .bulk-table { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
        .bulk-shared-label { background:var(--sage-soft,#eef3ea); color:var(--sage); border-radius:6px; padding:1px 7px; font-size:10.5px; font-weight:500; }
        .bulk-shared { display:inline-block; background:var(--sage-soft,#eef3ea); color:#3f6212; padding:5px 9px; border-radius:6px; font-size:12px; min-width:120px; box-sizing:border-box; }
        .bulk-table table { width:100%; border-collapse:collapse; font-size:12.5px; }
        .bulk-table th, .bulk-table td { padding:7px 9px; border-bottom:1px solid var(--line); text-align:left; vertical-align:middle; white-space:nowrap; }
        .bulk-table th { background:var(--bg,#f9fafb); font-weight:600; color:var(--ink-soft); }
        .bulk-table input { padding:6px 8px; border:1px solid #e5e7eb; border-radius:6px; font-size:12.5px; font-family:inherit; outline:none; min-width:120px; box-sizing:border-box; }
        .bulk-table input:focus { border-color:var(--sage); }
        .bulk-result { border:1px solid var(--line); border-radius:10px; padding:12px 14px; margin-top:12px; }
        .bulk-result .ok-row { display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px dashed var(--line); font-size:13px; }
        .bulk-result .ok-row:last-child { border-bottom:none; }
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
                {canManage && !showHistory && (
                  <div className="tools-wrap" style={{ position: 'relative' }}>
                    <button
                      className="btn btn-sm"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setToolsOpen((v) => !v) }}
                      title="Tools"
                    >
                      <Wrench size={14} /> Tools
                    </button>
                    {toolsOpen && (
                      <div className="tpl-menu" style={{ top: '100%', right: 0, left: 'auto' }} onClick={(e) => e.stopPropagation()}>
                        <button className="tpl-menu-item" onClick={() => { setToolsOpen(false); setPurposesOpen(true) }}>
                          <Sparkles size={14} /> Manage purposes
                        </button>
                        {templates.length > 0 && (
                          <button className="tpl-menu-item" onClick={() => { setToolsOpen(false); refreshSnapshots() }}>
                            <RefreshCw size={14} /> Regenerate thumbnails
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
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
            {(templates.length > 0) && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, marginTop: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600 }}>Filter:</span>
                <select value={ngoFilter} onChange={(e) => setNgoFilter(e.target.value)} style={META_STYLE}>
                  <option value="">All NGOs</option>
                  {ngos.map((n) => <option key={String(n.id)} value={n.id}>{n.name}</option>)}
                </select>
                <select value={purposeFilter} onChange={(e) => setPurposeFilter(e.target.value)} style={{ ...META_STYLE, maxWidth: 260 }}>
                  <option value="">All purposes</option>
                  {purposes.map((p) => <option key={String(p.id)} value={p.name}>{p.name}</option>)}
                </select>
                {(ngoFilter || purposeFilter) && (
                  <button className="btn btn-sm" onClick={() => { setNgoFilter(''); setPurposeFilter('') }}><X size={13} /> Clear filters</button>
                )}
              </div>
            )}
          </div>
          {loading ? (
            <div className="cert-empty"><Loader2 size={18} className="spin" /> <span style={{ marginLeft: 8 }}>Loading…</span></div>
          ) : visibleTemplates.length === 0 ? (
            <div className="cert-empty">
              <div><FileText size={30} style={{ color: 'var(--sage)', marginBottom: 8 }} /></div>
              <div className="big">{templates.length === 0 ? 'No templates yet' : 'No templates match these filters'}</div>
              {templates.length === 0
                ? <>Upload a .docx or .pptx certificate and start generating in minutes.</>
                : <>Try clearing the NGO or purpose filter above.</>}
              {templates.length === 0 && (
                <div style={{ marginTop: 16 }}>
                  <button className="btn btn-sm btn-primary" onClick={openWizard}><Plus size={14} /> New Template</button>
                </div>
              )}
            </div>
          ) : (
            <div className="tpl-grid">
              {visibleTemplates.map((t) => {
                const st = STATUS_META[t.status] || STATUS_META.draft
                const open = menuOpenId === t.id
                return (
                  <div className="tpl-card" key={t.id}>
                    <button type="button" className="tpl-thumb" onClick={() => startGenerate(t)} title={`Certify — ${t.name}`}>
                      <TemplateThumb t={t} />
                    </button>
                    <div className="tpl-card-menu">
                      <button
                        type="button"
                        className="tpl-menu-btn"
                        onClick={(e) => { e.stopPropagation(); toggleCardMenu(t.id) }}
                        title="Options"
                      >
                        <MoreVertical size={15} />
                      </button>
                      {open && (
                        <div className="tpl-menu" onClick={(e) => e.stopPropagation()}>
                          <button className="tpl-menu-item" onClick={runMenuAction(() => startGenerate(t))}>
                            <Wand2 size={14} /> Certify
                          </button>
                          {canManage && (
                            <>
                              <button className="tpl-menu-item" onClick={runMenuAction(() => editTemplate(t))}>
                                <Edit3 size={14} /> Edit
                              </button>
                              <button className="tpl-menu-item" onClick={runMenuAction(() => doDuplicate(t.id))}>
                                <Copy size={14} /> Duplicate
                              </button>
                              {t.status !== 'archived'
                                ? <button className="tpl-menu-item" onClick={runMenuAction(() => doArchive(t.id))}><Archive size={14} /> Archive</button>
                                : <button className="tpl-menu-item" onClick={runMenuAction(() => doRestore(t.id))}><ArchiveRestore size={14} /> Restore</button>}
                              <button className="tpl-menu-item danger" onClick={runMenuAction(() => doDelete(t))}>
                                <Trash2 size={14} /> Delete
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="tpl-title-row">
                      <button type="button" className="tpl-title" onClick={() => startGenerate(t)} title={`Certify — ${t.name}`}>{t.name}</button>
                      <span className={`pill ${st.cls}`} style={{ padding: '1px 8px', fontSize: 11 }}>{st.label}</span>
                    </div>
                    {(t.ngo_name || t.purpose) && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, padding: '0 12px' }}>
                        {t.ngo_name && <span className="pill pill-blue" style={{ padding: '1px 8px', fontSize: 11 }}>{t.ngo_name}</span>}
                        {t.purpose && <span className="pill pill-yellow" style={{ padding: '1px 8px', fontSize: 11 }}>{t.purpose}</span>}
                      </div>
                    )}
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
                <TemplateMeta ngos={ngos} purposes={purposes} value={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} required />
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

                <TemplateMeta ngos={ngos} purposes={purposes} value={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />

                <div className="wiz-hint" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                  {draft.preview_image ? (
                    <img src={draft.preview_image} alt="template preview" style={{ width: 130, borderRadius: 8, border: '1px solid var(--line)', background: '#fff' }} />
                  ) : (
                    <div className="tpl-thumb-fallback" style={{ width: 130, height: 90, border: '1px dashed var(--line)', borderRadius: 8, fontSize: 11 }}>
                      {draft.file_format === 'pptx' ? <><Presentation size={18} color="#c2410c" /><span style={{ padding: 4 }}>Working… an auto snapshot renders shortly</span></> : <><FileText size={18} color="var(--sage)" /><span style={{ padding: 4 }}>Auto thumbnail renders shortly</span></>}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>Template image</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
                      Auto-generated from the first page/slide on Save; you can replace it with any image here.
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-sm" onClick={() => handlePreviewPick()} disabled={previewUploadBusy}>
                        {previewUploadBusy ? <Loader2 size={13} className="spin" /> : <UploadCloud size={13} />} {draft.preview_image ? 'Replace image' : 'Upload image'}
                      </button>
                    </div>
                  </div>
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
                      <label className="req" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="All fields are mandatory">
                        <input type="checkbox" checked disabled style={{ accentColor: 'var(--sage)' }} />
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
                      <button className="btn btn-sm btn-primary" onClick={() => saveFields(true)}>
                        <Wand2 size={14} /> Generate
                      </button>
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
            <input
              ref={previewInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.gif"
              hidden
              onChange={(e) => { handlePreviewUpload(e.target.files[0]); e.target.value = '' }}
            />
          </div>
        </div>
      )}

      {/* ================================== GENERATOR ================================== */}
      {view === 'generate' && genTpl && (
        <div className="gen-grid">
          <div className="card">
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="bulk-tabs">
                <button className={`btn btn-sm ${!bulkMode ? 'btn-primary' : ''}`} onClick={() => { setBulkMode(false); setBulkResult(null); setPreviewHtml(null); setPreviewImg(null) }}>
                  Single
                </button>
                <button className={`btn btn-sm ${bulkMode ? 'btn-primary' : ''}`} onClick={() => { setBulkMode(true); setBulkResult(null); setPreviewHtml(null); setPreviewImg(null) }}>
                  Bulk (many at once)
                </button>
              </div>

              {!bulkMode ? (
                <>
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
                </>
              ) : (
                <>
                  <div className="wiz-hint" style={{ fontSize: 12, margin: 0 }}>
                    Paste one name per line to create a row for each, then generate all certificates in one go. Each certificate gets its own number.
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,220px) 1fr', gap: 10, alignItems: 'start' }}>
                    <div className="field-block">
                      <label>Date <span className="bulk-shared-label">same for all</span></label>
                      <input
                        className="fld"
                        type="date"
                        value={bulkDate}
                        onChange={(e) => setBulkDate(e.target.value)}
                        title="Defaults to today's date. Past dates are allowed."
                      />
                      <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Defaults to today — past dates allowed</div>
                    </div>
                    <div className="field-block">
                      <label>Event / occasion <span className="bulk-shared-label">same for all</span></label>
                      <input
                        className="fld"
                        type="text"
                        placeholder="e.g. Annual Sports Day 2026"
                        value={bulkEvent}
                        onChange={(e) => setBulkEvent(e.target.value)}
                      />
                    </div>
                  </div>

                  {(!bulkRows.length) && (
                    <>
                      <div className="field-block">
                        <label>Names (one per line)</label>
                        <textarea
                          className="bulk-paste"
                          placeholder={`Example:\nRohan Mehta\nSneha Patil\nAarav Verma`}
                          value={bulkPaste}
                          onChange={(e) => setBulkPaste(e.target.value)}
                        />
                        <button className="btn btn-sm btn-primary" style={{ alignSelf: 'flex-start' }} onClick={applyBulkPaste}>
                          <Users size={14} /> Load names into rows
                        </button>
                      </div>
                      <button className="btn btn-sm" onClick={addBulkRow}><Plus size={14} /> Add empty row</button>
                    </>
                  )}

                  {bulkRows.length > 0 && (
                    <>
                      <div className="field-block">
                        <label>{bulkRows.length} row{bulkRows.length === 1 ? '' : 's'} — fill the values or adjust names{(bulkDateKey || bulkEventKey) && ' (Date & Event apply to all)'}</label>
                        <div className="bulk-table">
                          <table>
                            <thead>
                              <tr>
                                <th>#</th>
                                {(genTpl.fields || []).map((f) => (
                                  <th key={f.field_key}>{f.display_name || humanKey(f.field_key)}{f.required ? ' *' : ''}</th>
                                ))}
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {bulkRows.map((r, ri) => (
                                <tr key={ri}>
                                  <td style={{ color: 'var(--ink-soft)' }}>{ri + 1}</td>
                                  {(genTpl.fields || []).map((f) => {
                                  const sharedCell = f.field_key === bulkDateKey || f.field_key === bulkEventKey
                                  return (
                                    <td key={f.field_key}>
                                      {sharedCell ? (
                                        <span className="bulk-shared" title="Same for all rows — set it in the shared fields above">{r[f.field_key] || '—'}</span>
                                      ) : (
                                        <input
                                          type={inputTypeFor(f.field_type)}
                                          value={r[f.field_key] ?? ''}
                                          placeholder={humanKey(f.field_key)}
                                          onChange={(e) => patchBulkCell(ri, f.field_key, e.target.value)}
                                        />
                                      )}
                                    </td>
                                  )
                                })}
                                  <td><button className="btn btn-sm" onClick={() => removeBulkRow(ri)}><Trash2 size={13} /></button></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-sm" onClick={addBulkRow}><Plus size={14} /> Add row</button>
                        </div>
                      </div>

                      {bulkResult && (
                        <div className="bulk-result">
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                            {bulkResult.ok} generated · {bulkResult.failed} failed
                          </div>
                          {bulkResult.results.map((r) => (
                            r.certificate ? (
                              <div className="ok-row" key={r.index}>
                                <CheckCircle2 size={14} style={{ color: '#166534', flexShrink: 0 }} />
                                <span className="hist-num">{r.certificate_number}</span>
                                <span className="hist-recipient">{r.certificate.recipient_name || '—'}</span>
                                <span className="hist-actions">
                                  <button className="btn btn-sm" title="Open generated file" onClick={() => saveOrOpen(r.generated_file, `${r.certificate_number}.${genTpl.file_format}`)}>
                                    <ExternalLink size={13} />
                                  </button>
                                </span>
                              </div>
                            ) : (
                              <div className="ok-row" key={r.index} style={{ color: '#991b1b' }}>
                                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                                <span>Row {r.index + 1} — {r.error}</span>
                              </div>
                            )
                          ))}
                        </div>
                      )}

                      <button className="btn btn-primary" onClick={doBulkGenerate} disabled={bulkBusy}>
                        {bulkBusy ? <><span className="progress" /> Generating {bulkRows.length}…</> : <><Sparkles size={15} /> Generate all {bulkRows.length}</>}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="preview-wrap">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                Preview
                {bulkMode && bulkRows.length > 1 && (
                  <label style={{ fontWeight: 400, display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--ink-soft)' }}>
                    row
                    <select
                      value={Math.min(previewRowIdx, bulkRows.length - 1)}
                      onChange={(e) => { setPreviewRowIdx(Number(e.target.value)); setPreviewHtml(null); setPreviewImg(null) }}
                      style={{ padding: '3px 6px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 12, outline: 'none' }}
                    >
                      {bulkRows.map((_, i) => <option key={i} value={i}>{i + 1}</option>)}
                    </select>
                    of {bulkRows.length}
                  </label>
                )}
                {genTpl.file_format === 'pptx' && genTpl.preview_image && <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}>(template image)</span>}
              </div>
              <button
                className="btn btn-sm"
                onClick={() => handlePreviewPick(genTpl.id)}
                disabled={previewUploadBusy}
                title="Set the image shown for this template (needed to preview PowerPoint templates)"
              >
                {previewUploadBusy ? <Loader2 size={13} className="spin" /> : <UploadCloud size={13} />} {genTpl.preview_image ? 'Replace image' : 'Upload image'}
              </button>
            </div>
            {previewBusy && (
              <div className="preview-loading"><Loader2 size={13} className="spin" /> Updating preview…</div>
            )}
            {genTpl.file_format === 'pptx' && previewImg ? (
              <div className="cert-paper" style={{ padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg,#f3f4f6)' }}>
                <img src={previewImg} alt={genTpl.name} onError={() => { setPreviewImg(null) }} style={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain' }} />
              </div>
            ) : genTpl.file_format === 'docx' ? (
              previewHtml ? (
                <div className="cert-paper" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              ) : previewNote ? (
                <div className="cert-paper cert-fallback" style={{ color: '#991b1b' }}>
                  <div><AlertTriangle size={18} style={{ margin: '0 auto 8px', display: 'block' }} />{previewNote}</div>
                </div>
              ) : genTpl.preview_image ? (
                <div className="cert-paper" style={{ padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg,#f3f4f6)' }}>
                  <img src={genTpl.preview_image} alt={genTpl.name} style={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain' }} />
                </div>
              ) : (
                <div className="cert-paper cert-fallback" style={{ color: 'var(--ink-soft)' }}>
                  {missing.length ? 'Fill the required fields to preview.' : 'Generating preview…'}
                </div>
              )
            ) : genTpl.preview_image ? (
              <div className="cert-paper" style={{ padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg,#f3f4f6)' }}>
                <img src={genTpl.preview_image} alt={genTpl.name} style={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain' }} />
              </div>
            ) : (
              <div className="cert-paper cert-fallback">
                <Presentation size={26} style={{ color: '#c2410c' }} />
                <div><b>PPTX template</b> — as you type the required fields, the first slide renders here live.</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>It can take a moment on first load. You can also upload a screenshot as the resting preview image.</div>
                <button className="btn btn-sm" onClick={() => saveOrOpen(genTpl.template_file, `${genTpl.name}.${genTpl.file_format}`)}>
                  <Download size={14} /> Open base template
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {purposesOpen && (
        <div className="cert-overlay" onClick={() => setPurposesOpen(false)}>
          <div className="cert-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="cert-modal-head">
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Manage purposes</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>These appear in the purpose dropdown of every template.</div>
              </div>
              <button className="btn btn-sm" onClick={() => setPurposesOpen(false)}><X size={14} /></button>
            </div>
            <div className="cert-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="fld"
                  style={{ flex: 1, padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13.5, outline: 'none' }}
                  placeholder="e.g. Participation certificate"
                  value={purposeName}
                  maxLength={120}
                  onChange={(e) => setPurposeName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addPurpose() }}
                />
                <button className="btn btn-sm btn-primary" onClick={addPurpose} disabled={purposeBusy}>
                  <Plus size={14} /> Add
                </button>
              </div>
              <div style={{ maxHeight: 320, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {purposes.map((p) => (
                  <div key={String(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.name}</div>
                      {p.template_count > 0 && (
                        <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>{p.template_count} template{p.template_count === 1 ? '' : 's'} use this</div>
                      )}
                    </div>
                    <button className="btn btn-sm" onClick={() => removePurpose(p)} disabled={purposeBusy}><Trash2 size={13} /></button>
                  </div>
                ))}
                {purposes.length === 0 && (
                  <div className="cert-empty" style={{ padding: 18 }}>No purposes yet — add one above.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}