import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, X } from 'lucide-react';
import { accountsModuleApi } from '../api.js';

function money(v) {
  const n = Number(v || 0);
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/**
 * Allocate one Cash Receipt across outstanding Sell Invoices (Customer/Project aware).
 * Does not create a second receipt — only InvoicePaymentAllocation rows.
 */
export default function InvoicePaymentAllocationPanel({
  payment,
  onClose,
  onNotify,
  onSaved,
}) {
  const paymentId = payment?.id;
  const partyId = payment?.party;
  const projectId = payment?.project || '';
  const receiptAmount = Number(payment?.amount || 0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [available, setAvailable] = useState(null);
  const [amounts, setAmounts] = useState({});
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!partyId || !paymentId) {
      setInvoices([]);
      setLoading(false);
      setError('Customer party is required on the receipt before invoice allocation.');
      return;
    }
    setLoading(true);
    setError('');
    accountsModuleApi.invoicePaymentAllocations.eligibleInvoices({
      customer_id: partyId,
      project_id: projectId || undefined,
      payment_id: paymentId,
    })
      .then((res) => {
        const rows = Array.isArray(res?.invoices) ? res.invoices : [];
        setInvoices(rows);
        setAvailable(res?.payment_available != null ? Number(res.payment_available) : receiptAmount);
        setAmounts({});
      })
      .catch((err) => {
        setInvoices([]);
        setError(err?.message || 'Could not load outstanding invoices.');
      })
      .finally(() => setLoading(false));
  }, [partyId, projectId, paymentId, receiptAmount]);

  useEffect(() => { load(); }, [load]);

  const totalAllocated = useMemo(
    () => Object.values(amounts).reduce((s, v) => s + (Number(v) || 0), 0),
    [amounts],
  );
  const remaining = (available != null ? available : receiptAmount) - totalAllocated;
  const overBudget = remaining < -0.001;

  function setAmount(invoiceId, value) {
    setAmounts((prev) => ({ ...prev, [invoiceId]: value }));
  }

  async function handleSave() {
    const lines = invoices
      .map((inv) => ({
        invoice_id: inv.id,
        allocated_amount: Number(amounts[inv.id] || 0),
      }))
      .filter((line) => line.allocated_amount > 0);

    if (!lines.length) {
      onNotify?.('Enter at least one allocation amount.', 'error');
      return;
    }
    if (overBudget) {
      onNotify?.('Total allocation exceeds available receipt amount.', 'error');
      return;
    }
    for (const line of lines) {
      const inv = invoices.find((r) => r.id === line.invoice_id);
      if (inv && line.allocated_amount > Number(inv.outstanding) + 0.001) {
        onNotify?.(`Allocation exceeds outstanding for ${inv.invoice_no}.`, 'error');
        return;
      }
    }

    setSaving(true);
    try {
      await accountsModuleApi.invoicePaymentAllocations.bulk({
        payment_id: paymentId,
        lines,
      });
      onNotify?.('Invoice allocations saved.', 'success');
      onSaved?.();
      onClose?.();
    } catch (err) {
      onNotify?.(err?.message || 'Allocation failed.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[14px] border border-[#d9e4f2] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#edf2f8] px-5 py-4">
          <div>
            <h3 className="font-display text-[17px] font-extrabold text-[#06135a]">Allocate to Sell Invoices</h3>
            <p className="mt-0.5 text-[12px] font-semibold text-[#7a8fa6]">
              Receipt {payment?.record_no || payment?.reference_no || paymentId} · {money(receiptAmount)}
              {available != null ? ` · Available ${money(available)}` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-[8px] p-2 text-[#53647f] hover:bg-[#f3f7fc]">
            <X className="size-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {error ? (
            <div className="mb-3 rounded-[10px] border border-[#fecaca] bg-[#fff5f5] px-3 py-2 text-[12px] font-semibold text-[#b91c1c]">
              {error}
              <button type="button" onClick={load} className="ml-2 font-extrabold text-[#0b65e5] underline">Retry</button>
            </div>
          ) : null}

          {loading ? (
            <p className="flex items-center gap-2 py-10 justify-center text-[13px] font-bold text-[#7a8fa6]">
              <Loader2 className="size-4 animate-spin" /> Loading outstanding invoices…
            </p>
          ) : invoices.length === 0 ? (
            <p className="py-10 text-center text-[13px] font-bold text-[#7a8fa6]">
              No outstanding Sell Invoices for this Customer/Project.
            </p>
          ) : (
            <table className="min-w-full text-left text-[13px]">
              <thead className="bg-[#f8fbff] text-[11px] font-extrabold uppercase tracking-wide text-[#7b8ca8]">
                <tr>
                  <th className="px-3 py-2">Invoice</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Paid</th>
                  <th className="px-3 py-2">Outstanding</th>
                  <th className="px-3 py-2">Allocate</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-[#eef2f7]">
                    <td className="px-3 py-2 font-extrabold text-[#0b65e5]">{inv.invoice_no}</td>
                    <td className="px-3 py-2">{inv.invoice_date || '—'}</td>
                    <td className="px-3 py-2 font-semibold">{money(inv.total_amount)}</td>
                    <td className="px-3 py-2">{money(inv.already_paid)}</td>
                    <td className="px-3 py-2 font-extrabold text-[#06135a]">{money(inv.outstanding)}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        max={inv.outstanding}
                        value={amounts[inv.id] ?? ''}
                        onChange={(e) => setAmount(inv.id, e.target.value)}
                        className="h-9 w-28 rounded-[8px] border border-[#d9e4f2] px-2 text-[13px] font-bold text-[#1e3261] outline-none focus:border-[#0b65e5]"
                        placeholder="0"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf2f8] bg-[#f8fbff] px-5 py-4">
          <div className="text-[12px] font-bold text-[#53647f]">
            Allocated <span className="font-extrabold text-[#06135a]">{money(totalAllocated)}</span>
            {' · '}
            Unallocated <span className={`font-extrabold ${overBudget ? 'text-[#dc2626]' : 'text-[#0d9f4a]'}`}>{money(remaining)}</span>
            <button type="button" onClick={load} className="ml-3 inline-flex items-center gap-1 text-[#0b65e5]">
              <RefreshCw className="size-3.5" /> Refresh
            </button>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-10 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-extrabold text-[#53647f]">
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || loading || overBudget || !invoices.length}
              onClick={handleSave}
              className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#0b65e5] px-4 text-[13px] font-extrabold text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Confirm Allocation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Sell Invoice payment history / settlement panel.
 */
export function InvoicePaymentHistoryPanel({ invoiceId, onNotify, canReverse = true }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [reversingId, setReversingId] = useState(null);
  const [reason, setReason] = useState('');

  const load = useCallback(() => {
    if (!invoiceId) return;
    setLoading(true);
    accountsModuleApi.sellInvoicePaymentSummary(invoiceId)
      .then(setSummary)
      .catch((err) => onNotify?.(err?.message || 'Could not load payment summary.', 'error'))
      .finally(() => setLoading(false));
  }, [invoiceId, onNotify]);

  useEffect(() => { load(); }, [load]);

  async function handleReverse(allocId) {
    if (!reason.trim()) {
      onNotify?.('Reversal reason is required.', 'error');
      return;
    }
    try {
      await accountsModuleApi.invoicePaymentAllocations.reverse(allocId, { reversal_reason: reason.trim() });
      onNotify?.('Allocation reversed.', 'success');
      setReversingId(null);
      setReason('');
      load();
    } catch (err) {
      onNotify?.(err?.message || 'Reverse failed.', 'error');
    }
  }

  if (loading) {
    return <p className="py-4 text-[12px] font-bold text-[#7a8fa6]">Loading payment history…</p>;
  }
  if (!summary) {
    return <p className="py-4 text-[12px] font-bold text-[#7a8fa6]">Payment summary unavailable.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-4 text-[12px]">
        <div className="rounded-[10px] border border-[#e7eef7] bg-[#f8fbff] p-3">
          <p className="font-bold text-[#7a8fa6]">Invoice Amount</p>
          <p className="mt-1 font-extrabold text-[#06135a]">{money(summary.invoice_total)}</p>
        </div>
        <div className="rounded-[10px] border border-[#e7eef7] bg-[#f8fbff] p-3">
          <p className="font-bold text-[#7a8fa6]">Total Paid</p>
          <p className="mt-1 font-extrabold text-[#06135a]">{money(summary.total_allocated || summary.legacy_manual_paid)}</p>
        </div>
        <div className="rounded-[10px] border border-[#e7eef7] bg-[#f8fbff] p-3">
          <p className="font-bold text-[#7a8fa6]">Balance Due</p>
          <p className="mt-1 font-extrabold text-[#06135a]">{money(summary.balance_due)}</p>
        </div>
        <div className="rounded-[10px] border border-[#e7eef7] bg-[#f8fbff] p-3">
          <p className="font-bold text-[#7a8fa6]">Status</p>
          <p className="mt-1 font-extrabold text-[#06135a]">{summary.payment_status}</p>
        </div>
      </div>
      {summary.legacy_unreconciled ? (
        <p className="rounded-[8px] border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[11px] font-semibold text-[#92400e]">
          Legacy manual paid amount exists without linked Payment allocations — reconcile carefully; do not invent receipts.
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-[12px] border border-[#e7eef7]">
        <table className="min-w-full text-left text-[12px]">
          <thead className="bg-[#f8fbff] text-[10px] font-extrabold uppercase text-[#7b8ca8]">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Receipt</th>
              <th className="px-3 py-2">Mode</th>
              <th className="px-3 py-2">Allocated</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Notes</th>
              {canReverse ? <th className="px-3 py-2">Action</th> : null}
            </tr>
          </thead>
          <tbody>
            {(summary.allocations || []).length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-[#7a8fa6]">No invoice allocations yet.</td></tr>
            ) : summary.allocations.map((row) => (
              <tr key={row.id} className="border-t border-[#eef2f7]">
                <td className="px-3 py-2">{row.payment_date || '—'}</td>
                <td className="px-3 py-2 font-extrabold text-[#0b65e5]">{row.receipt_no}</td>
                <td className="px-3 py-2">{row.payment_mode || '—'}</td>
                <td className="px-3 py-2 font-extrabold">{money(row.allocated_amount)}</td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2">{row.notes || row.reversal_reason || '—'}</td>
                {canReverse ? (
                  <td className="px-3 py-2">
                    {row.status === 'Active' ? (
                      reversingId === row.id ? (
                        <div className="flex flex-col gap-1">
                          <input
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Reversal reason"
                            className="h-8 rounded-[6px] border border-[#d9e4f2] px-2 text-[11px]"
                          />
                          <div className="flex gap-1">
                            <button type="button" onClick={() => handleReverse(row.id)} className="rounded bg-[#dc2626] px-2 py-1 text-[10px] font-extrabold text-white">Confirm</button>
                            <button type="button" onClick={() => { setReversingId(null); setReason(''); }} className="rounded border px-2 py-1 text-[10px] font-bold">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setReversingId(row.id)} className="text-[11px] font-extrabold text-[#dc2626]">Reverse</button>
                      )
                    ) : '—'}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
