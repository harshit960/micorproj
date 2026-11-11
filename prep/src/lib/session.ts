import 'server-only'
import { cookies } from 'next/headers'
import { COOKIE, verifyToken } from './auth'

export async function requireAuth() {
  const jar = await cookies()
  if (!(await verifyToken(jar.get(COOKIE)?.value))) throw new Error('Not signed in')
}
