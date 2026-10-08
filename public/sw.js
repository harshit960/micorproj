// Kosh service worker: offline app shell + cached static assets.
// Firestore/Auth traffic is never cached here — Firestore keeps its own offline cache in IndexedDB.
const VERSION = "kosh-v2";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/favicon.svg", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});

const putInCache = (req, res) => {
  if (res.ok || res.type === "opaque") {
    const copy = res.clone();
    caches.open(VERSION).then((c) => c.put(req, copy));
  }
  return res;
};

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // App navigations: network first so deploys show up, cached shell when offline.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => putInCache("/index.html", res))
        .catch(() => caches.match("/index.html")),
    );
    return;
  }

  if (url.origin === location.origin) {
    // Hashed build assets and icons never change for a given URL: cache first.
    if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
      e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => putInCache(req, res))));
    } else {
      // Everything else (manifest, favicon…): network first, cache as offline fallback.
      e.respondWith(fetch(req).then((res) => putInCache(req, res)).catch(() => caches.match(req)));
    }
    return;
  }

  // Google Fonts: stale-while-revalidate.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req).then((res) => putInCache(req, res)).catch(() => hit);
        return hit || net;
      }),
    );
  }
});
