import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  Headset,
  Home,
  KeyRound,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  MonitorSmartphone,
  Moon,
  Pencil,
  Phone,
  PhoneCall,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  StickyNote,
  Sun,
  Trash2,
  Trophy,
  UserRound,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { cx } from './lib/utils.js';
import { authApi, leadApi, followUpApi } from './api.js';

export const TELE_ROLE_NAME = 'Tele Sales Executive';

// ─── Shared bits ──────────────────────────────────────────────────────────────

function TeleBrandMark() {
  return (
    <div className="grid size-[46px] shrink-0 place-items-center">
      <svg viewBox="0 0 44 44" className="size-9" aria-hidden="true">
        <circle cx="16" cy="15" r="8.5" fill="#ffc928" />
        <path
          d="M8.5 24.5c6.7 0 11.5 3.7 12.8 10.1-6.3 1.6-10.6 1.1-13.4-1.3-2.1-1.8-3.1-4.7-3.1-8.8h3.7z"
          fill="#16c957"
        />
        <path d="M31.8 16.8c-2.6 10.1-8.9 16.9-18.6 20.4 2.8-8.7 9-15.5 18.6-20.4z" fill="#0eb84d" />
        <path d="M11.5 11.2l-3-4.4M20.6 8.1V3.6M29.4 11.1l2.8-4.2M6.8 18.6l-4.6-1" stroke="#ffc928" strokeLinecap="round" strokeWidth="2.4" />
      </svg>
    </div>
  );
}

// Tele portal shows a single 5-value lead status (New/Hot/Cool/Won/Lost).
// Hot/Cool live on Lead.category in the CRM data model; the rest on Lead.status.
export const TELE_LEAD_STATUSES = ['New', 'Hot', 'Cool', 'Won', 'Lost'];

function teleDisplayStatus(lead) {
  if (lead?.category === 'Hot') return 'Hot';
  if (lead?.category === 'Cool') return 'Cool';
  return lead?.status || 'New';
}

function mapTeleStatusToApi(value) {
  if (value === 'Hot') return { status: 'Follow-up', category: 'Hot' };
  if (value === 'Cool') return { status: 'Follow-up', category: 'Cool' };
  return { status: value, category: '' };
}

const TELE_STATUS_TONES = {
  New: 'bg-[#e7efff] text-[#1d4ed8]',
  Hot: 'bg-[#fff1e0] text-[#ea7c1c]',
  Cool: 'bg-[#f0e9ff] text-[#7c3aed]',
  'Follow-up': 'bg-[#fff4e0] text-[#c07a06]',
  Quotation: 'bg-[#e0f5f7] text-[#0e7490]',
  Won: 'bg-[#e8f8eb] text-[#0d9f4a]',
  Lost: 'bg-[#feecec] text-[#dc2626]',
};

const FOLLOW_UP_TYPES = ['Call', 'WhatsApp', 'Site Visit', 'Email', 'Note'];

const FOLLOW_UP_TYPE_ICONS = {
  Call: PhoneCall,
  WhatsApp: MessageCircle,
  'Site Visit': MapPin,
  Email: Mail,
  Note: StickyNote,
};

const REMINDER_OPTIONS = [
  'No reminder', '15 minutes before', '30 minutes before', '1 hour before',
  '2 hours before', '1 day before', '2 days before',
];

const LEAD_SOURCES = ['Website', 'Referral', 'Facebook', 'Google Ads', 'Just Dial', 'IndiaMART', 'Walk-in', 'Exhibition', 'Other'];

function StatusPill({ value }) {
  return (
    <span className={cx('inline-flex whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-extrabold', TELE_STATUS_TONES[value] || 'bg-[#eef2f8] text-[#53647f]')}>
      {value}
    </span>
  );
}

function formatDate(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(value) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(value) {
  const dateLabel = formatDate(value);
  const timeLabel = formatTime(value);
  return dateLabel === '—' ? '—' : `${dateLabel}, ${timeLabel}`;
}

function TeleModal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const handleKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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

function TeleField({ label, children }) {
  return (
    <label className="block">
      <span className="text-[13px] font-bold text-[#33456b]">{label}</span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

const teleInputClass = 'h-11 w-full rounded-[9px] border border-[#dbe4f0] bg-white px-3 text-[14px] font-semibold text-[#1f2d44] outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100';

// ─── Entry screen: portal chooser ─────────────────────────────────────────────

export function PortalSelectPage({ onSelectCrm, onSelectTele }) {
  const portals = [
    {
      key: 'crm',
      title: 'CRM Operations',
      description: 'Manage leads, projects, installations, O&M, AMC, inventory, accounts and more.',
      icon: MonitorSmartphone,
      iconWrap: 'bg-[#e8f8eb] text-[#0d9f4a]',
      button: 'bg-[#0d9f4a] hover:bg-[#078c3e]',
      buttonLabel: 'Open CRM Operations',
      onClick: onSelectCrm,
    },
    {
      key: 'tele',
      title: 'Tele Executive',
      description: 'Handle calls, follow-ups, lead updates and customer communication.',
      icon: Headset,
      iconWrap: 'bg-[#e7efff] text-[#1d4ed8]',
      button: 'bg-[#1d4ed8] hover:bg-[#1a3fb0]',
      buttonLabel: 'Open Tele Executive',
      onClick: onSelectTele,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#eef3f7] px-3 py-4 text-[#172648] sm:px-6 sm:py-6">
      <main className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col overflow-hidden rounded-[20px] border border-[#dfe7f2] bg-white shadow-[0_24px_60px_rgba(23,43,77,0.14)]">
        <div className="flex items-center gap-3 px-5 pt-6 sm:px-9 sm:pt-8">
          <TeleBrandMark />
          <div>
            <p className="font-display text-[18px] font-extrabold leading-tight text-[#087532] sm:text-[22px]">Malwa Solar Energy</p>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#252b35] sm:text-[13px]">CRM System</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-5 py-12 sm:px-10 sm:py-16">
          <h1 className="text-center font-display text-[32px] font-extrabold leading-tight text-[#102446] sm:text-[44px]">
            Welcome to <span className="text-[#0d9f4a]">Solar CRM</span>
          </h1>
          <p className="mt-4 text-center text-[15px] font-semibold text-[#5c6676] sm:text-[18px]">
            Choose your portal to continue
          </p>

          <div className="mt-10 grid w-full max-w-[760px] gap-6 sm:mt-12 sm:grid-cols-2">
            {portals.map((portal) => {
              const Icon = portal.icon;
              return (
                <article
                  key={portal.key}
                  className="flex flex-col items-center rounded-[18px] border border-[#e2e9f3] bg-white p-7 text-center shadow-[0_14px_34px_rgba(23,43,77,0.08)] transition hover:-translate-y-1 hover:shadow-[0_20px_44px_rgba(23,43,77,0.14)] sm:p-8"
                >
                  <span className={cx('grid size-24 place-items-center rounded-full sm:size-28', portal.iconWrap)}>
                    <Icon className="size-11 sm:size-12" />
                  </span>
                  <h2 className="mt-6 font-display text-[20px] font-extrabold text-[#102446] sm:text-[22px]">{portal.title}</h2>
                  <p className="mt-3 text-[13px] font-semibold leading-6 text-[#5c6676] sm:text-[14px]">{portal.description}</p>
                  <button
                    type="button"
                    onClick={portal.onClick}
                    className={cx('mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[10px] text-[14px] font-extrabold text-white shadow-[0_12px_24px_rgba(23,43,77,0.16)] transition sm:text-[15px]', portal.button)}
                  >
                    {portal.buttonLabel}
                    <ArrowRight className="size-4" />
                  </button>
                </article>
              );
            })}
          </div>
        </div>

        <footer className="border-t border-[#edf2f8] px-5 py-4 text-center text-[13px] font-semibold text-[#8a98af]">
          © {new Date().getFullYear()} Malwa Solar Energy CRM. All rights reserved.
        </footer>
      </main>
    </div>
  );
}

// ─── Tele Executive login ─────────────────────────────────────────────────────

export function TeleSignInPage({ onLogin, onBack, onNotify }) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleLogin = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setLoginError('Please enter both email and password.');
      return;
    }
    setLoading(true);
    setLoginError('');
    try {
      const data = await authApi.login(email.trim(), password);
      if (!data?.access) {
        setLoginError('Login failed. Please try again.');
        return;
      }
      const roleName = data?.user?.role_name || '';
      const isSuperAdmin = Boolean(data?.user?.is_super_admin);
      // Only Tele Sales Executives (plus Super Admin for administration)
      // may enter the Tele Executive portal.
      if (roleName !== TELE_ROLE_NAME && !isSuperAdmin) {
        authApi.logout();
        setLoginError('This portal is only for Tele Sales Executives. Please use the CRM Operations portal.');
        return;
      }
      onLogin(data.user);
    } catch (err) {
      setLoginError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const highlights = ['Lead Calling', 'Follow-ups', 'Lead Updates', 'Call History', 'Task Management', 'Reports'];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#eef3f7] px-3 py-6 text-[#172648] sm:px-6">
      <main className="grid w-full max-w-[1020px] overflow-hidden rounded-[20px] border border-[#dfe7f2] bg-white shadow-[0_24px_60px_rgba(23,43,77,0.16)] lg:grid-cols-[46fr_54fr]">
        <section className="relative flex flex-col bg-[linear-gradient(160deg,#123c8f_0%,#1d4ed8_58%,#2563eb_100%)] px-7 py-8 text-white sm:px-9 sm:py-10">
          <div className="absolute -right-10 top-10 size-40 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
          <div className="absolute bottom-8 left-4 size-36 rounded-full bg-[#60a5fa]/25 blur-3xl" aria-hidden="true" />
          <div className="relative z-10 flex items-center gap-3">
            <TeleBrandMark />
            <div>
              <p className="font-display text-[18px] font-extrabold leading-tight text-white">Malwa Solar Energy</p>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-white/75">CRM System</p>
            </div>
          </div>
          <div className="relative z-10 mt-10 sm:mt-14">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white">
              <Headset className="size-4" />
              Tele Executive Portal
            </span>
            <h1 className="mt-5 font-display text-[28px] font-extrabold leading-[1.2] sm:text-[34px]">
              Manage calls, follow-ups and customer communication.
            </h1>
            <ul className="mt-8 space-y-3.5">
              {highlights.map((item) => (
                <li key={item} className="flex items-center gap-3 text-[14px] font-bold text-white/95 sm:text-[15px]">
                  <CheckCircle2 className="size-5 shrink-0 text-[#7dd3fc]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <p className="relative z-10 mt-auto pt-10 text-[12px] font-semibold text-white/70">
            Access limited to your own assigned leads and follow-ups.
          </p>
        </section>

        <section className="flex items-center justify-center px-5 py-9 sm:px-10 sm:py-12">
          <div className="w-full max-w-[460px]">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-[#5c6676] transition hover:text-[#1d4ed8]"
            >
              <ChevronLeft className="size-4" />
              Choose different portal
            </button>
            <h2 className="mt-5 font-display text-[26px] font-extrabold text-[#102446] sm:text-[30px]">Login to your account</h2>
            <p className="mt-3 text-[14px] font-semibold text-[#5c6676] sm:text-[15px]">
              Enter your credentials to access Tele Executive Portal
            </p>

            <form className="mt-8 space-y-5" onSubmit={handleLogin}>
              <label className="block">
                <span className="text-[14px] font-bold text-[#111827]">Email / Username</span>
                <span className="mt-2.5 flex h-[52px] items-center gap-3 rounded-[9px] border border-black/20 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                  <UserRound className="size-5 text-[#7a8494]" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email or username"
                    autoComplete="username"
                    spellCheck={false}
                    className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[#1f2d44] outline-none placeholder:text-[#7d8796]"
                  />
                </span>
              </label>

              <label className="block">
                <span className="text-[14px] font-bold text-[#111827]">Password</span>
                <span className="mt-2.5 flex h-[52px] items-center gap-3 rounded-[9px] border border-black/20 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                  <LockKeyhole className="size-5 text-[#7a8494]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[#1f2d44] outline-none placeholder:text-[#7d8796]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="text-[#7a8494] transition hover:text-[#1d4ed8]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </span>
              </label>

              {loginError && (
                <p className="rounded-[8px] bg-red-50 px-4 py-3 text-[13px] font-bold text-red-600">{loginError}</p>
              )}

              <div className="flex items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2.5 text-[13px] font-bold text-[#5a6574]">
                  <input type="checkbox" defaultChecked className="size-4 rounded accent-[#1d4ed8]" />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => onNotify('Forgot password selected')}
                  className="text-[13px] font-bold text-[#1d4ed8] transition hover:text-[#1a3fb0]"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[9px] bg-[#1d4ed8] text-[16px] font-extrabold text-white shadow-[0_14px_28px_rgba(29,78,216,0.28)] transition hover:-translate-y-0.5 hover:bg-[#1a3fb0] disabled:opacity-60"
              >
                <LogIn className="size-5" />
                {loading ? 'Logging in...' : 'Login'}
              </button>

              <p className="text-center text-[13px] font-semibold text-[#8a98af]">
                Don't have an account? <span className="font-extrabold text-[#1d4ed8]">Contact Administrator</span>
              </p>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}

// ─── Tele Executive portal ────────────────────────────────────────────────────

const TELE_NAV_ITEMS = [
  { label: 'Dashboard', icon: Home },
  { label: 'My Leads', icon: Users },
  { label: 'Follow-ups', icon: Phone },
  { label: 'Reminders', icon: Bell },
  { label: 'Reports', icon: BarChart3 },
  { label: 'Settings', icon: Settings },
];

const TELE_PAGE_SIZE = 10;

export function TeleExecutivePortal({ onLogout, onNotify, isDark, onToggleTheme }) {
  const [activeNav, setActiveNav] = useState('Dashboard');
  const [me, setMe] = useState(null);
  const [leads, setLeads] = useState(null);
  const [followUps, setFollowUps] = useState(null);

  // Modals
  const [historyLead, setHistoryLead] = useState(null);
  const [editLead, setEditLead] = useState(null);
  const [deleteLead, setDeleteLead] = useState(null);
  const [followUpModal, setFollowUpModal] = useState(null); // { lead: <lead or null> }
  const [addLeadOpen, setAddLeadOpen] = useState(false);

  const loadLeads = () => {
    leadApi.list({ page_size: 500, ordering: '-created_at' }).then((data) => {
      setLeads(Array.isArray(data) ? data : (data?.results ?? []));
    }).catch(() => { setLeads([]); onNotify('Leads could not be loaded.', 'error'); });
  };

  const loadFollowUps = () => {
    followUpApi.listAll({ page_size: 500 }).then((data) => {
      setFollowUps(Array.isArray(data) ? data : (data?.results ?? []));
    }).catch(() => { setFollowUps([]); onNotify('Follow-ups could not be loaded.', 'error'); });
  };

  useEffect(() => {
    authApi.me().then((data) => { if (data) setMe(data); }).catch(() => onNotify('Could not load profile.', 'error'));
    loadLeads();
    loadFollowUps();
  }, []);

  const refreshData = () => { loadLeads(); loadFollowUps(); };

  const scheduledFollowUps = useMemo(
    () => (followUps ?? []).filter((item) => item.status === 'Scheduled').sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)),
    [followUps],
  );

  const todayKey = new Date().toDateString();
  const todayFollowUps = scheduledFollowUps.filter((item) => new Date(item.scheduled_at).toDateString() === todayKey);
  const overdueFollowUps = scheduledFollowUps.filter((item) => new Date(item.scheduled_at) < new Date() && new Date(item.scheduled_at).toDateString() !== todayKey);

  const leadRows = leads ?? [];
  const wonCount = leadRows.filter((lead) => lead.status === 'Won').length;
  const lostCount = leadRows.filter((lead) => lead.status === 'Lost').length;

  const openFollowUpForm = (lead = null) => setFollowUpModal({ lead });

  const handleDeleteLead = async () => {
    if (!deleteLead) return;
    try {
      await leadApi.delete(deleteLead.id);
      onNotify(`${deleteLead.customer_name} deleted`, 'success');
      setDeleteLead(null);
      refreshData();
    } catch (err) {
      onNotify(err.message || 'Could not delete lead.', 'error');
    }
  };

  const pageContent = () => {
    switch (activeNav) {
      case 'Dashboard':
        return (
          <TeleDashboard
            leads={leadRows}
            leadsLoaded={leads !== null}
            todayFollowUps={todayFollowUps}
            scheduledFollowUps={scheduledFollowUps}
            overdueCount={overdueFollowUps.length}
            wonCount={wonCount}
            lostCount={lostCount}
            onView={setHistoryLead}
            onEdit={setEditLead}
            onDelete={setDeleteLead}
            onAddFollowUp={openFollowUpForm}
            onAddLead={() => setAddLeadOpen(true)}
          />
        );
      case 'My Leads':
        return (
          <TeleLeadsPage
            leads={leadRows}
            leadsLoaded={leads !== null}
            onView={setHistoryLead}
            onEdit={setEditLead}
            onDelete={setDeleteLead}
            onAddFollowUp={openFollowUpForm}
            onAddLead={() => setAddLeadOpen(true)}
          />
        );
      case 'Follow-ups':
        return (
          <TeleFollowUpsPage
            followUps={followUps ?? []}
            loaded={followUps !== null}
            leads={leadRows}
            onAddFollowUp={openFollowUpForm}
            onViewLead={(leadId) => {
              const lead = leadRows.find((row) => row.id === leadId);
              if (lead) setHistoryLead(lead);
            }}
          />
        );
      case 'Reminders':
        return <TeleRemindersPage scheduledFollowUps={scheduledFollowUps} loaded={followUps !== null} />;
      case 'Reports':
        return <TeleReportsPage leads={leadRows} followUps={followUps ?? []} />;
      case 'Settings':
        return <TeleSettingsPage me={me} />;
      default:
        return null;
    }
  };

  return (
    <div className="tele-portal flex h-dvh overflow-hidden bg-[#eef3f7] text-[#172648]">
      {/* Same floating-card sidebar treatment as the CRM shell: white brand
          header on top, gradient menu area with the moving shine below —
          tele portal carries it in blue/white instead of green/blue. */}
      <aside className="tele-sidebar-root my-2 ml-2 hidden w-[232px] shrink-0 flex-col overflow-hidden rounded-[20px] border border-[#dfe7f2] bg-white shadow-[0_18px_40px_rgba(15,39,92,0.12)] lg:flex">
        <div className="tele-sidebar-brand flex shrink-0 items-center gap-2.5 border-b border-[#e8eef6] bg-white px-4 py-4">
          <TeleBrandMark />
          <div>
            <p className="font-display text-[15px] font-extrabold leading-tight text-[#087532]">Malwa Solar</p>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#1d4ed8]">Tele Executive</p>
          </div>
        </div>
        <div className="tele-sidebar-grad relative min-h-0 flex-1 overflow-hidden rounded-t-[14px] bg-[linear-gradient(180deg,#123c8f_0%,#1d4ed8_52%,#3b82f6_100%)]">
          <div className="sidebar-shine tele-sidebar-shine" aria-hidden="true" />
          <div className="scroll-soft sidebar-menu-scroll relative flex h-full flex-col overflow-y-auto px-3.5 py-4">
            <nav className="space-y-1.5">
              {TELE_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeNav === item.label;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setActiveNav(item.label)}
                    aria-current={active ? 'page' : undefined}
                    className={cx(
                      'flex h-11 w-full items-center gap-3 rounded-[10px] px-3.5 text-[13.5px] font-extrabold transition',
                      active ? 'bg-white text-[#1d4ed8] shadow-[0_10px_22px_rgba(9,28,66,0.30)]' : 'text-white/85 hover:bg-white/15',
                    )}
                  >
                    <Icon className="size-[18px]" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
            <div className="mt-auto shrink-0 pt-4">
              <button
                type="button"
                onClick={onLogout}
                className="tele-logout flex h-11 w-full items-center gap-3 rounded-[10px] border border-white/25 bg-white/10 px-3.5 text-[13.5px] font-extrabold text-white transition hover:bg-white/20"
              >
                <LogOut className="size-[18px]" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#e2e9f3] bg-white px-4 py-3.5 sm:px-6">
          <div className="min-w-0">
            <h1 className="truncate font-display text-[18px] font-extrabold text-[#102446] sm:text-[22px]">
              {activeNav === 'Dashboard' ? 'Tele Executive Dashboard' : activeNav}
            </h1>
            <p className="hidden text-[12px] font-semibold text-[#7585a2] sm:block">Manage your leads, follow-ups and reminders.</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden items-center gap-2 rounded-[9px] border border-[#dbe4f0] bg-white px-3 py-2 text-[12px] font-extrabold text-[#53647f] md:inline-flex">
              <CalendarDays className="size-4 text-[#1d4ed8]" />
              {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'long' })}
            </span>
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className="grid size-10 place-items-center rounded-[10px] border border-[#dbe4f0] bg-white text-[#53647f] transition hover:bg-[#f3f7fd]"
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
            )}
            <div className="flex items-center gap-2.5">
              <span className="grid size-10 place-items-center rounded-full bg-[#e7efff] text-[13px] font-extrabold text-[#1d4ed8]">
                {(me?.initials || me?.name?.slice(0, 2) || 'TE').toUpperCase()}
              </span>
              <div className="hidden sm:block">
                <p className="text-[13px] font-extrabold leading-tight text-[#1e3261]">{me?.name || 'Tele Executive'}</p>
                <p className="text-[11px] font-semibold text-[#7585a2]">{me?.role_name || TELE_ROLE_NAME}</p>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="grid size-10 place-items-center rounded-[10px] border border-[#f3d2d2] bg-white text-[#dc2626] transition hover:bg-[#feecec] lg:hidden"
                aria-label="Logout"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </header>

        <nav className="flex shrink-0 gap-2 overflow-x-auto border-b border-[#e2e9f3] bg-white px-4 py-2.5 lg:hidden">
          {TELE_NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setActiveNav(item.label)}
              className={cx(
                'shrink-0 rounded-full px-4 py-2 text-[12px] font-extrabold transition',
                activeNav === item.label ? 'bg-[#1d4ed8] text-white' : 'bg-[#f3f7fd] text-[#53647f]',
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <main className="scroll-soft flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">{pageContent()}</main>
      </div>

      {historyLead && (
        <TeleFollowUpHistoryModal lead={historyLead} onClose={() => setHistoryLead(null)} onNotify={onNotify} />
      )}
      {editLead && (
        <TeleLeadEditModal
          lead={editLead}
          onClose={() => setEditLead(null)}
          onSaved={() => { setEditLead(null); refreshData(); }}
          onNotify={onNotify}
        />
      )}
      {deleteLead && (
        <TeleModal title="Delete Lead" onClose={() => setDeleteLead(null)}>
          <p className="text-[14px] font-semibold leading-6 text-[#33456b]">
            Are you sure you want to delete <span className="font-extrabold text-[#102446]">{deleteLead.customer_name}</span>?
            This will also remove its follow-up history. This action cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2.5">
            <button type="button" onClick={() => setDeleteLead(null)} className="h-10 rounded-[9px] border border-[#dbe4f0] px-4 text-[13px] font-extrabold text-[#53647f] transition hover:bg-[#f8fbff]">
              Cancel
            </button>
            <button type="button" onClick={handleDeleteLead} className="h-10 rounded-[9px] bg-[#dc2626] px-4 text-[13px] font-extrabold text-white transition hover:bg-[#b91c1c]">
              Delete Lead
            </button>
          </div>
        </TeleModal>
      )}
      {followUpModal && (
        <TeleFollowUpCreateModal
          leads={leadRows}
          initialLead={followUpModal.lead}
          onClose={() => setFollowUpModal(null)}
          onSaved={() => { setFollowUpModal(null); refreshData(); }}
          onNotify={onNotify}
        />
      )}
      {addLeadOpen && (
        <TeleLeadCreateModal
          onClose={() => setAddLeadOpen(false)}
          onSaved={() => { setAddLeadOpen(false); refreshData(); }}
          onNotify={onNotify}
        />
      )}
    </div>
  );
}

// ─── Stat cards ───────────────────────────────────────────────────────────────

function TeleStatCards({ cards }) {
  return (
    <section className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article key={card.title} className="rounded-[14px] border border-[#e2e9f3] bg-white p-4 shadow-[0_10px_26px_rgba(23,43,77,0.05)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-extrabold text-[#7585a2]">{card.title}</p>
                <p className="mt-2 font-display text-[26px] font-extrabold text-[#102446]">{card.value ?? '—'}</p>
                <p className="mt-1 text-[11px] font-semibold text-[#8a98af]">{card.note}</p>
              </div>
              <span className={cx('grid size-11 shrink-0 place-items-center rounded-full', card.tone)}>
                <Icon className="size-5" />
              </span>
            </div>
          </article>
        );
      })}
    </section>
  );
}

// ─── Leads table (shared: Dashboard + My Leads) ───────────────────────────────

function TeleLeadsTable({ leads, leadsLoaded, onView, onEdit, onDelete, onAddFollowUp, onAddLead, title = 'My Leads' }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);

  const filteredLeads = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return leads.filter((lead) => {
      if (statusFilter !== 'All' && teleDisplayStatus(lead) !== statusFilter) return false;
      if (!query) return true;
      return [lead.customer_name, lead.mobile_number, lead.project_name]
        .some((field) => String(field || '').toLowerCase().includes(query));
    });
  }, [leads, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / TELE_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageLeads = filteredLeads.slice((safePage - 1) * TELE_PAGE_SIZE, safePage * TELE_PAGE_SIZE);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (safePage <= 4) return [1, 2, 3, 4, 5, '…', totalPages];
    if (safePage >= totalPages - 3) return [1, '…', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, '…', safePage - 1, safePage, safePage + 1, '…', totalPages];
  }, [safePage, totalPages]);

  return (
    <section className="rounded-[16px] border border-[#e2e9f3] bg-white p-4 shadow-[0_10px_26px_rgba(23,43,77,0.06)] sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="font-display text-[17px] font-extrabold text-[#102446]">{title}</h2>
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <label className="flex h-10 items-center gap-2 rounded-[9px] border border-[#dbe4f0] bg-white px-3">
            <Search className="size-4 text-[#8a98af]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="Search by name, mobile, project..."
              className="w-full min-w-0 bg-transparent text-[13px] font-semibold text-[#1f2d44] outline-none placeholder:text-[#8a98af] sm:w-[210px]"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="h-10 rounded-[9px] border border-[#dbe4f0] bg-white px-3 text-[13px] font-bold text-[#1f2d44] outline-none"
          >
            {['All', ...TELE_LEAD_STATUSES].map((option) => (
              <option key={option} value={option}>{option === 'All' ? 'All Status' : option}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onAddFollowUp(null)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[9px] border border-[#1d4ed8] bg-white px-4 text-[13px] font-extrabold text-[#1d4ed8] transition hover:bg-[#e7efff]"
          >
            <Phone className="size-4" />
            Add Follow-up
          </button>
          <button
            type="button"
            onClick={onAddLead}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[9px] bg-[#1d4ed8] px-4 text-[13px] font-extrabold text-white transition hover:bg-[#1a3fb0]"
          >
            <Plus className="size-4" />
            Add New Lead
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#e8eef6] text-[12px] font-extrabold uppercase tracking-[0.04em] text-[#7585a2]">
              <th className="px-3 py-3">#</th>
              <th className="px-3 py-3">Customer Name</th>
              <th className="px-3 py-3">Mobile No.</th>
              <th className="px-3 py-3">Project Name</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Next Follow-up</th>
              <th className="px-3 py-3">Remarks</th>
              <th className="px-3 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {!leadsLoaded && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-[13px] font-bold text-[#7585a2]">Loading leads...</td></tr>
            )}
            {leadsLoaded && pageLeads.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-[13px] font-bold text-[#7585a2]">No leads assigned to you yet.</td></tr>
            )}
            {pageLeads.map((lead, index) => (
              <tr
                key={lead.id}
                onDoubleClick={() => onView(lead)}
                title="Double-click to view follow-up history"
                className="cursor-pointer border-b border-[#f1f5fa] text-[13px] font-bold text-[#33456b] transition hover:bg-[#f8fbff]"
              >
                <td className="px-3 py-3.5 text-[#7585a2]">{(safePage - 1) * TELE_PAGE_SIZE + index + 1}</td>
                <td className="px-3 py-3.5 font-extrabold text-[#1e3261]">{lead.customer_name}</td>
                <td className="px-3 py-3.5">{lead.mobile_number || '—'}</td>
                <td className="px-3 py-3.5">{lead.project_name || '—'}</td>
                <td className="px-3 py-3.5"><StatusPill value={teleDisplayStatus(lead)} /></td>
                <td className="px-3 py-3.5 whitespace-nowrap">{formatDateTime(lead.next_follow_up)}</td>
                <td className="max-w-[200px] truncate px-3 py-3.5" title={lead.remarks || ''}>{lead.remarks || '—'}</td>
                <td className="px-3 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => onEdit(lead)} className="grid size-8 place-items-center rounded-[8px] text-[#53647f] transition hover:bg-[#f3f7fd]" aria-label={`Edit ${lead.customer_name}`}>
                      <Pencil className="size-4" />
                    </button>
                    <button type="button" onClick={() => onDelete(lead)} className="grid size-8 place-items-center rounded-[8px] text-[#dc2626] transition hover:bg-[#feecec]" aria-label={`Delete ${lead.customer_name}`}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-[12px] font-bold text-[#7585a2]">
          Showing {filteredLeads.length === 0 ? 0 : (safePage - 1) * TELE_PAGE_SIZE + 1} to {Math.min(safePage * TELE_PAGE_SIZE, filteredLeads.length)} of {filteredLeads.length} entries
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={safePage <= 1}
            className="grid size-9 place-items-center rounded-[8px] border border-[#dbe4f0] bg-white text-[#53647f] transition hover:bg-[#f8fbff] disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </button>
          {pageNumbers.map((pageNumber, index) => (
            pageNumber === '…' ? (
              <span key={`gap-${index}`} className="px-1 text-[13px] font-extrabold text-[#7585a2]">…</span>
            ) : (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                className={cx(
                  'grid size-9 place-items-center rounded-[8px] border text-[13px] font-extrabold transition',
                  pageNumber === safePage
                    ? 'border-[#1d4ed8] bg-[#1d4ed8] text-white'
                    : 'border-[#dbe4f0] bg-white text-[#53647f] hover:bg-[#f8fbff]',
                )}
              >
                {pageNumber}
              </button>
            )
          ))}
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={safePage >= totalPages}
            className="grid size-9 place-items-center rounded-[8px] border border-[#dbe4f0] bg-white text-[#53647f] transition hover:bg-[#f8fbff] disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function TeleDashboard({ leads, leadsLoaded, todayFollowUps, scheduledFollowUps, overdueCount, wonCount, lostCount, onView, onEdit, onDelete, onAddFollowUp, onAddLead }) {
  const cards = [
    { title: 'Total Leads', value: leadsLoaded ? leads.length : undefined, note: 'All assigned leads', icon: Users, tone: 'bg-[#e7efff] text-[#1d4ed8]' },
    { title: "Today's Follow-ups", value: leadsLoaded ? todayFollowUps.length : undefined, note: 'Scheduled for today', icon: CalendarDays, tone: 'bg-[#e8f8eb] text-[#0d9f4a]' },
    { title: 'Pending Follow-ups', value: leadsLoaded ? scheduledFollowUps.length : undefined, note: 'Yet to be contacted', icon: Clock3, tone: 'bg-[#fff4e0] text-[#c07a06]' },
    { title: 'Won Leads', value: leadsLoaded ? wonCount : undefined, note: 'Converted leads', icon: Trophy, tone: 'bg-[#f0e9ff] text-[#7c3aed]' },
    { title: 'Lost Leads', value: leadsLoaded ? lostCount : undefined, note: 'Closed as lost', icon: XCircle, tone: 'bg-[#feecec] text-[#dc2626]' },
  ];

  const upcomingReminders = scheduledFollowUps.filter((item) => item.reminder && item.reminder !== 'No reminder').slice(0, 5);

  return (
    <>
      <TeleStatCards cards={cards} />
      {overdueCount > 0 && (
        <p className="rounded-[12px] border border-[#f6caca] bg-[#fef4f4] px-4 py-3 text-[13px] font-bold text-[#b42318]">
          {overdueCount} follow-up{overdueCount === 1 ? '' : 's'} overdue — please contact these customers as soon as possible.
        </p>
      )}
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <TeleLeadsTable
          leads={leads}
          leadsLoaded={leadsLoaded}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddFollowUp={onAddFollowUp}
          onAddLead={onAddLead}
        />
        <div className="space-y-5">
          <section className="rounded-[16px] border border-[#e2e9f3] bg-white p-4 shadow-[0_10px_26px_rgba(23,43,77,0.06)]">
            <h2 className="font-display text-[15px] font-extrabold text-[#102446]">Today's Follow-ups</h2>
            <div className="mt-3 space-y-2.5">
              {todayFollowUps.length === 0 && (
                <p className="rounded-[10px] bg-[#f8fbff] px-3 py-4 text-center text-[12px] font-bold text-[#7585a2]">No follow-ups scheduled for today.</p>
              )}
              {todayFollowUps.slice(0, 6).map((item) => {
                const Icon = FOLLOW_UP_TYPE_ICONS[item.follow_up_type] || PhoneCall;
                return (
                  <div key={item.id} className="flex items-center gap-3 rounded-[10px] border border-[#eef2f8] px-3 py-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e8f8eb] text-[#0d9f4a]">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-extrabold text-[#1e3261]">{item.lead_customer_name}</p>
                      <p className="text-[11px] font-semibold text-[#7585a2]">{formatTime(item.scheduled_at)} · {item.follow_up_type}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="rounded-[16px] border border-[#e2e9f3] bg-white p-4 shadow-[0_10px_26px_rgba(23,43,77,0.06)]">
            <h2 className="font-display text-[15px] font-extrabold text-[#102446]">Reminders</h2>
            <div className="mt-3 space-y-2.5">
              {upcomingReminders.length === 0 && (
                <p className="rounded-[10px] bg-[#f8fbff] px-3 py-4 text-center text-[12px] font-bold text-[#7585a2]">No reminders set.</p>
              )}
              {upcomingReminders.map((item) => (
                <div key={item.id} className="flex items-start gap-3 rounded-[10px] border border-[#eef2f8] px-3 py-2.5">
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-[#fff4e0] text-[#c07a06]">
                    <Bell className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-extrabold text-[#1e3261]">{item.lead_customer_name}</p>
                    <p className="text-[11px] font-semibold text-[#7585a2]">{formatDateTime(item.scheduled_at)} · {item.reminder}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function TeleLeadsPage({ leads, leadsLoaded, onView, onEdit, onDelete, onAddFollowUp, onAddLead }) {
  return (
    <TeleLeadsTable
      leads={leads}
      leadsLoaded={leadsLoaded}
      onView={onView}
      onEdit={onEdit}
      onDelete={onDelete}
      onAddFollowUp={onAddFollowUp}
      onAddLead={onAddLead}
    />
  );
}

// ─── Follow-ups page ──────────────────────────────────────────────────────────

function TeleFollowUpsPage({ followUps, loaded, onAddFollowUp, onViewLead }) {
  const now = new Date();
  const completed = followUps.filter((item) => item.status === 'Completed');
  const scheduled = followUps.filter((item) => item.status === 'Scheduled');
  const overdue = scheduled.filter((item) => new Date(item.scheduled_at) < now);

  const cards = [
    { title: 'Total Follow-ups', value: loaded ? followUps.length : undefined, note: 'All follow-ups', icon: Phone, tone: 'bg-[#e7efff] text-[#1d4ed8]' },
    { title: 'Completed', value: loaded ? completed.length : undefined, note: 'Contact done', icon: CheckCircle2, tone: 'bg-[#e8f8eb] text-[#0d9f4a]' },
    { title: 'Pending', value: loaded ? scheduled.length : undefined, note: 'Still scheduled', icon: Clock3, tone: 'bg-[#fff4e0] text-[#c07a06]' },
    { title: 'Overdue', value: loaded ? overdue.length : undefined, note: 'Past their time', icon: XCircle, tone: 'bg-[#feecec] text-[#dc2626]' },
  ];

  const rows = [...followUps].sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at));

  return (
    <>
      <section className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.title} className="rounded-[14px] border border-[#e2e9f3] bg-white p-4 shadow-[0_10px_26px_rgba(23,43,77,0.05)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-extrabold text-[#7585a2]">{card.title}</p>
                  <p className="mt-2 font-display text-[26px] font-extrabold text-[#102446]">{card.value ?? '—'}</p>
                  <p className="mt-1 text-[11px] font-semibold text-[#8a98af]">{card.note}</p>
                </div>
                <span className={cx('grid size-11 shrink-0 place-items-center rounded-full', card.tone)}>
                  <Icon className="size-5" />
                </span>
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded-[16px] border border-[#e2e9f3] bg-white p-4 shadow-[0_10px_26px_rgba(23,43,77,0.06)] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-[17px] font-extrabold text-[#102446]">Follow-up History</h2>
          <button
            type="button"
            onClick={() => onAddFollowUp(null)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[9px] bg-[#1d4ed8] px-4 text-[13px] font-extrabold text-white transition hover:bg-[#1a3fb0]"
          >
            <Plus className="size-4" />
            Add Follow-up
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#e8eef6] text-[12px] font-extrabold uppercase tracking-[0.04em] text-[#7585a2]">
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Date & Time</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Reminder</th>
                <th className="px-3 py-3">Summary</th>
              </tr>
            </thead>
            <tbody>
              {!loaded && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-[13px] font-bold text-[#7585a2]">Loading follow-ups...</td></tr>
              )}
              {loaded && rows.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-[13px] font-bold text-[#7585a2]">No follow-ups yet. Add your first follow-up.</td></tr>
              )}
              {rows.map((item) => {
                const Icon = FOLLOW_UP_TYPE_ICONS[item.follow_up_type] || PhoneCall;
                return (
                  <tr
                    key={item.id}
                    onDoubleClick={() => onViewLead(item.lead)}
                    title="Double-click to view follow-up history"
                    className="cursor-pointer border-b border-[#f1f5fa] text-[13px] font-bold text-[#33456b] transition hover:bg-[#f8fbff]"
                  >
                    <td className="px-3 py-3.5 font-extrabold text-[#1e3261]">{item.lead_customer_name}</td>
                    <td className="px-3 py-3.5">
                      <span className="inline-flex items-center gap-2">
                        <Icon className="size-4 text-[#1d4ed8]" />
                        {item.follow_up_type}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5">{formatDateTime(item.scheduled_at)}</td>
                    <td className="px-3 py-3.5">
                      <span className={cx(
                        'inline-flex rounded-full px-3 py-1 text-[11px] font-extrabold',
                        item.status === 'Completed' ? 'bg-[#e8f8eb] text-[#0d9f4a]' : item.status === 'Missed' ? 'bg-[#feecec] text-[#dc2626]' : 'bg-[#e7efff] text-[#1d4ed8]',
                      )}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">{item.reminder || '—'}</td>
                    <td className="max-w-[220px] truncate px-3 py-3.5" title={item.notes || ''}>{item.notes || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// ─── Reminders page ───────────────────────────────────────────────────────────

function TeleRemindersPage({ scheduledFollowUps, loaded }) {
  const now = new Date();
  const todayKey = now.toDateString();
  const in3Days = new Date(now.getTime() + 3 * 86400000);
  const in7Days = new Date(now.getTime() + 7 * 86400000);

  const dueState = (item) => {
    const at = new Date(item.scheduled_at);
    if (at.toDateString() === todayKey) return 'Due Today';
    if (at < now) return 'Overdue';
    return 'Upcoming';
  };

  const cards = [
    { title: "Today's Reminders", value: loaded ? scheduledFollowUps.filter((i) => new Date(i.scheduled_at).toDateString() === todayKey).length : undefined, note: 'Follow-ups due today', icon: CalendarDays, tone: 'bg-[#e7efff] text-[#1d4ed8]' },
    { title: 'Within 3 Days', value: loaded ? scheduledFollowUps.filter((i) => { const d = new Date(i.scheduled_at); return d > now && d <= in3Days; }).length : undefined, note: 'Due in next 3 days', icon: Clock3, tone: 'bg-[#e8f8eb] text-[#0d9f4a]' },
    { title: 'This Week', value: loaded ? scheduledFollowUps.filter((i) => { const d = new Date(i.scheduled_at); return d > now && d <= in7Days; }).length : undefined, note: 'Due in this week', icon: Bell, tone: 'bg-[#fff4e0] text-[#c07a06]' },
    { title: 'Overdue', value: loaded ? scheduledFollowUps.filter((i) => new Date(i.scheduled_at) < now && new Date(i.scheduled_at).toDateString() !== todayKey).length : undefined, note: 'Reminders overdue', icon: XCircle, tone: 'bg-[#feecec] text-[#dc2626]' },
  ];

  return (
    <>
      <section className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.title} className="rounded-[14px] border border-[#e2e9f3] bg-white p-4 shadow-[0_10px_26px_rgba(23,43,77,0.05)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-extrabold text-[#7585a2]">{card.title}</p>
                  <p className="mt-2 font-display text-[26px] font-extrabold text-[#102446]">{card.value ?? '—'}</p>
                  <p className="mt-1 text-[11px] font-semibold text-[#8a98af]">{card.note}</p>
                </div>
                <span className={cx('grid size-11 shrink-0 place-items-center rounded-full', card.tone)}>
                  <Icon className="size-5" />
                </span>
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded-[16px] border border-[#e2e9f3] bg-white p-4 shadow-[0_10px_26px_rgba(23,43,77,0.06)] sm:p-5">
        <h2 className="font-display text-[17px] font-extrabold text-[#102446]">Upcoming Reminders</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#e8eef6] text-[12px] font-extrabold uppercase tracking-[0.04em] text-[#7585a2]">
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3">Mobile No.</th>
                <th className="px-3 py-3">Project</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Follow-up Date & Time</th>
                <th className="px-3 py-3">Reminder</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {!loaded && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-[13px] font-bold text-[#7585a2]">Loading reminders...</td></tr>
              )}
              {loaded && scheduledFollowUps.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-[13px] font-bold text-[#7585a2]">No upcoming reminders.</td></tr>
              )}
              {scheduledFollowUps.map((item) => {
                const state = dueState(item);
                const Icon = FOLLOW_UP_TYPE_ICONS[item.follow_up_type] || PhoneCall;
                return (
                  <tr key={item.id} className="border-b border-[#f1f5fa] text-[13px] font-bold text-[#33456b] transition hover:bg-[#f8fbff]">
                    <td className="px-3 py-3.5 font-extrabold text-[#1e3261]">{item.lead_customer_name}</td>
                    <td className="px-3 py-3.5">{item.lead_mobile_number || '—'}</td>
                    <td className="px-3 py-3.5">{item.lead_project_name || '—'}</td>
                    <td className="px-3 py-3.5">
                      <span className="inline-flex items-center gap-2">
                        <Icon className="size-4 text-[#1d4ed8]" />
                        {item.follow_up_type}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5">{formatDateTime(item.scheduled_at)}</td>
                    <td className="px-3 py-3.5">{item.reminder || 'No reminder'}</td>
                    <td className="px-3 py-3.5">
                      <span className={cx(
                        'inline-flex rounded-full px-3 py-1 text-[11px] font-extrabold',
                        state === 'Due Today' ? 'bg-[#feecec] text-[#dc2626]' : state === 'Overdue' ? 'bg-[#fff1e0] text-[#ea7c1c]' : 'bg-[#e7efff] text-[#1d4ed8]',
                      )}>
                        {state === 'Due Today' ? 'Due Now' : state}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// ─── Reports page ─────────────────────────────────────────────────────────────

function TeleReportsPage({ leads, followUps }) {
  const now = new Date();
  const total = leads.length;
  const won = leads.filter((lead) => lead.status === 'Won').length;
  const lost = leads.filter((lead) => lead.status === 'Lost').length;
  const completed = followUps.filter((item) => item.status === 'Completed').length;
  const pendingTasks = followUps.filter((item) => item.status === 'Scheduled').length;
  const overdue = followUps.filter((item) => item.status === 'Scheduled' && new Date(item.scheduled_at) < now).length;
  const conversion = total > 0 ? Math.round((won / total) * 100) : 0;
  const completion = followUps.length > 0 ? Math.round((completed / followUps.length) * 100) : 0;

  const statusCounts = TELE_LEAD_STATUSES.map((statusName) => ({
    name: statusName,
    count: leads.filter((lead) => teleDisplayStatus(lead) === statusName).length,
  }));
  const maxStatus = Math.max(1, ...statusCounts.map((row) => row.count));

  const typeCounts = FOLLOW_UP_TYPES.map((typeName) => ({
    name: typeName,
    count: followUps.filter((item) => item.follow_up_type === typeName).length,
  })).filter((row) => row.count > 0);

  const statusBarTones = {
    New: 'bg-[#1d4ed8]', Hot: 'bg-[#ea7c1c]', Cool: 'bg-[#7c3aed]', Won: 'bg-[#0d9f4a]', Lost: 'bg-[#dc2626]',
  };

  const cards = [
    { title: 'My Leads', value: total, note: 'Assigned to me', icon: Users, tone: 'bg-[#e7efff] text-[#1d4ed8]' },
    { title: 'My Follow-ups', value: followUps.length, note: `${completed} completed`, icon: Phone, tone: 'bg-[#e8f8eb] text-[#0d9f4a]' },
    { title: 'My Conversions', value: won, note: `${conversion}% conversion rate`, icon: Trophy, tone: 'bg-[#f0e9ff] text-[#7c3aed]' },
    { title: 'My Performance', value: `${completion}%`, note: 'Follow-up completion', icon: BarChart3, tone: 'bg-[#fff4e0] text-[#c07a06]' },
    { title: 'My Pending Tasks', value: pendingTasks, note: `${overdue} overdue`, icon: Clock3, tone: 'bg-[#feecec] text-[#dc2626]' },
  ];

  return (
    <>
      <TeleStatCards cards={cards} />
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-[16px] border border-[#e2e9f3] bg-white p-5 shadow-[0_10px_26px_rgba(23,43,77,0.06)]">
          <h2 className="font-display text-[16px] font-extrabold text-[#102446]">Lead Status Summary</h2>
          <div className="mt-4 space-y-3.5">
            {statusCounts.map((row) => (
              <div key={row.name}>
                <div className="flex items-center justify-between text-[13px] font-bold text-[#33456b]">
                  <span>{row.name}</span>
                  <span className="font-extrabold text-[#102446]">
                    {row.count} {total > 0 ? `(${Math.round((row.count / total) * 100)}%)` : ''}
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[#eef2f8]">
                  <div className={cx('h-full rounded-full', statusBarTones[row.name])} style={{ width: `${(row.count / maxStatus) * 100}%` }} />
                </div>
              </div>
            ))}
            <p className="border-t border-[#edf2f8] pt-3 text-[13px] font-extrabold text-[#102446]">Total Leads: {total}</p>
          </div>
        </section>

        <section className="rounded-[16px] border border-[#e2e9f3] bg-white p-5 shadow-[0_10px_26px_rgba(23,43,77,0.06)]">
          <h2 className="font-display text-[16px] font-extrabold text-[#102446]">Follow-up Type Distribution</h2>
          <div className="mt-4 space-y-2.5">
            {typeCounts.length === 0 && (
              <p className="rounded-[10px] bg-[#f8fbff] px-3 py-6 text-center text-[12px] font-bold text-[#7585a2]">No follow-ups recorded yet.</p>
            )}
            {typeCounts.map((row) => {
              const Icon = FOLLOW_UP_TYPE_ICONS[row.name] || PhoneCall;
              return (
                <div key={row.name} className="flex items-center gap-3 rounded-[10px] border border-[#eef2f8] px-3.5 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e7efff] text-[#1d4ed8]">
                    <Icon className="size-4" />
                  </span>
                  <p className="flex-1 text-[13px] font-extrabold text-[#1e3261]">{row.name}</p>
                  <p className="text-[13px] font-extrabold text-[#102446]">
                    {row.count}
                    <span className="ml-2 font-bold text-[#7585a2]">({Math.round((row.count / followUps.length) * 100)}%)</span>
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[12px] font-semibold text-[#8a98af]">Reports cover only your own leads and follow-ups.</p>
        </section>
      </div>
    </>
  );
}

// ─── Settings page ────────────────────────────────────────────────────────────

function TeleSettingsPage({ me }) {
  const profileFields = [
    { label: 'Full Name', value: me?.name },
    { label: 'Email Address', value: me?.email },
    { label: 'Mobile Number', value: me?.mobile },
    { label: 'Role', value: me?.role_name },
    { label: 'Branch', value: me?.branch_name },
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-[16px] border border-[#e2e9f3] bg-white p-5 shadow-[0_10px_26px_rgba(23,43,77,0.06)]">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-[#e7efff] text-[#1d4ed8]">
            <UserRound className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-[16px] font-extrabold text-[#102446]">My Profile</h2>
            <p className="text-[12px] font-semibold text-[#7585a2]">Your account information.</p>
          </div>
        </div>
        <div className="mt-5 space-y-4">
          {profileFields.map((field) => (
            <div key={field.label}>
              <p className="text-[12px] font-extrabold text-[#7585a2]">{field.label}</p>
              <p className="mt-1 rounded-[9px] border border-[#eef2f8] bg-[#f8fbff] px-3.5 py-2.5 text-[14px] font-bold text-[#1e3261]">
                {field.value || '—'}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 inline-flex items-center gap-2 text-[12px] font-semibold text-[#8a98af]">
          <ShieldCheck className="size-4 text-[#0d9f4a]" />
          Profile details are managed by your administrator.
        </p>
      </section>

      <section className="rounded-[16px] border border-[#e2e9f3] bg-white p-5 shadow-[0_10px_26px_rgba(23,43,77,0.06)]">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-[#fff4e0] text-[#c07a06]">
            <KeyRound className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-[16px] font-extrabold text-[#102446]">Account & Password</h2>
            <p className="text-[12px] font-semibold text-[#7585a2]">Managed by your administrator.</p>
          </div>
        </div>
        <div className="mt-5 rounded-[12px] border border-[#e8eef6] bg-[#f8fbff] p-4">
          <p className="text-[13px] font-semibold leading-6 text-[#53647f]">
            Tele Executive accounts do not have permission to change login credentials.
            Account creation, password resets, deactivation and lead/project assignment
            are handled exclusively by the Super Admin.
          </p>
          <p className="mt-3 inline-flex items-center gap-2 text-[13px] font-extrabold text-[#1d4ed8]">
            <LockKeyhole className="size-4" />
            Need a password reset? Contact your Super Admin.
          </p>
        </div>
      </section>
    </div>
  );
}

// ─── Follow-up create modal ───────────────────────────────────────────────────

function TeleFollowUpCreateModal({ leads, initialLead, onClose, onSaved, onNotify }) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    leadId: initialLead?.id ? String(initialLead.id) : '',
    type: 'Call',
    date: todayIso,
    time: new Date().toTimeString().slice(0, 5),
    reminder: 'No reminder',
    summary: '',
    nextDate: '',
    nextTime: '10:00',
    leadStatus: initialLead ? teleDisplayStatus(initialLead) : 'New',
  });
  const [saving, setSaving] = useState(false);

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleLeadChange = (value) => {
    const lead = leads.find((row) => String(row.id) === value);
    setForm((current) => ({ ...current, leadId: value, leadStatus: lead ? teleDisplayStatus(lead) : current.leadStatus }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.leadId) { onNotify('Please select a lead.', 'error'); return; }
    if (!form.date) { onNotify('Please select the follow-up date.', 'error'); return; }
    if (form.nextDate && new Date(`${form.nextDate}T${form.nextTime || '10:00'}`) < new Date()) {
      onNotify('Next follow-up must be in the future.', 'error');
      return;
    }
    setSaving(true);
    const leadId = Number(form.leadId);
    const happenedAt = new Date(`${form.date}T${form.time || '09:00'}`).toISOString();
    try {
      // The interaction that just happened, logged as completed.
      await followUpApi.create({
        lead: leadId,
        follow_up_type: form.type,
        scheduled_at: happenedAt,
        completed_at: happenedAt,
        status: 'Completed',
        notes: form.summary,
        reminder: form.reminder === 'No reminder' ? '' : form.reminder,
        status_after: form.leadStatus,
      });
      // The next scheduled follow-up (drives lead.next_follow_up + reminders).
      if (form.nextDate) {
        await followUpApi.create({
          lead: leadId,
          follow_up_type: form.type,
          scheduled_at: new Date(`${form.nextDate}T${form.nextTime || '10:00'}`).toISOString(),
          status: 'Scheduled',
          reminder: form.reminder === 'No reminder' ? '' : form.reminder,
        });
      }
      // Reflect the outcome on the lead itself.
      await leadApi.update(leadId, mapTeleStatusToApi(form.leadStatus));
      onNotify('Follow-up saved.', 'success');
      onSaved();
    } catch (err) {
      onNotify(err.message || 'Could not save follow-up.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <TeleModal title="Add Follow-up" onClose={onClose} wide>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <TeleField label="Lead / Customer">
          <select value={form.leadId} onChange={(e) => handleLeadChange(e.target.value)} className={teleInputClass}>
            <option value="">Select lead...</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>{lead.customer_name} — {lead.mobile_number}</option>
            ))}
          </select>
        </TeleField>

        <div className="grid gap-4 sm:grid-cols-3">
          <TeleField label="Follow-up Type">
            <select value={form.type} onChange={(e) => updateField('type', e.target.value)} className={teleInputClass}>
              {FOLLOW_UP_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </TeleField>
          <TeleField label="Date">
            <input type="date" value={form.date} onChange={(e) => updateField('date', e.target.value)} className={teleInputClass} />
          </TeleField>
          <TeleField label="Time">
            <input type="time" value={form.time} onChange={(e) => updateField('time', e.target.value)} className={teleInputClass} />
          </TeleField>
        </div>

        <TeleField label="Conversation Summary">
          <textarea
            value={form.summary}
            onChange={(e) => updateField('summary', e.target.value)}
            placeholder="What did the customer say?"
            rows={3}
            className="w-full rounded-[9px] border border-[#dbe4f0] bg-white px-3 py-2.5 text-[14px] font-semibold text-[#1f2d44] outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </TeleField>

        <div className="grid gap-4 sm:grid-cols-3">
          <TeleField label="Next Follow-up Date">
            <input type="date" value={form.nextDate} min={todayIso} onChange={(e) => updateField('nextDate', e.target.value)} className={teleInputClass} />
          </TeleField>
          <TeleField label="Next Follow-up Time">
            <input type="time" value={form.nextTime} onChange={(e) => updateField('nextTime', e.target.value)} className={teleInputClass} />
          </TeleField>
          <TeleField label="Reminder">
            <select value={form.reminder} onChange={(e) => updateField('reminder', e.target.value)} className={teleInputClass}>
              {REMINDER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </TeleField>
        </div>

        <TeleField label="Lead Status">
          <div className="flex flex-wrap gap-2">
            {TELE_LEAD_STATUSES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => updateField('leadStatus', option)}
                className={cx(
                  'rounded-full border px-4 py-2 text-[12px] font-extrabold transition',
                  form.leadStatus === option
                    ? 'border-[#1d4ed8] bg-[#1d4ed8] text-white'
                    : 'border-[#dbe4f0] bg-white text-[#53647f] hover:bg-[#f8fbff]',
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </TeleField>

        <div className="flex justify-end gap-2.5 border-t border-[#edf2f8] pt-4">
          <button type="button" onClick={onClose} className="h-11 rounded-[9px] border border-[#dbe4f0] px-4 text-[13px] font-extrabold text-[#53647f] transition hover:bg-[#f8fbff]">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-[9px] bg-[#1d4ed8] px-5 text-[13px] font-extrabold text-white transition hover:bg-[#1a3fb0] disabled:opacity-60">
            <Plus className="size-4" />
            {saving ? 'Saving...' : 'Save Follow-up'}
          </button>
        </div>
      </form>
    </TeleModal>
  );
}

// ─── Follow-up history modal ──────────────────────────────────────────────────

function TeleFollowUpHistoryModal({ lead, onClose, onNotify }) {
  const [history, setHistory] = useState(null);

  useEffect(() => {
    followUpApi.list(lead.id).then((data) => {
      const rows = Array.isArray(data) ? data : (data?.results ?? []);
      // Chronological timeline: earliest first.
      setHistory(rows.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)));
    }).catch(() => { setHistory([]); onNotify('Could not load follow-up history.', 'error'); });
  }, [lead.id]);

  return (
    <TeleModal title={`Follow-up History — ${lead.customer_name}`} onClose={onClose} wide>
      <div className="grid gap-3 rounded-[12px] border border-[#e8eef6] bg-[#f8fbff] p-4 sm:grid-cols-2">
        <div className="flex items-center gap-2.5">
          <UserRound className="size-4 shrink-0 text-[#7585a2]" />
          <div>
            <p className="text-[11px] font-extrabold text-[#7585a2]">Customer Name</p>
            <p className="text-[13px] font-extrabold text-[#1e3261]">{lead.customer_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Phone className="size-4 shrink-0 text-[#7585a2]" />
          <div>
            <p className="text-[11px] font-extrabold text-[#7585a2]">Mobile No.</p>
            <p className="text-[13px] font-extrabold text-[#1e3261]">{lead.mobile_number || '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <StickyNote className="size-4 shrink-0 text-[#7585a2]" />
          <div>
            <p className="text-[11px] font-extrabold text-[#7585a2]">Project Name</p>
            <p className="text-[13px] font-extrabold text-[#1e3261]">{lead.project_name || '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="size-4 shrink-0 text-[#7585a2]" />
          <div>
            <p className="text-[11px] font-extrabold text-[#7585a2]">Lead Status</p>
            <StatusPill value={teleDisplayStatus(lead)} />
          </div>
        </div>
      </div>

      <p className="mt-4 text-[13px] font-extrabold text-[#33456b]">
        Total Follow-ups: {history === null ? '…' : history.length}
      </p>

      <div className="mt-3 space-y-3">
        {history === null && (
          <p className="rounded-[10px] bg-[#f8fbff] px-3 py-6 text-center text-[12px] font-bold text-[#7585a2]">Loading history...</p>
        )}
        {history !== null && history.length === 0 && (
          <p className="rounded-[10px] bg-[#f8fbff] px-3 py-6 text-center text-[12px] font-bold text-[#7585a2]">No follow-ups recorded for this lead yet.</p>
        )}
        {(history ?? []).map((item) => {
          const Icon = FOLLOW_UP_TYPE_ICONS[item.follow_up_type] || PhoneCall;
          return (
            <article key={item.id} className="flex gap-3 rounded-[12px] border border-[#e8eef6] p-3.5">
              <span className={cx(
                'mt-0.5 grid size-10 shrink-0 place-items-center rounded-full',
                item.status === 'Completed' ? 'bg-[#e8f8eb] text-[#0d9f4a]' : item.status === 'Missed' ? 'bg-[#feecec] text-[#dc2626]' : 'bg-[#e7efff] text-[#1d4ed8]',
              )}>
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13px] font-extrabold text-[#1e3261]">
                    {formatDateTime(item.scheduled_at)}
                    <span className="ml-2 font-bold text-[#7585a2]">· {item.follow_up_type}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    {item.status_after && <StatusPill value={item.status_after} />}
                    <span className={cx(
                      'inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold',
                      item.status === 'Completed' ? 'bg-[#e8f8eb] text-[#0d9f4a]' : item.status === 'Missed' ? 'bg-[#feecec] text-[#dc2626]' : 'bg-[#e7efff] text-[#1d4ed8]',
                    )}>
                      {item.status}
                    </span>
                  </div>
                </div>
                {item.notes && (
                  <p className="mt-1.5 text-[13px] font-semibold leading-6 text-[#53647f]">
                    <span className="font-extrabold text-[#33456b]">Conversation Summary: </span>
                    {item.notes}
                  </p>
                )}
                <p className="mt-1.5 text-[11px] font-semibold text-[#8a98af]">
                  Followed up by {item.created_by_name || '—'}
                  {item.reminder ? ` · Reminder: ${item.reminder}` : ''}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-4 flex justify-end border-t border-[#edf2f8] pt-4">
        <button type="button" onClick={onClose} className="h-10 rounded-[9px] border border-[#dbe4f0] px-5 text-[13px] font-extrabold text-[#53647f] transition hover:bg-[#f8fbff]">
          Close
        </button>
      </div>
    </TeleModal>
  );
}

// ─── Lead create modal ────────────────────────────────────────────────────────

function TeleLeadCreateModal({ onClose, onSaved, onNotify }) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    customer_name: '',
    mobile_number: '',
    alternate_number: '',
    email: '',
    project_name: '',
    project_type: 'On-Grid',
    estimated_capacity: '',
    source: 'Website',
    priority: 'Medium',
    address: '',
    city: '',
    state: 'Madhya Pradesh',
    requirement_details: '',
    remarks: '',
    leadStatus: 'New',
    nextDate: '',
    nextTime: '10:00',
    reminder: 'No reminder',
  });
  const [saving, setSaving] = useState(false);

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.customer_name.trim()) { onNotify('Customer name is required.', 'error'); return; }
    if (!/^\d{10}$/.test(form.mobile_number.trim())) { onNotify('Mobile number must be 10 digits.', 'error'); return; }
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email.trim())) { onNotify('Please enter a valid email address.', 'error'); return; }
    if (form.nextDate && new Date(`${form.nextDate}T${form.nextTime || '10:00'}`) < new Date()) {
      onNotify('First follow-up must be in the future.', 'error');
      return;
    }
    setSaving(true);
    const { status, category } = mapTeleStatusToApi(form.leadStatus);
    try {
      // Backend force-assigns the lead to the logged-in tele executive.
      const created = await leadApi.create({
        customer_name: form.customer_name.trim(),
        mobile_number: form.mobile_number.trim(),
        alternate_number: form.alternate_number.trim(),
        email: form.email.trim(),
        project_name: form.project_name.trim() || (form.estimated_capacity ? `${form.estimated_capacity}kW Rooftop Solar` : ''),
        project_type: form.project_type,
        estimated_capacity: form.estimated_capacity,
        source: form.source,
        priority: form.priority,
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        requirement_details: form.requirement_details.trim(),
        remarks: form.remarks.trim(),
        status,
      });
      // Hot/Cool live on category, which the create endpoint doesn't accept.
      if (created?.id && category) {
        await leadApi.update(created.id, { status, category });
      }
      // Optional first follow-up schedule (also sets the lead's next_follow_up).
      if (created?.id && form.nextDate) {
        await followUpApi.create({
          lead: created.id,
          follow_up_type: 'Call',
          scheduled_at: new Date(`${form.nextDate}T${form.nextTime || '10:00'}`).toISOString(),
          status: 'Scheduled',
          notes: 'First follow-up for new lead.',
          reminder: form.reminder === 'No reminder' ? '' : form.reminder,
        });
      }
      onNotify('Lead created.', 'success');
      onSaved();
    } catch (err) {
      onNotify(err.message || 'Could not create lead.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <TeleModal title="Add New Lead" onClose={onClose} wide>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TeleField label="Customer Name *">
            <input type="text" value={form.customer_name} onChange={(e) => updateField('customer_name', e.target.value)} placeholder="Full name" className={teleInputClass} />
          </TeleField>
          <TeleField label="Mobile Number *">
            <input type="text" value={form.mobile_number} onChange={(e) => updateField('mobile_number', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile" className={teleInputClass} />
          </TeleField>
          <TeleField label="Alternate Number">
            <input type="text" value={form.alternate_number} onChange={(e) => updateField('alternate_number', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="Optional" className={teleInputClass} />
          </TeleField>
          <TeleField label="Email Address">
            <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder="Optional" className={teleInputClass} />
          </TeleField>
          <TeleField label="Project Type">
            <select value={form.project_type} onChange={(e) => updateField('project_type', e.target.value)} className={teleInputClass}>
              {['On-Grid', 'Off-Grid', 'Hybrid'].map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </TeleField>
          <TeleField label="Estimated Capacity (kW)">
            <input type="text" value={form.estimated_capacity} onChange={(e) => updateField('estimated_capacity', e.target.value.replace(/[^\d.]/g, ''))} placeholder="e.g. 5" className={teleInputClass} />
          </TeleField>
          <TeleField label="Project Name">
            <input type="text" value={form.project_name} onChange={(e) => updateField('project_name', e.target.value)} placeholder="Auto-filled from capacity if empty" className={teleInputClass} />
          </TeleField>
          <TeleField label="Lead Source">
            <select value={form.source} onChange={(e) => updateField('source', e.target.value)} className={teleInputClass}>
              {LEAD_SOURCES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </TeleField>
          <TeleField label="Priority">
            <select value={form.priority} onChange={(e) => updateField('priority', e.target.value)} className={teleInputClass}>
              {['High', 'Medium', 'Low'].map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </TeleField>
          <TeleField label="City">
            <input type="text" value={form.city} onChange={(e) => updateField('city', e.target.value)} placeholder="e.g. Indore" className={teleInputClass} />
          </TeleField>
          <TeleField label="State">
            <input type="text" value={form.state} onChange={(e) => updateField('state', e.target.value)} className={teleInputClass} />
          </TeleField>
          <TeleField label="Address">
            <input type="text" value={form.address} onChange={(e) => updateField('address', e.target.value)} placeholder="House no., area, landmark" className={teleInputClass} />
          </TeleField>
        </div>

        <TeleField label="Requirement Details">
          <textarea
            value={form.requirement_details}
            onChange={(e) => updateField('requirement_details', e.target.value)}
            rows={2}
            placeholder="What does the customer need? Monthly bill, roof size, etc."
            className="w-full rounded-[9px] border border-[#dbe4f0] bg-white px-3 py-2.5 text-[14px] font-semibold text-[#1f2d44] outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </TeleField>

        <TeleField label="Remarks">
          <textarea
            value={form.remarks}
            onChange={(e) => updateField('remarks', e.target.value)}
            rows={2}
            placeholder="First conversation notes..."
            className="w-full rounded-[9px] border border-[#dbe4f0] bg-white px-3 py-2.5 text-[14px] font-semibold text-[#1f2d44] outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </TeleField>

        <TeleField label="Lead Status">
          <div className="flex flex-wrap gap-2">
            {TELE_LEAD_STATUSES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => updateField('leadStatus', option)}
                className={cx(
                  'rounded-full border px-4 py-2 text-[12px] font-extrabold transition',
                  form.leadStatus === option
                    ? 'border-[#1d4ed8] bg-[#1d4ed8] text-white'
                    : 'border-[#dbe4f0] bg-white text-[#53647f] hover:bg-[#f8fbff]',
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </TeleField>

        <div className="grid gap-4 sm:grid-cols-3">
          <TeleField label="First Follow-up Date">
            <input type="date" value={form.nextDate} min={todayIso} onChange={(e) => updateField('nextDate', e.target.value)} className={teleInputClass} />
          </TeleField>
          <TeleField label="First Follow-up Time">
            <input type="time" value={form.nextTime} onChange={(e) => updateField('nextTime', e.target.value)} className={teleInputClass} />
          </TeleField>
          <TeleField label="Reminder">
            <select value={form.reminder} onChange={(e) => updateField('reminder', e.target.value)} className={teleInputClass}>
              {REMINDER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </TeleField>
        </div>

        <div className="flex justify-end gap-2.5 border-t border-[#edf2f8] pt-4">
          <button type="button" onClick={onClose} className="h-11 rounded-[9px] border border-[#dbe4f0] px-4 text-[13px] font-extrabold text-[#53647f] transition hover:bg-[#f8fbff]">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-[9px] bg-[#1d4ed8] px-5 text-[13px] font-extrabold text-white transition hover:bg-[#1a3fb0] disabled:opacity-60">
            <Plus className="size-4" />
            {saving ? 'Saving...' : 'Create Lead'}
          </button>
        </div>
      </form>
    </TeleModal>
  );
}

// ─── Lead edit modal ──────────────────────────────────────────────────────────

function TeleLeadEditModal({ lead, onClose, onSaved, onNotify }) {
  const [form, setForm] = useState({
    customer_name: lead.customer_name || '',
    // CRM-side lead forms allow formatted numbers ("+91 98765 43210") —
    // normalize to the 10-digit core so editing such leads isn't blocked.
    mobile_number: String(lead.mobile_number || '').replace(/\D/g, '').slice(-10),
    project_name: lead.project_name || '',
    project_type: lead.project_type || '',
    remarks: lead.remarks || '',
    leadStatus: teleDisplayStatus(lead),
  });
  const [saving, setSaving] = useState(false);

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.customer_name.trim()) { onNotify('Customer name is required.', 'error'); return; }
    if (!/^\d{10}$/.test(form.mobile_number.trim())) { onNotify('Mobile number must be 10 digits.', 'error'); return; }
    setSaving(true);
    try {
      await leadApi.update(lead.id, {
        customer_name: form.customer_name.trim(),
        mobile_number: form.mobile_number.trim(),
        project_name: form.project_name.trim(),
        project_type: form.project_type,
        remarks: form.remarks,
        ...mapTeleStatusToApi(form.leadStatus),
      });
      onNotify('Lead updated.', 'success');
      onSaved();
    } catch (err) {
      onNotify(err.message || 'Could not update lead.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <TeleModal title={`Edit Lead — ${lead.customer_name}`} onClose={onClose} wide>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TeleField label="Customer Name">
            <input type="text" value={form.customer_name} onChange={(e) => updateField('customer_name', e.target.value)} className={teleInputClass} />
          </TeleField>
          <TeleField label="Mobile Number">
            <input type="text" value={form.mobile_number} onChange={(e) => updateField('mobile_number', e.target.value.replace(/\D/g, '').slice(0, 10))} className={teleInputClass} />
          </TeleField>
          <TeleField label="Project Name">
            <input type="text" value={form.project_name} onChange={(e) => updateField('project_name', e.target.value)} className={teleInputClass} />
          </TeleField>
          <TeleField label="Project Type">
            <select value={form.project_type} onChange={(e) => updateField('project_type', e.target.value)} className={teleInputClass}>
              <option value="">Select type...</option>
              {['On-Grid', 'Off-Grid', 'Hybrid'].map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </TeleField>
        </div>

        <TeleField label="Remarks">
          <textarea
            value={form.remarks}
            onChange={(e) => updateField('remarks', e.target.value)}
            rows={3}
            placeholder="Notes about this lead..."
            className="w-full rounded-[9px] border border-[#dbe4f0] bg-white px-3 py-2.5 text-[14px] font-semibold text-[#1f2d44] outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </TeleField>

        <TeleField label="Lead Status">
          <div className="flex flex-wrap gap-2">
            {TELE_LEAD_STATUSES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => updateField('leadStatus', option)}
                className={cx(
                  'rounded-full border px-4 py-2 text-[12px] font-extrabold transition',
                  form.leadStatus === option
                    ? 'border-[#1d4ed8] bg-[#1d4ed8] text-white'
                    : 'border-[#dbe4f0] bg-white text-[#53647f] hover:bg-[#f8fbff]',
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </TeleField>

        <div className="flex justify-end gap-2.5 border-t border-[#edf2f8] pt-4">
          <button type="button" onClick={onClose} className="h-11 rounded-[9px] border border-[#dbe4f0] px-4 text-[13px] font-extrabold text-[#53647f] transition hover:bg-[#f8fbff]">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="h-11 rounded-[9px] bg-[#1d4ed8] px-5 text-[13px] font-extrabold text-white transition hover:bg-[#1a3fb0] disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </TeleModal>
  );
}
