/**
 * O&M Hub — new sidebar structure (master prompt §3).
 * Reuses existing om/amc APIs; no duplicate masters.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Calendar, CheckCircle2, ClipboardList, FileText, IndianRupee,
  Plus, RefreshCw, Shield, Ticket, Wrench,
} from 'lucide-react';
import {
  amcModuleApi,
  omAssetApi, omDashboardApi, omFeedbackApi, omGenerationLogApi,
  omJobCardApi, omMaterialRequestApi, omPlantApi, omReplacementApi,
  omReportApi, omSparePartApi,
} from './api.js';
import { normalizeApiRows } from './lib/utils.js';
import {
  ComplaintTicketsList, OmListPage, ServiceTasksList, ServiceVisitsList, omCaps,
} from './omServicePages.jsx';
import { BTN_OUTLINE, BTN_PRIMARY, PANEL, Pill, SearchBox, fmtDate, fmtMoney } from './omUi.jsx';
import { TablePagination, usePagedRows } from './components/TablePagination.jsx';

const amcContractApi = amcModuleApi.contracts;
const amcServiceRequestApi = amcModuleApi.serviceRequests;
const amcWarrantyApi = amcModuleApi.warranties;

export const OM_HUB_ROUTES = {
  'O&M Dashboard': '/om/dashboard',
  'AMC Management': '/om/amc',
  'Service Requests': '/om/service-requests',
  'Complaint Management': '/om/complaints',
  'Preventive Maintenance': '/om/preventive',
  'Job Cards': '/om/job-cards',
  'Site Visits': '/om/site-visits',
  'Warranty Management': '/om/warranty',
  'Equipment & Replacement': '/om/equipment',
  'Service Inventory': '/om/service-inventory',
  'Plant Performance': '/om/plant-performance',
  'Service Reports': '/om/service-reports',
  'Customer Feedback': '/om/feedback',
  'O&M Settings': '/om/settings',
};

export const OM_HUB_SECTIONS = Object.keys(OM_HUB_ROUTES);

const LEGACY_TO_HUB = {
  'O&M Overview': 'O&M Dashboard',
  Plants: 'O&M Dashboard',
  'Quarterly Services': 'Preventive Maintenance',
  'Complaint Tickets': 'Complaint Management',
  'Service Tasks': 'Preventive Maintenance',
  'My Tasks': 'Service Requests',
  Insurance: 'Warranty Management',
  'Asset Management': 'Equipment & Replacement',
  'Spare Parts': 'Service Inventory',
  'O&M Reports': 'Service Reports',
  Reports: 'Service Reports',
  'Maintenance Tasks': 'Preventive Maintenance',
  'Breakdown Tickets': 'Complaint Management',
  'Site Visits': 'Site Visits',
  'AMC Overview': 'AMC Management',
  'AMC Contracts': 'AMC Management',
  Warranties: 'Warranty Management',
};

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

function OmHubDashboard({ Subnav, activeSection, onOpenSection, onNotify, onNavigate }) {
  const [data, setData] = useState(null);
  const [amcRows, setAmcRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, contracts] = await Promise.all([
        omDashboardApi.get().catch(() => null),
        amcContractApi.list({ page_size: 200 }).catch(() => []),
      ]);
      setData(dash);
      setAmcRows(normalizeApiRows(contracts));
    } catch (e) {
      onNotify?.(errMsg(e, 'Failed to load O&M dashboard'), 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => { load(); }, [load]);

  const s = data?.summary || data || {};
  const activeAmc = s.active_amc ?? amcRows.filter((r) => r.status === 'Active' || r.status === 'Expiring Soon').length;
  const expiringAmc = amcRows.filter((r) => r.status === 'Expiring Soon' || r.status === 'Expired');
  const amcRevenue = s.amc_revenue ?? amcRows.reduce((sum, r) => sum + Number(r.annual_value || 0), 0);

  const kpis = [
    { label: 'Total Active AMC', value: activeAmc, icon: Shield, tone: 'green' },
    { label: "Today's Service Visits", value: s.today_visits ?? s.todays_tasks ?? 0, icon: Calendar, tone: 'blue' },
    { label: 'Open Complaints', value: s.open_tickets ?? 0, icon: Ticket, tone: 'red' },
    { label: 'Pending Job Cards', value: s.pending_job_cards ?? 0, icon: ClipboardList, tone: 'amber' },
    { label: 'Completed Services', value: s.completed_services ?? 0, icon: CheckCircle2, tone: 'green' },
    { label: 'Warranty Expiring Soon', value: s.warranty_expiring ?? 0, icon: AlertTriangle, tone: 'amber' },
    { label: 'AMC Revenue', value: fmtMoney(amcRevenue), icon: IndianRupee, tone: 'purple' },
    { label: 'Pending AMC Payments', value: s.pending_amc_payments ?? '—', icon: IndianRupee, tone: 'slate' },
  ];

  return (
    <HubShell title="O&M Dashboard" Subnav={Subnav} activeSection={activeSection} onOpenSection={onOpenSection} actions={(
      <button type="button" onClick={load} className={BTN_OUTLINE}><RefreshCw className="size-4" /> Refresh</button>
    )}>
      {loading ? <EmptyHint text="Loading dashboard…" /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((k) => (
              <article key={k.label} className={`${PANEL} p-4`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-bold text-[#64748b]">{k.label}</p>
                  <k.icon className="size-4 text-[#0b8f43]" />
                </div>
                <p className="mt-2 text-[22px] font-extrabold text-[#1e3261]">{k.value}</p>
              </article>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-[14px] font-extrabold text-[#111827]">AMC Expiry Alerts</h3>
              <SimpleTable
                empty="No AMC expiry alerts."
                columns={[
                  { key: 'id', label: 'AMC', render: (r) => `AMC-${String(r.id).padStart(4, '0')}` },
                  { key: 'customer_name', label: 'Customer' },
                  { key: 'end_date', label: 'End', render: (r) => fmtDate(r.end_date) },
                  { key: 'status', label: 'Status', render: (r) => <Pill tone={r.status === 'Expired' ? 'red' : 'amber'}>{r.status}</Pill> },
                ]}
                rows={expiringAmc.slice(0, 8)}
              />
            </div>
            <div>
              <h3 className="mb-2 text-[14px] font-extrabold text-[#111827]">Quick Links</h3>
              <div className={`${PANEL} grid gap-2 p-4 sm:grid-cols-2`}>
                {[
                  ['Complaint Management', 'Open tickets'],
                  ['Service Requests', 'Create / assign'],
                  ['Site Visits', "Today's schedule"],
                  ['AMC Management', 'Contracts'],
                  ['Job Cards', 'Work orders'],
                  ['Preventive Maintenance', 'Schedules'],
                ].map(([sec, hint]) => (
                  <button key={sec} type="button" onClick={() => onOpenSection?.(sec)} className="rounded-[10px] border border-[#e7eef7] bg-[#f8fbff] px-3 py-2.5 text-left hover:border-[#0b8f43]">
                    <span className="block text-[13px] font-extrabold text-[#1e3261]">{sec}</span>
                    <span className="text-[11px] font-semibold text-[#8a98af]">{hint}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </HubShell>
  );
}

function AmcManagementPage({ Subnav, activeSection, onOpenSection, onNotify }) {
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
    const hay = `${r.customer_name} ${r.site} ${r.contract_type} ${r.status}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });
  const { pageRows, pagination } = usePagedRows(filtered, 'om-amc', { resetKey: q });

  return (
    <HubShell title="AMC Management" Subnav={Subnav} activeSection={activeSection} onOpenSection={onOpenSection} actions={(
      <div className="flex gap-2">
        <button type="button" onClick={load} className={BTN_OUTLINE}><RefreshCw className="size-4" /></button>
      </div>
    )}>
      <p className="text-[12px] font-semibold text-[#7386a3]">
        Source of truth: existing AMC module (`/amc/contracts`). Customer/Project linked via Project FK — no duplicate AMC tables.
      </p>
      <SearchBox value={q} onChange={setQ} placeholder="Search customer, site, type…" />
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
            empty="No AMC contracts yet. Create from AMC module or add via API."
          />
          <TablePagination {...pagination} />
        </>
      )}
    </HubShell>
  );
}

function ServiceRequestsPage({ Subnav, activeSection, onOpenSection, onNotify }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(normalizeApiRows(await amcServiceRequestApi.list({ page_size: 200 })));
    } catch (e) {
      onNotify?.(errMsg(e, 'Failed to load service requests'), 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => { load(); }, [load]);
  const { pageRows, pagination } = usePagedRows(rows, 'om-sr');

  return (
    <HubShell title="Service Requests" Subnav={Subnav} activeSection={activeSection} onOpenSection={onOpenSection} actions={(
      <button type="button" onClick={load} className={BTN_OUTLINE}><RefreshCw className="size-4" /></button>
    )}>
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
    </HubShell>
  );
}

function WarrantyPage({ Subnav, activeSection, onOpenSection, onNotify }) {
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
    <HubShell title="Warranty Management" Subnav={Subnav} activeSection={activeSection} onOpenSection={onOpenSection}>
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
    </HubShell>
  );
}

function EquipmentPage({ Subnav, activeSection, onOpenSection, onNotify }) {
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
    <HubShell title="Equipment & Replacement" Subnav={Subnav} activeSection={activeSection} onOpenSection={onOpenSection}>
      <p className="text-[12px] font-semibold text-[#7386a3]">Installed equipment from O&amp;M Assets (Project FK). Replacements keep old/new serials auditable — no overwrite of history.</p>
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
          <h3 className="mt-4 text-[14px] font-extrabold text-[#111827]">Replacement history</h3>
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
    </HubShell>
  );
}

function ServiceInventoryPage({ Subnav, activeSection, onOpenSection, onNotify }) {
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
    <HubShell title="Service Inventory" Subnav={Subnav} activeSection={activeSection} onOpenSection={onOpenSection}>
      <p className="text-[12px] font-semibold text-[#7386a3]">
        Parts catalog + material requests. Stock issue/return only via Inventory StockMovement (`link-issue` API) — O&amp;M never writes stock.
      </p>
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
      <h3 className="mt-4 text-[14px] font-extrabold text-[#111827]">Spare catalog</h3>
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
    </HubShell>
  );
}

function PlantPerformancePage({ Subnav, activeSection, onOpenSection, onNotify }) {
  const [rows, setRows] = useState([]);
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    Promise.all([
      omAssetApi.list({ page_size: 200 }).catch(() => []),
      omGenerationLogApi.list({ page_size: 200 }).catch(() => []),
    ]).then(([assets, gen]) => {
      setRows(normalizeApiRows(assets).filter((r) => r.energy_generated_kwh != null || r.performance_ratio != null));
      setLogs(normalizeApiRows(gen));
    }).catch((e) => onNotify?.(errMsg(e, 'Failed to load performance'), 'error'));
  }, [onNotify]);

  return (
    <HubShell title="Plant Performance" Subnav={Subnav} activeSection={activeSection} onOpenSection={onOpenSection}>
      <p className="text-[12px] font-semibold text-[#7386a3]">
        Manual / imported generation only. Live inverter feed not fabricated.
      </p>
      <h3 className="text-[14px] font-extrabold text-[#111827]">Generation logs</h3>
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
      <h3 className="mt-4 text-[14px] font-extrabold text-[#111827]">Asset snapshot</h3>
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
    </HubShell>
  );
}

function ServiceReportsPage({ Subnav, activeSection, onOpenSection, onNotify }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    omReportApi.list({ page_size: 200 })
      .then((d) => setRows(normalizeApiRows(d)))
      .catch((e) => onNotify?.(errMsg(e, 'Failed to load reports'), 'error'));
  }, [onNotify]);
  return (
    <HubShell title="Service Reports" Subnav={Subnav} activeSection={activeSection} onOpenSection={onOpenSection}>
      <SimpleTable
        columns={[
          { key: 'title', label: 'Title' },
          { key: 'report_type', label: 'Type' },
          { key: 'created_at', label: 'Date', render: (r) => fmtDate(r.created_at) },
        ]}
        rows={rows}
        empty="No service reports yet."
      />
    </HubShell>
  );
}

function PlaceholderPage({ title, note, Subnav, activeSection, onOpenSection }) {
  return (
    <HubShell title={title} Subnav={Subnav} activeSection={activeSection} onOpenSection={onOpenSection}>
      <EmptyHint text={note || `${title} — Phase 3+ APIs wiring in progress. Navigation and ownership rules are live.`} />
    </HubShell>
  );
}

function JobCardsPage({ Subnav, activeSection, onOpenSection, onNotify }) {
  const [rows, setRows] = useState([]);
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ plant: '', work_description: '', visit_date: '', checklist: [{ label: 'Site safety check', done: false }, { label: 'Work verification', done: false }] });

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
  const { pageRows, pagination } = usePagedRows(rows, 'om-jc');

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
      setForm({ plant: '', work_description: '', visit_date: '', checklist: form.checklist.map((c) => ({ ...c, done: false })) });
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
    <HubShell title="Job Cards" Subnav={Subnav} activeSection={activeSection} onOpenSection={onOpenSection} actions={(
      <button type="button" onClick={load} className={BTN_OUTLINE}><RefreshCw className="size-4" /></button>
    )}>
      <p className="text-[12px] font-semibold text-[#7386a3]">
        Job Cards link Plant/Project FKs (Customer Master + Project Management). Checklist required before Work Completed.
      </p>
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
      {loading ? <EmptyHint text="Loading…" /> : (
        <>
          <SimpleTable
            columns={[
              { key: 'job_card_no', label: 'JC No', render: (r) => r.job_card_no || `JC-${String(r.id).padStart(5, '0')}` },
              { key: 'customer_name', label: 'Customer' },
              { key: 'plant_name', label: 'Plant' },
              { key: 'visit_date', label: 'Visit', render: (r) => fmtDate(r.visit_date) },
              { key: 'status', label: 'Status', render: (r) => <Pill>{r.status}</Pill> },
              {
                key: 'actions',
                label: 'Actions',
                render: (r) => (
                  <div className="flex flex-wrap gap-1">
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
                    {r.status === 'Draft' ? (
                      <button type="button" className={BTN_OUTLINE} onClick={() => runAction(r.id, (id) => omJobCardApi.transition(id, 'Assigned'), 'Assign')}>Mark Assigned</button>
                    ) : null}
                  </div>
                ),
              },
            ]}
            rows={pageRows}
            empty="No job cards yet."
          />
          <TablePagination {...pagination} />
        </>
      )}
    </HubShell>
  );
}

function FeedbackPage({ Subnav, activeSection, onOpenSection, onNotify }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    omFeedbackApi.list({ page_size: 200 })
      .then((d) => setRows(normalizeApiRows(d)))
      .catch((e) => onNotify?.(errMsg(e, 'Failed to load feedback'), 'error'));
  }, [onNotify]);
  return (
    <HubShell title="Customer Feedback" Subnav={Subnav} activeSection={activeSection} onOpenSection={onOpenSection}>
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
    </HubShell>
  );
}

/**
 * Main O&M router for new hub sections.
 */
export function OmHubPage({
  activeSection, onOpenSection, onNotify, loggedInUser, Subnav, focus, onFocusConsumed, onNavigate,
}) {
  const raw = LEGACY_TO_HUB[activeSection] || activeSection;
  const section = OM_HUB_SECTIONS.includes(raw) ? raw : 'O&M Dashboard';
  const caps = useMemo(() => omCaps(loggedInUser), [loggedInUser]);

  const shared = { Subnav, activeSection: section, onOpenSection, onNotify };

  if (section === 'O&M Dashboard') {
    return <OmHubDashboard {...shared} onNavigate={onNavigate} />;
  }
  if (section === 'AMC Management') return <AmcManagementPage {...shared} />;
  if (section === 'Service Requests') return <ServiceRequestsPage {...shared} />;
  if (section === 'Complaint Management') {
    return (
      <OmListPage title="Complaint Management" {...shared}>
        <ComplaintTicketsList caps={caps} onNotify={onNotify} focusId={focus?.ticket} onFocusConsumed={onFocusConsumed} />
      </OmListPage>
    );
  }
  if (section === 'Preventive Maintenance') {
    return (
      <OmListPage title="Preventive Maintenance" {...shared}>
        <ServiceTasksList quarterly caps={caps} onNotify={onNotify} focusId={focus?.task} onFocusConsumed={onFocusConsumed} />
      </OmListPage>
    );
  }
  if (section === 'Site Visits') {
    return (
      <OmListPage title="Site Visits" {...shared}>
        <ServiceVisitsList caps={caps} onNotify={onNotify} />
      </OmListPage>
    );
  }
  if (section === 'Warranty Management') return <WarrantyPage {...shared} />;
  if (section === 'Equipment & Replacement') return <EquipmentPage {...shared} />;
  if (section === 'Service Inventory') return <ServiceInventoryPage {...shared} />;
  if (section === 'Plant Performance') return <PlantPerformancePage {...shared} />;
  if (section === 'Service Reports') return <ServiceReportsPage {...shared} />;
  if (section === 'Job Cards') return <JobCardsPage {...shared} />;
  if (section === 'Customer Feedback') return <FeedbackPage {...shared} />;
  if (section === 'O&M Settings') {
    return (
      <PlaceholderPage
        {...shared}
        title="O&M Settings"
        note="Configurable masters via /om/settings/ API (key/value JSON). Seed complaint categories & SLA from admin or upcoming Settings UI."
      />
    );
  }
  return <OmHubDashboard {...shared} onNavigate={onNavigate} />;
}
