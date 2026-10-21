// Malwa Solar CRM — version-safe PWA service worker (Android 8.1 TWA/WebView safe).
//
// Goals:
//   1. Never break API / auth / media traffic.
//   2. Never pin a stale index.html to missing hashed JS chunks.
//   3. On activate, drop only obsolete *app* caches (never localStorage / IndexedDB).
//   4. JS/CSS assets are network-first so installed PWAs cannot stick on a bad cache.
//   5. Navigations never return Response.error() (blank white window).
//   6. Never mask real HTTP responses (Cloudflare 403/challenge, 5xx) as "offline".
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

function isScriptOrStyle(url) {
  return /\.(?:js|mjs|css)$/i.test(url.pathname);
}

function appShellUrl() {
  try {
    return new URL('index.html', self.registration.scope).href;
  } catch (e) {
    return self.registration.scope;
  }
}

function offlineNavigationHtml() {
  // Inline recover so a broken SW/cache can be cleared without loading the app bundle.
  return (
    '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>' +
    '<title>Malwa Solar CRM</title></head><body style="margin:0;font-family:Arial,sans-serif;background:#f3f7fb">' +
    '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px">' +
    '<div style="max-width:420px;text-align:center">' +
    '<h1 style="color:#1e3261;font-size:22px;font-weight:800;margin:0">Could not load</h1>' +
    '<p style="color:#53647f;font-size:14px;font-weight:600;line-height:1.5;margin:12px 0 0">Wi‑Fi on hone par bhi yeh screen aaye to pehle Recover dabao (login data safe). Phir Reload.</p>' +
    '<div style="margin-top:18px;display:flex;flex-wrap:wrap;gap:10px;justify-content:center">' +
    '<button id="malwa-sw-recover" type="button" style="background:#0d9f4a;color:#fff;border:0;border-radius:8px;padding:12px 18px;font-weight:800">Recover offline cache</button>' +
    '<button id="malwa-sw-reload" type="button" style="background:#fff;color:#1e3261;border:1px solid #d9e2ec;border-radius:8px;padding:12px 18px;font-weight:800">Reload</button>' +
    '</div></div></div>' +
    '<script>(function(){' +
    'function go(){var u=location.href.split("#")[0].replace(/([?&])malwa_(recovered|updated)=\\d+/g,"").replace(/[?&]$/,"");' +
    'var sep=u.indexOf("?")>=0?"&":"?";location.replace(u+sep+"malwa_recovered="+Date.now());}' +
    'document.getElementById("malwa-sw-reload").onclick=function(){location.reload();};' +
    'document.getElementById("malwa-sw-recover").onclick=function(){' +
    'var btn=document.getElementById("malwa-sw-recover");if(btn)btn.textContent="Recovering…";' +
    'var done=function(){try{localStorage.removeItem("malwa_ack_build");}catch(e){}go();};' +
    'var clearCaches=function(){if(!caches)return Promise.resolve();return caches.keys().then(function(keys){return Promise.all(keys.map(function(k){return caches.delete(k);}));});};' +
    'var unreg=function(){if(!navigator.serviceWorker)return Promise.resolve();return navigator.serviceWorker.getRegistrations().then(function(regs){return Promise.all(regs.map(function(r){return r.unregister();}));});};' +
    'Promise.all([clearCaches(),unreg()]).then(done).catch(done);' +
    '};})();</script></body></html>'
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
        // Always prefer the real network document. Cloudflare challenges / 403 / 5xx
        // must reach the browser — masking them as "Connection needed" bricks the PWA.
        try {
          const response = await fetch(request, { credentials: 'same-origin' });
          if (response) return response;
        } catch (e) {
          /* genuine offline / DNS / airplane mode */
        }

        try {
          const shell = await fetch(appShellUrl(), { credentials: 'same-origin' });
          if (shell && shell.ok) return shell;
        } catch (e) {
          /* fall through */
        }

        try {
          const cached = await caches.match(appShellUrl());
          if (cached) return cached;
          const cachedNav = await caches.match(request);
          if (cachedNav) return cachedNav;
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
        // JS/CSS: network-first so a poisoned cache cannot freeze the installed PWA on Loading…
        if (isScriptOrStyle(url)) {
          try {
            const response = await fetch(request, { credentials: 'same-origin' });
            if (response && response.ok) {
              cache.put(request, response.clone());
              return response;
            }
            // Pass through non-OK (e.g. 404 HTML) so the boot recovery UI can see the real failure.
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
  }
});
