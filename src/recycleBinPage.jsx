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

export function SettingsRecycleBinPage({ onNotify, loggedInUser = null }) {
  const [rows, setRows] = useState([]);
  const [retentionDays, setRetentionDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('All');
  const [busyId, setBusyId] = useState(null);
  const canPermanentDelete = Boolean(loggedInUser?.is_super_admin);

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
    if (!canPermanentDelete) {
      onNotify?.('Only Super Admin can permanently delete items.', 'error');
      return;
    }
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
    if (!canPermanentDelete) {
      onNotify?.('Only Super Admin can purge expired items.', 'error');
      return;
    }
    setBusyId('purge');
    try {
      const data = await settingsApi.recycleBin.purge();
      onNotify?.(
        `Purged ${data?.leads ?? 0} lead(s), ${data?.follow_ups ?? 0} follow-up(s), ${data?.quotations ?? 0} quotation(s), ${data?.projects ?? 0} project(s).`,
        'success',
      );
      await load();
    } catch (err) {
      onNotify?.(err.message || 'Purge failed.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const emptyList = async () => {
    if (!canPermanentDelete) {
      onNotify?.('Only Super Admin can empty the recycle bin.', 'error');
      return;
    }
    if (rows.length === 0) {
      onNotify?.('Recycle bin is already empty.', 'info');
      return;
    }
    if (!window.confirm(
      `Empty recycle bin? This will permanently delete all ${rows.length} item(s). This cannot be undone.`,
    )) return;
    setBusyId('empty');
    try {
      const data = await settingsApi.recycleBin.empty();
      const total = (data?.leads ?? 0) + (data?.follow_ups ?? 0) + (data?.quotations ?? 0) + (data?.projects ?? 0);
      onNotify?.(
        `Recycle bin emptied. Deleted ${total} item(s) permanently.`,
        'success',
      );
      await load();
    } catch (err) {
      onNotify?.(err.message || 'Could not empty recycle bin.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="settings-full-width w-full min-w-0 space-y-4 p-3 sm:p-5">
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-[18px] font-extrabold text-[#102446]">Recycle Bin</h2>
          <p className="mt-1 text-[12px] font-semibold text-[#7585a2]">
            Soft-deleted leads, follow-ups, quotations and projects land here.
            Items auto-delete after {retentionDays} days.
            {canPermanentDelete ? '' : ' Permanent delete is Super Admin only.'}
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
          {canPermanentDelete ? (
            <>
              <button
                type="button"
                onClick={purgeExpired}
                disabled={busyId === 'purge' || busyId === 'empty'}
                className="inline-flex h-10 items-center gap-2 rounded-[9px] border border-[#fecaca] bg-white px-3 text-[12px] font-extrabold text-[#dc2626] disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
                Purge expired
              </button>
              <button
                type="button"
                onClick={emptyList}
                disabled={busyId === 'empty' || busyId === 'purge' || rows.length === 0}
                className="inline-flex h-10 items-center gap-2 rounded-[9px] bg-[#dc2626] px-3 text-[12px] font-extrabold text-white transition hover:bg-[#b91c1c] disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
                Empty List
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[9px] border border-[#dbe4f0] bg-white px-3">
          <Search className="size-4 shrink-0 text-[#8a98af]" />
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
          className="h-10 w-full rounded-[9px] border border-[#dbe4f0] bg-white px-3 text-[13px] font-bold outline-none sm:w-[160px]"
        >
          {['All', 'Lead', 'Follow-up', 'Quotation', 'Project'].map((option) => (
            <option key={option} value={option}>{option === 'All' ? 'All types' : option}</option>
          ))}
        </select>
      </div>

      {/* Mobile / tablet cards */}
      <div className="space-y-3 lg:hidden">
        {loading ? (
          <div className="rounded-[14px] border border-[#e2e9f3] bg-white px-4 py-10 text-center text-[13px] font-bold text-[#7585a2]">
            Loading recycle bin...
          </div>
        ) : null}
        {!loading && filtered.length === 0 ? (
          <div className="rounded-[14px] border border-[#e2e9f3] bg-white px-4 py-10 text-center text-[13px] font-bold text-[#7585a2]">
            Recycle bin is empty.
          </div>
        ) : null}
        {!loading && filtered.map((row) => (
          <article key={row.id} className="rounded-[14px] border border-[#e2e9f3] bg-white p-4 shadow-[0_8px_20px_rgba(23,43,77,0.05)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="wrap-break-word text-[14px] font-extrabold text-[#1e3261]">{row.title}</p>
                <p className="mt-1 text-[11px] font-semibold text-[#8a98af]">{row.subtitle || '—'}</p>
              </div>
              <span className="shrink-0 rounded-full bg-[#eef2ff] px-2.5 py-1 text-[11px] font-extrabold text-[#3730a3]">
                {row.entity_type}
              </span>
            </div>
            <div className="mt-3 grid gap-2 text-[12px] font-bold text-[#53647f] sm:grid-cols-2">
              <p><span className="text-[#8a98af]">Source:</span> {row.source || '—'}</p>
              <p><span className="text-[#8a98af]">Deleted by:</span> {row.deleted_by_name || '—'}</p>
              <p><span className="text-[#8a98af]">Deleted on:</span> {formatWhen(row.deleted_at)}</p>
              <p>
                <span className="text-[#8a98af]">Auto-delete:</span>{' '}
                <span className={cx(
                  'rounded-full px-2 py-0.5 text-[11px] font-extrabold',
                  (row.days_left ?? 0) <= 3 ? 'bg-[#fef2f2] text-[#dc2626]' : 'bg-[#f1f5f9] text-[#53647f]',
                )}
                >
                  {row.days_left ?? 0} day{(row.days_left ?? 0) === 1 ? '' : 's'} left
                </span>
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busyId === row.id}
                onClick={() => restoreItem(row)}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-[8px] border border-[#bbf7d0] bg-[#f0fdf4] px-3 text-[12px] font-extrabold text-[#166534] disabled:opacity-50 sm:flex-none"
              >
                <RotateCcw className="size-3.5" />
                Restore
              </button>
              {canPermanentDelete ? (
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => permanentDelete(row)}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-[8px] border border-[#fecaca] bg-[#fef2f2] px-3 text-[12px] font-extrabold text-[#b91c1c] disabled:opacity-50 sm:flex-none"
                  aria-label={`Permanently delete ${row.title}`}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {/* Desktop full-width table */}
      <div className="hidden w-full overflow-hidden rounded-[14px] border border-[#e2e9f3] bg-white shadow-[0_10px_26px_rgba(23,43,77,0.06)] lg:block">
        <div className="w-full overflow-x-auto">
          <table className="crm-table w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr>
                {['Item', 'Type', 'Source', 'Deleted by', 'Deleted on', 'Auto-delete', 'Action'].map((header) => (
                  <th key={header}>{header}</th>
                ))}
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
                <tr key={row.id}>
                  <td>
                    <p className="wrap-break-word whitespace-normal font-extrabold text-[#1e3261]">{row.title}</p>
                    <p className="text-[11px] font-semibold text-[#8a98af]">{row.subtitle || '—'}</p>
                  </td>
                  <td>
                    <span className="rounded-full bg-[#eef2ff] px-2.5 py-1 text-[11px] font-extrabold text-[#3730a3]">
                      {row.entity_type}
                    </span>
                  </td>
                  <td>{row.source || '—'}</td>
                  <td>{row.deleted_by_name || '—'}</td>
                  <td className="whitespace-nowrap">{formatWhen(row.deleted_at)}</td>
                  <td>
                    <span className={cx(
                      'rounded-full px-2.5 py-1 text-[11px] font-extrabold',
                      (row.days_left ?? 0) <= 3 ? 'bg-[#fef2f2] text-[#dc2626]' : 'bg-[#f1f5f9] text-[#53647f]',
                    )}
                    >
                      {row.days_left ?? 0} day{(row.days_left ?? 0) === 1 ? '' : 's'} left
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => restoreItem(row)}
                        className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-[#bbf7d0] bg-[#f0fdf4] px-2.5 text-[11px] font-extrabold text-[#166534] disabled:opacity-50"
                      >
                        <RotateCcw className="size-3.5" />
                        Restore
                      </button>
                      {canPermanentDelete ? (
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
                      ) : null}
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
