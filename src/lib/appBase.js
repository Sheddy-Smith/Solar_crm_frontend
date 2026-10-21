/**
 * App document root for dual-host deploys:
 *   https://crm.ecomalwa.com/…     → /
 *   https://ecomalwa.com/crm/…     → /crm/
 *
 * Path-based SPA routes (/leads, /tele/…, /om/…) must NOT be treated as the
 * asset root — otherwise relative ./assets/* resolve to /tele/assets/* and
 * the server returns index.html (Unexpected token '<'), killing PWA install.
 */

export function getAppBasePath() {
  if (typeof window === 'undefined') return '/';
  try {
    const el = document.querySelector('base[href]');
    if (el && el.href) {
      const u = new URL(el.href, window.location.origin);
      let path = u.pathname || '/';
      if (!path.endsWith('/')) path += '/';
      return path;
    }
  } catch {
    /* fall through */
  }
  const path = window.location.pathname || '/';
  if (/^\/crm(\/|$)/i.test(path)) return '/crm/';
  return '/';
}

/** Absolute URL under the app root, e.g. urlUnderAppBase('downloads/malwa-solar.apk'). */
export function urlUnderAppBase(relativePath = '') {
  const base = getAppBasePath();
  const rel = String(relativePath || '').replace(/^\.\//, '').replace(/^\//, '');
  if (typeof window === 'undefined') return `${base}${rel}`;
  return new URL(rel, `${window.location.origin}${base}`).href;
}
