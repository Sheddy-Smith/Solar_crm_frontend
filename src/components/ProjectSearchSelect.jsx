import { useCallback, useEffect, useMemo, useState } from 'react';
import { projectApi } from '../api.js';
import { fetchEveryPage } from '../lib/listQuery.js';
import SearchableSelect from './SearchableSelect.jsx';

function projectLabel(p) {
  if (!p) return '';
  const code = p.project_id || `PRJ-${p.id}`;
  const name = p.project_name || 'Untitled project';
  const customer = p.customer_name ? ` · ${p.customer_name}` : '';
  const site = p.site ? ` · ${p.site}` : '';
  return `${code} — ${name}${customer}${site}`;
}

/**
 * Searchable Project picker for Accounts / Project financial forms.
 * Loads via paginated API (fetchEveryPage) — not capped at page_size 25.
 */
export default function ProjectSearchSelect({
  value = '',
  onChange,
  disabled = false,
  required = false,
  placeholder = 'Link project (optional)',
  searchPlaceholder = 'Search project, code, customer, site...',
  triggerClassName = '',
  className = '',
  allowClear = true,
  /** Optional customer/party name — client-filters loaded projects by customer_name. */
  customerFilter = '',
}) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchEveryPage((page, pageSize) => projectApi.list({
      page,
      page_size: pageSize,
      won_only: 1,
      ordering: '-updated_at',
    }), { pageSize: 50, maxPages: 4 })
      .then((rows) => {
        if (cancelled) return;
        setProjects(Array.isArray(rows) ? rows : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setProjects([]);
        setError(err?.message || 'Could not load projects.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const cancel = load();
    return cancel;
  }, [load]);

  const options = useMemo(() => {
    const needle = String(customerFilter || '').trim().toLowerCase();
    const filtered = needle
      ? projects.filter((p) => String(p.customer_name || '').toLowerCase().includes(needle))
      : projects;
    const rows = filtered.map((p) => ({
      value: String(p.id),
      label: projectLabel(p),
      raw: p,
    }));
    if (allowClear) {
      return [{ value: '', label: placeholder || 'No project' }, ...rows];
    }
    return rows;
  }, [projects, allowClear, placeholder, customerFilter]);

  // Keep selected project visible even if not in loaded list yet (edit race).
  const optionsWithSelected = useMemo(() => {
    if (!value) return options;
    if (options.some((o) => String(o.value) === String(value))) return options;
    return [
      ...options,
      { value: String(value), label: `Project #${value}` },
    ];
  }, [options, value]);

  if (error && !loading && projects.length === 0) {
    return (
      <div className={className}>
        <div className="rounded-[8px] border border-[#fecaca] bg-[#fff5f5] px-3 py-2 text-[12px] font-semibold text-[#b91c1c]">
          {error}
          <button
            type="button"
            onClick={load}
            className="ml-2 font-extrabold text-[#0b65e5] underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <SearchableSelect
        value={value == null ? '' : String(value)}
        onChange={(v) => onChange?.(v || '')}
        options={optionsWithSelected}
        disabled={disabled || loading}
        required={required}
        placeholder={loading ? 'Loading projects...' : placeholder}
        searchPlaceholder={searchPlaceholder}
        allowOther={false}
        emptyLabel={loading ? 'Loading...' : 'No projects found'}
        triggerClassName={triggerClassName}
      />
    </div>
  );
}

export { projectLabel };
