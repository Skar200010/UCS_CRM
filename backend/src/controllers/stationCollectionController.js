import { buildStationCollectionWorkbook } from '../services/stationCollectionWorkbook.js'

const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim())
const isMonth = (s) => /^\d{4}-\d{2}$/.test(String(s || '').trim())
const pad2 = (n) => String(n).padStart(2, '0')

// GET /api/accounts/station-collection.xlsx
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD  or ?date=YYYY-MM-DD  or ?month=YYYY-MM
//   &ngo=all|bsct|aflf|mann
//
// Mirrors the filters on the Accounts -> Reports page so the download always
// describes the same period the user is looking at.
export const downloadStationCollection = async (req, res) => {
  try {
    const q = req.query || {}
    let from
    let to

    if (isDay(q.from) && isDay(q.to)) {
      from = String(q.from).trim()
      to = String(q.to).trim()
    } else if (isDay(q.date)) {
      from = String(q.date).trim()
      to = from
    } else {
      const now = new Date()
      const fallback = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
      const month = isMonth(q.month) ? String(q.month).trim() : fallback
      const [y, m] = month.split('-').map(Number)
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
      from = `${month}-01`
      to = `${month}-${pad2(lastDay)}`
    }
    if (from > to) [from, to] = [to, from]

    const ngo = String(q.ngo || 'all').trim().toLowerCase()
    if (!['all', 'bsct', 'aflf', 'mann'].includes(ngo)) {
      return res.status(400).json({ message: 'ngo must be all, bsct, aflf or mann' })
    }
    const codes = ngo === 'all' ? ['bsct', 'aflf', 'mann'] : [ngo]

    const buffer = await buildStationCollectionWorkbook({ from, to, ngoCodes: codes })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="station-collection-${ngo}-${from}_${to}.xlsx"`,
    )
    return res.send(Buffer.from(buffer))
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}
