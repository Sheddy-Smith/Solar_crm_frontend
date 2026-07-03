"""Remove orphaned Accounts helper functions from App.jsx."""
from pathlib import Path

APP = Path(__file__).resolve().parent.parent / 'src' / 'App.jsx'
lines = APP.read_text(encoding='utf-8').splitlines(keepends=True)

KEEP_MARKERS = {
    'function OpsStatCard',
    'function PaymentModeMobileCard',
    'function PaymentModeModal',
    'function formatCurrencyPrecise',
    'function AccountStatusBadge',
}

def is_function_start(line):
    return line.startswith('function ')

def find_function_end(start_idx):
    """Find end of function starting at start_idx (exclusive end line index)."""
    depth = 0
    started = False
    for i in range(start_idx, len(lines)):
        chunk = lines[i]
        for ch in chunk:
            if ch == '{':
                depth += 1
                started = True
            elif ch == '}':
                depth -= 1
                if started and depth == 0:
                    return i + 1
    return len(lines)

# Region: after PaymentModeListPage closing brace until InventoryManagementPage
start_marker = 'function PaymentModeListPage'
end_marker = 'function InventoryManagementPage'

start_idx = next(i for i, l in enumerate(lines) if l.startswith(start_marker))
# find end of PaymentModeListPage
pm_end = find_function_end(start_idx)
inv_start = next(i for i, l in enumerate(lines) if l.startswith(end_marker))

block = lines[pm_end:inv_start]
new_block = []
i = 0
while i < len(block):
    line = block[i]
    if is_function_start(line):
        name = line.split('(')[0].replace('function ', '').strip()
        end = find_function_end(pm_end + i) - pm_end
        func_lines = block[i:end]
        header = func_lines[0]
        keep = any(header.startswith(f'function {m.replace("function ", "")}') or m in header for m in KEEP_MARKERS)
        # simpler match
        keep = any(k in header for k in KEEP_MARKERS)
        if keep:
            new_block.extend(func_lines)
            if end < len(block) and block[end].strip() == '':
                new_block.append(block[end])
                i = end + 1
                continue
        i = end
        continue
    # skip non-function lines between removed functions (blank lines)
    if line.strip() == '':
        if new_block and new_block[-1].strip() != '':
            new_block.append(line)
    i += 1

result = lines[:pm_end] + new_block + lines[inv_start:]
APP.write_text(''.join(result), encoding='utf-8')
print(f'Removed {inv_start - pm_end - len(new_block)} lines of dead Accounts helpers')
print(f'New line count: {len(result)}')
