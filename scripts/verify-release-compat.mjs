/**
 * Pre-deploy compatibility gate for dual URL layouts + Android 8.1 legacy build.
 * Does not deploy. Run after: npm run build
 *
 * Checks:
 *   - dist relative asset paths (works for / and /crm/)
 *   - legacy loader + BUILD_ID stamp
 *   - manifest/icons relative
 *   - SW stamped (no __MALWA_BUILD_ID__)
 *   - optional live production scan (PASS/FAIL for each host)
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dist = path.resolve('dist');
const report = { ok: true, checks: [], production: [] };

function check(name, pass, detail) {
  report.checks.push({ name, pass, detail });
  if (!pass) report.ok = false;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

if (!fs.existsSync(dist)) {
  console.error('dist/ missing — run npm run build first');
  process.exit(1);
}

const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const absAsset = /(?:src|href)=["']\/(?:assets|icons|sw\.js|manifest)/.test(html);
check('dist_html_no_root_absolute_assets', !absAsset, absAsset ? 'found /assets|/icons|/sw.js|/manifest' : 'relative refs OK');
check('dist_html_relative_assets', /\.\/assets\//.test(html) || /src="assets\//.test(html), 'script/link under ./assets');
check('dist_legacy_loader', html.includes('vite-legacy-entry') && html.includes('nomodule'), 'vite-legacy-entry + nomodule');
check('dist_modern_detect', html.includes('__vite_is_modern_browser'), 'feature detection present');
check('dist_build_id_meta', /malwa-build-id/.test(html), 'meta malwa-build-id');

const sw = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8');
const swBuildId = (sw.match(/const BUILD_ID = ['"]([a-f0-9]{12})['"]/) || [])[1];
check(
  'dist_sw_stamped',
  !sw.includes('__MALWA_BUILD_ID__') && Boolean(swBuildId),
  swBuildId ? `BUILD_ID=${swBuildId}` : 'placeholder not replaced',
);
check(
  'dist_sw_no_html_cache',
  sw.includes("request.mode === 'navigate'") && sw.includes('fetch(request)'),
  'navigate uses network-first fetch',
);

const manifest = fs.readFileSync(path.join(dist, 'manifest.webmanifest'), 'utf8');
const man = JSON.parse(manifest);
check(
  'dist_manifest_relative',
  typeof man.start_url === 'string' &&
    man.start_url.startsWith('./') &&
    typeof man.scope === 'string' &&
    man.scope.startsWith('./') &&
    Array.isArray(man.icons) &&
    man.icons.every((i) => String(i.src || '').startsWith('./')),
  `start_url=${man.start_url} scope=${man.scope}`,
);

const assets = fs.readdirSync(path.join(dist, 'assets'));
const legacyJs = assets.filter((f) => f.endsWith('.js') && f.includes('legacy'));
check('dist_legacy_chunks', legacyJs.length > 0, `${legacyJs.length} legacy JS files`);

const buildIdPath = path.join(dist, 'build-id.json');
check('dist_build_id_json', fs.existsSync(buildIdPath), fs.existsSync(buildIdPath) ? fs.readFileSync(buildIdPath, 'utf8').trim().slice(0, 120) : 'missing');

const guard = spawnSync(process.execPath, [path.resolve('scripts/check-android61-syntax.mjs')], {
  encoding: 'utf8',
});
check('syntax_guard', guard.status === 0, (guard.stdout || guard.stderr || '').trim().split('\n').pop());

async function probeHost(base) {
  const row = { url: base, status: 'FAIL', details: {} };
  const isSubpath = /\/crm\/?$/.test(new URL(base).pathname);
  try {
    const htmlRes = await fetch(`${base}?t=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } });
    const text = await htmlRes.text();
    row.details.http = htmlRes.status;
    row.details.legacy_loader = text.includes('vite-legacy-entry');
    const scripts = [...text.matchAll(/(?:src|data-src)="([^"]+\.js)"/g)].map((m) => m[1]);
    row.details.scripts = scripts.map((s) => s.split('/').pop()).slice(0, 8);
    const absRootAssets = scripts.some((s) => s.startsWith('/assets/'));
    const relAssets = scripts.some((s) => s.startsWith('./assets/') || s.startsWith('assets/'));
    row.details.absolute_root_assets = absRootAssets;
    row.details.relative_assets = relAssets;
    row.details.layout = isSubpath ? 'subpath' : 'root';

    const first = scripts.find((s) => s.includes('assets/'));
    if (first) {
      const assetUrl = new URL(first, base);
      const aRes = await fetch(assetUrl.href, { method: 'HEAD' });
      row.details.first_asset = assetUrl.pathname;
      row.details.first_asset_status = aRes.status;
    }

    const swUrl = new URL('sw.js', base);
    const swRes = await fetch(`${swUrl.href}?t=${Date.now()}`);
    const swText = await swRes.text();
    row.details.sw_http = swRes.status;
    const swBuild = (swText.match(/const BUILD_ID = ['"]([^'"]+)['"]/) || [])[1]
      || (swText.match(/VERSION\s*=\s*['"`]([^'"`]+)['"`]/) || [])[1]
      || null;
    row.details.sw_build = swBuild;
    row.details.sw_is_new_stamp = Boolean(swBuild && /^[a-f0-9]{12}$/.test(swBuild));

    // Subpath MUST use relative assets. Root may still use absolute until redeployed,
    // but target build uses relative for both.
    const assetOk = row.details.first_asset_status === 200;
    const pathOk = isSubpath
      ? htmlRes.status === 200 && relAssets && !absRootAssets && assetOk
      : htmlRes.status === 200 && assetOk && (relAssets || absRootAssets);
    const targetBuild = relAssets && row.details.sw_is_new_stamp;
    const legacyOk = row.details.legacy_loader;
    row.status = pathOk && legacyOk ? (targetBuild ? 'PASS' : 'PASS_OLD_BUILD') : 'FAIL';
    if (!pathOk) {
      row.details.reason = isSubpath && absRootAssets
        ? 'absolute /assets/ 404 under /crm/ — deploy relative-base build'
        : 'asset resolve or HTTP fail';
    }
    if (!legacyOk) row.details.reason = `${row.details.reason || ''}; no legacy loader`.replace(/^; /, '');
    if (row.status === 'PASS_OLD_BUILD') {
      row.details.reason = 'works on this host but not the verified relative+BUILD_ID release yet';
    }
  } catch (e) {
    row.status = 'FAIL';
    row.details.error = String(e.message || e);
  }
  report.production.push(row);
  console.log(`${row.status}  production ${base} — ${JSON.stringify(row.details)}`);
}

const skipLive = process.argv.includes('--offline');
if (!skipLive) {
  await probeHost('https://crm.ecomalwa.com/');
  await probeHost('https://ecomalwa.com/crm/');
} else {
  console.log('SKIP  live production probes (--offline)');
}

const outPath = path.join(dist, 'compat-verify-report.json');
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`\nWrote ${outPath}`);
console.log(report.ok ? '\nLOCAL GATE: PASS (deploy still requires explicit authorization)' : '\nLOCAL GATE: FAIL');
// Exit on local dist checks only — live production may be stale until authorized deploy.
process.exit(report.ok ? 0 : 1);
