import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bug,
  Check,
  Code2,
  Download,
  Eye,
  FileText,
  Fingerprint,
  FolderOpen,
  Link2,
  Lock,
  MessageCircle,
  Plug,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ToggleRight,
  Trash2,
  X,
} from 'lucide-react';
import { getMediaUrl, settingsApi } from './api.js';
import { ReportProblemModal } from './components/ReportProblemButton.jsx';
import { UnderlineTabs } from './components/UnderlineTabs.jsx';
import { MobileSubnavSelect } from './components/mobile/MobileSubnavSelect.jsx';
import { DEVELOPER_SETTINGS_TABS } from './hooks/useDeveloperMode.js';

const CARD = 'rounded-[12px] border border-[#dbe5f2] bg-white shadow-[0_8px_24px_rgba(24,48,87,0.06)]';
const WA_SMART_ZIP_URL = '/extension/malwa-wa-smart.zip?v=2.0.5';

function normalizeList(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.results)) return res.results;
  return [];
}

function FieldLabel({ children }) {
  return <p className="text-[10px] font-extrabold tracking-[0.08em] text-[#7a8fa6] uppercase">{children}</p>;
}

function StatusPill({ label, tone = 'green' }) {
  const tones = {
    green: 'bg-[#dcfce7] text-[#15803d]',
    red: 'bg-[#fee2e2] text-[#b91c1c]',
    amber: 'bg-[#fef3c7] text-[#b45309]',
    blue: 'bg-[#dbeafe] text-[#1d4ed8]',
    slate: 'bg-[#eef2f7] text-[#53647f]',
  };
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${tones[tone] || tones.slate}`}>{label}</span>;
}

export function DeveloperModeToggle({ active, onToggle }) {
  if (!active) return null;
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label="Developer Mode on. Click to turn off."
      onClick={onToggle}
      className="inline-flex h-9 w-auto max-w-none shrink-0 items-center gap-2 rounded-full border border-[#fed7aa] bg-[#fff7ed] px-3 shadow-[0_4px_12px_rgba(234,88,12,0.12)]"
    >
      <Code2 className="size-4 shrink-0 text-[#ea580c]" />
      <span className="whitespace-nowrap text-[12px] font-extrabold text-[#9a3412]">Developer Mode</span>
      <span className="whitespace-nowrap text-[11px] font-bold text-[#c2410c]">On</span>
      <span
        aria-hidden="true"
        className="relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full bg-[#f97316] p-0.5"
      >
        <span className="ml-auto block size-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(15,23,42,0.28)]" />
      </span>
    </button>
  );
}

export function DeveloperSettingsTabs({ activeId, onChange }) {
  const items = DEVELOPER_SETTINGS_TABS.map((tab) => ({ value: tab.id, label: tab.label }));
  return (
    <div className="space-y-2">
      <section className={`${CARD} p-3 md:hidden`}>
        <MobileSubnavSelect label="Developer" items={items} value={activeId} onChange={onChange} />
      </section>
      <UnderlineTabs items={items} value={activeId} onChange={onChange} tone="red" />
    </div>
  );
}

export function DeveloperMemoryPage({ onNotify }) {
  const [notes, setNotes] = useState('');
  const [meta, setMeta] = useState({ session: '—', storage: '—' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await settingsApi.developerMemory.get();
      setNotes(data?.notes || '');
      setMeta({ session: data?.session || 'Developer Mode', storage: data?.storage || 'database' });
    } catch (err) {
      onNotify?.(err.message || 'Memory load failed', 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <article className={`${CARD} p-5`}>
        <h2 className="flex items-center gap-2 font-display text-[18px] font-extrabold text-[#1e3261]">
          <Shield className="size-5 text-[#0b65e5]" />
          Memory
        </h2>
        <p className="mt-1 text-[13px] font-semibold text-[#53647f]">
          Per-user developer scratch notes stored in the database.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[10px] border border-[#e7eef7] p-3">
            <FieldLabel>Session</FieldLabel>
            <p className="mt-1 text-[14px] font-extrabold text-[#1e3261]">{meta.session}</p>
          </div>
          <div className="rounded-[10px] border border-[#e7eef7] p-3">
            <FieldLabel>Storage</FieldLabel>
            <p className="mt-1 text-[14px] font-extrabold text-[#1e3261]">{meta.storage}</p>
          </div>
        </div>
      </article>
      <article className={`${CARD} p-5`}>
        <h3 className="text-[15px] font-extrabold text-[#1e3261]">Scratch notes</h3>
        <textarea
          className="mt-3 min-h-[140px] w-full rounded-[10px] border border-[#d9e2ec] px-3 py-2 text-[13px] font-semibold text-[#1e3261] disabled:opacity-60"
          value={notes}
          disabled={loading}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={loading ? 'Loading…' : 'Temporary notes for this user…'}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving || loading}
            className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#0d9f4a] px-4 text-[13px] font-extrabold text-white disabled:opacity-60"
            onClick={async () => {
              setSaving(true);
              try {
                await settingsApi.developerMemory.update({ notes });
                onNotify?.('Memory notes saved', 'success');
              } catch (err) {
                onNotify?.(err.message || 'Save failed', 'error');
              } finally {
                setSaving(false);
              }
            }}
          >
            Save
          </button>
          <button
            type="button"
            disabled={saving || loading}
            className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#d9e2ec] bg-white px-4 text-[13px] font-extrabold text-[#1e3261] disabled:opacity-60"
            onClick={async () => {
              setSaving(true);
              try {
                setNotes('');
                await settingsApi.developerMemory.update({ notes: '' });
                onNotify?.('Memory notes cleared', 'success');
              } catch (err) {
                onNotify?.(err.message || 'Clear failed', 'error');
              } finally {
                setSaving(false);
              }
            }}
          >
            Clear
          </button>
          <button type="button" className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#d9e2ec] bg-white px-3" onClick={load} aria-label="Refresh">
            <RefreshCw className="size-4" />
          </button>
        </div>
      </article>
    </div>
  );
}

export function DeveloperAttendanceMachinePage({ onNotify }) {
  const today = new Date();
  const toIso = (d) => d.toISOString().slice(0, 10);
  const [config, setConfig] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 7);
    return toIso(d);
  });
  const [toDate, setToDate] = useState(() => toIso(today));
  const [empCode, setEmpCode] = useState('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await settingsApi.attendanceMachine.get();
      setConfig(data?.config || null);
      setRuns(Array.isArray(data?.recent_runs) ? data.recent_runs : []);
      if (data?.config?.default_lookback_days) {
        const d = new Date();
        d.setDate(d.getDate() - Number(data.config.default_lookback_days || 7));
        setFromDate(toIso(d));
      }
    } catch (err) {
      onNotify?.(err.message || 'Attendance machine load failed', 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <article className={`${CARD} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-[18px] font-extrabold text-[#1e3261]">
              <Fingerprint className="size-5 text-[#0b65e5]" />
              Attendance Machine
            </h2>
            <p className="mt-1 max-w-3xl text-[13px] font-semibold text-[#53647f]">
              Team Office / eTimeOffice biometric punches → Employee attendance card. Day-to-day sync is on the Employee page; this screen is for admin setup and manual range sync.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill label={config?.is_configured ? 'Configured' : 'Not configured'} tone={config?.is_configured ? 'green' : 'amber'} />
            <button type="button" className="text-[12px] font-extrabold text-[#0b65e5] hover:underline" onClick={load}>Refresh</button>
          </div>
        </div>
        <div className="mt-4 rounded-[10px] border border-[#bfdbfe] bg-[#eff6ff] p-4">
          <p className="text-[13px] font-extrabold text-[#1e40af]">How to use</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[12px] font-semibold text-[#1e3a8a]">
            <li>Set each employee&apos;s Attendance Emp Code (e.g. 0007, 0012) to match the biometric machine.</li>
            <li>On Employee → Attendance, select employee + month/week, then use Sync Machine.</li>
            <li>Use Manual sync below only when you need a custom date range or ALL employees at once.</li>
          </ol>
          <p className="mt-3 text-[11px] font-bold text-[#64748b]">
            Auto sync is {config?.auto_sync ? 'ON' : 'OFF'} → change via config below / server env.
          </p>
        </div>
      </article>

      <article className={`${CARD} p-5`}>
        <h3 className="text-[15px] font-extrabold text-[#1e3261]">Connection</h3>
        {loading && !config ? <p className="mt-3 text-[13px] font-semibold text-[#7a8fa6]">Loading…</p> : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Corporate ID', config?.corporate_id || '—'],
              ['Username', config?.username || '—'],
              ['Auto Sync', config?.auto_sync ? 'On' : 'Off'],
              ['Late After', config?.late_after || '—'],
              ['Default Lookback', `${config?.default_lookback_days ?? 7} days`],
              ['API Endpoint', config?.api_endpoint || '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <FieldLabel>{label}</FieldLabel>
                <p className="mt-1 text-[14px] font-extrabold break-all text-[#1e3261]">{value}</p>
              </div>
            ))}
          </div>
        )}
        {config?.last_sync_at ? (
          <p className="mt-4 text-[12px] font-semibold text-[#7a8fa6]">
            Last sync: {new Date(config.last_sync_at).toLocaleString('en-IN')} · {config.last_sync_status} · {config.last_sync_detail}
          </p>
        ) : null}
      </article>

      <article className={`${CARD} p-5`}>
        <h3 className="text-[15px] font-extrabold text-[#1e3261]">Manual sync</h3>
        <p className="mt-1 text-[12px] font-semibold text-[#53647f]">Pull punches for a date range. Emp code ALL = every mapped employee.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-[12px] font-bold text-[#53647f]">
            From date
            <input type="date" className="mt-1.5 h-11 w-full rounded-[8px] border border-[#d9e2ec] px-3" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>
          <label className="text-[12px] font-bold text-[#53647f]">
            To date
            <input type="date" className="mt-1.5 h-11 w-full rounded-[8px] border border-[#d9e2ec] px-3" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </label>
          <label className="text-[12px] font-bold text-[#53647f]">
            Emp code
            <input className="mt-1.5 h-11 w-full rounded-[8px] border border-[#d9e2ec] px-3 font-extrabold text-[#1e3261]" value={empCode} onChange={(e) => setEmpCode(e.target.value)} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            className="inline-flex h-11 items-center gap-2 rounded-[8px] border border-[#d9e2ec] bg-white px-4 text-[13px] font-extrabold text-[#1e3261] disabled:opacity-60"
            onClick={async () => {
              setBusy(true);
              try {
                const res = await settingsApi.attendanceMachine.test();
                onNotify?.(res?.detail || (res?.ok ? 'Connection OK' : 'Not configured'), res?.ok ? 'success' : 'error');
              } catch (err) {
                onNotify?.(err.message || 'Test failed', 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Plug className="size-4" />
            Test connection
          </button>
          <button
            type="button"
            disabled={busy}
            className="inline-flex h-11 items-center gap-2 rounded-[8px] bg-[#dc2626] px-4 text-[13px] font-extrabold text-white disabled:opacity-60"
            onClick={async () => {
              setBusy(true);
              try {
                const res = await settingsApi.attendanceMachine.sync({ from_date: fromDate, to_date: toDate, emp_code: empCode });
                onNotify?.(res?.detail || `Sync ${res?.status}`, res?.status === 'done' ? 'success' : 'error');
                await load();
              } catch (err) {
                onNotify?.(err.message || 'Sync failed', 'error');
                await load();
              } finally {
                setBusy(false);
              }
            }}
          >
            <RefreshCw className={`size-4 ${busy ? 'animate-spin' : ''}`} />
            Sync attendance
          </button>
        </div>
        {runs.length ? (
          <div className="mt-5 overflow-x-auto rounded-[10px] border border-[#eef2f7]">
            <table className="min-w-full text-left text-[12px]">
              <thead className="bg-[#f8fafc] text-[10px] font-extrabold text-[#7a8fa6] uppercase">
                <tr>
                  {['When', 'Range', 'Emp', 'Status', 'Rows', 'Detail'].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-t border-[#eef2f7]">
                    <td className="px-3 py-2 whitespace-nowrap">{run.created_at ? new Date(run.created_at).toLocaleString('en-IN') : '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{run.from_date} → {run.to_date}</td>
                    <td className="px-3 py-2 font-extrabold">{run.emp_code}</td>
                    <td className="px-3 py-2"><StatusPill label={run.status} tone={run.status === 'done' ? 'green' : run.status === 'error' ? 'red' : 'amber'} /></td>
                    <td className="px-3 py-2">{run.punches_imported}</td>
                    <td className="max-w-[280px] truncate px-3 py-2 text-[#53647f]">{run.detail || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </article>
    </div>
  );
}

export function DeveloperAuditLogsPage({ onNotify }) {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ total: 0, showing: 0, adds: 0, deletes: 0 });
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('All');
  const [entity, setEntity] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewRow, setViewRow] = useState(null);
  const [loading, setLoading] = useState(true);

  const params = useMemo(() => ({
    search: query,
    action: action === 'All' ? '' : action,
    entity: entity === 'All' ? '' : entity,
    date_from: dateFrom,
    date_to: dateTo,
  }), [query, action, entity, dateFrom, dateTo]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, sum] = await Promise.all([
        settingsApi.auditEvents.list(params),
        settingsApi.auditEvents.summary(params),
      ]);
      setRows(normalizeList(list));
      setSummary({
        total: sum?.total ?? 0,
        showing: sum?.showing ?? normalizeList(list).length,
        adds: sum?.adds ?? 0,
        deletes: sum?.deletes ?? 0,
      });
    } catch (err) {
      onNotify?.(err.message || 'Audit logs load failed', 'error');
    } finally {
      setLoading(false);
    }
  }, [params, onNotify]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <article className={`${CARD} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-[18px] font-extrabold text-[#1e3261]">
              <FileText className="size-5 text-[#0b65e5]" />
              Audit Logs
            </h2>
            <p className="mt-1 text-[13px] font-semibold text-[#53647f]">Add / update / delete history — view only (JSON in SQL)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#0d9f4a] px-4 text-[13px] font-extrabold text-white" onClick={() => onNotify?.('Use browser print / copy JSON for export', 'success')}>
              <Download className="size-4" />
              Export
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#dc2626] px-4 text-[13px] font-extrabold text-white"
              onClick={async () => {
                try {
                  await settingsApi.auditEvents.clear();
                  onNotify?.('Audit logs cleared', 'success');
                  await load();
                } catch (err) {
                  onNotify?.(err.message || 'Clear failed', 'error');
                }
              }}
            >
              <Trash2 className="size-4" />
              Clear
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1.4fr)_140px_140px_140px_140px]">
          <input className="h-11 rounded-[8px] border border-[#d9e2ec] px-3 text-[13px]" placeholder="Search user, branch, entity, description..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="h-11 rounded-[8px] border border-[#d9e2ec] px-3 text-[13px] font-bold" value={action} onChange={(e) => setAction(e.target.value)}>
            {['All', 'ADD', 'UPDATE', 'DELETE', 'CLEAR', 'SYNC'].map((opt) => <option key={opt} value={opt}>{opt === 'All' ? 'All Actions' : opt}</option>)}
          </select>
          <select className="h-11 rounded-[8px] border border-[#d9e2ec] px-3 text-[13px] font-bold" value={entity} onChange={(e) => setEntity(e.target.value)}>
            {['All', 'audit_logs', 'bug_report', 'attendance_machine', 'whatsapp_message'].map((opt) => <option key={opt} value={opt}>{opt === 'All' ? 'All Entities' : opt}</option>)}
          </select>
          <input type="date" className="h-11 rounded-[8px] border border-[#d9e2ec] px-3 text-[13px]" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <input type="date" className="h-11 rounded-[8px] border border-[#d9e2ec] px-3 text-[13px]" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {[
            ['Total', summary.total, 'bg-[#dbeafe] text-[#1d4ed8]'],
            ['Showing', summary.showing, 'bg-[#dcfce7] text-[#15803d]'],
            ['Adds', summary.adds, 'bg-[#ecfccb] text-[#3f6212]'],
            ['Deletes', summary.deletes, 'bg-[#fce7f3] text-[#9d174d]'],
          ].map(([label, value, tone]) => (
            <div key={label} className={`rounded-[10px] px-4 py-3 ${tone}`}>
              <p className="text-[11px] font-extrabold uppercase opacity-80">{label}</p>
              <p className="mt-1 text-[22px] font-black">{value}</p>
            </div>
          ))}
        </div>
      </article>

      <article className={`${CARD} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[13px]">
            <thead className="bg-[#f8fafc] text-[11px] font-extrabold tracking-wide text-[#7a8fa6] uppercase">
              <tr>
                {['Date & Time', 'User', 'Branch', 'Action', 'Entity', 'Description', 'View'].map((h) => (
                  <th key={h} className="px-3 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-[#7a8fa6]">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-[#7a8fa6]">Koi audit log nahi mila.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id} className="border-t border-[#eef2f7]">
                  <td className="px-3 py-3 whitespace-nowrap font-semibold text-[#30466d]">{row.created_at ? new Date(row.created_at).toLocaleString('en-IN') : '—'}</td>
                  <td className="px-3 py-3 font-extrabold text-[#1e3261]">{row.user_name || '—'}</td>
                  <td className="px-3 py-3 text-[#53647f]">{row.branch || '—'}</td>
                  <td className="px-3 py-3"><StatusPill label={row.action} tone={row.action === 'CLEAR' || row.action === 'DELETE' ? 'red' : 'blue'} /></td>
                  <td className="px-3 py-3 font-semibold text-[#30466d]">{row.entity}</td>
                  <td className="px-3 py-3 text-[#53647f]">{row.description}</td>
                  <td className="px-3 py-3">
                    <button type="button" className="rounded-[8px] border border-[#d9e2ec] p-2 text-[#0b65e5]" onClick={() => setViewRow(row)} aria-label="View JSON">
                      <Eye className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-[#eef2f7] px-4 py-3 text-[11px] font-semibold text-[#9aa8bc]">
          Showing {rows.length} logs · Edit disabled · Eye = full JSON
        </p>
      </article>

      {viewRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1b33]/45 p-4 backdrop-blur-[2px]" onClick={() => setViewRow(null)}>
          <div className={`${CARD} max-h-[80vh] w-full max-w-xl overflow-auto p-5`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-extrabold text-[#1e3261]">Audit JSON</h3>
              <button type="button" onClick={() => setViewRow(null)} className="rounded-[8px] p-2 hover:bg-[#f1f5f9]"><X className="size-4" /></button>
            </div>
            <pre className="mt-3 overflow-auto rounded-[10px] bg-[#0f172a] p-4 text-[12px] text-[#e2e8f0]">{JSON.stringify(viewRow, null, 2)}</pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DeveloperBugReportsPage({ onNotify }) {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('open');
  const [reportOpen, setReportOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter === 'all' ? {} : { status: filter };
      const list = await settingsApi.bugReports.list(params);
      setRows(normalizeList(list));
    } catch (err) {
      onNotify?.(err.message || 'Bug reports load failed', 'error');
    } finally {
      setLoading(false);
    }
  }, [filter, onNotify]);

  useEffect(() => { load(); }, [load]);

  const openCount = rows.filter((r) => r.status === 'open').length;

  return (
    <div className="space-y-4">
      <article className={`${CARD} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-[18px] font-extrabold text-[#1e3261]">
              <Bug className="size-5 text-[#dc2626]" />
              Bug Reports
            </h2>
            <p className="mt-1 text-[13px] font-semibold text-[#53647f]">Compact list — View pe full detail. Open: {openCount}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[
              ['open', 'Open', 'bg-[#dc2626] text-white'],
              ['resolved', 'Resolved', 'bg-[#eef2f7] text-[#53647f]'],
              ['all', 'All', 'bg-[#eef2f7] text-[#53647f]'],
            ].map(([id, label, cls]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-extrabold ${filter === id ? cls : 'bg-[#eef2f7] text-[#53647f]'}`}
              >
                {label}
              </button>
            ))}
            <button type="button" className="rounded-[8px] border border-[#d9e2ec] p-2" onClick={load} aria-label="Refresh">
              <RefreshCw className="size-4 text-[#53647f]" />
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#dc2626] px-3 text-[12px] font-extrabold text-white"
              onClick={async () => {
                try {
                  const res = await settingsApi.bugReports.clearResolved();
                  onNotify?.(`Cleared ${res?.deleted ?? 0} resolved reports`, 'success');
                  await load();
                } catch (err) {
                  onNotify?.(err.message || 'Clear failed', 'error');
                }
              }}
            >
              <Lock className="size-3.5" />
              Clear
            </button>
            <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#d9e2ec] bg-white px-3 text-[12px] font-extrabold text-[#1e3261]" onClick={() => setReportOpen(true)}>
              Report
            </button>
          </div>
        </div>
      </article>

      {loading ? (
        <article className={`${CARD} p-8 text-center text-[13px] font-semibold text-[#7a8fa6]`}>Loading…</article>
      ) : rows.length === 0 ? (
        <article className={`${CARD} flex min-h-[240px] flex-col items-center justify-center p-8 text-center`}>
          <Bug className="size-12 text-[#e2e8f0]" />
          <p className="mt-3 text-[14px] font-extrabold text-[#53647f]">Is filter me koi bug report nahi hai.</p>
        </article>
      ) : (
        <article className={`${CARD} divide-y divide-[#eef2f7]`}>
          {rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-[14px] font-extrabold text-[#1e3261]">{row.title}</p>
                <p className="mt-0.5 text-[12px] font-semibold text-[#7a8fa6]">
                  {row.source_label || 'User'}
                  {' · '}
                  #{row.reporter_id || '—'} {row.reporter_name || 'Unknown'}
                  {row.occurrence_count > 1 ? ` · ${row.occurrence_count} times` : ''}
                  {' · '}
                  {row.created_at ? new Date(row.created_at).toLocaleString('en-IN') : '—'}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-[#9aa8bc]">{row.path}</p>
                {row.body ? <p className="mt-1 max-w-2xl text-[12px] text-[#53647f]">{row.body}</p> : null}
                {row.attachments?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {row.attachments.map((file) => (
                      file.kind === 'video' ? (
                        <video key={file.id} src={getMediaUrl(file.url)} controls className="h-24 max-w-[180px] rounded-[8px] bg-black" />
                      ) : (
                        <a key={file.id} href={getMediaUrl(file.url)} target="_blank" rel="noreferrer">
                          <img src={getMediaUrl(file.url)} alt={file.name || 'Bug photo'} className="h-16 w-24 rounded-[8px] object-cover" />
                        </a>
                      )
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <StatusPill label={row.source_label || 'User'} tone={row.source === 'auto' ? 'amber' : 'blue'} />
                <StatusPill label={row.status} tone={row.status === 'open' ? 'red' : 'green'} />
                {row.status === 'open' ? (
                  <button
                    type="button"
                    className="rounded-[8px] border border-[#d9e2ec] p-2 text-[#0d9f4a]"
                    onClick={async () => {
                      try {
                        await settingsApi.bugReports.resolve(row.id);
                        onNotify?.('Bug marked resolved', 'success');
                        await load();
                      } catch (err) {
                        onNotify?.(err.message || 'Resolve failed', 'error');
                      }
                    }}
                  >
                    <Check className="size-4" />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </article>
      )}

      {reportOpen ? (
        <ReportProblemModal
          path="/settings?tab=bugreports"
          onClose={() => setReportOpen(false)}
          onSubmit={async (payload) => {
            try {
              await settingsApi.bugReports.create(payload);
              setReportOpen(false);
              onNotify?.('Bug report submitted', 'success');
              await load();
            } catch (err) {
              onNotify?.(err.message || 'Submit failed', 'error');
            }
          }}
        />
      ) : null}
    </div>
  );
}

function InstallMalwaWaSmartModal({ onClose }) {
  const steps = [
    { title: 'Download', icon: Download, body: 'Extension ki .zip download karke unzip karein.' },
    { title: 'Developer mode', icon: ToggleRight, body: 'chrome://extensions → Developer mode ON.' },
    {
      title: 'Load unpacked',
      icon: FolderOpen,
      body: (
        <>
          Unzip karke <span className="font-extrabold text-[#1e3261]">malwa-wa-smart</span> folder Load unpacked se select karein.
        </>
      ),
    },
    {
      title: 'Connect',
      icon: Link2,
      body: (
        <>
          <span className="font-extrabold text-[#1e3261]">Connect Extension</span> se code lekar extension Settings me paste karein.
        </>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1b33]/45 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className={`${CARD} w-full max-w-lg p-5 shadow-[0_24px_64px_rgba(15,23,42,0.28)]`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-[18px] font-extrabold text-[#111827]">Install Malwa WA Smart</h3>
          <button type="button" onClick={onClose} className="rounded-[8px] p-2 text-[#64748b] hover:bg-[#f1f5f9]" aria-label="Close"><X className="size-4" /></button>
        </div>
        <div className="mt-4 flex gap-3 rounded-[10px] border border-[#fecaca] bg-[#fef2f2] px-3.5 py-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-[#dc2626]" />
          <p className="text-[13px] font-semibold leading-relaxed text-[#7f1d1d]">
            Pehle purani <span className="font-extrabold text-[#b91c1c]">Malwa Smart Lead Capture</span> hatao:{' '}
            <span className="font-bold">chrome://extensions</span> → Remove. Phir ye naya{' '}
            <span className="font-extrabold text-[#b91c1c]">Malwa WA Smart v2</span> load karo.
          </p>
        </div>
        <ol className="mt-5 space-y-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="flex gap-3">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#dcfce7] text-[#15803d]">
                  <Icon className="size-4" />
                </span>
                <div>
                  <p className="text-[13px] font-extrabold text-[#111827]">{index + 1}. {step.title}</p>
                  <p className="mt-0.5 text-[12px] font-semibold leading-relaxed text-[#53647f]">{step.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <a href={WA_SMART_ZIP_URL} download className="mt-6 inline-flex items-center gap-2 text-[14px] font-extrabold text-[#dc2626] hover:underline">
          <Download className="size-4" />
          Download Malwa WA Smart ZIP
        </a>
      </div>
    </div>
  );
}

export function DeveloperWhatsAppExtensionPage({ onNotify }) {
  const [moduleFilter, setModuleFilter] = useState('All Messages');
  const [query, setQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState('All');
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ total: 0, last_sync: null });
  const [installOpen, setInstallOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [autoSync, setAutoSync] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        search: query,
        module: moduleFilter,
        date_from: dateFrom,
        date_to: dateTo,
        status: status === 'All' ? '' : status,
      };
      const [list, st] = await Promise.all([
        settingsApi.whatsappMessages.list(params),
        settingsApi.whatsappMessages.stats(params),
      ]);
      setRows(normalizeList(list));
      setStats({ total: st?.total ?? normalizeList(list).length, last_sync: st?.last_sync || null });
    } catch (err) {
      onNotify?.(err.message || 'WhatsApp messages load failed', 'error');
    } finally {
      setLoading(false);
    }
  }, [query, moduleFilter, dateFrom, dateTo, status, onNotify]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <article className={`${CARD} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-[18px] font-extrabold text-[#1e3261]">
              <MessageCircle className="size-5 text-[#16a34a]" />
              Source Data
            </h2>
            <p className="mt-1 text-[13px] font-semibold text-[#53647f]">Central hub — all modules • group routing • AI • extension connect</p>
            <p className="mt-2 text-[12px] font-bold text-[#7a8fa6]">
              <span className={`mr-2 inline-block size-2 rounded-full ${stats.total ? 'bg-[#16a34a]' : 'bg-[#94a3b8]'}`} />
              {stats.total ? 'Messages in database' : 'Extension not connected / empty inbox'}
              {stats.last_sync ? ` · Last message: ${new Date(stats.last_sync).toLocaleString('en-IN')}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="inline-flex h-10 items-center gap-1.5 rounded-[8px] border border-[#d9e2ec] bg-white px-3 text-[12px] font-extrabold text-[#1e3261]" onClick={() => window.open('https://web.whatsapp.com/', '_blank', 'noopener,noreferrer')}>WhatsApp Web</button>
            <button type="button" className="inline-flex h-10 items-center gap-1.5 rounded-[8px] border border-[#d9e2ec] bg-white px-3 text-[12px] font-extrabold text-[#1e3261]" onClick={() => setInstallOpen(true)}>
              <Download className="size-3.5" />
              Install
            </button>
            <button type="button" className="h-10 rounded-[8px] bg-[#dc2626] px-3 text-[12px] font-extrabold text-white" onClick={() => onNotify?.('Connect Extension: paste connect code in extension settings after install', 'success')}>Connect Extension</button>
            <button type="button" className="h-10 rounded-[8px] border border-[#d9e2ec] bg-white px-3 text-[12px] font-extrabold text-[#1e3261]" onClick={() => onNotify?.('AI Connectivity coming soon', 'success')}>AI Connectivity</button>
            <button type="button" className="rounded-[8px] border border-[#d9e2ec] p-2" onClick={load} aria-label="Refresh"><RefreshCw className="size-4" /></button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {['All Messages', 'Jobs', 'Accounts', 'Customer', 'Vendors', 'Inventory', 'O&M', 'Others'].map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setModuleFilter(label)}
              className={`rounded-[8px] px-3 py-1.5 text-[12px] font-extrabold ${moduleFilter === label ? 'bg-[#2563eb] text-white' : 'border border-[#d9e2ec] bg-white text-[#30466d]'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-2 rounded-[10px] border border-[#e7eef7] bg-[#f8fafc] p-3 md:grid-cols-[minmax(0,1.3fr)_120px_130px_130px_130px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-3 left-3 size-4 text-[#94a3b8]" />
            <input className="h-11 w-full rounded-[8px] border border-[#d9e2ec] bg-white pr-3 pl-9 text-[13px]" placeholder="Search message, vehicle no, number..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select className="h-11 rounded-[8px] border border-[#d9e2ec] bg-white px-2 text-[12px] font-bold" value={status} onChange={(e) => setStatus(e.target.value)}>
            {['All', 'Pending', 'Processed', 'Rejected'].map((s) => <option key={s}>{s}</option>)}
          </select>
          <input type="date" className="h-11 rounded-[8px] border border-[#d9e2ec] bg-white px-2 text-[12px]" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <input type="date" className="h-11 rounded-[8px] border border-[#d9e2ec] bg-white px-2 text-[12px]" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <select className="h-11 rounded-[8px] border border-[#d9e2ec] bg-white px-2 text-[12px] font-bold" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
            {['All Messages', 'Jobs', 'Accounts', 'Customer', 'Vendors', 'Inventory', 'O&M', 'Others'].map((s) => <option key={s}>{s}</option>)}
          </select>
          <div className="flex gap-2">
            <button type="button" className="inline-flex h-11 flex-1 items-center justify-center gap-1 rounded-[8px] bg-[#dc2626] px-3 text-[12px] font-extrabold text-white" onClick={load}><Search className="size-3.5" /> Search</button>
            <button type="button" className="inline-flex h-11 items-center justify-center rounded-[8px] border border-[#d9e2ec] bg-white px-3" onClick={() => { setQuery(''); setModuleFilter('All Messages'); setDateFrom(''); setDateTo(''); setStatus('All'); }}><X className="size-4" /></button>
          </div>
        </div>
      </article>

      <article className={`${CARD} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eef2f7] px-4 py-3">
          <h3 className="text-[15px] font-extrabold text-[#1e3261]">WhatsApp Messages (Latest First)</h3>
          <div className="flex items-center gap-3 text-[12px] font-bold text-[#53647f]">
            <span>Total: {stats.total}</span>
            <button type="button" className={`inline-flex items-center gap-1 rounded-[8px] px-2.5 py-1 ${autoSync ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#eef2f7] text-[#53647f]'}`} onClick={() => setAutoSync((v) => !v)}>
              <RefreshCw className="size-3.5" /> Auto Sync: {autoSync ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[12px]">
            <thead className="bg-[#f8fafc] text-[10px] font-extrabold tracking-wide text-[#7a8fa6] uppercase">
              <tr>
                {['#', 'Date & Time', 'From Number', 'Sender Name', 'Group / Module', 'Vehicle No', 'Message', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-3 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-[#7a8fa6]">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-[#7a8fa6]">Abhi koi WhatsApp message nahi hai. Extension connect karke messages yahan aayenge.</td></tr>
              ) : rows.map((row, idx) => (
                <tr key={row.id} className="border-t border-[#eef2f7]">
                  <td className="px-3 py-3 font-bold text-[#7a8fa6]">{idx + 1}</td>
                  <td className="px-3 py-3 whitespace-nowrap font-semibold text-[#30466d]">{row.occurred_at ? new Date(row.occurred_at).toLocaleString('en-IN') : '—'}</td>
                  <td className="px-3 py-3 font-extrabold text-[#1e3261]">{row.from_number || '—'}</td>
                  <td className="px-3 py-3 text-[#53647f]">{row.sender_name || '—'}</td>
                  <td className="px-3 py-3"><StatusPill label={row.group_module || '—'} tone="blue" /></td>
                  <td className="px-3 py-3 font-semibold text-[#30466d]">{row.vehicle_no || '—'}</td>
                  <td className="max-w-[220px] truncate px-3 py-3 text-[#53647f]">{row.message || '—'}</td>
                  <td className="px-3 py-3">
                    <StatusPill label={row.status} tone={row.status === 'Processed' ? 'green' : row.status === 'Rejected' ? 'red' : 'amber'} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <button type="button" className="rounded-[6px] border border-[#d9e2ec] p-1.5 text-[#0b65e5]" onClick={() => onNotify?.(row.message || 'No message', 'success')}><Eye className="size-3.5" /></button>
                      <button
                        type="button"
                        className="rounded-[6px] border border-[#d9e2ec] p-1.5 text-[#0d9f4a]"
                        onClick={async () => {
                          try {
                            await settingsApi.whatsappMessages.markProcessed(row.id);
                            await load();
                          } catch (err) {
                            onNotify?.(err.message || 'Update failed', 'error');
                          }
                        }}
                      >
                        <Check className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-[#eef2f7] px-4 py-3 text-[11px] font-semibold text-[#9aa8bc]">
          Showing {rows.length} of {stats.total} records
        </p>
      </article>

      {installOpen ? <InstallMalwaWaSmartModal onClose={() => setInstallOpen(false)} /> : null}
    </div>
  );
}

export function DeveloperSettingsPanel({ activeTab, onTabChange, onNotify }) {
  const content = (() => {
    switch (activeTab) {
      case 'memory':
        return <DeveloperMemoryPage onNotify={onNotify} />;
      case 'whatsapp-extension':
        return <DeveloperWhatsAppExtensionPage onNotify={onNotify} />;
      case 'attendance-machine':
        return <DeveloperAttendanceMachinePage onNotify={onNotify} />;
      case 'audit-logs':
        return <DeveloperAuditLogsPage onNotify={onNotify} />;
      case 'bug-reports':
        return <DeveloperBugReportsPage onNotify={onNotify} />;
      default:
        return <DeveloperAttendanceMachinePage onNotify={onNotify} />;
    }
  })();

  return (
    <div className="space-y-4">
      <DeveloperSettingsTabs activeId={activeTab} onChange={onTabChange} />
      {content}
    </div>
  );
}
