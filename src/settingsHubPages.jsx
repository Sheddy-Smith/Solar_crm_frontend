import { useCallback, useEffect, useState } from 'react';
import {
  Activity, Cloud, Database, Download, HardDrive, Info, LockKeyhole, RefreshCw,
  ShieldCheck, UserPlus, Users, Wrench, X, CheckCircle2, AlertCircle, Clock3,
} from 'lucide-react';
import { authApi, roleApi, settingsApi, userApi } from './api.js';

const CARD = 'rounded-[12px] border border-[#dbe5f2] bg-white shadow-[0_8px_24px_rgba(24,48,87,0.06)]';
const REAUTH_KEY = 'malwa-solar-crm:admin-reauth';
const REAUTH_TTL_MS = 15 * 60 * 1000;
const SECURITY_PREFS_KEY = 'malwa-solar-crm:security-prefs';

export const SETTINGS_PILLARS = [
  {
    id: 'organization',
    label: 'Organization',
    items: [
      { key: 'Company Profile', label: 'Company Profile' },
      { key: 'Business Information', label: 'Business Information' },
      { key: 'Branches', label: 'Branches' },
      { key: 'Financial Year', label: 'Financial Year' },
    ],
  },
  {
    id: 'users-access',
    label: 'Users & Access',
    hubKey: 'Settings Users Access Hub',
    protected: true,
    items: [
      { key: 'Settings Users', label: 'Users' },
      { key: 'Settings Roles & Permissions', label: 'Roles & Permissions' },
      { key: 'Settings User Activity Log', label: 'Activity Log' },
    ],
  },
  {
    id: 'security',
    label: 'Security',
    hubKey: 'Settings Security Hub',
    items: [
      { key: 'Settings Security Hub', label: 'App Security' },
      { key: 'Settings IP Restrictions', label: 'IP Restrictions' },
    ],
  },
  {
    id: 'backup-data',
    label: 'Backup & Data',
    hubKey: 'Settings Backup Hub',
    items: [
      { key: 'Settings Backup Hub', label: 'Backup Dashboard' },
      { key: 'Backup & Restore', label: 'Backup & Restore' },
      { key: 'System Maintenance', label: 'System Maintenance' },
    ],
  },
  {
    id: 'about',
    label: 'About',
    hubKey: 'Settings About',
    items: [{ key: 'Settings About', label: 'About' }],
  },
];

export function isAdminReauthValid() {
  if (typeof window === 'undefined') return false;
  try {
    const raw = sessionStorage.getItem(REAUTH_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < REAUTH_TTL_MS;
  } catch {
    return false;
  }
}

export function markAdminReauth() {
  try {
    sessionStorage.setItem(REAUTH_KEY, String(Date.now()));
  } catch { /* ignore */ }
}

// Obfuscation hash for the client-side PIN lock. Not cryptographic — this is
// a UI convenience lock, not an auth boundary — but it keeps the raw PIN out
// of localStorage. djb2 so it also works on non-HTTPS LAN dev (no SubtleCrypto).
export function hashPin(pin) {
  const input = `malwa-solar-pin:${pin}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

export function readSecurityPrefs() {
  if (typeof window === 'undefined') return { pinHash: '', autoLockMinutes: 5, pinEnabled: false };
  try {
    const parsed = JSON.parse(localStorage.getItem(SECURITY_PREFS_KEY) || '{}');
    return {
      // Migrate any legacy plaintext pin to its hash on read.
      pinHash: parsed.pinHash || (parsed.pin ? hashPin(parsed.pin) : ''),
      autoLockMinutes: parsed.autoLockMinutes ?? 5,
      pinEnabled: Boolean(parsed.pinEnabled),
    };
  } catch {
    return { pinHash: '', autoLockMinutes: 5, pinEnabled: false };
  }
}

export function writeSecurityPrefs(prefs) {
  const { pin: _plainPin, ...rest } = prefs;
  localStorage.setItem(SECURITY_PREFS_KEY, JSON.stringify(rest));
}

function HubStat({ label, value, icon: Icon, tone }) {
  const tones = {
    green: 'bg-[#dcfce7] text-[#16a34a]',
    blue: 'bg-[#dbeafe] text-[#2563eb]',
    purple: 'bg-[#ede9fe] text-[#7c3aed]',
    amber: 'bg-[#ffedd5] text-[#ea580c]',
  };
  return (
    <article className={`${CARD} p-4`}>
      <div className="flex items-center gap-3">
        <span className={`grid size-11 place-items-center rounded-[12px] ${tones[tone]}`}>
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#7a8fa6]">{label}</p>
          <p className="mt-1 text-[22px] font-extrabold text-[#1e3261]">{value}</p>
        </div>
      </div>
    </article>
  );
}

function QuickActionBtn({ label, icon: Icon, tone, onClick }) {
  const tones = {
    green: 'bg-[#0d9f4a] hover:bg-[#078c3e]',
    blue: 'bg-[#2563eb] hover:bg-[#1d4ed8]',
    purple: 'bg-[#7c3aed] hover:bg-[#6d28d9]',
    amber: 'bg-[#ea580c] hover:bg-[#c2410c]',
    slate: 'bg-[#475569] hover:bg-[#334155]',
  };
  return (
    <button type="button" onClick={onClick} className={`inline-flex h-11 items-center gap-2 rounded-[8px] px-4 text-[13px] font-extrabold text-white shadow-md transition ${tones[tone]}`}>
      <Icon className="size-4" />
      {label}
    </button>
  );
}

export function PinLockOverlay() {
  const [locked, setLocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let lastActivity = Date.now();
    const bump = () => { lastActivity = Date.now(); };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((name) => window.addEventListener(name, bump, { passive: true }));
    const timer = setInterval(() => {
      const prefs = readSecurityPrefs();
      if (!prefs.pinEnabled || !prefs.pinHash || !prefs.autoLockMinutes) return;
      if (Date.now() - lastActivity >= prefs.autoLockMinutes * 60 * 1000) {
        setLocked(true);
      }
    }, 10000);
    return () => {
      events.forEach((name) => window.removeEventListener(name, bump));
      clearInterval(timer);
    };
  }, []);

  if (!locked) return null;

  const submit = (e) => {
    e.preventDefault();
    if (hashPin(pinInput) === readSecurityPrefs().pinHash) {
      setLocked(false);
      setPinInput('');
      setError(false);
    } else {
      setError(true);
      setPinInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center bg-[#0f1f3d]/80 p-4 backdrop-blur-[6px]">
      <form onSubmit={submit} className="w-full max-w-sm rounded-[14px] border border-[#dbe5f2] bg-white p-6 text-center shadow-xl">
        <LockKeyhole className="mx-auto size-10 text-[#0d9f4a]" />
        <h2 className="mt-3 font-display text-[18px] font-extrabold text-[#1e3261]">App Locked</h2>
        <p className="mt-1 text-[13px] font-semibold text-[#53647f]">Enter your PIN to continue.</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          maxLength={6}
          className="mt-4 h-12 w-full rounded-[8px] border border-[#d9e2ec] px-3 text-center text-[18px] font-extrabold tracking-[0.4em] text-[#1e3261]"
          value={pinInput}
          onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, '')); setError(false); }}
          placeholder="••••"
        />
        {error ? <p className="mt-2 text-[12px] font-bold text-[#dc2626]">Incorrect PIN — try again.</p> : null}
        <button type="submit" className="mt-4 h-11 w-full rounded-[8px] bg-[#0d9f4a] text-[13px] font-extrabold text-white transition hover:bg-[#078c3e]">Unlock</button>
      </form>
    </div>
  );
}

export function AdminReauthModal({ open, onClose, onVerified, onNotify }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.verifyPassword(password);
      markAdminReauth();
      setPassword('');
      onVerified?.();
      onNotify?.('Access verified', 'success');
    } catch {
      onNotify?.('Incorrect password', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-120 flex items-center justify-center bg-[#0f1f3d]/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-[14px] border border-[#dbe5f2] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#e7eef7] px-5 py-4">
          <h2 className="font-display text-[18px] font-extrabold text-[#1e3261]">Admin Access Verification</h2>
          <button type="button" onClick={onClose} className="text-[#7a8fa6]"><X className="size-5" /></button>
        </div>
        <form onSubmit={submit} className="p-5">
          <div className="rounded-[10px] border border-[#fde68a] bg-[#fffbeb] p-3 text-[13px] font-semibold text-[#92400e]">
            Please re-enter your password to access administrative settings.
          </div>
          <label className="mt-4 block text-[12px] font-bold text-[#53647f]">
            Password
            <input type="password" required className="mt-1.5 h-11 w-full rounded-[8px] border border-[#d9e2ec] px-3 text-[13px]" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" />
          </label>
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-extrabold text-[#53647f]">Cancel</button>
            <button type="submit" disabled={loading} className="h-11 rounded-[8px] bg-[#0d9f4a] px-5 text-[13px] font-extrabold text-white disabled:opacity-60">{loading ? 'Verifying…' : 'Verify'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AdminReauthGate({ children, onNotify, fallback }) {
  const [verified, setVerified] = useState(isAdminReauthValid());
  const [modalOpen, setModalOpen] = useState(!verified);

  // Re-lock when the 15-minute re-auth window expires while the page stays open.
  useEffect(() => {
    if (!verified) return undefined;
    const timer = setInterval(() => {
      if (!isAdminReauthValid()) setVerified(false);
    }, 30000);
    return () => clearInterval(timer);
  }, [verified]);

  if (verified) return children;

  return (
    <>
      {fallback || (
        <section className={`${CARD} flex flex-col items-center gap-4 p-12 text-center`}>
          <ShieldCheck className="size-12 text-[#dc2626]" />
          <h2 className="font-display text-[18px] font-extrabold text-[#1e3261]">Protected Area</h2>
          <p className="max-w-md text-[13px] font-semibold text-[#53647f]">This section requires Super Admin password verification.</p>
          <button type="button" onClick={() => setModalOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-[8px] bg-[#0d9f4a] px-5 text-[13px] font-extrabold text-white">
            <ShieldCheck className="size-4" />
            Verify Password
          </button>
        </section>
      )}
      <AdminReauthModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onVerified={() => { setVerified(true); setModalOpen(false); }}
        onNotify={onNotify}
      />
    </>
  );
}

export function UsersAccessHubPage({ onOpenSection, onNotify }) {
  const [stats, setStats] = useState({ users: 0, active: 0, roles: 0, logs: 0 });

  useEffect(() => {
    Promise.all([
      userApi.list(),
      roleApi.list(),
      settingsApi.activityLogs.list({ page_size: 1 }),
    ]).then(([usersRes, rolesRes, logsRes]) => {
      const users = Array.isArray(usersRes) ? usersRes : usersRes?.results ?? [];
      const roles = Array.isArray(rolesRes) ? rolesRes : rolesRes?.results ?? [];
      const logs = Array.isArray(logsRes) ? logsRes : logsRes?.results ?? [];
      setStats({
        users: usersRes?.count ?? users.length,
        active: users.filter((u) => u.is_active).length,
        roles: rolesRes?.count ?? roles.length,
        logs: logsRes?.count ?? logs.length,
      });
    }).catch(() => {});
  }, []);

  const openProtected = (key) => {
    if (!isAdminReauthValid()) {
      onNotify('Password verification required', 'error');
      return;
    }
    onOpenSection(key);
  };

  return (
    <AdminReauthGate onNotify={onNotify}>
      <div className="space-y-4">
        <article className="rounded-[14px] border border-[#fbcfe8] bg-linear-to-r from-[#fdf2f8] to-[#fff1f2] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-display text-[20px] font-extrabold text-[#1e3261]">
                <ShieldCheck className="size-6 text-[#dc2626]" />
                Super Admin Powers
              </h2>
              <p className="mt-1 text-[13px] font-semibold text-[#53647f]">Manage users, roles, permissions and audit trail.</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#dcfce7] px-3 py-1.5 text-[12px] font-extrabold text-[#16a34a]">
              <CheckCircle2 className="size-4" />
              Full Access Active
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <QuickActionBtn label="Add User" icon={UserPlus} tone="green" onClick={() => openProtected('Settings Users')} />
            <QuickActionBtn label="Manage Users" icon={Users} tone="blue" onClick={() => openProtected('Settings Users')} />
            <QuickActionBtn label="Manage Permissions" icon={ShieldCheck} tone="purple" onClick={() => openProtected('Settings Roles & Permissions')} />
            <QuickActionBtn label="Cache Manager" icon={Wrench} tone="amber" onClick={() => onOpenSection('System Maintenance')} />
            <QuickActionBtn label="Audit Logs" icon={Activity} tone="slate" onClick={() => openProtected('Settings User Activity Log')} />
          </div>
        </article>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <HubStat label="Total Users" value={String(stats.users)} icon={Users} tone="blue" />
          <HubStat label="Active Users" value={String(stats.active)} icon={CheckCircle2} tone="green" />
          <HubStat label="Roles" value={String(stats.roles)} icon={ShieldCheck} tone="purple" />
          <HubStat label="Audit Events" value={String(stats.logs)} icon={Activity} tone="amber" />
        </section>
      </div>
    </AdminReauthGate>
  );
}

export function SecurityHubPage({ onOpenSection, onNotify }) {
  const [prefs, setPrefs] = useState(readSecurityPrefs);
  const [pinInput, setPinInput] = useState('');
  const lockOptions = [5, 15, 30, 60, 0];

  const savePrefs = (next) => {
    setPrefs(next);
    writeSecurityPrefs(next);
    onNotify?.('Security preferences saved', 'success');
  };

  return (
    <div className="space-y-4">
      <article className={`${CARD} bg-linear-to-r from-[#eff6ff] to-[#f5f3ff] p-5`}>
        <h2 className="flex items-center gap-2 font-display text-[18px] font-extrabold text-[#1e3261]">
          <ShieldCheck className="size-5 text-[#2563eb]" />
          Security Settings
        </h2>
        <p className="mt-1 text-[13px] font-semibold text-[#53647f]">Protect your application with PIN lock and auto-lock.</p>
      </article>

      <article className={`${CARD} p-5`}>
        <h3 className="text-[15px] font-extrabold text-[#1e3261]">App PIN Lock (4–6 digits)</h3>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-[12px] font-bold text-[#53647f]">
            PIN
            <input type="password" maxLength={6} className="mt-1.5 h-11 w-full rounded-[8px] border border-[#d9e2ec] px-3" value={pinInput} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))} placeholder="Enter 4-6 digit PIN" />
          </label>
          <button type="button" onClick={() => {
            if (pinInput.length < 4) { onNotify('PIN must be 4-6 digits', 'error'); return; }
            savePrefs({ ...prefs, pinHash: hashPin(pinInput), pinEnabled: true });
            setPinInput('');
          }} className="h-11 rounded-[8px] bg-[#0d9f4a] px-5 text-[13px] font-extrabold text-white">Enable PIN</button>
        </div>
        {prefs.pinEnabled ? (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="flex items-center gap-2 text-[12px] font-bold text-[#16a34a]"><CheckCircle2 className="size-4" /> PIN lock enabled</p>
            <button type="button" onClick={() => savePrefs({ ...prefs, pinHash: '', pinEnabled: false })} className="text-[12px] font-extrabold text-[#dc2626] hover:underline">Disable PIN</button>
          </div>
        ) : null}
      </article>

      <article className={`${CARD} p-5`}>
        <h3 className="flex items-center gap-2 text-[15px] font-extrabold text-[#1e3261]"><Clock3 className="size-4" /> Auto-lock After Inactivity</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {lockOptions.map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => savePrefs({ ...prefs, autoLockMinutes: mins })}
              className={`rounded-[8px] px-4 py-2 text-[13px] font-extrabold ${prefs.autoLockMinutes === mins ? 'bg-[#2563eb] text-white' : 'border border-[#d9e2ec] bg-white text-[#30466d]'}`}
            >
              {mins === 0 ? 'Never' : `${mins} min`}
            </button>
          ))}
        </div>
      </article>

      <article className={`${CARD} p-5`}>
        <button type="button" onClick={() => onOpenSection('Settings IP Restrictions')} className="inline-flex h-11 items-center gap-2 rounded-[8px] border border-[#d9e2ec] bg-white px-4 text-[13px] font-extrabold text-[#1e3261]">
          <LockKeyhole className="size-4 text-[#2563eb]" />
          Manage IP Restrictions
        </button>
      </article>
    </div>
  );
}

export function BackupDataHubPage({ onOpenSection, onNotify, BackupContent }) {
  const [backups, setBackups] = useState([]);
  const [running, setRunning] = useState(false);
  const [config, setConfig] = useState({ syncFrequency: 'Daily', backupLocation: 'Server', liveSync: true });

  const reload = useCallback(() => {
    settingsApi.backups.list().then((res) => {
      setBackups(Array.isArray(res) ? res : res?.results ?? []);
    }).catch(() => {});
    settingsApi.category('backup').get().then((data) => {
      if (data) setConfig((c) => ({ ...c, ...data }));
    }).catch(() => {});
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const runBackup = async () => {
    setRunning(true);
    try {
      await settingsApi.backups.create('Full');
      onNotify('Backup completed', 'success');
      reload();
    } catch {
      onNotify('Backup failed', 'error');
    } finally {
      setRunning(false);
    }
  };

  const saveConfig = async () => {
    try {
      await settingsApi.category('backup').update(config);
      onNotify('Backup settings saved', 'success');
    } catch {
      onNotify('Could not save backup settings', 'error');
    }
  };

  const last = backups[0];
  const storagePct = Math.min(100, Math.max(10, backups.length * 12));

  return (
    <div className="space-y-4">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HubStat label="Last Backup" value={last ? 'Recent' : 'Never'} icon={Cloud} tone="green" />
        <HubStat label="Restore Points" value={String(backups.length)} icon={Database} tone="blue" />
        <HubStat label="Cloud Status" value={config.liveSync ? 'Active' : 'Paused'} icon={RefreshCw} tone="purple" />
        <HubStat label="Storage Used" value={`${storagePct}%`} icon={HardDrive} tone="amber" />
      </section>

      <article className={`${CARD} p-5`}>
        <h3 className="text-[15px] font-extrabold text-[#1e3261]">Backup Configuration</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="text-[12px] font-bold text-[#53647f]">Sync Frequency
            <select className="mt-1.5 h-11 w-full rounded-[8px] border border-[#d9e2ec] px-3" value={config.syncFrequency} onChange={(e) => setConfig((c) => ({ ...c, syncFrequency: e.target.value }))}>
              {['Hourly', 'Daily', 'Weekly', 'Manual'].map((o) => <option key={o}>{o}</option>)}
            </select>
          </label>
          <label className="text-[12px] font-bold text-[#53647f]">Backup Location
            <select className="mt-1.5 h-11 w-full rounded-[8px] border border-[#d9e2ec] px-3" value={config.backupLocation} onChange={(e) => setConfig((c) => ({ ...c, backupLocation: e.target.value }))}>
              {['Server', 'Offsite Cloud'].map((o) => <option key={o}>{o}</option>)}
            </select>
          </label>
          <label className="flex items-end gap-2 text-[12px] font-bold text-[#53647f]">
            <input type="checkbox" checked={Boolean(config.liveSync)} onChange={(e) => setConfig((c) => ({ ...c, liveSync: e.target.checked }))} className="size-4 accent-[#0d9f4a]" />
            Live Sync Active
          </label>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e7eef7]">
          <div className="h-full rounded-full bg-[#0d9f4a]" style={{ width: `${storagePct}%` }} />
        </div>
        {storagePct < 15 ? (
          <p className="mt-2 flex items-center gap-2 text-[12px] font-bold text-[#ea580c]"><AlertCircle className="size-4" /> Storage below recommended threshold</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <QuickActionBtn label={running ? 'Running…' : 'Run Backup'} icon={Download} tone="green" onClick={runBackup} />
          <QuickActionBtn label="Restore Last" icon={RefreshCw} tone="blue" onClick={() => onNotify('Restore requires admin confirmation — open Backup & Restore', 'error')} />
          <QuickActionBtn label="Save Config" icon={Cloud} tone="purple" onClick={saveConfig} />
          <QuickActionBtn label="Full Backup Page" icon={Database} tone="slate" onClick={() => onOpenSection('Backup & Restore')} />
        </div>
      </article>

      {BackupContent ? <BackupContent onOpenSection={onOpenSection} onNotify={onNotify} compact /> : null}
    </div>
  );
}

export function AboutSettingsPage() {
  const version = '1.0.0';
  const dbVersion = 'v14';
  return (
    <div className="space-y-4">
      <article className={`${CARD} p-6 text-center`}>
        <Info className="mx-auto size-10 text-[#0d9f4a]" />
        <h2 className="mt-3 font-display text-[22px] font-extrabold text-[#1e3261]">Malwa Solar CRM</h2>
        <p className="mt-2 text-[13px] font-semibold text-[#53647f]">Solar installation, sales, O&M and operations platform.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[10px] border border-[#e7eef7] p-3"><p className="text-[11px] font-bold text-[#7a8fa6]">App Version</p><p className="mt-1 font-extrabold text-[#1e3261]">{version}</p></div>
          <div className="rounded-[10px] border border-[#e7eef7] p-3"><p className="text-[11px] font-bold text-[#7a8fa6]">Database</p><p className="mt-1 font-extrabold text-[#1e3261]">{dbVersion}</p></div>
          <div className="rounded-[10px] border border-[#e7eef7] p-3"><p className="text-[11px] font-bold text-[#7a8fa6]">Environment</p><p className="mt-1 font-extrabold text-[#1e3261]">Production</p></div>
        </div>
        <p className="mt-6 text-[12px] text-[#9aa8bc]">© 2024 Malwa Solar CRM. Made for a sustainable future.</p>
      </article>
    </div>
  );
}

export function SettingsArchitectureTabs({ activePillarId, onSelectPillar }) {
  return (
    <section className={`${CARD} p-2`}>
      <div className="flex flex-wrap gap-2">
        {SETTINGS_PILLARS.map((pillar) => {
          const active = activePillarId === pillar.id;
          return (
            <button
              key={pillar.id}
              type="button"
              onClick={() => onSelectPillar(pillar.id)}
              className={`rounded-[8px] px-4 py-2.5 text-[13px] font-extrabold transition ${active ? 'bg-[#0d9f4a] text-white shadow-md' : 'border border-[#d9e2ec] bg-white text-[#30466d] hover:bg-[#f8fbff]'}`}
            >
              {pillar.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onSelectPillar('advanced')}
          className={`rounded-[8px] px-4 py-2.5 text-[13px] font-extrabold transition ${activePillarId === 'advanced' ? 'bg-[#0d9f4a] text-white' : 'border border-[#d9e2ec] bg-white text-[#30466d]'}`}
        >
          Advanced
        </button>
      </div>
    </section>
  );
}

export function mapUiPermissionsToApi(permissionRows) {
  const fieldMap = { View: 'can_view', Add: 'can_add', Edit: 'can_edit', Delete: 'can_delete', Export: 'can_export' };
  return permissionRows.map((row) => {
    const entry = { module: row.module };
    Object.entries(fieldMap).forEach(([uiKey, apiKey]) => {
      entry[apiKey] = row.permissions[uiKey] === true || row.permissions[uiKey] === 'partial';
    });
    entry.full_access = Object.keys(fieldMap).every((k) => row.permissions[k] === true);
    return entry;
  });
}
