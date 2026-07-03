"""Wire all Settings frontend pages to settingsApi backend."""

from pathlib import Path

path = Path(__file__).resolve().parents[1] / "src" / "App.jsx"
text = path.read_text(encoding="utf-8")

# ── Business Information ──
old = """function BusinessInformationSettingsPage({ onOpenSection, onNotify }) {
  const [form, setForm] = useState({"""

new = """function BusinessInformationSettingsPage({ onOpenSection, onNotify }) {
  const defaultBusinessForm = {"""

if old not in text:
    raise SystemExit('BusinessInformationSettingsPage not found')
text = text.replace(old, new, 1)

old = """    timezone: '(GMT +05:30) Asia/Kolkata',
  });

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-4">
      <PageHeading
        title="Business Information\""""
new = """    timezone: '(GMT +05:30) Asia/Kolkata',
  };
  const [form, setForm] = useState(defaultBusinessForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi.category('business').get()
      .then((data) => { if (data) setForm((c) => ({ ...c, ...data })); })
      .catch(() => onNotify('Could not load business information.', 'error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveBusiness = async () => {
    setSaving(true);
    try {
      await settingsApi.category('business').update(form);
      onNotify('Business information saved');
    } catch {
      onNotify('Could not save business information.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-4">
      <PageHeading
        title="Business Information\""""
text = text.replace(old, new, 1)
text = text.replace(
    "onClick={() => onNotify('Business information saved')} className=\"inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#078c3e] px-5 text-[13px] font-extrabold text-white shadow-[0_12px_22px_rgba(13,159,74,0.22)] transition hover:bg-[#067832]\"",
    "onClick={saveBusiness} disabled={saving} className=\"inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#078c3e] px-5 text-[13px] font-extrabold text-white shadow-[0_12px_22px_rgba(13,159,74,0.22)] transition hover:bg-[#067832] disabled:opacity-60\"",
    1,
)

# ── Financial Year ──
old = """function FinancialYearSettingsPage({ onOpenSection, onNotify }) {
  const [query, setQuery] = useState('');

  const rows = [
    { id: 1, year: '2024-25', startDate: '01 Apr 2024', endDate: '31 Mar 2025', period: 'FY 2024-25', status: 'Active', current: true },
    { id: 2, year: '2023-24', startDate: '01 Apr 2023', endDate: '31 Mar 2024', period: 'FY 2023-24', status: 'Active', current: false },
    { id: 3, year: '2022-23', startDate: '01 Apr 2022', endDate: '31 Mar 2023', period: 'FY 2022-23', status: 'Active', current: false },
    { id: 4, year: '2021-22', startDate: '01 Apr 2021', endDate: '31 Mar 2022', period: 'FY 2021-22', status: 'Active', current: false },
    { id: 5, year: '2020-21', startDate: '01 Apr 2020', endDate: '31 Mar 2021', period: 'FY 2020-21', status: 'Active', current: false },
    { id: 6, year: '2019-20', startDate: '01 Apr 2019', endDate: '31 Mar 2020', period: 'FY 2019-20', status: 'Active', current: false },
    { id: 7, year: '2018-19', startDate: '01 Apr 2018', endDate: '31 Mar 2019', period: 'FY 2018-19', status: 'Closed', current: false },
    { id: 8, year: '2017-18', startDate: '01 Apr 2017', endDate: '31 Mar 2018', period: 'FY 2017-18', status: 'Closed', current: false },
  ];

  const filteredRows = rows.filter((row) => [row.year, row.period, row.startDate, row.endDate].some((value) => value.toLowerCase().includes(query.toLowerCase())));
  const currentYear = rows[0];"""

new = """function FinancialYearSettingsPage({ onOpenSection, onNotify }) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    settingsApi.financialYears.list()
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        setRows(list.map((fy) => ({
          id: fy.id,
          year: fy.label,
          startDate: fy.start_date,
          endDate: fy.end_date,
          period: `FY ${fy.label}`,
          status: fy.status,
          current: fy.is_current,
        })));
      })
      .catch(() => onNotify('Could not load financial years.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredRows = rows.filter((row) => [row.year, row.period, row.startDate, row.endDate].some((value) => String(value).toLowerCase().includes(query.toLowerCase())));
  const currentYear = rows.find((row) => row.current) || rows[0] || { year: '—', startDate: '—', endDate: '—', status: '—' };"""

text = text.replace(old, new, 1)

# ── Activity Log ──
old = """function SettingsUserActivityLogPage({ activeSection = 'Settings User Activity Log', onOpenSection, onNotify }) {"""
# Find the useState with settingsActivitySeed
idx = text.find("function SettingsUserActivityLogPage")
if idx == -1:
    raise SystemExit('SettingsUserActivityLogPage not found')
chunk = text[idx:idx+800]
if 'settingsActivitySeed' in chunk:
    text = text.replace(
        "  const [rows, setRows] = useState(settingsActivitySeed);",
        """  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    settingsApi.activityLogs.list()
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        setRows(list.map((log) => ({
          id: log.id,
          time: log.created_at ? new Date(log.created_at).toLocaleString('en-IN') : '—',
          user: { name: log.user_name || 'System', email: '', role: '' },
          action: log.action,
          module: log.module,
          description: log.description,
          ip: log.ip_address || '—',
          status: log.status,
        })));
      })
      .catch(() => onNotify('Could not load activity logs.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps""",
        1,
    )

# ── IP Restrictions ──
text = text.replace(
    "  const [rules, setRules] = useState(settingsIpRulesSeed);",
    """  const [rules, setRules] = useState([]);
  const [blockedAttempts, setBlockedAttempts] = useState([]);

  useEffect(() => {
    Promise.all([settingsApi.ipRules.list(), settingsApi.ipBlockedAttempts.list(), settingsApi.category('ip_security').get()])
      .then(([rulesRes, blockedRes, securityRes]) => {
        const ruleList = Array.isArray(rulesRes) ? rulesRes : (rulesRes?.results ?? []);
        setRules(ruleList.map((rule) => ({
          id: rule.id,
          name: rule.name,
          ipRange: rule.ip_range,
          type: rule.rule_type,
          description: rule.description,
          status: rule.is_active ? 'Active' : 'Inactive',
        })));
        const blockedList = Array.isArray(blockedRes) ? blockedRes : (blockedRes?.results ?? []);
        setBlockedAttempts(blockedList.map((item) => ({
          ip: item.ip_address,
          username: item.username,
          reason: item.reason,
          attemptedAt: item.attempted_at ? new Date(item.attempted_at).toLocaleString('en-IN') : '—',
        })));
        if (securityRes) setSecurityConfig((c) => ({ ...c, ...securityRes }));
      })
      .catch(() => onNotify('Could not load IP settings.', 'error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps""",
    1,
)

# Payment settings save
old_pay_save = "onClick={() => onNotify('Payment settings saved')} className=\"inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[#078c3e] px-5 text-[13px] font-extrabold text-white shadow-[0_12px_22px_rgba(13,159,74,0.22)] transition hover:bg-[#067832] min-[460px]:w-auto\"><Save className=\"size-4\" />Save Changes</button>"
# Add load/save to PaymentSettingsContent - insert after bankDetails state
pay_marker = "  const toggleBankDetail = (field) => setBankDetails((current) => ({ ...current, [field]: !current[field] }));\n\n  return ("
pay_insert = """  const toggleBankDetail = (field) => setBankDetails((current) => ({ ...current, [field]: !current[field] }));

  useEffect(() => {
    settingsApi.payment.get()
      .then((data) => {
        if (!data) return;
        if (data.lateFeeEnabled !== undefined) setLateFeeEnabled(Boolean(data.lateFeeEnabled));
        if (data.remindersEnabled !== undefined) setRemindersEnabled(Boolean(data.remindersEnabled));
        if (data.allowPartial !== undefined) setAllowPartial(Boolean(data.allowPartial));
        if (data.autoPaid !== undefined) setAutoPaid(Boolean(data.autoPaid));
        const { bankDetails: bank, ...rest } = data;
        setForm((c) => ({ ...c, ...rest }));
        if (bank) setBankDetails((c) => ({ ...c, ...bank }));
      })
      .catch(() => {});
  }, []);

  const savePaymentSettings = async () => {
    try {
      await settingsApi.payment.update({
        ...form,
        lateFeeEnabled,
        remindersEnabled,
        allowPartial,
        autoPaid,
        bankDetails,
      });
      onNotify('Payment settings saved');
    } catch {
      onNotify('Could not save payment settings.', 'error');
    }
  };

  return ("""
if pay_marker in text:
    text = text.replace(pay_marker, pay_insert, 1)
    text = text.replace(old_pay_save, "onClick={savePaymentSettings} className=\"inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[#078c3e] px-5 text-[13px] font-extrabold text-white shadow-[0_12px_22px_rgba(13,159,74,0.22)] transition hover:bg-[#067832] min-[460px]:w-auto\"><Save className=\"size-4\" />Save Changes</button>", 2)

path.write_text(text, encoding="utf-8")
print('Settings frontend wired OK')
