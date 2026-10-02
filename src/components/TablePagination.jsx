import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from '../lib/utils.js';

export const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
const STORAGE_PREFIX = 'crm-page-size:';

function readPageSize(storageKey, fallback) {
  try {
    const saved = Number(window.localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`));
    return PAGE_SIZE_OPTIONS.includes(saved) ? saved : fallback;
  } catch {
    return fallback;
  }
}

/** Rows-per-page choice for one table, remembered in localStorage under `storageKey`. */
export function usePageSize(storageKey, defaultSize = 10) {
  const [pageSize, setPageSizeState] = useState(() => readPageSize(storageKey, defaultSize));
  const setPageSize = (next) => {
    setPageSizeState(next);
    try {
      window.localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, String(next));
    } catch {
      /* ignore */
    }
  };
  return [pageSize, setPageSize];
}

/**
 * Client-side paging for a data table, with the rows-per-page choice remembered
 * per table (`storageKey`). The page goes back to 1 whenever `resetKey` changes
 * (pass the search/filter values) and is clamped when rows shrink.
 */
export function usePagedRows(rows, storageKey, { defaultSize = 10, resetKey = '' } = {}) {
  const list = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);
  const [pageSize, storePageSize] = usePageSize(storageKey, defaultSize);
  const [page, setPage] = useState(1);
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const pageRows = useMemo(() => list.slice(startIndex, startIndex + pageSize), [list, startIndex, pageSize]);

  const setPageSize = (next) => {
    storePageSize(next);
    setPage(1);
  };

  return {
    pageRows,
    page: safePage,
    pageSize,
    total,
    totalPages,
    startIndex,
    setPage,
    setPageSize,
    pagination: { total, page: safePage, pageSize, onPageChange: setPage, onPageSizeChange: setPageSize },
  };
}

function PageButton({ active = false, children, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'inline-flex size-8 items-center justify-center rounded-[8px] border text-[12px] font-extrabold transition',
        active
          ? 'border-[#11a650] bg-[#11a650] text-white shadow-[0_8px_16px_rgba(17,166,80,0.22)]'
          : 'border-[#dce7f5] bg-white text-[#284276] hover:bg-[#f8fbff]',
      )}
    >
      {children}
    </button>
  );
}

function pageList(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = [1];
  if (page > 3) pages.push('ellipsis-start');
  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i += 1) pages.push(i);
  if (page < totalPages - 2) pages.push('ellipsis-end');
  pages.push(totalPages);
  return pages;
}

/** Lead-page style footer: "Showing a–b of N entries · Show [10] / page" + page buttons. */
export function TablePagination({ total, page, pageSize, onPageChange, onPageSizeChange, className = '' }) {
  if (!total) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className={cx('flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#eef2f8] bg-white px-3 py-2 text-[13px] font-bold text-[#53647f]', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <p>{`Showing ${from}–${to} of ${total} entries`}</p>
        <label className="inline-flex items-center gap-1.5 text-[12px] font-extrabold text-[#284276]">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            aria-label="Rows per page"
            className="h-7 rounded-[7px] border border-[#d9e4f2] bg-white px-2 text-[12px] font-extrabold text-[#1e3261] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span>/ page</span>
        </label>
      </div>
      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <PageButton label="Previous page" onClick={() => onPageChange(Math.max(1, page - 1))}>
            <ChevronLeft className="size-4" />
          </PageButton>
          {pageList(page, totalPages).map((item) => (typeof item === 'string'
            ? <span key={item} className="px-1 text-[#53647f]">…</span>
            : <PageButton key={item} active={item === page} onClick={() => onPageChange(item)}>{item}</PageButton>))}
          <PageButton label="Next page" onClick={() => onPageChange(Math.min(totalPages, page + 1))}>
            <ChevronRight className="size-4" />
          </PageButton>
        </div>
      ) : null}
    </div>
  );
}
