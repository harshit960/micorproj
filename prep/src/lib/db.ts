import 'server-only'
import { MongoClient, type Db, type ObjectId } from 'mongodb'

const g = globalThis as unknown as { _mongo?: Promise<MongoClient> }

export const hasDb = () => Boolean(process.env.MONGODB_URI)

export async function db(): Promise<Db> {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not set')
  if (!g._mongo) {
    g._mongo = new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 }).connect()
    g._mongo.catch(() => (g._mongo = undefined))
  }
  return (await g._mongo).db(process.env.MONGODB_DB || 'block26')
}

export interface SettingsDoc {
  _id: 'me'
  startDate: string
  tz: string
  leetcode: string
  reminders: { morning: number; evening: number }
}
export interface DayDoc {
  _id: number
  done: string[]
  log?: { minutes: number; note: string; updatedAt: Date }
  completedAt?: Date
}
export interface RevisitDoc {
  _id: string
  title: string
  url: string
  difficulty?: string
  day: number
  addedAt: Date
}
export interface MaterialDoc {
  _id: ObjectId
  title: string
  url?: string
  file?: { id: ObjectId; name: string; size: number; type: string }
  track: string
  day?: number
  note?: string
  createdAt: Date
}
export interface PushDoc {
  _id: string
  sub: { endpoint: string; expirationTime?: number | null; keys: { p256dh: string; auth: string } }
  ua?: string
  createdAt: Date
}
export interface ActivityDoc { _id: string; n: number }
export interface SnapDoc {
  _id: string
  total: number
  easy: number
  medium: number
  hard: number
  rating?: number | null
  contests?: number
}

export async function cols() {
  const d = await db()
  return {
    settings: d.collection<SettingsDoc>('settings'),
    days: d.collection<DayDoc>('days'),
    revisit: d.collection<RevisitDoc>('revisit'),
    materials: d.collection<MaterialDoc>('materials'),
    push: d.collection<PushDoc>('push_subscriptions'),
    activity: d.collection<ActivityDoc>('activity'),
    sent: d.collection<{ _id: string; at: Date }>('reminders_sent'),
    snaps: d.collection<SnapDoc>('leetcode_snapshots'),
  }
}
