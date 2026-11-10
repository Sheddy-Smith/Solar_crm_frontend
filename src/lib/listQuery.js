/**
 * Shared list/pagination helpers — keep CRM pages on small, page-scoped fetches
 * instead of pulling 200+ rows into the browser.
 */

export const LIST_PAGE_SIZE = 25;
export const LOOKUP_PAGE_SIZE = 50;
export const DASHBOARD_PAGE_SIZE = 40;
/** Matches backend DefaultPagination.max_page_size (API_MAX_PAGE_SIZE default). */
export const API_MAX_PAGE_SIZE = 100;

/** Flatten DRF paginated / bare-array responses into rows. */
export function rowsOf(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

/**
 * Walk every DRF page until `next` is empty.
 * Use for alert queues (High / Extra High) where a single page_size truncates counts.
 */
export async function fetchEveryPage(loadPage, { pageSize = API_MAX_PAGE_SIZE, maxPages = 40 } = {}) {
  const rows = [];
  const size = Math.min(Math.max(1, Number(pageSize) || API_MAX_PAGE_SIZE), API_MAX_PAGE_SIZE);
  const limit = Math.max(1, Number(maxPages) || 40);
  for (let page = 1; page <= limit; page += 1) {
    const data = await loadPage(page, size);
    const batch = rowsOf(data);
    rows.push(...batch);
    const hasNext = Boolean(data && !Array.isArray(data) && data.next);
    if (!hasNext || batch.length === 0) break;
  }
  return rows;
}

/** Deduplicate follow-up rows by id (scheduled queue + recent diary merge). */
export function mergeFollowUpRows(...lists) {
  const byId = new Map();
  for (const list of lists) {
    for (const row of list || []) {
      if (row?.id == null) continue;
      byId.set(row.id, row);
    }
  }
  return [...byId.values()];
}

/** Parse DRF PageNumberPagination meta (count / next / previous / results). */
export function parseListPage(data, { page = 1, pageSize = LIST_PAGE_SIZE } = {}) {
  const results = rowsOf(data);
  const count = Number.isFinite(Number(data?.count)) ? Number(data.count) : results.length;
  return {
    results,
    count,
    page: Math.max(1, Number(page) || 1),
    pageSize: Math.max(1, Number(pageSize) || LIST_PAGE_SIZE),
    hasNext: Boolean(data?.next),
    hasPrevious: Boolean(data?.previous),
  };
}

/** Drop empty/null params so URLs stay clean. */
export function cleanListParams(params = {}) {
  const out = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value === '' || value == null || value === undefined) return;
    if (value === 'All' || value === 'all') return;
    out[key] = value;
  });
  return out;
}

/** Build a standard list query with default page size. */
export function listParams(params = {}, { pageSize = LIST_PAGE_SIZE } = {}) {
  const cleaned = cleanListParams(params);
  return {
    page_size: cleaned.page_size || pageSize,
    page: cleaned.page || 1,
    ...cleaned,
  };
}
