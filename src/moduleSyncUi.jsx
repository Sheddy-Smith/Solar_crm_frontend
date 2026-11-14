import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  History,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import { moduleSyncApi, projectApi, bomApi, quotationApi } from './api.js';

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

const STATUS_TONE = {
  success: 'bg-[#e8f8eb] text-[#15803d]',
  partial_success: 'bg-[#fff4df] text-[#b45309]',
  failed: 'bg-[#fee2e2] text-[#b91c1c]',
  in_progress: 'bg-[#edf5ff] text-[#0b65e5]',
  pending: 'bg-[#f3f4f6] text-[#4b5563]',
};

export function ModuleIndependentBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-[#0d9f4a]/30 bg-[#e8f8eb] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#15803d]">
      Independent Module
    </span>
  );
}

export function ModuleSyncWorkflowBanner() {
  return (
    <div className="rounded-[12px] border border-[#d9e4f2] bg-gradient-to-r from-[#f3fbf5] via-white to-[#edf5ff] px-4 py-3">
      <div className="flex flex-wrap items-center justify-center gap-2 text-[12px] font-extrabold text-[#1e3261]">
        <span className="rounded-full bg-white px-3 py-1 border border-[#d9e4f2]">Quotation (Independent)</span>
        <span className="text-[#0b65e5]">↔ Manual Sync (Selected Report) ↔</span>
        <span className="rounded-full bg-white px-3 py-1 border border-[#d9e4f2]">Material Planning (Independent)</span>
      </div>
      <p className="mt-1.5 text-center text-[12px] font-bold text-[#0d9f4a]">
        Both Modules Work Independently & Sync Only When You Need.
      </p>
    </div>
  );
}

export function ModuleSyncKeyPoints() {
  const points = [
    'Quotation and Material Planning are independent.',
    'Each module has its own Sync button and dropdown.',
    'Only the selected report is synchronized.',
    'No automatic cross-module synchronization.',
    'Manual changes and dispatched quantities are protected.',
    'Sync history is maintained for audit.',
  ];
  return (
    <div className="rounded-[12px] border border-[#d9e4f2] bg-white p-3 sm:p-4">
      <h3 className="text-[13px] font-extrabold text-[#111827]">Key Points</h3>
      <ul className="mt-2 space-y-1.5">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-[12px] font-semibold text-[#53647f]">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[#0d9f4a]" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ModuleSyncStepper() {
  const steps = [
    'Select Module',
    'Click Sync',
    'Select Report',
    'Confirm & Run',
    'View Results',
  ];
  return (
    <div className="rounded-[12px] border border-[#d9e4f2] bg-white p-3 sm:p-4">
      <h3 className="text-[13px] font-extrabold text-[#111827]">Sync Workflow</h3>
      <ol className="mt-3 space-y-2">
        {steps.map((label, index) => (
          <li key={label} className="flex items-center gap-3 text-[12px] font-bold text-[#30466d]">
            <span className="grid size-6 place-items-center rounded-full bg-[#0d9f4a] text-[11px] font-extrabold text-white">
              {index + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[11px] font-semibold text-[#7386a3]">
        Sync is manual. Only the selected report and project scope are processed.
      </p>
    </div>
  );
}

function useOutsideClose(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onClose?.();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onClose]);
  return ref;
}

export function ModuleSyncDropdown({
  module = 'quotation',
  onNotify,
  defaultProjectId = '',
  onSynced,
}) {
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reports, setReports] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(defaultProjectId || '');
  const [quotationId, setQuotationId] = useState('');
  const [quotations, setQuotations] = useState([]);
  const [bomVersionId, setBomVersionId] = useState('');
  const [bomVersions, setBomVersions] = useState([]);
  const [wizard, setWizard] = useState(null); // { source, destination, reportType }
  const rootRef = useOutsideClose(open && !preview && !historyOpen && !wizard, () => setOpen(false));

  const isQuotationModule = module === 'quotation';

  useEffect(() => {
    if (!open) return;
    moduleSyncApi.reportTypes(module)
      .then((data) => setReports(data.reports || []))
      .catch(() => setReports([]));
    projectApi.list({ page_size: 100 })
      .then((data) => {
        const rows = Array.isArray(data) ? data : (data.results || []);
        setProjects(rows);
        if (!projectId && rows[0]?.id) setProjectId(String(rows[0].id));
      })
      .catch(() => setProjects([]));
  }, [open, module]);

  useEffect(() => {
    if (!projectId) return;
    quotationApi.listAll({ project: projectId, page_size: 50 })
      .then((data) => {
        const rows = Array.isArray(data) ? data : (data.results || []);
        setQuotations(rows);
      })
      .catch(() => setQuotations([]));
    bomApi.versions({ page_size: 50 })
      .then((data) => {
        const rows = Array.isArray(data) ? data : (data.results || []);
        setBomVersions(rows.filter((v) => (v.status || '') === 'Active' || (v.status || '') === 'Draft'));
      })
      .catch(() => setBomVersions([]));
  }, [projectId]);

  const startPreview = async ({ source, destination, reportType }) => {
    if (!projectId) {
      onNotify?.('Select a project before syncing', 'error');
      return;
    }
    setBusy(true);
    try {
      const data = await moduleSyncApi.preview({
        source_module: source,
        destination_module: destination,
        report_type: reportType,
        project_id: Number(projectId),
        quotation_id: quotationId ? Number(quotationId) : undefined,
        bom_version_id: bomVersionId ? Number(bomVersionId) : undefined,
      });
      setPreview(data);
      setOpen(false);
      setWizard(null);
      setReportOpen(false);
    } catch (err) {
      onNotify?.(err.message || 'Sync preview failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirmRun = async () => {
    if (!preview?.preview_token) return;
    setBusy(true);
    try {
      const result = await moduleSyncApi.run({
        preview_token: preview.preview_token,
        confirm: true,
      });
      onNotify?.(`Sync ${result.status}: created ${result.created_records}, updated ${result.updated_records}`, result.status === 'failed' ? 'error' : 'success');
      setPreview(null);
      onSynced?.(result);
    } catch (err) {
      onNotify?.(err.message || 'Sync failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const menuItems = useMemo(() => {
    if (isQuotationModule) {
      return [
        {
          label: 'Sync from Material Planning',
          action: () => setWizard({
            source: 'material_planning',
            destination: 'quotation',
            reportType: 'material_planning_report',
          }),
        },
        { label: 'Sync Selected Report', action: () => setReportOpen((v) => !v), hasSub: true },
        {
          label: 'Sync by Project',
          action: () => setWizard({
            source: 'quotation',
            destination: 'material_planning',
            reportType: 'project_wise_material_report',
          }),
        },
        {
          label: 'Sync by BOM Version',
          action: () => setWizard({
            source: 'quotation',
            destination: 'material_planning',
            reportType: 'bom_report',
          }),
        },
        { label: 'Sync History', action: () => { setHistoryOpen(true); setOpen(false); } },
      ];
    }
    return [
      {
        label: 'Sync from Quotation',
        action: () => setWizard({
          source: 'quotation',
          destination: 'material_planning',
          reportType: 'quotation_material_report',
        }),
      },
      { label: 'Sync Selected Report', action: () => setReportOpen((v) => !v), hasSub: true },
      {
        label: 'Sync by Project',
        action: () => setWizard({
          source: 'material_planning',
          destination: 'quotation',
          reportType: 'project_wise_material_report',
        }),
      },
      {
        label: 'Sync by BOM Version',
        action: () => setWizard({
          source: 'material_planning',
          destination: 'material_planning',
          reportType: 'bom_report',
        }),
      },
      { label: 'Sync History', action: () => { setHistoryOpen(true); setOpen(false); } },
    ];
  }, [isQuotationModule]);

  return (
    <>
      <div className="relative" ref={rootRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-11 items-center gap-2 rounded-[8px] border-2 border-[#dc2626] bg-white px-4 text-[13px] font-extrabold text-[#b91c1c] transition hover:bg-[#fef2f2]"
        >
          <RefreshCw className={cx('size-4', busy && 'animate-spin')} />
          Sync
          <ChevronDown className="size-4" />
        </button>
        {open ? (
          <div className="absolute right-0 top-[calc(100%+6px)] z-[120] min-w-[280px] rounded-[12px] border border-[#d9e4f2] bg-white p-2 shadow-[0_18px_44px_rgba(24,48,87,0.18)]">
            <div className="mb-2 space-y-2 border-b border-[#eef2f7] px-2 pb-2">
              <label className="block text-[11px] font-extrabold uppercase text-[#8493ab]">
                Project
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-[8px] border border-black/20 px-2 text-[12px] font-bold text-[#30466d]"
                >
                  <option value="">Select project…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.project_name || p.project_id || `Project #${p.id}`}</option>
                  ))}
                </select>
              </label>
            </div>
            {menuItems.map((item) => (
              <div key={item.label} className="relative">
                <button
                  type="button"
                  onClick={item.action}
                  className="flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left text-[13px] font-bold text-[#1e3261] hover:bg-[#f8fbff]"
                >
                  {item.label}
                  {item.hasSub ? <ChevronRight className="size-4 text-[#7386a3]" /> : null}
                </button>
                {item.hasSub && reportOpen ? (
                  <div className="mt-1 rounded-[10px] border border-[#e7eef7] bg-[#f8fbff] p-1">
                    {(reports.length ? reports : [
                      { id: 'quotation_material_report', label: 'Quotation Material Report' },
                      { id: 'bom_report', label: 'BOM Report' },
                      { id: 'material_planning_report', label: 'Material Planning Report' },
                      { id: 'project_wise_material_report', label: 'Project-wise Material Report' },
                    ]).map((report) => {
                      const dir = (report.directions || [])[0] || (
                        isQuotationModule
                          ? { source: 'quotation', destination: 'material_planning' }
                          : { source: 'material_planning', destination: 'quotation' }
                      );
                      return (
                        <button
                          key={report.id}
                          type="button"
                          onClick={() => setWizard({
                            source: dir.source,
                            destination: dir.destination,
                            reportType: report.id,
                          })}
                          className="block w-full rounded-[8px] px-3 py-2 text-left text-[12px] font-bold text-[#30466d] hover:bg-white"
                        >
                          {report.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {wizard ? createPortal(
        <div className="fixed inset-0 z-[200] grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-[16px] border border-[#d9e4f2] bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[16px] font-extrabold text-[#111827]">Configure Sync</h3>
                <p className="mt-1 text-[12px] font-semibold text-[#7386a3]">
                  {wizard.source} → {wizard.destination} · {wizard.reportType}
                </p>
              </div>
              <button type="button" onClick={() => setWizard(null)} className="rounded-[8px] p-1 hover:bg-[#f3f4f6]">
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              <label className="block text-[11px] font-extrabold uppercase text-[#8493ab]">
                Project
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-[8px] border border-black/20 px-3 text-[13px] font-bold"
                >
                  <option value="">Select…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.project_name || p.project_id || `Project #${p.id}`}</option>
                  ))}
                </select>
              </label>
              {(wizard.reportType.includes('quotation') || wizard.source === 'quotation' || wizard.destination === 'quotation') ? (
                <label className="block text-[11px] font-extrabold uppercase text-[#8493ab]">
                  Quotation (optional)
                  <select
                    value={quotationId}
                    onChange={(e) => setQuotationId(e.target.value)}
                    className="mt-1 h-10 w-full rounded-[8px] border border-black/20 px-3 text-[13px] font-bold"
                  >
                    <option value="">Auto (Final / latest)</option>
                    {quotations.map((q) => (
                      <option key={q.id} value={q.id}>{q.quotation_number || `#${q.id}`} · {q.status}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              {wizard.reportType === 'bom_report' ? (
                <label className="block text-[11px] font-extrabold uppercase text-[#8493ab]">
                  BOM Version (optional = Active)
                  <select
                    value={bomVersionId}
                    onChange={(e) => setBomVersionId(e.target.value)}
                    className="mt-1 h-10 w-full rounded-[8px] border border-black/20 px-3 text-[13px] font-bold"
                  >
                    <option value="">Active for project capacity</option>
                    {bomVersions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.capacity_kw || v.capacity_config_label || '?'} kW v{v.version_number} ({v.status})
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setWizard(null)} className="h-10 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-extrabold text-[#30466d]">Cancel</button>
              <button
                type="button"
                disabled={busy}
                onClick={() => startPreview(wizard)}
                className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#0d9f4a] px-4 text-[13px] font-extrabold text-white"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Preview Sync
              </button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}

      {preview ? createPortal(
        <div className="fixed inset-0 z-[210] grid place-items-center bg-black/45 p-4">
          <div className="w-full max-w-xl rounded-[16px] border border-[#d9e4f2] bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[16px] font-extrabold text-[#111827]">Sync Preview</h3>
                <p className="mt-1 text-[12px] font-semibold text-[#7386a3]">
                  {preview.source_module} → {preview.destination_module} · {preview.report_type}
                </p>
              </div>
              <button type="button" onClick={() => setPreview(null)} className="rounded-[8px] p-1 hover:bg-[#f3f4f6]">
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                ['Project', preview.project_name],
                ['Quotation', preview.quotation_number || '—'],
                ['Total', preview.counts?.total],
                ['Create', preview.counts?.create],
                ['Update', preview.counts?.update],
                ['Skip / Protected', `${preview.counts?.skip || 0} / ${preview.counts?.protected || 0}`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[10px] border border-[#e7eef7] bg-[#f8fbff] p-3">
                  <p className="text-[10px] font-extrabold uppercase text-[#8493ab]">{label}</p>
                  <p className="mt-1 text-[13px] font-extrabold text-[#1e3261]">{value ?? '—'}</p>
                </div>
              ))}
            </div>
            {(preview.counts?.conflicts || []).length ? (
              <div className="mt-3 rounded-[10px] border border-[#fde68a] bg-[#fffbeb] p-3 text-[12px] font-semibold text-[#92400e]">
                {(preview.counts.conflicts || []).slice(0, 5).map((c) => (
                  <div key={c.key}>{c.key}: {c.reason}</div>
                ))}
              </div>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPreview(null)} className="h-10 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-extrabold text-[#30466d]">Cancel</button>
              <button
                type="button"
                disabled={busy}
                onClick={confirmRun}
                className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#0d9f4a] px-4 text-[13px] font-extrabold text-white"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Confirm & Sync
              </button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}

      {historyOpen ? (
        <ModuleSyncHistoryPanel
          module={module}
          onClose={() => setHistoryOpen(false)}
          onNotify={onNotify}
        />
      ) : null}
    </>
  );
}

export function ModuleSyncHistoryPanel({ module, onClose, onNotify }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    moduleSyncApi.history({ module })
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => {
        setRows([]);
        onNotify?.('Failed to load sync history', 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [module]);

  return createPortal(
    <div className="fixed inset-0 z-[220] grid place-items-center bg-black/45 p-4">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-[16px] border border-[#d9e4f2] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#e7eef7] px-5 py-4">
          <div className="flex items-center gap-2">
            <History className="size-4 text-[#0b65e5]" />
            <h3 className="text-[16px] font-extrabold text-[#111827]">Sync History</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-[8px] p-1 hover:bg-[#f3f4f6]"><X className="size-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {loading ? (
            <div className="py-10 text-center text-[13px] font-bold text-[#7386a3]">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-[13px] font-bold text-[#7386a3]">No sync history yet</div>
          ) : (
            <table className="w-full min-w-[720px] text-left text-[12px]">
              <thead className="text-[11px] font-extrabold uppercase text-[#8493ab]">
                <tr>
                  <th className="px-2 py-2">Module</th>
                  <th className="px-2 py-2">Report</th>
                  <th className="px-2 py-2">Project</th>
                  <th className="px-2 py-2">Records</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Synced On</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[#eef2f7]">
                    <td className="px-2 py-2 font-bold text-[#1e3261]">{row.source_module} → {row.destination_module}</td>
                    <td className="px-2 py-2 font-semibold">{row.report_label || row.report_type}</td>
                    <td className="px-2 py-2 font-semibold">{row.project_name || '—'}</td>
                    <td className="px-2 py-2 font-semibold">
                      {row.created_records}/{row.updated_records}/{row.skipped_records}
                      {row.failed_records ? ` · fail ${row.failed_records}` : ''}
                    </td>
                    <td className="px-2 py-2">
                      <span className={cx('inline-flex rounded-full px-2 py-0.5 text-[11px] font-extrabold', STATUS_TONE[row.status] || STATUS_TONE.pending)}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-2 py-2 font-semibold">
                      {row.completed_at || row.started_at
                        ? new Date(row.completed_at || row.started_at).toLocaleString('en-IN')
                        : '—'}
                    </td>
                    <td className="px-2 py-2">
                      {(row.status === 'failed' || row.status === 'partial_success') ? (
                        <button
                          type="button"
                          className="text-[12px] font-extrabold text-[#0b65e5]"
                          onClick={async () => {
                            try {
                              await moduleSyncApi.retryFailed(row.id);
                              onNotify?.('Retry completed', 'success');
                              load();
                            } catch (err) {
                              onNotify?.(err.message || 'Retry failed', 'error');
                            }
                          }}
                        >
                          Retry failed
                        </button>
                      ) : (
                        <span className="text-[#8493ab]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function MarkAsFinalConfirmModal({
  quotation,
  previousFinal,
  busy,
  onCancel,
  onConfirm,
}) {
  if (!quotation) return null;
  return createPortal(
    <div className="fixed inset-0 z-[230] grid place-items-center bg-black/45 p-4">
      <div className="w-full max-w-lg rounded-[16px] border border-[#d9e4f2] bg-white p-5 shadow-xl">
        <h3 className="text-[16px] font-extrabold text-[#111827]">Mark as Final Quotation?</h3>
        <p className="mt-2 text-[13px] font-semibold text-[#53647f]">
          This will set this quotation as the active Final Quotation. The previous Final Quotation (if any) will be marked as Superseded. Final quotations cannot be edited (change via Revision).
        </p>
        <div className="mt-4 space-y-2 rounded-[12px] border border-[#e7eef7] bg-[#f8fbff] p-3 text-[13px] font-bold text-[#1e3261]">
          <div>No.: {quotation.quotation_number || `#${quotation.id}`}</div>
          <div>Project: {quotation.project_name || quotation.lead_project_name || '—'}</div>
          <div>Customer: {quotation.lead_customer_name || quotation.customer_name || '—'}</div>
          <div>Amount: ₹ {Number(quotation.grand_total || 0).toLocaleString('en-IN')}</div>
          <div>Current Status: {quotation.status}</div>
          {previousFinal ? (
            <div className="text-[#b45309]">
              Existing Final: {previousFinal.quotation_number || `#${previousFinal.id}`} will become Superseded
            </div>
          ) : null}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-10 rounded-[8px] border border-[#d9e4f2] px-4 text-[13px] font-extrabold text-[#30466d]">Cancel</button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#0d9f4a] px-4 text-[13px] font-extrabold text-white"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Mark as Final
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
