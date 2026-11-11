import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  Cloud,
  Download,
  HardDrive,
  Info,
  Pencil,
  Phone,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { getMediaUrl, settingsApi, userApi } from './api.js';
import { LIST_PAGE_SIZE, rowsOf } from './lib/listQuery.js';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

const CARD = 'rounded-[14px] border border-[#e2e9f3] bg-white shadow-[0_10px_26px_rgba(23,43,77,0.06)]';

function formatWhen(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PageShell({ title, note, actions, children }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#0e582a]">Sync, Share & Backup</p>
          <h1 className="mt-1 font-display text-[22px] font-extrabold text-[#163d70]">{title}</h1>
          {note ? <p className="mt-1 max-w-3xl text-[13px] font-semibold text-[#7b88a2]">{note}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

function PrimaryButton({ children, onClick, tone = 'green', disabled, className }) {
  const tones = {
    green: 'bg-[#0d9f4a] text-white hover:bg-[#0b8a40]',
    blue: 'bg-[#0b65e5] text-white hover:bg-[#0954c4]',
    red: 'bg-[#dc2626] text-white hover:bg-[#b91c1c]',
    slate: 'border border-[#d9e2ec] bg-white text-[#1e3261] hover:bg-[#f8fbff]',
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'inline-flex h-10 items-center justify-center gap-2 rounded-[9px] px-4 text-[13px] font-extrabold transition disabled:opacity-60',
        tones[tone],
        className,
      )}
    >
      {children}
    </button>
  );
}

function useBackupConfig(onNotify) {
  const [config, setConfig] = useState({
    syncFrequency: 'Daily',
    backupLocation: 'Server',
    liveSync: true,
    retentionDays: '30',
    autoBackup: true,
    autoBackupEveryDays: '1',
  });
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    settingsApi.category('backup').get()
      .then((data) => {
        if (data) setConfig((prev) => ({ ...prev, ...data }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const save = async (patch = {}) => {
    const next = { ...config, ...patch };
    setConfig(next);
    setSaving(true);
    try {
      await settingsApi.category('backup').update(next);
      onNotify?.('Backup settings saved', 'success');
    } catch {
      onNotify?.('Could not save backup settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  return { config, setConfig, save, saving, reload };
}

function useBackupList(onNotify) {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    settingsApi.backups.list()
      .then((res) => setBackups(Array.isArray(res) ? res : rowsOf(res)))
      .catch(() => {
        setBackups([]);
        onNotify?.('Could not load backups.', 'error');
      })
      .finally(() => setLoading(false));
  }, [onNotify]);

  useEffect(() => { reload(); }, [reload]);

  const runBackup = async (backupType = 'Full') => {
    setRunning(true);
    try {
      const row = await settingsApi.backups.create(backupType);
      onNotify?.('Backup completed', 'success');
      await reload();
      return row;
    } catch {
      onNotify?.('Backup failed', 'error');
      return null;
    } finally {
      setRunning(false);
    }
  };

  const downloadBackup = (item) => {
    if (!item?.filename) {
      onNotify?.('Backup file not available.', 'error');
      return;
    }
    const href = getMediaUrl(`/media/backups/${item.filename}`);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = item.filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    onNotify?.(`Downloading ${item.filename}`, 'success');
  };

  return { backups, loading, running, reload, runBackup, downloadBackup };
}

function SyncSharePage({ onNotify, onOpenSection, loggedInUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { config, reload: reloadConfig } = useBackupConfig(onNotify);

  const loadUsers = useCallback(() => {
    setLoading(true);
    userApi.list({ page_size: 100, is_active: true })
      .then((data) => setUsers(rowsOf(data)))
      .catch(() => {
        setUsers([]);
        onNotify?.('Users could not be loaded.', 'error');
      })
      .finally(() => setLoading(false));
  }, [onNotify]);

  useEffect(() => {
    loadUsers();
    reloadConfig();
  }, [loadUsers, reloadConfig]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => [
      user.name,
      user.email,
      user.mobile,
      user.role_name,
    ].some((value) => String(value || '').toLowerCase().includes(q)));
  }, [users, search]);

  return (
    <PageShell
      title="Sync & Share"
      note="Share CRM access with your team and keep live sync healthy across devices."
      actions={(
        <>
          <PrimaryButton tone="slate" onClick={() => { loadUsers(); reloadConfig(); }}>
            <RefreshCw className="size-4" />
            Refresh
          </PrimaryButton>
          <PrimaryButton tone="blue" onClick={() => onOpenSection?.('Settings Users')}>
            <UserPlus className="size-4" />
            Add Users
          </PrimaryButton>
        </>
      )}
    >
      <div className="rounded-[12px] border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-[13px] font-semibold text-[#1e3a8a]">
        Not sure how to add users and permissions? Open{' '}
        <button type="button" className="font-extrabold underline" onClick={() => onOpenSection?.('Settings Roles & Permissions')}>
          Roles & Permissions
        </button>
        {' '}or{' '}
        <button type="button" className="font-extrabold underline" onClick={() => onOpenSection?.('Settings Users')}>
          Users
        </button>
        .
      </div>

      <div className={`${CARD} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}>
        <div>
          <p className="text-[12px] font-bold text-[#7b88a2]">Currently logged in</p>
          <p className="mt-1 text-[14px] font-extrabold text-[#163d70]">
            {loggedInUser?.mobile || loggedInUser?.email || loggedInUser?.name || '—'}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-[#e8f8eb] px-3 py-1.5 text-[12px] font-extrabold text-[#0d9f4a]">
          <span className={cx('size-2 rounded-full', config.liveSync ? 'bg-[#0d9f4a]' : 'bg-[#f59e0b]')} />
          {config.liveSync ? 'Live Sync Active' : 'Live Sync Paused'}
        </div>
      </div>

      <section className={`${CARD} p-4 sm:p-5`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-[17px] font-extrabold text-[#102446]">Shared Users</h2>
            <p className="mt-1 text-[12px] font-semibold text-[#7585a2]">Team members who can access this CRM workspace.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex h-10 min-w-[220px] items-center gap-2 rounded-[9px] border border-[#dbe4f0] bg-white px-3">
              <Search className="size-4 text-[#7585a2]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, phone, role..."
                className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-[#1f2d44] outline-none"
              />
            </label>
            <PrimaryButton tone="slate" onClick={() => onOpenSection?.('Users Activity')}>
              <Users className="size-4" />
              See User Activity
            </PrimaryButton>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="border-b border-[#e8eef6] text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#7b88a2]">
                <th className="px-3 py-3">Full Name</th>
                <th className="px-3 py-3">Phone / Email</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Role</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-[13px] font-bold text-[#7585a2]">Loading users…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-[13px] font-bold text-[#7585a2]">No shared users found.</td></tr>
              ) : filtered.map((user) => (
                <tr key={user.id} className="border-b border-[#f0f4fa]">
                  <td className="px-3 py-3 text-[13px] font-extrabold text-[#163d70]">{user.name || '—'}</td>
                  <td className="px-3 py-3 text-[13px] font-semibold text-[#53647f]">
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="size-3.5 text-[#94a3b8]" />
                      {user.mobile || user.email || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cx(
                      'inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold',
                      user.is_active ? 'bg-[#e8f8eb] text-[#0d9f4a]' : 'bg-[#fff7ed] text-[#c2410c]',
                    )}>
                      {user.is_active ? 'Joined' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[12px] font-extrabold uppercase tracking-[0.04em] text-[#33456b]">
                    {user.role_name || '—'}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenSection?.('Settings Roles & Permissions')}
                        className="text-[12px] font-extrabold text-[#0b65e5]"
                      >
                        Change Role
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenSection?.('Settings Users')}
                        className="grid size-8 place-items-center rounded-[8px] border border-[#dbe4f0] text-[#0b65e5]"
                        aria-label={`Edit ${user.name}`}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenSection?.('Settings Users')}
                        className="grid size-8 place-items-center rounded-[8px] border border-[#fecaca] text-[#dc2626]"
                        aria-label={`Manage ${user.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}

function AutoBackupPage({ onNotify }) {
  const { config, setConfig, save, saving } = useBackupConfig(onNotify);
  const { backups, loading } = useBackupList(onNotify);
  const last = backups[0];

  return (
    <PageShell
      title="Auto Backup"
      note="Schedule automatic CRM backups and keep an audit trail of restore points."
      actions={(
        <PrimaryButton disabled={saving} onClick={() => save()}>
          Save Auto Backup
        </PrimaryButton>
      )}
    >
      <section className={`${CARD} p-5`}>
        <h2 className="text-[15px] font-extrabold text-[#1e3261]">Backup & History</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex items-start gap-3 rounded-[12px] border border-[#e8eef6] p-4">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-[#0b65e5]"
              checked={Boolean(config.autoBackup)}
              onChange={(e) => setConfig((prev) => ({ ...prev, autoBackup: e.target.checked }))}
            />
            <span>
              <span className="block text-[13px] font-extrabold text-[#163d70]">Auto Backup</span>
              <span className="mt-1 block text-[12px] font-semibold text-[#7b88a2]">
                Last Backup {last ? formatWhen(last.created_at) : 'Never'}
              </span>
            </span>
          </label>
          <label className="rounded-[12px] border border-[#e8eef6] p-4 text-[13px] font-extrabold text-[#163d70]">
            Auto Backup every
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="30"
                value={config.autoBackupEveryDays || '1'}
                onChange={(e) => setConfig((prev) => ({ ...prev, autoBackupEveryDays: e.target.value }))}
                className="h-10 w-20 rounded-[8px] border border-[#d9e2ec] px-3 text-[13px] font-bold"
              />
              <span className="text-[12px] font-semibold text-[#7b88a2]">days</span>
            </div>
          </label>
          <label className="flex items-start gap-3 rounded-[12px] border border-[#e8eef6] p-4">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-[#0b65e5]"
              checked={Boolean(config.liveSync)}
              onChange={(e) => setConfig((prev) => ({ ...prev, liveSync: e.target.checked }))}
            />
            <span>
              <span className="block text-[13px] font-extrabold text-[#163d70]">Live Sync</span>
              <span className="mt-1 block text-[12px] font-semibold text-[#7b88a2]">Keep workspace changes synchronized.</span>
            </span>
          </label>
          <label className="rounded-[12px] border border-[#e8eef6] p-4 text-[13px] font-extrabold text-[#163d70]">
            Sync Frequency
            <select
              className="mt-2 h-10 w-full rounded-[8px] border border-[#d9e2ec] px-3 text-[13px] font-bold"
              value={config.syncFrequency || 'Daily'}
              onChange={(e) => setConfig((prev) => ({ ...prev, syncFrequency: e.target.value }))}
            >
              {['Hourly', 'Daily', 'Weekly', 'Manual'].map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className={`${CARD} p-5`}>
        <h2 className="text-[15px] font-extrabold text-[#1e3261]">Recent Restore Points</h2>
        {loading ? (
          <p className="mt-4 text-[13px] font-bold text-[#7585a2]">Loading…</p>
        ) : backups.length === 0 ? (
          <p className="mt-4 text-[13px] font-bold text-[#7585a2]">No backups yet. Run a manual backup from Backup To Computer.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {backups.slice(0, 8).map((item) => (
              <div key={item.id} className="flex flex-col gap-1 rounded-[10px] border border-[#e8eef6] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[13px] font-extrabold text-[#163d70]">{item.filename}</p>
                  <p className="text-[12px] font-semibold text-[#7b88a2]">{formatWhen(item.created_at)} · {item.file_size || '—'}</p>
                </div>
                <span className={cx(
                  'inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-extrabold',
                  item.status === 'Failed' ? 'bg-[#fff7ed] text-[#c2410c]' : 'bg-[#e8f8eb] text-[#0d9f4a]',
                )}>
                  {item.status || 'Completed'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}

function BackupToComputerPage({ onNotify }) {
  const { backups, loading, running, runBackup, downloadBackup, reload } = useBackupList(onNotify);

  const runAndDownload = async () => {
    const row = await runBackup('Computer');
    if (row?.filename) downloadBackup(row);
  };

  return (
    <PageShell
      title="Backup To Computer"
      note="Create a full CRM backup and download the file to this device."
      actions={(
        <>
          <PrimaryButton tone="slate" onClick={reload}><RefreshCw className="size-4" /> Refresh</PrimaryButton>
          <PrimaryButton disabled={running} onClick={runAndDownload}>
            <Download className="size-4" />
            {running ? 'Creating…' : 'Backup & Download'}
          </PrimaryButton>
        </>
      )}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <article className={`${CARD} p-4`}>
          <HardDrive className="size-5 text-[#0d9f4a]" />
          <p className="mt-3 text-[12px] font-bold text-[#7b88a2]">Local Export</p>
          <p className="mt-1 text-[15px] font-extrabold text-[#163d70]">JSON.gz dump</p>
        </article>
        <article className={`${CARD} p-4`}>
          <Shield className="size-5 text-[#0b65e5]" />
          <p className="mt-3 text-[12px] font-bold text-[#7b88a2]">Security</p>
          <p className="mt-1 text-[15px] font-extrabold text-[#163d70]">Admin only</p>
        </article>
        <article className={`${CARD} p-4`}>
          <Cloud className="size-5 text-[#7c3aed]" />
          <p className="mt-3 text-[12px] font-bold text-[#7b88a2]">Restore Points</p>
          <p className="mt-1 text-[15px] font-extrabold text-[#163d70]">{backups.length}</p>
        </article>
      </div>

      <section className={`${CARD} p-5`}>
        <h2 className="text-[15px] font-extrabold text-[#1e3261]">Computer Backup History</h2>
        <div className="mt-4 space-y-2">
          {loading ? <p className="text-[13px] font-bold text-[#7585a2]">Loading…</p> : null}
          {!loading && backups.length === 0 ? <p className="text-[13px] font-bold text-[#7585a2]">No backups yet.</p> : null}
          {backups.map((item) => (
            <div key={item.id} className="flex flex-col gap-2 rounded-[10px] border border-[#e8eef6] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[13px] font-extrabold text-[#163d70]">{item.filename}</p>
                <p className="text-[12px] font-semibold text-[#7b88a2]">{formatWhen(item.created_at)} · {item.file_size || '—'} · {item.backup_type || 'Full'}</p>
              </div>
              <PrimaryButton tone="slate" onClick={() => downloadBackup(item)}>
                <Download className="size-4" />
                Download
              </PrimaryButton>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}

function BackupToDrivePage({ onNotify }) {
  const { config, setConfig, save, saving } = useBackupConfig(onNotify);
  const { backups, running, runBackup, downloadBackup } = useBackupList(onNotify);

  const runDriveBackup = async () => {
    await save({ backupLocation: 'Offsite Cloud' });
    const row = await runBackup('Drive');
    if (row?.filename) {
      onNotify?.('Drive backup created on server. Download a local copy if needed.', 'success');
    }
  };

  return (
    <PageShell
      title="Backup To Drive"
      note="Send restore points to offsite/cloud storage preference and keep a local copy when required."
      actions={(
        <PrimaryButton disabled={running || saving} onClick={runDriveBackup}>
          <Upload className="size-4" />
          {running ? 'Uploading…' : 'Backup To Drive'}
        </PrimaryButton>
      )}
    >
      <section className={`${CARD} p-5`}>
        <h2 className="text-[15px] font-extrabold text-[#1e3261]">Drive Settings</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-[12px] font-bold text-[#53647f]">
            Backup Location
            <select
              className="mt-1.5 h-11 w-full rounded-[8px] border border-[#d9e2ec] px-3"
              value={config.backupLocation || 'Offsite Cloud'}
              onChange={(e) => setConfig((prev) => ({ ...prev, backupLocation: e.target.value }))}
            >
              {['Server', 'Offsite Cloud'].map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="text-[12px] font-bold text-[#53647f]">
            Retention (Days)
            <input
              className="mt-1.5 h-11 w-full rounded-[8px] border border-[#d9e2ec] px-3"
              value={config.retentionDays || '30'}
              onChange={(e) => setConfig((prev) => ({ ...prev, retentionDays: e.target.value }))}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <PrimaryButton tone="slate" disabled={saving} onClick={() => save()}>Save Drive Config</PrimaryButton>
        </div>
        <p className="mt-4 flex items-start gap-2 text-[12px] font-semibold text-[#7b88a2]">
          <Info className="mt-0.5 size-4 shrink-0 text-[#0b65e5]" />
          Cloud credentials stay on the server. This creates a server-side restore point tagged for Drive/offsite location.
        </p>
      </section>

      <section className={`${CARD} p-5`}>
        <h2 className="text-[15px] font-extrabold text-[#1e3261]">Recent Drive / Offsite Backups</h2>
        <div className="mt-4 space-y-2">
          {(backups.filter((item) => item.backup_type === 'Drive').length
            ? backups.filter((item) => item.backup_type === 'Drive')
            : backups
          ).slice(0, 10).map((item) => (
            <div key={item.id} className="flex flex-col gap-2 rounded-[10px] border border-[#e8eef6] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[13px] font-extrabold text-[#163d70]">{item.filename}</p>
                <p className="text-[12px] font-semibold text-[#7b88a2]">{formatWhen(item.created_at)} · {item.file_size || '—'} · {item.backup_type || 'Full'}</p>
              </div>
              <PrimaryButton tone="slate" onClick={() => downloadBackup(item)}>
                <Download className="size-4" />
                Local Copy
              </PrimaryButton>
            </div>
          ))}
          {backups.length === 0 ? <p className="text-[13px] font-bold text-[#7585a2]">No drive backups yet.</p> : null}
        </div>
      </section>
    </PageShell>
  );
}

function RestoreBackupPage({ onNotify, onOpenSection }) {
  const { backups, loading, downloadBackup, reload } = useBackupList(onNotify);
  const [confirmId, setConfirmId] = useState(null);

  return (
    <PageShell
      title="Restore Backup"
      note="Download restore points safely. Soft-deleted CRM records can be recovered from Recycle Bin without a full database restore."
      actions={(
        <>
          <PrimaryButton tone="slate" onClick={reload}><RefreshCw className="size-4" /> Refresh</PrimaryButton>
          <PrimaryButton tone="blue" onClick={() => onOpenSection?.('Recycle Bin')}>
            Open Recycle Bin
          </PrimaryButton>
        </>
      )}
    >
      <div className="rounded-[12px] border border-[#fed7aa] bg-[#fff7ed] px-4 py-3 text-[13px] font-semibold text-[#9a3412]">
        <span className="inline-flex items-center gap-2 font-extrabold"><AlertTriangle className="size-4" /> Safety first</span>
        <p className="mt-1">
          Full database restore can overwrite live data. Prefer Recycle Bin for deleted leads/follow-ups.
          Use downloaded backups only with Super Admin approval.
        </p>
      </div>

      <section className={`${CARD} p-5`}>
        <h2 className="text-[15px] font-extrabold text-[#1e3261]">Available Restore Points</h2>
        <div className="mt-4 space-y-2">
          {loading ? <p className="text-[13px] font-bold text-[#7585a2]">Loading…</p> : null}
          {!loading && backups.length === 0 ? <p className="text-[13px] font-bold text-[#7585a2]">No restore points found.</p> : null}
          {backups.map((item) => (
            <div key={item.id} className="rounded-[10px] border border-[#e8eef6] px-3 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[13px] font-extrabold text-[#163d70]">{item.filename}</p>
                  <p className="text-[12px] font-semibold text-[#7b88a2]">{formatWhen(item.created_at)} · {item.file_size || '—'} · {item.status || 'Completed'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <PrimaryButton tone="slate" onClick={() => downloadBackup(item)}>
                    <Download className="size-4" />
                    Download
                  </PrimaryButton>
                  <PrimaryButton
                    tone={confirmId === item.id ? 'red' : 'slate'}
                    onClick={() => {
                      if (confirmId !== item.id) {
                        setConfirmId(item.id);
                        onNotify?.('Confirm again to mark restore request. Full DB restore is admin-gated.', 'error');
                        return;
                      }
                      onNotify?.(`Restore requested for ${item.filename}. Use Recycle Bin for soft-deleted records.`, 'success');
                      setConfirmId(null);
                    }}
                  >
                    {confirmId === item.id ? 'Confirm Restore Request' : 'Request Restore'}
                  </PrimaryButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toDisplayDate(isoDate) {
  if (!isoDate) return '';
  const [year, month, day] = String(isoDate).split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

function periodBounds(period, customFrom, customTo) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (period === 'Today') {
    start.setHours(0, 0, 0, 0);
  } else if (period === 'This Week') {
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
  } else if (period === 'This Month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else if (period === 'This Quarter') {
    const quarterStart = Math.floor(start.getMonth() / 3) * 3;
    start.setMonth(quarterStart, 1);
    start.setHours(0, 0, 0, 0);
  } else if (period === 'This Year') {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  } else if (period === 'Custom') {
    const from = customFrom ? new Date(`${customFrom}T00:00:00`) : new Date(0);
    const to = customTo ? new Date(`${customTo}T23:59:59`) : end;
    return { start: from, end: to };
  } else {
    start.setTime(0);
  }
  return { start, end };
}

function actionTone(action) {
  const value = String(action || '').toUpperCase();
  if (value.includes('DELETE') || value.includes('REMOVE')) return 'bg-[#fce7f3] text-[#be185d]';
  if (value.includes('CREATE') || value.includes('ADD')) return 'bg-[#dbeafe] text-[#1d4ed8]';
  if (value.includes('LOGIN') || value.includes('SYNC')) return 'bg-[#e8f8eb] text-[#0d9f4a]';
  return 'bg-[#ffe4e6] text-[#e11d48]';
}

function UsersActivityPage({ onNotify, onOpenSection }) {
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserIds, setSelectedUserIds] = useState([]); // empty => All Users
  const [period, setPeriod] = useState('This Month');
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    return toInputDate(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [dateTo, setDateTo] = useState(() => toInputDate(new Date()));
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  const filterRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      settingsApi.activityLogs.list({ page_size: LIST_PAGE_SIZE * 8, ordering: '-created_at' }),
      userApi.list({ page_size: 100 }),
    ])
      .then(([activity, userData]) => {
        setRows(rowsOf(activity));
        setUsers(rowsOf(userData));
      })
      .catch(() => {
        setRows([]);
        setUsers([]);
        onNotify?.('Activity log could not be loaded.', 'error');
      })
      .finally(() => setLoading(false));
  }, [onNotify]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!userMenuOpen && !periodMenuOpen) return undefined;
    const onPointerDown = (event) => {
      if (!(event.target instanceof Element)) return;
      if (!filterRef.current?.contains(event.target)) {
        setUserMenuOpen(false);
        setPeriodMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [userMenuOpen, periodMenuOpen]);

  const roleByUserId = useMemo(() => {
    const map = new Map();
    users.forEach((user) => map.set(String(user.id), user.role_name || '—'));
    return map;
  }, [users]);

  const applyPeriod = (nextPeriod) => {
    setPeriod(nextPeriod);
    setPeriodMenuOpen(false);
    const now = new Date();
    if (nextPeriod === 'Today') {
      const today = toInputDate(now);
      setDateFrom(today);
      setDateTo(today);
      return;
    }
    if (nextPeriod === 'This Week') {
      const start = new Date(now);
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diff);
      setDateFrom(toInputDate(start));
      setDateTo(toInputDate(now));
      return;
    }
    if (nextPeriod === 'This Month') {
      setDateFrom(toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)));
      setDateTo(toInputDate(now));
      return;
    }
    if (nextPeriod === 'This Quarter') {
      const quarterStart = Math.floor(now.getMonth() / 3) * 3;
      setDateFrom(toInputDate(new Date(now.getFullYear(), quarterStart, 1)));
      setDateTo(toInputDate(now));
      return;
    }
    if (nextPeriod === 'This Year') {
      setDateFrom(toInputDate(new Date(now.getFullYear(), 0, 1)));
      setDateTo(toInputDate(now));
    }
  };

  const toggleUser = (userId) => {
    setSelectedUserIds((prev) => {
      if (userId === 'ALL') return [];
      const id = String(userId);
      if (prev.includes(id)) return prev.filter((value) => value !== id);
      return [...prev, id];
    });
  };

  const filtered = useMemo(() => {
    const { start, end } = periodBounds(period === 'Custom' ? 'Custom' : period, dateFrom, dateTo);
    return rows.filter((row) => {
      const when = new Date(row.created_at);
      if (!Number.isNaN(when.getTime()) && (when < start || when > end)) return false;
      if (selectedUserIds.length === 0) return true;
      return selectedUserIds.includes(String(row.user ?? ''));
    });
  }, [rows, period, dateFrom, dateTo, selectedUserIds]);

  const userFilterLabel = selectedUserIds.length === 0
    ? 'All Users'
    : selectedUserIds.length === 1
      ? (users.find((user) => String(user.id) === selectedUserIds[0])?.name || '1 User')
      : `${selectedUserIds.length} Users`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-[28px] font-extrabold tracking-tight text-[#1f2937]">Users Activity Table</h1>
        <div className="flex flex-wrap gap-2">
          <PrimaryButton tone="slate" onClick={load}><RefreshCw className="size-4" /> Refresh</PrimaryButton>
          <PrimaryButton tone="slate" onClick={() => onOpenSection?.('Sync & Share')}>Back to Sync & Share</PrimaryButton>
        </div>
      </div>

      <div ref={filterRef} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-[#6b7280]">Filter by:</span>

          <div className="relative">
            <button
              type="button"
              onClick={() => { setUserMenuOpen((open) => !open); setPeriodMenuOpen(false); }}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-[#d7dee8] bg-white px-4 text-[13px] font-semibold text-[#334155] shadow-sm"
            >
              {userFilterLabel}
              <ChevronDown className="size-4 text-[#94a3b8]" />
            </button>
            {userMenuOpen ? (
              <div className="absolute left-0 z-30 mt-2 w-[240px] rounded-[12px] border border-[#e5e7eb] bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.14)]">
                <label className="flex cursor-pointer items-center gap-3 rounded-[8px] px-3 py-2 text-[13px] font-semibold text-[#111827] hover:bg-[#f8fafc]">
                  <input
                    type="checkbox"
                    checked={selectedUserIds.length === 0}
                    onChange={() => toggleUser('ALL')}
                    className="size-4 accent-[#2563eb]"
                  />
                  All Users
                </label>
                <div className="my-1 border-t border-[#eef2f7]" />
                <div className="max-h-56 overflow-y-auto">
                  {users.map((user) => (
                    <label key={user.id} className="flex cursor-pointer items-center gap-3 rounded-[8px] px-3 py-2 text-[13px] font-semibold text-[#111827] hover:bg-[#f8fafc]">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(String(user.id))}
                        onChange={() => toggleUser(user.id)}
                        className="size-4 accent-[#2563eb]"
                      />
                      {user.name || user.email || `User ${user.id}`}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => { setPeriodMenuOpen((open) => !open); setUserMenuOpen(false); }}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-[#d7dee8] bg-white px-4 text-[13px] font-semibold text-[#334155] shadow-sm"
            >
              {period}
              <ChevronDown className="size-4 text-[#94a3b8]" />
            </button>
            {periodMenuOpen ? (
              <div className="absolute left-0 z-30 mt-2 w-[200px] rounded-[12px] border border-[#e5e7eb] bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.14)]">
                {['Today', 'This Week', 'This Month', 'This Quarter', 'This Year', 'Custom'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => applyPeriod(option)}
                    className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2 text-left text-[13px] font-semibold text-[#111827] hover:bg-[#f8fafc]"
                  >
                    <span className={cx(
                      'grid size-4 place-items-center rounded-full border',
                      period === option ? 'border-[#2563eb]' : 'border-[#cbd5e1]',
                    )}>
                      {period === option ? <span className="size-2 rounded-full bg-[#2563eb]" /> : null}
                    </span>
                    {option}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="inline-flex h-10 items-center gap-2 rounded-full border border-[#d7dee8] bg-white px-3 text-[13px] font-semibold text-[#334155] shadow-sm">
            <CalendarDays className="size-4 text-[#94a3b8]" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPeriod('Custom'); }}
              className="w-[118px] bg-transparent text-[12px] font-semibold outline-none"
              aria-label="From date"
            />
            <span className="text-[#94a3b8]">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPeriod('Custom'); }}
              className="w-[118px] bg-transparent text-[12px] font-semibold outline-none"
              aria-label="To date"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#dbe4f0] bg-[#f8fafc] px-3 py-1.5 text-[12px] font-extrabold text-[#334155]">
            {userFilterLabel}
            {selectedUserIds.length > 0 ? (
              <button type="button" onClick={() => setSelectedUserIds([])} aria-label="Clear user filter">
                <X className="size-3.5 text-[#94a3b8]" />
              </button>
            ) : (
              <button type="button" onClick={() => setUserMenuOpen(true)} aria-label="Open user filter">
                <X className="size-3.5 text-[#94a3b8]" />
              </button>
            )}
          </span>
          <span className="text-[12px] font-semibold text-[#94a3b8]">
            {toDisplayDate(dateFrom)} To {toDisplayDate(dateTo)}
          </span>
        </div>
      </div>

      <section className="overflow-hidden rounded-[12px] border border-[#e5eaf2] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="bg-[#eef5ff] text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#64748b]">
                <th className="px-4 py-3">Full Name</th>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Actions</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-[13px] font-bold text-[#7585a2]">Loading activity…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-[13px] font-bold text-[#7585a2]">No activity for selected filters.</td></tr>
              ) : filtered.map((row, index) => (
                <tr key={row.id} className={index % 2 === 0 ? 'bg-white' : 'bg-[#f7fbff]'}>
                  <td className="px-4 py-3.5 text-[13px] font-semibold text-[#1f2937]">{row.user_name || 'System'}</td>
                  <td className="px-4 py-3.5 text-[12px] font-semibold text-[#64748b]">{formatWhen(row.created_at)}</td>
                  <td className="px-4 py-3.5 text-[12px] font-semibold text-[#475569]">
                    {roleByUserId.get(String(row.user ?? '')) || '—'}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={cx('inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.04em]', actionTone(row.action))}>
                      {row.action || 'Activity'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-[12px] font-semibold text-[#2563eb]">
                    {row.description || row.module || 'View'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export const syncShareBackupSubItems = [
  'Sync & Share',
  'Auto Backup',
  'Backup To Computer',
  'Backup To Drive',
  'Restore Backup',
  'Users Activity',
];

export const syncShareBackupRelatedPages = [
  'Sync, Share & Backup',
  ...syncShareBackupSubItems,
];

export function SyncShareBackupPage({
  activeSection = 'Sync & Share',
  onOpenSection,
  onNotify,
  loggedInUser,
}) {
  const section = syncShareBackupSubItems.includes(activeSection) ? activeSection : 'Sync & Share';

  if (section === 'Auto Backup') {
    return <AutoBackupPage onNotify={onNotify} />;
  }
  if (section === 'Backup To Computer') {
    return <BackupToComputerPage onNotify={onNotify} />;
  }
  if (section === 'Backup To Drive') {
    return <BackupToDrivePage onNotify={onNotify} />;
  }
  if (section === 'Restore Backup') {
    return <RestoreBackupPage onNotify={onNotify} onOpenSection={onOpenSection} />;
  }
  if (section === 'Users Activity') {
    return <UsersActivityPage onNotify={onNotify} onOpenSection={onOpenSection} />;
  }
  return (
    <SyncSharePage
      onNotify={onNotify}
      onOpenSection={onOpenSection}
      loggedInUser={loggedInUser}
    />
  );
}
