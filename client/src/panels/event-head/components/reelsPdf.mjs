import { jsPDF } from 'jspdf'
import { APPROVER_ROLES, REELS_PUBLISH_RULES, REELS_SECTIONS, REELS_VIDEO_TYPES } from './reelsData.mjs'

export const PAGE_W = 210
export const PAGE_H = 297
const ML = 14
const MR = 14
const MT = 16
const MB = 16
export const CONTENT_W = PAGE_W - ML - MR
const LIMIT = PAGE_H - MB
const GAP = 4

const PT = 0.3528
const lineH = (fs) => fs * PT * 1.32
const charW = (fs) => fs * PT * 0.5

const INK = [31, 36, 48]
const MUT = [107, 114, 128]
const LINE = [213, 217, 228]
const HEAD_FILL = [232, 236, 246]
const GREEN = [22, 163, 74]
const AMBER_T = [154, 52, 18]
const AMBER_BG = [255, 247, 237]
const AMBER_LINE = [251, 213, 167]
const GREEN_BG = [236, 253, 243]
const GREEN_LINE = [167, 227, 193]

function wrapText(text, maxW, fs) {
  const s = String(text ?? '')
  const chars = Math.max(1, Math.floor(maxW / charW(fs)))
  const words = s.split(/\s+/).filter(Boolean)
  if (!words.length) return [s]
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

function detailsRows(details, types) {
  const valueW = CONTENT_W - 46 - 10
  return [
    ['Video Title', details.title],
    ['Video Topic / Project', details.topic],
    ['Video Editor', details.editor],
    ['Prepared By', details.preparedBy],
    ['Date', details.date],
    ['Video Type', REELS_VIDEO_TYPES.filter((t) => types[t]).join(', ')],
  ].map(([k, v]) => {
    const value = String(v ?? '').trim() || '\u2014'
    return { label: k, value, lines: wrapText(value, valueW, 9.5) }
  })
}

export function layoutReelsPages(data) {
  const pages = [[]]
  let page = 0
  let y = MT
  const state = {}

  const currentY = () => y
  const finishPage = () => {
    pages.push([])
    page += 1
    y = MT
  }
  const ensure = (h) => {
    if (y + h > LIMIT + 0.05) finishPage()
  }
  const addEntry = (entry, h) => {
    if (y > MT) y += GAP
    ensure(h)
    entry.pageNo = page
    entry.yTop = y
    entry.yBot = y + h
    pages[page].push(entry)
    y += h
    return entry
  }

  const generated = new Date().toLocaleString()

  addEntry(
    {
      kind: 'header',
      title: 'Reels Checklist',
      subtitle: 'Program Video & Reels \u2013 Pre-Upload Checklist & Approval Form',
      generated,
    },
    lineH(15) + lineH(9.5) + lineH(8) + 8
  )

  const rows = detailsRows(data.details || {}, data.types || {})
  const headH = lineH(11) + 5
  const detailsH =
    headH + rows.reduce((sum, r) => sum + r.lines.length * lineH(9.5) + 7, 0)
  addEntry(
    {
      kind: 'details',
      head: '1 \u00b7 VIDEO DETAILS',
      rows,
      labelW: 46,
      valueW: CONTENT_W - 46 - 10,
      headH,
    },
    detailsH
  )

  REELS_SECTIONS.forEach((s, i) => {
    const items = (data.checks || {})[s.id] || []
    const done = s.items.filter((_, j) => items[j]).length
    const headTxt = `${i + 2} \u00b7 ${s.label} \u2014 ${done}/${s.items.length}`
    const firstH = (() => {
      const lines = wrapText(s.items[0], CONTENT_W - 12, 10)
      return lines.length * lineH(10) + 4
    })()
    if (y > MT && y + headH + GAP + firstH > LIMIT + 0.05) finishPage()
    addEntry(
      { kind: 'secHead', text: headTxt, done: done === s.items.length },
      headH
    )
    s.items.forEach((txt, j) => {
      const lines = wrapText(txt, CONTENT_W - 12, 10)
      addEntry(
        {
          kind: 'item',
          sectionIndex: i,
          itemIndex: j,
          text: txt,
          lines,
          checked: !!items[j],
        },
        lines.length * lineH(10) + 4
      )
    })
  })

  const roles = APPROVER_ROLES.map((r) => {
    const a = (data.approvers || {})[r.id] || {}
    const name = String(a.name ?? '').trim()
    const date = String(a.date ?? '').trim() || '\u2014'
    const nameLines = wrapText(name || '\u2014', 48, 9.5)
    return {
      id: r.id,
      label: r.label,
      name,
      date,
      nameLines,
      sig: a.sig || null,
    }
  })
  const cellW = (CONTENT_W - 8) / 3
  const sigH = 16.5
  const sigW = Math.min(cellW - 8, sigH * (640 / 220))
  let bodyH = 0
  roles.forEach((r) => {
    const nameH = r.nameLines.length * lineH(9.5)
    const dateH = lineH(9.5)
    const sigArea = r.sig ? sigH + 2 : lineH(9.5) + 6
    r.bodyH = nameH + dateH + 8 + sigArea + 6
    if (r.bodyH > bodyH) bodyH = r.bodyH
  })
  const approvalHeadH = lineH(11) + 5
  const approvalH = approvalHeadH + 9 + bodyH
  addEntry(
    {
      kind: 'approval',
      head: `${REELS_SECTIONS.length + 2} \u00b7 FINAL APPROVAL`,
      roles,
      cellW,
      sigH,
      sigW,
      headH: approvalHeadH,
    },
    approvalH
  )

  const pendingTxt = !data.ready
    ? `STATUS: NOT READY \u2014 ${data.pendingCount ?? 0} item${data.pendingCount === 1 ? '' : 's'} pending (${data.totalChecks - data.doneCount} checks and ${data.missingApprovers} approver${data.missingApprovers === 1 ? '' : 's'} to sign).`
    : 'STATUS: READY TO PUBLISH \u2713'
  const ruleLines = REELS_PUBLISH_RULES.map((r) => wrapText(r, CONTENT_W - 24, 9))
  const publishH =
    9 +
    lineH(11) +
    5 +
    ruleLines.reduce((sum, l) => sum + l.length * lineH(9) + 2.4, 0) +
    5 +
    Math.max(1, wrapText(pendingTxt, CONTENT_W - 24, 9.5).length) * lineH(9.5) +
    4 +
    9
  addEntry(
    {
      kind: 'publish',
      ready: !!data.ready,
      rules: ruleLines,
      pendingTxt,
      pendingLines: wrapText(pendingTxt, CONTENT_W - 24, 9.5),
    },
    publishH
  )

  state.pages = pages
  state.currentY = currentY
  return pages
}

const setColor = (doc, c) => doc.setTextColor(c[0], c[1], c[2])

function drawEntry(doc, entry) {
  if (entry.kind === 'header') {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    setColor(doc, INK)
    doc.text(entry.title, ML, entry.yTop + 6)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    setColor(doc, MUT)
    doc.text(entry.subtitle, ML, entry.yTop + 6 + lineH(15) + 2.5)
    doc.setFontSize(8)
    doc.text(`Generated: ${entry.generated}`, ML, entry.yTop + 6 + lineH(15) + lineH(9.5) + 5)
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.3)
    doc.line(ML, entry.yTop + 19, ML + CONTENT_W, entry.yTop + 19)
    return
  }

  if (entry.kind === 'details') {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    setColor(doc, INK)
    doc.text(entry.head, ML, entry.yTop + 5)
    const ly = lineH(9.5)
    let ty = entry.yTop + entry.headH
    entry.rows.forEach((r) => {
      const h = r.lines.length * ly + 7
      doc.setDrawColor(...LINE)
      doc.setLineWidth(0.3)
      doc.rect(ML, ty, entry.labelW, h)
      doc.rect(ML + entry.labelW, ty, entry.valueW, h)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      setColor(doc, INK)
      doc.text(r.label.split('\n')[0].slice(0, 44), ML + 4, ty + 4.5)
      doc.setFont('helvetica', 'normal')
      r.lines.forEach((ln, k) => doc.text(ln, ML + entry.labelW + 4, ty + 4.5 + k * ly))
      ty += h
    })
    return
  }

  if (entry.kind === 'secHead') {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    setColor(doc, entry.done ? GREEN : INK)
    doc.text(entry.text, ML, entry.yTop + 4.5)
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.25)
    doc.line(ML, entry.yTop + 6.5, ML + CONTENT_W, entry.yTop + 6.5)
    return
  }

  if (entry.kind === 'item') {
    const h = entry.yBot - entry.yTop
    const boxY = entry.yTop + (h - 4.2) / 2
    doc.setDrawColor(...(entry.checked ? GREEN : [156, 163, 175]))
    doc.setLineWidth(0.4)
    if (entry.checked) {
      doc.setFillColor(...GREEN)
      doc.rect(ML + 1, boxY, 4.2, 4.2, 'F')
      doc.setDrawColor(255, 255, 255)
      doc.setLineWidth(0.55)
      doc.line(ML + 1.45, boxY + 2.1, ML + 2.15, boxY + 3.05)
      doc.line(ML + 2.15, boxY + 3.05, ML + 3.75, boxY + 1.15)
    } else {
      doc.rect(ML + 1, boxY, 4.2, 4.2)
    }
    const ly = lineH(10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    setColor(doc, INK)
    entry.lines.forEach((ln, k) => doc.text(ln, ML + 10, entry.yTop + 3.4 + k * ly))
    return
  }

  if (entry.kind === 'approval') {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    setColor(doc, INK)
    doc.text(entry.head, ML, entry.yTop + 5)
    const t0 = entry.yTop + entry.headH
    entry.roles.forEach((r, i) => {
      const x = ML + i * (entry.cellW + 4)
      doc.setFillColor(...HEAD_FILL)
      doc.setDrawColor(...LINE)
      doc.setLineWidth(0.3)
      doc.rect(x, t0, entry.cellW, 9, 'FD')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      setColor(doc, INK)
      doc.text(r.label, x + 4, t0 + 5.6)
    })
    const b0 = t0 + 9
    entry.roles.forEach((r, i) => {
      const x = ML + i * (entry.cellW + 4)
      doc.setFillColor(255, 255, 255)
      doc.setDrawColor(...LINE)
      doc.setLineWidth(0.3)
      doc.rect(x, b0, entry.cellW, r.bodyH, 'FD')
      const ly = lineH(9.5)
      let yc = b0 + 5
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      setColor(doc, MUT)
      doc.text('Name:', x + 4, yc)
      doc.setFont('helvetica', 'normal')
      setColor(doc, INK)
      r.nameLines.forEach((ln, k) => {
        if (k === 0) doc.text(ln, x + 4 + doc.getTextWidth('Name: '), yc)
        else doc.text(ln, x + 4, yc + k * ly)
      })
      yc += r.nameLines.length * ly
      doc.setFont('helvetica', 'bold')
      setColor(doc, MUT)
      doc.text('Date:', x + 4, yc)
      doc.setFont('helvetica', 'normal')
      setColor(doc, INK)
      doc.text(r.date, x + 4 + doc.getTextWidth('Date: '), yc)
      const yS = yc + 10
      if (r.sig) {
        doc.addImage(r.sig, 'PNG', x + 4, yS, entry.sigW, entry.sigH)
        doc.setDrawColor(...LINE)
        doc.setLineWidth(0.3)
      } else {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(9)
        setColor(doc, MUT)
        doc.text('Not signed', x + 4, yS + 8)
        doc.setFont('helvetica', 'normal')
      }
    })
    return
  }

  if (entry.kind === 'publish') {
    const h = entry.yBot - entry.yTop
    doc.setFillColor(...(entry.ready ? GREEN_BG : AMBER_BG))
    doc.setDrawColor(...(entry.ready ? GREEN_LINE : AMBER_LINE))
    doc.setLineWidth(0.4)
    doc.rect(ML, entry.yTop, CONTENT_W, h, 'FD')
    setColor(doc, entry.ready ? GREEN : AMBER_T)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(entry.ready ? 'READY TO PUBLISH' : 'PUBLISH ONLY WHEN EVERYTHING BELOW IS DONE', ML + 6, entry.yTop + 8)
    const ly = lineH(9)
    let ty = entry.yTop + 8 + lineH(11) + 4
    entry.rules.forEach((lines) => {
      doc.setFillColor(...GREEN)
      doc.rect(ML + 7, ty - 2.6, 2.6, 2.6, 'F')
      doc.setLineWidth(0.15)
      doc.line(ML + 7.45, ty - 1.35, ML + 7.8, ty - 0.95)
      doc.line(ML + 7.8, ty - 0.95, ML + 9.1, ty - 2.2)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      setColor(doc, INK)
      lines.forEach((ln, k) => doc.text(ln, ML + 12, ty + k * ly))
      ty += lines.length * ly + 2.4
    })
    ty += 3
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    setColor(doc, entry.ready ? GREEN : AMBER_T)
    entry.pendingLines.forEach((ln, k) => doc.text(ln, ML + 6, ty + k * lineH(9.5)))
    return
  }
}

export function buildReelsChecklistPdf(data) {
  const pages = layoutReelsPages(data)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  for (let p = 0; p < pages.length; p++) {
    if (p > 0) doc.addPage()
    pages[p].forEach((entry) => drawEntry(doc, entry))
  }
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    setColor(doc, MUT)
    doc.text(`Page ${i} of ${n}`, PAGE_W - MR, PAGE_H - 6, { align: 'right' })
  }
  return doc
}