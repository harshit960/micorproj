import 'server-only'
import { cols, type DayDoc, type SettingsDoc } from './db'
import { todayIn, mondayOnOrAfter, diffDays, addDays } from './time'
import { DAYS, TOTAL_DAYS, WEEKS, getDay, required, type Track } from './plan'

export const DEFAULT_TZ = 'Asia/Kolkata'

export async function getSettings(): Promise<SettingsDoc> {
  const c = await cols()
  const found = await c.settings.findOne({ _id: 'me' })
  if (found) return found
  const doc: SettingsDoc = {
    _id: 'me',
    startDate: mondayOnOrAfter(todayIn(DEFAULT_TZ)),
    tz: DEFAULT_TZ,
    leetcode: 'user4397ON',
    reminders: { morning: 8, evening: 21 },
  }
  await c.settings.updateOne({ _id: 'me' }, { $setOnInsert: doc }, { upsert: true })
  return (await c.settings.findOne({ _id: 'me' }))!
}

/** Plan day number for a date (1-based, may be < 1 before the start or > TOTAL_DAYS after). */
export function dayNumberFor(startDate: string, date: string) {
  return diffDays(date, startDate) + 1
}

export function dateForDay(startDate: string, n: number) {
  return addDays(startDate, n - 1)
}

export interface Clock {
  today: string
  todayN: number // clamped to 1..TOTAL_DAYS
  rawN: number
  started: boolean
  finished: boolean
}

export function clock(s: SettingsDoc, now = new Date()): Clock {
  const today = todayIn(s.tz, now)
  const rawN = dayNumberFor(s.startDate, today)
  return {
    today,
    rawN,
    todayN: Math.min(Math.max(rawN, 1), TOTAL_DAYS),
    started: rawN >= 1,
    finished: rawN > TOTAL_DAYS,
  }
}

export async function getAllDays(): Promise<Map<number, DayDoc>> {
  const c = await cols()
  const docs = await c.days.find({}).toArray()
  return new Map(docs.map((d) => [d._id, d]))
}

export async function getDayDoc(n: number): Promise<DayDoc | null> {
  const c = await cols()
  return c.days.findOne({ _id: n })
}

export function dayFraction(n: number, doc: DayDoc | undefined | null) {
  const day = getDay(n)
  if (!day || !doc) return 0
  const req = required(day)
  if (!req.length) return 0
  const done = new Set(doc.done)
  return req.filter((t) => done.has(t.id)).length / req.length
}

export async function bumpActivity(tz: string) {
  const c = await cols()
  await c.activity.updateOne({ _id: todayIn(tz) }, { $inc: { n: 1 } }, { upsert: true })
}

export async function getActivityDates(): Promise<Set<string>> {
  const c = await cols()
  const docs = await c.activity.find({ n: { $gt: 0 } }).project<{ _id: string }>({ _id: 1 }).toArray()
  return new Set(docs.map((d) => d._id))
}

export function streakFrom(dates: Set<string>, today: string) {
  let d = dates.has(today) ? today : addDays(today, -1)
  let n = 0
  while (dates.has(d)) {
    n++
    d = addDays(d, -1)
  }
  return { length: n, activeToday: dates.has(today) }
}

export function longestStreak(dates: Set<string>) {
  const sorted = [...dates].sort()
  let best = 0
  let run = 0
  let prev = ''
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

export interface Stats {
  weekFractions: number[]
  dayFractions: number[]
  daysComplete: number
  problemsDone: number
  problemsTotal: number
  behind: number
  tracks: { id: Track; done: number; total: number }[]
  minutesLogged: number
}

export function computeStats(days: Map<number, DayDoc>, todayN: number, started: boolean): Stats {
  const dayFractions = DAYS.map((d) => dayFraction(d.n, days.get(d.n)))
  const weekFractions = WEEKS.map((w) => {
    let total = 0
    let done = 0
    for (const d of w.days) {
      const set = new Set(days.get(d.n)?.done ?? [])
      for (const t of required(d)) {
        total++
        if (set.has(t.id)) done++
      }
    }
    return total ? done / total : 0
  })
  const trackMap = new Map<Track, { done: number; total: number }>()
  let problemsDone = 0
  let problemsTotal = 0
  for (const d of DAYS) {
    const set = new Set(days.get(d.n)?.done ?? [])
    for (const t of d.tasks) {
      if (t.optional) continue
      const e = trackMap.get(t.track) ?? { done: 0, total: 0 }
      e.total++
      if (set.has(t.id)) e.done++
      trackMap.set(t.track, e)
      if (t.kind === 'problem') {
        problemsTotal++
        if (set.has(t.id)) problemsDone++
      }
    }
  }
  const behind = started ? dayFractions.slice(0, todayN - 1).filter((f) => f < 0.5).length : 0
  let minutesLogged = 0
  for (const doc of days.values()) minutesLogged += doc.log?.minutes ?? 0
  return {
    weekFractions,
    dayFractions,
    daysComplete: dayFractions.filter((f) => f >= 1).length,
    problemsDone,
    problemsTotal,
    behind,
    tracks: [...trackMap.entries()].map(([id, v]) => ({ id, ...v })),
    minutesLogged,
  }
}
