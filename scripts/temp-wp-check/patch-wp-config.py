#!/usr/bin/env python3
"""Patch WordPress config for temporary VPS check DB only."""
from pathlib import Path
import re

p = Path("/docker/temp-wp-check/html/wp-config.php")
text = p.read_text(encoding="utf-8", errors="replace")
replacements = {
    "DB_NAME": "temp_wp_check",
    "DB_USER": "temp_wp",
    "DB_PASSWORD": "TempWpCheck_2026!",
    "DB_HOST": "db",
}
for key, val in replacements.items():
    text, n = re.subn(
        rf"define\(\s*['\"]{key}['\"]\s*,\s*['\"].*?['\"]\s*\)\s*;",
        f"define( '{key}', '{val}' );",
        text,
        count=1,
        flags=re.I,
    )
    print(f"{key}: {'ok' if n else 'MISSING'}")

if "WP_HOME" not in text:
    text = text.replace(
        "<?php",
        "<?php\ndefine('WP_HOME','https://poer.in');\ndefine('WP_SITEURL','https://poer.in');\n",
        1,
    )
p.write_text(text, encoding="utf-8")
print("patched")
