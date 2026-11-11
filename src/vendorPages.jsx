import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, Eye, FileText, Pencil, Phone, Plus, Receipt, Save, Search, Trash2, X } from 'lucide-react';
import { accountsModuleApi } from './api.js';
import { exportNotifyCsv, normalizeApiRows } from './lib/utils.js';
import { moduleCaps } from './settingsHubPages.jsx';
import { MobileCardEmpty, MobileCardList, MobileRecordCard } from './components/mobile/MobileRecordCard.jsx';
import { LedgerMobileCards } from './components/mobile/LedgerMobileCards.jsx';
import { MobileSubnavSelect } from './components/mobile/MobileSubnavSelect.jsx';
import { TablePagination, usePagedRows } from './components/TablePagination.jsx';

const TABS = [
  { key: 'Vendor Details', label: 'Vendor Details' },
  { key: 'Vendor Ledger', label: 'Vendor Ledger' },
];

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
  if (Math.abs(n) < 0.01) {
    return <span className="text-[11px] font-bold text-[#64748b]">Clear</span>;
  }
  return <span className="text-[11px] font-bold text-[#dc2626]">Payable</span>;
}

function TypeBadge({ value }) {
  const key = String(value || '').toLowerCase();
  const tone = {
    service: 'bg-[#ede9fe] text-[#6d28d9]',
    payment: 'bg-[#dcfce7] text-[#166534]',
    receipt: 'bg-[#dbeafe] text-[#1d4ed8]',
    opening: 'bg-[#f1f5f9] text-[#475569]',
    purchase: 'bg-[#ede9fe] text-[#6d28d9]',
    manual: 'bg-[#ffedd5] text-[#c2410c]',
  }[key] || 'bg-[#f1f5f9] text-[#475569]';
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${tone}`}>{key || '—'}</span>;
}

function ModalShell({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#0f172a]/55 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex max-h-[96vh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[16px] bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-[16px]">
        <div className="flex items-center justify-between border-b border-[#edf2f8] px-5 py-3">
          <h3 className="text-[16px] font-extrabold text-[#111827]">{title}</h3>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full text-[#7585a2] hover:bg-[#f4f7fb]"><X className="size-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-[#edf2f8] px-5 py-3">{footer}</div> : null}
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
      const data = await accountsModuleApi.parties.list({ account_type: 'Vendor', page_size: 25 });
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
        {caps.export ? (<button
          type="button"
          onClick={() => exportNotifyCsv(onNotify, 'vendors', ['Name', 'Phone', 'Company', 'Type', 'Net Balance'], filtered.map((r) => [r.name, r.phone, r.company, r.vendor_type, r.balance]))}
          className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-extrabold text-[#284276] sm:w-auto"
        >
          <Download className="size-4" /> Export CSV
        </button>) : null}
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
            <Field label="Vendor Type"><input className={inputClass} placeholder="e.g., Parts Dealer, Painting Specialist" value={modal.form.vendor_type || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, vendor_type: e.target.value } }))} /></Field>
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
    vehicle_no: '',
    wheeler: '',
    owner_name: '',
    work: '',
    debit: '',
    credit: '',
  };
}

function VendorLedgerTab({ onNotify, onOpenSection }) {
  const [vendors, setVendors] = useState([]);
  const [partyId, setPartyId] = useState('');
  const [mode, setMode] = useState('monthly');
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [category, setCategory] = useState('');
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftForm, setDraftForm] = useState(emptyManualForm());
  const [editRow, setEditRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [voucherForm, setVoucherForm] = useState({
    voucher_date: todayIso(),
    amount: '',
    category: '',
    particulars: '',
    payment_mode: 'Cash',
    status: 'Completed',
  });
  const [savingVoucher, setSavingVoucher] = useState(false);

  useEffect(() => {
    accountsModuleApi.parties.list({ account_type: 'Vendor', page_size: 200 })
      .then((data) => setVendors(normalizeApiRows(data)))
      .catch((e) => onNotify(e.message || 'Failed to load vendors', 'error'));
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
      return;
    }
    setLoading(true);
    try {
      const params = {};
      if (range.start) params.start = range.start;
      if (range.end) params.end = range.end;
      if (category.trim()) params.category = category.trim();
      const qs = new URLSearchParams(params).toString();
      setPayload(await accountsModuleApi.partyLedger(partyId, qs));
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
    setVoucherOpen(false);
  }, [partyId]);

  const selected = useMemo(
    () => vendors.find((v) => String(v.id) === String(partyId)) || payload?.party || null,
    [vendors, partyId, payload],
  );
  const entries = payload?.results || [];
  const vouchers = payload?.vouchers || [];
  const { pageRows: pageEntries, pagination } = usePagedRows(entries, 'vendor-ledger', { resetKey: `${partyId}|${range.start}|${range.end}|${category}|${reloadKey}` });
  const summary = payload?.summary || {};
  const voucherCount = Number(summary.voucher_count ?? payload?.totals?.voucher_count ?? vouchers.length ?? 0);
  const totalDebit = Number(summary.total_debit ?? entries.reduce((s, e) => s + Number(e.debit || 0), 0));
  const totalCredit = Number(summary.total_credit ?? entries.reduce((s, e) => s + Number(e.credit || 0), 0));
  const prevBal = Number(summary.previous_balance ?? 0);
  const netBal = Number(summary.final_balance ?? summary.current_balance ?? (entries.length ? entries[entries.length - 1].balance : 0));

  const openAddManual = () => {
    if (!partyId) {
      onNotify('Select a vendor first', 'error');
      return;
    }
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
      vehicle_no: row.vehicle_no || '',
      wheeler: row.wheeler || '',
      owner_name: row.owner_name || '',
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
    if (!partyId) {
      onNotify('Select a vendor first', 'error');
      return;
    }
    if (!form.entry_date) {
      onNotify('Date is required', 'error');
      return;
    }
    const debit = Number(form.debit || 0);
    const credit = Number(form.credit || 0);
    if (debit <= 0 && credit <= 0) {
      onNotify('Enter Debit or Credit amount', 'error');
      return;
    }
    if (debit > 0 && credit > 0) {
      onNotify('Enter either Debit or Credit, not both', 'error');
      return;
    }
    const body = {
      entry_date: form.entry_date,
      vehicle_no: form.vehicle_no || '',
      wheeler: form.wheeler || '',
      owner_name: form.owner_name || '',
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

  const saveVendorVoucher = async () => {
    const amount = Number(voucherForm.amount || 0);
    if (!partyId || !selected?.name) {
      onNotify('Select a vendor first', 'error');
      return;
    }
    if (!(amount > 0)) {
      onNotify('Voucher amount must be greater than zero', 'error');
      return;
    }
    if (!voucherForm.voucher_date) {
      onNotify('Voucher date is required', 'error');
      return;
    }
    setSavingVoucher(true);
    try {
      await accountsModuleApi.vouchers.create({
        voucher_date: voucherForm.voucher_date,
        entry_type: 'Voucher',
        payee_type: 'Vendor',
        payee_name: selected.name,
        category: voucherForm.category || selected.vendor_type || 'Vendor',
        particulars: voucherForm.particulars || `Service — ${selected.name}`,
        payment_mode: voucherForm.payment_mode || 'Cash',
        amount,
        status: voucherForm.status || 'Completed',
      });
      onNotify('Vendor voucher created', 'success');
      setVoucherForm({
        voucher_date: todayIso(),
        amount: '',
        category: selected.vendor_type || '',
        particulars: '',
        payment_mode: 'Cash',
        status: 'Completed',
      });
      setReloadKey((k) => k + 1);
    } catch (e) {
      onNotify(e.message || 'Failed to create voucher', 'error');
    } finally {
      setSavingVoucher(false);
    }
  };

  const savePdf = () => {
    if (!entries.length) {
      onNotify('No ledger entries to save as PDF', 'error');
      return;
    }
    window.print();
  };

  const renderManualInputs = (form, setForm, { compact = false } = {}) => (
    <>
      <td className="px-2 py-2"><input type="date" className={inputClass} value={form.entry_date} onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))} /></td>
      <td className="px-2 py-2"><input className={`${inputClass} border-[#fca5a5]`} placeholder="Vehicle No" value={form.vehicle_no} onChange={(e) => setForm((f) => ({ ...f, vehicle_no: e.target.value }))} /></td>
      <td className="px-2 py-2"><input className={inputClass} placeholder="Wheeler" value={form.wheeler} onChange={(e) => setForm((f) => ({ ...f, wheeler: e.target.value }))} /></td>
      <td className="px-2 py-2"><input className={inputClass} placeholder="Owner Name" value={form.owner_name} onChange={(e) => setForm((f) => ({ ...f, owner_name: e.target.value }))} /></td>
      <td className="px-2 py-2"><textarea rows={compact ? 2 : 3} className={`${inputClass} h-auto min-h-[44px] py-2`} placeholder="Work details" value={form.work} onChange={(e) => setForm((f) => ({ ...f, work: e.target.value }))} /></td>
      <td className="px-2 py-2"><input type="number" min="0" step="0.01" className={inputClass} placeholder="0" value={form.debit} onChange={(e) => setForm((f) => ({ ...f, debit: e.target.value, credit: e.target.value ? '' : f.credit }))} /></td>
      <td className="px-2 py-2"><input type="number" min="0" step="0.01" className={inputClass} placeholder="0" value={form.credit} onChange={(e) => setForm((f) => ({ ...f, credit: e.target.value, debit: e.target.value ? '' : f.debit }))} /></td>
      <td className="px-2 py-2">
        <div className="flex gap-1">
          <button type="button" disabled={saving} onClick={saveManualEntry} className="grid size-8 place-items-center rounded-[8px] bg-[#dcfce7] text-[#15803d] hover:bg-[#bbf7d0]" title="Save">
            <Save className="size-4" />
          </button>
          <button type="button" disabled={saving} onClick={cancelDraft} className="grid size-8 place-items-center rounded-[8px] bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]" title="Cancel">
            <X className="size-4" />
          </button>
        </div>
      </td>
    </>
  );

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
          <Field label="Search Category">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
              <input className={`${inputClass} pl-9`} placeholder="e.g., Painter" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
          </Field>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button type="button" disabled={!partyId} onClick={openAddManual} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] bg-[#dc2626] px-4 text-[13px] font-extrabold text-white disabled:opacity-50 sm:w-auto">
            <Plus className="size-4" /> Add Manual Entry
          </button>
          <button
            type="button"
            disabled={!partyId}
            onClick={() => {
              setVoucherForm((f) => ({ ...f, category: selected?.vendor_type || f.category || '' }));
              setVoucherOpen(true);
            }}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] bg-[#7c3aed] px-4 text-[13px] font-extrabold text-white disabled:opacity-50 sm:w-auto"
          >
            <Receipt className="size-4" /> Voucher ({voucherCount})
          </button>
          <button type="button" disabled={!entries.length} onClick={() => exportNotifyCsv(onNotify, 'vendor-ledger', ['Date', 'Vehicle No', 'Wheeler', 'Owner Name', 'Work', 'Debit', 'Credit', 'Balance'], entries.map((e) => [e.date, e.vehicle_no, e.wheeler, e.owner_name, e.work || e.particulars, e.debit, e.credit, e.balance]))} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-extrabold text-[#284276] disabled:opacity-50 sm:w-auto">
            <Download className="size-4" /> Export CSV
          </button>
          <button type="button" disabled={!entries.length} onClick={savePdf} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-extrabold text-[#284276] disabled:opacity-50 sm:w-auto">
            <FileText className="size-4" /> Save PDF
          </button>
        </div>
      </div>

      {!partyId ? (
        <div className="rounded-[14px] border border-[#e2e9f3] bg-white p-4 shadow-sm">
          <p className="py-12 text-center text-[13px] font-semibold text-[#7a8fa6]">Please select a vendor to view their ledger entries.</p>
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
                      <Field label="Vehicle No"><input className={inputClass} value={draftForm.vehicle_no} onChange={(e) => setDraftForm((f) => ({ ...f, vehicle_no: e.target.value }))} /></Field>
                      <Field label="Wheeler"><input className={inputClass} value={draftForm.wheeler} onChange={(e) => setDraftForm((f) => ({ ...f, wheeler: e.target.value }))} /></Field>
                      <Field label="Owner Name"><input className={inputClass} value={draftForm.owner_name} onChange={(e) => setDraftForm((f) => ({ ...f, owner_name: e.target.value }))} /></Field>
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
                  <table className="min-w-[1100px] w-full text-left text-[13px]">
                    <thead className="bg-[#f1f5f9] text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">
                      <tr>
                        {['Date', 'Vehicle No', 'Wheeler', 'Owner Name', 'Work', 'Debit', 'Credit', 'Actions'].map((h) => (
                          <th key={h} className="px-3 py-2.5">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {draftOpen ? (
                        <tr className="border-t border-[#fecaca] bg-[#fff7f7]">
                          {renderManualInputs(draftForm, setDraftForm)}
                        </tr>
                      ) : null}
                      {entries.length === 0 && !draftOpen ? (
                        <tr><td colSpan={8} className="px-3 py-10 text-center text-[#7a8fa6]">No entries found for the selected filters.</td></tr>
                      ) : pageEntries.map((e, i) => {
                        if (editRow && String(editRow.source_id) === String(e.source_id) && e.source === 'manual') {
                          return (
                            <tr key={`edit-${e.source_id}`} className="border-t border-[#fed7aa] bg-[#fff7ed]">
                              {renderManualInputs(draftForm, setDraftForm, { compact: true })}
                            </tr>
                          );
                        }
                        return (
                          <tr key={`${e.ref}-${i}`} className={`border-t border-[#edf2f8] ${i % 2 ? 'bg-[#f8fafc]' : 'bg-white'}`}>
                            <td className="whitespace-nowrap px-3 py-2.5">{fmtDisplayDate(e.date)}</td>
                            <td className="px-3 py-2.5 font-semibold text-[#1e3261]">{e.vehicle_no || '—'}</td>
                            <td className="px-3 py-2.5">{e.wheeler || '—'}</td>
                            <td className="px-3 py-2.5">{e.owner_name || '—'}</td>
                            <td className="max-w-[280px] px-3 py-2.5" title={e.work || e.particulars || ''}>
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
                          <td className="px-3 py-3" colSpan={5}>Totals:</td>
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
            <p><span className="font-bold text-[#64748b]">Vehicle:</span> {detail.vehicle_no || '—'}</p>
            <p><span className="font-bold text-[#64748b]">Wheeler:</span> {detail.wheeler || '—'}</p>
            <p><span className="font-bold text-[#64748b]">Owner:</span> {detail.owner_name || '—'}</p>
            <p><span className="font-bold text-[#64748b]">Work:</span> {detail.work || detail.particulars || '—'}</p>
            <p><span className="font-bold text-[#64748b]">Debit:</span> {detail.debit ? fmtRs(detail.debit) : '—'}</p>
            <p><span className="font-bold text-[#64748b]">Credit:</span> {detail.credit ? fmtRs(detail.credit) : '—'}</p>
            <p><span className="font-bold text-[#64748b]">Balance:</span> {fmtRs(detail.balance)}</p>
          </div>
        </ModalShell>
      ) : null}

      {voucherOpen ? (
        <ModalShell
          title={`Vendor Vouchers (${voucherCount})`}
          onClose={() => !savingVoucher && setVoucherOpen(false)}
          footer={(
            <>
              <button type="button" disabled={savingVoucher} onClick={() => onOpenSection?.('Voucher')} className="mr-auto h-10 rounded-[8px] border border-[#ddd6fe] bg-[#f5f3ff] px-4 text-[13px] font-semibold text-[#6d28d9]">Open Accounts Voucher</button>
              <button type="button" disabled={savingVoucher} onClick={() => setVoucherOpen(false)} className="h-10 rounded-[8px] border px-4 text-[13px] font-semibold">Close</button>
              <button type="button" disabled={savingVoucher} onClick={saveVendorVoucher} className="h-10 rounded-[8px] bg-[#7c3aed] px-4 text-[13px] font-extrabold text-white disabled:opacity-60">{savingVoucher ? 'Saving...' : 'Create Voucher'}</button>
            </>
          )}
        >
          <div className="grid gap-4">
            <div className="rounded-[12px] border border-[#ede9fe] bg-[#faf5ff] p-3">
              <p className="mb-3 text-[12px] font-extrabold text-[#6d28d9]">New Voucher — {selected?.name || 'Vendor'}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Voucher Date" required><input type="date" className={inputClass} value={voucherForm.voucher_date} onChange={(e) => setVoucherForm((f) => ({ ...f, voucher_date: e.target.value }))} /></Field>
                <Field label="Amount (₹)" required><input type="number" min="0" step="0.01" className={inputClass} value={voucherForm.amount} onChange={(e) => setVoucherForm((f) => ({ ...f, amount: e.target.value }))} /></Field>
                <Field label="Category"><input className={inputClass} placeholder="e.g., Cabin Denting" value={voucherForm.category} onChange={(e) => setVoucherForm((f) => ({ ...f, category: e.target.value }))} /></Field>
                <Field label="Payment Mode">
                  <select className={inputClass} value={voucherForm.payment_mode} onChange={(e) => setVoucherForm((f) => ({ ...f, payment_mode: e.target.value }))}>
                    {['Cash', 'UPI', 'NEFT', 'RTGS', 'Cheque', 'Other'].map((m) => <option key={m}>{m}</option>)}
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Particulars / Work"><textarea className={`${inputClass} h-20 py-2`} value={voucherForm.particulars} onChange={(e) => setVoucherForm((f) => ({ ...f, particulars: e.target.value }))} /></Field>
                </div>
              </div>
            </div>
            <div>
              <p className="mb-2 text-[12px] font-extrabold text-[#334155]">Existing vouchers</p>
              {vouchers.length === 0 ? (
                <p className="rounded-[10px] border border-dashed border-[#e2e8f0] px-3 py-6 text-center text-[12px] font-semibold text-[#94a3b8]">No vouchers yet for this vendor.</p>
              ) : (
                <div className="max-h-56 overflow-y-auto rounded-[10px] border border-[#e2e9f3]">
                  <table className="w-full text-left text-[12px]">
                    <thead className="sticky top-0 bg-[#f8fafc] text-[10px] font-extrabold uppercase tracking-wide text-[#64748b]">
                      <tr>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Voucher</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vouchers.map((v) => (
                        <tr key={v.id} className="border-t border-[#edf2f8]">
                          <td className="px-3 py-2">{fmtDisplayDate(v.voucher_date)}</td>
                          <td className="px-3 py-2 font-semibold text-[#6d28d9]">{v.voucher_no}</td>
                          <td className="px-3 py-2">{v.category || '—'}</td>
                          <td className="px-3 py-2 font-extrabold text-[#16a34a]">{fmtRs(v.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}

