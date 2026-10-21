// Malwa Solar CRM — PWA service worker (installability + asset refresh only).
//
// IMPORTANT: Do NOT intercept navigations. Cloudflare / bot checks / HTTP errors
// must reach the browser. A previous SW that wrapped navigations caused a fake
// "Connection needed" screen while Wi‑Fi was fine, and stuck installed PWAs.
//
// BUILD_ID is stamped at `vite build` time (see vite.config.js).

const BUILD_ID = '__MALWA_BUILD_ID__';
const VERSION = 'malwa-solar-crm-' + BUILD_ID;
const RUNTIME_CACHE = VERSION + '-runtime';
const APP_CACHE_PREFIX = 'malwa-solar-crm-';

self.addEventListener('install', (event) => {
  // Drop any previous generation immediately.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('message', (event) => {
  const data = event && event.data;
  if (!data || data.type !== 'SKIP_WAITING') return;
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
      // Aggressively clear legacy caches from malwa-solar-crm-v* workers.
      await Promise.all(
        keys
          .filter((key) => key.startsWith('malwa-solar-crm-v') || key === 'malwa-solar-crm-v90-runtime')
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

function isApiRequest(url) {
  return /\/api\//.test(url.pathname);
}

function isPassthrough(url) {
  const path = url.pathname;
  return (
    path.includes('/downloads/') ||
    path.includes('/.well-known/') ||
    /\/sw(?:-[\da-f]+)?\.js$/i.test(path) ||
    path.endsWith('/build-id.json') ||
    path.endsWith('/version.json') ||
    path.endsWith('/recover.html')
  );
}

function isBuildAsset(url) {
  const path = url.pathname;
  return path.includes('/assets/') || path.includes('/icons/');
}

function isScriptOrStyle(url) {
  return /\.(?:js|mjs|css)$/i.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never touch navigations — browser talks to the network / Cloudflare directly.
  if (request.mode === 'navigate' || request.destination === 'document') return;

  if (isApiRequest(url) || isPassthrough(url)) return;

  if (!isBuildAsset(url)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      if (isScriptOrStyle(url)) {
        try {
          const response = await fetch(request, { credentials: 'same-origin' });
          if (response && response.ok) {
            cache.put(request, response.clone());
          }
          if (response) return response;
        } catch (e) {
          /* try cache */
        }
        const cached = await cache.match(request);
        if (cached) return cached;
        return new Response('/* offline */', {
          status: 503,
          headers: { 'Content-Type': 'application/javascript' },
        });
      }

      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request, { credentials: 'same-origin' });
        if (response && response.ok) cache.put(request, response.clone());
        return response;
      } catch (e) {
        return new Response('', { status: 503, statusText: 'Offline' });
      }
    })(),
  );
});
