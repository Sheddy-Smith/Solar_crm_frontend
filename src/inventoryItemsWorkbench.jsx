import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  Info,
  MoreVertical,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { inventoryApi } from './api.js';
import { rowsOf } from './lib/listQuery.js';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function fmtRs(value) {
  const amount = Number(value || 0);
  return `₹ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtQty(value) {
  const qty = Number(value || 0);
  if (Number.isInteger(qty)) return String(qty);
  return qty.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function qtyClass(value) {
  const qty = Number(value || 0);
  if (qty > 0) return 'text-[#16a34a]';
  return 'text-[#dc2626]';
}

function movementLabel(type) {
  if (type === 'Inward') return 'Purchase';
  if (type === 'Outward') return 'Sale';
  if (type === 'Adjustment') return 'Adjustment';
  if (type === 'Transfer') return 'Transfer';
  return type || 'Movement';
}

function movementDot(type) {
  if (type === 'Inward') return 'bg-[#ef4444]';
  if (type === 'Outward') return 'bg-[#22c55e]';
  if (type === 'Adjustment') return 'bg-[#f59e0b]';
  return 'bg-[#3b82f6]';
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN');
}

function BulkItemsModal({
  title,
  infoText,
  confirmLabel,
  items,
  loading,
  onClose,
  onConfirm,
  confirming,
  showSoldColumn = false,
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => [
      item.name,
      item.item_code,
      item.category,
    ].some((value) => String(value || '').toLowerCase().includes(q)));
  }, [items, search]);

  const allChecked = filtered.length > 0 && filtered.every((item) => selected.has(item.id));

  const toggleAll = () => {
    if (allChecked) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filtered.map((item) => item.id)));
  };

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-3 sm:p-6">
      <div className="flex max-h-[90vh] w-full max-w-[720px] flex-col overflow-hidden rounded-[14px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
        <div className="flex items-center justify-between border-b border-[#eef2f7] px-5 py-4">
          <h2 className="text-[18px] font-extrabold text-[#111827]">{title}</h2>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-full text-[#6b7280] hover:bg-[#f3f4f6]" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="border-b border-[#eef2f7] px-5 py-3">
          <label className="flex h-11 items-center gap-2 rounded-[10px] border border-[#dbe3ee] bg-white px-3">
            <Search className="size-4 text-[#9aa6b8]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items"
              className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-[#111827] outline-none"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-full text-left">
            <thead className="sticky top-0 bg-[#f8fafc]">
              <tr className="text-[12px] font-extrabold text-[#64748b]">
                <th className="px-5 py-3">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} className="size-4 accent-[#2563eb]" />
                </th>
                <th className="px-3 py-3">Item Name</th>
                <th className="px-3 py-3 text-right">Quantity</th>
                {showSoldColumn ? <th className="px-5 py-3 text-right">Quantity Sold in Last 90 Days</th> : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={showSoldColumn ? 4 : 3} className="px-5 py-10 text-center text-[13px] font-bold text-[#94a3b8]">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={showSoldColumn ? 4 : 3} className="px-5 py-10 text-center text-[13px] font-bold text-[#94a3b8]">No items found</td></tr>
              ) : filtered.map((item, index) => (
                <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-[#fafbfd]'}>
                  <td className="px-5 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleOne(item.id)}
                      className="size-4 accent-[#2563eb]"
                    />
                  </td>
                  <td className="px-3 py-3 text-[13px] font-semibold text-[#111827]">{item.name}</td>
                  <td className={cx('px-3 py-3 text-right text-[13px] font-bold', qtyClass(item.current_stock))}>
                    {fmtQty(item.current_stock)}
                  </td>
                  {showSoldColumn ? (
                    <td className="px-5 py-3 text-right text-[13px] font-bold text-[#dc2626]">0</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#eef2f7] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex items-center gap-2 rounded-[8px] bg-[#eaf3ff] px-3 py-2 text-[12px] font-semibold text-[#1d4ed8]">
            <Info className="size-4" />
            {infoText}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="h-10 rounded-full border border-[#d1d5db] bg-white px-5 text-[13px] font-bold text-[#4b5563]">
              Cancel
            </button>
            <button
              type="button"
              disabled={confirming || selected.size === 0}
              onClick={() => onConfirm([...selected])}
              className="h-10 rounded-full bg-[#e11d48] px-5 text-[13px] font-extrabold text-white disabled:opacity-50"
            >
              {confirming ? 'Saving…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BulkUpdateItemsPage({ items, categories, onBack, onNotify, onSaved }) {
  const [tab, setTab] = useState('Pricing');
  const [drafts, setDrafts] = useState(() => new Map());
  const [selected, setSelected] = useState(() => new Set());
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [showExcel, setShowExcel] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => [
      item.name,
      item.item_code,
      item.category,
      item.hsn_code,
    ].some((value) => String(value || '').toLowerCase().includes(q)));
  }, [items, search]);

  const updateCount = drafts.size;

  const patchDraft = (id, patch) => {
    setDrafts((prev) => {
      const next = new Map(prev);
      const base = items.find((item) => item.id === id) || {};
      const current = next.get(id) || {};
      next.set(id, { ...base, ...current, ...patch });
      return next;
    });
  };

  const valueOf = (item, key) => {
    const draft = drafts.get(item.id);
    if (draft && draft[key] !== undefined) return draft[key];
    return item[key] ?? '';
  };

  const saveUpdates = async () => {
    if (!drafts.size) return;
    setSaving(true);
    try {
      await Promise.all([...drafts.entries()].map(([id, body]) => inventoryApi.items.update(id, {
        name: body.name,
        category: body.category,
        hsn_code: body.hsn_code,
        item_code: body.item_code || undefined,
        rate: body.rate === '' || body.rate == null ? 0 : Number(body.rate),
        selling_price: body.selling_price === '' || body.selling_price == null ? 0 : Number(body.selling_price),
        minimum_stock: body.minimum_stock === '' || body.minimum_stock == null ? 0 : Number(body.minimum_stock),
        location: body.location || '',
        unit: body.unit || 'Nos',
      })));
      onNotify?.(`Updated ${drafts.size} item(s)`, 'success');
      setDrafts(new Map());
      onSaved?.();
    } catch (error) {
      onNotify?.(error.message || 'Bulk update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const exportExcelishCsv = () => {
    const header = ['Item Code', 'Name', 'Category', 'HSN', 'Purchase Price', 'Sale Price', 'Unit', 'Min Stock', 'Location'];
    const lines = [header.join(',')];
    items.forEach((item) => {
      lines.push([
        item.item_code || '',
        `"${String(item.name || '').replaceAll('"', '""')}"`,
        item.category || '',
        item.hsn_code || '',
        item.rate ?? 0,
        item.selling_price ?? 0,
        item.unit || 'Nos',
        item.minimum_stock ?? 0,
        `"${String(item.location || '').replaceAll('"', '""')}"`,
      ].join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'malwa-inventory-items.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    onNotify?.('Excel/CSV template downloaded', 'success');
  };

  if (showExcel) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-[28px] font-extrabold text-[#111827]">Update Items via Excel</h1>
          <button type="button" onClick={() => setShowExcel(false)} className="h-10 rounded-full border border-[#d1d5db] px-4 text-[13px] font-bold text-[#4b5563]">
            Back
          </button>
        </div>
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-4 rounded-[14px] border border-[#e5e7eb] bg-white p-5">
            <div className="rounded-[12px] border-2 border-[#93c5fd] bg-[#eff6ff] p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-8 place-items-center rounded-full bg-[#2563eb] text-[13px] font-extrabold text-white">1</span>
                <p className="text-[13px] font-semibold text-[#1e3a8a]">
                  Download your current item list & update your Item details in the same file.
                </p>
              </div>
            </div>
            <div className="rounded-[12px] border border-[#e5e7eb] bg-[#f8fafc] p-4 opacity-70">
              <div className="flex items-start gap-3">
                <span className="grid size-8 place-items-center rounded-full bg-[#cbd5e1] text-[13px] font-extrabold text-white">2</span>
                <p className="text-[13px] font-semibold text-[#475569]">
                  Upload the updated Excel file by clicking the Upload File CTA.
                </p>
              </div>
            </div>
          </div>
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[14px] border-2 border-dashed border-[#d1d5db] bg-white p-8 text-center">
            <p className="max-w-md text-[14px] font-semibold text-[#64748b]">
              Download the Excel below & update your Item list there before uploading it.
            </p>
            <button
              type="button"
              onClick={exportExcelishCsv}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full border-2 border-[#e11d48] px-5 text-[13px] font-extrabold text-[#e11d48]"
            >
              <Download className="size-4" />
              Download Excel File
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="h-9 rounded-full border border-[#d1d5db] px-3 text-[12px] font-bold text-[#4b5563]">
            Back
          </button>
          <h1 className="text-[28px] font-extrabold text-[#111827]">Bulk Update Items</h1>
        </div>
        <button
          type="button"
          onClick={() => setShowExcel(true)}
          className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#e11d48] px-4 text-[13px] font-extrabold text-white"
        >
          <FileSpreadsheet className="size-4" />
          Update Items via Excel
        </button>
      </div>

      <div className="flex items-center justify-between border-b border-[#e5e7eb]">
        <div className="flex gap-6">
          {['Pricing', 'Stock', 'Item Information'].map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setTab(name)}
              className={cx(
                'border-b-2 px-1 pb-3 text-[14px] font-extrabold',
                tab === name ? 'border-[#e11d48] text-[#e11d48]' : 'border-transparent text-[#6b7280]',
              )}
            >
              {name}
            </button>
          ))}
        </div>
        <label className="mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e7eb]">
          <Search className="size-4 text-[#94a3b8]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sr-only"
            placeholder="Search"
          />
        </label>
      </div>

      <div className="overflow-auto rounded-[12px] border border-[#e5e7eb] bg-white">
        <table className="min-w-full text-left text-[12px]">
          <thead className="bg-[#f3f6fb] text-[11px] font-extrabold uppercase text-[#64748b]">
            <tr>
              <th className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every((item) => selected.has(item.id))}
                  onChange={() => {
                    if (filtered.every((item) => selected.has(item.id))) setSelected(new Set());
                    else setSelected(new Set(filtered.map((item) => item.id)));
                  }}
                  className="size-4 accent-[#2563eb]"
                />
              </th>
              <th className="px-3 py-3">#</th>
              <th className="px-3 py-3">Item Name*</th>
              {tab === 'Pricing' ? (
                <>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Item HSN</th>
                  <th className="px-3 py-3">Purchase Price</th>
                  <th className="px-3 py-3">Sale Price</th>
                </>
              ) : null}
              {tab === 'Stock' ? (
                <>
                  <th className="px-3 py-3">Current Quantity</th>
                  <th className="px-3 py-3">Min. Stock</th>
                  <th className="px-3 py-3">Location</th>
                  <th className="px-3 py-3">As Of Date</th>
                </>
              ) : null}
              {tab === 'Item Information' ? (
                <>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Item HSN</th>
                  <th className="px-3 py-3">Item Code</th>
                  <th className="px-3 py-3">Unit</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {filtered.map((item, index) => (
              <tr key={item.id} className="border-t border-[#eef2f7]">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      });
                    }}
                    className="size-4 accent-[#2563eb]"
                  />
                </td>
                <td className="px-3 py-2 font-semibold text-[#64748b]">{index + 1}</td>
                <td className="px-3 py-2">
                  <input
                    className="h-9 w-full min-w-[180px] rounded-[8px] border border-[#e5e7eb] px-2 font-semibold text-[#111827]"
                    value={valueOf(item, 'name')}
                    onChange={(e) => patchDraft(item.id, { name: e.target.value })}
                  />
                </td>
                {tab === 'Pricing' ? (
                  <>
                    <td className="px-3 py-2">
                      <select
                        className="h-9 rounded-[8px] border border-[#e5e7eb] px-2"
                        value={valueOf(item, 'category') || ''}
                        onChange={(e) => patchDraft(item.id, { category: e.target.value })}
                      >
                        {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input className="h-9 w-28 rounded-[8px] border border-[#e5e7eb] px-2" value={valueOf(item, 'hsn_code')} onChange={(e) => patchDraft(item.id, { hsn_code: e.target.value })} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex h-9 items-center rounded-[8px] border border-[#e5e7eb] px-2">
                        <span className="mr-1 text-[#94a3b8]">₹</span>
                        <input className="w-24 outline-none" value={valueOf(item, 'rate')} onChange={(e) => patchDraft(item.id, { rate: e.target.value })} />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex h-9 items-center rounded-[8px] border border-[#e5e7eb] px-2">
                        <span className="mr-1 text-[#94a3b8]">₹</span>
                        <input className="w-24 outline-none" value={valueOf(item, 'selling_price')} onChange={(e) => patchDraft(item.id, { selling_price: e.target.value })} />
                      </div>
                    </td>
                  </>
                ) : null}
                {tab === 'Stock' ? (
                  <>
                    <td className="px-3 py-2 font-bold text-[#111827]">{fmtQty(item.current_stock)}</td>
                    <td className="px-3 py-2">
                      <input className="h-9 w-24 rounded-[8px] border border-[#e5e7eb] px-2" value={valueOf(item, 'minimum_stock')} onChange={(e) => patchDraft(item.id, { minimum_stock: e.target.value })} />
                    </td>
                    <td className="px-3 py-2">
                      <input className="h-9 w-36 rounded-[8px] border border-[#e5e7eb] px-2" value={valueOf(item, 'location')} onChange={(e) => patchDraft(item.id, { location: e.target.value })} />
                    </td>
                    <td className="px-3 py-2 text-[#64748b]">{formatDate(new Date())}</td>
                  </>
                ) : null}
                {tab === 'Item Information' ? (
                  <>
                    <td className="px-3 py-2">
                      <select className="h-9 rounded-[8px] border border-[#e5e7eb] px-2" value={valueOf(item, 'category') || ''} onChange={(e) => patchDraft(item.id, { category: e.target.value })}>
                        {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input className="h-9 w-28 rounded-[8px] border border-[#e5e7eb] px-2" value={valueOf(item, 'hsn_code')} onChange={(e) => patchDraft(item.id, { hsn_code: e.target.value })} />
                    </td>
                    <td className="px-3 py-2">
                      <input className="h-9 w-28 rounded-[8px] border border-[#e5e7eb] px-2" value={valueOf(item, 'item_code') || ''} onChange={(e) => patchDraft(item.id, { item_code: e.target.value })} />
                    </td>
                    <td className="px-3 py-2">
                      <input className="h-9 w-20 rounded-[8px] border border-[#e5e7eb] px-2" value={valueOf(item, 'unit') || 'Nos'} onChange={(e) => patchDraft(item.id, { unit: e.target.value })} />
                    </td>
                  </>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="rounded-full bg-[#f5efe6] px-4 py-2 text-[12px] font-semibold text-[#7c5a2c]">
          Pricing - {tab === 'Pricing' ? updateCount : 0} Updates, Stock - {tab === 'Stock' ? updateCount : 0} Updates, Item Information - {tab === 'Item Information' ? updateCount : 0} Updates
        </div>
        <button
          type="button"
          disabled={!updateCount || saving}
          onClick={saveUpdates}
          className={cx(
            'h-11 rounded-[10px] px-6 text-[14px] font-extrabold text-white',
            updateCount ? 'bg-[#e11d48]' : 'bg-[#d1d5db]',
          )}
        >
          {saving ? 'Updating…' : 'Update Items'}
        </button>
      </div>
    </div>
  );
}

export function InventoryItemsWorkbench({
  items,
  categories = [],
  loading = false,
  caps = {},
  onReload,
  onNotify,
  onAddItem,
  onEditItem,
  onAdjustItem,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [listSearch, setListSearch] = useState('');
  const [listSearchOpen, setListSearchOpen] = useState(false);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerSearchOpen, setLedgerSearchOpen] = useState(false);
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [mode, setMode] = useState('workbench'); // workbench | bulkUpdate
  const [movements, setMovements] = useState([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!bulkMenuOpen) return undefined;
    const onPointerDown = (event) => {
      if (!(event.target instanceof Element)) return;
      if (!menuRef.current?.contains(event.target)) setBulkMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [bulkMenuOpen]);

  const activeItems = useMemo(() => items.filter((item) => item.is_active !== false), [items]);
  const inactiveItems = useMemo(() => items.filter((item) => item.is_active === false), [items]);
  const noCodeItems = useMemo(() => activeItems.filter((item) => !item.item_code), [activeItems]);

  const visibleItems = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return activeItems;
    return activeItems.filter((item) => [
      item.name,
      item.item_code,
      item.category,
    ].some((value) => String(value || '').toLowerCase().includes(q)));
  }, [activeItems, listSearch]);

  useEffect(() => {
    if (!visibleItems.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !visibleItems.some((item) => item.id === selectedId)) {
      setSelectedId(visibleItems[0].id);
    }
  }, [visibleItems, selectedId]);

  const selectedItem = visibleItems.find((item) => item.id === selectedId) || null;

  const loadMovements = useCallback(() => {
    if (!selectedItem?.id) {
      setMovements([]);
      return;
    }
    setMovementsLoading(true);
    inventoryApi.movements.list({ item: selectedItem.id, page_size: 50, ordering: '-created_at' })
      .then((data) => setMovements(rowsOf(data)))
      .catch(() => setMovements([]))
      .finally(() => setMovementsLoading(false));
  }, [selectedItem?.id]);

  useEffect(() => { loadMovements(); }, [loadMovements]);

  const filteredMovements = useMemo(() => {
    const q = ledgerSearch.trim().toLowerCase();
    if (!q) return movements;
    return movements.filter((row) => [
      row.movement_type,
      row.reference_no,
      row.reference,
      row.reference_type,
      row.notes,
    ].some((value) => String(value || '').toLowerCase().includes(q)));
  }, [movements, ledgerSearch]);

  const categoryNames = useMemo(() => {
    const names = categories.map((cat) => (typeof cat === 'string' ? cat : cat.name)).filter(Boolean);
    const fromItems = items.map((item) => item.category).filter(Boolean);
    return [...new Set([...names, ...fromItems])];
  }, [categories, items]);

  const stockValue = Number(selectedItem?.current_stock || 0) * Number(selectedItem?.rate || 0);

  const runBulkActiveState = async (ids, isActive) => {
    setBulkBusy(true);
    try {
      await Promise.all(ids.map((id) => inventoryApi.items.update(id, { is_active: isActive })));
      onNotify?.(isActive ? `Marked ${ids.length} item(s) active` : `Marked ${ids.length} item(s) inactive`, 'success');
      setBulkMode(null);
      onReload?.();
    } catch (error) {
      onNotify?.(error.message || 'Bulk update failed', 'error');
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkAssignCode = async (ids) => {
    setBulkBusy(true);
    try {
      const selected = items.filter((item) => ids.includes(item.id));
      await Promise.all(selected.map((item, index) => {
        if (item.item_code) return Promise.resolve();
        const code = `ITM-${String(Date.now()).slice(-6)}-${index + 1}`;
        return inventoryApi.items.update(item.id, { item_code: code });
      }));
      onNotify?.(`Assigned codes to ${ids.length} item(s)`, 'success');
      setBulkMode(null);
      onReload?.();
    } catch (error) {
      onNotify?.(error.message || 'Assign code failed', 'error');
    } finally {
      setBulkBusy(false);
    }
  };

  if (mode === 'bulkUpdate') {
    return (
      <BulkUpdateItemsPage
        items={items}
        categories={categoryNames}
        onBack={() => setMode('workbench')}
        onNotify={onNotify}
        onSaved={onReload}
      />
    );
  }

  return (
    <div>
      <div className="grid min-h-[620px] bg-white lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="border-b border-[#e5e7eb] lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-2 border-b border-[#e5e7eb] p-3">
              {listSearchOpen || listSearch ? (
                <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[8px] border border-[#dbe3ee] bg-white px-2.5">
                  <Search className="size-4 shrink-0 text-[#94a3b8]" />
                  <input
                    autoFocus
                    value={listSearch}
                    onChange={(e) => setListSearch(e.target.value)}
                    onBlur={() => { if (!listSearch) setListSearchOpen(false); }}
                    className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-[#111827] outline-none"
                    placeholder="Search items"
                  />
                  {listSearch ? (
                    <button type="button" onClick={() => { setListSearch(''); setListSearchOpen(false); }} className="text-[#94a3b8]" aria-label="Clear search">
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </label>
              ) : (
                <button
                  type="button"
                  onClick={() => setListSearchOpen(true)}
                  className="grid size-9 place-items-center rounded-[8px] border border-[#e5e7eb] text-[#64748b] hover:bg-[#f8fafc]"
                  aria-label="Search items"
                >
                  <Search className="size-4" />
                </button>
              )}
              <div className="relative ml-auto shrink-0" ref={menuRef}>
                {caps.add ? (
                  <div className="flex overflow-hidden rounded-[8px]">
                    <button
                      type="button"
                      onClick={onAddItem}
                      className="inline-flex h-9 items-center justify-center gap-1 bg-[#f97316] px-3 text-[12px] font-extrabold text-white"
                    >
                      <Plus className="size-3.5" />
                      Add Item
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkMenuOpen((open) => !open)}
                      className="grid h-9 w-9 place-items-center border-l border-orange-400 bg-[#f97316] text-white"
                      aria-label="More item actions"
                    >
                      <ChevronDown className="size-4" />
                    </button>
                  </div>
                ) : null}
                {bulkMenuOpen ? (
                  <div className="absolute right-0 z-20 mt-2 w-[210px] overflow-hidden rounded-[10px] border border-[#e5e7eb] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.16)]">
                    {[
                      { key: 'inactive', label: 'Bulk Inactive' },
                      { key: 'active', label: 'Bulk Active' },
                      { key: 'code', label: 'Bulk Assign Code' },
                      { key: 'update', label: 'Bulk Update Items', action: () => setMode('bulkUpdate') },
                    ].map((entry) => (
                      <button
                        key={entry.key}
                        type="button"
                        onClick={() => {
                          setBulkMenuOpen(false);
                          if (entry.action) {
                            entry.action();
                            return;
                          }
                          setBulkMode(entry.key);
                        }}
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[13px] font-semibold text-[#111827] hover:bg-[#f8fafc]"
                      >
                        {entry.label}
                        {entry.key === 'update' ? <span className="text-[#2563eb]">🌐</span> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_88px] border-b border-[#e5e7eb] px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#94a3b8]">
              <span>Item</span>
              <span className="text-right">Quantity</span>
            </div>

            <div className="max-h-[560px] overflow-y-auto">
              {loading ? <p className="px-4 py-8 text-center text-[13px] font-bold text-[#94a3b8]">Loading…</p> : null}
              {!loading && visibleItems.length === 0 ? (
                <p className="px-4 py-8 text-center text-[13px] font-bold text-[#94a3b8]">No items found.</p>
              ) : null}
              {visibleItems.map((item) => {
                const active = item.id === selectedId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={cx(
                      'grid w-full grid-cols-[minmax(0,1fr)_88px] gap-2 border-b border-[#f1f5f9] px-4 py-3 text-left',
                      active ? 'bg-[#e8f1ff]' : 'bg-white hover:bg-[#f8fafc]',
                    )}
                  >
                    <span className="truncate text-[13px] font-semibold text-[#111827]">{item.name}</span>
                    <span className={cx('text-right text-[13px] font-extrabold', qtyClass(item.current_stock))}>
                      {fmtQty(item.current_stock)}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#e5e7eb] px-4 py-2.5">
              {caps.edit ? (
                <button
                  type="button"
                  disabled={!selectedItem}
                  onClick={() => selectedItem && onAdjustItem?.(selectedItem)}
                  className="h-9 rounded-[8px] bg-[#2563eb] px-4 text-[12px] font-extrabold uppercase tracking-[0.04em] text-white disabled:opacity-50"
                >
                  Adjust Item
                </button>
              ) : null}
              <p className="text-[12px] font-bold text-[#64748b]">
                STOCK QUANTITY:{' '}
                <span className={cx('font-extrabold', qtyClass(selectedItem?.current_stock))}>{fmtQty(selectedItem?.current_stock)}</span>
                <span className="mx-2 text-[#d1d5db]">|</span>
                STOCK VALUE:{' '}
                <span className="font-extrabold text-[#16a34a]">{fmtRs(stockValue)}</span>
              </p>
              <div className="ml-auto flex items-center gap-2">
                {ledgerSearchOpen || ledgerSearch ? (
                  <label className="flex h-9 items-center gap-2 rounded-[8px] border border-[#dbe3ee] px-3">
                    <Search className="size-3.5 text-[#94a3b8]" />
                    <input
                      autoFocus
                      value={ledgerSearch}
                      onChange={(e) => setLedgerSearch(e.target.value)}
                      onBlur={() => { if (!ledgerSearch) setLedgerSearchOpen(false); }}
                      placeholder="Search ledger"
                      className="w-28 bg-transparent text-[12px] font-semibold outline-none"
                    />
                  </label>
                ) : (
                  <button
                    type="button"
                    onClick={() => setLedgerSearchOpen(true)}
                    className="grid size-9 place-items-center rounded-[8px] border border-[#e5e7eb] text-[#64748b] hover:bg-[#f8fafc]"
                    aria-label="Search ledger"
                  >
                    <Search className="size-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const header = ['Type', 'Invoice', 'Party', 'Date', 'Quantity', 'Price/Unit'];
                    const lines = [header.join(',')];
                    filteredMovements.forEach((row) => {
                      lines.push([
                        movementLabel(row.movement_type),
                        row.reference_no || '',
                        `"${String(row.reference || row.reference_type || '').replaceAll('"', '""')}"`,
                        formatDate(row.created_at),
                        row.quantity ?? '',
                        row.rate ?? '',
                      ].join(','));
                    });
                    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.download = `${selectedItem?.name || 'item'}-ledger.csv`;
                    document.body.appendChild(anchor);
                    anchor.click();
                    anchor.remove();
                    URL.revokeObjectURL(url);
                  }}
                  className="grid size-9 place-items-center rounded-[8px] border border-[#e5e7eb] text-[#16a34a]"
                  aria-label="Export ledger"
                >
                  <FileSpreadsheet className="size-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {!selectedItem ? (
                <p className="px-4 py-16 text-center text-[13px] font-bold text-[#94a3b8]">Select an item to view stock ledger.</p>
              ) : movementsLoading ? (
                <p className="px-4 py-16 text-center text-[13px] font-bold text-[#94a3b8]">Loading ledger…</p>
              ) : (
                <table className="min-w-full text-left">
                  <thead className="sticky top-0 bg-[#f8fafc] text-[11px] font-extrabold uppercase tracking-[0.05em] text-[#94a3b8]">
                    <tr>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Invoice/Ref</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Quantity</th>
                      <th className="px-4 py-3">Price/Unit</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMovements.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-12 text-center text-[13px] font-bold text-[#94a3b8]">No stock movements for this item.</td></tr>
                    ) : filteredMovements.map((row) => (
                      <tr key={row.id} className="border-t border-[#eef2f7]">
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#111827]">
                            <span className={cx('size-2 rounded-full', movementDot(row.movement_type))} />
                            {movementLabel(row.movement_type)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[12px] font-semibold text-[#64748b]">{row.reference_no || '—'}</td>
                        <td className="px-4 py-3 text-[13px] font-semibold text-[#111827]">{row.reference || row.reference_type || '—'}</td>
                        <td className="px-4 py-3 text-[12px] font-semibold text-[#64748b]">{formatDate(row.created_at)}</td>
                        <td className="px-4 py-3 text-[13px] font-bold text-[#111827]">
                          {fmtQty(row.quantity)} {selectedItem.unit || 'Nos'}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-semibold text-[#111827]">{fmtRs(row.rate)}</td>
                        <td className="px-4 py-3">
                          <span className="text-[12px] font-extrabold text-[#16a34a]">Posted</span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => onEditItem?.(selectedItem)}
                            className="grid size-8 place-items-center rounded-[8px] text-[#94a3b8] hover:bg-[#f8fafc]"
                            aria-label="Item actions"
                          >
                            <MoreVertical className="size-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
      </div>

      {bulkMode === 'inactive' ? (
        <BulkItemsModal
          title="Bulk Inactive"
          infoText="Showing only active items"
          confirmLabel="Mark as Inactive"
          items={activeItems}
          loading={loading}
          confirming={bulkBusy}
          showSoldColumn
          onClose={() => setBulkMode(null)}
          onConfirm={(ids) => runBulkActiveState(ids, false)}
        />
      ) : null}
      {bulkMode === 'active' ? (
        <BulkItemsModal
          title="Bulk Active"
          infoText="Showing only inactive items"
          confirmLabel="Mark as Active"
          items={inactiveItems}
          loading={loading}
          confirming={bulkBusy}
          onClose={() => setBulkMode(null)}
          onConfirm={(ids) => runBulkActiveState(ids, true)}
        />
      ) : null}
      {bulkMode === 'code' ? (
        <BulkItemsModal
          title="Bulk Assign Code"
          infoText="Showing items that don't have item code"
          confirmLabel="Assign Code"
          items={noCodeItems}
          loading={loading}
          confirming={bulkBusy}
          onClose={() => setBulkMode(null)}
          onConfirm={runBulkAssignCode}
        />
      ) : null}
    </div>
  );
}
