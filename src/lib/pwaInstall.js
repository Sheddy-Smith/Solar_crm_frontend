// Singleton PWA "Add to Home Screen" install manager.
//
// This module is evaluated exactly once by the bundler (ES modules are
// cached), so the `beforeinstallprompt` / `appinstalled` listeners below are
// attached exactly once for the lifetime of the page — no matter how many
// times consuming components mount/unmount/re-render via `usePwaInstall()`.
// That sidesteps the classic "duplicate listener" / memory-leak pitfall of
// registering these inside a component's `useEffect`.

const INSTALLED_FLAG_KEY = 'malwa_pwa_installed';

let deferredPrompt = null;
let installedThisSession = false;
let installedAppDetected = false;
let installedFlagCached = false;
const subscribers = new Set();

function readInstalledFlag() {
  try {
    return localStorage.getItem(INSTALLED_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

function writeInstalledFlag(on) {
  try {
    if (on) localStorage.setItem(INSTALLED_FLAG_KEY, '1');
    else localStorage.removeItem(INSTALLED_FLAG_KEY);
  } catch {
    /* ignore */
  }
  installedFlagCached = on;
}

function isRunningStandalone() {
  if (typeof window === 'undefined') return false;
  const standaloneMedia = window.matchMedia?.('(display-mode: standalone)')?.matches;
  const iosStandalone = window.navigator?.standalone === true;
  return Boolean(standaloneMedia || iosStandalone);
}

function notify() {
  subscribers.forEach((fn) => fn());
}

function captureDeferredPrompt(event) {
  if (!event) return;
  try {
    event.preventDefault();
  } catch {
    /* already prevented by early boot script */
  }
  deferredPrompt = event;
  // If Chrome offers install again, previous "installed" flag is stale.
  if (installedFlagCached) writeInstalledFlag(false);
  installedAppDetected = false;
  notify();
}

function syncEarlyDeferredPrompt() {
  if (typeof window === 'undefined') return;
  const early = window.__malwaDeferredPrompt;
  if (early) {
    captureDeferredPrompt(early);
    try {
      window.__malwaDeferredPrompt = null;
    } catch {
      /* ignore */
    }
  }
}

if (typeof window !== 'undefined') {
  installedFlagCached = readInstalledFlag();
  // Visiting the installed app window marks install for later browser-tab clicks.
  if (isRunningStandalone()) writeInstalledFlag(true);
  syncEarlyDeferredPrompt();

  window.addEventListener('beforeinstallprompt', (event) => {
    captureDeferredPrompt(event);
  });

  window.addEventListener('appinstalled', () => {
    installedThisSession = true;
    deferredPrompt = null;
    writeInstalledFlag(true);
    notify();
  });

  // Chrome/Edge don't fire beforeinstallprompt when the PWA is ALREADY
  // installed — without this check the button would wrongly show the
  // how-to guide. Requires `related_applications` with a "webapp" entry.
  refreshInstalledRelatedApps();
}

/** Re-query getInstalledRelatedApps (call before treating as "not installed"). */
export function refreshInstalledRelatedApps() {
  if (typeof navigator === 'undefined' || !('getInstalledRelatedApps' in navigator)) {
    return Promise.resolve(false);
  }
  return navigator
    .getInstalledRelatedApps()
    .then((apps) => {
      const found = Array.isArray(apps) && apps.length > 0;
      if (found) {
        installedAppDetected = true;
        writeInstalledFlag(true);
        notify();
      }
      return found;
    })
    .catch(() => false);
}

/**
 * Wait until beforeinstallprompt is available (or timeout).
 * BIP often arrives shortly after the SW is ready.
 */
export function waitForInstallPrompt(timeoutMs = 2000) {
  syncEarlyDeferredPrompt();
  if (deferredPrompt) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsub();
      resolve(ok);
    };
    const unsub = subscribeInstallState(() => {
      if (deferredPrompt) done(true);
    });
    const timer = setTimeout(() => {
      syncEarlyDeferredPrompt();
      done(Boolean(deferredPrompt));
    }, Math.max(0, timeoutMs));
  });
}

export function getInstallState() {
  syncEarlyDeferredPrompt();
  const standalone = isRunningStandalone();
  const flagInstalled = installedFlagCached || readInstalledFlag();
  const detected = installedThisSession || installedAppDetected || flagInstalled;
  return {
    // Already running as the installed app — nothing to prompt for.
    isStandalone: standalone,
    // App is installed on this device but currently viewed in a browser tab.
    justInstalled: detected && !standalone,
    // Installed either as standalone window or detected related webapp/APK.
    isInstalled: Boolean(standalone || detected),
    // A native install prompt is ready to fire on click.
    canPromptInstall: Boolean(deferredPrompt),
    // Chromium-style browser that supports the native install flow at all.
    supportsNativePrompt: typeof window !== 'undefined' && 'onbeforeinstallprompt' in window,
  };
}

export function subscribeInstallState(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

export async function promptInstall() {
  syncEarlyDeferredPrompt();
  if (!deferredPrompt) return { outcome: 'unavailable' };
  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  notify();
  try {
    promptEvent.prompt();
  } catch {
    return { outcome: 'unavailable' };
  }
  const choice = await promptEvent.userChoice;
  if (choice.outcome === 'accepted') {
    installedThisSession = true;
    writeInstalledFlag(true);
  }
  notify();
  return choice;
}

// Registered from main.jsx once at boot. Guarded so calling it more than
// once (e.g. hot reload) never attaches a second registration.
let swRegistrationStarted = false;
let swRegistrationPromise = null;

function appBasePath() {
  if (typeof window !== 'undefined' && window.__MALWA_APP_BASE__) {
    return String(window.__MALWA_APP_BASE__);
  }
  try {
    const el = document.querySelector('base[href]');
    if (el) {
      const u = new URL(el.href, window.location.origin);
      let path = u.pathname || '/';
      if (!path.endsWith('/')) path += '/';
      return path;
    }
  } catch {
    /* ignore */
  }
  const path = (typeof window !== 'undefined' && window.location.pathname) || '/';
  return /^\/crm(\/|$)/i.test(path) ? '/crm/' : '/';
}

/** @returns {Promise<ServiceWorkerRegistration|null>} */
export function registerServiceWorker() {
  if (swRegistrationStarted) return swRegistrationPromise || Promise.resolve(null);
  swRegistrationStarted = true;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    swRegistrationPromise = Promise.resolve(null);
    return swRegistrationPromise;
  }

  swRegistrationPromise = new Promise((resolve) => {
    const start = () => {
      // Root-absolute SW URL (via <base> / __MALWA_APP_BASE__) so /tele/leads
      // and /leads never register a broken nested scope.
      const base = appBasePath();
      const swUrl = `${base}sw.js?v=${encodeURIComponent(import.meta.env.VITE_BUILD_ID || 'dev')}`;
      navigator.serviceWorker
        .register(swUrl, { scope: base })
        .then((reg) => resolve(reg))
        .catch(() => resolve(null));
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
  });
  return swRegistrationPromise;
}

export function getServiceWorkerRegistration() {
  return swRegistrationPromise || Promise.resolve(null);
}
