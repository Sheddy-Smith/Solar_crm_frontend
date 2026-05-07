import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  AlertTriangle,
  BarChart3,
  Bell,
  Boxes,
  CalendarDays,
  CheckCircle2,
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
  Phone,
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
  XCircle,
  Zap,
} from 'lucide-react';
import signInBgImage from './assets/data/Sign_in_bg_hd.png';
import navBarImage from './assets/data/nav_bar_img.png';

const sidebarItems = [
  { label: 'Dashboard', icon: Home, active: true },
  { label: 'Lead', icon: Users, showChevron: true },
  { label: 'Project Management', icon: FolderKanban },
  { label: 'Liaisoning & Commissioning', icon: ShieldCheck },
  { label: 'O&M', icon: Wrench },
  { label: 'Accounts', icon: ReceiptText, showChevron: true },
  { label: 'Inventory', icon: Boxes, showChevron: true },
  { label: 'Reports', icon: BarChart3 },
  { label: 'Employee Management', icon: UsersRound, showChevron: true },
  { label: 'AMC & Warranty', icon: ShieldCheck },
  { label: 'Settings', icon: Settings },
];

const leadSubItems = ['Lead List', 'Create Lead'];
const leadRelatedPages = [...leadSubItems, 'Lead Details', 'Follow-up History', 'Admin Approval'];
const employeeSubItems = ['Users', 'Roles & Permissions', 'Activity Logs'];
const employeeRelatedPages = [...employeeSubItems];
const accountsSubItems = ['Accounts List', 'Chart of Accounts', 'Payment Received', 'Payment Made', 'Bank Accounts', 'Cheques List'];
const accountsRelatedPages = ['Accounts Overview', ...accountsSubItems];
const inventorySubItems = ['Overview', 'Products', 'Stock Inward', 'Stock Outward', 'Stock Transfer', 'Adjustments', 'Warehouses'];
const inventoryRelatedPages = [...inventorySubItems];

const leadSubRoutes = {
  'Lead List': '/lead/list',
  'Create Lead': '/lead/create',
};

const employeeSubRoutes = {
  Users: '/employees/users',
  'Roles & Permissions': '/employees/roles-permissions',
  'Activity Logs': '/employees/activity-logs',
};

const accountsSubRoutes = {
  'Accounts Overview': '/accounts/overview',
  'Accounts List': '/accounts/list',
  'Chart of Accounts': '/accounts/chart-of-accounts',
  'Payment Received': '/accounts/payment-received',
  'Payment Made': '/accounts/payment-made',
  'Bank Accounts': '/accounts/bank-accounts',
  'Cheques List': '/accounts/cheques',
};

const inventorySubRoutes = {
  Overview: '/inventory/overview',
  Products: '/inventory/products',
  'Stock Inward': '/inventory/stock-inward',
  'Stock Outward': '/inventory/stock-outward',
  'Stock Transfer': '/inventory/stock-transfer',
  Adjustments: '/inventory/adjustments',
  Warehouses: '/inventory/warehouses',
};

const leadCategoryTabs = [
  {
    label: 'New leads',
    shortLabel: 'New',
    count: 34,
    icon: UserPlus,
    tone: 'green',
    priority: 'Fresh enquiries',
    description: 'Recently captured leads that need first contact and quick qualification.',
    nextAction: 'Assign an employee and schedule the first follow-up.',
    leads: ['Pooja Mehta', 'Manish Tiwari', 'Vikas Yadav'],
  },
  {
    label: 'Hot leads',
    shortLabel: 'Hot',
    count: 18,
    icon: Zap,
    tone: 'red',
    priority: 'High intent',
    description: 'Customers who are ready for site visit, quotation, or final pricing discussion.',
    nextAction: 'Prioritize follow-up today and move toward quotation.',
    leads: ['Amit Sharma', 'Rajesh Gupta', 'Deepak Joshi'],
  },
  {
    label: 'Warm leads',
    shortLabel: 'Warm',
    count: 42,
    icon: Clock3,
    tone: 'amber',
    priority: 'Active nurturing',
    description: 'Interested customers who need comparison, subsidy details, or approval follow-up.',
    nextAction: 'Share proposal details and keep regular follow-up reminders.',
    leads: ['Sunil Verma', 'Anjali Patel', 'Kavita Rana'],
  },
  {
    label: 'Cool leads',
    shortLabel: 'Cool',
    count: 21,
    icon: Leaf,
    tone: 'blue',
    priority: 'Low urgency',
    description: 'Leads that are interested but not ready to decide immediately.',
    nextAction: 'Keep them in long-term nurturing with helpful updates.',
    leads: ['Suresh Kumar', 'Vikas Yadav', 'Pooja Mehta'],
  },
  {
    label: 'Lost leads',
    shortLabel: 'Lost',
    count: 10,
    icon: XCircle,
    tone: 'slate',
    priority: 'Closed lost',
    description: 'Customers who declined, postponed indefinitely, or selected another provider.',
    nextAction: 'Capture reason, keep record clean, and re-open only if customer responds.',
    leads: ['Suresh Kumar', 'Deepak Joshi', 'Rajesh Gupta'],
  },
];

const leadCategoryToneClasses = {
  green: {
    button: 'border-[#bcefd1] bg-[#f1fff6] text-[#087a39] hover:border-[#83d8a5] hover:bg-[#e8fff0]',
    icon: 'bg-[#dff6e7] text-[#0d9f4a]',
    count: 'bg-[#dff6e7] text-[#087a39]',
    accent: 'from-[#18b957] to-[#0f9f49]',
  },
  red: {
    button: 'border-[#ffd1d1] bg-[#fff6f6] text-[#d92d20] hover:border-[#ffadad] hover:bg-[#fff0f0]',
    icon: 'bg-[#ffe1e1] text-[#f04438]',
    count: 'bg-[#ffe1e1] text-[#d92d20]',
    accent: 'from-[#f04438] to-[#fb923c]',
  },
  amber: {
    button: 'border-[#ffe4b5] bg-[#fffaf0] text-[#b76b00] hover:border-[#ffd285] hover:bg-[#fff5df]',
    icon: 'bg-[#fff0dc] text-[#f59e0b]',
    count: 'bg-[#fff0dc] text-[#b76b00]',
    accent: 'from-[#f59e0b] to-[#facc15]',
  },
  blue: {
    button: 'border-[#cfe0ff] bg-[#f5f9ff] text-[#1766d3] hover:border-[#a9c8ff] hover:bg-[#edf5ff]',
    icon: 'bg-[#e3efff] text-[#0b65e5]',
    count: 'bg-[#e3efff] text-[#1766d3]',
    accent: 'from-[#1199e6] to-[#126fd1]',
  },
  slate: {
    button: 'border-[#dce4ef] bg-[#f8fafc] text-[#475569] hover:border-[#cbd5e1] hover:bg-[#f1f5f9]',
    icon: 'bg-[#e9eef6] text-[#475569]',
    count: 'bg-[#e9eef6] text-[#475569]',
    accent: 'from-[#64748b] to-[#334155]',
  },
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

const reportKpis = [
  {
    title: 'Total Leads',
    value: '156',
    growth: '18%',
    caption: 'vs 01 Apr - 30 Apr 2024',
    icon: Users,
    tone: 'blue',
  },
  {
    title: 'New Leads',
    value: '98',
    growth: '22%',
    caption: 'vs 01 Apr - 30 Apr 2024',
    icon: UserPlus,
    tone: 'green',
  },
  {
    title: 'Follow-ups Completed',
    value: '62',
    growth: '15%',
    caption: 'vs 01 Apr - 30 Apr 2024',
    icon: Phone,
    tone: 'amber',
  },
  {
    title: 'Site Visits Done',
    value: '28',
    growth: '12%',
    caption: 'vs 01 Apr - 30 Apr 2024',
    icon: MapPin,
    tone: 'purple',
  },
  {
    title: 'Leads Won',
    value: '16',
    growth: '33%',
    caption: 'vs 01 Apr - 30 Apr 2024',
    icon: Trophy,
    tone: 'sky',
  },
];

const reportKpiToneClasses = {
  blue: 'border-[#d9e8ff] bg-[#f6fbff] text-[#0b65e5]',
  green: 'border-[#d7f2df] bg-[#f6fff8] text-[#0d9f4a]',
  amber: 'border-[#ffe8bd] bg-[#fffaf0] text-[#f59e0b]',
  purple: 'border-[#e5dcff] bg-[#fbf9ff] text-[#6a55f0]',
  sky: 'border-[#d8ecff] bg-[#f4fbff] text-[#1586e8]',
};

const reportTrendSeries = [
  { label: 'New Leads', color: '#1f7ff0', values: [22, 25, 22, 26, 26, 26, 31, 27, 27, 24, 25, 29, 27, 28, 32, 27, 25, 26, 24, 28, 29] },
  { label: 'Completed Follow-ups', color: '#36a269', values: [15, 16, 14, 17, 17, 16, 21, 17, 15, 13, 14, 18, 15, 17, 22, 16, 15, 16, 13, 18, 18] },
  { label: 'Won Leads', color: '#6b55e9', values: [4, 5, 4, 6, 6, 5, 8, 6, 5, 5, 6, 9, 6, 8, 9, 7, 7, 6, 6, 9, 8] },
];

const reportStatusData = [
  { label: 'New', value: 52, percent: '33.3%', color: '#6aa8ff' },
  { label: 'Follow-up', value: 48, percent: '30.8%', color: '#40a86f' },
  { label: 'Site Visit', value: 28, percent: '17.9%', color: '#9d87cf' },
  { label: 'Quotation Shared', value: 16, percent: '10.3%', color: '#f8c64d' },
  { label: 'Won', value: 10, percent: '6.4%', color: '#7564df' },
  { label: 'Lost', value: 2, percent: '1.3%', color: '#c75b64' },
];

const projectTypeReportRows = [
  ['5kW On-Grid', '78', '10', '12.82%'],
  ['10kW On-Grid', '42', '5', '11.90%'],
  ['3kW On-Grid', '24', '1', '4.17%'],
  ['On-Grid (Other)', '12', '0', '0%'],
];

const assignedEmployeeRows = [
  { employee: 'Rohit Singh', leads: '48', won: '8', conversion: '16.67%', assignee: { name: 'Rohit Singh', initials: 'RS', tone: 'amber' } },
  { employee: 'Amit Sharma', leads: '36', won: '4', conversion: '11.11%', assignee: { name: 'Amit Sharma', initials: 'AS', tone: 'amber' } },
  { employee: 'Neha Jain', leads: '28', won: '3', conversion: '10.71%', assignee: { name: 'Neha Jain', initials: 'NJ', tone: 'sky' } },
  { employee: 'Vikram Singh', leads: '22', won: '1', conversion: '4.55%', assignee: { name: 'Vikram Singh', initials: 'VS', tone: 'emerald' } },
];

const ivrsReportRows = [
  ['Total Unique IVRS', '142'],
  ['Duplicate IVRS Found', '14'],
  ['Duplicate Rate', '9.86%'],
  ['IVRS Verified Leads', '128 (90.14%)'],
];

const userManagementRows = [
  { id: 1, name: 'Rohit Singh', email: 'rohit.singh@malwasolar.com', mobile: '9876543210', role: 'Sales Executive', branch: 'Indore Branch', status: 'Active', createdOn: '10 May 2024', assignee: { name: 'Rohit Singh', initials: 'RS', tone: 'amber' } },
  { id: 2, name: 'Neha Jain', email: 'neha.jain@malwasolar.com', mobile: '9827456781', role: 'Sales Executive', branch: 'Indore Branch', status: 'Active', createdOn: '11 May 2024', assignee: { name: 'Neha Jain', initials: 'NJ', tone: 'sky' } },
  { id: 3, name: 'Amit Sharma', email: 'amit.sharma@malwasolar.com', mobile: '9876543211', role: 'Team Leader', branch: 'Indore Branch', status: 'Active', createdOn: '08 May 2024', assignee: { name: 'Amit Sharma', initials: 'AS', tone: 'amber' } },
  { id: 4, name: 'Vikram Singh', email: 'vikram.singh@malwasolar.com', mobile: '9753124680', role: 'Sales Executive', branch: 'Ujjain Branch', status: 'Active', createdOn: '12 May 2024', assignee: { name: 'Vikram Singh', initials: 'VS', tone: 'emerald' } },
  { id: 5, name: 'Pooja Verma', email: 'pooja.verma@malwasolar.com', mobile: '9135782469', role: 'Sales Executive', branch: 'Dewas Branch', status: 'Inactive', createdOn: '15 May 2024', assignee: { name: 'Pooja Verma', initials: 'PV', tone: 'sky' } },
  { id: 6, name: 'Sunil Patidar', email: 'sunil.patidar@malwasolar.com', mobile: '9827456782', role: 'Team Leader', branch: 'Ujjain Branch', status: 'Active', createdOn: '09 May 2024', assignee: { name: 'Sunil Patidar', initials: 'SP', tone: 'amber' } },
  { id: 7, name: 'Manish Gupta', email: 'manish.gupta@malwasolar.com', mobile: '9222334455', role: 'Branch Manager', branch: 'Indore Branch', status: 'Active', createdOn: '05 May 2024', assignee: { name: 'Manish Gupta', initials: 'MG', tone: 'emerald' } },
  { id: 8, name: 'Kavita Joshi', email: 'kavita.joshi@malwasolar.com', mobile: '9870098765', role: 'Sales Executive', branch: 'Dewas Branch', status: 'Active', createdOn: '14 May 2024', assignee: { name: 'Kavita Joshi', initials: 'KJ', tone: 'sky' } },
  { id: 9, name: 'Jatin Agrawal', email: 'jatin.agrawal@malwasolar.com', mobile: '9340011223', role: 'Team Leader', branch: 'Dewas Branch', status: 'Inactive', createdOn: '16 May 2024', assignee: { name: 'Jatin Agrawal', initials: 'JA', tone: 'amber' } },
  { id: 10, name: 'Admin User', email: 'admin@malwasolar.com', mobile: '9999999991', role: 'Super Admin', branch: 'Head Office', status: 'Active', createdOn: '01 May 2024', assignee: { name: 'Admin User', initials: 'AU', tone: 'emerald' } },
];

const userManagementStats = [
  { label: 'Total Users', value: '28', icon: Users, tone: 'primary' },
  { label: 'Active Users', value: '24', icon: CheckCircle2, tone: 'success' },
  { label: 'Inactive Users', value: '4', icon: UserRound, tone: 'warning' },
  { label: 'Super Admins', value: '2', icon: ShieldCheck, tone: 'purple' },
];

const roleCards = [
  { name: 'Super Admin', type: 'System Role', users: 1, icon: ShieldCheck, tone: 'green' },
  { name: 'Admin', type: 'System Role', users: 2, icon: ShieldCheck, tone: 'blue' },
  { name: 'Branch Manager', type: 'Custom Role', users: 3, icon: UsersRound, tone: 'purple' },
  { name: 'Team Leader', type: 'Custom Role', users: 4, icon: Users, tone: 'amber' },
  { name: 'Sales Executive', type: 'Custom Role', users: 18, icon: Users, tone: 'cyan' },
  { name: 'Viewer', type: 'Custom Role', users: 1, icon: Eye, tone: 'pink' },
];

const permissionModules = [
  'Dashboard',
  'Leads',
  'Follow-ups',
  'IVRS Management',
  'Approvals',
  'Project Management',
  'Liaisoning & Commissioning',
  'O&M',
  'Accounts',
  'Reports',
  'User Management',
  'Settings',
];

const activityLogRows = [
  { id: 1, time: '20 May 2024, 10:30 AM', user: userManagementRows[0], module: 'Leads', action: 'Created', details: 'Created new lead with name "Amit Sharma" (Lead ID: LEAD12345)', ip: '192.168.1.101' },
  { id: 2, time: '20 May 2024, 10:15 AM', user: userManagementRows[1], module: 'Follow-ups', action: 'Updated', details: 'Updated follow-up for lead "Amit Sharma" (Follow-up ID: FU1234)', ip: '192.168.1.102' },
  { id: 3, time: '20 May 2024, 09:45 AM', user: userManagementRows[2], module: 'IVRS Management', action: 'Requested', details: 'Requested new lead with IVRS Number "IVRS123456"', ip: '192.168.1.103' },
  { id: 4, time: '20 May 2024, 09:30 AM', user: userManagementRows[9], module: 'Approvals', action: 'Approved', details: 'Approved IVRS request for lead "Sunil Patidar" (IVRS Number: IVRS789012)', ip: '192.168.1.101' },
  { id: 5, time: '19 May 2024, 04:20 PM', user: userManagementRows[4], module: 'Leads', action: 'Edited', details: 'Edited lead "Sunil Patidar" (Lead ID: LEAD78901)', ip: '192.168.1.104' },
  { id: 6, time: '19 May 2024, 03:10 PM', user: userManagementRows[3], module: 'Users', action: 'Created', details: 'Created new user "Manish Gupta" with role "Team Leader"', ip: '192.168.1.102' },
  { id: 7, time: '19 May 2024, 11:05 AM', user: userManagementRows[0], module: 'Roles & Permissions', action: 'Updated', details: 'Updated permissions for role "Branch Manager"', ip: '192.168.1.101' },
  { id: 8, time: '18 May 2024, 05:40 PM', user: userManagementRows[1], module: 'Follow-ups', action: 'Deleted', details: 'Deleted follow-up (Follow-up ID: FU5678) for lead "Kavita Joshi"', ip: '192.168.1.102' },
  { id: 9, time: '18 May 2024, 02:30 PM', user: userManagementRows[5], module: 'Project Management', action: 'Created', details: 'Created new project "5kW On-Grid - Patidar" (Project ID: PRJ1234)', ip: '192.168.1.105' },
  { id: 10, time: '18 May 2024, 10:20 AM', user: userManagementRows[9], module: 'Settings', action: 'Updated', details: 'Updated system settings - Follow-up reminder days set to 3', ip: '192.168.1.101' },
];

const userDetailPermissions = [
  { module: 'Dashboard', icon: Home, permissions: 'View', access: 'Full Access' },
  { module: 'Leads', icon: Users, permissions: 'View, Add, Edit, Export', access: 'Full Access' },
  { module: 'Follow-ups', icon: Clock3, permissions: 'View, Add, Edit, Delete', access: 'Full Access' },
  { module: 'IVRS Management', icon: Settings, permissions: 'View, Add, Edit', access: 'Full Access' },
  { module: 'Approvals', icon: ShieldCheck, permissions: 'View', access: 'View Only' },
  { module: 'Project Management', icon: FolderKanban, permissions: 'View', access: 'View Only' },
  { module: 'Reports', icon: BarChart3, permissions: 'View, Export', access: 'Full Access' },
  { module: 'Activity Logs', icon: Eye, permissions: 'View', access: 'View Only' },
];

const userDetailActivitySummary = [
  { label: 'Total Leads Assigned', value: '152', detail: 'View Details', icon: Users, tone: 'green' },
  { label: 'Open Follow-ups', value: '18', detail: 'View Details', icon: CalendarDays, tone: 'blue' },
  { label: 'Leads Converted', value: '26', detail: 'View Details', icon: UserPlus, tone: 'amber' },
  { label: 'Projects Assigned', value: '8', detail: 'View Details', icon: ClipboardPlus, tone: 'purple' },
];

const userDetailLoginHistory = [
  { time: '20 May 2024, 10:15 AM', device: 'Chrome on Windows', ip: '192.168.1.101', status: 'Success' },
  { time: '19 May 2024, 06:42 PM', device: 'Android App', ip: '192.168.1.112', status: 'Success' },
  { time: '18 May 2024, 09:04 AM', device: 'Chrome on Windows', ip: '192.168.1.101', status: 'Success' },
  { time: '17 May 2024, 08:58 AM', device: 'Safari on iPhone', ip: '192.168.1.118', status: 'Success' },
];

const userDetailProjects = [
  { name: '5kW On-Grid - Amit Sharma', stage: 'Site Visit', value: 'Rs 3.2L' },
  { name: '10kW On-Grid - Sunil Verma', stage: 'Quotation', value: 'Rs 6.4L' },
  { name: '7.5kW On-Grid - Rajesh Gupta', stage: 'Installation', value: 'Rs 4.9L' },
];

const userDetailLeads = [
  { name: 'Amit Sharma', project: '5kW On-Grid', status: 'Follow-up' },
  { name: 'Pooja Mehta', project: '3kW On-Grid', status: 'New' },
  { name: 'Deepak Joshi', project: '10kW On-Grid', status: 'Quotation' },
  { name: 'Kavita Rana', project: '7.5kW On-Grid', status: 'Follow-up' },
];

const projectManagementRows = [
  {
    id: 1,
    projectName: '5kW On-Grid System',
    customer: 'Amit Sharma',
    site: 'Indore, MP',
    type: 'On-Grid',
    status: 'Planning',
    assignedTo: { name: 'Rohit Singh', initials: 'RS', tone: 'amber' },
    targetDate: '25 May 2024',
  },
  {
    id: 2,
    projectName: '10kW On-Grid System',
    customer: 'Sunil Patidar',
    site: 'Ujjain, MP',
    type: 'On-Grid',
    status: 'Site Survey',
    assignedTo: { name: 'Neha Jain', initials: 'NJ', tone: 'sky' },
    targetDate: '28 May 2024',
  },
  {
    id: 3,
    projectName: '3kW On-Grid System',
    customer: 'Kavita Joshi',
    site: 'Indore, MP',
    type: 'On-Grid',
    status: 'Design',
    assignedTo: { name: 'Amit Sharma', initials: 'AS', tone: 'amber' },
    targetDate: '30 May 2024',
  },
  {
    id: 4,
    projectName: '15kW Hybrid System',
    customer: 'Manish Gupta',
    site: 'Dewas, MP',
    type: 'Hybrid',
    status: 'Installation',
    assignedTo: { name: 'Vikram Singh', initials: 'VS', tone: 'emerald' },
    targetDate: '05 Jun 2024',
  },
  {
    id: 5,
    projectName: '10kW Off-Grid System',
    customer: 'Pooja Verma',
    site: 'Indore, MP',
    type: 'Off-Grid',
    status: 'Procurement',
    assignedTo: { name: 'Pooja Verma', initials: 'PV', tone: 'sky' },
    targetDate: '08 Jun 2024',
  },
  {
    id: 6,
    projectName: '5kW Hybrid System',
    customer: 'Ramesh Yadav',
    site: 'Ujjain, MP',
    type: 'Hybrid',
    status: 'Quality Check',
    assignedTo: { name: 'Sunil Patidar', initials: 'SP', tone: 'amber' },
    targetDate: '10 Jun 2024',
  },
  {
    id: 7,
    projectName: '20kW On-Grid System',
    customer: 'Vijay Singh',
    site: 'Indore, MP',
    type: 'On-Grid',
    status: 'Completed',
    assignedTo: { name: 'Rohit Singh', initials: 'RS', tone: 'amber' },
    targetDate: '12 Jun 2024',
  },
  {
    id: 8,
    projectName: '7.5kW On-Grid System',
    customer: 'Anjali Mehta',
    site: 'Dewas, MP',
    type: 'On-Grid',
    status: 'On Hold',
    assignedTo: { name: 'Neha Jain', initials: 'NJ', tone: 'sky' },
    targetDate: '15 Jun 2024',
  },
];

const projectManagementFeatures = [
  'Project Planning & Tracking',
  'Site Survey Management',
  'Design & Documentation',
  'Installation Management',
  'Procurement & Inventory',
  'Quality Check & Handover',
];

const inventoryRows = [
  { id: 1, productName: 'Solar Panel 550W', sku: 'SP-550W', category: 'Solar Panel', warehouse: 'Indore Warehouse', stock: 320, reserved: 45, available: 275, status: 'In Stock' },
  { id: 2, productName: 'Solar Inverter 5kW', sku: 'INV-5KW', category: 'Inverter', warehouse: 'Indore Warehouse', stock: 85, reserved: 10, available: 75, status: 'In Stock' },
  { id: 3, productName: 'Solar Battery 100Ah', sku: 'BAT-100AH', category: 'Battery', warehouse: 'Bhopal Warehouse', stock: 60, reserved: 5, available: 55, status: 'In Stock' },
  { id: 4, productName: 'Mounting Structure', sku: 'MS-001', category: 'Structure', warehouse: 'Indore Warehouse', stock: 450, reserved: 50, available: 400, status: 'In Stock' },
  { id: 5, productName: 'DC Cable 6 sqmm', sku: 'DC-6SQ', category: 'Cable', warehouse: 'Ujjain Warehouse', stock: 1200, reserved: 100, available: 1100, status: 'In Stock' },
  { id: 6, productName: 'MC4 Connector', sku: 'MC4-CON', category: 'Accessories', warehouse: 'Indore Warehouse', stock: 500, reserved: 200, available: 300, status: 'Low Stock' },
  { id: 7, productName: 'ACDB Box', sku: 'ACDB-01', category: 'Accessories', warehouse: 'Bhopal Warehouse', stock: 15, reserved: 5, available: 10, status: 'Low Stock' },
  { id: 8, productName: 'Solar Panel 440W', sku: 'SP-440W', category: 'Solar Panel', warehouse: 'Ujjain Warehouse', stock: 0, reserved: 0, available: 0, status: 'Out of Stock' },
];

const recentStockInwardRows = [
  { productName: 'Solar Panel 550W', warehouse: 'Indore Warehouse', date: '20 May 2024' },
  { productName: 'Solar Inverter 5kW', warehouse: 'Indore Warehouse', date: '19 May 2024' },
  { productName: 'Solar Battery 100Ah', warehouse: 'Bhopal Warehouse', date: '18 May 2024' },
  { productName: 'DC Cable 6 sqmm', warehouse: 'Ujjain Warehouse', date: '17 May 2024' },
];

const inventoryQuickActions = [
  { label: 'Add Stock Inward', description: 'Add new stock to inventory', icon: ClipboardPlus, tone: 'green' },
  { label: 'Stock Outward', description: 'Issue stock to project/site', icon: UserPlus, tone: 'amber' },
  { label: 'Stock Transfer', description: 'Transfer between warehouses', icon: RefreshCw, tone: 'purple' },
  { label: 'Adjust Stock', description: 'Update stock manually', icon: ShieldCheck, tone: 'blue' },
  { label: 'View All Products', description: 'Manage all products', icon: Boxes, tone: 'purple' },
];

const inventoryProductMeta = {
  'SP-550W': { brand: 'Waaree', unit: 'Nos', sellingPrice: 18500 },
  'INV-5KW': { brand: 'Growatt', unit: 'Nos', sellingPrice: 45000 },
  'BAT-100AH': { brand: 'Luminous', unit: 'Nos', sellingPrice: 12500 },
  'MS-001': { brand: 'UTL', unit: 'Set', sellingPrice: 2800 },
  'DC-6SQ': { brand: 'Polycab', unit: 'Meter', sellingPrice: 95 },
  'MC4-CON': { brand: 'Staubli', unit: 'Nos', sellingPrice: 55 },
  'ACDB-01': { brand: 'Havells', unit: 'Nos', sellingPrice: 1250 },
  'SP-440W': { brand: 'Canadian Solar', unit: 'Nos', sellingPrice: 15500 },
};

const inventoryTopCategories = [
  { label: 'Solar Panel', value: '28 Products', icon: Boxes },
  { label: 'Inverter', value: '18 Products', icon: ReceiptText },
  { label: 'Battery', value: '12 Products', icon: ClipboardPlus },
  { label: 'Accessories', value: '20 Products', icon: Settings },
  { label: 'Cable', value: '8 Products', icon: Wrench },
  { label: 'Structure', value: '10 Products', icon: FolderKanban },
];

const inventoryRecentActivities = [
  { title: 'Solar Panel 550W added', by: 'Admin', date: '20 May 2024', tone: 'green', icon: CheckCircle2 },
  { title: 'Solar Inverter 5kW updated', by: 'Admin', date: '19 May 2024', tone: 'blue', icon: FileText },
  { title: 'MC4 Connector stock low', by: 'System', date: '19 May 2024', tone: 'amber', icon: AlertTriangle },
  { title: 'ACDB Box stock low', by: 'System', date: '18 May 2024', tone: 'red', icon: AlertTriangle },
];

const stockInwardRows = [
  { id: 1, orderNo: 'PO-2024-062', invoiceNo: 'INV-2024-062', party: 'Waaree Energies Ltd.', warehouse: 'Indore Warehouse', date: '20 May 2024', items: 8, quantity: 320, value: 1875000, status: 'Completed' },
  { id: 2, orderNo: 'PO-2024-061', invoiceNo: 'INV-2024-061', party: 'Growatt New Energy', warehouse: 'Indore Warehouse', date: '19 May 2024', items: 5, quantity: 85, value: 450000, status: 'Completed' },
  { id: 3, orderNo: 'PO-2024-060', invoiceNo: 'INV-2024-060', party: 'Luminous Power', warehouse: 'Bhopal Warehouse', date: '18 May 2024', items: 6, quantity: 60, value: 1235000, status: 'Completed' },
  { id: 4, orderNo: 'PO-2024-059', invoiceNo: 'INV-2024-059', party: 'UTL Solar', warehouse: 'Indore Warehouse', date: '17 May 2024', items: 10, quantity: 450, value: 825000, status: 'Completed' },
  { id: 5, orderNo: 'PO-2024-058', invoiceNo: 'INV-2024-058', party: 'Polycab India Ltd.', warehouse: 'Ujjain Warehouse', date: '16 May 2024', items: 12, quantity: 1200, value: 114000, status: 'Completed' },
  { id: 6, orderNo: 'PO-2024-057', invoiceNo: 'INV-2024-057', party: 'Staubli Electrical', warehouse: 'Indore Warehouse', date: '15 May 2024', items: 7, quantity: 500, value: 27500, status: 'Partially Received' },
  { id: 7, orderNo: 'PO-2024-056', invoiceNo: 'INV-2024-056', party: 'Havells India Ltd.', warehouse: 'Bhopal Warehouse', date: '14 May 2024', items: 4, quantity: 15, value: 1250, status: 'Completed' },
  { id: 8, orderNo: 'PO-2024-055', invoiceNo: 'INV-2024-055', party: 'Canadian Solar Inc.', warehouse: 'Indore Warehouse', date: '13 May 2024', items: 6, quantity: 0, value: 0, status: 'Pending' },
];

const stockOutwardRows = [
  { id: 1, orderNo: 'SO-2024-058', invoiceNo: 'INV-2024-058', party: 'Sunlight Enterprises', warehouse: 'Indore Warehouse', date: '20 May 2024', items: 7, quantity: 320, value: 1875000, status: 'Delivered' },
  { id: 2, orderNo: 'SO-2024-057', invoiceNo: 'INV-2024-057', party: 'Green Power Solutions', warehouse: 'Bhopal Warehouse', date: '19 May 2024', items: 5, quantity: 85, value: 435000, status: 'Delivered' },
  { id: 3, orderNo: 'SO-2024-056', invoiceNo: 'INV-2024-056', party: 'Ravi Electricals', warehouse: 'Indore Warehouse', date: '18 May 2024', items: 6, quantity: 150, value: 980000, status: 'Delivered' },
  { id: 4, orderNo: 'SO-2024-055', invoiceNo: 'INV-2024-055', party: 'Bright Solar Pvt. Ltd.', warehouse: 'Ujjain Warehouse', date: '17 May 2024', items: 8, quantity: 450, value: 2240000, status: 'Delivered' },
  { id: 5, orderNo: 'SO-2024-054', invoiceNo: 'INV-2024-054', party: 'Technovolt Energy', warehouse: 'Indore Warehouse', date: '16 May 2024', items: 4, quantity: 120, value: 610000, status: 'In Transit' },
  { id: 6, orderNo: 'SO-2024-053', invoiceNo: 'INV-2024-053', party: 'Kiran Solar System', warehouse: 'Bhopal Warehouse', date: '15 May 2024', items: 3, quantity: 60, value: 275000, status: 'In Transit' },
  { id: 7, orderNo: 'SO-2024-052', invoiceNo: 'INV-2024-052', party: 'Shree Ram Traders', warehouse: 'Indore Warehouse', date: '14 May 2024', items: 5, quantity: 200, value: 860000, status: 'Pending' },
  { id: 8, orderNo: 'SO-2024-051', invoiceNo: 'INV-2024-051', party: 'Nirman Projects', warehouse: 'Ujjain Warehouse', date: '13 May 2024', items: 2, quantity: 25, value: 115540, status: 'Pending' },
];

const stockInwardTopParties = [
  ['Waaree Energies Ltd.', '18 Orders'],
  ['Growatt New Energy', '12 Orders'],
  ['Luminous Power', '8 Orders'],
  ['UTL Solar', '7 Orders'],
  ['Polycab India Ltd.', '6 Orders'],
];

const stockOutwardTopParties = [
  ['Sunlight Enterprises', '12 Orders'],
  ['Green Power Solutions', '9 Orders'],
  ['Bright Solar Pvt. Ltd.', '7 Orders'],
  ['Ravi Electricals', '6 Orders'],
  ['Others', '24 Orders'],
];

const stockTransferRows = [
  { id: 1, transferNo: 'ST-2024-047', transferDate: '20 May 2024', fromWarehouse: 'Indore Warehouse', toWarehouse: 'Bhopal Warehouse', items: 8, quantity: 320, value: 187500, status: 'Completed' },
  { id: 2, transferNo: 'ST-2024-046', transferDate: '19 May 2024', fromWarehouse: 'Ujjain Warehouse', toWarehouse: 'Indore Warehouse', items: 5, quantity: 85, value: 435000, status: 'Completed' },
  { id: 3, transferNo: 'ST-2024-045', transferDate: '18 May 2024', fromWarehouse: 'Indore Warehouse', toWarehouse: 'Ujjain Warehouse', items: 6, quantity: 150, value: 980000, status: 'Completed' },
  { id: 4, transferNo: 'ST-2024-044', transferDate: '17 May 2024', fromWarehouse: 'Bhopal Warehouse', toWarehouse: 'Indore Warehouse', items: 10, quantity: 450, value: 2240000, status: 'In Transit' },
  { id: 5, transferNo: 'ST-2024-043', transferDate: '16 May 2024', fromWarehouse: 'Indore Warehouse', toWarehouse: 'Gwalior Warehouse', items: 4, quantity: 120, value: 610000, status: 'In Transit' },
  { id: 6, transferNo: 'ST-2024-042', transferDate: '15 May 2024', fromWarehouse: 'Jabalpur Warehouse', toWarehouse: 'Bhopal Warehouse', items: 3, quantity: 60, value: 275000, status: 'Pending' },
  { id: 7, transferNo: 'ST-2024-041', transferDate: '14 May 2024', fromWarehouse: 'Indore Warehouse', toWarehouse: 'Jabalpur Warehouse', items: 7, quantity: 200, value: 860000, status: 'Pending' },
  { id: 8, transferNo: 'ST-2024-040', transferDate: '13 May 2024', fromWarehouse: 'Ujjain Warehouse', toWarehouse: 'Gwalior Warehouse', items: 2, quantity: 25, value: 115540, status: 'Cancelled' },
];

const stockTransferTopWarehouses = [
  ['Indore Warehouse', '18 Transfers'],
  ['Ujjain Warehouse', '9 Transfers'],
  ['Bhopal Warehouse', '8 Transfers'],
  ['Jabalpur Warehouse', '6 Transfers'],
  ['Others', '6 Transfers'],
];

const inventoryAdjustmentRows = [
  { id: 1, adjustmentNo: 'ADJ-2024-038', date: '20 May 2024', type: 'Stock Increase', reason: 'Stock Found', warehouse: 'Indore Warehouse', items: 6, quantity: 320, value: 1875000, status: 'Completed' },
  { id: 2, adjustmentNo: 'ADJ-2024-037', date: '19 May 2024', type: 'Stock Decrease', reason: 'Damaged Goods', warehouse: 'Bhopal Warehouse', items: 4, quantity: -85, value: 435000, status: 'Completed' },
  { id: 3, adjustmentNo: 'ADJ-2024-036', date: '18 May 2024', type: 'Stock Increase', reason: 'Counting Difference', warehouse: 'Ujjain Warehouse', items: 5, quantity: 150, value: 980000, status: 'Completed' },
  { id: 4, adjustmentNo: 'ADJ-2024-035', date: '17 May 2024', type: 'Stock Decrease', reason: 'Expired Items', warehouse: 'Indore Warehouse', items: 3, quantity: -120, value: 610000, status: 'Completed' },
  { id: 5, adjustmentNo: 'ADJ-2024-034', date: '16 May 2024', type: 'Stock Increase', reason: 'Return Accepted', warehouse: 'Gwalior Warehouse', items: 4, quantity: 200, value: 860000, status: 'In Review' },
  { id: 6, adjustmentNo: 'ADJ-2024-033', date: '15 May 2024', type: 'Stock Decrease', reason: 'Wrong Item', warehouse: 'Jabalpur Warehouse', items: 2, quantity: -60, value: 275000, status: 'Pending' },
  { id: 7, adjustmentNo: 'ADJ-2024-032', date: '14 May 2024', type: 'Stock Increase', reason: 'Manufacturer Bonus', warehouse: 'Indore Warehouse', items: 6, quantity: 300, value: 1245000, status: 'Completed' },
  { id: 8, adjustmentNo: 'ADJ-2024-031', date: '13 May 2024', type: 'Stock Decrease', reason: 'Theft / Loss', warehouse: 'Bhopal Warehouse', items: 2, quantity: -25, value: 115540, status: 'Cancelled' },
];

const inventoryTopReasons = [
  ['Stock Found', '12 Adjustments'],
  ['Damaged Goods', '8 Adjustments'],
  ['Counting Difference', '6 Adjustments'],
  ['Expired Items', '5 Adjustments'],
  ['Others', '7 Adjustments'],
];

const warehouseRows = [
  { id: 1, code: 'WH-IND-001', name: 'Indore Warehouse', type: 'Main Warehouse', location: 'Indore, MP', manager: 'Rohit Singh', capacity: 8000, utilization: 75.25, status: 'Active' },
  { id: 2, code: 'WH-BPL-001', name: 'Bhopal Warehouse', type: 'Main Warehouse', location: 'Bhopal, MP', manager: 'Neha Kumari', capacity: 6000, utilization: 62.10, status: 'Active' },
  { id: 3, code: 'WH-UJN-001', name: 'Ujjain Warehouse', type: 'Branch Warehouse', location: 'Ujjain, MP', manager: 'Vikram Patel', capacity: 3500, utilization: 80.00, status: 'Active' },
  { id: 4, code: 'WH-JBP-001', name: 'Jabalpur Warehouse', type: 'Branch Warehouse', location: 'Jabalpur, MP', manager: 'Amit Sharma', capacity: 3000, utilization: 55.33, status: 'Active' },
  { id: 5, code: 'WH-GWL-001', name: 'Gwalior Warehouse', type: 'Branch Warehouse', location: 'Gwalior, MP', manager: 'Sunil Verma', capacity: 2500, utilization: 70.40, status: 'Active' },
  { id: 6, code: 'WH-RTL-001', name: 'Ratlam Warehouse', type: 'Storage Point', location: 'Ratlam, MP', manager: 'Pooja Mehta', capacity: 1800, utilization: 48.61, status: 'Active' },
  { id: 7, code: 'WH-KTP-001', name: 'Katni Warehouse', type: 'Storage Point', location: 'Katni, MP', manager: 'Rajesh Gupta', capacity: 800, utilization: 38.75, status: 'Active' },
  { id: 8, code: 'WH-SGR-001', name: 'Sagar Warehouse', type: 'Storage Point', location: 'Sagar, MP', manager: 'Manish Tiwari', capacity: 2000, utilization: 0, status: 'Inactive' },
];

const accountsListRows = [
  { id: 1, code: 'ACC-001', name: 'Sunlight Enterprises', type: 'Customer', group: 'Corporate', phone: '+91 98765 43210', email: 'info@sunlight.com', status: 'Active', amount: 1875000 },
  { id: 2, code: 'ACC-002', name: 'Green Power Solutions', type: 'Customer', group: 'Corporate', phone: '+91 91234 56780', email: 'contact@greenpower.com', status: 'Active', amount: 1245000 },
  { id: 3, code: 'ACC-003', name: 'Ravi Electricals', type: 'Supplier', group: 'Vendor', phone: '+91 99887 76655', email: 'ravi.electricals@gmail.com', status: 'Active', amount: 980000 },
  { id: 4, code: 'ACC-004', name: 'Bright Solar Pvt. Ltd.', type: 'Customer', group: 'Corporate', phone: '+91 87766 55443', email: 'sales@brightsolar.com', status: 'Active', amount: 760000 },
  { id: 5, code: 'ACC-005', name: 'Sun Solar Systems', type: 'Customer', group: 'Retail', phone: '+91 76554 43322', email: 'hello@sunsolar.com', status: 'Inactive', amount: 625000 },
  { id: 6, code: 'ACC-006', name: 'Electro Components Ltd.', type: 'Supplier', group: 'Vendor', phone: '+91 94567 89012', email: 'sales@electro.com', status: 'Active', amount: 540000 },
  { id: 7, code: 'ACC-007', name: 'Ultra Power Projects', type: 'Customer', group: 'Corporate', phone: '+91 78945 61230', email: 'info@ultrapower.com', status: 'Active', amount: 520000 },
  { id: 8, code: 'ACC-008', name: 'Shree Ram Traders', type: 'Supplier', group: 'Vendor', phone: '+91 96325 48741', email: 'shreeramtraders@gmail.com', status: 'Active', amount: 410000 },
];

const accountRows = [
  { id: 1, name: 'SunPower Solutions Pvt. Ltd.', type: 'Customer', contact: 'Amit Sharma', phone: '9876543210', status: 'Active', receivables: 125000, location: 'Indore', assignedTo: 'Rohit Singh' },
  { id: 2, name: 'GreenVolt Energy LLP', type: 'Customer', contact: 'Neha Jain', phone: '9823456781', status: 'Active', receivables: 85400, location: 'Ujjain', assignedTo: 'Neha Jain' },
  { id: 3, name: 'Bright Solar Infrastructure', type: 'Partner', contact: 'Vikram Singh', phone: '9753186420', status: 'Active', receivables: 0, location: 'Bhopal', assignedTo: 'Amit Sharma' },
  { id: 4, name: 'ElectroTech Suppliers', type: 'Vendor', contact: 'Ramesh Yadav', phone: '9712345678', status: 'Active', receivables: -45780, location: 'Indore', assignedTo: 'Vikram Singh' },
  { id: 5, name: 'SolarTown Projects', type: 'Customer', contact: 'Pooja Verma', phone: '9898765432', status: 'Pending', receivables: 245600, location: 'Dewas', assignedTo: 'Pooja Verma' },
  { id: 6, name: 'Future Energy India', type: 'Partner', contact: 'Anjali Mehta', phone: '9811122233', status: 'Inactive', receivables: 0, location: 'Ujjain', assignedTo: 'Sunil Patidar' },
  { id: 7, name: 'VoltEdge Components', type: 'Vendor', contact: 'Karan Malhotra', phone: '9776655443', status: 'Active', receivables: -125000, location: 'Bhopal', assignedTo: 'Rohit Singh' },
];

const accountTransactionRows = [
  { id: 1, date: '20 May 2024', reference: 'INV-2024-1256', accountName: 'SunPower Solutions Pvt. Ltd.', type: 'Invoice', amount: 75000, paymentMode: 'Bank Transfer', status: 'Paid' },
  { id: 2, date: '19 May 2024', reference: 'PAY-2024-0987', accountName: 'ElectroTech Suppliers', type: 'Payment', amount: 45780, paymentMode: 'UPI', status: 'Completed' },
  { id: 3, date: '18 May 2024', reference: 'INV-2024-1255', accountName: 'SolarTown Projects', type: 'Invoice', amount: 125600, paymentMode: 'NEFT', status: 'Pending' },
  { id: 4, date: '17 May 2024', reference: 'EXP-2024-0678', accountName: 'Office Expense', type: 'Expense', amount: 5420, paymentMode: 'Cash', status: 'Completed' },
];

const accountSummaryRows = [
  { label: 'Total Invoices', value: 'Rs 3,10,25,600', icon: FileText, tone: 'red' },
  { label: 'Total Payments Received', value: 'Rs 2,35,40,280', icon: ReceiptText, tone: 'red' },
  { label: 'Total Expenses', value: 'Rs 48,75,320', icon: FileText, tone: 'red' },
  { label: 'Total Refunds', value: 'Rs 6,25,000', icon: RefreshCw, tone: 'blue' },
  { label: 'Net Profit', value: 'Rs 1,86,24,960', icon: BarChart3, tone: 'green' },
];

const accountAgingRows = [
  { label: '0 - 30 Days', value: 'Rs 8,75,320 (47%)', color: 'bg-[#2eb872]' },
  { label: '31 - 60 Days', value: 'Rs 5,25,400 (28%)', color: 'bg-[#f6b62d]' },
  { label: '61 - 90 Days', value: 'Rs 2,45,600 (13%)', color: 'bg-[#f59e0b]' },
  { label: '90+ Days', value: 'Rs 2,29,000 (12%)', color: 'bg-[#ef4444]' },
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
                  const isEmployeeSection = item.label === 'Employee Management';
                  const isAccountsSection = item.label === 'Accounts';
                  const isInventorySection = item.label === 'Inventory';
                  const isLeadOpen = isLeadSection && (activeSidebarItem === 'Lead' || leadRelatedPages.includes(activeSidebarItem));
                  const isEmployeeOpen = isEmployeeSection && (activeSidebarItem === 'Employee Management' || employeeRelatedPages.includes(activeSidebarItem));
                  const isAccountsOpen = isAccountsSection && (activeSidebarItem === 'Accounts' || accountsRelatedPages.includes(activeSidebarItem));
                  const isInventoryOpen = isInventorySection && (activeSidebarItem === 'Inventory' || inventoryRelatedPages.includes(activeSidebarItem));
                  const isActive = item.label === activeSidebarItem || isLeadOpen || isEmployeeOpen || isAccountsOpen || isInventoryOpen;

                  return (
                    <div key={item.label}>
                      <button
                        type="button"
                        onClick={() => {
                          const nextItem = isLeadSection ? 'Lead List' : isEmployeeSection ? 'Users' : isAccountsSection ? 'Accounts List' : isInventorySection ? 'Overview' : item.label;
                          setActiveSidebarItem(nextItem);
                          setMobileSidebarOpen(false);
                          notify(`${nextItem} section selected`);
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
                          <ChevronRight className={cx('size-4 shrink-0 text-white/90 transition', (isLeadOpen || isEmployeeOpen || isAccountsOpen || isInventoryOpen) && '-rotate-90')} />
                        ) : null}
                        {item.disabled && !desktopSidebarCollapsed ? (
                          <span className="rounded-[6px] bg-white/16 px-2 py-1 text-[9px] font-extrabold text-white/90">
                            Disabled
                          </span>
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
                      {isEmployeeOpen && !desktopSidebarCollapsed ? (
                        <div className="my-2 rounded-[8px] bg-white px-4 py-3 shadow-[0_12px_24px_rgba(8,65,119,0.16)]">
                          <div className="space-y-1">
                            {employeeSubItems.map((subItem) => {
                              const isSubActive = activeSidebarItem === subItem;

                              return (
                                <button
                                  key={subItem}
                                  type="button"
                                  data-route={employeeSubRoutes[subItem]}
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
                      {isAccountsOpen && !desktopSidebarCollapsed ? (
                        <div className="my-2 rounded-[8px] bg-white px-4 py-3 shadow-[0_12px_24px_rgba(8,65,119,0.16)]">
                          <div className="space-y-1">
                            {accountsSubItems.map((subItem) => {
                              const isSubActive = activeSidebarItem === subItem;

                              return (
                                <button
                                  key={subItem}
                                  type="button"
                                  data-route={accountsSubRoutes[subItem]}
                                  onClick={() => {
                                    setActiveSidebarItem(subItem);
                                    setMobileSidebarOpen(false);
                                    notify(`${subItem} opened`);
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
                      {isInventoryOpen && !desktopSidebarCollapsed ? (
                        <div className="my-2 rounded-[8px] bg-white px-4 py-3 shadow-[0_12px_24px_rgba(8,65,119,0.16)]">
                          <div className="space-y-1">
                            {inventorySubItems.map((subItem) => {
                              const isSubActive = activeSidebarItem === subItem;

                              return (
                                <button
                                  key={subItem}
                                  type="button"
                                  data-route={inventorySubRoutes[subItem]}
                                  onClick={() => {
                                    setActiveSidebarItem(subItem);
                                    setMobileSidebarOpen(false);
                                    notify(`${subItem} opened`);
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
                    src={navBarImage}
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

            {activeSidebarItem === 'Users' ? (
              <UserManagementPage onNotify={notify} />
            ) : activeSidebarItem === 'Roles & Permissions' ? (
              <RolesPermissionsPage onNotify={notify} />
            ) : activeSidebarItem === 'Activity Logs' ? (
              <ActivityLogsPage onNotify={notify} />
            ) : activeSidebarItem === 'Reports' ? (
              <ReportsPage onNotify={notify} />
            ) : activeSidebarItem === 'Project Management' ? (
              <ProjectManagementPage onNotify={notify} />
            ) : accountsRelatedPages.includes(activeSidebarItem) ? (
              <AccountsManagementPage
                activeSection={activeSidebarItem}
                onOpenSection={(section) => {
                  setActiveSidebarItem(section);
                  notify(`${section} opened`);
                }}
                onNotify={notify}
              />
            ) : inventoryRelatedPages.includes(activeSidebarItem) ? (
              <InventoryManagementPage
                activeSection={activeSidebarItem}
                onOpenSection={(section) => {
                  setActiveSidebarItem(section);
                  notify(`${section} opened`);
                }}
                onNotify={notify}
              />
            ) : activeSidebarItem === 'Lead List' ? (
              <LeadListPage
                onCreateLead={() => {
                  setActiveSidebarItem('Create Lead');
                  notify('Create Lead opened');
                }}
                onOpenLead={() => {
                  setActiveSidebarItem('Lead Details');
                  notify('Lead Details opened');
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
                onRequestApproval={() => {
                  setActiveSidebarItem('Admin Approval');
                  notify('Admin Approval opened');
                }}
                onNotify={notify}
              />
            ) : activeSidebarItem === 'Lead Details' ? (
              <LeadDetailsPage
                onBackToList={() => {
                  setActiveSidebarItem('Lead List');
                  notify('Lead List opened');
                }}
                onCreateLead={() => {
                  setActiveSidebarItem('Create Lead');
                  notify('Edit Lead opened');
                }}
                onFollowUpHistory={() => {
                  setActiveSidebarItem('Follow-up History');
                  notify('Follow-up History opened');
                }}
                onNotify={notify}
              />
            ) : activeSidebarItem === 'Follow-up History' ? (
              <FollowUpHistoryPage
                onBackToDetails={() => {
                  setActiveSidebarItem('Lead Details');
                  notify('Lead Details opened');
                }}
                onNotify={notify}
              />
            ) : activeSidebarItem === 'Admin Approval' ? (
              <AdminApprovalPage
                onLeadDetails={() => {
                  setActiveSidebarItem('Lead Details');
                  notify('Lead Details opened');
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

function LeadListPage({ onCreateLead, onOpenLead, onNotify }) {
  const [followUpDate, setFollowUpDate] = useState('');
  const [activeLeadCategory, setActiveLeadCategory] = useState(null);
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

      <section className={`${panelClass} overflow-hidden p-3 sm:p-4`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-[16px] font-extrabold text-[#1e3261]">Lead Categories</p>
            <p className="mt-1 text-[12px] font-bold text-[#6f7f98]">
              Quickly review lead quality buckets and add any lead when needed.
            </p>
          </div>
          <button
            type="button"
            onClick={onCreateLead}
            data-route={leadSubRoutes['Create Lead']}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[12px] font-extrabold text-[#0b65e5] transition hover:bg-[#f8fbff]"
          >
            <UserPlus className="size-4" />
            Add any lead
          </button>
        </div>

        <div className="-mx-1 mt-4 overflow-x-auto px-1 pb-1">
          <div className="flex min-w-max gap-3">
            {leadCategoryTabs.map((category) => {
              const Icon = category.icon;
              const tone = leadCategoryToneClasses[category.tone];

              return (
                <button
                  key={category.label}
                  type="button"
                  onClick={() => {
                    setActiveLeadCategory(category);
                    onNotify(`${category.label} details opened`);
                  }}
                  data-action={`open-${category.shortLabel.toLowerCase()}-leads`}
                  className={cx(
                    'group inline-flex h-[54px] min-w-[168px] items-center justify-between gap-3 rounded-[12px] border px-3.5 text-left shadow-[0_10px_20px_rgba(17,39,84,0.04)] transition hover:-translate-y-0.5 focus:border-blue-500 focus:ring-4 focus:ring-blue-100',
                    tone.button,
                  )}
                >
                  <span className="inline-flex min-w-0 items-center gap-3">
                    <span className={cx('grid size-9 shrink-0 place-items-center rounded-[10px]', tone.icon)}>
                      <Icon className="size-[18px]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-extrabold">{category.label}</span>
                      <span className="mt-0.5 block truncate text-[11px] font-bold opacity-75">{category.priority}</span>
                    </span>
                  </span>
                  <span className={cx('rounded-full px-2.5 py-1 text-[11px] font-extrabold', tone.count)}>
                    {category.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

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
              onOpenLead={onOpenLead}
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
                          onClick={onOpenLead}
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
      {activeLeadCategory ? (
        <LeadCategoryModal
          category={activeLeadCategory}
          onClose={() => setActiveLeadCategory(null)}
          onCreateLead={() => {
            const categoryLabel = activeLeadCategory.label;
            setActiveLeadCategory(null);
            onCreateLead();
            onNotify(`Create Lead opened from ${categoryLabel}`);
          }}
          onNotify={onNotify}
        />
      ) : null}
    </div>
  );
}

function LeadCategoryModal({ category, onClose, onCreateLead, onNotify }) {
  const Icon = category.icon;
  const tone = leadCategoryToneClasses[category.tone] || leadCategoryToneClasses.green;
  const visibleLeads = category.leads.map((name, index) => {
    const row = leadListRows.find((lead) => lead.customer === name) || leadListRows[index];
    return row;
  });

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#111827]/45 p-4 backdrop-blur-[2px]">
      <div className="max-h-[92vh] w-full max-w-[760px] overflow-y-auto rounded-[18px] bg-white shadow-[0_30px_70px_rgba(17,24,39,0.28)]">
        <div className={cx('h-2 bg-gradient-to-r', tone.accent)} />
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 gap-3">
              <span className={cx('grid size-12 shrink-0 place-items-center rounded-[14px]', tone.icon)}>
                <Icon className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-[22px] font-extrabold leading-tight text-[#111827]">
                  {category.label}
                </h2>
                <p className="mt-2 max-w-[560px] text-[13px] font-semibold leading-6 text-[#53647f]">
                  {category.description}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-[#d9e4f2] bg-white text-[#7585a2] transition hover:bg-[#f8fbff]"
              aria-label="Close lead category details"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <LeadCategoryInfoCard label="Total leads" value={category.count} />
            <LeadCategoryInfoCard label="Priority" value={category.priority} />
            <LeadCategoryInfoCard label="Next action" value={category.nextAction} compact />
          </div>

          <div className="mt-5 rounded-[14px] border border-[#e7eef7] bg-[#fbfdff] p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display text-[16px] font-extrabold text-[#1e3261]">Sample leads</p>
                <p className="mt-1 text-[12px] font-bold text-[#6f7f98]">
                  Any lead can be added or moved into this category later.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNotify(`${category.label} list filters applied`)}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-3 text-[12px] font-extrabold text-[#0b65e5] transition hover:bg-[#f8fbff]"
              >
                <Search className="size-3.5" />
                Filter list
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              {visibleLeads.map((lead) => (
                <div
                  key={`${category.label}-${lead.ivrs}`}
                  className="flex flex-col gap-3 rounded-[12px] border border-[#e8eef6] bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-[14px] font-extrabold text-[#233a6b]">{lead.customer}</p>
                    <p className="mt-1 text-[12px] font-bold text-[#6f7f98]">
                      {lead.project} | {lead.mobile} | {lead.ivrs}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={category.shortLabel === 'Hot' ? 'Follow-up' : category.shortLabel === 'Lost' ? 'Lost' : lead.status} />
                    <button
                      type="button"
                      onClick={() => onNotify(`${lead.customer} opened from ${category.label}`)}
                      className="inline-flex h-8 items-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-3 text-[12px] font-extrabold text-[#0b65e5] transition hover:bg-[#f8fbff]"
                    >
                      View
                      <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-[12px] border border-[#d9f2e4] bg-[#f3fff7] p-4 text-[13px] font-semibold leading-6 text-[#276747]">
            Any lead can be added to any bucket. The UI is ready now; category rules and API logic can be connected later.
          </div>

          <div className="mt-6 flex flex-col justify-end gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-[8px] border border-[#d9e4f2] bg-white px-6 text-[13px] font-extrabold text-[#233a6b] transition hover:bg-[#f8fbff]"
            >
              Close
            </button>
            <button
              type="button"
              onClick={onCreateLead}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[linear-gradient(90deg,#18b957,#0b72d9)] px-6 text-[13px] font-extrabold text-white shadow-[0_12px_24px_rgba(13,159,74,0.2)] transition hover:-translate-y-0.5"
            >
              <Plus className="size-4" />
              Add Lead
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeadCategoryInfoCard({ label, value, compact = false }) {
  return (
    <div className="rounded-[12px] border border-[#e7eef7] bg-white p-3 shadow-[0_8px_18px_rgba(17,39,84,0.04)]">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#8493ab]">{label}</p>
      <p className={cx('mt-2 font-extrabold text-[#1e3261]', compact ? 'text-[13px] leading-5' : 'text-[20px]')}>
        {value}
      </p>
    </div>
  );
}

function AccountsManagementPage({ activeSection, onOpenSection, onNotify }) {
  const [accounts, setAccounts] = useState(accountRows);
  const [transactions, setTransactions] = useState(accountTransactionRows);
  const [query, setQuery] = useState('');
  const [accountType, setAccountType] = useState('All Types');
  const [status, setStatus] = useState('All Status');
  const [assignedTo, setAssignedTo] = useState('All Users');
  const [location, setLocation] = useState('All Locations');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accountModalMode, setAccountModalMode] = useState(null);
  const [utilityModal, setUtilityModal] = useState(null);

  const filteredAccounts = accounts.filter((account) => {
    const queryText = query.toLowerCase();
    const queryMatch = [account.name, account.contact, account.phone, account.type].some((value) => value.toLowerCase().includes(queryText));
    const typeMatch = accountType === 'All Types' || account.type === accountType;
    const statusMatch = status === 'All Status' || account.status === status;
    const assignedMatch = assignedTo === 'All Users' || account.assignedTo === assignedTo;
    const locationMatch = location === 'All Locations' || account.location === location;
    return queryMatch && typeMatch && statusMatch && assignedMatch && locationMatch;
  });

  const resetFilters = () => {
    setQuery('');
    setAccountType('All Types');
    setStatus('All Status');
    setAssignedTo('All Users');
    setLocation('All Locations');
    onNotify('Account filters reset');
  };

  const saveAccount = (account) => {
    if (account.id) {
      setAccounts((current) => current.map((item) => (item.id === account.id ? account : item)));
      onNotify(`${account.name} updated`);
    } else {
      const newAccount = { ...account, id: Date.now() };
      setAccounts((current) => [newAccount, ...current]);
      onNotify(`${newAccount.name} added`);
    }
    setSelectedAccount(null);
    setAccountModalMode(null);
  };

  const addTransaction = (transaction) => {
    setTransactions((current) => [{ ...transaction, id: Date.now() }, ...current]);
    setUtilityModal(null);
    onNotify(`${transaction.type} transaction saved`);
  };

  const openEditAccount = (account) => {
    setSelectedAccount(account);
    setAccountModalMode('Edit Account');
  };

  if (activeSection === 'Accounts List') {
    return <AccountsListPage onNotify={onNotify} />;
  }

  return (
    <div className="space-y-4">
      <PageHeading
        title="Accounts Management"
        crumbs={[
          { label: 'Dashboard', onClick: () => onNotify('Dashboard breadcrumb selected') },
          { label: 'Accounts Management', onClick: () => onOpenSection('Accounts Overview') },
          { label: activeSection === 'Accounts Overview' ? 'Overview' : activeSection },
        ]}
        actions={(
          <>
            <button type="button" onClick={() => { setSelectedAccount(null); setAccountModalMode('Add Account'); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#078c3e] px-5 text-[13px] font-extrabold text-white shadow-[0_12px_22px_rgba(13,159,74,0.22)] transition hover:-translate-y-0.5 hover:bg-[#067832]">
              <Plus className="size-4" />
              Add Account
            </button>
            <button type="button" onClick={() => setUtilityModal('Import Accounts')} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-5 text-[13px] font-extrabold text-[#1e3261] transition hover:bg-[#f8fbff]">
              <Download className="size-4 text-[#0b65e5]" />
              Import Accounts
            </button>
            <button type="button" onClick={() => setUtilityModal('Accounts Settings')} aria-label="Accounts settings" className="inline-flex size-11 items-center justify-center rounded-[8px] border border-[#d9e4f2] bg-white text-[#233a6b] transition hover:bg-[#f8fbff]">
              <Settings className="size-4" />
            </button>
          </>
        )}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <AccountsStatCard label="Total Accounts" value="236" caption="All Accounts" growth="12.5%" icon={ReceiptText} tone="blue" onClick={() => onOpenSection('Accounts List')} />
        <AccountsStatCard label="Active Customers" value="189" caption="Active Accounts" growth="15.3%" icon={UserPlus} tone="green" onClick={() => { setStatus('Active'); onNotify('Active accounts filter applied'); }} />
        <AccountsStatCard label="Total Receivables" value="Rs 18,75,320" caption="Outstanding Amount" growth="8.4%" negative icon={ReceiptText} tone="amber" onClick={() => onNotify('Receivables opened')} />
        <AccountsStatCard label="Total Payables" value="Rs 6,45,780" caption="Pending Payments" growth="5.7%" negative icon={FileText} tone="purple" onClick={() => onNotify('Payables opened')} />
        <AccountsStatCard label="Total Revenue (YTD)" value="Rs 2,48,96,300" caption="This Financial Year" growth="20.6%" icon={BarChart3} tone="cyan" onClick={() => onNotify('Revenue report opened')} />
      </section>

      <section className={`${panelClass} p-4 sm:p-5`}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.3fr_0.75fr_0.75fr_0.75fr_0.75fr_auto_auto] xl:items-end">
          <label className="flex h-11 items-center gap-3 rounded-[8px] border border-black/20 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
            <Search className="size-4 text-[#7386a3]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search accounts by name, email, phone..."
              className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-[#30466d] outline-none placeholder:text-[#8493ab]"
            />
          </label>
          <ReportSelect label="Account Type" value={accountType} onChange={setAccountType} options={['All Types', 'Customer', 'Partner', 'Vendor']} />
          <ReportSelect label="Status" value={status} onChange={setStatus} options={['All Status', 'Active', 'Pending', 'Inactive']} />
          <ReportSelect label="Assign To" value={assignedTo} onChange={setAssignedTo} options={['All Users', 'Rohit Singh', 'Neha Jain', 'Amit Sharma', 'Vikram Singh', 'Pooja Verma', 'Sunil Patidar']} />
          <ReportSelect label="Location" value={location} onChange={setLocation} options={['All Locations', 'Indore', 'Ujjain', 'Bhopal', 'Dewas']} />
          <button type="button" onClick={() => onNotify(`Account filters applied: ${filteredAccounts.length} results`)} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276] transition hover:bg-[#f8fbff]">
            <RefreshCw className="size-4 text-[#0b65e5]" />
            Filters
          </button>
          <button type="button" onClick={resetFilters} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276] transition hover:bg-[#f8fbff]">
            <RefreshCw className="size-4 text-[#7585a2]" />
            Reset
          </button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-4">
          <article className={`${panelClass} overflow-hidden p-3 sm:p-4`}>
            <div className="flex flex-col gap-2 px-1 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-display text-[15px] font-extrabold text-[#06135a]">{activeSection === 'Accounts Overview' ? 'Recent Accounts' : activeSection}</h2>
              <button type="button" onClick={() => onOpenSection('Accounts List')} className="inline-flex items-center gap-2 text-[12px] font-extrabold text-[#0b65e5]">
                View All
                <ArrowRight className="size-4" />
              </button>
            </div>

            <div className="space-y-3 lg:hidden">
              {filteredAccounts.map((account, index) => (
                <AccountMobileCard key={account.id} account={account} index={index + 1} onOpen={() => openEditAccount(account)} />
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-[12px] border border-[#e7eef7] bg-white lg:block">
              <table className="crm-table min-w-[920px] w-full">
                <thead>
                  <tr>{['#', 'Account Name', 'Account Type', 'Contact Person', 'Phone', 'Status', 'Receivables', 'Action'].map((header) => <th key={header}>{header}</th>)}</tr>
                </thead>
                <tbody>
                  {filteredAccounts.map((account, index) => (
                    <tr key={account.id}>
                      <td>{index + 1}</td>
                      <td className="font-extrabold text-[#1e3261]">{account.name}</td>
                      <td>{account.type}</td>
                      <td>{account.contact}</td>
                      <td>{account.phone}</td>
                      <td><AccountStatusBadge status={account.status} /></td>
                      <td className={account.receivables < 0 ? 'font-extrabold text-[#ef4444]' : 'font-extrabold text-[#1e3261]'}>{formatAccountCurrency(account.receivables)}</td>
                      <td><UserActionButton label={`Edit ${account.name}`} icon={MoreVertical} tone="blue" onClick={() => openEditAccount(account)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-4 px-3 py-5 text-[13px] font-bold text-[#53647f] sm:flex-row sm:items-center sm:justify-between">
              <p>Showing 1 to {filteredAccounts.length} of 236 entries</p>
              <div className="flex flex-wrap items-center gap-2">
                <PaginationButton onClick={() => onNotify('Previous accounts page selected')}><ChevronLeft className="size-4" /></PaginationButton>
                <PaginationButton active onClick={() => onNotify('Accounts page 1 selected')}>1</PaginationButton>
                <PaginationButton onClick={() => onNotify('Accounts page 2 selected')}>2</PaginationButton>
                <PaginationButton onClick={() => onNotify('Accounts page 3 selected')}>3</PaginationButton>
                <span className="px-2 text-[#53647f]">...</span>
                <PaginationButton onClick={() => onNotify('Accounts page 34 selected')}>34</PaginationButton>
                <PaginationButton onClick={() => onNotify('Next accounts page selected')}><ChevronRight className="size-4" /></PaginationButton>
              </div>
            </div>
          </article>

          <AccountsTransactionsTable transactions={transactions} onAdd={() => setUtilityModal('Add Transaction')} onNotify={onNotify} />
        </div>

        <aside className="grid gap-4">
          <ReceivablesPayablesCard onNotify={onNotify} />
          <AccountSummaryCard onNotify={onNotify} />
          <AgingSummaryCard onNotify={onNotify} />
        </aside>
      </section>

      <DashboardFooter />

      {accountModalMode ? (
        <AccountFormModal mode={accountModalMode} account={selectedAccount} onClose={() => { setSelectedAccount(null); setAccountModalMode(null); }} onSave={saveAccount} />
      ) : null}
      {utilityModal ? (
        <AccountUtilityModal type={utilityModal} accounts={accounts} onClose={() => setUtilityModal(null)} onSaveTransaction={addTransaction} onNotify={onNotify} />
      ) : null}
    </div>
  );
}

function AccountsListPage({ onNotify }) {
  const [accounts, setAccounts] = useState(accountsListRows);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('All Types');
  const [status, setStatus] = useState('All Status');
  const [group, setGroup] = useState('All Groups');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [modalType, setModalType] = useState(null);

  const filteredAccounts = accounts.filter((account) => {
    const queryText = query.toLowerCase();
    const queryMatch = [account.code, account.name, account.type, account.email, account.phone].some((value) => value.toLowerCase().includes(queryText));
    const typeMatch = type === 'All Types' || account.type === type;
    const statusMatch = status === 'All Status' || account.status === status;
    const groupMatch = group === 'All Groups' || account.group === group;
    return queryMatch && typeMatch && statusMatch && groupMatch;
  });

  const saveAccount = (account) => {
    const nextAccount = {
      ...account,
      id: account.id || Date.now(),
      code: account.code || `ACC-${String(accounts.length + 1).padStart(3, '0')}`,
    };
    setAccounts((current) => (current.some((item) => item.id === nextAccount.id) ? current.map((item) => (item.id === nextAccount.id ? nextAccount : item)) : [nextAccount, ...current]));
    setSelectedAccount(null);
    setModalType(null);
    onNotify(`${nextAccount.name} saved`);
  };

  const resetFilters = () => {
    setQuery('');
    setType('All Types');
    setStatus('All Status');
    setGroup('All Groups');
    onNotify('Accounts list filters reset');
  };

  return (
    <div className="space-y-4">
      <PageHeading
        title="Accounts List"
        crumbs={[
          { label: 'Dashboard', onClick: () => onNotify('Dashboard breadcrumb selected') },
          { label: 'Accounts', onClick: () => onNotify('Accounts breadcrumb selected') },
          { label: 'Accounts List' },
        ]}
        actions={(
          <>
            <button type="button" onClick={() => { setSelectedAccount(null); setModalType('Add Account'); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#078c3e] px-5 text-[13px] font-extrabold text-white shadow-[0_12px_22px_rgba(13,159,74,0.22)] transition hover:-translate-y-0.5 hover:bg-[#067832]"><Plus className="size-4" />Add Account</button>
            <button type="button" onClick={() => setModalType('Import Accounts')} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-5 text-[13px] font-extrabold text-[#1e3261] transition hover:bg-[#f8fbff]"><Download className="size-4 text-[#0b65e5]" />Import</button>
            <button type="button" onClick={() => onNotify('Accounts list exported')} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-5 text-[13px] font-extrabold text-[#1e3261] transition hover:bg-[#f8fbff]"><Download className="size-4 text-[#0b65e5]" />Export</button>
            <button type="button" onClick={() => setModalType('Accounts Settings')} aria-label="Accounts list settings" className="inline-flex size-11 items-center justify-center rounded-[8px] border border-[#d9e4f2] bg-white text-[#233a6b] transition hover:bg-[#f8fbff]"><Settings className="size-4" /></button>
          </>
        )}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <AccountListStatCard label="Total Accounts" value="156" caption="All Accounts" icon={UsersRound} tone="green" onClick={() => onNotify('Total accounts opened')} />
        <AccountListStatCard label="Active Accounts" value="128" caption="82.05% of total" icon={ReceiptText} tone="blue" onClick={() => setStatus('Active')} />
        <AccountListStatCard label="Inactive Accounts" value="18" caption="11.54% of total" icon={Minus} tone="amber" onClick={() => setStatus('Inactive')} />
        <AccountListStatCard label="Suppliers" value="64" caption="41.03% of total" icon={Users} tone="purple" onClick={() => setType('Supplier')} />
        <AccountListStatCard label="Customers" value="92" caption="58.97% of total" icon={UserRound} tone="amber" onClick={() => setType('Customer')} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_350px]">
        <div className="space-y-4">
          <section className={`${panelClass} p-4 sm:p-5`}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.45fr_0.85fr_0.75fr_0.75fr_auto_auto] xl:items-end">
              <label className="flex h-11 items-center gap-3 rounded-[8px] border border-black/20 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                <Search className="size-4 text-[#7386a3]" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Search by account name, code, type, email, phone..." className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-[#30466d] outline-none placeholder:text-[#8493ab]" />
              </label>
              <ReportSelect label="Account Type" value={type} onChange={setType} options={['All Types', 'Customer', 'Supplier']} />
              <ReportSelect label="Status" value={status} onChange={setStatus} options={['All Status', 'Active', 'Inactive']} />
              <ReportSelect label="Group" value={group} onChange={setGroup} options={['All Groups', 'Corporate', 'Vendor', 'Retail']} />
              <button type="button" onClick={() => onNotify(`More filters applied: ${filteredAccounts.length} accounts`)} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276] transition hover:bg-[#f8fbff]"><RefreshCw className="size-4 text-[#0b65e5]" />More Filters</button>
              <button type="button" onClick={resetFilters} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276] transition hover:bg-[#f8fbff]"><RefreshCw className="size-4 text-[#7585a2]" />Reset</button>
            </div>
          </section>

          <article className={`${panelClass} overflow-hidden p-3 sm:p-4`}>
            <h2 className="px-1 pb-4 font-display text-[15px] font-extrabold text-[#06135a]">Accounts List</h2>
            <div className="space-y-3 lg:hidden">
              {filteredAccounts.map((account, index) => <AccountListMobileCard key={account.id} account={account} index={index + 1} onOpen={() => { setSelectedAccount(account); setModalType('Edit Account'); }} />)}
            </div>
            <div className="hidden overflow-x-auto rounded-[12px] border border-[#e7eef7] bg-white lg:block">
              <table className="crm-table min-w-[1040px] w-full">
                <thead><tr>{['#', 'Account Code', 'Account Name', 'Account Type', 'Group', 'Phone Number', 'Email', 'Status', 'Action'].map((header) => <th key={header}>{header}</th>)}</tr></thead>
                <tbody>
                  {filteredAccounts.map((account, index) => (
                    <tr key={account.id}>
                      <td>{index + 1}</td>
                      <td className="font-extrabold text-[#1e3261]">{account.code}</td>
                      <td className="font-extrabold text-[#1e3261]">{account.name}</td>
                      <td>{account.type}</td>
                      <td>{account.group}</td>
                      <td>{account.phone}</td>
                      <td>{account.email}</td>
                      <td><AccountStatusBadge status={account.status} /></td>
                      <td><UserActionButton label={`Edit ${account.name}`} icon={MoreVertical} tone="blue" onClick={() => { setSelectedAccount(account); setModalType('Edit Account'); }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <InventoryPagination text={`Showing 1 to ${filteredAccounts.length} of 156 entries`} totalPage="20" onNotify={onNotify} prefix="Accounts List" />
          </article>
        </div>

        <aside className="grid gap-4">
          <AccountTypeOverview onNotify={onNotify} />
          <AccountsListSideCard title="Top Customers" rows={accounts.slice(0, 5).map((account) => [account.name, formatInventoryCurrency(account.amount)])} onNotify={onNotify} showViewAll />
          <AccountsListRecentCard onNotify={onNotify} />
        </aside>
      </section>

      <DashboardFooter />

      {modalType === 'Add Account' || modalType === 'Edit Account' ? (
        <AccountsListModal account={selectedAccount} onClose={() => { setSelectedAccount(null); setModalType(null); }} onSave={saveAccount} />
      ) : null}
      {modalType === 'Import Accounts' ? <InventoryImportModal title="Accounts Import" onClose={() => setModalType(null)} onNotify={onNotify} /> : null}
      {modalType === 'Accounts Settings' ? <AccountUtilityModal type="Accounts Settings" accounts={accountRows} onClose={() => setModalType(null)} onSaveTransaction={() => setModalType(null)} onNotify={onNotify} /> : null}
    </div>
  );
}

function AccountListStatCard({ label, value, caption, icon: Icon, tone, onClick }) {
  const toneClass = {
    green: 'bg-[#0d9f4a] text-white',
    blue: 'bg-[#0b65e5] text-white',
    amber: 'bg-[#f59e0b] text-white',
    purple: 'bg-[#b56ce8] text-white',
  }[tone] ?? 'bg-[#e8f2ff] text-[#0b65e5]';
  return (
    <button type="button" onClick={onClick} className={`${panelClass} flex min-h-[116px] items-center gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(24,48,87,0.1)]`}>
      <span className={cx('grid size-12 shrink-0 place-items-center rounded-full', toneClass)}><Icon className="size-6" /></span>
      <span><span className="block text-[13px] font-bold text-[#53647f]">{label}</span><span className="mt-1 block font-display text-[24px] font-extrabold text-[#111827]">{value}</span><span className="mt-2 block text-[11px] font-bold text-[#314a79]">{caption}</span></span>
    </button>
  );
}

function AccountListMobileCard({ account, index, onOpen }) {
  return (
    <article className="rounded-[14px] border border-[#e7eef7] bg-white p-4 shadow-[0_10px_22px_rgba(17,39,84,0.05)]">
      <div className="flex items-start justify-between gap-3"><div><p className="text-[12px] font-extrabold text-[#8a98af]">#{index}</p><p className="mt-1 text-[15px] font-extrabold text-[#1e3261]">{account.name}</p><p className="mt-1 text-[12px] font-bold text-[#53647f]">{account.code} - {account.group}</p></div><AccountStatusBadge status={account.status} /></div>
      <div className="mt-4 grid gap-3 text-[12px] min-[420px]:grid-cols-2"><InfoCell label="Type" value={account.type} /><InfoCell label="Phone" value={account.phone} /><InfoCell label="Email" value={account.email} /><InfoCell label="Amount" value={formatInventoryCurrency(account.amount)} /></div>
      <button type="button" onClick={onOpen} className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white text-[12px] font-extrabold text-[#0b65e5]"><FileText className="size-4" />Edit Account</button>
    </article>
  );
}

function AccountTypeOverview({ onNotify }) {
  return (
    <article className={`${panelClass} p-5`}>
      <h2 className="font-display text-[15px] font-extrabold text-[#06135a]">Account Type Overview</h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-[118px_minmax(0,1fr)] sm:items-center xl:grid-cols-1 2xl:grid-cols-[118px_minmax(0,1fr)]">
        <button type="button" onClick={() => onNotify('Account type chart opened')} className="mx-auto size-[112px] rounded-full border border-[#edf2f8]" style={{ background: 'conic-gradient(#20a864 0 58.97%, #2d7ff9 58.97% 100%)' }} aria-label="Open account type chart"><span className="m-auto block size-[50px] rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(238,242,248,0.9)]" /></button>
        <div className="space-y-3"><StockLegend color="bg-[#20a864]" label="Customer" value="92 (58.97%)" /><StockLegend color="bg-[#2d7ff9]" label="Supplier" value="64 (41.03%)" /><div className="border-t border-[#edf2f8] pt-3 text-[12px] font-extrabold text-[#314a79]"><span>Total Accounts</span><span className="float-right">156</span></div></div>
      </div>
    </article>
  );
}

function AccountsListSideCard({ title, rows, onNotify, showViewAll = false }) {
  return (
    <article className={`${panelClass} p-5`}>
      <div className="flex items-center justify-between gap-3"><h2 className="font-display text-[15px] font-extrabold text-[#06135a]">{title}</h2>{showViewAll ? <button type="button" onClick={() => onNotify(`${title} opened`)} className="text-[12px] font-extrabold text-[#0b65e5]">View All</button> : null}</div>
      <div className="mt-4 space-y-3">{rows.map(([label, value]) => <button key={label} type="button" onClick={() => onNotify(`${label} opened`)} className="flex w-full items-center gap-3 rounded-[8px] p-1 text-left transition hover:bg-[#f8fbff]"><span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-[#e8f2ff] text-[#0b65e5]"><ReceiptText className="size-3.5" /></span><span className="min-w-0 flex-1 text-[12px] font-bold text-[#314a79]">{label}</span><span className="text-[12px] font-extrabold text-[#1e3261]">{value}</span></button>)}</div>
    </article>
  );
}

function AccountsListRecentCard({ onNotify }) {
  const rows = [
    ['ACC-156', 'Future Energy Pvt. Ltd.', '20 May 2024'],
    ['ACC-155', 'Krishna Electricals', '19 May 2024'],
    ['ACC-154', 'Solar World', '18 May 2024'],
  ];
  return (
    <article className={`${panelClass} p-5`}>
      <div className="flex items-center justify-between gap-3"><h2 className="font-display text-[15px] font-extrabold text-[#06135a]">Recent Accounts</h2><button type="button" onClick={() => onNotify('Recent accounts opened')} className="text-[12px] font-extrabold text-[#0b65e5]">View All</button></div>
      <div className="mt-4 space-y-4">{rows.map(([code, name, date]) => <button key={code} type="button" onClick={() => onNotify(`${code} opened`)} className="flex w-full items-center gap-3 rounded-[10px] p-2 text-left transition hover:bg-[#f8fbff]"><span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#e8f8eb] text-[#0d9f4a]"><UserPlus className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-extrabold text-[#1e3261]">{code}</span><span className="mt-1 block truncate text-[11px] font-bold text-[#53647f]">{name}</span></span><span className="shrink-0 text-[11px] font-bold text-[#314a79]">{date}</span></button>)}</div>
    </article>
  );
}

function AccountsListModal({ account, onClose, onSave }) {
  const [form, setForm] = useState(account ?? { code: '', name: '', type: 'Customer', group: 'Corporate', phone: '', email: '', status: 'Active', amount: 0 });
  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: field === 'amount' ? Number(value) || 0 : value }));
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#111827]/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[660px] rounded-[16px] bg-white shadow-[0_30px_70px_rgba(17,24,39,0.28)]">
        <div className="flex items-center justify-between border-b border-[#edf2f8] px-6 py-5"><h2 className="font-display text-[20px] font-extrabold text-[#111827]">{account ? 'Edit Account' : 'Add Account'}</h2><button type="button" onClick={onClose} className="text-[#7585a2]"><X className="size-5" /></button></div>
        <div className="grid gap-4 p-6 sm:grid-cols-2"><ModalTextInput label="Account Code" value={form.code} onChange={(value) => updateField('code', value)} placeholder="Auto if blank" /><ModalTextInput label="Account Name" value={form.name} onChange={(value) => updateField('name', value)} placeholder="Account name" /><ReportSelect label="Account Type" value={form.type} onChange={(value) => updateField('type', value)} options={['Customer', 'Supplier']} /><ReportSelect label="Group" value={form.group} onChange={(value) => updateField('group', value)} options={['Corporate', 'Vendor', 'Retail']} /><ModalTextInput label="Phone" value={form.phone} onChange={(value) => updateField('phone', value)} placeholder="+91 ..." /><ModalTextInput label="Email" value={form.email} onChange={(value) => updateField('email', value)} placeholder="email@example.com" /><ReportSelect label="Status" value={form.status} onChange={(value) => updateField('status', value)} options={['Active', 'Inactive']} /><ModalTextInput label="Amount" value={String(form.amount)} onChange={(value) => updateField('amount', value)} placeholder="0" /></div>
        <div className="flex justify-end gap-3 border-t border-[#edf2f8] px-6 py-5"><button type="button" onClick={onClose} className="h-10 rounded-[8px] border border-[#d9e4f2] bg-white px-6 text-[13px] font-extrabold text-[#233a6b]">Cancel</button><button type="button" onClick={() => onSave({ ...form, name: form.name || 'New Account', phone: form.phone || '+91 90000 00000', email: form.email || 'new@account.com' })} className="h-10 rounded-[8px] bg-[#0d9f4a] px-6 text-[13px] font-extrabold text-white">Save Account</button></div>
      </div>
    </div>
  );
}

function AccountsStatCard({ label, value, caption, growth, icon: Icon, tone, negative = false, onClick }) {
  const toneClass = {
    blue: 'bg-[#e8f2ff] text-[#0b65e5]',
    green: 'bg-[#e8f8eb] text-[#0d9f4a]',
    amber: 'bg-[#fff0dc] text-[#d98200]',
    purple: 'bg-[#f3edff] text-[#a855f7]',
    cyan: 'bg-[#ddf8f7] text-[#0891b2]',
  }[tone] ?? 'bg-[#e8f2ff] text-[#0b65e5]';

  return (
    <button type="button" onClick={onClick} className={`${panelClass} min-h-[132px] p-5 text-left transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(24,48,87,0.1)]`}>
      <div className="flex items-start gap-4">
        <span className={cx('grid size-12 shrink-0 place-items-center rounded-full', toneClass)}><Icon className="size-6" /></span>
        <span className="min-w-0">
          <span className="block text-[12px] font-bold text-[#53647f]">{label}</span>
          <span className="mt-2 block font-display text-[22px] font-extrabold text-[#111827]">{value}</span>
          <span className="mt-2 block text-[11px] font-bold text-[#314a79]">{caption}</span>
          <span className={cx('mt-3 inline-flex items-center gap-1 text-[11px] font-extrabold', negative ? 'text-[#ef4444]' : 'text-[#0d9f4a]')}>
            <ArrowUpRight className="size-3.5" />
            {growth}
            <span className="text-[#53647f]">vs last 30 days</span>
          </span>
        </span>
      </div>
    </button>
  );
}

function AccountMobileCard({ account, index, onOpen }) {
  return (
    <article className="rounded-[14px] border border-[#e7eef7] bg-white p-4 shadow-[0_10px_22px_rgba(17,39,84,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-extrabold text-[#8a98af]">#{index}</p>
          <p className="mt-1 text-[15px] font-extrabold text-[#1e3261]">{account.name}</p>
          <p className="mt-1 text-[12px] font-bold text-[#53647f]">{account.type} - {account.location}</p>
        </div>
        <AccountStatusBadge status={account.status} />
      </div>
      <div className="mt-4 grid gap-3 text-[12px] min-[420px]:grid-cols-2">
        <InfoCell label="Contact" value={account.contact} />
        <InfoCell label="Phone" value={account.phone} />
        <InfoCell label="Assigned To" value={account.assignedTo} />
        <InfoCell label="Receivables" value={formatAccountCurrency(account.receivables)} valueClass={account.receivables < 0 ? 'text-[#ef4444]' : undefined} />
      </div>
      <button type="button" onClick={onOpen} className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white text-[12px] font-extrabold text-[#0b65e5]">
        <FileText className="size-4" />
        Edit Account
      </button>
    </article>
  );
}

function AccountsTransactionsTable({ transactions, onAdd, onNotify }) {
  return (
    <article className={`${panelClass} overflow-hidden p-3 sm:p-4`}>
      <div className="flex flex-col gap-2 px-1 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-[15px] font-extrabold text-[#06135a]">Recent Transactions</h2>
        <div className="flex gap-3">
          <button type="button" onClick={onAdd} className="text-[12px] font-extrabold text-[#0b65e5]">Add</button>
          <button type="button" onClick={() => onNotify('All transactions opened')} className="text-[12px] font-extrabold text-[#0b65e5]">View All</button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-[12px] border border-[#e7eef7] bg-white">
        <table className="crm-table min-w-[840px] w-full">
          <thead><tr>{['Date', 'Reference No.', 'Account Name', 'Type', 'Amount', 'Payment Mode', 'Status'].map((header) => <th key={header}>{header}</th>)}</tr></thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr key={transaction.id} onClick={() => onNotify(`${transaction.reference} opened`)} className="cursor-pointer">
                <td>{transaction.date}</td>
                <td>{transaction.reference}</td>
                <td className="font-extrabold text-[#1e3261]">{transaction.accountName}</td>
                <td>{transaction.type}</td>
                <td className="font-extrabold text-[#1e3261]">{formatAccountCurrency(transaction.amount)}</td>
                <td>{transaction.paymentMode}</td>
                <td><TransactionStatusBadge status={transaction.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function ReceivablesPayablesCard({ onNotify }) {
  return (
    <article className={`${panelClass} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-[15px] font-extrabold text-[#06135a]">Receivables vs Payables</h2>
        <button type="button" onClick={() => onNotify('Receivables period changed')} className="rounded-[8px] border border-[#d9e4f2] bg-white px-3 py-2 text-[11px] font-extrabold text-[#1e3261]">This Month</button>
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-[130px_minmax(0,1fr)] sm:items-center xl:grid-cols-1 2xl:grid-cols-[130px_minmax(0,1fr)]">
        <button
          type="button"
          onClick={() => onNotify('Receivables vs payables chart opened')}
          aria-label="Open receivables payables chart"
          className="mx-auto size-[124px] rounded-full border border-[#edf2f8]"
          style={{ background: 'conic-gradient(#2eb872 0 74%, #ef4444 74% 100%)' }}
        >
          <span className="m-auto block size-[58px] rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(238,242,248,0.9)]" />
        </button>
        <div className="space-y-5">
          <AccountChartLegend color="bg-[#2eb872]" label="Receivables" value="Rs 18,75,320 (74%)" />
          <AccountChartLegend color="bg-[#ef4444]" label="Payables" value="Rs 6,45,780 (26%)" />
        </div>
      </div>
    </article>
  );
}

function AccountSummaryCard({ onNotify }) {
  return (
    <article className={`${panelClass} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-[15px] font-extrabold text-[#06135a]">Account Summary</h2>
        <button type="button" onClick={() => onNotify('Account summary period changed')} className="rounded-[8px] border border-[#d9e4f2] bg-white px-3 py-2 text-[11px] font-extrabold text-[#1e3261]">This Year</button>
      </div>
      <div className="mt-4 space-y-3">
        {accountSummaryRows.map((row) => {
          const Icon = row.icon;
          const iconClass = {
            red: 'bg-[#ffe9e6] text-[#ef4444]',
            blue: 'bg-[#e8f2ff] text-[#0b65e5]',
            green: 'bg-[#e8f8eb] text-[#0d9f4a]',
          }[row.tone] ?? 'bg-[#eef2f7] text-[#53647f]';

          return (
            <button key={row.label} type="button" onClick={() => onNotify(`${row.label} opened`)} className="flex w-full items-center gap-3 rounded-[8px] p-1 text-left transition hover:bg-[#f8fbff]">
              <span className={cx('grid size-7 shrink-0 place-items-center rounded-full', iconClass)}><Icon className="size-3.5" /></span>
              <span className="min-w-0 flex-1 text-[12px] font-bold text-[#314a79]">{row.label}</span>
              <span className={cx('text-[12px] font-extrabold', row.tone === 'green' ? 'text-[#0d9f4a]' : 'text-[#1e3261]')}>{row.value}</span>
            </button>
          );
        })}
      </div>
    </article>
  );
}

function AgingSummaryCard({ onNotify }) {
  return (
    <article className={`${panelClass} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-[15px] font-extrabold text-[#06135a]">Aging Summary (Receivables)</h2>
        <button type="button" onClick={() => onNotify('Aging report opened')} className="text-[12px] font-extrabold text-[#0b65e5]">View Report</button>
      </div>
      <div className="mt-4 space-y-3">
        {accountAgingRows.map((row) => (
          <p key={row.label} className="flex items-center gap-3 text-[12px] font-bold text-[#314a79]">
            <span className={cx('size-2.5 rounded-full', row.color)} />
            <span className="min-w-0 flex-1">{row.label}</span>
            <span>{row.value}</span>
          </p>
        ))}
      </div>
      <div className="mt-4 border-t border-[#edf2f8] pt-3 text-[13px] font-extrabold text-[#06135a]">
        <span>Total</span>
        <span className="float-right">Rs 18,75,320</span>
      </div>
    </article>
  );
}

function AccountChartLegend({ color, label, value }) {
  return (
    <p className="flex items-start gap-3 text-[12px] font-bold text-[#314a79]">
      <span className={cx('mt-1 size-2.5 rounded-full', color)} />
      <span>
        <span className="block font-extrabold text-[#1e3261]">{label}</span>
        <span className="mt-1 block">{value}</span>
      </span>
    </p>
  );
}

function AccountFormModal({ mode, account, onClose, onSave }) {
  const [form, setForm] = useState(account ?? {
    name: '',
    type: 'Customer',
    contact: '',
    phone: '',
    status: 'Active',
    receivables: 0,
    location: 'Indore',
    assignedTo: 'Rohit Singh',
  });

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: field === 'receivables' ? Number(value) || 0 : value }));

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#111827]/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[700px] rounded-[16px] bg-white shadow-[0_30px_70px_rgba(17,24,39,0.28)]">
        <div className="flex items-center justify-between border-b border-[#edf2f8] px-6 py-5">
          <h2 className="flex items-center gap-3 font-display text-[20px] font-extrabold text-[#111827]"><ReceiptText className="size-5 text-[#0d9f4a]" /> {mode}</h2>
          <button type="button" onClick={onClose} className="text-[#7585a2]" aria-label="Close account editor"><X className="size-5" /></button>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <ModalTextInput label="Account Name" value={form.name} onChange={(value) => updateField('name', value)} placeholder="Account name" />
          <ReportSelect label="Account Type" value={form.type} onChange={(value) => updateField('type', value)} options={['Customer', 'Partner', 'Vendor']} />
          <ModalTextInput label="Contact Person" value={form.contact} onChange={(value) => updateField('contact', value)} placeholder="Contact person" />
          <ModalTextInput label="Phone" value={form.phone} onChange={(value) => updateField('phone', value)} placeholder="Phone number" />
          <ReportSelect label="Status" value={form.status} onChange={(value) => updateField('status', value)} options={['Active', 'Pending', 'Inactive']} />
          <ModalTextInput label="Receivables" value={String(form.receivables)} onChange={(value) => updateField('receivables', value)} placeholder="0" />
          <ReportSelect label="Location" value={form.location} onChange={(value) => updateField('location', value)} options={['Indore', 'Ujjain', 'Bhopal', 'Dewas']} />
          <ReportSelect label="Assign To" value={form.assignedTo} onChange={(value) => updateField('assignedTo', value)} options={['Rohit Singh', 'Neha Jain', 'Amit Sharma', 'Vikram Singh', 'Pooja Verma', 'Sunil Patidar']} />
        </div>
        <div className="flex flex-col justify-end gap-3 border-t border-[#edf2f8] px-6 py-5 sm:flex-row">
          <button type="button" onClick={onClose} className="h-10 rounded-[8px] border border-[#d9e4f2] bg-white px-6 text-[13px] font-extrabold text-[#233a6b]">Cancel</button>
          <button type="button" onClick={() => onSave({ ...form, name: form.name || 'New Account', contact: form.contact || 'Primary Contact', phone: form.phone || '9000000000' })} className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#0d9f4a] px-6 text-[13px] font-extrabold text-white">
            <Save className="size-4" />
            Save Account
          </button>
        </div>
      </div>
    </div>
  );
}

function AccountUtilityModal({ type, accounts, onClose, onSaveTransaction, onNotify }) {
  const [form, setForm] = useState({
    accountName: accounts[0]?.name ?? 'SunPower Solutions Pvt. Ltd.',
    transactionType: 'Invoice',
    amount: '75000',
    paymentMode: 'Bank Transfer',
  });

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const isTransaction = type === 'Add Transaction';
  const isSettings = type === 'Accounts Settings';

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#111827]/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[560px] rounded-[16px] bg-white shadow-[0_30px_70px_rgba(17,24,39,0.28)]">
        <div className="flex items-center justify-between border-b border-[#edf2f8] px-6 py-5">
          <h2 className="flex items-center gap-3 font-display text-[20px] font-extrabold text-[#111827]"><ReceiptText className="size-5 text-[#0d9f4a]" /> {type}</h2>
          <button type="button" onClick={onClose} className="text-[#7585a2]" aria-label="Close account action"><X className="size-5" /></button>
        </div>
        {isSettings ? (
          <div className="space-y-3 p-6">
            {['Auto invoice reminders', 'GST compliance alerts', 'Payment approval workflow'].map((setting) => (
              <label key={setting} className="flex items-center justify-between rounded-[10px] border border-[#e7eef7] bg-white p-4 text-[13px] font-extrabold text-[#1e3261]">
                {setting}
                <input type="checkbox" defaultChecked className="size-5 rounded accent-[#0d9f4a]" />
              </label>
            ))}
          </div>
        ) : isTransaction ? (
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <ReportSelect label="Account" value={form.accountName} onChange={(value) => updateField('accountName', value)} options={accounts.map((account) => account.name)} />
            <ReportSelect label="Type" value={form.transactionType} onChange={(value) => updateField('transactionType', value)} options={['Invoice', 'Payment', 'Expense', 'Refund']} />
            <ModalTextInput label="Amount" value={form.amount} onChange={(value) => updateField('amount', value)} placeholder="0" />
            <ReportSelect label="Payment Mode" value={form.paymentMode} onChange={(value) => updateField('paymentMode', value)} options={['Bank Transfer', 'UPI', 'NEFT', 'Cash']} />
          </div>
        ) : (
          <div className="p-6">
            <p className="text-[13px] font-bold leading-6 text-[#53647f]">Upload/import flow is ready for integration. For now this action records an import request and keeps the page interactive.</p>
            <label className="mt-4 flex h-24 cursor-pointer items-center justify-center rounded-[12px] border border-dashed border-[#b9c4d6] bg-[#f8fbff] text-[13px] font-extrabold text-[#1e3261]">
              Select CSV / XLSX file
              <input type="file" className="hidden" onChange={() => onNotify('Import file selected')} />
            </label>
          </div>
        )}
        <div className="flex flex-col justify-end gap-3 border-t border-[#edf2f8] px-6 py-5 sm:flex-row">
          <button type="button" onClick={onClose} className="h-10 rounded-[8px] border border-[#d9e4f2] bg-white px-6 text-[13px] font-extrabold text-[#233a6b]">Cancel</button>
          <button
            type="button"
            onClick={() => {
              if (isTransaction) {
                onSaveTransaction({
                  date: 'Today',
                  reference: `${form.transactionType.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`,
                  accountName: form.accountName,
                  type: form.transactionType,
                  amount: Number(form.amount) || 0,
                  paymentMode: form.paymentMode,
                  status: form.transactionType === 'Invoice' ? 'Pending' : 'Completed',
                });
                return;
              }
              onNotify(`${type} saved`);
              onClose();
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#0d9f4a] px-6 text-[13px] font-extrabold text-white"
          >
            <Save className="size-4" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function AccountStatusBadge({ status }) {
  const classes = {
    Active: 'bg-[#e8f8eb] text-[#0d9f4a]',
    Pending: 'bg-[#fff0dc] text-[#d98200]',
    Inactive: 'bg-[#eef2f7] text-[#64748b]',
  }[status] ?? 'bg-[#eef2f7] text-[#53647f]';
  return <span className={cx('inline-flex rounded-[7px] px-2.5 py-1 text-[11px] font-extrabold', classes)}>{status}</span>;
}

function TransactionStatusBadge({ status }) {
  const classes = {
    Paid: 'bg-[#e8f8eb] text-[#0d9f4a]',
    Completed: 'bg-[#e8f8eb] text-[#0d9f4a]',
    Pending: 'bg-[#fff0dc] text-[#d98200]',
  }[status] ?? 'bg-[#eef2f7] text-[#53647f]';
  return <span className={cx('inline-flex rounded-[7px] px-2.5 py-1 text-[11px] font-extrabold', classes)}>{status}</span>;
}

function formatAccountCurrency(value) {
  const sign = value < 0 ? '-' : '';
  return `${sign}Rs ${Math.abs(value).toLocaleString('en-IN')}`;
}

function InventoryManagementPage({ activeSection, onOpenSection, onNotify }) {
  const [items, setItems] = useState(inventoryRows);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [warehouse, setWarehouse] = useState('All Warehouses');
  const [stockStatus, setStockStatus] = useState('All Status');
  const [selectedItem, setSelectedItem] = useState(null);
  const [transactionModal, setTransactionModal] = useState(null);

  const filteredItems = items.filter((item) => {
    const queryText = query.toLowerCase();
    const queryMatch = [item.productName, item.sku, item.category, item.warehouse].some((value) => value.toLowerCase().includes(queryText));
    const categoryMatch = category === 'All Categories' || item.category === category;
    const warehouseMatch = warehouse === 'All Warehouses' || item.warehouse === warehouse;
    const statusMatch = stockStatus === 'All Status' || item.status === stockStatus;
    return queryMatch && categoryMatch && warehouseMatch && statusMatch;
  });

  const resetFilters = () => {
    setQuery('');
    setCategory('All Categories');
    setWarehouse('All Warehouses');
    setStockStatus('All Status');
    onNotify('Inventory filters reset');
  };

  const saveItemUpdate = (updatedItem) => {
    setItems((current) => current.map((item) => (item.id === updatedItem.id ? updatedItem : item)));
    setSelectedItem(null);
    onNotify(`${updatedItem.productName} updated`);
  };

  const saveTransaction = (transaction) => {
    if (transaction.productId) {
      setItems((current) => current.map((item) => {
        if (item.id !== Number(transaction.productId)) {
          return item;
        }
        const quantity = Number(transaction.quantity) || 0;
        const nextStock = transaction.type === 'Stock Outward' ? Math.max(item.stock - quantity, 0) : item.stock + quantity;
        const nextAvailable = Math.max(nextStock - item.reserved, 0);
        return {
          ...item,
          stock: nextStock,
          available: nextAvailable,
          status: nextStock === 0 ? 'Out of Stock' : nextStock <= 20 ? 'Low Stock' : 'In Stock',
        };
      }));
    }
    setTransactionModal(null);
    onNotify(`${transaction.type} saved`);
  };

  if (activeSection === 'Products') {
    return (
      <InventoryProductsPage
        items={items}
        setItems={setItems}
        onOpenSection={onOpenSection}
        onNotify={onNotify}
      />
    );
  }

  if (activeSection === 'Stock Inward' || activeSection === 'Stock Outward') {
    return (
      <InventoryStockMovementPage
        direction={activeSection === 'Stock Inward' ? 'Inward' : 'Outward'}
        items={items}
        setItems={setItems}
        onNotify={onNotify}
      />
    );
  }

  if (activeSection === 'Stock Transfer') {
    return (
      <InventoryStockTransferPage
        items={items}
        onNotify={onNotify}
      />
    );
  }

  if (activeSection === 'Adjustments') {
    return <InventoryAdjustmentsPage items={items} onNotify={onNotify} />;
  }

  if (activeSection === 'Warehouses') {
    return <InventoryWarehousesPage onNotify={onNotify} />;
  }

  return (
    <div className="space-y-4">
      <PageHeading
        title="Inventory Management"
        crumbs={[
          { label: 'Dashboard', onClick: () => onNotify('Dashboard breadcrumb selected') },
          { label: 'Inventory Management', onClick: () => onOpenSection('Overview') },
          { label: activeSection },
        ]}
        actions={(
          <>
            <button type="button" onClick={() => setTransactionModal('Add Stock Inward')} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#078c3e] px-5 text-[13px] font-extrabold text-white shadow-[0_12px_22px_rgba(13,159,74,0.22)] transition hover:-translate-y-0.5 hover:bg-[#067832]">
              <Plus className="size-4" />
              Add Stock Inward
            </button>
            <button type="button" onClick={() => setTransactionModal('Stock Outward')} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-5 text-[13px] font-extrabold text-[#1e3261] transition hover:bg-[#f8fbff]">
              <Download className="size-4 text-[#0b65e5]" />
              Stock Outward
            </button>
            <button type="button" onClick={() => setTransactionModal('Inventory Settings')} aria-label="Inventory settings" className="inline-flex size-11 items-center justify-center rounded-[8px] border border-[#d9e4f2] bg-white text-[#233a6b] transition hover:bg-[#f8fbff]">
              <Settings className="size-4" />
            </button>
          </>
        )}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <InventoryStatCard label="Total Items" value="128" caption="All Inventory Items" icon={Boxes} tone="blue" onClick={() => onOpenSection('Products')} />
        <InventoryStatCard label="Total Stock" value="12,458" caption="All Warehouse Stock" icon={Boxes} tone="green" onClick={() => onNotify('Total stock opened')} />
        <InventoryStatCard label="Low Stock Items" value="18" caption="Reorder Required" icon={AlertTriangle} tone="amber" onClick={() => { setStockStatus('Low Stock'); onNotify('Low stock filter applied'); }} />
        <InventoryStatCard label="Out of Stock Items" value="6" caption="Out of Stock" icon={XCircle} tone="red" onClick={() => { setStockStatus('Out of Stock'); onNotify('Out of stock filter applied'); }} />
        <InventoryStatCard label="Total Value" value="Rs 1,24,58,320" caption="Inventory Value" icon={IndianRupee} tone="purple" onClick={() => onNotify('Inventory value opened')} />
      </section>

      <section className={`${panelClass} p-4 sm:p-5`}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.25fr_0.85fr_0.85fr_0.85fr_auto_auto] xl:items-end">
          <label className="flex h-11 items-center gap-3 rounded-[8px] border border-black/20 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
            <Search className="size-4 text-[#7386a3]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by product name, SKU, category..."
              className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-[#30466d] outline-none placeholder:text-[#8493ab]"
            />
          </label>
          <ReportSelect label="Category" value={category} onChange={setCategory} options={['All Categories', 'Solar Panel', 'Inverter', 'Battery', 'Structure', 'Cable', 'Accessories']} />
          <ReportSelect label="Warehouse" value={warehouse} onChange={setWarehouse} options={['All Warehouses', 'Indore Warehouse', 'Bhopal Warehouse', 'Ujjain Warehouse']} />
          <ReportSelect label="Stock Status" value={stockStatus} onChange={setStockStatus} options={['All Status', 'In Stock', 'Low Stock', 'Out of Stock']} />
          <button type="button" onClick={() => onNotify(`Inventory filters applied: ${filteredItems.length} results`)} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276] transition hover:bg-[#f8fbff]">
            <RefreshCw className="size-4 text-[#0b65e5]" />
            Filters
          </button>
          <button type="button" onClick={resetFilters} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276] transition hover:bg-[#f8fbff]">
            <RefreshCw className="size-4 text-[#7585a2]" />
            Reset
          </button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className={`${panelClass} overflow-hidden p-3 sm:p-4`}>
          <div className="flex flex-col gap-2 px-1 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-[15px] font-extrabold text-[#06135a]">{activeSection === 'Overview' ? 'Inventory Items' : activeSection}</h2>
            <button type="button" onClick={() => onOpenSection('Products')} className="inline-flex items-center gap-2 text-[12px] font-extrabold text-[#0b65e5]">
              View Products
              <ArrowRight className="size-4" />
            </button>
          </div>

          <div className="space-y-3 lg:hidden">
            {filteredItems.map((item, index) => (
              <InventoryMobileCard key={item.id} item={item} index={index + 1} onOpen={() => setSelectedItem(item)} />
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-[12px] border border-[#e7eef7] bg-white lg:block">
            <table className="crm-table min-w-[980px] w-full">
              <thead>
                <tr>{['#', 'Product Name', 'SKU', 'Category', 'Warehouse', 'In Stock', 'Reserved', 'Available', 'Status', 'Action'].map((header) => <th key={header}>{header}</th>)}</tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => (
                  <tr key={item.id}>
                    <td>{index + 1}</td>
                    <td className="font-extrabold text-[#1e3261]">{item.productName}</td>
                    <td>{item.sku}</td>
                    <td>{item.category}</td>
                    <td>{item.warehouse}</td>
                    <td>{item.stock}</td>
                    <td>{item.reserved}</td>
                    <td>{item.available}</td>
                    <td><InventoryStatusBadge status={item.status} /></td>
                    <td>
                      <UserActionButton label={`Edit ${item.productName}`} icon={MoreVertical} tone="blue" onClick={() => setSelectedItem(item)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-4 px-3 py-5 text-[13px] font-bold text-[#53647f] sm:flex-row sm:items-center sm:justify-between">
            <p>Showing 1 to {filteredItems.length} of 128 items</p>
            <div className="flex flex-wrap items-center gap-2">
              <PaginationButton onClick={() => onNotify('Previous inventory page selected')}><ChevronLeft className="size-4" /></PaginationButton>
              <PaginationButton active onClick={() => onNotify('Inventory page 1 selected')}>1</PaginationButton>
              <PaginationButton onClick={() => onNotify('Inventory page 2 selected')}>2</PaginationButton>
              <PaginationButton onClick={() => onNotify('Inventory page 3 selected')}>3</PaginationButton>
              <span className="px-2 text-[#53647f]">...</span>
              <PaginationButton onClick={() => onNotify('Inventory page 16 selected')}>16</PaginationButton>
              <PaginationButton onClick={() => onNotify('Next inventory page selected')}><ChevronRight className="size-4" /></PaginationButton>
            </div>
          </div>
        </article>

        <aside className="grid gap-4">
          <InventoryStatusOverview onNotify={onNotify} />
          <RecentStockInward onNotify={onNotify} />
        </aside>
      </section>

      <section className={`${panelClass} p-4`}>
        <h2 className="mb-4 font-display text-[15px] font-extrabold text-[#06135a]">Quick Actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {inventoryQuickActions.map((action) => (
            <InventoryQuickAction
              key={action.label}
              action={action}
              onClick={() => {
                if (action.label === 'View All Products') {
                  onOpenSection('Products');
                  return;
                }
                setTransactionModal(action.label);
              }}
            />
          ))}
        </div>
      </section>

      <DashboardFooter />

      {selectedItem ? (
        <InventoryItemModal item={selectedItem} onClose={() => setSelectedItem(null)} onSave={saveItemUpdate} onNotify={onNotify} />
      ) : null}
      {transactionModal ? (
        <InventoryTransactionModal type={transactionModal} items={items} onClose={() => setTransactionModal(null)} onSave={saveTransaction} onNotify={onNotify} />
      ) : null}
    </div>
  );
}

function InventoryProductsPage({ items, setItems, onOpenSection, onNotify }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [warehouse, setWarehouse] = useState('All Warehouses');
  const [status, setStatus] = useState('All Status');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const products = items.map(enrichInventoryProduct);
  const filteredProducts = products.filter((product) => {
    const queryText = query.toLowerCase();
    const queryMatch = [product.productName, product.sku, product.category, product.brand].some((value) => value.toLowerCase().includes(queryText));
    const categoryMatch = category === 'All Categories' || product.category === category;
    const warehouseMatch = warehouse === 'All Warehouses' || product.warehouse === warehouse;
    const statusMatch = status === 'All Status' || product.status === status;
    return queryMatch && categoryMatch && warehouseMatch && statusMatch;
  });

  const resetFilters = () => {
    setQuery('');
    setCategory('All Categories');
    setWarehouse('All Warehouses');
    setStatus('All Status');
    onNotify('Product filters reset');
  };

  const saveProduct = (product) => {
    const stock = Number(product.stock) || 0;
    const reserved = Number(product.reserved) || 0;
    const nextProduct = {
      ...product,
      id: product.id || Date.now(),
      stock,
      reserved,
      available: Math.max(stock - reserved, 0),
      status: stock === 0 ? 'Out of Stock' : stock <= 20 ? 'Low Stock' : product.status,
    };

    setItems((current) => {
      const exists = current.some((item) => item.id === nextProduct.id);
      return exists ? current.map((item) => (item.id === nextProduct.id ? nextProduct : item)) : [nextProduct, ...current];
    });
    setSelectedProduct(null);
    setProductModalOpen(false);
    onNotify(`${nextProduct.productName} saved`);
  };

  return (
    <div className="space-y-4">
      <PageHeading
        title="Products"
        crumbs={[
          { label: 'Dashboard', onClick: () => onNotify('Dashboard breadcrumb selected') },
          { label: 'Inventory', onClick: () => onOpenSection('Overview') },
          { label: 'Products' },
        ]}
        actions={(
          <>
            <button type="button" onClick={() => { setSelectedProduct(null); setProductModalOpen(true); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#078c3e] px-5 text-[13px] font-extrabold text-white shadow-[0_12px_22px_rgba(13,159,74,0.22)] transition hover:-translate-y-0.5 hover:bg-[#067832]">
              <Plus className="size-4" />
              Add Product
            </button>
            <button type="button" onClick={() => onNotify('Products exported')} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-5 text-[13px] font-extrabold text-[#1e3261] transition hover:bg-[#f8fbff]">
              <Download className="size-4 text-[#0b65e5]" />
              Export
            </button>
            <button type="button" onClick={() => setSettingsOpen(true)} aria-label="Product settings" className="inline-flex size-11 items-center justify-center rounded-[8px] border border-[#d9e4f2] bg-white text-[#233a6b] transition hover:bg-[#f8fbff]">
              <Settings className="size-4" />
            </button>
          </>
        )}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_2.15fr]">
        <InventoryStatCard label="Total Products" value="96" caption="All Products" icon={Boxes} tone="blue" onClick={() => onNotify('All products opened')} />
        <InventoryStatCard label="Active Products" value="88" caption="Active Products" icon={CheckCircle2} tone="green" onClick={() => setStatus('In Stock')} />
        <InventoryStatCard label="Low Stock Products" value="6" caption="Low Stock" icon={AlertTriangle} tone="amber" onClick={() => setStatus('Low Stock')} />
        <InventoryStatCard label="Out of Stock Products" value="2" caption="Out of Stock" icon={XCircle} tone="red" onClick={() => setStatus('Out of Stock')} />
        <InventoryStatCard label="Total Value" value="Rs 1,24,58,320" caption="Total Inventory Value" icon={IndianRupee} tone="purple" onClick={() => onNotify('Inventory value opened')} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_350px]">
        <div className="space-y-4">
          <section className={`${panelClass} p-4 sm:p-5`}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.45fr_0.85fr_0.85fr_0.85fr_auto_auto] xl:items-end">
              <label className="flex h-11 items-center gap-3 rounded-[8px] border border-black/20 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                <Search className="size-4 text-[#7386a3]" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Search by product name, SKU, category..." className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-[#30466d] outline-none placeholder:text-[#8493ab]" />
              </label>
              <ReportSelect label="Category" value={category} onChange={setCategory} options={['All Categories', 'Solar Panel', 'Inverter', 'Battery', 'Structure', 'Cable', 'Accessories']} />
              <ReportSelect label="Warehouse" value={warehouse} onChange={setWarehouse} options={['All Warehouses', 'Indore Warehouse', 'Bhopal Warehouse', 'Ujjain Warehouse']} />
              <ReportSelect label="Status" value={status} onChange={setStatus} options={['All Status', 'In Stock', 'Low Stock', 'Out of Stock']} />
              <button type="button" onClick={() => onNotify(`Product filters applied: ${filteredProducts.length} results`)} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276] transition hover:bg-[#f8fbff]"><RefreshCw className="size-4 text-[#0b65e5]" />Filters</button>
              <button type="button" onClick={resetFilters} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276] transition hover:bg-[#f8fbff]"><RefreshCw className="size-4 text-[#7585a2]" />Reset</button>
            </div>
          </section>

          <article className={`${panelClass} overflow-hidden p-3 sm:p-4`}>
            <h2 className="px-1 pb-4 font-display text-[15px] font-extrabold text-[#06135a]">Products List</h2>
            <div className="space-y-3 lg:hidden">
              {filteredProducts.map((product, index) => (
                <InventoryProductMobileCard key={product.id} product={product} index={index + 1} onOpen={() => { setSelectedProduct(product); setProductModalOpen(true); }} />
              ))}
            </div>
            <div className="hidden overflow-x-auto rounded-[12px] border border-[#e7eef7] bg-white lg:block">
              <table className="crm-table min-w-[980px] w-full">
                <thead><tr>{['#', 'Product Name', 'SKU', 'Category', 'Brand', 'Unit', 'Selling Price', 'In Stock', 'Status', 'Action'].map((header) => <th key={header}>{header}</th>)}</tr></thead>
                <tbody>
                  {filteredProducts.map((product, index) => (
                    <tr key={product.id}>
                      <td>{index + 1}</td>
                      <td className="font-extrabold text-[#1e3261]">{product.productName}</td>
                      <td>{product.sku}</td>
                      <td>{product.category}</td>
                      <td>{product.brand}</td>
                      <td>{product.unit}</td>
                      <td className="font-extrabold text-[#1e3261]">{formatInventoryCurrency(product.sellingPrice)}</td>
                      <td>{product.stock}</td>
                      <td><InventoryStatusBadge status={product.status} /></td>
                      <td><UserActionButton label={`Edit ${product.productName}`} icon={MoreVertical} tone="blue" onClick={() => { setSelectedProduct(product); setProductModalOpen(true); }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <InventoryPagination text={`Showing 1 to ${filteredProducts.length} of 96 entries`} totalPage="12" onNotify={onNotify} prefix="Products" />
          </article>
        </div>

        <aside className="grid gap-4">
          <ProductStatusOverview onNotify={onNotify} />
          <InventorySideList title="Top Categories" rows={inventoryTopCategories} onNotify={onNotify} />
          <ProductRecentActivities onNotify={onNotify} />
        </aside>
      </section>

      <DashboardFooter />

      {productModalOpen ? (
        <InventoryProductModal product={selectedProduct} onClose={() => { setSelectedProduct(null); setProductModalOpen(false); }} onSave={saveProduct} />
      ) : null}
      {settingsOpen ? (
        <InventoryTransactionModal type="Inventory Settings" items={items} onClose={() => setSettingsOpen(false)} onSave={() => setSettingsOpen(false)} onNotify={onNotify} />
      ) : null}
    </div>
  );
}

function InventoryStockMovementPage({ direction, items, setItems, onNotify }) {
  const isInward = direction === 'Inward';
  const [orders, setOrders] = useState(isInward ? stockInwardRows : stockOutwardRows);
  const [query, setQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [party, setParty] = useState(isInward ? 'All Suppliers' : 'All Customers');
  const [warehouse, setWarehouse] = useState('All Warehouses');
  const [status, setStatus] = useState('All Status');
  const [modalType, setModalType] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const title = isInward ? 'Stock Inward' : 'Stock Outward';
  const filteredOrders = orders.filter((order) => {
    const queryText = query.toLowerCase();
    const queryMatch = [order.orderNo, order.invoiceNo, order.party].some((value) => value.toLowerCase().includes(queryText));
    const partyMatch = party.startsWith('All') || order.party === party;
    const warehouseMatch = warehouse === 'All Warehouses' || order.warehouse === warehouse;
    const statusMatch = status === 'All Status' || order.status === status;
    return queryMatch && partyMatch && warehouseMatch && statusMatch;
  });

  const saveOrder = (order) => {
    const nextOrder = {
      ...order,
      id: order.id || Date.now(),
      orderNo: order.orderNo || `${isInward ? 'PO' : 'SO'}-${Date.now().toString().slice(-6)}`,
      invoiceNo: order.invoiceNo || `INV-${Date.now().toString().slice(-6)}`,
      date: order.date || 'Today',
      value: Number(order.value) || 0,
      items: Number(order.items) || 1,
      quantity: Number(order.quantity) || 0,
    };
    setOrders((current) => (current.some((item) => item.id === nextOrder.id) ? current.map((item) => (item.id === nextOrder.id ? nextOrder : item)) : [nextOrder, ...current]));

    if (nextOrder.quantity) {
      setItems((current) => current.map((item, index) => {
        if (index !== 0) return item;
        const quantity = Number(nextOrder.quantity) || 0;
        const stock = isInward ? item.stock + quantity : Math.max(item.stock - quantity, 0);
        return { ...item, stock, available: Math.max(stock - item.reserved, 0), status: stock === 0 ? 'Out of Stock' : stock <= 20 ? 'Low Stock' : 'In Stock' };
      }));
    }
    setModalType(null);
    setSelectedOrder(null);
    onNotify(`${title} saved`);
  };

  const resetFilters = () => {
    setQuery('');
    setFromDate('');
    setToDate('');
    setParty(isInward ? 'All Suppliers' : 'All Customers');
    setWarehouse('All Warehouses');
    setStatus('All Status');
    onNotify(`${title} filters reset`);
  };

  return (
    <div className="space-y-4">
      <PageHeading
        title={title}
        crumbs={[
          { label: 'Dashboard', onClick: () => onNotify('Dashboard breadcrumb selected') },
          { label: 'Inventory', onClick: () => onNotify('Inventory breadcrumb selected') },
          { label: title },
        ]}
        actions={(
          <>
            <button type="button" onClick={() => setModalType(`Add ${title}`)} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#078c3e] px-5 text-[13px] font-extrabold text-white shadow-[0_12px_22px_rgba(13,159,74,0.22)] transition hover:-translate-y-0.5 hover:bg-[#067832]"><Plus className="size-4" />Add {title}</button>
            <button type="button" onClick={() => setModalType('Import')} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-5 text-[13px] font-extrabold text-[#1e3261] transition hover:bg-[#f8fbff]"><Download className="size-4 text-[#0b65e5]" />Import</button>
            <button type="button" onClick={() => onNotify(`${title} exported`)} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-5 text-[13px] font-extrabold text-[#1e3261] transition hover:bg-[#f8fbff]"><Download className="size-4 text-[#0b65e5]" />Export</button>
            <button type="button" onClick={() => setModalType('Inventory Settings')} aria-label={`${title} settings`} className="inline-flex size-11 items-center justify-center rounded-[8px] border border-[#d9e4f2] bg-white text-[#233a6b] transition hover:bg-[#f8fbff]"><Settings className="size-4" /></button>
          </>
        )}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <InventoryStatCard label={`Total ${direction} Orders`} value={isInward ? '62' : '58'} caption="All Time" icon={ClipboardPlus} tone="blue" onClick={() => onNotify(`${title} orders opened`)} />
        <InventoryStatCard label={`Total Items ${isInward ? 'Received' : 'Delivered'}`} value={isInward ? '1,256' : '1,148'} caption="All Items" icon={CheckCircle2} tone="green" onClick={() => onNotify(`${title} items opened`)} />
        <InventoryStatCard label="Total Quantity" value={isInward ? '12,458' : '11,320'} caption="All Quantity" icon={ReceiptText} tone="amber" onClick={() => onNotify(`${title} quantity opened`)} />
        <InventoryStatCard label="Total Value" value={isInward ? 'Rs 1,24,58,320' : 'Rs 1,18,76,540'} caption="All Time" icon={IndianRupee} tone="purple" onClick={() => onNotify(`${title} value opened`)} />
        <InventoryStatCard label="This Month Value" value={isInward ? 'Rs 18,75,430' : 'Rs 16,32,780'} caption={isInward ? '12% from last month' : '15% from last month'} icon={BarChart3} tone="blue" onClick={() => onNotify(`${title} monthly value opened`)} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="space-y-4">
          <section className={`${panelClass} p-4 sm:p-5`}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.3fr_0.6fr_0.6fr_0.72fr_0.72fr_0.9fr] xl:items-end">
              <label className="flex h-11 items-center gap-3 rounded-[8px] border border-black/20 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                <Search className="size-4 text-[#7386a3]" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder={`Search by ${isInward ? 'PO number, supplier' : 'SO number, customer'}, invoice number...`} className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-[#30466d] outline-none placeholder:text-[#8493ab]" />
              </label>
              <DateFilter label="From Date" value={fromDate} onChange={setFromDate} />
              <DateFilter label="To Date" value={toDate} onChange={setToDate} />
              <ReportSelect label={isInward ? 'Supplier' : 'Customer'} value={party} onChange={setParty} options={[isInward ? 'All Suppliers' : 'All Customers', ...(isInward ? stockInwardTopParties : stockOutwardTopParties).map((item) => item[0])]} />
              <ReportSelect label="Warehouse" value={warehouse} onChange={setWarehouse} options={['All Warehouses', 'Indore Warehouse', 'Bhopal Warehouse', 'Ujjain Warehouse']} />
              <ReportSelect label="Status" value={status} onChange={setStatus} options={isInward ? ['All Status', 'Completed', 'Partially Received', 'Pending', 'Cancelled'] : ['All Status', 'Delivered', 'In Transit', 'Pending', 'Cancelled']} />
            </div>
          </section>

          <article className={`${panelClass} overflow-hidden p-3 sm:p-4`}>
            <h2 className="px-1 pb-4 font-display text-[15px] font-extrabold text-[#06135a]">{title} List</h2>
            <div className="space-y-3 lg:hidden">
              {filteredOrders.map((order, index) => <InventoryMovementMobileCard key={order.id} order={order} index={index + 1} isInward={isInward} onOpen={() => setSelectedOrder(order)} />)}
            </div>
            <div className="hidden overflow-x-auto rounded-[12px] border border-[#e7eef7] bg-white lg:block">
              <table className="crm-table min-w-[1080px] w-full">
                <thead><tr>{['#', isInward ? 'PO Number' : 'SO Number', 'Invoice Number', isInward ? 'Supplier' : 'Customer / Project', 'Warehouse', `${direction} Date`, 'Items', 'Quantity', 'Total Value', 'Status', 'Action'].map((header) => <th key={header}>{header}</th>)}</tr></thead>
                <tbody>
                  {filteredOrders.map((order, index) => (
                    <tr key={order.id}>
                      <td>{index + 1}</td>
                      <td className="font-extrabold text-[#1e3261]">{order.orderNo}</td>
                      <td>{order.invoiceNo}</td>
                      <td>{order.party}</td>
                      <td>{order.warehouse}</td>
                      <td>{order.date}</td>
                      <td>{order.items}</td>
                      <td>{order.quantity}</td>
                      <td className="font-extrabold text-[#1e3261]">{formatInventoryCurrency(order.value)}</td>
                      <td><StockOrderStatusBadge status={order.status} /></td>
                      <td><UserActionButton label={`View ${order.orderNo}`} icon={Eye} tone="blue" onClick={() => setSelectedOrder(order)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <InventoryPagination text={`Showing 1 to ${filteredOrders.length} of ${isInward ? 62 : 58} entries`} totalPage="8" onNotify={onNotify} prefix={title} />
          </article>
        </div>

        <aside className="grid gap-4">
          <MovementOverviewCard isInward={isInward} onNotify={onNotify} />
          <InventoryPlainList title={isInward ? 'Top Suppliers' : 'Top Customers'} rows={isInward ? stockInwardTopParties : stockOutwardTopParties} onNotify={onNotify} />
          <MovementRecentCard title={`Recent ${title}`} rows={orders.slice(0, 4)} onNotify={onNotify} />
          <section className={`${panelClass} p-4 sm:hidden`}>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => onNotify(`${title} filters applied: ${filteredOrders.length} results`)} className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276]"><RefreshCw className="size-4 text-[#0b65e5]" />Filters</button>
              <button type="button" onClick={resetFilters} className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276]"><RefreshCw className="size-4 text-[#7585a2]" />Reset</button>
            </div>
          </section>
        </aside>
      </section>

      <div className="hidden gap-3 sm:flex sm:justify-end">
        <button type="button" onClick={() => onNotify(`${title} filters applied: ${filteredOrders.length} results`)} className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276]"><RefreshCw className="size-4 text-[#0b65e5]" />Filters</button>
        <button type="button" onClick={resetFilters} className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276]"><RefreshCw className="size-4 text-[#7585a2]" />Reset</button>
      </div>

      <DashboardFooter />

      {modalType?.startsWith('Add') ? (
        <StockMovementOrderModal isInward={isInward} onClose={() => setModalType(null)} onSave={saveOrder} />
      ) : null}
      {modalType === 'Import' ? <InventoryImportModal title={`${title} Import`} onClose={() => setModalType(null)} onNotify={onNotify} /> : null}
      {modalType === 'Inventory Settings' ? <InventoryTransactionModal type="Inventory Settings" items={items} onClose={() => setModalType(null)} onSave={() => setModalType(null)} onNotify={onNotify} /> : null}
      {selectedOrder ? <StockMovementDetailModal order={selectedOrder} isInward={isInward} onClose={() => setSelectedOrder(null)} onNotify={onNotify} /> : null}
    </div>
  );
}

function InventoryStockTransferPage({ items, onNotify }) {
  const [transfers, setTransfers] = useState(stockTransferRows);
  const [query, setQuery] = useState('');
  const [fromWarehouse, setFromWarehouse] = useState('All Warehouses');
  const [toWarehouse, setToWarehouse] = useState('All Warehouses');
  const [transferDate, setTransferDate] = useState('');
  const [status, setStatus] = useState('All Status');
  const [modalType, setModalType] = useState(null);
  const [selectedTransfer, setSelectedTransfer] = useState(null);

  const filteredTransfers = transfers.filter((transfer) => {
    const queryText = query.toLowerCase();
    const queryMatch = [transfer.transferNo, transfer.fromWarehouse, transfer.toWarehouse].some((value) => value.toLowerCase().includes(queryText));
    const fromMatch = fromWarehouse === 'All Warehouses' || transfer.fromWarehouse === fromWarehouse;
    const toMatch = toWarehouse === 'All Warehouses' || transfer.toWarehouse === toWarehouse;
    const statusMatch = status === 'All Status' || transfer.status === status;
    return queryMatch && fromMatch && toMatch && statusMatch;
  });

  const saveTransfer = (transfer) => {
    const nextTransfer = {
      ...transfer,
      id: transfer.id || Date.now(),
      transferNo: transfer.transferNo || `ST-${Date.now().toString().slice(-6)}`,
      transferDate: transfer.transferDate || 'Today',
      items: Number(transfer.items) || 1,
      quantity: Number(transfer.quantity) || 0,
      value: Number(transfer.value) || 0,
    };
    setTransfers((current) => (current.some((item) => item.id === nextTransfer.id) ? current.map((item) => (item.id === nextTransfer.id ? nextTransfer : item)) : [nextTransfer, ...current]));
    setModalType(null);
    onNotify(`${nextTransfer.transferNo} saved`);
  };

  const resetFilters = () => {
    setQuery('');
    setFromWarehouse('All Warehouses');
    setToWarehouse('All Warehouses');
    setTransferDate('');
    setStatus('All Status');
    onNotify('Stock transfer filters reset');
  };

  return (
    <div className="space-y-4">
      <PageHeading
        title="Stock Transfer"
        crumbs={[
          { label: 'Dashboard', onClick: () => onNotify('Dashboard breadcrumb selected') },
          { label: 'Inventory', onClick: () => onNotify('Inventory breadcrumb selected') },
          { label: 'Stock Transfer' },
        ]}
        actions={(
          <>
            <button type="button" onClick={() => setModalType('New Stock Transfer')} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#078c3e] px-5 text-[13px] font-extrabold text-white shadow-[0_12px_22px_rgba(13,159,74,0.22)] transition hover:-translate-y-0.5 hover:bg-[#067832]"><Plus className="size-4" />New Stock Transfer</button>
            <button type="button" onClick={() => setModalType('Import')} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-5 text-[13px] font-extrabold text-[#1e3261] transition hover:bg-[#f8fbff]"><Download className="size-4 text-[#0b65e5]" />Import</button>
            <button type="button" onClick={() => onNotify('Stock transfers exported')} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-5 text-[13px] font-extrabold text-[#1e3261] transition hover:bg-[#f8fbff]"><Download className="size-4 text-[#0b65e5]" />Export</button>
            <button type="button" onClick={() => setModalType('Inventory Settings')} aria-label="Stock transfer settings" className="inline-flex size-11 items-center justify-center rounded-[8px] border border-[#d9e4f2] bg-white text-[#233a6b] transition hover:bg-[#f8fbff]"><Settings className="size-4" /></button>
          </>
        )}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <InventoryStatCard label="Total Transfer Orders" value="47" caption="All Time" icon={ClipboardPlus} tone="blue" onClick={() => onNotify('Transfer orders opened')} />
        <InventoryStatCard label="Total Items Transferred" value="986" caption="All Items" icon={Boxes} tone="green" onClick={() => onNotify('Transferred items opened')} />
        <InventoryStatCard label="Total Quantity Transferred" value="9,842" caption="All Quantity" icon={ReceiptText} tone="amber" onClick={() => onNotify('Transferred quantity opened')} />
        <InventoryStatCard label="Total Value Transferred" value="Rs 98,75,620" caption="All Time" icon={IndianRupee} tone="purple" onClick={() => onNotify('Transferred value opened')} />
        <InventoryStatCard label="This Month Value" value="Rs 14,35,780" caption="13% from last month" icon={BarChart3} tone="blue" onClick={() => onNotify('Monthly transfer value opened')} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="space-y-4">
          <section className={`${panelClass} p-4 sm:p-5`}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr_0.8fr] xl:items-end">
              <label className="flex h-11 items-center gap-3 rounded-[8px] border border-black/20 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                <Search className="size-4 text-[#7386a3]" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Search by transfer number, from warehouse, to warehouse, item..." className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-[#30466d] outline-none placeholder:text-[#8493ab]" />
              </label>
              <ReportSelect label="From Warehouse" value={fromWarehouse} onChange={setFromWarehouse} options={['All Warehouses', 'Indore Warehouse', 'Ujjain Warehouse', 'Bhopal Warehouse', 'Jabalpur Warehouse', 'Gwalior Warehouse']} />
              <ReportSelect label="To Warehouse" value={toWarehouse} onChange={setToWarehouse} options={['All Warehouses', 'Indore Warehouse', 'Ujjain Warehouse', 'Bhopal Warehouse', 'Jabalpur Warehouse', 'Gwalior Warehouse']} />
              <DateFilter label="Transfer Date" value={transferDate} onChange={setTransferDate} />
              <ReportSelect label="Status" value={status} onChange={setStatus} options={['All Status', 'Completed', 'In Transit', 'Pending', 'Cancelled']} />
            </div>
          </section>

          <article className={`${panelClass} overflow-hidden p-3 sm:p-4`}>
            <h2 className="px-1 pb-4 font-display text-[15px] font-extrabold text-[#06135a]">Stock Transfer List</h2>
            <div className="space-y-3 lg:hidden">
              {filteredTransfers.map((transfer, index) => <StockTransferMobileCard key={transfer.id} transfer={transfer} index={index + 1} onOpen={() => setSelectedTransfer(transfer)} />)}
            </div>
            <div className="hidden overflow-x-auto rounded-[12px] border border-[#e7eef7] bg-white lg:block">
              <table className="crm-table min-w-[980px] w-full">
                <thead><tr>{['#', 'Transfer No.', 'Transfer Date', 'From Warehouse', 'To Warehouse', 'Items', 'Quantity', 'Total Value', 'Status', 'Action'].map((header) => <th key={header}>{header}</th>)}</tr></thead>
                <tbody>
                  {filteredTransfers.map((transfer, index) => (
                    <tr key={transfer.id}>
                      <td>{index + 1}</td>
                      <td className="font-extrabold text-[#1e3261]">{transfer.transferNo}</td>
                      <td>{transfer.transferDate}</td>
                      <td>{transfer.fromWarehouse}</td>
                      <td>{transfer.toWarehouse}</td>
                      <td>{transfer.items}</td>
                      <td>{transfer.quantity}</td>
                      <td className="font-extrabold text-[#1e3261]">{formatInventoryCurrency(transfer.value)}</td>
                      <td><StockOrderStatusBadge status={transfer.status} /></td>
                      <td><UserActionButton label={`View ${transfer.transferNo}`} icon={Eye} tone="blue" onClick={() => setSelectedTransfer(transfer)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <InventoryPagination text={`Showing 1 to ${filteredTransfers.length} of 47 entries`} totalPage="6" onNotify={onNotify} prefix="Stock Transfer" />
          </article>
        </div>

        <aside className="grid gap-4">
          <TransferOverviewCard onNotify={onNotify} />
          <InventoryPlainList title="Top From Warehouses" rows={stockTransferTopWarehouses} onNotify={onNotify} />
          <TransferRecentCard rows={transfers.slice(0, 4)} onNotify={onNotify} />
          <section className={`${panelClass} p-4 sm:hidden`}>
            <div className="grid gap-3">
              <button type="button" onClick={() => onNotify(`Stock transfer filters applied: ${filteredTransfers.length} results`)} className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276]"><RefreshCw className="size-4 text-[#0b65e5]" />Filters</button>
              <button type="button" onClick={resetFilters} className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276]"><RefreshCw className="size-4 text-[#7585a2]" />Reset</button>
            </div>
          </section>
        </aside>
      </section>

      <div className="hidden gap-3 sm:flex sm:justify-end">
        <button type="button" onClick={() => onNotify(`Stock transfer filters applied: ${filteredTransfers.length} results`)} className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276]"><RefreshCw className="size-4 text-[#0b65e5]" />Filters</button>
        <button type="button" onClick={resetFilters} className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276]"><RefreshCw className="size-4 text-[#7585a2]" />Reset</button>
      </div>

      <DashboardFooter />

      {modalType === 'New Stock Transfer' ? <StockTransferModal items={items} onClose={() => setModalType(null)} onSave={saveTransfer} /> : null}
      {modalType === 'Import' ? <InventoryImportModal title="Stock Transfer Import" onClose={() => setModalType(null)} onNotify={onNotify} /> : null}
      {modalType === 'Inventory Settings' ? <InventoryTransactionModal type="Inventory Settings" items={items} onClose={() => setModalType(null)} onSave={() => setModalType(null)} onNotify={onNotify} /> : null}
      {selectedTransfer ? <StockTransferDetailModal transfer={selectedTransfer} onClose={() => setSelectedTransfer(null)} onNotify={onNotify} /> : null}
    </div>
  );
}

function InventoryAdjustmentsPage({ items, onNotify }) {
  const [adjustments, setAdjustments] = useState(inventoryAdjustmentRows);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('All Types');
  const [warehouse, setWarehouse] = useState('All Warehouses');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('All Status');
  const [modalType, setModalType] = useState(null);
  const [selectedAdjustment, setSelectedAdjustment] = useState(null);

  const filteredAdjustments = adjustments.filter((adjustment) => {
    const queryText = query.toLowerCase();
    const queryMatch = [adjustment.adjustmentNo, adjustment.reason, adjustment.warehouse, adjustment.type].some((value) => value.toLowerCase().includes(queryText));
    const typeMatch = type === 'All Types' || adjustment.type === type;
    const warehouseMatch = warehouse === 'All Warehouses' || adjustment.warehouse === warehouse;
    const statusMatch = status === 'All Status' || adjustment.status === status;
    return queryMatch && typeMatch && warehouseMatch && statusMatch;
  });

  const saveAdjustment = (adjustment) => {
    const nextAdjustment = {
      ...adjustment,
      id: adjustment.id || Date.now(),
      adjustmentNo: adjustment.adjustmentNo || `ADJ-${Date.now().toString().slice(-6)}`,
      date: adjustment.date || 'Today',
      items: Number(adjustment.items) || 1,
      quantity: Number(adjustment.quantity) || 0,
      value: Number(adjustment.value) || 0,
    };
    setAdjustments((current) => (current.some((item) => item.id === nextAdjustment.id) ? current.map((item) => (item.id === nextAdjustment.id ? nextAdjustment : item)) : [nextAdjustment, ...current]));
    setModalType(null);
    setSelectedAdjustment(null);
    onNotify(`${nextAdjustment.adjustmentNo} saved`);
  };

  const resetFilters = () => {
    setQuery('');
    setType('All Types');
    setWarehouse('All Warehouses');
    setDate('');
    setStatus('All Status');
    onNotify('Adjustment filters reset');
  };

  return (
    <div className="space-y-4">
      <PageHeading
        title="Adjustments"
        crumbs={[
          { label: 'Dashboard', onClick: () => onNotify('Dashboard breadcrumb selected') },
          { label: 'Inventory', onClick: () => onNotify('Inventory breadcrumb selected') },
          { label: 'Adjustments' },
        ]}
        actions={(
          <>
            <button type="button" onClick={() => setModalType('New Adjustment')} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#078c3e] px-5 text-[13px] font-extrabold text-white shadow-[0_12px_22px_rgba(13,159,74,0.22)] transition hover:-translate-y-0.5 hover:bg-[#067832]"><Plus className="size-4" />New Adjustment</button>
            <button type="button" onClick={() => setModalType('Import')} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-5 text-[13px] font-extrabold text-[#1e3261] transition hover:bg-[#f8fbff]"><Download className="size-4 text-[#0b65e5]" />Import</button>
            <button type="button" onClick={() => onNotify('Adjustments exported')} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-5 text-[13px] font-extrabold text-[#1e3261] transition hover:bg-[#f8fbff]"><Download className="size-4 text-[#0b65e5]" />Export</button>
            <button type="button" onClick={() => setModalType('Inventory Settings')} aria-label="Adjustment settings" className="inline-flex size-11 items-center justify-center rounded-[8px] border border-[#d9e4f2] bg-white text-[#233a6b] transition hover:bg-[#f8fbff]"><Settings className="size-4" /></button>
          </>
        )}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <InventoryStatCard label="Total Adjustments" value="38" caption="All Time" icon={ClipboardPlus} tone="blue" onClick={() => onNotify('Total adjustments opened')} />
        <InventoryStatCard label="Total Items Adjusted" value="872" caption="All Items" icon={CheckCircle2} tone="green" onClick={() => onNotify('Adjusted items opened')} />
        <InventoryStatCard label="Total Quantity Adjusted" value="6,482" caption="All Quantity" icon={ReceiptText} tone="amber" onClick={() => onNotify('Adjusted quantity opened')} />
        <InventoryStatCard label="Total Value Adjusted" value="Rs 65,47,320" caption="All Time" icon={IndianRupee} tone="purple" onClick={() => onNotify('Adjusted value opened')} />
        <InventoryStatCard label="This Month Value" value="Rs 8,75,430" caption="11% from last month" icon={BarChart3} tone="blue" onClick={() => onNotify('Monthly adjustment value opened')} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="space-y-4">
          <section className={`${panelClass} p-4 sm:p-5`}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.35fr_0.75fr_0.78fr_0.9fr_0.78fr] xl:items-end">
              <label className="flex h-11 items-center gap-3 rounded-[8px] border border-black/20 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100"><Search className="size-4 text-[#7386a3]" /><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Search by adjustment no., reason, product, warehouse..." className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-[#30466d] outline-none placeholder:text-[#8493ab]" /></label>
              <ReportSelect label="Adjustment Type" value={type} onChange={setType} options={['All Types', 'Stock Increase', 'Stock Decrease']} />
              <ReportSelect label="Warehouse" value={warehouse} onChange={setWarehouse} options={['All Warehouses', 'Indore Warehouse', 'Bhopal Warehouse', 'Ujjain Warehouse', 'Gwalior Warehouse', 'Jabalpur Warehouse']} />
              <DateFilter label="Adjustment Date" value={date} onChange={setDate} />
              <ReportSelect label="Status" value={status} onChange={setStatus} options={['All Status', 'Completed', 'In Review', 'Pending', 'Cancelled']} />
            </div>
          </section>

          <article className={`${panelClass} overflow-hidden p-3 sm:p-4`}>
            <h2 className="px-1 pb-4 font-display text-[15px] font-extrabold text-[#06135a]">Adjustments List</h2>
            <div className="space-y-3 lg:hidden">{filteredAdjustments.map((adjustment, index) => <AdjustmentMobileCard key={adjustment.id} adjustment={adjustment} index={index + 1} onOpen={() => setSelectedAdjustment(adjustment)} />)}</div>
            <div className="hidden overflow-x-auto rounded-[12px] border border-[#e7eef7] bg-white lg:block">
              <table className="crm-table min-w-[1060px] w-full">
                <thead><tr>{['#', 'Adjustment No.', 'Adjustment Date', 'Type', 'Reason', 'Warehouse', 'Items', 'Quantity Adjusted', 'Value Adjusted', 'Status', 'Action'].map((header) => <th key={header}>{header}</th>)}</tr></thead>
                <tbody>{filteredAdjustments.map((adjustment, index) => <tr key={adjustment.id}><td>{index + 1}</td><td className="font-extrabold text-[#1e3261]">{adjustment.adjustmentNo}</td><td>{adjustment.date}</td><td>{adjustment.type}</td><td>{adjustment.reason}</td><td>{adjustment.warehouse}</td><td>{adjustment.items}</td><td className={adjustment.quantity < 0 ? 'font-extrabold text-[#ef4444]' : 'font-extrabold text-[#1e3261]'}>{adjustment.quantity}</td><td className="font-extrabold text-[#1e3261]">{formatInventoryCurrency(adjustment.value)}</td><td><StockOrderStatusBadge status={adjustment.status} /></td><td><UserActionButton label={`View ${adjustment.adjustmentNo}`} icon={Eye} tone="blue" onClick={() => setSelectedAdjustment(adjustment)} /></td></tr>)}</tbody>
              </table>
            </div>
            <InventoryPagination text={`Showing 1 to ${filteredAdjustments.length} of 38 entries`} totalPage="5" onNotify={onNotify} prefix="Adjustments" />
          </article>
        </div>

        <aside className="grid gap-4">
          <AdjustmentOverviewCard onNotify={onNotify} />
          <InventoryPlainList title="Top Reasons" rows={inventoryTopReasons} onNotify={onNotify} />
          <AdjustmentRecentCard rows={adjustments.slice(0, 3)} onNotify={onNotify} />
          <section className={`${panelClass} p-4`}><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><button type="button" onClick={() => onNotify(`Adjustment filters applied: ${filteredAdjustments.length} results`)} className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276]"><RefreshCw className="size-4 text-[#0b65e5]" />Filters</button><button type="button" onClick={resetFilters} className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276]"><RefreshCw className="size-4 text-[#7585a2]" />Reset</button></div></section>
        </aside>
      </section>

      <DashboardFooter />
      {modalType === 'New Adjustment' ? <AdjustmentModal onClose={() => setModalType(null)} onSave={saveAdjustment} /> : null}
      {modalType === 'Import' ? <InventoryImportModal title="Adjustments Import" onClose={() => setModalType(null)} onNotify={onNotify} /> : null}
      {modalType === 'Inventory Settings' ? <InventoryTransactionModal type="Inventory Settings" items={items} onClose={() => setModalType(null)} onSave={() => setModalType(null)} onNotify={onNotify} /> : null}
      {selectedAdjustment ? <AdjustmentDetailModal adjustment={selectedAdjustment} onClose={() => setSelectedAdjustment(null)} onNotify={onNotify} /> : null}
    </div>
  );
}

function InventoryWarehousesPage({ onNotify }) {
  const [warehouses, setWarehouses] = useState(warehouseRows);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All Status');
  const [type, setType] = useState('All Types');
  const [location, setLocation] = useState('All Locations');
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [modalType, setModalType] = useState(null);

  const filteredWarehouses = warehouses.filter((warehouse) => {
    const queryText = query.toLowerCase();
    const queryMatch = [warehouse.code, warehouse.name, warehouse.location].some((value) => value.toLowerCase().includes(queryText));
    const statusMatch = status === 'All Status' || warehouse.status === status;
    const typeMatch = type === 'All Types' || warehouse.type === type;
    const locationMatch = location === 'All Locations' || warehouse.location.includes(location);
    return queryMatch && statusMatch && typeMatch && locationMatch;
  });

  const saveWarehouse = (warehouse) => {
    const nextWarehouse = { ...warehouse, id: warehouse.id || Date.now(), code: warehouse.code || `WH-${Date.now().toString().slice(-4)}` };
    setWarehouses((current) => (current.some((item) => item.id === nextWarehouse.id) ? current.map((item) => (item.id === nextWarehouse.id ? nextWarehouse : item)) : [nextWarehouse, ...current]));
    setSelectedWarehouse(null);
    setModalType(null);
    onNotify(`${nextWarehouse.name} saved`);
  };

  const resetFilters = () => {
    setQuery('');
    setStatus('All Status');
    setType('All Types');
    setLocation('All Locations');
    onNotify('Warehouse filters reset');
  };

  return (
    <div className="space-y-4">
      <PageHeading
        title="Warehouses"
        crumbs={[{ label: 'Dashboard', onClick: () => onNotify('Dashboard breadcrumb selected') }, { label: 'Inventory', onClick: () => onNotify('Inventory breadcrumb selected') }, { label: 'Warehouses' }]}
        actions={<><button type="button" onClick={() => { setSelectedWarehouse(null); setModalType('Add Warehouse'); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#078c3e] px-5 text-[13px] font-extrabold text-white shadow-[0_12px_22px_rgba(13,159,74,0.22)] transition hover:-translate-y-0.5 hover:bg-[#067832]"><Plus className="size-4" />Add Warehouse</button><button type="button" onClick={() => setModalType('Import')} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-5 text-[13px] font-extrabold text-[#1e3261] transition hover:bg-[#f8fbff]"><Download className="size-4 text-[#0b65e5]" />Import</button><button type="button" onClick={() => onNotify('Warehouses exported')} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-5 text-[13px] font-extrabold text-[#1e3261] transition hover:bg-[#f8fbff]"><Download className="size-4 text-[#0b65e5]" />Export</button><button type="button" onClick={() => setModalType('Inventory Settings')} aria-label="Warehouse settings" className="inline-flex size-11 items-center justify-center rounded-[8px] border border-[#d9e4f2] bg-white text-[#233a6b] transition hover:bg-[#f8fbff]"><Settings className="size-4" /></button></>}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <InventoryStatCard label="Total Warehouses" value="8" caption="All Warehouses" icon={Boxes} tone="blue" onClick={() => onNotify('All warehouses opened')} />
        <InventoryStatCard label="Active Warehouses" value="7" caption="Operational" icon={CheckCircle2} tone="green" onClick={() => setStatus('Active')} />
        <InventoryStatCard label="Inactive Warehouses" value="1" caption="Not Operational" icon={Minus} tone="amber" onClick={() => setStatus('Inactive')} />
        <InventoryStatCard label="Total Capacity" value="25,600" caption="Storage Capacity (SQ.FT)" icon={RefreshCw} tone="purple" onClick={() => onNotify('Capacity opened')} />
        <InventoryStatCard label="Utilization" value="68.45%" caption="17,523 of 25,600 SQ.FT" icon={ReceiptText} tone="blue" onClick={() => onNotify('Utilization opened')} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="space-y-4">
          <section className={`${panelClass} p-4 sm:p-5`}><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.35fr_0.9fr_0.9fr_0.9fr] xl:items-end"><label className="flex h-11 items-center gap-3 rounded-[8px] border border-black/20 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100"><Search className="size-4 text-[#7386a3]" /><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Search by warehouse name, code, location..." className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-[#30466d] outline-none placeholder:text-[#8493ab]" /></label><ReportSelect label="Status" value={status} onChange={setStatus} options={['All Status', 'Active', 'Inactive']} /><ReportSelect label="Warehouse Type" value={type} onChange={setType} options={['All Types', 'Main Warehouse', 'Branch Warehouse', 'Storage Point']} /><ReportSelect label="Location" value={location} onChange={setLocation} options={['All Locations', 'Indore', 'Bhopal', 'Ujjain', 'Jabalpur', 'Gwalior', 'Ratlam', 'Katni', 'Sagar']} /></div></section>

          <article className={`${panelClass} overflow-hidden p-3 sm:p-4`}>
            <h2 className="px-1 pb-4 font-display text-[15px] font-extrabold text-[#06135a]">Warehouses List</h2>
            <div className="space-y-3 lg:hidden">{filteredWarehouses.map((warehouse, index) => <WarehouseMobileCard key={warehouse.id} warehouse={warehouse} index={index + 1} onOpen={() => { setSelectedWarehouse(warehouse); setModalType('Edit Warehouse'); }} />)}</div>
            <div className="hidden overflow-x-auto rounded-[12px] border border-[#e7eef7] bg-white lg:block"><table className="crm-table min-w-[1080px] w-full"><thead><tr>{['#', 'Warehouse Code', 'Warehouse Name', 'Type', 'Location', 'Manager', 'Capacity (SQ.FT)', 'Utilization', 'Status', 'Action'].map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{filteredWarehouses.map((warehouse, index) => <tr key={warehouse.id}><td>{index + 1}</td><td className="font-extrabold text-[#1e3261]">{warehouse.code}</td><td className="font-extrabold text-[#1e3261]">{warehouse.name}</td><td>{warehouse.type}</td><td>{warehouse.location}</td><td>{warehouse.manager}</td><td>{warehouse.capacity.toLocaleString('en-IN')}</td><td><WarehouseUtilization value={warehouse.utilization} /></td><td><AccountStatusBadge status={warehouse.status} /></td><td><UserActionButton label={`Edit ${warehouse.name}`} icon={MoreVertical} tone="blue" onClick={() => { setSelectedWarehouse(warehouse); setModalType('Edit Warehouse'); }} /></td></tr>)}</tbody></table></div>
            <InventoryPagination text={`Showing 1 to ${filteredWarehouses.length} of 8 entries`} totalPage="1" onNotify={onNotify} prefix="Warehouses" />
          </article>
        </div>

        <aside className="grid gap-4">
          <WarehouseOverviewCard onNotify={onNotify} />
          <WarehouseCapacityCard onNotify={onNotify} />
          <WarehouseRecentCard onNotify={onNotify} />
          <section className={`${panelClass} p-4`}><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><button type="button" onClick={() => onNotify(`Warehouse filters applied: ${filteredWarehouses.length} results`)} className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276]"><RefreshCw className="size-4 text-[#0b65e5]" />Filters</button><button type="button" onClick={resetFilters} className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276]"><RefreshCw className="size-4 text-[#7585a2]" />Reset</button></div></section>
        </aside>
      </section>

      <DashboardFooter />
      {modalType === 'Add Warehouse' || modalType === 'Edit Warehouse' ? <WarehouseModal warehouse={selectedWarehouse} onClose={() => { setSelectedWarehouse(null); setModalType(null); }} onSave={saveWarehouse} /> : null}
      {modalType === 'Import' ? <InventoryImportModal title="Warehouses Import" onClose={() => setModalType(null)} onNotify={onNotify} /> : null}
      {modalType === 'Inventory Settings' ? <InventoryTransactionModal type="Inventory Settings" items={[]} onClose={() => setModalType(null)} onSave={() => setModalType(null)} onNotify={onNotify} /> : null}
    </div>
  );
}

function InventoryStatCard({ label, value, caption, icon: Icon, tone, onClick }) {
  const toneClass = {
    blue: 'bg-[#e8f2ff] text-[#0b65e5]',
    green: 'bg-[#e8f8eb] text-[#0d9f4a]',
    amber: 'bg-[#fff0dc] text-[#d98200]',
    red: 'bg-[#ffe9e6] text-[#ef4444]',
    purple: 'bg-[#f3edff] text-[#7c3aed]',
  }[tone] ?? 'bg-[#e8f2ff] text-[#0b65e5]';

  return (
    <button type="button" onClick={onClick} className={`${panelClass} flex min-h-[110px] items-center gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(24,48,87,0.1)]`}>
      <span className={cx('grid size-12 shrink-0 place-items-center rounded-full', toneClass)}>
        <Icon className="size-6" />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-bold text-[#53647f]">{label}</span>
        <span className="mt-1 block font-display text-[23px] font-extrabold text-[#111827]">{value}</span>
        <span className="mt-2 block text-[11px] font-bold text-[#314a79]">{caption}</span>
      </span>
    </button>
  );
}

function InventoryMobileCard({ item, index, onOpen }) {
  return (
    <article className="rounded-[14px] border border-[#e7eef7] bg-white p-4 shadow-[0_10px_22px_rgba(17,39,84,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-extrabold text-[#8a98af]">#{index}</p>
          <p className="mt-1 text-[15px] font-extrabold text-[#1e3261]">{item.productName}</p>
          <p className="mt-1 text-[12px] font-bold text-[#53647f]">{item.sku} - {item.warehouse}</p>
        </div>
        <InventoryStatusBadge status={item.status} />
      </div>
      <div className="mt-4 grid gap-3 text-[12px] min-[420px]:grid-cols-2">
        <InfoCell label="Category" value={item.category} />
        <InfoCell label="In Stock" value={String(item.stock)} />
        <InfoCell label="Reserved" value={String(item.reserved)} />
        <InfoCell label="Available" value={String(item.available)} />
      </div>
      <button type="button" onClick={onOpen} className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white text-[12px] font-extrabold text-[#0b65e5]">
        <FileText className="size-4" />
        Edit Product
      </button>
    </article>
  );
}

function InventoryStatusOverview({ onNotify }) {
  return (
    <article className={`${panelClass} p-5`}>
      <h2 className="font-display text-[15px] font-extrabold text-[#06135a]">Stock Status Overview</h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-[130px_minmax(0,1fr)] sm:items-center xl:grid-cols-1 2xl:grid-cols-[130px_minmax(0,1fr)]">
        <button
          type="button"
          onClick={() => onNotify('Stock status chart opened')}
          aria-label="Open stock status chart"
          className="mx-auto size-[124px] rounded-full border border-[#edf2f8]"
          style={{ background: 'conic-gradient(#38a96c 0 81.25%, #ffb13b 81.25% 95.31%, #ef4444 95.31% 100%)' }}
        >
          <span className="m-auto block size-[56px] rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(238,242,248,0.9)]" />
        </button>
        <div className="space-y-3">
          <StockLegend color="bg-[#38a96c]" label="In Stock" value="104 (81.25%)" />
          <StockLegend color="bg-[#ffb13b]" label="Low Stock" value="18 (14.06%)" />
          <StockLegend color="bg-[#ef4444]" label="Out of Stock" value="6 (4.69%)" />
          <div className="border-t border-[#edf2f8] pt-3 text-[12px] font-extrabold text-[#314a79]">
            <span>Total Items</span>
            <span className="float-right">128</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function StockLegend({ color, dotColor, label, value }) {
  return (
    <p className="flex items-center gap-3 text-[12px] font-bold text-[#314a79]">
      <span className={cx('size-2.5 rounded-full', color)} style={dotColor ? { backgroundColor: dotColor } : undefined} />
      <span className="min-w-0 flex-1">{label}</span>
      <span>{value}</span>
    </p>
  );
}

function RecentStockInward({ onNotify }) {
  return (
    <article className={`${panelClass} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-[15px] font-extrabold text-[#06135a]">Recent Stock Inward</h2>
        <button type="button" onClick={() => onNotify('All stock inward entries opened')} className="text-[12px] font-extrabold text-[#0b65e5]">View All</button>
      </div>
      <div className="mt-4 space-y-4">
        {recentStockInwardRows.map((item) => (
          <button key={`${item.productName}-${item.date}`} type="button" onClick={() => onNotify(`${item.productName} inward entry opened`)} className="flex w-full items-center gap-3 rounded-[10px] p-2 text-left transition hover:bg-[#f8fbff]">
            <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#e8f8ff] text-[#0891b2]">
              <CalendarDays className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-extrabold text-[#1e3261]">{item.productName}</span>
              <span className="mt-1 block truncate text-[11px] font-bold text-[#53647f]">{item.warehouse}</span>
            </span>
            <span className="shrink-0 text-[11px] font-bold text-[#314a79]">{item.date}</span>
          </button>
        ))}
      </div>
    </article>
  );
}

function InventoryQuickAction({ action, onClick }) {
  const Icon = action.icon;
  const toneClass = {
    green: 'bg-[#e8f8eb] text-[#0d9f4a]',
    amber: 'bg-[#fff0dc] text-[#d98200]',
    purple: 'bg-[#f3edff] text-[#7c3aed]',
    blue: 'bg-[#e8f2ff] text-[#0b65e5]',
  }[action.tone] ?? 'bg-[#e8f2ff] text-[#0b65e5]';

  return (
    <button type="button" onClick={onClick} className="flex min-h-[64px] items-center gap-3 rounded-[10px] border border-[#e7eef7] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:bg-[#f8fbff]">
      <span className={cx('grid size-10 shrink-0 place-items-center rounded-[10px]', toneClass)}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] font-extrabold text-[#06135a]">{action.label}</span>
        <span className="mt-1 block text-[11px] font-bold text-[#53647f]">{action.description}</span>
      </span>
    </button>
  );
}

function InventoryItemModal({ item, onClose, onSave, onNotify }) {
  const [draft, setDraft] = useState(item);
  const updateField = (field, value) => {
    setDraft((current) => {
      const numericFields = ['stock', 'reserved'];
      const nextValue = numericFields.includes(field) ? Number(value) || 0 : value;
      const next = { ...current, [field]: nextValue };
      const available = Math.max(Number(next.stock) - Number(next.reserved), 0);
      return {
        ...next,
        available,
        status: available === 0 ? 'Out of Stock' : available <= 20 ? 'Low Stock' : next.status,
      };
    });
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#111827]/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[680px] rounded-[16px] bg-white shadow-[0_30px_70px_rgba(17,24,39,0.28)]">
        <div className="flex items-center justify-between border-b border-[#edf2f8] px-6 py-5">
          <h2 className="flex items-center gap-3 font-display text-[20px] font-extrabold text-[#111827]"><Boxes className="size-5 text-[#0d9f4a]" /> Edit Inventory Item</h2>
          <button type="button" onClick={onClose} className="text-[#7585a2]" aria-label="Close item editor"><X className="size-5" /></button>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <ModalTextInput label="Product Name" value={draft.productName} onChange={(value) => updateField('productName', value)} placeholder="Product name" />
          <ModalTextInput label="SKU" value={draft.sku} onChange={(value) => updateField('sku', value)} placeholder="SKU" />
          <ReportSelect label="Category" value={draft.category} onChange={(value) => updateField('category', value)} options={['Solar Panel', 'Inverter', 'Battery', 'Structure', 'Cable', 'Accessories']} />
          <ReportSelect label="Warehouse" value={draft.warehouse} onChange={(value) => updateField('warehouse', value)} options={['Indore Warehouse', 'Bhopal Warehouse', 'Ujjain Warehouse']} />
          <ModalTextInput label="In Stock" value={String(draft.stock)} onChange={(value) => updateField('stock', value)} placeholder="0" />
          <ModalTextInput label="Reserved" value={String(draft.reserved)} onChange={(value) => updateField('reserved', value)} placeholder="0" />
          <ReadonlyField label="Available" value={String(draft.available)} />
          <ReportSelect label="Status" value={draft.status} onChange={(value) => updateField('status', value)} options={['In Stock', 'Low Stock', 'Out of Stock']} />
        </div>
        <div className="flex flex-col justify-end gap-3 border-t border-[#edf2f8] px-6 py-5 sm:flex-row">
          <button type="button" onClick={() => onNotify(`${item.productName} history opened`)} className="h-10 rounded-[8px] border border-[#d9e4f2] bg-white px-5 text-[13px] font-extrabold text-[#233a6b]">View History</button>
          <button type="button" onClick={onClose} className="h-10 rounded-[8px] border border-[#d9e4f2] bg-white px-5 text-[13px] font-extrabold text-[#233a6b]">Cancel</button>
          <button type="button" onClick={() => onSave(draft)} className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#0d9f4a] px-6 text-[13px] font-extrabold text-white">
            <Save className="size-4" />
            Update Item
          </button>
        </div>
      </div>
    </div>
  );
}

function InventoryTransactionModal({ type, items, onClose, onSave, onNotify }) {
  const [form, setForm] = useState({
    productId: String(items[0]?.id ?? ''),
    quantity: '10',
    reference: '',
    warehouse: 'Indore Warehouse',
  });

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const isSettings = type === 'Inventory Settings';

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#111827]/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[560px] rounded-[16px] bg-white shadow-[0_30px_70px_rgba(17,24,39,0.28)]">
        <div className="flex items-center justify-between border-b border-[#edf2f8] px-6 py-5">
          <h2 className="flex items-center gap-3 font-display text-[20px] font-extrabold text-[#111827]"><ClipboardPlus className="size-5 text-[#0d9f4a]" /> {type}</h2>
          <button type="button" onClick={onClose} className="text-[#7585a2]" aria-label="Close stock action"><X className="size-5" /></button>
        </div>
        {isSettings ? (
          <div className="space-y-3 p-6">
            {['Low stock alerts enabled', 'Auto SKU validation', 'Warehouse-level approvals'].map((setting) => (
              <label key={setting} className="flex items-center justify-between rounded-[10px] border border-[#e7eef7] bg-white p-4 text-[13px] font-extrabold text-[#1e3261]">
                {setting}
                <input type="checkbox" defaultChecked className="size-5 rounded accent-[#0d9f4a]" />
              </label>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <ReportSelect label="Product" value={form.productId} onChange={(value) => updateField('productId', value)} options={items.map((item) => String(item.id))} />
            <ModalTextInput label="Quantity" value={form.quantity} onChange={(value) => updateField('quantity', value)} placeholder="Enter quantity" />
            <ReportSelect label="Warehouse" value={form.warehouse} onChange={(value) => updateField('warehouse', value)} options={['Indore Warehouse', 'Bhopal Warehouse', 'Ujjain Warehouse']} />
            <ModalTextInput label="Reference" value={form.reference} onChange={(value) => updateField('reference', value)} placeholder="Invoice / Project ref" />
          </div>
        )}
        <div className="flex flex-col justify-end gap-3 border-t border-[#edf2f8] px-6 py-5 sm:flex-row">
          <button type="button" onClick={onClose} className="h-10 rounded-[8px] border border-[#d9e4f2] bg-white px-6 text-[13px] font-extrabold text-[#233a6b]">Cancel</button>
          <button
            type="button"
            onClick={() => {
              if (isSettings) {
                onNotify('Inventory settings saved');
                onClose();
                return;
              }
              onSave({ ...form, type });
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#0d9f4a] px-6 text-[13px] font-extrabold text-white"
          >
            <Save className="size-4" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function InventoryStatusBadge({ status }) {
  const classes = {
    'In Stock': 'bg-[#e8f8eb] text-[#0d9f4a]',
    'Low Stock': 'bg-[#fff0dc] text-[#d98200]',
    'Out of Stock': 'bg-[#ffe9e6] text-[#ef4444]',
  }[status] ?? 'bg-[#eef2f7] text-[#53647f]';
  return <span className={cx('inline-flex rounded-[7px] px-2.5 py-1 text-[11px] font-extrabold', classes)}>{status}</span>;
}

function enrichInventoryProduct(item) {
  const meta = inventoryProductMeta[item.sku] ?? { brand: 'Malwa Solar', unit: 'Nos', sellingPrice: 0 };
  return { ...item, ...meta };
}

function formatInventoryCurrency(value) {
  return `Rs ${Number(value || 0).toLocaleString('en-IN')}`;
}

function InventoryPagination({ text, totalPage, onNotify, prefix }) {
  return (
    <div className="flex flex-col gap-4 px-3 py-5 text-[13px] font-bold text-[#53647f] sm:flex-row sm:items-center sm:justify-between">
      <p>{text}</p>
      <div className="flex flex-wrap items-center gap-2">
        <PaginationButton onClick={() => onNotify(`Previous ${prefix} page selected`)}><ChevronLeft className="size-4" /></PaginationButton>
        <PaginationButton active onClick={() => onNotify(`${prefix} page 1 selected`)}>1</PaginationButton>
        <PaginationButton onClick={() => onNotify(`${prefix} page 2 selected`)}>2</PaginationButton>
        <PaginationButton onClick={() => onNotify(`${prefix} page 3 selected`)}>3</PaginationButton>
        <span className="px-2 text-[#53647f]">...</span>
        <PaginationButton onClick={() => onNotify(`${prefix} page ${totalPage} selected`)}>{totalPage}</PaginationButton>
        <PaginationButton onClick={() => onNotify(`Next ${prefix} page selected`)}><ChevronRight className="size-4" /></PaginationButton>
      </div>
    </div>
  );
}

function DateFilter({ label, value, onChange }) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-[12px] font-extrabold text-[#34466c]">{label}</span>
      <span className="flex h-11 items-center gap-3 rounded-[8px] border border-black/20 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
        <CalendarDays className="size-4 text-[#53647f]" />
        <input
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-[#30466d] outline-none"
        />
      </span>
    </label>
  );
}

function InventoryProductMobileCard({ product, index, onOpen }) {
  return (
    <article className="rounded-[14px] border border-[#e7eef7] bg-white p-4 shadow-[0_10px_22px_rgba(17,39,84,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-extrabold text-[#8a98af]">#{index}</p>
          <p className="mt-1 text-[15px] font-extrabold text-[#1e3261]">{product.productName}</p>
          <p className="mt-1 text-[12px] font-bold text-[#53647f]">{product.sku} - {product.brand}</p>
        </div>
        <InventoryStatusBadge status={product.status} />
      </div>
      <div className="mt-4 grid gap-3 text-[12px] min-[420px]:grid-cols-2">
        <InfoCell label="Category" value={product.category} />
        <InfoCell label="Unit" value={product.unit} />
        <InfoCell label="Selling Price" value={formatInventoryCurrency(product.sellingPrice)} />
        <InfoCell label="In Stock" value={String(product.stock)} />
      </div>
      <button type="button" onClick={onOpen} className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white text-[12px] font-extrabold text-[#0b65e5]">
        <FileText className="size-4" />
        Edit Product
      </button>
    </article>
  );
}

function ProductStatusOverview({ onNotify }) {
  return (
    <article className={`${panelClass} p-5`}>
      <h2 className="font-display text-[15px] font-extrabold text-[#06135a]">Stock Status Overview</h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-[130px_minmax(0,1fr)] sm:items-center xl:grid-cols-1 2xl:grid-cols-[130px_minmax(0,1fr)]">
        <button
          type="button"
          onClick={() => onNotify('Product stock status chart opened')}
          className="mx-auto size-[124px] rounded-full border border-[#edf2f8]"
          style={{ background: 'conic-gradient(#20a864 0 91.67%, #f7b731 91.67% 97.92%, #ef4444 97.92% 100%)' }}
          aria-label="Open product stock status chart"
        >
          <span className="m-auto block size-[56px] rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(238,242,248,0.9)]" />
        </button>
        <div className="space-y-3">
          <StockLegend color="bg-[#20a864]" label="In Stock" value="88 (91.67%)" />
          <StockLegend color="bg-[#f7b731]" label="Low Stock" value="6 (6.25%)" />
          <StockLegend color="bg-[#ef4444]" label="Out of Stock" value="2 (2.08%)" />
          <div className="border-t border-[#edf2f8] pt-3 text-[12px] font-extrabold text-[#314a79]"><span>Total Products</span><span className="float-right">96</span></div>
        </div>
      </div>
    </article>
  );
}

function InventorySideList({ title, rows, onNotify }) {
  return (
    <article className={`${panelClass} p-5`}>
      <h2 className="font-display text-[15px] font-extrabold text-[#06135a]">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <button key={row.label} type="button" onClick={() => onNotify(`${row.label} opened`)} className="flex w-full items-center gap-3 rounded-[8px] p-1 text-left transition hover:bg-[#f8fbff]">
              <span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-[#e8f2ff] text-[#0b65e5]"><Icon className="size-3.5" /></span>
              <span className="min-w-0 flex-1 text-[12px] font-bold text-[#314a79]">{row.label}</span>
              <span className="text-[12px] font-extrabold text-[#1e3261]">{row.value}</span>
            </button>
          );
        })}
      </div>
    </article>
  );
}

function ProductRecentActivities({ onNotify }) {
  return (
    <article className={`${panelClass} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-[15px] font-extrabold text-[#06135a]">Recent Activities</h2>
        <button type="button" onClick={() => onNotify('All product activities opened')} className="text-[12px] font-extrabold text-[#0b65e5]">View All</button>
      </div>
      <div className="mt-4 space-y-4">
        {inventoryRecentActivities.map((activity) => {
          const Icon = activity.icon;
          const toneClass = {
            green: 'bg-[#e8f8eb] text-[#0d9f4a]',
            blue: 'bg-[#e8f2ff] text-[#0b65e5]',
            amber: 'bg-[#fff0dc] text-[#d98200]',
            red: 'bg-[#ffe9e6] text-[#ef4444]',
          }[activity.tone];
          return (
            <button key={`${activity.title}-${activity.date}`} type="button" onClick={() => onNotify(activity.title)} className="flex w-full items-start gap-3 rounded-[10px] p-2 text-left transition hover:bg-[#f8fbff]">
              <span className={cx('grid size-9 shrink-0 place-items-center rounded-full', toneClass)}><Icon className="size-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-extrabold text-[#1e3261]">{activity.title}</span>
                <span className="mt-1 block text-[11px] font-bold text-[#53647f]">by {activity.by}</span>
              </span>
              <span className="shrink-0 text-[11px] font-bold text-[#314a79]">{activity.date}</span>
            </button>
          );
        })}
      </div>
    </article>
  );
}

function InventoryProductModal({ product, onClose, onSave }) {
  const [form, setForm] = useState(product ?? {
    productName: '',
    sku: '',
    category: 'Solar Panel',
    warehouse: 'Indore Warehouse',
    brand: '',
    unit: 'Nos',
    sellingPrice: 0,
    stock: 0,
    reserved: 0,
    status: 'In Stock',
  });

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: ['sellingPrice', 'stock', 'reserved'].includes(field) ? Number(value) || 0 : value }));

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#111827]/45 p-4 backdrop-blur-[2px]">
      <div className="max-h-[92vh] w-full max-w-[760px] overflow-y-auto rounded-[16px] bg-white shadow-[0_30px_70px_rgba(17,24,39,0.28)]">
        <div className="flex items-center justify-between border-b border-[#edf2f8] px-6 py-5">
          <h2 className="flex items-center gap-3 font-display text-[20px] font-extrabold text-[#111827]"><Boxes className="size-5 text-[#0d9f4a]" /> {product ? 'Edit Product' : 'Add Product'}</h2>
          <button type="button" onClick={onClose} className="text-[#7585a2]" aria-label="Close product editor"><X className="size-5" /></button>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <ModalTextInput label="Product Name" value={form.productName} onChange={(value) => updateField('productName', value)} placeholder="Product name" />
          <ModalTextInput label="SKU" value={form.sku} onChange={(value) => updateField('sku', value)} placeholder="SKU" />
          <ReportSelect label="Category" value={form.category} onChange={(value) => updateField('category', value)} options={['Solar Panel', 'Inverter', 'Battery', 'Structure', 'Cable', 'Accessories']} />
          <ReportSelect label="Warehouse" value={form.warehouse} onChange={(value) => updateField('warehouse', value)} options={['Indore Warehouse', 'Bhopal Warehouse', 'Ujjain Warehouse']} />
          <ModalTextInput label="Brand" value={form.brand} onChange={(value) => updateField('brand', value)} placeholder="Brand" />
          <ReportSelect label="Unit" value={form.unit} onChange={(value) => updateField('unit', value)} options={['Nos', 'Set', 'Meter', 'Kg']} />
          <ModalTextInput label="Selling Price" value={String(form.sellingPrice)} onChange={(value) => updateField('sellingPrice', value)} placeholder="0" />
          <ModalTextInput label="In Stock" value={String(form.stock)} onChange={(value) => updateField('stock', value)} placeholder="0" />
          <ModalTextInput label="Reserved" value={String(form.reserved)} onChange={(value) => updateField('reserved', value)} placeholder="0" />
          <ReportSelect label="Status" value={form.status} onChange={(value) => updateField('status', value)} options={['In Stock', 'Low Stock', 'Out of Stock']} />
        </div>
        <div className="flex flex-col justify-end gap-3 border-t border-[#edf2f8] px-6 py-5 sm:flex-row">
          <button type="button" onClick={onClose} className="h-10 rounded-[8px] border border-[#d9e4f2] bg-white px-6 text-[13px] font-extrabold text-[#233a6b]">Cancel</button>
          <button type="button" onClick={() => onSave({ ...form, productName: form.productName || 'New Product', sku: form.sku || `SKU-${Date.now().toString().slice(-4)}` })} className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#0d9f4a] px-6 text-[13px] font-extrabold text-white"><Save className="size-4" />Save Product</button>
        </div>
      </div>
    </div>
  );
}

function InventoryMovementMobileCard({ order, index, isInward, onOpen }) {
  return (
    <article className="rounded-[14px] border border-[#e7eef7] bg-white p-4 shadow-[0_10px_22px_rgba(17,39,84,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-extrabold text-[#8a98af]">#{index}</p>
          <p className="mt-1 text-[15px] font-extrabold text-[#1e3261]">{order.orderNo}</p>
          <p className="mt-1 text-[12px] font-bold text-[#53647f]">{order.party}</p>
        </div>
        <StockOrderStatusBadge status={order.status} />
      </div>
      <div className="mt-4 grid gap-3 text-[12px] min-[420px]:grid-cols-2">
        <InfoCell label="Invoice" value={order.invoiceNo} />
        <InfoCell label="Warehouse" value={order.warehouse} />
        <InfoCell label={isInward ? 'Inward Date' : 'Outward Date'} value={order.date} />
        <InfoCell label="Total Value" value={formatInventoryCurrency(order.value)} />
      </div>
      <button type="button" onClick={onOpen} className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white text-[12px] font-extrabold text-[#0b65e5]"><Eye className="size-4" />View Order</button>
    </article>
  );
}

function MovementOverviewCard({ isInward, onNotify }) {
  const title = isInward ? 'Inward Overview' : 'Outward Overview';
  const values = isInward
    ? [['Completed', '44 (70.97%)', '#20a864'], ['Partially Received', '8 (12.90%)', '#f7b731'], ['Pending', '6 (9.68%)', '#2d7ff9'], ['Cancelled', '4 (6.45%)', '#ef4444']]
    : [['Delivered', '38 (65.52%)', '#20a864'], ['In Transit', '10 (17.24%)', '#2d7ff9'], ['Pending', '8 (13.79%)', '#f7b731'], ['Cancelled', '2 (3.45%)', '#ef4444']];
  return (
    <article className={`${panelClass} p-5`}>
      <h2 className="font-display text-[15px] font-extrabold text-[#06135a]">{title}</h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-[118px_minmax(0,1fr)] sm:items-center xl:grid-cols-1 2xl:grid-cols-[118px_minmax(0,1fr)]">
        <button type="button" onClick={() => onNotify(`${title} chart opened`)} aria-label={`Open ${title}`} className="mx-auto size-[112px] rounded-full border border-[#edf2f8]" style={{ background: isInward ? 'conic-gradient(#20a864 0 70.97%, #f7b731 70.97% 83.87%, #2d7ff9 83.87% 93.55%, #ef4444 93.55% 100%)' : 'conic-gradient(#20a864 0 65.52%, #2d7ff9 65.52% 82.76%, #f7b731 82.76% 96.55%, #ef4444 96.55% 100%)' }}>
          <span className="m-auto block size-[50px] rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(238,242,248,0.9)]" />
        </button>
        <div className="space-y-3">
          {values.map(([label, value, color]) => <StockLegend key={label} color="" label={label} value={value} dotColor={color} />)}
          <div className="border-t border-[#edf2f8] pt-3 text-[12px] font-extrabold text-[#314a79]"><span>Total {isInward ? 'Inward Orders' : 'Orders'}</span><span className="float-right">{isInward ? '62' : '58'}</span></div>
        </div>
      </div>
    </article>
  );
}

function InventoryPlainList({ title, rows, onNotify }) {
  return (
    <article className={`${panelClass} p-5`}>
      <h2 className="font-display text-[15px] font-extrabold text-[#06135a]">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.map(([label, value]) => (
          <button key={label} type="button" onClick={() => onNotify(`${label} opened`)} className="flex w-full items-center gap-3 rounded-[8px] p-1 text-left transition hover:bg-[#f8fbff]">
            <span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-[#e8f8eb] text-[#0d9f4a]"><Boxes className="size-3.5" /></span>
            <span className="min-w-0 flex-1 text-[12px] font-bold text-[#314a79]">{label}</span>
            <span className="text-[12px] font-extrabold text-[#1e3261]">{value}</span>
          </button>
        ))}
      </div>
    </article>
  );
}

function MovementRecentCard({ title, rows, onNotify }) {
  return (
    <article className={`${panelClass} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-[15px] font-extrabold text-[#06135a]">{title}</h2>
        <button type="button" onClick={() => onNotify(`${title} opened`)} className="text-[12px] font-extrabold text-[#0b65e5]">View All</button>
      </div>
      <div className="mt-4 space-y-4">
        {rows.map((row) => (
          <button key={row.orderNo} type="button" onClick={() => onNotify(`${row.orderNo} opened`)} className="flex w-full items-center gap-3 rounded-[10px] p-2 text-left transition hover:bg-[#f8fbff]">
            <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#e8f8eb] text-[#0d9f4a]"><ClipboardPlus className="size-4" /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-extrabold text-[#1e3261]">{row.orderNo}</span><span className="mt-1 block truncate text-[11px] font-bold text-[#53647f]">{row.party}</span></span>
            <span className="shrink-0 text-[11px] font-bold text-[#314a79]">{row.date}</span>
          </button>
        ))}
      </div>
    </article>
  );
}

function InventoryImportModal({ title, onClose, onNotify }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#111827]/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[500px] rounded-[16px] bg-white p-6 shadow-[0_30px_70px_rgba(17,24,39,0.28)]">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="font-display text-[20px] font-extrabold text-[#111827]">{title}</h2><p className="mt-2 text-[13px] font-bold text-[#53647f]">CSV/XLSX import flow is ready for integration.</p></div>
          <button type="button" onClick={onClose} className="text-[#7585a2]" aria-label="Close import"><X className="size-5" /></button>
        </div>
        <label className="mt-5 flex h-28 cursor-pointer items-center justify-center rounded-[12px] border border-dashed border-[#b9c4d6] bg-[#f8fbff] text-[13px] font-extrabold text-[#1e3261]">
          Select CSV / XLSX file
          <input type="file" className="hidden" onChange={() => onNotify(`${title} file selected`)} />
        </label>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="h-10 rounded-[8px] border border-[#d9e4f2] bg-white px-5 text-[13px] font-extrabold text-[#233a6b]">Cancel</button>
          <button type="button" onClick={() => { onNotify(`${title} queued`); onClose(); }} className="h-10 rounded-[8px] bg-[#0d9f4a] px-5 text-[13px] font-extrabold text-white">Import</button>
        </div>
      </div>
    </div>
  );
}

function StockMovementOrderModal({ isInward, onClose, onSave }) {
  const [form, setForm] = useState({
    orderNo: '',
    invoiceNo: '',
    party: isInward ? 'Waaree Energies Ltd.' : 'Sunlight Enterprises',
    warehouse: 'Indore Warehouse',
    date: 'Today',
    items: 1,
    quantity: 10,
    value: 0,
    status: isInward ? 'Completed' : 'Delivered',
  });
  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: ['items', 'quantity', 'value'].includes(field) ? Number(value) || 0 : value }));
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#111827]/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[680px] rounded-[16px] bg-white shadow-[0_30px_70px_rgba(17,24,39,0.28)]">
        <div className="flex items-center justify-between border-b border-[#edf2f8] px-6 py-5"><h2 className="font-display text-[20px] font-extrabold text-[#111827]">Add Stock {isInward ? 'Inward' : 'Outward'}</h2><button type="button" onClick={onClose} className="text-[#7585a2]"><X className="size-5" /></button></div>
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <ModalTextInput label={isInward ? 'PO Number' : 'SO Number'} value={form.orderNo} onChange={(value) => updateField('orderNo', value)} placeholder="Auto generated if blank" />
          <ModalTextInput label="Invoice Number" value={form.invoiceNo} onChange={(value) => updateField('invoiceNo', value)} placeholder="Invoice number" />
          <ModalTextInput label={isInward ? 'Supplier' : 'Customer / Project'} value={form.party} onChange={(value) => updateField('party', value)} placeholder="Party name" />
          <ReportSelect label="Warehouse" value={form.warehouse} onChange={(value) => updateField('warehouse', value)} options={['Indore Warehouse', 'Bhopal Warehouse', 'Ujjain Warehouse']} />
          <ModalTextInput label="Items" value={String(form.items)} onChange={(value) => updateField('items', value)} placeholder="0" />
          <ModalTextInput label="Quantity" value={String(form.quantity)} onChange={(value) => updateField('quantity', value)} placeholder="0" />
          <ModalTextInput label="Total Value" value={String(form.value)} onChange={(value) => updateField('value', value)} placeholder="0" />
          <ReportSelect label="Status" value={form.status} onChange={(value) => updateField('status', value)} options={isInward ? ['Completed', 'Partially Received', 'Pending', 'Cancelled'] : ['Delivered', 'In Transit', 'Pending', 'Cancelled']} />
        </div>
        <div className="flex justify-end gap-3 border-t border-[#edf2f8] px-6 py-5"><button type="button" onClick={onClose} className="h-10 rounded-[8px] border border-[#d9e4f2] bg-white px-6 text-[13px] font-extrabold text-[#233a6b]">Cancel</button><button type="button" onClick={() => onSave(form)} className="h-10 rounded-[8px] bg-[#0d9f4a] px-6 text-[13px] font-extrabold text-white">Save</button></div>
      </div>
    </div>
  );
}

function StockMovementDetailModal({ order, isInward, onClose, onNotify }) {
  return (
    <DetailModalShell title={order.orderNo} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCell label="Invoice Number" value={order.invoiceNo} />
        <InfoCell label={isInward ? 'Supplier' : 'Customer / Project'} value={order.party} />
        <InfoCell label="Warehouse" value={order.warehouse} />
        <InfoCell label="Date" value={order.date} />
        <InfoCell label="Items" value={String(order.items)} />
        <InfoCell label="Quantity" value={String(order.quantity)} />
        <InfoCell label="Total Value" value={formatInventoryCurrency(order.value)} />
        <InfoCell label="Status" valueNode={<StockOrderStatusBadge status={order.status} />} />
      </div>
      <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => onNotify(`${order.orderNo} printed`)} className="h-10 rounded-[8px] border border-[#d9e4f2] bg-white px-5 text-[13px] font-extrabold text-[#233a6b]">Print</button></div>
    </DetailModalShell>
  );
}

function StockTransferMobileCard({ transfer, index, onOpen }) {
  return (
    <article className="rounded-[14px] border border-[#e7eef7] bg-white p-4 shadow-[0_10px_22px_rgba(17,39,84,0.05)]">
      <div className="flex items-start justify-between gap-3"><div><p className="text-[12px] font-extrabold text-[#8a98af]">#{index}</p><p className="mt-1 text-[15px] font-extrabold text-[#1e3261]">{transfer.transferNo}</p><p className="mt-1 text-[12px] font-bold text-[#53647f]">{transfer.fromWarehouse} {'->'} {transfer.toWarehouse}</p></div><StockOrderStatusBadge status={transfer.status} /></div>
      <div className="mt-4 grid gap-3 text-[12px] min-[420px]:grid-cols-2"><InfoCell label="Transfer Date" value={transfer.transferDate} /><InfoCell label="Items" value={String(transfer.items)} /><InfoCell label="Quantity" value={String(transfer.quantity)} /><InfoCell label="Total Value" value={formatInventoryCurrency(transfer.value)} /></div>
      <button type="button" onClick={onOpen} className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white text-[12px] font-extrabold text-[#0b65e5]"><Eye className="size-4" />View Transfer</button>
    </article>
  );
}

function TransferOverviewCard({ onNotify }) {
  return (
    <article className={`${panelClass} p-5`}>
      <h2 className="font-display text-[15px] font-extrabold text-[#06135a]">Transfer Status Overview</h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-[118px_minmax(0,1fr)] sm:items-center xl:grid-cols-1 2xl:grid-cols-[118px_minmax(0,1fr)]">
        <button type="button" onClick={() => onNotify('Transfer status chart opened')} className="mx-auto size-[112px] rounded-full border border-[#edf2f8]" style={{ background: 'conic-gradient(#20a864 0 63.83%, #2d7ff9 63.83% 82.98%, #f7b731 82.98% 95.75%, #ef4444 95.75% 100%)' }} aria-label="Open transfer status chart"><span className="m-auto block size-[50px] rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(238,242,248,0.9)]" /></button>
        <div className="space-y-3"><StockLegend color="bg-[#20a864]" label="Completed" value="30 (63.83%)" /><StockLegend color="bg-[#2d7ff9]" label="In Transit" value="9 (19.15%)" /><StockLegend color="bg-[#f7b731]" label="Pending" value="6 (12.77%)" /><StockLegend color="bg-[#ef4444]" label="Cancelled" value="2 (4.26%)" /><div className="border-t border-[#edf2f8] pt-3 text-[12px] font-extrabold text-[#314a79]"><span>Total Transfers</span><span className="float-right">47</span></div></div>
      </div>
    </article>
  );
}

function TransferRecentCard({ rows, onNotify }) {
  return (
    <article className={`${panelClass} p-5`}>
      <div className="flex items-center justify-between gap-3"><h2 className="font-display text-[15px] font-extrabold text-[#06135a]">Recent Stock Transfers</h2><button type="button" onClick={() => onNotify('All stock transfers opened')} className="text-[12px] font-extrabold text-[#0b65e5]">View All</button></div>
      <div className="mt-4 space-y-4">{rows.map((row) => <button key={row.transferNo} type="button" onClick={() => onNotify(`${row.transferNo} opened`)} className="flex w-full items-center gap-3 rounded-[10px] p-2 text-left transition hover:bg-[#f8fbff]"><span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#e8f8eb] text-[#0d9f4a]"><RefreshCw className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-extrabold text-[#1e3261]">{row.transferNo}</span><span className="mt-1 block truncate text-[11px] font-bold text-[#53647f]">{row.fromWarehouse.replace(' Warehouse', '')} {'->'} {row.toWarehouse.replace(' Warehouse', '')}</span></span><span className="shrink-0 text-[11px] font-bold text-[#314a79]">{row.transferDate}</span></button>)}</div>
    </article>
  );
}

function StockTransferModal({ onClose, onSave }) {
  const [form, setForm] = useState({ transferNo: '', transferDate: 'Today', fromWarehouse: 'Indore Warehouse', toWarehouse: 'Bhopal Warehouse', items: 1, quantity: 10, value: 0, status: 'Pending' });
  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: ['items', 'quantity', 'value'].includes(field) ? Number(value) || 0 : value }));
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#111827]/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[640px] rounded-[16px] bg-white shadow-[0_30px_70px_rgba(17,24,39,0.28)]">
        <div className="flex items-center justify-between border-b border-[#edf2f8] px-6 py-5"><h2 className="font-display text-[20px] font-extrabold text-[#111827]">New Stock Transfer</h2><button type="button" onClick={onClose} className="text-[#7585a2]"><X className="size-5" /></button></div>
        <div className="grid gap-4 p-6 sm:grid-cols-2"><ModalTextInput label="Transfer No." value={form.transferNo} onChange={(value) => updateField('transferNo', value)} placeholder="Auto generated if blank" /><ModalTextInput label="Transfer Date" value={form.transferDate} onChange={(value) => updateField('transferDate', value)} placeholder="Today" /><ReportSelect label="From Warehouse" value={form.fromWarehouse} onChange={(value) => updateField('fromWarehouse', value)} options={['Indore Warehouse', 'Ujjain Warehouse', 'Bhopal Warehouse', 'Jabalpur Warehouse', 'Gwalior Warehouse']} /><ReportSelect label="To Warehouse" value={form.toWarehouse} onChange={(value) => updateField('toWarehouse', value)} options={['Indore Warehouse', 'Ujjain Warehouse', 'Bhopal Warehouse', 'Jabalpur Warehouse', 'Gwalior Warehouse']} /><ModalTextInput label="Items" value={String(form.items)} onChange={(value) => updateField('items', value)} placeholder="0" /><ModalTextInput label="Quantity" value={String(form.quantity)} onChange={(value) => updateField('quantity', value)} placeholder="0" /><ModalTextInput label="Total Value" value={String(form.value)} onChange={(value) => updateField('value', value)} placeholder="0" /><ReportSelect label="Status" value={form.status} onChange={(value) => updateField('status', value)} options={['Completed', 'In Transit', 'Pending', 'Cancelled']} /></div>
        <div className="flex justify-end gap-3 border-t border-[#edf2f8] px-6 py-5"><button type="button" onClick={onClose} className="h-10 rounded-[8px] border border-[#d9e4f2] bg-white px-6 text-[13px] font-extrabold text-[#233a6b]">Cancel</button><button type="button" onClick={() => onSave(form)} className="h-10 rounded-[8px] bg-[#0d9f4a] px-6 text-[13px] font-extrabold text-white">Save Transfer</button></div>
      </div>
    </div>
  );
}

function StockTransferDetailModal({ transfer, onClose, onNotify }) {
  return (
    <DetailModalShell title={transfer.transferNo} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2"><InfoCell label="Transfer Date" value={transfer.transferDate} /><InfoCell label="From Warehouse" value={transfer.fromWarehouse} /><InfoCell label="To Warehouse" value={transfer.toWarehouse} /><InfoCell label="Items" value={String(transfer.items)} /><InfoCell label="Quantity" value={String(transfer.quantity)} /><InfoCell label="Total Value" value={formatInventoryCurrency(transfer.value)} /><InfoCell label="Status" valueNode={<StockOrderStatusBadge status={transfer.status} />} /></div>
      <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => onNotify(`${transfer.transferNo} approved`)} className="h-10 rounded-[8px] bg-[#0d9f4a] px-5 text-[13px] font-extrabold text-white">Approve</button></div>
    </DetailModalShell>
  );
}

function DetailModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#111827]/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[620px] rounded-[16px] bg-white p-6 shadow-[0_30px_70px_rgba(17,24,39,0.28)]">
        <div className="mb-5 flex items-start justify-between gap-4"><h2 className="font-display text-[20px] font-extrabold text-[#111827]">{title}</h2><button type="button" onClick={onClose} className="text-[#7585a2]" aria-label="Close details"><X className="size-5" /></button></div>
        {children}
      </div>
    </div>
  );
}

function StockOrderStatusBadge({ status }) {
  const classes = {
    Completed: 'bg-[#e8f8eb] text-[#0d9f4a]',
    Delivered: 'bg-[#e8f8eb] text-[#0d9f4a]',
    'Partially Received': 'bg-[#fff0dc] text-[#d98200]',
    'In Transit': 'bg-[#e8f2ff] text-[#0b65e5]',
    Pending: 'bg-[#fff0dc] text-[#d98200]',
    Cancelled: 'bg-[#ffe9e6] text-[#ef4444]',
  }[status] ?? 'bg-[#eef2f7] text-[#53647f]';
  return <span className={cx('inline-flex rounded-[7px] px-2.5 py-1 text-[11px] font-extrabold', classes)}>{status}</span>;
}

function AdjustmentMobileCard({ adjustment, index, onOpen }) {
  return (
    <article className="rounded-[14px] border border-[#e7eef7] bg-white p-4 shadow-[0_10px_22px_rgba(17,39,84,0.05)]">
      <div className="flex items-start justify-between gap-3"><div><p className="text-[12px] font-extrabold text-[#8a98af]">#{index}</p><p className="mt-1 text-[15px] font-extrabold text-[#1e3261]">{adjustment.adjustmentNo}</p><p className="mt-1 text-[12px] font-bold text-[#53647f]">{adjustment.reason} - {adjustment.warehouse}</p></div><StockOrderStatusBadge status={adjustment.status} /></div>
      <div className="mt-4 grid gap-3 text-[12px] min-[420px]:grid-cols-2"><InfoCell label="Type" value={adjustment.type} /><InfoCell label="Date" value={adjustment.date} /><InfoCell label="Quantity" value={String(adjustment.quantity)} valueClass={adjustment.quantity < 0 ? 'text-[#ef4444]' : undefined} /><InfoCell label="Value" value={formatInventoryCurrency(adjustment.value)} /></div>
      <button type="button" onClick={onOpen} className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white text-[12px] font-extrabold text-[#0b65e5]"><Eye className="size-4" />View Adjustment</button>
    </article>
  );
}

function AdjustmentOverviewCard({ onNotify }) {
  return (
    <article className={`${panelClass} p-5`}>
      <h2 className="font-display text-[15px] font-extrabold text-[#06135a]">Adjustment Type Overview</h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-[118px_minmax(0,1fr)] sm:items-center xl:grid-cols-1 2xl:grid-cols-[118px_minmax(0,1fr)]">
        <button type="button" onClick={() => onNotify('Adjustment type chart opened')} className="mx-auto size-[112px] rounded-full border border-[#edf2f8]" style={{ background: 'conic-gradient(#20a864 0 52.63%, #ef4444 52.63% 89.47%, #f7b731 89.47% 100%)' }} aria-label="Open adjustment overview"><span className="m-auto block size-[50px] rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(238,242,248,0.9)]" /></button>
        <div className="space-y-3"><StockLegend color="bg-[#20a864]" label="Stock Increase" value="20 (52.63%)" /><StockLegend color="bg-[#ef4444]" label="Stock Decrease" value="14 (36.84%)" /><StockLegend color="bg-[#f7b731]" label="Other Movements" value="4 (10.53%)" /><div className="border-t border-[#edf2f8] pt-3 text-[12px] font-extrabold text-[#314a79]"><span>Total Adjustments</span><span className="float-right">38</span></div></div>
      </div>
    </article>
  );
}

function AdjustmentRecentCard({ rows, onNotify }) {
  return (
    <article className={`${panelClass} p-5`}>
      <div className="flex items-center justify-between gap-3"><h2 className="font-display text-[15px] font-extrabold text-[#06135a]">Recent Adjustments</h2><button type="button" onClick={() => onNotify('All recent adjustments opened')} className="text-[12px] font-extrabold text-[#0b65e5]">View All</button></div>
      <div className="mt-4 space-y-4">{rows.map((row) => <button key={row.adjustmentNo} type="button" onClick={() => onNotify(`${row.adjustmentNo} opened`)} className="flex w-full items-center gap-3 rounded-[10px] p-2 text-left transition hover:bg-[#f8fbff]"><span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-[#e8f8eb] text-center text-[10px] font-extrabold text-[#0d9f4a]">{row.date.split(' ').slice(0, 2).join(' ')}</span><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-extrabold text-[#1e3261]">{row.adjustmentNo}</span><span className="mt-1 block truncate text-[11px] font-bold text-[#53647f]">{row.reason}<br />{row.warehouse}</span></span></button>)}</div>
    </article>
  );
}

function AdjustmentModal({ onClose, onSave }) {
  const [form, setForm] = useState({ adjustmentNo: '', date: 'Today', type: 'Stock Increase', reason: 'Stock Found', warehouse: 'Indore Warehouse', items: 1, quantity: 10, value: 0, status: 'Pending' });
  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: ['items', 'quantity', 'value'].includes(field) ? Number(value) || 0 : value }));
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#111827]/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[640px] rounded-[16px] bg-white shadow-[0_30px_70px_rgba(17,24,39,0.28)]">
        <div className="flex items-center justify-between border-b border-[#edf2f8] px-6 py-5"><h2 className="font-display text-[20px] font-extrabold text-[#111827]">New Adjustment</h2><button type="button" onClick={onClose} className="text-[#7585a2]"><X className="size-5" /></button></div>
        <div className="grid gap-4 p-6 sm:grid-cols-2"><ModalTextInput label="Adjustment No." value={form.adjustmentNo} onChange={(value) => updateField('adjustmentNo', value)} placeholder="Auto generated if blank" /><ModalTextInput label="Date" value={form.date} onChange={(value) => updateField('date', value)} placeholder="Today" /><ReportSelect label="Type" value={form.type} onChange={(value) => updateField('type', value)} options={['Stock Increase', 'Stock Decrease']} /><ModalTextInput label="Reason" value={form.reason} onChange={(value) => updateField('reason', value)} placeholder="Reason" /><ReportSelect label="Warehouse" value={form.warehouse} onChange={(value) => updateField('warehouse', value)} options={['Indore Warehouse', 'Bhopal Warehouse', 'Ujjain Warehouse', 'Gwalior Warehouse', 'Jabalpur Warehouse']} /><ModalTextInput label="Items" value={String(form.items)} onChange={(value) => updateField('items', value)} placeholder="0" /><ModalTextInput label="Quantity" value={String(form.quantity)} onChange={(value) => updateField('quantity', value)} placeholder="0" /><ModalTextInput label="Value" value={String(form.value)} onChange={(value) => updateField('value', value)} placeholder="0" /><ReportSelect label="Status" value={form.status} onChange={(value) => updateField('status', value)} options={['Completed', 'In Review', 'Pending', 'Cancelled']} /></div>
        <div className="flex justify-end gap-3 border-t border-[#edf2f8] px-6 py-5"><button type="button" onClick={onClose} className="h-10 rounded-[8px] border border-[#d9e4f2] bg-white px-6 text-[13px] font-extrabold text-[#233a6b]">Cancel</button><button type="button" onClick={() => onSave(form)} className="h-10 rounded-[8px] bg-[#0d9f4a] px-6 text-[13px] font-extrabold text-white">Save Adjustment</button></div>
      </div>
    </div>
  );
}

function AdjustmentDetailModal({ adjustment, onClose, onNotify }) {
  return (
    <DetailModalShell title={adjustment.adjustmentNo} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2"><InfoCell label="Date" value={adjustment.date} /><InfoCell label="Type" value={adjustment.type} /><InfoCell label="Reason" value={adjustment.reason} /><InfoCell label="Warehouse" value={adjustment.warehouse} /><InfoCell label="Items" value={String(adjustment.items)} /><InfoCell label="Quantity" value={String(adjustment.quantity)} /><InfoCell label="Value" value={formatInventoryCurrency(adjustment.value)} /><InfoCell label="Status" valueNode={<StockOrderStatusBadge status={adjustment.status} />} /></div>
      <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => onNotify(`${adjustment.adjustmentNo} approved`)} className="h-10 rounded-[8px] bg-[#0d9f4a] px-5 text-[13px] font-extrabold text-white">Approve</button></div>
    </DetailModalShell>
  );
}

function WarehouseMobileCard({ warehouse, index, onOpen }) {
  return (
    <article className="rounded-[14px] border border-[#e7eef7] bg-white p-4 shadow-[0_10px_22px_rgba(17,39,84,0.05)]">
      <div className="flex items-start justify-between gap-3"><div><p className="text-[12px] font-extrabold text-[#8a98af]">#{index}</p><p className="mt-1 text-[15px] font-extrabold text-[#1e3261]">{warehouse.name}</p><p className="mt-1 text-[12px] font-bold text-[#53647f]">{warehouse.code} - {warehouse.location}</p></div><AccountStatusBadge status={warehouse.status} /></div>
      <div className="mt-4 grid gap-3 text-[12px] min-[420px]:grid-cols-2"><InfoCell label="Type" value={warehouse.type} /><InfoCell label="Manager" value={warehouse.manager} /><InfoCell label="Capacity" value={warehouse.capacity.toLocaleString('en-IN')} /><InfoCell label="Utilization" value={`${warehouse.utilization}%`} /></div>
      <button type="button" onClick={onOpen} className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white text-[12px] font-extrabold text-[#0b65e5]"><FileText className="size-4" />Edit Warehouse</button>
    </article>
  );
}

function WarehouseUtilization({ value }) {
  const tone = value >= 70 ? 'bg-[#0d9f4a]' : value >= 45 ? 'bg-[#f59e0b]' : value > 0 ? 'bg-[#0b65e5]' : 'bg-[#cbd5e1]';
  return <span className="flex items-center gap-3"><span className="h-2 w-24 overflow-hidden rounded-full bg-[#e4eaf3]"><span className={cx('block h-full rounded-full', tone)} style={{ width: `${Math.min(value, 100)}%` }} /></span><span className="font-extrabold text-[#314a79]">{value.toFixed(2)}%</span></span>;
}

function WarehouseOverviewCard({ onNotify }) {
  return (
    <article className={`${panelClass} p-5`}>
      <h2 className="font-display text-[15px] font-extrabold text-[#06135a]">Warehouse Overview</h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-[118px_minmax(0,1fr)] sm:items-center xl:grid-cols-1 2xl:grid-cols-[118px_minmax(0,1fr)]"><button type="button" onClick={() => onNotify('Warehouse overview chart opened')} className="mx-auto size-[112px] rounded-full border border-[#edf2f8]" style={{ background: 'conic-gradient(#20a864 0 87.5%, #ef4444 87.5% 100%)' }} aria-label="Open warehouse overview"><span className="m-auto block size-[50px] rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(238,242,248,0.9)]" /></button><div className="space-y-3"><StockLegend color="bg-[#20a864]" label="Active" value="7 (87.50%)" /><StockLegend color="bg-[#ef4444]" label="Inactive" value="1 (12.50%)" /><div className="border-t border-[#edf2f8] pt-3 text-[12px] font-extrabold text-[#314a79]"><span>Total Warehouses</span><span className="float-right">8</span></div></div></div>
    </article>
  );
}

function WarehouseCapacityCard({ onNotify }) {
  const rows = [['Total Capacity', '25,600 SQ.FT', 'blue'], ['Used Capacity', '17,523 SQ.FT', 'green'], ['Available Capacity', '8,077 SQ.FT', 'amber'], ['Utilization', '68.45%', 'purple']];
  return <article className={`${panelClass} p-5`}><h2 className="font-display text-[15px] font-extrabold text-[#06135a]">Capacity Overview</h2><div className="mt-4 space-y-3">{rows.map(([label, value, tone]) => <button key={label} type="button" onClick={() => onNotify(`${label} opened`)} className="flex w-full items-center gap-3 rounded-[8px] p-1 text-left transition hover:bg-[#f8fbff]"><span className={cx('grid size-7 shrink-0 place-items-center rounded-[8px]', tone === 'green' ? 'bg-[#e8f8eb] text-[#0d9f4a]' : tone === 'amber' ? 'bg-[#fff0dc] text-[#d98200]' : tone === 'purple' ? 'bg-[#f3edff] text-[#7c3aed]' : 'bg-[#e8f2ff] text-[#0b65e5]')}><Boxes className="size-3.5" /></span><span className="min-w-0 flex-1 text-[12px] font-bold text-[#314a79]">{label}</span><span className="text-[12px] font-extrabold text-[#1e3261]">{value}</span></button>)}</div></article>;
}

function WarehouseRecentCard({ onNotify }) {
  const rows = [['Indore Warehouse added', 'by Admin', '20 May 2024', CheckCircle2, 'green'], ['Bhopal Warehouse updated', 'by Admin', '19 May 2024', FileText, 'blue'], ['Sagar Warehouse deactivated', 'by Admin', '18 May 2024', Minus, 'amber']];
  return <article className={`${panelClass} p-5`}><div className="flex items-center justify-between gap-3"><h2 className="font-display text-[15px] font-extrabold text-[#06135a]">Recent Activities</h2><button type="button" onClick={() => onNotify('Warehouse activities opened')} className="text-[12px] font-extrabold text-[#0b65e5]">View All</button></div><div className="mt-4 space-y-4">{rows.map(([title, by, date, Icon, tone]) => <button key={title} type="button" onClick={() => onNotify(title)} className="flex w-full items-center gap-3 rounded-[10px] p-2 text-left transition hover:bg-[#f8fbff]"><span className={cx('grid size-9 shrink-0 place-items-center rounded-[10px]', tone === 'green' ? 'bg-[#e8f8eb] text-[#0d9f4a]' : tone === 'blue' ? 'bg-[#e8f2ff] text-[#0b65e5]' : 'bg-[#fff0dc] text-[#d98200]')}><Icon className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-extrabold text-[#1e3261]">{title}</span><span className="mt-1 block truncate text-[11px] font-bold text-[#53647f]">{by}</span></span><span className="shrink-0 text-[11px] font-bold text-[#314a79]">{date}</span></button>)}</div></article>;
}

function WarehouseModal({ warehouse, onClose, onSave }) {
  const [form, setForm] = useState(warehouse ?? { code: '', name: '', type: 'Branch Warehouse', location: 'Indore, MP', manager: 'Rohit Singh', capacity: 1000, utilization: 0, status: 'Active' });
  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: ['capacity', 'utilization'].includes(field) ? Number(value) || 0 : value }));
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#111827]/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[660px] rounded-[16px] bg-white shadow-[0_30px_70px_rgba(17,24,39,0.28)]">
        <div className="flex items-center justify-between border-b border-[#edf2f8] px-6 py-5"><h2 className="font-display text-[20px] font-extrabold text-[#111827]">{warehouse ? 'Edit Warehouse' : 'Add Warehouse'}</h2><button type="button" onClick={onClose} className="text-[#7585a2]"><X className="size-5" /></button></div>
        <div className="grid gap-4 p-6 sm:grid-cols-2"><ModalTextInput label="Warehouse Code" value={form.code} onChange={(value) => updateField('code', value)} placeholder="Auto if blank" /><ModalTextInput label="Warehouse Name" value={form.name} onChange={(value) => updateField('name', value)} placeholder="Warehouse name" /><ReportSelect label="Type" value={form.type} onChange={(value) => updateField('type', value)} options={['Main Warehouse', 'Branch Warehouse', 'Storage Point']} /><ModalTextInput label="Location" value={form.location} onChange={(value) => updateField('location', value)} placeholder="City, State" /><ModalTextInput label="Manager" value={form.manager} onChange={(value) => updateField('manager', value)} placeholder="Manager" /><ModalTextInput label="Capacity" value={String(form.capacity)} onChange={(value) => updateField('capacity', value)} placeholder="0" /><ModalTextInput label="Utilization %" value={String(form.utilization)} onChange={(value) => updateField('utilization', value)} placeholder="0" /><ReportSelect label="Status" value={form.status} onChange={(value) => updateField('status', value)} options={['Active', 'Inactive']} /></div>
        <div className="flex justify-end gap-3 border-t border-[#edf2f8] px-6 py-5"><button type="button" onClick={onClose} className="h-10 rounded-[8px] border border-[#d9e4f2] bg-white px-6 text-[13px] font-extrabold text-[#233a6b]">Cancel</button><button type="button" onClick={() => onSave({ ...form, name: form.name || 'New Warehouse' })} className="h-10 rounded-[8px] bg-[#0d9f4a] px-6 text-[13px] font-extrabold text-white">Save Warehouse</button></div>
      </div>
    </div>
  );
}

function ProjectManagementPage({ onNotify }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [projectType, setProjectType] = useState('All');
  const [assignedTo, setAssignedTo] = useState('All');
  const [menuOpen, setMenuOpen] = useState(false);
  const [premiumModal, setPremiumModal] = useState(null);

  const filteredProjects = projectManagementRows.filter((project) => {
    const queryText = query.toLowerCase();
    const queryMatch = [project.projectName, project.customer, project.site].some((value) => value.toLowerCase().includes(queryText));
    const statusMatch = status === 'All' || project.status === status;
    const typeMatch = projectType === 'All' || project.type === projectType;
    const assignedMatch = assignedTo === 'All' || project.assignedTo.name === assignedTo;
    return queryMatch && statusMatch && typeMatch && assignedMatch;
  });

  const openPremiumAction = (action) => {
    setMenuOpen(false);
    setPremiumModal(action);
    onNotify(`${action} opened`);
  };

  const resetFilters = () => {
    setQuery('');
    setStatus('All');
    setProjectType('All');
    setAssignedTo('All');
    onNotify('Project filters reset');
  };

  return (
    <div className="space-y-4">
      <PageHeading
        title={(
          <span className="inline-flex flex-wrap items-center gap-2">
            Project Management
            <span className="text-[#8a94a8]">(Disabled)</span>
            <span className="grid size-8 place-items-center rounded-full bg-[#eef2f7] text-[#7a8494]">
              <LockKeyhole className="size-4" />
            </span>
          </span>
        )}
        crumbs={[
          { label: 'Dashboard', onClick: () => onNotify('Dashboard breadcrumb selected') },
          { label: 'Project Management' },
        ]}
        actions={(
          <>
            <button
              type="button"
              onClick={() => openPremiumAction('Add Project')}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#9aa3b2] px-5 text-[13px] font-extrabold text-white shadow-[0_12px_22px_rgba(74,85,104,0.18)] transition hover:-translate-y-0.5 hover:bg-[#80899a]"
            >
              <Plus className="size-4" />
              Add Project
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((current) => !current)}
                aria-label="More project management actions"
                aria-expanded={menuOpen}
                className="inline-flex size-11 items-center justify-center rounded-[8px] border border-[#d9e4f2] bg-white text-[#233a6b] transition hover:bg-[#f8fbff]"
              >
                <MoreVertical className="size-4" />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-[200px] overflow-hidden rounded-[12px] border border-[#dce7f5] bg-white shadow-[0_18px_34px_rgba(21,43,83,0.16)]">
                  {['Export Projects', 'View Project Settings', 'Request Access'].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => openPremiumAction(item)}
                      className="block w-full px-4 py-3 text-left text-[12px] font-extrabold text-[#263d72] transition hover:bg-[#f5f9ff]"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        )}
      />

      <section className="rounded-[14px] border border-[#ffe3bd] bg-[linear-gradient(100deg,#fff8ed_0%,#fffaf3_62%,#fff_100%)] p-4 shadow-[0_12px_28px_rgba(194,112,18,0.07)]">
        <div className="grid gap-5 lg:grid-cols-[92px_minmax(0,1fr)_220px] lg:items-center">
          <span className="mx-auto grid size-[84px] place-items-center rounded-full border border-[#ffd9a6] bg-white text-[#df7600] shadow-[0_10px_24px_rgba(218,116,0,0.16)] lg:mx-0">
            <LockKeyhole className="size-8" />
          </span>
          <div className="text-center lg:text-left">
            <h2 className="font-display text-[17px] font-extrabold text-[#111827]">Project Management is Currently Disabled</h2>
            <p className="mt-2 text-[14px] font-bold leading-6 text-[#44557a]">
              This module is part of our Premium Plan. Contact your administrator or upgrade your plan to access all project management features.
            </p>
          </div>
          <div className="grid gap-3">
            <button type="button" onClick={() => openPremiumAction('Upgrade Plan')} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#d87300] px-4 text-[13px] font-extrabold text-white transition hover:bg-[#c76700]">
              <Trophy className="size-4" />
              Upgrade Plan
            </button>
            <button type="button" onClick={() => openPremiumAction('Contact Administrator')} className="inline-flex h-11 items-center justify-center rounded-[8px] border border-[#cbd6e6] bg-white px-4 text-[13px] font-extrabold text-[#1e3261] transition hover:bg-[#f8fbff]">
              Contact Administrator
            </button>
          </div>
        </div>
      </section>

      <section className={`${panelClass} p-4 sm:p-5`}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.4fr_0.7fr_0.7fr_0.95fr_auto_auto] xl:items-end">
          <label className="flex h-11 items-center gap-3 rounded-[8px] border border-black/20 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
            <Search className="size-4 text-[#7386a3]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects by name, customer, site..."
              className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-[#30466d] outline-none placeholder:text-[#8493ab]"
            />
          </label>
          <ReportSelect label="Status" value={status} onChange={setStatus} options={['All', 'Planning', 'Site Survey', 'Design', 'Installation', 'Procurement', 'Quality Check', 'Completed', 'On Hold']} />
          <ReportSelect label="Project Type" value={projectType} onChange={setProjectType} options={['All', 'On-Grid', 'Hybrid', 'Off-Grid']} />
          <ReportSelect label="Assigned To" value={assignedTo} onChange={setAssignedTo} options={['All', 'Rohit Singh', 'Neha Jain', 'Amit Sharma', 'Vikram Singh', 'Pooja Verma', 'Sunil Patidar']} />
          <button type="button" onClick={() => onNotify(`Project filters applied: ${filteredProjects.length} results`)} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276] transition hover:bg-[#f8fbff]">
            <RefreshCw className="size-4 text-[#0b65e5]" />
            Filters
          </button>
          <button type="button" onClick={resetFilters} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276] transition hover:bg-[#f8fbff]">
            <RefreshCw className="size-4 text-[#7585a2]" />
            Reset
          </button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
        <article className={`${panelClass} overflow-hidden p-3 sm:p-4`}>
          <div className="space-y-3 lg:hidden">
            {filteredProjects.map((project, index) => (
              <ProjectMobileCard key={project.id} project={project} index={index + 1} onLocked={() => openPremiumAction(project.projectName)} />
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-[12px] border border-[#e7eef7] bg-white lg:block">
            <table className="crm-table min-w-[940px] w-full">
              <thead>
                <tr>{['#', 'Project Name', 'Customer / Site', 'Project Type', 'Status', 'Assigned To', 'Target Date', 'Action'].map((header) => <th key={header}>{header}</th>)}</tr>
              </thead>
              <tbody>
                {filteredProjects.map((project, index) => (
                  <tr key={project.id}>
                    <td>{index + 1}</td>
                    <td className="font-extrabold text-[#1e3261]">{project.projectName}</td>
                    <td>
                      <span className="block font-extrabold text-[#1e3261]">{project.customer}</span>
                      <span className="mt-1 block text-[12px] font-bold text-[#53647f]">{project.site}</span>
                    </td>
                    <td><ProjectTypeBadge type={project.type} /></td>
                    <td><ProjectStatusBadge status={project.status} /></td>
                    <td><AssigneeCell assignee={project.assignedTo} compact /></td>
                    <td>
                      <span className="inline-flex items-center gap-2 font-extrabold text-[#314a79]">
                        <CalendarDays className="size-4 text-[#8493ab]" />
                        {project.targetDate}
                      </span>
                    </td>
                    <td>
                      <UserActionButton label={`Open ${project.projectName}`} icon={LockKeyhole} tone="blue" onClick={() => openPremiumAction(project.projectName)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-4 px-3 py-5 text-[13px] font-bold text-[#53647f] sm:flex-row sm:items-center sm:justify-between">
            <p>Showing 1 to {filteredProjects.length} of {projectManagementRows.length} entries</p>
            <div className="flex flex-wrap items-center gap-2">
              <PaginationButton onClick={() => onNotify('Previous projects page selected')}><ChevronLeft className="size-4" /></PaginationButton>
              <PaginationButton active onClick={() => onNotify('Projects page 1 selected')}>1</PaginationButton>
              <PaginationButton onClick={() => onNotify('Next projects page selected')}><ChevronRight className="size-4" /></PaginationButton>
            </div>
          </div>
        </article>

        <ProjectPremiumAside onAction={openPremiumAction} />
      </section>

      <DashboardFooter />

      {premiumModal ? (
        <PremiumLockedModal action={premiumModal} onClose={() => setPremiumModal(null)} onNotify={onNotify} />
      ) : null}
    </div>
  );
}

function ProjectMobileCard({ project, index, onLocked }) {
  return (
    <article className="rounded-[14px] border border-[#e7eef7] bg-white p-4 shadow-[0_10px_22px_rgba(17,39,84,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-extrabold text-[#8a98af]">#{index}</p>
          <p className="mt-1 text-[15px] font-extrabold text-[#1e3261]">{project.projectName}</p>
          <p className="mt-1 text-[12px] font-bold text-[#53647f]">{project.customer} - {project.site}</p>
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>
      <div className="mt-4 grid gap-3 text-[12px] min-[420px]:grid-cols-2">
        <InfoCell label="Project Type" valueNode={<ProjectTypeBadge type={project.type} />} />
        <InfoCell label="Assigned To" valueNode={<AssigneeCell assignee={project.assignedTo} compact />} />
        <InfoCell label="Target Date" value={project.targetDate} />
      </div>
      <button type="button" onClick={onLocked} className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white text-[12px] font-extrabold text-[#0b65e5]">
        <LockKeyhole className="size-4" />
        Open Project
      </button>
    </article>
  );
}

function ProjectPremiumAside({ onAction }) {
  return (
    <aside className={`${panelClass} p-5`}>
      <h2 className="font-display text-[15px] font-extrabold text-[#111827]">About Project Management</h2>
      <span className="mt-6 grid size-12 place-items-center rounded-full bg-[#fff2dc] text-[#f59e0b]">
        <FolderKanban className="size-6" />
      </span>
      <p className="mt-5 text-[13px] font-bold leading-6 text-[#44557a]">Manage your solar projects from start to finish.</p>
      <div className="mt-4 space-y-3">
        {projectManagementFeatures.map((feature) => (
          <p key={feature} className="flex items-start gap-3 text-[12px] font-bold text-[#314a79]">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#17a34a]" />
            {feature}
          </p>
        ))}
      </div>
      <div className="my-6 border-t border-[#edf2f8]" />
      <p className="text-[12px] font-bold text-[#53647f]">This is a Premium feature.</p>
      <button type="button" onClick={() => onAction('Upgrade Plan')} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[8px] bg-[#d87300] px-4 text-[13px] font-extrabold text-white transition hover:bg-[#c76700]">
        <Trophy className="size-4" />
        Upgrade Plan
      </button>
      <button type="button" onClick={() => onAction('Contact Administrator')} className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-[8px] border border-[#cbd6e6] bg-white px-4 text-[13px] font-extrabold text-[#1e3261] transition hover:bg-[#f8fbff]">
        Contact Administrator
      </button>
    </aside>
  );
}

function PremiumLockedModal({ action, onClose, onNotify }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#111827]/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[460px] rounded-[16px] bg-white p-6 shadow-[0_30px_70px_rgba(17,24,39,0.28)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#fff2dc] text-[#d87300]">
              <LockKeyhole className="size-5" />
            </span>
            <div>
              <h2 className="font-display text-[19px] font-extrabold text-[#111827]">{action}</h2>
              <p className="mt-2 text-[13px] font-bold leading-6 text-[#53647f]">Project Management is locked in the current plan. Send an access request or upgrade to continue.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-[#7585a2]" aria-label="Close premium action"><X className="size-5" /></button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => { onNotify(`Access request sent for ${action}`); onClose(); }} className="inline-flex h-10 items-center justify-center rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#1e3261] transition hover:bg-[#f8fbff]">
            Request Access
          </button>
          <button type="button" onClick={() => { onNotify('Upgrade plan request sent'); onClose(); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#d87300] px-4 text-[13px] font-extrabold text-white transition hover:bg-[#c76700]">
            <Trophy className="size-4" />
            Upgrade Plan
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectTypeBadge({ type }) {
  const classes = {
    'On-Grid': 'bg-[#e8f2ff] text-[#0b65e5]',
    Hybrid: 'bg-[#e8f8eb] text-[#0d9f4a]',
    'Off-Grid': 'bg-[#fff0dc] text-[#d98200]',
  }[type] ?? 'bg-[#eef2f7] text-[#53647f]';
  return <span className={cx('inline-flex rounded-[7px] px-2.5 py-1 text-[11px] font-extrabold', classes)}>{type}</span>;
}

function ProjectStatusBadge({ status }) {
  const classes = {
    Planning: 'bg-[#fff0dc] text-[#d98200]',
    'Site Survey': 'bg-[#e8f2ff] text-[#0b65e5]',
    Design: 'bg-[#f3edff] text-[#7c3aed]',
    Installation: 'bg-[#f3edff] text-[#6d4ce8]',
    Procurement: 'bg-[#fff5df] text-[#c77700]',
    'Quality Check': 'bg-[#e8f2ff] text-[#0b65e5]',
    Completed: 'bg-[#e8f8eb] text-[#0d9f4a]',
    'On Hold': 'bg-[#ffe9e6] text-[#ef4444]',
  }[status] ?? 'bg-[#eef2f7] text-[#53647f]';
  return <span className={cx('inline-flex rounded-[7px] px-2.5 py-1 text-[11px] font-extrabold', classes)}>{status}</span>;
}

function UserManagementPage({ onNotify }) {
  const [users, setUsers] = useState(userManagementRows);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('All');
  const [status, setStatus] = useState('All');
  const [branch, setBranch] = useState('All');
  const [selectedUser, setSelectedUser] = useState(null);
  const [addUserOpen, setAddUserOpen] = useState(false);

  const filteredUsers = users.filter((user) => {
    const queryMatch = [user.name, user.email, user.mobile].some((value) => value.toLowerCase().includes(query.toLowerCase()));
    const roleMatch = role === 'All' || user.role === role;
    const statusMatch = status === 'All' || user.status === status;
    const branchMatch = branch === 'All' || user.branch === branch;
    return queryMatch && roleMatch && statusMatch && branchMatch;
  });

  const stats = [
    { ...userManagementStats[0], value: String(users.length) },
    { ...userManagementStats[1], value: String(users.filter((user) => user.status === 'Active').length) },
    { ...userManagementStats[2], value: String(users.filter((user) => user.status === 'Inactive').length) },
    { ...userManagementStats[3], value: String(users.filter((user) => user.role === 'Super Admin').length) },
  ];

  const resetFilters = () => {
    setQuery('');
    setRole('All');
    setStatus('All');
    setBranch('All');
    onNotify('User filters reset');
  };

  const deleteUser = (user) => {
    setUsers((current) => current.filter((item) => item.id !== user.id));
    if (selectedUser?.id === user.id) {
      setSelectedUser(null);
    }
    onNotify(`${user.name} deleted from local list`);
  };

  const updateUser = (updatedUser) => {
    setUsers((current) => current.map((item) => (item.id === updatedUser.id ? updatedUser : item)));
    setSelectedUser(updatedUser);
  };

  if (selectedUser) {
    return (
      <UserDetailsPage
        user={selectedUser}
        onBack={() => {
          setSelectedUser(null);
          onNotify('Users list opened');
        }}
        onUpdateUser={updateUser}
        onNotify={onNotify}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeading
        title="User Management"
        crumbs={[
          { label: 'Dashboard', onClick: () => onNotify('Dashboard breadcrumb selected') },
          { label: 'Settings', onClick: () => onNotify('Settings breadcrumb selected') },
          { label: 'User Management' },
        ]}
        actions={(
          <>
            <button
              type="button"
              onClick={() => setAddUserOpen(true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#0d9f4a] px-4 text-[13px] font-extrabold text-white shadow-[0_12px_22px_rgba(13,159,74,0.22)] transition hover:-translate-y-0.5 hover:bg-[#078c3e]"
            >
              <Plus className="size-4" />
              Add User
            </button>
            <button
              type="button"
              onClick={() => onNotify('User management options opened')}
              aria-label="More user management actions"
              className="inline-flex size-11 items-center justify-center rounded-[8px] border border-[#d9e4f2] bg-white text-[#233a6b] transition hover:bg-[#f8fbff]"
            >
              <MoreVertical className="size-4" />
            </button>
          </>
        )}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <EmployeeStatCard key={stat.label} stat={stat} onClick={() => onNotify(`${stat.label} opened`)} />
        ))}
      </section>

      <section className={`${panelClass} p-4 sm:p-5`}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.45fr_0.85fr_0.85fr_0.95fr_auto_auto] xl:items-end">
          <label className="flex h-11 items-center gap-3 rounded-[8px] border border-black/20 bg-white px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
            <Search className="size-4 text-[#7386a3]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, email or mobile..."
              className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-[#30466d] outline-none placeholder:text-[#8493ab]"
            />
          </label>
          <ReportSelect label="Role" value={role} onChange={setRole} options={['All', 'Super Admin', 'Branch Manager', 'Team Leader', 'Sales Executive']} />
          <ReportSelect label="Status" value={status} onChange={setStatus} options={['All', 'Active', 'Inactive']} />
          <ReportSelect label="Assigned Branch" value={branch} onChange={setBranch} options={['All', 'Head Office', 'Indore Branch', 'Ujjain Branch', 'Dewas Branch']} />
          <button
            type="button"
            onClick={() => onNotify(`User filters applied: ${filteredUsers.length} results`)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276] transition hover:bg-[#f8fbff]"
          >
            <RefreshCw className="size-4 text-[#0b65e5]" />
            Filters
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276] transition hover:bg-[#f8fbff]"
          >
            <RefreshCw className="size-4 text-[#7585a2]" />
            Reset
          </button>
        </div>
      </section>

      <section className={`${panelClass} overflow-hidden p-3 sm:p-4`}>
        <div className="space-y-3 lg:hidden">
          {filteredUsers.map((user) => (
            <UserMobileCard key={user.id} user={user} onView={() => setSelectedUser(user)} onDelete={() => deleteUser(user)} onNotify={onNotify} />
          ))}
        </div>

        <div className="hidden overflow-x-auto rounded-[12px] border border-[#e7eef7] bg-white lg:block">
          <table className="crm-table min-w-[1180px] w-full">
            <thead>
              <tr>{['#', 'User Name', 'Email', 'Mobile Number', 'Role', 'Assigned Branch', 'Status', 'Created On', 'Action'].map((header) => <th key={header}>{header}</th>)}</tr>
            </thead>
            <tbody>
              {filteredUsers.map((user, index) => (
                <tr key={user.id}>
                  <td>{index + 1}</td>
                  <td><AssigneeCell assignee={user.assignee} compact /></td>
                  <td>{user.email}</td>
                  <td>{user.mobile}</td>
                  <td><EmployeeRoleBadge role={user.role} /></td>
                  <td>{user.branch}</td>
                  <td><EmployeeStatusBadge status={user.status} /></td>
                  <td>{user.createdOn}</td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      <UserActionButton label={`View ${user.name}`} icon={Eye} tone="blue" onClick={() => setSelectedUser(user)} />
                      <UserActionButton label={`Edit ${user.name}`} icon={FileText} tone="blue" onClick={() => { setSelectedUser(user); onNotify(`${user.name} edit panel opened`); }} />
                      <UserActionButton label={`Delete ${user.name}`} icon={XCircle} tone="red" onClick={() => deleteUser(user)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 px-3 py-5 text-[13px] font-bold text-[#53647f] sm:flex-row sm:items-center sm:justify-between">
          <p>Showing 1 to {filteredUsers.length} of {users.length} entries</p>
          <div className="flex flex-wrap items-center gap-2">
            <PaginationButton onClick={() => onNotify('Previous users page selected')}><ChevronLeft className="size-4" /></PaginationButton>
            <PaginationButton active onClick={() => onNotify('Users page 1 selected')}>1</PaginationButton>
            <PaginationButton onClick={() => onNotify('Users page 2 selected')}>2</PaginationButton>
            <PaginationButton onClick={() => onNotify('Users page 3 selected')}>3</PaginationButton>
            <PaginationButton onClick={() => onNotify('Next users page selected')}><ChevronRight className="size-4" /></PaginationButton>
          </div>
        </div>
      </section>

      <DashboardFooter />

      {addUserOpen ? (
        <AddUserModal
          onClose={() => setAddUserOpen(false)}
          onSave={(newUser) => {
            setUsers((current) => [newUser, ...current]);
            setAddUserOpen(false);
            onNotify(`${newUser.name} added`);
          }}
        />
      ) : null}
    </div>
  );
}

function UserDetailsPage({ user, onBack, onUpdateUser, onNotify }) {
  const [activeTab, setActiveTab] = useState('Roles & Permissions');
  const [detailsMenuOpen, setDetailsMenuOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState(user);

  useEffect(() => {
    setDraft(user);
  }, [user]);

  const saveDraft = () => {
    const updatedUser = {
      ...draft,
      assignee: {
        ...draft.assignee,
        name: draft.name,
        initials: draft.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || draft.assignee.initials,
      },
    };
    onUpdateUser(updatedUser);
    setEditMode(false);
    onNotify(`${updatedUser.name} updated`);
  };

  const toggleStatus = () => {
    const updatedUser = { ...user, status: user.status === 'Active' ? 'Inactive' : 'Active' };
    onUpdateUser(updatedUser);
    onNotify(`${updatedUser.name} marked ${updatedUser.status}`);
  };

  const detailItems = [
    ['Employee ID', `EMP00${String(user.id).padStart(2, '0')}`],
    ['Role', <EmployeeRoleBadge role={user.role} />],
    ['Date of Joining', user.id === 1 ? '10 Jan 2024' : user.createdOn],
    ['Assigned Branch', user.branch],
    ['Reporting Manager', 'Amit Sharma'],
    ['Status', <EmployeeStatusBadge status={user.status} />],
    ['Created By', 'Admin User'],
    ['Last Login', '20 May 2024, 10:15 AM'],
    ['Created On', '10 Jan 2024, 09:30 AM'],
    ['Last Updated', '20 May 2024, 10:20 AM by Admin User'],
  ];

  return (
    <div className="space-y-4">
      <PageHeading
        title="User Details"
        crumbs={[
          { label: 'Dashboard', onClick: () => onNotify('Dashboard breadcrumb selected') },
          { label: 'Employee Management', onClick: () => onNotify('Employee Management breadcrumb selected') },
          { label: 'Users', onClick: onBack },
          { label: user.name },
        ]}
        actions={(
          <>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#1e3261] transition hover:bg-[#f8fbff]"
            >
              <ChevronLeft className="size-4" />
              Back to Users
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setDetailsMenuOpen((current) => !current)}
                aria-label="More user detail actions"
                aria-expanded={detailsMenuOpen}
                className="inline-flex size-10 items-center justify-center rounded-[8px] border border-[#d9e4f2] bg-white text-[#233a6b] transition hover:bg-[#f8fbff]"
              >
                <MoreVertical className="size-4" />
              </button>
              {detailsMenuOpen ? (
                <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-[190px] overflow-hidden rounded-[12px] border border-[#dce7f5] bg-white shadow-[0_18px_34px_rgba(21,43,83,0.16)]">
                  {['Export user profile', 'Copy employee ID', 'Open audit trail'].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setDetailsMenuOpen(false);
                        onNotify(item);
                      }}
                      className="block w-full px-4 py-3 text-left text-[12px] font-extrabold text-[#263d72] transition hover:bg-[#f5f9ff]"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        )}
      />

      <section className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <article className={`${panelClass} p-4 sm:p-5`}>
          <div className="grid gap-5 sm:grid-cols-[92px_minmax(0,1fr)] sm:items-start">
            <UserPortrait name={user.name} tone={user.assignee.tone} />
            <div className="min-w-0">
              {editMode ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <ModalTextInput label="Name" value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} placeholder="User name" />
                  <ReportSelect label="Role" value={draft.role} onChange={(value) => setDraft((current) => ({ ...current, role: value }))} options={['Sales Executive', 'Team Leader', 'Branch Manager', 'Super Admin']} />
                  <ModalTextInput label="Email" value={draft.email} onChange={(value) => setDraft((current) => ({ ...current, email: value }))} placeholder="Email" />
                  <ReportSelect label="Branch" value={draft.branch} onChange={(value) => setDraft((current) => ({ ...current, branch: value }))} options={['Head Office', 'Indore Branch', 'Ujjain Branch', 'Dewas Branch']} />
                  <ModalTextInput label="Mobile" value={draft.mobile} onChange={(value) => setDraft((current) => ({ ...current, mobile: value }))} placeholder="Mobile" />
                  <ReportSelect label="Status" value={draft.status} onChange={(value) => setDraft((current) => ({ ...current, status: value }))} options={['Active', 'Inactive']} />
                </div>
              ) : (
                <>
                  <h2 className="font-display text-[19px] font-extrabold leading-tight text-[#111827]">{user.name}</h2>
                  <p className="mt-1 text-[14px] font-extrabold text-[#005eff]">{user.role}</p>
                  <p className="mt-3"><EmployeeStatusBadge status={user.status} /></p>
                  <div className="mt-5 space-y-3 text-[13px] font-bold text-[#314a79]">
                    <ContactLine icon={Mail} text={user.email} />
                    <ContactLine icon={Phone} text={user.mobile} />
                    <ContactLine icon={MapPin} text={user.branch} />
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {editMode ? (
              <>
                <button type="button" onClick={saveDraft} className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#078c3e] px-4 text-[12px] font-extrabold text-white transition hover:bg-[#067832]"><Save className="size-4" />Save</button>
                <button type="button" onClick={() => { setDraft(user); setEditMode(false); onNotify('Edit cancelled'); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[12px] font-extrabold text-[#284276] transition hover:bg-[#f8fbff]"><X className="size-4" />Cancel</button>
              </>
            ) : (
              <button type="button" onClick={() => { setEditMode(true); onNotify(`${user.name} edit mode opened`); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#078c3e] px-4 text-[12px] font-extrabold text-white transition hover:bg-[#067832]"><FileText className="size-4" />Edit User</button>
            )}
            <button type="button" onClick={() => onNotify(`Password reset link sent to ${user.email}`)} className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[12px] font-extrabold text-[#1e3261] transition hover:bg-[#f8fbff]"><LockKeyhole className="size-4 text-[#5944e8]" />Reset Password</button>
            <button type="button" onClick={toggleStatus} className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#ffd5d5] bg-white px-4 text-[12px] font-extrabold text-[#ef4444] transition hover:bg-[#fff8f8]"><RefreshCw className="size-4" />{user.status === 'Active' ? 'Deactivate User' : 'Activate User'}</button>
          </div>
        </article>

        <article className={`${panelClass} p-4 sm:p-5`}>
          <h2 className="font-display text-[15px] font-extrabold text-[#06135a]">User Information</h2>
          <div className="mt-4 grid gap-x-8 gap-y-1 md:grid-cols-2">
            {detailItems.map(([label, value]) => (
              <DetailRow key={label} label={label} valueNode={value} />
            ))}
          </div>
        </article>
      </section>

      <section className={`${panelClass} overflow-hidden`}>
        <div className="scroll-soft flex gap-6 overflow-x-auto border-b border-[#e5edf6] px-4 sm:px-6">
          {['Roles & Permissions', 'Activity Summary', 'Login History', 'Assigned Projects', 'Assigned Leads'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
                onNotify(`${tab} tab opened`);
              }}
              className={cx(
                'shrink-0 border-b-2 py-4 text-[13px] font-extrabold transition',
                activeTab === tab ? 'border-[#0d9f4a] text-[#087a39]' : 'border-transparent text-[#53647f] hover:text-[#0b65e5]',
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="p-4 sm:p-5">
          {activeTab === 'Roles & Permissions' ? (
            <div className="grid gap-4 xl:grid-cols-[270px_minmax(0,1fr)_340px]">
              <UserRoleCard user={user} onNotify={onNotify} />
              <UserModulePermissions onNotify={onNotify} />
              <UserActivitySummaryCards onNotify={onNotify} />
            </div>
          ) : activeTab === 'Activity Summary' ? (
            <UserActivitySummaryCards onNotify={onNotify} expanded />
          ) : activeTab === 'Login History' ? (
            <UserLoginHistory onNotify={onNotify} />
          ) : activeTab === 'Assigned Projects' ? (
            <UserAssignedProjects onNotify={onNotify} />
          ) : (
            <UserAssignedLeads onNotify={onNotify} />
          )}
        </div>
      </section>

      <DashboardFooter />
    </div>
  );
}

function ContactLine({ icon: Icon, text }) {
  return (
    <p className="flex min-w-0 items-center gap-3">
      <Icon className="size-4 shrink-0 text-[#2d67e1]" />
      <span className="truncate">{text}</span>
    </p>
  );
}

function UserPortrait({ name }) {
  return (
    <div className="relative mx-auto grid size-[86px] place-items-center overflow-hidden rounded-full bg-[#eef5ff] sm:mx-0">
      <svg viewBox="0 0 88 88" className="size-full" aria-label={name}>
        <rect width="88" height="88" rx="44" fill="#eef5ff" />
        <path d="M19 88c2.7-14.7 11.2-22.2 25-22.2S66.3 73.3 69 88" fill="#126fd0" />
        <circle cx="44" cy="37" r="17" fill="#f0b879" />
        <path d="M26 36c0-16 9-25 20-25 10.5 0 19 8.4 19 23.8-3.3-1.7-6-5-8.4-9.4-4.6 5.3-12.5 8-24.2 8.4-2 0-4.1.6-6.4 2.2z" fill="#111" />
        <path d="M29 47c1.8 8.8 7 13.2 15.2 13.2S58 55.8 60 47" fill="#111" />
        <circle cx="37.5" cy="38.5" r="1.5" fill="#1b1714" />
        <circle cx="50.5" cy="38.5" r="1.5" fill="#1b1714" />
        <path d="M39 48.5c3 1.7 6.4 1.7 10 0" stroke="#b6624d" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      <span className="absolute bottom-1 right-1 size-4 rounded-full border-2 border-white bg-[#0d9f4a]" />
    </div>
  );
}

function UserRoleCard({ user, onNotify }) {
  return (
    <article className="rounded-[12px] border border-[#e7eef7] bg-white p-4">
      <h3 className="font-display text-[15px] font-extrabold text-[#06135a]">Roles & Permissions</h3>
      <div className="mt-4 rounded-[12px] border border-[#edf2f8] bg-[#fbfcff] p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-[#f0e8ff] text-[#7c3aed]"><UsersRound className="size-6" /></span>
          <div>
            <p className="text-[14px] font-extrabold text-[#06135a]">{user.role}</p>
            <p className="mt-1 text-[12px] font-bold text-[#53647f]">Custom Role</p>
          </div>
        </div>
        <div className="my-4 border-t border-[#edf2f8]" />
        <p className="text-[12px] font-extrabold text-[#53647f]">Role Description</p>
        <p className="mt-2 text-[13px] font-bold leading-6 text-[#314a79]">Can manage leads, follow-ups and view projects within assigned branch.</p>
        <div className="my-4 border-t border-[#edf2f8]" />
        <p className="text-[12px] font-extrabold text-[#53647f]">Assigned On</p>
        <p className="mt-1 text-[13px] font-bold text-[#06135a]">10 Jan 2024, 09:30 AM</p>
        <p className="mt-4 text-[12px] font-extrabold text-[#53647f]">Assigned By</p>
        <p className="mt-1 text-[13px] font-bold text-[#06135a]">Admin User</p>
      </div>
      <button type="button" onClick={() => onNotify(`${user.role} role details opened`)} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white text-[12px] font-extrabold text-[#0b65e5] transition hover:bg-[#f8fbff]">
        View Role
        <ArrowRight className="size-4" />
      </button>
    </article>
  );
}

function UserModulePermissions({ onNotify }) {
  return (
    <article className="rounded-[12px] border border-[#e7eef7] bg-white p-4">
      <h3 className="font-display text-[15px] font-extrabold text-[#06135a]">Module Permissions</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="crm-table min-w-[560px] w-full">
          <thead><tr>{['Module', 'Permissions', 'Access Level'].map((header) => <th key={header}>{header}</th>)}</tr></thead>
          <tbody>
            {userDetailPermissions.map((item) => {
              const Icon = item.icon;
              return (
                <tr key={item.module}>
                  <td><span className="inline-flex items-center gap-2 font-extrabold text-[#06135a]"><Icon className="size-4 text-[#67789b]" />{item.module}</span></td>
                  <td>{item.permissions}</td>
                  <td><AccessBadge access={item.access} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => onNotify('All permissions view opened')} className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-3 text-[12px] font-extrabold text-[#1e3261] transition hover:bg-[#f8fbff]">
        <Eye className="size-4" />
        View All Permissions
      </button>
    </article>
  );
}

function UserActivitySummaryCards({ onNotify, expanded = false }) {
  return (
    <article className={cx(!expanded && 'rounded-[12px] border border-[#e7eef7] bg-white p-4')}>
      <h3 className="font-display text-[15px] font-extrabold text-[#06135a]">Activity Summary</h3>
      <div className={cx('mt-3 grid gap-3', expanded ? 'sm:grid-cols-2 xl:grid-cols-4' : '')}>
        {userDetailActivitySummary.map((item) => (
          <ActivitySummaryCard key={item.label} item={item} onClick={() => onNotify(`${item.label} opened`)} />
        ))}
      </div>
    </article>
  );
}

function ActivitySummaryCard({ item, onClick }) {
  const Icon = item.icon;
  const toneClass = {
    green: 'border-[#d8efdf] bg-[#f3fff6] text-[#0d9f4a]',
    blue: 'border-[#d9e9ff] bg-[#f5f9ff] text-[#0b65e5]',
    amber: 'border-[#f8e1b4] bg-[#fff8eb] text-[#d98200]',
    purple: 'border-[#e5ddff] bg-[#fbf8ff] text-[#7c3aed]',
  }[item.tone];

  return (
    <button type="button" onClick={onClick} className={cx('group flex min-h-[84px] items-center gap-4 rounded-[8px] border p-4 text-left transition hover:-translate-y-0.5', toneClass)}>
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/70"><Icon className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-extrabold">{item.label}</span>
        <span className="mt-1 block font-display text-[22px] font-extrabold text-[#111827]">{item.value}</span>
        <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[#53647f]">{item.detail}<ChevronRight className="size-3" /></span>
      </span>
      <ArrowRight className="size-4 opacity-70 transition group-hover:translate-x-0.5" />
    </button>
  );
}

function UserLoginHistory({ onNotify }) {
  return (
    <div className="overflow-x-auto rounded-[12px] border border-[#e7eef7] bg-white">
      <table className="crm-table min-w-[720px] w-full">
        <thead><tr>{['Date & Time', 'Device', 'IP Address', 'Status', 'Action'].map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>
          {userDetailLoginHistory.map((item) => (
            <tr key={`${item.time}-${item.ip}`}>
              <td className="font-extrabold text-[#06135a]">{item.time}</td>
              <td>{item.device}</td>
              <td>{item.ip}</td>
              <td><EmployeeStatusBadge status={item.status === 'Success' ? 'Active' : 'Inactive'} /></td>
              <td><UserActionButton label={`Open login ${item.time}`} icon={Eye} tone="blue" onClick={() => onNotify(`Login entry opened: ${item.time}`)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserAssignedProjects({ onNotify }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {userDetailProjects.map((project) => (
        <button key={project.name} type="button" onClick={() => onNotify(`${project.name} opened`)} className="rounded-[12px] border border-[#e7eef7] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:bg-[#f8fbff]">
          <p className="text-[14px] font-extrabold text-[#06135a]">{project.name}</p>
          <p className="mt-2 text-[12px] font-bold text-[#53647f]">{project.stage}</p>
          <p className="mt-4 font-display text-[20px] font-extrabold text-[#0d9f4a]">{project.value}</p>
        </button>
      ))}
    </div>
  );
}

function UserAssignedLeads({ onNotify }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {userDetailLeads.map((lead) => (
        <button key={lead.name} type="button" onClick={() => onNotify(`${lead.name} lead opened`)} className="rounded-[12px] border border-[#e7eef7] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:bg-[#f8fbff]">
          <p className="text-[14px] font-extrabold text-[#06135a]">{lead.name}</p>
          <p className="mt-2 text-[12px] font-bold text-[#53647f]">{lead.project}</p>
          <p className="mt-4"><StatusBadge status={lead.status} /></p>
        </button>
      ))}
    </div>
  );
}

function AccessBadge({ access }) {
  const classes = access === 'Full Access' ? 'bg-[#e8f8eb] text-[#0d9f4a]' : 'bg-[#e8f2ff] text-[#0b65e5]';
  return <span className={cx('inline-flex rounded-[7px] px-2.5 py-1 text-[11px] font-extrabold', classes)}>{access}</span>;
}

function RolesPermissionsPage({ onNotify }) {
  const [roles, setRoles] = useState(roleCards);
  const [selectedRole, setSelectedRole] = useState(roleCards[2]);
  const [activeTab, setActiveTab] = useState('Permissions');
  const [permissionLevel, setPermissionLevel] = useState('Page-Level Access');
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [permissions, setPermissions] = useState(() => createDefaultPermissions());

  const selectedRoleUsers = userManagementRows.filter((user) => user.role === selectedRole.name);

  const togglePermission = (module, action) => {
    setPermissions((current) => ({
      ...current,
      [module]: {
        ...current[module],
        [action]: !current[module]?.[action],
      },
    }));
  };

  const resetPermissions = () => {
    setPermissions(createDefaultPermissions());
    onNotify('Permissions reset to default');
  };

  return (
    <div className="space-y-4">
      <PageHeading
        title="Roles & Permissions"
        crumbs={[
          { label: 'Dashboard', onClick: () => onNotify('Dashboard breadcrumb selected') },
          { label: 'Settings', onClick: () => onNotify('Settings breadcrumb selected') },
          { label: 'Roles & Permissions' },
        ]}
      />

      <section className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <article className={`${panelClass} flex min-h-[620px] flex-col overflow-hidden p-4`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-[16px] font-extrabold text-[#1e3261]">Roles List</h2>
            <button
              type="button"
              onClick={() => setAddRoleOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-3 text-[12px] font-extrabold text-[#284276] transition hover:bg-[#f8fbff]"
            >
              <Plus className="size-4" />
              Add Role
            </button>
          </div>
          <div className="space-y-2">
            {roles.map((roleItem, index) => {
              const RoleIcon = roleItem.icon;
              const active = selectedRole.name === roleItem.name;
              return (
                <button
                  key={roleItem.name}
                  type="button"
                  onClick={() => {
                    setSelectedRole(roleItem);
                    onNotify(`${roleItem.name} role selected`);
                  }}
                  className={cx(
                    'flex w-full items-center gap-3 rounded-[10px] border px-3 py-3 text-left transition',
                    active ? 'border-[#cbeed7] bg-[#effbf3]' : 'border-transparent bg-white hover:border-[#e7eef7] hover:bg-[#f8fbff]',
                  )}
                >
                  <span className={cx('grid size-10 place-items-center rounded-full', getRoleToneClass(roleItem.tone))}>
                    <RoleIcon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-extrabold text-[#1e3261]">{roleItem.name}</span>
                    <span className="mt-1 block text-[11px] font-bold text-[#6f7f98]">{roleItem.type}</span>
                  </span>
                  <span className="rounded-[7px] border border-[#d9e4f2] bg-white px-2 py-1 text-[11px] font-extrabold text-[#53647f]">{index === 4 ? 18 : roleItem.users}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-auto border-t border-[#edf2f8] pt-4 text-[13px] font-bold text-[#53647f]">Total Roles: {roles.length}</div>
        </article>

        <article className={`${panelClass} overflow-hidden p-4 sm:p-5`}>
          <h2 className="font-display text-[16px] font-extrabold text-[#1e3261]">Role Details</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
            <LeadInput label="Role Name" required placeholder={selectedRole.name} />
            <LeadInput label="Role Description" placeholder={`Can manage ${selectedRole.name.toLowerCase()} access and assigned work.`} />
          </div>

          <div className="mt-6 flex flex-col gap-3 border-b border-[#edf2f8] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-6 text-[13px] font-extrabold">
              {['Permissions', `Users with this Role (${selectedRoleUsers.length || selectedRole.users})`].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab.startsWith('Users') ? 'Users' : 'Permissions')}
                  className={cx('pb-3', (tab.startsWith(activeTab) || (activeTab === 'Users' && tab.startsWith('Users'))) ? 'border-b-2 border-[#0d9f4a] text-[#0d9f4a]' : 'text-[#53647f]')}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row">
              <ReportSelect label="Permission Level" value={permissionLevel} onChange={setPermissionLevel} options={['Page-Level Access', 'Module-Level Access', 'Read Only']} hideLabel className="sm:w-[170px]" />
              <button type="button" onClick={resetPermissions} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276] transition hover:bg-[#f8fbff]">
                <RefreshCw className="size-4" />
                Reset to Default
              </button>
            </div>
          </div>

          {activeTab === 'Permissions' ? (
            <div className="mt-4">
              <h3 className="mb-3 text-[14px] font-extrabold text-[#1e3261]">Module Permissions</h3>
              <div className="overflow-x-auto rounded-[12px] border border-[#e7eef7] bg-white">
                <table className="crm-table min-w-[780px] w-full">
                  <thead><tr>{['Module', 'View', 'Add', 'Edit', 'Delete', 'Export'].map((header) => <th key={header}>{header}</th>)}</tr></thead>
                  <tbody>
                    {permissionModules.map((module, index) => (
                      <tr key={module}>
                        <td className="font-extrabold text-[#1e3261]">{module}</td>
                        {['View', 'Add', 'Edit', 'Delete', 'Export'].map((action) => (
                          <td key={`${module}-${action}`}>
                            {index === 0 && action !== 'View' ? (
                              <span className="text-[#9aa8bc]">-</span>
                            ) : (
                              <input
                                type="checkbox"
                                checked={Boolean(permissions[module]?.[action])}
                                onChange={() => togglePermission(module, action)}
                                className="size-4 rounded border-[#b9c4d6] accent-[#0d9f4a]"
                                aria-label={`${module} ${action}`}
                              />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={() => onNotify(`${selectedRole.name} permissions saved`)} className="mt-5 h-11 rounded-[8px] bg-[#0d9f4a] px-5 text-[13px] font-extrabold text-white shadow-[0_12px_22px_rgba(13,159,74,0.22)] transition hover:bg-[#078c3e]">
                Save Permissions
              </button>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(selectedRoleUsers.length ? selectedRoleUsers : userManagementRows.slice(0, 3)).map((user) => (
                <article key={user.id} className="rounded-[12px] border border-[#e7eef7] bg-white p-4">
                  <AssigneeCell assignee={user.assignee} />
                  <p className="mt-2 text-[12px] font-bold text-[#6f7f98]">{user.email}</p>
                  <p className="mt-3"><EmployeeStatusBadge status={user.status} /></p>
                </article>
              ))}
            </div>
          )}
        </article>
      </section>

      <DashboardFooter />

      {addRoleOpen ? (
        <AddRoleModal
          onClose={() => setAddRoleOpen(false)}
          onSave={(roleName) => {
            const newRole = { name: roleName, type: 'Custom Role', users: 0, icon: ShieldCheck, tone: 'blue' };
            setRoles((current) => [...current, newRole]);
            setSelectedRole(newRole);
            setAddRoleOpen(false);
            onNotify(`${roleName} role added`);
          }}
        />
      ) : null}
    </div>
  );
}

function ActivityLogsPage({ onNotify }) {
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState('2024-05-01');
  const [dateTo, setDateTo] = useState('2024-05-20');
  const [user, setUser] = useState('All Users');
  const [moduleName, setModuleName] = useState('All Modules');
  const [action, setAction] = useState('All Actions');

  const filteredLogs = activityLogRows.filter((log) => {
    const userMatch = user === 'All Users' || log.user.name === user;
    const moduleMatch = moduleName === 'All Modules' || log.module === moduleName;
    const actionMatch = action === 'All Actions' || log.action === action;
    return userMatch && moduleMatch && actionMatch;
  });

  const resetLogs = () => {
    setUser('All Users');
    setModuleName('All Modules');
    setAction('All Actions');
    setDateFrom('2024-05-01');
    setDateTo('2024-05-20');
    onNotify('Activity log filters reset');
  };

  return (
    <div className="space-y-4">
      <PageHeading
        title="Activity Logs"
        crumbs={[
          { label: 'Dashboard', onClick: () => onNotify('Dashboard breadcrumb selected') },
          { label: 'Settings', onClick: () => onNotify('Settings breadcrumb selected') },
          { label: 'Activity Logs' },
        ]}
        actions={(
          <button type="button" onClick={() => onNotify('Activity logs exported')} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276] transition hover:bg-[#f8fbff]">
            <Download className="size-4 text-[#0b65e5]" />
            Export Logs
          </button>
        )}
      />

      <section className={`${panelClass} relative z-40 p-4 sm:p-5`}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.2fr_0.95fr_1fr_1fr_auto_auto] xl:items-end">
          <ReportDateRangePicker open={dateRangeOpen} onToggle={() => setDateRangeOpen((value) => !value)} onClose={() => setDateRangeOpen(false)} dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo} formattedRange={`${formatReportDate(dateFrom)} - ${formatReportDate(dateTo)}`} />
          <ReportSelect label="User" value={user} onChange={setUser} options={['All Users', ...userManagementRows.slice(0, 6).map((item) => item.name)]} />
          <ReportSelect label="Module" value={moduleName} onChange={setModuleName} options={['All Modules', 'Leads', 'Follow-ups', 'IVRS Management', 'Approvals', 'Users', 'Roles & Permissions', 'Settings']} />
          <ReportSelect label="Action" value={action} onChange={setAction} options={['All Actions', 'Created', 'Updated', 'Requested', 'Approved', 'Edited', 'Deleted']} />
          <button type="button" onClick={() => onNotify(`Activity filters applied: ${filteredLogs.length} entries`)} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276] transition hover:bg-[#f8fbff]"><RefreshCw className="size-4 text-[#0b65e5]" />Filters</button>
          <button type="button" onClick={resetLogs} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276] transition hover:bg-[#f8fbff]"><RefreshCw className="size-4 text-[#7585a2]" />Reset</button>
        </div>
      </section>

      <section className={`${panelClass} overflow-hidden p-3 sm:p-4`}>
        <div className="space-y-3 lg:hidden">
          {filteredLogs.map((log) => (
            <article key={log.id} className="rounded-[14px] border border-[#e7eef7] bg-white p-4 shadow-[0_10px_22px_rgba(17,39,84,0.05)]">
              <div className="flex items-start justify-between gap-3">
                <AssigneeCell assignee={log.user.assignee} compact />
                <ActivityActionBadge action={log.action} />
              </div>
              <p className="mt-3 text-[12px] font-bold text-[#53647f]">{log.time}</p>
              <div className="mt-3"><ModuleBadge module={log.module} /></div>
              <p className="mt-3 text-[13px] font-semibold leading-6 text-[#314a79]">{log.details}</p>
              <p className="mt-3 text-[12px] font-bold text-[#6f7f98]">IP: {log.ip}</p>
            </article>
          ))}
        </div>

        <div className="hidden overflow-x-auto rounded-[12px] border border-[#e7eef7] bg-white lg:block">
          <table className="crm-table min-w-[1180px] w-full">
            <thead><tr>{['#', 'Date & Time', 'User', 'Module', 'Action', 'Details', 'IP Address'].map((header) => <th key={header}>{header}</th>)}</tr></thead>
            <tbody>
              {filteredLogs.map((log, index) => (
                <tr key={log.id} onClick={() => onNotify(`Activity log #${log.id} opened`)} className="cursor-pointer">
                  <td>{index + 1}</td>
                  <td className="font-extrabold text-[#1e3261]">{log.time}</td>
                  <td><AssigneeCell assignee={log.user.assignee} compact /></td>
                  <td><ModuleBadge module={log.module} /></td>
                  <td><ActivityActionBadge action={log.action} /></td>
                  <td className="max-w-[360px] whitespace-normal leading-5">{log.details}</td>
                  <td>{log.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 px-3 py-5 text-[13px] font-bold text-[#53647f] sm:flex-row sm:items-center sm:justify-between">
          <p>Showing 1 to {filteredLogs.length} of {activityLogRows.length} entries</p>
          <div className="flex flex-wrap items-center gap-2">
            <PaginationButton onClick={() => onNotify('Previous activity page selected')}><ChevronLeft className="size-4" /></PaginationButton>
            <PaginationButton active onClick={() => onNotify('Activity page 1 selected')}>1</PaginationButton>
            <PaginationButton onClick={() => onNotify('Activity page 2 selected')}>2</PaginationButton>
            <PaginationButton onClick={() => onNotify('Activity page 3 selected')}>3</PaginationButton>
            <span className="px-2 text-[#53647f]">...</span>
            <PaginationButton onClick={() => onNotify('Activity page 13 selected')}>13</PaginationButton>
            <PaginationButton onClick={() => onNotify('Next activity page selected')}><ChevronRight className="size-4" /></PaginationButton>
          </div>
        </div>
      </section>

      <DashboardFooter />
    </div>
  );
}

function EmployeeStatCard({ stat, onClick }) {
  const Icon = stat.icon;
  const toneClass = {
    primary: 'bg-[#e8f2ff] text-[#0b65e5]',
    success: 'bg-[#e8f8eb] text-[#0d9f4a]',
    warning: 'bg-[#fff0dc] text-[#f59e0b]',
    purple: 'bg-[#f3edff] text-[#8b5cf6]',
  }[stat.tone] ?? 'bg-[#e8f2ff] text-[#0b65e5]';

  return (
    <button type="button" onClick={onClick} className={`${panelClass} flex min-h-[96px] items-center gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(24,48,87,0.1)]`}>
      <span className={cx('grid size-12 shrink-0 place-items-center rounded-full', toneClass)}>
        <Icon className="size-6" />
      </span>
      <span>
        <span className="block text-[13px] font-bold text-[#53647f]">{stat.label}</span>
        <span className="mt-1 block font-display text-[25px] font-extrabold text-[#111827]">{stat.value}</span>
      </span>
    </button>
  );
}

function UserMobileCard({ user, onView, onDelete, onNotify }) {
  return (
    <article className="rounded-[14px] border border-[#e7eef7] bg-white p-4 shadow-[0_10px_22px_rgba(17,39,84,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <AssigneeCell assignee={user.assignee} />
        <EmployeeStatusBadge status={user.status} />
      </div>
      <div className="mt-4 grid gap-3 text-[12px] min-[420px]:grid-cols-2">
        <InfoCell label="Email" value={user.email} />
        <InfoCell label="Mobile" value={user.mobile} />
        <InfoCell label="Role" valueNode={<EmployeeRoleBadge role={user.role} />} />
        <InfoCell label="Branch" value={user.branch} />
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onView} className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white text-[12px] font-extrabold text-[#0b65e5]">
          <Eye className="size-4" />
          View
        </button>
        <button type="button" onClick={() => onNotify(`${user.name} edit panel opened`)} className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white text-[12px] font-extrabold text-[#0b65e5]">
          <FileText className="size-4" />
          Edit
        </button>
        <button type="button" onClick={onDelete} className="inline-flex h-9 items-center justify-center rounded-[8px] border border-[#ffd5d5] bg-[#fff8f8] px-3 text-[#ef4444]">
          <XCircle className="size-4" />
        </button>
      </div>
    </article>
  );
}

function UserActionButton({ label, icon: Icon, tone, onClick }) {
  const toneClass = tone === 'red' ? 'border-[#ffd5d5] bg-[#fff8f8] text-[#ef4444]' : 'border-[#d9e4f2] bg-white text-[#0b65e5]';
  return (
    <button type="button" onClick={onClick} aria-label={label} className={cx('inline-flex size-8 items-center justify-center rounded-[8px] transition hover:-translate-y-0.5', toneClass)}>
      <Icon className="size-4" />
    </button>
  );
}

function AddUserModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    mobile: '',
    role: 'Sales Executive',
    branch: 'Indore Branch',
    status: 'Active',
  });

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const saveUser = () => {
    const name = form.name.trim() || 'New User';
    const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'NU';
    onSave({
      id: Date.now(),
      name,
      email: form.email.trim() || `${name.toLowerCase().replace(/\s+/g, '.')}@malwasolar.com`,
      mobile: form.mobile.trim() || '9000000000',
      role: form.role,
      branch: form.branch,
      status: form.status,
      createdOn: 'Today',
      assignee: { name, initials, tone: 'emerald' },
    });
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#111827]/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[640px] rounded-[16px] bg-white shadow-[0_30px_70px_rgba(17,24,39,0.28)]">
        <div className="flex items-center justify-between border-b border-[#edf2f8] px-6 py-5">
          <h2 className="flex items-center gap-3 font-display text-[20px] font-extrabold text-[#111827]"><UserPlus className="size-5 text-[#0d9f4a]" /> Add User</h2>
          <button type="button" onClick={onClose} className="text-[#7585a2]"><X className="size-5" /></button>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <ModalTextInput label="User Name" value={form.name} onChange={(value) => updateField('name', value)} placeholder="Enter user name" />
          <ModalTextInput label="Email" value={form.email} onChange={(value) => updateField('email', value)} placeholder="Enter email address" />
          <ModalTextInput label="Mobile Number" value={form.mobile} onChange={(value) => updateField('mobile', value)} placeholder="Enter mobile number" />
          <ReportSelect label="Role" value={form.role} onChange={(value) => updateField('role', value)} options={['Sales Executive', 'Team Leader', 'Branch Manager', 'Super Admin']} />
          <ReportSelect label="Assigned Branch" value={form.branch} onChange={(value) => updateField('branch', value)} options={['Head Office', 'Indore Branch', 'Ujjain Branch', 'Dewas Branch']} />
          <ReportSelect label="Status" value={form.status} onChange={(value) => updateField('status', value)} options={['Active', 'Inactive']} />
        </div>
        <div className="flex flex-col justify-end gap-3 border-t border-[#edf2f8] px-6 py-5 sm:flex-row">
          <button type="button" onClick={onClose} className="h-10 rounded-[8px] border border-[#d9e4f2] bg-white px-6 text-[13px] font-extrabold text-[#233a6b]">Cancel</button>
          <button type="button" onClick={saveUser} className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#0d9f4a] px-6 text-[13px] font-extrabold text-white">
            <Save className="size-4" />
            Save User
          </button>
        </div>
      </div>
    </div>
  );
}

function UserDetailsModal({ user, onClose, onNotify }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#111827]/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[620px] rounded-[16px] bg-white p-6 shadow-[0_30px_70px_rgba(17,24,39,0.28)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <AssigneeCell assignee={user.assignee} />
            <p className="mt-2 text-[13px] font-bold text-[#53647f]">{user.email}</p>
          </div>
          <button type="button" onClick={onClose} className="text-[#7585a2]"><X className="size-5" /></button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <InfoCell label="Mobile Number" value={user.mobile} />
          <InfoCell label="Role" valueNode={<EmployeeRoleBadge role={user.role} />} />
          <InfoCell label="Branch" value={user.branch} />
          <InfoCell label="Status" valueNode={<EmployeeStatusBadge status={user.status} />} />
          <InfoCell label="Created On" value={user.createdOn} />
          <InfoCell label="Last Login" value="Today, 11:35 AM" />
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <MiniActionButton label="Reset Password" icon={LockKeyhole} tone="blue" onClick={() => onNotify(`Password reset sent to ${user.name}`)} />
          <MiniActionButton label="Edit User" icon={FileText} tone="purple" onClick={() => onNotify(`${user.name} edit selected`)} />
          <MiniActionButton label={user.status === 'Active' ? 'Deactivate' : 'Activate'} icon={ShieldCheck} tone="amber" onClick={() => onNotify(`${user.name} status action selected`)} />
        </div>
      </div>
    </div>
  );
}

function AddRoleModal({ onClose, onSave }) {
  const [roleName, setRoleName] = useState('');
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#111827]/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[460px] rounded-[16px] bg-white p-6 shadow-[0_30px_70px_rgba(17,24,39,0.28)]">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-[20px] font-extrabold text-[#111827]">Add Role</h2>
          <button type="button" onClick={onClose} className="text-[#7585a2]"><X className="size-5" /></button>
        </div>
        <div className="mt-5">
          <ModalTextInput label="Role Name" value={roleName} onChange={setRoleName} placeholder="Enter role name" />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="h-10 rounded-[8px] border border-[#d9e4f2] bg-white px-5 text-[13px] font-extrabold text-[#233a6b]">Cancel</button>
          <button type="button" onClick={() => onSave(roleName.trim() || 'Custom Role')} className="h-10 rounded-[8px] bg-[#0d9f4a] px-5 text-[13px] font-extrabold text-white">Save Role</button>
        </div>
      </div>
    </div>
  );
}

function ModalTextInput({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[12px] font-extrabold text-[#34466c]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-[8px] border border-black/20 bg-white px-4 text-[13px] font-bold text-[#30466d] transition placeholder:text-[#8493ab] focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}

function EmployeeStatusBadge({ status }) {
  const classes = status === 'Active' ? 'bg-[#e8f8eb] text-[#0d9f4a]' : 'bg-[#ffe9e6] text-[#ef4444]';
  return <span className={cx('inline-flex rounded-[7px] px-2.5 py-1 text-[11px] font-extrabold', classes)}>{status}</span>;
}

function EmployeeRoleBadge({ role }) {
  const classes = {
    'Sales Executive': 'bg-[#e8f2ff] text-[#0b65e5]',
    'Team Leader': 'bg-[#e8f8eb] text-[#0d9f4a]',
    'Branch Manager': 'bg-[#f3edff] text-[#7c3aed]',
    'Super Admin': 'bg-[#fff0dc] text-[#d98200]',
  }[role] ?? 'bg-[#eef2f7] text-[#53647f]';
  return <span className={cx('inline-flex rounded-[7px] px-2.5 py-1 text-[11px] font-extrabold', classes)}>{role}</span>;
}

function ModuleBadge({ module }) {
  const classes = {
    Leads: 'bg-[#e8f8eb] text-[#0d9f4a]',
    'Follow-ups': 'bg-[#f3edff] text-[#6d4ce8]',
    'IVRS Management': 'bg-[#e8f2ff] text-[#0b65e5]',
    Approvals: 'bg-[#fff0dc] text-[#d98200]',
    Users: 'bg-[#e6f8fb] text-[#0891b2]',
    'Roles & Permissions': 'bg-[#ffe9e6] text-[#e11d48]',
    Settings: 'bg-[#eef2f7] text-[#53647f]',
  }[module] ?? 'bg-[#fff0dc] text-[#d98200]';
  return <span className={cx('inline-flex rounded-[7px] px-2.5 py-1 text-[11px] font-extrabold', classes)}>{module}</span>;
}

function ActivityActionBadge({ action }) {
  const classes = {
    Created: 'text-[#0d9f4a]',
    Updated: 'text-[#0b65e5]',
    Requested: 'text-[#d98200]',
    Approved: 'text-[#0d9f4a]',
    Edited: 'text-[#0b65e5]',
    Deleted: 'text-[#ef4444]',
  }[action] ?? 'text-[#53647f]';
  return <span className={cx('font-extrabold', classes)}>{action}</span>;
}

function getRoleToneClass(tone) {
  return {
    green: 'bg-[#e8f8eb] text-[#0d9f4a]',
    blue: 'bg-[#e8f2ff] text-[#0b65e5]',
    purple: 'bg-[#f3edff] text-[#7c3aed]',
    amber: 'bg-[#fff0dc] text-[#f59e0b]',
    cyan: 'bg-[#e6f8fb] text-[#0891b2]',
    pink: 'bg-[#ffe5f0] text-[#f43f7f]',
  }[tone] ?? 'bg-[#eef2f7] text-[#53647f]';
}

function createDefaultPermissions() {
  const editableModules = ['Leads', 'Follow-ups', 'IVRS Management', 'Project Management', 'Liaisoning & Commissioning', 'O&M', 'User Management'];
  const exportModules = ['Leads', 'Follow-ups', 'IVRS Management', 'Project Management', 'Liaisoning & Commissioning', 'Reports'];
  return Object.fromEntries(permissionModules.map((module) => [
    module,
    {
      View: true,
      Add: editableModules.includes(module),
      Edit: editableModules.includes(module),
      Delete: false,
      Export: exportModules.includes(module),
    },
  ]));
}

function ReportsPage({ onNotify }) {
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState('2024-05-01');
  const [dateTo, setDateTo] = useState('2024-05-20');
  const [projectType, setProjectType] = useState('All');
  const [leadStatus, setLeadStatus] = useState('All');
  const [assignedTo, setAssignedTo] = useState('All');
  const [trendView, setTrendView] = useState('Daily');
  const [selectedStatus, setSelectedStatus] = useState('New');
  const [filtersApplied, setFiltersApplied] = useState(false);

  const formattedRange = `${formatReportDate(dateFrom)} - ${formatReportDate(dateTo)}`;

  const applyFilters = () => {
    setFiltersApplied(true);
    setDateRangeOpen(false);
    onNotify(`Reports filtered: ${projectType}, ${leadStatus}, ${assignedTo}`);
  };

  const resetFilters = () => {
    setDateFrom('2024-05-01');
    setDateTo('2024-05-20');
    setProjectType('All');
    setLeadStatus('All');
    setAssignedTo('All');
    setTrendView('Daily');
    setSelectedStatus('New');
    setFiltersApplied(false);
    setDateRangeOpen(false);
    onNotify('Reports filters reset');
  };

  return (
    <div className="space-y-4">
      <PageHeading
        title="Reports & Analytics"
        crumbs={[
          { label: 'Dashboard', onClick: () => onNotify('Dashboard breadcrumb selected') },
          { label: 'Reports & Analytics' },
        ]}
        actions={(
          <button
            type="button"
            onClick={() => onNotify(`Report exported for ${formattedRange}`)}
            data-action="reports-export"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276] shadow-[0_8px_18px_rgba(17,39,84,0.04)] transition hover:border-[#c8d8ed] hover:bg-[#f8fbff]"
          >
            <Download className="size-4 text-[#0b65e5]" />
            Export Report
          </button>
        )}
      />

      <section className={`${panelClass} relative z-40 p-4 sm:p-5`}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.25fr_0.9fr_0.9fr_0.9fr_auto] xl:items-end">
          <ReportDateRangePicker
            open={dateRangeOpen}
            onToggle={() => setDateRangeOpen((value) => !value)}
            onClose={() => setDateRangeOpen(false)}
            dateFrom={dateFrom}
            dateTo={dateTo}
            setDateFrom={setDateFrom}
            setDateTo={setDateTo}
            formattedRange={formattedRange}
          />
          <ReportSelect label="Project Type" value={projectType} onChange={setProjectType} options={['All', 'On-Grid', 'Off-Grid', 'Hybrid']} />
          <ReportSelect label="Lead Status" value={leadStatus} onChange={setLeadStatus} options={['All', 'New', 'Follow-up', 'Site Visit', 'Quotation Shared', 'Won', 'Lost']} />
          <ReportSelect label="Assigned To" value={assignedTo} onChange={setAssignedTo} options={['All', 'Rohit Singh', 'Amit Sharma', 'Neha Jain', 'Vikram Singh']} />
          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[150px] xl:grid-cols-1">
            <button
              type="button"
              onClick={applyFilters}
              data-action="reports-apply-filters"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#0d9f4a] px-4 text-[13px] font-extrabold text-white shadow-[0_12px_22px_rgba(13,159,74,0.22)] transition hover:-translate-y-0.5 hover:bg-[#078c3e]"
            >
              <RefreshCw className="size-4" />
              Apply Filters
            </button>
            <button
              type="button"
              onClick={resetFilters}
              data-action="reports-reset"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276] transition hover:bg-[#f8fbff]"
            >
              <RefreshCw className="size-4 text-[#7585a2]" />
              Reset
            </button>
          </div>
        </div>
        {filtersApplied ? (
          <div className="mt-4 rounded-[10px] border border-[#d9f2e4] bg-[#f4fff8] px-4 py-3 text-[12px] font-bold text-[#276747]">
            Active report view: {formattedRange} | {projectType} | {leadStatus} | {assignedTo}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {reportKpis.map((kpi) => (
          <ReportKpiCard key={kpi.title} kpi={kpi} onClick={() => onNotify(`${kpi.title} report opened`)} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <article className={`${panelClass} overflow-hidden p-4 sm:p-5`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-[18px] font-extrabold text-[#111827]">Leads Trend</h2>
            <ReportSelect
              label="Trend View"
              value={trendView}
              onChange={(value) => {
                setTrendView(value);
                onNotify(`${value} trend selected`);
              }}
              options={['Daily', 'Weekly', 'Monthly']}
              hideLabel
              className="sm:w-[120px]"
            />
          </div>
          <ReportLineChart series={reportTrendSeries} view={trendView} onLegendClick={onNotify} />
        </article>

        <article className={`${panelClass} overflow-hidden p-4 sm:p-5`}>
          <h2 className="font-display text-[18px] font-extrabold text-[#111827]">Leads by Status</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-[220px_minmax(0,1fr)] md:items-center xl:grid-cols-1 2xl:grid-cols-[220px_minmax(0,1fr)]">
            <ReportDonut selectedStatus={selectedStatus} />
            <div className="grid gap-2">
              {reportStatusData.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setSelectedStatus(item.label);
                    onNotify(`${item.label} status segment selected`);
                  }}
                  className={cx(
                    'flex items-center justify-between rounded-[9px] px-3 py-2 text-left text-[13px] font-bold transition hover:bg-[#f8fbff]',
                    selectedStatus === item.label && 'bg-[#f5f9ff] ring-1 ring-[#dbe8ff]',
                  )}
                >
                  <span className="inline-flex items-center gap-2 text-[#1e3261]">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.label}
                  </span>
                  <span className="text-[#314a79]">{item.value} ({item.percent})</span>
                </button>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(320px,0.78fr)]">
        <ReportTableCard
          title="Leads by Project Type"
          headers={['Project Type', 'Total Leads', 'Won Leads', 'Conversion Rate']}
          rows={projectTypeReportRows}
          onRowClick={(row) => onNotify(`${row[0]} project report opened`)}
        />
        <ReportEmployeeCard onNotify={onNotify} />
        <ReportIvrsSummary onNotify={onNotify} />
      </section>

      <DashboardFooter />
    </div>
  );
}

function ReportDateRangePicker({ open, onToggle, onClose, dateFrom, dateTo, setDateFrom, setDateTo, formattedRange }) {
  return (
    <div className="relative">
      <span className="mb-2 block text-[12px] font-extrabold text-[#34466c]">Date Range</span>
      <button
        type="button"
        onClick={onToggle}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-[8px] border border-black/20 bg-white px-4 text-left text-[13px] font-bold text-[#30466d] transition hover:bg-[#fbfdff] focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      >
        <span className="inline-flex min-w-0 items-center gap-3">
          <CalendarDays className="size-4 shrink-0 text-[#7386a3]" />
          <span className="truncate">{formattedRange}</span>
        </span>
        <ChevronRight className={cx('size-4 shrink-0 text-[#7386a3] transition', open && 'rotate-90')} />
      </button>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-full min-w-[280px] rounded-[14px] border border-[#dbe5f2] bg-white p-4 shadow-[0_18px_44px_rgba(24,48,87,0.18)]">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-[11px] font-extrabold uppercase text-[#8493ab]">From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="h-10 w-full rounded-[8px] border border-black/20 bg-white px-3 text-[13px] font-bold text-[#30466d] transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-[11px] font-extrabold uppercase text-[#8493ab]">To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="h-10 w-full rounded-[8px] border border-black/20 bg-white px-3 text-[13px] font-bold text-[#30466d] transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-[8px] bg-[#0d9f4a] px-4 text-[12px] font-extrabold text-white transition hover:bg-[#078c3e]"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReportSelect({ label, value, onChange, options, hideLabel = false, className = '' }) {
  return (
    <label className={cx('block min-w-0', className)}>
      {!hideLabel ? <span className="mb-2 block text-[12px] font-extrabold text-[#34466c]">{label}</span> : null}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="h-11 w-full rounded-[8px] border border-black/20 bg-white px-4 text-[13px] font-bold text-[#30466d] outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function ReportKpiCard({ kpi, onClick }) {
  const Icon = kpi.icon;
  const tone = reportKpiToneClasses[kpi.tone] || reportKpiToneClasses.blue;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        `${panelClass} min-h-[112px] p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(24,48,87,0.1)]`,
        tone,
      )}
    >
      <div className="flex items-center gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-current/10">
          <Icon className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-extrabold text-[#263d72]">{kpi.title}</p>
          <p className="mt-1 font-display text-[25px] font-extrabold leading-none text-[#111827]">
            {kpi.value}
            <span className="ml-2 inline-flex items-center gap-1 align-middle text-[12px] font-extrabold text-[#0d9f4a]">
              <ArrowUpRight className="size-3.5" />
              {kpi.growth}
            </span>
          </p>
          <p className="mt-3 text-[11px] font-bold text-[#53647f]">{kpi.caption}</p>
        </div>
      </div>
    </button>
  );
}

function ReportLineChart({ series, view, onLegendClick }) {
  const width = 680;
  const height = 250;
  const padding = { left: 38, right: 18, top: 26, bottom: 42 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = 40;
  const labels = view === 'Daily'
    ? ['01 May', '04 May', '07 May', '10 May', '13 May', '16 May', '19 May', '20 May']
    : view === 'Weekly'
      ? ['Week 1', 'Week 2', 'Week 3', 'Week 4']
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May'];

  return (
    <div className="mt-5">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        {series.map((item) => (
          <button
            type="button"
            key={item.label}
            onClick={() => onLegendClick(`${item.label} trend focused`)}
            className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-[12px] font-extrabold text-[#314a79] transition hover:bg-[#f5f9ff]"
          >
            <span className="h-1.5 w-5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[620px]">
          {[0, 10, 20, 30, 40].map((tick) => {
            const y = padding.top + chartHeight - (tick / maxValue) * chartHeight;
            return (
              <g key={tick}>
                <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e8eef6" strokeWidth="1" />
                <text x={padding.left - 12} y={y + 4} textAnchor="end" fontSize="12" fontWeight="800" fill="#53647f">{tick}</text>
              </g>
            );
          })}

          {series.map((item) => {
            const points = item.values.map((value, index) => {
              const x = padding.left + (index / (item.values.length - 1)) * chartWidth;
              const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
              return `${x},${y}`;
            }).join(' ');

            return (
              <g key={item.label}>
                <polyline points={points} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                {item.values.map((value, index) => {
                  const x = padding.left + (index / (item.values.length - 1)) * chartWidth;
                  const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
                  return <circle key={`${item.label}-${index}`} cx={x} cy={y} r="3.4" fill={item.color} stroke="#fff" strokeWidth="1.5" />;
                })}
              </g>
            );
          })}

          {labels.map((label, index) => {
            const x = padding.left + (index / (labels.length - 1)) * chartWidth;
            return <text key={label} x={x} y={height - 14} textAnchor="middle" fontSize="12" fontWeight="800" fill="#53647f">{label}</text>;
          })}
        </svg>
      </div>
    </div>
  );
}

function ReportDonut({ selectedStatus }) {
  let start = 0;
  const total = reportStatusData.reduce((sum, item) => sum + item.value, 0);
  const gradient = reportStatusData.map((item) => {
    const end = start + (item.value / total) * 100;
    const stop = `${item.color} ${start}% ${end}%`;
    start = end;
    return stop;
  }).join(', ');

  return (
    <div className="mx-auto grid size-[220px] place-items-center rounded-full" style={{ background: `conic-gradient(${gradient})` }}>
      <div className="grid size-[112px] place-items-center rounded-full bg-white text-center shadow-[inset_0_0_0_1px_rgba(219,229,242,0.9)]">
        <div>
          <p className="text-[12px] font-extrabold text-[#53647f]">Total</p>
          <p className="font-display text-[24px] font-extrabold text-[#111827]">156</p>
          <p className="mt-1 text-[10px] font-extrabold text-[#0b65e5]">{selectedStatus}</p>
        </div>
      </div>
    </div>
  );
}

function ReportTableCard({ title, headers, rows, onRowClick }) {
  return (
    <article className={`${panelClass} overflow-hidden p-4 sm:p-5`}>
      <h2 className="font-display text-[16px] font-extrabold text-[#111827]">{title}</h2>
      <div className="mt-4 overflow-x-auto rounded-[12px] border border-[#e7eef7] bg-white">
        <table className="crm-table min-w-[520px] w-full">
          <thead>
            <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[0]} onClick={() => onRowClick(row)} className="cursor-pointer">
                {row.map((cell, index) => (
                  <td key={`${row[0]}-${index}`} className={index === 0 ? 'font-extrabold text-[#1e3261]' : undefined}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function ReportEmployeeCard({ onNotify }) {
  return (
    <article className={`${panelClass} overflow-hidden p-4 sm:p-5`}>
      <h2 className="font-display text-[16px] font-extrabold text-[#111827]">Top Assigned Employees</h2>
      <div className="mt-4 overflow-x-auto rounded-[12px] border border-[#e7eef7] bg-white">
        <table className="crm-table min-w-[560px] w-full">
          <thead>
            <tr>{['Employee', 'Total Leads', 'Won Leads', 'Conversion Rate'].map((header) => <th key={header}>{header}</th>)}</tr>
          </thead>
          <tbody>
            {assignedEmployeeRows.map((row) => (
              <tr key={row.employee} onClick={() => onNotify(`${row.employee} employee report opened`)} className="cursor-pointer">
                <td><AssigneeCell assignee={row.assignee} compact /></td>
                <td>{row.leads}</td>
                <td>{row.won}</td>
                <td>{row.conversion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function ReportIvrsSummary({ onNotify }) {
  return (
    <article className={`${panelClass} p-4 sm:p-5`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-[16px] font-extrabold text-[#111827]">
          <ShieldCheck className="size-5 text-[#0d9f4a]" />
          IVRS Intelligence Summary
        </h2>
      </div>
      <div className="overflow-hidden rounded-[12px] border border-[#e7eef7] bg-white">
        {ivrsReportRows.map(([label, value]) => (
          <button
            key={label}
            type="button"
            onClick={() => onNotify(`${label} details opened`)}
            className="flex w-full items-center justify-between gap-3 border-b border-[#edf2f8] px-4 py-3 text-left text-[13px] font-extrabold text-[#1e3261] transition last:border-b-0 hover:bg-[#f8fbff]"
          >
            <span>{label}</span>
            <span>{value}</span>
          </button>
        ))}
      </div>
    </article>
  );
}

function formatReportDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function CreateLeadPage({ onCancel, onDashboard, onRequestApproval, onNotify }) {
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);

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
          setDuplicateModalOpen(true);
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

      {duplicateModalOpen ? (
        <DuplicateIvrsModal
          onClose={() => setDuplicateModalOpen(false)}
          onRequestApproval={() => {
            setDuplicateModalOpen(false);
            onRequestApproval();
          }}
          onNotify={onNotify}
        />
      ) : null}
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

function LeadDetailsPage({ onBackToList, onCreateLead, onFollowUpHistory, onNotify }) {
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);

  const quickDetailActions = [
    { label: 'Add Follow-up', icon: ShieldCheck, tone: 'green', onClick: () => setFollowUpModalOpen(true) },
    { label: 'Create Quotation (UI)', icon: CalendarDays, tone: 'blue', onClick: () => onNotify('Quotation page will open here') },
    { label: 'Assign Lead', icon: Users, tone: 'purple', onClick: () => onNotify('Assign Lead action selected') },
    { label: 'Change Status', icon: Clock3, tone: 'amber', onClick: () => onNotify('Change Status action selected') },
    { label: 'Add Note', icon: Flag, tone: 'slate', onClick: () => onNotify('Add Note action selected') },
  ];

  return (
    <div className="space-y-4">
      <PageHeading
        title="Lead Details"
        crumbs={[
          { label: 'Dashboard', onClick: onBackToList },
          { label: 'Lead', onClick: onBackToList },
          { label: 'Lead Details' },
        ]}
        actions={(
          <>
            <button type="button" onClick={onCreateLead} className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#0b65e5] transition hover:bg-[#f8fbff]">
              <FileText className="size-4" />
              Edit Lead
            </button>
            <button type="button" onClick={() => setFollowUpModalOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#0d9f4a] px-4 text-[13px] font-extrabold text-white shadow-[0_10px_20px_rgba(13,159,74,0.2)] transition hover:bg-[#078c3e]">
              <Plus className="size-4" />
              Add Follow-up
            </button>
            <button type="button" onClick={() => onNotify('Lead options opened')} className="inline-flex size-10 items-center justify-center rounded-[8px] border border-[#d9e4f2] bg-white text-[#233a6b] transition hover:bg-[#f8fbff]" aria-label="More lead actions">
              <MoreVertical className="size-4" />
            </button>
          </>
        )}
      />

      <div className="flex flex-col gap-3 rounded-[12px] border border-[#f4cf83] bg-[#fff8e8] p-4 text-[13px] font-extrabold text-[#a76200] sm:flex-row sm:items-center sm:justify-between">
        <span className="inline-flex items-center gap-2"><AlertTriangle className="size-4" /> IVRS Number: IVRS123456</span>
        <span className="rounded-[8px] bg-[#fff0cf] px-3 py-1">Duplicate Check: Unique</span>
        <span className="rounded-[8px] bg-[#dff6e7] px-3 py-1 text-[#087a39]">Status: Follow-up</span>
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <InfoPanel title="1. Basic Information" icon={CalendarDays} tone="success">
              <DetailRow label="Customer Name" value="Amit Sharma" />
              <DetailRow label="Mobile Number" value="9876543210" />
              <DetailRow label="Alternate Number" value="+91 9123456780" />
              <DetailRow label="IVRS Number" valueNode={<span className="inline-flex items-center gap-2">IVRS123456 <StatusBadge status="Verified" /></span>} />
              <DetailRow label="Email Address" value="amit.sharma@email.com" />
              <DetailRow label="Address" value="123, Green Avenue, Indore, Madhya Pradesh - 452001" />
              <DetailRow label="Source" value="Website" />
              <DetailRow label="Assigned To" valueNode={<AssigneeCell assignee={{ name: 'Rohit Singh', initials: 'RS', tone: 'amber' }} compact />} />
              <DetailRow label="Created On" value="20 May 2024, 10:30 AM" />
            </InfoPanel>

            <InfoPanel title="2. Project Information" icon={ClipboardPlus} tone="primary">
              <DetailRow label="Project Name" value="5kW On-Grid" />
              <DetailRow label="Project Type" value="On-Grid" />
              <DetailRow label="Requirement Details" value="Customer is interested in installing 5kW On-Grid solar system for home." />
              <DetailRow label="Estimated Capacity" value="5 kW" />
              <DetailRow label="Follow-up Date" value="20 May 2024" />
              <DetailRow label="Lead Status" valueNode={<StatusBadge status="Follow-up" />} />
              <DetailRow label="Priority" valueNode={<span className="rounded-[8px] bg-[#fff0dc] px-2.5 py-1 text-[11px] font-extrabold text-[#f39b20]">Medium</span>} />
            </InfoPanel>
          </div>

          <InfoPanel title="3. Follow-up History" icon={Phone} actionLabel="View All Follow-ups" onAction={onFollowUpHistory}>
            <div className="space-y-5">
              {[
                ['Follow-up Completed', 'Customer is interested and asked for site visit. Will share quotation after site visit.', '18 May 2024, 04:30 PM', 'success'],
                ['Follow-up Scheduled', 'Site visit scheduled on 20 May 2024.', '16 May 2024, 11:00 AM', 'primary'],
                ['Initial Call', 'Initial discussion done. Customer is interested in solar system.', '15 May 2024, 10:15 AM', 'slate'],
              ].map(([title, text, date, tone]) => (
                <TimelineItem key={title} title={title} text={text} date={date} tone={tone} />
              ))}
            </div>
          </InfoPanel>
        </div>

        <div className="space-y-4">
          <InfoPanel title="IVRS Intelligence" icon={ShieldCheck} tone="success">
            <div className="rounded-[10px] border border-[#d7f0df] bg-[#effbf3] p-4">
              <p className="font-extrabold text-[#087a39]">IVRS: <span className="text-[#1e3261]">IVRS123456</span></p>
              <p className="mt-2 text-[12px] font-bold text-[#087a39]">This IVRS Number is unique. No duplicate found.</p>
            </div>
          </InfoPanel>
          <InfoPanel title="Linked Leads (Same Mobile Number)" icon={Phone} tone="danger" actionLabel="View All Linked Leads" onAction={() => onNotify('Linked leads opened')}>
            <p className="mb-3 font-extrabold text-[#1e3261]">Mobile: 9876543210 <span className="ml-2 rounded-[8px] bg-[#dff6e7] px-2 py-1 text-[11px] text-[#087a39]">3 Leads</span></p>
            {['5kW On-Grid', '10kW On-Grid', '3kW On-Grid'].map((item, index) => (
              <div key={item} className="mb-2 flex items-center justify-between rounded-[8px] border border-[#edf2f8] bg-white px-3 py-2 text-[12px] font-bold text-[#263d72]">
                <span>{item}</span>
                <StatusBadge status={index === 0 ? 'Won' : index === 1 ? 'Follow-up' : 'Lost'} />
              </div>
            ))}
          </InfoPanel>
          <InfoPanel title="Quick Actions" icon={Zap} tone="success">
            <div className="grid gap-3">
              {quickDetailActions.map((action) => (
                <MiniActionButton key={action.label} {...action} />
              ))}
            </div>
          </InfoPanel>
        </div>
      </section>

      <DashboardFooter />
      {followUpModalOpen ? <AddFollowUpModal onClose={() => setFollowUpModalOpen(false)} onSave={() => { setFollowUpModalOpen(false); onNotify('Follow-up saved'); }} /> : null}
    </div>
  );
}

function FollowUpHistoryPage({ onBackToDetails, onNotify }) {
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const timeline = [
    { title: 'Follow-up Completed', tag: 'Completed', text: 'Customer is interested in 5kW On-Grid system. Discussed product quality, subsidy and installation timeline.', date: '18 May 2024\n04:30 PM', tone: 'success', icon: Phone },
    { title: 'Follow-up Scheduled', tag: 'Scheduled', text: 'Site visit scheduled on 20 May 2024 at 11:00 AM.', date: '16 May 2024\n11:00 AM', tone: 'primary', icon: CalendarDays },
    { title: 'Site Visit Completed', tag: 'Completed', text: 'Site visit completed. Customer is satisfied with the site assessment.', date: '20 May 2024\n01:45 PM', tone: 'purple', icon: Users },
    { title: 'Note Added', tag: 'Note', text: 'Customer will share electricity bill on WhatsApp for better system sizing.', date: '21 May 2024\n02:20 PM', tone: 'warning', icon: Flag },
    { title: 'Initial Call', tag: 'Missed Call', text: 'Initial call made to customer.', date: '15 May 2024\n10:15 AM', tone: 'danger', icon: Phone },
  ];

  return (
    <div className="space-y-4">
      <PageHeading
        title="Follow-up History"
        crumbs={[{ label: 'Dashboard', onClick: onBackToDetails }, { label: 'Lead', onClick: onBackToDetails }, { label: 'Lead Details', onClick: onBackToDetails }, { label: 'Follow-up History' }]}
        actions={(
          <>
            <button type="button" onClick={() => setFollowUpModalOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#0d9f4a] px-4 text-[13px] font-extrabold text-white shadow-[0_10px_20px_rgba(13,159,74,0.2)]">
              <Plus className="size-4" />
              Add Follow-up
            </button>
            <button type="button" onClick={() => onNotify('Follow-up options opened')} className="inline-flex size-10 items-center justify-center rounded-[8px] border border-[#d9e4f2] bg-white text-[#233a6b]"><MoreVertical className="size-4" /></button>
          </>
        )}
      />

      <section className={`${panelClass} p-4`}>
        <div className="grid gap-4 lg:grid-cols-[auto_1fr_auto_auto] lg:items-center">
          <span className="grid size-12 place-items-center rounded-full bg-[#e4f8ea] text-[#18a34a]"><Users className="size-6" /></span>
          <div>
            <p className="text-[17px] font-extrabold text-[#1e3261]">Amit Sharma <StatusBadge status="Follow-up" /></p>
            <p className="mt-2 flex flex-wrap gap-4 text-[13px] font-bold text-[#314a79]">Mobile: 9876543210 <span>IVRS: IVRS123456</span> <span>Project: 5kW On-Grid</span> <span>Assigned To: Rohit Singh</span></p>
          </div>
          <div><p className="text-[12px] font-extrabold text-[#53647f]">Lead Status</p><StatusBadge status="Follow-up" /></div>
          <div><p className="text-[12px] font-extrabold text-[#53647f]">Next Follow-up</p><p className="mt-1 text-[13px] font-extrabold text-[#1e3261]">25 May 2024, 11:00 AM</p></div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <InfoPanel title="Follow-up Timeline" icon={ShieldCheck}>
          <div className="space-y-8">
            {timeline.map((item) => <HistoryItem key={item.title} item={item} />)}
          </div>
          <div className="mt-6 text-center">
            <button type="button" onClick={() => onNotify('More history loaded')} className="inline-flex items-center gap-2 rounded-[8px] border border-[#d8e4f4] bg-white px-5 py-2 text-[13px] font-extrabold text-[#0b65e5]">Load More History <Download className="size-4" /></button>
          </div>
        </InfoPanel>

        <div className="space-y-4">
          <InfoPanel title="Follow-up Summary" icon={ReceiptText} tone="success">
            {[
              ['Total Follow-ups', '5', 'text-[#1e3261]'],
              ['Completed', '2', 'text-[#0d9f4a]'],
              ['Scheduled', '2', 'text-[#0b65e5]'],
              ['Notes', '1', 'text-[#d98200]'],
              ['Missed', '0', 'text-[#e3342f]'],
            ].map(([label, value, color]) => (
              <div key={label} className="flex justify-between border-b border-[#edf2f8] py-2 text-[13px] font-bold"><span>{label}</span><span className={color}>{value}</span></div>
            ))}
          </InfoPanel>
          <InfoPanel title="Next Follow-up Details" icon={CalendarDays} tone="primary">
            <DetailRow label="Date" value="25 May 2024" />
            <DetailRow label="Time" value="11:00 AM" />
            <DetailRow label="Type" value="Site Visit" />
            <DetailRow label="Assigned To" valueNode={<AssigneeCell assignee={{ name: 'Rohit Singh', initials: 'RS', tone: 'amber' }} compact />} />
            <DetailRow label="Reminder" value="1 Day Before" />
            <button type="button" onClick={() => setFollowUpModalOpen(true)} className="mt-3 w-full rounded-[8px] bg-[#0d9f4a] px-4 py-2.5 text-[13px] font-extrabold text-white">Edit Next Follow-up</button>
          </InfoPanel>
          <InfoPanel title="Quick Actions" icon={Zap} tone="success">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <MiniActionButton label="Add Follow-up" icon={ShieldCheck} tone="green" onClick={() => setFollowUpModalOpen(true)} />
              <MiniActionButton label="Schedule Site Visit" icon={CalendarDays} tone="blue" onClick={() => onNotify('Site visit scheduled')} />
              <MiniActionButton label="Add Note" icon={Users} tone="purple" onClick={() => onNotify('Note added')} />
              <MiniActionButton label="Change Lead Status" icon={Clock3} tone="amber" onClick={() => onNotify('Lead status change selected')} />
            </div>
          </InfoPanel>
        </div>
      </section>

      <DashboardFooter />
      {followUpModalOpen ? <AddFollowUpModal onClose={() => setFollowUpModalOpen(false)} onSave={() => { setFollowUpModalOpen(false); onNotify('Follow-up saved'); }} /> : null}
    </div>
  );
}

function AdminApprovalPage({ onLeadDetails, onNotify }) {
  const rows = ['IVRS123456', 'IVRS789012', 'IVRS345678', 'IVRS901234', 'IVRS112233', 'IVRS445566', 'IVRS778899', 'IVRS667788'];

  return (
    <div className="space-y-4">
      <PageHeading title="Admin Approval - IVRS Request" crumbs={[{ label: 'Dashboard', onClick: onLeadDetails }, { label: 'Admin' }, { label: 'IVRS Approval' }]} />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Pending Approvals', '8', 'warning', ReceiptText],
          ['Approved Today', '5', 'success', CheckCircle2],
          ['Rejected Today', '1', 'danger', XCircle],
          ['Total Requests', '42', 'primary', FileText],
        ].map(([label, value, tone, Icon]) => <ApprovalStat key={label} label={label} value={value} tone={tone} Icon={Icon} />)}
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <article className={`${panelClass} overflow-hidden`}>
          <div className="flex flex-col gap-3 border-b border-[#edf2f8] p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-6 text-[13px] font-extrabold">
              {['Pending (8)', 'Approved', 'Rejected', 'All'].map((tab, index) => <button key={tab} type="button" onClick={() => onNotify(`${tab} tab selected`)} className={cx('pb-2', index === 0 ? 'border-b-2 border-[#0d9f4a] text-[#0d9f4a]' : 'text-[#53647f]')}>{tab}</button>)}
            </div>
            <div className="flex gap-3">
              <label className="flex h-10 min-w-[260px] items-center gap-2 rounded-[8px] border border-black/20 bg-white px-3 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                <Search className="size-4 text-[#7585a2]" />
                <input className="min-w-0 flex-1 bg-transparent text-[13px] font-bold outline-none" placeholder="Search by IVRS, name, mobile..." />
              </label>
              <button type="button" onClick={() => onNotify('Approval filters opened')} className="rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#233a6b]">Filters</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="crm-table min-w-[880px] w-full">
              <thead><tr>{['#', 'IVRS Number', 'Customer Name', 'Mobile Number', 'Project Type', 'Requested By', 'Requested On', 'Action'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((ivrs, index) => (
                  <tr key={ivrs}>
                    <td>{index + 1}</td>
                    <td className="font-extrabold text-[#233a6b]">{ivrs}</td>
                    <td>{['Amit Sharma', 'Sunil Patidar', 'Neha Jain', 'Vikram Singh', 'Pooja Verma', 'Manish Gupta', 'Jatin Agrawal', 'Kavita Joshi'][index]}</td>
                    <td>{['9876543210', '9827456781', '9893012345', '9753124680', '9135782469', '9222334455', '9340011223', '9870098765'][index]}</td>
                    <td>{['5kW On-Grid', '10kW On-Grid', '3kW On-Grid', '5kW On-Grid', 'On-Grid', '10kW On-Grid', '5kW On-Grid', '3kW On-Grid'][index]}</td>
                    <td>Rohit Singh</td>
                    <td>20 May 2024<br />{['10:30 AM', '10:15 AM', '09:45 AM', '09:30 AM', '09:10 AM', '08:50 AM', '08:35 AM', '08:20 AM'][index]}</td>
                    <td><div className="flex gap-2"><button type="button" onClick={() => onNotify(`${ivrs} approved`)} className="rounded-[7px] bg-[#e8f8eb] px-2.5 py-1 text-[11px] font-extrabold text-[#087a39]">Approve</button><button type="button" onClick={() => onNotify(`${ivrs} rejected`)} className="rounded-[7px] bg-[#ffe9e6] px-2.5 py-1 text-[11px] font-extrabold text-[#e3342f]">Reject</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-4 text-[13px] font-bold text-[#53647f]"><span>Showing 1 to 8 of 8 entries</span><PaginationButton active onClick={() => onNotify('Page 1 selected')}>1</PaginationButton></div>
        </article>
        <div className="space-y-4">
          <InfoPanel title="IVRS Request Details" icon={CalendarDays} tone="primary">
            <DetailRow label="IVRS Number" value="IVRS123456" />
            <DetailRow label="Customer Name" value="Amit Sharma" />
            <DetailRow label="Mobile Number" value="9876543210" />
            <DetailRow label="Project Type" value="5kW On-Grid" />
            <DetailRow label="Requested By" valueNode={<AssigneeCell assignee={{ name: 'Rohit Singh', initials: 'RS', tone: 'amber' }} compact />} />
            <DetailRow label="Requested On" value="20 May 2024, 10:30 AM" />
          </InfoPanel>
          <InfoPanel title="IVRS Intelligence" icon={AlertTriangle} tone="warning">
            <div className="rounded-[10px] border border-[#f6dda9] bg-[#fff8e8] p-4 text-[13px] font-bold text-[#087a39]">IVRS: <span className="text-[#1e3261]">IVRS123456</span><p className="mt-2">This IVRS Number is unique. No duplicate found.</p></div>
          </InfoPanel>
          <InfoPanel title="Note" icon={InfoIcon} tone="primary">
            <p className="text-[13px] font-semibold leading-6 text-[#53647f]">Please verify customer details and project type before approving.</p>
          </InfoPanel>
          <InfoPanel title="Quick Actions" icon={Zap} tone="success">
            <MiniActionButton label="View Lead Details" icon={Search} tone="blue" onClick={onLeadDetails} />
            <MiniActionButton label="View IVRS Intelligence" icon={ShieldCheck} tone="blue" onClick={() => onNotify('IVRS intelligence opened')} />
            <MiniActionButton label="Refresh List" icon={RefreshCw} tone="blue" onClick={() => onNotify('Approval list refreshed')} />
          </InfoPanel>
        </div>
      </section>
      <DashboardFooter />
    </div>
  );
}

function DuplicateIvrsModal({ onClose, onRequestApproval, onNotify }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#111827]/45 p-4 backdrop-blur-[2px]">
      <div className="max-h-[92vh] w-full max-w-[650px] overflow-y-auto rounded-[16px] bg-white p-6 shadow-[0_30px_70px_rgba(17,24,39,0.28)]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex gap-3"><span className="grid size-10 place-items-center rounded-full bg-[#fff0dc] text-[#f59e0b]"><AlertTriangle className="size-6" /></span><div><h2 className="font-display text-[20px] font-extrabold text-[#111827]">Duplicate IVRS Detected</h2><p className="mt-1 text-[13px] font-semibold text-[#53647f]">The IVRS Number you entered already exists in our system.</p></div></div>
          <button type="button" onClick={onClose} className="text-[#7585a2] hover:text-[#111827]"><X className="size-5" /></button>
        </div>
        <div className="rounded-[10px] border border-[#f6dda9] bg-[#fff8e8] p-4"><p className="text-[12px] font-extrabold text-[#a76200]">Entered IVRS Number</p><p className="mt-1 text-[22px] font-extrabold text-[#111827]">IVRS123456</p></div>
        <p className="mt-5 text-[13px] font-extrabold text-[#1e3261]">Existing Lead(s) with this IVRS Number</p>
        <div className="mt-3 overflow-hidden rounded-[10px] border border-[#e7eef7]"><table className="crm-table min-w-[540px] w-full"><thead><tr>{['#', 'Customer Name', 'Mobile Number', 'Project Name', 'Lead Status', 'Assigned To', 'Created On'].map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{['5kW On-Grid', '10kW On-Grid', '3kW On-Grid'].map((project, index) => <tr key={project}><td>{index + 1}</td><td>Amit Sharma</td><td>9876543210</td><td>{project}</td><td><StatusBadge status={index === 0 ? 'Follow-up' : index === 1 ? 'Won' : 'Lost'} /></td><td>Rohit Singh</td><td>{index === 0 ? '18 May 2024' : index === 1 ? '10 May 2024' : '02 May 2024'}</td></tr>)}</tbody></table></div>
        <div className="mt-5 rounded-[10px] border border-[#f6dda9] bg-[#fff8e8] p-4 text-[13px] font-semibold text-[#314a79]"><p className="font-extrabold text-[#d98200]">System Rule (IVRS Protection)</p><p className="mt-2">Same IVRS = Same Customer</p><p>Different project with same IVRS requires Admin Approval.</p><p>You cannot create a new lead with the same IVRS without approval.</p></div>
        <div className="mt-5 space-y-3 text-[13px] font-bold text-[#1e3261]"><p>What would you like to do?</p><label className="flex items-center gap-2"><input type="radio" defaultChecked className="accent-[#0d9f4a]" /> Request Admin Approval to create new lead with this IVRS</label><label className="flex items-center gap-2"><input type="radio" className="accent-[#0d9f4a]" /> Cancel and use a different IVRS Number</label></div>
        <div className="mt-6 flex flex-col justify-end gap-3 sm:flex-row"><button type="button" onClick={onClose} className="h-11 rounded-[8px] border border-[#d9e4f2] bg-white px-6 text-[13px] font-extrabold text-[#233a6b]">Cancel</button><button type="button" onClick={onRequestApproval} className="h-11 rounded-[8px] bg-[#0d9f4a] px-6 text-[13px] font-extrabold text-white">Request Approval</button></div>
      </div>
    </div>
  );
}

function AddFollowUpModal({ onClose, onSave }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#111827]/45 p-4 backdrop-blur-[2px]">
      <div className="max-h-[92vh] w-full max-w-[900px] overflow-y-auto rounded-[16px] bg-white shadow-[0_30px_70px_rgba(17,24,39,0.28)]">
        <div className="flex items-center justify-between border-b border-[#edf2f8] px-6 py-5"><h2 className="flex items-center gap-3 font-display text-[20px] font-extrabold text-[#111827]"><CalendarDays className="size-5 text-[#0b65e5]" /> Add Follow-up</h2><button type="button" onClick={onClose} className="text-[#7585a2]"><X className="size-5" /></button></div>
        <div className="grid gap-5 p-6 md:grid-cols-2 xl:grid-cols-4">
          <ReadonlyField label="Lead Name" value="Amit Sharma" />
          <ReadonlyField label="Mobile Number" value="9876543210" />
          <ReadonlyField label="IVRS Number" value="IVRS123456" />
          <ReadonlyField label="Project Name" value="5kW On-Grid" />
          <LeadSelect label="Follow-up Type" required icon={Phone} placeholder="Phone Call" options={['Site Visit', 'WhatsApp', 'Email']} />
          <LeadDateInput label="Follow-up Date" required />
          <LeadInput label="Follow-up Time" required icon={Clock3} placeholder="04:30 PM" />
          <LeadSelect label="Talked To" icon={Users} placeholder="Amit Sharma (Self)" options={['Family Member', 'Site Owner']} />
          <div className="md:col-span-2 xl:col-span-4"><LeadTextarea label="Follow-up Notes" icon={FileText} placeholder="Customer is interested in 5kW On-Grid system..." /></div>
          <LeadDateInput label="Next Follow-up Date" required />
          <LeadInput label="Next Follow-up Time" icon={Clock3} placeholder="11:00 AM" />
          <LeadSelect label="Reminder" icon={Bell} placeholder="1 Day Before" options={['2 Hours Before', 'Same Day']} />
          <LeadSelect label="Assigned To" icon={Users} placeholder="Rohit Singh" options={['Neha Kumari', 'Vikram Patel']} />
          <LeadSelect label="Priority" icon={Flag} placeholder="Medium" options={['High', 'Low']} />
          <LeadInput label="Attachment" optional icon={FileText} placeholder="Upload file" />
        </div>
        <div className="flex flex-col gap-3 border-t border-[#edf2f8] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex items-center gap-3 text-[13px] font-bold text-[#314a79]"><input type="checkbox" defaultChecked className="size-5 rounded accent-[#0d9f4a]" /> Add to today follow-ups</label>
          <div className="flex gap-3"><button type="button" onClick={onClose} className="h-10 rounded-[8px] border border-[#d9e4f2] bg-white px-6 text-[13px] font-extrabold text-[#233a6b]">Cancel</button><button type="button" onClick={onSave} className="h-10 rounded-[8px] bg-[linear-gradient(90deg,#0d9f4a,#116fd0)] px-6 text-[13px] font-extrabold text-white">Save Follow-up</button></div>
        </div>
      </div>
    </div>
  );
}

function PageHeading({ title, crumbs, actions }) {
  return (
    <div className="flex flex-col gap-4 rounded-[14px] bg-white/60 p-2 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="font-display text-[24px] font-extrabold text-[#111827] sm:text-[28px]">{title}</h1><div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] font-bold">{crumbs.map((crumb, index) => <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-2">{crumb.onClick ? <button type="button" onClick={crumb.onClick} className="text-[#0b65e5]">{crumb.label}</button> : <span className="text-[#53647f]">{crumb.label}</span>}{index < crumbs.length - 1 ? <ChevronRight className="size-3.5 text-[#9aa8bc]" /> : null}</span>)}</div></div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

function InfoPanel({ title, icon: Icon, tone = 'primary', actionLabel, onAction, children }) {
  const toneClass = { primary: 'text-[#0b65e5]', success: 'text-[#0d9f4a]', danger: 'text-[#ef4444]', warning: 'text-[#f59e0b]', purple: 'text-[#5944e8]' }[tone] ?? 'text-[#0b65e5]';
  return <article className={`${panelClass} p-5`}><div className="mb-4 flex items-center justify-between gap-3"><h2 className={`flex items-center gap-2 text-[15px] font-extrabold ${toneClass}`}><Icon className="size-4" />{title}</h2>{actionLabel ? <button type="button" onClick={onAction} className="inline-flex items-center gap-2 text-[13px] font-extrabold text-[#0b65e5]">{actionLabel}<ArrowRight className="size-4" /></button> : null}</div>{children}</article>;
}

function DetailRow({ label, value, valueNode }) {
  return <div className="grid gap-2 py-2 text-[13px] sm:grid-cols-[155px_1fr]"><span className="font-bold text-[#53647f]">{label}</span><span className="font-extrabold text-[#1e3261]">{valueNode ?? value}</span></div>;
}

function TimelineItem({ title, text, date, tone }) {
  const toneClass = { success: 'bg-[#e8f8eb] text-[#0d9f4a]', primary: 'bg-[#e8f2ff] text-[#0b65e5]', slate: 'bg-[#eef2f7] text-[#7585a2]' }[tone] ?? 'bg-[#eef2f7] text-[#7585a2]';
  return <div className="flex gap-4"><span className={`grid size-10 shrink-0 place-items-center rounded-full ${toneClass}`}><Phone className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-col gap-1 sm:flex-row sm:justify-between"><p className="font-extrabold text-[#1e3261]">{title}</p><p className="text-[12px] font-bold text-[#53647f]">{date}</p></div><p className="mt-1 text-[12px] font-bold text-[#53647f]">By Rohit Singh</p><p className="mt-1 text-[13px] font-semibold text-[#53647f]">{text}</p></div></div>;
}

function HistoryItem({ item }) {
  const Icon = item.icon;
  const toneClass = { success: 'bg-[#0d9f4a]', primary: 'bg-[#0b65e5]', purple: 'bg-[#5944e8]', warning: 'bg-[#f59e0b]', danger: 'bg-[#ef4444]' }[item.tone] ?? 'bg-[#7585a2]';
  return <div className="grid gap-4 sm:grid-cols-[40px_1fr_auto]"><span className={`grid size-10 place-items-center rounded-full text-white ${toneClass}`}><Icon className="size-5" /></span><div><p className="font-extrabold text-[#1e3261]">{item.title} <span className="ml-2 rounded-[7px] bg-[#e8f8eb] px-2 py-1 text-[11px] text-[#0d9f4a]">{item.tag}</span></p><p className="mt-2 text-[12px] font-bold text-[#53647f]">By Rohit Singh</p><p className="mt-2 text-[13px] font-semibold text-[#53647f]">{item.text}</p></div><p className="whitespace-pre-line text-right text-[13px] font-bold text-[#53647f]">{item.date}</p></div>;
}

function MiniActionButton({ label, icon: Icon, tone = 'blue', onClick }) {
  const toneClass = { green: 'border-[#d7f0df] bg-[#effbf3] text-[#087a39]', blue: 'border-[#dcecff] bg-[#f3f8ff] text-[#0b65e5]', purple: 'border-[#e2ddff] bg-[#f7f5ff] text-[#5944e8]', amber: 'border-[#f6dda9] bg-[#fff8e8] text-[#b76b00]', slate: 'border-[#d9e4f2] bg-[#f8fbff] text-[#1e3261]' }[tone] ?? 'border-[#dcecff] bg-[#f3f8ff] text-[#0b65e5]';
  return <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 rounded-[8px] border px-4 py-3 text-left text-[13px] font-extrabold transition hover:-translate-y-0.5 ${toneClass}`}><Icon className="size-4" />{label}</button>;
}

function ApprovalStat({ label, value, tone, Icon }) {
  const toneClass = { warning: 'bg-[#fff0dc] text-[#f59e0b]', success: 'bg-[#e8f8eb] text-[#0d9f4a]', danger: 'bg-[#ffe9e6] text-[#ef4444]', primary: 'bg-[#e8f2ff] text-[#0b65e5]' }[tone];
  return <article className={`${panelClass} flex items-center gap-4 p-5`}><span className={`grid size-11 place-items-center rounded-full ${toneClass}`}><Icon className="size-5" /></span><div><p className="text-[13px] font-bold text-[#53647f]">{label}</p><p className="mt-1 font-display text-[22px] font-extrabold text-[#111827]">{value}</p></div></article>;
}

function InfoIcon(props) {
  return <AlertTriangle {...props} />;
}

function ReadonlyField({ label, value }) {
  return <label className="block"><span className="mb-2 block text-[12px] font-extrabold text-[#34466c]">{label}</span><span className="flex h-11 items-center rounded-[8px] border border-black/20 bg-[#f8fafc] px-4 text-[13px] font-extrabold text-[#1e3261]">{value}</span></label>;
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

function LeadListMobileCard({ index, lead, onOpenLead, onNotify }) {
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
        onClick={onOpenLead}
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
