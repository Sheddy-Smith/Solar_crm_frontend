import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, Boxes, Eye, LayoutGrid, List, MapPin, Package, Pencil, Plus,
  Search, Trash2, Warehouse,
} from 'lucide-react';
import { inventoryApi } from './api.js';
import { TablePagination, usePagedRows } from './components/TablePagination.jsx';
import { fetchEveryPage } from './lib/listQuery.js';
import { moduleCaps } from './settingsHubPages.jsx';
import {
  InventoryActivePill,
  InventoryBreadcrumbs,
  InventoryHeroBanner,
  InventoryKpiCard,
  InventoryThumb,
  InventoryTypePill,
  INV_KPI_TONES,
  cx,
  fmtInvQty,
} from './inventoryShared.jsx';

const REF_TYPES = ['Manual', 'Purchase Invoice', 'Purchase Challan', 'Sell Challan', 'Jobs', 'Opening Stock'];

function normalizeRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function OpsModal({ title, subtitle, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-3 sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-[640px] flex-col overflow-hidden rounded-[16px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.35)]">
        <div className="flex items-start justify-between gap-3 bg-[#166534] px-5 py-4 text-white">
          <div>
            <h3 className="text-[17px] font-extrabold">{title}</h3>
            {subtitle ? <p className="text-[12px] font-semibold text-white/80">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-full hover:bg-white/10" aria-label="Close">✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-[#eef2f7] px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

function fieldClass() {
  return 'mt-1 h-11 w-full rounded-[10px] border border-[#dbe3ee] px-3 text-[13px] font-semibold text-[#0f172a] outline-none focus:border-[#16a34a]';
}

/** Stock (Inward) + Stock Movement (Outward) catalog pages */
export function InventoryMovementsPage({
  movementType = 'Inward',
  activeSection,
  onOpenSection,
  onNotify,
  loggedInUser = null,
  Subnav,
  DashboardFooter,
}) {
  const caps = moduleCaps(loggedInUser, 'Inventory');
  const isInward = movementType === 'Inward';
  const pageTitle = isInward ? 'Stock' : 'Stock Movement';
  const pageSubtitle = isInward
    ? 'Record stock inward (purchases, returns, opening stock).'
    : 'Record stock outward (issues, sales, site consumption).';

  const [rows, setRows] = useState([]);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchEveryPage((page, pageSize) => inventoryApi.movements.list({
        page, page_size: pageSize, movement_type: movementType, ordering: '-created_at',
      })).catch(() => []),
      inventoryApi.items.list({ page_size: 200 }).catch(() => ({ results: [] })),
      inventoryApi.warehouses.list({ page_size: 100 }).catch(() => ({ results: [] })),
    ])
      .then(([movements, itemData, whData]) => {
        setRows(Array.isArray(movements) ? movements : normalizeRows(movements));
        setItems(normalizeRows(itemData).filter((i) => i.is_active !== false));
        setWarehouses(normalizeRows(whData).filter((w) => w.is_active !== false));
      })
      .catch((e) => onNotify?.(e.message || 'Failed to load movements', 'error'))
      .finally(() => setLoading(false));
  }, [movementType, onNotify]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [
      r.record_no, r.item_name, r.reference, r.reference_no, r.reference_type, r.notes,
      r.from_warehouse_name, r.to_warehouse_name,
    ].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [rows, search]);

  const { pageRows, startIndex, pagination } = usePagedRows(filtered, `inv-mov-${movementType}`, {
    defaultSize: 10,
    resetKey: search,
  });

  const kpis = useMemo(() => {
    const totalQty = rows.reduce((s, r) => s + Number(r.quantity || 0), 0);
    const today = new Date().toDateString();
    const todayCount = rows.filter((r) => r.created_at && new Date(r.created_at).toDateString() === today).length;
    const uniqueItems = new Set(rows.map((r) => r.item || r.item_name)).size;
    return { total: rows.length, totalQty, todayCount, uniqueItems };
  }, [rows]);

  const emptyForm = {
    item: '',
    quantity: '',
    rate: '',
    from_warehouse: '',
    to_warehouse: '',
    reference_type: 'Manual',
    reference_no: '',
    notes: '',
  };

  const save = async () => {
    const f = modal?.form || {};
    if (!f.item) { onNotify?.('Select a product', 'error'); return; }
    if (!f.quantity || Number(f.quantity) <= 0) { onNotify?.('Quantity required', 'error'); return; }
    if (isInward && !f.to_warehouse) { onNotify?.('Select To Warehouse', 'error'); return; }
    if (!isInward && !f.from_warehouse) { onNotify?.('Select From Warehouse', 'error'); return; }
    setSaving(true);
    try {
      const body = {
        item: f.item,
        movement_type: movementType,
        quantity: Number(f.quantity),
        rate: f.rate === '' || f.rate == null ? 0 : Number(f.rate),
        reference_type: f.reference_type || 'Manual',
        reference_no: f.reference_no || '',
        reference: f.reference_no || '',
        notes: f.notes || '',
        ...(isInward ? { to_warehouse: f.to_warehouse } : { from_warehouse: f.from_warehouse }),
      };
      if (modal.editId) await inventoryApi.movements.update(modal.editId, body);
      else await inventoryApi.movements.create(body);
      onNotify?.(modal.editId ? 'Movement updated' : 'Movement recorded', 'success');
      setModal(null);
      load();
    } catch (e) {
      onNotify?.(e.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeRow = (r) => {
    if (!window.confirm(`Delete movement ${r.record_no || r.id}?`)) return;
    inventoryApi.movements.delete(r.id).then(load).catch((e) => onNotify?.(e.message, 'error'));
  };

  const kpiCards = [
    { label: isInward ? 'Total Stock In' : 'Total Stock Out', value: fmtInvQty(kpis.total), icon: isInward ? ArrowDownLeft : ArrowUpRight, tone: isInward ? 'green' : 'red' },
    { label: 'Total Quantity', value: fmtInvQty(kpis.totalQty), icon: Package, tone: 'blue' },
    { label: 'Today', value: fmtInvQty(kpis.todayCount), icon: Boxes, tone: 'purple' },
    { label: 'Unique Products', value: fmtInvQty(kpis.uniqueItems), icon: Warehouse, tone: 'amber' },
  ];

  return (
    <div className="space-y-4">
      <div className="px-0.5">
        <InventoryBreadcrumbs onOpenSection={onOpenSection} current={pageTitle} />
      </div>
      <InventoryHeroBanner title={pageTitle} subtitle={pageSubtitle} />
      <Subnav activeSection={activeSection} onOpenSection={onOpenSection} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => {
          const tone = INV_KPI_TONES[card.tone] || INV_KPI_TONES.green;
          return (
            <InventoryKpiCard
              key={card.label}
              label={card.label}
              value={card.value}
              icon={card.icon}
              wrap={tone.wrap}
              iconWrap={tone.iconWrap}
              valueClass={tone.valueClass}
            />
          );
        })}
      </div>

      <div className="overflow-hidden rounded-[16px] border border-[#e2e8f0] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-3 border-b border-[#eef2f7] p-4 lg:flex-row lg:items-center lg:justify-between">
          {caps.add ? (
            <button
              type="button"
              onClick={() => setModal({ form: { ...emptyForm } })}
              className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-[#16a34a] px-4 text-[13px] font-extrabold text-white shadow-[0_8px_18px_rgba(22,163,74,0.22)] hover:bg-[#15803d]"
            >
              <Plus className="size-4" />
              {isInward ? 'New Stock In' : 'New Stock Out'}
            </button>
          ) : <span />}
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
            <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-[10px] border border-[#dbe3ee] bg-[#f8fafc] px-3 lg:max-w-[320px]">
              <Search className="size-4 shrink-0 text-[#94a3b8]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by product, ref, warehouse..."
                className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold outline-none placeholder:text-[#94a3b8]"
              />
            </label>
            <div className="inline-flex overflow-hidden rounded-[10px] border border-[#dbe3ee]">
              <button type="button" onClick={() => setViewMode('list')} className={cx('grid size-10 place-items-center', viewMode === 'list' ? 'bg-[#16a34a] text-white' : 'bg-white text-[#64748b]')} aria-label="List view"><List className="size-4" /></button>
              <button type="button" onClick={() => setViewMode('grid')} className={cx('grid size-10 place-items-center border-l border-[#dbe3ee]', viewMode === 'grid' ? 'bg-[#16a34a] text-white' : 'bg-white text-[#64748b]')} aria-label="Grid view"><LayoutGrid className="size-4" /></button>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="px-5 py-16 text-center text-[13px] font-bold text-[#94a3b8]">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-16 text-center text-[13px] font-bold text-[#94a3b8]">No movements found.</p>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {pageRows.map((r) => (
              <div key={r.id} className="rounded-[14px] border border-[#e2e8f0] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <InventoryThumb name={r.item_name} />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-extrabold text-[#0f172a]">{r.item_name || '—'}</p>
                      <p className="text-[11px] font-semibold text-[#94a3b8]">{r.record_no || '—'}</p>
                    </div>
                  </div>
                  <InventoryTypePill type={movementType} />
                </div>
                <p className="mt-3 text-[12px] font-semibold text-[#64748b]">
                  Qty <span className="font-extrabold text-[#0f172a]">{fmtInvQty(r.quantity)}</span>
                  {' · '}
                  {isInward ? (r.to_warehouse_name || '—') : (r.from_warehouse_name || '—')}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-[#94a3b8]">{formatDate(r.created_at)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-[#f8fafc] text-[11px] font-extrabold uppercase tracking-[0.05em] text-[#64748b]">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-3 py-3">Ref No</th>
                  <th className="px-3 py-3">Product</th>
                  <th className="px-3 py-3 text-right">Qty</th>
                  <th className="px-3 py-3">{isInward ? 'To Warehouse' : 'From Warehouse'}</th>
                  <th className="px-3 py-3">Ref Type</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr key={r.id} className="border-t border-[#eef2f7] hover:bg-[#fafbfc]">
                    <td className="px-4 py-3 text-[13px] font-bold text-[#64748b]">{startIndex + i + 1}</td>
                    <td className="px-3 py-3 text-[13px] font-extrabold text-[#2563eb]">{r.record_no || '—'}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <InventoryThumb name={r.item_name} size="size-8" />
                        <span className="text-[13px] font-extrabold text-[#0f172a]">{r.item_name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-[13px] font-extrabold tabular-nums text-[#0f172a]">{fmtInvQty(r.quantity)}</td>
                    <td className="px-3 py-3 text-[13px] font-semibold text-[#334155]">
                      {isInward ? (r.to_warehouse_name || '—') : (r.from_warehouse_name || '—')}
                    </td>
                    <td className="px-3 py-3 text-[12px] font-semibold text-[#64748b]">{r.reference_type || '—'}</td>
                    <td className="px-3 py-3 text-[12px] font-semibold text-[#64748b]">{formatDate(r.created_at)}</td>
                    <td className="px-3 py-3"><InventoryTypePill type={movementType} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {caps.edit ? (
                          <button
                            type="button"
                            onClick={() => setModal({
                              editId: r.id,
                              form: {
                                item: r.item || '',
                                quantity: r.quantity ?? '',
                                rate: r.rate ?? '',
                                from_warehouse: r.from_warehouse || '',
                                to_warehouse: r.to_warehouse || '',
                                reference_type: r.reference_type || 'Manual',
                                reference_no: r.reference_no || r.reference || '',
                                notes: r.notes || '',
                              },
                            })}
                            className="grid size-8 place-items-center rounded-[8px] text-[#2563eb] hover:bg-[#eff6ff]"
                            aria-label="Edit"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        ) : null}
                        <button type="button" className="grid size-8 place-items-center rounded-[8px] text-[#2563eb] hover:bg-[#eff6ff]" aria-label="View" onClick={() => onNotify?.(r.notes || r.record_no || 'Movement', 'info')}>
                          <Eye className="size-3.5" />
                        </button>
                        {caps.delete ? (
                          <button type="button" onClick={() => removeRow(r)} className="grid size-8 place-items-center rounded-[8px] text-[#dc2626] hover:bg-[#fef2f2]" aria-label="Delete">
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
        )}
        <div className="border-t border-[#eef2f7] px-2 py-1">
          <TablePagination {...pagination} noun="movements" pageSizeOptions={[10, 20, 50, 100]} />
        </div>
      </div>

      <DashboardFooter />

      {modal ? (
        <OpsModal
          title={modal.editId ? `Edit ${pageTitle}` : (isInward ? 'New Stock In' : 'New Stock Out')}
          subtitle="Product, quantity, warehouse and reference details"
          onClose={() => setModal(null)}
          footer={(
            <>
              <button type="button" onClick={() => setModal(null)} className="h-11 rounded-[10px] border border-[#dbe3ee] px-5 text-[13px] font-extrabold text-[#334155]">Cancel</button>
              <button type="button" disabled={saving} onClick={save} className="h-11 rounded-[10px] bg-[#16a34a] px-5 text-[13px] font-extrabold text-white disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[12px] font-extrabold text-[#334155] sm:col-span-2">
              Product *
              <select className={fieldClass()} value={modal.form.item} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, item: e.target.value } }))}>
                <option value="">Select product</option>
                {items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
              </select>
            </label>
            <label className="block text-[12px] font-extrabold text-[#334155]">
              Quantity *
              <input type="number" className={fieldClass()} value={modal.form.quantity} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, quantity: e.target.value } }))} />
            </label>
            <label className="block text-[12px] font-extrabold text-[#334155]">
              Rate (₹)
              <input type="number" className={fieldClass()} value={modal.form.rate} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, rate: e.target.value } }))} />
            </label>
            {isInward ? (
              <label className="block text-[12px] font-extrabold text-[#334155] sm:col-span-2">
                To Warehouse *
                <select className={fieldClass()} value={modal.form.to_warehouse} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, to_warehouse: e.target.value } }))}>
                  <option value="">Select warehouse</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </label>
            ) : (
              <label className="block text-[12px] font-extrabold text-[#334155] sm:col-span-2">
                From Warehouse *
                <select className={fieldClass()} value={modal.form.from_warehouse} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, from_warehouse: e.target.value } }))}>
                  <option value="">Select warehouse</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </label>
            )}
            <label className="block text-[12px] font-extrabold text-[#334155]">
              Reference Type
              <select className={fieldClass()} value={modal.form.reference_type} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, reference_type: e.target.value } }))}>
                {REF_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block text-[12px] font-extrabold text-[#334155]">
              Reference / Challan No
              <input className={fieldClass()} value={modal.form.reference_no} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, reference_no: e.target.value } }))} />
            </label>
            <label className="block text-[12px] font-extrabold text-[#334155] sm:col-span-2">
              Notes
              <textarea rows={3} className="mt-1 w-full rounded-[10px] border border-[#dbe3ee] p-3 text-[13px] font-semibold outline-none" value={modal.form.notes} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, notes: e.target.value } }))} />
            </label>
          </div>
        </OpsModal>
      ) : null}
    </div>
  );
}

export function InventoryWarehousesPage({
  activeSection,
  onOpenSection,
  onNotify,
  loggedInUser = null,
  Subnav,
  DashboardFooter,
}) {
  const caps = moduleCaps(loggedInUser, 'Inventory');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    inventoryApi.warehouses.list({ page_size: 100 })
      .then((d) => setRows(normalizeRows(d)))
      .catch((e) => onNotify?.(e.message || 'Failed to load warehouses', 'error'))
      .finally(() => setLoading(false));
  }, [onNotify]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const active = r.is_active !== false;
      if (statusFilter === 'Active' && !active) return false;
      if (statusFilter === 'Inactive' && active) return false;
      if (!q) return true;
      return [r.name, r.location, r.record_no].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [rows, search, statusFilter]);

  const { pageRows, startIndex, pagination } = usePagedRows(filtered, 'inv-warehouses', {
    defaultSize: 10,
    resetKey: `${search}|${statusFilter}`,
  });

  const kpis = useMemo(() => {
    const active = rows.filter((r) => r.is_active !== false).length;
    return {
      total: rows.length,
      active,
      inactive: rows.length - active,
      withLocation: rows.filter((r) => r.location).length,
    };
  }, [rows]);

  const save = async () => {
    const f = modal?.form || {};
    if (!f.name?.trim()) { onNotify?.('Warehouse name required', 'error'); return; }
    setSaving(true);
    try {
      const body = {
        name: f.name.trim(),
        location: f.location || '',
        is_active: f.is_active !== false && f.is_active !== 'Inactive',
      };
      if (modal.editId) await inventoryApi.warehouses.update(modal.editId, body);
      else await inventoryApi.warehouses.create(body);
      onNotify?.(modal.editId ? 'Warehouse updated' : 'Warehouse created', 'success');
      setModal(null);
      load();
    } catch (e) {
      onNotify?.(e.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeRow = (r) => {
    if (!window.confirm(`Delete warehouse "${r.name}"?`)) return;
    inventoryApi.warehouses.delete(r.id).then(load).catch((e) => onNotify?.(e.message, 'error'));
  };

  const kpiCards = [
    { label: 'Total Warehouses', value: kpis.total, icon: Warehouse, tone: 'green' },
    { label: 'Active', value: kpis.active, icon: Package, tone: 'blue' },
    { label: 'Inactive', value: kpis.inactive, icon: Boxes, tone: 'amber' },
    { label: 'With Location', value: kpis.withLocation, icon: MapPin, tone: 'purple' },
  ];

  return (
    <div className="space-y-4">
      <div className="px-0.5">
        <InventoryBreadcrumbs onOpenSection={onOpenSection} current="Warehouses" />
      </div>
      <InventoryHeroBanner
        title="Warehouses"
        subtitle="Manage warehouse locations used for stock in, stock out and product opening balance."
      />
      <Subnav activeSection={activeSection} onOpenSection={onOpenSection} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => {
          const tone = INV_KPI_TONES[card.tone] || INV_KPI_TONES.green;
          return (
            <InventoryKpiCard
              key={card.label}
              label={card.label}
              value={fmtInvQty(card.value)}
              icon={card.icon}
              wrap={tone.wrap}
              iconWrap={tone.iconWrap}
              valueClass={tone.valueClass}
            />
          );
        })}
      </div>

      <div className="overflow-hidden rounded-[16px] border border-[#e2e8f0] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-3 border-b border-[#eef2f7] p-4 lg:flex-row lg:items-center lg:justify-between">
          {caps.add ? (
            <button
              type="button"
              onClick={() => setModal({ form: { name: '', location: '', is_active: true } })}
              className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-[#16a34a] px-4 text-[13px] font-extrabold text-white shadow-[0_8px_18px_rgba(22,163,74,0.22)] hover:bg-[#15803d]"
            >
              <Plus className="size-4" />
              Add Warehouse
            </button>
          ) : <span />}
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
            <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-[10px] border border-[#dbe3ee] bg-[#f8fafc] px-3 lg:max-w-[320px]">
              <Search className="size-4 shrink-0 text-[#94a3b8]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search warehouses by name or location..."
                className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold outline-none placeholder:text-[#94a3b8]"
              />
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-[10px] border border-[#dbe3ee] bg-white px-3 text-[12px] font-bold text-[#334155]"
            >
              <option value="">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <div className="inline-flex overflow-hidden rounded-[10px] border border-[#dbe3ee]">
              <button type="button" onClick={() => setViewMode('list')} className={cx('grid size-10 place-items-center', viewMode === 'list' ? 'bg-[#16a34a] text-white' : 'bg-white text-[#64748b]')} aria-label="List view"><List className="size-4" /></button>
              <button type="button" onClick={() => setViewMode('grid')} className={cx('grid size-10 place-items-center border-l border-[#dbe3ee]', viewMode === 'grid' ? 'bg-[#16a34a] text-white' : 'bg-white text-[#64748b]')} aria-label="Grid view"><LayoutGrid className="size-4" /></button>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="px-5 py-16 text-center text-[13px] font-bold text-[#94a3b8]">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-16 text-center text-[13px] font-bold text-[#94a3b8]">No warehouses found.</p>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {pageRows.map((r) => (
              <div key={r.id} className="rounded-[14px] border border-[#e2e8f0] p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-11 place-items-center rounded-[12px] bg-[#dcfce7] text-[#166534]">
                    <Warehouse className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-extrabold text-[#0f172a]">{r.name}</p>
                    <p className="text-[11px] font-semibold text-[#94a3b8]">{r.record_no || '—'}</p>
                  </div>
                  <InventoryActivePill active={r.is_active !== false} />
                </div>
                <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#64748b]">
                  <MapPin className="size-3.5" />
                  {r.location || '—'}
                </p>
                <div className="mt-3 flex justify-end gap-1">
                  {caps.edit ? (
                    <button type="button" onClick={() => setModal({ editId: r.id, form: { name: r.name, location: r.location || '', is_active: r.is_active !== false } })} className="grid size-8 place-items-center rounded-[8px] text-[#2563eb] hover:bg-[#eff6ff]"><Pencil className="size-3.5" /></button>
                  ) : null}
                  {caps.delete ? (
                    <button type="button" onClick={() => removeRow(r)} className="grid size-8 place-items-center rounded-[8px] text-[#dc2626] hover:bg-[#fef2f2]"><Trash2 className="size-3.5" /></button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-[#f8fafc] text-[11px] font-extrabold uppercase tracking-[0.05em] text-[#64748b]">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-3 py-3">Code</th>
                  <th className="px-3 py-3">Warehouse Name</th>
                  <th className="px-3 py-3">Location</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr key={r.id} className="border-t border-[#eef2f7] hover:bg-[#fafbfc]">
                    <td className="px-4 py-3 text-[13px] font-bold text-[#64748b]">{startIndex + i + 1}</td>
                    <td className="px-3 py-3 text-[13px] font-extrabold text-[#2563eb]">{r.record_no || '—'}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="grid size-8 place-items-center rounded-[10px] bg-[#dcfce7] text-[#166534]"><Warehouse className="size-3.5" /></span>
                        <span className="text-[13px] font-extrabold text-[#0f172a]">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[13px] font-semibold text-[#53647f]">{r.location || '—'}</td>
                    <td className="px-3 py-3"><InventoryActivePill active={r.is_active !== false} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {caps.edit ? (
                          <button type="button" onClick={() => setModal({ editId: r.id, form: { name: r.name, location: r.location || '', is_active: r.is_active !== false } })} className="grid size-8 place-items-center rounded-[8px] text-[#2563eb] hover:bg-[#eff6ff]"><Pencil className="size-3.5" /></button>
                        ) : null}
                        {caps.delete ? (
                          <button type="button" onClick={() => removeRow(r)} className="grid size-8 place-items-center rounded-[8px] text-[#dc2626] hover:bg-[#fef2f2]"><Trash2 className="size-3.5" /></button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-[#eef2f7] px-2 py-1">
          <TablePagination {...pagination} noun="warehouses" pageSizeOptions={[10, 20, 50, 100]} />
        </div>
      </div>

      <DashboardFooter />

      {modal ? (
        <OpsModal
          title={modal.editId ? 'Edit Warehouse' : 'Add Warehouse'}
          subtitle="Name, location and active status"
          onClose={() => setModal(null)}
          footer={(
            <>
              <button type="button" onClick={() => setModal(null)} className="h-11 rounded-[10px] border border-[#dbe3ee] px-5 text-[13px] font-extrabold text-[#334155]">Cancel</button>
              <button type="button" disabled={saving} onClick={save} className="h-11 rounded-[10px] bg-[#16a34a] px-5 text-[13px] font-extrabold text-white disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        >
          <div className="space-y-3">
            <label className="block text-[12px] font-extrabold text-[#334155]">
              Warehouse Name *
              <input className={fieldClass()} value={modal.form.name} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, name: e.target.value } }))} />
            </label>
            <label className="block text-[12px] font-extrabold text-[#334155]">
              Location
              <input className={fieldClass()} value={modal.form.location} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, location: e.target.value } }))} />
            </label>
            <label className="block text-[12px] font-extrabold text-[#334155]">
              Status
              <select
                className={fieldClass()}
                value={modal.form.is_active === false || modal.form.is_active === 'Inactive' ? 'Inactive' : 'Active'}
                onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, is_active: e.target.value === 'Active' } }))}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </label>
          </div>
        </OpsModal>
      ) : null}
    </div>
  );
}
