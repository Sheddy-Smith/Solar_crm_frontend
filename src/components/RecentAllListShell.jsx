import { ArrowRight, ChevronLeft, Clock3 } from 'lucide-react';
import { cx } from '../lib/utils.js';
import { RECENT_ACTIVITY_DAYS, RECENT_LIST_LIMIT } from '../lib/recentAllList.js';

/** Page title + subtitle for Recent vs All modes. */
export function RecentAllPageHeading({
  isAll,
  moduleLabel,
  recentTitle,
  allTitle,
  recentSubtitle,
  allSubtitle,
  onBackToRecent,
  actions = null,
  crumbs = null,
}) {
  const title = isAll
    ? (allTitle || `All ${moduleLabel}`)
    : (recentTitle || `${moduleLabel} (Recent)`);
  const subtitle = isAll
    ? (allSubtitle || `Complete list of ${moduleLabel.toLowerCase()} (Recent + Older).`)
    : (recentSubtitle || `Showing the latest ${RECENT_LIST_LIMIT} ${moduleLabel.toLowerCase()} you recently worked on (view, edit or update).`);

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {isAll ? (
          <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[12px] font-bold text-[#94a3b8]">
            {onBackToRecent ? (
              <button
                type="button"
                onClick={onBackToRecent}
                className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-[#f1a8a8] bg-white px-2.5 text-[12px] font-extrabold text-[#e11d48] shadow-sm hover:bg-[#fff5f5]"
              >
                <ChevronLeft className="size-3.5" strokeWidth={2.5} />
                Back
              </button>
            ) : null}
            {crumbs || (
              <span>
                <span className="text-[#64748b]">{moduleLabel}</span>
                <span className="mx-1.5 text-[#cbd5e1]">&gt;</span>
                <span className="font-extrabold text-[#0f172a]">All {moduleLabel}</span>
              </span>
            )}
          </div>
        ) : null}
        <h2 className="text-[18px] font-extrabold tracking-tight text-[#0f172a] sm:text-[20px]">{title}</h2>
        <p className="mt-0.5 text-[12px] font-semibold text-[#7386a3]">{subtitle}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Section label above the Recent preview table. */
export function RecentRecordsSectionHeader({
  moduleLabel = 'records',
  showing = RECENT_LIST_LIMIT,
  total = null,
  days = RECENT_ACTIVITY_DAYS,
}) {
  return (
    <div className="mb-2 flex flex-wrap items-end justify-between gap-2 px-0.5">
      <div>
        <h3 className="text-[14px] font-extrabold text-[#0f172a]">
          Recently Worked {moduleLabel} (Last {days} Days)
        </h3>
        <p className="text-[11px] font-semibold text-[#94a3b8]">
          {total != null ? `Showing ${showing} of ${total}` : `Latest ${showing} worked records`}
        </p>
      </div>
    </div>
  );
}

/** Section label for the older / full paginated block (Design B). */
export function EarlierRecordsSectionHeader({ moduleLabel = 'records' }) {
  return (
    <div className="mb-2 mt-4 flex items-center gap-2 px-0.5">
      <Clock3 className="size-4 text-[#64748b]" />
      <h3 className="text-[14px] font-extrabold text-[#0f172a]">Earlier {moduleLabel}</h3>
    </div>
  );
}

/** Primary CTA — opens the complete database view. */
export function ViewAllRecordsButton({
  label = 'View All →',
  onClick,
  className = '',
  disabled = false,
}) {
  return (
    <div className={cx('flex justify-center px-2 py-4 sm:justify-end', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="inline-flex h-11 min-w-[200px] items-center justify-center gap-2 rounded-[10px] bg-[#2563eb] px-5 text-[14px] font-extrabold text-white shadow-[0_10px_22px_rgba(37,99,235,0.28)] transition hover:bg-[#1d4ed8] disabled:opacity-60"
      >
        {label}
        <ArrowRight className="size-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}

/**
 * Client-side split helper UI wrapper:
 * recent mode → children(recentRows) + View All
 * all mode → children(allRows) with optional earlier header
 */
export function RecentAllListFrame({
  isAll,
  moduleLabel,
  recentTitle,
  allTitle,
  recentSubtitle,
  allSubtitle,
  onOpenAll,
  onBackToRecent,
  headerActions = null,
  viewAllLabel,
  children,
  showRecentSectionHeader = true,
  totalCount = null,
  recentCount = RECENT_LIST_LIMIT,
}) {
  return (
    <div className="space-y-3">
      <RecentAllPageHeading
        isAll={isAll}
        moduleLabel={moduleLabel}
        recentTitle={recentTitle}
        allTitle={allTitle}
        recentSubtitle={recentSubtitle}
        allSubtitle={allSubtitle}
        onBackToRecent={onBackToRecent}
        actions={headerActions}
      />
      {!isAll && showRecentSectionHeader ? (
        <RecentRecordsSectionHeader
          moduleLabel={moduleLabel}
          showing={recentCount}
          total={totalCount}
        />
      ) : null}
      {children}
      {!isAll ? (
        <ViewAllRecordsButton
          label={viewAllLabel || `View All ${moduleLabel} →`}
          onClick={onOpenAll}
        />
      ) : null}
    </div>
  );
}
