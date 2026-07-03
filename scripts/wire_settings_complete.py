"""Wire remaining settings pages to API + shared CRUD helpers."""
from pathlib import Path

APP = Path(__file__).resolve().parents[1] / "src" / "App.jsx"
text = APP.read_text(encoding="utf-8")

HELPERS = '''
function useSettingsCategory(category, defaults, onNotify) {
  const [form, setForm] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    settingsApi.category(category).get()
      .then((res) => {
        if (res && typeof res === 'object') setForm((current) => ({ ...current, ...res }));
      })
      .catch(() => onNotify?.(`Could not load ${category} settings.`, 'error'))
      .finally(() => setLoading(false));
  }, [category]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const save = async () => {
    setSaving(true);
    try {
      await settingsApi.category(category).update(form);
      onNotify(`${category} settings saved`);
    } catch {
      onNotify(`Could not save ${category} settings.`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return { form, loading, saving, save, updateField, setForm };
}

function SettingsMasterFormModal({ title, initial = null, onClose, onSave }) {
  const [form, setForm] = useState(() => initial ?? { name: '', code: '', status: 'Active' });
  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="fixed inset-0 z-90 flex items-center justify-center bg-[#111827]/45 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[560px] rounded-[16px] bg-white shadow-[0_30px_70px_rgba(17,24,39,0.28)]">
        <div className="flex items-center justify-between border-b border-[#edf2f8] px-6 py-5">
          <h2 className="font-display text-[20px] font-extrabold text-[#111827]">{initial ? `Edit ${title}` : `Add ${title}`}</h2>
          <button type="button" onClick={onClose} className="text-[#7585a2]"><X className="size-5" /></button>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <div className="sm:col-span-2"><ModalTextInput label="Name" value={form.name} onChange={(value) => updateField('name', value)} placeholder="Enter name" /></div>
          <ModalTextInput label="Code" value={form.code} onChange={(value) => updateField('code', value)} placeholder="CODE" />
          <ReportSelect label="Status" value={form.status} onChange={(value) => updateField('status', value)} options={['Active', 'Inactive']} />
        </div>
        <div className="flex flex-col justify-end gap-3 border-t border-[#edf2f8] px-6 py-5 sm:flex-row">
          <button type="button" onClick={onClose} className="h-10 rounded-[8px] border border-[#d9e4f2] bg-white px-6 text-[13px] font-extrabold text-[#233a6b]">Cancel</button>
          <button type="button" onClick={() => onSave({ ...form, name: form.name.trim() || title })} className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#0d9f4a] px-6 text-[13px] font-extrabold text-white"><Save className="size-4" />Save</button>
        </div>
      </div>
    </div>
  );
}

function SettingsMastersCrudPanel({
  masterType,
  title,
  note,
  columns,
  mapRow,
  stats,
  sideTitle,
  sideRows,
  addLabel,
  onOpenSection,
  onNotify,
}) {
  const { rows, loading, setRows } = useSettingsMasters(masterType, onNotify);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const activeCount = rows.filter((row) => row.is_active).length;

  const reload = () => settingsApi.masters.list({ master_type: masterType })
    .then((res) => {
      const list = Array.isArray(res) ? res : (res?.results ?? []);
      setRows(list);
    });

  const saveMaster = async (payload) => {
    const body = {
      master_type: masterType,
      name: payload.name,
      code: payload.code || payload.name.toUpperCase().replace(/\\s+/g, '-').slice(0, 20),
      is_active: payload.status !== 'Inactive',
      metadata: editing?.metadata || {},
    };
    try {
      if (editing?.id) {
        await settingsApi.masters.update(editing.id, body);
        onNotify(`${payload.name} updated`);
      } else {
        await settingsApi.masters.create(body);
        onNotify(`${payload.name} added`);
      }
      setModalOpen(false);
      setEditing(null);
      await reload();
    } catch {
      onNotify('Could not save record.', 'error');
    }
  };

  const deleteMaster = async (row) => {
    try {
      await settingsApi.masters.delete(row.id);
      onNotify(`${row.name} deleted`);
      await reload();
    } catch {
      onNotify('Could not delete record.', 'error');
    }
  };

  const tableRows = rows.map((row) => {
    const cells = mapRow(row);
    return [
      ...cells.slice(0, -1),
      <div key={`${row.id}-actions`} className="flex items-center justify-end gap-2">
        <UserActionButton label={`Edit ${row.name}`} icon={FileText} tone="blue" onClick={() => { setEditing({ ...row, status: row.is_active ? 'Active' : 'Inactive' }); setModalOpen(true); }} />
        <UserActionButton label={`Delete ${row.name}`} icon={Trash2} tone="blue" onClick={() => deleteMaster(row)} />
      </div>,
    ];
  });

  const resolvedStats = stats || [
    ['Total', String(rows.length), Database, 'green'],
    ['Active', String(activeCount), CheckCircle2, 'blue'],
    ['Inactive', String(rows.length - activeCount), Minus, 'amber'],
    ['Type', masterType.replace(/_/g, ' '), Wrench, 'purple'],
  ];

  return (
    <section className={`${panelClass} p-4 sm:p-5`}>
      <SettingsContentHeader title={title} note={note} onCancel={() => onOpenSection('Settings')} onSave={() => onNotify(`${title} saved`)} />
      <SettingsInventoryStats stats={resolvedStats} />
      {loading ? <p className="py-8 text-center text-[13px] font-bold text-[#53647f]">Loading...</p> : (
        <SettingsInventoryTable
          title={`${title} List`}
          searchPlaceholder={`Search ${title.toLowerCase()}...`}
          addLabel={addLabel}
          onNotify={onNotify}
          onAdd={() => { setEditing(null); setModalOpen(true); }}
          columns={[...columns.slice(0, -1), 'Action']}
          rows={tableRows}
          sideTitle={sideTitle}
          sideRows={sideRows}
        />
      )}
      {modalOpen ? (
        <SettingsMasterFormModal
          title={addLabel.replace(/^Add\\s+/i, '')}
          initial={editing ? { name: editing.name, code: editing.code || '', status: editing.status || (editing.is_active ? 'Active' : 'Inactive') } : null}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSave={saveMaster}
        />
      ) : null}
    </section>
  );
}

function SettingsCategoryIntegrationPage({
  category,
  title,
  note,
  configTitle,
  renderConfigFields,
  masterType,
  templateColumns,
  mapTemplateRow,
  stats,
  sideTitle,
  sideRows,
  addLabel,
  onOpenSection,
  onNotify,
}) {
  const { form, loading, saving, save, updateField } = useSettingsCategory(category, {}, onNotify);
  const { rows, loading: mastersLoading, setRows } = useSettingsMasters(masterType, onNotify);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const reloadMasters = () => settingsApi.masters.list({ master_type: masterType })
    .then((res) => {
      const list = Array.isArray(res) ? res : (res?.results ?? []);
      setRows(list);
    });

  const saveMaster = async (payload) => {
    const body = {
      master_type: masterType,
      name: payload.name,
      code: payload.code || payload.name.toUpperCase().replace(/\\s+/g, '-').slice(0, 20),
      is_active: payload.status !== 'Inactive',
      metadata: { ...(editing?.metadata || {}), channel: category },
    };
    try {
      if (editing?.id) await settingsApi.masters.update(editing.id, body);
      else await settingsApi.masters.create(body);
      setModalOpen(false);
      setEditing(null);
      await reloadMasters();
      onNotify(`${payload.name} saved`);
    } catch {
      onNotify('Could not save template.', 'error');
    }
  };

  const templateRows = rows.map((row) => {
    const cells = mapTemplateRow(row);
    return [
      ...cells.slice(0, -1),
      <div key={`${row.id}-tpl-actions`} className="flex items-center justify-end gap-2">
        <UserActionButton label={`Edit ${row.name}`} icon={FileText} tone="blue" onClick={() => { setEditing({ ...row, status: row.is_active ? 'Active' : 'Inactive' }); setModalOpen(true); }} />
        <UserActionButton label={`Delete ${row.name}`} icon={Trash2} tone="blue" onClick={() => settingsApi.masters.delete(row.id).then(reloadMasters).then(() => onNotify(`${row.name} deleted`)).catch(() => onNotify('Delete failed', 'error'))} />
      </div>,
    ];
  });

  return (
    <section className={`${panelClass} p-4 sm:p-5`}>
      <SettingsContentHeader title={title} note={note} onCancel={() => onOpenSection('Settings')} onSave={save} saving={saving} />
      <SettingsInventoryStats stats={stats} />
      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-4">
          <SettingsSectionCard title={configTitle} className="shadow-none">
            {loading ? <p className="text-[13px] font-bold text-[#53647f]">Loading configuration...</p> : (
              <div className="grid gap-4 md:grid-cols-2">{renderConfigFields(form, updateField, onNotify)}</div>
            )}
          </SettingsSectionCard>
          {mastersLoading ? <p className="text-[13px] font-bold text-[#53647f]">Loading templates...</p> : (
            <SettingsInventoryTable
              title={`${title} Templates`}
              searchPlaceholder={`Search ${title.toLowerCase()}...`}
              addLabel={addLabel}
              onNotify={onNotify}
              onAdd={() => { setEditing(null); setModalOpen(true); }}
              columns={[...templateColumns.slice(0, -1), 'Action']}
              rows={templateRows}
              sideTitle="Summary"
              sideRows={[['Total Templates', String(rows.length)], ['Active', String(rows.filter((row) => row.is_active).length)], ['Channel', category], ['Last Update', 'Live']]}
            />
          )}
        </div>
        <div className="space-y-4">
          <SettingsSidebarInfoCard title={sideTitle} icon={Info}>
            <div className="space-y-3">{sideRows.map(([label, value]) => <SettingsPreviewRow key={label} label={label} value={value} />)}</div>
          </SettingsSidebarInfoCard>
        </div>
      </section>
      {modalOpen ? (
        <SettingsMasterFormModal
          title="Template"
          initial={editing ? { name: editing.name, code: editing.code || '', status: editing.status || (editing.is_active ? 'Active' : 'Inactive') } : null}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSave={saveMaster}
        />
      ) : null}
    </section>
  );
}

function SettingsInventoryCategoryPage({ category, title, note, renderConfigFields, masterType, masterTitle, masterColumns, mapMasterRow, sideRows, onOpenSection, onNotify }) {
  const { form, loading, saving, save, updateField } = useSettingsCategory(category, {}, onNotify);

  return (
    <section className={`${panelClass} p-4 sm:p-5 space-y-4`}>
      <SettingsContentHeader title={title} note={note} onCancel={() => onOpenSection('Settings')} onSave={save} saving={saving} />
      <SettingsSectionCard title="Configuration" className="shadow-none">
        {loading ? <p className="text-[13px] font-bold text-[#53647f]">Loading...</p> : (
          <div className="grid gap-4 md:grid-cols-2">{renderConfigFields(form, updateField)}</div>
        )}
      </SettingsSectionCard>
      <SettingsMastersCrudPanel
        masterType={masterType}
        title={masterTitle}
        note={`Manage ${masterTitle.toLowerCase()} records.`}
        columns={masterColumns}
        mapRow={mapMasterRow}
        sideTitle="Policy"
        sideRows={sideRows}
        addLabel={`Add ${masterTitle.replace(/s$/, '')}`}
        onOpenSection={onOpenSection}
        onNotify={onNotify}
      />
    </section>
  );
}

'''

marker = "function SettingsProductCategoriesContent"
if "function useSettingsCategory" not in text:
    text = text.replace(marker, HELPERS + marker)

# SettingsContentHeader - add optional saving prop
text = text.replace(
    "function SettingsContentHeader({ title, note, onCancel, onSave }) {",
    "function SettingsContentHeader({ title, note, onCancel, onSave, saving = false }) {",
)

text = text.replace(
    '<button type="button" onClick={onSave} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[#078c3e] px-5 text-[13px] font-extrabold text-white shadow-[0_12px_22px_rgba(13,159,74,0.22)] transition hover:bg-[#067832] min-[460px]:w-auto"><Save className="size-4" />Save Changes</button>',
    '<button type="button" disabled={saving} onClick={onSave} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[#078c3e] px-5 text-[13px] font-extrabold text-white shadow-[0_12px_22px_rgba(13,159,74,0.22)] transition hover:bg-[#067832] disabled:opacity-60 min-[460px]:w-auto"><Save className="size-4" />{saving ? \'Saving...\' : \'Save Changes\'}</button>',
)

# SettingsInventoryTable - add onAdd prop
text = text.replace(
    "function SettingsInventoryTable({ title, searchPlaceholder, addLabel, columns, rows, sideTitle, sideRows, onNotify }) {",
    "function SettingsInventoryTable({ title, searchPlaceholder, addLabel, columns, rows, sideTitle, sideRows, onNotify, onAdd }) {",
)

text = text.replace(
    '<button type="button" onClick={() => onNotify(`${addLabel} opened`)} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[#078c3e] px-5 text-[13px] font-extrabold text-white md:w-auto"><Plus className="size-4" />{addLabel}</button>',
    '<button type="button" onClick={() => (onAdd ? onAdd() : onNotify(`${addLabel} opened`))} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[#078c3e] px-5 text-[13px] font-extrabold text-white md:w-auto"><Plus className="size-4" />{addLabel}</button>',
)

# Replace SettingsProductCategoriesContent with CRUD version
OLD_PC = """function SettingsProductCategoriesContent({ onOpenSection, onNotify }) {
  const { rows, loading } = useSettingsMasters('product_category', onNotify);
  const activeCount = rows.filter((row) => row.is_active).length;

  return (
    <section className={`${panelClass} p-4 sm:p-5`}>
      <SettingsContentHeader title="Product Categories" note="Manage inventory product categories, parent groups and default tax rules." onCancel={() => onOpenSection('Settings')} onSave={() => onNotify('Product categories saved')} />
      <SettingsInventoryStats stats={[['Total Categories', String(rows.length), Boxes, 'green'], ['Active Categories', String(activeCount), CheckCircle2, 'blue'], ['Mapped Products', '—', Database, 'purple'], ['Inactive', String(rows.length - activeCount), Minus, 'amber']]} />
      {loading ? <p className="py-8 text-center text-[13px] font-bold text-[#53647f]">Loading categories...</p> : (
      <SettingsInventoryTable
        title="Category List"
        searchPlaceholder="Search product categories..."
        addLabel="Add Category"
        onNotify={onNotify}
        columns={['Category Name', 'Code', 'Parent Category', 'Products', 'Default Tax', 'Status', 'Action']}
        rows={rows.map((row) => [
          row.name,
          row.code || '—',
          row.metadata?.parent || '—',
          row.metadata?.items ?? '—',
          row.metadata?.tax ?? '—',
          <SettingsStatusBadge label={row.is_active ? 'Active' : 'Inactive'} tone={row.is_active ? 'green' : 'amber'} />,
          <UserActionButton label={`Open ${row.name}`} icon={MoreVertical} tone="blue" onClick={() => onNotify(`${row.name} category opened`)} />,
        ])}
        sideTitle="Category Rules"
        sideRows={[['Default Valuation', 'FIFO'], ['Negative Stock', 'Blocked'], ['Auto SKU', 'Enabled'], ['Tax Mapping', 'Required']]}
      />
      )}
    </section>
  );
}"""

NEW_PC = """function SettingsProductCategoriesContent({ onOpenSection, onNotify }) {
  return (
    <SettingsMastersCrudPanel
      masterType="product_category"
      title="Product Categories"
      note="Manage inventory product categories, parent groups and default tax rules."
      columns={['Category Name', 'Code', 'Parent Category', 'Default Tax', 'Status', 'Action']}
      mapRow={(row) => [
        row.name,
        row.code || '—',
        row.metadata?.parent || '—',
        row.metadata?.tax ?? '—',
        <SettingsStatusBadge label={row.is_active ? 'Active' : 'Inactive'} tone={row.is_active ? 'green' : 'amber'} />,
        null,
      ]}
      stats={[['Total Categories', '—', Boxes, 'green'], ['Active', '—', CheckCircle2, 'blue'], ['Mapped Products', '—', Database, 'purple'], ['Inactive', '—', Minus, 'amber']]}
      sideTitle="Category Rules"
      sideRows={[['Default Valuation', 'FIFO'], ['Negative Stock', 'Blocked'], ['Auto SKU', 'Enabled'], ['Tax Mapping', 'Required']]}
      addLabel="Add Category"
      onOpenSection={onOpenSection}
      onNotify={onNotify}
    />
  );
}"""

if OLD_PC in text:
    text = text.replace(OLD_PC, NEW_PC)

# Units
text = text.replace(
    "function SettingsUnitsMeasurementContent({ onOpenSection, onNotify }) {\n  const rows = [",
    "function SettingsUnitsMeasurementContent_OLD({ onOpenSection, onNotify }) {\n  const rows = [",
    1,
)

UNITS_NEW = '''
function SettingsUnitsMeasurementContent({ onOpenSection, onNotify }) {
  return (
    <SettingsMastersCrudPanel
      masterType="unit"
      title="Units of Measurement"
      note="Configure inventory units, decimal precision and conversion behavior."
      columns={['Unit', 'Code', 'Type', 'Precision', 'Base Unit', 'Status', 'Action']}
      mapRow={(row) => [
        row.name,
        row.code || '—',
        row.metadata?.type || '—',
        row.metadata?.precision ?? '—',
        row.metadata?.base ? 'Yes' : 'No',
        <SettingsStatusBadge label={row.is_active ? 'Active' : 'Inactive'} />,
        null,
      ]}
      sideTitle="Conversion Defaults"
      sideRows={[['Decimal Mode', 'Item wise'], ['Rounding', 'Nearest'], ['Purchase UOM', 'Enabled'], ['Sales UOM', 'Enabled']]}
      addLabel="Add Unit"
      onOpenSection={onOpenSection}
      onNotify={onNotify}
    />
  );
}
'''
if "function SettingsUnitsMeasurementContent({ onOpenSection" not in text.split("SettingsUnitsMeasurementContent_OLD")[0][-500:]:
    text = text.replace("function SettingsUnitsMeasurementContent_OLD", UNITS_NEW + "\nfunction SettingsUnitsMeasurementContent_OLD", 1)

# Tax
text = text.replace(
    "function SettingsTaxSettingsContent({ onOpenSection, onNotify }) {\n  const rows = [",
    "function SettingsTaxSettingsContent_OLD({ onOpenSection, onNotify }) {\n  const rows = [",
    1,
)
TAX_NEW = '''
function SettingsTaxSettingsContent({ onOpenSection, onNotify }) {
  return (
    <SettingsMastersCrudPanel
      masterType="tax"
      title="Tax Settings"
      note="Manage GST slabs, tax codes and item-wise tax mapping for inventory."
      columns={['Tax Name', 'Code', 'Rate', 'Type', 'Applies To', 'Status', 'Action']}
      mapRow={(row) => [
        row.name,
        row.code || '—',
        row.metadata?.rate ?? '—',
        row.metadata?.type || 'GST',
        row.metadata?.applies || '—',
        <SettingsStatusBadge label={row.is_active ? 'Active' : 'Inactive'} />,
        null,
      ]}
      sideTitle="Tax Configuration"
      sideRows={[['Default Sale Tax', 'GST 18%'], ['Default Purchase Tax', 'GST 18%'], ['HSN Required', 'Yes'], ['Round Off', 'Nearest Rupee']]}
      addLabel="Add Tax"
      onOpenSection={onOpenSection}
      onNotify={onNotify}
    />
  );
}
'''
text = text.replace("function SettingsTaxSettingsContent_OLD", TAX_NEW + "\nfunction SettingsTaxSettingsContent_OLD", 1)

# Stock - inventory category + stock_rule masters
STOCK_OLD_START = "function SettingsStockSettingsContent({ onOpenSection, onNotify }) {"
STOCK_NEW = '''function SettingsStockSettingsContent({ onOpenSection, onNotify }) {
  return (
    <SettingsInventoryCategoryPage
      category="inventory"
      title="Stock Settings"
      note="Configure inventory control, alerts, valuation and stock movement rules."
      renderConfigFields={(form, updateField) => (
        <>
          <SettingsSelectField label="Negative Stock" value={form.negativeStock || 'Blocked'} onChange={(v) => updateField('negativeStock', v)} options={['Blocked', 'Allowed', 'Warning Only']} />
          <SettingsSelectField label="Low Stock Alert" value={form.lowStockAlert || 'Enabled'} onChange={(v) => updateField('lowStockAlert', v)} options={['Enabled', 'Disabled']} />
          <SettingsSelectField label="Reorder Level" value={form.reorderLevel || 'Item Wise'} onChange={(v) => updateField('reorderLevel', v)} options={['Item Wise', 'Category Wise', 'Warehouse Wise']} />
          <SettingsSelectField label="Stock Valuation" value={form.stockValuation || 'FIFO'} onChange={(v) => updateField('stockValuation', v)} options={['FIFO', 'LIFO', 'Weighted Average']} />
          <SettingsSelectField label="Batch Tracking" value={form.batchTracking || 'Optional'} onChange={(v) => updateField('batchTracking', v)} options={['Optional', 'Required', 'Disabled']} />
          <SettingsSelectField label="Serial Tracking" value={form.serialTracking || 'Enabled'} onChange={(v) => updateField('serialTracking', v)} options={['Enabled', 'Disabled']} />
          <SettingsInputField label="Primary Warehouse" value={form.primaryWarehouse || ''} onChange={(v) => updateField('primaryWarehouse', v)} />
          <SettingsSelectField label="Stock Audit" value={form.stockAudit || 'Monthly'} onChange={(v) => updateField('stockAudit', v)} options={['Weekly', 'Monthly', 'Quarterly']} />
        </>
      )}
      masterType="stock_rule"
      masterTitle="Stock Control Rules"
      masterColumns={['Rule', 'Code', 'Value', 'Module', 'Status', 'Action']}
      mapMasterRow={(row) => [
        row.name,
        row.code || '—',
        row.metadata?.value ?? '—',
        row.metadata?.module || '—',
        <SettingsStatusBadge label={row.is_active ? 'Active' : 'Inactive'} />,
        null,
      ]}
      sideRows={[['Primary Warehouse', 'Indore Main'], ['Approval Required', 'Stock Outward'], ['Auto GRN', 'Enabled'], ['Stock Audit', 'Monthly']]}
      onOpenSection={onOpenSection}
      onNotify={onNotify}
    />
  );
}

function SettingsStockSettingsContent_OLD({ onOpenSection, onNotify }) {'''

if STOCK_OLD_START in text and "SettingsStockSettingsContent_OLD" not in text:
    text = text.replace(STOCK_OLD_START, STOCK_NEW, 1)

APP.write_text(text, encoding="utf-8")
print("Part 1 done")
