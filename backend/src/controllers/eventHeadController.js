import crypto from 'crypto';
import * as EventHead from '../models/eventHeadModel.js';
import { parseActivitySheet, parseEventSheet, canonicalizeSector, normalizeName, isCampaignName } from '../utils/activitySheet.js';
import db, { getTableColumns } from '../config/db.js';
import groq from '../config/groq.js';

// ngo_id is deliberately NOT coerced to a number: ngos.id may be a UUID, so it
// must pass through unchanged as a string. sector_id / activity_id are always
// SERIAL ints and stay in the numeric list.
const numericFields = ['budget', 'expected_beneficiaries', 'amount', 'quantity', 'purchase_cost', 'cost', 'opening_stock', 'received', 'issued', 'balance', 'available_qty', 'issued_qty', 'damaged_qty', 'kilometer_reading', 'sector_id', 'activity_id'];
const sanitize = (data) => {
  const clean = { ...data };
  for (const k of Object.keys(clean)) {
    if (clean[k] === '' || clean[k] === null || clean[k] === undefined) {
      clean[k] = null;
    } else if (numericFields.includes(k)) {
      const num = Number(clean[k]);
      clean[k] = isNaN(num) ? null : num;
    }
  }
  return clean;
};

// Event Head workspace shows ALL NGOs to every event-head user; the NGO,
// sector and activity lists are no longer restricted to the user's own NGO.
const ownNgoId = (req) => {
  return null;
};

// Only pass through columns that actually exist on event_head_events. The live
// DB is the source of truth (it may lag the codebase's full column set), so we
// query real columns once per request and drop anything else. A static fallback
// keeps the write working even if the schema query itself fails.
const eventColumnsCache = { instant: null, ts: 0 };
const getEventColumns = async () => {
  if (eventColumnsCache.instant && Date.now() - eventColumnsCache.ts < 60000) return eventColumnsCache.instant;
  let cols;
  try { cols = await getTableColumns('event_head_events'); } catch { cols = null; }
  if (cols && cols.length) { eventColumnsCache.instant = cols; eventColumnsCache.ts = Date.now(); return cols; }
  return null;
};
const pickEventColumns = async (obj) => {
  const real = await getEventColumns();
  const out = {};
  for (const k of Object.keys(obj || {})) {
    if (real ? real.includes(k) : EVENT_COLUMNS.has(k)) out[k] = obj[k];
  }
  return out;
};

// Load NGO/Sector/Activity lookup maps once, shared by event views.
const buildEventContextMaps = async () => {
  const [ngos, sectors, activities] = await Promise.all([
    EventHead.getAllEventHeadNgos().catch(() => []),
    EventHead.getAllEventHeadSectors().catch(() => []),
    EventHead.getAllActivities().catch(() => []),
  ]);
  const ngoMap = {}; for (const n of ngos) ngoMap[n.id] = n.name || n.code;
  const ngoCodeMap = {}; for (const n of ngos) ngoCodeMap[n.id] = (n.code || n.name || '').toLowerCase();
  const sectorMap = {}; for (const s of sectors) sectorMap[s.id] = s.name;
  const activityMap = {}; for (const a of activities) activityMap[a.id] = a.name;
  return { ngoMap, ngoCodeMap, sectorMap, activityMap };
};

// Load activities for a set of events from the join table (falling back to the
// primary activity_id so legacy single-activity events still resolve).
const loadActivitiesForEvents = async (events, activityMap) => {
  const map = {};
  for (const e of events) {
    if (e.id == null) continue;
    const joinActivities = await EventHead.getEventHeadActivityIds(e.id).catch(() => []);
    let ids = joinActivities.length ? joinActivities : (e.activity_id != null ? [Number(e.activity_id)] : []);
    ids = [...new Set(ids.filter(id => id != null))];
    map[e.id] = ids.map(id => ({
      id,
      name: activityMap[id] || (String(id) === String(e.activity_id) ? e.activity_name : null) || null,
    })).filter(a => a.name);
  }
  return map;
};

const enrichEvent = (ev, ctx) => ({
  ...ev,
  ngo_name: ev.ngo_id ? ctx.ngoMap[ev.ngo_id] || null : null,
  sector_name: ev.sector_id ? ctx.sectorMap[ev.sector_id] || null : null,
  activity_name: ev.activity_id ? ctx.activityMap[ev.activity_id] || null : null,
});

// Async enrichment that also attaches the activities[] array (multi-activity).
const enrichEvents = async (events, ctx) => {
  if (!events || !events.length) return [];
  const actMap = await loadActivitiesForEvents(events, ctx.activityMap);
  return events.map(ev => ({
    ...enrichEvent(ev, ctx),
    activities: actMap[ev.id] || (ev.activity_id != null ? [{ id: ev.activity_id, name: ctx.activityMap[ev.activity_id] || ev.activity_name || null }].filter(a => a.name) : []),
  }));
};

// Normalize an event's activity selections: accepts either a single `activity_id`
// (legacy) or an array `activity_ids` (multi-activity). Returns the resolved ids.
const resolveActivityIds = (body) => {
  let ids = [];
  if (Array.isArray(body.activity_ids)) ids = ids.concat(body.activity_ids);
  else if (body.activity_id != null) ids.push(body.activity_id);
  return [...new Set(ids.map(n => Number(n)).filter(n => Number.isFinite(n) && n > 0))];
};

// Validate the event's NGO ➜ Sector ➜ Activity relationship.
// An activity belongs to exactly one sector, and either to one NGO or to "All NGOs".
const validateEventRelations = async (body) => {
  const missing = [];
  if (!body.name) missing.push('event name');
  if (!body.ngo_id) missing.push('NGO');
  if (!body.sector_id) missing.push('sector');
  if (missing.length) return { error: { message: `Required fields missing: ${missing.join(', ')}` } };

  const activityIds = resolveActivityIds(body);
  const activities = await Promise.all(activityIds.map(id => EventHead.getActivityById(id)));
  for (const activity of activities) {
    if (!activity) return { error: { message: 'Selected activity does not exist' } };
    if (String(activity.sector_id) !== String(body.sector_id)) {
      return { error: { message: 'Selected sector does not belong to the selected activity' } };
    }
    if (activity.ngo_id != null && String(activity.ngo_id) !== String(body.ngo_id)) {
      return { error: { message: 'Selected activity does not belong to the selected NGO' } };
    }
  }
  return { activities };
};

const validateEventTimes = (body) => {
  if (body.start_time && body.end_time && String(body.end_time) < String(body.start_time)) {
    return { message: 'End time must be after start time' };
  }
  return null;
};

// ─── EVENTS ───
export const createEventHandler = async (req, res) => {
  try {
    const body = sanitize(req.body);
    const relation = await validateEventRelations(body);
    if (relation.error) return res.status(400).json({ message: relation.error.message });
    const timeErr = validateEventTimes(body);
    if (timeErr) return res.status(400).json({ message: timeErr.message });
    const activityIds = resolveActivityIds(body);
    const insert = { ...(await pickEventColumns(body)), activity_id: activityIds.length ? Number(activityIds[0]) : null, created_by: String(req.user.id), status: body.status || 'Draft', approval_status: body.approval_status || 'Draft' };
    delete insert.activity_ids;
    const event = await EventHead.createEventHeadEvent(insert);
    if (activityIds.length) await EventHead.setEventHeadActivities(event.id, activityIds);
    const ctx = await buildEventContextMaps();
    return res.status(201).json((await enrichEvents([event], ctx))[0]);
  } catch (error) {
    if (error.code === '23503') return res.status(400).json({ message: 'NGO, sector or activity reference does not exist' });
    console.error('createEventHandler error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const listEventHeadEvents = async (req, res) => {
  try {
    const ngo_id = ownNgoId(req) || req.query.ngo_id;
    const { sector_id, activity_id, status, month, year } = req.query;
    const filters = { ngo_id, sector_id, activity_id, status, month, year };
    const events = await EventHead.getAllEventHeadEvents(filters);
    const ctx = await buildEventContextMaps();
    return res.json(await enrichEvents(events, ctx));
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const getEventHeadEvent = async (req, res) => {
  try {
    const event = await EventHead.getEventHeadEventById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    const ctx = await buildEventContextMaps();
    return res.json((await enrichEvents([event], ctx))[0]);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const updateEventHeadEvent = async (req, res) => {
  try {
    const body = sanitize(req.body);
    const activityIds = resolveActivityIds(body);
    // Only validate when the relation fields are being set (existing events may lack them).
    if (body.ngo_id && body.sector_id && activityIds.length) {
      const relation = await validateEventRelations(body);
      if (relation.error) return res.status(400).json({ message: relation.error.message });
    } else if (activityIds.length) {
      for (const id of activityIds) {
        const activity = await EventHead.getActivityById(id);
        if (!activity) return res.status(400).json({ message: 'Selected activity does not exist' });
        if (body.sector_id && String(activity.sector_id) !== String(body.sector_id)) {
          return res.status(400).json({ message: 'Selected sector does not belong to the selected activity' });
        }
      }
    }
    const timeErr = validateEventTimes(body);
    if (timeErr) return res.status(400).json({ message: timeErr.message });
    const updates = { ...(await pickEventColumns(body)) };
    delete updates.activity_ids;
    if (activityIds.length) updates.activity_id = Number(activityIds[0]);
    const event = await EventHead.updateEventHeadEvent(req.params.id, updates);
    if (activityIds.length) await EventHead.setEventHeadActivities(event.id, activityIds);
    const ctx = await buildEventContextMaps();
    return res.json((await enrichEvents([event], ctx))[0]);
  } catch (error) {
    if (error.code === '23503') return res.status(400).json({ message: 'NGO, sector or activity reference does not exist' });
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const deleteEventHeadEvent = async (req, res) => {
  try {
    const result = await EventHead.deleteEventHeadEvent(req.params.id);
    return res.json(result);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

// Bulk cleanup of events matching NGO + activity-name + date range. Used to
// remove generic sheet-imported events (e.g. BSCT "Awareness Campaign" rows)
// before loading the real per-NGO calendar data. Scope-limited: caller must
// provide at least one filter.
export const cleanupEvents = async (req, res) => {
  try {
    const { ngo_id, activity_name, start, end } = req.body || {};
    if (!ngo_id && !activity_name) {
      return res.status(400).json({ message: 'Provide at least one of ngo_id or activity_name to scope the cleanup.' });
    }

    let activityIds = null;
    if (activity_name) {
      const activities = await EventHead.getAllActivities().catch(() => []);
      const q = String(activity_name).toLowerCase();
      activityIds = new Set(
        (activities || [])
          .filter(a => String(a.name || '').toLowerCase().includes(q))
          .map(a => Number(a.id))
      );
    }

    const events = await EventHead.getEventHeadEventsByRange({ ngo_id, start, end });
    const targets = events.filter(ev => {
      if (activityIds && activityIds.size && !activityIds.has(Number(ev.activity_id))) return false;
      if (ngo_id && ev.ngo_id != null && String(ev.ngo_id) !== String(ngo_id)) return false;
      return true;
    });

    const removed = await EventHead.deleteEventHeadEventsBulk(targets.map(t => t.id));
    return res.json({ removed, matched: targets.length });
  } catch (error) {
    console.error('cleanupEvents error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const updateEventHeadStatus = async (req, res) => {
  try {
    const event = await EventHead.updateEventHeadEvent(req.params.id, { status: sanitize(req.body).status });
    return res.json(event);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const getEventHeadDashboard = async (req, res) => {
  try {
    const dash = await EventHead.getEventHeadDashboard();
    return res.json(dash);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

const pad2 = (n) => String(n).padStart(2, '0');
const toYmd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const NOT_HAPPENING = ['Cancelled', 'Postponed'];

// Ledger of the existing Event Head workflow states that genuinely need attention.
// Built only from reliably-determinable fields — no invented report/approval system.
const ATTENTION_LABELS = {
  overdue: 'Approved but overdue — mark completed',
  approval: 'Pending approval',
  info: 'Missing venue or start time',
};

export const getEventHeadDashboardStats = async (req, res) => {
  try {
    const ngo_id = ownNgoId(req) || req.query.ngo_id;
    const { sector_id, activity_id, month, year } = req.query;
    const base = { ngo_id, sector_id, activity_id, month, year };

    // core = full filter set (drives KPIs + today/upcoming/week/month lists).
    // byNgo = filter set minus NGO (drives the per-NGO breakdown).
    // sectorSummary = ngo + month/year only (drives the per-sector breakdown).
    const scope = ownNgoId(req);
    const [core, byNgo, sectorSummary, sectors, activities, ngos, ctx] = await Promise.all([
      EventHead.getEventHeadDashboardEvents(base),
      EventHead.getEventHeadDashboardEvents({ sector_id, activity_id, month, year }),
      EventHead.getEventHeadDashboardEvents({ ngo_id, month, year }),
      EventHead.getAllEventHeadSectors(),
      EventHead.getAllActivities(),
      EventHead.getAllEventHeadNgos(),
      buildEventContextMaps(),
    ]);

    const now = new Date();
    const todayStr = toYmd(now);
    const weekDay = (now.getDay() + 6) % 7;
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - weekDay);
    const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const inRange = (e, start, end) => !!e.date && e.date >= toYmd(start) && e.date < toYmd(end);
    const NOT_UPCOMING_STATUS = ['Cancelled', 'Postponed', 'Completed', 'Rejected', 'Closed'];
    const isUpcoming = (e) => !!e.date && e.date >= todayStr && !NOT_UPCOMING_STATUS.includes(e.status);
    const isToday = (e) => e.date === todayStr && !NOT_HAPPENING.includes(e.status);
    const byDate = (a, b) => (a.date || '').localeCompare(b.date || '');
    const byTime = (a, b) => (a.date || '').localeCompare(b.date || '') || (a.start_time || '').localeCompare(b.start_time || '');
    const enrich = (ev) => enrichEvent(ev, ctx);

    const todayEvents = core.filter(isToday).sort(byTime);
    const upcomingEvents = core.filter(isUpcoming).sort(byDate);
    const weekEvents = core.filter(e => isUpcoming(e) && inRange(e, weekStart, weekEnd)).sort(byDate);
    const inMonth = core.filter(e => inRange(e, monthStart, monthEnd));

    const ngoCounts = {};
    for (const e of byNgo) if (e.ngo_id != null) ngoCounts[e.ngo_id] = (ngoCounts[e.ngo_id] || 0) + 1;
    const scopedNgos = scope ? ngos.filter(n => String(n.id) === scope) : ngos;
    const events_by_ngo = scopedNgos.map(n => ({
      ngo_id: n.id,
      ngo_name: n.name || n.code,
      count: ngoCounts[n.id] || 0,
    }));

    const sectorEventCounts = {};
    for (const e of sectorSummary) if (e.sector_id != null) sectorEventCounts[e.sector_id] = (sectorEventCounts[e.sector_id] || 0) + 1;
    const sectorActivityCounts = {};
    for (const a of activities) {
      if (ngo_id && a.ngo_id != null && String(a.ngo_id) !== String(ngo_id)) continue;
      if (a.sector_id == null) continue;
      sectorActivityCounts[a.sector_id] = (sectorActivityCounts[a.sector_id] || 0) + 1;
    }
    const events_by_sector = sectors
      .filter(s => s.is_active !== false)
      .map(s => ({
        ...s,
        activity_count: sectorActivityCounts[s.id] || 0,
        event_count: sectorEventCounts[s.id] || 0,
      }));

    const activityIdx = {};
    for (const a of activities) activityIdx[a.id] = a;
    const upcomingCounts = {};
    const nextDates = {};
    for (const e of upcomingEvents) {
      if (e.activity_id == null) continue;
      upcomingCounts[e.activity_id] = (upcomingCounts[e.activity_id] || 0) + 1;
      if (!nextDates[e.activity_id] || e.date < nextDates[e.activity_id]) nextDates[e.activity_id] = e.date;
    }
    const activities_with_upcoming_events = Object.keys(upcomingCounts)
      .map((activityId) => {
        const a = activityIdx[activityId];
        const ngoName = a && a.ngo_id != null ? (ctx.ngoMap[a.ngo_id] || null) : (a ? 'All NGOs' : null);
        return {
          activity_id: Number(activityId),
          activity_name: a ? a.name : null,
          sector_id: a ? a.sector_id : null,
          sector_name: a && a.sector_id != null ? (ctx.sectorMap[a.sector_id] || null) : null,
          ngo_id: a ? a.ngo_id : null,
          ngo_name: ngoName,
          upcoming_count: upcomingCounts[activityId],
          next_event_date: nextDates[activityId],
        };
      })
      .filter(x => x.activity_name)
      .sort((p, q) => (p.next_event_date || '').localeCompare(q.next_event_date || ''));

    const attention = [];
    for (const e of core) {
      if (['Draft', 'Submitted'].includes(e.status)) {
        attention.push({ ...e, attention_type: 'approval', attention_reason: ATTENTION_LABELS.approval });
      } else if (e.status === 'Approved' && e.date && e.date < todayStr) {
        attention.push({ ...e, attention_type: 'overdue', attention_reason: ATTENTION_LABELS.overdue });
      } else if (isUpcoming(e) && (!e.venue || !e.start_time)) {
        attention.push({ ...e, attention_type: 'info', attention_reason: ATTENTION_LABELS.info });
      }
    }
    const attentionRank = { overdue: 0, info: 1, approval: 2 };
    attention.sort((a, b) => attentionRank[a.attention_type] - attentionRank[b.attention_type] || byDate(a, b));

    const kpis = {
      total_events: core.length,
      upcoming_events: upcomingEvents.length,
      today_events: todayEvents.length,
      completed_events: core.filter(e => e.status === 'Completed').length,
      budget_total: core.reduce((s, e) => s + (+e.budget || 0), 0),
      beneficiaries_total: core.reduce((s, e) => s + (+e.expected_beneficiaries || 0), 0),
    };

    return res.json({
      generated_at: new Date().toISOString(),
      filters: base,
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
    });
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const getEventHeadEventsByMonth = async (req, res) => {
  try {
    const ngo_id = ownNgoId(req) || null;
    const events = await EventHead.getEventHeadEventsByMonth(req.params.month, req.params.year, ngo_id);
    return res.json(events);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

// FullCalendar endpoint: returns FullCalendar-compatible events within a visible
// date range, supporting start/end + NGO/Sector/Activity/Status/Year filters.
export const getEventHeadCalendar = async (req, res) => {
  try {
    const { start, end, year, status } = req.query;
    const ngo_id = ownNgoId(req) || req.query.ngoId || req.query.ngo_id;
    const sector_id = req.query.sectorId || req.query.sector_id;
    const activity_id = req.query.activityId || req.query.activity_id;
    const events = await EventHead.getEventHeadEventsByRange({ start, end, ngo_id, sector_id, activity_id, status, year });
    const ctx = await buildEventContextMaps();
    const enriched = await enrichEvents(events, ctx);
    return res.json(enriched.map(e => {
      const day = String(e.date || '').slice(0, 10);
      const st = (e.start_time || '').slice(0, 5) || '00:00';
      const en = (e.end_time || '').slice(0, 5) || '00:00';
      const hasTime = Boolean(e.start_time || e.end_time);
      return {
        id: String(e.id),
        title: (e.name || 'Untitled Event') + (e.ngo_name ? ` · ${e.ngo_name}` : ''),
        start: hasTime ? `${day}T${st}` : day,
        end: hasTime ? `${day}T${en}` : day,
        allDay: !hasTime,
        extendedProps: {
          id: e.id,
          ngoId: e.ngo_id,
          ngoName: e.ngo_name || null,
          sectorId: e.sector_id,
          sectorName: e.sector_name || null,
          activities: e.activities || [],
          status: e.status || null,
          priority: e.priority || null,
          venue: e.venue || null,
          description: e.description || e.notes || null,
          date: e.date || null,
          startTime: e.start_time || null,
          endTime: e.end_time || null,
        },
      };
    }));
  } catch (error) {
    console.error('getEventHeadCalendar error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const getEventHeadEventsByNgo = async (req, res) => {
  try {
    const ngoId = ownNgoId(req) || req.params.ngoId;
    const events = await EventHead.getEventHeadEventsByNgo(ngoId);
    return res.json(events);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const getEventHeadEventsByState = async (req, res) => {
  try {
    const events = await EventHead.getEventHeadEventsByState(req.params.state);
    return res.json(events);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const submitEventHeadApproval = async (req, res) => {
  try {
    const event = await EventHead.updateEventHeadEvent(req.params.id, { status: 'Submitted', approval_status: 'Submitted' });
    return res.json(event);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const approveEventHeadEvent = async (req, res) => {
  try {
    const event = await EventHead.updateEventHeadEvent(req.params.id, { status: 'Approved', approval_status: 'Approved' });
    return res.json(event);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const rejectEventHeadEvent = async (req, res) => {
  try {
    const event = await EventHead.updateEventHeadEvent(req.params.id, { status: 'Rejected', approval_status: 'Rejected' });
    return res.json(event);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── ASSETS ───
export const createAsset = async (req, res) => {
  try {
    const asset = await EventHead.createAsset(sanitize(req.body));
    return res.status(201).json(asset);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const listAssets = async (req, res) => {
  try {
    const assets = await EventHead.getAllAssets();
    return res.json(assets);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const getAsset = async (req, res) => {
  try {
    const asset = await EventHead.getAssetById(req.params.id);
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    return res.json(asset);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const editAsset = async (req, res) => {
  try {
    const asset = await EventHead.updateAsset(req.params.id, sanitize(req.body));
    return res.json(asset);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const removeAsset = async (req, res) => {
  try {
    const result = await EventHead.deleteAsset(req.params.id);
    return res.json(result);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const issueAssetItem = async (req, res) => {
  try {
    const asset = await EventHead.issueAsset(req.params.id, sanitize(req.body).quantity);
    return res.json(asset);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const returnAssetItem = async (req, res) => {
  try {
    const asset = await EventHead.returnAsset(req.params.id);
    return res.json(asset);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const getAssetUtilization = async (req, res) => {
  try {
    const data = await EventHead.getAllAssets();
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── MATERIALS ───
export const createMaterial = async (req, res) => {
  try {
    const material = await EventHead.createMaterial(sanitize(req.body));
    return res.status(201).json(material);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const listMaterials = async (req, res) => {
  try {
    const materials = await EventHead.getAllMaterials();
    return res.json(materials);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const editMaterial = async (req, res) => {
  try {
    const material = await EventHead.updateMaterial(req.params.id, sanitize(req.body));
    return res.json(material);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const removeMaterial = async (req, res) => {
  try {
    const result = await EventHead.deleteMaterial(req.params.id);
    return res.json(result);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const getMaterialStock = async (req, res) => {
  try {
    const stock = await EventHead.getMaterialStock();
    return res.json(stock);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const adjustMaterialStock = async (req, res) => {
  try {
    const material = await EventHead.adjustMaterialStock(req.params.id, sanitize(req.body).adjustment);
    return res.json(material);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── DISTRIBUTIONS ───
export const createDistribution = async (req, res) => {
  try {
    const dist = await EventHead.createDistribution(req.params.eventId, sanitize(req.body));
    return res.status(201).json(dist);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const listDistributions = async (req, res) => {
  try {
    const dists = await EventHead.getDistributionsByEvent(req.params.eventId);
    return res.json(dists);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── BENEFICIARIES ───
export const listBeneficiaries = async (req, res) => {
  try {
    const beneficiaries = await EventHead.getAllDistributions();
    return res.json(beneficiaries);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const createBeneficiary = async (req, res) => {
  try {
    return res.json({ message: 'Beneficiary created' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── VOLUNTEERS ───
export const createVolunteer = async (req, res) => {
  try {
    const volunteer = await EventHead.createVolunteer(sanitize(req.body));
    return res.status(201).json(volunteer);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const listVolunteers = async (req, res) => {
  try {
    const volunteers = await EventHead.getAllVolunteers();
    return res.json(volunteers);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const listVolunteerPeople = async (req, res) => {
  try {
    const people = await EventHead.getVolunteerPeople();
    return res.json(people);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const editVolunteer = async (req, res) => {
  try {
    const volunteer = await EventHead.updateVolunteer(req.params.id, sanitize(req.body));
    return res.json(volunteer);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── EXPENSES ───
export const createExpense = async (req, res) => {
  try {
    const expense = await EventHead.createExpense(req.params.eventId, sanitize(req.body));
    return res.status(201).json(expense);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const listExpenses = async (req, res) => {
  try {
    const expenses = await EventHead.getExpensesByEvent(req.params.eventId);
    return res.json(expenses);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const removeExpense = async (req, res) => {
  try {
    const result = await EventHead.deleteExpense(req.params.eventId, req.params.id);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── VEHICLES ───
export const createVehicle = async (req, res) => {
  try {
    const vehicle = await EventHead.createVehicle(sanitize(req.body));
    return res.status(201).json(vehicle);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const listVehicles = async (req, res) => {
  try {
    const vehicles = await EventHead.getAllVehicles();
    return res.json(vehicles);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const assignVehicle = async (req, res) => {
  try {
    const vehicle = await EventHead.assignVehicle(sanitize(req.body));
    return res.status(201).json(vehicle);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── MEDIA ───
// Upload a memory-backed multer file to the S3 "event" folder
// (<S3_BUCKET>/event/<file>) and return its public URL.
const uploadEventFile = async (file) => {
  const ext = (file.originalname && '.' + String(file.originalname).split('.').pop()) || '';
  const key = `event/${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext.replace(/[^a-z0-9.]/gi, '').slice(0, 12)}`;
  const { data, error } = await db.storage.from('event').upload(key, file.buffer, { contentType: file.mimetype });
  if (error) throw new Error('Upload to S3 failed: ' + error.message);
  const { data: urlData } = db.storage.from('event').getPublicUrl(key);
  return { url: urlData?.publicUrl || `event/${key}`, key };
};
const normalizeMedia = (m) => ({
  ...m,
  title: m.title || m.name || null,
  description: m.description || null,
  media_type: m.media_type || categorizeMedia(m) || null,
  year: m.year != null ? Number(m.year) : null,
  size: m.size != null ? Number(m.size) : null,
  uploaded_by: m.uploaded_by || null,
});
const categorizeMedia = (m) => {
  const type = String(m.type || '').toLowerCase();
  const url = String(m.url || '').toLowerCase();
  if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/.test(url)) return 'Photo';
  if (type.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv)$/.test(url)) return 'Video';
  if (type.includes('pdf') || /\.pdf$/i.test(url)) return 'Document';
  if (/\.(docx?|xlsx?|pptx?|txt|csv)$/.test(url)) return 'Document';
  return 'Other';
};
const pickMediaMeta = (body, file, s3Url = null) => {
  const clean = sanitize(body);
  const size = file?.size != null ? Number(file.size) : (clean.size != null ? Number(clean.size) : null);
  const meta = {
    name: file?.originalname || clean.name || clean.title || `${Date.now()}`,
    url: clean.url || s3Url || `/uploads/${file?.filename || ''}`,
    type: file?.mimetype || clean.type || clean.media_type || null,
    title: clean.title || file?.originalname || clean.name || null,
    description: clean.description || null,
    media_type: clean.media_type || null,
    year: clean.year != null ? Number(clean.year) : null,
  };
  if (size != null && !Number.isNaN(size)) meta.size = size;
  return meta;
};
export const uploadEventBanner = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const { url } = await uploadEventFile(req.file);
    return res.json({ url });
  } catch (error) {
    console.error('uploadEventBanner error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const uploadMedia = async (req, res) => {
  try {
    // multer.fields() yields req.files = { file: [...], files: [...] };
    // multer.single() yields req.file. Collect all uploaded files either way.
    const uploaded = [];
    if (Array.isArray(req.files)) uploaded.push(...req.files);
    else if (req.files && typeof req.files === 'object') {
      for (const k of Object.keys(req.files)) uploaded.push(...(req.files[k] || []));
    }
    if (uploaded.length > 0) {
      const saved = [];
      for (const f of uploaded) {
        const { url } = await uploadEventFile(f);
        saved.push(await EventHead.createMedia(req.params.eventId, pickMediaMeta({ ...req.body, name: f.originalname }, f, url)));
      }
      return res.status(201).json(saved.map(normalizeMedia));
    }
    if (req.file) {
      const { url } = await uploadEventFile(req.file);
      const media = await EventHead.createMedia(req.params.eventId, pickMediaMeta(req.body, req.file, url));
      return res.status(201).json(normalizeMedia(media));
    }
    // No file — allow creating a media record by URL only (documents/other).
    const media = await EventHead.createMedia(req.params.eventId, pickMediaMeta(req.body, null));
    return res.status(201).json(normalizeMedia(media));
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const listMedia = async (req, res) => {
  try {
    const media = await EventHead.getMediaByEvent(req.params.eventId);
    return res.json((media || []).map(normalizeMedia));
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const listMediaByNgo = async (req, res) => {
  try {
    const ngoId = ownNgoId(req) || req.params.ngoId;
    if (!ngoId) return res.status(400).json({ message: 'NgoId is required' });
    const media = await EventHead.getMediaByNgo(ngoId);
    return res.json((media || []).map(m => {
      const norm = normalizeMedia(m);
      const ev = m.event_head_events;
      if (ev) {
        norm.event_id = ev.id != null ? ev.id : norm.event_id;
        norm.event_name = ev.name || null;
        norm.event_date = ev.date || null;
      }
      return norm;
    }));
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const replaceMedia = async (req, res) => {
  try {
    const existing = await EventHead.getMediaById(req.params.eventId, req.params.id);
    if (!existing) return res.status(404).json({ message: 'Media not found' });
    const clean = sanitize(req.body);
    const updates = {};
    if (req.file) {
      const { url } = await uploadEventFile(req.file);
      updates.url = clean.url || url;
      if (req.file.mimetype) updates.type = req.file.mimetype;
      updates.name = req.file.originalname || clean.name || existing.name;
      if (req.file.size != null) updates.size = Number(req.file.size);
    }
    if (clean.title != null) updates.title = clean.title;
    if (clean.description != null) updates.description = clean.description;
    if (clean.media_type != null) updates.media_type = clean.media_type;
    if (clean.year != null) updates.year = Number(clean.year);
    if (clean.uploaded_by != null) updates.uploaded_by = clean.uploaded_by;
    const media = await EventHead.updateMedia(req.params.eventId, req.params.id, updates);
    return res.json(normalizeMedia(media));
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const removeMedia = async (req, res) => {
  try {
    const result = await EventHead.deleteMedia(req.params.eventId, req.params.id);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Download a media file as an attachment. Media lives on a cross-origin
// S3/Supabase public URL; fetching it server-side avoids browser CORS and
// lets us stream it back with Content-Disposition: attachment so the client
// saves the file instead of opening it in a new tab.
const asciiSafeFilename = (s) => String(s || '').replace(/[^\x20-\x7e]/g, '_').replace(/["\\\r\n]/g, '_').slice(0, 180) || 'download';
const utf8Filename = (s) => String(s || '').replace(/["\\\r\n]/g, '_').slice(0, 180) || 'download';

export const downloadMedia = async (req, res) => {
  try {
    const media = await EventHead.getMediaById(req.params.eventId, req.params.id);
    if (!media) return res.status(404).json({ message: 'Media not found' });
    if (!media.url || /^(youtu|instagram|facebook)/i.test(String(media.url)) || String(media.url).indexOf('http') !== 0) {
      return res.status(400).json({ message: 'This media has no downloadable file (it is a social link).' });
    }
    const remote = await fetch(media.url, { redirect: 'follow' });
    if (!remote.ok) return res.status(502).json({ message: 'Failed to retrieve the media file.' });
    const buffer = Buffer.from(await remote.arrayBuffer());
    const base = asciiSafeFilename(media.title || media.name || media.url.split('/').pop());
    const ext = media.type ? String(media.type).split('/')[1] : null;
    const fileName = /^[A-Za-z0-9._-]+$/.test(base) ? base : (base + (ext ? '.' + ext : ''));
    res.setHeader('Content-Type', media.type || 'application/octet-stream');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-store, no-cache');
    res.setHeader('Content-Disposition', `attachment; filename="${asciiSafeFilename(base)}"; filename*=UTF-8''${encodeURIComponent(utf8Filename(base))}`);
    return res.send(buffer);
  } catch (error) {
    console.error('eventHeadController downloadMedia error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

// ─── ATTENDANCE ───
export const createAttendance = async (req, res) => {
  try {
    const att = await EventHead.createAttendance(req.params.eventId, sanitize(req.body));
    return res.status(201).json(att);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const listAttendance = async (req, res) => {
  try {
    const attendance = await EventHead.getAttendanceByEvent(req.params.eventId);
    return res.json(attendance);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── CHECKLIST ───
export const getChecklist = async (req, res) => {
  try {
    const items = await EventHead.getChecklistByEvent(req.params.eventId);
    return res.json(items);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const updateChecklistItem = async (req, res) => {
  try {
    const item = await EventHead.upsertChecklistItem(req.params.eventId, { id: req.params.itemId, ...sanitize(req.body) });
    return res.json(item);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const createChecklistItem = async (req, res) => {
  try {
    const item = await EventHead.createChecklistItem(req.params.eventId, sanitize(req.body));
    return res.status(201).json(item);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

// ─── PARTNERS ───
export const listPartners = async (req, res) => {
  try {
    const partners = await EventHead.getAllPartners();
    return res.json(partners);
  } catch (error) {
    return res.json([]);
  }
};

// ─── DONORS ───
export const listDonors = async (req, res) => {
  try {
    const donors = await EventHead.getAllDonors();
    return res.json(donors);
  } catch (error) {
    return res.json([]);
  }
};

// ─── REPORTS ───
export const generateEventReport = async (req, res) => {
  try {
    const event = await EventHead.getEventHeadEventById(req.params.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    const expenses = await EventHead.getExpensesByEvent(req.params.eventId);
    const attendance = await EventHead.getAttendanceByEvent(req.params.eventId);
    const media = await EventHead.getMediaByEvent(req.params.eventId);
    const checklist = await EventHead.getChecklistByEvent(req.params.eventId);
    const distributions = await EventHead.getDistributionsByEvent(req.params.eventId);

    const { ngoMap, sectorMap, activityMap } = await buildEventContextMaps();
    const activitiesList = await EventHead.getAllActivities().catch(() => []);
    const activityById = {}; for (const a of activitiesList) activityById[a.id] = a;
    const evActivity = event.activity_id != null ? activityById[event.activity_id] : null;

    const day = event.date ? new Date(String(event.date).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : null;

    const enrichedEvent = {
      ...event,
      ngo_name: event.ngo_id != null ? ngoMap[event.ngo_id] || null : null,
      sector_name: event.sector_id != null ? sectorMap[event.sector_id] || null : null,
      activity_name: evActivity ? evActivity.name : (event.activity_id != null ? activityMap[event.activity_id] || null : null),
      banner: event.banner || (evActivity ? evActivity.banner || null : null) || (Array.isArray(media) ? (media.find(m => m.media_type === 'Banner') || {}).url || null : null),
      day,
    };

    const report = { event: enrichedEvent, expenses, attendance, media, checklist, distributions, generated_at: new Date() };
    return res.json(report);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── ALL-EVENTS SUMMARY REPORT ───
export const generateAllEventsReport = async (req, res) => {
  try {
    const ngo_id = ownNgoId(req) || req.query.ngo_id || undefined;
    const { status, month, year } = req.query;
    const events = await EventHead.getAllEventHeadEvents({ ngo_id, status, month, year });
    const ctx = await buildEventContextMaps();
    const enriched = await enrichEvents(events, ctx);
    // Fetch Banner media rows for all events to fill missing banners
    const eventIds = enriched.map(e => e.id).filter(Boolean);
    const bannerRows = await EventHead.getBannerMediaByEvents(eventIds);
    const bannerMap = {};
    for (const row of bannerRows) {
      if (!bannerMap[row.event_id]) bannerMap[row.event_id] = row.url;
    }
    const rows = enriched.map(e => ({
      id: e.id,
      name: e.name,
      ngo_name: e.ngo_name || null,
      sector_name: e.sector_name || null,
      activity_name: e.activity_name || null,
      date: e.date || null,
      day: e.date ? new Date(String(e.date).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }) : null,
      start_time: e.start_time || null,
      end_time: e.end_time || null,
      venue: e.venue || null,
      status: e.status || null,
      budget: e.budget != null ? Number(e.budget) : null,
      banner: e.banner || bannerMap[e.id] || null,
    }));
    return res.json({ events: rows, total: rows.length, generated_at: new Date() });
  } catch (error) {
    console.error('generateAllEventsReport error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

// ─── NGO MONTHLY REPORT ───
// Groups events by NGO for a selected month/year and returns a per-NGO KPI
// summary (event counts, submitted/completed, beneficiaries, budget). Supports
// an optional ngo_id filter so the UI can show "All NGOs" or a single NGO.
export const generateNgoMonthlyReport = async (req, res) => {
  try {
    const month = String(req.query.month || '').trim();
    const year = String(req.query.year || '').trim();
    const ngo_id = ownNgoId(req) || req.query.ngo_id || undefined;

    if (!month || !year) {
      return res.status(400).json({ message: 'month and year are required' });
    }

    const events = await EventHead.getAllEventHeadEvents({ ngo_id, month, year });
    const ctx = await buildEventContextMaps();
    const enriched = await enrichEvents(events, ctx);

    // Event banners (uploaded when the event was created) from the media table,
    // with the event's own banner column as the primary source.
    const eventBannerMap = {};
    const eventIds = enriched.map(e => e.id).filter(Boolean);
    try {
      const bannerRows = await EventHead.getBannerMediaByEvents(eventIds);
      for (const row of bannerRows) {
        if (!eventBannerMap[row.event_id]) eventBannerMap[row.event_id] = row.url;
      }
    } catch { /* banners are optional */ }

    // NGO header banner (letter-head) mapped by NGO name/code.
    const NGO_HEADER_BANNERS = {
      mann: '/Letter%20Head%20MANN.png',
      'mann care': '/Letter%20Head%20MANN.png',
      'mann care foundation': '/Letter%20Head%20MANN.png',
      aflf: '/Letter%20Head%20AFLF.png',
      'aflf': '/Letter%20Head%20AFLF.png',
      'ashray for life foundation': '/Letter%20Head%20AFLF.png',
      bsct: '/Letter%20Head%20BSCT%20(1).png',
      'bsct': '/Letter%20Head%20BSCT%20(1).png',
      'beingsevak': '/Letter%20Head%20BSCT%20(1).png',
    };
    // NGO logos mapped by NGO code.
    const NGO_LOGOS = {
      mann: '/logo/mann-logo.png',
      aflf: '/logo/aflf-logo.png',
      bsct: '/logo/beingsevak-logo.png',
    };
    const ngoHeaderBanner = (name, code) => {
      const k = String(name || code || '').trim().toLowerCase();
      if (NGO_HEADER_BANNERS[k]) return NGO_HEADER_BANNERS[k];
      for (const key of Object.keys(NGO_HEADER_BANNERS)) {
        if (k.includes(key)) return NGO_HEADER_BANNERS[key];
      }
      return null;
    };

    const byNgo = new Map();
    for (const e of enriched) {
      const id = e.ngo_id != null ? String(e.ngo_id) : 'unknown';
      if (!byNgo.has(id)) {
        const code = ctx.ngoCodeMap ? (ctx.ngoCodeMap[e.ngo_id] || '') : '';
        byNgo.set(id, {
          ngo_id: e.ngo_id != null ? e.ngo_id : null,
          ngo_name: e.ngo_name || ctx.ngoMap[e.ngo_id] || `NGO ${e.ngo_id || ''}`.trim(),
          code,
          logo: NGO_LOGOS[code] || (code ? `/logo/${code}-logo.png` : null),
          banner: ngoHeaderBanner(e.ngo_name, ctx.ngoMap[e.ngo_id]),
          events_count: 0,
          submitted: 0,
          completed: 0,
          pending: 0,
          beneficiaries: 0,
          budget: 0,
          events: [],
        });
      }
      const row = byNgo.get(id);
      row.events_count += 1;
      const st = String(e.status || '').trim();
      const norm = st.toLowerCase();
      if (norm === 'submitted' || norm === 'submitted&' || norm === 'pending approval' || norm === 'approval pending') row.submitted += 1;
      else if (st === 'Completed') row.completed += 1;
      else row.pending += 1;
      row.beneficiaries += Number(e.expected_beneficiaries) || 0;
      row.budget += Number(e.budget) || 0;
      row.events.push({
        id: e.id,
        name: e.name,
        date: e.date || null,
        day: e.date ? new Date(String(e.date).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }) : null,
        sector_name: e.sector_name || null,
        activity_name: e.activity_name || null,
        venue: e.venue || null,
        status: e.status || null,
        budget: e.budget != null ? Number(e.budget) : null,
        beneficiaries: e.expected_beneficiaries != null ? Number(e.expected_beneficiaries) : 0,
        banner: e.banner || eventBannerMap[e.id] || null,
      });
    }

    const ngos = [...byNgo.values()]
      .map(n => ({ ...n, budget: Math.round(n.budget) }))
      .sort((a, b) => a.ngo_name.localeCompare(b.ngo_name));

    const totalEvents = ngos.reduce((s, n) => s + n.events_count, 0);
    const totalBudget = ngos.reduce((s, n) => s + n.budget, 0);
    const totalBeneficiaries = ngos.reduce((s, n) => s + n.beneficiaries, 0);

    return res.json({
      month: Number(month),
      year: Number(year),
      ngo_id: ngo_id || null,
      ngos,
      summary: { totalEvents, totalBudget, totalBeneficiaries },
      generated_at: new Date(),
    });
  } catch (error) {
    console.error('generateNgoMonthlyReport error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

// ─── APPROVALS LIST ───
export const listApprovals = async (req, res) => {
  try {
    const events = await EventHead.getAllEventHeadEvents();
    return res.json(events);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── NGO CONTEXT (read-only for the Event Head workspace) ───
export const listEventHeadNgos = async (req, res) => {
  try {
    const ngos = await EventHead.getAllEventHeadNgos();
    const scope = ownNgoId(req);
    return res.json(scope ? ngos.filter(n => String(n.id) === scope) : ngos);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

// ─── SECTORS ───
export const listSectors = async (req, res) => {
  try {
    const ngo_id = ownNgoId(req) || req.query.ngo_id;
    const [sectors, activityCounts, eventCounts] = await Promise.all([
      EventHead.getAllEventHeadSectors(),
      EventHead.getSectorActivityCounts(ngo_id),
      EventHead.getSectorEventCounts(ngo_id),
    ]);
    const enriched = sectors.map(s => ({
      ...s,
      activity_count: activityCounts[s.id] || 0,
      event_count: eventCounts[s.id] || 0,
    }));
    return res.json(enriched);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const createSector = async (req, res) => {
  try {
    const clean = sanitize(req.body);
    if (!String(clean.name || '').trim()) return res.status(400).json({ message: 'Sector name is required' });
    const sector = await EventHead.createEventHeadSector({ name: clean.name, description: clean.description });
    return res.status(201).json(sector);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

// ─── ACTIVITIES ───
export const listActivities = async (req, res) => {
  try {
    const ngo_id = ownNgoId(req) || req.query.ngo_id;
    const { sector_id } = req.query;
    const [activities, ngos, sectors, eventCounts] = await Promise.all([
      EventHead.getAllActivities({ ngo_id, sector_id }),
      EventHead.getAllEventHeadNgos().catch(() => []),
      EventHead.getAllEventHeadSectors().catch(() => []),
      EventHead.getActivityEventCounts(),
    ]);
    const ngoNames = {}; for (const n of ngos) ngoNames[n.id] = n.name || n.code;
    const sectorNames = {}; for (const s of sectors) sectorNames[s.id] = s.name;
    const enriched = activities.map(a => ({
      ...a,
      ngo_name: a.ngo_id ? ngoNames[a.ngo_id] || null : 'All NGOs',
      sector_name: sectorNames[a.sector_id],
      event_count: eventCounts[a.id] || 0,
    }));
    return res.json(enriched);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const getActivity = async (req, res) => {
  try {
    const activity = await EventHead.getActivityById(req.params.id);
    if (!activity) return res.status(404).json({ message: 'Activity not found' });
    const [ngo, sectors, eventCounts, events] = await Promise.all([
      EventHead.getEventHeadNgoById(activity.ngo_id),
      EventHead.getAllEventHeadSectors().catch(() => []),
      EventHead.getActivityEventCounts(),
      EventHead.getAllEventHeadEvents().catch(() => []),
    ]);
    const sector = sectors.find(s => s.id === activity.sector_id) || null;
    const activityEvents = (events || []).filter(e => e.activity_id === activity.id)
      .map(e => ({ id: e.id, name: e.name, date: e.date, status: e.status, venue: e.venue }));
    return res.json({
      ...activity,
      ngo_name: activity.ngo_id ? (ngo ? ngo.name || ngo.code : null) : 'All NGOs',
      sector_name: sector ? sector.name : null,
      sector_description: sector ? sector.description : null,
      event_count: eventCounts[activity.id] || 0,
      events: activityEvents,
    });
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const createActivity = async (req, res) => {
  try {
    const body = sanitize(req.body);
    const name = String(body.name || '').trim();
    if (!name || !body.sector_id) {
      return res.status(400).json({ message: 'Activity name and sector are required' });
    }
    const activity = await EventHead.createActivity({
      ...body,
      name,
      created_by: String(req.user.id || ''),
      status: body.status || 'Active',
    });
    return res.status(201).json(activity);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'An activity with this name already exists for this NGO' });
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

// ─── ACTIVITIES SHEET IMPORT / EXPORT ───
// Upload an Excel/CSV sheet of the user's NGO activities; rows go straight
// into the DB under each activity's NGO catalog (per-sector). When the sheet
// carries its own "NGO" column (e.g. the combined BSCT/MANN/AFLF team sheet),
// each row is assigned to the NGO named in that column. Otherwise the activity
// is assigned to the NGO selected in the dropdown / passed as ngo_code.
export const importActivities = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'No file uploaded' });

    const ngos = await EventHead.getAllEventHeadNgos();
    let defaultNgo = null;
    const code = String(req.body.ngo_code || '').trim().toUpperCase();
    if (code) defaultNgo = ngos.find(n => String(n.code || n.name || '').toUpperCase() === code);
    if (!defaultNgo && req.body.ngo_id) defaultNgo = ngos.find(n => String(n.id) === String(req.body.ngo_id));

    const ngoByCode = new Map();
    for (const n of ngos) ngoByCode.set(String(n.code || n.name || '').toUpperCase(), n);
    const normNgoKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ');
    const ngoByKey = new Map();
    for (const n of ngos) ngoByKey.set(normNgoKey(n.code || n.name), n);

    const { rows, hasNgoColumn } = parseActivitySheet(file.buffer);
    if (!rows.length) return res.status(400).json({ message: 'No activities found in the sheet' });

    const sectors = await EventHead.getAllEventHeadSectors();
    const sectorNames = sectors.map(s => s.name);
    const sectorByName = new Map(sectors.map(s => [s.name, s.id]));

    const prepared = [];
    const skippedCampaigns = new Set();
    const unknownSectors = new Map();
    const unknownNgos = new Map();
    const sectorCounts = {};
    const ngoCounts = {};
    const seen = new Set();
    let rowsParsed = 0;

    for (const row of rows) {
      const name = normalizeName(row.name);
      if (!name) continue;
      rowsParsed++;

      // Resolve the target NGO. Prefer a per-row NGO column when present;
      // otherwise fall back to the single NGO selected in the dropdown.
      let ngo;
      if (hasNgoColumn && row.ngoLabel) {
        ngo = ngoByKey.get(normNgoKey(row.ngoLabel)) || ngoByCode.get(String(row.ngoLabel).toUpperCase());
        if (!ngo) {
          unknownNgos.set(row.ngoLabel, (unknownNgos.get(row.ngoLabel) || 0) + 1);
          continue;
        }
      } else {
        ngo = defaultNgo;
      }
      if (!ngo) return res.status(404).json({ message: `NGO not found. Use BSCT, MANN or AFLF.` });

      if (isCampaignName(name)) { skippedCampaigns.add(name); continue; }
      const canonical = canonicalizeSector(row.sectorLabel, sectorNames);
      const sectorId = sectorByName.get(canonical);
      if (!sectorId) {
        unknownSectors.set(row.sectorLabel, (unknownSectors.get(row.sectorLabel) || 0) + 1);
        continue;
      }
      const key = `${ngo.id}\u0000${sectorId}\u0000${name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      prepared.push({
        ngo_id: ngo.id,
        sector_id: sectorId,
        name,
        description: `Imported from sheet for ${ngo.code || ngo.name}`,
        status: 'Active',
        created_by: String(req.user.id || ''),
      });
      sectorCounts[canonical] = (sectorCounts[canonical] || 0) + 1;
      ngoCounts[String(ngo.id)] = (ngoCounts[String(ngo.id)] || 0) + 1;
    }

    const inserted = await EventHead.insertActivitiesBulk(prepared);

    const perNgo = Object.entries(ngoCounts).map(([ngoId, count]) => {
      const n = ngos.find(x => String(x.id) === String(ngoId));
      return { ngo: n ? (n.code || n.name) : `NGO ${ngoId}`, count };
    });

    return res.json({
      ngo: { id: defaultNgo ? defaultNgo.id : null, code: defaultNgo ? (defaultNgo.code || defaultNgo.name) : '—', name: defaultNgo ? defaultNgo.name : '—' },
      ngo_from_file: !!hasNgoColumn,
      per_ngo: perNgo,
      sheet: file.originalname,
      rows_parsed: rowsParsed,
      inserted: inserted.length,
      skipped_existing: prepared.length - inserted.length,
      skipped_campaigns: [...skippedCampaigns],
      unknown_sectors: [...unknownSectors.entries()].map(([label, count]) => ({ sector: label, count })),
      unknown_ngos: [...unknownNgos.entries()].map(([label, count]) => ({ ngo: label, count })),
      sectors: Object.entries(sectorCounts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([sector_name, count]) => ({ sector_name, count })),
    });
  } catch (error) {
    if (error && error.message && /Could not find|NGO/.test(error.message)) {
      return res.status(400).json({ message: error.message });
    }
    console.error('importActivities error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

// ─── EVENTS SHEET IMPORT / EXPORT ───
// Upload an Excel/CSV sheet of the user's NGO events; each row becomes an event
// in the DB, linked to the right NGO / Sector / Activity. Activities are matched
// by name inside the resolved sector (NGO-specific first, then "All NGOs").
export const importEvents = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'No file uploaded' });

    const ngos = await EventHead.getAllEventHeadNgos();
    let defaultNgo = null;
    const code = String(req.body.ngo_code || '').trim().toUpperCase();
    if (code) defaultNgo = ngos.find(n => String(n.code || n.name || '').toUpperCase() === code);
    if (!defaultNgo && req.body.ngo_id) defaultNgo = ngos.find(n => String(n.id) === String(req.body.ngo_id));

    // All-NGO mode: one sheet is imported for every event-head NGO at once
    // (BSCT + MANN + AFLF) so the user doesn't upload the same file 3 times.
    const allNgos = String(req.body.all_ngos || '').toLowerCase() === '1' || code === 'ALL';

    // Parse as an events sheet. If the sheet has NO "Event Name" and "Date"
    // column but DOES have "Sector" + "Activity / Project", it is actually an
    // activities catalog sheet (the MANN/AFLF/BSCT activity sheets the team
    // uploads). Route that to the activities import so the uploaded rows
    // populate the activity catalog instead of failing with an opaque error.
    let rows;
    let sheetFormat = null;
    try {
      const parsed = parseEventSheet(file.buffer);
      rows = parsed.rows;
      sheetFormat = parsed.format || 'date';
    } catch (eventParseErr) {
      try {
        const act = parseActivitySheet(file.buffer);
        if (act.rows && act.rows.length) {
          // Activities sheet — needs a single NGO to scope the catalog.
          if (allNgos) {
            return res.status(400).json({ message: "This sheet is an Activity catalog (Sector / Activity columns, no Event Name or Date). Activity catalogs apply to a single NGO, so pick one NGO (BSCT / MANN / AFLF) - 'All NGOs' is only for event sheets." });
          }
          const actCode = String(req.body.ngo_code || '').trim().toUpperCase();
          const actNgo = (actCode && ngos.find(n => String(n.code || n.name || '').toUpperCase() === actCode))
            || (req.body.ngo_id && ngos.find(n => String(n.id) === String(req.body.ngo_id)));
          if (!actNgo || !(actNgo.code || actNgo.name)) {
            return res.status(400).json({ message: 'This sheet is an Activity catalog (Sector / Activity columns, no Event Name or Date). Please select the NGO (MANN / AFLF / BSCT) in the dropdown above and upload again.' });
          }
          return importActivities(req, res);
        }
      } catch (_) { /* not an activities sheet either — fall through */ }
      throw eventParseErr;
    }
    if (!rows.length) return res.status(400).json({ message: 'No events found in the sheet' });

    const [sectors, activities] = await Promise.all([
      EventHead.getAllEventHeadSectors(),
      EventHead.getAllActivities().catch(() => []),
    ]);
    const sectorNames = sectors.map(s => s.name);
    const sectorByName = new Map(sectors.map(s => [s.name, s.id]));

    const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const activityIdx = new Map(); // key "sectorId|ngoId|normName"
    const activityNames = new Map(); // key "sectorId|normName" -> array
    for (const a of activities || []) {
      const key = `${a.sector_id}|${a.ngo_id == null ? '' : a.ngo_id}|${norm(a.name)}`;
      activityIdx.set(key, a);
      const nk = `${a.sector_id}|${norm(a.name)}`;
      if (!activityNames.has(nk)) activityNames.set(nk, []);
      activityNames.get(nk).push(a);
    }

    const resolveActivity = (sectorId, ngoId, label) => {
      const nk = `${sectorId}|${norm(label)}`;
      const candidates = activityNames.get(nk) || [];
      if (ngoId != null) {
        const hit = candidates.find(a => String(a.ngo_id) === String(ngoId));
        if (hit) return hit;
      }
      const all = candidates.find(a => a.ngo_id == null);
      if (all) return all;
      return activityIdx.get(`${sectorId}|${ngoId == null ? '' : ngoId}|${norm(label)}`) || null;
    };

    const normNgoKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ');
    const ngoByKey = new Map();
    for (const n of ngos) ngoByKey.set(normNgoKey(n.code || n.name), n);

    const prepared = [];
    const skipped = { no_date: [], unknown_activity: [], unknown_sector: [], unknown_ngo: [], missing_activity: [], dup: [] };
    const seen = new Set();
    let parsed = 0;

    // Catalog sheets need to find-or-create the activity each event belongs to.
    const activityKey = (ngoId, sectorId, name) => `${ngoId}|${sectorId}|${String(name || '').toLowerCase().replace(/\s+/g, ' ').trim()}`;
    const existingActivityByKey = new Map();
    for (const a of activities || []) {
      const k = activityKey(a.ngo_id, a.sector_id, a.name);
      if (!existingActivityByKey.has(k)) existingActivityByKey.set(k, a);
    }
    const createdActivities = new Map(); // key -> row to bulk-insert
    const createdActivityId = new Map(); // key -> id (filled after insert)

    const resolveNgos = (label) => {
      if (allNgos) return ngos;
      let ngo = defaultNgo;
      if (label) ngo = ngoByKey.get(normNgoKey(label)) || defaultNgo;
      return ngo ? [ngo] : [];
    };

    for (const row of rows) {
      if (!row.name) continue;
      parsed++;

      // ── Catalog sheet: NGO | Sector | Activity | Event (builds All-Events cascade) ──
      if (row.format === 'catalog') {
        const canonical = canonicalizeSector(row.sectorLabel, sectorNames);
        const sectorId = sectorByName.get(canonical);
        if (!sectorId) { skipped.unknown_sector.push(`${row.name} (${row.sectorLabel || 'no sector'})`); continue; }
        const actName = normalizeName(row.activityLabel);
        if (!actName) { skipped.missing_activity.push(row.name); continue; }

        let na = null;
        if (row.ngoLabel) na = ngoByKey.get(normNgoKey(row.ngoLabel));
        if (!na) { skipped.unknown_ngo.push(`${row.name} (${row.ngoLabel || 'no NGO'})`); continue; }

        const key = activityKey(na.id, sectorId, actName);
        const activity = existingActivityByKey.get(key);
        if (!activity && !createdActivities.has(key)) {
          createdActivities.set(key, { ngo_id: na.id, sector_id: sectorId, name: actName, status: 'Active', created_by: String(req.user.id || '') });
        }

        const dedupeKey = `${na.id}|${sectorId}|${key}|${norm(row.name)}|catalog`;
        if (seen.has(dedupeKey)) { skipped.dup.push(row.name); continue; }
        seen.add(dedupeKey);

        prepared.push({
          name: row.name,
          date: null,
          ngo_id: na.id,
          sector_id: sectorId,
          activity_id: activity ? activity.id : null,
          _actKey: activity ? null : key,
          venue: row.venue,
          start_time: row.startTime,
          end_time: row.endTime,
          status: 'Approved',
          approval_status: 'Approved',
          budget: row.budget,
          expected_beneficiaries: row.expectedBeneficiaries,
          created_by: String(req.user.id || ''),
        });
        continue;
      }

      // ── Date-driven sheet: NGO | Event | Date | Day  (calendar)  or  legacy format ──
      const ngoList = resolveNgos(row.ngoLabel);
      if (!ngoList.length) { skipped.unknown_ngo.push(`${row.name} (${row.ngoLabel || 'no NGO'})`); continue; }

      if (!row.date) { skipped.no_date.push(row.name); continue; }

      const canonical = canonicalizeSector(row.sectorLabel, sectorNames);
      const sectorId = row.sectorLabel ? sectorByName.get(canonical) : null;
      if (row.sectorLabel && !sectorId) { skipped.unknown_sector.push(`${row.name} (${row.sectorLabel})`); continue; }

      for (const ngo of ngoList) {
        const activity = row.activityLabel && sectorId ? resolveActivity(sectorId, ngo.id, row.activityLabel) : null;
        if (row.activityLabel && !activity) skipped.unknown_activity.push(`${row.name} (${row.activityLabel})`);

        const dedupeKey = `${ngo.id}|${sectorId || 'none'}|${activity ? activity.id : 'none'}|${row.date}|${norm(row.name)}`;
        if (seen.has(dedupeKey)) { skipped.dup.push(row.name); continue; }
        seen.add(dedupeKey);

        prepared.push({
          name: row.name,
          date: row.date,
          ngo_id: ngo.id,
          sector_id: sectorId,
          activity_id: activity ? activity.id : null,
          venue: row.venue,
          start_time: row.startTime,
          end_time: row.endTime,
          status: row.status,
          approval_status: row.status === 'Approved' ? 'Approved' : 'Draft',
          budget: row.budget,
          expected_beneficiaries: row.expectedBeneficiaries,
          created_by: String(req.user.id || ''),
        });
      }
    }

    // Insert newly-created catalog activities and backfill their ids into events.
    let newActivityCount = 0;
    if (createdActivities.size) {
      const acts = await EventHead.insertActivitiesBulk([...createdActivities.values()]);
      for (const a of acts || []) createdActivityId.set(activityKey(a.ngo_id, a.sector_id, a.name), a.id);
      newActivityCount = (acts || []).length;
      for (const p of prepared) {
        if (p._actKey && createdActivityId.has(p._actKey)) p.activity_id = createdActivityId.get(p._actKey);
        delete p._actKey;
      }
    }

    const inserted = await EventHead.insertEventHeadEventsBulk(prepared);

    const perNgo =
      Object.values(prepared.reduce((acc, p) => {
        if (!acc[p.ngo_id]) acc[p.ngo_id] = { ngo_id: p.ngo_id, count: 0 };
        acc[p.ngo_id].count++;
        return acc;
      }, {}));
    const withCode = perNgo.map(pn => {
      const n = ngos.find(n => String(n.id) === String(pn.ngo_id));
      return { code: n ? (n.code || n.name) : pn.ngo_id, count: pn.count };
    });
    const insertedByNgo =
      Object.values(inserted.reduce((acc, p) => {
        if (!acc[p.ngo_id]) acc[p.ngo_id] = { ngo_id: p.ngo_id, count: 0 };
        acc[p.ngo_id].count++;
        return acc;
      }, {}));

    return res.json({
      ngo: defaultNgo ? { id: defaultNgo.id, code: defaultNgo.code || defaultNgo.name, name: defaultNgo.name } : null,
      all_ngos: allNgos || null,
      format: sheetFormat || 'date',
      activities_created: newActivityCount,
      sheet: file.originalname,
      rows_parsed: parsed,
      inserted: inserted.length,
      inserted_by_ngo: insertedByNgo.map(ib => {
        const n = ngos.find(n => String(n.id) === String(ib.ngo_id));
        return { code: n ? (n.code || n.name) : ib.ngo_id, count: ib.count };
      }),
      per_ngo: withCode,
      skipped: {
        missing_date: skipped.no_date.length,
        unknown_activity: skipped.unknown_activity.length,
        unknown_sector: skipped.unknown_sector.length,
        unknown_ngo: skipped.unknown_ngo.length,
        missing_activity: skipped.missing_activity.length,
        duplicates: skipped.dup.length,
      },
      skipped_details: {
        no_date: skipped.no_date.slice(0, 20),
        unknown_activity: skipped.unknown_activity.slice(0, 20),
        unknown_sector: skipped.unknown_sector.slice(0, 20),
        unknown_ngo: skipped.unknown_ngo.slice(0, 20),
        missing_activity: skipped.missing_activity.slice(0, 20),
        dup: skipped.dup.slice(0, 20),
      },
    });
  } catch (error) {
    if (error && error.message && /Could not find|NGO/.test(error.message)) {
      return res.status(400).json({ message: error.message });
    }
    console.error('importEvents error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

// Export events to an Excel sheet honoring the current filters.
export const exportEvents = async (req, res) => {
  try {
    const { ngo_id, sector_id, activity_id, status, month, year } = req.query;
    const events = await EventHead.getAllEventHeadEvents({ ngo_id, sector_id, activity_id, status, month, year });
    const ctx = await buildEventContextMaps();
    const rows = events.map(ev => enrichEvent(ev, ctx));

    const aoa = [
      ['Event Name', 'NGO', 'Sector', 'Activity', 'Date', 'Start Time', 'End Time', 'Venue', 'Status', 'Budget', 'Expected Beneficiaries'],
    ];
    for (const e of rows) {
      aoa.push([
        e.name || '',
        e.ngo_name || '',
        e.sector_name || '',
        e.activity_name || '',
        (e.date || '').slice(0, 10),
        e.start_time ? String(e.start_time).slice(0, 5) : '',
        e.end_time ? String(e.end_time).slice(0, 5) : '',
        e.venue || '',
        e.status || '',
        e.budget != null ? Number(e.budget) : '',
        e.expected_beneficiaries != null ? Number(e.expected_beneficiaries) : '',
      ]);
    }

    const XLSX = (await import('xlsx')).default;
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Events');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="events.xlsx"');
    return res.send(buf);
  } catch (error) {
    console.error('exportEvents error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

// Export the NGO's activity catalog back to an Excel sheet. Omit ngo to get
// every NGO's activities (with the NGO column filled in).
export const exportActivities = async (req, res) => {
  try {
    const { ngo_id, ngo_code } = req.query;
    const ngos = await EventHead.getAllEventHeadNgos().catch(() => []);
    let ngo = null;
    if (ngo_id) ngo = ngos.find(n => String(n.id) === String(ngo_id));
    else if (ngo_code) ngo = ngos.find(n => String(n.code || n.name || '').toUpperCase() === String(ngo_code).toUpperCase());
    if (ngo_id && !ngo) return res.status(404).json({ message: 'NGO not found' });

    const [activities, sectors] = await Promise.all([
      EventHead.getAllActivities(ngo ? { ngo_id: ngo.id } : {}),
      EventHead.getAllEventHeadSectors().catch(() => []),
    ]);
    const sectorName = new Map(sectors.map(s => [s.id, s.name]));
    const ngoLabel = ngo ? (ngo.code || ngo.name) : 'All NGOs';

    const data = (activities || [])
      .filter(a => a.name)
      .sort((a, b) => String(a.sector_id || '').localeCompare(String(b.sector_id || '')) || String(a.name).localeCompare(String(b.name)))
      .map(a => ({
        'Sector': sectorName.get(a.sector_id) || '',
        'Activity or Project': a.name,
        'NGO': ngoLabel,
      }));

    const XLSX = (await import('xlsx')).default;
    const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ 'Sector': '', 'Activity or Project': '', 'NGO': ngoLabel }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Activities');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const safe = String(ngoLabel).replace(/[^A-Za-z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="activities_${safe}.xlsx"`);
    return res.send(buf);
  } catch (error) {
    console.error('exportActivities error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const updateActivity = async (req, res) => {
  try {
    const existing = await EventHead.getActivityById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Activity not found' });
    const body = sanitize(req.body);
    const updates = { ...body };
    if (updates.name !== undefined) updates.name = String(updates.name || '').trim();
    if (updates.name !== undefined && !updates.name) return res.status(400).json({ message: 'Activity name cannot be empty' });
    const activity = await EventHead.updateActivity(req.params.id, updates);
    return res.json(activity);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'An activity with this name already exists for this NGO' });
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

export const setActivityStatus = async (req, res) => {
  try {
    const { status } = sanitize(req.body);
    if (!['Active', 'Inactive'].includes(status)) {
      return res.status(400).json({ message: 'status must be Active or Inactive' });
    }
    const existing = await EventHead.getActivityById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Activity not found' });
    const activity = await EventHead.updateActivity(req.params.id, { status });
    return res.json(activity);
  } catch (error) {
    console.error('eventHeadController error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

// ─── AI SPELLING SUGGESTIONS (Create Event) ───
// Raises corrected spellings for free-text fields typed in the event-head
// "Create New Event" panel, so the team always types the right word. Uses the
// existing GROQ integration. Falls back to no suggestions if no GROQ key.
const SPELLING_MODEL = process.env.GROQ_SPELLING_MODEL || 'openai/gpt-oss-120b';

export const suggestEventSpelling = async (req, res) => {
  try {
    const raw = Array.isArray(req.body?.fields) ? req.body.fields : [];
    const fields = raw
      .map((f) => ({ key: String(f?.key || '').trim(), value: String(f?.value || '').trim() }))
      .filter((f) => f.key && f.value);

    if (!fields.length) return res.json({ suggestions: {} });

    // No GROQ key configured → gracefully return nothing; the UI shows a note.
    if (!process.env.GROQ_API_KEY) return res.json({ suggestions: {} });

    const list = fields.map((f) => `${f.key}: ${f.value}`).join('\n');
    const prompt = [
      'You are a careful spelling checker for an event-creation form.',
      'Below is a list of field values typed by a user (format: "fieldKey: value").',
      '',
      'For each fieldKey, decide whether the typed text contains a CLEAR spelling,',
      'punctuation or simple grammar mistake. Fix ONLY clear mistakes.',
      '',
      'Rules:',
      '- Fix ONLY clear spelling, punctuation and simple grammar mistakes.',
      '- Do NOT rewrite correct text, add words, invent content, or change meaning.',
      '- Keep proper nouns, brands, names, numbers, URLs and locations as-is unless clearly misspelled.',
      '- Capitalise words that are proper nouns (places, names) naturally.',
      '- Only include a fieldKey if the corrected text is actually different from the typed value.',
      '',
      'Return a JSON object where each key is a fieldKey and the value is an object:',
      '{ "corrected": "<the corrected text>", "reason": "<short, human explanation of the fix>" }',
      '',
      'Do not be overly strict: also fix ANY obvious English spelling mistake you are confident about.',
      '',
      'Fields:',
      list,
    ].join('\n');

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You return strict JSON only. No markdown, no commentary, no code fences.' },
        { role: 'user', content: prompt },
      ],
      model: SPELLING_MODEL,
      max_tokens: 1200,
      temperature: 0.3,
    });

    const text = (completion.choices?.[0]?.message?.content || '').trim();
    let parsed = {};
    try {
      // Strip possible code fences before JSON.parse.
      const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {};
    }

    const suggestions = {};
    for (const f of fields) {
      const entry = parsed[f.key];
      const corrected = typeof entry === 'object' && entry !== null
        ? String(entry.corrected ?? '').trim()
        : String(entry ?? '').trim();
      const reason = typeof entry === 'object' && entry !== null
        ? String(entry.reason ?? '').trim()
        : 'looks like it may be spelled differently';
      if (corrected && corrected !== f.value) {
        suggestions[f.key] = { corrected, reason };
      }
    }

    return res.json({ suggestions });
  } catch (error) {
    console.error('suggestEventSpelling error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};

// ─── AI SECTOR ACTIVITY SUGGESTIONS (Activities page) ───
// Recommends typical NGO program/activity names for a selected sector.
const ACTIVITY_MODEL = process.env.GROQ_ACTIVITY_MODEL || 'openai/gpt-oss-20b';

export const suggestSectorActivities = async (req, res) => {
  try {
    const sectorName = String(req.body?.sector_name || '').trim();
    if (!sectorName) return res.status(400).json({ message: 'sector_name is required' });
    const existing = Array.isArray(req.body?.existing) ? req.body.existing.map(String).filter(Boolean) : [];

    if (!process.env.GROQ_API_KEY) return res.json({ suggestions: [] });

    const existingHint = existing.length
      ? `The sector already has: ${existing.join(', ')}. Do NOT repeat these.`
      : '';
    const prompt = [
      `Recommend 8 typical NGO program/activity names suitable for the sector "${sectorName}".`,
      'These are activity names the team might create for events under this sector.',
      'Return a strict JSON array of strings (optionally with a short non-numeric suffix removed).',
      '- Properly spelled, concise, descriptive program names (e.g. "Community Health Camp", "Computer Literacy Training").',
      '- No numbering, no bullet prefixes, no extra fields.',
      existingHint,
      'No markdown, no commentary.',
    ].filter(Boolean).join('\n');

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You return strict JSON only. No markdown, no commentary.' },
        { role: 'user', content: prompt },
      ],
      model: ACTIVITY_MODEL,
      max_tokens: 400,
      temperature: 0.4,
    });

    const text = (completion.choices?.[0]?.message?.content || '').trim();
    let arr = [];
    try {
      const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    } catch {
      arr = [];
    }

    const seen = new Set(existing.map(s => s.toLowerCase()));
    const suggestions = [];
    for (const s of arr) {
      const name = String(s ?? '').replace(/^[\d.\-)\s]+/, '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      suggestions.push(name);
    }

    return res.json({ suggestions: suggestions.slice(0, 8) });
  } catch (error) {
    console.error('suggestSectorActivities error:', error.message || error);
    return res.status(500).json({ message: error.message });
  }
};
