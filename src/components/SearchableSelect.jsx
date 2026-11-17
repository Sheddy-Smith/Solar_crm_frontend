import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

function normalizeOption(option) {
  if (option == null) return null;
  if (typeof option === 'object') {
    const value = option.value ?? option.id ?? '';
    const label = option.label ?? option.name ?? String(value);
    return { value: String(value), label: String(label), raw: option };
  }
  return { value: String(option), label: String(option), raw: option };
}

function isOtherToken(value) {
  return String(value || '').trim().toLowerCase() === 'other';
}

/**
 * Searchable dropdown for CRM forms.
 * - Type-to-filter options
 * - Optional "Other" → manual text confirmation
 * - Optional hidden `name` for native form submits
 */
export default function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  disabled = false,
  required = false,
  className = '',
  triggerClassName = '',
  allowOther,
  otherPlaceholder = 'Enter custom value...',
  name,
  emptyLabel,
}) {
  const normalized = useMemo(
    () => options.map(normalizeOption).filter(Boolean),
    [options],
  );

  const hasOtherOption = useMemo(
    () => normalized.some((o) => isOtherToken(o.value) || isOtherToken(o.label)),
    [normalized],
  );
  const otherEnabled = allowOther ?? hasOtherOption;
  const otherOption = normalized.find((o) => isOtherToken(o.value) || isOtherToken(o.label));
  const otherValue = otherOption ? otherOption.value : 'Other';

  const selectedInList = useMemo(
    () => normalized.find((o) => o.value === String(value ?? '')),
    [normalized, value],
  );

  const isCustom =
    otherEnabled
    && value != null
    && String(value) !== ''
    && !selectedInList
    && !isOtherToken(value);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [otherText, setOtherText] = useState(isCustom ? String(value) : '');
  const [showOtherInput, setShowOtherInput] = useState(isCustom || isOtherToken(value));
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const inputRef = useRef(null);
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    if (isCustom) {
      setOtherText(String(value));
      setShowOtherInput(true);
    } else if (isOtherToken(value)) {
      setShowOtherInput(true);
    } else if (selectedInList) {
      setShowOtherInput(false);
      setOtherText('');
    }
  }, [value, isCustom, selectedInList]);

  useEffect(() => {
    if (!open) return undefined;
    const update = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = Math.max(rect.width, 240);
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const placeAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
      const height = Math.min(320, Math.max(160, placeAbove ? spaceAbove : spaceBelow));
      setCoords({
        top: placeAbove ? undefined : rect.bottom + 6,
        bottom: placeAbove ? window.innerHeight - rect.top + 6 : undefined,
        left,
        width,
        maxHeight: height,
      });
    };
    update();
    const onWin = () => update();
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
  }, [open]);

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

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return normalized;
    return normalized.filter((o) => `${o.label} ${o.value}`.toLowerCase().includes(needle));
  }, [normalized, query]);

  const displayLabel = (() => {
    if (isCustom) return String(value);
    if (isOtherToken(value) && otherText) return otherText;
    if (selectedInList) return selectedInList.label;
    if (value) return String(value);
    return '';
  })();

  const commit = (next) => {
    onChange?.(next);
  };

  const pickOption = (opt) => {
    if (otherEnabled && (isOtherToken(opt.value) || isOtherToken(opt.label))) {
      setShowOtherInput(true);
      setOtherText('');
      commit(otherValue);
      setOpen(false);
      return;
    }
    setShowOtherInput(false);
    setOtherText('');
    commit(opt.value);
    setOpen(false);
  };

  const confirmOther = () => {
    const typed = otherText.trim();
    if (!typed) {
      commit(otherValue);
      return;
    }
    commit(typed);
    setShowOtherInput(true);
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
          zIndex: 10050,
        }}
        className="flex flex-col overflow-hidden rounded-[10px] border border-[#d9e4f2] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.22)]"
      >
        <div className="shrink-0 border-b border-[#edf2f8] p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#8a98af]" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 w-full rounded-[8px] border border-[#d9e4f2] bg-[#f8fafc] pl-8 pr-3 text-[13px] font-semibold text-[#1e3261] outline-none focus:border-[#0b65e5]"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {!required ? (
            <button
              type="button"
              onClick={() => {
                setShowOtherInput(false);
                setOtherText('');
                commit('');
                setOpen(false);
              }}
              className="flex w-full px-3 py-2 text-left text-[12px] font-semibold text-[#8a98af] hover:bg-[#f5f9ff]"
            >
              {emptyLabel || placeholder}
            </button>
          ) : null}
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-[12px] font-semibold text-[#8a98af]">No matches</p>
          ) : filtered.map((opt) => {
            const active = String(value) === opt.value || (isCustom && isOtherToken(opt.value));
            return (
              <button
                key={`${opt.value}::${opt.label}`}
                type="button"
                onClick={() => pickOption(opt)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[#f5f9ff] ${active ? 'bg-[#eff6ff]' : ''}`}
              >
                <span className={`truncate text-[13px] font-bold ${active ? 'text-[#0b65e5]' : 'text-[#1e3261]'}`}>
                  {opt.label}
                </span>
                {active ? <Check className="size-3.5 shrink-0 text-[#0b65e5]" /> : null}
              </button>
            );
          })}
        </div>
      </div>,
      document.body,
    )
    : null;

  return (
    <div className={className || undefined}>
      {name ? <input type="hidden" name={name} value={value ?? ''} required={required && !value} /> : null}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen((v) => !v); }}
        className={
          triggerClassName
          || 'flex h-11 w-full items-center justify-between gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-3 text-left text-[13px] font-semibold text-[#1e2a38] outline-none transition focus:border-[#0b65e5] focus:ring-2 focus:ring-[#e3efff] disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:opacity-80 sm:h-9'
        }
      >
        <span className={`min-w-0 truncate ${displayLabel ? 'text-[#1e2a38]' : 'text-[#8a98af]'}`}>
          {displayLabel || placeholder}
        </span>
        <ChevronDown className={`size-4 shrink-0 text-[#7585a2] transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {showOtherInput && otherEnabled ? (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                confirmOther();
              }
            }}
            placeholder={otherPlaceholder}
            className="h-10 min-w-0 flex-1 rounded-[8px] border border-[#d9e4f2] bg-white px-3 text-[13px] font-semibold text-[#1e2a38] outline-none focus:border-[#0b65e5] focus:ring-2 focus:ring-[#e3efff]"
          />
          <button
            type="button"
            onClick={confirmOther}
            className="h-10 shrink-0 rounded-[8px] bg-[#0b65e5] px-3 text-[12px] font-extrabold text-white hover:bg-[#084fc0]"
          >
            Confirm
          </button>
        </div>
      ) : null}
      {menu}
    </div>
  );
}

/** Normalize API user/employee rows into SearchableSelect options. */
export function toSelectOptions(rows, { labelKeys = ['name', 'label'], valueKey = 'id' } = {}) {
  return (rows || []).map((row) => {
    if (row == null) return null;
    if (typeof row !== 'object') return { value: String(row), label: String(row) };
    const label = labelKeys.map((k) => row[k]).find(Boolean)
      || row.email
      || row.username
      || String(row[valueKey] ?? '');
    return { value: String(row[valueKey] ?? row.value ?? ''), label: String(label) };
  }).filter((o) => o && o.value !== '');
}
