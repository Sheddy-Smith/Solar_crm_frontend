import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileText, Pencil, Plus, Receipt, Trash2, X } from 'lucide-react';
import { accountsModuleApi } from './api.js';
import { exportNotifyCsv, normalizeApiRows } from './lib/utils.js';

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

export function VendorModulePage({ activeSection, onOpenSection, onNotify }) {
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
        <button
          type="button"
          onClick={requestAddVendor}
          className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] bg-[#dc2626] px-4 text-[13px] font-extrabold text-white sm:w-auto"
        >
          <Plus className="size-4" /> Add Vendor
        </button>
      </div>
      <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-[#e8eef6] px-1">
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

function VendorDetailsTab({ onNotify, addRequested = false, onAddRequestConsumed }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await accountsModuleApi.parties.list({ account_type: 'Vendor', page_size: 2000 });
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
        <button
          type="button"
          onClick={() => exportNotifyCsv(onNotify, 'vendors', ['Name', 'Phone', 'Company', 'Type', 'Net Balance'], filtered.map((r) => [r.name, r.phone, r.company, r.vendor_type, r.balance]))}
          className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-extrabold text-[#284276] sm:w-auto"
        >
          <Download className="size-4" /> Export CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-[12px] border border-[#e2e9f3] bg-white">
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
            ) : filtered.map((r) => (
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
                    <button type="button" onClick={() => setModal({ id: r.id, form: { ...emptyForm, ...r } })} className="grid size-8 place-items-center rounded-[8px] text-[#0b65e5] hover:bg-[#eff6ff]"><Pencil className="size-4" /></button>
                    <button type="button" onClick={() => remove(r)} className="grid size-8 place-items-center rounded-[8px] text-[#dc2626] hover:bg-[#fef2f2]"><Trash2 className="size-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', payment_date: todayIso(), payment_mode: 'Cash', remarks: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    accountsModuleApi.parties.list({ account_type: 'Vendor', page_size: 2000 })
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

  useEffect(() => {
    if (!partyId) { setPayload(null); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params = {};
        if (range.start) params.start = range.start;
        if (range.end) params.end = range.end;
        if (category.trim()) params.category = category.trim();
        const qs = new URLSearchParams(params).toString();
        const data = await accountsModuleApi.partyLedger(partyId, qs);
        if (!cancelled) setPayload(data);
      } catch (e) {
        if (!cancelled) onNotify(e.message || 'Failed to load ledger', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [partyId, range.start, range.end, category, onNotify]);

  const savePayment = async () => {
    const amount = Number(payForm.amount || 0);
    if (amount <= 0) {
      onNotify('Enter payment amount', 'error');
      return;
    }
    setSaving(true);
    try {
      await accountsModuleApi.settleParty(partyId, payForm);
      onNotify('Vendor payment saved', 'success');
      setPayOpen(false);
      setPayForm({ amount: '', payment_date: todayIso(), payment_mode: 'Cash', remarks: '' });
      const params = {};
      if (range.start) params.start = range.start;
      if (range.end) params.end = range.end;
      if (category.trim()) params.category = category.trim();
      const qs = new URLSearchParams(params).toString();
      setPayload(await accountsModuleApi.partyLedger(partyId, qs));
    } catch (e) {
      onNotify(e.message || 'Payment failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const entries = payload?.results || [];
  const voucherCount = entries.filter((e) => /voucher/i.test(`${e.particulars || ''} ${e.ref || ''} ${e.category || ''}`)).length;

  const savePdf = () => {
    if (!entries.length) {
      onNotify('No ledger entries to save as PDF', 'error');
      return;
    }
    window.print();
  };

  return (
    <>
      <div className="grid gap-3 rounded-[12px] border border-[#e2e9f3] bg-white p-4">
        <div className="flex flex-wrap gap-3 text-[12px] font-bold text-[#53647f]">
          {[
            ['weekly', 'Weekly View'],
            ['monthly', 'Monthly View'],
            ['custom', 'Custom Date Range'],
          ].map(([key, label]) => (
            <label key={key} className="inline-flex items-center gap-2">
              <input type="radio" name="vendor-range" checked={mode === key} onChange={() => setMode(key)} />
              {label}
            </label>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Select Vendor *">
            <select className={inputClass} value={partyId} onChange={(e) => setPartyId(e.target.value)}>
              <option value="">-- Choose Vendor --</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}{v.phone ? ` · ${v.phone}` : ''}</option>)}
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
          <Field label="Search Category"><input className={inputClass} placeholder="e.g., Painter" value={category} onChange={(e) => setCategory(e.target.value)} /></Field>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button type="button" disabled={!partyId} onClick={() => setPayOpen(true)} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] bg-[#dc2626] px-4 text-[13px] font-extrabold text-white disabled:opacity-50 sm:w-auto">
            <Plus className="size-4" /> Add Manual Entry
          </button>
          <button
            type="button"
            disabled={!partyId}
            onClick={() => onOpenSection?.('Voucher')}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] bg-[#7c3aed] px-4 text-[13px] font-extrabold text-white disabled:opacity-50 sm:w-auto"
          >
            <Receipt className="size-4" /> Voucher ({voucherCount})
          </button>
          <button
            type="button"
            disabled={!entries.length}
            onClick={() => exportNotifyCsv(onNotify, 'vendor-ledger', ['Date', 'Particulars', 'Ref', 'Category', 'Debit', 'Credit', 'Balance'], entries.map((e) => [e.date, e.particulars, e.ref, e.category, e.debit, e.credit, e.balance]))}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-extrabold text-[#284276] disabled:opacity-50 sm:w-auto"
          >
            <Download className="size-4" /> Export CSV
          </button>
          <button
            type="button"
            disabled={!entries.length}
            onClick={savePdf}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-extrabold text-[#284276] disabled:opacity-50 sm:w-auto"
          >
            <FileText className="size-4" /> Save PDF
          </button>
        </div>
      </div>
      <div className="rounded-[12px] border border-[#e2e9f3] bg-white p-4">
        {!partyId ? (
          <p className="py-10 text-center text-[13px] font-semibold text-[#7a8fa6]">Please select a vendor to view their ledger entries.</p>
        ) : loading ? (
          <p className="py-10 text-center text-[13px] font-semibold text-[#7a8fa6]">Loading...</p>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-left text-[13px]">
              <thead className="bg-[#f8fbff] text-[11px] font-extrabold uppercase text-[#7a8fa6]">
                <tr>{['Date', 'Particulars', 'Ref', 'Category', 'Debit', 'Credit', 'Balance'].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-[#7a8fa6]">No ledger entries for this vendor.</td></tr>
                ) : entries.map((e, i) => (
                  <tr key={`${e.ref}-${i}`} className="border-t border-[#edf2f8]">
                    <td className="px-3 py-2">{e.date || '—'}</td>
                    <td className="px-3 py-2">{e.particulars}</td>
                    <td className="px-3 py-2">{e.ref}</td>
                    <td className="px-3 py-2">{e.category || '—'}</td>
                    <td className="px-3 py-2">{e.debit ? fmtRs(e.debit) : '—'}</td>
                    <td className="px-3 py-2">{e.credit ? fmtRs(e.credit) : '—'}</td>
                    <td className="px-3 py-2 font-extrabold">{fmtRs(e.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {payOpen ? (
        <ModalShell
          title="Vendor Payment"
          onClose={() => setPayOpen(false)}
          footer={(
            <>
              <button type="button" onClick={() => setPayOpen(false)} className="h-10 rounded-[8px] border px-4 text-[13px] font-semibold">Cancel</button>
              <button type="button" disabled={saving} onClick={savePayment} className="h-10 rounded-[8px] bg-[#dc2626] px-4 text-[13px] font-extrabold text-white disabled:opacity-60">{saving ? 'Saving...' : 'Save Payment'}</button>
            </>
          )}
        >
          <div className="grid gap-3">
            <Field label="Amount" required><input type="number" className={inputClass} value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} /></Field>
            <Field label="Payment Date"><input type="date" className={inputClass} value={payForm.payment_date} onChange={(e) => setPayForm((f) => ({ ...f, payment_date: e.target.value }))} /></Field>
            <Field label="Payment Mode">
              <select className={inputClass} value={payForm.payment_mode} onChange={(e) => setPayForm((f) => ({ ...f, payment_mode: e.target.value }))}>
                {['Cash', 'UPI', 'NEFT', 'RTGS', 'Cheque', 'Other'].map((m) => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Remarks"><textarea className={`${inputClass} h-20 py-2`} value={payForm.remarks} onChange={(e) => setPayForm((f) => ({ ...f, remarks: e.target.value }))} /></Field>
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}
