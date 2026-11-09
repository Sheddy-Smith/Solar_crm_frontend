import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'malwa-solar-crm:developer-mode';
const FOCUS_KEY = 'malwa-solar-crm:developer-mode-focus';
const OPEN_EVENT = 'malwa-solar-crm:developer-mode-open';
const REQUIRED_PRESSES = 3;
/** Three D presses must complete within this window. */
const PRESS_WINDOW_MS = 3000;

function readEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeEnabled(on) {
  try {
    if (on) sessionStorage.setItem(STORAGE_KEY, '1');
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function emitDeveloperModeOpen() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

export function subscribeDeveloperModeOpen(handler) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(OPEN_EVENT, handler);
  return () => window.removeEventListener(OPEN_EVENT, handler);
}

function isDeveloperShortcut(event) {
  const isD = event.code === 'KeyD' || event.key === 'd' || event.key === 'D';
  return Boolean(event.ctrlKey && event.altKey && event.shiftKey && isD);
}

function isEditableTarget(target) {
  if (!target || typeof target !== 'object') return false;
  const el = target;
  const tag = (el.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  const role = el.getAttribute?.('role');
  if (role === 'textbox' || role === 'searchbox') return true;
  return Boolean(el.closest?.('input, textarea, select, [contenteditable="true"]'));
}

async function resetTemporaryDeveloperOverrides() {
  try {
    const { resetNetworkSimulator } = await import('../developer/services/apiInspector.js');
    resetNetworkSimulator();
  } catch {
    /* ignore */
  }
  try {
    const { resetUiDebugControls } = await import('../developer/services/uiDebugControls.js');
    await resetUiDebugControls();
  } catch {
    /* ignore */
  }
}

/**
 * Settings Developer Mode.
 * Unlock / open: hold Ctrl+Alt+Shift and press D exactly 3 times (within 3s).
 * Super Admin gate via canActivate (default true for backward-compatible listen:false surfaces).
 */
export function useDeveloperMode({
  onNotify,
  enabled = true,
  listen = true,
  onActivated,
  canActivate = true,
} = {}) {
  const [active, setActive] = useState(readEnabled);
  const pressCountRef = useRef(0);
  const lastPressAtRef = useRef(0);
  const onActivatedRef = useRef(onActivated);
  const onNotifyRef = useRef(onNotify);
  const canActivateRef = useRef(canActivate);
  onActivatedRef.current = onActivated;
  onNotifyRef.current = onNotify;
  canActivateRef.current = canActivate;

  useEffect(() => {
    const sync = () => setActive(readEnabled());
    window.addEventListener(OPEN_EVENT, sync);
    window.addEventListener('malwa-solar-crm:developer-mode-close', sync);
    return () => {
      window.removeEventListener(OPEN_EVENT, sync);
      window.removeEventListener('malwa-solar-crm:developer-mode-close', sync);
    };
  }, []);

  const activate = useCallback(() => {
    if (!canActivateRef.current) {
      onNotifyRef.current?.('Developer Mode is restricted to Super Admin', 'error');
      return;
    }
    const already = readEnabled();
    setActive(true);
    writeEnabled(true);
    try {
      sessionStorage.setItem(FOCUS_KEY, '1');
    } catch {
      /* ignore */
    }
    if (!already) onNotifyRef.current?.('Developer Mode enabled', 'success');
    onActivatedRef.current?.();
    emitDeveloperModeOpen();
  }, []);

  const setDeveloperMode = useCallback(
    (next) => {
      const value = Boolean(next);
      if (value) {
        activate();
        return;
      }
      setActive(false);
      writeEnabled(false);
      pressCountRef.current = 0;
      resetTemporaryDeveloperOverrides();
      onNotifyRef.current?.('Developer Mode disabled', 'success');
      window.dispatchEvent(new CustomEvent('malwa-solar-crm:developer-mode-close'));
    },
    [activate],
  );

  const toggle = useCallback(() => {
    setDeveloperMode(!active);
  }, [active, setDeveloperMode]);

  useEffect(() => {
    if (!enabled || !listen) return undefined;

    const onKeyDown = (event) => {
      if (event.repeat) return;
      if (!isDeveloperShortcut(event)) return;
      if (isEditableTarget(event.target)) return;

      event.preventDefault();
      event.stopPropagation();

      if (!canActivateRef.current) {
        onNotifyRef.current?.('Developer Mode is restricted to Super Admin', 'error');
        pressCountRef.current = 0;
        return;
      }

      const now = Date.now();
      if (now - lastPressAtRef.current > PRESS_WINDOW_MS) {
        pressCountRef.current = 0;
      }
      lastPressAtRef.current = now;
      pressCountRef.current += 1;

      if (pressCountRef.current < REQUIRED_PRESSES) {
        return;
      }

      pressCountRef.current = 0;
      activate();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [enabled, listen, activate]);

  return { active, setDeveloperMode, toggle, activate };
}

/** @deprecated Legacy tab list kept for compatibility; console uses categories. */
export const DEVELOPER_SETTINGS_TABS = [
  { id: 'console', label: 'Console' },
  { id: 'memory', label: 'Memory' },
  { id: 'animation', label: 'Animation' },
  { id: 'whatsapp-extension', label: 'WhatsApp Extension' },
  { id: 'attendance-machine', label: 'Attendance Machine' },
  { id: 'audit-logs', label: 'Audit Logs' },
  { id: 'bug-reports', label: 'Bug Reports' },
];
