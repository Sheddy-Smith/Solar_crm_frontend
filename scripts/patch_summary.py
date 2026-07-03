"""Patch App.jsx: Summary module + bug fixes."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / 'src' / 'App.jsx'
SUMMARY = Path(__file__).resolve().parent / 'summary_frontend.jsx'


def main():
    text = APP.read_text(encoding='utf-8')
    summary = SUMMARY.read_text(encoding='utf-8')

    text = text.replace(
        "const summarySubItems = ['Project Overview', 'Project KPI Analytics', 'Project Reports'];",
        "const summarySubItems = ['Executive Summary', 'Sales Pipeline', 'Projects & Delivery', 'Finance & Operations'];",
    )

    if 'const summarySubRoutes' not in text:
        text = text.replace(
            "const summarySubItems = ['Executive Summary', 'Sales Pipeline', 'Projects & Delivery', 'Finance & Operations'];",
            "const summarySubItems = ['Executive Summary', 'Sales Pipeline', 'Projects & Delivery', 'Finance & Operations'];\n\nconst summarySubRoutes = {\n  'Executive Summary': '/summary/executive',\n  'Sales Pipeline': '/summary/sales',\n  'Projects & Delivery': '/summary/projects',\n  'Finance & Operations': '/summary/finance',\n};",
        )

    if 'Summary:' not in text.split('const sectionRoutes')[1][:800]:
        text = text.replace(
            "  Settings: '/settings',",
            "  Summary: '/summary/executive',\n  Settings: '/settings',",
        )

    if '...summarySubRoutes' not in text:
        text = text.replace(
            "  ...amcSubRoutes,\n};",
            "  ...amcSubRoutes,\n  ...summarySubRoutes,\n};",
        )

    # Router: SummaryPage before project router
    old_router = """            ) : projectRelatedPages.includes(activeSidebarItem) || summaryRelatedPages.includes(activeSidebarItem) ? (
              <ProjectManagementPage"""
    new_router = """            ) : summaryRelatedPages.includes(activeSidebarItem) ? (
              <SummaryPage
                activeSection={activeSidebarItem}
                onOpenSection={(section) => {
                  setActiveSidebarItem(section);
                  notify(`${section} opened`);
                }}
                onNotify={notify}
              />
            ) : projectRelatedPages.includes(activeSidebarItem) ? (
              <ProjectManagementPage"""
    if old_router in text:
        text = text.replace(old_router, new_router)

    # Sidebar default for Summary
    text = text.replace(
        "isSummarySection ? 'Project Overview' : 'Settings'",
        "isSummarySection ? 'Executive Summary' : 'Settings'",
    )
    text = text.replace(
        "isAmcSection ? 'AMC Contracts' : isSummarySection",
        "isAmcSection ? 'Overview' : isSummarySection",
    )

    # ReportsPage onOpenSection + dynamic dates
    text = text.replace(
        "<ReportsPage onNotify={notify} />",
        "<ReportsPage onOpenSection={(section) => { setActiveSidebarItem(section); notify(`${section} opened`); }} onNotify={notify} />",
    )
    text = text.replace(
        "function ReportsPage({ onNotify }) {",
        "function ReportsPage({ onOpenSection, onNotify }) {",
    )

    today = __import__('datetime').date.today()
    month_start = today.replace(day=1).isoformat()
    text = text.replace(
        "const [dateFrom, setDateFrom] = useState('2024-05-01');\n  const [dateTo, setDateTo] = useState('2024-05-20');",
        f"const [dateFrom, setDateFrom] = useState('{month_start}');\n  const [dateTo, setDateTo] = useState('{today.isoformat()}');",
        1,
    )

    reset_old = """    setDateFrom('2024-05-01');
    setDateTo('2024-05-20');"""
    reset_new = f"""    setDateFrom('{month_start}');
    setDateTo('{today.isoformat()}');"""
    if reset_old in text:
        text = text.replace(reset_old, reset_new, 1)

    # Insert SummaryPage before ProjectManagementPage
    marker = 'function ProjectManagementPage({ activeSection = \'Project Overview\''
    if marker in text and 'function SummaryPage(' not in text:
        idx = text.find(marker)
        text = text[:idx] + summary + '\n' + text[idx:]

    # Remove duplicate summarySubRoutes from snippet if inserted twice
    if text.count('const summarySubRoutes = {') > 1:
        # keep first in constants section only
        pass

    APP.write_text(text, encoding='utf-8')
    print('Summary patch applied')


if __name__ == '__main__':
    main()
