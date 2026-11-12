import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, CreditCard, Download, Eye, FileText, IndianRupee, Mail, Pencil, Phone, Plus, RefreshCw, Search, Trash2, TrendingDown, TrendingUp, Wallet, X } from 'lucide-react';
import { accountsModuleApi } from './api.js';
import { exportNotifyCsv, normalizeApiRows } from './lib/utils.js';
import { moduleCaps } from './settingsHubPages.jsx';
import { MobileCardEmpty, MobileCardList, MobileRecordCard } from './components/mobile/MobileRecordCard.jsx';
import { LedgerMobileCards } from './components/mobile/LedgerMobileCards.jsx';
import { MobileSubnavSelect } from './components/mobile/MobileSubnavSelect.jsx';
import { TablePagination, usePagedRows } from './components/TablePagination.jsx';
import { CustomerMergeWizard, CustomerProfileModal, ProjectCustomerReconciliationPanel } from './customerMasterHub.jsx';

function telHref(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `tel:${digits}` : null;
}

function balanceTone(value) {
  return Number(value) > 0 ? 'danger' : 'success';
}

const TABS = [
  { key: 'Customer Details', label: 'All Client Detail' },
  { key: 'Customer Ledger', label: 'Client Ledger' },
  { key: 'Overall Credit Ledger', label: 'Overall Credit Ledger' },
  { key: 'Customer Merge', label: 'Merge Wizard' },
  { key: 'Project Reconciliation', label: 'Project Reconciliation' },
];

const emptyForm = {
  name: '',
  company: '',
  phone: '',
  alternate_phone: '',
  email: '',
  address: '',
  gstin: '',
  opening_balance: '0',
  vehicle_number: '',
  credit_limit: '0',
  credit_days: '30',
  relation: '',
  city: '',
  state: '',
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

const LEDGER_TYPE_LABELS = {
  sale: 'Sale',
  payment: 'Payment Received',
  discount: 'Discount',
  opening: 'Opening',
  invoice: 'Sale',
  receipt: 'Payment Received',
};

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
  const label = LEDGER_TYPE_LABELS[key] || (key ? String(value) : '—');
  return <span className={`inline-flex rounded-full border border-black/5 px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide ${tone}`}>{label}</span>;
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

function ModalShell({ title, titleIcon, onClose, children, footer, wide, headerTone = 'default' }) {
  const headerClass = headerTone === 'blue'
    ? 'border-b border-[#1d4ed8] bg-[#0b65e5] text-white'
    : 'border-b border-[#edf2f8] bg-white text-[#111827]';
  const closeClass = headerTone === 'blue'
    ? 'text-white/80 hover:bg-white/15 hover:text-white'
    : 'text-[#7585a2] hover:bg-[#f4f7fb]';
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#0f172a]/55 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`flex max-h-[96vh] w-full flex-col overflow-hidden rounded-t-[16px] bg-white shadow-[0_24px_64px_rgba(15,23,42,0.28)] sm:max-h-[90vh] sm:rounded-[16px] ${wide ? 'max-w-[720px]' : 'max-w-[560px]'}`}>
        <div className={`flex items-center justify-between px-5 py-3.5 ${headerClass}`}>
          <div className="flex items-center gap-2">
            {titleIcon}
            <h3 className="text-[16px] font-extrabold tracking-wide">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className={`grid size-9 place-items-center rounded-full ${closeClass}`}><X className="size-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-[#edf2f8] bg-[#f8fbff] px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="grid gap-1.5 text-[12px] font-bold text-[#53647f]">
      <span>{label}{required ? <span className="text-[#dc2626]"> *</span> : ''}</span>
      {children}
    </label>
  );
}

function LedgerSectionCard({ step, title, children, action, tone = 'blue' }) {
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

function LedgerStatCard({ label, value, Icon, tone = 'blue' }) {
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
      <p className="mt-2 text-[20px] font-extrabold tracking-tight">{value}</p>
    </article>
  );
}

const inputClass = 'h-11 w-full rounded-[10px] border border-[#d9e4f2] bg-white px-3 text-[13px] font-semibold text-[#1e3261] outline-none transition focus:border-[#0b65e5] focus:ring-4 focus:ring-[#dbeafe]';
const softBtnClass = 'inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[#d9e4f2] bg-white px-3 text-[12px] font-extrabold text-[#284276] transition hover:bg-[#f8fbff] disabled:opacity-50';
const primaryBtnClass = 'inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-[#0b65e5] px-4 text-[12px] font-extrabold text-white shadow-[0_8px_18px_rgba(11,101,229,0.25)] transition hover:bg-[#0954c2] disabled:opacity-50';
function customerOptionLabel(c) {
  if (!c) return '';
  return `${c.name || '—'}${c.phone ? ` (${c.phone})` : ''}`;
}

/** Searchable customer picker for ledger filters / Add New Ledger modal. */
function CustomerSearchSelect({ customers, value, onChange, placeholder = 'Choose a customer', disabled = false }) {
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
    if (!needle) return customers;
    return customers.filter((c) => {
      const hay = `${c.name || ''} ${c.phone || ''} ${c.company || ''}`.toLowerCase();
      return hay.includes(needle);
    });
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
          {selected ? customerOptionLabel(selected) : placeholder}
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
                placeholder="Search name or phone..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className="flex w-full px-3 py-2 text-left text-[12px] font-semibold text-[#8a98af] hover:bg-[#f5f9ff]"
            >
              {placeholder}
            </button>
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-[12px] font-semibold text-[#8a98af]">No customer matched</p>
            ) : filtered.map((c) => {
              const active = String(c.id) === String(value);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onChange(String(c.id)); setOpen(false); }}
                  className={`flex w-full px-3 py-2 text-left text-[12px] font-semibold hover:bg-[#f5f9ff] ${active ? 'bg-[#eff6ff] text-[#0b65e5]' : 'text-[#1e3261]'}`}
                >
                  {customerOptionLabel(c)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CustomerModulePage({ activeSection, onOpenSection, onNotify, loggedInUser = null }) {
  const caps = moduleCaps(loggedInUser, 'Customer');
  const tab = TABS.some((t) => t.key === activeSection) ? activeSection : 'Customer Details';

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-bold text-[#7a8fa6]">Dashboard / Customer</p>
          <h1 className="font-display text-[20px] font-extrabold text-[#111827] sm:text-[22px]">Customer Management</h1>
        </div>
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
      {tab === 'Customer Details' ? <CustomerDetailsTab caps={caps} onNotify={onNotify} onOpenSection={onOpenSection} /> : null}
      {tab === 'Customer Ledger' ? <CustomerLedgerTab onNotify={onNotify} onOpenSection={onOpenSection} /> : null}
      {tab === 'Overall Credit Ledger' ? <OverallCreditTab onNotify={onNotify} onOpenSection={onOpenSection} /> : null}
      {tab === 'Customer Merge' ? <CustomerMergeWizard onNotify={onNotify} /> : null}
      {tab === 'Project Reconciliation' ? <ProjectCustomerReconciliationPanel onNotify={onNotify} /> : null}
    </div>
  );
}

function CustomerDetailsTab({ caps, onNotify, onOpenSection }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [profileId, setProfileId] = useState(null);
  const [saving, setSaving] = useState(false);

  const projectItems = (row) => {
    if (Array.isArray(row?.projects) && row.projects.length) return row.projects;
    return (row?.project_labels || []).map((label, idx) => ({
      kind: 'lead',
      label,
      status: '—',
      lead_id: null,
      project_id: null,
      _key: `${label}-${idx}`,
    }));
  };

  const openProjectView = (customer, item) => {
    if (item.project_id) {
      onOpenSection?.('Project Details', `${item.label} opened`, {
        project: { id: item.project_id, project_name: item.label },
      });
      return;
    }
    if (item.lead_id) {
      onOpenSection?.('Lead Details', `${item.label} opened`, {
        lead: { id: item.lead_id, customer: customer.name, mobile: customer.phone },
      });
      return;
    }
    onNotify('No linked lead/project found for this row', 'error');
  };

  const openProjectEdit = (customer, item) => {
    if (item.lead_id) {
      onOpenSection?.('Lead Edit', `Edit ${item.label}`, {
        lead: { id: item.lead_id, customer: customer.name, mobile: customer.phone },
      });
      return;
    }
    if (item.project_id) {
      onOpenSection?.('Project Details', `${item.label} opened`, {
        project: { id: item.project_id, project_name: item.label },
      });
      return;
    }
    onNotify('No linked lead/project found for this row', 'error');
  };

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
  const { pageRows, pagination } = usePagedRows(filtered, 'customer-list', { resetKey: q });

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
        All Client Detail: mobile number is the customer key. All leads (New / Hot / Warm / Cool / Won / Lost) appear here once per mobile — one customer can have multiple projects (home, office, etc.).
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <input className={`${inputClass} w-full sm:max-w-xs`} placeholder="Search name, mobile, project..." value={q} onChange={(e) => setQ(e.target.value)} />
        {caps.add ? (
        <button type="button" onClick={() => setModal({ form: { ...emptyForm } })} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] bg-[#dc2626] px-4 text-[13px] font-extrabold text-white sm:w-auto">
          <Plus className="size-4" /> Add Customer
        </button>
        ) : null}
        {caps.export ? (<button
          type="button"
          onClick={() => exportNotifyCsv(onNotify, 'customers', ['Name', 'Company', 'Phone', 'Address', 'GSTIN', 'Projects', 'Leads', 'Balance'], filtered.map((r) => [r.name, r.company, r.phone, r.address, r.gstin, r.projects_count || 0, r.leads_count || 0, r.balance]))}
          className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-extrabold text-[#284276] sm:w-auto"
        >
          <Download className="size-4" /> Export CSV
        </button>) : null}
      </div>
      {loading ? (
        <p className="py-8 text-center text-[13px] font-semibold text-[#7a8fa6] lg:hidden">Loading customers from leads...</p>
      ) : filtered.length === 0 ? (
        <MobileCardEmpty title="No customers yet" hint="Add a lead or customer with a mobile number." />
      ) : (
        <MobileCardList>
          {pageRows.map((r) => {
            const projectCount = Number(r.projects_count || r.leads_count || 0);
            return (
              <MobileRecordCard
                key={r.id}
                avatar={r.name}
                title={r.name}
                subtitle={[r.phone, r.company].filter(Boolean).join(' · ')}
                aside={<span className={Number(r.balance) > 0 ? 'text-[#dc2626]' : 'text-[#166534]'}>{fmtRs(r.balance)}</span>}
                badges={(
                  <>
                    {r.relation ? <RelationBadge value={r.relation} /> : null}
                    <span className="inline-flex items-center rounded-full bg-[#eff6ff] px-2 py-0.5 text-[10px] font-extrabold text-[#1d4ed8]">
                      {projectCount} project{projectCount === 1 ? '' : 's'}
                    </span>
                  </>
                )}
                details={[
                  { label: 'GSTIN', value: r.gstin },
                  { label: 'Address', value: r.address || r.city, wide: true },
                ]}
                onOpen={caps.view ? () => setProfileId(r.id) : undefined}
                actions={[
                  { label: 'Call', icon: Phone, tone: 'green', href: telHref(r.phone), disabled: !telHref(r.phone) },
                  caps.view ? { label: 'Profile', icon: Eye, tone: 'blue', onClick: () => setProfileId(r.id) } : null,
                  caps.edit ? { label: 'Edit', icon: Pencil, tone: 'slate', onClick: () => setModal({ id: r.id, form: { ...emptyForm, ...r } }) } : null,
                ]}
                menu={caps.delete ? [{ label: 'Delete', icon: Trash2, danger: true, onClick: () => remove(r) }] : []}
              />
            );
          })}
        </MobileCardList>
      )}
      <div className="hidden overflow-x-auto rounded-[8px] border border-[#e2e9f3] bg-white lg:block">
        <table className="min-w-[860px] w-full border-collapse text-left text-[12px]">
          <thead className="bg-[#f8fbff] text-[10px] font-extrabold uppercase tracking-wide text-[#7a8fa6]">
            <tr>
              {['Name', 'Company', 'Phone', 'Address', 'GSTIN', 'Projects', 'Relation', 'Balance', 'Actions'].map((h) => (
                <th key={h} className="px-2 py-1">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-2 py-6 text-center text-[#7a8fa6]">Loading customers from leads...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-2 py-6 text-center text-[#7a8fa6]">No customers yet. Add a lead or customer with a mobile number.</td></tr>
            ) : pageRows.map((r) => (
              <tr key={r.id} className="border-t border-[#edf2f8]">
                <td className="px-2 py-1 font-extrabold text-[#1e3261]">{r.name}</td>
                <td className="px-2 py-1">{r.company || '—'}</td>
                <td className="px-2 py-1 font-extrabold text-[#0b65e5]">{r.phone || '—'}</td>
                <td className="px-2 py-1">{r.address || r.city || '—'}</td>
                <td className="px-2 py-1">{r.gstin || '—'}</td>
                <td className="px-2 py-1">
                  <button
                    type="button"
                    onClick={() => setDetail(r)}
                    className="inline-flex items-center gap-1 rounded-full bg-[#eff6ff] px-2 py-0.5 text-[10px] font-extrabold text-[#1d4ed8] hover:bg-[#dbeafe]"
                    title={(r.project_labels || []).join(', ')}
                  >
                    {Number(r.projects_count || r.leads_count || 0)} project{(Number(r.projects_count || r.leads_count || 0) === 1) ? '' : 's'}
                  </button>
                </td>
                <td className="px-2 py-1"><RelationBadge value={r.relation} /></td>
                <td className={`px-2 py-1 font-extrabold ${Number(r.balance) > 0 ? 'text-[#dc2626]' : 'text-[#166534]'}`}>{fmtRs(r.balance)}</td>
                <td className="px-2 py-1">
                  <div className="flex gap-0.5">
                    {caps.view ? (<button type="button" onClick={() => setProfileId(r.id)} className="grid size-7 place-items-center rounded-[6px] text-[#0b65e5] hover:bg-[#eff6ff]" title="Open customer profile"><Eye className="size-3.5" /></button>) : null}
                    {caps.edit ? (<button type="button" onClick={() => setModal({ id: r.id, form: { ...emptyForm, ...r } })} className="grid size-7 place-items-center rounded-[6px] text-[#0b65e5] hover:bg-[#eff6ff]"><Pencil className="size-3.5" /></button>) : null}
                    {caps.delete ? (<button type="button" onClick={() => remove(r)} className="grid size-7 place-items-center rounded-[6px] text-[#dc2626] hover:bg-[#fef2f2]"><Trash2 className="size-3.5" /></button>) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading ? <TablePagination {...pagination} className="rounded-[8px] border border-[#e2e9f3]" /> : null}
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
            <Field label="Primary Mobile" required><input className={inputClass} value={modal.form.phone || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, phone: e.target.value } }))} /></Field>
            <Field label="Alternate Mobile"><input className={inputClass} value={modal.form.alternate_phone || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, alternate_phone: e.target.value } }))} /></Field>
            <p className="text-[11px] font-semibold text-[#7a8fa6]">Primary mobile is the Customer Master lookup key (not IVRS). Duplicate primary mobiles show a warning — merge only via authorized Merge flow.</p>
            <Field label="Email"><input className={inputClass} value={modal.form.email || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, email: e.target.value } }))} /></Field>
            <Field label="Address"><textarea className={`${inputClass} h-20 py-2`} value={modal.form.address || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, address: e.target.value } }))} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City"><input className={inputClass} value={modal.form.city || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, city: e.target.value } }))} /></Field>
              <Field label="State"><input className={inputClass} value={modal.form.state || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, state: e.target.value } }))} /></Field>
            </div>
            <Field label="GSTIN"><input className={inputClass} placeholder="15 character GST number" maxLength={15} value={modal.form.gstin || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, gstin: e.target.value } }))} /></Field>
            <Field label="Opening Balance (₹)"><input type="number" className={inputClass} value={modal.form.opening_balance || '0'} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, opening_balance: e.target.value } }))} /></Field>
            <p className="text-[11px] font-semibold text-[#7a8fa6]">Enter positive value if customer owes you money</p>
            <Field label="Vehicle Number"><input className={inputClass} placeholder="Vehicle Number" value={modal.form.vehicle_number || ''} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, vehicle_number: e.target.value } }))} /></Field>
            <Field label="Credit Limit (₹)"><input type="number" className={inputClass} value={modal.form.credit_limit || '0'} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, credit_limit: e.target.value } }))} /></Field>
            <Field label="Credit Days"><input type="number" className={inputClass} value={modal.form.credit_days || '30'} onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, credit_days: e.target.value } }))} /></Field>
          </div>
        </ModalShell>
      ) : null}
      {profileId ? (
        <CustomerProfileModal
          customerId={profileId}
          onClose={() => setProfileId(null)}
          onNotify={onNotify}
          onOpenSection={onOpenSection}
        />
      ) : null}
      {detail ? (
        <ModalShell
          title={`${detail.name} · ${detail.phone || 'No mobile'}`}
          onClose={() => setDetail(null)}
          footer={(
            <>
              <button type="button" onClick={() => { setProfileId(detail.id); setDetail(null); }} className="h-10 rounded-[8px] bg-[#0b65e5] px-4 text-[13px] font-extrabold text-white">Open full profile</button>
              <button type="button" onClick={() => setDetail(null)} className="h-10 rounded-[8px] border px-4 text-[13px] font-semibold">Close</button>
            </>
          )}
        >
          <div className="space-y-3">
            <p className="text-[12px] font-semibold text-[#53647f]">
              {detail.leads_count || 0} lead(s) · statuses: {(detail.lead_statuses || []).join(', ') || '—'}
            </p>
            {projectItems(detail).length === 0 ? (
              <p className="text-[13px] font-semibold text-[#7a8fa6]">No projects/leads linked to this mobile yet.</p>
            ) : (
              <ul className="space-y-2">
                {projectItems(detail).map((item, idx) => (
                  <li
                    key={item._key || `${item.kind}-${item.lead_id || ''}-${item.project_id || ''}-${idx}`}
                    className="flex items-center justify-between gap-3 rounded-[10px] border border-[#e2e9f3] bg-[#f8fbff] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-[#1e3261]">{item.label}</p>
                      {item.status && item.status !== '—' ? (
                        <p className="text-[11px] font-semibold text-[#7a8fa6]">{item.kind === 'project' ? 'Project' : 'Lead'} · {item.status}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => openProjectView(detail, item)}
                        className="grid size-8 place-items-center rounded-[8px] text-[#0b65e5] hover:bg-[#eff6ff]"
                        title="View"
                      >
                        <Eye className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openProjectEdit(detail, item)}
                        className="grid size-8 place-items-center rounded-[8px] text-[#0b65e5] hover:bg-[#eff6ff]"
                        title="Edit"
                      >
                        <Pencil className="size-4" />
                      </button>
                    </div>
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

const LEDGER_PAYMENT_MODE_OPTIONS = [
  'UPI',
  'PhonePe',
  'Google Pay',
  'Cash',
  'Online Transfer',
  'NEFT',
  'RTGS',
  'Cheque',
  'Other',
];

const emptyLedgerForm = () => ({
  party_id: '',
  entry_date: todayIso(),
  entry_type: 'sale',
  payment_mode: '',
  amount: '',
  vehicle_no: '',
  reference_no: '',
  work: '',
});

function ledgerTypeNeedsPaymentMode(entryType) {
  return String(entryType || '') === 'payment';
}

function CustomerLedgerTab({ onNotify, onOpenSection }) {
  const [customers, setCustomers] = useState([]);
  const [partyId, setPartyId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [projectRows, setProjectRows] = useState([]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [q, setQ] = useState('');
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [detail, setDetail] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [ledgerModal, setLedgerModal] = useState(null);
  const [savingLedger, setSavingLedger] = useState(false);

  const loadCustomers = useCallback(async () => {
    try {
      await accountsModuleApi.syncCustomersFromLeads().catch(() => null);
      // Client Ledger: Won leads + leads that already have a quotation
      // (quotation materials/pricing land on that customer account).
      const data = await accountsModuleApi.parties.list({
        account_type: 'Customer',
        won_only: true,
        page_size: 500,
      });
      setCustomers(normalizeApiRows(data));
    } catch (e) {
      onNotify(e.message || 'Failed to load customers', 'error');
    }
  }, [onNotify]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  useEffect(() => {
    setProjectId('');
    setProjectRows([]);
    if (!partyId) return undefined;
    let cancelled = false;
    accountsModuleApi.partyProjectAccounts(partyId).then((data) => {
      if (!cancelled) setProjectRows(data?.projects || []);
    }).catch(() => {
      if (!cancelled) setProjectRows([]);
    });
    return () => { cancelled = true; };
  }, [partyId]);

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
      if (projectId === '__unallocated__') params.unallocated = 'true';
      else if (projectId) params.project_id = projectId;
      const qs = new URLSearchParams(params).toString();
      setPayload(await accountsModuleApi.partyLedger(partyId, qs));
    } catch (e) {
      onNotify(e.message || 'Failed to load ledger', 'error');
    } finally {
      setLoading(false);
    }
  }, [partyId, projectId, start, end, onNotify]);

  useEffect(() => { loadLedger(); }, [loadLedger, reloadKey]);

  const selected = useMemo(
    () => customers.find((c) => String(c.id) === String(partyId)) || payload?.party || null,
    [customers, partyId, payload],
  );

  const entries = useMemo(() => {
    const rows = payload?.results || [];
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((e) => `${e.particulars || ''} ${e.work || ''} ${e.ref || ''} ${e.vehicle_no || ''} ${e.type_label || ''} ${e.payment_mode || ''}`.toLowerCase().includes(needle));
  }, [payload, q]);
  const { pageRows: pageEntries, pagination } = usePagedRows(entries, 'customer-ledger', { resetKey: `${partyId}|${start}|${end}|${q}` });

  const summary = payload?.summary || {
    total_debit: entries.reduce((s, e) => s + Number(e.debit || 0), 0),
    total_credit: entries.reduce((s, e) => s + Number(e.credit || 0), 0),
    credit_15_plus: 0,
    current_balance: entries.length ? Number(entries[entries.length - 1].balance || 0) : 0,
    previous_balance: 0,
    opening: Number(selected?.opening_balance || 0),
    project_cost: 0,
    work_completion_pct: 0,
    work_done_value: 0,
    received_payment: 0,
    outstanding_amount: 0,
    remaining_work_value: 0,
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
      const res = await accountsModuleApi.detectCustomerDuplicates();
      const groups = res?.results || [];
      await loadCustomers();
      setReloadKey((k) => k + 1);
      onNotify(
        groups.length
          ? `Found ${groups.length} duplicate mobile group(s). Use authorized Customer Merge — auto-merge is disabled.`
          : 'No duplicate mobiles found',
        groups.length ? 'error' : 'success',
      );
    } catch (e) {
      onNotify(e.message || 'Duplicate detection failed', 'error');
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
      ['Date', 'Vehicle No', 'Type', 'Payment Mode', 'Challan/Receipt No', 'Work', 'Debit', 'Credit', 'Balance'],
      entries.map((e) => [
        e.date,
        e.vehicle_no,
        LEDGER_TYPE_LABELS[String(e.type_label || e.type || '').toLowerCase()] || (e.type_label || e.type || ''),
        e.payment_mode || '',
        e.ref,
        e.work || e.particulars,
        e.debit,
        e.credit,
        e.balance,
      ]),
    );
  };

  const savePdf = () => {
    if (!partyId || !entries.length) {
      onNotify('Select a customer with ledger entries to save PDF', 'error');
      return;
    }
    window.print();
  };

  const openAddLedger = () => {
    const form = emptyLedgerForm();
    if (partyId) form.party_id = String(partyId);
    setLedgerModal({ mode: 'create', form });
  };

  const openEditLedger = (entry) => {
    if (!partyId || entry?.source_kind !== 'manual_ledger' || !entry?.source_id) {
      onNotify('Only manual ledger entries can be edited', 'error');
      return;
    }
    const entryType = String(entry.type_label || entry.type || 'sale').toLowerCase();
    const normalizedType = entryType === 'invoice' ? 'sale' : entryType === 'receipt' ? 'payment' : entryType;
    setDetail(null);
    setLedgerModal({
      mode: 'edit',
      entryId: entry.source_id,
      form: {
        party_id: String(partyId),
        entry_date: String(entry.date || todayIso()).slice(0, 10),
        entry_type: ['sale', 'payment', 'discount'].includes(normalizedType) ? normalizedType : 'sale',
        payment_mode: entry.payment_mode || '',
        amount: entry.debit || entry.credit || '',
        vehicle_no: entry.vehicle_no || '',
        reference_no: entry.ref || '',
        work: entry.work || entry.particulars || '',
      },
    });
  };

  const saveLedgerEntry = async () => {
    const form = ledgerModal?.form || {};
    const targetId = String(form.party_id || '').trim();
    if (!targetId) {
      onNotify('Please select a customer', 'error');
      return;
    }
    if (!form.entry_date) {
      onNotify('Date is required', 'error');
      return;
    }
    if (!form.entry_type) {
      onNotify('Transaction Type is required', 'error');
      return;
    }
    if (ledgerTypeNeedsPaymentMode(form.entry_type) && !String(form.payment_mode || '').trim()) {
      onNotify('Payment Mode is required for Payment Received', 'error');
      return;
    }
    const amount = Number(form.amount);
    if (!(amount > 0)) {
      onNotify('Amount must be greater than zero', 'error');
      return;
    }
    const payload = {
      entry_date: form.entry_date,
      entry_type: form.entry_type,
      payment_mode: ledgerTypeNeedsPaymentMode(form.entry_type) ? form.payment_mode : '',
      amount,
      vehicle_no: form.vehicle_no || '',
      reference_no: form.reference_no || '',
      work: form.work || '',
    };
    setSavingLedger(true);
    try {
      if (ledgerModal?.mode === 'edit' && ledgerModal?.entryId) {
        await accountsModuleApi.updateLedgerEntry(targetId, ledgerModal.entryId, payload);
        onNotify('Ledger entry updated', 'success');
      } else {
        await accountsModuleApi.addLedgerEntry(targetId, payload);
        onNotify('Ledger entry saved', 'success');
      }
      setLedgerModal(null);
      setPartyId(targetId);
      setReloadKey((k) => k + 1);
    } catch (e) {
      onNotify(e.message || 'Failed to save ledger entry', 'error');
    } finally {
      setSavingLedger(false);
    }
  };

  const kpiCards = [
    { label: 'Project Cost', value: fmtCompact(summary.project_cost), tone: 'blue', Icon: IndianRupee },
    { label: 'Received Payment', value: fmtCompact(summary.received_payment ?? summary.total_credit), tone: 'green', Icon: TrendingDown },
    { label: 'Outstanding', value: fmtCompact(summary.outstanding_amount), tone: 'red', Icon: AlertCircle },
    { label: 'Work Done', value: fmtCompact(summary.work_done_value), tone: 'purple', Icon: Wallet },
    { label: 'Work Completion', value: `${Number(summary.work_completion_pct || 0).toFixed(1)}%`, tone: 'green', Icon: TrendingUp },
    { label: 'Remaining Work', value: fmtCompact(summary.remaining_work_value), tone: 'orange', Icon: Wallet },
  ];

  const txnTypes = [
    { value: 'sale', label: 'Sale', hint: 'Debit · increases due', tone: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]' },
    { value: 'payment', label: 'Payment Received', hint: 'Credit · reduces due', tone: 'border-[#bbf7d0] bg-[#ecfdf5] text-[#166534]' },
    { value: 'discount', label: 'Discount', hint: 'Credit · goodwill', tone: 'border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]' },
  ];

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-tight text-[#0f172a]">Client Ledger</h2>
          <p className="mt-1 text-[13px] font-semibold text-[#53647f]">
            Customer-wise Sale, Payment Received aur Discount entries — Payment Mode ke saath clean accounting view.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={refreshAll} className={softBtnClass}><RefreshCw className="size-3.5" /> Refresh</button>
          <button type="button" disabled={!entries.length} onClick={exportCsv} className={softBtnClass}><Download className="size-3.5" /> CSV</button>
          <button type="button" disabled={!entries.length} onClick={savePdf} className={softBtnClass}><FileText className="size-3.5" /> PDF</button>
          <button type="button" disabled={fixing} onClick={fixDuplicates} className={`${softBtnClass} border-[#fecaca] bg-[#fef2f2] text-[#dc2626]`}>
            {fixing ? 'Scanning...' : 'Detect Duplicates'}
          </button>
          <button type="button" onClick={() => onOpenSection?.('Customer Details')} className={softBtnClass}><Plus className="size-3.5" /> Add Customer</button>
          <button type="button" onClick={openAddLedger} className={primaryBtnClass}><Plus className="size-3.5" /> Add New Ledger</button>
        </div>
      </div>

      <LedgerSectionCard
        step="1"
        title="Select Customer & Filters"
        action={(
          <button type="button" onClick={openAddLedger} className="inline-flex h-8 items-center gap-1 rounded-[8px] bg-white/15 px-3 text-[11px] font-extrabold text-white hover:bg-white/25">
            <Plus className="size-3.5" /> New Entry
          </button>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Field label="Select Customer" required>
            <CustomerSearchSelect
              customers={customers}
              value={partyId}
              onChange={setPartyId}
              placeholder="Search name or mobile"
            />
          </Field>
          <Field label="Account Scope">
            <select className={inputClass} value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={!partyId}>
              <option value="">Consolidated (all projects)</option>
              <option value="__unallocated__">Unallocated advances</option>
              {projectRows.map((row) => (
                <option key={row.project_id} value={row.project_id}>
                  {row.project_name} · Outstanding {fmtCompact(row.outstanding)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Start Date"><input type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="End Date"><input type="date" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          <Field label="Search Entries">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a98af]" />
              <input className={`${inputClass} pl-9`} placeholder="Type, mode, work, ref..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </Field>
        </div>
        {payload?.breakdown?.projects?.length ? (
          <div className="mt-4 overflow-x-auto rounded-[12px] border border-[#e8eef7]">
            <table className="min-w-full text-left text-[12px]">
              <thead className="bg-[#f8fbff] text-[#53647f]">
                <tr>
                  <th className="px-3 py-2.5 font-extrabold">Project</th>
                  <th className="px-3 py-2.5 font-extrabold">Invoiced</th>
                  <th className="px-3 py-2.5 font-extrabold">Received</th>
                  <th className="px-3 py-2.5 font-extrabold">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {payload.breakdown.projects.map((row) => (
                  <tr key={row.project_id} className="border-t border-[#eef2f8]">
                    <td className="px-3 py-2.5 font-bold text-[#1e3261]">{row.project_name}</td>
                    <td className="px-3 py-2.5">{fmtRs(row.invoiced)}</td>
                    <td className="px-3 py-2.5">{fmtRs(row.received)}</td>
                    <td className="px-3 py-2.5 font-extrabold">{fmtRs(row.outstanding)}</td>
                  </tr>
                ))}
                <tr className="border-t border-[#e2e9f3] bg-[#fff7ed]">
                  <td className="px-3 py-2.5 font-extrabold text-[#9a3412]">Unallocated</td>
                  <td className="px-3 py-2.5">{fmtRs(payload.breakdown.unallocated?.invoiced)}</td>
                  <td className="px-3 py-2.5">{fmtRs(payload.breakdown.unallocated?.received)}</td>
                  <td className="px-3 py-2.5 font-extrabold">{fmtRs(payload.breakdown.unallocated?.outstanding)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </LedgerSectionCard>

      {!partyId ? (
        <LedgerSectionCard step="2" title="Ledger Workspace" tone="slate">
          <div className="rounded-[12px] border border-dashed border-[#d9e4f2] bg-[#f8fbff] px-4 py-14 text-center">
            <Wallet className="mx-auto size-10 text-[#bfdbfe]" />
            <p className="mt-3 text-[15px] font-extrabold text-[#1e3261]">Customer select karein</p>
            <p className="mt-1 text-[13px] font-semibold text-[#7a8fa6]">Ledger entries, payment mode aur outstanding yahin dikhenge.</p>
          </div>
        </LedgerSectionCard>
      ) : (
        <>
          <LedgerSectionCard step="2" title="Account Summary">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {kpiCards.map((card) => (
                <LedgerStatCard key={card.label} {...card} />
              ))}
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-[12px] border border-[#bfdbfe] bg-[#f8fbff] p-4">
                <p className="mb-3 text-[11px] font-extrabold uppercase tracking-wide text-[#1d4ed8]">Customer Snapshot</p>
                <div className="space-y-2.5 text-[13px]">
                  <p className="flex items-center gap-2 font-extrabold text-[#0f172a]"><CheckCircle2 className="size-4 text-[#0b65e5]" />{selected?.name || '—'}</p>
                  <p className="flex items-center gap-2 font-semibold text-[#334155]"><Phone className="size-4 text-[#64748b]" />{selected?.phone || '—'}</p>
                  <p className="flex items-center gap-2 font-semibold text-[#334155]"><Mail className="size-4 text-[#64748b]" />{selected?.email || 'N/A'}</p>
                  <p className="flex items-center gap-2 font-semibold text-[#334155]"><IndianRupee className="size-4 text-[#64748b]" />Opening {fmtRs(selected?.opening_balance || summary.opening || 0)}</p>
                </div>
              </div>
              <div className="rounded-[12px] border border-[#bbf7d0] bg-[#f0fdf4] p-4">
                <p className="mb-3 text-[11px] font-extrabold uppercase tracking-wide text-[#166534]">Balance Impact</p>
                <div className="grid grid-cols-2 gap-3 text-[13px]">
                  <div>
                    <p className="text-[11px] font-bold text-[#64748b]">Total Debit</p>
                    <p className="mt-1 text-[18px] font-extrabold text-[#dc2626]">{fmtRs(summary.total_debit)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-[#64748b]">Total Credit</p>
                    <p className="mt-1 text-[18px] font-extrabold text-[#166534]">{fmtRs(summary.total_credit)}</p>
                  </div>
                  <div className="col-span-2 rounded-[10px] border border-[#bbf7d0] bg-white px-3 py-2.5">
                    <p className="text-[11px] font-bold text-[#64748b]">Final Balance</p>
                    <p className={`mt-1 text-[18px] font-extrabold ${finalIsCredit ? 'text-[#166534]' : 'text-[#dc2626]'}`}>
                      {fmtRs(Math.abs(finalBalance))} ({finalIsCredit ? 'Cr' : 'Dr'})
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </LedgerSectionCard>

          <LedgerSectionCard
            step="3"
            title="Ledger Entries"
            tone="green"
            action={(
              <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-extrabold">
                {entries.length} rows
              </span>
            )}
          >
            {loading ? (
              <p className="py-10 text-center text-[13px] font-semibold text-[#7a8fa6]">Loading...</p>
            ) : (
              <>
              <LedgerMobileCards
                entries={pageEntries}
                emptyText="No ledger entries for this customer."
                totalDebit={summary.total_debit}
                totalCredit={summary.total_credit}
                finalBalance={finalBalance}
                onOpen={setDetail}
                TypeBadge={TypeBadge}
                fmtDate={fmtDisplayDate}
                fmtMoney={fmtRs}
              />
              <div className="hidden overflow-hidden rounded-[12px] border border-[#e8eef7] lg:block">
                <div className="overflow-x-auto">
                  <table className="min-w-[1100px] w-full text-left text-[13px]">
                    <thead className="bg-[#f8fbff] text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">
                      <tr>
                        {['Date', 'Vehicle No', 'Type', 'Payment Mode', 'Challan/Receipt No.', 'Work', 'Debit (₹)', 'Credit (₹)', 'Balance (₹)', 'Action'].map((h) => (
                          <th key={h} className="px-3 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {entries.length === 0 ? (
                        <tr><td colSpan={10} className="px-3 py-10 text-center text-[#7a8fa6]">No ledger entries for this customer.</td></tr>
                      ) : pageEntries.map((e, i) => {
                        const bal = Number(e.balance || 0);
                        return (
                          <tr key={`${e.ref}-${i}`} className={`border-t border-[#edf2f8] ${i % 2 ? 'bg-[#fbfdff]' : 'bg-white'}`}>
                            <td className="px-3 py-2.5 whitespace-nowrap">{fmtDisplayDate(e.date)}</td>
                            <td className="px-3 py-2.5">{e.vehicle_no || '—'}</td>
                            <td className="px-3 py-2.5"><TypeBadge value={e.type_label || e.type} /></td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {e.payment_mode ? (
                                <span className="inline-flex rounded-full border border-[#bbf7d0] bg-[#ecfdf5] px-2.5 py-0.5 text-[11px] font-extrabold text-[#166534]">
                                  {e.payment_mode}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-3 py-2.5 font-semibold text-[#334155]">{e.ref || '—'}</td>
                            <td className="max-w-[260px] truncate px-3 py-2.5" title={e.work || e.particulars || ''}>{e.work || e.particulars || '—'}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">{e.debit ? fmtRs(e.debit) : '—'}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">{e.credit ? fmtRs(e.credit) : '—'}</td>
                            <td className={`px-3 py-2.5 whitespace-nowrap font-extrabold ${bal > 0 ? 'text-[#dc2626]' : 'text-[#166534]'}`}>{fmtRs(bal)}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={() => setDetail(e)} className="grid size-8 place-items-center rounded-[8px] text-[#0b65e5] hover:bg-[#eff6ff]" title="View entry">
                                  <Eye className="size-4" />
                                </button>
                                {e.source_kind === 'manual_ledger' ? (
                                  <button type="button" onClick={() => openEditLedger(e)} className="grid size-8 place-items-center rounded-[8px] text-[#334155] hover:bg-[#f1f5f9]" title="Edit entry">
                                    <Pencil className="size-4" />
                                  </button>
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
                          <td className="px-3 py-3" colSpan={6}>Totals:</td>
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
              </div>
              <TablePagination {...pagination} className="mt-3" />
              </>
            )}
          </LedgerSectionCard>
        </>
      )}

      <div className="rounded-[12px] border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-[12px] font-semibold text-[#166534]">
        <span className="font-extrabold">Key Benefits:</span> Clear Sale / Payment Received / Discount · Mandatory Payment Mode on receipts · Debit-Credit integrity preserved · Project + Consolidated scope
      </div>

      {detail ? (
        <ModalShell
          title="Ledger Entry Details"
          headerTone="blue"
          onClose={() => setDetail(null)}
          footer={(
            <>
              {detail.source_kind === 'manual_ledger' ? (
                <button type="button" onClick={() => openEditLedger(detail)} className={softBtnClass}>Edit Entry</button>
              ) : null}
              <button type="button" onClick={() => setDetail(null)} className={primaryBtnClass}>Close</button>
            </>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[12px] border border-[#e8eef7] bg-[#f8fbff] p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">Date</p>
              <p className="mt-1 text-[14px] font-extrabold text-[#0f172a]">{fmtDisplayDate(detail.date)}</p>
            </div>
            <div className="rounded-[12px] border border-[#e8eef7] bg-[#f8fbff] p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">Type</p>
              <div className="mt-1"><TypeBadge value={detail.type_label || detail.type} /></div>
            </div>
            <div className="rounded-[12px] border border-[#e8eef7] bg-[#f8fbff] p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">Payment Mode</p>
              <p className="mt-1 text-[14px] font-extrabold text-[#0f172a]">{detail.payment_mode || '—'}</p>
            </div>
            <div className="rounded-[12px] border border-[#e8eef7] bg-[#f8fbff] p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">Reference</p>
              <p className="mt-1 text-[14px] font-extrabold text-[#0f172a]">{detail.ref || '—'}</p>
            </div>
            <div className="sm:col-span-2 rounded-[12px] border border-[#e8eef7] bg-white p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">Work / Description</p>
              <p className="mt-1 text-[14px] font-semibold text-[#334155]">{detail.work || detail.particulars || '—'}</p>
            </div>
            <div className="rounded-[12px] border border-[#fecaca] bg-[#fef2f2] p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#dc2626]">Debit</p>
              <p className="mt-1 text-[16px] font-extrabold text-[#dc2626]">{detail.debit ? fmtRs(detail.debit) : '—'}</p>
            </div>
            <div className="rounded-[12px] border border-[#bbf7d0] bg-[#ecfdf5] p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#166534]">Credit</p>
              <p className="mt-1 text-[16px] font-extrabold text-[#166534]">{detail.credit ? fmtRs(detail.credit) : '—'}</p>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {ledgerModal ? (
        <ModalShell
          title={ledgerModal.mode === 'edit' ? 'Edit Ledger Entry' : 'Add New Ledger'}
          headerTone="blue"
          wide
          titleIcon={<CreditCard className="size-5 text-white/90" />}
          onClose={() => !savingLedger && setLedgerModal(null)}
          footer={(
            <>
              <button type="button" disabled={savingLedger} onClick={() => setLedgerModal(null)} className={softBtnClass}>Cancel</button>
              <button
                type="button"
                disabled={savingLedger}
                onClick={saveLedgerEntry}
                className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-[#16a34a] px-4 text-[12px] font-extrabold text-white shadow-[0_8px_18px_rgba(22,163,74,0.25)] transition hover:bg-[#15803d] disabled:opacity-50"
              >
                {savingLedger ? 'Saving...' : (ledgerModal.mode === 'edit' ? 'Update Entry' : 'Save Entry')}
              </button>
            </>
          )}
        >
          <div className="grid gap-4">
            <div className="overflow-hidden rounded-[12px] border border-[#e2e9f3]">
              <div className="bg-[#0b65e5] px-3.5 py-2 text-[12px] font-extrabold text-white">1. Customer & Date</div>
              <div className="grid gap-3 p-3.5 sm:grid-cols-2">
                <Field label="Customer" required>
                  <CustomerSearchSelect
                    customers={customers}
                    value={ledgerModal.form.party_id}
                    onChange={(next) => setLedgerModal((m) => ({ ...m, form: { ...m.form, party_id: next } }))}
                    placeholder="Search name or mobile"
                    disabled={ledgerModal.mode === 'edit'}
                  />
                </Field>
                <Field label="Date" required>
                  <input
                    type="date"
                    className={inputClass}
                    value={ledgerModal.form.entry_date}
                    onChange={(e) => setLedgerModal((m) => ({ ...m, form: { ...m.form, entry_date: e.target.value } }))}
                  />
                </Field>
              </div>
            </div>

            <div className="overflow-hidden rounded-[12px] border border-[#e2e9f3]">
              <div className="bg-[#0b65e5] px-3.5 py-2 text-[12px] font-extrabold text-white">2. Transaction Type</div>
              <div className="p-3.5">
                <div className="grid gap-2 sm:grid-cols-3">
                  {txnTypes.map((opt) => {
                    const active = ledgerModal.form.entry_type === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setLedgerModal((m) => ({
                          ...m,
                          form: {
                            ...m.form,
                            entry_type: opt.value,
                            payment_mode: ledgerTypeNeedsPaymentMode(opt.value) ? m.form.payment_mode : '',
                          },
                        }))}
                        className={`rounded-[12px] border px-3 py-3 text-left transition ${
                          active ? `${opt.tone} ring-2 ring-offset-1 ring-[#0b65e5]/30` : 'border-[#e2e9f3] bg-white hover:bg-[#f8fbff]'
                        }`}
                      >
                        <p className="text-[13px] font-extrabold">{opt.label}</p>
                        <p className="mt-0.5 text-[11px] font-semibold opacity-80">{opt.hint}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {ledgerTypeNeedsPaymentMode(ledgerModal.form.entry_type) ? (
              <div className="overflow-hidden rounded-[12px] border border-[#bbf7d0]">
                <div className="bg-[#16a34a] px-3.5 py-2 text-[12px] font-extrabold text-white">3. Payment Mode</div>
                <div className="bg-[#f0fdf4] p-3.5">
                  <Field label="Payment Mode" required>
                    <select
                      className={inputClass}
                      value={ledgerModal.form.payment_mode}
                      onChange={(e) => setLedgerModal((m) => ({ ...m, form: { ...m.form, payment_mode: e.target.value } }))}
                    >
                      <option value="">Select payment mode</option>
                      {LEDGER_PAYMENT_MODE_OPTIONS.map((mode) => (
                        <option key={mode} value={mode}>{mode}</option>
                      ))}
                      {ledgerModal.form.payment_mode
                        && !LEDGER_PAYMENT_MODE_OPTIONS.includes(ledgerModal.form.payment_mode) ? (
                          <option value={ledgerModal.form.payment_mode}>{ledgerModal.form.payment_mode}</option>
                        ) : null}
                    </select>
                  </Field>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {LEDGER_PAYMENT_MODE_OPTIONS.map((mode) => {
                      const active = ledgerModal.form.payment_mode === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setLedgerModal((m) => ({ ...m, form: { ...m.form, payment_mode: mode } }))}
                          className={`rounded-full border px-3 py-1.5 text-[11px] font-extrabold transition ${
                            active
                              ? 'border-[#16a34a] bg-[#16a34a] text-white'
                              : 'border-[#bbf7d0] bg-white text-[#166534] hover:bg-[#ecfdf5]'
                          }`}
                        >
                          {mode}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-[#bbf7d0] bg-white px-3 py-2 text-[11px] font-semibold text-[#166534]">
                    <CheckCircle2 className="size-4 shrink-0 text-[#16a34a]" />
                    Payment Received entries require Payment Mode for audit integrity.
                  </div>
                </div>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-[12px] border border-[#e2e9f3]">
              <div className="bg-[#334155] px-3.5 py-2 text-[12px] font-extrabold text-white">
                {ledgerTypeNeedsPaymentMode(ledgerModal.form.entry_type) ? '4' : '3'}. Amount & Description
              </div>
              <div className="grid gap-3 p-3.5">
                <Field label="Amount (₹)" required>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClass}
                    placeholder="0.00"
                    value={ledgerModal.form.amount}
                    onChange={(e) => setLedgerModal((m) => ({ ...m, form: { ...m.form, amount: e.target.value } }))}
                  />
                </Field>
                <Field label="Work / Description">
                  <textarea
                    className={`${inputClass} h-24 py-2`}
                    placeholder="Work description / remarks"
                    value={ledgerModal.form.work}
                    onChange={(e) => setLedgerModal((m) => ({ ...m, form: { ...m.form, work: e.target.value } }))}
                  />
                </Field>
              </div>
            </div>
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
  const { pageRows, pagination } = usePagedRows(rows, 'customer-overall-credit', { resetKey: q });

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

      {!data ? (
        <p className="py-8 text-center text-[13px] font-semibold text-[#7a8fa6] lg:hidden">Loading...</p>
      ) : rows.length === 0 ? (
        <MobileCardEmpty title="No customer balances yet." />
      ) : (
        <MobileCardList>
          {pageRows.map((r) => (
            <MobileRecordCard
              key={r.id}
              avatar={r.name}
              title={r.name}
              subtitle={[r.phone, r.company].filter(Boolean).join(' · ')}
              aside={<span className={balanceTone(r.net) === 'danger' ? 'text-[#dc2626]' : 'text-[#16a34a]'}>{fmtRs(r.net)}</span>}
              badges={r.relation ? <RelationBadge value={r.relation} /> : null}
              details={[
                { label: 'Debit', value: fmtRs(r.debit), tone: 'danger' },
                { label: 'Credit', value: fmtRs(r.credit), tone: 'success' },
                { label: 'Yearly', value: fmtRs(r.yearly_transaction) },
                { label: 'Last Date', value: fmtDisplayDate(r.last_date) },
              ]}
              actions={[
                { label: 'Call', icon: Phone, tone: 'green', href: telHref(r.phone), disabled: !telHref(r.phone) },
                {
                  label: 'Settle',
                  icon: IndianRupee,
                  tone: 'red',
                  onClick: () => setSettle({
                    id: r.id,
                    name: r.name,
                    phone: r.phone,
                    net: Number(r.net || 0),
                    amount: String(Number(r.net) > 0 ? Number(r.net) : 0),
                    payment_date: todayIso(),
                    payment_mode: 'Cash',
                    remarks: '',
                  }),
                },
              ]}
            />
          ))}
        </MobileCardList>
      )}

      <div className="hidden overflow-auto rounded-[14px] border border-[#e2e9f3] bg-white shadow-sm lg:block">
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
            ) : pageRows.map((r, idx) => (
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
      <TablePagination {...pagination} className="rounded-[14px] border border-[#e2e9f3]" />

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
