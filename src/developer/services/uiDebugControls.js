const KEY = 'malwa-solar-crm:dev-ui-controls';
const LISTENERS = new Set();

const DEFAULTS = {
  showTaps: false,
  pointerLocation: false,
  layoutBounds: false,
  forceRtl: false,
  stayAwake: false,
  renderingDiagnostics: false,
};

let state = { ...DEFAULTS };
let wakeLock = null;
let pointerEl = null;
let tapLayer = null;

function load() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) state = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
}
load();

function persist() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  LISTENERS.forEach((fn) => {
    try {
      fn({ ...state });
    } catch {
      /* ignore */
    }
  });
}

export function subscribeUiDebugControls(listener) {
  LISTENERS.add(listener);
  return () => LISTENERS.delete(listener);
}

export function getUiDebugControls() {
  return { ...state };
}

function ensureTapLayer() {
  if (tapLayer || typeof document === 'undefined') return;
  tapLayer = document.createElement('div');
  tapLayer.id = 'crm-dev-tap-layer';
  tapLayer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483000;';
  document.body.appendChild(tapLayer);
}

function onPointerDown(e) {
  if (!state.showTaps) return;
  ensureTapLayer();
  const ripple = document.createElement('div');
  const size = 28;
  ripple.style.cssText = `position:absolute;left:${e.clientX - size / 2}px;top:${e.clientY - size / 2}px;width:${size}px;height:${size}px;border-radius:999px;border:2px solid #1a73e8;background:rgba(26,115,232,0.25);transform:scale(0.4);opacity:1;transition:transform 350ms ease,opacity 350ms ease;`;
  tapLayer.appendChild(ripple);
  requestAnimationFrame(() => {
    ripple.style.transform = 'scale(2.2)';
    ripple.style.opacity = '0';
  });
  setTimeout(() => ripple.remove(), 400);
}

function ensurePointerHud() {
  if (pointerEl || typeof document === 'undefined') return;
  pointerEl = document.createElement('div');
  pointerEl.id = 'crm-dev-pointer-hud';
  pointerEl.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483001;background:rgba(15,23,42,0.88);color:#e2e8f0;font:12px/1.3 ui-monospace,monospace;padding:6px 10px;border-radius:8px;pointer-events:none;';
  document.body.appendChild(pointerEl);
}

function onPointerMove(e) {
  if (!state.pointerLocation) return;
  ensurePointerHud();
  pointerEl.textContent = `X ${Math.round(e.clientX)} · Y ${Math.round(e.clientY)} · ${e.pointerType || 'mouse'}`;
}

function applyLayoutBounds(on) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('crm-dev-layout-bounds', Boolean(on));
}

function applyRtl(on) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  if (on) {
    if (!html.dataset.crmPrevDir) html.dataset.crmPrevDir = html.getAttribute('dir') || 'ltr';
    html.setAttribute('dir', 'rtl');
    html.classList.add('crm-dev-force-rtl');
  } else {
    const prev = html.dataset.crmPrevDir || 'ltr';
    html.setAttribute('dir', prev);
    delete html.dataset.crmPrevDir;
    html.classList.remove('crm-dev-force-rtl');
  }
}

async function applyStayAwake(on) {
  if (typeof navigator === 'undefined') return { supported: false };
  if (!('wakeLock' in navigator)) return { supported: false, active: false };
  try {
    if (on) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
      return { supported: true, active: true };
    }
    await wakeLock?.release?.();
    wakeLock = null;
    return { supported: true, active: false };
  } catch (err) {
    return { supported: true, active: false, error: err?.message || String(err) };
  }
}

function applyRenderingDiagnostics(on) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('crm-dev-render-diag', Boolean(on));
}

export async function setUiDebugControl(key, value) {
  state = { ...state, [key]: Boolean(value) };
  persist();
  if (key === 'layoutBounds') applyLayoutBounds(state.layoutBounds);
  if (key === 'forceRtl') applyRtl(state.forceRtl);
  if (key === 'stayAwake') await applyStayAwake(state.stayAwake);
  if (key === 'renderingDiagnostics') applyRenderingDiagnostics(state.renderingDiagnostics);
  return getUiDebugControls();
}

export function installUiDebugControls() {
  if (typeof window === 'undefined') return;
  window.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('pointermove', onPointerMove, true);
  applyLayoutBounds(state.layoutBounds);
  applyRtl(state.forceRtl);
  applyRenderingDiagnostics(state.renderingDiagnostics);
  if (state.stayAwake) applyStayAwake(true);
}

export async function resetUiDebugControls() {
  state = { ...DEFAULTS };
  persist();
  applyLayoutBounds(false);
  applyRtl(false);
  applyRenderingDiagnostics(false);
  await applyStayAwake(false);
  pointerEl?.remove();
  pointerEl = null;
  tapLayer?.remove();
  tapLayer = null;
}
