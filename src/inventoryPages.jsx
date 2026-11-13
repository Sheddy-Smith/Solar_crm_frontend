import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Boxes, CheckCircle2, Download, FileText, Hash, IndianRupee, Info, LayoutGrid, List,
  Minus, Package, Pencil, Plus, RefreshCw, Search, SlidersHorizontal, Tags, Trash2, Upload, Warehouse, Zap,
} from 'lucide-react';
import { inventoryApi } from './api.js';
import { TablePagination, usePagedRows } from './components/TablePagination.jsx';
import { MobileCardEmpty, MobileCardList, MobileRecordCard } from './components/mobile/MobileRecordCard.jsx';
import { fetchEveryPage, rowsOf } from './lib/listQuery.js';
import { exportNotifyCsv } from './lib/utils.js';
import { moduleCaps } from './settingsHubPages.jsx';
import { InventoryProductsCatalog } from './inventoryProductsCatalog.jsx';
import {
  InventoryBreadcrumbs,
  InventoryHeroBanner,
  InventoryKpiCard,
  INV_KPI_TONES,
} from './inventoryShared.jsx';

const CATEGORY_HINTS = {
  'ACDB/DCDB': 'AC Distribution Box / DC Distribution Box',
  Structure: 'Mounting structures, rails and poles',
  Hardware: 'Fasteners, clamps, bolts and consumables',
  'Cable & Wire': 'AC/DC cables and earthing wires',
  Electrical: 'Lugs, connectors, PVC fittings and accessories',
  'Solar Panel': 'PV modules (DCR / Non-DCR)',
  Inverter: 'Grid-tie and hybrid solar inverters',
  Invertor: 'Grid-tie and hybrid solar inverters',
  Panel: 'PV modules and solar panels',
  Battery: 'Storage batteries',
  Other: 'Civil and miscellaneous materials',
  Cable: 'Cables and wiring',
};

const ADJUST_REASONS = [
  'Purchase',
  'Stock Return',
  'Site Issue',
  'Damage',
  'Manual Adjustment',
  'Opening Correction',
];

const INV_UNITS = ['Nos', 'pcs', 'Meter', 'Kg', 'kg', 'Ltr', 'ltr', 'Roll', 'Set'];
const STRUCTURE_PACK_TYPES = ['Unit', 'Packet', 'Bundels'];
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
          const items = normalizeRows(await inventoryApi.items.list({ page_size: 25 }));
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
    { label: 'Total Products', value: String(stats?.total_items ?? 0), tone: 'blue', icon: BoxesIcon, onClick: () => onOpenSection('Products') },
    { label: 'High Alert', value: String(criticalCount), tone: 'red', icon: AlertIcon, onClick: () => onOpenSection('Stock') },
    { label: 'Low Stock', value: String(warningCount), tone: 'amber', icon: AlertIcon, onClick: () => onOpenSection('Products') },
    { label: 'Stable', value: String(stableCount), tone: 'green', icon: BoxesIcon, onClick: () => onOpenSection('Products') },
    { label: 'Stock Value', value: fmtInvRs(stats?.total_value), tone: 'lime', icon: RupeeIcon, onClick: () => onOpenSection('Products') },
    { label: 'Total Movements', value: String(stats?.total_movements ?? 0), tone: 'purple', icon: RefreshIcon, onClick: () => onOpenSection('Stock Movement') },
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
      <div className="px-0.5">
        <InventoryBreadcrumbs onOpenSection={onOpenSection} current="Overview" />
      </div>
      <InventoryHeroBanner
        title="Inventory Overview"
        subtitle="Monitor stock health, alerts and quick actions across products and warehouses."
      />
      <Subnav activeSection={activeSection} onOpenSection={onOpenSection} />
      {loading ? (
        <div className={cx(panelClass, 'flex items-center justify-center py-16 text-[14px] text-[#7a8fa6]')}>Loading overview...</div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {cards.map((card) => {
              const tone = INV_KPI_TONES[card.tone] || INV_KPI_TONES.blue;
              return (
                <button key={card.label} type="button" onClick={card.onClick} className="text-left transition hover:-translate-y-0.5">
                  <InventoryKpiCard
                    label={card.label}
                    value={card.value}
                    icon={card.icon}
                    wrap={tone.wrap}
                    iconWrap={tone.iconWrap}
                    valueClass={tone.valueClass}
                  />
                </button>
              );
            })}
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
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Products', section: 'Products', icon: Boxes, tone: 'green' },
              { label: 'Categories', section: 'Categories', icon: Tags, tone: 'amber' },
              { label: 'Stock In', section: 'Stock', icon: PlusIcon, tone: 'blue' },
              { label: 'Stock Out', section: 'Stock Movement', icon: RefreshIcon, tone: 'purple' },
            ].map((action) => {
              const tone = INV_KPI_TONES[action.tone] || INV_KPI_TONES.green;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => onOpenSection(action.section)}
                  className={cx('flex items-center gap-3 rounded-[14px] border p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5', tone.wrap)}
                >
                  <span className={cx('grid size-10 place-items-center rounded-[12px]', tone.iconWrap)}><action.icon className="size-5" /></span>
                  <span className={cx('text-[14px] font-extrabold', tone.valueClass)}>{action.label}</span>
                </button>
              );
            })}
          </section>
        </>
      )}
      <DashboardFooter />
    </div>
  );
}

export function InventoryProductsPage({ activeSection, onOpenSection, onNotify, loggedInUser = null, Subnav, panelClass, cx, PageHeading, DashboardFooter }) {
  const caps = moduleCaps(loggedInUser, 'Inventory');
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [addAnother, setAddAnother] = useState(false);
  const [productFormTab, setProductFormTab] = useState('basic');
  const basicSectionRef = useRef(null);
  const stockSectionRef = useRef(null);
  const extraSectionRef = useRef(null);
  const scrollProductSection = (key) => {
    setProductFormTab(key);
    const map = { basic: basicSectionRef, stock: stockSectionRef, extra: extraSectionRef };
    map[key]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const [pageMode, setPageMode] = useState('list'); // list | adjust
  const [adjustForm, setAdjustForm] = useState({
    itemId: '',
    direction: 'add',
    quantity: '',
    warehouse: '',
    reason: '',
    notes: '',
  });
  const [recentAdjustments, setRecentAdjustments] = useState([]);
  const [saving, setSaving] = useState(false);
  const onNotifyRef = useRef(onNotify);
  onNotifyRef.current = onNotify;
  const seedAttemptedRef = useRef(false);

  const load = useCallback((opts = {}) => {
    const showSpinner = opts.showSpinner !== false;
    if (showSpinner) setLoading(true);
    Promise.all([
      fetchEveryPage((page, pageSize) => inventoryApi.items.list({ page, page_size: pageSize })),
      inventoryApi.categories.list({ page_size: 100 }).catch(() => ({ results: [] })),
      inventoryApi.warehouses.list({ page_size: 100 }).catch(() => ({ results: [] })),
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
          catRows = normalizeRows(await inventoryApi.categories.list({ page_size: 100 }).catch(() => ({ results: [] })))
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
      setRows(Array.isArray(items) ? items : normalizeRows(items));
      setCategories(catRows);
      setWarehouses(normalizeRows(wh));
    }).catch((e) => onNotifyRef.current?.(e.message || 'Failed to load products', 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const patchForm = (patch) => setModal((m) => ({ ...m, form: { ...m.form, ...patch } }));

  const activeCategoryNames = categories.filter((c) => c.is_active !== false).map((c) => c.name).filter(Boolean);
  const fallbackNames = FALLBACK_PRODUCT_CATEGORIES.map((c) => c.name);
  const defaultCategoryName = activeCategoryNames[0] || fallbackNames[0] || 'Structure';
  const modalCategoryOptions = (() => {
    const names = [...(activeCategoryNames.length ? activeCategoryNames : fallbackNames)];
    if (modal?.form?.category && !names.includes(modal.form.category)) names.push(modal.form.category);
    return names;
  })();

  const saveProduct = async () => {
    if (!modal?.form.name?.trim()) { onNotify('Product name is required', 'error'); return; }
    const f = modal.form;
    if (f.rate !== '' && f.rate != null && Number(f.rate) < 0) {
      onNotify('Unit Price cannot be negative', 'error');
      return;
    }
    if (!modal.editId && f.initial_stock !== '' && Number(f.initial_stock) > 0 && !f.warehouse) {
      onNotify('Select a warehouse for opening stock.', 'error');
      return;
    }
    setSaving(true);
    try {
      const cat = f.category || defaultCategoryName || 'Other';
      const template = resolveFormTemplate(cat, categories);
      const body = {
        item_code: f.item_code || undefined,
        name: f.name.trim(),
        category: cat,
        unit: f.unit || 'Nos',
        product_type: f.product_type || '',
        capacity: f.capacity || '',
        panel_wp: f.panel_wp === '' || f.panel_wp == null ? null : Number(f.panel_wp),
        panel_count: f.panel_count === '' || f.panel_count == null ? null : Number(f.panel_count),
        hsn_code: f.hsn_code || '',
        rate: f.rate === '' || f.rate == null ? 0 : Number(f.rate),
        selling_price: f.selling_price === '' || f.selling_price == null ? 0 : Number(f.selling_price),
        minimum_stock: f.minimum_stock === '' || f.minimum_stock == null ? 0 : Number(f.minimum_stock),
        location: String(f.location || '').slice(0, 200),
        warehouse: f.warehouse || null,
        is_active: f.is_active !== false,
      };
      if ((template === 'Panel' || template === 'Battery') && !body.unit) body.unit = 'Nos';
      if (!modal.editId && f.initial_stock !== '') body.initial_stock = Number(f.initial_stock) || 0;
      if (modal.editId) await inventoryApi.items.update(modal.editId, body);
      else await inventoryApi.items.create(body);
      onNotify(modal.editId ? 'Product updated' : 'Product created', 'success');
      if (!modal.editId && addAnother) {
        setModal({ form: { ...defaultsForCategory(cat, categories) } });
        setProductFormTab('basic');
      } else {
        setModal(null);
        setAddAnother(false);
      }
      load({ showSpinner: false });
    } catch (e) {
      onNotify(e.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const loadRecentAdjustments = useCallback(() => {
    inventoryApi.movements.list({ page_size: 8, ordering: '-created_at' })
      .then((data) => setRecentAdjustments(rowsOf(data).slice(0, 4)))
      .catch(() => setRecentAdjustments([]));
  }, []);

  const saveAdjust = async () => {
    if (!adjustForm.itemId) { onNotify('Select a product', 'error'); return; }
    if (!adjustForm.quantity || Number(adjustForm.quantity) <= 0) { onNotify('Quantity required', 'error'); return; }
    if (!adjustForm.reason) { onNotify('Select adjustment reason', 'error'); return; }
    const row = rows.find((r) => String(r.id) === String(adjustForm.itemId));
    if (!row) { onNotify('Product not found', 'error'); return; }
    const warehouseId = adjustForm.warehouse || row.warehouse;
    if (!warehouseId) {
      onNotify('Select a warehouse', 'error');
      return;
    }
    setSaving(true);
    try {
      if (!row.warehouse && warehouseId) {
        await inventoryApi.items.update(row.id, { warehouse: warehouseId }).catch(() => null);
      }
      const qty = Number(adjustForm.quantity);
      const isAdd = adjustForm.direction === 'add';
      await inventoryApi.movements.create({
        item: row.id,
        movement_type: isAdd ? 'Inward' : 'Outward',
        quantity: qty,
        rate: row.rate || 0,
        ...(isAdd ? { to_warehouse: warehouseId } : { from_warehouse: warehouseId }),
        reference_type: adjustForm.reason || 'Manual',
        notes: adjustForm.notes || '',
      });
      onNotify(isAdd ? 'Stock added successfully' : 'Stock deducted successfully', 'success');
      setAdjustForm((f) => ({ ...f, quantity: '', notes: '', reason: '' }));
      load({ showSpinner: false });
      loadRecentAdjustments();
    } catch (e) {
      onNotify(e.message || 'Adjust failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openAddProduct = () => {
    setProductFormTab('basic');
    setAddAnother(false);
    setModal({ form: { ...defaultsForCategory(defaultCategoryName, categories) } });
  };

  const openEditProduct = (r) => {
    setProductFormTab('basic');
    setAddAnother(false);
    setModal({
      editId: r.id,
      viewOnly: false,
      form: {
        ...defaultsForCategory(r.category || 'Structure', categories),
        ...r,
        warehouse: r.warehouse || '',
        rate: r.rate ?? '',
        selling_price: r.selling_price ?? '',
        product_type: r.product_type || '',
        capacity: r.capacity || '',
        panel_wp: r.panel_wp ?? '',
        panel_count: r.panel_count ?? '',
        location: r.location || '',
        auto_sell: false,
        is_active: r.is_active !== false,
        initial_stock: '',
      },
    });
  };

  const openViewProduct = (r) => {
    setProductFormTab('basic');
    setAddAnother(false);
    setModal({
      editId: r.id,
      viewOnly: true,
      form: {
        ...defaultsForCategory(r.category || 'Structure', categories),
        ...r,
        warehouse: r.warehouse || '',
        rate: r.rate ?? '',
        selling_price: r.selling_price ?? '',
        product_type: r.product_type || '',
        capacity: r.capacity || '',
        panel_wp: r.panel_wp ?? '',
        panel_count: r.panel_count ?? '',
        location: r.location || '',
        auto_sell: false,
        is_active: r.is_active !== false,
        initial_stock: '',
      },
    });
  };

  const openAdjust = (r = null) => {
    const item = r || null;
    setAdjustForm({
      itemId: item?.id ? String(item.id) : '',
      direction: 'add',
      quantity: '',
      warehouse: item?.warehouse ? String(item.warehouse) : (warehouses[0]?.id ? String(warehouses[0].id) : ''),
      reason: '',
      notes: '',
    });
    setPageMode('adjust');
    loadRecentAdjustments();
  };

  const deleteProduct = (r) => {
    if (!window.confirm(`Delete product "${r.name}"?`)) return;
    inventoryApi.items.delete(r.id).then(load).catch((e) => onNotify(e.message, 'error'));
  };

  const selectedAdjustItem = useMemo(
    () => rows.find((r) => String(r.id) === String(adjustForm.itemId)) || null,
    [rows, adjustForm.itemId],
  );

  const adjustQty = Number(adjustForm.quantity || 0);
  const currentStock = Number(selectedAdjustItem?.current_stock || 0);
  const updatedStock = adjustForm.direction === 'add'
    ? currentStock + (Number.isFinite(adjustQty) ? adjustQty : 0)
    : currentStock - (Number.isFinite(adjustQty) ? adjustQty : 0);

  const f = modal?.form || {};
  const selectedCategory = f.category || defaultCategoryName || 'Other';
  const categoryHint = CATEGORY_HINTS[selectedCategory] || categories.find((c) => c.name === selectedCategory)?.description || '';
  const descLen = String(f.location || '').length;
  const readOnly = Boolean(modal?.viewOnly);

  const formTabBtn = (key, label, Icon) => (
    <button
      key={key}
      type="button"
      onClick={() => scrollProductSection(key)}
      className={cx(
        'flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-bold transition',
        productFormTab === key ? 'bg-[#16a34a] text-white shadow-[0_8px_18px_rgba(22,163,74,0.25)]' : 'text-[#475569] hover:bg-white',
      )}
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </button>
  );

  if (pageMode === 'adjust') {
    const unit = selectedAdjustItem?.unit || 'Nos';
    return (
      <div className="space-y-3">
        <div className="px-0.5">
          <p className="text-[12px] font-bold text-[#7a8fa6]">
            <button type="button" onClick={() => onOpenSection('Dashboard')} className="hover:text-[#0b65e5]">Dashboard</button>
            <span className="mx-1.5">/</span>
            <button type="button" onClick={() => { setPageMode('list'); onOpenSection('Products'); }} className="hover:text-[#0b65e5]">Inventory</button>
            <span className="mx-1.5">/</span>
            <span className="text-[#1e3261]">Adjust Item</span>
          </p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-[22px] font-extrabold text-[#0f172a]">Adjust Item (Stock Adjustment)</h1>
              <p className="mt-0.5 text-[13px] font-semibold text-[#64748b]">Increase or decrease product stock with proper reason and record.</p>
            </div>
            <button
              type="button"
              onClick={() => setPageMode('list')}
              className="h-10 rounded-[10px] border border-[#dbe3ee] bg-white px-4 text-[13px] font-extrabold text-[#1e3261]"
            >
              Back to Products
            </button>
          </div>
        </div>
        <Subnav activeSection="Products" onOpenSection={(s) => { setPageMode('list'); onOpenSection(s); }} />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-[16px] border border-[#e2e8f0] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <div className="mb-4 flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-[10px] bg-[#dcfce7] text-[#16a34a]"><RefreshCw className="size-4" /></span>
              <div>
                <p className="text-[15px] font-extrabold text-[#0f172a]">Adjustment Details</p>
                <p className="text-[12px] font-semibold text-[#64748b]">Choose movement type and product</p>
              </div>
            </div>

            <p className="mb-2 text-[12px] font-extrabold text-[#334155]">Movement Type</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setAdjustForm((a) => ({ ...a, direction: 'add' }))}
                className={cx(
                  'rounded-[14px] border-2 p-4 text-left transition',
                  adjustForm.direction === 'add' ? 'border-[#16a34a] bg-[#f0fdf4]' : 'border-[#e2e8f0] bg-white hover:bg-[#f8fafc]',
                )}
              >
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-[#dcfce7] text-[#16a34a]"><Plus className="size-4" /></span>
                <p className="mt-2 text-[14px] font-extrabold text-[#0f172a]">Stock In (Add)</p>
                <p className="text-[12px] font-semibold text-[#64748b]">Increase stock (e.g. purchase, return)</p>
              </button>
              <button
                type="button"
                onClick={() => setAdjustForm((a) => ({ ...a, direction: 'remove' }))}
                className={cx(
                  'rounded-[14px] border-2 p-4 text-left transition',
                  adjustForm.direction === 'remove' ? 'border-[#2563eb] bg-[#eff6ff]' : 'border-[#e2e8f0] bg-white hover:bg-[#f8fafc]',
                )}
              >
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-[#dbeafe] text-[#2563eb]"><Minus className="size-4" /></span>
                <p className="mt-2 text-[14px] font-extrabold text-[#0f172a]">Stock Out (Deduct)</p>
                <p className="text-[12px] font-semibold text-[#64748b]">Decrease stock (e.g. issue, damage)</p>
              </button>
            </div>

            <label className="mt-4 block text-[12px] font-extrabold text-[#334155]">
              Select Product
              <select
                className="mt-1 h-11 w-full rounded-[10px] border border-[#dbe3ee] bg-white px-3 text-[13px] font-semibold text-[#0f172a]"
                value={adjustForm.itemId}
                onChange={(e) => {
                  const next = rows.find((r) => String(r.id) === e.target.value);
                  setAdjustForm((a) => ({
                    ...a,
                    itemId: e.target.value,
                    warehouse: next?.warehouse ? String(next.warehouse) : a.warehouse,
                  }));
                }}
              >
                <option value="">Select product…</option>
                {rows.filter((r) => r.is_active !== false).map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>

            {selectedAdjustItem ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[12px] border border-[#e2e8f0] bg-[#f8fafc] p-3">
                <span className="grid size-11 place-items-center rounded-[10px] bg-[#dcfce7] text-[14px] font-extrabold text-[#166534]">
                  {String(selectedAdjustItem.name || 'P').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-extrabold text-[#0f172a]">{selectedAdjustItem.name}</p>
                  <p className="text-[12px] font-semibold text-[#64748b]">
                    Category: {selectedAdjustItem.category || '—'} · Unit: {unit}
                  </p>
                </div>
                <span className="rounded-[10px] bg-[#dcfce7] px-3 py-1.5 text-[12px] font-extrabold text-[#166534]">
                  Current Stock: {currentStock}
                </span>
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-[12px] font-extrabold text-[#334155]">
                Quantity <span className="text-[#dc2626]">*</span>
                <div className="mt-1 flex h-11 items-center gap-2 rounded-[10px] border border-[#dbe3ee] px-3">
                  <Hash className="size-4 text-[#94a3b8]" />
                  <input
                    type="number"
                    min="0"
                    value={adjustForm.quantity}
                    onChange={(e) => setAdjustForm((a) => ({ ...a, quantity: e.target.value }))}
                    placeholder="Enter quantity"
                    className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold outline-none"
                  />
                </div>
              </label>
              <label className="block text-[12px] font-extrabold text-[#334155]">
                Warehouse
                <div className="mt-1 flex h-11 items-center gap-2 rounded-[10px] border border-[#dbe3ee] px-3">
                  <Warehouse className="size-4 text-[#94a3b8]" />
                  <select
                    className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold outline-none"
                    value={adjustForm.warehouse}
                    onChange={(e) => setAdjustForm((a) => ({ ...a, warehouse: e.target.value }))}
                  >
                    <option value="">Select warehouse</option>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              </label>
            </div>

            <label className="mt-3 block text-[12px] font-extrabold text-[#334155]">
              Adjustment Reason <span className="text-[#dc2626]">*</span>
              <select
                className="mt-1 h-11 w-full rounded-[10px] border border-[#dbe3ee] px-3 text-[13px] font-semibold"
                value={adjustForm.reason}
                onChange={(e) => setAdjustForm((a) => ({ ...a, reason: e.target.value }))}
              >
                <option value="">Select reason</option>
                {ADJUST_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>

            <label className="mt-3 block text-[12px] font-extrabold text-[#334155]">
              Remarks (Optional)
              <div className="relative mt-1">
                <FileText className="pointer-events-none absolute left-3 top-3 size-4 text-[#94a3b8]" />
                <textarea
                  rows={3}
                  maxLength={500}
                  value={adjustForm.notes}
                  onChange={(e) => setAdjustForm((a) => ({ ...a, notes: e.target.value }))}
                  placeholder="Add remarks…"
                  className="w-full rounded-[10px] border border-[#dbe3ee] py-2.5 pl-10 pr-3 text-[13px] font-semibold outline-none"
                />
                <span className="absolute bottom-2 right-3 text-[11px] font-bold text-[#94a3b8]">{String(adjustForm.notes || '').length} / 500</span>
              </div>
            </label>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdjustForm((a) => ({ ...a, quantity: '', reason: '', notes: '', direction: 'add' }))}
                className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-[#dbe3ee] bg-white px-4 text-[13px] font-extrabold text-[#334155]"
              >
                <RefreshCw className="size-3.5" />
                Reset
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={saveAdjust}
                className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-[#16a34a] px-5 text-[13px] font-extrabold text-white shadow-[0_10px_22px_rgba(22,163,74,0.28)] disabled:opacity-50"
              >
                Adjust Stock
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[16px] border border-[#e2e8f0] bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <p className="text-[14px] font-extrabold text-[#0f172a]">Stock Summary</p>
              <div className="mt-3 space-y-2 text-[13px] font-semibold text-[#334155]">
                <div className="flex items-center justify-between rounded-[10px] bg-[#f8fafc] px-3 py-2">
                  <span>Current Stock</span>
                  <span className="font-extrabold">{currentStock} {unit}</span>
                </div>
                <div className="flex items-center justify-between rounded-[10px] bg-[#f8fafc] px-3 py-2">
                  <span>Adjust Quantity</span>
                  <span className={cx('font-extrabold', adjustForm.direction === 'add' ? 'text-[#16a34a]' : 'text-[#dc2626]')}>
                    {adjustForm.direction === 'add' ? '+' : '-'} {Number.isFinite(adjustQty) ? adjustQty : 0} {unit}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-[10px] bg-[#ecfdf5] px-3 py-2">
                  <span>Updated Stock</span>
                  <span className="font-extrabold text-[#166534]">{updatedStock} {unit}</span>
                </div>
              </div>
            </div>

            <div className="rounded-[16px] border border-[#e2e8f0] bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-extrabold text-[#0f172a]">Recent Adjustments</p>
                <button type="button" onClick={() => onOpenSection('Stock Movement')} className="text-[12px] font-extrabold text-[#16a34a]">View All</button>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-[12px]">
                  <thead className="text-[10px] font-extrabold uppercase tracking-wide text-[#94a3b8]">
                    <tr>
                      <th className="pb-2 pr-2">Date & Time</th>
                      <th className="pb-2 pr-2">Type</th>
                      <th className="pb-2 pr-2">Qty</th>
                      <th className="pb-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAdjustments.length === 0 ? (
                      <tr><td colSpan={4} className="py-6 text-center font-bold text-[#94a3b8]">No recent movements</td></tr>
                    ) : recentAdjustments.map((m) => {
                      const isIn = m.movement_type === 'Inward';
                      const dt = m.created_at ? new Date(m.created_at) : null;
                      const dateLabel = dt && !Number.isNaN(dt.getTime())
                        ? dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '—';
                      return (
                        <tr key={m.id} className="border-t border-[#f1f5f9]">
                          <td className="py-2.5 pr-2 font-semibold text-[#475569]">{dateLabel}</td>
                          <td className="py-2.5 pr-2">
                            <span className={cx('rounded-full px-2 py-0.5 text-[10px] font-extrabold', isIn ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#fee2e2] text-[#b91c1c]')}>
                              {isIn ? 'IN' : 'OUT'}
                            </span>
                          </td>
                          <td className={cx('py-2.5 pr-2 font-extrabold', isIn ? 'text-[#16a34a]' : 'text-[#dc2626]')}>
                            {isIn ? '+' : '-'} {m.quantity}
                          </td>
                          <td className="py-2.5 font-semibold text-[#334155]">{m.reference_type || m.notes || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <DashboardFooter />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="px-0.5">
        <InventoryBreadcrumbs onOpenSection={onOpenSection} current="Products" />
      </div>
      <InventoryHeroBanner
        title="Inventory Products"
        subtitle="Manage product master, pricing and stock levels across categories."
      />
      <Subnav activeSection={activeSection} onOpenSection={onOpenSection} />
      <InventoryProductsCatalog
        items={rows}
        categories={categories}
        loading={loading}
        caps={caps}
        onNotify={onNotify}
        onAddItem={openAddProduct}
        onEditItem={openEditProduct}
        onViewItem={openViewProduct}
        onDeleteItem={deleteProduct}
        onAdjustStock={() => openAdjust(null)}
      />
      <DashboardFooter />

      {modal ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-3 sm:p-6">
          <div className="flex max-h-[92vh] w-full max-w-[920px] flex-col overflow-hidden rounded-[16px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.35)]">
            <div className="flex items-start justify-between gap-3 bg-[#166534] px-5 py-4 text-white">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid size-10 place-items-center rounded-[12px] bg-white/15">
                  <Package className="size-5" />
                </span>
                <div>
                  <h3 className="text-[17px] font-extrabold">
                    {modal.editId ? (readOnly ? 'View Product' : 'Edit Product') : 'Add New Product'}
                  </h3>
                  <p className="text-[12px] font-semibold text-white/80">
                    Create a new inventory product with category and pricing details.
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setModal(null)} className="grid size-8 place-items-center rounded-full hover:bg-white/10" aria-label="Close">✕</button>
            </div>

            <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[200px_minmax(0,1fr)]">
              <aside className="space-y-1 border-b border-[#eef2f7] bg-[#f8fafc] p-3 md:border-b-0 md:border-r">
                {formTabBtn('basic', 'Basic Details', Package)}
                {formTabBtn('stock', 'Stock & Pricing', IndianRupee)}
                {formTabBtn('extra', 'Additional Info', FileText)}
              </aside>

              <div className="min-h-0 space-y-6 overflow-y-auto p-5">
                <section ref={basicSectionRef} className="space-y-4">
                  <div className="flex items-start gap-2">
                    <span className="grid size-8 place-items-center rounded-[8px] bg-[#dcfce7] text-[#16a34a]"><Package className="size-4" /></span>
                    <div>
                      <p className="text-[14px] font-extrabold text-[#0f172a]">Basic Details</p>
                      <p className="text-[12px] font-semibold text-[#64748b]">Category, name and unit information</p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.9fr)]">
                    <label className="block text-[12px] font-extrabold text-[#334155]">
                      Category
                      <select
                        disabled={readOnly}
                        className="mt-1 h-11 w-full rounded-[10px] border border-[#dbe3ee] px-3 text-[13px] font-semibold"
                        value={selectedCategory}
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
                                selling_price: m.form.selling_price,
                                location: m.form.location,
                              },
                            };
                          });
                        }}
                      >
                        {!modalCategoryOptions.length ? <option value="">Add category first</option> : null}
                        {modalCategoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                    <div className="flex items-start gap-2 rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] p-3 text-[12px] font-semibold text-[#64748b]">
                      <Info className="mt-0.5 size-4 shrink-0 text-[#94a3b8]" />
                      <span>{selectedCategory}{categoryHint ? `: ${categoryHint}` : ''}</span>
                    </div>
                  </div>
                  <label className="block text-[12px] font-extrabold text-[#334155]">
                    Product Name
                    <input
                      disabled={readOnly}
                      className="mt-1 h-11 w-full rounded-[10px] border border-[#dbe3ee] px-3 text-[13px] font-semibold"
                      placeholder="Enter product name (e.g. ACDB Box 3 Phase)"
                      value={f.name || ''}
                      onChange={(e) => patchForm({ name: e.target.value })}
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-[12px] font-extrabold text-[#334155]">
                      Item Code
                      <input
                        disabled={readOnly}
                        className="mt-1 h-11 w-full rounded-[10px] border border-[#dbe3ee] px-3 text-[13px] font-semibold"
                        placeholder="Auto-generated if empty"
                        value={f.item_code || ''}
                        onChange={(e) => patchForm({ item_code: e.target.value })}
                      />
                    </label>
                    <label className="block text-[12px] font-extrabold text-[#334155]">
                      Unit
                      <select
                        disabled={readOnly}
                        className="mt-1 h-11 w-full rounded-[10px] border border-[#dbe3ee] px-3 text-[13px] font-semibold"
                        value={f.unit || 'Nos'}
                        onChange={(e) => patchForm({ unit: e.target.value })}
                      >
                        {unitsForCategory(selectedCategory, f.unit).map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </label>
                  </div>
                  <label className="block text-[12px] font-extrabold text-[#334155] sm:max-w-[240px]">
                    Reorder Level
                    <input
                      disabled={readOnly}
                      type="number"
                      className="mt-1 h-11 w-full rounded-[10px] border border-[#dbe3ee] px-3 text-[13px] font-semibold"
                      placeholder="e.g. 10"
                      value={f.minimum_stock ?? ''}
                      onChange={(e) => patchForm({ minimum_stock: e.target.value })}
                    />
                  </label>
                </section>

                <div className="border-t border-dashed border-[#dbe3ee]" />

                <section ref={stockSectionRef} className="space-y-4">
                  <div className="flex items-start gap-2">
                    <span className="grid size-8 place-items-center rounded-[8px] bg-[#dcfce7] text-[#16a34a]"><IndianRupee className="size-4" /></span>
                    <div>
                      <p className="text-[14px] font-extrabold text-[#0f172a]">Stock & Pricing</p>
                      <p className="text-[12px] font-semibold text-[#64748b]">Unit price, selling price and opening stock</p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-[12px] font-extrabold text-[#334155]">
                      Unit Price (₹)
                      <input
                        disabled={readOnly}
                        type="number"
                        className="mt-1 h-11 w-full rounded-[10px] border border-[#dbe3ee] px-3 text-[13px] font-semibold"
                        placeholder="Enter unit price"
                        value={f.rate ?? ''}
                        onChange={(e) => patchForm({ rate: e.target.value })}
                      />
                    </label>
                    <label className="block text-[12px] font-extrabold text-[#334155]">
                      Selling Price (₹)
                      <input
                        disabled={readOnly}
                        type="number"
                        className="mt-1 h-11 w-full rounded-[10px] border border-[#dbe3ee] px-3 text-[13px] font-semibold"
                        placeholder="Enter selling price (optional)"
                        value={f.selling_price ?? ''}
                        onChange={(e) => patchForm({ selling_price: e.target.value })}
                      />
                    </label>
                    {!modal.editId ? (
                      <label className="block text-[12px] font-extrabold text-[#334155]">
                        Opening Stock
                        <input
                          disabled={readOnly}
                          type="number"
                          className="mt-1 h-11 w-full rounded-[10px] border border-[#dbe3ee] px-3 text-[13px] font-semibold"
                          placeholder="e.g. 0"
                          value={f.initial_stock ?? ''}
                          onChange={(e) => patchForm({ initial_stock: e.target.value })}
                        />
                      </label>
                    ) : null}
                    <label className="block text-[12px] font-extrabold text-[#334155]">
                      Warehouse
                      <select
                        disabled={readOnly}
                        className="mt-1 h-11 w-full rounded-[10px] border border-[#dbe3ee] px-3 text-[13px] font-semibold"
                        value={f.warehouse || ''}
                        onChange={(e) => patchForm({ warehouse: e.target.value })}
                      >
                        <option value="">Select warehouse</option>
                        {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </label>
                  </div>
                </section>

                <div className="border-t border-dashed border-[#dbe3ee]" />

                <section ref={extraSectionRef} className="space-y-4">
                  <div className="flex items-start gap-2">
                    <span className="grid size-8 place-items-center rounded-[8px] bg-[#dcfce7] text-[#16a34a]"><FileText className="size-4" /></span>
                    <div>
                      <p className="text-[14px] font-extrabold text-[#0f172a]">Additional Info</p>
                      <p className="text-[12px] font-semibold text-[#64748b]">Optional notes and specifications</p>
                    </div>
                  </div>
                  <label className="block text-[12px] font-extrabold text-[#334155]">
                    Description
                    <div className="relative mt-1">
                      <textarea
                        disabled={readOnly}
                        rows={5}
                        maxLength={200}
                        className="w-full rounded-[10px] border border-[#dbe3ee] p-3 text-[13px] font-semibold outline-none"
                        placeholder="Add product description, specification or notes (optional)."
                        value={f.location || ''}
                        onChange={(e) => patchForm({ location: e.target.value })}
                      />
                      <span className="absolute bottom-2 right-3 text-[11px] font-bold text-[#94a3b8]">{descLen} / 200</span>
                    </div>
                  </label>
                </section>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-[#eef2f7] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              {!modal.editId ? (
                <label className="inline-flex items-center gap-2 text-[13px] font-bold text-[#475569]">
                  <input type="checkbox" checked={addAnother} onChange={(e) => setAddAnother(e.target.checked)} className="size-4 accent-[#16a34a]" />
                  Add another product
                </label>
              ) : <span />}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setModal(null)} className="h-11 rounded-[10px] border border-[#dbe3ee] px-5 text-[13px] font-extrabold text-[#334155]">Cancel</button>
                {!readOnly ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={saveProduct}
                    className="h-11 rounded-[10px] bg-[#16a34a] px-5 text-[13px] font-extrabold text-white shadow-[0_10px_22px_rgba(22,163,74,0.28)] disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : (modal.editId ? 'Save Changes' : 'Save Product')}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function categoryThumbClass(name = '') {
  const hues = [
    'bg-[#dcfce7] text-[#166534]',
    'bg-[#dbeafe] text-[#1d4ed8]',
    'bg-[#fce7f3] text-[#be185d]',
    'bg-[#ffedd5] text-[#c2410c]',
    'bg-[#e0e7ff] text-[#4338ca]',
    'bg-[#ccfbf1] text-[#0f766e]',
    'bg-[#fef3c7] text-[#b45309]',
    'bg-[#f3e8ff] text-[#7c3aed]',
  ];
  const letter = String(name).trim().charAt(0).toUpperCase() || 'C';
  return { letter, className: hues[letter.charCodeAt(0) % hues.length] };
}

function formDesignBadge(template, label) {
  if (template === 'Electrical' || template === 'Structure') {
    return (
      <span className="inline-flex rounded-full bg-[#f3e8ff] px-2.5 py-1 text-[11px] font-extrabold text-[#7c3aed]">
        {label}
      </span>
    );
  }
  if (template === 'Panel') {
    return (
      <span className="inline-flex rounded-full bg-[#ffedd5] px-2.5 py-1 text-[11px] font-extrabold text-[#c2410c]">
        {label}
      </span>
    );
  }
  if (template === 'Invertor' || template === 'Battery') {
    return (
      <span className="inline-flex rounded-full bg-[#e0f2fe] px-2.5 py-1 text-[11px] font-extrabold text-[#0369a1]">
        {label}
      </span>
    );
  }
  if (template === 'Custom') {
    return (
      <span className="inline-flex rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[11px] font-extrabold text-[#475569]">
        {label}
      </span>
    );
  }
  return (
    <span className="text-[12px] font-extrabold text-[#2563eb]">{label}</span>
  );
}

export function InventoryCategoriesPage({ activeSection, onOpenSection, onNotify, loggedInUser = null, Subnav, panelClass, cx, PageHeading, DashboardFooter }) {
  const caps = moduleCaps(loggedInUser, 'Inventory');
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [formFilter, setFormFilter] = useState('');
  const [viewMode, setViewMode] = useState('list');
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
    Promise.all([
      inventoryApi.categories.list({ page_size: 100 }).catch(() => ({ results: [] })),
      fetchEveryPage((page, pageSize) => inventoryApi.items.list({ page, page_size: pageSize })).catch(() => []),
    ])
      .then(([cats, items]) => {
        setRows(normalizeRows(cats).map(mergeCategoryFormConfig));
        setProducts(Array.isArray(items) ? items : normalizeRows(items));
      })
      .catch((e) => onNotifyRef.current?.(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const productCountByCategory = useMemo(() => {
    const map = {};
    products.forEach((item) => {
      if (item?.is_active === false) return;
      const key = item.category || '';
      if (!key) return;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [products]);

  const templateLabel = (value) => FORM_TEMPLATE_OPTIONS.find((o) => o.value === value)?.label || value || 'Generic';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (formFilter && (r.form_template || 'Generic') !== formFilter) return false;
      if (!q) return true;
      return [r.name, r.description, templateLabel(r.form_template)]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [rows, search, formFilter]);

  const { pageRows, startIndex, pagination } = usePagedRows(filtered, 'inventory-categories', {
    defaultSize: 100,
    resetKey: `${search}|${formFilter}`,
    pageSizeOptions: [10, 20, 50, 100],
  });

  const kpis = useMemo(() => {
    const activeCats = rows.filter((r) => r.is_active !== false);
    const withProducts = activeCats.filter((r) => (productCountByCategory[r.name] || 0) > 0).length;
    const totalProducts = products.filter((p) => p.is_active !== false).length;
    return {
      totalCategories: rows.length,
      withProducts,
      totalProducts,
      activeCategories: activeCats.length,
    };
  }, [rows, products, productCountByCategory]);

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

  const openEditCategory = (r) => setModal({
    editId: r.id,
    form: {
      name: r.name,
      description: r.description || '',
      is_active: r.is_active !== false,
      form_template: r.form_template || 'Generic',
      form_fields: Array.isArray(r.form_fields) && r.form_fields.length ? r.form_fields : [...DEFAULT_CUSTOM_FIELDS],
    },
  });

  const deleteCategory = (r) => {
    if (!window.confirm(`Delete category "${r.name}"?`)) return;
    inventoryApi.categories.delete(r.id)
      .then(load)
      .catch((e) => onNotify(e.message || 'Delete failed', 'error'));
  };

  const kpiCards = [
    {
      label: 'Total Categories',
      value: kpis.totalCategories,
      icon: Tags,
      wrap: 'border-[#bbf7d0] bg-gradient-to-br from-[#f0fdf4] to-white',
      iconWrap: 'bg-[#dcfce7] text-[#15803d]',
      valueClass: 'text-[#166534]',
    },
    {
      label: 'Categories with Products',
      value: kpis.withProducts,
      icon: Package,
      wrap: 'border-[#bfdbfe] bg-gradient-to-br from-[#eff6ff] to-white',
      iconWrap: 'bg-[#dbeafe] text-[#1d4ed8]',
      valueClass: 'text-[#1e3a8a]',
    },
    {
      label: 'Total Products',
      value: kpis.totalProducts,
      icon: Boxes,
      wrap: 'border-[#e9d5ff] bg-gradient-to-br from-[#faf5ff] to-white',
      iconWrap: 'bg-[#f3e8ff] text-[#7c3aed]',
      valueClass: 'text-[#6b21a8]',
    },
    {
      label: 'Active Categories',
      value: kpis.activeCategories,
      icon: CheckCircle2,
      wrap: 'border-[#d9f99d] bg-gradient-to-br from-[#f7fee7] to-white',
      iconWrap: 'bg-[#ecfccb] text-[#65a30d]',
      valueClass: 'text-[#3f6212]',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="px-0.5">
        <InventoryBreadcrumbs onOpenSection={onOpenSection} current="Categories" />
      </div>
      <InventoryHeroBanner
        title="Inventory Categories"
        subtitle="Manage product categories and their form design for inventory."
      />
      <Subnav activeSection={activeSection} onOpenSection={onOpenSection} />

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
              <button
                type="button"
                onClick={() => setModal({ form: { ...emptyCategoryForm } })}
                className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-[#16a34a] px-4 text-[13px] font-extrabold text-white shadow-[0_8px_18px_rgba(22,163,74,0.22)] hover:bg-[#15803d]"
              >
                <Plus className="size-4" />
                Add Category
              </button>
            ) : null}
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
            <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-[10px] border border-[#dbe3ee] bg-[#f8fafc] px-3 lg:max-w-[360px]">
              <Search className="size-4 shrink-0 text-[#94a3b8]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search categories by name or description..."
                className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
              />
            </label>
            <select
              value={formFilter}
              onChange={(e) => setFormFilter(e.target.value)}
              className="h-10 rounded-[10px] border border-[#dbe3ee] bg-white px-3 text-[12px] font-bold text-[#334155]"
            >
              <option value="">Form Design: All</option>
              {FORM_TEMPLATE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
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
          </div>
        </div>

        {loading ? (
          <p className="px-5 py-16 text-center text-[13px] font-bold text-[#94a3b8]">Loading categories…</p>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-10">
            <MobileCardEmpty icon={Tags} title="No categories yet" />
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {pageRows.map((r) => {
              const thumb = categoryThumbClass(r.name);
              const count = productCountByCategory[r.name] || 0;
              const active = r.is_active !== false;
              return (
                <div key={r.id} className="rounded-[14px] border border-[#e2e8f0] bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className={cx('grid size-11 place-items-center rounded-[12px] text-[14px] font-extrabold', thumb.className)}>
                      {thumb.letter}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-extrabold text-[#0f172a]">{r.name}</p>
                      <div className="mt-1">{formDesignBadge(r.form_template || 'Generic', templateLabel(r.form_template))}</div>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-2 text-[12px] font-semibold text-[#64748b]">{r.description || '—'}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-extrabold text-[#334155]">
                      <Package className="size-3.5 text-[#94a3b8]" />
                      {count} products
                    </span>
                    <span className={cx(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold',
                      active ? 'bg-[#ecfdf5] text-[#15803d]' : 'bg-[#f1f5f9] text-[#64748b]',
                    )}>
                      <span className={cx('size-1.5 rounded-full', active ? 'bg-[#22c55e]' : 'bg-[#94a3b8]')} />
                      {active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="mt-3 flex justify-end gap-1">
                    {caps.edit ? (
                      <button type="button" onClick={() => openEditCategory(r)} className="grid size-8 place-items-center rounded-[8px] text-[#2563eb] hover:bg-[#eff6ff]" aria-label="Edit">
                        <Pencil className="size-3.5" />
                      </button>
                    ) : null}
                    {caps.delete ? (
                      <button type="button" onClick={() => deleteCategory(r)} className="grid size-8 place-items-center rounded-[8px] text-[#dc2626] hover:bg-[#fef2f2]" aria-label="Delete">
                        <Trash2 className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <div className="space-y-3 p-4 lg:hidden">
              <MobileCardList>
                {pageRows.map((r) => (
                  <MobileRecordCard
                    key={r.id}
                    icon={Tags}
                    title={r.name}
                    badges={formDesignBadge(r.form_template || 'Generic', templateLabel(r.form_template))}
                    details={[
                      { label: 'Description', value: r.description || '—', wide: true },
                      { label: 'Products', value: String(productCountByCategory[r.name] || 0) },
                      { label: 'Status', value: r.is_active !== false ? 'Active' : 'Inactive' },
                    ]}
                    actions={[caps.edit ? { label: 'Edit', icon: Pencil, tone: 'blue', onClick: () => openEditCategory(r) } : null]}
                    menu={caps.delete ? [{ label: 'Delete', icon: Trash2, danger: true, onClick: () => deleteCategory(r) }] : []}
                  />
                ))}
              </MobileCardList>
            </div>
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full text-left">
                <thead className="bg-[#f8fafc] text-[11px] font-extrabold uppercase tracking-[0.05em] text-[#64748b]">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-3 py-3">Category Name</th>
                    <th className="px-3 py-3">Form Design</th>
                    <th className="px-3 py-3">Description</th>
                    <th className="px-3 py-3">Products</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r, i) => {
                    const thumb = categoryThumbClass(r.name);
                    const count = productCountByCategory[r.name] || 0;
                    const active = r.is_active !== false;
                    return (
                      <tr key={r.id} className="border-t border-[#eef2f7] hover:bg-[#fafbfc]">
                        <td className="px-4 py-3 text-[13px] font-bold text-[#64748b]">{startIndex + i + 1}</td>
                        <td className="px-3 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className={cx('grid size-9 shrink-0 place-items-center rounded-[10px] text-[12px] font-extrabold', thumb.className)}>
                              {thumb.letter}
                            </span>
                            <p className="truncate text-[13px] font-extrabold text-[#0f172a]">{r.name}</p>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {formDesignBadge(r.form_template || 'Generic', templateLabel(r.form_template))}
                        </td>
                        <td className="px-3 py-3 text-[13px] font-semibold text-[#53647f]">{r.description || '—'}</td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-[#0f172a]">
                            <Package className="size-3.5 text-[#94a3b8]" />
                            {count}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className={cx(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold',
                            active ? 'bg-[#ecfdf5] text-[#15803d]' : 'bg-[#f1f5f9] text-[#64748b]',
                          )}>
                            <span className={cx('size-1.5 rounded-full', active ? 'bg-[#22c55e]' : 'bg-[#94a3b8]')} />
                            {active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {caps.edit ? (
                              <button
                                type="button"
                                onClick={() => openEditCategory(r)}
                                className="grid size-8 place-items-center rounded-[8px] text-[#2563eb] hover:bg-[#eff6ff]"
                                aria-label="Edit"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                            ) : null}
                            {caps.delete ? (
                              <button
                                type="button"
                                onClick={() => deleteCategory(r)}
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
          </>
        )}

        <div className="border-t border-[#eef2f7] px-2 py-1">
          <TablePagination {...pagination} noun="entries" pageSizeOptions={[10, 20, 50, 100]} />
        </div>
      </div>

      <DashboardFooter />

      {modal ? (
        <InvModal title={modal.editId ? 'Edit Category + Form' : 'Add Category + Form Design'} onClose={() => setModal(null)} footer={(
          <>
            <button type="button" onClick={() => setModal(null)} className="rounded-[8px] border px-4 py-2">Cancel</button>
            <button type="button" disabled={saving} onClick={save} className="rounded-[8px] bg-[#16a34a] px-4 py-2 font-extrabold text-white">Save</button>
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
                <p className="mb-3 text-[11px] font-semibold text-[#7386a3]">Unit Price is always on (required for Material Planning)</p>
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
                This template&apos;s built-in fields + <b>Unit Price</b> will appear automatically on the Add Product form.
              </div>
            )}
          </div>
        </InvModal>
      ) : null}
    </div>
  );
}
