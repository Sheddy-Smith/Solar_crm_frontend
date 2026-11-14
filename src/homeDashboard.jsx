/**
 * Desktop Home Dashboard — matches Malwa Solar CRM design mockup:
 * 6 KPI cards, Follow-up Status donut, 7-day trend, employee missed,
 * Today / High Alert lists, Recent Leads, chevron workflow, Quick Actions.
 */
import { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  CalendarDays,
  CalendarX2,
  ClipboardPlus,
  FilePlus2,
  Phone,
  PhoneCall,
  Plus,
  Trophy,
  Users,
} from 'lucide-react';
import {
  Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  followUpAgeLabel,
  followUpOwnershipLabel,
  formatDateTime,
  splitFollowUpAlerts,
} from './telePortal.jsx';

const CARD = 'rounded-[14px] border border-[#e2e9f3] bg-white shadow-[0_8px_22px_rgba(24,48,87,0.06)]';

const DONUT_COLORS = {
  Completed: '#16a34a',
  Pending: '#f59e0b',
  'High Alert': '#ef4444',
  Overdue: '#7c3aed',
  Missed: '#f97316',
};

const STATUS_BADGE = {
  New: 'bg-[#e8f2ff] text-[#0b65e5]',
  'Follow-up': 'bg-[#fff3df] text-[#d97706]',
  Quotation: 'bg-[#f3edff] text-[#7c3aed]',
  Won: 'bg-[#e9f8ec] text-[#0d9f4a]',
  Lost: 'bg-[#ffe9e6] text-[#e11d48]',
};

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function startOfLocalDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatTimeAmPm(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function phoneHref(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  return text.startsWith('+') ? `tel:${text.replace(/[^\d+]/g, '')}` : `tel:${text.replace(/\D/g, '')}`;
}

function buildSevenDayTrend(rows) {
  const days = [];
  const today = startOfLocalDay();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({
      key,
      label: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      count: 0,
    });
  }
  const index = new Map(days.map((row, i) => [row.key, i]));
  (rows || []).forEach((item) => {
    const when = new Date(item.scheduled_at || item.completed_at || item.created_at);
    if (Number.isNaN(when.getTime())) return;
    const key = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`;
    const idx = index.get(key);
    if (idx != null) days[idx].count += 1;
  });
  return days;
}

function KpiCard({ title, value, delta, tone, icon: Icon, onClick }) {
  const tones = {
    green: { card: 'border-[#d7f2df]', icon: 'bg-[#e8f8eb] text-[#0d9f4a]', delta: 'text-[#0d9f4a]' },
    blue: { card: 'border-[#dbeafe]', icon: 'bg-[#e8f2ff] text-[#0b65e5]', delta: 'text-[#0b65e5]' },
    red: { card: 'border-[#fecaca]', icon: 'bg-[#fef2f2] text-[#dc2626]', delta: 'text-[#dc2626]' },
    purple: { card: 'border-[#ddd6fe]', icon: 'bg-[#f5f3ff] text-[#7c3aed]', delta: 'text-[#7c3aed]' },
    orange: { card: 'border-[#fed7aa]', icon: 'bg-[#fff7ed] text-[#ea580c]', delta: 'text-[#ea580c]' },
  }[tone] || { card: 'border-[#e2e9f3]', icon: 'bg-[#f1f5f9] text-[#64748b]', delta: 'text-[#64748b]' };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(CARD, 'flex w-full items-start justify-between gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md', tones.card)}
    >
      <div className="min-w-0">
        <p className="text-[12px] font-bold text-[#7386a3]">{title}</p>
        <p className="mt-2 font-display text-[28px] font-extrabold leading-none text-[#1e3261]">{value}</p>
        {delta ? (
          <p className={cx('mt-2 inline-flex items-center gap-1 text-[11px] font-extrabold', tones.delta)}>
            <ArrowUpRight className="size-3.5" />
            {delta}
          </p>
        ) : null}
      </div>
      <span className={cx('grid size-11 shrink-0 place-items-center rounded-[12px]', tones.icon)}>
        <Icon className="size-5" />
      </span>
    </button>
  );
}

function FollowUpRow({ item, callTone = 'green', onCall, onLog, onView }) {
  const age = followUpAgeLabel(item.scheduled_at);
  const owner = item.lead_assigned_to_name || item.created_by_name || 'Unassigned';
  const href = phoneHref(item.lead_mobile_number);
  return (
    <article className="rounded-[12px] border border-[#edf2f8] bg-[#fbfdff] p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-extrabold text-[#1e3261]">{item.lead_customer_name || 'Lead'}</p>
          <p className="mt-1 text-[12px] font-semibold text-[#7386a3]">
            {[item.lead_mobile_number, formatTimeAmPm(item.scheduled_at), item.follow_up_type || 'Call'].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-1 text-[12px] font-semibold text-[#53647f]">
            Owner: {owner}
            {age ? ` · Pending ${age}` : ''}
          </p>
          {item.notes ? <p className="mt-1 line-clamp-2 text-[12px] font-medium text-[#64748b]">{item.notes}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onCall?.(item)}
            disabled={!href}
            className={cx(
              'inline-flex h-9 items-center gap-1.5 rounded-[8px] px-3 text-[12px] font-extrabold text-white disabled:opacity-40',
              callTone === 'red' ? 'bg-[#dc2626]' : 'bg-[#0d9f4a]',
            )}
          >
            <PhoneCall className="size-3.5" /> Call
          </button>
          <button type="button" onClick={() => onLog?.(item)} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#d9e4f2] bg-white px-3 text-[12px] font-extrabold text-[#284276]">
            <Phone className="size-3.5" /> Log
          </button>
          <button type="button" onClick={() => onView?.(item)} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#d9e4f2] bg-white px-3 text-[12px] font-extrabold text-[#284276]">
            View
          </button>
        </div>
      </div>
    </article>
  );
}

function WorkflowChevron({ stages, onStageClick }) {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-[720px] items-stretch">
        {stages.map((stage, idx) => {
          const countMatch = String(stage.status || '').match(/^(\d+)/);
          const count = countMatch ? countMatch[1] : '0';
          return (
            <button
              key={stage.title}
              type="button"
              onClick={() => onStageClick?.(stage.target)}
              className={cx(
                'relative flex min-h-[88px] flex-1 flex-col justify-center px-4 py-3 text-left text-white transition hover:brightness-105',
                stage.tone,
              )}
              style={{
                clipPath: idx === 0
                  ? 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)'
                  : idx === stages.length - 1
                    ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 14px 50%)'
                    : 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%)',
                marginLeft: idx === 0 ? 0 : -10,
                zIndex: stages.length - idx,
              }}
            >
              <p className="text-[12px] font-extrabold">{stage.title}</p>
              <p className="mt-1 text-[18px] font-extrabold leading-none">{count}</p>
              <p className="mt-1 text-[11px] font-bold opacity-90">{stage.progress}%</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * @param {object} props
 */
export function HomeDashboardPage({
  stats = [],
  leadStats = {},
  workflowStages = [],
  recentLeads = [],
  scheduledFollowUps = [],
  missedFollowUps = [],
  completedFollowUps = [],
  followUpsLoaded = false,
  onOpenSection,
  onQuickAction,
  onCallFollowUp,
  onLogFollowUp,
  onViewFollowUp,
  onViewLead,
  onRefresh,
}) {
  const split = useMemo(() => splitFollowUpAlerts(scheduledFollowUps), [scheduledFollowUps]);
  const todayRows = split.today;
  const overdueRows = split.overdue;
  const highAlertRows = useMemo(() => [...overdueRows, ...todayRows], [overdueRows, todayRows]);

  const missedCount = missedFollowUps.length;
  const completedCount = completedFollowUps.length;
  const pendingCount = split.today.length + split.upcoming.length;
  const highAlertCount = overdueRows.length + todayRows.length;
  const overdueCount = overdueRows.length;

  const kpiCards = useMemo(() => {
    const byTitle = Object.fromEntries((stats || []).map((s) => [s.title, s]));
    return [
      {
        title: 'Total Leads',
        value: byTitle['Total Leads']?.value ?? String(leadStats.total ?? '—'),
        delta: byTitle['Total Leads']?.delta || `${leadStats.created_in_period ?? 0} vs last month`,
        tone: 'green',
        icon: Users,
        onClick: () => onOpenSection?.('Lead List', 'Lead List opened'),
      },
      {
        title: 'Today Follow-ups',
        value: followUpsLoaded ? String(todayRows.length) : (byTitle['Today Follow-ups']?.value ?? '—'),
        delta: byTitle['Today Follow-ups']?.delta || `${todayRows.length} scheduled today`,
        tone: 'blue',
        icon: CalendarDays,
        onClick: () => onOpenSection?.('Follow-ups', "Today's follow-ups opened", null, 'today'),
      },
      {
        title: 'Won Leads',
        value: byTitle['Won Leads']?.value ?? String(leadStats.won ?? '—'),
        delta: byTitle['Won Leads']?.delta || `${leadStats.won_in_period ?? 0} this month`,
        tone: 'green',
        icon: Trophy,
        onClick: () => onOpenSection?.('Lead List', 'Won leads opened'),
      },
      {
        title: 'High Alert',
        value: followUpsLoaded ? String(highAlertCount) : (byTitle['High Alert']?.value ?? '—'),
        delta: 'Needs immediate action',
        tone: 'red',
        icon: AlertTriangle,
        onClick: () => onOpenSection?.('Follow-ups', 'High alert follow-ups opened', null, 'overdue'),
      },
      {
        title: 'Overdue',
        value: followUpsLoaded ? String(overdueCount) : (byTitle['Overdue']?.value ?? '—'),
        delta: 'Past scheduled date',
        tone: 'purple',
        icon: CalendarClock,
        onClick: () => onOpenSection?.('Follow-ups', 'Overdue follow-ups opened', null, 'overdue'),
      },
      {
        title: 'Missed',
        value: followUpsLoaded ? String(missedCount) : (byTitle['Missed']?.value ?? '—'),
        delta: 'Marked missed',
        tone: 'orange',
        icon: CalendarX2,
        onClick: () => onOpenSection?.('Follow-ups', 'Missed follow-ups opened', null, 'missed'),
      },
    ];
  }, [stats, leadStats, followUpsLoaded, todayRows.length, highAlertCount, overdueCount, missedCount, onOpenSection]);

  const donutData = useMemo(() => {
    const rows = [
      { name: 'Completed', value: completedCount },
      { name: 'Pending', value: pendingCount },
      { name: 'High Alert', value: highAlertCount },
      { name: 'Overdue', value: overdueCount },
      { name: 'Missed', value: missedCount },
    ].filter((r) => r.value > 0);
    return rows.length ? rows : [{ name: 'Pending', value: 1 }];
  }, [completedCount, pendingCount, highAlertCount, overdueCount, missedCount]);

  const totalFollowUps = completedCount + pendingCount + overdueCount + missedCount;
  // High Alert overlaps overdue+today; center shows meaningful total of tracked rows.
  const donutTotal = Math.max(totalFollowUps, highAlertCount + completedCount + missedCount);

  const trendData = useMemo(
    () => buildSevenDayTrend([...scheduledFollowUps, ...missedFollowUps, ...completedFollowUps]),
    [scheduledFollowUps, missedFollowUps, completedFollowUps],
  );

  const employeeMissed = useMemo(() => {
    const map = new Map();
    overdueRows.forEach((item) => {
      const name = followUpOwnershipLabel(item) || 'Unassigned';
      map.set(name, (map.get(name) || 0) + 1);
    });
    missedFollowUps.forEach((item) => {
      const name = followUpOwnershipLabel(item) || 'Unassigned';
      map.set(name, (map.get(name) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [overdueRows, missedFollowUps]);

  const quickActions = [
    { label: 'Fast Lead', solid: true, icon: Plus, target: 'Create Lead' },
    { label: 'Add Follow-up', solid: false, icon: ClipboardPlus, target: 'Lead List' },
    { label: 'Create Quotation', solid: false, icon: FilePlus2, target: 'Quotation' },
    { label: 'Follow-up Reports', solid: false, icon: BarChart3, target: 'Insights' },
  ];

  return (
    <div className="hidden space-y-4 md:block">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-extrabold text-[#1e3261]">Dashboard</h1>
          <p className="mt-1 text-[13px] font-semibold text-[#7386a3]">Live sales &amp; follow-up overview</p>
        </div>
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276]"
          >
            Refresh
          </button>
        ) : null}
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {kpiCards.map((card) => (
          <KpiCard key={card.title} {...card} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_1.1fr_0.95fr]">
        <article className={`${CARD} p-4`}>
          <h2 className="text-[15px] font-extrabold text-[#1e3261]">Follow-up Status</h2>
          <div className="mt-2 grid gap-3 sm:grid-cols-[160px_1fr] sm:items-center">
            <div className="relative mx-auto h-[160px] w-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
                    {donutData.map((entry) => (
                      <Cell key={entry.name} fill={DONUT_COLORS[entry.name] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v}`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div>
                  <p className="text-[20px] font-extrabold leading-none text-[#1e3261]">{followUpsLoaded ? donutTotal : '—'}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[#7386a3]">Total</p>
                </div>
              </div>
            </div>
            <ul className="space-y-2 text-[12px] font-semibold text-[#53647f]">
              {[
                ['Completed', completedCount],
                ['Pending', pendingCount],
                ['High Alert', highAlertCount],
                ['Overdue', overdueCount],
                ['Missed', missedCount],
              ].map(([label, value]) => {
                const pct = donutTotal ? ((value / donutTotal) * 100).toFixed(1) : '0.0';
                return (
                  <li key={label} className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: DONUT_COLORS[label] }} />
                      {label}
                    </span>
                    <span className="font-extrabold text-[#1e3261]">{value} <span className="font-bold text-[#94a3b8]">({pct}%)</span></span>
                  </li>
                );
              })}
            </ul>
          </div>
        </article>

        <article className={`${CARD} p-4`}>
          <h2 className="text-[15px] font-extrabold text-[#1e3261]">Follow-ups Trend (7 Days)</h2>
          <div className="mt-3 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} barSize={22}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7386a3', fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
                <Tooltip cursor={{ fill: 'rgba(13,159,74,0.08)' }} />
                <Bar dataKey="count" name="Follow-ups" fill="#16a34a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className={`${CARD} border-[#fecaca] bg-[#fff8f8] p-4`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-extrabold text-[#991b1b]">Employee-wise Missed Follow-ups</h2>
            <button
              type="button"
              onClick={() => onOpenSection?.('Follow-ups', 'Missed follow-ups opened', null, 'missed')}
              className="inline-flex items-center gap-1 text-[12px] font-extrabold text-[#b91c1c]"
            >
              View All <ArrowRight className="size-3.5" />
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {!followUpsLoaded ? (
              <p className="py-8 text-center text-[13px] font-semibold text-[#94a3b8]">Loading…</p>
            ) : employeeMissed.length === 0 ? (
              <p className="py-8 text-center text-[13px] font-semibold text-[#94a3b8]">No missed follow-ups</p>
            ) : (
              employeeMissed.map(([name, count], idx) => (
                <div key={name} className="flex items-center justify-between rounded-[10px] border border-[#fecaca] bg-white px-3 py-2.5">
                  <span className="text-[13px] font-extrabold text-[#7f1d1d]">
                    <span className="mr-2 text-[#b91c1c]">{idx + 1}.</span>
                    {name}
                  </span>
                  <span className="rounded-full bg-[#fee2e2] px-2.5 py-0.5 text-[12px] font-extrabold text-[#dc2626]">{count}</span>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className={`${CARD} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-[#fde68a] bg-[#fffbeb] px-4 py-3">
            <h2 className="text-[15px] font-extrabold text-[#92400e]">Today Follow-up ({todayRows.length})</h2>
            <button type="button" onClick={() => onOpenSection?.('Follow-ups', "Today's follow-ups opened", null, 'today')} className="text-[12px] font-extrabold text-[#0b65e5]">View All</button>
          </div>
          <div className="max-h-[320px] space-y-2.5 overflow-y-auto p-3.5">
            {!followUpsLoaded ? (
              <p className="py-8 text-center text-[13px] font-semibold text-[#94a3b8]">Loading…</p>
            ) : todayRows.length === 0 ? (
              <p className="py-8 text-center text-[13px] font-semibold text-[#94a3b8]">No follow-ups scheduled for today</p>
            ) : (
              todayRows.slice(0, 6).map((item) => (
                <FollowUpRow key={item.id} item={item} callTone="green" onCall={onCallFollowUp} onLog={onLogFollowUp} onView={onViewFollowUp} />
              ))
            )}
          </div>
        </article>

        <article className={`${CARD} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-[#fecaca] bg-[#fef2f2] px-4 py-3">
            <h2 className="text-[15px] font-extrabold text-[#991b1b]">High Alert Follow-ups ({highAlertCount})</h2>
            <button type="button" onClick={() => onOpenSection?.('Follow-ups', 'High alert opened', null, 'overdue')} className="text-[12px] font-extrabold text-[#0b65e5]">View All</button>
          </div>
          <div className="max-h-[320px] space-y-2.5 overflow-y-auto p-3.5">
            {!followUpsLoaded ? (
              <p className="py-8 text-center text-[13px] font-semibold text-[#94a3b8]">Loading…</p>
            ) : highAlertRows.length === 0 ? (
              <p className="py-8 text-center text-[13px] font-semibold text-[#94a3b8]">No high-alert follow-ups</p>
            ) : (
              highAlertRows.slice(0, 8).map((item) => (
                <FollowUpRow key={item.id} item={item} callTone="red" onCall={onCallFollowUp} onLog={onLogFollowUp} onView={onViewFollowUp} />
              ))
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_1.35fr]">
        <article className={`${CARD} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-[#edf2f8] px-4 py-3">
            <h2 className="text-[15px] font-extrabold text-[#1e3261]">Recent Leads</h2>
            <button type="button" onClick={() => onOpenSection?.('Lead List', 'All recent leads opened')} className="inline-flex items-center gap-1 text-[12px] font-extrabold text-[#0b65e5]">
              View All <ArrowRight className="size-3.5" />
            </button>
          </div>
          <div className="max-h-[340px] divide-y divide-[#edf2f8] overflow-y-auto">
            {(recentLeads || []).length === 0 ? (
              <p className="py-10 text-center text-[13px] font-semibold text-[#94a3b8]">No leads added yet</p>
            ) : (
              recentLeads.slice(0, 8).map((lead) => (
                <button
                  key={lead.id ?? `${lead.customer}-${lead.mobile}`}
                  type="button"
                  onClick={() => onViewLead?.(lead)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[#f8fbff]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-extrabold text-[#1e3261]">{lead.customer}</p>
                    <p className="mt-0.5 truncate text-[12px] font-semibold text-[#7386a3]">{lead.project || '—'}</p>
                  </div>
                  <span className={cx('shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase', STATUS_BADGE[lead.status] || 'bg-[#f1f5f9] text-[#64748b]')}>
                    {lead.status || 'New'}
                  </span>
                </button>
              ))
            )}
          </div>
        </article>

        <div className="space-y-4">
          <article className={`${CARD} p-4`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-[15px] font-extrabold text-[#1e3261]">Workflow — Lead to Installation</h2>
              <button type="button" onClick={() => onOpenSection?.('Project List', 'Project workflow opened')} className="text-[12px] font-extrabold text-[#0b65e5]">View All</button>
            </div>
            <WorkflowChevron stages={workflowStages} onStageClick={(target) => onOpenSection?.(target, `${target} opened`)} />
          </article>

          <article className={`${CARD} p-4`}>
            <h2 className="mb-3 text-[15px] font-extrabold text-[#1e3261]">Quick Actions</h2>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => onQuickAction?.(action)}
                    className={cx(
                      'inline-flex h-12 items-center justify-center gap-2 rounded-[10px] px-4 text-[13px] font-extrabold transition',
                      action.solid
                        ? 'bg-[#0d9f4a] text-white shadow-[0_10px_20px_rgba(13,159,74,0.25)] hover:bg-[#078c3e]'
                        : 'border border-[#d9e4f2] bg-white text-[#284276] hover:bg-[#f8fbff]',
                    )}
                  >
                    <Icon className="size-4" />
                    {action.solid ? `+ ${action.label}` : action.label.startsWith('+') ? action.label : action.label === 'Follow-up Reports' ? action.label : `+ ${action.label}`}
                  </button>
                );
              })}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

export default HomeDashboardPage;
