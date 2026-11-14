// Station-wise collection workbook used by the Accounts -> Reports one-click
// download and by backend/scripts/station-collection.mjs.
//
// The receipt population mirrors accountsController.getReportData exactly:
//   - receipt_no IS NOT NULL
//   - project_id = the NGO code (case-insensitive)
//   - agent Suspense/NA/blank -> Suspense bucket, library/pg -> their buckets
//     (all three are separate Accounts rows, so they are excluded here)
//
// Station attribution:
//   receipts.log_id -> fro_donor_logs -> fro_assignments.station,
//   else donor_profiles.station for legacy receipts with no log.
//
// Columns added for the station sheet:
//   Count  = distinct donors currently assigned to that station
//            (fro_assignments, excluding 'reassigned' and high_tier batches;
//             same definition as Station Management).
//   Range  = highest per-donor total collected at that station in the period.
//            e.g. donors giving 500 / 1000 / 2000 -> Range = 2000.

import ExcelJS from 'exceljs'
import db from '../config/db.js'

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const EXCLUDED_AGENTS = `('suspense','na','','library','pg')`
const NGO_PREFIXES = { bsct: ['BOD', 'BFD'], aflf: ['AOD', 'AFD'], mann: ['MOD', 'MFD'] }
const SPECIAL = { PS: 'Priyank Shah', A: 'Anjana' }
const MONEY = '#,##0.00'
const HEAD_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } }
const HEAD_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
const BORDER = { style: 'thin', color: { argb: 'FFD9D9D9' } }

const amt = (v) => (v == null ? null : Number(Number(v).toFixed(2)))
const fmtMoney = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDay = (iso) => {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  return `${d} ${MONTH_ABBR[Number(m) - 1]} ${y}`
}

function monthsBetween(from, to) {
  const out = []
  let d = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  if (isNaN(d.getTime()) || isNaN(end.getTime())) return out
  d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1))
  while (d <= last && out.length < 36) {
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
  }
  return out
}

const monthLabel = (ym) => {
  const [y, m] = ym.split('-')
  return `${MONTH_ABBR[Number(m) - 1]} ${y.slice(2)}`
}

export async function buildStationCollectionWorkbook({ from, to, ngoCodes }) {
  const codes = (Array.isArray(ngoCodes) && ngoCodes.length ? ngoCodes : ['bsct', 'aflf', 'mann'])
    .map((c) => String(c).toLowerCase())
  const { rows: ngoRows } = await db._pool.query(
    `SELECT id, code FROM ngos WHERE lower(code) = ANY($1) ORDER BY code`,
    [codes],
  )
  if (!ngoRows.length) throw new Error(`No NGO matched: ${codes.join(', ')}`)
  const ngoIds = ngoRows.map((r) => r.id)
  const codeById = Object.fromEntries(ngoRows.map((r) => [r.id, r.code.toUpperCase()]))
  const singleNgo = ngoRows.length === 1
  const ownPrefixes = singleNgo ? (NGO_PREFIXES[codes[0]] || []) : null
  const months = monthsBetween(from, to)
  if (!months.length) throw new Error('Invalid date range')

  // One row per (station, donor, month) keeps the payload small enough to
  // aggregate in Node while preserving per-donor totals for Range.
  const { rows } = await db._pool.query(
    `SELECT TRIM(COALESCE(fa.station, dp.station)) AS station,
            lower(trim(r.project_id)) AS project,
            to_char(date_trunc('month', r.receipt_date AT TIME ZONE 'Asia/Kolkata'),'YYYY-MM') AS ym,
            COALESCE(r.donor_id::text,
                     NULLIF(TRIM(r.donor_mobile),''),
                     NULLIF(TRIM(r.donor_name),''),
                     'receipt:' || r.id) AS donor_key,
            SUM(r.amount) AS total,
            COUNT(*)::int AS receipts
       FROM receipts r
       LEFT JOIN fro_donor_logs l ON l.id = r.log_id
       LEFT JOIN fro_assignments fa ON fa.id = l.assignment_id
       LEFT JOIN donor_profiles dp ON dp.id = r.donor_id
       LEFT JOIN ngos n ON n.code = UPPER(r.project_id)
      WHERE r.receipt_date >= ($1::date AT TIME ZONE 'Asia/Kolkata')
        AND r.receipt_date <  (($2::date + 1) AT TIME ZONE 'Asia/Kolkata')
        AND r.receipt_no IS NOT NULL
        AND lower(trim(coalesce(r.agent_name,''))) NOT IN ${EXCLUDED_AGENTS}
        AND lower(trim(r.project_id)) = ANY($4)
        AND (fa.ngo_id = ANY($3) OR (fa.id IS NULL AND n.id = ANY($3)))
      GROUP BY 1, 2, 3, 4`,
    [from, to, ngoIds, codes],
  )

  const stations = new Map()
  const monthly = {}
  const byNgo = {}
  const unattributed = { months: {}, total: 0, receipts: 0, donorTotals: new Map() }
  let grandTotal = 0
  let grandReceipts = 0

  const ensureStation = (code) => {
    if (!stations.has(code)) {
      stations.set(code, { station: code, months: {}, total: 0, receipts: 0, donorTotals: new Map() })
    }
    return stations.get(code)
  }

  for (const r of rows) {
    const total = Number(r.total) || 0
    const receipts = Number(r.receipts) || 0
    grandTotal += total
    grandReceipts += receipts
    if (!monthly[r.ym]) monthly[r.ym] = { total: 0, receipts: 0 }
    monthly[r.ym].total += total
    monthly[r.ym].receipts += receipts
    if (!byNgo[r.project]) byNgo[r.project] = { total: 0, receipts: 0 }
    byNgo[r.project].total += total
    byNgo[r.project].receipts += receipts

    const target = r.station == null ? unattributed : ensureStation(String(r.station))
    if (!target.months[r.ym]) target.months[r.ym] = 0
    target.months[r.ym] += total
    target.total += total
    target.receipts += receipts
    const key = r.donor_key || `anon:${r.ym}:${target.receipts}`
    target.donorTotals.set(key, (target.donorTotals.get(key) || 0) + total)
  }

  // Count per station: distinct donors assigned to the station. High-tier
  // donors are included (they are still donors of that station); only
  // 'reassigned' rows are excluded - same rule Station Management uses for
  // the total donor list.
  const { rows: countRows } = await db._pool.query(
    `SELECT TRIM(station) AS station, COUNT(DISTINCT donor_id)::int AS cnt
       FROM fro_assignments
      WHERE station IS NOT NULL
        AND (status IS NULL OR status <> 'reassigned')
      GROUP BY TRIM(station)`,
  )
  const assignmentCount = new Map(countRows.map((r) => [String(r.station), Number(r.cnt) || 0]))

  // Registered stations owned by the selected NGOs get a zero row; labels
  // (NGO/FRO) are read for every code so other-NGO codes are still identifiable.
  const { rows: regRows } = await db._pool.query(
    `SELECT TRIM(fsa.station) AS station, fsa.ngo_id, w.name AS fro_name
       FROM fro_station_assignments fsa
       LEFT JOIN workers w ON w.id = fsa.fro_worker_id
      WHERE fsa.station IS NOT NULL`,
  )
  const stationNgo = new Map()
  const stationFro = new Map()
  const skipRows = new Set(['S', 'L', 'PG'])
  for (const r of regRows) {
    const code = String(r.station || '').trim()
    if (!code || skipRows.has(code)) continue
    if (r.ngo_id && ngoIds.includes(r.ngo_id) && !stations.has(code)) ensureStation(code)
    if (r.ngo_id && codeById[r.ngo_id]) {
      if (!stationNgo.has(code)) stationNgo.set(code, new Set())
      stationNgo.get(code).add(codeById[r.ngo_id])
    }
    if (r.fro_name) {
      if (!stationFro.has(code)) stationFro.set(code, new Set())
      stationFro.get(code).add(String(r.fro_name).trim())
    }
  }
  if (codes.includes('bsct')) {
    for (const code of Object.keys(SPECIAL)) ensureStation(code)
  }

  const meta = (code) => {
    const prefix = String(code || '').split('-')[0].toUpperCase()
    const base = (() => {
      if (['BOD', 'AOD', 'MOD'].includes(prefix)) return { group: 'Old', order: { BOD: 0, AOD: 1, MOD: 2 }[prefix] }
      if (['BFD', 'AFD', 'MFD'].includes(prefix)) return { group: 'New', order: { BFD: 3, AFD: 4, MFD: 5 }[prefix] }
      if (codes.includes('bsct') && SPECIAL[code]) return { group: 'Special', order: 6 }
      return { group: 'Other', order: 8 }
    })()
    if (ownPrefixes && base.group !== 'Other' && base.group !== 'Special' && !ownPrefixes.includes(prefix)) {
      return { group: 'OtherNgo', order: 7 }
    }
    return base
  }
  const numSuffix = (code) => { const m = /-(\d+)$/.exec(String(code)); return m ? Number(m[1]) : 9999 }
  const specialOrder = { PS: 0, A: 1 }

  const enrich = (s) => {
    const values = [...s.donorTotals.values()]
    return {
      ...s,
      ...meta(s.station),
      count: assignmentCount.has(s.station) ? assignmentCount.get(s.station) : s.donorTotals.size,
      range: values.length ? Math.max(...values) : null,
    }
  }
  const all = [...stations.values()].map(enrich)
  all.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order
    if (a.group === 'Special') return specialOrder[a.station] - specialOrder[b.station]
    if (a.group === 'Other') return b.total - a.total || a.station.localeCompare(b.station)
    return a.station.localeCompare(b.station, undefined, { numeric: true })
  })

  const roll = (list, { countMode = 'sum' } = {}) => {
    if (!list.length) return null
    const monthsOut = {}
    for (const r of list) for (const [ym, v] of Object.entries(r.months)) monthsOut[ym] = (monthsOut[ym] || 0) + v
    const count = countMode === 'sum'
      ? list.reduce((s, r) => s + (r.count || 0), 0)
      : list.reduce((s, r) => s + r.donorTotals.size, 0)
    const ranges = list.map((r) => r.range).filter((v) => v != null)
    return {
      months: monthsOut,
      total: list.reduce((s, r) => s + r.total, 0),
      receipts: list.reduce((s, r) => s + r.receipts, 0),
      count,
      range: ranges.length ? Math.max(...ranges) : null,
    }
  }

  const otherRows = all.filter((r) => r.group === 'Other')
  const otherNgoRows = all.filter((r) => r.group === 'OtherNgo')
  const shown = all.filter((r) => r.group !== 'Other' && r.group !== 'OtherNgo')
  const otherRow = roll(otherRows, { countMode: 'donors' })
  const otherNgoRow = roll(otherNgoRows)
  const unattributedRow = {
    months: unattributed.months,
    total: unattributed.total,
    receipts: unattributed.receipts,
    count: unattributed.donorTotals.size,
    range: unattributed.donorTotals.size ? Math.max(...unattributed.donorTotals.values()) : null,
  }
  const stationTotal = shown.reduce((s, r) => s + r.total, 0) + (otherNgoRow?.total || 0) + (otherRow?.total || 0)
  const stationCount = shown.reduce((s, r) => s + (r.count || 0), 0) + (otherNgoRow?.count || 0) + (otherRow?.count || 0)

  // ---------------------------------------------------------------------------
  // Workbook
  // ---------------------------------------------------------------------------
  const wb = new ExcelJS.Workbook()
  wb.creator = 'UCS CRM'
  wb.created = new Date()

  const ws = wb.addWorksheet('Collection', {
    views: [{ showGridLines: false }],
  })
  const totalCol = 6 + months.length
  const receiptCol = totalCol + 1
  ws.columns = [
    { width: 16 }, { width: 28 }, { width: 12 }, { width: 12 }, { width: 14 },
    ...months.map(() => ({ width: 10 })),
    { width: 16 }, { width: 10 },
  ]

  const head = (values) => ws.addRow(values).eachCell((c) => {
    c.fill = HEAD_FILL; c.font = HEAD_FONT; c.border = BORDER
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  })
  const moneyRow = (row, from = 5) => {
    row.eachCell((c, i) => {
      if (i >= from && i <= totalCol && typeof c.value === 'number') c.numFmt = MONEY
    })
    return row
  }

  head(['Station', 'Name / FRO', 'NGO', 'Count (donors)', 'Range (₹)', ...months.map(monthLabel), 'Total (₹)', 'Receipts'])

  for (const s of shown) {
    const fro = [...(stationFro.get(s.station) || [])].join(', ')
    const label = SPECIAL[s.station]
    const name = label ? `${label}${fro && fro.toLowerCase() !== label.toLowerCase() ? ` (${fro})` : ''}` : fro
    const row = ws.addRow([s.station, name, [...(stationNgo.get(s.station) || [])].join(', '),
      s.count || 0, s.range == null ? null : amt(s.range),
      ...months.map((ym) => (s.months[ym] ? amt(s.months[ym]) : null)),
      amt(s.total), s.receipts])
    row.eachCell((c) => { c.border = BORDER })
    moneyRow(row)
  }

  // The visible rows are stations only, but TOTAL stays on the Accounts
  // Reports number: the small Other / Other-NGO / unattributed portions are
  // included here rather than shown as their own rows.
  const totalCount = shown.reduce((s, r) => s + (r.count || 0), 0)
  const totalRange = shown.reduce((m, r) => (r.range != null && r.range > m ? r.range : m), 0)
  const totalRow = ws.addRow(['TOTAL', '', '', totalCount, totalRange ? amt(totalRange) : null,
    ...months.map((ym) => amt(monthly[ym]?.total || 0)),
    amt(grandTotal), grandReceipts])
  totalRow.font = { bold: true, size: 11 }
  totalRow.eachCell((c, i) => {
    c.border = BORDER
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
    if (i >= 5 && i <= totalCol) c.numFmt = MONEY
  })
  ws.getRow(1).height = 30

  return wb.xlsx.writeBuffer()
}
