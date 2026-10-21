// Malwa Solar CRM — version-safe PWA service worker (Android 8.1 TWA/WebView safe).
//
// Goals:
//   1. Never break API / auth / media traffic.
//   2. Never pin a stale index.html to missing hashed JS chunks.
//   3. On activate, drop only obsolete *app* caches (never localStorage / IndexedDB).
//   4. Satisfy installability (fetch handler + manifest).
//
// BUILD_ID is stamped at `vite build` time (see vite.config.js). Do not edit by hand.

const BUILD_ID = '__MALWA_BUILD_ID__';
const VERSION = `malwa-solar-crm-${BUILD_ID}`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const APP_CACHE_PREFIX = 'malwa-solar-crm-';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(APP_CACHE_PREFIX) && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

function isApiRequest(url) {
  // Match /api/ at root or under a subdirectory mount (e.g. /crm/… proxies).
  return /\/api\//.test(url.pathname);
}

function isPassthrough(url) {
  const path = url.pathname;
  return (
    path.includes('/downloads/') ||
    path.includes('/.well-known/') ||
    path.endsWith('/sw.js') ||
    path.endsWith('/build-id.json')
  );
}

function isBuildAsset(url) {
  const path = url.pathname;
  return path.includes('/assets/') || path.includes('/icons/');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isApiRequest(url) || isPassthrough(url)) return;

  // Navigations: always network-first. Do NOT cache HTML — after a deploy the
  // hashed chunk names change; a cached shell can point at deleted assets and
  // brick Android WebView on launch.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(RUNTIME_CACHE);
          const cached = await cache.match('/offline-shell');
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  // Hashed build assets: cache-first is safe (filename changes every build).
  if (isBuildAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        } catch {
          return Response.error();
        }
      })(),
    );
  }
});
