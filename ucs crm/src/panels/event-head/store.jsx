import { api } from '../../api/auth'
export const apiGet = (path) => api(path, { _prefix: 'ucs' })
export const apiPost = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body), _prefix: 'ucs' })
export const apiDelete = (path) => api(path, { method: 'DELETE', _prefix: 'ucs' })
export const apiPut = (path, body) => api(path, { method: 'PUT', body: JSON.stringify(body), _prefix: 'ucs' })

const PALETTE = ['#7B5EA7','#B5603A','#C08A2E','#4F6472','#5B6B4E','#88693D','#3485D4'];
export const avatarColor = (name) => {
  let h = 0; for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
};
export const initials = (n) => (n||'').trim().split(/\s+/).map(w => w[0]).slice(0,2).join('').toUpperCase();

/* ── Events ── */
export const fetchEvents = (params = {}) => {
  const qs = new URLSearchParams()
  if (params.ngo_id) qs.set('ngo_id', params.ngo_id)
  if (params.sector_id) qs.set('sector_id', params.sector_id)
  if (params.activity_id) qs.set('activity_id', params.activity_id)
  if (params.status) qs.set('status', params.status)
  if (params.month) qs.set('month', params.month)
  if (params.year) qs.set('year', params.year)
  const q = qs.toString()
  return apiGet('/event-head/events' + (q ? '?' + q : ''))
}
export const fetchEventById = (id) => apiGet('/event-head/events/' + id)
export const createEvent = (data) => apiPost('/event-head/events', data)
export const uploadEventBanner = (formData) => api('/event-head/events/banner/upload', { method: 'POST', body: formData, _prefix: 'ucs', timeout: 120000 })
export const suggestEventSpelling = (fields) => apiPost('/event-head/events/spell-check', { fields })
export const updateEvent = (id, data) => apiPut('/event-head/events/' + id, data)
export const deleteEvent = (id) => apiDelete('/event-head/events/' + id)
export const cleanupEvents = (filters) => apiPost('/event-head/events/cleanup', filters)
export const fetchEventDashboard = () => apiGet('/event-head/events/dashboard')

/* ── Dashboard ──
 * Built ONLY from the Event Head endpoints that are deployed and working, so it
 * never 404s. Primary source: /event-head/events (full enriched event list).
 * If that endpoint is unavailable, events are assembled per-NGO from the
 * original /event-head/events/ngo/:id routes. NGO names come from the Event
 * Head NGO endpoint, else the shared /ngos endpoint, else the events themselves.
 * Every figure is computed from REAL event data using the same filter + status
 * semantics as the server-side dashboard. No hardcoded/fake figures.
 */
const pad2 = (n) => String(n).padStart(2, '0')
const toYmd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const idEquals = (a, b) => a != null && b != null && String(a) === String(b)
const NOT_HAPPENING = ['Cancelled', 'Postponed']
const asArray = (x) => (Array.isArray(x) ? x : [])

const monthWindow = (month, year) => {
  if (month) {
    const m = Number(month)
    if (!(m >= 1 && m <= 12)) return null
    const y = year ? Number(year) : new Date().getFullYear()
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${pad2(m + 1)}-01`
    return { from: `${y}-${pad2(m)}-01`, to: next }
  }
  if (year) {
    const y = Number(year)
    if (Number.isFinite(y)) return { from: `${y}-01-01`, to: `${y + 1}-01-01` }
  }
  return null
}

const buildContext = (events, ngos, sectors, activities) => {
  const ngoMap = {}, sectorMap = {}, activityMap = {}
  for (const n of ngos) if (n && n.id != null) ngoMap[String(n.id)] = n.name || n.code
  for (const s of sectors) if (s && s.id != null) sectorMap[String(s.id)] = s.name || s.title
  for (const a of activities) if (a && a.id != null) activityMap[String(a.id)] = a.name || a.title
  for (const e of events) {
    if (e.ngo_id != null && !ngoMap[String(e.ngo_id)]) ngoMap[String(e.ngo_id)] = e.ngo_name || null
    if (e.sector_id != null && !sectorMap[String(e.sector_id)]) sectorMap[String(e.sector_id)] = e.sector_name || null
    if (e.activity_id != null && !activityMap[String(e.activity_id)]) activityMap[String(e.activity_id)] = e.activity_name || null
  }
  return { ngoMap, sectorMap, activityMap }
}

const byName = (a, b) => (a.name || '').localeCompare(b.name || '')

// Events: primary = enriched list from /event-head/events.
// Fallback = join the per-NGO lists from /event-head/events/ngo/:id (original routes).
async function loadEvents() {
  try {
    const r = await fetchEvents()
    if (Array.isArray(r)) return r
  } catch {}
  let ngos = []
  try {
    const r = await fetchNGOs()
    if (Array.isArray(r)) ngos = r
  } catch {}
  if (ngos.length) {
    const rows = await Promise.all(ngos
      .filter(n => n && (n.id != null || n.ngo_id != null))
      .map(n => fetchEventsByNgo(n.id ?? n.ngo_id).catch(() => null)))
    const merged = []
    const seen = new Set()
    for (const row of rows) for (const e of asArray(row)) {
      if (e && e.id != null && !seen.has(String(e.id))) { seen.add(String(e.id)); merged.push(e) }
    }
    if (merged.length) return merged
  }
  throw new Error('Event Head events API is unavailable. Check the server connection or your login.')
}

// NGO list: Event Head endpoint → shared /ngos endpoint → derived from events.
async function loadNgos(events) {
  let list = []
  try { list = asArray(await fetchWorkspaceNgos()) } catch {}
  if (!list.length) { try { list = asArray(await fetchNGOs()) } catch {} }
  const byId = new Map()
  for (const n of list) {
    if (n == null || (n.id == null && n.ngo_id == null)) continue
    const id = n.id ?? n.ngo_id
    byId.set(String(id), { id, name: n.name || n.ngo_name || n.code || `NGO ${id}`, code: n.code || null })
  }
  for (const e of asArray(events)) {
    if (e.ngo_id == null) continue
    const k = String(e.ngo_id)
    if (!byId.has(k)) byId.set(k, { id: e.ngo_id, name: e.ngo_name || `NGO ${k}`, code: null })
  }
  return [...byId.values()].sort(byName)
}

// Sector list: Event Head sector endpoint → derived from events.
async function loadSectors(events) {
  let list = []
  try { list = asArray(await fetchSectors()) } catch {}
  const byId = new Map()
  for (const s of list) {
    if (s == null || (s.id == null && s.sector_id == null)) continue
    const id = s.id ?? s.sector_id
    byId.set(String(id), { id, name: s.name || s.sector_name || `Sector ${id}`, is_active: s.is_active !== false, activity_count: +s.activity_count || 0, event_count: +s.event_count || 0 })
  }
  for (const e of asArray(events)) {
    if (e.sector_id == null) continue
    const k = String(e.sector_id)
    if (!byId.has(k)) byId.set(k, { id: e.sector_id, name: e.sector_name || `Sector ${k}`, is_active: true, activity_count: 0, event_count: 0 })
  }
  return [...byId.values()].sort(byName)
}

// Activity list: Event Head activity endpoint → derived from events.
async function loadActivities(events) {
  let list = []
  try { list = asArray(await fetchActivities()) } catch {}
  const byId = new Map()
  for (const a of list) {
    if (a == null || (a.id == null && a.activity_id == null)) continue
    const id = a.id ?? a.activity_id
    byId.set(String(id), { id, name: a.name || a.activity_name || `Activity ${id}`, sector_id: a.sector_id ?? null, ngo_id: a.ngo_id ?? null })
  }
  for (const e of asArray(events)) {
    if (e.activity_id == null) continue
    const k = String(e.activity_id)
    if (!byId.has(k)) byId.set(k, { id: e.activity_id, name: e.activity_name || `Activity ${k}`, sector_id: e.sector_id ?? null, ngo_id: e.ngo_id ?? null })
  }
  return [...byId.values()].sort(byName)
}

export async function fetchDashboardOptions() {
  const evs = await loadEvents().catch(() => [])
  const [ngos, sectors, activities] = await Promise.all([
    loadNgos(evs),
    loadSectors(evs),
    loadActivities(evs),
  ])
  return { ngos, sectors, activities }
}

export async function fetchDashboardStats(params = {}) {
  const { ngo_id, sector_id, activity_id, month, year } = params
  const events = await loadEvents()
  const [ngos, sectors, activities] = await Promise.all([
    loadNgos(events),
    loadSectors(events),
    loadActivities(events),
  ])
  const ctx = buildContext(events, ngos, sectors, activities)
  const enrich = (e) => ({
    ...e,
    ngo_name: e.ngo_name || (e.ngo_id != null ? ctx.ngoMap[String(e.ngo_id)] || null : null),
    sector_name: e.sector_name || (e.sector_id != null ? ctx.sectorMap[String(e.sector_id)] || null : null),
    activity_name: e.activity_name || (e.activity_id != null ? ctx.activityMap[String(e.activity_id)] || null : null),
  })

  const bounds = monthWindow(month, year)
  const inWindow = (e) => !bounds || (!!e.date && e.date >= bounds.from && e.date < bounds.to)
  const validNgo = (e) => !ngo_id || (e.ngo_id != null && idEquals(e.ngo_id, ngo_id))
  const validSector = (e) => !sector_id || (e.sector_id != null && idEquals(e.sector_id, sector_id))
  const validActivity = (e) => !activity_id || (e.activity_id != null && idEquals(e.activity_id, activity_id))

  const core = events.filter(e => validNgo(e) && validSector(e) && validActivity(e) && inWindow(e))
  const byNgo = events.filter(e => validSector(e) && validActivity(e) && inWindow(e))
  const sectorSummary = events.filter(e => validNgo(e) && inWindow(e))

  const now = new Date()
  const todayStr = toYmd(now)
  const weekDay = (now.getDay() + 6) % 7
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - weekDay)
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const inRange = (e, start, end) => !!e.date && e.date >= toYmd(start) && e.date < toYmd(end)
  const isUpcoming = (e) => e.status === 'Approved' && !!e.date && e.date >= todayStr
  const isToday = (e) => e.date === todayStr && !NOT_HAPPENING.includes(e.status)
  const byDate = (a, b) => (a.date || '').localeCompare(b.date || '')
  const byTime = (a, b) => byDate(a, b) || (a.start_time || '').localeCompare(b.start_time || '')

  const todayEvents = core.filter(isToday).sort(byTime)
  const upcomingEvents = core.filter(isUpcoming).sort(byDate)
  const weekEvents = core.filter(e => isUpcoming(e) && inRange(e, weekStart, weekEnd)).sort(byDate)
  const inMonth = core.filter(e => inRange(e, monthStart, monthEnd))

  // NGO summary (updates with Sector / Month / Year filters, NGO filter excluded).
  const ngoRows = {}
  for (const n of ngos) if (n && n.id != null) ngoRows[String(n.id)] = { ngo_id: n.id, ngo_name: n.name || n.code, count: 0 }
  for (const e of byNgo) {
    if (e.ngo_id == null) continue
    const key = String(e.ngo_id)
    if (!ngoRows[key]) ngoRows[key] = { ngo_id: e.ngo_id, ngo_name: ctx.ngoMap[key] || e.ngo_name || `NGO ${key}`, count: 0 }
    ngoRows[key].count += 1
  }
  const events_by_ngo = Object.values(ngoRows).sort((x, y) => y.count - x.count || (x.ngo_name || '').localeCompare(y.ngo_name || ''))

  // Sector grid (Sector / Activity filters excluded; NGO filter included).
  const sectorRows = {}
  for (const s of sectors) if (s && s.id != null) sectorRows[String(s.id)] = { id: s.id, name: s.name || `Sector ${s.id}`, is_active: s.is_active !== false, activity_count: 0, event_count: 0 }
  for (const e of sectorSummary) {
    if (e.sector_id == null) continue
    const key = String(e.sector_id)
    if (!sectorRows[key]) sectorRows[key] = { id: e.sector_id, name: ctx.sectorMap[key] || e.sector_name || `Sector ${key}`, is_active: true, activity_count: 0, event_count: 0 }
    sectorRows[key].event_count += 1
  }
  const sectorActivityCounts = {}
  for (const a of activities) {
    if (a.sector_id == null) continue
    if (ngo_id && a.ngo_id != null && !idEquals(a.ngo_id, ngo_id)) continue
    sectorActivityCounts[String(a.sector_id)] = (sectorActivityCounts[String(a.sector_id)] || 0) + 1
  }
  for (const key of Object.keys(sectorRows)) sectorRows[key].activity_count = sectorActivityCounts[key] || 0
  const events_by_sector = Object.values(sectorRows)
    .filter(s => s.is_active !== false)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

  // Activities with upcoming events.
  const activityIdx = {}
  for (const a of activities) if (a && a.id != null) activityIdx[String(a.id)] = a
  const upcomingCounts = {}
  const nextDates = {}
  for (const e of upcomingEvents) {
    if (e.activity_id == null) continue
    const key = String(e.activity_id)
    upcomingCounts[key] = (upcomingCounts[key] || 0) + 1
    if (!nextDates[key] || e.date < nextDates[key]) nextDates[key] = e.date
  }
  const activities_with_upcoming_events = Object.keys(upcomingCounts)
    .map((key) => {
      const row = activityIdx[key]
      const sample = events.find(e => e.activity_id != null && String(e.activity_id) === key)
      const ngoName = row != null
        ? (row.ngo_id != null ? (ctx.ngoMap[String(row.ngo_id)] || null) : 'All NGOs')
        : (sample && sample.ngo_id != null ? (ctx.ngoMap[String(sample.ngo_id)] || sample.ngo_name || null) : null)
      return {
        activity_id: row ? row.id : Number(key),
        activity_name: (row && row.name) || (sample ? (ctx.activityMap[key] || sample.activity_name || null) : null),
        sector_id: (row && row.sector_id) || (sample ? sample.sector_id : null),
        sector_name: (row && row.sector_id != null ? (ctx.sectorMap[String(row.sector_id)] || null) : null) || (sample && sample.sector_id != null ? (ctx.sectorMap[String(sample.sector_id)] || sample.sector_name || null) : null),
        ngo_id: row ? row.ngo_id : null,
        ngo_name: ngoName,
        upcoming_count: upcomingCounts[key],
        next_event_date: nextDates[key],
      }
    })
    .filter(x => x.activity_name)
    .sort((p, q) => (p.next_event_date || '').localeCompare(q.next_event_date || ''))

  // Attention — only reliably-determinable states (no invented workflow logic).
  const ATTENTION_LABELS = {
    overdue: 'Approved but overdue — mark completed',
    approval: 'Pending approval',
    info: 'Missing venue or start time',
  }
  const attention = []
  for (const e of core) {
    if (['Draft', 'Submitted'].includes(e.status)) {
      attention.push({ ...e, attention_type: 'approval', attention_reason: ATTENTION_LABELS.approval })
    } else if (e.status === 'Approved' && e.date && e.date < todayStr) {
      attention.push({ ...e, attention_type: 'overdue', attention_reason: ATTENTION_LABELS.overdue })
    } else if (isUpcoming(e) && (!e.venue || !e.start_time)) {
      attention.push({ ...e, attention_type: 'info', attention_reason: ATTENTION_LABELS.info })
    }
  }
  const attentionRank = { overdue: 0, info: 1, approval: 2 }
  attention.sort((a, b) => attentionRank[a.attention_type] - attentionRank[b.attention_type] || byDate(a, b))

  const kpis = {
    total_events: core.length,
    upcoming_events: upcomingEvents.length,
    today_events: todayEvents.length,
    completed_events: core.filter(e => e.status === 'Completed').length,
    budget_total: core.reduce((s, e) => s + (+e.budget || 0), 0),
    beneficiaries_total: core.reduce((s, e) => s + (+e.expected_beneficiaries || 0), 0),
  }

  return {
    generated_at: new Date().toISOString(),
    filters: { ngo_id, sector_id, activity_id, month, year },
    kpis,
    this_week: { count: weekEvents.length, events: weekEvents.slice(0, 10).map(enrich) },
    this_month: {
      total: inMonth.length,
      upcoming: inMonth.filter(isUpcoming).length,
      completed: inMonth.filter(e => e.status === 'Completed').length,
    },
    events_by_ngo,
    events_by_sector,
    activities_with_upcoming_events,
    today_events: todayEvents.slice(0, 12).map(enrich),
    upcoming_events: upcomingEvents.slice(0, 8).map(enrich),
    attention: attention.slice(0, 10).map(enrich),
  }
}
export const fetchEventsByMonth = (month, year) => apiGet('/event-head/events/calendar?month=' + month + '&year=' + year)
export const fetchCalendarEvents = (params = {}) => {
  const qs = new URLSearchParams()
  if (params.start) qs.set('start', params.start)
  if (params.end) qs.set('end', params.end)
  if (params.ngoId) qs.set('ngoId', params.ngoId)
  if (params.sectorId) qs.set('sectorId', params.sectorId)
  if (params.activityId) qs.set('activityId', params.activityId)
  if (params.status) qs.set('status', params.status)
  if (params.year) qs.set('year', params.year)
  const q = qs.toString()
  return apiGet('/event-head/events/calendar' + (q ? '?' + q : ''))
}
export const fetchEventsByNgo = (ngoId) => apiGet('/event-head/events/ngo/' + ngoId)
export const fetchEventsByState = (state) => apiGet('/event-head/events/state/' + state)
export const fetchEventPerformance = (id) => apiGet('/event-head/events/' + id + '/performance')
export const updateEventStatus = (id, status) => apiPut('/event-head/events/' + id + '/status', { status })

/* ── Events sheet import / export ── */
export const importEventsSheet = (opts = {}, file) => {
  const fd = new FormData()
  if (opts.all) fd.append('all_ngos', '1')
  const ngoCode = opts.code || opts.ngoCode || ''
  if (ngoCode) fd.append('ngo_code', ngoCode)
  if (opts.id) fd.append('ngo_id', opts.id)
  if (file) fd.append('file', file)
  return api('/event-head/events/import', { method: 'POST', body: fd, _prefix: 'ucs', timeout: 180000 })
}
export const exportEventsSheet = async (params = {}, defaultName) => {
  const qs = new URLSearchParams()
  if (params.ngo_id) qs.set('ngo_id', params.ngo_id)
  if (params.sector_id) qs.set('sector_id', params.sector_id)
  if (params.activity_id) qs.set('activity_id', params.activity_id)
  if (params.status) qs.set('status', params.status)
  if (params.month) qs.set('month', params.month)
  if (params.year) qs.set('year', params.year)
  const q = qs.toString()
  const res = await api('/event-head/events/export' + (q ? '?' + q : ''), { raw: true, _prefix: 'ucs', timeout: 120000 })
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = defaultName || 'events.xlsx'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/* ── Event Checklist ── */
export const fetchChecklist = (eventId) => apiGet('/event-head/events/' + eventId + '/checklist')
export const createChecklistItem = (eventId, data) => apiPost('/event-head/events/' + eventId + '/checklist', data)
export const updateChecklistItem = (eventId, itemId, data) => apiPut('/event-head/events/' + eventId + '/checklist/' + itemId, data)

/* ── Assets ── */
export const fetchAssets = () => apiGet('/event-head/assets')
export const fetchAssetById = (id) => apiGet('/event-head/assets/' + id)
export const createAsset = (data) => apiPost('/event-head/assets', data)
export const updateAsset = (id, data) => apiPut('/event-head/assets/' + id, data)
export const deleteAsset = (id) => apiDelete('/event-head/assets/' + id)
export const issueAsset = (data) => apiPost('/event-head/assets/issue', data)
export const returnAsset = (id, data) => apiPut('/event-head/assets/return/' + id, data)
export const fetchAssetUtilization = () => apiGet('/event-head/assets/utilization')

/* ── Distribution Material ── */
export const fetchMaterials = () => apiGet('/event-head/materials')
export const createMaterial = (data) => apiPost('/event-head/materials', data)
export const updateMaterial = (id, data) => apiPut('/event-head/materials/' + id, data)
export const deleteMaterial = (id) => apiDelete('/event-head/materials/' + id)
export const fetchMaterialStock = () => apiGet('/event-head/materials/stock')
export const adjustMaterialStock = (id, data) => apiPut('/event-head/materials/' + id + '/stock', data)

/* ── Beneficiary Distribution ── */
export const fetchDistributions = (eventId) => apiGet('/event-head/events/' + eventId + '/distributions')
export const createDistribution = (eventId, data) => apiPost('/event-head/events/' + eventId + '/distributions', data)
export const fetchBeneficiaries = () => apiGet('/event-head/beneficiaries')
export const createBeneficiary = (data) => apiPost('/event-head/beneficiaries', data)

/* ── Volunteers ── */
export const fetchVolunteers = () => apiGet('/event-head/volunteers')
export const createVolunteer = (data) => apiPost('/event-head/volunteers', data)
export const updateVolunteer = (id, data) => apiPut('/event-head/volunteers/' + id, data)
export const fetchVolunteerPeople = () => apiGet('/event-head/volunteers/people')
export const fetchVolunteerAttendance = (eventId) => apiGet('/event-head/events/' + eventId + '/volunteer-attendance')
export const markVolunteerAttendance = (eventId, data) => apiPost('/event-head/events/' + eventId + '/volunteer-attendance', data)

/* ── Expenses ── */
export const fetchExpenses = (eventId) => apiGet('/event-head/events/' + eventId + '/expenses')
export const createExpense = (eventId, data) => apiPost('/event-head/events/' + eventId + '/expenses', data)
export const deleteExpense = (eventId, id) => apiDelete('/event-head/events/' + eventId + '/expenses/' + id)

/* ── Vehicles ── */
export const fetchVehicles = () => apiGet('/event-head/vehicles')
export const createVehicle = (data) => apiPost('/event-head/vehicles', data)
export const assignVehicle = (data) => apiPost('/event-head/vehicles/assign', data)

/* ── Media ── */
export const fetchMedia = (eventId) => apiGet('/event-head/events/' + eventId + '/media')
export const fetchMediaByNgo = (ngoId) => apiGet('/event-head/events/ngo/' + ngoId + '/media')
export const uploadMedia = (eventId, formData) => api('/event-head/events/' + eventId + '/media', { method: 'POST', body: formData, _prefix: 'ucs', timeout: 180000 })
export const createMediaLink = (eventId, data) => apiPost('/event-head/events/' + eventId + '/media', data)
export const replaceMedia = (eventId, id, formData) => api('/event-head/events/' + eventId + '/media/' + id, { method: 'PUT', body: formData, _prefix: 'ucs', timeout: 180000 })
export const updateMedia = (eventId, id, data) => apiPut('/event-head/events/' + eventId + '/media/' + id, data)
export const deleteMedia = (eventId, id) => apiDelete('/event-head/events/' + eventId + '/media/' + id)

// Download a media file through the backend proxy (same origin → no CORS), so the
// browser saves it instead of opening a new tab. Returns a Blob to the caller.
export const downloadMediaBlob = async (eventId, id, _prefix = 'ucs') => {
  const res = await api('/event-head/events/' + eventId + '/media/' + id + '/download', { method: 'GET', raw: true, _prefix })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || 'Failed to download file')
  }
  return res.blob()
}

/* ── Attendance ── */
export const fetchEventAttendance = (eventId) => apiGet('/event-head/events/' + eventId + '/attendance')
export const markAttendance = (eventId, data) => apiPost('/event-head/events/' + eventId + '/attendance', data)

/* ── Reports ── */
export const generateEventReport = (eventId, type) => apiGet('/event-head/reports/event/' + eventId + '?type=' + type)
export const generateAllEventsReport = (params = {}) => apiGet('/event-head/reports/all' + (Object.keys(params).length ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString() : ''))
export const generateNgoMonthlyReport = (params = {}) => apiGet('/event-head/reports/monthly' + (Object.keys(params).length ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString() : ''))
export const generateEventPdf = (eventId) => api('/event-head/reports/event/' + eventId + '/pdf', { _prefix: 'ucs' })
export const generateEventExcel = (eventId) => api('/event-head/reports/event/' + eventId + '/excel', { _prefix: 'ucs' })

/* ── Approval ── */
export const fetchApprovals = () => apiGet('/event-head/approvals')
export const submitApproval = (eventId) => apiPost('/event-head/events/' + eventId + '/submit')
export const approveEvent = (eventId) => apiPut('/event-head/events/' + eventId + '/approve')
export const rejectEvent = (eventId, remark) => apiPut('/event-head/events/' + eventId + '/reject', { remark })

/* ── NGOs / CSR / Donors ── */
export const fetchNGOs = () => apiGet('/ngos')
export const fetchCSRPartners = () => apiGet('/event-head/csr-partners')
export const fetchDonors = () => apiGet('/event-head/donors')

/* ── NGO Context (Event Head workspace, read-only) ── */
export const fetchWorkspaceNgos = () => apiGet('/event-head/ngos')

/* ── Sectors & Activities (NGO → Sector → Activity) ── */
export const fetchSectors = (params = {}) => {
  const qs = new URLSearchParams()
  if (params.ngo_id) qs.set('ngo_id', params.ngo_id)
  const q = qs.toString()
  return apiGet('/event-head/sectors' + (q ? '?' + q : ''))
}
export const fetchActivities = (params = {}) => {
  const qs = new URLSearchParams()
  if (params.ngo_id) qs.set('ngo_id', params.ngo_id)
  if (params.sector_id) qs.set('sector_id', params.sector_id)
  const q = qs.toString()
  return apiGet('/event-head/activities' + (q ? '?' + q : ''))
}
export const fetchActivityById = (id) => apiGet('/event-head/activities/' + id)
export const createActivity = (data) => apiPost('/event-head/activities', data)
export const updateActivity = (id, data) => apiPut('/event-head/activities/' + id, data)
export const setActivityStatus = (id, status) => apiPut('/event-head/activities/' + id + '/status', { status })
export const suggestSectorActivities = (sector_name, opts = {}) =>
  apiPost('/event-head/activities/suggest', { sector_name, ...opts })

/* ── Activities sheet import / export ── */
export const importActivitiesSheet = (ngoCode, file) => {
  const fd = new FormData()
  fd.append('ngo_code', ngoCode)
  fd.append('file', file)
  return api('/event-head/activities/import', { method: 'POST', body: fd, _prefix: 'ucs', timeout: 180000 })
}
export const exportActivitiesSheet = async (ngoId, defaultName) => {
  const qs = ngoId ? '?ngo_id=' + ngoId : ''
  const res = await api('/event-head/activities/export' + qs, { raw: true, _prefix: 'ucs', timeout: 120000 })
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = defaultName || 'activities.xlsx'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/* ── Notifications ── */
export const fetchNotifs = (userId) => apiGet('/notifications/' + userId)
export const markNotifRead = (id) => apiPut('/notifications/' + id + '/read', {})
export const deleteNotif = (id) => apiDelete('/notifications/' + id)

/* ── Dynamic Event-Head deadline notifications ──
 * Computed live from event_head_events (no stored rows). Returns events whose
 * date falls within the next `days` days (including today), sorted soonest-first,
 * decorated with urgency + human labels. Used by the bell popup, the dashboard
 * and the Notifications page so they all share one source of truth. */
const DAY_MS = 24 * 60 * 60 * 1000
const ehPad2 = (n) => String(n).padStart(2, '0')
const ehYmd = (d) => { const x = new Date(d); return isNaN(x) ? '' : `${x.getFullYear()}-${ehPad2(x.getMonth() + 1)}-${ehPad2(x.getDate())}` }
export const deadlineLabel = (days) => days <= 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due in ${days} days`

export const computeDeadlineNotifs = (events, ngos, today = new Date(), days = 3) => {
  const base = new Date(today); base.setHours(0, 0, 0, 0)
  const cutoff = new Date(base.getTime() + Math.max(0, Number(days) || 0) * DAY_MS)
  const name = (id) => { const n = (ngos || []).find(x => String(x.id) === String(id)); return n ? (n.name || n.code) : null }
  const items = []
  for (const e of (events || [])) {
    if (!e.date) continue
    const dt = new Date(String(e.date).slice(0, 10) + 'T00:00:00')
    if (isNaN(dt.getTime())) continue
    if (dt < base || dt > cutoff) continue
    if (e.status && /complete|done|cancelled|closed/i.test(e.status)) continue
    const days = Math.round((dt.getTime() - base.getTime()) / DAY_MS)
    items.push({
      key: 'dl_' + e.id,
      eventId: e.id,
      title: e.name || 'Untitled Event',
      body: [name(e.ngo_id), e.sector_name, e.venue].filter(Boolean).join(' · ') || 'Event deadline approaching',
      date: ehYmd(e.date),
      days,
      urgent: days === 0,
      label: deadlineLabel(days),
    })
  }
  items.sort((a, b) => a.days - b.days || String(a.date).localeCompare(String(b.date)))
  return items
}

export const fetchDeadlineNotifs = async (days = 3) => {
  const [events, ngos] = await Promise.all([fetchEvents({}).catch(() => []), fetchWorkspaceNgos().catch(() => [])])
  return computeDeadlineNotifs(events, ngos, new Date(), days)
}

export const CATEGORIES = [
  'Education','Health','Food Distribution','Women Empowerment',
  'Animal Welfare','Disability Support','Environment','Medical Camp','Blood Donation'
]

export const PRIORITIES = ['Low','Medium','High','Urgent']
export const EVENT_STATUSES = ['Draft','Submitted','Approved','Rejected','Completed','Closed','Cancelled','Postponed']

export const CHECKLIST_ITEMS = [
  'Permission received','Material Ready','Volunteers Assigned','Vehicle Booked',
  'Photographer Assigned','Vendor Confirmed','Beneficiary List Ready','Donation Material Ready'
]

export const ASSET_TYPES = [
  'Tables','Chairs','Canopy','Stage','Sound System','Mic','Speakers','Projector',
  'Laptop','Printer','Banner','Standee','Backdrop','Generator','Extension Boards',
  'Lights','Camera','DSLR','Tripod','Wheelchairs','Sewing Machines','Tricycles',
  'Water Dispenser','Volunteer Jackets','ID Cards','Donation Boxes'
]

export const MATERIAL_TYPES = [
  'Food Kits','Grocery Kits','Education Kits','School Bags','Blankets',
  'Umbrellas','Sewing Machines','Flour Mills','Tricycles','Notebooks',
  'Stationery','Clothes','Sanitary Napkins','Water Bottles','Medical Kits'
]

export const EXPENSE_TYPES = [
  'Transport','Food','Fuel','Venue','Printing','Decoration',
  'Photography','Sound System','Honorarium','Miscellaneous'
]
