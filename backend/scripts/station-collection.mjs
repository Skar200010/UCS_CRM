// Station-wise collection workbook for a period.
//
// Thin CLI around src/services/stationCollectionWorkbook.js (the same builder
// the Accounts -> Reports "Download Excel" button uses).
//
// Usage (from backend/):
//   node scripts/station-collection.mjs                         # this calendar year, all NGOs
//   node scripts/station-collection.mjs 2026                    # a specific year
//   node scripts/station-collection.mjs 2026 BSCT               # one NGO
//   node scripts/station-collection.mjs 2026 BSCT out.xlsx      # custom output
//   node scripts/station-collection.mjs 2026 BSCT 2026-01-01 2026-06-30 out.xlsx
//
// Columns: Station | Group | Name/FRO | NGO | Count (donors) | Range (₹) |
//          monthly columns | Total | Receipts

import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import db from '../src/config/db.js'
import { buildStationCollectionWorkbook } from '../src/services/stationCollectionWorkbook.js'

dotenv.config({ path: new URL('../.env', import.meta.url) })

const argv = process.argv.slice(2)
const yearArg = argv.find((a) => /^\d{4}$/.test(a))
const YEAR = Number(yearArg) || new Date().getFullYear()
const ngoArg = argv.find((a) => /^[A-Za-z]{2,6}$/.test(a))
const NGO = ngoArg ? ngoArg.toUpperCase() : null
const dates = argv.filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))
const FROM = dates[0] || `${YEAR}-01-01`
const TO = dates[1] || `${YEAR}-12-31`
const OUT = path.resolve(
  argv.find((a) => a.endsWith('.xlsx'))
  || `../UCS_Station_Collection_${NGO ? `${NGO}_` : ''}${YEAR}.xlsx`,
)

const codes = NGO ? [NGO] : ['bsct', 'aflf', 'mann']
const buffer = await buildStationCollectionWorkbook({ from: FROM, to: TO, ngoCodes: codes })
fs.writeFileSync(OUT, Buffer.from(buffer))
console.log(`Wrote ${OUT}`)
console.log(`Period ${FROM} to ${TO} | NGOs ${codes.map((c) => c.toUpperCase()).join(', ')}`)
await db._pool.end()
