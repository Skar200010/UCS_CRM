import { useRef, useState } from 'react'
import { APPROVER_ROLES, REELS_INIT_CHECKS, REELS_PUBLISH_RULES, REELS_SECTIONS, REELS_VIDEO_TYPES } from './reelsData.mjs'

const todayYmd = () => new Date().toISOString().slice(0, 10)

const REELS_CSS = `
.reels-wrap { background: #fff; border: 1px solid #E3E6F2; border-radius: 16px; overflow: hidden; }
.reels-head { padding: 15px 16px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--eh-line, #E3E6F2); background: linear-gradient(180deg, #fbfaff, #fff); }
.reels-head-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.reels-title { margin: 0; font-size: 16px; font-weight: 800; color: var(--eh-ink, #1f2430); }
.reels-sub { font-size: 11.5px; color: var(--eh-ink-soft, #6f6c86); }
.reels-body { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 14px; }
.reels-block { border: 1px solid var(--eh-line, #E3E6F2); border-radius: 12px; overflow: hidden; background: #fff; }
.reels-block-head { display: flex; align-items: center; gap: 10px; padding: 10px 13px; background: var(--eh-tint-1, #f0eefb); }
.reels-block-num { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; background: var(--eh-primary, #6c5ce7); color: #fff; font-size: 11px; font-weight: 800; flex: none; }
.reels-block-name { font-size: 13.5px; font-weight: 800; color: var(--eh-ink, #1f2430); flex: 1; }
.reels-block-count { font-size: 11px; font-weight: 800; color: var(--eh-ink-soft, #6f6c86); white-space: nowrap; }
.reels-progress { height: 5px; border-radius: 999px; background: var(--eh-surface-2, #eef0f7); overflow: hidden; }
.reels-progress-fill { height: 100%; border-radius: 999px; background: var(--eh-primary, #6c5ce7); transition: width .2s; }
.reels-item { display: flex; position: relative; align-items: flex-start; gap: 10px; padding: 9px 13px; cursor: pointer; font-size: 13px; line-height: 1.35; color: var(--eh-ink, #1f2430); border-top: 1px solid #F0F0F6; user-select: none; }
.reels-item:first-child { border-top: none; }
.reels-item:hover { background: #faf9ff; }
.reels-item input[type="checkbox"] { position: absolute; top: 0; left: 0; width: 20px; height: 20px; margin: 0; opacity: 0; pointer-events: none; }
.reels-item .reels-box { width: 20px; height: 20px; border-radius: 7px; border: 2px solid #cfd2e5; background: #fff; display: inline-flex; align-items: center; justify-content: center; flex: none; margin-top: 0; color: #fff; font-size: 13px; font-weight: 900; line-height: 1; transition: background .15s, border-color .15s, box-shadow .15s; }
.reels-item input[type="checkbox"]:checked + .reels-box { background: var(--eh-success, #16a34a); border-color: var(--eh-success, #16a34a); box-shadow: 0 0 0 3px rgba(22, 163, 74, .15); }
.reels-item.done { background: #f2fdf5; box-shadow: inset 3px 0 0 var(--eh-success, #16a34a); }
.reels-item.done .reels-item-text { color: var(--eh-ink-soft, #6f6c86); }
.reels-item .reels-field span { text-transform: none; letter-spacing: 0; }
.reels-item input:not([type="checkbox"]), .reels-item textarea { position: static; width: 100%; height: auto; margin: 0; opacity: 1; pointer-events: auto; user-select: text; -webkit-user-select: text; }
.reels-block-head.done { background: #ecfdf3; }
.reels-block-head.done .reels-block-num { background: var(--eh-success, #16a34a); }
.reels-block-count.ok { color: var(--eh-success, #16a34a); }
.reels-progress-fill.done { background: var(--eh-success, #16a34a); }
.reels-sig-note { font-size: 11px; color: var(--eh-ink-faint, #a09db4); }
.reels-details { display: flex; flex-direction: column; gap: 9px; }
.reels-details .reels-field { display: grid; grid-template-columns: minmax(150px, 210px) 1fr; align-items: center; gap: 8px 14px; }
.reels-details .reels-field > span { margin: 0; }
.reels-details .reels-field input { width: 100%; min-width: 0; }
@media (max-width: 620px) { .reels-details .reels-field { grid-template-columns: 1fr; gap: 5px; } }
.reels-field { display: flex; flex-direction: column; gap: 5px; }
.reels-field span { font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--eh-ink-soft, #6f6c86); }
.reels-field input { padding: 8px 10px; font-family: inherit; font-size: 13px; color: var(--eh-ink, #1f2430); background: #fff; border: 1px solid var(--eh-line, #d1d5db); border-radius: 9px; outline: none; transition: border-color .15s, box-shadow .15s; }
.reels-field input:focus { border-color: var(--eh-primary, #2036bd); box-shadow: 0 0 0 3px rgba(32, 54, 189, .12); }
.reels-pills { display: flex; flex-wrap: wrap; gap: 8px; }
.reels-pill { padding: 6px 12px; border: 1px solid var(--eh-line, #d1d5db); border-radius: 999px; background: #fff; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--eh-ink, #1f2430); cursor: pointer; transition: all .15s; }
.reels-pill.on { background: var(--eh-primary, #6c5ce7); border-color: var(--eh-primary, #6c5ce7); color: #fff; }
.reels-approvers { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px; }
.reels-approver { border: 1px solid var(--eh-line, #E3E6F2); border-radius: 12px; padding: 12px; background: var(--eh-tint-1, #faf9ff); display: flex; flex-direction: column; gap: 8px; }
.reels-approver h4 { margin: 0; font-size: 12.5px; font-weight: 800; color: var(--eh-ink, #1f2430); }
.reels-approver .reels-field { display: grid; grid-template-columns: minmax(88px, 112px) 1fr; align-items: center; gap: 4px 10px; }
.reels-approver .reels-field input { width: 100%; min-width: 0; }
@media (max-width: 420px) { .reels-approver .reels-field { grid-template-columns: 1fr; gap: 4px; } }
.reels-sig-pad { display: flex; flex-direction: column; gap: 6px; }
.reels-sig-canvas { width: 100%; height: 110px; background: #fff; border: 1px dashed #c9c4e8; border-radius: 9px; touch-action: none; cursor: crosshair; }
.reels-sig-hint { position: relative; }
.reels-sig-hint span { position: absolute; left: 12px; top: 44px; font-size: 11px; color: #b3aecb; pointer-events: none; }
.reels-sig-actions { display: flex; align-items: center; gap: 8px; min-height: 24px; }
.reels-sig-label { align-self: flex-start; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--eh-ink-soft, #6f6c86); }
.reels-sig-line { position: absolute; left: 12px; right: 12px; bottom: 20px; border-top: 2px solid #c2c4d4; pointer-events: none; }
.reels-sig-clear { font: inherit; font-size: 11.5px; font-weight: 700; color: var(--eh-danger, #dc2626); background: transparent; border: 1px solid var(--eh-danger, #dc2626); border-radius: 7px; padding: 3px 9px; cursor: pointer; }
.reels-sig-clear:disabled { opacity: .4; cursor: default; }
.reels-sig-status { font-size: 11px; color: var(--eh-ink-faint, #a09db4); }
.reels-sig-status.ok { color: var(--eh-success, #16a34a); }
.reels-publish { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 12px; border: 1px solid transparent; font-size: 13px; line-height: 1.4; }
.reels-publish.ok { background: #ecfdf3; border-color: #a7e3c1; color: #166534; }
.reels-publish.pending { background: #fff7ed; border-color: #fbd5a7; color: #9a3412; }
.reels-publish strong { display: block; font-size: 13.5px; }
.reels-rules { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 6px; }
.reels-rules li { font-size: 12px; list-style: none; display: inline-flex; align-items: center; gap: 5px; }
`

function ReelsSig({ value, onChange }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const last = useRef(null)
  const [hasInk, setHasInk] = useState(false)

  const pos = (e) => {
    const c = canvasRef.current
    const r = c.getBoundingClientRect()
    return {
      x: ((e.clientX - r.left) / r.width) * c.width,
      y: ((e.clientY - r.top) / r.height) * c.height,
    }
  }

  const paint = (value) => {
    setHasInk(true)
    onChange(value)
  }
  const clear = () => {
    const c = canvasRef.current
    c.getContext('2d').clearRect(0, 0, c.width, c.height)
    setHasInk(false)
    onChange(null)
  }

  const start = (e) => {
    e.preventDefault()
    const c = canvasRef.current
    drawing.current = true
    if (c.width !== 640 || c.height !== 220) {
      c.width = 640
      c.height = 220
      if (hasInk) {}
    }
    last.current = pos(e)
    try { c.setPointerCapture(e.pointerId) } catch { /* ignore */ }
  }
  const move = (e) => {
    if (!drawing.current) return
    const ctx = canvasRef.current.getContext('2d')
    const p = pos(e)
    ctx.lineWidth = 2.6
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1f2937'
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
  }
  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    last.current = null
    paint(canvasRef.current.toDataURL('image/png'))
  }

  return (
    <div className="reels-sig-pad">
        <span className="reels-sig-label">Signature</span>
        <div className="reels-sig-canvas" style={{ position: 'relative', padding: 0 }}>
          <canvas
            ref={canvasRef}
            width={640}
            height={220}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
            onPointerCancel={end}
            style={{ width: '100%', height: '110px', background: 'transparent', display: 'block' }}
            aria-label="Signature drawing pad"
          />
          {!hasInk && <div className="reels-sig-line" />}
          {!hasInk && <span className="reels-sig-hint"><span>Sign here</span></span>}
        </div>
        <div className="reels-sig-actions">
          <button type="button" className="reels-sig-clear" onClick={clear} disabled={!hasInk}>Clear</button>
          <span className={`reels-sig-status${hasInk ? ' ok' : ''}`}>
            {hasInk ? 'Signature captured' : 'Draw with mouse or finger'}
          </span>
        </div>
      </div>
  )
}

export default function ReelsChecklist() {
  const [details, setDetails] = useState({ title: '', topic: '', editor: '', preparedBy: '', date: todayYmd() })
  const [types, setTypes] = useState(() => REELS_VIDEO_TYPES.reduce((acc, t) => ({ ...acc, [t]: false }), {}))
  const [checks, setChecks] = useState(() => REELS_INIT_CHECKS)
  const [approvers, setApprovers] = useState(() =>
    APPROVER_ROLES.reduce((acc, r) => ({ ...acc, [r.id]: { name: '', date: todayYmd(), sig: null } }), {})
  )
  const [downloading, setDownloading] = useState(false)

  const totalChecks = REELS_SECTIONS.reduce((n, s) => n + s.items.length, 0)
  const doneCount = REELS_SECTIONS.reduce(
    (n, s) => n + checks[s.id].filter(Boolean).length,
    0
  )
  const missingApprovers = APPROVER_ROLES.filter(
    (r) => !approvers[r.id].name.trim() || !approvers[r.id].date
  ).length
  const ready = doneCount === totalChecks && missingApprovers === 0
  const pendingCount = (totalChecks - doneCount) + missingApprovers

  const setDet = (k, v) => setDetails((cur) => ({ ...cur, [k]: v }))
  const selectType = (t) =>
    setTypes((cur) => {
      const next = {}
      for (const k of REELS_VIDEO_TYPES) next[k] = k === t ? !cur[t] : false
      return next
    })
  const toggleItem = (sec, i) =>
    setChecks((cur) => ({ ...cur, [sec]: cur[sec].map((v, k) => (k === i ? !v : v)) }))
  const setApprover = (id, patch) =>
    setApprovers((cur) => ({ ...cur, [id]: { ...cur[id], ...patch } }))

  const downloadPdf = async () => {
    setDownloading(true)
    try {
      const { buildReelsChecklistPdf } = await import('./reelsPdf.mjs')
      const pdf = buildReelsChecklistPdf({
        details,
        types,
        checks,
        approvers,
        ready,
        totalChecks,
        doneCount,
        missingApprovers,
        pendingCount,
      })
      const stamp = String(details.date || todayYmd()).split('-').join('')
      pdf.save(`Reels-Checklist-Approval-${stamp}.pdf`)
    } catch (e) {
      console.error('ReelsChecklist downloadPdf error:', e)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <section className="reels-wrap">
      <style>{REELS_CSS}</style>
      <div className="reels-head">
        <div className="reels-head-text">
          <h3 className="reels-title">Reels Checklist</h3>
          <span className="reels-sub">Program Video &amp; Reels – Pre-Upload Checklist &amp; Approval Form</span>
        </div>
        <button
          className="eh-btn eh-btn-primary"
          onClick={downloadPdf}
          disabled={downloading}
          title="Download the filled checklist, all sections and the three signatures as a PDF"
        >
          {downloading ? 'Building PDF…' : '⬇ Download PDF'}
        </button>
      </div>

      <div className="reels-body">
        <div className="reels-block">
          <div className="reels-block-head">
            <span className="reels-block-num">1</span>
            <span className="reels-block-name">Video Details</span>
          </div>
          <div className="reels-item" style={{ cursor: 'default', flexDirection: 'column', gap: 10 }}>
            <div className="reels-details">
              <label className="reels-field">
                <span>Video Title</span>
                <input value={details.title} onChange={(e) => setDet('title', e.target.value)} placeholder="Title of the video" />
              </label>
              <label className="reels-field">
                <span>Video Topic / Project</span>
                <input value={details.topic} onChange={(e) => setDet('topic', e.target.value)} placeholder="What the video is about" />
              </label>
              <label className="reels-field">
                <span>Video Editor</span>
                <input value={details.editor} onChange={(e) => setDet('editor', e.target.value)} placeholder="Editor\u2019s name" />
              </label>
              <label className="reels-field">
                <span>Prepared By</span>
                <input value={details.preparedBy} onChange={(e) => setDet('preparedBy', e.target.value)} placeholder="Who filled this in" />
              </label>
              <label className="reels-field">
                <span>Date</span>
                <input type="date" value={details.date} onChange={(e) => setDet('date', e.target.value)} />
              </label>
            </div>
            <div className="reels-field">
              <span>Video Type</span>
              <div className="reels-pills">
                {REELS_VIDEO_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`reels-pill${types[t] ? ' on' : ''}`}
                    onClick={() => selectType(t)}
                  >
                    {types[t] ? '✓ ' : ''}{t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {REELS_SECTIONS.map((s, i) => {
          const items = checks[s.id]
          const done = items.filter(Boolean).length
          const pct = s.items.length ? Math.round((done / s.items.length) * 100) : 0
          return (
            <div key={s.id} className="reels-block">
              <div className={`reels-block-head${done === s.items.length ? ' done' : ''}`}>
                <span className="reels-block-num">{i + 2}</span>
                <span className="reels-block-name">{s.label}</span>
                <span className={`reels-block-count${done === s.items.length ? ' ok' : ''}`}>{done}/{s.items.length}</span>
                <div className="reels-progress" style={{ width: 90 }}>
                  <div className={`reels-progress-fill${done === s.items.length ? ' done' : ''}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
              {s.items.map((item, j) => (
                <label key={item} className={`reels-item${items[j] ? ' done' : ''}`}>
                  <input
                    type="checkbox"
                    checked={Boolean(items[j])}
                    onChange={() => toggleItem(s.id, j)}
                  />
                  <span className="reels-box">✓</span>
                  <span className="reels-item-text">{item}</span>
                </label>
              ))}
            </div>
          )
        })}

        <div className="reels-block">
          <div className="reels-block-head">
            <span className="reels-block-num">{REELS_SECTIONS.length + 2}</span>
            <span className="reels-block-name">Final Approval</span>
          </div>
          <div className="reels-item" style={{ cursor: 'default', flexDirection: 'column', gap: 10 }}>
            <div className="reels-approvers">
              {APPROVER_ROLES.map((r) => (
                <div key={r.id} className="reels-approver">
                  <h4>{r.label}</h4>
                  <label className="reels-field">
                    <span>Name (type here)</span>
                    <input
                      value={approvers[r.id].name}
                      onChange={(e) => setApprover(r.id, { name: e.target.value })}
                      placeholder="Type the person's full name"
                    />
                  </label>
                  <label className="reels-field">
                    <span>Date</span>
                    <input
                      type="date"
                      value={approvers[r.id].date}
                      onChange={(e) => setApprover(r.id, { date: e.target.value })}
                    />
                  </label>
                  <ReelsSig
                    value={approvers[r.id].sig}
                    onChange={(v) => setApprover(r.id, { sig: v })}
                  />
                  {approvers[r.id].sig ? (
                    <div className="reels-sig-note" style={{ color: 'var(--eh-success, #16a34a)' }}>
                      ✓ Drawn signature captured for {approvers[r.id].name.trim() || 'this person'}.
                    </div>
                  ) : approvers[r.id].name.trim() ? (
                    <div className="reels-sig-note">
                      <b>{approvers[r.id].name.trim()}</b> typed — draw the signature on the line above.
                    </div>
                  ) : (
                    <div className="reels-sig-note">Type the name above, then draw your signature on the line.</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`reels-publish${ready ? ' ok' : ' pending'}`}>
          <span style={{ fontSize: 16, lineHeight: 1.1 }}>{ready ? '✓' : '🚨'}</span>
          <div>
            <strong>{ready ? 'READY TO PUBLISH' : 'PUBLISH ONLY WHEN EVERYTHING BELOW IS DONE'}</strong>
            {!ready && (
              <span> {pendingCount} item{pendingCount === 1 ? '' : 's'} still pending ({totalChecks - doneCount} check{totalChecks - doneCount === 1 ? '' : 's'} and {missingApprovers} approver{missingApprovers === 1 ? '' : 's'} to sign).</span>
            )}
            <ul className="reels-rules">
              {REELS_PUBLISH_RULES.map((rule) => (
                <li key={rule}>
                  <span style={{ color: 'var(--eh-success, #16a34a)' }}>✓</span> {rule}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      </section>
  )
}