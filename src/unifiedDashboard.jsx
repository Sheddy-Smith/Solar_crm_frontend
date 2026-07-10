import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight, BarChart3, Bell, Boxes, Calendar, ChevronRight,
  ClipboardList, CreditCard, Download, FileText, Filter, FolderKanban, Gauge,
  Headphones, Heart, Hourglass, IndianRupee, Leaf, LineChart, Package,
  PackageMinus, PackageX, RefreshCw, Target, Ticket, TrendingUp, Trophy,
  UserPlus, Users, Wallet, Wrench, XCircle, ArrowLeftRight,
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, Cell, Legend, Line, LineChart as ReLineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { dashboardApi, userApi } from './api.js';
import { exportNotifyCsv } from './lib/utils.js';

const CARD = 'rounded-[12px] border border-[#e5eaf2] bg-white shadow-[0_2px_10px_rgba(24,48,87,0.05)]';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Gauge },
  { id: 'sales', label: 'Sales & Leads', icon: LineChart },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'finance', label: 'Finance', icon: BarChart3 },
  { id: 'alerts', label: 'Alerts', icon: Bell },
];

const STATUS_COLORS = {
  New: '#1f7ff0', 'Follow-up': '#6b55e9', Quotation: '#f8c64d', Won: '#16a34a', Lost: '#e44d4d',
};

function fmtRs(v) {
  if (v == null || v === '') return '—';
  return `Rs ${Number(v).toLocaleString('en-IN')}`;
}

function formatReportDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function defaultDateRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  // Format in local time — toISOString() shifts IST dates back a day.
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: iso(from), to: iso(to) };
}

function normalizeUsers(data) {
  if (!data) return [];
  return Array.isArray(data) ? data : data.results ?? [];
}

function kpiFromReports(reports, title) {
  return reports?.kpis?.find((k) => k.title === title)?.value ?? '0';
}

// The API only returns period totals (no time series), so this chart shows an
// even weekly split of the real totals — labelled as an estimate in the UI.
function buildCashFlowTrend(finance) {
  const received = Number(finance?.total_received || 0);
  const made = Number(finance?.total_made || 0);
  const net = Number(finance?.net_balance || 0);
  const labels = ['W1', 'W2', 'W3', 'W4'];
  return labels.map((label) => ({
    label,
    inflow: Math.round(received / labels.length),
    outflow: Math.round(made / labels.length),
    net: Math.round(net / labels.length),
  }));
}

function InsightsHeader({ onOpenSection, onExport, onIncentive }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-[#0d9f4a] text-white shadow-[0_6px_14px_rgba(13,159,74,0.28)]">
          <BarChart3 className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-[22px] font-extrabold leading-tight text-[#1e3261]">Business Insights</h1>
          <p className="mt-1 text-[13px] font-semibold">
            <button type="button" onClick={() => onOpenSection('Dashboard')} className="text-[#0b65e5] hover:underline">Dashboard</button>
            <span className="mx-1.5 text-[#9aa8bc]">›</span>
            <span className="text-[#53647f]">Insights</span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onExport} className="inline-flex h-11 items-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276] shadow-[0_4px_12px_rgba(17,39,84,0.04)] transition hover:bg-[#f8fbff]">
          <Download className="size-4 text-[#53647f]" />
          Export Report
        </button>
        <button type="button" onClick={onIncentive} className="inline-flex h-11 items-center gap-2 rounded-[8px] bg-[#0d9f4a] px-4 text-[13px] font-extrabold text-white shadow-[0_8px_18px_rgba(13,159,74,0.28)] transition hover:bg-[#078c3e]">
          <Trophy className="size-4" />
          Generate Incentive Report
        </button>
      </div>
    </div>
  );
}

export const LEAD_STATUS_FILTER_OPTIONS = ['All', 'New', 'Follow-up', 'Quotation', 'Won', 'Lost'];

function FilterBar({ dateFrom, dateTo, projectType, leadStatus, assignedTo, assigneeOptions, formattedRange, onFrom, onTo, onProjectType, onLeadStatus, onAssignedTo, onApply }) {
  return (
    <section className={`${CARD} p-4 sm:p-5`}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'From', el: <input type="date" className="h-11 w-full rounded-[8px] border border-[#d9e2ec] px-3 text-[13px] font-semibold text-[#30466d]" value={dateFrom} onChange={(e) => onFrom(e.target.value)} /> },
          { label: 'To', el: <input type="date" className="h-11 w-full rounded-[8px] border border-[#d9e2ec] px-3 text-[13px] font-semibold text-[#30466d]" value={dateTo} onChange={(e) => onTo(e.target.value)} /> },
          { label: 'Project Type', el: <select className="h-11 w-full rounded-[8px] border border-[#d9e2ec] px-3 text-[13px] font-semibold text-[#30466d]" value={projectType} onChange={(e) => onProjectType(e.target.value)}>{['All', 'On-Grid', 'Off-Grid', 'Hybrid'].map((o) => <option key={o}>{o}</option>)}</select> },
          { label: 'Lead Status', el: <select className="h-11 w-full rounded-[8px] border border-[#d9e2ec] px-3 text-[13px] font-semibold text-[#30466d]" value={leadStatus} onChange={(e) => onLeadStatus(e.target.value)}>{LEAD_STATUS_FILTER_OPTIONS.map((o) => <option key={o}>{o}</option>)}</select> },
          { label: 'Assigned To', el: <select className="h-11 w-full rounded-[8px] border border-[#d9e2ec] px-3 text-[13px] font-semibold text-[#30466d]" value={assignedTo} onChange={(e) => onAssignedTo(e.target.value)}>{assigneeOptions.map((o) => <option key={o}>{o}</option>)}</select> },
        ].map((f) => (
          <label key={f.label} className="block text-[12px] font-bold text-[#53647f]">
            {f.label}
            <div className="mt-1.5">{f.el}</div>
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button type="button" onClick={onApply} className="inline-flex h-11 min-w-[160px] items-center justify-center gap-2 rounded-[8px] bg-[#0d9f4a] px-5 text-[13px] font-extrabold text-white shadow-[0_10px_20px_rgba(13,159,74,0.22)] transition hover:bg-[#078c3e]">
          <Filter className="size-4" />
          Apply Filters
        </button>
        <p className="flex items-center gap-2 text-[13px] font-bold text-[#0d9f4a]">
          <Calendar className="size-4" />
          Active range: {formattedRange}
        </p>
      </div>
    </section>
  );
}

function TabNav({ tab, alertCount, onTab }) {
  return (
    <nav className="flex flex-wrap gap-1 border-b border-[#e5eaf2]">
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = tab === t.id;
        const alertStyle = t.id === 'alerts' && active;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onTab(t.id)}
            className={`relative inline-flex items-center gap-2 px-4 py-3 text-[13px] font-extrabold transition ${
              alertStyle
                ? 'rounded-[8px] border border-[#0d9f4a] text-[#0d9f4a]'
                : active
                  ? 'text-[#0d9f4a]'
                  : 'text-[#7a8fa6] hover:text-[#53647f]'
            }`}
          >
            <Icon className={`size-4 ${active ? 'text-[#0d9f4a]' : 'text-[#9aa8bc]'}`} />
            {t.label}
            {t.id === 'alerts' && alertCount > 0 ? (
              <span className="ml-0.5 grid size-5 place-items-center rounded-full bg-[#ef4444] text-[10px] font-extrabold text-white">{alertCount}</span>
            ) : null}
            {active && !alertStyle ? <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-t-full bg-[#0d9f4a]" /> : null}
          </button>
        );
      })}
    </nav>
  );
}

function KpiCard({ label, value, caption, icon: Icon, iconBg, iconColor, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`${CARD} flex w-full items-start justify-between gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md`}>
      <div className="min-w-0">
        <p className="text-[12px] font-bold text-[#7a8fa6]">{label}</p>
        <p className="mt-2 text-[24px] font-extrabold leading-none text-[#1e3261]">{value}</p>
        {caption ? <p className="mt-2 text-[11px] font-bold text-[#53647f]">{caption}</p> : null}
      </div>
      <span className={`grid size-11 shrink-0 place-items-center rounded-full ${iconBg}`}>
        <Icon className={`size-5 ${iconColor}`} />
      </span>
    </button>
  );
}

function HorizontalKpiCard({ label, value, icon: Icon, iconBg, iconColor, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`${CARD} flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-[#f8fbff]`}>
      <div className="flex items-center gap-3">
        <span className={`grid size-10 place-items-center rounded-[10px] ${iconBg}`}>
          <Icon className={`size-5 ${iconColor}`} />
        </span>
        <p className="text-[13px] font-extrabold text-[#1e3261]">{label}</p>
      </div>
      <p className="text-[28px] font-extrabold leading-none text-[#1e3261]">{value}</p>
    </button>
  );
}

function QuickActionBtn({ label, icon: Icon, iconBg, iconColor, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`${CARD} flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-[#f8fbff]`}>
      <div className="flex items-center gap-3">
        <span className={`grid size-10 place-items-center rounded-[10px] ${iconBg}`}>
          <Icon className={`size-5 ${iconColor}`} />
        </span>
        <span className="text-[14px] font-extrabold text-[#1e3261]">{label}</span>
      </div>
      <ChevronRight className="size-5 text-[#b9c4d6]" />
    </button>
  );
}

function FinanceCard({ label, value, caption, icon: Icon, iconBg, iconColor, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`${CARD} flex w-full items-center gap-4 p-4 text-left transition hover:bg-[#f8fbff]`}>
      <span className={`grid size-12 shrink-0 place-items-center rounded-full ${iconBg}`}>
        <Icon className={`size-5 ${iconColor}`} />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-bold text-[#7a8fa6]">{label}</p>
        <p className="mt-1 text-[22px] font-extrabold leading-tight text-[#1e3261]">{value}</p>
        {caption ? <p className="mt-1 text-[11px] font-bold text-[#53647f]">{caption}</p> : null}
      </div>
    </button>
  );
}

function AlertCard({ label, value, icon: Icon, iconBg, iconColor, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`${CARD} flex w-full items-center gap-4 p-4 text-left transition hover:bg-[#fafbff]`}>
      <span className={`grid size-12 shrink-0 place-items-center rounded-[10px] ${iconBg}`}>
        <Icon className={`size-6 ${iconColor}`} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-extrabold text-[#1e3261]">{label}</p>
        <p className="text-[12px] font-semibold text-[#7a8fa6]">Needs attention</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[28px] font-extrabold leading-none text-[#ef4444]">{value}</span>
        <ChevronRight className="size-5 text-[#c5d0e0]" />
      </div>
    </button>
  );
}

function StatStrip({ items }) {
  return (
    <div className={`${CARD} grid grid-cols-2 divide-x divide-[#e7eef7] sm:grid-cols-5`}>
      {items.map((item) => (
        <div key={item.label} className="px-4 py-4 text-center">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#7a8fa6]">{item.label}</p>
          <p className="mt-1 text-[22px] font-extrabold text-[#1e3261]">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function LeadsTrendChart({ data }) {
  const chartData = data?.length ? data : [{ month: '—', new: 0, follow_up: 0, won: 0 }];
  return (
    <div className="mt-4 h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <ReLineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#edf2f8" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 700, fill: '#7a8fa6' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: '#7a8fa6' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #dbe5f2', fontSize: 12, fontWeight: 700 }} />
          <Legend iconType="diamond" iconSize={8} wrapperStyle={{ fontSize: 12, fontWeight: 700, paddingTop: 12 }} />
          <Line type="monotone" dataKey="follow_up" name="Follow-up" stroke="#6b55e9" strokeWidth={2} dot={{ r: 3, fill: '#6b55e9' }} />
          <Line type="monotone" dataKey="new" name="New" stroke="#1f7ff0" strokeWidth={2} dot={{ r: 3, fill: '#1f7ff0' }} />
          <Line type="monotone" dataKey="won" name="Won" stroke="#16a34a" strokeWidth={2} dot={{ r: 4, fill: '#16a34a' }} />
        </ReLineChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatusDonut({ data }) {
  const chartData = (data || []).map((d) => ({ name: d.status, value: d.count, color: STATUS_COLORS[d.status] || '#6b55e9' }));
  const total = chartData.reduce((s, d) => s + d.value, 0);
  return (
    <div className="mt-4 flex flex-col items-center gap-4 md:flex-row md:items-center">
      <div className="h-[200px] w-[200px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData.length ? chartData : [{ name: '—', value: 1, color: '#e5eaf2' }]} cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={2} dataKey="value">
              {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="w-full flex-1 space-y-2">
        {chartData.map((item) => (
          <div key={item.name} className="flex items-center justify-between rounded-[8px] px-2 py-1.5">
            <span className="flex items-center gap-2 text-[13px] font-bold text-[#1e3261]">
              <span className="size-2.5 rounded-[2px]" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="text-[13px] font-extrabold text-[#314a79]">
              {item.value} ({total ? ((item.value / total) * 100).toFixed(1) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CashFlowTrendChart({ data }) {
  return (
    <div className="mt-4 h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="inflowFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#16a34a" stopOpacity={0.2} /><stop offset="95%" stopColor="#16a34a" stopOpacity={0} /></linearGradient>
            <linearGradient id="outflowFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
            <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1f7ff0" stopOpacity={0.15} /><stop offset="95%" stopColor="#1f7ff0" stopOpacity={0} /></linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#edf2f8" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7a8fa6' }} />
          <YAxis tick={{ fontSize: 11, fill: '#7a8fa6' }} tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} />
          <Tooltip formatter={(v) => fmtRs(v)} />
          <Legend />
          <Area type="monotone" dataKey="inflow" name="Cash Inflow" stroke="#16a34a" fill="url(#inflowFill)" strokeWidth={2} />
          <Area type="monotone" dataKey="outflow" name="Cash Outflow" stroke="#ef4444" fill="url(#outflowFill)" strokeWidth={2} />
          <Area type="monotone" dataKey="net" name="Net Cash Flow" stroke="#1f7ff0" fill="url(#netFill)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function CashFlowDonut({ finance }) {
  const received = Number(finance?.total_received || 0);
  const made = Number(finance?.total_made || 0);
  const net = Number(finance?.net_balance || 0);
  const total = received + made + Math.abs(net) || 1;
  const chartData = [
    { name: 'Total Received', value: received, color: '#16a34a', pct: ((received / total) * 100).toFixed(1) },
    { name: 'Total Paid Out', value: made, color: '#ef4444', pct: ((made / total) * 100).toFixed(1) },
    { name: 'Net Cash Flow', value: Math.abs(net), color: '#1f7ff0', pct: ((Math.abs(net) / total) * 100).toFixed(1) },
  ];
  return (
    <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center">
      <div className="mx-auto h-[220px] w-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" label={({ percent }) => `${(percent * 100).toFixed(1)}%`}>
              {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-3">
        {chartData.map((row) => (
          <div key={row.name} className="flex items-start gap-3">
            <span className="mt-1 size-3 rounded-[2px]" style={{ backgroundColor: row.color }} />
            <div>
              <p className="text-[13px] font-extrabold text-[#1e3261]">{row.name}</p>
              <p className="text-[12px] font-bold text-[#53647f]">{fmtRs(row.value)} ({row.pct}%)</p>
            </div>
          </div>
        ))}
        <p className="pt-2 text-right text-[11px] font-bold text-[#9aa8bc]">All amounts in INR</p>
      </div>
    </div>
  );
}

function DataTableCard({ title, headers, rows, actionLabel, onAction }) {
  return (
    <article className={`${CARD} flex h-full flex-col p-4 sm:p-5`}>
      <h2 className="font-display text-[16px] font-extrabold text-[#111827]">{title}</h2>
      <div className="mt-4 flex-1 overflow-auto rounded-[10px] border border-[#e7eef7]">
        <table className="crm-table w-full min-w-[280px]">
          <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.length ? rows.map((row) => (
              <tr key={row[0]}>{row.map((cell, i) => <td key={i} className={i === 0 ? 'font-extrabold text-[#1e3261]' : undefined}>{cell}</td>)}</tr>
            )) : (
              <tr><td colSpan={headers.length} className="py-8 text-center text-[#8a98af]">No data</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={onAction} className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-[8px] bg-[#0d9f4a] text-[13px] font-extrabold text-white transition hover:bg-[#078c3e]">
        {actionLabel}
      </button>
    </article>
  );
}

function MisIntelligenceCard({ sales, onNotify }) {
  const rows = [
    ['Total Leads (period)', String(sales?.total ?? 0)],
    ['Conversion Rate', `${sales?.conversion_rate ?? 0}%`],
    ['Won Leads', String(sales?.won ?? 0)],
  ];
  return (
    <article className={`${CARD} flex h-full flex-col p-4 sm:p-5`}>
      <h2 className="flex items-center gap-2 font-display text-[16px] font-extrabold text-[#111827]">
        <span className="grid size-8 place-items-center rounded-[8px] bg-[#dcfce7] text-[#0d9f4a]"><BarChart3 className="size-4" /></span>
        MIS Intelligence
      </h2>
      <div className="mt-4 flex-1 overflow-hidden rounded-[10px] border border-[#e7eef7] bg-white">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between border-b border-[#edf2f8] px-4 py-3 text-[13px] font-extrabold text-[#1e3261] last:border-b-0">
            <span>{label}</span>
            <span>{value}</span>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onNotify('MIS report opened')} className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-[8px] bg-[#0d9f4a] text-[13px] font-extrabold text-white transition hover:bg-[#078c3e]">
        View Report
      </button>
    </article>
  );
}

function InsightsFooter() {
  return (
    <footer className="flex flex-col gap-2 border-t border-[#e5eaf2] pt-4 text-[12px] font-semibold text-[#9aa8bc] sm:flex-row sm:items-center sm:justify-between">
      <p>© 2024 Malwa Solar CRM. All rights reserved.</p>
      <p className="flex items-center gap-1.5">
        Made with <Heart className="size-3.5 fill-[#0d9f4a] text-[#0d9f4a]" /> for a Sustainable Future <Leaf className="size-3.5 text-[#0d9f4a]" />
      </p>
    </footer>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className={`${CARD} flex items-center gap-3 p-6`}>
        <div className="size-6 rounded-full bg-[#e8eef6]" />
        <div className="space-y-2">
          <div className="h-4 w-48 rounded bg-[#e8eef6]" />
          <div className="h-3 w-72 rounded bg-[#e8eef6]" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className={`${CARD} h-28`} />)}
      </div>
      <p className="text-center text-[13px] font-bold text-[#7a8fa6]">Waking up server — first load may take up to a minute…</p>
    </div>
  );
}

const ALERT_DEFS = [
  { key: 'low_stock_items', label: 'Low Stock Items', section: 'Products', icon: PackageMinus, iconBg: 'bg-[#ffe4e6]', iconColor: 'text-[#f43f5e]' },
  { key: 'out_of_stock_items', label: 'Out of Stock', section: 'Stock Inward', icon: PackageX, iconBg: 'bg-[#ede9fe]', iconColor: 'text-[#8b5cf6]' },
  { key: 'expiring_amc', label: 'Expiring AMC', section: 'AMC Contracts', icon: Hourglass, iconBg: 'bg-[#ffedd5]', iconColor: 'text-[#f59e0b]' },
  { key: 'pending_tasks', label: 'Pending O&M Tasks', section: 'Maintenance Tasks', icon: Wrench, iconBg: 'bg-[#dbeafe]', iconColor: 'text-[#3b82f6]' },
  { key: 'open_om_tickets', label: 'Open O&M Tickets', section: 'Breakdown Tickets', icon: Ticket, iconBg: 'bg-[#dcfce7]', iconColor: 'text-[#16a34a]' },
  { key: 'pending_cheques', label: 'Pending Cheques', section: 'Cheques List', icon: FileText, iconBg: 'bg-[#fef9c3]', iconColor: 'text-[#ca8a04]' },
  { key: 'stale_stock_items', label: 'Stale Stock (15d+)', section: 'Stock Movements', icon: Boxes, iconBg: 'bg-[#fce7f3]', iconColor: 'text-[#ec4899]' },
];

export function UnifiedDashboardPage({
  activeTab,
  onTabChange,
  onOpenSection,
  onNotify,
  IncentiveReportModal,
}) {
  const defaults = useMemo(() => defaultDateRange(), []);
  const [tab, setTab] = useState(activeTab || 'overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [projectType, setProjectType] = useState('All');
  const [leadStatus, setLeadStatus] = useState('All');
  const [assignedTo, setAssignedTo] = useState('All');
  const [assigneeOptions, setAssigneeOptions] = useState(['All']);
  const [incentiveOpen, setIncentiveOpen] = useState(false);

  useEffect(() => {
    if (activeTab && activeTab !== tab) setTab(activeTab);
  }, [activeTab]);  

  useEffect(() => {
    userApi.list({ page_size: 500 })
      .then((d) => setAssigneeOptions(['All', ...new Set(normalizeUsers(d).map((u) => u.name).filter(Boolean))]))
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = { date_from: dateFrom, date_to: dateTo };
    if (projectType !== 'All') params.project_type = projectType;
    if (leadStatus !== 'All') params.status = leadStatus;
    if (assignedTo !== 'All') params.assigned_to = assignedTo;
    dashboardApi.unified(params)
      .then((res) => {
        if (res) {
          setData(res);
          setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
        }
      })
      .catch((e) => {
        setError(e.message || 'Could not load dashboard');
        onNotify(e.message || 'Could not load dashboard', 'error');
      })
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, projectType, leadStatus, assignedTo, onNotify]);

  useEffect(() => { load(); }, [load]);

  const setTabAndSync = (next) => {
    setTab(next);
    onTabChange?.(next);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', next);
      window.history.replaceState(window.history.state, '', `${url.pathname}?${url.searchParams.toString()}`);
    }
  };

  const overview = data?.overview;
  const sales = data?.sales;
  const projects = data?.projects;
  const finance = data?.finance;
  const alerts = data?.alerts;
  const reports = data?.reports;
  const kpi = projects?.kpi;
  const formattedRange = `${formatReportDate(dateFrom)} - ${formatReportDate(dateTo)}`;
  const cashFlowTrend = useMemo(() => buildCashFlowTrend(finance), [finance]);

  const alertCards = ALERT_DEFS.map((def) => ({
    ...def,
    value: Number(alerts?.[def.key] ?? 0),
  }));

  const alertBadgeCount = alertCards.filter((a) => a.value > 0).length;

  return (
    <div className="space-y-4">
      <InsightsHeader
        onOpenSection={onOpenSection}
        onExport={() => exportNotifyCsv(onNotify, 'insights-export', ['Metric', 'Value'], (reports?.kpis ?? []).map((k) => [k.title, k.value]))}
        onIncentive={() => setIncentiveOpen(true)}
      />

      <FilterBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        projectType={projectType}
        leadStatus={leadStatus}
        assignedTo={assignedTo}
        assigneeOptions={assigneeOptions}
        formattedRange={formattedRange}
        onFrom={setDateFrom}
        onTo={setDateTo}
        onProjectType={setProjectType}
        onLeadStatus={setLeadStatus}
        onAssignedTo={setAssignedTo}
        onApply={load}
      />

      <TabNav tab={tab} alertCount={alertBadgeCount} onTab={setTabAndSync} />

      {loading ? <DashboardSkeleton /> : error ? (
        <div className={`${CARD} p-10 text-center`}>
          <p className="text-[14px] font-bold text-[#dc2626]">{error}</p>
          <button type="button" onClick={load} className="mt-4 rounded-[8px] bg-[#0d9f4a] px-5 py-2.5 text-[13px] font-extrabold text-white">Retry</button>
        </div>
      ) : (
        <>
          {tab === 'overview' && overview ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[14px] font-bold text-[#324871]">Live business snapshot — sales, projects, finance, inventory and AMC in one place.</p>
                {lastUpdated ? (
                  <p className="flex items-center gap-2 text-[12px] font-bold text-[#0d9f4a]">
                    <RefreshCw className="size-3.5" />
                    Last Updated: {lastUpdated}
                  </p>
                ) : null}
              </div>

              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                <KpiCard label="Total Leads" value={sales?.total ?? 0} caption="Filtered period" icon={Users} iconBg="bg-[#dcfce7]" iconColor="text-[#16a34a]" onClick={() => onOpenSection('Lead List')} />
                <KpiCard label="Active Projects" value={overview.hero?.active_projects ?? 0} caption={`${overview.hero?.total_projects ?? 0} total`} icon={FolderKanban} iconBg="bg-[#dbeafe]" iconColor="text-[#3b82f6]" onClick={() => onOpenSection('Project List')} />
                <KpiCard label="Cash Received" value={fmtRs(overview.hero?.cash_received)} caption="Completed receipts" icon={IndianRupee} iconBg="bg-[#dcfce7]" iconColor="text-[#16a34a]" onClick={() => onOpenSection('Payment Received')} />
                <KpiCard label="Bank Balance" value={fmtRs(overview.hero?.bank_balance)} caption={`${overview.hero?.bank_count ?? 0} accounts`} icon={CreditCard} iconBg="bg-[#ede9fe]" iconColor="text-[#8b5cf6]" onClick={() => onOpenSection('Bank Accounts')} />
                <KpiCard label="Stock Value" value={fmtRs(overview.hero?.stock_value)} caption={`${overview.hero?.stock_items ?? 0} products`} icon={Boxes} iconBg="bg-[#ffedd5]" iconColor="text-[#f59e0b]" onClick={() => onOpenSection('Products')} />
                <KpiCard label="Active AMC" value={overview.hero?.active_amc ?? 0} caption={`${overview.amc?.open_service_requests ?? overview.hero?.open_amc_requests ?? 0} open renewals`} icon={Wallet} iconBg="bg-[#dbeafe]" iconColor="text-[#3b82f6]" onClick={() => onOpenSection('AMC Contracts')} />
              </section>

              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <HorizontalKpiCard label="Open O&M Tickets" value={overview.operations?.open_tickets ?? 0} icon={Headphones} iconBg="bg-[#dcfce7]" iconColor="text-[#16a34a]" onClick={() => onOpenSection('Breakdown Tickets')} />
                <HorizontalKpiCard label="Pending Tasks" value={overview.operations?.pending_tasks ?? 0} icon={ClipboardList} iconBg="bg-[#dbeafe]" iconColor="text-[#3b82f6]" onClick={() => onOpenSection('Maintenance Tasks')} />
                <HorizontalKpiCard label="Low Stock" value={overview.inventory?.low_stock ?? 0} icon={PackageMinus} iconBg="bg-[#ffedd5]" iconColor="text-[#f59e0b]" onClick={() => onOpenSection('Products')} />
                <HorizontalKpiCard label="Expiring AMC" value={overview.amc?.expiring_contracts ?? 0} icon={Calendar} iconBg="bg-[#ede9fe]" iconColor="text-[#8b5cf6]" onClick={() => onOpenSection('AMC Contracts')} />
              </section>

              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <QuickActionBtn label="New Lead" icon={UserPlus} iconBg="bg-[#dcfce7]" iconColor="text-[#16a34a]" onClick={() => onOpenSection('Create Lead')} />
                <QuickActionBtn label="Record Payment" icon={CreditCard} iconBg="bg-[#dbeafe]" iconColor="text-[#3b82f6]" onClick={() => onOpenSection('Payment Received')} />
                <QuickActionBtn label="Stock Inward" icon={Download} iconBg="bg-[#dcfce7]" iconColor="text-[#16a34a]" onClick={() => onOpenSection('Stock Inward')} />
                <QuickActionBtn label="O&M Tickets" icon={Wrench} iconBg="bg-[#ccfbf1]" iconColor="text-[#0d9488]" onClick={() => onOpenSection('Breakdown Tickets')} />
                <QuickActionBtn label="View Alerts" icon={Bell} iconBg="bg-[#ede9fe]" iconColor="text-[#8b5cf6]" onClick={() => setTabAndSync('alerts')} />
              </section>
            </div>
          ) : null}

          {tab === 'sales' && sales ? (
            <div className="space-y-4">
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                <KpiCard label="Total Leads" value={sales.total} caption="Filtered pipeline" icon={Users} iconBg="bg-[#dcfce7]" iconColor="text-[#16a34a]" onClick={() => onOpenSection('Lead List')} />
                <KpiCard label="Won" value={sales.won} caption="Won leads" icon={Trophy} iconBg="bg-[#dcfce7]" iconColor="text-[#16a34a]" onClick={() => onOpenSection('Lead List')} />
                <KpiCard label="Lost" value={sales.lost} caption="Lost leads" icon={XCircle} iconBg="bg-[#fee2e2]" iconColor="text-[#ef4444]" onClick={() => onOpenSection('Lead List')} />
                <KpiCard label="Conversion Rate" value={`${sales.conversion_rate}%`} caption="Won / Total Leads" icon={Target} iconBg="bg-[#dbeafe]" iconColor="text-[#3b82f6]" onClick={() => onOpenSection('Lead List')} />
                <KpiCard label="Quotation Follow ups" value={kpiFromReports(reports, 'Follow-ups')} caption="Pending follow ups" icon={ArrowUpRight} iconBg="bg-[#ede9fe]" iconColor="text-[#8b5cf6]" onClick={() => onOpenSection('Lead List')} />
                <KpiCard label="Tasks Pending" value={overview?.operations?.pending_tasks ?? 0} caption="Pending tasks" icon={Hourglass} iconBg="bg-[#ffedd5]" iconColor="text-[#f59e0b]" onClick={() => onOpenSection('Maintenance Tasks')} />
              </section>

              <StatStrip
                items={[
                  { label: 'Total Contacts', value: sales.total },
                  { label: 'New Leads', value: kpiFromReports(reports, 'New Leads') },
                  { label: 'Follow-ups', value: kpiFromReports(reports, 'Follow-ups') },
                  { label: 'Quotations', value: kpiFromReports(reports, 'Quotations') },
                  { label: 'Won Leads', value: sales.won },
                ]}
              />

              <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <article className={`${CARD} p-4 sm:p-5`}>
                  <h2 className="font-display text-[18px] font-extrabold text-[#111827]">Leads Trend</h2>
                  <LeadsTrendChart data={sales.monthly_trend} />
                </article>
                <article className={`${CARD} p-4 sm:p-5`}>
                  <h2 className="font-display text-[18px] font-extrabold text-[#111827]">Leads by Status</h2>
                  <StatusDonut data={sales.status_distribution} />
                </article>
              </section>

              <section className="grid gap-4 xl:grid-cols-3">
                <DataTableCard
                  title="Leads by Project Type"
                  headers={['Type', 'Total', 'Won', 'Conv.']}
                  rows={(sales.project_type_stats ?? []).map((p) => [p.type || 'Unknown', p.total, p.won, `${p.conversion}%`])}
                  actionLabel="View All"
                  onAction={() => onOpenSection('Lead List')}
                />
                <DataTableCard
                  title="Top Assigned Employees"
                  headers={['Employee', 'Leads', 'Won', 'Conv.']}
                  rows={(sales.employee_stats ?? []).map((r) => [r.name, r.total, r.won, `${r.conversion}%`])}
                  actionLabel="View All"
                  onAction={() => onNotify('Employee report opened')}
                />
                <MisIntelligenceCard sales={sales} onNotify={onNotify} />
              </section>
            </div>
          ) : null}

          {tab === 'projects' && projects ? (
            <div className="space-y-4">
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {[
                  { label: 'Total Projects', value: projects.summary?.total },
                  { label: 'Active', value: projects.summary?.active },
                  { label: 'Planning', value: projects.summary?.planning },
                  { label: 'On Hold', value: projects.summary?.on_hold },
                  { label: 'Completed', value: projects.summary?.completed },
                ].map((c) => (
                  <KpiCard key={c.label} label={c.label} value={c.value ?? 0} icon={FolderKanban} iconBg="bg-[#dbeafe]" iconColor="text-[#3b82f6]" onClick={() => onOpenSection('Project List')} />
                ))}
              </section>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => onOpenSection('Project List')} className="inline-flex h-11 items-center gap-2 rounded-[8px] bg-[#0d9f4a] px-5 text-[13px] font-extrabold text-white shadow-[0_8px_18px_rgba(13,159,74,0.22)]">
                  <FolderKanban className="size-4" />View All Projects
                </button>
              </div>
              {kpi ? (
                <>
                  <section className="grid gap-4 xl:grid-cols-3">
                    <article className={`${CARD} p-4 xl:col-span-2`}>
                      <h2 className="font-display text-[16px] font-extrabold text-[#111827]">Projects Trend (Monthly)</h2>
                      <LeadsTrendChart data={kpi.trend_labels?.map((label, i) => ({
                        month: label.replace('\n', ' '),
                        new: kpi.trend_series?.[0]?.values?.[i] ?? 0,
                        won: kpi.trend_series?.[1]?.values?.[i] ?? 0,
                        follow_up: 0,
                      }))} />
                    </article>
                    <article className={`${CARD} flex flex-col items-center justify-center p-4`}>
                      <p className="text-[12px] font-bold text-[#7a8fa6]">Avg. Completion</p>
                      <p className="mt-3 text-[48px] font-extrabold leading-none text-[#0b65e5]">{kpi.avg_progress}%</p>
                    </article>
                  </section>
                  <section className="grid gap-4 md:grid-cols-3">
                    {[
                      { title: 'Total Project Value', value: fmtRs(kpi.financial?.total_value) },
                      { title: 'Avg. Project Value', value: fmtRs(kpi.financial?.avg_value) },
                      { title: 'Total Capacity (KWp)', value: Number(kpi.financial?.total_capacity_kwp || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) },
                    ].map((row) => (
                      <article key={row.title} className={`${CARD} p-4`}>
                        <p className="text-[12px] font-bold text-[#7a8fa6]">{row.title}</p>
                        <p className="mt-2 text-[22px] font-extrabold text-[#1e3261]">{row.value}</p>
                      </article>
                    ))}
                  </section>
                  <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {(kpi.performance_stats ?? []).map((stat) => (
                      <article key={stat.label} className={`${CARD} p-4`}>
                        <p className="text-[12px] font-bold text-[#7a8fa6]">{stat.label}</p>
                        <p className="mt-2 text-[24px] font-extrabold text-[#1e3261]">{stat.value}</p>
                        <p className="mt-1 text-[11px] font-bold text-[#53647f]">{stat.note}</p>
                      </article>
                    ))}
                  </section>
                </>
              ) : null}
            </div>
          ) : null}

          {tab === 'finance' && finance ? (
            <div className="space-y-4">
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <FinanceCard label="Total Received" value={fmtRs(finance.total_received)} caption="All payments received" icon={IndianRupee} iconBg="bg-[#dcfce7]" iconColor="text-[#16a34a]" onClick={() => onOpenSection('Payment Received')} />
                <FinanceCard label="Total Paid Out" value={fmtRs(finance.total_made)} caption="All payments made" icon={CreditCard} iconBg="bg-[#dbeafe]" iconColor="text-[#3b82f6]" onClick={() => onOpenSection('Payment Made')} />
                <FinanceCard label="Net Cash Flow" value={fmtRs(finance.net_balance)} caption="Inflow - Outflow" icon={ArrowLeftRight} iconBg="bg-[#fef9c3]" iconColor="text-[#ca8a04]" onClick={() => onOpenSection('Accounts Overview')} />
                <FinanceCard label="Inventory Value" value={fmtRs(finance.inventory_value)} caption="Current stock value" icon={Package} iconBg="bg-[#ede9fe]" iconColor="text-[#8b5cf6]" onClick={() => onOpenSection('Products')} />
                <FinanceCard label="AMC Contract Value" value={fmtRs(finance.amc_contract_value)} caption="Total AMC value" icon={FileText} iconBg="bg-[#ccfbf1]" iconColor="text-[#0d9488]" onClick={() => onOpenSection('AMC Contracts')} />
                <FinanceCard label="Pending Cheques" value={String(finance.pending_cheques ?? 0)} caption="Awaiting clearance" icon={Wallet} iconBg="bg-[#fce7f3]" iconColor="text-[#ec4899]" onClick={() => onOpenSection('Cheques List')} />
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <article className={`${CARD} p-4 sm:p-5`}>
                  <h2 className="font-display text-[18px] font-extrabold text-[#111827]">Cash Flow Trend</h2>
                  <p className="mt-1 text-[12px] font-bold text-[#9aa8bc]">Estimated weekly split of the filtered period totals.</p>
                  <CashFlowTrendChart data={cashFlowTrend} />
                </article>
                <article className={`${CARD} p-4 sm:p-5`}>
                  <h2 className="font-display text-[18px] font-extrabold text-[#111827]">Cash Flow Summary</h2>
                  <CashFlowDonut finance={finance} />
                </article>
              </section>
            </div>
          ) : null}

          {tab === 'alerts' ? (
            <div className="space-y-4">
              <section className="grid gap-4 sm:grid-cols-2">
                {alertCards.map((item) => (
                  <AlertCard
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    icon={item.icon}
                    iconBg={item.iconBg}
                    iconColor={item.iconColor}
                    onClick={() => onOpenSection(item.section)}
                  />
                ))}
              </section>
            </div>
          ) : null}

          {!['overview', 'sales', 'projects', 'finance', 'alerts'].includes(tab) || (
            (tab === 'overview' && !overview)
            || (tab === 'sales' && !sales)
            || (tab === 'projects' && !projects)
            || (tab === 'finance' && !finance)
            || (tab === 'alerts' && data && alerts == null)
          ) ? (
            <div className={`${CARD} p-10 text-center`}>
              <p className="text-[14px] font-bold text-[#53647f]">No data available for this tab.</p>
            </div>
          ) : null}
        </>
      )}

      {incentiveOpen && IncentiveReportModal ? <IncentiveReportModal onClose={() => setIncentiveOpen(false)} onNotify={onNotify} /> : null}
      <InsightsFooter />
    </div>
  );
}

export const INSIGHTS_LEGACY_TAB_MAP = {
  'Executive Summary': 'overview',
  'Sales Pipeline': 'sales',
  'Projects & Delivery': 'projects',
  'Finance & Operations': 'finance',
  Reports: 'sales',
  'Project KPI Analytics': 'projects',
};

export const INSIGHTS_LEGACY_PATH_MAP = {
  '/summary/executive': 'overview',
  '/summary/sales': 'sales',
  '/summary/projects': 'projects',
  '/summary/finance': 'finance',
  '/reports': 'sales',
  '/projects/kpi-analytics': 'projects',
};
