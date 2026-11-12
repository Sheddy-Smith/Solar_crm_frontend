#!/usr/bin/env python3
"""Fail CI / pre-commit if staged or tracked paths look like DB dumps or secrets."""
from __future__ import annotations

import re
import subprocess
import sys

BLOCK_PATTERNS = [
    re.compile(r'(^|/)Data/.*\.(sql|json)$', re.I),
    re.compile(r'_dump\.sql$', re.I),
    re.compile(r'hostinger_to_local\.(sql|json)$', re.I),
    re.compile(r'HOSTINGER_MYSQL_CREATE_TABLES', re.I),
    re.compile(r'(^|/)\.env$', re.I),
    re.compile(r'(^|/)\.env\.(local|production|staging|prod|secret)$', re.I),
    re.compile(r'\.(pem|p12|pfx)$', re.I),
]


def listed_paths():
    try:
        staged = subprocess.check_output(
            ['git', 'diff', '--cached', '--name-only', '--diff-filter=ACMR'],
            text=True,
        ).splitlines()
    except Exception:
        staged = []
    try:
        tracked = subprocess.check_output(
            ['git', 'ls-files'],
            text=True,
        ).splitlines()
    except Exception:
        tracked = []
    return staged, tracked


def main():
    staged, tracked = listed_paths()
    offenders = []
    for path in staged:
        if any(p.search(path.replace('\\', '/')) for p in BLOCK_PATTERNS):
            offenders.append(f'staged:{path}')
    # Soft report for already-tracked historical leftovers (should be empty after cleanup).
    tracked_hits = [
        path for path in tracked
        if any(p.search(path.replace('\\', '/')) for p in BLOCK_PATTERNS)
    ]
    if offenders:
        print('Refusing commit — dump/secret-like paths staged:')
        for item in offenders:
            print(' ', item)
        return 1
    if tracked_hits:
        print('WARNING: dump/secret-like paths still tracked (history cleanup pending):')
        for item in tracked_hits[:20]:
            print(' ', item)
    print('check_no_secret_dumps: ok')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
