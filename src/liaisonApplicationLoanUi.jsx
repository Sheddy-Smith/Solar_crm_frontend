/**
 * Liaisoning Application + Loan Process UI helpers (mockup redesign).
 * Reuses existing lc* APIs / documents — no duplicate masters outside Division/Zone.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Building2, CheckCircle2, FileText, IndianRupee, MapPin, Plus, RefreshCw, Sun, X, Zap,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { lcDivisionApi, lcDocumentApi, lcZoneApi, quotationApi } from './api.js';
import { normalizeApiRows } from './lib/utils.js';

export const LC_APPLICATION_TYPES = [
  'Solar Application', 'PM Surya Ghar', 'RTP', 'Load Enhancement',
  'Load Change', 'Name Change', 'System Modification', 'Other',
];

export const LC_APPLICATION_STATUSES = ['Pending', 'Under Process', 'Rejected', 'Completed'];

export const LC_LOAN_STATUSES = ['Applied', 'Under Review', 'Sanctioned', 'Disbursed', 'Rejected'];

export const LC_LOAN_BANKS = [
  'SBI', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Bank of Baroda',
  'PNB', 'Canara Bank', 'Union Bank', 'Kotak Mahindra', 'Other',
];

const TYPE_ICONS = {
  'Solar Application': Sun,
  'PM Surya Ghar': Zap,
  RTP: FileText,
  'Load Enhancement': Zap,
  'Load Change': RefreshCw,
  'Name Change': Building2,
  'System Modification': MapPin,
  Other: FileText,
};

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function money(v) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `₹${n.toLocaleString('en-IN')}`;
}

function loanPercent(quote, applied) {
  const q = Number(quote);
  const a = Number(applied);
  if (!Number.isFinite(q) || q <= 0 || !Number.isFinite(a)) return '';
  return (Math.round((a / q) * 10000) / 100).toFixed(2);
}

function DrawerShell({ title, step, steps, onClose, children, footer }) {
  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/35" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-[480px] flex-col bg-white shadow-[-12px_0_40px_rgba(17,39,84,0.18)]"
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
        <footer className="flex items-center justify-end gap-2 border-t border-[#eef2f8] px-4 py-3">{footer}</footer>
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

export function MasterManageModal({ kind, onClose, onNotify, onChanged }) {
  const api = kind === 'division' ? lcDivisionApi : lcZoneApi;
  const title = kind === 'division' ? 'Manage Division' : 'Manage Zone';
  const [rows, setRows] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [name, setName] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.list({ page_size: 200 }).then((r) => setRows(normalizeApiRows(r))).catch(() => setRows([]));
    if (kind === 'zone') {
      lcDivisionApi.list({ page_size: 200 }).then((r) => setDivisions(normalizeApiRows(r))).catch(() => setDivisions([]));
    }
  };

  useEffect(() => { load(); }, [kind]);

  const add = async () => {
    if (!name.trim()) { onNotify?.('Name required.', 'error'); return; }
    setBusy(true);
    try {
      const body = { name: name.trim(), is_active: true };
      if (kind === 'zone' && divisionId) body.division = Number(divisionId);
      await api.create(body);
      setName('');
      onNotify?.(`${title.replace('Manage ', '')} added.`, 'success');
      load();
      onChanged?.();
    } catch (e) {
      onNotify?.(e.message || 'Could not save.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete "${row.name}"?`)) return;
    try {
      await api.delete(row.id);
      load();
      onChanged?.();
    } catch (e) {
      onNotify?.(e.message || 'Delete failed.', 'error');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-[14px] bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#eef2f8] px-4 py-3">
          <h3 className="text-[15px] font-extrabold text-[#1e3261]">{title}</h3>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-[8px] hover:bg-[#f1f5f9]"><X className="size-4" /></button>
        </div>
        <div className="space-y-3 p-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            {kind === 'zone' ? (
              <select className={inputCls} value={divisionId} onChange={(e) => setDivisionId(e.target.value)}>
                <option value="">Any division</option>
                {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            ) : null}
            <input className={cx(inputCls, kind === 'zone' && 'sm:col-span-2')} placeholder={`New ${kind} name`} value={name} onChange={(e) => setName(e.target.value)} />
            <button type="button" disabled={busy} onClick={add} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[9px] bg-[#0b8f43] px-3 text-[12px] font-extrabold text-white disabled:opacity-60">
              <Plus className="size-3.5" /> Add
            </button>
          </div>
          <ul className="max-h-64 divide-y divide-[#eef2f8] overflow-auto rounded-[10px] border border-[#eef2f8]">
            {rows.length === 0 ? <li className="px-3 py-6 text-center text-[12px] font-semibold text-[#94a3b8]">No records yet.</li> : null}
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                <span className="min-w-0 truncate text-[13px] font-bold text-[#1e3261]">
                  {r.name}
                  {r.division_name ? <span className="ml-1 text-[11px] font-semibold text-[#94a3b8]">· {r.division_name}</span> : null}
                </span>
                <button type="button" onClick={() => remove(r)} className="text-[11px] font-extrabold text-[#dc2626]">Delete</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function ApplicationWizardForm({
  title, form, setForm, onClose, onSave, saving, requiredOk, isEdit, project, onNotify,
}) {
  const steps = ['Details', 'Documents', 'Review'];
  const [step, setStep] = useState(1);
  const [divisions, setDivisions] = useState([]);
  const [zones, setZones] = useState([]);
  const [docs, setDocs] = useState([]);
  const [manage, setManage] = useState(null);

  const loadMasters = () => {
    lcDivisionApi.list({ page_size: 200, is_active: true }).then((r) => setDivisions(normalizeApiRows(r))).catch(() => setDivisions([]));
    lcZoneApi.list({ page_size: 200, is_active: true }).then((r) => setZones(normalizeApiRows(r))).catch(() => setZones([]));
  };

  useEffect(() => { loadMasters(); }, []);

  useEffect(() => {
    if (!form.id || step !== 2) return;
    lcDocumentApi.list({ module: 'Application', related_id: form.id, page_size: 50 })
      .then((r) => setDocs(normalizeApiRows(r)))
      .catch(() => setDocs([]));
  }, [form.id, step]);

  const zoneOptions = useMemo(() => {
    if (!form.division) return zones;
    const div = divisions.find((d) => d.name === form.division);
    if (!div) return zones;
    return zones.filter((z) => !z.division || Number(z.division) === Number(div.id));
  }, [zones, divisions, form.division]);

  const canNext = step === 1
    ? Boolean(form.application_type && (form.status || true))
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
            {step < 3 ? (
              <button type="button" disabled={!canNext} className="h-9 rounded-[8px] bg-[#0b8f43] px-4 text-[13px] font-extrabold text-white disabled:opacity-60" onClick={() => setStep((s) => s + 1)}>Next</button>
            ) : (
              <button type="button" disabled={saving || !requiredOk} className="h-9 rounded-[8px] bg-[#0b8f43] px-4 text-[13px] font-extrabold text-white disabled:opacity-60" onClick={onSave}>
                {saving ? 'Saving…' : isEdit ? 'Update' : 'Save Application'}
              </button>
            )}
          </>
        )}
      >
        {step === 1 ? (
          <div className="space-y-3">
            <p className="text-[12px] font-semibold text-[#64748b]">
              Project: <span className="font-extrabold text-[#1e3261]">{project?.project_name || form.project || '—'}</span>
            </p>
            <div>
              <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#7b88a2]">Application Type *</p>
              <div className="grid grid-cols-2 gap-1.5">
                {LC_APPLICATION_TYPES.map((t) => {
                  const Icon = TYPE_ICONS[t] || FileText;
                  const active = form.application_type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, application_type: t }))}
                      className={cx(
                        'flex items-center gap-2 rounded-[10px] border px-2.5 py-2 text-left text-[12px] font-extrabold transition',
                        active ? 'border-[#0b8f43] bg-[#ecfdf5] text-[#0b8f43]' : 'border-[#e5eaf2] bg-white text-[#1e3261] hover:border-[#bbf7d0]',
                      )}
                    >
                      <Icon className="size-3.5 shrink-0" />
                      <span className="leading-tight">{t}</span>
                    </button>
                  );
                })}
              </div>
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
            <div className="grid grid-cols-2 gap-2">
              <Field label="Application No.">
                <input className={inputCls} value={form.application_number || ''} onChange={(e) => setForm((p) => ({ ...p, application_number: e.target.value }))} placeholder="Auto / manual" />
              </Field>
              <Field label="Applied Date">
                <input type="date" className={inputCls} value={form.submitted_date || ''} onChange={(e) => setForm((p) => ({ ...p, submitted_date: e.target.value }))} />
              </Field>
              <Field label="Capacity (kW)">
                <input type="number" className={inputCls} value={form.capacity_kw ?? ''} onChange={(e) => setForm((p) => ({ ...p, capacity_kw: e.target.value }))} />
              </Field>
              <Field label="Status">
                <select className={inputCls} value={form.status || 'Pending'} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                  {LC_APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <Field label="DISCOM">
              <input className={inputCls} value={form.discom || ''} onChange={(e) => setForm((p) => ({ ...p, discom: e.target.value }))} />
            </Field>
            <Field label="Remarks">
              <textarea rows={2} className={cx(inputCls, 'h-auto py-2')} value={form.remarks || ''} onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))} />
            </Field>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <p className="text-[12px] font-semibold text-[#64748b]">
              {form.id
                ? 'Upload / review documents linked to this application.'
                : 'Save the application first (Review step), then open it to attach documents — or continue and upload from View.'}
            </p>
            {form.id && docs.length ? (
              <ul className="divide-y divide-[#eef2f8] rounded-[10px] border border-[#eef2f8]">
                {docs.map((d) => (
                  <li key={d.id} className="px-3 py-2 text-[12px] font-bold text-[#1e3261]">{d.name || d.doc_type || `Doc #${d.id}`}</li>
                ))}
              </ul>
            ) : (
              <div className="rounded-[10px] border border-dashed border-[#d9e4f2] bg-[#f8fafd] px-3 py-8 text-center text-[12px] font-semibold text-[#94a3b8]">
                No documents yet. Use View → Documents after save.
              </div>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-2 rounded-[12px] border border-[#eef2f8] bg-[#f8fafd] p-3 text-[13px]">
            {[
              ['Type', form.application_type],
              ['Division', form.division || '—'],
              ['Zone', form.zone || '—'],
              ['Application No', form.application_number || 'Auto'],
              ['Applied On', form.submitted_date || '—'],
              ['Status', form.status],
              ['Capacity', form.capacity_kw ? `${form.capacity_kw} kW` : '—'],
              ['DISCOM', form.discom || '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-[#eef2f8] py-1.5 last:border-0">
                <span className="font-semibold text-[#7b88a2]">{k}</span>
                <span className="text-right font-extrabold text-[#1e3261]">{v}</span>
              </div>
            ))}
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

export function LoanWizardForm({
  title, form, setForm, onClose, onSave, saving, requiredOk, isEdit, project, onNotify,
}) {
  const steps = ['Loan Details', 'Documents', 'Review'];
  const [step, setStep] = useState(1);

  useEffect(() => {
    let alive = true;
    const leadId = project?.lead || project?.lead_id;
    if (!leadId || form.quotation_amount) return undefined;
    const applyQuote = (rows) => {
      if (!alive) return;
      const list = normalizeApiRows(rows);
      const best = list.find((q) => q.status === 'Approved' || q.category === 'final') || list[0];
      const amount = best?.grand_total ?? best?.project_cost_with_gst ?? project?.final_quotation_amount;
      if (amount != null && amount !== '') setForm((p) => (p.quotation_amount ? p : { ...p, quotation_amount: amount }));
    };
    if (typeof quotationApi.listAll === 'function') {
      quotationApi.listAll({ lead: leadId, page_size: 10 }).then(applyQuote).catch(() => {});
    } else if (typeof quotationApi.list === 'function') {
      quotationApi.list(leadId).then(applyQuote).catch(() => {});
    }
    return () => { alive = false; };
  }, [project, form.quotation_amount, setForm]);

  useEffect(() => {
    const pct = loanPercent(form.quotation_amount, form.loan_amount);
    if (pct !== String(form.loan_percent || '')) {
      setForm((p) => ({ ...p, loan_percent: pct }));
    }
  }, [form.quotation_amount, form.loan_amount, form.loan_percent, setForm]);

  return (
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
          {step < 3 ? (
            <button type="button" className="h-9 rounded-[8px] bg-[#0b8f43] px-4 text-[13px] font-extrabold text-white" onClick={() => setStep((s) => s + 1)}>Next</button>
          ) : (
            <button type="button" disabled={saving || !requiredOk} className="h-9 rounded-[8px] bg-[#0b8f43] px-4 text-[13px] font-extrabold text-white disabled:opacity-60" onClick={onSave}>
              {saving ? 'Saving…' : isEdit ? 'Update' : 'Save Loan'}
            </button>
          )}
        </>
      )}
    >
      {step === 1 ? (
        <div className="space-y-3">
          <p className="text-[12px] font-semibold text-[#64748b]">
            Project: <span className="font-extrabold text-[#1e3261]">{project?.project_name || '—'}</span>
            {project?.customer_name ? ` · ${project.customer_name}` : ''}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Loan Type">
              <select className={inputCls} value={form.loan_type || 'Bank Loan'} onChange={(e) => setForm((p) => ({ ...p, loan_type: e.target.value }))}>
                {['Bank Loan', 'NBFC', 'Solar Finance', 'Subsidy-linked Loan', 'Other'].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Bank / Financier">
              <select className={inputCls} value={form.financier_name || ''} onChange={(e) => setForm((p) => ({ ...p, financier_name: e.target.value }))}>
                <option value="">Select…</option>
                {LC_LOAN_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="Quotation Amount (₹)">
              <input type="number" className={inputCls} value={form.quotation_amount ?? ''} onChange={(e) => setForm((p) => ({ ...p, quotation_amount: e.target.value }))} />
            </Field>
            <Field label="Applied Loan Amount (₹)">
              <input type="number" className={inputCls} value={form.loan_amount ?? ''} onChange={(e) => setForm((p) => ({ ...p, loan_amount: e.target.value }))} />
            </Field>
            <Field label="Loan %" hint="Auto-calculated">
              <div className="flex h-10 items-center rounded-[9px] border border-[#bbf7d0] bg-[#ecfdf5] px-3 text-[13px] font-extrabold text-[#0b8f43]">
                {form.loan_percent ? `${form.loan_percent}%` : '—'}
              </div>
            </Field>
            <Field label="Status">
              <select className={inputCls} value={form.status || 'Applied'} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                {LC_LOAN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Application / Ref No.">
              <input className={inputCls} value={form.loan_account_number || ''} onChange={(e) => setForm((p) => ({ ...p, loan_account_number: e.target.value }))} />
            </Field>
            <Field label="Applied Date">
              <input type="date" className={inputCls} value={form.applied_date || ''} onChange={(e) => setForm((p) => ({ ...p, applied_date: e.target.value }))} />
            </Field>
            <Field label="Sanctioned Amount (₹)">
              <input type="number" className={inputCls} value={form.sanctioned_amount ?? ''} onChange={(e) => setForm((p) => ({ ...p, sanctioned_amount: e.target.value }))} />
            </Field>
            <Field label="Sanctioned Date">
              <input type="date" className={inputCls} value={form.sanctioned_date || ''} onChange={(e) => setForm((p) => ({ ...p, sanctioned_date: e.target.value }))} />
            </Field>
          </div>
          <Field label="Remarks">
            <textarea rows={2} className={cx(inputCls, 'h-auto py-2')} value={form.remarks || ''} onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))} />
          </Field>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="rounded-[10px] border border-dashed border-[#d9e4f2] bg-[#f8fafd] px-3 py-8 text-center text-[12px] font-semibold text-[#94a3b8]">
          Attach loan documents from View → Documents after save (Aadhaar, PAN, bank statements, sanction letter).
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-2 rounded-[12px] border border-[#eef2f8] bg-[#f8fafd] p-3 text-[13px]">
          {[
            ['Loan Type', form.loan_type],
            ['Bank / Financier', form.financier_name || '—'],
            ['Quotation', money(form.quotation_amount)],
            ['Applied Loan', money(form.loan_amount)],
            ['Loan %', form.loan_percent ? `${form.loan_percent}%` : '—'],
            ['Status', form.status],
            ['Ref No', form.loan_account_number || '—'],
            ['Sanctioned', money(form.sanctioned_amount)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-[#eef2f8] py-1.5 last:border-0">
              <span className="font-semibold text-[#7b88a2]">{k}</span>
              <span className="text-right font-extrabold text-[#1e3261]">{v}</span>
            </div>
          ))}
        </div>
      ) : null}
    </DrawerShell>
  );
}

export function countByStatusGroups(rows, groups) {
  const out = {};
  groups.forEach((g) => { out[g.key] = 0; });
  rows.forEach((r) => {
    const st = r.status || '';
    groups.forEach((g) => {
      if (g.match.includes(st)) out[g.key] += 1;
    });
  });
  out.total = rows.length;
  return out;
}

export const APPLICATION_KPI_GROUPS = [
  { key: 'under', label: 'Under Process', match: ['Under Process', 'Under Review', 'Submitted'], tone: 'blue', icon: RefreshCw },
  { key: 'pending', label: 'Pending', match: ['Pending', 'Draft'], tone: 'amber', icon: FileText },
  { key: 'rejected', label: 'Rejected', match: ['Rejected'], tone: 'red', icon: X },
  { key: 'completed', label: 'Completed', match: ['Completed', 'Approved'], tone: 'green', icon: CheckCircle2 },
];

export const LOAN_KPI_GROUPS = [
  { key: 'applied', label: 'Applied', match: ['Applied', 'Draft'], tone: 'blue', icon: FileText },
  { key: 'review', label: 'Under Review', match: ['Under Review'], tone: 'amber', icon: RefreshCw },
  { key: 'sanctioned', label: 'Sanctioned', match: ['Sanctioned'], tone: 'cyan', icon: CheckCircle2 },
  { key: 'disbursed', label: 'Disbursed', match: ['Disbursed'], tone: 'green', icon: IndianRupee },
  { key: 'rejected', label: 'Rejected', match: ['Rejected'], tone: 'red', icon: X },
];
