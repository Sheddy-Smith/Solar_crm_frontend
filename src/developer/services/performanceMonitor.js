const LISTENERS = new Set();
let running = false;
let rafId = 0;
let lastTs = 0;
let frames = 0;
let fps = 0;
let longFrames = 0;
let heapSamples = [];

function notify() {
  LISTENERS.forEach((fn) => {
    try {
      fn(getPerformanceSnapshot());
    } catch {
      /* ignore */
    }
  });
}

export function subscribePerformance(listener) {
  LISTENERS.add(listener);
  return () => LISTENERS.delete(listener);
}

function sampleHeap() {
  const mem = performance?.memory;
  if (!mem) return null;
  return {
    usedJSHeapSize: mem.usedJSHeapSize,
    totalJSHeapSize: mem.totalJSHeapSize,
    jsHeapSizeLimit: mem.jsHeapSizeLimit,
    supported: true,
  };
}

function tick(ts) {
  if (!running) return;
  if (lastTs) {
    const delta = ts - lastTs;
    frames += 1;
    if (delta > 50) longFrames += 1;
    if (frames >= 30) {
      fps = Math.round((1000 * frames) / Math.max(1, ts - (tick._windowStart || ts)));
      frames = 0;
      tick._windowStart = ts;
      const heap = sampleHeap();
      if (heap) {
        heapSamples = [...heapSamples, { t: Date.now(), used: heap.usedJSHeapSize }].slice(-40);
      }
      notify();
    }
  } else {
    tick._windowStart = ts;
  }
  lastTs = ts;
  rafId = requestAnimationFrame(tick);
}

export function startPerformanceMonitor() {
  if (running || typeof window === 'undefined') return;
  running = true;
  lastTs = 0;
  frames = 0;
  rafId = requestAnimationFrame(tick);
  notify();
}

export function stopPerformanceMonitor() {
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
}

export function getPerformanceSnapshot() {
  const heap = sampleHeap();
  const nav = typeof performance !== 'undefined' ? performance.getEntriesByType?.('navigation')?.[0] : null;
  return {
    running,
    fps,
    longFrames,
    heap: heap || { supported: false },
    heapTrend: heapSamples.slice(),
    cpu: {
      supported: false,
      note: 'Exact CPU % is not available in browser/TWA. Use long-frame and FPS as proxies.',
    },
    navigation: nav
      ? {
          domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
          loadEvent: Math.round(nav.loadEventEnd || 0),
          transferSize: nav.transferSize ?? null,
        }
      : null,
  };
}
