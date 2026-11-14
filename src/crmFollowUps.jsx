import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronRight,
  Download,
  Eye,
  MoreVertical,
  Pencil,
  Phone,
  PhoneCall,
  Plus,
  Search,
} from 'lucide-react';
import { followUpApi } from './api.js';
import { exportNotifyCsv } from './lib/utils.js';
import { fetchEveryPage, mergeFollowUpRows, rowsOf } from './lib/listQuery.js';
import { TablePagination, usePagedRows } from './components/TablePagination.jsx';
import { MobileCardEmpty, MobileCardList, MobileRecordCard } from './components/mobile/MobileRecordCard.jsx';
import { hasModuleAccess } from './settingsHubPages.jsx';
import {
  followUpAgeLabel,
  formatDateTime,
  splitFollowUpAlerts,
  activeScheduledFollowUps,
  followUpOwnershipLabel,
} from './telePortal.jsx';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function leadCode(item) {
  const id = item?.lead ?? item?.lead_id ?? item?.id;
  if (id == null || String(id).startsWith('lead-')) return '';
  return `LEAD-${String(id).padStart(5, '0')}`;
}

function startOfLocalDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toDateInputValue(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function displayFollowUpStatus(item, todayStart) {
  const status = String(item?.status || '').trim();
  if (status === 'Completed') return 'Completed';
  if (status === 'Missed') return 'Missed';
  const when = new Date(item?.scheduled_at);
  if (Number.isNaN(when.getTime())) return 'Pending';
  if (when < todayStart) return 'High Alert';
  return 'Pending';
}

function StatusPill({ value }) {
  const map = {
    Completed: 'bg-[#dcfce7] text-[#166534]',
    Pending: 'bg-[#fef3c7] text-[#b45309]',
    'High Alert': 'bg-[#fee2e2] text-[#b91c1c]',
    Overdue: 'bg-[#ede9fe] text-[#6d28d9]',
    Missed: 'bg-[#fecaca] text-[#991b1b]',
  };
  return (
    <span className={cx('inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-extrabold', map[value] || 'bg-[#eef2f7] text-[#64748b]')}>
      {value}
    </span>
  );
}

const FOLLOW_UP_TYPES = ['Call', 'WhatsApp', 'Site Visit', 'Email', 'Note'];
const STATUS_FILTERS = ['All Status', 'Pending', 'High Alert', 'Overdue', 'Completed', 'Missed'];

const filterSelectClass = 'h-10 w-full rounded-[8px] border border-[#d9e4f2] bg-white px-3 text-[13px] font-semibold text-[#1e3261] outline-none focus:border-[#0b65e5]';

export function CrmFollowUpsPage({
  initialTab = 'today',
  onNotify,
  onViewLead,
  onLogFollowUp,
  onOpenSection,
  loggedInUser = null,
}) {
  const canLogFollowUp = hasModuleAccess(loggedInUser, 'Lead', 'Add') || hasModuleAccess(loggedInUser, 'Lead', 'Edit');
  const canExport = hasModuleAccess(loggedInUser, 'Lead', 'Export') || hasModuleAccess(loggedInUser, 'Lead', 'View');

  const todayStart = useMemo(() => startOfLocalDay(), []);
  const defaultFrom = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    return toDateInputValue(d);
  }, []);
  const defaultTo = useMemo(() => toDateInputValue(new Date()), []);

  const [listTab, setListTab] = useState(initialTab === 'overdue' || initialTab === 'missed' ? 'missed' : 'list');
  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(
    initialTab === 'overdue' ? 'High Alert'
      : initialTab === 'completed' ? 'Completed'
        : initialTab === 'today' ? 'Pending'
          : 'All Status',
  );
  const [assignedFilter, setAssignedFilter] = useState('All Employees');
  const [addedByFilter, setAddedByFilter] = useState('All Employees');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [draft, setDraft] = useState({
    status: statusFilter,
    assigned: assignedFilter,
    addedBy: addedByFilter,
    type: typeFilter,
    from: defaultFrom,
    to: defaultTo,
  });
  const [showAllMissedEmployees, setShowAllMissedEmployees] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const loaded = rows !== null;

  useEffect(() => {
    if (!initialTab) return;
    if (initialTab === 'overdue' || initialTab === 'missed') {
      setListTab('missed');
      setStatusFilter(initialTab === 'missed' ? 'Missed' : 'High Alert');
      setDraft((d) => ({ ...d, status: initialTab === 'missed' ? 'Missed' : 'High Alert' }));
    } else if (initialTab === 'completed') {
      setListTab('list');
      setStatusFilter('Completed');
      setDraft((d) => ({ ...d, status: 'Completed' }));
    } else if (initialTab === 'today') {
      setListTab('list');
      setStatusFilter('Pending');
      setDraft((d) => ({ ...d, status: 'Pending' }));
    } else {
      setListTab('list');
      setStatusFilter('All Status');
      setDraft((d) => ({ ...d, status: 'All Status' }));
    }
  }, [initialTab]);

  const load = () => {
    Promise.all([
      fetchEveryPage((page, pageSize) => followUpApi.listAll({
        page,
        page_size: pageSize,
        status: 'Scheduled',
        ordering: 'scheduled_at',
      })),
      followUpApi.listAll({ page_size: 100, ordering: '-created_at' }),
    ])
      .then(([scheduled, recent]) => {
        setRows(mergeFollowUpRows(scheduled, rowsOf(recent)));
      })
      .catch(() => {
        setRows([]);
        onNotify?.('Follow-ups could not be loaded.', 'error');
      });
  };

  useEffect(() => { load(); }, []);

  const scheduled = useMemo(() => activeScheduledFollowUps(rows || []), [rows]);
  const { overdue } = useMemo(() => splitFollowUpAlerts(scheduled), [scheduled]);

  const employeeOptions = useMemo(() => {
    const set = new Map();
    (rows || []).forEach((item) => {
      if (item.lead_assigned_to_name) set.set(String(item.lead_assigned_to_name), true);
      if (item.created_by_name) set.set(String(item.created_by_name), true);
      if (item.lead_created_by_name) set.set(String(item.lead_created_by_name), true);
    });
    return [...set.keys()].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const inDateRange = (item) => {
    const when = new Date(item.scheduled_at);
    if (Number.isNaN(when.getTime())) return true;
    if (dateFrom) {
      const from = new Date(`${dateFrom}T00:00:00`);
      if (when < from) return false;
    }
    if (dateTo) {
      const to = new Date(`${dateTo}T23:59:59.999`);
      if (when > to) return false;
    }
    return true;
  };

  const baseFiltered = useMemo(() => {
    let list = rows || [];
    list = list.filter(inDateRange);
    if (assignedFilter !== 'All Employees') {
      list = list.filter((item) => String(item.lead_assigned_to_name || '') === assignedFilter);
    }
    if (addedByFilter !== 'All Employees') {
      list = list.filter((item) => {
        const added = item.created_by_name || item.lead_created_by_name || '';
        return String(added) === addedByFilter;
      });
    }
    if (typeFilter !== 'All Types') {
      list = list.filter((item) => String(item.follow_up_type || '') === typeFilter);
    }
    return list;
  }, [rows, dateFrom, dateTo, assignedFilter, addedByFilter, typeFilter]);

  const counts = useMemo(() => {
    const scopedScheduled = activeScheduledFollowUps(baseFiltered);
    const split = splitFollowUpAlerts(scopedScheduled);
    const pendingCount = split.today.length + split.upcoming.length;
    const overdueCount = split.overdue.length;
    return {
      all: baseFiltered.length,
      completed: baseFiltered.filter((i) => i.status === 'Completed').length,
      pending: pendingCount,
      highAlert: overdueCount + split.today.length,
      overdue: overdueCount,
      missed: baseFiltered.filter((i) => i.status === 'Missed').length,
    };
  }, [baseFiltered]);

  const missedByCounts = useMemo(() => {
    const map = new Map();
    overdue.forEach((item) => {
      if (!inDateRange(item)) return;
      if (assignedFilter !== 'All Employees' && String(item.lead_assigned_to_name || '') !== assignedFilter) return;
      if (addedByFilter !== 'All Employees') {
        const added = item.created_by_name || item.lead_created_by_name || '';
        if (String(added) !== addedByFilter) return;
      }
      if (typeFilter !== 'All Types' && String(item.follow_up_type || '') !== typeFilter) return;
      const name = followUpOwnershipLabel(item, { extra: true });
      map.set(name, (map.get(name) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [overdue, dateFrom, dateTo, assignedFilter, addedByFilter, typeFilter]);

  const visibleMissedEmployees = showAllMissedEmployees ? missedByCounts : missedByCounts.slice(0, 6);

  const filtered = useMemo(() => {
    let list = baseFiltered;
    if (listTab === 'missed') {
      list = list.filter((item) => item.status === 'Missed');
    } else if (statusFilter === 'Completed') {
      list = list.filter((item) => item.status === 'Completed');
    } else if (statusFilter === 'Missed') {
      list = list.filter((item) => item.status === 'Missed');
    } else if (statusFilter === 'Pending') {
      list = list.filter((item) => displayFollowUpStatus(item, todayStart) === 'Pending');
    } else if (statusFilter === 'High Alert') {
      // High Alert = overdue + due today (needs immediate action).
      const tomorrow = new Date(todayStart.getTime() + 86400000);
      list = list.filter((item) => {
        if (item.status !== 'Scheduled') return false;
        const when = new Date(item.scheduled_at);
        if (Number.isNaN(when.getTime())) return false;
        return when < tomorrow;
      });
    } else if (statusFilter === 'Overdue') {
      list = list.filter((item) => item.status === 'Scheduled' && new Date(item.scheduled_at) < todayStart);
    }

    const query = search.trim().toLowerCase();
    if (query) {
      list = list.filter((item) => [
        item.lead_customer_name,
        item.lead_mobile_number,
        leadCode(item),
        item.notes,
        item.outcome,
        item.follow_up_type,
        item.created_by_name,
        item.lead_assigned_to_name,
      ].some((value) => String(value || '').toLowerCase().includes(query)));
    }

    return [...list].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  }, [baseFiltered, listTab, statusFilter, search, todayStart]);

  const { pageRows, pagination } = usePagedRows(filtered, 'crm-follow-ups', {
    defaultSize: 10,
    pageSizeOptions: [10, 20, 50],
    resetKey: `${listTab}|${statusFilter}|${assignedFilter}|${addedByFilter}|${typeFilter}|${dateFrom}|${dateTo}|${search}`,
  });

  const applyFilters = () => {
    setStatusFilter(draft.status);
    setAssignedFilter(draft.assigned);
    setAddedByFilter(draft.addedBy);
    setTypeFilter(draft.type);
    setDateFrom(draft.from);
    setDateTo(draft.to);
    if (draft.status === 'Missed') setListTab('missed');
    else if (listTab === 'missed' && draft.status !== 'Missed' && draft.status !== 'High Alert' && draft.status !== 'Overdue') {
      setListTab('list');
    }
    onNotify?.('Filters applied', 'success');
  };

  const resetFilters = () => {
    const next = {
      status: 'All Status',
      assigned: 'All Employees',
      addedBy: 'All Employees',
      type: 'All Types',
      from: defaultFrom,
      to: defaultTo,
    };
    setDraft(next);
    setStatusFilter(next.status);
    setAssignedFilter(next.assigned);
    setAddedByFilter(next.addedBy);
    setTypeFilter(next.type);
    setDateFrom(next.from);
    setDateTo(next.to);
    setSearch('');
    setListTab('list');
    setSelectedIds(new Set());
  };

  const handleCall = (item) => {
    const raw = String(item.lead_mobile_number || '').trim();
    if (!raw) {
      onNotify?.('No mobile number on this lead.', 'error');
      return;
    }
    const href = raw.startsWith('+') ? `tel:${raw.replace(/[^\d+]/g, '')}` : `tel:${raw.replace(/\D/g, '')}`;
    window.location.href = href;
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(String(id))) next.delete(String(id));
      else next.add(String(id));
      return next;
    });
  };

  const toggleSelectPage = () => {
    const ids = pageRows.map((r) => String(r.id));
    const allSelected = ids.length && ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const exportRows = () => {
    exportNotifyCsv(
      onNotify,
      'lead-follow-ups',
      ['Lead', 'Lead ID', 'Mobile', 'Note', 'Date', 'Assigned To', 'Added By', 'Type', 'Status'],
      filtered.map((item) => [
        item.lead_customer_name || '',
        leadCode(item),
        item.lead_mobile_number || '',
        item.notes || item.outcome || '',
        formatDateTime(item.scheduled_at),
        item.lead_assigned_to_name || '',
        item.created_by_name || item.lead_created_by_name || '',
        item.follow_up_type || '',
        displayFollowUpStatus(item, todayStart),
      ]),
    );
  };

  const cards = [
    { id: 'all', label: 'All Follow-ups', value: counts.all, tone: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]', filter: 'All Status', list: 'list' },
    { id: 'completed', label: 'Completed', value: counts.completed, tone: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]', filter: 'Completed', list: 'list' },
    { id: 'pending', label: 'Pending', value: counts.pending, tone: 'border-[#fde68a] bg-[#fffbeb] text-[#b45309]', filter: 'Pending', list: 'list' },
    { id: 'high', label: 'High Alert', value: counts.highAlert, tone: 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]', filter: 'High Alert', list: 'list' },
    { id: 'overdue', label: 'Overdue', value: counts.overdue, tone: 'border-[#ddd6fe] bg-[#f5f3ff] text-[#6d28d9]', filter: 'Overdue', list: 'list' },
    { id: 'missed', label: 'Missed', value: counts.missed, tone: 'border-[#fca5a5] bg-[#fff1f2] text-[#991b1b]', filter: 'Missed', list: 'missed' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-[#7585a2]">
            <span>Home</span>
            <ChevronRight className="size-3.5" />
            <span>Lead</span>
            <ChevronRight className="size-3.5" />
            <span className="text-[#0b65e5]">Follow-ups</span>
          </div>
          <div className="mt-2 flex items-start gap-3">
            <span className="mt-0.5 grid size-10 place-items-center rounded-[12px] bg-[#e8f8eb] text-[#0d9f4a]">
              <CalendarDays className="size-5" />
            </span>
            <div>
              <h1 className="font-display text-[24px] font-extrabold text-[#0f172a]">Lead Follow-ups</h1>
              <p className="mt-1 max-w-2xl text-[13px] font-semibold text-[#64748b]">
                Manage, track and follow up on leads. Check pending, completed, overdue and missed follow-ups.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          {canLogFollowUp ? (
            <button
              type="button"
              onClick={() => onLogFollowUp?.(null)}
              className="inline-flex h-10 items-center gap-1.5 rounded-[8px] bg-[#12a54f] px-4 text-[13px] font-extrabold text-white shadow-[0_10px_20px_rgba(18,165,79,0.22)]"
            >
              <Plus className="size-4" /> Schedule Follow-up
            </button>
          ) : null}
          {canExport ? (
            <button
              type="button"
              onClick={exportRows}
              className="inline-flex h-10 items-center gap-1.5 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276]"
            >
              <Download className="size-4" /> Export
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (onOpenSection) onOpenSection('Insights', 'Follow-up Reports opened');
              else onNotify?.('Follow-up Reports — open Insights for detailed analytics', 'success');
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276]"
          >
            Follow-up Reports
          </button>
        </div>
      </div>

      <section className="rounded-[14px] border border-[#e2e9f3] bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 lg:grid-cols-6">
          <label className="block min-w-0">
            <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">Follow-up Status</span>
            <select className={filterSelectClass} value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}>
              {STATUS_FILTERS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">Assigned To</span>
            <select className={filterSelectClass} value={draft.assigned} onChange={(e) => setDraft((d) => ({ ...d, assigned: e.target.value }))}>
              <option>All Employees</option>
              {employeeOptions.map((name) => <option key={`a-${name}`} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">Added / Scheduled By</span>
            <select className={filterSelectClass} value={draft.addedBy} onChange={(e) => setDraft((d) => ({ ...d, addedBy: e.target.value }))}>
              <option>All Employees</option>
              {employeeOptions.map((name) => <option key={`b-${name}`} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">Follow-up Type</span>
            <select className={filterSelectClass} value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}>
              <option>All Types</option>
              {FOLLOW_UP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="block min-w-0 lg:col-span-2">
            <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">Date Range</span>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className={filterSelectClass} value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} />
              <input type="date" className={filterSelectClass} value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} />
            </div>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={applyFilters} className="inline-flex h-10 items-center rounded-[8px] bg-[#12a54f] px-4 text-[13px] font-extrabold text-white">Apply</button>
          <button type="button" onClick={resetFilters} className="inline-flex h-10 items-center rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276]">Reset</button>
          <label className="relative ml-auto flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-3 sm:max-w-xs">
            <Search className="size-4 text-[#94a3b8]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lead, mobile, note..."
              className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-[#1e3261] outline-none"
            />
          </label>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {cards.map((card) => {
          const active = statusFilter === card.filter && listTab === card.list;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => {
                setStatusFilter(card.filter);
                setDraft((d) => ({ ...d, status: card.filter }));
                setListTab(card.list);
              }}
              className={cx(
                'rounded-[14px] border p-3.5 text-left shadow-sm transition',
                card.tone,
                active ? 'ring-2 ring-[#0b65e5] ring-offset-1' : '',
              )}
            >
              <p className="text-[11px] font-extrabold uppercase tracking-wide opacity-80">{card.label}</p>
              <p className="mt-2 text-[26px] font-extrabold">{loaded ? card.value : '—'}</p>
            </button>
          );
        })}
      </section>

      {missedByCounts.length > 0 ? (
        <section className="rounded-[14px] border border-[#fecaca] bg-[#fff5f5] px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-extrabold text-[#991b1b]">Employee-wise Missed Follow-ups</p>
            {missedByCounts.length > 6 ? (
              <button
                type="button"
                onClick={() => setShowAllMissedEmployees((v) => !v)}
                className="inline-flex items-center gap-1 text-[12px] font-extrabold text-[#b91c1c]"
              >
                {showAllMissedEmployees ? 'Show Less' : 'View All'} <ChevronRight className="size-3.5" />
              </button>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {visibleMissedEmployees.map(([name, count]) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setAssignedFilter(name);
                  setDraft((d) => ({ ...d, assigned: name, status: 'Overdue' }));
                  setStatusFilter('Overdue');
                  setListTab('list');
                }}
                className="inline-flex items-center gap-2 rounded-full border border-[#fecaca] bg-white px-3 py-1.5 text-[12px] font-extrabold text-[#7f1d1d] transition hover:bg-[#fff1f2]"
              >
                {name}: <span className="text-[#dc2626]">{count} Missed</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[16px] border border-[#e2e9f3] bg-white shadow-[0_10px_26px_rgba(23,43,77,0.06)]">
        <div className="flex flex-wrap items-center gap-1 border-b border-[#edf2f8] px-3 pt-3 sm:px-4">
          <button
            type="button"
            onClick={() => { setListTab('list'); if (statusFilter === 'Missed') { setStatusFilter('All Status'); setDraft((d) => ({ ...d, status: 'All Status' })); } }}
            className={cx(
              'rounded-t-[10px] px-4 py-2.5 text-[13px] font-extrabold',
              listTab === 'list' ? 'bg-[#f0fdf4] text-[#166534]' : 'text-[#64748b] hover:bg-[#f8fbff]',
            )}
          >
            Follow-up List ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => { setListTab('missed'); setStatusFilter('Missed'); setDraft((d) => ({ ...d, status: 'Missed' })); }}
            className={cx(
              'rounded-t-[10px] px-4 py-2.5 text-[13px] font-extrabold',
              listTab === 'missed' ? 'bg-[#fef2f2] text-[#b91c1c]' : 'text-[#64748b] hover:bg-[#f8fbff]',
            )}
          >
            Missed Follow-ups ({counts.missed})
          </button>
        </div>

        <div className="p-3 sm:p-4">
          {!loaded ? (
            <p className="py-10 text-center text-[13px] font-semibold text-[#7a8fa6]">Loading follow-ups...</p>
          ) : filtered.length === 0 ? (
            <MobileCardEmpty title="No follow-ups in this view" hint="Change filters or schedule a new follow-up." />
          ) : (
            <>
              <MobileCardList className="lg:hidden">
                {pageRows.map((item) => {
                  const status = displayFollowUpStatus(item, todayStart);
                  return (
                    <MobileRecordCard
                      key={item.id}
                      avatar={item.lead_customer_name}
                      title={item.lead_customer_name || 'Lead'}
                      subtitle={[leadCode(item), item.lead_mobile_number].filter(Boolean).join(' · ')}
                      badges={<StatusPill value={listTab === 'missed' && item.status === 'Missed' ? 'Missed' : status} />}
                      details={[
                        { label: 'Note', value: item.notes || item.outcome || '—', wide: true },
                        { label: 'Date', value: formatDateTime(item.scheduled_at) },
                        { label: 'Assigned', value: item.lead_assigned_to_name || '—' },
                        { label: 'Added By', value: item.created_by_name || item.lead_created_by_name || '—' },
                      ]}
                      onOpen={() => onViewLead?.(item)}
                      actions={[
                        { label: 'Call', icon: PhoneCall, tone: 'green', onClick: () => handleCall(item) },
                        canLogFollowUp ? { label: 'Log', icon: Pencil, tone: 'blue', onClick: () => onLogFollowUp?.(item) } : null,
                        { label: 'View', icon: Eye, tone: 'slate', onClick: () => onViewLead?.(item) },
                      ]}
                    />
                  );
                })}
              </MobileCardList>

              <div className="hidden overflow-x-auto lg:block">
                <table className="min-w-[1100px] w-full text-left text-[13px]">
                  <thead className="bg-[#f8fbff] text-[11px] font-extrabold uppercase tracking-wide text-[#64748b]">
                    <tr>
                      <th className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={pageRows.length > 0 && pageRows.every((r) => selectedIds.has(String(r.id)))}
                          onChange={toggleSelectPage}
                        />
                      </th>
                      {['Lead / Customer', 'Mobile', 'Follow-up Note', 'Follow-up Date & Time', 'Assigned To', 'Added By', 'Status', 'Actions'].map((h) => (
                        <th key={h} className="px-3 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((item, idx) => {
                      const status = listTab === 'missed' && item.status === 'Missed'
                        ? 'Missed'
                        : displayFollowUpStatus(item, todayStart);
                      return (
                        <tr key={item.id} className={cx('border-t border-[#edf2f8]', idx % 2 ? 'bg-[#fbfdff]' : 'bg-white')}>
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(String(item.id))}
                              onChange={() => toggleSelect(item.id)}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-extrabold text-[#0f172a]">{item.lead_customer_name || '—'}</p>
                            <p className="mt-0.5 text-[11px] font-bold text-[#64748b]">{leadCode(item) || followUpAgeLabel(item.scheduled_at)}</p>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <button type="button" onClick={() => handleCall(item)} className="inline-flex items-center gap-1.5 font-semibold text-[#0b65e5] hover:underline">
                              <Phone className="size-3.5" />
                              {item.lead_mobile_number || '—'}
                            </button>
                          </td>
                          <td className="max-w-[260px] px-3 py-3">
                            <p className="truncate font-semibold text-[#334155]" title={item.notes || item.outcome || ''}>
                              {item.notes || item.outcome || '—'}
                            </p>
                            {item.follow_up_type ? (
                              <p className="mt-0.5 text-[11px] font-bold text-[#94a3b8]">{item.follow_up_type}</p>
                            ) : null}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap font-semibold text-[#334155]">{formatDateTime(item.scheduled_at)}</td>
                          <td className="px-3 py-3 font-semibold text-[#334155]">{item.lead_assigned_to_name || '—'}</td>
                          <td className="px-3 py-3 font-semibold text-[#334155]">{item.created_by_name || item.lead_created_by_name || '—'}</td>
                          <td className="px-3 py-3"><StatusPill value={status} /></td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => handleCall(item)} className="grid size-8 place-items-center rounded-[8px] text-[#16a34a] hover:bg-[#f0fdf4]" title="Call">
                                <PhoneCall className="size-4" />
                              </button>
                              {canLogFollowUp ? (
                                <button type="button" onClick={() => onLogFollowUp?.(item)} className="grid size-8 place-items-center rounded-[8px] text-[#334155] hover:bg-[#f1f5f9]" title="Edit / Log">
                                  <Pencil className="size-4" />
                                </button>
                              ) : null}
                              <button type="button" onClick={() => onViewLead?.(item)} className="grid size-8 place-items-center rounded-[8px] text-[#0b65e5] hover:bg-[#eff6ff]" title="View lead">
                                <Eye className="size-4" />
                              </button>
                              <button type="button" className="grid size-8 place-items-center rounded-[8px] text-[#94a3b8] hover:bg-[#f8fafc]" title="More">
                                <MoreVertical className="size-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <TablePagination {...pagination} className="mt-3" />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
