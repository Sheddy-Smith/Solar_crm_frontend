export async function getStorageDiagnostics() {
  const localKeys = [];
  const sessionKeys = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k) localKeys.push(k);
    }
  } catch {
    /* ignore */
  }
  try {
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      if (k) sessionKeys.push(k);
    }
  } catch {
    /* ignore */
  }

  let estimate = null;
  try {
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      estimate = { usage: e.usage || 0, quota: e.quota || 0 };
    }
  } catch {
    estimate = null;
  }

  let sw = { supported: 'serviceWorker' in navigator, controller: false, registrations: 0 };
  try {
    if (sw.supported) {
      const regs = await navigator.serviceWorker.getRegistrations();
      sw = {
        supported: true,
        controller: Boolean(navigator.serviceWorker.controller),
        registrations: regs.length,
        scope: regs[0]?.scope || null,
      };
    }
  } catch {
    /* ignore */
  }

  return {
    localStorageKeys: localKeys.filter((k) => !/token|password|refresh|access/i.test(k) || k.startsWith('malwa-solar-crm:')),
    sessionStorageKeys: sessionKeys,
    estimate,
    serviceWorker: sw,
    cachesSupported: typeof caches !== 'undefined',
  };
}

export async function clearApplicationCaches({ keepAuth = true } = {}) {
  const report = { cachesDeleted: 0, localRemoved: [], keptAuth: keepAuth };
  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      report.cachesDeleted = keys.length;
    }
  } catch (err) {
    report.cacheError = err?.message || String(err);
  }

  const keep = new Set(
    keepAuth
      ? ['malwa_access', 'malwa_refresh', 'malwa-solar-crm:animation-scales', 'malwa-solar-crm:ui-preferences', 'malwa-solar-crm:i18n']
      : [],
  );
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && !keep.has(k) && (k.startsWith('malwa') || k.startsWith('malwa-solar'))) toRemove.push(k);
    }
    toRemove.forEach((k) => {
      if (!keep.has(k)) {
        localStorage.removeItem(k);
        report.localRemoved.push(k);
      }
    });
  } catch (err) {
    report.localError = err?.message || String(err);
  }
  return report;
}

export function resetLocalDeveloperSettings() {
  const removed = [];
  [
    'malwa-solar-crm:developer-mode',
    'malwa-solar-crm:developer-mode-focus',
    'malwa-solar-crm:dev-network-sim',
    'malwa-solar-crm:dev-ui-controls',
  ].forEach((k) => {
    try {
      sessionStorage.removeItem(k);
      removed.push(k);
    } catch {
      /* ignore */
    }
  });
  return { removed };
}

export function buildDiagnosticReport({ apiSnapshot, perf, logs, storage, appInfo }) {
  return {
    generatedAt: new Date().toISOString(),
    app: appInfo,
    performance: perf,
    api: {
      totals: apiSnapshot?.totals,
      byStatus: apiSnapshot?.byStatus,
      slowest: (apiSnapshot?.slowest || []).map((e) => ({
        method: e.method,
        path: e.path,
        status: e.status,
        durationMs: e.durationMs,
      })),
    },
    logs: (logs || []).slice(0, 100).map((l) => ({
      level: l.level,
      category: l.category,
      message: l.message,
      ts: l.ts,
    })),
    storage: {
      estimate: storage?.estimate,
      serviceWorker: storage?.serviceWorker,
      localKeyCount: storage?.localStorageKeys?.length,
    },
  };
}
