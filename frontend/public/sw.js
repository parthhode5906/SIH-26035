/**
 * Offline app-shell service worker (P6-4).
 *
 * Strategy (minimal, deliberate):
 *  - Navigation requests: network-first, fall back to the cached shell so a
 *    reload mid-session works with the backend unreachable (design risk #1).
 *  - Static assets (Vite hashed bundles, icons, manifest): cache-first.
 *  - API calls are NEVER intercepted — IndexedDB + the sync outbox own
 *    data integrity; double-writing here would fight the sync engine.
 *
 * Version bump invalidates the old caches on activate.
 */
const VERSION = 'r76-shell-v1'
const SHELL = `${VERSION}-shell`
const ASSETS = `${VERSION}-assets`
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  /* @vite-asset-manifest */
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll(PRECACHE_ASSETS)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  if (req.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return // sync engine owns data

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const contentType = res.headers.get('content-type') ?? ''
          if (res.ok && contentType.includes('text/html')) {
            const copy = res.clone()
            caches.open(SHELL).then((c) => c.put('/index.html', copy))
          }
          return res
        })
        .catch(() => caches.match('/index.html')),
    )
    return
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ??
        fetch(req).then((res) => {
          if (res.ok && (url.pathname.startsWith('/assets/') || url.pathname === '/manifest.webmanifest' || url.pathname.endsWith('.png') || url.pathname.endsWith('.svg'))) {
            const copy = res.clone()
            caches.open(ASSETS).then((c) => c.put(req, copy))
          }
          return res
        }),
    ),
  )
})
