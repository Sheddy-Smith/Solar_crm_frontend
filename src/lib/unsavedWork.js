/**
 * Lightweight registry so update flow can warn before reload
 * without coupling to every form. Callers register a boolean flag.
 */

const flags = new Map();
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => {
    try {
      fn(hasUnsavedWork());
    } catch {
      /* ignore */
    }
  });
}

export function setUnsavedWork(key, dirty) {
  if (!key) return;
  if (dirty) flags.set(String(key), true);
  else flags.delete(String(key));
  emit();
}

export function hasUnsavedWork() {
  if (flags.size > 0) return true;
  try {
    if (typeof document !== 'undefined' && document.querySelector('[data-unsaved="1"]')) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function subscribeUnsavedWork(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
