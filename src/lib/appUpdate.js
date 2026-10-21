/**
 * Web-release update detection for Malwa Solar CRM (TWA / PWA / browser).
 *
 * Why localStorage ack (not only running===remote):
 *   After a deploy, network-first HTML often loads the NEW build immediately,
 *   so runningBuild === version.json and a mismatch-only popup never appears.
 *   We show the Update CRM dialog whenever the live buildId differs from the
 *   last build the user acknowledged — including already-installed devices.
 */

import { hasUnsavedWork } from './unsavedWork.js';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const DISMISS_PREFIX = 'malwa_update_dismissed_';
const ACK_BUILD_KEY = 'malwa_ack_build';
const ACK_RELEASE_KEY = 'malwa_ack_release';
const APPLYING_KEY = 'malwa_update_applying';

const subscribers = new Set();
let started = false;
let latestInfo = null;
let waitingWorker = null;
let registration = null;
let popupOpen = false;
let forceShowPopup = false;
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

function getAckedBuild() {
  try {
    return localStorage.getItem(ACK_BUILD_KEY) || '';
  } catch {
    return '';
  }
}

function getAckedRelease() {
  try {
    return localStorage.getItem(ACK_RELEASE_KEY) || '';
  } catch {
    return '';
  }
}

export function acknowledgeBuild(buildId, releaseVersion) {
  if (!buildId) return;
  try {
    localStorage.setItem(ACK_BUILD_KEY, buildId);
    if (releaseVersion) localStorage.setItem(ACK_RELEASE_KEY, String(releaseVersion));
  } catch {
    /* ignore */
  }
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

function needsUpdatePrompt(remote) {
  if (!remote || !remote.buildId) return false;
  if (isDismissed(remote.buildId)) return false;
  const acked = getAckedBuild();
  const running = getRunningBuild();
  // First successful boot: remember current build quietly (no popup spam / blank PWA).
  if (!acked) {
    acknowledgeBuild(running.buildId, running.releaseVersion);
    return remote.buildId !== running.buildId;
  }
  // Show when user last acknowledged an older release than what is live now.
  return remote.buildId !== acked;
}

export function getUpdateState() {
  const running = getRunningBuild();
  const ackedBuild = getAckedBuild();
  const available = Boolean(latestInfo && needsUpdatePrompt(latestInfo));
  const shellStale = Boolean(latestInfo && latestInfo.buildId !== running.buildId);
  const show = Boolean(popupOpen && latestInfo && (available || forceShowPopup || shellStale));
  return {
    current: {
      buildId: ackedBuild || running.buildId,
      releaseVersion: getAckedRelease() || running.releaseVersion,
    },
    running,
    latest: latestInfo,
    updateAvailable: available || shellStale,
    popupOpen: show,
    alreadyOnLatest: Boolean(latestInfo && latestInfo.buildId === running.buildId),
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
    if (!state.updateAvailable) popupOpen = false;
    notify();
  }
}

export function dismissUpdateLater() {
  if (latestInfo && latestInfo.buildId) markDismissed(latestInfo.buildId);
  popupOpen = false;
  forceShowPopup = false;
  try {
    window.__MALWA_REACT_UPDATE_UI__ = false;
  } catch {
    /* ignore */
  }
  notify();
}

/**
 * Used by “Add to Home Screen” when the app is already installed.
 * Returns { status: 'update' | 'uptodate' | 'error', running, latest }.
 */
export async function probeUpdateForInstallButton() {
  try {
    const remote = await fetchLatestVersion();
    latestInfo = remote;
    const running = getRunningBuild();
    if (remote.buildId !== running.buildId) {
      try {
        sessionStorage.removeItem(DISMISS_PREFIX + remote.buildId);
      } catch {
        /* ignore */
      }
      popupOpen = true;
      forceShowPopup = true;
      try {
        window.__MALWA_REACT_UPDATE_UI__ = true;
      } catch {
        /* ignore */
      }
      removeEarlyOverlay();
      notify();
      return { status: 'update', running, latest: remote };
    }
    acknowledgeBuild(remote.buildId, remote.releaseVersion);
    popupOpen = false;
    forceShowPopup = false;
    notify();
    return { status: 'uptodate', running, latest: remote };
  } catch (error) {
    return { status: 'error', error, running: getRunningBuild(), latest: latestInfo };
  }
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
    window.setTimeout(() => done(Boolean(navigator.serviceWorker.controller)), 2500);
  });
}

/**
 * Apply / acknowledge the web update. Never clears auth or CRM records.
 */
export async function applyAppUpdate({ force = false } = {}) {
  if (!force && hasUnsavedWork()) {
    return { ok: false, reason: 'unsaved' };
  }
  const remote = latestInfo;
  const running = getRunningBuild();
  if (remote && remote.buildId) {
    acknowledgeBuild(remote.buildId, remote.releaseVersion);
  } else {
    acknowledgeBuild(running.buildId, running.releaseVersion);
  }
  try {
    sessionStorage.setItem(APPLYING_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  await activateWaitingWorker();
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

  // Always reload once so installed TWA/PWA pick up the latest shell/assets.
  const url = window.location.href.split('#')[0].replace(/([?&])malwa_updated=\d+/g, '').replace(/[?&]$/, '');
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
    if (needsUpdatePrompt(remote)) {
      openPopupIfNeeded();
    } else {
      popupOpen = false;
      notify();
    }
    return getUpdateState();
  } catch {
    notify();
    return getUpdateState();
  }
}

function attachRegistration(reg) {
  registration = reg;
  if (reg.waiting) {
    waitingWorker = reg.waiting;
    try {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    } catch {
      /* ignore */
    }
    checkForAppUpdate();
  }
  reg.addEventListener('updatefound', () => {
    const installing = reg.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed') {
        waitingWorker = installing;
        try {
          installing.postMessage({ type: 'SKIP_WAITING' });
        } catch {
          /* ignore */
        }
        checkForAppUpdate();
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

export function startAppUpdateMonitor(getRegistration) {
  if (started || typeof window === 'undefined') return;
  started = true;

  const runCheck = () => {
    checkForAppUpdate();
    pollServiceWorkerUpdate();
  };

  window.setTimeout(runCheck, 400);
  window.setTimeout(runCheck, 2000);
  checkTimer = window.setInterval(runCheck, CHECK_INTERVAL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') runCheck();
  });
  window.addEventListener('online', runCheck);
  window.addEventListener('focus', runCheck);
  window.addEventListener('pageshow', () => runCheck());

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
