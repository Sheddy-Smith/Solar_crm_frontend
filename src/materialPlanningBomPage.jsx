import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  Package,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { inventoryApi, materialPlanApi } from './api.js';
import { rowsOf } from './lib/listQuery.js';
import {
  BOM_TEMPLATES,
  DISPATCH_CATEGORIES,
  suggestTemplateKey,
} from './bomMaterialTemplates.js';
import {
  ProjectWorkflowShell,
  projectSummaryMeta,
} from './components/ProjectWorkflowShell.jsx';

const INV_UNITS = ['Nos', 'pcs', 'Meter', 'Kg', 'Ltr', 'Roll', 'Set', 'Unit', 'Packet', 'Bundels', 'kW'];
const INV_CATEGORY_OPTIONS = [
  ...DISPATCH_CATEGORIES,
  'Structure & Mounting',
  'Solar Panel',
  'Cable & Wire',
  'Hardware',
  'Electrical',
  'Other',
];

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

function invSpecification(item) {
  if (!item) return '';
  if (item.specification) return String(item.specification);
  return [item.capacity, item.product_type, item.location].filter(Boolean).join(' / ');
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

function buildInventoryNameIndex(items) {
  const exact = new Map();
  for (const item of items || []) {
    const key = norm(item?.name);
    if (key && !exact.has(key)) exact.set(key, item);
  }
  return exact;
}

function matchInventoryIndexed(index, items, name) {
  const target = norm(name);
  if (!target) return null;
  const exact = index.get(target);
  if (exact) return exact;
  return matchInventory(items, name);
}

function resolveLineInventory(line, items) {
  if (!line) return null;
  if (line.inventory_item) {
    const byId = items.find((i) => String(i.id) === String(line.inventory_item));
    if (byId) return byId;
  }
  return matchInventory(items, line.material_name);
}

function inventorySearchToken(name) {
  return String(name || '')
    .replace(/[^\w\s./x×-]/gi, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(' ');
}

/** Run async work over a list with bounded concurrency (faster than serial awaits). */
async function mapPool(items, concurrency, worker) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return [];
  const results = new Array(list.length);
  let cursor = 0;
  const run = async () => {
    while (cursor < list.length) {
      const idx = cursor;
      cursor += 1;
      results[idx] = await worker(list[idx], idx);
    }
  };
  const n = Math.min(Math.max(1, concurrency), list.length);
  await Promise.all(Array.from({ length: n }, () => run()));
  return results;
}

function filterInventoryItems(items, query) {
  const q = norm(query);
  if (!q) return items.slice(0, 12);
  return items
    .filter((item) => {
      const hay = norm([
        item.name,
        invSpecification(item),
        item.item_code,
        item.category,
        item.hsn_code,
        item.unit,
      ].join(' '));
      return hay.includes(q);
    })
    .slice(0, 12);
}

function linePatchFromInventory(item) {
  return {
    category: item.category || 'Other',
    material_name: String(item.name || '').slice(0, 50),
    specification: invSpecification(item),
    unit: item.unit || 'Nos',
    inventory_item: item.id,
  };
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
  const [importOpen, setImportOpen] = useState(false);
  const [importQuery, setImportQuery] = useState('');
  const [editLine, setEditLine] = useState(null);
  const [addInvOpen, setAddInvOpen] = useState(false);
  const [addInvSeed, setAddInvSeed] = useState({ name: '', specification: '' });
  const [addInvTarget, setAddInvTarget] = useState('toolbar'); // 'toolbar' | 'edit'
  const [syncNote, setSyncNote] = useState('');
  const templateApplySeq = useRef(0);
  const templateBusyRef = useRef(false);
  const loadSeq = useRef(0);
  const inventoryLoadedRef = useRef(false);

  const mergeInventoryItems = useCallback((extra) => {
    if (!extra?.length) return;
    setInventoryItems((prev) => {
      const map = new Map(prev.map((i) => [String(i.id), i]));
      for (const item of extra) {
        if (item?.id != null) map.set(String(item.id), item);
      }
      return [...map.values()];
    });
  }, []);

  const loadInventoryLite = useCallback(async () => {
    if (inventoryLoadedRef.current) return;
    inventoryLoadedRef.current = true;
    try {
      // One page only — full inventory crawl was freezing Material Planning.
      const data = await inventoryApi.items.list({ page: 1, page_size: 100, is_active: true });
      setInventoryItems(rowsOf(data).filter((item) => item?.is_active !== false));
    } catch {
      inventoryLoadedRef.current = false;
    }
  }, []);

  /** Pull matching inventory rows for template names (search API, bounded). */
  const hydrateInventoryForNames = useCallback(async (names, currentItems) => {
    const index = buildInventoryNameIndex(currentItems);
    const missing = [...new Set((names || []).map((n) => String(n || '').trim()).filter(Boolean))]
      .filter((name) => !matchInventoryIndexed(index, currentItems, name));
    if (!missing.length) return currentItems;

    const found = [];
    await mapPool(missing, 4, async (name) => {
      const q = inventorySearchToken(name);
      if (!q) return;
      try {
        const data = await inventoryApi.items.list({ search: q, page: 1, page_size: 25, is_active: true });
        found.push(...rowsOf(data).filter((item) => item?.is_active !== false));
      } catch {
        /* ignore per-name miss */
      }
    });
    if (!found.length) return currentItems;
    mergeInventoryItems(found);
    const map = new Map((currentItems || []).map((i) => [String(i.id), i]));
    for (const item of found) map.set(String(item.id), item);
    return [...map.values()];
  }, [mergeInventoryItems]);

  const linkLinesToInventory = useCallback((rows, items) => {
    const index = buildInventoryNameIndex(items);
    return (rows || []).map((line) => {
      if (line.inventory_item) return line;
      const inv = matchInventoryIndexed(index, items, line.material_name);
      return inv ? { ...line, inventory_item: inv.id, unit: line.unit || inv.unit || line.unit } : line;
    });
  }, []);

  const load = useCallback(async () => {
    if (!project?.id) {
      setLines([]);
      setLoading(false);
      return;
    }
    const seq = ++loadSeq.current;
    setLoading(true);
    try {
      const planData = await materialPlanApi.list({ project: project.id, page_size: 200 });
      if (seq !== loadSeq.current) return;
      // Template apply owns the table while syncing — don't clobber instant UI.
      if (templateBusyRef.current) return;
      setLines(rowsOf(planData).map((p) => lineFromPlan(p, [])));
      setTemplateKey(suggestTemplateKey(project?.capacity_kwp));
    } catch (e) {
      if (seq === loadSeq.current && !templateBusyRef.current) {
        onNotify?.(e.message || 'Failed to load material planning', 'error');
      }
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
    loadInventoryLite();
  }, [project?.id, project?.capacity_kwp, onNotify, loadInventoryLite]);

  useEffect(() => {
    inventoryLoadedRef.current = false;
    templateBusyRef.current = false;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  // Toolbar search drives inventory autocomplete (add), not row filtering.
  const visibleLines = lines;

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
    if (key === 'other') {
      setTemplateKey(key);
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

    const seq = ++templateApplySeq.current;
    templateBusyRef.current = true;
    setLoading(false);
    setTemplateKey(key);

    const keepByName = new Map();
    lines.forEach((l) => {
      if (l.id && parseDispatched(l.dispatched_qty) > 0) {
        keepByName.set(norm(l.material_name), l);
      }
    });

    const toDelete = replace
      ? lines
        .filter((l) => l.id && !keepByName.has(norm(l.material_name)))
        .map((l) => l.id)
      : [];

    const invIndex = buildInventoryNameIndex(inventoryItems);
    let next = [];

    for (const row of tpl.lines) {
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

      const inv = matchInventoryIndexed(invIndex, inventoryItems, row.material_name);
      const draft = makeLine({
        category: row.category,
        material_name: String(row.material_name || '').slice(0, 50),
        specification: row.specification || '',
        unit: row.unit,
        planned_qty: String(row.qty ?? 0),
        inventory_item: inv?.id || '',
      });
      next.push(draft);
    }

    for (const leftover of keepByName.values()) next.push(leftover);

    // Instant paint from in-memory 3/5/10 kW templates (no API wait).
    setLines(next);
    onNotify?.(`${tpl.label} loaded`);
    setSyncNote('Matching inventory stock…');
    setSaving(true);

    try {
      // Resolve inventory stock for template names, then show Stock column quantities.
      const hydrated = await hydrateInventoryForNames(
        next.map((l) => l.material_name),
        inventoryItems,
      );
      if (seq !== templateApplySeq.current) return;
      next = linkLinesToInventory(next, hydrated);
      setLines(next);
      setSyncNote('Syncing BOM to server…');

      // Light concurrency so API/list stays responsive.
      await mapPool(toDelete, 4, (id) => materialPlanApi.delete(id).catch(() => null));
      if (seq !== templateApplySeq.current) return;

      const createPayloads = next.filter((l) => num(l.planned_qty) > 0 && !l.id);
      const savedRows = await mapPool(createPayloads, 4, async (draft) => {
        const saved = await saveOne(draft);
        return saved
          ? { key: draft._key, line: lineFromPlan({ ...saved, inventory_item: draft.inventory_item }, hydrated) }
          : { key: draft._key, line: draft };
      });
      if (seq !== templateApplySeq.current) return;

      const byKey = new Map(savedRows.map((r) => [r.key, r.line]));
      setLines((prev) => prev.map((line) => byKey.get(line._key) || line));
      onPlansChanged?.();
      setSyncNote('');
    } catch (e) {
      if (seq === templateApplySeq.current) {
        setSyncNote('');
        onNotify?.(e.message || 'Template save failed — rows are on screen; use Save & Update', 'error');
      }
    } finally {
      if (seq === templateApplySeq.current) {
        templateBusyRef.current = false;
        setSaving(false);
      }
    }
  };

  const addManualItem = () => {
    const draft = makeLine({ category: 'Other', material_name: '', planned_qty: '1' });
    setLines((prev) => [...prev, draft]);
    setEditLine(draft);
  };

  const startInlineEdit = (line) => {
    setEditLine({ ...line });
  };

  const cancelInlineEdit = () => {
    if (!editLine) return;
    const blankDraft = !editLine.id && !String(editLine.material_name || '').trim();
    if (blankDraft) {
      setLines((prev) => prev.filter((l) => l._key !== editLine._key));
    }
    setEditLine(null);
  };

  const openAddInventory = (seed = {}, target = 'toolbar') => {
    setAddInvSeed({
      name: seed.name || seed.material_name || '',
      specification: seed.specification || '',
    });
    setAddInvTarget(target);
    setAddInvOpen(true);
  };

  const applyInventoryToEditLine = (item) => {
    if (!item || !editLine) return;
    setEditLine((p) => ({
      ...p,
      ...linePatchFromInventory(item),
      planned_qty: p.planned_qty || '1',
    }));
  };

  const importInventoryItem = async (item, { closeImport = true } = {}) => {
    if (!item) return;
    const draft = makeLine({
      ...linePatchFromInventory(item),
      planned_qty: '1',
    });
    setSaving(true);
    try {
      const saved = await saveOne(draft);
      if (!saved) return;
      const nextItems = inventoryItems.some((i) => String(i.id) === String(item.id))
        ? inventoryItems
        : [...inventoryItems, item];
      setInventoryItems(nextItems);
      setLines((prev) => [...prev, lineFromPlan({ ...saved, inventory_item: item.id }, nextItems)]);
      onNotify?.(`Added ${item.name} (stock ${stockOf(item)})`);
      onPlansChanged?.();
      if (closeImport) {
        setImportOpen(false);
        setImportQuery('');
      }
      setSearch('');
    } finally {
      setSaving(false);
    }
  };

  const handleInventoryCreated = async (item) => {
    setInventoryItems((prev) => {
      if (prev.some((i) => String(i.id) === String(item.id))) return prev;
      return [...prev, item];
    });
    setAddInvOpen(false);
    if (addInvTarget === 'edit' && editLine) {
      applyInventoryToEditLine(item);
      onNotify?.(`${item.name} saved to inventory and selected`);
      return;
    }
    await importInventoryItem(item, { closeImport: false });
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

  const projectTitle = project?.project_name || project?.customer_name || 'Select project';
  const projectMeta = projectSummaryMeta(project);

  const toggleSelectAll = (checked) => {
    setLines((prev) => prev.map((l) => ({ ...l, selected: checked })));
  };
  const allSelected = visibleLines.length > 0 && visibleLines.every((l) => l.selected);

  return (
    <ProjectWorkflowShell
      className={panelClass}
      activeSection="Project Material Planning"
      stageLabel="Material Planning"
      project={project}
      projects={projects}
      showBack={showBack || Boolean(onClose)}
      onBack={onClose}
      onOpenSection={onOpenSection}
      onChangeProject={onChangeProject}
      onMarkDone={markPlanningDone}
      markDoneDisabled={saving}
    >
      {/* Project summary + Template + Specs */}
      <div className="border-b border-[#e8eef6] px-4 py-4 sm:px-5">
        <div className="mb-4">
          <h2 className="text-[20px] font-extrabold tracking-tight text-[#0f172a]">{projectTitle}</h2>
          <p className="mt-0.5 text-[13px] font-semibold text-[#64748b]">
            {projectMeta || 'Select a won project'}
          </p>
        </div>
        <div className="min-w-[240px] max-w-md">
          <p className="mb-1.5 text-[12px] font-bold text-[#334155]">Select BOM Template</p>
          <select
            value={templateKey}
            onChange={(e) => applyTemplate(e.target.value)}
            className="h-10 w-full min-w-[200px] rounded-[9px] border border-[#d5e0ef] bg-white px-3 text-[13px] font-bold text-[#0f172a]"
          >
            {Object.values(BOM_TEMPLATES).map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. Table toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
        <div className="min-w-[240px] flex-1">
          <InventorySuggestField
            value={search}
            onChange={setSearch}
            items={inventoryItems}
            placeholder="Search material by name, specification…"
            onPick={(item) => importInventoryItem(item)}
            onAddMissing={(q) => openAddInventory({ name: q }, 'toolbar')}
            disabled={saving}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={addManualItem} className="inline-flex h-10 items-center gap-1.5 rounded-[9px] bg-[#2563eb] px-3.5 text-[13px] font-extrabold text-white shadow-sm">
            <Plus className="size-4" /> Add Item
          </button>
          <button type="button" onClick={() => setImportOpen(true)} className="inline-flex h-10 items-center rounded-[9px] border border-[#2563eb] bg-white px-3.5 text-[13px] font-extrabold text-[#2563eb]">
            Import from Inventory
          </button>
          <button type="button" onClick={clearBom} className="inline-flex h-10 items-center rounded-[9px] border border-[#f1a8a8] bg-white px-3.5 text-[13px] font-extrabold text-[#e11d48]">
            Clear BOM
          </button>
        </div>
      </div>

      {/* 5. BOM table */}
      <div className="px-4 pb-3 sm:px-5">
        {syncNote ? (
          <p className="mb-2 text-[12px] font-semibold text-[#2563eb]">{syncNote}</p>
        ) : null}
        {loading && lines.length === 0 ? (
          <p className="py-16 text-center text-[13px] font-bold text-[#94a3b8]">Loading material planning…</p>
        ) : (
          <div className="overflow-x-auto rounded-[12px] border border-[#dbe3ee] shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <table className="min-w-full text-left text-[13px]">
              <thead className="bg-[#f8fafc] text-[11px] font-extrabold uppercase tracking-[0.03em] text-[#64748b]">
                <tr>
                  <th className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                      className="size-4 rounded border-[#cbd5e1] accent-[#2563eb]"
                    />
                  </th>
                  <th className="px-2 py-3">#</th>
                  <th className="px-3 py-3">Material Name</th>
                  <th className="px-3 py-3">Specification</th>
                  <th className="px-3 py-3">Unit</th>
                  <th className="px-3 py-3">Stock (Inventory)</th>
                  <th className="px-3 py-3">Qty (Planned)</th>
                  <th className="px-3 py-3">Qty (Dispatched)</th>
                  <th className="px-3 py-3">Qty (Balance)</th>
                  <th className="px-3 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleLines.map((line, idx) => {
                  const isEditing = Boolean(editLine && editLine._key === line._key);
                  const row = isEditing ? editLine : line;
                  const bal = balanceOf(row);
                  const inv = resolveLineInventory(row, inventoryItems);
                  const stockQty = stockOf(inv);
                  const cellInput = 'h-9 w-full min-w-[72px] rounded-[8px] border border-[#93c5fd] bg-white px-2 text-[13px] font-semibold text-[#0f172a] outline-none focus:border-[#2563eb]';
                  const rowClass = isEditing
                    ? 'border-t border-[#edf2f8] bg-[#eff6ff]'
                    : 'border-t border-[#edf2f8] hover:bg-[#fbfdff]';
                  return (
                    <tr
                      key={line._key}
                      className={rowClass}
                    >
                      <td className="px-3 py-2.5 align-top">
                        <input
                          type="checkbox"
                          checked={Boolean(line.selected)}
                          onChange={(e) => patchLine(line._key, { selected: e.target.checked })}
                          className="size-4 rounded border-[#cbd5e1] accent-[#2563eb]"
                          disabled={isEditing}
                        />
                      </td>
                      <td className="px-2 py-2.5 align-top font-bold text-[#64748b]">{idx + 1}</td>
                      {isEditing ? (
                        <>
                          <td className="relative z-20 min-w-[200px] px-2 py-2 align-top">
                            <InventorySuggestField
                              value={row.material_name}
                              onChange={(v) => setEditLine((p) => ({ ...p, material_name: v, inventory_item: '' }))}
                              items={inventoryItems}
                              placeholder="Material name…"
                              onPick={applyInventoryToEditLine}
                              onAddMissing={(q) => openAddInventory({ name: q, specification: row.specification }, 'edit')}
                              disabled={saving}
                              compact
                            />
                          </td>
                          <td className="min-w-[140px] px-2 py-2 align-top">
                            <input
                              value={row.specification}
                              onChange={(e) => setEditLine((p) => ({ ...p, specification: e.target.value }))}
                              placeholder="Specification"
                              className={cellInput}
                            />
                          </td>
                          <td className="px-2 py-2 align-top">
                            <select
                              value={row.unit}
                              onChange={(e) => setEditLine((p) => ({ ...p, unit: e.target.value }))}
                              className={cellInput}
                            >
                              {INV_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-2 align-top">
                            {inv ? (
                              <span className={cx('inline-flex min-w-[2.75rem] justify-center rounded-[8px] px-2.5 py-1.5 text-[12px] font-extrabold', stockQty > 0 ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fee2e2] text-[#b91c1c]')}>
                                {stockQty}
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold text-[#94a3b8]">Not in inventory</span>
                            )}
                          </td>
                          <td className="px-2 py-2 align-top">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={row.planned_qty}
                              onChange={(e) => setEditLine((p) => ({ ...p, planned_qty: e.target.value }))}
                              className={`${cellInput} text-center`}
                            />
                          </td>
                          <td className="px-2 py-2 align-top">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={row.dispatched_qty}
                              onChange={(e) => setEditLine((p) => ({ ...p, dispatched_qty: e.target.value }))}
                              className={`${cellInput} text-center`}
                            />
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2.5 font-bold text-[#0f172a]">
                            {line.material_name || '—'}
                            {inv ? (
                              <span className="mt-0.5 block text-[10px] font-semibold text-[#64748b]">
                                INV: {inv.item_code || inv.record_no || `#${inv.id}`}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 text-[#475569]">{line.specification || '—'}</td>
                          <td className="px-3 py-2.5 font-semibold text-[#334155]">{line.unit}</td>
                          <td className="px-3 py-2.5">
                            {inv ? (
                              <span className={cx('inline-flex min-w-[2.75rem] justify-center rounded-[8px] px-2.5 py-1.5 text-[12px] font-extrabold', stockQty > 0 ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fee2e2] text-[#b91c1c]')}>
                                {stockQty}
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold text-[#94a3b8]">Not in inventory</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={line.planned_qty}
                              onChange={(e) => patchLine(line._key, { planned_qty: e.target.value })}
                              onBlur={() => line.id && saveOne({ ...line }, { includeDispatch: false }).then(() => onPlansChanged?.())}
                              className="h-9 w-[72px] rounded-[8px] border border-[#e2e8f0] bg-white px-2 text-center font-bold outline-none focus:border-[#2563eb]"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={line.dispatched_qty}
                              onChange={(e) => patchLine(line._key, { dispatched_qty: e.target.value })}
                              onBlur={(e) => updateDispatched(line, e.target.value)}
                              className="h-9 w-[72px] rounded-[8px] border border-[#e2e8f0] bg-white px-2 text-center font-bold outline-none focus:border-[#2563eb]"
                            />
                          </td>
                        </>
                      )}
                      <td className="px-3 py-2.5 align-top">
                        <span
                          className={cx(
                            'inline-flex min-w-[2.75rem] justify-center rounded-[8px] px-2.5 py-1.5 text-[13px] font-extrabold',
                            bal <= 0
                              ? 'bg-[#dcfce7] text-[#15803d]'
                              : 'bg-[#ffedd5] text-[#c2410c]',
                          )}
                        >
                          {bal}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        {isEditing ? (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={persistEdit}
                              className="rounded-[8px] p-1.5 text-[#16a34a] hover:bg-[#dcfce7] disabled:opacity-50"
                              title="Save"
                            >
                              <Check className="size-4" />
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={cancelInlineEdit}
                              className="rounded-[8px] p-1.5 text-[#64748b] hover:bg-[#f1f5f9] disabled:opacity-50"
                              title="Cancel"
                            >
                              <X className="size-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => startInlineEdit(line)}
                              className="rounded-[8px] p-1.5 text-[#2563eb] hover:bg-[#eff6ff]"
                              title="Edit"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button type="button" onClick={() => deleteLine(line)} className="rounded-[8px] p-1.5 text-[#e11d48] hover:bg-[#fef2f2]" title="Delete">
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!visibleLines.length ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-14 text-center text-[13px] font-semibold text-[#94a3b8]">
                      No BOM items — pick a template, add manually, or import from inventory
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#edf2f8] bg-[#f8fafc] px-4 py-3 text-[13px] font-bold text-[#475569]">
              <span>Total Items: <span className="text-[#0f172a]">{totals.items}</span></span>
              <span className="flex flex-wrap gap-5">
                <span>Total Planned: <span className="text-[#0f172a]">{totals.planned}</span></span>
                <span>Dispatched: <span className="text-[#16a34a]">{totals.dispatched}</span></span>
                <span>Balance: <span className="text-[#ea580c]">{totals.balance}</span></span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 6. Dispatch status + footer actions */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-[#e8eef6] px-4 py-4 sm:px-5">
        <div className="min-w-[240px] flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <p className="text-[12px] font-extrabold uppercase tracking-[0.04em] text-[#94a3b8]">Item-wise Dispatch Status</p>
            <div className="flex flex-wrap gap-3 text-[11px] font-bold text-[#64748b]">
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#16a34a]" /> Dispatched</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#f59e0b]" /> Partially Dispatched</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#94a3b8]" /> Not Dispatched</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {DISPATCH_CATEGORIES.map((cat) => {
              const st = categoryDispatchStatus(lines, cat);
              return (
                <span
                  key={cat}
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold',
                    st === 'done' && 'border-[#bbf7d0] bg-[#dcfce7] text-[#15803d]',
                    st === 'partial' && 'border-[#fde68a] bg-[#fffbeb] text-[#b45309]',
                    (st === 'pending' || st === 'empty') && 'border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]',
                  )}
                >
                  {st === 'done' ? <CheckCircle2 className="size-3.5" /> : null}
                  {st === 'partial' ? <Clock3 className="size-3.5" /> : null}
                  {(st === 'pending' || st === 'empty') ? <Check className="size-3.5 opacity-40" /> : null}
                  {cat}
                </span>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={previewSummary} className="inline-flex h-10 items-center gap-1.5 rounded-[9px] border border-[#d5e0ef] bg-white px-3.5 text-[13px] font-bold text-[#334155]">
            <Eye className="size-4" /> Preview
          </button>
          <button type="button" onClick={printChecklist} className="inline-flex h-10 items-center gap-1.5 rounded-[9px] border border-[#d5e0ef] bg-white px-3.5 text-[13px] font-bold text-[#334155]">
            <Printer className="size-4" /> Print
          </button>
          <button type="button" disabled={saving} onClick={saveAll} className="inline-flex h-10 items-center rounded-[9px] border border-[#2563eb] bg-white px-3.5 text-[13px] font-extrabold text-[#2563eb] disabled:opacity-60">
            Save Draft
          </button>
          <button type="button" disabled={saving} onClick={saveAll} className="inline-flex h-10 items-center rounded-[9px] bg-[#16a34a] px-4 text-[13px] font-extrabold text-white shadow-sm hover:bg-[#15803d] disabled:opacity-60">
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
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold text-[#0f172a]">{item.name}</span>
                  <span className="block text-[11px] font-semibold text-[#64748b]">
                    {invSpecification(item) || '—'} · {item.unit || 'Nos'} · {item.item_code || item.record_no || `INV-${item.id}`}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] font-bold text-[#2563eb]">Stock {stockOf(item)}</span>
              </button>
            ))}
            {!importHits.length ? (
              <div className="space-y-2 py-4 text-center">
                <p className="text-[12px] font-semibold text-[#94a3b8]">No inventory items</p>
                <button
                  type="button"
                  onClick={() => openAddInventory({ name: importQuery }, 'toolbar')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#2563eb] px-3 text-[12px] font-extrabold text-white"
                >
                  <Plus className="size-3.5" /> Add to Inventory
                </button>
              </div>
            ) : null}
          </div>
        </ModalShell>
      ) : null}

      {addInvOpen ? (
        <AddInventoryModal
          seed={addInvSeed}
          existingItems={inventoryItems}
          onClose={() => setAddInvOpen(false)}
          onNotify={onNotify}
          onCreated={handleInventoryCreated}
        />
      ) : null}
    </ProjectWorkflowShell>
  );
}

function ModalShell({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={cx('max-h-[90vh] w-full overflow-y-auto rounded-[14px] bg-white p-4 shadow-2xl', wide ? 'max-w-xl' : 'max-w-lg')}>
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

function InventorySuggestField({
  value,
  onChange,
  items = [],
  placeholder,
  onPick,
  onAddMissing,
  disabled = false,
  compact = false,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const hits = useMemo(() => filterInventoryItems(items, value), [items, value]);
  const q = String(value || '').trim();
  const exact = hits.some((i) => norm(i.name) === norm(q));

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <div
        className={cx(
          'flex items-center gap-2 rounded-[8px] border bg-white focus-within:border-[#2563eb]',
          compact ? 'h-9 border-[#93c5fd] px-2' : 'h-10 border-[#d5e0ef] px-3 rounded-[9px]',
        )}
      >
        {compact ? null : <Search className="size-4 shrink-0 text-[#94a3b8]" />}
        <input
          value={value}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          placeholder={placeholder}
          className="w-full text-[13px] font-semibold outline-none placeholder:text-[#94a3b8] disabled:opacity-60"
        />
      </div>
      {open && q ? (
        <div className={cx('absolute z-50 mt-1 overflow-hidden rounded-[12px] border border-[#d5e0ef] bg-white shadow-xl', compact ? 'w-[min(420px,70vw)]' : 'w-full')}>
          <div className="max-h-64 overflow-y-auto">
            {hits.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick?.(item);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-2 border-b border-[#f1f5f9] px-3 py-2.5 text-left last:border-0 hover:bg-[#f8fafc]"
              >
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-[8px] bg-[#eff6ff] text-[#2563eb]">
                  <Package className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-extrabold text-[#0f172a]">
                    {item.name}
                    {invSpecification(item) ? ` · ${invSpecification(item)}` : ''}
                  </span>
                  <span className="block text-[11px] font-semibold text-[#64748b]">
                    {item.item_code || item.record_no || `INV-${item.id}`}
                    {' · Unit: '}
                    {item.unit || 'Nos'}
                    {' · Stock: '}
                    {stockOf(item)}
                  </span>
                </span>
              </button>
            ))}
            {!hits.length ? (
              <p className="px-3 py-3 text-center text-[12px] font-semibold text-[#94a3b8]">No matching inventory item</p>
            ) : null}
          </div>
          {!exact ? (
            <button
              type="button"
              disabled={disabled}
              onMouseDown={(e) => {
                e.preventDefault();
                setOpen(false);
                onAddMissing?.(q);
              }}
              className="flex w-full items-center gap-2 border-t border-[#dbeafe] bg-[#eff6ff] px-3 py-2.5 text-left text-[13px] font-extrabold text-[#2563eb] hover:bg-[#dbeafe]"
            >
              <Plus className="size-4" />
              {`Add "${q}" to Inventory`}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AddInventoryModal({ seed, existingItems = [], onClose, onNotify, onCreated }) {
  const [form, setForm] = useState({
    name: seed?.name || '',
    specification: seed?.specification || '',
    category: 'Structure & Mounting',
    unit: 'Nos',
    initial_stock: '0',
    hsn_code: '',
    warehouse: '',
  });
  const [warehouses, setWarehouses] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    inventoryApi.warehouses.list({ page_size: 100, is_active: true })
      .then((r) => {
        const rows = rowsOf(r).filter((w) => w.is_active !== false);
        setWarehouses(rows);
        if (rows[0]?.id) setForm((p) => (p.warehouse ? p : { ...p, warehouse: rows[0].id }));
      })
      .catch(() => setWarehouses([]));
  }, []);

  useEffect(() => {
    setForm((p) => ({
      ...p,
      name: seed?.name || p.name,
      specification: seed?.specification || p.specification,
    }));
  }, [seed?.name, seed?.specification]);

  const save = async () => {
    const name = String(form.name || '').trim();
    if (!name) {
      onNotify?.('Material name is required', 'error');
      return;
    }
    const spec = String(form.specification || '').trim();
    const dup = existingItems.find(
      (i) => norm(i.name) === norm(name) && norm(invSpecification(i)) === norm(spec),
    );
    if (dup) {
      onNotify?.('Item already exists in inventory — selecting it instead', 'error');
      onCreated?.(dup);
      return;
    }
    const opening = num(form.initial_stock);
    if (opening > 0 && !form.warehouse) {
      onNotify?.('Select a warehouse for opening stock', 'error');
      return;
    }
    setBusy(true);
    try {
      const body = {
        name: name.slice(0, 200),
        specification: spec.slice(0, 200),
        category: form.category || 'Other',
        unit: form.unit || 'Nos',
        hsn_code: String(form.hsn_code || '').trim(),
        is_active: true,
      };
      if (form.warehouse) body.warehouse = form.warehouse;
      if (opening > 0) body.initial_stock = opening;
      const created = await inventoryApi.items.create(body);
      onNotify?.(`${created.name || name} added to inventory`, 'success');
      onCreated?.(created);
    } catch (e) {
      onNotify?.(e.message || 'Could not create inventory item', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Add Item to Inventory" onClose={onClose} wide>
      <div className="grid gap-3">
        <label className="grid gap-1 text-[11px] font-bold text-[#64748b]">
          Material Name *
          <input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className="h-10 rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none focus:border-[#16a34a]"
          />
        </label>
        <label className="grid gap-1 text-[11px] font-bold text-[#64748b]">
          Specification
          <input
            value={form.specification}
            onChange={(e) => setForm((p) => ({ ...p, specification: e.target.value }))}
            placeholder="e.g., 3900mm / GI / 2mm"
            className="h-10 rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none focus:border-[#16a34a]"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-[11px] font-bold text-[#64748b]">
            Category *
            <select
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              className="h-10 rounded-[8px] border border-[#d9e4f2] px-2 text-[13px] font-semibold"
            >
              {[...new Set(INV_CATEGORY_OPTIONS)].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[11px] font-bold text-[#64748b]">
            Unit *
            <select
              value={form.unit}
              onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
              className="h-10 rounded-[8px] border border-[#d9e4f2] px-2 text-[13px] font-semibold"
            >
              {INV_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-[11px] font-bold text-[#64748b]">
            Opening Stock
            <input
              type="number"
              min="0"
              step="any"
              value={form.initial_stock}
              onChange={(e) => setForm((p) => ({ ...p, initial_stock: e.target.value }))}
              className="h-10 rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none"
            />
          </label>
          <label className="grid gap-1 text-[11px] font-bold text-[#64748b]">
            HSN (GST)
            <input
              value={form.hsn_code}
              onChange={(e) => setForm((p) => ({ ...p, hsn_code: e.target.value }))}
              placeholder="730890"
              className="h-10 rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold outline-none"
            />
          </label>
        </div>
        {num(form.initial_stock) > 0 ? (
          <label className="grid gap-1 text-[11px] font-bold text-[#64748b]">
            Warehouse *
            <select
              value={form.warehouse || ''}
              onChange={(e) => setForm((p) => ({ ...p, warehouse: e.target.value }))}
              className="h-10 rounded-[8px] border border-[#d9e4f2] px-2 text-[13px] font-semibold"
            >
              <option value="">Select warehouse…</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="h-9 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-bold text-[#53647f]">Cancel</button>
          <button type="button" disabled={busy} onClick={save} className="h-9 rounded-[8px] bg-[#16a34a] px-4 text-[13px] font-extrabold text-white disabled:opacity-60">
            {busy ? 'Saving…' : 'Save to Inventory'}
          </button>
        </div>
      </div>
    </ModalShell>
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
