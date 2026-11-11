import { NextResponse, type NextRequest } from 'next/server'
import { runReminders } from '@/lib/remind'
import { hasDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!hasDb()) return NextResponse.json({ error: 'MONGODB_URI is not set' }, { status: 500 })
  return NextResponse.json(await runReminders())
}
