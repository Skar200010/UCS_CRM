import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildReelsChecklistPdf, layoutReelsPages, PAGE_H, CONTENT_W } from '../src/panels/event-head/components/reelsPdf.mjs'
import { REELS_SECTIONS, APPROVER_ROLES, REELS_INIT_CHECKS } from '../src/panels/event-head/components/reelsData.mjs'

const LIMIT = PAGE_H - 16

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const emptyApprovers = () =>
  APPROVER_ROLES.reduce((acc, r) => ({ ...acc, [r.id]: { name: '', date: '2026-10-10', sig: null } }), {})

const signedApprovers = () =>
  APPROVER_ROLES.reduce((acc, r) => ({ ...acc, [r.id]: { name: r.label, date: '2026-10-10', sig: PNG } }), {})

const checksAll = () => {
  const c = JSON.parse(JSON.stringify(REELS_INIT_CHECKS))
  for (const s of REELS_SECTIONS) c[s.id] = c[s.id].map(() => true)
  return c
}

const countEntries = (pages, kind) => pages.reduce((n, pg) => n + pg.filter((e) => e.kind === kind).length, 0)
const allEntries = (pages) => pages.flat()

function makeState(over = {}) {
  return {
    details: { title: 'Building a school library for village kids', topic: 'Education for underprivileged children', editor: 'Riya Sharma', preparedBy: 'Aman Verma', date: '2026-10-10' },
    types: { 'Long Video': true, 'Short': false, 'Event': false, 'Story': false, 'Awareness': false },
    checks: JSON.parse(JSON.stringify(REELS_INIT_CHECKS)),
    approvers: emptyApprovers(),
    ready: false,
    totalChecks: REELS_SECTIONS.reduce((n, s) => n + s.items.length, 0),
    doneCount: 0,
    missingApprovers: APPROVER_ROLES.length,
    pendingCount: REELS_SECTIONS.reduce((n, s) => n + s.items.length, 0) + APPROVER_ROLES.length,
    ...over,
  }
}

let failures = 0
function assert(cond, msg) {
  if (cond) {
    console.log(`  PASS  ${msg}`)
  } else {
    failures += 1
    console.error(`  FAIL  ${msg}`)
  }
}

function validate(pages, label) {
  console.log(`\n[${label}] pages: ${pages.length}`)
  assert(pages.length >= 1, `${label}: at least 1 page`)
  assert(pages.every((pg) => pg.length > 0), `${label}: no empty pages`)
  assert(pages[0][0].kind === 'header', `${label}: header on page 1`)
  assert(countEntries(pages, 'details') === 1, `${label}: video details block appears once`)
  assert(countEntries(pages, 'approval') === 1, `${label}: approval block appears once`)
  assert(countEntries(pages, 'publish') === 1, `${label}: publish block appears once`)
  const det = allEntries(pages).find((e) => e.kind === 'details')
  const detLabels = det ? det.rows.map((r) => r.label) : []
  assert(
    detLabels.join('|') === 'Video Title|Video Topic / Project|Video Editor|Prepared By|Date|Video Type',
    `${label}: video details rows correct (got ${detLabels.join(', ')})`
  )
  const items = allEntries(pages).filter((e) => e.kind === 'item')
  const total = REELS_SECTIONS.reduce((n, s) => n + s.items.length, 0)
  assert(items.length === total, `${label}: all ${total} checklist items present (got ${items.length})`)
  REELS_SECTIONS.forEach((s, i) => {
    const n = allEntries(pages).filter((e) => e.kind === 'item' && e.sectionIndex === i).length
    assert(n === s.items.length, `${label}: section ${i} has ${s.items.length} items (got ${n})`)
  })
  const overflow = allEntries(pages).filter((e) => e.yTop < 15 || e.yBot > LIMIT + 0.05)
  assert(overflow.length === 0, `${label}: no entry exceeds page bounds (found ${overflow.map((e) => e.kind).join(',')})`)
  const textLost = items.filter((e) => !e.text || !e.lines.length || e.lines.every((l) => !l.trim()))
  assert(textLost.length === 0, `${label}: no checklist text lost/wrapped empty`)
}

const scenarios = [
  ['empty', makeState()],
  ['partial', makeState({ checks: { ...makeState().checks, quality: [true, false, true, false, false, false, false, false, false, false] } })],
  ['complete-drawn-sigs', makeState({ checks: checksAll(), approvers: signedApprovers(), ready: true, doneCount: 41, missingApprovers: 0, pendingCount: 0 })],
  ['complete-typed-names', makeState({
    checks: checksAll(),
    approvers: APPROVER_ROLES.reduce((acc, r) => ({ ...acc, [r.id]: { name: 'Full Name ' + r.label, date: '2026-10-10', sig: null } }), {}),
    ready: true, doneCount: 41, missingApprovers: 0, pendingCount: 0,
  })],
  ['long-content', makeState({
    details: { title: 'A very long and detailed video title that keeps going and going to test wrapping of unusually long text inside the PDF layout engine without ever clipping or splitting a row',
      topic: 'Another extremely long project description line meant to force the value column to wrap onto multiple lines so we can confirm the details table still keeps rows intact across pages', editor: 'Some Editor With A Very Long Name Indeed', preparedBy: 'A Person Who Also Has A Remarkably Long Name', date: '2026-10-10' },
    checks: { ...checksAll(), quality: REELS_INIT_CHECKS.quality.map(() => false) },
  })],
]

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), 'out')
mkdirSync(outDir, { recursive: true })

for (const [name, state] of scenarios) {
  const pages = layoutReelsPages(state)
  validate(pages, name)
  const doc = buildReelsChecklistPdf(state)
  assert(doc.getNumberOfPages() === pages.length, `${name}: rendered page count ${doc.getNumberOfPages()} matches layout ${pages.length}`)
  const buf = Buffer.from(doc.output('arraybuffer'))
  assert(buf.length > 2000, `${name}: produced a real PDF (${buf.length} bytes)`)
  writeFileSync(resolve(outDir, `${name}.pdf`), buf)
}

// Force a content-heavy multi-page check: every single block on a page by itself would still need > 3 pages.
{
  const heavy = makeState({ checks: checksAll(), approvers: signedApprovers(), ready: true, doneCount: 41, missingApprovers: 0, pendingCount: 0 })
  heavy.details.title = 'x'.repeat(2000)
  heavy.details.topic = 'y'.repeat(2000)
  const pages = layoutReelsPages(heavy)
  console.log(`\n[stress] pages: ${pages.length}`)
  assert(pages.length >= 3, `stress: content overflows at least 3 pages (got ${pages.length})`)
  assert(pages.every((p) => p.length > 0), 'stress: no empty page')
  const doc = buildReelsChecklistPdf(heavy)
  assert(doc.getNumberOfPages() === pages.length, 'stress: page counts match')
  const stressBuf = Buffer.from(doc.output('arraybuffer'))
  writeFileSync(resolve(outDir, 'stress.pdf'), stressBuf)
}

console.log(`\nPDF test results: ${failures === 0 ? 'ALL PASS' : failures + ' FAILURES'}`)
console.log(`Wrote sample PDFs to: ${outDir}`)
process.exit(failures === 0 ? 0 : 1)