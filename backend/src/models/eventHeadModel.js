import db, { getTableColumns } from '../config/db.js';

// ─── EVENTS ───
export const createEventHeadEvent = async (data) => {
  const { data: result, error } = await db.from('event_head_events').insert([{ ...data, updated_at: new Date() }]).select().single();
  if (error) throw error;
  return result;
};

// Bulk insert from an events sheet import. No ON CONFLICT (events have no
// natural unique key) — the caller dedupes rows before calling.
export const insertEventHeadEventsBulk = async (rows) => {
  if (!rows || !rows.length) return [];
  const withTs = rows.map(r => ({ ...r, updated_at: new Date() }));
  const { data, error } = await db.from('event_head_events').insert(withTs).select('id, ngo_id');
  if (error) throw error;
  return data || [];
};

export const getAllEventHeadEvents = async (filters = {}) => {
  const { ngo_id, sector_id, activity_id, status, month, year } = filters;
  const SUBMITTED_STATUSES = ['Submitted', 'Submitted&', 'Pending Approval', 'Approval Pending'];
  let query = db.from('event_head_events').select('*').order('created_at', { ascending: false });
  if (ngo_id) query = query.eq('ngo_id', ngo_id);
  if (sector_id) query = query.eq('sector_id', sector_id);
  if (activity_id) query = query.eq('activity_id', activity_id);
  if (status) {
    if (status === 'Submitted') query = query.in('status', SUBMITTED_STATUSES);
    else query = query.eq('status', status);
  }
  if (month && year) {
    const m = Number(month), y = Number(year);
    if (m >= 1 && m <= 12) {
      query = query.gte('date', `${y}-${String(m).padStart(2, '0')}-01`)
        .lt('date', `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`);
    }
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
};

export const getEventHeadEventById = async (id) => {
  const { data, error } = await db.from('event_head_events').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
};

export const updateEventHeadEvent = async (id, updates) => {
  const { data, error } = await db.from('event_head_events').update({ ...updates, updated_at: new Date() }).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const deleteEventHeadEvent = async (id) => {
  const { error } = await db.from('event_head_events').delete().eq('id', id);
  if (error) throw error;
  return { message: 'Event deleted' };
};

export const deleteEventHeadEventsBulk = async (ids) => {
  if (!ids || !ids.length) return 0;
  const { data, error } = await db.from('event_head_events').delete().in('id', ids).select('id');
  if (error) throw error;
  return Array.isArray(data) ? data.length : 0;
};

export const getEventHeadEventsByMonth = async (month, year, ngo_id) => {
  const m = Number(month), y = Number(year);
  let query = db.from('event_head_events').select('*')
    .gte('date', `${y}-${String(m).padStart(2, '0')}-01`)
    .lt('date', `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`)
    .order('date', { ascending: true });
  if (ngo_id) query = query.eq('ngo_id', ngo_id);
  const { data, error } = await query;
  if (error) throw error;
  return data;
};

// ─── MULTI-ACTIVITY (join table) ───

// The event_head_event_activities join table is added by migration 092. Until
// that migration is applied on a given DB, the table does not exist and any
// read/write to it throws 'relation ... does not exist' — killing event create.
// Guard every join-table access behind this cached-existence check so events
// keep working via the legacy single `activity_id` column in the interim.
let joinTableExistsCache = null;
const joinTableExists = async () => {
  if (joinTableExistsCache !== null) return joinTableExistsCache;
  try {
    const cols = await getTableColumns('event_head_event_activities');
    joinTableExistsCache = Array.isArray(cols) && cols.length > 0;
  } catch {
    joinTableExistsCache = false;
  }
  return joinTableExistsCache;
};

export const getEventHeadActivityIds = async (eventId) => {
  if (!(await joinTableExists())) return [];
  const { data, error } = await db.from('event_head_event_activities').select('activity_id').eq('event_id', eventId);
  if (error) throw error;
  return (data || []).map(r => Number(r.activity_id));
};

// Set the full set of activities for an event (replaces existing rows).
export const setEventHeadActivities = async (eventId, activityIds = []) => {
  if (!(await joinTableExists())) return [];
  const ids = [...new Set(activityIds.filter(id => id != null).map(Number))];
  await db.from('event_head_event_activities').delete().eq('event_id', eventId);
  if (ids.length) {
    const rows = ids.map(activity_id => ({ event_id: Number(eventId), activity_id }));
    const { data, error } = await db.from('event_head_event_activities').insert(rows);
    if (error) throw error;
  }
  return ids;
};

// Calendar-range query for FullCalendar. Returns events within [start, end).
export const getEventHeadEventsByRange = async ({ start, end, ngo_id, sector_id, activity_id, status, year } = {}) => {
  let query = db.from('event_head_events').select('*');
  if (activity_id != null) {
    // Filter by an event containing this activity (join table).
    const ids = await getEventIdsForActivity(activity_id);
    if (ids.length) query = query.in('id', ids);
    else return [];
  }
  if (start) query = query.gte('date', String(start).slice(0, 10));
  if (end) query = query.lt('date', String(end).slice(0, 10));
  if (year) {
    const y = Number(year);
    if (Number.isFinite(y)) query = query.gte('date', `${y}-01-01`).lt('date', `${y + 1}-01-01`);
  }
  if (ngo_id != null) query = query.eq('ngo_id', ngo_id);
  if (sector_id != null) query = query.eq('sector_id', sector_id);
  if (status) query = query.eq('status', status);
  query = query.order('date', { ascending: true });
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

// Events ids that reference a given activity (via the join table), falling back
// to the legacy single activity_id column.
const getEventIdsForActivity = async (activityId) => {
  const a = Number(activityId);
  const joinIds = (await joinTableExists())
    ? (await db.from('event_head_event_activities').select('event_id').eq('activity_id', a)).data || []
    : [];
  const joinSet = new Set(joinIds.map(r => Number(r.event_id)));
  const { data: legacy } = await db.from('event_head_events').select('id').eq('activity_id', a);
  const ids = new Set([...joinSet, ...(legacy || []).map(r => Number(r.id))]);
  return [...ids];
};

export const getEventHeadEventsByNgo = async (ngoId) => {
  const { data, error } = await db.from('event_head_events').select('*').eq('ngo_id', ngoId).order('date', { ascending: false });
  if (error) throw error;
  return data;
};

export const getEventHeadEventsByState = async (state) => {
  const { data, error } = await db.from('event_head_events').select('*').ilike('state', state).order('date', { ascending: false });
  if (error) throw error;
  return data;
};

export const getEventHeadDashboard = async () => {
  const { data, error } = await db.from('event_head_events').select('*');
  if (error) throw error;
  const total = data.length;
  const upcoming = data.filter(e => e.status === 'Approved' && new Date(e.date) > new Date()).length;
  const today = data.filter(e => e.date === new Date().toISOString().slice(0, 10)).length;
  const completed = data.filter(e => e.status === 'Completed').length;
  const cancelled = data.filter(e => ['Cancelled', 'Postponed'].includes(e.status)).length;
  const budgetTotal = data.reduce((s, e) => s + (+e.budget || 0), 0);
  const beneficiariesTotal = data.reduce((s, e) => s + (+e.expected_beneficiaries || 0), 0);
  return { total, upcoming, today, completed, cancelled, budget_total: budgetTotal, beneficiaries_total: beneficiariesTotal };
};

const pad2 = (n) => String(n).padStart(2, '0');
const monthBounds = (month, year) => {
  const y = year ? Number(year) : null;
  if (month) {
    const m = Number(month);
    if (!(m >= 1 && m <= 12)) return null;
    const yearForMonth = y || new Date().getFullYear();
    const next = m === 12 ? `${yearForMonth + 1}-01-01` : `${yearForMonth}-${pad2(m + 1)}-01`;
    return { from: `${yearForMonth}-${pad2(m)}-01`, to: next };
  }
  if (y && Number.isFinite(y)) return { from: `${y}-01-01`, to: `${y + 1}-01-01` };
  return null;
};

// Lean projection of events for the dashboard stats calculation.
// Applies the scalar filters (ngo/sector/activity) and the month+year window.
export const getEventHeadDashboardEvents = async (filters = {}) => {
  const { ngo_id, sector_id, activity_id, month, year } = filters;
  let query = db.from('event_head_events')
    .select('id, name, date, start_time, end_time, venue, status, ngo_id, sector_id, activity_id, budget, expected_beneficiaries');
  if (ngo_id) query = query.eq('ngo_id', ngo_id);
  if (sector_id) query = query.eq('sector_id', sector_id);
  if (activity_id) query = query.eq('activity_id', activity_id);
  const bounds = monthBounds(month, year);
  if (bounds) query = query.gte('date', bounds.from).lt('date', bounds.to);
  const { data, error } = await query;
  if (error) throw error;
  return data;
};

// ─── ASSETS ───
export const createAsset = async (data) => {
  const { data: result, error } = await db.from('event_head_assets').insert([{ ...data, available_qty: data.quantity, updated_at: new Date() }]).select().single();
  if (error) throw error;
  return result;
};

export const getAllAssets = async () => {
  const { data, error } = await db.from('event_head_assets').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const getAssetById = async (id) => {
  const { data, error } = await db.from('event_head_assets').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
};

export const updateAsset = async (id, updates) => {
  const { data, error } = await db.from('event_head_assets').update({ ...updates, updated_at: new Date() }).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const deleteAsset = async (id) => {
  const { error } = await db.from('event_head_assets').delete().eq('id', id);
  if (error) throw error;
  return { message: 'Asset deleted' };
};

export const issueAsset = async (assetId, qty) => {
  const asset = await getAssetById(assetId);
  const newIssued = (asset.issued_qty || 0) + qty;
  const newAvailable = (asset.available_qty || asset.quantity) - qty;
  return updateAsset(assetId, { issued_qty: newIssued, available_qty: newAvailable });
};

export const returnAsset = async (assetId) => {
  const asset = await getAssetById(assetId);
  return updateAsset(assetId, { issued_qty: 0, available_qty: asset.quantity, damaged_qty: 0 });
};

// ─── MATERIALS ───
export const createMaterial = async (data) => {
  const balance = +data.opening_stock + +data.received - +data.issued;
  const { data: result, error } = await db.from('event_head_materials').insert([{ ...data, balance, updated_at: new Date() }]).select().single();
  if (error) throw error;
  return result;
};

export const getAllMaterials = async () => {
  const { data, error } = await db.from('event_head_materials').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const updateMaterial = async (id, updates) => {
  const balance = +updates.opening_stock + +updates.received - +updates.issued;
  const { data, error } = await db.from('event_head_materials').update({ ...updates, balance, updated_at: new Date() }).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const deleteMaterial = async (id) => {
  const { error } = await db.from('event_head_materials').delete().eq('id', id);
  if (error) throw error;
  return { message: 'Material deleted' };
};

export const getMaterialStock = async () => {
  const { data, error } = await db.from('event_head_materials').select('name, balance, opening_stock, received, issued').order('balance', { ascending: true });
  if (error) throw error;
  return data;
};

export const adjustMaterialStock = async (id, adjustment) => {
  const mat = await db.from('event_head_materials').select('*').eq('id', id).single().then(r => r.data);
  const newBalance = (mat.balance || 0) + adjustment;
  return updateMaterial(id, { balance: Math.max(0, newBalance) });
};

// ─── DISTRIBUTIONS ───
export const createDistribution = async (eventId, data) => {
  const { data: result, error } = await db.from('event_head_distributions').insert([{ ...data, event_id: eventId }]).select().single();
  if (error) throw error;
  if (data.material_id && data.quantity) {
    const mat = await db.from('event_head_materials').select('*').eq('id', data.material_id).single().then(r => r.data);
    if (mat) await updateMaterial(data.material_id, { issued: (mat.issued || 0) + +data.quantity, opening_stock: mat.opening_stock, received: mat.received });
  }
  return result;
};

export const getDistributionsByEvent = async (eventId) => {
  const { data, error } = await db.from('event_head_distributions').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

// ─── VOLUNTEERS ───
export const createVolunteer = async (data) => {
  const { data: result, error } = await db.from('event_head_volunteers').insert([data]).select().single();
  if (error) throw error;
  return result;
};

export const getAllVolunteers = async () => {
  const { data, error } = await db.from('event_head_volunteers').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const updateVolunteer = async (id, updates) => {
  const { data, error } = await db.from('event_head_volunteers').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

// NGO-wise volunteer roster for the Voluntary section. Reads the HR workers
// table (the volunteer team in the database) and joins the NGO name/code.
export const getVolunteerPeople = async () => {
  const [workersRes, ngosRes] = await Promise.all([
    db.from('workers')
      .select('id, name, ngo_id, is_test')
      .eq('employment_status', 'active')
      .order('name'),
    db.from('ngos').select('id, name, code'),
  ]);
  if (workersRes.error) throw workersRes.error;
  if (ngosRes.error) throw ngosRes.error;
  const ngoMap = {};
  for (const n of ngosRes.data || []) {
    ngoMap[String(n.id)] = { name: n.name || n.code || 'NGO ' + n.id, code: n.code };
  }
  return (workersRes.data || [])
    .filter((w) => !w.is_test)
    .map((w) => {
      const n = w.ngo_id != null ? ngoMap[String(w.ngo_id)] : null;
      return {
        id: w.id,
        name: w.name,
        ngo_id: w.ngo_id ?? null,
        ngo_name: n ? n.name : null,
        ngo_code: n ? n.code : null,
      };
    })
    .sort((a, b) => {
      const na = a.ngo_name || 'Other';
      const nb = b.ngo_name || 'Other';
      return na.localeCompare(nb) || (a.name || '').localeCompare(b.name || '');
    });
};

// ─── EXPENSES ───
export const createExpense = async (eventId, data) => {
  const { data: result, error } = await db.from('event_head_expenses').insert([{ ...data, event_id: eventId }]).select().single();
  if (error) throw error;
  return result;
};

export const getExpensesByEvent = async (eventId) => {
  const { data, error } = await db.from('event_head_expenses').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const deleteExpense = async (eventId, id) => {
  const { error } = await db.from('event_head_expenses').delete().eq('id', id).eq('event_id', eventId);
  if (error) throw error;
  return { message: 'Expense deleted' };
};

// ─── VEHICLES ───
export const createVehicle = async (data) => {
  const { data: result, error } = await db.from('event_head_vehicles').insert([data]).select().single();
  if (error) throw error;
  return result;
};

export const getAllVehicles = async () => {
  const { data, error } = await db.from('event_head_vehicles').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const assignVehicle = async (data) => {
  const { data: result, error } = await db.from('event_head_vehicles').insert([data]).select().single();
  if (error) throw error;
  return result;
};

// ─── MEDIA ───
// The base `event_head_media` table stores id, event_id, name, url, type,
// created_at. The richer metadata columns (title, description, media_type,
// year, size, uploaded_by, updated_at) are additive and managed idempotently
// by `ensureMediaColumns()` so existing rows and deployments keep working.
export const MEDIA_COLUMNS_SQL = [
  `ALTER TABLE event_head_media ADD COLUMN IF NOT EXISTS title TEXT`,
  `ALTER TABLE event_head_media ADD COLUMN IF NOT EXISTS description TEXT`,
  `ALTER TABLE event_head_media ADD COLUMN IF NOT EXISTS media_type TEXT`,
  `ALTER TABLE event_head_media ADD COLUMN IF NOT EXISTS year INT`,
  `ALTER TABLE event_head_media ADD COLUMN IF NOT EXISTS size BIGINT`,
  `ALTER TABLE event_head_media ADD COLUMN IF NOT EXISTS uploaded_by TEXT`,
  `ALTER TABLE event_head_media ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
];

// Idempotent: add metadata columns if the table/columns do not yet exist.
export const ensureMediaColumns = async () => {
  const { rows } = await db._pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='event_head_media'`
  );
  if (rows.length === 0) return;
  for (const sql of MEDIA_COLUMNS_SQL) {
    try { await db._pool.query(sql); } catch (e) { /* ignore if column missing concurrently */ }
  }
};

export const createMedia = async (eventId, data) => {
  await ensureMediaColumns();
  const { data: result, error } = await db.from('event_head_media').insert([{ ...data, event_id: eventId }]).select().single();
  if (error) throw error;
  return result;
};

export const getMediaByEvent = async (eventId) => {
  const { data, error } = await db.from('event_head_media').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const getBannerMediaByEvents = async (eventIds) => {
  if (!eventIds || !eventIds.length) return [];
  const { data, error } = await db.from('event_head_media').select('event_id, url, media_type').eq('media_type', 'Banner').in('event_id', eventIds);
  if (error) throw error;
  return data || [];
};

// All media across every event of a single NGO (event → ngo).
export const getMediaByNgo = async (ngoId) => {
  await ensureMediaColumns();
  const { data, error } = await db.from('event_head_media')
    .select('*, event_head_events!inner(id, name, date, ngo_id)')
    .eq('event_head_events.ngo_id', ngoId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const getMediaById = async (eventId, id) => {
  const { data, error } = await db.from('event_head_media').select('*').eq('id', id).eq('event_id', eventId).maybeSingle();
  if (error) throw error;
  return data;
};

export const updateMedia = async (eventId, id, updates) => {
  await ensureMediaColumns();
  const { data: result, error } = await db.from('event_head_media')
    .update({ ...updates, updated_at: new Date() })
    .eq('id', id).eq('event_id', eventId).select().single();
  if (error) throw error;
  return result;
};

export const deleteMedia = async (eventId, id) => {
  const { error } = await db.from('event_head_media').delete().eq('id', id).eq('event_id', eventId);
  if (error) throw error;
  return { message: 'Media deleted' };
};

// ─── ATTENDANCE ───
export const createAttendance = async (eventId, data) => {
  const { data: result, error } = await db.from('event_head_attendance').insert([{ ...data, event_id: eventId }]).select().single();
  if (error) throw error;
  return result;
};

export const getAttendanceByEvent = async (eventId) => {
  const { data, error } = await db.from('event_head_attendance').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

// ─── CHECKLIST ───
export const getChecklistByEvent = async (eventId) => {
  const { data, error } = await db.from('event_head_checklist').select('*').eq('event_id', eventId).order('id', { ascending: true });
  if (error) throw error;
  return data;
};

export const upsertChecklistItem = async (eventId, item) => {
  if (item.id) {
    const { data, error } = await db.from('event_head_checklist').update({ status: item.status, notes: item.notes }).eq('id', item.id).eq('event_id', eventId).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await db.from('event_head_checklist').insert([{ event_id: eventId, label: item.label, status: item.status, notes: item.notes }]).select().single();
  if (error) throw error;
  return data;
};

export const createChecklistItem = async (eventId, item) => {
  const { data, error } = await db.from('event_head_checklist').insert([{ event_id: eventId, label: item.label, status: !!item.status, notes: item.notes || null }]).select().single();
  if (error) throw error;
  return data;
};

// ─── PARTNERS (CSR) ───
export const getAllPartners = async () => {
  const { data, error } = await db.from('event_head_partners').select('*').order('name', { ascending: true });
  if (error) throw error;
  return data;
};

// ─── DONORS ───
export const getAllDonors = async () => {
  const { data, error } = await db.from('event_head_donors').select('*').order('name', { ascending: true });
  if (error) throw error;
  return data;
};

// ─── SECTORS (Dynamic 12-sector reference, seeded via migration) ───
export const getAllEventHeadSectors = async () => {
  const { data, error } = await db.from('event_head_sectors').select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return data;
};

export const createEventHeadSector = async ({ name, description } = {}) => {
  const cleanName = String(name || '').trim();
  if (!cleanName) throw new Error('Sector name is required');
  const { data: existing, error: findError } = await db
    .from('event_head_sectors')
    .select('*')
    .ilike('name', cleanName)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return { ...existing, existing: true };
  const { data: maxRow, error: maxError } = await db
    .from('event_head_sectors')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);
  if (maxError) throw maxError;
  const sort_order = (maxRow && maxRow[0] && maxRow[0].sort_order != null ? Number(maxRow[0].sort_order) : 0) + 1;
  const { data, error } = await db
    .from('event_head_sectors')
    .insert({ name: cleanName, description: description ? String(description).trim() || null : null, is_active: true, sort_order })
    .select('*')
    .single();
  if (error) throw error;
  return data;
};

export const getSectorActivityCounts = async (ngoId) => {
  let query = db.from('event_head_activities').select('id, sector_id, ngo_id');
  if (ngoId) query = query.eq('ngo_id', ngoId);
  const { data, error } = await query;
  if (error) throw error;
  const counts = {};
  for (const a of data || []) if (a.sector_id) counts[a.sector_id] = (counts[a.sector_id] || 0) + 1;
  return counts;
};

export const getSectorEventCounts = async (ngoId) => {
  let query = db.from('event_head_events').select('id, sector_id, ngo_id');
  if (ngoId) query = query.eq('ngo_id', ngoId);
  const { data, error } = await query;
  if (error) throw error;
  const counts = {};
  for (const e of data || []) if (e.sector_id) counts[e.sector_id] = (counts[e.sector_id] || 0) + 1;
  return counts;
};

// ─── ACTIVITIES (NGO → Sector → Activity) ───
export const createActivity = async (data) => {
  const { data: result, error } = await db.from('event_head_activities').insert([{ ...data, updated_at: new Date() }]).select().single();
  if (error) throw error;
  return result;
};

// Bulk upsert from a sheet import. Only actually-inserted rows are returned
// (ON CONFLICT ... DO NOTHING skips existing), so callers can report
// inserted vs skipped_existing counts precisely.
export const insertActivitiesBulk = async (rows) => {
  if (!rows || !rows.length) return [];
  const { data, error } = await db.from('event_head_activities')
    .upsert(rows, { onConflict: 'ngo_id,sector_id,name', ignoreDuplicates: true })
    .select('id, ngo_id, sector_id, name');
  if (error) throw error;
  return data || [];
};

export const getAllActivities = async ({ ngo_id, sector_id } = {}) => {
  let query = db.from('event_head_activities').select('*').order('created_at', { ascending: false });
  if (ngo_id) query = query.eq('ngo_id', ngo_id);
  if (sector_id) query = query.eq('sector_id', sector_id);
  const { data, error } = await query;
  if (error) throw error;
  return data;
};

export const getActivityById = async (id) => {
  const { data, error } = await db.from('event_head_activities').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
};

export const updateActivity = async (id, updates) => {
  const { data, error } = await db.from('event_head_activities').update({ ...updates, updated_at: new Date() }).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const getActivityEventCounts = async () => {
  const { data, error } = await db.from('event_head_events').select('id, activity_id');
  if (error) throw error;
  const counts = {};
  for (const e of data || []) if (e.activity_id) counts[e.activity_id] = (counts[e.activity_id] || 0) + 1;
  return counts;
};

// ─── NGO CONTEXT (read-only, Event Head workspace) ───
const EVENT_HEAD_NGO_CODES = ['bsct', 'mann', 'aflf'];

export const getAllEventHeadNgos = async () => {
  const { data, error } = await db.from('ngos').select('id, name, code').order('name', { ascending: true });
  if (error) throw error;
  return (data || []).sort((a, b) => {
    const ia = EVENT_HEAD_NGO_CODES.indexOf(String(a.code || a.name || '').toLowerCase());
    const ib = EVENT_HEAD_NGO_CODES.indexOf(String(b.code || b.name || '').toLowerCase());
    return (ia === -1 ? 9 : ia) - (ib === -1 ? 9 : ib) || String(a.name || a.code).localeCompare(String(b.name || b.code));
  });
};

export const getEventHeadNgoById = async (ngoId) => {
  if (!ngoId) return null;
  const { data, error } = await db.from('ngos').select('id, name, code').eq('id', ngoId).maybeSingle();
  if (error) return null;
  return data;
};
