/**
 * Web-release update detection for Malwa Solar CRM (TWA / PWA / browser).
 *
 * Design:
 *   - Source of truth for "what's live" = ./version.json (no-cache fetch).
 *   - Running app identity = VITE_BUILD_ID / meta[name=malwa-build-id].
 *   - Service worker waiting worker is a secondary signal; activation is
 *     user-driven (SKIP_WAITING) so we never mix old HTML with new chunks mid-edit.
 *
 * Native APK / Bubblewrap wrapper changes cannot be applied by this module —
 * those require a signed APK/AAB via the existing download channel / Play.
 */

import { hasUnsavedWork } from './unsavedWork.js';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const DISMISS_PREFIX = 'malwa_update_dismissed_';
const APPLYING_KEY = 'malwa_update_applying';

const subscribers = new Set();
let started = false;
let latestInfo = null;
let waitingWorker = null;
let registration = null;
let popupOpen = false;
let checkTimer = null;

export function getRunningBuild() {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : {};
  const fromEnv = env && env.VITE_BUILD_ID ? env.VITE_BUILD_ID : '';
  let fromMeta = '';
  try {
    const meta = document.querySelector('meta[name="malwa-build-id"]');
    fromMeta = (meta && meta.getAttribute('content')) || '';
  } catch {
    /* ignore */
  }
  const buildId = String(fromEnv || fromMeta || 'dev');
  const releaseVersion = String((env && env.VITE_RELEASE_VERSION) || '0.0.0');
  return { buildId, releaseVersion };
}

function notify() {
  const snapshot = getUpdateState();
  subscribers.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {
      /* ignore */
    }
  });
}

function isDismissed(buildId) {
  if (!buildId) return false;
  try {
    return sessionStorage.getItem(DISMISS_PREFIX + buildId) === '1';
  } catch {
    return false;
  }
}

function markDismissed(buildId) {
  try {
    sessionStorage.setItem(DISMISS_PREFIX + buildId, '1');
  } catch {
    /* ignore */
  }
}

export function getUpdateState() {
  const current = getRunningBuild();
  const available = Boolean(
    latestInfo
      && latestInfo.buildId
      && latestInfo.buildId !== current.buildId
      && !isDismissed(latestInfo.buildId),
  );
  return {
    current,
    latest: latestInfo,
    updateAvailable: available,
    popupOpen: available && popupOpen,
    waitingWorker: Boolean(waitingWorker),
    hasUnsavedWork: hasUnsavedWork(),
  };
}

export function subscribeAppUpdate(fn) {
  subscribers.add(fn);
  fn(getUpdateState());
  return () => subscribers.delete(fn);
}

function removeEarlyOverlay() {
  try {
    const el = document.getElementById('malwa-early-update');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  } catch {
    /* ignore */
  }
}

function openPopupIfNeeded() {
  const state = getUpdateState();
  if (state.updateAvailable && !popupOpen) {
    popupOpen = true;
    try {
      window.__MALWA_REACT_UPDATE_UI__ = true;
    } catch {
      /* ignore */
    }
    removeEarlyOverlay();
    notify();
  } else {
    notify();
  }
}

export function dismissUpdateLater() {
  if (latestInfo && latestInfo.buildId) markDismissed(latestInfo.buildId);
  popupOpen = false;
  notify();
}

async function activateWaitingWorker() {
  if (!waitingWorker) return false;
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    const onControllerChange = () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      done(true);
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    try {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } catch {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      done(false);
      return;
    }
    // Fallback if controllerchange never fires (already controlling).
    window.setTimeout(() => done(Boolean(navigator.serviceWorker.controller)), 2500);
  });
}

/**
 * Apply the web update: activate waiting SW (if any), then reload.
 * Returns { ok, reason } — never clears auth / CRM storage.
 */
export async function applyAppUpdate({ force = false } = {}) {
  if (!force && hasUnsavedWork()) {
    return { ok: false, reason: 'unsaved' };
  }
  try {
    sessionStorage.setItem(APPLYING_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  await activateWaitingWorker();
  // Also nudge every registration (already-installed TWA may have a waiting worker).
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      regs.forEach((reg) => {
        if (reg.waiting) {
          try {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          } catch {
            /* ignore */
          }
        }
      });
    }
  } catch {
    /* ignore */
  }
  // Clear only CRM Cache Storage namespaces — never auth / IndexedDB / form drafts.
  try {
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.indexOf('malwa-solar-crm-') === 0)
          .map((k) => caches.delete(k)),
      );
    }
  } catch {
    /* ignore */
  }
  const url = window.location.href.split('#')[0];
  const sep = url.indexOf('?') >= 0 ? '&' : '?';
  window.location.replace(`${url}${sep}malwa_updated=${Date.now()}`);
  return { ok: true, reason: 'reloading' };
}

async function fetchLatestVersion() {
  const url = `./version.json?t=${Date.now()}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  });
  if (!res.ok) throw new Error(`version.json HTTP ${res.status}`);
  const data = await res.json();
  if (!data || typeof data.buildId !== 'string' || !data.buildId) {
    throw new Error('version.json missing buildId');
  }
  return {
    buildId: data.buildId,
    releaseVersion: String(data.releaseVersion || data.version || ''),
    releaseNotes: String(data.releaseNotes || ''),
    generatedAt: data.generatedAt || null,
    requiresApkUpdate: Boolean(data.requiresApkUpdate),
    apkPackage: data.apkPackage || 'com.ecomalwa.crm',
  };
}

export async function checkForAppUpdate() {
  try {
    const remote = await fetchLatestVersion();
    latestInfo = remote;
    const current = getRunningBuild();
    if (remote.buildId !== current.buildId && !isDismissed(remote.buildId)) {
      openPopupIfNeeded();
    } else {
      popupOpen = false;
      notify();
    }
    return getUpdateState();
  } catch {
    // Offline / endpoint error — never show a false update.
    notify();
    return getUpdateState();
  }
}

function attachRegistration(reg) {
  registration = reg;
  if (reg.waiting) {
    if (navigator.serviceWorker.controller) {
      waitingWorker = reg.waiting;
      openPopupIfNeeded();
    } else {
      // First install: activate immediately so installability works.
      try {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      } catch {
        /* ignore */
      }
    }
  }
  reg.addEventListener('updatefound', () => {
    const installing = reg.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed') {
        if (navigator.serviceWorker.controller) {
          waitingWorker = installing;
          // Prefer version.json confirmation; still surface SW-ready state.
          checkForAppUpdate();
        } else {
          try {
            installing.postMessage({ type: 'SKIP_WAITING' });
          } catch {
            /* ignore */
          }
        }
      }
    });
  });
}

async function pollServiceWorkerUpdate() {
  if (!registration || typeof registration.update !== 'function') return;
  try {
    await registration.update();
  } catch {
    /* ignore */
  }
}

/**
 * Start listeners once (from main.jsx). Safe to call repeatedly.
 */
export function startAppUpdateMonitor(getRegistration) {
  if (started || typeof window === 'undefined') return;
  started = true;

  const runCheck = () => {
    checkForAppUpdate();
    pollServiceWorkerUpdate();
  };

  // Fast first probe so already-open / TWA sessions see the popup quickly.
  window.setTimeout(runCheck, 600);
  window.setTimeout(runCheck, 3000);
  checkTimer = window.setInterval(runCheck, CHECK_INTERVAL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') runCheck();
  });
  window.addEventListener('online', runCheck);
  window.addEventListener('focus', runCheck);
  window.addEventListener('pageshow', (event) => {
    if (event && event.persisted) runCheck();
  });

  Promise.resolve()
    .then(() => (typeof getRegistration === 'function' ? getRegistration() : null))
    .then((reg) => {
      if (reg) attachRegistration(reg);
    })
    .catch(() => {});

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((reg) => attachRegistration(reg)).catch(() => {});
    navigator.serviceWorker.addEventListener('message', (event) => {
      const data = event && event.data;
      if (data && (data.type === 'MALWA_SW_WAITING' || data.type === 'MALWA_SW_ACTIVATED')) {
        checkForAppUpdate();
      }
    });
  }
}

export function stopAppUpdateMonitorForTests() {
  started = false;
  if (checkTimer) window.clearInterval(checkTimer);
  checkTimer = null;
}
