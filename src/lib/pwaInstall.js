// Singleton PWA "Add to Home Screen" install manager.
//
// This module is evaluated exactly once by the bundler (ES modules are
// cached), so the `beforeinstallprompt` / `appinstalled` listeners below are
// attached exactly once for the lifetime of the page — no matter how many
// times consuming components mount/unmount/re-render via `usePwaInstall()`.
// That sidesteps the classic "duplicate listener" / memory-leak pitfall of
// registering these inside a component's `useEffect`.

let deferredPrompt = null;
let installedThisSession = false;
let installedAppDetected = false;
const subscribers = new Set();

function isRunningStandalone() {
  if (typeof window === 'undefined') return false;
  const standaloneMedia = window.matchMedia?.('(display-mode: standalone)')?.matches;
  const iosStandalone = window.navigator?.standalone === true;
  return Boolean(standaloneMedia || iosStandalone);
}

function notify() {
  subscribers.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    installedThisSession = true;
    deferredPrompt = null;
    notify();
  });

  // Chrome/Edge don't fire beforeinstallprompt when the PWA is ALREADY
  // installed — without this check the button would wrongly report "browser
  // doesn't support installation". Requires `related_applications` with a
  // "webapp" entry in the manifest. Fails silently where unsupported.
  if ('getInstalledRelatedApps' in navigator) {
    navigator
      .getInstalledRelatedApps()
      .then((apps) => {
        if (Array.isArray(apps) && apps.length > 0) {
          installedAppDetected = true;
          notify();
        }
      })
      .catch(() => {});
  }
}

export function getInstallState() {
  const standalone = isRunningStandalone();
  const alreadyInstalled = (installedThisSession || installedAppDetected) && !standalone;
  return {
    // Already running as the installed app — nothing to prompt for.
    isStandalone: standalone,
    // App is installed on this device but currently viewed in a browser tab.
    justInstalled: alreadyInstalled,
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
  if (!deferredPrompt) return { outcome: 'unavailable' };
  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  notify();
  promptEvent.prompt();
  const choice = await promptEvent.userChoice;
  if (choice.outcome === 'accepted') {
    installedThisSession = true;
  }
  notify();
  return choice;
}

// Registered from main.jsx once at boot. Guarded so calling it more than
// once (e.g. hot reload) never attaches a second registration.
let swRegistrationStarted = false;
export function registerServiceWorker() {
  if (swRegistrationStarted) return;
  swRegistrationStarted = true;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Non-fatal — the app works fully without the offline fallback the
      // service worker provides; we just quietly skip it.
    });
  });
}
