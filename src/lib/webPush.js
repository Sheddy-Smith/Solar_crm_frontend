/**
 * Web Push helpers used by App shell (PWA / Android TWA).
 * Requires HTTPS (or localhost), a registered service worker, and backend VAPID keys.
 */

import { notificationApi } from '../api.js';

const PUSH_PREF_KEY = 'malwa_push_alerts_enabled';

export function getNotificationPermission() {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

async function getServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export async function ensureWebPushSubscription() {
  if (typeof window === 'undefined') return { ok: false, reason: 'unsupported' };
  if (!('PushManager' in window) || typeof Notification === 'undefined') {
    return { ok: false, reason: 'unsupported' };
  }
  if (import.meta.env.DEV) {
    // Vite HMR unregisters SW in local dev — background push cannot be verified here.
    return { ok: false, reason: 'dev_no_service_worker' };
  }

  let prefOn = true;
  try {
    const raw = localStorage.getItem(PUSH_PREF_KEY);
    if (raw === '0' || raw === 'false') prefOn = false;
  } catch {
    /* ignore */
  }
  if (!prefOn) return { ok: false, reason: 'disabled' };

  if (Notification.permission === 'denied') return { ok: false, reason: 'denied' };
  if (Notification.permission === 'default') {
    const result = await Notification.requestPermission();
    if (result !== 'granted') return { ok: false, reason: result === 'denied' ? 'denied' : 'default' };
  }

  const registration = await getServiceWorkerRegistration();
  if (!registration?.pushManager) return { ok: false, reason: 'no_service_worker' };

  let vapid;
  try {
    vapid = await notificationApi.pushVapidPublicKey();
  } catch {
    return { ok: false, reason: 'vapid_unavailable' };
  }
  if (!vapid?.configured || !vapid?.publicKey) return { ok: false, reason: 'vapid_unavailable' };

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
    });
  }

  const json = subscription.toJSON();
  await notificationApi.savePushSubscription({
    endpoint: json.endpoint,
    keys: json.keys,
  });
  return { ok: true, subscription };
}

export async function syncWebPushWithSettings(enabled) {
  try {
    localStorage.setItem(PUSH_PREF_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (!enabled) {
    try {
      const registration = await getServiceWorkerRegistration();
      const subscription = await registration?.pushManager?.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe().catch(() => {});
        await notificationApi.deletePushSubscription(endpoint).catch(() => {});
      } else {
        await notificationApi.deletePushSubscription().catch(() => {});
      }
    } catch {
      /* ignore */
    }
    return { ok: true, reason: 'disabled' };
  }
  return ensureWebPushSubscription();
}

/** Foreground OS banner when CRM tab is open and permission is granted. */
export function showForegroundNotification({ title, body, url = '/', tag } = {}) {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission !== 'granted') return false;
  if (typeof document !== 'undefined' && document.visibilityState === 'visible' && document.hasFocus?.()) {
    // Still show a quiet system notification so desktop matches Amazon-style tray alerts.
  }
  try {
    const n = new Notification(title || 'Malwa Solar CRM', {
      body: body || '',
      tag: tag || `malwa-${Date.now()}`,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      data: { url },
    });
    n.onclick = () => {
      try {
        window.focus();
        if (url) window.location.assign(url);
      } catch {
        /* ignore */
      }
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}
