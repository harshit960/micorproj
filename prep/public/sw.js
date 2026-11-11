/* Block 26 service worker: offline shell, push reminders. */
const VERSION = 'b26-v1'
const PAGES = `${VERSION}-pages`
const ASSETS = `${VERSION}-assets`

const OFFLINE_HTML = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline</title><style>body{font:16px/1.5 system-ui,sans-serif;margin:0;padding:48px 20px;background:#f3f5f8;color:#172033}
@media (prefers-color-scheme:dark){body{background:#0e1420;color:#e8edf5}}h1{font-size:32px;margin:0 0 8px}</style>
<h1>You're offline</h1><p>Pages you opened recently still work. Reconnect to save progress.</p></html>`

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(ASSETS).then((c) => c.addAll(['/icons/icon-192.png', '/manifest.webmanifest']).catch(() => {})),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return
  if (url.pathname.startsWith('/api/')) return

  // Hashed build assets never change: cache first.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(ASSETS).then((c) => c.put(req, res.clone()))
            return res
          }),
      ),
    )
    return
  }

  // Pages: network first so progress is always fresh; fall back to the last copy offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req)
          if (res.ok && !res.redirected) {
            const copy = res.clone()
            caches.open(PAGES).then((c) => c.put(req, copy))
          }
          return res
        } catch {
          const hit = (await caches.match(req)) || (await caches.match('/'))
          return hit || new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
        }
      })(),
    )
  }
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Block 26', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Block 26'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: data.tag || 'b26',
      renotify: true,
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', location.origin).href
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const c of all) {
        if (new URL(c.url).origin === location.origin) {
          await c.focus()
          if ('navigate' in c) return c.navigate(target)
          return
        }
      }
      return self.clients.openWindow(target)
    })(),
  )
})
