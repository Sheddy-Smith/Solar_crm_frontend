import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Eye, Pencil, Plus, X, XCircle } from 'lucide-react';
import { staffDailyTasksApi } from './api.js';
import { TableHeaderFilter } from './components/TableHeaderFilter.jsx';
import { hasModuleAccess } from './settingsHubPages.jsx';
import { cx } from './lib/utils.js';

function rowsFrom(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function todayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function StatusBadge({ status }) {
  const done = status === 'Completed';
  return (
    <span className={cx(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold',
      done ? 'bg-[#e8f8eb] text-[#0d9f4a]' : 'bg-[#fff4e5] text-[#c2410c]',
    )}>
      {done ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
      {done ? 'Completed' : 'Not Completed'}
    </span>
  );
}

function TaskModal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#10213d]/55 p-3 sm:p-6" onClick={onClose}>
      <div
        className={cx('flex max-h-[92vh] w-full flex-col overflow-hidden rounded-[16px] bg-white shadow-[0_30px_70px_rgba(10,28,60,0.35)]', wide ? 'max-w-[720px]' : 'max-w-[520px]')}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#e8eef6] px-5 py-4">
          <h3 className="font-display text-[17px] font-extrabold text-[#102446]">{title}</h3>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-[9px] text-[#7585a2] transition hover:bg-[#f3f7fd]" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function TaskDetailBody({ task }) {
  const rows = [
    ['Task ID', task.id],
    ['Task', task.title],
    ['Description', task.description || '—'],
    ['Assigned By', task.assigned_by_name || '—'],
    ['Assigned To', task.assigned_to_name || '—'],
    ['User ID', task.assigned_to_user_id || task.assigned_to || '—'],
    ['Branch', task.branch_name || '—'],
    ['Date', formatDate(task.task_date)],
    ['Due Date', formatDate(task.due_date)],
    ['Status', task.status],
  ];
  return (
    <dl className="space-y-3">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[11px] font-extrabold uppercase tracking-wide text-[#8a98af]">{label}</dt>
          <dd className="mt-1 text-[14px] font-semibold text-[#102446]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TeleDailyTasksPage({ me, onNotify, variant = 'tele' }) {
  const assignBtn = variant === 'crm'
    ? 'bg-[#0d9f4a] hover:bg-[#078c3e]'
    : 'bg-[#1d4ed8] hover:bg-[#1a3fb0]';
  const canView = hasModuleAccess(me, 'Daily Tasks', 'View');
  const canAssign = hasModuleAccess(me, 'Daily Tasks', 'Add');
  const canEdit = hasModuleAccess(me, 'Daily Tasks', 'Edit');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [viewTask, setViewTask] = useState(null);
  const [editTask, setEditTask] = useState(null);
  const [editStatus, setEditStatus] = useState('Not Completed');
  const [saving, setSaving] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignees, setAssignees] = useState([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    assigned_to: '',
    task_date: todayIso(),
    due_date: '',
  });

  const loadTasks = () => {
    setLoading(true);
    staffDailyTasksApi.list({ page_size: 500, ordering: '-task_date' })
      .then((data) => setRows(rowsFrom(data)))
      .catch((err) => {
        setRows([]);
        onNotify?.(err.message || 'Could not load Daily Tasks.', 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return undefined;
    }
    loadTasks();
    return undefined;
  }, [canView]);

  useEffect(() => {
    if (!assignOpen || !canAssign) return undefined;
    staffDailyTasksApi.assignees()
      .then((data) => setAssignees(Array.isArray(data) ? data : []))
      .catch(() => setAssignees([]));
    return undefined;
  }, [assignOpen, canAssign]);

  const visibleRows = useMemo(() => {
    if (statusFilter === 'All') return rows;
    return rows.filter((row) => row.status === statusFilter);
  }, [rows, statusFilter]);

  const openEdit = (task) => {
    setEditTask(task);
    setEditStatus(task.status === 'Completed' ? 'Completed' : 'Not Completed');
  };

  const saveStatus = async () => {
    if (!editTask) return;
    setSaving(true);
    try {
      await staffDailyTasksApi.updateStatus(editTask.id, editStatus);
      onNotify?.('Task status updated.', 'success');
      setEditTask(null);
      loadTasks();
    } catch (err) {
      onNotify?.(err.message || 'Could not update status.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const submitAssign = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.assigned_to) {
      onNotify?.('Task title and assigned user are required.', 'error');
      return;
    }
    setSaving(true);
    try {
      await staffDailyTasksApi.create({
        title: form.title.trim(),
        description: form.description.trim(),
        assigned_to: Number(form.assigned_to),
        task_date: form.task_date || todayIso(),
        due_date: form.due_date || null,
        status: 'Not Completed',
      });
      onNotify?.('Daily Task assigned.', 'success');
      setAssignOpen(false);
      setForm({ title: '', description: '', assigned_to: '', task_date: todayIso(), due_date: '' });
      loadTasks();
    } catch (err) {
      onNotify?.(err.message || 'Could not assign task.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return (
      <article className="rounded-[14px] border border-[#e2e9f3] bg-white p-8 text-center shadow-[0_10px_26px_rgba(23,43,77,0.05)]">
        <ClipboardList className="mx-auto size-10 text-[#c5d0e0]" />
        <h2 className="mt-3 font-display text-[18px] font-extrabold text-[#102446]">Daily Tasks access required</h2>
        <p className="mt-2 text-[13px] font-semibold text-[#7585a2]">Ask Super Admin to grant Daily Tasks View permission for your role.</p>
      </article>
    );
  }

  return (
    <div className="space-y-3">
      <section className="flex flex-col gap-3 rounded-[14px] border border-[#e2e9f3] bg-white p-4 shadow-[0_10px_26px_rgba(23,43,77,0.05)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-[18px] font-extrabold text-[#102446]">Daily Tasks</h2>
          <p className="mt-1 text-[12px] font-semibold text-[#7585a2]">Track assigned work and mark Completed / Not Completed.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-10 rounded-[9px] border border-[#dbe4f0] bg-white px-3 text-[13px] font-bold text-[#33456b]"
          >
            <option value="All">All status</option>
            <option value="Not Completed">Not Completed</option>
            <option value="Completed">Completed</option>
          </select>
          {canAssign ? (
            <button
              type="button"
              onClick={() => setAssignOpen(true)}
              className={cx('inline-flex h-10 items-center gap-2 rounded-[9px] px-4 text-[13px] font-extrabold text-white transition', assignBtn)}
            >
              <Plus className="size-4" />
              Assign Task
            </button>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-[14px] border border-[#e2e9f3] bg-white shadow-[0_10px_26px_rgba(23,43,77,0.05)]">
        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full text-left">
            <thead className="bg-[#f7f9fc] text-[11px] font-extrabold uppercase tracking-wide text-[#7585a2]">
              <tr>
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Assigned By</th>
                <th className="px-4 py-3">Assigned To</th>
                <th className="px-4 py-3">User ID</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">
                  <TableHeaderFilter
                    label="Status"
                    value={statusFilter}
                    active={statusFilter !== 'All'}
                    options={['All', 'Not Completed', 'Completed']}
                    onChange={setStatusFilter}
                  />
                </th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="text-[13px]">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center font-semibold text-[#8a98af]">Loading Daily Tasks…</td></tr>
              ) : visibleRows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center font-semibold text-[#8a98af]">No Daily Tasks found.</td></tr>
              ) : visibleRows.map((task) => (
                <tr key={task.id} className="border-t border-[#edf2f8]">
                  <td className="px-4 py-3 font-extrabold text-[#102446]">{task.title}</td>
                  <td className="max-w-[240px] px-4 py-3 font-semibold text-[#53647f]">{task.description || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-[#33456b]">{task.assigned_by_name || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-[#33456b]">{task.assigned_to_name || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-[#33456b]">{task.assigned_to_user_id || task.assigned_to || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-[#33456b]">{formatDate(task.task_date)}</td>
                  <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setViewTask(task)} className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-[#dbe4f0] px-2.5 text-[11px] font-extrabold text-[#1d4ed8] hover:bg-[#f5f9ff]">
                        <Eye className="size-3.5" /> View
                      </button>
                      {canEdit && task.can_update_status ? (
                        <button type="button" onClick={() => openEdit(task)} className="inline-flex h-8 items-center gap-1 rounded-[8px] bg-[#0d9f4a] px-2.5 text-[11px] font-extrabold text-white hover:bg-[#078c3e]">
                          <Pencil className="size-3.5" /> Edit
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {viewTask ? (
        <TaskModal title="Task details" onClose={() => setViewTask(null)}>
          <TaskDetailBody task={viewTask} />
        </TaskModal>
      ) : null}

      {editTask ? (
        <TaskModal title="Update task status" onClose={() => setEditTask(null)}>
          <div className="space-y-4">
            <p className="text-[14px] font-extrabold text-[#102446]">{editTask.title}</p>
            <p className="text-[13px] font-semibold text-[#53647f]">Assigned To: {editTask.assigned_to_name} · Assigned By: {editTask.assigned_by_name}</p>
            <p className="text-[13px] font-semibold text-[#53647f]">Date: {formatDate(editTask.task_date)}</p>
            <p className="text-[12px] font-bold text-[#8a98af]">Only status can be changed.</p>
            <div className="space-y-2">
              {['Completed', 'Not Completed'].map((option) => (
                <label key={option} className="flex items-center gap-2 rounded-[10px] border border-[#e2e9f3] px-3 py-2.5 text-[13px] font-extrabold text-[#102446]">
                  <input
                    type="radio"
                    name="task-status"
                    checked={editStatus === option}
                    onChange={() => setEditStatus(option)}
                  />
                  {option}
                </label>
              ))}
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={saveStatus}
              className="h-11 w-full rounded-[9px] bg-[#0d9f4a] text-[14px] font-extrabold text-white transition hover:bg-[#078c3e] disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Status'}
            </button>
          </div>
        </TaskModal>
      ) : null}

      {assignOpen ? (
        <TaskModal title="Assign Daily Task" onClose={() => setAssignOpen(false)}>
          <form className="space-y-3.5" onSubmit={submitAssign}>
            <label className="block text-[12px] font-extrabold text-[#33456b]">
              Task title
              <input value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} className="mt-1.5 h-11 w-full rounded-[9px] border border-[#dbe4f0] px-3 text-[14px] font-semibold" required />
            </label>
            <label className="block text-[12px] font-extrabold text-[#33456b]">
              Description
              <textarea value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} rows={3} className="mt-1.5 w-full rounded-[9px] border border-[#dbe4f0] px-3 py-2 text-[14px] font-semibold" />
            </label>
            <label className="block text-[12px] font-extrabold text-[#33456b]">
              Assigned To
              <select value={form.assigned_to} onChange={(e) => setForm((c) => ({ ...c, assigned_to: e.target.value }))} className="mt-1.5 h-11 w-full rounded-[9px] border border-[#dbe4f0] px-3 text-[14px] font-semibold" required>
                <option value="">Select user</option>
                {assignees.map((user) => (
                  <option key={user.id} value={user.id}>{user.name} (ID {user.id})</option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[12px] font-extrabold text-[#33456b]">
                Task date
                <input type="date" value={form.task_date} onChange={(e) => setForm((c) => ({ ...c, task_date: e.target.value }))} className="mt-1.5 h-11 w-full rounded-[9px] border border-[#dbe4f0] px-3 text-[14px] font-semibold" />
              </label>
              <label className="block text-[12px] font-extrabold text-[#33456b]">
                Due date
                <input type="date" value={form.due_date} onChange={(e) => setForm((c) => ({ ...c, due_date: e.target.value }))} className="mt-1.5 h-11 w-full rounded-[9px] border border-[#dbe4f0] px-3 text-[14px] font-semibold" />
              </label>
            </div>
            <button type="submit" disabled={saving} className={cx('h-11 w-full rounded-[9px] text-[14px] font-extrabold text-white disabled:opacity-60', assignBtn)}>
              {saving ? 'Assigning…' : 'Assign Task'}
            </button>
          </form>
        </TaskModal>
      ) : null}
    </div>
  );
}
