import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildCalendarModel,
  layoutMonthlyCalendarPages,
  layoutDetailOffsets,
  buildMonthlyCalendarPdf,
  PAGE_H,
  PAGE_W,
} from '../src/panels/event-head/components/planner/monthlyCalendarPdf.mjs'

const ML = 12
const MT = 13
const LIMIT = PAGE_H - 12

let failures = 0
function assert(cond, msg) {
  if (cond) {
    console.log(`  PASS  ${msg}`)
  } else {
    failures += 1
    console.error(`  FAIL  ${msg}`)
  }
}

const daysInMonth = (ym) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

function validate(model, layout, label, expect = {}) {
  console.log(`\n[${label}] weeks=${model.weeks.length} details=${model.details.length} pages=${layout.totalPages}`)

  assert(layout.meta.title === 'Monthly Calendar', `${label}: meta title`)
  assert(layout.meta.monthLabel === model.monthLabel, `${label}: meta month label`)
  assert(model.weeks.length >= 4 && model.weeks.length <= 6, `${label}: 4–6 week rows (got ${model.weeks.length})`)
  assert(model.weeks.every((w) => w.length === 7), `${label}: every week row has 7 cells`)

  const realCells = model.weeks.flat().filter(Boolean)
  assert(realCells.length === daysInMonth(model.month), `${label}: every day of the month present (got ${realCells.length})`)
  assert(realCells.every((c) => c.date.startsWith(model.month)), `${label}: cells belong to the month`)

  // No duplicated (date, festival) pair in the detail list.
  const keys = model.details.map((r) => `${r.date}::${String(r.festival).toLowerCase()}::${String(r.programme).toLowerCase()}`)
  assert(new Set(keys).size === keys.length, `${label}: no duplicate detail rows`)

  if (expect.programmes != null) {
    const withProg = model.details.filter((r) => r.programme && r.programme !== '—')
    assert(withProg.length === expect.programmes, `${label}: ${expect.programmes} programmed rows (got ${withProg.length})`)
  }
  if (expect.detailRows != null) {
    assert(model.details.length === expect.detailRows, `${label}: ${expect.detailRows} detail rows (got ${model.details.length})`)
  }

  // Grid fits the page.
  const grid = layout.grid
  const gridBottom = grid.gridTop + model.weeks.length * grid.rowH
  assert(gridBottom <= grid.gridBottom + 0.05, `${label}: grid rows fit above the page edge`)
  assert(grid.gridTop > 0 && grid.gridBottom <= LIMIT, `${label}: grid vertical bounds sane`)

  // Chip overflow handling.
  const maxChips = Math.max(1, Math.floor((grid.rowH - 6) / 3.4))
  const cellsWithChips = grid.grid.flat().filter(Boolean)
  assert(cellsWithChips.every((c) => c.shown.length <= maxChips), `${label}: no cell shows more chips than fit`)
  assert(cellsWithChips.every((c) => c.more === 0 || c.shown.length === maxChips - 1), `${label}: '+N more' replaces the last chip`)

  // Detail pagination: every page starts with a header and no row overflows.
  const offsets = layoutDetailOffsets(layout)
  assert(offsets.length === (layout.detail.pages.length), `${label}: offset pages match layout pages`)
  offsets.forEach((rows, pi) => {
    assert(rows.length > 0, `${label}: detail page ${pi + 1} not empty`)
    assert(rows[0].entry.kind === 'tableHead', `${label}: detail page ${pi + 1} starts with a header`)
    rows.forEach(({ entry, yTop, yBot }) => {
      assert(yTop >= MT - 0.05 && yBot <= LIMIT + 0.05, `${label}: detail row ${entry.kind} within page bounds`)
    })
  })

  const doc = buildMonthlyCalendarPdf(model)
  assert(doc.getNumberOfPages() === layout.totalPages, `${label}: rendered pages ${doc.getNumberOfPages()} == layout ${layout.totalPages}`)
  const buf = Buffer.from(doc.output('arraybuffer'))
  assert(buf.length > 2000, `${label}: produced a real PDF (${buf.length} bytes)`)
  return buf
}

const month = '2026-11'
const baseArgs = (over = {}) => ({ month, ngoLabel: 'BSCT', observancesByDate: {}, programmeRows: [], ...over })
const obs = (map) => map
const prog = (o) => ({ date: '2026-11-01', festival: 'X', title: 'T', ngoLabel: 'BSCT', beneficiary: 'Children', location: 'Hall', status: 'Draft', ...o })

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), 'out')
mkdirSync(outDir, { recursive: true })
const pdfs = {}

// Empty month — grid only, no detail pages.
{
  const model = buildCalendarModel(baseArgs())
  const layout = layoutMonthlyCalendarPages(model)
  pdfs.empty = validate(model, layout, 'empty', { detailRows: 0, programmes: 0 })
  assert(layout.detail.pages.length === 0, 'empty: no detail pages')
  assert(layout.totalPages === 1, 'empty: grid-only single page')
}

// Filled month — several festivals and programmes, multiple on one date.
{
  const model = buildCalendarModel(baseArgs({
    observancesByDate: obs({
      '2026-11-08': [{ name: 'Diwali', type: 'festival' }, { name: 'Govardhan Puja', type: 'religious' }],
      '2026-11-14': [{ name: "Children's Day", type: 'national' }],
      '2026-11-24': [{ name: 'Guru Nanak Jayanti', type: 'religious' }],
    }),
    programmeRows: [
      prog({ date: '2026-11-08', festival: 'Diwali', title: 'Sweet Distribution', beneficiary: 'Children' }),
      prog({ date: '2026-11-08', festival: 'Govardhan Puja', title: 'Community Kitchen', beneficiary: 'Underprivileged Families' }),
      prog({ date: '2026-11-24', festival: 'Guru Nanak Jayanti', title: 'Langer Seva', beneficiary: 'All' }),
    ],
  }))
  const layout = layoutMonthlyCalendarPages(model)
  pdfs.filled = validate(model, layout, 'filled', { detailRows: 4, programmes: 3 })
  const nov8 = model.details.filter((r) => r.date === '2026-11-08')
  assert(nov8.length === 2, 'filled: two festivals on Nov 8 stay separate rows')
  assert(model.details.some((r) => r.festival === "Children's Day" && r.programme === '—'), 'filled: festival with no programme listed with a dash')
}

// Dedup — a programme for a festival that already has an observance row must not
// produce a second row.
{
  const model = buildCalendarModel(baseArgs({
    observancesByDate: obs({ '2026-11-08': [{ name: 'Diwali', type: 'festival' }] }),
    programmeRows: [prog({ date: '2026-11-08', festival: 'diwali', title: 'Sweet Distribution' })],
  }))
  const layout = layoutMonthlyCalendarPages(model)
  validate(model, layout, 'dedup', { detailRows: 1, programmes: 1 })
  const row = model.details[0]
  assert(row.festival === 'Diwali' && row.programme === 'Sweet Distribution', 'dedup: observance + programme merged to one row (case-insensitive)')
}

// A manually typed programme with no observance still appears.
{
  const model = buildCalendarModel(baseArgs({
    programmeRows: [prog({ date: '2026-11-20', festival: 'No important day', title: 'Blanket Drive' })],
  }))
  const layout = layoutMonthlyCalendarPages(model)
  validate(model, layout, 'manual-only', { detailRows: 1, programmes: 1 })
}

// Long text + a dense month (stress): must paginate and never overflow.
{
  const observances = {}
  const programmes = []
  for (let d = 1; d <= 30; d++) {
    const date = `2026-11-${String(d).padStart(2, '0')}`
    observances[date] = [
      { name: `Festival Number ${d} with a fairly long occasion name`, type: 'festival' },
      { name: `Awareness Day ${d}`, type: 'international' },
    ]
    programmes.push(prog({ date, festival: `Festival Number ${d} with a fairly long occasion name`, title: 'Distribution programme with a long descriptive title '.repeat(3), beneficiary: 'Underprivileged Families', location: 'Community Hall, Sector 8, Long Address Line' }))
  }
  const model = buildCalendarModel(baseArgs({ observancesByDate: observances, programmeRows: programmes }))
  const layout = layoutMonthlyCalendarPages(model)
  // 30 dated festivals + 30 "Awareness Day" observances; each dated festival is
  // merged with its programme => 60 detail rows, 30 of them programmed.
  pdfs.stress = validate(model, layout, 'stress', { detailRows: 60, programmes: 30 })
  const dated = model.details.filter((r) => r.festival.startsWith('Festival Number'))
  assert(dated.length === 30 && dated.every((r) => r.programme !== '—'), 'stress: every dated festival got its programme merged')
  assert(model.details.filter((r) => r.festival.startsWith('Awareness Day')).every((r) => r.programme === '—'), 'stress: observances without a programme listed with a dash')
}

writeFileSync(resolve(outDir, 'monthly-calendar-empty.pdf'), pdfs.empty)
writeFileSync(resolve(outDir, 'monthly-calendar-filled.pdf'), pdfs.filled)
writeFileSync(resolve(outDir, 'monthly-calendar-stress.pdf'), pdfs.stress)

console.log(`\nPDF test results: ${failures === 0 ? 'ALL PASS' : failures + ' FAILURES'}`)
console.log(`Wrote sample PDFs to: ${outDir}`)
process.exit(failures === 0 ? 0 : 1)
