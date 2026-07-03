"""Patch App.jsx routing: fix Inventory/Project blank screens, KPI redirect, Settings sidebar."""

from pathlib import Path

path = Path(__file__).resolve().parents[1] / "src" / "App.jsx"
text = path.read_text(encoding="utf-8")

replacements = [
    (
        "const projectRelatedPages = ['Project Management', ...projectActionPages, ...projectSubItems, 'Project Details', 'Project Timeline', 'Project Work Orders', 'Project Report View'];",
        "const projectRelatedPages = ['Project Management', 'Project Overview', 'Project KPI Analytics', 'Project Reports', ...projectActionPages, ...projectSubItems, 'Project Details', 'Project Timeline', 'Project Work Orders', 'Project Report View'];",
    ),
    (
        "const accountsSubItems = ['Overview', 'Accounts List', 'Payment Received', 'Payment Made', 'Bank Accounts', 'Cheques List', 'Chart of Accounts'];",
        "const accountsSubItems = ['Accounts Overview', 'Accounts List', 'Payment Received', 'Payment Made', 'Bank Accounts', 'Cheques List', 'Chart of Accounts'];",
    ),
    (
        "const inventorySubItems = ['Overview', 'Products', 'Stock Inward', 'Stock Outward', 'Stock Transfer', 'Adjustments', 'Warehouses'];",
        "const inventorySubItems = ['Inventory Overview', 'Products', 'Stock Inward', 'Stock Outward', 'Stock Transfer', 'Adjustments', 'Warehouses'];",
    ),
    (
        "const inventoryRelatedPages = [...inventorySubItems];",
        "const inventoryRelatedPages = ['Inventory', ...inventorySubItems];",
    ),
    (
        "const amcSubItems = ['Overview', 'AMC Contracts', 'Warranties', 'Service Requests', 'Visits / Maintenance', 'Renewals', 'Claims', 'AMC Documents'];",
        "const amcSubItems = ['AMC Overview', 'AMC Contracts', 'Warranties', 'Service Requests', 'Visits / Maintenance', 'Renewals', 'Claims', 'AMC Documents'];",
    ),
    (
        "  'Accounts Overview': '/accounts/overview',\n  Overview: '/accounts/overview',",
        "  'Accounts Overview': '/accounts/overview',",
    ),
    (
        "const inventorySubRoutes = {\n  Overview: '/inventory/overview',",
        "const inventorySubRoutes = {\n  'Inventory Overview': '/inventory/overview',",
    ),
    (
        "  'AMC Overview': '/amc/overview',\n  Overview: '/amc/overview',",
        "  'AMC Overview': '/amc/overview',",
    ),
    (
        "const nextItem = isProjectSection ? 'Project List' : isEmployeeSection ? 'Users' : isAccountsSection ? 'Accounts List' : isInventorySection ? 'Overview' : isLiaisonSection ? 'Applications' : isOmSection ? 'Maintenance Tasks' : isAmcSection ? 'Overview' : isSummarySection ? 'Executive Summary' : 'Settings';",
        "const nextItem = isProjectSection ? 'Project Overview' : isEmployeeSection ? 'Users' : isAccountsSection ? 'Accounts Overview' : isInventorySection ? 'Inventory Overview' : isLiaisonSection ? 'Applications' : isOmSection ? 'Maintenance Tasks' : isAmcSection ? 'AMC Overview' : isSummarySection ? 'Executive Summary' : 'Settings';",
    ),
    (
        "  if (item === 'Project Overview') {\n    return 'Overview';\n  }",
        "  if (item === 'Project Overview' || item === 'Inventory Overview' || item === 'Accounts Overview' || item === 'AMC Overview') {\n    return 'Overview';\n  }",
    ),
    (
        "function InventoryManagementPage({ activeSection, onOpenSection, onNotify }) {\n  if (activeSection === 'Overview') {",
        "function InventoryManagementPage({ activeSection, onOpenSection, onNotify }) {\n  if (activeSection === 'Inventory Overview' || activeSection === 'Inventory' || activeSection === 'Overview') {",
    ),
    (
        "  if (activeSection === 'Overview' || activeSection === 'Accounts Overview') {\n    return <AccountsOverviewPage activeSection=\"Overview\" onOpenSection={onOpenSection} onNotify={onNotify} />;",
        "  if (activeSection === 'Accounts Overview' || activeSection === 'Overview') {\n    return <AccountsOverviewPage activeSection=\"Accounts Overview\" onOpenSection={onOpenSection} onNotify={onNotify} />;",
    ),
    (
        "  return <AccountsOverviewPage activeSection=\"Overview\" onOpenSection={onOpenSection} onNotify={onNotify} />;",
        "  return <AccountsOverviewPage activeSection=\"Accounts Overview\" onOpenSection={onOpenSection} onNotify={onNotify} />;",
    ),
    (
        "  if (activeSection === 'Overview' || activeSection === 'AMC Overview') {\n    return <AmcOverviewPage activeSection=\"Overview\" onOpenSection={onOpenSection} onNotify={onNotify} />;",
        "  if (activeSection === 'AMC Overview' || activeSection === 'Overview') {\n    return <AmcOverviewPage activeSection=\"AMC Overview\" onOpenSection={onOpenSection} onNotify={onNotify} />;",
    ),
    (
        "  return <AmcOverviewPage activeSection=\"Overview\" onOpenSection={onOpenSection} onNotify={onNotify} />;",
        "  return <AmcOverviewPage activeSection=\"AMC Overview\" onOpenSection={onOpenSection} onNotify={onNotify} />;",
    ),
    (
        "  if (activeSection === 'Project Overview') {\n    return <ProjectOverviewPage activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;\n  }",
        "  if (activeSection === 'Project Management' || activeSection === 'Project Overview') {\n    return <ProjectOverviewPage activeSection=\"Project Overview\" onOpenSection={onOpenSection} onNotify={onNotify} />;\n  }",
    ),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f"MISSING:\n{old[:120]}...")
    text = text.replace(old, new, 1)

# Settings sidebar: direct navigation, no sub-menu expansion
old_settings_click = """                          const sectionKey = isProjectSection ? 'Project Management' : isEmployeeSection ? 'Employee Management' : isAccountsSection ? 'Accounts' : isInventorySection ? 'Inventory' : isLiaisonSection ? 'Liaisoning & Commissioning' : isOmSection ? 'O&M' : isAmcSection ? 'AMC & Warranty' : isSummarySection ? 'Summary' : isSettingsSection ? 'Settings' : null;
                          if (sectionKey) {
                            if (expandedSection === sectionKey) {
                              setExpandedSection(null);
                            } else {
                              setExpandedSection(sectionKey);
                              const nextItem = isProjectSection ? 'Project Overview' : isEmployeeSection ? 'Users' : isAccountsSection ? 'Accounts Overview' : isInventorySection ? 'Inventory Overview' : isLiaisonSection ? 'Applications' : isOmSection ? 'Maintenance Tasks' : isAmcSection ? 'AMC Overview' : isSummarySection ? 'Executive Summary' : 'Settings';
                              setActiveSidebarItem(nextItem);
                              notify(`${nextItem} section selected`);
                            }
                          } else {"""

new_settings_click = """                          if (isSettingsSection) {
                            setExpandedSection(null);
                            setActiveSidebarItem('Settings');
                            notify('Settings opened');
                            setMobileSidebarOpen(false);
                            return;
                          }
                          const sectionKey = isProjectSection ? 'Project Management' : isEmployeeSection ? 'Employee Management' : isAccountsSection ? 'Accounts' : isInventorySection ? 'Inventory' : isLiaisonSection ? 'Liaisoning & Commissioning' : isOmSection ? 'O&M' : isAmcSection ? 'AMC & Warranty' : isSummarySection ? 'Summary' : null;
                          if (sectionKey) {
                            if (expandedSection === sectionKey) {
                              setExpandedSection(null);
                            } else {
                              setExpandedSection(sectionKey);
                              const nextItem = isProjectSection ? 'Project Overview' : isEmployeeSection ? 'Users' : isAccountsSection ? 'Accounts Overview' : isInventorySection ? 'Inventory Overview' : isLiaisonSection ? 'Applications' : isOmSection ? 'Maintenance Tasks' : isAmcSection ? 'AMC Overview' : 'Executive Summary';
                              setActiveSidebarItem(nextItem);
                              notify(`${nextItem} section selected`);
                            }
                          } else {"""

if old_settings_click not in text:
    raise SystemExit("Settings click block not found")
text = text.replace(old_settings_click, new_settings_click, 1)

# Remove settings sidebar sub-menu panel
start = text.find("                      {isSettingsOpen && !desktopSidebarCollapsed ? (")
if start == -1:
    raise SystemExit("Settings sidebar panel not found")
end = text.find("                      ) : null}", start) + len("                      ) : null}")
text = text[:start] + "                      {null /* Settings subcategories shown on page only */}" + text[end:]

# Remove auto-expand Settings in useEffect
text = text.replace(
    "    if (settingsRelatedPages.includes(activeSidebarItem)) { setExpandedSection('Settings'); return; }\n",
    "",
)

text = text.replace(
    "    if (settingsRelatedPages.includes(item)) return 'Settings';\n",
    "",
)

path.write_text(text, encoding="utf-8")
print("App.jsx routing patched OK")
