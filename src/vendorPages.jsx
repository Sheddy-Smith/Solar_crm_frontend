import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download, Eye, FileText, Layers, Pencil, Phone, Plus, Receipt, Save, Search, Trash2, Wallet, X,
} from 'lucide-react';
import { accountsModuleApi, projectApi } from './api.js';
import { exportNotifyCsv, normalizeApiRows } from './lib/utils.js';
import { moduleCaps } from './settingsHubPages.jsx';
import { MobileCardEmpty, MobileCardList, MobileRecordCard } from './components/mobile/MobileRecordCard.jsx';
import { LedgerMobileCards } from './components/mobile/LedgerMobileCards.jsx';
import { MobileSubnavSelect } from './components/mobile/MobileSubnavSelect.jsx';
import { TablePagination, usePagedRows } from './components/TablePagination.jsx';

const TABS = [
  { key: 'Vendor Details', label: 'Vendor Details' },
  { key: 'Vendor Ledger', label: 'Vendor Ledger' },
  { key: 'Vendor Overall Credit Ledger', label: 'Overall Credit Ledger' },
];

const PAYMENT_MODES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];

const emptyForm = {
  name: '',
  company: '',
  phone: '',
  address: '',
  gstin: '',
  vendor_type: '',
  opening_balance: '0',
  credit_limit: '0',
  city: '',
};

function fmtRs(v) {
  const n = Number(v || 0);
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDisplayDate(value) {
  if (!value) return '—';
  const raw = String(value).slice(0, 10);
  const [y, m, d] = raw.split('-');
  if (!y || !m || !d) return raw;
  return `${d}/${m}/${y}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function monthEndIso(d = new Date()) {
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
}

function weekRangeIso(d = new Date()) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  return { start: iso(start), end: iso(end) };
}

function BalanceBadge({ balance }) {
  const n = Number(balance || 0);
  if (Math.abs(n) < 0.01) return <span className="text-[11px] font-bold text-[#64748b]">Clear</span>;
  return <span className="text-[11px] font-bold text-[#dc2626]">Payable</span>;
}

function TypeBadge({ value }) {
  const key = String(value || '').toLowerCase();
  const tone = {
    service: 'bg-[#ede9fe] text-[#6d28d9]',
    payment: 'bg-[#dcfce7] text-[#166534]',
    receipt: 'bg-[#dbeafe] text-[#1d4ed8]',
    opening: 'bg-[#f1f5f9] text-[#475569]',
    manual: 'bg-[#ffedd5] text-[#c2410c]',
  }[key] || 'bg-[#f1f5f9] text-[#475569]';
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${tone}`}>{key || '—'}</span>;
}

function ProgressRing({ percent = 0, size = 72, stroke = 7, label }) {
  const pct = Math.max(0, Math.min(100, Number(percent) || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="inline-flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={pct >= 100 ? '#16a34a' : '#0b65e5'}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          className="rotate-90 fill-[#1e3261] text-[12px] font-extrabold"
          style={{ transformOrigin: 'center', transform: 'rotate(90deg)' }}
        >
          {pct.toFixed(0)}%
        </text>
      </svg>
      {label ? <span className="text-[10px] font-bold text-[#64748b]">{label}</span> : null}
    </div>
  );
}

function ModalShell({ title, onClose, children, footer, wide }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#0f172a]/55 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`flex max-h-[96vh] w-full flex-col overflow-hidden rounded-t-[16px] bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-[16px] ${wide ? 'max-w-[820px]' : 'max-w-[560px]'}`}>
        <div className="flex items-center justify-between border-b border-[#edf2f8] px-5 py-3">
          <h3 className="text-[16px] font-extrabold text-[#111827]">{title}</h3>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full text-[#7585a2] hover:bg-[#f4f7fb]"><X className="size-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-[#edf2f8] px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="grid gap-1 text-[12px] font-bold text-[#53647f]">
      {label}{required ? ' *' : ''}
      {children}
    </label>
  );
}

const inputClass = 'h-10 w-full rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold text-[#1e3261] outline-none';

export function VendorModulePage({ activeSection, onOpenSection, onNotify, loggedInUser = null }) {
  const caps = moduleCaps(loggedInUser, 'Vendors');
  const tab = TABS.some((t) => t.key === activeSection) ? activeSection : 'Vendor Details';
  const [addRequested, setAddRequested] = useState(false);

  const requestAddVendor = () => {
    if (tab !== 'Vendor Details') onOpenSection?.('Vendor Details');
    setAddRequested(true);
  };

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[12px] font-bold text-[#7a8fa6]">Dashboard / Vendors</p>
          <h1 className="font-display text-[20px] font-extrabold text-[#111827] sm:text-[22px]">Vendor Management</h1>
          <p className="mt-1 text-[12px] font-semibold text-[#7386a3]">Solar installation assignment, stage progress, earned payable &amp; payment ledger.</p>
        </div>
        {caps.add ? (
          <button
            type="button"
            onClick={requestAddVendor}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] bg-[#dc2626] px-4 text-[13px] font-extrabold text-white sm:w-auto"
          >
            <Plus className="size-4" /> Add Vendor
          </button>
        ) : null}
      </div>
      <MobileSubnavSelect
        tone="red"
        items={TABS.map((item) => ({ value: item.key, label: item.label }))}
        value={tab}
        onChange={onOpenSection}
      />
      <div className="-mx-1 hidden gap-1 overflow-x-auto border-b border-[#e8eef6] px-1 md:flex">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onOpenSection(item.key)}
            className={`shrink-0 border-b-2 px-3 py-2 text-[13px] font-extrabold ${tab === item.key ? 'border-[#dc2626] text-[#dc2626]' : 'border-transparent text-[#53647f] hover:text-[#1e3261]'}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === 'Vendor Details' ? (
        <VendorDetailsTab
          caps={caps}
          onNotify={onNotify}
          addRequested={addRequested}
          onAddRequestConsumed={() => setAddRequested(false)}
        />
      ) : null}
      {tab === 'Vendor Ledger' ? (
        <VendorLedgerTab onNotify={onNotify} onOpenSection={onOpenSection} />
      ) : null}
      {tab === 'Vendor Overall Credit Ledger' ? (
        <VendorOverallCreditTab onNotify={onNotify} onOpenSection={onOpenSection} />
      ) : null}
    </div>
  );
}

function VendorDetailsTab({ caps, onNotify, addRequested = false, onAddRequestConsumed }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await accountsModuleApi.parties.list({ account_type: 'Vendor', page_size: 200 });
      setRows(normalizeApiRows(data));
    } catch (e) {
      onNotify(e.message || 'Failed to load vendors', 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!addRequested) return;
    setModal({ form: { ...emptyForm } });
    onAddRequestConsumed?.();
  }, [addRequested, onAddRequestConsumed]);

  const filtered = rows.filter((r) => {
    const hay = `${r.name} ${r.company} ${r.phone} ${r.vendor_type} ${r.address}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });
  const { pageRows, pagination } = usePagedRows(filtered, 'vendor-list', { resetKey: q });

  const save = async () => {
    if (!modal?.form?.name?.trim() || !modal.form.phone?.trim()) {
      onNotify('Name and phone are required', 'error');
      return;
    }
    if (modal.form.phone.replace(/\D/g, '').length !== 10) {
      onNotify('Phone must be 10 digits', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...modal.form,
        account_type: 'Vendor',
        status: 'Active',
        city: modal.form.city || (modal.form.address || '').split(',').pop()?.trim() || '',
      };
      if (modal.id) await accountsModuleApi.parties.update(modal.id, payload);
      else await accountsModuleApi.parties.create(payload);
      onNotify(modal.id ? 'Vendor updated' : 'Vendor added', 'success');
      setModal(null);
      await load();
    } catch (e) {
      onNotify(e.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete ${row.name}?`)) return;
    try {
      await accountsModuleApi.parties.delete(row.id);
      onNotify('Vendor deleted', 'success');
      await load();
    } catch (e) {
      onNotify(e.message || 'Delete failed', 'error');
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <input className={`${inputClass} w-full sm:max-w-xs`} placeholder="Search vendors..." value={q} onChange={(e) => setQ(e.target.value)} />
        {caps.export ? (
          <button
            type="button"
            onClick={() => exportNotifyCsv(onNotify, 'vendors', ['Name', 'Phone', 'Company', 'Type', 'Net Balance'], filtered.map((r) => [r.name, r.phone, r.company, r.vendor_type, r.balance]))}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-extrabold text-[#284276] sm:w-auto"
          >
            <Download className="size-4" /> Export CSV
          </button>
        ) : null}
      </div>
      {loading ? (
        <p className="py-8 text-center text-[13px] font-semibold text-[#7a8fa6] lg:hidden">Loading...</p>
      ) : filtered.length === 0 ? (
        <MobileCardEmpty title="No vendors yet" hint="Add your first vendor." />
      ) : (
        <MobileCardList>
          {pageRows.map((r) => {
            const digits = String(r.phone || '').replace(/\D/g, '');
            return (
              <MobileRecordCard
                key={r.id}
                avatar={r.name}
                title={r.name}
                subtitle={[r.phone, r.company].filter(Boolean).join(' · ')}
                aside={<span className={Number(r.balance) > 0 ? 'text-[#dc2626]' : undefined}>{fmtRs(Math.abs(Number(r.balance || 0)))}</span>}
                badges={(
                  <>
                    <BalanceBadge balance={r.balance} />
                    {r.vendor_type ? <span className="rounded-full bg-[#f5f3ff] px-2 py-0.5 text-[10px] font-extrabold text-[#6d28d9]">{r.vendor_type}</span> : null}
                  </>
                )}
                details={[
                  { label: 'GSTIN', value: r.gstin },
                  { label: 'Address', value: r.address || r.city, wide: true },
                ]}
                actions={[
                  { label: 'Call', icon: Phone, tone: 'green', href: digits ? `tel:${digits}` : null, disabled: !digits },
                  caps.edit ? { label: 'Edit', icon: Pencil, tone: 'blue', onClick: () => setModal({ id: r.id, form: { ...emptyForm, ...r } }) } : null,
                ]}
                menu={caps.delete ? [{ label: 'Delete', icon: Trash2, danger: true, onClick: () => remove(r) }] : []}
              />
            );
          })}
        </MobileCardList>
      )}
      <div className="hidden overflow-x-auto rounded-[12px] border border-[#e2e9f3] bg-white lg:block">
        <table className="min-w-[760px] text-left text-[13px]">
          <thead className="bg-[#f8fbff] text-[11px] font-extrabold uppercase tracking-wide text-[#7a8fa6]">
            <tr>
              {['Name', 'Phone', 'Company', 'Type', 'Net Balance', 'Actions'].map((h) => (
                <th key={h} className="px-3 py-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-[#7a8fa6]">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-[#7a8fa6]">No vendors yet. Add your first vendor.</td></tr>
            ) : pageRows.map((r) => (
              <tr key={r.id} className="border-t border-[#edf2f8]">
                <td className="px-3 py-2.5 font-extrabold text-[#1e3261]">{r.name}</td>
                <td className="px-3 py-2.5">{r.phone || '—'}</td>
                <td className="px-3 py-2.5">{r.company || '—'}</td>
                <td className="px-3 py-2.5">{r.vendor_type || '—'}</td>
                <td className="px-3 py-2.5">
                  <div className={`font-extrabold ${Number(r.balance) > 0 ? 'text-[#dc2626]' : 'text-[#1e3261]'}`}>{fmtRs(Math.abs(Number(r.balance || 0)))}</div>
                  <BalanceBadge balance={r.balance} />
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    {caps.edit ? (<button type="button" onClick={() => setModal({ id: r.id, form: { ...emptyForm, ...r } })} className="grid size-8 place-items-center rounded-[8px] text-[#0b65e5] hover:bg-[#eff6ff]"><Pencil className="size-4" /></button>) : null}
                    {caps.delete ? (<button type="button" onClick={() => remove(r)} className="grid size-8 place-items-center rounded-[8px] text-[#dc2626] hover:bg-[#fef2f2]"><Trash2 className="size-4" /></button>) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading ? <TablePagination {...pagination} className="rounded-[12px] border border-[#e2e9f3]" /> : null}
      {modal ? (
        <ModalShell
          title={modal.id ? 'Edit Vendor' : 'Add New Vendor'}
          onClose={() => setModal(null)}
          footer={(
            <>
              <button type="button" onClick={() => setModal(null)} className="h-10 rounded-[8px] border px-4 text-[13px] font-semibold">Cancel</button>
              <button type="button" disabled={saving} onClick={save} className="h-10 rounded-[8px] bg-[#dc2626] px-4 text-[13px] font-extrabold text-white disabled:opacity-60">{saving ? 'Saving...' : modal.id ? 'Save Vendor' : 'Add Vendor'}</button>
            </>
          )}
        >
          <div className="grid gap-3">
            <Field label="Name" required><input className={inputClass} value={modal.form.name || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, name: e.target.value } }))} /></Field>
            <Field label="Phone (10 digits only)" required><input className={inputClass} placeholder="Enter 10-digit phone number" maxLength={10} value={modal.form.phone || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) } }))} /></Field>
            <Field label="Company"><input className={inputClass} value={modal.form.company || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, company: e.target.value } }))} /></Field>
            <Field label="Vendor Type"><input className={inputClass} placeholder="e.g., I&C, Structure, Electrical" value={modal.form.vendor_type || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, vendor_type: e.target.value } }))} /></Field>
            <Field label="Address"><textarea className={`${inputClass} h-20 py-2`} value={modal.form.address || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, address: e.target.value } }))} /></Field>
            <Field label="GSTIN (15 alphanumeric characters)"><input className={inputClass} placeholder="ENTER 15-CHARACTER GST NUMBER" maxLength={15} value={modal.form.gstin || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, gstin: e.target.value.toUpperCase() } }))} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Opening Balance (₹)"><input type="number" className={inputClass} value={modal.form.opening_balance || '0'} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, opening_balance: e.target.value } }))} /></Field>
              <Field label="Credit Limit (₹)"><input type="number" className={inputClass} value={modal.form.credit_limit || '0'} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, credit_limit: e.target.value } }))} /></Field>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}

function emptyManualForm() {
  return {
    entry_date: todayIso(),
    work: '',
    debit: '',
    credit: '',
  };
}

function computeContractPreview(capacityKw, rate, rateUnit) {
  const kw = Number(capacityKw) || 0;
  const r = Number(rate) || 0;
  if (rateUnit === 'per_kw') return +(kw * r).toFixed(2);
  return +((kw * 1000) * r).toFixed(2);
}

function VendorLedgerTab({ onNotify, onOpenSection }) {
  const [vendors, setVendors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [partyId, setPartyId] = useState('');
  const [mode, setMode] = useState('monthly');
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [category, setCategory] = useState('');
  const [payload, setPayload] = useState(null);
  const [installSummary, setInstallSummary] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftForm, setDraftForm] = useState(emptyManualForm());
  const [editRow, setEditRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState(null);
  const [stageView, setStageView] = useState(null);
  const [savingAction, setSavingAction] = useState(false);

  useEffect(() => {
    accountsModuleApi.parties.list({ account_type: 'Vendor', page_size: 200 })
      .then((data) => setVendors(normalizeApiRows(data)))
      .catch((e) => onNotify(e.message || 'Failed to load vendors', 'error'));
    projectApi.list({ page_size: 200 })
      .then((data) => setProjects(normalizeApiRows(data)))
      .catch(() => {});
  }, [onNotify]);

  const range = useMemo(() => {
    if (mode === 'weekly') return weekRangeIso();
    if (mode === 'custom') return { start: start || null, end: end || null };
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, (m || 1) - 1, 1);
    return { start: monthStartIso(d), end: monthEndIso(d) };
  }, [mode, month, start, end]);

  const loadLedger = useCallback(async () => {
    if (!partyId) {
      setPayload(null);
      setInstallSummary(null);
      setAssignments([]);
      return;
    }
    setLoading(true);
    try {
      const params = {};
      if (range.start) params.start = range.start;
      if (range.end) params.end = range.end;
      if (category.trim()) params.category = category.trim();
      const qs = new URLSearchParams(params).toString();
      const [ledger, summary, installs] = await Promise.all([
        accountsModuleApi.partyLedger(partyId, qs),
        accountsModuleApi.vendorInstallSummary(partyId).catch(() => null),
        accountsModuleApi.vendorInstallations.list({ vendor_id: partyId }).catch(() => []),
      ]);
      setPayload(ledger);
      setInstallSummary(summary);
      setAssignments(Array.isArray(installs) ? installs : []);
    } catch (e) {
      onNotify(e.message || 'Failed to load ledger', 'error');
    } finally {
      setLoading(false);
    }
  }, [partyId, range.start, range.end, category, onNotify]);

  useEffect(() => { loadLedger(); }, [loadLedger, reloadKey]);

  useEffect(() => {
    setDraftOpen(false);
    setEditRow(null);
    setDraftForm(emptyManualForm());
  }, [partyId]);

  const selected = useMemo(
    () => vendors.find((v) => String(v.id) === String(partyId)) || payload?.party || null,
    [vendors, partyId, payload],
  );
  const entries = payload?.results || [];
  const { pageRows: pageEntries, pagination } = usePagedRows(entries, 'vendor-ledger', { resetKey: `${partyId}|${range.start}|${range.end}|${category}|${reloadKey}` });
  const summary = payload?.summary || {};
  const totalDebit = Number(summary.total_debit ?? entries.reduce((s, e) => s + Number(e.debit || 0), 0));
  const totalCredit = Number(summary.total_credit ?? entries.reduce((s, e) => s + Number(e.credit || 0), 0));
  const prevBal = Number(summary.previous_balance ?? 0);
  const netBal = Number(summary.final_balance ?? summary.current_balance ?? (entries.length ? entries[entries.length - 1].balance : 0));

  const openAddManual = () => {
    if (!partyId) { onNotify('Select a vendor first', 'error'); return; }
    setEditRow(null);
    setDraftForm(emptyManualForm());
    setDraftOpen(true);
  };

  const openEditManual = (row) => {
    if (!row?.editable || !row.source_id) return;
    setDraftOpen(false);
    setEditRow(row);
    setDraftForm({
      entry_date: String(row.date || todayIso()).slice(0, 10),
      work: row.work || row.particulars || '',
      debit: row.debit ? String(row.debit) : '',
      credit: row.credit ? String(row.credit) : '',
    });
  };

  const cancelDraft = () => {
    setDraftOpen(false);
    setEditRow(null);
    setDraftForm(emptyManualForm());
  };

  const saveManualEntry = async () => {
    const form = draftForm;
    if (!partyId) { onNotify('Select a vendor first', 'error'); return; }
    if (!form.entry_date) { onNotify('Date is required', 'error'); return; }
    const debit = Number(form.debit || 0);
    const credit = Number(form.credit || 0);
    if (debit <= 0 && credit <= 0) { onNotify('Enter Debit or Credit amount', 'error'); return; }
    if (debit > 0 && credit > 0) { onNotify('Enter either Debit or Credit, not both', 'error'); return; }
    const body = {
      entry_date: form.entry_date,
      work: form.work || '',
      debit: debit > 0 ? debit : 0,
      credit: credit > 0 ? credit : 0,
    };
    setSaving(true);
    try {
      if (editRow?.source_id) {
        await accountsModuleApi.updateVendorManualEntry(partyId, editRow.source_id, body);
        onNotify('Manual entry updated', 'success');
      } else {
        await accountsModuleApi.addVendorManualEntry(partyId, body);
        onNotify('Manual entry saved', 'success');
      }
      cancelDraft();
      setReloadKey((k) => k + 1);
    } catch (e) {
      onNotify(e.message || 'Failed to save manual entry', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteManualEntry = async (row) => {
    if (!row?.editable || !row.source_id) return;
    if (!window.confirm('Delete this manual ledger entry?')) return;
    try {
      await accountsModuleApi.deleteVendorManualEntry(partyId, row.source_id);
      onNotify('Manual entry deleted', 'success');
      setReloadKey((k) => k + 1);
    } catch (e) {
      onNotify(e.message || 'Delete failed', 'error');
    }
  };

  const openAssign = () => {
    if (!partyId) { onNotify('Select a vendor first', 'error'); return; }
    const first = projects[0];
    const kw = Number(first?.capacity_kwp || 3);
    setAssignForm({
      project_id: first ? String(first.id) : '',
      capacity_kw: String(kw),
      rate: '1.90',
      rate_unit: 'per_watt',
      work_description: '',
      start_date: todayIso(),
      expected_completion_date: '',
      advance_payment: '',
      payment_terms: '',
      remarks: '',
    });
    setAssignOpen(true);
  };

  const selectedAssignProject = projects.find((p) => String(p.id) === String(assignForm?.project_id));
  const contractPreview = assignForm
    ? computeContractPreview(assignForm.capacity_kw, assignForm.rate, assignForm.rate_unit)
    : 0;

  const saveAssign = async () => {
    if (!assignForm?.project_id) { onNotify('Select a project', 'error'); return; }
    if (!(Number(assignForm.rate) > 0)) { onNotify('Rate must be greater than zero', 'error'); return; }
    setSavingAction(true);
    try {
      await accountsModuleApi.vendorInstallations.create({
        project_id: Number(assignForm.project_id),
        vendor_id: Number(partyId),
        capacity_kw: Number(assignForm.capacity_kw) || undefined,
        rate: Number(assignForm.rate),
        rate_unit: assignForm.rate_unit,
        work_description: assignForm.work_description || '',
        start_date: assignForm.start_date || null,
        expected_completion_date: assignForm.expected_completion_date || null,
        advance_payment: Number(assignForm.advance_payment || 0),
        payment_terms: assignForm.payment_terms || '',
        remarks: assignForm.remarks || '',
      });
      onNotify('Installation work assigned — task & ledger entry created', 'success');
      setAssignOpen(false);
      setReloadKey((k) => k + 1);
    } catch (e) {
      onNotify(e.message || 'Assignment failed', 'error');
    } finally {
      setSavingAction(false);
    }
  };

  const openPay = (assignment) => {
    setPayForm({
      assignment_id: assignment?.id || (assignments[0]?.id || ''),
      payment_date: todayIso(),
      amount: '',
      payment_mode: 'Cash',
      reference_no: '',
      remarks: '',
      is_advance: false,
    });
    setPayOpen(true);
  };

  const savePay = async () => {
    if (!payForm?.assignment_id) { onNotify('Select a project assignment', 'error'); return; }
    if (!(Number(payForm.amount) > 0)) { onNotify('Payment amount required', 'error'); return; }
    setSavingAction(true);
    try {
      await accountsModuleApi.vendorInstallations.addPayment(payForm.assignment_id, {
        amount: Number(payForm.amount),
        payment_date: payForm.payment_date,
        payment_mode: payForm.payment_mode,
        reference_no: payForm.reference_no || '',
        remarks: payForm.remarks || '',
        is_advance: !!payForm.is_advance,
      });
      onNotify('Payment recorded — Accounts updated', 'success');
      setPayOpen(false);
      setReloadKey((k) => k + 1);
    } catch (e) {
      onNotify(e.message || 'Payment failed', 'error');
    } finally {
      setSavingAction(false);
    }
  };

  const approveStage = async (assignmentId, stageId) => {
    try {
      const updated = await accountsModuleApi.vendorInstallations.approveStage(assignmentId, { stage_id: stageId });
      setStageView(updated);
      setReloadKey((k) => k + 1);
      onNotify('Stage approved — earned amount updated', 'success');
    } catch (e) {
      onNotify(e.message || 'Approval failed', 'error');
    }
  };

  const savePdf = () => {
    if (!entries.length) { onNotify('No ledger entries to save as PDF', 'error'); return; }
    window.print();
  };

  const renderManualInputs = (form) => (
    <>
      <td className="px-2 py-2"><input type="date" className={inputClass} value={form.entry_date} onChange={(e) => setDraftForm((f) => ({ ...f, entry_date: e.target.value }))} /></td>
      <td className="px-2 py-2" colSpan={2}><textarea rows={2} className={`${inputClass} h-auto min-h-[44px] py-2`} placeholder="Work / particulars" value={form.work} onChange={(e) => setDraftForm((f) => ({ ...f, work: e.target.value }))} /></td>
      <td className="px-2 py-2"><input type="number" min="0" step="0.01" className={inputClass} placeholder="0" value={form.debit} onChange={(e) => setDraftForm((f) => ({ ...f, debit: e.target.value, credit: e.target.value ? '' : f.credit }))} /></td>
      <td className="px-2 py-2"><input type="number" min="0" step="0.01" className={inputClass} placeholder="0" value={form.credit} onChange={(e) => setDraftForm((f) => ({ ...f, credit: e.target.value, debit: e.target.value ? '' : f.debit }))} /></td>
      <td className="px-2 py-2">
        <div className="flex gap-1">
          <button type="button" disabled={saving} onClick={saveManualEntry} className="grid size-8 place-items-center rounded-[8px] bg-[#dcfce7] text-[#15803d]" title="Save"><Save className="size-4" /></button>
          <button type="button" disabled={saving} onClick={cancelDraft} className="grid size-8 place-items-center rounded-[8px] bg-[#f1f5f9] text-[#64748b]" title="Cancel"><X className="size-4" /></button>
        </div>
      </td>
    </>
  );

  const installCards = [
    { label: 'Projects Assigned', value: installSummary?.total_projects_assigned ?? assignments.length, money: false },
    { label: 'Capacity (kW)', value: installSummary?.total_capacity_kw ?? 0, money: false },
    { label: 'Contract Amount', value: installSummary?.total_contract_amount ?? 0, money: true },
    { label: 'Earned Amount', value: installSummary?.total_earned_amount ?? 0, money: true, tone: 'green' },
    { label: 'Payments Made', value: installSummary?.total_payments_made ?? 0, money: true, tone: 'red' },
    { label: 'Remaining Payable', value: installSummary?.remaining_earned_payable ?? 0, money: true, tone: 'purple' },
  ];

  const kpiCards = [
    { label: 'Net Previous Balance', value: prevBal, tone: 'bg-[#fffbeb] border-[#fde68a] text-[#b45309]', hint: prevBal > 0 ? 'Payable' : prevBal < 0 ? 'Receivable' : '' },
    { label: 'Total Credit (Work Done)', value: totalCredit, tone: 'bg-[#ecfdf5] border-[#a7f3d0] text-[#047857]' },
    { label: 'Total Debit (Payments)', value: totalDebit, tone: 'bg-[#fef2f2] border-[#fecaca] text-[#dc2626]' },
    { label: 'Net Balance', value: netBal, tone: 'bg-[#f5f3ff] border-[#ddd6fe] text-[#6d28d9]', hint: netBal > 0 ? 'Payable' : netBal < 0 ? 'Receivable' : 'Clear' },
  ];

  return (
    <>
      <div className="grid gap-3 rounded-[14px] border border-[#e2e9f3] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-4 text-[12px] font-bold text-[#53647f]">
          {[
            ['weekly', 'Weekly View'],
            ['monthly', 'Monthly View'],
            ['custom', 'Custom Date Range'],
          ].map(([key, label]) => (
            <label key={key} className="inline-flex items-center gap-2">
              <input type="radio" name="vendor-range" checked={mode === key} onChange={() => setMode(key)} className="accent-[#0b65e5]" />
              {label}
            </label>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Select Vendor *">
            <select className={inputClass} value={partyId} onChange={(e) => setPartyId(e.target.value)}>
              <option value="">-- Choose Vendor --</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}{v.vendor_type ? ` (${v.vendor_type})` : ''}{v.phone ? ` · ${v.phone}` : ''}</option>)}
            </select>
          </Field>
          {mode === 'monthly' ? (
            <Field label="Select Month"><input type="month" className={inputClass} value={month} onChange={(e) => setMonth(e.target.value)} /></Field>
          ) : null}
          {mode === 'custom' ? (
            <>
              <Field label="Start Date"><input type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
              <Field label="End Date"><input type="date" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
            </>
          ) : null}
          <Field label="Search Work">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
              <input className={`${inputClass} pl-9`} placeholder="e.g., Installation" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
          </Field>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button type="button" disabled={!partyId} onClick={openAssign} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] bg-[#0b8f43] px-4 text-[13px] font-extrabold text-white disabled:opacity-50 sm:w-auto">
            <Plus className="size-4" /> Assign Installation Work
          </button>
          <button type="button" disabled={!partyId || !assignments.length} onClick={() => openPay()} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] bg-[#0b65e5] px-4 text-[13px] font-extrabold text-white disabled:opacity-50 sm:w-auto">
            <Wallet className="size-4" /> Add Payment
          </button>
          <button type="button" disabled={!partyId} onClick={openAddManual} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] bg-[#dc2626] px-4 text-[13px] font-extrabold text-white disabled:opacity-50 sm:w-auto">
            <Plus className="size-4" /> Add Manual Entry
          </button>
          <button type="button" disabled={!entries.length} onClick={() => exportNotifyCsv(onNotify, 'vendor-ledger', ['Date', 'Project', 'Work', 'Debit', 'Credit', 'Balance'], entries.map((e) => [e.date, e.project_name, e.work || e.particulars, e.debit, e.credit, e.balance]))} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-extrabold text-[#284276] disabled:opacity-50 sm:w-auto">
            <Download className="size-4" /> Export CSV
          </button>
          <button type="button" disabled={!entries.length} onClick={savePdf} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-extrabold text-[#284276] disabled:opacity-50 sm:w-auto">
            <FileText className="size-4" /> Save PDF
          </button>
          <button type="button" onClick={() => onOpenSection?.('Vendor Overall Credit Ledger')} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] border border-[#ddd6fe] bg-[#f5f3ff] px-4 text-[13px] font-extrabold text-[#6d28d9] sm:w-auto">
            <Layers className="size-4" /> Overall Credit Ledger
          </button>
        </div>
      </div>

      {!partyId ? (
        <div className="rounded-[14px] border border-[#e2e9f3] bg-white p-4 shadow-sm">
          <p className="py-12 text-center text-[13px] font-semibold text-[#7a8fa6]">Please select a vendor to view their installation ledger.</p>
        </div>
      ) : (
        <>
          <div className="rounded-[14px] border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3">
            <div className="grid gap-2 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
              <p><span className="font-bold text-[#64748b]">Vendor:</span> <span className="font-extrabold text-[#1e3261]">{selected?.name || '—'}</span></p>
              <p><span className="font-bold text-[#64748b]">Phone:</span> <span className="font-extrabold text-[#1e3261]">{selected?.phone || '—'}</span></p>
              <p><span className="font-bold text-[#64748b]">Type:</span> <span className="font-extrabold text-[#1e3261]">{selected?.vendor_type || '—'}</span></p>
              <p><span className="font-bold text-[#64748b]">Company:</span> <span className="font-extrabold text-[#1e3261]">{selected?.company || '—'}</span></p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {installCards.map((c) => (
              <article key={c.label} className="rounded-[14px] border border-[#e2e9f3] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-bold text-[#64748b]">{c.label}</p>
                <p className={`mt-2 text-[20px] font-extrabold ${c.tone === 'green' ? 'text-[#047857]' : c.tone === 'red' ? 'text-[#dc2626]' : c.tone === 'purple' ? 'text-[#6d28d9]' : 'text-[#1e3261]'}`}>
                  {c.money ? fmtRs(c.value) : c.value}
                </p>
              </article>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {kpiCards.map(({ label, value, tone, hint }) => (
              <article key={label} className={`rounded-[14px] border p-4 ${tone}`}>
                <p className="text-[11px] font-bold opacity-80">{label}</p>
                <p className="mt-2 text-[22px] font-extrabold tracking-tight">
                  {fmtRs(Math.abs(value))}{hint ? ` (${hint})` : ''}
                </p>
              </article>
            ))}
          </div>

          {assignments.length ? (
            <div className="rounded-[14px] border border-[#e2e9f3] bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-[14px] font-extrabold text-[#111827]">Project-wise Installation</h3>
              <div className="overflow-x-auto">
                <table className="min-w-[980px] w-full text-left text-[13px]">
                  <thead className="bg-[#f1f5f9] text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">
                    <tr>
                      {['Project', 'Customer', 'Capacity', 'Rate', 'Contract', 'Progress', 'Earned', 'Paid', 'Payable', 'Status', 'Actions'].map((h) => (
                        <th key={h} className="px-3 py-2.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((a) => (
                      <tr key={a.id} className="border-t border-[#edf2f8]">
                        <td className="px-3 py-2.5 font-extrabold text-[#1e3261]">{a.project_name || a.project_code}</td>
                        <td className="px-3 py-2.5">{a.customer_name || '—'}</td>
                        <td className="px-3 py-2.5">{a.capacity_kw} kW</td>
                        <td className="px-3 py-2.5">₹{a.rate}/{a.rate_unit === 'per_kw' ? 'kW' : 'W'}</td>
                        <td className="px-3 py-2.5 font-bold">{fmtRs(a.contract_amount)}</td>
                        <td className="px-3 py-2.5"><ProgressRing percent={a.approved_percent} size={56} stroke={6} /></td>
                        <td className="px-3 py-2.5 text-[#047857] font-extrabold">{fmtRs(a.earned_amount)}</td>
                        <td className="px-3 py-2.5 text-[#dc2626] font-extrabold">{fmtRs(a.total_paid)}</td>
                        <td className="px-3 py-2.5 text-[#6d28d9] font-extrabold">{fmtRs(a.remaining_earned_payable)}</td>
                        <td className="px-3 py-2.5"><TypeBadge value={a.status} /></td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1">
                            <button type="button" onClick={() => setStageView(a)} className="grid size-8 place-items-center rounded-[8px] text-[#7c3aed] hover:bg-[#f5f3ff]" title="Stages"><Eye className="size-4" /></button>
                            <button type="button" onClick={() => openPay(a)} className="grid size-8 place-items-center rounded-[8px] text-[#0b65e5] hover:bg-[#eff6ff]" title="Pay"><Wallet className="size-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="rounded-[14px] border border-[#e2e9f3] bg-white p-4 shadow-sm">
            {loading ? (
              <p className="py-10 text-center text-[13px] font-semibold text-[#7a8fa6]">Loading...</p>
            ) : (
              <>
                {(draftOpen || editRow) ? (
                  <div className="mb-4 rounded-[12px] border border-[#fecaca] bg-[#fff7f7] p-3 lg:hidden">
                    <p className="mb-2 text-[12px] font-extrabold text-[#b91c1c]">{editRow ? 'Edit Manual Entry' : 'Add Manual Entry'}</p>
                    <div className="grid gap-2">
                      <Field label="Date"><input type="date" className={inputClass} value={draftForm.entry_date} onChange={(e) => setDraftForm((f) => ({ ...f, entry_date: e.target.value }))} /></Field>
                      <Field label="Work"><textarea className={`${inputClass} h-20 py-2`} value={draftForm.work} onChange={(e) => setDraftForm((f) => ({ ...f, work: e.target.value }))} /></Field>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Debit"><input type="number" min="0" step="0.01" className={inputClass} value={draftForm.debit} onChange={(e) => setDraftForm((f) => ({ ...f, debit: e.target.value, credit: e.target.value ? '' : f.credit }))} /></Field>
                        <Field label="Credit"><input type="number" min="0" step="0.01" className={inputClass} value={draftForm.credit} onChange={(e) => setDraftForm((f) => ({ ...f, credit: e.target.value, debit: e.target.value ? '' : f.debit }))} /></Field>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" disabled={saving} onClick={saveManualEntry} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-[#dc2626] px-3 text-[13px] font-extrabold text-white disabled:opacity-60">
                          <Save className="size-4" />{saving ? 'Saving...' : 'Save'}
                        </button>
                        <button type="button" disabled={saving} onClick={cancelDraft} className="h-10 rounded-[8px] border px-4 text-[13px] font-semibold">Cancel</button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <LedgerMobileCards
                  entries={pageEntries}
                  emptyText="No entries found for the selected filters."
                  totalDebit={totalDebit}
                  totalCredit={totalCredit}
                  finalBalance={netBal}
                  onOpen={setDetail}
                  TypeBadge={TypeBadge}
                  fmtDate={fmtDisplayDate}
                  fmtMoney={fmtRs}
                />
                <div className="hidden overflow-x-auto lg:block">
                  <table className="min-w-[900px] w-full text-left text-[13px]">
                    <thead className="bg-[#f1f5f9] text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">
                      <tr>
                        {['Date', 'Project', 'Work / Particulars', 'Debit', 'Credit', 'Actions'].map((h) => (
                          <th key={h} className="px-3 py-2.5">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {draftOpen ? (
                        <tr className="border-t border-[#fecaca] bg-[#fff7f7]">{renderManualInputs(draftForm)}</tr>
                      ) : null}
                      {entries.length === 0 && !draftOpen ? (
                        <tr><td colSpan={6} className="px-3 py-10 text-center text-[#7a8fa6]">No entries found for the selected filters.</td></tr>
                      ) : pageEntries.map((e, i) => {
                        if (editRow && String(editRow.source_id) === String(e.source_id) && e.source === 'manual') {
                          return (
                            <tr key={`edit-${e.source_id}`} className="border-t border-[#fed7aa] bg-[#fff7ed]">
                              {renderManualInputs(draftForm)}
                            </tr>
                          );
                        }
                        return (
                          <tr key={`${e.ref}-${i}`} className={`border-t border-[#edf2f8] ${i % 2 ? 'bg-[#f8fafc]' : 'bg-white'}`}>
                            <td className="whitespace-nowrap px-3 py-2.5">{fmtDisplayDate(e.date)}</td>
                            <td className="px-3 py-2.5 font-semibold text-[#1e3261]">{e.project_name || '—'}</td>
                            <td className="max-w-[320px] px-3 py-2.5" title={e.work || e.particulars || ''}>
                              <div className="line-clamp-3 whitespace-pre-wrap">{e.work || e.particulars || '—'}</div>
                              {e.type_label ? <div className="mt-1"><TypeBadge value={e.type_label || e.type} /></div> : null}
                            </td>
                            <td className="px-3 py-2.5 font-extrabold text-[#dc2626]">{e.debit ? fmtRs(e.debit) : '—'}</td>
                            <td className="px-3 py-2.5 font-extrabold text-[#16a34a]">{e.credit ? fmtRs(e.credit) : '—'}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex gap-1">
                                <button type="button" onClick={() => setDetail(e)} className="grid size-8 place-items-center rounded-[8px] text-[#7c3aed] hover:bg-[#f5f3ff]" title="View"><Eye className="size-4" /></button>
                                {e.editable ? (
                                  <>
                                    <button type="button" onClick={() => openEditManual(e)} className="grid size-8 place-items-center rounded-[8px] text-[#0b65e5] hover:bg-[#eff6ff]" title="Edit"><Pencil className="size-4" /></button>
                                    <button type="button" onClick={() => deleteManualEntry(e)} className="grid size-8 place-items-center rounded-[8px] text-[#dc2626] hover:bg-[#fef2f2]" title="Delete"><Trash2 className="size-4" /></button>
                                  </>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {entries.length ? (
                      <tfoot>
                        <tr className="border-t-2 border-[#cbd5e1] bg-[#f8fafc] font-extrabold">
                          <td className="px-3 py-3" colSpan={3}>Totals:</td>
                          <td className="px-3 py-3 text-[#dc2626]">{fmtRs(totalDebit)}</td>
                          <td className="px-3 py-3 text-[#16a34a]">{fmtRs(totalCredit)}</td>
                          <td className={`px-3 py-3 ${netBal > 0 ? 'text-[#dc2626]' : 'text-[#166534]'}`}>{fmtRs(Math.abs(netBal))} {netBal > 0 ? 'Payable' : netBal < 0 ? 'Receivable' : ''}</td>
                        </tr>
                      </tfoot>
                    ) : null}
                  </table>
                </div>
                <TablePagination {...pagination} className="mt-3" />
              </>
            )}
          </div>
        </>
      )}

      {detail ? (
        <ModalShell title="Ledger Entry" onClose={() => setDetail(null)} footer={<button type="button" onClick={() => setDetail(null)} className="h-10 rounded-[8px] border px-4 text-[13px] font-semibold">Close</button>}>
          <div className="grid gap-2 text-[13px]">
            <p><span className="font-bold text-[#64748b]">Date:</span> {fmtDisplayDate(detail.date)}</p>
            <p><span className="font-bold text-[#64748b]">Type:</span> <TypeBadge value={detail.type_label || detail.type} /></p>
            <p><span className="font-bold text-[#64748b]">Ref:</span> {detail.ref || '—'}</p>
            <p><span className="font-bold text-[#64748b]">Project:</span> {detail.project_name || '—'}</p>
            <p><span className="font-bold text-[#64748b]">Work:</span> {detail.work || detail.particulars || '—'}</p>
            <p><span className="font-bold text-[#64748b]">Debit:</span> {detail.debit ? fmtRs(detail.debit) : '—'}</p>
            <p><span className="font-bold text-[#64748b]">Credit:</span> {detail.credit ? fmtRs(detail.credit) : '—'}</p>
            <p><span className="font-bold text-[#64748b]">Balance:</span> {fmtRs(detail.balance)}</p>
          </div>
        </ModalShell>
      ) : null}

      {assignOpen && assignForm ? (
        <ModalShell
          title="Assign Installation Work"
          wide
          onClose={() => !savingAction && setAssignOpen(false)}
          footer={(
            <>
              <button type="button" disabled={savingAction} onClick={() => setAssignOpen(false)} className="h-10 rounded-[8px] border px-4 text-[13px] font-semibold">Cancel</button>
              <button type="button" disabled={savingAction} onClick={saveAssign} className="h-10 rounded-[8px] bg-[#0b8f43] px-4 text-[13px] font-extrabold text-white disabled:opacity-60">
                {savingAction ? 'Assigning...' : 'Assign Work'}
              </button>
            </>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Project" required>
              <select
                className={inputClass}
                value={assignForm.project_id}
                onChange={(e) => {
                  const p = projects.find((x) => String(x.id) === e.target.value);
                  setAssignForm((f) => ({
                    ...f,
                    project_id: e.target.value,
                    capacity_kw: String(p?.capacity_kwp || f.capacity_kw),
                  }));
                }}
              >
                <option value="">-- Select Project --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.project_name || p.project_id} ({p.capacity_kwp || 0} kW)</option>
                ))}
              </select>
            </Field>
            <Field label="Customer"><input className={inputClass} disabled value={selectedAssignProject?.customer_name || '—'} /></Field>
            <Field label="Project Capacity (kW)" required>
              <input type="number" step="0.001" className={inputClass} value={assignForm.capacity_kw} onChange={(e) => setAssignForm((f) => ({ ...f, capacity_kw: e.target.value }))} />
            </Field>
            <Field label="Capacity (Watt)">
              <input className={inputClass} disabled value={((Number(assignForm.capacity_kw) || 0) * 1000).toLocaleString('en-IN')} />
            </Field>
            <Field label="Installation Rate" required>
              <input type="number" step="0.0001" className={inputClass} value={assignForm.rate} onChange={(e) => setAssignForm((f) => ({ ...f, rate: e.target.value }))} />
            </Field>
            <Field label="Rate Unit" required>
              <select className={inputClass} value={assignForm.rate_unit} onChange={(e) => setAssignForm((f) => ({ ...f, rate_unit: e.target.value }))}>
                <option value="per_watt">₹/Watt</option>
                <option value="per_kw">₹/kW</option>
              </select>
            </Field>
            <Field label="Total Contract Amount (auto)">
              <input className={`${inputClass} font-extrabold text-[#0b8f43]`} disabled value={fmtRs(contractPreview)} />
            </Field>
            <Field label="Advance Payment (optional)">
              <input type="number" step="0.01" className={inputClass} value={assignForm.advance_payment} onChange={(e) => setAssignForm((f) => ({ ...f, advance_payment: e.target.value }))} />
            </Field>
            <Field label="Work Start Date"><input type="date" className={inputClass} value={assignForm.start_date} onChange={(e) => setAssignForm((f) => ({ ...f, start_date: e.target.value }))} /></Field>
            <Field label="Expected Completion"><input type="date" className={inputClass} value={assignForm.expected_completion_date} onChange={(e) => setAssignForm((f) => ({ ...f, expected_completion_date: e.target.value }))} /></Field>
            <div className="sm:col-span-2"><Field label="Work Description"><textarea className={`${inputClass} h-20 py-2`} value={assignForm.work_description} onChange={(e) => setAssignForm((f) => ({ ...f, work_description: e.target.value }))} /></Field></div>
            <Field label="Payment Terms"><input className={inputClass} value={assignForm.payment_terms} onChange={(e) => setAssignForm((f) => ({ ...f, payment_terms: e.target.value }))} /></Field>
            <Field label="Remarks"><input className={inputClass} value={assignForm.remarks} onChange={(e) => setAssignForm((f) => ({ ...f, remarks: e.target.value }))} /></Field>
          </div>
        </ModalShell>
      ) : null}

      {payOpen && payForm ? (
        <ModalShell
          title="Add Vendor Payment"
          onClose={() => !savingAction && setPayOpen(false)}
          footer={(
            <>
              <button type="button" disabled={savingAction} onClick={() => setPayOpen(false)} className="h-10 rounded-[8px] border px-4 text-[13px] font-semibold">Cancel</button>
              <button type="button" disabled={savingAction} onClick={savePay} className="h-10 rounded-[8px] bg-[#0b65e5] px-4 text-[13px] font-extrabold text-white disabled:opacity-60">
                {savingAction ? 'Saving...' : 'Save Payment'}
              </button>
            </>
          )}
        >
          <div className="grid gap-3">
            <Field label="Vendor"><input className={inputClass} disabled value={selected?.name || ''} /></Field>
            <Field label="Project Assignment" required>
              <select className={inputClass} value={payForm.assignment_id} onChange={(e) => setPayForm((f) => ({ ...f, assignment_id: e.target.value }))}>
                <option value="">-- Select --</option>
                {assignments.map((a) => (
                  <option key={a.id} value={a.id}>{a.project_name} · Contract {fmtRs(a.contract_amount)}</option>
                ))}
              </select>
            </Field>
            <Field label="Payment Date" required><input type="date" className={inputClass} value={payForm.payment_date} onChange={(e) => setPayForm((f) => ({ ...f, payment_date: e.target.value }))} /></Field>
            <Field label="Amount (₹)" required><input type="number" step="0.01" className={inputClass} value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} /></Field>
            <Field label="Payment Mode">
              <select className={inputClass} value={payForm.payment_mode} onChange={(e) => setPayForm((f) => ({ ...f, payment_mode: e.target.value }))}>
                {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Transaction / Reference"><input className={inputClass} value={payForm.reference_no} onChange={(e) => setPayForm((f) => ({ ...f, reference_no: e.target.value }))} /></Field>
            <Field label="Remarks"><textarea className={`${inputClass} h-20 py-2`} value={payForm.remarks} onChange={(e) => setPayForm((f) => ({ ...f, remarks: e.target.value }))} /></Field>
            <label className="inline-flex items-center gap-2 text-[12px] font-bold text-[#53647f]">
              <input type="checkbox" checked={!!payForm.is_advance} onChange={(e) => setPayForm((f) => ({ ...f, is_advance: e.target.checked }))} />
              Mark as Advance Payment
            </label>
          </div>
        </ModalShell>
      ) : null}

      {stageView ? (
        <ModalShell
          title={`Stages — ${stageView.project_name || 'Installation'}`}
          wide
          onClose={() => setStageView(null)}
          footer={<button type="button" onClick={() => setStageView(null)} className="h-10 rounded-[8px] border px-4 text-[13px] font-semibold">Close</button>}
        >
          <div className="mb-4 flex flex-wrap items-center gap-6">
            <ProgressRing percent={stageView.approved_percent} size={96} stroke={9} label="Completed" />
            <div className="grid gap-1 text-[13px]">
              <p><span className="font-bold text-[#64748b]">Contract:</span> <span className="font-extrabold">{fmtRs(stageView.contract_amount)}</span></p>
              <p><span className="font-bold text-[#64748b]">Earned:</span> <span className="font-extrabold text-[#047857]">{fmtRs(stageView.earned_amount)}</span></p>
              <p><span className="font-bold text-[#64748b]">Paid:</span> <span className="font-extrabold text-[#dc2626]">{fmtRs(stageView.total_paid)}</span></p>
              <p><span className="font-bold text-[#64748b]">Remaining Payable:</span> <span className="font-extrabold text-[#6d28d9]">{fmtRs(stageView.remaining_earned_payable)}</span></p>
              <p className="text-[12px] font-semibold text-[#7386a3]">{stageView.completed_stages}/{stageView.total_stages} stages approved · {stageView.pending_percent}% remaining</p>
            </div>
          </div>
          <div className="space-y-2">
            {(stageView.stages || []).map((s) => (
              <div key={s.id} className="rounded-[10px] border border-[#e7eef7] bg-[#f8fbff] px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-extrabold text-[#1e3261]">{s.stage_name}</p>
                    <p className="text-[11px] font-semibold text-[#8a98af]">Weight {s.allocated_percent}% · {s.status}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-[#e2e8f0]">
                      <div className={`h-full ${s.status === 'Approved' ? 'bg-[#16a34a]' : 'bg-[#94a3b8]'}`} style={{ width: s.status === 'Approved' ? '100%' : '0%' }} />
                    </div>
                    {s.status !== 'Approved' ? (
                      <button type="button" onClick={() => approveStage(stageView.id, s.id)} className="h-8 rounded-[8px] bg-[#0b8f43] px-3 text-[11px] font-extrabold text-white">Approve</button>
                    ) : (
                      <span className="text-[11px] font-extrabold text-[#16a34a]">Approved</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}

function VendorOverallCreditTab({ onNotify, onOpenSection }) {
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await accountsModuleApi.vendorCreditLedger());
    } catch (e) {
      onNotify(e.message || 'Failed to load credit ledger', 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => { load(); }, [load]);

  const rows = (data?.rows || []).filter((r) => {
    const hay = `${r.name} ${r.phone} ${r.company} ${r.vendor_type}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });
  const { pageRows, pagination } = usePagedRows(rows, 'vendor-credit', { resetKey: q });
  const totals = data?.totals || {};

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-[18px] font-extrabold text-[#0f172a]">Overall Credit Ledger</h2>
          <p className="mt-1 text-[13px] font-semibold text-[#53647f]">Vendor-wise work credit, payments, install payable &amp; net balance.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={load} className="inline-flex h-10 items-center gap-1.5 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-extrabold text-[#284276]">Refresh</button>
          <button
            type="button"
            onClick={() => exportNotifyCsv(onNotify, 'vendor-credit-ledger', ['Name', 'Phone', 'Type', 'Debit', 'Credit', 'Net', 'Install Payable', 'Projects'], rows.map((r) => [r.name, r.phone, r.vendor_type, r.debit, r.credit, r.net, r.install_payable, r.install_projects]))}
            className="inline-flex h-10 items-center gap-1.5 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-extrabold text-[#284276]"
          >
            <Download className="size-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total Credit', value: totals.credit, tone: 'text-[#047857]' },
          { label: 'Total Debit', value: totals.debit, tone: 'text-[#dc2626]' },
          { label: 'Net', value: totals.net, tone: 'text-[#6d28d9]' },
          { label: 'Install Payable', value: totals.install_payable, tone: 'text-[#b45309]' },
        ].map((c) => (
          <article key={c.label} className="rounded-[14px] border border-[#e2e9f3] bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold text-[#64748b]">{c.label}</p>
            <p className={`mt-2 text-[20px] font-extrabold ${c.tone}`}>{fmtRs(c.value)}</p>
          </article>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
        <input className={`${inputClass} pl-9`} placeholder="Search vendor, phone, type..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? (
        <p className="py-10 text-center text-[13px] font-semibold text-[#7a8fa6]">Loading...</p>
      ) : rows.length === 0 ? (
        <MobileCardEmpty title="No vendor balances yet." />
      ) : (
        <>
          <MobileCardList className="lg:hidden">
            {pageRows.map((r) => (
              <MobileRecordCard
                key={r.id}
                avatar={r.name}
                title={r.name}
                subtitle={[r.phone, r.vendor_type].filter(Boolean).join(' · ')}
                aside={<span className={Number(r.net) > 0 ? 'text-[#dc2626]' : 'text-[#16a34a]'}>{fmtRs(r.net)}</span>}
                details={[
                  { label: 'Credit', value: fmtRs(r.credit) },
                  { label: 'Debit', value: fmtRs(r.debit) },
                  { label: 'Install Payable', value: fmtRs(r.install_payable) },
                  { label: 'Projects', value: r.install_projects },
                ]}
                actions={[
                  { label: 'Open Ledger', icon: Receipt, tone: 'blue', onClick: () => onOpenSection?.('Vendor Ledger') },
                ]}
              />
            ))}
          </MobileCardList>
          <div className="hidden overflow-x-auto rounded-[12px] border border-[#e2e9f3] bg-white lg:block">
            <table className="min-w-[960px] w-full text-left text-[13px]">
              <thead className="bg-[#f8fbff] text-[11px] font-extrabold uppercase tracking-wide text-[#7a8fa6]">
                <tr>
                  {['Vendor', 'Phone', 'Type', 'Projects', 'Contract', 'Earned', 'Paid', 'Install Payable', 'Debit', 'Credit', 'Net', 'Status'].map((h) => (
                    <th key={h} className="px-3 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.id} className="border-t border-[#edf2f8]">
                    <td className="px-3 py-2.5 font-extrabold text-[#1e3261]">{r.name}</td>
                    <td className="px-3 py-2.5">{r.phone || '—'}</td>
                    <td className="px-3 py-2.5">{r.vendor_type || '—'}</td>
                    <td className="px-3 py-2.5">{r.install_projects}</td>
                    <td className="px-3 py-2.5">{fmtRs(r.install_contract)}</td>
                    <td className="px-3 py-2.5 text-[#047857] font-bold">{fmtRs(r.install_earned)}</td>
                    <td className="px-3 py-2.5 text-[#dc2626] font-bold">{fmtRs(r.install_paid)}</td>
                    <td className="px-3 py-2.5 text-[#6d28d9] font-extrabold">{fmtRs(r.install_payable)}</td>
                    <td className="px-3 py-2.5 text-[#dc2626]">{fmtRs(r.debit)}</td>
                    <td className="px-3 py-2.5 text-[#16a34a]">{fmtRs(r.credit)}</td>
                    <td className="px-3 py-2.5 font-extrabold">{fmtRs(r.net)}</td>
                    <td className="px-3 py-2.5"><BalanceBadge balance={r.net} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination {...pagination} />
        </>
      )}
    </div>
  );
}

/** Reusable assign modal for Project Installation screen */
export function AssignVendorInstallationModal({ project, onClose, onNotify, onAssigned }) {
  const [vendors, setVendors] = useState([]);
  const [saving, setSaving] = useState(false);
  const kw = Number(project?.capacity_kwp || 0);
  const [form, setForm] = useState({
    vendor_id: '',
    capacity_kw: String(kw || ''),
    rate: '1.90',
    rate_unit: 'per_watt',
    work_description: '',
    start_date: todayIso(),
    expected_completion_date: '',
    advance_payment: '',
    payment_terms: '',
    remarks: '',
  });

  useEffect(() => {
    accountsModuleApi.parties.list({ account_type: 'Vendor', page_size: 200 })
      .then((d) => setVendors(normalizeApiRows(d)))
      .catch(() => {});
  }, []);

  const contract = computeContractPreview(form.capacity_kw, form.rate, form.rate_unit);

  const save = async () => {
    if (!form.vendor_id) { onNotify('Select a vendor', 'error'); return; }
    if (!(Number(form.rate) > 0)) { onNotify('Rate required', 'error'); return; }
    setSaving(true);
    try {
      const assignment = await accountsModuleApi.vendorInstallations.create({
        project_id: project.id,
        vendor_id: Number(form.vendor_id),
        capacity_kw: Number(form.capacity_kw) || undefined,
        rate: Number(form.rate),
        rate_unit: form.rate_unit,
        work_description: form.work_description || '',
        start_date: form.start_date || null,
        expected_completion_date: form.expected_completion_date || null,
        advance_payment: Number(form.advance_payment || 0),
        payment_terms: form.payment_terms || '',
        remarks: form.remarks || '',
      });
      onNotify('Vendor installation assigned — Daily Task & Ledger created', 'success');
      onAssigned?.(assignment);
      onClose?.();
    } catch (e) {
      onNotify(e.message || 'Assignment failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title="Assign Installation Vendor"
      wide
      onClose={() => !saving && onClose?.()}
      footer={(
        <>
          <button type="button" disabled={saving} onClick={onClose} className="h-10 rounded-[8px] border px-4 text-[13px] font-semibold">Cancel</button>
          <button type="button" disabled={saving} onClick={save} className="h-10 rounded-[8px] bg-[#0b8f43] px-4 text-[13px] font-extrabold text-white disabled:opacity-60">
            {saving ? 'Assigning...' : 'Assign Vendor'}
          </button>
        </>
      )}
    >
      <div className="mb-3 rounded-[10px] border border-[#dcfce7] bg-[#f0fdf4] px-3 py-2 text-[12px] font-semibold text-[#166534]">
        {project?.project_name || project?.project_id} · {project?.customer_name || '—'} · {kw} kW · ID {project?.project_id}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Vendor" required>
          <select className={inputClass} value={form.vendor_id} onChange={(e) => setForm((f) => ({ ...f, vendor_id: e.target.value }))}>
            <option value="">-- Select Vendor --</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}{v.phone ? ` · ${v.phone}` : ''}</option>)}
          </select>
        </Field>
        <Field label="Capacity (kW)"><input type="number" step="0.001" className={inputClass} value={form.capacity_kw} onChange={(e) => setForm((f) => ({ ...f, capacity_kw: e.target.value }))} /></Field>
        <Field label="Rate" required><input type="number" step="0.0001" className={inputClass} value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} /></Field>
        <Field label="Rate Unit">
          <select className={inputClass} value={form.rate_unit} onChange={(e) => setForm((f) => ({ ...f, rate_unit: e.target.value }))}>
            <option value="per_watt">₹/Watt</option>
            <option value="per_kw">₹/kW</option>
          </select>
        </Field>
        <Field label="Contract Amount (auto)"><input className={`${inputClass} font-extrabold text-[#0b8f43]`} disabled value={fmtRs(contract)} /></Field>
        <Field label="Advance (optional)"><input type="number" step="0.01" className={inputClass} value={form.advance_payment} onChange={(e) => setForm((f) => ({ ...f, advance_payment: e.target.value }))} /></Field>
        <Field label="Start Date"><input type="date" className={inputClass} value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} /></Field>
        <Field label="Expected Completion"><input type="date" className={inputClass} value={form.expected_completion_date} onChange={(e) => setForm((f) => ({ ...f, expected_completion_date: e.target.value }))} /></Field>
        <div className="sm:col-span-2"><Field label="Work Description"><textarea className={`${inputClass} h-20 py-2`} value={form.work_description} onChange={(e) => setForm((f) => ({ ...f, work_description: e.target.value }))} /></Field></div>
      </div>
    </ModalShell>
  );
}
