import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'malwa-solar-crm:developer-mode';
const FOCUS_KEY = 'malwa-solar-crm:developer-mode-focus';
const OPEN_EVENT = 'malwa-solar-crm:developer-mode-open';
const REQUIRED_PRESSES = 3;
/** Hold Ctrl+Alt+Shift and tap D three times within this window. */
const PRESS_WINDOW_MS = 4000;

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
  // Physical D key only — reliable with Shift held / non-US layouts.
  const isD = event.code === 'KeyD' || event.key === 'd' || event.key === 'D';
  return Boolean(event.ctrlKey && event.altKey && event.shiftKey && isD);
}

/**
 * Settings Developer Mode.
 * Unlock / open: hold Ctrl+Alt+Shift and press D exactly 3 times.
 * Toggle off hides developer options; 3 presses again re-opens.
 */
export function useDeveloperMode({
  onNotify,
  enabled = true,
  listen = true,
  onActivated,
} = {}) {
  const [active, setActive] = useState(readEnabled);
  const pressCountRef = useRef(0);
  const lastPressAtRef = useRef(0);
  const onActivatedRef = useRef(onActivated);
  const onNotifyRef = useRef(onNotify);
  onActivatedRef.current = onActivated;
  onNotifyRef.current = onNotify;

  // Keep UI in sync when another Settings surface activates/disables mode.
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

      event.preventDefault();
      event.stopPropagation();

      const now = Date.now();
      if (now - lastPressAtRef.current > PRESS_WINDOW_MS) {
        pressCountRef.current = 0;
      }
      lastPressAtRef.current = now;
      pressCountRef.current += 1;

      // 1st / 2nd D press: ignore (do not open)
      if (pressCountRef.current < REQUIRED_PRESSES) {
        return;
      }

      // 3rd D press with Ctrl+Alt+Shift held → open
      pressCountRef.current = 0;
      activate();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [enabled, listen, activate]);

  return { active, setDeveloperMode, toggle, activate };
}

export const DEVELOPER_SETTINGS_TABS = [
  { id: 'memory', label: 'Memory' },
  { id: 'whatsapp-extension', label: 'WhatsApp Extension' },
  { id: 'attendance-machine', label: 'Attendance Machine' },
  { id: 'audit-logs', label: 'Audit Logs' },
  { id: 'bug-reports', label: 'Bug Reports' },
];
