import { useMemo, useRef, useState } from 'react'

const hashSeed = (s) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const mulberry32 = (a) => {
  return function () {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const squaresFor = (seed) => {
  const rnd = mulberry32(hashSeed(String(seed || '')) + 1)
  const out = []
  const rows = []
  for (let y = 6; y <= 90; y += 6) rows.push(y)
  let k = 0
  for (let c = 0; c < 7; c++) {
    const x = c * 6 + (rnd() * 2.5 - 1.25)
    for (let r = 0; r < rows.length; r++) {
      if (rnd() < 0.32) continue
      out.push({
        k: k++,
        x: x + (rnd() * 2 - 1),
        y: rows[r] + (rnd() * 3 - 1.5),
        size: 3 + (rnd() < 0.3 ? 1 : 0),
      })
    }
  }
  return out
}

export default function LeadWave({ animate = false, bg, square, seed = '', cls = 'ec', onDone }) {
  const [waving, setWaving] = useState(
    () => !!animate && !(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  )
  const doneRef = useRef(false)
  const squares = useMemo(() => squaresFor(seed), [seed])
  if (!bg) return null
  const waveCls = cls + '-wave'
  const sqCls = cls + '-wave-sq'
  const handleEnd = () => {
    if (doneRef.current) return
    doneRef.current = true
    setWaving(false)
    if (onDone) onDone()
  }
  return (
    <>
      <div className={cls + '-wave-bg' + (waving ? ' is-waving' : '')} style={{ background: bg }} aria-hidden="true" />
      {waving && (
        <div className={waveCls} aria-hidden="true" onAnimationEnd={handleEnd}>
          {squares.map(s => (
            <span key={s.k} className={sqCls} style={{ left: s.x, top: s.y + '%', width: s.size, height: s.size, background: square }} />
          ))}
        </div>
      )}
    </>
  )
}