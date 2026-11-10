/**
 * Unified Developer Mode navigation.
 * Groups: CRM tools (legacy) + console categories + dashboard.
 */

export const DEVELOPER_NAV_GROUPS = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { id: 'home', label: 'Dashboard', hint: 'System overview & quick actions' },
    ],
  },
  {
    id: 'crm-tools',
    label: 'CRM Developer Settings',
    items: [
      { id: 'memory', label: 'Memory', hint: 'Heap / memory diagnostics' },
      { id: 'whatsapp-extension', label: 'WhatsApp Extension', hint: 'WA extension config' },
      { id: 'attendance-machine', label: 'Attendance Machine', hint: 'eTimeOffice / biometric sync' },
      { id: 'audit-logs', label: 'Audit Logs', hint: 'CRM audit trail' },
      { id: 'bug-reports', label: 'Bug Reports', hint: 'In-app bug reports' },
    ],
  },
  {
    id: 'performance-group',
    label: 'Performance & Monitoring',
    items: [
      { id: 'performance', label: 'Performance Monitoring', hint: 'FPS, memory, API latency' },
      { id: 'system', label: 'System Information', hint: 'App, browser, TWA info' },
    ],
  },
  {
    id: 'debug-group',
    label: 'Debugging & Diagnostics',
    items: [
      { id: 'debugging', label: 'Debugging Tools', hint: 'Logs, API inspector, errors' },
      { id: 'diagnostics', label: 'Diagnostics', hint: 'Network, health, sync' },
    ],
  },
  {
    id: 'ui-group',
    label: 'UI & Application Controls',
    items: [
      { id: 'ui', label: 'UI Controls', hint: 'Animation, taps, RTL, bounds' },
      { id: 'advanced', label: 'Advanced App Controls', hint: 'Cache, refresh, config' },
    ],
  },
  {
    id: 'test-group',
    label: 'Testing & Data Tools',
    items: [
      { id: 'testing', label: 'Testing Lab', hint: 'Network simulation, delays' },
      { id: 'data', label: 'Data Tools', hint: 'Export diagnostic reports' },
    ],
  },
];

/** Flat list used by search / legacy imports. */
export const DEVELOPER_CATEGORIES = DEVELOPER_NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({
    id: item.id,
    label: item.label,
    hint: item.hint,
    groupId: group.id,
    groupLabel: group.label,
  })),
);

export function findDeveloperNavItem(id) {
  return DEVELOPER_CATEGORIES.find((item) => item.id === id) || null;
}
