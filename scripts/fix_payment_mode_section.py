"""Fix corrupted PaymentModeListPage section in App.jsx."""
from pathlib import Path

APP = Path(__file__).resolve().parent.parent / 'src' / 'App.jsx'
GIT = Path(__file__).resolve().parent / 'App.jsx.githead'

current = APP.read_text(encoding='utf-8')
git_lines = GIT.read_text(encoding='utf-8-sig').splitlines(keepends=True)

def find_line(lines, prefix):
    for i, l in enumerate(lines):
        if l.startswith(prefix):
            return i
    raise ValueError(f'Not found: {prefix}')

git_start = find_line(git_lines, 'function PaymentModeListPage')
git_end = find_line(git_lines, 'function InventoryManagementPage')

restored = ''.join(git_lines[git_start:git_end])
restored = restored.replace(
    "{modalType === 'Settings' ? <AccountUtilityModal type=\"Accounts Settings\" accounts={accountRows} onClose={() => setModalType(null)} onSaveTransaction={() => setModalType(null)} onNotify={onNotify} /> : null}",
    '',
)

cur_lines = current.splitlines(keepends=True)
cur_start = find_line(cur_lines, 'function PaymentModeListPage')
cur_end = find_line(cur_lines, 'function InventoryManagementPage')

result = ''.join(cur_lines[:cur_start]) + restored + ''.join(cur_lines[cur_end:])
APP.write_text(result, encoding='utf-8')
print('Restored PaymentModeListPage section from git HEAD')
