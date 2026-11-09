import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Bug,
  Database,
  Download,
  FlaskConical,
  Gauge,
  HardDrive,
  Info,
  LayoutGrid,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  Wifi,
  Zap,
  X,
} from 'lucide-react';
import { DEVELOPER_CATEGORIES } from './categories.js';
import {
  clearApiInspector,
  getApiInspectorSnapshot,
  getNetworkSimulatorState,
  resetNetworkSimulator,
  setNetworkSimulatorState,
  subscribeApiInspector,
} from './services/apiInspector.js';
import {
  clearDebugLogs,
  exportDebugLogs,
  getDebugLogs,
  pushDebugLog,
  subscribeDebugLogs,
} from './services/debugLogger.js';
import {
  getPerformanceSnapshot,
  startPerformanceMonitor,
  stopPerformanceMonitor,
  subscribePerformance,
} from './services/performanceMonitor.js';
import {
  getUiDebugControls,
  installUiDebugControls,
  resetUiDebugControls,
  setUiDebugControl,
  subscribeUiDebugControls,
} from './services/uiDebugControls.js';
import {
  buildDiagnosticReport,
  clearApplicationCaches,
  getStorageDiagnostics,
  resetLocalDeveloperSettings,
} from './services/storageDiagnostics.js';
import {
  DeveloperAnimationPage,
  DeveloperAttendanceMachinePage,
  DeveloperAuditLogsPage,
  DeveloperBugReportsPage,
  DeveloperMemoryPage,
  DeveloperWhatsAppExtensionPage,
} from '../settingsDeveloperPages.jsx';
import { API_BASE_PUBLIC } from './services/appMeta.js';

const CARD = 'rounded-[14px] border border-[#e6edf6] bg-white shadow-[0_10px_28px_rgba(24,48,87,0.06)]';

const CATEGORY_META = {
  performance: { icon: Gauge, tone: 'from-[#dbeafe] to-[#eff6ff]', iconColor: 'text-[#2563eb]', blurb: 'CPU, RAM, FPS, API & DB metrics' },
  debugging: { icon: Bug, tone: 'from-[#fee2e2] to-[#fff1f2]', iconColor: 'text-[#dc2626]', blurb: 'Logs, API Inspector, errors' },
  diagnostics: { icon: Wifi, tone: 'from-[#dcfce7] to-[#f0fdf4]', iconColor: 'text-[#16a34a]', blurb: 'Network, database, sync health' },
  ui: { icon: LayoutGrid, tone: 'from-[#ede9fe] to-[#f5f3ff]', iconColor: 'text-[#7c3aed]', blurb: 'Animation, layout, RTL & display' },
  testing: { icon: FlaskConical, tone: 'from-[#ffedd5] to-[#fff7ed]', iconColor: 'text-[#ea580c]', blurb: 'Mock API, network & error simulation' },
  advanced: { icon: Settings2, tone: 'from-[#e0f2fe] to-[#f0f9ff]', iconColor: 'text-[#0284c7]', blurb: 'Force refresh, cache, config, tasks' },
  data: { icon: Download, tone: 'from-[#fce7f3] to-[#fdf2f8]', iconColor: 'text-[#db2777]', blurb: 'Logs export, reports, storage' },
  system: { icon: Info, tone: 'from-[#f1f5f9] to-[#f8fafc]', iconColor: 'text-[#475569]', blurb: 'App, browser, device & environment' },
  legacy: { icon: Sparkles, tone: 'from-[#fef3c7] to-[#fffbeb]', iconColor: 'text-[#d97706]', blurb: 'Memory, WA, attendance, audit' },
};

function ToggleRow({ title, description, checked, onChange, disabled }) {
  return (
    <div className={`flex items-start justify-between gap-3 border-b border-[#eef2f7] px-4 py-3 ${disabled ? 'opacity-60' : ''}`}>
      <span className="min-w-0">
        <span className="block text-[14px] font-extrabold text-[#1e3261]">{title}</span>
        <span className="mt-0.5 block text-[12px] font-semibold text-[#64748b]">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-[#078c3e]' : 'bg-[#cbd5e1]'}`}
      >
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition ${checked ? 'left-5' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

function MetricCard({ label, value, note, icon: Icon, accent = 'text-[#078c3e]' }) {
  return (
    <div className={`${CARD} p-3.5`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#7a8fa6]">{label}</p>
        {Icon ? <Icon className={`size-4 ${accent}`} /> : null}
      </div>
      <p className="mt-2 font-display text-[22px] font-black leading-none text-[#1e3261]">{value}</p>
      {note ? <p className="mt-2 text-[11px] font-semibold text-[#64748b]">{note}</p> : null}
    </div>
  );
}

function useLive(subscribe, getter, start, stop) {
  const [snap, setSnap] = useState(getter);
  useEffect(() => {
    start?.();
    const unsub = subscribe((v) => setSnap(typeof v === 'function' ? v : { ...getter(), ...(v || {}) }));
    setSnap(getter());
    return () => {
      unsub?.();
      stop?.();
    };
  }, [subscribe, getter, start, stop]);
  return snap;
}

function HomeDashboard({ onOpenCategory, apiSnap, onNotify, onExit }) {
  const perf = useLive(subscribePerformance, getPerformanceSnapshot, startPerformanceMonitor, stopPerformanceMonitor);
  const [logs, setLogs] = useState(getDebugLogs);
  useEffect(() => subscribeDebugLogs(setLogs), []);

  const heapMb = perf.heap?.supported ? (perf.heap.usedJSHeapSize / 1048576).toFixed(1) : null;
  const heapLimit = perf.heap?.supported ? (perf.heap.jsHeapSizeLimit / 1048576).toFixed(0) : null;

  const quickActions = [
    {
      title: 'Force Refresh',
      run: () => {
        const url = new URL(window.location.href);
        url.searchParams.set('_dev_refresh', String(Date.now()));
        window.location.replace(url.toString());
      },
    },
    {
      title: 'Clear Cache',
      run: async () => {
        if (!window.confirm('Clear application caches? Login session will be kept.')) return;
        const report = await clearApplicationCaches({ keepAuth: true });
        onNotify?.(`Cleared ${report.cachesDeleted} caches`, 'success');
      },
    },
    {
      title: 'Export Logs',
      run: () => {
        const blob = new Blob([exportDebugLogs()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `crm-debug-logs-${Date.now()}.json`;
        a.click();
        onNotify?.('Logs exported', 'success');
      },
    },
    {
      title: 'Reset Local Settings',
      run: async () => {
        if (!window.confirm('Reset local developer settings for this browser?')) return;
        resetLocalDeveloperSettings();
        await resetUiDebugControls();
        resetNetworkSimulator();
        onNotify?.('Local developer settings reset', 'success');
      },
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold text-[#7a8fa6]">Developer Console · Developer Mode (Advanced)</p>
          <h2 className="mt-1 font-display text-[26px] font-black tracking-tight text-[#14325c]">Developer Console</h2>
          <p className="mt-1 max-w-2xl text-[13px] font-semibold text-[#53647f]">
            Android-style tools for Super Admin — real browser/TWA metrics, API inspection, UI controls and safe test simulations.
          </p>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-[#fed7aa] bg-[#fff7ed] px-4 text-[12px] font-extrabold text-[#9a3412]"
        >
          <span className="relative inline-flex h-[22px] w-10 items-center rounded-full bg-[#f97316] p-0.5">
            <span className="ml-auto block size-[18px] rounded-full bg-white shadow" />
          </span>
          Developer Mode On · Exit
        </button>
      </div>

      <section>
        <h3 className="mb-3 text-[13px] font-extrabold uppercase tracking-wide text-[#7a8fa6]">Categories</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {DEVELOPER_CATEGORIES.filter((c) => c.id !== 'legacy').map((cat) => {
            const meta = CATEGORY_META[cat.id] || CATEGORY_META.system;
            const Icon = meta.icon;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onOpenCategory(cat.id)}
                className={`${CARD} group p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(24,48,87,0.1)]`}
              >
                <div className={`inline-flex size-11 items-center justify-center rounded-[12px] bg-gradient-to-br ${meta.tone}`}>
                  <Icon className={`size-5 ${meta.iconColor}`} />
                </div>
                <p className="mt-3 text-[15px] font-extrabold text-[#1e3261] group-hover:text-[#078c3e]">{cat.label}</p>
                <p className="mt-1 text-[12px] font-semibold leading-snug text-[#64748b]">{meta.blurb}</p>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => onOpenCategory('legacy')}
          className="mt-3 text-[12px] font-extrabold text-[#078c3e] hover:underline"
        >
          Open CRM Developer Tools (Memory, WhatsApp, Attendance, Audit, Bugs) →
        </button>
      </section>

      <section>
        <h3 className="mb-3 text-[13px] font-extrabold uppercase tracking-wide text-[#7a8fa6]">System Overview</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="CPU"
            value="Unavailable"
            note="Browser/TWA cannot expose exact CPU %. Use FPS / long frames."
            icon={Activity}
            accent="text-[#94a3b8]"
          />
          <MetricCard
            label="JS Heap (RAM proxy)"
            value={heapMb ? `${heapMb} MB` : 'Unavailable'}
            note={heapLimit ? `Limit ~${heapLimit} MB · performance.memory` : 'Not exposed in this browser'}
            icon={HardDrive}
          />
          <MetricCard
            label="FPS"
            value={perf.running ? `${perf.fps || '—'}` : '—'}
            note={`Long frames: ${perf.longFrames || 0}`}
            icon={Gauge}
          />
          <MetricCard
            label="API Latency"
            value={`${apiSnap.totals.avgMs || 0} ms`}
            note={`${apiSnap.totals.count || 0} requests · ${apiSnap.totals.failed || 0} failed`}
            icon={Zap}
            accent="text-[#2563eb]"
          />
          <MetricCard
            label="DB Query"
            value="Via API"
            note="Production SQL not exposed. Use readiness / API latency."
            icon={Database}
            accent="text-[#0f766e]"
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
        <article className={`${CARD} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-[#eef2f7] px-4 py-3">
            <h3 className="text-[15px] font-extrabold text-[#1e3261]">Recent Activity</h3>
            <button type="button" className="text-[12px] font-extrabold text-[#078c3e]" onClick={() => onOpenCategory('debugging')}>View all</button>
          </div>
          <div className="max-h-[260px] overflow-auto">
            {logs.slice(0, 8).map((l) => (
              <div key={l.id} className="grid grid-cols-[72px_72px_minmax(0,1fr)] gap-2 border-b border-[#f1f5f9] px-4 py-2.5 text-[12px]">
                <span className="font-bold text-[#94a3b8]">{new Date(l.ts).toLocaleTimeString()}</span>
                <span className="font-extrabold text-[#b45309]">{l.level}</span>
                <span className="truncate font-semibold text-[#334155]">{l.message}</span>
              </div>
            ))}
            {!logs.length ? <p className="p-6 text-center text-[13px] font-semibold text-[#94a3b8]">No activity yet — API calls and errors appear here.</p> : null}
          </div>
        </article>

        <article className={`${CARD} p-4`}>
          <h3 className="text-[15px] font-extrabold text-[#1e3261]">Quick Actions</h3>
          <div className="mt-3 grid gap-2">
            {quickActions.map((a) => (
              <button
                key={a.title}
                type="button"
                onClick={a.run}
                className="h-11 rounded-[10px] border border-[#dbe5f2] bg-[#f8fafc] px-3 text-left text-[13px] font-extrabold text-[#1e3261] transition hover:border-[#078c3e] hover:bg-[#ecfdf3]"
              >
                {a.title}
              </button>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function PerformancePanel({ apiSnap }) {
  const perf = useLive(subscribePerformance, getPerformanceSnapshot, startPerformanceMonitor, stopPerformanceMonitor);
  const heapMb = perf.heap?.supported ? `${(perf.heap.usedJSHeapSize / 1048576).toFixed(1)} MB` : 'Unavailable';
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Approx FPS" value={perf.running ? perf.fps : '—'} note="rAF based" icon={Gauge} />
        <MetricCard label="Long frames" value={perf.longFrames} note=">50ms deltas" icon={Activity} />
        <MetricCard label="JS Heap" value={heapMb} note={perf.heap?.supported ? 'performance.memory' : 'Unsupported'} icon={HardDrive} />
        <MetricCard label="CPU %" value="Unavailable" note="Not measurable in browser/TWA" icon={Activity} accent="text-[#94a3b8]" />
      </div>
      <article className={`${CARD} p-4`}>
        <h3 className="text-[15px] font-extrabold text-[#1e3261]">API Performance</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <MetricCard label="Requests" value={apiSnap.totals.count} />
          <MetricCard label="Failed" value={apiSnap.totals.failed} />
          <MetricCard label="Avg latency" value={`${apiSnap.totals.avgMs || 0} ms`} />
          <MetricCard label="Status codes" value={Object.keys(apiSnap.byStatus || {}).length} />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-[12px]">
            <thead className="bg-[#f8fafc] text-[10px] font-extrabold uppercase text-[#7a8fa6]">
              <tr>{['Method', 'Path', 'Status', 'ms'].map((h) => <th key={h} className="px-2 py-2">{h}</th>)}</tr>
            </thead>
            <tbody>
              {(apiSnap.slowest || []).map((row) => (
                <tr key={row.id} className="border-t border-[#eef2f7]">
                  <td className="px-2 py-2 font-bold">{row.method}</td>
                  <td className="max-w-[280px] truncate px-2 py-2">{row.path}</td>
                  <td className="px-2 py-2">{row.status ?? 'ERR'}</td>
                  <td className="px-2 py-2">{row.durationMs}</td>
                </tr>
              ))}
              {!apiSnap.slowest?.length ? <tr><td colSpan={4} className="px-2 py-6 text-center text-[#94a3b8]">Slowest APIs yahan dikhenge.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

function DebuggingPanel({ apiSnap, onNotify }) {
  const [logs, setLogs] = useState(getDebugLogs);
  const [level, setLevel] = useState('ALL');
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('logs');
  useEffect(() => subscribeDebugLogs(setLogs), []);
  const filtered = useMemo(() => logs.filter((l) => {
    if (level !== 'ALL' && l.level !== level) return false;
    if (q && !`${l.message} ${l.category}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [logs, level, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          ['logs', 'Logs'],
          ['api', 'API Inspector'],
          ['errors', 'Errors'],
        ].map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-full px-3 py-1.5 text-[12px] font-extrabold ${tab === id ? 'bg-[#078c3e] text-white' : 'border border-[#d9e2ec] bg-white'}`}>{label}</button>
        ))}
      </div>

      {tab !== 'api' ? (
        <article className={`${CARD} p-4`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[15px] font-extrabold text-[#1e3261]">{tab === 'errors' ? 'Error Tracking' : 'Debug Logging'}</h3>
            <div className="flex flex-wrap gap-2">
              <select className="h-9 rounded-[8px] border border-[#d9e2ec] px-2 text-[12px] font-bold" value={level} onChange={(e) => setLevel(e.target.value)}>
                {['ALL', 'INFO', 'DEBUG', 'WARNING', 'ERROR', 'CRITICAL'].map((x) => <option key={x}>{x}</option>)}
              </select>
              <input className="h-9 rounded-[8px] border border-[#d9e2ec] px-2 text-[12px]" placeholder="Search logs" value={q} onChange={(e) => setQ(e.target.value)} />
              <button type="button" className="h-9 rounded-[8px] border border-[#d9e2ec] px-3 text-[12px] font-extrabold" onClick={() => { clearDebugLogs(); onNotify?.('Logs cleared', 'success'); }}>Clear</button>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1 rounded-[8px] bg-[#078c3e] px-3 text-[12px] font-extrabold text-white"
                onClick={() => {
                  const blob = new Blob([exportDebugLogs((l) => filtered.includes(l))], { type: 'application/json' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = `crm-debug-logs-${Date.now()}.json`;
                  a.click();
                }}
              >
                <Download className="size-3.5" /> Export
              </button>
            </div>
          </div>
          <div className="mt-3 max-h-[360px] overflow-auto rounded-[10px] border border-[#eef2f7]">
            {filtered.filter((l) => (tab === 'errors' ? ['ERROR', 'CRITICAL', 'WARNING'].includes(l.level) : true)).map((l) => (
              <div key={l.id} className="border-b border-[#f1f5f9] px-3 py-2 text-[12px]">
                <span className="font-extrabold text-[#64748b]">{new Date(l.ts).toLocaleTimeString()}</span>
                {' · '}
                <span className="font-extrabold text-[#b45309]">{l.level}</span>
                {' · '}
                <span className="text-[#1e3261]">{l.message}</span>
              </div>
            ))}
          </div>
        </article>
      ) : (
        <article className={`${CARD} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-[#eef2f7] px-4 py-3">
            <h3 className="text-[15px] font-extrabold text-[#1e3261]">API Request Inspector</h3>
            <button type="button" className="text-[12px] font-extrabold text-[#078c3e]" onClick={() => { clearApiInspector(); onNotify?.('API inspector cleared', 'success'); }}>Clear</button>
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="min-w-full text-left text-[12px]">
              <thead className="sticky top-0 bg-[#f8fafc] text-[10px] font-extrabold uppercase text-[#7a8fa6]">
                <tr>{['Time', 'Method', 'Endpoint', 'Status', 'ms', 'Error'].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
              </thead>
              <tbody>
                {apiSnap.entries.map((e) => (
                  <tr key={e.id} className="border-t border-[#eef2f7]">
                    <td className="whitespace-nowrap px-3 py-2">{new Date(e.ts).toLocaleTimeString()}</td>
                    <td className="px-3 py-2 font-bold">{e.method}</td>
                    <td className="max-w-[240px] truncate px-3 py-2">{e.path}</td>
                    <td className="px-3 py-2">{e.status ?? 'ERR'}</td>
                    <td className="px-3 py-2">{e.durationMs}</td>
                    <td className="max-w-[180px] truncate px-3 py-2 text-[#b91c1c]">{e.error || '—'}</td>
                  </tr>
                ))}
                {!apiSnap.entries.length ? <tr><td colSpan={6} className="px-3 py-8 text-center text-[#94a3b8]">Tokens/passwords masked. Live API calls appear here.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </article>
      )}
    </div>
  );
}

function DiagnosticsPanel({ onNotify }) {
  const [health, setHealth] = useState({ loading: true });
  const load = useCallback(async () => {
    setHealth({ loading: true });
    const out = { loading: false, checkedAt: new Date().toISOString(), online: navigator.onLine };
    try {
      const t0 = performance.now();
      const r = await fetch(`${API_BASE_PUBLIC}/health/`);
      out.health = { ok: r.ok, status: r.status, ms: Math.round(performance.now() - t0), body: await r.json().catch(() => ({})) };
    } catch (err) {
      out.health = { ok: false, error: err.message };
    }
    try {
      const t0 = performance.now();
      const r = await fetch(`${API_BASE_PUBLIC}/ready/`);
      out.ready = { ok: r.ok, status: r.status, ms: Math.round(performance.now() - t0), body: await r.json().catch(() => ({})) };
    } catch (err) {
      out.ready = { ok: false, error: err.message };
    }
    setHealth(out);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <article className={`${CARD} p-4`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[16px] font-extrabold text-[#1e3261]">Network & Backend Diagnostics</h3>
          <button type="button" className="inline-flex h-9 items-center gap-1 rounded-[8px] border border-[#d9e2ec] px-3 text-[12px] font-extrabold" onClick={() => { load(); onNotify?.('Diagnostics refreshed', 'success'); }}>
            <RefreshCw className="size-3.5" /> Refresh
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MetricCard label="Browser online" value={health.online ? 'Yes' : 'No'} />
          <MetricCard label="API health" value={health.health?.ok ? `${health.health.status} · ${health.health.ms}ms` : (health.loading ? '…' : 'FAIL')} />
          <MetricCard label="API ready" value={health.ready?.ok ? `${health.ready.status} · ${health.ready.ms}ms` : (health.loading ? '…' : 'FAIL')} note={health.ready?.body?.checks ? JSON.stringify(health.ready.body.checks) : undefined} />
        </div>
      </article>
    </div>
  );
}

function UiControlsPanel({ onNotify }) {
  const [ui, setUi] = useState(getUiDebugControls);
  useEffect(() => {
    installUiDebugControls();
    return subscribeUiDebugControls(setUi);
  }, []);

  return (
    <div className="space-y-4">
      <DeveloperAnimationPage onNotify={onNotify} />
      <article className={`${CARD} overflow-hidden`}>
        <div className="border-b border-[#eef2f7] px-4 py-3">
          <h3 className="text-[15px] font-extrabold text-[#1e3261]">UI Debug Overlays</h3>
        </div>
        <ToggleRow title="Show taps" description="Touch/click ripple indicator." checked={ui.showTaps} onChange={(v) => setUiDebugControl('showTaps', v)} />
        <ToggleRow title="Pointer location" description="Show X/Y coordinates HUD." checked={ui.pointerLocation} onChange={(v) => setUiDebugControl('pointerLocation', v)} />
        <ToggleRow title="Show layout bounds" description="Outline interactive UI elements." checked={ui.layoutBounds} onChange={(v) => setUiDebugControl('layoutBounds', v)} />
        <ToggleRow title="Force RTL" description="Temporary RTL preview — does not overwrite saved language." checked={ui.forceRtl} onChange={(v) => setUiDebugControl('forceRtl', v)} />
        <ToggleRow
          title="Stay awake"
          description="Screen Wake Lock API where supported."
          checked={ui.stayAwake}
          onChange={async (v) => {
            const next = await setUiDebugControl('stayAwake', v);
            setUi(next);
            if (v && !('wakeLock' in navigator)) onNotify?.('Wake Lock unsupported on this device', 'error');
          }}
        />
        <ToggleRow title="Rendering diagnostics" description="CSS compositing/outline diagnostics." checked={ui.renderingDiagnostics} onChange={(v) => setUiDebugControl('renderingDiagnostics', v)} />
      </article>
    </div>
  );
}

function TestingLabPanel({ onNotify }) {
  const [sim, setSim] = useState(getNetworkSimulatorState);
  useEffect(() => subscribeApiInspector(() => setSim(getNetworkSimulatorState())), []);
  const apply = (patch) => {
    const next = setNetworkSimulatorState({ ...getNetworkSimulatorState(), ...patch, active: true });
    setSim(next);
    pushDebugLog({ level: 'WARNING', category: 'testing', message: 'Network simulator updated', meta: next });
    onNotify?.('Test session network rules updated', 'success');
  };

  return (
    <div className="space-y-4">
      <article className={`${CARD} p-4`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[16px] font-extrabold text-[#1e3261]">Testing Lab</h3>
            <p className="mt-1 text-[12px] font-semibold text-[#b45309]">Session-local only. Exit Developer Mode resets simulations.</p>
          </div>
          <button type="button" className="h-9 rounded-[8px] border border-[#fecaca] bg-[#fef2f2] px-3 text-[12px] font-extrabold text-[#b91c1c]" onClick={() => { resetNetworkSimulator(); setSim(getNetworkSimulatorState()); onNotify?.('Network simulator reset', 'success'); }}>Reset sim</button>
        </div>
        <ToggleRow title="Enable simulator" description="Required for delay / offline / HTTP error rules." checked={sim.active} onChange={(v) => setSim(setNetworkSimulatorState({ active: v }))} />
        <ToggleRow title="Offline simulation" description="Fail API requests immediately." checked={sim.offline} onChange={(v) => apply({ offline: v, timeout: false, httpError: null })} />
        <ToggleRow title="Force timeout" description="Abort requests as timed out." checked={sim.timeout} onChange={(v) => apply({ timeout: v, offline: false })} />
        <div className="px-4 py-3">
          <p className="text-[13px] font-extrabold text-[#1e3261]">Network delay</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[0, 200, 500, 1000, 3000, 5000].map((ms) => (
              <button key={ms} type="button" onClick={() => apply({ delayMs: ms })} className={`rounded-full px-3 py-1.5 text-[12px] font-extrabold ${sim.delayMs === ms ? 'bg-[#078c3e] text-white' : 'border border-[#d9e2ec] bg-white'}`}>
                {ms === 0 ? 'No delay' : ms >= 1000 ? `${ms / 1000}s` : `${ms}ms`}
              </button>
            ))}
          </div>
        </div>
        <div className="border-t border-[#eef2f7] px-4 py-3">
          <p className="text-[13px] font-extrabold text-[#1e3261]">HTTP error simulation</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[null, 401, 403, 404, 429, 500, 503].map((code) => (
              <button key={String(code)} type="button" onClick={() => apply({ httpError: code, offline: false, timeout: false })} className={`rounded-full px-3 py-1.5 text-[12px] font-extrabold ${sim.httpError === code ? 'bg-[#dc2626] text-white' : 'border border-[#d9e2ec] bg-white'}`}>
                {code == null ? 'None' : code}
              </button>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}

function AdvancedPanel({ onNotify }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      <article className={`${CARD} divide-y divide-[#eef2f7]`}>
        {[
          {
            title: 'Force Refresh',
            desc: 'Reload CRM with cache-bypass hint.',
            action: () => {
              const url = new URL(window.location.href);
              url.searchParams.set('_dev_refresh', String(Date.now()));
              window.location.replace(url.toString());
            },
          },
          {
            title: 'Clear Application Cache',
            desc: 'Cache Storage + non-essential local keys. Auth kept.',
            action: async () => {
              if (!window.confirm('Clear application caches? Login session will be kept.')) return;
              setBusy(true);
              try {
                const report = await clearApplicationCaches({ keepAuth: true });
                onNotify?.(`Cleared ${report.cachesDeleted} caches`, 'success');
              } finally {
                setBusy(false);
              }
            },
          },
          {
            title: 'Reset Local Settings',
            desc: 'Developer session flags / simulators only — no server data.',
            action: async () => {
              if (!window.confirm('Reset local developer settings?')) return;
              resetLocalDeveloperSettings();
              await resetUiDebugControls();
              resetNetworkSimulator();
              onNotify?.('Local developer settings reset', 'success');
            },
          },
        ].map((item) => (
          <div key={item.title} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-[14px] font-extrabold text-[#1e3261]">{item.title}</p>
              <p className="text-[12px] font-semibold text-[#64748b]">{item.desc}</p>
            </div>
            <button type="button" disabled={busy} className="h-9 rounded-[8px] bg-[#078c3e] px-3 text-[12px] font-extrabold text-white disabled:opacity-60" onClick={item.action}>Run</button>
          </div>
        ))}
      </article>
      <article className={`${CARD} p-4`}>
        <h3 className="text-[14px] font-extrabold text-[#1e3261]">Application Configuration Inspector</h3>
        <pre className="mt-2 overflow-auto rounded-[10px] bg-[#0f172a] p-3 text-[11px] text-[#e2e8f0]">{JSON.stringify({
          apiBase: API_BASE_PUBLIC,
          mode: import.meta.env.MODE,
          viteApiSet: Boolean(import.meta.env.VITE_API_URL),
          secrets: '[masked]',
        }, null, 2)}</pre>
      </article>
    </div>
  );
}

function DataToolsPanel({ apiSnap, onNotify }) {
  const [storage, setStorage] = useState(null);
  useEffect(() => { getStorageDiagnostics().then(setStorage); }, []);
  return (
    <div className="space-y-4">
      <article className={`${CARD} p-4`}>
        <h3 className="text-[16px] font-extrabold text-[#1e3261]">Data Tools</h3>
        <p className="mt-1 text-[12px] font-semibold text-[#64748b]">Exports exclude tokens, passwords and raw PII payloads.</p>
        <button
          type="button"
          className="mt-3 inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#078c3e] px-4 text-[13px] font-extrabold text-white"
          onClick={async () => {
            const storageNow = storage || await getStorageDiagnostics();
            const report = buildDiagnosticReport({
              apiSnapshot: apiSnap,
              perf: getPerformanceSnapshot(),
              logs: getDebugLogs(),
              storage: storageNow,
              appInfo: {
                href: window.location.href,
                userAgent: navigator.userAgent,
                standalone: window.matchMedia('(display-mode: standalone)').matches,
                apiBase: API_BASE_PUBLIC,
              },
            });
            const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `crm-diagnostic-report-${Date.now()}.json`;
            a.click();
            onNotify?.('Diagnostic report exported', 'success');
          }}
        >
          <Download className="size-4" /> Export diagnostic report
        </button>
      </article>
      <article className={`${CARD} p-4`}>
        <h3 className="text-[14px] font-extrabold text-[#1e3261]">Storage usage</h3>
        <pre className="mt-2 overflow-auto rounded-[10px] bg-[#f8fafc] p-3 text-[11px] text-[#334155]">{JSON.stringify(storage, null, 2)}</pre>
      </article>
    </div>
  );
}

function SystemInfoPanel() {
  const info = {
    application: 'Malwa Solar CRM',
    environment: import.meta.env.PROD ? 'Production' : 'Development',
    frontend: 'React + Vite',
    platform: window.matchMedia('(display-mode: standalone)').matches ? 'PWA / possible TWA' : 'Browser',
    userAgent: navigator.userAgent,
    language: navigator.language,
    screen: `${window.screen.width} × ${window.screen.height}`,
    viewport: `${window.innerWidth} × ${window.innerHeight}`,
    apiBase: API_BASE_PUBLIC,
    deviceMemory: navigator.deviceMemory ?? 'Unavailable',
    hardwareConcurrency: navigator.hardwareConcurrency ?? 'Unavailable',
  };
  return (
    <article className={`${CARD} p-4`}>
      <h3 className="text-[16px] font-extrabold text-[#1e3261]">System Information</h3>
      <pre className="mt-3 overflow-auto rounded-[10px] bg-[#0f172a] p-3 text-[11px] text-[#e2e8f0]">{JSON.stringify(info, null, 2)}</pre>
    </article>
  );
}

function LegacyToolsPanel({ onNotify }) {
  const [tab, setTab] = useState('memory');
  const tabs = [
    ['memory', 'Memory'],
    ['whatsapp-extension', 'WhatsApp'],
    ['attendance-machine', 'Attendance'],
    ['audit-logs', 'Audit'],
    ['bug-reports', 'Bugs'],
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-full px-3 py-1.5 text-[12px] font-extrabold ${tab === id ? 'bg-[#078c3e] text-white' : 'border border-[#d9e2ec] bg-white'}`}>{label}</button>
        ))}
      </div>
      {tab === 'memory' ? <DeveloperMemoryPage onNotify={onNotify} /> : null}
      {tab === 'whatsapp-extension' ? <DeveloperWhatsAppExtensionPage onNotify={onNotify} /> : null}
      {tab === 'attendance-machine' ? <DeveloperAttendanceMachinePage onNotify={onNotify} /> : null}
      {tab === 'audit-logs' ? <DeveloperAuditLogsPage onNotify={onNotify} /> : null}
      {tab === 'bug-reports' ? <DeveloperBugReportsPage onNotify={onNotify} /> : null}
    </div>
  );
}

export default function DeveloperConsole({ onNotify, onExit }) {
  const [category, setCategory] = useState('home');
  const [query, setQuery] = useState('');
  const [apiSnap, setApiSnap] = useState(getApiInspectorSnapshot);

  useEffect(() => {
    installUiDebugControls();
    pushDebugLog({ level: 'INFO', category: 'developer', message: 'Developer Mode enabled' });
    return subscribeApiInspector(setApiSnap);
  }, []);

  const filteredCats = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DEVELOPER_CATEGORIES;
    return DEVELOPER_CATEGORIES.filter((c) => `${c.label} ${c.hint}`.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    if (!query.trim()) return;
    if (filteredCats.length === 1) setCategory(filteredCats[0].id);
  }, [query, filteredCats]);

  const title = category === 'home'
    ? 'Overview'
    : (DEVELOPER_CATEGORIES.find((c) => c.id === category)?.label || 'Developer');

  const body = (() => {
    if (category === 'home') {
      return (
        <HomeDashboard
          apiSnap={apiSnap}
          onNotify={onNotify}
          onExit={onExit}
          onOpenCategory={setCategory}
        />
      );
    }
    switch (category) {
      case 'performance': return <PerformancePanel apiSnap={apiSnap} />;
      case 'debugging': return <DebuggingPanel apiSnap={apiSnap} onNotify={onNotify} />;
      case 'diagnostics': return <DiagnosticsPanel onNotify={onNotify} />;
      case 'ui': return <UiControlsPanel onNotify={onNotify} />;
      case 'testing': return <TestingLabPanel onNotify={onNotify} />;
      case 'advanced': return <AdvancedPanel onNotify={onNotify} />;
      case 'data': return <DataToolsPanel apiSnap={apiSnap} onNotify={onNotify} />;
      case 'system': return <SystemInfoPanel />;
      case 'legacy': return <LegacyToolsPanel onNotify={onNotify} />;
      default: return null;
    }
  })();

  return (
    <div className="space-y-4">
      <article className={`${CARD} overflow-hidden`}>
        <div className="flex flex-wrap items-center gap-3 border-b border-[#eef2f7] px-4 py-3">
          {category !== 'home' ? (
            <button type="button" onClick={() => setCategory('home')} className="inline-flex h-9 items-center gap-1 rounded-[8px] border border-[#d9e2ec] px-3 text-[12px] font-extrabold text-[#1e3261]">
              <ArrowLeft className="size-3.5" /> Home
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-[#7a8fa6]">Developer Console{category !== 'home' ? ` · ${title}` : ''}</p>
            {category !== 'home' ? <h2 className="truncate font-display text-[18px] font-extrabold text-[#1e3261]">{title}</h2> : null}
          </div>
          <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-[10px] border border-[#e6edf6] bg-[#f8fafc] px-3">
            <Search className="size-4 text-[#94a3b8]" />
            <input className="h-10 w-full bg-transparent text-[13px] font-semibold outline-none" placeholder="Search developer settings…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <button type="button" onClick={onExit} className="inline-flex h-9 items-center gap-1 rounded-full border border-[#fed7aa] bg-[#fff7ed] px-3 text-[12px] font-extrabold text-[#9a3412]">
            <X className="size-3.5" /> Exit
          </button>
        </div>
        <div className="p-3 md:p-5">{body}</div>
      </article>
      <div className="flex items-start gap-2 rounded-[10px] border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[12px] font-semibold text-[#92400e]">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        Exact native CPU/total device RAM unavailable in web/TWA — shown as Unavailable. Fake values intentionally nahi dikhaye.
      </div>
    </div>
  );
}
