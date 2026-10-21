/** Fetch production HTML + JS and report unsupported syntax + path layout. */
const urls = ['https://crm.ecomalwa.com/', 'https://ecomalwa.com/crm/'];

function scan(text) {
  return {
    optional_chaining: (text.match(/\?\.(?:[A-Za-z_$]|\[)/g) || []).length,
    nullish: (text.match(/\?\?(?![?=])/g) || []).length,
    private_js: (text.match(/this\.#\w+|(?<![\w$])#\w+\(|(?<![\w$])#\w+\s*=/g) || []).length,
    bigint: (text.match(/\b\d+n\b/g) || []).length,
  };
}

for (const base of urls) {
  const htmlRes = await fetch(`${base}?t=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } });
  const html = await htmlRes.text();
  const scripts = [...html.matchAll(/(?:src|data-src)="([^"]+\.js)"/g)].map((m) => m[1]);
  const legacyEntry = (html.match(/data-src="([^"]*legacy[^"]*)"/) || [])[1] || null;
  const absRoot = scripts.some((s) => s.startsWith('/assets/'));
  console.log('\n===', base, 'HTTP', htmlRes.status, '===');
  console.log('legacy_loader', html.includes('vite-legacy-entry'));
  console.log('modern_detect', html.includes('__vite_is_modern_browser'));
  console.log('absolute_root_assets', absRoot);
  console.log('script_srcs', scripts.map((s) => s.split('/').pop()));
  console.log('legacy_entry', legacyEntry);

  const modernMain = scripts.find((s) => /index-[^/]+\.js$/.test(s) && !s.includes('legacy'));
  if (modernMain) {
    const assetUrl = new URL(modernMain, base);
    const t = await (await fetch(assetUrl)).text();
    console.log('modern_index', scan(t), 'bytes', t.length, 'url', assetUrl.pathname);
  }
  if (legacyEntry) {
    const assetUrl = new URL(legacyEntry, base);
    const t = await (await fetch(assetUrl)).text();
    console.log('legacy_index', scan(t), 'bytes', t.length, 'url', assetUrl.pathname);
  }
  // Relative to page URL — critical for /crm/ (do NOT use origin-root /sw.js)
  const swUrl = new URL('sw.js', base);
  const swRes = await fetch(`${swUrl.href}?t=${Date.now()}`);
  const sw = await swRes.text();
  const ver = (sw.match(/VERSION\s*=\s*['"`]([^'"`]+)['"`]/) || [])[1];
  console.log('sw_url', swUrl.pathname, 'http', swRes.status, 'version', ver);
}
