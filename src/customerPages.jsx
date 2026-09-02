import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Download, Eye, FileText, IndianRupee, Pencil, Plus, RefreshCw, Search, Trash2, TrendingDown, TrendingUp, Wallet, X } from 'lucide-react';
import { accountsModuleApi } from './api.js';
import { exportNotifyCsv, normalizeApiRows } from './lib/utils.js';

const TABS = [
  { key: 'Customer Details', label: 'Customer Details' },
  { key: 'Customer Ledger', label: 'Customer Ledger' },
  { key: 'Overall Credit Ledger', label: 'Overall Credit Ledger' },
];

const emptyForm = {
  name: '',
  company: '',
  phone: '',
  address: '',
  gstin: '',
  opening_balance: '0',
  vehicle_number: '',
  credit_limit: '0',
  credit_days: '30',
  relation: '',
  city: '',
};

function fmtRs(v) {
  const n = Number(v || 0);
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtCompact(v) {
  const n = Number(v || 0);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(1)}`;
}

function fmtDisplayDate(value) {
  if (!value) return '—';
  const raw = String(value).slice(0, 10);
  const [y, m, d] = raw.split('-');
  if (!y || !m || !d) return raw;
  return `${d}/${m}/${y}`;
}

function TypeBadge({ value }) {
  const key = String(value || '').toLowerCase();
  const tone = {
    sale: 'bg-[#dbeafe] text-[#1d4ed8]',
    payment: 'bg-[#dcfce7] text-[#166534]',
    discount: 'bg-[#ffedd5] text-[#c2410c]',
    opening: 'bg-[#f1f5f9] text-[#475569]',
    invoice: 'bg-[#dbeafe] text-[#1d4ed8]',
    receipt: 'bg-[#dcfce7] text-[#166534]',
  }[key] || 'bg-[#f1f5f9] text-[#475569]';
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${tone}`}>{key || '—'}</span>;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function RelationBadge({ value }) {
  const tone = {
    Good: 'bg-[#dcfce7] text-[#166534]',
    Ok: 'bg-[#dbeafe] text-[#1d4ed8]',
    Poor: 'bg-[#ffedd5] text-[#9a3412]',
    Bad: 'bg-[#fee2e2] text-[#991b1b]',
  }[value] || 'bg-[#f1f5f9] text-[#475569]';
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${tone}`}>{value || '—'}</span>;
}

function ModalShell({ title, titleIcon, onClose, children, footer, wide }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#0f172a]/55 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`flex max-h-[96vh] w-full flex-col overflow-hidden rounded-t-[16px] bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-[16px] ${wide ? 'max-w-[640px]' : 'max-w-[560px]'}`}>
        <div className="flex items-center justify-between border-b border-[#edf2f8] px-5 py-3">
          <div className="flex items-center gap-2">
            {titleIcon}
            <h3 className="text-[16px] font-extrabold text-[#111827]">{title}</h3>
          </div>
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

export function CustomerModulePage({ activeSection, onOpenSection, onNotify }) {
  const tab = TABS.some((t) => t.key === activeSection) ? activeSection : 'Customer Details';

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-bold text-[#7a8fa6]">Dashboard / Customer</p>
          <h1 className="font-display text-[20px] font-extrabold text-[#111827] sm:text-[22px]">Customer Management</h1>
        </div>
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
      {tab === 'Customer Details' ? <CustomerDetailsTab onNotify={onNotify} /> : null}
      {tab === 'Customer Ledger' ? <CustomerLedgerTab onNotify={onNotify} onOpenSection={onOpenSection} /> : null}
      {tab === 'Overall Credit Ledger' ? <OverallCreditTab onNotify={onNotify} onOpenSection={onOpenSection} /> : null}
    </div>
  );
}

function CustomerDetailsTab({ onNotify }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await accountsModuleApi.customerDirectory();
      setRows(Array.isArray(data?.results) ? data.results : normalizeApiRows(data));
    } catch (e) {
      onNotify(e.message || 'Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) => {
    const hay = `${r.name} ${r.company} ${r.phone} ${r.address} ${(r.project_labels || []).join(' ')} ${r.gstin}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  const save = async () => {
    if (!modal?.form?.name?.trim() || !modal.form.phone?.trim()) {
      onNotify('Name and mobile number are required', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...modal.form,
        account_type: 'Customer',
        status: 'Active',
        city: modal.form.city || (modal.form.address || '').split(',').pop()?.trim() || '',
      };
      if (modal.id) await accountsModuleApi.parties.update(modal.id, payload);
      else await accountsModuleApi.parties.create(payload);
      onNotify(modal.id ? 'Customer updated' : 'Customer added', 'success');
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
      onNotify('Customer deleted', 'success');
      await load();
    } catch (e) {
      onNotify(e.message || 'Delete failed', 'error');
    }
  };

  return (
    <>
      <div className="rounded-[12px] border border-[#dbeafe] bg-[#f8fbff] px-3 py-2 text-[12px] font-semibold text-[#284276]">
        Mobile number is the customer key. All leads (New / Hot / Warm / Cool / Won / Lost) appear here once per mobile — one customer can have multiple projects (home, office, etc.).
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <input className={`${inputClass} w-full sm:max-w-xs`} placeholder="Search name, mobile, project..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" onClick={() => setModal({ form: { ...emptyForm } })} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] bg-[#dc2626] px-4 text-[13px] font-extrabold text-white sm:w-auto">
          <Plus className="size-4" /> Add Customer
        </button>
        <button
          type="button"
          onClick={() => exportNotifyCsv(onNotify, 'customers', ['Name', 'Company', 'Phone', 'Address', 'GSTIN', 'Projects', 'Leads', 'Balance'], filtered.map((r) => [r.name, r.company, r.phone, r.address, r.gstin, r.projects_count || 0, r.leads_count || 0, r.balance]))}
          className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-extrabold text-[#284276] sm:w-auto"
        >
          <Download className="size-4" /> Export CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-[12px] border border-[#e2e9f3] bg-white">
        <table className="min-w-[980px] text-left text-[13px]">
          <thead className="bg-[#f8fbff] text-[11px] font-extrabold uppercase tracking-wide text-[#7a8fa6]">
            <tr>
              {['Name', 'Company', 'Phone', 'Address', 'GSTIN', 'Projects', 'Relation', 'Balance', 'Actions'].map((h) => (
                <th key={h} className="px-3 py-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-[#7a8fa6]">Loading customers from leads...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-[#7a8fa6]">No customers yet. Add a lead or customer with a mobile number.</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className="border-t border-[#edf2f8]">
                <td className="px-3 py-2.5 font-extrabold text-[#1e3261]">{r.name}</td>
                <td className="px-3 py-2.5">{r.company || '—'}</td>
                <td className="px-3 py-2.5 font-extrabold text-[#0b65e5]">{r.phone || '—'}</td>
                <td className="px-3 py-2.5">{r.address || r.city || '—'}</td>
                <td className="px-3 py-2.5">{r.gstin || '—'}</td>
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setDetail(r)}
                    className="inline-flex items-center gap-1 rounded-full bg-[#eff6ff] px-2.5 py-1 text-[11px] font-extrabold text-[#1d4ed8] hover:bg-[#dbeafe]"
                    title={(r.project_labels || []).join(', ')}
                  >
                    {Number(r.projects_count || r.leads_count || 0)} project{(Number(r.projects_count || r.leads_count || 0) === 1) ? '' : 's'}
                  </button>
                </td>
                <td className="px-3 py-2.5"><RelationBadge value={r.relation} /></td>
                <td className={`px-3 py-2.5 font-extrabold ${Number(r.balance) > 0 ? 'text-[#dc2626]' : 'text-[#166534]'}`}>{fmtRs(r.balance)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setDetail(r)} className="grid size-8 place-items-center rounded-[8px] text-[#0b65e5] hover:bg-[#eff6ff]" title="View projects"><Eye className="size-4" /></button>
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
          title={modal.id ? 'Edit Customer' : 'Add New Customer'}
          onClose={() => setModal(null)}
          footer={(
            <>
              <button type="button" onClick={() => setModal(null)} className="h-10 rounded-[8px] border px-4 text-[13px] font-semibold">Cancel</button>
              <button type="button" disabled={saving} onClick={save} className="h-10 rounded-[8px] bg-[#dc2626] px-4 text-[13px] font-extrabold text-white disabled:opacity-60">{saving ? 'Saving...' : 'Save Customer'}</button>
            </>
          )}
        >
          <div className="grid gap-3">
            <Field label="Name" required><input className={inputClass} value={modal.form.name || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, name: e.target.value } }))} /></Field>
            <Field label="Company"><input className={inputClass} value={modal.form.company || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, company: e.target.value } }))} /></Field>
            <Field label="Mobile (unique key)" required><input className={inputClass} value={modal.form.phone || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, phone: e.target.value } }))} /></Field>
            <p className="text-[11px] font-semibold text-[#7a8fa6]">Same mobile = same customer. Add separate leads/projects for home vs office solar.</p>
            <Field label="Address"><textarea className={`${inputClass} h-20 py-2`} value={modal.form.address || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, address: e.target.value } }))} /></Field>
            <Field label="GSTIN"><input className={inputClass} placeholder="15 character GST number" maxLength={15} value={modal.form.gstin || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, gstin: e.target.value } }))} /></Field>
            <Field label="Opening Balance (₹)"><input type="number" className={inputClass} value={modal.form.opening_balance || '0'} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, opening_balance: e.target.value } }))} /></Field>
            <p className="text-[11px] font-semibold text-[#7a8fa6]">Enter positive value if customer owes you money</p>
            <Field label="Vehicle Number"><input className={inputClass} placeholder="Vehicle Number" value={modal.form.vehicle_number || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, vehicle_number: e.target.value } }))} /></Field>
            <Field label="Credit Limit (₹)"><input type="number" className={inputClass} value={modal.form.credit_limit || '0'} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, credit_limit: e.target.value } }))} /></Field>
            <Field label="Credit Days"><input type="number" className={inputClass} value={modal.form.credit_days || '30'} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, credit_days: e.target.value } }))} /></Field>
          </div>
        </ModalShell>
      ) : null}
      {detail ? (
        <ModalShell
          title={`${detail.name} · ${detail.phone || 'No mobile'}`}
          onClose={() => setDetail(null)}
          footer={<button type="button" onClick={() => setDetail(null)} className="h-10 rounded-[8px] border px-4 text-[13px] font-semibold">Close</button>}
        >
          <div className="space-y-3">
            <p className="text-[12px] font-semibold text-[#53647f]">
              {detail.leads_count || 0} lead(s) · statuses: {(detail.lead_statuses || []).join(', ') || '—'}
            </p>
            {(detail.project_labels || []).length === 0 ? (
              <p className="text-[13px] font-semibold text-[#7a8fa6]">No projects/leads linked to this mobile yet.</p>
            ) : (
              <ul className="space-y-2">
                {detail.project_labels.map((label) => (
                  <li key={label} className="rounded-[10px] border border-[#e2e9f3] bg-[#f8fbff] px-3 py-2 text-[13px] font-bold text-[#1e3261]">
                    {label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}

function CustomerLedgerTab({ onNotify, onOpenSection }) {
  const [customers, setCustomers] = useState([]);
  const [partyId, setPartyId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [q, setQ] = useState('');
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [detail, setDetail] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadCustomers = useCallback(async () => {
    try {
      await accountsModuleApi.syncCustomersFromLeads().catch(() => null);
      const data = await accountsModuleApi.parties.list({ account_type: 'Customer', page_size: 2000 });
      setCustomers(normalizeApiRows(data));
    } catch (e) {
      onNotify(e.message || 'Failed to load customers', 'error');
    }
  }, [onNotify]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

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
      const qs = new URLSearchParams(params).toString();
      setPayload(await accountsModuleApi.partyLedger(partyId, qs));
    } catch (e) {
      onNotify(e.message || 'Failed to load ledger', 'error');
    } finally {
      setLoading(false);
    }
  }, [partyId, start, end, onNotify]);

  useEffect(() => { loadLedger(); }, [loadLedger, reloadKey]);

  const selected = useMemo(
    () => customers.find((c) => String(c.id) === String(partyId)) || payload?.party || null,
    [customers, partyId, payload],
  );

  const entries = useMemo(() => {
    const rows = payload?.results || [];
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((e) => `${e.particulars || ''} ${e.work || ''} ${e.ref || ''} ${e.vehicle_no || ''} ${e.type_label || ''}`.toLowerCase().includes(needle));
  }, [payload, q]);

  const summary = payload?.summary || {
    total_debit: entries.reduce((s, e) => s + Number(e.debit || 0), 0),
    total_credit: entries.reduce((s, e) => s + Number(e.credit || 0), 0),
    credit_15_plus: 0,
    current_balance: entries.length ? Number(entries[entries.length - 1].balance || 0) : 0,
    previous_balance: 0,
    opening: Number(selected?.opening_balance || 0),
  };

  const finalBalance = Number(summary.final_balance ?? summary.current_balance ?? 0);
  const finalIsCredit = finalBalance < 0;

  const refreshAll = async () => {
    await loadCustomers();
    setReloadKey((k) => k + 1);
    onNotify('Ledger refreshed', 'success');
  };

  const fixDuplicates = async () => {
    setFixing(true);
    try {
      const res = await accountsModuleApi.fixCustomerDuplicates();
      const removed = res?.merge?.duplicates_removed ?? 0;
      await loadCustomers();
      setReloadKey((k) => k + 1);
      onNotify(removed ? `Merged ${removed} duplicate customer(s) by mobile` : 'No duplicate mobiles found', 'success');
    } catch (e) {
      onNotify(e.message || 'Fix duplicates failed', 'error');
    } finally {
      setFixing(false);
    }
  };

  const exportCsv = () => {
    if (!entries.length) {
      onNotify('No ledger entries to export', 'error');
      return;
    }
    exportNotifyCsv(
      onNotify,
      `customer-ledger-${selected?.phone || selected?.name || partyId}`,
      ['Date', 'Vehicle No', 'Type', 'Challan/Receipt No', 'Work', 'Debit', 'Credit', 'Balance'],
      entries.map((e) => [e.date, e.vehicle_no, e.type_label || e.type, e.ref, e.work || e.particulars, e.debit, e.credit, e.balance]),
    );
  };

  const savePdf = () => {
    if (!partyId || !entries.length) {
      onNotify('Select a customer with ledger entries to save PDF', 'error');
      return;
    }
    window.print();
  };

  const kpiCards = [
    { label: 'Total Debit (Sales)', value: summary.total_debit, tone: 'bg-[#eff6ff] border-[#bfdbfe] text-[#1d4ed8]', Icon: TrendingUp },
    { label: 'Total Credit (Payments)', value: summary.total_credit, tone: 'bg-[#ecfdf5] border-[#a7f3d0] text-[#047857]', Icon: TrendingDown },
    { label: 'Credit 15+ Days Old', value: summary.credit_15_plus, tone: 'bg-[#fef2f2] border-[#fecaca] text-[#dc2626]', Icon: AlertCircle },
    { label: 'Current Balance', value: summary.current_balance, tone: 'bg-[#f5f3ff] border-[#ddd6fe] text-[#6d28d9]', Icon: Wallet, suffix: Number(summary.current_balance) >= 0 ? ' (Dr)' : ' (Cr)' },
    { label: 'Previous Balance', value: summary.previous_balance, tone: 'bg-[#fff7ed] border-[#fed7aa] text-[#c2410c]', Icon: Wallet },
  ];

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[16px] font-extrabold text-[#111827]">Customer Ledger</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={refreshAll} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#d9e4f2] bg-white px-3 text-[12px] font-extrabold text-[#284276]">
            <RefreshCw className="size-3.5" /> Refresh
          </button>
          <button type="button" disabled={!entries.length} onClick={exportCsv} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#d9e4f2] bg-white px-3 text-[12px] font-extrabold text-[#284276] disabled:opacity-50">
            <Download className="size-3.5" /> CSV
          </button>
          <button type="button" disabled={!entries.length} onClick={savePdf} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#d9e4f2] bg-white px-3 text-[12px] font-extrabold text-[#284276] disabled:opacity-50">
            <FileText className="size-3.5" /> PDF
          </button>
          <button type="button" disabled={fixing} onClick={fixDuplicates} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#fecaca] bg-[#fef2f2] px-3 text-[12px] font-extrabold text-[#dc2626] disabled:opacity-50">
            {fixing ? 'Fixing...' : 'Fix Duplicates'}
          </button>
          <button type="button" onClick={() => onOpenSection?.('Customer Details')} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#dc2626] px-3 text-[12px] font-extrabold text-white">
            <Plus className="size-3.5" /> Add Customer
          </button>
        </div>
      </div>

      <div className="rounded-[14px] border border-[#e2e9f3] bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Select Customer *">
            <select className={inputClass} value={partyId} onChange={(e) => setPartyId(e.target.value)}>
              <option value="">Choose a customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] font-semibold text-[#0b65e5]">Only customers linked from invoices & payment receipts are shown.</p>
          </Field>
          <Field label="Start Date"><input type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="End Date"><input type="date" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          <Field label="Search"><input className={inputClass} placeholder="Search entries..." value={q} onChange={(e) => setQ(e.target.value)} /></Field>
        </div>
      </div>

      {!partyId ? (
        <div className="rounded-[14px] border border-[#e2e9f3] bg-white p-4 shadow-sm">
          <h3 className="text-[15px] font-extrabold text-[#111827]">Ledger Entries</h3>
          <p className="py-12 text-center text-[13px] font-semibold text-[#7a8fa6]">Please select a customer to view ledger</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {kpiCards.map(({ label, value, tone, Icon, suffix }) => (
              <article key={label} className={`rounded-[14px] border p-4 ${tone}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-bold opacity-80">{label}</p>
                  <Icon className="size-4 opacity-70" />
                </div>
                <p className="mt-2 text-[22px] font-extrabold tracking-tight">
                  {fmtCompact(value)}{suffix || ''}
                </p>
              </article>
            ))}
          </div>

          <div className="rounded-[14px] border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-[13px]">
              <p><span className="font-bold text-[#64748b]">Customer Name:</span> <span className="font-extrabold text-[#1e3261]">{selected?.name || '—'}</span></p>
              <p><span className="font-bold text-[#64748b]">Phone:</span> <span className="font-extrabold text-[#1e3261]">{selected?.phone || '—'}</span></p>
              <p><span className="font-bold text-[#64748b]">Email:</span> <span className="font-extrabold text-[#1e3261]">{selected?.email || 'N/A'}</span></p>
              <p><span className="font-bold text-[#64748b]">Opening Balance:</span> <span className="font-extrabold text-[#1e3261]">{fmtRs(selected?.opening_balance || summary.opening || 0)}</span></p>
            </div>
          </div>

          <div className="rounded-[14px] border border-[#e2e9f3] bg-white p-4 shadow-sm print:shadow-none">
            <h3 className="mb-3 text-[15px] font-extrabold text-[#111827]">Ledger Entries</h3>
            {loading ? (
              <p className="py-10 text-center text-[13px] font-semibold text-[#7a8fa6]">Loading...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[1100px] w-full text-left text-[13px]">
                  <thead className="bg-[#f1f5f9] text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">
                    <tr>
                      {['Date', 'Vehicle No', 'Type', 'Challan/Receipt No.', 'Work', 'Debit (₹)', 'Credit (₹)', 'Balance (₹)', 'Action'].map((h) => (
                        <th key={h} className="px-3 py-2.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {entries.length === 0 ? (
                      <tr><td colSpan={9} className="px-3 py-10 text-center text-[#7a8fa6]">No ledger entries for this customer.</td></tr>
                    ) : entries.map((e, i) => {
                      const bal = Number(e.balance || 0);
                      return (
                        <tr key={`${e.ref}-${i}`} className={`border-t border-[#edf2f8] ${i % 2 ? 'bg-[#f8fafc]' : 'bg-white'}`}>
                          <td className="px-3 py-2.5 whitespace-nowrap">{fmtDisplayDate(e.date)}</td>
                          <td className="px-3 py-2.5">{e.vehicle_no || '—'}</td>
                          <td className="px-3 py-2.5"><TypeBadge value={e.type_label || e.type} /></td>
                          <td className="px-3 py-2.5 font-semibold text-[#334155]">{e.ref || '—'}</td>
                          <td className="max-w-[260px] truncate px-3 py-2.5" title={e.work || e.particulars || ''}>{e.work || e.particulars || '—'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{e.debit ? fmtRs(e.debit) : '—'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{e.credit ? fmtRs(e.credit) : '—'}</td>
                          <td className={`px-3 py-2.5 whitespace-nowrap font-extrabold ${bal > 0 ? 'text-[#dc2626]' : 'text-[#166534]'}`}>{fmtRs(bal)}</td>
                          <td className="px-3 py-2.5">
                            <button type="button" onClick={() => setDetail(e)} className="grid size-8 place-items-center rounded-[8px] text-[#0b65e5] hover:bg-[#eff6ff]" title="View entry">
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
                        <td className="px-3 py-3" colSpan={5}>Totals:</td>
                        <td className="px-3 py-3 whitespace-nowrap">{fmtRs(summary.total_debit)}</td>
                        <td className="px-3 py-3 whitespace-nowrap">{fmtRs(summary.total_credit)}</td>
                        <td className={`px-3 py-3 whitespace-nowrap ${finalIsCredit ? 'text-[#166534]' : 'text-[#dc2626]'}`}>
                          {fmtRs(Math.abs(finalBalance))} ({finalIsCredit ? 'Cr' : 'Dr'})
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {detail ? (
        <ModalShell
          title="Ledger Entry"
          onClose={() => setDetail(null)}
          footer={<button type="button" onClick={() => setDetail(null)} className="h-10 rounded-[8px] border px-4 text-[13px] font-semibold">Close</button>}
        >
          <div className="grid gap-2 text-[13px]">
            <p><span className="font-bold text-[#64748b]">Date:</span> {fmtDisplayDate(detail.date)}</p>
            <p><span className="font-bold text-[#64748b]">Type:</span> <TypeBadge value={detail.type_label || detail.type} /></p>
            <p><span className="font-bold text-[#64748b]">Ref:</span> {detail.ref || '—'}</p>
            <p><span className="font-bold text-[#64748b]">Vehicle:</span> {detail.vehicle_no || '—'}</p>
            <p><span className="font-bold text-[#64748b]">Work:</span> {detail.work || detail.particulars || '—'}</p>
            <p><span className="font-bold text-[#64748b]">Debit:</span> {detail.debit ? fmtRs(detail.debit) : '—'}</p>
            <p><span className="font-bold text-[#64748b]">Credit:</span> {detail.credit ? fmtRs(detail.credit) : '—'}</p>
            <p><span className="font-bold text-[#64748b]">Balance:</span> {fmtRs(detail.balance)}</p>
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}

function OverallCreditTab({ onNotify, onOpenSection }) {
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [settle, setSettle] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await accountsModuleApi.creditLedger());
    } catch (e) {
      onNotify(e.message || 'Failed to load credit ledger', 'error');
    }
  }, [onNotify]);

  useEffect(() => { load(); }, [load]);

  const rows = (data?.results || []).filter((r) => `${r.name} ${r.phone} ${r.company}`.toLowerCase().includes(q.trim().toLowerCase()));

  const saveSettle = async () => {
    const amount = Number(settle.amount || 0);
    if (amount <= 0) {
      onNotify('Enter settlement amount', 'error');
      return;
    }
    setSaving(true);
    try {
      await accountsModuleApi.settleParty(settle.id, {
        amount,
        payment_date: settle.payment_date || todayIso(),
        payment_mode: settle.payment_mode || 'Cash',
        remarks: settle.remarks || '',
      });
      onNotify('Settlement saved', 'success');
      setSettle(null);
      await load();
    } catch (e) {
      onNotify(e.message || 'Settlement failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const cards = [
    { label: 'Opening Balance', value: data?.opening_balance, tone: 'text-[#111827]' },
    { label: 'Total Debit', value: data?.total_debit, tone: 'text-[#dc2626]' },
    { label: 'Total Credit', value: data?.total_credit, tone: 'text-[#16a34a]' },
    { label: 'Net Balance', value: data?.net_balance, tone: Number(data?.net_balance) > 0 ? 'text-[#dc2626]' : 'text-[#16a34a]' },
  ];

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[16px] font-extrabold text-[#111827]">Overall Credit Ledger</h2>
        <button
          type="button"
          onClick={() => onOpenSection?.('Customer Details')}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[8px] bg-[#dc2626] px-4 text-[13px] font-extrabold text-white"
        >
          <Plus className="size-4" /> Add Customer
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map(({ label, value, tone }) => (
          <article key={label} className="rounded-[14px] border border-[#e2e9f3] bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#7a8fa6]">{label}</p>
            <p className={`mt-2 text-[20px] font-extrabold ${tone}`}>{fmtRs(value)}</p>
          </article>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-[14px] border border-[#e2e9f3] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
          <input
            className={`${inputClass} pl-9`}
            placeholder="Search customer, phone, company..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => exportNotifyCsv(onNotify, 'credit-ledger', ['Name', 'Company', 'Phone', 'Yearly', 'Relation', 'Debit', 'Credit', 'Net', 'Last Date'], rows.map((r) => [r.name, r.company, r.phone, r.yearly_transaction, r.relation, r.debit, r.credit, r.net, r.last_date]))}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-extrabold text-[#284276]"
        >
          <Download className="size-4" /> Export Excel
        </button>
      </div>

      <div className="overflow-auto rounded-[14px] border border-[#e2e9f3] bg-white shadow-sm">
        <table className="min-w-[1100px] w-full text-left text-[13px]">
          <thead className="bg-[#f1f5f9] text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">
            <tr>
              {['Name', 'Company', 'Phone', 'Yearly Transaction', 'Relation', 'Debit', 'Credit', 'Net Balance', 'Last Date', 'Action'].map((h) => (
                <th key={h} className="px-3 py-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <tr><td colSpan={10} className="px-3 py-10 text-center text-[#7a8fa6]">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-10 text-center text-[#7a8fa6]">No customer balances yet.</td></tr>
            ) : rows.map((r, idx) => (
              <tr key={r.id} className={`border-t border-[#edf2f8] ${idx % 2 ? 'bg-[#f8fafc]' : 'bg-white'}`}>
                <td className="px-3 py-2.5 font-extrabold text-[#111827]">{r.name}</td>
                <td className="px-3 py-2.5 text-[#334155]">{r.company || '—'}</td>
                <td className="px-3 py-2.5 text-[#334155]">{r.phone || '—'}</td>
                <td className="px-3 py-2.5 text-[#334155]">{fmtRs(r.yearly_transaction)}</td>
                <td className="px-3 py-2.5 font-semibold text-[#111827]">{r.relation || '—'}</td>
                <td className="px-3 py-2.5 font-extrabold text-[#dc2626]">{fmtRs(r.debit)}</td>
                <td className="px-3 py-2.5 font-extrabold text-[#16a34a]">{fmtRs(r.credit)}</td>
                <td className={`px-3 py-2.5 font-extrabold ${Number(r.net) > 0 ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{fmtRs(r.net)}</td>
                <td className="px-3 py-2.5 text-[#334155]">{fmtDisplayDate(r.last_date)}</td>
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setSettle({
                      id: r.id,
                      name: r.name,
                      phone: r.phone,
                      net: Number(r.net || 0),
                      amount: String(Number(r.net) > 0 ? Number(r.net) : 0),
                      payment_date: todayIso(),
                      payment_mode: 'Cash',
                      remarks: '',
                    })}
                    className="inline-flex h-8 items-center gap-1 rounded-[8px] bg-[#dc2626] px-3 text-[12px] font-extrabold text-white"
                  >
                    <IndianRupee className="size-3.5" /> Settle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {settle ? (
        <ModalShell
          wide
          title="Settlement Payment"
          titleIcon={(
            <span className="grid size-8 place-items-center rounded-full bg-[#fef2f2] text-[#dc2626]">
              <IndianRupee className="size-4" />
            </span>
          )}
          onClose={() => setSettle(null)}
          footer={(
            <>
              <button type="button" onClick={() => setSettle(null)} className="h-11 min-w-[110px] rounded-[10px] border border-[#d9e4f2] px-5 text-[13px] font-extrabold text-[#53647f]">Cancel</button>
              <button type="button" disabled={saving} onClick={saveSettle} className="h-11 min-w-[140px] rounded-[10px] bg-[#dc2626] px-5 text-[13px] font-extrabold text-white disabled:opacity-60">{saving ? 'Saving...' : 'Save Payment'}</button>
            </>
          )}
        >
          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-[12px] border border-[#e8eef6] bg-[#f8fafc] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#94a3b8]">Customer</p>
                <p className="mt-0.5 text-[16px] font-extrabold text-[#111827]">{settle.name}</p>
                <p className="text-[12px] font-semibold text-[#64748b]">{settle.phone || '—'}</p>
              </div>
              <div className="rounded-[10px] border border-[#e2e8f0] bg-white px-4 py-2 text-right">
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#94a3b8]">Net Balance</p>
                <p className={`text-[16px] font-extrabold ${settle.net > 0 ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{fmtRs(Math.abs(settle.net))}</p>
                <p className={`text-[11px] font-bold ${settle.net > 0 ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>
                  {settle.net > 0 ? 'Debit (Dr)' : settle.net < 0 ? 'Credit (Cr)' : 'Settled'}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[12px] border border-[#e8eef6] bg-white p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#94a3b8]">Outstanding Balance</p>
                <p className={`mt-2 text-[22px] font-extrabold ${settle.net > 0 ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{fmtRs(Math.abs(settle.net))}</p>
                <p className="mt-1 text-[11px] italic text-[#94a3b8]">Read-only</p>
              </div>
              <div>
                <label className="grid gap-1 text-[10px] font-extrabold uppercase tracking-wide text-[#94a3b8]">
                  Settlement Amount <span className="text-[#dc2626]">*</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-bold text-[#64748b]">₹</span>
                    <input
                      type="number"
                      className="h-11 w-full rounded-[10px] border border-[#fca5a5] bg-white pl-8 pr-3 text-[14px] font-extrabold text-[#111827] outline-none focus:border-[#dc2626]"
                      value={settle.amount}
                      onChange={(e) => setSettle((s) => ({ ...s, amount: e.target.value }))}
                    />
                  </div>
                </label>
                <button
                  type="button"
                  className="mt-1.5 text-[12px] font-extrabold text-[#dc2626]"
                  onClick={() => setSettle((s) => ({ ...s, amount: String(s.net > 0 ? s.net : 0) }))}
                >
                  Use full balance
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-[10px] font-extrabold uppercase tracking-wide text-[#94a3b8]">
                Payment Date <span className="text-[#dc2626]">*</span>
                <input
                  type="date"
                  className="h-11 w-full rounded-[10px] border border-[#d9e4f2] px-3 text-[13px] font-semibold text-[#1e3261] outline-none"
                  value={settle.payment_date}
                  onChange={(e) => setSettle((s) => ({ ...s, payment_date: e.target.value }))}
                />
              </label>
              <label className="grid gap-1 text-[10px] font-extrabold uppercase tracking-wide text-[#94a3b8]">
                Payment Mode
                <select
                  className="h-11 w-full rounded-[10px] border border-[#d9e4f2] px-3 text-[13px] font-semibold text-[#1e3261] outline-none"
                  value={settle.payment_mode}
                  onChange={(e) => setSettle((s) => ({ ...s, payment_mode: e.target.value }))}
                >
                  {['Cash', 'UPI', 'NEFT', 'RTGS', 'Cheque', 'Other'].map((m) => <option key={m}>{m}</option>)}
                </select>
              </label>
            </div>

            <label className="grid gap-1 text-[10px] font-extrabold uppercase tracking-wide text-[#94a3b8]">
              Remarks / Notes
              <textarea
                className="min-h-[88px] w-full rounded-[10px] border border-[#d9e4f2] px-3 py-2 text-[13px] font-semibold text-[#1e3261] outline-none"
                placeholder="Optional note..."
                value={settle.remarks}
                onChange={(e) => setSettle((s) => ({ ...s, remarks: e.target.value }))}
              />
            </label>
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}
