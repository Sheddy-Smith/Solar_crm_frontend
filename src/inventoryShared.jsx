import navBarImage from './assets/data/nav_bar_img.png';

export function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function fmtInvRs(value) {
  const amount = Number(value || 0);
  return `₹ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtInvQty(value) {
  const qty = Number(value || 0);
  if (Number.isInteger(qty)) return qty.toLocaleString('en-IN');
  return qty.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function InventoryBreadcrumbs({ onOpenSection, current }) {
  return (
    <p className="text-[12px] font-bold text-[#7a8fa6]">
      <button type="button" onClick={() => onOpenSection('Dashboard')} className="hover:text-[#0b65e5]">Dashboard</button>
      <span className="mx-1.5">/</span>
      <button type="button" onClick={() => onOpenSection('Inventory Overview')} className="hover:text-[#0b65e5]">Inventory</button>
      <span className="mx-1.5">/</span>
      <span className="text-[#1e3261]">{current}</span>
    </p>
  );
}

export function InventoryHeroBanner({ title, subtitle }) {
  return (
    <div className="relative overflow-hidden rounded-[16px] border border-[#d9e4f2] shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
      <img src={navBarImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0b3d2e]/92 via-[#0f5132]/78 to-[#166534]/35 professional:from-[#1e3a5f]/94 professional:via-[#243447]/82 professional:to-[#2f4d73]/40" />
      <div className="relative px-4 py-4 sm:px-5 sm:py-5">
        <h1 className="text-[20px] font-extrabold tracking-tight text-white sm:text-[22px]">{title}</h1>
        {subtitle ? (
          <p className="mt-0.5 max-w-2xl text-[12px] font-semibold leading-snug text-white/85">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

export function InventoryKpiCard({ label, value, icon: Icon, wrap, iconWrap, valueClass }) {
  return (
    <div className={cx('rounded-[12px] border p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]', wrap)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold text-[#64748b]">{label}</p>
          <p className={cx('mt-0.5 text-[18px] font-extrabold tabular-nums', valueClass)}>{value}</p>
        </div>
        {Icon ? (
          <span className={cx('grid size-8 place-items-center rounded-[10px]', iconWrap)}>
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function InventoryActivePill({ active = true }) {
  return (
    <span className={cx(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold',
      active
        ? 'bg-[#ecfdf5] text-[#15803d] professional:bg-[#e8eef5] professional:text-[#1e3a5f]'
        : 'bg-[#f1f5f9] text-[#64748b]',
    )}>
      <span className={cx('size-1.5 rounded-full', active ? 'bg-[#22c55e] professional:bg-[#1e3a5f]' : 'bg-[#94a3b8]')} />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

export function InventoryTypePill({ type }) {
  const isIn = String(type || '').toLowerCase() === 'inward' || type === 'IN';
  return (
    <span className={cx(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold',
      isIn
        ? 'bg-[#ecfdf5] text-[#15803d] professional:bg-[#e8eef5] professional:text-[#1e3a5f]'
        : 'bg-[#fee2e2] text-[#b91c1c] professional:bg-[#f5eeee] professional:text-[#6b3a3a]',
    )}>
      <span className={cx('size-1.5 rounded-full', isIn ? 'bg-[#22c55e] professional:bg-[#1e3a5f]' : 'bg-[#ef4444] professional:bg-[#6b3a3a]')} />
      {isIn ? 'IN' : 'OUT'}
    </span>
  );
}

export function InventoryThumb({ name = 'X', size = 'size-9' }) {
  const letter = String(name).trim().charAt(0).toUpperCase() || 'X';
  const hues = ['#dcfce7', '#dbeafe', '#fce7f3', '#ffedd5', '#e0e7ff', '#ccfbf1'];
  const bg = hues[letter.charCodeAt(0) % hues.length];
  return (
    <span
      className={cx('grid shrink-0 place-items-center rounded-[10px] text-[12px] font-extrabold text-[#0f172a]', size)}
      style={{ background: bg }}
    >
      {letter}
    </span>
  );
}

export const INV_KPI_TONES = {
  green: {
    wrap: 'border-[#bbf7d0] bg-gradient-to-br from-[#f0fdf4] to-white professional:border-[#c5d0dc] professional:from-[#e8eef5]',
    iconWrap: 'bg-[#dcfce7] text-[#15803d] professional:bg-[#d7e0ea] professional:text-[#1e3a5f]',
    valueClass: 'text-[#166534] professional:text-[#1e3a5f]',
  },
  blue: {
    wrap: 'border-[#bfdbfe] bg-gradient-to-br from-[#eff6ff] to-white professional:border-[#c5d0dc] professional:from-[#e8eef5]',
    iconWrap: 'bg-[#dbeafe] text-[#1d4ed8] professional:bg-[#d7e0ea] professional:text-[#1e3a5f]',
    valueClass: 'text-[#1e3a8a] professional:text-[#1e3a5f]',
  },
  purple: {
    wrap: 'border-[#e9d5ff] bg-gradient-to-br from-[#faf5ff] to-white professional:border-[#c5d0dc] professional:from-[#e8eef5]',
    iconWrap: 'bg-[#f3e8ff] text-[#7c3aed] professional:bg-[#d7e0ea] professional:text-[#2f4d73]',
    valueClass: 'text-[#6b21a8] professional:text-[#2f4d73]',
  },
  amber: {
    wrap: 'border-[#fed7aa] bg-gradient-to-br from-[#fff7ed] to-white professional:border-[#e2d5be] professional:from-[#f7f3eb]',
    iconWrap: 'bg-[#ffedd5] text-[#c2410c] professional:bg-[#ebe3d4] professional:text-[#6b5320]',
    valueClass: 'text-[#9a3412] professional:text-[#6b5320]',
  },
  lime: {
    wrap: 'border-[#d9f99d] bg-gradient-to-br from-[#f7fee7] to-white professional:border-[#c5d0dc] professional:from-[#e8eef5]',
    iconWrap: 'bg-[#ecfccb] text-[#65a30d] professional:bg-[#d7e0ea] professional:text-[#1e3a5f]',
    valueClass: 'text-[#3f6212] professional:text-[#1e3a5f]',
  },
  red: {
    wrap: 'border-[#fecaca] bg-gradient-to-br from-[#fef2f2] to-white professional:border-[#d9c7c7] professional:from-[#f5eeee]',
    iconWrap: 'bg-[#fee2e2] text-[#dc2626] professional:bg-[#eadada] professional:text-[#6b3a3a]',
    valueClass: 'text-[#991b1b] professional:text-[#6b3a3a]',
  },
};
