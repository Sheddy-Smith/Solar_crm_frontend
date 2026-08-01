/** CRM page zoom — default 100%; users can adjust and Reset back to 100%. */
export const PAGE_ZOOM_STORAGE_KEY = 'crm-page-zoom';
export const PAGE_ZOOM_DEFAULT = 100;
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
  const root = document.documentElement;
  // CSS zoom keeps layout stable better than transform:scale for app shells.
  root.style.zoom = String(zoom / 100);
  root.dataset.crmPageZoom = String(zoom);
  return zoom;
}

/** Boot helper — always land on stored value or 100%. */
export function bootPageZoom() {
  return applyPageZoom(readStoredPageZoom());
}
