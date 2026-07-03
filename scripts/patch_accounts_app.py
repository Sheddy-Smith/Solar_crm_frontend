"""Patch App.jsx: replace old Accounts module with simplified backend-connected version."""
from pathlib import Path

APP = Path(__file__).resolve().parent.parent / 'src' / 'App.jsx'
ACCOUNTS_JS = Path(__file__).resolve().parent / 'accounts_module_frontend.js'

text = APP.read_text(encoding='utf-8')
accounts_code = ACCOUNTS_JS.read_text(encoding='utf-8')

# 1. Replace AccountsManagementPage router
old_router_start = 'function AccountsManagementPage({ activeSection, onOpenSection, onNotify }) {'
old_router_end = 'function AccountsListPage({ activeSection = \'Accounts List\', onOpenSection, onNotify }) {'

idx_start = text.find(old_router_start)
idx_end = text.find(old_router_end)
if idx_start == -1 or idx_end == -1:
    raise SystemExit(f'Could not find AccountsManagementPage block: start={idx_start}, end={idx_end}')

new_router = accounts_code.split('function AccountsPartiesPage')[0].rstrip() + '\n\n'
text = text[:idx_start] + new_router + text[idx_end:]

# 2. Remove AccountsListPage through formatLedgerCurrency (before SettingsMasterPage)
remove_start = 'function AccountsListPage({ activeSection = \'Accounts List\', onOpenSection, onNotify }) {'
remove_end = 'function SettingsMasterPage({ activeSection, onOpenSection, onNotify }) {'

idx_start = text.find(remove_start)
idx_end = text.find(remove_end)
if idx_start == -1 or idx_end == -1:
    raise SystemExit(f'Could not find AccountsListPage block: start={idx_start}, end={idx_end}')

text = text[:idx_start] + text[idx_end:]

# 3. Remove ChartOfAccountsPage through ChequesListPage (keep PaymentModeListPage)
remove_start = 'function ChartOfAccountsPage({ activeSection = \'Chart of Accounts\', onOpenSection, onNotify }) {'
remove_end = 'function PaymentModeListPage({ onOpenSection, onNotify }) {'

idx_start = text.find(remove_start)
idx_end = text.find(remove_end)
if idx_start == -1 or idx_end == -1:
    raise SystemExit(f'Could not find ChartOfAccountsPage block: start={idx_start}, end={idx_end}')

text = text[:idx_start] + text[idx_end:]

# 4. Remove helper components only used by deleted pages (between PaymentModeListPage end and OpsStatCard)
# Remove ChartAccountMobileCard through formatAccountCurrency
remove_start = 'function ChartAccountMobileCard({ row, index, onOpen }) {'
remove_end = 'function OpsStatCard({ label, value, caption, icon: Icon, tone, onClick, valueClassName = \'\' }) {'

idx_start = text.find(remove_start)
idx_end = text.find(remove_end)
if idx_start == -1 or idx_end == -1:
    raise SystemExit(f'Could not find mobile card block: start={idx_start}, end={idx_end}')

text = text[:idx_start] + text[idx_end:]

# 5. Fix PaymentModeListPage AccountUtilityModal - remove accountRows reference
text = text.replace(
    "{modalType === 'Settings' ? <AccountUtilityModal type=\"Accounts Settings\" accounts={accountRows} onClose={() => setModalType(null)} onSaveTransaction={() => setModalType(null)} onNotify={onNotify} /> : null}",
    "{modalType === 'Settings' ? null : null}",
)

# 6. Remove dummy data arrays (keep paymentModeRows for Settings)
dummy_markers = [
    'const accountsListRows = [',
    'const accountRows = [',
    'const accountTransactionRows = [',
    'const transactionListRows = [',
    'const chartOfAccountsRows = [',
    'const paymentReceivedRows = [',
    'const paymentMadeRows = [',
    'const bankAccountRows = [',
    'const chequeRows = [',
    'const accountSummaryRows = [',
    'const accountAgingRows = [',
]

for marker in dummy_markers:
    idx = text.find(marker)
    if idx == -1:
        print(f'Warning: marker not found: {marker}')
        continue
    # find end of array (closing ];)
    end = text.find('];', idx)
    if end == -1:
        raise SystemExit(f'Could not find end of array for {marker}')
    end += 3
    # include trailing newline
    if text[end:end+1] == '\n':
        end += 1
    text = text[:idx] + text[end:]

# 7. Insert full accounts module before AmcWarrantyPage
insert_marker = 'function AmcWarrantyPage({ activeSection, onOpenSection, onNotify }) {'
idx = text.find(insert_marker)
if idx == -1:
    raise SystemExit('Could not find AmcWarrantyPage')

full_accounts = accounts_code.rstrip() + '\n\n'
text = text[:idx] + full_accounts + text[idx:]

# 8. Update render to use AccountsPage instead of AccountsManagementPage
text = text.replace('<AccountsManagementPage', '<AccountsPage')

APP.write_text(text, encoding='utf-8')
print('App.jsx patched successfully.')
print(f'New size: {len(text.splitlines())} lines')
