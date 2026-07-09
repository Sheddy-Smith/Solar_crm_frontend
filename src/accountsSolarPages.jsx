import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2, Eye, Download, Printer } from 'lucide-react';
import Button from './components/ui/Button.jsx';
import { accountsModuleApi, projectApi } from './api.js';

const panelClass =
  'crm-panel rounded-[12px] border border-[#dbe5f2] bg-white/90 shadow-[0_10px_24px_rgba(24,48,87,0.06)] backdrop-blur-sm';
const dataPanelClass =
  'crm-data-panel overflow-hidden rounded-[12px] border border-[#dbe5f2] bg-white/75 shadow-[0_12px_28px_rgba(24,48,87,0.07)] backdrop-blur-md';

const ACC_PAYMENT_MODES = ['Cash', 'Cheque', 'NEFT', 'RTGS', 'UPI', 'IMPS', 'Transfer', 'Other'];
const GST_TYPES = ['CGST_SGST', 'IGST'];
const MATERIAL_UNITS = ['Nos', 'Set', 'KW', 'Meter', 'Kg', 'Box', 'Roll'];

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function normalizeApiRows(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

const fmtRs = (v) => (v != null && v !== '' ? `Rs ${Number(v).toLocaleString('en-IN')}` : '—');
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—');
const todayIso = () => new Date().toISOString().slice(0, 10);

function StatusBadge({ status }) {
  const tone = {
    Pending: 'bg-[#fff7e6] text-[#b76b00]',
    Draft: 'bg-[#f3f4f6] text-[#4b5563]',
    Recorded: 'bg-[#e8f8eb] text-[#14853a]',
    Issued: 'bg-[#eef5ff] text-[#0b65e5]',
    Paid: 'bg-[#e8f8eb] text-[#14853a]',
    Open: 'bg-[#fff7e6] text-[#b76b00]',
    Received: 'bg-[#e8f8eb] text-[#14853a]',
    Dispatched: 'bg-[#eef5ff] text-[#0b65e5]',
    Delivered: 'bg-[#e8f8eb] text-[#14853a]',
    Completed: 'bg-[#e8f8eb] text-[#14853a]',
    Cancelled: 'bg-[#fee2e2] text-[#dc2626]',
  }[status] || 'bg-[#f3f4f6] text-[#4b5563]';
  return <span className={cx('inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-extrabold', tone)}>{status}</span>;
}

function emptyLine() {
  return { material_name: '', category: '', quantity: '1', unit: 'Nos', rate: '' };
}

function emptyExtra() {
  return { description: '', amount: '' };
}

function ModalShell({ title, children, onClose, wide }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-[#0f172a]/45 p-4 pt-8">
      <div className={cx(panelClass, 'w-full p-5', wide ? 'max-w-5xl' : 'max-w-2xl')}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="font-display text-[18px] font-extrabold text-[#06135a]">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-[8px] px-3 py-1 text-[13px] font-bold text-[#53647f] hover:bg-[#f5f9ff]">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[#7b8ca8]">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  'h-9 w-full rounded-[8px] border border-[#dbe5f2] bg-white px-3 text-[13px] font-semibold text-[#1e3261] outline-none focus:border-[#0b65e5]';

function LineItemsEditor({ lines, onChange, showCategory = true }) {
  function updateLine(idx, key, value) {
    const next = lines.map((row, i) => (i === idx ? { ...row, [key]: value } : row));
    onChange(next);
  }
  function addLine() {
    onChange([...lines, emptyLine()]);
  }
  function removeLine(idx) {
    onChange(lines.filter((_, i) => i !== idx));
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-extrabold text-[#30466d]">Line Items</p>
        <Button type="button" size="sm" variant="secondary" onClick={addLine}><Plus className="size-3.5" /> Add Row</Button>
      </div>
      <div className="overflow-x-auto rounded-[10px] border border-[#e5eaf2]">
        <table className="min-w-full text-left text-[12px]">
          <thead className="bg-[#f8fbff] text-[11px] font-extrabold uppercase tracking-wide text-[#7b8ca8]">
            <tr>
              <th className="px-3 py-2">Material / Service</th>
              {showCategory ? <th className="px-3 py-2">Category</th> : null}
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2">Rate</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => {
              const total = Number(line.quantity || 0) * Number(line.rate || 0);
              return (
                <tr key={idx} className="border-t border-[#eef2f7]">
                  <td className="px-2 py-2"><input className={inputClass} value={line.material_name} onChange={(e) => updateLine(idx, 'material_name', e.target.value)} placeholder="Panel / Inverter / Cable" /></td>
                  {showCategory ? <td className="px-2 py-2"><input className={inputClass} value={line.category} onChange={(e) => updateLine(idx, 'category', e.target.value)} placeholder="Solar / O&M" /></td> : null}
                  <td className="px-2 py-2 w-20"><input className={inputClass} type="number" value={line.quantity} onChange={(e) => updateLine(idx, 'quantity', e.target.value)} /></td>
                  <td className="px-2 py-2 w-24">
                    <select className={inputClass} value={line.unit} onChange={(e) => updateLine(idx, 'unit', e.target.value)}>
                      {MATERIAL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2 w-28"><input className={inputClass} type="number" value={line.rate} onChange={(e) => updateLine(idx, 'rate', e.target.value)} /></td>
                  <td className="px-3 py-2 font-extrabold text-[#1e3261]">{fmtRs(total)}</td>
                  <td className="px-2 py-2">
                    <button type="button" onClick={() => removeLine(idx)} className="rounded-[8px] p-2 text-[#dc2626] hover:bg-[#fee2e2]"><Trash2 className="size-4" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExtraChargesEditor({ rows, onChange }) {
  function updateRow(idx, key, value) {
    onChange(rows.map((row, i) => (i === idx ? { ...row, [key]: value } : row)));
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-extrabold text-[#30466d]">Extra Charges</p>
        <Button type="button" size="sm" variant="secondary" onClick={() => onChange([...rows, emptyExtra()])}><Plus className="size-3.5" /> Add Charge</Button>
      </div>
      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_140px_40px] gap-2">
            <input className={inputClass} value={row.description} onChange={(e) => updateRow(idx, 'description', e.target.value)} placeholder="Freight / Loading" />
            <input className={inputClass} type="number" value={row.amount} onChange={(e) => updateRow(idx, 'amount', e.target.value)} placeholder="Amount" />
            <button type="button" onClick={() => onChange(rows.filter((_, i) => i !== idx))} className="rounded-[8px] text-[#dc2626] hover:bg-[#fee2e2]"><Trash2 className="size-4 mx-auto" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function exportCsv(filename, headers, rows) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AccountsLineDocumentPage({
  title,
  recordLabel,
  api,
  Subnav,
  activeSection,
  onOpenSection,
  onNotify,
  partyConfig,
  dateField,
  statuses,
  hasGst = false,
  hasExtraCharges = false,
  hasVehicle = false,
  hasSiteAddress = false,
  extraHeaderFields = [],
}) {
  const [rows, setRows] = useState([]);
  const [parties, setParties] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modal, setModal] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

  const loadRows = useCallback(() => {
    setLoading(true);
    const params = { page_size: 1000 };
    if (statusFilter) params.status = statusFilter;
    api.list(params)
      .then((r) => setRows(normalizeApiRows(r)))
      .catch(() => onNotify(`Could not load ${title.toLowerCase()}.`, 'error'))
      .finally(() => setLoading(false));
  }, [api, statusFilter, title, onNotify]);

  useEffect(() => { loadRows(); }, [loadRows]);
  useEffect(() => {
    accountsModuleApi.parties.list({ page_size: 1000 }).then((r) => setParties(normalizeApiRows(r))).catch(() => {});
    projectApi.list({ page_size: 1000 }).then((r) => setProjects(normalizeApiRows(r))).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => [
      r.record_no, r[partyConfig.nameKey], r[partyConfig.displayKey], r.project_name, r.vehicle_no, r.site_address,
    ].some((v) => (v || '').toString().toLowerCase().includes(q)));
  }, [rows, search, partyConfig]);

  const summary = useMemo(() => ({
    count: filtered.length,
    total: filtered.reduce((sum, r) => sum + Number(r.total_amount || 0), 0),
  }), [filtered]);

  function defaultForm() {
    const base = {
      [dateField]: todayIso(),
      status: statuses[0],
      payment_mode: 'NEFT',
      payment_amount: '',
      lines: [emptyLine()],
      gst_type: 'CGST_SGST',
      cgst_percent: '9',
      sgst_percent: '9',
      igst_percent: '18',
      project: '',
      remarks: '',
    };
    base[partyConfig.key] = '';
    base[partyConfig.nameKey] = '';
    if (hasExtraCharges) base.extra_charges = [];
    if (hasVehicle) base.vehicle_no = '';
    if (hasSiteAddress) base.site_address = '';
    extraHeaderFields.forEach((f) => { base[f.name] = f.default ?? ''; });
    return base;
  }

  function openCreate() {
    setForm(defaultForm());
    setModal('edit');
  }

  function openEdit(item) {
    setForm({
      id: item.id,
      ...item,
      lines: (item.lines && item.lines.length) ? item.lines.map((l) => ({
        material_name: l.material_name,
        category: l.category || '',
        quantity: String(l.quantity),
        unit: l.unit || 'Nos',
        rate: String(l.rate),
      })) : [emptyLine()],
      extra_charges: (item.extra_charges || []).map((c) => ({ description: c.description, amount: String(c.amount) })),
      project: item.project || '',
      [partyConfig.key]: item[partyConfig.key] || '',
      cgst_percent: String(item.cgst_percent ?? '9'),
      sgst_percent: String(item.sgst_percent ?? '9'),
      igst_percent: String(item.igst_percent ?? '18'),
    });
    setModal('edit');
  }

  function buildPayload(f) {
    const body = { ...f };
    body.lines = (f.lines || []).filter((l) => l.material_name).map((l) => ({
      material_name: l.material_name,
      category: l.category || '',
      quantity: Number(l.quantity || 0),
      unit: l.unit || 'Nos',
      rate: Number(l.rate || 0),
    }));
    if (hasExtraCharges) {
      body.extra_charges = (f.extra_charges || []).filter((c) => c.description).map((c) => ({
        description: c.description,
        amount: Number(c.amount || 0),
      }));
    }
    body.project = f.project || null;
    body[partyConfig.key] = f[partyConfig.key] || null;
    body.payment_amount = f.payment_amount === '' ? 0 : Number(f.payment_amount || 0);
    if (hasGst) {
      body.cgst_percent = Number(f.cgst_percent || 0);
      body.sgst_percent = Number(f.sgst_percent || 0);
      body.igst_percent = Number(f.igst_percent || 0);
    }
    delete body.id;
    delete body.record_no;
    delete body.created_at;
    delete body.updated_at;
    delete body.created_by_name;
    delete body.project_name;
    delete body[partyConfig.displayKey];
    return body;
  }

  function saveForm() {
    setSaving(true);
    const payload = buildPayload(form);
    const req = form.id ? api.update(form.id, payload) : api.create(payload);
    req
      .then(() => {
        onNotify(`${recordLabel} ${form.id ? 'updated' : 'created'}.`, 'success');
        setModal(null);
        setForm(defaultForm());
        loadRows();
      })
      .catch((e) => onNotify(e.message || 'Save failed.', 'error'))
      .finally(() => setSaving(false));
  }

  function deleteRow(item) {
    if (!window.confirm(`Delete ${item.record_no}?`)) return;
    api.delete(item.id)
      .then(() => { onNotify(`${recordLabel} deleted.`, 'success'); loadRows(); })
      .catch(() => onNotify('Delete failed.', 'error'));
  }

  function handleExport() {
    exportCsv(
      `${title.replace(/\s+/g, '-').toLowerCase()}.csv`,
      ['No', 'Date', partyConfig.label, 'Project', 'Total', 'Status'],
      filtered.map((r) => [
        r.record_no,
        r[dateField],
        r[partyConfig.displayKey] || r[partyConfig.nameKey] || '—',
        r.project_name || '—',
        r.total_amount,
        r.status,
      ]),
    );
    onNotify('CSV exported.', 'success');
  }

  const previewTotals = useMemo(() => {
    const lineTotal = (form.lines || []).reduce((s, l) => s + Number(l.quantity || 0) * Number(l.rate || 0), 0);
    const extraTotal = (form.extra_charges || []).reduce((s, c) => s + Number(c.amount || 0), 0);
    const taxable = lineTotal + extraTotal;
    let gst = 0;
    if (hasGst) {
      if (form.gst_type === 'IGST') gst = taxable * Number(form.igst_percent || 0) / 100;
      else gst = taxable * (Number(form.cgst_percent || 0) + Number(form.sgst_percent || 0)) / 100;
    }
    return { lineTotal, extraTotal, taxable, gst, grand: taxable + gst };
  }, [form, hasGst]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-extrabold text-[#06135a]">{title}</h1>
          <p className="mt-1 text-[12px] font-semibold text-[#7b8ca8]">Solar CRM — project-linked billing & material documents</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={handleExport}><Download className="size-4" /> Export</Button>
          <Button type="button" onClick={openCreate}><Plus className="size-4" /> Add {recordLabel}</Button>
        </div>
      </div>

      {Subnav ? <Subnav activeSection={activeSection} onOpenSection={onOpenSection} /> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Records', value: summary.count },
          { label: 'Total Amount', value: fmtRs(summary.total) },
          { label: 'Filtered', value: filtered.length },
        ].map((card) => (
          <article key={card.label} className={cx(panelClass, 'p-4')}>
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#7b8ca8]">{card.label}</p>
            <p className="mt-1 font-display text-[22px] font-extrabold text-[#111827]">{card.value}</p>
          </article>
        ))}
      </section>

      <article className={cx(panelClass, 'p-4')}>
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9aaac0]" />
            <input className={cx(inputClass, 'pl-9')} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search no, party, project..." />
          </div>
          <select className={cx(inputClass, 'w-44')} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </article>

      <div className={dataPanelClass}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[13px]">
            <thead className="bg-[#f8fbff] text-[11px] font-extrabold uppercase tracking-wide text-[#7b8ca8]">
              <tr>
                <th className="px-4 py-3">No</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">{partyConfig.label}</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-[#7b8ca8]">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-[#7b8ca8]">No records found. Add your first {recordLabel.toLowerCase()}.</td></tr>
              ) : filtered.map((row) => (
                <tr key={row.id} className="border-t border-[#eef2f7] hover:bg-[#fbfdff]">
                  <td className="px-4 py-3 font-extrabold text-[#0b65e5]">{row.record_no}</td>
                  <td className="px-4 py-3">{fmtDate(row[dateField])}</td>
                  <td className="px-4 py-3 font-semibold">{row[partyConfig.displayKey] || row[partyConfig.nameKey] || '—'}</td>
                  <td className="px-4 py-3">{row.project_name || '—'}</td>
                  <td className="px-4 py-3 font-extrabold">{fmtRs(row.total_amount)}</td>
                  <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => setViewItem(row)} className="rounded-[8px] p-2 text-[#0b65e5] hover:bg-[#eef5ff]"><Eye className="size-4" /></button>
                      <button type="button" onClick={() => openEdit(row)} className="rounded-[8px] p-2 text-[#14853a] hover:bg-[#e8f8eb]"><Pencil className="size-4" /></button>
                      <button type="button" onClick={() => deleteRow(row)} className="rounded-[8px] p-2 text-[#dc2626] hover:bg-[#fee2e2]"><Trash2 className="size-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal === 'edit' ? (
        <ModalShell title={form.id ? `Edit ${recordLabel}` : `Add ${recordLabel}`} onClose={() => setModal(null)} wide>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Date"><input type="date" className={inputClass} value={form[dateField] || ''} onChange={(e) => setForm((f) => ({ ...f, [dateField]: e.target.value }))} /></Field>
            <Field label={partyConfig.label}>
              <select className={inputClass} value={form[partyConfig.key] || ''} onChange={(e) => setForm((f) => ({ ...f, [partyConfig.key]: e.target.value }))}>
                <option value="">Select party</option>
                {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label={`Or ${partyConfig.label} Name`}><input className={inputClass} value={form[partyConfig.nameKey] || ''} onChange={(e) => setForm((f) => ({ ...f, [partyConfig.nameKey]: e.target.value }))} /></Field>
            <Field label="Project">
              <select className={inputClass} value={form.project || ''} onChange={(e) => setForm((f) => ({ ...f, project: e.target.value }))}>
                <option value="">Link project (optional)</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.project_id} — {p.project_name}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className={inputClass} value={form.status || statuses[0]} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Payment Mode">
              <select className={inputClass} value={form.payment_mode || 'NEFT'} onChange={(e) => setForm((f) => ({ ...f, payment_mode: e.target.value }))}>
                {ACC_PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Paid Amount"><input type="number" className={inputClass} value={form.payment_amount ?? ''} onChange={(e) => setForm((f) => ({ ...f, payment_amount: e.target.value }))} /></Field>
            {hasVehicle ? <Field label="Vehicle / Dispatch Ref"><input className={inputClass} value={form.vehicle_no || ''} onChange={(e) => setForm((f) => ({ ...f, vehicle_no: e.target.value }))} placeholder="Site delivery vehicle" /></Field> : null}
            {hasSiteAddress ? <Field label="Site Address" className="md:col-span-2"><input className={inputClass} value={form.site_address || ''} onChange={(e) => setForm((f) => ({ ...f, site_address: e.target.value }))} /></Field> : null}
            {extraHeaderFields.map((f) => (
              <Field key={f.name} label={f.label}>
                {f.type === 'select' ? (
                  <select className={inputClass} value={form[f.name] || ''} onChange={(e) => setForm((prev) => ({ ...prev, [f.name]: e.target.value }))}>
                    {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input className={inputClass} value={form[f.name] || ''} onChange={(e) => setForm((prev) => ({ ...prev, [f.name]: e.target.value }))} />
                )}
              </Field>
            ))}
          </div>

          {hasGst ? (
            <div className="mt-4 grid gap-3 rounded-[10px] border border-[#e5eaf2] bg-[#f8fbff] p-4 md:grid-cols-4">
              <Field label="GST Type">
                <select className={inputClass} value={form.gst_type || 'CGST_SGST'} onChange={(e) => setForm((f) => ({ ...f, gst_type: e.target.value }))}>
                  {GST_TYPES.map((t) => <option key={t} value={t}>{t === 'CGST_SGST' ? 'CGST + SGST' : 'IGST'}</option>)}
                </select>
              </Field>
              {form.gst_type === 'IGST' ? (
                <Field label="IGST %"><input type="number" className={inputClass} value={form.igst_percent || ''} onChange={(e) => setForm((f) => ({ ...f, igst_percent: e.target.value }))} /></Field>
              ) : (
                <>
                  <Field label="CGST %"><input type="number" className={inputClass} value={form.cgst_percent || ''} onChange={(e) => setForm((f) => ({ ...f, cgst_percent: e.target.value }))} /></Field>
                  <Field label="SGST %"><input type="number" className={inputClass} value={form.sgst_percent || ''} onChange={(e) => setForm((f) => ({ ...f, sgst_percent: e.target.value }))} /></Field>
                </>
              )}
              <div className="flex items-end">
                <div className="w-full rounded-[8px] border border-[#d0e4ff] bg-white px-3 py-2 text-[12px] font-bold text-[#30466d]">
                  Preview GST: {fmtRs(previewTotals.gst)} · Grand: {fmtRs(previewTotals.grand)}
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-4 space-y-4">
            <LineItemsEditor lines={form.lines || []} onChange={(lines) => setForm((f) => ({ ...f, lines }))} />
            {hasExtraCharges ? <ExtraChargesEditor rows={form.extra_charges || []} onChange={(extra_charges) => setForm((f) => ({ ...f, extra_charges }))} /> : null}
            <Field label="Remarks"><textarea className={cx(inputClass, 'min-h-[72px] py-2')} value={form.remarks || ''} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} /></Field>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
            <Button type="button" onClick={saveForm} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </ModalShell>
      ) : null}

      {viewItem ? (
        <ModalShell title={viewItem.record_no} onClose={() => setViewItem(null)} wide>
          <div className="grid gap-3 text-[13px] md:grid-cols-2">
            <p><span className="font-bold text-[#7b8ca8]">Date:</span> {fmtDate(viewItem[dateField])}</p>
            <p><span className="font-bold text-[#7b8ca8]">{partyConfig.label}:</span> {viewItem[partyConfig.displayKey]}</p>
            <p><span className="font-bold text-[#7b8ca8]">Project:</span> {viewItem.project_name || '—'}</p>
            <p><span className="font-bold text-[#7b8ca8]">Total:</span> {fmtRs(viewItem.total_amount)}</p>
            <p><span className="font-bold text-[#7b8ca8]">Status:</span> <StatusBadge status={viewItem.status} /></p>
          </div>
          {(viewItem.lines || []).length > 0 ? (
            <div className="mt-4 overflow-x-auto rounded-[10px] border border-[#e5eaf2]">
              <table className="min-w-full text-left text-[12px]">
                <thead className="bg-[#f8fbff] font-extrabold text-[#7b8ca8]"><tr><th className="px-3 py-2">Item</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Rate</th><th className="px-3 py-2">Total</th></tr></thead>
                <tbody>
                  {viewItem.lines.map((l) => (
                    <tr key={l.id} className="border-t border-[#eef2f7]">
                      <td className="px-3 py-2">{l.material_name}</td>
                      <td className="px-3 py-2">{l.quantity} {l.unit}</td>
                      <td className="px-3 py-2">{fmtRs(l.rate)}</td>
                      <td className="px-3 py-2 font-extrabold">{fmtRs(l.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
            <Button type="button" onClick={() => { setViewItem(null); openEdit(viewItem); }}>Edit</Button>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}

export function PurchaseInvoicePage(props) {
  return (
    <AccountsLineDocumentPage
      {...props}
      title="Purchase Invoice"
      recordLabel="Purchase Invoice"
      api={accountsModuleApi.purchaseInvoices}
      partyConfig={{ key: 'supplier', nameKey: 'supplier_name', displayKey: 'supplier_display', label: 'Supplier' }}
      dateField="invoice_date"
      statuses={['Draft', 'Recorded', 'Paid', 'Cancelled']}
      hasGst
      hasExtraCharges
      extraHeaderFields={[{ name: 'category', label: 'Category', default: '' }]}
    />
  );
}

export function SellInvoicePage(props) {
  return (
    <AccountsLineDocumentPage
      {...props}
      title="Sell Invoice"
      recordLabel="Sell Invoice"
      api={accountsModuleApi.sellInvoices}
      partyConfig={{ key: 'party', nameKey: 'party_name', displayKey: 'party_display', label: 'Customer' }}
      dateField="invoice_date"
      statuses={['Pending', 'Issued', 'Paid', 'Cancelled']}
      hasGst
      extraHeaderFields={[
        { name: 'gst_number', label: 'GST No', default: '' },
        { name: 'branch', label: 'Branch', default: '' },
      ]}
    />
  );
}

export function PurchaseChallanPage(props) {
  return (
    <AccountsLineDocumentPage
      {...props}
      title="Purchase Challan"
      recordLabel="Purchase Challan"
      api={accountsModuleApi.purchaseChallans}
      partyConfig={{ key: 'supplier', nameKey: 'supplier_name', displayKey: 'supplier_display', label: 'Supplier' }}
      dateField="challan_date"
      statuses={['Open', 'Received', 'Cancelled']}
      hasVehicle
    />
  );
}

export function SellChallanPage(props) {
  return (
    <AccountsLineDocumentPage
      {...props}
      title="Sell Challan"
      recordLabel="Sell Challan"
      api={accountsModuleApi.sellChallans}
      partyConfig={{ key: 'party', nameKey: 'party_name', displayKey: 'party_display', label: 'Customer / Site' }}
      dateField="challan_date"
      statuses={['Open', 'Dispatched', 'Delivered', 'Cancelled']}
      hasVehicle
      hasSiteAddress
    />
  );
}

export function GstLedgerPage({ Subnav, activeSection, onOpenSection, onNotify }) {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openingForm, setOpeningForm] = useState({ igst_opening: '', cgst_opening: '', sgst_opening: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    accountsModuleApi.gstLedger(year, month)
      .then((data) => {
        setReport(data);
        setOpeningForm({
          igst_opening: String(data?.opening?.igst ?? 0),
          cgst_opening: String(data?.opening?.cgst ?? 0),
          sgst_opening: String(data?.opening?.sgst ?? 0),
        });
      })
      .catch(() => onNotify('Could not load GST ledger.', 'error'))
      .finally(() => setLoading(false));
  }, [year, month, onNotify]);

  useEffect(() => { load(); }, [load]);

  function saveOpening() {
    setSaving(true);
    accountsModuleApi.saveGstOpening({
      year: Number(year),
      month: Number(month),
      igst_opening: Number(openingForm.igst_opening || 0),
      cgst_opening: Number(openingForm.cgst_opening || 0),
      sgst_opening: Number(openingForm.sgst_opening || 0),
    })
      .then(() => { onNotify('Opening balance saved.', 'success'); load(); })
      .catch((e) => onNotify(e.message || 'Save failed.', 'error'))
      .finally(() => setSaving(false));
  }

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-[22px] font-extrabold text-[#06135a]">GST Ledger</h1>
        <p className="mt-1 text-[12px] font-semibold text-[#7b8ca8]">Monthly input/output GST from purchase & sales invoices</p>
      </div>
      {Subnav ? <Subnav activeSection={activeSection} onOpenSection={onOpenSection} /> : null}

      <article className={cx(panelClass, 'p-4')}>
        <div className="flex flex-wrap gap-3">
          <Field label="Year" className="w-32">
            <select className={inputClass} value={year} onChange={(e) => setYear(e.target.value)}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </Field>
          <Field label="Month" className="w-32">
            <select className={inputClass} value={month} onChange={(e) => setMonth(e.target.value)}>
              {months.map((m) => <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleString('en-IN', { month: 'long' })}</option>)}
            </select>
          </Field>
        </div>
      </article>

      <section className="grid gap-3 lg:grid-cols-3">
        {['igst', 'cgst', 'sgst'].map((key) => (
          <article key={key} className={cx(panelClass, 'p-4')}>
            <p className="text-[11px] font-extrabold uppercase text-[#7b8ca8]">{key.toUpperCase()}</p>
            <div className="mt-2 space-y-1 text-[12px]">
              <div className="flex justify-between"><span>Opening</span><strong>{fmtRs(report?.opening?.[key])}</strong></div>
              <div className="flex justify-between text-[#14853a]"><span>Output</span><strong>{fmtRs(report?.output?.[key])}</strong></div>
              <div className="flex justify-between text-[#dc2626]"><span>Input</span><strong>{fmtRs(report?.input?.[key])}</strong></div>
              <div className="flex justify-between border-t border-[#eef2f7] pt-1 font-extrabold"><span>Closing</span><span>{fmtRs(report?.closing?.[key])}</span></div>
            </div>
          </article>
        ))}
      </section>

      <article className={cx(panelClass, 'p-4')}>
        <p className="mb-3 text-[13px] font-extrabold text-[#30466d]">Set Opening Balance</p>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="IGST Opening"><input type="number" className={inputClass} value={openingForm.igst_opening} onChange={(e) => setOpeningForm((f) => ({ ...f, igst_opening: e.target.value }))} /></Field>
          <Field label="CGST Opening"><input type="number" className={inputClass} value={openingForm.cgst_opening} onChange={(e) => setOpeningForm((f) => ({ ...f, cgst_opening: e.target.value }))} /></Field>
          <Field label="SGST Opening"><input type="number" className={inputClass} value={openingForm.sgst_opening} onChange={(e) => setOpeningForm((f) => ({ ...f, sgst_opening: e.target.value }))} /></Field>
          <div className="flex items-end"><Button type="button" onClick={saveOpening} disabled={saving}>{saving ? 'Saving...' : 'Save Opening'}</Button></div>
        </div>
      </article>

      <div className={dataPanelClass}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[13px]">
            <thead className="bg-[#f8fbff] text-[11px] font-extrabold uppercase tracking-wide text-[#7b8ca8]">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Doc No</th>
                <th className="px-4 py-3">Party</th>
                <th className="px-4 py-3">Taxable</th>
                <th className="px-4 py-3">IGST</th>
                <th className="px-4 py-3">CGST</th>
                <th className="px-4 py-3">SGST</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-[#7b8ca8]">Loading...</td></tr>
              ) : (report?.entries || []).length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-[#7b8ca8]">No GST entries for this month.</td></tr>
              ) : (report.entries || []).map((row, idx) => (
                <tr key={`${row.doc_no}-${idx}`} className="border-t border-[#eef2f7]">
                  <td className="px-4 py-3">{fmtDate(row.date)}</td>
                  <td className="px-4 py-3">{row.doc_type}</td>
                  <td className="px-4 py-3 font-extrabold text-[#0b65e5]">{row.doc_no}</td>
                  <td className="px-4 py-3">{row.party}</td>
                  <td className="px-4 py-3">{fmtRs(row.taxable)}</td>
                  <td className="px-4 py-3">{fmtRs(row.igst)}</td>
                  <td className="px-4 py-3">{fmtRs(row.cgst)}</td>
                  <td className="px-4 py-3">{fmtRs(row.sgst)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
