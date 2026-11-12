import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  FileText,
  FolderKanban,
  IndianRupee,
  Link2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import { accountsModuleApi, projectApi, quotationApi } from './api.js';
import { normalizeApiRows } from './lib/utils.js';

function fmtRs(v) {
  const n = Number(v || 0);
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const inputClass = 'h-11 w-full rounded-[10px] border border-[#d9e4f2] bg-white px-3 text-[13px] font-semibold text-[#1e3261] outline-none transition focus:border-[#0b65e5] focus:ring-4 focus:ring-[#dbeafe]';
const softBtnClass = 'inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] border border-[#d9e4f2] bg-white px-4 text-[12px] font-extrabold text-[#284276] transition hover:bg-[#f8fbff] disabled:opacity-50';
const primaryBtnClass = 'inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] bg-[#0b65e5] px-4 text-[12px] font-extrabold text-white shadow-[0_8px_18px_rgba(11,101,229,0.25)] transition hover:bg-[#0954c2] disabled:opacity-50';
const successBtnClass = 'inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] bg-[#16a34a] px-4 text-[12px] font-extrabold text-white shadow-[0_8px_18px_rgba(22,163,74,0.25)] transition hover:bg-[#15803d] disabled:opacity-50';
const dangerBtnClass = 'inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] bg-[#dc2626] px-4 text-[12px] font-extrabold text-white shadow-[0_8px_18px_rgba(220,38,38,0.22)] transition hover:bg-[#b91c1c] disabled:opacity-50';

function WizardSectionCard({ step, title, children, action, tone = 'blue' }) {
  const bar = tone === 'green' ? 'bg-[#16a34a]' : tone === 'slate' ? 'bg-[#334155]' : 'bg-[#0b65e5]';
  return (
    <section className="overflow-hidden rounded-[14px] border border-[#e2e9f3] bg-white shadow-[0_8px_24px_rgba(24,48,87,0.06)]">
      <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-white ${bar}`}>
        <h3 className="text-[14px] font-extrabold tracking-wide">
          {step ? `${step}. ${title}` : title}
        </h3>
        {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      <div className="p-4 md:p-5">{children}</div>
    </section>
  );
}

function WizardStatCard({ label, value, Icon, tone = 'blue' }) {
  const tones = {
    blue: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]',
    green: 'border-[#bbf7d0] bg-[#ecfdf5] text-[#166534]',
    red: 'border-[#fecaca] bg-[#fef2f2] text-[#dc2626]',
    orange: 'border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]',
    purple: 'border-[#ddd6fe] bg-[#f5f3ff] text-[#6d28d9]',
    slate: 'border-[#e2e8f0] bg-[#f8fafc] text-[#334155]',
  };
  return (
    <article className={`rounded-[12px] border p-3.5 shadow-sm ${tones[tone] || tones.blue}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-extrabold uppercase tracking-wide opacity-80">{label}</p>
        {Icon ? <Icon className="size-4 opacity-70" /> : null}
      </div>
      <p className="mt-2 text-[22px] font-extrabold tracking-tight">{value}</p>
    </article>
  );
}

function KeyBenefitsStrip({ text }) {
  return (
    <div className="rounded-[12px] border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-[12px] font-semibold text-[#166534]">
      <span className="font-extrabold">Key Benefits:</span> {text}
    </div>
  );
}

function customerLabel(c) {
  if (!c) return '';
  return `${c.name || '—'}${c.phone ? ` (${c.phone})` : ''}`;
}

function CustomerPicker({ customers, value, onChange, placeholder = 'Search by name or mobile…', disabled = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const selected = useMemo(
    () => customers.find((c) => String(c.id) === String(value)) || null,
    [customers, value],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return customers.slice(0, 80);
    return customers
      .filter((c) => `${c.name || ''} ${c.phone || ''} ${c.email || ''} ${c.company || ''}`.toLowerCase().includes(needle))
      .slice(0, 80);
  }, [customers, query]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen((v) => !v); }}
        className={`${inputClass} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:opacity-80`}
      >
        <span className={selected ? 'truncate text-[#1e3261]' : 'truncate text-[#8a98af]'}>
          {selected ? customerLabel(selected) : placeholder}
        </span>
        <Search className="size-3.5 shrink-0 text-[#7585a2]" />
      </button>
      {open && !disabled ? (
        <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-[10px] border border-[#d9e4f2] bg-white shadow-lg">
          <div className="border-b border-[#edf2f8] p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#8a98af]" />
              <input
                ref={inputRef}
                className="h-9 w-full rounded-[8px] border border-[#d9e4f2] bg-[#f8fafc] pl-8 pr-3 text-[12px] font-semibold text-[#1e3261] outline-none focus:border-[#0b65e5]"
                placeholder="Type name or mobile…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-[12px] font-semibold text-[#8a98af]">No customer matched</p>
            ) : filtered.map((c) => {
              const active = String(c.id) === String(value);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onChange(String(c.id)); setOpen(false); }}
                  className={`flex w-full flex-col px-3 py-2 text-left hover:bg-[#f5f9ff] ${active ? 'bg-[#eff6ff]' : ''}`}
                >
                  <span className={`text-[12px] font-extrabold ${active ? 'text-[#0b65e5]' : 'text-[#1e3261]'}`}>{c.name || '—'}</span>
                  <span className="text-[11px] font-semibold text-[#7a8fa6]">
                    ACC-{String(c.id).padStart(4, '0')} · {c.phone || 'No mobile'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const PROFILE_TABS = [
  'Overview', 'Projects', 'Quotations', 'Accounts', 'Invoices', 'Payments', 'Documents', 'O&M / Service History', 'Activity History',
];

export function CustomerProfileModal({ customerId, onClose, onNotify, onOpenSection }) {
  const [tab, setTab] = useState('Overview');
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [projectScope, setProjectScope] = useState('');
  const [allocForm, setAllocForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      setPayload(await accountsModuleApi.customerProfile(customerId));
    } catch (e) {
      onNotify?.(e.message || 'Failed to load customer profile', 'error');
    } finally {
      setLoading(false);
    }
  }, [customerId, onNotify]);

  useEffect(() => { load(); }, [load]);

  const party = payload?.party;
  const overview = payload?.overview || {};
  const accounts = payload?.accounts || {};

  const allocate = async () => {
    if (!allocForm?.payment_id || !allocForm?.project_id || !allocForm?.amount) return;
    setBusy(true);
    try {
      await accountsModuleApi.allocatePayment({
        payment_id: Number(allocForm.payment_id),
        project_id: Number(allocForm.project_id),
        amount: allocForm.amount,
        notes: allocForm.notes || '',
      });
      onNotify?.('Advance allocated to project', 'success');
      setAllocForm(null);
      await load();
    } catch (e) {
      onNotify?.(e.message || 'Allocation failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-[#0f172a]/55 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex max-h-[96vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-t-[16px] bg-white shadow-2xl sm:max-h-[92vh] sm:rounded-[16px]">
        <div className="flex items-start justify-between gap-3 border-b border-[#edf2f8] px-5 py-3">
          <div>
            <p className="text-[12px] font-bold text-[#7a8fa6]">Customer Profile</p>
            <h3 className="text-[18px] font-extrabold text-[#111827]">
              {party?.name || '…'} · ACC-{String(customerId).padStart(4, '0')}
            </h3>
            <p className="text-[12px] font-semibold text-[#53647f]">
              {party?.phone || '—'}{party?.alternate_phone ? ` / ${party.alternate_phone}` : ''} · {party?.status || '—'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full text-[#7585a2] hover:bg-[#f4f7fb]"><X className="size-5" /></button>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-[#e8eef6] px-3">
          {PROFILE_TABS.map((item) => (
            <button key={item} type="button" onClick={() => setTab(item)} className={`shrink-0 border-b-2 px-3 py-2 text-[12px] font-extrabold ${tab === item ? 'border-[#dc2626] text-[#dc2626]' : 'border-transparent text-[#53647f]'}`}>
              {item}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? <p className="py-10 text-center text-[13px] font-semibold text-[#7a8fa6]">Loading profile…</p> : null}
          {!loading && tab === 'Overview' ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['Leads', overview.leads_count],
                ['Projects', overview.projects_count],
                ['Quotations', overview.quotations_count],
                ['Invoiced', fmtRs(overview.invoiced)],
                ['Received', fmtRs(overview.received)],
                ['Outstanding', fmtRs(overview.outstanding)],
                ['Email', party?.email || '—'],
                ['GSTIN', party?.gstin || '—'],
                ['City', party?.city || '—'],
                ['State', party?.state || '—'],
              ].map(([label, value]) => (
                <article key={label} className="rounded-[12px] border border-[#e2e9f3] bg-[#f8fbff] p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#7a8fa6]">{label}</p>
                  <p className="mt-1 text-[15px] font-extrabold text-[#1e3261]">{value ?? '—'}</p>
                </article>
              ))}
              <article className="sm:col-span-2 xl:col-span-4 rounded-[12px] border border-[#e2e9f3] p-3">
                <p className="text-[12px] font-extrabold text-[#1e3261]">Address</p>
                <p className="mt-1 text-[13px] font-semibold text-[#53647f]">{party?.address || '—'}</p>
              </article>
            </div>
          ) : null}

          {!loading && tab === 'Projects' ? (
            <div className="space-y-2">
              <div className="flex justify-end">
                <button type="button" onClick={() => onOpenSection?.('Project List')} className="h-9 rounded-[8px] bg-[#dc2626] px-3 text-[12px] font-extrabold text-white">Open Project Management</button>
              </div>
              {(payload?.projects || []).length === 0 ? <Empty text="No projects linked to this Customer." /> : (
                <table className="min-w-full text-left text-[12px]">
                  <thead className="bg-[#f8fbff] text-[#53647f]"><tr><th className="px-2 py-2">Code</th><th className="px-2 py-2">Name</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">kWp</th></tr></thead>
                  <tbody>
                    {payload.projects.map((p) => (
                      <tr key={p.id} className="border-t border-[#eef2f8]">
                        <td className="px-2 py-2 font-bold">{p.project_id}</td>
                        <td className="px-2 py-2">{p.project_name}</td>
                        <td className="px-2 py-2">{p.status}</td>
                        <td className="px-2 py-2">{p.capacity_kwp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : null}

          {!loading && tab === 'Quotations' ? (
            <RowsTable
              empty="No quotations."
              columns={['Number', 'Status', 'Amount', 'Lead', 'Project']}
              rows={(payload?.quotations || []).map((q) => [q.quotation_number || `#${q.id}`, q.status, fmtRs(q.grand_total), q.lead_id || '—', q.project_id || '—'])}
            />
          ) : null}

          {!loading && tab === 'Accounts' ? (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <Stat label="Consolidated Outstanding" value={fmtRs(accounts.consolidated?.outstanding)} />
                <Stat label="Unallocated Received" value={fmtRs(accounts.unallocated?.received)} />
                <Stat label="Projects" value={accounts.consolidated?.projects_count ?? 0} />
              </div>
              <label className="block text-[12px] font-extrabold text-[#284276]">
                Project scope
                <select className="mt-1 h-10 w-full rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-bold" value={projectScope} onChange={(e) => setProjectScope(e.target.value)}>
                  <option value="">Consolidated</option>
                  <option value="__unallocated__">Unallocated advances</option>
                  {(accounts.projects || []).map((row) => (
                    <option key={row.project_id} value={row.project_id}>{row.project_name} · {fmtRs(row.outstanding)}</option>
                  ))}
                </select>
              </label>
              <table className="min-w-full text-left text-[12px]">
                <thead className="bg-[#f8fbff] text-[#53647f]"><tr><th className="px-2 py-2">Project</th><th className="px-2 py-2">Invoiced</th><th className="px-2 py-2">Received</th><th className="px-2 py-2">Outstanding</th></tr></thead>
                <tbody>
                  {(accounts.projects || []).map((row) => (
                    <tr key={row.project_id} className="border-t border-[#eef2f8]">
                      <td className="px-2 py-2 font-bold">{row.project_name}</td>
                      <td className="px-2 py-2">{fmtRs(row.invoiced)}</td>
                      <td className="px-2 py-2">{fmtRs(row.received)}</td>
                      <td className="px-2 py-2 font-extrabold">{fmtRs(row.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" onClick={() => onOpenSection?.('Customer Ledger')} className="h-9 rounded-[8px] border border-[#d9e4f2] px-3 text-[12px] font-extrabold text-[#284276]">
                Open full ledger (scope: {projectScope || 'consolidated'})
              </button>
            </div>
          ) : null}

          {!loading && tab === 'Invoices' ? (
            <RowsTable
              empty="No invoices."
              columns={['Invoice', 'Date', 'Amount', 'Due', 'Status', 'Project']}
              rows={(payload?.invoices || []).map((inv) => [inv.invoice_no || inv.id, inv.invoice_date || '—', fmtRs(inv.total_amount), fmtRs(inv.balance_due), inv.status, inv.project_id || '—'])}
            />
          ) : null}

          {!loading && tab === 'Payments' ? (
            <div className="space-y-3">
              <RowsTable
                empty="No payments."
                columns={['Date', 'Dir', 'Amount', 'Mode', 'Ref', 'Project', 'Alloc']}
                rows={(payload?.payments || []).map((pay) => [pay.payment_date || '—', pay.direction, fmtRs(pay.amount), pay.payment_mode || '—', pay.reference_no || pay.id, pay.project_id || '—', pay.allocation_status])}
              />
              <button
                type="button"
                className="h-9 rounded-[8px] bg-[#0b65e5] px-3 text-[12px] font-extrabold text-white"
                onClick={() => {
                  const unalloc = (payload?.payments || []).find((p) => p.direction === 'Received' && !p.project_id);
                  const firstProject = (payload?.projects || [])[0];
                  setAllocForm({
                    payment_id: unalloc?.id || '',
                    project_id: firstProject?.id || '',
                    amount: unalloc?.amount || '',
                    notes: '',
                  });
                }}
              >
                Allocate unallocated advance
              </button>
              {allocForm ? (
                <div className="grid gap-2 rounded-[12px] border border-[#dbe4ff] bg-[#f8fbff] p-3 sm:grid-cols-2">
                  <Field label="Payment ID"><input className="h-10 w-full rounded-[8px] border px-3" value={allocForm.payment_id} onChange={(e) => setAllocForm((f) => ({ ...f, payment_id: e.target.value }))} /></Field>
                  <Field label="Project ID"><input className="h-10 w-full rounded-[8px] border px-3" value={allocForm.project_id} onChange={(e) => setAllocForm((f) => ({ ...f, project_id: e.target.value }))} /></Field>
                  <Field label="Amount"><input className="h-10 w-full rounded-[8px] border px-3" value={allocForm.amount} onChange={(e) => setAllocForm((f) => ({ ...f, amount: e.target.value }))} /></Field>
                  <Field label="Notes"><input className="h-10 w-full rounded-[8px] border px-3" value={allocForm.notes} onChange={(e) => setAllocForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
                  <div className="sm:col-span-2 flex gap-2">
                    <button type="button" disabled={busy} onClick={allocate} className="h-9 rounded-[8px] bg-[#16a34a] px-3 text-[12px] font-extrabold text-white disabled:opacity-50">Confirm allocation</button>
                    <button type="button" onClick={() => setAllocForm(null)} className="h-9 rounded-[8px] border px-3 text-[12px] font-semibold">Cancel</button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {!loading && tab === 'Documents' ? (
            <RowsTable empty="No documents." columns={['Name', 'Category', 'Project', 'Uploaded']} rows={(payload?.documents || []).map((d) => [d.name, d.category || '—', d.project_id || '—', d.uploaded_at || '—'])} />
          ) : null}

          {!loading && tab === 'O&M / Service History' ? (
            <RowsTable empty="No O&M plants." columns={['Plant', 'Customer', 'Status', 'Project']} rows={(payload?.om || []).map((p) => [p.plant_code || p.id, p.customer_name || '—', p.om_status || '—', p.project_id || '—'])} />
          ) : null}

          {!loading && tab === 'Activity History' ? (
            <ul className="space-y-2">
              {(payload?.activity || []).length === 0 ? <Empty text="No recent activity." /> : payload.activity.map((ev, idx) => (
                <li key={`${ev.kind}-${idx}`} className="rounded-[10px] border border-[#e2e9f3] px-3 py-2">
                  <p className="text-[12px] font-extrabold text-[#1e3261]">{ev.label}</p>
                  <p className="text-[11px] font-semibold text-[#7a8fa6]">{ev.kind} · {ev.at || '—'}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CustomerMergeWizard({ onNotify, onClose }) {
  const [customers, setCustomers] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [preview, setPreview] = useState(null);
  const [audits, setAudits] = useState([]);
  const [busy, setBusy] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [auditFilter, setAuditFilter] = useState({ q: '', result: '' });

  const refresh = useCallback(async () => {
    try {
      const [dup, audit, parties] = await Promise.all([
        accountsModuleApi.detectCustomerDuplicates(),
        accountsModuleApi.mergeAudits(),
        accountsModuleApi.parties.list({ account_type: 'Customer', page_size: 500 }),
      ]);
      setDuplicates(dup?.results || []);
      setAudits(audit?.results || []);
      setCustomers(normalizeApiRows(parties).filter((c) => c.status !== 'Merged'));
    } catch (e) {
      onNotify?.(e.message || 'Failed to load merge data', 'error');
    }
  }, [onNotify]);

  useEffect(() => { refresh(); }, [refresh]);

  const sourceCustomer = useMemo(
    () => customers.find((c) => String(c.id) === String(sourceId)) || null,
    [customers, sourceId],
  );
  const targetCustomer = useMemo(
    () => customers.find((c) => String(c.id) === String(targetId)) || null,
    [customers, targetId],
  );

  const filteredAudits = useMemo(() => {
    const needle = auditFilter.q.trim().toLowerCase();
    return audits.filter((a) => {
      if (auditFilter.result && String(a.result || '').toLowerCase() !== auditFilter.result.toLowerCase()) return false;
      if (!needle) return true;
      const hay = `${a.source_name || ''} ${a.target_name || ''} ${a.source_id || ''} ${a.target_id || ''} ${a.merged_by || ''} ${a.result || ''}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [audits, auditFilter]);

  const runPreview = async () => {
    if (!sourceId || !targetId) {
      onNotify?.('Select both Source and Target customers', 'error');
      return;
    }
    if (String(sourceId) === String(targetId)) {
      onNotify?.('Source and Target must be different', 'error');
      return;
    }
    setBusy(true);
    try {
      const data = await accountsModuleApi.mergeCustomersPreview({
        source_id: Number(sourceId),
        target_id: Number(targetId),
      });
      setPreview(data);
      setConfirmText('');
    } catch (e) {
      onNotify?.(e.message || 'Merge preview failed', 'error');
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const clearSelection = () => {
    setSourceId('');
    setTargetId('');
    setPreview(null);
    setConfirmText('');
  };

  const execute = async () => {
    if (confirmText.trim().toUpperCase() !== 'MERGE') {
      onNotify?.('Type MERGE to confirm', 'error');
      return;
    }
    setBusy(true);
    try {
      const result = await accountsModuleApi.mergeCustomers({
        source_id: Number(sourceId),
        target_id: Number(targetId),
        confirm: true,
        notes: 'UI merge wizard',
      });
      onNotify?.(`Merge completed · audit #${result.audit_id}`, 'success');
      clearSelection();
      await refresh();
    } catch (e) {
      onNotify?.(e.message || 'Merge failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const impactItems = useMemo(() => {
    const counts = preview?.source?.counts || {};
    return [
      { label: 'Projects to be linked', value: counts.projects || 0 },
      { label: 'Invoices to be linked', value: counts.sell_invoices || 0 },
      { label: 'Payments to be linked', value: counts.payments || 0 },
      { label: 'Quotations to be linked', value: counts.quotations || 0 },
      { label: 'Ledger entries to be linked', value: counts.manual_entries || 0 },
      { label: 'Leads to be linked', value: counts.leads || 0 },
    ];
  }, [preview]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-tight text-[#0f172a]">Customer Merge Wizard</h2>
          <p className="mt-1 text-[13px] font-semibold text-[#53647f]">
            Duplicate customers ko safely merge karein — preview + explicit confirmation required. Auto-merge disabled.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={refresh} className={softBtnClass}><RefreshCw className="size-3.5" /> Refresh</button>
          {onClose ? <button type="button" onClick={onClose} className={softBtnClass}>Close</button> : null}
        </div>
      </div>

      <WizardSectionCard step="1" title="Customer Merge Wizard">
        <div className="mb-4 rounded-[12px] border border-[#ffedd5] bg-[#fff7ed] px-3.5 py-3 text-[12px] font-semibold text-[#9a3412]">
          <AlertTriangle className="mr-1 inline size-4" />
          Duplicate mobile groups detected: <span className="font-extrabold">{duplicates.length}</span>. Matching phones only suggest merge — never auto-execute.
        </div>

        {duplicates.length ? (
          <div className="mb-4 space-y-2">
            {duplicates.slice(0, 6).map((group) => (
              <div key={group.normalized_phone} className="rounded-[12px] border border-[#e8eef7] bg-[#f8fbff] p-3">
                <p className="text-[12px] font-extrabold text-[#1e3261]">
                  Mobile {group.normalized_phone}
                  <span className="ml-2 inline-flex rounded-full border border-[#bfdbfe] bg-white px-2 py-0.5 text-[10px] font-extrabold text-[#1d4ed8]">
                    {group.count} records
                  </span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(group.customers || []).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="rounded-[8px] border border-[#d9e4f2] bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#284276] hover:border-[#0b65e5] hover:text-[#0b65e5]"
                      onClick={() => {
                        if (!sourceId) setSourceId(String(c.id));
                        else if (!targetId && String(c.id) !== String(sourceId)) setTargetId(String(c.id));
                        else setSourceId(String(c.id));
                        setPreview(null);
                      }}
                    >
                      ACC-{String(c.id).padStart(4, '0')} · {c.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          <Field label="Search Source Customer">
            <CustomerPicker
              customers={customers}
              value={sourceId}
              onChange={(id) => { setSourceId(id); setPreview(null); }}
              placeholder="Search source by name or mobile…"
            />
          </Field>
          <Field label="Search Target Customer">
            <CustomerPicker
              customers={customers.filter((c) => String(c.id) !== String(sourceId))}
              value={targetId}
              onChange={(id) => { setTargetId(id); setPreview(null); }}
              placeholder="Search target (surviving) customer…"
            />
          </Field>
          <div className="flex items-end">
            <button type="button" disabled={busy || !sourceId || !targetId} onClick={runPreview} className={`${primaryBtnClass} w-full lg:min-w-[140px]`}>
              <Search className="size-3.5" /> {busy ? 'Searching…' : 'Search'}
            </button>
          </div>
        </div>

        {preview ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <CompareCard
                title="Source Customer"
                tone="blue"
                data={preview.source}
                fallback={sourceCustomer}
              />
              <CompareCard
                title="Target Customer"
                tone="green"
                data={preview.target}
                fallback={targetCustomer}
              />
            </div>

            {(preview.warnings || []).length ? (
              <div className="rounded-[12px] border border-[#fecaca] bg-[#fef2f2] px-3.5 py-3">
                <p className="mb-1 text-[12px] font-extrabold text-[#dc2626]">Warnings</p>
                <ul className="list-disc space-y-1 pl-5 text-[12px] font-semibold text-[#9a3412]">
                  {preview.warnings.map((w) => <li key={w}>{w}</li>)}
                </ul>
              </div>
            ) : null}

            <div className="rounded-[12px] border border-[#bbf7d0] bg-[#f0fdf4] p-4">
              <p className="mb-3 text-[13px] font-extrabold text-[#166534]">Merge Impact Preview</p>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {impactItems.map((item) => (
                  <div key={item.label} className="flex items-center gap-2 text-[12px] font-semibold text-[#166534]">
                    <CheckCircle2 className="size-4 shrink-0 text-[#16a34a]" />
                    <span>{item.label}: <span className="font-extrabold">{item.value}</span></span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] font-semibold text-[#15803d]">
                Source customer will be marked Merged. Target remains the surviving master record.
              </p>
            </div>

            <Field label='Type MERGE to confirm'>
              <input
                className={inputClass}
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type MERGE"
              />
            </Field>

            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" disabled={busy} onClick={clearSelection} className={softBtnClass}>Cancel</button>
              <button type="button" disabled={busy} onClick={execute} className={dangerBtnClass}>
                {busy ? 'Merging…' : 'Confirm Merge'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-[12px] border border-dashed border-[#d9e4f2] bg-[#f8fbff] px-4 py-10 text-center">
            <UserRound className="mx-auto size-9 text-[#bfdbfe]" />
            <p className="mt-3 text-[14px] font-extrabold text-[#1e3261]">Source aur Target select karke Search dabayein</p>
            <p className="mt-1 text-[12px] font-semibold text-[#7a8fa6]">Comparison cards aur merge impact preview yahin dikhenge.</p>
          </div>
        )}
      </WizardSectionCard>

      <WizardSectionCard
        step="2"
        title="Merge Audit History"
        tone="slate"
        action={(
          <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-extrabold">
            {filteredAudits.length} records
          </span>
        )}
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Field label="Search audits">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a98af]" />
              <input
                className={`${inputClass} pl-9`}
                placeholder="Source, target, user…"
                value={auditFilter.q}
                onChange={(e) => setAuditFilter((f) => ({ ...f, q: e.target.value }))}
              />
            </div>
          </Field>
          <Field label="Result">
            <select
              className={inputClass}
              value={auditFilter.result}
              onChange={(e) => setAuditFilter((f) => ({ ...f, result: e.target.value }))}
            >
              <option value="">All results</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </Field>
          <div className="flex items-end">
            <button type="button" onClick={() => setAuditFilter({ q: '', result: '' })} className={`${softBtnClass} w-full`}>Clear filters</button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-[12px] border border-[#e8eef7]">
          <table className="min-w-full text-left text-[12px]">
            <thead className="bg-[#f8fbff] text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">
              <tr>
                {['When', 'Source', 'Target', 'By', 'Result'].map((h) => (
                  <th key={h} className="px-3 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAudits.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-10 text-center text-[#7a8fa6]">No merge audits yet.</td></tr>
              ) : filteredAudits.map((a) => (
                <tr key={a.id} className="border-t border-[#edf2f8]">
                  <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-[#334155]">{a.created_at ? new Date(a.created_at).toLocaleString('en-IN') : '—'}</td>
                  <td className="px-3 py-2.5 font-bold text-[#1e3261]">ACC-{String(a.source_id).padStart(4, '0')} · {a.source_name}</td>
                  <td className="px-3 py-2.5 font-bold text-[#166534]">ACC-{String(a.target_id).padStart(4, '0')} · {a.target_name}</td>
                  <td className="px-3 py-2.5">{a.merged_by || '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                      String(a.result).toLowerCase() === 'completed'
                        ? 'border border-[#bbf7d0] bg-[#ecfdf5] text-[#166534]'
                        : 'border border-[#fecaca] bg-[#fef2f2] text-[#dc2626]'
                    }`}>
                      {a.result || '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WizardSectionCard>

      <KeyBenefitsStrip text="Remove Duplicate Customers · 100% Data Integrity · Full Audit Trail · No Automatic Phone Merge" />
      <p className="text-center text-[11px] font-semibold text-[#94a3b8]">Malwa Solar CRM – Customer Management</p>
    </div>
  );
}

export function ProjectCustomerReconciliationPanel({ onNotify }) {
  const [report, setReport] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [linkCustomerId, setLinkCustomerId] = useState('');
  const [createForm, setCreateForm] = useState({ name: '', phone: '', alternate_phone: '' });
  const [busy, setBusy] = useState(false);
  const [reassign, setReassign] = useState({ projectId: '', customerId: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [orphans, parties] = await Promise.all([
        accountsModuleApi.orphanProjects(),
        accountsModuleApi.parties.list({ account_type: 'Customer', page_size: 500 }),
      ]);
      setReport(orphans);
      setCustomers(normalizeApiRows(parties).filter((c) => c.status !== 'Merged'));
    } catch (e) {
      onNotify?.(e.message || 'Failed to load reconciliation data', 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const list = report?.results || [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((r) => `${r.project_code} ${r.project_name} ${r.customer_name}`.toLowerCase().includes(needle));
  }, [report, q]);

  const linkExisting = async () => {
    if (!selected || !linkCustomerId) return;
    setBusy(true);
    try {
      await accountsModuleApi.linkOrphanProject({
        project_id: selected.project_id,
        customer_id: Number(linkCustomerId),
        match_reason: selected.best_suggestion?.reason || 'manual_ui',
      });
      onNotify?.('Project linked to Customer', 'success');
      setSelected(null);
      await load();
    } catch (e) {
      onNotify?.(e.message || 'Link failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const createAndLink = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await accountsModuleApi.createCustomerForOrphan({
        project_id: selected.project_id,
        name: createForm.name || selected.customer_name,
        phone: createForm.phone,
        alternate_phone: createForm.alternate_phone,
      });
      onNotify?.('Customer created and Project linked', 'success');
      setSelected(null);
      setCreateForm({ name: '', phone: '', alternate_phone: '' });
      await load();
    } catch (e) {
      onNotify?.(e.message || 'Create+link failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await accountsModuleApi.skipOrphanProject({ project_id: selected.project_id, notes: 'UI manual review' });
      onNotify?.('Marked for manual review', 'success');
      setSelected(null);
      await load();
    } catch (e) {
      onNotify?.(e.message || 'Skip failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const runReassign = async () => {
    if (!reassign.projectId || !reassign.customerId) return;
    setBusy(true);
    try {
      await accountsModuleApi.reassignProjectCustomer(reassign.projectId, {
        customer_id: Number(reassign.customerId),
        update_docs: true,
      });
      onNotify?.('Project reassigned', 'success');
      setReassign({ projectId: '', customerId: '' });
      await load();
    } catch (e) {
      onNotify?.(e.message || 'Reassignment failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const stats = [
    { label: 'Orphans', value: report?.total_orphans ?? 0, tone: 'red', Icon: AlertTriangle },
    { label: 'High Match', value: report?.auto_linkable_high_confidence ?? 0, tone: 'green', Icon: CheckCircle2 },
    { label: 'Exact Match', value: report?.exact_name_linkable ?? 0, tone: 'blue', Icon: Link2 },
    { label: 'Manual Review', value: report?.needs_manual_review ?? 0, tone: 'orange', Icon: FileText },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-tight text-[#0f172a]">Project Customer Reconciliation</h2>
          <p className="mt-1 text-[13px] font-semibold text-[#53647f]">
            Orphan projects ko customer masters se link karein — high-confidence suggestions + manual review.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await accountsModuleApi.applyOrphanReconciliation({ create_missing: true, dry_run: false });
                onNotify?.(
                  `Reconciled · linked high ${result.linked_high || 0}, exact ${result.linked_exact_name || 0}, created ${result.customers_created || 0}, remaining ${result.remaining_orphans || 0}`,
                  'success',
                );
                await load();
              } catch (e) {
                onNotify?.(e.message || 'Bulk reconcile failed', 'error');
              } finally {
                setBusy(false);
              }
            }}
            className={successBtnClass}
          >
            <Link2 className="size-3.5" /> Apply bulk reconcile
          </button>
          <button type="button" onClick={load} className={softBtnClass}>
            <RefreshCw className="size-3.5" /> Refresh
          </button>
        </div>
      </div>

      <WizardSectionCard step="1" title="Project Reconciliation">
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((card) => (
            <WizardStatCard key={card.label} {...card} />
          ))}
        </div>

        <div className="mb-4 rounded-[12px] border border-[#ffedd5] bg-[#fff7ed] px-3.5 py-3 text-[12px] font-semibold text-[#9a3412]">
          Bulk reconcile links exact customer_name matches, then creates missing Customers with provisional 7800xxxxxx mobiles (verify later). Fuzzy name matching stays disabled.
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Field label="Search orphan projects">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a98af]" />
              <input
                className={`${inputClass} pl-9`}
                placeholder="Project code, name, customer…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </Field>
          <div className="flex items-end">
            <p className="text-[12px] font-semibold text-[#7a8fa6]">
              Showing <span className="font-extrabold text-[#1e3261]">{rows.length}</span> orphan project(s)
            </p>
          </div>
        </div>

        {loading ? (
          <p className="py-10 text-center text-[13px] font-semibold text-[#7a8fa6]">Loading orphans…</p>
        ) : (
          <div className="overflow-x-auto rounded-[12px] border border-[#e8eef7]">
            <table className="min-w-full text-left text-[12px]">
              <thead className="bg-[#f8fbff] text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">
                <tr>
                  {['Project', 'Stored name', 'Lead', 'Suggestion', 'Action'].map((h) => (
                    <th key={h} className="px-3 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-10 text-center text-[#7a8fa6]">No orphan projects found.</td></tr>
                ) : rows.map((row) => (
                  <tr key={row.project_id} className="border-t border-[#edf2f8]">
                    <td className="px-3 py-2.5 font-bold text-[#1e3261]">
                      {row.project_code}
                      <div className="font-semibold text-[#53647f]">{row.project_name}</div>
                    </td>
                    <td className="px-3 py-2.5">{row.customer_name || '—'}</td>
                    <td className="px-3 py-2.5">{row.lead_id ? `${row.lead_ivrs || row.lead_id}` : '—'}</td>
                    <td className="px-3 py-2.5">
                      {row.best_suggestion ? (
                        <span className="inline-flex rounded-full border border-[#bbf7d0] bg-[#ecfdf5] px-2.5 py-0.5 text-[10px] font-extrabold text-[#166534]">
                          ACC-{String(row.best_suggestion.customer_id).padStart(4, '0')} · {row.best_suggestion.reason}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-[#fed7aa] bg-[#fff7ed] px-2.5 py-0.5 text-[10px] font-extrabold text-[#c2410c]">
                          Needs manual review
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(row);
                          setLinkCustomerId(row.best_suggestion?.customer_id ? String(row.best_suggestion.customer_id) : '');
                          setCreateForm({ name: row.customer_name || '', phone: '', alternate_phone: '' });
                        }}
                        className="rounded-[8px] border border-[#bfdbfe] bg-[#eff6ff] px-3 py-1.5 text-[11px] font-extrabold text-[#0b65e5] hover:bg-[#dbeafe]"
                      >
                        Select Customer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selected ? (
          <div className="mt-4 space-y-3 rounded-[12px] border border-[#dbe4ff] bg-[#f8fbff] p-4">
            <h3 className="text-[14px] font-extrabold text-[#1e3261]">
              Reconcile {selected.project_code} · {selected.project_name}
            </h3>
            <p className="text-[12px] font-semibold text-[#53647f]">{selected.review_note || 'Verified suggestion available.'}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Link existing Customer">
                <CustomerPicker
                  customers={customers}
                  value={linkCustomerId}
                  onChange={setLinkCustomerId}
                  placeholder="Search customer to link…"
                />
              </Field>
              <div className="flex items-end">
                <button type="button" disabled={busy || !linkCustomerId} onClick={linkExisting} className={`${primaryBtnClass} w-full`}>
                  <Link2 className="size-3.5" /> Link existing
                </button>
              </div>
              <Field label="Create Customer name">
                <input className={inputClass} value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} />
              </Field>
              <Field label="Verified mobile (required)">
                <input className={inputClass} value={createForm.phone} onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy || !createForm.phone} onClick={createAndLink} className={successBtnClass}>Create Customer + link</button>
              <button type="button" disabled={busy} onClick={skip} className={`${softBtnClass} border-[#fecaca] bg-[#fef2f2] text-[#dc2626]`}>Skip / manual review</button>
              <button type="button" onClick={() => setSelected(null)} className={softBtnClass}>Cancel</button>
            </div>
          </div>
        ) : null}
      </WizardSectionCard>

      <WizardSectionCard step="2" title="Project Customer Reassignment" tone="slate">
        <p className="mb-4 text-[12px] font-semibold text-[#53647f]">
          <ArrowRightLeft className="mr-1 inline size-4" />
          Moves Project + linked invoice/payment party references. Project ID and financial amounts stay intact.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Project numeric ID">
            <input
              className={inputClass}
              value={reassign.projectId}
              onChange={(e) => setReassign((r) => ({ ...r, projectId: e.target.value }))}
              placeholder="e.g. 42"
            />
          </Field>
          <Field label="New Customer">
            <CustomerPicker
              customers={customers}
              value={reassign.customerId}
              onChange={(id) => setReassign((r) => ({ ...r, customerId: id }))}
              placeholder="Select surviving Customer…"
            />
          </Field>
          <div className="flex items-end">
            <button
              type="button"
              disabled={busy || !reassign.projectId || !reassign.customerId}
              onClick={runReassign}
              className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#7c3aed] px-4 text-[12px] font-extrabold text-white shadow-[0_8px_18px_rgba(124,58,237,0.25)] transition hover:bg-[#6d28d9] disabled:opacity-50"
            >
              Confirm reassign
            </button>
          </div>
        </div>
      </WizardSectionCard>

      <KeyBenefitsStrip text="Orphan cleanup · Exact-name linking · Manual review safety · Project financial integrity preserved" />
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-[12px] font-extrabold text-[#284276]">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Empty({ text }) {
  return <p className="py-8 text-center text-[13px] font-semibold text-[#7a8fa6]">{text}</p>;
}

function Stat({ label, value }) {
  return (
    <article className="rounded-[12px] border border-[#e2e9f3] bg-white p-3">
      <p className="text-[11px] font-bold uppercase text-[#7a8fa6]">{label}</p>
      <p className="mt-1 text-[15px] font-extrabold text-[#1e3261]">{value}</p>
    </article>
  );
}

function RowsTable({ columns, rows, empty }) {
  if (!rows?.length) return <Empty text={empty} />;
  return (
    <div className="overflow-x-auto rounded-[12px] border border-[#e2e9f3]">
      <table className="min-w-full text-left text-[12px]">
        <thead className="bg-[#f8fbff] text-[#53647f]">
          <tr>{columns.map((c) => <th key={c} className="px-2 py-2 font-extrabold">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="border-t border-[#eef2f8]">
              {row.map((cell, i) => <td key={i} className="px-2 py-2">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompareCard({ title, data, fallback = null, tone = 'blue' }) {
  const isGreen = tone === 'green';
  const shell = isGreen
    ? 'border-[#86efac] bg-[#f0fdf4]'
    : 'border-[#93c5fd] bg-[#eff6ff]';
  const head = isGreen ? 'text-[#166534]' : 'text-[#1d4ed8]';
  const badge = isGreen
    ? 'border-[#86efac] bg-white text-[#166534]'
    : 'border-[#93c5fd] bg-white text-[#1d4ed8]';
  const counts = data?.counts || {};
  const totals = data?.totals || {};
  const email = data?.email || fallback?.email || 'N/A';
  const address = data?.address || fallback?.address || fallback?.city || '—';

  return (
    <article className={`rounded-[14px] border p-4 shadow-sm ${shell}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className={`text-[13px] font-extrabold uppercase tracking-wide ${head}`}>{title}</p>
        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold ${badge}`}>
          ACC-{String(data?.id || 0).padStart(4, '0')}
        </span>
      </div>
      <div className="space-y-2.5 text-[13px]">
        <p className="flex items-start gap-2 font-extrabold text-[#0f172a]">
          <UserRound className={`mt-0.5 size-4 shrink-0 ${head}`} />
          {data?.name || '—'}
        </p>
        <p className="flex items-start gap-2 font-semibold text-[#334155]">
          <Phone className="mt-0.5 size-4 shrink-0 text-[#64748b]" />
          {data?.phone || '—'}
          {data?.alternate_phone ? ` / ${data.alternate_phone}` : ''}
        </p>
        <p className="flex items-start gap-2 font-semibold text-[#334155]">
          <Mail className="mt-0.5 size-4 shrink-0 text-[#64748b]" />
          {email}
        </p>
        <p className="flex items-start gap-2 font-semibold text-[#334155]">
          <MapPin className="mt-0.5 size-4 shrink-0 text-[#64748b]" />
          {address}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-[#bfdbfe] bg-white px-2.5 py-1 text-[11px] font-extrabold text-[#1d4ed8]">
          <FolderKanban className="size-3.5" /> {counts.projects || 0} Projects
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-[#bbf7d0] bg-white px-2.5 py-1 text-[11px] font-extrabold text-[#166534]">
          <FileText className="size-3.5" /> {counts.sell_invoices || 0} Invoices
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-[#fed7aa] bg-white px-2.5 py-1 text-[11px] font-extrabold text-[#c2410c]">
          <IndianRupee className="size-3.5" /> Due {fmtRs(totals.outstanding || 0)}
        </span>
      </div>
    </article>
  );
}

// silence unused import warning if bundler tree-shakes aggressively
void projectApi;
void quotationApi;
