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
}

export function getInstallState() {
  const standalone = isRunningStandalone();
  return {
    // Already running as the installed app — nothing to prompt for.
    isStandalone: standalone,
    // Installed at some point this session but still viewing it in a browser tab.
    justInstalled: installedThisSession && !standalone,
    // A native install prompt is ready to fire on click.
    canPromptInstall: Boolean(deferredPrompt),
    // Browsers only allow PWA install on HTTPS or localhost. On an insecure
    // origin (e.g. http://192.168.x.x over LAN) beforeinstallprompt never
    // fires, so we surface a targeted message instead of the generic one.
    isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : true,
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
  if (typeof navigator === 