import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  Boxes, CheckCircle2, ChevronRight, ClipboardList, FolderKanban, Pencil, Plus,
  ReceiptText, Search, Trash2, Truck, Wallet, Wrench, X,
} from 'lucide-react';
import {
  installationMaterialApi, materialPlanApi, projectApi, projectChecklistApi,
  projectExpenseApi, projectMilestoneApi, userApi,
} from './api.js';
import { TableHeaderFilter } from './components/TableHeaderFilter.jsx';

const PANEL = 'rounded-[14px] border border-[#e7eef7] bg-white shadow-[0_10px_24px_rgba(17,39,84,0.05)]';
const HEADER_SELECT = 'mt-1 h-7 w-full min-w-[88px] max-w-[120px] rounded-[6px] border border-[#d5e0ef] bg-white px-1.5 text-[11px] font-semibold text-[#314a79] outline-none';

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function rowsOf(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function fmtRs(n) {
  if (n == null || n === '') return '—';
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function OpsHeading({ title, crumbs, actions }) {
  return (
    <div className="page-heading flex min-w-0 flex-col gap-2.5 rounded-[12px] bg-white/60 p-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-[24px] font-bold leading-[1.12] tracking-[-0.01em] text-[#111827] sm:text-[30px]">{title}</h1>
        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2 text-[13px] font-semibold">
          {crumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="inline-flex min-w-0 items-center gap-2">
              {crumb.onClick
                ? <button type="button" onClick={crumb.onClick} className="min-w-0 truncate text-[#0b65e5]">{crumb.label}</button>
                : <span className="min-w-0 truncate text-[#53647f]">{crumb.label}</span>}
              {index < crumbs.length - 1 ? <ChevronRight className="size-3.5 shrink-0 text-[#9aa8bc]" /> : null}
            </span>
          ))}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div> : null}
    </div>
  );
}

function Pill({ children, tone = 'slate' }) {
  const map = {
    green: 'bg-[#e8f8eb] text-[#0d9f4a]',
    amber: 'bg-[#fff0dc] text-[#f59e0b]',
    blue: 'bg-[#e8f2ff] text-[#0b65e5]',
    red: 'bg-[#fee2e2] text-[#dc2626]',
    slate: 'bg-[#eef2f7] text-[#7585a2]',
  };
  return <span className={cx('inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold', map[tone] || map.slate)}>{children}</span>;
}

function ConfirmBox({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0f172a]/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="w-full max-w-[400px] rounded-[14px] bg-white p-5 shadow-xl">
        <p className="text-[15px] font-extrabold text-[#1e3261]">Delete?</p>
        <p className="mt-2 text-[13px] font-medium text-[#53647f]">Delete {message}?</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-10 rounded-[8px] border border-[#d5e0ef] px-4 text-[13px] font-semibold text-[#314a79]">Cancel</button>
          <button type="button" onClick={onConfirm} className="h-10 rounded-[8px] bg-[#dc2626] px-4 text-[13px] font-semibold text-white">Delete</button>
        </div>
      </div>
    </div>
  );
}

function useWonProjectsHub(buildExtraMaps) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [extraByProject, setExtraByProject] = useState({});

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const projData = await projectApi.list({ page_size: 1000 });
      const won = rowsOf(projData).filter((p) => p.lead_status === 'Won');
      setProjects(won);
      if (buildExtraMaps) {
        const map = await buildExtraMaps();
        setExtraByProject(map || {});
      } else {
        setExtraByProject({});
      }
    } catch {
      setProjects([]);
      setExtraByProject({});
    } finally {
      setLoading(false);
    }
  }, [buildExtraMaps]);

  useEffect(() => { reload(); }, [reload]);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => (
      `${p.project_name || ''} ${p.customer_name || ''} ${p.project_id || ''} ${p.site || ''}`.toLowerCase().includes(q)
    ));
  }, [projects, deferredQuery]);

  return { projects, filtered, loading, query, setQuery, extraByProject, reload };
}

function WonProjectHubShell({
  title, crumbLabel, activeSection, onOpenSection, Subnav, query, setQuery, loading, children, summaryCards,
}) {
  return (
    <div className="space-y-2.5">
      <OpsHeading
        title={title}
        crumbs={[
          { label: 'Dashboard', onClick: () => onOpenSection('Dashboard') },
          { label: 'Project Management', onClick: () => onOpenSection('Project List') },
          { label: crumbLabel },
        ]}
      />
      {Subnav ? <Subnav activeSection={activeSection} onOpenSection={onOpenSection} /> : null}
      {summaryCards ? (
        <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{summaryCards}</section>
      ) : null}
      <section className={`${PANEL} overflow-hidden p-2.5 sm:p-3`}>
        <label className="mb-3 flex h-11 items-center gap-3 rounded-[10px] border border-[#dce6f3] bg-white px-4">
          <Search className="size-4 text-[#7e8fab]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search project, customer, site..."
            className="w-full bg-transparent text-[15px] font-medium text-[#1e3261] outline-none placeholder:text-[#8a98af]"
          />
        </label>
        {loading ? (
          <p className="py-10 text-center text-[13px] font-semibold text-[#8a98af]">Loading projects...</p>
        ) : children}
      </section>
    </div>
  );
}

function SummaryCard({ label, value, note, tone, icon: Icon }) {
  return (
    <article className="rounded-[10px] border border-[#e7eef7] bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-[#53647f]">{label}</p>
        <span className={cx('grid size-8 place-items-center rounded-full bg-[#f4f8ff]', tone)}><Icon className="size-4" /></span>
      </div>
      <p className={cx('mt-1 text-[22px] font-bold', tone)}>{value}</p>
      <p className="text-[12px] font-medium text-[#8a98af]">{note}</p>
    </article>
  );
}

/* ───────────────── DISPATCH ───────────────── */

function loadDispatchMaps() {
  return materialPlanApi.list({ page_size: 2000 }).then((data) => {
    const map = {};
    rowsOf(data).forEach((row) => {
      const key = row.project;
      if (!map[key]) map[key] = { total: 0, pending: 0, partial: 0, dispatched: 0 };
      map[key].total += 1;
      const st = row.dispatch_status || 'Pending';
      if (st === 'Dispatched') map[key].dispatched += 1;
      else if (st === 'Partial') map[key].partial += 1;
      else map[key].pending += 1;
    });
    return map;
  }).catch(() => ({}));
}

export function ProjectMaterialDispatchPage({ activeSection, onOpenSection, onNotify, Subnav }) {
  const buildMaps = useCallback(() => loadDispatchMaps(), []);
  const { filtered, loading, query, setQuery, extraByProject, reload } = useWonProjectsHub(buildMaps);
  const [active, setActive] = useState(null);

  const summary = useMemo(() => {
    const vals = Object.values(extraByProject);
    return {
      projects: filtered.length,
      pending: vals.reduce((s, v) => s + (v.pending || 0), 0),
      partial: vals.reduce((s, v) => s + (v.partial || 0), 0),
      done: vals.reduce((s, v) => s + (v.dispatched || 0), 0),
    };
  }, [extraByProject, filtered.length]);

  return (
    <>
      <WonProjectHubShell
        title="Material Dispatch"
        crumbLabel="Dispatch"
        activeSection={activeSection}
        onOpenSection={onOpenSection}
        Subnav={Subnav}
        query={query}
        setQuery={setQuery}
        loading={loading}
        summaryCards={(
          <>
            <SummaryCard label="Won Projects" value={summary.projects} note="Ready for dispatch" tone="text-[#0b65e5]" icon={FolderKanban} />
            <SummaryCard label="Pending Items" value={summary.pending} note="Not yet sent" tone="text-[#7585a2]" icon={ClipboardList} />
            <SummaryCard label="Partial" value={summary.partial} note="Part quantity sent" tone="text-[#f59e0b]" icon={Truck} />
            <SummaryCard label="Dispatched" value={summary.done} note="Fully sent" tone="text-[#078c3e]" icon={CheckCircle2} />
          </>
        )}
      >
        <div className="overflow-x-auto">
          <table className="crm-table crm-table--lead-dense w-full min-w-[880px]">
            <thead>
              <tr>
                {['#', 'Project', 'Customer / Site', 'BOM Items', 'Pending', 'Partial', 'Dispatched', 'Action'].map((h) => (
                  <th key={h} className={h === 'Action' ? 'crm-col-sticky-right' : undefined}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="py-8 text-center text-[13px] font-semibold text-[#8a98af]">No won projects found.</td></tr>
              ) : filtered.map((p, i) => {
                const st = extraByProject[p.id] || { total: 0, pending: 0, partial: 0, dispatched: 0 };
                return (
                  <tr key={p.id} className="cursor-pointer hover:bg-[#f8fbff]" onClick={() => setActive(p)}>
                    <td className="crm-col-index">{i + 1}</td>
                    <td>
                      <div className="font-semibold leading-tight text-[#1e3261]">{p.project_name || p.project_id}</div>
                      <div className="text-[11px] font-medium leading-tight text-[#8a98af]">{p.project_id}</div>
                    </td>
                    <td>
                      <div className="font-medium leading-tight text-[#314a79]">{p.customer_name || '—'}</div>
                      <div className="text-[11px] font-medium leading-tight text-[#8a98af]">{p.site || '—'}</div>
                    </td>
                    <td className="font-semibold text-[#1e3261]">{st.total}</td>
                    <td><Pill tone="slate">{st.pending}</Pill></td>
                    <td><Pill tone="amber">{st.partial}</Pill></td>
                    <td><Pill tone="green">{st.dispatched}</Pill></td>
                    <td className="crm-col-sticky-right">
                      <button type="button" onClick={(e) => { e.stopPropagation(); setActive(p); }} className="inline-flex h-8 items-center gap-1.5 rounded-[7px] bg-[#16a34a] px-2.5 text-[12px] font-semibold text-white">
                        <Truck className="size-3.5" />
                        {st.total ? 'Open Dispatch' : 'View'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </WonProjectHubShell>

      {active ? (
        <DispatchDetailModal
          project={active}
          onClose={() => { setActive(null); reload(); }}
          onNotify={onNotify}
          onOpenPlanning={() => { setActive(null); onOpenSection('Project Material Planning'); }}
        />
      ) : null}
    </>
  );
}

function DispatchDetailModal({ project, onClose, onNotify, onOpenPlanning }) {
  const parseQty = (v) => {
    const n = Number(String(v ?? '').replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  };
  const resolveStatus = (planned, dispatched) => {
    const p = parseQty(planned);
    const d = parseQty(dispatched);
    if (d <= 0) return 'Pending';
    if (p > 0 && d >= p) return 'Dispatched';
    return 'Partial';
  };

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [formOpen, setFormOpen] = useState(false);
  const [activeRow, setActiveRow] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(rowsOf(await materialPlanApi.list({ project: project.id, page_size: 500 })));
    } catch {
      onNotify('Failed to load materials');
    } finally {
      setLoading(false);
    }
  }, [project.id, onNotify]);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) => {
    if (statusFilter === 'All') return true;
    return (r.dispatch_status || resolveStatus(r.planned_qty, r.dispatched_qty)) === statusFilter;
  });

  const openForm = (row) => {
    setActiveRow(row);
    setForm({
      dispatched_qty: row.dispatched_qty || row.planned_qty || '',
      dispatch_date: row.dispatch_date || todayIso(),
      vehicle_no: row.vehicle_no || '',
      challan_no: row.challan_no || '',
      dispatch_notes: row.dispatch_notes || '',
    });
    setFormOpen(true);
  };

  const save = async () => {
    if (!activeRow) return;
    if (form.dispatched_qty === '' || form.dispatched_qty == null) {
      onNotify('Dispatched quantity required');
      return;
    }
    setSaving(true);
    try {
      const dispatch_status = resolveStatus(activeRow.planned_qty, form.dispatched_qty);
      const updated = await materialPlanApi.update(activeRow.id, {
        dispatched_qty: String(form.dispatched_qty),
        dispatch_status,
        dispatch_date: form.dispatch_date || null,
        vehicle_no: form.vehicle_no,
        challan_no: form.challan_no,
        dispatch_notes: form.dispatch_notes,
      });
      setRows((prev) => prev.map((r) => (r.id === activeRow.id ? { ...r, ...updated } : r)));
      setFormOpen(false);
      onNotify(dispatch_status === 'Dispatched' ? 'Fully dispatched' : 'Dispatch updated');
    } catch (e) {
      onNotify(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#0f172a]/55 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="flex max-h-[96vh] w-full max-w-[920px] flex-col overflow-hidden rounded-t-[16px] bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-[16px]">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#edf2f8] px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <h2 className="font-display text-[17px] font-extrabold text-[#111827]">Dispatch</h2>
              <p className="truncate text-[13px] font-semibold text-[#7386a3]">
                {project.project_name || project.project_id}
                {project.project_id ? ` · ${project.project_id}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={onOpenPlanning} className="hidden h-10 items-center gap-1.5 rounded-[8px] border border-[#dce6f3] px-3 text-[13px] font-semibold text-[#314a79] sm:inline-flex">
                Material Planning
              </button>
              <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full text-[#7585a2] hover:bg-[#f4f7fb]"><X className="size-5" /></button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-semibold text-[#7386a3]">{filtered.length} item{filtered.length === 1 ? '' : 's'}</p>
            </div>
            {loading ? (
              <p className="py-10 text-center text-[13px] font-semibold text-[#8a98af]">Loading...</p>
            ) : filtered.length === 0 ? (
              <div className="rounded-[12px] border border-dashed border-[#d5e0ef] bg-[#f8fbff] px-6 py-12 text-center">
                <p className="text-[15px] font-extrabold text-[#1e3261]">No materials to dispatch</p>
                <p className="mt-1 text-[13px] font-medium text-[#7386a3]">Pehle Material Planning me BOM add karo.</p>
                <button type="button" onClick={onOpenPlanning} className="mt-4 inline-flex h-10 items-center rounded-[8px] bg-[#16a34a] px-4 text-[13px] font-semibold text-white">Open Material Planning</button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-[12px] border border-[#e7eef7]">
                <table className="crm-table crm-table--lead-dense w-full min-w-[720px]">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Category</th>
                      <th>Spec</th>
                      <th>Planned</th>
                      <th>Dispatched</th>
                      <th>Left</th>
                      <th title="Status">
                        <TableHeaderFilter
                          label="Status"
                          value={statusFilter}
                          active={statusFilter !== 'All'}
                          options={['All', 'Pending', 'Partial', 'Dispatched']}
                          onChange={setStatusFilter}
                        />
                      </th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row, idx) => {
                      const status = row.dispatch_status || resolveStatus(row.planned_qty, row.dispatched_qty);
                      const left = Math.max(0, parseQty(row.planned_qty) - parseQty(row.dispatched_qty));
                      return (
                        <tr key={row.id}>
                          <td>{idx + 1}</td>
                          <td className="font-semibold text-[#1e3261]">{row.category}</td>
                          <td>{row.items || '—'}</td>
                          <td>{row.planned_qty ?? '—'}</td>
                          <td>{row.dispatched_qty || '0'}</td>
                          <td>{left}</td>
                          <td><Pill tone={status === 'Dispatched' ? 'green' : status === 'Partial' ? 'amber' : 'slate'}>{status}</Pill></td>
                          <td>
                            <button type="button" onClick={() => openForm(row)} className="inline-flex h-8 items-center gap-1 rounded-[7px] border border-[#cfe8d6] bg-[#f1fff5] px-2.5 text-[12px] font-semibold text-[#078c3e]">
                              <Truck className="size-3.5" />
                              {status === 'Pending' ? 'Dispatch' : 'Update'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="flex shrink-0 justify-end border-t border-[#edf2f8] px-4 py-3">
            <button type="button" onClick={onClose} className="h-10 rounded-[8px] border border-[#d5e0ef] px-5 text-[13px] font-semibold text-[#314a79]">Close</button>
          </div>
        </div>
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#111827]/55 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setFormOpen(false); }}>
          <div className="w-full max-w-[440px] rounded-[16px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#edf2f8] px-5 py-3">
              <h3 className="text-[16px] font-extrabold text-[#111827]">Dispatch — {activeRow?.category}</h3>
              <button type="button" onClick={() => setFormOpen(false)}><X className="size-5 text-[#7585a2]" /></button>
            </div>
            <div className="grid gap-3 p-5">
              {[
                ['dispatched_qty', 'Dispatched Qty *', 'number'],
                ['dispatch_date', 'Dispatch Date', 'date'],
                ['vehicle_no', 'Vehicle No', 'text'],
                ['challan_no', 'Challan No', 'text'],
              ].map(([key, label, type]) => (
                <label key={key} className="grid gap-1 text-[12px] font-bold text-[#53647f]">
                  {label}
                  <input type={type} value={form[key] || ''} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} className="h-10 rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold text-[#1e3261] outline-none" />
                </label>
              ))}
              <label className="grid gap-1 text-[12px] font-bold text-[#53647f]">
                Notes
                <textarea value={form.dispatch_notes || ''} onChange={(e) => setForm((p) => ({ ...p, dispatch_notes: e.target.value }))} rows={2} className="rounded-[8px] border border-[#d9e4f2] px-3 py-2 text-[13px] font-semibold text-[#1e3261] outline-none" />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#edf2f8] px-5 py-3">
              <button type="button" onClick={() => setFormOpen(false)} className="h-10 rounded-[8px] border px-4 text-[13px] font-semibold">Cancel</button>
              <button type="button" disabled={saving} onClick={save} className="h-10 rounded-[8px] bg-[#16a34a] px-4 text-[13px] font-semibold text-white disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ───────────────── INSTALLATION ───────────────── */

export function ProjectInstallationPage({ activeSection, onOpenSection, onNotify, Subnav }) {
  const { filtered, loading, query, setQuery, reload, projects } = useWonProjectsHub(null);
  const [active, setActive] = useState(null);

  const installSummary = useMemo(() => ({
    total: projects.length,
    active: projects.filter((p) => p.status === 'Active').length,
    planning: projects.filter((p) => p.status === 'Planning').length,
    completed: projects.filter((p) => p.status === 'Completed').length,
  }), [projects]);

  return (
    <>
      <WonProjectHubShell
        title="Installation"
        crumbLabel="Installation"
        activeSection={activeSection}
        onOpenSection={onOpenSection}
        Subnav={Subnav}
        query={query}
        setQuery={setQuery}
        loading={loading}
        summaryCards={(
          <>
            <SummaryCard label="Won Projects" value={installSummary.total} note="Ready for install" tone="text-[#0b65e5]" icon={FolderKanban} />
            <SummaryCard label="Active" value={installSummary.active} note="On site / running" tone="text-[#078c3e]" icon={Wrench} />
            <SummaryCard label="Planning" value={installSummary.planning} note="Not started yet" tone="text-[#f59e0b]" icon={ClipboardList} />
            <SummaryCard label="Completed" value={installSummary.completed} note="Install done" tone="text-[#0b65e5]" icon={CheckCircle2} />
          </>
        )}
      >
        <div className="overflow-x-auto">
          <table className="crm-table crm-table--lead-dense w-full min-w-[820px]">
            <thead>
              <tr>
                {['#', 'Project', 'Customer / Site', 'Capacity', 'Status', 'Action'].map((h) => (
                  <th key={h} className={h === 'Action' ? 'crm-col-sticky-right' : undefined}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-[13px] font-semibold text-[#8a98af]">No won projects found.</td></tr>
              ) : filtered.map((p, i) => (
                <tr key={p.id} className="cursor-pointer hover:bg-[#f8fbff]" onClick={() => setActive(p)}>
                  <td className="crm-col-index">{i + 1}</td>
                  <td>
                    <div className="font-semibold leading-tight text-[#1e3261]">{p.project_name || p.project_id}</div>
                    <div className="text-[11px] font-medium leading-tight text-[#8a98af]">{p.project_id}</div>
                  </td>
                  <td>
                    <div className="font-medium leading-tight text-[#314a79]">{p.customer_name || '—'}</div>
                    <div className="text-[11px] font-medium leading-tight text-[#8a98af]">{p.site || '—'}</div>
                  </td>
                  <td className="font-semibold text-[#0b65e5]">{Number(p.capacity_kwp) > 0 ? `${p.capacity_kwp} kWp` : '—'}</td>
                  <td><Pill tone={p.status === 'Active' ? 'green' : p.status === 'Completed' ? 'blue' : 'slate'}>{p.status || '—'}</Pill></td>
                  <td className="crm-col-sticky-right">
                    <button type="button" onClick={(e) => { e.stopPropagation(); setActive(p); }} className="inline-flex h-8 items-center gap-1.5 rounded-[7px] bg-[#16a34a] px-2.5 text-[12px] font-semibold text-white">
                      <Wrench className="size-3.5" />
                      Open Install
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WonProjectHubShell>

      {active ? (
        <InstallationDetailModal
          project={active}
          onClose={() => { setActive(null); reload(); }}
          onNotify={onNotify}
        />
      ) : null}
    </>
  );
}

function InstallationDetailModal({ project, onClose, onNotify }) {
  const TABS = ['Tasks', 'Materials', 'QA'];
  const [tab, setTab] = useState('Tasks');
  const [tasks, setTasks] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [taskOpen, setTaskOpen] = useState(false);
  const [taskEdit, setTaskEdit] = useState(null);
  const [taskForm, setTaskForm] = useState({ title: '', owner: '', status: 'Pending', progress_percent: 0, start_date: '', end_date: '' });
  const [matOpen, setMatOpen] = useState(false);
  const [matEdit, setMatEdit] = useState(null);
  const [matForm, setMatForm] = useState({ item_name: '', category: '', unit: 'Nos', required_qty: '', issued_qty: '', consumed_qty: '', status: 'Pending' });
  const [qaOpen, setQaOpen] = useState(false);
  const [qaForm, setQaForm] = useState({ label: '', category: 'QA', is_checked: false, notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mils, mats, chk] = await Promise.all([
        projectMilestoneApi.list(project.id),
        installationMaterialApi.list(project.id),
        projectChecklistApi.list(project.id, 'Installation'),
      ]);
      setTasks(rowsOf(mils));
      setMaterials(rowsOf(mats));
      setChecklist(rowsOf(chk));
    } catch {
      onNotify('Failed to load installation data');
    } finally {
      setLoading(false);
    }
  }, [project.id, onNotify]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    userApi.list({ is_active: true }).then((r) => setUsers(Array.isArray(r) ? r : r?.results ?? [])).catch(() => {});
  }, []);

  const doneTasks = tasks.filter((t) => t.status === 'Completed').length;
  const checkedQa = checklist.filter((c) => c.is_checked).length;

  const saveTask = async () => {
    if (!taskForm.title.trim()) { onNotify('Task name required'); return; }
    try {
      const payload = { ...taskForm, project: project.id, owner: taskForm.owner || null, progress_percent: Number(taskForm.progress_percent) || 0 };
      if (taskEdit) await projectMilestoneApi.update(taskEdit.id, payload);
      else await projectMilestoneApi.create(payload);
      setTaskOpen(false);
      onNotify(taskEdit ? 'Task updated' : 'Task added');
      load();
    } catch (e) { onNotify(e.message || 'Save failed'); }
  };

  const saveMat = async () => {
    if (!matForm.item_name.trim()) { onNotify('Material name required'); return; }
    try {
      const payload = { ...matForm, project: project.id };
      if (matEdit) await installationMaterialApi.update(matEdit.id, payload);
      else await installationMaterialApi.create(payload);
      setMatOpen(false);
      onNotify(matEdit ? 'Material updated' : 'Material added');
      load();
    } catch (e) { onNotify(e.message || 'Save failed'); }
  };

  const saveQa = async () => {
    if (!qaForm.label.trim()) { onNotify('Label required'); return; }
    try {
      await projectChecklistApi.create({ ...qaForm, project: project.id, phase: 'Installation' });
      setQaOpen(false);
      onNotify('Checklist item added');
      load();
    } catch (e) { onNotify(e.message || 'Save failed'); }
  };

  const toggleQa = async (item) => {
    try {
      await projectChecklistApi.update(item.id, { is_checked: !item.is_checked });
      setChecklist((prev) => prev.map((c) => (c.id === item.id ? { ...c, is_checked: !c.is_checked } : c)));
    } catch {
      onNotify('Update failed');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#0f172a]/55 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="flex max-h-[96vh] w-full max-w-[920px] flex-col overflow-hidden rounded-t-[16px] bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-[16px]">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#edf2f8] px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <h2 className="font-display text-[17px] font-extrabold text-[#111827]">Installation</h2>
              <p className="truncate text-[13px] font-semibold text-[#7386a3]">
                {project.project_name || project.project_id}
                {' · '}
                {doneTasks}/{tasks.length} tasks
                {' · '}
                {checkedQa}/{checklist.length} QA
              </p>
            </div>
            <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full text-[#7585a2] hover:bg-[#f4f7fb]"><X className="size-5" /></button>
          </div>

          <div className="flex shrink-0 gap-1 border-b border-[#edf2f8] px-4 pt-2 sm:px-5">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cx(
                  'rounded-t-[8px] px-3 py-2 text-[13px] font-bold',
                  tab === t ? 'bg-[#f1fff5] text-[#0b8f43]' : 'text-[#7386a3] hover:bg-[#f8fbff]',
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            {loading ? (
              <p className="py-10 text-center text-[13px] font-semibold text-[#8a98af]">Loading...</p>
            ) : tab === 'Tasks' ? (
              <div>
                <div className="mb-3 flex justify-end">
                  <button type="button" onClick={() => { setTaskEdit(null); setTaskForm({ title: '', owner: '', status: 'Pending', progress_percent: 0, start_date: '', end_date: '' }); setTaskOpen(true); }} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#16a34a] px-3 text-[12px] font-semibold text-white">
                    <Plus className="size-3.5" /> Add Task
                  </button>
                </div>
                {tasks.length === 0 ? (
                  <p className="py-8 text-center text-[13px] font-semibold text-[#8a98af]">No installation tasks yet.</p>
                ) : (
                  <div className="overflow-x-auto rounded-[12px] border border-[#e7eef7]">
                    <table className="crm-table crm-table--lead-dense w-full min-w-[640px]">
                      <thead><tr>{['#', 'Task', 'Status', 'Progress', 'Action'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                      <tbody>
                        {tasks.map((row, idx) => (
                          <tr key={row.id}>
                            <td>{idx + 1}</td>
                            <td className="font-semibold text-[#1e3261]">{row.title}</td>
                            <td><Pill tone={row.status === 'Completed' ? 'green' : row.status === 'Delayed' ? 'red' : 'amber'}>{row.status}</Pill></td>
                            <td>{row.progress_percent || 0}%</td>
                            <td className="flex gap-1">
                              <button type="button" onClick={() => { setTaskEdit(row); setTaskForm({ title: row.title, owner: row.owner ?? '', status: row.status, progress_percent: row.progress_percent ?? 0, start_date: row.start_date ?? '', end_date: row.end_date ?? '' }); setTaskOpen(true); }} className="grid size-8 place-items-center rounded-[7px] border border-[#d5e0ef] text-[#16a34a]"><Pencil className="size-3.5" /></button>
                              <button type="button" onClick={() => setDeleteConfirm({ type: 'task', id: row.id, message: `"${row.title}"` })} className="grid size-8 place-items-center rounded-[7px] border border-[#fee2e2] text-[#dc2626]"><Trash2 className="size-3.5" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : tab === 'Materials' ? (
              <div>
                <div className="mb-3 flex justify-end">
                  <button type="button" onClick={() => { setMatEdit(null); setMatForm({ item_name: '', category: '', unit: 'Nos', required_qty: '', issued_qty: '', consumed_qty: '', status: 'Pending' }); setMatOpen(true); }} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#16a34a] px-3 text-[12px] font-semibold text-white">
                    <Plus className="size-3.5" /> Add Material
                  </button>
                </div>
                {materials.length === 0 ? (
                  <p className="py-8 text-center text-[13px] font-semibold text-[#8a98af]">No installation materials yet.</p>
                ) : (
                  <div className="overflow-x-auto rounded-[12px] border border-[#e7eef7]">
                    <table className="crm-table crm-table--lead-dense w-full min-w-[640px]">
                      <thead><tr>{['#', 'Item', 'Required', 'Issued', 'Used', 'Status', 'Action'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                      <tbody>
                        {materials.map((row, idx) => (
                          <tr key={row.id}>
                            <td>{idx + 1}</td>
                            <td className="font-semibold text-[#1e3261]">{row.item_name}</td>
                            <td>{row.required_qty ?? '—'}</td>
                            <td>{row.issued_qty ?? '—'}</td>
                            <td>{row.consumed_qty ?? '—'}</td>
                            <td><Pill tone={row.status === 'Completed' ? 'green' : 'amber'}>{row.status || 'Pending'}</Pill></td>
                            <td className="flex gap-1">
                              <button type="button" onClick={() => { setMatEdit(row); setMatForm({ item_name: row.item_name, category: row.category ?? '', unit: row.unit ?? 'Nos', required_qty: row.required_qty ?? '', issued_qty: row.issued_qty ?? '', consumed_qty: row.consumed_qty ?? '', status: row.status ?? 'Pending' }); setMatOpen(true); }} className="grid size-8 place-items-center rounded-[7px] border border-[#d5e0ef] text-[#16a34a]"><Pencil className="size-3.5" /></button>
                              <button type="button" onClick={() => setDeleteConfirm({ type: 'mat', id: row.id, message: `"${row.item_name}"` })} className="grid size-8 place-items-center rounded-[7px] border border-[#fee2e2] text-[#dc2626]"><Trash2 className="size-3.5" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="mb-3 flex justify-end">
                  <button type="button" onClick={() => { setQaForm({ label: '', category: 'QA', is_checked: false, notes: '' }); setQaOpen(true); }} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#16a34a] px-3 text-[12px] font-semibold text-white">
                    <Plus className="size-3.5" /> Add Check
                  </button>
                </div>
                {checklist.length === 0 ? (
                  <p className="py-8 text-center text-[13px] font-semibold text-[#8a98af]">No QA / safety checks yet.</p>
                ) : (
                  <div className="space-y-2">
                    {checklist.map((item) => (
                      <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-[#e7eef7] bg-white px-3 py-2.5">
                        <input type="checkbox" checked={!!item.is_checked} onChange={() => toggleQa(item)} className="mt-1 size-4" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-bold text-[#1e3261]">{item.label}</span>
                          <span className="text-[11px] font-semibold text-[#8a98af]">{item.category || 'QA'}</span>
                        </span>
                        <button type="button" onClick={() => setDeleteConfirm({ type: 'qa', id: item.id, message: `"${item.label}"` })} className="text-[#dc2626]"><Trash2 className="size-3.5" /></button>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex shrink-0 justify-end border-t border-[#edf2f8] px-4 py-3">
            <button type="button" onClick={onClose} className="h-10 rounded-[8px] border border-[#d5e0ef] px-5 text-[13px] font-semibold text-[#314a79]">Close</button>
          </div>
        </div>
      </div>

      {taskOpen ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#111827]/55 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setTaskOpen(false); }}>
          <div className="w-full max-w-[440px] rounded-[16px] bg-white p-5 shadow-2xl">
            <h3 className="mb-3 text-[16px] font-extrabold">{taskEdit ? 'Edit Task' : 'Add Task'}</h3>
            <div className="grid gap-3">
              <label className="grid gap-1 text-[12px] font-bold text-[#53647f]">Task *<input value={taskForm.title} onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))} className="h-10 rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none" /></label>
              <label className="grid gap-1 text-[12px] font-bold text-[#53647f]">Owner
                <select value={taskForm.owner} onChange={(e) => setTaskForm((p) => ({ ...p, owner: e.target.value }))} className="h-10 rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none">
                  <option value="">Unassigned</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.username}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-[12px] font-bold text-[#53647f]">Status
                  <select value={taskForm.status} onChange={(e) => setTaskForm((p) => ({ ...p, status: e.target.value }))} className="h-10 rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none">
                    {['Pending', 'In Progress', 'Completed', 'Delayed'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-[12px] font-bold text-[#53647f]">Progress %
                  <input type="number" min="0" max="100" value={taskForm.progress_percent} onChange={(e) => setTaskForm((p) => ({ ...p, progress_percent: e.target.value }))} className="h-10 rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none" />
                </label>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setTaskOpen(false)} className="h-10 rounded-[8px] border px-4 text-[13px] font-semibold">Cancel</button>
              <button type="button" onClick={saveTask} className="h-10 rounded-[8px] bg-[#16a34a] px-4 text-[13px] font-semibold text-white">Save</button>
            </div>
          </div>
        </div>
      ) : null}

      {matOpen ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#111827]/55 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setMatOpen(false); }}>
          <div className="w-full max-w-[440px] rounded-[16px] bg-white p-5 shadow-2xl">
            <h3 className="mb-3 text-[16px] font-extrabold">{matEdit ? 'Edit Material' : 'Add Material'}</h3>
            <div className="grid gap-3">
              <label className="grid gap-1 text-[12px] font-bold text-[#53647f]">Item *<input value={matForm.item_name} onChange={(e) => setMatForm((p) => ({ ...p, item_name: e.target.value }))} className="h-10 rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none" /></label>
              <div className="grid grid-cols-3 gap-2">
                <label className="grid gap-1 text-[12px] font-bold text-[#53647f]">Required<input value={matForm.required_qty} onChange={(e) => setMatForm((p) => ({ ...p, required_qty: e.target.value }))} className="h-10 rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none" /></label>
                <label className="grid gap-1 text-[12px] font-bold text-[#53647f]">Issued<input value={matForm.issued_qty} onChange={(e) => setMatForm((p) => ({ ...p, issued_qty: e.target.value }))} className="h-10 rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none" /></label>
                <label className="grid gap-1 text-[12px] font-bold text-[#53647f]">Used<input value={matForm.consumed_qty} onChange={(e) => setMatForm((p) => ({ ...p, consumed_qty: e.target.value }))} className="h-10 rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none" /></label>
              </div>
              <label className="grid gap-1 text-[12px] font-bold text-[#53647f]">Status
                <select value={matForm.status} onChange={(e) => setMatForm((p) => ({ ...p, status: e.target.value }))} className="h-10 rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none">
                  {['Pending', 'In Progress', 'Completed'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setMatOpen(false)} className="h-10 rounded-[8px] border px-4 text-[13px] font-semibold">Cancel</button>
              <button type="button" onClick={saveMat} className="h-10 rounded-[8px] bg-[#16a34a] px-4 text-[13px] font-semibold text-white">Save</button>
            </div>
          </div>
        </div>
      ) : null}

      {qaOpen ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#111827]/55 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setQaOpen(false); }}>
          <div className="w-full max-w-[400px] rounded-[16px] bg-white p-5 shadow-2xl">
            <h3 className="mb-3 text-[16px] font-extrabold">Add Check</h3>
            <label className="grid gap-1 text-[12px] font-bold text-[#53647f]">Label *<input value={qaForm.label} onChange={(e) => setQaForm((p) => ({ ...p, label: e.target.value }))} className="h-10 rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none" /></label>
            <label className="mt-3 grid gap-1 text-[12px] font-bold text-[#53647f]">Category
              <select value={qaForm.category} onChange={(e) => setQaForm((p) => ({ ...p, category: e.target.value }))} className="h-10 rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none">
                <option value="QA">QA</option>
                <option value="Safety">Safety</option>
              </select>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setQaOpen(false)} className="h-10 rounded-[8px] border px-4 text-[13px] font-semibold">Cancel</button>
              <button type="button" onClick={saveQa} className="h-10 rounded-[8px] bg-[#16a34a] px-4 text-[13px] font-semibold text-white">Add</button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirm ? (
        <ConfirmBox
          message={deleteConfirm.message}
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={async () => {
            try {
              if (deleteConfirm.type === 'task') await projectMilestoneApi.delete(deleteConfirm.id);
              else if (deleteConfirm.type === 'mat') await installationMaterialApi.delete(deleteConfirm.id);
              else await projectChecklistApi.delete(deleteConfirm.id);
              setDeleteConfirm(null);
              onNotify('Deleted');
              load();
            } catch {
              setDeleteConfirm(null);
              onNotify('Delete failed');
            }
          }}
        />
      ) : null}
    </>
  );
}

/* ───────────────── EXPENSES ───────────────── */

function loadExpenseMaps() {
  return projectExpenseApi.list({ page_size: 2000 }).then((data) => {
    const map = {};
    rowsOf(data).forEach((row) => {
      const key = row.project;
      if (!map[key]) map[key] = { count: 0, total: 0, pending: 0, paid: 0 };
      map[key].count += 1;
      map[key].total += Number(row.amount) || 0;
      if (row.status === 'Paid') map[key].paid += 1;
      else map[key].pending += 1;
    });
    return map;
  }).catch(() => ({}));
}

export function ProjectExpensesPage({ activeSection, onOpenSection, onNotify, Subnav }) {
  const buildMaps = useCallback(() => loadExpenseMaps(), []);
  const { filtered, loading, query, setQuery, extraByProject, reload } = useWonProjectsHub(buildMaps);
  const [active, setActive] = useState(null);

  const summary = useMemo(() => {
    const vals = Object.values(extraByProject);
    return {
      projects: vals.filter((v) => v.count > 0).length,
      total: vals.reduce((s, v) => s + (v.total || 0), 0),
      pending: vals.reduce((s, v) => s + (v.pending || 0), 0),
      paid: vals.reduce((s, v) => s + (v.paid || 0), 0),
    };
  }, [extraByProject]);

  return (
    <>
      <WonProjectHubShell
        title="Project Expenses"
        crumbLabel="Expenses"
        activeSection={activeSection}
        onOpenSection={onOpenSection}
        Subnav={Subnav}
        query={query}
        setQuery={setQuery}
        loading={loading}
        summaryCards={(
          <>
            <SummaryCard label="Projects with Spend" value={summary.projects} note="Have expenses" tone="text-[#0b65e5]" icon={FolderKanban} />
            <SummaryCard label="Total Spend" value={fmtRs(summary.total)} note="All won projects" tone="text-[#078c3e]" icon={Wallet} />
            <SummaryCard label="Pending Entries" value={summary.pending} note="Not fully paid" tone="text-[#f59e0b]" icon={ReceiptText} />
            <SummaryCard label="Paid Entries" value={summary.paid} note="Settled" tone="text-[#0b65e5]" icon={CheckCircle2} />
          </>
        )}
      >
        <div className="overflow-x-auto">
          <table className="crm-table crm-table--lead-dense w-full min-w-[880px]">
            <thead>
              <tr>
                {['#', 'Project', 'Customer / Site', 'Entries', 'Total', 'Pending', 'Paid', 'Action'].map((h) => (
                  <th key={h} className={h === 'Action' ? 'crm-col-sticky-right' : undefined}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="py-8 text-center text-[13px] font-semibold text-[#8a98af]">No won projects found.</td></tr>
              ) : filtered.map((p, i) => {
                const st = extraByProject[p.id] || { count: 0, total: 0, pending: 0, paid: 0 };
                return (
                  <tr key={p.id} className="cursor-pointer hover:bg-[#f8fbff]" onClick={() => setActive(p)}>
                    <td className="crm-col-index">{i + 1}</td>
                    <td>
                      <div className="font-semibold leading-tight text-[#1e3261]">{p.project_name || p.project_id}</div>
                      <div className="text-[11px] font-medium leading-tight text-[#8a98af]">{p.project_id}</div>
                    </td>
                    <td>
                      <div className="font-medium leading-tight text-[#314a79]">{p.customer_name || '—'}</div>
                      <div className="text-[11px] font-medium leading-tight text-[#8a98af]">{p.site || '—'}</div>
                    </td>
                    <td className="font-semibold text-[#1e3261]">{st.count}</td>
                    <td className="font-semibold text-[#078c3e]">{fmtRs(st.total)}</td>
                    <td><Pill tone="amber">{st.pending}</Pill></td>
                    <td><Pill tone="green">{st.paid}</Pill></td>
                    <td className="crm-col-sticky-right">
                      <button type="button" onClick={(e) => { e.stopPropagation(); setActive(p); }} className="inline-flex h-8 items-center gap-1.5 rounded-[7px] bg-[#16a34a] px-2.5 text-[12px] font-semibold text-white">
                        <Wallet className="size-3.5" />
                        {st.count ? 'Open Expenses' : 'Add Expense'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </WonProjectHubShell>

      {active ? (
        <ExpensesDetailModal
          project={active}
          onClose={() => { setActive(null); reload(); }}
          onNotify={onNotify}
        />
      ) : null}
    </>
  );
}

function ExpensesDetailModal({ project, onClose, onNotify }) {
  const CATEGORIES = ['Materials', 'Labor', 'Transport', 'Equipment', 'Miscellaneous', 'Other'];
  const STATUSES = ['Pending', 'Paid', 'Partial'];
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [form, setForm] = useState({ category: 'Materials', description: '', amount: '', date: todayIso(), payment_mode: 'Cash', paid_by: '', status: 'Pending', remarks: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(rowsOf(await projectExpenseApi.list({ project: project.id, page_size: 500 })));
    } catch {
      onNotify('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [project.id, onNotify]);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) => statusFilter === 'All' || r.status === statusFilter);
  const total = filtered.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const openAdd = () => {
    setEditRow(null);
    setForm({ category: 'Materials', description: '', amount: '', date: todayIso(), payment_mode: 'Cash', paid_by: '', status: 'Pending', remarks: '' });
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditRow(row);
    setForm({
      category: row.category || 'Materials',
      description: row.description || '',
      amount: row.amount ?? '',
      date: row.date || todayIso(),
      payment_mode: row.payment_mode || 'Cash',
      paid_by: row.paid_by || '',
      status: row.status || 'Pending',
      remarks: row.remarks || '',
    });
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.amount) { onNotify('Amount required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, project: project.id };
      if (editRow) await projectExpenseApi.update(editRow.id, payload);
      else await projectExpenseApi.create(payload);
      setFormOpen(false);
      onNotify(editRow ? 'Expense updated' : 'Expense added');
      load();
    } catch (e) {
      onNotify(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#0f172a]/55 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="flex max-h-[96vh] w-full max-w-[920px] flex-col overflow-hidden rounded-t-[16px] bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-[16px]">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#edf2f8] px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <h2 className="font-display text-[17px] font-extrabold text-[#111827]">Expenses</h2>
              <p className="truncate text-[13px] font-semibold text-[#7386a3]">
                {project.project_name || project.project_id}
                {' · '}
                {fmtRs(total)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={openAdd} className="inline-flex h-10 items-center gap-1.5 rounded-[8px] bg-[#16a34a] px-3 text-[13px] font-semibold text-white">
                <Plus className="size-4" /> Add Expense
              </button>
              <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full text-[#7585a2] hover:bg-[#f4f7fb]"><X className="size-5" /></button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            {loading ? (
              <p className="py-10 text-center text-[13px] font-semibold text-[#8a98af]">Loading...</p>
            ) : filtered.length === 0 ? (
              <div className="rounded-[12px] border border-dashed border-[#d5e0ef] bg-[#f8fbff] px-6 py-12 text-center">
                <Wallet className="mx-auto size-10 text-[#94a3b8]" />
                <p className="mt-3 text-[15px] font-extrabold text-[#1e3261]">No expenses yet</p>
                <button type="button" onClick={openAdd} className="mt-4 inline-flex h-10 items-center rounded-[8px] bg-[#16a34a] px-4 text-[13px] font-semibold text-white">Add Expense</button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-[12px] border border-[#e7eef7]">
                <table className="crm-table crm-table--lead-dense w-full min-w-[700px]">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Amount</th>
                      <th title="Status">
                        <TableHeaderFilter
                          label="Status"
                          value={statusFilter}
                          active={statusFilter !== 'All'}
                          options={['All', ...STATUSES]}
                          onChange={setStatusFilter}
                        />
                      </th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row, idx) => (
                      <tr key={row.id}>
                        <td>{idx + 1}</td>
                        <td>{row.date || '—'}</td>
                        <td className="font-semibold text-[#1e3261]">{row.category}</td>
                        <td>{row.description || '—'}</td>
                        <td className="font-semibold text-[#078c3e]">{fmtRs(row.amount)}</td>
                        <td><Pill tone={row.status === 'Paid' ? 'green' : row.status === 'Partial' ? 'blue' : 'amber'}>{row.status || 'Pending'}</Pill></td>
                        <td className="flex gap-1">
                          <button type="button" onClick={() => openEdit(row)} className="grid size-8 place-items-center rounded-[7px] border border-[#d5e0ef] text-[#16a34a]"><Pencil className="size-3.5" /></button>
                          <button type="button" onClick={() => setDeleteConfirm(row)} className="grid size-8 place-items-center rounded-[7px] border border-[#fee2e2] text-[#dc2626]"><Trash2 className="size-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex shrink-0 justify-end border-t border-[#edf2f8] px-4 py-3">
            <button type="button" onClick={onClose} className="h-10 rounded-[8px] border border-[#d5e0ef] px-5 text-[13px] font-semibold text-[#314a79]">Close</button>
          </div>
        </div>
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#111827]/55 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setFormOpen(false); }}>
          <div className="w-full max-w-[460px] rounded-[16px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#edf2f8] px-5 py-3">
              <h3 className="text-[16px] font-extrabold">{editRow ? 'Edit Expense' : 'Add Expense'}</h3>
              <button type="button" onClick={() => setFormOpen(false)}><X className="size-5 text-[#7585a2]" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 p-5">
              <label className="col-span-2 grid gap-1 text-[12px] font-bold text-[#53647f]">Category
                <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className="h-10 rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-[12px] font-bold text-[#53647f]">Amount *
                <input type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} className="h-10 rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none" />
              </label>
              <label className="grid gap-1 text-[12px] font-bold text-[#53647f]">Date
                <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} className="h-10 rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none" />
              </label>
              <label className="col-span-2 grid gap-1 text-[12px] font-bold text-[#53647f]">Description
                <input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="h-10 rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none" />
              </label>
              <label className="grid gap-1 text-[12px] font-bold text-[#53647f]">Status
                <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} className="h-10 rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none">
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-[12px] font-bold text-[#53647f]">Paid By
                <input value={form.paid_by} onChange={(e) => setForm((p) => ({ ...p, paid_by: e.target.value }))} className="h-10 rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none" />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#edf2f8] px-5 py-3">
              <button type="button" onClick={() => setFormOpen(false)} className="h-10 rounded-[8px] border px-4 text-[13px] font-semibold">Cancel</button>
              <button type="button" disabled={saving} onClick={save} className="h-10 rounded-[8px] bg-[#16a34a] px-4 text-[13px] font-semibold text-white disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirm ? (
        <ConfirmBox
          message={`${deleteConfirm.category} — ${fmtRs(deleteConfirm.amount)}`}
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={async () => {
            try {
              await projectExpenseApi.delete(deleteConfirm.id);
              setDeleteConfirm(null);
              onNotify('Expense deleted');
              load();
            } catch {
              setDeleteConfirm(null);
              onNotify('Delete failed');
            }
          }}
        />
      ) : null}
    </>
  );
}
