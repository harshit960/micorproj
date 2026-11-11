import { NextResponse, type NextRequest } from 'next/server'
import { GridFSBucket, ObjectId } from 'mongodb'
import { Readable } from 'node:stream'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/files/[id]'>) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  }
  const { id } = await ctx.params
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const bucket = new GridFSBucket(await db(), { bucketName: 'files' })
  const [meta] = await bucket.find({ _id: new ObjectId(id) }).toArray()
  if (!meta) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const type = (meta.metadata?.contentType as string) || 'application/octet-stream'
  const inline = /^(application\/pdf|image\/(png|jpeg|gif|webp)|text\/plain)$/.test(type)
  const stream = bucket.openDownloadStream(meta._id)
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      'Content-Type': inline ? type : 'application/octet-stream',
      'Content-Length': String(meta.length),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(meta.filename)}`,
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  })
}
