#!/bin/bash
# Run ON ecomalwa Hostinger via SSH — creates fresh site archive + DB dump in home tmp
set -euo pipefail
ROOT="$HOME/domains/ecomalwa.com/public_html"
OUT="$HOME/tmp_ecomalwa_clone"
mkdir -p "$OUT"
rm -f "$OUT/files.tar.gz" "$OUT/db.sql.gz"

# Parse DB creds from wp-config
eval $(php -r '
$c=file_get_contents(getenv("HOME")."/domains/ecomalwa.com/public_html/wp-config.php");
preg_match("/define\(\s*'\''DB_NAME'\''\s*,\s*'\''([^'\'']+)/",$c,$n);
preg_match("/define\(\s*'\''DB_USER'\''\s*,\s*'\''([^'\'']+)/",$c,$u);
preg_match("/define\(\s*'\''DB_PASSWORD'\''\s*,\s*'\''([^'\'']+)/",$c,$p);
preg_match("/define\(\s*'\''DB_HOST'\''\s*,\s*'\''([^'\'']+)/",$c,$h);
echo "DB_NAME=".escapeshellarg($n[1])."\n";
echo "DB_USER=".escapeshellarg($u[1])."\n";
echo "DB_PASS=".escapeshellarg($p[1])."\n";
echo "DB_HOST=".escapeshellarg($h[1])."\n";
')

echo "Dumping DB $DB_NAME ..."
mysqldump -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" --single-transaction --quick "$DB_NAME" | gzip -c > "$OUT/db.sql.gz"
ls -lh "$OUT/db.sql.gz"

echo "Archiving files (excluding cache/updraft big zips if needed)..."
# Full site clone for accurate verify
tar -C "$HOME/domains/ecomalwa.com" -czf "$OUT/files.tar.gz" public_html
ls -lh "$OUT/files.tar.gz"
echo READY
