#!/usr/bin/env python3
"""Strip Hostinger-incompatible CHECK constraints from MySQL dump."""
import re
from pathlib import Path

src = Path(r"C:\Malwa_Solar_CRM\HOSTINGER_MYSQL_CREATE_TABLES.sql")
dst = Path(r"C:\Malwa_Solar_CRM\HOSTINGER_MYSQL_CREATE_TABLES_FIXED.sql")
text = src.read_text(encoding="utf-8", errors="replace")

# Remove CONSTRAINT `name` CHECK (...)
text = re.sub(
    r",?\s*CONSTRAINT\s+`[^`]+`\s+CHECK\s*\((?:[^()]|\([^()]*\))*\)",
    "",
    text,
    flags=re.I | re.S,
)
# Remove bare CHECK (...)
text = re.sub(
    r",?\s*CHECK\s*\((?:[^()]|\([^()]*\))*\)",
    "",
    text,
    flags=re.I | re.S,
)

text = text.replace("utf8mb4_0900_ai_ci", "utf8mb4_unicode_ci")

# Cleanup any leftover regexp_like fragments
clean_lines = []
for line in text.splitlines():
    if "regexp_like" in line.lower():
        if "FOREIGN KEY" in line and " or " in line:
            line = line.split(" or ", 1)[0].rstrip().rstrip(",")
            if line and not line.endswith(";"):
                # will close with next );
                pass
        else:
            continue
    clean_lines.append(line)
text = "\n".join(clean_lines)

# Trailing commas before closing paren
text = re.sub(r",(\s*\))", r"\1", text)

header = (
    "-- FIXED for Hostinger phpMyAdmin\n"
    "-- Removed CHECK / regexp_like constraints (not supported)\n"
    "-- Collation: utf8mb4_unicode_ci\n"
    "-- Import: select DB u808821982_Solar_CRM -> Import -> this file -> Go\n\n"
)
if not text.lstrip().startswith("-- FIXED"):
    text = header + text

dst.write_text(text, encoding="utf-8", newline="\n")
print("wrote", dst)
print("bytes", dst.stat().st_size)
print("regexp_like", "regexp_like" in text.lower())
print("CREATE TABLE", len(re.findall(r"CREATE TABLE", text, re.I)))

# Show accounts_user tail
m = re.search(r"CREATE TABLE `accounts_user` \(.*?;", text, re.S)
if m:
    chunk = m.group(0)
    print("--- accounts_user tail ---")
    print(chunk[-500:])
