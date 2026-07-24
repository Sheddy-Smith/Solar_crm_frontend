#!/bin/bash
set -euo pipefail
ROOT="$HOME/domains/ecomalwa.com/public_html"
OUT="$HOME/tmp_ecomalwa_clone"
mkdir -p "$OUT"
rm -f "$OUT/files.tar.gz" "$OUT/db.sql.gz"
CFG="$ROOT/wp-config.php"
DB_NAME=$(grep -E "define\(\s*'DB_NAME'" "$CFG" | head -1 | sed -E "s/.*',\s*'([^']+)'.*/\1/")
DB_USER=$(grep -E "define\(\s*'DB_USER'" "$CFG" | head -1 | sed -E "s/.*',\s*'([^']+)'.*/\1/")
DB_PASS=$(grep -E "define\(\s*'DB_PASSWORD'" "$CFG" | head -1 | sed -E "s/.*',\s*'([^']+)'.*/\1/")
DB_HOST=$(grep -E "define\(\s*'DB_HOST'" "$CFG" | head -1 | sed -E "s/.*',\s*'([^']+)'.*/\1/")
echo "DB=$DB_NAME HOST=$DB_HOST USER=$DB_USER"
echo "Dumping database..."
mysqldump -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" --single-transaction --quick "$DB_NAME" | gzip -c > "$OUT/db.sql.gz"
ls -lh "$OUT/db.sql.gz"
echo "Archiving files..."
tar -C "$HOME/domains/ecomalwa.com" -czf "$OUT/files.tar.gz" public_html
ls -lh "$OUT/files.tar.gz"
echo READY
