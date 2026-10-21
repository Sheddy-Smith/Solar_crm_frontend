/** Fetch production HTML + JS and report unsupported syntax counts. */
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
  const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)].map((m) => m[1]);
  const legacyEntry = (html.match(/data-src="([^"]*legacy[^"]*)"/) || [])[1] || null;
  console.log('\n===', base, 'HTTP', htmlRes.status, '===');
  console.log('legacy_loader', html.includes('vite-legacy-entry'));
  console.log('modern_detect', html.includes('__vite_is_modern_browser'));
  console.log('script_srcs', scripts.map((s) => s.split('/').pop()));
  console.log('legacy_entry', legacyEntry);

  const modernMain = scripts.find((s) => /\/index-[^/]+\.js$/.test(s) && !s.includes('legacy'));
  if (modernMain) {
    const t = await (await fetch(new URL(modernMain, base))).text();
    console.log('modern_index', scan(t), 'bytes', t.length);
  }
  if (legacyEntry) {
    const t = await (await fetch(new URL(legacyEntry, base))).text();
    console.log('legacy_index', scan(t), 'bytes', t.length);
  }
  const sw = await (await fetch(new URL('/sw.js?t=' + Date.now(), base))).text();
  const ver = (sw.match(/VERSION\s*=\s*['"]([^'"]+)['"]/) || [])[1];
  console.log('sw_version', ver);
}
