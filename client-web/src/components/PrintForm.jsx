import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

export default function PrintForm() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.printProfile().then(d => setData(d)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-4"><SkeletonBlock count={8} /></div>

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate(-1)} className="text-sm text-[var(--ink-soft)]">&larr; Back</button>
        <button onClick={() => window.print()} className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold">Print</button>
      </div>
      <div id="print-area" className="bg-white rounded-2xl p-6 shadow-sm border border-[var(--border)] text-sm space-y-4">
        <div className="text-center border-b pb-4">
          <h2 className="text-xl font-bold">Employee Profile</h2>
          <p className="text-[var(--ink-soft)]">{data?.name || '—'}</p>
        </div>
        {data && Object.entries(data).filter(([k]) => k !== 'id').map(([key, val]) => (
          <div key={key} className="flex justify-between py-1 border-b border-dashed border-[var(--border)] last:border-0">
            <span className="text-[var(--ink-soft)] capitalize">{key.replace(/_/g, ' ')}</span>
            <span className="font-medium">{typeof val === 'object' ? JSON.stringify(val) : String(val || '—')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SkeletonBlock({ count = 4 }) {
  return <div className="space-y-3">{[...Array(count)].map((_, i) => <div key={i} className="h-6 rounded bg-gray-100 animate-pulse" />)}</div>
}
