/** CRM page zoom — default 110%; Reset returns to 110%. Viewport-fit via --crm-zoom. */
export const PAGE_ZOOM_STORAGE_KEY = 'crm-page-zoom';
export const PAGE_ZOOM_DEFAULT = 110;
export const PAGE_ZOOM_MIN = 70;
export const PAGE_ZOOM_MAX = 150;
export const PAGE_ZOOM_STEP = 10;

export function clampPageZoom(value) {
  const n = Math.round(Number(value) || PAGE_ZOOM_DEFAULT);
  const stepped = Math.round(n / PAGE_ZOOM_STEP) * PAGE_ZOOM_STEP;
  return Math.min(PAGE_ZOOM_MAX, Math.max(PAGE_ZOOM_MIN, stepped));
}

export function readStoredPageZoom() {
  if (typeof window === 'undefined') return PAGE_ZOOM_DEFAULT;
  try {
    const raw = window.localStorage.getItem(PAGE_ZOOM_STORAGE_KEY);
    if (raw == null || raw === '') return PAGE_ZOOM_DEFAULT;
    return clampPageZoom(raw);
  } catch {
    return PAGE_ZOOM_DEFAULT;
  }
}

export function writeStoredPageZoom(value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PAGE_ZOOM_STORAGE_KEY, String(clampPageZoom(value)));
  } catch {
    /* ignore */
  }
}

export function applyPageZoom(value) {
  if (typeof document === 'undefined') return PAGE_ZOOM_DEFAULT;
  const zoom = clampPageZoom(value);
  const factor = zoom / 100;
  const root = document.documentElement;
  // Clear legacy html { zoom } so it cannot fight viewport-fit scale.
  root.style.removeProperty('zoom');
  root.style.setProperty('--crm-zoom', String(factor));
  root.dataset.crmPageZoom = String(zoom);
  return zoom;
}

/** Boot helper — always land on stored value or 110%. */
export function bootPageZoom() {
  return applyPageZoom(readStoredPageZoom());
}
