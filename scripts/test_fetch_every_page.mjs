/**
 * Lightweight unit checks for shared follow-up pagination helpers.
 * Run: node scripts/test_fetch_every_page.mjs
 */
import {
  fetchEveryPage,
  mergeFollowUpRows,
  rowsOf,
  API_MAX_PAGE_SIZE,
} from '../src/lib/listQuery.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function testFetchEveryPageWalksNextLinks() {
  const pages = {
    1: { count: 45, next: 'http://x?page=2', results: Array.from({ length: 25 }, (_, i) => ({ id: i + 1 })) },
    2: { count: 45, next: null, results: Array.from({ length: 20 }, (_, i) => ({ id: i + 26 })) },
  };
  const rows = await fetchEveryPage(async (page, pageSize) => {
    assert(pageSize === API_MAX_PAGE_SIZE, `expected capped page size ${API_MAX_PAGE_SIZE}, got ${pageSize}`);
    return pages[page];
  }, { pageSize: 500 });
  assert(rows.length === 45, `expected 45 rows, got ${rows.length}`);
  assert(rows[0].id === 1 && rows[44].id === 45, 'row order/ids mismatch');
}

async function testFetchEveryPageStopsOnBareArray() {
  const rows = await fetchEveryPage(async () => [{ id: 1 }, { id: 2 }]);
  assert(rows.length === 2, `bare array should not paginate forever, got ${rows.length}`);
}

function testMergeAndRowsOf() {
  assert(rowsOf({ results: [{ id: 1 }] }).length === 1, 'rowsOf results failed');
  assert(rowsOf([{ id: 2 }]).length === 1, 'rowsOf array failed');
  const merged = mergeFollowUpRows([{ id: 1, a: 1 }], [{ id: 1, a: 2 }, { id: 3 }]);
  assert(merged.length === 2, `expected 2 merged rows, got ${merged.length}`);
  assert(merged.find((r) => r.id === 1).a === 2, 'later list should win on duplicate id');
}

await testFetchEveryPageWalksNextLinks();
await testFetchEveryPageStopsOnBareArray();
testMergeAndRowsOf();
console.log('OK: fetchEveryPage / mergeFollowUpRows checks passed');
