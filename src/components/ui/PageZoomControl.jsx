import { Minus, Plus } from 'lucide-react';
import {
  PAGE_ZOOM_DEFAULT,
  PAGE_ZOOM_MAX,
  PAGE_ZOOM_MIN,
  PAGE_ZOOM_STEP,
  applyPageZoom,
  clampPageZoom,
  writeStoredPageZoom,
} from '../../lib/pageZoom.js';

/** Compact header zoom control: 110% default, − / + / Reset. */
export default function PageZoomControl({ value, onChange, className = '' }) {
  const zoom = clampPageZoom(value);

  const commit = (next) => {
    const applied = applyPageZoom(next);
    writeStoredPageZoom(applied);
    onChange?.(applied);
  };

  return (
    <div
      className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-[10px] border border-[#dce7f5] bg-white px-1.5 text-[#284276] shadow-[0_2px_8px_rgba(15,39,92,0.05)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 ${className}`}
      title="Page zoom"
      aria-label="Page zoom"
    >
      <span className="min-w-[42px] px-1 text-center text-[12px] font-extrabold tabular-nums">
        {zoom}%
      </span>
      <button
        type="button"
        onClick={() => commit(zoom - PAGE_ZOOM_STEP)}
        disabled={zoom <= PAGE_ZOOM_MIN}
        className="inline-flex size-7 items-center justify-center rounded-[7px] text-[#52637f] transition hover:bg-[#f3f7fb] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-slate-700"
        aria-label="Zoom out"
      >
        <Minus className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => commit(zoom + PAGE_ZOOM_STEP)}
        disabled={zoom >= PAGE_ZOOM_MAX}
        className="inline-flex size-7 items-center justify-center rounded-[7px] text-[#52637f] transition hover:bg-[#f3f7fb] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-slate-700"
        aria-label="Zoom in"
      >
        <Plus className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => commit(PAGE_ZOOM_DEFAULT)}
        className="rounded-[7px] px-2 py-1 text-[11px] font-extrabold text-[#0b65e5] transition hover:bg-[#eef5ff] dark:text-sky-400 dark:hover:bg-slate-700"
        aria-label={`Reset zoom to ${PAGE_ZOOM_DEFAULT}%`}
      >
        Reset
      </button>
    </div>
  );
}
