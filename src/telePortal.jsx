import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock3,
  Eye,
  EyeOff,
  Headset,
  Home,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  MonitorCog,
  Moon,
  Pencil,
  Phone,
  PhoneCall,
  Plus,
  Search,
  ShieldCheck,
  StickyNote,
  Sun,
  Trash2,
  Trophy,
  UserRound,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { cx } from './lib/utils.js';
import { authApi, leadApi, followUpApi } from './api.js';
import { PwaInstallBanner, PwaInstallIconButton } from './components/mobile/PwaInstallControls.jsx';
import { hasModuleAccess } from './settingsHubPages.jsx';
import { TeleDailyTasksPage } from './teleDailyTasks.jsx';

export const TELE_ROLE_NAME = 'Tele Sales Executive';
export const SALES_EXEC_ROLE_NAME = 'Sales Executive';

/** Accept exact name plus common plural / typo variants from admin UI. */
export function isTeleExecutiveRole(roleName) {
  const n = String(roleName || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return (
    n === 'tele sales executive' ||
    n === 'tele sales executives' ||
    n === 'tele sales exccutives' ||
    n === 'telecaller'
  );
}

/** Roles allowed into the Tele Executive portal. */
export function canAccessTelePortal(roleName) {
  const n = String(roleName || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (isTeleExecutiveRole(roleName)) return true;
  return (
    n === 'sales executive' ||
    n === 'sales executives' ||
    n === 'sales manager' ||
    n === 'sales managers'
  );
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

const BRAND_LOGO_SRC = '/brand/malwa-logo-wordmark-light.png';
const BRAND_LOGO_DARK_SRC = '/brand/malwa-logo-wordmark-dark.png';
const BRAND_MARK_SRC = '/brand/malwa-logo-mark-light.png';
const BRAND_MARK_DARK_SRC = '/brand/malwa-logo-mark-dark.png';

function TeleBrandLockup() {
  return (
    <div className="sidebar-brand-lockup relative -mt-0.5 flex w-full min-w-0 flex-col items-center justify-start">
      <img
        src={BRAND_LOGO_SRC}
        alt="Malwa Solar Energy"
        className="h-auto w-[92%] max-h-[48px] -translate-y-0.5 select-none object-contain dark:hidden"
        draggable={false}
      />
      <img
        src={BRAND_LOGO_DARK_SRC}
        alt="Malwa Solar Energy"
        className="hidden h-auto w-[92%] max-h-[48px] -translate-y-0.5 select-none object-contain dark:block"
        draggable={false}
      />
      <p className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#1d4ed8]">Tele Executive</p>
    </div>
  );
}

function TeleBrandMark({ size = 'md' }) {
  const boxClass = size === 'lg' ? 'size-[52px]' : size === 'sm' ? 'size-12' : 'size-[46px]';
  const imgClass = size === 'lg' ? 'size-12' : size === 'sm' ? 'size-11' : 'size-10';
  return (
    <div className={cx('sidebar-brand-mark relative grid shrink-0 place-items-center overflow-visible bg-transparent', boxClass)} aria-hidden="true">
      <img
        src={BRAND_MARK_SRC}
        alt=""
        className={cx(imgClass, 'select-none object-contain dark:hidden')}
        draggable={false}
      />
      <img
        src={BRAND_MARK_DARK_SRC}
        alt=""
        className={cx(imgClass, 'hidden select-none object-contain dark:block')}
        draggable={false}
      />
    </div>
  );
}

// Tele portal shows a single 5-value lead status (New/Hot/Cool/Won/Lost).
// Hot/Cool live on Lead.category in the CRM data model; the rest on Lead.status.
export const TELE_LEAD_STATUSES = ['New', 'Hot', 'Cool', 'Won', 'Lost'];

function teleDisplayStatus(lead) {
  if (lead?.category === 'Hot') return 'Hot';
  if (lead?.category === 'Cool') return 'Cool';
  return lead?.status || 'New';
}

function mapTeleStatusToApi(value) {
  if (value === 'Hot') return { status: 'Follow-up', category: 'Hot' };
  if (value === 'Cool') return { status: 'Follow-up', category: 'Cool' };
  return { status: value, category: '' };
}

const TELE_STATUS_TONES = {
  New: 'bg-[#e7efff] text-[#1d4ed8]',
  Hot: 'bg-[#fff1e0] text-[#ea7c1c]',
  Cool: 'bg-[#f0e9ff] text-[#7c3aed]',
  'Follow-up': 'bg-[#fff4e0] text-[#c07a06]',
  Quotation: 'bg-[#e0f5f7] text-[#0e7490]',
  Won: 'bg-[#e8f8eb] text-[#0d9f4a]',
  Lost: 'bg-[#feecec] text-[#dc2626]',
};

const FOLLOW_UP_TYPES = ['Call', 'WhatsApp', 'Site Visit', 'Email', 'Note'];

const FOLLOW_UP_OUTCOMES = [
  'Interested',
  'Thinking',
  'Busy',
  'Not Reachable',
  'Call Back Later',
  'Site Visit Fixed',
  'Not Interested',
  'Wrong Number',
  'Other',
];

const FOLLOW_UP_HISTORY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: '7d', label: '7 Days', days: 7 },
  { id: '1m', label: '1 Month', days: 30 },
  { id: '6m', label: '6 Months', days: 182 },
  { id: '1y', label: '1 Year', days: 365 },
];

const FOLLOW_UP_TYPE_ICONS = {
  Call: PhoneCall,
  WhatsApp: MessageCircle,
  'Site Visit': MapPin,
  Email: Mail,
  Note: StickyNote,
};

const REMINDER_OPTIONS = [
  'No reminder', '15 minutes before', '30 minutes before', '1 hour before',
  '2 hours before', '1 day before', '2 days before',
];
const REMINDER_CUSTOM = '__custom_date__';

function extractReminderDate(value) {
  if (!value) return '';
  const iso = String(value).match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const parsed = new Date(String(value).replace(/^On\s+/i, ''));
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return '';
}

function isPresetReminder(value) {
  return !value || REMINDER_OPTIONS.includes(value);
}

function TeleReminderField({ value, onChange, label = 'Reminder' }) {
  const custom = Boolean(value) && !isPresetReminder(value);
  const selectValue = custom ? REMINDER_CUSTOM : (value || 'No reminder');
  const dateValue = custom ? (extractReminderDate(value) || '') : '';

  return (
    <TeleField label={label}>
      <select
        value={selectValue}
        onChange={(event) => {
          const next = event.target.value;
          if (next === REMINDER_CUSTOM) {
            onChange(`On ${dateValue || new Date().toISOString().slice(0, 10)}`);
            return;
          }
          onChange(next);
        }}
        className={teleInputClass}
      >
        {REMINDER_OPTIONS.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
        <option value={REMINDER_CUSTOM}>Custom date...</option>
      </select>
      {custom ? (
        <input
          type="date"
          value={dateValue}
          onChange={(event) => {
            const nextDate = event.target.value;
            onChange(nextDate ? `On ${nextDate}` : 'No reminder');
          }}
          className={cx(teleInputClass, 'mt-2')}
          aria-label="Custom reminder date"
        />
      ) : null}
    </TeleField>
  );
}

const LEAD_SOURCES = ['Walk-in', 'Campaign', 'Reference', 'Other'];

function StatusPill({ value }) {
  return (
    <span className={cx('inline-flex whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-extrabold', TELE_STATUS_TONES[value] || 'bg-[#eef2f8] text-[#53647f]')}>
      {value}
    </span>
  );
}

function formatDate(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatTime(value) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(value) {
  const dateLabel = formatDate(value);
  const timeLabel = formatTime(value);
  return dateLabel === '—' ? '—' : `${dateLabel}, ${timeLabel}`;
}

/** Open the OS / linked desktop dialer for a lead mobile number. */
function dialTeleMobile(mobile) {
  const raw = String(mobile || '').trim();
  if (!raw) return false;
  const href = raw.startsWith('+')
    ? `tel:${raw.replace(/[^\d+]/g, '')}`
    : `tel:${raw.replace(/\D/g, '')}`;
  if (href === 'tel:' || href === 'tel:+') return false;
  window.location.href = href;
  return true;
}

export function followUpAgeLabel(value) {
  if (!value) return '';
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) return '';
  const days = Math.floor((Date.now() - when.getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 365) {
    const months = Math.max(1, Math.round(days / 30));
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }
  const years = Math.max(1, Math.round(days / 365));
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

function startOfLocalDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toLocalIsoDate(date = new Date()) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalIsoDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function formatLocalIsoLabel(iso) {
  const date = parseLocalIsoDate(iso);
  if (!date) return iso || '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Split scheduled follow-ups into today's (high alert) vs overdue (extra high). */
export function splitFollowUpAlerts(scheduledRows) {
  const todayStart = startOfLocalDay();
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const today = [];
  const overdue = [];
  for (const item of scheduledRows || []) {
    const when = new Date(item.scheduled_at);
    if (Number.isNaN(when.getTime())) continue;
    if (when < todayStart) overdue.push(item);
    else if (when < tomorrowStart) today.push(item);
  }
  today.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  overdue.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  return { today, overdue };
}

function TeleFollowUpAlertRow({ item, level, onCall, onLog, onView }) {
  const Icon = FOLLOW_UP_TYPE_ICONS[item.follow_up_type] || PhoneCall;
  const isExtra = level === 'extra';
  return (
    <div
      className={cx(
        'flex items-start gap-3 rounded-[12px] border px-3 py-2.5',
        isExtra
          ? 'border-[#fecaca] bg-[#fff5f5]'
          : 'border-[#fde68a] bg-[#fffbeb]',
      )}
    >
      <span
        className={cx(
          'grid size-10 shrink-0 place-items-center rounded-full',
          isExtra ? 'bg-[#fee2e2] text-[#dc2626]' : 'bg-[#fef3c7] text-[#d97706]',
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[13px] font-extrabold text-[#1e3261]">{item.lead_customer_name || 'Customer'}</p>
          <span
            className={cx(
              'inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide',
              isExtra ? 'bg-[#dc2626] text-white' : 'bg-[#f59e0b] text-white',
            )}
          >
            {isExtra ? 'Extra High' : 'High Alert'}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] font-semibold text-[#7585a2]">
          {isExtra ? formatDateTime(item.scheduled_at) : formatTime(item.scheduled_at)}
          {' · '}
          {item.follow_up_type || 'Call'}
          {isExtra ? ` · Pending ${followUpAgeLabel(item.scheduled_at)}` : ''}
        </p>
        {(item.lead_assigned_to_name || item.created_by_name) ? (
          <p className="mt-0.5 text-[11px] font-extrabold text-[#1e3261]">
            {isExtra ? 'Missed by: ' : 'Owner: '}
            {item.lead_assigned_to_name || item.created_by_name}
          </p>
        ) : null}
        {item.lead_mobile_number ? (
          <p className="mt-0.5 text-[11px] font-bold text-[#53647f]">{item.lead_mobile_number}</p>
        ) : null}
        {item.notes ? (
          <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold text-[#33456b]">
            {item.notes}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
        {onLog ? (
          <button
            type="button"
            onClick={() => onLog(item)}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-[8px] border border-[#1d4ed8] bg-white px-2.5 text-[11px] font-extrabold text-[#1d4ed8]"
          >
            <StickyNote className="size-3.5" />
            Log
          </button>
        ) : null}
        {onView ? (
          <button
            type="button"
            onClick={() => onView(item)}
            className="inline-flex h-8 items-center justify-center rounded-[8px] border border-[#e2e9f3] bg-white px-2.5 text-[11px] font-extrabold text-[#1d4ed8]"
          >
            View
          </button>
        ) : null}
        {onCall ? (
          <button
            type="button"
            onClick={() => onCall(item)}
            className={cx(
              'inline-flex h-8 items-center justify-center gap-1 rounded-[8px] px-2.5 text-[11px] font-extrabold text-white',
              isExtra ? 'bg-[#dc2626] hover:bg-[#b91c1c]' : 'bg-[#f59e0b] hover:bg-[#d97706]',
            )}
          >
            <Phone className="size-3.5" />
            Call
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function TeleFollowUpAlertsPanel({
  todayFollowUps,
  overdueFollowUps,
  loaded = true,
  compact = false,
  onOpenToday,
  onOpenOverdue,
  onCall,
  onLog,
  onView,
}) {
  const todayCount = todayFollowUps?.length || 0;
  const overdueCount = overdueFollowUps?.length || 0;
  const todayPreview = (todayFollowUps || []).slice(0, compact ? 4 : 8);
  const overduePreview = (overdueFollowUps || []).slice(0, compact ? 4 : 8);

  return (
    <div className={cx('grid gap-4', compact ? '' : 'xl:grid-cols-2')}>
      {/* High Alert — today's follow-ups */}
      <section
        className={cx(
          'overflow-hidden rounded-[16px] border-2 border-[#f59e0b]/55 bg-white shadow-[0_12px_28px_rgba(245,158,11,0.12)]',
          todayCount > 0 && 'ring-2 ring-[#fde68a]/80',
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#fde68a] bg-[linear-gradient(90deg,#fff7ed_0%,#fffbeb_100%)] px-4 py-3">
          <button
            type="button"
            onClick={onOpenToday}
            className="flex min-w-0 items-center gap-2.5 text-left"
          >
            <span className="grid size-10 place-items-center rounded-full bg-[#f59e0b] text-white shadow-[0_6px_14px_rgba(245,158,11,0.35)]">
              <Zap className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-extrabold text-[#92400e]">High Alert · Today's Follow-ups</p>
              <p className="text-[11px] font-semibold text-[#b45309]">Follow-ups due today</p>
            </div>
          </button>
          <span className="inline-flex min-w-[36px] items-center justify-center rounded-full bg-[#f59e0b] px-2.5 py-1 text-[14px] font-extrabold text-white">
            {loaded ? todayCount : '—'}
          </span>
        </div>
        <div className="space-y-2 p-3.5">
          {!loaded && <p className="py-6 text-center text-[12px] font-bold text-[#7585a2]">Loading...</p>}
          {loaded && todayCount === 0 && (
            <p className="rounded-[10px] bg-[#fffbeb] px-3 py-5 text-center text-[12px] font-bold text-[#92400e]/80">
              No follow-ups due today. Good work!
            </p>
          )}
          {todayPreview.map((item) => (
            <TeleFollowUpAlertRow
              key={item.id}
              item={item}
              level="high"
              onCall={onCall}
              onLog={onLog}
              onView={onView}
            />
          ))}
          {loaded && todayCount > 0 && onOpenToday ? (
            <button
              type="button"
              onClick={onOpenToday}
              className="flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-[#fde68a] bg-[#fffbeb] py-2.5 text-[12px] font-extrabold text-[#b45309] transition hover:bg-[#fef3c7]"
            >
              View all {todayCount} follow-ups due today
              <ArrowRight className="size-3.5" />
            </button>
          ) : null}
        </div>
      </section>

      {/* Extra High Alert — overdue / missed schedule */}
      <section
        className={cx(
          'overflow-hidden rounded-[16px] border-2 border-[#ef4444]/50 bg-white shadow-[0_12px_28px_rgba(220,38,38,0.12)]',
          overdueCount > 0 && 'ring-2 ring-[#fecaca]/90',
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#fecaca] bg-[linear-gradient(90deg,#fef2f2_0%,#fff5f5_100%)] px-4 py-3">
          <button
            type="button"
            onClick={onOpenOverdue}
            className="flex min-w-0 items-center gap-2.5 text-left"
          >
            <span className="grid size-10 place-items-center rounded-full bg-[#dc2626] text-white shadow-[0_6px_14px_rgba(220,38,38,0.35)]">
              <AlertTriangle className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-extrabold text-[#991b1b]">Extra High Alert · Pending</p>
              <p className="text-[11px] font-semibold text-[#b91c1c]">Missed earlier — still pending</p>
            </div>
          </button>
          <span className="inline-flex min-w-[36px] items-center justify-center rounded-full bg-[#dc2626] px-2.5 py-1 text-[14px] font-extrabold text-white">
            {loaded ? overdueCount : '—'}
          </span>
        </div>
        <div className="space-y-2 p-3.5">
          {!loaded && <p className="py-6 text-center text-[12px] font-bold text-[#7585a2]">Loading...</p>}
          {loaded && overdueCount === 0 && (
            <p className="rounded-[10px] bg-[#fef2f2] px-3 py-5 text-center text-[12px] font-bold text-[#991b1b]/75">
              No overdue pending follow-ups.
            </p>
          )}
          {overduePreview.map((item) => (
            <TeleFollowUpAlertRow
              key={item.id}
              item={item}
              level="extra"
              onCall={onCall}
              onLog={onLog}
              onView={onView}
            />
          ))}
          {loaded && overdueCount > 0 && onOpenOverdue ? (
            <button
              type="button"
              onClick={onOpenOverdue}
              className="flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-[#fecaca] bg-[#fef2f2] py-2.5 text-[12px] font-extrabold text-[#b91c1c] transition hover:bg-[#fee2e2]"
            >
              View all {overdueCount} pending follow-ups
              <ArrowRight className="size-3.5" />
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function filterFollowUpsByRange(rows, filterId) {
  const filter = FOLLOW_UP_HISTORY_FILTERS.find((item) => item.id === filterId);
  if (!filter?.days) return rows;
  const cutoff = Date.now() - filter.days * 86400000;
  return rows.filter((item) => {
    const when = new Date(item.scheduled_at || item.created_at).getTime();
    return Number.isFinite(when) && when >= cutoff;
  });
}

function TeleModal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const handleKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#10213d]/55 p-3 sm:p-6" onClick={onClose}>
      <div
        className={cx('flex max-h-[92vh] w-full flex-col overflow-hidden rounded-[16px] bg-white shadow-[0_30px_70px_rgba(10,28,60,0.35)]', wide ? 'max-w-[720px]' : 'max-w-[520px]')}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e8eef6] px-5 py-4">
          <h3 className="font-display text-[17px] font-extrabold text-[#102446]">{title}</h3>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-[9px] text-[#7585a2] transition hover:bg-[#f3f7fd]" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function TeleField({ label, children }) {
  return (
    <label className="block">
      <span className="text-[13px] font-bold text-[#33456b]">{label}</span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

const teleInputClass = 'h-11 w-full rounded-[9px] border border-[#dbe4f0] bg-white px-3 text-[14px] font-semibold text-[#1f2d44] outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100';

function useTeleIvrsCheck(excludeId) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);

  const check = async (value) => {
    const ivrs = (value || '').trim();
    if (!ivrs) { setResult(null); return; }
    setChecking(true);
    try {
      const data = await leadApi.list({ search: ivrs });
      const rows = Array.isArray(data) ? data : (data?.results ?? []);
      const match = rows.find((row) => row.ivrs_number === ivrs && row.id !== excludeId);
      setResult(match || 'unique');
    } catch {
      setResult(null);
    } finally {
      setChecking(false);
    }
  };

  return { checking, result, check, reset: () => setResult(null) };
}

function TeleIvrsVerifyField({ value, onChange, checking, result, onCheck, onReset }) {
  return (
    <TeleField label="IVRS Number *">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(event) => {
            onReset?.();
            onChange(event.target.value);
          }}
          onBlur={(event) => onCheck(event.target.value)}
          placeholder="Enter IVRS number"
          className={cx(teleInputClass, 'min-w-0 flex-1')}
        />
        <button
          type="button"
          onClick={() => onCheck(value)}
          disabled={checking}
          title="Verify IVRS No"
          aria-label="Verify IVRS No"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-[9px] border border-[#dbe4f0] bg-white text-[#1d4ed8] transition hover:bg-[#f8fbff] disabled:opacity-60"
        >
          <ShieldCheck className={cx('size-4', checking && 'animate-pulse')} />
        </button>
      </div>
      {result && result !== 'unique' ? (
        <div className="mt-2 flex items-start gap-2 rounded-[9px] border border-[#f6dda9] bg-[#fff8e8] px-3 py-2.5 text-[12px] font-bold text-[#a76200]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>This IVRS Number already exists ({result.customer_name}). Use a different IVRS or contact admin.</span>
        </div>
      ) : result === 'unique' ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-extrabold text-[#0d9f4a]">
          <CheckCircle2 className="size-3.5" /> IVRS Number is available
        </p>
      ) : null}
    </TeleField>
  );
}

// ─── Shared auth landing chrome (portal chooser + login pages) ────────────────

function AuthLandingBackground() {
  return (
    <>
      <div
        className="pointer-events-none absolute -left-28 bottom-[-90px] h-[340px] w-[460px] rounded-[48%_52%_44%_56%] bg-[#c8efd2] opacity-80"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-24 top-[-80px] h-[300px] w-[420px] rounded-[56%_44%_50%_50%] bg-[#d5f4de] opacity-85"
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute left-[7%] top-[46%] grid grid-cols-4 gap-2.5 opacity-30" aria-hidden="true">
        {Array.from({ length: 16 }).map((_, i) => (
          <span key={i} className="size-1.5 rounded-full bg-[#8fa0b8]" />
        ))}
      </div>
    </>
  );
}

export function AuthBrandHeader() {
  return (
    <div className="flex items-center gap-3">
      <TeleBrandMark size="lg" />
      <div>
        <p className="font-display text-[18px] font-extrabold leading-tight text-[#0d9f4a] sm:text-[22px]">Malwa Solar Energy</p>
        <div className="mt-1 flex max-w-[210px] items-center gap-2">
          <span className="h-px flex-1 bg-[#0d9f4a]/55" />
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#123c8f] sm:text-[11px]">ERP System</p>
          <span className="h-px flex-1 bg-[#0d9f4a]/55" />
        </div>
      </div>
    </div>
  );
}

export function BuiltByCredit({ className = '' }) {
  return (
    <span className={cx('text-[12px] font-semibold text-[#8a98af]', className)}>
      Designed &amp; developed by{' '}
      <a
        href="https://sheddysmithlab.tech/"
        target="_blank"
        rel="noopener noreferrer"
        className="font-extrabold text-[#3d5273] underline-offset-2 transition hover:text-[#0d9f4a] hover:underline"
      >
        Sheddy Smith Lab
      </a>
    </span>
  );
}

export function ProductFooter({ className = '' }) {
  return (
    <footer
      className={cx(
        'flex shrink-0 flex-col gap-1 border-t border-[#e4ebf4] bg-white/95 px-3 py-2.5 text-center text-[12px] font-semibold text-[#7b88a2] sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:text-left',
        className,
      )}
    >
      <p>Copyright {new Date().getFullYear()} Malwa Solar Energy. All rights reserved.</p>
      <BuiltByCredit className="sm:text-right" />
    </footer>
  );
}

export function AuthLandingFooter() {
  return (
    <footer className="flex flex-col items-center justify-center gap-2 border-t border-[#edf2f8] px-5 py-4 text-center">
      <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
        <p className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-[#0d9f4a]">
          <CheckCircle2 className="size-4" />
          Secure. Reliable. Integrated.
        </p>
        <span className="hidden h-4 w-px bg-[#d7e0ec] sm:block" />
        <p className="text-[13px] font-semibold text-[#8a98af]">Powering Solar Business Growth</p>
      </div>
      <BuiltByCredit />
    </footer>
  );
}

export function AuthLandingShell({ children, maxWidth = 'max-w-[1080px]' }) {
  return (
    <div className="portal-landing-page relative overflow-hidden bg-[#f3f5f7] px-3 py-5 text-[#172648] sm:px-6 sm:py-8">
      <AuthLandingBackground />
      <main className={cx('relative z-10 mx-auto flex w-full flex-col overflow-hidden rounded-[22px] border border-[#e4ebf4] bg-white shadow-[0_18px_50px_rgba(23,43,77,0.10)]', maxWidth)}>
        {children}
      </main>
    </div>
  );
}

// ─── Entry screen: portal chooser ─────────────────────────────────────────────

export function PortalSelectPage({ onSelectCrm, onSelectTele }) {
  const portals = [
    {
      key: 'crm',
      title: 'ERP Operations',
      description: 'Manage leads, projects, installations, O&M, AMC, inventory, accounts, reports and more.',
      icon: MonitorCog,
      iconWrap: 'bg-[#e8f8eb] text-[#0d9f4a]',
      button: 'bg-[#0d9f4a] hover:bg-[#078c3e]',
      buttonLabel: 'Open ERP Operations',
      onClick: onSelectCrm,
    },
    {
      key: 'tele',
      title: 'Tele Executive',
      description: 'Handle calls, follow-ups, lead updates and customer communication.',
      icon: Headset,
      iconWrap: 'bg-[#e7efff] text-[#1d4ed8]',
      button: 'bg-[#1d4ed8] hover:bg-[#1a3fb0]',
      buttonLabel: 'Open Tele Executive',
      onClick: onSelectTele,
    },
  ];

  return (
    <AuthLandingShell>
      <div className="px-5 pt-6 sm:px-9 sm:pt-8">
        <AuthBrandHeader />
      </div>

      <div className="flex flex-col items-center px-5 py-10 sm:px-10 sm:py-14">
        <h1 className="text-center font-display text-[28px] font-extrabold leading-tight text-[#102446] sm:text-[42px]">
          Welcome to <span className="text-[#0d9f4a]">Solar ERP</span>
        </h1>
        <p className="mt-3 text-center text-[15px] font-semibold text-[#5c6676] sm:text-[17px]">
          Choose your portal to continue
        </p>

        <div className="mt-10 grid w-full max-w-[760px] gap-6 sm:mt-12 sm:grid-cols-2">
          {portals.map((portal) => {
            const Icon = portal.icon;
            return (
              <article
                key={portal.key}
                className="flex flex-col items-center rounded-[18px] border border-[#e8eef6] bg-white p-7 text-center shadow-[0_12px_30px_rgba(23,43,77,0.07)] transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(23,43,77,0.12)] sm:p-8"
              >
                <span className={cx('grid size-[88px] place-items-center rounded-full sm:size-24', portal.iconWrap)}>
                  <Icon className="size-10 sm:size-11" />
                </span>
                <h2 className="mt-6 font-display text-[20px] font-extrabold text-[#102446] sm:text-[22px]">{portal.title}</h2>
                <p className="mt-3 text-[13px] font-semibold leading-6 text-[#5c6676] sm:text-[14px]">{portal.description}</p>
                <button
                  type="button"
                  onClick={portal.onClick}
                  className={cx('mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[10px] text-[14px] font-extrabold text-white shadow-[0_12px_24px_rgba(23,43,77,0.16)] transition sm:text-[15px]', portal.button)}
                >
                  {portal.buttonLabel}
                  <ArrowRight className="size-4" />
                </button>
              </article>
            );
          })}
        </div>
      </div>

      <AuthLandingFooter />
    </AuthLandingShell>
  );
}

// ─── Tele Executive login ─────────────────────────────────────────────────────

export function TeleSignInPage({ onLogin, onBack, onNotify }) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleLogin = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setLoginError('Please enter email/username and password.');
      return;
    }
    setLoading(true);
    setLoginError('');
    try {
      const data = await authApi.login(email.trim(), password);
      if (!data?.access) {
        setLoginError('Login failed. Please try again.');
        return;
      }
      const roleName = data?.user?.role_name || '';
      const isSuperAdmin = Boolean(data?.user?.is_super_admin);
      // Tele Sales + Sales Executives (plus Super Admin) may enter this portal.
      // Each role only sees leads they created or that are assigned to them.
      if (!canAccessTelePortal(roleName) && !isSuperAdmin) {
        authApi.logout();
        setLoginError('This portal is for Tele Sales, Sales Executive, or Sales Manager. Please use the CRM Operations portal if your role is not allowed.');
        return;
      }
      onLogin(data.user);
    } catch (err) {
      setLoginError(err.message || 'Invalid email, username or password.');
    } finally {
      setLoading(false);
    }
  };

  const highlights = ['Lead Calling', 'Follow-ups', 'Lead Updates', 'Call History', 'Task Management', 'Reports'];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#eef3f7] px-3 py-6 text-[#172648] sm:px-6">
      <main className="grid w-full max-w-[1020px] overflow-hidden rounded-[20px] border border-[#dfe7f2] bg-white shadow-[0_24px_60px_rgba(23,43,77,0.16)] lg:grid-cols-[46fr_54fr]">
        <section className="relative flex flex-col bg-[linear-gradient(160deg,#123c8f_0%,#1d4ed8_58%,#2563eb_100%)] px-7 py-8 text-white sm:px-9 sm:py-10">
          <div className="absolute -right-10 top-10 size-40 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
          <div className="absolute bottom-8 left-4 size-36 rounded-full bg-[#60a5fa]/25 blur-3xl" aria-hidden="true" />
          <div className="relative z-10 flex items-center gap-3">
            <TeleBrandMark size="lg" />
            <div>
              <p className="font-display text-[18px] font-extrabold leading-tight text-white">Malwa Solar Energy</p>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-white/75">CRM System</p>
            </div>
          </div>
          <div className="relative z-10 mt-10 sm:mt-14">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white">
              <Headset className="size-4" />
              Tele Executive Portal
            </span>
            <h1 className="mt-5 font-display text-[28px] font-extrabold leading-[1.2] sm:text-[34px]">
              Manage calls, follow-ups and customer communication.
            </h1>
            <ul className="mt-8 space-y-3.5">
              {highlights.map((item) => (
                <li key={item} className="flex items-center gap-3 text-[14px] font-bold text-white/95 sm:text-[15px]">
                  <CheckCircle2 className="size-5 shrink-0 text-[#7dd3fc]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <p className="relative z-10 mt-auto pt-10 text-[12px] font-semibold text-white/70">
            Access limited to leads you added or that are assigned to you.
          </p>
        </section>

        <section className="flex items-center justify-center px-5 py-9 sm:px-10 sm:py-12">
          <div className="w-full max-w-[460px]">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-[#5c6676] transition hover:text-[#1d4ed8]"
            >
              <ChevronLeft className="size-4" />
              Choose different portal
            </button>
            <h2 className="mt-5 font-display text-[26px] font-extrabold text-[#102446] sm:text-[30px]">Login to your account</h2>
            <p className="mt-3 text-[14px] font-semibold text-[#5c6676] sm:text-[15px]">
              Enter your credentials to access Tele Executive Portal
            </p>

            <form className="mt-8 space-y-5" onSubmit={handleLogin}>
              <label className="block">
                <span className="text-[14px] font-bold text-[#111827]">Email / Username</span>
                <span className="mt-2.5 flex h-[52px] items-center gap-3 rounded-[9px] border border-black/20 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                  <UserRound className="size-5 text-[#7a8494]" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email, username or mobile"
                    autoComplete="username"
                    spellCheck={false}
                    className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[#1f2d44] outline-none placeholder:text-[#7d8796]"
                  />
                </span>
              </label>

              <label className="block">
                <span className="text-[14px] font-bold text-[#111827]">Password</span>
                <span className="mt-2.5 flex h-[52px] items-center gap-3 rounded-[9px] border border-black/20 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                  <LockKeyhole className="size-5 text-[#7a8494]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[#1f2d44] outline-none placeholder:text-[#7d8796]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="text-[#7a8494] transition hover:text-[#1d4ed8]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </span>
              </label>

              {loginError && (
                <p className="rounded-[8px] bg-red-50 px-4 py-3 text-[13px] font-bold text-red-600">{loginError}</p>
              )}

              <div className="flex items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2.5 text-[13px] font-bold text-[#5a6574]">
                  <input type="checkbox" defaultChecked className="size-4 rounded accent-[#1d4ed8]" />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => onNotify('Forgot password selected')}
                  className="text-[13px] font-bold text-[#1d4ed8] transition hover:text-[#1a3fb0]"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[9px] bg-[#1d4ed8] text-[16px] font-extrabold text-white shadow-[0_14px_28px_rgba(29,78,216,0.28)] transition hover:-translate-y-0.5 hover:bg-[#1a3fb0] disabled:opacity-60"
              >
                <LogIn className="size-5" />
                {loading ? 'Logging in...' : 'Login'}
              </button>

              <p className="text-center text-[13px] font-semibold text-[#8a98af]">
                Don't have an account? <span className="font-extrabold text-[#1d4ed8]">Contact Administrator</span>
              </p>
            </form>
          </div>
        </section>
      </main>
      <BuiltByCredit className="relative z-10 mt-4 text-center" />
    </div>
  );
}

// ─── Tele Executive portal ────────────────────────────────────────────────────

const TELE_NAV_ITEMS = [
  { label: 'Dashboard', icon: Home, path: '/tele/dashboard' },
  { label: 'My Leads', icon: Users, path: '/tele/leads' },
  { label: 'Follow-ups', icon: Phone, path: '/tele/follow-ups' },
  { label: 'Reminders', icon: Bell, path: '/tele/reminders' },
  { label: 'Daily Tasks', icon: ClipboardList, path: '/tele/daily-tasks' },
  { label: 'Reports', icon: BarChart3, path: '/tele/reports' },
  { label: 'Profile Details', icon: UserRound, path: '/tele/profile' },
];

const TELE_PATH_ALIASES = {
  '/tele': 'Dashboard',
  '/tele/': 'Dashboard',
  '/tele/my-leads': 'My Leads',
  '/tele/profile-details': 'Profile Details',
};

function resolveTeleNavFromPath(pathname = '') {
  const clean = String(pathname || '').replace(/\/+$/, '') || '/tele';
  const exact = TELE_NAV_ITEMS.find((item) => item.path === clean);
  if (exact) return exact.label;
  if (TELE_PATH_ALIASES[clean]) return TELE_PATH_ALIASES[clean];
  if (TELE_PATH_ALIASES[`${clean}/`]) return TELE_PATH_ALIASES[`${clean}/`];
  return 'Dashboard';
}

function pathForTeleNav(label) {
  return TELE_NAV_ITEMS.find((item) => item.label === label)?.path || '/tele/dashboard';
}

const TELE_PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];

export function TeleExecutivePortal({ onLogout, onNotify, isDark, onToggleTheme }) {
  const [activeNav, setActiveNav] = useState(() => (
    typeof window !== 'undefined' ? resolveTeleNavFromPath(window.location.pathname) : 'Dashboard'
  ));
  const [followUpsTab, setFollowUpsTab] = useState('today');
  const [me, setMe] = useState(null);
  const [leads, setLeads] = useState(null);
  const [followUps, setFollowUps] = useState(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const navigateTele = useCallback((label, { replace = false } = {}) => {
    const nextLabel = TELE_NAV_ITEMS.some((item) => item.label === label) ? label : 'Dashboard';
    const nextPath = pathForTeleNav(nextLabel);
    setActiveNav(nextLabel);
    if (typeof window === 'undefined') return;
    const historyState = { currentPage: 'tele', teleNav: nextLabel };
    if (replace || window.location.pathname === nextPath) {
      window.history.replaceState(historyState, '', nextPath);
      return;
    }
    window.history.pushState(historyState, '', nextPath);
  }, []);

  // Modals
  const [historyLead, setHistoryLead] = useState(null);
  const [editLead, setEditLead] = useState(null);
  const [deleteLead, setDeleteLead] = useState(null);
  const [followUpModal, setFollowUpModal] = useState(null); // { lead: <lead or null> }
  const [addLeadOpen, setAddLeadOpen] = useState(false);

  const loadLeads = () => {
    leadApi.list({ page_size: 500, ordering: '-created_at' }).then((data) => {
      setLeads(Array.isArray(data) ? data : (data?.results ?? []));
    }).catch(() => { setLeads([]); onNotify('Leads could not be loaded.', 'error'); });
  };

  const loadFollowUps = () => {
    followUpApi.listAll({ page_size: 500 }).then((data) => {
      setFollowUps(Array.isArray(data) ? data : (data?.results ?? []));
    }).catch(() => { setFollowUps([]); onNotify('Follow-ups could not be loaded.', 'error'); });
  };

  useEffect(() => {
    authApi.me().then((data) => { if (data) setMe(data); }).catch(() => onNotify('Could not load profile.', 'error'));
    loadLeads();
    loadFollowUps();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const label = resolveTeleNavFromPath(window.location.pathname);
    const path = pathForTeleNav(label);
    if (window.location.pathname !== path) {
      window.history.replaceState({ currentPage: 'tele', teleNav: label }, '', path);
    }
    setActiveNav(label);

    const onPopState = () => {
      setActiveNav(resolveTeleNavFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) return undefined;
    const onPointerDown = (event) => {
      if (!(event.target instanceof Element && event.target.closest('[data-tele-profile-menu="true"]'))) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [profileMenuOpen]);

  const handleProfileAction = (action) => {
    setProfileMenuOpen(false);
    if (action === 'Logout') {
      onLogout?.();
      return;
    }
    if (action === 'Profile Details') {
      navigateTele('Profile Details');
    }
  };

  const refreshData = () => { loadLeads(); loadFollowUps(); };

  // `leadRows` / full `followUps` are every tele-sourced record (needed for the
  // "Add By" filter on My Leads + Follow-ups). Dashboard, Reminders and Reports
  // stay personal — leads this account added.
  const leadRows = leads ?? [];
  const sameId = (a, b) => a != null && b != null && String(a) === String(b);
  const isSuperAdminUser = Boolean(me?.is_super_admin);
  const teleNavItems = useMemo(() => {
    if (!me || hasModuleAccess(me, 'Daily Tasks', 'View')) return TELE_NAV_ITEMS;
    return TELE_NAV_ITEMS.filter((item) => item.label !== 'Daily Tasks');
  }, [me]);
  const isOwnLeadRow = (lead) => sameId(lead?.created_by, me?.id);
  const ownLeadRows = leadRows.filter(isOwnLeadRow);
  const ownLeadIds = useMemo(
    () => new Set(ownLeadRows.map((lead) => String(lead.id))),
    [ownLeadRows],
  );
  const scopedFollowUps = useMemo(() => {
    const rows = followUps ?? [];
    if (isSuperAdminUser) return rows;
    return rows.filter((item) => (
      ownLeadIds.has(String(item.lead)) || sameId(item.created_by, me?.id)
    ));
  }, [followUps, ownLeadIds, isSuperAdminUser, me?.id]);
  const reportLeadRows = isSuperAdminUser ? leadRows : ownLeadRows;
  const reportFollowUps = scopedFollowUps;
  const wonCount = ownLeadRows.filter((lead) => lead.status === 'Won' || teleDisplayStatus(lead) === 'Won').length;
  const lostCount = ownLeadRows.filter((lead) => lead.status === 'Lost' || teleDisplayStatus(lead) === 'Lost').length;

  const scheduledFollowUps = useMemo(
    () => scopedFollowUps.filter((item) => item.status === 'Scheduled').sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)),
    [scopedFollowUps],
  );

  const { today: todayFollowUps, overdue: overdueFollowUps } = useMemo(
    () => splitFollowUpAlerts(scheduledFollowUps),
    [scheduledFollowUps],
  );

  const openFollowUpForm = (lead = null) => setFollowUpModal({ lead });

  const openFollowUpsTab = (tab) => {
    setFollowUpsTab(tab);
    navigateTele('Follow-ups');
  };

  const handleAlertCall = (item) => {
    if (!dialTeleMobile(item?.lead_mobile_number)) {
      onNotify?.('No mobile number on this lead.', 'error');
    }
  };

  const handleAlertLogFollowUp = (item) => {
    openFollowUpForm({
      id: item.lead,
      customer_name: item.lead_customer_name,
      mobile_number: item.lead_mobile_number,
    });
  };

  const handleAlertView = (item) => {
    const lead = leadRows.find((row) => row.id === item.lead)
      || { id: item.lead, customer_name: item.lead_customer_name, mobile_number: item.lead_mobile_number };
    setHistoryLead(lead);
  };

  const handleDeleteLead = async () => {
    if (!deleteLead) return;
    try {
      await leadApi.delete(deleteLead.id);
      onNotify(`${deleteLead.customer_name} deleted`, 'success');
      setDeleteLead(null);
      refreshData();
    } catch (err) {
      onNotify(err.message || 'Could not delete lead.', 'error');
    }
  };

  const pageContent = () => {
    switch (activeNav) {
      case 'Dashboard':
        return (
          <TeleDashboard
            leads={ownLeadRows}
            allLeads={leadRows}
            leadsLoaded={leads !== null}
            todayFollowUps={todayFollowUps}
            overdueFollowUps={overdueFollowUps}
            scheduledFollowUps={scheduledFollowUps}
            followUpsLoaded={followUps !== null}
            wonCount={wonCount}
            lostCount={lostCount}
            currentUserId={me?.id}
            isSuperAdmin={Boolean(me?.is_super_admin)}
            onView={setHistoryLead}
            onEdit={setEditLead}
            onDelete={setDeleteLead}
            onAddFollowUp={openFollowUpForm}
            onAddLead={() => setAddLeadOpen(true)}
            onOpenToday={() => openFollowUpsTab('today')}
            onOpenOverdue={() => openFollowUpsTab('overdue')}
            onAlertCall={handleAlertCall}
            onAlertLogFollowUp={handleAlertLogFollowUp}
            onAlertView={handleAlertView}
          />
        );
      case 'My Leads':
        return (
          <TeleLeadsPage
            leads={leadRows}
            leadsLoaded={leads !== null}
            currentUserId={me?.id}
            isSuperAdmin={Boolean(me?.is_super_admin)}
            onView={setHistoryLead}
            onEdit={setEditLead}
            onDelete={setDeleteLead}
            onAddFollowUp={openFollowUpForm}
            onAddLead={() => setAddLeadOpen(true)}
          />
        );
      case 'Follow-ups':
        return (
          <TeleFollowUpsPage
            followUps={followUps ?? []}
            loaded={followUps !== null}
            leads={leadRows}
            currentUserId={me?.id}
            isSuperAdmin={isSuperAdminUser}
            initialTab={followUpsTab}
            onAddFollowUp={openFollowUpForm}
            onViewLead={(leadId) => {
              const lead = leadRows.find((row) => row.id === leadId);
              if (lead) setHistoryLead(lead);
            }}
            onAlertCall={handleAlertCall}
            onAlertLogFollowUp={handleAlertLogFollowUp}
            onAlertView={handleAlertView}
          />
        );
      case 'Reminders':
        return (
          <TeleRemindersPage
            scheduledFollowUps={scheduledFollowUps}
            loaded={followUps !== null}
            onAlertCall={handleAlertCall}
            onAlertLogFollowUp={handleAlertLogFollowUp}
            onAlertView={handleAlertView}
            onAddFollowUp={openFollowUpForm}
            onOpenFollowUps={() => openFollowUpsTab('today')}
          />
        );
      case 'Daily Tasks':
        return <TeleDailyTasksPage me={me} onNotify={onNotify} />;
      case 'Reports':
        return (
          <TeleReportsPage
            leads={reportLeadRows}
            followUps={reportFollowUps}
            loaded={leads !== null && followUps !== null}
          />
        );
      case 'Profile Details':
        return <TeleProfileDetailsPage me={me} />;
      default:
        return null;
    }
  };

  return (
    <div className="tele-portal app-mobile-shell flex h-dvh overflow-hidden bg-[#eef3f7] text-[#172648]">
      {/* Same floating-card sidebar treatment as the CRM shell: white brand
          header on top, gradient menu area with the moving shine below —
          tele portal carries it in blue/white instead of green/blue. */}
      <aside className="tele-sidebar-root my-1.5 ml-1.5 hidden w-[220px] shrink-0 flex-col overflow-hidden rounded-[18px] border border-[#dfe7f2] bg-white shadow-[0_18px_40px_rgba(15,39,92,0.12)] lg:flex">
        <div className="tele-sidebar-brand flex shrink-0 items-start justify-center border-b border-[#e8eef6] bg-white px-3 pt-3 pb-2.5">
          <TeleBrandLockup />
        </div>
        <div className="tele-sidebar-grad relative min-h-0 flex-1 overflow-hidden rounded-t-[14px] bg-[linear-gradient(180deg,#123c8f_0%,#1d4ed8_52%,#3b82f6_100%)]">
          <div className="scroll-soft sidebar-menu-scroll relative flex h-full flex-col overflow-y-auto px-3.5 py-4">
            <nav className="space-y-1.5">
              {teleNavItems.map((item) => {
                const Icon = item.icon;
                const active = activeNav === item.label;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => navigateTele(item.label)}
                    aria-current={active ? 'page' : undefined}
                    className={cx(
                      'flex h-11 w-full items-center gap-3 rounded-[10px] px-3.5 text-[13.5px] font-extrabold transition',
                      active ? 'bg-white text-[#1d4ed8] shadow-[0_10px_22px_rgba(9,28,66,0.30)]' : 'text-white/85 hover:bg-white/15',
                    )}
                  >
                    <Icon className="size-[18px]" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
            <div className="mt-auto shrink-0 pt-4">
              <button
                type="button"
                onClick={onLogout}
                className="tele-logout flex h-11 w-full items-center gap-3 rounded-[10px] border border-white/25 bg-white/10 px-3.5 text-[13.5px] font-extrabold text-white transition hover:bg-white/20"
              >
                <LogOut className="size-[18px]" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="app-mobile-topbar flex shrink-0 items-center justify-between gap-2 border-b border-[#e2e9f3] bg-white px-2.5 py-2 sm:px-3 sm:py-2.5 lg:pl-2">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#7585a2] lg:hidden">Malwa Solar</p>
            <h1 className="truncate font-display text-[17px] font-extrabold text-[#102446] sm:text-[20px]">
              {activeNav === 'Dashboard' ? 'Tele Dashboard' : activeNav}
            </h1>
            <p className="hidden text-[12px] font-semibold text-[#7585a2] sm:block">Manage your leads, follow-ups and reminders.</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <span className="hidden items-center gap-2 rounded-[9px] border border-[#dbe4f0] bg-white px-3 py-2 text-[12px] font-extrabold text-[#53647f] md:inline-flex">
              <CalendarDays className="size-4 text-[#1d4ed8]" />
              {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'long' })}
            </span>
            <PwaInstallIconButton notify={onNotify} />
            {onToggleTheme ? (
              <button
                type="button"
                onClick={onToggleTheme}
                className="grid size-10 place-items-center rounded-[10px] border border-[#dbe4f0] bg-white text-[#53647f] transition hover:bg-[#f3f7fd] dark:border-slate-600 dark:bg-slate-800"
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
            ) : null}
            <div className="relative" data-tele-profile-menu="true">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((open) => !open)}
                className="flex items-center gap-2.5 rounded-[12px] px-1.5 py-1 text-left transition hover:bg-[#f5f9ff] sm:px-2 sm:py-1.5"
                aria-label="Open profile menu"
                aria-expanded={profileMenuOpen}
              >
                <span className="grid size-10 place-items-center rounded-full border border-[#d4af37]/55 bg-[#123c8f] text-[13px] font-extrabold text-white">
                  {(me?.initials || me?.name?.slice(0, 2) || 'TE').toUpperCase()}
                </span>
                <div className="hidden sm:block">
                  <p className="text-[13px] font-extrabold leading-tight text-[#1e3261]">{me?.name || 'Tele Executive'}</p>
                  <p className="text-[11px] font-semibold text-[#7585a2]">{me?.role_name || TELE_ROLE_NAME}</p>
                </div>
                <ChevronDown
                  className={cx(
                    'hidden size-4 text-[#7a8aa4] transition sm:block',
                    profileMenuOpen && 'rotate-180 text-[#1d4ed8]',
                  )}
                />
              </button>

              {profileMenuOpen ? (
                <div className="absolute right-0 top-[calc(100%+10px)] z-70 w-[176px] overflow-hidden rounded-[12px] border border-[#dce7f5] bg-white shadow-[0_18px_34px_rgba(21,43,83,0.16)]">
                  {['Profile Details', 'Logout'].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleProfileAction(item)}
                      className={cx(
                        'block w-full px-4 py-3 text-left text-[13px] font-extrabold transition hover:bg-[#f5f9ff]',
                        item === 'Logout' ? 'text-[#e03434]' : 'text-[#263d72]',
                      )}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="px-3 pt-2 lg:hidden">
          <PwaInstallBanner notify={onNotify} />
        </div>

        <main className="scroll-soft flex-1 space-y-2 overflow-y-auto px-2 py-2 pb-2 sm:px-3 sm:py-2.5 lg:pl-1.5 lg:pb-3">
          {pageContent()}
        </main>

        <ProductFooter className="mb-[calc(5.25rem+env(safe-area-inset-bottom))] lg:mb-1.5 lg:mr-1.5 lg:rounded-b-[16px]" />

        <nav className="app-mobile-bottom-nav fixed inset-x-0 bottom-0 z-60 border-t border-[#e2e9f3] bg-white/98 shadow-[0_-10px_28px_rgba(21,43,83,0.12)] backdrop-blur-[10px] lg:hidden dark:border-slate-700 dark:bg-slate-950/96">
          <div className={cx('mx-auto grid max-w-lg gap-0.5 px-1 pt-1', teleNavItems.length >= 7 ? 'grid-cols-7' : 'grid-cols-6')}>
            {teleNavItems.map((item) => {
              const Icon = item.icon;
              const active = activeNav === item.label;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => navigateTele(item.label)}
                  className={cx(
                    'flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 pb-[max(10px,env(safe-area-inset-bottom))] transition active:scale-95',
                    active ? 'text-[#1d4ed8]' : 'text-[#7b88a2]',
                  )}
                >
                  <span className={cx(
                    'grid size-8 place-items-center rounded-full',
                    active ? 'bg-[#e7efff] text-[#1d4ed8]' : 'bg-transparent',
                  )}
                  >
                    <Icon className="size-[18px]" strokeWidth={active ? 2.4 : 2} />
                  </span>
                  <span className="max-w-full truncate px-0.5 text-[9px] font-extrabold leading-none">
                    {item.label === 'Profile Details' ? 'Profile' : item.label === 'Daily Tasks' ? 'Tasks' : item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {historyLead && (
        <TeleFollowUpHistoryModal
          lead={historyLead}
          onClose={() => setHistoryLead(null)}
          onNotify={onNotify}
          onAddFollowUp={(lead) => {
            setHistoryLead(null);
            openFollowUpForm(lead);
          }}
        />
      )}
      {editLead && (
        <TeleLeadEditModal
          lead={editLead}
          onClose={() => setEditLead(null)}
          onSaved={() => { setEditLead(null); refreshData(); }}
          onNotify={onNotify}
        />
      )}
      {deleteLead && (
        <TeleModal title="Delete Lead" onClose={() => setDeleteLead(null)}>
          <p className="text-[14px] font-semibold leading-6 text-[#33456b]">
            Are you sure you want to delete <span className="font-extrabold text-[#102446]">{deleteLead.customer_name}</span>?
            This will also remove its follow-up history. This action cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2.5">
            <button type="button" onClick={() => setDeleteLead(null)} className="h-10 rounded-[9px] border border-[#dbe4f0] px-4 text-[13px] font-extrabold text-[#53647f] transition hover:bg-[#f8fbff]">
              Cancel
            </button>
            <button type="button" onClick={handleDeleteLead} className="h-10 rounded-[9px] bg-[#dc2626] px-4 text-[13px] font-extrabold text-white transition hover:bg-[#b91c1c]">
              Delete Lead
            </button>
          </div>
        </TeleModal>
      )}
      {followUpModal && (
        <TeleFollowUpCreateModal
          leads={isSuperAdminUser ? leadRows : ownLeadRows}
          initialLead={followUpModal.lead}
          onClose={() => setFollowUpModal(null)}
          onSaved={() => { setFollowUpModal(null); refreshData(); }}
          onNotify={onNotify}
        />
      )}
      {addLeadOpen && (
        <TeleLeadCreateModal
          onClose={() => setAddLeadOpen(false)}
          onSaved={() => { setAddLeadOpen(false); refreshData(); }}
          onNotify={onNotify}
        />
      )}
    </div>
  );
}

// ─── Stat cards ───────────────────────────────────────────────────────────────

function TeleStatCards({ cards }) {
  return (
    <section className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article key={card.title} className="rounded-[14px] border border-[#e2e9f3] bg-white p-4 shadow-[0_10px_26px_rgba(23,43,77,0.05)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-extrabold text-[#7585a2]">{card.title}</p>
                <p className="mt-2 font-display text-[26px] font-extrabold text-[#102446]">{card.value ?? '—'}</p>
                <p className="mt-1 text-[11px] font-semibold text-[#8a98af]">{card.note}</p>
              </div>
              <span className={cx('grid size-11 shrink-0 place-items-center rounded-full', card.tone)}>
                <Icon className="size-5" />
              </span>
            </div>
          </article>
        );
      })}
    </section>
  );
}

// ─── Leads table (shared: Dashboard + My Leads) ───────────────────────────────

function TeleLeadsTable({ leads, leadsLoaded, currentUserId, isSuperAdmin, onView, onEdit, onDelete, onAddFollowUp, onAddLead, title = 'My Leads' }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  // Default: logged-in tele executive's own added leads ("Add By" = me).
  const [addByFilter, setAddByFilter] = useState(() => (
    currentUserId != null && !isSuperAdmin ? String(currentUserId) : 'All'
  ));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    try {
      const saved = Number(window.localStorage.getItem('tele-lead-page-size'));
      return TELE_PAGE_SIZE_OPTIONS.includes(saved) ? saved : 10;
    } catch {
      return 10;
    }
  });

  useEffect(() => {
    if (isSuperAdmin) return;
    if (currentUserId == null) return;
    setAddByFilter((prev) => (prev === 'All' || prev == null ? String(currentUserId) : prev));
  }, [currentUserId, isSuperAdmin]);

  const addByOptions = useMemo(() => {
    const map = new Map();
    leads.forEach((lead) => {
      if (lead.created_by != null && !map.has(String(lead.created_by))) {
        map.set(String(lead.created_by), lead.created_by_name || 'Deleted User');
      }
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return leads.filter((lead) => {
      if (statusFilter !== 'All' && teleDisplayStatus(lead) !== statusFilter) return false;
      if (addByFilter !== 'All' && String(lead.created_by) !== String(addByFilter)) return false;
      if (!query) return true;
      return [lead.customer_name, lead.mobile_number, lead.project_name]
        .some((field) => String(field || '').toLowerCase().includes(query));
    });
  }, [leads, searchQuery, statusFilter, addByFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageLeads = filteredLeads.slice((safePage - 1) * pageSize, safePage * pageSize);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (safePage <= 4) return [1, 2, 3, 4, 5, '…', totalPages];
    if (safePage >= totalPages - 3) return [1, '…', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, '…', safePage - 1, safePage, safePage + 1, '…', totalPages];
  }, [safePage, totalPages]);

  return (
    <section className="rounded-[14px] border border-[#e2e9f3] bg-white p-2.5 shadow-[0_10px_26px_rgba(23,43,77,0.06)] sm:p-3">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-[16px] font-extrabold text-[#102446]">{title}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onAddFollowUp(null)}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[9px] border border-[#1d4ed8] bg-white px-3 text-[12.5px] font-extrabold text-[#1d4ed8] transition hover:bg-[#e7efff]"
            >
              <Phone className="size-3.5 shrink-0" />
              Add Follow-up
            </button>
            <button
              type="button"
              onClick={onAddLead}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[9px] bg-[#1d4ed8] px-3 text-[12.5px] font-extrabold text-white transition hover:bg-[#1a3fb0]"
            >
              <Plus className="size-3.5 shrink-0" />
              Add New Lead
            </button>
          </div>
        </div>
        <div className="tele-leads-filters flex flex-row flex-wrap items-center gap-2">
          <label className="flex h-9 min-w-[180px] flex-1 items-center gap-2 rounded-[9px] border border-[#dbe4f0] bg-white px-3">
            <Search className="size-4 shrink-0 text-[#8a98af]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="Search by name, mobile, project..."
              className="w-full min-w-0 bg-transparent text-[13px] font-semibold text-[#1f2d44] outline-none placeholder:text-[#8a98af]"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="h-9 w-[140px] shrink-0 rounded-[9px] border border-[#dbe4f0] bg-white px-3 text-[13px] font-bold text-[#1f2d44] outline-none"
          >
            {['All', ...TELE_LEAD_STATUSES].map((option) => (
              <option key={option} value={option}>{option === 'All' ? 'All Status' : option}</option>
            ))}
          </select>
          <select
            value={addByFilter}
            onChange={(e) => { setAddByFilter(e.target.value); setPage(1); }}
            className="h-9 min-w-[150px] shrink-0 rounded-[9px] border border-[#dbe4f0] bg-white px-3 text-[13px] font-bold text-[#1f2d44] outline-none"
            aria-label="Filter by Add By"
          >
            <option value="All">Add By: All</option>
            {addByOptions.map((person) => (
              <option key={person.id} value={String(person.id)}>
                Add By: {person.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="crm-table-scroll mt-2 overflow-x-auto">
        <table className="crm-table tele-leads-table crm-table--lead-dense w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[#e8eef6] text-[11px] font-extrabold uppercase tracking-[0.04em] text-[#7585a2]">
              <th className="px-2.5 py-2">#</th>
              <th className="px-2.5 py-2">Customer Name</th>
              <th className="px-2.5 py-2">Mobile No.</th>
              <th className="px-2.5 py-2">Project Name</th>
              <th className="px-2.5 py-2">Added By</th>
              <th className="px-2.5 py-2">Status</th>
              <th className="px-2.5 py-2">Next Follow-up</th>
              <th className="px-2.5 py-2">Remarks</th>
              <th className="crm-col-sticky-right px-2.5 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {!leadsLoaded && (
              <tr><td colSpan={9} className="px-2.5 py-6 text-center text-[13px] font-bold text-[#7585a2]">Loading leads...</td></tr>
            )}
            {leadsLoaded && pageLeads.length === 0 && (
              <tr><td colSpan={9} className="px-2.5 py-6 text-center text-[13px] font-bold text-[#7585a2]">No leads found.</td></tr>
            )}
            {pageLeads.map((lead, index) => {
              // Tele may edit/delete only leads they personally added.
              const isOwnLead = isSuperAdmin || (
                currentUserId != null && String(lead.created_by) === String(currentUserId)
              );
              return (
              <tr
                key={lead.id}
                onDoubleClick={() => onView(lead)}
                title="Double-click to view follow-up history"
                className="cursor-pointer border-b border-[#f1f5fa] text-[12.5px] font-bold text-[#33456b] transition hover:bg-[#f8fbff]"
              >
                <td className="px-2.5 py-2 text-[#7585a2]">{(safePage - 1) * pageSize + index + 1}</td>
                <td className="px-2.5 py-2 font-extrabold text-[#1e3261]">{lead.customer_name}</td>
                <td className="px-2.5 py-2">{lead.mobile_number || '—'}</td>
                <td className="px-2.5 py-2">{lead.project_name || '—'}</td>
                <td className="px-2.5 py-2">{lead.created_by_name || (lead.created_by ? 'Deleted User' : '—')}</td>
                <td className="px-2.5 py-2"><StatusPill value={teleDisplayStatus(lead)} /></td>
                <td className="whitespace-nowrap px-2.5 py-2">{formatDateTime(lead.next_follow_up)}</td>
                <td className="max-w-[180px] truncate px-2.5 py-2" title={lead.remarks || ''}>{lead.remarks || '—'}</td>
                <td className="crm-col-sticky-right px-2.5 py-2 text-right">
                  {isOwnLead ? (
                    <div className="inline-flex items-center justify-end gap-1">
                      <button type="button" onClick={() => onEdit(lead)} className="grid size-7 place-items-center rounded-[7px] text-[#53647f] transition hover:bg-[#f3f7fd]" aria-label={`Edit ${lead.customer_name}`}>
                        <Pencil className="size-3.5" />
                      </button>
                      <button type="button" onClick={() => onDelete(lead)} className="grid size-7 place-items-center rounded-[7px] text-[#dc2626] transition hover:bg-[#feecec]" aria-label={`Delete ${lead.customer_name}`}>
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#a5b1c7]">View only</span>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2.5 flex flex-col items-center justify-between gap-2 sm:flex-row">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[12px] font-bold text-[#7585a2]">
            Showing {filteredLeads.length === 0 ? 0 : (safePage - 1) * pageSize + 1} to {Math.min(safePage * pageSize, filteredLeads.length)} of {filteredLeads.length} entries
          </p>
          <label className="inline-flex items-center gap-1.5 text-[12px] font-extrabold text-[#284276]">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(event) => {
                const next = Number(event.target.value);
                setPageSize(next);
                setPage(1);
                try {
                  window.localStorage.setItem('tele-lead-page-size', String(next));
                } catch {
                  /* ignore */
                }
              }}
              aria-label="Leads per page"
              className="h-8 rounded-[7px] border border-[#d9e4f2] bg-white px-2 text-[12px] font-extrabold text-[#1e3261] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {TELE_PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            <span>/ page</span>
          </label>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={safePage <= 1}
            className="grid size-8 place-items-center rounded-[8px] border border-[#dbe4f0] bg-white text-[#53647f] transition hover:bg-[#f8fbff] disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </button>
          {pageNumbers.map((pageNumber, index) => (
            pageNumber === '…' ? (
              <span key={`gap-${index}`} className="px-1 text-[13px] font-extrabold text-[#7585a2]">…</span>
            ) : (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                className={cx(
                  'grid size-8 place-items-center rounded-[8px] border text-[12.5px] font-extrabold transition',
                  pageNumber === safePage
                    ? 'border-[#1d4ed8] bg-[#1d4ed8] text-white'
                    : 'border-[#dbe4f0] bg-white text-[#53647f] hover:bg-[#f8fbff]',
                )}
              >
                {pageNumber}
              </button>
            )
          ))}
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={safePage >= totalPages}
            className="grid size-8 place-items-center rounded-[8px] border border-[#dbe4f0] bg-white text-[#53647f] transition hover:bg-[#f8fbff] disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function TeleDashboard({
  leads,
  allLeads,
  leadsLoaded,
  todayFollowUps,
  overdueFollowUps,
  scheduledFollowUps,
  followUpsLoaded,
  wonCount,
  lostCount,
  currentUserId,
  isSuperAdmin,
  onView,
  onEdit,
  onDelete,
  onAddFollowUp,
  onAddLead,
  onOpenToday,
  onOpenOverdue,
  onAlertCall,
  onAlertLogFollowUp,
  onAlertView,
}) {
  const cards = [
    { title: 'Total Leads', value: leadsLoaded ? leads.length : undefined, note: 'All assigned leads', icon: Users, tone: 'bg-[#e7efff] text-[#1d4ed8]' },
    { title: 'High Alert · Today', value: followUpsLoaded ? todayFollowUps.length : undefined, note: 'Follow-ups due today', icon: Zap, tone: 'bg-[#fff7ed] text-[#f59e0b]' },
    { title: 'Extra High · Pending', value: followUpsLoaded ? overdueFollowUps.length : undefined, note: 'Missed earlier — still pending', icon: AlertTriangle, tone: 'bg-[#fef2f2] text-[#dc2626]' },
    { title: 'Won Leads', value: leadsLoaded ? wonCount : undefined, note: 'Converted leads', icon: Trophy, tone: 'bg-[#f0e9ff] text-[#7c3aed]' },
    { title: 'Lost Leads', value: leadsLoaded ? lostCount : undefined, note: 'Closed as lost', icon: XCircle, tone: 'bg-[#feecec] text-[#dc2626]' },
  ];

  const upcomingReminders = scheduledFollowUps.filter((item) => item.reminder && item.reminder !== 'No reminder').slice(0, 5);

  return (
    <>
      <TeleStatCards cards={cards} />

      <TeleFollowUpAlertsPanel
        todayFollowUps={todayFollowUps}
        overdueFollowUps={overdueFollowUps}
        loaded={followUpsLoaded}
        compact={false}
        onOpenToday={onOpenToday}
        onOpenOverdue={onOpenOverdue}
        onCall={onAlertCall}
        onLog={onAlertLogFollowUp}
        onView={onAlertView}
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <TeleLeadsTable
          leads={allLeads}
          leadsLoaded={leadsLoaded}
          currentUserId={currentUserId}
          isSuperAdmin={isSuperAdmin}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddFollowUp={onAddFollowUp}
          onAddLead={onAddLead}
        />
        <section className="rounded-[16px] border border-[#e2e9f3] bg-white p-4 shadow-[0_10px_26px_rgba(23,43,77,0.06)]">
          <h2 className="font-display text-[15px] font-extrabold text-[#102446]">Reminders</h2>
          <div className="mt-3 space-y-2.5">
            {upcomingReminders.length === 0 && (
              <p className="rounded-[10px] bg-[#f8fbff] px-3 py-4 text-center text-[12px] font-bold text-[#7585a2]">No reminders set.</p>
            )}
            {upcomingReminders.map((item) => (
              <div key={item.id} className="flex items-start gap-3 rounded-[10px] border border-[#eef2f8] px-3 py-2.5">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-[#fff4e0] text-[#c07a06]">
                  <Bell className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-extrabold text-[#1e3261]">{item.lead_customer_name}</p>
                  <p className="text-[11px] font-semibold text-[#7585a2]">{formatDateTime(item.scheduled_at)} · {item.reminder}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function TeleLeadsPage({ leads, leadsLoaded, currentUserId, isSuperAdmin, onView, onEdit, onDelete, onAddFollowUp, onAddLead }) {
  return (
    <TeleLeadsTable
      leads={leads}
      leadsLoaded={leadsLoaded}
      currentUserId={currentUserId}
      isSuperAdmin={isSuperAdmin}
      onView={onView}
      onEdit={onEdit}
      onDelete={onDelete}
      onAddFollowUp={onAddFollowUp}
      onAddLead={onAddLead}
    />
  );
}

// ─── Follow-ups page ──────────────────────────────────────────────────────────

function TeleFollowUpsPage({
  followUps,
  loaded,
  leads = [],
  currentUserId,
  isSuperAdmin = false,
  initialTab = 'today',
  onAddFollowUp,
  onViewLead,
  onAlertCall,
  onAlertLogFollowUp,
  onAlertView,
}) {
  const [tab, setTab] = useState(initialTab || 'today');
  const [search, setSearch] = useState('');
  // Default: follow-ups on leads this tele user added ("Add By" = me).
  const [addByFilter, setAddByFilter] = useState(() => (
    currentUserId != null && !isSuperAdmin ? String(currentUserId) : 'All'
  ));

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (isSuperAdmin) return;
    if (currentUserId == null) return;
    setAddByFilter((prev) => (prev === 'All' || prev == null ? String(currentUserId) : prev));
  }, [currentUserId, isSuperAdmin]);

  const leadById = useMemo(() => {
    const map = new Map();
    for (const lead of leads) map.set(String(lead.id), lead);
    return map;
  }, [leads]);

  const addByOptions = useMemo(() => {
    const map = new Map();
    leads.forEach((lead) => {
      if (lead.created_by != null && !map.has(String(lead.created_by))) {
        map.set(String(lead.created_by), lead.created_by_name || 'Deleted User');
      }
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [leads]);

  const matchesAddBy = useCallback((item) => {
    if (addByFilter === 'All') return true;
    const lead = leadById.get(String(item.lead));
    if (lead) {
      return String(lead.created_by) === String(addByFilter);
    }
    return String(item.created_by) === String(addByFilter);
  }, [addByFilter, leadById]);

  const canOperateFollowUp = useCallback((item) => {
    if (isSuperAdmin) return true;
    if (currentUserId == null) return false;
    const lead = leadById.get(String(item.lead));
    if (lead) {
      return String(lead.created_by) === String(currentUserId);
    }
    return String(item.created_by) === String(currentUserId);
  }, [isSuperAdmin, currentUserId, leadById]);

  const holderFollowUps = useMemo(
    () => followUps.filter(matchesAddBy),
    [followUps, matchesAddBy],
  );

  const completed = useMemo(
    () => holderFollowUps.filter((item) => item.status === 'Completed'),
    [holderFollowUps],
  );
  const scheduled = useMemo(
    () => holderFollowUps.filter((item) => item.status === 'Scheduled'),
    [holderFollowUps],
  );
  const { today, overdue } = useMemo(() => splitFollowUpAlerts(scheduled), [scheduled]);

  const cards = [
    { id: 'today', title: 'High Alert · Today', value: loaded ? today.length : undefined, note: 'Follow-ups due today', icon: Zap, tone: 'bg-[#fff7ed] text-[#f59e0b]', activeRing: 'border-[#f59e0b] ring-4 ring-[#fde68a]' },
    { id: 'overdue', title: 'Extra High · Pending', value: loaded ? overdue.length : undefined, note: 'Missed earlier — still pending', icon: AlertTriangle, tone: 'bg-[#fef2f2] text-[#dc2626]', activeRing: 'border-[#dc2626] ring-4 ring-[#fecaca]' },
    { id: 'completed', title: 'Completed', value: loaded ? completed.length : undefined, note: 'Saved history', icon: CheckCircle2, tone: 'bg-[#e8f8eb] text-[#0d9f4a]', activeRing: 'border-[#0d9f4a] ring-4 ring-[#bbf7d0]' },
    { id: 'all', title: 'All Follow-ups', value: loaded ? holderFollowUps.length : undefined, note: 'Full record', icon: Phone, tone: 'bg-[#e7efff] text-[#1d4ed8]', activeRing: 'border-[#1d4ed8] ring-4 ring-[#dbeafe]' },
  ];

  const filtered = useMemo(() => {
    let rows = holderFollowUps;
    if (tab === 'today') rows = today;
    else if (tab === 'overdue') rows = overdue;
    else if (tab === 'completed') rows = completed;
    const query = search.trim().toLowerCase();
    if (query) {
      rows = rows.filter((item) => [
        item.lead_customer_name,
        item.lead_mobile_number,
        item.notes,
        item.outcome,
        item.follow_up_type,
      ].some((value) => String(value || '').toLowerCase().includes(query)));
    }
    const sorted = [...rows].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
    if (tab === 'completed' || tab === 'all') sorted.reverse();
    return sorted;
  }, [holderFollowUps, tab, search, today, overdue, completed]);

  return (
    <>
      {(today.length > 0 || overdue.length > 0) && loaded ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => setTab('today')}
            className={cx(
              'flex flex-1 items-center gap-3 rounded-[12px] border-2 px-4 py-3 text-left transition',
              tab === 'today' ? 'border-[#f59e0b] bg-[#fffbeb]' : 'border-[#fde68a]/80 bg-white hover:bg-[#fffbeb]',
            )}
          >
            <span className="grid size-9 place-items-center rounded-full bg-[#f59e0b] text-white"><Zap className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-extrabold text-[#92400e]">High Alert · Today</p>
              <p className="text-[11px] font-semibold text-[#b45309]">{today.length} follow-up{today.length === 1 ? '' : 's'} due today</p>
            </div>
            <span className="text-[20px] font-extrabold text-[#f59e0b]">{today.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('overdue')}
            className={cx(
              'flex flex-1 items-center gap-3 rounded-[12px] border-2 px-4 py-3 text-left transition',
              tab === 'overdue' ? 'border-[#dc2626] bg-[#fef2f2]' : 'border-[#fecaca]/80 bg-white hover:bg-[#fef2f2]',
            )}
          >
            <span className="grid size-9 place-items-center rounded-full bg-[#dc2626] text-white"><AlertTriangle className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-extrabold text-[#991b1b]">Extra High · Pending</p>
              <p className="text-[11px] font-semibold text-[#b91c1c]">{overdue.length} overdue pending</p>
            </div>
            <span className="text-[20px] font-extrabold text-[#dc2626]">{overdue.length}</span>
          </button>
        </div>
      ) : null}

      <section className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const active = tab === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setTab(card.id)}
              className={cx(
                'rounded-[14px] border bg-white p-4 text-left shadow-[0_10px_26px_rgba(23,43,77,0.05)] transition',
                active ? card.activeRing : 'border-[#e2e9f3] hover:border-[#c7d7f0]',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-extrabold text-[#7585a2]">{card.title}</p>
                  <p className="mt-2 font-display text-[26px] font-extrabold text-[#102446]">{card.value ?? '—'}</p>
                  <p className="mt-1 text-[11px] font-semibold text-[#8a98af]">{card.note}</p>
                </div>
                <span className={cx('grid size-11 shrink-0 place-items-center rounded-full', card.tone)}>
                  <Icon className="size-5" />
                </span>
              </div>
            </button>
          );
        })}
      </section>

      <section className="rounded-[16px] border border-[#e2e9f3] bg-white p-4 shadow-[0_10px_26px_rgba(23,43,77,0.06)] sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-[17px] font-extrabold text-[#102446]">
              {tab === 'today' ? "High Alert · Today's Follow-ups" : tab === 'overdue' ? 'Extra High Alert · Pending' : 'Follow-up Diary'}
            </h2>
            <p className="mt-1 text-[12px] font-semibold text-[#7585a2]">
              {tab === 'today'
                ? 'These customers need a call or follow-up today.'
                : tab === 'overdue'
                  ? 'These follow-ups were due earlier and are still pending. Clear them first.'
                  : 'Every call and WhatsApp note is saved here. Nothing overwrites old history.'}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex h-10 min-w-[220px] items-center gap-2 rounded-[9px] border border-[#dbe4f0] bg-white px-3">
              <Search className="size-4 text-[#7585a2]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer, note, outcome..."
                className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-[#1f2d44] outline-none"
              />
            </label>
            <select
              value={addByFilter}
              onChange={(e) => setAddByFilter(e.target.value)}
              className="h-10 rounded-[9px] border border-[#dbe4f0] bg-white px-3 text-[13px] font-bold text-[#1f2d44] outline-none"
              aria-label="Filter by Add By"
            >
              <option value="All">Add By: All</option>
              {addByOptions.map((person) => (
                <option key={person.id} value={String(person.id)}>
                  Add By: {person.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onAddFollowUp(null)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[9px] bg-[#1d4ed8] px-4 text-[13px] font-extrabold text-white transition hover:bg-[#1a3fb0]"
            >
              <Plus className="size-4" />
              Log Follow-up
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {!loaded && (
            <p className="rounded-[12px] bg-[#f8fbff] px-3 py-8 text-center text-[13px] font-bold text-[#7585a2]">Loading follow-ups...</p>
          )}
          {loaded && filtered.length === 0 && (
            <p className="rounded-[12px] bg-[#f8fbff] px-3 py-8 text-center text-[13px] font-bold text-[#7585a2]">
              No follow-ups in this view. Tap “Log Follow-up” after your next call.
            </p>
          )}
          {filtered.map((item) => {
            const Icon = FOLLOW_UP_TYPE_ICONS[item.follow_up_type] || PhoneCall;
            const isTodayAlert = tab === 'today';
            const isExtraAlert = tab === 'overdue';
            const canOperate = canOperateFollowUp(item);
            return (
              <article
                key={item.id}
                className={cx(
                  'rounded-[14px] border p-4 transition',
                  isExtraAlert
                    ? 'border-[#fecaca] bg-[#fff5f5] hover:border-[#f87171]'
                    : isTodayAlert
                      ? 'border-[#fde68a] bg-[#fffbeb] hover:border-[#fbbf24]'
                      : 'border-[#e8eef6] bg-[#fbfdff] hover:border-[#c7d7f0] hover:bg-white',
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <span className={cx(
                      'mt-0.5 grid size-11 shrink-0 place-items-center rounded-full',
                      item.status === 'Completed'
                        ? 'bg-[#e8f8eb] text-[#0d9f4a]'
                        : isExtraAlert
                          ? 'bg-[#fee2e2] text-[#dc2626]'
                          : isTodayAlert
                            ? 'bg-[#fef3c7] text-[#d97706]'
                            : item.status === 'Missed'
                              ? 'bg-[#feecec] text-[#dc2626]'
                              : 'bg-[#e7efff] text-[#1d4ed8]',
                    )}>
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-[15px] font-extrabold text-[#102446]">{item.lead_customer_name || 'Lead'}</p>
                        <span className="text-[12px] font-bold text-[#7585a2]">{item.lead_mobile_number || ''}</span>
                        {isTodayAlert ? (
                          <span className="inline-flex rounded-full bg-[#f59e0b] px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">High Alert</span>
                        ) : null}
                        {isExtraAlert ? (
                          <span className="inline-flex rounded-full bg-[#dc2626] px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">Extra High</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[12px] font-bold text-[#53647f]">
                        {formatDateTime(item.scheduled_at)}
                        <span className="mx-1.5 text-[#c3ccd9]">·</span>
                        {item.follow_up_type}
                        <span className="mx-1.5 text-[#c3ccd9]">·</span>
                        {followUpAgeLabel(item.scheduled_at)}
                      </p>
                      {item.outcome ? (
                        <p className="mt-2 inline-flex rounded-full bg-[#eef2ff] px-2.5 py-1 text-[11px] font-extrabold text-[#3730a3]">
                          Outcome: {item.outcome}
                        </p>
                      ) : null}
                      {item.notes ? (
                        <p className="mt-2 text-[13px] font-semibold leading-6 text-[#33456b]">
                          <span className="font-extrabold text-[#1e3261]">What happened: </span>
                          {item.notes}
                        </p>
                      ) : (
                        <p className="mt-2 text-[12px] font-semibold text-[#8a98af]">No conversation note saved.</p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                    {canOperate ? (
                      <button
                        type="button"
                        onClick={() => (
                          onAlertLogFollowUp
                            ? onAlertLogFollowUp(item)
                            : onAddFollowUp({
                              id: item.lead,
                              customer_name: item.lead_customer_name,
                              mobile_number: item.lead_mobile_number,
                            })
                        )}
                        className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#1d4ed8] bg-white px-3 text-[12px] font-extrabold text-[#1d4ed8] transition hover:bg-[#e7efff]"
                      >
                        <StickyNote className="size-3.5" />
                        Log Follow-up
                      </button>
                    ) : (
                      <span className="inline-flex h-9 items-center rounded-[8px] px-3 text-[11px] font-bold uppercase tracking-wide text-[#a5b1c7]">
                        View only
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onViewLead(item.lead)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#dbe4f0] bg-white px-3 text-[12px] font-extrabold text-[#1d4ed8] transition hover:bg-[#f8fbff]"
                    >
                      <Eye className="size-3.5" />
                      Full Timeline
                    </button>
                    {canOperate ? (
                      <button
                        type="button"
                        onClick={() => onAlertCall?.(item)}
                        className={cx(
                          'inline-flex h-9 items-center gap-1.5 rounded-[8px] px-3 text-[12px] font-extrabold text-white transition',
                          isExtraAlert ? 'bg-[#dc2626] hover:bg-[#b91c1c]' : isTodayAlert ? 'bg-[#f59e0b] hover:bg-[#d97706]' : 'bg-[#1d4ed8] hover:bg-[#1a3fb0]',
                        )}
                      >
                        <Phone className="size-3.5" />
                        Call Now
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

// ─── Reminders page ───────────────────────────────────────────────────────────

function TeleRemindersPage({
  scheduledFollowUps,
  loaded,
  onAlertCall,
  onAlertLogFollowUp,
  onAlertView,
  onAddFollowUp,
  onOpenFollowUps,
}) {
  const [tab, setTab] = useState('today');
  const [search, setSearch] = useState('');

  const { today, overdue, upcoming, withReminder } = useMemo(() => {
    const now = new Date();
    const todayStart = startOfLocalDay(now);
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const todayRows = [];
    const overdueRows = [];
    const upcomingRows = [];
    const reminderRows = [];

    for (const item of scheduledFollowUps || []) {
      const when = new Date(item.scheduled_at);
      if (Number.isNaN(when.getTime())) continue;
      if (item.reminder && item.reminder !== 'No reminder') reminderRows.push(item);
      if (when < todayStart) overdueRows.push(item);
      else if (when < tomorrow) todayRows.push(item);
      else if (when < weekEnd) upcomingRows.push(item);
    }

    const byTime = (a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at);
    return {
      today: todayRows.sort(byTime),
      overdue: overdueRows.sort(byTime),
      upcoming: upcomingRows.sort(byTime),
      withReminder: reminderRows.sort(byTime),
    };
  }, [scheduledFollowUps]);

  const cards = [
    { id: 'today', title: 'Due Today', value: loaded ? today.length : undefined, note: 'Reminders for today', icon: Zap, tone: 'bg-[#fff7ed] text-[#f59e0b]', activeRing: 'border-[#f59e0b] ring-4 ring-[#fde68a]' },
    { id: 'overdue', title: 'Overdue', value: loaded ? overdue.length : undefined, note: 'Missed reminder time', icon: AlertTriangle, tone: 'bg-[#fef2f2] text-[#dc2626]', activeRing: 'border-[#dc2626] ring-4 ring-[#fecaca]' },
    { id: 'upcoming', title: 'Next 7 Days', value: loaded ? upcoming.length : undefined, note: 'Coming up this week', icon: CalendarDays, tone: 'bg-[#e7efff] text-[#1d4ed8]', activeRing: 'border-[#1d4ed8] ring-4 ring-[#dbeafe]' },
    { id: 'reminders', title: 'Reminder Set', value: loaded ? withReminder.length : undefined, note: 'Alert preference saved', icon: Bell, tone: 'bg-[#e8f8eb] text-[#0d9f4a]', activeRing: 'border-[#0d9f4a] ring-4 ring-[#bbf7d0]' },
  ];

  const filtered = useMemo(() => {
    let rows = scheduledFollowUps || [];
    if (tab === 'today') rows = today;
    else if (tab === 'overdue') rows = overdue;
    else if (tab === 'upcoming') rows = upcoming;
    else if (tab === 'reminders') rows = withReminder;
    const query = search.trim().toLowerCase();
    if (query) {
      rows = rows.filter((item) => [
        item.lead_customer_name,
        item.lead_mobile_number,
        item.lead_project_name,
        item.follow_up_type,
        item.reminder,
      ].some((value) => String(value || '').toLowerCase().includes(query)));
    }
    return rows;
  }, [scheduledFollowUps, tab, search, today, overdue, upcoming, withReminder]);

  const dueState = (item) => {
    const when = new Date(item.scheduled_at);
    const todayStart = startOfLocalDay();
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (when < todayStart) return 'Overdue';
    if (when < tomorrow) return 'Due Today';
    return 'Upcoming';
  };

  return (
    <>
      <section className="rounded-[16px] border border-[#e2e9f3] bg-white p-4 shadow-[0_10px_26px_rgba(23,43,77,0.06)] sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-[18px] font-extrabold text-[#102446]">Reminders</h2>
            <p className="mt-1 text-[13px] font-semibold text-[#7585a2]">
              Stay on top of scheduled follow-ups. Overdue and today items need action first.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenFollowUps}
              className="inline-flex h-10 items-center gap-2 rounded-[9px] border border-[#dbe4f0] bg-white px-4 text-[13px] font-extrabold text-[#1d4ed8] transition hover:bg-[#f8fbff]"
            >
              <Phone className="size-4" />
              Open Follow-ups
            </button>
            <button
              type="button"
              onClick={() => onAddFollowUp?.(null)}
              className="inline-flex h-10 items-center gap-2 rounded-[9px] bg-[#1d4ed8] px-4 text-[13px] font-extrabold text-white transition hover:bg-[#1a3fb0]"
            >
              <Plus className="size-4" />
              Schedule Reminder
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const active = tab === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setTab(card.id)}
              className={cx(
                'rounded-[14px] border bg-white p-4 text-left shadow-[0_10px_26px_rgba(23,43,77,0.05)] transition',
                active ? card.activeRing : 'border-[#e2e9f3] hover:border-[#c7d7f0]',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-extrabold text-[#7585a2]">{card.title}</p>
                  <p className="mt-2 font-display text-[26px] font-extrabold text-[#102446]">{card.value ?? '—'}</p>
                  <p className="mt-1 text-[11px] font-semibold text-[#8a98af]">{card.note}</p>
                </div>
                <span className={cx('grid size-11 shrink-0 place-items-center rounded-full', card.tone)}>
                  <Icon className="size-5" />
                </span>
              </div>
            </button>
          );
        })}
      </section>

      <section className="rounded-[16px] border border-[#e2e9f3] bg-white p-4 shadow-[0_10px_26px_rgba(23,43,77,0.06)] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-display text-[16px] font-extrabold text-[#102446]">
              {tab === 'today' ? "Today's Reminders" : tab === 'overdue' ? 'Overdue Reminders' : tab === 'upcoming' ? 'Upcoming This Week' : tab === 'reminders' ? 'Reminders With Alert Set' : 'All Scheduled'}
            </h3>
            <p className="mt-1 text-[12px] font-semibold text-[#7585a2]">
              {filtered.length} item{filtered.length === 1 ? '' : 's'} in this view
            </p>
          </div>
          <label className="flex h-10 min-w-[240px] items-center gap-2 rounded-[9px] border border-[#dbe4f0] bg-white px-3">
            <Search className="size-4 text-[#7585a2]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, mobile, project..."
              className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-[#1f2d44] outline-none"
            />
          </label>
        </div>

        <div className="mt-4 space-y-2.5">
          {!loaded && (
            <p className="rounded-[12px] bg-[#f8fbff] px-3 py-8 text-center text-[13px] font-bold text-[#7585a2]">Loading reminders...</p>
          )}
          {loaded && filtered.length === 0 && (
            <div className="rounded-[12px] border border-dashed border-[#dbe4f0] bg-[#f8fbff] px-4 py-10 text-center">
              <Bell className="mx-auto size-8 text-[#94a3b8]" />
              <p className="mt-3 text-[14px] font-extrabold text-[#1e3261]">No reminders in this view</p>
              <p className="mt-1 text-[12px] font-semibold text-[#7585a2]">Schedule a follow-up with a reminder to see it here.</p>
            </div>
          )}
          {filtered.map((item) => {
            const Icon = FOLLOW_UP_TYPE_ICONS[item.follow_up_type] || PhoneCall;
            const state = dueState(item);
            return (
              <article
                key={item.id}
                className={cx(
                  'flex flex-col gap-3 rounded-[14px] border p-4 transition sm:flex-row sm:items-center sm:justify-between',
                  state === 'Overdue'
                    ? 'border-[#fecaca] bg-[#fff5f5]'
                    : state === 'Due Today'
                      ? 'border-[#fde68a] bg-[#fffbeb]'
                      : 'border-[#e8eef6] bg-[#fbfdff] hover:border-[#c7d7f0]',
                )}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className={cx(
                    'mt-0.5 grid size-11 shrink-0 place-items-center rounded-full',
                    state === 'Overdue' ? 'bg-[#fee2e2] text-[#dc2626]' : state === 'Due Today' ? 'bg-[#fef3c7] text-[#d97706]' : 'bg-[#e7efff] text-[#1d4ed8]',
                  )}>
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-display text-[15px] font-extrabold text-[#102446]">{item.lead_customer_name || 'Customer'}</p>
                      <span className={cx(
                        'inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase',
                        state === 'Overdue' ? 'bg-[#dc2626] text-white' : state === 'Due Today' ? 'bg-[#f59e0b] text-white' : 'bg-[#e7efff] text-[#1d4ed8]',
                      )}>
                        {state}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] font-bold text-[#53647f]">
                      {formatDateTime(item.scheduled_at)}
                      <span className="mx-1.5 text-[#c3ccd9]">·</span>
                      {item.follow_up_type || 'Call'}
                      <span className="mx-1.5 text-[#c3ccd9]">·</span>
                      {item.reminder && item.reminder !== 'No reminder' ? item.reminder : 'No reminder set'}
                    </p>
                    <p className="mt-0.5 text-[12px] font-semibold text-[#7585a2]">
                      {item.lead_mobile_number || 'No mobile'}
                      {item.lead_project_name ? ` · ${item.lead_project_name}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => (
                      onAlertLogFollowUp
                        ? onAlertLogFollowUp(item)
                        : onAddFollowUp?.({
                          id: item.lead,
                          customer_name: item.lead_customer_name,
                          mobile_number: item.lead_mobile_number,
                        })
                    )}
                    className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#1d4ed8] bg-white px-3 text-[12px] font-extrabold text-[#1d4ed8] transition hover:bg-[#e7efff]"
                  >
                    <StickyNote className="size-3.5" />
                    Log Follow-up
                  </button>
                  <button
                    type="button"
                    onClick={() => onAlertView?.(item)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#dbe4f0] bg-white px-3 text-[12px] font-extrabold text-[#1d4ed8] transition hover:bg-[#f8fbff]"
                  >
                    <Eye className="size-3.5" />
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => onAlertCall?.(item)}
                    className={cx(
                      'inline-flex h-9 items-center gap-1.5 rounded-[8px] px-3 text-[12px] font-extrabold text-white transition',
                      state === 'Overdue' ? 'bg-[#dc2626] hover:bg-[#b91c1c]' : 'bg-[#1d4ed8] hover:bg-[#1a3fb0]',
                    )}
                  >
                    <Phone className="size-3.5" />
                    Call Now
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

// ─── Reports page ─────────────────────────────────────────────────────────────

function TeleReportsPage({ leads, followUps, loaded = true }) {
  const PERIOD_OPTIONS = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'all', label: 'All Time' },
    { id: 'custom', label: 'Custom' },
  ];
  const [period, setPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState(() => {
    const now = new Date();
    return toLocalIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [customTo, setCustomTo] = useState(() => toLocalIsoDate(new Date()));

  const { start: periodStart, end: periodEnd } = useMemo(() => {
    const now = new Date();
    const todayStart = startOfLocalDay(now);
    if (period === 'today') {
      const end = new Date(todayStart);
      end.setDate(end.getDate() + 1);
      return { start: todayStart, end };
    }
    if (period === 'week') {
      const start = startOfLocalDay(now);
      const day = start.getDay();
      const mondayOffset = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - mondayOffset);
      return { start, end: null };
    }
    if (period === 'month') {
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: null };
    }
    if (period === 'custom') {
      let from = parseLocalIsoDate(customFrom);
      let to = parseLocalIsoDate(customTo);
      if (!from && !to) return { start: null, end: null };
      if (!from) from = to;
      if (!to) to = from;
      if (from > to) {
        const tmp = from;
        from = to;
        to = tmp;
      }
      const end = new Date(to);
      end.setDate(end.getDate() + 1);
      return { start: from, end };
    }
    return { start: null, end: null };
  }, [period, customFrom, customTo]);

  const inRange = useCallback((value, start, end) => {
    if (!start && !end) return true;
    if (!value) return false;
    const time = new Date(value).getTime();
    if (!Number.isFinite(time)) return false;
    if (start && time < start.getTime()) return false;
    if (end && time >= end.getTime()) return false;
    return true;
  }, []);

  const pipelineLeads = leads || [];
  const allFollowUps = followUps || [];
  const activePeriodLabel = useMemo(() => {
    if (period === 'custom') {
      if (!customFrom && !customTo) return 'Custom Range';
      return `${formatLocalIsoLabel(customFrom || customTo)} – ${formatLocalIsoLabel(customTo || customFrom)}`;
    }
    return PERIOD_OPTIONS.find((item) => item.id === period)?.label || 'All Time';
  }, [period, customFrom, customTo]);

  const selectPeriod = (id) => {
    setPeriod(id);
    if (id === 'custom') {
      if (!customFrom) {
        const now = new Date();
        setCustomFrom(toLocalIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)));
      }
      if (!customTo) setCustomTo(toLocalIsoDate(new Date()));
    }
  };

  const periodFollowUps = useMemo(
    () => allFollowUps.filter((item) => {
      const stamp = item.status === 'Completed'
        ? (item.completed_at || item.scheduled_at || item.created_at)
        : (item.scheduled_at || item.created_at);
      return inRange(stamp, periodStart, periodEnd);
    }),
    [allFollowUps, periodStart, periodEnd, inRange],
  );

  const periodLeadIds = useMemo(() => {
    const ids = new Set();
    for (const item of periodFollowUps) {
      if (item.lead != null) ids.add(String(item.lead));
    }
    return ids;
  }, [periodFollowUps]);

  // Leads created in period OR touched by follow-up activity in period
  const periodLeads = useMemo(
    () => pipelineLeads.filter((lead) => (
      inRange(lead.created_at, periodStart, periodEnd) || periodLeadIds.has(String(lead.id))
    )),
    [pipelineLeads, periodStart, periodEnd, periodLeadIds, inRange],
  );

  const completedInPeriod = useMemo(
    () => periodFollowUps.filter((item) => item.status === 'Completed'),
    [periodFollowUps],
  );
  const scheduledInPeriod = useMemo(
    () => periodFollowUps.filter((item) => item.status === 'Scheduled'),
    [periodFollowUps],
  );
  const { today: todayDue, overdue } = useMemo(
    () => splitFollowUpAlerts(scheduledInPeriod),
    [scheduledInPeriod],
  );

  // For Today/Week/Month overdue card: if period is "today", show all still-overdue
  // from full queue so the filter still feels actionable.
  const liveScheduled = useMemo(
    () => allFollowUps.filter((item) => item.status === 'Scheduled'),
    [allFollowUps],
  );
  const liveAlerts = useMemo(() => splitFollowUpAlerts(liveScheduled), [liveScheduled]);
  const dueTodayCount = period === 'all' || period === 'today' || period === 'week' || period === 'month'
    ? liveAlerts.today.length
    : todayDue.length;
  const overdueCount = liveAlerts.overdue.length;

  const totalLeads = periodLeads.length;
  const won = periodLeads.filter((lead) => teleDisplayStatus(lead) === 'Won').length;
  const lost = periodLeads.filter((lead) => teleDisplayStatus(lead) === 'Lost').length;
  const newLeads = pipelineLeads.filter((lead) => inRange(lead.created_at, periodStart, periodEnd)).length;
  const conversion = totalLeads > 0 ? Math.round((won / totalLeads) * 100) : 0;
  const completion = periodFollowUps.length > 0
    ? Math.round((completedInPeriod.length / periodFollowUps.length) * 100)
    : 0;

  const statusCounts = TELE_LEAD_STATUSES.map((statusName) => ({
    name: statusName,
    count: periodLeads.filter((lead) => teleDisplayStatus(lead) === statusName).length,
  }));
  const maxStatus = Math.max(1, ...statusCounts.map((row) => row.count));

  const outcomeCounts = useMemo(() => {
    const map = new Map();
    for (const item of completedInPeriod) {
      const key = String(item.outcome || '').trim() || 'No outcome logged';
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [completedInPeriod]);

  const typeCounts = FOLLOW_UP_TYPES.map((typeName) => ({
    name: typeName,
    count: periodFollowUps.filter((item) => item.follow_up_type === typeName).length,
  })).filter((row) => row.count > 0);

  const recentActivity = useMemo(() => (
    [...periodFollowUps]
      .sort((a, b) => new Date(b.completed_at || b.scheduled_at || b.created_at) - new Date(a.completed_at || a.scheduled_at || a.created_at))
      .slice(0, 10)
  ), [periodFollowUps]);

  const statusBarTones = {
    New: 'bg-[#1d4ed8]', Hot: 'bg-[#ea7c1c]', Cool: 'bg-[#7c3aed]', Won: 'bg-[#0d9f4a]', Lost: 'bg-[#dc2626]',
  };

  const cards = [
    { title: 'Leads', value: loaded ? totalLeads : undefined, note: `${newLeads} created · ${activePeriodLabel}`, icon: Users, tone: 'bg-[#e7efff] text-[#1d4ed8]' },
    { title: 'Won Leads', value: loaded ? won : undefined, note: `${conversion}% win rate`, icon: Trophy, tone: 'bg-[#f0e9ff] text-[#7c3aed]' },
    { title: 'Follow-ups Done', value: loaded ? completedInPeriod.length : undefined, note: `${completion}% completion`, icon: CheckCircle2, tone: 'bg-[#e8f8eb] text-[#0d9f4a]' },
    { title: 'Due Today', value: loaded ? dueTodayCount : undefined, note: 'High alert now', icon: Zap, tone: 'bg-[#fff7ed] text-[#f59e0b]' },
    { title: 'Overdue', value: loaded ? overdueCount : undefined, note: 'Extra high now', icon: AlertTriangle, tone: 'bg-[#fef2f2] text-[#dc2626]' },
  ];

  return (
    <>
      <section className="rounded-[16px] border border-[#e2e9f3] bg-white p-4 shadow-[0_10px_26px_rgba(23,43,77,0.06)] sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-[18px] font-extrabold text-[#102446]">Performance Reports</h2>
            <p className="mt-1 text-[13px] font-semibold text-[#7585a2]">
              Showing report data for <span className="font-extrabold text-[#1d4ed8]">{activePeriodLabel}</span>
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Report period">
              {PERIOD_OPTIONS.map((option) => {
                const active = period === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => selectPeriod(option.id)}
                    className={cx(
                      'inline-flex h-9 shrink-0 items-center rounded-full px-4 text-[12px] font-extrabold transition',
                      active
                        ? 'bg-[#1d4ed8] text-white shadow-[0_8px_18px_rgba(29,78,216,0.28)]'
                        : 'border border-[#dbe4f0] bg-white text-[#53647f] hover:bg-[#f8fbff]',
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            {period === 'custom' ? (
              <div className="flex flex-col gap-2 rounded-[12px] border border-[#dbe4f0] bg-[#f8fbff] p-3 sm:flex-row sm:items-end">
                <label className="min-w-0 flex-1">
                  <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[#7585a2]">From</span>
                  <input
                    type="date"
                    value={customFrom}
                    max={customTo || undefined}
                    onChange={(e) => {
                      setCustomFrom(e.target.value);
                      setPeriod('custom');
                    }}
                    className="h-10 w-full rounded-[9px] border border-[#dbe4f0] bg-white px-3 text-[13px] font-bold text-[#1e3261] outline-none focus:border-[#1d4ed8]"
                  />
                </label>
                <label className="min-w-0 flex-1">
                  <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[#7585a2]">To</span>
                  <input
                    type="date"
                    value={customTo}
                    min={customFrom || undefined}
                    onChange={(e) => {
                      setCustomTo(e.target.value);
                      setPeriod('custom');
                    }}
                    className="h-10 w-full rounded-[9px] border border-[#dbe4f0] bg-white px-3 text-[13px] font-bold text-[#1e3261] outline-none focus:border-[#1d4ed8]"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setCustomFrom(toLocalIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)));
                    setCustomTo(toLocalIsoDate(now));
                    setPeriod('custom');
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-[9px] border border-[#dbe4f0] bg-white px-4 text-[12px] font-extrabold text-[#1d4ed8] transition hover:bg-white"
                >
                  This Month
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <TeleStatCards cards={cards} />

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-[16px] border border-[#e2e9f3] bg-white p-5 shadow-[0_10px_26px_rgba(23,43,77,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-[16px] font-extrabold text-[#102446]">Lead Status Mix</h3>
            <span className="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[11px] font-extrabold text-[#53647f]">
              {totalLeads} lead{totalLeads === 1 ? '' : 's'} · {activePeriodLabel}
            </span>
          </div>
          <div className="mt-4 space-y-3.5">
            {!loaded && <p className="py-6 text-center text-[12px] font-bold text-[#7585a2]">Loading...</p>}
            {loaded && totalLeads === 0 && (
              <p className="rounded-[10px] bg-[#f8fbff] px-3 py-6 text-center text-[12px] font-bold text-[#7585a2]">
                No leads found for {activePeriodLabel.toLowerCase()}.
              </p>
            )}
            {statusCounts.map((row) => (
              <div key={row.name}>
                <div className="flex items-center justify-between text-[13px] font-bold text-[#33456b]">
                  <span>{row.name}</span>
                  <span className="font-extrabold text-[#102446]">
                    {row.count}{totalLeads > 0 ? ` (${Math.round((row.count / totalLeads) * 100)}%)` : ''}
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[#eef2f8]">
                  <div
                    className={cx('h-full rounded-full transition-all', statusBarTones[row.name])}
                    style={{ width: `${totalLeads ? (row.count / maxStatus) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="grid grid-cols-3 gap-2 border-t border-[#edf2f8] pt-3 text-[12px] font-bold">
              <div className="rounded-[10px] bg-[#eff6ff] px-3 py-2 text-[#1d4ed8]">Created: {newLeads}</div>
              <div className="rounded-[10px] bg-[#f0fdf4] px-3 py-2 text-[#166534]">Won: {won}</div>
              <div className="rounded-[10px] bg-[#fef2f2] px-3 py-2 text-[#991b1b]">Lost: {lost}</div>
            </div>
          </div>
        </section>

        <section className="rounded-[16px] border border-[#e2e9f3] bg-white p-5 shadow-[0_10px_26px_rgba(23,43,77,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-[16px] font-extrabold text-[#102446]">Call Outcomes</h3>
            <span className="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[11px] font-extrabold text-[#53647f]">
              {completedInPeriod.length} completed · {activePeriodLabel}
            </span>
          </div>
          <div className="mt-4 space-y-2.5">
            {outcomeCounts.length === 0 && (
              <p className="rounded-[10px] bg-[#f8fbff] px-3 py-6 text-center text-[12px] font-bold text-[#7585a2]">
                No completed follow-ups with outcomes for {activePeriodLabel.toLowerCase()}.
              </p>
            )}
            {outcomeCounts.map((row) => (
              <div key={row.name} className="flex items-center justify-between rounded-[10px] border border-[#eef2f8] px-3.5 py-3">
                <p className="text-[13px] font-extrabold text-[#1e3261]">{row.name}</p>
                <p className="text-[13px] font-extrabold text-[#102446]">{row.count}</p>
              </div>
            ))}
          </div>
          {typeCounts.length > 0 ? (
            <div className="mt-5 border-t border-[#edf2f8] pt-4">
              <p className="text-[12px] font-extrabold uppercase tracking-wide text-[#7585a2]">By Channel</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {typeCounts.map((row) => {
                  const Icon = FOLLOW_UP_TYPE_ICONS[row.name] || PhoneCall;
                  return (
                    <span key={row.name} className="inline-flex items-center gap-1.5 rounded-full border border-[#dbe4f0] bg-[#f8fbff] px-3 py-1.5 text-[12px] font-extrabold text-[#1e3261]">
                      <Icon className="size-3.5 text-[#1d4ed8]" />
                      {row.name}: {row.count}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <section className="rounded-[16px] border border-[#e2e9f3] bg-white p-4 shadow-[0_10px_26px_rgba(23,43,77,0.06)] sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-[16px] font-extrabold text-[#102446]">Recent Activity</h3>
          <span className="text-[12px] font-semibold text-[#7585a2]">
            {recentActivity.length} item{recentActivity.length === 1 ? '' : 's'} · {activePeriodLabel}
          </span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#e8eef6] text-[12px] font-extrabold uppercase tracking-[0.04em] text-[#7585a2]">
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">When</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {!loaded && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-[13px] font-bold text-[#7585a2]">Loading activity...</td></tr>
              )}
              {loaded && recentActivity.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-[13px] font-bold text-[#7585a2]">No follow-up activity for {activePeriodLabel.toLowerCase()}.</td></tr>
              )}
              {recentActivity.map((item) => {
                const Icon = FOLLOW_UP_TYPE_ICONS[item.follow_up_type] || PhoneCall;
                return (
                  <tr key={item.id} className="border-b border-[#f1f5fa] text-[13px] font-bold text-[#33456b] transition hover:bg-[#f8fbff]">
                    <td className="px-3 py-3.5 font-extrabold text-[#1e3261]">{item.lead_customer_name || '—'}</td>
                    <td className="px-3 py-3.5">
                      <span className="inline-flex items-center gap-2">
                        <Icon className="size-4 text-[#1d4ed8]" />
                        {item.follow_up_type}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5">{formatDateTime(item.completed_at || item.scheduled_at || item.created_at)}</td>
                    <td className="px-3 py-3.5">
                      <span className={cx(
                        'inline-flex rounded-full px-3 py-1 text-[11px] font-extrabold',
                        item.status === 'Completed' ? 'bg-[#e8f8eb] text-[#0d9f4a]' : item.status === 'Missed' ? 'bg-[#feecec] text-[#dc2626]' : 'bg-[#e7efff] text-[#1d4ed8]',
                      )}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">{item.outcome || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// ─── Profile Details page ─────────────────────────────────────────────────────

function TeleProfileDetailsPage({ me }) {
  const displayName = me?.name || 'Tele Executive';
  const initials = (me?.initials || displayName.slice(0, 2) || 'TE').toUpperCase();
  const profileFields = [
    { label: 'Full Name', value: me?.name, icon: UserRound },
    { label: 'Email Address', value: me?.email, icon: Mail },
    { label: 'Mobile Number', value: me?.mobile, icon: Phone },
    { label: 'Role', value: me?.role_name || TELE_ROLE_NAME, icon: ShieldCheck },
    { label: 'Branch', value: me?.branch_name, icon: MapPin },
  ];

  return (
    <>
      <section className="rounded-[16px] border border-[#e2e9f3] bg-white p-5 shadow-[0_10px_26px_rgba(23,43,77,0.06)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid size-16 place-items-center rounded-full border border-[#d4af37]/55 bg-[#123c8f] text-[18px] font-extrabold text-white shadow-[0_10px_22px_rgba(18,60,143,0.28)]">
              {initials}
            </span>
            <div>
              <p className="text-[12px] font-extrabold uppercase tracking-wide text-[#7585a2]">Profile Details</p>
              <h2 className="font-display text-[22px] font-extrabold leading-tight text-[#102446]">{displayName}</h2>
              <p className="mt-0.5 text-[13px] font-semibold text-[#53647f]">
                {me?.role_name || TELE_ROLE_NAME}
                {me?.branch_name ? ` · ${me.branch_name}` : ''}
              </p>
            </div>
          </div>
          <p className="inline-flex items-center gap-2 rounded-full bg-[#eff6ff] px-3.5 py-2 text-[12px] font-extrabold text-[#1d4ed8]">
            <ShieldCheck className="size-4" />
            View only
          </p>
        </div>
      </section>

      <section className="rounded-[16px] border border-[#e2e9f3] bg-white p-5 shadow-[0_10px_26px_rgba(23,43,77,0.06)] sm:p-6">
        <div className="mb-5">
          <h3 className="font-display text-[16px] font-extrabold text-[#102446]">Personal Information</h3>
          <p className="mt-1 text-[12px] font-semibold text-[#7585a2]">
            These details are linked to your Tele Executive account.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {profileFields.map((field) => {
            const Icon = field.icon;
            return (
              <div
                key={field.label}
                className="rounded-[12px] border border-[#eef2f8] bg-[#f8fbff] px-4 py-3.5"
              >
                <div className="mb-2 flex items-center gap-2 text-[#7585a2]">
                  <Icon className="size-3.5" />
                  <p className="text-[11px] font-extrabold uppercase tracking-wide">{field.label}</p>
                </div>
                <p className="text-[14px] font-extrabold text-[#1e3261]">{field.value || '—'}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-5 rounded-[12px] border border-[#e8eef6] bg-[#f8fbff] p-4">
          <p className="inline-flex items-center gap-2 text-[13px] font-extrabold text-[#102446]">
            <LockKeyhole className="size-4 text-[#1d4ed8]" />
            Account updates
          </p>
          <p className="mt-2 text-[13px] font-semibold leading-6 text-[#53647f]">
            Profile details and login credentials are managed by Super Admin.
            Contact your administrator if name, mobile, branch, or password needs to be updated.
          </p>
        </div>
      </section>
    </>
  );
}

// ─── Follow-up create modal ───────────────────────────────────────────────────

function TeleFollowUpCreateModal({ leads, initialLead, onClose, onSaved, onNotify }) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    leadId: initialLead?.id ? String(initialLead.id) : '',
    type: 'Call',
    date: todayIso,
    time: new Date().toTimeString().slice(0, 5),
    outcome: 'Interested',
    reminder: 'No reminder',
    summary: '',
    nextDate: '',
    nextTime: '10:00',
    leadStatus: initialLead ? teleDisplayStatus(initialLead) : 'New',
  });
  const [saving, setSaving] = useState(false);

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleLeadChange = (value) => {
    const lead = leads.find((row) => String(row.id) === value);
    setForm((current) => ({ ...current, leadId: value, leadStatus: lead ? teleDisplayStatus(lead) : current.leadStatus }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.leadId) { onNotify('Please select a lead.', 'error'); return; }
    if (!form.date) { onNotify('Please select the follow-up date.', 'error'); return; }
    if (!form.summary.trim()) { onNotify('Please write what happened in this conversation.', 'error'); return; }
    if (form.nextDate && new Date(`${form.nextDate}T${form.nextTime || '10:00'}`) < new Date()) {
      onNotify('Next follow-up must be in the future.', 'error');
      return;
    }
    setSaving(true);
    const leadId = Number(form.leadId);
    const happenedAt = new Date(`${form.date}T${form.time || '09:00'}`).toISOString();
    try {
      // Completed interaction — permanent history entry (never overwritten).
      await followUpApi.create({
        lead: leadId,
        follow_up_type: form.type,
        scheduled_at: happenedAt,
        completed_at: happenedAt,
        status: 'Completed',
        notes: form.summary.trim(),
        outcome: form.outcome,
        reminder: form.reminder === 'No reminder' ? '' : form.reminder,
        status_after: form.leadStatus,
      });
      // Optional next scheduled follow-up for reminders / today list.
      if (form.nextDate) {
        await followUpApi.create({
          lead: leadId,
          follow_up_type: form.type,
          scheduled_at: new Date(`${form.nextDate}T${form.nextTime || '10:00'}`).toISOString(),
          status: 'Scheduled',
          notes: `Next follow-up planned after: ${form.outcome}`,
          reminder: form.reminder === 'No reminder' ? '' : form.reminder,
        });
      }
      await leadApi.update(leadId, mapTeleStatusToApi(form.leadStatus));
      onNotify('Follow-up saved to lead history.', 'success');
      onSaved();
    } catch (err) {
      onNotify(err.message || 'Could not save follow-up.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <TeleModal title="Log Follow-up" onClose={onClose} wide>
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="rounded-[12px] border border-[#dbeafe] bg-[#eff6ff] px-4 py-3 text-[12px] font-semibold leading-5 text-[#1e3a8a]">
          Save every call or WhatsApp note as a new entry. Old follow-ups stay in the timeline forever.
        </div>

        <section className="space-y-3">
          <p className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#7585a2]">1. Who did you contact?</p>
          <TeleField label="Lead / Customer">
            <select value={form.leadId} onChange={(e) => handleLeadChange(e.target.value)} className={teleInputClass}>
              <option value="">Select lead...</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>{lead.customer_name} — {lead.mobile_number}</option>
              ))}
            </select>
          </TeleField>
          <div className="grid gap-4 sm:grid-cols-3">
            <TeleField label="Contact Type">
              <select value={form.type} onChange={(e) => updateField('type', e.target.value)} className={teleInputClass}>
                {FOLLOW_UP_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </TeleField>
            <TeleField label="Date">
              <input type="date" value={form.date} onChange={(e) => updateField('date', e.target.value)} className={teleInputClass} />
            </TeleField>
            <TeleField label="Time">
              <input type="time" value={form.time} onChange={(e) => updateField('time', e.target.value)} className={teleInputClass} />
            </TeleField>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#7585a2]">2. What happened?</p>
          <TeleField label="Conversation Summary *">
            <textarea
              value={form.summary}
              onChange={(e) => updateField('summary', e.target.value)}
              placeholder="Example: Customer asked about 5kW price and subsidy. Will decide after salary."
              rows={4}
              className="w-full rounded-[9px] border border-[#dbe4f0] bg-white px-3 py-2.5 text-[14px] font-semibold text-[#1f2d44] outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </TeleField>
          <TeleField label="Outcome">
            <div className="flex flex-wrap gap-2">
              {FOLLOW_UP_OUTCOMES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => updateField('outcome', option)}
                  className={cx(
                    'rounded-full border px-3 py-1.5 text-[12px] font-extrabold transition',
                    form.outcome === option
                      ? 'border-[#1d4ed8] bg-[#1d4ed8] text-white'
                      : 'border-[#dbe4f0] bg-white text-[#53647f] hover:bg-[#f8fbff]',
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </TeleField>
          <TeleField label="Lead Status After This Call">
            <div className="flex flex-wrap gap-2">
              {TELE_LEAD_STATUSES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => updateField('leadStatus', option)}
                  className={cx(
                    'rounded-full border px-4 py-2 text-[12px] font-extrabold transition',
                    form.leadStatus === option
                      ? 'border-[#1d4ed8] bg-[#1d4ed8] text-white'
                      : 'border-[#dbe4f0] bg-white text-[#53647f] hover:bg-[#f8fbff]',
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </TeleField>
        </section>

        <section className="space-y-3">
          <p className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#7585a2]">3. Next plan (optional)</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <TeleField label="Next Follow-up Date">
              <input type="date" value={form.nextDate} min={todayIso} onChange={(e) => updateField('nextDate', e.target.value)} className={teleInputClass} />
            </TeleField>
            <TeleField label="Next Follow-up Time">
              <input type="time" value={form.nextTime} onChange={(e) => updateField('nextTime', e.target.value)} className={teleInputClass} />
            </TeleField>
            <TeleReminderField value={form.reminder} onChange={(value) => updateField('reminder', value)} />
          </div>
        </section>

        <div className="flex justify-end gap-2.5 border-t border-[#edf2f8] pt-4">
          <button type="button" onClick={onClose} className="h-11 rounded-[9px] border border-[#dbe4f0] px-4 text-[13px] font-extrabold text-[#53647f] transition hover:bg-[#f8fbff]">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-[9px] bg-[#1d4ed8] px-5 text-[13px] font-extrabold text-white transition hover:bg-[#1a3fb0] disabled:opacity-60">
            <Plus className="size-4" />
            {saving ? 'Saving...' : 'Save to History'}
          </button>
        </div>
      </form>
    </TeleModal>
  );
}

// ─── Follow-up history modal ──────────────────────────────────────────────────

function TeleFollowUpHistoryModal({ lead, onClose, onNotify, onAddFollowUp }) {
  const [history, setHistory] = useState(null);
  const [range, setRange] = useState('all');
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadHistory = () => {
    followUpApi.list(lead.id).then((data) => {
      const rows = Array.isArray(data) ? data : (data?.results ?? []);
      setHistory(rows.sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at)));
    }).catch(() => { setHistory([]); onNotify('Could not load follow-up history.', 'error'); });
  };

  useEffect(() => {
    loadHistory();
  }, [lead.id]);

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await followUpApi.delete(deleteTarget.id);
      onNotify('Follow-up deleted.', 'success');
      setDeleteTarget(null);
      loadHistory();
    } catch (err) {
      onNotify(err.message || 'Could not delete follow-up.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const visible = filterFollowUpsByRange(history ?? [], range);
  const completedCount = (history ?? []).filter((item) => item.status === 'Completed').length;
  const nextPending = (history ?? [])
    .filter((item) => item.status === 'Scheduled')
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0];

  return (
    <>
      <TeleModal title={`Follow-up Timeline — ${lead.customer_name}`} onClose={onClose} wide>
        <div className="grid gap-3 rounded-[12px] border border-[#e8eef6] bg-[#f8fbff] p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[11px] font-extrabold text-[#7585a2]">Customer</p>
            <p className="mt-1 text-[13px] font-extrabold text-[#1e3261]">{lead.customer_name}</p>
            <p className="text-[12px] font-bold text-[#53647f]">{lead.mobile_number || '—'}</p>
          </div>
          <div>
            <p className="text-[11px] font-extrabold text-[#7585a2]">Lead Status</p>
            <div className="mt-1"><StatusPill value={teleDisplayStatus(lead)} /></div>
          </div>
          <div>
            <p className="text-[11px] font-extrabold text-[#7585a2]">Total Entries</p>
            <p className="mt-1 font-display text-[22px] font-extrabold text-[#102446]">{history === null ? '…' : history.length}</p>
            <p className="text-[11px] font-semibold text-[#8a98af]">{completedCount} completed</p>
          </div>
          <div>
            <p className="text-[11px] font-extrabold text-[#7585a2]">Next Follow-up</p>
            <p className="mt-1 text-[13px] font-extrabold text-[#1e3261]">
              {nextPending ? formatDateTime(nextPending.scheduled_at) : 'Not scheduled'}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {FOLLOW_UP_HISTORY_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setRange(filter.id)}
                className={cx(
                  'rounded-full border px-3 py-1.5 text-[12px] font-extrabold transition',
                  range === filter.id
                    ? 'border-[#1d4ed8] bg-[#1d4ed8] text-white'
                    : 'border-[#dbe4f0] bg-white text-[#53647f] hover:bg-[#f8fbff]',
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
          {onAddFollowUp ? (
            <button
              type="button"
              onClick={() => onAddFollowUp(lead)}
              className="inline-flex h-10 items-center gap-2 rounded-[9px] bg-[#1d4ed8] px-4 text-[13px] font-extrabold text-white transition hover:bg-[#1a3fb0]"
            >
              <Plus className="size-4" />
              Log Follow-up
            </button>
          ) : null}
        </div>

        <div className="relative mt-5 space-y-0 pl-2">
          {history === null && (
            <p className="rounded-[10px] bg-[#f8fbff] px-3 py-6 text-center text-[12px] font-bold text-[#7585a2]">Loading timeline...</p>
          )}
          {history !== null && visible.length === 0 && (
            <p className="rounded-[10px] bg-[#f8fbff] px-3 py-6 text-center text-[12px] font-bold text-[#7585a2]">
              No follow-ups in this period. Log the first conversation to start the timeline.
            </p>
          )}
          {visible.map((item, index) => {
            const Icon = FOLLOW_UP_TYPE_ICONS[item.follow_up_type] || PhoneCall;
            return (
              <article key={item.id} className="relative flex gap-4 pb-5">
                {index < visible.length - 1 ? (
                  <span className="absolute left-[19px] top-11 bottom-0 w-px bg-[#dbe4f0]" aria-hidden="true" />
                ) : null}
                <span className={cx(
                  'relative z-10 mt-0.5 grid size-10 shrink-0 place-items-center rounded-full border-2 border-white shadow-sm',
                  item.status === 'Completed' ? 'bg-[#e8f8eb] text-[#0d9f4a]' : item.status === 'Missed' ? 'bg-[#feecec] text-[#dc2626]' : 'bg-[#e7efff] text-[#1d4ed8]',
                )}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1 rounded-[12px] border border-[#e8eef6] bg-white p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-extrabold text-[#1e3261]">
                        {formatDateTime(item.scheduled_at)}
                        <span className="ml-2 font-bold text-[#7585a2]">· {item.follow_up_type}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] font-bold text-[#8a98af]">{followUpAgeLabel(item.scheduled_at)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {item.outcome ? (
                        <span className="inline-flex rounded-full bg-[#eef2ff] px-2.5 py-1 text-[10px] font-extrabold text-[#3730a3]">
                          {item.outcome}
                        </span>
                      ) : null}
                      {item.status_after ? <StatusPill value={item.status_after} /> : null}
                      <span className={cx(
                        'inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold',
                        item.status === 'Completed' ? 'bg-[#e8f8eb] text-[#0d9f4a]' : item.status === 'Missed' ? 'bg-[#feecec] text-[#dc2626]' : 'bg-[#e7efff] text-[#1d4ed8]',
                      )}>
                        {item.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditTarget(item)}
                        className="inline-flex size-8 items-center justify-center rounded-[8px] border border-[#dbe4f0] bg-white text-[#1d4ed8] transition hover:bg-[#f8fbff]"
                        aria-label="Edit follow-up"
                        title="Edit"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        className="inline-flex size-8 items-center justify-center rounded-[8px] border border-[#ffd5d5] bg-[#fff8f8] text-[#dc2626] transition hover:bg-[#feecec]"
                        aria-label="Delete follow-up"
                        title="Delete"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  {item.notes ? (
                    <p className="mt-2 text-[13px] font-semibold leading-6 text-[#53647f]">
                      <span className="font-extrabold text-[#33456b]">What happened: </span>
                      {item.notes}
                    </p>
                  ) : null}
                  <p className="mt-2 text-[11px] font-semibold text-[#8a98af]">
                    Logged by {item.created_by_name || '—'}
                    {item.reminder ? ` · Reminder: ${item.reminder}` : ''}
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-2 flex justify-end border-t border-[#edf2f8] pt-4">
          <button type="button" onClick={onClose} className="h-10 rounded-[9px] border border-[#dbe4f0] px-5 text-[13px] font-extrabold text-[#53647f] transition hover:bg-[#f8fbff]">
            Close
          </button>
        </div>
      </TeleModal>

      {editTarget ? (
        <TeleFollowUpEditModal
          followUp={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); loadHistory(); }}
          onNotify={onNotify}
        />
      ) : null}

      {deleteTarget ? (
        <TeleModal title="Delete Follow-up" onClose={() => setDeleteTarget(null)}>
          <p className="text-[14px] font-semibold leading-6 text-[#53647f]">
            Delete this follow-up for <span className="font-extrabold text-[#1e3261]">{lead.customer_name}</span>?
            This removes it from the timeline permanently.
          </p>
          <p className="mt-3 rounded-[10px] bg-[#fff5f5] px-3 py-2 text-[12px] font-bold text-[#b91c1c]">
            {formatDateTime(deleteTarget.scheduled_at)} · {deleteTarget.follow_up_type}
            {deleteTarget.notes ? ` — ${deleteTarget.notes.slice(0, 80)}${deleteTarget.notes.length > 80 ? '…' : ''}` : ''}
          </p>
          <div className="mt-5 flex justify-end gap-2.5 border-t border-[#edf2f8] pt-4">
            <button type="button" onClick={() => setDeleteTarget(null)} className="h-10 rounded-[9px] border border-[#dbe4f0] px-4 text-[13px] font-extrabold text-[#53647f]">
              Cancel
            </button>
            <button type="button" disabled={deleting} onClick={handleDelete} className="h-10 rounded-[9px] bg-[#dc2626] px-4 text-[13px] font-extrabold text-white disabled:opacity-60">
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </TeleModal>
      ) : null}
    </>
  );
}

function TeleFollowUpEditModal({ followUp, onClose, onSaved, onNotify }) {
  const when = followUp.scheduled_at ? new Date(followUp.scheduled_at) : new Date();
  const [form, setForm] = useState({
    type: followUp.follow_up_type || 'Call',
    date: Number.isNaN(when.getTime()) ? '' : when.toISOString().slice(0, 10),
    time: Number.isNaN(when.getTime()) ? '10:00' : when.toTimeString().slice(0, 5),
    outcome: followUp.outcome || '',
    status: followUp.status || 'Completed',
    summary: followUp.notes || '',
    reminder: followUp.reminder || 'No reminder',
    statusAfter: followUp.status_after || '',
  });
  const [saving, setSaving] = useState(false);
  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.summary.trim()) { onNotify('Please write what happened in this conversation.', 'error'); return; }
    if (!form.date) { onNotify('Please select the follow-up date.', 'error'); return; }
    setSaving(true);
    const happenedAt = new Date(`${form.date}T${form.time || '09:00'}`).toISOString();
    try {
      await followUpApi.update(followUp.id, {
        follow_up_type: form.type,
        scheduled_at: happenedAt,
        completed_at: form.status === 'Completed' ? (followUp.completed_at || happenedAt) : null,
        status: form.status,
        notes: form.summary.trim(),
        outcome: form.outcome,
        reminder: form.reminder === 'No reminder' ? '' : form.reminder,
        status_after: form.statusAfter,
      });
      onNotify('Follow-up updated.', 'success');
      onSaved();
    } catch (err) {
      onNotify(err.message || 'Could not update follow-up.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <TeleModal title="Edit Follow-up" onClose={onClose} wide>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-3">
          <TeleField label="Contact Type">
            <select value={form.type} onChange={(e) => updateField('type', e.target.value)} className={teleInputClass}>
              {FOLLOW_UP_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </TeleField>
          <TeleField label="Date">
            <input type="date" value={form.date} onChange={(e) => updateField('date', e.target.value)} className={teleInputClass} />
          </TeleField>
          <TeleField label="Time">
            <input type="time" value={form.time} onChange={(e) => updateField('time', e.target.value)} className={teleInputClass} />
          </TeleField>
        </div>

        <TeleField label="Status">
          <select value={form.status} onChange={(e) => updateField('status', e.target.value)} className={teleInputClass}>
            {['Completed', 'Scheduled', 'Missed'].map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </TeleField>

        <TeleField label="Conversation Summary *">
          <textarea
            value={form.summary}
            onChange={(e) => updateField('summary', e.target.value)}
            rows={4}
            className="w-full rounded-[9px] border border-[#dbe4f0] bg-white px-3 py-2.5 text-[14px] font-semibold text-[#1f2d44] outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </TeleField>

        <TeleField label="Outcome">
          <div className="flex flex-wrap gap-2">
            {FOLLOW_UP_OUTCOMES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => updateField('outcome', option)}
                className={cx(
                  'rounded-full border px-3 py-1.5 text-[12px] font-extrabold transition',
                  form.outcome === option
                    ? 'border-[#1d4ed8] bg-[#1d4ed8] text-white'
                    : 'border-[#dbe4f0] bg-white text-[#53647f] hover:bg-[#f8fbff]',
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </TeleField>

        <div className="grid gap-4 sm:grid-cols-2">
          <TeleField label="Lead Status After Call">
            <select value={form.statusAfter} onChange={(e) => updateField('statusAfter', e.target.value)} className={teleInputClass}>
              <option value="">—</option>
              {TELE_LEAD_STATUSES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </TeleField>
          <TeleReminderField value={form.reminder || 'No reminder'} onChange={(value) => updateField('reminder', value)} />
        </div>

        <div className="flex justify-end gap-2.5 border-t border-[#edf2f8] pt-4">
          <button type="button" onClick={onClose} className="h-11 rounded-[9px] border border-[#dbe4f0] px-4 text-[13px] font-extrabold text-[#53647f]">Cancel</button>
          <button type="submit" disabled={saving} className="h-11 rounded-[9px] bg-[#1d4ed8] px-5 text-[13px] font-extrabold text-white disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </TeleModal>
  );
}

// ─── Lead create modal ────────────────────────────────────────────────────────

function TeleLeadCreateModal({ onClose, onSaved, onNotify }) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const ivrsCheck = useTeleIvrsCheck();
  const [form, setForm] = useState({
    customer_name: '',
    mobile_number: '',
    ivrs_number: '',
    alternate_number: '',
    email: '',
    project_name: '',
    project_type: 'On-Grid',
    estimated_capacity: '',
    source: 'Walk-in',
    priority: 'Medium',
    address: '',
    city: '',
    state: 'Madhya Pradesh',
    requirement_details: '',
    remarks: '',
    leadStatus: 'New',
    nextDate: '',
    nextTime: '10:00',
    reminder: 'No reminder',
  });
  const [saving, setSaving] = useState(false);

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.customer_name.trim()) { onNotify('Customer name is required.', 'error'); return; }
    if (!/^\d{10}$/.test(form.mobile_number.trim())) { onNotify('Mobile number must be 10 digits.', 'error'); return; }
    if (!form.ivrs_number.trim()) { onNotify('IVRS Number is required.', 'error'); return; }
    if (ivrsCheck.result && ivrsCheck.result !== 'unique') {
      onNotify('This IVRS Number already exists. Please verify and use a different IVRS.', 'error');
      return;
    }
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email.trim())) { onNotify('Please enter a valid email address.', 'error'); return; }
    if (form.nextDate && new Date(`${form.nextDate}T${form.nextTime || '10:00'}`) < new Date()) {
      onNotify('First follow-up must be in the future.', 'error');
      return;
    }
    setSaving(true);
    const { status, category } = mapTeleStatusToApi(form.leadStatus);
    try {
      // Backend force-assigns the lead to the logged-in tele executive.
      const created = await leadApi.create({
        customer_name: form.customer_name.trim(),
        mobile_number: form.mobile_number.trim(),
        ivrs_number: form.ivrs_number.trim(),
        alternate_number: form.alternate_number.trim(),
        email: form.email.trim(),
        project_name: form.project_name.trim() || (form.estimated_capacity ? `${form.estimated_capacity}kW Rooftop Solar` : ''),
        project_type: form.project_type,
        estimated_capacity: form.estimated_capacity,
        source: form.source,
        priority: form.priority,
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        requirement_details: form.requirement_details.trim(),
        remarks: form.remarks.trim(),
        status,
      });
      // Hot/Cool live on category, which the create endpoint doesn't accept.
      if (created?.id && category) {
        await leadApi.update(created.id, { status, category });
      }
      // Optional first follow-up schedule (also sets the lead's next_follow_up).
      if (created?.id && form.nextDate) {
        await followUpApi.create({
          lead: created.id,
          follow_up_type: 'Call',
          scheduled_at: new Date(`${form.nextDate}T${form.nextTime || '10:00'}`).toISOString(),
          status: 'Scheduled',
          notes: 'First follow-up for new lead.',
          reminder: form.reminder === 'No reminder' ? '' : form.reminder,
        });
      }
      onNotify('Lead created.', 'success');
      onSaved();
    } catch (err) {
      onNotify(err.message || 'Could not create lead.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <TeleModal title="Add New Lead" onClose={onClose} wide>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TeleField label="Customer Name *">
            <input type="text" value={form.customer_name} onChange={(e) => updateField('customer_name', e.target.value)} placeholder="Full name" className={teleInputClass} />
          </TeleField>
          <TeleField label="Mobile Number *">
            <input type="text" value={form.mobile_number} onChange={(e) => updateField('mobile_number', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile" className={teleInputClass} />
          </TeleField>
          <TeleIvrsVerifyField
            value={form.ivrs_number}
            onChange={(value) => updateField('ivrs_number', value)}
            checking={ivrsCheck.checking}
            result={ivrsCheck.result}
            onCheck={ivrsCheck.check}
            onReset={ivrsCheck.reset}
          />
          <TeleField label="Alternate Number">
            <input type="text" value={form.alternate_number} onChange={(e) => updateField('alternate_number', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="Optional" className={teleInputClass} />
          </TeleField>
          <TeleField label="Email Address">
            <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder="Optional" className={teleInputClass} />
          </TeleField>
          <TeleField label="Project Type">
            <select value={form.project_type} onChange={(e) => updateField('project_type', e.target.value)} className={teleInputClass}>
              {['On-Grid', 'Off-Grid', 'Hybrid'].map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </TeleField>
          <TeleField label="Estimated Capacity (kW)">
            <input type="text" value={form.estimated_capacity} onChange={(e) => updateField('estimated_capacity', e.target.value.replace(/[^\d.]/g, ''))} placeholder="e.g. 5" className={teleInputClass} />
          </TeleField>
          <TeleField label="Project Name">
            <input type="text" value={form.project_name} onChange={(e) => updateField('project_name', e.target.value)} placeholder="Auto-filled from capacity if empty" className={teleInputClass} />
          </TeleField>
          <TeleField label="Lead Source">
            <select value={form.source} onChange={(e) => updateField('source', e.target.value)} className={teleInputClass}>
              {LEAD_SOURCES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </TeleField>
          <TeleField label="Priority">
            <select value={form.priority} onChange={(e) => updateField('priority', e.target.value)} className={teleInputClass}>
              {['High', 'Medium', 'Low'].map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </TeleField>
          <TeleField label="City">
            <input type="text" value={form.city} onChange={(e) => updateField('city', e.target.value)} placeholder="e.g. Indore" className={teleInputClass} />
          </TeleField>
          <TeleField label="State">
            <input type="text" value={form.state} onChange={(e) => updateField('state', e.target.value)} className={teleInputClass} />
          </TeleField>
          <TeleField label="Address">
            <input type="text" value={form.address} onChange={(e) => updateField('address', e.target.value)} placeholder="House no., area, landmark" className={teleInputClass} />
          </TeleField>
        </div>

        <TeleField label="Requirement Details">
          <textarea
            value={form.requirement_details}
            onChange={(e) => updateField('requirement_details', e.target.value)}
            rows={2}
            placeholder="What does the customer need? Monthly bill, roof size, etc."
            className="w-full rounded-[9px] border border-[#dbe4f0] bg-white px-3 py-2.5 text-[14px] font-semibold text-[#1f2d44] outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </TeleField>

        <TeleField label="Remarks">
          <textarea
            value={form.remarks}
            onChange={(e) => updateField('remarks', e.target.value)}
            rows={2}
            placeholder="First conversation notes..."
            className="w-full rounded-[9px] border border-[#dbe4f0] bg-white px-3 py-2.5 text-[14px] font-semibold text-[#1f2d44] outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </TeleField>

        <TeleField label="Lead Status">
          <div className="flex flex-wrap gap-2">
            {TELE_LEAD_STATUSES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => updateField('leadStatus', option)}
                className={cx(
                  'rounded-full border px-4 py-2 text-[12px] font-extrabold transition',
                  form.leadStatus === option
                    ? 'border-[#1d4ed8] bg-[#1d4ed8] text-white'
                    : 'border-[#dbe4f0] bg-white text-[#53647f] hover:bg-[#f8fbff]',
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </TeleField>

        <div className="grid gap-4 sm:grid-cols-3">
          <TeleField label="First Follow-up Date">
            <input type="date" value={form.nextDate} min={todayIso} onChange={(e) => updateField('nextDate', e.target.value)} className={teleInputClass} />
          </TeleField>
          <TeleField label="First Follow-up Time">
            <input type="time" value={form.nextTime} onChange={(e) => updateField('nextTime', e.target.value)} className={teleInputClass} />
          </TeleField>
          <TeleReminderField value={form.reminder} onChange={(value) => updateField('reminder', value)} />
        </div>

        <div className="flex justify-end gap-2.5 border-t border-[#edf2f8] pt-4">
          <button type="button" onClick={onClose} className="h-11 rounded-[9px] border border-[#dbe4f0] px-4 text-[13px] font-extrabold text-[#53647f] transition hover:bg-[#f8fbff]">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-[9px] bg-[#1d4ed8] px-5 text-[13px] font-extrabold text-white transition hover:bg-[#1a3fb0] disabled:opacity-60">
            <Plus className="size-4" />
            {saving ? 'Saving...' : 'Create Lead'}
          </button>
        </div>
      </form>
    </TeleModal>
  );
}

// ─── Lead edit modal ──────────────────────────────────────────────────────────

function TeleLeadEditModal({ lead, onClose, onSaved, onNotify }) {
  const [form, setForm] = useState({
    customer_name: lead.customer_name || '',
    // CRM-side lead forms allow formatted numbers ("+91 98765 43210") —
    // normalize to the 10-digit core so editing such leads isn't blocked.
    mobile_number: String(lead.mobile_number || '').replace(/\D/g, '').slice(-10),
    project_name: lead.project_name || '',
    project_type: lead.project_type || '',
    remarks: lead.remarks || '',
    leadStatus: teleDisplayStatus(lead),
  });
  const [saving, setSaving] = useState(false);

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.customer_name.trim()) { onNotify('Customer name is required.', 'error'); return; }
    if (!/^\d{10}$/.test(form.mobile_number.trim())) { onNotify('Mobile number must be 10 digits.', 'error'); return; }
    setSaving(true);
    try {
      await leadApi.update(lead.id, {
        customer_name: form.customer_name.trim(),
        mobile_number: form.mobile_number.trim(),
        project_name: form.project_name.trim(),
        project_type: form.project_type,
        remarks: form.remarks,
        ...mapTeleStatusToApi(form.leadStatus),
      });
      onNotify('Lead updated.', 'success');
      onSaved();
    } catch (err) {
      onNotify(err.message || 'Could not update lead.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <TeleModal title={`Edit Lead — ${lead.customer_name}`} onClose={onClose} wide>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TeleField label="Customer Name">
            <input type="text" value={form.customer_name} onChange={(e) => updateField('customer_name', e.target.value)} className={teleInputClass} />
          </TeleField>
          <TeleField label="Mobile Number">
            <input type="text" value={form.mobile_number} onChange={(e) => updateField('mobile_number', e.target.value.replace(/\D/g, '').slice(0, 10))} className={teleInputClass} />
          </TeleField>
          <TeleField label="Project Name">
            <input type="text" value={form.project_name} onChange={(e) => updateField('project_name', e.target.value)} className={teleInputClass} />
          </TeleField>
          <TeleField label="Project Type">
            <select value={form.project_type} onChange={(e) => updateField('project_type', e.target.value)} className={teleInputClass}>
              <option value="">Select type...</option>
              {['On-Grid', 'Off-Grid', 'Hybrid'].map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </TeleField>
        </div>

        <TeleField label="Remarks">
          <textarea
            value={form.remarks}
            onChange={(e) => updateField('remarks', e.target.value)}
            rows={3}
            placeholder="Notes about this lead..."
            className="w-full rounded-[9px] border border-[#dbe4f0] bg-white px-3 py-2.5 text-[14px] font-semibold text-[#1f2d44] outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </TeleField>

        <TeleField label="Lead Status">
          <div className="flex flex-wrap gap-2">
            {TELE_LEAD_STATUSES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => updateField('leadStatus', option)}
                className={cx(
                  'rounded-full border px-4 py-2 text-[12px] font-extrabold transition',
                  form.leadStatus === option
                    ? 'border-[#1d4ed8] bg-[#1d4ed8] text-white'
                    : 'border-[#dbe4f0] bg-white text-[#53647f] hover:bg-[#f8fbff]',
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </TeleField>

        <div className="flex justify-end gap-2.5 border-t border-[#edf2f8] pt-4">
          <button type="button" onClick={onClose} className="h-11 rounded-[9px] border border-[#dbe4f0] px-4 text-[13px] font-extrabold text-[#53647f] transition hover:bg-[#f8fbff]">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="h-11 rounded-[9px] bg-[#1d4ed8] px-5 text-[13px] font-extrabold text-white transition hover:bg-[#1a3fb0] disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </TeleModal>
  );
}
