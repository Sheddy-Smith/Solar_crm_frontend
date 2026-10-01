import { useState } from 'react';
import { ChevronRight, MoreVertical } from 'lucide-react';
import { cx } from '../../lib/utils.js';

const AVATAR_TONES = [
  'bg-[#0b65e5]',
  'bg-[#0d9f4a]',
  'bg-[#7c3aed]',
  'bg-[#e2594c]',
  'bg-[#d97706]',
  'bg-[#0891b2]',
  'bg-[#db2777]',
];

function avatarTone(name) {
  const text = String(name || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'NA';
  return parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

// `!` is needed because the unlayered global `a { color: inherit }` beats layered utilities on link actions.
const ACTION_TONES = {
  green: 'text-[#0d9f4a]! active:bg-[#e8f8eb]',
  blue: 'text-[#0b65e5]! active:bg-[#eef4ff]',
  purple: 'text-[#7c3aed]! active:bg-[#f5f3ff]',
  red: 'text-[#ef4444]! active:bg-[#fff5f5]',
  amber: 'text-[#b45309]! active:bg-[#fff4df]',
  slate: 'text-[#284276]! active:bg-[#eef3fb]',
};

const MENU_TONES = {
  green: 'text-[#0d9f4a]',
  blue: 'text-[#0b65e5]',
  purple: 'text-[#7c3aed]',
  red: 'text-[#ef4444]',
  amber: 'text-[#b45309]',
  slate: 'text-[#1e3261]',
};

/** Phone-only list wrapper; pair it with a desktop table wrapped in `hidden lg:block`. */
export function MobileCardList({ children, className }) {
  return <div className={cx('flex flex-col gap-2.5 lg:hidden', className)}>{children}</div>;
}

export function MobileCardEmpty({ icon: Icon, title, hint, action }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[14px] border border-dashed border-[#d9e4f2] bg-white px-4 py-10 text-center lg:hidden">
      {Icon ? <Icon className="size-9 text-[#c7d4e0]" /> : null}
      <p className="text-[14px] font-extrabold text-[#53647f]">{title}</p>
      {hint ? <p className="text-[12px] font-semibold text-[#8a98af]">{hint}</p> : null}
      {action}
    </div>
  );
}

function ActionButton({ action }) {
  const Icon = action.icon;
  const className = cx(
    'inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-[10px] px-1 text-[12px] font-extrabold transition',
    action.disabled ? 'text-[#b0bdd4]!' : (ACTION_TONES[action.tone] || ACTION_TONES.slate),
  );
  const body = (
    <>
      {Icon ? <Icon className="size-3.5 shrink-0" /> : null}
      <span className="truncate">{action.label}</span>
    </>
  );
  if (action.href && !action.disabled) {
    return (
      <a href={action.href} target={action.external ? '_blank' : undefined} rel={action.external ? 'noreferrer' : undefined} onClick={(e) => e.stopPropagation()} className={className}>
        {body}
      </a>
    );
  }
  return (
    <button type="button" disabled={action.disabled} onClick={action.onClick} className={className}>
      {body}
    </button>
  );
}

/**
 * Tappable record card for phone screens, matching the Lead list card:
 * avatar + title block, badges, label/value details, and a bottom action strip
 * whose last slot opens a "More" menu when `menu` items are given.
 */
export function MobileRecordCard({
  title,
  subtitle,
  avatar,
  icon: Icon,
  iconTone = 'bg-[#eef4ff] text-[#0b65e5]',
  badges,
  aside,
  details = [],
  footnote,
  highlight,
  onOpen,
  actions = [],
  menu = [],
  className,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const visibleDetails = details.filter((d) => d && d.value !== undefined && d.value !== null && d.value !== '');
  const visibleActions = actions.filter(Boolean);
  const visibleMenu = menu.filter(Boolean);
  const stripCount = visibleActions.length + (visibleMenu.length ? 1 : 0);

  const header = (
    <>
      {avatar !== undefined ? (
        <span className={cx('mt-0.5 grid size-11 shrink-0 place-items-center rounded-full text-[13px] font-extrabold text-white', avatarTone(avatar))}>
          {initialsOf(avatar)}
        </span>
      ) : Icon ? (
        <span className={cx('mt-0.5 grid size-11 shrink-0 place-items-center rounded-[12px]', iconTone)}>
          <Icon className="size-5" />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="block min-w-0 break-words text-[15px] font-extrabold leading-snug text-[#1e3261] [&_*]:font-extrabold! [&_*]:text-[#1e3261]!">{title || '—'}</span>
          {aside ? <span className="shrink-0 text-right text-[13px] font-extrabold text-[#1e3261]">{aside}</span> : null}
        </span>
        {subtitle ? <span className="mt-0.5 block text-[12px] font-bold text-[#53647f]">{subtitle}</span> : null}
        {badges ? <span className="mt-2 flex flex-wrap items-center gap-1.5">{badges}</span> : null}
        {visibleDetails.length ? (
          <span className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2">
            {visibleDetails.map((d) => (
              <span key={d.label} className={cx('min-w-0', d.wide && 'col-span-2')}>
                <span className="block text-[10px] font-extrabold uppercase tracking-wide text-[#8a98af]">{d.label}</span>
                <span className={cx('mt-0.5 block break-words text-[12px] font-bold', d.tone === 'danger' ? 'text-[#f04438]' : d.tone === 'success' ? 'text-[#0d9f4a]' : 'text-[#1e3261]')}>
                  {d.value}
                </span>
              </span>
            ))}
          </span>
        ) : null}
        {highlight ? <span className="mt-2 block text-[12px] font-extrabold text-[#53647f]">{highlight}</span> : null}
        {footnote ? <span className="mt-1 block text-[11px] font-semibold text-[#a5b1c7]">{footnote}</span> : null}
      </span>
      {onOpen ? <ChevronRight className="mt-1 size-5 shrink-0 text-[#b0bdd4]" /> : null}
    </>
  );

  return (
    <article className={cx('overflow-hidden rounded-[14px] border border-[#e7eef7] bg-white shadow-[0_8px_20px_rgba(17,39,84,0.06)]', className)}>
      {onOpen ? (
        <button type="button" onClick={onOpen} style={{ textAlign: 'left' }} className="flex w-full items-start gap-3 px-3.5 pb-3 pt-3.5 active:bg-[#f8fbff]">
          {header}
        </button>
      ) : (
        <div className="flex w-full items-start gap-3 px-3.5 pb-3 pt-3.5">{header}</div>
      )}

      {stripCount ? (
        <div
          className="relative grid gap-1 border-t border-[#eef2f8] bg-[#fbfcfe] p-1.5"
          style={{ gridTemplateColumns: `repeat(${stripCount}, minmax(0, 1fr))` }}
        >
          {visibleActions.map((action) => <ActionButton key={action.label} action={action} />)}
          {visibleMenu.length ? (
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={`More actions for ${typeof title === 'string' ? title : 'record'}`}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] text-[12px] font-extrabold text-[#284276] transition active:bg-[#eef3fb]"
            >
              <MoreVertical className="size-3.5" />
              More
            </button>
          ) : null}

          {menuOpen ? (
            <>
              <button type="button" aria-label="Close menu" className="fixed inset-0 z-40 cursor-default bg-black/20" onClick={() => setMenuOpen(false)} />
              <div className="absolute bottom-[calc(100%+6px)] right-1.5 z-50 w-[min(230px,calc(100vw-2rem))] overflow-hidden rounded-[14px] border border-[#e7eef7] bg-white shadow-[0_18px_38px_rgba(17,39,84,0.18)]">
                {visibleMenu.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => { setMenuOpen(false); item.onClick?.(); }}
                      style={{ textAlign: 'left' }}
                      className={cx(
                        'flex w-full items-center gap-2.5 px-3.5 py-3 text-left text-[13px] font-extrabold transition active:bg-[#f8fbff]',
                        item.danger ? 'border-t border-[#f1f5f9] text-[#ef4444]' : (MENU_TONES[item.tone] || MENU_TONES.slate),
                      )}
                    >
                      {ItemIcon ? <ItemIcon className="size-4" /> : null}
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/** Two-button Previous / Next pager sized for thumbs. */
export function MobilePager({ page, totalPages, onPrev, onNext, summary }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 lg:hidden">
      <button type="button" disabled={page <= 1} onClick={onPrev} className="h-11 flex-1 rounded-[12px] border border-[#d9e4f2] bg-white text-[13px] font-extrabold text-[#284276] disabled:opacity-40">Previous</button>
      <span className="shrink-0 px-1 text-center text-[12px] font-extrabold text-[#53647f]">{summary || `${page} / ${totalPages}`}</span>
      <button type="button" disabled={page >= totalPages} onClick={onNext} className="h-11 flex-1 rounded-[12px] border border-[#d9e4f2] bg-white text-[13px] font-extrabold text-[#284276] disabled:opacity-40">Next</button>
    </div>
  );
}
