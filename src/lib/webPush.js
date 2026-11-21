/**
 * Web Push helpers used by App shell.
 * Full push pipeline is optional — these no-ops keep the CRM shell import-safe
 * when VAPID / SW / backend push endpoints are unavailable.
 */

export function getNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export async function ensureWebPushSubscription() {
  return { ok: false, reason: 'unavailable' };
}

export async function syncWebPushWithSettings() {
  return { ok: false, reason: 'unavailable' };
}
