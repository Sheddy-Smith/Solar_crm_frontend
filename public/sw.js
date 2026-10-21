// Malwa Solar CRM — version-safe PWA service worker (Android 8.1 TWA/WebView safe).
//
// Goals:
//   1. Never break API / auth / media traffic.
//   2. Never pin a stale index.html to missing hashed JS chunks.
//   3. On activate, drop only obsolete *app* caches (never localStorage / IndexedDB).
//   4. Never return Response.error() for navigations (blank white PWA window).
//
// BUILD_ID is stamped at `vite build` time (see vite.config.js). Do not edit by hand.

const BUILD_ID = '__MALWA_BUILD_ID__';
const VERSION = 'malwa-solar-crm-' + BUILD_ID;
const RUNTIME_CACHE = VERSION + '-runtime';
const APP_CACHE_PREFIX = 'malwa-solar-crm-';

self.addEventListener('install', () => {
  self.skipWaiting();
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
    path.endsWith('/sw.js') ||
    path.endsWith('/build-id.json') ||
    path.endsWith('/version.json')
  );
}

function isBuildAsset(url) {
  const path = url.pathname;
  return path.includes('/assets/') || path.includes('/icons/');
}

function offlineNavigationHtml() {
  return (
    '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>' +
    '<title>Malwa Solar CRM</title></head><body style="margin:0;font-family:Arial,sans-serif;background:#f3f7fb">' +
    '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px">' +
    '<div style="max-width:420px;text-align:center">' +
    '<h1 style="color:#1e3261;font-size:22px;font-weight:800">Connection needed</h1>' +
    '<p style="color:#53647f;font-size:14px;font-weight:600;line-height:1.5">Malwa Solar CRM could not load. Check internet, then tap Reload. Login data is kept.</p>' +
    '<button onclick="location.reload()" style="margin-top:12px;background:#0d9f4a;color:#fff;border:0;border-radius:8px;padding:12px 20px;font-weight:800">Reload</button>' +
    '</div></div></body></html>'
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isApiRequest(url) || isPassthrough(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response && response.ok) return response;
        } catch (e) {
          /* fall through */
        }
        return new Response(offlineNavigationHtml(), {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      })(),
    );
    return;
  }

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
        } catch (e) {
          return cached || new Response('', { status: 503, statusText: 'Offline' });
        }
      })(),
    );
  }
});
