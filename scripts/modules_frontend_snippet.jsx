// ── AMC & Warranty (popup-based module) ───────────────────────────────────────

const fmtAmcRs = (v) => (v != null && v !== '' ? `Rs ${Number(v).toLocaleString('en-IN')}` : '—');
const fmtInvRs = fmtAmcRs;

function AmcWarrantyPage({ activeSection, onOpenSection, onNotify }) {
  if (activeSection === 'Overview' || activeSection === 'AMC Overview') {
    return <AmcOverviewPage activeSection="Overview" onOpenSection={onOpenSection} onNotify={onNotify} />;
  }
  if (activeSection === 'AMC Contracts') {
    return <AmcContractsPage activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
  }
  if (activeSection === 'Warranties') {
    return <AmcWarrantiesCrudPage activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
  }
  if (activeSection === 'Service Requests') {
    return <AmcServiceRequestsCrudPage activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
  }
  if (activeSection === 'Visits / Maintenance') {
    return <AmcVisitsCrudPage activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
  }
  if (activeSection === 'Renewals') {
    return <AmcRenewalsCrudPage activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
  }
  if (activeSection === 'Claims') {
    return <AmcClaimsCrudPage activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
  }
  if (activeSection === 'AMC Documents') {
    return <AmcDocumentsCrudPage activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
  }
  return <AmcOverviewPage activeSection="Overview" onOpenSection={onOpenSection} onNotify={onNotify} />;
}

function AmcOverviewPage({ activeSection, onOpenSection, onNotify }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    amcModuleApi.summary()
      .then((data) => { if (data) setStats(data); })
      .catch(() => onNotify('Could not load AMC summary.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cards = stats ? [
    { label: 'Active Contracts', value: String(stats.active_contracts ?? 0), caption: 'Live AMC agreements', tone: 'green', icon: FileText, onClick: () => onOpenSection('AMC Contracts') },
    { label: 'Expiring Soon', value: String(stats.expiring_contracts ?? 0), caption: 'Renew within 30 days', tone: 'amber', icon: AlertTriangle, onClick: () => onOpenSection('Renewals') },
    { label: 'Open Requests', value: String(stats.open_service_requests ?? 0), caption: 'Service tickets open', tone: 'blue', icon: Wrench, onClick: () => onOpenSection('Service Requests') },
    { label: 'Scheduled Visits', value: String(stats.scheduled_visits ?? 0), caption: 'Upcoming maintenance', tone: 'purple', icon: CalendarDays, onClick: () => onOpenSection('Visits / Maintenance') },
    { label: 'Open Claims', value: String(stats.open_claims ?? 0), caption: 'Warranty claims pending', tone: 'red', icon: ShieldCheck, onClick: () => onOpenSection('Claims') },
    { label: 'Contract Value', value: fmtAmcRs(stats.contract_value), caption: 'Active AMC annual value', tone: 'cyan', icon: IndianRupee, onClick: () => onOpenSection('AMC Contracts') },
  ] : [];

  return (
    <div className="space-y-4">
      <PageHeading title="AMC & Warranty" crumbs={[{ label: 'Dashboard', onClick: () => onOpenSection('Dashboard') }, { label: 'AMC & Warranty' }, { label: 'Overview' }]} />
      <AmcSubnavTabs activeSection={activeSection} onOpenSection={onOpenSection} />
      {loading ? (
        <div className={cx(panelClass, 'flex items-center justify-center py-16 text-[14px] text-[#7a8fa6]')}>Loading overview...</div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {cards.map((card) => (
            <button key={card.label} type="button" onClick={card.onClick} className={cx(panelClass, 'p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg')}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-bold text-[#7a8fa6]">{card.label}</p>
                  <p className="mt-2 text-[22px] font-extrabold text-[#1e3261]">{card.value}</p>
                  <p className="mt-1 text-[11px] font-bold text-[#53647f]">{card.caption}</p>
                </div>
                <span className={cx('grid size-10 place-items-center rounded-[10px]', reportKpiToneClasses[card.tone] || reportKpiToneClasses.blue)}>
                  <card.icon className="size-5" />
                </span>
              </div>
            </button>
          ))}
        </section>
      )}
      <DashboardFooter />
    </div>
  );
}

function AmcContractsPage({ activeSection, onOpenSection, onNotify }) {
  const config = {
    moduleTitle: 'AMC & Warranty',
    Subnav: AmcSubnavTabs,
    title: 'AMC Contracts',
    recordLabel: 'AMC Contract',
    newLabel: 'New AMC Contract',
    api: amcModuleApi.contracts,
    statuses: ['Active', 'Expiring Soon', 'Expired', 'Cancelled'],
    extraFilters: [{ key: 'contract_type', label: 'All Types', options: ['Comprehensive', 'Non-Comprehensive'] }],
    searchKeys: ['customer_name', 'site'],
    lookups: { projects: { api: projectApi, label: (p) => `${p.project_id} — ${p.project_name}` } },
    columns: [
      { label: 'Contract No', render: (r) => <span className="font-extrabold text-[#0b65e5]">{r.record_no}</span> },
      { label: 'Customer', render: (r) => r.customer_name },
      { label: 'Project', render: (r) => r.project_name || '—' },
      { label: 'Type', render: (r) => r.contract_type },
      { label: 'End Date', render: (r) => lcFormatDate(r.end_date) },
      { label: 'Value', render: (r) => fmtAmcRs(r.annual_value) },
      { label: 'Status', render: (r) => <LcStatusBadge status={r.status} /> },
    ],
    fields: [
      { name: 'project', label: 'Project', type: 'lookup', lookup: 'projects' },
      { name: 'customer_name', label: 'Customer Name', type: 'text', required: true },
      { name: 'site', label: 'Site', type: 'text' },
      { name: 'contract_type', label: 'Contract Type', type: 'select', options: ['Comprehensive', 'Non-Comprehensive'] },
      { name: 'start_date', label: 'Start Date', type: 'date' },
      { name: 'end_date', label: 'End Date', type: 'date' },
      { name: 'next_renewal_date', label: 'Next Renewal', type: 'date' },
      { name: 'annual_value', label: 'Annual Value (Rs)', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Expiring Soon', 'Expired', 'Cancelled'] },
      { name: 'remarks', label: 'Remarks', type: 'textarea' },
    ],
    defaults: { project: '', customer_name: '', site: '', contract_type: 'Comprehensive', start_date: '', end_date: '', next_renewal_date: '', annual_value: '', status: 'Active', remarks: '' },
    detailRows: [
      ['Contract No', (r) => r.record_no],
      ['Customer', (r) => r.customer_name],
      ['Project', (r) => r.project_name || '—'],
      ['Site', (r) => r.site || '—'],
      ['Type', (r) => r.contract_type],
      ['Period', (r) => `${lcFormatDate(r.start_date)} → ${lcFormatDate(r.end_date)}`],
      ['Annual Value', (r) => fmtAmcRs(r.annual_value)],
      ['Next Renewal', (r) => lcFormatDate(r.next_renewal_date)],
      ['Remarks', (r) => r.remarks || '—', true],
    ],
  };
  return <LiaisonCrudPage config={config} activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
}

function AmcWarrantiesCrudPage({ activeSection, onOpenSection, onNotify }) {
  const config = {
    moduleTitle: 'AMC & Warranty', Subnav: AmcSubnavTabs, title: 'Warranties', recordLabel: 'Warranty', newLabel: 'Register Warranty',
    api: amcModuleApi.warranties, statuses: ['Active', 'Expiring Soon', 'Expired', 'Claimed'],
    searchKeys: ['asset_type', 'manufacturer', 'serial_number'],
    lookups: { projects: { api: projectApi, label: (p) => `${p.project_id} — ${p.project_name}` } },
    columns: [
      { label: 'Warranty No', render: (r) => <span className="font-extrabold text-[#0b65e5]">{r.record_no}</span> },
      { label: 'Project', render: (r) => r.project_name || '—' },
      { label: 'Asset', render: (r) => r.asset_type || '—' },
      { label: 'Serial No', render: (r) => r.serial_number || '—' },
      { label: 'Valid Till', render: (r) => lcFormatDate(r.warranty_end) },
      { label: 'Status', render: (r) => <LcStatusBadge status={r.status} /> },
    ],
    fields: [
      { name: 'project', label: 'Project', type: 'lookup', lookup: 'projects' },
      { name: 'asset_type', label: 'Asset Type', type: 'text' },
      { name: 'manufacturer', label: 'Manufacturer', type: 'text' },
      { name: 'serial_number', label: 'Serial Number', type: 'text' },
      { name: 'warranty_start', label: 'Start Date', type: 'date' },
      { name: 'warranty_end', label: 'End Date', type: 'date' },
      { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Expiring Soon', 'Expired', 'Claimed'] },
      { name: 'coverage_details', label: 'Coverage Details', type: 'textarea' },
    ],
    defaults: { project: '', asset_type: '', manufacturer: '', serial_number: '', warranty_start: '', warranty_end: '', status: 'Active', coverage_details: '' },
    detailRows: [
      ['Warranty No', (r) => r.record_no], ['Project', (r) => r.project_name || '—'], ['Asset', (r) => r.asset_type || '—'],
      ['Manufacturer', (r) => r.manufacturer || '—'], ['Serial', (r) => r.serial_number || '—'],
      ['Period', (r) => `${lcFormatDate(r.warranty_start)} → ${lcFormatDate(r.warranty_end)}`],
      ['Coverage', (r) => r.coverage_details || '—', true],
    ],
  };
  return <LiaisonCrudPage config={config} activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
}

function AmcServiceRequestsCrudPage({ activeSection, onOpenSection, onNotify }) {
  const config = {
    moduleTitle: 'AMC & Warranty', Subnav: AmcSubnavTabs, title: 'Service Requests', recordLabel: 'Service Request', newLabel: 'New Request',
    api: amcModuleApi.serviceRequests, statuses: ['Open', 'In Progress', 'Resolved', 'Closed'],
    extraFilters: [{ key: 'priority', label: 'All Priority', options: ['Low', 'Medium', 'High'] }],
    searchKeys: ['subject', 'assigned_engineer'],
    lookups: {
      projects: { api: projectApi, label: (p) => `${p.project_id} — ${p.project_name}` },
      contracts: { api: amcModuleApi.contracts, label: (c) => c.record_no },
    },
    columns: [
      { label: 'Request No', render: (r) => <span className="font-extrabold text-[#0b65e5]">{r.record_no}</span> },
      { label: 'Subject', render: (r) => r.subject },
      { label: 'Project', render: (r) => r.project_name || '—' },
      { label: 'Priority', render: (r) => r.priority },
      { label: 'Engineer', render: (r) => r.assigned_engineer || '—' },
      { label: 'Status', render: (r) => <LcStatusBadge status={r.status} /> },
    ],
    fields: [
      { name: 'project', label: 'Project', type: 'lookup', lookup: 'projects' },
      { name: 'contract', label: 'AMC Contract', type: 'lookup', lookup: 'contracts' },
      { name: 'subject', label: 'Subject', type: 'text', required: true },
      { name: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Medium', 'High'] },
      { name: 'requested_date', label: 'Requested Date', type: 'date' },
      { name: 'assigned_engineer', label: 'Assigned Engineer', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: ['Open', 'In Progress', 'Resolved', 'Closed'] },
      { name: 'description', label: 'Description', type: 'textarea' },
    ],
    defaults: { project: '', contract: '', subject: '', priority: 'Medium', requested_date: '', assigned_engineer: '', status: 'Open', description: '' },
    detailRows: [
      ['Request No', (r) => r.record_no], ['Subject', (r) => r.subject], ['Project', (r) => r.project_name || '—'],
      ['Contract', (r) => r.contract_no || '—'], ['Priority', (r) => r.priority], ['Engineer', (r) => r.assigned_engineer || '—'],
      ['Description', (r) => r.description || '—', true],
    ],
  };
  return <LiaisonCrudPage config={config} activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
}

function AmcVisitsCrudPage({ activeSection, onOpenSection, onNotify }) {
  const config = {
    moduleTitle: 'AMC & Warranty', Subnav: AmcSubnavTabs, title: 'Visits / Maintenance', recordLabel: 'Visit', newLabel: 'Schedule Visit',
    api: amcModuleApi.visits, statuses: ['Scheduled', 'Completed', 'Cancelled'],
    searchKeys: ['engineer', 'findings'],
    lookups: { projects: { api: projectApi, label: (p) => `${p.project_id} — ${p.project_name}` } },
    columns: [
      { label: 'Visit No', render: (r) => <span className="font-extrabold text-[#0b65e5]">{r.record_no}</span> },
      { label: 'Project', render: (r) => r.project_name || '—' },
      { label: 'Date', render: (r) => lcFormatDate(r.visit_date) },
      { label: 'Type', render: (r) => r.visit_type },
      { label: 'Engineer', render: (r) => r.engineer || '—' },
      { label: 'Status', render: (r) => <LcStatusBadge status={r.status} /> },
    ],
    fields: [
      { name: 'project', label: 'Project', type: 'lookup', lookup: 'projects' },
      { name: 'visit_date', label: 'Visit Date', type: 'date', required: true },
      { name: 'visit_type', label: 'Visit Type', type: 'select', options: ['Preventive', 'Corrective', 'Inspection'] },
      { name: 'engineer', label: 'Engineer', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: ['Scheduled', 'Completed', 'Cancelled'] },
      { name: 'findings', label: 'Findings', type: 'textarea' },
    ],
    defaults: { project: '', visit_date: '', visit_type: 'Preventive', engineer: '', status: 'Scheduled', findings: '' },
    detailRows: [
      ['Visit No', (r) => r.record_no], ['Project', (r) => r.project_name || '—'], ['Date', (r) => lcFormatDate(r.visit_date)],
      ['Type', (r) => r.visit_type], ['Engineer', (r) => r.engineer || '—'], ['Findings', (r) => r.findings || '—', true],
    ],
  };
  return <LiaisonCrudPage config={config} activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
}

function AmcRenewalsCrudPage({ activeSection, onOpenSection, onNotify }) {
  const config = {
    moduleTitle: 'AMC & Warranty', Subnav: AmcSubnavTabs, title: 'Renewals', recordLabel: 'Renewal', newLabel: 'Record Renewal',
    api: amcModuleApi.renewals, statuses: ['Pending', 'Completed', 'Cancelled'],
    searchKeys: ['remarks'],
    lookups: { contracts: { api: amcModuleApi.contracts, label: (c) => `${c.record_no} — ${c.customer_name}` } },
    columns: [
      { label: 'Renewal No', render: (r) => <span className="font-extrabold text-[#0b65e5]">{r.record_no}</span> },
      { label: 'Contract', render: (r) => r.contract_no },
      { label: 'Customer', render: (r) => r.customer_name || '—' },
      { label: 'Renewal Date', render: (r) => lcFormatDate(r.renewal_date) },
      { label: 'New End', render: (r) => lcFormatDate(r.new_end_date) },
      { label: 'Amount', render: (r) => fmtAmcRs(r.amount) },
      { label: 'Status', render: (r) => <LcStatusBadge status={r.status} /> },
    ],
    fields: [
      { name: 'contract', label: 'AMC Contract', type: 'lookup', lookup: 'contracts', required: true },
      { name: 'renewal_date', label: 'Renewal Date', type: 'date' },
      { name: 'new_end_date', label: 'New End Date', type: 'date' },
      { name: 'amount', label: 'Amount (Rs)', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'Completed', 'Cancelled'] },
      { name: 'remarks', label: 'Remarks', type: 'textarea' },
    ],
    defaults: { contract: '', renewal_date: '', new_end_date: '', amount: '', status: 'Pending', remarks: '' },
    detailRows: [
      ['Renewal No', (r) => r.record_no], ['Contract', (r) => r.contract_no], ['Customer', (r) => r.customer_name || '—'],
      ['Renewal Date', (r) => lcFormatDate(r.renewal_date)], ['New End', (r) => lcFormatDate(r.new_end_date)],
      ['Amount', (r) => fmtAmcRs(r.amount)], ['Remarks', (r) => r.remarks || '—', true],
    ],
  };
  return <LiaisonCrudPage config={config} activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
}

function AmcClaimsCrudPage({ activeSection, onOpenSection, onNotify }) {
  const config = {
    moduleTitle: 'AMC & Warranty', Subnav: AmcSubnavTabs, title: 'Claims', recordLabel: 'Claim', newLabel: 'File Claim',
    api: amcModuleApi.claims, statuses: ['Submitted', 'Under Review', 'Approved', 'Rejected', 'Paid'],
    searchKeys: ['description'],
    lookups: {
      projects: { api: projectApi, label: (p) => `${p.project_id} — ${p.project_name}` },
      warranties: { api: amcModuleApi.warranties, label: (w) => w.record_no },
    },
    columns: [
      { label: 'Claim No', render: (r) => <span className="font-extrabold text-[#0b65e5]">{r.record_no}</span> },
      { label: 'Project', render: (r) => r.project_name || '—' },
      { label: 'Date', render: (r) => lcFormatDate(r.claim_date) },
      { label: 'Amount', render: (r) => fmtAmcRs(r.claim_amount) },
      { label: 'Status', render: (r) => <LcStatusBadge status={r.status} /> },
    ],
    fields: [
      { name: 'project', label: 'Project', type: 'lookup', lookup: 'projects' },
      { name: 'warranty', label: 'Warranty', type: 'lookup', lookup: 'warranties' },
      { name: 'claim_date', label: 'Claim Date', type: 'date' },
      { name: 'claim_amount', label: 'Claim Amount (Rs)', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['Submitted', 'Under Review', 'Approved', 'Rejected', 'Paid'] },
      { name: 'description', label: 'Description', type: 'textarea' },
    ],
    defaults: { project: '', warranty: '', claim_date: '', claim_amount: '', status: 'Submitted', description: '' },
    detailRows: [
      ['Claim No', (r) => r.record_no], ['Project', (r) => r.project_name || '—'], ['Warranty', (r) => r.warranty_no || '—'],
      ['Date', (r) => lcFormatDate(r.claim_date)], ['Amount', (r) => fmtAmcRs(r.claim_amount)], ['Description', (r) => r.description || '—', true],
    ],
  };
  return <LiaisonCrudPage config={config} activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
}

function AmcDocumentsCrudPage({ activeSection, onOpenSection, onNotify }) {
  const config = {
    moduleTitle: 'AMC & Warranty', Subnav: AmcSubnavTabs, title: 'AMC Documents', recordLabel: 'Document', newLabel: 'Upload Document',
    api: amcModuleApi.documents, statuses: [],
    searchKeys: ['name', 'category'],
    lookups: {
      projects: { api: projectApi, label: (p) => `${p.project_id} — ${p.project_name}` },
      contracts: { api: amcModuleApi.contracts, label: (c) => c.record_no },
    },
    columns: [
      { label: 'Doc No', render: (r) => <span className="font-extrabold text-[#0b65e5]">{r.record_no}</span> },
      { label: 'Name', render: (r) => r.name },
      { label: 'Type', render: (r) => r.document_type },
      { label: 'Project', render: (r) => r.project_name || '—' },
      { label: 'Uploaded', render: (r) => lcFormatDate(r.created_at) },
    ],
    fields: [
      { name: 'name', label: 'Document Name', type: 'text', required: true },
      { name: 'document_type', label: 'Type', type: 'select', options: ['Contract', 'Warranty', 'Invoice', 'Service Report', 'Receipt', 'Other'] },
      { name: 'category', label: 'Category', type: 'text' },
      { name: 'project', label: 'Project', type: 'lookup', lookup: 'projects' },
      { name: 'contract', label: 'AMC Contract', type: 'lookup', lookup: 'contracts' },
      { name: 'remarks', label: 'Remarks', type: 'textarea' },
    ],
    defaults: { name: '', document_type: 'Contract', category: '', project: '', contract: '', remarks: '' },
    detailRows: [
      ['Doc No', (r) => r.record_no], ['Name', (r) => r.name], ['Type', (r) => r.document_type],
      ['Project', (r) => r.project_name || '—'], ['Contract', (r) => r.contract_no || '—'],
      ['Uploaded By', (r) => r.uploaded_by_name || '—'], ['Remarks', (r) => r.remarks || '—', true],
    ],
  };
  return <LiaisonCrudPage config={config} activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
}

// ── Inventory (popup-based module) ────────────────────────────────────────────

const INV_CATEGORIES = ['Solar Panel', 'Inverter', 'Battery', 'Structure', 'Cable & Wire', 'ACDB/DCDB', 'Other'];
const INV_UNITS = ['Nos', 'Meter', 'Kg', 'Roll', 'Set'];

function InventoryManagementPage({ activeSection, onOpenSection, onNotify }) {
  if (activeSection === 'Overview') {
    return <InventoryOverviewPage activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
  }
  if (activeSection === 'Products') {
    return <InventoryProductsCrudPage activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
  }
  if (activeSection === 'Stock Inward') {
    return <InventoryMovementPage movementType="Inward" activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
  }
  if (activeSection === 'Stock Outward') {
    return <InventoryMovementPage movementType="Outward" activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
  }
  if (activeSection === 'Stock Transfer') {
    return <InventoryMovementPage movementType="Transfer" activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
  }
  if (activeSection === 'Adjustments') {
    return <InventoryMovementPage movementType="Adjustment" activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
  }
  if (activeSection === 'Warehouses') {
    return <InventoryWarehousesCrudPage activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
  }
  return <InventoryOverviewPage activeSection="Overview" onOpenSection={onOpenSection} onNotify={onNotify} />;
}

function InventoryOverviewPage({ activeSection, onOpenSection, onNotify }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    inventoryApi.summary()
      .then((data) => { if (data) setStats(data); })
      .catch(() => onNotify('Could not load inventory summary.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cards = stats ? [
    { label: 'Total Products', value: String(stats.total_items ?? 0), caption: 'Active SKUs', tone: 'blue', icon: Boxes, onClick: () => onOpenSection('Products') },
    { label: 'Low Stock', value: String(stats.low_stock ?? 0), caption: 'Below minimum level', tone: 'amber', icon: AlertTriangle, onClick: () => onOpenSection('Products') },
    { label: 'Out of Stock', value: String(stats.out_of_stock ?? 0), caption: 'Needs restock', tone: 'red', icon: AlertTriangle, onClick: () => onOpenSection('Stock Inward') },
    { label: 'Stock Value', value: fmtInvRs(stats.total_value), caption: 'Current inventory value', tone: 'green', icon: IndianRupee, onClick: () => onOpenSection('Products') },
  ] : [];

  return (
    <div className="space-y-4">
      <PageHeading title="Inventory" crumbs={[{ label: 'Dashboard', onClick: () => onOpenSection('Dashboard') }, { label: 'Inventory' }, { label: 'Overview' }]} />
      <InventorySubnavTabs activeSection={activeSection} onOpenSection={onOpenSection} />
      {loading ? (
        <div className={cx(panelClass, 'flex items-center justify-center py-16 text-[14px] text-[#7a8fa6]')}>Loading overview...</div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <button key={card.label} type="button" onClick={card.onClick} className={cx(panelClass, 'p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg')}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-bold text-[#7a8fa6]">{card.label}</p>
                    <p className="mt-2 text-[22px] font-extrabold text-[#1e3261]">{card.value}</p>
                    <p className="mt-1 text-[11px] font-bold text-[#53647f]">{card.caption}</p>
                  </div>
                  <span className={cx('grid size-10 place-items-center rounded-[10px]', reportKpiToneClasses[card.tone] || reportKpiToneClasses.blue)}>
                    <card.icon className="size-5" />
                  </span>
                </div>
              </button>
            ))}
          </section>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Stock Inward', section: 'Stock Inward', icon: Download, tone: 'green' },
              { label: 'Stock Outward', section: 'Stock Outward', icon: Upload, tone: 'red' },
              { label: 'Transfer Stock', section: 'Stock Transfer', icon: RefreshCw, tone: 'blue' },
              { label: 'Add Product', section: 'Products', icon: Plus, tone: 'purple' },
            ].map((action) => (
              <button key={action.label} type="button" onClick={() => onOpenSection(action.section)} className={cx(panelClass, 'flex items-center gap-3 p-4 text-left transition hover:bg-[#f8fbff]')}>
                <span className={cx('grid size-10 place-items-center rounded-[10px]', reportKpiToneClasses[action.tone])}><action.icon className="size-5" /></span>
                <span className="text-[14px] font-extrabold text-[#1e3261]">{action.label}</span>
              </button>
            ))}
          </section>
        </>
      )}
      <DashboardFooter />
    </div>
  );
}

function InventoryProductsCrudPage({ activeSection, onOpenSection, onNotify }) {
  const config = {
    moduleTitle: 'Inventory', Subnav: InventorySubnavTabs, title: 'Products', recordLabel: 'Product', newLabel: 'Add Product',
    api: inventoryApi.items,
    extraFilters: [
      { key: 'category', label: 'All Categories', options: INV_CATEGORIES, client: false },
      { key: 'stock_status', label: 'All Status', options: ['In Stock', 'Low Stock', 'Out of Stock'], client: true },
    ],
    searchKeys: ['name', 'hsn_code'],
    lookups: { warehouses: { api: inventoryApi.warehouses, label: (w) => w.name } },
    columns: [
      { label: 'Product', render: (r) => <span className="font-semibold text-[#1e2a38]">{r.name}</span> },
      { label: 'Category', render: (r) => r.category },
      { label: 'HSN', render: (r) => r.hsn_code || '—' },
      { label: 'Stock', render: (r) => r.current_stock },
      { label: 'Rate', render: (r) => fmtInvRs(r.rate) },
      { label: 'Warehouse', render: (r) => r.warehouse_name || '—' },
      { label: 'Status', render: (r) => <LcStatusBadge status={r.stock_status} /> },
    ],
    fields: [
      { name: 'name', label: 'Product Name', type: 'text', required: true },
      { name: 'category', label: 'Category', type: 'select', options: INV_CATEGORIES },
      { name: 'unit', label: 'Unit', type: 'select', options: INV_UNITS },
      { name: 'hsn_code', label: 'HSN Code', type: 'text' },
      { name: 'rate', label: 'Rate (Rs)', type: 'number' },
      { name: 'current_stock', label: 'Opening Stock', type: 'number' },
      { name: 'minimum_stock', label: 'Minimum Stock', type: 'number' },
      { name: 'warehouse', label: 'Warehouse', type: 'lookup', lookup: 'warehouses' },
      { name: 'is_active', label: 'Status', type: 'activeFlag' },
    ],
    defaults: { name: '', category: 'Other', unit: 'Nos', hsn_code: '', rate: '', current_stock: '', minimum_stock: '', warehouse: '', is_active: 'Active' },
    detailRows: [
      ['Product No', (r) => r.record_no], ['Name', (r) => r.name], ['Category', (r) => r.category],
      ['Unit', (r) => r.unit], ['HSN', (r) => r.hsn_code || '—'], ['Stock', (r) => r.current_stock],
      ['Min Stock', (r) => r.minimum_stock], ['Rate', (r) => fmtInvRs(r.rate)], ['Warehouse', (r) => r.warehouse_name || '—'],
    ],
  };
  return <LiaisonCrudPage config={config} activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
}

function InventoryMovementPage({ movementType, activeSection, onOpenSection, onNotify }) {
  const titles = { Inward: 'Stock Inward', Outward: 'Stock Outward', Transfer: 'Stock Transfer', Adjustment: 'Adjustments' };
  const isInward = movementType === 'Inward';
  const isOutward = movementType === 'Outward';
  const isTransfer = movementType === 'Transfer';
  const isAdjustment = movementType === 'Adjustment';

  const config = {
    moduleTitle: 'Inventory', Subnav: InventorySubnavTabs, title: titles[movementType], recordLabel: 'Movement', newLabel: `New ${titles[movementType]}`,
    api: inventoryApi.movements, listParams: { movement_type: movementType }, fixedFields: { movement_type: movementType },
    searchKeys: ['reference', 'notes', 'item_name'],
    lookups: {
      items: { api: inventoryApi.items, label: (i) => i.name },
      warehouses: { api: inventoryApi.warehouses, label: (w) => w.name },
    },
    columns: [
      { label: 'Ref No', render: (r) => <span className="font-extrabold text-[#0b65e5]">{r.record_no}</span> },
      { label: 'Item', render: (r) => r.item_name },
      { label: 'Qty', render: (r) => r.quantity },
      { label: 'From', render: (r) => r.from_warehouse_name || '—' },
      { label: 'To', render: (r) => r.to_warehouse_name || '—' },
      { label: 'Date', render: (r) => lcFormatDate(r.created_at) },
    ],
    fields: [
      { name: 'item', label: 'Product', type: 'lookup', lookup: 'items', required: true },
      { name: 'quantity', label: 'Quantity', type: 'number', required: true },
      { name: 'rate', label: 'Rate (Rs)', type: 'number' },
      ...(isInward || isAdjustment ? [{ name: 'to_warehouse', label: isAdjustment ? 'Adjust To Warehouse' : 'To Warehouse', type: 'lookup', lookup: 'warehouses', required: isInward }] : []),
      ...(isOutward || isAdjustment ? [{ name: 'from_warehouse', label: isAdjustment ? 'Adjust From Warehouse' : 'From Warehouse', type: 'lookup', lookup: 'warehouses', required: isOutward }] : []),
      ...(isTransfer ? [
        { name: 'from_warehouse', label: 'From Warehouse', type: 'lookup', lookup: 'warehouses', required: true },
        { name: 'to_warehouse', label: 'To Warehouse', type: 'lookup', lookup: 'warehouses', required: true },
      ] : []),
      { name: 'reference', label: 'Reference / PO No', type: 'text' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    defaults: { item: '', quantity: '', rate: '', from_warehouse: '', to_warehouse: '', reference: '', notes: '' },
    detailRows: [
      ['Ref No', (r) => r.record_no], ['Item', (r) => r.item_name], ['Quantity', (r) => r.quantity],
      ['From', (r) => r.from_warehouse_name || '—'], ['To', (r) => r.to_warehouse_name || '—'],
      ['Reference', (r) => r.reference || '—'], ['Notes', (r) => r.notes || '—', true],
    ],
  };
  return <LiaisonCrudPage config={config} activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
}

function InventoryWarehousesCrudPage({ activeSection, onOpenSection, onNotify }) {
  const config = {
    moduleTitle: 'Inventory', Subnav: InventorySubnavTabs, title: 'Warehouses', recordLabel: 'Warehouse', newLabel: 'Add Warehouse',
    api: inventoryApi.warehouses, searchKeys: ['name', 'location'],
    columns: [
      { label: 'Code', render: (r) => <span className="font-extrabold text-[#0b65e5]">{r.record_no}</span> },
      { label: 'Name', render: (r) => r.name },
      { label: 'Location', render: (r) => r.location || '—' },
      { label: 'Status', render: (r) => <LcStatusBadge status={r.is_active ? 'Active' : 'Inactive'} /> },
    ],
    fields: [
      { name: 'name', label: 'Warehouse Name', type: 'text', required: true },
      { name: 'location', label: 'Location', type: 'text' },
      { name: 'is_active', label: 'Status', type: 'activeFlag' },
    ],
    defaults: { name: '', location: '', is_active: 'Active' },
    detailRows: [['Code', (r) => r.record_no], ['Name', (r) => r.name], ['Location', (r) => r.location || '—']],
  };
  return <LiaisonCrudPage config={config} activeSection={activeSection} onOpenSection={onOpenSection} onNotify={onNotify} />;
}
