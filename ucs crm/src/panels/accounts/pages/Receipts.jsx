import { useState, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import { apiGet, apiPost } from '../api/auth'
import { formatIndianCurrency, formatReceiptDate, generateReceiptPDF, downloadSinglePDF, downloadAllPDFs } from '../services/pdfGenerator'
import ReceiptTemplateManncar from '../components/ReceiptTemplateManncar'
import ReceiptTemplateAshray from '../components/ReceiptTemplateAshray'
import ReceiptTemplateBeingSevak from '../components/ReceiptTemplateBeingSevak'
import BulkProgressModal from '../components/BulkProgressModal'
import ConfirmBulkModal from '../components/ConfirmBulkModal'
import Toast from '../components/Toast'

const NGO_MAP = {
  bsct: { label: 'Being Sevak', comp: ReceiptTemplateBeingSevak, metaTemplate: 'bsct_receipt', metaLang: 'en_US' },
  maan: { label: 'Mann Care', comp: ReceiptTemplateManncar, metaTemplate: 'mann_receipt', metaLang: 'en' },
  aflf: { label: 'Ashray', comp: ReceiptTemplateAshray, metaTemplate: 'aflf_receipt', metaLang: 'en' },
}

function getNgoSettings(project) {
  const saved = localStorage.getItem('receipt_template_settings')
  const defaults = NGO_MAP[project] || NGO_MAP.bsct
  if (!saved) return defaults
  try {
    const overrides = JSON.parse(saved)
    const o = overrides[project]
    if (!o) return defaults
    return {
      label: defaults.label,
      comp: NGO_MAP[o.receiptDesign]?.comp || defaults.comp,
      metaTemplate: o.metaTemplate || defaults.metaTemplate,
      metaLang: o.metaLang || defaults.metaLang,
    }
  } catch { return defaults }
}

const TARGET_COLUMNS = [
  { key: 'Donor Name', aliases: ['Donor Name'] },
  { key: 'Address 1', aliases: ['Address 1', 'Address1'] },
  { key: 'PAN No.', aliases: ['PAN No.', 'PAN No', 'Pan No', 'Pan No.'] },
  { key: 'Email ID', aliases: ['Email ID', 'Email Id', 'Mail Id', 'Mail ID'] },
  { key: 'Mode of Payment (MOP)', aliases: ['Mode of Payment (MOP)', 'MOP', 'Payment Mode', 'Mode of Payment'] },
  { key: 'Payment ID No.', aliases: ['Payment ID No.', 'Payment Id No', 'Payment Id No.', 'Payment ID No'] },
  { key: 'Donor Bank Name', aliases: ['Donor Bank Name', 'Donor bank Name', 'Bank Name'] },
  { key: 'Amount', aliases: ['Amount'] },
  { key: 'Receipt No.', aliases: ['Receipt No.', 'Receipt No', 'Reciept No', 'Reciept No.'] },
  { key: 'Receipt Date', aliases: ['Receipt Date', 'Reciept Date', 'Donation Date'] },
  { key: 'Account Of', aliases: ['Account Of', 'Account of'] },
  { key: 'Mobile No.', aliases: ['Mobile No.', 'Mobile', 'Phone', 'Phone No.', 'Contact No.', 'Cell'] },
  { key: 'Project', aliases: ['Project', 'NGO', 'project_supported'] },
]

const MANDATORY = ['Donor Name', 'Amount', 'Receipt No.']
const PAGE_SIZE = 20

function normalize(str) {
  return str.toLowerCase().replace(/[\s.,()\-_]+/g, '')
}

function findColumn(target, headers) {
  const normTarget = normalize(target)
  for (const h of headers) { if (normalize(h) === normTarget) return h }
  for (const h of headers) { const nh = normalize(h); if (nh.includes(normTarget) || normTarget.includes(nh)) return h }
  return null
}

function matchColumns(headers) {
  const map = {}
  for (const col of TARGET_COLUMNS) {
    let m = headers.find(h => h === col.key)
    if (m) { map[col.key] = m; continue }
    for (const a of col.aliases) {
      m = headers.find(h => h === a) || headers.find(h => normalize(h) === normalize(a))
      if (m) break
    }
    if (!m) m = findColumn(col.key, headers)
    if (m) map[col.key] = m
  }
  return map
}

function isEmptyRow(row) {
  return TARGET_COLUMNS.every(col => !row[col.key] || String(row[col.key]).trim() === '')
}

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana',
  'Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur',
  'Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu',
  'Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands',
  'Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh',
  'Lakshadweep','Puducherry',
]

function parseAddressParts(raw) {
  if (!raw) return { address:'', city:'', state:'', pincode:'' }
  let addr = raw.trim()
  let pin = ''
  const pinMatch = addr.match(/(\d{6})\s*$/)
  if (pinMatch) { pin = pinMatch[1]; addr = addr.slice(0, pinMatch.index).trim().replace(/[,]+$/, '').trim() }
  const parts = addr.split(',').map(p => p.trim()).filter(Boolean)
  let foundState = '', foundCity = ''
  const stateLowerMap = {}
  INDIAN_STATES.forEach(s => { stateLowerMap[s.toLowerCase()] = s })
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i].toLowerCase()
    if (stateLowerMap[part]) { foundState = stateLowerMap[part]; foundCity = parts[i - 1] || ''; break }
    for (const [ls, os] of Object.entries(stateLowerMap)) {
      if (part.startsWith(ls)) { foundState = os; foundCity = parts[i].slice(ls.length).trim().replace(/^[, ]+/, '') || parts[i - 1] || ''; break }
    }
    if (foundState) break
  }
  let cleanParts = [...parts].filter(p => p !== foundCity && p.toLowerCase() !== foundState.toLowerCase() && !p.includes(pin))
  return { address: cleanParts.join(', ') || raw, city: foundCity || '', state: foundState || '', pincode: pin || '' }
}

function ExcelUpload({ onDataLoaded }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const processFile = useCallback((file) => {
    setError(null); setLoading(true)
    const name = file.name.toLowerCase()
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      setError('Please upload a valid file (.xlsx, .xls, or .csv)'); setLoading(false); return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' })
        if (!jsonData || jsonData.length === 0) { setError('File is empty'); setLoading(false); return }
        const headers = Object.keys(jsonData[0])
        const columnMap = matchColumns(headers)
        const missing = TARGET_COLUMNS.filter(col => !columnMap[col.key]).map(col => col.key)
        if (missing.length > 0) { setError(`Required columns not found: ${missing.join(', ')}`); setLoading(false); return }
        const seen = new Set()
        const donors = jsonData.filter(r => !isEmptyRow(r)).map(row => {
          const entry = {}
          for (const col of TARGET_COLUMNS) entry[col.key] = String(row[columnMap[col.key]] ?? '').trim()
          const parsed = parseAddressParts(entry['Address 1'])
          const rawCity = String(row['City'] ?? row['city'] ?? '').trim()
          const rawState = String(row['State'] ?? row['state'] ?? '').trim()
          const rawPin = String(row['Pincode'] ?? row['pincode'] ?? row['Pin Code'] ?? '').trim()
          entry['City'] = parsed.city || rawCity || ''
          entry['State'] = parsed.state || rawState || ''
          entry['Pincode'] = parsed.pincode || rawPin || ''
          if (parsed.address && (parsed.city || parsed.state || parsed.pincode)) entry['Address 1'] = parsed.address
          if (MANDATORY.some(m => !entry[m])) entry._dataMissing = true
          const rn = entry['Receipt No.']
          entry._duplicate = rn ? seen.has(rn) : false
          if (rn && !entry._duplicate) seen.add(rn)
          if (!entry['Project']) entry['Project'] = 'bsct'
          return entry
        })
        if (donors.length === 0) { setError('No valid rows found'); setLoading(false); return }
        onDataLoaded(donors)
      } catch { setError('Failed to parse file') }
      setLoading(false)
    }
    reader.onerror = () => { setError('Failed to read file'); setLoading(false) }
    reader.readAsArrayBuffer(file)
  }, [onDataLoaded])

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-pad">
        <div
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) processFile(f) }}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? '#5B6B4E' : '#d1d5db'}`,
            borderRadius: 12, padding: '40px 20px', textAlign: 'center',
            cursor: 'pointer', background: dragOver ? '#f0fdf4' : '#f9fafb',
            transition: 'all .2s',
          }}
        >
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={e => { const f = e.target.files[0]; if (f) processFile(f); e.target.value = '' }} style={{ display:'none' }} />
          {loading ? (
            <div>
              <div style={{ width:32,height:32,border:'3px solid #e5e7eb',borderTopColor:'#5B6B4E',borderRadius:'50%',animation:'spin .6s linear infinite',margin:'0 auto 12px' }} />
              <p style={{ fontSize:14, color:'#6b7280' }}>Parsing file...</p>
            </div>
          ) : (
            <>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#5B6B4E" strokeWidth="1.5" style={{ marginBottom:12, opacity:.6 }}>
                <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p style={{ fontSize:14, fontWeight:600, color:'#374151', marginBottom:4 }}>Drag & drop your Excel/CSV file here</p>
              <p style={{ fontSize:12, color:'#9ca3af' }}>or click to browse &nbsp;·&nbsp; .xlsx .xls .csv</p>
            </>
          )}
        </div>
        {error && <p style={{ fontSize:13, color:'#dc2626', marginTop:8, padding:'8px 12px', background:'#fef2f2', borderRadius:8 }}>{error}</p>}
      </div>
    </div>
  )
}

export default function Receipts() {
  const [donors, setDonors] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [downloadSingle, setDownloadSingle] = useState(false)
  const [downloadAll, setDownloadAll] = useState(false)
  const receiptRef = useRef(null)

  const [toast, setToast] = useState({ message:'', type:'', visible:false })
  const showToast = useCallback((type, msg) => setToast({ type, message:msg, visible:true }), [])
  const hideToast = useCallback(() => setToast(prev => ({ ...prev, visible:false })), [])

  const [bulkState, setBulkState] = useState({ active:false, total:0, sent:0, failed:0, currentBatch:0, totalBatches:0, results:[], previousBatches:[] })
  const cancelBulkRef = useRef(false)
  const [confirmBulk, setConfirmBulk] = useState({ visible:false, donorCount:0 })
  const [loadingDb, setLoadingDb] = useState(false)

  const handleDataLoaded = useCallback((data) => { setDonors(data); setSelectedIndex(null) }, [])

  const loadFromDatabase = useCallback(async () => {
    setLoadingDb(true)
    try {
      const data = await apiGet('/accounts/receipts/pending')
      setDonors(data)
      setSelectedIndex(null)
      showToast('success', `Loaded ${data.length} unsent receipts`)
    } catch (e) {
      showToast('error', 'Failed to load: ' + e.message)
    }
    setLoadingDb(false)
  }, [showToast])

  const getValidDonors = useCallback(() => {
    return donors ? donors.filter(d => { const m = String(d['Mobile No.'] || '').replace(/[^0-9]/g, ''); return m.length >= 10 }) : []
  }, [donors])

  const handleDownloadSingle = async () => {
    if (selectedIndex == null) return
    setDownloadSingle(true)
    try {
      const donor = donors[selectedIndex]
      await downloadSinglePDF(receiptRef.current, donor, donor['Project'] || 'bsct')
    } catch (e) { alert('Failed to download PDF: ' + e.message) }
    setDownloadSingle(false)
  }

  const handleDownloadAll = async () => {
    setDownloadAll(true)
    try {
      const elements = Array.from(document.querySelectorAll('[data-receipt-batch]'))
      await downloadAllPDFs(elements.map((el, i) => ({ element: el, donor: donors[i] })), 'all')
    } catch (e) { alert('Failed to download ZIP: ' + e.message) }
    setDownloadAll(false)
  }

  const handlePrint = () => {
    const pw = window.open('', '_blank')
    if (!pw) { alert('Please allow pop-ups to print'); return }
    pw.document.write(`<html><head><title>Donation Receipt</title><style>body{font-family:Arial,sans-serif;padding:20px}@media print{body{padding:0}}</style></head><body>${receiptRef.current.innerHTML}</body></html>`)
    pw.document.close(); pw.focus()
    setTimeout(() => pw.print(), 500)
  }

  const [sendingIndex, setSendingIndex] = useState(null)

  const handleSendSingle = async (donor, index) => {
    setSendingIndex(index)
    try {
      const receiptNo = donor['Receipt No.'] || 'N/A'
      const phone = String(donor['Mobile No.'] || '').replace(/[^0-9]/g, '')
      if (phone.length < 10) throw new Error('Invalid phone')
      const ngo = donor['Project'] || 'bsct'
      const tpl = getNgoSettings(ngo)

      let pdfBase64 = null
      const el = document.querySelector(`[data-receipt-batch="${index}"]`)
      if (el) {
        const pdf = await generateReceiptPDF(el)
        pdfBase64 = pdf.output('datauristring').split(',')[1]
      }

      await apiPost('/whatsapp/send-direct', {
        to: phone, pdfBase64, receiptNo,
        donorName: donor['Donor Name'],
        amount: donor['Amount'],
        templateName: tpl.metaTemplate,
        templateLang: tpl.metaLang,
      })
      try { await apiPost('/accounts/receipts/mark-sent', { receiptNo }) } catch {}
      showToast('success', `Sent to ${donor['Donor Name']}`)
    } catch (e) {
      showToast('error', e.message)
    }
    setSendingIndex(null)
  }

  const handleSendAllWhatsApp = () => {
    const valid = getValidDonors()
    if (valid.length === 0) { showToast('error', 'No donors with valid mobile numbers'); return }
    setConfirmBulk({ visible:true, donorCount:valid.length })
  }

  const handleConfirmBulkSend = async () => {
    setConfirmBulk({ visible:false, donorCount:0 })
    const validDonors = getValidDonors()
    if (validDonors.length === 0) return
    const batches = []
    for (let i = 0; i < validDonors.length; i += 10) batches.push(validDonors.slice(i, i + 10))
    cancelBulkRef.current = false
    setBulkState({ active:true, total:validDonors.length, sent:0, failed:0, currentBatch:0, totalBatches:batches.length, results:[], previousBatches:[] })

    let totalSent = 0, totalFailed = 0
    const allErrors = []
    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      if (cancelBulkRef.current) break
      const batch = batches[batchIdx]
      setBulkState(prev => ({ ...prev, currentBatch: batchIdx + 1, results: batch.map(d => ({ name: d['Donor Name'], status:'sending' })) }))

      const batchResults = await Promise.allSettled(batch.map(async (donor) => {
        const receiptNo = donor['Receipt No.'] || 'N/A'
        const phone = String(donor['Mobile No.'] || '').replace(/[^0-9]/g, '')
        if (phone.length < 10) throw new Error('Invalid phone')
        const ngo = donor['Project'] || 'bsct'
        const tpl = getNgoSettings(ngo)

        let pdfBase64 = null
        const realIndex = donors.indexOf(donor)
        const el = document.querySelector(`[data-receipt-batch="${realIndex}"]`)
        if (el) {
          const pdf = await generateReceiptPDF(el)
          pdfBase64 = pdf.output('datauristring').split(',')[1]
        }

        try {
          await apiPost('/whatsapp/send-direct', {
            to: phone, pdfBase64, receiptNo,
            donorName: donor['Donor Name'],
            amount: donor['Amount'],
            templateName: tpl.metaTemplate,
            templateLang: tpl.metaLang,
          })
          try { await apiPost('/accounts/receipts/mark-sent', { receiptNo }) } catch {}
        } catch (e) {
          console.error('WhatsApp send failed for', donor['Donor Name'], ':', e.message)
          allErrors.push(donor['Donor Name'] + ': ' + e.message)
          throw e
        }
      }))

      const batchSent = batchResults.filter(r => r.status === 'fulfilled').length
      const batchFailed = batchResults.filter(r => r.status === 'rejected').length
      totalSent += batchSent; totalFailed += batchFailed
      setBulkState(prev => ({
        ...prev, sent: totalSent, failed: totalFailed,
        results: batchResults.map((r, i) => ({ name: batch[i]['Donor Name'], status: r.status === 'fulfilled' ? 'sent' : 'failed', error: r.status === 'rejected' ? r.reason?.message : null })),
        previousBatches: [...prev.previousBatches, { batch: batchIdx + 1, sent: batchSent, failed: batchFailed }],
      }))
    }
    setBulkState(prev => ({ ...prev, active:false }))
    if (totalFailed > 0 && totalSent === 0 && allErrors.length > 0) {
      alert('All sends failed!\n\nFirst error:\n' + allErrors[0])
    }
    showToast(cancelBulkRef.current ? 'info' : 'success', cancelBulkRef.current ? `Cancelled. ${totalSent} sent, ${totalFailed} failed` : `Bulk send complete! ${totalSent} sent, ${totalFailed} failed`)
  }

  const currentDonor = selectedIndex != null ? donors?.[selectedIndex] : donors?.[0]
  const currentNgo = currentDonor?.['Project'] || 'bsct'
  const currentTpl = getNgoSettings(currentNgo)
  const TemplateComp = currentTpl.comp

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-pad" style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <button className="btn btn-sm" style={{ background:'#1d6f42', color:'#fff', border:'none', display:'inline-flex', alignItems:'center', gap:4 }}
            onClick={loadFromDatabase} disabled={loadingDb}>
            {loadingDb ? <span style={{width:14,height:14,border:'2px solid #fff',borderTopColor:'transparent',borderRadius:'50%',animation:'spin .6s linear infinite',display:'inline-block'}} /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7v10c0 2 1.5 4 4 4h8c2.5 0 4-2 4-4V7"/><path d="M4 7c0-2 1.5-4 4-4h8c2.5 0 4 2 4 4"/><line x1="9" y1="12" x2="15" y2="12"/></svg>}
            {loadingDb ? 'Loading...' : 'Load from Database'}
          </button>
        </div>
      </div>

      <ExcelUpload onDataLoaded={handleDataLoaded} />

      {donors && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-pad">
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8 }}>
                <h3 style={{ margin:0, fontSize:15, fontWeight:600 }}>Donor Records <span style={{ fontSize:12, fontWeight:400, color:'#9ca3af' }}>({donors.length})</span></h3>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn btn-sm" style={{ background:'#5B6B4E', color:'#fff', border:'none', display:'inline-flex', alignItems:'center', gap:4 }}
                    onClick={() => {
                      const wb = XLSX.utils.book_new();
                      const ws = XLSX.utils.json_to_sheet(donors.map(d => {
                        const copy = { ...d };
                        delete copy._dataMissing; delete copy._duplicate; delete copy.receipt_id; delete copy.sent; delete copy.log_id;
                        return copy;
                      }));
                      XLSX.utils.book_append_sheet(wb, ws, 'Receipts');
                      XLSX.writeFile(wb, `receipts_${new Date().toISOString().slice(0, 10)}.xlsx`);
                    }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download Excel
                  </button>
                  <button className="btn btn-sm" style={{ background:'#059669', color:'#fff', border:'none' }}
                    onClick={handleSendAllWhatsApp}
                    disabled={bulkState.active || getValidDonors().length === 0}>
                    Send All ({getValidDonors().length})
                  </button>
                </div>
              </div>
              <table className="table-wrap" style={{ width:'100%', fontSize:13 }}>
                <thead>
                  <tr>
                    <th>#</th><th>Donor Name</th><th>Amount</th><th>Receipt No.</th><th>Date</th><th>Mobile</th><th>NGO</th><th>Sent</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {donors.map((d, i) => (
                    <tr key={i} style={{ background: selectedIndex === i ? '#f0fdf4' : undefined, cursor:'pointer' }}
                      onClick={() => setSelectedIndex(i)}>
                      <td>{i + 1}</td>
                      <td style={{ fontWeight:500 }}>{d['Donor Name']}</td>
                      <td style={{ color:'#059669', fontWeight:600 }}>{formatIndianCurrency(d['Amount'])}</td>
                      <td style={{ fontFamily:'monospace', fontSize:12 }}>{d['Receipt No.']}</td>
                      <td style={{ fontSize:12 }}>{formatReceiptDate(d['Receipt Date'])}</td>
                      <td style={{ fontSize:12 }}>{d['Mobile No.'] || '\u2014'}</td>
                      <td style={{ fontSize:12 }}><span className="pill pill-gray">{({ bsct:'Being Sevak', maan:'Mann Care', aflf:'Ashray' })[d['Project']] || d['Project'] || 'bsct'}</span></td>
                      <td style={{ textAlign:'center' }}>
                        {d.sent ? <span style={{ color:'#059669' }}>{'\u2713'}</span> : <span style={{ color:'#9ca3af' }}>{'\u2014'}</span>}
                      </td>
                      <td style={{ display:'flex', gap:4 }}>
                        <button className="btn btn-sm" style={{ fontSize:11, padding:'4px 10px', background:'#25D366', color:'#fff', border:'none' }}
                          onClick={e => { e.stopPropagation(); handleSendSingle(d, i) }}
                          disabled={sendingIndex === i}>
                          {sendingIndex === i ? '...' : 'Send'}
                        </button>
                        <button className="btn btn-sm" style={{ fontSize:11, padding:'4px 10px' }} onClick={e => { e.stopPropagation(); setSelectedIndex(i) }}>Preview</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Receipt Preview — {getNgoSettings(currentNgo).label}</h3>
              <div style={{ display:'flex', gap:8 }}>
                {donors.length > 1 && (
                  <button className="btn btn-sm" onClick={handleDownloadAll} disabled={downloadAll}>
                    {downloadAll ? 'Packaging...' : 'Download All as ZIP'}
                  </button>
                )}
                <button className="btn btn-primary btn-sm" onClick={handleDownloadSingle} disabled={downloadSingle || selectedIndex == null}>
                  {downloadSingle ? 'Generating...' : 'Download PDF'}
                </button>
                <button className="btn btn-sm" onClick={handlePrint}>Print</button>
              </div>
            </div>
            <div className="card-pad" style={{ overflowX:'auto', textAlign:'center' }}>
              <div ref={receiptRef} data-receipt style={{ display:'inline-block' }}>
                {currentDonor && <TemplateComp donor={currentDonor} project={currentNgo} />}
              </div>
            </div>
            <div style={{ position:'fixed', left:'-9999px', top:0, width:'1000px', opacity:0, pointerEvents:'none', zIndex:-1 }}>
              {donors.map((d, i) => {
                const ngo = d['Project'] || 'bsct'
                const tpl = getNgoSettings(ngo)
                const Comp = tpl.comp
                return <div key={i} data-receipt-batch={i}><Comp donor={d} project={ngo} /></div>
              })}
            </div>
            {donors.length > 1 && (
              <div className="card-pad" style={{ paddingTop:0, fontSize:12, color:'#9ca3af', textAlign:'center' }}>
                {selectedIndex != null ? `Showing ${currentTpl.label} receipt for: ${currentDonor?.['Donor Name']}` : 'Select a donor from the table to preview their receipt.'}
              </div>
            )}
          </div>
        </>
      )}

      <ConfirmBulkModal visible={confirmBulk.visible} donorCount={confirmBulk.donorCount} projectName="" onConfirm={handleConfirmBulkSend} onCancel={() => setConfirmBulk({ visible:false, donorCount:0 })} />
      <BulkProgressModal visible={bulkState.active} total={bulkState.total} sent={bulkState.sent} failed={bulkState.failed} currentBatch={bulkState.currentBatch} totalBatches={bulkState.totalBatches} results={bulkState.results} previousBatches={bulkState.previousBatches} onCancel={() => { cancelBulkRef.current = true; setBulkState(prev => ({ ...prev, cancelled:true })) }} />
      <Toast message={toast.message} type={toast.type} visible={toast.visible} onClose={hideToast} />
    </div>
  )
}
