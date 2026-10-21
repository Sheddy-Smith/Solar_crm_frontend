// Singleton PWA "Add to Home Screen" install manager.
//
// This module is evaluated exactly once by the bundler (ES modules are
// cached), so the `beforeinstallprompt` / `appinstalled` listeners below are
// attached exactly once for the lifetime of the page — no matter how many
// times consuming components mount/unmount/re-render via `usePwaInstall()`.

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

/** Clear stale "installed" marks after the user deletes the app / PWA. */
export function clearInstalledMarks() {
  installedThisSession = false;
  installedAppDetected = false;
  writeInstalledFlag(false);
  notify();
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
  // Chrome offering install again ⇒ previous install marks are stale.
  clearInstalledMarks();
  deferredPrompt = event;
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
  if (isRunningStandalone()) writeInstalledFlag(true);
  else if (installedFlagCached) {
    // Browser tab + leftover flag from a deleted install — do not trust yet;
    // refreshInstalledRelatedApps() will confirm or clear.
  }
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

  refreshInstalledRelatedApps();

  // After user deletes the home-screen app and returns to Chrome, re-check.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshInstalledRelatedApps();
  });
}

/**
 * Re-query getInstalledRelatedApps.
 * If nothing is installed and we are not in a standalone window, clear stale
 * localStorage so Download / Install works again without clearing history.
 */
export function refreshInstalledRelatedApps() {
  if (typeof navigator === 'undefined' || !('getInstalledRelatedApps' in navigator)) {
    if (!isRunningStandalone() && !deferredPrompt) {
      // No API — never block Android download on a leftover flag alone.
      if (installedFlagCached && !isRunningStandalone()) {
        /* keep flag only as soft hint; getInstallState ignores flag-only */
      }
    }
    return Promise.resolve(false);
  }
  return navigator
    .getInstalledRelatedApps()
    .then((apps) => {
      const found = Array.isArray(apps) && apps.length > 0;
      if (found) {
        installedAppDetected = true;
        writeInstalledFlag(true);
      } else if (!isRunningStandalone()) {
        // App / PWA removed — allow reinstall / APK download immediately.
        installedAppDetected = false;
        installedThisSession = false;
        writeInstalledFlag(false);
      }
      notify();
      return found;
    })
    .catch(() => false);
}

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
  // Trust only live signals — NOT localStorage alone (that forced "App status"
  // after delete until the user cleared browser history).
  const liveInstalled = Boolean(standalone || installedThisSession || installedAppDetected);
  return {
    isStandalone: standalone,
    justInstalled: liveInstalled && !standalone,
    isInstalled: liveInstalled,
    canPromptInstall: Boolean(deferredPrompt),
    supportsNativePrompt: typeof window !== 'undefined' && 'onbeforeinstallprompt' in window,
    /** Soft leftover flag — UI may ignore; Android download must not. */
    hadInstalledFlag: installedFlagCached || readInstalledFlag(),
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
      const base = appBasePath();
      const buildId = import.meta.env.VITE_BUILD_ID || 'dev';
      const swUrl = `${base}sw-${encodeURIComponent(buildId)}.js`;
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) =>
          Promise.all(
            regs.map((reg) => {
              const script = reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || '';
              if (script.includes('/sw.js') || (script.includes('/sw-') && !script.includes(`/sw-${buildId}.js`))) {
                return reg.unregister();
              }
              return null;
            }),
          ),
        )
        .catch(() => {})
        .then(() => navigator.serviceWorker.register(swUrl, { scope: base }))
        .then((reg) => {
          try {
            reg.update();
          } catch {
            /* ignore */
          }
          resolve(reg);
        })
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
