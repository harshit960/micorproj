// Dates are plain ISO strings (YYYY-MM-DD) in the user's time zone. All arithmetic is done in UTC
// on those strings so daylight-saving and server time zones never shift a day.

export function todayIn(tz: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function hourIn(tz: string, now = new Date()): number {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(now)
  return Number(h)
}

const toUTC = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function addDays(iso: string, n: number): string {
  return new Date(toUTC(iso) + n * 86400000).toISOString().slice(0, 10)
}

export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(a) - toUTC(b)) / 86400000)
}

/** 0 = Monday … 6 = Sunday */
export function weekday(iso: string): number {
  return (new Date(toUTC(iso)).getUTCDay() + 6) % 7
}

export function mondayOnOrAfter(iso: string): string {
  const w = weekday(iso)
  return w === 0 ? iso : addDays(iso, 7 - w)
}

export function mondayOnOrBefore(iso: string): string {
  return addDays(iso, -weekday(iso))
}

export function isISODate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUTC(s))
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Intl.DateTimeFormat('en-IN', { ...opts, timeZone: 'UTC' }).format(new Date(toUTC(iso)))
}

export function fmtMinutes(m: number) {
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} h ${r} min` : `${h} h`
}

export function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return true
  } catch {
    return false
  }
}
