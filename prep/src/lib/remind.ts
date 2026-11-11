import 'server-only'
import { cols } from './db'
import { getSettings, clock, getDayDoc, getActivityDates, streakFrom } from './store'
import { getDay, required } from './plan'
import { hourIn, fmtMinutes } from './time'
import { pushAll, type PushPayload } from './push'
import { fetchLeetCode } from './leetcode'

export type Slot = 'morning' | 'evening'

export async function buildMessage(slot: Slot): Promise<PushPayload | null> {
  const s = await getSettings()
  const c = clock(s)
  if (c.rawN === 0 && slot === 'evening') {
    return { title: 'Your plan starts tomorrow', body: getDay(1)!.title + '. Open the app tonight to see day 1.', url: '/', tag: 'b26-evening' }
  }
  if (!c.started || c.finished) return null
  const day = getDay(c.todayN)!
  const req = required(day)
  const doc = await getDayDoc(day.n)
  const done = new Set(doc?.done ?? [])
  const left = req.filter((t) => !done.has(t.id))

  if (slot === 'morning') {
    const mins = left.reduce((a, t) => a + t.mins, 0)
    const problems = left.filter((t) => t.kind === 'problem').map((t) => t.title)
    const body =
      `${left.length} tasks, about ${fmtMinutes(mins)}.` + (problems.length ? ` Problems: ${problems.join(', ')}.` : '')
    return { title: `Day ${day.n}: ${day.title}`, body, url: '/', tag: 'b26-morning' }
  }

  if (!left.length) return null
  const streak = streakFrom(await getActivityDates(), c.today)
  const body =
    streak.length >= 2 && !streak.activeToday
      ? `Your ${streak.length}-day streak ends at midnight. One problem keeps it going.`
      : `Next up: ${left[0].title}. Log your minutes when you stop.`
  return { title: `${left.length} of ${req.length} left for day ${day.n}`, body, url: '/', tag: 'b26-evening' }
}

/**
 * Sends whichever reminder is due and hasn't gone out today. Safe to call as often as you like
 * (hourly GitHub workflow, twice-daily Vercel cron, or both).
 */
export async function runReminders(now = new Date()) {
  const s = await getSettings()
  const c = clock(s, now)
  const hour = hourIn(s.tz, now)
  const col = await cols()
  const results: Record<string, unknown> = { today: c.today, hour }

  for (const slot of ['morning', 'evening'] as Slot[]) {
    const at = s.reminders[slot]
    const due = slot === 'morning' ? hour >= at && hour < s.reminders.evening : hour >= at
    if (!due) {
      results[slot] = 'not due'
      continue
    }
    const key = `${c.today}:${slot}`
    const claimed = await col.sent.updateOne({ _id: key }, { $setOnInsert: { at: now } }, { upsert: true })
    if (!claimed.upsertedCount) {
      results[slot] = 'already sent'
      continue
    }
    const msg = await buildMessage(slot)
    results[slot] = msg ? await pushAll(msg) : 'nothing to say'
  }

  // One LeetCode snapshot per day for the progress chart.
  const snapId = c.today
  if (!(await col.snaps.findOne({ _id: snapId }))) {
    const lc = await fetchLeetCode(s.leetcode)
    if (lc) {
      await col.snaps.updateOne(
        { _id: snapId },
        { $set: { total: lc.total, easy: lc.easy, medium: lc.medium, hard: lc.hard, rating: lc.rating, contests: lc.contests } },
        { upsert: true },
      )
      results.snapshot = lc.total
    }
  }
  return results
}

