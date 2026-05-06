import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Boxes,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardPlus,
  Clock3,
  Eye,
  FilePlus2,
  FileText,
  FolderKanban,
  Heart,
  Home,
  IndianRupee,
  Leaf,
  Menu,
  MessageSquareMore,
  Minus,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Trophy,
  UserPlus,
  Users,
  UsersRound,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import headerImage from '../Data/header_image.png';
import brandImage from './assets/malwa-brand.svg';

const sidebarItems = [
  { label: 'Dashboard', icon: Home, active: true },
  { label: 'Lead', icon: Users, showChevron: true },
  { label: 'Project Management', icon: FolderKanban, disabled: true },
  { label: 'Liaisoning & Commissioning', icon: ShieldCheck, disabled: true },
  { label: 'O&M', icon: Wrench, disabled: true },
  { label: 'Accounts', icon: ReceiptText, disabled: true },
  { label: 'Inventory', icon: Boxes, disabled: true },
  { label: 'Reports', icon: BarChart3, disabled: true },
  { label: 'Employee Management', icon: UsersRound, disabled: true },
  { label: 'Settings', icon: Settings, disabled: true },
];

const stats = [
  {
    title: 'Total Leads',
    value: '1,256',
    delta: '12% from last month',
    deltaTone: 'positive',
    icon: Users,
    iconBg: 'from-[#14c63b] to-[#27d56f]',
  },
  {
    title: 'Today Follow-ups',
    value: '28',
    delta: '8% from yesterday',
    deltaTone: 'positive',
    icon: CalendarDays,
    iconBg: 'from-[#1277ff] to-[#2aa7ff]',
  },
  {
    title: 'Pending Quotations',
    value: '64',
    delta: 'No change',
    deltaTone: 'neutral',
    icon: FileText,
    iconBg: 'from-[#4b49ef] to-[#7058ff]',
  },
  {
    title: 'Won Projects',
    value: '42',
    delta: '18% from last month',
    deltaTone: 'positive',
    icon: Trophy,
    iconBg: 'from-[#16c93f] to-[#39e264]',
  },
  {
    title: 'Revenue Overview',
    value: 'Rs 25.40L',
    delta: '15% from last month',
    deltaTone: 'positive',
    icon: IndianRupee,
    iconBg: 'from-[#1578ff] to-[#0ea5ff]',
  },
];

const todayFollowUps = [
  {
    customer: 'Amit Sharma',
    mobile: '9876543210',
    ivrs: 'IVRS123456',
    project: '5kW On-Grid',
    assignedTo: { name: 'Rohit Singh', initials: 'RS', tone: 'amber' },
    date: '20 May 2024',
  },
  {
    customer: 'Sunil Verma',
    mobile: '9123456780',
    ivrs: 'IVRS123457',
    project: '10kW On-Grid',
    assignedTo: { name: 'Neha Kumari', initials: 'NK', tone: 'sky' },
    date: '20 May 2024',
  },
  {
    customer: 'Pooja Mehta',
    mobile: '9988776655',
    ivrs: 'IVRS123458',
    project: '3kW On-Grid',
    assignedTo: { name: 'Rohit Singh', initials: 'RS', tone: 'amber' },
    date: '21 May 2024',
  },
  {
    customer: 'Rajesh Gupta',
    mobile: '8877665544',
    ivrs: 'IVRS123459',
    project: '7.5kW On-Grid',
    assignedTo: { name: 'Vikram Patel', initials: 'VP', tone: 'emerald' },
    date: '21 May 2024',
  },
  {
    customer: 'Manish Tiwari',
    mobile: '7766554433',
    ivrs: 'IVRS123460',
    project: '10kW On-Grid',
    assignedTo: { name: 'Neha Kumari', initials: 'NK', tone: 'sky' },
    date: '22 May 2024',
  },
];

const recentLeads = [
  {
    customer: 'Vikas Yadav',
    mobile: '9585858585',
    project: '5kW On-Grid',
    status: 'New',
    assignedTo: { name: 'Rohit Singh', initials: 'RS', tone: 'amber' },
    createdOn: '19 May 2024',
  },
  {
    customer: 'Anja Patel',
    mobile: '9696969696',
    project: '3kW On-Grid',
    status: 'Follow-up',
    assignedTo: { name: 'Neha Kumari', initials: 'NK', tone: 'sky' },
    createdOn: '19 May 2024',
  },
  {
    customer: 'Deepak Joshi',
    mobile: '7894561230',
    project: '10kW On-Grid',
    status: 'Quotation',
    assignedTo: { name: 'Vikram Patel', initials: 'VP', tone: 'emerald' },
    createdOn: '18 May 2024',
  },
  {
    customer: 'Kavita Rana',
    mobile: '8524567890',
    project: '7.5kW On-Grid',
    status: 'New',
    assignedTo: { name: 'Rohit Singh', initials: 'RS', tone: 'amber' },
    createdOn: '18 May 2024',
  },
  {
    customer: 'Suresh Kumar',
    mobile: '7418529630',
    project: '5kW On-Grid',
    status: 'Lost',
    assignedTo: { name: 'Neha Kumari', initials: 'NK', tone: 'sky' },
    createdOn: '17 May 2024',
  },
];

const overdueFollowUps = [
  { customer: 'Amit Sharma', project: '5kW On-Grid', delay: '2 Days Overdue' },
  { customer: 'Sunil Verma', project: '10kW On-Grid', delay: '2 Days Overdue' },
  { customer: 'Pooja Mehta', project: '3kW On-Grid', delay: '1 Day Overdue' },
  { customer: 'Rajesh Gupta', project: '7.5kW On-Grid', delay: '1 Day Overdue' },
  { customer: 'Manish Tiwari', project: '10kW On-Grid', delay: 'Today Overdue' },
];

const quickActions = [
  {
    label: 'Add Lead',
    icon: UserPlus,
    bg: 'from-[#17c53f] to-[#22d84d]',
  },
  {
    label: 'Add Follow-up',
    icon: ClipboardPlus,
    bg: 'from-[#1578ff] to-[#0a9ff5]',
  },
  {
    label: 'Create Quotation (UI)',
    icon: FilePlus2,
    bg: 'from-[#5242ef] to-[#6046eb]',
  },
];

const actionIcons = [
  { icon: Bell, badge: '5' },
  { icon: MessageSquareMore, badge: '3' },
];

const panelClass =
  'rounded-[16px] border border-[#e4ebf4] bg-white shadow-[0_10px_26px_rgba(17,39,84,0.055)]';

const tableHeaders = ['Customer Name', 'Mobile Number', 'IVRS Number', 'Project Name', 'Assigned To', 'Follow-up Date', 'Action'];
const recentHeaders = ['Customer Name', 'Mobile Number', 'Project Name', 'Status', 'Assigned To', 'Created On'];

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function App() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const sidebarNavRef = useRef(null);

  const updateSidebarScrollState = () => {
    const nav = sidebarNavRef.current;
    if (!nav) {
      return;
    }

    const maxScroll = nav.scrollHeight - nav.clientHeight;
    setCanScrollUp(nav.scrollTop > 8);
    setCanScrollDown(maxScroll - nav.scrollTop > 8);
  };

  const scrollSidebarBy = (delta) => {
    const nav = sidebarNavRef.current;
    if (!nav) {
      return;
    }

    nav.scrollBy({ top: delta, behavior: 'smooth' });
  };

  useEffect(() => {
    const nav = sidebarNavRef.current;
    if (!nav) {
      return undefined;
    }

    const handleUpdate = () => updateSidebarScrollState();
    updateSidebarScrollState();
    nav.addEventListener('scroll', handleUpdate, { passive: true });
    window.addEventListener('resize', handleUpdate);

    return () => {
      nav.removeEventListener('scroll', handleUpdate);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [desktopSidebarCollapsed, mobileSidebarOpen]);

  return (
    <div className="box-border min-h-screen overflow-x-hidden bg-[#f5f7fb] p-2 text-[#20345f] sm:p-3 md:p-4 xl:h-screen xl:overflow-hidden">
      <div className="mx-auto flex w-full gap-3 xl:h-full xl:items-stretch xl:gap-4">
        <div
          className={cx(
            'fixed inset-0 z-40 bg-[#10213d]/45 transition xl:hidden',
            mobileSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          onClick={() => setMobileSidebarOpen(false)}
        />

        <aside
          className={cx(
            'fixed inset-y-2 left-2 z-50 flex w-[236px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-[18px] border border-[#dfe7f2] bg-white shadow-[0_18px_40px_rgba(15,39,92,0.12)] transition-[transform,width] duration-300 xl:static xl:z-auto xl:h-full xl:min-h-0 xl:max-w-none xl:flex-none xl:self-stretch xl:translate-x-0',
            desktopSidebarCollapsed ? 'xl:w-[96px]' : 'xl:w-[clamp(224px,18vw,252px)]',
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-[110%] xl:translate-x-0',
          )}
        >
          <div className={cx('relative border-b border-[#e8eef6] py-3', desktopSidebarCollapsed ? 'px-3' : 'px-4')}>
            <div
              className={cx(
                'flex items-center',
                desktopSidebarCollapsed ? 'h-[62px] justify-center' : 'h-[66px] pr-14 xl:h-[62px] xl:pr-14',
              )}
            >
              {desktopSidebarCollapsed ? (
                <MiniBrandMark />
              ) : (
                <img
                  src={brandImage}
                  alt="Malwa Solar Energy CRM System"
                  className="block h-full w-full max-w-[188px] rounded-[6px] object-contain object-left"
                />
              )}
            </div>

            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-xl border border-[#e4ebf4] bg-white/95 text-[#52637f] shadow-[0_6px_14px_rgba(17,39,84,0.08)] xl:hidden"
              aria-label="Close sidebar"
            >
              <X className="size-4" />
            </button>

            <button
              type="button"
              onClick={() => setDesktopSidebarCollapsed((current) => !current)}
              className="absolute right-3 top-2 hidden size-11 items-center justify-center rounded-[14px] border border-[#dfe6f1] bg-[#f8fbff] text-[#6c7f9b] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_16px_rgba(17,39,84,0.08)] transition hover:text-[#2e4f83] xl:inline-flex"
              aria-label="Toggle sidebar menu"
            >
              <span className="translate-y-[-1px] text-[24px] font-extrabold leading-none">{'\u2630'}</span>
            </button>
          </div>

          <div className="flex flex-1 flex-col bg-[linear-gradient(180deg,#18c92f_0%,#14c84d_8%,#0fc79a_26%,#0ca9d8_49%,#0a8ce1_68%,#0b77df_84%,#0b6ddb_100%)] px-3 pb-3 pt-4">
            <div className="relative min-h-0 flex-1">
              <button
                type="button"
                onClick={() => scrollSidebarBy(-160)}
                disabled={!canScrollUp}
                className={cx(
                  'absolute left-1/2 top-0 z-10 inline-flex size-7 -translate-x-1/2 items-center justify-center rounded-full border border-white/35 bg-[#ffffff2a] text-white shadow-[0_8px_18px_rgba(0,44,104,0.26)] backdrop-blur-sm transition',
                  canScrollUp ? 'opacity-100 hover:bg-[#ffffff38]' : 'pointer-events-none opacity-35',
                )}
                aria-label="Scroll sidebar up"
              >
                <ChevronUp className="size-4" />
              </button>

              <nav ref={sidebarNavRef} className="scroll-soft sidebar-text-scroll h-full space-y-1.5 overflow-y-auto pb-10 pt-8">
                {sidebarItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.label}
                      type="button"
                      title={desktopSidebarCollapsed ? item.label : undefined}
                      aria-label={item.label}
                      className={cx(
                        'flex min-h-[46px] w-full items-center gap-3 rounded-[12px] border text-left transition',
                        desktopSidebarCollapsed ? 'justify-center px-0' : 'px-4',
                        item.active
                          ? 'border-[#56dd24] bg-[linear-gradient(90deg,#13c93a_0%,#48dd16_100%)] text-white shadow-[0_12px_22px_rgba(11,113,43,0.24)]'
                          : 'border-white/10 bg-white/[0.065] text-white/96 hover:bg-white/[0.09]',
                      )}
                    >
                      <Icon className="size-4.5 shrink-0" />
                      <span
                        className={cx(
                          'min-w-0 flex-1 text-[14px] font-semibold leading-tight',
                          desktopSidebarCollapsed && 'hidden',
                        )}
                      >
                        {item.label}
                      </span>
                      {item.disabled && !desktopSidebarCollapsed ? (
                        <span className="rounded-[7px] border border-white/8 bg-white/[0.17] px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.08em] text-white/78">
                          Disabled
                        </span>
                      ) : item.showChevron && !desktopSidebarCollapsed ? (
                        <ChevronRight className="size-4 shrink-0 text-white/90" />
                      ) : null}
                    </button>
                  );
                })}
              </nav>

              <button
                type="button"
                onClick={() => scrollSidebarBy(160)}
                disabled={!canScrollDown}
                className={cx(
                  'absolute bottom-0 left-1/2 z-10 inline-flex size-7 -translate-x-1/2 items-center justify-center rounded-full border border-white/35 bg-[#ffffff2a] text-white shadow-[0_8px_18px_rgba(0,44,104,0.26)] backdrop-blur-sm transition',
                  canScrollDown ? 'opacity-100 hover:bg-[#ffffff38]' : 'pointer-events-none opacity-35',
                )}
                aria-label="Scroll sidebar down"
              >
                <ChevronDown className="size-4" />
              </button>
            </div>

            {!desktopSidebarCollapsed ? (
              <div className="mt-4 rounded-[18px] border-[3px] border-white/85 bg-white/14 p-2 shadow-[0_18px_30px_rgba(7,49,115,0.2)]">
                <div className="overflow-hidden rounded-[14px] bg-white shadow-[inset_0_0_0_1px_rgba(219,232,245,0.9)]">
                  <img
                    src={headerImage}
                    alt="Solar panels"
                    className="h-[88px] w-full object-cover object-right"
                  />
                  <div className="p-4">
                    <p className="font-display text-[16px] font-extrabold leading-[1.12] text-[#284276]">
                      Powering a
                      <br />
                      Sustainable Future
                    </p>
                    <p className="mt-2 text-[12px] leading-5 text-[#66748f]">
                      One Solar Solution
                      <br />
                      at a Time
                      <Leaf className="ml-1 inline size-3.5 translate-y-[-1px] text-[#19c35a]" />
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </aside>

        <main className="min-w-0 flex-1 xl:min-h-0 xl:self-stretch xl:overflow-y-auto xl:pr-1">
          <div className="space-y-3 xl:pb-2">
            <header className={`${panelClass} px-3 py-3 sm:px-4`}>
              <div className="grid gap-3 lg:grid-cols-[44px_minmax(0,1fr)] xl:grid-cols-[44px_326px_minmax(0,1fr)_auto] xl:items-center">
                <div className="flex items-center justify-between gap-3 lg:contents">
                  <button
                    type="button"
                    onClick={() => setMobileSidebarOpen(true)}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-[12px] border border-[#dfe7f2] bg-white text-[#52637f] transition hover:border-[#cfdbee] hover:text-[#2158d6] xl:hidden"
                    aria-label="Open sidebar"
                  >
                    <Menu className="size-5" />
                  </button>

                  <div className="flex flex-wrap items-center justify-end gap-3 lg:hidden">
                    {actionIcons.map((action) => {
                      const Icon = action.icon;

                      return (
                        <button
                          key={`mobile-${action.badge}-${Icon.displayName ?? Icon.name}`}
                          type="button"
                          className="relative inline-flex size-10 items-center justify-center rounded-full bg-transparent text-[#5a6d88] transition hover:text-[#2158d6]"
                        >
                          <Icon className="size-[18px]" />
                          <span className="absolute right-0.5 top-0.5 inline-flex min-w-[17px] items-center justify-center rounded-full bg-[#ff4b4f] px-1 text-[10px] font-extrabold text-white">
                            {action.badge}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="flex h-11 items-center rounded-[10px] border border-[#dfe7f2] bg-[#fbfcff] px-4 lg:col-span-1 xl:col-span-1">
                  <Search className="size-4 text-[#7486a3]" />
                  <input
                    type="search"
                    placeholder="Search leads, customers, projects..."
                    className="h-full w-full bg-transparent px-3 text-[14px] font-semibold text-[#30466d] outline-none placeholder:font-medium placeholder:text-[#8ea0ba]"
                  />
                </label>

                <div className="header-banner relative min-w-0 overflow-hidden rounded-[10px] border border-[#e5edf6] bg-white p-1 lg:col-span-2 xl:col-span-1">
                  <img
                    src={headerImage}
                    alt="Solar header"
                    className="h-[52px] w-full rounded-[8px] object-cover object-center sm:h-[58px]"
                  />
                </div>

                <div className="hidden flex-wrap items-center justify-between gap-3 lg:col-span-2 lg:flex xl:col-span-1 xl:justify-end">
                  {actionIcons.map((action) => {
                    const Icon = action.icon;

                    return (
                      <button
                        key={`${action.badge}-${Icon.displayName ?? Icon.name}`}
                        type="button"
                        className="relative inline-flex size-10 items-center justify-center rounded-full bg-transparent text-[#5a6d88] transition hover:text-[#2158d6]"
                      >
                        <Icon className="size-[18px]" />
                        <span className="absolute right-0.5 top-0.5 inline-flex min-w-[17px] items-center justify-center rounded-full bg-[#ff4b4f] px-1 text-[10px] font-extrabold text-white">
                          {action.badge}
                        </span>
                      </button>
                    );
                  })}

                  <div className="ml-auto flex items-center gap-2.5 sm:gap-3">
                    <AdminAvatar />
                    <div className="text-right">
                      <p className="text-[15px] font-extrabold leading-tight text-[#263d72]">Admin</p>
                      <p className="mt-0.5 text-[12px] font-semibold text-[#7585a2]">Super Admin</p>
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {stats.map((stat) => (
                <StatCard key={stat.title} stat={stat} />
              ))}
            </section>

            <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
              <article className={`${panelClass} p-3 sm:p-4`}>
                <SectionHeader icon={CalendarDays} title="Today Follow-ups" />

                <div className="mt-4 space-y-3 lg:hidden">
                  {todayFollowUps.map((followUp) => (
                    <FollowUpCard key={`${followUp.customer}-${followUp.ivrs}`} followUp={followUp} />
                  ))}
                </div>

                <div className="mt-4 hidden overflow-hidden rounded-[14px] border border-[#eaf0f7] lg:block">
                  <div className="overflow-x-auto">
                    <table className="crm-table min-w-[760px] w-full">
                      <thead>
                        <tr>
                          {tableHeaders.map((header) => (
                            <th key={header}>{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {todayFollowUps.map((followUp) => (
                          <tr key={`${followUp.customer}-${followUp.ivrs}`}>
                            <td className="font-bold text-[#274072]">{followUp.customer}</td>
                            <td>{followUp.mobile}</td>
                            <td>{followUp.ivrs}</td>
                            <td className="font-bold text-[#274072]">{followUp.project}</td>
                            <td>
                              <AssigneeCell assignee={followUp.assignedTo} compact />
                            </td>
                            <td className="font-bold text-[#ea5a4c]">{followUp.date}</td>
                            <td className="text-right">
                              <button
                                type="button"
                                className="inline-flex size-8 items-center justify-center rounded-[8px] border border-[#e3ebf7] bg-white text-[#3480ff] transition hover:bg-[#f5f9ff]"
                                aria-label={`View ${followUp.customer}`}
                              >
                                <Eye className="size-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-[10px] border border-[#d8e4f4] bg-white px-5 py-2.5 text-[13px] font-extrabold text-[#2a64dd] shadow-[0_8px_18px_rgba(17,39,84,0.06)] transition hover:bg-[#f8fbff]"
                  >
                    View All Follow-ups
                    <ArrowRight className="size-4" />
                  </button>
                </div>
              </article>

              <aside className={`${panelClass} p-3 sm:p-4`}>
                <SectionHeader icon={Zap} title="Quick Actions" iconTone="success" />

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  {quickActions.map((action) => {
                    const Icon = action.icon;

                    return (
                      <button
                        key={action.label}
                        type="button"
                        className={cx(
                          'flex w-full items-center justify-between rounded-[12px] bg-gradient-to-r px-4 py-4 text-left text-white shadow-[0_12px_24px_rgba(22,65,145,0.18)] transition hover:brightness-[1.03] sm:min-h-[92px] xl:min-h-0',
                          action.bg,
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <span className="flex size-9 items-center justify-center rounded-[10px] bg-white/12 ring-1 ring-white/25">
                            <Icon className="size-4.5" />
                          </span>
                          <span className="text-[14px] font-extrabold">{action.label}</span>
                        </span>
                        <ArrowRight className="size-4.5" />
                      </button>
                    );
                  })}
                </div>
              </aside>
            </section>

            <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
              <article className={`${panelClass} p-3 sm:p-4`}>
                <SectionHeader icon={Users} title="Recent Leads" actionLabel="View All" />

                <div className="mt-4 space-y-3 lg:hidden">
                  {recentLeads.map((lead) => (
                    <RecentLeadCard key={`${lead.customer}-${lead.mobile}`} lead={lead} />
                  ))}
                </div>

                <div className="mt-4 hidden overflow-hidden rounded-[14px] border border-[#eaf0f7] lg:block">
                  <div className="overflow-x-auto">
                    <table className="crm-table min-w-[700px] w-full">
                      <thead>
                        <tr>
                          {recentHeaders.map((header) => (
                            <th key={header}>{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {recentLeads.map((lead) => (
                          <tr key={`${lead.customer}-${lead.mobile}`}>
                            <td className="font-bold text-[#3258aa]">{lead.customer}</td>
                            <td>{lead.mobile}</td>
                            <td>{lead.project}</td>
                            <td>
                              <StatusBadge status={lead.status} />
                            </td>
                            <td>
                              <AssigneeCell assignee={lead.assignedTo} />
                            </td>
                            <td>{lead.createdOn}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </article>

              <aside className={`${panelClass} p-3 sm:p-4`}>
                <SectionHeader icon={Clock3} title="Overdue Follow-ups" actionLabel="View All" iconTone="danger" />

                <div className="mt-4 divide-y divide-[#eef3f8] rounded-[14px] border border-[#eaf0f7] bg-white px-4">
                  {overdueFollowUps.map((item) => (
                    <div
                      key={`${item.customer}-${item.project}`}
                      className="grid grid-cols-1 gap-1 py-4 text-[13px] sm:grid-cols-[1.2fr_1fr_auto] sm:items-center sm:gap-3"
                    >
                      <p className="font-bold text-[#274072]">{item.customer}</p>
                      <p className="font-semibold text-[#4e6282]">{item.project}</p>
                      <p className="font-extrabold text-[#ea5a4c] sm:text-right">{item.delay}</p>
                    </div>
                  ))}
                </div>
              </aside>
            </section>

            <footer className="flex flex-col gap-2 px-1 pb-1 text-center text-[12px] font-semibold text-[#7b88a2] sm:text-left lg:flex-row lg:items-center lg:justify-between">
              <p>Copyright 2024 Malwa Solar CRM. All rights reserved.</p>
              <p className="inline-flex items-center justify-center gap-1.5 lg:justify-end">
                Made with
                <Heart className="size-3.5 fill-current text-[#ff4b4f]" />
                for a Sustainable Future
                <Leaf className="size-3.5 text-[#1bc35f]" />
              </p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

function StatCard({ stat }) {
  const Icon = stat.icon;

  return (
    <article className={`${panelClass} flex min-h-[102px] items-center gap-3 px-3 py-4 sm:gap-4 sm:px-4`}>
      <div
        className={cx(
          'flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-[0_12px_24px_rgba(24,86,190,0.18)] sm:size-[52px]',
          stat.iconBg,
        )}
      >
        <Icon className="size-[22px] sm:size-[24px]" />
      </div>

      <div className="min-w-0">
        <p className="text-[12px] font-extrabold text-[#263d72] sm:text-[13px]">{stat.title}</p>
        <p className="mt-1 font-display text-[20px] font-extrabold leading-none text-[#223768] sm:text-[22px]">
          {stat.value}
        </p>
        <div
          className={cx(
            'mt-3 inline-flex items-center gap-1 text-[10px] font-extrabold sm:text-[11px]',
            stat.deltaTone === 'positive' ? 'text-[#1db15f]' : 'text-[#8895ab]',
          )}
        >
          {stat.deltaTone === 'positive' ? (
            <ArrowUpRight className="size-3.5" />
          ) : (
            <Minus className="size-3.5" />
          )}
          <span>{stat.delta}</span>
        </div>
      </div>
    </article>
  );
}

function SectionHeader({ icon: Icon, title, actionLabel, iconTone = 'primary' }) {
  const iconClass =
    {
      primary: 'text-[#2d67e1]',
      success: 'text-[#1ab959]',
      danger: 'text-[#ef5a4b]',
    }[iconTone] ?? 'text-[#2d67e1]';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <Icon className={cx('size-[18px]', iconClass)} />
        <h2 className="font-display text-[16px] font-extrabold text-[#223768]">{title}</h2>
      </div>

      {actionLabel ? (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-[#2d67e1] transition hover:opacity-80"
        >
          {actionLabel}
          <ArrowRight className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

function AssigneeCell({ assignee, compact = false }) {
  return (
    <span className={cx('inline-flex items-center gap-2', compact ? 'text-[12px]' : 'text-[13px]')}>
      <PersonAvatar tone={assignee.tone} initials={assignee.initials} />
      <span className="font-bold text-[#314a79]">{assignee.name}</span>
    </span>
  );
}

function StatusBadge({ status }) {
  const classes =
    {
      New: 'bg-[#e8f8eb] text-[#18a34a]',
      'Follow-up': 'bg-[#e8f2ff] text-[#3170e0]',
      Quotation: 'bg-[#fff0dc] text-[#f39b20]',
      Lost: 'bg-[#ffe9e6] text-[#e2594c]',
    }[status] ?? 'bg-[#eff3f8] text-[#64748b]';

  return (
    <span className={cx('inline-flex rounded-[8px] px-2.5 py-1 text-[11px] font-extrabold', classes)}>
      {status}
    </span>
  );
}

const avatarToneMap = {
  amber: 'bg-[linear-gradient(135deg,#f7a11a,#f97316)]',
  sky: 'bg-[linear-gradient(135deg,#1f8dff,#3767ff)]',
  emerald: 'bg-[linear-gradient(135deg,#19b55a,#0ea5a4)]',
};

function MiniBrandMark() {
  return (
    <div className="grid size-[52px] place-items-center rounded-[16px] border border-[#e5edf7] bg-white shadow-[0_10px_24px_rgba(17,39,84,0.08)]">
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

function AdminAvatar() {
  return (
    <div className="grid size-11 place-items-center overflow-hidden rounded-full border-[3px] border-[#f2d27a] bg-white shadow-[0_8px_18px_rgba(40,66,118,0.14)]">
      <svg viewBox="0 0 44 44" className="size-full" aria-hidden="true">
        <rect width="44" height="44" rx="22" fill="#f7f3ea" />
        <path d="M10 44c1-7 5-11 12-11s11 4 12 11" fill="#1f4e8c" />
        <circle cx="22" cy="18" r="9" fill="#f1bf8b" />
        <path d="M13 17c0-7 4-11 9-11 5 0 10 4 10 12-2-1-3-3-4-5-2 2-5 4-10 4-2 0-4 0-5 0z" fill="#2b251d" />
        <circle cx="18.5" cy="18.5" r="0.9" fill="#33261e" />
        <circle cx="25.5" cy="18.5" r="0.9" fill="#33261e" />
        <path d="M19 23c2 1 4 1 6 0" stroke="#c86f5f" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function PersonAvatar({ tone, initials }) {
  const shirt =
    {
      amber: '#f59e0b',
      sky: '#2563eb',
      emerald: '#10b981',
    }[tone] ?? '#64748b';

  const hair =
    {
      amber: '#2d241d',
      sky: '#3a2e25',
      emerald: '#1f1a16',
    }[tone] ?? '#2d241d';

  return (
    <span className={cx('grid size-7 place-items-center overflow-hidden rounded-full shadow-[0_6px_12px_rgba(33,54,93,0.16)]', avatarToneMap[tone])}>
      <svg viewBox="0 0 28 28" className="size-full" aria-label={initials}>
        <rect width="28" height="28" rx="14" fill="#ffffff" fillOpacity="0.08" />
        <path d="M6 28c1-4.5 4-7 8-7s7 2.5 8 7" fill={shirt} />
        <circle cx="14" cy="12" r="5.5" fill="#f3c18f" />
        <path d="M8.7 11.7c0-4.7 2.4-7.7 5.8-7.7 3.7 0 6.6 2.9 6.1 8-1-1.2-2.2-2-3.3-2.8-.9 1-2.9 2.3-5.8 2.5-.8 0-1.8 0-2.8 0z" fill={hair} />
        <circle cx="12.2" cy="12.2" r="0.55" fill="#2a201a" />
        <circle cx="15.9" cy="12.2" r="0.55" fill="#2a201a" />
      </svg>
    </span>
  );
}

function FollowUpCard({ followUp }) {
  return (
    <article className="rounded-[14px] border border-[#e8eef6] bg-white p-4 shadow-[0_10px_22px_rgba(17,39,84,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-extrabold text-[#274072]">{followUp.customer}</p>
          <p className="mt-1 text-[12px] font-bold text-[#6f7f98]">{followUp.project}</p>
        </div>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-[8px] border border-[#e3ebf7] bg-white text-[#3480ff]"
          aria-label={`View ${followUp.customer}`}
        >
          <Eye className="size-4" />
        </button>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 text-[12px] min-[420px]:grid-cols-2">
        <InfoCell label="Mobile" value={followUp.mobile} />
        <InfoCell label="IVRS" value={followUp.ivrs} />
        <InfoCell label="Assigned To" valueNode={<AssigneeCell assignee={followUp.assignedTo} compact />} />
        <InfoCell label="Follow-up Date" value={followUp.date} valueClass="text-[#ea5a4c]" />
      </div>
    </article>
  );
}

function RecentLeadCard({ lead }) {
  return (
    <article className="rounded-[14px] border border-[#e8eef6] bg-white p-4 shadow-[0_10px_22px_rgba(17,39,84,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-extrabold text-[#3258aa]">{lead.customer}</p>
          <p className="mt-1 text-[12px] font-bold text-[#6f7f98]">{lead.project}</p>
        </div>
        <StatusBadge status={lead.status} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 text-[12px] min-[420px]:grid-cols-2">
        <InfoCell label="Mobile" value={lead.mobile} />
        <InfoCell label="Created On" value={lead.createdOn} />
        <InfoCell label="Assigned To" valueNode={<AssigneeCell assignee={lead.assignedTo} compact />} />
      </div>
    </article>
  );
}

function InfoCell({ label, value, valueNode, valueClass }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#8a98af]">{label}</p>
      {valueNode ? (
        <div className="mt-1.5 min-w-0">{valueNode}</div>
      ) : (
        <p className={cx('mt-1.5 truncate text-[12px] font-bold text-[#314a79]', valueClass)}>{value}</p>
      )}
    </div>
  );
}

export default App;
