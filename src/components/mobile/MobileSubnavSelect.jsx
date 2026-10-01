import { ChevronDown, ChevronRight } from 'lucide-react';
import { cx } from '../../lib/utils.js';

const TONES = {
  green: { button: 'bg-[#0d9f4a] active:bg-[#078c3e] shadow-[0_8px_18px_rgba(13,159,74,0.25)]', ring: 'focus:border-[#0d9f4a] focus:ring-[#dff6e7]', text: 'text-[#0d9f4a]' },
  blue: { button: 'bg-[#0b65e5] active:bg-[#0a56c4] shadow-[0_8px_18px_rgba(11,101,229,0.25)]', ring: 'focus:border-[#0b65e5] focus:ring-[#e3efff]', text: 'text-[#0b65e5]' },
  amber: { button: 'bg-[#f59e0b] active:bg-[#d98b06] shadow-[0_8px_18px_rgba(245,158,11,0.28)]', ring: 'focus:border-[#f59e0b] focus:ring-[#fff0dc]', text: 'text-[#b76b00]' },
  teal: { button: 'bg-[#0f766e] active:bg-[#0c625b] shadow-[0_8px_18px_rgba(15,118,110,0.25)]', ring: 'focus:border-[#0f766e] focus:ring-[#e7faf8]', text: 'text-[#0f766e]' },
  red: { button: 'bg-[#dc2626] active:bg-[#b91c1c] shadow-[0_8px_18px_rgba(220,38,38,0.22)]', ring: 'focus:border-[#dc2626] focus:ring-[#fee2e2]', text: 'text-[#dc2626]' },
};

/**
 * Phone replacement for a horizontal sub-category strip: a native dropdown
 * (OS picker on mobile) plus a Next button that steps to the following item.
 * items: [{ value, label }]
 */
export function MobileSubnavSelect({ items, value, onChange, label = 'Sub-category', tone = 'green', note, className = 'md:hidden' }) {
  if (!items?.length) return null;
  const palette = TONES[tone] || TONES.green;
  const foundIndex = items.findIndex((item) => item.value === value);
  const index = foundIndex < 0 ? 0 : foundIndex;
  const isLast = index >= items.length - 1;
  const nextItem = isLast ? null : items[index + 1];

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-bold text-[#8a98af]">
        <span>{label}</span>
        <span className={palette.text}>{index + 1} / {items.length}</span>
      </div>
      <div className="flex items-stretch gap-2">
        <div className="relative min-w-0 flex-1">
          <select
            value={items[index].value}
            onChange={(event) => onChange(event.target.value)}
            aria-label={label}
            className={cx(
              'h-11 w-full appearance-none truncate rounded-[12px] border border-[#d9e4f2] bg-white pl-3.5 pr-10 text-[14px] font-extrabold text-[#1e3261] shadow-[0_6px_14px_rgba(17,39,84,0.05)] outline-none focus:ring-2',
              palette.ring,
            )}
          >
            {items.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#53647f]" />
        </div>
        <button
          type="button"
          onClick={() => nextItem && onChange(nextItem.value)}
          disabled={isLast}
          title={nextItem ? nextItem.label : undefined}
          className={cx(
            'inline-flex h-11 shrink-0 items-center justify-center gap-1 rounded-[12px] px-4 text-[13px] font-extrabold text-white transition active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-[#c5cfdd] disabled:shadow-none',
            palette.button,
          )}
        >
          Next
          <ChevronRight className="size-4" />
        </button>
      </div>
      {note ? <p className="mt-1.5 truncate text-[11px] font-semibold text-[#8a98af]">{note}</p> : null}
    </div>
  );
}
