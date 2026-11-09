const MAX_LOGS = 500;
const LISTENERS = new Set();
/** @type {Array<object>} */
let logs = [];

const SENSITIVE = /password|token|authorization|refresh|cookie|otp|secret|access[_-]?key/i;

export function maskSensitive(value, depth = 0) {
  if (value == null || depth > 4) return value;
  if (typeof value === 'string') {
    if (value.length > 24 && /^[A-Za-z0-9\-_.]+$/.test(value) && value.split('.').length === 3) {
      return `${value.slice(0, 8)}…[masked]`;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => maskSensitive(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE.test(k) ? '[masked]' : maskSensitive(v, depth + 1);
    }
    return out;
  }
  return value;
}

function notify() {
  LISTENERS.forEach((fn) => {
    try {
      fn(logs);
    } catch {
      /* ignore */
    }
  });
}

export function subscribeDebugLogs(listener) {
  LISTENERS.add(listener);
  return () => LISTENERS.delete(listener);
}

export function getDebugLogs() {
  return logs.slice();
}

export function clearDebugLogs() {
  logs = [];
  notify();
}

export function pushDebugLog({ level = 'INFO', message, category = 'app', meta } = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level: String(level || 'INFO').toUpperCase(),
    category,
    message: String(message || ''),
    meta: meta ? maskSensitive(meta) : undefined,
    ts: new Date().toISOString(),
  };
  logs = [entry, ...logs].slice(0, MAX_LOGS);
  notify();
  return entry;
}

export function exportDebugLogs(filterFn) {
  const rows = typeof filterFn === 'function' ? logs.filter(filterFn) : logs;
  return JSON.stringify(rows, null, 2);
}

let installed = false;
export function installDebugLogBridge() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (event) => {
    pushDebugLog({
      level: 'ERROR',
      category: 'javascript',
      message: event.message || 'Window error',
      meta: { filename: event.filename, lineno: event.lineno, colno: event.colno },
    });
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    pushDebugLog({
      level: 'CRITICAL',
      category: 'promise',
      message: reason?.message || String(reason || 'Unhandled rejection'),
      meta: { name: reason?.name },
    });
  });
}
