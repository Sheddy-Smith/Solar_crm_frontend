/**
 * Liaisoning Net Metering UI — Task 13 redesign.
 * Dual workflows (New Meter vs Existing Smart Meter), Division/Zone masters reuse.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, Clock3, FileText, Gauge, Mail, MapPin, Plus, RefreshCw, Wrench, X, Zap,
} from 'lucide-react';
import { createPortal, flushSync } from 'react-dom';
import { lcDivisionApi, lcDocumentApi, lcZoneApi } from './api.js';
import { normalizeApiRows } from './lib/utils.js';
import { MasterManageModal } from './liaisonApplicationLoanUi.jsx';

export const NM_METER_TYPES = [
  'Normal Meter - Single Phase',
  'Smart Meter - Single Phase',
  'Smart Meter - Three Phase',
  'Solar Generation Meter - Three Phase',
];

export const NM_PHASE_BY_TYPE = {
  'Normal Meter - Single Phase': 'Single Phase',
  'Smart Meter - Single Phase': 'Single Phase',
  'Smart Meter - Three Phase': 'Three Phase',
  'Solar Generation Meter - Three Phase': 'Three Phase',
};

export const NM_SOURCE_NEW = 'New Meter Purchased by Company';
export const NM_SOURCE_EXISTING = 'Existing Smart Meter Already Installed at Site';
export const NM_SOURCES = [NM_SOURCE_NEW, NM_SOURCE_EXISTING];

export const NM_NEW_STATUSES = [
  'Purchase',
  'Sent for Testing',
  'Testing Done',
  'Division Application Submitted',
  'Mail Sent for Solar Conversion',
  'Installation Scheduled',
  'Installed at Customer Site',
  'Division Confirmation',
  'Completed',
  'Rejected',
];

export const NM_EXISTING_STATUSES = [
  'Existing Smart Meter Verified',
  'Application Documents Uploaded',
  'Mail Sent for Solar Conversion',
  'Division Response Received',
  'Solar Conversion Completed',
  'Completed',
  'Rejected',
];

export const NM_ALL_STATUSES = [...new Set([...NM_NEW_STATUSES, ...NM_EXISTING_STATUSES])];

export function nmStatusesForSource(source) {
  return source === NM_SOURCE_EXISTING ? NM_EXISTING_STATUSES : NM_NEW_STATUSES;
}

export const NET_METER_KPI_GROUPS = [
  { key: 'purchase_testing', label: 'Purchase / Testing Pending', match: ['Purchase', 'Sent for Testing', 'Applied', 'Testing'], tone: 'amber', icon: Wrench },
  { key: 'testing_done', label: 'Testing Completed', match: ['Testing Done'], tone: 'blue', icon: CheckCircle2 },
  { key: 'division', label: 'Division Processing', match: ['Division Application Submitted', 'Division Confirmation', 'Division Response Received', 'Existing Smart Meter Verified', 'Application Documents Uploaded'], tone: 'purple', icon: MapPin },
  { key: 'conversion', label: 'Conversion Pending', match: ['Mail Sent for Solar Conversion'], tone: 'cyan', icon: Mail },
  { key: 'install_pending', label: 'Installation Pending', match: ['Installation Scheduled'], tone: 'amber', icon: Clock3 },
  { key: 'installed', label: 'Installed', match: ['Installed at Customer Site', 'Installed'], tone: 'green', icon: Gauge },
  { key: 'completed', label: 'Completed', match: ['Completed', 'Solar Conversion Completed'], tone: 'green', icon: CheckCircle2 },
];

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function DrawerShell({ title, step, steps, onClose, children, footer }) {
  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/35" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-[520px] flex-col bg-white shadow-[-12px_0_40px_rgba(17,39,84,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#eef2f8] px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-[16px] font-extrabold text-[#1e3261]">{title}</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {steps.map((s, i) => (
                <span
                  key={s}
                  className={cx(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold',
                    i + 1 === step ? 'bg-[#ecfdf5] text-[#0b8f43]' : i + 1 < step ? 'bg-[#eef4ff] text-[#0b65e5]' : 'bg-[#f1f5f9] text-[#94a3b8]',
                  )}
                >
                  <span className="grid size-4 place-items-center rounded-full bg-current/10 text-[9px]">{i + 1}</span>
                  {s}
                </span>
              ))}
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-[8px] text-[#64748b] hover:bg-[#f1f5f9]">
            <X className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[#eef2f8] px-4 py-3">{footer}</footer>
      </div>
    </div>,
    document.body,
  );
}

function Field({ label, required, children, hint }) {
  return (
    <label className="grid gap-1 text-[11px] font-extrabold uppercase tracking-wide text-[#7b88a2]">
      <span>{label}{required ? ' *' : ''}</span>
      {children}
      {hint ? <span className="normal-case font-semibold text-[#94a3b8]">{hint}</span> : null}
    </label>
  );
}

const inputCls = 'h-10 w-full rounded-[9px] border border-[#d9e4f2] bg-white px-3 text-[13px] font-bold text-[#1e3261] outline-none focus:border-[#0b8f43]';
const sectionCls = 'rounded-[12px] border border-[#eef2f8] bg-[#f8fafd] p-3 space-y-2.5';

export function NetMeterWizardForm({
  title, form, setForm, onClose, onSave, saving, requiredOk, isEdit, project, onNotify,
}) {
  const steps = ['Meter Details', 'Process & Docs', 'Review'];
  const [step, setStep] = useState(1);
  const [divisions, setDivisions] = useState([]);
  const [zones, setZones] = useState([]);
  const [manage, setManage] = useState(null);
  const [docs, setDocs] = useState([]);
  const [markCompleted, setMarkCompleted] = useState(
    form.status === 'Completed' || form.status === 'Solar Conversion Completed',
  );

  const isExisting = form.meter_source === NM_SOURCE_EXISTING;
  const statusOptions = nmStatusesForSource(form.meter_source);
  const phase = NM_PHASE_BY_TYPE[form.meter_type] || form.phase || 'Single Phase';

  const loadMasters = () => {
    lcDivisionApi.list({ page_size: 200, is_active: true }).then((r) => setDivisions(normalizeApiRows(r))).catch(() => setDivisions([]));
    lcZoneApi.list({ page_size: 200, is_active: true }).then((r) => setZones(normalizeApiRows(r))).catch(() => setZones([]));
  };

  useEffect(() => { loadMasters(); }, []);

  useEffect(() => {
    if (!form.id || step !== 2) return undefined;
    lcDocumentApi.list({ module: 'Net Meter', related_id: form.id, page_size: 50 })
      .then((r) => setDocs(normalizeApiRows(r)))
      .catch(() => setDocs([]));
    return undefined;
  }, [form.id, step]);

  useEffect(() => {
    const derived = NM_PHASE_BY_TYPE[form.meter_type];
    if (derived && form.phase !== derived) {
      setForm((p) => ({ ...p, phase: derived }));
    }
  }, [form.meter_type, form.phase, setForm]);

  const zoneOptions = useMemo(() => {
    if (!form.division) return zones;
    const div = divisions.find((d) => d.name === form.division);
    if (!div) return zones;
    return zones.filter((z) => !z.division || Number(z.division) === Number(div.id));
  }, [zones, divisions, form.division]);

  const setSource = (source) => {
    setForm((p) => {
      const next = { ...p, meter_source: source };
      if (source === NM_SOURCE_EXISTING) {
        next.status = p.status && NM_EXISTING_STATUSES.includes(p.status) ? p.status : 'Existing Smart Meter Verified';
        next.existing_verified = true;
      } else if (!NM_NEW_STATUSES.includes(p.status) || p.status === 'Existing Smart Meter Verified') {
        next.status = 'Purchase';
      }
      return next;
    });
  };

  const handleSave = () => {
    if (markCompleted) {
      const status = isExisting ? 'Solar Conversion Completed' : 'Completed';
      flushSync(() => {
        setForm((p) => ({ ...p, status, existing_verified: isExisting ? true : p.existing_verified }));
      });
    }
    onSave();
  };

  const canNext = step === 1
    ? Boolean(form.meter_type && form.meter_source)
    : true;

  return (
    <>
      <DrawerShell
        title={title}
        step={step}
        steps={steps}
        onClose={onClose}
        footer={(
          <>
            {step > 1 ? (
              <button type="button" className="h-9 rounded-[8px] border border-[#e5eaf2] px-4 text-[13px] font-bold text-[#53647f]" onClick={() => setStep((s) => s - 1)}>Back</button>
            ) : (
              <button type="button" className="h-9 rounded-[8px] border border-[#e5eaf2] px-4 text-[13px] font-bold text-[#53647f]" onClick={onClose}>Cancel</button>
            )}
            {step === 3 ? (
              <label className="mr-auto inline-flex items-center gap-2 text-[12px] font-bold text-[#1e3261]">
                <input
                  type="checkbox"
                  className="size-4 rounded border-[#d9e4f2]"
                  checked={markCompleted}
                  onChange={(e) => setMarkCompleted(e.target.checked)}
                />
                Mark as Completed
              </label>
            ) : null}
            {step < 3 ? (
              <button type="button" disabled={!canNext} className="h-9 rounded-[8px] bg-[#0b8f43] px-4 text-[13px] font-extrabold text-white disabled:opacity-60" onClick={() => setStep((s) => s + 1)}>Next</button>
            ) : (
              <button type="button" disabled={saving || !requiredOk} className="h-9 rounded-[8px] bg-[#0b8f43] px-4 text-[13px] font-extrabold text-white disabled:opacity-60" onClick={handleSave}>
                {saving ? 'Saving…' : isEdit ? 'Save' : 'Save Net Meter'}
              </button>
            )}
          </>
        )}
      >
        {step === 1 ? (
          <div className="space-y-3">
            <p className="text-[12px] font-semibold text-[#64748b]">
              Project:{' '}
              <span className="font-extrabold text-[#1e3261]">
                {project?.project_id ? `${project.project_id} — ` : ''}
                {project?.project_name || form.project_name || '—'}
              </span>
              {project?.customer_name ? ` · ${project.customer_name}` : ''}
            </p>

            <div className={sectionCls}>
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#7b88a2]">Meter Source *</p>
              <div className="grid gap-1.5">
                {NM_SOURCES.map((s) => {
                  const active = form.meter_source === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSource(s)}
                      className={cx(
                        'rounded-[10px] border px-3 py-2.5 text-left text-[12px] font-extrabold transition',
                        active ? 'border-[#0b8f43] bg-[#ecfdf5] text-[#0b8f43]' : 'border-[#e5eaf2] bg-white text-[#1e3261] hover:border-[#bbf7d0]',
                      )}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={sectionCls}>
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#7b88a2]">Meter Details</p>
              <Field label="Meter Type" required>
                <select
                  className={inputCls}
                  value={form.meter_type || ''}
                  onChange={(e) => setForm((p) => ({
                    ...p,
                    meter_type: e.target.value,
                    phase: NM_PHASE_BY_TYPE[e.target.value] || p.phase,
                  }))}
                >
                  {NM_METER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Phase (auto)">
                  <input className={cx(inputCls, 'bg-[#f1f5f9]')} value={phase} readOnly />
                </Field>
                <Field label="Meter Number" required={isExisting}>
                  <input
                    className={inputCls}
                    value={form.meter_number || ''}
                    onChange={(e) => setForm((p) => ({ ...p, meter_number: e.target.value }))}
                    placeholder={isExisting ? 'Existing meter no.' : 'e.g. SMR123456'}
                  />
                </Field>
              </div>
              <Field label="Meter Make / Model">
                <input
                  className={inputCls}
                  value={form.meter_make || ''}
                  onChange={(e) => setForm((p) => ({ ...p, meter_make: e.target.value }))}
                  placeholder="e.g. L&T / SM200"
                />
              </Field>
            </div>

            {!isExisting ? (
              <div className={sectionCls}>
                <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#7b88a2]">Purchase Information</p>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Purchase Date">
                    <input type="date" className={inputCls} value={form.purchase_date || ''} onChange={(e) => setForm((p) => ({ ...p, purchase_date: e.target.value }))} />
                  </Field>
                  <Field label="Vendor">
                    <input className={inputCls} value={form.purchase_vendor || ''} onChange={(e) => setForm((p) => ({ ...p, purchase_vendor: e.target.value }))} />
                  </Field>
                </div>
              </div>
            ) : (
              <div className={sectionCls}>
                <label className="inline-flex items-center gap-2 text-[12px] font-extrabold text-[#1e3261]">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-[#d9e4f2]"
                    checked={Boolean(form.existing_verified)}
                    onChange={(e) => setForm((p) => ({
                      ...p,
                      existing_verified: e.target.checked,
                      status: e.target.checked && (!p.status || p.status === 'Purchase')
                        ? 'Existing Smart Meter Verified'
                        : p.status,
                    }))}
                  />
                  Existing Smart Meter Verified
                </label>
              </div>
            )}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <div className={sectionCls}>
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#7b88a2]">Process & Status</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Current Status" required>
                  <select className={inputCls} value={form.status || ''} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                    {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Status Date">
                  <input type="date" className={inputCls} value={form.status_date || ''} onChange={(e) => setForm((p) => ({ ...p, status_date: e.target.value }))} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Division">
                  <div className="flex gap-1">
                    <select className={inputCls} value={form.division || ''} onChange={(e) => setForm((p) => ({ ...p, division: e.target.value, zone: '' }))}>
                      <option value="">Select…</option>
                      {divisions.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                    </select>
                    <button type="button" title="Manage Division" onClick={() => setManage('division')} className="grid size-10 shrink-0 place-items-center rounded-[9px] border border-[#d9e4f2] text-[#0b65e5] hover:bg-[#eef4ff]"><Plus className="size-3.5" /></button>
                  </div>
                </Field>
                <Field label="Zone">
                  <div className="flex gap-1">
                    <select className={inputCls} value={form.zone || ''} onChange={(e) => setForm((p) => ({ ...p, zone: e.target.value }))}>
                      <option value="">Select…</option>
                      {zoneOptions.map((z) => <option key={z.id} value={z.name}>{z.name}</option>)}
                    </select>
                    <button type="button" title="Manage Zone" onClick={() => setManage('zone')} className="grid size-10 shrink-0 place-items-center rounded-[9px] border border-[#d9e4f2] text-[#0b65e5] hover:bg-[#eef4ff]"><Plus className="size-3.5" /></button>
                  </div>
                </Field>
              </div>
            </div>

            {!isExisting ? (
              <div className={sectionCls}>
                <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#7b88a2]">Testing & Installation</p>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Testing Date">
                    <input type="date" className={inputCls} value={form.testing_date || ''} onChange={(e) => setForm((p) => ({ ...p, testing_date: e.target.value }))} />
                  </Field>
                  <Field label="Installation Date">
                    <input type="date" className={inputCls} value={form.installation_date || ''} onChange={(e) => setForm((p) => ({ ...p, installation_date: e.target.value }))} />
                  </Field>
                </div>
                <Field label="Testing Details">
                  <textarea rows={2} className={cx(inputCls, 'h-auto py-2')} value={form.testing_details || ''} onChange={(e) => setForm((p) => ({ ...p, testing_details: e.target.value }))} />
                </Field>
                <Field label="Assigned Employee">
                  <input className={inputCls} value={form.assigned_to || ''} onChange={(e) => setForm((p) => ({ ...p, assigned_to: e.target.value }))} placeholder="Installer / liaison executive" />
                </Field>
              </div>
            ) : null}

            <div className={sectionCls}>
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#7b88a2]">
                {isExisting ? 'Division Email / Conversion' : 'Division Mail (Solar Conversion)'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Email Sent Date">
                  <input type="date" className={inputCls} value={form.email_sent_date || ''} onChange={(e) => setForm((p) => ({ ...p, email_sent_date: e.target.value }))} />
                </Field>
                <Field label="Reference No.">
                  <input className={inputCls} value={form.email_reference || ''} onChange={(e) => setForm((p) => ({ ...p, email_reference: e.target.value }))} />
                </Field>
                <Field label="Recipient">
                  <input className={inputCls} value={form.email_recipient || ''} onChange={(e) => setForm((p) => ({ ...p, email_recipient: e.target.value }))} placeholder="Division email / office" />
                </Field>
                <Field label="Response Date">
                  <input type="date" className={inputCls} value={form.division_response_date || ''} onChange={(e) => setForm((p) => ({ ...p, division_response_date: e.target.value }))} />
                </Field>
              </div>
              <Field label="Email Notes">
                <textarea rows={2} className={cx(inputCls, 'h-auto py-2')} value={form.email_notes || ''} onChange={(e) => setForm((p) => ({ ...p, email_notes: e.target.value }))} />
              </Field>
              <Field label="Division Response">
                <textarea rows={2} className={cx(inputCls, 'h-auto py-2')} value={form.division_response || ''} onChange={(e) => setForm((p) => ({ ...p, division_response: e.target.value }))} />
              </Field>
            </div>

            <Field label="Remarks">
              <textarea rows={2} className={cx(inputCls, 'h-auto py-2')} value={form.remarks || ''} onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))} />
            </Field>

            <div className={sectionCls}>
              <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-[#7b88a2]">Documents / Attachments</p>
              <p className="text-[12px] font-semibold text-[#64748b]">
                {form.id
                  ? 'Existing uploads listed below. Add more from View → Documents after save (files are never overwritten).'
                  : 'Save the meter first, then upload multiple documents from View — each file is stored as a new attachment.'}
              </p>
              {form.id && docs.length ? (
                <ul className="mt-2 divide-y divide-[#eef2f8] rounded-[10px] border border-[#eef2f8] bg-white">
                  {docs.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 px-3 py-2 text-[12px] font-bold text-[#1e3261]">
                      <FileText className="size-3.5 text-[#0b65e5]" />
                      {d.name || d.doc_type || `Doc #${d.id}`}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-2 rounded-[10px] border border-dashed border-[#d9e4f2] bg-white px-3 py-6 text-center text-[12px] font-semibold text-[#94a3b8]">
                  No documents yet
                </div>
              )}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-2 rounded-[12px] border border-[#eef2f8] bg-[#f8fafd] p-3 text-[13px]">
            {[
              ['Source', form.meter_source],
              ['Meter Type', form.meter_type],
              ['Phase', phase],
              ['Meter No.', form.meter_number || '—'],
              ['Make / Model', form.meter_make || '—'],
              ['Division', form.division || '—'],
              ['Zone', form.zone || '—'],
              ['Status', markCompleted ? (isExisting ? 'Solar Conversion Completed / Completed' : 'Completed') : form.status],
              ['Purchase', form.purchase_date || '—'],
              ['Testing', form.testing_date || '—'],
              ['Installation', form.installation_date || '—'],
              ['Email Ref', form.email_reference || '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-[#eef2f8] py-1.5 last:border-0">
                <span className="font-semibold text-[#7b88a2]">{k}</span>
                <span className="text-right font-extrabold text-[#1e3261]">{v}</span>
              </div>
            ))}
            {markCompleted ? (
              <p className="rounded-[8px] bg-[#ecfdf5] px-2.5 py-2 text-[11px] font-bold text-[#15803d]">
                Completing Net Metering marks this project Ready for Commissioning (stage advances to Commissioning). Engineer assignment stays on the Commissioning module.
              </p>
            ) : null}
          </div>
        ) : null}
      </DrawerShell>
      {manage ? (
        <MasterManageModal
          kind={manage}
          onClose={() => setManage(null)}
          onNotify={onNotify}
          onChanged={loadMasters}
        />
      ) : null}
    </>
  );
}

export function NetMeterHistoryPanel({ history = [] }) {
  if (!history?.length) {
    return <p className="text-[12px] font-semibold text-[#94a3b8]">No status history yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {history.slice().reverse().map((h, i) => (
        <li key={`${h.at}-${i}`} className="flex gap-2 rounded-[10px] border border-[#eef2f8] bg-white px-3 py-2">
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[#eef4ff] text-[#0b65e5]">
            {h.to === 'Completed' || h.to === 'Solar Conversion Completed' ? <CheckCircle2 className="size-3.5" /> : <RefreshCw className="size-3.5" />}
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-extrabold text-[#1e3261]">
              {(h.from || '—')} → {h.to || '—'}
            </p>
            <p className="text-[11px] font-semibold text-[#7b88a2]">
              {h.by || 'System'} · {h.at ? new Date(h.at).toLocaleString('en-IN') : '—'}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
