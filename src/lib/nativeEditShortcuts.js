/**
 * Ensure browser-native edit shortcuts always reach the default action.
 * Capture-phase: stop other keydown handlers from calling preventDefault on
 * Ctrl/Cmd + C / X / V / Z / Y / A (and Ctrl+Shift+Z redo).
 */
const EDIT_KEYS = new Set(['c', 'x', 'v', 'z', 'y', 'a']);

function isNativeEditShortcut(event) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return false;
  const key = String(event.key || '').toLowerCase();
  return EDIT_KEYS.has(key);
}

function onNativeEditKeyDown(event) {
  if (!isNativeEditShortcut(event)) return;
  // Do NOT preventDefault — browser must copy/cut/paste/undo/redo/select-all.
  // Block later listeners so they cannot cancel the native action.
  event.stopImmediatePropagation();
}

export function enableNativeEditShortcuts() {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('keydown', onNativeEditKeyDown, true);
  return () => window.removeEventListener('keydown', onNativeEditKeyDown, true);
}
