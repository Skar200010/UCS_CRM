import { useEffect, useRef } from 'react'
import Template1 from './Template1'
import Template2 from './Template2'
import Template3 from './Template3'
import Template4 from './Template4'
import Template5 from './Template5'


export default function PrintForms({ data, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) { alert('Please allow pop-ups to print forms'); return }
    const content = ref.current.innerHTML
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head><title>Employee Forms - Being Sevak Charitable Trust</title>
      <style>
        @page { size: A4; margin: 0; }
        body { margin: 0; padding: 0; background: #fff; }
        .print-page { page-break-after: always; }
        .t3 { height: 297mm !important; }
        .t5 { overflow: visible !important; height: auto !important; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
      </head>
      <body>${content}</body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => { printWindow.print() }, 500)
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: '#fff', zIndex: 9999, overflow: 'auto',
      padding: '20px 0',
    }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 100, background: '#fff',
        borderBottom: '2px solid #333', padding: '12px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Print Preview — All Forms</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={handlePrint}
            style={{ padding: '10px 24px', fontSize: 14, fontWeight: 700 }}>
            🖨️ Print All Forms
          </button>
          <button className="btn" onClick={onClose}
            style={{ padding: '10px 24px', fontSize: 14 }}>
            Close
          </button>
        </div>
      </div>
      <div ref={ref}>
        <Template1 personal={data.personal} education={data.education} />
        <Template2
          organizations={data.organizations}
          family={data.family}
          references={data.references}
          declarationDate={data.declarationDate}
          place={data.place}
        />
        <Template3 personal={data.personal} declarationDate={data.declarationDate} place={data.place} />
        <Template4 personal={data.personal} />
        <Template5 personal={data.personal} />

      </div>
    </div>
  )
}
