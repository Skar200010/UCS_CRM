import { useState, useEffect, useCallback } from 'react'
import { api } from '../../../api/auth'
import { ClipboardText, UsersThree, CalendarCheck, PlusCircle, UploadSimple, ArrowUpRight, ArrowsLeftRight, MagnifyingGlass, User, UserCircle, DeviceMobile, Envelope, House, Buildings, MapPin, IdentificationCard, Gift, Heart, Translate, CurrencyCircleDollar, Star, CreditCard, FileText, PushPin, CheckCircle, Circle, X, WarningCircle, ArrowDown } from '@phosphor-icons/react'
import DonorDetailModal from '../../../components/DonorDetailModal'

const ICON_SIZE = 16

const I = {
  ClipboardText: <ClipboardText size={ICON_SIZE} />,
  UsersThree: <UsersThree size={ICON_SIZE} />,
  CalendarCheck: <CalendarCheck size={ICON_SIZE} />,
  PlusCircle: <PlusCircle size={ICON_SIZE} weight="bold" />,
  UploadSimple: <UploadSimple size={ICON_SIZE} />,
  ArrowUpRight: <ArrowUpRight size={ICON_SIZE} />,
  ArrowsLeftRight: <ArrowsLeftRight size={ICON_SIZE} />,
  MagnifyingGlass: <MagnifyingGlass size={ICON_SIZE} />,
  User: <User size={ICON_SIZE} />,
  UserCircle: <UserCircle size={ICON_SIZE} />,
  DeviceMobile: <DeviceMobile size={ICON_SIZE} />,
  Envelope: <Envelope size={ICON_SIZE} />,
  House: <House size={ICON_SIZE} />,
  Buildings: <Buildings size={ICON_SIZE} />,
  MapPin: <MapPin size={ICON_SIZE} />,
  IdentificationCard: <IdentificationCard size={ICON_SIZE} />,
  Gift: <Gift size={ICON_SIZE} />,
  Heart: <Heart size={ICON_SIZE} weight="fill" />,
  Translate: <Translate size={ICON_SIZE} />,
  CurrencyCircleDollar: <CurrencyCircleDollar size={ICON_SIZE} />,
  Star: <Star size={ICON_SIZE} weight="fill" />,
  CreditCard: <CreditCard size={ICON_SIZE} />,
  FileText: <FileText size={ICON_SIZE} />,
  PushPin: <PushPin size={ICON_SIZE} weight="fill" />,
  CheckCircle: <CheckCircle size={ICON_SIZE} weight="fill" />,
  CircleGreen: <Circle size={12} weight="fill" color="#16a34a" />,
  CircleYellow: <Circle size={12} weight="fill" color="#d97706" />,
  CircleBlue: <Circle size={12} weight="fill" color="#2563eb" />,
  CircleRed: <Circle size={12} weight="fill" color="#dc2626" />,
  X: <X size={14} />,
  WarningCircle: <WarningCircle size={14} weight="fill" color="#dc2626" />,
}

const LABELS = {
  leads: { icon: ClipboardText, label: 'Leads' },
  donors: { icon: UsersThree, label: 'Donors' },
  followups: { icon: CalendarCheck, label: 'Follow-ups' },
}

function AddLeadModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', mobile: '', email: '', address: '', city: '', state: '', pan: '', aadhaar: '', birthday: '', anniversary: '', language: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    if (!form.name || !form.mobile) { setErr('Name and Mobile are required'); return }
    setSaving(true); setErr('')
    try {
      await api('/ngo-admin/donor-crm/leads', { method: 'POST', body: JSON.stringify(form), _prefix: 'ucs' })
      onSaved(); onClose()
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-head"><h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{I.PlusCircle} Add New Lead</h3><button className="modal-close" onClick={onClose}>{I.X}</button></div>
        <div className="modal-body">
          {err && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{err}</div>}
          <div className="form-row">
            <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{I.UserCircle} Name <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></label>
            <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{I.DeviceMobile} Mobile <input value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} /></label>
          </div>
          <div className="form-row">
            <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{I.Envelope} Email <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></label>
            <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{I.Translate} Language <input value={form.language} onChange={e => setForm({...form, language: e.target.value})} /></label>
          </div>
          <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{I.House} Address <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></label>
          <div className="form-row">
            <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{I.Buildings} City <input value={form.city} onChange={e => setForm({...form, city: e.target.value})} /></label>
            <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{I.MapPin} State <input value={form.state} onChange={e => setForm({...form, state: e.target.value})} /></label>
          </div>
          <div className="form-row">
            <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{I.IdentificationCard} PAN <input value={form.pan} onChange={e => setForm({...form, pan: e.target.value})} /></label>
            <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{I.IdentificationCard} Aadhaar <input value={form.aadhaar} onChange={e => setForm({...form, aadhaar: e.target.value})} /></label>
          </div>
          <div className="form-row">
            <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{I.Gift} Birthday <input type="date" value={form.birthday} onChange={e => setForm({...form, birthday: e.target.value})} /></label>
            <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{I.Heart} Anniversary <input type="date" value={form.anniversary} onChange={e => setForm({...form, anniversary: e.target.value})} /></label>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{saving ? 'Saving...' : <>{I.CheckCircle} Save Lead</>}</button>
        </div>
      </div>
    </div>
  )
}

function ImportModal({ onClose, onImported }) {
  const [file, setFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState(null)

  const handleImport = async () => {
    if (!file) return
    setImporting(true); setErr(''); setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api('/ngo-admin/donor-crm/leads/import', { method: 'POST', body: fd, _prefix: 'ucs' })
      setResult(res)
      if (res.count > 0) { setTimeout(() => { onImported(); onClose() }, 1500) }
    } catch (e) { setErr(e.message) } finally { setImporting(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{I.UploadSimple} Import Leads</h3><button className="modal-close" onClick={onClose}>{I.X}</button></div>
        <div className="modal-body">
          {err && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{err}</div>}
          <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 12 }}>
            Upload CSV/Excel file with columns: <strong>name, mobile, email, city</strong>
          </p>
          <label className="field">File <input type="file" accept=".xlsx,.xls,.csv" onChange={e => setFile(e.target.files[0])} /></label>
          {result && (
            <div style={{ marginTop: 12, padding: 12, background: '#dcfce7', borderRadius: 8, color: '#166534', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              {I.CheckCircle} {result.count} leads imported successfully
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleImport} disabled={importing || !file} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {importing ? 'Importing...' : <>{I.UploadSimple} Import</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function AssignModal({ leads, onClose, onAssigned }) {
  const [selected, setSelected] = useState([])
  const [froId, setFroId] = useState('')
  const [froWorkers, setFroWorkers] = useState([])
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    api('/ngo-admin/fro-workers', { _prefix: 'ucs' }).then(setFroWorkers).catch(() => {})
  }, [])

  const toggleAll = () => { setSelected(selected.length === leads.length ? [] : leads.map(l => l.id)) }
  const toggle = (id) => { setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]) }

  const assign = async () => {
    if (!selected.length || !froId) return
    setAssigning(true)
    try {
      await api('/ngo-admin/donor-crm/leads/assign', { method: 'PUT', body: JSON.stringify({ lead_ids: selected, fro_worker_id: parseInt(froId) }), _prefix: 'ucs' })
      onAssigned(); onClose()
    } catch (e) { alert(e.message) } finally { setAssigning(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="modal-head"><h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{I.ArrowUpRight} Assign Leads to FRO</h3><button className="modal-close" onClick={onClose}>{I.X}</button></div>
        <div className="modal-body">
          <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{I.User} Select FRO Worker
            <select value={froId} onChange={e => setFroId(e.target.value)}>
              <option value="">— Select FRO —</option>
              {froWorkers.map(w => <option key={w.id} value={w.id}>{w.name} ({w.login_id})</option>)}
            </select>
          </label>
          <div style={{ marginTop: 12, maxHeight: 300, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)', background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={selected.length === leads.length && leads.length > 0} onChange={toggleAll} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>{selected.length} of {leads.length} selected</span>
            </div>
            {leads.map(l => (
              <div key={l.id} style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={selected.includes(l.id)} onChange={() => toggle(l.id)} />
                <span style={{ flex: 1, fontSize: 13 }}>{l.name}</span>
                <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{l.phone}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={assign} disabled={assigning || !selected.length || !froId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {assigning ? 'Assigning...' : <>{I.ArrowUpRight} Assign ({selected.length})</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function TransferModal({ leads, onClose, onTransferred }) {
  const [selected, setSelected] = useState([])
  const [targetFro, setTargetFro] = useState('')
  const [targetStation, setTargetStation] = useState('')
  const [froWorkers, setFroWorkers] = useState([])
  const [transferring, setTransferring] = useState(false)

  useEffect(() => {
    api('/ngo-admin/fro-workers', { _prefix: 'ucs' }).then(setFroWorkers).catch(() => {})
  }, [])

  const toggle = (id) => { setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]) }

  const transfer = async () => {
    if (!selected.length) return
    if (!targetFro && !targetStation) return
    setTransferring(true)
    try {
      await Promise.all(selected.map(id =>
        api(`/ngo-admin/donor-crm/leads/${id}/transfer`, { method: 'PUT', body: JSON.stringify({ target_fro_worker_id: targetFro || undefined, target_station: targetStation || undefined }), _prefix: 'ucs' })
      ))
      onTransferred(); onClose()
    } catch (e) { alert(e.message) } finally { setTransferring(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="modal-head"><h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{I.ArrowsLeftRight} Transfer Leads</h3><button className="modal-close" onClick={onClose}>{I.X}</button></div>
        <div className="modal-body">
          <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{I.User} Transfer to FRO <select value={targetFro} onChange={e => setTargetFro(e.target.value)}>
            <option value="">— Same FRO —</option>
            {froWorkers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select></label>
          <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{I.MapPin} Transfer to Station <input value={targetStation} onChange={e => setTargetStation(e.target.value)} placeholder="e.g. U-3" /></label>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-soft)' }}>{selected.length} lead(s) selected</div>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={transfer} disabled={transferring || !selected.length} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {transferring ? 'Transferring...' : <>{I.ArrowsLeftRight} Transfer</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function DuplicatePanel({ duplicates, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: '80vh' }}>
        <div className="modal-head"><h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{I.MagnifyingGlass} Duplicate Detection</h3><button className="modal-close" onClick={onClose}>{I.X}</button></div>
        <div className="modal-body">
          {duplicates.length === 0 ? (
            <p style={{ color: 'var(--ink-soft)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>{I.CheckCircle} No duplicates found</p>
          ) : (
            duplicates.map((group, i) => (
              <div key={i} style={{ marginBottom: 16, border: '1px solid #fecaca', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px', background: '#fef2f2', color: '#991b1b', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {I.WarningCircle} {group[0].mobile_number || group[0].name} — {group.length} records
                </div>
                <table style={{ width: '100%', fontSize: 12 }}>
                  <thead><tr style={{ background: 'var(--bg)' }}>
                    <th style={{ padding: 6 }}>Name</th><th style={{ padding: 6 }}>Mobile</th><th style={{ padding: 6 }}>City</th><th style={{ padding: 6 }}>Amount</th>
                  </tr></thead>
                  <tbody>
                    {group.map(d => (
                      <tr key={d.id}>
                        <td style={{ padding: 6 }}>{d.name}</td>
                        <td style={{ padding: 6 }}>{d.mobile_number}</td>
                        <td style={{ padding: 6 }}>{d.city || '—'}</td>
                        <td style={{ padding: 6 }}>₹{Number(d.amount || 0).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
        <div className="modal-actions"><button className="btn" onClick={onClose}>Close</button></div>
      </div>
    </div>
  )
}

function Pagination({ page, totalPages, total, onChange, pageSize, onPageSizeChange }) {
  if (totalPages <= 1) return null
  const start = Math.max(1, Math.min(page - 2, totalPages - 4))
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '16px 20px', borderTop: '1px solid var(--line)', flexWrap: 'wrap' }}>
      <button className="btn btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>‹ Prev</button>
      {start > 1 && <><button className="btn btn-sm" onClick={() => onChange(1)}>1</button><span style={{ color: 'var(--ink-soft)', fontSize: 12 }}>…</span></>}
      {pages.map(p => (
        <button key={p} className="btn btn-sm" onClick={() => onChange(p)}
          style={p === page ? { background: 'var(--sage)', color: '#fff', borderColor: 'var(--sage)', fontWeight: 700 } : {}}>{p}</button>
      ))}
      {start + 4 < totalPages && <><span style={{ color: 'var(--ink-soft)', fontSize: 12 }}>…</span><button className="btn btn-sm" onClick={() => onChange(totalPages)}>{totalPages}</button></>}
      <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next ›</button>
      <span style={{ fontSize: 12, color: 'var(--ink-soft)', marginLeft: 8 }}>{total} total</span>
      {onPageSizeChange && (
        <select value={pageSize} onChange={e => onPageSizeChange(Number(e.target.value))}
          style={{ marginLeft: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 12, fontFamily: 'inherit' }}>
          <option value={15}>15 / page</option>
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>
      )}
    </div>
  )
}

export default function DonorCRM() {
  const [tab, setTab] = useState('leads')
  const [leads, setLeads] = useState([])
  const [donors, setDonors] = useState([])
  const [followups, setFollowups] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [donorPage, setDonorPage] = useState(1)
  const [donorPageSize, setDonorPageSize] = useState(15)
  const [donorTotalPages, setDonorTotalPages] = useState(1)
  const [donorTotal, setDonorTotal] = useState(0)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [showDonorDetail, setShowDonorDetail] = useState(null)
  const [duplicates, setDuplicates] = useState([])
  const [err, setErr] = useState('')
  const [selectedNgoId, setSelectedNgoId] = useState('all')
  const [accessibleNgos, setAccessibleNgos] = useState([])

  useEffect(() => {
    api('/ngo-admin/ngos', { _prefix: 'ucs' }).then(setAccessibleNgos).catch(() => {});
  }, []);

  const loadLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, page_size: pageSize })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (dateFrom) params.set('from_date', dateFrom)
      if (dateTo) params.set('to_date', dateTo)
      const res = await api(`/ngo-admin/donor-crm/leads?${params}`, { _prefix: 'ucs' })
      setLeads(res.data || [])
      setTotal(res.pagination?.total || 0)
      setTotalPages(res.pagination?.totalPages || 1)
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }, [page, pageSize, search, statusFilter, dateFrom, dateTo])

  const loadDonors = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: donorPage, page_size: donorPageSize })
      if (search) params.set('search', search)
      if (dateFrom) params.set('from_date', dateFrom)
      if (dateTo) params.set('to_date', dateTo)
      if (selectedNgoId !== 'all') params.set('ngo_id', selectedNgoId)
      const res = await api(`/ngo-admin/donors?${params}&paginated=true`, { _prefix: 'ucs' })
      setDonors(res.data || [])
      setDonorTotal(res.pagination?.total || 0)
      setDonorTotalPages(res.pagination?.totalPages || 1)
    } catch (e) { /* ignore */ }
  }, [donorPage, donorPageSize, search, dateFrom, dateTo, selectedNgoId])

  useEffect(() => {
    if (tab === 'leads') loadLeads()
    else if (tab === 'donors') loadDonors()
  }, [tab, loadLeads, loadDonors])

  useEffect(() => { setPage(1) }, [search, statusFilter, dateFrom, dateTo, pageSize])
  useEffect(() => { setDonorPage(1) }, [search, dateFrom, dateTo, donorPageSize])

  const loadDuplicates = async () => {
    try {
      const d = await api('/ngo-admin/donor-crm/duplicates', { _prefix: 'ucs' })
      setDuplicates(d || []); setShowDuplicates(true)
    } catch (e) { setErr(e.message) }
  }

  const tabCounts = { leads: total, donors: donorTotal, followups: 0 }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h3>{I.Heart} Donor CRM</h3>
          <div className="page-sub">Manage leads, donors, and follow-ups</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'leads' && (
            <>
              <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{I.PlusCircle} Add Lead</button>
              <button className="btn" onClick={() => setShowImportModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{I.UploadSimple} Import</button>
            </>
          )}
        </div>
      </div>

      <div className="filter-bar">
        <span style={{fontSize:13, fontWeight:600, color:'var(--ink-soft)'}}>NGO:</span>
        <select value={selectedNgoId} onChange={e => setSelectedNgoId(e.target.value)}>
          <option value="all">All NGOs</option>
          {accessibleNgos.map(ngo => (
            <option key={ngo.id} value={ngo.id}>{ngo.name}</option>
          ))}
        </select>
      </div>

      <div className="filter-bar">
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-soft)', display: 'flex' }}>{I.MagnifyingGlass}</span>
          <input placeholder="Search name, mobile..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 34, width: '100%' }} />
        </div>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From date" />
        <span style={{ color: 'var(--ink-soft)', fontSize: 13 }}>→</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} title="To date" />
        {tab === 'leads' && (
          <>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="assigned">Assigned</option>
              <option value="transferred">Transferred</option>
              <option value="rejected">Rejected</option>
            </select>
            <button className="btn" onClick={() => setShowAssignModal(true)} disabled={!leads.length} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{I.ArrowUpRight} Assign</button>
            <button className="btn" onClick={() => setShowTransferModal(true)} disabled={!leads.length} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{I.ArrowsLeftRight} Transfer</button>
            <button className="btn" onClick={loadDuplicates} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{I.MagnifyingGlass} Duplicates</button>
          </>
        )}
      </div>

      {err && <div className="err-card">{err}</div>}

      <div className="tabs">
        {Object.entries(LABELS).map(([key, v]) => {
          const Icon = v.icon
          const count = tabCounts[key] || 0
          return (
            <button key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
              <Icon size={ICON_SIZE} /> {v.label}
              <span className="tab-badge">{count}</span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="loading" style={{ padding: 60 }}>Loading...</div>
      ) : tab === 'leads' ? (
        <div className="card" style={{ overflow: 'auto' }}>
          <table className="table">
            <thead>
              <tr><th><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{I.UserCircle} Name</span></th><th><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{I.DeviceMobile} Mobile</span></th><th><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{I.Envelope} Email</span></th><th><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{I.Buildings} City</span></th><th><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{I.PushPin} Status</span></th><th><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{I.CalendarCheck} Created</span></th></tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr><td colSpan={6} className="empty-state">No leads found</td></tr>
              ) : leads.map(l => (
                <tr key={l.id}>
                  <td><strong>{l.name}</strong></td>
                  <td>{l.phone}</td>
                  <td style={{ color: 'var(--ink-soft)' }}>{l.email || '—'}</td>
                  <td style={{ color: 'var(--ink-soft)' }}>{l.city || '—'}</td>
                  <td>
                    <span className={`pill ${l.status === 'assigned' ? 'pill-green' : l.status === 'transferred' ? 'pill-blue' : l.status === 'rejected' ? 'pill-red' : 'pill-yellow'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {l.status === 'assigned' ? <>{I.CircleGreen} Assigned</> : l.status === 'transferred' ? <>{I.CircleBlue} Transferred</> : l.status === 'rejected' ? <>{I.CircleRed} Rejected</> : <>{I.CircleYellow} Pending</>}
                    </span>
                  </td>
                  <td style={{ color: 'var(--ink-soft)', fontSize: 12 }}>{l.created_at?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} />
        </div>
      ) : tab === 'donors' ? (
        <div className="card" style={{ overflow: 'auto' }}>
          <table className="table">
            <thead>
              <tr><th><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{I.UserCircle} Name</span></th><th><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{I.DeviceMobile} Mobile</span></th><th><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{I.Buildings} NGO(s)</span></th><th><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{I.Star} Last</span></th><th><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{I.CurrencyCircleDollar} Total</span></th><th><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{I.CalendarCheck} Last Donation</span></th><th></th></tr>
            </thead>
            <tbody>
              {donors.length === 0 ? (
                <tr><td colSpan={7} className="empty-state">No donors found</td></tr>
              ) : donors.map((d, idx) => (
                <tr key={d.mobile_number || idx}>
                  <td><strong>{d.name}</strong></td>
                  <td>{d.mobile_number}</td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {(d.ngo_list || [d.ngo]).map(ngo => (
                        <span key={ngo} style={{ fontSize: 11, fontWeight: 600, background: '#5B6B4E12', color: 'var(--sage)', padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}>{ngo}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ fontWeight: 600, color: '#7c3aed' }}>₹{Number(d.last_transaction_amount || 0).toLocaleString('en-IN')}</td>
                  <td style={{ fontWeight: 600 }}>₹{Number(d.total_amount || d.amount || 0).toLocaleString('en-IN')}</td>
                  <td style={{ color: 'var(--ink-soft)', fontSize: 12 }}>{d.last_transaction_date || d.last_donation_date?.slice(0, 10) || '—'}</td>
                  <td><button className="btn btn-sm" onClick={() => setShowDonorDetail(d.id)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{I.User} View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={donorPage} totalPages={donorTotalPages} total={donorTotal} onChange={setDonorPage} pageSize={donorPageSize} onPageSizeChange={setDonorPageSize} />
        </div>
      ) : (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <p style={{ color: 'var(--ink-soft)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {I.CalendarCheck} Follow-up tracking will appear here once scheduled through FRO assignments.
          </p>
        </div>
      )}

      {showAddModal && <AddLeadModal onClose={() => setShowAddModal(false)} onSaved={loadLeads} />}
      {showImportModal && <ImportModal onClose={() => setShowImportModal(false)} onImported={loadLeads} />}
      {showAssignModal && <AssignModal leads={leads} onClose={() => setShowAssignModal(false)} onAssigned={loadLeads} />}
      {showTransferModal && <TransferModal leads={leads} onClose={() => setShowTransferModal(false)} onTransferred={loadLeads} />}
      {showDuplicates && <DuplicatePanel duplicates={duplicates} onClose={() => setShowDuplicates(false)} />}
      {showDonorDetail && <DonorDetailModal donorId={showDonorDetail} onClose={() => setShowDonorDetail(null)} />}

      <style>{`
        .page { padding:24px; max-width:1400px; margin:0 auto; }
        .page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:24px; flex-wrap:wrap; gap:12px; }
        .page-header h3 { margin:0; font-size:22px; font-weight:700; display:flex; align-items:center; gap:10px; }
        .page-sub { font-size:13px; color:var(--ink-soft); margin-top:4px; }
        .tabs { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:20px; padding-bottom:16px; border-bottom:1px solid var(--line); }
        .tab { display:flex; align-items:center; gap:8px; padding:10px 20px; border:none; border-radius:10px; background:var(--bg); cursor:pointer; font-size:14px; font-weight:600; color:var(--ink-soft); font-family:inherit; transition:all .2s; }
        .tab:hover { background:#e8ece9; color:var(--ink); transform:translateY(-1px); }
        .tab.active { background:var(--sage); color:#fff; box-shadow:0 2px 8px rgba(91,107,78,0.25); }
        .tab-badge { font-size:11px; font-weight:700; background:rgba(0,0,0,.08); padding:2px 9px; border-radius:99px; margin-left:3px; }
        .tab.active .tab-badge { background:rgba(255,255,255,.25); }
        .filter-bar { display:flex; gap:10px; align-items:center; margin-bottom:20px; flex-wrap:wrap; }
        .filter-bar input, .filter-bar select { padding:9px 14px; border:1.5px solid var(--line); border-radius:10px; font-size:13px; font-family:inherit; background:#fff; transition:border-color .2s; }
        .filter-bar input:focus, .filter-bar select:focus { outline:none; border-color:var(--sage); box-shadow:0 0 0 3px rgba(91,107,78,0.12); }
        .card { background:#fff; border:1px solid var(--line); border-radius:14px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.04); }
        table.table { width:100%; border-collapse:collapse; font-size:13px; }
        table.table thead th { padding:12px 14px; background:#f8f9f8; font-weight:600; color:var(--ink-soft); font-size:12px; text-transform:uppercase; letter-spacing:.4px; border-bottom:1px solid var(--line); text-align:left; }
        table.table tbody td { padding:10px 14px; border-bottom:1px solid #f0f2f0; }
        table.table tbody tr:last-child td { border-bottom:none; }
        table.table tbody tr:hover { background:#f6f8f6; }
        .err-card { background:#fef2f2; border:1px solid #fecaca; color:#991b1b; padding:12px 16px; border-radius:10px; font-size:13px; margin-bottom:16px; }
        .stat-card { background:#fff; border:1px solid var(--line); border-radius:10px; padding:12px 14px; }
        .stat-label { font-size:10px; color:var(--ink-soft); text-transform:uppercase; letter-spacing:.5px; font-weight:700; margin-bottom:4px; }
        .stat-value { font-size:18px; font-weight:800; color:var(--ink); }
        .empty-state { text-align:center; padding:48px 20px; color:var(--ink-soft); font-size:14px; }
        .modal-head h3 { font-size:16px; font-weight:700; display:flex; align-items:center; gap:8px; }
        .modal-body { padding:20px 24px; }
        .modal-actions { padding:16px 24px; gap:10px; }
      `}</style>
    </div>
  )
}
