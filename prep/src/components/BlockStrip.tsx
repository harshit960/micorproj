import Link from 'next/link'
import { plan, TOTAL_WEEKS } from '@/lib/plan'

/** The 26-week training block: one bar per week, filled by completion. */
export function BlockStrip({ weekFractions, currentWeek, started }: { weekFractions: number[]; currentWeek: number; started: boolean }) {
  const doneWeeks = weekFractions.filter((f) => f >= 1).length
  return (
    <Link
      href="/plan"
      className="block"
      aria-label={`Week ${currentWeek} of ${TOTAL_WEEKS}. ${doneWeeks} weeks fully done. Open the plan.`}
    >
      <div className="block-bars" aria-hidden="true">
        {weekFractions.map((f, i) => {
          const w = i + 1
          const cls = ['block-bar', started && w === currentWeek ? 'is-now' : '', w > currentWeek || !started ? 'is-future' : ''].join(' ')
          return (
            <div key={w} className={cls}>
              <i style={{ height: `${Math.round(f * 100)}%` }} />
            </div>
          )
        })}
      </div>
      <div className="block-phases" aria-hidden="true">
        {plan.phases.map((p) => (
          <span
            key={p.id}
            style={{ gridColumn: `${p.from} / ${p.to + 1}` }}
            className={currentWeek >= p.from && currentWeek <= p.to ? 'is-now' : ''}
          >
            {p.name}
          </span>
        ))}
      </div>
    </Link>
  )
}
