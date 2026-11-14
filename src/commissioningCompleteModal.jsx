import { useMemo, useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { lcCommissioningApi } from './api.js';

const WARRANTY_OPTIONS = ['1 Years', '2 Years', '3 Years', '5 Years', '10 Years', '12 Years', '15 Years', '25 Years'];
const SOLAR_APPS = [
  'SolisCloud', 'SolarMan', 'ShinePhone', 'Fronius Solar.web', 'Growatt OSS',
  'Sungrow iSolarCloud', 'GoodWe SEMS', 'Other',
];

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

const inputCls = 'h-10 w-full rounded-[8px] border border-[#d9e4f2] bg-white px-3 text-[13px] font-semibold text-[#0f172a] outline-none focus:border-[#2563eb]';

export function CommissioningCompleteModal({
  commissioning,
  onClose,
  onNotify,
  onCompleted,
}) {
  const defaultNext = useMemo(() => {
    const base = commissioning?.date || new Date().toISOString().slice(0, 10);
    const d = new Date(`${base}T00:00:00`);
    d.setFullYear(d.getFullYear() + 5);
    return d.toISOString().slice(0, 10);
  }, [commissioning?.date]);

  const [saving, setSaving] = useState(false);
  const [showWifi, setShowWifi] = useState(false);
  const [showApp, setShowApp] = useState(false);
  const [form, setForm] = useState({
    inverter_warranty: '5 Years',
    panel_warranty: '25 Years',
    service_warranty: '5 Years',
    next_service_due: defaultNext,
    wifi_ssid: '',
    wifi_password: '',
    solar_app_platform: 'SolisCloud',
    solar_app_username: '',
    solar_app_password: '',
  });

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

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
      if (!String(form[key] || '').trim()) {
        onNotify?.(`${label} is required`, 'error');
        return;
      }
    }
    setSaving(true);
    try {
      const saved = await lcCommissioningApi.complete(commissioning.id, form);
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
    commissioning?.customer_name,
  ].filter(Boolean).join(' · ') || 'Project';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[14px] bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#edf2f8] px-5 py-4">
          <div>
            <h2 className="text-[18px] font-extrabold text-[#0f172a]">Complete Commissioning</h2>
            <p className="mt-0.5 text-[12px] font-semibold text-[#64748b]">{projectLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-[#f1f5f9]">
            <X className="size-4" />
          </button>
        </div>

        <div className="grid gap-5 px-5 py-4 md:grid-cols-2">
          <section>
            <h3 className="mb-3 text-[12px] font-extrabold uppercase tracking-[0.04em] text-[#94a3b8]">Warranty Details</h3>
            <div className="grid gap-3">
              <label className="grid gap-1 text-[11px] font-bold text-[#64748b]">
                Inverter Warranty *
                <select className={inputCls} value={form.inverter_warranty} onChange={set('inverter_warranty')}>
                  {WARRANTY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-[11px] font-bold text-[#64748b]">
                Panel Warranty *
                <select className={inputCls} value={form.panel_warranty} onChange={set('panel_warranty')}>
                  {WARRANTY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-[11px] font-bold text-[#64748b]">
                Service Warranty *
                <select className={inputCls} value={form.service_warranty} onChange={set('service_warranty')}>
                  {WARRANTY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-[11px] font-bold text-[#64748b]">
                Next Service Due *
                <input type="date" className={inputCls} value={form.next_service_due} onChange={set('next_service_due')} />
              </label>
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-[12px] font-extrabold uppercase tracking-[0.04em] text-[#94a3b8]">System Login Details</h3>
            <p className="mb-2 text-[11px] font-semibold text-[#b45309]">
              Passwords are encrypted at rest and never shown in reports/PDF.
            </p>
            <div className="grid gap-3">
              <label className="grid gap-1 text-[11px] font-bold text-[#64748b]">
                Wi-Fi ID (Site) *
                <input className={inputCls} value={form.wifi_ssid} onChange={set('wifi_ssid')} placeholder="e.g. Juned_Home" />
              </label>
              <label className="grid gap-1 text-[11px] font-bold text-[#64748b]">
                Wi-Fi Password *
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
              <label className="grid gap-1 text-[11px] font-bold text-[#64748b]">
                Solar App / Platform *
                <select className={inputCls} value={form.solar_app_platform} onChange={set('solar_app_platform')}>
                  {SOLAR_APPS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-[11px] font-bold text-[#64748b]">
                Customer App ID (Username) *
                <input className={inputCls} value={form.solar_app_username} onChange={set('solar_app_username')} placeholder="email / username" />
              </label>
              <label className="grid gap-1 text-[11px] font-bold text-[#64748b]">
                Customer App Password *
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
          <button type="button" onClick={onClose} className="h-10 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-bold text-[#475569]">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={submit}
            className="h-10 rounded-[8px] bg-[#16a34a] px-4 text-[13px] font-extrabold text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Complete & Move to O&M'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CommissioningCompleteModal;
