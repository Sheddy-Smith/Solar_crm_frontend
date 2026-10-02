import { useEffect, useRef } from 'react';
import { cx } from '../lib/utils.js';

const ACTIVE_TONES = {
  green: 'border-[#0d9f4a] text-[#0d9f4a]',
  blue: 'border-[#0b65e5] text-[#0b65e5]',
  amber: 'border-[#f59e0b] text-[#b76b00]',
  teal: 'border-[#0f766e] text-[#0f766e]',
  red: 'border-[#dc2626] text-[#dc2626]',
};

/**
 * Desktop sub-category strip: plain text tabs on a hairline with the active
 * tab underlined. Phones use MobileSubnavSelect instead (hence `hidden md:flex`).
 * items: [{ value, label, icon?, badge?, badgeClass? }]
 */
export function UnderlineTabs({ items, value, onChange, tone = 'green', className = 'hidden md:flex' }) {
  const scrollRef = useRef(null);
  const activeClass = ACTIVE_TONES[tone] || ACTIVE_TONES.green;

  useEffect(() => {
    const container = scrollRef.current;
    const active = container?.querySelector('[data-active-tab="1"]');
    if (!container || !active || container.scrollWidth <= container.clientWidth) return;
    const left = active.offsetLeft - container.offsetLeft;
    if (left < container.scrollLeft || left + active.offsetWidth > container.scrollLeft + container.clientWidth) {
      container.scrollTo({ left: left - 16, behavior: 'smooth' });
    }
  }, [value]);

  if (!items?.length) return null;

  return (
    <div ref={scrollRef} role="tablist" className={cx('module-tab-scroll -mx-1 gap-1 overflow-x-auto border-b border-[#e8eef6] px-1', className)}>
      {items.map((item) => {
        const isActive = item.value === value;
        const Icon = item.icon;
        const hasBadge = item.badge !== undefined && item.badge !== null && item.badge !== '';
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-active-tab={isActive ? '1' : undefined}
            onClick={() => onChange(item.value)}
            className={cx(
              'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-extrabold transition',
              isActive ? activeClass : 'border-transparent text-[#53647f] hover:text-[#1e3261]',
            )}
          >
            {Icon ? <Icon className="size-4" /> : null}
            {item.label}
            {hasBadge ? (
              <span className={cx('rounded-full px-1.5 py-px text-[10px] font-extrabold', item.badgeClass || 'bg-[#eef2f7] text-[#53647f]')}>
                {item.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
