import Link from 'next/link'
import type { Metadata } from 'next'
import { DAYS, TOTAL_DAYS, TRACKS, plan } from '@/lib/plan'
import { getSettings, clock, getAllDays, computeStats, getActivityDates, streakFrom, longestStreak, dateForDay } from '@/lib/store'
import { cols } from '@/lib/db'
import { fetchLeetCode } from '@/lib/leetcode'
import { fmtDate, fmtMinutes } from '@/lib/time'
import { clearRevisit } from '@/app/actions'
import { Heatmap, type Cell } from '@/components/Heatmap'
import { LcChart } from '@/components/LcChart'

export const metadata: Metadata = { title: 'Progress' }

const level = (f: number) => (f <= 0 ? 0 : f < 0.34 ? 1 : f < 0.67 ? 2 : f < 1 ? 3 : 4)

export default async function ProgressPage() {
  const s = await getSettings()
  const c = clock(s)
  const col = await cols()
  const [days, dates, revisit, lc] = await Promise.all([
    getAllDays(),
    getActivityDates(),
    col.revisit.find({}).sort({ addedAt: -1 }).toArray(),
    fetchLeetCode(s.leetcode),
  ])
  if (lc) {
    await col.snaps.updateOne(
      { _id: c.today },
      { $set: { total: lc.total, easy: lc.easy, medium: lc.medium, hard: lc.hard, rating: lc.rating, contests: lc.contests } },
      { upsert: true },
    )
  }
  const snaps = await col.snaps.find({}).sort({ _id: 1 }).toArray()
  const stats = computeStats(days, c.todayN, c.started)
  const streak = streakFrom(dates, c.today)
  const base = plan.baseline.leetcode

  const cells: Cell[] = DAYS.map((d) => {
    const req = d.tasks.filter((t) => !t.optional).length
    const f = stats.dayFractions[d.n - 1]
    return {
      n: d.n,
      label: fmtDate(dateForDay(s.startDate, d.n)),
      level: level(f),
      done: Math.round(f * req),
      req,
      today: c.started && d.n === c.todayN,
    }
  })

  return (
    <>
      <h1 className="display">Progress</h1>
      <p className="lede">
        {c.started
          ? `Day ${c.todayN} of ${TOTAL_DAYS}. ${fmtMinutes(stats.minutesLogged)} logged so far.`
          : `Your plan starts ${fmtDate(s.startDate)}.`}
      </p>

      <div className="stats">
        <div className="stat">
          <b>{streak.length}</b>
          <span>day streak{streak.length > 0 && !streak.activeToday ? ', do one task today to keep it' : ''}</span>
        </div>
        <div className="stat">
          <b>{stats.daysComplete}</b>
          <span>of {TOTAL_DAYS} days complete</span>
        </div>
        <div className="stat">
          <b>{stats.problemsDone}</b>
          <span>of {stats.problemsTotal} plan problems</span>
        </div>
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>
        Longest streak: {longestStreak(dates)} {longestStreak(dates) === 1 ? 'day' : 'days'}.
      </p>

      <section className="section">
        <div className="section-head">
          <h2 className="h2">LeetCode</h2>
          <a className="small" href={`https://leetcode.com/u/${s.leetcode}/`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
            {s.leetcode}
          </a>
        </div>
        {lc ? (
          <>
            <div className="lc tnum">
              <div>
                <b>{lc.total}</b>
                <span>Solved</span> {lc.total > base.total && <em>+{lc.total - base.total}</em>}
              </div>
              <div>
                <b>{lc.easy}</b>
                <span className="diff-Easy">Easy</span>
              </div>
              <div>
                <b>{lc.medium}</b>
                <span className="diff-Medium">Medium</span>
              </div>
              <div>
                <b>{lc.hard}</b>
                <span className="diff-Hard">Hard</span>
              </div>
            </div>
            <p className="small muted">
              You started at {base.total} solved with {base.hard} hard. The plan takes you past 500,
              with about 80 hard along the way. That is the depth backend and FDE loops at product companies expect. Contests are optional.
            </p>
          </>
        ) : (
          <p className="small muted">Couldn&apos;t reach LeetCode right now. Check the username in Settings.</p>
        )}
        <LcChart points={snaps.map((p) => ({ date: p._id, total: p.total }))} baseline={base.total} />
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="h2">Plan completion</h2>
          <span className="small muted">One column per week</span>
        </div>
        <Heatmap cells={cells} />
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="h2">By track</h2>
        </div>
        <ul className="bars">
          {TRACKS.map((t) => {
            const v = stats.tracks.find((x) => x.id === t.id)
            if (!v) return null
            return (
              <li key={t.id}>
                <span className="track" data-t={t.id}>
                  {t.name}
                </span>
                <span className="tnum muted">
                  {v.done} of {v.total}
                </span>
                <span className="bar" aria-hidden="true">
                  <i style={{ width: `${(v.done / v.total) * 100}%` }} />
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="section" id="revisit">
        <div className="section-head">
          <h2 className="h2">Revisit list</h2>
          <span className="small muted tnum">{revisit.length}</span>
        </div>
        {revisit.length ? (
          <ul className="list">
            {revisit.map((r) => (
              <li key={r._id}>
                <div>
                  <a className="title" href={r.url} target="_blank" rel="noreferrer">
                    {r.title}
                  </a>
                  <div className="small muted">
                    <span className={`diff-${r.difficulty}`}>{r.difficulty}</span>, from{' '}
                    <Link href={`/day/${r.day}`}>day {r.day}</Link>
                  </div>
                </div>
                <form action={clearRevisit.bind(null, r._id)}>
                  <button className="btn ghost">Solved it</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">
            Flag a problem with the bookmark on any day and it lands here. Fridays you clear two of them from a blank editor.
          </p>
        )}
      </section>
    </>
  )
}
