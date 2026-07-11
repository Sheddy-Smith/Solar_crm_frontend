// Malwa Solar CRM — minimal PWA service worker.
//
// Goals (in priority order):
//   1. Never break the live app or its API calls.
//   2. Satisfy PWA "installability" requirements (fetch handler + manifest).
//   3. Provide a small offline fallback for the app shell.
//
// Strategy:
//   - Navigation requests (HTML): network-first, falling back to the last
//     cached shell only when fully offline. We deliberately do NOT cache
//     index.html on every load — after a new deploy, Vite emits new
//     content-hashed JS/CSS filenames, so a stale cached index.html could
//     reference assets that no longer exist on the server.
//   - Same-origin build assets (/assets/*, hashed JS/CSS/fonts/images):
//     cache-first with a background refresh. Safe because each new build
//     produces new hashed filenames — nothing is ever "stale" in place.
//   - Everything else (API calls, cross-origin requests, auth endpoints):
//     left completely untouched — the browser handles them natively.

const VERSION = 'malwa-solar-crm-v1';
const RUNTIME_CACHE = `${VERSION}-runtime`;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('malwa-solar-crm-') && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isBuildAsset(url) {
  return url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isApiRequest(url)) return; // never intercept API/auth traffic

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put('/', response.clone());
          return response;
        } catch {
          const cache = await caches.open(RUNTIME_CACHE);
          const cached = await cache.match('/');
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  if (isBuildAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(request);
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => null);
        return cached || (await networkFetch) || Response.error();
      })(),
    );
  }
});
