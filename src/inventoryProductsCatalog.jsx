import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  ChevronDown,
  Download,
  Eye,
  LayoutGrid,
  List,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  IndianRupee,
} from 'lucide-react';
import { TablePagination, usePagedRows } from './components/TablePagination.jsx';
import { exportNotifyCsv } from './lib/utils.js';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function fmtRs(value) {
  const amount = Number(value || 0);
  return `₹ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtQty(value) {
  const qty = Number(value || 0);
  if (Number.isInteger(qty)) return qty.toLocaleString('en-IN');
  return qty.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function stockStatusOf(item) {
  const qty = Number(item?.current_stock || 0);
  const min = Number(item?.minimum_stock || 0);
  if (qty <= 0) return 'Out of Stock';
  if (min > 0 && qty <= min) return 'Low Stock';
  return 'In Stock';
}

function categoryBadgeClass(category) {
  const map = {
    Electrical: 'bg-[#e8f8ee] text-[#15803d]',
    Other: 'bg-[#f3e8ff] text-[#7c3aed]',
    Inverter: 'bg-[#e0f2fe] text-[#0369a1]',
    Invertor: 'bg-[#e0f2fe] text-[#0369a1]',
    'Solar Panel': 'bg-[#ccfbf1] text-[#0f766e]',
    Panel: 'bg-[#ccfbf1] text-[#0f766e]',
    Structure: 'bg-[#fff7ed] text-[#c2410c]',
    Hardware: 'bg-[#fef3c7] text-[#b45309]',
    'ACDB/DCDB': 'bg-[#eef2ff] text-[#4338ca]',
    'Cable & Wire': 'bg-[#fce7f3] text-[#be185d]',
    Cable: 'bg-[#fce7f3] text-[#be185d]',
    Battery: 'bg-[#f1f5f9] text-[#475569]',
  };
  return map[category] || 'bg-[#f1f5f9] text-[#475569]';
}

function productThumb(name = '') {
  const letter = String(name || 'P').trim().charAt(0).toUpperCase() || 'P';
  const hues = ['#dcfce7', '#dbeafe', '#fce7f3', '#ffedd5', '#e0e7ff', '#ccfbf1'];
  const bg = hues[letter.charCodeAt(0) % hues.length];
  return { letter, bg };
}

function StatusPill({ status }) {
  if (status === 'Low Stock') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff7ed] px-2.5 py-1 text-[11px] font-extrabold text-[#c2410c]">
        <span className="size-1.5 rounded-full bg-[#f97316]" />
        Low Stock
      </span>
    );
  }
  if (status === 'Out of Stock') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fef2f2] px-2.5 py-1 text-[11px] font-extrabold text-[#dc2626]">
        <span className="size-1.5 rounded-full bg-[#ef4444]" />
        Out of Stock
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ecfdf5] px-2.5 py-1 text-[11px] font-extrabold text-[#15803d]">
      <span className="size-1.5 rounded-full bg-[#22c55e]" />
      In Stock
    </span>
  );
}

/**
 * Inventory → Products catalog UI (mockup-aligned table + KPI strip).
 */
export function InventoryProductsCatalog({
  items = [],
  categories = [],
  loading = false,
  caps = {},
  onAddItem,
  onEditItem,
  onViewItem,
  onDeleteItem,
  onAdjustStock,
  onNotify,
}) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [selected, setSelected] = useState(() => new Set());
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef(null);

  useEffect(() => {
    if (!addMenuOpen) return undefined;
    const onPointerDown = (event) => {
      if (!(event.target instanceof Element)) return;
      if (!addMenuRef.current?.contains(event.target)) setAddMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [addMenuOpen]);

  const activeItems = useMemo(() => items.filter((item) => item.is_active !== false), [items]);

  const categoryNames = useMemo(() => {
    const fromCats = categories.map((c) => (typeof c === 'string' ? c : c.name)).filter(Boolean);
    const fromItems = activeItems.map((i) => i.category).filter(Boolean);
    return [...new Set([...fromCats, ...fromItems])].sort((a, b) => a.localeCompare(b));
  }, [categories, activeItems]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeItems.filter((item) => {
      if (categoryFilter && item.category !== categoryFilter) return false;
      const status = stockStatusOf(item);
      if (statusFilter && status !== statusFilter) return false;
      if (!q) return true;
      return [item.name, item.item_code, item.category].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [activeItems, search, categoryFilter, statusFilter]);

  const resetKey = `${search}|${categoryFilter}|${statusFilter}`;
  const { pageRows, pagination } = usePagedRows(filtered, 'inventory-products-catalog', {
    defaultSize: 10,
    resetKey,
  });

  const kpis = useMemo(() => {
    const totalQty = activeItems.reduce((sum, item) => sum + Number(item.current_stock || 0), 0);
    const totalValue = activeItems.reduce(
      (sum, item) => sum + Number(item.current_stock || 0) * Number(item.rate || 0),
      0,
    );
    const lowStock = activeItems.filter((item) => stockStatusOf(item) === 'Low Stock' || stockStatusOf(item) === 'Out of Stock').length;
    return {
      totalProducts: activeItems.length,
      totalQty,
      totalValue,
      lowStock,
    };
  }, [activeItems]);

  const pageIds = pageRows.map((r) => r.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const toggleAllPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const kpiCards = [
    {
      label: 'Total Products',
      value: fmtQty(kpis.totalProducts),
      icon: Package,
      wrap: 'border-[#bbf7d0] bg-gradient-to-br from-[#f0fdf4] to-white',
      iconWrap: 'bg-[#dcfce7] text-[#15803d]',
      valueClass: 'text-[#166534]',
    },
    {
      label: 'Total Stock (Qty)',
      value: fmtQty(kpis.totalQty),
      icon: Boxes,
      wrap: 'border-[#bfdbfe] bg-gradient-to-br from-[#eff6ff] to-white',
      iconWrap: 'bg-[#dbeafe] text-[#1d4ed8]',
      valueClass: 'text-[#1e3a8a]',
    },
    {
      label: 'Stock Value',
      value: fmtRs(kpis.totalValue),
      icon: IndianRupee,
      wrap: 'border-[#e9d5ff] bg-gradient-to-br from-[#faf5ff] to-white',
      iconWrap: 'bg-[#f3e8ff] text-[#7c3aed]',
      valueClass: 'text-[#6b21a8]',
    },
    {
      label: 'Low Stock Items',
      value: fmtQty(kpis.lowStock),
      icon: AlertTriangle,
      wrap: 'border-[#fed7aa] bg-gradient-to-br from-[#fff7ed] to-white',
      iconWrap: 'bg-[#ffedd5] text-[#c2410c]',
      valueClass: 'text-[#9a3412]',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={cx('rounded-[14px] border p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]', card.wrap)}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-bold text-[#64748b]">{card.label}</p>
                  <p className={cx('mt-1 text-[22px] font-extrabold tabular-nums', card.valueClass)}>{card.value}</p>
                </div>
                <span className={cx('grid size-10 place-items-center rounded-[12px]', card.iconWrap)}>
                  <Icon className="size-5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-[16px] border border-[#e2e8f0] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-3 border-b border-[#eef2f7] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {caps.add ? (
              <div className="relative" ref={addMenuRef}>
                <div className="flex overflow-hidden rounded-[10px] shadow-[0_8px_18px_rgba(22,163,74,0.22)]">
                  <button
                    type="button"
                    onClick={onAddItem}
                    className="inline-flex h-10 items-center gap-1.5 bg-[#16a34a] px-4 text-[13px] font-extrabold text-white hover:bg-[#15803d]"
                  >
                    <Plus className="size-4" />
                    Add Product
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddMenuOpen((v) => !v)}
                    className="grid h-10 w-10 place-items-center border-l border-green-500/40 bg-[#16a34a] text-white hover:bg-[#15803d]"
                    aria-label="More add actions"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                </div>
                {addMenuOpen ? (
                  <div className="absolute left-0 z-20 mt-2 w-[200px] overflow-hidden rounded-[10px] border border-[#e5e7eb] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.16)]">
                    <button
                      type="button"
                      onClick={() => { setAddMenuOpen(false); onAddItem?.(); }}
                      className="flex w-full px-3 py-2.5 text-left text-[13px] font-semibold text-[#111827] hover:bg-[#f8fafc]"
                    >
                      Add single product
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {caps.edit ? (
              <button
                type="button"
                onClick={() => onAdjustStock?.()}
                className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[#dbe3ee] bg-white px-4 text-[13px] font-extrabold text-[#1e3261] hover:bg-[#f8fafc]"
              >
                <RefreshCw className="size-3.5" />
                Adjust Stock
              </button>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
            <label className="flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-[10px] border border-[#dbe3ee] bg-[#f8fafc] px-3 lg:max-w-[280px]">
              <Search className="size-4 shrink-0 text-[#94a3b8]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products by name, code..."
                className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
              />
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-10 rounded-[10px] border border-[#dbe3ee] bg-white px-3 text-[12px] font-bold text-[#334155]"
            >
              <option value="">All Categories</option>
              {categoryNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-[10px] border border-[#dbe3ee] bg-white px-3 text-[12px] font-bold text-[#334155]"
            >
              <option value="">All</option>
              <option value="In Stock">In Stock</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>
            <button
              type="button"
              className="grid size-10 place-items-center rounded-[10px] border border-[#dbe3ee] text-[#64748b] hover:bg-[#f8fafc]"
              aria-label="Filters"
              title="Filters"
            >
              <SlidersHorizontal className="size-4" />
            </button>
            <div className="inline-flex overflow-hidden rounded-[10px] border border-[#dbe3ee]">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={cx('grid size-10 place-items-center', viewMode === 'list' ? 'bg-[#16a34a] text-white' : 'bg-white text-[#64748b]')}
                aria-label="List view"
              >
                <List className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={cx('grid size-10 place-items-center border-l border-[#dbe3ee]', viewMode === 'grid' ? 'bg-[#16a34a] text-white' : 'bg-white text-[#64748b]')}
                aria-label="Grid view"
              >
                <LayoutGrid className="size-4" />
              </button>
            </div>
            {caps.export ? (
              <button
                type="button"
                onClick={() => exportNotifyCsv(
                  onNotify,
                  'inventory-products',
                  ['Code', 'Name', 'Category', 'Unit', 'Stock', 'Price', 'Stock Value', 'Status'],
                  filtered.map((r) => [
                    r.item_code,
                    r.name,
                    r.category,
                    r.unit,
                    r.current_stock,
                    r.rate,
                    Number(r.current_stock || 0) * Number(r.rate || 0),
                    stockStatusOf(r),
                  ]),
                )}
                className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[#dbe3ee] bg-white px-3 text-[12px] font-extrabold text-[#1e3261]"
              >
                <Download className="size-3.5" />
                Export
              </button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <p className="px-5 py-16 text-center text-[13px] font-bold text-[#94a3b8]">Loading products…</p>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-16 text-center text-[13px] font-bold text-[#94a3b8]">No products found.</p>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {pageRows.map((row) => {
              const status = stockStatusOf(row);
              const thumb = productThumb(row.name);
              const value = Number(row.current_stock || 0) * Number(row.rate || 0);
              return (
                <div key={row.id} className="rounded-[14px] border border-[#e2e8f0] bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="grid size-12 place-items-center rounded-[12px] text-[16px] font-extrabold text-[#0f172a]" style={{ background: thumb.bg }}>
                      {thumb.letter}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-extrabold text-[#0f172a]">{row.name}</p>
                      <span className={cx('mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold', categoryBadgeClass(row.category))}>
                        {row.category || '—'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[12px] font-bold text-[#64748b]">
                    <span>Stock {fmtQty(row.current_stock)} {row.unit || 'Nos'}</span>
                    <span>{fmtRs(row.rate)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <StatusPill status={status} />
                    <span className="text-[12px] font-extrabold text-[#0f172a]">{fmtRs(value)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-[#f8fafc] text-[11px] font-extrabold uppercase tracking-[0.05em] text-[#64748b]">
                <tr>
                  <th className="px-4 py-3">
                    <input type="checkbox" checked={allPageSelected} onChange={toggleAllPage} className="size-4 accent-[#16a34a]" />
                  </th>
                  <th className="px-3 py-3">Product Name</th>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Unit</th>
                  <th className="px-3 py-3 text-right">Stock Qty</th>
                  <th className="px-3 py-3 text-right">Price/Unit (₹)</th>
                  <th className="px-3 py-3 text-right">Stock Value (₹)</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => {
                  const status = stockStatusOf(row);
                  const thumb = productThumb(row.name);
                  const value = Number(row.current_stock || 0) * Number(row.rate || 0);
                  const qtyTone = status === 'Low Stock' || status === 'Out of Stock' ? 'text-[#ea580c]' : 'text-[#16a34a]';
                  return (
                    <tr key={row.id} className="border-t border-[#eef2f7] hover:bg-[#fafbfc]">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggleOne(row.id)}
                          className="size-4 accent-[#16a34a]"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="grid size-9 shrink-0 place-items-center rounded-[10px] text-[12px] font-extrabold text-[#0f172a]"
                            style={{ background: thumb.bg }}
                          >
                            {thumb.letter}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-extrabold text-[#0f172a]">{row.name}</p>
                            <p className="truncate text-[11px] font-semibold text-[#94a3b8]">{row.item_code || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={cx('inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold', categoryBadgeClass(row.category))}>
                          {row.category || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[13px] font-semibold text-[#334155]">{row.unit || 'Nos'}</td>
                      <td className={cx('px-3 py-3 text-right text-[13px] font-extrabold tabular-nums', qtyTone)}>
                        {fmtQty(row.current_stock)}
                      </td>
                      <td className="px-3 py-3 text-right text-[13px] font-semibold tabular-nums text-[#0f172a]">
                        {Number(row.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-3 text-right text-[13px] font-extrabold tabular-nums text-[#0f172a]">
                        {value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-3"><StatusPill status={status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {caps.edit ? (
                            <button
                              type="button"
                              onClick={() => onEditItem?.(row)}
                              className="grid size-8 place-items-center rounded-[8px] text-[#2563eb] hover:bg-[#eff6ff]"
                              aria-label="Edit"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => onViewItem?.(row)}
                            className="grid size-8 place-items-center rounded-[8px] text-[#2563eb] hover:bg-[#eff6ff]"
                            aria-label="View"
                          >
                            <Eye className="size-3.5" />
                          </button>
                          {caps.delete ? (
                            <button
                              type="button"
                              onClick={() => onDeleteItem?.(row)}
                              className="grid size-8 place-items-center rounded-[8px] text-[#dc2626] hover:bg-[#fef2f2]"
                              aria-label="Delete"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-[#eef2f7] px-2 py-1">
          <TablePagination
            {...pagination}
            noun="products"
            pageSizeOptions={[10, 20, 30, 50, 100]}
          />
        </div>
      </div>
    </div>
  );
}
