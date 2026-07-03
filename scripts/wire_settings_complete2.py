"""Wire settings pages part 2: project masters, communication, backup, maintenance."""
from pathlib import Path
import re

APP = Path(__file__).resolve().parents[1] / "src" / "App.jsx"
text = APP.read_text(encoding="utf-8")

# Project master pages -> SettingsMastersCrudPanel
PROJECT_PAGES = [
    ("SettingsProjectStatusContent", "project_status", "Project Status", "Manage project workflow statuses, stage order and progress mapping.", "Add Status",
     ['Status Name', 'Code', 'Color', 'Stage', 'Status', 'Action'],
     "(row) => [row.name, row.code || '—', row.metadata?.color || '—', row.metadata?.stage || '—', <SettingsStatusBadge label={row.is_active ? 'Active' : 'Inactive'} />, null]"),
    ("SettingsProjectTypesContent", "project_type", "Project Types", "Configure project type master for residential, commercial and industrial jobs.", "Add Type",
     ['Type', 'Code', 'Capacity', 'Subsidy', 'Status', 'Action'],
     "(row) => [row.name, row.code || '—', row.metadata?.capacity || '—', row.metadata?.subsidy || '—', <SettingsStatusBadge label={row.is_active ? 'Active' : 'Inactive'} />, null]"),
    ("SettingsTaskPrioritiesContent", "task_priority", "Task Priorities", "Manage task priority levels, SLA and escalation mapping.", "Add Priority",
     ['Priority', 'Code', 'SLA', 'Escalation', 'Status', 'Action'],
     "(row) => [row.name, row.code || '—', row.metadata?.sla || '—', row.metadata?.escalation || '—', <SettingsStatusBadge label={row.is_active ? 'Active' : 'Inactive'} />, null]"),
    ("SettingsMilestoneContent", "milestone", "Milestone Settings", "Configure project milestones, progress weightage and mandatory completion rules.", "Add Milestone",
     ['Milestone', 'Code', 'Phase', 'Weightage', 'Status', 'Action'],
     "(row) => [row.name, row.code || '—', row.metadata?.phase || '—', row.metadata?.weight || '—', <SettingsStatusBadge label={row.is_active ? 'Active' : 'Inactive'} />, null]"),
]

for fn_name, master_type, title, note, add_label, columns, map_fn in PROJECT_PAGES:
    pattern = rf"function {fn_name}\(\{{ onOpenSection, onNotify \}}\) \{{[\s\S]*?\n\}}\n\nfunction "
    replacement = f"""function {fn_name}({{ onOpenSection, onNotify }}) {{
  return (
    <SettingsMastersCrudPanel
      masterType="{master_type}"
      title="{title}"
      note="{note}"
      columns={columns}
      mapRow={{{map_fn}}}
      sideTitle="Rules"
      sideRows={[['Auto Sync', 'Enabled'], ['Audit Trail', 'Enabled'], ['Last Update', 'Live'], ['Records', 'API']]}
      addLabel="{add_label}"
      onOpenSection={{onOpenSection}}
      onNotify={{onNotify}}
    />
  );
}}

function """
    text, count = re.subn(pattern, replacement, text, count=1)
    if count == 0:
        print(f"Warning: could not replace {fn_name}")

# Email settings
EMAIL_NEW = '''function SettingsEmailSettingsContent({ onOpenSection, onNotify }) {
  return (
    <SettingsCategoryIntegrationPage
      category="email"
      title="Email Settings"
      note="Configure SMTP, sender identity, email templates and delivery controls."
      configTitle="SMTP Configuration"
      renderConfigFields={(form, updateField) => (
        <>
          <SettingsInputField label="SMTP Host" value={form.smtpHost || ''} onChange={(v) => updateField('smtpHost', v)} />
          <SettingsInputField label="SMTP Port" value={form.smtpPort || ''} onChange={(v) => updateField('smtpPort', v)} />
          <SettingsSelectField label="Encryption" value={form.smtpSecurity || 'TLS'} onChange={(v) => updateField('smtpSecurity', v)} options={['TLS', 'SSL', 'None']} />
          <SettingsInputField label="SMTP Username" value={form.smtpUser || ''} onChange={(v) => updateField('smtpUser', v)} />
          <SettingsInputField label="From Name" value={form.fromName || ''} onChange={(v) => updateField('fromName', v)} />
          <SettingsInputField label="From Email" value={form.fromEmail || ''} onChange={(v) => updateField('fromEmail', v)} />
          <SettingsToggleRow label="Enable Email" note="Turn email delivery on or off." enabled={Boolean(form.enabled)} onToggle={() => updateField('enabled', !form.enabled)} />
        </>
      )}
      masterType="document"
      templateColumns={['Template Name', 'Code', 'Channel', 'Status', 'Action']}
      mapTemplateRow={(row) => [row.name, row.code || '—', row.metadata?.channel || 'Email', <SettingsStatusBadge label={row.is_active ? 'Active' : 'Inactive'} />, null]}
      stats={[['SMTP Status', 'Live', Mail, 'green'], ['Templates', '—', FileText, 'blue'], ['Channel', 'Email', CheckCircle2, 'purple'], ['API', 'Connected', Database, 'amber']]}
      sideTitle="Email Health"
      sideRows={[['Delivery', 'Configured'], ['Queue', 'Ready'], ['From', 'CRM'], ['Save', 'Enabled']]}
      addLabel="Add Template"
      onOpenSection={onOpenSection}
      onNotify={onNotify}
    />
  );
}'''

text = re.sub(
    r"function SettingsEmailSettingsContent\(\{ onOpenSection, onNotify \}\) \{[\s\S]*?\n\}\n\nfunction SettingsSmsSettingsContent",
    EMAIL_NEW + "\n\nfunction SettingsSmsSettingsContent",
    text,
    count=1,
)

SMS_NEW = '''function SettingsSmsSettingsContent({ onOpenSection, onNotify }) {
  return (
    <SettingsCategoryIntegrationPage
      category="sms"
      title="SMS Settings"
      note="Configure SMS gateway, sender ID, DLT templates and delivery preferences."
      configTitle="SMS Gateway"
      renderConfigFields={(form, updateField) => (
        <>
          <SettingsSelectField label="Gateway Provider" value={form.provider || 'MSG91'} onChange={(v) => updateField('provider', v)} options={['MSG91', 'TextLocal', 'Twilio', 'Custom API']} />
          <SettingsInputField label="Sender ID" value={form.senderId || ''} onChange={(v) => updateField('senderId', v)} />
          <SettingsInputField label="API Key" value={form.apiKey || ''} onChange={(v) => updateField('apiKey', v)} />
          <SettingsToggleRow label="Enable SMS" note="Turn SMS delivery on or off." enabled={Boolean(form.enabled)} onToggle={() => updateField('enabled', !form.enabled)} />
        </>
      )}
      masterType="document"
      templateColumns={['Template Name', 'Code', 'Channel', 'Status', 'Action']}
      mapTemplateRow={(row) => [row.name, row.code || '—', 'SMS', <SettingsStatusBadge label={row.is_active ? 'Active' : 'Inactive'} />, null]}
      stats={[['Gateway', 'Live', MessageSquareMore, 'green'], ['Templates', '—', FileText, 'blue'], ['Channel', 'SMS', CheckCircle2, 'purple'], ['API', 'Connected', Database, 'amber']]}
      sideTitle="SMS Balance"
      sideRows={[['Provider', 'Configured'], ['Sender ID', 'Set'], ['Delivery', 'Ready'], ['Retry', 'Enabled']]}
      addLabel="Add SMS Template"
      onOpenSection={onOpenSection}
      onNotify={onNotify}
    />
  );
}'''

text = re.sub(
    r"function SettingsSmsSettingsContent\(\{ onOpenSection, onNotify \}\) \{[\s\S]*?\n\}\n\nfunction SettingsWhatsAppSettingsContent",
    SMS_NEW + "\n\nfunction SettingsWhatsAppSettingsContent",
    text,
    count=1,
)

WA_NEW = '''function SettingsWhatsAppSettingsContent({ onOpenSection, onNotify }) {
  return (
    <SettingsCategoryIntegrationPage
      category="whatsapp"
      title="WhatsApp Settings"
      note="Configure WhatsApp Business API, approved templates and automation rules."
      configTitle="WhatsApp Business API"
      renderConfigFields={(form, updateField) => (
        <>
          <SettingsInputField label="Phone Number ID" value={form.phoneNumberId || ''} onChange={(v) => updateField('phoneNumberId', v)} />
          <SettingsInputField label="Access Token" value={form.accessToken || ''} onChange={(v) => updateField('accessToken', v)} />
          <SettingsSelectField label="Provider" value={form.provider || 'WhatsApp Business API'} onChange={(v) => updateField('provider', v)} options={['WhatsApp Business API', 'Custom API']} />
          <SettingsToggleRow label="Enable WhatsApp" note="Turn WhatsApp delivery on or off." enabled={Boolean(form.enabled)} onToggle={() => updateField('enabled', !form.enabled)} />
        </>
      )}
      masterType="document"
      templateColumns={['Template Name', 'Code', 'Channel', 'Status', 'Action']}
      mapTemplateRow={(row) => [row.name, row.code || '—', 'WhatsApp', <SettingsStatusBadge label={row.is_active ? 'Active' : 'Inactive'} />, null]}
      stats={[['API Status', 'Live', Phone, 'green'], ['Templates', '—', MessageSquareMore, 'blue'], ['Channel', 'WhatsApp', CheckCircle2, 'purple'], ['Webhook', 'Ready', Database, 'amber']]}
      sideTitle="WhatsApp Health"
      sideRows={[['Provider', 'Configured'], ['Token', 'Set'], ['Delivery', 'Ready'], ['Media', 'Enabled']]}
      addLabel="Add WA Template"
      onOpenSection={onOpenSection}
      onNotify={onNotify}
    />
  );
}'''

text = re.sub(
    r"function SettingsWhatsAppSettingsContent\(\{ onOpenSection, onNotify \}\) \{[\s\S]*?\n\}\n\nfunction SettingsNotificationSettingsContent",
    WA_NEW + "\n\nfunction SettingsNotificationSettingsContent",
    text,
    count=1,
)

NOTIF_NEW = '''function SettingsNotificationSettingsContent({ onOpenSection, onNotify }) {
  return (
    <SettingsCategoryIntegrationPage
      category="notification"
      title="Notification Settings"
      note="Manage notification events, delivery channels, digest rules and escalation behavior."
      configTitle="Notification Rules"
      renderConfigFields={(form, updateField) => (
        <>
          <SettingsToggleRow label="Email Alerts" note="Send email notifications for key events." enabled={Boolean(form.emailAlerts)} onToggle={() => updateField('emailAlerts', !form.emailAlerts)} />
          <SettingsToggleRow label="SMS Alerts" note="Send SMS notifications for urgent events." enabled={Boolean(form.smsAlerts)} onToggle={() => updateField('smsAlerts', !form.smsAlerts)} />
          <SettingsToggleRow label="Push Alerts" note="Show in-app/browser notifications." enabled={Boolean(form.pushAlerts)} onToggle={() => updateField('pushAlerts', !form.pushAlerts)} />
          <SettingsToggleRow label="Lead Assignment" note="Notify when a lead is assigned." enabled={Boolean(form.leadAssignment)} onToggle={() => updateField('leadAssignment', !form.leadAssignment)} />
          <SettingsToggleRow label="Payment Received" note="Notify when payment is recorded." enabled={Boolean(form.paymentReceived)} onToggle={() => updateField('paymentReceived', !form.paymentReceived)} />
          <SettingsToggleRow label="Project Updates" note="Notify on project status changes." enabled={Boolean(form.projectUpdates)} onToggle={() => updateField('projectUpdates', !form.projectUpdates)} />
          <SettingsToggleRow label="AMC Reminders" note="Notify before AMC expiry." enabled={Boolean(form.amcReminders)} onToggle={() => updateField('amcReminders', !form.amcReminders)} />
        </>
      )}
      masterType="approval_workflow"
      templateColumns={['Rule Name', 'Code', 'Detail', 'Status', 'Action']}
      mapTemplateRow={(row) => [row.name, row.code || '—', row.metadata?.approver || '—', <SettingsStatusBadge label={row.is_active ? 'Active' : 'Inactive'} />, null]}
      stats={[['Events', 'Live', Bell, 'green'], ['Channels', '4', MessageSquareMore, 'blue'], ['Rules', '—', CheckCircle2, 'purple'], ['Escalations', 'On', AlertTriangle, 'amber']]}
      sideTitle="Channel Status"
      sideRows={[['In-app', 'Active'], ['Email', 'Active'], ['SMS', 'Optional'], ['WhatsApp', 'Optional']]}
      addLabel="Add Rule"
      onOpenSection={onOpenSection}
      onNotify={onNotify}
    />
  );
}'''

text = re.sub(
    r"function SettingsNotificationSettingsContent\(\{ onOpenSection, onNotify \}\) \{[\s\S]*?\n\}\n\nfunction SettingsCommunicationPage",
    NOTIF_NEW + "\n\nfunction SettingsCommunicationPage",
    text,
    count=1,
)

BACKUP_NEW = '''function SettingsBackupRestoreContent({ onOpenSection, onNotify }) {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const reload = () => settingsApi.backups.list()
    .then((res) => {
      const list = Array.isArray(res) ? res : (res?.results ?? []);
      setBackups(list);
    })
    .catch(() => onNotify('Could not load backups.', 'error'))
    .finally(() => setLoading(false));

  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runBackup = async () => {
    setRunning(true);
    try {
      await settingsApi.backups.create('Full');
      onNotify('Backup started successfully');
      await reload();
    } catch {
      onNotify('Backup failed.', 'error');
    } finally {
      setRunning(false);
    }
  };

  const rows = backups.map((item) => [
    item.filename,
    item.created_at ? new Date(item.created_at).toLocaleString('en-IN') : '—',
    item.file_size || '—',
    item.status || 'Completed',
  ]);

  const last = backups[0];

  return (
    <section className={`${panelClass} p-4 sm:p-5`}>
      <SettingsContentHeader title="Backup & Restore" note="Configure scheduled backups, restore points, encryption and retention policy." onCancel={() => onOpenSection('Settings')} onSave={runBackup} saving={running} />
      <SettingsInventoryStats stats={[
        ['Last Backup', last ? 'Recent' : 'None', Cloud, 'green'],
        ['Backup Size', last?.file_size || '—', HardDrive, 'blue'],
        ['Restore Points', String(backups.length), RefreshCw, 'purple'],
        ['Failed Jobs', String(backups.filter((b) => b.status === 'Failed').length), AlertTriangle, 'amber'],
      ]} />
      {loading ? <p className="py-8 text-center text-[13px] font-bold text-[#53647f]">Loading backups...</p> : (
        <SettingsInventoryTable
          title="Backup History"
          searchPlaceholder="Search backups..."
          addLabel="Run Backup"
          onNotify={onNotify}
          onAdd={runBackup}
          columns={['Filename', 'Created On', 'Size', 'Status', 'Action']}
          rows={rows.map(([name, created, size, status]) => [
            name,
            created,
            size,
            <SettingsStatusBadge label={status} tone={status === 'Failed' ? 'amber' : 'green'} />,
            <UserActionButton label={`Open ${name}`} icon={Download} tone="blue" onClick={() => onNotify(`${name} download opened`)} />,
          ])}
          sideTitle="Restore Safety"
          sideRows={[['Restore Lock', 'Admin Only'], ['Pre-restore Backup', 'Required'], ['Data Validation', 'Enabled'], ['Download Latest', last ? 'Available' : 'None']]}
        />
      )}
    </section>
  );
}'''

text = re.sub(
    r"function SettingsBackupRestoreContent\(\{ onOpenSection, onNotify \}\) \{[\s\S]*?\n\}\n\nfunction SettingsSystemMaintenanceContent",
    BACKUP_NEW + "\n\nfunction SettingsSystemMaintenanceContent",
    text,
    count=1,
)

MAINT_NEW = '''function SettingsSystemMaintenanceContent({ onOpenSection, onNotify }) {
  const { form, loading, saving, save, updateField } = useSettingsCategory('maintenance', {}, onNotify);
  const [running, setRunning] = useState(null);

  const runTask = async (action, label) => {
    setRunning(action);
    try {
      const result = await settingsApi.maintenance(action);
      onNotify(result?.details?.join(' ') || `${label} completed`);
    } catch {
      onNotify(`${label} failed.`, 'error');
    } finally {
      setRunning(null);
    }
  };

  const tasks = [
    ['Clear Cache', 'clear_cache', 'Utility'],
    ['Health Check', 'health_check', 'System'],
    ['Clear Old Logs', 'cleanup_logs', 'Logs'],
  ];

  return (
    <section className={`${panelClass} p-4 sm:p-5`}>
      <SettingsContentHeader title="System Maintenance" note="Manage cache cleanup, database optimization, logs and maintenance mode." onCancel={() => onOpenSection('Settings')} onSave={save} saving={saving} />
      <SettingsInventoryStats stats={[
        ['System Health', 'Good', CheckCircle2, 'green'],
        ['Log Retention', `${form.logRetentionDays || '90'} Days`, FileText, 'blue'],
        ['Auto Cleanup', form.autoCleanupLogs ? 'On' : 'Off', Database, 'purple'],
        ['Health Check', form.healthCheckEnabled ? 'On' : 'Off', AlertTriangle, 'amber'],
      ]} />
      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-4">
          <SettingsSectionCard title="Maintenance Controls" className="shadow-none">
            {loading ? <p className="text-[13px] font-bold text-[#53647f]">Loading...</p> : (
              <div className="grid gap-4 md:grid-cols-2">
                <SettingsToggleRow label="Auto Cleanup" note="Automatically clear stale sessions and temporary files." enabled={Boolean(form.autoCleanupLogs)} onToggle={() => updateField('autoCleanupLogs', !form.autoCleanupLogs)} />
                <SettingsToggleRow label="Cache Cleanup" note="Allow scheduled cache cleanup." enabled={Boolean(form.cacheCleanupEnabled)} onToggle={() => updateField('cacheCleanupEnabled', !form.cacheCleanupEnabled)} />
                <SettingsToggleRow label="Health Check" note="Run periodic health checks." enabled={Boolean(form.healthCheckEnabled)} onToggle={() => updateField('healthCheckEnabled', !form.healthCheckEnabled)} />
                <SettingsInputField label="Log Retention (Days)" value={String(form.logRetentionDays || '90')} onChange={(v) => updateField('logRetentionDays', v)} />
              </div>
            )}
          </SettingsSectionCard>
          <SettingsInventoryTable
            title="Maintenance Tasks"
            searchPlaceholder="Search tasks..."
            addLabel="Run Task"
            onNotify={onNotify}
            columns={['Task', 'Module', 'Detail', 'Status', 'Action']}
            rows={tasks.map(([label, action, module]) => [
              label,
              module,
              running === action ? 'Running...' : 'Ready',
              <SettingsStatusBadge label={running === action ? 'Running' : 'Ready'} tone={running === action ? 'amber' : 'green'} />,
              <UserActionButton label={`Run ${label}`} icon={RefreshCw} tone="blue" onClick={() => runTask(action, label)} />,
            ])}
            sideTitle="Summary"
            sideRows={[['Tasks', String(tasks.length)], ['Auto Cleanup', form.autoCleanupLogs ? 'Enabled' : 'Disabled'], ['Health Check', form.healthCheckEnabled ? 'Enabled' : 'Disabled'], ['Last Update', 'Live']]}
          />
        </div>
        <SettingsSidebarInfoCard title="Maintenance Status" icon={Info}>
          <div className="space-y-3">
            <SettingsPreviewRow label="Maintenance Mode" value="Off" />
            <SettingsPreviewRow label="Background Jobs" value="Running" />
            <SettingsPreviewRow label="Database" value="Healthy" />
            <SettingsPreviewRow label="Search Index" value="Updated" />
          </div>
        </SettingsSidebarInfoCard>
      </section>
    </section>
  );
}'''

text = re.sub(
    r"function SettingsSystemMaintenanceContent\(\{ onOpenSection, onNotify \}\) \{[\s\S]*?\n\}\n\nfunction SettingsOtherMasterPage",
    MAINT_NEW + "\n\nfunction SettingsOtherMasterPage",
    text,
    count=1,
)

# Document settings - document series API
DOC_NEW = '''function SettingsDocumentSettingsContent({ onOpenSection, onNotify }) {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    settingsApi.documentSeries.list()
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        setSeries(list);
      })
      .catch(() => onNotify('Could not load document series.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = series.map((item) => [
    item.document_type,
    `${item.prefix}${String(item.next_number).padStart(item.padding || 4, '0')}`,
    item.preview || 'PDF',
    item.is_active ? 'Active' : 'Inactive',
  ]);

  return (
    <section className={`${panelClass} p-4 sm:p-5`}>
      <SettingsContentHeader title="Document Settings" note="Configure document numbering, file rules, templates and storage preferences." onCancel={() => onOpenSection('Settings')} onSave={() => onNotify('Document settings saved')} />
      <SettingsInventoryStats stats={[
        ['Document Types', String(series.length), FileText, 'green'],
        ['Active Series', String(series.filter((s) => s.is_active).length), ReceiptText, 'blue'],
        ['Auto Numbering', 'Enabled', Database, 'purple'],
        ['Inactive', String(series.filter((s) => !s.is_active).length), Hourglass, 'amber'],
      ]} />
      {loading ? <p className="py-8 text-center text-[13px] font-bold text-[#53647f]">Loading document series...</p> : (
        <SettingsInventoryTable
          title="Document Number Series"
          searchPlaceholder="Search document types..."
          addLabel="Add Document Type"
          onNotify={onNotify}
          columns={['Document Type', 'Number Format', 'Format', 'Status', 'Action']}
          rows={rows.map(([name, format, fmt, status]) => [
            name,
            format,
            fmt,
            <SettingsStatusBadge label={status} tone={status === 'Inactive' ? 'amber' : 'green'} />,
            <UserActionButton label={`Open ${name}`} icon={MoreVertical} tone="blue" onClick={() => onNotify(`${name} series opened`)} />,
          ])}
          sideTitle="Storage Policy"
          sideRows={[['Storage Provider', 'Cloud'], ['Retention', '5 Years'], ['Compression', 'Enabled'], ['Watermark', 'Enabled']]}
        />
      )}
    </section>
  );
}'''

text = re.sub(
    r"function SettingsDocumentSettingsContent\(\{ onOpenSection, onNotify \}\) \{[\s\S]*?\n\}\n\nfunction SettingsApprovalSettingsContent",
    DOC_NEW + "\n\nfunction SettingsApprovalSettingsContent",
    text,
    count=1,
)

APPROVAL_NEW = '''function SettingsApprovalSettingsContent({ onOpenSection, onNotify }) {
  return (
    <SettingsInventoryCategoryPage
      category="approval"
      title="Approval Settings"
      note="Manage approval workflows, levels, escalation rules and approval authority."
      renderConfigFields={(form, updateField) => (
        <>
          <SettingsToggleRow label="Lead Approval Required" note="Require approval before lead conversion." enabled={Boolean(form.leadApprovalRequired)} onToggle={() => updateField('leadApprovalRequired', !form.leadApprovalRequired)} />
          <SettingsToggleRow label="Quotation Approval Required" note="Require approval before sharing quotation." enabled={Boolean(form.quotationApprovalRequired)} onToggle={() => updateField('quotationApprovalRequired', !form.quotationApprovalRequired)} />
          <SettingsToggleRow label="Expense Approval Required" note="Require approval for expense entries." enabled={Boolean(form.expenseApprovalRequired)} onToggle={() => updateField('expenseApprovalRequired', !form.expenseApprovalRequired)} />
          <SettingsToggleRow label="Purchase Approval Required" note="Require approval for purchase orders." enabled={Boolean(form.purchaseApprovalRequired)} onToggle={() => updateField('purchaseApprovalRequired', !form.purchaseApprovalRequired)} />
          <SettingsSelectField label="Default Approver Role" value={form.defaultApproverRole || 'Admin'} onChange={(v) => updateField('defaultApproverRole', v)} options={['Admin', 'Manager', 'Accounts Head']} />
        </>
      )}
      masterType="approval_workflow"
      masterTitle="Approval Workflows"
      masterColumns={['Workflow', 'Code', 'Approver', 'Levels', 'Status', 'Action']}
      mapMasterRow={(row) => [
        row.name,
        row.code || '—',
        row.metadata?.approver || '—',
        row.metadata?.levels || '1 Level',
        <SettingsStatusBadge label={row.is_active ? 'Active' : 'Inactive'} />,
        null,
      ]}
      sideRows={[['Auto Reminders', 'Enabled'], ['Escalation', 'Enabled'], ['Audit Trail', 'Required'], ['Bulk Approval', 'Disabled']]}
      onOpenSection={onOpenSection}
      onNotify={onNotify}
    />
  );
}'''

text = re.sub(
    r"function SettingsApprovalSettingsContent\(\{ onOpenSection, onNotify \}\) \{[\s\S]*?\n\}\n\nfunction SettingsBackupRestoreContent",
    APPROVAL_NEW + "\n\nfunction SettingsBackupRestoreContent",
    text,
    count=1,
)

APP.write_text(text, encoding="utf-8")
print("Part 2 done")
