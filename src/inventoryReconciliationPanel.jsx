import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { inventoryApi } from './api.js';
import Button from './components/ui/Button.jsx';

/**
 * Read-only stock ledger reconciliation findings.
 * No repair / rewrite actions — audit only.
 */
export default function InventoryReconciliationPanel({ onNotify }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ date_from: '', date_to: '' });

  const load = useCallback(() => {
    setLoading(true);
    inventoryApi.movements.reconciliation(filters)
      .then((res) => setData(res))
      .catch((e) => {
        setData(null);
        onNotify?.(e.message || 'Could not load stock reconciliation.', 'error');
      })
      .finally(() => setLoading(false));
  }, [filters, onNotify]);

  useEffect(() => { load(); }, [load]);

  const summary = data?.summary || {};
  const findings = data?.findings || [];

  return (
    <div className="space-y-3 rounded-[12px] border border-[#dbe5f2] bg-white/90 p-4 shadow-[0_10px_24px_rgba(24,48,87,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[14px] font-extrabold text-[#1e2a38]">Stock Reconciliation (read-only)</h3>
          <p className="text-[12px] font-semibold text-[#53647f]">
            Detects balance mismatches, orphan movements, duplicates and double-OUT risk. Does not rewrite stock.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            className="h-9 rounded-[8px] border border-[#d9e2ec] px-2 text-[12px]"
            value={filters.date_from}
            onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
          />
          <input
            type="date"
            className="h-9 rounded-[8px] border border-[#d9e2ec] px-2 text-[12px]"
            value={filters.date_to}
            onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
          />
          <Button type="button" size="sm" variant="secondary" onClick={load} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Mismatches', summary.balance_mismatches],
          ['Negative', summary.negative_stock],
          ['Duplicates', summary.duplicate_document_movements],
          ['Orphans', summary.orphan_source_movements],
          ['Missing Project', summary.missing_project],
          ['Double-OUT', summary.double_out_risk],
        ].map(([label, val]) => (
          <div key={label} className="rounded-[8px] border border-[#eef2f7] bg-[#f8fbff] px-3 py-2">
            <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#7a8fa6]">{label}</p>
            <p className="text-[16px] font-extrabold text-[#1e2a38]">{val ?? '—'}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[10px] border border-[#e5eaf2]">
        <table className="min-w-full text-left text-[12px]">
          <thead className="bg-[#f8fbff] text-[11px] font-extrabold uppercase tracking-wide text-[#7b8ca8]">
            <tr>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Item / Ref</th>
              <th className="px-3 py-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="px-3 py-6 text-center text-[#7b8ca8]">Loading…</td></tr>
            ) : findings.length === 0 ? (
              <tr><td colSpan={3} className="px-3 py-6 text-center text-[#14853a] font-semibold">No findings — ledger looks consistent.</td></tr>
            ) : findings.map((f, idx) => (
              <tr key={`${f.type}-${idx}`} className="border-t border-[#eef2f7]">
                <td className="px-3 py-2 font-extrabold text-[#9a5b00]">{f.type}</td>
                <td className="px-3 py-2">
                  {f.item_name || f.reference_no || f.movement_id || '—'}
                  {f.reference_type ? <span className="text-[#7b8ca8]"> · {f.reference_type}</span> : null}
                </td>
                <td className="px-3 py-2 text-[#53647f]">
                  {f.difference != null ? `Δ ${f.difference} (expected ${f.expected_balance}, recorded ${f.recorded_balance})` : null}
                  {f.jobs_out_qty != null ? `Jobs OUT ${f.jobs_out_qty} + Sell OUT ${f.sell_invoice_out_qty}` : null}
                  {f.count != null ? `count=${f.count}` : null}
                  {f.recorded_balance != null && f.difference == null && f.type === 'negative_stock'
                    ? `stock=${f.recorded_balance}` : null}
                  {f.project_id ? ` project=#${f.project_id}` : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
