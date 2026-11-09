import { maskSensitive, pushDebugLog } from './debugLogger.js';

const MAX = 200;
const LISTENERS = new Set();
/** @type {Array<object>} */
let entries = [];
let totals = { count: 0, failed: 0, totalMs: 0 };

function notify() {
  LISTENERS.forEach((fn) => {
    try {
      fn(getApiInspectorSnapshot());
    } catch {
      /* ignore */
    }
  });
}

export function subscribeApiInspector(listener) {
  LISTENERS.add(listener);
  return () => LISTENERS.delete(listener);
}

export function getApiInspectorSnapshot() {
  const avg = totals.count ? Math.round(totals.totalMs / totals.count) : 0;
  const byStatus = {};
  entries.forEach((e) => {
    const k = String(e.status || 'ERR');
    byStatus[k] = (byStatus[k] || 0) + 1;
  });
  const slowest = entries.slice().sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0)).slice(0, 8);
  return {
    entries: entries.slice(),
    totals: { ...totals, avgMs: avg },
    byStatus,
    slowest,
  };
}

export function clearApiInspector() {
  entries = [];
  totals = { count: 0, failed: 0, totalMs: 0 };
  notify();
}

export function recordApiCall( partial ) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    method: (partial.method || 'GET').toUpperCase(),
    path: String(partial.path || ''),
    status: partial.status ?? null,
    ok: Boolean(partial.ok),
    durationMs: Math.max(0, Math.round(partial.durationMs || 0)),
    requestBytes: partial.requestBytes ?? null,
    responseBytes: partial.responseBytes ?? null,
    error: partial.error ? String(partial.error) : null,
    ts: new Date().toISOString(),
    meta: maskSensitive(partial.meta || {}),
  };
  entries = [entry, ...entries].slice(0, MAX);
  totals.count += 1;
  totals.totalMs += entry.durationMs;
  if (!entry.ok) totals.failed += 1;
  if (!entry.ok) {
    pushDebugLog({
      level: entry.status && entry.status >= 500 ? 'CRITICAL' : 'WARNING',
      category: 'api',
      message: `${entry.method} ${entry.path} → ${entry.status || 'ERR'} (${entry.durationMs}ms)`,
      meta: { error: entry.error },
    });
  }
  notify();
  return entry;
}

/** Apply network simulator delay before fetch when active. */
export async function maybeSimulateNetwork(path, method) {
  const sim = getNetworkSimulatorState();
  if (!sim.active) return { proceed: true };
  if (sim.offline) {
    const err = new Error('Network simulator: offline');
    recordApiCall({ method, path, status: 0, ok: false, durationMs: 0, error: err.message });
    throw err;
  }
  if (sim.delayMs > 0) {
    await new Promise((r) => setTimeout(r, sim.delayMs));
  }
  if (sim.httpError) {
    const err = new Error(`Network simulator: HTTP ${sim.httpError}`);
    recordApiCall({ method, path, status: sim.httpError, ok: false, durationMs: sim.delayMs, error: err.message });
    throw err;
  }
  if (sim.timeout) {
    const err = new Error('Network simulator: request timeout');
    recordApiCall({ method, path, status: 0, ok: false, durationMs: sim.delayMs, error: err.message });
    throw err;
  }
  return { proceed: true };
}

const SIM_KEY = 'malwa-solar-crm:dev-network-sim';
let simState = {
  active: false,
  offline: false,
  delayMs: 0,
  httpError: null,
  timeout: false,
  unstable: false,
};

function loadSim() {
  try {
    const raw = sessionStorage.getItem(SIM_KEY);
    if (raw) simState = { ...simState, ...JSON.parse(raw), active: Boolean(JSON.parse(raw).active) };
  } catch {
    /* ignore */
  }
}
loadSim();

export function getNetworkSimulatorState() {
  return { ...simState };
}

export function setNetworkSimulatorState(patch) {
  simState = { ...simState, ...patch };
  try {
    sessionStorage.setItem(SIM_KEY, JSON.stringify(simState));
  } catch {
    /* ignore */
  }
  notify();
  return getNetworkSimulatorState();
}

export function resetNetworkSimulator() {
  simState = { active: false, offline: false, delayMs: 0, httpError: null, timeout: false, unstable: false };
  try {
    sessionStorage.removeItem(SIM_KEY);
  } catch {
    /* ignore */
  }
  notify();
}
