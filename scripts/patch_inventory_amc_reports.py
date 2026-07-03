"""Patch App.jsx: wire Inventory, AMC & Warranty, Reports to real APIs."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / 'src' / 'App.jsx'
SNIPPET = Path(__file__).resolve().parent / 'modules_frontend_snippet.jsx'

START_MARKER = 'function AmcWarrantyPage({ activeSection, onOpenSection, onNotify }) {'
END_MARKER = 'function ProjectManagementPage({ activeSection = \'Project Overview\', onOpenSection, selectedProject, onSelectProject, onNotify }) {'


def main():
    text = APP.read_text(encoding='utf-8')
    snippet = SNIPPET.read_text(encoding='utf-8')

    # Update imports
    old_import = (
        "  omAssetApi, omMaintenanceApi, omTicketApi, omVisitApi, omSparePartApi, omReportApi, omDocumentApi,\n"
        "} from './api.js';"
    )
    new_import = (
        "  omAssetApi, omMaintenanceApi, omTicketApi, omVisitApi, omSparePartApi, omReportApi, omDocumentApi,\n"
        "  inventoryApi, amcModuleApi, reportsApi,\n"
        "} from './api.js';"
    )
    if old_import in text:
        text = text.replace(old_import, new_import)

    # AMC sub-items + routes
    text = text.replace(
        "const amcSubItems = ['AMC Contracts', 'Warranties', 'Service Requests', 'Visits / Maintenance', 'Renewals', 'Claims', 'AMC Documents'];",
        "const amcSubItems = ['Overview', 'AMC Contracts', 'Warranties', 'Service Requests', 'Visits / Maintenance', 'Renewals', 'Claims', 'AMC Documents'];",
    )
    text = text.replace(
        "const amcSubRoutes = {\n  'AMC Contracts': '/amc/contracts',",
        "const amcSubRoutes = {\n  'AMC Overview': '/amc/overview',\n  Overview: '/amc/overview',\n  'AMC Contracts': '/amc/contracts',",
    )
    if "'AMC & Warranty': '/amc/contracts'" not in text:
        text = text.replace(
            "  Inventory: '/inventory/overview',",
            "  Inventory: '/inventory/overview',\n  'AMC & Warranty': '/amc/overview',",
        )

    # Replace AMC + Inventory block
    start = text.find(START_MARKER)
    end = text.find(END_MARKER)
    if start == -1 or end == -1:
        raise SystemExit(f'Markers not found: start={start}, end={end}')
    text = text[:start] + snippet + '\n' + text[end:]

    # ReportsPage: load dashboard KPIs
    reports_patch_old = """  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    setAnalyticsLoading(true);
    const params = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    analyticsApi.leads(params).then((data) => {
      if (data) setAnalyticsData(data);
    }).catch(() => {}).finally(() => setAnalyticsLoading(false));
  }, [dateFrom, dateTo, filtersApplied]);"""

    reports_patch_new = """  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    setAnalyticsLoading(true);
    const params = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    Promise.all([
      analyticsApi.leads(params),
      reportsApi.dashboard(params),
    ]).then(([leads, dashboard]) => {
      if (leads) setAnalyticsData(leads);
      if (dashboard) setDashboardData(dashboard);
    }).catch(() => {}).finally(() => setAnalyticsLoading(false));
  }, [dateFrom, dateTo, filtersApplied]);"""

    if reports_patch_old in text:
        text = text.replace(reports_patch_old, reports_patch_new)

    kpi_old = """      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {reportKpis.map((kpi) => (
          <ReportKpiCard key={kpi.title} kpi={kpi} onClick={() => onNotify(`${kpi.title} report opened`)} />
        ))}
      </section>"""

    kpi_new = """      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {(dashboardData?.kpis ?? reportKpis).map((kpi) => (
          <ReportKpiCard key={kpi.title} kpi={{ ...kpi, icon: reportKpiIconMap[kpi.tone] || Users, caption: kpi.caption || '' }} onClick={() => onNotify(`${kpi.title} report opened`)} />
        ))}
      </section>

      {dashboardData?.operations ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Active Projects', value: dashboardData.projects?.active ?? 0 },
            { label: 'Revenue (Period)', value: fmtAccRs(dashboardData.revenue) },
            { label: 'Open O&M Tickets', value: dashboardData.operations.open_tickets ?? 0 },
            { label: 'Active AMC', value: dashboardData.operations.active_amc ?? 0 },
          ].map((item) => (
            <article key={item.label} className={`${panelClass} p-4`}>
              <p className="text-[12px] font-bold text-[#7a8fa6]">{item.label}</p>
              <p className="mt-2 text-[22px] font-extrabold text-[#1e3261]">{item.value}</p>
            </article>
          ))}
        </section>
      ) : null}"""

    if kpi_old in text:
        text = text.replace(kpi_old, kpi_new)

    # Add reportKpiIconMap if missing
    if 'const reportKpiIconMap' not in text:
        insert_after = 'const reportKpiToneClasses = {'
        idx = text.find(insert_after)
        if idx != -1:
            end_brace = text.find('};', idx)
            map_block = """

const reportKpiIconMap = {
  blue: Users,
  green: UserPlus,
  amber: Phone,
  purple: MapPin,
  sky: Trophy,
  red: AlertTriangle,
  cyan: BarChart3,
};
"""
            text = text[: end_brace + 2] + map_block + text[end_brace + 2 :]

    APP.write_text(text, encoding='utf-8')
    print('Patched App.jsx successfully')


if __name__ == '__main__':
    main()
