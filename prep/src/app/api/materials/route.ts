import { NextResponse, type NextRequest } from 'next/server'
import { GridFSBucket } from 'mongodb'
import { Readable } from 'node:stream'
import { db, cols } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { TOTAL_DAYS, TRACKS } from '@/lib/plan'

export const dynamic = 'force-dynamic'
// Vercel functions accept request bodies up to ~4.5 MB.
const MAX_BYTES = 4 * 1024 * 1024

export async function POST(req: NextRequest) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  }
  const form = await req.formData()
  const title = String(form.get('title') ?? '').trim()
  const url = String(form.get('url') ?? '').trim()
  const note = String(form.get('note') ?? '').trim().slice(0, 2000)
  const track = TRACKS.some((t) => t.id === form.get('track')) ? String(form.get('track')) : 'dsa'
  const dayRaw = Number(form.get('day'))
  const day = Number.isInteger(dayRaw) && dayRaw >= 1 && dayRaw <= TOTAL_DAYS ? dayRaw : undefined
  const file = form.get('file')
  const hasFile = file instanceof File && file.size > 0

  if (!hasFile && !url) return NextResponse.json({ error: 'Add a link or choose a file.' }, { status: 400 })
  if (url && !/^https?:\/\//i.test(url)) return NextResponse.json({ error: 'Links must start with http:// or https://' }, { status: 400 })
  if (hasFile && file.size > MAX_BYTES) return NextResponse.json({ error: 'Files can be up to 4 MB. Add bigger ones as a Drive link.' }, { status: 413 })

  const c = await cols()
  let fileInfo
  if (hasFile) {
    const bucket = new GridFSBucket(await db(), { bucketName: 'files' })
    const upload = bucket.openUploadStream(file.name, { metadata: { contentType: file.type || 'application/octet-stream' } })
    await new Promise<void>((resolve, reject) => {
      Readable.fromWeb(file.stream() as import('node:stream/web').ReadableStream).pipe(upload).on('finish', () => resolve()).on('error', reject)
    })
    fileInfo = { id: upload.id, name: file.name, size: file.size, type: file.type || 'application/octet-stream' }
  }
  const doc = {
    title: (title || (hasFile ? file.name : url)).slice(0, 200),
    ...(url ? { url } : {}),
    ...(fileInfo ? { file: fileInfo } : {}),
    track,
    ...(day ? { day } : {}),
    ...(note ? { note } : {}),
    createdAt: new Date(),
  }
  const res = await c.materials.insertOne(doc as never)
  return NextResponse.json({ id: res.insertedId.toString() })
}
