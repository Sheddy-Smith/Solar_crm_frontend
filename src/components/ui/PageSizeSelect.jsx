import { CRM_PAGE_SIZE_OPTIONS, writeCrmPageSize } from '../../lib/crmPageSize.js';

/** Dropdown: how many rows to show per page (10–50). */
export default function PageSizeSelect({ value, onChange, className = '' }) {
  return (
    <label
      className={`inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-[#d9e4f2] bg-white px-2 text-[12px] font-extrabold text-[#284276] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 ${className}`}
    >
      <span className="text-[#7386a3] dark:text-slate-400">Show</span>
      <select
        value={value}
        onChange={(event) => {
          const next = writeCrmPageSize(event.target.value);
          onChange?.(next);
        }}
        aria-label="Rows per page"
        className="cursor-pointer bg-transparent text-[12px] font-extrabold text-[#0b65e5] outline-none dark:text-sky-400"
      >
        {CRM_PAGE_SIZE_OPTIONS.map((size) => (
          <option key={size} value={size}>{size}</option>
        ))}
      </select>
      <span className="text-[#7386a3] dark:text-slate-400">/ page</span>
    </label>
  );
}

/** “Showing X to Y of Z entries” + page-size control. */
export function EntriesFooter({
  from,
  to,
  total,
  pageSize,
  onPageSizeChange,
  children = null,
  className = '',
}) {
  if (!total) {
    return (
      <div className={`flex flex-col gap-2 px-2 py-2 text-[12px] font-bold text-[#53647f] sm:flex-row sm:items-center sm:justify-between ${className}`}>
        <span />
        {children}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 px-2 py-2 text-[12px] font-bold text-[#53647f] sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p>{`Showing ${from} to ${to} of ${total} entries`}</p>
        <PageSizeSelect value={pageSize} onChange={onPageSizeChange} />
      </div>
      {children}
    </div>
  );
}
