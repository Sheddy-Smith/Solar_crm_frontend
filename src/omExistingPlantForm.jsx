/**
 * Task 14 — Add Existing Plant (O&M) registration wizard.
 * Modes: Add from Existing Project (prefill) | Manual / Quick Add.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Eye, EyeOff, FileText, Image as ImageIcon, Plus, Save, Sun, Upload, X,
} from 'lucide-react';
import { getMediaUrl, omDocumentApi, omPlantApi, projectApi } from './api.js';
import { normalizeApiRows } from './lib/utils.js';

const YEARS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '12', '15', '20', '25'];
const PLANT_TYPES = ['On-Grid', 'Hybrid', 'Off-Grid', 'On Grid', 'Off Grid'];
const SYSTEM_TYPES = ['On Grid', 'Hybrid', 'Off Grid'];
const FREQUENCIES = ['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'];
const APP_NAMES = ['SolisCloud', 'Sungrow iSolarCloud', 'Growatt ShinePhone', 'Fronius Solar.web', 'Huawei FusionSolar', 'Other'];
const APP_TYPES = ['Web Portal / App', 'Mobile App', 'Web Portal', 'Desktop'];
const MONITORING_STATUSES = ['Active', 'Inactive', 'Offline', 'Unknown'];

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function addYears(iso, years) {
  if (!iso || !years) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setFullYear(d.getFullYear() + Number(years));
  return d.toISOString().slice(0, 10);
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN');
}

const emptyForm = () => ({
  project: '',
  registration_source: 'Manual',
  customer_name: '',
  mobile_number: '',
  plant_name: '',
  capacity_kw: '',
  plant_type: 'On-Grid',
  system_type: 'On Grid',
  plant_location: '',
  panel_installation_date: '',
  inverter_installation_date: '',
  commissioning_date: '',
  installation_date: '',
  panel_brand: '',
  panel_model: '',
  panel_wattage_w: '',
  panel_count: '',
  panel_warranty_start: '',
  panel_warranty_years: '25',
  panel_performance_warranty_years: '25',
  panel_serials: '',
  inverter_brand: '',
  inverter_model: '',
  inverter_capacity_kw: '',
  inverter_count: '',
  inverter_warranty_start: '',
  inverter_warranty_years: '10',
  inverter_serial: '',
  service_warranty_start: '',
  service_warranty_years: '5',
  free_service_included: true,
  service_frequency: 'Quarterly',
  next_service_due: '',
  data_logger_brand: '',
  data_logger_model: '',
  data_logger_serial: '',
  solar_app_platform: 'SolisCloud',
  solar_app_type: 'Web Portal / App',
  account_created: false,
  solar_app_username: '',
  solar_app_password: '',
  plant_online: true,
  data_logger_connected: true,
  monitoring_status: 'Active',
  last_online_date: '',
  wifi_ssid: '',
  wifi_password: '',
  remarks: '',
});

function Section({ n, title, children }) {
  return (
    <section className="rounded-[14px] border border-[#e6edf6] bg-white p-4 shadow-sm sm:p-5">
      <header className="mb-3 flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-full bg-[#ecfdf5] text-[12px] font-extrabold text-[#0b8f43]">{n}</span>
        <h3 className="text-[14px] font-extrabold text-[#1e3261]">{title}</h3>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, required, children, className, hint }) {
  return (
    <label className={cx('grid gap-1 text-[11px] font-extrabold uppercase tracking-wide text-[#7b88a2]', className)}>
      <span>{label}{required ? <span className="text-[#dc2626]"> *</span> : null}</span>
      {children}
      {hint ? <span className="normal-case font-semibold text-[#94a3b8]">{hint}</span> : null}
    </label>
  );
}

const inputCls = 'h-10 w-full rounded-[9px] border border-[#d9e4f2] bg-white px-3 text-[13px] font-bold text-[#1e3261] outline-none focus:border-[#0b8f43]';
const tillCls = 'h-10 w-full rounded-[9px] border border-[#bbf7d0] bg-[#f0fdf4] px-3 text-[13px] font-extrabold text-[#15803d]';

export function AddExistingPlantForm({ onClose, onSaved, onNotify }) {
  const [mode, setMode] = useState('project'); // project | manual
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [plantId, setPlantId] = useState(null);
  const [docs, setDocs] = useState([]);
  const [mediaTab, setMediaTab] = useState('photos');
  const [uploading, setUploading] = useState(false);

  const panelTill = addYears(form.panel_warranty_start || form.panel_installation_date || form.commissioning_date, form.panel_warranty_years);
  const inverterTill = addYears(form.inverter_warranty_start || form.inverter_installation_date || form.commissioning_date, form.inverter_warranty_years);
  const serviceTill = addYears(form.service_warranty_start || form.commissioning_date, form.service_warranty_years);
  const inverterTotal = useMemo(() => {
    const cap = Number(form.inverter_capacity_kw);
    const count = Number(form.inverter_count);
    if (!Number.isFinite(cap) || !Number.isFinite(count)) return '';
    return (cap * count).toFixed(2);
  }, [form.inverter_capacity_kw, form.inverter_count]);

  useEffect(() => {
    projectApi.list({ page_size: 300 })
      .then((r) => setProjects(normalizeApiRows(r)))
      .catch(() => setProjects([]));
  }, []);

  const loadDocs = (id) => {
    if (!id) { setDocs([]); return; }
    omDocumentApi.list({ plant: id, page_size: 100 })
      .then((r) => setDocs(normalizeApiRows(r)))
      .catch(() => setDocs([]));
  };

  const set = (patch) => setForm((p) => ({ ...p, ...patch }));

  const onSelectProject = async (projectId) => {
    set({ project: projectId, registration_source: mode === 'project' ? 'Existing Project' : 'Manual' });
    if (!projectId || mode !== 'project') return;
    try {
      const data = await omPlantApi.prefill(projectId);
      set({
        project: projectId,
        registration_source: 'Existing Project',
        customer_name: data.customer_name || '',
        mobile_number: data.mobile_number || '',
        plant_name: data.plant_name || data.project_name || '',
        capacity_kw: data.capacity_kw != null ? String(data.capacity_kw) : '',
        plant_type: data.plant_type || form.plant_type,
        system_type: data.system_type || 'On Grid',
        plant_location: data.plant_location || '',
        commissioning_date: data.commissioning_date || '',
        installation_date: data.installation_date || '',
        panel_brand: data.panel_brand || '',
        panel_model: data.panel_model || '',
        panel_wattage_w: data.panel_wattage_w || '',
        panel_count: data.panel_count || '',
        panel_serials: data.panel_serials || '',
        inverter_brand: data.inverter_brand || '',
        inverter_model: data.inverter_model || '',
        inverter_capacity_kw: data.inverter_capacity_kw || '',
        inverter_serial: data.inverter_serial || '',
        panel_warranty_years: data.panel_warranty_years != null ? String(data.panel_warranty_years) : form.panel_warranty_years,
        inverter_warranty_years: data.inverter_warranty_years != null ? String(data.inverter_warranty_years) : form.inverter_warranty_years,
        service_warranty_years: data.service_warranty_years != null ? String(data.service_warranty_years) : form.service_warranty_years,
        next_service_due: data.next_service_due || '',
        solar_app_platform: data.solar_app_platform || form.solar_app_platform,
        solar_app_username: data.solar_app_username || '',
        wifi_ssid: data.wifi_ssid || '',
        panel_warranty_start: data.panel_warranty_start || data.commissioning_date || '',
        inverter_warranty_start: data.inverter_warranty_start || data.commissioning_date || '',
        service_warranty_start: data.service_warranty_start || data.commissioning_date || '',
      });
      if (data.existing_plant_id) setPlantId(data.existing_plant_id);
      if (data.has_existing_plant) {
        onNotify?.('This project already has an O&M plant — saving will update it (no duplicate).', 'info');
      }
      if (data.existing_plant_id) loadDocs(data.existing_plant_id);
    } catch (e) {
      onNotify?.(e.message || 'Could not prefill from project', 'error');
    }
  };

  const pasteSerials = async (field) => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      set({ [field]: text.trim() });
    } catch {
      onNotify?.('Clipboard access blocked — paste manually into the serial box.', 'error');
    }
  };

  const importSerialFile = (field, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '')
        .split(/\r?\n/)
        .map((l) => l.split(/[,\t]/)[0].trim())
        .filter(Boolean)
        .join('\n');
      set({ [field]: text });
    };
    reader.readAsText(file);
  };

  const save = async (draft) => {
    if (!form.project) { onNotify?.('Select a project.', 'error'); return; }
    if (!form.customer_name?.trim()) { onNotify?.('Customer name is required.', 'error'); return; }
    if (!form.plant_name?.trim()) { onNotify?.('Project / plant name is required.', 'error'); return; }
    setBusy(true);
    try {
      const body = {
        ...form,
        draft: Boolean(draft),
        registration_source: mode === 'project' ? 'Existing Project' : 'Manual',
        panel_warranty_start: form.panel_warranty_start || form.panel_installation_date || form.commissioning_date || null,
        inverter_warranty_start: form.inverter_warranty_start || form.inverter_installation_date || form.commissioning_date || null,
        service_warranty_start: form.service_warranty_start || form.commissioning_date || null,
        system_type: SYSTEM_TYPES.includes(form.system_type) ? form.system_type : 'On Grid',
      };
      // empty strings → null for dates/numbers handled by API
      const created = await omPlantApi.registerExisting(body);
      setPlantId(created.id);
      loadDocs(created.id);
      onNotify?.(draft ? 'Draft saved.' : 'Plant added to O&M.', 'success');
      if (!draft) onSaved?.(created);
    } catch (e) {
      onNotify?.(e.message || 'Save failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const uploadFiles = async (files, category) => {
    if (!plantId) {
      onNotify?.('Save the plant first (Draft or Add to O&M), then upload media.', 'error');
      return;
    }
    const list = Array.from(files || []);
    if (!list.length) return;
    setUploading(true);
    try {
      for (const file of list) {
        const fd = new FormData();
        fd.append('module', 'Plant');
        fd.append('related_id', plantId);
        fd.append('plant', plantId);
        fd.append('category', category);
        fd.append('name', file.name);
        fd.append('file', file);
        await omDocumentApi.create(fd);
      }
      onNotify?.(`${list.length} file(s) uploaded.`, 'success');
      loadDocs(plantId);
    } catch (e) {
      onNotify?.(e.message || 'Upload failed.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const photos = docs.filter((d) => d.category === 'Photo' || d.category === 'Before' || d.category === 'After');
  const documents = docs.filter((d) => !photos.includes(d));

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#f4f7fb]">
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-5 sm:py-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-bold text-[#7b88a2]">Dashboard / O&amp;M / Add Existing Plant</p>
            <h1 className="mt-1 text-[22px] font-extrabold text-[#1e3261]">Add Existing Plant (O&amp;M)</h1>
            <p className="mt-1 max-w-2xl text-[13px] font-semibold text-[#64748b]">
              Add old/previous solar project to O&amp;M and manage warranty, service and monitoring details.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { setMode('project'); set({ registration_source: 'Existing Project' }); }}
              className={cx('inline-flex h-10 items-center rounded-[9px] px-3.5 text-[13px] font-extrabold', mode === 'project' ? 'bg-[#0b8f43] text-white' : 'border border-[#d9e4f2] bg-white text-[#1e3261]')}
            >
              Add from Existing Project
            </button>
            <button
              type="button"
              onClick={() => { setMode('manual'); set({ registration_source: 'Manual' }); }}
              className={cx('inline-flex h-10 items-center rounded-[9px] px-3.5 text-[13px] font-extrabold', mode === 'manual' ? 'bg-[#0b8f43] text-white' : 'border border-[#d9e4f2] bg-white text-[#1e3261]')}
            >
              Manual / Quick Add
            </button>
            <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-[9px] border border-[#d9e4f2] bg-white text-[#64748b]">
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <Section n={1} title="Customer & Project Information">
              <Field label="Select Project" required className="sm:col-span-2">
                <select className={inputCls} value={form.project} onChange={(e) => onSelectProject(e.target.value)}>
                  <option value="">Select project…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {(p.project_name || 'Untitled')}{p.project_id ? ` (${p.project_id})` : ''} — {p.customer_name || '—'}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Customer Name" required>
                <input className={inputCls} value={form.customer_name} onChange={(e) => set({ customer_name: e.target.value })} />
              </Field>
              <Field label="Mobile">
                <input className={inputCls} value={form.mobile_number} onChange={(e) => set({ mobile_number: e.target.value })} />
              </Field>
              <Field label="Project Name" required>
                <input className={inputCls} value={form.plant_name} onChange={(e) => set({ plant_name: e.target.value })} />
              </Field>
              <Field label="Plant Capacity (kW)">
                <input type="number" step="any" className={inputCls} value={form.capacity_kw} onChange={(e) => set({ capacity_kw: e.target.value })} />
              </Field>
              <Field label="Plant Type">
                <select className={inputCls} value={form.plant_type} onChange={(e) => set({ plant_type: e.target.value })}>
                  {PLANT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="System Type">
                <select className={inputCls} value={form.system_type} onChange={(e) => set({ system_type: e.target.value })}>
                  {SYSTEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Project Location" className="sm:col-span-2">
                <input className={inputCls} value={form.plant_location} onChange={(e) => set({ plant_location: e.target.value })} />
              </Field>
            </Section>

            <Section n={2} title="Installation & Commissioning Details">
              <Field label="Panel Installation Date">
                <input type="date" className={inputCls} value={form.panel_installation_date} onChange={(e) => set({ panel_installation_date: e.target.value })} />
              </Field>
              <Field label="Inverter Installation Date">
                <input type="date" className={inputCls} value={form.inverter_installation_date} onChange={(e) => set({ inverter_installation_date: e.target.value })} />
              </Field>
              <Field label="Commissioning Date" required>
                <input type="date" className={inputCls} value={form.commissioning_date} onChange={(e) => set({ commissioning_date: e.target.value })} />
              </Field>
            </Section>

            <Section n={3} title="Panel Details & Warranty">
              <Field label="Panel Brand">
                <input className={inputCls} value={form.panel_brand} onChange={(e) => set({ panel_brand: e.target.value })} />
              </Field>
              <Field label="Panel Model">
                <input className={inputCls} value={form.panel_model} onChange={(e) => set({ panel_model: e.target.value })} />
              </Field>
              <Field label="Panel Wattage (Wp)">
                <input className={inputCls} value={form.panel_wattage_w} onChange={(e) => set({ panel_wattage_w: e.target.value })} />
              </Field>
              <Field label="No. of Panels">
                <input className={inputCls} value={form.panel_count} onChange={(e) => set({ panel_count: e.target.value })} />
              </Field>
              <Field label="Panel Warranty Start">
                <input type="date" className={inputCls} value={form.panel_warranty_start} onChange={(e) => set({ panel_warranty_start: e.target.value })} />
              </Field>
              <Field label="Warranty (Years)">
                <select className={inputCls} value={form.panel_warranty_years} onChange={(e) => set({ panel_warranty_years: e.target.value })}>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </Field>
              <Field label="Performance Warranty (Years)">
                <select className={inputCls} value={form.panel_performance_warranty_years} onChange={(e) => set({ panel_performance_warranty_years: e.target.value })}>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </Field>
              <Field label="Warranty Till">
                <input className={tillCls} value={panelTill ? fmtDate(panelTill) : '—'} readOnly />
              </Field>
              <Field label="Panel Serial Numbers" className="sm:col-span-2">
                <textarea rows={3} className={cx(inputCls, 'h-auto py-2')} value={form.panel_serials} onChange={(e) => set({ panel_serials: e.target.value })} placeholder="One serial per line" />
                <div className="mt-1 flex flex-wrap gap-2">
                  <button type="button" onClick={() => pasteSerials('panel_serials')} className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-[#d9e4f2] px-2.5 text-[11px] font-extrabold text-[#0b65e5]">Paste</button>
                  <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-[8px] border border-[#d9e4f2] px-2.5 text-[11px] font-extrabold text-[#0b65e5]">
                    <Upload className="size-3.5" /> Import (Excel/CSV)
                    <input type="file" accept=".csv,.txt,.xlsx" className="hidden" onChange={(e) => importSerialFile('panel_serials', e.target.files?.[0])} />
                  </label>
                </div>
              </Field>
            </Section>

            <Section n={4} title="Inverter Details & Warranty">
              <Field label="Inverter Brand">
                <input className={inputCls} value={form.inverter_brand} onChange={(e) => set({ inverter_brand: e.target.value })} />
              </Field>
              <Field label="Inverter Model">
                <input className={inputCls} value={form.inverter_model} onChange={(e) => set({ inverter_model: e.target.value })} />
              </Field>
              <Field label="Inverter Capacity (kW)">
                <input className={inputCls} value={form.inverter_capacity_kw} onChange={(e) => set({ inverter_capacity_kw: e.target.value })} />
              </Field>
              <Field label="No. of Inverters">
                <input className={inputCls} value={form.inverter_count} onChange={(e) => set({ inverter_count: e.target.value })} />
              </Field>
              <Field label="Total Capacity">
                <input className={tillCls} value={inverterTotal ? `${inverterTotal} kW` : '—'} readOnly />
              </Field>
              <Field label="Warranty Start">
                <input type="date" className={inputCls} value={form.inverter_warranty_start} onChange={(e) => set({ inverter_warranty_start: e.target.value })} />
              </Field>
              <Field label="Warranty (Years)">
                <select className={inputCls} value={form.inverter_warranty_years} onChange={(e) => set({ inverter_warranty_years: e.target.value })}>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </Field>
              <Field label="Warranty Till">
                <input className={tillCls} value={inverterTill ? fmtDate(inverterTill) : '—'} readOnly />
              </Field>
              <Field label="Inverter Serial Numbers" className="sm:col-span-2">
                <textarea rows={2} className={cx(inputCls, 'h-auto py-2')} value={form.inverter_serial} onChange={(e) => set({ inverter_serial: e.target.value })} />
                <button type="button" onClick={() => pasteSerials('inverter_serial')} className="mt-1 inline-flex h-8 items-center gap-1 rounded-[8px] border border-[#d9e4f2] px-2.5 text-[11px] font-extrabold text-[#0b65e5]">Paste</button>
              </Field>
            </Section>

            <Section n={5} title="Plant Service Warranty (Company)">
              <Field label="Service Warranty Start">
                <input type="date" className={inputCls} value={form.service_warranty_start} onChange={(e) => set({ service_warranty_start: e.target.value })} />
              </Field>
              <Field label="Service Warranty (Years)">
                <select className={inputCls} value={form.service_warranty_years} onChange={(e) => set({ service_warranty_years: e.target.value })}>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </Field>
              <Field label="Service Warranty Till">
                <input className={tillCls} value={serviceTill ? fmtDate(serviceTill) : '—'} readOnly />
              </Field>
              <Field label="Free Service">
                <select className={inputCls} value={form.free_service_included ? 'Yes' : 'No'} onChange={(e) => set({ free_service_included: e.target.value === 'Yes' })}>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </Field>
              <Field label="Service Frequency">
                <select className={inputCls} value={form.service_frequency} onChange={(e) => set({ service_frequency: e.target.value })}>
                  {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
              <Field label="Next Service Due">
                <input type="date" className={inputCls} value={form.next_service_due} onChange={(e) => set({ next_service_due: e.target.value })} />
              </Field>
            </Section>
          </div>

          <div className="space-y-4">
            <Section n={6} title="Other Equipment Details">
              <Field label="Data Logger Brand" className="sm:col-span-2">
                <input className={inputCls} value={form.data_logger_brand} onChange={(e) => set({ data_logger_brand: e.target.value })} />
              </Field>
              <Field label="Model" className="sm:col-span-2">
                <input className={inputCls} value={form.data_logger_model} onChange={(e) => set({ data_logger_model: e.target.value })} />
              </Field>
              <Field label="Serial No." className="sm:col-span-2">
                <input className={inputCls} value={form.data_logger_serial} onChange={(e) => set({ data_logger_serial: e.target.value })} />
              </Field>
            </Section>

            <Section n={7} title="Online Monitoring / Application Access">
              <Field label="Application Name" className="sm:col-span-2">
                <select className={inputCls} value={form.solar_app_platform} onChange={(e) => set({ solar_app_platform: e.target.value })}>
                  {APP_NAMES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="Application Type" className="sm:col-span-2">
                <select className={inputCls} value={form.solar_app_type} onChange={(e) => set({ solar_app_type: e.target.value })}>
                  {APP_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="Account Created">
                <select className={inputCls} value={form.account_created ? 'Yes' : 'No'} onChange={(e) => set({ account_created: e.target.value === 'Yes' })}>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </Field>
              <Field label="Plant Online">
                <select className={cx(inputCls, form.plant_online && 'border-[#bbf7d0] bg-[#f0fdf4]')} value={form.plant_online ? 'Yes' : 'No'} onChange={(e) => set({ plant_online: e.target.value === 'Yes' })}>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </Field>
              <Field label="Login ID / Email" className="sm:col-span-2">
                <input className={inputCls} value={form.solar_app_username} onChange={(e) => set({ solar_app_username: e.target.value })} />
              </Field>
              <Field label="Password" className="sm:col-span-2">
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} className={cx(inputCls, 'pr-10')} value={form.solar_app_password} onChange={(e) => set({ solar_app_password: e.target.value })} />
                  <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748b]">
                    {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </Field>
              <Field label="Data Logger Connected">
                <select className={inputCls} value={form.data_logger_connected ? 'Yes' : 'No'} onChange={(e) => set({ data_logger_connected: e.target.value === 'Yes' })}>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </Field>
              <Field label="Monitoring Status">
                <select className={inputCls} value={form.monitoring_status} onChange={(e) => set({ monitoring_status: e.target.value })}>
                  {MONITORING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Last Online Date" className="sm:col-span-2">
                <input type="date" className={inputCls} value={form.last_online_date} onChange={(e) => set({ last_online_date: e.target.value })} />
              </Field>
            </Section>

            <Section n={8} title="Photos & Documents">
              <div className="sm:col-span-2">
                <div className="mb-2 flex gap-2">
                  <button type="button" onClick={() => setMediaTab('photos')} className={cx('rounded-full px-3 py-1 text-[12px] font-extrabold', mediaTab === 'photos' ? 'bg-[#ecfdf5] text-[#0b8f43]' : 'bg-[#f1f5f9] text-[#64748b]')}>
                    Plant Photos ({photos.length})
                  </button>
                  <button type="button" onClick={() => setMediaTab('docs')} className={cx('rounded-full px-3 py-1 text-[12px] font-extrabold', mediaTab === 'docs' ? 'bg-[#ecfdf5] text-[#0b8f43]' : 'bg-[#f1f5f9] text-[#64748b]')}>
                    Documents ({documents.length})
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(mediaTab === 'photos' ? photos : documents).map((d) => (
                    <a key={d.id} href={getMediaUrl(d.file)} target="_blank" rel="noreferrer" className="flex flex-col gap-1 rounded-[10px] border border-[#eef2f8] p-2 hover:bg-[#f8fafd]">
                      {mediaTab === 'photos' ? <ImageIcon className="size-5 text-[#0b65e5]" /> : <FileText className="size-5 text-[#0b65e5]" />}
                      <span className="truncate text-[11px] font-bold text-[#1e3261]">{d.name}</span>
                    </a>
                  ))}
                  <label className="flex min-h-[72px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-[#d9e4f2] bg-[#f8fafd] text-[11px] font-extrabold text-[#0b65e5]">
                    <Plus className="size-4" />
                    {uploading ? 'Uploading…' : mediaTab === 'photos' ? 'Add Photos' : 'Add Documents'}
                    <input
                      type="file"
                      multiple
                      accept={mediaTab === 'photos' ? 'image/*' : undefined}
                      className="hidden"
                      onChange={(e) => uploadFiles(e.target.files, mediaTab === 'photos' ? 'Photo' : 'Document')}
                    />
                  </label>
                </div>
                {!plantId ? (
                  <p className="mt-2 text-[11px] font-semibold text-[#94a3b8]">Save Draft once to enable uploads (linked to plant record).</p>
                ) : null}
              </div>
              <Field label="Remarks" className="sm:col-span-2">
                <textarea rows={3} className={cx(inputCls, 'h-auto py-2')} value={form.remarks} onChange={(e) => set({ remarks: e.target.value })} />
              </Field>
            </Section>
          </div>
        </div>

        <div className="sticky bottom-0 mt-4 flex flex-wrap justify-end gap-2 border-t border-[#e6edf6] bg-[#f4f7fb]/py-3">
          <button type="button" onClick={onClose} className="h-10 rounded-[9px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-bold text-[#53647f]">Cancel</button>
          <button type="button" disabled={busy} onClick={() => save(true)} className="inline-flex h-10 items-center gap-1.5 rounded-[9px] border border-[#0b65e5] bg-white px-4 text-[13px] font-extrabold text-[#0b65e5] disabled:opacity-60">
            <Save className="size-4" /> Save as Draft
          </button>
          <button type="button" disabled={busy} onClick={() => save(false)} className="inline-flex h-10 items-center gap-1.5 rounded-[9px] bg-[#0b8f43] px-4 text-[13px] font-extrabold text-white disabled:opacity-60">
            <Sun className="size-4" /> {busy ? 'Saving…' : 'Save & Add to O&M'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddExistingPlantForm;
