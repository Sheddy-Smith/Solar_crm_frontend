import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, Link2, RefreshCw, Search, UserRound, X } from 'lucide-react';
import { accountsModuleApi, projectApi, quotationApi } from './api.js';
import { normalizeApiRows } from './lib/utils.js';

function fmtRs(v) {
  const n = Number(v || 0);
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  const [duplicates, setDuplicates] = useState([]);
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [preview, setPreview] = useState(null);
  const [audits, setAudits] = useState([]);
  const [busy, setBusy] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [dup, audit] = await Promise.all([
        accountsModuleApi.detectCustomerDuplicates(),
        accountsModuleApi.mergeAudits(),
      ]);
      setDuplicates(dup?.results || []);
      setAudits(audit?.results || []);
    } catch (e) {
      onNotify?.(e.message || 'Failed to load merge data', 'error');
    }
  }, [onNotify]);

  useEffect(() => { refresh(); }, [refresh]);

  const runPreview = async () => {
    setBusy(true);
    try {
      const data = await accountsModuleApi.mergeCustomersPreview({
        source_id: Number(sourceId),
        target_id: Number(targetId),
      });
      setPreview(data);
    } catch (e) {
      onNotify?.(e.message || 'Merge preview failed', 'error');
      setPreview(null);
    } finally {
      setBusy(false);
    }
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
      setPreview(null);
      setConfirmText('');
      await refresh();
    } catch (e) {
      onNotify?.(e.message || 'Merge failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[18px] font-extrabold text-[#111827]">Customer Merge Wizard</h2>
          <p className="text-[12px] font-semibold text-[#53647f]">No automatic phone merge. Preview + confirm required.</p>
        </div>
        {onClose ? <button type="button" onClick={onClose} className="h-9 rounded-[8px] border px-3 text-[12px] font-semibold">Close</button> : null}
      </div>

      <div className="rounded-[12px] border border-[#ffedd5] bg-[#fff7ed] p-3 text-[12px] font-semibold text-[#9a3412]">
        <AlertTriangle className="mr-1 inline size-4" />
        Duplicate groups detected: {duplicates.length}. Selecting matching phones only suggests merge — never auto-executes.
      </div>

      {duplicates.slice(0, 8).map((group) => (
        <div key={group.normalized_phone} className="rounded-[12px] border border-[#e2e9f3] p-3">
          <p className="text-[12px] font-extrabold text-[#1e3261]">Mobile {group.normalized_phone} · {group.count} records</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(group.customers || []).map((c) => (
              <button
                key={c.id}
                type="button"
                className="rounded-[8px] border border-[#d9e4f2] bg-white px-2 py-1 text-[11px] font-bold"
                onClick={() => {
                  if (!sourceId) setSourceId(String(c.id));
                  else setTargetId(String(c.id));
                }}
              >
                ACC-{String(c.id).padStart(4, '0')} · {c.name}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Source Customer ID"><input className="h-10 w-full rounded-[8px] border px-3" value={sourceId} onChange={(e) => setSourceId(e.target.value)} /></Field>
        <Field label="Target (surviving) Customer ID"><input className="h-10 w-full rounded-[8px] border px-3" value={targetId} onChange={(e) => setTargetId(e.target.value)} /></Field>
        <div className="flex items-end">
          <button type="button" disabled={busy || !sourceId || !targetId} onClick={runPreview} className="h-10 w-full rounded-[8px] bg-[#0b65e5] text-[12px] font-extrabold text-white disabled:opacity-50">Preview merge</button>
        </div>
      </div>

      {preview ? (
        <div className="space-y-3 rounded-[12px] border border-[#dbe4ff] bg-[#f8fbff] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <CompareCard title="Source" data={preview.source} />
            <CompareCard title="Target / Surviving" data={preview.target} />
          </div>
          {(preview.warnings || []).length ? (
            <ul className="list-disc pl-5 text-[12px] font-semibold text-[#9a3412]">
              {preview.warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          ) : null}
          <Field label='Type MERGE to confirm'>
            <input className="h-10 w-full rounded-[8px] border px-3" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          </Field>
          <button type="button" disabled={busy} onClick={execute} className="h-10 rounded-[8px] bg-[#dc2626] px-4 text-[12px] font-extrabold text-white disabled:opacity-50">
            Execute authorized merge
          </button>
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 text-[14px] font-extrabold text-[#111827]">Merge audit history</h3>
        <RowsTable
          empty="No merge audits yet."
          columns={['When', 'Source', 'Target', 'By', 'Result']}
          rows={audits.map((a) => [a.created_at || '—', `${a.source_id} ${a.source_name}`, `${a.target_id} ${a.target_name}`, a.merged_by || '—', a.result])}
        />
      </div>
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[18px] font-extrabold text-[#111827]">Project Customer Reconciliation</h2>
          <p className="text-[12px] font-semibold text-[#53647f]">
            Orphans: {report?.total_orphans ?? '—'} · High: {report?.auto_linkable_high_confidence ?? '—'} · Exact name: {report?.exact_name_linkable ?? '—'} · Manual: {report?.needs_manual_review ?? '—'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={async () => {
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
          }} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#16a34a] px-3 text-[12px] font-extrabold text-white disabled:opacity-50">
            <Link2 className="size-3.5" /> Apply bulk reconcile
          </button>
          <button type="button" onClick={load} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border px-3 text-[12px] font-extrabold text-[#284276]">
            <RefreshCw className="size-3.5" /> Refresh
          </button>
        </div>
      </div>

      <div className="rounded-[12px] border border-[#ffedd5] bg-[#fff7ed] p-3 text-[12px] font-semibold text-[#9a3412]">
        Bulk reconcile links exact customer_name matches, then creates missing Customers with provisional 7800xxxxxx mobiles (verify later). Fuzzy name matching stays disabled.
      </div>

      <label className="flex h-10 items-center gap-2 rounded-[8px] border border-[#d9e4f2] px-3">
        <Search className="size-4 text-[#7386a3]" />
        <input className="min-w-0 flex-1 bg-transparent text-[13px] font-bold outline-none" placeholder="Search orphan projects..." value={q} onChange={(e) => setQ(e.target.value)} />
      </label>

      {loading ? <p className="py-8 text-center text-[13px] font-semibold text-[#7a8fa6]">Loading orphans…</p> : (
        <div className="overflow-x-auto rounded-[12px] border border-[#e2e9f3]">
          <table className="min-w-full text-left text-[12px]">
            <thead className="bg-[#f8fbff] text-[#53647f]">
              <tr>
                <th className="px-2 py-2">Project</th>
                <th className="px-2 py-2">Stored name</th>
                <th className="px-2 py-2">Lead</th>
                <th className="px-2 py-2">Suggestion</th>
                <th className="px-2 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.project_id} className="border-t border-[#eef2f8]">
                  <td className="px-2 py-2 font-bold">{row.project_code}<div className="font-semibold text-[#53647f]">{row.project_name}</div></td>
                  <td className="px-2 py-2">{row.customer_name || '—'}</td>
                  <td className="px-2 py-2">{row.lead_id ? `${row.lead_ivrs || row.lead_id}` : '—'}</td>
                  <td className="px-2 py-2">
                    {row.best_suggestion
                      ? `ACC-${String(row.best_suggestion.customer_id).padStart(4, '0')} · ${row.best_suggestion.reason}`
                      : <span className="text-[#9a3412]">Needs manual review</span>}
                  </td>
                  <td className="px-2 py-2">
                    <button type="button" onClick={() => {
                      setSelected(row);
                      setLinkCustomerId(row.best_suggestion?.customer_id ? String(row.best_suggestion.customer_id) : '');
                      setCreateForm({ name: row.customer_name || '', phone: '', alternate_phone: '' });
                    }} className="rounded-[6px] border px-2 py-1 text-[11px] font-extrabold text-[#0b65e5]">
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <div className="space-y-3 rounded-[12px] border border-[#dbe4ff] bg-[#f8fbff] p-4">
          <h3 className="text-[14px] font-extrabold text-[#1e3261]">
            Reconcile {selected.project_code} · {selected.project_name}
          </h3>
          <p className="text-[12px] font-semibold text-[#53647f]">{selected.review_note || 'Verified suggestion available.'}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Link existing Customer ID">
              <select className="h-10 w-full rounded-[8px] border px-3" value={linkCustomerId} onChange={(e) => setLinkCustomerId(e.target.value)}>
                <option value="">Select…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>ACC-{String(c.id).padStart(4, '0')} · {c.name} · {c.phone}</option>
                ))}
              </select>
            </Field>
            <div className="flex items-end">
              <button type="button" disabled={busy || !linkCustomerId} onClick={linkExisting} className="inline-flex h-10 items-center gap-1 rounded-[8px] bg-[#0b65e5] px-3 text-[12px] font-extrabold text-white disabled:opacity-50">
                <Link2 className="size-3.5" /> Link existing
              </button>
            </div>
            <Field label="Create Customer name"><input className="h-10 w-full rounded-[8px] border px-3" value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="Verified mobile (required)"><input className="h-10 w-full rounded-[8px] border px-3" value={createForm.phone} onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || !createForm.phone} onClick={createAndLink} className="h-9 rounded-[8px] bg-[#16a34a] px-3 text-[12px] font-extrabold text-white disabled:opacity-50">Create Customer + link</button>
            <button type="button" disabled={busy} onClick={skip} className="h-9 rounded-[8px] border border-[#fecaca] bg-[#fef2f2] px-3 text-[12px] font-extrabold text-[#dc2626] disabled:opacity-50">Skip / manual review</button>
            <button type="button" onClick={() => setSelected(null)} className="h-9 rounded-[8px] border px-3 text-[12px] font-semibold">Cancel</button>
          </div>
        </div>
      ) : null}

      <div className="rounded-[12px] border border-[#e2e9f3] p-4">
        <h3 className="mb-2 inline-flex items-center gap-2 text-[14px] font-extrabold text-[#111827]">
          <ArrowRightLeft className="size-4" /> Project Customer Reassignment
        </h3>
        <p className="mb-3 text-[12px] font-semibold text-[#53647f]">
          Moves Project + linked invoice/payment party references. Project ID and financial amounts stay intact.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Project numeric ID"><input className="h-10 w-full rounded-[8px] border px-3" value={reassign.projectId} onChange={(e) => setReassign((r) => ({ ...r, projectId: e.target.value }))} placeholder="e.g. 42" /></Field>
          <Field label="New Customer">
            <select className="h-10 w-full rounded-[8px] border px-3" value={reassign.customerId} onChange={(e) => setReassign((r) => ({ ...r, customerId: e.target.value }))}>
              <option value="">Select surviving Customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>ACC-{String(c.id).padStart(4, '0')} · {c.name} · {c.phone}</option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <button type="button" disabled={busy || !reassign.projectId || !reassign.customerId} onClick={runReassign} className="h-10 w-full rounded-[8px] bg-[#7c3aed] text-[12px] font-extrabold text-white disabled:opacity-50">Confirm reassign</button>
          </div>
        </div>
      </div>
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

function CompareCard({ title, data }) {
  return (
    <div className="rounded-[10px] border border-[#e2e9f3] bg-white p-3">
      <p className="text-[12px] font-extrabold text-[#1e3261]">{title}</p>
      <p className="mt-1 text-[13px] font-bold">{data?.name} · ACC-{String(data?.id || 0).padStart(4, '0')}</p>
      <p className="text-[12px] font-semibold text-[#53647f]">{data?.phone}</p>
      <pre className="mt-2 overflow-x-auto rounded-[8px] bg-[#f8fbff] p-2 text-[11px]">{JSON.stringify(data?.counts || {}, null, 2)}</pre>
      <pre className="mt-2 overflow-x-auto rounded-[8px] bg-[#f8fbff] p-2 text-[11px]">{JSON.stringify(data?.totals || {}, null, 2)}</pre>
    </div>
  );
}

// silence unused import warning if bundler tree-shakes aggressively
void UserRound;
void projectApi;
void quotationApi;
