// Silent backend keep-alive — pings /health/ every 14 minutes so the Render
// free-tier backend (which sleeps after 15 idle minutes) stays awake.
//
// Deliberately NOT a React hook/component: this module never touches React
// state, stores, caches or the DOM, so a ping can never cause a re-render,
// reset a form, close a modal or change the route. The response body is
// ignored; failures are swallowed (debug log only) and the next interval
// continues normally. Browser clears the timer automatically on tab close.
const PING_INTERVAL_MS = 14 * 60 * 1000;
const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

// Timer id lives on window so a Vite HMR re-evaluation of this module (dev)
// can't stack a duplicate interval on top of the old one.
const TIMER_KEY = '__malwaKeepAliveTimer';

function ping() {
  // Raw fetch on purpose — bypasses api.js `request()` so there is no auth
  // header, no token-refresh logic and no 20s abort timer involved.
  fetch(`${API_BASE}/health/`, { method: 'GET', cache: 'no-store' })
    .catch(() => {
      if (import.meta.env.DEV) console.debug('[keep-alive] ping failed; will retry next interval');
    });
}

export function startKeepAlive() {
  if (typeof window === 'undefined' || window[TIMER_KEY]) return;
  window[TIMER_KEY] = window.setInterval(ping, PING_INTERVAL_MS);
}

export function stopKeepAlive() {
  if (typeof window === 'undefined' || !window[TIMER_KEY]) return;
  window.clearInterval(window[TIMER_KEY]);
  window[TIMER_KEY] = null;
}
