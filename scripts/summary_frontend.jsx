// ── Executive Summary (cross-module dashboard) ────────────────────────────────

function SummaryPage({ activeSection, onOpenSection, onNotify }) {
  if (activeSection === 'Sales Pipeline') {
    return <SummarySalesPage activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
  }
  if (activeSection === 'Projects & Delivery') {
    return <SummaryProjectsPage activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
  }
  if (activeSection === 'Finance & Operations') {
    return <SummaryFinancePage activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
  }
  return <SummaryExecutivePage activeSection={activeSection || 'Executive Summary'} onOpenSection={onOpenSection} onNotify={onNotify} />;
}

function useSummaryData(onNotify) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      reportsApi.dashboard(),
      projectApi.summary(),
      accountsModuleApi.summary(),
      inventoryApi.summary(),
      amcModuleApi.summary(),
    ])
      .then(([dashboard, projects, accounts, inventory, amc]) => {
        setData({ dashboard, projects, accounts, inventory, amc });
      })
      .catch(() => onNotify('Could not load summary data.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading };
}

function SummaryMetricCard({ label, value, caption, tone = 'blue', icon: Icon, onClick }) {
  return (
    <button type="button" onClick={onClick} className={cx(panelClass, 'p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold text-[#7a8fa6]">{label}</p>
          <p className="mt-2 text-[22px] font-extrabold text-[#1e3261]">{value}</p>
          {caption ? <p className="mt-1 text-[11px] font-bold text-[#53647f]">{caption}</p> : null}
        </div>
        {Icon ? (
          <span className={cx('grid size-10 place-items-center rounded-[10px]', reportKpiToneClasses[tone] || reportKpiToneClasses.blue)}>
            <Icon className="size-5" />
          </span>
        ) : null}
      </div>
    </button>
  );
}

function SummaryExecutivePage({ activeSection, onOpenSection, onNotify }) {
  const { data, loading } = useSummaryData(onNotify);
  const dash = data?.dashboard;
  const accounts = data?.accounts;
  const projects = data?.projects;
  const inventory = data?.inventory;
  const amc = data?.amc;

  const heroCards = [
    { label: 'Total Leads', value: dash?.kpis?.[0]?.value ?? '—', caption: 'All time pipeline', tone: 'blue', icon: Users, onClick: () => onOpenSection('Lead List') },
    { label: 'Active Projects', value: projects?.active ?? '—', caption: `${projects?.total ?? 0} total projects`, tone: 'green', icon: FolderKanban, onClick: () => onOpenSection('Project List') },
    { label: 'Cash Received', value: accounts ? fmtAccRs(accounts.total_received) : '—', caption: 'Completed receipts', tone: 'cyan', icon: IndianRupee, onClick: () => onOpenSection('Payment Received') },
    { label: 'Bank Balance', value: accounts ? fmtAccRs(accounts.bank_balance) : '—', caption: `${accounts?.bank_count ?? 0} bank accounts`, tone: 'purple', icon: CreditCard, onClick: () => onOpenSection('Bank Accounts') },
    { label: 'Stock Value', value: inventory ? fmtAccRs(inventory.total_value) : '—', caption: `${inventory?.total_items ?? 0} products`, tone: 'amber', icon: Boxes, onClick: () => onOpenSection('Products') },
    { label: 'Active AMC', value: amc?.active_contracts ?? '—', caption: `${amc?.open_service_requests ?? 0} open requests`, tone: 'sky', icon: ShieldCheck, onClick: () => onOpenSection('AMC Contracts') },
  ];

  const ops = dash?.operations ?? {};
  const quickLinks = [
    { label: 'New Lead', section: 'Create Lead', icon: UserPlus, tone: 'green' },
    { label: 'Record Payment', section: 'Payment Received', icon: ReceiptText, tone: 'blue' },
    { label: 'Stock Inward', section: 'Stock Inward', icon: Download, tone: 'amber' },
    { label: 'O&M Tickets', section: 'Breakdown Tickets', icon: Wrench, tone: 'red' },
    { label: 'Full Reports', section: 'Reports', icon: BarChart3, tone: 'purple' },
  ];

  return (
    <div className="space-y-4">
      <PageHeading
        title="Executive Summary"
        crumbs={[
          { label: 'Dashboard', onClick: () => onOpenSection('Dashboard') },
          { label: 'Summary' },
          { label: 'Executive Summary' },
        ]}
      />
      <SummarySubnavTabs activeSection={activeSection} onOpenSection={onOpenSection} />

      {loading ? (
        <div className={cx(panelClass, 'flex items-center justify-center py-16 text-[14px] text-[#7a8fa6]')}>Loading executive summary...</div>
      ) : (
        <>
          <p className="text-[14px] font-bold text-[#324871]">
            Malwa Solar CRM ka live business snapshot — sales, projects, finance, inventory aur AMC ek jagah.
          </p>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {heroCards.map((card) => <SummaryMetricCard key={card.label} {...card} />)}
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Open O&M Tickets', value: ops.open_tickets ?? 0 },
              { label: 'Pending Tasks', value: ops.pending_tasks ?? 0 },
              { label: 'Low Stock Items', value: inventory?.low_stock ?? 0 },
              { label: 'Expiring AMC', value: amc?.expiring_contracts ?? 0 },
            ].map((item) => (
              <article key={item.label} className={`${panelClass} p-4`}>
                <p className="text-[12px] font-bold text-[#7a8fa6]">{item.label}</p>
                <p className="mt-2 text-[22px] font-extrabold text-[#1e3261]">{item.value}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {quickLinks.map((link) => (
              <button key={link.label} type="button" onClick={() => onOpenSection(link.section)} className={cx(panelClass, 'flex items-center gap-3 p-4 text-left transition hover:bg-[#f8fbff]')}>
                <span className={cx('grid size-10 place-items-center rounded-[10px]', reportKpiToneClasses[link.tone])}><link.icon className="size-5" /></span>
                <span className="text-[14px] font-extrabold text-[#1e3261]">{link.label}</span>
              </button>
            ))}
          </section>
        </>
      )}
      <DashboardFooter />
    </div>
  );
}

function SummarySalesPage({ activeSection, onOpenSection, onNotify }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi.leads()
      .then((data) => { if (data) setAnalytics(data); })
      .catch(() => onNotify('Could not load lead analytics.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cards = analytics ? [
    { label: 'Total Leads', value: String(analytics.total ?? 0), tone: 'blue', icon: Users },
    { label: 'Won', value: String(analytics.won ?? 0), tone: 'green', icon: Trophy },
    { label: 'Lost', value: String(analytics.lost ?? 0), tone: 'red', icon: XCircle },
    { label: 'Conversion', value: `${analytics.conversion_rate ?? 0}%`, tone: 'purple', icon: TrendingUp },
    { label: 'Overdue Follow-ups', value: String(analytics.overdue ?? 0), tone: 'amber', icon: Hourglass },
  ] : [];

  return (
    <div className="space-y-4">
      <PageHeading title="Sales Pipeline" crumbs={[{ label: 'Dashboard', onClick: () => onOpenSection('Dashboard') }, { label: 'Summary' }, { label: 'Sales Pipeline' }]} />
      <SummarySubnavTabs activeSection={activeSection} onOpenSection={onOpenSection} />
      {loading ? (
        <div className={cx(panelClass, 'py-16 text-center text-[14px] text-[#7a8fa6]')}>Loading...</div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {cards.map((c) => <SummaryMetricCard key={c.label} {...c} onClick={() => onOpenSection('Lead List')} />)}
          </section>
          <section className="grid gap-4 xl:grid-cols-2">
            <article className={`${panelClass} p-4 sm:p-5`}>
              <h2 className="font-display text-[18px] font-extrabold text-[#111827]">Leads Trend</h2>
              <ReportLineChart data={analytics?.monthly_trend ?? []} loading={false} />
            </article>
            <article className={`${panelClass} p-4 sm:p-5`}>
              <h2 className="font-display text-[18px] font-extrabold text-[#111827]">Leads by Status</h2>
              <ReportDonut data={analytics?.status_distribution ?? []} loading={false} />
            </article>
          </section>
        </>
      )}
      <DashboardFooter />
    </div>
  );
}

function SummaryProjectsPage({ activeSection, onOpenSection, onNotify }) {
  const [projects, setProjects] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    projectApi.summary()
      .then((data) => { if (data) setProjects(data); })
      .catch(() => onNotify('Could not load project summary.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cards = projects ? [
    { label: 'Total Projects', value: String(projects.total ?? 0), tone: 'blue', icon: FolderKanban },
    { label: 'Active', value: String(projects.active ?? 0), tone: 'green', icon: Zap },
    { label: 'Planning', value: String(projects.planning ?? 0), tone: 'amber', icon: ClipboardPlus },
    { label: 'On Hold', value: String(projects.on_hold ?? 0), tone: 'red', icon: PauseCircle },
    { label: 'Completed', value: String(projects.completed ?? 0), tone: 'purple', icon: CheckCircle2 },
  ] : [];

  return (
    <div className="space-y-4">
      <PageHeading title="Projects & Delivery" crumbs={[{ label: 'Dashboard', onClick: () => onOpenSection('Dashboard') }, { label: 'Summary' }, { label: 'Projects & Delivery' }]} />
      <SummarySubnavTabs activeSection={activeSection} onOpenSection={onOpenSection} />
      {loading ? (
        <div className={cx(panelClass, 'py-16 text-center text-[14px] text-[#7a8fa6]')}>Loading...</div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {cards.map((c) => <SummaryMetricCard key={c.label} {...c} onClick={() => onOpenSection('Project List')} />)}
          </section>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => onOpenSection('Project List')} className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#0b65e5] px-4 text-[13px] font-extrabold text-white"><FolderKanban className="size-4" />View All Projects</button>
            <button type="button" onClick={() => onOpenSection('Project KPI Analytics')} className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white px-4 text-[13px] font-extrabold text-[#284276]"><BarChart3 className="size-4" />KPI Analytics</button>
          </div>
        </>
      )}
      <DashboardFooter />
    </div>
  );
}

function SummaryFinancePage({ activeSection, onOpenSection, onNotify }) {
  const { data, loading } = useSummaryData(onNotify);
  const accounts = data?.accounts;
  const inventory = data?.inventory;
  const amc = data?.amc;

  const cards = [
    { label: 'Total Received', value: accounts ? fmtAccRs(accounts.total_received) : '—', tone: 'green', icon: TrendingUp, onClick: () => onOpenSection('Payment Received') },
    { label: 'Total Paid Out', value: accounts ? fmtAccRs(accounts.total_made) : '—', tone: 'red', icon: ReceiptText, onClick: () => onOpenSection('Payment Made') },
    { label: 'Net Cash Flow', value: accounts ? fmtAccRs(accounts.net_balance) : '—', tone: 'blue', icon: IndianRupee, onClick: () => onOpenSection('Accounts Overview') },
    { label: 'Inventory Value', value: inventory ? fmtAccRs(inventory.total_value) : '—', tone: 'amber', icon: Boxes, onClick: () => onOpenSection('Products') },
    { label: 'AMC Contract Value', value: amc ? fmtAccRs(amc.contract_value) : '—', tone: 'purple', icon: ShieldCheck, onClick: () => onOpenSection('AMC Contracts') },
    { label: 'Pending Cheques', value: accounts ? String(accounts.pending_cheques ?? 0) : '—', tone: 'cyan', icon: FileText, onClick: () => onOpenSection('Cheques List') },
  ];

  return (
    <div className="space-y-4">
      <PageHeading title="Finance & Operations" crumbs={[{ label: 'Dashboard', onClick: () => onOpenSection('Dashboard') }, { label: 'Summary' }, { label: 'Finance & Operations' }]} />
      <SummarySubnavTabs activeSection={activeSection} onOpenSection={onOpenSection} />
      {loading ? (
        <div className={cx(panelClass, 'py-16 text-center text-[14px] text-[#7a8fa6]')}>Loading...</div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => <SummaryMetricCard key={c.label} {...c} />)}
        </section>
      )}
      <DashboardFooter />
    </div>
  );
}
