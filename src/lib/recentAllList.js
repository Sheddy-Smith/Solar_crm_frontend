/**
 * Shared Recent (latest N) + View All (full database) list semantics.
 * Older records are never deleted — they only move out of the Recent preview.
 */

export const RECENT_LIST_LIMIT = 10;
export const RECENT_ACTIVITY_DAYS = 7;
export const RECENT_ALL_VIEW_PARAM = 'view';
export const RECENT_ALL_VIEW_ALL = 'all';
export const RECENT_ALL_VIEW_RECENT = 'recent';

/** Default ordering for “recently worked” lists (DRF / client sort). */
export const RECENT_ACTIVITY_ORDERING = '-last_activity_at,-updated_at,-created_at';

export function isAllRecordsView(view) {
  return String(view || '').toLowerCase() === RECENT_ALL_VIEW_ALL;
}

export function readListViewFromSearch(search = typeof window !== 'undefined' ? window.location.search : '') {
  try {
    const raw = new URLSearchParams(search).get(RECENT_ALL_VIEW_PARAM);
    return isAllRecordsView(raw) ? RECENT_ALL_VIEW_ALL : RECENT_ALL_VIEW_RECENT;
  } catch {
    return RECENT_ALL_VIEW_RECENT;
  }
}

/** Update `?view=` without leaving the current path. */
export function writeListViewToUrl(view, { replace = true } = {}) {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (isAllRecordsView(view)) url.searchParams.set(RECENT_ALL_VIEW_PARAM, RECENT_ALL_VIEW_ALL);
    else url.searchParams.delete(RECENT_ALL_VIEW_PARAM);
    const next = `${url.pathname}${url.search}${url.hash}`;
    if (replace) window.history.replaceState(window.history.state, '', next);
    else window.history.pushState(window.history.state, '', next);
  } catch {
    /* ignore */
  }
}

export function activityTimestamp(row, fields = ['last_activity_at', 'updated_at', 'created_at', 'last_activity', 'modified_at']) {
  if (!row || typeof row !== 'object') return 0;
  for (const key of fields) {
    const v = row[key];
    if (v == null || v === '') continue;
    const t = new Date(v).getTime();
    if (Number.isFinite(t)) return t;
  }
  return 0;
}

export function isWithinRecentWindow(row, days = RECENT_ACTIVITY_DAYS, fields) {
  const t = activityTimestamp(row, fields);
  if (!t) return false;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return t >= cutoff;
}

/** Sort newest activity first, then take up to `limit` rows (prefer last N days when available). */
export function pickRecentRows(rows, {
  limit = RECENT_LIST_LIMIT,
  days = RECENT_ACTIVITY_DAYS,
  fields,
} = {}) {
  const list = Array.isArray(rows) ? [...rows] : [];
  list.sort((a, b) => activityTimestamp(b, fields) - activityTimestamp(a, fields));
  const inWindow = list.filter((r) => isWithinRecentWindow(r, days, fields));
  const source = inWindow.length ? inWindow : list;
  return source.slice(0, Math.max(0, limit));
}

/** Relative activity label for table cells (e.g. "Today, 07:05 PM"). */
export function formatRelativeActivity(value, now = new Date()) {
  if (value == null || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return '—';
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round((startToday - startThat) / 86400000);
  if (dayDiff === 0) return `Today, ${time}`;
  if (dayDiff === 1) return `Yesterday, ${time}`;
  if (dayDiff > 1 && dayDiff < 7) {
    return `${d.toLocaleDateString('en-IN', { weekday: 'short' })}, ${time}`;
  }
  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, ${time}`;
}
