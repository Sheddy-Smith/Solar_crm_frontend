import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BarChart3, Boxes, CheckCircle2, CreditCard, Download, FolderKanban,
  Hourglass, IndianRupee, LayoutDashboard, ReceiptText, RefreshCw, ShieldCheck,
  TrendingUp, Trophy, UserPlus, Users, Wrench, XCircle, Zap,
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { dashboardApi, userApi } from './api.js';
import { exportNotifyCsv } from './lib/utils.js';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'sales', label: 'Sales & Leads' },
  { id: 'projects', label: 'Projects' },
  { id: 'finance', label: 'Finance' },
  { id: 'alerts', label: 'Alerts' },
];

const STATUS_COLORS = {
  New: '#1f7ff0', 'Follow-up': '#36a269', Quotation: '#f8c64d', Won: '#6b55e9', Lost: '#e44d4d',
};

function fmtRs(v) {
  return v != null && v !== '' ? `Rs ${Number(v).toLocaleString('en-IN')}` : '—';
}

function formatReportDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function defaultDateRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

function normalizeUsers(data) {
  if (!data) return [];
  return Array.isArray(data) ? data : data.results ?? [];
}

function DashboardSkeleton({ panelClass }) {
  return (
    <div className="space-y-4">
      <div className={`${panelClass} p-6`}>
        <div className="flex items-center gap-3">
          <svg className="size-6 animate-spin text-[#0b65e5]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <div>
            <p className="text-[14px] font-extrabold text-[#1e3261]">Loading business insights…</p>
            <p className="text-[12px] font-bold text-[#7a8fa6]">Server wake-up can take up to a minute on first load — please wait.</p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 animate-pulse">
        {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className={`${panelClass} h-28`} />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2 animate-pulse">
        <div className={`${panelClass} h-72`} />
        <div className={`${panelClass} h-72`} />
      </div>
    </div>
  );
}

function MetricCard({ label, value, caption, tone, icon: Icon, onClick, panelClass, toneClasses }) {
  return (
    <button type="button" onClick={onClick} className={`${panelClass} p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold text-[#7a8fa6]">{label}</p>
          <p className="mt-2 text-[22px] font-extrabold text-[#1e3261]">{value}</p>
          {caption ? <p className="mt-1 text-[11px] font-bold text-[#53647f]">{caption}</p> : null}
        </div>
        {Icon ? (
          <span className={`grid size-10 place-items-center rounded-[10px] ${toneClasses[tone] || toneClasses.blue}`}>
            <Icon className="size-5" />
          </span>
        ) : null}
      </div>
    </button>
  );
}

function LeadsLineChart({ data }) {
  if (!data?.length) return <div className="flex h-[260px] items-center justify-center text-[13px] font-bold text-[#8a98af]">No data</div>;
  return (
    <div className="mt-4 h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#edf2f8" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#53647f' }} />
          <YAxis tick={{ fontSize: 11, fill: '#53647f' }} />
          <Tooltip />
          <Legend />
          <Area type="monotone" dataKey="new" name="New" stroke="#1f7ff0" fill="#1f7ff033" />
          <Area type="monotone" dataKey="follow_up" name="Follow-up" stroke="#6b55e9" fill="#6b55e933" />
          <Area type="monotone" dataKey="won" name="Won" stroke="#36a269" fill="#36a26933" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatusDonut({ data }) {
  const chartData = (data || []).map((d) => ({ name: d.status, value: d.count, color: STATUS_COLORS[d.status] || '#94a3b8' }));
  const total = chartData.reduce((s, d) => s + d.value, 0);
  if (!total) return <div className="flex h-[200px] items-center justify-center text-[13px] font-bold text-[#8a98af]">No data</div>;
  return (
    <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
      <div className="mx-auto h-[180px] w-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
              {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-1">
        {chartData.map((item) => (
          <div key={item.name} className="flex justify-between text-[13px] font-bold text-[#1e3261]">
            <span>{item.name}</span>
            <span>{item.value} ({((item.value / total) * 100).toFixed(1)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectDonut({ data, title, panelClass }) {
  const total = (data || []).reduce((s, d) => s + d.value, 0);
  return (
    <article className={`${panelClass} p-4`}>
      <h3 className="text-[15px] font-extrabold text-[#111827]">{title}</h3>
      {!total ? <p className="mt-6 text-center text-[13px] text-[#8a98af]">No data</p> : (
        <div className="mt-3 h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="label" innerRadius={45} outerRadius={75}>
                {data.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  );
}

function ProjectTrendChart({ labels, series, panelClass }) {
  const chartData = labels.map((label, i) => {
    const row = { label: label.replace('\n', ' ') };
    series.forEach((s) => { row[s.label] = s.values[i] || 0; });
    return row;
  });
  return (
    <article className={`${panelClass} p-4 xl:col-span-2`}>
      <h3 className="text-[15px] font-extrabold text-[#111827]">Projects Trend (Monthly)</h3>
      <div className="mt-3 h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#edf2f8" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {series.map((s) => <Bar key={s.label} dataKey={s.label} fill={s.color} radius={[4, 4, 0, 0]} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

export function UnifiedDashboardPage({
  activeTab,
  onTabChange,
  onOpenSection,
  onNotify,
  panelClass,
  cx,
  PageHeading,
  DashboardFooter,
  reportKpiToneClasses,
  IncentiveReportModal,
}) {
  const defaults = useMemo(() => defaultDateRange(), []);
  const [tab, setTab] = useState(activeTab || 'overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [projectType, setProjectType] = useState('All');
  const [leadStatus, setLeadStatus] = useState('All');
  const [assignedTo, setAssignedTo] = useState('All');
  const [assigneeOptions, setAssigneeOptions] = useState(['All']);
  const [incentiveOpen, setIncentiveOpen] = useState(false);

  useEffect(() => {
    if (activeTab && activeTab !== tab) setTab(activeTab);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    userApi.list({ page_size: 500 })
      .then((d) => {
        const names = [...new Set(normalizeUsers(d).map((u) => u.name).filter(Boolean))];
        setAssigneeOptions(['All', ...names]);
      })
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
      .then((res) => { if (res) setData(res); })
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
  const kpi = projects?.kpi;

  const alertItems = alerts ? [
    { label: 'Overdue Follow-ups', value: alerts.overdue_followups, section: 'Lead List', tone: 'amber' },
    { label: 'Low Stock Items', value: alerts.low_stock_items, section: 'Products', tone: 'amber' },
    { label: 'Out of Stock', value: alerts.out_of_stock_items, section: 'Stock Inward', tone: 'red' },
    { label: 'Expiring AMC', value: alerts.expiring_amc, section: 'AMC Contracts', tone: 'red' },
    { label: 'Pending O&M Tasks', value: alerts.pending_tasks, section: 'Maintenance Tasks', tone: 'purple' },
    { label: 'Open O&M Tickets', value: alerts.open_om_tickets, section: 'Breakdown Tickets', tone: 'red' },
    { label: 'Pending Cheques', value: alerts.pending_cheques, section: 'Cheques List', tone: 'cyan' },
    { label: 'Stale Stock (15d+)', value: alerts.stale_stock_items, section: 'Stock Movements', tone: 'amber' },
  ].filter((a) => Number(a.value) > 0) : [];

  const formattedRange = `${formatReportDate(dateFrom)} - ${formatReportDate(dateTo)}`;

  return (
    <div className="space-y-4">
      <PageHeading
        title="Business Insights"
        crumbs={[
          { label: 'Dashboard', onClick: () => onOpenSection('Dashboard') },
          { label: 'Insights' },
        ]}
        actions={(
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => exportNotifyCsv(onNotify, 'insights-export', ['Metric', 'Value'], (data?.reports?.kpis ?? []).map((k) => [k.title, k.value]))} className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-bold text-[#284276]">
              <Download className="size-4" />Export Report
            </button>
            <button type="button" onClick={() => setIncentiveOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#ef4444] px-4 text-[13px] font-extrabold text-white">
              <IndianRupee className="size-4" />Generate Incentive Report
            </button>
          </div>
        )}
      />

      <section className={`${panelClass} p-4`}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto] xl:items-end">
          <label className="text-[12px] font-bold text-[#53647f]">From<input type="date" className="mt-1 h-10 w-full rounded-[8px] border px-3 text-[13px]" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
          <label className="text-[12px] font-bold text-[#53647f]">To<input type="date" className="mt-1 h-10 w-full rounded-[8px] border px-3 text-[13px]" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
          <label className="text-[12px] font-bold text-[#53647f]">Project Type<select className="mt-1 h-10 w-full rounded-[8px] border px-3 text-[13px]" value={projectType} onChange={(e) => setProjectType(e.target.value)}>{['All', 'On-Grid', 'Off-Grid', 'Hybrid'].map((o) => <option key={o}>{o}</option>)}</select></label>
          <label className="text-[12px] font-bold text-[#53647f]">Lead Status<select className="mt-1 h-10 w-full rounded-[8px] border px-3 text-[13px]" value={leadStatus} onChange={(e) => setLeadStatus(e.target.value)}>{['All', 'New', 'Follow-up', 'Site Visit', 'Quotation Shared', 'Won', 'Lost'].map((o) => <option key={o}>{o}</option>)}</select></label>
          <label className="text-[12px] font-bold text-[#53647f]">Assigned To<select className="mt-1 h-10 w-full rounded-[8px] border px-3 text-[13px]" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>{assigneeOptions.map((o) => <option key={o}>{o}</option>)}</select></label>
          <button type="button" onClick={load} className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#0d9f4a] px-4 text-[13px] font-extrabold text-white xl:mb-0"><RefreshCw className="size-4" />Apply</button>
        </div>
        <p className="mt-3 text-[12px] font-bold text-[#7a8fa6]">Active range: {formattedRange}</p>
      </section>

      <nav className="flex flex-wrap gap-2 border-b border-[#e5eaf2] pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTabAndSync(t.id)}
            className={cx(
              'rounded-t-[8px] px-4 py-2.5 text-[13px] font-extrabold transition',
              tab === t.id ? 'bg-[#f2fffb] text-[#0f766e] border border-[#d7f4ea] border-b-white -mb-px' : 'text-[#53647f] hover:bg-[#f8fbff]',
            )}
          >
            {t.label}
            {t.id === 'alerts' && alertItems.length ? (
              <span className="ml-2 rounded-full bg-[#ef4444] px-2 py-0.5 text-[10px] text-white">{alertItems.length}</span>
            ) : null}
          </button>
        ))}
      </nav>

      {loading ? <DashboardSkeleton panelClass={panelClass} /> : error ? (
        <div className={`${panelClass} p-8 text-center`}>
          <p className="text-[14px] font-bold text-[#dc2626]">{error}</p>
          <button type="button" onClick={load} className="mt-4 rounded-[8px] bg-[#0b65e5] px-4 py-2 text-[13px] font-extrabold text-white">Retry</button>
        </div>
      ) : (
        <>
          {tab === 'overview' && overview ? (
            <div className="space-y-4">
              <p className="text-[14px] font-bold text-[#324871]">Live business snapshot — sales, projects, finance, inventory and AMC in one place.</p>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                <MetricCard label="Total Leads" value={sales?.total ?? 0} caption="Filtered pipeline" tone="blue" icon={Users} onClick={() => onOpenSection('Lead List')} panelClass={panelClass} toneClasses={reportKpiToneClasses} />
                <MetricCard label="Active Projects" value={overview.hero?.active_projects ?? 0} caption={`${overview.hero?.total_projects ?? 0} total`} tone="green" icon={FolderKanban} onClick={() => onOpenSection('Project List')} panelClass={panelClass} toneClasses={reportKpiToneClasses} />
                <MetricCard label="Cash Received" value={fmtRs(overview.hero?.cash_received)} caption="Completed receipts" tone="cyan" icon={IndianRupee} onClick={() => onOpenSection('Payment Received')} panelClass={panelClass} toneClasses={reportKpiToneClasses} />
                <MetricCard label="Bank Balance" value={fmtRs(overview.hero?.bank_balance)} caption={`${overview.hero?.bank_count ?? 0} accounts`} tone="purple" icon={CreditCard} onClick={() => onOpenSection('Bank Accounts')} panelClass={panelClass} toneClasses={reportKpiToneClasses} />
                <MetricCard label="Stock Value" value={fmtRs(overview.hero?.stock_value)} caption={`${overview.hero?.stock_items ?? 0} products`} tone="amber" icon={Boxes} onClick={() => onOpenSection('Products')} panelClass={panelClass} toneClasses={reportKpiToneClasses} />
                <MetricCard label="Active AMC" value={overview.hero?.active_amc ?? 0} caption={`${overview.hero?.open_amc_requests ?? 0} open requests`} tone="sky" icon={ShieldCheck} onClick={() => onOpenSection('AMC Contracts')} panelClass={panelClass} toneClasses={reportKpiToneClasses} />
              </section>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: 'Open O&M Tickets', value: overview.operations?.open_tickets ?? 0 },
                  { label: 'Pending Tasks', value: overview.operations?.pending_tasks ?? 0 },
                  { label: 'Low Stock', value: overview.inventory?.low_stock ?? 0 },
                  { label: 'Expiring AMC', value: overview.amc?.expiring_contracts ?? 0 },
                ].map((item) => (
                  <article key={item.label} className={`${panelClass} p-4`}>
                    <p className="text-[12px] font-bold text-[#7a8fa6]">{item.label}</p>
                    <p className="mt-2 text-[22px] font-extrabold text-[#1e3261]">{item.value}</p>
                  </article>
                ))}
              </section>
              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  { label: 'New Lead', section: 'Create Lead', icon: UserPlus, tone: 'green' },
                  { label: 'Record Payment', section: 'Payment Received', icon: ReceiptText, tone: 'blue' },
                  { label: 'Stock Inward', section: 'Stock Inward', icon: Download, tone: 'amber' },
                  { label: 'O&M Tickets', section: 'Breakdown Tickets', icon: Wrench, tone: 'red' },
                  { label: 'View Alerts', section: null, icon: AlertTriangle, tone: 'purple', action: () => setTabAndSync('alerts') },
                ].map((link) => (
                  <button key={link.label} type="button" onClick={() => (link.action ? link.action() : onOpenSection(link.section))} className={`${panelClass} flex items-center gap-3 p-4 text-left hover:bg-[#f8fbff]`}>
                    <span className={`grid size-10 place-items-center rounded-[10px] ${reportKpiToneClasses[link.tone]}`}><link.icon className="size-5" /></span>
                    <span className="text-[14px] font-extrabold text-[#1e3261]">{link.label}</span>
                  </button>
                ))}
              </section>
            </div>
          ) : null}

          {tab === 'sales' && sales ? (
            <div className="space-y-4">
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {[
                  { label: 'Total Leads', value: sales.total, icon: Users, tone: 'blue' },
                  { label: 'Won', value: sales.won, icon: Trophy, tone: 'green' },
                  { label: 'Lost', value: sales.lost, icon: XCircle, tone: 'red' },
                  { label: 'Conversion', value: `${sales.conversion_rate}%`, icon: TrendingUp, tone: 'purple' },
                  { label: 'Overdue Follow-ups', value: sales.overdue, icon: Hourglass, tone: 'amber' },
                ].map((c) => <MetricCard key={c.label} {...c} value={String(c.value)} onClick={() => onOpenSection('Lead List')} panelClass={panelClass} toneClasses={reportKpiToneClasses} />)}
              </section>
              {(data?.reports?.kpis ?? []).length ? (
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  {data.reports.kpis.map((kpiItem) => (
                    <article key={kpiItem.title} className={`${panelClass} p-4`}>
                      <p className="text-[12px] font-bold text-[#7a8fa6]">{kpiItem.title}</p>
                      <p className="mt-2 text-[22px] font-extrabold text-[#1e3261]">{kpiItem.value}</p>
                    </article>
                  ))}
                </section>
              ) : null}
              <section className="grid gap-4 xl:grid-cols-2">
                <article className={`${panelClass} p-4`}><h2 className="font-display text-[18px] font-extrabold">Leads Trend</h2><LeadsLineChart data={sales.monthly_trend} /></article>
                <article className={`${panelClass} p-4`}><h2 className="font-display text-[18px] font-extrabold">Leads by Status</h2><StatusDonut data={sales.status_distribution} /></article>
              </section>
              <section className="grid gap-4 xl:grid-cols-3">
                <article className={`${panelClass} p-4 overflow-auto`}>
                  <h2 className="text-[16px] font-extrabold mb-3">Leads by Project Type</h2>
                  <table className="crm-table w-full min-w-[400px]">
                    <thead><tr>{['Type', 'Total', 'Won', 'Conv.'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>{(sales.project_type_stats ?? []).map((p) => <tr key={p.type}><td>{p.type}</td><td>{p.total}</td><td>{p.won}</td><td>{p.conversion}%</td></tr>)}</tbody>
                  </table>
                </article>
                <article className={`${panelClass} p-4 overflow-auto`}>
                  <h2 className="text-[16px] font-extrabold mb-3">Top Assigned Employees</h2>
                  <table className="crm-table w-full min-w-[360px]">
                    <thead><tr>{['Employee', 'Leads', 'Won', 'Conv.'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>{(sales.employee_stats ?? []).map((r) => <tr key={r.name}><td>{r.name}</td><td>{r.total}</td><td>{r.won}</td><td>{r.conversion}%</td></tr>)}</tbody>
                  </table>
                </article>
                <article className={`${panelClass} p-4`}>
                  <h2 className="flex items-center gap-2 text-[16px] font-extrabold"><ShieldCheck className="size-5 text-[#0d9f4a]" />IVRS Intelligence</h2>
                  <div className="mt-4 space-y-2 text-[13px] font-bold">
                    <div className="flex justify-between"><span>Leads with IVRS</span><span>{sales.ivrs_summary?.total_with_ivrs ?? 0}</span></div>
                    <div className="flex justify-between"><span>Coverage</span><span>{sales.ivrs_summary?.coverage_pct ?? 0}%</span></div>
                    <div className="flex justify-between"><span>Total (filtered)</span><span>{sales.total}</span></div>
                  </div>
                </article>
              </section>
            </div>
          ) : null}

          {tab === 'projects' && projects ? (
            <div className="space-y-4">
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {[
                  { label: 'Total', value: projects.summary?.total },
                  { label: 'Active', value: projects.summary?.active },
                  { label: 'Planning', value: projects.summary?.planning },
                  { label: 'On Hold', value: projects.summary?.on_hold },
                  { label: 'Completed', value: projects.summary?.completed },
                ].map((c) => (
                  <MetricCard key={c.label} label={c.label} value={String(c.value ?? 0)} onClick={() => onOpenSection('Project List')} panelClass={panelClass} toneClasses={reportKpiToneClasses} tone="blue" icon={FolderKanban} />
                ))}
              </section>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => onOpenSection('Project List')} className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#0b65e5] px-4 text-[13px] font-extrabold text-white"><FolderKanban className="size-4" />View All Projects</button>
              </div>
              {kpi ? (
                <>
                  <section className="grid gap-4 xl:grid-cols-4">
                    <ProjectTrendChart labels={kpi.trend_labels} series={kpi.trend_series} panelClass={panelClass} />
                    <ProjectDonut data={kpi.status_data} title="Projects by Status" panelClass={panelClass} />
                    <article className={`${panelClass} p-4 flex flex-col items-center justify-center`}>
                      <p className="text-[12px] font-bold text-[#7a8fa6]">Avg. Completion</p>
                      <p className="mt-2 text-[36px] font-extrabold text-[#0b65e5]">{kpi.avg_progress}%</p>
                    </article>
                  </section>
                  <section className="grid gap-4 md:grid-cols-2">
                    <ProjectDonut data={kpi.site_data} title="Projects by Site" panelClass={panelClass} />
                    <ProjectDonut data={kpi.type_data} title="Projects by Type" panelClass={panelClass} />
                  </section>
                  <section className="grid gap-4 md:grid-cols-3">
                    {[
                      { label: 'Total Project Value', value: fmtRs(kpi.financial?.total_value) },
                      { label: 'Avg. Project Value', value: fmtRs(kpi.financial?.avg_value) },
                      { label: 'Total Capacity (KWp)', value: Number(kpi.financial?.total_capacity_kwp || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) },
                    ].map((row) => (
                      <article key={row.label} className={`${panelClass} p-4`}>
                        <p className="text-[12px] font-bold text-[#7a8fa6]">{row.label}</p>
                        <p className="mt-2 text-[20px] font-extrabold text-[#1e3261]">{row.value}</p>
                      </article>
                    ))}
                  </section>
                  <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {(kpi.performance_stats ?? []).map((stat) => (
                      <article key={stat.label} className={`${panelClass} p-4`}>
                        <p className="text-[12px] font-bold text-[#7a8fa6]">{stat.label}</p>
                        <p className="mt-2 text-[22px] font-extrabold text-[#1e3261]">{stat.value}</p>
                        <p className="mt-1 text-[11px] font-bold text-[#53647f]">{stat.note}</p>
                      </article>
                    ))}
                  </section>
                </>
              ) : null}
            </div>
          ) : null}

          {tab === 'finance' && finance ? (
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[
                { label: 'Total Received', value: fmtRs(finance.total_received), section: 'Payment Received' },
                { label: 'Total Paid Out', value: fmtRs(finance.total_made), section: 'Payment Made' },
                { label: 'Net Cash Flow', value: fmtRs(finance.net_balance), section: 'Accounts Overview' },
                { label: 'Inventory Value', value: fmtRs(finance.inventory_value), section: 'Products' },
                { label: 'AMC Contract Value', value: fmtRs(finance.amc_contract_value), section: 'AMC Contracts' },
                { label: 'Pending Cheques', value: String(finance.pending_cheques ?? 0), section: 'Cheques List' },
              ].map((c) => (
                <MetricCard key={c.label} label={c.label} value={c.value} onClick={() => onOpenSection(c.section)} panelClass={panelClass} toneClasses={reportKpiToneClasses} tone="blue" icon={IndianRupee} />
              ))}
            </section>
          ) : null}

          {tab === 'alerts' ? (
            <div className="space-y-4">
              {alertItems.length ? (
                <section className="grid gap-3 sm:grid-cols-2">
                  {alertItems.map((item) => (
                    <button key={item.label} type="button" onClick={() => onOpenSection(item.section)} className={`${panelClass} flex items-center justify-between p-4 text-left hover:bg-[#fff8f8]`}>
                      <div>
                        <p className="text-[13px] font-extrabold text-[#1e3261]">{item.label}</p>
                        <p className="text-[11px] font-bold text-[#7a8fa6]">Needs attention</p>
                      </div>
                      <span className="text-[24px] font-extrabold text-[#dc2626]">{item.value}</span>
                    </button>
                  ))}
                </section>
              ) : (
                <div className={`${panelClass} p-12 text-center`}>
                  <CheckCircle2 className="mx-auto size-12 text-[#16a34a]" />
                  <p className="mt-4 text-[15px] font-extrabold text-[#1e3261]">All clear — no alerts right now</p>
                </div>
              )}
            </div>
          ) : null}
        </>
      )}

      {incentiveOpen && IncentiveReportModal ? <IncentiveReportModal onClose={() => setIncentiveOpen(false)} onNotify={onNotify} /> : null}
      <DashboardFooter />
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