import { useCallback, useEffect, useDeferredValue, useMemo, useState } from 'react';
import {
  AlertCircle, Boxes, ClipboardCheck, MapPin, Pencil, Save, Search, Trash2, Truck, Wrench, X,
} from 'lucide-react';
import { dailyTasksApi, inventoryApi, leadApi, projectApi, workforceApi } from './api.js';

const CARD = 'rounded-[12px] border border-[#dbe5f2] bg-white shadow-[0_8px_24px_rgba(24,48,87,0.06)]';

const STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed'];
const DELIVERY_STATUS_OPTIONS = ['Pending', 'Partial', 'Delivered'];

export const TASK_CATEGORIES = [
  {
    id: 'site_visit_log',
    label: 'Site Visit / Survey Log',
    shortLabel: 'Site Visit',
    addTitle: 'Add Site Visit Log',
    editTitle: 'Edit Site Visit Log',
    icon: MapPin,
    iconBg: 'bg-[#dbeafe]',
    iconColor: 'text-[#2563eb]',
    borderHover: 'hover:border-[#93c5fd]',
  },
  {
    id: 'installation_progress',
    label: 'Installation Daily Progress',
    shortLabel: 'Installation',
    addTitle: 'Add Installation Progress Report',
    editTitle: 'Edit Installation Progress Report',
    icon: Wrench,
    iconBg: 'bg-[#ffedd5]',
    iconColor: 'text-[#ea580c]',
    borderHover: 'hover:border-[#fdba74]',
  },
  {
    id: 'material_dispatch',
    label: 'Material Dispatch to Site',
    shortLabel: 'Material Dispatch',
    addTitle: 'Add Material Dispatch',
    editTitle: 'Edit Material Dispatch',
    icon: Truck,
    iconBg: 'bg-[#ede9fe]',
    iconColor: 'text-[#7c3aed]',
    borderHover: 'hover:border-[#c4b5fd]',
  },
  {
    id: 'stock_check',
    label: 'Warehouse Stock Check',
    shortLabel: 'Stock Check',
    addTitle: 'Add Warehouse Stock Check',
    editTitle: 'Edit Warehouse Stock Check',
    icon: ClipboardCheck,
    iconBg: 'bg-[#dcfce7]',
    iconColor: 'text-[#16a34a]',
    borderHover: 'hover:border-[#86efac]',
  },
];

const CATEGORY_MAP = Object.fromEntries(TASK_CATEGORIES.map((c) => [c.id, c]));

// Local-date formatting: toISOString() shifts to UTC, which turns IST
// midnights into the previous day (e.g. "1 July" becomes "30 June").
function toLocalIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayIso() {
  return toLocalIso(new Date());
}

function monthStartIso() {
  const now = new Date();
  return toLocalIso(new Date(now.getFullYear(), now.getMonth(), 1));
}

function normalizeRows(data) {
  if (!data) return [];
  return Array.isArray(data) ? data : data.results ?? [];
}

function formatDisplayDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN');
}

function emptyForm(category) {
  return {
    category,
    task_date: todayIso(),
    status: 'Pending',
    notes: '',
    assigned_to: '',
    details: {},
  };
}

function buildFieldConfig({ projects, leads, warehouses }) {
  const projectOptions = projects.map((p) => ({
    value: String(p.id),
    label: p.project_name || p.project_id || `Project #${p.id}`,
  }));
  const leadOptions = leads.map((l) => ({
    value: String(l.id),
    label: l.customer_name || l.lead_id || `Lead #${l.id}`,
  }));
  const warehouseOptions = warehouses.map((w) => ({
    value: String(w.id),
    label: w.name || w.code || `Warehouse #${w.id}`,
  }));

  return {
    site_visit_log: [
      { key: 'project_id', label: 'Project', type: 'select', options: projectOptions, placeholder: 'Select project (optional)' },
      { key: 'lead_id', label: 'Lead', type: 'select', options: leadOptions, placeholder: 'Select lead (optional)' },
      { key: 'site_location', label: 'Site Location', type: 'text', placeholder: 'Address or site name', full: true },
      { key: 'survey_findings', label: 'Survey Findings', type: 'textarea', required: true, placeholder: 'Roof condition, shading, meter type, notes…', full: true },
    ],
    installation_progress: [
      { key: 'project_id', label: 'Project', type: 'select', options: projectOptions, required: true, placeholder: 'Select project' },
      { key: 'work_done', label: 'Work Done Today', type: 'textarea', required: true, placeholder: 'Panels mounted, inverter installed, wiring, etc.', full: true },
      { key: 'progress_percent', label: 'Progress Today (%)', type: 'number', min: 0, max: 100 },
      { key: 'blockers', label: 'Issues / Blockers', type: 'textarea', placeholder: 'Any delays or issues on site', full: true },
    ],
    material_dispatch: [
      { key: 'project_id', label: 'Project', type: 'select', options: projectOptions, required: true, placeholder: 'Select project' },
      { key: 'vehicle_number', label: 'Vehicle / Transporter', type: 'text', placeholder: 'e.g., MH12AB1234 or transporter name' },
      { key: 'items_dispatched', label: 'Items Dispatched', type: 'textarea', required: true, placeholder: 'Panels, inverter, cable, quantities…', full: true },
      { key: 'challan_no', label: 'Challan / DC Number', type: 'text' },
      { key: 'received_by', label: 'Received By (Site)', type: 'text' },
      { key: 'delivery_status', label: 'Delivery Status', type: 'select', options: DELIVERY_STATUS_OPTIONS.map((o) => ({ value: o, label: o })), default: 'Pending' },
    ],
    stock_check: [
      { key: 'warehouse_id', label: 'Warehouse', type: 'select', options: warehouseOptions, required: true, placeholder: 'Select warehouse' },
      { key: 'checked_items', label: 'Checked Items', type: 'textarea', required: true, placeholder: 'List items checked (one per line)', full: true },
      { key: 'discrepancies', label: 'Discrepancies Found', type: 'textarea', placeholder: 'Physical vs system quantity mismatches', full: true },
    ],
  };
}

function labelForSelect(field, value, options) {
  const match = options.find((o) => o.value === String(value));
  return match?.label || '';
}

function TaskModal({
  open, mode, categoryId, initial, saving, employees, fieldConfig, onClose, onSave,
}) {
  const category = CATEGORY_MAP[categoryId];
  const [form, setForm] = useState(() => emptyForm(categoryId));

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && initial) {
      const details = { ...(initial.details || {}) };
      ['project_id', 'lead_id', 'warehouse_id'].forEach((k) => {
        if (details[k] != null && details[k] !== '') details[k] = String(details[k]);
      });
      setForm({
        category: initial.category,
        task_date: initial.task_date,
        status: initial.status || 'Pending',
        notes: initial.notes || '',
        assigned_to: initial.assigned_to ? String(initial.assigned_to) : '',
        details,
      });
    } else {
      setForm(emptyForm(categoryId));
    }
  }, [open, mode, categoryId, initial]);

  if (!open || !category) return null;

  const fields = fieldConfig[categoryId] || [];
  const title = mode === 'edit' ? category.editTitle : category.addTitle;

  const setDetail = (key, value, field) => {
    setForm((prev) => {
      const next = { ...prev.details, [key]: value };
      if (field?.type === 'select') {
        const label = labelForSelect(field, value, field.options);
        if (key === 'project_id') next.project_label = label;
        if (key === 'lead_id') next.lead_label = label;
        if (key === 'warehouse_id') next.warehouse_label = label;
      }
      return { ...prev, details: next };
    });
  };

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const details = { ...form.details };
    fields.forEach((field) => {
      if (field.default && (details[field.key] == null || details[field.key] === '')) {
        details[field.key] = field.default;
      }
    });
    const payload = {
      ...form,
      assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
      details: {
        ...details,
        project_id: details.project_id ? Number(details.project_id) : null,
        lead_id: details.lead_id ? Number(details.lead_id) : null,
        warehouse_id: details.warehouse_id ? Number(details.warehouse_id) : null,
      },
    };
    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-120 flex items-center justify-center bg-[#0f1f3d]/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[680px] rounded-[14px] border border-[#dbe5f2] bg-white shadow-[0_24px_60px_rgba(15,31,61,0.22)]">
        <div className="flex items-center justify-between border-b border-[#e7eef7] px-5 py-4">
          <h2 className="font-display text-[18px] font-extrabold text-[#1e3261]">{title}</h2>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-[8px] text-[#7a8fa6] transition hover:bg-[#f3f7fc]">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[72vh] overflow-y-auto px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-[12px] font-bold text-[#53647f]">
              Date <span className="text-[#dc2626]">*</span>
              <input type="date" required className="mt-1.5 h-11 w-full rounded-[8px] border border-[#d9e2ec] px-3 text-[13px] font-semibold text-[#30466d]" value={form.task_date} onChange={(e) => setField('task_date', e.target.value)} />
            </label>
            <label className="block text-[12px] font-bold text-[#53647f]">
              Status
              <select className="mt-1.5 h-11 w-full rounded-[8px] border border-[#d9e2ec] px-3 text-[13px] font-semibold text-[#30466d]" value={form.status} onChange={(e) => setField('status', e.target.value)}>
                {STATUS_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
          </div>

          <label className="mt-4 block text-[12px] font-bold text-[#53647f]">
            Assigned To <span className="font-semibold text-[#9aa8bc]">(optional)</span>
            <select
              className="mt-1.5 h-11 w-full rounded-[8px] border border-[#d9e2ec] px-3 text-[13px] font-semibold text-[#30466d]"
              value={form.assigned_to}
              onChange={(e) => setField('assigned_to', e.target.value)}
            >
              <option value="">Select employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}{emp.employee_id ? ` (${emp.employee_id})` : ''}</option>
              ))}
            </select>
          </label>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {fields.map((field) => {
              const inputClass = 'mt-1.5 w-full rounded-[8px] border border-[#d9e2ec] px-3 text-[13px] font-semibold text-[#30466d]';
              const wrapClass = field.full ? 'sm:col-span-2' : '';
              const val = form.details[field.key] ?? (field.default || '');
              return (
                <label key={field.key} className={`block text-[12px] font-bold text-[#53647f] ${wrapClass}`}>
                  {field.label}{field.required ? <span className="text-[#dc2626]"> *</span> : null}
                  {field.type === 'textarea' ? (
                    <textarea rows={4} required={field.required} placeholder={field.placeholder} className={`${inputClass} py-2.5`} value={val} onChange={(e) => setDetail(field.key, e.target.value, field)} />
                  ) : field.type === 'select' ? (
                    <select required={field.required} className={`${inputClass} h-11`} value={val} onChange={(e) => setDetail(field.key, e.target.value, field)}>
                      <option value="">{field.placeholder || 'Select'}</option>
                      {(field.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      min={field.min}
                      max={field.max}
                      required={field.required}
                      placeholder={field.placeholder}
                      className={`${inputClass} h-11`}
                      value={val}
                      onChange={(e) => setDetail(field.key, e.target.value, field)}
                    />
                  )}
                </label>
              );
            })}
          </div>

          <label className="mt-4 block text-[12px] font-bold text-[#53647f]">
            Additional Notes
            <textarea rows={3} className="mt-1.5 w-full rounded-[8px] border border-[#d9e2ec] px-3 py-2.5 text-[13px] font-semibold text-[#30466d]" value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
          </label>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#e7eef7] pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-extrabold text-[#53647f] transition hover:text-[#1e3261]">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-[8px] bg-[#0d9f4a] px-5 text-[13px] font-extrabold text-white shadow-[0_8px_18px_rgba(13,159,74,0.28)] transition hover:bg-[#078c3e] disabled:opacity-60">
              <Save className="size-4" />
              {saving ? 'Saving…' : 'Save Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StatusCell({ status }) {
  const tone = status === 'Completed' ? 'text-[#16a34a]' : status === 'In Progress' ? 'text-[#2563eb]' : 'text-[#ea580c]';
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] font-extrabold ${tone}`}>
      {status === 'Pending' ? <AlertCircle className="size-4" /> : null}
      {status}
    </span>
  );
}

export function DailyTasksPage({ onNotify }) {
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [dateFrom, setDateFrom] = useState(() => monthStartIso());
  const [dateTo, setDateTo] = useState(() => todayIso());
  const [modal, setModal] = useState({ open: false, mode: 'create', categoryId: 'site_visit_log', task: null });
  const [saving, setSaving] = useState(false);
  const [noteEdit, setNoteEdit] = useState({ id: null, value: '' });
  const [projects, setProjects] = useState([]);
  const [leads, setLeads] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    Promise.all([
      projectApi.list({ page_size: 500 }),
      leadApi.list({ page_size: 500 }),
      inventoryApi.warehouses.list({ page_size: 200 }),
      workforceApi.listEmployees({ page_size: 500 }),
    ])
      .then(([projRes, leadRes, whRes, empRes]) => {
        setProjects(normalizeRows(projRes));
        setLeads(normalizeRows(leadRes));
        setWarehouses(normalizeRows(whRes));
        const present = normalizeRows(empRes).filter((e) => e.status !== 'On Leave');
        present.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setEmployees(present);
      })
      .catch(() => {});
  }, []);

  const fieldConfig = useMemo(
    () => buildFieldConfig({ projects, leads, warehouses }),
    [projects, leads, warehouses],
  );

  const load = useCallback(() => {
    setLoading(true);
    const params = { date_from: dateFrom, date_to: dateTo, page_size: 500 };
    if (categoryFilter !== 'All Categories') params.category = categoryFilter;
    if (deferredSearch.trim()) params.search = deferredSearch.trim();
    Promise.all([dailyTasksApi.list(params), dailyTasksApi.summary()])
      .then(([listRes, summaryRes]) => {
        setTasks(normalizeRows(listRes));
        setSummary(summaryRes || {});
      })
      .catch((e) => onNotify?.(e.message || 'Could not load daily tasks', 'error'))
      .finally(() => setLoading(false));
  }, [categoryFilter, dateFrom, dateTo, deferredSearch, onNotify]);

  useEffect(() => { load(); }, [load]);

  const categoryCounts = useMemo(() => TASK_CATEGORIES.map((cat) => {
    const row = summary[cat.id] || { total: 0, completed: 0 };
    return { ...cat, total: row.total, completed: row.completed };
  }), [summary]);

  const openCreate = (categoryId) => setModal({ open: true, mode: 'create', categoryId, task: null });
  const openEdit = (task) => setModal({ open: true, mode: 'edit', categoryId: task.category, task });
  const closeModal = () => setModal((m) => ({ ...m, open: false }));

  const handleSave = async (form) => {
    setSaving(true);
    try {
      const payload = {
        category: form.category,
        task_date: form.task_date,
        status: form.status,
        notes: form.notes,
        details: form.details,
        assigned_to: form.assigned_to || null,
      };
      if (modal.mode === 'edit' && modal.task?.id) {
        await dailyTasksApi.update(modal.task.id, payload);
        onNotify?.('Task updated successfully', 'success');
      } else {
        await dailyTasksApi.create(payload);
        onNotify?.('Task added successfully', 'success');
      }
      closeModal();
      load();
    } catch (e) {
      onNotify?.(e.message || 'Could not save task', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (task) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await dailyTasksApi.delete(task.id);
      onNotify?.('Task deleted', 'success');
      load();
    } catch (e) {
      onNotify?.(e.message || 'Could not delete task', 'error');
    }
  };

  const saveInlineNote = async () => {
    if (!noteEdit.id) return;
    try {
      await dailyTasksApi.update(noteEdit.id, { notes: noteEdit.value });
      setNoteEdit({ id: null, value: '' });
      onNotify?.('Note saved', 'success');
      load();
    } catch (e) {
      onNotify?.(e.message || 'Could not save note', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[24px] font-extrabold text-[#1e3261]">Daily Tasks &amp; Reports</h1>
        <p className="mt-1 text-[13px] font-semibold text-[#7a8fa6]">Site visits, installation progress, material dispatch and warehouse checks for solar operations.</p>
      </div>

      <section className={`${CARD} p-4 sm:p-5`}>
        <h2 className="text-[15px] font-extrabold text-[#1e3261]">Add New Task</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {categoryCounts.map((cat) => {
            const Icon = cat.icon;
            return (
              <button key={cat.id} type="button" onClick={() => openCreate(cat.id)} className={`flex items-center gap-3 rounded-[10px] border border-[#e7eef7] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${cat.borderHover}`}>
                <span className={`grid size-11 shrink-0 place-items-center rounded-[10px] ${cat.iconBg}`}>
                  <Icon className={`size-5 ${cat.iconColor}`} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-extrabold text-[#1e3261]">{cat.label}</span>
                  <span className="mt-1 block text-[11px] font-bold text-[#7a8fa6]">{cat.completed}/{cat.total} completed</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={`${CARD} p-4 sm:p-5`}>
        <h2 className="text-[15px] font-extrabold text-[#1e3261]">Search Tasks</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]">
          <label className="block text-[12px] font-bold text-[#53647f]">
            Search Tasks
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9aa8bc]" />
              <input type="search" placeholder="Search by project, site, vehicle, employee…" className="h-11 w-full rounded-[8px] border border-[#d9e2ec] pl-10 pr-3 text-[13px] font-semibold text-[#30466d]" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </label>
          <label className="block text-[12px] font-bold text-[#53647f]">
            Category
            <select className="mt-1.5 h-11 w-full rounded-[8px] border border-[#d9e2ec] px-3 text-[13px] font-semibold text-[#30466d]" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option>All Categories</option>
              {TASK_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.shortLabel}</option>)}
            </select>
          </label>
          <label className="block text-[12px] font-bold text-[#53647f]">
            From Date
            <input type="date" className="mt-1.5 h-11 w-full rounded-[8px] border border-[#d9e2ec] px-3 text-[13px] font-semibold text-[#30466d]" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label className="block text-[12px] font-bold text-[#53647f]">
            To Date
            <input type="date" className="mt-1.5 h-11 w-full rounded-[8px] border border-[#d9e2ec] px-3 text-[13px] font-semibold text-[#30466d]" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
        </div>
        <p className="mt-3 text-[12px] font-bold text-[#7a8fa6]">Showing {tasks.length} task(s)</p>
      </section>

      <section className={`${CARD} overflow-hidden`}>
        <div className="border-b border-[#e7eef7] px-4 py-3 sm:px-5">
          <h2 className="text-[15px] font-extrabold text-[#1e3261]">All Tasks</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="crm-table w-full min-w-[1000px]">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Details</th>
                <th>Assigned To</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center text-[#7a8fa6]">Loading tasks…</td></tr>
              ) : tasks.length ? tasks.map((task) => {
                const cat = CATEGORY_MAP[task.category];
                return (
                  <tr key={task.id}>
                    <td className="font-extrabold text-[#1e3261]">{formatDisplayDate(task.task_date)}</td>
                    <td>
                      <span className="inline-flex rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[11px] font-extrabold text-[#475569]">
                        {task.category_label || cat?.shortLabel || task.category}
                      </span>
                    </td>
                    <td className="max-w-[220px] truncate font-semibold text-[#30466d]">{task.summary_text || '—'}</td>
                    <td className="font-semibold text-[#53647f]">{task.assigned_to_name || '—'}</td>
                    <td><StatusCell status={task.status} /></td>
                    <td className="max-w-[160px]">
                      {noteEdit.id === task.id ? (
                        <div className="flex items-center gap-2">
                          <input className="h-9 min-w-[100px] flex-1 rounded-[6px] border border-[#d9e2ec] px-2 text-[12px]" value={noteEdit.value} onChange={(e) => setNoteEdit({ id: task.id, value: e.target.value })} />
                          <button type="button" onClick={saveInlineNote} className="text-[12px] font-extrabold text-[#0d9f4a]">Save</button>
                        </div>
                      ) : task.notes ? (
                        <span className="block truncate text-[12px] font-semibold text-[#53647f]">{task.notes}</span>
                      ) : (
                        <button type="button" onClick={() => setNoteEdit({ id: task.id, value: '' })} className="text-[12px] font-extrabold text-[#0b65e5] hover:underline">Add note</button>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => openEdit(task)} className="grid size-9 place-items-center rounded-[8px] text-[#2563eb] transition hover:bg-[#eff6ff]" aria-label="Edit"><Pencil className="size-4" /></button>
                        <button type="button" onClick={() => handleDelete(task)} className="grid size-9 place-items-center rounded-[8px] text-[#dc2626] transition hover:bg-[#fef2f2]" aria-label="Delete"><Trash2 className="size-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <div className="mx-auto grid size-14 place-items-center rounded-full bg-[#f1f5f9] text-[#7a8fa6]"><Boxes className="size-7" /></div>
                    <p className="mt-3 text-[14px] font-extrabold text-[#1e3261]">No tasks found</p>
                    <p className="mt-1 text-[12px] font-semibold text-[#7a8fa6]">Use the cards above to add a site visit, installation or dispatch report.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <TaskModal
        open={modal.open}
        mode={modal.mode}
        categoryId={modal.categoryId}
        initial={modal.task}
        saving={saving}
        employees={employees}
        fieldConfig={fieldConfig}
        onClose={closeModal}
        onSave={handleSave}
      />
    </div>
  );
}
