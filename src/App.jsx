import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Boxes,
  CalendarDays,
  ChevronRight,
  ClipboardPlus,
  Clock3,
  ChevronLeft,
  Eye,
  Download,
  Flag,
  FilePlus2,
  FileText,
  FolderKanban,
  Heart,
  Home,
  IndianRupee,
  Leaf,
  LockKeyhole,
  LogIn,
  Mail,
  MapPin,
  Menu,
  MessageSquareMore,
  Minus,
  MoreVertical,
  Plus,
  Save,
  ReceiptText,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Trophy,
  LogOut,
  UserPlus,
  UserRound,
  Users,
  UsersRound,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import headerImage from '../Data/header_image.png';
import signInBgImage from './assets/data/Sign_in_bg_hd.png';

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
  { label: 'AMC & Warranty', icon: ShieldCheck },
  { label: 'Settings', icon: Settings, disabled: true },
];

const leadSubItems = ['Lead List', 'Create Lead'];

const leadSubRoutes = {
  'Lead List': '/lead/list',
  'Create Lead': '/lead/create',
};

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

const leadListRows = [
  {
    customer: 'Amit Sharma',
    mobile: '9876543210',
    ivrs: 'IVRS123456',
    project: '5kW On-Grid',
    type: 'On-Grid',
    status: 'Follow-up',
    assignedTo: { name: 'Rohit Singh', initials: 'RS', tone: 'amber' },
    nextFollowUp: '20 May 2024',
  },
  {
    customer: 'Sunil Verma',
    mobile: '9123456780',
    ivrs: 'IVRS123457',
    project: '10kW On-Grid',
    type: 'On-Grid',
    status: 'Follow-up',
    assignedTo: { name: 'Neha Kumari', initials: 'NK', tone: 'sky' },
    nextFollowUp: '20 May 2024',
  },
  {
    customer: 'Pooja Mehta',
    mobile: '9988776655',
    ivrs: 'IVRS123458',
    project: '3kW On-Grid',
    type: 'On-Grid',
    status: 'New',
    assignedTo: { name: 'Rohit Singh', initials: 'RS', tone: 'amber' },
    nextFollowUp: '21 May 2024',
  },
  {
    customer: 'Rajesh Gupta',
    mobile: '8877665544',
    ivrs: 'IVRS123459',
    project: '7.5kW On-Grid',
    type: 'On-Grid',
    status: 'Follow-up',
    assignedTo: { name: 'Vikram Patel', initials: 'VP', tone: 'emerald' },
    nextFollowUp: '21 May 2024',
  },
  {
    customer: 'Manish Tiwari',
    mobile: '7766554433',
    ivrs: 'IVRS123460',
    project: '10kW On-Grid',
    type: 'On-Grid',
    status: 'New',
    assignedTo: { name: 'Neha Kumari', initials: 'NK', tone: 'sky' },
    nextFollowUp: '22 May 2024',
  },
  {
    customer: 'Deepak Joshi',
    mobile: '7894561230',
    ivrs: 'IVRS123461',
    project: '10kW On-Grid',
    type: 'On-Grid',
    status: 'Quotation',
    assignedTo: { name: 'Vikram Patel', initials: 'VP', tone: 'emerald' },
    nextFollowUp: '23 May 2024',
  },
  {
    customer: 'Anjali Patel',
    mobile: '9696969696',
    ivrs: 'IVRS123462',
    project: '3kW On-Grid',
    type: 'On-Grid',
    status: 'Follow-up',
    assignedTo: { name: 'Neha Kumari', initials: 'NK', tone: 'sky' },
    nextFollowUp: '23 May 2024',
  },
  {
    customer: 'Vikas Yadav',
    mobile: '9585836585',
    ivrs: 'IVRS123463',
    project: '5kW On-Grid',
    type: 'On-Grid',
    status: 'New',
    assignedTo: { name: 'Rohit Singh', initials: 'RS', tone: 'amber' },
    nextFollowUp: '24 May 2024',
  },
  {
    customer: 'Kavita Rana',
    mobile: '8524567890',
    ivrs: 'IVRS123464',
    project: '7.5kW On-Grid',
    type: 'On-Grid',
    status: 'Follow-up',
    assignedTo: { name: 'Rohit Singh', initials: 'RS', tone: 'amber' },
    nextFollowUp: '24 May 2024',
  },
  {
    customer: 'Suresh Kumar',
    mobile: '7418529630',
    ivrs: 'IVRS123465',
    project: '5kW On-Grid',
    type: 'On-Grid',
    status: 'Lost',
    assignedTo: { name: 'Neha Kumari', initials: 'NK', tone: 'sky' },
    nextFollowUp: '25 May 2024',
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
  { icon: Bell, badge: '5', label: 'Notifications' },
  { icon: MessageSquareMore, badge: '3', label: 'Messages' },
];

const panelClass =
  'rounded-[14px] border border-[#dbe5f2] bg-white/90 shadow-[0_12px_28px_rgba(24,48,87,0.07)] backdrop-blur-sm';

const dataPanelClass =
  'overflow-hidden rounded-[14px] border border-[#dbe5f2] bg-white/75 shadow-[0_14px_32px_rgba(24,48,87,0.08)] backdrop-blur-md';

const tableHeaders = ['Customer Name', 'Mobile Number', 'IVRS Number', 'Project Name', 'Assigned To', 'Follow-up Date', 'Action'];
const recentHeaders = ['Customer Name', 'Mobile Number', 'Project Name', 'Status', 'Assigned To', 'Created On'];

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function App() {
  const [currentPage, setCurrentPage] = useState('signin');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [activeSidebarItem, setActiveSidebarItem] = useState('Dashboard');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const notify = (message) => {
    setToast({ id: Date.now(), message });
  };

  const handleProfileAction = (action) => {
    setProfileMenuOpen(false);
    if (action === 'Sign in') {
      setCurrentPage('signin');
      notify('Sign in opened');
      return;
    }

    if (action === 'Logout') {
      setCurrentPage('signin');
      notify('Logged out');
      return;
    }

    notify(`${action} selected`);
  };

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (currentPage === 'signin') {
    return (
      <>
        <SignInPage
          onLogin={() => {
            setCurrentPage('dashboard');
            notify('Dashboard opened');
          }}
          onNotify={notify}
        />
        <Toast toast={toast} />
      </>
    );
  }

  return (
    <div className="box-border min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#f3f7fb_56%,#eef4f8_100%)] p-2 text-[#20345f] sm:p-3 md:p-4 xl:h-screen xl:overflow-hidden">
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
            'fixed inset-y-2 left-2 z-50 flex w-[236px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-[20px] border border-[#dfe7f2] border-r-white/10 bg-white shadow-xl shadow-[0_18px_40px_rgba(15,39,92,0.12)] transition-[transform,width] duration-300 xl:static xl:z-auto xl:h-full xl:min-h-0 xl:max-w-none xl:flex-none xl:self-stretch xl:translate-x-0',
            desktopSidebarCollapsed ? 'xl:w-[84px]' : 'xl:w-[236px]',
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-[110%] xl:translate-x-0',
          )}
        >
          <div
            className={cx(
              'relative shrink-0 border-b border-[#e8eef6] bg-white',
              desktopSidebarCollapsed ? 'px-3 py-4' : 'px-4 py-3',
            )}
          >
            <div className={cx('flex items-center', desktopSidebarCollapsed ? 'h-[58px] justify-center' : 'h-[58px]')}>
              {desktopSidebarCollapsed ? <MiniBrandMark compact /> : <BrandLockup />}
            </div>

            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="absolute right-3 top-4 inline-flex size-9 items-center justify-center rounded-[12px] border border-[#e4ebf4] bg-white/95 text-[#52637f] shadow-[0_6px_14px_rgba(17,39,84,0.08)] xl:hidden"
              aria-label="Close sidebar"
            >
              <X className="size-4" />
            </button>

          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden rounded-t-[14px] bg-[linear-gradient(180deg,#09b83f_0%,#0799a7_42%,#075fc2_100%)]">
            <div className="scroll-soft sidebar-menu-scroll h-full overflow-y-auto px-4 py-4">
              <nav className="space-y-0.5">
                {sidebarItems.map((item) => {
                  const Icon = item.icon;
                  const isLeadSection = item.label === 'Lead';
                  const isLeadOpen = isLeadSection && (activeSidebarItem === 'Lead' || leadSubItems.includes(activeSidebarItem));
                  const isActive = item.label === activeSidebarItem || isLeadOpen;

                  return (
                    <div key={item.label}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSidebarItem(isLeadSection ? 'Lead List' : item.label);
                          setMobileSidebarOpen(false);
                          notify(`${isLeadSection ? 'Lead List' : item.label} section selected`);
                        }}
                        title={desktopSidebarCollapsed ? item.label : undefined}
                        aria-label={item.label}
                        aria-current={isActive ? 'page' : undefined}
                        className={cx(
                          'group flex min-h-[43px] w-full items-center gap-3 border text-left transition duration-200',
                          desktopSidebarCollapsed ? 'justify-center px-0' : 'px-4',
                          isActive
                            ? 'min-h-[40px] rounded-[8px] border-[#36d95b]/75 bg-[linear-gradient(90deg,#07913a_0%,#23cf2b_100%)] text-white shadow-[0_8px_14px_rgba(3,83,55,0.22)]'
                            : 'rounded-[3px] border-transparent bg-transparent text-white hover:border-white/10 hover:bg-white/[0.08]',
                        )}
                      >
                        <Icon className="size-[17px] shrink-0 transition group-hover:scale-105" />
                        <span
                          className={cx(
                            'min-w-0 flex-1 text-[13px] font-bold leading-tight',
                            desktopSidebarCollapsed && 'hidden',
                          )}
                        >
                          {item.label}
                        </span>
                        {item.showChevron && !desktopSidebarCollapsed ? (
                          <ChevronRight className={cx('size-4 shrink-0 text-white/90 transition', isLeadOpen && '-rotate-90')} />
                        ) : null}
                      </button>
                      {isLeadOpen && !desktopSidebarCollapsed ? (
                        <div className="my-2 rounded-[8px] bg-white px-4 py-3 shadow-[0_12px_24px_rgba(8,65,119,0.16)]">
                          <div className="space-y-1">
                            {leadSubItems.map((subItem) => {
                              const isSubActive = activeSidebarItem === subItem;

                              return (
                                <button
                                  key={subItem}
                                  type="button"
                                  data-route={leadSubRoutes[subItem]}
                                  onClick={() => {
                                    setActiveSidebarItem(subItem);
                                    setMobileSidebarOpen(false);
                                    notify(`${subItem} opened. Route can be connected later.`);
                                  }}
                                  className={cx(
                                    'flex w-full items-center gap-3 rounded-[7px] px-2 py-2 text-left text-[12px] font-bold transition',
                                    isSubActive ? 'text-[#078c3e]' : 'text-[#53647f] hover:bg-[#f5f9ff] hover:text-[#234069]',
                                  )}
                                >
                                  <span
                                    className={cx(
                                      'size-1.5 rounded-full',
                                      isSubActive ? 'bg-[#14b84c]' : 'bg-[#b9c4d6]',
                                    )}
                                  />
                                  <span>{subItem}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </nav>

              {!desktopSidebarCollapsed ? (
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage('signin');
                    notify('Logged out');
                  }}
                  className="mt-12 flex min-h-[43px] w-full items-center gap-3 rounded-[8px] border border-white/12 bg-white/[0.09] px-4 text-left text-white transition hover:border-white/20 hover:bg-white/[0.14]"
                >
                  <LogOut className="size-[17px] shrink-0" />
                  <span className="min-w-0 flex-1 text-[13px] font-bold leading-tight">Logout</span>
                </button>
              ) : null}
            </div>

          </div>
        </aside>

        <main className="min-w-0 flex-1 xl:min-h-0 xl:self-stretch xl:overflow-y-auto xl:pr-1">
          <div className="space-y-4 xl:pb-3">
            <header className={`${panelClass} relative z-30 overflow-visible px-3 py-3 sm:px-4`}>
              <div className="grid gap-3 lg:grid-cols-[44px_minmax(0,1fr)] xl:grid-cols-[44px_326px_minmax(0,1fr)_auto] xl:items-center">
                <div className="flex items-center justify-between gap-3 lg:contents">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileSidebarOpen(true);
                      notify('Sidebar opened');
                    }}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-[12px] border border-[#dfe7f2] bg-white text-[#52637f] transition hover:border-[#cfdbee] hover:text-[#2158d6] xl:hidden"
                    aria-label="Open sidebar"
                  >
                    <Menu className="size-5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDesktopSidebarCollapsed((current) => {
                        const next = !current;
                        notify(next ? 'Sidebar collapsed' : 'Sidebar expanded');
                        return next;
                      });
                    }}
                    className="hidden size-10 shrink-0 items-center justify-center rounded-[8px] bg-transparent text-[#52637f] transition hover:bg-[#f7faff] hover:text-[#244c7e] xl:inline-flex"
                    aria-label="Toggle sidebar menu"
                  >
                    <Menu className="size-[21px]" />
                  </button>

                  <div className="flex flex-wrap items-center justify-end gap-3 lg:hidden">
                    {actionIcons.map((action) => {
                      const Icon = action.icon;

                    return (
                      <button
                        key={`mobile-${action.label}`}
                        type="button"
                        onClick={() => notify(`${action.label} opened`)}
                        className="relative inline-flex size-10 items-center justify-center rounded-full bg-transparent text-[#5a6d88] transition hover:text-[#2158d6]"
                        aria-label={action.label}
                      >
                          <Icon className="size-[18px]" />
                          <span className="absolute right-0.5 top-0.5 inline-flex min-w-[17px] items-center justify-center rounded-full bg-[#ff4b4f] px-1 text-[10px] font-extrabold text-white">
                            {action.badge}
                          </span>
                        </button>
                      );
                    })}

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setProfileMenuOpen((current) => !current)}
                        className="rounded-full transition hover:scale-[1.02]"
                        aria-label="Open profile menu"
                        aria-expanded={profileMenuOpen}
                      >
                        <AdminAvatar />
                      </button>

                      {profileMenuOpen ? (
                        <div className="absolute right-0 top-[calc(100%+10px)] z-[70] w-[176px] overflow-hidden rounded-[12px] border border-[#dce7f5] bg-white shadow-[0_18px_34px_rgba(21,43,83,0.16)]">
                          {['Sign in', 'Sign up', 'Logout'].map((item) => (
                            <button
                              key={`mobile-${item}`}
                              type="button"
                              onClick={() => handleProfileAction(item)}
                              className="block w-full px-4 py-3 text-left text-[13px] font-extrabold text-[#263d72] transition hover:bg-[#f5f9ff]"
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <label className="flex h-11 items-center rounded-[10px] border border-black/20 bg-[#fbfcff] px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 lg:col-span-1 xl:col-span-1">
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
                        key={action.label}
                        type="button"
                        onClick={() => notify(`${action.label} opened`)}
                        className="relative inline-flex size-10 items-center justify-center rounded-full bg-transparent text-[#5a6d88] transition hover:text-[#2158d6]"
                        aria-label={action.label}
                      >
                        <Icon className="size-[18px]" />
                        <span className="absolute right-0.5 top-0.5 inline-flex min-w-[17px] items-center justify-center rounded-full bg-[#ff4b4f] px-1 text-[10px] font-extrabold text-white">
                          {action.badge}
                        </span>
                      </button>
                    );
                  })}

                  <div className="relative ml-auto">
                    <button
                      type="button"
                      onClick={() => setProfileMenuOpen((current) => !current)}
                      className="flex items-center gap-2.5 rounded-[12px] px-2 py-1.5 text-left transition hover:bg-[#f5f9ff] sm:gap-3"
                      aria-label="Open profile menu"
                      aria-expanded={profileMenuOpen}
                    >
                      <AdminAvatar />
                      <div className="text-right">
                        <p className="text-[15px] font-extrabold leading-tight text-[#263d72]">Admin</p>
                        <p className="mt-0.5 text-[12px] font-semibold text-[#7585a2]">Super Admin</p>
                      </div>
                      <ChevronRight
                        className={cx(
                          'size-4 text-[#7a8aa4] transition',
                          profileMenuOpen && 'rotate-90 text-[#2d67e1]',
                        )}
                      />
                    </button>

                    {profileMenuOpen ? (
                      <div className="absolute right-0 top-[calc(100%+10px)] z-[70] w-[176px] overflow-hidden rounded-[12px] border border-[#dce7f5] bg-white shadow-[0_18px_34px_rgba(21,43,83,0.16)]">
                        {['Sign in', 'Sign up', 'Logout'].map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => handleProfileAction(item)}
                            className="block w-full px-4 py-3 text-left text-[13px] font-extrabold text-[#263d72] transition hover:bg-[#f5f9ff]"
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </header>

            {activeSidebarItem === 'Lead List' ? (
              <LeadListPage
                onCreateLead={() => {
                  setActiveSidebarItem('Create Lead');
                  notify('Create Lead opened');
                }}
                onNotify={notify}
              />
            ) : activeSidebarItem === 'Create Lead' ? (
              <CreateLeadPage
                onCancel={() => {
                  setActiveSidebarItem('Lead List');
                  notify('Lead List opened');
                }}
                onDashboard={() => {
                  setActiveSidebarItem('Dashboard');
                  notify('Dashboard opened');
                }}
                onNotify={notify}
              />
            ) : (
              <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {stats.map((stat) => (
                <StatCard key={stat.title} stat={stat} />
              ))}
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
              <article className={dataPanelClass}>
                <SectionHeader icon={CalendarDays} title="Today Follow-ups" />

                <div className="space-y-3 p-4 lg:hidden">
                  {todayFollowUps.map((followUp) => (
                    <FollowUpCard
                      key={`${followUp.customer}-${followUp.ivrs}`}
                      followUp={followUp}
                      onView={() => notify(`${followUp.customer} follow-up opened`)}
                    />
                  ))}
                </div>

                <div className="mx-4 mt-4 hidden overflow-hidden rounded-[12px] border border-[#e5edf6] bg-white lg:block">
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
                                onClick={() => notify(`${followUp.customer} follow-up opened`)}
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

                <div className="flex justify-center px-4 py-4">
                  <button
                    type="button"
                    onClick={() => notify('All follow-ups opened')}
                    className="inline-flex items-center gap-2 rounded-[10px] border border-[#d8e4f4] bg-white px-5 py-2.5 text-[13px] font-extrabold text-[#2a64dd] shadow-[0_8px_18px_rgba(17,39,84,0.06)] transition hover:bg-[#f8fbff]"
                  >
                    View All Follow-ups
                    <ArrowRight className="size-4" />
                  </button>
                </div>
              </article>

              <aside className={`${panelClass} overflow-hidden`}>
                <SectionHeader icon={Zap} title="Quick Actions" iconTone="success" />

                <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-1">
                  {quickActions.map((action) => {
                    const Icon = action.icon;

                    return (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => notify(`${action.label} action started`)}
                        className={cx(
                          'flex w-full items-center justify-between rounded-[10px] bg-gradient-to-r px-4 py-4 text-left text-white shadow-[0_12px_24px_rgba(22,65,145,0.16)] transition hover:-translate-y-0.5 hover:brightness-[1.03] sm:min-h-[92px] xl:min-h-0',
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

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <article className={dataPanelClass}>
                <SectionHeader icon={Users} title="Recent Leads" actionLabel="View All" onAction={() => notify('All recent leads opened')} />

                <div className="space-y-3 p-4 lg:hidden">
                  {recentLeads.map((lead) => (
                    <RecentLeadCard key={`${lead.customer}-${lead.mobile}`} lead={lead} onView={() => notify(`${lead.customer} lead opened`)} />
                  ))}
                </div>

                <div className="mx-4 mb-4 mt-4 hidden overflow-hidden rounded-[12px] border border-[#e5edf6] bg-white lg:block">
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

              <aside className={dataPanelClass}>
                <SectionHeader
                  icon={Clock3}
                  title="Overdue Follow-ups"
                  actionLabel="View All"
                  iconTone="danger"
                  onAction={() => notify('All overdue follow-ups opened')}
                />

                <div className="m-4 divide-y divide-[#edf2f8] overflow-hidden rounded-[12px] border border-[#e5edf6] bg-[#fbfdff] px-4">
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

            <footer className="flex flex-col gap-2 border-t border-[#e4ebf4] px-1 pb-1 pt-3 text-center text-[12px] font-semibold text-[#7b88a2] sm:text-left lg:flex-row lg:items-center lg:justify-between">
              <p>Copyright 2024 Malwa Solar CRM. All rights reserved.</p>
              <p className="inline-flex items-center justify-center gap-1.5 lg:justify-end">
                Made with
                <Heart className="size-3.5 fill-current text-[#ff4b4f]" />
                for a Sustainable Future
                <Leaf className="size-3.5 text-[#1bc35f]" />
              </p>
            </footer>
              </>
            )}
          </div>
        </main>
      </div>

      <Toast toast={toast} />
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) {
    return null;
  }

  return (
    <div
      key={toast.id}
      className="fixed bottom-5 left-4 right-4 z-[80] rounded-[12px] border border-[#dce7f5] bg-white px-4 py-3 text-center text-[13px] font-extrabold text-[#223768] shadow-[0_16px_34px_rgba(21,43,83,0.16)] sm:left-auto sm:right-5 sm:max-w-[360px] sm:text-left"
      role="status"
      aria-live="polite"
    >
      {toast.message}
    </div>
  );
}

function SignInPage({ onLogin, onNotify }) {
  const [showPassword, setShowPassword] = useState(false);
  const features = [
    {
      title: 'Lead Management',
      text: 'Capture, track & convert leads',
      icon: Users,
    },
    {
      title: 'Follow-ups',
      text: 'Never miss your next follow-up',
      icon: CalendarDays,
    },
    {
      title: 'Analytics',
      text: 'Real-time insights & performance',
      icon: BarChart3,
    },
    {
      title: 'Secure & Reliable',
      text: 'Your data is safe with us',
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#eef3f7] px-3 py-4 text-[#172648] sm:px-5 lg:px-7">
      <main className="mx-auto grid h-auto min-h-[90vh] w-[95vw] max-w-[1960px] overflow-hidden rounded-[22px] border border-[#dfe7f2] bg-white shadow-[0_24px_60px_rgba(23,43,77,0.18)] sm:rounded-[24px] lg:grid-cols-[55fr_45fr]">
        <section
          className="relative isolate min-h-[560px] overflow-hidden bg-cover bg-no-repeat px-6 py-8 sm:min-h-[680px] sm:px-12 sm:py-12 lg:min-h-full lg:rounded-l-[24px] lg:px-[5.2vw] lg:py-[4.2vw] xl:px-[5.8vw] 2xl:px-[6.2vw]"
          style={{
            backgroundImage: `url(${signInBgImage})`,
            backgroundPosition: 'left center',
          }}
        >
          <div className="relative z-10 flex min-w-0 items-center gap-3">
            <MiniBrandMark plain />
            <div className="min-w-0">
              <p className="font-display text-[20px] font-extrabold leading-tight text-[#087532] sm:text-[28px] xl:text-[30px]">
                Malwa Solar Energy
              </p>
              <p className="mt-1 text-[13px] font-extrabold uppercase tracking-[0.24em] text-[#252b35] sm:text-[18px]">
                CRM System
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-12 max-w-[760px] sm:mt-20 lg:mt-[7.4vh] xl:mt-[8.2vh]">
            <h1 className="font-display text-[clamp(2.6rem,7vw,4rem)] font-extrabold leading-[1.12] text-[#102446] lg:text-[clamp(3rem,3.35vw,4.15rem)]">
              Powering a
              <span className="mt-1 block text-[#087532]">Sustainable Future</span>
            </h1>
            <p className="mt-8 max-w-[380px] text-[clamp(1.55rem,4.5vw,2rem)] font-bold leading-[1.58] text-[#2e3645]">
              One Solar Solution
              <span className="block">
                at a Time <Leaf className="mb-1 inline size-6 fill-current text-[#5abd2d]" />
              </span>
            </p>
          </div>

          <div className="relative z-10 mt-10 rounded-[22px] border border-white/20 bg-[linear-gradient(105deg,rgba(29,166,67,0.92)_0%,rgba(12,137,132,0.88)_48%,rgba(13,108,202,0.92)_100%)] p-5 text-white shadow-[0_18px_34px_rgba(11,71,118,0.24)] sm:mt-12 sm:rounded-[24px] sm:p-7 lg:absolute lg:bottom-[5.2vh] lg:left-[3.8vw] lg:right-[3.3vw] lg:mt-0">
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {features.map((feature) => (
                <LoginFeature key={feature.title} feature={feature} />
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center bg-white px-5 py-9 sm:px-10 sm:py-12 lg:px-[5vw]">
          <div className="w-full max-w-[720px] lg:max-w-[560px] 2xl:max-w-[680px]">
            <div>
              <h2 className="font-display text-[30px] font-extrabold text-[#102446] sm:text-[36px] lg:text-[38px]">
                Welcome Back!
              </h2>
              <p className="mt-5 text-[16px] font-semibold text-[#5c6676] sm:text-[20px]">
                Login to your Malwa Solar Energy CRM account
              </p>
            </div>

            <form
              className="mt-9 space-y-6 sm:mt-11 sm:space-y-7"
              onSubmit={(event) => {
                event.preventDefault();
                onLogin();
              }}
            >
              <label className="block">
                <span className="text-[15px] font-bold text-[#111827] sm:text-[17px]">Email / Mobile Number</span>
                <span className="mt-4 flex h-[62px] items-center gap-5 rounded-[9px] border border-black/20 bg-white px-5 shadow-[inset_0_1px_2px_rgba(20,35,60,0.04)] transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                  <UserRound className="size-6 text-[#7a8494]" />
                  <input
                    type="text"
                    placeholder="Enter email or mobile number"
                    className="h-full min-w-0 flex-1 bg-transparent text-[16px] font-semibold text-[#1f2d44] outline-none placeholder:text-[#7d8796] sm:text-[18px]"
                  />
                </span>
              </label>

              <label className="block">
                <span className="text-[15px] font-bold text-[#111827] sm:text-[17px]">Password</span>
                <span className="mt-4 flex h-[62px] items-center gap-5 rounded-[9px] border border-black/20 bg-white px-5 shadow-[inset_0_1px_2px_rgba(20,35,60,0.04)] transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                  <LockKeyhole className="size-6 text-[#7a8494]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    className="h-full min-w-0 flex-1 bg-transparent text-[16px] font-semibold text-[#1f2d44] outline-none placeholder:text-[#7d8796] sm:text-[18px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="text-[#7a8494] transition hover:text-[#156bd9]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Eye className="size-5" />
                  </button>
                </span>
              </label>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <label className="inline-flex items-center gap-3 text-[15px] font-bold text-[#5a6574] sm:text-[16px]">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="size-5 rounded accent-[#17a34a]"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => onNotify('Forgot password selected')}
                  className="text-left text-[15px] font-bold text-[#055ee4] transition hover:text-[#034bb6] sm:text-right sm:text-[16px]"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                className="flex h-[64px] w-full items-center justify-center gap-3 rounded-[9px] bg-[linear-gradient(90deg,#20b947_0%,#169e9a_51%,#116fd0_100%)] text-[20px] font-extrabold text-white shadow-[0_14px_28px_rgba(21,116,171,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(21,116,171,0.28)]"
              >
                <LogIn className="size-5" />
                Login
              </button>

              <div className="flex items-center gap-4">
                <span className="h-px flex-1 bg-[#e0e5ee]" />
                <span className="grid size-12 place-items-center rounded-full border border-[#e5eaf2] bg-white text-[14px] font-bold text-[#6a7586]">
                  OR
                </span>
                <span className="h-px flex-1 bg-[#e0e5ee]" />
              </div>

              <button
                type="button"
                onClick={() => onNotify('Google login selected')}
                className="flex h-[64px] w-full items-center justify-center gap-4 rounded-[9px] border border-black/20 bg-white text-[18px] font-bold text-[#111827] shadow-[0_6px_16px_rgba(20,35,60,0.04)] transition hover:border-blue-500 hover:bg-[#fbfdff] sm:text-[20px]"
              >
                <span className="font-display text-[25px] font-extrabold text-[#4285f4]">
                  G
                </span>
                Login with Google
              </button>

              <p className="pt-3 text-center text-[15px] font-semibold text-[#5a6574] sm:text-[16px]">
                Don't have an account?
                <button
                  type="button"
                  onClick={() => onNotify('Contact administrator selected')}
                  className="ml-2 font-bold text-[#055ee4] transition hover:text-[#034bb6]"
                >
                  Contact Administrator
                </button>
              </p>
            </form>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-[1470px] flex-col gap-2 px-3 py-6 text-center text-[14px] font-semibold text-[#566173] sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <p>© 2024 Malwa Solar Energy CRM. All rights reserved.</p>
        <p className="inline-flex items-center justify-center gap-1.5 sm:justify-end">
          Made with
          <Heart className="size-4 fill-current text-[#ff2f2f]" />
          for a Sustainable Future
          <Leaf className="size-4 fill-current text-[#4db52f]" />
        </p>
      </footer>
    </div>
  );
}

function LoginFeature({ feature }) {
  const Icon = feature.icon;

  return (
    <div className="text-center">
      <div className="mx-auto grid size-16 place-items-center rounded-full bg-white/28 text-white ring-1 ring-white/20 sm:size-[72px] lg:size-[78px]">
        <Icon className="size-8 sm:size-9" />
      </div>
      <p className="mt-5 text-[15px] font-extrabold sm:text-[16px]">{feature.title}</p>
      <p className="mx-auto mt-3 max-w-[160px] text-[13px] font-semibold leading-7 text-white/92 sm:text-[14px]">
        {feature.text}
      </p>
    </div>
  );
}

function LeadListPage({ onCreateLead, onNotify }) {
  const [followUpDate, setFollowUpDate] = useState('');
  const followUpDateInputRef = useRef(null);
  const headers = [
    '#',
    'Customer Name',
    'Mobile Number',
    'IVRS Number',
    'Project Name',
    'Project Type',
    'Status',
    'Assigned To',
    'Next Follow-up',
    'Action',
  ];

  const openFollowUpDatePicker = () => {
    const input = followUpDateInputRef.current;
    if (!input) {
      return;
    }

    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-[14px] bg-white/60 p-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[24px] font-extrabold leading-tight text-[#111827] sm:text-[28px]">
            Lead List
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] font-bold">
            <button type="button" onClick={() => onNotify('Dashboard breadcrumb selected')} className="text-[#0b65e5]">
              Dashboard
            </button>
            <ChevronRight className="size-3.5 text-[#9aa8bc]" />
            <span className="text-[#53647f]">Lead</span>
            <ChevronRight className="size-3.5 text-[#9aa8bc]" />
            <span className="text-[#111827]">Lead List</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onNotify('Lead export started')}
            data-action="lead-export"
            className="inline-flex h-11 items-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276] shadow-[0_8px_18px_rgba(17,39,84,0.04)] transition hover:border-[#c8d8ed] hover:bg-[#f8fbff]"
          >
            <Download className="size-4" />
            Export
          </button>
          <button
            type="button"
            onClick={onCreateLead}
            data-route={leadSubRoutes['Create Lead']}
            className="inline-flex h-11 items-center gap-2 rounded-[8px] bg-[#12a54f] px-4 text-[13px] font-extrabold text-white shadow-[0_12px_22px_rgba(18,165,79,0.22)] transition hover:-translate-y-0.5 hover:bg-[#0e9145]"
          >
            <Plus className="size-4" />
            Create Lead
          </button>
        </div>
      </div>

      <section className={`${panelClass} relative z-40 overflow-visible p-4 sm:p-5`}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[1.4fr_1fr_1fr_1fr_1.1fr_auto] 2xl:items-end">
          <label className="flex h-11 items-center gap-3 rounded-[8px] border border-black/20 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
            <input
              type="search"
              placeholder="Search by name, mobile, IVRS..."
              className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-[#30466d] outline-none placeholder:text-[#8493ab]"
            />
            <Search className="size-4 text-[#7386a3]" />
          </label>

          <FilterSelect label="Project Type" options={['All', 'On-Grid', 'Off-Grid', 'Hybrid']} />
          <FilterSelect label="Status" options={['All', 'New', 'Follow-up', 'Quotation', 'Lost']} />
          <FilterSelect label="Assigned To" options={['All', 'Rohit Singh', 'Neha Kumari', 'Vikram Patel']} />

          <label className="block">
            <span className="mb-2 block text-[12px] font-extrabold text-[#34466c]">Follow-up Date</span>
            <button
              type="button"
              onClick={openFollowUpDatePicker}
              className="relative flex h-11 w-full items-center gap-3 rounded-[8px] border border-black/20 bg-white px-4 text-left text-[13px] font-bold text-[#6f7f98] transition hover:bg-[#fbfdff] focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              <CalendarDays className="size-4 text-[#7386a3]" />
              <span className={cx('pointer-events-none', followUpDate ? 'text-[#30466d]' : 'text-[#6f7f98]')}>
                {followUpDate || 'Select date range'}
              </span>
              <input
                ref={followUpDateInputRef}
                type="date"
                value={followUpDate}
                onChange={(event) => setFollowUpDate(event.target.value)}
                className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0"
                tabIndex={-1}
                aria-label="Select follow-up date"
              />
            </button>
          </label>

          <button
            type="button"
            onClick={() => onNotify('Lead filters reset')}
            data-action="lead-reset-filters"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-black/20 bg-white px-4 text-[13px] font-extrabold text-[#284276] transition hover:bg-[#f8fbff] focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <RefreshCw className="size-4 text-[#0b65e5]" />
            Reset Filters
          </button>
        </div>
      </section>

      <section className={`${panelClass} relative z-10 overflow-hidden p-3 sm:p-4`}>
        <div className="space-y-3 lg:hidden">
          {leadListRows.map((lead, index) => (
            <LeadListMobileCard
              key={`${lead.ivrs}-${lead.mobile}`}
              index={index + 1}
              lead={lead}
              onNotify={onNotify}
            />
          ))}
        </div>

        <div className="hidden overflow-hidden rounded-[12px] border border-[#e7eef7] bg-white lg:block">
          <div className="overflow-x-auto">
            <table className="crm-table min-w-[1180px] w-full">
              <thead>
                <tr>
                  {headers.map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leadListRows.map((lead, index) => (
                  <tr key={`${lead.ivrs}-${lead.mobile}`}>
                    <td className="font-extrabold text-[#233a6b]">{index + 1}</td>
                    <td className="font-bold text-[#233a6b]">{lead.customer}</td>
                    <td>{lead.mobile}</td>
                    <td>{lead.ivrs}</td>
                    <td className="font-bold text-[#233a6b]">{lead.project}</td>
                    <td>{lead.type}</td>
                    <td>
                      <StatusBadge status={lead.status} />
                    </td>
                    <td>
                      <AssigneeCell assignee={lead.assignedTo} compact />
                    </td>
                    <td className={cx('font-extrabold', index < 2 ? 'text-[#f04438]' : 'text-[#233a6b]')}>
                      {lead.nextFollowUp}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onNotify(`${lead.customer} lead opened`)}
                          data-action="lead-view"
                          className="inline-flex size-8 items-center justify-center rounded-[8px] border border-[#e3ebf7] bg-white text-[#3480ff] transition hover:bg-[#f5f9ff]"
                          aria-label={`View ${lead.customer}`}
                        >
                          <Eye className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onNotify(`${lead.customer} more actions opened`)}
                          data-action="lead-more-actions"
                          className="inline-flex size-8 items-center justify-center rounded-[8px] text-[#53647f] transition hover:bg-[#f5f9ff]"
                          aria-label={`More actions for ${lead.customer}`}
                        >
                          <MoreVertical className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-4 px-3 py-5 text-[13px] font-bold text-[#53647f] sm:flex-row sm:items-center sm:justify-between">
          <p>Showing 1 to 10 of 125 entries</p>
          <div className="flex flex-wrap items-center gap-2">
            <PaginationButton onClick={() => onNotify('Previous page selected')}>
              <ChevronLeft className="size-4" />
            </PaginationButton>
            <PaginationButton active onClick={() => onNotify('Page 1 selected')}>1</PaginationButton>
            <PaginationButton onClick={() => onNotify('Page 2 selected')}>2</PaginationButton>
            <PaginationButton onClick={() => onNotify('Page 3 selected')}>3</PaginationButton>
            <span className="px-2 text-[#53647f]">...</span>
            <PaginationButton onClick={() => onNotify('Page 13 selected')}>13</PaginationButton>
            <PaginationButton onClick={() => onNotify('Next page selected')}>
              <ChevronRight className="size-4" />
            </PaginationButton>
          </div>
        </div>
      </section>

      <DashboardFooter />
    </div>
  );
}

function CreateLeadPage({ onCancel, onDashboard, onNotify }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-[14px] bg-white/60 p-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[24px] font-extrabold leading-tight text-[#111827] sm:text-[28px]">
            Create Lead
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] font-bold">
            <button
              type="button"
              onClick={onDashboard}
              className="rounded-[7px] border border-black/20 px-2 py-1 text-[#0b65e5] transition hover:bg-white"
            >
              Dashboard
            </button>
            <ChevronRight className="size-3.5 text-[#9aa8bc]" />
            <span className="text-[#53647f]">Lead</span>
            <ChevronRight className="size-3.5 text-[#9aa8bc]" />
            <span className="text-[#111827]">Create Lead</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={onCancel}
            data-action="create-lead-cancel"
            data-route={leadSubRoutes['Lead List']}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] border border-black/20 bg-white px-4 text-[13px] font-extrabold text-[#233a6b] shadow-[0_8px_18px_rgba(17,39,84,0.04)] transition hover:bg-[#f8fbff] sm:w-auto"
          >
            <X className="size-4" />
            Cancel
          </button>
          <button
            type="submit"
            form="create-lead-form"
            data-action="create-lead-save"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] border border-black/20 bg-[#10a64e] px-4 text-[13px] font-extrabold text-white shadow-[0_12px_22px_rgba(18,165,79,0.22)] transition hover:-translate-y-0.5 hover:bg-[#0e9145] sm:w-auto"
          >
            <Save className="size-4" />
            Save Lead
          </button>
        </div>
      </div>

      <form
        id="create-lead-form"
        className="grid gap-4 xl:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          onNotify('Lead saved');
        }}
      >
        <LeadFormSection
          title="1. Basic Information"
          icon={ReceiptText}
          tone="success"
          className="xl:min-h-[286px]"
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <LeadInput label="Customer Name" required icon={UserRound} placeholder="Enter customer name" />
            <LeadPhoneInput label="Mobile Number" required placeholder="Enter mobile number" />
            <LeadInput label="IVRS Number" required icon={CalendarDays} placeholder="Enter IVRS number" rightHint />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <LeadPhoneInput label="Alternate Number" placeholder="Enter alternate number" />
            <LeadInput label="Email Address" icon={Mail} placeholder="Enter email address" type="email" />
          </div>
        </LeadFormSection>

        <LeadFormSection title="2. Project Information" icon={ClipboardPlus} tone="primary" className="xl:min-h-[286px]">
          <div className="grid gap-4 lg:grid-cols-2">
            <LeadInput label="Project Name" icon={CalendarDays} placeholder="Enter project name" />
            <LeadSelect label="Project Type" placeholder="Select project type" options={['On-Grid', 'Off-Grid', 'Hybrid']} />
          </div>
          <LeadTextarea label="Requirement Details" icon={Users} placeholder="Enter requirement details..." />
          <div className="grid gap-4 lg:grid-cols-2">
            <LeadSelect label="Source" placeholder="Select source" options={['Website', 'Referral', 'Walk-in', 'Campaign']} />
            <LeadInput label="Estimated Capacity (kW)" icon={CalendarDays} placeholder="Enter capacity (e.g. 5, 10, 20)" />
          </div>
        </LeadFormSection>

        <LeadFormSection title="3. Assignment & Follow-up" icon={UserRound} tone="purple" className="xl:min-h-[256px]">
          <div className="grid gap-4 lg:grid-cols-3">
            <LeadSelect label="Assigned Employee" required placeholder="Select employee" options={['Rohit Singh', 'Neha Kumari', 'Vikram Patel']} />
            <LeadDateInput label="Follow-up Date" required />
            <LeadSelect label="Lead Status" placeholder="New" options={['New', 'Follow-up', 'Quotation', 'Lost']} badgeValue="New" />
          </div>
          <div className="grid gap-4 lg:grid-cols-[0.75fr_1.75fr]">
            <LeadSelect label="Priority" icon={Flag} placeholder="Select priority" options={['High', 'Medium', 'Low']} />
            <LeadTextarea label="Remarks" icon={MapPin} placeholder="Enter remarks (optional)" compact />
          </div>
        </LeadFormSection>

        <LeadFormSection title="4. Location Information" titleSuffix="(Optional)" icon={MapPin} tone="warning" className="xl:min-h-[256px]">
          <LeadTextarea label="Address" icon={MapPin} placeholder="Enter full address" />
          <div className="grid gap-4 lg:grid-cols-2">
            <LeadInput label="Latitude" optional icon={MapPin} placeholder="Enter latitude" />
            <LeadInput label="Longitude" optional icon={MapPin} placeholder="Enter longitude" />
          </div>
        </LeadFormSection>

        <CreateLeadNotice />
      </form>

      <DashboardFooter />
    </div>
  );
}

function LeadFormSection({ title, titleSuffix, icon: Icon, tone = 'primary', className, children }) {
  const toneClass =
    {
      primary: 'text-[#0b65e5] bg-[#edf5ff]',
      success: 'text-[#078c3e] bg-[#e9f8ee]',
      purple: 'text-[#4f38ef] bg-[#f0edff]',
      warning: 'text-[#ff9700] bg-[#fff4df]',
    }[tone] ?? 'text-[#0b65e5] bg-[#edf5ff]';

  return (
    <section className={cx(`${panelClass} p-5`, className)}>
      <div className="mb-5 flex items-center gap-3">
        <span className={cx('grid size-8 place-items-center rounded-[9px]', toneClass)}>
          <Icon className="size-[17px]" />
        </span>
        <h2 className={cx('text-[15px] font-extrabold', toneClass.split(' ')[0])}>
          {title}
          {titleSuffix ? <span className="ml-1 font-bold text-[#53647f]">{titleSuffix}</span> : null}
        </h2>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function LeadInput({ label, placeholder, icon: Icon, required = false, optional = false, type = 'text', rightHint = false }) {
  return (
    <label className="block min-w-0">
      <LeadLabel label={label} required={required} optional={optional} rightHint={rightHint} />
      <span className="mt-2 flex h-11 items-center gap-3 rounded-[8px] border border-black/20 bg-white px-3 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
        {Icon ? <Icon className="size-4 shrink-0 text-[#8391a8]" /> : null}
        <input
          type={type}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-[#30466d] outline-none placeholder:text-[#8a98af]"
        />
      </span>
    </label>
  );
}

function LeadPhoneInput({ label, placeholder, required = false }) {
  return (
    <label className="block min-w-0">
      <LeadLabel label={label} required={required} />
      <span className="mt-2 flex h-11 overflow-hidden rounded-[8px] border border-black/20 bg-white transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
        <select className="w-[68px] border-r border-black/20 bg-white px-3 text-[13px] font-extrabold text-[#233a6b] outline-none">
          <option>+91</option>
          <option>+1</option>
          <option>+44</option>
        </select>
        <input
          type="tel"
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent px-3 text-[13px] font-bold text-[#30466d] outline-none placeholder:text-[#8a98af]"
        />
      </span>
    </label>
  );
}

function LeadSelect({ label, placeholder, options, required = false, icon: Icon, badgeValue }) {
  return (
    <label className="block min-w-0">
      <LeadLabel label={label} required={required} />
      <span className="mt-2 flex h-11 items-center gap-3 rounded-[8px] border border-black/20 bg-white px-3 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
        {Icon ? <Icon className="size-4 shrink-0 text-[#8391a8]" /> : null}
        {badgeValue ? (
          <span className="rounded-[7px] bg-[#e8f8eb] px-3 py-1 text-[12px] font-extrabold text-[#18a34a]">
            {badgeValue}
          </span>
        ) : null}
        <select className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-[#53647f] outline-none">
          <option>{placeholder}</option>
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </span>
    </label>
  );
}

function LeadDateInput({ label, required = false }) {
  const dateInputRef = useRef(null);
  const [date, setDate] = useState('');

  const openPicker = () => {
    const input = dateInputRef.current;
    if (!input) {
      return;
    }

    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  };

  return (
    <label className="block min-w-0">
      <LeadLabel label={label} required={required} />
      <button
        type="button"
        onClick={openPicker}
        className="relative mt-2 flex h-11 w-full items-center gap-3 rounded-[8px] border border-black/20 bg-white px-3 text-left transition hover:bg-[#fbfdff] focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      >
        <CalendarDays className="size-4 shrink-0 text-[#8391a8]" />
        <span className={cx('text-[13px] font-bold', date ? 'text-[#30466d]' : 'text-[#8a98af]')}>
          {date || 'Select follow-up date'}
        </span>
        <input
          ref={dateInputRef}
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0"
          tabIndex={-1}
          aria-label={label}
        />
      </button>
    </label>
  );
}

function LeadTextarea({ label, placeholder, icon: Icon, compact = false }) {
  return (
    <label className="block min-w-0">
      <LeadLabel label={label} />
      <span
        className={cx(
          'mt-2 flex items-start gap-3 rounded-[8px] border border-black/20 bg-white px-3 py-3 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100',
          compact ? 'min-h-[62px]' : 'min-h-[74px]',
        )}
      >
        {Icon ? <Icon className="mt-0.5 size-4 shrink-0 text-[#8391a8]" /> : null}
        <textarea
          placeholder={placeholder}
          rows={compact ? 2 : 3}
          className="min-h-full min-w-0 flex-1 resize-y bg-transparent text-[13px] font-bold text-[#30466d] outline-none placeholder:text-[#8a98af]"
        />
      </span>
    </label>
  );
}

function LeadLabel({ label, required = false, optional = false, rightHint = false }) {
  return (
    <span className="flex min-h-[18px] items-center gap-1 text-[12px] font-extrabold text-[#34466c]">
      <span>
        {label}
        {optional ? <span className="ml-1 font-bold text-[#7a879b]">(Optional)</span> : null}
      </span>
      {required ? <span className="text-[#f04438]">*</span> : null}
      {rightHint ? <span className="ml-auto grid size-4 place-items-center rounded-full border border-[#93a2b8] text-[10px] text-[#617089]">i</span> : null}
    </span>
  );
}

function CreateLeadNotice() {
  return (
    <div className="rounded-[12px] border border-[#bfe7ca] bg-[#f0fbf3] p-4 xl:col-span-2">
      <div className="flex gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#d8f4df] text-[#0b8e3c]">
          <ShieldCheck className="size-6" />
        </span>
        <div>
          <p className="text-[13px] font-extrabold text-[#0c7d3a]">Important Note</p>
          <p className="mt-1 text-[13px] font-semibold leading-6 text-[#276747]">
            Mobile Number and IVRS Number are mandatory. IVRS Number must be unique. Duplicate IVRS will not be allowed.
          </p>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ label, options }) {
  return (
    <label>
      <span className="mb-2 block text-[12px] font-extrabold text-[#34466c]">{label}</span>
      <select className="h-11 w-full rounded-[8px] border border-black/20 bg-white px-4 text-[13px] font-bold text-[#30466d] outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function PaginationButton({ active = false, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'inline-flex size-9 items-center justify-center rounded-[8px] border text-[13px] font-extrabold transition',
        active
          ? 'border-[#11a650] bg-[#11a650] text-white shadow-[0_10px_18px_rgba(17,166,80,0.22)]'
          : 'border-[#dce7f5] bg-white text-[#284276] hover:bg-[#f8fbff]',
      )}
    >
      {children}
    </button>
  );
}

function LeadListMobileCard({ index, lead, onNotify }) {
  return (
    <article className="rounded-[14px] border border-[#e5edf6] bg-white p-4 shadow-[0_10px_22px_rgba(17,39,84,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-extrabold text-[#8a98af]">#{index}</p>
          <p className="mt-1 text-[15px] font-extrabold text-[#233a6b]">{lead.customer}</p>
          <p className="mt-1 text-[12px] font-bold text-[#53647f]">{lead.project}</p>
        </div>
        <StatusBadge status={lead.status} />
      </div>
      <div className="mt-4 grid gap-3 text-[12px] min-[420px]:grid-cols-2">
        <InfoCell label="Mobile" value={lead.mobile} />
        <InfoCell label="IVRS" value={lead.ivrs} />
        <InfoCell label="Project Type" value={lead.type} />
        <InfoCell label="Next Follow-up" value={lead.nextFollowUp} valueClass={index <= 2 ? 'text-[#f04438]' : undefined} />
        <InfoCell label="Assigned To" valueNode={<AssigneeCell assignee={lead.assignedTo} compact />} />
      </div>
      <button
        type="button"
        onClick={() => onNotify(`${lead.customer} lead opened`)}
        data-action="lead-view-mobile"
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[10px] border border-[#d8e4f4] bg-white px-3 py-2 text-[12px] font-extrabold text-[#2d67e1]"
      >
        View Lead
        <Eye className="size-3.5" />
      </button>
    </article>
  );
}

function DashboardFooter() {
  return (
    <footer className="flex flex-col gap-2 border-t border-[#e4ebf4] px-1 pb-1 pt-3 text-center text-[12px] font-semibold text-[#7b88a2] sm:text-left lg:flex-row lg:items-center lg:justify-between">
      <p>Copyright 2024 Malwa Solar CRM. All rights reserved.</p>
      <p className="inline-flex items-center justify-center gap-1.5 lg:justify-end">
        Made with
        <Heart className="size-3.5 fill-current text-[#ff4b4f]" />
        for a Sustainable Future
        <Leaf className="size-3.5 text-[#1bc35f]" />
      </p>
    </footer>
  );
}

function StatCard({ stat }) {
  const Icon = stat.icon;

  return (
    <article className={`${panelClass} flex min-h-[106px] items-center gap-3 px-3 py-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(24,48,87,0.1)] sm:gap-4 sm:px-4`}>
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

function SectionHeader({ icon: Icon, title, actionLabel, onAction, iconTone = 'primary' }) {
  const iconClass =
    {
      primary: 'text-[#2d67e1]',
      success: 'text-[#1ab959]',
      danger: 'text-[#ef5a4b]',
    }[iconTone] ?? 'text-[#2d67e1]';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8eef6] bg-[#f8fbff]/95 px-4 py-3.5">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-[8px] bg-white shadow-[inset_0_0_0_1px_rgba(220,230,243,0.9)]">
          <Icon className={cx('size-[17px]', iconClass)} />
        </span>
        <h2 className="font-display text-[15px] font-extrabold text-[#223768] sm:text-[16px]">{title}</h2>
      </div>

      {actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[13px] font-extrabold text-[#2d67e1] transition hover:bg-[#eef5ff]"
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

function BrandLockup() {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <MiniBrandMark compact plain />
      <div className="min-w-0">
        <p className="truncate font-display text-[14px] font-extrabold leading-tight text-[#078c3e]">
          Malwa Solar Energy
        </p>
        <p className="mt-1 truncate text-[8px] font-extrabold uppercase text-[#6f7d8d]">
          CRM System
        </p>
      </div>
    </div>
  );
}

function MiniBrandMark({ compact = false, plain = false }) {
  return (
    <div
      className={cx(
        'grid shrink-0 place-items-center',
        plain ? '' : 'border border-[#e5edf7] bg-white shadow-[0_10px_24px_rgba(17,39,84,0.08)]',
        compact ? 'size-10 rounded-[12px]' : 'size-[52px] rounded-[16px]',
      )}
    >
      <svg viewBox="0 0 44 44" className={compact ? 'size-8' : 'size-9'} aria-hidden="true">
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

function FollowUpCard({ followUp, onView }) {
  return (
    <article className="rounded-[14px] border border-[#e8eef6] bg-white p-4 shadow-[0_10px_22px_rgba(17,39,84,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-extrabold text-[#274072]">{followUp.customer}</p>
          <p className="mt-1 text-[12px] font-bold text-[#6f7f98]">{followUp.project}</p>
        </div>
        <button
          type="button"
          onClick={onView}
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

function RecentLeadCard({ lead, onView }) {
  return (
    <article className="rounded-[14px] border border-[#e8eef6] bg-white p-4 shadow-[0_10px_22px_rgba(17,39,84,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-extrabold text-[#3258aa]">{lead.customer}</p>
          <p className="mt-1 text-[12px] font-bold text-[#6f7f98]">{lead.project}</p>
        </div>
        <StatusBadge status={lead.status} />
      </div>
      <button
        type="button"
        onClick={onView}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[10px] border border-[#d8e4f4] bg-white px-3 py-2 text-[12px] font-extrabold text-[#2d67e1]"
      >
        View Lead
        <ArrowRight className="size-3.5" />
      </button>
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
