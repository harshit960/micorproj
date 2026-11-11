'use client'

import Link from 'next/link'
import { useState } from 'react'

export interface Cell { n: number; label: string; level: number; done: number; req: number; today: boolean }

const ROWS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun']

export function Heatmap({ cells }: { cells: Cell[] }) {
  const [active, setActive] = useState<Cell | null>(null)
  return (
    <>
      <div className="heat" role="grid" aria-label="Plan completion by day, one column per week">
        {ROWS.map((r, i) => (
          <span key={i} className="heat-label" aria-hidden="true">
            {r}
          </span>
        ))}
        {cells.map((c) => (
          <button
            key={c.n}
            type="button"
            className={`heat-cell${c.today ? ' is-today' : ''}${active?.n === c.n ? ' is-active' : ''}`}
            data-l={c.level}
            aria-label={`Day ${c.n}, ${c.label}: ${c.done} of ${c.req} tasks`}
            onMouseEnter={() => setActive(c)}
            onFocus={() => setActive(c)}
            onClick={() => setActive(c)}
          />
        ))}
      </div>
      <div className="legend" aria-hidden="true">
        <span>None</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className="dot" data-l={l} />
        ))}
        <span>All done</span>
      </div>
      <p className="readout tnum" role="status">
        {active ? (
          <>
            Day {active.n}, {active.label}: {active.done} of {active.req} tasks.{' '}
            <Link href={`/day/${active.n}`} style={{ color: 'var(--accent)' }}>
              Open day {active.n}
            </Link>
          </>
        ) : (
          <span className="muted">Tap a square to see that day.</span>
        )}
      </p>
    </>
  )
}
