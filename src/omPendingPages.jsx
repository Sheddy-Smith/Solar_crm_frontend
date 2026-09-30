import { Fragment, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, ClipboardList, ExternalLink,
  FileText, Package, PackageCheck, PackageX, Receipt, RefreshCw, Search, Truck, Undo2, Wrench,
} from 'lucide-react';
import { omPendingApi } from './api.js';
import { moduleCaps } from './settingsHubPages.jsx';

export const OM_PENDING_STEPS = [
  { key: 'Pending Work Order', short: 'Work Order', countKey: 'work_orders', icon: ClipboardList, loader: 'workOrders', route: '/om/pending-work-orders' },
  { key: 'Pending Quotations', short: 'Quotations', countKey: 'quotations', icon: FileText, loader: 'quotations', route: '/om/pending-quotations' },
  { key: 'Pending Dispatch', short: 'Dispatch', countKey: 'dispatch', icon: Truck, loader: 'dispatch', route: '/om/pending-dispatch' },
  { key: 'Pending Installation', short: 'Installation', countKey: 'installation', icon: Wrench, loader: 'installation', route: '/om/pending-installation' },
  { key: 'Pending Invoice', short: 'Invoice', countKey: 'invoices', icon: Receipt, loader: 'invoices', route: '/om/pending-invoice' },
  { key: 'Short Listed Material', short: 'Short Material', countKey: 'materials', icon: PackageX, loader: 'materials', route: '/om/short-listed-material' },
];

export const OM_PENDING_SECTIONS = OM_PENDING_STEPS.map((step) => step.key);

const PANEL = 'rounded-[14px] border border-[#e7eef7] bg-white shadow-[0_10px_24px_rgba(17,39,84,0.05)]';
const BTN_PRIMARY = 'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[7px] bg-[#16a34a] px-2.5 text-[12px] font-semibold text-white transition hover:bg-[#12883e] disabled:cursor-not-allowed disabled:opacity-50';
const BTN_OUTLINE = 'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[7px] border border-[#d5e0ef] bg-white px-2.5 text-[12px] font-semibold text-[#314a79] transition hover:bg-[#f8fbff] disabled:cursor-not-allowed disabled:opacity-50';
const BTN_AMBER = 'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[7px] border border-[#fcd9a4] bg-[#fff7ea] px-2.5 text-[12px] font-semibold text-[#b76b00] transition hover:bg-[#fff0d6] disabled:cursor-not-allowed disabled:opacity-50';

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtRs(n) {
  if (!Number(n)) return '—';
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function fmtQty(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return n ?? '—';
  return v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function daysLabel(days) {
  if (days == null) return '—';
  if (days === 0) return 'Today';
  return `${days} day${days === 1 ? '' : 's'}`;
}

function Pill({ children, tone = 'slate', title }) {
  const map = {
    green: 'bg-[#e8f8eb] text-[#0d9f4a]',
    amber: 'bg-[#fff0dc] text-[#c97a00]',
    blue: 'bg-[#e8f2ff] text-[#0b65e5]',
    red: 'bg-[#fee2e2] text-[#dc2626]',
    purple: 'bg-[#f2eafe] text-[#7c3aed]',
    slate: 'bg-[#eef2f7] text-[#61718d]',
  };
  return <span title={title} className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold', map[tone] || map.slate)}>{children}</span>;
}

function OmHeading({ title, crumbs, actions }) {
  return (
    <div className="page-heading flex min-w-0 flex-col gap-2.5 rounded-[12px] bg-white/60 p-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-[24px] font-bold leading-[1.12] tracking-[-0.01em] text-[#111827] sm:text-[30px]">{title}</h1>
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
      </div>
      {actions ? <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div> : null}
    </div>
  );
}

function stepNote(step, summary) {
  if (!summary) return '';
  switch (step.countKey) {
    case 'work_orders': return 'Work order not generated';
    case 'quotations': return 'Won lead, no quotation';
    case 'dispatch': return summary.dispatch_delayed ? `${summary.dispatch_delayed} delayed after packing` : 'Planned, not dispatched';
    case 'installation': return 'Installation not done';
    case 'invoices': return `${summary.invoices_challan ?? 0} challan · ${summary.invoices_invoice ?? 0} invoice`;
    case 'materials': return 'Out of / low stock';
    default: return '';
  }
}

function PendingFlowStrip({ activeSection, summary, onOpenSection }) {
  return (
    <section className={cx(PANEL, 'p-2.5 sm:p-3')}>
      <div className="module-tab-scroll -mx-1 overflow-x-auto px-1">
        <div className="grid w-[1020px] grid-cols-6 gap-2 2xl:w-full">
          {OM_PENDING_STEPS.map((step, index) => {
            const Icon = step.icon;
            const active = step.key === activeSection;
            const count = summary ? summary[step.countKey] ?? 0 : null;
            const alert = step.countKey === 'dispatch' && summary?.dispatch_delayed;
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => onOpenSection(step.key)}
                className={cx(
                  'relative flex flex-col gap-1.5 rounded-[12px] border px-3 py-2.5 text-left transition active:scale-[0.98]',
                  active
                    ? 'border-[#ffd58a] bg-[#fffaf0] ring-2 ring-[#fff0dc]'
                    : 'border-[#e2eaf5] bg-white hover:border-[#c8d8ed] hover:bg-[#f8fbff]',
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className={cx('grid size-8 shrink-0 place-items-center rounded-full', active ? 'bg-[#f59e0b] text-white' : 'bg-[#f4f7fb] text-[#53647f]')}>
                    <Icon className="size-4" />
                  </span>
                  <span className={cx(
                    'rounded-full px-2.5 py-0.5 text-[14px] font-extrabold',
                    count ? (alert ? 'bg-[#fee2e2] text-[#dc2626]' : 'bg-[#fff0dc] text-[#b76b00]') : 'bg-[#e8f8eb] text-[#0d9f4a]',
                  )}
                  >
                    {count == null ? '…' : count}
                  </span>
                </span>
                <span className={cx('whitespace-nowrap text-[12px] font-extrabold', active ? 'text-[#8a4f00]' : 'text-[#1e3261]')}>
                  <span className={cx('mr-1 text-[10px]', active ? 'text-[#b76b00]' : 'text-[#9aa8bc]')}>{index + 1}.</span>
                  {step.key}
                </span>
                <span className="block truncate text-left text-[11px] font-semibold text-[#8a98af]">{stepNote(step, summary) || ' '}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FilterChips({ options, value, onChange }) {
  if (!options.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cx(
              'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-bold transition',
              active ? 'border-[#f59e0b] bg-[#fff7ea] text-[#9a5a00]' : 'border-[#dce6f3] bg-white text-[#53647f] hover:bg-[#f8fbff]',
            )}
          >
            {opt.label}
            <span className={cx('rounded-full px-1.5 text-[11px]', active ? 'bg-[#f59e0b] text-white' : 'bg-[#eef2f7] text-[#61718d]')}>{opt.count}</span>
          </button>
        );
      })}
    </div>
  );
}

function buildChips(rows, getValue, order) {
  const counts = new Map();
  rows.forEach((row) => {
    const v = getValue(row);
    if (!v) return;
    counts.set(v, (counts.get(v) || 0) + 1);
  });
  const values = order ? order.filter((v) => counts.has(v)) : [...counts.keys()];
  return [{ value: 'All', label: 'All', count: rows.length }, ...values.map((v) => ({ value: v, label: v, count: counts.get(v) }))];
}

function EmptyState({ colSpan, message }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 text-center">
        <CheckCircle2 className="mx-auto size-9 text-[#9ee0b3]" />
        <p className="mt-2 text-[14px] font-extrabold text-[#1e3261]">{message}</p>
        <p className="mt-0.5 text-[12px] font-semibold text-[#8a98af]">Nothing pending — all work is up to date.</p>
      </td>
    </tr>
  );
}

function ProjectCell({ row }) {
  return (
    <>
      <div className="font-semibold leading-tight text-[#1e3261]">{row.project_name || row.project_id || '—'}</div>
      <div className="text-[11px] font-medium leading-tight text-[#8a98af]">{row.project_id || '—'}</div>
    </>
  );
}

function CustomerCell({ row }) {
  return (
    <>
      <div className="font-medium leading-tight text-[#314a79]">{row.customer_name || '—'}</div>
      <div className="text-[11px] font-medium leading-tight text-[#8a98af]">{[row.mobile_number, row.site].filter(Boolean).join(' · ') || '—'}</div>
    </>
  );
}

function ConfirmDialog({ title, message, confirmLabel, busy, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0f172a]/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
      <div className="w-full max-w-[420px] rounded-[14px] bg-white p-5 shadow-xl">
        <p className="text-[15px] font-extrabold text-[#1e3261]">{title}</p>
        <p className="mt-2 text-[13px] font-medium text-[#53647f]">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onCancel} className="h-10 rounded-[8px] border border-[#d5e0ef] px-4 text-[13px] font-semibold text-[#314a79] disabled:opacity-60">Cancel</button>
          <button type="button" disabled={busy} onClick={onConfirm} className="h-10 rounded-[8px] bg-[#16a34a] px-4 text-[13px] font-semibold text-white disabled:opacity-60">{busy ? 'Saving...' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────── Tables ───────────────── */

function WorkOrdersTable({ rows, caps, onOpenProject }) {
  return (
    <table className="crm-table crm-table--lead-dense w-full min-w-[920px]">
      <thead>
        <tr>
          {['#', 'Project', 'Customer', 'Capacity', 'Job Sheet', 'Stage', 'Pending Since', 'Action'].map((h) => (
            <th key={h} className={h === 'Action' ? 'crm-col-sticky-right' : undefined}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? <EmptyState colSpan={8} message="Work orders generated for all projects" /> : rows.map((row, i) => (
          <tr key={row.id}>
            <td className="crm-col-index">{i + 1}</td>
            <td><ProjectCell row={row} /></td>
            <td><CustomerCell row={row} /></td>
            <td className="font-semibold text-[#0b65e5]">{row.capacity_kwp > 0 ? `${row.capacity_kwp} kWp` : '—'}</td>
            <td>{row.job_sheet_no ? <span className="font-semibold text-[#1e3261]">{row.job_sheet_no}</span> : <span className="text-[#8a98af]">Not created</span>}</td>
            <td>
              <Pill tone={row.stage === 'Ready to Generate' ? 'green' : row.stage === 'Job Sheet Draft' ? 'amber' : 'slate'}>
                {row.stage}{row.stage === 'Ready to Generate' ? ` · ${row.job_sheet_assigned_rows}` : ''}
              </Pill>
            </td>
            <td>{daysLabel(row.days_pending)}</td>
            <td className="crm-col-sticky-right">
              <div className="flex gap-1.5">
                <button type="button" disabled={!caps.project} onClick={() => onOpenProject(row, 'Project Job Sheet')} className={BTN_PRIMARY}>
                  <ClipboardList className="size-3.5" />
                  {row.stage === 'Ready to Generate' ? 'Generate WO' : row.job_sheet_id ? 'Open Job Sheet' : 'Create Job Sheet'}
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function QuotationsTable({ rows, caps, onCreateQuotation, onOpenLead }) {
  return (
    <table className="crm-table crm-table--lead-dense w-full min-w-[980px]">
      <thead>
        <tr>
          {['#', 'Customer', 'Mobile', 'Project', 'Capacity', 'Assigned To', 'Won On', 'Pending', 'Action'].map((h) => (
            <th key={h} className={h === 'Action' ? 'crm-col-sticky-right' : undefined}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? <EmptyState colSpan={9} message="Quotations created for all won leads" /> : rows.map((row, i) => (
          <tr key={row.id}>
            <td className="crm-col-index">{i + 1}</td>
            <td>
              <div className="font-semibold leading-tight text-[#1e3261]">{row.customer_name || '—'}</div>
              <div className="text-[11px] font-medium leading-tight text-[#8a98af]">IVRS {row.ivrs_number || '—'}</div>
            </td>
            <td>{row.mobile_number || '—'}</td>
            <td>
              <div className="font-medium leading-tight text-[#314a79]">{row.project_name || row.project_type || '—'}</div>
              <div className="text-[11px] font-medium leading-tight text-[#8a98af]">{row.project_code || row.city || '—'}</div>
            </td>
            <td className="font-semibold text-[#0b65e5]">{row.estimated_capacity || '—'}</td>
            <td>{row.assigned_to_name || '—'}</td>
            <td>{fmtDate(row.won_on)}</td>
            <td><Pill tone={row.days_pending >= 3 ? 'red' : 'amber'}>{daysLabel(row.days_pending)}</Pill></td>
            <td className="crm-col-sticky-right">
              <div className="flex gap-1.5">
                <button type="button" disabled={!caps.quotationAdd} title={caps.quotationAdd ? undefined : 'Quotation add permission required'} onClick={() => onCreateQuotation(row)} className={BTN_PRIMARY}>
                  <FileText className="size-3.5" />
                  Create Quotation
                </button>
                <button type="button" disabled={!caps.lead} onClick={() => onOpenLead(row)} className={BTN_OUTLINE}>
                  <ExternalLink className="size-3.5" />
                  Lead
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function dispatchStageTone(stage) {
  if (stage === 'Delayed') return 'red';
  if (stage === 'Packed') return 'purple';
  if (stage === 'Partial') return 'amber';
  return 'slate';
}

function lineTone(status) {
  if (status === 'Dispatched') return 'green';
  if (status === 'Packed') return 'purple';
  if (status === 'Partial') return 'amber';
  return 'slate';
}

function DispatchTable({ rows, caps, busyKey, delayDays, onPack, onOpenProject }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const toggle = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <table className="crm-table crm-table--lead-dense w-full min-w-[1040px]">
      <thead>
        <tr>
          {['', '#', 'Project', 'Customer', 'BOM Lines', 'Pending', 'Packed', 'Partial', 'Status', 'Action'].map((h, idx) => (
            <th key={`${h}-${idx}`} className={h === 'Action' ? 'crm-col-sticky-right' : undefined}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? <EmptyState colSpan={10} message="All planned material has been dispatched" /> : rows.map((row, i) => {
          const open = expanded.has(row.id);
          const busy = busyKey === `p-${row.id}`;
          return (
            <Fragment key={row.id}>
              <tr className={row.is_delayed ? 'bg-[#fff8f8]' : undefined}>
                <td className="w-8">
                  <button type="button" onClick={() => toggle(row.id)} aria-label={open ? 'Hide lines' : 'Show lines'} className="grid size-7 place-items-center rounded-[6px] text-[#53647f] hover:bg-[#f4f7fb]">
                    {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </button>
                </td>
                <td className="crm-col-index">{i + 1}</td>
                <td><ProjectCell row={row} /></td>
                <td><CustomerCell row={row} /></td>
                <td className="font-semibold text-[#1e3261]">{row.total_lines}</td>
                <td><Pill tone="slate">{row.pending_lines}</Pill></td>
                <td><Pill tone="purple">{row.packed_lines}</Pill></td>
                <td><Pill tone="amber">{row.partial_lines}</Pill></td>
                <td>
                  <Pill tone={dispatchStageTone(row.stage)} title={row.is_delayed ? `Packed ${row.delay_days} days ago, not dispatched yet (limit ${delayDays} days)` : undefined}>
                    {row.is_delayed ? <AlertTriangle className="size-3" /> : null}
                    {row.stage}
                    {row.is_delayed ? ` · ${row.delay_days}d` : ''}
                  </Pill>
                  {row.packed_since ? <div className="mt-0.5 text-[10px] font-semibold text-[#8a98af]">Packed {fmtDate(row.packed_since)}</div> : null}
                </td>
                <td className="crm-col-sticky-right">
                  <div className="flex gap-1.5">
                    {row.pending_lines > 0 ? (
                      <button type="button" disabled={!caps.omEdit || busy} onClick={() => onPack(row, true)} className={BTN_AMBER} title="Material is packed — ready for dispatch">
                        <PackageCheck className="size-3.5" />
                        {busy ? 'Saving...' : 'Mark Packed'}
                      </button>
                    ) : row.packed_lines > 0 ? (
                      <button type="button" disabled={!caps.omEdit || busy} onClick={() => onPack(row, false)} className={BTN_OUTLINE}>
                        <Undo2 className="size-3.5" />
                        {busy ? 'Saving...' : 'Unpack'}
                      </button>
                    ) : null}
                    <button type="button" disabled={!caps.project} onClick={() => onOpenProject(row, 'Project Dispatch')} className={BTN_PRIMARY}>
                      <Truck className="size-3.5" />
                      Dispatch
                    </button>
                  </div>
                </td>
              </tr>
              {open ? (
                <tr>
                  <td colSpan={10} className="bg-[#fbfcfe] !p-0">
                    <div className="px-3 py-2.5 sm:px-10">
                      <table className="w-full text-left text-[12px]">
                        <thead>
                          <tr className="text-[10px] font-extrabold uppercase tracking-wide text-[#8a98af]">
                            <th className="py-1.5 pr-3">Category</th>
                            <th className="py-1.5 pr-3">Item / Spec</th>
                            <th className="py-1.5 pr-3">Planned</th>
                            <th className="py-1.5 pr-3">Dispatched</th>
                            <th className="py-1.5 pr-3">Left</th>
                            <th className="py-1.5 pr-3">Status</th>
                            <th className="py-1.5">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#eef2f7]">
                          {row.lines.map((line) => {
                            const lineBusy = busyKey === `l-${line.id}`;
                            const canToggle = line.status === 'Pending' || line.status === 'Packed';
                            return (
                              <tr key={line.id}>
                                <td className="py-1.5 pr-3 font-semibold text-[#1e3261]">{line.category}</td>
                                <td className="py-1.5 pr-3 text-[#53647f]">{line.items || '—'}</td>
                                <td className="py-1.5 pr-3">{line.planned_qty || '—'} {line.uom || ''}</td>
                                <td className="py-1.5 pr-3">{line.dispatched_qty || '0'}</td>
                                <td className="py-1.5 pr-3">{fmtQty(line.left_qty)}</td>
                                <td className="py-1.5 pr-3">
                                  <Pill tone={line.status === 'Packed' && line.packed_days >= delayDays ? 'red' : lineTone(line.status)}>
                                    {line.status}{line.status === 'Packed' && line.packed_days != null ? ` · ${daysLabel(line.packed_days)}` : ''}
                                  </Pill>
                                </td>
                                <td className="py-1.5">
                                  {canToggle ? (
                                    <button
                                      type="button"
                                      disabled={!caps.omEdit || lineBusy}
                                      onClick={() => onPack(row, line.status !== 'Packed', [line.id])}
                                      className={line.status === 'Packed' ? BTN_OUTLINE : BTN_AMBER}
                                    >
                                      {line.status === 'Packed' ? <Undo2 className="size-3.5" /> : <Package className="size-3.5" />}
                                      {lineBusy ? '...' : line.status === 'Packed' ? 'Unpack' : 'Packed'}
                                    </button>
                                  ) : <span className="text-[11px] font-semibold text-[#8a98af]">Update from Dispatch page</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

function InstallationTable({ rows, caps, busyKey, onMarkDone, onOpenProject }) {
  return (
    <table className="crm-table crm-table--lead-dense w-full min-w-[1040px]">
      <thead>
        <tr>
          {['#', 'Project', 'Customer', 'Capacity', 'Material', 'Tasks', 'QA', 'Target Date', 'Installation', 'Action'].map((h) => (
            <th key={h} className={h === 'Action' ? 'crm-col-sticky-right' : undefined}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? <EmptyState colSpan={10} message="All installations are done" /> : rows.map((row, i) => {
          const busy = busyKey === `i-${row.id}`;
          return (
            <tr key={row.id}>
              <td className="crm-col-index">{i + 1}</td>
              <td><ProjectCell row={row} /></td>
              <td><CustomerCell row={row} /></td>
              <td className="font-semibold text-[#0b65e5]">{row.capacity_kwp > 0 ? `${row.capacity_kwp} kWp` : '—'}</td>
              <td>
                {row.material_lines === 0
                  ? <Pill tone="slate">No BOM</Pill>
                  : <Pill tone={row.material_ready ? 'green' : 'amber'}>{row.material_ready ? 'Dispatched' : `${row.dispatched_lines}/${row.material_lines} sent`}</Pill>}
              </td>
              <td>{row.tasks_total ? `${row.tasks_done}/${row.tasks_total}` : '—'}</td>
              <td>{row.qa_total ? `${row.qa_done}/${row.qa_total}` : '—'}</td>
              <td className={row.is_overdue ? 'font-semibold text-[#dc2626]' : undefined}>
                {fmtDate(row.target_date)}
                {row.is_overdue ? <div className="text-[10px] font-bold">Overdue</div> : null}
              </td>
              <td>
                <button
                  type="button"
                  disabled={!caps.omEdit || busy}
                  onClick={() => onMarkDone(row)}
                  title={caps.omEdit ? 'Click to mark installation as Done' : 'O&M edit permission required'}
                  className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[#fecaca] bg-[#fff5f5] px-2.5 text-[11px] font-bold text-[#dc2626] transition hover:border-[#86efac] hover:bg-[#f0fdf4] hover:text-[#15803d] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  {busy ? 'Saving...' : 'Not Done'}
                </button>
              </td>
              <td className="crm-col-sticky-right">
                <div className="flex gap-1.5">
                  <button type="button" disabled={!caps.omEdit || busy} onClick={() => onMarkDone(row)} className={BTN_PRIMARY}>
                    <CheckCircle2 className="size-3.5" />
                    Mark Done
                  </button>
                  <button type="button" disabled={!caps.project} onClick={() => onOpenProject(row, 'Project Installation')} className={BTN_OUTLINE}>
                    <Wrench className="size-3.5" />
                    Open
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function InvoicesTable({ rows, caps, onOpenProject }) {
  return (
    <table className="crm-table crm-table--lead-dense w-full min-w-[980px]">
      <thead>
        <tr>
          {['#', 'Project', 'Customer', 'Project Value', 'Installation', 'Sales Challan', 'Pending', 'Action'].map((h) => (
            <th key={h} className={h === 'Action' ? 'crm-col-sticky-right' : undefined}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? <EmptyState colSpan={8} message="Invoices created for all projects" /> : rows.map((row, i) => {
          const needsChallan = row.pending_document === 'Sales Challan';
          return (
            <tr key={row.id}>
              <td className="crm-col-index">{i + 1}</td>
              <td><ProjectCell row={row} /></td>
              <td><CustomerCell row={row} /></td>
              <td className="font-semibold text-[#1e3261]">{fmtRs(row.total_value)}</td>
              <td><Pill tone={row.installation_status === 'Done' ? 'green' : 'slate'}>{row.installation_status || 'Not Done'}</Pill></td>
              <td>
                {row.challan_no ? (
                  <>
                    <div className="font-semibold leading-tight text-[#1e3261]">{row.challan_no}</div>
                    <div className="text-[11px] font-medium leading-tight text-[#8a98af]">{fmtDate(row.challan_date)} · {fmtRs(row.challan_total)}</div>
                  </>
                ) : <span className="text-[#8a98af]">Not created</span>}
              </td>
              <td><Pill tone={needsChallan ? 'amber' : 'blue'}>{row.pending_document}</Pill></td>
              <td className="crm-col-sticky-right">
                <button type="button" disabled={!caps.project} onClick={() => onOpenProject(row, needsChallan ? 'Project Sales Challan' : 'Project Invoice')} className={BTN_PRIMARY}>
                  <Receipt className="size-3.5" />
                  {needsChallan ? 'Create Sales Challan' : 'Create Invoice'}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function materialTone(status) {
  if (status === 'Out of Stock') return 'red';
  if (status === 'Project Shortage') return 'purple';
  return 'amber';
}

function MaterialsTable({ rows, caps, onOpenSection }) {
  return (
    <table className="crm-table crm-table--lead-dense w-full min-w-[1080px]">
      <thead>
        <tr>
          {['#', 'Item', 'Category', 'Warehouse', 'In Stock', 'Min Stock', 'Project Need', 'Short By', 'Reorder Value', 'Status', 'Action'].map((h) => (
            <th key={h} className={h === 'Action' ? 'crm-col-sticky-right' : undefined}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? <EmptyState colSpan={11} message="No material is short" /> : rows.map((row, i) => (
          <tr key={row.id}>
            <td className="crm-col-index">{i + 1}</td>
            <td>
              <div className="font-semibold leading-tight text-[#1e3261]">{row.name}</div>
              <div className="text-[11px] font-medium leading-tight text-[#8a98af]">{row.item_code || '—'}</div>
            </td>
            <td>{row.category || '—'}</td>
            <td>{row.warehouse || '—'}</td>
            <td className={row.current_stock <= 0 ? 'font-bold text-[#dc2626]' : 'font-semibold text-[#1e3261]'}>{fmtQty(row.current_stock)} {row.unit}</td>
            <td>{fmtQty(row.minimum_stock)}</td>
            <td>
              {row.project_demand ? (
                <span title={row.projects.join(', ')} className="font-semibold text-[#7c3aed]">
                  {fmtQty(row.project_demand)}
                  <span className="ml-1 text-[11px] font-medium text-[#8a98af]">({row.projects.length} project{row.projects.length === 1 ? '' : 's'})</span>
                </span>
              ) : '—'}
            </td>
            <td className="font-bold text-[#dc2626]">{row.shortage ? `${fmtQty(row.shortage)} ${row.unit}` : '—'}</td>
            <td>{fmtRs(row.reorder_value)}</td>
            <td><Pill tone={materialTone(row.status)}>{row.status}</Pill></td>
            <td className="crm-col-sticky-right">
              <button type="button" disabled={!caps.inventory} onClick={() => onOpenSection('Stock')} className={BTN_PRIMARY}>
                <Package className="size-3.5" />
                Add Stock
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ───────────────── Page ───────────────── */

const SEARCH_FIELDS = {
  'Pending Quotations': ['customer_name', 'mobile_number', 'ivrs_number', 'project_name', 'project_code', 'city', 'assigned_to_name'],
  'Short Listed Material': ['name', 'item_code', 'category', 'warehouse', 'status'],
};
const DEFAULT_SEARCH_FIELDS = ['project_name', 'project_id', 'customer_name', 'mobile_number', 'site', 'city', 'challan_no', 'job_sheet_no'];

const CHIP_CONFIG = {
  'Pending Work Order': { get: (r) => r.stage, order: ['No Job Sheet', 'Job Sheet Draft', 'Ready to Generate'] },
  'Pending Dispatch': { get: (r) => r.stage, order: ['Delayed', 'Packed', 'Partial', 'Pending'] },
  'Pending Installation': {
    get: (r) => {
      if (r.is_overdue) return 'Overdue';
      if (r.material_ready) return 'Material Ready';
      return 'Awaiting Material';
    },
    order: ['Overdue', 'Material Ready', 'Awaiting Material'],
  },
  'Pending Invoice': { get: (r) => r.pending_document, order: ['Sales Challan', 'Invoice'] },
  'Short Listed Material': { get: (r) => r.status, order: ['Out of Stock', 'Project Shortage', 'Low Stock'] },
};

const SECTION_HINT = {
  'Pending Work Order': 'Won projects whose work order is not generated yet. Assign tasks in the Job Sheet and click Generate to clear them from this list.',
  'Pending Quotations': 'Won leads without a quotation. They leave this list as soon as a quotation is created.',
  'Pending Dispatch': 'Planned material not yet dispatched. Click "Mark Packed" once material is packed — if it is still not dispatched after packing, it shows as Delayed.',
  'Pending Installation': 'Installation is Not Done by default. Projects leave this list once installation is marked Done.',
  'Pending Invoice': 'Shows Sales Challan pending if no challan exists, and Invoice pending once the challan is created.',
  'Short Listed Material': 'Material that is out of stock, below minimum stock, or short against pending project demand.',
};

export function OmPendingFlowPage({
  activeSection, onOpenSection, onNotify, loggedInUser, onOpenProject, onCreateQuotation, onOpenLead,
}) {
  const section = OM_PENDING_SECTIONS.includes(activeSection) ? activeSection : OM_PENDING_SECTIONS[0];
  const step = OM_PENDING_STEPS.find((s) => s.key === section);

  const caps = useMemo(() => ({
    omEdit: moduleCaps(loggedInUser, 'O&M').edit,
    project: moduleCaps(loggedInUser, 'Project Management').any,
    quotationAdd: moduleCaps(loggedInUser, 'Quotation').add,
    lead: moduleCaps(loggedInUser, 'Lead').any,
    inventory: moduleCaps(loggedInUser, 'Inventory').any,
  }), [loggedInUser]);

  const [summary, setSummary] = useState(null);
  const [data, setData] = useState({ section: null, rows: [], delayDays: 2 });
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [chip, setChip] = useState('All');
  const [busyKey, setBusyKey] = useState('');
  const [confirmDone, setConfirmDone] = useState(null);

  useEffect(() => {
    setQuery('');
    setChip('All');
  }, [section]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      omPendingApi[step.loader]().catch(() => null),
      omPendingApi.summary().catch(() => null),
    ]).then(([list, counts]) => {
      if (cancelled) return;
      if (!list) onNotify?.(`Failed to load ${section}`, 'error');
      setData({ section, rows: list?.results ?? [], delayDays: list?.delay_days ?? counts?.dispatch_delay_days ?? 2 });
      if (counts) setSummary(counts);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [section, step.loader, reloadKey, onNotify]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  const rows = data.section === section ? data.rows : [];
  const chipConfig = CHIP_CONFIG[section];
  const chips = useMemo(() => (chipConfig ? buildChips(rows, chipConfig.get, chipConfig.order) : []), [rows, chipConfig]);

  const visibleRows = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const fields = SEARCH_FIELDS[section] || DEFAULT_SEARCH_FIELDS;
    return rows.filter((row) => {
      if (chip !== 'All' && chipConfig && chipConfig.get(row) !== chip) return false;
      if (!q) return true;
      return fields.some((f) => String(row[f] ?? '').toLowerCase().includes(q));
    });
  }, [rows, deferredQuery, chip, chipConfig, section]);

  const handlePack = async (row, packed, lines) => {
    const key = lines?.length === 1 ? `l-${lines[0]}` : `p-${row.id}`;
    setBusyKey(key);
    try {
      const res = await omPendingApi.markPacked(row.id, packed, lines);
      const n = res?.updated ?? 0;
      onNotify?.(n
        ? `${n} item${n === 1 ? '' : 's'} ${packed ? 'packed — ready for dispatch' : 'moved back to Pending'}`
        : 'Nothing was updated');
      refresh();
    } catch (e) {
      onNotify?.(e.message || 'Update failed', 'error');
    } finally {
      setBusyKey('');
    }
  };

  const handleMarkDone = async () => {
    const row = confirmDone;
    if (!row) return;
    setBusyKey(`i-${row.id}`);
    try {
      await omPendingApi.setInstallation(row.id, true);
      onNotify?.(`Installation done — ${row.project_name || row.project_id}`);
      setConfirmDone(null);
      refresh();
    } catch (e) {
      onNotify?.(e.message || 'Update failed', 'error');
    } finally {
      setBusyKey('');
    }
  };

  const searchPlaceholder = section === 'Pending Quotations'
    ? 'Search customer, mobile, IVRS...'
    : section === 'Short Listed Material'
      ? 'Search item, code, category...'
      : 'Search project, customer, site...';

  let table = null;
  if (section === 'Pending Work Order') table = <WorkOrdersTable rows={visibleRows} caps={caps} onOpenProject={onOpenProject} />;
  else if (section === 'Pending Quotations') table = <QuotationsTable rows={visibleRows} caps={caps} onCreateQuotation={onCreateQuotation} onOpenLead={onOpenLead} />;
  else if (section === 'Pending Dispatch') table = <DispatchTable rows={visibleRows} caps={caps} busyKey={busyKey} delayDays={data.delayDays} onPack={handlePack} onOpenProject={onOpenProject} />;
  else if (section === 'Pending Installation') table = <InstallationTable rows={visibleRows} caps={caps} busyKey={busyKey} onMarkDone={setConfirmDone} onOpenProject={onOpenProject} />;
  else if (section === 'Pending Invoice') table = <InvoicesTable rows={visibleRows} caps={caps} onOpenProject={onOpenProject} />;
  else table = <MaterialsTable rows={visibleRows} caps={caps} onOpenSection={onOpenSection} />;

  return (
    <div className="space-y-2.5">
      <OmHeading
        title="O&M"
        crumbs={[
          { label: 'Dashboard', onClick: () => onOpenSection('Dashboard') },
          { label: 'O&M', onClick: section === OM_PENDING_SECTIONS[0] ? undefined : () => onOpenSection(OM_PENDING_SECTIONS[0]) },
          { label: section },
        ]}
        actions={(
          <button type="button" onClick={refresh} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#d5e0ef] bg-white px-4 text-[13px] font-semibold text-[#314a79] hover:bg-[#f8fbff] disabled:opacity-60">
            <RefreshCw className={cx('size-4', loading && 'animate-spin')} />
            Refresh
          </button>
        )}
      />

      <PendingFlowStrip activeSection={section} summary={summary} onOpenSection={onOpenSection} />

      <section className={cx(PANEL, 'overflow-hidden p-2.5 sm:p-3')}>
        <div className="mb-3 flex flex-col gap-2.5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-[17px] font-extrabold text-[#111827]">
              {section}
              <span className="ml-2 align-middle text-[13px] font-bold text-[#b76b00]">{rows.length}</span>
            </h2>
            <p className="text-[12px] font-semibold text-[#7386a3] sm:max-w-[60%] sm:text-right">{SECTION_HINT[section]}</p>
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-3 rounded-[10px] border border-[#dce6f3] bg-white px-4">
              <Search className="size-4 text-[#7e8fab]" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-[14px] font-medium text-[#1e3261] outline-none placeholder:text-[#8a98af]"
              />
            </label>
            <FilterChips options={chips} value={chip} onChange={setChip} />
          </div>
        </div>
        {loading && data.section !== section ? (
          <p className="py-10 text-center text-[13px] font-semibold text-[#8a98af]">Loading...</p>
        ) : (
          <div data-no-col-resize="1" className="overflow-x-auto">{table}</div>
        )}
      </section>

      {confirmDone ? (
        <ConfirmDialog
          title="Installation Done?"
          message={`${confirmDone.project_name || confirmDone.project_id} — mark installation as Done? It will be removed from Pending Installation.`}
          confirmLabel="Mark Done"
          busy={busyKey === `i-${confirmDone.id}`}
          onConfirm={handleMarkDone}
          onCancel={() => setConfirmDone(null)}
        />
      ) : null}
    </div>
  );
}
