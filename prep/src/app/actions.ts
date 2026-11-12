'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { GridFSBucket, ObjectId } from 'mongodb'
import { cols, db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { COOKIE, MAX_AGE, checkPasscode, makeToken } from '@/lib/auth'
import { getSettings, bumpActivity } from '@/lib/store'
import { getDay, required, TOTAL_DAYS } from '@/lib/plan'
import { addDays, isISODate, isValidTimeZone, mondayOnOrBefore } from '@/lib/time'
import { pushAll } from '@/lib/push'
import { buildMessage } from '@/lib/remind'

const validDay = (n: number) => Number.isInteger(n) && n >= 1 && n <= TOTAL_DAYS

export async function signIn(_: unknown, form: FormData) {
  const pass = String(form.get('passcode') ?? '')
  if (!(await checkPasscode(pass))) return { error: 'That passcode is wrong.' }
  const jar = await cookies()
  jar.set(COOKIE, await makeToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE,
    path: '/',
  })
  redirect('/')
}

export async function signOut() {
  ;(await cookies()).delete(COOKIE)
  redirect('/login')
}

export async function toggleTask(n: number, taskId: string, done: boolean) {
  await requireAuth()
  const day = getDay(n)
  if (!day || !day.tasks.some((t) => t.id === taskId)) throw new Error('Unknown task')
  const c = await cols()
  const res = await c.days.findOneAndUpdate(
    { _id: n },
    done ? { $addToSet: { done: taskId } } : { $pull: { done: taskId } },
    { upsert: true, returnDocument: 'after' },
  )
  const set = new Set(res?.done ?? [])
  const complete = required(day).every((t) => set.has(t.id))
  await c.days.updateOne({ _id: n }, complete ? { $set: { completedAt: new Date() } } : { $unset: { completedAt: '' } })
  if (done) await bumpActivity((await getSettings()).tz)
  revalidatePath('/', 'layout')
  return { done: [...set], complete }
}

export async function saveLog(n: number, minutes: number, note: string) {
  await requireAuth()
  if (!validDay(n)) throw new Error('Unknown day')
  const m = Math.max(0, Math.min(16 * 60, Math.round(Number(minutes) || 0)))
  const c = await cols()
  await c.days.updateOne(
    { _id: n },
    { $set: { log: { minutes: m, note: String(note).slice(0, 4000), updatedAt: new Date() } }, $setOnInsert: { done: [] } },
    { upsert: true },
  )
  if (m > 0) await bumpActivity((await getSettings()).tz)
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function setRevisit(n: number, taskId: string, on: boolean) {
  await requireAuth()
  const task = getDay(n)?.tasks.find((t) => t.id === taskId)
  if (!task || task.kind !== 'problem' || !task.slug) throw new Error('Only problems can be flagged')
  const c = await cols()
  if (on) {
    await c.revisit.updateOne(
      { _id: task.slug },
      { $set: { title: task.title, url: task.url!, difficulty: task.difficulty, day: n }, $setOnInsert: { addedAt: new Date() } },
      { upsert: true },
    )
  } else {
    await c.revisit.deleteOne({ _id: task.slug })
  }
  revalidatePath('/', 'layout')
}

export async function clearRevisit(slug: string) {
  await requireAuth()
  await (await cols()).revisit.deleteOne({ _id: String(slug) })
  revalidatePath('/', 'layout')
}

export async function deleteMaterial(id: string) {
  await requireAuth()
  if (!ObjectId.isValid(id)) return
  const c = await cols()
  const doc = await c.materials.findOneAndDelete({ _id: new ObjectId(id) })
  if (doc?.file) {
    await new GridFSBucket(await db(), { bucketName: 'files' }).delete(doc.file.id).catch(() => {})
  }
  revalidatePath('/', 'layout')
}

export async function saveSettings(_: unknown, form: FormData) {
  await requireAuth()
  const s = await getSettings()
  const start = String(form.get('startDate') ?? '')
  const tz = String(form.get('tz') ?? '').trim() || s.tz
  const leetcode = String(form.get('leetcode') ?? '').trim().slice(0, 40)
  const morning = Number(form.get('morning'))
  const evening = Number(form.get('evening'))
  if (!isISODate(start)) return { error: 'Pick a start date.' }
  if (!isValidTimeZone(tz)) return { error: `"${tz}" isn't a time zone. Try Asia/Kolkata.` }
  if (!(morning >= 0 && morning <= 23 && evening >= 0 && evening <= 23 && morning < evening)) {
    return { error: 'The morning reminder has to be earlier than the evening one.' }
  }
  const startDate = mondayOnOrBefore(start)
  await (await cols()).settings.updateOne(
    { _id: 'me' },
    { $set: { startDate, tz, leetcode: leetcode || s.leetcode, reminders: { morning, evening } } },
  )
  revalidatePath('/', 'layout')
  return { ok: startDate === start ? 'Settings saved.' : `Settings saved. Plans start on a Monday, so day 1 is now ${startDate}.` }
}

export async function shiftPlan(weeks: number) {
  await requireAuth()
  const s = await getSettings()
  const w = Math.max(-4, Math.min(4, Math.trunc(weeks)))
  await (await cols()).settings.updateOne({ _id: 'me' }, { $set: { startDate: addDays(s.startDate, 7 * w) } })
  revalidatePath('/', 'layout')
}

export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, ua: string) {
  await requireAuth()
  if (!sub?.endpoint?.startsWith('https://') || !sub.keys?.p256dh || !sub.keys?.auth) throw new Error('Bad subscription')
  await (await cols()).push.updateOne(
    { _id: sub.endpoint },
    { $set: { sub: { endpoint: sub.endpoint, keys: sub.keys }, ua: ua.slice(0, 200) }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  )
}

export async function removePushSubscription(endpoint: string) {
  await requireAuth()
  await (await cols()).push.deleteOne({ _id: String(endpoint) })
}

export async function sendTestNotification() {
  await requireAuth()
  const msg = (await buildMessage('morning')) ?? { title: 'Reminders are on', body: 'You will get a plan in the morning and a nudge in the evening.', url: '/' }
  return pushAll({ ...msg, tag: 'b26-test' })
}
