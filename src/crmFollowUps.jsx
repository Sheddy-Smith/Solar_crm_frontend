import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Phone,
  PhoneCall,
  Plus,
  Search,
  StickyNote,
  Zap,
} from 'lucide-react';
import { followUpApi } from './api.js';
import {
  followUpAgeLabel,
  formatDateTime,
  splitFollowUpAlerts,
} from './telePortal.jsx';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function normalizeRows(data) {
  return Array.isArray(data) ? data : (data?.results ?? []);
}

function missedByLabel(item) {
  return item.lead_assigned_to_name || item.created_by_name || 'Unassigned';
}

export function CrmFollowUpsPage({
  initialTab = 'today',
  onNotify,
  onViewLead,
  onLogFollowUp,
}) {
  const [tab, setTab] = useState(initialTab || 'today');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState(null);
  const loaded = rows !== null;

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  const load = () => {
    followUpApi.listAll({ page_size: 500, ordering: '-scheduled_at' })
      .then((data) => setRows(normalizeRows(data)))
      .catch(() => {
        setRows([]);
        onNotify?.('Follow-ups could not be loaded.', 'error');
      });
  };

  useEffect(() => { load(); }, []);

  const scheduled = useMemo(
    () => (rows || []).filter((item) => item.status === 'Scheduled'),
    [rows],
  );
  const completed = useMemo(
    () => (rows || []).filter((item) => item.status === 'Completed'),
    [rows],
  );
  const { today, overdue } = useMemo(() => splitFollowUpAlerts(scheduled), [scheduled]);

  const missedByCounts = useMemo(() => {
    const map = new Map();
    overdue.forEach((item) => {
      const name = missedByLabel(item);
      map.set(name, (map.get(name) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [overdue]);

  const cards = [
    { id: 'today', title: 'High Alert · Today', value: loaded ? today.length : undefined, note: 'Follow-ups due today', icon: Zap, tone: 'bg-[#fff7ed] text-[#f59e0b]', activeRing: 'border-[#f59e0b] ring-4 ring-[#fde68a]' },
    { id: 'overdue', title: 'Extra High · Pending', value: loaded ? overdue.length : undefined, note: 'Missed earlier — still pending', icon: AlertTriangle, tone: 'bg-[#fef2f2] text-[#dc2626]', activeRing: 'border-[#dc2626] ring-4 ring-[#fecaca]' },
    { id: 'completed', title: 'Completed', value: loaded ? completed.length : undefined, note: 'Saved history', icon: CheckCircle2, tone: 'bg-[#e8f8eb] text-[#0d9f4a]', activeRing: 'border-[#0d9f4a] ring-4 ring-[#bbf7d0]' },
    { id: 'all', title: 'All Follow-ups', value: loaded ? (rows || []).length : undefined, note: 'Full record', icon: Phone, tone: 'bg-[#e7efff] text-[#1d4ed8]', activeRing: 'border-[#1d4ed8] ring-4 ring-[#dbeafe]' },
  ];

  const filtered = useMemo(() => {
    let list = rows || [];
    if (tab === 'today') list = today;
    else if (tab === 'overdue') list = overdue;
    else if (tab === 'completed') list = completed;
    const query = search.trim().toLowerCase();
    if (query) {
      list = list.filter((item) => [
        item.lead_customer_name,
        item.lead_mobile_number,
        item.notes,
        item.outcome,
        item.follow_up_type,
        item.created_by_name,
      ].some((value) => String(value || '').toLowerCase().includes(query)));
    }
    const sorted = [...list].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
    if (tab === 'completed' || tab === 'all') sorted.reverse();
    return sorted;
  }, [rows, tab, search, today, overdue, completed]);

  const handleCall = (item) => {
    const raw = String(item.lead_mobile_number || '').trim();
    if (!raw) {
      onNotify?.('No mobile number on this lead.', 'error');
      return;
    }
    const href = raw.startsWith('+') ? `tel:${raw.replace(/[^\d+]/g, '')}` : `tel:${raw.replace(/\D/g, '')}`;
    window.location.href = href;
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#0e582a]">Lead</p>
        <h1 className="mt-1 font-display text-[22px] font-extrabold text-[#163d70]">Follow-ups</h1>
        <p className="mt-1 text-[13px] font-semibold text-[#7b88a2]">
          High Alert, Extra High pending, and full conversation history — same as Tele portal.
        </p>
      </div>

      {(today.length > 0 || overdue.length > 0) && loaded ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => setTab('today')}
            className={cx(
              'flex flex-1 items-center gap-3 rounded-[12px] border-2 px-4 py-3 text-left transition',
              tab === 'today' ? 'border-[#f59e0b] bg-[#fffbeb]' : 'border-[#fde68a]/80 bg-white hover:bg-[#fffbeb]',
            )}
          >
            <span className="grid size-9 place-items-center rounded-full bg-[#f59e0b] text-white"><Zap className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-extrabold text-[#92400e]">High Alert · Today</p>
              <p className="text-[11px] font-semibold text-[#b45309]">{today.length} follow-up{today.length === 1 ? '' : 's'} due today</p>
            </div>
            <span className="text-[20px] font-extrabold text-[#f59e0b]">{today.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('overdue')}
            className={cx(
              'flex flex-1 items-center gap-3 rounded-[12px] border-2 px-4 py-3 text-left transition',
              tab === 'overdue' ? 'border-[#dc2626] bg-[#fef2f2]' : 'border-[#fecaca]/80 bg-white hover:bg-[#fef2f2]',
            )}
          >
            <span className="grid size-9 place-items-center rounded-full bg-[#dc2626] text-white"><AlertTriangle className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-extrabold text-[#991b1b]">Extra High · Pending</p>
              <p className="text-[11px] font-semibold text-[#b91c1c]">{overdue.length} overdue pending</p>
            </div>
            <span className="text-[20px] font-extrabold text-[#dc2626]">{overdue.length}</span>
          </button>
        </div>
      ) : null}

      <section className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const active = tab === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setTab(card.id)}
              className={cx(
                'rounded-[14px] border bg-white p-4 text-left shadow-[0_8px_20px_rgba(23,43,77,0.06)] transition',
                active ? card.activeRing : 'border-[#e8eef6] hover:border-[#c7d7f0]',
              )}
            >
              <span className={cx('grid size-9 place-items-center rounded-[10px]', card.tone)}>
                <Icon className="size-4" />
              </span>
              <p className="mt-3 text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#7b88a2]">{card.title}</p>
              <p className="mt-1 text-[26px] font-extrabold text-[#163d70]">{card.value ?? '—'}</p>
              <p className="text-[12px] font-semibold text-[#8895ab]">{card.note}</p>
            </button>
          );
        })}
      </section>

      {tab === 'overdue' && missedByCounts.length > 0 ? (
        <section className="rounded-[14px] border border-[#fecaca] bg-[#fff5f5] p-4">
          <p className="text-[13px] font-extrabold text-[#991b1b]">Who missed follow-ups</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {missedByCounts.map(([name, count]) => (
              <span key={name} className="inline-flex items-center gap-2 rounded-full border border-[#fecaca] bg-white px-3 py-1.5 text-[12px] font-extrabold text-[#7f1d1d]">
                {name}
                <span className="rounded-full bg-[#dc2626] px-2 py-0.5 text-[11px] text-white">{count}</span>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-[16px] border border-[#e2e9f3] bg-white p-4 shadow-[0_10px_26px_rgba(23,43,77,0.06)] sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-[17px] font-extrabold text-[#102446]">
              {tab === 'today' ? "High Alert · Today's Follow-ups" : tab === 'overdue' ? 'Extra High Alert · Pending' : 'Follow-up Diary'}
            </h2>
            <p className="mt-1 text-[12px] font-semibold text-[#7585a2]">
              {tab === 'today'
                ? 'These customers need a call or follow-up today.'
                : tab === 'overdue'
                  ? 'Who missed, when it was due, and the follow-up note — clear these first.'
                  : 'Every call and WhatsApp note is saved here.'}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex h-10 min-w-[220px] items-center gap-2 rounded-[9px] border border-[#dbe4f0] bg-white px-3">
              <Search className="size-4 text-[#7585a2]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer, owner, note..."
                className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-[#1f2d44] outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => onLogFollowUp?.(null)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[9px] bg-[#0b65e5] px-4 text-[13px] font-extrabold text-white transition hover:bg-[#0954c4]"
            >
              <Plus className="size-4" />
              Log Follow-up
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {!loaded && (
            <p className="rounded-[12px] bg-[#f8fbff] px-3 py-8 text-center text-[13px] font-bold text-[#7585a2]">Loading follow-ups...</p>
          )}
          {loaded && filtered.length === 0 && (
            <p className="rounded-[12px] bg-[#f8fbff] px-3 py-8 text-center text-[13px] font-bold text-[#7585a2]">
              No follow-ups in this view.
            </p>
          )}
          {filtered.map((item) => {
            const isTodayAlert = tab === 'today';
            const isExtraAlert = tab === 'overdue';
            return (
              <article
                key={item.id}
                className={cx(
                  'rounded-[14px] border p-4 transition',
                  isExtraAlert
                    ? 'border-[#fecaca] bg-[#fff5f5]'
                    : isTodayAlert
                      ? 'border-[#fde68a] bg-[#fffbeb]'
                      : 'border-[#e8eef6] bg-[#fbfdff]',
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-[15px] font-extrabold text-[#102446]">{item.lead_customer_name || 'Lead'}</p>
                      <span className="text-[12px] font-bold text-[#7585a2]">{item.lead_mobile_number || ''}</span>
                      {isTodayAlert ? <span className="inline-flex rounded-full bg-[#f59e0b] px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">High Alert</span> : null}
                      {isExtraAlert ? <span className="inline-flex rounded-full bg-[#dc2626] px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">Extra High</span> : null}
                      <span className="inline-flex rounded-full bg-[#eef2f8] px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#53647f]">{item.status}</span>
                    </div>
                    <p className="mt-1 text-[12px] font-bold text-[#53647f]">
                      {formatDateTime(item.scheduled_at)}
                      <span className="mx-1.5 text-[#c3ccd9]">·</span>
                      {item.follow_up_type || 'Call'}
                      <span className="mx-1.5 text-[#c3ccd9]">·</span>
                      {followUpAgeLabel(item.scheduled_at)}
                    </p>
                    <p className="mt-1 text-[12px] font-extrabold text-[#1e3261]">
                      {isExtraAlert ? 'Missed by: ' : 'Scheduled / logged by: '}
                      {missedByLabel(item)}
                    </p>
                    {item.lead_assigned_to_name && item.created_by_name && item.lead_assigned_to_name !== item.created_by_name ? (
                      <p className="text-[11px] font-semibold text-[#53647f]">Logged by: {item.created_by_name}</p>
                    ) : null}
                    {item.outcome ? (
                      <p className="mt-2 inline-flex rounded-full bg-[#eef2ff] px-2.5 py-1 text-[11px] font-extrabold text-[#3730a3]">
                        Outcome: {item.outcome}
                      </p>
                    ) : null}
                    {item.notes ? (
                      <p className="mt-2 text-[13px] font-semibold leading-6 text-[#33456b]">
                        <span className="font-extrabold text-[#1e3261]">Detail: </span>
                        {item.notes}
                      </p>
                    ) : (
                      <p className="mt-2 text-[12px] font-semibold text-[#8a98af]">No conversation note saved.</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button type="button" onClick={() => onLogFollowUp?.(item)} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#1d4ed8] bg-white px-3 text-[12px] font-extrabold text-[#1d4ed8]">
                      <StickyNote className="size-3.5" />
                      Log
                    </button>
                    <button type="button" onClick={() => onViewLead?.(item)} className="inline-flex h-9 items-center rounded-[8px] border border-[#e2e9f3] bg-white px-3 text-[12px] font-extrabold text-[#1d4ed8]">
                      View
                    </button>
                    <button type="button" onClick={() => handleCall(item)} className={cx('inline-flex h-9 items-center gap-1.5 rounded-[8px] px-3 text-[12px] font-extrabold text-white', isExtraAlert ? 'bg-[#dc2626]' : 'bg-[#f59e0b]')}>
                      <PhoneCall className="size-3.5" />
                      Call
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
