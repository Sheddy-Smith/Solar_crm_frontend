import { useCallback, useEffect, useState } from 'react';
import {
  RECENT_ALL_VIEW_ALL,
  RECENT_ALL_VIEW_RECENT,
  isAllRecordsView,
  readListViewFromSearch,
  writeListViewToUrl,
} from '../lib/recentAllList.js';

/**
 * Two-page list mode: `recent` (default preview) ↔ `all` (full database).
 * Syncs with `?view=all` so Back / refresh / deep-links keep working.
 */
export function useRecentAllView({ storageKey = '', syncUrl = true } = {}) {
  const [view, setViewState] = useState(() => {
    if (syncUrl) return readListViewFromSearch();
    if (!storageKey || typeof window === 'undefined') return RECENT_ALL_VIEW_RECENT;
    try {
      const saved = window.sessionStorage.getItem(`crm-list-view:${storageKey}`);
      return isAllRecordsView(saved) ? RECENT_ALL_VIEW_ALL : RECENT_ALL_VIEW_RECENT;
    } catch {
      return RECENT_ALL_VIEW_RECENT;
    }
  });

  useEffect(() => {
    if (!syncUrl) return undefined;
    const onPop = () => setViewState(readListViewFromSearch());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [syncUrl]);

  const setView = useCallback((next) => {
    const mode = isAllRecordsView(next) ? RECENT_ALL_VIEW_ALL : RECENT_ALL_VIEW_RECENT;
    setViewState(mode);
    if (syncUrl) writeListViewToUrl(mode);
    if (storageKey && typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(`crm-list-view:${storageKey}`, mode);
      } catch {
        /* ignore */
      }
    }
  }, [storageKey, syncUrl]);

  const openAll = useCallback(() => setView(RECENT_ALL_VIEW_ALL), [setView]);
  const openRecent = useCallback(() => setView(RECENT_ALL_VIEW_RECENT), [setView]);
  const isAll = isAllRecordsView(view);

  return {
    view,
    setView,
    isAll,
    isRecent: !isAll,
    openAll,
    openRecent,
  };
}
