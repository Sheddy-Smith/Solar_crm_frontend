import { useMemo } from 'react';
import { usePagedRows } from '../components/TablePagination.jsx';
import {
  RECENT_LIST_LIMIT,
  pickRecentRows,
} from '../lib/recentAllList.js';
import { useRecentAllView } from './useRecentAllView.js';

/**
 * For client-paged modules: Recent preview (top N by activity) or full paged list.
 * Older rows stay in `rows` — they are only excluded from the Recent slice.
 */
export function useRecentAllRows(rows, {
  storageKey,
  resetKey = '',
  activityFields,
  recentLimit = RECENT_LIST_LIMIT,
  syncUrl = true,
  defaultPageSize = 10,
} = {}) {
  const viewApi = useRecentAllView({ storageKey, syncUrl });
  const list = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);

  const recentRows = useMemo(
    () => pickRecentRows(list, { limit: recentLimit, fields: activityFields }),
    [list, recentLimit, activityFields],
  );

  const paged = usePagedRows(list, storageKey || 'recent-all-list', {
    defaultSize: defaultPageSize,
    resetKey: `${resetKey}|${viewApi.view}`,
  });

  const displayRows = viewApi.isAll ? paged.pageRows : recentRows;
  const startIndex = viewApi.isAll ? paged.startIndex : 0;

  return {
    ...viewApi,
    allRows: list,
    recentRows,
    displayRows,
    startIndex,
    totalCount: list.length,
    recentCount: recentRows.length,
    pagination: viewApi.isAll ? paged.pagination : null,
    pageRows: displayRows,
  };
}
