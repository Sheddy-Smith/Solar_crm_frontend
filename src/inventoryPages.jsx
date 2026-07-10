import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, Boxes, Download, IndianRupee, Pencil, Plus, RefreshCw,
  Search, Trash2, Upload,
} from 'lucide-react';
import { inventoryApi } from './api.js';
import { exportNotifyCsv } from './lib/utils.js';

const INV_UNITS = ['Nos', 'pcs', 'Meter', 'Kg', 'kg', 'Ltr', 'ltr', 'Roll', 'Set'];
const STOCK_STATUS_OPTIONS = ['All Stock', 'In Stock', 'Low Stock', 'Out of Stock'];
const MOVEMENT_TYPES = ['All', 'Inward', 'Outward', 'Transfer', 'Adjustment'];
const REFERENCE_TYPES = ['All', 'Manual', 'Purchase Invoice', 'Purchase Challan', 'Sell Challan', 'Jobs', 'Opening Stock'];

export function fmtInvRs(v) {
  return v != null && v !== '' ? `Rs ${Number(v).toLocaleString('en-IN')}` : '—';
}

function normalizeRows(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

function unitSummary(map = {}) {
  const entries = Object.entries(map).filter(([, v]) => Number(v) > 0);
  if (!entries.length) return '—';
  return entries.map(([u, v]) => `${Number(v).toFixed(2)} ${u}`).join(' · ');
}

function InvStatusBadge({ status }) {
  const cls = {
    'In Stock': 'bg-[#dcfce7] text-[#16a34a]',
    'Low Stock': 'bg-[#fff4df] text-[#d97706]',
    'Out of Stock': 'bg-[#fee2e2] text-[#dc2626]',
    Active: 'bg-[#dcfce7] text-[#16a34a]',
    Inactive: 'bg-[#f1f5f9] text-[#64748b]',
    IN: 'bg-[#dcfce7] text-[#16a34a]',
    OUT: 'bg-[#fee2e2] text-[#dc2626]',
  }[status] ?? 'bg-[#f1f5f9] text-[#64748b]';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold ${cls}`}>{status}</span>;
}

function InvModal({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-[14px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e5eaf2] px-5 py-4">
          <h3 className="text-[16px] font-extrabold text-[#1e3261]">{title}</h3>
          <button type="button" onClick={onClose} className="text-[#53647f]">✕</button>
        </div>
        <div className="p-5">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-[#e5eaf2] px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

export function InventoryOverviewPageEnhanced({ activeSection, onOpenSection, onNotify, Subnav, panelClass, cx, reportKpiToneClasses, DashboardFooter, PageHeading, Boxes: BoxesIcon, AlertTriangle: AlertIcon, IndianRupee: RupeeIcon, Download: DownloadIcon, Upload: UploadIcon, RefreshCw: RefreshIcon, Plus: PlusIcon }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    inventoryApi.summary()
      .then((data) => { if (data) setStats(data); })
      .catch(() => onNotify('Could not load inventory summary.', 'error'))
      .finally(() => setLoading(false));
  }, [onNotify]);

  const cards = [
    { label: 'Total Products', value: String(stats?.total_items ?? 0), caption: 'Active SKUs', tone: 'blue', icon: BoxesIcon, onClick: () => onOpenSection('Products') },
    { label: 'Low Stock', value: String(stats?.low_stock ?? 0), caption: 'Below reorder level', tone: 'amber', icon: AlertIcon, onClick: () => onOpenSection('Products') },
    { label: 'Out of Stock', value: String(stats?.out_of_stock ?? 0), caption: 'Needs restock', tone: 'red', icon: AlertIcon, onClick: () => onOpenSection('Stock Inward') },
    { label: 'Stock Value', value: fmtInvRs(stats?.total_value), caption: 'At cost price', tone: 'green', icon: RupeeIcon, onClick: () => onOpenSection('Products') },
    { label: 'Total Movements', value: String(stats?.total_movements ?? 0), caption: 'All time', tone: 'purple', icon: RefreshIcon, onClick: () => onOpenSection('Stock Movements') },
    { label: 'Stale Stock (15d+)', value: String(stats?.stale_stock_items ?? 0), caption: 'No recent movement', tone: 'red', icon: AlertIcon, onClick: () => onOpenSection('Stock Movements') },
  ];

  return (
    <div className="space-y-4">
      <PageHeading title="Inventory" crumbs={[{ label: 'Dashboard', onClick: () => onOpenSection('Dashboard') }, { label: 'Inventory' }, { label: 'Overview' }]} />
      <Subnav activeSection={activeSection} onOpenSection={onOpenSection} />
      {loading ? (
        <div className={cx(panelClass, 'flex items-center justify-center py-16 text-[14px] text-[#7a8fa6]')}>Loading overview...</div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <button key={card.label} type="button" onClick={card.onClick} className={cx(panelClass, 'p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg')}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-bold text-[#7a8fa6]">{card.label}</p>
                    <p className="mt-2 text-[22px] font-extrabold text-[#1e3261]">{card.value}</p>
                    <p className="mt-1 text-[11px] font-bold text-[#53647f]">{card.caption}</p>
                  </div>
                  <span className={cx('grid size-10 place-items-center rounded-[10px]', reportKpiToneClasses[card.tone] || reportKpiToneClasses.blue)}>
                    <card.icon className="size-5" />
                  </span>
                </div>
              </button>
            ))}
          </section>
          <section className={cx(panelClass, 'p-4')}>
            <h3 className="text-[14px] font-extrabold text-[#1e3261]">Stock by Unit</h3>
            <p className="mt-2 text-[13px] font-bold text-[#53647f]">
              {(stats?.by_unit ?? []).map((r) => `${Number(r.total).toFixed(2)} ${r.unit}`).join(' · ') || 'No stock yet'}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[10px] border border-[#e5eaf2] p-3">
                <p className="text-[11px] font-bold text-[#7a8fa6]">Total Stock IN</p>
                <p className="mt-1 text-[13px] font-extrabold text-[#16a34a]">{unitSummary(stats?.stock_in_by_unit)}</p>
              </div>
              <div className="rounded-[10px] border border-[#e5eaf2] p-3">
                <p className="text-[11px] font-bold text-[#7a8fa6]">Total Stock OUT</p>
                <p className="mt-1 text-[13px] font-extrabold text-[#dc2626]">{unitSummary(stats?.stock_out_by_unit)}</p>
              </div>
            </div>
          </section>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Stock Inward', section: 'Stock Inward', icon: DownloadIcon, tone: 'green' },
              { label: 'Stock Outward', section: 'Stock Outward', icon: UploadIcon, tone: 'red' },
              { label: 'Stock Movements', section: 'Stock Movements', icon: RefreshIcon, tone: 'blue' },
              { label: 'Add Product', section: 'Products', icon: PlusIcon, tone: 'purple' },
            ].map((action) => (
              <button key={action.label} type="button" onClick={() => onOpenSection(action.section)} className={cx(panelClass, 'flex items-center gap-3 p-4 text-left transition hover:bg-[#f8fbff]')}>
                <span className={cx('grid size-10 place-items-center rounded-[10px]', reportKpiToneClasses[action.tone])}><action.icon className="size-5" /></span>
                <span className="text-[14px] font-extrabold text-[#1e3261]">{action.label}</span>
              </button>
            ))}
          </section>
        </>
      )}
      <DashboardFooter />
    </div>
  );
}

export function InventoryProductsPage({ activeSection, onOpenSection, onNotify, Subnav, panelClass, cx, PageHeading, DashboardFooter }) {
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [stockFilter, setStockFilter] = useState('All Stock');
  const [modal, setModal] = useState(null);
  const [adjustItem, setAdjustItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const emptyForm = { item_code: '', name: '', category: 'Other', unit: 'Nos', hsn_code: '', rate: '', selling_price: '', initial_stock: '', minimum_stock: '', location: '', warehouse: '', is_active: true, auto_sell: true };

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(() => {
    setLoading(true);
    const itemParams = { page_size: 2000 };
    if (category !== 'All Categories') itemParams.category = category;
    if (stockFilter !== 'All Stock') itemParams.stock_status = stockFilter;
    if (search.trim()) itemParams.search = search.trim();
    Promise.all([
      inventoryApi.items.list(itemParams),
      inventoryApi.categories.list({ page_size: 500 }),
      inventoryApi.warehouses.list({ page_size: 200 }),
    ]).then(([items, cats, wh]) => {
      setRows(normalizeRows(items));
      setCategories(normalizeRows(cats));
      setWarehouses(normalizeRows(wh));
    }).catch((e) => onNotify(e.message || 'Failed to load products', 'error'))
      .finally(() => setLoading(false));
  }, [onNotify, category, stockFilter, search]);

  useEffect(() => { load(); }, [load]);

  const filtered = rows;

  const saveProduct = async () => {
    if (!modal?.form.name?.trim()) { onNotify('Product name is required', 'error'); return; }
    const f = modal.form;
    if (!modal.editId && f.initial_stock !== '' && Number(f.initial_stock) > 0 && !f.warehouse) {
      onNotify('Select a warehouse for opening stock.', 'error');
      return;
    }
    setSaving(true);
    try {
      const f = modal.form;
      const body = {
        item_code: f.item_code || undefined,
        name: f.name,
        category: f.category,
        unit: f.unit,
        hsn_code: f.hsn_code,
        rate: f.rate === '' ? 0 : Number(f.rate),
        selling_price: f.auto_sell && f.rate ? Number(f.rate) * 1.5 : (f.selling_price === '' ? 0 : Number(f.selling_price)),
        minimum_stock: f.minimum_stock === '' ? 0 : Number(f.minimum_stock),
        location: f.location,
        warehouse: f.warehouse || null,
        is_active: f.is_active !== false,
      };
      if (!modal.editId && f.initial_stock !== '') body.initial_stock = Number(f.initial_stock) || 0;
      if (modal.editId) await inventoryApi.items.update(modal.editId, body);
      else await inventoryApi.items.create(body);
      onNotify(modal.editId ? 'Product updated' : 'Product created', 'success');
      setModal(null);
      load();
    } catch (e) {
      onNotify(e.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveAdjust = async () => {
    if (!adjustItem?.quantity) { onNotify('Quantity required', 'error'); return; }
    setSaving(true);
    try {
      await inventoryApi.items.quickAdjust(adjustItem.id, {
        quantity: Number(adjustItem.quantity),
        direction: adjustItem.direction,
        notes: adjustItem.notes,
      });
      onNotify('Stock adjusted', 'success');
      setAdjustItem(null);
      load();
    } catch (e) {
      onNotify(e.message || 'Adjust failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const catOptions = ['All Categories', ...new Set([...categories.map((c) => c.name), ...rows.map((r) => r.category)].filter(Boolean))];

  return (
    <div className="space-y-4">
      <PageHeading title="Inventory" crumbs={[{ label: 'Dashboard', onClick: () => onOpenSection('Dashboard') }, { label: 'Inventory' }, { label: 'Products' }]}
        actions={(
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => exportNotifyCsv(onNotify, 'inventory-products', ['Code', 'Name', 'Category', 'Stock', 'Unit', 'Cost', 'Selling', 'Valuation'], filtered.map((r) => [r.item_code, r.name, r.category, r.current_stock, r.unit, r.rate, r.selling_price, r.valuation]))} className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-bold text-[#284276]"><Download className="size-4" />Export CSV</button>
            <button type="button" onClick={() => setModal({ form: { ...emptyForm, category: catOptions[1] || 'Other' } })} className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#0b65e5] px-4 text-[13px] font-extrabold text-white"><Plus className="size-4" />Add Product</button>
          </div>
        )}
      />
      <Subnav activeSection={activeSection} onOpenSection={onOpenSection} />
      <div className={cx(panelClass, 'space-y-4 p-4')}>
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7a8fa6]" />
            <input className="h-10 w-full rounded-[8px] border border-[#d9e2ec] pl-9 pr-3 text-[13px]" placeholder="Search by name, code, category..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
          <select className="h-10 rounded-[8px] border border-[#d9e2ec] px-3 text-[13px]" value={category} onChange={(e) => setCategory(e.target.value)}>{catOptions.map((o) => <option key={o}>{o}</option>)}</select>
          <select className="h-10 rounded-[8px] border border-[#d9e2ec] px-3 text-[13px]" value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>{STOCK_STATUS_OPTIONS.map((o) => <option key={o}>{o}</option>)}</select>
        </div>
        {loading ? <p className="py-12 text-center text-[#7a8fa6]">Loading...</p> : (
          <div className="overflow-auto rounded-[12px] border border-[#e5eaf2]">
            <table className="w-full min-w-[1000px] text-left text-[13px]">
              <thead><tr className="bg-[#f8fafc] text-[11px] font-extrabold uppercase text-[#7a8fa6]">
                {['Code', 'Name', 'Category', 'Stock', 'Reorder', 'Cost', 'Selling', 'Valuation', 'Status', 'Actions'].map((h) => <th key={h} className="px-3 py-3">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-[#f8fbff]">
                    <td className="px-3 py-2 font-extrabold text-[#0b65e5]">{r.item_code || r.record_no}</td>
                    <td className="px-3 py-2 font-semibold">{r.name}</td>
                    <td className="px-3 py-2">{r.category}</td>
                    <td className="px-3 py-2">{r.current_stock} {r.unit}</td>
                    <td className="px-3 py-2">{r.minimum_stock}</td>
                    <td className="px-3 py-2">{fmtInvRs(r.rate)}</td>
                    <td className="px-3 py-2">{fmtInvRs(r.selling_price)}</td>
                    <td className="px-3 py-2">{fmtInvRs(r.valuation)}</td>
                    <td className="px-3 py-2"><InvStatusBadge status={r.stock_status} /></td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button type="button" title={r.warehouse ? 'Adjust stock' : 'Assign a warehouse first'} disabled={!r.warehouse} onClick={() => r.warehouse && setAdjustItem({ id: r.id, name: r.name, quantity: '', direction: 'add', notes: '' })} className="rounded-[6px] border px-2 py-1 text-[11px] font-bold text-[#0b65e5] disabled:cursor-not-allowed disabled:opacity-40">Adjust</button>
                        <button type="button" onClick={() => setModal({ editId: r.id, form: { ...r, warehouse: r.warehouse || '', rate: r.rate, selling_price: r.selling_price, auto_sell: false, is_active: r.is_active !== false } })} className="grid size-7 place-items-center rounded-[6px] border"><Pencil className="size-3.5" /></button>
                        <button type="button" onClick={() => inventoryApi.items.delete(r.id).then(load).catch((e) => onNotify(e.message, 'error'))} className="grid size-7 place-items-center rounded-[6px] border text-[#ef4444]"><Trash2 className="size-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length ? <p className="py-10 text-center text-[#7a8fa6]">No products found</p> : null}
          </div>
        )}
      </div>
      <DashboardFooter />

      {modal ? (
        <InvModal title={modal.editId ? 'Edit Product' : 'Add Product'} onClose={() => setModal(null)} footer={(
          <>
            <button type="button" onClick={() => setModal(null)} className="rounded-[8px] border px-4 py-2 text-[13px] font-bold">Cancel</button>
            <button type="button" disabled={saving} onClick={saveProduct} className="rounded-[8px] bg-[#0b65e5] px-4 py-2 text-[13px] font-extrabold text-white">{saving ? 'Saving...' : 'Save'}</button>
          </>
        )}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[12px] font-bold text-[#53647f]">Item Code<input className="mt-1 h-10 w-full rounded-[8px] border px-3" placeholder="Auto-generated if empty" value={modal.form.item_code || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, item_code: e.target.value } }))} /></label>
            <label className="text-[12px] font-bold text-[#53647f]">Name *<input className="mt-1 h-10 w-full rounded-[8px] border px-3" value={modal.form.name || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, name: e.target.value } }))} /></label>
            <label className="text-[12px] font-bold text-[#53647f]">Category<select className="mt-1 h-10 w-full rounded-[8px] border px-3" value={modal.form.category} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, category: e.target.value } }))}>{catOptions.filter((c) => c !== 'All Categories').map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="text-[12px] font-bold text-[#53647f]">Unit<select className="mt-1 h-10 w-full rounded-[8px] border px-3" value={modal.form.unit} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, unit: e.target.value } }))}>{INV_UNITS.map((u) => <option key={u}>{u}</option>)}</select></label>
            {!modal.editId ? <label className="text-[12px] font-bold text-[#53647f]">Opening Stock<input type="number" className="mt-1 h-10 w-full rounded-[8px] border px-3" value={modal.form.initial_stock} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, initial_stock: e.target.value } }))} /><span className="text-[11px] text-[#7a8fa6]">Creates an inward movement record</span></label> : null}
            <label className="text-[12px] font-bold text-[#53647f]">Reorder Level<input type="number" className="mt-1 h-10 w-full rounded-[8px] border px-3" value={modal.form.minimum_stock} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, minimum_stock: e.target.value } }))} /></label>
            <label className="text-[12px] font-bold text-[#53647f]">Location<input className="mt-1 h-10 w-full rounded-[8px] border px-3" value={modal.form.location || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, location: e.target.value } }))} /></label>
            <label className="text-[12px] font-bold text-[#53647f]">Warehouse<select className="mt-1 h-10 w-full rounded-[8px] border px-3" value={modal.form.warehouse || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, warehouse: e.target.value } }))}><option value="">Select...</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
            <label className="text-[12px] font-bold text-[#53647f]">Cost Price<input type="number" className="mt-1 h-10 w-full rounded-[8px] border px-3" value={modal.form.rate} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, rate: e.target.value, selling_price: m.form.auto_sell ? String(Number(e.target.value || 0) * 1.5) : m.form.selling_price } }))} /></label>
            <label className="text-[12px] font-bold text-[#53647f]">Selling Price<label className="ml-2 text-[11px] font-normal"><input type="checkbox" checked={modal.form.auto_sell} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, auto_sell: e.target.checked, selling_price: e.target.checked ? String(Number(m.form.rate || 0) * 1.5) : m.form.selling_price } }))} /> Auto (Cost × 1.5)</label><input type="number" disabled={modal.form.auto_sell} className="mt-1 h-10 w-full rounded-[8px] border px-3" value={modal.form.selling_price} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, selling_price: e.target.value, auto_sell: false } }))} /></label>
            <label className="text-[12px] font-bold text-[#53647f]">HSN<input className="mt-1 h-10 w-full rounded-[8px] border px-3" value={modal.form.hsn_code || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, hsn_code: e.target.value } }))} /></label>
          </div>
        </InvModal>
      ) : null}

      {adjustItem ? (
        <InvModal title={`Adjust — ${adjustItem.name}`} onClose={() => setAdjustItem(null)} footer={(
          <>
            <button type="button" onClick={() => setAdjustItem(null)} className="rounded-[8px] border px-4 py-2 text-[13px] font-bold">Cancel</button>
            <button type="button" disabled={saving} onClick={saveAdjust} className="rounded-[8px] bg-[#16a34a] px-4 py-2 text-[13px] font-extrabold text-white">Apply</button>
          </>
        )}>
          <div className="grid gap-3">
            <label className="text-[12px] font-bold">Direction<select className="mt-1 h-10 w-full rounded-[8px] border px-3" value={adjustItem.direction} onChange={(e) => setAdjustItem((a) => ({ ...a, direction: e.target.value }))}><option value="add">Add stock</option><option value="remove">Remove stock</option></select></label>
            <label className="text-[12px] font-bold">Quantity<input type="number" className="mt-1 h-10 w-full rounded-[8px] border px-3" value={adjustItem.quantity} onChange={(e) => setAdjustItem((a) => ({ ...a, quantity: e.target.value }))} /></label>
            <label className="text-[12px] font-bold">Notes<textarea className="mt-1 w-full rounded-[8px] border p-3" rows={2} value={adjustItem.notes} onChange={(e) => setAdjustItem((a) => ({ ...a, notes: e.target.value }))} /></label>
          </div>
        </InvModal>
      ) : null}
    </div>
  );
}

export function InventoryStockMovementsPage({ activeSection, onOpenSection, onNotify, Subnav, panelClass, cx, PageHeading, DashboardFooter }) {
  const [rows, setRows] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [movementType, setMovementType] = useState('All');
  const [referenceType, setReferenceType] = useState('All');

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(() => {
    setLoading(true);
    const params = { page_size: 2000 };
    if (movementType !== 'All') params.movement_type = movementType;
    if (referenceType !== 'All') params.reference_type = referenceType;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (search.trim()) params.search = search.trim();
    const analyticsParams = {
      search: search.trim() || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      movement_type: movementType,
      reference_type: referenceType,
    };
    Promise.all([
      inventoryApi.movements.list(params),
      inventoryApi.movements.analytics(analyticsParams),
    ]).then(([list, stats]) => {
      setRows(normalizeRows(list));
      setAnalytics(stats);
    }).catch((e) => onNotify(e.message || 'Failed to load movements', 'error'))
      .finally(() => setLoading(false));
  }, [search, dateFrom, dateTo, movementType, referenceType, onNotify]);

  useEffect(() => { load(); }, [load]);

  const filtered = rows;

  const kpi = [
    { label: 'Total Movements', value: String(analytics?.total_movements ?? 0), tone: 'blue' },
    { label: 'Stock IN', value: unitSummary(analytics?.stock_in_by_unit), tone: 'green' },
    { label: 'Stock OUT', value: unitSummary(analytics?.stock_out_by_unit), tone: 'amber' },
    { label: 'Stale IN (15d+)', value: String(analytics?.stale_inward_items ?? 0), tone: 'red' },
  ];

  return (
    <div className="space-y-4">
      <PageHeading title="Inventory" crumbs={[{ label: 'Dashboard', onClick: () => onOpenSection('Dashboard') }, { label: 'Inventory' }, { label: 'Stock Movements' }]}
        actions={<button type="button" onClick={() => exportNotifyCsv(onNotify, 'stock-movements', ['Date', 'Item', 'Category', 'Type', 'Qty', 'Reference', 'Ref No', 'Notes'], filtered.map((r) => [new Date(r.created_at).toLocaleDateString('en-IN'), r.item_name, r.item_category, r.movement_direction, r.quantity, r.reference_type, r.reference_no, r.notes]))} className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-bold"><Download className="size-4" />Export CSV</button>}
      />
      <Subnav activeSection={activeSection} onOpenSection={onOpenSection} />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpi.map((c) => (
          <article key={c.label} className={cx(panelClass, 'p-4')}>
            <p className="text-[12px] font-bold text-[#7a8fa6]">{c.label}</p>
            <p className="mt-2 text-[18px] font-extrabold text-[#1e3261]">{c.value}</p>
          </article>
        ))}
      </section>
      <div className={cx(panelClass, 'space-y-4 p-4')}>
        <div className="flex flex-wrap gap-3">
          <input className="h-10 min-w-[180px] flex-1 rounded-[8px] border px-3 text-[13px]" placeholder="Search item or category..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          <input type="date" className="h-10 rounded-[8px] border px-3 text-[13px]" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <input type="date" className="h-10 rounded-[8px] border px-3 text-[13px]" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <select className="h-10 rounded-[8px] border px-3 text-[13px]" value={movementType} onChange={(e) => setMovementType(e.target.value)}>{MOVEMENT_TYPES.map((o) => <option key={o}>{o}</option>)}</select>
          <select className="h-10 rounded-[8px] border px-3 text-[13px]" value={referenceType} onChange={(e) => setReferenceType(e.target.value)}>{REFERENCE_TYPES.map((o) => <option key={o}>{o}</option>)}</select>
          <button type="button" onClick={load} className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#0b65e5] px-4 text-[13px] font-extrabold text-white"><RefreshCw className="size-4" />Apply</button>
        </div>
        {loading ? <p className="py-12 text-center text-[#7a8fa6]">Loading...</p> : (
          <div className="overflow-auto rounded-[12px] border border-[#e5eaf2]">
            <table className="w-full min-w-[960px] text-left text-[13px]">
              <thead><tr className="bg-[#f8fafc] text-[11px] font-extrabold uppercase text-[#7a8fa6]">
                {['Date', 'Item', 'Category', 'Type', 'Qty', 'Reference', 'Ref No', 'Notes'].map((h) => <th key={h} className="px-3 py-3">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2">{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
                    <td className="px-3 py-2 font-semibold">{r.item_name}</td>
                    <td className="px-3 py-2">{r.item_category || '—'}</td>
                    <td className="px-3 py-2"><InvStatusBadge status={r.movement_direction} /></td>
                    <td className="px-3 py-2">{r.quantity} {r.item_unit}</td>
                    <td className="px-3 py-2">{r.reference_type || r.reference || '—'}</td>
                    <td className="px-3 py-2">{r.reference_no || '—'}</td>
                    <td className="px-3 py-2 max-w-[200px] truncate">{r.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <DashboardFooter />
    </div>
  );
}

export function InventoryCategoriesPage({ activeSection, onOpenSection, onNotify, Subnav, panelClass, cx, PageHeading, DashboardFooter }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    inventoryApi.categories.list({ page_size: 500 })
      .then((d) => setRows(normalizeRows(d)))
      .catch((e) => onNotify(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [onNotify]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!modal?.form.name?.trim()) {
      onNotify('Category name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      if (modal.editId) await inventoryApi.categories.update(modal.editId, modal.form);
      else await inventoryApi.categories.create(modal.form);
      onNotify('Category saved', 'success');
      setModal(null);
      load();
    } catch (e) {
      onNotify(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeading title="Inventory" crumbs={[{ label: 'Dashboard', onClick: () => onOpenSection('Dashboard') }, { label: 'Inventory' }, { label: 'Categories' }]}
        actions={<button type="button" onClick={() => setModal({ form: { name: '', description: '', is_active: true } })} className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#0b65e5] px-4 text-[13px] font-extrabold text-white"><Plus className="size-4" />Add Category</button>}
      />
      <Subnav activeSection={activeSection} onOpenSection={onOpenSection} />
      <div className={cx(panelClass, 'p-4')}>
        {loading ? <p className="py-10 text-center">Loading...</p> : (
          <table className="w-full text-left text-[13px]">
            <thead><tr className="border-b text-[11px] font-extrabold uppercase text-[#7a8fa6]"><th className="py-2">#</th><th>Name</th><th>Description</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-b border-[#f1f5f9]">
                  <td className="py-3">{i + 1}</td>
                  <td className="py-3 font-semibold">{r.name}</td>
                  <td className="py-3 text-[#53647f]">{r.description || '—'}</td>
                  <td className="py-3">
                    <button type="button" onClick={() => setModal({ editId: r.id, form: { name: r.name, description: r.description, is_active: r.is_active } })} className="mr-2 text-[#0b65e5]"><Pencil className="size-4 inline" /></button>
                    <button type="button" onClick={() => {
                      if (!window.confirm(`Delete category "${r.name}"?`)) return;
                      inventoryApi.categories.delete(r.id)
                        .then(load)
                        .catch((e) => onNotify(e.message || 'Delete failed', 'error'));
                    }} className="text-[#ef4444]"><Trash2 className="size-4 inline" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-[12px] font-bold text-[#7a8fa6]">Total {rows.length} categor{rows.length === 1 ? 'y' : 'ies'}</p>
      </div>
      <DashboardFooter />
      {modal ? (
        <InvModal title={modal.editId ? 'Edit Category' : 'Add Category'} onClose={() => setModal(null)} footer={(
          <>
            <button type="button" onClick={() => setModal(null)} className="rounded-[8px] border px-4 py-2">Cancel</button>
            <button type="button" disabled={saving} onClick={save} className="rounded-[8px] bg-[#0b65e5] px-4 py-2 font-extrabold text-white">Save</button>
          </>
        )}>
          <label className="block text-[12px] font-bold">Category Name *<input className="mt-1 h-10 w-full rounded-[8px] border px-3" value={modal.form.name} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, name: e.target.value } }))} /></label>
          <label className="mt-3 block text-[12px] font-bold">Description<textarea className="mt-1 w-full rounded-[8px] border p-3" rows={3} value={modal.form.description} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, description: e.target.value } }))} /></label>
        </InvModal>
      ) : null}
    </div>
  );
}
