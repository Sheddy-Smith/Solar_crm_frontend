import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { User, Building2, Package, X } from 'lucide-react';
import { accountsModuleApi, workforceApi } from './api.js';

const PAYEE_TYPES = [
  { value: 'Vendor', label: 'Vendor (Service Provider)', selectLabel: 'Select Vendor', icon: Building2 },
  { value: 'Labour', label: 'Employee (Worker)', selectLabel: 'Select Labour', icon: User },
  { value: 'Supplier', label: 'Supplier (Material)', selectLabel: 'Select Supplier', icon: Package },
  { value: 'Other', label: 'Other', selectLabel: 'Payee Name', icon: User },
];

const PAYMENT_MODES = ['Cash', 'Cheque', 'NEFT', 'RTGS', 'UPI', 'IMPS', 'Transfer', 'Other'];

const inputCls =
  'h-11 w-full rounded-[8px] border border-[#dce6f3] bg-white px-3 text-[14px] text-[#1e2a38] outline-none transition placeholder:text-[#94a3b8] focus:border-[#0b65e5] focus:ring-4 focus:ring-[#0b65e5]/10';
const labelCls = 'mb-1.5 block text-[13px] font-semibold text-[#34466c]';

function normalizeRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function RequiredMark() {
  return <span className="text-[#ef4444]"> *</span>;
}

export function PaymentVoucherFormModal({
  title = 'Add Payment Voucher',
  form,
  setForm,
  onClose,
  onSave,
  saving,
  requiredOk,
  isEdit = false,
}) {
  const [vendors, setVendors] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingOptions(true);
    Promise.all([
      accountsModuleApi.parties.list({ account_type: 'Vendor', page_size: 2000 }),
      accountsModuleApi.parties.list({ account_type: 'Supplier', page_size: 2000 }),
      workforceApi.listEmployees({ page_size: 2000 }),
    ])
      .then(([vendorRes, supplierRes, employeeRes]) => {
        if (cancelled) return;
        setVendors(normalizeRows(vendorRes));
        setSuppliers(normalizeRows(supplierRes));
        setEmployees(normalizeRows(employeeRes));
      })
      .catch(() => {
        if (cancelled) return;
        setVendors([]);
        setSuppliers([]);
        setEmployees([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });
    return () => { cancelled = true; };
  }, []);

  const payeeType = form.payee_type || 'Labour';
  const typeMeta = PAYEE_TYPES.find((t) => t.value === payeeType) || PAYEE_TYPES[1];

  const options = useMemo(() => {
    if (payeeType === 'Vendor') {
      return vendors.map((row) => ({
        id: String(row.id),
        name: row.name,
        detail: row,
      }));
    }
    if (payeeType === 'Supplier') {
      return suppliers.map((row) => ({
        id: String(row.id),
        name: row.name,
        detail: row,
      }));
    }
    if (payeeType === 'Labour') {
      return employees.map((row) => ({
        id: String(row.id),
        name: row.name,
        detail: row,
      }));
    }
    return [];
  }, [payeeType, vendors, suppliers, employees]);

  const selectedPayee = useMemo(() => {
    if (payeeType === 'Other') return null;
    if (form.payee_id) {
      return options.find((row) => row.id === String(form.payee_id)) || null;
    }
    if (form.payee_name) {
      return options.find((row) => row.name === form.payee_name) || null;
    }
    return null;
  }, [options, form.payee_id, form.payee_name, payeeType]);

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    if (payeeType === 'Other' || form.payee_id || !form.payee_name || !options.length) return;
    const match = options.find((row) => row.name === form.payee_name);
    if (match) {
      setForm((prev) => ({ ...prev, payee_id: match.id, payee_name: match.name }));
    }
  }, [options, payeeType, form.payee_id, form.payee_name, setForm]);

  const onPayeeTypeChange = (nextType) => {
    update({
      payee_type: nextType,
      payee_id: '',
      payee_name: nextType === 'Other' ? (form.payee_name || '') : '',
    });
  };

  const onPayeeSelect = (id) => {
    const found = options.find((row) => row.id === String(id));
    update({
      payee_id: id,
      payee_name: found?.name || '',
    });
  };

  const TypeIcon = typeMeta.icon;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[16px] bg-white shadow-[0_30px_70px_rgba(17,24,39,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#edf2f8] px-5 py-4">
          <h2 className="text-[18px] font-extrabold text-[#111827]">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-[#7585a2] hover:bg-[#f5f7fb]" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>Voucher Date<RequiredMark /></span>
              <input
                type="date"
                className={inputCls}
                value={form.voucher_date || ''}
                onChange={(e) => update({ voucher_date: e.target.value })}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Voucher No</span>
              <input
                type="text"
                className={`${inputCls} bg-[#f8fafc] text-[#64748b]`}
                value={form.voucher_no || ''}
                placeholder="Auto-generated"
                readOnly
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>Payee Type<RequiredMark /></span>
              <select
                className={inputCls}
                value={payeeType}
                onChange={(e) => onPayeeTypeChange(e.target.value)}
              >
                {PAYEE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </label>

            {payeeType === 'Other' ? (
              <label className="block">
                <span className={labelCls}>Payee Name<RequiredMark /></span>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Enter payee name"
                  value={form.payee_name || ''}
                  onChange={(e) => update({ payee_name: e.target.value, payee_id: '' })}
                />
              </label>
            ) : (
              <label className="block">
                <span className={labelCls}>{typeMeta.selectLabel}<RequiredMark /></span>
                <select
                  className={inputCls}
                  value={selectedPayee?.id || form.payee_id || ''}
                  onChange={(e) => onPayeeSelect(e.target.value)}
                  disabled={loadingOptions}
                >
                  <option value="">{loadingOptions ? 'Loading...' : 'Select...'}</option>
                  {options.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                      {payeeType === 'Labour' && row.detail.employee_id ? ` (${row.detail.employee_id})` : ''}
                      {(payeeType === 'Vendor' || payeeType === 'Supplier') && row.detail.phone ? ` · ${row.detail.phone}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {selectedPayee ? (
            <div className="rounded-[12px] border border-[#d9ecff] bg-[#f3f9ff] p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-white text-[#0b65e5] shadow-[0_4px_12px_rgba(11,101,229,0.12)]">
                  <TypeIcon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#64748b]">
                    {typeMeta.label} details
                  </p>
                  <p className="mt-1 text-[15px] font-extrabold text-[#1e3261]">{selectedPayee.name}</p>
                  {payeeType === 'Labour' ? (
                    <div className="mt-2 grid gap-1 text-[12px] font-semibold text-[#475569] sm:grid-cols-2">
                      <p>ID: <span className="font-extrabold text-[#1e3261]">{selectedPayee.detail.employee_id || '—'}</span></p>
                      <p>Mobile: <span className="font-extrabold text-[#1e3261]">{selectedPayee.detail.mobile || '—'}</span></p>
                      <p>Skill: <span className="font-extrabold text-[#1e3261]">{selectedPayee.detail.skill_trade || selectedPayee.detail.department || '—'}</span></p>
                      <p>Status: <span className="font-extrabold text-[#1e3261]">{selectedPayee.detail.status || '—'}</span></p>
                      <p className="sm:col-span-2 mt-1 text-[#0b65e5]">
                        Completed voucher will be posted to this employee&apos;s account (Employee Ledger).
                      </p>
                    </div>
                  ) : (
                    <div className="mt-2 grid gap-1 text-[12px] font-semibold text-[#475569] sm:grid-cols-2">
                      <p>Phone: <span className="font-extrabold text-[#1e3261]">{selectedPayee.detail.phone || '—'}</span></p>
                      <p>Company: <span className="font-extrabold text-[#1e3261]">{selectedPayee.detail.company || '—'}</span></p>
                      <p>City: <span className="font-extrabold text-[#1e3261]">{selectedPayee.detail.city || '—'}</span></p>
                      <p>Balance: <span className="font-extrabold text-[#1e3261]">{formatMoney(selectedPayee.detail.balance)}</span></p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>Payment Mode<RequiredMark /></span>
              <select
                className={inputCls}
                value={form.payment_mode || 'Cash'}
                onChange={(e) => update({ payment_mode: e.target.value })}
              >
                {PAYMENT_MODES.map((mode) => (
                  <option key={mode} value={mode}>{mode}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>Amount (₹)<RequiredMark /></span>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputCls}
                placeholder="0.00"
                value={form.amount ?? ''}
                onChange={(e) => update({ amount: e.target.value })}
              />
            </label>
          </div>

          <label className="block">
            <span className={labelCls}>Particulars</span>
            <input
              type="text"
              className={inputCls}
              placeholder="e.g., Payment for service, Material payment"
              value={form.particulars || ''}
              onChange={(e) => update({ particulars: e.target.value })}
            />
          </label>

          <label className="block">
            <span className={labelCls}>Notes</span>
            <textarea
              rows={3}
              className="w-full rounded-[8px] border border-[#dce6f3] bg-white px-3 py-2 text-[14px] text-[#1e2a38] outline-none transition placeholder:text-[#94a3b8] focus:border-[#0b65e5] focus:ring-4 focus:ring-[#0b65e5]/10"
              placeholder="Additional notes..."
              value={form.notes || ''}
              onChange={(e) => update({ notes: e.target.value })}
            />
          </label>
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-[#edf2f8] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-[8px] px-5 text-[14px] font-semibold text-[#53647f] hover:bg-[#f8fafc]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !requiredOk}
            className="h-10 rounded-[8px] bg-[#ea5a4c] px-5 text-[14px] font-extrabold text-white shadow-[0_10px_20px_rgba(234,90,76,0.25)] transition hover:bg-[#dc4a3c] disabled:opacity-60"
          >
            {saving ? 'Saving...' : isEdit ? 'Update Voucher' : 'Save Voucher'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function splitVoucherParticulars(particulars = '') {
  const text = String(particulars || '');
  const marker = '\nNotes:\n';
  const idx = text.indexOf(marker);
  if (idx === -1) return { particulars: text, notes: '' };
  return {
    particulars: text.slice(0, idx).trim(),
    notes: text.slice(idx + marker.length).trim(),
  };
}

export function mergeVoucherParticulars(particulars, notes) {
  const main = String(particulars || '').trim();
  const extra = String(notes || '').trim();
  if (!extra) return main;
  if (!main) return `Notes:\n${extra}`;
  return `${main}\nNotes:\n${extra}`;
}
