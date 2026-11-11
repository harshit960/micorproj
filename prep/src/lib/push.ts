import 'server-only'
import * as webpush from 'web-push'
import { cols, db } from './db'

interface Keys { publicKey: string; privateKey: string }

/**
 * VAPID keys come from the environment when set; otherwise they're generated once and kept in
 * MongoDB, so push works with zero configuration. Changing keys invalidates existing subscriptions.
 */
export async function vapidKeys(): Promise<Keys> {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (pub && priv) return { publicKey: pub, privateKey: priv }
  const config = (await db()).collection<{ _id: string } & Keys>('config')
  const found = await config.findOne({ _id: 'vapid' })
  if (found) return { publicKey: found.publicKey, privateKey: found.privateKey }
  const fresh = webpush.generateVAPIDKeys()
  await config.updateOne({ _id: 'vapid' }, { $setOnInsert: fresh }, { upsert: true })
  const saved = (await config.findOne({ _id: 'vapid' }))!
  return { publicKey: saved.publicKey, privateKey: saved.privateKey }
}

export async function vapidPublicKey() {
  return (await vapidKeys()).publicKey
}

export interface PushPayload { title: string; body: string; url?: string; tag?: string }

/** Sends to every saved device. Returns how many devices accepted it. Dead subscriptions are removed. */
export async function pushAll(payload: PushPayload) {
  const keys = await vapidKeys()
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:reminders@example.com', keys.publicKey, keys.privateKey)
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
