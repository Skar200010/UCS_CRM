import { jsPDF } from 'jspdf'

// Monthly Planner — "View in Calendar" export (native vector PDF, A4 landscape).
//
// The calendar overlay and this file read the SAME model: buildCalendarModel()
// merges the month's observances (festivals/important days) with the chosen
// programmes (one per festival — a typed programme replaces its AI pick, exactly
// as the on-screen grid and the Excel/PDF downloads do), so no date, festival,
// NGO name, beneficiary, programme suggestion or location can ever be duplicated
// or disagree between the screen and the file.
//
// Built like reelsPdf.mjs / eventPlanningPdf.mjs: a pure layout pass
// (layoutMonthlyCalendarPages) feeds a draw pass (buildMonthlyCalendarPdf), so
// the grid fitting and the detail-table pagination can be unit-tested with no
// jsPDF instance. jspdf is only ever imported lazily from the UI.

export const PAGE_W = 297
export const PAGE_H = 210
const ML = 12
const MR = 12
const MT = 13
const MB = 12
export const CONTENT_W = PAGE_W - ML - MR
const LIMIT = PAGE_H - MB

const PT = 0.3528
const lineH = (fs) => fs * PT * 1.32
const charW = (fs) => fs * PT * 0.5

const INK = [31, 36, 48]
const MUT = [107, 114, 128]
const LINE = [213, 217, 228]
const HEAD_FILL = [232, 236, 246]
const BAND = [246, 247, 249]
const WEEKHEAD_FILL = [243, 242, 251]

// Festival/observance kind → accent colour (falls back to the panel primary).
const TYPE_COLOR = {
  festival: [198, 40, 40],
  national: [21, 101, 192],
  international: [2, 136, 209],
  religious: [123, 31, 162],
  observance: [94, 53, 177],
  holiday: [230, 81, 0],
}
const DEFAULT_COLOR = [108, 92, 231]

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const CHIP_LH = 3.4

const pad2 = (n) => String(n).padStart(2, '0')

function wrapText(text, maxW, fs) {
  const s = String(text ?? '')
  const chars = Math.max(1, Math.floor(maxW / charW(fs)))
  const words = s.split(/\s+/).filter(Boolean)
  if (!words.length) return ['']
  const out = []
  let cur = ''
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w
    if (cand.length <= chars) {
      cur = cand
      continue
    }
    if (cur) out.push(cur)
    if (w.length > chars) {
      let rest = w
      while (rest.length > chars) {
        out.push(rest.slice(0, chars))
        rest = rest.slice(chars)
      }
      cur = rest
    } else cur = w
  }
  if (cur) out.push(cur)
  return out
}

const shortDate = (ymd) => {
  const [y, m, d] = String(ymd).split('-').map(Number)
  if (!y || !m || !d) return String(ymd || '')
  return `${MONTHS[m - 1].slice(0, 3)} ${d}`
}

const weekdayOf = (ymd) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''))
  if (!m) return '—'
  return new Date(`${ymd}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' })
}

const monthLabel = (ym) => {
  const [y, m] = String(ym).split('-')
  return `${MONTHS[Number(m) - 1]} ${y}`
}

/* One chosen programme per festival: a festival the user decided about becomes
   ONE detail row; a programme whose festival has no observance row (a manually
   typed "No important day" programme) still becomes its own row. Festivals with
   no programme chosen are listed with a dash so the file never drops a date. */
export function buildCalendarModel({ month, ngoLabel, observancesByDate, programmeRows } = {}) {
  const ym = String(month || '')
  const [y, m] = ym.split('-').map(Number)
  const total = Number.isFinite(y) && Number.isFinite(m) ? new Date(y, m, 0).getDate() : 0
  const firstWeekday = new Date(y, (m || 1) - 1, 1).getDay()
  const obs = observancesByDate && typeof observancesByDate === 'object' ? observancesByDate : {}
  const rows = Array.isArray(programmeRows) ? programmeRows : []

  const details = []
  const index = new Map()
  const key = (date, festival) => `${date}::${String(festival || '').toLowerCase()}`
  const addDetail = (date, festival, patch) => {
    const k = key(date, festival)
    if (index.has(k)) {
      Object.assign(details[index.get(k)], patch)
      return
    }
    index.set(k, details.length)
    details.push({
      date,
      dateLabel: shortDate(date),
      weekday: weekdayOf(date),
      festival: festival || '—',
      ngoLabel: '—',
      beneficiary: '—',
      programme: '—',
      location: '—',
      status: '',
      ...patch,
    })
  }

  for (let d = 1; d <= total; d++) {
    const date = `${ym}-${pad2(d)}`
    for (const o of obs[date] || []) addDetail(date, o?.name, {})
  }
  for (const r of rows) {
    addDetail(r?.date, r?.festival, {
      ngoLabel: r?.ngoLabel || '—',
      beneficiary: r?.beneficiary || '—',
      programme: r?.title || r?.programme || '—',
      location: r?.location || '—',
      status: r?.status || '',
    })
  }
  details.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    return String(a.festival).localeCompare(String(b.festival))
  })

  const progByDate = {}
  for (const r of rows) (progByDate[r?.date] ||= []).push(r)

  const weeks = []
  let cur = new Array(7).fill(null)
  let col = 0
  for (let i = 0; i < firstWeekday; i++) col++
  for (let d = 1; d <= total; d++) {
    const date = `${ym}-${pad2(d)}`
    cur[col++] = {
      date,
      day: d,
      festivals: (obs[date] || []).map((o) => ({ name: o?.name || '', type: o?.type || '' })),
      programmes: (progByDate[date] || []).map((r) => ({
        title: r?.title || r?.programme || '',
        ngoLabel: r?.ngoLabel || '',
        beneficiary: r?.beneficiary || '',
        location: r?.location || '',
        status: r?.status || '',
      })),
    }
    if (col === 7) {
      weeks.push(cur)
      cur = new Array(7).fill(null)
      col = 0
    }
  }
  if (col > 0) weeks.push(cur)

  return {
    month: ym,
    monthLabel: monthLabel(ym),
    ngoLabel: ngoLabel || 'All NGOs',
    weeks,
    details,
  }
}

export function layoutMonthlyCalendarPages(model) {
  const m = model || {}
  const weeks = Array.isArray(m.weeks) ? m.weeks : []
  const generated = new Date().toLocaleString()

  const headerH = 18
  const weekHeadY = MT + headerH
  const weekHeadH = 7
  const colW = CONTENT_W / 7
  const gridTop = weekHeadY + weekHeadH
  const gridBottom = LIMIT
  const rowCount = Math.max(1, weeks.length)
  const rowH = (gridBottom - gridTop) / rowCount
  const maxChips = Math.max(1, Math.floor((rowH - 6) / CHIP_LH))

  const grid = weeks.map((week) =>
    week.map((cell) => {
      if (!cell) return null
      const lines = []
      for (const f of cell.festivals) lines.push({ kind: 'fest', text: f.name, type: f.type })
      for (const p of cell.programmes) {
        lines.push({ kind: 'prog', text: [p.ngoLabel, p.title].filter(Boolean).join(' · ') })
      }
      let shown = lines
      let more = 0
      if (lines.length > maxChips) {
        shown = lines.slice(0, maxChips - 1)
        more = lines.length - shown.length
      }
      return { ...cell, lines, shown, more }
    })
  )

  const colW2 = [20, 12, 46, 18, 34, 99, 44]
  const header = ['Date', 'Day', 'Festival', 'NGO', 'Beneficiary', 'Programme', 'Location']
  const headRowH = lineH(8.5) + 5
  const detailRows = (Array.isArray(m.details) ? m.details : []).map((r) => {
    const cells = [r.dateLabel, r.weekday, r.festival, r.ngoLabel, r.beneficiary, r.programme, r.location]
    const lines = cells.map((c, ci) => wrapText(c, colW2[ci] - 6, 8))
    const h = Math.max(...lines.map((l) => l.length)) * lineH(8) + 5
    return { cells, lines, h }
  })

  const pages = [[]]
  let pi = 0
  let y = MT
  const newDetailPage = () => {
    pages.push([])
    pi += 1
    y = MT
    pages[pi].push({ kind: 'tableHead', colW: colW2, header, headRowH, continued: true })
    y += headRowH
  }
  if (detailRows.length) {
    pages[pi].push({ kind: 'tableHead', colW: colW2, header, headRowH, continued: false })
    y += headRowH
    for (const r of detailRows) {
      if (y + r.h > LIMIT + 0.05) newDetailPage()
      pages[pi].push({ kind: 'tableRow', colW: colW2, cells: r.cells, lines: r.lines, h: r.h })
      y += r.h
    }
  }

  const detailPages = detailRows.length ? pages : []

  return {
    meta: {
      title: 'Monthly Calendar',
      ngoLabel: m.ngoLabel || 'All NGOs',
      monthLabel: m.monthLabel || '',
      generated,
    },
    grid: { grid: grid, colW, rowH, headerH, weekHeadY, weekHeadH, gridTop, gridBottom, weekdays: WD },
    detail: { colW: colW2, header, headRowH, pages: detailPages },
    totalPages: 1 + detailPages.length,
  }
}

const setColor = (doc, c) => doc.setTextColor(c[0], c[1], c[2])
const colorFor = (type) => TYPE_COLOR[String(type || '').toLowerCase()] || DEFAULT_COLOR

function drawGridPage(doc, L) {
  const { meta, grid } = L
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  setColor(doc, INK)
  doc.text(meta.title, ML, MT + 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  setColor(doc, INK)
  doc.text(`${meta.monthLabel}`, ML, MT + 13)
  doc.setFontSize(9)
  setColor(doc, MUT)
  doc.text(`NGO: ${meta.ngoLabel}`, PAGE_W - MR, MT + 6, { align: 'right' })
  doc.setFontSize(8)
  doc.text(`Generated: ${meta.generated}`, PAGE_W - MR, MT + 13, { align: 'right' })
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.3)
  doc.line(ML, MT + headerLineOffset(), ML + CONTENT_W, MT + headerLineOffset())

  // Weekday header row.
  doc.setFillColor(...WEEKHEAD_FILL)
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.3)
  for (let c = 0; c < 7; c++) {
    const x = ML + c * grid.colW
    doc.rect(x, grid.weekHeadY, grid.colW, grid.weekHeadH, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    setColor(doc, MUT)
    doc.text(WD[c], x + grid.colW / 2, grid.weekHeadY + 4.7, { align: 'center' })
  }

  // Day cells.
  grid.grid.forEach((week, wi) => {
    const y = grid.gridTop + wi * grid.rowH
    week.forEach((cell, ci) => {
      const x = ML + ci * grid.colW
      doc.setDrawColor(...LINE)
      doc.setLineWidth(0.3)
      doc.rect(x, y, grid.colW, grid.rowH)
      if (!cell) return
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      setColor(doc, INK)
      doc.text(String(cell.day), x + 2.2, y + 4.4)

      let cy = y + 8
      for (const ln of cell.shown) {
        const col = ln.kind === 'fest' ? colorFor(ln.type) : INK
        doc.setFillColor(...col)
        doc.circle(x + 2.6, cy - 1.1, 0.7, 'F')
        doc.setFont('helvetica', ln.kind === 'fest' ? 'bold' : 'normal')
        doc.setFontSize(6.4)
        setColor(doc, col)
        const maxW = grid.colW - 6
        const lines = wrapText(ln.text, maxW, 6.4)
        for (const t of lines) {
          doc.text(t, x + 4.2, cy)
          cy += CHIP_LH
        }
      }
      if (cell.more > 0) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(6.4)
        setColor(doc, MUT)
        doc.text(`+${cell.more} more`, x + 4.2, cy)
      }
    })
  })
}

// The rule under the header sits just below the tallest header line (both may be
// right-aligned two-line blocks, so keep a fixed, safe offset).
function headerLineOffset() {
  return 16
}

function drawDetailEntry(doc, entry) {
  if (entry.kind === 'tableHead') {
    doc.setFillColor(...HEAD_FILL)
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.3)
    let x = ML
    entry.colW.forEach((w, i) => {
      doc.rect(x, entry.yTop, w, entry.headRowH, 'FD')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      setColor(doc, INK)
      doc.text(entry.header[i], x + 3, entry.headRowH / 2 + 1.4)
      x += w
    })
    return
  }
  if (entry.kind === 'tableRow') {
    const ly = lineH(8)
    let x = ML
    entry.cells.forEach((c, i) => {
      doc.setDrawColor(...LINE)
      doc.setLineWidth(0.3)
      doc.rect(x, entry.yTop, entry.colW[i], entry.yBot - entry.yTop)
      doc.setFont('helvetica', i === 5 ? 'bold' : 'normal')
      doc.setFontSize(8)
      setColor(doc, INK)
      entry.lines[i].forEach((ln, k) => doc.text(ln, x + 3, entry.yTop + 4.2 + k * ly))
      x += entry.colW[i]
    })
  }
}

export function layoutDetailOffsets(layout) {
  const pages = layout?.detail?.pages || []
  return pages.map((rows) => {
    let y = MT
    return rows.map((e) => {
      const h = e.kind === 'tableHead' ? e.headRowH : e.h
      const top = y
      y += h
      return { entry: e, yTop: top, yBot: top + h }
    })
  })
}

export function buildMonthlyCalendarPdf(model) {
  const L = layoutMonthlyCalendarPages(model)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  drawGridPage(doc, L)

  const offsets = layoutDetailOffsets(L)
  offsets.forEach((rows) => {
    doc.addPage('a4', 'landscape')
    for (const { entry, yTop, yBot } of rows) {
      entry.yTop = yTop
      entry.yBot = yBot
      drawDetailEntry(doc, entry)
    }
  })

  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    setColor(doc, MUT)
    doc.text(`Page ${i} of ${n}`, PAGE_W - MR, PAGE_H - 5, { align: 'right' })
  }
  return doc
}
