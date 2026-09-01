import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Boxes, CheckCircle2, Download, IndianRupee, Pencil, Plus, RefreshCw,
  Search, SlidersHorizontal, Tags, Trash2, Upload, Zap,
} from 'lucide-react';
import { inventoryApi } from './api.js';
import { TableHeaderFilter } from './components/TableHeaderFilter.jsx';
import { exportNotifyCsv } from './lib/utils.js';

const INV_UNITS = ['Nos', 'pcs', 'Meter', 'Kg', 'kg', 'Ltr', 'ltr', 'Roll', 'Set'];
const STRUCTURE_PACK_TYPES = ['Unit', 'Packet', 'Bundels'];
const STOCK_STATUS_OPTIONS = ['All Stock', 'In Stock', 'Low Stock', 'Out of Stock'];
const INVERTOR_TYPES = ['On-Grid', 'Off-Grid', 'Hybrid'];
const PANEL_TYPES = ['DCR Bifacial', 'DCR Topcon', 'NDCR Bifacial', 'NDCR Topcon'];
const BATTERY_TYPES = ['LFP', 'LTB', 'Lead Acid'];
const INVERTOR_UNITS = ['Nos', 'Set', 'kW'];
const FALLBACK_PRODUCT_CATEGORIES = [
  { name: 'Structure', description: 'Mounting structures and packing', form_template: 'Structure' },
  { name: 'Electrical', description: 'Cables, boxes, hardware', form_template: 'Electrical' },
  { name: 'Invertor', description: 'On-grid / off-grid / hybrid', form_template: 'Invertor' },
  { name: 'Panel', description: 'Solar panels / modules', form_template: 'Panel' },
  { name: 'Battery', description: 'Storage batteries', form_template: 'Battery' },
];

const FORM_TEMPLATE_OPTIONS = [
  { value: 'Generic', label: 'Generic (basic + price)' },
  { value: 'Structure', label: 'Structure — Unit / Packet / Bundels' },
  { value: 'Electrical', label: 'Electrical — Unit / Packet / Bundels' },
  { value: 'Invertor', label: 'Invertor — Type / Capacity' },
  { value: 'Panel', label: 'Panel — Type / Wp / Count' },
  { value: 'Battery', label: 'Battery — Type / Capacity' },
  { value: 'Custom', label: 'Custom — pick fields' },
];

const CUSTOM_FIELD_OPTIONS = [
  { key: 'item_code', label: 'Item Code' },
  { key: 'name', label: 'Name' },
  { key: 'unit', label: 'Unit' },
  { key: 'rate', label: 'Unit Price (Material Planning)' },
  { key: 'selling_price', label: 'Selling Price' },
  { key: 'product_type', label: 'Type' },
  { key: 'capacity', label: 'Capacity' },
  { key: 'panel_wp', label: 'Panel Wp' },
  { key: 'panel_count', label: 'Number of Panels' },
  { key: 'initial_stock', label: 'Opening Stock' },
  { key: 'minimum_stock', label: 'Reorder Level' },
  { key: 'warehouse', label: 'Warehouse' },
];

const DEFAULT_CUSTOM_FIELDS = ['item_code', 'name', 'unit', 'rate', 'initial_stock', 'minimum_stock', 'warehouse'];
const LOCAL_FORM_CFG_KEY = 'malwa_inv_category_forms_v1';

function readLocalFormCfg() {
  try { return JSON.parse(localStorage.getItem(LOCAL_FORM_CFG_KEY) || '{}'); } catch { return {}; }
}

function writeLocalFormCfg(map) {
  try { localStorage.setItem(LOCAL_FORM_CFG_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

function mergeCategoryFormConfig(cat) {
  if (!cat) return cat;
  const local = readLocalFormCfg()[cat.name] || {};
  return {
    ...cat,
    form_template: cat.form_template || local.form_template || 'Generic',
    form_fields: (Array.isArray(cat.form_fields) && cat.form_fields.length)
      ? cat.form_fields
      : (local.form_fields || DEFAULT_CUSTOM_FIELDS),
  };
}

/** Map Categories-page names / form_template → product form template. */
function resolveFormTemplate(category, categories = []) {
  const catObj = categories.find((c) => c.name === category);
  const configured = catObj?.form_template;
  if (configured && configured !== 'Custom') return configured;
  if (configured === 'Custom') return 'Custom';
  const n = String(category || '').toLowerCase().trim();
  if (!n) return 'Generic';
  if (n === 'structure' || n.includes('mounting')) return 'Structure';
  if (
    n === 'electrical'
    || n.includes('cable')
    || n.includes('acdb')
    || n.includes('dcdb')
    || n.includes('hardware')
    || n.includes('steel')
    || n.includes('connector')
    || n.includes('earthing')
    || n.includes('consumable')
    || n.includes('safety')
  ) return 'Electrical';
  if (n.includes('invert')) return 'Invertor';
  if (n.includes('panel')) return 'Panel';
  if (n.includes('battery')) return 'Battery';
  return 'Generic';
}

function getCategoryFormFields(category, categories = []) {
  const catObj = categories.find((c) => c.name === category);
  if (catObj?.form_template === 'Custom') {
    const fields = Array.isArray(catObj.form_fields) && catObj.form_fields.length
      ? catObj.form_fields
      : DEFAULT_CUSTOM_FIELDS;
    return fields.includes('rate') ? fields : [...fields, 'rate'];
  }
  return [];
}

function unitsForCategory(category, currentUnit = '') {
  const template = resolveFormTemplate(category);
  let base;
  if (template === 'Invertor') {
    base = [...INVERTOR_UNITS, ...INV_UNITS];
  } else {
    base = [...INV_UNITS, 'Unit', 'Packet', 'Bundels', 'kW'];
  }
  if (currentUnit && !base.includes(currentUnit)) base.push(currentUnit);
  return [...new Set(base)];
}

function defaultsForCategory(category, categories = []) {
  const template = resolveFormTemplate(category, categories);
  const base = {
    item_code: '',
    name: '',
    category,
    unit: 'Nos',
    product_type: '',
    capacity: '',
    panel_wp: '',
    panel_count: '',
    hsn_code: '',
    rate: '',
    selling_price: '',
    initial_stock: '',
    minimum_stock: '',
    location: '',
    warehouse: '',
    is_active: true,
    auto_sell: false,
  };
  if (template === 'Structure' || template === 'Electrical') {
    return { ...base, product_type: 'Unit', unit: 'Unit' };
  }
  if (template === 'Invertor') {
    return { ...base, product_type: 'On-Grid', unit: 'Nos' };
  }
  if (template === 'Panel') {
    return { ...base, product_type: 'DCR Bifacial', unit: 'Nos' };
  }
  if (template === 'Battery') {
    return { ...base, product_type: 'LFP', unit: 'Nos' };
  }
  return base;
}

function Field({ label, children, hint }) {
  return (
    <label className="block text-[12px] font-bold text-[#53647f]">
      {label}
      <div className="mt-1">{children}</div>
      {hint ? <span className="mt-0.5 block text-[11px] font-semibold text-[#7a8fa6]">{hint}</span> : null}
    </label>
  );
}

const inputClass = 'h-10 w-full rounded-[8px] border border-[#d9e2ec] px-3 text-[13px] font-semibold text-[#1e3261] outline-none focus:border-[#0b65e5]';
const selectClass = inputClass;

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

function InvModal({ title, onClose, children, footer, headerRight = null }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-[14px] bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-[#e5eaf2] px-5 py-4">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <h3 className="text-[16px] font-extrabold text-[#1e3261]">{title}</h3>
            {headerRight}
          </div>
          <button type="button" onClick={onClose} className="shrink-0 text-[#53647f]">✕</button>
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
  const onNotifyRef = useRef(onNotify);
  onNotifyRef.current = onNotify;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await inventoryApi.summary();
        if (cancelled) return;
        if (data) setStats(data);
        if (!data?.alerts) {
          const items = normalizeRows(await inventoryApi.items.list({ page_size: 2000 }));
          if (cancelled) return;
          const critical = items.filter((i) => Number(i.current_stock) <= 0);
          const warning = items.filter((i) => Number(i.current_stock) > 0 && Number(i.current_stock) <= Number(i.minimum_stock || 0));
          const stable = items.filter((i) => Number(i.current_stock) > Number(i.minimum_stock || 0));
          const row = (i) => ({
            id: i.id,
            name: i.name,
            item_code: i.item_code || '',
            category: i.category || '',
            current_stock: Number(i.current_stock || 0),
            minimum_stock: Number(i.minimum_stock || 0),
            unit: i.unit || 'Nos',
            warehouse_name: i.warehouse_name || '',
          });
          setStats((prev) => ({
            ...(prev || data || {}),
            alerts: {
              critical: critical.slice(0, 12).map(row),
              warning: warning.slice(0, 12).map(row),
              stable: stable.slice(0, 12).map(row),
              critical_count: critical.length,
              warning_count: warning.length,
              stable_count: stable.length,
            },
          }));
        }
      } catch {
        if (!cancelled) onNotifyRef.current?.('Could not load inventory summary.', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const alerts = stats?.alerts || {};
  const critical = alerts.critical || [];
  const warning = alerts.warning || [];
  const stable = alerts.stable || [];
  const criticalCount = alerts.critical_count ?? critical.length;
  const warningCount = alerts.warning_count ?? warning.length;
  const stableCount = alerts.stable_count ?? stable.length;

  const cards = [
    { label: 'Total Products', value: String(stats?.total_items ?? 0), caption: 'Active SKUs', tone: 'blue', icon: BoxesIcon, onClick: () => onOpenSection('Products') },
    { label: 'High Alert', value: String(criticalCount), caption: 'Out of stock', tone: 'red', icon: AlertIcon, onClick: () => onOpenSection('Stock') },
    { label: 'Alert', value: String(warningCount), caption: 'Below reorder level', tone: 'amber', icon: AlertIcon, onClick: () => onOpenSection('Products') },
    { label: 'Stable', value: String(stableCount), caption: 'Healthy stock', tone: 'green', icon: BoxesIcon, onClick: () => onOpenSection('Products') },
    { label: 'Stock Value', value: fmtInvRs(stats?.total_value), caption: 'At cost price', tone: 'green', icon: RupeeIcon, onClick: () => onOpenSection('Products') },
    { label: 'Total Movements', value: String(stats?.total_movements ?? 0), caption: 'Stock + Movement', tone: 'purple', icon: RefreshIcon, onClick: () => onOpenSection('Stock Movement') },
  ];

  const StockAlertRow = ({ item, level }) => {
    const tone = {
      critical: { border: 'border-[#fecaca] bg-[#fff5f5]', badge: 'bg-[#dc2626] text-white', label: 'High' },
      warning: { border: 'border-[#fde68a] bg-[#fffbeb]', badge: 'bg-[#f59e0b] text-white', label: 'Alert' },
      stable: { border: 'border-[#bbf7d0] bg-[#f0fdf4]', badge: 'bg-[#16a34a] text-white', label: 'Stable' },
    }[level];
    return (
      <div className={cx('flex flex-col gap-2 rounded-[12px] border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between', tone.border)}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[13px] font-extrabold text-[#1e3261]">{item.name}</p>
            <span className={cx('inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide', tone.badge)}>{tone.label}</span>
          </div>
          <p className="mt-0.5 text-[11px] font-semibold text-[#7585a2]">
            {item.item_code || '—'} · {item.category || '—'}
            {item.warehouse_name ? ` · ${item.warehouse_name}` : ''}
          </p>
          <p className="mt-0.5 text-[12px] font-extrabold text-[#1e3261]">
            Stock {item.current_stock} {item.unit}
            {level !== 'stable' ? ` · Reorder ${item.minimum_stock}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenSection(level === 'critical' ? 'Stock' : 'Products')}
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-[10px] border border-[#e2e9f3] bg-white px-3 text-[12px] font-extrabold text-[#1d4ed8]"
        >
          {level === 'critical' ? 'Stock In' : 'View'}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <PageHeading title="Inventory" crumbs={[{ label: 'Dashboard', onClick: () => onOpenSection('Dashboard') }, { label: 'Inventory' }, { label: 'Overview' }]} />
      <Subnav activeSection={activeSection} onOpenSection={onOpenSection} />
      {loading ? (
        <div className={cx(panelClass, 'flex items-center justify-center py-16 text-[14px] text-[#7a8fa6]')}>Loading overview...</div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-3 md:gap-4">
            {cards.map((card) => (
              <button
                key={card.label}
                type="button"
                onClick={card.onClick}
                className={cx(
                  panelClass,
                  'flex min-w-0 flex-col items-start gap-1 p-3 text-left transition active:scale-[0.98]',
                  'md:p-4 md:hover:-translate-y-0.5 md:hover:shadow-lg',
                )}
              >
                <span className={cx('grid size-8 place-items-center rounded-[8px] md:size-10 md:rounded-[10px]', reportKpiToneClasses[card.tone] || reportKpiToneClasses.blue)}>
                  <card.icon className="size-4 md:size-5" />
                </span>
                <div className="min-w-0 w-full">
                  <p className="truncate text-[11px] font-bold text-[#7a8fa6] md:text-[12px]">{card.label}</p>
                  <p className="mt-1 text-[18px] font-extrabold leading-none text-[#1e3261] md:mt-2 md:text-[22px]">{card.value}</p>
                  <p className="mt-1 truncate text-[10px] font-bold text-[#53647f] md:text-[11px]">{card.caption}</p>
                </div>
              </button>
            ))}
          </section>

          <div className="grid gap-4 xl:grid-cols-3">
            <section className={cx('overflow-hidden rounded-[16px] border-2 border-[#ef4444]/50 bg-white shadow-[0_12px_28px_rgba(220,38,38,0.12)]', criticalCount > 0 && 'ring-2 ring-[#fecaca]/90')}>
              <div className="flex items-center justify-between gap-3 border-b border-[#fecaca] bg-[linear-gradient(90deg,#fef2f2_0%,#fff5f5_100%)] px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-10 place-items-center rounded-full bg-[#dc2626] text-white shadow-[0_6px_14px_rgba(220,38,38,0.35)]">
                    <AlertTriangle className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-extrabold text-[#991b1b]">High Alert · Out of Stock</p>
                    <p className="text-[11px] font-semibold text-[#b91c1c]">Restock via Stock</p>
                  </div>
                </div>
                <span className="inline-flex min-w-[36px] items-center justify-center rounded-full bg-[#dc2626] px-2.5 py-1 text-[14px] font-extrabold text-white">{criticalCount}</span>
              </div>
              <div className="space-y-2 p-3.5">
                {!critical.length ? (
                  <p className="rounded-[10px] bg-[#fff5f5] px-3 py-5 text-center text-[12px] font-bold text-[#991b1b]/80">No critical stock. Good.</p>
                ) : critical.map((item) => <StockAlertRow key={item.id} item={item} level="critical" />)}
              </div>
            </section>

            <section className={cx('overflow-hidden rounded-[16px] border-2 border-[#f59e0b]/55 bg-white shadow-[0_12px_28px_rgba(245,158,11,0.12)]', warningCount > 0 && 'ring-2 ring-[#fde68a]/80')}>
              <div className="flex items-center justify-between gap-3 border-b border-[#fde68a] bg-[linear-gradient(90deg,#fff7ed_0%,#fffbeb_100%)] px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-10 place-items-center rounded-full bg-[#f59e0b] text-white shadow-[0_6px_14px_rgba(245,158,11,0.35)]">
                    <Zap className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-extrabold text-[#92400e]">Alert · Low Stock</p>
                    <p className="text-[11px] font-semibold text-[#b45309]">At or below reorder level</p>
                  </div>
                </div>
                <span className="inline-flex min-w-[36px] items-center justify-center rounded-full bg-[#f59e0b] px-2.5 py-1 text-[14px] font-extrabold text-white">{warningCount}</span>
              </div>
              <div className="space-y-2 p-3.5">
                {!warning.length ? (
                  <p className="rounded-[10px] bg-[#fffbeb] px-3 py-5 text-center text-[12px] font-bold text-[#92400e]/80">No low-stock items.</p>
                ) : warning.map((item) => <StockAlertRow key={item.id} item={item} level="warning" />)}
              </div>
            </section>

            <section className={cx('overflow-hidden rounded-[16px] border-2 border-[#16a34a]/45 bg-white shadow-[0_12px_28px_rgba(22,163,74,0.10)]', stableCount > 0 && 'ring-2 ring-[#bbf7d0]/80')}>
              <div className="flex items-center justify-between gap-3 border-b border-[#bbf7d0] bg-[linear-gradient(90deg,#f0fdf4_0%,#ecfdf5_100%)] px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-10 place-items-center rounded-full bg-[#16a34a] text-white shadow-[0_6px_14px_rgba(22,163,74,0.35)]">
                    <CheckCircle2 className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-extrabold text-[#166534]">Stable · Healthy Stock</p>
                    <p className="text-[11px] font-semibold text-[#15803d]">Above reorder level</p>
                  </div>
                </div>
                <span className="inline-flex min-w-[36px] items-center justify-center rounded-full bg-[#16a34a] px-2.5 py-1 text-[14px] font-extrabold text-white">{stableCount}</span>
              </div>
              <div className="space-y-2 p-3.5">
                {!stable.length ? (
                  <p className="rounded-[10px] bg-[#f0fdf4] px-3 py-5 text-center text-[12px] font-bold text-[#166534]/80">No stable stock yet — add products / stock.</p>
                ) : stable.map((item) => <StockAlertRow key={item.id} item={item} level="stable" />)}
              </div>
            </section>
          </div>

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
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: 'Products', section: 'Products', icon: Boxes, tone: 'green' },
              { label: 'Categories', section: 'Categories', icon: Tags, tone: 'amber' },
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
  const onNotifyRef = useRef(onNotify);
  onNotifyRef.current = onNotify;
  const seedAttemptedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback((opts = {}) => {
    const showSpinner = opts.showSpinner !== false;
    if (showSpinner) setLoading(true);
    const itemParams = { page_size: 2000 };
    if (category !== 'All Categories') itemParams.category = category;
    if (stockFilter !== 'All Stock') itemParams.stock_status = stockFilter;
    if (search.trim()) itemParams.search = search.trim();
    Promise.all([
      inventoryApi.items.list(itemParams),
      inventoryApi.categories.list({ page_size: 500 }).catch(() => ({ results: [] })),
      inventoryApi.warehouses.list({ page_size: 200 }).catch(() => ({ results: [] })),
    ]).then(async ([items, cats, wh]) => {
      let catRows = normalizeRows(cats).filter((c) => c.is_active !== false).map(mergeCategoryFormConfig);
      // Seed defaults once — view-only roles (Sales Executive) cannot create; use local fallbacks.
      if (!catRows.length && !seedAttemptedRef.current) {
        seedAttemptedRef.current = true;
        const created = await Promise.all(
          FALLBACK_PRODUCT_CATEGORIES.map((c) =>
            inventoryApi.categories.create({
              name: c.name,
              description: c.description,
              is_active: true,
              form_template: c.form_template,
              form_fields: DEFAULT_CUSTOM_FIELDS,
            }).catch(() => null),
          ),
        );
        if (created.some(Boolean)) {
          catRows = normalizeRows(await inventoryApi.categories.list({ page_size: 500 }).catch(() => ({ results: [] })))
            .filter((c) => c.is_active !== false)
            .map(mergeCategoryFormConfig);
        }
      }
      if (!catRows.length) {
        catRows = FALLBACK_PRODUCT_CATEGORIES.map((c, i) => mergeCategoryFormConfig({
          id: `local-${i}`,
          name: c.name,
          description: c.description,
          is_active: true,
          form_template: c.form_template,
          form_fields: DEFAULT_CUSTOM_FIELDS,
        }));
      }
      setRows(normalizeRows(items));
      setCategories(catRows);
      setWarehouses(normalizeRows(wh));
    }).catch((e) => onNotifyRef.current?.(e.message || 'Failed to load products', 'error'))
      .finally(() => setLoading(false));
  }, [category, stockFilter, search]);

  useEffect(() => { load(); }, [load]);

  const filtered = rows;

  const patchForm = (patch) => setModal((m) => ({ ...m, form: { ...m.form, ...patch } }));

  const saveProduct = async () => {
    if (!modal?.form.name?.trim()) { onNotify('Product name is required', 'error'); return; }
    const f = modal.form;
    if (f.rate === '' || f.rate == null || Number(f.rate) < 0) {
      onNotify('Unit Price required — Material Planning isse calculate karega', 'error');
      return;
    }
    if (!modal.editId && f.initial_stock !== '' && Number(f.initial_stock) > 0 && !f.warehouse) {
      onNotify('Select a warehouse for opening stock.', 'error');
      return;
    }
    setSaving(true);
    try {
      const cat = f.category || defaultCategoryName || 'Other';
      const template = resolveFormTemplate(cat);
      const body = {
        item_code: f.item_code || undefined,
        name: f.name,
        category: cat,
        unit: f.unit || 'Nos',
        product_type: f.product_type || '',
        capacity: f.capacity || '',
        panel_wp: f.panel_wp === '' || f.panel_wp == null ? null : Number(f.panel_wp),
        panel_count: f.panel_count === '' || f.panel_count == null ? null : Number(f.panel_count),
        hsn_code: f.hsn_code || '',
        rate: f.rate === '' || f.rate == null ? 0 : Number(f.rate),
        selling_price: f.selling_price === '' || f.selling_price == null ? 0 : Number(f.selling_price),
        minimum_stock: f.minimum_stock === '' ? 0 : Number(f.minimum_stock),
        location: f.location || '',
        warehouse: f.warehouse || null,
        is_active: f.is_active !== false,
      };
      if ((template === 'Panel' || template === 'Battery') && !body.unit) body.unit = 'Nos';
      if (!modal.editId && f.initial_stock !== '') body.initial_stock = Number(f.initial_stock) || 0;
      if (modal.editId) await inventoryApi.items.update(modal.editId, body);
      else await inventoryApi.items.create(body);
      onNotify(modal.editId ? 'Product updated' : 'Product created — available in Material Planning', 'success');
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
    const row = rows.find((r) => r.id === adjustItem.id);
    if (!row?.warehouse) {
      onNotify('Assign a warehouse to this product first', 'error');
      return;
    }
    setSaving(true);
    try {
      const qty = Number(adjustItem.quantity);
      const isAdd = adjustItem.direction === 'add';
      await inventoryApi.movements.create({
        item: adjustItem.id,
        movement_type: isAdd ? 'Inward' : 'Outward',
        quantity: qty,
        rate: row.rate || 0,
        ...(isAdd
          ? { to_warehouse: row.warehouse }
          : { from_warehouse: row.warehouse }),
        reference_type: 'Manual',
        notes: adjustItem.notes || (isAdd ? 'Stock received / purchased' : 'Stock removed'),
      });
      onNotify(isAdd ? 'Stock added — product qty updated' : 'Stock Movement added — product qty updated', 'success');
      setAdjustItem(null);
      load();
    } catch (e) {
      onNotify(e.message || 'Adjust failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const activeCategoryNames = categories.filter((c) => c.is_active !== false).map((c) => c.name).filter(Boolean);
  const fallbackNames = FALLBACK_PRODUCT_CATEGORIES.map((c) => c.name);
  const defaultCategoryName = activeCategoryNames[0] || fallbackNames[0] || 'Structure';
  const catOptions = ['All Categories', ...new Set([...activeCategoryNames, ...fallbackNames, ...rows.map((r) => r.category)].filter(Boolean))];
  const modalCategoryOptions = (() => {
    const names = [...(activeCategoryNames.length ? activeCategoryNames : fallbackNames)];
    if (modal?.form?.category && !names.includes(modal.form.category)) names.push(modal.form.category);
    return names;
  })();

  const openAddProduct = () => {
    setModal({ form: { ...defaultsForCategory(defaultCategoryName, categories) } });
  };

  return (
    <div className="space-y-4">
      <PageHeading title="Inventory" crumbs={[{ label: 'Dashboard', onClick: () => onOpenSection('Dashboard') }, { label: 'Inventory' }, { label: 'Products' }]}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => exportNotifyCsv(onNotify, 'inventory-products', ['Code', 'Name', 'Category', 'Stock', 'Unit', 'Valuation'], filtered.map((r) => [r.item_code, r.name, r.category, r.current_stock, r.unit, r.valuation]))} className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-bold text-[#284276]"><Download className="size-4" />Export CSV</button>
            <button type="button" onClick={openAddProduct} className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#0b65e5] px-4 text-[13px] font-extrabold text-white"><Plus className="size-4" />Add Product</button>
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
        </div>
        {loading ? <p className="py-12 text-center text-[#7a8fa6]">Loading...</p> : (
          <div className="overflow-auto rounded-[12px] border border-[#e5eaf2]">
            <table className="w-full min-w-[1000px] text-left text-[13px]">
              <thead><tr className="bg-[#f8fafc] text-[11px] font-extrabold uppercase text-[#7a8fa6]">
                <th className="px-3 py-3">Code</th>
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">
                  <TableHeaderFilter
                    label="Category"
                    value={category}
                    active={category !== 'All Categories'}
                    options={catOptions}
                    onChange={setCategory}
                  />
                </th>
                <th className="px-3 py-3">Stock</th>
                <th className="px-3 py-3">Reorder</th>
                <th className="px-3 py-3">Valuation</th>
                <th className="px-3 py-3">
                  <TableHeaderFilter
                    label="Status"
                    value={stockFilter}
                    active={stockFilter !== 'All Stock'}
                    options={STOCK_STATUS_OPTIONS}
                    onChange={setStockFilter}
                  />
                </th>
                <th className="px-3 py-3">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-[#f8fbff]">
                    <td className="px-3 py-2 font-extrabold text-[#0b65e5]">{r.item_code || r.record_no}</td>
                    <td className="px-3 py-2 font-semibold">{r.name}</td>
                    <td className="px-3 py-2">{r.category}</td>
                    <td className="px-3 py-2">{r.current_stock} {r.unit}</td>
                    <td className="px-3 py-2">{r.minimum_stock}</td>
                    <td className="px-3 py-2">{fmtInvRs(r.valuation)}</td>
                    <td className="px-3 py-2"><InvStatusBadge status={r.stock_status} /></td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          title={r.warehouse ? 'Adjust stock' : 'Assign a warehouse first'}
                          disabled={!r.warehouse}
                          onClick={() => r.warehouse && setAdjustItem({ id: r.id, name: r.name, quantity: '', direction: 'add', notes: '' })}
                          className="grid size-8 place-items-center rounded-[8px] border border-[#d4e4ff] bg-[#f5f9ff] text-[#0b65e5] transition hover:bg-[#e8f1ff] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <SlidersHorizontal className="size-3.5" />
                        </button>
                        <button type="button" onClick={() => setModal({
                          editId: r.id,
                          form: {
                            ...defaultsForCategory(r.category || 'Structure'),
                            ...r,
                            warehouse: r.warehouse || '',
                            rate: r.rate ?? '',
                            selling_price: r.selling_price ?? '',
                            product_type: r.product_type || '',
                            capacity: r.capacity || '',
                            panel_wp: r.panel_wp ?? '',
                            panel_count: r.panel_count ?? '',
                            auto_sell: false,
                            is_active: r.is_active !== false,
                            initial_stock: '',
                          },
                        })} className="grid size-8 place-items-center rounded-[8px] border border-[#e9dffb] bg-[#f8f4ff] text-[#7c3aed]"><Pencil className="size-3.5" /></button>
                        <button type="button" onClick={() => inventoryApi.items.delete(r.id).then(load).catch((e) => onNotify(e.message, 'error'))} className="grid size-8 place-items-center rounded-[8px] border border-[#fecaca] bg-[#fff5f5] text-[#ef4444]"><Trash2 className="size-3.5" /></button>
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
        <InvModal
          title={modal.editId ? `Edit ${modal.form.category || 'Product'}` : `Add ${modal.form.category || 'Product'}`}
          onClose={() => setModal(null)}
          headerRight={(
            <label className="inline-flex items-center gap-2 text-[12px] font-bold text-[#53647f]">
              <span className="shrink-0">Category</span>
              <select
                className="h-9 min-w-[140px] rounded-[8px] border border-[#d9e2ec] bg-white px-2.5 text-[13px] font-semibold text-[#1e3261]"
                value={modal.form.category || defaultCategoryName}
                onChange={(e) => {
                  const nextCategory = e.target.value;
                  setModal((m) => {
                    const next = defaultsForCategory(nextCategory, categories);
                    return {
                      ...m,
                      form: {
                        ...next,
                        item_code: m.form.item_code,
                        name: m.form.name,
                        warehouse: m.form.warehouse,
                        initial_stock: m.form.initial_stock,
                        minimum_stock: m.form.minimum_stock,
                        rate: m.form.rate,
                      },
                    };
                  });
                }}
              >
                {!modalCategoryOptions.length ? <option value="">Add category first</option> : null}
                {modalCategoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          )}
          footer={(
            <>
              <button type="button" onClick={() => setModal(null)} className="rounded-[8px] border px-4 py-2 text-[13px] font-bold">Cancel</button>
              <button type="button" disabled={saving} onClick={saveProduct} className="rounded-[8px] bg-[#0b65e5] px-4 py-2 text-[13px] font-extrabold text-white">{saving ? 'Saving...' : 'Save'}</button>
            </>
          )}
        >
          {(() => {
            const cat = modal.form.category || defaultCategoryName || 'Other';
            const template = resolveFormTemplate(cat, categories);
            const customFields = getCategoryFormFields(cat, categories);
            const f = modal.form;
            const priceField = (
              <Field label="Unit Price (Rs) *" hint="Material Planning me qty × is price se amount banega">
                <input type="number" className={inputClass} value={f.rate ?? ''} onChange={(e) => patchForm({ rate: e.target.value })} />
              </Field>
            );
            const warehouseField = (
              <Field label="Warehouse">
                <select className={selectClass} value={f.warehouse || ''} onChange={(e) => patchForm({ warehouse: e.target.value })}>
                  <option value="">Select...</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </Field>
            );
            const openingField = !modal.editId ? (
              <Field label="Opening Stock" hint="Creates Stock entry + updates product stock">
                <input type="number" className={inputClass} value={f.initial_stock} onChange={(e) => patchForm({ initial_stock: e.target.value })} />
              </Field>
            ) : null;
            const reorderField = (
              <Field label={template === 'Panel' ? 'Reorder Stock' : 'Reorder Level'}>
                <input type="number" className={inputClass} value={f.minimum_stock} onChange={(e) => patchForm({ minimum_stock: e.target.value })} />
              </Field>
            );
            const codeName = (
              <>
                <Field label="Item Code">
                  <input className={inputClass} placeholder="Auto-generated if empty" value={f.item_code || ''} onChange={(e) => patchForm({ item_code: e.target.value })} />
                </Field>
                <Field label="Name *">
                  <input className={inputClass} value={f.name || ''} onChange={(e) => patchForm({ name: e.target.value })} />
                </Field>
              </>
            );

            if (template === 'Custom') {
              const show = (key) => customFields.includes(key);
              return (
                <div className="grid gap-3 sm:grid-cols-2">
                  {show('item_code') || show('name') ? codeName : null}
                  {show('product_type') ? (
                    <Field label="Type">
                      <input className={inputClass} value={f.product_type || ''} onChange={(e) => patchForm({ product_type: e.target.value })} />
                    </Field>
                  ) : null}
                  {show('capacity') ? (
                    <Field label="Capacity">
                      <input className={inputClass} value={f.capacity || ''} onChange={(e) => patchForm({ capacity: e.target.value })} />
                    </Field>
                  ) : null}
                  {show('panel_wp') ? (
                    <Field label="Panel Wp">
                      <input type="number" className={inputClass} value={f.panel_wp ?? ''} onChange={(e) => patchForm({ panel_wp: e.target.value })} />
                    </Field>
                  ) : null}
                  {show('panel_count') ? (
                    <Field label="Number of Panels">
                      <input type="number" className={inputClass} value={f.panel_count ?? ''} onChange={(e) => patchForm({ panel_count: e.target.value })} />
                    </Field>
                  ) : null}
                  {show('unit') ? (
                    <Field label="Unit">
                      <select className={selectClass} value={f.unit || 'Nos'} onChange={(e) => patchForm({ unit: e.target.value })}>
                        {unitsForCategory(cat, f.unit).map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </Field>
                  ) : null}
                  {priceField}
                  {show('selling_price') ? (
                    <Field label="Selling Price">
                      <input type="number" className={inputClass} value={f.selling_price ?? ''} onChange={(e) => patchForm({ selling_price: e.target.value })} />
                    </Field>
                  ) : null}
                  {show('initial_stock') ? openingField : null}
                  {show('minimum_stock') ? reorderField : null}
                  {show('warehouse') ? warehouseField : null}
                </div>
              );
            }

            if (template === 'Invertor') {
              return (
                <div className="grid gap-3 sm:grid-cols-2">
                  {codeName}
                  <Field label="Type">
                    <select className={selectClass} value={f.product_type || 'On-Grid'} onChange={(e) => patchForm({ product_type: e.target.value })}>
                      {INVERTOR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Invertor Capacity">
                    <input className={inputClass} placeholder="e.g. 5 kW" value={f.capacity || ''} onChange={(e) => patchForm({ capacity: e.target.value })} />
                  </Field>
                  <Field label="Unit">
                    <select className={selectClass} value={f.unit || 'Nos'} onChange={(e) => patchForm({ unit: e.target.value })}>
                      {unitsForCategory(cat, f.unit).map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </Field>
                  {priceField}
                  {openingField}
                  {reorderField}
                  {warehouseField}
                </div>
              );
            }

            if (template === 'Panel') {
              return (
                <div className="grid gap-3 sm:grid-cols-2">
                  {codeName}
                  <Field label="Type">
                    <select className={selectClass} value={f.product_type || 'DCR Bifacial'} onChange={(e) => patchForm({ product_type: e.target.value })}>
                      {PANEL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Panel Wp">
                    <input type="number" className={inputClass} placeholder="e.g. 540" value={f.panel_wp ?? ''} onChange={(e) => patchForm({ panel_wp: e.target.value })} />
                  </Field>
                  <Field label="Number of Panels">
                    <input type="number" className={inputClass} value={f.panel_count ?? ''} onChange={(e) => patchForm({ panel_count: e.target.value })} />
                  </Field>
                  {priceField}
                  {openingField}
                  {reorderField}
                  {warehouseField}
                </div>
              );
            }

            if (template === 'Battery') {
              return (
                <div className="grid gap-3 sm:grid-cols-2">
                  {codeName}
                  <Field label="Type">
                    <select className={selectClass} value={f.product_type || 'LFP'} onChange={(e) => patchForm({ product_type: e.target.value })}>
                      {BATTERY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Capacity">
                    <input className={inputClass} placeholder="e.g. 100 Ah" value={f.capacity || ''} onChange={(e) => patchForm({ capacity: e.target.value })} />
                  </Field>
                  {priceField}
                  {openingField}
                  {reorderField}
                  {warehouseField}
                </div>
              );
            }

            if (template === 'Structure' || template === 'Electrical') {
              const packType = STRUCTURE_PACK_TYPES.includes(f.product_type) ? f.product_type : 'Unit';
              return (
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-[12px] font-bold text-[#53647f]">Select option</p>
                    <div className="grid grid-cols-3 gap-2">
                      {STRUCTURE_PACK_TYPES.map((t) => {
                        const active = packType === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => patchForm({ product_type: t, unit: t })}
                            className={`h-11 rounded-[10px] border text-[13px] font-extrabold transition ${
                              active
                                ? 'border-[#0b65e5] bg-[#eff6ff] text-[#0b65e5] shadow-[0_0_0_3px_rgba(11,101,229,0.12)]'
                                : 'border-[#d9e2ec] bg-white text-[#314a79] hover:bg-[#f8fbff]'
                            }`}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="rounded-[12px] border border-[#e7eef7] bg-[#fbfdff] p-3 sm:p-4">
                    <p className="mb-3 text-[13px] font-extrabold text-[#1e3261]">{packType} details</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {codeName}
                      {priceField}
                      {openingField}
                      {reorderField}
                      {warehouseField}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div className="grid gap-3 sm:grid-cols-2">
                {codeName}
                <Field label="Unit">
                  <select className={selectClass} value={f.unit || 'Nos'} onChange={(e) => patchForm({ unit: e.target.value })}>
                    {unitsForCategory(cat, f.unit).map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </Field>
                {priceField}
                <Field label="Selling Price">
                  <input type="number" className={inputClass} value={f.selling_price ?? ''} onChange={(e) => patchForm({ selling_price: e.target.value })} />
                </Field>
                {openingField}
                {reorderField}
                {warehouseField}
              </div>
            );
          })()}
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
            <label className="text-[12px] font-bold">Direction<select className="mt-1 h-10 w-full rounded-[8px] border px-3" value={adjustItem.direction} onChange={(e) => setAdjustItem((a) => ({ ...a, direction: e.target.value }))}><option value="add">Add stock (Stock)</option><option value="remove">Remove stock (Stock Movement)</option></select></label>
            <label className="text-[12px] font-bold">Quantity<input type="number" className="mt-1 h-10 w-full rounded-[8px] border px-3" value={adjustItem.quantity} onChange={(e) => setAdjustItem((a) => ({ ...a, quantity: e.target.value }))} /></label>
            <label className="text-[12px] font-bold">Notes<textarea className="mt-1 w-full rounded-[8px] border p-3" rows={2} value={adjustItem.notes} onChange={(e) => setAdjustItem((a) => ({ ...a, notes: e.target.value }))} /></label>
          </div>
        </InvModal>
      ) : null}
    </div>
  );
}

export function InventoryCategoriesPage({ activeSection, onOpenSection, onNotify, Subnav, panelClass, cx, PageHeading, DashboardFooter }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const onNotifyRef = useRef(onNotify);
  onNotifyRef.current = onNotify;

  const emptyCategoryForm = {
    name: '',
    description: '',
    is_active: true,
    form_template: 'Generic',
    form_fields: [...DEFAULT_CUSTOM_FIELDS],
  };

  const load = useCallback(() => {
    setLoading(true);
    inventoryApi.categories.list({ page_size: 500 })
      .then((d) => setRows(normalizeRows(d).map(mergeCategoryFormConfig)))
      .catch((e) => onNotifyRef.current?.(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleField = (key) => {
    setModal((m) => {
      const current = Array.isArray(m.form.form_fields) ? m.form.form_fields : [...DEFAULT_CUSTOM_FIELDS];
      const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
      if (key === 'rate' && !next.includes('rate')) next.push('rate');
      return { ...m, form: { ...m.form, form_fields: next } };
    });
  };

  const save = async () => {
    if (!modal?.form.name?.trim()) {
      onNotify('Category name is required', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      name: modal.form.name.trim(),
      description: modal.form.description || '',
      is_active: modal.form.is_active !== false,
      form_template: modal.form.form_template || 'Generic',
      form_fields: modal.form.form_template === 'Custom'
        ? (modal.form.form_fields?.includes('rate') ? modal.form.form_fields : [...(modal.form.form_fields || []), 'rate'])
        : [],
    };
    try {
      let saved;
      try {
        if (modal.editId) saved = await inventoryApi.categories.update(modal.editId, payload);
        else saved = await inventoryApi.categories.create(payload);
      } catch {
        const basic = { name: payload.name, description: payload.description, is_active: payload.is_active };
        if (modal.editId) saved = await inventoryApi.categories.update(modal.editId, basic);
        else saved = await inventoryApi.categories.create(basic);
        const cfg = readLocalFormCfg();
        cfg[payload.name] = { form_template: payload.form_template, form_fields: payload.form_fields };
        writeLocalFormCfg(cfg);
      }
      const cfg = readLocalFormCfg();
      cfg[payload.name] = { form_template: payload.form_template, form_fields: payload.form_fields };
      writeLocalFormCfg(cfg);
      onNotify('Category + form design saved', 'success');
      setModal(null);
      load();
      return saved;
    } catch (e) {
      onNotify(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const templateLabel = (value) => FORM_TEMPLATE_OPTIONS.find((o) => o.value === value)?.label || value || 'Generic';

  return (
    <div className="space-y-4">
      <PageHeading title="Inventory" crumbs={[{ label: 'Dashboard', onClick: () => onOpenSection('Dashboard') }, { label: 'Inventory' }, { label: 'Categories' }]}
        actions={<button type="button" onClick={() => setModal({ form: { ...emptyCategoryForm } })} className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#0b65e5] px-4 text-[13px] font-extrabold text-white"><Plus className="size-4" />Add Category</button>}
      />
      <Subnav activeSection={activeSection} onOpenSection={onOpenSection} />
      <div className={cx(panelClass, 'p-4')}>
        <p className="mb-3 text-[12px] font-semibold text-[#7386a3]">
          Har category ka Add Product form alag design karo. Unit Price field har product pe rahega — Material Planning qty × price se amount nikalta hai.
        </p>
        {loading ? <p className="py-10 text-center">Loading...</p> : (
          <div className="overflow-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead>
                <tr className="border-b text-[11px] font-extrabold uppercase text-[#7a8fa6]">
                  <th className="py-2">#</th>
                  <th>Name</th>
                  <th>Form Design</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className="border-b border-[#f1f5f9]">
                    <td className="py-3">{i + 1}</td>
                    <td className="py-3 font-semibold">{r.name}</td>
                    <td className="py-3 text-[#0b65e5] font-bold">{templateLabel(r.form_template)}</td>
                    <td className="py-3 text-[#53647f]">{r.description || '—'}</td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => setModal({
                          editId: r.id,
                          form: {
                            name: r.name,
                            description: r.description || '',
                            is_active: r.is_active !== false,
                            form_template: r.form_template || 'Generic',
                            form_fields: Array.isArray(r.form_fields) && r.form_fields.length ? r.form_fields : [...DEFAULT_CUSTOM_FIELDS],
                          },
                        })}
                        className="mr-2 text-[#0b65e5]"
                      >
                        <Pencil className="size-4 inline" />
                      </button>
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
          </div>
        )}
        <p className="mt-3 text-[12px] font-bold text-[#7a8fa6]">Total {rows.length} categor{rows.length === 1 ? 'y' : 'ies'}</p>
      </div>
      <DashboardFooter />
      {modal ? (
        <InvModal title={modal.editId ? 'Edit Category + Form' : 'Add Category + Form Design'} onClose={() => setModal(null)} footer={(
          <>
            <button type="button" onClick={() => setModal(null)} className="rounded-[8px] border px-4 py-2">Cancel</button>
            <button type="button" disabled={saving} onClick={save} className="rounded-[8px] bg-[#0b65e5] px-4 py-2 font-extrabold text-white">Save</button>
          </>
        )}>
          <div className="space-y-4">
            <label className="block text-[12px] font-bold">Category Name *
              <input className="mt-1 h-10 w-full rounded-[8px] border px-3" value={modal.form.name} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, name: e.target.value } }))} />
            </label>
            <label className="block text-[12px] font-bold">Description
              <textarea className="mt-1 w-full rounded-[8px] border p-3" rows={2} value={modal.form.description} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, description: e.target.value } }))} />
            </label>
            <label className="block text-[12px] font-bold">Add Product form design *
              <select
                className="mt-1 h-10 w-full rounded-[8px] border px-3 text-[13px] font-semibold"
                value={modal.form.form_template || 'Generic'}
                onChange={(e) => setModal((m) => ({
                  ...m,
                  form: {
                    ...m.form,
                    form_template: e.target.value,
                    form_fields: e.target.value === 'Custom'
                      ? (m.form.form_fields?.length ? m.form.form_fields : [...DEFAULT_CUSTOM_FIELDS])
                      : m.form.form_fields,
                  },
                }))}
              >
                {FORM_TEMPLATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            {modal.form.form_template === 'Custom' ? (
              <div className="rounded-[12px] border border-[#e7eef7] bg-[#f8fbff] p-3">
                <p className="mb-2 text-[12px] font-extrabold text-[#1e3261]">Custom form fields</p>
                <p className="mb-3 text-[11px] font-semibold text-[#7386a3]">Unit Price hamesha on rahega (Material Planning ke liye)</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CUSTOM_FIELD_OPTIONS.map((opt) => {
                    const checked = (modal.form.form_fields || []).includes(opt.key) || opt.key === 'rate';
                    const locked = opt.key === 'rate' || opt.key === 'name';
                    return (
                      <label key={opt.key} className="flex items-center gap-2 rounded-[8px] border border-[#e7eef7] bg-white px-3 py-2 text-[12px] font-bold text-[#314a79]">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={locked}
                          onChange={() => toggleField(opt.key)}
                        />
                        {opt.label}{locked ? ' *' : ''}
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-[10px] border border-[#d7f4ea] bg-[#f2fffb] px-3 py-2 text-[12px] font-semibold text-[#0f766e]">
                Is template me built-in fields + <b>Unit Price</b> automatically Add Product form pe dikhenge.
              </div>
            )}
          </div>
        </InvModal>
      ) : null}
    </div>
  );
}
