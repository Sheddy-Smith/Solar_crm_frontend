import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronLeft,
  Search,
} from 'lucide-react';
import { cx } from '../lib/utils.js';

/** Visual workflow order matching the Material Planning mockup (Job Sheet stays in sidebar only). */
export const PM_WORKFLOW_STEPS = [
  { key: 'Project Site Survey', label: 'Site Survey', short: 'Survey' },
  { key: 'Project Material Planning', label: 'Material Planning', short: 'Planning' },
  { key: 'Project Dispatch', label: 'Dispatch', short: 'Dispatch' },
  { key: 'Project Installation', label: 'Installation', short: 'Install' },
];

const NEXT_BY_SECTION = {
  'Project Site Survey': { section: 'Project Material Planning', label: 'Next: Material Planning →' },
  'Project Material Planning': { section: 'Project Dispatch', label: 'Next: Dispatch →' },
  'Project Job Sheet': { section: 'Project Dispatch', label: 'Next: Dispatch →' },
  'Project Dispatch': { section: 'Project Installation', label: 'Next: Installation →' },
  'Project Installation': { section: 'Liaisoning & Commissioning', label: 'Next: Liaisoning →' },
};

const DONE_LABEL_BY_SECTION = {
  'Project Site Survey': 'Mark Site Survey Done',
  'Project Material Planning': 'Mark Material Planning Done',
  'Project Job Sheet': 'Mark Job Sheet Done',
  'Project Dispatch': 'Mark Dispatch Done',
  'Project Installation': 'Mark Installation Done',
};

export function workflowStepState(activeSection, stepKey) {
  const keys = PM_WORKFLOW_STEPS.map((s) => s.key);
  // Job Sheet sits between Planning and Dispatch in pipeline — treat as planning-complete for stepper.
  const normalized = activeSection === 'Project Job Sheet' ? 'Project Dispatch' : activeSection;
  const activeIdx = keys.indexOf(normalized);
  const stepIdx = keys.indexOf(stepKey);
  if (activeIdx < 0 || stepIdx < 0) return 'pending';
  if (stepIdx < activeIdx) return 'done';
  if (stepIdx === activeIdx) return 'active';
  return 'pending';
}

export function ProjectWorkflowStepper({
  activeSection = 'Project Material Planning',
  onOpenSection,
}) {
  return (
    <div className="flex flex-wrap items-center gap-0">
      {PM_WORKFLOW_STEPS.map((s, i) => {
        const state = workflowStepState(activeSection, s.key);
        return (
          <div key={s.key} className="flex items-center">
            <button
              type="button"
              onClick={() => onOpenSection?.(s.key)}
              className="flex items-center gap-2"
            >
              <span
                className={cx(
                  'flex size-8 items-center justify-center rounded-full text-[12px] font-extrabold ring-4 ring-white',
                  state === 'done' && 'bg-[#16a34a] text-white',
                  state === 'active' && 'bg-[#2563eb] text-white',
                  state === 'pending' && 'bg-[#e2e8f0] text-[#64748b]',
                )}
              >
                {state === 'done' ? <Check className="size-4" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cx(
                  'hidden text-[12px] font-extrabold lg:inline',
                  state === 'done' && 'text-[#16a34a]',
                  state === 'active' && 'text-[#2563eb]',
                  state === 'pending' && 'text-[#94a3b8]',
                )}
              >
                {s.label}
              </span>
              <span
                className={cx(
                  'hidden text-[11px] font-extrabold sm:inline lg:hidden',
                  state === 'done' && 'text-[#16a34a]',
                  state === 'active' && 'text-[#2563eb]',
                  state === 'pending' && 'text-[#94a3b8]',
                )}
              >
                {s.short}
              </span>
            </button>
            {i < PM_WORKFLOW_STEPS.length - 1 ? (
              <span
                className={cx(
                  'mx-1.5 hidden h-[3px] w-6 rounded-full sm:block md:mx-2 md:w-10',
                  state === 'done' ? 'bg-[#86efac]' : 'bg-[#e2e8f0]',
                )}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function ProjectPickerDropdown({
  project,
  projects = [],
  onChangeProject,
  onChangeProjectList,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = Array.isArray(projects) ? projects : [];
    if (!q) return list.slice(0, 40);
    return list
      .filter((p) => {
        const hay = `${p.project_name || ''} ${p.customer_name || ''} ${p.project_id || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 40);
  }, [projects, query]);

  const title = project?.project_name || project?.customer_name || 'Select project';
  const label = project?.project_id ? `${title} (${project.project_id})` : title;

  return (
    <div className="relative min-w-[260px] max-w-xl flex-1" ref={ref}>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[13px] font-bold text-[#334155]">Project:</span>
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-[10px] border border-[#d5e0ef] bg-white px-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        <span className="truncate text-[14px] font-extrabold text-[#0f172a]">{label}</span>
        <ChevronDown className="size-4 shrink-0 text-[#94a3b8]" />
      </button>
      {open ? (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-[12px] border border-[#d5e0ef] bg-white shadow-xl">
          <div className="border-b border-[#edf2f8] p-2">
            <div className="flex items-center gap-2 rounded-[8px] border border-[#e2e8f0] bg-[#f8fafc] px-2">
              <Search className="size-3.5 text-[#94a3b8]" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects…"
                className="h-9 w-full bg-transparent text-[13px] font-semibold outline-none"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  setQuery('');
                  if (String(p.id) !== String(project?.id)) onChangeProject?.(p);
                }}
                className={cx(
                  'flex w-full flex-col items-start px-3 py-2.5 text-left hover:bg-[#f8fafc]',
                  String(p.id) === String(project?.id) && 'bg-[#eff6ff]',
                )}
              >
                <span className="text-[13px] font-bold text-[#0f172a]">
                  {p.project_name || p.customer_name}
                  {p.project_id ? ` (${p.project_id})` : ''}
                </span>
                <span className="text-[11px] font-semibold text-[#64748b]">
                  {p.capacity_kwp != null ? `${Number(p.capacity_kwp).toFixed(2)} kW` : '—'}
                  {' · '}
                  {p.system_type || p.project_type || '—'}
                </span>
              </button>
            ))}
            {!filtered.length ? (
              <p className="px-3 py-4 text-center text-[12px] font-semibold text-[#94a3b8]">No projects found</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onChangeProjectList?.();
            }}
            className="flex w-full items-center justify-center gap-2 border-t border-[#edf2f8] px-3 py-2.5 text-[12px] font-extrabold text-[#2563eb]"
          >
            <ArrowLeftRight className="size-3.5" />
            Change Project / Move to Another Project
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Shared chrome for Project Management stage workspaces (Material Planning mockup).
 * Back + crumbs | Project picker + stepper + Mark Done / Next | children body.
 */
export function ProjectWorkflowShell({
  activeSection = 'Project Material Planning',
  stageLabel = 'Material Planning',
  project,
  projects = [],
  showBack = true,
  onBack,
  onOpenSection,
  onChangeProject,
  onMarkDone,
  markDoneLabel,
  markDoneDisabled = false,
  nextLabel,
  nextSection,
  hideActions = false,
  children,
  className = '',
}) {
  const next = NEXT_BY_SECTION[activeSection] || null;
  const resolvedNextSection = nextSection || next?.section;
  const resolvedNextLabel = nextLabel || next?.label || 'Next →';
  const resolvedDoneLabel = markDoneLabel || DONE_LABEL_BY_SECTION[activeSection] || 'Mark Done';

  return (
    <div className={cx('overflow-hidden rounded-[14px] border border-[#e6edf6] bg-white shadow-sm print:shadow-none', className)}>
      <div className="flex flex-wrap items-center gap-3 border-b border-[#e8eef6] px-4 py-3 sm:px-5">
        {showBack && onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#f1a8a8] bg-white px-3 text-[13px] font-bold text-[#e11d48] shadow-sm"
          >
            <ChevronLeft className="size-4" strokeWidth={2.5} />
            Back
          </button>
        ) : null}
        <nav className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-[#94a3b8]">
          <button type="button" className="hover:text-[#2563eb]" onClick={() => onOpenSection?.('Dashboard')}>Dashboard</button>
          <span className="text-[#cbd5e1]">&gt;</span>
          <button type="button" className="hover:text-[#2563eb]" onClick={() => onOpenSection?.('Project List')}>Project Management</button>
          <span className="text-[#cbd5e1]">&gt;</span>
          <span className="font-extrabold text-[#0f172a]">{stageLabel}</span>
        </nav>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e8eef6] px-4 py-4 sm:px-5">
        <ProjectPickerDropdown
          project={project}
          projects={projects}
          onChangeProject={onChangeProject}
          onChangeProjectList={onBack}
        />
        <div className="flex flex-col items-end gap-3">
          <ProjectWorkflowStepper activeSection={activeSection} onOpenSection={onOpenSection} />
          {hideActions ? null : (
            <div className="flex flex-wrap justify-end gap-2">
              {onMarkDone ? (
                <button
                  type="button"
                  disabled={markDoneDisabled}
                  onClick={onMarkDone}
                  className="inline-flex h-10 items-center rounded-[9px] bg-[#16a34a] px-4 text-[13px] font-extrabold text-white shadow-sm hover:bg-[#15803d] disabled:opacity-60"
                >
                  {resolvedDoneLabel}
                </button>
              ) : null}
              {resolvedNextSection ? (
                <button
                  type="button"
                  onClick={() => onOpenSection?.(resolvedNextSection)}
                  className="inline-flex h-10 items-center rounded-[9px] bg-[#2563eb] px-4 text-[13px] font-extrabold text-white shadow-sm hover:bg-[#1d4ed8]"
                >
                  {resolvedNextLabel}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {children}
    </div>
  );
}

export function projectSummaryMeta(project) {
  if (!project) return '';
  return [
    project.project_id,
    project.capacity_kwp != null ? `Capacity: ${Number(project.capacity_kwp).toFixed(2)} kW` : null,
    project.system_type || project.project_type,
  ].filter(Boolean).join(' | ');
}
