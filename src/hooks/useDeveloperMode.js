import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'malwa-solar-crm:developer-mode';
const ACTIVATED_AT_KEY = 'malwa-solar-crm:developer-mode-activated-at';
const FOCUS_KEY = 'malwa-solar-crm:developer-mode-focus';
const OPEN_EVENT = 'malwa-solar-crm:developer-mode-open';
const CLOSE_EVENT = 'malwa-solar-crm:developer-mode-close';
const REQUIRED_PRESSES = 3;
/** Three shortcut key presses must complete within this window. */
const PRESS_WINDOW_MS = 3000;
/** Developer Mode auto-hides after this idle session window. */
const AUTO_HIDE_MS = 10 * 60 * 1000;

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
    if (on) {
      sessionStorage.setItem(STORAGE_KEY, '1');
      if (!sessionStorage.getItem(ACTIVATED_AT_KEY)) {
        sessionStorage.setItem(ACTIVATED_AT_KEY, String(Date.now()));
      }
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(ACTIVATED_AT_KEY);
      sessionStorage.removeItem(FOCUS_KEY);
    }
  } catch {
    /* ignore */
  }
}

function readActivatedAt() {
  try {
    const raw = sessionStorage.getItem(ACTIVATED_AT_KEY);
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function stampActivatedAt() {
  try {
    sessionStorage.setItem(ACTIVATED_AT_KEY, String(Date.now()));
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

function isEnableShortcut(event) {
  const isD = event.code === 'KeyD' || event.key === 'd' || event.key === 'D';
  return Boolean(event.ctrlKey && event.altKey && event.shiftKey && isD);
}

function isHideShortcut(event) {
  const isO = event.code === 'KeyO' || event.key === 'o' || event.key === 'O';
  return Boolean(event.ctrlKey && event.altKey && event.shiftKey && isO);
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
 * Developer Mode.
 * Enable:  Ctrl+Alt+Shift + D ×3 (within 3s) — Super Admin only.
 * Hide:    Ctrl+Alt+Shift + O ×3 (within 3s), Exit toggle, or auto-hide after 10 minutes.
 */
export function useDeveloperMode({
  onNotify,
  enabled = true,
  listen = true,
  onActivated,
  canActivate = true,
} = {}) {
  const [active, setActive] = useState(readEnabled);
  const enablePressRef = useRef(0);
  const enableLastAtRef = useRef(0);
  const hidePressRef = useRef(0);
  const hideLastAtRef = useRef(0);
  const onActivatedRef = useRef(onActivated);
  const onNotifyRef = useRef(onNotify);
  const canActivateRef = useRef(canActivate);
  const deactivateRef = useRef(() => {});
  onActivatedRef.current = onActivated;
  onNotifyRef.current = onNotify;
  canActivateRef.current = canActivate;

  useEffect(() => {
    const sync = () => setActive(readEnabled());
    window.addEventListener(OPEN_EVENT, sync);
    window.addEventListener(CLOSE_EVENT, sync);
    return () => {
      window.removeEventListener(OPEN_EVENT, sync);
      window.removeEventListener(CLOSE_EVENT, sync);
    };
  }, []);

  const deactivate = useCallback((reason = 'manual') => {
    if (!readEnabled() && !active) return;
    setActive(false);
    writeEnabled(false);
    enablePressRef.current = 0;
    hidePressRef.current = 0;
    resetTemporaryDeveloperOverrides();
    if (reason === 'auto') {
      onNotifyRef.current?.('Developer Mode auto-hidden after 10 minutes', 'success');
    } else {
      onNotifyRef.current?.('Developer Mode disabled', 'success');
    }
    window.dispatchEvent(new CustomEvent(CLOSE_EVENT));
  }, [active]);

  deactivateRef.current = deactivate;

  const activate = useCallback(() => {
    if (!canActivateRef.current) {
      onNotifyRef.current?.('Developer Mode is restricted to Super Admin', 'error');
      return;
    }
    const already = readEnabled();
    stampActivatedAt();
    setActive(true);
    writeEnabled(true);
    try {
      sessionStorage.setItem(FOCUS_KEY, '1');
    } catch {
      /* ignore */
    }
    if (!already) onNotifyRef.current?.('Developer Mode enabled · auto-hides in 10 min', 'success');
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
      deactivate('manual');
    },
    [activate, deactivate],
  );

  const toggle = useCallback(() => {
    setDeveloperMode(!active);
  }, [active, setDeveloperMode]);

  // Auto-hide after 10 minutes from activation (survives remounts via sessionStorage).
  useEffect(() => {
    if (!active) return undefined;

    let activatedAt = readActivatedAt();
    if (!activatedAt) {
      stampActivatedAt();
      activatedAt = Date.now();
    }

    const elapsed = Date.now() - activatedAt;
    const remaining = AUTO_HIDE_MS - elapsed;
    if (remaining <= 0) {
      deactivateRef.current('auto');
      return undefined;
    }

    const timer = window.setTimeout(() => {
      deactivateRef.current('auto');
    }, remaining);

    return () => window.clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    if (!enabled || !listen) return undefined;

    const bump = (refCount, refLast) => {
      const now = Date.now();
      if (now - refLast.current > PRESS_WINDOW_MS) {
        refCount.current = 0;
      }
      refLast.current = now;
      refCount.current += 1;
      return refCount.current >= REQUIRED_PRESSES;
    };

    const onKeyDown = (event) => {
      if (event.repeat) return;
      if (isEditableTarget(event.target)) return;

      if (isHideShortcut(event)) {
        event.preventDefault();
        event.stopPropagation();
        if (!readEnabled()) {
          hidePressRef.current = 0;
          return;
        }
        if (!bump(hidePressRef, hideLastAtRef)) return;
        hidePressRef.current = 0;
        deactivateRef.current('manual');
        return;
      }

      if (!isEnableShortcut(event)) return;

      event.preventDefault();
      event.stopPropagation();

      if (!canActivateRef.current) {
        onNotifyRef.current?.('Developer Mode is restricted to Super Admin', 'error');
        enablePressRef.current = 0;
        return;
      }

      if (!bump(enablePressRef, enableLastAtRef)) return;
      enablePressRef.current = 0;
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
