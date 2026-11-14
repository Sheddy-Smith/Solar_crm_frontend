import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Eye,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { inventoryApi, materialPlanApi } from './api.js';
import { fetchEveryPage, rowsOf } from './lib/listQuery.js';
import {
  BOM_TEMPLATES,
  DISPATCH_CATEGORIES,
  suggestTemplateKey,
} from './bomMaterialTemplates.js';

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

const num = (v) => {
  const n = Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const uid = () => `mp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function parseDispatched(v) {
  if (v == null || v === '') return 0;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function stockOf(item) {
  if (!item) return 0;
  for (const k of ['current_stock', 'stock_qty', 'available_qty', 'quantity', 'qty']) {
    if (item[k] != null && item[k] !== '') return num(item[k]);
  }
  return 0;
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[×–—]/g, 'x')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchInventory(items, name) {
  const target = norm(name);
  if (!target) return null;
  let hit = items.find((i) => norm(i.name) === target);
  if (hit) return hit;
  hit = items.find((i) => norm(i.name).includes(target) || target.includes(norm(i.name)));
  return hit || null;
}

function makeLine(partial = {}) {
  return {
    _key: uid(),
    id: null,
    category: 'Other',
    material_name: '',
    specification: '',
    unit: 'Nos',
    planned_qty: '',
    dispatched_qty: '0',
    inventory_item: '',
    status: 'Not Started',
    selected: false,
    ...partial,
  };
}

function lineFromPlan(plan, inventoryItems = []) {
  const inv = inventoryItems.find((i) => String(i.id) === String(plan.inventory_item));
  const name = plan.items || inv?.name || '';
  const notes = String(plan.dispatch_notes || '');
  const specMatch = notes.match(/^SPEC:(.*?)(?:\n|$)/);
  return makeLine({
    id: plan.id,
    category: plan.category || inv?.category || 'Other',
    material_name: name,
    specification: specMatch ? specMatch[1].trim() : '',
    unit: plan.uom || inv?.unit || 'Nos',
    planned_qty: String(plan.planned_qty ?? ''),
    dispatched_qty: String(parseDispatched(plan.dispatched_qty)),
    inventory_item: plan.inventory_item || '',
    status: plan.status || 'Not Started',
  });
}

function balanceOf(line) {
  return Math.max(0, num(line.planned_qty) - parseDispatched(line.dispatched_qty));
}

function categoryDispatchStatus(lines, category) {
  const rows = lines.filter((l) => (l.category || 'Other') === category && num(l.planned_qty) > 0);
  if (!rows.length) return 'empty';
  const allDone = rows.every((l) => balanceOf(l) <= 0);
  const anyDisp = rows.some((l) => parseDispatched(l.dispatched_qty) > 0);
  if (allDone) return 'done';
  if (anyDisp) return 'partial';
  return 'pending';
}

export function MaterialPlanningBomPage({
  project,
  projects = [],
  showBack = false,
  onClose,
  onNotify,
  onPlansChanged,
  onOpenSection,
  onChangeProject,
  panelClass = 'rounded-[14px] border border-[#e6edf6] bg-white shadow-sm',
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [templateKey, setTemplateKey] = useState(() => suggestTemplateKey(project?.capacity_kwp));
  const [search, setSearch] = useState('');
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectQuery, setProjectQuery] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importQuery, setImportQuery] = useState('');
  const [editLine, setEditLine] = useState(null);
  const [specs, setSpecs] = useState({
    c_channel_length: '20',
    c_channel_size: '41×41 mm',
    pole_height: '7',
    pole_size: '60×60 mm',
  });
  const projectRef = useRef(null);

  const load = async () => {
    if (!project?.id) {
      setLines([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [planData, itemsData] = await Promise.all([
        materialPlanApi.list({ project: project.id, page_size: 200 }),
        fetchEveryPage((page, pageSize) =>
          inventoryApi.items.list({ page, page_size: pageSize, is_active: true }),
        ).catch(() => []),
      ]);
      const items = (Array.isArray(itemsData) ? itemsData : rowsOf(itemsData))
        .filter((item) => item?.is_active !== false);
      setInventoryItems(items);
      const rows = rowsOf(planData).map((p) => lineFromPlan(p, items));
      setLines(rows);
      setTemplateKey(suggestTemplateKey(project?.capacity_kwp));
    } catch (e) {
      onNotify?.(e.message || 'Failed to load material planning', 'error');
      setLines([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  useEffect(() => {
    const onDoc = (e) => {
      if (projectRef.current && !projectRef.current.contains(e.target)) setProjectOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filteredProjects = useMemo(() => {
    const q = projectQuery.trim().toLowerCase();
    const list = Array.isArray(projects) ? projects : [];
    if (!q) return list.slice(0, 40);
    return list
      .filter((p) =>
        [p.project_name, p.project_id, p.customer_name, p.capacity_kwp]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 40);
  }, [projects, projectQuery]);

  const visibleLines = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter((l) =>
      [l.material_name, l.specification, l.category, l.unit].join(' ').toLowerCase().includes(q),
    );
  }, [lines, search]);

  const totals = useMemo(() => {
    return lines.reduce(
      (acc, l) => {
        if (!l.material_name && !num(l.planned_qty)) return acc;
        acc.items += 1;
        acc.planned += num(l.planned_qty);
        acc.dispatched += parseDispatched(l.dispatched_qty);
        acc.balance += balanceOf(l);
        return acc;
      },
      { items: 0, planned: 0, dispatched: 0, balance: 0 },
    );
  }, [lines]);

  const patchLine = (key, patch) => {
    setLines((prev) => prev.map((l) => (l._key === key ? { ...l, ...patch } : l)));
  };

  const buildPayload = (line, { includeDispatch = true } = {}) => {
    const notes = line.specification ? `SPEC:${line.specification}` : '';
    const payload = {
      project: project.id,
      category: line.category || 'Other',
      items: String(line.material_name || '').slice(0, 50),
      uom: line.unit || 'Nos',
      planned_qty: String(num(line.planned_qty)),
      status: line.status || 'Not Started',
      vehicle_no: '',
      challan_no: '',
      dispatch_notes: notes,
    };
    if (includeDispatch) {
      payload.dispatched_qty = String(parseDispatched(line.dispatched_qty));
    }
    if (line.inventory_item) {
      payload.inventory_item = line.inventory_item;
    }
    // Keep planned_value / planning_unit_price out of this UI (no payment/pricing workflow).
    return payload;
  };

  const saveOne = async (line, opts) => {
    if (!project?.id) {
      onNotify?.('Project missing', 'error');
      return null;
    }
    if (!String(line.material_name || '').trim()) {
      onNotify?.('Material name required', 'error');
      return null;
    }
    const payload = buildPayload(line, opts);
    try {
      if (line.id) return await materialPlanApi.update(line.id, payload);
      try {
        return await materialPlanApi.create(payload);
      } catch {
        const { inventory_item, ...fallback } = payload;
        return await materialPlanApi.create(fallback);
      }
    } catch (e) {
      onNotify?.(e.message || 'Save failed', 'error');
      return null;
    }
  };

  const applyTemplate = async (key, { replace = true } = {}) => {
    const tpl = BOM_TEMPLATES[key];
    if (!tpl) return;
    setTemplateKey(key);
    if (key === 'other') {
      onNotify?.('Other template — add materials manually or import from inventory');
      return;
    }
    if (!project?.id) {
      onNotify?.('Select a project first', 'error');
      return;
    }
    const existingDispatched = lines.some((l) => parseDispatched(l.dispatched_qty) > 0);
    if (existingDispatched && replace) {
      const ok = window.confirm(
        'Some items already have dispatched qty. Replace BOM with template? Dispatched lines will be kept and matched by name where possible.',
      );
      if (!ok) return;
    }

    setSaving(true);
    try {
      const keepByName = new Map();
      lines.forEach((l) => {
        if (l.id && parseDispatched(l.dispatched_qty) > 0) {
          keepByName.set(norm(l.material_name), l);
        }
      });

      if (replace) {
        for (const l of lines) {
          if (!l.id) continue;
          if (keepByName.has(norm(l.material_name))) continue;
          try {
            await materialPlanApi.delete(l.id);
          } catch {
            /* ignore */
          }
        }
      }

      const next = [];
      for (const row of tpl.lines) {
        if (!row.qty && replace) {
          // Keep zero-qty optional rows as editable drafts (not saved until qty set)
          next.push(
            makeLine({
              category: row.category,
              material_name: row.material_name,
              specification: row.specification || '',
              unit: row.unit,
              planned_qty: '0',
              dispatched_qty: '0',
            }),
          );
          continue;
        }
        const kept = keepByName.get(norm(row.material_name));
        if (kept) {
          next.push({
            ...kept,
            category: row.category,
            specification: row.specification || kept.specification,
            unit: row.unit || kept.unit,
            planned_qty: String(row.qty),
          });
          keepByName.delete(norm(row.material_name));
          continue;
        }
        const inv = matchInventory(inventoryItems, row.material_name);
        const draft = makeLine({
          category: row.category,
          material_name: row.material_name.slice(0, 50),
          specification: row.specification || '',
          unit: row.unit,
          planned_qty: String(row.qty),
          inventory_item: inv?.id || '',
        });
        const saved = await saveOne(draft);
        if (saved) next.push(lineFromPlan({ ...saved, inventory_item: draft.inventory_item }, inventoryItems));
        else next.push(draft);
      }

      // leftover dispatched-only lines
      for (const leftover of keepByName.values()) next.push(leftover);

      setLines(next);
      onNotify?.(`${tpl.label} applied`);
      onPlansChanged?.();
    } catch (e) {
      onNotify?.(e.message || 'Template apply failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addManualItem = () => {
    const draft = makeLine({ category: 'Other', material_name: '', planned_qty: '1' });
    setLines((prev) => [...prev, draft]);
    setEditLine(draft);
  };

  const importInventoryItem = async (item) => {
    if (!item) return;
    const draft = makeLine({
      category: item.category || 'Other',
      material_name: String(item.name || '').slice(0, 50),
      specification: item.hsn_code ? `HSN ${item.hsn_code}` : '',
      unit: item.unit || 'Nos',
      planned_qty: '1',
      inventory_item: item.id,
    });
    setSaving(true);
    try {
      const saved = await saveOne(draft);
      if (!saved) return;
      setLines((prev) => [...prev, lineFromPlan({ ...saved, inventory_item: item.id }, inventoryItems)]);
      onNotify?.(`Imported ${item.name} (stock ${stockOf(item)})`);
      onPlansChanged?.();
      setImportOpen(false);
      setImportQuery('');
    } finally {
      setSaving(false);
    }
  };

  const persistEdit = async () => {
    if (!editLine) return;
    setSaving(true);
    try {
      const saved = await saveOne(editLine);
      if (!saved) return;
      setLines((prev) =>
        prev.map((l) =>
          l._key === editLine._key
            ? lineFromPlan({ ...saved, inventory_item: editLine.inventory_item }, inventoryItems)
            : l,
        ),
      );
      setEditLine(null);
      onNotify?.(editLine.id ? 'BOM item updated' : 'BOM item added');
      onPlansChanged?.();
    } finally {
      setSaving(false);
    }
  };

  const deleteLine = async (line) => {
    if (!window.confirm(`Delete "${line.material_name || 'item'}"?`)) return;
    if (line.id) {
      try {
        await materialPlanApi.delete(line.id);
        onNotify?.('BOM item deleted');
        onPlansChanged?.();
      } catch (e) {
        onNotify?.(e.message || 'Delete failed', 'error');
        return;
      }
    }
    setLines((prev) => prev.filter((l) => l._key !== line._key));
  };

  const clearBom = async () => {
    if (!lines.length) return;
    if (!window.confirm('Clear all BOM lines for this project? Dispatched quantities will also be removed from planning rows.')) return;
    setSaving(true);
    try {
      for (const l of lines) {
        if (l.id) {
          try {
            await materialPlanApi.delete(l.id);
          } catch {
            /* ignore */
          }
        }
      }
      setLines([]);
      setTemplateKey('other');
      onNotify?.('BOM cleared');
      onPlansChanged?.();
    } finally {
      setSaving(false);
    }
  };

  const saveAll = async () => {
    const pending = lines.filter((l) => String(l.material_name || '').trim() && num(l.planned_qty) >= 0);
    if (!pending.length) {
      onNotify?.('Add at least one material line', 'error');
      return;
    }
    setSaving(true);
    try {
      const next = [];
      for (const line of pending) {
        if (!num(line.planned_qty) && !line.id) {
          next.push(line);
          continue;
        }
        const saved = await saveOne(line);
        if (!saved) throw new Error('Save stopped');
        next.push(lineFromPlan({ ...saved, inventory_item: line.inventory_item }, inventoryItems));
      }
      setLines(next);
      onNotify?.('Material planning saved');
      onPlansChanged?.();
    } catch (e) {
      if (e.message !== 'Save stopped') onNotify?.(e.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const markPlanningDone = async () => {
    const savedRows = lines.filter((l) => l.id);
    if (!savedRows.length) {
      onNotify?.('Save BOM lines first', 'error');
      return;
    }
    setSaving(true);
    try {
      for (const line of savedRows) {
        await materialPlanApi.update(line.id, {
          ...buildPayload({ ...line, status: 'Completed' }),
          status: 'Completed',
        });
      }
      onNotify?.('Material Planning marked done');
      onPlansChanged?.();
      await load();
    } catch (e) {
      onNotify?.(e.message || 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateDispatched = async (line, value) => {
    const dispatched = Math.max(0, num(value));
    const planned = num(line.planned_qty);
    const capped = planned > 0 ? Math.min(dispatched, planned) : dispatched;
    patchLine(line._key, { dispatched_qty: String(capped) });
    if (!line.id) return;
    try {
      await materialPlanApi.update(line.id, buildPayload({ ...line, dispatched_qty: String(capped) }));
      onPlansChanged?.();
    } catch (e) {
      onNotify?.(e.message || 'Dispatch qty update failed', 'error');
    }
  };

  const printChecklist = () => {
    const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1200');
    if (!win) {
      onNotify?.('Allow pop-ups to print checklist', 'error');
      return;
    }
    const rows = lines
      .filter((l) => l.material_name)
      .map(
        (l, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(l.material_name)}${l.specification ? `<br/><small>${escapeHtml(l.specification)}</small>` : ''}</td>
        <td>${escapeHtml(l.unit || '')}</td>
        <td>${num(l.planned_qty)}</td>
        <td>${parseDispatched(l.dispatched_qty)}</td>
        <td>${balanceOf(l)}</td>
      </tr>`,
      )
      .join('');
    win.document.write(`<!doctype html><html><head><title>BOM Checklist</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111}
        h1{font-size:18px;margin:0 0 4px}
        h2{font-size:14px;margin:0 0 16px;font-weight:600}
        .meta{font-size:12px;margin-bottom:12px}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #333;padding:4px 6px;text-align:left}
        th{background:#f3f4f6}
        .sign{display:flex;justify-content:space-between;margin-top:48px;font-size:12px}
        .sign div{width:30%;text-align:center;border-top:1px solid #333;padding-top:6px}
        @media print{button{display:none}}
      </style></head><body>
      <button onclick="window.print()">Print / Save PDF</button>
      <h1>MALWA SOLAR ENERGY — B.O.M. FORM (STRUCTURE & ELECTRICAL)</h1>
      <h2>Material Planning Checklist</h2>
      <div class="meta">
        <div><b>Client / Project:</b> ${escapeHtml(project?.customer_name || project?.project_name || '')}</div>
        <div><b>Project ID:</b> ${escapeHtml(project?.project_id || '')} &nbsp;|&nbsp;
            <b>Capacity:</b> ${escapeHtml(String(project?.capacity_kwp ?? ''))} kW &nbsp;|&nbsp;
            <b>Template:</b> ${escapeHtml(BOM_TEMPLATES[templateKey]?.label || '')}</div>
        <div><b>Date:</b> ${new Date().toLocaleDateString('en-IN')}</div>
        <div><b>Specs:</b> C-Channel ${escapeHtml(specs.c_channel_length)} ft / ${escapeHtml(specs.c_channel_size)};
            Pole ${escapeHtml(specs.pole_height)} ft / ${escapeHtml(specs.pole_size)}</div>
      </div>
      <table>
        <thead><tr>
          <th>Sr.No.</th><th>Material Name</th><th>Unit</th>
          <th>Outward (Planned)</th><th>Inward (Dispatched)</th><th>Balance</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="6">No materials</td></tr>'}</tbody>
      </table>
      <div class="sign">
        <div>Dispatcher</div>
        <div>Receiver</div>
        <div>Auditor</div>
      </div>
      </body></html>`);
    win.document.close();
  };

  const previewSummary = () => {
    onNotify?.(
      `BOM Preview · ${totals.items} items · Planned ${totals.planned} · Dispatched ${totals.dispatched} · Balance ${totals.balance}`,
    );
  };

  const importHits = useMemo(() => {
    const q = importQuery.trim().toLowerCase();
    return inventoryItems
      .filter((i) => !q || String(i.name || '').toLowerCase().includes(q))
      .slice(0, 30);
  }, [inventoryItems, importQuery]);

  const projectLabel = project?.project_name || project?.customer_name || 'Select project';

  return (
    <div className={cx(panelClass, 'overflow-hidden print:shadow-none')}>
      {showBack ? (
        <div className="border-b border-[#edf2f8] px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#ef4444]/30 bg-white px-3 text-[12px] font-bold text-[#dc2626]"
            >
              <ChevronLeft className="size-4" />
              Back
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-[#94a3b8]">
                Dashboard &gt; Project Management &gt; Material Planning
              </p>
              <h1 className="text-[20px] font-extrabold text-[#0f172a]">Material Planning</h1>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#edf2f8] px-4 py-4 sm:px-5">
        <div className="relative min-w-[280px] flex-1" ref={projectRef}>
          <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[#94a3b8]">Project</p>
          <button
            type="button"
            onClick={() => setProjectOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 rounded-[10px] border border-[#d9e4f2] bg-white px-3 py-2.5 text-left"
          >
            <div className="min-w-0">
              <p className="truncate text-[14px] font-extrabold text-[#0f172a]">{projectLabel}</p>
              <p className="truncate text-[11px] font-semibold text-[#64748b]">
                {[project?.project_id, project?.capacity_kwp != null ? `Capacity: ${Number(project.capacity_kwp).toFixed(2)} kW` : null, project?.system_type]
                  .filter(Boolean)
                  .join(' | ') || 'Select a won project'}
              </p>
            </div>
            <ChevronDown className="size-4 shrink-0 text-[#94a3b8]" />
          </button>
          {projectOpen ? (
            <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-[10px] border border-[#d9e4f2] bg-white shadow-xl">
              <div className="border-b border-[#edf2f8] p-2">
                <div className="flex items-center gap-2 rounded-[8px] border border-[#e2e8f0] px-2">
                  <Search className="size-3.5 text-[#94a3b8]" />
                  <input
                    autoFocus
                    value={projectQuery}
                    onChange={(e) => setProjectQuery(e.target.value)}
                    placeholder="Search projects…"
                    className="h-9 w-full text-[13px] font-semibold outline-none"
                  />
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto">
                {filteredProjects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setProjectOpen(false);
                      setProjectQuery('');
                      if (String(p.id) !== String(project?.id)) onChangeProject?.(p);
                    }}
                    className={cx(
                      'flex w-full flex-col items-start px-3 py-2 text-left hover:bg-[#f8fafc]',
                      String(p.id) === String(project?.id) && 'bg-[#eff6ff]',
                    )}
                  >
                    <span className="text-[13px] font-bold text-[#0f172a]">{p.project_name || p.customer_name}</span>
                    <span className="text-[11px] font-semibold text-[#64748b]">
                      {p.project_id} · {p.capacity_kwp ?? '—'} kW
                    </span>
                  </button>
                ))}
                {!filteredProjects.length ? (
                  <p className="px-3 py-4 text-center text-[12px] font-semibold text-[#94a3b8]">No projects found</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setProjectOpen(false);
                  onClose?.();
                }}
                className="flex w-full items-center justify-center gap-1 border-t border-[#edf2f8] px-3 py-2.5 text-[12px] font-extrabold text-[#2563eb]"
              >
                Change Project / Move to Another Project ⇄
              </button>
            </div>
          ) : null}
        </div>

        <WorkflowStepper
          onGotoDispatch={() => onOpenSection?.('Project Dispatch')}
        />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#edf2f8] px-4 py-3 sm:px-5">
        <div className="min-w-[220px] flex-1">
          <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[#94a3b8]">Select BOM Template</p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={templateKey}
              onChange={(e) => applyTemplate(e.target.value)}
              className="h-10 min-w-[200px] rounded-[8px] border border-[#d9e4f2] bg-white px-3 text-[13px] font-bold text-[#0f172a]"
            >
              {Object.values(BOM_TEMPLATES).map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
            {['3', '5', '10', 'other'].map((k) => (
              <button
                key={k}
                type="button"
                disabled={saving}
                onClick={() => applyTemplate(k)}
                className={cx(
                  'h-9 rounded-[8px] px-3 text-[12px] font-extrabold',
                  templateKey === k
                    ? 'bg-[#2563eb] text-white'
                    : 'border border-[#d9e4f2] bg-white text-[#314a79]',
                )}
              >
                {k === 'other' ? 'Other' : `${k} kW`}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['C-Channel Length (Ft)', 'c_channel_length'],
            ['C-Channel Size', 'c_channel_size'],
            ['Pole Height (Ft)', 'pole_height'],
            ['Pole Size', 'pole_size'],
          ].map(([label, key]) => (
            <label key={key} className="grid gap-1 text-[10px] font-bold text-[#64748b]">
              {label}
              <input
                value={specs[key]}
                onChange={(e) => setSpecs((p) => ({ ...p, [key]: e.target.value }))}
                className="h-9 rounded-[8px] border border-[#d9e4f2] px-2 text-[12px] font-semibold text-[#0f172a] outline-none"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
        <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-[8px] border border-[#e2e8f0] px-2">
          <Search className="size-3.5 text-[#94a3b8]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item…"
            className="h-9 w-full text-[13px] font-semibold outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={addManualItem} className="inline-flex h-9 items-center gap-1 rounded-[8px] bg-[#2563eb] px-3 text-[12px] font-extrabold text-white">
            <Plus className="size-3.5" /> Add Item
          </button>
          <button type="button" onClick={() => setImportOpen(true)} className="inline-flex h-9 items-center rounded-[8px] border border-[#2563eb] px-3 text-[12px] font-extrabold text-[#2563eb]">
            Import from Inventory
          </button>
          <button type="button" onClick={clearBom} className="inline-flex h-9 items-center rounded-[8px] border border-[#ef4444] px-3 text-[12px] font-extrabold text-[#dc2626]">
            Clear BOM
          </button>
          <button type="button" disabled={saving} onClick={markPlanningDone} className="inline-flex h-9 items-center rounded-[8px] bg-[#16a34a] px-3 text-[12px] font-extrabold text-white">
            Mark Material Planning Done
          </button>
          <button type="button" onClick={() => onOpenSection?.('Project Dispatch')} className="inline-flex h-9 items-center rounded-[8px] bg-[#2563eb] px-3 text-[12px] font-extrabold text-white">
            Next: Dispatch →
          </button>
        </div>
      </div>

      <div className="px-4 pb-3 sm:px-5">
        {loading ? (
          <p className="py-16 text-center text-[13px] font-bold text-[#94a3b8]">Loading material planning…</p>
        ) : (
          <div className="overflow-x-auto rounded-[10px] border border-[#dbe3ee]">
            <table className="min-w-full text-left text-[12px]">
              <thead className="bg-[#f8fafc] text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">
                <tr>
                  <th className="px-3 py-2.5">#</th>
                  <th className="px-3 py-2.5">Material Name</th>
                  <th className="px-3 py-2.5">Specification</th>
                  <th className="px-3 py-2.5">Unit</th>
                  <th className="px-3 py-2.5">Qty (Planned)</th>
                  <th className="px-3 py-2.5">Qty (Dispatched)</th>
                  <th className="px-3 py-2.5">Qty (Balance)</th>
                  <th className="px-3 py-2.5">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleLines.map((line, idx) => {
                  const bal = balanceOf(line);
                  return (
                    <tr key={line._key} className="border-t border-[#edf2f8]">
                      <td className="px-3 py-2 font-bold text-[#64748b]">{idx + 1}</td>
                      <td className="px-3 py-2 font-bold text-[#0f172a]">{line.material_name || '—'}</td>
                      <td className="px-3 py-2 text-[#475569]">{line.specification || '—'}</td>
                      <td className="px-3 py-2 font-semibold">{line.unit}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={line.planned_qty}
                          onChange={(e) => patchLine(line._key, { planned_qty: e.target.value })}
                          onBlur={() => line.id && saveOne({ ...line }, { includeDispatch: false }).then(() => onPlansChanged?.())}
                          className="h-8 w-20 rounded border border-[#e2e8f0] px-2 font-bold outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={line.dispatched_qty}
                          onChange={(e) => patchLine(line._key, { dispatched_qty: e.target.value })}
                          onBlur={(e) => updateDispatched(line, e.target.value)}
                          className="h-8 w-20 rounded border border-[#e2e8f0] px-2 font-bold outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cx(
                            'inline-flex min-w-[2.5rem] justify-center rounded-md px-2 py-1 text-[12px] font-extrabold',
                            bal <= 0 ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#ffedd5] text-[#c2410c]',
                          )}
                        >
                          {bal}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button type="button" onClick={() => setEditLine({ ...line })} className="rounded p-1.5 text-[#2563eb] hover:bg-[#eff6ff]" title="Edit">
                            <Pencil className="size-3.5" />
                          </button>
                          <button type="button" onClick={() => deleteLine(line)} className="rounded p-1.5 text-[#dc2626] hover:bg-[#fef2f2]" title="Delete">
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!visibleLines.length ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-12 text-center text-[13px] font-semibold text-[#94a3b8]">
                      No BOM items — pick a template, add manually, or import from inventory
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#edf2f8] bg-[#f8fafc] px-3 py-2.5 text-[12px] font-bold text-[#475569]">
              <span>Total Items: {totals.items}</span>
              <span className="flex flex-wrap gap-4">
                <span>Total Planned: {totals.planned}</span>
                <span>Dispatched: {totals.dispatched}</span>
                <span>Balance: {totals.balance}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf2f8] px-4 py-3 sm:px-5">
        <div>
          <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[#94a3b8]">Item-wise Dispatch Status</p>
          <div className="flex flex-wrap gap-2">
            {DISPATCH_CATEGORIES.map((cat) => {
              const st = categoryDispatchStatus(lines, cat);
              return (
                <span
                  key={cat}
                  className={cx(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold',
                    st === 'done' && 'bg-[#dcfce7] text-[#15803d]',
                    st === 'partial' && 'bg-[#fef9c3] text-[#a16207]',
                    st === 'pending' && 'bg-[#f1f5f9] text-[#64748b]',
                    st === 'empty' && 'bg-[#f8fafc] text-[#94a3b8]',
                  )}
                >
                  {st === 'done' ? <CheckCircle2 className="size-3" /> : null}
                  {cat}
                  {st === 'done' ? ' ✓' : st === 'partial' ? ' ◐' : st === 'pending' ? ' ○' : ''}
                </span>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={previewSummary} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#d9e4f2] px-3 text-[12px] font-bold text-[#314a79]">
            <Eye className="size-3.5" /> Preview
          </button>
          <button type="button" onClick={printChecklist} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#d9e4f2] px-3 text-[12px] font-bold text-[#314a79]">
            <Printer className="size-3.5" /> Print
          </button>
          <button type="button" disabled={saving} onClick={saveAll} className="inline-flex h-9 items-center rounded-[8px] border border-[#2563eb] px-3 text-[12px] font-extrabold text-[#2563eb]">
            Save Draft
          </button>
          <button type="button" disabled={saving} onClick={saveAll} className="inline-flex h-9 items-center rounded-[8px] bg-[#16a34a] px-3 text-[12px] font-extrabold text-white">
            Save & Update
          </button>
        </div>
      </div>

      {importOpen ? (
        <ModalShell title="Import from Inventory" onClose={() => setImportOpen(false)}>
          <input
            value={importQuery}
            onChange={(e) => setImportQuery(e.target.value)}
            placeholder="Search inventory…"
            className="mb-3 h-10 w-full rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none"
          />
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {importHits.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={saving}
                onClick={() => importInventoryItem(item)}
                className="flex w-full items-center justify-between rounded-[8px] border border-[#edf2f8] px-3 py-2 text-left hover:bg-[#f8fafc]"
              >
                <span>
                  <span className="block text-[13px] font-bold text-[#0f172a]">{item.name}</span>
                  <span className="text-[11px] font-semibold text-[#64748b]">{item.category || '—'} · {item.unit || 'Nos'}</span>
                </span>
                <span className="text-[11px] font-bold text-[#2563eb]">Stock {stockOf(item)}</span>
              </button>
            ))}
            {!importHits.length ? <p className="py-6 text-center text-[12px] font-semibold text-[#94a3b8]">No inventory items</p> : null}
          </div>
        </ModalShell>
      ) : null}

      {editLine ? (
        <ModalShell title={editLine.id ? 'Edit BOM Item' : 'Add BOM Item'} onClose={() => setEditLine(null)}>
          <div className="grid gap-3">
            <label className="grid gap-1 text-[11px] font-bold text-[#64748b]">
              Material Name
              <input
                value={editLine.material_name}
                onChange={(e) => setEditLine((p) => ({ ...p, material_name: e.target.value }))}
                className="h-10 rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none"
              />
            </label>
            <label className="grid gap-1 text-[11px] font-bold text-[#64748b]">
              Specification
              <input
                value={editLine.specification}
                onChange={(e) => setEditLine((p) => ({ ...p, specification: e.target.value }))}
                className="h-10 rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-[11px] font-bold text-[#64748b]">
                Category
                <select
                  value={editLine.category}
                  onChange={(e) => setEditLine((p) => ({ ...p, category: e.target.value }))}
                  className="h-10 rounded-[8px] border border-[#d9e4f2] px-2 text-[13px] font-semibold"
                >
                  {[...DISPATCH_CATEGORIES, 'Other', 'Cable & Wire', 'Solar Panel', 'Hardware'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-[11px] font-bold text-[#64748b]">
                Unit
                <input
                  value={editLine.unit}
                  onChange={(e) => setEditLine((p) => ({ ...p, unit: e.target.value }))}
                  className="h-10 rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-[11px] font-bold text-[#64748b]">
                Qty Planned
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={editLine.planned_qty}
                  onChange={(e) => setEditLine((p) => ({ ...p, planned_qty: e.target.value }))}
                  className="h-10 rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none"
                />
              </label>
              <label className="grid gap-1 text-[11px] font-bold text-[#64748b]">
                Qty Dispatched
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={editLine.dispatched_qty}
                  onChange={(e) => setEditLine((p) => ({ ...p, dispatched_qty: e.target.value }))}
                  className="h-10 rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none"
                />
              </label>
            </div>
            <label className="grid gap-1 text-[11px] font-bold text-[#64748b]">
              Link Inventory Item (optional)
              <select
                value={editLine.inventory_item || ''}
                onChange={(e) => {
                  const id = e.target.value;
                  const inv = inventoryItems.find((i) => String(i.id) === String(id));
                  setEditLine((p) => ({
                    ...p,
                    inventory_item: id,
                    material_name: inv ? String(inv.name).slice(0, 50) : p.material_name,
                    unit: inv?.unit || p.unit,
                    category: inv?.category || p.category,
                  }));
                }}
                className="h-10 rounded-[8px] border border-[#d9e4f2] px-2 text-[13px] font-semibold"
              >
                <option value="">— Manual entry (no inventory link) —</option>
                {inventoryItems.map((i) => (
                  <option key={i.id} value={i.id}>{i.name} (stock {stockOf(i)})</option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditLine(null)} className="h-9 rounded-[8px] border border-[#d9e4f2] px-3 text-[12px] font-bold">Cancel</button>
              <button type="button" disabled={saving} onClick={persistEdit} className="h-9 rounded-[8px] bg-[#2563eb] px-3 text-[12px] font-extrabold text-white">
                Save Item
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}

function WorkflowStepper({ onGotoDispatch }) {
  const steps = [
    { key: 'survey', label: 'Site Survey', state: 'done' },
    { key: 'mp', label: 'Material Planning', state: 'active' },
    { key: 'dispatch', label: 'Dispatch', state: 'pending' },
    { key: 'install', label: 'Installation', state: 'pending' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      {steps.map((s, i) => (
        <button
          key={s.key}
          type="button"
          onClick={() => {
            if (s.key === 'dispatch') onGotoDispatch?.();
          }}
          className="flex items-center gap-2"
        >
          <span
            className={cx(
              'flex size-7 items-center justify-center rounded-full text-[11px] font-extrabold',
              s.state === 'done' && 'bg-[#16a34a] text-white',
              s.state === 'active' && 'bg-[#2563eb] text-white',
              s.state === 'pending' && 'bg-[#e2e8f0] text-[#64748b]',
            )}
          >
            {s.state === 'done' ? '✓' : i + 1}
          </span>
          <span
            className={cx(
              'text-[11px] font-bold',
              s.state === 'active' ? 'text-[#2563eb]' : 'text-[#64748b]',
            )}
          >
            {s.label}
          </span>
          {i < steps.length - 1 ? <span className="hidden text-[#cbd5e1] sm:inline">—</span> : null}
        </button>
      ))}
    </div>
  );
}

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[14px] bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[15px] font-extrabold text-[#0f172a]">{title}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-[#f1f5f9]">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default MaterialPlanningBomPage;
