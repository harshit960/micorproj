import { NextResponse, type NextRequest } from 'next/server'
import { runReminders } from '@/lib/remind'
import { hasDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const ok = secret
    ? req.headers.get('authorization') === `Bearer ${secret}`
    : // Without CRON_SECRET, accept Vercel Cron. The job is idempotent and only messages the owner,
      // so a spoofed call can at worst send today's reminder early. Set CRON_SECRET to lock it down.
      (req.headers.get('user-agent') ?? '').startsWith('vercel-cron/')
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDb()) return NextResponse.json({ error: 'MONGODB_URI is not set' }, { status: 500 })
  return NextResponse.json(await runReminders())
}
