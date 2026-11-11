'use client'

import { useRef, useState } from 'react'

interface Pt { date: string; total: number }

const W = 640
const H = 180
const PAD = { l: 36, r: 12, t: 16, b: 26 }

export function LcChart({ points, baseline }: { points: Pt[]; baseline: number }) {
  const ref = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  if (points.length < 2) {
    return <p className="small muted">The line fills in as daily snapshots arrive, one per day.</p>
  }
  const t0 = Date.parse(points[0].date)
  const t1 = Date.parse(points[points.length - 1].date)
  const lo = Math.min(baseline, ...points.map((p) => p.total))
  const hi = Math.max(...points.map((p) => p.total))
  const yMin = Math.floor(lo / 10) * 10
  const yMax = Math.max(yMin + 10, Math.ceil((hi + 1) / 10) * 10)
  const x = (d: string) => PAD.l + ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.total).toFixed(1)}`).join('')
  const ticks = [yMin, Math.round((yMin + yMax) / 2), yMax]
  const fmt = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })

  function onMove(e: React.PointerEvent) {
    const svg = ref.current
    if (!svg) return
    const r = svg.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    let best = 0
    for (let i = 1; i < points.length; i++) if (Math.abs(x(points[i].date) - px) < Math.abs(x(points[best].date) - px)) best = i
    setHover(best)
  }

  const hp = hover !== null ? points[hover] : null
  return (
    <div className="chart">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`LeetCode problems solved, from ${points[0].total} on ${fmt(points[0].date)} to ${points[points.length - 1].total} on ${fmt(points[points.length - 1].date)}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        style={{ touchAction: 'pan-y' }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--muted)">
              {t}
            </text>
          </g>
        ))}
        {baseline >= yMin && (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(baseline)} y2={y(baseline)} stroke="var(--muted)" strokeDasharray="4 4" strokeWidth="1" />
            <text x={W - PAD.r} y={y(baseline) - 6} textAnchor="end" fontSize="12" fill="var(--muted)">
              Start: {baseline}
            </text>
          </g>
        )}
        <path d={path} fill="none" stroke="var(--t-dsa)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <text x={PAD.l} y={H - 6} fontSize="12" fill="var(--muted)">
          {fmt(points[0].date)}
        </text>
        <text x={W - PAD.r} y={H - 6} fontSize="12" fill="var(--muted)" textAnchor="end">
          {fmt(points[points.length - 1].date)}
        </text>
        {hp && (
          <g>
            <line x1={x(hp.date)} x2={x(hp.date)} y1={PAD.t} y2={H - PAD.b} stroke="var(--line-2)" />
            <circle cx={x(hp.date)} cy={y(hp.total)} r="5" fill="var(--t-dsa)" stroke="var(--paper)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hp && (
        <div className="chart-tip tnum" style={{ left: `${(x(hp.date) / W) * 100}%` }}>
          {fmt(hp.date)}: {hp.total} solved
        </div>
      )}
    </div>
  )
}
