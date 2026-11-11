import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE, verifyToken } from '@/lib/auth'

export async function proxy(req: NextRequest) {
  if (await verifyToken(req.cookies.get(COOKIE)?.value)) return NextResponse.next()
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  }
  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    '/((?!login|api/cron|_next/static|_next/image|icons/|sw\\.js|manifest\\.webmanifest|favicon\\.ico|icon\\.svg|apple-icon\\.png|robots\\.txt).*)',
  ],
}
