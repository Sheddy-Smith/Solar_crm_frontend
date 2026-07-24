#!/usr/bin/env python3
from pathlib import Path

p = Path("/docker/temp-wp-check/html/wp-config.php")
t = p.read_text(encoding="utf-8", errors="replace")
snip = """
/* Proxy HTTPS (Caddy -> Apache) */
if (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') {
    $_SERVER['HTTPS'] = 'on';
}
"""
if "HTTP_X_FORWARDED_PROTO" not in t:
    t = t.replace("<?php", "<?php\n" + snip, 1)
    p.write_text(t, encoding="utf-8")
    print("added")
else:
    print("exists")
