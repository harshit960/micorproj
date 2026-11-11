import 'server-only'
import * as webpush from 'web-push'
import { cols } from './db'

export const pushConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)

let ready = false
function init() {
  if (ready) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:reminders@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
  ready = true
}

export interface PushPayload { title: string; body: string; url?: string; tag?: string }

/** Sends to every saved device. Returns how many devices accepted it. Dead subscriptions are removed. */
export async function pushAll(payload: PushPayload) {
  if (!pushConfigured()) return { sent: 0, failed: 0, devices: 0 }
  init()
  const c = await cols()
  const subs = await c.push.find({}).toArray()
  let sent = 0
  let failed = 0
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s.sub, JSON.stringify(payload), { TTL: 60 * 60 * 6, urgency: 'normal' })
        sent++
      } catch (e) {
        failed++
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) await c.push.deleteOne({ _id: s._id })
      }
    }),
  )
  return { sent, failed, devices: subs.length }
}
