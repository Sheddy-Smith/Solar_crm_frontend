import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight, ClipboardList, Eye, FileText,
  Pencil, Plus, RefreshCw, RotateCcw, Save, Search, Trash2, X,
} from 'lucide-react';
import { accountsModuleApi, jobSheetApi, materialPlanApi, projectApi, workforceApi } from './api.js';

const PANEL = 'rounded-[14px] border border-[#e7eef7] bg-white shadow-[0_10px_24px_rgba(17,39,84,0.05)]';
const CELL_INPUT = 'h-8 w-full rounded-[6px] border border-transparent bg-transparent px-1.5 text-[13px] font-semibold text-[#1e3261] outline-none transition hover:border-[#dce6f3] focus:border-[#86b7fe] focus:bg-white';
const FILTER_INPUT = 'h-10 w-full rounded-[8px] border border-[#d9e4f2] bg-white px-3 text-[13px] font-medium text-[#1e3261] outline-none placeholder:text-[#9aa8bc] focus:border-[#86b7fe]';
const PAGE_SIZE = 15;

// Material Planning category → installation work performed on site.
const CATEGORY_WORK_MAP = [
  [/panel|module/i, 'Solar Panel Mounting'],
  [/inverter/i, 'Inverter Installation & Wiring'],
  [/structure/i, 'Structure Fabrication & Erection'],
  [/dc\s*cable/i, 'DC Cabling & Conduiting'],
  [/ac\s*cable/i, 'AC Cabling'],
  [/acdb|dcdb/i, 'ACDB / DCDB Fitting'],
  [/earth/i, 'Earthing Pit & Connection'],
  [/lightning|\bla\b/i, 'Lightning Arrestor Installation'],
  [/mc4|connector/i, 'MC4 Connector Crimping'],
  [/battery/i, 'Battery Bank Installation'],
  [/meter/i, 'Meter Board Fitting'],
];

const DEFAULT_SOLAR_TASKS = [
  ['Structure Fabrication & Erection', 'Structure'],
  ['Solar Panel Mounting', 'Solar Panels'],
  ['DC Cabling & Conduiting', 'DC Cable'],
  ['Inverter Installation & Wiring', 'Inverter'],
  ['ACDB / DCDB Fitting', 'ACDB / DCDB'],
  ['AC Cabling', 'AC Cable'],
  ['Earthing Pit & Connection', 'Earthing'],
  ['Lightning Arrestor Installation', 'Lightning Arrestor'],
];

const CLOSING_TASKS = [
  ['Testing & Commissioning', 'Commissioning'],
  ['Net Metering Support', 'Liaisoning'],
];

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function rowsOf(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

function num(v) {
  const n = Number(String(v ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function money(n) {
  return `₹${num(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
}

let rowSeq = 0;
function makeRow(overrides = {}) {
  rowSeq += 1;
  return {
    _key: `r${Date.now()}-${rowSeq}`,
    work: '',
    category: '',
    cost: 0,
    qty: 1,
    work_order_type: '',
    assignee_id: '',
    assignee_name: '',
    notes: '',
    work_order_no: '',
    ...overrides,
  };
}

function withKeys(rows) {
  return (rows || []).map((r) => makeRow(r));
}

function workForCategory(category) {
  const hit = CATEGORY_WORK_MAP.find(([re]) => re.test(category || ''));
  return hit ? hit[1] : `${category} Installation`;
}

function buildTasksFromPlans(plans) {
  const seen = new Set();
  const tasks = [];
  plans.forEach((plan) => {
    const category = String(plan.category || '').trim();
    if (!category) return;
    const work = workForCategory(category);
    if (seen.has(work.toLowerCase())) return;
    seen.add(work.toLowerCase());
    tasks.push(makeRow({ work, category }));
  });
  const base = tasks.length ? tasks : DEFAULT_SOLAR_TASKS.map(([work, category]) => makeRow({ work, category }));
  CLOSING_TASKS.forEach(([work, category]) => {
    if (!base.some((t) => t.work.toLowerCase() === work.toLowerCase())) base.push(makeRow({ work, category }));
  });
  return base;
}

function sumRows(rows) {
  return rows.reduce((s, r) => s + num(r.cost) * num(r.qty), 0);
}

function stripKeys(rows) {
  return rows.map(({ _key, ...rest }) => ({ ...rest, cost: num(rest.cost), qty: num(rest.qty) }));
}

/* ───────────────── Small UI pieces ───────────────── */

function Heading({ onOpenSection }) {
  return (
    <div className="page-heading flex min-w-0 flex-col gap-2.5 rounded-[12px] bg-white/60 p-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-[24px] font-bold leading-[1.12] tracking-[-0.01em] text-[#111827] sm:text-[30px]">Job Sheet</h1>
        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2 text-[13px] font-semibold">
          <button type="button" onClick={() => onOpenSection('Dashboard')} className="text-[#0b65e5]">Dashboard</button>
          <ChevronRight className="size-3.5 text-[#9aa8bc]" />
          <button type="button" onClick={() => onOpenSection('Project List')} className="text-[#0b65e5]">Project Management</button>
          <ChevronRight className="size-3.5 text-[#9aa8bc]" />
          <span className="text-[#53647f]">Job Sheet</span>
        </div>
      </div>
    </div>
  );
}

function WorkOrderToggle({ value, onChange, disabled }) {
  return (
    <div className="inline-flex gap-1">
      {['Vendor', 'Labour'].map((type) => (
        <button
          key={type}
          type="button"
          disabled={disabled}
          onClick={() => onChange(value === type ? '' : type)}
          className={cx(
            'h-7 whitespace-nowrap rounded-[6px] px-2 text-[11px] font-bold transition disabled:opacity-60',
            value === type ? 'bg-[#0b65e5] text-white shadow-[0_4px_10px_rgba(11,101,229,0.25)]' : 'bg-[#eef2f7] text-[#53647f] hover:bg-[#e2e8f1]',
          )}
        >
          {type}
        </button>
      ))}
    </div>
  );
}

function AssigneeCell({ row, vendors, labours, onChange, disabled }) {
  if (!row.work_order_type) {
    return <span className="text-[11px] font-medium italic text-[#9aa8bc]">Pick above first</span>;
  }
  if (row.assignee_name) {
    return (
      <span className="inline-flex max-w-full items-center gap-1 rounded-[6px] bg-[#0b65e5] px-2 py-1 text-[11px] font-bold uppercase text-white">
        <span className="truncate">{row.assignee_name}</span>
        {!disabled ? (
          <button type="button" onClick={() => onChange({ assignee_id: '', assignee_name: '' })} aria-label="Remove assignee">
            <X className="size-3" />
          </button>
        ) : null}
      </span>
    );
  }
  const options = row.work_order_type === 'Vendor' ? vendors : labours;
  if (!options.length) {
    return (
      <input
        type="text"
        disabled={disabled}
        placeholder={`${row.work_order_type} name`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.currentTarget.value.trim()) onChange({ assignee_id: '', assignee_name: e.currentTarget.value.trim() });
        }}
        onBlur={(e) => {
          if (e.currentTarget.value.trim()) onChange({ assignee_id: '', assignee_name: e.currentTarget.value.trim() });
        }}
        className="h-7 w-full rounded-[6px] border border-[#d9e4f2] px-2 text-[12px] font-semibold text-[#1e3261] outline-none"
      />
    );
  }
  return (
    <select
      value=""
      disabled={disabled}
      onChange={(e) => {
        const pick = options.find((o) => String(o.id) === e.target.value);
        if (pick) onChange({ assignee_id: String(pick.id), assignee_name: pick.name });
      }}
      className="h-7 w-full rounded-[6px] border border-[#d9e4f2] bg-white px-1.5 text-[12px] font-semibold text-[#314a79] outline-none"
    >
      <option value="">Select {row.work_order_type.toLowerCase()}...</option>
      {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  );
}

function TaskTable({ rows, editable, vendors, labours, onChangeRow, onRemoveRow, emptyText, readOnly }) {
  return (
    <div className="overflow-x-auto">
      <table data-no-col-resize="1" className="w-full min-w-[1120px] border-collapse text-left">
        <thead>
          <tr className="border-b border-[#e7eef7] bg-[#f6f8fb] text-[12px] font-bold text-[#1e3261]">
            <th className="min-w-[220px] px-2 py-2">Work</th>
            <th className="w-[130px] px-2 py-2">Category</th>
            <th className="w-[100px] px-2 py-2">Cost (₹)</th>
            <th className="w-[70px] px-2 py-2">Qty</th>
            <th className="w-[110px] px-2 py-2">Total (₹)</th>
            <th className="w-[130px] px-2 py-2">Work Order</th>
            <th className="w-[170px] px-2 py-2">Assigned To</th>
            <th className="w-[170px] px-2 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={8} className="py-3 text-center text-[12px] font-medium text-[#8a98af]">{emptyText}</td></tr>
          ) : rows.map((row) => (
            <tr key={row._key} className="border-b border-[#f0f4f9] text-[13px] last:border-b-0 hover:bg-[#fafcff]">
              <td className="px-2 py-1.5">
                {editable && !readOnly ? (
                  <input value={row.work} onChange={(e) => onChangeRow(row._key, { work: e.target.value })} placeholder="Work description" className={CELL_INPUT} />
                ) : (
                  <div className="px-1.5 font-semibold text-[#1e3261]">
                    {row.work}
                    {row.work_order_no ? <span className="ml-2 rounded bg-[#e8f8eb] px-1.5 py-0.5 text-[10px] font-bold text-[#078c3e]">{row.work_order_no}</span> : null}
                  </div>
                )}
              </td>
              <td className="px-2 py-1.5">
                {editable && !readOnly ? (
                  <input value={row.category} onChange={(e) => onChangeRow(row._key, { category: e.target.value })} placeholder="Category" className={CELL_INPUT} />
                ) : (
                  <span className="px-1.5 text-[#53647f]">{row.category || '—'}</span>
                )}
              </td>
              <td className="px-2 py-1.5">
                <input type="number" min="0" disabled={readOnly} value={row.cost} onChange={(e) => onChangeRow(row._key, { cost: e.target.value })} className={CELL_INPUT} />
              </td>
              <td className="px-2 py-1.5">
                <input type="number" min="0" disabled={readOnly} value={row.qty} onChange={(e) => onChangeRow(row._key, { qty: e.target.value })} className={CELL_INPUT} />
              </td>
              <td className="px-2 py-1.5 font-semibold text-[#1e3261]">{(num(row.cost) * num(row.qty)).toFixed(2)}</td>
              <td className="px-2 py-1.5">
                <WorkOrderToggle
                  value={row.work_order_type}
                  disabled={readOnly}
                  onChange={(type) => onChangeRow(row._key, { work_order_type: type, assignee_id: '', assignee_name: '' })}
                />
              </td>
              <td className="px-2 py-1.5">
                <AssigneeCell row={row} vendors={vendors} labours={labours} disabled={readOnly} onChange={(patch) => onChangeRow(row._key, patch)} />
              </td>
              <td className="px-2 py-1.5">
                <div className="flex items-center gap-1">
                  <input value={row.notes} disabled={readOnly} onChange={(e) => onChangeRow(row._key, { notes: e.target.value })} placeholder="Notes..." className={CELL_INPUT} />
                  {onRemoveRow && !readOnly ? (
                    <button type="button" onClick={() => onRemoveRow(row._key)} className="grid size-7 shrink-0 place-items-center rounded-[6px] text-[#dc2626] hover:bg-[#fee2e2]" aria-label="Remove row">
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TotalLine({ label, value, tone = 'text-[#1e3261]', big = false, children }) {
  return (
    <div className="flex items-center justify-end gap-3">
      <span className={cx('font-bold', big ? 'text-[17px]' : 'text-[14px]', tone)}>{label}:</span>
      {children || <span className={cx('min-w-[110px] text-right font-extrabold', big ? 'text-[17px]' : 'text-[14px]', tone)}>{value}</span>}
    </div>
  );
}

function ConfirmDelete({ label, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0f172a]/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="w-full max-w-[400px] rounded-[14px] bg-white p-5 shadow-xl">
        <p className="text-[15px] font-extrabold text-[#1e3261]">Delete job sheet?</p>
        <p className="mt-2 text-[13px] font-medium text-[#53647f]">{label} will be permanently deleted. Generated work orders will not be deleted.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-10 rounded-[8px] border border-[#d5e0ef] px-4 text-[13px] font-semibold text-[#314a79]">Cancel</button>
          <button type="button" onClick={onConfirm} className="h-10 rounded-[8px] bg-[#dc2626] px-4 text-[13px] font-semibold text-white">Delete</button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────── Page ───────────────── */

export function ProjectJobSheetPage({ activeSection, onOpenSection, onNotify, Subnav, initialProjectId }) {
  const editorRef = useRef(null);
  const [projects, setProjects] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [labours, setLabours] = useState([]);

  const [projectId, setProjectId] = useState(initialProjectId ? String(initialProjectId) : '');
  const [sheet, setSheet] = useState(null);
  const [items, setItems] = useState([]);
  const [extraItems, setExtraItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [advance, setAdvance] = useState(0);
  const [status, setStatus] = useState('Pending');
  const [remarks, setRemarks] = useState('');
  const [editorLoading, setEditorLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);

  const [sheets, setSheets] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [filterDraft, setFilterDraft] = useState({ project_code: '', customer: '', date_from: '', date_to: '' });
  const [filters, setFilters] = useState(filterDraft);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [deleting, setDeleting] = useState(null);

  const project = useMemo(() => projects.find((p) => String(p.id) === String(projectId)) || null, [projects, projectId]);

  useEffect(() => {
    projectApi.list({ page_size: 1000 })
      .then((data) => setProjects(rowsOf(data).filter((p) => p.lead_status === 'Won')))
      .catch(() => setProjects([]));
    accountsModuleApi.parties.list({ account_type: 'Vendor', page_size: 2000 })
      .then((data) => setVendors(rowsOf(data).map((v) => ({ id: v.id, name: v.name })).filter((v) => v.name)))
      .catch(() => setVendors([]));
    workforceApi.listEmployees({ page_size: 1000 })
      .then((data) => setLabours(rowsOf(data).map((e) => ({ id: e.id, name: e.name })).filter((e) => e.name)))
      .catch(() => setLabours([]));
  }, []);

  const loadSheets = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await jobSheetApi.list({ ...filters, page_size: 1000 });
      setSheets(rowsOf(data));
    } catch {
      setSheets([]);
    } finally {
      setListLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadSheets(); }, [loadSheets]);

  const applySheet = useCallback((data) => {
    setSheet(data);
    setItems(withKeys(data.items));
    setExtraItems(withKeys(data.extra_items));
    setDiscount(num(data.discount));
    setAdvance(num(data.advance_payment));
    setStatus(data.status || 'Pending');
    setRemarks(data.remarks || '');
  }, []);

  const loadEditor = useCallback(async (pid) => {
    if (!pid) {
      setSheet(null);
      setItems([]);
      setExtraItems([]);
      setDiscount(0);
      setAdvance(0);
      setStatus('Pending');
      setRemarks('');
      return;
    }
    setEditorLoading(true);
    try {
      const existing = rowsOf(await jobSheetApi.list({ project: pid }))[0];
      if (existing) {
        applySheet(existing);
      } else {
        const plans = rowsOf(await materialPlanApi.list({ project: pid, page_size: 500 }).catch(() => []));
        setSheet(null);
        setItems(buildTasksFromPlans(plans));
        setExtraItems([]);
        setDiscount(0);
        setAdvance(0);
        setStatus('Pending');
        setRemarks('');
      }
    } catch (e) {
      onNotify?.(e.message || 'Failed to load job sheet', 'error');
    } finally {
      setEditorLoading(false);
    }
  }, [applySheet, onNotify]);

  useEffect(() => { loadEditor(projectId); }, [projectId, loadEditor]);

  const syncFromPlanning = async () => {
    if (!projectId) return;
    try {
      const plans = rowsOf(await materialPlanApi.list({ project: projectId, page_size: 500 }));
      const fresh = buildTasksFromPlans(plans);
      const existing = new Set(items.map((r) => r.work.trim().toLowerCase()));
      const missing = fresh.filter((r) => !existing.has(r.work.trim().toLowerCase()));
      if (!missing.length) {
        onNotify?.('All Material Planning tasks are already added');
        return;
      }
      setItems((prev) => [...prev, ...missing]);
      onNotify?.(`${missing.length} task(s) added from Material Planning`);
    } catch (e) {
      onNotify?.(e.message || 'Could not load Material Planning', 'error');
    }
  };

  const patchRow = (setter) => (key, patch) => setter((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  const changeItem = patchRow(setItems);
  const changeExtra = patchRow(setExtraItems);

  const totals = useMemo(() => {
    const taskTotal = sumRows(items);
    const extraTotal = sumRows(extraItems);
    const grand = taskTotal + extraTotal;
    const net = grand - num(discount);
    const final = Math.round(net);
    return { taskTotal, extraTotal, grand, roundOff: final - net, final, balance: final - num(advance) };
  }, [items, extraItems, discount, advance]);

  const buildPayload = () => ({
    project: Number(projectId),
    status,
    items: stripKeys(items),
    extra_items: stripKeys(extraItems),
    discount: num(discount),
    advance_payment: num(advance),
    remarks,
  });

  const persist = async () => {
    const payload = buildPayload();
    const saved = sheet?.id ? await jobSheetApi.update(sheet.id, payload) : await jobSheetApi.create(payload);
    applySheet(saved);
    return saved;
  };

  const handleSave = async () => {
    if (!projectId) {
      onNotify?.('Select a project first', 'error');
      return;
    }
    setSaving(true);
    try {
      const saved = await persist();
      onNotify?.(`Job Sheet ${saved.job_sheet_no} saved`);
      loadSheets();
    } catch (e) {
      onNotify?.(e.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!projectId) {
      onNotify?.('Select a project first', 'error');
      return;
    }
    const assigned = [...items, ...extraItems].filter((r) => r.work.trim() && r.work_order_type && r.assignee_name);
    if (!assigned.length) {
      onNotify?.('Assign a Vendor/Labour to at least one task', 'error');
      return;
    }
    setGenerating(true);
    try {
      const saved = await persist();
      const res = await jobSheetApi.generateWorkOrders(saved.id);
      if (res?.job_sheet) applySheet(res.job_sheet);
      onNotify?.(`Work orders: ${res?.created || 0} new, ${res?.linked || 0} already existing`);
      loadSheets();
    } catch (e) {
      onNotify?.(e.message || 'Could not generate work order', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const openSheet = (row, readOnly) => {
    setViewOnly(readOnly);
    if (String(row.project) === String(projectId)) applySheet(row);
    else setProjectId(String(row.project));
    editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const confirmDelete = async () => {
    const row = deleting;
    setDeleting(null);
    try {
      await jobSheetApi.delete(row.id);
      onNotify?.(`${row.job_sheet_no} deleted`);
      if (String(row.project) === String(projectId)) loadEditor(projectId);
      loadSheets();
    } catch (e) {
      onNotify?.(e.message || 'Delete failed', 'error');
    }
  };

  const readOnly = viewOnly;
  const shown = sheets.slice(0, visible);

  return (
    <div className="space-y-2.5">
      <Heading onOpenSection={onOpenSection} />
      {Subnav ? <Subnav activeSection={activeSection} onOpenSection={onOpenSection} /> : null}

      <section ref={editorRef} className={cx(PANEL, 'scroll-mt-4 p-3 sm:p-5')}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display text-[20px] font-extrabold text-[#111827]">Job Sheet</h2>
            {sheet ? (
              <p className="mt-0.5 text-[12px] font-semibold text-[#7386a3]">
                {sheet.job_sheet_no} · Last updated {fmtDate(sheet.updated_at)}
                {readOnly ? <span className="ml-2 rounded bg-[#eef2f7] px-1.5 py-0.5 text-[10px] font-bold text-[#53647f]">VIEW ONLY</span> : null}
              </p>
            ) : projectId ? <p className="mt-0.5 text-[12px] font-semibold text-[#7386a3]">New job sheet — tasks loaded from Material Planning</p> : null}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-[12px] font-bold text-[#53647f]">
              Project
              <select
                value={projectId}
                onChange={(e) => { setViewOnly(false); setProjectId(e.target.value); }}
                className="h-10 min-w-[260px] rounded-[8px] border border-[#d9e4f2] bg-white px-3 text-[13px] font-semibold text-[#1e3261] outline-none"
              >
                <option value="">Select won project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.project_id} · {p.customer_name || p.project_name}</option>
                ))}
              </select>
            </label>
            {readOnly ? (
              <button type="button" onClick={() => setViewOnly(false)} className="inline-flex h-10 items-center gap-1.5 rounded-[8px] border border-[#d5e0ef] px-3 text-[13px] font-semibold text-[#314a79]">
                <Pencil className="size-4" /> Edit
              </button>
            ) : null}
          </div>
        </div>

        {project ? (
          <div className="mt-3 grid gap-2 rounded-[10px] border border-[#e7eef7] bg-[#f8fbff] p-3 text-[12px] sm:grid-cols-2 lg:grid-cols-5">
            {[
              ['Customer', project.customer_name],
              ['Site', project.site || project.city],
              ['Capacity', project.capacity_kwp ? `${project.capacity_kwp} kWp` : ''],
              ['Project Manager', project.manager_name],
              ['Project Status', project.status],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="font-semibold text-[#8a98af]">{label}</p>
                <p className="truncate font-bold text-[#1e3261]">{value || '—'}</p>
              </div>
            ))}
          </div>
        ) : null}

        {!projectId ? (
          <div className="mt-4 rounded-[12px] border border-dashed border-[#d5e0ef] bg-[#f8fbff] px-6 py-12 text-center">
            <ClipboardList className="mx-auto size-8 text-[#9aa8bc]" />
            <p className="mt-2 text-[15px] font-extrabold text-[#1e3261]">Select a project</p>
            <p className="mt-1 text-[13px] font-medium text-[#7386a3]">Installation tasks will load automatically from Material Planning.</p>
          </div>
        ) : editorLoading ? (
          <p className="py-12 text-center text-[13px] font-semibold text-[#8a98af]">Loading job sheet...</p>
        ) : (
          <>
            <div className="mt-4 rounded-[12px] border border-[#e7eef7] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-[14px] font-extrabold text-[#1e3261]">Tasks from Material Planning</h3>
                {!readOnly ? (
                  <button type="button" onClick={syncFromPlanning} className="inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-[#dce6f3] bg-white px-2.5 text-[12px] font-semibold text-[#314a79] hover:bg-[#f8fbff]">
                    <RefreshCw className="size-3.5" /> Sync from Planning
                  </button>
                ) : null}
              </div>
              <TaskTable
                rows={items}
                vendors={vendors}
                labours={labours}
                readOnly={readOnly}
                onChangeRow={changeItem}
                onRemoveRow={(key) => setItems((prev) => prev.filter((r) => r._key !== key))}
                emptyText="No BOM items in Material Planning."
              />
              <p className="mt-2 text-right text-[14px] font-extrabold text-[#1e3261]">Subtotal (Tasks): {money(totals.taskTotal)}</p>
            </div>

            <div className="mt-4 rounded-[12px] border border-[#e7eef7] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-[14px] font-extrabold text-[#1e3261]">Extra Work</h3>
                {!readOnly ? (
                  <button type="button" onClick={() => setExtraItems((prev) => [...prev, makeRow({ cost: '', qty: 1 })])} className="inline-flex h-8 items-center gap-1.5 rounded-[7px] bg-[#eef2f7] px-3 text-[12px] font-bold text-[#314a79] hover:bg-[#e2e8f1]">
                    <Plus className="size-3.5" /> Add Extra Work
                  </button>
                ) : null}
              </div>
              <TaskTable
                rows={extraItems}
                editable
                vendors={vendors}
                labours={labours}
                readOnly={readOnly}
                onChangeRow={changeExtra}
                onRemoveRow={(key) => setExtraItems((prev) => prev.filter((r) => r._key !== key))}
                emptyText="No extra work added."
              />
              <p className="mt-2 text-right text-[14px] font-extrabold text-[#1e3261]">Subtotal (Extra Work): {money(totals.extraTotal)}</p>
            </div>

            <div className="mt-4 space-y-2 border-b border-[#edf2f8] pb-3">
              <TotalLine label="Grand Total" value={money(totals.grand)} />
              <TotalLine label="Discount">
                <input type="number" min="0" disabled={readOnly} value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-8 w-[110px] rounded-[6px] border border-[#d9e4f2] px-2 text-right text-[14px] font-extrabold text-[#1e3261] outline-none" />
              </TotalLine>
              <TotalLine label="Round Off" value={money(totals.roundOff)} />
            </div>
            <div className="mt-3 space-y-2 border-b border-[#edf2f8] pb-3">
              <TotalLine label="Final Total" value={money(totals.final)} big />
              <TotalLine label="Advance Payment" tone="text-[#16a34a]">
                <input type="number" min="0" disabled={readOnly} value={advance} onChange={(e) => setAdvance(e.target.value)} className="h-8 w-[110px] rounded-[6px] border border-[#cfe8d6] px-2 text-right text-[14px] font-extrabold text-[#16a34a] outline-none" />
              </TotalLine>
            </div>
            <div className="mt-3">
              <TotalLine label="Balance Due" value={money(totals.balance)} tone="text-[#dc2626]" big />
            </div>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <label className="grid flex-1 gap-1 text-[12px] font-bold text-[#53647f]">
                Remarks
                <textarea rows={2} disabled={readOnly} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Site instructions, safety notes..." className="rounded-[8px] border border-[#d9e4f2] px-3 py-2 text-[13px] font-medium text-[#1e3261] outline-none" />
              </label>
              {!readOnly ? (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 rounded-[8px] border border-[#d9e4f2] bg-white px-3 text-[13px] font-bold text-[#314a79] outline-none">
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
                  </select>
                  <button type="button" disabled={generating || saving} onClick={handleGenerate} className="inline-flex h-11 items-center gap-2 rounded-[8px] bg-[#16a34a] px-5 text-[13px] font-bold text-white shadow-[0_8px_16px_rgba(22,163,74,0.22)] hover:bg-[#12913f] disabled:opacity-60">
                    <FileText className="size-4" />
                    {generating ? 'Generating...' : 'Work Order Generate'}
                  </button>
                  <button type="button" disabled={saving || generating} onClick={handleSave} className="inline-flex h-11 items-center gap-2 rounded-[8px] bg-[#0b65e5] px-5 text-[13px] font-bold text-white shadow-[0_8px_16px_rgba(11,101,229,0.22)] hover:bg-[#0a58c8] disabled:opacity-60">
                    <Save className="size-4" />
                    {saving ? 'Saving...' : 'Save Job Sheet'}
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}

        <div className="mt-6 border-t border-[#edf2f8] pt-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-1 text-[12px] font-bold text-[#53647f]">
              Project No
              <input value={filterDraft.project_code} onChange={(e) => setFilterDraft((p) => ({ ...p, project_code: e.target.value }))} placeholder="Search by project no" className={FILTER_INPUT} />
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-[#53647f]">
              Customer Name
              <input value={filterDraft.customer} onChange={(e) => setFilterDraft((p) => ({ ...p, customer: e.target.value }))} placeholder="Search by customer name" className={FILTER_INPUT} />
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-[#53647f]">
              Date From
              <input type="date" value={filterDraft.date_from} onChange={(e) => setFilterDraft((p) => ({ ...p, date_from: e.target.value }))} className={FILTER_INPUT} />
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-[#53647f]">
              Date To
              <input type="date" value={filterDraft.date_to} onChange={(e) => setFilterDraft((p) => ({ ...p, date_to: e.target.value }))} className={FILTER_INPUT} />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => { setVisible(PAGE_SIZE); setFilters({ ...filterDraft }); }} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#078c3e] px-4 text-[13px] font-bold text-white">
              <Search className="size-4" /> Search
            </button>
            <button
              type="button"
              onClick={() => {
                const empty = { project_code: '', customer: '', date_from: '', date_to: '' };
                setFilterDraft(empty);
                setFilters(empty);
                setVisible(PAGE_SIZE);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#d5e0ef] bg-white px-4 text-[13px] font-semibold text-[#314a79]"
            >
              <RotateCcw className="size-4" /> Reset
            </button>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="font-display text-[18px] font-extrabold text-[#111827]">Job Sheet Reports</h3>
          <div className="mt-3 overflow-x-auto rounded-[10px] border border-[#e7eef7]">
            <table className="w-full min-w-[960px] border-collapse text-left">
              <thead>
                <tr className="bg-[#f6f8fb] text-[12px] font-bold text-[#1e3261]">
                  {['Status', 'Project No', 'Customer Name', 'Assigned Manager', 'Job Sheet No', 'Work Orders', 'Date', 'Total Amount', 'Actions'].map((h) => (
                    <th key={h} className={cx('px-3 py-2', h === 'Total Amount' && 'text-right', h === 'Actions' && 'text-center')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listLoading ? (
                  <tr><td colSpan={9} className="py-8 text-center text-[13px] font-semibold text-[#8a98af]">Loading...</td></tr>
                ) : shown.length === 0 ? (
                  <tr><td colSpan={9} className="py-8 text-center text-[13px] font-semibold text-[#8a98af]">No job sheets found.</td></tr>
                ) : shown.map((row) => (
                  <tr key={row.id} className={cx('border-t border-[#f0f4f9] text-[13px] hover:bg-[#fafcff]', String(row.project) === String(projectId) && 'bg-[#f3fbf6]')}>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#53647f]">
                        <span className={cx('size-2 rounded-full', row.status === 'Completed' ? 'bg-[#16a34a]' : 'bg-[#f59e0b]')} />
                        {row.status?.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-bold text-[#1e3261]">{row.project_code}</td>
                    <td className="px-3 py-2 text-[#314a79]">{row.customer_name || '—'}</td>
                    <td className="px-3 py-2 font-semibold text-[#0b65e5]">{row.manager_name || 'N/A'}</td>
                    <td className="px-3 py-2 font-semibold text-[#0b65e5]">{row.job_sheet_no}</td>
                    <td className="px-3 py-2 font-semibold text-[#0b65e5]">{row.work_order_count || 'N/A'}</td>
                    <td className="px-3 py-2 text-[#53647f]">{fmtDate(row.updated_at)}</td>
                    <td className="px-3 py-2 text-right font-extrabold text-[#1e3261]">{money(row.final_total)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-3">
                        <button type="button" onClick={() => openSheet(row, true)} className="text-[#7c3aed]" aria-label="View"><Eye className="size-4" /></button>
                        <button type="button" onClick={() => openSheet(row, false)} className="text-[#0b65e5]" aria-label="Edit"><Pencil className="size-4" /></button>
                        <button type="button" onClick={() => setDeleting(row)} className="text-[#dc2626]" aria-label="Delete"><Trash2 className="size-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!listLoading && sheets.length > 0 ? (
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-[13px] font-medium text-[#7386a3]">Showing {shown.length} of {sheets.length} records</p>
              {sheets.length > visible ? (
                <button type="button" onClick={() => setVisible((v) => v + PAGE_SIZE)} className="h-9 rounded-[8px] border border-[#d5e0ef] bg-white px-4 text-[13px] font-semibold text-[#1e3261] hover:bg-[#f8fbff]">
                  Show More ({sheets.length - visible} remaining)
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {deleting ? <ConfirmDelete label={deleting.job_sheet_no} onConfirm={confirmDelete} onCancel={() => setDeleting(null)} /> : null}
    </div>
  );
}
