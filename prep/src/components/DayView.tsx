import Link from 'next/link'
import { getDay, phaseOf, TOTAL_DAYS, TOTAL_WEEKS, WEEKS } from '@/lib/plan'
import { getSettings, clock, getAllDays, computeStats, dateForDay } from '@/lib/store'
import { cols } from '@/lib/db'
import { fmtDate } from '@/lib/time'
import { shiftPlan } from '@/app/actions'
import { BlockStrip } from './BlockStrip'
import { DayTasks } from './DayTasks'
import { DayLog } from './DayLog'

export async function DayView({ n, isToday }: { n: number; isToday: boolean }) {
  const day = getDay(n)!
  const s = await getSettings()
  const c = clock(s)
  const c2 = await cols()
  const [days, revisit, materials] = await Promise.all([
    getAllDays(),
    c2.revisit.find({}).project<{ _id: string }>({ _id: 1 }).toArray(),
    c2.materials.find({ day: n }).sort({ createdAt: -1 }).toArray(),
  ])
  const stats = computeStats(days, c.todayN, c.started)
  const doc = days.get(n)
  const date = dateForDay(s.startDate, n)
  const week = WEEKS[day.week - 1]
  const phase = phaseOf(day.week)
  const currentWeek = getDay(c.todayN)!.week

  return (
    <>
      <BlockStrip weekFractions={stats.weekFractions} currentWeek={currentWeek} started={c.started} />

      <header className="dayhead">
        <h1 className="display tnum">Day {n}</h1>
        <div className="date">{n === c.todayN && c.started && !c.finished ? 'Today' : fmtDate(date)}</div>
        <p className="lede">
          Week {day.week} of {TOTAL_WEEKS}, {phase.name.toLowerCase()} phase. {week.theme}.
        </p>
      </header>

      {isToday && !c.started && (
        <div className="banner">
          <span>
            Your plan starts on {fmtDate(s.startDate, { weekday: 'long', day: 'numeric', month: 'long' })}. Here is day 1 if
            you want a head start.
          </span>
        </div>
      )}
      {isToday && c.finished && (
        <div className="banner">
          <span>All 26 weeks are behind you. Keep two problems a day and the weekly contest going while you interview.</span>
        </div>
      )}
      {isToday && c.started && !c.finished && stats.behind >= 4 && (
        <form className="banner" action={shiftPlan.bind(null, 1)}>
          <span>
            {stats.behind} earlier days are less than half done. Catch up, or push the plan back a week.
          </span>
          <button className="btn ghost">Push back a week</button>
        </form>
      )}

      <DayTasks
        key={n}
        n={n}
        tasks={day.tasks}
        initialDone={doc?.done ?? []}
        initialRevisit={revisit.map((r) => r._id)}
      />

      {materials.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="h2">Your material for this day</h2>
          </div>
          <ul className="list">
            {materials.map((m) => (
              <li key={m._id.toString()}>
                <div>
                  <a className="title" href={m.file ? `/api/files/${m.file.id}` : m.url} target="_blank" rel="noreferrer">
                    {m.title}
                  </a>
                  {m.note && <div className="small muted">{m.note}</div>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="small" style={{ marginTop: 14 }}>
        <Link href={`/library?day=${n}#add`} className="btn quiet">
          Attach notes or a file to day {n}
        </Link>
      </p>

      <DayLog key={`log-${n}`} n={n} minutes={doc?.log?.minutes ?? 0} note={doc?.log?.note ?? ''} />

      <nav className="pager" aria-label="Days">
        {n > 1 ? (
          <Link className="btn ghost" href={`/day/${n - 1}`}>
            Day {n - 1}
          </Link>
        ) : (
          <span />
        )}
        {!isToday && (
          <Link className="btn ghost" href="/">
            Today
          </Link>
        )}
        {n < TOTAL_DAYS ? (
          <Link className="btn ghost" href={`/day/${n + 1}`}>
            Day {n + 1}
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </>
  )
}
