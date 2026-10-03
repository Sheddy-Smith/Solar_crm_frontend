import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, BadgeCheck, Building2, Calendar, CheckCircle2, ClipboardList, Clock, FileText,
  Gauge, History, MapPin, Pencil, Phone, Plus, RefreshCw, ShieldAlert, ShieldCheck, ShieldX, Siren, SlidersHorizontal,
  Sun, Upload, Wrench, Zap,
} from 'lucide-react';
import { getMediaUrl, omDashboardApi, omDocumentApi, omInsuranceApi, omPlantApi, projectApi } from './api.js';
import { MobileRecordCard } from './components/mobile/MobileRecordCard.jsx';
import { UnderlineTabs } from './components/UnderlineTabs.jsx';
import { MobileSubnavSelect } from './components/mobile/MobileSubnavSelect.jsx';
import {
  BTN_OUTLINE, BTN_PRIMARY, BTN_SMALL, CounterTile, DataList, DetailGrid, Field, FilterChips, INPUT, Modal,
  OmHeading, PANEL, Pill, PlantPicker, SearchBox, SelectInput, TEXTAREA, cx, daysText, fmtDate, fmtDateTime,
  fmtMoney, normalizeApiRows, useEngineers, usePlantOptions,
} from './omUi.jsx';
import {
  ComplaintTicketsList, OmListPage, OmMyTasksPage, ServiceFormWizard, ServiceTasksList, ServiceVisitsList,
  VisitDetailModal, omCaps,
} from './omServicePages.jsx';

export const OM_SECTION_ROUTES = {
  'O&M Dashboard': '/om/dashboard',
  Plants: '/om/plants',
  'Quarterly Services': '/om/quarterly-services',
  'Complaint Tickets': '/om/complaint-tickets',
  'Service Tasks': '/om/tasks',
  'Service Visits': '/om/service-visits',
  Insurance: '/om/insurance',
  'My Tasks': '/om/my-tasks',
};
export const OM_MODULE_SECTIONS = Object.keys(OM_SECTION_ROUTES);
/** Old O&M sub-pages → their replacements, so bookmarks keep working. */
export const OM_LEGACY_SECTIONS = {
  'O&M Overview': 'O&M Dashboard',
  'Maintenance Tasks': 'Service Tasks',
  'Breakdown Tickets': 'Complaint Tickets',
  'Site Visits': 'Service Visits',
};

const OM_STATUSES = ['Free Service Active', 'Free Service Expiring Soon', 'Free Service Expired', 'Paid O&M', 'AMC Active', 'AMC Expired'];
const PLANT_FILTERS = [
  { value: 'service_due', label: 'Service due (15 days)' },
  { value: 'service_overdue', label: 'Service overdue' },
  { value: 'open_tickets', label: 'Open complaints' },
  { value: 'critical_tickets', label: 'Critical complaints' },
  { value: 'no_pending_complaints', label: 'No pending complaints' },
  { value: 'free_service', label: 'Free service active' },
  { value: 'free_expiring', label: 'Free service expiring (30 days)' },
  { value: 'free_expired', label: 'Free service expired' },
  { value: 'paid', label: 'Paid O&M / AMC' },
  { value: 'active', label: 'Active plants' },
  { value: 'insurance_active', label: 'Insurance active' },
  { value: 'insurance_expiring', label: 'Insurance expiring (30 days)' },
  { value: 'insurance_expired', label: 'Insurance expired' },
  { value: 'not_insured', label: 'Not insured' },
];
const filterLabel = (key) => PLANT_FILTERS.find((f) => f.value === key)?.label || '';

function errMsg(e, fallback) {
  return e?.message || fallback;
}

function insuranceTone(status) {
  if (status === 'Insured') return 'green';
  if (status === 'Expired') return 'red';
  return 'slate';
}

function InsuranceChip({ insurance }) {
  if (!insurance) return null;
  const { status, days_to_expiry: days } = insurance;
  const expiring = status === 'Insured' && days != null && days <= 30;
  return (
    <Pill tone={expiring ? 'amber' : insuranceTone(status)}>
      {expiring ? `Expiring ${daysText(days)}` : status}
    </Pill>
  );
}

function FreeServiceText({ plant }) {
  if (!plant.free_service_end) return <span className="text-[#8a98af]">—</span>;
  const days = plant.days_to_free_expiry;
  return (
    <div>
      <p>{fmtDate(plant.free_service_end)}</p>
      <p className={cx('text-[11px] font-bold', days < 0 ? 'text-[#dc2626]' : days <= 90 ? 'text-[#c97a00]' : 'text-[#8a98af]')}>
        {days < 0 ? `Expired ${daysText(days)}` : `Ends ${daysText(days)}`}
      </p>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

const TILES = [
  { key: 'total_plants', label: 'Total Plants', icon: Sun, tone: 'blue', go: ['Plants', { filter: '' }] },
  { key: 'active_plants', label: 'Active Plants', icon: Zap, tone: 'green', go: ['Plants', { filter: 'active' }] },
  { key: 'free_service_plants', label: 'Free Service Plants', icon: BadgeCheck, tone: 'teal', go: ['Plants', { filter: 'free_service' }] },
  { key: 'expired_service_plants', label: 'Free Service Expired', icon: Clock, tone: 'red', go: ['Plants', { filter: 'free_expired' }] },
  { key: 'paid_plants', label: 'Paid O&M / AMC', icon: Building2, tone: 'purple', go: ['Plants', { filter: 'paid' }] },
  { key: 'service_due', label: 'Service Due (15 days)', icon: Calendar, tone: 'amber', go: ['Plants', { filter: 'service_due' }] },
  { key: 'service_overdue', label: 'Service Overdue', icon: AlertTriangle, tone: 'red', go: ['Plants', { filter: 'service_overdue' }] },
  { key: 'open_tickets', label: 'Open Complaints', icon: Siren, tone: 'purple', go: ['Complaint Tickets', {}] },
  { key: 'critical_complaints', label: 'Critical Complaints', icon: ShieldAlert, tone: 'red', go: ['Plants', { filter: 'critical_tickets' }] },
  { key: 'todays_tasks', label: "Today's Tasks", icon: ClipboardList, tone: 'blue', go: ['Service Tasks', {}] },
  { key: 'upcoming_visits', label: 'Upcoming Visits (7 days)', icon: Wrench, tone: 'teal', go: ['Service Tasks', {}] },
  { key: 'insurance_active', label: 'Insurance Active', icon: ShieldCheck, tone: 'green', go: ['Insurance', { alert: 'active' }] },
  { key: 'insurance_expiring', label: 'Insurance Expiring', icon: ShieldAlert, tone: 'amber', go: ['Insurance', { alert: 'expiring' }] },
  { key: 'insurance_expired', label: 'Insurance Expired', icon: ShieldX, tone: 'red', go: ['Insurance', { alert: 'expired' }] },
];

function AlertCard({ title, tone, icon: Icon, items, onOpen }) {
  const head = { red: 'bg-[#fef2f2] text-[#b91c1c]', amber: 'bg-[#fff7e8] text-[#b45309]', green: 'bg-[#ecfdf3] text-[#047857]' }[tone];
  const dot = { red: 'bg-[#dc2626]', amber: 'bg-[#f59e0b]', green: 'bg-[#16a34a]' }[tone];
  const total = items.reduce((s, i) => s + (i.count || 0), 0);
  return (
    <section className={cx(PANEL, 'overflow-hidden')}>
      <header className={cx('flex items-center justify-between gap-2 px-4 py-3', head)}>
        <span className="flex items-center gap-2 text-[14px] font-extrabold"><Icon className="size-4" />{title}</span>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[12px] font-extrabold">{total}</span>
      </header>
      <ul className="divide-y divide-[#eef2f8]">
        {items.map((item) => (
          <li key={item.key}>
            <button type="button" onClick={() => onOpen(item.key)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#f8fbff]">
              <span className="flex items-center gap-2.5 text-[13px] font-bold text-[#1e3261]">
                <span className={cx('size-2 rounded-full', item.count ? dot : 'bg-[#cbd5e1]')} />{item.label}
              </span>
              <span className={cx('text-[15px] font-extrabold', item.count ? 'text-[#111827]' : 'text-[#a0aec0]')}>{item.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OmDashboardPage({ Subnav, activeSection, onOpenSection, onNavigate, onNotify }) {
  const [data, setData] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    omDashboardApi.get()
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) { setData({ summary: {}, alerts: { critical: [], upcoming: [], active: [] } }); onNotify?.(errMsg(e, 'Could not load O&M dashboard.'), 'error'); } });
    return () => { alive = false; };
  }, [tick, onNotify]);
  const s = data?.summary || {};
  const openPlants = (key) => onNavigate('Plants', { filter: key });

  return (
    <OmListPage
      title="O&M Dashboard"
      Subnav={Subnav}
      activeSection={activeSection}
      onOpenSection={onOpenSection}
      actions={<button type="button" className={BTN_OUTLINE} onClick={() => { setData(null); setTick((t) => t + 1); }}><RefreshCw className="size-4" /> Refresh</button>}
    >
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7">
        {TILES.map((t) => (
          <CounterTile key={t.key} label={t.label} value={data ? (s[t.key] ?? 0) : '…'} icon={t.icon} tone={t.tone} onClick={() => onNavigate(t.go[0], t.go[1])} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <AlertCard title="Critical Alerts" tone="red" icon={AlertTriangle} items={data?.alerts?.critical || []} onOpen={openPlants} />
        <AlertCard title="Upcoming Alerts" tone="amber" icon={Clock} items={data?.alerts?.upcoming || []} onOpen={openPlants} />
        <AlertCard title="Active Status" tone="green" icon={CheckCircle2} items={data?.alerts?.active || []} onOpen={openPlants} />
      </div>
      {data?.generated_on ? <p className="text-right text-[11px] font-semibold text-[#8a98af]">Updated {fmtDate(data.generated_on)} · alerts refresh automatically every day</p> : null}
    </OmListPage>
  );
}

// ── Plants list ───────────────────────────────────────────────────────────────

function ActivatePlantModal({ onClose, onSaved, onNotify }) {
  const [projects, setProjects] = useState([]);
  const [query, setQuery] = useState('');
  const [project, setProject] = useState('');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    projectApi.list({ page_size: 2000 }).then((r) => setProjects(normalizeApiRows(r))).catch(() => {});
  }, []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? projects.filter((p) => [p.project_id, p.project_name, p.customer_name, p.mobile_number].some((v) => String(v || '').toLowerCase().includes(q))) : projects;
    return list.slice(0, 200);
  }, [projects, query]);
  const save = async () => {
    if (!project || !date) { onNotify?.('Select the project and commissioning date.', 'error'); return; }
    setSaving(true);
    try {
      const plant = await omPlantApi.create({ project: Number(project), commissioning_date: date });
      onNotify?.(`${plant.plant_code} activated — 20 quarterly services scheduled.`, 'success');
      onSaved?.(plant);
    } catch (e) {
      onNotify?.(errMsg(e, 'Could not activate plant.'), 'error');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title="Activate O&M Plant" subtitle="Usually automatic when Liaisoning → Commissioning is marked Completed" onClose={onClose} size="sm"
      footer={<>
        <button type="button" className={BTN_OUTLINE} onClick={onClose}>Cancel</button>
        <button type="button" className={BTN_PRIMARY} disabled={saving} onClick={save}>{saving ? 'Activating...' : 'Activate'}</button>
      </>}
    >
      <div className="grid grid-cols-1 gap-3">
        <Field label="Project" required>
          <input type="search" className={cx(INPUT, 'mb-1.5')} placeholder="Search project / customer..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <SelectInput value={project} onChange={setProject} placeholder={projects.length ? 'Select project...' : 'Loading...'} options={filtered.map((p) => ({ value: String(p.id), label: [p.project_id, p.customer_name || p.project_name].filter(Boolean).join(' · ') }))} />
        </Field>
        <Field label="Commissioning Date" required hint="Free service = this date + 5 years − 1 day">
          <input type="date" className={INPUT} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function PlantsPage({ caps, Subnav, activeSection, onOpenSection, onNotify, focus, onFocusConsumed, onOpenPlant }) {
  const engineers = useEngineers();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filters, setFilters] = useState({ filter: '', om_status: '', engineer: '', date_from: '', date_to: '', capacity_min: '', capacity_max: '' });
  const [showMore, setShowMore] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [activate, setActivate] = useState(false);

  useEffect(() => {
    if (focus?.filter !== undefined) {
      setFilters((f) => ({ ...f, filter: focus.filter || '' }));
      onFocusConsumed?.();
    }
  }, [focus, onFocusConsumed]);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const key = JSON.stringify({ ...filters, search: debounced });
  useEffect(() => {
    let alive = true;
    setLoading(true);
    omPlantApi.list({ page_size: 2500, ...filters, search: debounced })
      .then((r) => { if (alive) setRows(normalizeApiRows(r)); })
      .catch((e) => { if (alive) { setRows([]); onNotify?.(errMsg(e, 'Could not load plants.'), 'error'); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [key, tick, onNotify]);

  const setF = (k) => (v) => setFilters((f) => ({ ...f, [k]: v }));
  const activeCount = Object.values(filters).filter(Boolean).length;

  const columns = [
    { label: 'Plant', render: (p) => <div><p className="font-extrabold text-[#0b65e5]">{p.plant_code}</p><p className="text-[11px] text-[#8a98af]">{p.project_code}</p></div> },
    { label: 'Customer', render: (p) => <div className="max-w-[220px]"><p className="font-bold">{p.customer_name}</p><p className="text-[11px] text-[#8a98af]">{[p.mobile_number, p.city].filter(Boolean).join(' · ')}</p></div> },
    { label: 'Capacity', render: (p) => <div><p>{p.capacity_kw ? `${Number(p.capacity_kw)} kW` : '—'}</p><p className="text-[11px] text-[#8a98af]">{p.system_type}</p></div> },
    { label: 'Commissioned', render: (p) => fmtDate(p.commissioning_date) },
    { label: 'Free Service', render: (p) => <FreeServiceText plant={p} /> },
    { label: 'O&M Status', render: (p) => <Pill>{p.om_status}</Pill> },
    { label: 'Next Service', render: (p) => (p.next_service ? <div><p className={cx(p.next_service.overdue && 'font-extrabold text-[#dc2626]')}>{fmtDate(p.next_service.due_date)}</p><p className="text-[11px] text-[#8a98af]">{p.next_service.title.replace('Quarterly Service ', 'Q ')}</p></div> : '—') },
    { label: 'Complaints', render: (p) => (p.open_tickets ? <Pill tone="purple">{p.open_tickets} open</Pill> : <span className="text-[#8a98af]">None</span>) },
    { label: 'Insurance', render: (p) => <InsuranceChip insurance={p.insurance} /> },
  ];

  return (
    <OmListPage
      title="Plants"
      Subnav={Subnav}
      activeSection={activeSection}
      onOpenSection={onOpenSection}
      actions={caps.add ? <button type="button" className={BTN_PRIMARY} onClick={() => setActivate(true)}><Plus className="size-4" /> Activate Plant</button> : null}
    >
      <div className={cx(PANEL, 'flex flex-col gap-3 p-3 sm:p-4')}>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <SearchBox value={search} onChange={setSearch} placeholder="Search customer, mobile, PLT-/LD-/CUS- code, invoice, serial, city..." />
          <div className="grid grid-cols-2 gap-2 lg:flex">
            <SelectInput value={filters.filter} onChange={setF('filter')} options={PLANT_FILTERS} placeholder="All plants" className="lg:w-[220px]" />
            <button type="button" className={cx(BTN_OUTLINE, 'h-11 sm:h-9')} onClick={() => setShowMore((v) => !v)}>
              <SlidersHorizontal className="size-4" /> Filters{activeCount ? ` (${activeCount})` : ''}
            </button>
          </div>
        </div>
        {showMore ? (
          <div className="grid grid-cols-2 gap-2 rounded-[12px] bg-[#f8fafd] p-3 md:grid-cols-3 xl:grid-cols-6">
            <Field label="O&M Status"><SelectInput value={filters.om_status} onChange={setF('om_status')} options={OM_STATUSES} placeholder="Any" /></Field>
            <Field label="Engineer"><SelectInput value={filters.engineer} onChange={setF('engineer')} options={engineers.map((u) => ({ value: String(u.id), label: u.name }))} placeholder="Any" /></Field>
            <Field label="Commissioned from"><input type="date" className={INPUT} value={filters.date_from} onChange={(e) => setF('date_from')(e.target.value)} /></Field>
            <Field label="Commissioned to"><input type="date" className={INPUT} value={filters.date_to} onChange={(e) => setF('date_to')(e.target.value)} /></Field>
            <Field label="Capacity min (kW)"><input type="number" className={INPUT} value={filters.capacity_min} onChange={(e) => setF('capacity_min')(e.target.value)} /></Field>
            <Field label="Capacity max (kW)"><input type="number" className={INPUT} value={filters.capacity_max} onChange={(e) => setF('capacity_max')(e.target.value)} /></Field>
            {activeCount ? (
              <button type="button" className={cx(BTN_SMALL, 'col-span-2 justify-center text-[#dc2626] md:col-span-3 xl:col-span-6')} onClick={() => setFilters({ filter: '', om_status: '', engineer: '', date_from: '', date_to: '', capacity_min: '', capacity_max: '' })}>
                Clear all filters
              </button>
            ) : null}
          </div>
        ) : null}
        {filters.filter ? (
          <div className="flex items-center gap-2 text-[12px] font-bold text-[#53647f]">
            Showing: <Pill tone="blue">{filterLabel(filters.filter)}</Pill>
            <button type="button" className="text-[#dc2626]" onClick={() => setF('filter')('')}>Clear</button>
          </div>
        ) : null}
        <DataList
          rows={rows}
          columns={columns}
          loading={loading}
          storageKey="om-plants"
          resetKey={key}
          emptyIcon={Sun}
          emptyTitle="No plants found"
          emptyHint="Plants appear automatically when Liaisoning → Commissioning is Completed."
          onRowClick={(p) => onOpenPlant(p.id)}
          renderCard={(p) => (
            <MobileRecordCard
              key={p.id}
              icon={Sun}
              iconTone="bg-[#fff4e0] text-[#c97a00]"
              title={p.customer_name}
              subtitle={`${p.plant_code} · ${p.capacity_kw ? `${Number(p.capacity_kw)} kW` : ''} ${p.system_type || ''}`}
              badges={<><Pill>{p.om_status}</Pill><InsuranceChip insurance={p.insurance} />{p.open_tickets ? <Pill tone="purple">{p.open_tickets} complaint</Pill> : null}</>}
              details={[
                { label: 'Free service till', value: fmtDate(p.free_service_end), tone: p.days_to_free_expiry < 0 ? 'danger' : undefined },
                { label: 'Next service', value: p.next_service ? fmtDate(p.next_service.due_date) : '', tone: p.next_service?.overdue ? 'danger' : undefined },
                { label: 'City', value: p.city },
                { label: 'Mobile', value: p.mobile_number },
              ]}
              onOpen={() => onOpenPlant(p.id)}
              actions={[
                p.mobile_number ? { label: 'Call', icon: Phone, tone: 'green', href: `tel:${p.mobile_number}` } : null,
                { label: 'Open', icon: FileText, tone: 'blue', onClick: () => onOpenPlant(p.id) },
              ]}
            />
          )}
        />
      </div>
      {activate ? <ActivatePlantModal onClose={() => setActivate(false)} onSaved={(p) => { setActivate(false); setTick((t) => t + 1); onOpenPlant(p.id); }} onNotify={onNotify} /> : null}
    </OmListPage>
  );
}

// ── Plant detail ──────────────────────────────────────────────────────────────

const PROFILE_GROUPS = [
  ['Customer', [
    ['customer_name', 'Customer Name'], ['mobile_number', 'Mobile'], ['alternate_mobile', 'Alternate Mobile'], ['email', 'Email'],
    ['contact_person', 'Contact Person'], ['customer_type', 'Customer Type', ['Residential', 'Commercial', 'Industrial', 'Institutional', 'Other']],
    ['city', 'City'], ['state', 'State'], ['address', 'Address', 'textarea'],
  ]],
  ['Plant', [
    ['plant_name', 'Plant Name'], ['capacity_kw', 'Capacity (kW)', 'number'], ['plant_type', 'Plant Type'],
    ['system_type', 'System Type', ['On Grid', 'Hybrid', 'Off Grid']], ['installation_date', 'Installation Date', 'date'],
    ['handover_date', 'Handover Date', 'date'], ['plant_location', 'Plant Location', 'textarea'],
  ]],
  ['Equipment', [
    ['panel_brand', 'Panel Brand'], ['panel_model', 'Panel Model'], ['panel_wattage_w', 'Panel Wattage (W)'], ['panel_count', 'Panel Count'],
    ['inverter_brand', 'Inverter Brand'], ['inverter_model', 'Inverter Model'], ['inverter_capacity_kw', 'Inverter Capacity (kW)'],
    ['inverter_serial', 'Inverter Serial'], ['structure_type', 'Structure Type'], ['acdb_details', 'ACDB'], ['dcdb_details', 'DCDB'],
    ['panel_serials', 'Panel Serial Numbers', 'textarea'], ['earthing_details', 'Earthing', 'textarea'],
    ['net_meter_details', 'Net Meter', 'textarea'], ['warranty_details', 'Warranty', 'textarea'],
  ]],
  ['O&M', [
    ['om_status', 'O&M Status', OM_STATUSES], ['remarks', 'Remarks', 'textarea'],
  ]],
];

function PlantEditModal({ plant, onClose, onSaved, onNotify }) {
  const [form, setForm] = useState(() => Object.fromEntries(PROFILE_GROUPS.flatMap(([, fields]) => fields.map(([k]) => [k, plant[k] ?? '']))));
  const [commissioning, setCommissioning] = useState(plant.commissioning_date || '');
  const [isActive, setIsActive] = useState(plant.is_active !== false);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.customer_name || !form.plant_name) { onNotify?.('Customer and plant name are required.', 'error'); return; }
    const body = { ...form, is_active: isActive };
    ['capacity_kw', 'installation_date', 'handover_date'].forEach((k) => { if (body[k] === '') body[k] = null; });
    setSaving(true);
    try {
      let saved = await omPlantApi.update(plant.id, body);
      if (commissioning && commissioning !== plant.commissioning_date) {
        saved = await omPlantApi.refresh(plant.id, commissioning);
      }
      onNotify?.(`${saved.plant_code} updated.`, 'success');
      onSaved?.(saved);
    } catch (e) {
      onNotify?.(errMsg(e, 'Could not save plant.'), 'error');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={`Edit ${plant.plant_code}`} subtitle="Snapshot copied from the project — corrections stay on the plant" onClose={onClose} size="lg"
      footer={<>
        <button type="button" className={BTN_OUTLINE} onClick={onClose}>Cancel</button>
        <button type="button" className={BTN_PRIMARY} disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save'}</button>
      </>}
    >
      <div className="space-y-5">
        {PROFILE_GROUPS.map(([group, fields]) => (
          <section key={group}>
            <h3 className="mb-2 text-[13px] font-extrabold text-[#1e3261]">{group}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {fields.map(([k, label, type]) => (
                <Field key={k} label={label} wide={type === 'textarea'}>
                  {Array.isArray(type) ? (
                    <SelectInput value={form[k]} onChange={(v) => setForm((f) => ({ ...f, [k]: v }))} options={type} />
                  ) : type === 'textarea' ? (
                    <textarea className={TEXTAREA} value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
                  ) : (
                    <input type={type || 'text'} className={INPUT} value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
                  )}
                </Field>
              ))}
              {group === 'O&M' ? (
                <>
                  <Field label="Commissioning Date" hint="Changing it moves the free-service window and unvisited quarterly dates">
                    <input type="date" className={INPUT} value={commissioning} onChange={(e) => setCommissioning(e.target.value)} />
                  </Field>
                  <Field label="Plant Active">
                    <SelectInput value={isActive ? 'yes' : 'no'} onChange={(v) => setIsActive(v === 'yes')} options={[{ value: 'yes', label: 'Active' }, { value: 'no', label: 'Inactive' }]} />
                  </Field>
                </>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  );
}

function PlantProfile({ plant }) {
  const groups = [
    ['Customer', [
      ['Customer ID', plant.customer_code], ['Lead ID', plant.lead_code], ['Customer Name', plant.customer_name],
      ['Mobile', plant.mobile_number ? <a key="m" className="text-[#0b65e5]" href={`tel:${plant.mobile_number}`}>{plant.mobile_number}</a> : ''],
      ['Alternate Mobile', plant.alternate_mobile], ['Email', plant.email], ['Contact Person', plant.contact_person],
      ['Customer Type', plant.customer_type], ['City / State', [plant.city, plant.state].filter(Boolean).join(', ')], ['Address', plant.address, true],
    ]],
    ['Plant', [
      ['Plant ID', plant.plant_code], ['Project ID', plant.project_code], ['Plant Name', plant.plant_name],
      ['Capacity', plant.capacity_kw ? `${Number(plant.capacity_kw)} kW` : ''], ['Plant Type', plant.plant_type], ['System Type', plant.system_type],
      ['Installation Date', fmtDate(plant.installation_date)], ['Commissioning Date', fmtDate(plant.commissioning_date)], ['Handover Date', fmtDate(plant.handover_date)],
      ['Location', plant.plant_location, true],
    ]],
    ['Equipment', [
      ['Panels', [plant.panel_brand, plant.panel_model, plant.panel_wattage_w ? `${plant.panel_wattage_w} W` : '', plant.panel_count ? `× ${plant.panel_count}` : ''].filter(Boolean).join(' ')],
      ['Inverter', [plant.inverter_brand, plant.inverter_model, plant.inverter_capacity_kw ? `${plant.inverter_capacity_kw} kW` : ''].filter(Boolean).join(' ')],
      ['Inverter Serial', plant.inverter_serial], ['Structure', plant.structure_type], ['ACDB', plant.acdb_details], ['DCDB', plant.dcdb_details],
      ['Panel Serials', plant.panel_serials, true], ['Earthing', plant.earthing_details, true], ['Net Meter', plant.net_meter_details, true], ['Warranty', plant.warranty_details, true],
    ]],
  ];
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
      {groups.map(([title, rows]) => (
        <section key={title} className={cx(PANEL, 'p-4')}>
          <h3 className="mb-3 text-[14px] font-extrabold text-[#1e3261]">{title}</h3>
          <DetailGrid rows={rows} />
        </section>
      ))}
    </div>
  );
}

function PlantHistory({ plant, caps, onNotify }) {
  const [rows, setRows] = useState(null);
  const [visitId, setVisitId] = useState(null);
  const [logVisit, setLogVisit] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    omPlantApi.history(plant.id).then((r) => { if (alive) setRows(Array.isArray(r) ? r : []); }).catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [plant.id, tick]);
  return (
    <div className={cx(PANEL, 'p-3 sm:p-4')}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[14px] font-extrabold text-[#1e3261]">Lifetime service history</h3>
          <p className="text-[11px] font-semibold text-[#8a98af]">Every visit and every phone-resolved complaint — permanent, never deleted.</p>
        </div>
        {caps.add || caps.field ? <button type="button" className={BTN_PRIMARY} onClick={() => setLogVisit(true)}><Plus className="size-4" /> Log Visit</button> : null}
      </div>
      {!rows ? <p className="py-8 text-center text-[13px] font-semibold text-[#8a98af]">Loading...</p> : rows.length ? (
        <ol className="relative space-y-3 border-l-2 border-[#e2e8f0] pl-4">
          {rows.map((r) => (
            <li key={`${r.kind}-${r.id}`} className="relative">
              <span className={cx('absolute -left-[23px] top-3 size-3 rounded-full border-2 border-white', r.kind === 'visit' ? 'bg-[#0b65e5]' : 'bg-[#7c3aed]')} />
              <button
                type="button"
                disabled={r.kind !== 'visit'}
                onClick={() => r.kind === 'visit' && setVisitId(r.id)}
                className={cx('w-full rounded-[12px] border border-[#eef2f8] p-3 text-left', r.kind === 'visit' && 'hover:bg-[#f8fbff]')}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13px] font-extrabold text-[#1e3261]">{fmtDate(r.date)} · {r.ref}</span>
                  <span className="flex gap-1"><Pill>{r.type}</Pill><Pill>{r.final_status || r.status}</Pill></span>
                </div>
                <p className="mt-1 text-[12px] font-semibold text-[#53647f]">{r.engineer ? `Engineer: ${r.engineer}` : ''}{r.ticket && r.kind === 'visit' ? ` · ${r.ticket}` : ''}</p>
                {r.problem ? <p className="mt-1 text-[12px] font-semibold text-[#1e3261]"><b>Problem:</b> {r.problem}</p> : null}
                {r.action ? <p className="mt-0.5 text-[12px] font-semibold text-[#1e3261]"><b>Action:</b> {r.action}</p> : null}
              </button>
            </li>
          ))}
        </ol>
      ) : <p className="py-8 text-center text-[13px] font-semibold text-[#8a98af]">No service history yet.</p>}
      {visitId ? <VisitDetailModal visitId={visitId} onClose={() => setVisitId(null)} onNotify={onNotify} canEdit={caps.edit} onChanged={() => setTick((t) => t + 1)} /> : null}
      {logVisit ? <ServiceFormWizard plant={plant} onClose={() => setLogVisit(false)} onDone={() => { setLogVisit(false); setTick((t) => t + 1); }} onNotify={onNotify} /> : null}
    </div>
  );
}

function PlantDocuments({ plant, caps, onNotify }) {
  const [rows, setRows] = useState([]);
  const [tick, setTick] = useState(0);
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let alive = true;
    omDocumentApi.list({ plant: plant.id, page_size: 500 }).then((r) => { if (alive) setRows(normalizeApiRows(r)); }).catch(() => {});
    return () => { alive = false; };
  }, [plant.id, tick]);
  const upload = async () => {
    if (!file) { onNotify?.('Choose a file.', 'error'); return; }
    const fd = new FormData();
    fd.append('module', 'Plant');
    fd.append('related_id', plant.id);
    fd.append('plant', plant.id);
    fd.append('category', category);
    fd.append('name', name || file.name);
    fd.append('file', file);
    setSaving(true);
    try {
      await omDocumentApi.create(fd);
      onNotify?.('Document uploaded.', 'success');
      setFile(null);
      setName('');
      setTick((t) => t + 1);
    } catch (e) {
      onNotify?.(errMsg(e, 'Upload failed.'), 'error');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className={cx(PANEL, 'flex flex-col gap-3 p-3 sm:p-4')}>
      {caps.add ? (
        <div className="grid grid-cols-1 gap-2 rounded-[12px] bg-[#f8fafd] p-3 sm:grid-cols-[1fr_160px_1fr_auto] sm:items-end">
          <Field label="Name"><input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Handover report" /></Field>
          <Field label="Category"><SelectInput value={category} onChange={setCategory} options={['General', 'Before', 'After', 'Policy']} /></Field>
          <Field label="File"><input type="file" className={cx(INPUT, 'pt-1.5')} onChange={(e) => setFile(e.target.files?.[0] || null)} /></Field>
          <button type="button" className={BTN_PRIMARY} disabled={saving} onClick={upload}><Upload className="size-4" /> {saving ? 'Uploading...' : 'Upload'}</button>
        </div>
      ) : null}
      {rows.length ? (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((d) => (
            <li key={d.id}>
              <a href={getMediaUrl(d.file)} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-[12px] border border-[#eef2f8] p-3 hover:bg-[#f8fbff]">
                <FileText className="size-5 shrink-0 text-[#0b65e5]" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-bold text-[#1e3261]">{d.name}</span>
                  <span className="block text-[11px] font-semibold text-[#8a98af]">{d.module} · {d.category} · {fmtDateTime(d.uploaded_at)}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : <p className="py-8 text-center text-[13px] font-semibold text-[#8a98af]">No documents yet.</p>}
    </div>
  );
}

const DETAIL_TABS = [
  { value: 'profile', label: 'Profile', icon: Sun },
  { value: 'schedule', label: 'Service Schedule', icon: Calendar },
  { value: 'tickets', label: 'Tickets', icon: Siren },
  { value: 'tasks', label: 'Tasks', icon: ClipboardList },
  { value: 'history', label: 'Visit History', icon: History },
  { value: 'insurance', label: 'Insurance', icon: ShieldCheck },
  { value: 'documents', label: 'Documents', icon: FileText },
];

function PlantDetailPage({ plantId, caps, onBack, onNotify, onOpenSection }) {
  const [plant, setPlant] = useState(null);
  const [tab, setTab] = useState('profile');
  const [edit, setEdit] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    omPlantApi.get(plantId).then((p) => { if (alive) setPlant(p); }).catch((e) => onNotify?.(errMsg(e, 'Could not load plant.'), 'error'));
    return () => { alive = false; };
  }, [plantId, tick, onNotify]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      setPlant(await omPlantApi.refresh(plantId));
      onNotify?.('Blank fields refreshed from the project.', 'success');
    } catch (e) {
      onNotify?.(errMsg(e, 'Refresh failed.'), 'error');
    } finally {
      setRefreshing(false);
    }
  };

  if (!plant) return <div className={cx(PANEL, 'py-16 text-center text-[13px] font-semibold text-[#8a98af]')}>Loading plant...</div>;
  const days = plant.days_to_free_expiry;

  return (
    <div className="space-y-3">
      <OmHeading
        title={plant.customer_name}
        crumbs={[{ label: 'O&M', onClick: () => onOpenSection('O&M Dashboard') }, { label: 'Plants', onClick: onBack }, { label: plant.plant_code }]}
        actions={<>
          <button type="button" className={BTN_OUTLINE} onClick={onBack}><ArrowLeft className="size-4" /> Plants</button>
          {caps.edit ? <button type="button" className={BTN_OUTLINE} disabled={refreshing} onClick={refresh}><RefreshCw className={cx('size-4', refreshing && 'animate-spin')} /> Sync from project</button> : null}
          {caps.edit ? <button type="button" className={BTN_PRIMARY} onClick={() => setEdit(true)}><Pencil className="size-4" /> Edit</button> : null}
        </>}
      />
      <section className={cx(PANEL, 'grid grid-cols-2 gap-3 p-3 sm:p-4 md:grid-cols-3 xl:grid-cols-6')}>
        <div className="col-span-2 md:col-span-3 xl:col-span-2">
          <p className="text-[11px] font-extrabold uppercase text-[#8a98af]">{plant.plant_code} · {plant.project_code}</p>
          <p className="mt-0.5 text-[15px] font-extrabold text-[#1e3261]">{plant.plant_name}</p>
          <p className="mt-0.5 flex items-start gap-1 text-[12px] font-semibold text-[#53647f]"><MapPin className="mt-0.5 size-3.5 shrink-0" />{plant.plant_location || plant.city || '—'}</p>
          <div className="mt-2 flex flex-wrap gap-1.5"><Pill>{plant.om_status}</Pill>{plant.is_active ? null : <Pill tone="slate">Inactive</Pill>}</div>
        </div>
        <div><p className="text-[11px] font-extrabold uppercase text-[#8a98af]">Capacity</p><p className="mt-0.5 flex items-center gap-1 text-[15px] font-extrabold text-[#1e3261]"><Gauge className="size-4 text-[#0b65e5]" />{plant.capacity_kw ? `${Number(plant.capacity_kw)} kW` : '—'}</p><p className="text-[11px] font-semibold text-[#8a98af]">{plant.system_type}</p></div>
        <div><p className="text-[11px] font-extrabold uppercase text-[#8a98af]">Free Service</p><p className="mt-0.5 text-[14px] font-extrabold text-[#1e3261]">{fmtDate(plant.free_service_end)}</p><p className={cx('text-[11px] font-bold', days < 0 ? 'text-[#dc2626]' : days <= 90 ? 'text-[#c97a00]' : 'text-[#16a34a]')}>{days == null ? '' : days < 0 ? `Expired ${daysText(days)} — AMC renewal required` : `${days} days left`}</p></div>
        <div><p className="text-[11px] font-extrabold uppercase text-[#8a98af]">Next Service</p><p className={cx('mt-0.5 text-[14px] font-extrabold', plant.next_service?.overdue ? 'text-[#dc2626]' : 'text-[#1e3261]')}>{plant.next_service ? fmtDate(plant.next_service.due_date) : '—'}</p><p className="text-[11px] font-semibold text-[#8a98af]">{plant.next_service?.title || (plant.last_visit_date ? `Last visit ${fmtDate(plant.last_visit_date)}` : '')}</p></div>
        <div><p className="text-[11px] font-extrabold uppercase text-[#8a98af]">Insurance</p><div className="mt-1"><InsuranceChip insurance={plant.insurance} /></div><p className="mt-0.5 text-[11px] font-semibold text-[#8a98af]">{plant.insurance?.expiry_date ? `Expiry ${fmtDate(plant.insurance.expiry_date)}` : ''}</p></div>
      </section>

      <UnderlineTabs items={DETAIL_TABS.map((t) => ({ ...t, badge: t.value === 'tickets' && plant.open_tickets ? plant.open_tickets : undefined, badgeClass: 'bg-[#f2eafe] text-[#7c3aed]' }))} value={tab} onChange={setTab} tone="amber" />
      <MobileSubnavSelect items={DETAIL_TABS.map((t) => ({ value: t.value, label: t.label }))} value={tab} onChange={setTab} label="Plant section" tone="amber" />

      {tab === 'profile' ? <PlantProfile plant={plant} /> : null}
      {tab === 'schedule' ? <ServiceTasksList key="schedule" quarterly plant={plant} caps={caps} onNotify={onNotify} /> : null}
      {tab === 'tickets' ? <ComplaintTicketsList plant={plant} caps={caps} onNotify={onNotify} /> : null}
      {tab === 'tasks' ? <ServiceTasksList key="tasks" plant={plant} caps={caps} onNotify={onNotify} /> : null}
      {tab === 'history' ? <PlantHistory plant={plant} caps={caps} onNotify={onNotify} /> : null}
      {tab === 'insurance' ? <InsuranceList plant={plant} caps={caps} onNotify={onNotify} onChanged={() => setTick((t) => t + 1)} /> : null}
      {tab === 'documents' ? <PlantDocuments plant={plant} caps={caps} onNotify={onNotify} /> : null}

      {edit ? <PlantEditModal plant={plant} onClose={() => setEdit(false)} onSaved={(p) => { setEdit(false); setPlant(p); }} onNotify={onNotify} /> : null}
    </div>
  );
}

// ── Insurance ─────────────────────────────────────────────────────────────────

const DURATION_YEARS = { '1 Year': 1, '2 Year': 2, '3 Year': 3, '5 Year': 5 };

function computeExpiry(start, duration) {
  const years = DURATION_YEARS[duration];
  if (!start || !years) return '';
  const [y, m, d] = start.split('-').map(Number);
  const target = new Date(Date.UTC(y + years, m - 1, 1));
  const lastDay = new Date(Date.UTC(y + years, m, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  target.setUTCDate(target.getUTCDate() - 1);
  return target.toISOString().slice(0, 10);
}

function InsuranceFormModal({ policy, plant, onClose, onSaved, onNotify }) {
  const plants = usePlantOptions(!plant && !policy);
  const [form, setForm] = useState(() => ({
    plant: String(policy?.plant || plant?.id || ''),
    status: policy?.status || 'Insured',
    company: policy?.company || '',
    policy_number: policy?.policy_number || '',
    policy_type: policy?.policy_type || '',
    start_date: policy?.start_date || '',
    duration: policy?.duration || '1 Year',
    expiry_date: policy?.expiry_date || '',
    coverage_amount: policy?.coverage_amount ?? '',
    premium: policy?.premium ?? '',
    remarks: policy?.remarks || '',
  }));
  const [doc, setDoc] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const custom = form.duration === 'Custom';
  const expiryPreview = custom ? form.expiry_date : computeExpiry(form.start_date, form.duration);

  const save = async () => {
    if (!form.plant) { onNotify?.('Select the plant.', 'error'); return; }
    if (form.status === 'Insured' && !form.start_date) { onNotify?.('Enter the policy start date.', 'error'); return; }
    if (custom && form.status === 'Insured' && !form.expiry_date) { onNotify?.('Enter the expiry date for a custom duration.', 'error'); return; }
    const fd = new FormData();
    Object.entries({ ...form, expiry_date: custom ? form.expiry_date : expiryPreview }).forEach(([k, v]) => {
      if (v !== '' && v != null) fd.append(k, v);
    });
    if (doc) fd.append('policy_document', doc);
    setSaving(true);
    try {
      const saved = policy ? await omInsuranceApi.update(policy.id, fd) : await omInsuranceApi.create(fd);
      onNotify?.(`Insurance ${policy ? 'updated' : 'added'}${saved.expiry_date ? ` — expires ${fmtDate(saved.expiry_date)}` : ''}.`, 'success');
      onSaved?.(saved);
    } catch (e) {
      onNotify?.(errMsg(e, 'Could not save insurance.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={policy ? 'Edit Insurance' : 'Add Insurance'} subtitle={plant ? `${plant.plant_code} — ${plant.customer_name}` : policy ? `${policy.plant_code} — ${policy.customer_name}` : undefined} onClose={onClose}
      footer={<>
        <button type="button" className={BTN_OUTLINE} onClick={onClose}>Cancel</button>
        <button type="button" className={BTN_PRIMARY} disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save'}</button>
      </>}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {!plant && !policy ? <Field label="Plant" required wide><PlantPicker value={form.plant} onChange={set('plant')} plants={plants} /></Field> : null}
        <Field label="Insurance Status"><SelectInput value={form.status} onChange={set('status')} options={['Insured', 'Not Insured', 'Expired']} /></Field>
        <Field label="Insurance Company"><input className={INPUT} value={form.company} onChange={(e) => set('company')(e.target.value)} /></Field>
        <Field label="Policy Number"><input className={INPUT} value={form.policy_number} onChange={(e) => set('policy_number')(e.target.value)} /></Field>
        <Field label="Policy Type"><input className={INPUT} value={form.policy_type} onChange={(e) => set('policy_type')(e.target.value)} placeholder="e.g. Fire & allied perils" /></Field>
        <Field label="Start Date"><input type="date" className={INPUT} value={form.start_date} onChange={(e) => set('start_date')(e.target.value)} /></Field>
        <Field label="Duration"><SelectInput value={form.duration} onChange={set('duration')} options={['1 Year', '2 Year', '3 Year', '5 Year', 'Custom']} /></Field>
        <Field label="Expiry Date" hint={custom ? 'Enter manually for a custom duration' : 'Auto: start + duration − 1 day'}>
          <input type="date" className={INPUT} value={expiryPreview} disabled={!custom} onChange={(e) => set('expiry_date')(e.target.value)} />
        </Field>
        <Field label="Coverage Amount (₹)"><input type="number" className={INPUT} value={form.coverage_amount} onChange={(e) => set('coverage_amount')(e.target.value)} /></Field>
        <Field label="Premium (₹)"><input type="number" className={INPUT} value={form.premium} onChange={(e) => set('premium')(e.target.value)} /></Field>
        <Field label="Policy Document" hint={policy?.policy_document ? 'A document is already attached — choose a file to replace it' : undefined}>
          <input type="file" className={cx(INPUT, 'pt-1.5')} onChange={(e) => setDoc(e.target.files?.[0] || null)} />
        </Field>
        <Field label="Remarks" wide><textarea className={TEXTAREA} value={form.remarks} onChange={(e) => set('remarks')(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

const INSURANCE_CHIPS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'expiring', label: 'Expiring in 30 days' },
  { value: 'expiring7', label: 'Expiring in 7 days' },
  { value: 'expired', label: 'Expired' },
];

function InsuranceList({ plant, caps, onNotify, onChanged, initialAlert = '', focusId, onFocusConsumed }) {
  const [alert, setAlert] = useState(initialAlert);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [modal, setModal] = useState(null);
  useEffect(() => {
    if (!initialAlert) return;
    setAlert(initialAlert);
    onFocusConsumed?.();
  }, [initialAlert, onFocusConsumed]);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    omInsuranceApi.list({ page_size: 2500, ordering: 'expiry_date', alert, plant: plant?.id || '' })
      .then((r) => { if (alive) setRows(normalizeApiRows(r)); })
      .catch(() => { if (alive) setRows([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [alert, plant?.id, tick]);
  useEffect(() => {
    if (!focusId || !rows.length) return;
    const p = rows.find((r) => r.id === Number(focusId));
    if (p) setModal({ edit: p });
    onFocusConsumed?.();
  }, [focusId, rows, onFocusConsumed]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.plant_code, r.customer_name, r.plant_name, r.company, r.policy_number, r.policy_type].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [rows, search]);
  const saved = () => { setModal(null); setTick((t) => t + 1); onChanged?.(); };

  const expiryCell = (r) => (
    <div>
      <p>{fmtDate(r.expiry_date)}</p>
      {r.days_to_expiry != null && r.status !== 'Not Insured' ? (
        <p className={cx('text-[11px] font-bold', r.days_to_expiry < 0 ? 'text-[#dc2626]' : r.days_to_expiry <= 30 ? 'text-[#c97a00]' : 'text-[#8a98af]')}>{daysText(r.days_to_expiry)}</p>
      ) : null}
    </div>
  );
  const columns = [
    ...(plant ? [] : [{ label: 'Plant / Customer', render: (r) => <div><p className="font-bold">{r.customer_name}</p><p className="text-[11px] text-[#8a98af]">{r.plant_code}</p></div> }]),
    { label: 'Company / Policy', render: (r) => <div><p className="font-bold">{r.company || '—'}</p><p className="text-[11px] text-[#8a98af]">{[r.policy_number, r.policy_type].filter(Boolean).join(' · ')}</p></div> },
    { label: 'Start', render: (r) => fmtDate(r.start_date) },
    { label: 'Duration', render: (r) => r.duration },
    { label: 'Expiry', render: expiryCell },
    { label: 'Coverage / Premium', render: (r) => <div><p>{fmtMoney(r.coverage_amount)}</p><p className="text-[11px] text-[#8a98af]">{fmtMoney(r.premium)}</p></div> },
    { label: 'Status', render: (r) => <div className="flex flex-col items-start gap-1"><Pill tone={insuranceTone(r.status)}>{r.status}</Pill>{r.alert ? <Pill tone={r.alert === 'Insurance Expired' ? 'red' : 'amber'}>{r.alert}</Pill> : null}</div> },
    { label: 'Document', render: (r) => (r.policy_document ? <a href={getMediaUrl(r.policy_document)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="font-bold text-[#0b65e5]">View</a> : '—') },
  ];

  return (
    <div className={cx(PANEL, 'flex flex-col gap-3 p-3 sm:p-4')}>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <SearchBox value={search} onChange={setSearch} placeholder="Search customer, company, policy number..." />
        {caps.add ? <button type="button" className={BTN_PRIMARY} onClick={() => setModal({ add: true })}><Plus className="size-4" /> Add Insurance</button> : null}
      </div>
      <FilterChips options={INSURANCE_CHIPS} value={alert} onChange={setAlert} />
      <DataList
        rows={visible}
        columns={columns}
        loading={loading}
        storageKey="om-insurance"
        resetKey={`${alert}|${search}|${plant?.id || ''}`}
        emptyIcon={ShieldCheck}
        emptyTitle="No insurance records"
        onRowClick={caps.edit ? (r) => setModal({ edit: r }) : undefined}
        renderCard={(r) => (
          <MobileRecordCard
            key={r.id}
            icon={r.alert === 'Insurance Expired' ? ShieldX : r.alert ? ShieldAlert : ShieldCheck}
            iconTone={r.alert === 'Insurance Expired' ? 'bg-[#fee2e2] text-[#dc2626]' : r.alert ? 'bg-[#fff4e0] text-[#c97a00]' : 'bg-[#e8f8eb] text-[#0d9f4a]'}
            title={plant ? (r.company || r.policy_number || 'Policy') : r.customer_name}
            subtitle={[r.plant_code, r.policy_number].filter(Boolean).join(' · ')}
            badges={<><Pill tone={insuranceTone(r.status)}>{r.status}</Pill>{r.alert ? <Pill tone={r.alert === 'Insurance Expired' ? 'red' : 'amber'}>{r.alert}</Pill> : null}</>}
            details={[
              { label: 'Company', value: r.company },
              { label: 'Expiry', value: r.expiry_date ? `${fmtDate(r.expiry_date)} (${daysText(r.days_to_expiry)})` : '' },
              { label: 'Duration', value: r.duration },
              { label: 'Coverage', value: fmtMoney(r.coverage_amount) },
            ]}
            onOpen={caps.edit ? () => setModal({ edit: r }) : undefined}
            actions={[
              r.policy_document ? { label: 'Document', icon: FileText, tone: 'blue', href: getMediaUrl(r.policy_document), external: true } : null,
              caps.edit ? { label: 'Edit', icon: Pencil, tone: 'purple', onClick: () => setModal({ edit: r }) } : null,
            ]}
          />
        )}
      />
      {modal?.add ? <InsuranceFormModal plant={plant} onClose={() => setModal(null)} onSaved={saved} onNotify={onNotify} /> : null}
      {modal?.edit ? <InsuranceFormModal policy={modal.edit} plant={plant} onClose={() => setModal(null)} onSaved={saved} onNotify={onNotify} /> : null}
    </div>
  );
}

// ── Module router ─────────────────────────────────────────────────────────────

/**
 * O&M module (Plants → schedule → tickets → tasks → visits → insurance).
 * `focus` carries a deep-link target from notifications / dashboard cards,
 * e.g. { plant: 5 }, { ticket: 9 }, { task: 3 }, { policy: 2 }, { filter: 'service_due' }.
 */
export function OmModulePage({ activeSection, onOpenSection, onNotify, loggedInUser, Subnav, focus, onFocusConsumed, onNavigate }) {
  const caps = useMemo(() => omCaps(loggedInUser), [loggedInUser]);
  const section = OM_LEGACY_SECTIONS[activeSection] || activeSection;
  const [plantId, setPlantId] = useState(null);
  const consume = useCallback(() => onFocusConsumed?.(), [onFocusConsumed]);

  useEffect(() => {
    if (section !== 'Plants') setPlantId(null);
  }, [section]);

  useEffect(() => {
    if (section === 'Plants' && focus?.plant) {
      setPlantId(Number(focus.plant));
      consume();
    }
  }, [section, focus, consume]);

  const shared = { Subnav, activeSection: section, onOpenSection, onNotify };

  if (caps.fieldOnly || section === 'My Tasks') {
    return <OmMyTasksPage {...shared} Subnav={caps.fieldOnly ? null : Subnav} focus={focus} onFocusConsumed={consume} />;
  }
  if (section === 'O&M Dashboard') {
    return <OmDashboardPage {...shared} onNavigate={onNavigate} />;
  }
  if (section === 'Plants') {
    if (plantId) return <PlantDetailPage plantId={plantId} caps={caps} onBack={() => setPlantId(null)} onNotify={onNotify} onOpenSection={onOpenSection} />;
    return <PlantsPage {...shared} caps={caps} focus={focus} onFocusConsumed={consume} onOpenPlant={setPlantId} />;
  }
  if (section === 'Complaint Tickets') {
    return <OmListPage title="Complaint Tickets" {...shared}><ComplaintTicketsList caps={caps} onNotify={onNotify} focusId={focus?.ticket} onFocusConsumed={consume} /></OmListPage>;
  }
  if (section === 'Quarterly Services') {
    return <OmListPage title="Quarterly Services" {...shared}><ServiceTasksList key="quarterly" quarterly caps={caps} onNotify={onNotify} focusId={focus?.task} onFocusConsumed={consume} /></OmListPage>;
  }
  if (section === 'Service Tasks') {
    return <OmListPage title="Service Tasks" {...shared}><ServiceTasksList key="tasks" caps={caps} onNotify={onNotify} focusId={focus?.task} onFocusConsumed={consume} /></OmListPage>;
  }
  if (section === 'Service Visits') {
    return <OmListPage title="Service Visits" {...shared}><ServiceVisitsList caps={caps} onNotify={onNotify} /></OmListPage>;
  }
  if (section === 'Insurance') {
    return (
      <OmListPage title="Insurance" {...shared}>
        <InsuranceList caps={caps} onNotify={onNotify} initialAlert={focus?.alert || ''} focusId={focus?.policy} onFocusConsumed={consume} />
      </OmListPage>
    );
  }
  return <OmDashboardPage {...shared} onNavigate={onNavigate} />;
}
