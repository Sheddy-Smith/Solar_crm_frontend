import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle, ArrowDownLeft, ArrowUpRight, CalendarDays, CheckCircle2, ChevronDown, CreditCard,
  Download, Eye, FileText, FolderOpen, IndianRupee, Layers, Mail, MoreVertical, NotebookPen,
  Pencil, Phone, Plus, RefreshCw, Scale, Search, Trash2, TrendingDown, TrendingUp, Wallet, X,
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { accountsModuleApi, projectApi } from './api.js';
import { exportNotifyCsv, normalizeApiRows } from './lib/utils.js';
import { moduleCaps } from './settingsHubPages.jsx';
import { MobileCardEmpty, MobileCardList, MobileRecordCard } from './components/mobile/MobileRecordCard.jsx';
import { LedgerMobileCards } from './components/mobile/LedgerMobileCards.jsx';
import { MobileSubnavSelect } from './components/mobile/MobileSubnavSelect.jsx';
import { TablePagination, usePagedRows } from './components/TablePagination.jsx';
import { CustomerProfileModal } from './customerMasterHub.jsx';

function telHref(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `tel:${digits}` : null;
}

function balanceTone(value) {
  return Number(value) > 0 ? 'danger' : 'success';
}

const TABS = [
  { key: 'Customer Details', label: 'Customer Details', Icon: FolderOpen },
  { key: 'Customer Ledger', label: 'Customer Ledger', Icon: NotebookPen },
  { key: 'Overall Credit Ledger', label: 'Overall Credit Ledger', Icon: Layers },
];

const AVATAR_TONES = [
  'bg-[#dbeafe] text-[#1d4ed8]',
  'bg-[#dcfce7] text-[#15803d]',
  'bg-[#ffedd5] text-[#c2410c]',
  'bg-[#f3e8ff] text-[#7e22ce]',
  'bg-[#fce7f3] text-[#be185d]',
  'bg-[#e0e7ff] text-[#4338ca]',
];

function avatarToneFor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i) * (i + 1)) % AVATAR_TONES.length;
  return AVATAR_TONES[hash];
}

function initialsOf(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function fmtCompactLakh(v) {
  const n = Number(v || 0);
  const abs = Math.abs(n);
  if (abs >= 100000) return `₹ ${(n / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `₹ ${(n / 1000).toFixed(1)}K`;
  return fmtRs(n);
}

function buildTrendSeries(totalCredit, totalDebit) {
  const months = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
  const creditWeights = [0.12, 0.14, 0.15, 0.18, 0.20, 0.21];
  const debitWeights = [0.10, 0.13, 0.16, 0.17, 0.22, 0.22];
  return months.map((month, i) => ({
    month,
    credit: Math.round(Number(totalCredit || 0) * creditWeights[i]),
    debit: Math.round(Number(totalDebit || 0) * debitWeights[i]),
  }));
}

const emptyForm = {
  name: '',
  company: '',
  phone: '',
  alternate_phone: '',
  email: '',
  address: '',
  gstin: '',
  opening_balance: '0',
  vehicle_number: '',
  credit_limit: '0',
  credit_days: '30',
  relation: '',
  city: '',
  state: '',
};

function fmtRs(v) {
  const n = Number(v || 0);
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtCompact(v) {
  const n = Number(v || 0);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(1)}`;
}

function fmtDisplayDate(value) {
  if (!value) return '—';
  const raw = String(value).slice(0, 10);
  const [y, m, d] = raw.split('-');
  if (!y || !m || !d) return raw;
  return `${d}/${m}/${y}`;
}

const LEDGER_TYPE_LABELS = {
  sale: 'Sale',
  payment: 'Payment Received',
  discount: 'Discount',
  opening: 'Opening',
  invoice: 'Sale',
  receipt: 'Payment Received',
};

function TypeBadge({ value }) {
  const key = String(value || '').toLowerCase();
  const tone = {
    sale: 'bg-[#dbeafe] text-[#1d4ed8]',
    payment: 'bg-[#dcfce7] text-[#166534]',
    discount: 'bg-[#ffedd5] text-[#c2410c]',
    opening: 'bg-[#f1f5f9] text-[#475569]',
    invoice: 'bg-[#dbeafe] text-[#1d4ed8]',
    receipt: 'bg-[#dcfce7] text-[#166534]',
  }[key] || 'bg-[#f1f5f9] text-[#475569]';
  const label = LEDGER_TYPE_LABELS[key] || (key ? String(value) : '—');
  return <span className={`inline-flex rounded-full border border-black/5 px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide ${tone}`}>{label}</span>;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function RelationBadge({ value }) {
  const tone = {
    Good: 'bg-[#dcfce7] text-[#166534]',
    Caution: 'bg-[#fef9c3] text-[#a16207]',
    Ok: 'bg-[#dbeafe] text-[#1d4ed8]',
    Poor: 'bg-[#ffedd5] text-[#9a3412]',
    Bad: 'bg-[#fee2e2] text-[#991b1b]',
  }[value] || 'bg-[#f1f5f9] text-[#475569]';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold ${tone}`}>{value || '—'}</span>;
}

function ModalShell({ title, titleIcon, onClose, children, footer, wide, headerTone = 'default' }) {
  const headerClass = headerTone === 'blue'
    ? 'border-b border-[#1d4ed8] bg-[#0b65e5] text-white'
    : 'border-b border-[#edf2f8] bg-white text-[#111827]';
  const closeClass = headerTone === 'blue'
    ? 'text-white/80 hover:bg-white/15 hover:text-white'
    : 'text-[#7585a2] hover:bg-[#f4f7fb]';
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#0f172a]/55 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`flex max-h-[96vh] w-full flex-col overflow-hidden rounded-t-[16px] bg-white shadow-[0_24px_64px_rgba(15,23,42,0.28)] sm:max-h-[90vh] sm:rounded-[16px] ${wide ? 'max-w-[920px]' : 'max-w-[560px]'}`}>
        <div className={`flex items-center justify-between px-5 py-3.5 ${headerClass}`}>
          <div className="flex items-center gap-2">
            {titleIcon}
            <h3 className="text-[16px] font-extrabold tracking-wide">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className={`grid size-9 place-items-center rounded-full ${closeClass}`}><X className="size-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-[#edf2f8] bg-[#f8fbff] px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="grid gap-1.5 text-[12px] font-bold text-[#53647f]">
      <span>{label}{required ? <span className="text-[#dc2626]"> *</span> : ''}</span>
      {children}
    </label>
  );
}

function LedgerSectionCard({ step, title, children, action, tone = 'blue' }) {
  const bar = tone === 'green' ? 'bg-[#16a34a]' : tone === 'slate' ? 'bg-[#334155]' : 'bg-[#0b65e5]';
  return (
    <section className="relative z-0 overflow-visible rounded-[14px] border border-[#e2e9f3] bg-white shadow-[0_8px_24px_rgba(24,48,87,0.06)]">
      <div className={`flex flex-wrap items-center justify-between gap-2 rounded-t-[14px] px-4 py-3 text-white ${bar}`}>
        <h3 className="text-[14px] font-extrabold tracking-wide">
          {step ? `${step}. ${title}` : title}
        </h3>
        {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      <div className="relative z-10 overflow-visible p-4 md:p-5">{children}</div>
    </section>
  );
}

/** Numeric key from project codes like MLE-402 / PRJ-2026-0042 (trailing digits). */
function projectCodeSortKey(code = '') {
  const match = String(code || '').match(/(\d+)\s*$/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function sortProjectsByCode(rows = []) {
  return [...rows].sort((a, b) => {
    const codeA = a.project_code || a.project_id_code || a.code || '';
    const codeB = b.project_code || b.project_id_code || b.code || '';
    // project_id in breakdown is numeric PK; prefer project_code when present
    const ka = projectCodeSortKey(codeA || a.project_name);
    const kb = projectCodeSortKey(codeB || b.project_name);
    if (ka !== kb) return ka - kb;
    return String(a.project_name || '').localeCompare(String(b.project_name || ''), undefined, { numeric: true });
  });
}

function LedgerStatCard({ label, value, Icon, tone = 'blue' }) {
  const tones = {
    blue: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]',
    green: 'border-[#bbf7d0] bg-[#ecfdf5] text-[#166534]',
    red: 'border-[#fecaca] bg-[#fef2f2] text-[#dc2626]',
    orange: 'border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]',
    purple: 'border-[#ddd6fe] bg-[#f5f3ff] text-[#6d28d9]',
    slate: 'border-[#e2e8f0] bg-[#f8fafc] text-[#334155]',
  };
  return (
    <article className={`rounded-[12px] border p-3.5 shadow-sm ${tones[tone] || tones.blue}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-extrabold uppercase tracking-wide opacity-80">{label}</p>
        {Icon ? <Icon className="size-4 opacity-70" /> : null}
      </div>
      <p className="mt-2 text-[17px] font-extrabold tracking-tight sm:text-[18px]">{value}</p>
    </article>
  );
}

const inputClass = 'h-11 w-full rounded-[10px] border border-[#d9e4f2] bg-white px-3 text-[13px] font-semibold text-[#1e3261] outline-none transition focus:border-[#0b65e5] focus:ring-4 focus:ring-[#dbeafe]';
const softBtnClass = 'inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[#d9e4f2] bg-white px-3 text-[12px] font-extrabold text-[#284276] transition hover:bg-[#f8fbff] disabled:opacity-50';
const primaryBtnClass = 'inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-[#0b65e5] px-4 text-[12px] font-extrabold text-white shadow-[0_8px_18px_rgba(11,101,229,0.25)] transition hover:bg-[#0954c2] disabled:opacity-50';
function customerOptionLabel(c) {
  if (!c) return '';
  const won = Number(c.won_count || 0);
  const wonTag = won > 0 ? ` · ${won} Won` : '';
  return `${c.name || '—'}${c.phone ? ` (${c.phone})` : ''}${wonTag}`;
}

/** Fixed portal menu anchored to a trigger — avoids parent overflow/clipping bugs. */
function useAnchoredMenu(open, triggerRef, menuRef, { maxHeight = 320, minWidth = 280 } = {}) {
  const [coords, setCoords] = useState(null);

  const update = useCallback(() => {
    const el = triggerRef.current;
    if (!el || typeof window === 'undefined') {
      setCoords(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    const width = Math.max(rect.width, minWidth);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const placeAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
    const height = Math.min(maxHeight, Math.max(160, placeAbove ? spaceAbove : spaceBelow));
    setCoords({
      top: placeAbove ? undefined : rect.bottom + 6,
      bottom: placeAbove ? window.innerHeight - rect.top + 6 : undefined,
      left,
      width,
      maxHeight: height,
    });
  }, [triggerRef, maxHeight, minWidth]);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return undefined;
    }
    update();
    const onWin = () => update();
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
  }, [open, update]);

  return coords;
}

/** Searchable customer picker for ledger filters / Add New Ledger modal. */
function CustomerSearchSelect({ customers, value, onChange, placeholder = 'Choose a customer', disabled = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const inputRef = useRef(null);
  const coords = useAnchoredMenu(open && !disabled, triggerRef, menuRef, { maxHeight: 300, minWidth: 300 });

  const selected = useMemo(
    () => customers.find((c) => String(c.id) === String(value)) || null,
    [customers, value],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter((c) => {
      const hay = `${c.name || ''} ${c.phone || ''} ${c.company || ''} ${c.alternate_phone || ''}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [customers, query]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (triggerRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const menu = open && !disabled && coords && typeof document !== 'undefined'
    ? createPortal(
      <div
        ref={menuRef}
        style={{
          position: 'fixed',
          top: coords.top,
          bottom: coords.bottom,
          left: coords.left,
          width: coords.width,
          maxHeight: coords.maxHeight,
          zIndex: 9999,
        }}
        className="flex flex-col overflow-hidden rounded-[12px] border border-[#d9e4f2] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.22)]"
      >
        <div className="shrink-0 border-b border-[#edf2f8] bg-white p-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#8a98af]" />
            <input
              ref={inputRef}
              className="h-10 w-full rounded-[8px] border border-[#d9e4f2] bg-[#f8fafc] pl-8 pr-3 text-[13px] font-semibold text-[#1e3261] outline-none focus:border-[#0b65e5]"
              placeholder="Search name or phone..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className="flex w-full px-3 py-2.5 text-left text-[12px] font-semibold text-[#8a98af] hover:bg-[#f5f9ff]"
          >
            {placeholder}
          </button>
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-[12px] font-semibold text-[#8a98af]">No customer matched</p>
          ) : filtered.map((c) => {
            const active = String(c.id) === String(value);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => { onChange(String(c.id)); setOpen(false); }}
                className={`flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left hover:bg-[#f5f9ff] ${active ? 'bg-[#eff6ff]' : ''}`}
              >
                <span className={`whitespace-normal break-words text-[13px] font-extrabold leading-snug ${active ? 'text-[#0b65e5]' : 'text-[#1e3261]'}`}>
                  {c.name || '—'}
                  {Number(c.won_count || 0) > 0 ? (
                    <span className="ml-1 text-[11px] font-bold text-[#166534]">({c.won_count} Won)</span>
                  ) : null}
                </span>
                <span className="text-[11px] font-semibold text-[#64748b]">
                  {[c.phone, c.company].filter(Boolean).join(' · ') || 'No phone'}
                </span>
              </button>
            );
          })}
        </div>
      </div>,
      document.body,
    )
    : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen((v) => !v); }}
        className={`${inputClass} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:opacity-80`}
      >
        <span className={selected ? 'truncate text-[#1e3261]' : 'truncate text-[#8a98af]'}>
          {selected ? customerOptionLabel(selected) : placeholder}
        </span>
        <ChevronDown className={`size-4 shrink-0 text-[#7585a2] transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {menu}
    </div>
  );
}

function projectScopeLabel(row) {
  if (!row) return '';
  const code = row.project_code ? `${row.project_code} · ` : '';
  return `${code}${row.project_name || 'Project'}`;
}

/** Searchable project / account-scope picker with Overall + Add Another Project. */
function ProjectSearchSelect({
  projects = [],
  value,
  onChange,
  onAddProject,
  disabled = false,
  overallLabel = 'Overall – All Projects',
  showUnallocated = true,
  compact = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const inputRef = useRef(null);
  const coords = useAnchoredMenu(open && !disabled, triggerRef, menuRef, { maxHeight: 300, minWidth: 280 });

  const sortedProjects = useMemo(() => sortProjectsByCode(projects), [projects]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sortedProjects;
    return sortedProjects.filter((row) => {
      const hay = `${row.project_code || ''} ${row.project_name || ''} ${row.project_id || ''}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [sortedProjects, query]);

  const selectedLabel = useMemo(() => {
    if (!value) return overallLabel;
    if (value === '__unallocated__') return 'Unallocated advances';
    const row = sortedProjects.find((p) => String(p.project_id) === String(value));
    return row ? projectScopeLabel(row) : 'Selected project';
  }, [value, sortedProjects, overallLabel]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (triggerRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const pick = (next) => {
    onChange(next);
    setOpen(false);
  };

  const menu = open && !disabled && coords && typeof document !== 'undefined'
    ? createPortal(
      <div
        ref={menuRef}
        style={{
          position: 'fixed',
          top: coords.top,
          bottom: coords.bottom,
          left: coords.left,
          width: coords.width,
          maxHeight: coords.maxHeight,
          zIndex: 9999,
        }}
        className="flex flex-col overflow-hidden rounded-[12px] border border-[#d9e4f2] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.22)]"
      >
        <div className="shrink-0 border-b border-[#edf2f8] bg-white p-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#8a98af]" />
            <input
              ref={inputRef}
              className="h-10 w-full rounded-[8px] border border-[#d9e4f2] bg-[#f8fafc] pl-8 pr-3 text-[13px] font-semibold text-[#1e3261] outline-none focus:border-[#0b65e5]"
              placeholder="Search project code or name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
          <button
            type="button"
            onClick={() => pick('')}
            className={`flex w-full px-3 py-2.5 text-left text-[13px] font-extrabold hover:bg-[#f5f9ff] ${!value ? 'bg-[#ecfdf5] text-[#166534]' : 'text-[#1e3261]'}`}
          >
            {overallLabel}
          </button>
          {showUnallocated ? (
            <button
              type="button"
              onClick={() => pick('__unallocated__')}
              className={`flex w-full px-3 py-2.5 text-left text-[13px] font-semibold hover:bg-[#fff7ed] ${value === '__unallocated__' ? 'bg-[#fff7ed] text-[#9a3412]' : 'text-[#9a3412]'}`}
            >
              Unallocated advances
            </button>
          ) : null}
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-[12px] font-semibold text-[#8a98af]">No project matched</p>
          ) : filtered.map((row) => {
            const active = String(row.project_id) === String(value);
            return (
              <button
                key={row.project_id}
                type="button"
                onClick={() => pick(String(row.project_id))}
                className={`flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left hover:bg-[#f5f9ff] ${active ? 'bg-[#eff6ff]' : ''}`}
              >
                <span className={`whitespace-normal break-words text-[13px] font-extrabold leading-snug ${active ? 'text-[#0b65e5]' : 'text-[#1e3261]'}`}>
                  {projectScopeLabel(row)}
                </span>
                <span className="text-[11px] font-semibold text-[#64748b]">
                  Outstanding {fmtRs(row.outstanding)}
                </span>
              </button>
            );
          })}
        </div>
        {onAddProject ? (
          <div className="shrink-0 border-t border-[#edf2f8] bg-[#f8fafc] p-1.5">
            <button
              type="button"
              onClick={() => { setOpen(false); onAddProject(); }}
              className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2.5 text-left text-[13px] font-extrabold text-[#0b65e5] hover:bg-white"
            >
              <Plus className="size-4" /> Add Another Project
            </button>
          </div>
        ) : null}
      </div>,
      document.body,
    )
    : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen((v) => !v); }}
        className={`${inputClass} ${compact ? 'h-9 text-[12px]' : ''} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:opacity-80`}
      >
        <span className="truncate text-[#1e3261]">{selectedLabel}</span>
        <ChevronDown className={`size-4 shrink-0 text-[#7585a2] transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {menu}
    </div>
  );
}

export function CustomerModulePage({ activeSection, onOpenSection, onNotify, loggedInUser = null }) {
  const caps = moduleCaps(loggedInUser, 'Customer');
  // Merge Wizard + Project Reconciliation removed — legacy section keys land on Overall Credit Ledger.
  const normalizedSection = (
    activeSection === 'Customer Merge' || activeSection === 'Project Reconciliation'
  ) ? 'Overall Credit Ledger' : activeSection;
  const tab = TABS.some((t) => t.key === normalizedSection) ? normalizedSection : 'Customer Details';

  return (
    <div className="min-w-0 space-y-4">
      <div>
        <p className="text-[12px] font-semibold text-[#94a3b8]">
          Dashboard <span className="mx-1 text-[#cbd5e1]">&gt;</span> Customer Management
        </p>
        <h1 className="mt-1 text-[24px] font-extrabold tracking-tight text-[#0f172a]">Customer Management</h1>
      </div>
      <MobileSubnavSelect
        tone="green"
        items={TABS.map((item) => ({ value: item.key, label: item.label }))}
        value={tab}
        onChange={onOpenSection}
      />
      <div className="hidden flex-wrap gap-2 md:flex">
        {TABS.map((item) => {
          const active = tab === item.key;
          const Icon = item.Icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onOpenSection(item.key)}
              className={`inline-flex h-11 items-center gap-2 rounded-[12px] border px-4 text-[13px] font-extrabold transition ${
                active
                  ? 'border-[#16a34a] bg-[#16a34a] text-white shadow-[0_10px_24px_rgba(22,163,74,0.28)]'
                  : 'border-[#e2e8f0] bg-white text-[#475569] hover:border-[#bbf7d0] hover:text-[#166534]'
              }`}
            >
              {Icon ? <Icon className="size-4" /> : null}
              {item.label}
            </button>
          );
        })}
      </div>
      {tab === 'Customer Details' ? <CustomerDetailsTab caps={caps} onNotify={onNotify} onOpenSection={onOpenSection} /> : null}
      {tab === 'Customer Ledger' ? <CustomerLedgerTab onNotify={onNotify} onOpenSection={onOpenSection} /> : null}
      {tab === 'Overall Credit Ledger' ? <OverallCreditTab onNotify={onNotify} onOpenSection={onOpenSection} /> : null}
    </div>
  );
}

function CustomerDetailsTab({ caps, onNotify, onOpenSection }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [profileId, setProfileId] = useState(null);
  const [saving, setSaving] = useState(false);

  const projectItems = (row) => {
    if (Array.isArray(row?.projects) && row.projects.length) return row.projects;
    return (row?.project_labels || []).map((label, idx) => ({
      kind: 'lead',
      label,
      status: '—',
      lead_id: null,
      project_id: null,
      _key: `${label}-${idx}`,
    }));
  };

  const openProjectView = (customer, item) => {
    if (item.project_id) {
      onOpenSection?.('Project Details', `${item.label} opened`, {
        project: { id: item.project_id, project_name: item.label },
      });
      return;
    }
    if (item.lead_id) {
      onOpenSection?.('Lead Details', `${item.label} opened`, {
        lead: { id: item.lead_id, customer: customer.name, mobile: customer.phone },
      });
      return;
    }
    onNotify('No linked lead/project found for this row', 'error');
  };

  const openProjectEdit = (customer, item) => {
    if (item.lead_id) {
      onOpenSection?.('Lead Edit', `Edit ${item.label}`, {
        lead: { id: item.lead_id, customer: customer.name, mobile: customer.phone },
      });
      return;
    }
    if (item.project_id) {
      onOpenSection?.('Project Details', `${item.label} opened`, {
        project: { id: item.project_id, project_name: item.label },
      });
      return;
    }
    onNotify('No linked lead/project found for this row', 'error');
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fast path: no full lead sync on every open (use ?sync=1 only on explicit refresh).
      const data = await accountsModuleApi.customerDirectory();
      setRows(Array.isArray(data?.results) ? data.results : normalizeApiRows(data));
    } catch (e) {
      onNotify(e.message || 'Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  const refreshFromLeads = useCallback(async () => {
    setLoading(true);
    try {
      await accountsModuleApi.syncCustomersFromLeads().catch(() => null);
      const data = await accountsModuleApi.customerDirectory({ sync: 1 });
      setRows(Array.isArray(data?.results) ? data.results : normalizeApiRows(data));
      onNotify('Customers refreshed from leads', 'success');
    } catch (e) {
      onNotify(e.message || 'Failed to refresh customers', 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) => {
    const hay = `${r.name} ${r.company} ${r.phone} ${r.address} ${(r.project_labels || []).join(' ')} ${r.gstin}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });
  const { pageRows, pagination } = usePagedRows(filtered, 'customer-list', { resetKey: q });

  const save = async () => {
    if (!modal?.form?.name?.trim() || !modal.form.phone?.trim()) {
      onNotify('Name and mobile number are required', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...modal.form,
        account_type: 'Customer',
        status: 'Active',
        city: modal.form.city || (modal.form.address || '').split(',').pop()?.trim() || '',
      };
      if (modal.id) await accountsModuleApi.parties.update(modal.id, payload);
      else await accountsModuleApi.parties.create(payload);
      onNotify(modal.id ? 'Customer updated' : 'Customer added', 'success');
      setModal(null);
      await load();
    } catch (e) {
      onNotify(e.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete ${row.name}?`)) return;
    try {
      await accountsModuleApi.parties.delete(row.id);
      onNotify('Customer deleted', 'success');
      await load();
    } catch (e) {
      onNotify(e.message || 'Delete failed', 'error');
    }
  };

  return (
    <>
      <div className="rounded-[12px] border border-[#dbeafe] bg-[#f8fbff] px-3 py-2 text-[12px] font-semibold text-[#284276]">
        All Client Detail: mobile number is the customer key. All leads (New / Hot / Warm / Cool / Won / Lost) appear here once per mobile — one customer can have multiple projects (home, office, etc.).
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <input className={`${inputClass} w-full sm:max-w-xs`} placeholder="Search name, mobile, project..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" onClick={refreshFromLeads} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-extrabold text-[#284276] sm:w-auto">
          <RefreshCw className="size-4" /> Refresh from Leads
        </button>
        {caps.add ? (
        <button type="button" onClick={() => setModal({ form: { ...emptyForm } })} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] bg-[#dc2626] px-4 text-[13px] font-extrabold text-white sm:w-auto">
          <Plus className="size-4" /> Add Customer
        </button>
        ) : null}
        {caps.export ? (<button
          type="button"
          onClick={() => exportNotifyCsv(onNotify, 'customers', ['Name', 'Company', 'Phone', 'Address', 'GSTIN', 'Projects', 'Leads', 'Balance'], filtered.map((r) => [r.name, r.company, r.phone, r.address, r.gstin, r.projects_count || 0, r.leads_count || 0, r.balance]))}
          className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-extrabold text-[#284276] sm:w-auto"
        >
          <Download className="size-4" /> Export CSV
        </button>) : null}
      </div>
      {loading ? (
        <p className="py-8 text-center text-[13px] font-semibold text-[#7a8fa6] lg:hidden">Loading customers from leads...</p>
      ) : filtered.length === 0 ? (
        <MobileCardEmpty title="No customers yet" hint="Add a lead or customer with a mobile number." />
      ) : (
        <MobileCardList>
          {pageRows.map((r) => {
            const projectCount = Number(r.projects_count || r.leads_count || 0);
            return (
              <MobileRecordCard
                key={r.id}
                avatar={r.name}
                title={r.name}
                subtitle={[r.phone, r.company].filter(Boolean).join(' · ')}
                aside={<span className={Number(r.balance) > 0 ? 'text-[#dc2626]' : 'text-[#166534]'}>{fmtRs(r.balance)}</span>}
                badges={(
                  <>
                    {r.relation ? <RelationBadge value={r.relation} /> : null}
                    <span className="inline-flex items-center rounded-full bg-[#eff6ff] px-2 py-0.5 text-[10px] font-extrabold text-[#1d4ed8]">
                      {projectCount} project{projectCount === 1 ? '' : 's'}
                    </span>
                  </>
                )}
                details={[
                  { label: 'GSTIN', value: r.gstin },
                  { label: 'Address', value: r.address || r.city, wide: true },
                ]}
                onOpen={caps.view ? () => setProfileId(r.id) : undefined}
                actions={[
                  { label: 'Call', icon: Phone, tone: 'green', href: telHref(r.phone), disabled: !telHref(r.phone) },
                  caps.view ? { label: 'Profile', icon: Eye, tone: 'blue', onClick: () => setProfileId(r.id) } : null,
                  caps.edit ? { label: 'Edit', icon: Pencil, tone: 'slate', onClick: () => setModal({ id: r.id, form: { ...emptyForm, ...r } }) } : null,
                ]}
                menu={caps.delete ? [{ label: 'Delete', icon: Trash2, danger: true, onClick: () => remove(r) }] : []}
              />
            );
          })}
        </MobileCardList>
      )}
      <div className="hidden overflow-x-auto rounded-[8px] border border-[#e2e9f3] bg-white lg:block">
        <table className="min-w-[860px] w-full border-collapse text-left text-[12px]">
          <thead className="bg-[#f8fbff] text-[10px] font-extrabold uppercase tracking-wide text-[#7a8fa6]">
            <tr>
              {['Name', 'Company', 'Phone', 'Address', 'GSTIN', 'Projects', 'Relation', 'Balance', 'Actions'].map((h) => (
                <th key={h} className="px-2 py-1">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-2 py-6 text-center text-[#7a8fa6]">Loading customers from leads...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-2 py-6 text-center text-[#7a8fa6]">No customers yet. Add a lead or customer with a mobile number.</td></tr>
            ) : pageRows.map((r) => (
              <tr key={r.id} className="border-t border-[#edf2f8]">
                <td className="px-2 py-1 font-extrabold text-[#1e3261]">{r.name}</td>
                <td className="px-2 py-1">{r.company || '—'}</td>
                <td className="px-2 py-1 font-extrabold text-[#0b65e5]">{r.phone || '—'}</td>
                <td className="px-2 py-1">{r.address || r.city || '—'}</td>
                <td className="px-2 py-1">{r.gstin || '—'}</td>
                <td className="px-2 py-1">
                  <button
                    type="button"
                    onClick={() => setDetail(r)}
                    className="inline-flex items-center gap-1 rounded-full bg-[#eff6ff] px-2 py-0.5 text-[10px] font-extrabold text-[#1d4ed8] hover:bg-[#dbeafe]"
                    title={(r.project_labels || []).join(', ')}
                  >
                    {Number(r.projects_count || r.leads_count || 0)} project{(Number(r.projects_count || r.leads_count || 0) === 1) ? '' : 's'}
                  </button>
                </td>
                <td className="px-2 py-1"><RelationBadge value={r.relation} /></td>
                <td className={`px-2 py-1 font-extrabold ${Number(r.balance) > 0 ? 'text-[#dc2626]' : 'text-[#166534]'}`}>{fmtRs(r.balance)}</td>
                <td className="px-2 py-1">
                  <div className="flex gap-0.5">
                    {caps.view ? (<button type="button" onClick={() => setProfileId(r.id)} className="grid size-7 place-items-center rounded-[6px] text-[#0b65e5] hover:bg-[#eff6ff]" title="Open customer profile"><Eye className="size-3.5" /></button>) : null}
                    {caps.edit ? (<button type="button" onClick={() => setModal({ id: r.id, form: { ...emptyForm, ...r } })} className="grid size-7 place-items-center rounded-[6px] text-[#0b65e5] hover:bg-[#eff6ff]"><Pencil className="size-3.5" /></button>) : null}
                    {caps.delete ? (<button type="button" onClick={() => remove(r)} className="grid size-7 place-items-center rounded-[6px] text-[#dc2626] hover:bg-[#fef2f2]"><Trash2 className="size-3.5" /></button>) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading ? <TablePagination {...pagination} className="rounded-[8px] border border-[#e2e9f3]" /> : null}
      {modal ? (
        <ModalShell
          title={modal.id ? 'Edit Customer' : 'Add New Customer'}
          onClose={() => setModal(null)}
          footer={(
            <>
              <button type="button" onClick={() => setModal(null)} className="h-10 rounded-[8px] border px-4 text-[13px] font-semibold">Cancel</button>
              <button type="button" disabled={saving} onClick={save} className="h-10 rounded-[8px] bg-[#dc2626] px-4 text-[13px] font-extrabold text-white disabled:opacity-60">{saving ? 'Saving...' : 'Save Customer'}</button>
            </>
          )}
        >
          <div className="grid gap-3">
            <Field label="Name" required><input className={inputClass} value={modal.form.name || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, name: e.target.value } }))} /></Field>
            <Field label="Company"><input className={inputClass} value={modal.form.company || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, company: e.target.value } }))} /></Field>
            <Field label="Primary Mobile" required><input className={inputClass} value={modal.form.phone || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, phone: e.target.value } }))} /></Field>
            <Field label="Alternate Mobile"><input className={inputClass} value={modal.form.alternate_phone || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, alternate_phone: e.target.value } }))} /></Field>
            <p className="text-[11px] font-semibold text-[#7a8fa6]">Primary mobile is the Customer Master lookup key (not IVRS). Duplicate primary mobiles show a warning — merge only via authorized Merge flow.</p>
            <Field label="Email"><input className={inputClass} value={modal.form.email || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, email: e.target.value } }))} /></Field>
            <Field label="Address"><textarea className={`${inputClass} h-20 py-2`} value={modal.form.address || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, address: e.target.value } }))} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City"><input className={inputClass} value={modal.form.city || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, city: e.target.value } }))} /></Field>
              <Field label="State"><input className={inputClass} value={modal.form.state || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, state: e.target.value } }))} /></Field>
            </div>
            <Field label="GSTIN"><input className={inputClass} placeholder="15 character GST number" maxLength={15} value={modal.form.gstin || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, gstin: e.target.value } }))} /></Field>
            <Field label="Opening Balance (₹)"><input type="number" className={inputClass} value={modal.form.opening_balance || '0'} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, opening_balance: e.target.value } }))} /></Field>
            <p className="text-[11px] font-semibold text-[#7a8fa6]">Enter positive value if customer owes you money</p>
            <Field label="Vehicle Number"><input className={inputClass} placeholder="Vehicle Number" value={modal.form.vehicle_number || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, vehicle_number: e.target.value } }))} /></Field>
            <Field label="Credit Limit (₹)"><input type="number" className={inputClass} value={modal.form.credit_limit || '0'} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, credit_limit: e.target.value } }))} /></Field>
            <Field label="Credit Days"><input type="number" className={inputClass} value={modal.form.credit_days || '30'} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, credit_days: e.target.value } }))} /></Field>
          </div>
        </ModalShell>
      ) : null}
      {profileId ? (
        <CustomerProfileModal
          customerId={profileId}
          onClose={() => setProfileId(null)}
          onNotify={onNotify}
          onOpenSection={onOpenSection}
        />
      ) : null}
      {detail ? (
        <ModalShell
          title={`${detail.name} · ${detail.phone || 'No mobile'}`}
          onClose={() => setDetail(null)}
          footer={(
            <>
              <button type="button" onClick={() => { setProfileId(detail.id); setDetail(null); }} className="h-10 rounded-[8px] bg-[#0b65e5] px-4 text-[13px] font-extrabold text-white">Open full profile</button>
              <button type="button" onClick={() => setDetail(null)} className="h-10 rounded-[8px] border px-4 text-[13px] font-semibold">Close</button>
            </>
          )}
        >
          <div className="space-y-3">
            <p className="text-[12px] font-semibold text-[#53647f]">
              {detail.leads_count || 0} lead(s) · statuses: {(detail.lead_statuses || []).join(', ') || '—'}
            </p>
            {projectItems(detail).length === 0 ? (
              <p className="text-[13px] font-semibold text-[#7a8fa6]">No projects/leads linked to this mobile yet.</p>
            ) : (
              <ul className="space-y-2">
                {projectItems(detail).map((item, idx) => (
                  <li
                    key={item._key || `${item.kind}-${item.lead_id || ''}-${item.project_id || ''}-${idx}`}
                    className="flex items-center justify-between gap-3 rounded-[10px] border border-[#e2e9f3] bg-[#f8fbff] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-[#1e3261]">{item.label}</p>
                      {item.status && item.status !== '—' ? (
                        <p className="text-[11px] font-semibold text-[#7a8fa6]">{item.kind === 'project' ? 'Project' : 'Lead'} · {item.status}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => openProjectView(detail, item)}
                        className="grid size-8 place-items-center rounded-[8px] text-[#0b65e5] hover:bg-[#eff6ff]"
                        title="View"
                      >
                        <Eye className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openProjectEdit(detail, item)}
                        className="grid size-8 place-items-center rounded-[8px] text-[#0b65e5] hover:bg-[#eff6ff]"
                        title="Edit"
                      >
                        <Pencil className="size-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}

const LEDGER_PAYMENT_MODE_OPTIONS = [
  'UPI',
  'PhonePe',
  'Google Pay',
  'Cash',
  'Online Transfer',
  'NEFT',
  'RTGS',
  'Cheque',
  'Other',
];

const emptyLedgerForm = () => ({
  party_id: '',
  entry_date: todayIso(),
  entry_type: 'sale',
  payment_mode: '',
  amount: '',
  vehicle_no: '',
  reference_no: '',
  work: '',
  project_id: '',
  project_name: '',
  project_code: '',
});

function ledgerTypeNeedsPaymentMode(entryType) {
  return String(entryType || '') === 'payment';
}

function CustomerLedgerTab({ onNotify, onOpenSection }) {
  const [customers, setCustomers] = useState([]);
  const [partyId, setPartyId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [projectRows, setProjectRows] = useState([]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [q, setQ] = useState('');
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [detail, setDetail] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [ledgerModal, setLedgerModal] = useState(null);
  const [modalProjects, setModalProjects] = useState([]);
  const [savingLedger, setSavingLedger] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [addProjectForm, setAddProjectForm] = useState({
    project_name: '',
    capacity_kwp: '',
    project_type: 'On-Grid',
    site: '',
    mobile: '',
  });

  const loadCustomers = useCallback(async () => {
    try {
      // Dedicated unpaginated Won/quoted picker — avoids page_size truncation.
      const data = await accountsModuleApi.wonClients();
      setCustomers(normalizeApiRows(data));
      // Won-only sync in background, then refresh picker so new Won leads appear.
      accountsModuleApi.syncCustomersFromLeads({ won_only: 1 })
        .then(async () => {
          const again = await accountsModuleApi.wonClients();
          setCustomers(normalizeApiRows(again));
        })
        .catch(() => null);
    } catch (e) {
      onNotify(e.message || 'Failed to load customers', 'error');
    }
  }, [onNotify]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const fetchProjectRows = useCallback(async (id) => {
    if (!id) return [];
    try {
      const data = await accountsModuleApi.partyProjectAccounts(id);
      return sortProjectsByCode(data?.projects || []);
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    setProjectId('');
    if (!partyId) {
      setProjectRows([]);
      return undefined;
    }
    let cancelled = false;
    fetchProjectRows(partyId).then((rows) => {
      if (!cancelled) setProjectRows(rows);
    });
    return () => { cancelled = true; };
  }, [partyId, fetchProjectRows]);

  useEffect(() => {
    const modalParty = ledgerModal?.form?.party_id;
    if (!modalParty) {
      setModalProjects([]);
      return undefined;
    }
    // Instant fallback when modal customer matches page customer (primary scope list).
    if (String(modalParty) === String(partyId) && projectRows.length) {
      setModalProjects(projectRows);
    }
    let cancelled = false;
    fetchProjectRows(modalParty).then((rows) => {
      if (!cancelled) setModalProjects(rows);
    });
    return () => { cancelled = true; };
  }, [ledgerModal?.form?.party_id, ledgerModal?.mode, partyId, projectRows, fetchProjectRows]);

  // Hydrate Project Name / ID labels once project list loads (edit / prefill).
  useEffect(() => {
    if (!ledgerModal?.form?.project_id || !modalProjects.length) return;
    const row = modalProjects.find((p) => String(p.project_id) === String(ledgerModal.form.project_id));
    if (!row) return;
    if (ledgerModal.form.project_name && ledgerModal.form.project_code) return;
    setLedgerModal((m) => {
      if (!m?.form?.project_id) return m;
      return {
        ...m,
        form: {
          ...m.form,
          project_name: m.form.project_name || row.project_name || '',
          project_code: m.form.project_code || row.project_code || '',
        },
      };
    });
  }, [modalProjects, ledgerModal?.form?.project_id]);

  const loadLedger = useCallback(async () => {
    if (!partyId) {
      setPayload(null);
      return;
    }
    setLoading(true);
    try {
      const params = { lite: '1' };
      if (start) params.start = start;
      if (end) params.end = end;
      if (projectId === '__unallocated__') params.unallocated = 'true';
      else if (projectId) params.project_id = projectId;
      // First paint: lite ledger (skip work_profile + full breakdown). Full KPIs load on demand if needed.
      const qs = new URLSearchParams(params).toString();
      setPayload(await accountsModuleApi.partyLedger(partyId, qs));
    } catch (e) {
      onNotify(e.message || 'Failed to load ledger', 'error');
    } finally {
      setLoading(false);
    }
  }, [partyId, projectId, start, end, onNotify]);

  useEffect(() => { loadLedger(); }, [loadLedger, reloadKey]);

  const selected = useMemo(
    () => customers.find((c) => String(c.id) === String(partyId)) || payload?.party || null,
    [customers, partyId, payload],
  );

  const entries = useMemo(() => {
    const rows = payload?.results || [];
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((e) => `${e.particulars || ''} ${e.work || ''} ${e.ref || ''} ${e.project_name || ''} ${e.project_code || ''} ${e.vehicle_no || ''} ${e.type_label || ''} ${e.payment_mode || ''}`.toLowerCase().includes(needle));
  }, [payload, q]);
  const { pageRows: pageEntries, pagination } = usePagedRows(entries, 'customer-ledger', { resetKey: `${partyId}|${start}|${end}|${q}` });

  const summary = payload?.summary || {
    total_debit: entries.reduce((s, e) => s + Number(e.debit || 0), 0),
    total_credit: entries.reduce((s, e) => s + Number(e.credit || 0), 0),
    credit_15_plus: 0,
    current_balance: entries.length ? Number(entries[entries.length - 1].balance || 0) : 0,
    previous_balance: 0,
    opening: Number(selected?.opening_balance || 0),
    project_cost: 0,
    work_completion_pct: 0,
    work_done_value: 0,
    received_payment: 0,
    outstanding_amount: 0,
    remaining_work_value: 0,
  };

  const finalBalance = Number(summary.final_balance ?? summary.current_balance ?? 0);
  const finalIsCredit = finalBalance < 0;

  const refreshAll = async () => {
    await loadCustomers();
    setReloadKey((k) => k + 1);
    onNotify('Ledger refreshed', 'success');
  };

  const fixDuplicates = async () => {
    setFixing(true);
    try {
      const res = await accountsModuleApi.detectCustomerDuplicates();
      const groups = res?.results || [];
      await loadCustomers();
      setReloadKey((k) => k + 1);
      onNotify(
        groups.length
          ? `Found ${groups.length} duplicate mobile group(s). Auto-merge is disabled — review customer records manually.`
          : 'No duplicate mobiles found',
        groups.length ? 'error' : 'success',
      );
    } catch (e) {
      onNotify(e.message || 'Duplicate detection failed', 'error');
    } finally {
      setFixing(false);
    }
  };

  const exportCsv = () => {
    if (!entries.length) {
      onNotify('No ledger entries to export', 'error');
      return;
    }
    exportNotifyCsv(
      onNotify,
      `customer-ledger-${selected?.phone || selected?.name || partyId}`,
      ['Date', 'Project Name', 'Project ID', 'Type', 'Payment Mode', 'Challan/Receipt No', 'Work', 'Debit', 'Credit', 'Balance'],
      entries.map((e) => [
        e.date,
        e.project_name || '',
        e.project_code || '',
        LEDGER_TYPE_LABELS[String(e.type_label || e.type || '').toLowerCase()] || (e.type_label || e.type || ''),
        e.payment_mode || '',
        e.ref,
        e.work || e.particulars,
        e.debit,
        e.credit,
        e.balance,
      ]),
    );
  };

  const savePdf = () => {
    if (!partyId || !entries.length) {
      onNotify('Select a customer with ledger entries to save PDF', 'error');
      return;
    }
    window.print();
  };

  const applyLedgerProject = (nextId, rows = modalProjects) => {
    if (!nextId || nextId === '__unallocated__') {
      return { project_id: '', project_name: '', project_code: '' };
    }
    const row = rows.find((p) => String(p.project_id) === String(nextId));
    return {
      project_id: String(nextId),
      project_name: row?.project_name || '',
      project_code: row?.project_code || '',
    };
  };

  const openAddLedger = () => {
    const form = emptyLedgerForm();
    if (partyId) form.party_id = String(partyId);
    if (projectId && projectId !== '__unallocated__') {
      Object.assign(form, applyLedgerProject(projectId, projectRows));
    }
    setLedgerModal({ mode: 'create', form });
  };

  const openAddProject = () => {
    if (!partyId) {
      onNotify('Pehle customer select karein', 'error');
      return;
    }
    setAddProjectForm({
      project_name: '',
      capacity_kwp: '',
      project_type: 'On-Grid',
      site: selected?.city || selected?.address || '',
      mobile: '',
    });
    setAddProjectOpen(true);
  };

  const saveAnotherProject = async () => {
    if (!partyId) {
      onNotify('Customer required', 'error');
      return;
    }
    const name = String(addProjectForm.project_name || '').trim();
    const capacity = Number(addProjectForm.capacity_kwp);
    if (!name) {
      onNotify('Project name required', 'error');
      return;
    }
    if (!(capacity > 0)) {
      onNotify('Capacity (kWp) must be greater than zero', 'error');
      return;
    }
    const extraMobile = String(addProjectForm.mobile || '').replace(/\D/g, '');
    const primaryPhone = String(selected?.phone || '').replace(/\D/g, '');
    setSavingProject(true);
    try {
      const created = await projectApi.create({
        project_name: name,
        customer_name: selected?.name || name,
        customer: Number(partyId) || partyId,
        capacity_kwp: capacity,
        project_type: addProjectForm.project_type || 'On-Grid',
        site: addProjectForm.site || '',
        status: 'Planning',
        priority: 'Medium',
      });
      if (extraMobile && extraMobile !== primaryPhone.slice(-10) && extraMobile.slice(-10) !== primaryPhone.slice(-10)) {
        await accountsModuleApi.parties.update(partyId, {
          alternate_phone: extraMobile.slice(-10) || extraMobile,
        }).catch(() => null);
        await loadCustomers();
      }
      const rows = await fetchProjectRows(partyId);
      setProjectRows(rows);
      const newId = created?.id;
      if (newId) setProjectId(String(newId));
      else if (rows?.length) setProjectId(String(rows[rows.length - 1].project_id));
      setAddProjectOpen(false);
      setReloadKey((k) => k + 1);
      onNotify(
        created?.project_id
          ? `Project ${created.project_id} linked to this customer`
          : 'Another project added for this customer',
        'success',
      );
    } catch (e) {
      onNotify(e.message || 'Failed to add project', 'error');
    } finally {
      setSavingProject(false);
    }
  };

  const deleteLedgerEntry = async (entry) => {
    if (!partyId || entry?.source_kind !== 'manual_ledger' || !entry?.source_id) {
      onNotify('Only manual ledger entries can be deleted', 'error');
      return;
    }
    if (!window.confirm('Delete this ledger entry? This cannot be undone.')) return;
    try {
      await accountsModuleApi.deleteLedgerEntry(partyId, entry.source_id);
      setDetail(null);
      setReloadKey((k) => k + 1);
      onNotify('Ledger entry deleted', 'success');
    } catch (e) {
      onNotify(e.message || 'Delete failed', 'error');
    }
  };

  const openEditLedger = (entry) => {
    if (!partyId || entry?.source_kind !== 'manual_ledger' || !entry?.source_id) {
      onNotify('Only manual ledger entries can be edited', 'error');
      return;
    }
    const entryType = String(entry.type_label || entry.type || 'sale').toLowerCase();
    const normalizedType = entryType === 'invoice' ? 'sale' : entryType === 'receipt' ? 'payment' : entryType;
    setDetail(null);
    setLedgerModal({
      mode: 'edit',
      entryId: entry.source_id,
      form: {
        party_id: String(partyId),
        entry_date: String(entry.date || todayIso()).slice(0, 10),
        entry_type: ['sale', 'payment', 'discount'].includes(normalizedType) ? normalizedType : 'sale',
        payment_mode: entry.payment_mode || '',
        amount: entry.debit || entry.credit || '',
        vehicle_no: entry.vehicle_no || '',
        reference_no: entry.ref || '',
        work: entry.work || entry.particulars || '',
        project_id: entry.project_id ? String(entry.project_id) : '',
        project_name: entry.project_name || '',
        project_code: entry.project_code || '',
      },
    });
  };

  const saveLedgerEntry = async () => {
    const form = ledgerModal?.form || {};
    const targetId = String(form.party_id || '').trim();
    if (!targetId) {
      onNotify('Please select a customer', 'error');
      return;
    }
    if (!form.entry_date) {
      onNotify('Date is required', 'error');
      return;
    }
    if (!form.entry_type) {
      onNotify('Transaction Type is required', 'error');
      return;
    }
    if (ledgerTypeNeedsPaymentMode(form.entry_type) && !String(form.payment_mode || '').trim()) {
      onNotify('Payment Mode is required for Payment Received', 'error');
      return;
    }
    const amount = Number(form.amount);
    if (!(amount > 0)) {
      onNotify('Amount must be greater than zero', 'error');
      return;
    }
    const payload = {
      entry_date: form.entry_date,
      entry_type: form.entry_type,
      payment_mode: ledgerTypeNeedsPaymentMode(form.entry_type) ? form.payment_mode : '',
      amount,
      vehicle_no: form.vehicle_no || '',
      reference_no: form.reference_no || '',
      work: form.work || '',
      project_id: form.project_id || null,
    };
    setSavingLedger(true);
    try {
      if (ledgerModal?.mode === 'edit' && ledgerModal?.entryId) {
        await accountsModuleApi.updateLedgerEntry(targetId, ledgerModal.entryId, payload);
        onNotify('Ledger entry updated', 'success');
      } else {
        await accountsModuleApi.addLedgerEntry(targetId, payload);
        onNotify('Ledger entry saved', 'success');
      }
      setLedgerModal(null);
      setPartyId(targetId);
      setReloadKey((k) => k + 1);
    } catch (e) {
      onNotify(e.message || 'Failed to save ledger entry', 'error');
    } finally {
      setSavingLedger(false);
    }
  };

  const kpiCards = [
    { label: 'Project Cost', value: fmtRs(summary.project_cost), tone: 'blue', Icon: IndianRupee },
    { label: 'Received Payment', value: fmtRs(summary.received_payment ?? summary.total_credit), tone: 'green', Icon: TrendingDown },
    { label: 'Outstanding', value: fmtRs(summary.outstanding_amount), tone: 'red', Icon: AlertCircle },
    { label: 'Work Done', value: fmtRs(summary.work_done_value), tone: 'purple', Icon: Wallet },
    { label: 'Work Completion', value: `${Number(summary.work_completion_pct || 0).toFixed(1)}%`, tone: 'green', Icon: TrendingUp },
    { label: 'Remaining Work', value: fmtRs(summary.remaining_work_value), tone: 'orange', Icon: Wallet },
  ];

  const txnTypes = [
    { value: 'sale', label: 'Sale', hint: 'Debit · increases due', tone: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]' },
    { value: 'payment', label: 'Payment Received', hint: 'Credit · reduces due', tone: 'border-[#bbf7d0] bg-[#ecfdf5] text-[#166534]' },
    { value: 'discount', label: 'Discount', hint: 'Credit · goodwill', tone: 'border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]' },
  ];

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-tight text-[#0f172a]">Client Ledger</h2>
          <p className="mt-1 text-[13px] font-semibold text-[#53647f]">
            Customer-wise Sale, Payment Received aur Discount entries — Payment Mode ke saath clean accounting view.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={refreshAll} className={softBtnClass}><RefreshCw className="size-3.5" /> Refresh</button>
          <button type="button" disabled={!entries.length} onClick={exportCsv} className={softBtnClass}><Download className="size-3.5" /> CSV</button>
          <button type="button" disabled={!entries.length} onClick={savePdf} className={softBtnClass}><FileText className="size-3.5" /> PDF</button>
          <button type="button" disabled={fixing} onClick={fixDuplicates} className={`${softBtnClass} border-[#fecaca] bg-[#fef2f2] text-[#dc2626]`}>
            {fixing ? 'Scanning...' : 'Detect Duplicates'}
          </button>
          <button type="button" onClick={() => onOpenSection?.('Customer Details')} className={softBtnClass}><Plus className="size-3.5" /> Add Customer</button>
          <button type="button" onClick={openAddLedger} className={primaryBtnClass}><Plus className="size-3.5" /> Add New Ledger</button>
        </div>
      </div>

      <LedgerSectionCard
        step="1"
        title="Select Customer & Filters"
        action={(
          <button type="button" onClick={openAddLedger} className="inline-flex h-8 items-center gap-1 rounded-[8px] bg-white/15 px-3 text-[11px] font-extrabold text-white hover:bg-white/25">
            <Plus className="size-3.5" /> New Entry
          </button>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Field label="Select Customer" required>
            <CustomerSearchSelect
              customers={customers}
              value={partyId}
              onChange={setPartyId}
              placeholder="Search name or mobile"
            />
          </Field>
          <Field label="Account Scope / Project">
            <ProjectSearchSelect
              projects={projectRows}
              value={projectId}
              onChange={setProjectId}
              onAddProject={openAddProject}
              disabled={!partyId}
              overallLabel="Overall – All Projects"
            />
          </Field>
          <Field label="Start Date"><input type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="End Date"><input type="date" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          <Field label="Search Entries">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a98af]" />
              <input className={`${inputClass} pl-9`} placeholder="Type, mode, work, ref..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </Field>
        </div>
        {payload?.breakdown?.projects?.length ? (
          <div className="mt-4 overflow-x-auto rounded-[12px] border border-[#e8eef7]">
            <table className="min-w-full text-left text-[12px]">
              <thead className="bg-[#f8fbff] text-[#53647f]">
                <tr>
                  <th className="px-3 py-2.5 font-extrabold">Project</th>
                  <th className="px-3 py-2.5 font-extrabold">Invoiced</th>
                  <th className="px-3 py-2.5 font-extrabold">Received</th>
                  <th className="px-3 py-2.5 font-extrabold">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {sortProjectsByCode(payload.breakdown.projects).map((row) => (
                  <tr key={row.project_id} className="border-t border-[#eef2f8]">
                    <td className="px-3 py-2.5 font-bold text-[#1e3261]">
                      {row.project_code ? <span className="mr-1.5 text-[#0b65e5]">{row.project_code}</span> : null}
                      {row.project_name}
                    </td>
                    <td className="px-3 py-2.5">{fmtRs(row.invoiced)}</td>
                    <td className="px-3 py-2.5">{fmtRs(row.received)}</td>
                    <td className="px-3 py-2.5 font-extrabold">{fmtRs(row.outstanding)}</td>
                  </tr>
                ))}
                <tr className="border-t border-[#e2e9f3] bg-[#fff7ed]">
                  <td className="px-3 py-2.5 font-extrabold text-[#9a3412]">Unallocated</td>
                  <td className="px-3 py-2.5">{fmtRs(payload.breakdown.unallocated?.invoiced)}</td>
                  <td className="px-3 py-2.5">{fmtRs(payload.breakdown.unallocated?.received)}</td>
                  <td className="px-3 py-2.5 font-extrabold">{fmtRs(payload.breakdown.unallocated?.outstanding)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </LedgerSectionCard>

      {!partyId ? (
        <LedgerSectionCard step="2" title="Ledger Workspace" tone="slate">
          <div className="rounded-[12px] border border-dashed border-[#d9e4f2] bg-[#f8fbff] px-4 py-14 text-center">
            <Wallet className="mx-auto size-10 text-[#bfdbfe]" />
            <p className="mt-3 text-[15px] font-extrabold text-[#1e3261]">Customer select karein</p>
            <p className="mt-1 text-[13px] font-semibold text-[#7a8fa6]">Ledger entries, payment mode aur outstanding yahin dikhenge.</p>
          </div>
        </LedgerSectionCard>
      ) : (
        <>
          <LedgerSectionCard
            step="2"
            title="Account Summary"
            action={(
              <div className="min-w-[220px] max-w-[320px]">
                <ProjectSearchSelect
                  projects={projectRows}
                  value={projectId}
                  onChange={setProjectId}
                  onAddProject={openAddProject}
                  overallLabel="Overall – All Projects"
                  showUnallocated
                  compact
                />
              </div>
            )}
          >
            <p className="mb-3 text-[12px] font-semibold text-[#53647f]">
              Scope:{' '}
              <span className="font-extrabold text-[#0f172a]">
                {!projectId
                  ? 'Overall – All Projects (combined)'
                  : projectId === '__unallocated__'
                    ? 'Unallocated advances'
                    : (projectRows.find((r) => String(r.project_id) === String(projectId))?.project_name || 'Selected project')}
              </span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {kpiCards.map((card) => (
                <LedgerStatCard key={card.label} {...card} />
              ))}
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-[12px] border border-[#bfdbfe] bg-[#f8fbff] p-4">
                <p className="mb-3 text-[11px] font-extrabold uppercase tracking-wide text-[#1d4ed8]">Customer Snapshot</p>
                <div className="space-y-2.5 text-[13px]">
                  <p className="flex items-center gap-2 font-extrabold text-[#0f172a]"><CheckCircle2 className="size-4 text-[#0b65e5]" />{selected?.name || '—'}</p>
                  <p className="flex items-center gap-2 font-semibold text-[#334155]"><Phone className="size-4 text-[#64748b]" />{selected?.phone || '—'}</p>
                  <p className="flex items-center gap-2 font-semibold text-[#334155]"><Mail className="size-4 text-[#64748b]" />{selected?.email || 'N/A'}</p>
                  <p className="flex items-center gap-2 font-semibold text-[#334155]"><IndianRupee className="size-4 text-[#64748b]" />Opening {fmtRs(selected?.opening_balance || summary.opening || 0)}</p>
                </div>
              </div>
              <div className="rounded-[12px] border border-[#bbf7d0] bg-[#f0fdf4] p-4">
                <p className="mb-3 text-[11px] font-extrabold uppercase tracking-wide text-[#166534]">Balance Impact</p>
                <div className="grid grid-cols-2 gap-3 text-[13px]">
                  <div>
                    <p className="text-[11px] font-bold text-[#64748b]">Total Debit</p>
                    <p className="mt-1 text-[18px] font-extrabold text-[#dc2626]">{fmtRs(summary.total_debit)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-[#64748b]">Total Credit</p>
                    <p className="mt-1 text-[18px] font-extrabold text-[#166534]">{fmtRs(summary.total_credit)}</p>
                  </div>
                  <div className="col-span-2 rounded-[10px] border border-[#bbf7d0] bg-white px-3 py-2.5">
                    <p className="text-[11px] font-bold text-[#64748b]">Final Balance</p>
                    <p className={`mt-1 text-[18px] font-extrabold ${finalIsCredit ? 'text-[#166534]' : 'text-[#dc2626]'}`}>
                      {fmtRs(Math.abs(finalBalance))} ({finalIsCredit ? 'Cr' : 'Dr'})
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </LedgerSectionCard>

          <LedgerSectionCard
            step="3"
            title="Ledger Entries"
            tone="green"
            action={(
              <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-extrabold">
                {entries.length} rows
              </span>
            )}
          >
            {loading ? (
              <p className="py-10 text-center text-[13px] font-semibold text-[#7a8fa6]">Loading...</p>
            ) : (
              <>
              <LedgerMobileCards
                entries={pageEntries}
                emptyText="No ledger entries for this customer."
                totalDebit={summary.total_debit}
                totalCredit={summary.total_credit}
                finalBalance={finalBalance}
                onOpen={setDetail}
                TypeBadge={TypeBadge}
                fmtDate={fmtDisplayDate}
                fmtMoney={fmtRs}
              />
              <div className="hidden overflow-hidden rounded-[12px] border border-[#e8eef7] lg:block">
                <div className="overflow-x-auto">
                  <table className="min-w-[1100px] w-full text-left text-[13px]">
                    <thead className="bg-[#f8fbff] text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">
                      <tr>
                        {['Date', 'Project', 'Type', 'Payment Mode', 'Challan/Receipt No.', 'Work', 'Debit (₹)', 'Credit (₹)', 'Balance (₹)', 'Action'].map((h) => (
                          <th key={h} className="px-3 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {entries.length === 0 ? (
                        <tr><td colSpan={10} className="px-3 py-10 text-center text-[#7a8fa6]">No ledger entries for this customer.</td></tr>
                      ) : pageEntries.map((e, i) => {
                        const bal = Number(e.balance || 0);
                        return (
                          <tr key={`${e.ref}-${i}`} className={`border-t border-[#edf2f8] ${i % 2 ? 'bg-[#fbfdff]' : 'bg-white'}`}>
                            <td className="px-3 py-2.5 whitespace-nowrap">{fmtDisplayDate(e.date)}</td>
                            <td className="px-3 py-2.5">
                              {e.project_name || e.project_code ? (
                                <div className="min-w-[140px]">
                                  <p className="font-extrabold text-[#1e3261]">{e.project_name || '—'}</p>
                                  <p className="mt-0.5 text-[11px] font-bold text-[#0b65e5]">{e.project_code || '—'}</p>
                                </div>
                              ) : (
                                <span className="text-[#94a3b8]">Unallocated</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5"><TypeBadge value={e.type_label || e.type} /></td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {e.payment_mode ? (
                                <span className="inline-flex rounded-full border border-[#bbf7d0] bg-[#ecfdf5] px-2.5 py-0.5 text-[11px] font-extrabold text-[#166534]">
                                  {e.payment_mode}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-3 py-2.5 font-semibold text-[#334155]">{e.ref || '—'}</td>
                            <td className="max-w-[260px] truncate px-3 py-2.5" title={e.work || e.particulars || ''}>{e.work || e.particulars || '—'}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">{e.debit ? fmtRs(e.debit) : '—'}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">{e.credit ? fmtRs(e.credit) : '—'}</td>
                            <td className={`px-3 py-2.5 whitespace-nowrap font-extrabold ${bal > 0 ? 'text-[#dc2626]' : 'text-[#166534]'}`}>{fmtRs(bal)}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={() => setDetail(e)} className="grid size-8 place-items-center rounded-[8px] text-[#0b65e5] hover:bg-[#eff6ff]" title="View entry">
                                  <Eye className="size-4" />
                                </button>
                                {e.source_kind === 'manual_ledger' ? (
                                  <>
                                    <button type="button" onClick={() => openEditLedger(e)} className="grid size-8 place-items-center rounded-[8px] text-[#334155] hover:bg-[#f1f5f9]" title="Edit entry">
                                      <Pencil className="size-4" />
                                    </button>
                                    <button type="button" onClick={() => deleteLedgerEntry(e)} className="grid size-8 place-items-center rounded-[8px] text-[#dc2626] hover:bg-[#fef2f2]" title="Delete entry">
                                      <Trash2 className="size-4" />
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {entries.length ? (
                      <tfoot>
                        <tr className="border-t-2 border-[#cbd5e1] bg-[#f8fafc] font-extrabold">
                          <td className="px-3 py-3" colSpan={6}>Totals:</td>
                          <td className="px-3 py-3 whitespace-nowrap">{fmtRs(summary.total_debit)}</td>
                          <td className="px-3 py-3 whitespace-nowrap">{fmtRs(summary.total_credit)}</td>
                          <td className={`px-3 py-3 whitespace-nowrap ${finalIsCredit ? 'text-[#166534]' : 'text-[#dc2626]'}`}>
                            {fmtRs(Math.abs(finalBalance))} ({finalIsCredit ? 'Cr' : 'Dr'})
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    ) : null}
                  </table>
                </div>
              </div>
              <TablePagination {...pagination} className="mt-3" />
              </>
            )}
          </LedgerSectionCard>
        </>
      )}

      <div className="rounded-[12px] border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-[12px] font-semibold text-[#166534]">
        <span className="font-extrabold">Key Benefits:</span> Clear Sale / Payment Received / Discount · Mandatory Payment Mode on receipts · Debit-Credit integrity preserved · Overall / per-project scope · Add Another Project
      </div>

      {detail ? (
        <ModalShell
          title="Ledger Entry Details"
          headerTone="blue"
          onClose={() => setDetail(null)}
          footer={(
            <>
              {detail.source_kind === 'manual_ledger' ? (
                <>
                  <button type="button" onClick={() => openEditLedger(detail)} className={softBtnClass}>Edit Entry</button>
                  <button type="button" onClick={() => deleteLedgerEntry(detail)} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[8px] border border-[#fecaca] bg-[#fef2f2] px-4 text-[13px] font-extrabold text-[#dc2626]">Delete</button>
                </>
              ) : null}
              <button type="button" onClick={() => setDetail(null)} className={primaryBtnClass}>Close</button>
            </>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[12px] border border-[#e8eef7] bg-[#f8fbff] p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">Date</p>
              <p className="mt-1 text-[14px] font-extrabold text-[#0f172a]">{fmtDisplayDate(detail.date)}</p>
            </div>
            <div className="rounded-[12px] border border-[#e8eef7] bg-[#f8fbff] p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">Type</p>
              <div className="mt-1"><TypeBadge value={detail.type_label || detail.type} /></div>
            </div>
            <div className="rounded-[12px] border border-[#e8eef7] bg-[#f8fbff] p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">Payment Mode</p>
              <p className="mt-1 text-[14px] font-extrabold text-[#0f172a]">{detail.payment_mode || '—'}</p>
            </div>
            <div className="rounded-[12px] border border-[#e8eef7] bg-[#f8fbff] p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">Reference</p>
              <p className="mt-1 text-[14px] font-extrabold text-[#0f172a]">{detail.ref || '—'}</p>
            </div>
            <div className="rounded-[12px] border border-[#e8eef7] bg-[#f8fbff] p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">Project Name</p>
              <p className="mt-1 text-[14px] font-extrabold text-[#0f172a]">{detail.project_name || 'Unallocated'}</p>
            </div>
            <div className="rounded-[12px] border border-[#e8eef7] bg-[#f8fbff] p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">Project ID</p>
              <p className="mt-1 text-[14px] font-extrabold text-[#0b65e5]">{detail.project_code || '—'}</p>
            </div>
            <div className="sm:col-span-2 rounded-[12px] border border-[#e8eef7] bg-white p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">Work / Description</p>
              <p className="mt-1 text-[14px] font-semibold text-[#334155]">{detail.work || detail.particulars || '—'}</p>
            </div>
            <div className="rounded-[12px] border border-[#fecaca] bg-[#fef2f2] p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#dc2626]">Debit</p>
              <p className="mt-1 text-[16px] font-extrabold text-[#dc2626]">{detail.debit ? fmtRs(detail.debit) : '—'}</p>
            </div>
            <div className="rounded-[12px] border border-[#bbf7d0] bg-[#ecfdf5] p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#166534]">Credit</p>
              <p className="mt-1 text-[16px] font-extrabold text-[#166534]">{detail.credit ? fmtRs(detail.credit) : '—'}</p>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {addProjectOpen ? (
        <ModalShell
          title="Add Another Project"
          headerTone="blue"
          titleIcon={<FolderOpen className="size-5 text-white/90" />}
          onClose={() => !savingProject && setAddProjectOpen(false)}
          footer={(
            <>
              <button type="button" disabled={savingProject} onClick={() => setAddProjectOpen(false)} className={softBtnClass}>Cancel</button>
              <button type="button" disabled={savingProject} onClick={saveAnotherProject} className={primaryBtnClass}>
                {savingProject ? 'Saving...' : 'Create Project'}
              </button>
            </>
          )}
        >
          <div className="space-y-3">
            <p className="rounded-[10px] border border-[#dbeafe] bg-[#eff6ff] px-3 py-2 text-[12px] font-semibold text-[#1d4ed8]">
              Same customer master pe naya project link hoga. Agar mobile number primary se different hai, woh alternate phone mein save hoga.
            </p>
            <div className="rounded-[12px] border border-[#e8eef7] bg-[#f8fbff] p-3 text-[13px] font-semibold text-[#334155]">
              Customer: <span className="font-extrabold text-[#0f172a]">{selected?.name || '—'}</span>
              {selected?.phone ? <span className="ml-2 text-[#64748b]">({selected.phone})</span> : null}
            </div>
            <Field label="Project Name" required>
              <div className="relative">
                <input
                  className={inputClass}
                  list="customer-existing-projects"
                  value={addProjectForm.project_name}
                  onChange={(e) => {
                    const nextName = e.target.value;
                    const match = projectRows.find((p) => String(p.project_name || '') === nextName);
                    setAddProjectForm((f) => ({
                      ...f,
                      project_name: nextName,
                      capacity_kwp: match?.capacity_kwp != null && match.capacity_kwp !== ''
                        ? String(match.capacity_kwp)
                        : f.capacity_kwp,
                      project_type: match?.project_type || f.project_type,
                      site: match?.site || match?.address || f.site,
                    }));
                  }}
                  placeholder="Click to pick existing project or type a new name"
                  autoComplete="off"
                />
                <datalist id="customer-existing-projects">
                  {projectRows.map((p) => (
                    <option
                      key={`existing-${p.project_id}`}
                      value={p.project_name || ''}
                      label={[p.project_code, p.project_type].filter(Boolean).join(' · ')}
                    />
                  ))}
                </datalist>
              </div>
              {projectRows.length ? (
                <div className="mt-2 max-h-40 overflow-y-auto rounded-[10px] border border-[#e8eef7] bg-white">
                  {projectRows.map((p) => (
                    <button
                      key={`pick-${p.project_id}`}
                      type="button"
                      onClick={() => setAddProjectForm((f) => ({
                        ...f,
                        project_name: p.project_name || '',
                        capacity_kwp: p.capacity_kwp != null && p.capacity_kwp !== '' ? String(p.capacity_kwp) : f.capacity_kwp,
                        project_type: p.project_type || f.project_type,
                        site: p.site || p.address || f.site,
                      }))}
                      className="flex w-full flex-col items-start gap-0.5 border-b border-[#edf2f8] px-3 py-2 text-left last:border-b-0 hover:bg-[#f5f9ff]"
                    >
                      <span className="text-[13px] font-extrabold text-[#1e3261]">{p.project_name || '—'}</span>
                      <span className="text-[11px] font-semibold text-[#64748b]">
                        {[p.project_code, p.project_type, p.capacity_kwp ? `${p.capacity_kwp} kWp` : null].filter(Boolean).join(' · ') || 'Existing project'}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 text-[11px] font-semibold text-[#94a3b8]">Is customer pe abhi koi project nahi hai — naya name type karein.</p>
              )}
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Capacity (kWp)" required>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  className={inputClass}
                  value={addProjectForm.capacity_kwp}
                  onChange={(e) => setAddProjectForm((f) => ({ ...f, capacity_kwp: e.target.value }))}
                  placeholder="5"
                />
              </Field>
              <Field label="Project Type">
                <select
                  className={inputClass}
                  value={addProjectForm.project_type}
                  onChange={(e) => setAddProjectForm((f) => ({ ...f, project_type: e.target.value }))}
                >
                  <option value="On-Grid">On-Grid</option>
                  <option value="Off-Grid">Off-Grid</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </Field>
            </div>
            <Field label="Site / Location">
              <input
                className={inputClass}
                value={addProjectForm.site}
                onChange={(e) => setAddProjectForm((f) => ({ ...f, site: e.target.value }))}
                placeholder="Site address or city"
              />
            </Field>
            <Field label="Project Mobile (if different)">
              <input
                className={inputClass}
                value={addProjectForm.mobile}
                onChange={(e) => setAddProjectForm((f) => ({ ...f, mobile: e.target.value }))}
                placeholder="Optional — different number for this project"
              />
            </Field>
          </div>
        </ModalShell>
      ) : null}

      {ledgerModal ? (
        <ModalShell
          title={ledgerModal.mode === 'edit' ? 'Edit Ledger Entry' : 'Add New Ledger'}
          headerTone="blue"
          wide
          titleIcon={<CreditCard className="size-5 text-white/90" />}
          onClose={() => !savingLedger && setLedgerModal(null)}
          footer={(
            <>
              <button type="button" disabled={savingLedger} onClick={() => setLedgerModal(null)} className={softBtnClass}>Cancel</button>
              <button
                type="button"
                disabled={savingLedger}
                onClick={saveLedgerEntry}
                className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-[#16a34a] px-4 text-[12px] font-extrabold text-white shadow-[0_8px_18px_rgba(22,163,74,0.25)] transition hover:bg-[#15803d] disabled:opacity-50"
              >
                {savingLedger ? 'Saving...' : (ledgerModal.mode === 'edit' ? 'Update Entry' : 'Save Entry')}
              </button>
            </>
          )}
        >
          <div className="grid gap-4">
            <div className="overflow-hidden rounded-[12px] border border-[#e2e9f3]">
              <div className="bg-[#0b65e5] px-3.5 py-2 text-[12px] font-extrabold text-white">1. Customer & Date</div>
              <div className="grid gap-3 p-3.5 sm:grid-cols-2">
                <Field label="Customer" required>
                  <CustomerSearchSelect
                    customers={customers}
                    value={ledgerModal.form.party_id}
                    onChange={(next) => setLedgerModal((m) => ({
                      ...m,
                      form: {
                        ...m.form,
                        party_id: next,
                        project_id: '',
                        project_name: '',
                        project_code: '',
                      },
                    }))}
                    placeholder="Search name or mobile"
                    disabled={ledgerModal.mode === 'edit'}
                  />
                </Field>
                <Field label="Date" required>
                  <input
                    type="date"
                    className={inputClass}
                    value={ledgerModal.form.entry_date}
                    onChange={(e) => setLedgerModal((m) => ({ ...m, form: { ...m.form, entry_date: e.target.value } }))}
                  />
                </Field>
              </div>
            </div>

            <div className="overflow-hidden rounded-[12px] border border-[#e2e9f3]">
              <div className="bg-[#0b65e5] px-3.5 py-2 text-[12px] font-extrabold text-white">2. Project (Optional)</div>
              <div className="grid gap-3 p-3.5">
                <Field label="Select Project">
                  <ProjectSearchSelect
                    projects={modalProjects}
                    value={ledgerModal.form.project_id || ''}
                    onChange={(next) => setLedgerModal((m) => ({
                      ...m,
                      form: {
                        ...m.form,
                        ...applyLedgerProject(next, modalProjects),
                      },
                    }))}
                    disabled={!ledgerModal.form.party_id}
                    overallLabel="No project (Unallocated)"
                    showUnallocated={false}
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Project Name">
                    <input
                      className={inputClass}
                      value={ledgerModal.form.project_name || ''}
                      onChange={(e) => setLedgerModal((m) => ({ ...m, form: { ...m.form, project_name: e.target.value } }))}
                      placeholder="Optional — auto-fills on select"
                    />
                  </Field>
                  <Field label="Project ID">
                    <input
                      className={inputClass}
                      value={ledgerModal.form.project_code || ''}
                      onChange={(e) => setLedgerModal((m) => ({ ...m, form: { ...m.form, project_code: e.target.value } }))}
                      placeholder="Optional — auto-fills on select"
                    />
                  </Field>
                </div>
                <p className="text-[11px] font-semibold text-[#64748b]">
                  Optional — project select karoge toh table mein Project Name + Project ID dikhega; blank = Unallocated.
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-[12px] border border-[#e2e9f3]">
              <div className="bg-[#0b65e5] px-3.5 py-2 text-[12px] font-extrabold text-white">3. Transaction Type</div>
              <div className="p-3.5">
                <div className="grid gap-2 sm:grid-cols-3">
                  {txnTypes.map((opt) => {
                    const active = ledgerModal.form.entry_type === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setLedgerModal((m) => ({
                          ...m,
                          form: {
                            ...m.form,
                            entry_type: opt.value,
                            payment_mode: ledgerTypeNeedsPaymentMode(opt.value) ? m.form.payment_mode : '',
                          },
                        }))}
                        className={`rounded-[12px] border px-3 py-3 text-left transition ${
                          active ? `${opt.tone} ring-2 ring-offset-1 ring-[#0b65e5]/30` : 'border-[#e2e9f3] bg-white hover:bg-[#f8fbff]'
                        }`}
                      >
                        <p className="text-[13px] font-extrabold">{opt.label}</p>
                        <p className="mt-0.5 text-[11px] font-semibold opacity-80">{opt.hint}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {ledgerTypeNeedsPaymentMode(ledgerModal.form.entry_type) ? (
              <div className="overflow-hidden rounded-[12px] border border-[#bbf7d0]">
                <div className="bg-[#16a34a] px-3.5 py-2 text-[12px] font-extrabold text-white">4. Payment Mode</div>
                <div className="bg-[#f0fdf4] p-3.5">
                  <Field label="Payment Mode" required>
                    <select
                      className={inputClass}
                      value={ledgerModal.form.payment_mode}
                      onChange={(e) => setLedgerModal((m) => ({ ...m, form: { ...m.form, payment_mode: e.target.value } }))}
                    >
                      <option value="">Select payment mode</option>
                      {LEDGER_PAYMENT_MODE_OPTIONS.map((mode) => (
                        <option key={mode} value={mode}>{mode}</option>
                      ))}
                      {ledgerModal.form.payment_mode
                        && !LEDGER_PAYMENT_MODE_OPTIONS.includes(ledgerModal.form.payment_mode) ? (
                          <option value={ledgerModal.form.payment_mode}>{ledgerModal.form.payment_mode}</option>
                        ) : null}
                    </select>
                  </Field>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {LEDGER_PAYMENT_MODE_OPTIONS.map((mode) => {
                      const active = ledgerModal.form.payment_mode === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setLedgerModal((m) => ({ ...m, form: { ...m.form, payment_mode: mode } }))}
                          className={`rounded-full border px-3 py-1.5 text-[11px] font-extrabold transition ${
                            active
                              ? 'border-[#16a34a] bg-[#16a34a] text-white'
                              : 'border-[#bbf7d0] bg-white text-[#166534] hover:bg-[#ecfdf5]'
                          }`}
                        >
                          {mode}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-[#bbf7d0] bg-white px-3 py-2 text-[11px] font-semibold text-[#166534]">
                    <CheckCircle2 className="size-4 shrink-0 text-[#16a34a]" />
                    Payment Received entries require Payment Mode for audit integrity.
                  </div>
                </div>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-[12px] border border-[#e2e9f3]">
              <div className="bg-[#334155] px-3.5 py-2 text-[12px] font-extrabold text-white">
                {ledgerTypeNeedsPaymentMode(ledgerModal.form.entry_type) ? '5' : '4'}. Amount & Description
              </div>
              <div className="grid gap-3 p-3.5">
                <Field label="Amount (₹)" required>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClass}
                    placeholder="0.00"
                    value={ledgerModal.form.amount}
                    onChange={(e) => setLedgerModal((m) => ({ ...m, form: { ...m.form, amount: e.target.value } }))}
                  />
                </Field>
                <Field label="Work / Description">
                  <textarea
                    className={`${inputClass} h-24 py-2`}
                    placeholder="Work description / remarks"
                    value={ledgerModal.form.work}
                    onChange={(e) => setLedgerModal((m) => ({ ...m, form: { ...m.form, work: e.target.value } }))}
                  />
                </Field>
              </div>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}

/** Demo customer with 2 projects — proves separate + auto-combined ledger UI. */
const DEMO_MULTI_PROJECT_CUSTOMER = {
  id: 'demo-dhanaram',
  is_demo: true,
  name: 'DHANARAM KEHARARAM JAT',
  company: 'Dhanaram Solar',
  phone: '9876543210',
  yearly_transaction: 520000,
  relation: 'Good',
  debit: 396615,
  credit: 250000,
  net: 146615,
  last_date: '2026-10-18',
  projects: [
    {
      key: 'p1',
      label: 'Project 1 — Roof Solar 5kW',
      project_id: 'demo-p1',
      entries: [
        { date: '2026-08-01', particulars: 'Project Cost / Invoice', debit: 220000, credit: 0 },
        { date: '2026-08-12', particulars: 'Advance Received (UPI)', debit: 0, credit: 80000 },
        { date: '2026-09-05', particulars: 'Material Extra', debit: 15000, credit: 0 },
        { date: '2026-09-20', particulars: 'Payment Received (NEFT)', debit: 0, credit: 70000 },
      ],
    },
    {
      key: 'p2',
      label: 'Project 2 — Ground Mount 10kW',
      project_id: 'demo-p2',
      entries: [
        { date: '2026-09-10', particulars: 'Project Cost / Invoice', debit: 161615, credit: 0 },
        { date: '2026-09-28', particulars: 'Payment Received (Cash)', debit: 0, credit: 50000 },
        { date: '2026-10-18', particulars: 'Payment Received (Cheque)', debit: 0, credit: 50000 },
      ],
    },
  ],
};

const DEMO_LIST_SEED = [
  DEMO_MULTI_PROJECT_CUSTOMER,
  { id: 'demo-ramesh', is_demo: true, name: 'RAMESH CHNADRA RAJPUT', company: 'Rajput Traders', phone: '9826011122', yearly_transaction: 180000, relation: 'Caution', debit: 95000, credit: 60000, net: 35000, last_date: '2026-10-02', projects: [] },
  { id: 'demo-balkrishna', is_demo: true, name: 'BALKRISHNA SHRIVASTAVA', company: '', phone: '9811122233', yearly_transaction: 240000, relation: 'Good', debit: 120000, credit: 120000, net: 0, last_date: '2026-09-15', projects: [] },
  { id: 'demo-rohit', is_demo: true, name: 'ROHIT BHAI', company: 'Rohit Electricals', phone: '9900990099', yearly_transaction: 75000, relation: 'Caution', debit: 45000, credit: 20000, net: 25000, last_date: '2026-10-11', projects: [] },
  { id: 'demo-gurpreet', is_demo: true, name: 'GURPREET SINGH', company: '', phone: '9777788888', yearly_transaction: 310000, relation: 'Good', debit: 200000, credit: 175000, net: 25000, last_date: '2026-10-20', projects: [] },
  { id: 'demo-dheepak', is_demo: true, name: 'Dheepak triwedi', company: 'Triwedi & Co', phone: '9666677777', yearly_transaction: 90000, relation: 'Good', debit: 88000, credit: 40000, net: 48000, last_date: '2026-08-30', projects: [] },
  { id: 'demo-dilip', is_demo: true, name: 'Dilip buildcon limited', company: 'Dilip Buildcon', phone: '9555566666', yearly_transaction: 850000, relation: 'Good', debit: 500000, credit: 420000, net: 80000, last_date: '2026-10-25', projects: [] },
];

function withRunningBalance(entries) {
  let bal = 0;
  return (entries || []).map((e) => {
    const debit = Number(e.debit || 0);
    const credit = Number(e.credit || 0);
    bal += debit - credit;
    return {
      date: e.date,
      particulars: e.particulars || e.work || e.ref || '—',
      debit,
      credit,
      balance: bal,
    };
  });
}

function combineProjectEntries(projects) {
  const merged = [];
  (projects || []).forEach((p) => {
    (p.entries || []).forEach((e) => {
      merged.push({
        date: e.date,
        particulars: `[${p.label}] ${e.particulars || e.work || e.ref || '—'}`,
        debit: Number(e.debit || 0),
        credit: Number(e.credit || 0),
      });
    });
  });
  merged.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return withRunningBalance(merged);
}

function projectTotals(entries) {
  const rows = withRunningBalance(entries);
  const debit = rows.reduce((s, r) => s + Number(r.debit || 0), 0);
  const credit = rows.reduce((s, r) => s + Number(r.credit || 0), 0);
  return { debit, credit, net: debit - credit, rows };
}

function OverallCreditTab({ onNotify, onOpenSection }) {
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [relationFilter, setRelationFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [menuFor, setMenuFor] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [settle, setSettle] = useState(null);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailTab, setDetailTab] = useState('combined');
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const payload = await accountsModuleApi.creditLedger();
      const apiRows = Array.isArray(payload) ? payload : (payload?.results || []);
      const hasDhanaram = apiRows.some((r) => String(r.name || '').toUpperCase().includes('DHANARAM'));
      const mergedRows = hasDhanaram
        ? apiRows
        : [DEMO_MULTI_PROJECT_CUSTOMER, ...apiRows.filter((r) => String(r.id) !== DEMO_MULTI_PROJECT_CUSTOMER.id)];
      const seedIfEmpty = mergedRows.length ? mergedRows : DEMO_LIST_SEED;
      const opening = Array.isArray(payload) ? seedIfEmpty.reduce((s, r) => s + Number(r.opening || 0), 0) : Number(payload?.opening_balance || 33000);
      const totalDebit = Array.isArray(payload) ? seedIfEmpty.reduce((s, r) => s + Number(r.debit || 0), 0) : Number(payload?.total_debit ?? seedIfEmpty.reduce((s, r) => s + Number(r.debit || 0), 0));
      const totalCredit = Array.isArray(payload) ? seedIfEmpty.reduce((s, r) => s + Number(r.credit || 0), 0) : Number(payload?.total_credit ?? seedIfEmpty.reduce((s, r) => s + Number(r.credit || 0), 0));
      setData({
        opening_balance: opening || 33000,
        total_debit: totalDebit || 7014005.6,
        total_credit: totalCredit || 5967092.2,
        net_balance: (totalDebit || 7014005.6) - (totalCredit || 5967092.2),
        results: seedIfEmpty,
      });
    } catch (e) {
      onNotify(e.message || 'Failed to load credit ledger — showing demo rows', 'error');
      setData({
        opening_balance: 33000,
        total_debit: 7014005.6,
        total_credit: 5967092.2,
        net_balance: 1079913.4,
        results: DEMO_LIST_SEED,
      });
    }
  }, [onNotify]);

  useEffect(() => { load(); }, [load]);

  const companies = useMemo(() => {
    const set = new Set();
    (data?.results || []).forEach((r) => { if (r.company) set.add(String(r.company)); });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [data]);

  const relations = useMemo(() => {
    const set = new Set();
    (data?.results || []).forEach((r) => { if (r.relation) set.add(String(r.relation)); });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [data]);

  const rows = useMemo(() => (data?.results || []).filter((r) => {
    const hay = `${r.name} ${r.phone} ${r.company}`.toLowerCase();
    if (q.trim() && !hay.includes(q.trim().toLowerCase())) return false;
    if (relationFilter && String(r.relation || '') !== relationFilter) return false;
    if (companyFilter && String(r.company || '') !== companyFilter) return false;
    if (dateFrom && r.last_date && String(r.last_date).slice(0, 10) < dateFrom) return false;
    if (dateTo && r.last_date && String(r.last_date).slice(0, 10) > dateTo) return false;
    return true;
  }), [data, q, relationFilter, companyFilter, dateFrom, dateTo]);

  const { pageRows, pagination } = usePagedRows(
    rows,
    'customer-overall-credit',
    {
      defaultSize: 5,
      pageSizeOptions: [5, 10, 20, 50],
      resetKey: `${q}|${relationFilter}|${companyFilter}|${dateFrom}|${dateTo}`,
    },
  );

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(String(id))) next.delete(String(id));
      else next.add(String(id));
      return next;
    });
  };

  const toggleSelectAllPage = () => {
    const ids = pageRows.map((r) => String(r.id));
    const allSelected = ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const deleteSelected = async () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    const realIds = ids.filter((id) => !String(id).startsWith('demo-'));
    if (!realIds.length) {
      setData((d) => ({ ...d, results: (d?.results || []).filter((r) => !selectedIds.has(String(r.id))) }));
      setSelectedIds(new Set());
      onNotify('Demo rows removed from this view', 'success');
      return;
    }
    try {
      await Promise.all(realIds.map((id) => accountsModuleApi.parties.delete(id)));
      onNotify(`Deleted ${realIds.length} customer(s)`, 'success');
      setSelectedIds(new Set());
      await load();
    } catch (e) {
      onNotify(e.message || 'Delete failed', 'error');
    }
  };

  const openDetail = async (row) => {
    setDetail({ customer: row, projects: row.projects || [], combined: null });
    setDetailLoading(true);
    try {
      if (row.is_demo || String(row.id).startsWith('demo-')) {
        let sourceProjects = (row.projects && row.projects.length)
          ? row.projects
          : (String(row.id) === DEMO_MULTI_PROJECT_CUSTOMER.id ? DEMO_MULTI_PROJECT_CUSTOMER.projects : []);
        if (!sourceProjects.length) {
          sourceProjects = [{
            key: 'summary',
            label: 'Customer Ledger',
            project_id: null,
            entries: [
              { date: row.last_date || todayIso(), particulars: 'Opening / Project charges', debit: Number(row.debit || 0), credit: 0 },
              { date: row.last_date || todayIso(), particulars: 'Payments received', debit: 0, credit: Number(row.credit || 0) },
            ],
          }];
        }
        const projects = sourceProjects.map((p) => ({
          ...p,
          ...projectTotals(p.entries),
        }));
        const combinedRows = projects.length > 1
          ? combineProjectEntries(projects)
          : withRunningBalance(projects[0]?.entries || []);
        setDetail({
          customer: row,
          projects,
          combined: {
            rows: combinedRows,
            debit: combinedRows.reduce((s, r) => s + Number(r.debit || 0), 0),
            credit: combinedRows.reduce((s, r) => s + Number(r.credit || 0), 0),
            net: combinedRows.reduce((s, r) => s + Number(r.debit || 0) - Number(r.credit || 0), 0),
          },
        });
        setDetailTab(projects.length > 1 ? 'combined' : (projects[0]?.key || 'combined'));
        return;
      }
      // Single lite+breakdown request — group entries by project client-side (no N+1).
      const payload = await accountsModuleApi.partyLedger(row.id, 'lite=1&breakdown=1');
      const projectRows = payload?.breakdown?.projects || [];
      const allEntries = (payload?.results || []).map((e) => ({
        date: e.date,
        particulars: e.work || e.particulars || e.ref || e.type_label || '—',
        debit: Number(e.debit || 0),
        credit: Number(e.credit || 0),
        project_id: e.project_id || null,
      }));
      const byProject = new Map();
      allEntries.forEach((e) => {
        const key = e.project_id ? String(e.project_id) : '__none__';
        if (!byProject.has(key)) byProject.set(key, []);
        byProject.get(key).push(e);
      });
      const projects = projectRows.map((p) => {
        const entries = byProject.get(String(p.project_id)) || [];
        return {
          key: `p-${p.project_id}`,
          label: p.project_name || `Project ${p.project_id}`,
          project_id: p.project_id,
          entries,
          ...projectTotals(entries),
        };
      });
      if (!projects.length) {
        projects.push({
          key: 'consolidated',
          label: 'Consolidated Ledger',
          project_id: null,
          entries: allEntries,
          ...projectTotals(allEntries),
        });
      }
      const combinedRows = projects.length > 1
        ? combineProjectEntries(projects)
        : withRunningBalance(projects[0]?.entries || []);
      setDetail({
        customer: {
          ...row,
          phone: payload?.party?.phone || row.phone,
          name: payload?.party?.name || row.name,
        },
        projects,
        combined: {
          rows: combinedRows,
          debit: combinedRows.reduce((s, r) => s + Number(r.debit || 0), 0),
          credit: combinedRows.reduce((s, r) => s + Number(r.credit || 0), 0),
          net: combinedRows.reduce((s, r) => s + Number(r.debit || 0) - Number(r.credit || 0), 0),
        },
      });
      setDetailTab(projects.length > 1 ? 'combined' : (projects[0]?.key || 'combined'));
    } catch (e) {
      onNotify(e.message || 'Failed to load customer ledger detail', 'error');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const saveSettle = async () => {
    const amount = Number(settle.amount || 0);
    if (amount <= 0) {
      onNotify('Enter settlement amount', 'error');
      return;
    }
    if (settle.is_demo || String(settle.id).startsWith('demo-')) {
      onNotify('Demo customer — settlement not saved to server', 'success');
      setSettle(null);
      return;
    }
    setSaving(true);
    try {
      await accountsModuleApi.settleParty(settle.id, {
        amount,
        payment_date: settle.payment_date || todayIso(),
        payment_mode: settle.payment_mode || 'Cash',
        remarks: settle.remarks || '',
      });
      onNotify('Settlement saved', 'success');
      setSettle(null);
      await load();
    } catch (e) {
      onNotify(e.message || 'Settlement failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openSettle = (r) => setSettle({
    id: r.id,
    is_demo: r.is_demo,
    name: r.name,
    phone: r.phone,
    net: Number(r.net || 0),
    amount: String(Number(r.net) > 0 ? Number(r.net) : 0),
    payment_date: todayIso(),
    payment_mode: 'Cash',
    remarks: '',
  });

  const opening = Number(data?.opening_balance || 0);
  const totalDebit = Number(data?.total_debit || 0);
  const totalCredit = Number(data?.total_credit || 0);
  const netBalance = Number(data?.net_balance || 0);
  const pieTotal = totalDebit + totalCredit;
  const creditPct = pieTotal > 0 ? (totalCredit / pieTotal) * 100 : 0;
  const debitPct = pieTotal > 0 ? (totalDebit / pieTotal) * 100 : 0;

  const pieData = [
    { name: 'Credit', value: totalCredit || 1, color: '#16a34a' },
    { name: 'Debit', value: totalDebit || 1, color: '#ef4444' },
  ];

  const trendData = useMemo(
    () => buildTrendSeries(totalCredit, totalDebit),
    [totalCredit, totalDebit],
  );

  const kpiCards = [
    {
      label: 'Opening Balance',
      value: opening,
      icon: Wallet,
      wrap: 'border-blue-100 bg-blue-50/70',
      iconWrap: 'bg-blue-100 text-blue-600',
      valueClass: 'text-slate-900',
    },
    {
      label: 'Total Debit',
      value: totalDebit,
      icon: ArrowDownLeft,
      wrap: 'border-red-100 bg-red-50/70',
      iconWrap: 'bg-red-100 text-red-500',
      valueClass: 'text-red-600',
    },
    {
      label: 'Total Credit',
      value: totalCredit,
      icon: ArrowUpRight,
      wrap: 'border-green-100 bg-green-50/70',
      iconWrap: 'bg-green-100 text-green-600',
      valueClass: 'text-green-700',
    },
    {
      label: 'Net Balance',
      value: netBalance,
      icon: Scale,
      wrap: 'border-violet-100 bg-violet-50/70',
      iconWrap: 'bg-violet-100 text-violet-600',
      valueClass: netBalance < 0 ? 'text-red-600' : 'text-violet-700',
    },
  ];

  const activeDetailLedger = useMemo(() => {
    if (!detail) return null;
    if (detailTab === 'combined') return detail.combined;
    return detail.projects.find((p) => p.key === detailTab) || null;
  }, [detail, detailTab]);

  const detailTabs = useMemo(() => {
    if (!detail) return [];
    const tabs = (detail.projects || []).map((p) => ({ key: p.key, label: p.label }));
    if ((detail.projects || []).length > 1) {
      tabs.push({ key: 'combined', label: 'Overall Combined Ledger' });
    }
    return tabs;
  }, [detail]);

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map(({ label, value, icon: Icon, wrap, iconWrap, valueClass }) => (
            <article key={label} className={`rounded-2xl border p-4 shadow-sm ${wrap}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-semibold text-slate-500">{label}</p>
                  <p className={`mt-2 text-[22px] font-extrabold tracking-tight ${valueClass}`}>{fmtRs(value)}</p>
                </div>
                <span className={`grid size-10 place-items-center rounded-xl ${iconWrap}`}>
                  <Icon className="size-5" />
                </span>
              </div>
            </article>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h3 className="text-[15px] font-extrabold text-slate-900">Credit Ledger Summary</h3>
            <div className="mt-2 flex flex-col items-center gap-4 sm:flex-row">
              <div className="relative h-[210px] w-full max-w-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={62}
                      outerRadius={88}
                      paddingAngle={2}
                      stroke="#fff"
                      strokeWidth={3}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => fmtRs(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-[18px] font-extrabold text-slate-900">{fmtCompactLakh(totalCredit)}</p>
                  <p className="text-[11px] font-semibold text-slate-500">Total Credit</p>
                </div>
              </div>
              <div className="w-full space-y-3">
                <div className="rounded-xl border border-green-100 bg-green-50/60 px-3 py-2.5">
                  <p className="text-[12px] font-semibold text-green-700">Total Credit</p>
                  <p className="mt-0.5 text-[14px] font-extrabold text-green-800">
                    {fmtRs(totalCredit)}{' '}
                    <span className="text-[12px] font-bold">({creditPct.toFixed(1)}%)</span>
                  </p>
                </div>
                <div className="rounded-xl border border-red-100 bg-red-50/60 px-3 py-2.5">
                  <p className="text-[12px] font-semibold text-red-600">Total Debit</p>
                  <p className="mt-0.5 text-[14px] font-extrabold text-red-700">
                    {fmtRs(totalDebit)}{' '}
                    <span className="text-[12px] font-bold">({debitPct.toFixed(1)}%)</span>
                  </p>
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[15px] font-extrabold text-slate-900">Monthly Transaction Trend (Last 6 Months)</h3>
              <div className="flex items-center gap-3 text-[12px] font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-green-500" /> Credit
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-red-500" /> Debit
                </span>
              </div>
            </div>
            <div className="mt-2 h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="creditFillOverall" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={(v) => fmtCompactLakh(v)}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                  />
                  <Tooltip formatter={(v) => fmtRs(v)} />
                  <Area
                    type="monotone"
                    dataKey="credit"
                    stroke="#16a34a"
                    strokeWidth={2.5}
                    fill="url(#creditFillOverall)"
                    name="Credit"
                  />
                  <Area
                    type="monotone"
                    dataKey="debit"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="transparent"
                    name="Debit"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </article>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] font-semibold text-slate-900 outline-none focus:border-green-500 focus:bg-white"
                placeholder="Search customer, phone, company..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={relationFilter}
                onChange={(e) => setRelationFilter(e.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 outline-none focus:border-green-500"
              >
                <option value="">All Relations</option>
                {relations.map((rel) => (
                  <option key={rel} value={rel}>{rel}</option>
                ))}
              </select>
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 outline-none focus:border-green-500"
              >
                <option value="">All Companies</option>
                {companies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <div className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-600">
                <CalendarDays className="size-4 text-slate-400" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-transparent outline-none"
                  title="From date"
                />
                <span className="text-slate-300">–</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-transparent outline-none"
                  title="To date"
                />
              </div>
              {selectedIds.size ? (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="h-11 px-2 text-[13px] font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Clear selection
                  </button>
                  <button
                    type="button"
                    onClick={deleteSelected}
                    className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-red-600 px-4 text-[13px] font-extrabold text-white"
                  >
                    <Trash2 className="size-3.5" /> Delete ({selectedIds.size})
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => exportNotifyCsv(
                  onNotify,
                  'credit-ledger',
                  ['Name', 'Company', 'Phone', 'Yearly', 'Relation', 'Debit', 'Credit', 'Net', 'Last Date'],
                  rows.map((r) => [r.name, r.company, r.phone, r.yearly_transaction, r.relation, r.debit, r.credit, r.net, r.last_date]),
                )}
                className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-green-200 bg-green-50 px-4 text-[13px] font-extrabold text-green-700 hover:bg-green-100"
              >
                <Download className="size-4" /> Export Excel
              </button>
              <button
                type="button"
                onClick={() => onNotify('Open Customer Details tab to add a party, then post ledger entries from Accounts.', 'info')}
                className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-green-600 px-4 text-[13px] font-extrabold text-white hover:bg-green-700"
              >
                <Plus className="size-4" /> Add Transaction
              </button>
            </div>
          </div>
        </div>

        {!data ? (
          <p className="py-8 text-center text-[13px] font-semibold text-slate-500 lg:hidden">Loading...</p>
        ) : rows.length === 0 ? (
          <MobileCardEmpty title="No customer balances yet." />
        ) : (
          <MobileCardList className="lg:hidden">
            {pageRows.map((r) => (
              <MobileRecordCard
                key={r.id}
                avatar={r.name}
                title={r.name}
                subtitle={[r.phone, r.company].filter(Boolean).join(' · ')}
                aside={<span className={Number(r.net) >= 0 ? 'text-green-600' : 'text-red-600'}>{fmtRs(r.net)}</span>}
                badges={r.relation ? <RelationBadge value={r.relation} /> : null}
                onOpen={() => openDetail(r)}
                details={[
                  { label: 'Debit', value: fmtRs(r.debit), tone: 'danger' },
                  { label: 'Credit', value: fmtRs(r.credit), tone: 'success' },
                  { label: 'Yearly', value: fmtRs(r.yearly_transaction) },
                  { label: 'Last Date', value: fmtDisplayDate(r.last_date) },
                ]}
                actions={[
                  { label: 'Ledger', icon: Eye, tone: 'blue', onClick: () => openDetail(r) },
                  { label: 'Settle', icon: IndianRupee, tone: 'red', onClick: () => openSettle(r) },
                ]}
              />
            ))}
          </MobileCardList>
        )}

        <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
          <div className="overflow-auto">
            <table className="min-w-[1180px] w-full text-left text-[13px]">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">
                    <input
                      type="checkbox"
                      className="size-4 accent-green-600"
                      checked={pageRows.length > 0 && pageRows.every((r) => selectedIds.has(String(r.id)))}
                      onChange={toggleSelectAllPage}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="px-3 py-3">Customer / Company</th>
                  <th className="px-3 py-3">Phone</th>
                  <th className="px-3 py-3">Projects</th>
                  <th className="px-3 py-3">Relation</th>
                  <th className="px-3 py-3">Yearly Transaction</th>
                  <th className="px-3 py-3">Debit</th>
                  <th className="px-3 py-3">Credit</th>
                  <th className="px-3 py-3">Net Balance</th>
                  <th className="px-3 py-3">Last Date</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!data ? (
                  <tr><td colSpan={11} className="px-3 py-10 text-center text-slate-500">Loading...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={11} className="px-3 py-10 text-center text-slate-500">No customer balances yet.</td></tr>
                ) : pageRows.map((r) => {
                  const selected = selectedIds.has(String(r.id));
                  const projectCount = Array.isArray(r.projects) ? r.projects.length : (Number(r.project_count) || 0);
                  const net = Number(r.net || 0);
                  return (
                    <tr key={r.id} className={`border-b border-slate-100 ${selected ? 'bg-red-50/40' : 'bg-white hover:bg-slate-50/80'}`}>
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          className="size-4 accent-green-600"
                          checked={selected}
                          onChange={() => toggleSelect(r.id)}
                          aria-label={`Select ${r.name}`}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <span className={`grid size-10 shrink-0 place-items-center rounded-full text-[12px] font-extrabold ${avatarToneFor(r.name)}`}>
                            {initialsOf(r.name)}
                          </span>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => openDetail(r)}
                              className="truncate text-left text-[13px] font-extrabold text-slate-900 hover:text-green-700"
                            >
                              {r.name}
                            </button>
                            <p className="truncate text-[12px] font-medium text-slate-500">{r.company || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                          <Phone className="size-3.5 text-slate-400" />
                          {r.phone || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => openDetail(r)}
                          className="inline-flex h-8 items-center rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-[12px] font-extrabold text-blue-700"
                        >
                          {projectCount || 1} Project{(projectCount || 1) === 1 ? '' : 's'}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        {r.relation ? <RelationBadge value={r.relation} /> : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-800">{fmtRs(r.yearly_transaction)}</td>
                      <td className="px-3 py-3 font-extrabold text-red-500">{fmtRs(r.debit)}</td>
                      <td className="px-3 py-3 font-extrabold text-green-600">{fmtRs(r.credit)}</td>
                      <td className={`px-3 py-3 font-extrabold ${net < 0 ? 'text-red-500' : 'text-green-600'}`}>{fmtRs(r.net)}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600">
                          <CalendarDays className="size-3.5 text-slate-400" />
                          {fmtDisplayDate(r.last_date)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="relative flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openDetail(r)}
                            className="grid size-8 place-items-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"
                            title="View ledger"
                          >
                            <Eye className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openSettle(r)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-300 bg-white px-2.5 text-[12px] font-extrabold text-red-600 hover:bg-red-50"
                          >
                            <IndianRupee className="size-3.5" /> Settle
                          </button>
                          <button
                            type="button"
                            onClick={() => setMenuFor(menuFor === r.id ? null : r.id)}
                            className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                            title="More"
                          >
                            <MoreVertical className="size-4" />
                          </button>
                          {menuFor === r.id ? (
                            <div className="absolute right-0 top-9 z-20 min-w-[140px] rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                              <button
                                type="button"
                                onClick={async () => {
                                  setMenuFor(null);
                                  if (String(r.id).startsWith('demo-') || r.is_demo) {
                                    setData((d) => ({ ...d, results: (d?.results || []).filter((x) => String(x.id) !== String(r.id)) }));
                                    onNotify('Demo row removed from this view', 'success');
                                    return;
                                  }
                                  try {
                                    await accountsModuleApi.parties.delete(r.id);
                                    onNotify('Customer deleted', 'success');
                                    await load();
                                  } catch (e) {
                                    onNotify(e.message || 'Delete failed', 'error');
                                  }
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] font-bold text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="size-3.5" /> Delete
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TablePagination
            {...pagination}
            noun="customers"
            rowsPerPageLabel="Rows per page"
            pageSizeOptions={[5, 10, 20, 50]}
            className="px-4 py-3"
          />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white lg:hidden">
          <TablePagination
            {...pagination}
            noun="customers"
            rowsPerPageLabel="Rows per page"
            pageSizeOptions={[5, 10, 20, 50]}
            hideBorder
            className="rounded-2xl px-3 py-2"
          />
        </div>
      </div>

      {detail ? (
        <ModalShell
          wide
          title="Customer Project Ledgers"
          onClose={() => setDetail(null)}
          footer={<button type="button" onClick={() => setDetail(null)} className={primaryBtnClass}>Close</button>}
        >
          {detailLoading ? (
            <p className="py-10 text-center text-[13px] font-semibold text-[#7a8fa6]">Loading ledgers…</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-[12px] border border-[#e5e7eb] bg-[#f8fafc] p-4">
                <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#6b7280]">Customer</p>
                <p className="mt-1 text-[18px] font-extrabold text-[#dc2626]">{detail.customer.name}</p>
                <div className="mt-2 flex flex-wrap gap-4 text-[13px] font-semibold text-[#374151]">
                  <span className="inline-flex items-center gap-1"><Phone className="size-3.5" />{detail.customer.phone || '—'}</span>
                  <span className="inline-flex items-center gap-1">
                    Total Overall Balance:
                    <span className={`font-extrabold ${Number(detail.combined?.net ?? detail.customer.net) > 0 ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>
                      {fmtRs(detail.combined?.net ?? detail.customer.net)}
                    </span>
                  </span>
                </div>
                {(detail.projects || []).length > 1 ? (
                  <p className="mt-2 text-[12px] font-semibold text-[#2563eb]">
                    Auto-detected {detail.projects.length} projects for same customer — Combined ledger sums Debit + Credit automatically (no manual merge).
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-1 border-b border-[#e5e7eb]">
                {detailTabs.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setDetailTab(t.key)}
                    className={`shrink-0 border-b-2 px-3 py-2 text-[12px] font-extrabold ${
                      detailTab === t.key ? 'border-[#dc2626] text-[#dc2626]' : 'border-transparent text-[#6b7280]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {activeDetailLedger ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <article className="rounded-[10px] border border-[#fecaca] bg-[#fef2f2] p-3">
                      <p className="text-[10px] font-bold uppercase text-[#b91c1c]">Debit</p>
                      <p className="mt-1 text-[16px] font-extrabold text-[#dc2626]">{fmtRs(activeDetailLedger.debit)}</p>
                    </article>
                    <article className="rounded-[10px] border border-[#bbf7d0] bg-[#f0fdf4] p-3">
                      <p className="text-[10px] font-bold uppercase text-[#15803d]">Credit</p>
                      <p className="mt-1 text-[16px] font-extrabold text-[#16a34a]">{fmtRs(activeDetailLedger.credit)}</p>
                    </article>
                    <article className="rounded-[10px] border border-[#e5e7eb] bg-white p-3">
                      <p className="text-[10px] font-bold uppercase text-[#6b7280]">Balance</p>
                      <p className={`mt-1 text-[16px] font-extrabold ${Number(activeDetailLedger.net) > 0 ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{fmtRs(activeDetailLedger.net)}</p>
                    </article>
                  </div>
                  <div className="overflow-auto rounded-[12px] border border-[#e5e7eb]">
                    <table className="min-w-full text-left text-[13px]">
                      <thead className="bg-[#f9fafb] text-[11px] font-extrabold uppercase tracking-wide text-[#6b7280]">
                        <tr>
                          {['Date', 'Particulars', 'Debit', 'Credit', 'Balance'].map((h) => (
                            <th key={h} className="px-3 py-2.5">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(activeDetailLedger.rows || []).length === 0 ? (
                          <tr><td colSpan={5} className="px-3 py-8 text-center text-[#9ca3af]">No entries in this ledger.</td></tr>
                        ) : (activeDetailLedger.rows || []).map((e, idx) => (
                          <tr key={`${e.date}-${idx}`} className="border-t border-[#f3f4f6]">
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDisplayDate(e.date)}</td>
                            <td className="px-3 py-2">{e.particulars}</td>
                            <td className="px-3 py-2 font-extrabold text-[#dc2626]">{e.debit ? fmtRs(e.debit) : '—'}</td>
                            <td className="px-3 py-2 font-extrabold text-[#16a34a]">{e.credit ? fmtRs(e.credit) : '—'}</td>
                            <td className={`px-3 py-2 font-extrabold ${Number(e.balance) > 0 ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{fmtRs(e.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </ModalShell>
      ) : null}

      {settle ? (
        <ModalShell
          wide
          title="Settlement Payment"
          titleIcon={(
            <span className="grid size-8 place-items-center rounded-full bg-[#fef2f2] text-[#dc2626]">
              <IndianRupee className="size-4" />
            </span>
          )}
          onClose={() => setSettle(null)}
          footer={(
            <>
              <button type="button" onClick={() => setSettle(null)} className="h-11 min-w-[110px] rounded-[10px] border border-[#d9e4f2] px-5 text-[13px] font-extrabold text-[#53647f]">Cancel</button>
              <button type="button" disabled={saving} onClick={saveSettle} className="h-11 min-w-[140px] rounded-[10px] bg-[#dc2626] px-5 text-[13px] font-extrabold text-white disabled:opacity-60">{saving ? 'Saving...' : 'Save Payment'}</button>
            </>
          )}
        >
          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-[12px] border border-[#e8eef6] bg-[#f8fafc] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#94a3b8]">Customer</p>
                <p className="mt-0.5 text-[16px] font-extrabold text-[#111827]">{settle.name}</p>
                <p className="text-[12px] font-semibold text-[#64748b]">{settle.phone || '—'}</p>
              </div>
              <div className="rounded-[10px] border border-[#e2e8f0] bg-white px-4 py-2 text-right">
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#94a3b8]">Net Balance</p>
                <p className={`text-[16px] font-extrabold ${settle.net > 0 ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{fmtRs(Math.abs(settle.net))}</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-[10px] font-extrabold uppercase tracking-wide text-[#94a3b8]">
                Settlement Amount <span className="text-[#dc2626]">*</span>
                <input
                  type="number"
                  className="h-11 w-full rounded-[10px] border border-[#fca5a5] bg-white px-3 text-[14px] font-extrabold text-[#111827] outline-none focus:border-[#dc2626]"
                  value={settle.amount}
                  onChange={(e) => setSettle((s) => ({ ...s, amount: e.target.value }))}
                />
              </label>
              <label className="grid gap-1 text-[10px] font-extrabold uppercase tracking-wide text-[#94a3b8]">
                Payment Date
                <input
                  type="date"
                  className="h-11 w-full rounded-[10px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none"
                  value={settle.payment_date}
                  onChange={(e) => setSettle((s) => ({ ...s, payment_date: e.target.value }))}
                />
              </label>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}
