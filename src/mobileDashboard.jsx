// Mobile-app style dashboard (phone view) — mirrors the approved mockup:
// welcome banner, KPI grid, revenue card, leads trend, status donut,
// recent leads, quick actions, workflow strip, overdue/today follow-ups,
// top performers, pipeline overview + app-wide bottom tab navigation.
//
// Rendered only below the `md` breakpoint; the existing desktop dashboard
// stays untouched from `md` up.

import { useEffect, useMemo, useState } from 'react';
import {
  Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, ChevronRight, ClipboardList,
  ClipboardPlus, FilePlus2, FolderKanban, Home, IndianRupee, Menu, MoreHorizontal,
  Plus, UserPlus, Users,
} from 'lucide-react';
import { analyticsApi } from './api.js';

const cx = (...parts) => parts.filter(Boolean).join(' ');

const CARD = 'rounded-[16px] border border-[#e4ebf4] bg-white shadow-[0_6px_18px_rgba(21,43,83,0.06)]';

const STATUS_BADGE = {
  New: 'bg-[#e8f2ff] text-[#0b65e5]',
  'Follow-up': 'bg-[#fff3df] text-[#d97706]',
  Quotation: 'bg-[#f3edff] text-[#7c3aed]',
  Won: 'bg-[#e9f8ec] text-[#0d9f4a]',
  Lost: 'bg-[#ffe9e6] text-[#e11d48]',
};

const DONUT_COLORS = {
  New: '#0b65e5',
  'Follow-up': '#f59e0b',
  Quotation: '#8b5cf6',
  Won: '#16a34a',
  Lost: '#ef4444',
};

const FALLBACK_SPARK = [4, 6, 5, 8, 7, 10, 9, 12].map((v, i) => ({ i, v }));

function DeltaLine({ delta, tone }) {
  if (!delta) return null;
  const positive = tone === 'positive';
  const negative = tone === 'negative';
  const Icon = negative ? ArrowDownRight : ArrowUpRight;
  return (
    <p className={cx(
      'mt-1 flex items-center gap-1 text-[10px] font-bold',
      positive ? 'text-[#0d9f4a]' : negative ? 'text-[#e11d48]' : 'text-[#8895ab]',
    )}
    >
      {positive || negative ? <Icon className="size-3" /> : null}
      {delta}
    </p>
  );
}

function SectionCard({ title, action, onAction, children }) {
  return (
    <section className={`${CARD} p-4`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-extrabold text-[#1e3261]">{title}</h2>
        {action ? (
          <button type="button" onClick={onAction} className="flex items-center gap-1 text-[12px] font-extrabold text-[#0b65e5]">
            {action}
            <ArrowRight className="size-3.5" />
          </button>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function MobileDashboardPage({
  userName,
  rangeLabel,
  stats,
  workflowStages,
  recentLeads,
  overdue,
  followUps,
  projectSummary,
  onOpenSection,
  onQuickAction,
  onOpenMenu,
}) {
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    analyticsApi.leads().then((data) => {
      if (data) setAnalytics(data);
    }).catch(() => {});
  }, []);

  const kpis = (stats || []).filter((s) => s.title !== 'Revenue Overview');
  const revenue = (stats || []).find((s) => s.title === 'Revenue Overview');

  const trendData = useMemo(() => {
    const rows = analytics?.monthly_trend;
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.map((r) => ({ month: (r.month || '').split(' ')[0], leads: r.total ?? 0 }));
  }, [analytics]);

  const sparkData = trendData.length >= 2
    ? trendData.map((r, i) => ({ i, v: r.leads }))
    : FALLBACK_SPARK;

  const statusData = useMemo(() => {
    const rows = analytics?.status_distribution;
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((r) => (r.count ?? 0) > 0)
      .map((r) => ({ name: r.status, value: r.count, color: DONUT_COLORS[r.status] || '#64748b' }));
  }, [analytics]);
  const statusTotal = statusData.reduce((sum, r) => sum + r.value, 0);

  const topTeam = useMemo(() => {
    const rows = analytics?.employee_stats;
    if (!Array.isArray(rows)) return [];
    return rows.slice(0, 3).map((r, index) => ({
      rank: index + 1,
      name: r.name,
      initials: (r.name || 'NA').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase(),
      total: r.total ?? 0,
      progress: Math.min(100, Math.round(r.conversion ?? 0)),
    }));
  }, [analytics]);

  const rankTone = ['bg-[#0b65e5]', 'bg-[#7c3aed]', 'bg-[#0d9f4a]'];

  const quickActions = [
    { label: 'Fast Lead', icon: UserPlus, bg: 'from-[#f59e0b] to-[#fb923c]', target: 'Create Lead' },
    { label: 'Add Follow-up', icon: ClipboardPlus, bg: 'from-[#1578ff] to-[#0a9ff5]', target: 'Lead List' },
    { label: 'Create Quotation', icon: FilePlus2, bg: 'from-[#5242ef] to-[#6046eb]', target: 'Quotation' },
    { label: 'Add Project', icon: Plus, bg: 'from-[#0d9f4a] to-[#27d56f]', target: 'Project List' },
    { label: 'More', icon: MoreHorizontal, bg: 'from-[#0d9488] to-[#14b8a6]', more: true },
  ];

  const workflowStrip = [
    { label: 'Planning', count: projectSummary?.planning ?? 0, bg: 'bg-[#e8f2ff]', color: 'text-[#0b65e5]' },
    { label: 'Installation', count: projectSummary?.active ?? 0, bg: 'bg-[#f3edff]', color: 'text-[#7c3aed]' },
    { label: 'On Hold', count: projectSummary?.on_hold ?? 0, bg: 'bg-[#fff3df]', color: 'text-[#d97706]' },
    { label: 'Handover', count: projectSummary?.completed ?? 0, bg: 'bg-[#e9f8ec]', color: 'text-[#0d9f4a]' },
  ];

  const stageBarColor = {
    'Lead Captured': 'bg-[#0b65e5]',
    'Site Survey': 'bg-[#10b981]',
    'Quotation Sent': 'bg-[#f59e0b]',
    Installation: 'bg-[#64748b]',
    Handover: 'bg-[#475569]',
  };

  return (
    <div className="space-y-3 pb-20">
      {/* Welcome banner */}
      <section className="relative overflow-hidden rounded-[16px] bg-linear-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] p-4 text-white shadow-[0_12px_26px_rgba(29,78,216,0.28)]">
        <div className="pointer-events-none absolute -right-6 -top-8 size-28 rounded-full bg-white/10" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-10 right-10 size-24 rounded-full bg-white/10" aria-hidden="true" />
        <p className="text-[12px] font-bold text-white/85">Welcome back,</p>
        <h1 className="mt-0.5 font-display text-[20px] font-extrabold leading-tight">{userName} 👋</h1>
        {rangeLabel ? (
          <p className="mt-2.5 inline-flex items-center gap-2 rounded-[8px] bg-white/16 px-2.5 py-1.5 text-[11px] font-bold backdrop-blur-[2px]">
            <CalendarDays className="size-3.5" />
            {rangeLabel}
          </p>
        ) : null}
      </section>

      {/* KPI 2x2 grid */}
      <section className="grid grid-cols-2 gap-3">
        {kpis.map((stat) => {
          const Icon = stat.icon;
          return (
            <button
              key={stat.title}
              type="button"
              onClick={() => onOpenSection(stat.target, `${stat.title} opened`)}
              className={`${CARD} p-3.5 text-left`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-bold leading-4 text-[#7b88a2]">{stat.title}</p>
                <span className={cx('grid size-8 shrink-0 place-items-center rounded-[9px] bg-linear-to-br text-white', stat.iconBg)}>
                  <Icon className="size-4" />
                </span>
              </div>
              <p className="mt-1 font-display text-[22px] font-extrabold leading-none text-[#1e3261]">{stat.value}</p>
              <DeltaLine delta={stat.delta} tone={stat.deltaTone} />
            </button>
          );
        })}
      </section>

      {/* Revenue overview */}
      {revenue ? (
        <section className={`${CARD} p-4`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-[10px] bg-linear-to-br from-[#1578ff] to-[#0ea5ff] text-white">
                <IndianRupee className="size-4" />
              </span>
              <div>
                <p className="text-[11px] font-bold text-[#7b88a2]">Revenue Overview</p>
                <p className="font-display text-[20px] font-extrabold leading-tight text-[#1e3261]">{revenue.value}</p>
              </div>
            </div>
            <button type="button" onClick={() => onOpenSection(revenue.target, 'Revenue report opened')} className="text-[12px] font-extrabold text-[#0b65e5]">View Report</button>
          </div>
          <DeltaLine delta={revenue.delta} tone={revenue.deltaTone} />
          <div className="mt-2 h-[52px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="mobileRevSpark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#16a34a" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke="#16a34a" strokeWidth={2} fill="url(#mobileRevSpark)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      {/* Leads trend */}
      {trendData.length > 0 ? (
        <section className={`${CARD} p-4`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[14px] font-extrabold text-[#1e3261]">Leads Trend (Monthly)</h2>
            <span className="rounded-[8px] border border-[#e4ebf4] px-2.5 py-1 text-[11px] font-bold text-[#53647f]">This Year</span>
          </div>
          <div className="mt-3 h-[170px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 8, right: 6, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="mobileLeadsTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 700, fill: '#8895ab' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: '#8895ab' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e4ebf4', fontSize: 12, fontWeight: 700 }} />
                <Area type="monotone" dataKey="leads" name="Leads" stroke="#16a34a" strokeWidth={2.5} fill="url(#mobileLeadsTrend)" dot={{ r: 2.5, fill: '#16a34a' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      {/* Lead status distribution */}
      {statusData.length > 0 ? (
        <section className={`${CARD} p-4`}>
          <h2 className="text-[14px] font-extrabold text-[#1e3261]">Lead Status Distribution</h2>
          <div className="mt-2 flex items-center gap-3">
            <div className="relative h-[150px] w-[150px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={44} outerRadius={68} paddingAngle={2} strokeWidth={0}>
                    {statusData.map((row) => <Cell key={row.name} fill={row.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <p className="font-display text-[20px] font-extrabold leading-none text-[#1e3261]">{statusTotal}</p>
                  <p className="mt-0.5 text-[10px] font-bold text-[#8895ab]">Total</p>
                </div>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-1.5">
              {statusData.map((row) => (
                <li key={row.name} className="flex items-center justify-between gap-2 text-[11px] font-bold">
                  <span className="flex min-w-0 items-center gap-1.5 text-[#53647f]">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: row.color }} />
                    <span className="truncate">{row.name}</span>
                  </span>
                  <span className="shrink-0 text-[#1e3261]">
                    {row.value} ({statusTotal ? Math.round((row.value / statusTotal) * 1000) / 10 : 0}%)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* Recent leads */}
      <SectionCard title="Recent Leads" action="View All" onAction={() => onOpenSection('Lead List', 'All recent leads opened')}>
        {(recentLeads ?? []).length === 0 ? (
          <p className="py-4 text-center text-[12px] font-semibold text-[#8895ab]">No leads added yet</p>
        ) : (
          <ul className="divide-y divide-[#eef2f8]">
            {(recentLeads ?? []).slice(0, 5).map((lead, index) => (
              <li key={lead.id ?? `${lead.customer}-${index}`}>
                <button
                  type="button"
                  onClick={() => onOpenSection('Lead Details', `${lead.customer} lead opened`, lead)}
                  className="flex w-full items-center justify-between gap-2 py-2.5 text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-extrabold text-[#1e3261]">{lead.customer}</span>
                    <span className="block text-[11px] font-semibold text-[#8895ab]">{lead.mobile}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className={cx('rounded-full px-2 py-0.5 text-[10px] font-extrabold', STATUS_BADGE[lead.status] || 'bg-[#eef2f7] text-[#53647f]')}>
                      {lead.status}
                    </span>
                    <ChevronRight className="size-4 text-[#b9c4d6]" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Quick actions */}
      <section className={`${CARD} p-4`}>
        <h2 className="text-[14px] font-extrabold text-[#1e3261]">Quick Actions</h2>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                onClick={() => (action.more ? onOpenMenu() : onQuickAction(action))}
                className={cx('flex flex-col items-center justify-center gap-1 rounded-[12px] bg-linear-to-br px-1 py-2.5 text-white shadow-[0_8px_16px_rgba(22,65,145,0.16)]', action.bg)}
              >
                <Icon className="size-[16px]" />
                <span className="text-[9px] font-extrabold leading-[11px]">{action.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Project workflow strip */}
      <SectionCard title="Project Workflow" action="View All" onAction={() => onOpenSection('Project List', 'Project workflow opened')}>
        <div className="flex items-center justify-between gap-1">
          {workflowStrip.map((step, index) => (
            <div key={step.label} className="flex flex-1 items-center gap-1">
              <button type="button" onClick={() => onOpenSection('Project List', `${step.label} projects opened`)} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span className={cx('grid size-10 place-items-center rounded-[12px]', step.bg)}>
                  <FolderKanban className={cx('size-4', step.color)} />
                </span>
                <span className="text-[13px] font-extrabold leading-none text-[#1e3261]">{step.count}</span>
                <span className="text-[9px] font-bold text-[#8895ab]">{step.label}</span>
              </button>
              {index < workflowStrip.length - 1 ? <ChevronRight className="size-3.5 shrink-0 text-[#c4cede]" /> : null}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Overdue follow-ups */}
      {(overdue ?? []).length > 0 ? (
        <SectionCard title="Overdue Follow-ups" action="View All" onAction={() => onOpenSection('Lead List', 'All overdue follow-ups opened')}>
          <ul className="divide-y divide-[#eef2f8]">
            {(overdue ?? []).slice(0, 5).map((item, index) => (
              <li key={`${item.customer}-${index}`} className="flex items-center justify-between gap-2 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-extrabold text-[#1e3261]">{item.customer}</span>
                  <span className="block text-[11px] font-semibold text-[#8895ab]">{item.project}</span>
                </span>
                <span className="shrink-0 text-[11px] font-extrabold text-[#e11d48]">{item.delay}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {/* Today follow-ups */}
      <SectionCard title="Today Follow-ups" action="View All" onAction={() => onOpenSection('Lead List', 'All follow-ups opened')}>
        {(followUps ?? []).length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="grid size-14 place-items-center rounded-[16px] bg-[#eef4fd]">
              <CalendarDays className="size-6 text-[#9fb3d1]" />
            </span>
            <p className="text-[12px] font-semibold text-[#8895ab]">No follow-ups scheduled for today</p>
            <button
              type="button"
              onClick={() => onQuickAction({ label: 'Add Follow-up', target: 'Lead List' })}
              className="rounded-[10px] bg-[#0b65e5] px-5 py-2.5 text-[12px] font-extrabold text-white shadow-[0_8px_18px_rgba(11,101,229,0.3)]"
            >
              Add Follow-up
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-[#eef2f8]">
            {(followUps ?? []).slice(0, 5).map((item, index) => (
              <li key={`${item.customer}-${index}`} className="flex items-center justify-between gap-2 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-extrabold text-[#1e3261]">{item.customer}</span>
                  <span className="block text-[11px] font-semibold text-[#8895ab]">{item.project}</span>
                </span>
                <span className="shrink-0 text-[11px] font-extrabold text-[#d97706]">{item.date}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Top performing team */}
      {topTeam.length > 0 ? (
        <SectionCard title="Top Performing Team" action="View All" onAction={() => onOpenSection('Employee Details', 'Team performance opened')}>
          <ul className="space-y-3">
            {topTeam.map((member, index) => (
              <li key={member.name} className="flex items-center gap-3">
                <span className="w-3 shrink-0 text-[12px] font-extrabold text-[#8895ab]">{member.rank}</span>
                <span className={cx('grid size-9 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-white', rankTone[index] || 'bg-[#64748b]')}>
                  {member.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-extrabold text-[#1e3261]">{member.name}</span>
                  <span className="block text-[11px] font-semibold text-[#8895ab]">{member.total} Leads</span>
                </span>
                <span className="flex w-[92px] shrink-0 items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eef2f8]">
                    <span className="block h-full rounded-full bg-[#16a34a]" style={{ width: `${member.progress}%` }} />
                  </span>
                  <span className="text-[11px] font-extrabold text-[#0b65e5]">{member.progress}%</span>
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {/* Pipeline overview */}
      {(workflowStages ?? []).length > 0 ? (
        <SectionCard title="Pipeline Overview">
          <ul className="space-y-3.5">
            {(workflowStages ?? []).map((stage) => {
              const Icon = stage.icon || ClipboardList;
              return (
                <li key={stage.title}>
                  <button type="button" onClick={() => onOpenSection(stage.target, `${stage.title} opened`)} className="flex w-full items-center gap-3 text-left">
                    <span className={cx('grid size-9 shrink-0 place-items-center rounded-[10px]', stage.tone)}>
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-extrabold text-[#1e3261]">{stage.title}</span>
                        <span className="shrink-0 text-[11px] font-extrabold text-[#0b65e5]">{stage.progress}%</span>
                      </span>
                      <span className="mt-0.5 block text-[11px] font-semibold text-[#8895ab]">{stage.status}</span>
                      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[#eef2f8]">
                        <span className={cx('block h-full rounded-full', stageBarColor[stage.title] || 'bg-[#0b65e5]')} style={{ width: `${stage.progress}%` }} />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      ) : null}
    </div>
  );
}

const BOTTOM_NAV_ITEMS = [
  { label: 'Dashboard', icon: Home, section: 'Dashboard' },
  { label: 'Leads', icon: Users, section: 'Lead List' },
  { label: 'Follow-ups', icon: CalendarDays, section: 'Lead List', followUps: true },
  { label: 'Projects', icon: FolderKanban, section: 'Project List' },
  { label: 'More', icon: Menu, more: true },
];

export function MobileBottomNav({ activeSection, onNavigate, onMore }) {
  const activeLabel = (() => {
    if (activeSection === 'Dashboard') return 'Dashboard';
    if (activeSection?.startsWith('Lead') || activeSection === 'Admin Approval') return 'Leads';
    if (activeSection?.startsWith('Project')) return 'Projects';
    return null;
  })();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-60 border-t border-[#e4ebf4] bg-white/97 shadow-[0_-8px_24px_rgba(21,43,83,0.08)] backdrop-blur-[6px] md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.label === activeLabel;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => (item.more ? onMore() : onNavigate(item))}
              className={cx(
                'flex flex-col items-center gap-0.5 py-2 pb-[max(8px,env(safe-area-inset-bottom))] transition',
                active ? 'text-[#0d9f4a]' : 'text-[#7b88a2]',
              )}
            >
              <Icon className="size-[19px]" />
              <span className="text-[10px] font-extrabold">{item.label}</span>
              <span className={cx('h-[3px] w-8 rounded-full', active ? 'bg-[#0d9f4a]' : 'bg-transparent')} />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
