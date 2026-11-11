import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, Download, Eye, ExternalLink, FileText, Pencil, Phone, Plus, Search, Trash2, X } from 'lucide-react';
import { accountsModuleApi } from './api.js';
import { exportNotifyCsv, normalizeApiRows } from './lib/utils.js';
import { moduleCaps } from './settingsHubPages.jsx';
import { MobileCardEmpty, MobileCardList, MobileRecordCard } from './components/mobile/MobileRecordCard.jsx';
import { LedgerMobileCards } from './components/mobile/LedgerMobileCards.jsx';
import { MobileSubnavSelect } from './components/mobile/MobileSubnavSelect.jsx';
import { TablePagination, usePagedRows } from './components/TablePagination.jsx';

const TABS = [
  { key: 'Supplier Details', label: 'Supplier Details' },
  { key: 'Supplier Ledger', label: 'Supplier Ledger' },
];

const MATERIAL_CATEGORIES = [
  'Hardware', 'Steel', 'Electrical', 'Solar Panel', 'Inverter', 'Battery',
  'Cable', 'Structure', 'Civil', 'Paint', 'Plumbing', 'Other',
];
const UNIT_OPTIONS = ['Pcs', 'Nos', 'Kg', 'Mtr', 'Ft', 'Set', 'Box', 'Ltr'];

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

function emptyMaterialRow() {
  return { material_name: '', category: '', quantity: '', unit: 'Pcs', rate: '' };
}

function TypeBadge({ value }) {
  const key = String(value || '').toLowerCase();
  const tone = {
    purchase: 'bg-[#ede9fe] text-[#6d28d9]',
    payment: 'bg-[#dcfce7] text-[#166534]',
    receipt: 'bg-[#dbeafe] text-[#1d4ed8]',
    opening: 'bg-[#f1f5f9] text-[#475569]',
  }[key] || 'bg-[#f1f5f9] text-[#475569]';
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${tone}`}>{key || '—'}</span>;
}

function ModalShell({ title, onClose, children, footer, wide = false }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#0f172a]/55 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`flex max-h-[96vh] w-full flex-col overflow-hidden rounded-t-[16px] bg-white shadow-2xl sm:max-h-[92vh] sm:rounded-[16px] ${wide ? 'max-w-[960px]' : 'max-w-[560px]'}`}>
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
      {label}{required ? <span className="text-[#dc2626]"> *</span> : ''}
      {children}
    </label>
  );
}

const inputClass = 'h-10 w-full rounded-[8px] border border-[#d9e4f2] px-3 text-[13px] font-semibold text-[#1e3261] outline-none focus:border-[#dc2626] focus:ring-2 focus:ring-[#fecaca]';
const labelCaps = 'text-[10px] font-extrabold uppercase tracking-wide text-[#64748b]';

export function SupplierModulePage({ activeSection, onOpenSection, onNotify, loggedInUser = null }) {
  const caps = moduleCaps(loggedInUser, 'Supplier');
  const tab = TABS.some((t) => t.key === activeSection) ? activeSection : 'Supplier Details';
  const [addRequested, setAddRequested] = useState(false);

  const requestAddSupplier = () => {
    if (tab !== 'Supplier Details') onOpenSection?.('Supplier Details');
    setAddRequested(true);
  };

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[12px] font-bold text-[#7a8fa6]">Dashboard / Supplier</p>
          <h1 className="font-display text-[20px] font-extrabold text-[#111827] sm:text-[22px]">Supplier Management</h1>
        </div>
        {caps.add ? (
          <button
            type="button"
            onClick={requestAddSupplier}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] bg-[#dc2626] px-4 text-[13px] font-extrabold text-white sm:w-auto"
          >
            <Plus className="size-4" /> Add Supplier
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
      {tab === 'Supplier Details' ? (
        <SupplierDetailsTab
          caps={caps}
          onNotify={onNotify}
          addRequested={addRequested}
          onAddRequestConsumed={() => setAddRequested(false)}
        />
      ) : null}
      {tab === 'Supplier Ledger' ? (
        <SupplierLedgerTab onNotify={onNotify} onOpenSection={onOpenSection} />
      ) : null}
    </div>
  );
}

function SupplierDetailsTab({ caps, onNotify, addRequested = false, onAddRequestConsumed }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await accountsModuleApi.parties.list({ account_type: 'Supplier', page_size: 200 });
      setRows(normalizeApiRows(data));
    } catch (e) {
      onNotify(e.message || 'Failed to load suppliers', 'error');
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
  const { pageRows, pagination } = usePagedRows(filtered, 'supplier-list', { resetKey: q });

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
        account_type: 'Supplier',
        status: 'Active',
        city: modal.form.city || (modal.form.address || '').split(',').pop()?.trim() || '',
      };
      if (modal.id) await accountsModuleApi.parties.update(modal.id, payload);
      else await accountsModuleApi.parties.create(payload);
      onNotify(modal.id ? 'Supplier updated' : 'Supplier added', 'success');
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
      onNotify('Supplier deleted', 'success');
      await load();
    } catch (e) {
      onNotify(e.message || 'Delete failed', 'error');
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <input className={`${inputClass} w-full sm:max-w-xs`} placeholder="Search Suppliers..." value={q} onChange={(e) => setQ(e.target.value)} />
        {caps.export ? (
          <button
            type="button"
            onClick={() => exportNotifyCsv(onNotify, 'suppliers', ['Name', 'Phone', 'Company', 'Type', 'Balance'], filtered.map((r) => [r.name, r.phone, r.company, r.vendor_type, r.balance]))}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-extrabold text-[#284276] sm:w-auto"
          >
            <Download className="size-4" /> Export CSV
          </button>
        ) : null}
      </div>
      {loading ? (
        <p className="py-8 text-center text-[13px] font-semibold text-[#7a8fa6] lg:hidden">Loading...</p>
      ) : filtered.length === 0 ? (
        <MobileCardEmpty title="No suppliers yet" hint="Add your first supplier." />
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
                badges={r.vendor_type ? <span className="rounded-full bg-[#f5f3ff] px-2 py-0.5 text-[10px] font-extrabold text-[#6d28d9]">{r.vendor_type}</span> : null}
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
              {['Name', 'Phone', 'Company', 'Type', 'Balance', 'Actions'].map((h) => (
                <th key={h} className="px-3 py-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-[#7a8fa6]">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-[#7a8fa6]">No suppliers yet. Add your first supplier.</td></tr>
            ) : pageRows.map((r) => (
              <tr key={r.id} className="border-t border-[#edf2f8]">
                <td className="px-3 py-2.5 font-extrabold text-[#1e3261]">{r.name}</td>
                <td className="px-3 py-2.5">{r.phone || '—'}</td>
                <td className="px-3 py-2.5">{r.company || '—'}</td>
                <td className="px-3 py-2.5">{r.vendor_type || '—'}</td>
                <td className={`px-3 py-2.5 font-extrabold ${Number(r.balance) > 0 ? 'text-[#dc2626]' : 'text-[#1e3261]'}`}>
                  {fmtRs(Math.abs(Number(r.balance || 0)))}
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
          title={modal.id ? 'Edit Supplier' : 'Add New Supplier'}
          onClose={() => setModal(null)}
          footer={(
            <>
              <button type="button" onClick={() => setModal(null)} className="h-10 rounded-[8px] border px-4 text-[13px] font-semibold">Cancel</button>
              <button type="button" disabled={saving} onClick={save} className="h-10 rounded-[8px] bg-[#dc2626] px-4 text-[13px] font-extrabold text-white disabled:opacity-60">{saving ? 'Saving...' : modal.id ? 'Save Supplier' : 'Add Supplier'}</button>
            </>
          )}
        >
          <div className="grid gap-3">
            <Field label="Name" required><input className={inputClass} value={modal.form.name || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, name: e.target.value } }))} /></Field>
            <Field label="Phone" required><input className={inputClass} placeholder="Enter 10-digit phone number" maxLength={10} value={modal.form.phone || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) } }))} /></Field>
            <Field label="Company"><input className={inputClass} value={modal.form.company || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, company: e.target.value } }))} /></Field>
            <Field label="Supplier Type"><input className={inputClass} placeholder="e.g., Hardware, Steel, Paints" value={modal.form.vendor_type || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, vendor_type: e.target.value } }))} /></Field>
            <Field label="Address"><textarea className={`${inputClass} h-20 py-2`} value={modal.form.address || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, address: e.target.value } }))} /></Field>
            <Field label="GSTIN"><input className={inputClass} placeholder="15 characters" maxLength={15} value={modal.form.gstin || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, gstin: e.target.value.toUpperCase() } }))} /></Field>
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

function SupplierLedgerTab({ onNotify }) {
  const [suppliers, setSuppliers] = useState([]);
  const [partyId, setPartyId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [category, setCategory] = useState('');
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [detail, setDetail] = useState(null);

  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    entry_kind: 'invoice',
    doc_no: '',
    doc_date: todayIso(),
    gst_type: 'CGST_SGST',
    cgst_percent: '9',
    sgst_percent: '9',
    igst_percent: '18',
    lines: [emptyMaterialRow()],
  });
  const [savingPurchase, setSavingPurchase] = useState(false);

  const [voucherOpen, setVoucherOpen] = useState(false);
  const [voucherForm, setVoucherForm] = useState({
    payment_date: todayIso(),
    voucher_no: '',
    amount: '',
    payment_mode: 'Cash',
    particulars: '',
    notes: '',
  });
  const [savingVoucher, setSavingVoucher] = useState(false);

  useEffect(() => {
    accountsModuleApi.parties.list({ account_type: 'Supplier', page_size: 200 })
      .then((data) => setSuppliers(normalizeApiRows(data)))
      .catch((e) => onNotify(e.message || 'Failed to load suppliers', 'error'));
  }, [onNotify]);

  const loadLedger = useCallback(async () => {
    if (!partyId) {
      setPayload(null);
      return;
    }
    setLoading(true);
    try {
      const params = {};
      if (start) params.start = start;
      if (end) params.end = end;
      if (category.trim()) params.category = category.trim();
      const qs = new URLSearchParams(params).toString();
      setPayload(await accountsModuleApi.partyLedger(partyId, qs));
    } catch (e) {
      onNotify(e.message || 'Failed to load ledger', 'error');
    } finally {
      setLoading(false);
    }
  }, [partyId, start, end, category, onNotify]);

  useEffect(() => { loadLedger(); }, [loadLedger, reloadKey]);

  const selected = useMemo(
    () => suppliers.find((s) => String(s.id) === String(partyId)) || payload?.party || null,
    [suppliers, partyId, payload],
  );
  const entries = payload?.results || [];
  const { pageRows: pageEntries, pagination } = usePagedRows(entries, 'supplier-ledger', { resetKey: `${partyId}|${start}|${end}|${category}|${reloadKey}` });
  const summary = payload?.summary || {};
  const totalDebit = Number(summary.total_debit ?? entries.reduce((s, e) => s + Number(e.debit || 0), 0));
  const totalCredit = Number(summary.total_credit ?? entries.reduce((s, e) => s + Number(e.credit || 0), 0));
  const opening = Number(summary.previous_balance ?? summary.opening ?? selected?.opening_balance ?? 0);
  const netBal = Number(summary.final_balance ?? summary.current_balance ?? (entries.length ? entries[entries.length - 1].balance : opening));

  const lineTotals = useMemo(() => purchaseForm.lines.map((row) => {
    const qty = Number(row.quantity || 0);
    const rate = Number(row.rate || 0);
    return Math.round(qty * rate * 100) / 100;
  }), [purchaseForm.lines]);
  const subtotal = lineTotals.reduce((s, n) => s + n, 0);
  const gstRate = purchaseForm.gst_type === 'IGST'
    ? Number(purchaseForm.igst_percent || 0)
    : Number(purchaseForm.cgst_percent || 0) + Number(purchaseForm.sgst_percent || 0);
  const gstAmount = purchaseForm.entry_kind === 'invoice'
    ? Math.round(subtotal * gstRate) / 100
    : 0;
  const grandTotal = Math.round((subtotal + gstAmount) * 100) / 100;

  const openPurchase = () => {
    if (!partyId) {
      onNotify('Select a supplier first', 'error');
      return;
    }
    setPurchaseForm({
      entry_kind: 'invoice',
      doc_no: '',
      doc_date: todayIso(),
      gst_type: 'CGST_SGST',
      cgst_percent: '9',
      sgst_percent: '9',
      igst_percent: '18',
      lines: [emptyMaterialRow()],
    });
    setPurchaseOpen(true);
  };

  const openVoucher = () => {
    if (!partyId) {
      onNotify('Select a supplier first', 'error');
      return;
    }
    setVoucherForm({
      payment_date: todayIso(),
      voucher_no: '',
      amount: '',
      payment_mode: 'Cash',
      particulars: '',
      notes: '',
    });
    setVoucherOpen(true);
  };

  const updateLine = (index, patch) => {
    setPurchaseForm((f) => ({
      ...f,
      lines: f.lines.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  };

  const savePurchase = async () => {
    if (!partyId || !selected) {
      onNotify('Select a supplier first', 'error');
      return;
    }
    if (!purchaseForm.doc_date) {
      onNotify('Date is required', 'error');
      return;
    }
    if (!purchaseForm.doc_no.trim()) {
      onNotify(purchaseForm.entry_kind === 'invoice' ? 'Invoice number is required' : 'Challan number is required', 'error');
      return;
    }
    const validLines = purchaseForm.lines.filter((r) => String(r.material_name || '').trim() && Number(r.quantity) > 0);
    if (!validLines.length) {
      onNotify('Add at least one material with name and quantity', 'error');
      return;
    }
    for (const row of validLines) {
      if (!String(row.category || '').trim()) {
        onNotify('Category is required for each material', 'error');
        return;
      }
      if (!(Number(row.rate) >= 0)) {
        onNotify('Rate is required for each material', 'error');
        return;
      }
    }
    const linesPayload = validLines.map((row, idx) => ({
      material_name: String(row.material_name).trim(),
      category: String(row.category).trim(),
      quantity: Number(row.quantity) || 0,
      unit: row.unit || 'Pcs',
      rate: Number(row.rate) || 0,
      sort_order: idx,
    }));
    setSavingPurchase(true);
    try {
      if (purchaseForm.entry_kind === 'invoice') {
        await accountsModuleApi.purchaseInvoices.create({
          invoice_no: purchaseForm.doc_no.trim(),
          invoice_date: purchaseForm.doc_date,
          supplier: partyId,
          supplier_name: selected.name,
          category: linesPayload[0]?.category || selected.vendor_type || '',
          gst_type: purchaseForm.gst_type,
          cgst_percent: purchaseForm.gst_type === 'CGST_SGST' ? Number(purchaseForm.cgst_percent || 0) : 0,
          sgst_percent: purchaseForm.gst_type === 'CGST_SGST' ? Number(purchaseForm.sgst_percent || 0) : 0,
          igst_percent: purchaseForm.gst_type === 'IGST' ? Number(purchaseForm.igst_percent || 0) : 0,
          status: 'Recorded',
          payment_mode: 'NEFT',
          lines: linesPayload,
        });
        onNotify('Purchase invoice saved', 'success');
      } else {
        await accountsModuleApi.purchaseChallans.create({
          challan_no: purchaseForm.doc_no.trim(),
          challan_date: purchaseForm.doc_date,
          supplier: partyId,
          supplier_name: selected.name,
          status: 'Received',
          payment_mode: 'Cash',
          remarks: 'Supplier ledger purchase challan',
          lines: linesPayload,
        });
        onNotify('Purchase challan saved', 'success');
      }
      setPurchaseOpen(false);
      setReloadKey((k) => k + 1);
    } catch (e) {
      onNotify(e.message || 'Failed to save purchase entry', 'error');
    } finally {
      setSavingPurchase(false);
    }
  };

  const saveVoucher = async () => {
    const amount = Number(voucherForm.amount || 0);
    if (!partyId) {
      onNotify('Select a supplier first', 'error');
      return;
    }
    if (!(amount > 0)) {
      onNotify('Amount must be greater than zero', 'error');
      return;
    }
    if (!voucherForm.payment_date) {
      onNotify('Voucher date is required', 'error');
      return;
    }
    setSavingVoucher(true);
    try {
      await accountsModuleApi.settleParty(partyId, {
        amount,
        payment_date: voucherForm.payment_date,
        payment_mode: voucherForm.payment_mode || 'Cash',
        voucher_no: voucherForm.voucher_no || '',
        particulars: voucherForm.particulars || `Payment to ${selected?.name || 'supplier'}`,
        notes: voucherForm.notes || '',
        remarks: [voucherForm.particulars, voucherForm.notes].filter(Boolean).join('\n') || undefined,
      });
      onNotify('Payment voucher saved', 'success');
      setVoucherOpen(false);
      setReloadKey((k) => k + 1);
    } catch (e) {
      onNotify(e.message || 'Failed to save voucher', 'error');
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

  const kpiCards = [
    { label: 'Opening Balance', value: opening, tone: 'bg-[#fffbeb] border-[#fde68a] text-[#b45309]' },
    { label: 'Total Credit (Purchases)', value: totalCredit, tone: 'bg-[#ecfdf5] border-[#a7f3d0] text-[#047857]' },
    { label: 'Total Debit (Payments)', value: totalDebit, tone: 'bg-[#fef2f2] border-[#fecaca] text-[#dc2626]' },
    { label: 'Net Balance', value: netBal, tone: 'bg-[#eff6ff] border-[#bfdbfe] text-[#1d4ed8]', hint: netBal > 0 ? 'Payable' : netBal < 0 ? 'Receivable' : 'Clear', hintTone: netBal > 0 ? 'text-[#dc2626]' : 'text-[#047857]' },
  ];

  return (
    <>
      <div className="grid gap-3 rounded-[14px] border border-[#e2e9f3] bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Select Supplier" required>
            <select className={inputClass} value={partyId} onChange={(e) => setPartyId(e.target.value)}>
              <option value="">-- Choose Supplier --</option>
              {suppliers.map((v) => <option key={v.id} value={v.id}>{v.name}{v.phone ? ` · ${v.phone}` : ''}</option>)}
            </select>
          </Field>
          <Field label="Start Date"><input type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="End Date"><input type="date" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          <Field label="Search Category">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
              <input className={`${inputClass} pl-9`} placeholder="e.g., Hardware" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
          </Field>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button type="button" disabled={!partyId} onClick={openPurchase} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] bg-[#dc2626] px-4 text-[13px] font-extrabold text-white disabled:opacity-50 sm:w-auto">
            <Plus className="size-4" /> Add Purchase Entry
          </button>
          <button type="button" disabled={!partyId} onClick={openVoucher} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276] disabled:opacity-50 sm:w-auto">
            <Banknote className="size-4" /> Add Voucher
          </button>
          <button type="button" disabled={!entries.length} onClick={() => exportNotifyCsv(onNotify, 'supplier-ledger', ['Date', 'Type', 'Ref', 'Particulars', 'Debit', 'Credit', 'Balance'], entries.map((e) => [e.date, e.type_label || e.type, e.ref, e.particulars, e.debit, e.credit, e.balance]))} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-extrabold text-[#284276] disabled:opacity-50 sm:w-auto">
            <Download className="size-4" /> Export CSV
          </button>
          <button type="button" disabled={!entries.length} onClick={savePdf} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-extrabold text-[#284276] disabled:opacity-50 sm:w-auto">
            <FileText className="size-4" /> Save PDF
          </button>
        </div>
      </div>

      {!partyId ? (
        <div className="rounded-[14px] border border-[#e2e9f3] bg-white p-4 shadow-sm">
          <p className="py-12 text-center text-[13px] font-semibold text-[#7a8fa6]">Please select a supplier to view their ledger entries.</p>
        </div>
      ) : (
        <>
          <div className="rounded-[14px] border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3">
            <div className="grid gap-2 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
              <p><span className="font-bold text-[#64748b]">Supplier:</span> <span className="font-extrabold text-[#1e3261]">{selected?.name || '—'}</span></p>
              <p><span className="font-bold text-[#64748b]">Phone:</span> <span className="font-extrabold text-[#1e3261]">{selected?.phone || '—'}</span></p>
              <p><span className="font-bold text-[#64748b]">Category:</span> <span className="font-extrabold text-[#1e3261]">{selected?.vendor_type || '—'}</span></p>
              <p><span className="font-bold text-[#64748b]">Company:</span> <span className="font-extrabold text-[#1e3261]">{selected?.company || '—'}</span></p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {kpiCards.map(({ label, value, tone, hint, hintTone }) => (
              <article key={label} className={`rounded-[14px] border p-4 ${tone}`}>
                <p className="text-[11px] font-bold opacity-80">{label}</p>
                <p className="mt-2 text-[22px] font-extrabold tracking-tight">
                  {fmtRs(Math.abs(value))}
                  {hint ? <span className={`ml-1 text-[13px] font-extrabold ${hintTone || ''}`}>({hint})</span> : null}
                </p>
              </article>
            ))}
          </div>

          <div className="rounded-[14px] border border-[#e2e9f3] bg-white p-4 shadow-sm">
            {loading ? (
              <p className="py-10 text-center text-[13px] font-semibold text-[#7a8fa6]">Loading...</p>
            ) : (
              <>
                <LedgerMobileCards
                  entries={pageEntries}
                  emptyText="No ledger entries for this supplier."
                  totalDebit={totalDebit}
                  totalCredit={totalCredit}
                  finalBalance={netBal}
                  onOpen={setDetail}
                  TypeBadge={TypeBadge}
                  fmtDate={fmtDisplayDate}
                  fmtMoney={fmtRs}
                />
                <div className="hidden overflow-x-auto lg:block">
                  <table className="min-w-[1050px] w-full text-left text-[13px]">
                    <thead className="bg-[#f1f5f9] text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">
                      <tr>
                        {['Date', 'Type', 'Ref No', 'Particulars', 'Debit (₹)', 'Credit (₹)', 'Balance (₹)', 'Actions'].map((h) => (
                          <th key={h} className="px-3 py-2.5">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {entries.length === 0 ? (
                        <tr><td colSpan={8} className="px-3 py-10 text-center text-[#7a8fa6]">No ledger entries for this supplier.</td></tr>
                      ) : pageEntries.map((e, i) => {
                        const bal = Number(e.balance || 0);
                        return (
                          <tr key={`${e.ref}-${i}`} className={`border-t border-[#edf2f8] ${i % 2 ? 'bg-[#f8fafc]' : 'bg-white'}`}>
                            <td className="whitespace-nowrap px-3 py-2.5">{fmtDisplayDate(e.date)}</td>
                            <td className="px-3 py-2.5"><TypeBadge value={e.type_label || e.type} /></td>
                            <td className="px-3 py-2.5">
                              <span className="inline-flex items-center gap-1 font-semibold text-[#0b65e5]">
                                {e.ref || '—'}
                                {e.ref && e.ref !== 'OPENING' ? <ExternalLink className="size-3.5 opacity-70" /> : null}
                              </span>
                            </td>
                            <td className="max-w-[280px] truncate px-3 py-2.5" title={e.particulars || ''}>{e.particulars || '—'}</td>
                            <td className="px-3 py-2.5 font-extrabold text-[#dc2626]">{e.debit ? fmtRs(e.debit) : '—'}</td>
                            <td className="px-3 py-2.5 font-extrabold text-[#16a34a]">{e.credit ? fmtRs(e.credit) : '—'}</td>
                            <td className="px-3 py-2.5 font-extrabold text-[#111827]">{fmtRs(Math.abs(bal))} ({bal >= 0 ? 'Dr' : 'Cr'})</td>
                            <td className="px-3 py-2.5">
                              <button type="button" onClick={() => setDetail(e)} className="grid size-8 place-items-center rounded-[8px] text-[#7c3aed] hover:bg-[#f5f3ff]" title="View">
                                <Eye className="size-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {entries.length ? (
                      <tfoot>
                        <tr className="border-t-2 border-[#cbd5e1] bg-[#f8fafc] font-extrabold">
                          <td className="px-3 py-3" colSpan={4}>Totals:</td>
                          <td className="px-3 py-3 text-[#dc2626]">{fmtRs(totalDebit)}</td>
                          <td className="px-3 py-3 text-[#16a34a]">{fmtRs(totalCredit)}</td>
                          <td className="px-3 py-3" />
                          <td />
                        </tr>
                      </tfoot>
                    ) : null}
                  </table>
                </div>
                <TablePagination {...pagination} className="mt-3" />
                <div className="mt-4 flex flex-col gap-3 border-t border-[#edf2f8] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[12px] font-semibold text-[#64748b]">Showing {entries.length} entries</p>
                  <div className="rounded-[12px] border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-right">
                    <p className="text-[22px] font-extrabold text-[#dc2626]">{fmtRs(Math.abs(netBal))}</p>
                    <p className="text-[11px] font-semibold text-[#b91c1c]">{netBal > 0 ? 'Amount Payable' : netBal < 0 ? 'Amount Receivable' : 'Settled'}</p>
                  </div>
                </div>
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
            <p><span className="font-bold text-[#64748b]">Particulars:</span> {detail.particulars || '—'}</p>
            <p><span className="font-bold text-[#64748b]">Debit:</span> {detail.debit ? fmtRs(detail.debit) : '—'}</p>
            <p><span className="font-bold text-[#64748b]">Credit:</span> {detail.credit ? fmtRs(detail.credit) : '—'}</p>
            <p><span className="font-bold text-[#64748b]">Balance:</span> {fmtRs(detail.balance)}</p>
          </div>
        </ModalShell>
      ) : null}

      {purchaseOpen ? (
        <ModalShell
          title="Add Purchase Entry"
          wide
          onClose={() => !savingPurchase && setPurchaseOpen(false)}
          footer={(
            <>
              <button type="button" disabled={savingPurchase} onClick={() => setPurchaseOpen(false)} className="h-10 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-semibold text-[#111827]">Cancel</button>
              <button type="button" disabled={savingPurchase} onClick={savePurchase} className="h-10 rounded-[8px] bg-[#dc2626] px-4 text-[13px] font-extrabold text-white disabled:opacity-60">
                {savingPurchase ? 'Saving...' : (purchaseForm.entry_kind === 'invoice' ? 'Save Invoice' : 'Save Challan')}
              </button>
            </>
          )}
        >
          <div className="space-y-5">
            <div className="flex flex-wrap gap-5 text-[13px] font-bold text-[#334155]">
              {[
                ['invoice', 'Invoice (with GST)'],
                ['challan', 'Challan (without GST)'],
              ].map(([key, label]) => (
                <label key={key} className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="purchase-entry-kind"
                    checked={purchaseForm.entry_kind === key}
                    onChange={() => setPurchaseForm((f) => ({ ...f, entry_kind: key }))}
                    className="accent-[#dc2626]"
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={purchaseForm.entry_kind === 'invoice' ? 'Invoice No' : 'Challan No'} required>
                <input className={inputClass} placeholder={purchaseForm.entry_kind === 'invoice' ? 'Enter invoice number' : 'Enter challan number'} value={purchaseForm.doc_no} onChange={(e) => setPurchaseForm((f) => ({ ...f, doc_no: e.target.value }))} />
              </Field>
              <Field label="Date" required>
                <input type="date" className={inputClass} value={purchaseForm.doc_date} onChange={(e) => setPurchaseForm((f) => ({ ...f, doc_date: e.target.value }))} />
              </Field>
            </div>

            <div className="overflow-x-auto rounded-[12px] border border-[#e8eef6]">
              <table className="min-w-[860px] w-full text-left">
                <thead>
                  <tr className="border-b border-[#edf2f8] bg-[#f8fafc]">
                    {['Material Name *', 'Category *', 'Quantity *', 'Unit', 'Rate *', 'Total', 'Action'].map((h) => (
                      <th key={h} className={`px-3 py-2 ${labelCaps}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {purchaseForm.lines.map((row, index) => (
                    <tr key={index} className="border-t border-[#edf2f8]">
                      <td className="px-2 py-2">
                        <input className={inputClass} placeholder="Enter material name" value={row.material_name} onChange={(e) => updateLine(index, { material_name: e.target.value })} />
                      </td>
                      <td className="px-2 py-2">
                        <select className={inputClass} value={row.category} onChange={(e) => updateLine(index, { category: e.target.value })}>
                          <option value="">Select</option>
                          {MATERIAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2 w-[100px]">
                        <input type="number" min="0" step="0.01" className={inputClass} value={row.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} />
                      </td>
                      <td className="px-2 py-2 w-[110px]">
                        <select className={inputClass} value={row.unit} onChange={(e) => updateLine(index, { unit: e.target.value })}>
                          {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2 w-[120px]">
                        <input type="number" min="0" step="0.01" className={inputClass} value={row.rate} onChange={(e) => updateLine(index, { rate: e.target.value })} />
                      </td>
                      <td className="px-3 py-2 text-[13px] font-extrabold text-[#111827]">{fmtRs(lineTotals[index] || 0)}</td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          disabled={purchaseForm.lines.length <= 1}
                          onClick={() => setPurchaseForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== index) }))}
                          className="grid size-9 place-items-center rounded-[8px] text-[#dc2626] hover:bg-[#fef2f2] disabled:opacity-40"
                          title="Remove"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => setPurchaseForm((f) => ({ ...f, lines: [...f.lines, emptyMaterialRow()] }))}
              className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-[#dc2626]"
            >
              <Plus className="size-4" /> Add Material
            </button>

            {purchaseForm.entry_kind === 'invoice' ? (
              <div className="grid gap-3 rounded-[12px] border border-[#edf2f8] bg-[#fafafa] p-4 sm:grid-cols-2">
                <div>
                  <p className={`mb-2 ${labelCaps}`}>GST Type</p>
                  <div className="flex flex-wrap gap-4 text-[13px] font-bold text-[#334155]">
                    {[
                      ['IGST', 'IGST'],
                      ['CGST_SGST', 'CGST + SGST'],
                    ].map(([key, label]) => (
                      <label key={key} className="inline-flex cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          name="purchase-gst-type"
                          checked={purchaseForm.gst_type === key}
                          onChange={() => setPurchaseForm((f) => ({ ...f, gst_type: key }))}
                          className="accent-[#dc2626]"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
                {purchaseForm.gst_type === 'IGST' ? (
                  <Field label="IGST (%)">
                    <input type="number" min="0" step="0.01" className={inputClass} value={purchaseForm.igst_percent} onChange={(e) => setPurchaseForm((f) => ({ ...f, igst_percent: e.target.value }))} />
                  </Field>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="CGST (%)">
                      <input type="number" min="0" step="0.01" className={inputClass} value={purchaseForm.cgst_percent} onChange={(e) => setPurchaseForm((f) => ({ ...f, cgst_percent: e.target.value }))} />
                    </Field>
                    <Field label="SGST (%)">
                      <input type="number" min="0" step="0.01" className={inputClass} value={purchaseForm.sgst_percent} onChange={(e) => setPurchaseForm((f) => ({ ...f, sgst_percent: e.target.value }))} />
                    </Field>
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex justify-end">
              <div className="min-w-[240px] space-y-1 text-right text-[13px]">
                <p className="font-semibold text-[#53647f]">Subtotal: <span className="font-extrabold text-[#111827]">{fmtRs(subtotal)}</span></p>
                {purchaseForm.entry_kind === 'invoice' ? (
                  <p className="font-semibold text-[#53647f]">
                    GST ({purchaseForm.gst_type === 'IGST' ? `IGST ${purchaseForm.igst_percent || 0}%` : `CGST + SGST ${gstRate}%`}):{' '}
                    <span className="font-extrabold text-[#111827]">{fmtRs(gstAmount)}</span>
                  </p>
                ) : null}
                <p className="pt-1 text-[16px] font-extrabold text-[#dc2626]">Total Amount: {fmtRs(grandTotal)}</p>
              </div>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {voucherOpen ? (
        <ModalShell
          title="Add Payment Voucher"
          onClose={() => !savingVoucher && setVoucherOpen(false)}
          footer={(
            <>
              <button type="button" disabled={savingVoucher} onClick={() => setVoucherOpen(false)} className="h-10 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-semibold text-[#111827]">Cancel</button>
              <button type="button" disabled={savingVoucher} onClick={saveVoucher} className="h-10 rounded-[8px] bg-[#dc2626] px-4 text-[13px] font-extrabold text-white disabled:opacity-60">
                {savingVoucher ? 'Saving...' : 'Save Voucher'}
              </button>
            </>
          )}
        >
          <div className="grid gap-3">
            <Field label="Voucher Date" required>
              <input type="date" className={inputClass} value={voucherForm.payment_date} onChange={(e) => setVoucherForm((f) => ({ ...f, payment_date: e.target.value }))} />
            </Field>
            <Field label="Voucher No">
              <input className={inputClass} placeholder="Auto-generated if empty" value={voucherForm.voucher_no} onChange={(e) => setVoucherForm((f) => ({ ...f, voucher_no: e.target.value }))} />
            </Field>
            <Field label="Payee Type" required>
              <select className={inputClass} value="Supplier" disabled>
                <option>Supplier</option>
              </select>
            </Field>
            <Field label="Select Supplier" required>
              <select className={inputClass} value={partyId} disabled>
                <option value={partyId}>{selected?.name || '—'}</option>
              </select>
            </Field>
            <Field label="Amount" required>
              <input type="number" min="0" step="0.01" className={inputClass} value={voucherForm.amount} onChange={(e) => setVoucherForm((f) => ({ ...f, amount: e.target.value }))} />
            </Field>
            <Field label="Payment Mode" required>
              <select className={inputClass} value={voucherForm.payment_mode} onChange={(e) => setVoucherForm((f) => ({ ...f, payment_mode: e.target.value }))}>
                {['Cash', 'UPI', 'NEFT', 'RTGS', 'IMPS', 'Cheque', 'Transfer', 'Other'].map((m) => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Particulars">
              <textarea className={`${inputClass} h-20 py-2`} placeholder="Payment for..." value={voucherForm.particulars} onChange={(e) => setVoucherForm((f) => ({ ...f, particulars: e.target.value }))} />
            </Field>
            <Field label="Notes">
              <textarea className={`${inputClass} h-20 py-2`} placeholder="Additional notes..." value={voucherForm.notes} onChange={(e) => setVoucherForm((f) => ({ ...f, notes: e.target.value }))} />
            </Field>
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}
