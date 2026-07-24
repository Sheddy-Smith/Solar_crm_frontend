import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, RotateCcw, Search, Trash2 } from 'lucide-react';
import { settingsApi } from './api.js';
import { cx } from './lib/utils.js';

function formatWhen(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SettingsRecycleBinPage({ onNotify }) {
  const [rows, setRows] = useState([]);
  const [retentionDays, setRetentionDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('All');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await settingsApi.recycleBin.list({
        search: search.trim() || undefined,
        entity_type: entityFilter === 'All' ? undefined : entityFilter,
      });
      setRows(Array.isArray(data?.results) ? data.results : []);
      if (data?.retention_days) setRetentionDays(data.retention_days);
    } catch (err) {
      onNotify?.(err.message || 'Could not load recycle bin.', 'error');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search, entityFilter, onNotify]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => rows, [rows]);

  const restoreItem = async (row) => {
    setBusyId(row.id);
    try {
      await settingsApi.recycleBin.restore({
        entity_type: row.entity_type,
        object_id: row.object_id,
      });
      onNotify?.(`${row.title} restored.`, 'success');
      await load();
    } catch (err) {
      onNotify?.(err.message || 'Restore failed.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const permanentDelete = async (row) => {
    if (!window.confirm(`Permanently delete "${row.title}"? This cannot be undone.`)) return;
    setBusyId(row.id);
    try {
      await settingsApi.recycleBin.permanentDelete(row.id);
      onNotify?.(`${row.title} permanently deleted.`, 'success');
      await load();
    } catch (err) {
      onNotify?.(err.message || 'Delete failed.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const purgeExpired = async () => {
    setBusyId('purge');
    try {
      const data = await settingsApi.recycleBin.purge();
      onNotify?.(
        `Purged ${data?.leads ?? 0} lead(s) and ${data?.follow_ups ?? 0} follow-up(s).`,
        'success',
      );
      await load();
    } catch (err) {
      onNotify?.(err.message || 'Purge failed.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-display text-[18px] font-extrabold text-[#102446]">Recycle Bin</h2>
          <p className="mt-1 text-[12px] font-semibold text-[#7585a2]">
            Deleted leads and follow-ups from CRM and Tele Executive land here.
            Items auto-delete after {retentionDays} days.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex h-10 items-center gap-2 rounded-[9px] border border-[#dbe4f0] bg-white px-3 text-[12px] font-extrabold text-[#1d4ed8]"
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </button>
          <button
            type="button"
            onClick={purgeExpired}
            disabled={busyId === 'purge'}
            className="inline-flex h-10 items-center gap-2 rounded-[9px] border border-[#fecaca] bg-white px-3 text-[12px] font-extrabold text-[#dc2626] disabled:opacity-50"
          >
            <Trash2 className="size-3.5" />
            Purge expired
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-[9px] border border-[#dbe4f0] bg-white px-3">
          <Search className="size-4 text-[#8a98af]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, mobile, project..."
            className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold outline-none"
          />
        </label>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="h-10 rounded-[9px] border border-[#dbe4f0] bg-white px-3 text-[13px] font-bold outline-none"
        >
          {['All', 'Lead', 'Follow-up'].map((option) => (
            <option key={option} value={option}>{option === 'All' ? 'All types' : option}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-[#e2e9f3] bg-white shadow-[0_10px_26px_rgba(23,43,77,0.06)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#e8eef6] text-[11px] font-extrabold uppercase tracking-wide text-[#7585a2]">
                <th className="px-3 py-3">Item</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Source</th>
                <th className="px-3 py-3">Deleted by</th>
                <th className="px-3 py-3">Deleted on</th>
                <th className="px-3 py-3">Auto-delete</th>
                <th className="px-3 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-[13px] font-bold text-[#7585a2]">
                    Loading recycle bin...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-[13px] font-bold text-[#7585a2]">
                    Recycle bin is empty.
                  </td>
                </tr>
              )}
              {!loading && filtered.map((row) => (
                <tr key={row.id} className="border-b border-[#f1f5fa] text-[13px] font-bold text-[#33456b]">
                  <td className="px-3 py-3.5">
                    <p className="font-extrabold text-[#1e3261]">{row.title}</p>
                    <p className="text-[11px] font-semibold text-[#8a98af]">{row.subtitle || '—'}</p>
                  </td>
                  <td className="px-3 py-3.5">
                    <span className="rounded-full bg-[#eef2ff] px-2.5 py-1 text-[11px] font-extrabold text-[#3730a3]">
                      {row.entity_type}
                    </span>
                  </td>
                  <td className="px-3 py-3.5">{row.source || '—'}</td>
                  <td className="px-3 py-3.5">{row.deleted_by_name || '—'}</td>
                  <td className="px-3 py-3.5 whitespace-nowrap">{formatWhen(row.deleted_at)}</td>
                  <td className="px-3 py-3.5">
                    <span className={cx(
                      'rounded-full px-2.5 py-1 text-[11px] font-extrabold',
                      (row.days_left ?? 0) <= 3 ? 'bg-[#fef2f2] text-[#dc2626]' : 'bg-[#f1f5f9] text-[#53647f]',
                    )}
                    >
                      {row.days_left ?? 0} day{(row.days_left ?? 0) === 1 ? '' : 's'} left
                    </span>
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => restoreItem(row)}
                        className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-[#bbf7d0] bg-[#f0fdf4] px-2.5 text-[11px] font-extrabold text-[#166534] disabled:opacity-50"
                      >
                        <RotateCcw className="size-3.5" />
                        Restore
                      </button>
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => permanentDelete(row)}
                        className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-[#fecaca] bg-[#fef2f2] px-2.5 text-[11px] font-extrabold text-[#b91c1c] disabled:opacity-50"
                        aria-label={`Permanently delete ${row.title}`}
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
