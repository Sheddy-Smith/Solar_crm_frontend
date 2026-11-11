import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { inventoryApi, materialPlanApi, projectApi } from './api.js';
import { fetchEveryPage, rowsOf } from './lib/listQuery.js';
import { organizationDisplayName } from './lib/organization.js';

const UOM_OPTIONS = ['Nos', 'Mtr', 'Set', 'Lot', 'Kg', 'Pair', 'Unit', 'Packet', 'Bundels', 'kW', 'pcs', 'Meter'];
const PANEL = 'rounded-[14px] border border-[#e7eef7] bg-white shadow-[0_10px_24px_rgba(17,39,84,0.05)]';

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function num(v) {
  const n = Number(String(v ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function money(n) {
  return num(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function stockNum(item) {
  const n = Number(item?.current_stock);
  return Number.isFinite(n) ? n : 0;
}

function stockText(item) {
  const n = stockNum(item);
  return Number.isInteger(n) ? String(n) : n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function invCost(item) {
  const n = Number(item?.rate);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function invSale(item) {
  const n = Number(item?.selling_price);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function gstRate(label) {
  const m = String(label || '').match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? Number(m[1]) : 0;
}

function todayInput() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function toDateInput(value) {
  if (!value) return todayInput();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return todayInput();
  return d.toISOString().slice(0, 10);
}

function displayDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

let draftSeq = 0;
function makeDraftLine(overrides = {}) {
  draftSeq += 1;
  return {
    _key: `draft-${Date.now()}-${draftSeq}`,
    id: null,
    inventory_item: '',
    item_name: '',
    hsn_code: '',
    description: '',
    count: '',
    qty: '',
    unit: 'Nos',
    price: '',
    tax_label: 'NONE',
    status: 'Not Started',
    ...overrides,
  };
}

function lineFromPlan(row, inventoryItems) {
  const linked = inventoryItems.find((i) => String(i.id) === String(row.inventory_item));
  return {
    _key: `plan-${row.id}`,
    id: row.id,
    inventory_item: row.inventory_item || '',
    item_name: linked?.name || row.items || '',
    hsn_code: linked?.hsn_code || '',
    description: row.items || linked?.name || '',
    count: '',
    qty: row.planned_qty ?? '',
    unit: row.uom || linked?.unit || 'Nos',
    price: row.planning_unit_price != null && row.planning_unit_price !== ''
      ? String(row.planning_unit_price)
      : (linked ? String(invCost(linked) || '') : ''),
    tax_label: 'NONE',
    status: row.status || 'Not Started',
  };
}

function computeLine(line) {
  const qty = num(line.qty);
  const price = num(line.price);
  const taxable = Math.round(qty * price * 100) / 100;
  const rate = gstRate(line.tax_label);
  const taxAmt = Math.round(taxable * rate) / 100;
  const amount = Math.round((taxable + taxAmt) * 100) / 100;
  return { taxable, taxAmt, amount, rate };
}

function ItemPickerDropdown({
  open,
  search,
  items,
  activeId,
  anchorEl,
  panelRef,
  onPick,
  onAddItemHint,
}) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 640 });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => [
      item.name,
      item.item_code,
      item.category,
      item.hsn_code,
      item.unit,
    ].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [items, search]);

  useLayoutEffect(() => {
    if (!open || !anchorEl) return undefined;
    const update = () => {
      const rect = anchorEl.getBoundingClientRect();
      const width = Math.min(680, Math.max(420, window.innerWidth - 24));
      let left = rect.left;
      if (left + width > window.innerWidth - 12) left = Math.max(12, window.innerWidth - width - 12);
      const below = rect.bottom + 4;
      const maxHeight = 320;
      const top = below + maxHeight > window.innerHeight - 8
        ? Math.max(8, rect.top - maxHeight - 4)
        : below;
      setPos({ top, left, width });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchorEl, filtered.length]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
      className="overflow-hidden rounded-[10px] border border-[#cfd8e3] bg-white shadow-[0_18px_48px_rgba(15,23,42,0.22)]"
    >
      <button
        type="button"
        onClick={onAddItemHint}
        className="flex w-full items-center gap-2 border-b border-[#eef2f7] px-3 py-2.5 text-left text-[13px] font-bold text-[#2563eb] hover:bg-[#eff6ff]"
      >
        <Plus className="size-4" />
        Add Item
      </button>
      <div className="grid grid-cols-[minmax(0,1.7fr)_88px_100px_84px_80px] gap-2 border-b border-[#e8eef6] bg-[#f7f9fc] px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.05em] text-[#8a98af]">
        <span>Item Name</span>
        <span className="text-right">Sale Price</span>
        <span className="text-right">Purchase Price</span>
        <span className="text-right">Mfg Cost</span>
        <span className="text-right">Stock</span>
      </div>
      <div className="max-h-[280px] overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-3 py-5 text-center text-[12px] font-semibold text-[#8a98af]">
            Inventory empty — pehle Inventory → Products mein item add karo
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-5 text-center text-[12px] font-semibold text-[#8a98af]">No matching inventory item</p>
        ) : filtered.map((item) => {
          const stock = stockNum(item);
          const sale = invSale(item);
          const purchase = invCost(item);
          const active = String(activeId) === String(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(item);
              }}
              className={cx(
                'grid w-full grid-cols-[minmax(0,1.7fr)_88px_100px_84px_80px] gap-2 border-b border-[#f1f5f9] px-3 py-2.5 text-left last:border-b-0 hover:bg-[#eef6ff]',
                active && 'bg-[#e8f1ff]',
              )}
            >
              <span className="min-w-0 self-center">
                <span className="block truncate text-[13px] font-bold text-[#111827]">{item.name}</span>
                <span className="block truncate text-[10px] font-semibold text-[#94a3b8]">
                  {[item.item_code || item.record_no, item.category, item.unit || 'Nos'].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="self-center text-right text-[12px] font-semibold text-[#334155]">{sale ? money(sale) : '0'}</span>
              <span className="self-center text-right text-[12px] font-semibold text-[#334155]">{purchase ? money(purchase) : '0'}</span>
              <span className="self-center text-right text-[12px] font-semibold text-[#94a3b8]">—</span>
              <span className={cx('self-center text-right text-[13px] font-extrabold', stock > 0 ? 'text-[#16a34a]' : 'text-[#dc2626]')}>
                {stockText(item)}
              </span>
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Vyapar Purchase-Order style Material Planning editor.
 * Persists lines to materialPlanApi; item master data comes from inventoryApi.
 */
export function MaterialPlanningPoPage({
  project: projectProp,
  onClose,
  onNotify,
  onPlansChanged,
  showBack = false,
  panelClass = PANEL,
}) {
  const [project, setProject] = useState(projectProp);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [lines, setLines] = useState([makeDraftLine()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerKey, setPickerKey] = useState(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerAnchor, setPickerAnchor] = useState(null);
  const pickerPanelRef = useRef(null);
  const inputRefs = useRef({});

  const [meta, setMeta] = useState({
    plan_no: '',
    order_date: todayInput(),
    due_date: todayInput(),
    state_of_supply: 'Madhya Pradesh',
  });

  const load = useCallback(async () => {
    if (!projectProp?.id) return;
    setLoading(true);
    try {
      const [full, planData, itemsData] = await Promise.all([
        projectApi.get(projectProp.id),
        materialPlanApi.list({ project: projectProp.id, page_size: 100 }),
        fetchEveryPage((page, pageSize) => inventoryApi.items.list({ page, page_size: pageSize, is_active: true })),
      ]);
      setProject(full);
      const items = (Array.isArray(itemsData) ? itemsData : rowsOf(itemsData))
        .slice()
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'en', { sensitivity: 'base' }));
      setInventoryItems(items);
      const plans = rowsOf(planData);
      const mapped = plans.map((row) => lineFromPlan(row, items));
      setLines(mapped.length ? [...mapped, makeDraftLine()] : [makeDraftLine()]);
      setMeta((prev) => ({
        ...prev,
        plan_no: `MP/${full.project_id || full.id}`,
        order_date: toDateInput(full.created_at),
        due_date: todayInput(),
        state_of_supply: full.state || full.site_state || prev.state_of_supply,
      }));
    } catch (e) {
      onNotify?.(e.message || 'Failed to load material planning', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectProp?.id, onNotify]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!pickerKey) return undefined;
    const onPointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const inputEl = inputRefs.current[pickerKey];
      if (inputEl?.contains(target)) return;
      if (pickerPanelRef.current?.contains(target)) return;
      setPickerKey(null);
      setPickerSearch('');
      setPickerAnchor(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [pickerKey]);

  const partyLabel = project?.customer_name || project?.project_name || 'Select project party';
  const company = organizationDisplayName() || 'Ecomalwa Solar Energy Private Limited';

  const patchLine = (key, patch) => {
    setLines((prev) => prev.map((line) => (line._key === key ? { ...line, ...patch } : line)));
  };

  const applyItem = (key, item) => {
    if (!item) {
      patchLine(key, { inventory_item: '', item_name: '', hsn_code: '', unit: 'Nos', price: '', description: '' });
      return;
    }
    const cost = invCost(item);
    const sale = invSale(item);
    patchLine(key, {
      inventory_item: item.id,
      item_name: item.name || '',
      hsn_code: item.hsn_code || '',
      description: item.name || '',
      unit: item.unit || 'Nos',
      // Planning price defaults to inventory purchase cost; sale kept for reference in dropdown.
      price: cost ? String(cost) : (sale ? String(sale) : ''),
    });
    setPickerKey(null);
    setPickerSearch('');
    setPickerAnchor(null);
  };

  const openPicker = (key, el, seed = '') => {
    setPickerKey(key);
    setPickerSearch(seed);
    setPickerAnchor(el || inputRefs.current[key] || null);
  };

  const ensureTrailingDraft = (nextLines) => {
    const last = nextLines[nextLines.length - 1];
    if (last?.inventory_item || last?.item_name || last?.qty) {
      return [...nextLines, makeDraftLine()];
    }
    return nextLines;
  };

  const totals = useMemo(() => {
    return lines.reduce((acc, line) => {
      if (!line.inventory_item && !line.item_name && !num(line.qty)) return acc;
      acc.qty += num(line.qty);
      return acc;
    }, { qty: 0 });
  }, [lines]);

  const saveLine = async (line) => {
    if (!project?.id) {
      onNotify?.('Project missing', 'error');
      return null;
    }
    if (!line.inventory_item) {
      onNotify?.('Select an inventory item', 'error');
      return null;
    }
    if (!num(line.qty)) {
      onNotify?.('Qty required', 'error');
      return null;
    }
    const linked = inventoryItems.find((i) => String(i.id) === String(line.inventory_item));
    const category = linked?.category || 'Other';
    const calc = computeLine(line);
    const payload = {
      project: project.id,
      category,
      items: String(line.description || line.item_name || linked?.name || '').slice(0, 50),
      uom: line.unit || linked?.unit || 'Nos',
      planned_qty: String(line.qty),
      planned_value: String(calc.taxable),
      planning_unit_price: num(line.price),
      status: line.status || 'Not Started',
      inventory_item: line.inventory_item,
      vehicle_no: '',
      challan_no: '',
    };
    try {
      if (line.id) {
        return await materialPlanApi.update(line.id, payload);
      }
      try {
        return await materialPlanApi.create(payload);
      } catch {
        const { inventory_item, ...fallback } = payload;
        return await materialPlanApi.create(fallback);
      }
    } catch (e) {
      onNotify?.(e.message || 'Save line failed', 'error');
      return null;
    }
  };

  const confirmLine = async (key) => {
    const line = lines.find((l) => l._key === key);
    if (!line) return;
    setSaving(true);
    try {
      const saved = await saveLine(line);
      if (!saved) return;
      const linked = inventoryItems.find((i) => String(i.id) === String(line.inventory_item || saved.inventory_item));
      const stock = stockNum(linked);
      const planned = num(line.qty);
      setLines((prev) => {
        const mapped = prev.map((row) => (
          row._key === key
            ? { ...lineFromPlan({ ...saved, inventory_item: line.inventory_item || saved.inventory_item }, inventoryItems), description: line.description }
            : row
        ));
        return ensureTrailingDraft(mapped);
      });
      onNotify?.(
        planned > stock
          ? `Line saved · planned ${planned} > stock ${stock} — inventory demand increased`
          : (line.id ? 'Material line updated' : 'Material line added'),
      );
      onPlansChanged?.();
    } finally {
      setSaving(false);
    }
  };

  const removeLine = async (line) => {
    if (line.id) {
      try {
        await materialPlanApi.delete(line.id);
        onNotify?.('Material removed');
        onPlansChanged?.();
      } catch (e) {
        onNotify?.(e.message || 'Delete failed', 'error');
        return;
      }
    }
    setLines((prev) => {
      const next = prev.filter((row) => row._key !== line._key);
      return next.length ? ensureTrailingDraft(next) : [makeDraftLine()];
    });
  };

  const saveAll = async () => {
    const pending = lines.filter((line) => line.inventory_item && num(line.qty));
    if (!pending.length) {
      onNotify?.('Add at least one inventory item with qty', 'error');
      return;
    }
    setSaving(true);
    try {
      for (const line of pending) {
        const saved = await saveLine(line);
        if (!saved) throw new Error('Save stopped');
        line.id = saved.id;
        line.inventory_item = line.inventory_item || saved.inventory_item;
      }
      onNotify?.(`Saved ${pending.length} material line(s)`);
      onPlansChanged?.();
      await load();
    } catch (e) {
      if (e.message !== 'Save stopped') onNotify?.(e.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cx(panelClass, 'overflow-hidden')}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#edf2f8] px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {showBack ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#d5e0ef] bg-white px-3 text-[12px] font-bold text-[#314a79]"
              >
                <ChevronLeft className="size-4" />
                Back
              </button>
            ) : null}
            <h1 className="font-display text-[22px] font-extrabold text-[#0f172a]">Material Planning</h1>
          </div>
          <p className="mt-1 text-[12px] font-semibold text-[#64748b]">
            Inventory-linked BOM · same entry flow as Purchase Order
          </p>
        </div>
        <div className="text-right">
          <p className="text-[13px] font-extrabold text-[#0f172a]">{company}</p>
          <p className="text-[11px] font-semibold text-[#94a3b8]">{project?.project_id || '—'}</p>
        </div>
      </div>

      <div className="grid gap-3 border-b border-[#edf2f8] px-4 py-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] sm:px-5">
        <div>
          <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[#94a3b8]">Party *</p>
          <div className="flex h-11 items-center justify-between rounded-[8px] border border-[#d9e4f2] bg-white px-3">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-extrabold text-[#111827]">{partyLabel}</p>
              <p className="truncate text-[11px] font-semibold text-[#64748b]">
                {[project?.project_name, project?.site || project?.site_address].filter(Boolean).join(' · ') || 'Won project'}
              </p>
            </div>
            <ChevronDown className="size-4 shrink-0 text-[#94a3b8]" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <label className="grid gap-1 font-bold text-[#53647f]">
            Plan No.
            <input
              value={meta.plan_no}
              onChange={(e) => setMeta((p) => ({ ...p, plan_no: e.target.value }))}
              className="h-10 rounded-[8px] border border-[#d9e4f2] px-2 font-semibold text-[#111827] outline-none"
            />
          </label>
          <label className="grid gap-1 font-bold text-[#53647f]">
            Order Date
            <input
              type="date"
              value={meta.order_date}
              onChange={(e) => setMeta((p) => ({ ...p, order_date: e.target.value }))}
              className="h-10 rounded-[8px] border border-[#d9e4f2] px-2 font-semibold text-[#111827] outline-none"
            />
          </label>
          <label className="grid gap-1 font-bold text-[#53647f]">
            Due Date
            <input
              type="date"
              value={meta.due_date}
              onChange={(e) => setMeta((p) => ({ ...p, due_date: e.target.value }))}
              className="h-10 rounded-[8px] border border-[#d9e4f2] px-2 font-semibold text-[#111827] outline-none"
            />
          </label>
          <label className="grid gap-1 font-bold text-[#53647f]">
            State of supply
            <input
              value={meta.state_of_supply}
              onChange={(e) => setMeta((p) => ({ ...p, state_of_supply: e.target.value }))}
              className="h-10 rounded-[8px] border border-[#d9e4f2] px-2 font-semibold text-[#111827] outline-none"
            />
          </label>
        </div>
      </div>

      <div className="px-3 py-3 sm:px-5">
        {loading ? (
          <p className="py-16 text-center text-[13px] font-bold text-[#94a3b8]">Loading material planning…</p>
        ) : (
          <div className="overflow-x-auto overflow-y-visible rounded-[10px] border border-[#dbe3ee]">
            <p className="border-b border-[#eef2f7] bg-[#f8fbff] px-3 py-2 text-[11px] font-semibold text-[#64748b]">
              Item field pe type/click karo — Inventory Products dropdown khulega (Sale / Purchase / Stock). Example: Aluminium Wire (600)
            </p>
            <table className="min-w-[720px] w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#eef3f9] text-[11px] font-extrabold uppercase tracking-[0.03em] text-[#5b6b86]">
                  <th className="w-10 border-b border-[#dbe3ee] px-2 py-2.5">#</th>
                  <th className="min-w-[240px] border-b border-[#dbe3ee] px-2 py-2.5">Item</th>
                  <th className="min-w-[200px] border-b border-[#dbe3ee] px-2 py-2.5">Description</th>
                  <th className="w-[100px] border-b border-[#dbe3ee] px-2 py-2.5">Qty</th>
                  <th className="w-[110px] border-b border-[#dbe3ee] px-2 py-2.5">Unit</th>
                  <th className="w-[88px] border-b border-[#dbe3ee] px-2 py-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const linked = inventoryItems.find((i) => String(i.id) === String(line.inventory_item));
                  const stock = stockNum(linked);
                  const open = pickerKey === line._key;
                  const isLastRow = index === lines.length - 1;
                  return (
                    <tr key={line._key} className={open ? 'bg-[#f8fbff]' : 'bg-white'}>
                      <td className="border-b border-[#eef2f7] px-2 py-2 align-top">
                        <div className="flex flex-col items-center gap-1 pt-1">
                          <span className="text-[12px] font-bold text-[#94a3b8]">{index + 1}</span>
                          <button type="button" onClick={() => removeLine(line)} className="text-[#ef4444]" aria-label="Delete row">
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="relative border-b border-[#eef2f7] px-2 py-2 align-top">
                        <input
                          ref={(el) => { inputRefs.current[line._key] = el; }}
                          value={open ? pickerSearch : (linked ? `${linked.name} (${stockText(linked)})` : line.item_name)}
                          onFocus={(e) => {
                            openPicker(line._key, e.currentTarget, linked?.name || line.item_name || '');
                          }}
                          onClick={(e) => {
                            openPicker(line._key, e.currentTarget, linked?.name || line.item_name || pickerSearch || '');
                          }}
                          onChange={(e) => {
                            openPicker(line._key, e.currentTarget, e.target.value);
                            if (!e.target.value) applyItem(line._key, null);
                          }}
                          placeholder="Type to search inventory item..."
                          className="h-9 w-full rounded-[6px] border border-[#93c5fd] bg-white px-2 text-[13px] font-semibold text-[#111827] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
                          autoComplete="off"
                        />
                        {open ? (
                          <ItemPickerDropdown
                            open={open}
                            search={pickerSearch}
                            items={inventoryItems}
                            activeId={line.inventory_item}
                            anchorEl={pickerAnchor || inputRefs.current[line._key]}
                            panelRef={pickerPanelRef}
                            onPick={(item) => applyItem(line._key, item)}
                            onAddItemHint={() => onNotify?.('Naye products Inventory → Products se add karo', 'error')}
                          />
                        ) : null}
                      </td>
                      <td className="border-b border-[#eef2f7] px-2 py-2 align-top">
                        <input
                          value={line.description}
                          onChange={(e) => patchLine(line._key, { description: e.target.value })}
                          className="h-9 w-full rounded-[6px] border border-[#e5e7eb] px-2 text-[12px] font-semibold text-[#111827] outline-none"
                          placeholder="Description"
                        />
                      </td>
                      <td className="border-b border-[#eef2f7] px-2 py-2 align-top">
                        <input
                          type="number"
                          min="0"
                          value={line.qty}
                          onChange={(e) => patchLine(line._key, { qty: e.target.value })}
                          className={cx(
                            'h-9 w-full rounded-[6px] border px-2 text-[12px] font-bold outline-none',
                            linked && num(line.qty) > stock ? 'border-[#fca5a5] text-[#dc2626]' : 'border-[#e5e7eb] text-[#111827]',
                          )}
                        />
                      </td>
                      <td className="border-b border-[#eef2f7] px-2 py-2 align-top">
                        <select
                          value={line.unit}
                          onChange={(e) => patchLine(line._key, { unit: e.target.value })}
                          className="h-9 w-full rounded-[6px] border border-[#e5e7eb] px-1 text-[12px] font-bold text-[#111827] outline-none"
                        >
                          {UOM_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                          {line.unit && !UOM_OPTIONS.includes(line.unit) ? <option value={line.unit}>{line.unit}</option> : null}
                        </select>
                      </td>
                      <td className="border-b border-[#eef2f7] px-2 py-2 align-top">
                        <div className="flex items-center justify-center gap-1.5 pt-0.5">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => confirmLine(line._key)}
                            className="grid size-9 place-items-center rounded-[8px] bg-[#2563eb] text-white shadow-[0_6px_14px_rgba(37,99,235,0.28)] hover:bg-[#1d4ed8] disabled:opacity-50"
                            aria-label="Confirm line"
                          >
                            <Check className="size-4 stroke-[3]" />
                          </button>
                          {isLastRow ? (
                            <button
                              type="button"
                              onClick={() => setLines((prev) => [...prev, makeDraftLine()])}
                              className="grid size-9 place-items-center rounded-[8px] bg-[#2563eb] text-white shadow-[0_6px_14px_rgba(37,99,235,0.28)] hover:bg-[#1d4ed8]"
                              aria-label="Add item"
                              title="Add item"
                            >
                              <Plus className="size-4 stroke-[3]" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-[#f8fafc] text-[12px] font-extrabold text-[#314a79]">
                  <td colSpan={3} className="px-3 py-2.5 text-right uppercase tracking-[0.04em] text-[#94a3b8]">Total Qty</td>
                  <td className="px-2 py-2.5">{totals.qty}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf2f8] px-4 py-3 sm:px-5">
        <p className="text-[12px] font-semibold text-[#64748b]">
          Dates: {displayDate(meta.order_date)} → {displayDate(meta.due_date)} · Stock from Inventory
        </p>
        <div className="flex gap-2">
          {showBack ? (
            <button type="button" onClick={onClose} className="h-11 rounded-[8px] border border-[#d5e0ef] bg-white px-5 text-[13px] font-extrabold text-[#314a79]">
              Close
            </button>
          ) : null}
          <button
            type="button"
            disabled={saving || loading}
            onClick={saveAll}
            className="inline-flex h-11 items-center gap-2 rounded-[8px] bg-[#2563eb] px-5 text-[13px] font-extrabold text-white shadow-[0_8px_16px_rgba(37,99,235,0.22)] disabled:opacity-60"
          >
            <Save className="size-4" />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MaterialPlanningPoPage;
