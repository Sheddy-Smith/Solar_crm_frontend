/** Shared CRM list page-size preference (Lead, Projects, Quotations, etc.). */
export const CRM_PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
export const CRM_PAGE_SIZE_KEY = 'crm-page-size';
const LEGACY_LEAD_KEY = 'crm-lead-page-size';

export function clampCrmPageSize(value) {
  const n = Number(value);
  return CRM_PAGE_SIZE_OPTIONS.includes(n) ? n : 10;
}

export function readCrmPageSize() {
  if (typeof window === 'undefined') return 10;
  try {
    const primary = window.localStorage.getItem(CRM_PAGE_SIZE_KEY);
    if (primary != null && primary !== '') return clampCrmPageSize(primary);
    const legacy = window.localStorage.getItem(LEGACY_LEAD_KEY);
    if (legacy != null && legacy !== '') {
      const next = clampCrmPageSize(legacy);
      window.localStorage.setItem(CRM_PAGE_SIZE_KEY, String(next));
      return next;
    }
  } catch {
    /* ignore */
  }
  return 10;
}

export function writeCrmPageSize(value) {
  if (typeof window === 'undefined') return 10;
  const next = clampCrmPageSize(value);
  try {
    window.localStorage.setItem(CRM_PAGE_SIZE_KEY, String(next));
  } catch {
    /* ignore */
  }
  return next;
}
