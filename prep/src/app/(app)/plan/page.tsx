import Link from 'next/link'
import type { Metadata } from 'next'
import { plan, WEEKS, WEEKDAYS, getDay, TRACKS, DAYS, type Track } from '@/lib/plan'
import { getSettings, clock, getAllDays, computeStats, dateForDay } from '@/lib/store'
import { fmtDate } from '@/lib/time'
import { TopicList, type TopicItem } from '@/components/TopicList'

export const metadata: Metadata = { title: 'Plan' }

const level = (f: number) => (f <= 0 ? 0 : f < 0.34 ? 1 : f < 0.67 ? 2 : f < 1 ? 3 : 4)

const TOPICS = TRACKS.filter((t) => t.id !== 'review')

export default async function PlanPage(props: PageProps<'/plan'>) {
  const sp = await props.searchParams
  const topic = TOPICS.find((t) => t.id === sp.topic)
  const s = await getSettings()
  const c = clock(s)
  const days = await getAllDays()
  const stats = computeStats(days, c.todayN, c.started)
  const currentWeek = getDay(c.todayN)!.week

  const chips = (
    <nav className="chips" aria-label="Study by topic">
      <Link className="chip" href="/plan" aria-current={!topic}>
        By week
      </Link>
      {TOPICS.map((t) => (
        <Link key={t.id} className="chip" href={`/plan?topic=${t.id}`} aria-current={topic?.id === t.id}>
          {t.short}
        </Link>
      ))}
    </nav>
  )

  if (topic) {
    const items: TopicItem[] = DAYS.flatMap((d) => {
      const set = new Set(days.get(d.n)?.done ?? [])
      return d.tasks
        .filter((t) => t.track === (topic.id as Track) && !t.optional)
        .map((t) => ({
          task: t,
          day: d.n,
          week: d.week,
          weekTheme: WEEKS[d.week - 1].theme,
          dateLabel: fmtDate(dateForDay(s.startDate, d.n), { day: 'numeric', month: 'short' }),
          done: set.has(t.id),
        }))
    })
    return (
      <>
        <h1 className="display">Plan</h1>
        <p className="lede">
          {topic.name}, in plan order. Pick whatever fits your mood today; ticking it here counts on its day too.
        </p>
        {chips}
        <TopicList key={topic.id} items={items} trackName={topic.short} />
      </>
    )
  }

  return (
    <>
      <h1 className="display">Plan</h1>
      <p className="lede">
        26 weeks from {fmtDate(s.startDate, { day: 'numeric', month: 'long', year: 'numeric' })}. Weekdays take about two
        hours, weekends are for deep dives and the Sunday contest. Or study by topic:
      </p>
      {chips}

      {plan.phases.map((p) => (
        <section key={p.id} className="phase">
          <div className="phase-head">
            <h2 className="display">{p.name}</h2>
            <span className="small muted tnum">
              Weeks {p.from}–{p.to}
            </span>
            <p className="muted" style={{ margin: 0 }}>
              {p.summary}
            </p>
          </div>
          <ul className="weeks">
            {WEEKS.filter((w) => w.n >= p.from && w.n <= p.to).map((w) => {
              const isNow = w.n === currentWeek
              return (
                <li key={w.n}>
                  <details className={`week${isNow ? ' is-now' : ''}`} open={isNow}>
                    <summary>
                      <span className="week-n tnum">{w.n}</span>
                      <span className="week-theme">{w.theme}</span>
                      <span className="week-dots" aria-label={`${Math.round(stats.weekFractions[w.n - 1] * 100)}% done`}>
                        {w.days.map((d) => (
                          <span
                            key={d.n}
                            className={`dot${d.n === c.todayN && c.started ? ' is-today' : ''}`}
                            data-l={level(stats.dayFractions[d.n - 1])}
                          />
                        ))}
                      </span>
                    </summary>
                    <ul className="days">
                      {w.days.map((d) => {
                        const f = stats.dayFractions[d.n - 1]
                        const req = d.tasks.filter((t) => !t.optional).length
                        return (
                          <li key={d.n} className={d.n === c.todayN && c.started ? 'is-today' : ''}>
                            <Link href={`/day/${d.n}`}>
                              <span className="day-when">
                                {WEEKDAYS[d.dow]} {fmtDate(dateForDay(s.startDate, d.n), { day: 'numeric', month: 'short' })}
                              </span>
                              <span className="day-title">{d.title}</span>
                              <span className="muted tnum small">
                                {Math.round(f * req)}/{req}
                              </span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </details>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </>
  )
}
