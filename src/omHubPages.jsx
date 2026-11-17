/**
 * O&M Hub — Task 11: 8 sidebar sections; reuses existing om/amc APIs & DB FKs.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Calendar, CheckCircle2, ClipboardList, IndianRupee,
  Plus, RefreshCw, Shield, Ticket,
} from 'lucide-react';
import {
  amcModuleApi,
  omAssetApi, omDashboardApi, omFeedbackApi, omGenerationLogApi,
  omJobCardApi, omMaterialRequestApi, omPlantApi, omReplacementApi,
  omReportApi, omSparePartApi,
} from './api.js';
import { normalizeApiRows } from './lib/utils.js';
import {
  ComplaintTicketsList, ServiceTasksList, ServiceVisitsList, omCaps,
} from './omServicePages.jsx';
import {
  InsuranceList, OmDashboardPage, PlantDetailPage, PlantsPage,
} from './omPlantPages.jsx';
import { BTN_OUTLINE, BTN_PRIMARY, PANEL, Pill, SearchBox, fmtDate, fmtMoney } from './omUi.jsx';
import { TablePagination, usePagedRows } from './components/TablePagination.jsx';
import { UnderlineTabs } from './components/UnderlineTabs.jsx';
import { MobileSubnavSelect } from './components/mobile/MobileSubnavSelect.jsx';

const amcContractApi = amcModuleApi.contracts;
const amcServiceRequestApi = amcModuleApi.serviceRequests;
const amcWarrantyApi = amcModuleApi.warranties;
const amcRenewalApi = amcModuleApi.renewals;
const amcClaimApi = amcModuleApi.claims;

/** Exactly 8 main O&M sidebar categories (Task 11). */
export const OM_HUB_ROUTES = {
  'O&M Dashboard & Plant List': '/om/dashboard',
  'Service Tickets & Complaints': '/om/service-tickets',
  'Quarterly Preventive Maintenance': '/om/quarterly-pm',
  'Panel Cleaning Management': '/om/panel-cleaning',
  'Warranty Management': '/om/warranty',
  'Insurance Management': '/om/insurance',
  'Paid AMC Management': '/om/paid-amc',
  'Service History & Reports': '/om/history-reports',
};

export const OM_HUB_SECTIONS = Object.keys(OM_HUB_ROUTES);

/** Deep-link aliases → category (+ optional default tab). */
export const OM_NAV_RESOLVE = {
  'O&M Dashboard & Plant List': { section: 'O&M Dashboard & Plant List', tab: 'Dashboard' },
  'O&M Dashboard': { section: 'O&M Dashboard & Plant List', tab: 'Dashboard' },
  'O&M Overview': { section: 'O&M Dashboard & Plant List', tab: 'Dashboard' },
  Plants: { section: 'O&M Dashboard & Plant List', tab: 'Plant List' },
  'Service Tickets & Complaints': { section: 'Service Tickets & Complaints', tab: 'Complaint Tickets' },
  'Service & Complaints': { section: 'Service Tickets & Complaints', tab: 'Complaint Tickets' },
  'Service Requests': { section: 'Service Tickets & Complaints', tab: 'Service Requests' },
  'My Tasks': { section: 'Service Tickets & Complaints', tab: 'Site Visits' },
  'Complaint Management': { section: 'Service Tickets & Complaints', tab: 'Complaint Tickets' },
  'Complaint Tickets': { section: 'Service Tickets & Complaints', tab: 'Complaint Tickets' },
  'Breakdown Tickets': { section: 'Service Tickets & Complaints', tab: 'Complaint Tickets' },
  'Job Cards & Site Visits': { section: 'Service Tickets & Complaints', tab: 'Job Cards' },
  'Job Cards': { section: 'Service Tickets & Complaints', tab: 'Job Cards' },
  'Site Visits': { section: 'Service Tickets & Complaints', tab: 'Site Visits' },
  'Service Visits': { section: 'Service Tickets & Complaints', tab: 'Site Visits' },
  'Spare Parts': { section: 'Service Tickets & Complaints', tab: 'Material Requests' },
  'Quarterly Preventive Maintenance': { section: 'Quarterly Preventive Maintenance' },
  'Preventive Maintenance': { section: 'Quarterly Preventive Maintenance' },
  'Quarterly Services': { section: 'Quarterly Preventive Maintenance' },
  'Service Tasks': { section: 'Quarterly Preventive Maintenance' },
  'Maintenance Tasks': { section: 'Quarterly Preventive Maintenance' },
  'Panel Cleaning Management': { section: 'Panel Cleaning Management' },
  Cleaning: { section: 'Panel Cleaning Management' },
  'Warranty Management': { section: 'Warranty Management', tab: 'Equipment Warranties' },
  Warranties: { section: 'Warranty Management', tab: 'Equipment Warranties' },
  Claims: { section: 'Warranty Management', tab: 'Warranty Claims' },
  'Equipment & Replacement': { section: 'Warranty Management', tab: 'Equipment Replacement' },
  'Asset Management': { section: 'Warranty Management', tab: 'Equipment Replacement' },
  'Insurance Management': { section: 'Insurance Management' },
  Insurance: { section: 'Insurance Management' },
  'Paid AMC Management': { section: 'Paid AMC Management', tab: 'AMC Contracts' },
  'AMC & Warranty': { section: 'Paid AMC Management', tab: 'AMC Contracts' },
  'AMC Management': { section: 'Paid AMC Management', tab: 'AMC Contracts' },
  'AMC Overview': { section: 'Paid AMC Management', tab: 'AMC Contracts' },
  'AMC Contracts': { section: 'Paid AMC Management', tab: 'AMC Contracts' },
  Renewals: { section: 'Paid AMC Management', tab: 'AMC Renewals' },
  'Service History & Reports': { section: 'Service History & Reports', tab: 'Service Reports' },
  'Plant Monitoring & Reports': { section: 'Service History & Reports', tab: 'Plant Performance' },
  'Plant Performance': { section: 'Service History & Reports', tab: 'Plant Performance' },
  'Energy Performance': { section: 'Service History & Reports', tab: 'Generation Records' },
  'Service Reports': { section: 'Service History & Reports', tab: 'Service Reports' },
  'O&M Reports': { section: 'Service History & Reports', tab: 'Service Reports' },
  Reports: { section: 'Service History & Reports', tab: 'Service Reports' },
  'Customer Feedback': { section: 'Service History & Reports', tab: 'Customer Feedback' },
  'O&M Settings': { section: 'Service History & Reports', tab: 'Service Reports' },
};

/** Sidebar highlight map (legacy → one of 8). */
export const OM_LEGACY_TO_SECTION = Object.fromEntries(
  Object.entries(OM_NAV_RESOLVE).map(([k, v]) => [k, v.section]),
);

const CATEGORY_TABS = {
  'O&M Dashboard & Plant List': ['Dashboard', 'Plant List'],
  'Service Tickets & Complaints': [
    'Complaint Tickets', 'Service Requests', 'Job Cards', 'Site Visits', 'Material Requests',
  ],
  'Warranty Management': [
    'Equipment Warranties', 'Warranty Claims', 'Equipment Replacement',
  ],
  'Paid AMC Management': [
    'AMC Contracts', 'AMC Renewals', 'AMC Expiry',
  ],
  'Service History & Reports': [
    'Generation Records', 'Plant Performance', 'Service Reports',
    'Customer Feedback', 'Job Card History',
  ],
};

function resolveOmNav(activeSection) {
  const hit = OM_NAV_RESOLVE[activeSection];
  if (hit) return hit;
  if (OM_HUB_SECTIONS.includes(activeSection)) {
    return { section: activeSection, tab: CATEGORY_TABS[activeSection]?.[0] };
  }
  return { section: 'O&M Dashboard & Plant List', tab: 'Dashboard' };
}

function errMsg(e, fb) {
  return e?.message || fb;
}

function HubShell({ title, Subnav, activeSection, onOpenSection, children, actions }) {
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[12px] font-bold text-[#7a8fa6]">Dashboard / O&amp;M</p>
          <h1 className="font-display text-[20px] font-extrabold text-[#111827] sm:text-[22px]">{title}</h1>
        </div>
        {actions}
      </div>
      {Subnav ? <Subnav activeSection={activeSection} onOpenSection={onOpenSection} /> : null}
      {children}
    </div>
  );
}

function HubInnerTabs({ tabs, value, onChange }) {
  const items = tabs.map((t) => ({ value: t, label: t }));
  return (
    <div className="space-y-3">
      <MobileSubnavSelect items={items} value={value} onChange={onChange} label="Section" tone="amber" />
      <UnderlineTabs items={items} value={value} onChange={onChange} tone="amber" />
    </div>
  );
}

function EmptyHint({ text }) {
  return (
    <div className={`${PANEL} p-8 text-center text-[13px] font-semibold text-[#7386a3]`}>{text}</div>
  );
}

function SimpleTable({ columns, rows, empty }) {
  if (!rows.length) return <EmptyHint text={empty || 'No records yet.'} />;
  return (
    <div className={`${PANEL} overflow-x-auto`}>
      <table className="min-w-full text-left text-[13px]">
        <thead className="bg-[#f8fbff] text-[11px] font-extrabold uppercase tracking-wide text-[#7a8fa6]">
          <tr>{columns.map((c) => <th key={c.key} className="px-3 py-2.5">{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id || i} className="border-t border-[#edf2f8]">
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2.5">{c.render ? c.render(r) : (r[c.key] ?? '—')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabNote({ text }) {
  return <p className="text-[12px] font-semibold text-[#7386a3]">{text}</p>;
}

/* ─── Shared content panels (no HubShell) ─────────────────────────────────── */

function AmcContractsPanel({ onNotify, expiryOnly = false }) {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(normalizeApiRows(await amcContractApi.list({ page_size: 200 })));
    } catch (e) {
      onNotify?.(errMsg(e, 'Failed to load AMC contracts'), 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) => {
    if (expiryOnly && !['Expiring Soon', 'Expired'].includes(r.status)) return false;
    const hay = `${r.customer_name} ${r.site} ${r.contract_type} ${r.status}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });
  const { pageRows, pagination } = usePagedRows(filtered, expiryOnly ? 'om-amc-exp' : 'om-amc', { resetKey: `${q}|${expiryOnly}` });

  return (
    <div className="space-y-3">
      <TabNote text="Source: AMC module (`/amc/contracts`). Customer/Project via FK — no duplicate AMC tables." />
      <div className="flex flex-wrap gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="Search customer, site, type…" />
        <button type="button" onClick={load} className={BTN_OUTLINE}><RefreshCw className="size-4" /></button>
      </div>
      {loading ? <EmptyHint text="Loading…" /> : (
        <>
          <SimpleTable
            columns={[
              { key: 'id', label: 'AMC No', render: (r) => `AMC-${String(r.id).padStart(4, '0')}` },
              { key: 'customer_name', label: 'Customer' },
              { key: 'site', label: 'Site' },
              { key: 'contract_type', label: 'Type' },
              { key: 'start_date', label: 'Start', render: (r) => fmtDate(r.start_date) },
              { key: 'end_date', label: 'End', render: (r) => fmtDate(r.end_date) },
              { key: 'annual_value', label: 'Amount', render: (r) => fmtMoney(r.annual_value) },
              { key: 'status', label: 'Status', render: (r) => <Pill tone={r.status === 'Active' ? 'green' : r.status === 'Expired' ? 'red' : 'amber'}>{r.status}</Pill> },
              {
                key: 'actions',
                label: 'Actions',
                render: (r) => (
                  (r.status === 'Expiring Soon' || r.status === 'Expired' || r.status === 'Active') ? (
                    <button
                      type="button"
                      className={BTN_OUTLINE}
                      onClick={async () => {
                        try {
                          const start = r.end_date ? new Date(r.end_date) : new Date();
                          start.setDate(start.getDate() + 1);
                          const end = new Date(start);
                          end.setFullYear(end.getFullYear() + 1);
                          const iso = (d) => d.toISOString().slice(0, 10);
                          await amcContractApi.createRenewal(r.id, {
                            start_date: iso(start),
                            end_date: iso(end),
                            annual_value: r.annual_value,
                          });
                          onNotify?.('AMC renewed — previous contract preserved as Renewed.', 'success');
                          load();
                        } catch (e) {
                          onNotify?.(errMsg(e, 'Renewal failed'), 'error');
                        }
                      }}
                    >
                      Renew
                    </button>
                  ) : null
                ),
              },
            ]}
            rows={pageRows}
            empty={expiryOnly ? 'No AMC expiry alerts.' : 'No AMC contracts yet.'}
          />
          <TablePagination {...pagination} />
        </>
      )}
    </div>
  );
}

function AmcRenewalsPanel({ onNotify }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    amcRenewalApi.list({ page_size: 200 })
      .then((d) => setRows(normalizeApiRows(d)))
      .catch((e) => onNotify?.(errMsg(e, 'Failed to load renewals'), 'error'));
  }, [onNotify]);
  return (
    <div className="space-y-3">
      <TabNote text="AMC renewal history from `/amc/renewals`. Historical contracts stay intact." />
      <SimpleTable
        columns={[
          { key: 'id', label: 'RNW', render: (r) => `RNW-${String(r.id).padStart(4, '0')}` },
          { key: 'contract', label: 'Contract' },
          { key: 'renewal_date', label: 'Renewal', render: (r) => fmtDate(r.renewal_date) },
          { key: 'new_end_date', label: 'New End', render: (r) => fmtDate(r.new_end_date) },
          { key: 'amount', label: 'Amount', render: (r) => fmtMoney(r.amount) },
          { key: 'status', label: 'Status', render: (r) => <Pill>{r.status}</Pill> },
        ]}
        rows={rows}
        empty="No renewals recorded yet."
      />
    </div>
  );
}

function WarrantyPanel({ onNotify }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(normalizeApiRows(await amcWarrantyApi.list({ page_size: 200 }))); }
    catch (e) { onNotify?.(errMsg(e, 'Failed to load warranties'), 'error'); }
    finally { setLoading(false); }
  }, [onNotify]);
  useEffect(() => { load(); }, [load]);
  const { pageRows, pagination } = usePagedRows(rows, 'om-war');
  return (
    <div className="space-y-3">
      <TabNote text="Equipment warranties from `/amc/warranties` (Project FK)." />
      {loading ? <EmptyHint text="Loading…" /> : (
        <>
          <SimpleTable
            columns={[
              { key: 'id', label: 'WAR', render: (r) => `WAR-${String(r.id).padStart(4, '0')}` },
              { key: 'asset_type', label: 'Equipment' },
              { key: 'manufacturer', label: 'Manufacturer' },
              { key: 'serial_number', label: 'Serial' },
              { key: 'warranty_end', label: 'Ends', render: (r) => fmtDate(r.warranty_end) },
              { key: 'status', label: 'Status', render: (r) => <Pill tone={r.status === 'Expired' ? 'red' : 'green'}>{r.status}</Pill> },
            ]}
            rows={pageRows}
            empty="No warranty records."
          />
          <TablePagination {...pagination} />
        </>
      )}
    </div>
  );
}

function WarrantyClaimsPanel({ onNotify }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    amcClaimApi.list({ page_size: 200 })
      .then((d) => setRows(normalizeApiRows(d)))
      .catch((e) => onNotify?.(errMsg(e, 'Failed to load claims'), 'error'));
  }, [onNotify]);
  return (
    <div className="space-y-3">
      <TabNote text="Warranty claims from `/amc/claims`." />
      <SimpleTable
        columns={[
          { key: 'id', label: 'Claim', render: (r) => `CLM-${String(r.id).padStart(4, '0')}` },
          { key: 'description', label: 'Description' },
          { key: 'status', label: 'Status', render: (r) => <Pill>{r.status}</Pill> },
          { key: 'created_at', label: 'Date', render: (r) => fmtDate(r.created_at) },
        ]}
        rows={rows}
        empty="No warranty claims yet."
      />
    </div>
  );
}

function EquipmentPanel({ onNotify }) {
  const [rows, setRows] = useState([]);
  const [reps, setReps] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [assets, replacements] = await Promise.all([
        omAssetApi.list({ page_size: 200 }),
        omReplacementApi.list({ page_size: 200 }).catch(() => []),
      ]);
      setRows(normalizeApiRows(assets));
      setReps(normalizeApiRows(replacements));
    } catch (e) { onNotify?.(errMsg(e, 'Failed to load equipment'), 'error'); }
    finally { setLoading(false); }
  }, [onNotify]);
  useEffect(() => { load(); }, [load]);
  const { pageRows, pagination } = usePagedRows(rows, 'om-eq');
  return (
    <div className="space-y-3">
      <TabNote text="Installed equipment (Project FK). Replacements keep old/new serials auditable." />
      {loading ? <EmptyHint text="Loading…" /> : (
        <>
          <SimpleTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'asset_type', label: 'Type' },
              { key: 'manufacturer', label: 'Brand' },
              { key: 'capacity', label: 'Capacity' },
              { key: 'status', label: 'Status' },
              { key: 'installed_on', label: 'Installed', render: (r) => fmtDate(r.installed_on) },
            ]}
            rows={pageRows}
            empty="No equipment records."
          />
          <TablePagination {...pagination} />
          <h3 className="text-[14px] font-extrabold text-[#111827]">Replacement history</h3>
          <SimpleTable
            columns={[
              { key: 'record_no', label: 'REP' },
              { key: 'asset_name', label: 'Asset' },
              { key: 'old_serial', label: 'Old Serial' },
              { key: 'new_serial', label: 'New Serial' },
              { key: 'status', label: 'Status', render: (r) => <Pill>{r.status}</Pill> },
              { key: 'installed_on', label: 'Installed', render: (r) => fmtDate(r.installed_on) },
            ]}
            rows={reps}
            empty="No replacement history yet."
          />
        </>
      )}
    </div>
  );
}

function ServiceRequestsPanel({ onNotify }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(normalizeApiRows(await amcServiceRequestApi.list({ page_size: 200 }))); }
    catch (e) { onNotify?.(errMsg(e, 'Failed to load service requests'), 'error'); }
    finally { setLoading(false); }
  }, [onNotify]);
  useEffect(() => { load(); }, [load]);
  const { pageRows, pagination } = usePagedRows(rows, 'om-sr');
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button type="button" onClick={load} className={BTN_OUTLINE}><RefreshCw className="size-4" /></button>
      </div>
      {loading ? <EmptyHint text="Loading…" /> : (
        <>
          <SimpleTable
            columns={[
              { key: 'id', label: 'SR No', render: (r) => `SR-${String(r.id).padStart(4, '0')}` },
              { key: 'subject', label: 'Subject' },
              { key: 'priority', label: 'Priority' },
              { key: 'status', label: 'Status', render: (r) => <Pill>{r.status}</Pill> },
              { key: 'requested_date', label: 'Date', render: (r) => fmtDate(r.requested_date) },
              { key: 'assigned_engineer', label: 'Assigned' },
            ]}
            rows={pageRows}
            empty="No service requests yet."
          />
          <TablePagination {...pagination} />
        </>
      )}
    </div>
  );
}

function MaterialRequestsPanel({ onNotify }) {
  const [rows, setRows] = useState([]);
  const [requests, setRequests] = useState([]);
  useEffect(() => {
    Promise.all([
      omSparePartApi.list({ page_size: 200 }).catch(() => []),
      omMaterialRequestApi.list({ page_size: 200 }).catch(() => []),
    ]).then(([parts, mrs]) => {
      setRows(normalizeApiRows(parts));
      setRequests(normalizeApiRows(mrs));
    }).catch((e) => onNotify?.(errMsg(e, 'Failed to load service inventory'), 'error'));
  }, [onNotify]);
  const { pageRows, pagination } = usePagedRows(rows, 'om-inv');
  return (
    <div className="space-y-3">
      <TabNote text="Material requests link Inventory StockMovement — O&M never writes stock directly." />
      <h3 className="text-[14px] font-extrabold text-[#111827]">Material requests</h3>
      <SimpleTable
        columns={[
          { key: 'record_no', label: 'MR' },
          { key: 'job_card_no', label: 'Job Card' },
          { key: 'inventory_item_name', label: 'Item' },
          { key: 'quantity_requested', label: 'Requested' },
          { key: 'quantity_issued', label: 'Issued' },
          { key: 'issue_reference', label: 'Issue Ref' },
          { key: 'status', label: 'Status', render: (r) => <Pill>{r.status}</Pill> },
        ]}
        rows={requests}
        empty="No material requests yet."
      />
      <h3 className="text-[14px] font-extrabold text-[#111827]">Spare catalog</h3>
      <SimpleTable
        columns={[
          { key: 'name', label: 'Part' },
          { key: 'category', label: 'Category' },
          { key: 'linked_inventory_item_name', label: 'Inventory Item' },
          { key: 'stock_qty', label: 'Qty (catalog)' },
        ]}
        rows={pageRows}
        empty="No spare part catalog rows."
      />
      <TablePagination {...pagination} />
    </div>
  );
}

function JobCardsPanel({ onNotify, mode = 'all' }) {
  const [rows, setRows] = useState([]);
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    plant: '', work_description: '', visit_date: '',
    checklist: [{ label: 'Site safety check', done: false }, { label: 'Work verification', done: false }],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [jc, pl] = await Promise.all([
        omJobCardApi.list({ page_size: 200 }),
        omPlantApi.list({ page_size: 200 }).catch(() => []),
      ]);
      setRows(normalizeApiRows(jc));
      setPlants(normalizeApiRows(pl));
    } catch (e) {
      onNotify?.(errMsg(e, 'Failed to load job cards'), 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => { load(); }, [load]);

  const visible = rows.filter((r) => {
    if (mode === 'assignment') return ['Draft', 'Assigned', 'Scheduled'].includes(r.status);
    if (mode === 'checklist') return ['Assigned', 'Scheduled', 'In Progress'].includes(r.status);
    if (mode === 'completion') return ['In Progress', 'Work Completed', 'Customer Confirmation'].includes(r.status);
    if (mode === 'history') return ['Closed', 'Cancelled'].includes(r.status);
    return true;
  });
  const { pageRows, pagination } = usePagedRows(visible, `om-jc-${mode}`);

  const createCard = async () => {
    if (!form.plant) {
      onNotify?.('Select a plant (Customer/Project source).', 'error');
      return;
    }
    setCreating(true);
    try {
      const plant = plants.find((p) => String(p.id) === String(form.plant));
      await omJobCardApi.create({
        plant: Number(form.plant),
        project: plant?.project || null,
        work_description: form.work_description,
        visit_date: form.visit_date || null,
        checklist: form.checklist,
        status: 'Draft',
      });
      onNotify?.('Job card created.', 'success');
      setForm((f) => ({ ...f, plant: '', work_description: '', visit_date: '' }));
      await load();
    } catch (e) {
      onNotify?.(errMsg(e, 'Could not create job card'), 'error');
    } finally {
      setCreating(false);
    }
  };

  const runAction = async (id, fn, label) => {
    try {
      await fn(id);
      onNotify?.(`${label} OK`, 'success');
      await load();
    } catch (e) {
      onNotify?.(errMsg(e, `${label} failed`), 'error');
    }
  };

  return (
    <div className="space-y-3">
      <TabNote text="Job Cards link Plant/Project FKs. Checklist required before Work Completed." />
      {mode === 'all' ? (
        <div className={`${PANEL} grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4`}>
          <label className="text-[12px] font-bold text-[#314a79]">
            Plant
            <select className="mt-1 w-full rounded-[9px] border border-[#d5e0ef] px-3 py-2" value={form.plant} onChange={(e) => setForm((f) => ({ ...f, plant: e.target.value }))}>
              <option value="">Select plant…</option>
              {plants.map((p) => (
                <option key={p.id} value={p.id}>{p.plant_code || `PLT-${p.id}`} — {p.customer_name || p.plant_name}</option>
              ))}
            </select>
          </label>
          <label className="text-[12px] font-bold text-[#314a79]">
            Visit date
            <input type="date" className="mt-1 w-full rounded-[9px] border border-[#d5e0ef] px-3 py-2" value={form.visit_date} onChange={(e) => setForm((f) => ({ ...f, visit_date: e.target.value }))} />
          </label>
          <label className="text-[12px] font-bold text-[#314a79] sm:col-span-2">
            Work description
            <input className="mt-1 w-full rounded-[9px] border border-[#d5e0ef] px-3 py-2" value={form.work_description} onChange={(e) => setForm((f) => ({ ...f, work_description: e.target.value }))} placeholder="Describe service work…" />
          </label>
          <div className="sm:col-span-2 lg:col-span-4">
            <button type="button" disabled={creating} onClick={createCard} className={BTN_PRIMARY}><Plus className="size-4" /> Create Job Card</button>
          </div>
        </div>
      ) : null}
      <div className="flex justify-end">
        <button type="button" onClick={load} className={BTN_OUTLINE}><RefreshCw className="size-4" /></button>
      </div>
      {loading ? <EmptyHint text="Loading…" /> : (
        <>
          <SimpleTable
            columns={[
              { key: 'job_card_no', label: 'JC No', render: (r) => r.job_card_no || `JC-${String(r.id).padStart(5, '0')}` },
              { key: 'customer_name', label: 'Customer' },
              { key: 'plant_name', label: 'Plant' },
              { key: 'assigned_technician_name', label: 'Technician' },
              { key: 'visit_date', label: 'Visit', render: (r) => fmtDate(r.visit_date) },
              { key: 'status', label: 'Status', render: (r) => <Pill>{r.status}</Pill> },
              {
                key: 'actions',
                label: 'Actions',
                render: (r) => (
                  <div className="flex flex-wrap gap-1">
                    {r.status === 'Draft' ? (
                      <button type="button" className={BTN_OUTLINE} onClick={() => runAction(r.id, (id) => omJobCardApi.transition(id, 'Assigned'), 'Assign')}>Mark Assigned</button>
                    ) : null}
                    {r.status === 'Assigned' || r.status === 'Scheduled' ? (
                      <button type="button" className={BTN_OUTLINE} onClick={() => runAction(r.id, omJobCardApi.startWork, 'Start')}>Start</button>
                    ) : null}
                    {r.status === 'In Progress' ? (
                      <button type="button" className={BTN_OUTLINE} onClick={() => runAction(r.id, async (id) => {
                        await omJobCardApi.update(id, {
                          work_performed: r.work_performed || r.work_description || 'Service completed on site',
                          checklist: (r.checklist || []).map((c) => (typeof c === 'object' ? { ...c, done: true } : { label: String(c), done: true })),
                        });
                        return omJobCardApi.completeWork(id);
                      }, 'Complete')}>Complete</button>
                    ) : null}
                    {r.status === 'Work Completed' ? (
                      <button type="button" className={BTN_OUTLINE} onClick={() => runAction(r.id, omJobCardApi.confirmCustomer, 'Confirm')}>Confirm</button>
                    ) : null}
                    {r.status === 'Customer Confirmation' ? (
                      <button type="button" className={BTN_OUTLINE} onClick={() => runAction(r.id, omJobCardApi.close, 'Close')}>Close</button>
                    ) : null}
                  </div>
                ),
              },
            ]}
            rows={pageRows}
            empty="No job cards in this view."
          />
          <TablePagination {...pagination} />
        </>
      )}
    </div>
  );
}

function GenerationPanel({ onNotify }) {
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    omGenerationLogApi.list({ page_size: 200 })
      .then((d) => setLogs(normalizeApiRows(d)))
      .catch((e) => onNotify?.(errMsg(e, 'Failed to load generation'), 'error'));
  }, [onNotify]);
  return (
    <div className="space-y-3">
      <TabNote text="Manual / imported generation only — live inverter data is never fabricated." />
      <SimpleTable
        columns={[
          { key: 'plant_name', label: 'Plant' },
          { key: 'generation_date', label: 'Date', render: (r) => fmtDate(r.generation_date) },
          { key: 'expected_kwh', label: 'Expected' },
          { key: 'actual_kwh', label: 'Actual' },
          { key: 'performance_ratio', label: 'PR %' },
          { key: 'inverter_status', label: 'Inverter' },
          { key: 'source', label: 'Source' },
        ]}
        rows={logs}
        empty="No generation logs yet."
      />
    </div>
  );
}

function PlantPerformancePanel({ onNotify }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    omAssetApi.list({ page_size: 200 })
      .then((d) => setRows(normalizeApiRows(d).filter((r) => r.energy_generated_kwh != null || r.performance_ratio != null)))
      .catch((e) => onNotify?.(errMsg(e, 'Failed to load performance'), 'error'));
  }, [onNotify]);
  return (
    <div className="space-y-3">
      <TabNote text="Asset energy snapshot fields from O&M Assets." />
      <SimpleTable
        columns={[
          { key: 'name', label: 'Asset / Plant' },
          { key: 'energy_generated_kwh', label: 'Generated kWh' },
          { key: 'energy_consumed_kwh', label: 'Consumed kWh' },
          { key: 'performance_ratio', label: 'PR %' },
          { key: 'specific_yield', label: 'Specific Yield' },
        ]}
        rows={rows}
        empty="No asset generation snapshot."
      />
    </div>
  );
}

function ServiceReportsPanel({ onNotify }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    omReportApi.list({ page_size: 200 })
      .then((d) => setRows(normalizeApiRows(d)))
      .catch((e) => onNotify?.(errMsg(e, 'Failed to load reports'), 'error'));
  }, [onNotify]);
  return (
    <div className="space-y-3">
      <SimpleTable
        columns={[
          { key: 'title', label: 'Title', render: (r) => r.title || r.name },
          { key: 'report_type', label: 'Type' },
          { key: 'created_at', label: 'Date', render: (r) => fmtDate(r.created_at) },
        ]}
        rows={rows}
        empty="No service reports yet."
      />
    </div>
  );
}

function FeedbackPanel({ onNotify }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    omFeedbackApi.list({ page_size: 200 })
      .then((d) => setRows(normalizeApiRows(d)))
      .catch((e) => onNotify?.(errMsg(e, 'Failed to load feedback'), 'error'));
  }, [onNotify]);
  return (
    <SimpleTable
      columns={[
        { key: 'job_card_no', label: 'Job Card' },
        { key: 'plant_name', label: 'Plant' },
        { key: 'rating', label: 'Rating' },
        { key: 'service_quality', label: 'Quality' },
        { key: 'remarks', label: 'Remarks' },
        { key: 'feedback_date', label: 'Date', render: (r) => fmtDate(r.feedback_date) },
      ]}
      rows={rows}
      empty="No customer feedback yet."
    />
  );
}

function SettingsHint({ title, note }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[14px] font-extrabold text-[#111827]">{title}</h3>
      <EmptyHint text={note} />
    </div>
  );
}

/* ─── Category pages ──────────────────────────────────────────────────────── */

function DashboardAndPlants({
  Subnav, activeSection, onOpenSection, onNotify, onNavigate, caps, focus, onFocusConsumed, initialTab,
}) {
  const tabs = CATEGORY_TABS['O&M Dashboard & Plant List'];
  const [tab, setTab] = useState(() => (tabs.includes(initialTab) ? initialTab : 'Dashboard'));
  const [plantId, setPlantId] = useState(null);

  useEffect(() => {
    if (tabs.includes(initialTab)) setTab(initialTab);
  }, [initialTab, tabs]);

  useEffect(() => {
    if (focus?.filter !== undefined || focus?.tab === 'Plant List') setTab('Plant List');
    if (focus?.plant) {
      setPlantId(Number(focus.plant));
      setTab('Plant List');
      onFocusConsumed?.();
    }
  }, [focus, onFocusConsumed]);

  if (plantId) {
    return (
      <HubShell title="Plant Profile" Subnav={Subnav} activeSection={activeSection} onOpenSection={onOpenSection}>
        <PlantDetailPage
          plantId={plantId}
          caps={caps}
          onBack={() => setPlantId(null)}
          onNotify={onNotify}
          onOpenSection={onOpenSection}
        />
      </HubShell>
    );
  }

  return (
    <HubShell
      title="O&M Dashboard & Plant List"
      Subnav={Subnav}
      activeSection={activeSection}
      onOpenSection={onOpenSection}
      actions={(
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onOpenSection?.('Service Tickets & Complaints')}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[9px] bg-[#0b8f43] px-4 text-[13px] font-extrabold text-white hover:bg-[#097a39]"
          >
            <Plus className="size-4" /> Raise Ticket
          </button>
          <button type="button" onClick={() => setTab('Plant List')} className={BTN_OUTLINE}>
            Plant List
          </button>
        </div>
      )}
    >
      <HubInnerTabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'Dashboard' ? (
        <OmDashboardPage
          embedded
          Subnav={null}
          activeSection={activeSection}
          onOpenSection={onOpenSection}
          onNavigate={(sec, payload) => {
            if (sec === 'O&M Dashboard & Plant List' || sec === 'Plants') {
              setTab('Plant List');
              onNavigate?.(sec, { ...payload, tab: 'Plant List' });
              return;
            }
            onOpenSection?.(sec);
            onNavigate?.(sec, payload);
          }}
          onNotify={onNotify}
        />
      ) : (
        <PlantsPage
          embedded
          caps={caps}
          Subnav={null}
          activeSection={activeSection}
          onOpenSection={onOpenSection}
          onNotify={onNotify}
          focus={focus}
          onFocusConsumed={onFocusConsumed}
          onOpenPlant={setPlantId}
        />
      )}
    </HubShell>
  );
}

function CategoryPage({
  title, section, tabs, initialTab, Subnav, onOpenSection, onNotify, children,
}) {
  const [tab, setTab] = useState(() => (
    tabs.includes(initialTab) ? initialTab : tabs[0]
  ));
  useEffect(() => {
    if (tabs.includes(initialTab)) setTab(initialTab);
  }, [initialTab, tabs]);

  return (
    <HubShell title={title} Subnav={Subnav} activeSection={section} onOpenSection={onOpenSection}>
      <HubInnerTabs tabs={tabs} value={tab} onChange={setTab} />
      {children(tab, onNotify)}
    </HubShell>
  );
}

/**
 * Main O&M router — Task 11: 8 sidebar sections.
 */
export function OmHubPage({
  activeSection, onOpenSection, onNotify, loggedInUser, Subnav, focus, onFocusConsumed, onNavigate,
}) {
  const nav = resolveOmNav(
    activeSection === 'O&M' || activeSection === 'O&M Dashboard'
      ? 'O&M Dashboard & Plant List'
      : activeSection,
  );
  const section = nav.section;
  const tab = nav.tab;
  const caps = useMemo(() => omCaps(loggedInUser), [loggedInUser]);
  const shared = { Subnav, onOpenSection, onNotify };

  if (section === 'O&M Dashboard & Plant List') {
    return (
      <DashboardAndPlants
        {...shared}
        activeSection={section}
        onNavigate={onNavigate}
        caps={caps}
        focus={focus}
        onFocusConsumed={onFocusConsumed}
        initialTab={tab || focus?.tab || 'Dashboard'}
      />
    );
  }

  if (section === 'Service Tickets & Complaints') {
    const tabs = CATEGORY_TABS['Service Tickets & Complaints'];
    return (
      <CategoryPage title="Service Tickets & Complaints" section={section} tabs={tabs} initialTab={tab} {...shared}>
        {(t) => {
          if (t === 'Complaint Tickets') {
            return (
              <ComplaintTicketsList
                caps={caps}
                onNotify={onNotify}
                focusId={focus?.ticket}
                onFocusConsumed={onFocusConsumed}
                embedded
              />
            );
          }
          if (t === 'Service Requests') return <ServiceRequestsPanel onNotify={onNotify} />;
          if (t === 'Job Cards') return <JobCardsPanel onNotify={onNotify} mode="all" />;
          if (t === 'Site Visits') return <ServiceVisitsList caps={caps} onNotify={onNotify} embedded />;
          if (t === 'Material Requests') return <MaterialRequestsPanel onNotify={onNotify} />;
          return null;
        }}
      </CategoryPage>
    );
  }

  if (section === 'Quarterly Preventive Maintenance') {
    return (
      <HubShell title="Quarterly Preventive Maintenance" Subnav={Subnav} activeSection={section} onOpenSection={onOpenSection}>
        <TabNote text="20 quarterly services across 5-year free O&M window — scheduled on plant activation." />
        <ServiceTasksList
          quarterly
          caps={caps}
          onNotify={onNotify}
          focusId={focus?.task}
          onFocusConsumed={onFocusConsumed}
          embedded
        />
      </HubShell>
    );
  }

  if (section === 'Panel Cleaning Management') {
    return (
      <HubShell title="Panel Cleaning Management" Subnav={Subnav} activeSection={section} onOpenSection={onOpenSection}>
        <TabNote text="Default plan: 18 free cleanings / year during warranty. Source=`Cleaning` tasks — chemicals, photos & expenses via service visit form." />
        <ServiceTasksList
          cleaning
          caps={caps}
          onNotify={onNotify}
          focusId={focus?.task}
          onFocusConsumed={onFocusConsumed}
          embedded
        />
      </HubShell>
    );
  }

  if (section === 'Warranty Management') {
    const tabs = CATEGORY_TABS['Warranty Management'];
    return (
      <CategoryPage title="Warranty Management" section={section} tabs={tabs} initialTab={tab} {...shared}>
        {(t) => {
          if (t === 'Equipment Warranties') return <WarrantyPanel onNotify={onNotify} />;
          if (t === 'Warranty Claims') return <WarrantyClaimsPanel onNotify={onNotify} />;
          if (t === 'Equipment Replacement') return <EquipmentPanel onNotify={onNotify} />;
          return null;
        }}
      </CategoryPage>
    );
  }

  if (section === 'Insurance Management') {
    return (
      <HubShell title="Insurance Management" Subnav={Subnav} activeSection={section} onOpenSection={onOpenSection}>
        <TabNote text="Yearly / multi-year policies with renewal & 30-day expiry alerts. Linked to OmPlant (no duplicate customer master)." />
        <InsuranceList
          caps={caps}
          onNotify={onNotify}
          initialAlert={focus?.alert || ''}
          focusId={focus?.policy}
          onFocusConsumed={onFocusConsumed}
        />
      </HubShell>
    );
  }

  if (section === 'Paid AMC Management') {
    const tabs = CATEGORY_TABS['Paid AMC Management'];
    return (
      <CategoryPage title="Paid AMC Management" section={section} tabs={tabs} initialTab={tab} {...shared}>
        {(t) => {
          if (t === 'AMC Contracts') return <AmcContractsPanel onNotify={onNotify} />;
          if (t === 'AMC Renewals') return <AmcRenewalsPanel onNotify={onNotify} />;
          if (t === 'AMC Expiry') return <AmcContractsPanel onNotify={onNotify} expiryOnly />;
          return null;
        }}
      </CategoryPage>
    );
  }

  if (section === 'Service History & Reports') {
    const tabs = CATEGORY_TABS['Service History & Reports'];
    return (
      <CategoryPage title="Service History & Reports" section={section} tabs={tabs} initialTab={tab} {...shared}>
        {(t) => {
          if (t === 'Generation Records') return <GenerationPanel onNotify={onNotify} />;
          if (t === 'Plant Performance') return <PlantPerformancePanel onNotify={onNotify} />;
          if (t === 'Service Reports') return <ServiceReportsPanel onNotify={onNotify} />;
          if (t === 'Customer Feedback') return <FeedbackPanel onNotify={onNotify} />;
          if (t === 'Job Card History') return <JobCardsPanel onNotify={onNotify} mode="history" />;
          return null;
        }}
      </CategoryPage>
    );
  }

  return (
    <DashboardAndPlants
      {...shared}
      activeSection="O&M Dashboard & Plant List"
      onNavigate={onNavigate}
      caps={caps}
      focus={focus}
      onFocusConsumed={onFocusConsumed}
      initialTab="Dashboard"
    />
  );
}
