"""Wire settings pages to backend API."""

from pathlib import Path

path = Path(__file__).resolve().parents[1] / "src" / "App.jsx"
text = path.read_text(encoding="utf-8")

payment_mode_page = '''
function PaymentModeListPage({ onOpenSection, onNotify }) {
  const config = {
    moduleTitle: 'Settings',
    title: 'Payment Mode',
    recordLabel: 'Payment Mode',
    newLabel: 'Add Payment Mode',
    api: settingsApi.paymentModes,
    searchKeys: ['name', 'code'],
    columns: [
      { label: 'Code', render: (r) => <span className="font-extrabold text-[#0b65e5]">{r.code}</span> },
      { label: 'Name', render: (r) => r.name },
      { label: 'Description', render: (r) => r.description || '—' },
      { label: 'Status', render: (r) => <LcStatusBadge status={r.is_active ? 'Active' : 'Inactive'} /> },
    ],
    fields: [
      { name: 'code', label: 'Code', type: 'text', required: true },
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'sort_order', label: 'Sort Order', type: 'number' },
      { name: 'is_active', label: 'Status', type: 'activeFlag' },
    ],
    defaults: { code: '', name: '', description: '', sort_order: '0', is_active: 'Active' },
    detailRows: [
      ['Code', (r) => r.code],
      ['Name', (r) => r.name],
      ['Description', (r) => r.description || '—', true],
      ['Sort Order', (r) => String(r.sort_order ?? 0)],
    ],
  };

  return (
    <div className="space-y-4">
      <PageHeading
        title="Payment Mode"
        crumbs={[
          { label: 'Dashboard', onClick: () => onOpenSection('Dashboard') },
          { label: 'Settings', onClick: () => onOpenSection('Settings') },
          { label: 'Payment Mode' },
        ]}
      />
      <LiaisonCrudPage config={config} activeSection="Payment Mode" onOpenSection={onOpenSection} onNotify={onNotify} />
      <DashboardFooter />
    </div>
  );
}

'''

marker = "function SettingsMasterPage({ activeSection, onOpenSection, onNotify }) {"
if "function PaymentModeListPage" not in text:
    if marker not in text:
        raise SystemExit("SettingsMasterPage marker not found")
    text = text.replace(marker, payment_mode_page + marker, 1)

# Company profile load/save
old_company = """function CompanyProfileSettingsPage({ onOpenSection, onNotify }) {
  const [form, setForm] = useState({"""

new_company = """function CompanyProfileSettingsPage({ onOpenSection, onNotify }) {
  const defaultCompanyForm = {"""

if old_company not in text:
    raise SystemExit("CompanyProfileSettingsPage not found")
text = text.replace(old_company, new_company, 1)

old_company_end = """  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const summaryItems = ["""

new_company_end = """  const [form, setForm] = useState(defaultCompanyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi.company.get()
      .then((res) => {
        if (res?.data && Object.keys(res.data).length) {
          setForm((current) => ({ ...current, ...res.data }));
        }
      })
      .catch(() => onNotify('Could not load company profile.', 'error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveProfile = async () => {
    setSaving(true);
    try {
      await settingsApi.company.update({ data: form });
      onNotify('Company profile saved');
    } catch {
      onNotify('Could not save company profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const summaryItems = ["""

if old_company_end not in text:
    raise SystemExit("CompanyProfile updateField block not found")
text = text.replace(old_company_end, new_company_end, 1)

text = text.replace(
    "onClick={() => onNotify('Company profile saved')} className=\"inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[#078c3e] px-5 text-[13px] font-extrabold text-white shadow-[0_12px_22px_rgba(13,159,74,0.22)] transition hover:bg-[#067832] min-[460px]:w-auto\"><Save className=\"size-4\" />Save Changes</button>",
    "onClick={saveProfile} disabled={saving} className=\"inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[#078c3e] px-5 text-[13px] font-extrabold text-white shadow-[0_12px_22px_rgba(13,159,74,0.22)] transition hover:bg-[#067832] disabled:opacity-60 min-[460px]:w-auto\"><Save className=\"size-4\" />{saving ? 'Saving...' : 'Save Changes'}</button>",
    2,
)

# System settings load/save
old_system = """function SystemSettingsPage({ onOpenSection, onNotify }) {
  const [activeTab, setActiveTab] = useState('General');
  const [form, setForm] = useState({"""

new_system = """function SystemSettingsPage({ onOpenSection, onNotify }) {
  const [activeTab, setActiveTab] = useState('General');
  const defaultSystemForm = {"""

text = text.replace(old_system, new_system, 1)

old_system_end = """  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const tabs = ['General', 'Security', 'Email', 'Notifications', 'Backup', 'API Settings', 'Other'];"""

new_system_end = """  const [form, setForm] = useState(defaultSystemForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi.system.get()
      .then((res) => {
        if (res && typeof res === 'object') {
          setForm((current) => ({ ...current, ...res }));
        }
      })
      .catch(() => {});
  }, []);

  const saveSystemSettings = async () => {
    setSaving(true);
    try {
      await settingsApi.system.update(form);
      onNotify('System settings saved');
    } catch {
      onNotify('Could not save system settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const tabs = ['General', 'Security', 'Email', 'Notifications', 'Backup', 'API Settings', 'Other'];"""

text = text.replace(old_system_end, new_system_end, 1)

# Branch management API
old_branch = """function BranchManagementSettingsPage({ onOpenSection, onNotify }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All Status');

  const rows = [
    { id: 1, name: 'Head Office', code: 'HO-001', location: 'Ludhiana, Punjab', contact: '+91 98765 43210', email: 'info@malwasolar.com', status: 'Active' },
    { id: 2, name: 'Delhi Branch', code: 'DL-002', location: 'New Delhi, Delhi', contact: '+91 98765 43211', email: 'delhi@malwasolar.com', status: 'Active' },
    { id: 3, name: 'Chandigarh Branch', code: 'CH-003', location: 'Chandigarh, Punjab', contact: '+91 98765 43212', email: 'chandigarh@malwasolar.com', status: 'Active' },
    { id: 4, name: 'Jaipur Branch', code: 'RJ-004', location: 'Jaipur, Rajasthan', contact: '+91 98765 43213', email: 'jaipur@malwasolar.com', status: 'Active' },
    { id: 5, name: 'Indore Branch', code: 'MP-005', location: 'Indore, Madhya Pradesh', contact: '+91 98765 43214', email: 'indore@malwasolar.com', status: 'Active' },
    { id: 6, name: 'Bangalore Branch', code: 'KA-006', location: 'Bangalore, Karnataka', contact: '+91 98765 43215', email: 'bangalore@malwasolar.com', status: 'Active' },
    { id: 7, name: 'Ahmedabad Branch', code: 'GJ-007', location: 'Ahmedabad, Gujarat', contact: '+91 98765 43216', email: 'ahmedabad@malwasolar.com', status: 'Inactive' },
    { id: 8, name: 'Lucknow Branch', code: 'UP-008', location: 'Lucknow, Uttar Pradesh', contact: '+91 98765 43217', email: 'lucknow@malwasolar.com', status: 'Active' },
  ];

  const filteredRows = rows.filter((row) => {
    const queryMatch = [row.name, row.code, row.location, row.email].some((value) => value.toLowerCase().includes(query.toLowerCase()));
    const statusMatch = status === 'All Status' || row.status === status;
    return queryMatch && statusMatch;
  });"""

new_branch = """function BranchManagementSettingsPage({ onOpenSection, onNotify }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All Status');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    branchApi.list()
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        setRows(list.map((row) => ({
          id: row.id,
          name: row.name,
          code: `BR-${String(row.id).padStart(3, '0')}`,
          location: [row.city, row.address].filter(Boolean).join(', ') || row.city || '—',
          contact: '—',
          email: '—',
          status: row.is_active ? 'Active' : 'Inactive',
        })));
      })
      .catch(() => onNotify('Could not load branches.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredRows = rows.filter((row) => {
    const queryMatch = [row.name, row.code, row.location, row.email].some((value) => String(value).toLowerCase().includes(query.toLowerCase()));
    const statusMatch = status === 'All Status' || row.status === status;
    return queryMatch && statusMatch;
  });"""

text = text.replace(old_branch, new_branch, 1)

# Add loading state in branch table area - after filteredRows definition add loading check in return - skip for now, optional

path.write_text(text, encoding="utf-8")
print("Settings API wiring patched OK")
