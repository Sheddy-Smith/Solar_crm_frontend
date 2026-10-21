/**
 * Fail the build if production JS still contains syntax Chrome 61 / Android 8.1
 * System WebView cannot parse. Scans dist/assets (legacy + modern entry chunks).
 *
 * Usage: node scripts/check-android61-syntax.mjs [--legacy-only]
 */
import fs from 'node:fs';
import path from 'node:path';

const distAssets = path.resolve('dist/assets');
const legacyOnly = process.argv.includes('--legacy-only');

if (!fs.existsSync(distAssets)) {
  console.error('dist/assets missing — run npm run build first');
  process.exit(1);
}

const files = fs.readdirSync(distAssets).filter((f) => f.endsWith('.js'));
// Always guard legacy app chunks. polyfills-legacy contains regex literals
// like /()??/ for feature detection — not nullish-coalescing operators.
const targets = files.filter((f) => {
  if (f.startsWith('polyfills-legacy')) return false;
  return f.includes('-legacy-') || f.includes('legacy-');
});
if (!targets.length && !legacyOnly) {
  console.error('No legacy chunks found in dist/assets — plugin-legacy may be disabled');
  process.exit(1);
}

// Note: minifiers emit ternaries like `void 0===r?.8:r` (meaning `r===undefined?.8:r`).
// That is NOT optional chaining — require a letter/_/$/[ after `?.`.
const checks = [
  { name: 'optional_chaining', re: /\?\.(?:[A-Za-z_$]|\[)/g },
  { name: 'nullish_coalescing', re: /\?\?(?![?=])/g },
  { name: 'private_field_or_method', re: /this\.#\w+|(?<![\w$])#\w+\(|(?<![\w$])#\w+\s*=/g },
  { name: 'bigint_literal', re: /\b\d+n\b/g },
];

let failed = false;
const summary = [];

for (const file of targets) {
  const text = fs.readFileSync(path.join(distAssets, file), 'utf8');
  const hits = {};
  for (const { name, re } of checks) {
    const m = text.match(re) || [];
    if (m.length) hits[name] = { count: m.length, sample: m.slice(0, 3) };
  }
  if (Object.keys(hits).length) {
    failed = true;
    summary.push({ file, hits });
  }
}

const html = fs.readFileSync(path.resolve('dist/index.html'), 'utf8');
const hasLegacy = html.includes('vite-legacy-entry') && html.includes('nomodule');
if (!hasLegacy) {
  failed = true;
  summary.push({ file: 'index.html', hits: { missing_legacy_loader: { count: 1, sample: ['vite-legacy-entry / nomodule missing'] } } });
}

if (failed) {
  console.error('Android 8.1 / Chrome 61 syntax guard FAILED:');
  console.error(JSON.stringify(summary, null, 2));
  process.exit(1);
}

console.log(`Android 8.1 syntax guard OK (${targets.filter((f) => f.includes('legacy')).length} legacy JS files scanned, legacy loader present).`);
