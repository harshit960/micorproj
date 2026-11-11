// Single-user passcode auth. The cookie holds `<expiry>.<hmac>`; works in Proxy and on the server.
export const COOKIE = 'b26_session'
export const MAX_AGE = 60 * 60 * 24 * 180

export const authEnabled = () => Boolean(process.env.APP_PASSCODE)

const enc = new TextEncoder()

async function hmac(data: string) {
  const secret = process.env.SESSION_SECRET || process.env.APP_PASSCODE || 'dev'
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function makeToken() {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE
  return `${exp}.${await hmac(String(exp))}`
}

export async function verifyToken(token: string | undefined) {
  if (!authEnabled()) return true
  if (!token) return false
  const [exp, sig] = token.split('.')
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false
  const expected = await hmac(exp)
  if (expected.length !== sig.length) return false
  let diff = 0
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

export async function checkPasscode(input: string) {
  const want = process.env.APP_PASSCODE ?? ''
  // compare digests so timing doesn't leak length
  return (await hmac('pass:' + input)) === (await hmac('pass:' + want))
}
