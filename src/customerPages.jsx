import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Eye, Pencil, Plus, Trash2, X } from 'lucide-react';
import { accountsModuleApi, leadApi } from './api.js';
import { exportNotifyCsv, normalizeApiRows } from './lib/utils.js';

const TABS = [
  { key: 'Customer Details', label: 'Customer Details' },
  { key: 'Customer Leads', label: 'Leads' },
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

const LEAD_STATUS_FILTERS = ['All', 'Urgent', 'Hot', 'Warm', 'Cool', 'Won', 'Lost'];

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '').slice(-10);
}

function matchesCustomerLeadFilter(lead, filter) {
  const status = lead.status || '';
  if (filter === 'All') return true;
  if (filter === 'Won') return status === 'Won';
  if (filter === 'Lost') return status === 'Lost';
  if (status === 'Won' || status === 'Lost') return false;
  if (filter === 'Urgent') return lead.priority === 'High';
  if (filter === 'Hot') return lead.category === 'Hot';
  if (filter === 'Warm') return lead.category === 'Warm';
  if (filter === 'Cool') return lead.category === 'Cool';
  return true;
}

export function CustomerModulePage({ activeSection, onOpenSection, onNotify, onViewLead, onCreateLead, leadRefreshKey = 0 }) {
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
      {tab === 'Customer Leads' ? <CustomerLeadsTab onNotify={onNotify} onViewLead={onViewLead} onCreateLead={onCreateLead} refreshKey={leadRefreshKey} /> : null}
      {tab === 'Customer Ledger' ? <CustomerLedgerTab onNotify={onNotify} /> : null}
      {tab === 'Overall Credit Ledger' ? <OverallCreditTab onNotify={onNotify} /> : null}
    </div>
  );
}

function CustomerDetailsTab({ onNotify }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await accountsModuleApi.parties.list({ account_type: 'Customer', page_size: 2000 });
      setRows(normalizeApiRows(data));
    } catch (e) {
      onNotify(e.message || 'Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) => {
    const hay = `${r.name} ${r.company} ${r.phone} ${r.address} ${r.gstin}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  const save = async () => {
    if (!modal?.form?.name?.trim() || !modal.form.phone?.trim()) {
      onNotify('Name and phone are required', 'error');
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
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <input className={`${inputClass} w-full sm:max-w-xs`} placeholder="Search customer..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" onClick={() => setModal({ form: { ...emptyForm } })} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] bg-[#dc2626] px-4 text-[13px] font-extrabold text-white sm:w-auto">
          <Plus className="size-4" /> Add Customer
        </button>
        <button
          type="button"
          onClick={() => exportNotifyCsv(onNotify, 'customers', ['Name', 'Company', 'Phone', 'Address', 'GSTIN', 'Balance'], filtered.map((r) => [r.name, r.company, r.phone, r.address, r.gstin, r.balance]))}
          className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-extrabold text-[#284276] sm:w-auto"
        >
          <Download className="size-4" /> Export CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-[12px] border border-[#e2e9f3] bg-white">
        <table className="min-w-[820px] text-left text-[13px]">
          <thead className="bg-[#f8fbff] text-[11px] font-extrabold uppercase tracking-wide text-[#7a8fa6]">
            <tr>
              {['Name', 'Company', 'Phone', 'Address', 'GSTIN', 'Relation', 'Balance', 'Actions'].map((h) => (
                <th key={h} className="px-3 py-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-[#7a8fa6]">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-[#7a8fa6]">No customers yet. Add your first customer.</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className="border-t border-[#edf2f8]">
                <td className="px-3 py-2.5 font-extrabold text-[#1e3261]">{r.name}</td>
                <td className="px-3 py-2.5">{r.company || '—'}</td>
                <td className="px-3 py-2.5">{r.phone || '—'}</td>
                <td className="px-3 py-2.5">{r.address || r.city || '—'}</td>
                <td className="px-3 py-2.5">{r.gstin || '—'}</td>
                <td className="px-3 py-2.5"><RelationBadge value={r.relation} /></td>
                <td className={`px-3 py-2.5 font-extrabold ${Number(r.balance) > 0 ? 'text-[#dc2626]' : 'text-[#166534]'}`}>{fmtRs(r.balance)}</td>
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
            <Field label="Phone" required><input className={inputClass} value={modal.form.phone || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, phone: e.target.value } }))} /></Field>
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
    </>
  );
}

function CustomerLeadsTab({ onNotify, onViewLead, onCreateLead, refreshKey = 0 }) {
  const [rows, setRows] = useState([]);
  const [vehicleByPhone, setVehicleByPhone] = useState({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [leadData, customerData] = await Promise.all([
        leadApi.list({ page_size: 2000 }),
        accountsModuleApi.parties.list({ account_type: 'Customer', page_size: 2000 }).catch(() => []),
      ]);
      setRows(normalizeApiRows(leadData));
      const map = {};
      normalizeApiRows(customerData).forEach((customer) => {
        const key = normalizePhone(customer.phone);
        if (key && customer.vehicle_number) map[key] = customer.vehicle_number;
      });
      setVehicleByPhone(map);
    } catch (e) {
      onNotify(e.message || 'Failed to load leads', 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const counts = useMemo(() => {
    const tally = Object.fromEntries(LEAD_STATUS_FILTERS.map((key) => [key, 0]));
    rows.forEach((lead) => {
      LEAD_STATUS_FILTERS.forEach((filter) => {
        if (matchesCustomerLeadFilter(lead, filter)) tally[filter] += 1;
      });
    });
    return tally;
  }, [rows]);

  const filtered = useMemo(() => (
    rows.filter((lead) => matchesCustomerLeadFilter(lead, statusFilter))
  ), [rows, statusFilter]);

  const remove = async (row) => {
    if (!window.confirm(`Delete lead "${row.customer_name}"?`)) return;
    try {
      await leadApi.delete(row.id);
      onNotify('Lead deleted', 'success');
      await load();
    } catch (e) {
      onNotify(e.message || 'Delete failed', 'error');
    }
  };

  const emptyLabel = statusFilter === 'All' ? 'No leads.' : `No ${statusFilter} leads.`;

  return (
    <>
      <div className="flex">
        <button
          type="button"
          onClick={() => onCreateLead?.()}
          className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] bg-[#dc2626] px-4 text-[13px] font-extrabold text-white sm:w-auto"
        >
          <Plus className="size-4" /> Add Lead
        </button>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {LEAD_STATUS_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setStatusFilter(filter)}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-extrabold transition ${
              statusFilter === filter
                ? 'border-[#dc2626] bg-[#fef2f2] text-[#dc2626]'
                : 'border-[#e2e9f3] bg-white text-[#53647f] hover:border-[#cbd5e1]'
            }`}
          >
            {filter}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${statusFilter === filter ? 'bg-[#fee2e2] text-[#dc2626]' : 'bg-[#f1f5f9] text-[#64748b]'}`}>
              {counts[filter] ?? 0}
            </span>
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-[12px] border border-[#e2e9f3] bg-white">
        <table className="min-w-[920px] text-left text-[13px]">
          <thead className="bg-[#f8fbff] text-[11px] font-extrabold uppercase tracking-wide text-[#7a8fa6]">
            <tr>
              {['Name', 'Company', 'Phone', 'Email', 'Source', 'Vehicles', 'Notes', 'Actions'].map((h) => (
                <th key={h} className="px-3 py-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-[#7a8fa6]">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-[#7a8fa6]">{emptyLabel}</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className="border-t border-[#edf2f8] hover:bg-[#f8fbff]">
                <td className="px-3 py-2.5 font-extrabold text-[#1e3261]">{r.customer_name || '—'}</td>
                <td className="px-3 py-2.5">{r.project_name || '—'}</td>
                <td className="px-3 py-2.5">{r.mobile_number || '—'}</td>
                <td className="px-3 py-2.5">{r.email || '—'}</td>
                <td className="px-3 py-2.5">{r.source || '—'}</td>
                <td className="px-3 py-2.5">{vehicleByPhone[normalizePhone(r.mobile_number)] || '—'}</td>
                <td className="max-w-[220px] truncate px-3 py-2.5" title={r.remarks || ''}>{r.remarks || '—'}</td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    <button type="button" onClick={() => onViewLead?.(r)} className="grid size-8 place-items-center rounded-[8px] text-[#0b65e5] hover:bg-[#eff6ff]" title="View lead"><Eye className="size-4" /></button>
                    <button type="button" onClick={() => remove(r)} className="grid size-8 place-items-center rounded-[8px] text-[#dc2626] hover:bg-[#fef2f2]" title="Delete lead"><Trash2 className="size-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CustomerLedgerTab({ onNotify }) {
  const [customers, setCustomers] = useState([]);
  const [partyId, setPartyId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [q, setQ] = useState('');
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    accountsModuleApi.parties.list({ account_type: 'Customer', page_size: 2000 })
      .then((data) => setCustomers(normalizeApiRows(data)))
      .catch((e) => onNotify(e.message || 'Failed to load customers', 'error'));
  }, [onNotify]);

  useEffect(() => {
    if (!partyId) { setPayload(null); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params = {};
        if (start) params.start = start;
        if (end) params.end = end;
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
  }, [partyId, start, end, onNotify]);

  const entries = (payload?.results || []).filter((e) => `${e.particulars} ${e.ref}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Select Customer">
          <select className={inputClass} value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            <option value="">Choose a customer</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>)}
          </select>
        </Field>
        <Field label="Start Date"><input type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="End Date"><input type="date" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        <Field label="Search"><input className={inputClass} placeholder="Search entries..." value={q} onChange={(e) => setQ(e.target.value)} /></Field>
      </div>
      <p className="text-[11px] font-semibold text-[#7a8fa6]">Customers with invoices, receipts, or an opening balance are shown.</p>
      <div className="rounded-[12px] border border-[#e2e9f3] bg-white p-4">
        <h3 className="text-[15px] font-extrabold text-[#111827]">Ledger Entries</h3>
        {!partyId ? (
          <p className="py-10 text-center text-[13px] font-semibold text-[#7a8fa6]">Please select a customer to view ledger.</p>
        ) : loading ? (
          <p className="py-10 text-center text-[13px] font-semibold text-[#7a8fa6]">Loading...</p>
        ) : (
          <div className="mt-3 overflow-auto">
            <table className="min-w-full text-left text-[13px]">
              <thead className="bg-[#f8fbff] text-[11px] font-extrabold uppercase text-[#7a8fa6]">
                <tr>{['Date', 'Particulars', 'Ref', 'Debit', 'Credit', 'Balance'].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-[#7a8fa6]">No ledger entries for this customer.</td></tr>
                ) : entries.map((e, i) => (
                  <tr key={`${e.ref}-${i}`} className="border-t border-[#edf2f8]">
                    <td className="px-3 py-2">{e.date || '—'}</td>
                    <td className="px-3 py-2">{e.particulars}</td>
                    <td className="px-3 py-2">{e.ref}</td>
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
    </>
  );
}

function OverallCreditTab({ onNotify }) {
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
    ['Opening Balance', data?.opening_balance],
    ['Total Debit', data?.total_debit],
    ['Total Credit', data?.total_credit],
    ['Net Balance', data?.net_balance],
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <article key={label} className="rounded-[12px] border border-[#e2e9f3] bg-white p-4">
            <p className="text-[11px] font-bold text-[#7a8fa6]">{label}</p>
            <p className={`mt-1 text-[18px] font-extrabold ${label === 'Net Balance' && Number(value) > 0 ? 'text-[#dc2626]' : 'text-[#1e3261]'}`}>{fmtRs(value)}</p>
          </article>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <input className={`${inputClass} max-w-sm`} placeholder="Search customer, phone, company..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button
          type="button"
          onClick={() => exportNotifyCsv(onNotify, 'credit-ledger', ['Name', 'Phone', 'Yearly', 'Relation', 'Debit', 'Credit', 'Net', 'Last Date'], rows.map((r) => [r.name, r.phone, r.yearly_transaction, r.relation, r.debit, r.credit, r.net, r.last_date]))}
          className="inline-flex h-10 items-center gap-1.5 rounded-[8px] border px-4 text-[13px] font-extrabold"
        >
          <Download className="size-4" /> Export Excel
        </button>
      </div>
      <div className="overflow-auto rounded-[12px] border border-[#e2e9f3] bg-white">
        <table className="min-w-full text-left text-[13px]">
          <thead className="bg-[#f8fbff] text-[11px] font-extrabold uppercase text-[#7a8fa6]">
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
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-[#edf2f8]">
                <td className="px-3 py-2.5 font-extrabold text-[#1e3261]">{r.name}</td>
                <td className="px-3 py-2.5">{r.company || '—'}</td>
                <td className="px-3 py-2.5">{r.phone || '—'}</td>
                <td className="px-3 py-2.5">{fmtRs(r.yearly_transaction)}</td>
                <td className="px-3 py-2.5"><RelationBadge value={r.relation} /></td>
                <td className="px-3 py-2.5">{fmtRs(r.debit)}</td>
                <td className="px-3 py-2.5">{fmtRs(r.credit)}</td>
                <td className={`px-3 py-2.5 font-extrabold ${Number(r.net) > 0 ? 'text-[#dc2626]' : 'text-[#166534]'}`}>{fmtRs(r.net)}</td>
                <td className="px-3 py-2.5">{r.last_date || '—'}</td>
                <td className="px-3 py-2.5">
                  <button type="button" onClick={() => setSettle({ id: r.id, name: r.name, phone: r.phone, net: r.net, amount: String(r.net > 0 ? r.net : 0), payment_date: todayIso(), payment_mode: 'Cash', remarks: '' })} className="h-8 rounded-[8px] bg-[#dc2626] px-3 text-[12px] font-extrabold text-white">Settle</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {settle ? (
        <ModalShell
          title="Settlement Payment"
          onClose={() => setSettle(null)}
          footer={(
            <>
              <button type="button" onClick={() => setSettle(null)} className="h-10 rounded-[8px] border px-4 text-[13px] font-semibold">Cancel</button>
              <button type="button" disabled={saving} onClick={saveSettle} className="h-10 rounded-[8px] bg-[#dc2626] px-4 text-[13px] font-extrabold text-white disabled:opacity-60">{saving ? 'Saving...' : 'Save Payment'}</button>
            </>
          )}
        >
          <p className="mb-3 text-[13px] font-semibold text-[#53647f]">{settle.name} · {settle.phone || '—'} · {fmtRs(settle.net)} (Debit)</p>
          <div className="grid gap-3">
            <Field label="Outstanding Balance"><input className={inputClass} readOnly value={fmtRs(settle.net)} /></Field>
            <Field label="Settlement Amount" required>
              <input type="number" className={inputClass} value={settle.amount} onChange={(e) => setSettle((s) => ({ ...s, amount: e.target.value }))} />
            </Field>
            <button type="button" className="text-left text-[12px] font-bold text-[#dc2626]" onClick={() => setSettle((s) => ({ ...s, amount: String(s.net > 0 ? s.net : 0) }))}>Use full balance</button>
            <Field label="Payment Date"><input type="date" className={inputClass} value={settle.payment_date} onChange={(e) => setSettle((s) => ({ ...s, payment_date: e.target.value }))} /></Field>
            <Field label="Payment Mode">
              <select className={inputClass} value={settle.payment_mode} onChange={(e) => setSettle((s) => ({ ...s, payment_mode: e.target.value }))}>
                {['Cash', 'UPI', 'NEFT', 'RTGS', 'Cheque', 'Other'].map((m) => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Remarks / Notes"><textarea className={`${inputClass} h-20 py-2`} value={settle.remarks} onChange={(e) => setSettle((s) => ({ ...s, remarks: e.target.value }))} /></Field>
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}
