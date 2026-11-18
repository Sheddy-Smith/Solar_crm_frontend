import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronLeft,
  Search,
} from 'lucide-react';
import { cx } from '../lib/utils.js';
import { UnderlineTabs } from './UnderlineTabs.jsx';
import { MobileSubnavSelect } from './mobile/MobileSubnavSelect.jsx';

/** All Project Management sub-categories — horizontal underline tabs (mockup style). */
export const PM_WORKFLOW_STEPS = [
  { key: 'Project List', label: 'Project List', short: 'List' },
  { key: 'Project Site Survey', label: 'Site Survey', short: 'Survey' },
  { key: 'Project Material Planning', label: 'Material Planning', short: 'Planning' },
  { key: 'Project Dispatch', label: 'Dispatch', short: 'Dispatch' },
  { key: 'Project Installation', label: 'Installation', short: 'Install' },
];

const NEXT_BY_SECTION = {
  'Project Site Survey': { section: 'Project Material Planning', label: 'Next: Material Planning →' },
  'Project Material Planning': { section: 'Project Dispatch', label: 'Next: Dispatch →' },
  'Project Dispatch': { section: 'Project Installation', label: 'Next: Installation →' },
  'Project Installation': { section: 'Liaisoning & Commissioning', label: 'Next: Liaisoning →' },
};

const DONE_LABEL_BY_SECTION = {
  'Project Site Survey': 'Mark Site Survey Done',
  'Project Material Planning': 'Mark Material Planning Done',
  'Project Dispatch': 'Mark Dispatch Done',
  'Project Installation': 'Mark Installation Done',
};

/** @deprecated stepper states removed — kept for any external imports */
export function workflowStepState(activeSection, stepKey) {
  return activeSection === stepKey ? 'active' : 'pending';
}

/**
 * Horizontal sub-category strip — same style as CRM module tabs:
 * plain labels + green underline on active (Project List … Installation).
 */
export function ProjectWorkflowStepper({
  activeSection = 'Project Material Planning',
  onOpenSection,
}) {
  const items = PM_WORKFLOW_STEPS.map((s) => ({ value: s.key, label: s.label }));
  const value = items.some((i) => i.value === activeSection)
    ? activeSection
    : 'Project Material Planning';

  return (
    <div className="w-full">
      <MobileSubnavSelect
        items={items}
        value={value}
        onChange={(key) => onOpenSection?.(key)}
        label="Category"
        tone="green"
      />
      <UnderlineTabs
        items={items}
        value={value}
        onChange={(key) => onOpenSection?.(key)}
        tone="green"
        className="hidden md:flex"
      />
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
    const digits = q.replace(/\D/g, '');
    const list = Array.isArray(projects) ? projects : [];
    if (!q) return list.slice(0, 40);
    return list
      .filter((p) => {
        const mobile = String(p.mobile_number || p.lead_mobile_number || p.mobile || '');
        const hay = `${p.project_name || ''} ${p.customer_name || ''} ${p.project_id || ''} ${mobile}`.toLowerCase();
        if (hay.includes(q)) return true;
        if (digits.length >= 3 && mobile.replace(/\D/g, '').includes(digits)) return true;
        return false;
      })
      .slice(0, 40);
  }, [projects, query]);

  const title = project?.project_name || project?.customer_name || 'Select project';
  const label = [
    project?.project_id ? `${title} (${project.project_id})` : title,
    project?.customer_name && project?.project_name ? `— Customer: ${project.customer_name}` : null,
  ].filter(Boolean).join(' ');

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
                placeholder="Search project by name, ID, customer, mobile…"
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
                  'flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-[#f8fafc]',
                  String(p.id) === String(project?.id) && 'bg-[#eff6ff]',
                )}
              >
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center">
                  {String(p.id) === String(project?.id) ? (
                    <Check className="size-3.5 text-[#16a34a]" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-[#0f172a]">
                    {p.project_name || 'Untitled'}
                    {p.project_id ? ` (${p.project_id})` : ''}
                  </span>
                  <span className="block text-[11px] font-semibold text-[#64748b]">
                    Customer: {p.customer_name || '—'}
                    {p.mobile_number || p.lead_mobile_number || p.mobile
                      ? ` · ${p.mobile_number || p.lead_mobile_number || p.mobile}`
                      : ''}
                  </span>
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

      <div className="px-4 pt-1 sm:px-5">
        <ProjectWorkflowStepper activeSection={activeSection} onOpenSection={onOpenSection} />
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
