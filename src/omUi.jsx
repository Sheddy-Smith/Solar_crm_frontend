import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Search, X } from 'lucide-react';
import { omEngineerApi, omPlantApi } from './api.js';
import { cx, normalizeApiRows } from './lib/utils.js';
import { MobileCardEmpty, MobileCardList } from './components/mobile/MobileRecordCard.jsx';
import { TablePagination, usePagedRows } from './components/TablePagination.jsx';

export { cx, normalizeApiRows };

export const PANEL = 'rounded-[14px] border border-[#e7eef7] bg-white shadow-[0_10px_24px_rgba(17,39,84,0.05)]';
export const INPUT = 'h-11 w-full rounded-[10px] border border-[#d9e2ec] bg-white px-3 text-[14px] font-semibold text-[#1e2a38] outline-none placeholder:text-[#94a3b8] focus:border-[#0b65e5] focus:ring-2 focus:ring-[#e3efff] sm:h-9 sm:rounded-[8px] sm:text-[13px]';
export const TEXTAREA = 'min-h-[76px] w-full rounded-[10px] border border-[#d9e2ec] bg-white px-3 py-2 text-[14px] font-semibold text-[#1e2a38] outline-none placeholder:text-[#94a3b8] focus:border-[#0b65e5] focus:ring-2 focus:ring-[#e3efff] sm:rounded-[8px] sm:text-[13px]';
export const LABEL = 'mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[#7386a3]';
export const BTN_PRIMARY = 'inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] bg-[#0b65e5] px-4 text-[13px] font-extrabold text-white transition hover:bg-[#084fc0] disabled:cursor-not-allowed disabled:opacity-50';
export const BTN_GREEN = 'inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] bg-[#16a34a] px-4 text-[13px] font-extrabold text-white transition hover:bg-[#12883e] disabled:cursor-not-allowed disabled:opacity-50';
export const BTN_OUTLINE = 'inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] border border-[#d5e0ef] bg-white px-4 text-[13px] font-bold text-[#314a79] transition hover:bg-[#f8fbff] disabled:cursor-not-allowed disabled:opacity-50';
export const BTN_SMALL = 'inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-[7px] border border-[#d5e0ef] bg-white px-2.5 text-[12px] font-bold text-[#314a79] transition hover:bg-[#f8fbff] disabled:cursor-not-allowed disabled:opacity-50';

export function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function fmtMoney(value) {
  if (value == null || value === '' || !Number(value)) return '—';
  return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function daysText(days) {
  if (days == null) return '';
  if (days === 0) return 'today';
  if (days < 0) return `${Math.abs(days)} day${days === -1 ? '' : 's'} ago`;
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDaysIso(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const TONES = {
  green: 'bg-[#e8f8eb] text-[#0d9f4a]',
  amber: 'bg-[#fff0dc] text-[#c97a00]',
  blue: 'bg-[#e8f2ff] text-[#0b65e5]',
  red: 'bg-[#fee2e2] text-[#dc2626]',
  purple: 'bg-[#f2eafe] text-[#7c3aed]',
  slate: 'bg-[#eef2f7] text-[#61718d]',
};

const STATUS_TONE = {
  Completed: 'green', Closed: 'green', Resolved: 'green', Insured: 'green', OK: 'green',
  'Free Service Active': 'green', 'AMC Active': 'green', Active: 'green',
  Pending: 'amber', Assigned: 'amber', Accepted: 'amber', Medium: 'amber',
  'Free Service Expiring Soon': 'amber', 'Partially Resolved': 'amber', 'Pending Parts': 'amber',
  Scheduled: 'blue', 'In Progress': 'blue', 'Site Visit': 'blue', 'Paid O&M': 'purple',
  Open: 'red', Critical: 'red', High: 'red', Expired: 'red', Overdue: 'red', Issue: 'red',
  'Free Service Expired': 'red', 'AMC Expired': 'red', 'Revisit Required': 'red',
  Quarterly: 'blue', Ticket: 'purple', Manual: 'slate', Complaint: 'purple', Emergency: 'red',
};

export function Pill({ children, tone, title, className }) {
  const key = tone || STATUS_TONE[children] || 'slate';
  return (
    <span title={title} className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold', TONES[key] || TONES.slate, className)}>
      {children}
    </span>
  );
}

export function OmHeading({ title, crumbs = [], actions }) {
  return (
    <div className="page-heading flex min-w-0 flex-col gap-2.5 rounded-[12px] bg-white/60 p-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-[24px] font-bold leading-[1.12] tracking-[-0.01em] text-[#111827] sm:text-[30px]">{title}</h1>
        {crumbs.length ? (
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2 text-[13px] font-semibold">
            {crumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`} className="inline-flex min-w-0 items-center gap-2">
                {crumb.onClick
                  ? <button type="button" onClick={crumb.onClick} className="min-w-0 truncate text-[#0b65e5]">{crumb.label}</button>
                  : <span className="min-w-0 truncate text-[#53647f]">{crumb.label}</span>}
                {index < crumbs.length - 1 ? <ChevronRight className="size-3.5 shrink-0 text-[#9aa8bc]" /> : null}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div> : null}
    </div>
  );
}

/** Full-screen sheet on phones, centred dialog from `sm` up. */
export function Modal({ title, subtitle, onClose, footer, children, size = 'md' }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const width = size === 'lg' ? 'sm:max-w-[920px]' : size === 'sm' ? 'sm:max-w-[440px]' : 'sm:max-w-[640px]';
  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-[#0f172a]/45 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className={cx('flex h-full w-full flex-col bg-white sm:h-auto sm:max-h-[92vh] sm:rounded-[16px] sm:shadow-[0_24px_60px_rgba(15,23,42,0.28)]', width)}>
        <div className="flex items-start justify-between gap-3 border-b border-[#eef2f8] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="font-display text-[17px] font-extrabold text-[#111827]">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[12px] font-semibold text-[#7386a3]">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full text-[#53647f] hover:bg-[#f1f5f9]">
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-[#eef2f8] px-4 py-3 sm:px-5">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Field({ label, required, wide, children, hint }) {
  return (
    <div className={cx('min-w-0', wide && 'sm:col-span-2')}>
      <label className={LABEL}>{label}{required ? ' *' : ''}</label>
      {children}
      {hint ? <p className="mt-1 text-[11px] font-semibold text-[#8a98af]">{hint}</p> : null}
    </div>
  );
}

export function SelectInput({ value, onChange, options, placeholder, className, disabled }) {
  return (
    <select className={cx(INPUT, className)} value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options.map((o) => {
        const opt = typeof o === 'object' ? o : { value: o, label: o };
        return <option key={opt.value} value={opt.value}>{opt.label}</option>;
      })}
    </select>
  );
}

export function SearchBox({ value, onChange, placeholder }) {
  return (
    <label className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-[10px] border border-[#dce6f3] bg-white px-3.5 sm:h-9 sm:rounded-[8px]">
      <Search className="size-4 shrink-0 text-[#7e8fab]" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-[14px] font-semibold text-[#1e3261] outline-none placeholder:text-[#8a98af] sm:text-[13px]"
      />
    </label>
  );
}

export function DetailGrid({ rows }) {
  const visible = rows.filter(Boolean);
  return (
    <dl className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">
      {visible.map(([label, value, wide]) => (
        <div key={label} className={cx('min-w-0', wide && 'sm:col-span-2')}>
          <dt className="text-[10px] font-extrabold uppercase tracking-wide text-[#8a98af]">{label}</dt>
          <dd className="mt-0.5 break-words text-[13px] font-bold text-[#1e3261]">{value === '' || value == null ? '—' : value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Desktop table (lg+) with a phone card list fallback and client-side paging.
 * columns: [{ label, render(row), className? }]
 */
export function DataList({ rows, columns, renderCard, storageKey, resetKey, loading, emptyTitle = 'No records found', emptyHint, emptyIcon, onRowClick, rowClassName }) {
  const { pageRows, pagination, startIndex } = usePagedRows(rows, storageKey, { resetKey });
  if (loading && !rows.length) {
    return <p className="py-10 text-center text-[13px] font-semibold text-[#8a98af]">Loading...</p>;
  }
  if (!rows.length) {
    return (
      <>
        <MobileCardEmpty icon={emptyIcon} title={emptyTitle} hint={emptyHint} />
        <div className="hidden py-12 text-center lg:block">
          <p className="text-[14px] font-extrabold text-[#53647f]">{emptyTitle}</p>
          {emptyHint ? <p className="mt-1 text-[12px] font-semibold text-[#8a98af]">{emptyHint}</p> : null}
        </div>
      </>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <MobileCardList>{pageRows.map((row, i) => renderCard(row, startIndex + i))}</MobileCardList>
      <div className="hidden overflow-x-auto rounded-[12px] border border-[#eef2f8] lg:block">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="bg-[#f8fafd]">
              <th className="w-10 px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-[#7386a3]">#</th>
              {columns.map((c) => (
                <th key={c.label} className={cx('px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-[#7386a3]', c.className)}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr
                key={row.id ?? i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cx('border-t border-[#eef2f8] align-top transition', onRowClick && 'cursor-pointer hover:bg-[#f8fbff]', rowClassName?.(row))}
              >
                <td className="px-3 py-2.5 text-[12px] font-bold text-[#8a98af]">{startIndex + i + 1}</td>
                {columns.map((c) => (
                  <td key={c.label} className={cx('px-3 py-2.5 text-[13px] font-semibold text-[#1e3261]', c.className)}>{c.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePagination {...pagination} className="rounded-b-[12px]" />
    </div>
  );
}

let engineerCache = null;
export function useEngineers() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let alive = true;
    if (!engineerCache) {
      engineerCache = omEngineerApi.list().catch(() => {
        engineerCache = null;
        return [];
      });
    }
    engineerCache.then((data) => { if (alive) setRows(Array.isArray(data) ? data : []); });
    return () => { alive = false; };
  }, []);
  return rows;
}

export function usePlantOptions(enabled = true) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    omPlantApi.list({ page_size: 2500, ordering: 'customer_name' })
      .then((r) => { if (alive) setRows(normalizeApiRows(r)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [enabled]);
  return rows;
}

export function plantLabel(p) {
  if (!p) return '';
  return [p.plant_code, p.customer_name || p.plant_name, p.capacity_kw ? `${Number(p.capacity_kw)} kW` : '', p.city].filter(Boolean).join(' · ');
}

/** Type-to-filter plant chooser (customer, mobile, PLT code, city). */
export function PlantPicker({ value, onChange, plants, disabled }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? plants.filter((p) => [p.plant_code, p.customer_name, p.plant_name, p.mobile_number, p.city, p.project_code]
        .some((v) => String(v || '').toLowerCase().includes(q)))
      : plants;
    const selected = plants.find((p) => String(p.id) === String(value));
    const capped = list.slice(0, 200);
    return selected && !capped.includes(selected) ? [selected, ...capped] : capped;
  }, [plants, query, value]);
  return (
    <div className="flex flex-col gap-1.5">
      {!disabled ? (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customer, mobile, PLT code..."
          className={INPUT}
        />
      ) : null}
      <select className={INPUT} value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">{plants.length ? 'Select plant...' : 'Loading plants...'}</option>
        {filtered.map((p) => <option key={p.id} value={p.id}>{plantLabel(p)}</option>)}
      </select>
    </div>
  );
}

export function CounterTile({ label, value, tone = 'blue', icon: Icon, onClick, hint }) {
  const ring = {
    blue: 'text-[#0b65e5] bg-[#eef4ff]', green: 'text-[#0d9f4a] bg-[#e8f8eb]', amber: 'text-[#c97a00] bg-[#fff4e0]',
    red: 'text-[#dc2626] bg-[#fee2e2]', purple: 'text-[#7c3aed] bg-[#f2eafe]', teal: 'text-[#0f766e] bg-[#e7faf8]',
  }[tone];
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={onClick ? { textAlign: 'left' } : undefined}
      className={cx(PANEL, 'flex min-w-0 items-center gap-3 p-3 transition', onClick && 'hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(17,39,84,0.09)]')}
    >
      {Icon ? <span className={cx('grid size-10 shrink-0 place-items-center rounded-[11px]', ring)}><Icon className="size-5" /></span> : null}
      <span className="min-w-0">
        <span className="block font-display text-[22px] font-extrabold leading-none text-[#111827]">{value ?? '—'}</span>
        <span className="mt-1 line-clamp-2 block text-[12px] font-bold leading-tight text-[#53647f]" title={label}>{label}</span>
        {hint ? <span className="block truncate text-[11px] font-semibold text-[#8a98af]">{hint}</span> : null}
      </span>
    </Comp>
  );
}

export function FilterChips({ options, value, onChange }) {
  return (
    <div className="module-tab-scroll -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cx(
              'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-extrabold transition sm:h-8',
              active ? 'border-[#0b65e5] bg-[#0b65e5] text-white' : 'border-[#d9e4f2] bg-white text-[#314a79] hover:bg-[#f8fbff]',
            )}
          >
            {o.label}
            {o.count != null ? <span className={cx('rounded-full px-1.5 text-[10px]', active ? 'bg-white/25' : 'bg-[#eef2f7] text-[#53647f]')}>{o.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
