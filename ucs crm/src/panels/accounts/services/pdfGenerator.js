import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

export function formatIndianCurrency(amount) {
  const num = Number(amount)
  if (isNaN(num)) return '₹0'

  const str = Math.round(num).toString()
  const lastThree = str.slice(-3)
  const rest = str.slice(0, -3)
  let formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')
  if (rest) formatted += ','
  formatted += lastThree
  return `₹${formatted}`
}

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function convertBelow1000(n) {
  if (n === 0) return ''
  let res = ''
  if (n >= 100) {
    res += ones[Math.floor(n / 100)] + ' Hundred '
    n %= 100
  }
  if (n >= 20) {
    res += tens[Math.floor(n / 10)] + ' '
    n %= 10
  }
  if (n > 0) {
    res += ones[n] + ' '
  }
  return res.trim()
}

export function amountInWords(amount) {
  const num = Number(amount)
  if (isNaN(num) || num === 0) return 'Zero Rupees and No. Paise Only'

  const rupees = Math.floor(num)
  const paise = Math.round((num - rupees) * 100)

  let res = ''
  if (rupees > 0) {
    const crore = Math.floor(rupees / 10000000)
    const lakh = Math.floor((rupees % 10000000) / 100000)
    const thousand = Math.floor((rupees % 100000) / 1000)
    const remainder = rupees % 1000

    if (crore > 0) res += convertBelow1000(crore) + ' Crore '
    if (lakh > 0) res += convertBelow1000(lakh) + ' Lakh '
    if (thousand > 0) res += convertBelow1000(thousand) + ' Thousand '
    if (remainder > 0) res += convertBelow1000(remainder)

    res += ' Rupees'
  }

  if (paise > 0) {
    res += ' and ' + convertBelow1000(paise) + ' Paise Only'
  } else {
    res += ' and No. Paise Only'
  }

  return res.trim()
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

export function getFormattedDate() {
  const d = new Date()
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parseMonthName(s) {
  if (!s) return -1
  const lower = s.toLowerCase()
  for (let i = 0; i < MONTHS_SHORT.length; i++) {
    if (MONTHS_SHORT[i].toLowerCase() === lower) return i + 1
  }
  return -1
}

function parseAndFormat(raw) {
  let parts = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (parts) {
    let [, d, m, y] = parts
    if (y.length === 2) y = '20' + y
    const day = parseInt(d, 10)
    const month = parseInt(m, 10)
    const year = parseInt(y, 10)
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return formatDateFromParts(day, month, year)
    }
  }

  parts = raw.match(/^(\d{1,2})[/-]([A-Za-z]{3})[/-](\d{2,4})$/)
  if (parts) {
    let [, d, m, y] = parts
    if (y.length === 2) y = '20' + y
    const day = parseInt(d, 10)
    const month = parseMonthName(m)
    const year = parseInt(y, 10)
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return formatDateFromParts(day, month, year)
    }
  }

  parts = raw.match(/^(\d{1,2})[ ](\d{1,2}|[A-Za-z]{3,})[ ](\d{2,4})$/)
  if (parts) {
    let [, d, m, y] = parts
    if (y.length === 2) y = '20' + y
    const day = parseInt(d, 10)
    const monthNum = parseInt(m, 10)
    if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12 && day >= 1 && day <= 31) {
      return formatDateFromParts(day, monthNum, year)
    }
    const monthName = parseMonthName(m)
    if (monthName >= 1 && monthName <= 12 && day >= 1 && day <= 31) {
      return formatDateFromParts(day, monthName, year)
    }
  }

  return null
}

function formatDateFromParts(day, month, year) {
  const shortYear = String(year).slice(-2)
  return `${day}-${MONTHS_SHORT[month - 1]}-${shortYear}`
}

function formatInIndianTimezone(d) {
  const ms = d.getTime()
  const indianOffset = 5.5 * 60 * 60 * 1000
  const local = new Date(ms + indianOffset)
  const sy = String(local.getUTCFullYear()).slice(-2)
  return `${local.getUTCDate()}-${MONTHS_SHORT[local.getUTCMonth()]}-${sy}`
}

export function formatReceiptDate(dateStr) {
  if (!dateStr || String(dateStr).trim() === '') return getFormattedDate()

  if (dateStr instanceof Date) {
    return formatInIndianTimezone(dateStr)
  }

  if (typeof dateStr === 'number') {
    const d = new Date((dateStr - 25569) * 86400000)
    if (!isNaN(d.getTime())) {
      return formatInIndianTimezone(d)
    }
  }

  const raw = String(dateStr).trim()

  const numeric = raw.replace(/[, ]/g, '')
  if (/^\d{5}$/.test(numeric)) {
    const d = new Date((parseInt(numeric, 10) - 25569) * 86400000)
    if (!isNaN(d.getTime())) {
      return formatInIndianTimezone(d)
    }
  }

  const result = parseAndFormat(raw)
  if (result) return result

  const d = new Date(raw)
  if (!isNaN(d.getTime())) {
    return formatInIndianTimezone(d)
  }

  return raw
}

function imgToDataUrl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      c.getContext('2d').drawImage(img, 0, 0)
      resolve(c.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = src
  })
}

function getReceiptTarget(element) {
  if (!element) throw new Error('Receipt preview is not available')
  if (element.matches?.('[data-receipt-sheet]')) return element
  return element.querySelector?.('[data-receipt-sheet]') || element.firstElementChild || element
}

function waitForImage(img) {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => resolve()
    img.addEventListener('load', done, { once: true })
    img.addEventListener('error', done, { once: true })
  })
}

export async function generateReceiptPDF(element, opts = {}) {
  const { scale = 2, jpegQuality = 0.95 } = opts
  const target = getReceiptTarget(element)
  await Promise.all([...target.querySelectorAll('img')].map(waitForImage))

  const requestedWidth = Number(target.dataset.pdfWidth)
  const captureWidth = requestedWidth > 0
    ? requestedWidth
    : Math.ceil(Math.max(target.scrollWidth, target.getBoundingClientRect().width))
  const clone = target.cloneNode(true)
  clone.style.width = `${captureWidth}px`
  clone.style.maxWidth = 'none'
  clone.style.boxSizing = 'border-box'
  clone.style.margin = '0'
  clone.style.position = 'absolute'
  clone.style.left = '0'
  clone.style.top = '0'
  clone.style.zIndex = '1'
  clone.style.pointerEvents = 'none'
  clone.style.overflow = 'visible'
  clone.style.visibility = 'visible'
  const imgs = [...clone.querySelectorAll('img')]
  await Promise.all(imgs.map(async (img) => {
    try {
      img.src = await imgToDataUrl(img.src)
    } catch (_) {}
  }))
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${captureWidth}px;overflow:visible;pointer-events:none;`
  host.appendChild(clone)
  document.body.appendChild(host)

  let canvas
  try {
    await document.fonts?.ready
    await Promise.all(imgs.map(waitForImage))
    canvas = await html2canvas(clone, {
      scale,
      useCORS: false,
      allowTaint: false,
      backgroundColor: '#ffffff',
      width: captureWidth,
      height: Math.ceil(clone.scrollHeight),
      windowWidth: captureWidth,
      windowHeight: Math.ceil(clone.scrollHeight),
      scrollX: 0,
      scrollY: 0,
    })
  } finally {
    host.remove()
  }
  if (!canvas.width || !canvas.height) throw new Error(`Canvas is empty (${canvas.width}x${canvas.height})`)

  const pdf = new jsPDF('p', 'mm', 'a4')
  const pdfW = pdf.internal.pageSize.getWidth()
  const pdfH = pdf.internal.pageSize.getHeight()
  const margin = 10
  const printableW = pdfW - 2 * margin
  const printableH = pdfH - 2 * margin
  const pixelsPerMm = canvas.width / printableW
  const fullRenderedHeight = canvas.height / pixelsPerMm
  const onePageOverflowTolerance = 12

  if (fullRenderedHeight <= printableH + onePageOverflowTolerance) {
    const scaleToFit = Math.min(1, printableH / fullRenderedHeight)
    const renderedW = printableW * scaleToFit
    const renderedH = fullRenderedHeight * scaleToFit
    const x = margin + (printableW - renderedW) / 2
    pdf.addImage(canvas.toDataURL('image/jpeg', jpegQuality), 'JPEG', x, margin, renderedW, renderedH)
    return pdf
  }

  const pageSliceHeight = Math.floor(printableH * pixelsPerMm)

  for (let offsetY = 0, page = 0; offsetY < canvas.height; offsetY += pageSliceHeight, page++) {
    const sliceHeight = Math.min(pageSliceHeight, canvas.height - offsetY)
    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = canvas.width
    pageCanvas.height = sliceHeight
    pageCanvas.getContext('2d').drawImage(
      canvas,
      0, offsetY, canvas.width, sliceHeight,
      0, 0, canvas.width, sliceHeight,
    )
    if (page > 0) pdf.addPage()
    const renderedHeight = sliceHeight / pixelsPerMm
    pdf.addImage(pageCanvas.toDataURL('image/jpeg', jpegQuality), 'JPEG', margin, margin, printableW, renderedHeight)
  }
  return pdf
}

function sanitizeFileName(name) {
  return String(name).replace(/[<>:"/\\|?*]/g, '_').trim() || 'Unknown'
}

function getFilePrefix(project) {
  if (!project) return ''
  const map = {
    ashray: 'Ashray', beingsevak: 'BeingSevak', manncar: 'MannCare',
    bsct: 'BeingSevak', aflf: 'Ashray', maan: 'MannCare',
  }
  return (map[project] || project) + '_'
}

function getZipName(project) {
  if (!project) return 'Donation_Receipts.zip'
  const map = {
    ashray: 'Ashray', beingsevak: 'BeingSevak', manncar: 'MannCare',
    bsct: 'BeingSevak', aflf: 'Ashray', maan: 'MannCare',
  }
  return (map[project] || project) + '_Donation_Receipts.zip'
}

export async function downloadSinglePDF(element, donor, project = '') {
  const receiptNo = donor['Receipt No.'] || 'N/A'
  const donorName = sanitizeFileName(donor['Donor Name'])
  const prefix = getFilePrefix(project)
  const pdf = await generateReceiptPDF(element)
  pdf.save(`${prefix}${donorName}_${receiptNo}.pdf`)
}

export async function downloadAllPDFs(elements, project = '') {
  const zip = new JSZip()
  const folder = zip.folder('Donation_Receipts')

  for (let i = 0; i < elements.length; i++) {
    const { element, donor } = elements[i]
    const pdf = await generateReceiptPDF(element)
    const receiptNo = donor['Receipt No.'] || `ROW${i + 1}`
    const donorName = sanitizeFileName(donor['Donor Name'])
    const prefix = getFilePrefix(project)
    folder.file(`${prefix}${donorName}_${receiptNo}.pdf`, pdf.output('arraybuffer'))
  }

  const content = await zip.generateAsync({ type: 'blob' })
  saveAs(content, getZipName(project))
}
