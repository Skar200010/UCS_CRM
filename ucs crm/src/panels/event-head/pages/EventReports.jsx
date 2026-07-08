import { useState, useEffect } from 'react'
import { fetchEvents, generateEventReport } from '../store'

const REPORT_TYPES = [
  { id:'summary', label:'Event Summary' },
  { id:'beneficiary', label:'Beneficiary Report' },
  { id:'material', label:'Material Distribution Report' },
  { id:'expense', label:'Expense Report' },
  { id:'asset', label:'Asset Utilization Report' },
  { id:'volunteer', label:'Volunteer Report' },
  { id:'csr', label:'CSR Report' },
  { id:'donor', label:'Donor Report' },
  { id:'impact', label:'Impact Report' },
]

export default function EventReports() {
  const [events, setEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState('')
  const [reportType, setReportType] = useState('summary')
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchEvents().then(setEvents).catch(e => console.error('EventReports fetchEvents:', e)) }, [])

  const generate = async () => {
    if (!selectedEvent) return
    setLoading(true)
    try {
      const data = await generateEventReport(selectedEvent, reportType)
      setReportData(data)
    } catch (err) { alert('Failed to generate report') }
    finally { setLoading(false) }
  }

  const exportJSON = () => {
    const b = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(b)
    const a = document.createElement('a')
    a.href = url; a.download = `report-${reportType}-${selectedEvent}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h3 style={{ fontSize: 16 }}>Event Reports</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} style={{ padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
            <option value="">Select Event</option>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
          <select value={reportType} onChange={e => { setReportType(e.target.value); setReportData(null) }} style={{ padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
            {REPORT_TYPES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={generate} disabled={!selectedEvent || loading}>
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>

      {reportData && (
        <div className="card">
          <div className="card-head">
            <h3>{REPORT_TYPES.find(r => r.id === reportType)?.label}</h3>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-sm" onClick={() => window.print()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: 4 }}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Print
              </button>
              <button className="btn btn-sm" onClick={exportJSON}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: 4 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export JSON
              </button>
            </div>
          </div>
          <div className="card-pad">
            <pre style={{ fontSize: 13, whiteSpace: 'pre-wrap', color: 'var(--ink)', maxHeight: 500, overflow: 'auto', background: 'var(--bg)', padding: 16, borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
              {JSON.stringify(reportData, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {!reportData && !loading && <div className="card"><div className="card-pad" style={{ textAlign: 'center', padding: 40, color: 'var(--ink-soft)' }}>Select an event and report type, then click Generate</div></div>}
    </>
  )
}
