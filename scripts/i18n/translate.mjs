#!/usr/bin/env node
/**
 * Translates scripts/i18n/catalog.json into src/i18n/locales/<lang>.json.
 *
 * - Incremental: only strings missing from an existing locale file are sent.
 * - CRM glossary: domain words (Lead, Quotation, Challan...) are written
 *   phonetically in the target script instead of being literally translated
 *   ("Lead" must not become "leadership"), and codes (GST, IVRS, kWp...) stay
 *   in English.
 * - `{0}` placeholders are preserved; a translation that loses one is dropped
 *   (the UI then falls back to English for that string).
 *
 * Usage: node scripts/i18n/translate.mjs [hi pa gu ...]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CATALOG = join(ROOT, 'scripts', 'i18n', 'catalog.json');
const LOCALES = join(ROOT, 'src', 'i18n', 'locales');
const GLOSSARY_CACHE = join(ROOT, 'scripts', 'i18n', 'glossary-cache.json');

export const LANGS = ['hi', 'pa', 'gu', 'mr', 'bn', 'ta', 'te'];

const TRANSLITERATE_TERMS = [
  'Sales Challan', 'Delivery Challan', 'Challans', 'Challan', 'Quotations', 'Quotation', 'Leads', 'Lead',
  'Follow-ups', 'Follow-up', 'Follow ups', 'Follow up', 'Followups', 'Followup', 'Dispatch', 'Invoices', 'Invoice',
  'Job Sheets', 'Job Sheet', 'Work Orders', 'Work Order', 'Site Surveys', 'Site Survey', 'Site Visits', 'Site Visit',
  'Dashboard', 'Inventory', 'Stock', 'Vendors', 'Vendor', 'Suppliers', 'Supplier', 'Projects', 'Project',
  'Installations', 'Installation', 'Liaisoning', 'Commissioning', 'Net Metering', 'Inverters', 'Inverter', 'Solar',
  'Tele Executive', 'Tele Sales', 'Super Admin', 'Admin', 'Material Planning',
];
const KEEP_TERMS = [
  'Malwa Solar Energy', 'MALWA SOLAR ENERGY', 'Malwa Solar', 'Malwa', 'Sheddy Smith Lab', 'PM Surya Ghar', 'GSTIN', 'GST', 'IVRS', 'kWp', 'kWh', 'kVA', 'kW', 'BOM', 'PDF',
  'Excel', 'CSV', 'XLSX', 'CRM', 'WhatsApp', 'OTP', 'DISCOM', 'PAN', 'IFSC', 'HSN', 'SKU', 'UOM', 'QR', 'UPI', 'NEFT',
  'RTGS', 'API', 'SMS', 'O&M', 'MC4', 'Wi-Fi', 'URL', 'SLA', 'ID', 'AC', 'DC', 'PWA', 'Google', 'Android', 'iOS',
];

const INPUT_TOOLS_CODE = { hi: 'hi', pa: 'pa', gu: 'gu', mr: 'mr', bn: 'bn', ta: 'ta', te: 'te' };

const HI_GLOSSARY = {
  'sales challan': 'सेल्स चालान', 'delivery challan': 'डिलीवरी चालान', challans: 'चालान', challan: 'चालान',
  quotations: 'कोटेशन', quotation: 'कोटेशन', leads: 'लीड्स', lead: 'लीड',
  'follow-ups': 'फॉलो-अप', 'follow-up': 'फॉलो-अप', 'follow ups': 'फॉलो-अप', 'follow up': 'फॉलो-अप', followups: 'फॉलो-अप', followup: 'फॉलो-अप',
  dispatch: 'डिस्पैच', invoices: 'इनवॉइस', invoice: 'इनवॉइस', 'job sheets': 'जॉब शीट', 'job sheet': 'जॉब शीट',
  'work orders': 'वर्क ऑर्डर', 'work order': 'वर्क ऑर्डर', 'site surveys': 'साइट सर्वे', 'site survey': 'साइट सर्वे',
  'site visits': 'साइट विज़िट', 'site visit': 'साइट विज़िट', dashboard: 'डैशबोर्ड', inventory: 'इन्वेंटरी', stock: 'स्टॉक',
  vendors: 'वेंडर', vendor: 'वेंडर', suppliers: 'सप्लायर', supplier: 'सप्लायर', projects: 'प्रोजेक्ट्स', project: 'प्रोजेक्ट',
  installations: 'इंस्टॉलेशन', installation: 'इंस्टॉलेशन', liaisoning: 'लाइज़निंग', commissioning: 'कमीशनिंग',
  'net metering': 'नेट मीटरिंग', inverters: 'इन्वर्टर', inverter: 'इन्वर्टर', solar: 'सोलर',
  'tele executive': 'टेली एग्जीक्यूटिव', 'tele sales': 'टेली सेल्स', 'super admin': 'सुपर एडमिन', admin: 'एडमिन',
  'material planning': 'मटेरियल प्लानिंग',
};

const GLOSSARY_OVERRIDES = {
  hi: HI_GLOSSARY,
  mr: HI_GLOSSARY,
  pa: {
    'sales challan': 'ਸੇਲਜ਼ ਚਲਾਨ', 'delivery challan': 'ਡਿਲੀਵਰੀ ਚਲਾਨ', challans: 'ਚਲਾਨ', challan: 'ਚਲਾਨ',
    quotations: 'ਕੋਟੇਸ਼ਨ', quotation: 'ਕੋਟੇਸ਼ਨ', leads: 'ਲੀਡਜ਼', lead: 'ਲੀਡ',
    'follow-ups': 'ਫਾਲੋ-ਅੱਪ', 'follow-up': 'ਫਾਲੋ-ਅੱਪ', 'follow ups': 'ਫਾਲੋ-ਅੱਪ', 'follow up': 'ਫਾਲੋ-ਅੱਪ', followups: 'ਫਾਲੋ-ਅੱਪ', followup: 'ਫਾਲੋ-ਅੱਪ',
    dispatch: 'ਡਿਸਪੈਚ', invoices: 'ਇਨਵੌਇਸ', invoice: 'ਇਨਵੌਇਸ', 'job sheets': 'ਜੌਬ ਸ਼ੀਟ', 'job sheet': 'ਜੌਬ ਸ਼ੀਟ',
    'work orders': 'ਵਰਕ ਆਰਡਰ', 'work order': 'ਵਰਕ ਆਰਡਰ', 'site surveys': 'ਸਾਈਟ ਸਰਵੇ', 'site survey': 'ਸਾਈਟ ਸਰਵੇ',
    'site visits': 'ਸਾਈਟ ਵਿਜ਼ਿਟ', 'site visit': 'ਸਾਈਟ ਵਿਜ਼ਿਟ', dashboard: 'ਡੈਸ਼ਬੋਰਡ', inventory: 'ਇਨਵੈਂਟਰੀ', stock: 'ਸਟਾਕ',
    vendors: 'ਵੈਂਡਰ', vendor: 'ਵੈਂਡਰ', suppliers: 'ਸਪਲਾਇਰ', supplier: 'ਸਪਲਾਇਰ', projects: 'ਪ੍ਰੋਜੈਕਟਸ', project: 'ਪ੍ਰੋਜੈਕਟ',
    installations: 'ਇੰਸਟਾਲੇਸ਼ਨ', installation: 'ਇੰਸਟਾਲੇਸ਼ਨ', liaisoning: 'ਲਾਇਜ਼ਨਿੰਗ', commissioning: 'ਕਮਿਸ਼ਨਿੰਗ',
    'net metering': 'ਨੈੱਟ ਮੀਟਰਿੰਗ', inverters: 'ਇਨਵਰਟਰ', inverter: 'ਇਨਵਰਟਰ', solar: 'ਸੋਲਰ',
    'tele executive': 'ਟੈਲੀ ਐਗਜ਼ੀਕਿਊਟਿਵ', 'tele sales': 'ਟੈਲੀ ਸੇਲਜ਼', 'super admin': 'ਸੁਪਰ ਐਡਮਿਨ', admin: 'ਐਡਮਿਨ',
    'material planning': 'ਮਟੀਰੀਅਲ ਪਲਾਨਿੰਗ',
  },
};

/** Phonetic spellings give far better script output than English spellings. */
const PHONETIC = {
  'sales challan': 'sels chalaan', 'delivery challan': 'delivari chalaan', challans: 'chalaan', challan: 'chalaan',
  quotations: 'kotesans', quotation: 'kotesan', leads: 'leeds', lead: 'leed',
  'follow-ups': 'folo-aps', 'follow-up': 'folo-ap', 'follow ups': 'folo-aps', 'follow up': 'folo-ap', followups: 'folo-aps', followup: 'folo-ap',
  dispatch: 'dispech', invoices: 'invoisis', invoice: 'invois', 'job sheets': 'job sheets', 'job sheet': 'job sheet',
  'work orders': 'wark orders', 'work order': 'wark order', 'site surveys': 'sait sarves', 'site survey': 'sait sarve',
  'site visits': 'sait vizits', 'site visit': 'sait vizit', dashboard: 'dashbord', inventory: 'inventri', stock: 'stok',
  vendors: 'vendars', vendor: 'vendar', suppliers: 'saplaayars', supplier: 'saplaayar', projects: 'projekts', project: 'projekt',
  installations: 'instolesans', installation: 'instolesan', liaisoning: 'laizaning', commissioning: 'kamishaning',
  'net metering': 'net meetring', inverters: 'invartars', inverter: 'invartar', solar: 'solar',
  'tele executive': 'teli eksikyutiv', 'tele sales': 'teli sels', 'super admin': 'supar edmin', admin: 'edmin',
  'material planning': 'metiriyal planing',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const termRegex = new RegExp(
  [...TRANSLITERATE_TERMS.map((t) => ({ t, keep: false })), ...KEEP_TERMS.map((t) => ({ t, keep: true }))]
    .sort((a, b) => b.t.length - a.t.length)
    .map(({ t, keep }) => (keep ? `(?<![A-Za-z])${escapeRe(t)}(?![A-Za-z])` : `(?<![A-Za-z])(?i:${escapeRe(t)})(?![A-Za-z])`))
    .join('|')
    .replace(/\(\?i:([^)]*)\)/g, (_, body) => body.replace(/[A-Za-z]/g, (c) => `[${c.toLowerCase()}${c.toUpperCase()}]`)),
  'g',
);
const KEEP_SET = new Set(KEEP_TERMS);

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

async function getJson(url, attempt = 0) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36' } });
  const text = await res.text();
  if (res.ok && (text.startsWith('[') || text.startsWith('"'))) return JSON.parse(text);
  if (attempt >= 5) throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
  const wait = 5000 * (attempt + 1) ** 2;
  console.warn(`  throttled (HTTP ${res.status}), waiting ${wait / 1000}s...`);
  await sleep(wait);
  return getJson(url, attempt + 1);
}

async function transliterate(word, lang) {
  const url = `https://inputtools.google.com/request?text=${encodeURIComponent(word)}&itc=${INPUT_TOOLS_CODE[lang]}-t-i0-und&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8&app=demopage`;
  const data = await getJson(url);
  if (data[0] !== 'SUCCESS') return word;
  return (data[1] || []).map((seg) => seg[1]?.[0] || seg[0]).join(' ');
}

async function loadGlossary(lang, cache) {
  cache[lang] ||= {};
  const overrides = GLOSSARY_OVERRIDES[lang] || {};
  for (const term of TRANSLITERATE_TERMS) {
    const key = term.toLowerCase();
    if (overrides[key]) { cache[lang][key] = overrides[key]; continue; }
    if (cache[lang][key]) continue;
    const phonetic = PHONETIC[key] || key;
    const parts = [];
    for (const segment of phonetic.split(/\s+/)) {
      const pieces = [];
      for (const piece of segment.split('-')) {
        pieces.push(await transliterate(piece, lang));
        await sleep(150);
      }
      parts.push(pieces.join('-'));
    }
    cache[lang][key] = parts.join(' ');
  }
  writeFileSync(GLOSSARY_CACHE, `${JSON.stringify(cache, null, 1)}\n`);
  return cache[lang];
}

function protect(text) {
  const tokens = [];
  const out = text.replace(termRegex, (m) => {
    tokens.push(m);
    return `ZQX${tokens.length - 1}`;
  });
  return { out, tokens };
}

function restore(translated, tokens, glossary) {
  let ok = true;
  const out = translated.replace(/Z\s?Q\s?X\s?(\d+)/gi, (_, n) => {
    const src = tokens[Number(n)];
    if (src == null) { ok = false; return ''; }
    if (KEEP_SET.has(src)) return src;
    return glossary[src.toLowerCase()] || src;
  });
  const used = (translated.match(/Z\s?Q\s?X\s?\d+/gi) || []).length;
  return { out, ok: ok && used === tokens.length };
}

function placeholders(s) {
  return (s.match(/\{\d+\}/g) || []).sort().join(',');
}

function validTranslation(source, translated) {
  if (!translated || !translated.trim()) return false;
  if (placeholders(source) !== placeholders(translated)) return false;
  return true;
}

async function translateBatch(texts, lang) {
  const url = `https://translate.googleapis.com/translate_a/t?client=gtx&sl=en&tl=${lang}&${texts.map((t) => `q=${encodeURIComponent(t)}`).join('&')}`;
  const data = await getJson(url);
  const list = Array.isArray(data) ? data : [data];
  return list.map((item) => decodeEntities(Array.isArray(item) ? item[0] : item));
}

function makeBatches(items, maxChars = 5200, maxItems = 90) {
  const batches = [];
  let current = [];
  let size = 0;
  for (const item of items) {
    const len = encodeURIComponent(item.out).length + 3;
    if (current.length && (size + len > maxChars || current.length >= maxItems)) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(item);
    size += len;
  }
  if (current.length) batches.push(current);
  return batches;
}

async function translateLanguage(lang, catalog, glossaryCache) {
  const file = join(LOCALES, `${lang}.json`);
  const existing = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const glossary = await loadGlossary(lang, glossaryCache);
  const todo = catalog.filter((s) => !(s in existing));
  console.log(`[${lang}] ${Object.keys(existing).length} existing, ${todo.length} to translate`);
  const wanted = new Set(catalog);
  // Drop strings that were removed from the UI so locale bundles don't grow forever.
  const result = Object.fromEntries(Object.entries(existing).filter(([k]) => wanted.has(k)));
  const items = todo.map((source) => ({ source, ...protect(source) }));

  const direct = items.filter((it) => /^ZQX\d+$/.test(it.out));
  for (const it of direct) {
    const { out, ok } = restore(it.out, it.tokens, glossary);
    if (ok) result[it.source] = out;
  }

  const batches = makeBatches(items.filter((it) => !/^ZQX\d+$/.test(it.out)));
  let done = 0;
  let dropped = 0;
  for (const batch of batches) {
    let translated;
    try {
      translated = await translateBatch(batch.map((it) => it.out), lang);
    } catch (e) {
      console.warn(`  batch failed: ${e.message}`);
      translated = [];
    }
    batch.forEach((it, i) => {
      const raw = translated.length === batch.length ? translated[i] : null;
      if (raw == null) { dropped += 1; return; }
      const { out, ok } = restore(raw, it.tokens, glossary);
      if (ok && validTranslation(it.source, out)) result[it.source] = out.trim();
      else dropped += 1;
    });
    done += batch.length;
    process.stdout.write(`  ${done}/${items.length}\r`);
    writeFileSync(file, `${JSON.stringify(sortKeys(result), null, 1)}\n`);
    await sleep(900);
  }
  writeFileSync(file, `${JSON.stringify(sortKeys(result), null, 1)}\n`);
  console.log(`\n[${lang}] done — ${Object.keys(result).length} strings, ${dropped} kept in English`);
}

function sortKeys(obj) {
  return Object.fromEntries(Object.keys(obj).sort((a, b) => a.localeCompare(b)).map((k) => [k, obj[k]]));
}

const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
const limit = Number(process.env.I18N_LIMIT || 0);
const source = limit ? catalog.slice(0, limit) : catalog;
const langs = process.argv.slice(2).filter((l) => LANGS.includes(l));
mkdirSync(LOCALES, { recursive: true });
const glossaryCache = existsSync(GLOSSARY_CACHE) ? JSON.parse(readFileSync(GLOSSARY_CACHE, 'utf8')) : {};
for (const lang of langs.length ? langs : LANGS) {
  await translateLanguage(lang, source, glossaryCache);
}
