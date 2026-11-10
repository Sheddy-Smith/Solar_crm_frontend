import { settingsApi, tokenStore } from '../api.js';

const MAX_PER_SESSION = 30;
const sent = new Set();
let posted = 0;

function portalLabel() {
  const path = window.location.pathname || '';
  return path.startsWith('/tele') ? 'Tele Portal' : 'CRM';
}

function pagePath() {
  return `${portalLabel()} ${window.location.pathname || '/'}${window.location.search || ''}`.slice(0, 480);
}

function fingerprint(title, path) {
  const raw = `${title}|${path.split('?')[0]}`.slice(0, 180);
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  return `auto-${hash.toString(16)}`;
}

function formatArg(value) {
  if (value instanceof Error) return value.stack || value.message || String(value);
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function shouldSkip(text) {
  const value = String(text || '').toLowerCase();
  if (!value.trim()) return true;
  return (
    value.includes('bug-reports')
    || value.includes('resizeobserver')
    || value.includes('vite_api_url is not set')
    || value.includes('script error')
    || value.includes('chrome-extension://')
    || value.includes('moz-extension://')
    // Transient PWA update noise (stale hashed SW → SPA HTML MIME). Root-fixed in .htaccess.
    || value.includes('failed to update a serviceworker')
    || value.includes('unsupported mime type')
    || (value.includes('serviceworker') && value.includes('invalid state'))
  );
}

function postAuto(title, body) {
  if (!tokenStore.getAccess() || posted >= MAX_PER_SESSION) return;
  const cleanTitle = String(title || 'Console error').replace(/\s+/g, ' ').trim().slice(0, 180) || 'Console error';
  if (shouldSkip(cleanTitle) || shouldSkip(body)) return;
  const path = pagePath();
  const key = fingerprint(cleanTitle, path);
  if (sent.has(key)) return;
  sent.add(key);
  posted += 1;
  settingsApi.bugReports.create({
    title: cleanTitle,
    body: String(body || cleanTitle).slice(0, 4000),
    path,
    source: 'auto',
    fingerprint: key,
  }).catch(() => {});
}

export function installConsoleBugCapture() {
  if (typeof window === 'undefined' || window.__malwaBugCapture) return;
  window.__malwaBugCapture = true;

  const originalError = console.error.bind(console);
  console.error = (...args) => {
    originalError(...args);
    const text = args.map(formatArg).join(' ').trim();
    const title = text.split('\n')[0] || 'Console error';
    postAuto(title, text);
  };

  window.addEventListener('error', (event) => {
    const title = event?.message || 'Window error';
    const where = event?.filename ? `${event.filename}:${event.lineno || 0}` : '';
    postAuto(title, [title, where, event?.error?.stack || ''].filter(Boolean).join('\n'));
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const title = reason?.message || (reason == null ? 'Unhandled rejection' : String(reason));
    postAuto(title, reason?.stack || title);
  });
}
