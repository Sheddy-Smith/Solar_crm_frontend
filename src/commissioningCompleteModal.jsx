import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Pencil, X } from 'lucide-react';
import { lcCommissioningApi, omSettingsApi } from './api.js';

export const DEFAULT_SOLAR_APPS = [
  'SolisCloud', 'SolarMan', 'ShinePhone', 'Fronius Solar.web', 'Growatt OSS',
  'Sungrow iSolarCloud', 'GoodWe SEMS',
];

export const COMMISSIONING_CHECKLIST_TEMPLATE = [
  'Inverter Configure & Start',
  'Panel Connected & Tested',
  'Earthing Verified (OK)',
  'Net Meter Check & Confirm',
  'Plant Check – All Connections & All Parameters Verified',
  'Generation Test Completed',
  { label: 'Plant Online Status', type: 'plant_online', value: '', done: false },
  'Handover Document Done',
];

const SOLAR_PLATFORMS_KEY = 'solar_monitoring_platforms';

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

const inputCls = 'h-10 w-full rounded-[8px] border border-[#d9e4f2] bg-white px-3 text-[13px] font-semibold text-[#0f172a] outline-none focus:border-[#2563eb]';
const labelCls = 'grid gap-1 text-[11px] font-bold text-[#64748b]';

function addMonths(isoDate, months) {
  const d = new Date(`${isoDate}T00:00:00`);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function platformsFromSettings(raw) {
  const value = raw?.value ?? raw;
  const list = Array.isArray(value)
    ? value
    : Array.isArray(value?.platforms)
      ? value.platforms
      : Array.isArray(value?.items)
        ? value.items
        : [];
  return list.map((x) => (typeof x === 'string' ? x : x?.name)).filter(Boolean);
}

/** Normalize legacy checklist rows to Task-12 mockup items (preserve done/value by label). */
export function normalizeCommissioningChecklist(existing) {
  const prev = Array.isArray(existing) ? existing : [];
  const byLabel = new Map(
    prev.map((it) => [String(it?.label || '').trim().toLowerCase(), it]),
  );
  const legacyMap = {
    'inverter installed & configured': 'Inverter Configure & Start',
    'panels connected & tested': 'Panel Connected & Tested',
    'earthing verified': 'Earthing Verified (OK)',
    'net meter synchronized': 'Net Meter Check & Confirm',
    'generation test completed': 'Generation Test Completed',
    'handover documentation done': 'Handover Document Done',
  };

  return COMMISSIONING_CHECKLIST_TEMPLATE.map((item) => {
    const base = typeof item === 'string'
      ? { label: item, done: false }
      : { done: false, ...item };
    const key = base.label.toLowerCase();
    let hit = byLabel.get(key);
    if (!hit) {
      const legacyKey = Object.keys(legacyMap).find((k) => legacyMap[k].toLowerCase() === key);
      if (legacyKey) hit = byLabel.get(legacyKey);
    }
    if (base.type === 'plant_online') {
      const online = prev.find((it) => it?.type === 'plant_online' || /plant online/i.test(it?.label || ''));
      return {
        ...base,
        ...(online || {}),
        label: 'Plant Online Status',
        type: 'plant_online',
        value: online?.value || '',
        done: online?.value === 'done',
      };
    }
    return {
      ...base,
      done: Boolean(hit?.done),
    };
  });
}

export function CommissioningCompleteModal({
  commissioning,
  onClose,
  onNotify,
  onCompleted,
}) {
  const entryDate = commissioning?.date || todayIso();
  const defaultNext = useMemo(() => addMonths(entryDate, 3), [entryDate]);

  const [saving, setSaving] = useState(false);
  const [showWifi, setShowWifi] = useState(false);
  const [showApp, setShowApp] = useState(false);
  const [platforms, setPlatforms] = useState(DEFAULT_SOLAR_APPS);
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [savingCustom, setSavingCustom] = useState(false);

  const [form, setForm] = useState({
    inverter_warranty: 10,
    panel_warranty: 30,
    service_warranty: 5,
    next_service_due: defaultNext,
    wifi_ssid: '',
    wifi_password: '',
    solar_app_platform: 'SolisCloud',
    solar_app_username: '',
    solar_app_password: '',
  });

  useEffect(() => {
    let alive = true;
    omSettingsApi.get(SOLAR_PLATFORMS_KEY)
      .then((data) => {
        if (!alive) return;
        const saved = platformsFromSettings(data);
        const merged = [...DEFAULT_SOLAR_APPS];
        saved.forEach((name) => {
          if (!merged.some((x) => x.toLowerCase() === String(name).toLowerCase())) merged.push(name);
        });
        setPlatforms(merged);
      })
      .catch(() => {
        if (alive) setPlatforms(DEFAULT_SOLAR_APPS);
      });
    return () => { alive = false; };
  }, []);

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));
  const setNumber = (key) => (e) => {
    const raw = e.target.value;
    setForm((p) => ({ ...p, [key]: raw === '' ? '' : Number(raw) }));
  };

  const onPlatformChange = (e) => {
    const value = e.target.value;
    if (value === '__other__') {
      setCustomOpen(true);
      return;
    }
    setForm((p) => ({ ...p, solar_app_platform: value }));
  };

  const saveCustomPlatform = async () => {
    const name = customName.trim();
    if (!name) {
      onNotify?.('Application name is required', 'error');
      return;
    }
    setSavingCustom(true);
    try {
      const nextList = [...platforms];
      if (!nextList.some((x) => x.toLowerCase() === name.toLowerCase())) nextList.push(name);
      try {
        const existing = await omSettingsApi.get(SOLAR_PLATFORMS_KEY).catch(() => null);
        const prevDesc = existing?.value?.descriptions || {};
        const descriptions = { ...prevDesc };
        if (customDesc.trim()) descriptions[name] = customDesc.trim();
        await omSettingsApi.update(SOLAR_PLATFORMS_KEY, {
          value: { platforms: nextList, descriptions },
        });
      } catch {
        await omSettingsApi.create({
          key: SOLAR_PLATFORMS_KEY,
          value: {
            platforms: nextList,
            descriptions: customDesc.trim() ? { [name]: customDesc.trim() } : {},
          },
        });
      }
      setPlatforms(nextList);
      setForm((p) => ({ ...p, solar_app_platform: name }));
      setCustomOpen(false);
      setCustomName('');
      setCustomDesc('');
      onNotify?.(`Saved “${name}” for CRM-wide reuse`, 'success');
    } catch (e) {
      setPlatforms((prev) => (prev.includes(name) ? prev : [...prev, name]));
      setForm((p) => ({ ...p, solar_app_platform: name }));
      setCustomOpen(false);
      onNotify?.(e.message || 'Saved locally — settings sync may need O&M access', 'error');
    } finally {
      setSavingCustom(false);
    }
  };

  const submit = async () => {
    const required = [
      ['inverter_warranty', 'Inverter Warranty'],
      ['panel_warranty', 'Panel Warranty'],
      ['service_warranty', 'Service Warranty'],
      ['next_service_due', 'Next Service Due'],
      ['wifi_ssid', 'Wi-Fi ID (Site)'],
      ['wifi_password', 'Wi-Fi Password'],
      ['solar_app_platform', 'Solar App / Platform'],
      ['solar_app_username', 'Customer App ID'],
      ['solar_app_password', 'Customer App Password'],
    ];
    for (const [key, label] of required) {
      if (form[key] === '' || form[key] == null || !String(form[key]).trim()) {
        onNotify?.(`${label} is required`, 'error');
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        inverter_warranty: Number(form.inverter_warranty),
        panel_warranty: Number(form.panel_warranty),
        service_warranty: Number(form.service_warranty),
      };
      const saved = await lcCommissioningApi.complete(commissioning.id, payload);
      onNotify?.(
        `${saved.record_no || 'Commissioning'} completed · moved to O&M${saved.om_plant_code ? ` (${saved.om_plant_code})` : ''}`,
        'success',
      );
      onCompleted?.(saved);
      onClose?.();
    } catch (e) {
      onNotify?.(e.message || 'Complete commissioning failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const projectLabel = [
    commissioning?.project_name,
    commissioning?.project_id || commissioning?.project_code || commissioning?.record_no,
  ].filter(Boolean).join(' — ') || 'Project';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[14px] bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#edf2f8] px-5 py-4">
          <div>
            <h2 className="text-[18px] font-extrabold text-[#0f172a]">Complete Commissioning</h2>
            <p className="mt-0.5 text-[12px] font-semibold text-[#64748b]">{projectLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#0f172a]">
            <X className="size-4" />
          </button>
        </div>

        <div className="grid gap-6 px-5 py-5 md:grid-cols-2">
          <section>
            <h3 className="mb-3 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[#94a3b8]">
              Warranty &amp; Service Details
            </h3>
            <div className="grid gap-3">
              {[
                ['inverter_warranty', 'Inverter Warranty (Years)'],
                ['panel_warranty', 'Panel Warranty (Years)'],
                ['service_warranty', 'Service Warranty (Years)'],
              ].map(([key, label]) => (
                <label key={key} className={labelCls}>
                  {label}
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="50"
                      className={cx(inputCls, 'pr-10')}
                      value={form[key]}
                      onChange={setNumber(key)}
                    />
                    <Pencil className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-[#94a3b8]" />
                  </div>
                </label>
              ))}
              <label className={labelCls}>
                Next Service Due
                <input type="date" className={inputCls} value={form.next_service_due} onChange={set('next_service_due')} />
              </label>
              <div className="rounded-[10px] border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-[#1d4ed8]">
                Default: Inverter 10 Years, Panel 30 Years, Service 5 Years, Next Service = Today + 3 Months (Editable).
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[#94a3b8]">
              System Login Details
            </h3>
            <div className="grid gap-3">
              <label className={labelCls}>
                Wi-Fi ID (Site)
                <input className={inputCls} value={form.wifi_ssid} onChange={set('wifi_ssid')} placeholder="e.g. Juned_Home" />
              </label>
              <label className={labelCls}>
                Wi-Fi Password
                <div className="relative">
                  <input
                    type={showWifi ? 'text' : 'password'}
                    className={cx(inputCls, 'pr-10')}
                    value={form.wifi_password}
                    onChange={set('wifi_password')}
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowWifi((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748b]">
                    {showWifi ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </label>
              <label className={labelCls}>
                Solar App / Platform
                <select className={inputCls} value={form.solar_app_platform} onChange={onPlatformChange}>
                  {platforms.map((o) => <option key={o} value={o}>{o}</option>)}
                  <option value="__other__">Other</option>
                </select>
              </label>
              <label className={labelCls}>
                Customer App ID (Username)
                <input className={inputCls} value={form.solar_app_username} onChange={set('solar_app_username')} placeholder="email / username" />
              </label>
              <label className={labelCls}>
                Customer App Password
                <div className="relative">
                  <input
                    type={showApp ? 'text' : 'password'}
                    className={cx(inputCls, 'pr-10')}
                    value={form.solar_app_password}
                    onChange={set('solar_app_password')}
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowApp((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748b]">
                    {showApp ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </label>
            </div>
          </section>
        </div>

        <div className="flex justify-end gap-2 border-t border-[#edf2f8] px-5 py-4">
          <button type="button" onClick={onClose} className="h-10 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-bold text-[#475569]">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={submit}
            className="h-10 rounded-[8px] bg-[#16a34a] px-4 text-[13px] font-extrabold text-white hover:bg-[#15803d] disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Complete & Move to O&M →'}
          </button>
        </div>
      </div>

      {customOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-[14px] bg-white shadow-2xl">
            <div className="border-b border-[#edf2f8] px-5 py-4">
              <h3 className="text-[16px] font-extrabold text-[#0f172a]">Add Custom Solar App / Platform</h3>
            </div>
            <div className="grid gap-3 px-5 py-4">
              <label className={labelCls}>
                Application Name
                <input
                  autoFocus
                  className={inputCls}
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Aadhar Solar Portal"
                />
              </label>
              <label className={labelCls}>
                Description (Optional)
                <textarea
                  className="min-h-[80px] w-full rounded-[8px] border border-[#d9e4f2] px-3 py-2 text-[13px] font-semibold outline-none focus:border-[#2563eb]"
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                  placeholder="e.g. Government Aadhar based solar monitoring portal"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#edf2f8] px-5 py-4">
              <button
                type="button"
                onClick={() => { setCustomOpen(false); setCustomName(''); setCustomDesc(''); }}
                className="h-10 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-bold text-[#475569]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingCustom}
                onClick={saveCustomPlatform}
                className="h-10 rounded-[8px] bg-[#16a34a] px-4 text-[13px] font-extrabold text-white hover:bg-[#15803d] disabled:opacity-60"
              >
                {savingCustom ? 'Saving…' : 'Save & Select'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CommissioningCompleteModal;
